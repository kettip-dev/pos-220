/**
 * Migration: Customer 360 profile fields.
 *
 *  - customers.notes     free-text staff notes ("prefers window seat")
 *  - customers.allergies short allergy / dietary warning shown in red everywhere
 *  - customers.tags      JSON array of short labels ("VIP", "Regular", "Corporate")
 *
 * Idempotent: safe to run on every startup.
 */
exports.ensureCustomer360Schema = async (pool) => {
  const conn = await pool.getConnection();
  try {
    const columns = [
      ["notes", "TEXT NULL"],
      ["allergies", "VARCHAR(500) NULL"],
      ["tags", "JSON NULL"],
    ];
    for (const [name, definition] of columns) {
      const [rows] = await conn.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = ?`,
        [name]
      );
      if (rows.length === 0) {
        await conn.query(`ALTER TABLE customers ADD COLUMN ${name} ${definition}`);
        console.log(`[Migration] Added ${name} to customers`);
      }
    }
  } finally {
    conn.release();
  }
};
