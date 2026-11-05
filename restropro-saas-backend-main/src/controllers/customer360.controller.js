const {
  resolveCustomerPhoneDB,
  getCustomer360DB,
  updateCustomerProfileNotesDB,
} = require("../services/customer360.service");

const notFound = (req, res, phone) =>
  res.status(404).json({ success: false, message: req.__("no_customer_found", { phone }) });

const serverError = (req, res, error) => {
  console.error("[customer-360]", error);
  return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
};

exports.getCustomer360 = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    // Accept any stored format of the number ("077…" or "+85577…").
    const phone = await resolveCustomerPhoneDB(req.params.id, tenantId);
    if (!phone) return notFound(req, res, req.params.id);

    const result = await getCustomer360DB(tenantId, phone);
    if (!result) return notFound(req, res, req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    return serverError(req, res, error);
  }
};

exports.updateCustomerProfileNotes = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const phone = await resolveCustomerPhoneDB(req.params.id, tenantId);
    if (!phone) return notFound(req, res, req.params.id);

    const { notes = "", allergies = "", tags = [] } = req.body || {};
    if (!Array.isArray(tags)) {
      return res.status(400).json({ success: false, message: req.__("customer_tags_invalid") });
    }

    const saved = await updateCustomerProfileNotesDB(tenantId, phone, { notes, allergies, tags });
    if (!saved) return notFound(req, res, req.params.id);

    return res.status(200).json({ success: true, message: req.__("customer_profile_notes_saved"), ...saved });
  } catch (error) {
    return serverError(req, res, error);
  }
};
