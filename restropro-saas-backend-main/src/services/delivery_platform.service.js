/**
 * Delivery apps as an order channel. Orders are entered by hand at the POS
 * (no partner API yet); each app carries a price markup applied to the cart
 * and a commission rate used for reporting. All queries are tenant-scoped.
 */
const { getMySqlPromiseConnection } = require("../config/mysql.db");

const withConn = async (fn) => {
  const conn = await getMySqlPromiseConnection();
  try {
    return await fn(conn);
  } finally {
    conn.release();
  }
};

const clampPercent = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(200, Math.round(n * 100) / 100));
};

/** Clean a platform payload from the settings form. Returns { error } or { data }. */
exports.parsePlatformInput = (body = {}) => {
  const name = String(body.name || "").trim().slice(0, 60);
  if (!name) return { error: "App name is required" };
  const color = /^#[0-9a-fA-F]{6}$/.test(String(body.color || "")) ? body.color : null;
  return {
    data: {
      name,
      color,
      markupPercent: clampPercent(body.markupPercent),
      commissionPercent: clampPercent(body.commissionPercent),
      paymentTypeId: body.paymentTypeId ? Number(body.paymentTypeId) || null : null,
      isActive: body.isActive === undefined ? 1 : body.isActive ? 1 : 0,
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    },
  };
};

exports.getDeliveryPlatformsDB = (tenantId, { activeOnly = false } = {}) =>
  withConn(async (conn) => {
    const [rows] = await conn.query(
      `SELECT dp.id, dp.name, dp.color, dp.markup_percent, dp.commission_percent, dp.payment_type_id,
              pt.title AS payment_type_title, dp.is_active, dp.sort_order,
              (SELECT COUNT(*) FROM orders o WHERE o.tenant_id = dp.tenant_id AND o.delivery_platform_id = dp.id) AS order_count
       FROM delivery_platforms dp
       LEFT JOIN payment_types pt ON pt.id = dp.payment_type_id AND pt.tenant_id = dp.tenant_id
       WHERE dp.tenant_id = ? ${activeOnly ? "AND dp.is_active = 1" : ""}
       ORDER BY dp.sort_order ASC, dp.name ASC`,
      [tenantId]
    );
    return rows.map((r) => ({
      ...r,
      markup_percent: Number(r.markup_percent),
      commission_percent: Number(r.commission_percent),
      order_count: Number(r.order_count || 0),
    }));
  });

/** A payment type id is only kept if it belongs to the tenant. */
const ownPaymentTypeId = async (conn, tenantId, paymentTypeId) => {
  if (!paymentTypeId) return null;
  const [rows] = await conn.query(`SELECT id FROM payment_types WHERE id = ? AND tenant_id = ? LIMIT 1`, [paymentTypeId, tenantId]);
  return rows.length ? paymentTypeId : null;
};

exports.addDeliveryPlatformDB = (tenantId, d) =>
  withConn(async (conn) => {
    const paymentTypeId = await ownPaymentTypeId(conn, tenantId, d.paymentTypeId);
    const [result] = await conn.query(
      `INSERT INTO delivery_platforms
        (tenant_id, name, color, markup_percent, commission_percent, payment_type_id, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, d.name, d.color, d.markupPercent, d.commissionPercent, paymentTypeId, d.isActive, d.sortOrder]
    );
    return result.insertId;
  });

exports.updateDeliveryPlatformDB = (id, tenantId, d) =>
  withConn(async (conn) => {
    const paymentTypeId = await ownPaymentTypeId(conn, tenantId, d.paymentTypeId);
    const [result] = await conn.query(
      `UPDATE delivery_platforms
       SET name = ?, color = ?, markup_percent = ?, commission_percent = ?, payment_type_id = ?, is_active = ?, sort_order = ?
       WHERE id = ? AND tenant_id = ?`,
      [d.name, d.color, d.markupPercent, d.commissionPercent, paymentTypeId, d.isActive, d.sortOrder, id, tenantId]
    );
    return result.affectedRows > 0;
  });

/**
 * Delete an app with no orders; an app with past orders is turned off
 * instead so reports keep its name.
 */
exports.deleteDeliveryPlatformDB = (id, tenantId) =>
  withConn(async (conn) => {
    const [[row]] = await conn.query(
      `SELECT COUNT(*) AS n FROM orders WHERE tenant_id = ? AND delivery_platform_id = ?`,
      [tenantId, id]
    );
    if (Number(row?.n || 0) > 0) {
      const [r] = await conn.query(`UPDATE delivery_platforms SET is_active = 0 WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
      return r.affectedRows > 0 ? "deactivated" : null;
    }
    const [r] = await conn.query(`DELETE FROM delivery_platforms WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
    return r.affectedRows > 0 ? "deleted" : null;
  });

/**
 * Validate the delivery-app fields of an order inside its transaction.
 * Returns { platformId, ref } with platformId null when none was given;
 * throws when the id is not an active app of this tenant.
 */
exports.resolveOrderPlatformTx = async (conn, tenantId, platformId, ref) => {
  if (!platformId) return { platformId: null, ref: null };
  const [rows] = await conn.query(
    `SELECT id FROM delivery_platforms WHERE id = ? AND tenant_id = ? AND is_active = 1 LIMIT 1`,
    [platformId, tenantId]
  );
  if (!rows.length) {
    const err = new Error("Unknown delivery app");
    err.code = "UNKNOWN_DELIVERY_PLATFORM";
    throw err;
  }
  const cleanRef = String(ref || "").trim().slice(0, 64) || null;
  return { platformId: rows[0].id, ref: cleanRef };
};

/** True when id is an active delivery app of this tenant (checked before any invoice is written). */
exports.isActiveDeliveryPlatformDB = (tenantId, id) =>
  withConn(async (conn) => {
    const [rows] = await conn.query(
      `SELECT 1 FROM delivery_platforms WHERE id = ? AND tenant_id = ? AND is_active = 1 LIMIT 1`,
      [id, tenantId]
    );
    return rows.length > 0;
  });
