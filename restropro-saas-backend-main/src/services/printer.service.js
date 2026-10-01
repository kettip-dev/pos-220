const net = require("net");
const { getMySqlPromiseConnection } = require("../config/mysql.db");


/**
 * Get all printer configs for a tenant.
 */
exports.getPrinterConfigsDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      SELECT id, name, transport, address, paper_size, is_default, is_kot_printer, auto_cut, station_id
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
exports.addPrinterConfigDB = async (tenantId, { name, transport, address, paper_size, is_default, is_kot_printer, auto_cut, station_id }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

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
      INSERT INTO printer_configs (tenant_id, name, transport, address, paper_size, is_default, is_kot_printer, auto_cut, station_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const [result] = await conn.query(sql, [
      tenantId,
      name,
      transport,
      address,
      paper_size || 80,
      isFirst ? 1 : (is_default ? 1 : 0),
      is_kot_printer ? 1 : 0,
      auto_cut !== undefined ? (auto_cut ? 1 : 0) : 1,
      station_id ? Number(station_id) : null,
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
exports.updatePrinterConfigDB = async (tenantId, printerId, updates) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

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

    const allowedFields = ['name', 'transport', 'address', 'paper_size', 'is_default', 'is_kot_printer', 'auto_cut', 'station_id'];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(field === 'station_id' ? (updates[field] ? Number(updates[field]) : null) : updates[field]);
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
 * Helper to parse IP/host and port from address string (e.g. "192.168.1.100:9100" or "192.168.1.100")
 */
function parseHostPort(address) {
  const trimmed = String(address || "").trim();
  if (!trimmed) throw new Error("Printer address is required.");
  const parts = trimmed.split(":");
  const host = parts[0].trim();
  const port = parts[1] ? parseInt(parts[1].trim(), 10) : 9100;
  if (!host) throw new Error("Invalid printer host or IP address.");
  if (isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port: ${parts[1]}. Port must be between 1 and 65535.`);
  }
  return { host, port };
}

/**
 * Send raw binary ESC/POS buffer directly over TCP socket to network printer (port 9100).
 */
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
        socket.end();
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
 * Execute a print job to a specific printer config by ID for the tenant.
 */
exports.printJobToPrinterDB = async (tenantId, printerId, base64Data) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT id, name, transport, address, paper_size, auto_cut FROM printer_configs WHERE id = ? AND tenant_id = ?`,
      [printerId, tenantId]
    );

    if (rows.length === 0) {
      throw new Error(`Printer with ID ${printerId} not found.`);
    }

    const printer = rows[0];

    if (!base64Data) {
      throw new Error("Print payload is empty.");
    }

    const buffer = Buffer.from(base64Data, "base64");
    if (buffer.length === 0) {
      throw new Error("Decoded print buffer is empty.");
    }

    const { host, port } = parseHostPort(printer.address);
    await sendRawTcpPrintJob(host, port, buffer);

    return {
      success: true,
      printer: {
        id: printer.id,
        name: printer.name,
        address: printer.address,
      },
    };
  } finally {
    conn.release();
  }
};

/**
 * Test connectivity and print a self-test diagnostic receipt on the network printer.
 */
exports.testPrinterTcpDB = async (tenantId, printerId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT id, name, transport, address, paper_size, auto_cut FROM printer_configs WHERE id = ? AND tenant_id = ?`,
      [printerId, tenantId]
    );

    if (rows.length === 0) {
      throw new Error(`Printer with ID ${printerId} not found.`);
    }

    const printer = rows[0];

    let storeName = "Restro PRO POS";
    try {
      const [storeRows] = await conn.query(`SELECT store_name FROM store_details WHERE tenant_id = ?`, [tenantId]);
      if (storeRows.length > 0 && storeRows[0].store_name) {
        storeName = storeRows[0].store_name;
      }
    } catch (_) {}

    const ESC = "\x1b";
    const GS = "\x1d";
    const divider = "-".repeat(printer.paper_size === 58 ? 32 : 48);

    let testText = "";
    testText += `${ESC}@`; // Initialize printer
    testText += `${ESC}a\x01`; // Align center
    testText += `${GS}!\x11`; // Double size text
    testText += `${storeName}\n`;
    testText += `${GS}!\x00`; // Normal size
    testText += `Direct TCP Network Test\n`;
    testText += `${divider}\n`;
    testText += `${ESC}a\x00`; // Align left
    testText += `Printer Name: ${printer.name}\n`;
    testText += `IP Address  : ${printer.address}\n`;
    testText += `Paper Width : ${printer.paper_size}mm\n`;
    testText += `Date / Time : ${new Date().toLocaleString()}\n`;
    testText += `${divider}\n`;
    testText += `${ESC}a\x01`; // Align center
    testText += `${ESC}E\x01CONNECTED SUCCESSFULLY!${ESC}E\x00\n`;
    testText += `Silent LAN/TCP thermal printing active.\n`;
    testText += `${divider}\n`;
    testText += `${ESC}d\x04`; // Feed 4 lines
    if (printer.auto_cut) {
      testText += `${GS}V\x00`; // Full paper cut
    }

    const buffer = Buffer.from(testText, "binary");
    const { host, port } = parseHostPort(printer.address);
    await sendRawTcpPrintJob(host, port, buffer);

    return {
      success: true,
      message: `Test receipt printed successfully on ${printer.name} (${host}:${port})`,
    };
  } finally {
    conn.release();
  }
};
