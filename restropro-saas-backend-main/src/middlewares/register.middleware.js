const { getUserDB } = require("../services/user.service");
const { verifyManagerQuickPinDB } = require("../services/attendance.service");
const { getRegisterSettingsDB, resolveSessionForRequestDB } = require("../services/register.service");
const { ROLES } = require("../config/user.config");

/**
 * Attach the register session a money-moving request belongs to as
 * `req.registerSession` (or null).
 *
 * The terminal sends the till it is bound to in `X-Register-Id`; see
 * resolveSessionForRequestDB for the fallbacks. With `required`, when the
 * business enforces register sessions and none can be resolved, the request is
 * refused with code REGISTER_CLOSED so the POS can prompt to open the register.
 * Back-office actions (voids, refunds) use the optional form and decide for
 * themselves.
 */
const makeAttachRegisterSession = (required) => async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    const registerId = parseInt(req.headers["x-register-id"], 10) || null;
    const [settings, session] = await Promise.all([
      getRegisterSettingsDB(tenantId),
      resolveSessionForRequestDB(tenantId, registerId, req.user.username),
    ]);
    req.registerSettings = settings;
    req.registerSession = session;

    if (required && !session && Number(settings?.enforce_session) === 1) {
      return res.status(409).json({
        success: false,
        code: "REGISTER_CLOSED",
        message: "Open a register before taking payments.",
      });
    }
    next();
  } catch (error) {
    console.error("[register] attachRegisterSession failed:", error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};
exports.attachRegisterSession = makeAttachRegisterSession(true);
exports.attachRegisterSessionOptional = makeAttachRegisterSession(false);

/** Same as `authorize`'s user check, but answers a question instead of guarding a route. */
const hasScope = async (req, scope) => {
  if (req.groupOwner) return true;
  const user = await getUserDB(req.user.username, req.user.tenant_id);
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;
  return String(user.scope || "")
    .split(",")
    .map((s) => s.trim())
    .includes(scope);
};
exports.hasScope = hasScope;

/**
 * Who approved a manager-gated action. A user holding `scope` approves their
 * own action; anyone else needs a manager's Quick PIN in the request body
 * (`managerPin`), verified here on the server.
 *
 * Returns { approved: true, approvedBy } or { approved: false, reason }.
 */
exports.resolveManagerApproval = async (req, scope) => {
  if (await hasScope(req, scope)) {
    return { approved: true, approvedBy: req.user.username, self: true };
  }
  const pin = req.body?.managerPin;
  if (!pin) return { approved: false, reason: "MANAGER_PIN_REQUIRED" };
  const result = await verifyManagerQuickPinDB(req.user.tenant_id, pin);
  if (!result?.verified) return { approved: false, reason: "INVALID_MANAGER_PIN" };
  return { approved: true, approvedBy: result.manager.username, self: false };
};
