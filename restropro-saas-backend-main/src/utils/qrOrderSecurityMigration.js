/**
 * Migration: Ensures QR Order Anti-Fraud & UX columns exist:
 * - store_tables.table_pin (4-digit session PIN, auto-populated for existing rows)
 * - store_details.is_qr_order_auto_kitchen (0 = 1-tap staff approval, 1 = auto-send to kitchen KDS)
 * - qr_orders.linked_order_id (links approved/auto-routed QR orders to real kitchen orders for live guest tracking)
 * Idempotent: safe to run on every startup.
 */
exports.ensureQrOrderSecuritySchema = async (pool) => {
  try {
    const conn = await pool.getConnection();
    try {
      const hasColumn = async (tableName, columnName) => {
        const [rows] = await conn.query(
          `SELECT COLUMN_NAME 
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = ? 
             AND COLUMN_NAME = ?`,
          [tableName, columnName]
        );
        return rows.length > 0;
      };

      // 1. Add table_pin to store_tables
      if (!(await hasColumn("store_tables", "table_pin"))) {
        await conn.query(`
          ALTER TABLE store_tables 
          ADD COLUMN table_pin VARCHAR(10) NULL
        `);
        console.log("[Migration] Added table_pin to store_tables");
      }

      // Backfill any store_tables missing a 4-digit PIN
      await conn.query(`
        UPDATE store_tables 
        SET table_pin = LPAD(FLOOR(1000 + (RAND() * 9000)), 4, '0')
        WHERE table_pin IS NULL OR table_pin = ''
      `);

      // 2. Add is_qr_order_auto_kitchen to store_details
      if (!(await hasColumn("store_details", "is_qr_order_auto_kitchen"))) {
        await conn.query(`
          ALTER TABLE store_details 
          ADD COLUMN is_qr_order_auto_kitchen TINYINT(1) NOT NULL DEFAULT 0
        `);
        console.log("[Migration] Added is_qr_order_auto_kitchen to store_details");
      }

      // 3. Add linked_order_id to qr_orders
      if (!(await hasColumn("qr_orders", "linked_order_id"))) {
        await conn.query(`
          ALTER TABLE qr_orders 
          ADD COLUMN linked_order_id INT NULL
        `);
        console.log("[Migration] Added linked_order_id to qr_orders");
      }

      console.log("[Migration] QR order security schema verified successfully.");
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("[Migration] ensureQrOrderSecuritySchema error:", err.message);
  }
};
