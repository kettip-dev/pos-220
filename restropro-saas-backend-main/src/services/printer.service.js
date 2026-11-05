const net = require("net");
const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { normalizePrinterTarget } = require("../utils/printerAddress");

class PrinterConfigError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}
exports.PrinterConfigError = PrinterConfigError;

async function assertAgentInTenant(conn, tenantId, agentId) {
  if (!agentId) return;
  const [rows] = await conn.query(`SELECT id FROM print_agents WHERE id = ? AND tenant_id = ?`, [agentId, tenantId]);
  if (rows.length === 0) throw new PrinterConfigError("Selected print agent was not found.");
}

/**
 * Get all printer configs for a tenant.
 */
exports.getPrinterConfigsDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      SELECT id, name, transport, address, paper_size, is_default, is_kot_printer, auto_cut, station_id, agent_id
      FROM printer_configs
      WHERE tenant_id = ?
      ORDER BY is_default DESC, is_kot_printer DESC, name ASC;
    `;
    const [rows] = await conn.query(sql, [tenantId]);
    return rows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Add a printer config.
 * Enforces single-default and single-KOT within the tenant.
 */
exports.addPrinterConfigDB = async (tenantId, { name, transport, address, paper_size, is_default, is_kot_printer, auto_cut, station_id, agent_id }) => {
  const agentId = agent_id ? Number(agent_id) : null;
  const target = normalizePrinterTarget({ transport, address, agentId });

  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();
    await assertAgentInTenant(conn, tenantId, agentId);

    // If this printer is the default, unmark other defaults
    if (is_default) {
      await conn.query(`UPDATE printer_configs SET is_default = 0 WHERE tenant_id = ?`, [tenantId]);
    }

    // If this printer is the KOT printer, unmark other KOT printers
    if (is_kot_printer) {
      await conn.query(`UPDATE printer_configs SET is_kot_printer = 0 WHERE tenant_id = ?`, [tenantId]);
    }

    // Check if this is the first printer — if so, make it default
    const [existing] = await conn.query(`SELECT COUNT(*) AS cnt FROM printer_configs WHERE tenant_id = ?`, [tenantId]);
    const isFirst = existing[0].cnt === 0;

    const sql = `
      INSERT INTO printer_configs (tenant_id, name, transport, address, paper_size, is_default, is_kot_printer, auto_cut, station_id, agent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const [result] = await conn.query(sql, [
      tenantId,
      name,
      target.transport,
      target.address,
      paper_size || 80,
      isFirst ? 1 : (is_default ? 1 : 0),
      is_kot_printer ? 1 : 0,
      auto_cut !== undefined ? (auto_cut ? 1 : 0) : 1,
      station_id ? Number(station_id) : null,
      agentId,
    ]);

    await conn.commit();
    return result.insertId;
  } catch (error) {
    await conn.rollback();
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Update a printer config.
 */
exports.updatePrinterConfigDB = async (tenantId, printerId, input) => {
  const updates = { ...input };
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [currentRows] = await conn.query(
      `SELECT transport, address, agent_id FROM printer_configs WHERE id = ? AND tenant_id = ?`,
      [printerId, tenantId]
    );
    if (currentRows.length === 0) throw new PrinterConfigError("Printer not found.", 404);
    const current = currentRows[0];

    // Re-validate the target whenever any part of it changes.
    if (updates.transport !== undefined || updates.address !== undefined || updates.agent_id !== undefined) {
      const agentId = updates.agent_id !== undefined ? (updates.agent_id ? Number(updates.agent_id) : null) : current.agent_id;
      const target = normalizePrinterTarget({
        transport: updates.transport !== undefined ? updates.transport : current.transport,
        address: updates.address !== undefined ? updates.address : current.address,
        agentId,
      });
      await assertAgentInTenant(conn, tenantId, agentId);
      updates.transport = target.transport;
      updates.address = target.address;
      updates.agent_id = agentId;
    }

    // If setting as default, unmark others
    if (updates.is_default) {
      await conn.query(`UPDATE printer_configs SET is_default = 0 WHERE tenant_id = ?`, [tenantId]);
    }

    // If setting as KOT, unmark others
    if (updates.is_kot_printer) {
      await conn.query(`UPDATE printer_configs SET is_kot_printer = 0 WHERE tenant_id = ?`, [tenantId]);
    }

    const fields = [];
    const values = [];

    const allowedFields = ['name', 'transport', 'address', 'paper_size', 'is_default', 'is_kot_printer', 'auto_cut', 'station_id', 'agent_id'];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(field === 'station_id' || field === 'agent_id' ? (updates[field] ? Number(updates[field]) : null) : updates[field]);
      }
    }

    if (fields.length === 0) {
      await conn.commit();
      return;
    }

    values.push(printerId, tenantId);

    const sql = `UPDATE printer_configs SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`;
    await conn.query(sql, values);

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Delete a printer config.
 */
