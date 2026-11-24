const { nanoid } = require("nanoid");
const { CONFIG } = require("../config");
const { normalizePhone } = require("../utils/phone");
const { getStoreSettingDB } = require("../services/settings.service");
const {
  addWaitlistEntryDB,
  getWaitlistEntryDB,
  getWaitlistDB,
  getQueuePositionDB,
  updateWaitlistEntryDB,
  setWaitlistStatusDB,
  markWaitlistNotifiedDB,
  recordWaitlistSmsDB,
  deleteWaitlistEntryDB,
  getPublicWaitlistStatusDB,
} = require("../services/waitlist.service");
const {
  getSmsSettingsPublicDB,
  getSmsSettingsInternal,
  updateSmsSettingsDB,
  renderTemplate,
  sendPlasgateSms,
  sendTenantSms,
} = require("../services/sms.service");

const STATUSES = ["waiting", "seated", "cancelled", "no_show"];

const emitWaitlistUpdate = (req, payload = {}) => {
  const io = req.app.get("io");
  if (!io) return;
  io.to(String(req.user.tenant_id)).emit("waitlist_update", payload);
};

/**
 * Base URL for the guest status link. FRONTEND_DOMAIN may be a comma list of
 * allowed origins (CORS); use the caller's Origin when it is one of them so
 * the link matches the domain staff are on, otherwise the first entry.
 */
