const {
  getRegisterSettingsDB,
  updateRegisterSettingsDB,
  getRegistersDB,
  addRegisterDB,
  updateRegisterDB,
  deleteRegisterDB,
  getCurrentBusinessDayDB,
  getOpenSessionsDB,
  getSessionDB,
  openSessionDB,
  getSuggestedFloatDB,
  handoverSessionDB,
  addCashMovementDB,
  getSessionSummaryDB,
  closeSessionDB,
  reopenSessionDB,
  getSessionsDB,
  getSessionAuditDB,
  getDayCloseChecklistDB,
  closeBusinessDayDB,
  getBusinessDaysDB,
  setPaymentTypeCashDB,
} = require("../services/register.service");
const { hasScope, resolveManagerApproval } = require("../middlewares/register.middleware");
const { SCOPES } = require("../config/user.config");
const { NOTIFICATION_TYPES, notifyDayEndReconciliation } = require("../services/notification.service");
const { claimScheduledDispatchDB, recordScheduledDispatchResultDB } = require("../services/notification_dispatch.service");
const { sendEodTelegramNotification } = require("../services/telegram.service");
const { getCurrencyDB } = require("../services/settings.service");
const { CONFIG } = require("../config");

// Business-rule refusals map to 4xx with a stable `code` the POS can branch on.
const CLIENT_ERROR_STATUS = {
  REGISTER_NOT_FOUND: 404,
  SESSION_NOT_FOUND: 404,
  INVOICE_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  REGISTER_ALREADY_OPEN: 409,
  REGISTER_HAS_OPEN_SESSION: 409,
  REGISTER_HAS_HISTORY: 409,
  REGISTER_NAME_TAKEN: 409,
  SESSION_CLOSED: 409,
  SESSION_NOT_CLOSED: 409,
  DAY_CLOSED: 409,
  REGISTERS_OPEN: 409,
  OPEN_ORDERS: 409,
  NO_OPEN_DAY: 409,
  VARIANCE_APPROVAL_REQUIRED: 409,
};

const sendError = (req, res, error, context) => {
  if (error?.isRegisterError) {
    const { code, message, variance, checklist, sessionId } = error;
    return res.status(CLIENT_ERROR_STATUS[code] || 400).json({ success: false, code, message, variance, checklist, sessionId });
  }
  console.error(`[register] ${context} failed:`, error);
  return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
};
exports.sendRegisterError = sendError;

const emitRegisterUpdate = (req, payload) => {
  const io = req.app.get("io");
  if (io) io.to(String(req.user.tenant_id)).emit("register_update", payload);
};

const approvalRefusal = (res, reason) =>
  res.status(403).json({
    success: false,
    code: reason,
    message: reason === "INVALID_MANAGER_PIN" ? "Invalid manager PIN." : "Manager approval required.",
  });

/** In a blind close the cashier must not see the expected drawer total until they have counted. */
const redactForBlindClose = async (req, summary, settings) => {
  if (summary.status !== "OPEN" || Number(settings?.blind_close) !== 1) return summary;
  if (await hasScope(req, SCOPES.REGISTER_MANAGE)) return summary;
  const cash = { ...summary.cash };
  for (const key of ["expected_primary", "expected_secondary", "expected_base"]) cash[key] = null;
  return { ...summary, cash, blind: true };
};

/* ------------------------------- status ------------------------------- */

exports.getRegisterStatus = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const boundRegisterId = parseInt(req.headers["x-register-id"], 10) || null;
    const [settings, registers, openSessions, day, canManage] = await Promise.all([
      getRegisterSettingsDB(tenantId),
      getRegistersDB(tenantId),
      getOpenSessionsDB(tenantId),
      getCurrentBusinessDayDB(tenantId),
      hasScope(req, SCOPES.REGISTER_MANAGE),
    ]);
    const boundSession = boundRegisterId ? openSessions.find((s) => Number(s.register_id) === boundRegisterId) || null : null;
    return res.status(200).json({
      settings,
      registers,
      openSessions: openSessions.map(({ summary, ...s }) => s),
      boundRegisterId,
      boundSession: boundSession ? (({ summary, ...s }) => s)(boundSession) : null,
      businessDay: day,
      canManage,
    });
  } catch (error) {
    return sendError(req, res, error, "getRegisterStatus");
  }
};

