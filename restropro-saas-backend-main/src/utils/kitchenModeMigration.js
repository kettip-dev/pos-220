/**
 * Ensures is_kitchen_enabled column exists in store_details table.
 * Default: 1 (Enabled / Full Restaurant Kitchen & KDS workflow)
 * 0 = Kitchen-less / Counter Retail mode (no kitchen prep stage)
 * Idempotent: safe to run on every startup.
 */
exports.ensureKitchenModeSchema = async (pool) => {
  try {
    const conn = await pool.getConnection();
    try {
      const [columns] = await conn.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'store_details'
          AND COLUMN_NAME = 'is_kitchen_enabled'
      `);

      if (columns.length === 0) {
        await conn.query(`
          ALTER TABLE store_details 
            ADD COLUMN is_kitchen_enabled TINYINT(1) NOT NULL DEFAULT 1
        `);
        console.log("[Migration] Added is_kitchen_enabled to store_details");
      }
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("[Migration] ensureKitchenModeSchema error:", err.message);
  }
};
