/**
 * Firebase (FCM) configuration storage — platform-global, superadmin-managed.
 *
 * The service account JSON is encrypted at rest with the existing AES-256-GCM
 * utility (utils/crypto.js) and only ever decrypted server-side to initialize
 * the Firebase Admin SDK. Nothing here is tenant-scoped on purpose: one
 * Firebase project serves the whole platform.
 */
const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { encrypt, decrypt } = require("../utils/crypto");

const CONFIG_ROW_ID = 1;

/**
 * Validate a service account object per the Firebase Admin SDK requirements.
 * Returns the parsed object, or throws an Error with a human-readable reason.
 * Accepts a JSON string or an already-parsed object.
 */
exports.parseServiceAccount = (input) => {
  let parsed = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      throw new Error("Malformed JSON — the file could not be parsed.");
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Service account must be a JSON object.");
  }

  const REQUIRED_FIELDS = ["type", "project_id", "private_key", "client_email"];
  const missing = REQUIRED_FIELDS.filter(
    (field) => typeof parsed[field] !== "string" || parsed[field].trim() === ""
  );
  if (missing.length > 0) {
    throw new Error(`Not a service account key file — missing: ${missing.join(", ")}.`);
  }
  if (parsed.type !== "service_account") {
    throw new Error(
      `Expected "type": "service_account" but got "${parsed.type}". ` +
        "This looks like the wrong file (google-services.json is the mobile client config, not a service account key)."
    );
  }
  return parsed;
};

/**
 * Raw status row (no credentials). Returns null when nothing is configured.
 */
exports.getFirebaseConfigStatusDB = async () => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT project_id, is_enabled, updated_by, created_at, updated_at,
              (encrypted_service_account IS NOT NULL) AS has_credentials
       FROM firebase_config WHERE id = ?`,
      [CONFIG_ROW_ID]
    );
    return rows[0] ?? null;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Decrypted service account for Firebase Admin initialization ONLY.
 * Never expose the return value through any API response.
 * Returns { serviceAccount, isEnabled } or null when not configured.
 */
exports.getDecryptedServiceAccountDB = async () => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT encrypted_service_account, is_enabled FROM firebase_config WHERE id = ?`,
      [CONFIG_ROW_ID]
    );
    const row = rows[0];
    if (!row?.encrypted_service_account) return null;
    const serviceAccount = JSON.parse(decrypt(JSON.parse(row.encrypted_service_account)));
    return { serviceAccount, isEnabled: row.is_enabled === 1 };
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Save/replace the global configuration. `serviceAccount` (already validated)
 * is optional so the enable/disable toggle can be updated on its own.
 */
exports.upsertFirebaseConfigDB = async ({ serviceAccount, isEnabled, updatedBy }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const encrypted = serviceAccount
      ? JSON.stringify(encrypt(JSON.stringify(serviceAccount)))
      : null;
    const projectId = serviceAccount ? serviceAccount.project_id : null;

    const enabledFlag = isEnabled === undefined ? null : isEnabled ? 1 : 0;

    // COALESCE keeps whatever the caller did not send: uploading a new key
    // preserves the toggle, and toggling preserves the stored key.
    const sql = `
    INSERT INTO firebase_config (id, encrypted_service_account, project_id, is_enabled, updated_by)
    VALUES (?, ?, ?, COALESCE(?, 1), ?)
    ON DUPLICATE KEY UPDATE
      encrypted_service_account = COALESCE(?, encrypted_service_account),
      project_id = COALESCE(?, project_id),
      is_enabled = COALESCE(?, is_enabled),
      updated_by = ?;
    `;
    await conn.query(sql, [
      CONFIG_ROW_ID, encrypted, projectId, enabledFlag, updatedBy ?? null,
      encrypted, projectId, enabledFlag, updatedBy ?? null,
    ]);
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/** Remove the configuration entirely (credentials included). */
exports.deleteFirebaseConfigDB = async () => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [result] = await conn.query(`DELETE FROM firebase_config WHERE id = ?`, [CONFIG_ROW_ID]);
    return result.affectedRows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};
