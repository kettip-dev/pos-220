const {
  getStaffAlertSettingsDB,
  updateStaffAlertSettingsDB,
  runStaffAlertForDate,
} = require("../services/staff_alerts.service");
const { getDatabaseClockDB } = require("../services/notification_dispatch.service");

const fail = (req, res, error) => {
  console.error(error);
  return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
};

exports.getSettings = async (req, res) => {
  try {
    return res.status(200).json(await getStaffAlertSettingsDB(req.user.tenant_id));
  } catch (error) {
    return fail(req, res, error);
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const data = await updateStaffAlertSettingsDB(req.user.tenant_id, req.body || {});
    return res.status(200).json({ success: true, message: "Staff alert settings saved", data });
  } catch (error) {
    return fail(req, res, error);
  }
};

/**
 * Check a day (default: today on the DB clock). `send: true` also sends the
 * Telegram alert now, even if one already went out today.
 */
exports.checkDay = async (req, res) => {
  try {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.date || ""))
      ? req.body.date
      : (await getDatabaseClockDB()).date;
    const send = Boolean(req.body?.send);
    const { outcome, result, error } = await runStaffAlertForDate(req.user.tenant_id, date, { force: send, send });
    return res.status(200).json({
      success: true,
      date,
      outcome,
      error: error || null,
      teamRate: result.teamRate,
      flaggedCount: result.flaggedCount,
      rows: result.rows,
    });
  } catch (error) {
    return fail(req, res, error);
  }
};
