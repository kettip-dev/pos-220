/**
 * Unusual staff activity alert: settings and the daily Telegram message.
 *
 * The message goes to the same Telegram chat as the end-of-day report and is
 * sent only when at least one staff member is flagged, so a normal day stays
 * quiet. Once per tenant per day (notification_dispatch_log claim).
 */
const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { getTelegramSettingsDB, sendTelegramMessage } = require("./telegram.service");
const { getStaffActivityForDateDB } = require("./reports.service");
const { claimScheduledDispatchDB, releaseScheduledDispatchDB } = require("./notification_dispatch.service");
const { DEFAULT_STAFF_ALERT_SETTINGS } = require("../utils/staffActivityRules");

const DISPATCH_TYPE = "TELEGRAM_STAFF_ALERTS";

const escapeHtml = (text) =>
  String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const clamp = (v, min, max, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

exports.getStaffAlertSettingsDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(`SELECT * FROM staff_alert_settings WHERE tenant_id = ? LIMIT 1`, [tenantId]);
    const r = rows[0];
    const d = DEFAULT_STAFF_ALERT_SETTINGS;
    return {
      is_enabled: r ? Boolean(r.is_enabled) : d.isEnabled,
      max_rate_percent: r ? Number(r.max_rate_percent) : d.maxRatePercent,
      min_amount: r ? Number(r.min_amount) : d.minAmount,
      peer_multiple: r ? Number(r.peer_multiple) : d.peerMultiple,
      max_no_sales: r ? Number(r.max_no_sales) : d.maxNoSales,
    };
  } finally {
    conn.release();
  }
};

exports.updateStaffAlertSettingsDB = async (tenantId, body = {}) => {
  const d = DEFAULT_STAFF_ALERT_SETTINGS;
  const values = [
    tenantId,
    body.is_enabled === undefined ? 1 : body.is_enabled ? 1 : 0,
    clamp(body.max_rate_percent, 0.5, 100, d.maxRatePercent),
    clamp(body.min_amount, 0, 1000000, d.minAmount),
    clamp(body.peer_multiple, 1.1, 20, d.peerMultiple),
    Math.round(clamp(body.max_no_sales, 0, 1000, d.maxNoSales)),
  ];
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.query(
      `INSERT INTO staff_alert_settings (tenant_id, is_enabled, max_rate_percent, min_amount, peer_multiple, max_no_sales)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), max_rate_percent = VALUES(max_rate_percent),
         min_amount = VALUES(min_amount), peer_multiple = VALUES(peer_multiple), max_no_sales = VALUES(max_no_sales)`,
      values
    );
  } finally {
    conn.release();
  }
  return exports.getStaffAlertSettingsDB(tenantId);
};

const storeInfo = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(`SELECT store_name, currency FROM store_details WHERE tenant_id = ? LIMIT 1`, [tenantId]);
    return { name: rows[0]?.store_name || "Restaurant", currency: rows[0]?.currency || "$" };
  } finally {
    conn.release();
  }
};

/** Telegram HTML for the flagged staff of one day. */
const buildMessage = (store, date, result) => {
  const money = (n) => `${store.currency} ${Number(n || 0).toFixed(2)}`;
  const lines = [
    `⚠️ <b>Unusual staff activity</b> · ${escapeHtml(store.name)}`,
    `📅 ${escapeHtml(date)} · team rate ${result.teamRate}%`,
    "",
  ];
  result.rows
    .filter((r) => r.flags.length > 0)
    .slice(0, 10)
    .forEach((r) => {
      lines.push(`👤 <b>${escapeHtml(r.username)}</b> · sales ${money(r.sales)} · taken off ${money(r.exception_amount)}`);
      r.flags.forEach((f) => lines.push(`   • ${escapeHtml(f.text)}`));
      const parts = [
        r.void_amount > 0 ? `voided bills ${money(r.void_amount)}` : null,
        r.refund_amount > 0 ? `refunds ${money(r.refund_amount)}` : null,
        r.discount_amount > 0 ? `bill discounts ${money(r.discount_amount)}` : null,
        r.comp_amount > 0 ? `comps ${money(r.comp_amount)}` : null,
        r.item_discount_amount > 0 ? `item discounts ${money(r.item_discount_amount)}` : null,
        r.item_void_amount > 0 ? `item voids ${money(r.item_void_amount)}` : null,
      ].filter(Boolean);
      if (parts.length) lines.push(`   ${escapeHtml(parts.join(" · "))}`);
    });
  lines.push("", "Open Reports → Unusual Staff Activity for details.");
  return lines.join("\n");
};

/**
 * Check one day and send the Telegram alert when someone is flagged.
 * Returns { outcome: 'sent' | 'nothing-flagged' | 'disabled' | 'no-telegram' | 'already-sent' | 'failed', result }.
 * `force` skips the once-per-day claim (manual "send now").
 */
exports.runStaffAlertForDate = async (tenantId, date, { force = false, send = true } = {}) => {
  const store = await storeInfo(tenantId);
  const result = await getStaffActivityForDateDB(tenantId, date, store.currency);
  if (!send) return { outcome: "preview", result };
  if (!result.settings.isEnabled && !force) return { outcome: "disabled", result };
  if (result.flaggedCount === 0) return { outcome: "nothing-flagged", result };

  const tg = await getTelegramSettingsDB(tenantId);
  const chatId = tg?.eod_chat_id || tg?.orders_chat_id;
  const threadId = tg?.eod_chat_id ? tg?.eod_thread_id : tg?.eod_thread_id || tg?.orders_thread_id;
  if (!tg?.bot_token || !chatId) return { outcome: "no-telegram", result };

  if (!force && !(await claimScheduledDispatchDB(tenantId, DISPATCH_TYPE, date))) {
    return { outcome: "already-sent", result };
  }
  try {
    await sendTelegramMessage(tg.bot_token, chatId, buildMessage(store, date, result), { threadId });
    return { outcome: "sent", result };
  } catch (error) {
    console.error(`[staff-alerts] tenant=${tenantId} date=${date} send failed:`, error.message);
    if (!force) await releaseScheduledDispatchDB(tenantId, DISPATCH_TYPE, date);
    return { outcome: "failed", error: error.message, result };
  }
};
