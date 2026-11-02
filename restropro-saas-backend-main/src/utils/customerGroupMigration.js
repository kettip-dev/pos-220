/**
 * Migration: Ensures customer_groups table exists and adds customer_group_id and tracking columns
 * to customers, promotions, orders, and invoices.
 * Idempotent: safe to run on startup.
 */
exports.ensureCustomerGroupSchema = async (pool) => {
  try {
    const conn = await pool.getConnection();
    try {
      // 1. Create customer_groups table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS customer_groups (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          name VARCHAR(100) NOT NULL,
          code VARCHAR(50) NULL,
          color VARCHAR(30) NOT NULL DEFAULT '#6366f1',
          description TEXT NULL,
          is_default TINYINT(1) NOT NULL DEFAULT 0,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          discount_type ENUM('PERCENTAGE', 'FIXED') NOT NULL DEFAULT 'PERCENTAGE',
          discount_value DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          apply_to ENUM('ALL', 'CATEGORY') NOT NULL DEFAULT 'ALL',
          target_category_ids JSON NULL,
          min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          max_discount_cap DECIMAL(10,2) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_customer_groups_tenant (tenant_id),
          INDEX idx_customer_groups_active (tenant_id, is_active)
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

      // 2. Add customer_group_id to customers table
      if (!(await hasColumn("customers", "customer_group_id"))) {
        await conn.query(`
          ALTER TABLE customers 
          ADD COLUMN customer_group_id INT NULL AFTER is_member
        `);
        console.log("[Migration] Added customer_group_id to customers");
      }

      // 3. Add applicable_customer_group_ids to promotions table
      if (!(await hasColumn("promotions", "applicable_customer_group_ids"))) {
        await conn.query(`
          ALTER TABLE promotions 
          ADD COLUMN applicable_customer_group_ids JSON NULL AFTER dining_options
        `);
        console.log("[Migration] Added applicable_customer_group_ids to promotions");
      }

      // 4. Add tracking columns to orders table
      if (!(await hasColumn("orders", "customer_group_id"))) {
        await conn.query(`
          ALTER TABLE orders 
          ADD COLUMN customer_group_id INT NULL AFTER customer_id
        `);
        console.log("[Migration] Added customer_group_id to orders");
      }
      if (!(await hasColumn("orders", "customer_group_name"))) {
        await conn.query(`
          ALTER TABLE orders 
          ADD COLUMN customer_group_name VARCHAR(100) NULL AFTER customer_group_id
        `);
        console.log("[Migration] Added customer_group_name to orders");
      }
      if (!(await hasColumn("orders", "customer_group_discount_total"))) {
        await conn.query(`
          ALTER TABLE orders 
          ADD COLUMN customer_group_discount_total DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER promotion_discount_total
        `);
        console.log("[Migration] Added customer_group_discount_total to orders");
      }

      // 5. Add tracking columns to invoices table
      if (!(await hasColumn("invoices", "customer_phone"))) {
        await conn.query(`
          ALTER TABLE invoices 
          ADD COLUMN customer_phone VARCHAR(50) NULL AFTER total
        `);
        console.log("[Migration] Added customer_phone to invoices");
      }
      if (!(await hasColumn("invoices", "customer_group_id"))) {
        await conn.query(`
          ALTER TABLE invoices 
          ADD COLUMN customer_group_id INT NULL AFTER customer_phone
        `);
        console.log("[Migration] Added customer_group_id to invoices");
      }
      if (!(await hasColumn("invoices", "customer_group_name"))) {
        await conn.query(`
          ALTER TABLE invoices 
          ADD COLUMN customer_group_name VARCHAR(100) NULL AFTER customer_group_id
        `);
        console.log("[Migration] Added customer_group_name to invoices");
      }
      if (!(await hasColumn("invoices", "customer_group_discount_total"))) {
        await conn.query(`
          ALTER TABLE invoices 
          ADD COLUMN customer_group_discount_total DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER promotion_discount_total
        `);
        console.log("[Migration] Added customer_group_discount_total to invoices");
      }

      console.log("[Migration] Customer groups schema ensured successfully.");
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("[Migration] Error in ensureCustomerGroupSchema:", err);
  }
};
