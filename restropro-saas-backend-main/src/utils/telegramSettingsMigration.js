/**
 * Migration: Ensures telegram_settings table exists.
 * Idempotent: safe to run on every startup.
 */
exports.ensureTelegramSettingsSchema = async (pool) => {
  try {
    const conn = await pool.getConnection();
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS telegram_settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL UNIQUE,
          bot_token VARCHAR(255) NULL,
          orders_chat_id VARCHAR(100) NULL,
          orders_thread_id VARCHAR(100) NULL,
          eod_chat_id VARCHAR(100) NULL,
          eod_thread_id VARCHAR(100) NULL,
          is_orders_enabled TINYINT(1) NOT NULL DEFAULT 1,
          is_eod_enabled TINYINT(1) NOT NULL DEFAULT 1,
          eod_time VARCHAR(10) NOT NULL DEFAULT '23:59',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_telegram_tenant (tenant_id),
          CONSTRAINT fk_telegram_settings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id)
            ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log("[Migration] telegram_settings table verified/created.");
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("[Migration] ensureTelegramSettingsSchema error:", err.message);
  }
};
