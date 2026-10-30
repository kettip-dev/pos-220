/**
 * Ensures POS billing mode column exists in store_details table.
 * Values: 'flexible' | 'prepaid' | 'postpaid'
 * Idempotent: safe to run on every startup.
 */
exports.ensureBillingModeSchema = async (pool) => {
  try {
    const conn = await pool.getConnection();
    try {
      const [columns] = await conn.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'store_details'
          AND COLUMN_NAME = 'pos_payment_mode'
      `);

      if (columns.length === 0) {
        await conn.query(`
          ALTER TABLE store_details 
            ADD COLUMN pos_payment_mode VARCHAR(20) NOT NULL DEFAULT 'flexible'
        `);
        console.log("[Migration] Added pos_payment_mode to store_details");
      }
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("[Migration] ensureBillingModeSchema error:", err.message);
  }
};
