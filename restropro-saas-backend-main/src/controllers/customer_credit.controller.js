const {
  getOutstandingCustomersDB,
  getCustomerCreditDB,
  collectCustomerPaymentDB,
  writeOffInvoiceBalanceDB,
  setCustomerCreditLimitDB,
} = require("../services/customer_credit.service");

/** Pay Later errors carry a translation key; anything else keeps its own message. */
const translateError = (req, error) => (error?.i18n?.key ? req.__(error.i18n.key, error.i18n.args || {}) : error.message);
exports.translateError = translateError;

const fail = (req, res, error) => {
  if (error?.isRegisterError) {
    return res.status(400).json({ success: false, code: error.code, message: translateError(req, error) });
  }
  console.error("[customer-credit]", error);
  return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
};

const emit = (req, event, payload) => {
  const io = req.app.get("io");
  if (io) io.to(String(req.user.tenant_id)).emit(event, payload);
};

exports.getOutstandingCustomers = async (req, res) => {
  try {
    const result = await getOutstandingCustomersDB(req.user.tenant_id, { search: req.query.q || "" });
    return res.status(200).json(result);
  } catch (error) {
    return fail(req, res, error);
  }
};

exports.getCustomerCredit = async (req, res) => {
  try {
    const result = await getCustomerCreditDB(req.user.tenant_id, req.params.id);
    if (!result) return res.status(404).json({ success: false, message: req.__("credit_customer_not_found") });
    return res.status(200).json(result);
  } catch (error) {
    return fail(req, res, error);
  }
};

exports.collectCustomerPayment = async (req, res) => {
  try {
    const { amount, paymentTypeId, reference, note, tender, invoiceIds } = req.body || {};
    const result = await collectCustomerPaymentDB(req.user.tenant_id, req.params.id, {
      session: req.registerSession,
      amount,
      paymentTypeId,
      reference,
      note,
      tender,
      invoiceIds,
      username: req.user.username,
    });
    emit(req, "customer_credit_update", { phone: req.params.id });
    return res.status(200).json({ success: true, message: req.__("credit_payment_recorded"), ...result });
  } catch (error) {
    return fail(req, res, error);
  }
};

exports.writeOffInvoiceBalance = async (req, res) => {
  try {
    const { invoiceId, reason } = req.body || {};
    if (!invoiceId) return res.status(400).json({ success: false, message: req.__("invalid_request") });
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, code: "REASON_REQUIRED", message: req.__("credit_write_off_reason_required") });
    }
    const result = await writeOffInvoiceBalanceDB(req.user.tenant_id, req.params.id, invoiceId, {
      reason: String(reason).trim(),
      username: req.user.username,
    });
    emit(req, "customer_credit_update", { phone: req.params.id });
    return res.status(200).json({ success: true, message: req.__("credit_written_off"), ...result });
  } catch (error) {
    return fail(req, res, error);
  }
};

exports.setCustomerCreditLimit = async (req, res) => {
  try {
    const result = await setCustomerCreditLimitDB(req.user.tenant_id, req.params.id, req.body?.creditLimit);
    return res.status(200).json({ success: true, message: req.__("credit_limit_saved"), ...result });
  } catch (error) {
    return fail(req, res, error);
  }
};
