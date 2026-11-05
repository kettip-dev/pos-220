const crypto = require("crypto");
const { getMySqlPromiseConnection } = require("../config/mysql.db");

/**
 * Desktop app sign-in through the system browser (like VS Code):
 *   1. The app opens /desktop-login?state=…&challenge=… in the browser.
 *   2. The signed-in browser asks for a one-time code (createDesktopLoginCodeDB)
 *      and hands it to the app via bongpos://auth/callback?code=…&state=….
 *   3. The app exchanges the code plus its PKCE verifier for its own session
 *      (consumeDesktopLoginCodeDB).
 * Codes live 2 minutes, work once, and only with the verifier that only the
 * app knows, so a leaked bongpos:// link cannot be replayed.
 */

const CODE_TTL_SECONDS = 120;

const sha256Hex = (value) => crypto.createHash("sha256").update(value).digest("hex");

exports.createDesktopLoginCodeDB = async ({ tenantId, username, codeChallenge }) => {
  const code = crypto.randomBytes(32).toString("base64url");
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.query("DELETE FROM desktop_login_codes WHERE expires_at < NOW() - INTERVAL 1 DAY");
    await conn.query(
      `INSERT INTO desktop_login_codes (code_hash, tenant_id, username, code_challenge, expires_at)
       VALUES (?, ?, ?, ?, NOW() + INTERVAL ? SECOND)`,
      [sha256Hex(code), tenantId ?? null, username, codeChallenge, CODE_TTL_SECONDS]
    );
    return { code, expiresIn: CODE_TTL_SECONDS };
  } finally {
    conn.release();
  }
};

/**
 * Marks the code used (atomically, so it works once) and returns its owner,
 * or null when the code is unknown, expired, already used or the verifier
 * does not match the challenge.
 */
exports.consumeDesktopLoginCodeDB = async ({ code, codeVerifier }) => {
  const codeHash = sha256Hex(code);
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT tenant_id, username, code_challenge FROM desktop_login_codes
       WHERE code_hash = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1`,
      [codeHash]
    );
    const row = rows[0];
    if (!row) return null;

    const expected = Buffer.from(row.code_challenge);
    const actual = Buffer.from(crypto.createHash("sha256").update(codeVerifier).digest("base64url"));
    const verifierOk = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

    // Burn the code on any attempt, so a wrong verifier cannot be retried.
    const [result] = await conn.query(
      "UPDATE desktop_login_codes SET used_at = NOW() WHERE code_hash = ? AND used_at IS NULL",
      [codeHash]
    );
    if (result.affectedRows !== 1 || !verifierOk) return null;
    return { tenantId: row.tenant_id, username: row.username };
  } finally {
    conn.release();
  }
};
