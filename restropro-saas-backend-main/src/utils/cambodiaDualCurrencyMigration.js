/**
 * Ensures Cambodian dual-currency exchange rate column exists in store_details table.
 * Idempotent: safe to run on every startup.
 */
exports.ensureCambodiaDualCurrencySchema = async (pool) => {
  try {
    const conn = await pool.getConnection();
    try {
      const [columns] = await conn.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'store_details'
          AND COLUMN_NAME = 'exchange_rate_usd_to_khr'
      `);

      if (columns.length === 0) {
        await conn.query(`
          ALTER TABLE store_details 
            ADD COLUMN exchange_rate_usd_to_khr DECIMAL(10,2) NOT NULL DEFAULT 4100.00
        `);
        console.log("[Migration] Added exchange_rate_usd_to_khr to store_details");
      }
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("[Migration] ensureCambodiaDualCurrencySchema error:", err.message);
  }
};