/* ------------------------------ settings ------------------------------ */

exports.getRegisterSettings = async (req, res) => {
  try {
    return res.status(200).json(await getRegisterSettingsDB(req.user.tenant_id));
  } catch (error) {
    return sendError(req, res, error, "getRegisterSettings");
  }
};

exports.updateRegisterSettings = async (req, res) => {
  try {
    const settings = await updateRegisterSettingsDB(req.user.tenant_id, req.body || {});
    emitRegisterUpdate(req, { action: "settings_updated" });
    return res.status(200).json({ success: true, message: "Register settings saved.", settings });
  } catch (error) {
    return sendError(req, res, error, "updateRegisterSettings");
  }
};

exports.setPaymentTypeCash = async (req, res) => {
  try {
    await setPaymentTypeCashDB(req.user.tenant_id, req.params.id, Boolean(req.body?.isCash));
    return res.status(200).json({ success: true, message: "Payment method updated." });
  } catch (error) {
    return sendError(req, res, error, "setPaymentTypeCash");
  }
};

/* ------------------------------ registers ----------------------------- */

exports.getRegisters = async (req, res) => {
  try {
    return res.status(200).json(await getRegistersDB(req.user.tenant_id));
  } catch (error) {
    return sendError(req, res, error, "getRegisters");
  }
};

exports.addRegister = async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ success: false, message: "Register name is required." });
    const id = await addRegisterDB(req.user.tenant_id, { name, printerId: req.body?.printerId || null });
    emitRegisterUpdate(req, { action: "registers_updated" });
    return res.status(200).json({ success: true, message: "Register added.", id });
  } catch (error) {
    return sendError(req, res, error, "addRegister");
  }
};

exports.updateRegister = async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ success: false, message: "Register name is required." });
    await updateRegisterDB(req.user.tenant_id, req.params.id, {
      name,
      printerId: req.body?.printerId || null,
      isActive: req.body?.isActive !== false,
    });
    emitRegisterUpdate(req, { action: "registers_updated" });
    return res.status(200).json({ success: true, message: "Register updated." });
  } catch (error) {
    return sendError(req, res, error, "updateRegister");
  }
};

exports.deleteRegister = async (req, res) => {
  try {
    await deleteRegisterDB(req.user.tenant_id, req.params.id);
    emitRegisterUpdate(req, { action: "registers_updated" });
    return res.status(200).json({ success: true, message: "Register deleted." });
  } catch (error) {
    return sendError(req, res, error, "deleteRegister");
  }
};

exports.getSuggestedFloat = async (req, res) => {
  try {
    return res.status(200).json(await getSuggestedFloatDB(req.user.tenant_id, req.params.id));
  } catch (error) {
    return sendError(req, res, error, "getSuggestedFloat");
  }
};

/* ------------------------------ sessions ------------------------------ */

exports.openSession = async (req, res) => {
  try {
    const { registerId, floatPrimary, floatSecondary, denominations, exchangeRate } = req.body || {};
    if (!registerId) return res.status(400).json({ success: false, message: "Choose a register." });
    if (Number(floatPrimary) < 0 || Number(floatSecondary) < 0) {
      return res.status(400).json({ success: false, message: "Float cannot be negative." });
    }
    const session = await openSessionDB(req.user.tenant_id, {
      registerId,
      username: req.user.username,
      floatPrimary: Number(floatPrimary) || 0,
      floatSecondary: Number(floatSecondary) || 0,
      denominations,
      exchangeRate,
    });
    emitRegisterUpdate(req, { action: "session_opened", sessionId: session.id, registerId: session.register_id });
    return res.status(200).json({ success: true, message: `${session.register_name} is open.`, session });
  } catch (error) {
    return sendError(req, res, error, "openSession");
  }
};

