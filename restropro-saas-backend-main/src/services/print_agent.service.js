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
