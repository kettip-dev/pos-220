/**
 * Menu item availability ("86 board").
 *
 *  - is_sold_out = 1        → item is shown greyed out and cannot be ordered.
 *  - stock_limit = N        → only N portions left; each order decrements it and
 *                             the item flips to sold out automatically at 0.
 *  - sold_out_auto_reset=1  → the flag is cleared at the next business day
 *                             (business-day close, or the first POS load of a
 *                             new calendar day for tenants without day close).
 */
const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { invalidateTenantCatalog } = require("../utils/cache.util");

function availabilityError(message, items) {
  const err = new Error(message);
  err.statusCode = 409;
  err.code = "ITEM_SOLD_OUT";
  err.soldOutItems = items;
  return err;
}

/** Sum ordered quantity per menu item id. */
function quantitiesByItem(cartItems = []) {
  const map = new Map();
  for (const line of cartItems) {
    const id = Number(line?.id ?? line?.item_id);
    if (!id) continue;
    const qty = Math.max(0, Number(line?.quantity) || 0);
    map.set(id, (map.get(id) || 0) + qty);
  }
  return map;
}

/**
 * Validate that every item in the cart can still be sold. Read-only.
 * Use `lock = true` inside a transaction that will later decrement stock.
 */
async function checkAvailabilityTx(conn, tenantId, cartItems, { lock = false } = {}) {
  const qtyMap = quantitiesByItem(cartItems);
  if (qtyMap.size === 0) return [];

  const [rows] = await conn.query(
    `SELECT id, title, is_sold_out, stock_limit FROM menu_items
     WHERE tenant_id = ? AND id IN (?) ${lock ? "FOR UPDATE" : ""}`,
    [tenantId, [...qtyMap.keys()]]
  );

  const blocked = [];
  for (const row of rows) {
    const wanted = qtyMap.get(Number(row.id)) || 0;
    if (Number(row.is_sold_out) === 1) {
      blocked.push({ id: row.id, title: row.title, remaining: 0, requested: wanted });
    } else if (row.stock_limit !== null && row.stock_limit !== undefined && Number(row.stock_limit) < wanted) {
      blocked.push({ id: row.id, title: row.title, remaining: Number(row.stock_limit), requested: wanted });
    }
  }

  if (blocked.length > 0) {
    const names = blocked
      .map((b) => (b.remaining > 0 ? `${b.title} (only ${b.remaining} left)` : `${b.title} (sold out)`))
      .join(", ");
    throw availabilityError(`Unavailable: ${names}`, blocked);
  }
  return rows;
}
exports.checkAvailabilityTx = checkAvailabilityTx;

/**
 * Validate and decrement portion counts inside the order transaction.
 * Returns the items whose availability changed so the caller can broadcast.
 */
exports.consumeMenuItemStockTx = async (conn, tenantId, cartItems) => {
  const rows = await checkAvailabilityTx(conn, tenantId, cartItems, { lock: true });
  const qtyMap = quantitiesByItem(cartItems);
  const changed = [];

  for (const row of rows) {
    if (row.stock_limit === null || row.stock_limit === undefined) continue;
    const next = Math.max(0, Number(row.stock_limit) - (qtyMap.get(Number(row.id)) || 0));
    const soldOut = next === 0 ? 1 : 0;
    await conn.query(
      `UPDATE menu_items
       SET stock_limit = ?, is_sold_out = ?, sold_out_at = IF(? = 1, NOW(), sold_out_at)
       WHERE id = ? AND tenant_id = ?`,
      [next, soldOut, soldOut, row.id, tenantId]
    );
    changed.push({ id: Number(row.id), is_sold_out: soldOut, stock_limit: next });
  }

  return changed;
};

exports.setMenuItemAvailabilityDB = async (tenantId, itemId, { isSoldOut, stockLimit, autoReset } = {}) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [[current]] = await conn.query(
      `SELECT id, is_sold_out, stock_limit, sold_out_auto_reset FROM menu_items WHERE id = ? AND tenant_id = ?`,
      [itemId, tenantId]
    );
    if (!current) {
      const err = new Error("Menu item not found");
      err.statusCode = 404;
      throw err;
    }

    let nextLimit = current.stock_limit;
    if (stockLimit !== undefined) {
      nextLimit = stockLimit === null || stockLimit === "" ? null : Math.max(0, parseInt(stockLimit, 10) || 0);
    }

    let nextSoldOut = isSoldOut === undefined ? Number(current.is_sold_out) : (isSoldOut ? 1 : 0);
    // A count of zero means sold out; restocking a sold-out item brings it back.
    if (stockLimit !== undefined && nextLimit === 0) nextSoldOut = 1;
    if (stockLimit !== undefined && nextLimit > 0 && isSoldOut === undefined) nextSoldOut = 0;

    const nextAutoReset = autoReset === undefined ? Number(current.sold_out_auto_reset) : (autoReset ? 1 : 0);

    await conn.query(
      `UPDATE menu_items
       SET sold_out_at = IF(? = 1, COALESCE(IF(is_sold_out = 1, sold_out_at, NULL), NOW()), NULL),
           is_sold_out = ?, stock_limit = ?, sold_out_auto_reset = ?
       WHERE id = ? AND tenant_id = ?`,
      [nextSoldOut, nextSoldOut, nextLimit, nextAutoReset, itemId, tenantId]
    );

    await invalidateTenantCatalog(tenantId);
    return { id: Number(itemId), is_sold_out: nextSoldOut, stock_limit: nextLimit, sold_out_auto_reset: nextAutoReset };
  } finally {
    conn.release();
  }
};

/**
 * Clear sold-out flags.
 *  - scope "stale": only auto-reset items marked sold out before today.
 *  - scope "auto":  every auto-reset item (business-day close).
 *  - scope "all":   every item, and remove portion caps.
 * Returns the number of items changed.
 */
exports.resetSoldOutDB = async (tenantId, scope = "stale", existingConn = null) => {
  const conn = existingConn || (await getMySqlPromiseConnection());
  try {
    let sql;
    if (scope === "all") {
      sql = `UPDATE menu_items SET is_sold_out = 0, stock_limit = NULL, sold_out_at = NULL
             WHERE tenant_id = ? AND (is_sold_out = 1 OR stock_limit IS NOT NULL)`;
    } else if (scope === "auto") {
      sql = `UPDATE menu_items SET is_sold_out = 0, stock_limit = NULL, sold_out_at = NULL
             WHERE tenant_id = ? AND sold_out_auto_reset = 1 AND (is_sold_out = 1 OR stock_limit IS NOT NULL)`;
    } else {
      sql = `UPDATE menu_items SET is_sold_out = 0, stock_limit = NULL, sold_out_at = NULL
             WHERE tenant_id = ? AND sold_out_auto_reset = 1 AND is_sold_out = 1
               AND sold_out_at IS NOT NULL AND DATE(sold_out_at) < CURDATE()`;
    }
    const [result] = await conn.query(sql, [tenantId]);
    if (result.affectedRows > 0) await invalidateTenantCatalog(tenantId);
    return result.affectedRows;
  } finally {
    if (!existingConn) conn.release();
  }
};