const frontendBaseUrl = (req) => {
  const allowed = String(CONFIG.FRONTEND_DOMAIN || "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const origin = String(req.get("origin") || "").replace(/\/+$/, "");
  if (origin && allowed.includes(origin)) return origin;
  return allowed[0] || origin || "";
};

const statusLink = (req, code) => `${frontendBaseUrl(req)}/w/${code}`;

const parseEntryBody = (body) => {
  const guestName = String(body.guestName || "").trim().slice(0, 120);
  const partySize = Math.round(Number(body.partySize));
  const quoted = body.quotedWaitMinutes === "" || body.quotedWaitMinutes == null
    ? null
    : Math.round(Number(body.quotedWaitMinutes));
  const phoneRaw = String(body.phone || "").trim();
  return {
    guestName,
    partySize,
    phone: phoneRaw ? normalizePhone(phoneRaw).slice(0, 30) : null,
    notes: String(body.notes || "").trim().slice(0, 255) || null,
    quotedWaitMinutes: Number.isFinite(quoted) && quoted >= 0 && quoted <= 600 ? quoted : null,
  };
};

const validateEntry = (entry) => {
  if (!entry.guestName) return "Guest name is required";
  if (!Number.isFinite(entry.partySize) || entry.partySize < 1 || entry.partySize > 100) {
    return "Party size must be between 1 and 100";
  }
  return null;
};

const templateVars = async (req, entry, position) => {
  const store = await getStoreSettingDB(req.user.tenant_id).catch(() => null);
  return {
    name: String(entry.guest_name || "").trim().split(/\s+/)[0] || "",
    restaurant: store?.store_name || "",
    position: position || "",
    wait: entry.quoted_wait_minutes ?? "",
    party: entry.party_size,
    link: statusLink(req, entry.public_code),
  };
};

exports.getWaitlist = async (req, res) => {
  try {
    const data = await getWaitlistDB(req.user.tenant_id);
    const sms = await getSmsSettingsPublicDB(req.user.tenant_id);
    return res.status(200).json({
      ...data,
      smsEnabled: sms.is_enabled && sms.has_private_key && sms.has_secret && Boolean(sms.sender),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.addWaitlistEntry = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const entry = parseEntryBody(req.body);
    const invalid = validateEntry(entry);
    if (invalid) return res.status(400).json({ success: false, message: invalid });

    const publicCode = nanoid(12);
    const id = await addWaitlistEntryDB({
      ...entry,
      tenantId,
      publicCode,
      createdBy: req.user.username || null,
    });

    let sms = { status: "none", error: null };
    if (entry.phone && req.body.sendSms !== false) {
      const settings = await getSmsSettingsInternal(tenantId);
      if (settings?.isEnabled && settings.sendOnJoin) {
        const saved = await getWaitlistEntryDB(id, tenantId);
        const position = await getQueuePositionDB(id, tenantId);
        const text = renderTemplate(settings.joinTemplate, await templateVars(req, saved, position));
        sms = await sendTenantSms(tenantId, entry.phone, text);
        await recordWaitlistSmsDB(id, tenantId, sms.status, sms.error);
      }
    }

    emitWaitlistUpdate(req, { action: "added", id });
    const saved = await getWaitlistEntryDB(id, tenantId);
    return res.status(200).json({
      success: true,
      message: "Added to waitlist",
      entry: saved,
      statusUrl: statusLink(req, publicCode),
      sms,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.updateWaitlistEntry = async (req, res) => {
  try {
    const entry = parseEntryBody(req.body);
    const invalid = validateEntry(entry);
    if (invalid) return res.status(400).json({ success: false, message: invalid });

    const ok = await updateWaitlistEntryDB(req.params.id, req.user.tenant_id, entry);
    if (!ok) return res.status(404).json({ success: false, message: "Waitlist entry not found" });
    emitWaitlistUpdate(req, { action: "updated", id: Number(req.params.id) });
    return res.status(200).json({ success: true, message: "Waitlist entry updated" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.setWaitlistStatus = async (req, res) => {
  try {
    const status = String(req.body.status || "");
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Unknown status" });
    }
    const tableId = req.body.tableId ? Number(req.body.tableId) : null;
    const ok = await setWaitlistStatusDB(req.params.id, req.user.tenant_id, status, tableId);
    if (!ok) return res.status(404).json({ success: false, message: "Waitlist entry not found" });
    emitWaitlistUpdate(req, { action: "status", id: Number(req.params.id), status });
    return res.status(200).json({ success: true, message: "Waitlist updated" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

/**
 * "Table ready": always marks the guest notified (the host may also call out
 * their name) and sends the ready SMS when SMS is set up and they gave a phone.
 */
exports.notifyWaitlistEntry = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const entry = await getWaitlistEntryDB(req.params.id, tenantId);
    if (!entry) return res.status(404).json({ success: false, message: "Waitlist entry not found" });
    if (!["waiting", "notified"].includes(entry.status)) {
      return res.status(400).json({ success: false, message: "This guest is no longer waiting" });
    }

    let sms = { status: "skipped", error: "No phone number" };
    if (entry.phone) {
      const settings = await getSmsSettingsInternal(tenantId);
      const text = renderTemplate(settings?.readyTemplate || "", await templateVars(req, entry, 1));
      sms = settings?.isEnabled
        ? await sendTenantSms(tenantId, entry.phone, text)
        : { status: "skipped", error: "SMS is turned off" };
    }

    await markWaitlistNotifiedDB(entry.id, tenantId, sms.status, sms.error);
    emitWaitlistUpdate(req, { action: "notified", id: entry.id });
    return res.status(200).json({ success: true, sms });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.deleteWaitlistEntry = async (req, res) => {
  try {
    const ok = await deleteWaitlistEntryDB(req.params.id, req.user.tenant_id);
    if (!ok) return res.status(404).json({ success: false, message: "Waitlist entry not found" });
    emitWaitlistUpdate(req, { action: "deleted", id: Number(req.params.id) });
    return res.status(200).json({ success: true, message: "Removed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

/* ---------- SMS settings ---------- */

exports.getSmsSettings = async (req, res) => {
  try {
    return res.status(200).json(await getSmsSettingsPublicDB(req.user.tenant_id));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Failed to load SMS settings" });
  }
};

exports.updateSmsSettings = async (req, res) => {
  try {
    const data = await updateSmsSettingsDB(req.user.tenant_id, req.body || {});
    return res.status(200).json({ success: true, message: "SMS settings saved", data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Failed to save SMS settings" });
  }
};

/** Send one test SMS using typed credentials, falling back to saved ones. */
exports.testSms = async (req, res) => {
  try {
    const phone = String(req.body.phone || "").trim();
    if (!phone) return res.status(400).json({ success: false, message: "Enter a phone number to send the test to" });
    const saved = (await getSmsSettingsInternal(req.user.tenant_id)) || {};
    const store = await getStoreSettingDB(req.user.tenant_id).catch(() => null);
    await sendPlasgateSms(
      {
        privateKey: req.body.private_key || saved.privateKey,
        secret: req.body.secret || saved.secret,
        sender: req.body.sender || saved.sender,
      },
      phone,
      `Test SMS from ${store?.store_name || "Bong POS"}: your waitlist messages are set up.`
    );
    return res.status(200).json({ success: true, message: "Test SMS sent. Check the phone." });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Test SMS failed" });
  }
};

/* ---------- Public guest status ---------- */

exports.getPublicWaitlistStatus = async (req, res) => {
  try {
    const code = String(req.params.code || "");
    if (!/^[A-Za-z0-9_-]{8,24}$/.test(code)) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    const status = await getPublicWaitlistStatusDB(code);
    if (!status) return res.status(404).json({ success: false, message: "Not found" });
    res.set("Cache-Control", "no-store");
    return res.status(200).json(status);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
