/**
 * Migration: Ensures tables and columns for Advanced Bill Splitting & Multi-Payer Settlement exist.
 * Idempotent: safe to run on startup.
 */
exports.ensureSplitBillSchema = async (pool) => {
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

      // 1. Extend orders table with split tracking columns if missing
      if (!(await hasColumn("orders", "split_status"))) {
        await conn.query(`
          ALTER TABLE orders 
            ADD COLUMN split_status ENUM('none', 'split_in_progress', 'split_settled') NOT NULL DEFAULT 'none'
        `);
        console.log("[Migration] Added split_status to orders");
      }

      if (!(await hasColumn("orders", "tip_total"))) {
        await conn.query(`
          ALTER TABLE orders 
            ADD COLUMN tip_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00
        `);
        console.log("[Migration] Added tip_total to orders");
      }

      // 2. Create order_sub_invoices table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS order_sub_invoices (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          order_id INT NOT NULL,
          sub_invoice_number VARCHAR(64) NOT NULL,
          seat_label VARCHAR(64) NOT NULL DEFAULT 'Guest 1',
          subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
          tax_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
          service_charge_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
          discount_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
          tip_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
          payable_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
          payment_type_id VARCHAR(50) DEFAULT NULL,
          payment_type_title VARCHAR(100) DEFAULT NULL,
          payment_status ENUM('pending', 'paid', 'refunded') NOT NULL DEFAULT 'pending',
          server_username VARCHAR(100) DEFAULT NULL,
          notes TEXT NULL,
          paid_at DATETIME DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_subinv_order (tenant_id, order_id),
          INDEX idx_subinv_status (tenant_id, payment_status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 3. Create order_sub_invoice_items table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS order_sub_invoice_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          order_sub_invoice_id INT NOT NULL,
          order_item_id INT NULL,
          item_title VARCHAR(255) NULL,
          variant_title VARCHAR(255) NULL,
          quantity DECIMAL(8, 2) NOT NULL DEFAULT 1.00,
          price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_subitem_subinv (tenant_id, order_sub_invoice_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      console.log("[Migration] Bill Splitting schema verified successfully");
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("[Migration] Error in ensureSplitBillSchema:", error);
  }
};
