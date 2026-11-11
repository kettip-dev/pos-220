/**
 * Migration: KDS cooking time + kitchen delays.
 *
 *  - categories.prep_minutes            default cooking time for every item in the category
 *                                       (menu_items.prep_minutes overrides it)
 *  - order_items.delay_minutes / delay_reason
 *                                       extra time the kitchen added to a line, and why
 *  - kitchen_delay_reasons              per-tenant editable list of delay reasons
 *  - kitchen_delay_log                  every delay the kitchen logged, for reporting
 *
 * Idempotent: every column/table is checked against INFORMATION_SCHEMA first.
 */
const { addColumnIfMissing } = require("./posFeaturesMigration");

exports.ensureKitchenTimingSchema = async (pool) => {
  const conn = await pool.getConnection();
  try {
    await addColumnIfMissing(conn, "categories", "prep_minutes", "SMALLINT NULL DEFAULT NULL");
    await addColumnIfMissing(conn, "order_items", "delay_minutes", "SMALLINT NOT NULL DEFAULT 0");
    await addColumnIfMissing(conn, "order_items", "delay_reason", "VARCHAR(80) NULL DEFAULT NULL");

    await conn.query(`
      CREATE TABLE IF NOT EXISTS kitchen_delay_reasons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        code VARCHAR(32) NULL DEFAULT NULL,
        label VARCHAR(80) NOT NULL,
        icon VARCHAR(16) NULL DEFAULT NULL,
        default_minutes SMALLINT NOT NULL DEFAULT 5,
        sort_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_kdr_tenant (tenant_id, is_active, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS kitchen_delay_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        order_id INT NOT NULL,
        order_item_ids VARCHAR(1000) NOT NULL,
        reason_code VARCHAR(32) NULL DEFAULT NULL,
        reason_label VARCHAR(80) NULL DEFAULT NULL,
        minutes SMALLINT NOT NULL,
        created_by VARCHAR(100) NULL DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_kdl_tenant_date (tenant_id, created_at),
        INDEX idx_kdl_order (tenant_id, order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } finally {
    conn.release();
  }
};
