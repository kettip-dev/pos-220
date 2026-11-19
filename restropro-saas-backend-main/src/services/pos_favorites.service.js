const { getMySqlPromiseConnection } = require("../config/mysql.db");

const MAX_FAVORITES = 60;

/** Menu item ids the user pinned, in their order. Skips items deleted since. */
exports.getPosFavoritesDB = async (tenantId, username) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT f.menu_item_id
         FROM pos_favorites f
         JOIN menu_items m ON m.id = f.menu_item_id AND m.tenant_id = f.tenant_id
        WHERE f.tenant_id = ? AND f.username = ?
        ORDER BY f.sort_order ASC, f.created_at ASC`,
      [tenantId, username]
    );
    return rows.map((r) => r.menu_item_id);
  } finally {
    conn.release();
  }
};

/**
 * Replace the user's favourites with `menuItemIds` (order = display order).
 * Ids that are not this tenant's menu items are dropped.
 */
exports.savePosFavoritesDB = async (tenantId, username, menuItemIds) => {
  const unique = [...new Set(
    (Array.isArray(menuItemIds) ? menuItemIds : [])
      .map((id) => parseInt(id, 10))
      .filter((id) => Number.isInteger(id) && id > 0)
  )].slice(0, MAX_FAVORITES);

  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    let valid = [];
    if (unique.length) {
      const [rows] = await conn.query(
        `SELECT id FROM menu_items WHERE tenant_id = ? AND id IN (?)`,
        [tenantId, unique]
      );
      const allowed = new Set(rows.map((r) => r.id));
      valid = unique.filter((id) => allowed.has(id));
    }

    await conn.query(
      `DELETE FROM pos_favorites WHERE tenant_id = ? AND username = ?`,
      [tenantId, username]
    );
    if (valid.length) {
      await conn.query(
        `INSERT INTO pos_favorites (tenant_id, username, menu_item_id, sort_order) VALUES ?`,
        [valid.map((id, index) => [tenantId, username, id, index])]
      );
    }

    await conn.commit();
    return valid;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};
