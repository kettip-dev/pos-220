/**
 * Migration: per-addon availability.
 *
 *  - menu_item_addons.is_enabled  1 = offered on POS / QR menu, 0 = hidden (e.g. out of stock)
 *
 * Disabled addons stay in the table so order history, receipts and recipes still resolve them.
 * Idempotent: safe to run on every startup.
 */
exports.ensureAddonAvailabilitySchema = async (pool) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'menu_item_addons' AND COLUMN_NAME = 'is_enabled'`
    );
    if (rows.length === 0) {
      await conn.query(
        `ALTER TABLE menu_item_addons ADD COLUMN is_enabled TINYINT(1) NOT NULL DEFAULT 1`
      );
      console.log("[Migration] Added is_enabled to menu_item_addons");
    }
  } finally {
    conn.release();
  }
};
