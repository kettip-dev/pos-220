const { getMySqlPromiseConnection } = require("../config/mysql.db");

/**
 * Register (or refresh) a device token. A token identifies exactly one app
 * install, so if the same token re-registers under another user (new login on
 * the same phone) the row is moved to that user instead of duplicated.
 */
exports.upsertDeviceTokenDB = async ({ tenantId, userId, platform, fcmToken }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
    INSERT INTO devices (tenant_id, user_id, platform, fcm_token)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      tenant_id = VALUES(tenant_id),
      user_id = VALUES(user_id),
      platform = VALUES(platform),
      updated_at = CURRENT_TIMESTAMP;
    `;
    const [result] = await conn.query(sql, [tenantId, userId, platform, fcmToken]);
    return result.insertId;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/** Remove one device token (logout). Scoped to the owning user for safety. */
exports.deleteDeviceTokenDB = async (tenantId, userId, fcmToken) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [result] = await conn.query(
      `DELETE FROM devices WHERE tenant_id = ? AND user_id = ? AND fcm_token = ?`,
      [tenantId, userId, fcmToken]
    );
    return result.affectedRows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Remove tokens FCM reported as invalid/expired. Not tenant-scoped: the
 * tokens came straight back from Firebase for rows we just read, and a dead
 * token is dead for everyone.
 */
exports.deleteDeviceTokensDB = async (fcmTokens) => {
  if (!Array.isArray(fcmTokens) || fcmTokens.length === 0) return 0;
  const conn = await getMySqlPromiseConnection();
  try {
    const [result] = await conn.query(`DELETE FROM devices WHERE fcm_token IN (?)`, [fcmTokens]);
    return result.affectedRows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/** All device tokens for the given usernames (a user may have many devices). */
exports.getUserDeviceTokensDB = async (tenantId, userIds) => {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT user_id, platform, fcm_token FROM devices WHERE tenant_id = ? AND user_id IN (?)`,
      [tenantId, userIds]
    );
    return rows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Every registered device in the tenant. Only the waiter app registers
 * devices, so this is effectively "all waiters currently signed in" — used as
 * the fallback when a table has no assigned waiter.
 */
exports.getTenantDeviceTokensDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT user_id, platform, fcm_token FROM devices WHERE tenant_id = ?`,
      [tenantId]
    );
    return rows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Owner/manager device tokens for a tenant — the audience for Owner App
 * operational alerts (day-end reconciliation, low stock).
 *
 * "Owner/manager" mirrors the API authorization rule in auth.middleware
 * `authorize()`: role 'admin' always qualifies, otherwise the user must carry
 * one of the given scopes. Scopes are stored as a CSV string on users.scope,
 * so match whole tokens (spaces stripped, as the middleware trims them) rather
 * than a bare LIKE that would let "REPORTS" match "VIEW_REPORTS".
 *
 * A waiter's device is never returned, because waiters hold WAITER/POS scopes
 * and not REPORTS/INVENTORY — the same device table can therefore stay shared
 * between the waiter and owner apps.
 */
exports.getManagerDeviceTokensDB = async (tenantId, scopes = []) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const scopeMatch =
      scopes.length > 0
        ? `OR ${scopes
            .map(() => `CONCAT(',', REPLACE(COALESCE(u.scope, ''), ' ', ''), ',') LIKE CONCAT('%,', ?, ',%')`)
            .join(" OR ")}`
        : "";

    const [rows] = await conn.query(
      `SELECT DISTINCT d.user_id, d.platform, d.fcm_token
       FROM devices d
         JOIN users u ON u.username = d.user_id
         LEFT JOIN tenants t ON t.id = ?
       WHERE (
         (d.tenant_id = ? AND (u.role IN ('admin', 'group_owner') ${scopeMatch}))
         OR
         (t.business_group_id IS NOT NULL AND u.business_group_id = t.business_group_id AND u.role IN ('admin', 'group_owner'))
       )`,
      [tenantId, tenantId, ...scopes]
    );
    return rows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Tenants worth running a scheduled owner notification for: subscription
 * active and at least one owner/manager device registered. Keeps a nightly
 * sweep proportional to real usage instead of the whole tenants table.
 */
exports.getTenantsWithManagerDevicesDB = async (scopes = []) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const scopeMatch =
      scopes.length > 0
        ? `OR ${scopes
            .map(() => `CONCAT(',', REPLACE(COALESCE(u.scope, ''), ' ', ''), ',') LIKE CONCAT('%,', ?, ',%')`)
            .join(" OR ")}`
        : "";

    const [rows] = await conn.query(
      `SELECT DISTINCT t.id AS tenant_id
       FROM tenants t
         JOIN devices d ON d.tenant_id = t.id OR (t.business_group_id IS NOT NULL AND d.tenant_id IN (SELECT id FROM tenants WHERE business_group_id = t.business_group_id))
         JOIN users u ON u.username = d.user_id
       WHERE t.is_active = 1 AND (u.role IN ('admin', 'group_owner') ${scopeMatch})`,
      scopes
    );
    return rows.map((r) => r.tenant_id);
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/** Usernames of waiters assigned to a table (see table_assignments). */
exports.getAssignedWaitersForTableDB = async (tenantId, tableId) => {
  if (!tableId) return [];
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT user_id FROM table_assignments WHERE tenant_id = ? AND table_id = ? AND role = 'waiter'`,
      [tenantId, tableId]
    );
    return rows.map((r) => r.user_id);
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

