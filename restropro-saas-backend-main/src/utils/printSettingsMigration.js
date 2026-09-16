/**
 * Ensures direct print settings columns exist in print_settings table.
 * Idempotent: safe to run on every startup.
 */
exports.ensurePrintSettingsSchema = async (pool) => {
  try {
    const conn = await pool.getConnection();
    try {
      const [columns] = await conn.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'print_settings'
      `);
      const existingCols = columns.map((c) => c.COLUMN_NAME);

      if (!existingCols.includes("print_mode")) {
        await conn.query(`
          ALTER TABLE print_settings 
            ADD COLUMN print_mode VARCHAR(30) NOT NULL DEFAULT 'browser',
            ADD COLUMN auto_cut TINYINT(1) NOT NULL DEFAULT 1,
            ADD COLUMN cash_drawer_kick TINYINT(1) NOT NULL DEFAULT 1
        `);
        console.log("[Migration] Added print_mode, auto_cut, cash_drawer_kick to print_settings");
      }
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("[Migration] ensurePrintSettingsSchema error:", err.message);
  }
};
