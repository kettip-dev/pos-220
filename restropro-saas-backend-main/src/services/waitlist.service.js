/**
 * Walk-in waitlist. Every query is scoped by tenant_id except the public
 * status lookup, which is keyed by an unguessable public_code and returns
 * only what the guest needs to see.
 */
const { getMySqlPromiseConnection } = require("../config/mysql.db");

const ACTIVE = ["waiting", "notified"];
const CLOSED = ["seated", "cancelled", "no_show"];
exports.ACTIVE_STATUSES = ACTIVE;
exports.CLOSED_STATUSES = CLOSED;

const withConn = async (fn) => {
  const conn = await getMySqlPromiseConnection();
  try {
    return await fn(conn);
  } finally {
    conn.release();
  }
};

const ENTRY_COLUMNS = `
  w.id, w.guest_name, w.phone, w.party_size, w.notes, w.quoted_wait_minutes, w.status,
  w.table_id, st.table_title, w.public_code, w.notify_count, w.notified_at, w.sms_status,
  w.sms_error, w.seated_at, w.closed_at, w.created_at, w.updated_at,
  TIMESTAMPDIFF(MINUTE, w.created_at, COALESCE(w.seated_at, w.closed_at, NOW())) AS waited_minutes`;

exports.addWaitlistEntryDB = (entry) =>
  withConn(async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO waitlist_entries
        (tenant_id, guest_name, phone, party_size, notes, quoted_wait_minutes, public_code, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.tenantId,
        entry.guestName,
        entry.phone || null,
        entry.partySize,
        entry.notes || null,
        entry.quotedWaitMinutes ?? null,
        entry.publicCode,
        entry.createdBy || null,
      ]
    );
    return result.insertId;
  });

