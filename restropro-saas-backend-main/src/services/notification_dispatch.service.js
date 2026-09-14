/**
 * Bookkeeping for scheduled (non request-driven) notifications.
 *
 * The once-per-tenant-per-day guarantee lives here rather than in the
 * scheduler: claiming a dispatch is a single INSERT IGNORE against a UNIQUE
 * key, so a restart mid-run, an overlapping tick, or a second app instance can
 * never produce a duplicate push.
 *
 * See migration `2026_07_28_owner_alert_notifications.sql`.
 */
const { getMySqlPromiseConnection } = require("../config/mysql.db");

/**
 * The database's idea of "now". The scheduler must agree with the reporting
 * queries, which use CURDATE()/NOW() on the DB server — deriving the business
 * date from the Node process instead would drift whenever the app and MySQL
 * run in different timezones.
 *
 * Returns { date: 'YYYY-MM-DD', minutes: minutes since local midnight }.
 */
exports.getDatabaseClockDB = async () => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today, (HOUR(NOW()) * 60 + MINUTE(NOW())) AS minutes`
    );
    return { date: rows[0].today, minutes: Number(rows[0].minutes) };
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Atomically claim today's dispatch for a tenant. Returns true only for the
 * caller that inserted the row; every later caller gets false and must not
 * send. Claiming before sending (rather than recording after) is deliberate:
 * duplicate pushes annoy owners more than a rare missed one.
 */
exports.claimScheduledDispatchDB = async (tenantId, notificationType, dispatchDate) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [result] = await conn.query(
      `INSERT IGNORE INTO notification_dispatch_log (tenant_id, notification_type, dispatch_date)
       VALUES (?, ?, ?)`,
      [tenantId, notificationType, dispatchDate]
    );
    return result.affectedRows === 1;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/** Record how many devices the claimed dispatch actually reached (diagnostics). */
exports.recordScheduledDispatchResultDB = async (tenantId, notificationType, dispatchDate, sentCount) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.query(
      `UPDATE notification_dispatch_log SET sent_count = ?
       WHERE tenant_id = ? AND notification_type = ? AND dispatch_date = ?`,
      [sentCount, tenantId, notificationType, dispatchDate]
    );
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Release a claim that could not be delivered because of an infrastructure
 * failure, so the next tick retries the same day instead of silently skipping
 * it. Only called on unexpected errors — a deliberate skip (no sales, no
 * devices) keeps its claim.
 */
exports.releaseScheduledDispatchDB = async (tenantId, notificationType, dispatchDate) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.query(
      `DELETE FROM notification_dispatch_log
       WHERE tenant_id = ? AND notification_type = ? AND dispatch_date = ?`,
      [tenantId, notificationType, dispatchDate]
    );
  } catch (error) {
    console.error(error);
  } finally {
    conn.release();
  }
};
