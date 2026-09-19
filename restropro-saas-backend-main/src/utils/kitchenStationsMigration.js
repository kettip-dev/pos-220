/**
 * Migration: Ensures kitchen_stations table and foreign station columns exist.
 * Idempotent: safe to run on every startup.
 */
exports.ensureKitchenStationsSchema = async (pool) => {
  try {
    const conn = await pool.getConnection();
    try {
      // 1. Create kitchen_stations table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS kitchen_stations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          name VARCHAR(100) NOT NULL,
          color VARCHAR(30) DEFAULT '#f97316',
          icon VARCHAR(50) DEFAULT 'Flame',
          printer_id INT NULL,
          is_enabled TINYINT(1) DEFAULT 1,
          sort_order INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_ks_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Helper to check if a column exists in a table
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

      // 2. Add kitchen_station_id to categories
      if (!(await hasColumn("categories", "kitchen_station_id"))) {
        await conn.query(`
          ALTER TABLE categories 
          ADD COLUMN kitchen_station_id INT NULL
        `);
        console.log("[Migration] Added kitchen_station_id to categories");
      }

      // 3. Add kitchen_station_id to menu_items
      if (!(await hasColumn("menu_items", "kitchen_station_id"))) {
        await conn.query(`
          ALTER TABLE menu_items 
          ADD COLUMN kitchen_station_id INT NULL
        `);
        console.log("[Migration] Added kitchen_station_id to menu_items");
      }

      // 4. Add kitchen_station_id to order_items
      if (!(await hasColumn("order_items", "kitchen_station_id"))) {
        await conn.query(`
          ALTER TABLE order_items 
          ADD COLUMN kitchen_station_id INT NULL
        `);
        console.log("[Migration] Added kitchen_station_id to order_items");
      }

      // 5. Add station_id to printer_configs
      if (!(await hasColumn("printer_configs", "station_id"))) {
        await conn.query(`
          ALTER TABLE printer_configs 
          ADD COLUMN station_id INT NULL
        `);
        console.log("[Migration] Added station_id to printer_configs");
      }

      console.log("[Migration] Kitchen stations schema verified successfully.");
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("[Migration] ensureKitchenStationsSchema error:", err.message);
  }
};