exports.getWaitlistEntryDB = (id, tenantId) =>
  withConn(async (conn) => {
    const [rows] = await conn.query(
      `SELECT ${ENTRY_COLUMNS}
       FROM waitlist_entries w
       LEFT JOIN store_tables st ON st.id = w.table_id AND st.tenant_id = w.tenant_id
       WHERE w.id = ? AND w.tenant_id = ? LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] || null;
  });

/** Active queue (oldest first) plus today's finished entries (newest first). */
exports.getWaitlistDB = (tenantId) =>
  withConn(async (conn) => {
    const [active] = await conn.query(
      `SELECT ${ENTRY_COLUMNS}
       FROM waitlist_entries w
       LEFT JOIN store_tables st ON st.id = w.table_id AND st.tenant_id = w.tenant_id
       WHERE w.tenant_id = ? AND w.status IN (?)
       ORDER BY w.created_at ASC, w.id ASC`,
      [tenantId, ACTIVE]
    );
    const [closed] = await conn.query(
      `SELECT ${ENTRY_COLUMNS}
       FROM waitlist_entries w
       LEFT JOIN store_tables st ON st.id = w.table_id AND st.tenant_id = w.tenant_id
       WHERE w.tenant_id = ? AND w.status IN (?) AND w.created_at >= CURDATE()
       ORDER BY COALESCE(w.seated_at, w.closed_at, w.updated_at) DESC
       LIMIT 100`,
      [tenantId, CLOSED]
    );
    const [[stats]] = await conn.query(
      `SELECT
         SUM(status = 'seated') AS seated_today,
         SUM(status IN ('cancelled','no_show')) AS lost_today,
         ROUND(AVG(CASE WHEN status = 'seated'
                        THEN TIMESTAMPDIFF(MINUTE, created_at, seated_at) END)) AS avg_wait_today,
         ROUND(AVG(CASE WHEN status = 'seated' AND seated_at >= NOW() - INTERVAL 2 HOUR
                        THEN TIMESTAMPDIFF(MINUTE, created_at, seated_at) END)) AS avg_wait_recent
       FROM waitlist_entries
       WHERE tenant_id = ? AND created_at >= CURDATE()`,
      [tenantId]
    );
    return {
      active,
      closed,
      stats: {
        waiting: active.length,
        guestsWaiting: active.reduce((sum, e) => sum + Number(e.party_size || 0), 0),
        seatedToday: Number(stats?.seated_today || 0),
        lostToday: Number(stats?.lost_today || 0),
        avgWaitToday: stats?.avg_wait_today == null ? null : Number(stats.avg_wait_today),
        avgWaitRecent: stats?.avg_wait_recent == null ? null : Number(stats.avg_wait_recent),
      },
    };
  });

/** 1-based place in line among active entries (0 when not active). */
exports.getQueuePositionDB = (id, tenantId) =>
  withConn(async (conn) => {
    const [[row]] = await conn.query(
      `SELECT COUNT(*) AS ahead
       FROM waitlist_entries a
       JOIN waitlist_entries me ON me.id = ? AND me.tenant_id = ?
       WHERE a.tenant_id = me.tenant_id AND a.status IN (?)
         AND me.status IN (?)
         AND (a.created_at < me.created_at OR (a.created_at = me.created_at AND a.id <= me.id))`,
      [id, tenantId, ACTIVE, ACTIVE]
    );
    return Number(row?.ahead || 0);
  });

exports.updateWaitlistEntryDB = (id, tenantId, fields) =>
  withConn(async (conn) => {
    const [result] = await conn.query(
      `UPDATE waitlist_entries
       SET guest_name = ?, phone = ?, party_size = ?, notes = ?, quoted_wait_minutes = ?
       WHERE id = ? AND tenant_id = ?`,
      [fields.guestName, fields.phone || null, fields.partySize, fields.notes || null,
        fields.quotedWaitMinutes ?? null, id, tenantId]
    );
    return result.affectedRows > 0;
  });

/**
 * Move an entry to a new status. Seating records the table and time; other
 * closing statuses record closed_at; returning to "waiting" clears them.
 */
exports.setWaitlistStatusDB = (id, tenantId, status, tableId = null) =>
  withConn(async (conn) => {
    let sql;
    let params;
    if (status === "seated") {
      sql = `UPDATE waitlist_entries SET status = 'seated', table_id = ?, seated_at = NOW(), closed_at = NOW()
             WHERE id = ? AND tenant_id = ?`;
      params = [tableId || null, id, tenantId];
    } else if (status === "cancelled" || status === "no_show") {
      sql = `UPDATE waitlist_entries SET status = ?, closed_at = NOW() WHERE id = ? AND tenant_id = ?`;
      params = [status, id, tenantId];
    } else {
      // back to the queue (undo): keep notify history, clear the close
      sql = `UPDATE waitlist_entries
             SET status = IF(notify_count > 0, 'notified', 'waiting'),
                 table_id = NULL, seated_at = NULL, closed_at = NULL
             WHERE id = ? AND tenant_id = ?`;
      params = [id, tenantId];
    }
    const [result] = await conn.query(sql, params);
    return result.affectedRows > 0;
  });

exports.markWaitlistNotifiedDB = (id, tenantId, smsStatus, smsError) =>
  withConn(async (conn) => {
    await conn.query(
      `UPDATE waitlist_entries
       SET status = IF(status = 'waiting', 'notified', status),
           notify_count = notify_count + 1, notified_at = NOW(),
           sms_status = ?, sms_error = ?
       WHERE id = ? AND tenant_id = ?`,
      [smsStatus, smsError || null, id, tenantId]
    );
  });

exports.recordWaitlistSmsDB = (id, tenantId, smsStatus, smsError) =>
  withConn(async (conn) => {
    await conn.query(
      `UPDATE waitlist_entries SET sms_status = ?, sms_error = ? WHERE id = ? AND tenant_id = ?`,
      [smsStatus, smsError || null, id, tenantId]
    );
  });

exports.deleteWaitlistEntryDB = (id, tenantId) =>
  withConn(async (conn) => {
    const [result] = await conn.query(`DELETE FROM waitlist_entries WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
    return result.affectedRows > 0;
  });

/**
 * Guest-facing lookup by public code. Only the first name, party size, place
 * in line and timing leave the server — never the phone number or notes.
 */
exports.getPublicWaitlistStatusDB = (publicCode) =>
  withConn(async (conn) => {
    const [rows] = await conn.query(
      `SELECT w.id, w.tenant_id, w.guest_name, w.party_size, w.status, w.quoted_wait_minutes,
              w.notified_at, w.created_at,
              TIMESTAMPDIFF(MINUTE, w.created_at, NOW()) AS waited_minutes,
              sd.store_name, sd.store_image
       FROM waitlist_entries w
       LEFT JOIN store_details sd ON sd.tenant_id = w.tenant_id
       WHERE w.public_code = ? LIMIT 1`,
      [publicCode]
    );
    const entry = rows[0];
    if (!entry) return null;
    let position = 0;
    if (ACTIVE.includes(entry.status)) {
      const [[row]] = await conn.query(
        `SELECT COUNT(*) AS ahead FROM waitlist_entries
         WHERE tenant_id = ? AND status IN (?)
           AND (created_at < ? OR (created_at = ? AND id <= ?))`,
        [entry.tenant_id, ACTIVE, entry.created_at, entry.created_at, entry.id]
      );
      position = Number(row?.ahead || 0);
    }
    return {
      firstName: String(entry.guest_name || "").trim().split(/\s+/)[0] || "",
      partySize: entry.party_size,
      status: entry.status,
      position,
      quotedWaitMinutes: entry.quoted_wait_minutes,
      waitedMinutes: Number(entry.waited_minutes || 0),
      notifiedAt: entry.notified_at,
      createdAt: entry.created_at,
      storeName: entry.store_name || "",
      storeImage: entry.store_image || null,
    };
  });