exports.getSessionSummary = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const [summary, settings] = await Promise.all([getSessionSummaryDB(tenantId, req.params.id), getRegisterSettingsDB(tenantId)]);
    // Computed before any blind-close redaction, so the cashier is still told to drop without seeing the total.
    const dropThreshold = Number(settings?.cash_drop_threshold || 0);
    summary.drop_suggested = summary.status === "OPEN" && dropThreshold > 0 && Number(summary.cash?.expected_base || 0) > dropThreshold;
    return res.status(200).json(await redactForBlindClose(req, summary, settings));
  } catch (error) {
    return sendError(req, res, error, "getSessionSummary");
  }
};

exports.getSessionAudit = async (req, res) => {
  try {
    return res.status(200).json(await getSessionAuditDB(req.user.tenant_id, req.params.id));
  } catch (error) {
    return sendError(req, res, error, "getSessionAudit");
  }
};

exports.getSessions = async (req, res) => {
  try {
    const { from, to, registerId, limit } = req.query;
    return res.status(200).json(await getSessionsDB(req.user.tenant_id, { from, to, registerId, limit }));
  } catch (error) {
    return sendError(req, res, error, "getSessions");
  }
};

// Paying cash out of the drawer is manager-gated; putting it in, dropping to the safe and opening for change are not.
const MOVEMENTS_NEEDING_APPROVAL = new Set(["PAY_OUT", "TIP_PAYOUT"]);

exports.addCashMovement = async (req, res) => {
  try {
    const { type, amountPrimary, amountSecondary, reason, staffUsername } = req.body || {};
    if (!["PAY_IN", "PAY_OUT", "DROP", "NO_SALE", "TIP_PAYOUT"].includes(type)) {
      return res.status(400).json({ success: false, message: "Unknown cash movement." });
    }
    if ((type === "PAY_IN" || type === "PAY_OUT" || type === "NO_SALE") && !String(reason || "").trim()) {
      return res.status(400).json({ success: false, message: "A reason is required." });
    }
    if (type === "TIP_PAYOUT" && !staffUsername) {
      return res.status(400).json({ success: false, message: "Choose who the tips are paid to." });
    }

    let approvedBy = null;
    if (MOVEMENTS_NEEDING_APPROVAL.has(type)) {
      const approval = await resolveManagerApproval(req, SCOPES.REGISTER_MANAGE);
      if (!approval.approved) return approvalRefusal(res, approval.reason);
      approvedBy = approval.approvedBy;
    }

    const id = await addCashMovementDB(req.user.tenant_id, req.params.id, {
      type,
      amountPrimary,
      amountSecondary,
      reason: String(reason || "").trim() || null,
      staffUsername: staffUsername || null,
      username: req.user.username,
      approvedBy,
    });
    emitRegisterUpdate(req, { action: "cash_movement", sessionId: Number(req.params.id), type });
    return res.status(200).json({ success: true, message: "Recorded.", id, approvedBy });
  } catch (error) {
    return sendError(req, res, error, "addCashMovement");
  }
};

exports.handoverSession = async (req, res) => {
  try {
    const toUser = String(req.body?.toUser || "").trim();
    if (!toUser) return res.status(400).json({ success: false, message: "Choose the next cashier." });
    await handoverSessionDB(req.user.tenant_id, req.params.id, { fromUser: req.user.username, toUser });
    emitRegisterUpdate(req, { action: "session_handover", sessionId: Number(req.params.id), toUser });
    return res.status(200).json({ success: true, message: `Register handed over to ${toUser}.` });
  } catch (error) {
    return sendError(req, res, error, "handoverSession");
  }
};