// Menu titles may themselves contain commas, so the concatenated item list is
// joined on ASCII Unit Separator — a control character no title can hold —
// and split back apart by the caller.
const ITEM_SEPARATOR = "";
exports.ORDER_NOTIFICATION_ITEM_SEPARATOR = ITEM_SEPARATOR;

/**
 * Every line item on an order, oldest first, as one delimited string plus a
 * count. Kept as a correlated subquery rather than a second round trip so
 * resolving an order still costs exactly one query.
 *
 * Cancelled lines are excluded — the same rule the reports module applies —
 * so a waiter is never told to carry an item the kitchen already voided.
 */
const ORDER_ITEMS_COLUMNS = `
      (SELECT GROUP_CONCAT(mi.title ORDER BY oi2.id SEPARATOR '${ITEM_SEPARATOR}')
       FROM order_items oi2
         JOIN menu_items mi ON mi.id = oi2.item_id AND mi.tenant_id = oi2.tenant_id
       WHERE oi2.order_id = o.id AND oi2.tenant_id = o.tenant_id
         AND oi2.status = 'completed') AS item_titles,
      (SELECT COUNT(*)
       FROM order_items oi3
       WHERE oi3.order_id = o.id AND oi3.tenant_id = o.tenant_id
         AND oi3.status = 'completed') AS item_count`;

/**
 * Resolve order/table context for a status change coming from the kitchen,
 * which only knows order item ids (single or bulk) or an order id.
 * Returns one row per distinct order:
 * { id, table_id, table_title, floor, token_no, item_titles, item_count }.
 */
exports.getOrdersForNotificationDB = async (tenantId, { orderId, orderItemIds }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    let sql, params;
    if (Array.isArray(orderItemIds) && orderItemIds.length > 0) {
      sql = `
      SELECT DISTINCT o.id, o.table_id, st.table_title, st.\`floor\`, o.token_no,
        (SELECT GROUP_CONCAT(mi.title ORDER BY oi2.id SEPARATOR '${ITEM_SEPARATOR}')
         FROM order_items oi2
           JOIN menu_items mi ON mi.id = oi2.item_id AND mi.tenant_id = oi2.tenant_id
         WHERE oi2.order_id = o.id AND oi2.tenant_id = o.tenant_id
           AND oi2.id IN (?) AND oi2.status = 'completed') AS item_titles,
        (SELECT COUNT(*)
         FROM order_items oi3
         WHERE oi3.order_id = o.id AND oi3.tenant_id = o.tenant_id
           AND oi3.id IN (?) AND oi3.status = 'completed') AS item_count
      FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN store_tables st ON o.table_id = st.id
      WHERE oi.id IN (?) AND o.tenant_id = ?`;
      params = [orderItemIds, orderItemIds, orderItemIds, tenantId];
    } else if (orderId) {
      sql = `
      SELECT o.id, o.table_id, st.table_title, st.\`floor\`, o.token_no,${ORDER_ITEMS_COLUMNS}
      FROM orders o
        LEFT JOIN store_tables st ON o.table_id = st.id
      WHERE o.id = ? AND o.tenant_id = ?`;
      params = [orderId, tenantId];
    } else {
      return [];
    }
    const [rows] = await conn.query(sql, params);
    return rows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};
