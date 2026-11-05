const {
  getOutstandingCustomersDB,
  getCustomerCreditDB,
  collectCustomerPaymentDB,
  writeOffInvoiceBalanceDB,
  setCustomerCreditLimitDB,
} = require("../services/customer_credit.service");

const fail = (req, res, error) => {
  if (error?.isRegisterError) {
    return res.status(400).json({ success: false, code: error.code, message: error.message });
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
    if (!result) return res.status(404).json({ success: false, message: "Customer not found" });
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
    return res.status(200).json({ success: true, message: "Payment recorded", ...result });
  } catch (error) {
    return fail(req, res, error);
  }
};

exports.writeOffInvoiceBalance = async (req, res) => {
  try {
    const { invoiceId, reason } = req.body || {};
    if (!invoiceId) return res.status(400).json({ success: false, message: "invoiceId is required" });
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, code: "REASON_REQUIRED", message: "Give a reason for the write-off" });
    }
    const result = await writeOffInvoiceBalanceDB(req.user.tenant_id, req.params.id, invoiceId, {
      reason: String(reason).trim(),
      username: req.user.username,
    });
    emit(req, "customer_credit_update", { phone: req.params.id });
    return res.status(200).json({ success: true, message: "Balance written off", ...result });
  } catch (error) {
    return fail(req, res, error);
  }
};

exports.setCustomerCreditLimit = async (req, res) => {
  try {
    const result = await setCustomerCreditLimitDB(req.user.tenant_id, req.params.id, req.body?.creditLimit);
    return res.status(200).json({ success: true, message: "Credit limit saved", ...result });
  } catch (error) {
    return fail(req, res, error);
  }
};
