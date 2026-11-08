/**
 * POS selling aids:
 *  - "Often ordered together" pairs learned from the last 60 days of orders
 *    (no setup; cached per tenant for an hour).
 *  - The last order of a customer, for one-tap "Repeat last order".
 */
const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { getOrSetCache } = require("../utils/cache.util");

const PAIR_WINDOW_DAYS = 60;
const PAIRS_PER_ITEM = 3;
const MIN_PAIR_COUNT = 2;

exports.getUpsellPairsDB = async (tenantId) =>
  getOrSetCache(`tenant:${tenantId}:pos:upsell_pairs`, 3600, async () => {
    const conn = await getMySqlPromiseConnection();
    try {
      // Count how often two different menu items appear on the same order.
      const [rows] = await conn.query(
        `SELECT a.item_id AS item_id, b.item_id AS pair_id, COUNT(DISTINCT a.order_id) AS together
         FROM order_items a
         JOIN order_items b
           ON b.order_id = a.order_id AND b.tenant_id = a.tenant_id AND b.item_id <> a.item_id
         JOIN menu_items mb ON mb.id = b.item_id AND mb.tenant_id = b.tenant_id
         WHERE a.tenant_id = ?
           AND a.date >= DATE_SUB(NOW(), INTERVAL ? DAY)
           AND a.status <> 'cancelled' AND b.status <> 'cancelled'
           AND a.combo_parent_id IS NULL AND b.combo_parent_id IS NULL
           AND a.custom_title IS NULL AND b.custom_title IS NULL
           AND mb.is_enabled = 1 AND mb.is_open_item = 0
         GROUP BY a.item_id, b.item_id
         HAVING together >= ?
         ORDER BY a.item_id, together DESC`,
        [tenantId, PAIR_WINDOW_DAYS, MIN_PAIR_COUNT]
      );
      const pairs = {};
      for (const r of rows) {
        const list = pairs[r.item_id] || (pairs[r.item_id] = []);
        if (list.length < PAIRS_PER_ITEM) list.push({ id: r.pair_id, count: Number(r.together) });
      }
      return pairs;
    } finally {
      conn.release();
    }
  });

exports.getCustomerLastOrderDB = async (tenantId, customerPhone) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [[order]] = await conn.query(
      `SELECT id, date, token_no, delivery_type FROM orders
       WHERE tenant_id = ? AND customer_id = ? AND status <> 'cancelled'
       ORDER BY date DESC, id DESC LIMIT 1`,
      [tenantId, customerPhone]
    );
    if (!order) return { order: null, items: [] };

    // Combo components are re-chosen through the combo builder, so they are left out.
    const [items] = await conn.query(
      `SELECT oi.item_id, oi.variant_id, oi.quantity, oi.notes, oi.addons, oi.price, oi.custom_title, oi.is_combo_parent,
              COALESCE(oi.custom_title, mi.title) AS title
       FROM order_items oi
       LEFT JOIN menu_items mi ON mi.id = oi.item_id AND mi.tenant_id = oi.tenant_id
       WHERE oi.order_id = ? AND oi.tenant_id = ? AND oi.status <> 'cancelled' AND oi.combo_parent_id IS NULL
       ORDER BY oi.id`,
      [order.id, tenantId]
    );
    return {
      order,
      items: items.map((it) => {
        let addons = [];
        try {
          addons = it.addons ? JSON.parse(it.addons) : [];
        } catch {
          addons = [];
        }
        return { ...it, addons: Array.isArray(addons) ? addons.map((a) => (typeof a === "object" && a ? a.id : a)) : [] };
      }),
    };
  } finally {
    conn.release();
  }
};
