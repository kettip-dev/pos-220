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

    // 4. Open items (custom name + price, sold through one hidden menu row per tenant)
    await addColumnIfMissing(conn, "order_items", "custom_title", "VARCHAR(255) NULL DEFAULT NULL");
    await addColumnIfMissing(conn, "menu_items", "is_open_item", "TINYINT(1) NOT NULL DEFAULT 0");

    // 5. Combos / set meals: a combo is a menu item with choice groups
    await addColumnIfMissing(conn, "menu_items", "is_combo", "TINYINT(1) NOT NULL DEFAULT 0");
    await addColumnIfMissing(conn, "order_items", "is_combo_parent", "TINYINT(1) NOT NULL DEFAULT 0");
    await addColumnIfMissing(conn, "order_items", "combo_parent_id", "INT NULL DEFAULT NULL");
    await conn.query(`
      CREATE TABLE IF NOT EXISTS menu_combo_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        combo_item_id INT NOT NULL,
        title VARCHAR(120) NOT NULL,
        min_select INT NOT NULL DEFAULT 1,
        max_select INT NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        INDEX idx_mcg_combo (tenant_id, combo_item_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS menu_combo_options (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        group_id INT NOT NULL,
        menu_item_id INT NOT NULL,
        variant_id INT NULL,
        extra_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        INDEX idx_mco_group (tenant_id, group_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 7. Gift cards / stored-value vouchers
    await conn.query(`
      CREATE TABLE IF NOT EXISTS gift_cards (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        code VARCHAR(32) NOT NULL,
        initial_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
        balance DECIMAL(12,2) NOT NULL DEFAULT 0,
        status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
        customer_phone VARCHAR(32) NULL,
        note VARCHAR(255) NULL,
        expires_at DATE NULL,
        issued_by VARCHAR(100) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_gift_card_code (tenant_id, code),
        INDEX idx_gift_card_customer (tenant_id, customer_phone)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS gift_card_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        gift_card_id INT NOT NULL,
        type VARCHAR(12) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        balance_after DECIMAL(12,2) NOT NULL,
        invoice_id INT NULL,
        register_session_id INT NULL,
        note VARCHAR(255) NULL,
        created_by VARCHAR(100) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_gct_card (tenant_id, gift_card_id),
        INDEX idx_gct_invoice (tenant_id, invoice_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await addColumnIfMissing(conn, "payment_types", "is_gift_card", "TINYINT(1) NOT NULL DEFAULT 0");
    // Selling / reloading a card puts money in the drawer without being a sale.
    const [sourceRows] = await conn.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'register_payments' AND COLUMN_NAME = 'source'`
    );
    const sourceType = sourceRows[0]?.COLUMN_TYPE || "";
    if (sourceType.startsWith("enum(") && !sourceType.includes("'GIFT_CARD'")) {
      const values = sourceType.slice(5, -1);
      await conn.query(`ALTER TABLE register_payments MODIFY COLUMN source ENUM(${values}, 'GIFT_CARD') NOT NULL`);
      console.log("[Migration] Added GIFT_CARD to register_payments.source");
    }

    // 8. Offline POS: the terminal's own order id makes retries idempotent
    await addColumnIfMissing(conn, "orders", "client_order_id", "VARCHAR(64) NULL DEFAULT NULL");
    const [idx] = await conn.query(
      `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'uq_orders_client_order' LIMIT 1`
    );
    if (idx.length === 0) {
      await conn.query(`ALTER TABLE orders ADD UNIQUE INDEX uq_orders_client_order (tenant_id, client_order_id)`);
      console.log("[Migration] Added uq_orders_client_order");
    }

    // 9. Barcodes for scanning packaged / retail items at the POS
    await addColumnIfMissing(conn, "menu_items", "barcode", "VARCHAR(64) NULL DEFAULT NULL");
    const [bidx] = await conn.query(
      `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'menu_items' AND INDEX_NAME = 'idx_menu_items_barcode' LIMIT 1`
    );
    if (bidx.length === 0) {
      await conn.query(`ALTER TABLE menu_items ADD INDEX idx_menu_items_barcode (tenant_id, barcode)`);
    }

    // 10. KDS: target prep time per item (minutes); NULL = use the screen's thresholds
    await addColumnIfMissing(conn, "menu_items", "prep_minutes", "SMALLINT NULL DEFAULT NULL");
  } finally {
    conn.release();
  }
};
