const { getMySqlPromiseConnection } = require("../config/mysql.db");

exports.getOrderStatusDisplayDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    // Get store info with fallback to tenant name
    const [storeRows] = await conn.query(
      `SELECT sd.store_name, sd.store_image, sd.currency, t.name AS tenant_name 
       FROM store_details sd 
       LEFT JOIN tenants t ON sd.tenant_id = t.id 
       WHERE sd.tenant_id = ? LIMIT 1;`,
      [tenantId]
    );
    const storeInfo = storeRows[0] || {};
    const storeName = storeInfo.store_name || storeInfo.tenant_name || "RestroPro";
    const storeImage = storeInfo.store_image || null;

    // Get active orders (last 24 hours, not completed, not cancelled)
    const sqlOrders = `
      SELECT
        o.id,
        o.date,
        o.delivery_type,
        o.customer_type,
        o.table_id,
        st.table_title,
        st.\`floor\`,
        o.status,
        o.token_no
      FROM
        orders o
        LEFT JOIN store_tables st ON o.table_id = st.id
      WHERE
        o.date >= DATE_SUB(NOW(), INTERVAL 1 DAY)
        AND o.date <= DATE_ADD(NOW(), INTERVAL 1 DAY)
        AND o.status NOT IN ('completed', 'cancelled')
        AND o.tenant_id = ?
      ORDER BY o.id ASC;
    `;

    const [orders] = await conn.query(sqlOrders, [tenantId]);

    let formattedOrders = [];

    if (orders.length > 0) {
      const orderIds = orders.map((o) => o.id).join(",");
      const sqlItems = `
        SELECT
          oi.id,
          oi.order_id,
          oi.item_id,
          mi.title AS item_title,
          oi.variant_id,
          miv.title AS variant_title,
          oi.quantity,
          oi.status,
          oi.notes
        FROM
          order_items oi
          LEFT JOIN menu_items mi ON oi.item_id = mi.id
          LEFT JOIN menu_item_variants miv ON oi.item_id = miv.item_id AND oi.variant_id = miv.id
        WHERE oi.order_id IN (${orderIds}) AND oi.status NOT IN ('cancelled');
      `;

      const [items] = await conn.query(sqlItems);

      formattedOrders = orders.map((order) => {
        const orderItems = items.filter((item) => item.order_id === order.id);
        return {
          id: order.id,
          date: order.date,
          delivery_type: order.delivery_type,
          table_title: order.table_title,
          floor: order.floor,
          status: order.status,
          token_no: order.token_no,
          items: orderItems.map((i) => ({
            id: i.id,
            item_title: i.item_title,
            variant_title: i.variant_title,
            quantity: i.quantity,
            status: i.status,
            notes: i.notes,
          })),
        };
      });
    }

    return {
      storeName: storeName,
      storeImage: storeImage,
      currency: storeInfo.currency || "USD",
      orders: formattedOrders,
    };
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};
