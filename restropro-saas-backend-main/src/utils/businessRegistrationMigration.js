/**
 * Ensures business profile columns exist in store_details table.
 * Column: business_type VARCHAR(50) DEFAULT 'restaurant'
 * Idempotent: safe to run on every startup.
 */
exports.ensureBusinessRegistrationSchema = async (pool) => {
  try {
    const conn = await pool.getConnection();
    try {
      const [columns] = await conn.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'store_details'
          AND COLUMN_NAME = 'business_type'
      `);

      if (columns.length === 0) {
        await conn.query(`
          ALTER TABLE store_details 
            ADD COLUMN business_type VARCHAR(50) NOT NULL DEFAULT 'restaurant'
        `);
        console.log("[Migration] Added business_type to store_details");
      }
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("[Migration] ensureBusinessRegistrationSchema error:", err.message);
  }
};
