/**
 * Migration: menu_items.dietary_tags (allergen / dietary codes, comma list).
 * Idempotent: checks INFORMATION_SCHEMA before adding.
 */
const { addColumnIfMissing } = require("./posFeaturesMigration");

exports.ensureDietaryTagsSchema = async (pool) => {
  const conn = await pool.getConnection();
  try {
    await addColumnIfMissing(conn, "menu_items", "dietary_tags", "VARCHAR(255) NULL DEFAULT NULL");
  } finally {
    conn.release();
  }
};
