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
      const orderIds = kitchenOrders.map(o=>o.id).join(",");
      const sql2 = `
      SELECT
        oi.id,
        oi.order_id,
        oi.item_id,
        mi.title AS item_title,
        oi.variant_id,
        miv.title as variant_title,
        oi.quantity,
        oi.status,
        oi.date,
        oi.addons,
        oi.notes,
        oi.kitchen_station_id,
        ks.name AS station_name,
        ks.color AS station_color,
        ks.icon AS station_icon
      FROM
        order_items oi
        LEFT JOIN menu_items mi ON oi.item_id = mi.id
        LEFT JOIN menu_item_variants miv ON oi.item_id = miv.item_id AND oi.variant_id = miv.id
        LEFT JOIN kitchen_stations ks ON oi.kitchen_station_id = ks.id
        
      WHERE oi.order_id IN (${orderIds})
      `
      const [kitchenOrdersItemsResult] = await conn.query(sql2);
      kitchenOrdersItems = kitchenOrdersItemsResult;

      const addonIds = [...new Set([...kitchenOrdersItems.flatMap((o)=>o.addons?JSON.parse(o?.addons):[])])].join(",");
      const [addonsResult] = addonIds ? await conn.query(`SELECT id, item_id, title FROM menu_item_addons WHERE id IN (${addonIds});`):[]
      addons = addonsResult;
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

exports.updateOrderItemStatusDB = async (tenantId, orderItemId, status) => {
  const conn = await getMySqlPromiseConnection();
  try {
    // Scope by tenant so a kitchen user cannot mutate another tenant's item.
    const sql = `
    UPDATE order_items oi
    JOIN orders o ON o.id = oi.order_id
    SET oi.status = ?
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
    SET oi.status = ?
    WHERE oi.id IN (?) AND o.tenant_id = ?;
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
    SET oi.status = ?
    WHERE oi.order_id = ? AND o.tenant_id = ?
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