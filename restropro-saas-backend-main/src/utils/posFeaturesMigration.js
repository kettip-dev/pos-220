/**
 * Migration: POS operational features.
 *
 *  - menu_items.is_sold_out / stock_limit / sold_out_at / sold_out_auto_reset
 *      "86" an item for the shift, or cap it at N portions left.
 *
 * Idempotent: every column/table is checked against INFORMATION_SCHEMA first,
 * so it is safe to run on every container start.
 */

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

async function addColumnIfMissing(conn, table, column, definition) {
  if (!(await tableExists(conn, table))) return;
  if (await columnExists(conn, table, column)) return;
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`[Migration] Added ${table}.${column}`);
}

exports.columnExists = columnExists;
exports.tableExists = tableExists;
exports.addColumnIfMissing = addColumnIfMissing;

exports.ensurePosFeaturesSchema = async (pool) => {
  const conn = await pool.getConnection();
  try {
    // 1. Sold out / 86 board
    await addColumnIfMissing(conn, "menu_items", "is_sold_out", "TINYINT(1) NOT NULL DEFAULT 0");
    await addColumnIfMissing(conn, "menu_items", "stock_limit", "INT NULL DEFAULT NULL");
    await addColumnIfMissing(conn, "menu_items", "sold_out_at", "DATETIME NULL DEFAULT NULL");
    await addColumnIfMissing(conn, "menu_items", "sold_out_auto_reset", "TINYINT(1) NOT NULL DEFAULT 1");

    // 2. Line-level comp / void / discount with reason + approval
    await addColumnIfMissing(conn, "order_items", "original_price", "DECIMAL(10,2) NULL DEFAULT NULL");
    await addColumnIfMissing(conn, "order_items", "adjust_type", "VARCHAR(16) NULL DEFAULT NULL");
    await addColumnIfMissing(conn, "order_items", "adjust_reason", "VARCHAR(40) NULL DEFAULT NULL");
    await addColumnIfMissing(conn, "order_items", "adjust_note", "VARCHAR(255) NULL DEFAULT NULL");
    await addColumnIfMissing(conn, "order_items", "adjust_discount_type", "VARCHAR(10) NULL DEFAULT NULL");
    await addColumnIfMissing(conn, "order_items", "adjust_discount_value", "DECIMAL(10,2) NULL DEFAULT NULL");
    await addColumnIfMissing(conn, "order_items", "adjusted_by", "VARCHAR(100) NULL DEFAULT NULL");
    await addColumnIfMissing(conn, "order_items", "adjust_approved_by", "VARCHAR(100) NULL DEFAULT NULL");
    await addColumnIfMissing(conn, "order_items", "adjusted_at", "DATETIME NULL DEFAULT NULL");

    await conn.query(`
      CREATE TABLE IF NOT EXISTS pos_line_adjustments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        action VARCHAR(16) NOT NULL,
        reason_code VARCHAR(40) NOT NULL,
        note VARCHAR(255) NULL,
        order_id INT NULL,
        order_item_id INT NULL,
        item_id INT NULL,
        item_title VARCHAR(255) NULL,
        quantity INT NOT NULL DEFAULT 1,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        sent_to_kitchen TINYINT(1) NOT NULL DEFAULT 0,
        performed_by VARCHAR(100) NULL,
        approved_by VARCHAR(100) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pla_tenant_date (tenant_id, created_at),
        INDEX idx_pla_order (tenant_id, order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 3. Courses (hold & fire) and seat numbers
    await addColumnIfMissing(conn, "order_items", "course", "TINYINT NULL DEFAULT NULL");
    await addColumnIfMissing(conn, "order_items", "seat_no", "TINYINT NULL DEFAULT NULL");
    await addColumnIfMissing(conn, "order_items", "fire_status", "VARCHAR(8) NOT NULL DEFAULT 'fired'");
    await addColumnIfMissing(conn, "order_items", "fired_at", "DATETIME NULL DEFAULT NULL");
  } finally {
    conn.release();
  }
};
