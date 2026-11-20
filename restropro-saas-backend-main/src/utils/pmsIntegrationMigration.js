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
          pms_base_url VARCHAR(255) NOT NULL DEFAULT 'http://host.docker.internal:8000',
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
        // Room service delivery details (kitchen ticket + runner)
        { name: "room_service_note", spec: "VARCHAR(255) NULL" },
        { name: "guest_count", spec: "SMALLINT NULL" },
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

      // 4. Room-charge payment types are flagged, not found by title (titles get renamed/translated).
      const [roomFlag] = await conn.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'payment_types'
          AND COLUMN_NAME = 'is_room_charge'
      `);
      if (roomFlag.length === 0) {
        await conn.query(`ALTER TABLE payment_types ADD COLUMN is_room_charge TINYINT(1) NOT NULL DEFAULT 0`);
        await conn.query(`UPDATE payment_types SET is_room_charge = 1 WHERE title = 'Charge to Room'`);
        console.log("[Migration] Added payment_types.is_room_charge");
      }

      // 5. Orders were marked PENDING as soon as they were linked to a room, even when
      //    nothing was ever queued. Only a queued charge is pending.
      await conn.query(`
        UPDATE orders o
        SET o.pms_sync_status = 'NONE'
        WHERE o.pms_sync_status = 'PENDING'
          AND o.pms_charge_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM pms_sync_queue q
            WHERE q.order_id = o.id AND q.tenant_id = o.tenant_id AND q.status IN ('PENDING', 'PROCESSING')
          )
      `);

      console.log("[Migration] pms_settings, pms_sync_queue, and orders PMS columns verified/created.");
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("[Migration] ensurePmsIntegrationSchema error:", err.message);
  }
};
