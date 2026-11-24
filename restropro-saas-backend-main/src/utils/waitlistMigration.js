/**
 * Migration: walk-in waitlist and per-tenant SMS (PlasGate) settings.
 * Idempotent: CREATE TABLE IF NOT EXISTS only, safe on every startup.
 */
exports.ensureWaitlistSchema = async (pool) => {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS waitlist_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        guest_name VARCHAR(120) NOT NULL,
        phone VARCHAR(30) NULL,
        party_size INT NOT NULL DEFAULT 2,
        notes VARCHAR(255) NULL,
        quoted_wait_minutes INT NULL,
        status ENUM('waiting','notified','seated','cancelled','no_show') NOT NULL DEFAULT 'waiting',
        table_id INT NULL,
        public_code VARCHAR(24) NOT NULL,
        notify_count INT NOT NULL DEFAULT 0,
        notified_at DATETIME NULL,
        sms_status ENUM('none','sent','failed','skipped') NOT NULL DEFAULT 'none',
        sms_error VARCHAR(255) NULL,
        seated_at DATETIME NULL,
        closed_at DATETIME NULL,
        created_by VARCHAR(100) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_waitlist_public_code (public_code),
        INDEX idx_waitlist_tenant_status (tenant_id, status, created_at),
        CONSTRAINT fk_waitlist_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS sms_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL UNIQUE,
        provider VARCHAR(30) NOT NULL DEFAULT 'plasgate',
        is_enabled TINYINT(1) NOT NULL DEFAULT 0,
        private_key_enc TEXT NULL,
        secret_enc TEXT NULL,
        sender VARCHAR(30) NULL,
        send_on_join TINYINT(1) NOT NULL DEFAULT 0,
        join_template VARCHAR(480) NULL,
        ready_template VARCHAR(480) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_sms_settings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("[Migration] waitlist_entries and sms_settings tables verified/created.");
  } finally {
    conn.release();
  }
};
