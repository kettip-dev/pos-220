const { getMySqlPromiseConnection } = require("../config/mysql.db");

/**
 * Pickup queue — ready-but-not-served items grouped by table.
 * Reuses the same source as kitchen.service.getKitchenOrdersDB but filters
 * server-side to the rows the floor team actually needs to run.
 */
exports.getPickupQueueDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
    SELECT
      o.id,
      o.date,
      o.delivery_type,
      o.customer_type,
      o.customer_id,
      c.\`name\` AS customer_name,
      o.table_id,
      st.table_title,
      st.\`floor\`,
      o.status,
      o.payment_status,
      o.token_no
    FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.phone AND c.tenant_id = o.tenant_id
      LEFT JOIN store_tables st ON o.table_id = st.id
    WHERE o.date >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      AND o.date <= DATE_ADD(NOW(), INTERVAL 1 DAY)
      AND o.status NOT IN ('completed', 'cancelled')
      AND o.tenant_id = ?
    `;
    const [orders] = await conn.query(sql, [tenantId]);

    let items = [];
    if (orders.length > 0) {
      const ids = orders.map((o) => o.id).join(",");
      const sql2 = `
      SELECT
        oi.id,
        oi.order_id,
        oi.item_id,
        mi.title AS item_title,
        mi.image AS item_image,
        oi.variant_id,
        miv.title AS variant_title,
        oi.quantity,
        oi.status,
        oi.date,
        oi.notes
      FROM order_items oi
        LEFT JOIN menu_items mi ON oi.item_id = mi.id
        LEFT JOIN menu_item_variants miv ON oi.item_id = miv.item_id AND oi.variant_id = miv.id
      WHERE oi.order_id IN (${ids})
        AND oi.status IN ('completed','preparing','created')
      `;
      const [rows] = await conn.query(sql2);
      items = rows;
    }

    return { orders, items };
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.markItemServedDB = async (tenantId, orderItemId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
    UPDATE order_items oi
    JOIN orders o ON o.id = oi.order_id
    SET oi.status = 'delivered'
    WHERE oi.id = ? AND o.tenant_id = ? AND oi.status = 'completed';
    `;
    const [result] = await conn.query(sql, [orderItemId, tenantId]);
    return result.affectedRows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.bulkMarkItemsServedDB = async (tenantId, orderItemIds) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
    UPDATE order_items oi
    JOIN orders o ON o.id = oi.order_id
    SET oi.status = 'delivered'
    WHERE oi.id IN (?) AND o.tenant_id = ? AND oi.status = 'completed';
    `;
    const [result] = await conn.query(sql, [orderItemIds, tenantId]);
    return result.affectedRows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.serveAllReadyForOrderDB = async (tenantId, orderId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
    UPDATE order_items oi
    JOIN orders o ON o.id = oi.order_id
    SET oi.status = 'delivered'
    WHERE oi.order_id = ? AND o.tenant_id = ? AND oi.status = 'completed';
    `;
    const [result] = await conn.query(sql, [orderId, tenantId]);
    return result.affectedRows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Service requests
 */
exports.listServiceRequestsDB = async (tenantId, { status, since } = {}) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const params = [tenantId];
    let sql = `
    SELECT
      sr.*,
      u_ack.username AS ack_by_username,
      u_res.username AS resolved_by_username
    FROM service_requests sr
      LEFT JOIN users u_ack ON sr.ack_by_user_id = u_ack.username
      LEFT JOIN users u_res ON sr.resolved_by_user_id = u_res.username
    WHERE sr.tenant_id = ?
    `;
    if (status) {
      sql += ` AND sr.status = ?`;
      params.push(status);
    } else {
      sql += ` AND (sr.status IN ('open','acknowledged') OR sr.created_at >= DATE_SUB(NOW(), INTERVAL 8 HOUR))`;
    }
    if (since) {
      sql += ` AND sr.created_at >= ?`;
      params.push(since);
    }
    sql += ` ORDER BY
      FIELD(sr.status,'open','acknowledged','resolved','cancelled'),
      sr.created_at DESC
    LIMIT 200`;

    const [rows] = await conn.query(sql, params);
    return rows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.createServiceRequestDB = async (payload) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const {
      tenantId,
      tableId,
      tableTitle,
      floor,
      orderId,
      reason,
      notes,
      raisedBy,
      raisedByUserId,
    } = payload;

    const sql = `
    INSERT INTO service_requests
    (tenant_id, table_id, table_title, floor, order_id, reason, notes, raised_by, raised_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await conn.query(sql, [
      tenantId,
      tableId || null,
      tableTitle || null,
      floor || null,
      orderId || null,
      reason || "other",
      notes || null,
      raisedBy || "customer",
      raisedByUserId || null,
    ]);
    return result.insertId;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.getServiceRequestByIdDB = async (tenantId, id) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT
         sr.*,
         u_ack.username AS ack_by_username,
         u_res.username AS resolved_by_username
       FROM service_requests sr
         LEFT JOIN users u_ack ON sr.ack_by_user_id = u_ack.username
         LEFT JOIN users u_res ON sr.resolved_by_user_id = u_res.username
       WHERE sr.tenant_id = ? AND sr.id = ? LIMIT 1`,
      [tenantId, id]
    );
    return rows[0] || null;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.ackServiceRequestDB = async (tenantId, id, userId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
    UPDATE service_requests
    SET status = 'acknowledged', ack_by_user_id = ?, ack_at = NOW()
    WHERE tenant_id = ? AND id = ? AND status = 'open';
    `;
    const [result] = await conn.query(sql, [userId, tenantId, id]);
    return result.affectedRows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.resolveServiceRequestDB = async (tenantId, id, userId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
    UPDATE service_requests
    SET status = 'resolved', resolved_by_user_id = ?, resolved_at = NOW()
    WHERE tenant_id = ? AND id = ? AND status IN ('open','acknowledged');
    `;
    const [result] = await conn.query(sql, [userId, tenantId, id]);
    return result.affectedRows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.cancelServiceRequestDB = async (tenantId, id, userId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
    UPDATE service_requests
    SET status = 'cancelled', resolved_by_user_id = ?, resolved_at = NOW()
    WHERE tenant_id = ? AND id = ? AND status IN ('open','acknowledged');
    `;
    const [result] = await conn.query(sql, [userId, tenantId, id]);
    return result.affectedRows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Floor view — every table with a quick rollup of its current state so the
 * waiter can scan the room at a glance.
 */
exports.getFloorOverviewDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    // A table can have several active orders at once (e.g. multiple rounds), so
    // aggregate per table to render exactly one tile per table. Item/request
    // counts are summed across all of the table's active orders; the displayed
    // "active order" is the oldest active one (the one a waiter should act on
    // first). Without this aggregation the table appears once per active order
    // and React warns about duplicate keys.
    const sql = `
    SELECT
      st.id,
      st.table_title,
      st.floor,
      st.seating_capacity,
      active.active_order_id,
      active.token_no,
      active.order_date,
      active.delivery_type,
      active.order_status,
      active.payment_status,
      COALESCE((
        SELECT COUNT(*) FROM order_items oi
        JOIN orders o2 ON o2.id = oi.order_id
        WHERE o2.table_id = st.id AND o2.tenant_id = st.tenant_id
          AND o2.status NOT IN ('completed','cancelled')
          AND o2.date >= DATE_SUB(NOW(), INTERVAL 1 DAY)
          AND oi.status IN ('created','preparing')
      ), 0) AS items_in_kitchen,
      COALESCE((
        SELECT COUNT(*) FROM order_items oi
        JOIN orders o2 ON o2.id = oi.order_id
        WHERE o2.table_id = st.id AND o2.tenant_id = st.tenant_id
          AND o2.status NOT IN ('completed','cancelled')
          AND o2.date >= DATE_SUB(NOW(), INTERVAL 1 DAY)
          AND oi.status = 'completed'
      ), 0) AS items_ready,
      COALESCE((
        SELECT COUNT(*) FROM order_items oi
        JOIN orders o2 ON o2.id = oi.order_id
        WHERE o2.table_id = st.id AND o2.tenant_id = st.tenant_id
          AND o2.status NOT IN ('completed','cancelled')
          AND o2.date >= DATE_SUB(NOW(), INTERVAL 1 DAY)
          AND oi.status = 'delivered'
      ), 0) AS items_served,
      COALESCE((
        SELECT COUNT(*) FROM order_items oi
        JOIN orders o2 ON o2.id = oi.order_id
        WHERE o2.table_id = st.id AND o2.tenant_id = st.tenant_id
          AND o2.status NOT IN ('completed','cancelled')
          AND o2.date >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      ), 0) AS active_order_count,
      (SELECT COUNT(*) FROM service_requests sr WHERE sr.tenant_id = st.tenant_id AND sr.table_id = st.id AND sr.status IN ('open','acknowledged')) AS open_requests,
      (SELECT ta.user_id FROM table_assignments ta WHERE ta.tenant_id = st.tenant_id AND ta.table_id = st.id AND ta.role = 'waiter' LIMIT 1) AS assigned_waiter,
      (SELECT ta.user_id FROM table_assignments ta WHERE ta.tenant_id = st.tenant_id AND ta.table_id = st.id AND ta.role = 'captain' LIMIT 1) AS assigned_captain
    FROM store_tables st
      LEFT JOIN (
        SELECT o.table_id, o.tenant_id,
          o.id AS active_order_id, o.token_no, o.date AS order_date,
          o.delivery_type, o.status AS order_status, o.payment_status,
          ROW_NUMBER() OVER (PARTITION BY o.table_id ORDER BY o.date ASC, o.id ASC) AS rn
        FROM orders o
        WHERE o.tenant_id = ?
          AND o.status NOT IN ('completed','cancelled')
          AND o.date >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      ) active ON active.table_id = st.id AND active.tenant_id = st.tenant_id AND active.rn = 1
    WHERE st.tenant_id = ?
    ORDER BY st.floor, st.table_title
    `;
    const [rows] = await conn.query(sql, [tenantId, tenantId]);
    return rows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Zone assignments — lets a waiter declare which floors they're covering this
 * shift. Used to filter the floor view client-side.
 */
exports.listMyZonesDB = async (tenantId, userId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT floor FROM waiter_zone_assignments WHERE tenant_id = ? AND user_id = ? AND active = 1`,
      [tenantId, userId]
    );
    return rows.map((r) => r.floor);
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.setMyZonesDB = async (tenantId, userId, floors) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.query(
      `UPDATE waiter_zone_assignments SET active = 0 WHERE tenant_id = ? AND user_id = ?`,
      [tenantId, userId]
    );
    if (!floors || floors.length === 0) return;

    const values = floors.map((f) => [tenantId, userId, f, 1]);
    await conn.query(
      `INSERT INTO waiter_zone_assignments (tenant_id, user_id, floor, active)
       VALUES ?
       ON DUPLICATE KEY UPDATE active = 1`,
      [values]
    );
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

// ── Table assignments ─────────────────────────────────────────────
// All assignments for a tenant, joined to staff display names. Used by the web
// management screen and by the apps (to know which tables are "mine").

exports.listTableAssignmentsDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT ta.table_id, ta.user_id, ta.role, u.name AS user_name
       FROM table_assignments ta
       LEFT JOIN users u ON u.username = ta.user_id AND u.tenant_id = ta.tenant_id
       WHERE ta.tenant_id = ?`,
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

// Set or clear a single table's owner for one role. Passing userId = null/empty
// removes the assignment. This powers the table-first assign/edit/remove dialog.
exports.setTableAssignmentDB = async (tenantId, tableId, role, userId) => {
  const conn = await getMySqlPromiseConnection();
  const safeRole = role === 'captain' ? 'captain' : 'waiter';
  try {
    // A table has one owner per role, so always clear the existing one first.
    await conn.query(
      `DELETE FROM table_assignments WHERE tenant_id = ? AND table_id = ? AND role = ?`,
      [tenantId, tableId, safeRole]
    );
    if (userId) {
      await conn.query(
        `INSERT INTO table_assignments (tenant_id, table_id, user_id, role) VALUES (?, ?, ?, ?)`,
        [tenantId, tableId, userId, safeRole]
      );
    }
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

// Replace the full set of tables a staff member owns for a given role. Passing
// an empty list clears their assignments. We also free any of these tables from
// a different holder of the same role so a table has one owner per role.
exports.setStaffTableAssignmentsDB = async (tenantId, userId, role, tableIds) => {
  const conn = await getMySqlPromiseConnection();
  const safeRole = role === 'captain' ? 'captain' : 'waiter';
  try {
    await conn.beginTransaction();

    // Clear this staff member's current tables for the role.
    await conn.query(
      `DELETE FROM table_assignments WHERE tenant_id = ? AND user_id = ? AND role = ?`,
      [tenantId, userId, safeRole]
    );

    const ids = (tableIds || []).filter((n) => Number.isFinite(Number(n))).map(Number);
    if (ids.length > 0) {
      // A table holds one owner per role — releasing it from whoever had it.
      await conn.query(
        `DELETE FROM table_assignments WHERE tenant_id = ? AND role = ? AND table_id IN (?)`,
        [tenantId, safeRole, ids]
      );
      const values = ids.map((tableId) => [tenantId, tableId, userId, safeRole]);
      await conn.query(
        `INSERT INTO table_assignments (tenant_id, table_id, user_id, role) VALUES ?`,
        [values]
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};
