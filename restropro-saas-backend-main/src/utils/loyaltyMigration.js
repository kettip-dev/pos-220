/**
 * Migration: Ensures loyalty tables and customer/invoice columns exist.
 * Idempotent: safe to run on startup.
 */
exports.ensureLoyaltyProgramSchema = async (pool) => {
  try {
    const conn = await pool.getConnection();
    try {
      const hasColumn = async (tableName, columnName) => {
        const [rows] = await conn.query(
          `
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = ? 
            AND COLUMN_NAME = ?
        `,
          [tableName, columnName]
        );
        return rows.length > 0;
      };

      // 1. Extend customers table
      if (!(await hasColumn("customers", "points_balance"))) {
        await conn.query(`
          ALTER TABLE customers 
            ADD COLUMN points_balance INT NOT NULL DEFAULT 0
        `);
        console.log("[Migration] Added points_balance to customers");
      }

      if (!(await hasColumn("customers", "lifetime_points_earned"))) {
        await conn.query(`
          ALTER TABLE customers 
            ADD COLUMN lifetime_points_earned INT NOT NULL DEFAULT 0
        `);
        console.log("[Migration] Added lifetime_points_earned to customers");
      }

      if (!(await hasColumn("customers", "membership_tier"))) {
        await conn.query(`
          ALTER TABLE customers 
            ADD COLUMN membership_tier VARCHAR(50) NOT NULL DEFAULT 'Standard'
        `);
        console.log("[Migration] Added membership_tier to customers");
      }

      // 2. Create tenant_loyalty_settings table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS tenant_loyalty_settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          is_enabled TINYINT(1) NOT NULL DEFAULT 1,
          points_per_dollar_spent DECIMAL(10,2) NOT NULL DEFAULT 1.00,
          dollar_value_per_point DECIMAL(10,4) NOT NULL DEFAULT 0.0100,
          min_points_to_redeem INT NOT NULL DEFAULT 10,
          max_discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 100.00,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_tenant_loyalty (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 3. Create customer_loyalty_transactions table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS customer_loyalty_transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          customer_phone VARCHAR(50) NOT NULL,
          invoice_id INT NULL,
          order_id INT NULL,
          transaction_type ENUM('EARNED', 'REDEEMED', 'VOID_REVERSAL', 'MANUAL_ADJUSTMENT') NOT NULL,
          points INT NOT NULL,
          balance_after INT NOT NULL,
          notes VARCHAR(255) NULL,
          created_by_user_id VARCHAR(100) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_tenant_customer (tenant_id, customer_phone),
          INDEX idx_invoice (tenant_id, invoice_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 4. Extend invoices table
      if (!(await hasColumn("invoices", "loyalty_points_redeemed"))) {
        await conn.query(`
          ALTER TABLE invoices 
            ADD COLUMN loyalty_points_redeemed INT NOT NULL DEFAULT 0
        `);
        console.log("[Migration] Added loyalty_points_redeemed to invoices");
      }

      if (!(await hasColumn("invoices", "loyalty_discount_amount"))) {
        await conn.query(`
          ALTER TABLE invoices 
            ADD COLUMN loyalty_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00
        `);
        console.log("[Migration] Added loyalty_discount_amount to invoices");
      }

      if (!(await hasColumn("invoices", "loyalty_points_earned"))) {
        await conn.query(`
          ALTER TABLE invoices 
            ADD COLUMN loyalty_points_earned INT NOT NULL DEFAULT 0
        `);
        console.log("[Migration] Added loyalty_points_earned to invoices");
      }
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("[Migration] ensureLoyaltyProgramSchema error:", err.message);
  }
};
