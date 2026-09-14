const { getTenantIdFromQRCode } = require("../services/settings.service");
const { getOrderStatusDisplayDB } = require("../services/order_status_display.service");

exports.getOrderStatusDisplay = async (req, res) => {
  try {
    const qrcode = req.params.qrcode;

    if (!qrcode) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request"),
      });
    }

    const tenantId = await getTenantIdFromQRCode(qrcode);

    if (!tenantId) {
      return res.status(404).json({
        success: false,
        message: req.__("qr_digital_menu_not_found"),
      });
    }

    const data = await getOrderStatusDisplayDB(tenantId);

    return res.status(200).json({
      success: true,
      tenantId,
      ...data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};
