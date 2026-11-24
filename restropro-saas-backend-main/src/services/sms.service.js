/**
 * Per-tenant SMS through PlasGate (Cambodian SMS gateway).
 *
 * Each restaurant brings its own PlasGate account: the private key and secret
 * are stored encrypted (AES-256-GCM, utils/crypto) and never returned to the
 * browser — the settings API only reports whether they are set.
 *
 * PlasGate REST send: POST {base}/rest/send?private_key=KEY
 *   header  X-Secret: SECRET
 *   body    { sender, to, content }
 * The base URL can be overridden with PLASGATE_API_URL if PlasGate moves it.
 */
const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { encrypt, decrypt } = require("../utils/crypto");
const { normalizePhone } = require("../utils/phone");

const PLASGATE_API_URL = (process.env.PLASGATE_API_URL || "https://cloudapi.plasgate.com").replace(/\/+$/, "");
const SEND_TIMEOUT_MS = 10000;

const DEFAULT_JOIN_TEMPLATE =
  "Hi {name}, you're #{position} on the waitlist at {restaurant}. About {wait} min. Live status: {link}";
const DEFAULT_READY_TEMPLATE =
  "Hi {name}, your table at {restaurant} is ready! Please come to the host stand within 10 min.";

exports.DEFAULT_JOIN_TEMPLATE = DEFAULT_JOIN_TEMPLATE;
exports.DEFAULT_READY_TEMPLATE = DEFAULT_READY_TEMPLATE;

const sealSecret = (value) => (value ? JSON.stringify(encrypt(String(value))) : null);

const openSecret = (stored) => {
  if (!stored) return null;
  try {
    return decrypt(JSON.parse(stored));
  } catch (err) {
    console.error("[sms] could not decrypt stored credential:", err.message);
    return null;
  }
};

const readRow = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(`SELECT * FROM sms_settings WHERE tenant_id = ? LIMIT 1`, [tenantId]);
    return rows[0] || null;
  } finally {
    conn.release();
  }
};

/** Settings safe to send to the browser (credentials reduced to "is set"). */
exports.getSmsSettingsPublicDB = async (tenantId) => {
  const row = await readRow(tenantId);
  return {
    provider: "plasgate",
    is_enabled: Boolean(row?.is_enabled),
    sender: row?.sender || "",
    send_on_join: Boolean(row?.send_on_join),
    join_template: row?.join_template || DEFAULT_JOIN_TEMPLATE,
    ready_template: row?.ready_template || DEFAULT_READY_TEMPLATE,
    has_private_key: Boolean(row?.private_key_enc),
    has_secret: Boolean(row?.secret_enc),
  };
};

/** Full settings including decrypted credentials, for sending only. */
const getSmsSettingsInternal = async (tenantId) => {
  const row = await readRow(tenantId);
  if (!row) return null;
  return {
    isEnabled: Boolean(row.is_enabled),
    sender: row.sender || "",
    sendOnJoin: Boolean(row.send_on_join),
    joinTemplate: row.join_template || DEFAULT_JOIN_TEMPLATE,
    readyTemplate: row.ready_template || DEFAULT_READY_TEMPLATE,
    privateKey: openSecret(row.private_key_enc),
    secret: openSecret(row.secret_enc),
  };
};
exports.getSmsSettingsInternal = getSmsSettingsInternal;

/**
 * Upsert. A blank private key / secret keeps the stored one, so the settings
 * form can be saved without re-typing credentials it never received.
 */
exports.updateSmsSettingsDB = async (tenantId, data) => {
  const existing = await readRow(tenantId);
  const privateKeyEnc = data.private_key ? sealSecret(data.private_key.trim()) : existing?.private_key_enc || null;
  const secretEnc = data.secret ? sealSecret(data.secret.trim()) : existing?.secret_enc || null;
  const clip = (v, n) => (v == null ? null : String(v).slice(0, n));

  const conn = await getMySqlPromiseConnection();
  try {
    await conn.query(
      `INSERT INTO sms_settings
        (tenant_id, provider, is_enabled, private_key_enc, secret_enc, sender, send_on_join, join_template, ready_template)
       VALUES (?, 'plasgate', ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         is_enabled = VALUES(is_enabled),
         private_key_enc = VALUES(private_key_enc),
         secret_enc = VALUES(secret_enc),
         sender = VALUES(sender),
         send_on_join = VALUES(send_on_join),
         join_template = VALUES(join_template),
         ready_template = VALUES(ready_template)`,
      [
        tenantId,
        data.is_enabled ? 1 : 0,
        privateKeyEnc,
        secretEnc,
        clip((data.sender || "").trim(), 30) || null,
        data.send_on_join ? 1 : 0,
        clip(data.join_template, 480) || null,
        clip(data.ready_template, 480) || null,
      ]
    );
  } finally {
    conn.release();
  }
  return exports.getSmsSettingsPublicDB(tenantId);
};

/** Fill {placeholders}; unknown ones are left as typed. */
exports.renderTemplate = (template, vars) =>
  String(template || "").replace(/\{(\w+)\}/g, (match, key) =>
    vars[key] === undefined || vars[key] === null ? match : String(vars[key])
  );

/** PlasGate wants the international number without "+", e.g. 85512345678. */
const toPlasgateNumber = (phone) => normalizePhone(phone).replace(/\D/g, "");

/**
 * Send one SMS with explicit credentials. Throws an Error with a readable
 * message on failure.
 */
const sendPlasgateSms = async ({ privateKey, secret, sender }, phone, content) => {
  if (!privateKey || !secret) throw new Error("PlasGate private key and secret are not set");
  if (!sender) throw new Error("SMS sender name/number is not set");
  const to = toPlasgateNumber(phone);
  if (to.length < 8) throw new Error("Phone number is not valid");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(`${PLASGATE_API_URL}/rest/send?private_key=${encodeURIComponent(privateKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Secret": secret },
      body: JSON.stringify({ sender, to, content }),
      signal: controller.signal,
    });
    const raw = await res.text();
    let body = null;
    try { body = JSON.parse(raw); } catch { /* non-JSON reply */ }

    if (!res.ok) {
      if (res.status === 401) throw new Error("PlasGate rejected the private key / secret (401)");
      const detail = body?.message || body?.error || raw.slice(0, 160) || `HTTP ${res.status}`;
      throw new Error(`PlasGate error: ${detail}`);
    }
    return { success: true, response: body || raw.slice(0, 200) };
  } catch (err) {
    if (err.name === "AbortError") throw new Error("PlasGate did not answer within 10 seconds");
    throw err;
  } finally {
    clearTimeout(timer);
  }
};
exports.sendPlasgateSms = sendPlasgateSms;

/**
 * Send with the tenant's saved settings. Never throws: returns
 * { status: 'sent' | 'failed' | 'skipped', error }.
 */
exports.sendTenantSms = async (tenantId, phone, content) => {
  if (!phone) return { status: "skipped", error: "No phone number" };
  const settings = await getSmsSettingsInternal(tenantId);
  if (!settings?.isEnabled) return { status: "skipped", error: "SMS is turned off" };
  try {
    await sendPlasgateSms(settings, phone, content);
    return { status: "sent", error: null };
  } catch (err) {
    console.error(`[sms] tenant ${tenantId} send failed:`, err.message);
    return { status: "failed", error: err.message.slice(0, 250) };
  }
};
