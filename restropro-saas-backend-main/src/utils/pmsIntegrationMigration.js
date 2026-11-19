/**
 * Migration: Ensures PMS integration schema exists.
 * Creates pms_settings table, pms_sync_queue table, and adds PMS tracking columns to orders.
 * Idempotent: safe to run on every startup.
 */
exports.ensurePmsIntegrationSchema = async (pool) => {
  try {
    const conn = await pool.getConnection();
    try {
      // 1. Create pms_settings table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS pms_settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL UNIQUE,
          is_enabled TINYINT(1) NOT NULL DEFAULT 0,
          pms_base_url VARCHAR(255) NOT NULL DEFAULT 'http://localhost:8000',
          pms_property_id VARCHAR(64) NULL,
          pms_api_key VARCHAR(255) NULL,
          auto_post_on_settle TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_pms_tenant (tenant_id),
          CONSTRAINT fk_pms_settings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id)
            ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // 2. Add columns to orders table idempotently
      const orderColumnsToAdd = [
        { name: "pms_reservation_id", spec: "VARCHAR(64) NULL" },
        { name: "pms_room_number", spec: "VARCHAR(32) NULL" },
        { name: "pms_guest_name", spec: "VARCHAR(255) NULL" },
        { name: "pms_charge_id", spec: "VARCHAR(64) NULL" },
        { name: "pms_sync_status", spec: "VARCHAR(32) NOT NULL DEFAULT 'NONE'" },
      ];

      for (const col of orderColumnsToAdd) {
        const [existing] = await conn.query(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'orders' 
            AND COLUMN_NAME = ?
        `, [col.name]);

        if (existing.length === 0) {
          await conn.query(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.spec}`);
          console.log(`[Migration] Added column orders.${col.name}`);
        }
      }

      // 3. Create pms_sync_queue table for offline resilience
      await conn.query(`
        CREATE TABLE IF NOT EXISTS pms_sync_queue (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          order_id INT NOT NULL,
          action VARCHAR(32) NOT NULL,
          payload JSON NOT NULL,
          attempts INT NOT NULL DEFAULT 0,
          status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
          last_error TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_sync_tenant_status (tenant_id, status),
          INDEX idx_sync_order (order_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      console.log("[Migration] pms_settings, pms_sync_queue, and orders PMS columns verified/created.");
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("[Migration] ensurePmsIntegrationSchema error:", err.message);
  }
};
