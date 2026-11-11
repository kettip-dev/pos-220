const { getMySqlPromiseConnection } = require("../config/mysql.db")

exports.getKitchenOrdersDB = async (tenantId, stationId = null) => {
  const conn = await getMySqlPromiseConnection();
  try {

    let sql = `
    SELECT
      o.id,
      o.date,
      o.delivery_type,
      o.customer_type,
      o.customer_id,
      c. \`name\` AS customer_name,
      o.table_id,
      st.table_title,
      st. \`floor\`,
      o.status,
      o.payment_status,
      o.token_no
    FROM
      orders o
      LEFT JOIN customers c ON o.customer_id = c.phone AND c.tenant_id = o.tenant_id
      LEFT JOIN store_tables st ON o.table_id = st.id
    WHERE
      date >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      AND date <= DATE_ADD(NOW(), INTERVAL 1 DAY)
      AND o.status NOT IN ('completed', 'cancelled')
      AND o.tenant_id = ?
    `;

    const params = [tenantId];

    if (stationId && stationId !== 'all') {
      if (stationId === 'unassigned') {
        sql += ` AND EXISTS (SELECT 1 FROM order_items oi_sub WHERE oi_sub.order_id = o.id AND oi_sub.kitchen_station_id IS NULL)`;
      } else {
        sql += ` AND EXISTS (SELECT 1 FROM order_items oi_sub WHERE oi_sub.order_id = o.id AND oi_sub.kitchen_station_id = ?)`;
        params.push(Number(stationId));
      }
    }

    const [kitchenOrders] = await conn.query(sql, params);

    let kitchenOrdersItems = [];
    let addons = [];

    if(kitchenOrders.length > 0) {
      const orderIds = kitchenOrders.map(o=>o.id);
      const sql2 = `
      SELECT
        oi.id,
        oi.order_id,
        oi.item_id,
        COALESCE(oi.custom_title, mi.title) AS item_title,
        oi.variant_id,
        miv.title as variant_title,
        oi.quantity,
        oi.status,
        oi.date,
        oi.addons,
        oi.notes,
        oi.started_at,
        oi.completed_at,
        oi.course,
        oi.seat_no,
        oi.fire_status,
        oi.fired_at,
        COALESCE(mi.prep_minutes, cat.prep_minutes) AS prep_minutes,
        oi.delay_minutes,
        oi.delay_reason,
        oi.kitchen_station_id,
        ks.name AS station_name,
        ks.color AS station_color,
        ks.icon AS station_icon
      FROM
        order_items oi
        LEFT JOIN menu_items mi ON oi.item_id = mi.id
        LEFT JOIN categories cat ON cat.id = mi.category AND cat.tenant_id = mi.tenant_id
        LEFT JOIN menu_item_variants miv ON oi.item_id = miv.item_id AND oi.variant_id = miv.id
        LEFT JOIN kitchen_stations ks ON oi.kitchen_station_id = ks.id
        
      WHERE oi.order_id IN (?) AND oi.is_combo_parent = 0
      `;
      const [kitchenOrdersItemsResult] = await conn.query(sql2, [orderIds]);
      kitchenOrdersItems = kitchenOrdersItemsResult;

      const rawAddons = kitchenOrdersItems.flatMap((o) => {
        try {
          return o.addons ? JSON.parse(o.addons) : [];
        } catch (e) {
          return [];
        }
      });

      const numericIds = [...new Set(
        rawAddons
          .map((a) => (typeof a === "object" && a !== null ? a.id : a))
          .filter((a) => a !== null && a !== undefined && !isNaN(Number(a)))
          .map(Number)
      )];

      const titleNames = [...new Set(
        rawAddons
          .map((a) => (typeof a === "object" && a !== null ? a.title : a))
          .filter((a) => typeof a === "string" && isNaN(Number(a)) && a.trim().length > 0)
      )];

      if (numericIds.length > 0 || titleNames.length > 0) {
        const whereClauses = [];
        const queryParams = [];

        if (numericIds.length > 0) {
          whereClauses.push(`id IN (?)`);
          queryParams.push(numericIds);
        }
        if (titleNames.length > 0) {
          whereClauses.push(`title IN (?)`);
          queryParams.push(titleNames);
        }

        queryParams.push(tenantId);

        const [addonsResult] = await conn.query(
          `SELECT id, item_id, title, price FROM menu_item_addons WHERE (${whereClauses.join(" OR ")}) AND tenant_id = ?;`,
          queryParams
        );
        addons = addonsResult || [];
      }
    }

    return {
      kitchenOrders,
      kitchenOrdersItems,
      addons
    }
    
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

// Keeps KDS prep timestamps in step with the item status:
//  preparing  -> stamp started_at once, clear completed_at (recall / undo)
//  completed  -> stamp completed_at, backfill started_at if the item was bumped straight from new
//  created    -> clear both
// Expressed as a SQL fragment so it can be appended to any `SET oi.status = ?` update.
const statusTimestampSql = (status) => {
  if (status === "preparing") {
    return `, oi.started_at = COALESCE(oi.started_at, NOW()), oi.completed_at = NULL`;
  }
  if (status === "completed") {
    return `, oi.started_at = COALESCE(oi.started_at, NOW()), oi.completed_at = NOW()`;
  }
  if (status === "created") {
    return `, oi.started_at = NULL, oi.completed_at = NULL`;
  }
  return "";
};

exports.updateOrderItemStatusDB = async (tenantId, orderItemId, status) => {
  const conn = await getMySqlPromiseConnection();
  try {
    // Scope by tenant so a kitchen user cannot mutate another tenant's item.
    const sql = `
    UPDATE order_items oi
    JOIN orders o ON o.id = oi.order_id
    SET oi.status = ?${statusTimestampSql(status)}
    WHERE oi.id = ? AND o.tenant_id = ?;
    `;

    const [result] = await conn.query(sql, [status, orderItemId, tenantId]);

    // Check if order is now fully finished
    let allFinished = false;
    let orderId = null;
    const [itemRows] = await conn.query(`SELECT order_id FROM order_items WHERE id = ?`, [orderItemId]);
    if (itemRows.length > 0) {
      orderId = itemRows[0].order_id;
      const [pendingRows] = await conn.query(`
        SELECT COUNT(*) as count FROM order_items 
        WHERE order_id = ? AND status NOT IN ('completed', 'cancelled', 'delivered')
      `, [orderId]);
      allFinished = pendingRows[0].count === 0;
    }

    return { affectedRows: result.affectedRows, allFinished, orderId };
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.bulkUpdateOrderItemStatusDB = async (tenantId, orderItemIds, status) => {
  if (!orderItemIds || !Array.isArray(orderItemIds) || orderItemIds.length === 0) {
    return 0;
  }
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
    UPDATE order_items oi
    JOIN orders o ON o.id = oi.order_id
    SET oi.status = ?${statusTimestampSql(status)}
    WHERE oi.id IN (?) AND o.tenant_id = ? AND oi.fire_status <> 'held';
    `;

    const [result] = await conn.query(sql, [status, orderItemIds, tenantId]);
    return result.affectedRows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.markOrderAllItemsStatusDB = async (tenantId, orderId, status, fromStatuses = null, stationId = null) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const params = [status, orderId, tenantId];
    let sql = `
    UPDATE order_items oi
    JOIN orders o ON o.id = oi.order_id
    SET oi.status = ?${statusTimestampSql(status)}
    WHERE oi.order_id = ? AND o.tenant_id = ? AND oi.fire_status <> 'held'
    `;

    if (Array.isArray(fromStatuses) && fromStatuses.length > 0) {
      sql += ` AND oi.status IN (?)`;
      params.push(fromStatuses);
    }

    if (stationId && stationId !== 'all') {
      if (stationId === 'unassigned') {
        sql += ` AND oi.kitchen_station_id IS NULL`;
      } else {
        sql += ` AND oi.kitchen_station_id = ?`;
        params.push(Number(stationId));
      }
    }

    const [result] = await conn.query(sql, params);

    // Check if order is now fully finished
    const [pendingRows] = await conn.query(`
      SELECT COUNT(*) as count FROM order_items 
      WHERE order_id = ? AND status NOT IN ('completed', 'cancelled', 'delivered')
    `, [orderId]);
    const allFinished = pendingRows[0].count === 0;

    return { affectedRows: result.affectedRows, allFinished };
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

// ── Kitchen delays ───────────────────────────────────────────────────────────

// Seeded the first time a tenant opens the list. `code` lets the UI translate
// the stock labels; owners can rename, re-order, add or remove any of them.
const DEFAULT_DELAY_REASONS = [
  { code: "ingredients", label: "Waiting for ingredients", icon: "🛒", default_minutes: 15 },
  { code: "no_gas", label: "No gas / equipment problem", icon: "🔥", default_minutes: 10 },
  { code: "busy", label: "Kitchen very busy", icon: "👨‍🍳", default_minutes: 5 },
  { code: "remake", label: "Remaking the dish", icon: "♻️", default_minutes: 8 },
  { code: "waiting_table", label: "Waiting for the rest of the table", icon: "🍽️", default_minutes: 5 },
];

const MAX_DELAY_MINUTES = 600;

const listDelayReasons = async (conn, tenantId) => {
  const [rows] = await conn.query(
    `SELECT id, code, label, icon, default_minutes, sort_order
     FROM kitchen_delay_reasons
     WHERE tenant_id = ? AND is_active = 1
     ORDER BY sort_order, id`,
    [tenantId]
  );
  return rows;
};

exports.getDelayReasonsDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    // Any row (even inactive) means the tenant already has a list: only seed brand-new tenants.
    const [[{ total }]] = await conn.query(
      `SELECT COUNT(*) AS total FROM kitchen_delay_reasons WHERE tenant_id = ?`,
      [tenantId]
    );
    if (Number(total) === 0) {
      const values = DEFAULT_DELAY_REASONS.map((r, i) => [tenantId, r.code, r.label, r.icon, r.default_minutes, i]);
      await conn.query(
        `INSERT INTO kitchen_delay_reasons (tenant_id, code, label, icon, default_minutes, sort_order) VALUES ?`,
        [values]
      );
    }
    return await listDelayReasons(conn, tenantId);
  } finally {
    conn.release();
  }
};

/**
 * Replaces the tenant's list: rows sent with an id are updated, rows without one
 * are inserted, and rows left out are deactivated (kept for old log entries).
 */
exports.saveDelayReasonsDB = async (tenantId, reasons) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();
    const keepIds = [];
    for (let i = 0; i < reasons.length; i++) {
      const r = reasons[i];
      if (r.id) {
        const [res] = await conn.query(
          `UPDATE kitchen_delay_reasons
           SET label = ?, icon = ?, default_minutes = ?, sort_order = ?, is_active = 1
           WHERE id = ? AND tenant_id = ?`,
          [r.label, r.icon, r.default_minutes, i, r.id, tenantId]
        );
        if (res.affectedRows > 0) {
          keepIds.push(r.id);
          continue;
        }
      }
      const [ins] = await conn.query(
        `INSERT INTO kitchen_delay_reasons (tenant_id, label, icon, default_minutes, sort_order) VALUES (?, ?, ?, ?, ?)`,
        [tenantId, r.label, r.icon, r.default_minutes, i]
      );
      keepIds.push(ins.insertId);
    }
    if (keepIds.length > 0) {
      await conn.query(
        `UPDATE kitchen_delay_reasons SET is_active = 0 WHERE tenant_id = ? AND id NOT IN (?)`,
        [tenantId, keepIds]
      );
    } else {
      await conn.query(`UPDATE kitchen_delay_reasons SET is_active = 0 WHERE tenant_id = ?`, [tenantId]);
    }
    await conn.commit();
    return await listDelayReasons(conn, tenantId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Adds (or, with a negative value, removes) extra cooking time on still-open lines.
 * `clear` resets the delay to zero. Returns per-order details for the socket alert.
 */
exports.addKitchenDelayDB = async (tenantId, { orderItemIds, minutes, reasonId, reasonLabel, clear, username }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    let reason = null;
    if (reasonId) {
      const [rows] = await conn.query(
        `SELECT id, code, label, icon FROM kitchen_delay_reasons WHERE id = ? AND tenant_id = ?`,
        [reasonId, tenantId]
      );
      reason = rows[0] || null;
    }
    const label = reason ? reason.label : reasonLabel || null;

    // Only lines of this tenant that are still being cooked.
    const [lines] = await conn.query(
      `SELECT oi.id, oi.order_id, COALESCE(oi.custom_title, mi.title) AS item_title, oi.quantity,
              o.token_no, o.table_id, st.table_title, o.delivery_type
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN menu_items mi ON mi.id = oi.item_id
       LEFT JOIN store_tables st ON st.id = o.table_id
       WHERE oi.id IN (?) AND o.tenant_id = ? AND oi.status IN ('created', 'preparing')`,
      [orderItemIds, tenantId]
    );
    if (lines.length === 0) return [];

    const ids = lines.map((l) => l.id);
    if (clear) {
      await conn.query(`UPDATE order_items SET delay_minutes = 0, delay_reason = NULL WHERE id IN (?)`, [ids]);
    } else {
      await conn.query(
        `UPDATE order_items
         SET delay_minutes = LEAST(?, GREATEST(0, delay_minutes + ?)),
             delay_reason = CASE WHEN delay_minutes = 0 THEN NULL ELSE COALESCE(?, delay_reason) END
         WHERE id IN (?)`,
        [MAX_DELAY_MINUTES, minutes, label, ids]
      );
    }

    // Group by order for the log and the alert.
    const byOrder = new Map();
    for (const l of lines) {
      if (!byOrder.has(l.order_id)) {
        byOrder.set(l.order_id, {
          orderId: l.order_id,
          tokenNo: l.token_no,
          tableTitle: l.table_title || null,
          deliveryType: l.delivery_type,
          itemIds: [],
          items: [],
        });
      }
      const g = byOrder.get(l.order_id);
      g.itemIds.push(l.id);
      g.items.push(`${l.quantity}× ${l.item_title || ""}`.trim());
    }

    const logRows = [...byOrder.values()].map((g) => [
      tenantId,
      g.orderId,
      g.itemIds.join(",").slice(0, 1000),
      reason ? reason.code : null,
      clear ? "cleared" : label,
      clear ? 0 : minutes,
      username || null,
    ]);
    await conn.query(
      `INSERT INTO kitchen_delay_log (tenant_id, order_id, order_item_ids, reason_code, reason_label, minutes, created_by) VALUES ?`,
      [logRows]
    );

    return [...byOrder.values()].map((g) => ({
      ...g,
      minutes: clear ? 0 : minutes,
      cleared: Boolean(clear),
      reason: label,
      reasonCode: reason ? reason.code : null,
      reasonIcon: reason ? reason.icon : null,
    }));
  } finally {
    conn.release();
  }
};
