/**
 * Migration: Ensures promotions table exists and orders/invoices have applied_promotions tracking.
 * Idempotent: safe to run on startup.
 */
exports.ensurePromotionSchema = async (pool) => {
  try {
    const conn = await pool.getConnection();
    try {
      // 1. Create promotions table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS promotions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT NULL,
          promo_code VARCHAR(50) NULL,
          promo_type ENUM(
            'ORDER_PERCENTAGE',
            'ORDER_FIXED',
            'ITEM_PERCENTAGE',
            'ITEM_FIXED',
            'BOGO'
          ) NOT NULL DEFAULT 'ORDER_PERCENTAGE',
          discount_value DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          max_discount_cap DECIMAL(10,2) NULL,
          min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          apply_to ENUM('ALL', 'CATEGORY', 'ITEMS') NOT NULL DEFAULT 'ALL',
          target_category_ids JSON NULL,
          target_item_ids JSON NULL,
          buy_qty INT NULL DEFAULT 1,
          get_qty INT NULL DEFAULT 1,
          get_discount_percent DECIMAL(5,2) NULL DEFAULT 100.00,
          is_automatic TINYINT(1) NOT NULL DEFAULT 1,
          is_stackable TINYINT(1) NOT NULL DEFAULT 0,
          dining_options JSON NULL,
          start_date DATE NULL,
          end_date DATE NULL,
          start_time TIME NULL,
          end_time TIME NULL,
          days_of_week JSON NULL,
          usage_limit_total INT NULL,
          times_redeemed INT NOT NULL DEFAULT 0,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_promotions_tenant (tenant_id),
          INDEX idx_promotions_tenant_active (tenant_id, is_active),
          INDEX idx_promotions_tenant_code (tenant_id, promo_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Column check helper
      const hasColumn = async (tableName, columnName) => {
        const [rows] = await conn.query(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = ? 
            AND COLUMN_NAME = ?
        `, [tableName, columnName]);
        return rows.length > 0;
      };

      // 2. Add columns to orders
      if (!(await hasColumn("orders", "applied_promotions"))) {
        await conn.query(`
          ALTER TABLE orders 
          ADD COLUMN applied_promotions JSON NULL AFTER invoice_id
        `);
        console.log("[Migration] Added applied_promotions to orders");
      }
      if (!(await hasColumn("orders", "promotion_discount_total"))) {
        await conn.query(`
          ALTER TABLE orders 
          ADD COLUMN promotion_discount_total DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER applied_promotions
        `);
        console.log("[Migration] Added promotion_discount_total to orders");
      }

      // 3. Add columns to invoices
      if (!(await hasColumn("invoices", "applied_promotions"))) {
        await conn.query(`
          ALTER TABLE invoices 
          ADD COLUMN applied_promotions JSON NULL AFTER discount_total
        `);
        console.log("[Migration] Added applied_promotions to invoices");
      }
      if (!(await hasColumn("invoices", "promotion_discount_total"))) {
        await conn.query(`
          ALTER TABLE invoices 
          ADD COLUMN promotion_discount_total DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER applied_promotions
        `);
        console.log("[Migration] Added promotion_discount_total to invoices");
      }

      console.log("[Migration] Promotion schema ensured successfully.");
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("[Migration] Error in ensurePromotionSchema:", err);
  }
};
