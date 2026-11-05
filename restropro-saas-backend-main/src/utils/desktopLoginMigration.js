/**
 * One-time codes for "Sign in with your browser" in the Bong POS desktop app.
 * Idempotent: safe to run on every startup.
 */
exports.ensureDesktopLoginSchema = async (pool) => {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS desktop_login_codes (
        code_hash CHAR(64) NOT NULL PRIMARY KEY COMMENT 'SHA-256 of the one-time code; the code itself is never stored',
        tenant_id INT NULL,
        username VARCHAR(95) NOT NULL,
        code_challenge CHAR(43) NOT NULL COMMENT 'PKCE S256 challenge from the desktop app',
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_desktop_login_codes_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } finally {
    conn.release();
  }
};
