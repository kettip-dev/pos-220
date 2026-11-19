/**
 * Migration: per-cashier POS favourites.
 *
 *  - pos_favorites: the menu items each user pins to their "Favorites" tab on the
 *    POS, in their chosen order. Keyed by (tenant_id, username, menu_item_id).
 *
 * Idempotent: CREATE TABLE IF NOT EXISTS, safe to run on every container start.
 */
exports.ensurePosFavoritesSchema = async (pool) => {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS pos_favorites (
        tenant_id INT NOT NULL,
        username VARCHAR(100) NOT NULL,
        menu_item_id INT NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (tenant_id, username, menu_item_id),
        KEY idx_pos_favorites_user (tenant_id, username, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } finally {
    conn.release();
  }
};
