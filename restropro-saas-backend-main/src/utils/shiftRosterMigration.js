/**
 * Migration: Ensures tables and columns for Staff Shifts, Rosters, Shift Settings, and Attendance exist.
 * Idempotent: safe to run on startup.
 */
exports.ensureShiftRosterSchema = async (pool) => {
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

      // 1. Create shifts table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS shifts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          name VARCHAR(100) NOT NULL,
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          is_overnight TINYINT(1) NOT NULL DEFAULT 0,
          color VARCHAR(30) NOT NULL DEFAULT '#3B82F6',
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_shifts_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 2. Create staff_rosters table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS staff_rosters (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          username VARCHAR(100) NOT NULL,
          shift_id INT NOT NULL,
          roster_date DATE NOT NULL,
          notes VARCHAR(255) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_roster_tenant_date (tenant_id, roster_date),
          INDEX idx_roster_user_date (tenant_id, username, roster_date),
          UNIQUE KEY unique_user_shift_date (tenant_id, username, shift_id, roster_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 3. Create staff_attendance table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS staff_attendance (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          username VARCHAR(100) NOT NULL,
          roster_id INT NULL,
          shift_id INT NULL,
          clock_in_at DATETIME NOT NULL,
          clock_out_at DATETIME NULL,
          manager_override_by VARCHAR(100) NULL,
          status ENUM('on_time', 'late', 'early', 'override', 'auto') NOT NULL DEFAULT 'on_time',
          notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_attendance_tenant_user (tenant_id, username),
          INDEX idx_attendance_clock_in (tenant_id, clock_in_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 4. Create shift_settings table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS shift_settings (
          tenant_id INT PRIMARY KEY,
          shift_grace_before_mins INT NOT NULL DEFAULT 15,
          shift_grace_after_mins INT NOT NULL DEFAULT 30,
          is_shift_enforcement_enabled TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 5. Extend users table with quick_pin and enforce_shift_roster
      if (!(await hasColumn("users", "quick_pin"))) {
        await conn.query(`
          ALTER TABLE users 
            ADD COLUMN quick_pin VARCHAR(255) NULL
        `);
        console.log("[Migration] Added quick_pin to users");
      }

      if (!(await hasColumn("users", "enforce_shift_roster"))) {
        await conn.query(`
          ALTER TABLE users 
            ADD COLUMN enforce_shift_roster TINYINT(1) NOT NULL DEFAULT 1
        `);
        console.log("[Migration] Added enforce_shift_roster to users");
      }

      console.log("[Migration] Shift & Roster schema verified successfully.");
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("[Migration] Error ensuring shift & roster schema:", error);
  }
};
