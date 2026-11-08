/**
 * Migration: multi-language menu content.
 *  - `translations` JSON column on categories, menu_items, menu_item_variants,
 *    menu_item_addons and addon_library. Shape: { "<lang>": { "title": "...", "description": "..." } }
 *  - `menu_language_settings` table (one row per tenant) holding the enabled
 *    languages and how names are shown on screens, receipts and kitchen tickets.
 * Idempotent: safe to run on every startup.
 */

const TRANSLATABLE_TABLES = [
  "categories",
  "menu_items",
  "menu_item_variants",
  "menu_item_addons",
  "addon_library",
];

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    [table]
  );
  return rows.length > 0;
}

exports.ensureMenuLanguageSchema = async (pool) => {
  const conn = await pool.getConnection();
  try {
    for (const table of TRANSLATABLE_TABLES) {
      if (!(await tableExists(conn, table))) continue;
      if (!(await columnExists(conn, table, "translations"))) {
        await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN translations JSON NULL`);
        console.log(`[Migration] Added translations column to ${table}.`);
      }
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS menu_language_settings (
        tenant_id INT NOT NULL,
        is_enabled TINYINT(1) NOT NULL DEFAULT 0,
        primary_label VARCHAR(50) NOT NULL DEFAULT 'English',
        languages JSON NULL,
        display_mode VARCHAR(40) NOT NULL DEFAULT 'primary',
        receipt_print_mode VARCHAR(40) NOT NULL DEFAULT 'primary',
        kitchen_print_mode VARCHAR(40) NOT NULL DEFAULT 'primary',
        allow_device_override TINYINT(1) NOT NULL DEFAULT 1,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    console.log("[Migration] menu language schema verified.");
  } finally {
    conn.release();
  }
};
