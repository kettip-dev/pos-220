/**
 * Ensures the print agent + print job queue schema exists.
 * Idempotent: safe to run on every startup.
 */
exports.ensurePrintAgentsSchema = async (pool) => {
  try {
    const conn = await pool.getConnection();
    try {
      const hasColumn = async (table, column) => {
        const [rows] = await conn.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column]
        );
        return rows.length > 0;
      };

      await conn.query(`
        CREATE TABLE IF NOT EXISTS print_agents (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          name VARCHAR(100) NOT NULL,
          token_hash CHAR(64) NOT NULL,
          token_hint VARCHAR(12) NOT NULL COMMENT 'Last characters of the token, for display only',
          hostname VARCHAR(100) NULL,
          agent_version VARCHAR(30) NULL,
          last_seen_at DATETIME NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_print_agents_token (token_hash),
          INDEX idx_print_agents_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await conn.query(`
        CREATE TABLE IF NOT EXISTS print_jobs (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          printer_id INT NOT NULL,
          agent_id INT NULL,
          job_type VARCHAR(20) NOT NULL DEFAULT 'raw',
          reference VARCHAR(100) NULL COMMENT 'Human-readable label, e.g. station name or order token',
          idempotency_key VARCHAR(120) NULL,
          payload MEDIUMTEXT NULL COMMENT 'Base64 ESC/POS bytes; cleared after retention window',
          status ENUM('queued','sending','printed','failed') NOT NULL DEFAULT 'queued',
          attempts INT NOT NULL DEFAULT 0,
          last_error VARCHAR(500) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          printed_at DATETIME NULL,
          UNIQUE KEY uq_print_jobs_idem (tenant_id, idempotency_key),
          INDEX idx_print_jobs_tenant_status (tenant_id, status, created_at),
          INDEX idx_print_jobs_agent_status (agent_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      if (!(await hasColumn("printer_configs", "agent_id"))) {
        await conn.query(`
          ALTER TABLE printer_configs
            ADD COLUMN agent_id INT NULL DEFAULT NULL COMMENT 'Print agent that relays jobs to this printer'
        `);
        console.log("[Migration] Added agent_id to printer_configs");
      }
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("[Migration] ensurePrintAgentsSchema error:", err.message);
  }
};
