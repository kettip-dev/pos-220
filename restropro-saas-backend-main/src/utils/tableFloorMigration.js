exports.ensureTableFloorSchema = async (pool) => {
  try {
    const conn = await pool.getConnection();
    try {
      // Check if pos_x exists in store_tables
      const [columns] = await conn.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'store_tables' 
          AND COLUMN_NAME = 'pos_x'
      `);
      if (columns.length === 0) {
        await conn.query(`
          ALTER TABLE store_tables 
            ADD COLUMN pos_x INT DEFAULT NULL,
            ADD COLUMN pos_y INT DEFAULT NULL,
            ADD COLUMN shape VARCHAR(20) DEFAULT 'round',
            ADD COLUMN rotation INT DEFAULT 0
        `);
        console.log("Migration: Added pos_x, pos_y, shape, rotation to store_tables");
      }

      // Ensure store_floor_layouts exists
      await conn.query(`
        CREATE TABLE IF NOT EXISTS store_floor_layouts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          floor VARCHAR(50) NOT NULL,
          show_cashier TINYINT(1) DEFAULT 1,
          cashier_x INT DEFAULT 80,
          cashier_y INT DEFAULT 300,
          cashier_w INT DEFAULT 90,
          cashier_h INT DEFAULT 200,
          floor_plan_image VARCHAR(500) DEFAULT NULL,
          floor_plan_opacity FLOAT DEFAULT 0.8,
          floor_plan_fit VARCHAR(20) DEFAULT 'contain',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY tenant_floor_idx (tenant_id, floor),
          INDEX idx_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Check if columns exist in store_floor_layouts
      const [layoutCols] = await conn.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'store_floor_layouts'
      `);
      const existingCols = layoutCols.map((c) => c.COLUMN_NAME);

      if (!existingCols.includes("floor_plan_image")) {
        await conn.query(`
          ALTER TABLE store_floor_layouts 
            ADD COLUMN floor_plan_image VARCHAR(500) DEFAULT NULL,
            ADD COLUMN floor_plan_opacity FLOAT DEFAULT 0.8,
            ADD COLUMN floor_plan_fit VARCHAR(20) DEFAULT 'contain'
        `);
        console.log("Migration: Added floor_plan_image, floor_plan_opacity, floor_plan_fit to store_floor_layouts");
      }

      if (!existingCols.includes("walls")) {
        await conn.query(`
          ALTER TABLE store_floor_layouts 
            ADD COLUMN walls JSON DEFAULT NULL
        `);
        console.log("Migration: Added walls to store_floor_layouts");
      }

      if (!existingCols.includes("cashier_rotation")) {
        await conn.query(`
          ALTER TABLE store_floor_layouts 
            ADD COLUMN cashier_rotation INT DEFAULT 0
        `);
        console.log("Migration: Added cashier_rotation to store_floor_layouts");
      }
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("Migration ensureTableFloorSchema error:", err.message);
  }
};
