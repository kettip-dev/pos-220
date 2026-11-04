const crypto = require("crypto");
const { getMySqlPromiseConnection } = require("../config/mysql.db");

/**
 * Print agents are small programs (restropro-print-agent) running inside the
 * restaurant's network. They open an outbound Socket.IO connection to the
 * "/print-agent" namespace, authenticated by a per-agent token, and relay
 * print jobs to LAN / USB printers the cloud server cannot reach itself.
 */

// agentId (number) -> { socket, tenantId, hostname, version, printers, connectedAt }
const onlineAgents = new Map();

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function generateToken() {
  return `rpa_${crypto.randomBytes(32).toString("hex")}`;
}

exports.getOnlineAgent = (agentId) => onlineAgents.get(Number(agentId)) || null;

exports.getPrintAgentsDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT id, name, token_hint, hostname, agent_version, last_seen_at, created_at
       FROM print_agents WHERE tenant_id = ? ORDER BY name ASC`,
      [tenantId]
    );
    return rows.map((row) => {
      const live = onlineAgents.get(Number(row.id));
      return {
        ...row,
        online: Boolean(live),
        installed_printers: live?.printers || [],
        // LAN printers (port 9100) the agent found on its network; agents < 1.1 do not scan.
        network_printers: live?.networkPrinters || [],
        network_scanned_at: live?.networkScannedAt || null,
        can_scan: Boolean(live?.canScan),
      };
    });
  } finally {
    conn.release();
  }
};

/**
 * Create an agent. The plain token is returned once and never stored.
 */
exports.createPrintAgentDB = async (tenantId, name) => {
  const token = generateToken();
  const conn = await getMySqlPromiseConnection();
  try {
    const [result] = await conn.query(
      `INSERT INTO print_agents (tenant_id, name, token_hash, token_hint) VALUES (?, ?, ?, ?)`,
      [tenantId, name, hashToken(token), token.slice(-6)]
    );
    return { id: result.insertId, token };
  } finally {
    conn.release();
  }
};

exports.regeneratePrintAgentTokenDB = async (tenantId, agentId) => {
  const token = generateToken();
  const conn = await getMySqlPromiseConnection();
  try {
    const [result] = await conn.query(
      `UPDATE print_agents SET token_hash = ?, token_hint = ? WHERE id = ? AND tenant_id = ?`,
      [hashToken(token), token.slice(-6), agentId, tenantId]
    );
    if (result.affectedRows === 0) return null;
  } finally {
    conn.release();
  }
  // The old token is now invalid: drop any live connection made with it.
  disconnectAgent(agentId, tenantId);
  return { id: Number(agentId), token };
};

exports.deletePrintAgentDB = async (tenantId, agentId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`UPDATE printer_configs SET agent_id = NULL WHERE agent_id = ? AND tenant_id = ?`, [agentId, tenantId]);
    await conn.query(`DELETE FROM print_agents WHERE id = ? AND tenant_id = ?`, [agentId, tenantId]);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  disconnectAgent(agentId, tenantId);
};

exports.agentBelongsToTenantDB = async (tenantId, agentId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(`SELECT id FROM print_agents WHERE id = ? AND tenant_id = ?`, [agentId, tenantId]);
    return rows.length > 0;
  } finally {
    conn.release();
  }
};

function disconnectAgent(agentId, tenantId) {
  const live = onlineAgents.get(Number(agentId));
  if (live && String(live.tenantId) === String(tenantId)) {
    live.socket.disconnect(true);
    onlineAgents.delete(Number(agentId));
  }
}

async function touchAgentDB(agentId, { hostname, version } = {}) {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.query(
      `UPDATE print_agents
       SET last_seen_at = NOW(),
           hostname = COALESCE(?, hostname),
           agent_version = COALESCE(?, agent_version)
       WHERE id = ?`,
      [hostname || null, version || null, agentId]
    );
  } finally {
    conn.release();
  }
}

function cleanLabel(value, max) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, max);
  return cleaned || null;
}

// Agent-reported LAN printers: keep only well-formed "a.b.c.d:port" entries.
function cleanNetworkPrinters(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  for (const item of list.slice(0, 64)) {
    const address = typeof item?.address === "string" ? item.address.trim() : "";
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}):(\d{1,5})$/.exec(address);
    if (!m || m.slice(1, 5).some((o) => Number(o) > 255) || Number(m[5]) > 65535 || seen.has(address)) continue;
    seen.add(address);
    const ms = Number(item.ms);
    result.push({ address, ms: Number.isFinite(ms) && ms >= 0 ? Math.round(ms) : null });
  }
  return result;
}

function cleanTimestamp(value) {
  const time = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function applyNetworkScan(live, { found, scannedAt }) {
  live.canScan = true;
  live.networkPrinters = cleanNetworkPrinters(found);
  live.networkScannedAt = cleanTimestamp(scannedAt);
}

const SCAN_TIMEOUT_MS = 25000;

/**
 * Ask an online agent to scan its LAN for printers now ("Scan again" in settings).
 * Resolves with { network_printers, network_scanned_at }.
 */
exports.scanAgentNetwork = async (tenantId, agentId) => {
  const live = onlineAgents.get(Number(agentId));
  if (!live || String(live.tenantId) !== String(tenantId)) {
    throw Object.assign(new Error("This print agent is offline. Start it on the restaurant computer and try again."), { statusCode: 409 });
  }
  if (!live.canScan) {
    throw Object.assign(new Error("This print agent is too old to scan for printers. Install the latest agent (v1.1 or newer)."), {
      statusCode: 409,
    });
  }
  let reply;
  try {
    reply = await live.socket.timeout(SCAN_TIMEOUT_MS).emitWithAck("scan_network", {});
  } catch (_) {
    throw Object.assign(new Error("The print agent did not finish scanning in time. Try again."), { statusCode: 504 });
  }
  if (!reply?.ok) {
    throw Object.assign(new Error(cleanLabel(reply?.error, 200) || "The network scan failed."), { statusCode: 502 });
  }
  // The agent may have reconnected meanwhile; update whichever connection is current.
  const current = onlineAgents.get(Number(agentId));
  if (current) applyNetworkScan(current, { found: reply.found, scannedAt: reply.scanned_at });
  return {
    network_printers: current?.networkPrinters || cleanNetworkPrinters(reply.found),
    network_scanned_at: current?.networkScannedAt || cleanTimestamp(reply.scanned_at),
  };
};

/**
 * Mount the "/print-agent" Socket.IO namespace.
 * @param {import("socket.io").Server} io
 * @param {{ onAgentOnline: (agent: {id:number, tenantId:number}) => void }} hooks
 */
exports.attachPrintAgentNamespace = (io, { onAgentOnline } = {}) => {
  const nsp = io.of("/print-agent");

  nsp.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token || typeof token !== "string") return next(new Error("missing_token"));

      const conn = await getMySqlPromiseConnection();
      let agent;
      try {
        const [rows] = await conn.query(`SELECT id, tenant_id, name FROM print_agents WHERE token_hash = ?`, [hashToken(token)]);
        agent = rows[0];
      } finally {
        conn.release();
      }
      if (!agent) return next(new Error("invalid_token"));

      socket.data.agent = { id: Number(agent.id), tenantId: Number(agent.tenant_id), name: agent.name };
      next();
    } catch (error) {
      console.error("[print-agent] auth error:", error.message);
      next(new Error("auth_failed"));
    }
  });

  nsp.on("connection", async (socket) => {
    const { id: agentId, tenantId, name } = socket.data.agent;
    const hostname = cleanLabel(socket.handshake.auth?.hostname, 100);
    const version = cleanLabel(socket.handshake.auth?.version, 30);

    // One live connection per agent: a reconnect replaces the stale socket.
    const previous = onlineAgents.get(agentId);
    if (previous && previous.socket.id !== socket.id) previous.socket.disconnect(true);

    onlineAgents.set(agentId, { socket, tenantId, hostname, version, printers: [], connectedAt: new Date() });
    console.log(`[print-agent] "${name}" (#${agentId}, tenant ${tenantId}) connected from ${hostname || "unknown host"}`);

    touchAgentDB(agentId, { hostname, version }).catch((err) => console.error("[print-agent] touch error:", err.message));

    socket.on("agent_info", (info = {}) => {
      const live = onlineAgents.get(agentId);
      if (!live || live.socket.id !== socket.id) return;
      const printers = Array.isArray(info.printers) ? info.printers : [];
      live.printers = printers.map((p) => cleanLabel(p, 128)).filter(Boolean).slice(0, 50);
      if ("network_printers" in info) {
        applyNetworkScan(live, { found: info.network_printers, scannedAt: info.network_scanned_at });
      }
    });

    socket.on("disconnect", () => {
      const live = onlineAgents.get(agentId);
      if (live && live.socket.id === socket.id) onlineAgents.delete(agentId);
      touchAgentDB(agentId).catch(() => {});
      console.log(`[print-agent] "${name}" (#${agentId}) disconnected`);
    });

    if (typeof onAgentOnline === "function") {
      try {
        await onAgentOnline({ id: agentId, tenantId });
      } catch (error) {
        console.error("[print-agent] flush error:", error.message);
      }
    }
  });

  return nsp;
};