exports.closeSession = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { countedPrimary, countedSecondary, denominations, note } = req.body || {};
    if (countedPrimary === undefined || countedPrimary === null || Number(countedPrimary) < 0 || Number(countedSecondary || 0) < 0) {
      return res.status(400).json({ success: false, message: "Enter the counted cash." });
    }
    const input = {
      username: req.user.username,
      countedPrimary: Number(countedPrimary),
      countedSecondary: Number(countedSecondary) || 0,
      denominations,
      note: String(note || "").trim() || null,
    };

    let summary;
    try {
      summary = await closeSessionDB(tenantId, req.params.id, input);
    } catch (error) {
      if (error.code !== "VARIANCE_APPROVAL_REQUIRED") throw error;
      // Over the variance limit: a manager closing their own till approves it; anyone else needs a PIN.
      const approval = await resolveManagerApproval(req, SCOPES.REGISTER_MANAGE);
      if (!approval.approved) {
        return res.status(409).json({
          success: false,
          code: "VARIANCE_APPROVAL_REQUIRED",
          reason: approval.reason,
          message: approval.reason === "INVALID_MANAGER_PIN" ? "Invalid manager PIN." : error.message,
          variance: error.variance,
        });
      }
      summary = await closeSessionDB(tenantId, req.params.id, { ...input, approvedBy: approval.approvedBy });
    }

    emitRegisterUpdate(req, { action: "session_closed", sessionId: Number(req.params.id), registerId: summary.register_id });
    return res.status(200).json({ success: true, message: `Register closed. Z #${summary.z_number}.`, summary });
  } catch (error) {
    return sendError(req, res, error, "closeSession");
  }
};

exports.reopenSession = async (req, res) => {
  try {
    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ success: false, message: "A reason is required to reopen a closed register." });
    await reopenSessionDB(req.user.tenant_id, req.params.id, { username: req.user.username, reason });
    const session = await getSessionDB(req.user.tenant_id, req.params.id);
    emitRegisterUpdate(req, { action: "session_reopened", sessionId: Number(req.params.id), registerId: session?.register_id });
    return res.status(200).json({ success: true, message: "Register session reopened." });
  } catch (error) {
    return sendError(req, res, error, "reopenSession");
  }
};

/* ---------------------------- business day ---------------------------- */

exports.getDayCloseChecklist = async (req, res) => {
  try {
    return res.status(200).json(await getDayCloseChecklistDB(req.user.tenant_id));
  } catch (error) {
    return sendError(req, res, error, "getDayCloseChecklist");
  }
};

exports.getBusinessDays = async (req, res) => {
  try {
    return res.status(200).json(await getBusinessDaysDB(req.user.tenant_id, req.query.limit));
  } catch (error) {
    return sendError(req, res, error, "getBusinessDays");
  }
};

/**
 * Day-end alerts follow the POS close instead of the clock for businesses that
 * close their day here. Same dispatch claim as the scheduler, keyed by the
 * business date, so an owner never gets both.
 */
const sendDayCloseNotifications = async (tenantId, summary) => {
  const date = summary.business_date;
  try {
    const claimed = await claimScheduledDispatchDB(tenantId, NOTIFICATION_TYPES.DAY_END_RECONCILIATION, date);
    if (claimed && summary.totals.bill_count > 0) {
      const currency = await getCurrencyDB(tenantId);
      const result = await notifyDayEndReconciliation(tenantId, {
        date,
        totalSales: summary.totals.net_sales,
        currency,
        invoiceCount: summary.totals.bill_count,
        reportId: CONFIG.DAY_END_RECONCILIATION_REPORT_ID,
      });
      await recordScheduledDispatchResultDB(tenantId, NOTIFICATION_TYPES.DAY_END_RECONCILIATION, date, result.successCount);
    }
  } catch (error) {
    console.error("[register] day-close push failed:", error);
  }
  await sendEodTelegramNotification(tenantId, date).catch((error) => console.error("[register] day-close telegram failed:", error));
};

exports.closeBusinessDay = async (req, res) => {
  try {
    const summary = await closeBusinessDayDB(req.user.tenant_id, {
      username: req.user.username,
      carryOverOpenOrders: Boolean(req.body?.carryOverOpenOrders),
    });
    sendDayCloseNotifications(req.user.tenant_id, summary);
    emitRegisterUpdate(req, { action: "day_closed", businessDate: summary.business_date });
    return res.status(200).json({ success: true, message: `Business day ${summary.business_date} closed.`, summary });
  } catch (error) {
    return sendError(req, res, error, "closeBusinessDay");
  }
};
