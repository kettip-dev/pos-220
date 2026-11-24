/**
 * Migration: per-tenant thresholds for the unusual staff activity alert.
 * Idempotent: CREATE TABLE IF NOT EXISTS only.
 */
exports.ensureStaffAlertsSchema = async (pool) => {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS staff_alert_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL UNIQUE,
        is_enabled TINYINT(1) NOT NULL DEFAULT 1,
        max_rate_percent DECIMAL(5,2) NOT NULL DEFAULT 5,
        min_amount DECIMAL(10,2) NOT NULL DEFAULT 10,
        peer_multiple DECIMAL(4,2) NOT NULL DEFAULT 2.5,
        max_no_sales INT NOT NULL DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_staff_alert_settings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } finally {
    conn.release();
  }
};