exports.deletePrinterConfigDB = async (tenantId, printerId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.query(`DELETE FROM printer_configs WHERE id = ? AND tenant_id = ?`, [printerId, tenantId]);
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Send raw binary ESC/POS buffer directly over TCP socket to network printer (port 9100).
 */
/**
 * How long to keep the connection open after the last byte is written.
 * Many LAN printer interfaces discard whatever is still in their receive
 * buffer when the connection closes, so closing right after a large raster
 * job loses its tail: the ticket prints but the cut command never arrives.
 * Assume a slow printer takes in ~40 KB/s.
 */
function drainDelayMs(byteLength) {
  return Math.min(8000, 300 + Math.ceil(byteLength / 40));
}
exports.drainDelayMs = drainDelayMs;

function sendRawTcpPrintJob(host, port = 9100, buffer, timeoutMs = 3500) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const socket = new net.Socket();

    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      socket.write(buffer, (err) => {
        if (err) {
          if (!finished) {
            finished = true;
            socket.destroy();
            reject(new Error(`Failed writing data to printer: ${err.message}`));
          }
          return;
        }
        const linger = drainDelayMs(buffer.length);
        socket.setTimeout(timeoutMs + linger);
        setTimeout(() => {
          if (!finished) socket.end();
        }, linger);
      });
    });

    socket.on("close", (hadError) => {
      if (!finished) {
        finished = true;
        if (hadError) {
          reject(new Error(`Connection to printer at ${host}:${port} closed with transmission error.`));
        } else {
          resolve({ success: true, message: `Print job sent to ${host}:${port}` });
        }
      }
    });

    socket.on("timeout", () => {
      if (!finished) {
        finished = true;
        socket.destroy();
        reject(
          new Error(
            `Connection to printer at ${host}:${port} timed out (${timeoutMs}ms). Please check if printer is powered on and connected to the same LAN.`
          )
        );
      }
    });

    socket.on("error", (err) => {
      if (!finished) {
        finished = true;
        socket.destroy();
        reject(new Error(`Printer socket error at ${host}:${port}: ${err.message}`));
      }
    });
  });
}
exports.sendRawTcpPrintJob = sendRawTcpPrintJob;

/**
 * Build the diagnostic test receipt for a printer as base64 ESC/POS bytes.
 * It is dispatched through print_job.service, so it takes the same route
 * (print agent or server direct) as real receipts.
 */
exports.buildTestPrintPayloadDB = async (tenantId, printerId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT id, name, transport, address, paper_size, auto_cut, agent_id FROM printer_configs WHERE id = ? AND tenant_id = ?`,
      [printerId, tenantId]
    );

    if (rows.length === 0) {
      throw new PrinterConfigError(`Printer with ID ${printerId} not found.`, 404);
    }

    const printer = rows[0];

    let storeName = "Bong POS";
    try {
      const [storeRows] = await conn.query(`SELECT store_name FROM store_details WHERE tenant_id = ?`, [tenantId]);
      if (storeRows.length > 0 && storeRows[0].store_name) {
        storeName = storeRows[0].store_name;
      }
    } catch (_) {}

    const ESC = "\x1b";
    const GS = "\x1d";
    const divider = "-".repeat(printer.paper_size === 58 ? 32 : 48);
    const connection = printer.transport === "usb" ? "USB / Installed" : "Network (LAN)";
    const route = printer.agent_id ? "Print Agent" : "Server Direct";

    let testText = "";
    testText += `${ESC}@`; // Initialize printer
    testText += `${ESC}a\x01`; // Align center
    testText += `${GS}!\x11`; // Double size text
    testText += `${storeName}\n`;
    testText += `${GS}!\x00`; // Normal size
    testText += `Printer Test\n`;
    testText += `${divider}\n`;
    testText += `${ESC}a\x00`; // Align left
    testText += `Printer Name: ${printer.name}\n`;
    testText += `Connection  : ${connection}\n`;
    testText += `Address     : ${printer.address}\n`;
    testText += `Route       : ${route}\n`;
    testText += `Paper Width : ${printer.paper_size}mm\n`;
    testText += `Date / Time : ${new Date().toLocaleString()}\n`;
    testText += `${divider}\n`;
    testText += `${ESC}a\x01`; // Align center
    testText += `${ESC}E\x01CONNECTED SUCCESSFULLY!${ESC}E\x00\n`;
    testText += `${divider}\n`;
    testText += `${ESC}d\x04`; // Feed 4 lines
    if (printer.auto_cut) {
      testText += `${GS}V\x00`; // Full paper cut
    }

    return { printer, base64Data: Buffer.from(testText, "binary").toString("base64") };
  } finally {
    conn.release();
  }
};
