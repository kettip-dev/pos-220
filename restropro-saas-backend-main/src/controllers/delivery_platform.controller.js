const {
  parsePlatformInput,
  getDeliveryPlatformsDB,
  addDeliveryPlatformDB,
  updateDeliveryPlatformDB,
  deleteDeliveryPlatformDB,
} = require("../services/delivery_platform.service");

const fail = (req, res, error) => {
  console.error(error);
  return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
};

exports.getDeliveryPlatforms = async (req, res) => {
  try {
    const activeOnly = String(req.query.active || "") === "1";
    return res.status(200).json(await getDeliveryPlatformsDB(req.user.tenant_id, { activeOnly }));
  } catch (error) {
    return fail(req, res, error);
  }
};

exports.addDeliveryPlatform = async (req, res) => {
  try {
    const { error, data } = parsePlatformInput(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const id = await addDeliveryPlatformDB(req.user.tenant_id, data);
    return res.status(200).json({ success: true, id, message: "Delivery app added" });
  } catch (error) {
    return fail(req, res, error);
  }
};

exports.updateDeliveryPlatform = async (req, res) => {
  try {
    const { error, data } = parsePlatformInput(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const ok = await updateDeliveryPlatformDB(Number(req.params.id), req.user.tenant_id, data);
    if (!ok) return res.status(404).json({ success: false, message: "Delivery app not found" });
    return res.status(200).json({ success: true, message: "Delivery app saved" });
  } catch (error) {
    return fail(req, res, error);
  }
};

exports.deleteDeliveryPlatform = async (req, res) => {
  try {
    const outcome = await deleteDeliveryPlatformDB(Number(req.params.id), req.user.tenant_id);
    if (!outcome) return res.status(404).json({ success: false, message: "Delivery app not found" });
    return res.status(200).json({
      success: true,
      outcome,
      message: outcome === "deactivated" ? "This app has past orders, so it was turned off instead of deleted" : "Delivery app deleted",
    });
  } catch (error) {
    return fail(req, res, error);
  }
};
