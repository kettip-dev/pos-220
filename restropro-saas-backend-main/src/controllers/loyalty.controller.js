const {
  getTenantLoyaltySettingsDB,
  updateTenantLoyaltySettingsDB,
  getCustomerLoyaltySummaryDB,
  getCustomerLoyaltyHistoryDB,
  manualAdjustPointsDB,
} = require("../services/loyalty.service");

exports.getLoyaltySettings = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const settings = await getTenantLoyaltySettingsDB(tenantId);
    return res.status(200).json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("getLoyaltySettings error:", error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

exports.updateLoyaltySettings = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const {
      is_enabled,
      points_per_dollar_spent,
      dollar_value_per_point,
      min_points_to_redeem,
      max_discount_percentage,
    } = req.body;

    const updated = await updateTenantLoyaltySettingsDB(tenantId, {
      is_enabled,
      points_per_dollar_spent,
      dollar_value_per_point,
      min_points_to_redeem,
      max_discount_percentage,
    });

    return res.status(200).json({
      success: true,
      message: "Loyalty settings saved successfully",
      settings: updated,
    });
  } catch (error) {
    console.error("updateLoyaltySettings error:", error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

exports.getCustomerLoyalty = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Customer phone is required",
      });
    }

    const summary = await getCustomerLoyaltySummaryDB(phone, tenantId);
    if (!summary) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      loyalty: summary,
    });
  } catch (error) {
    console.error("getCustomerLoyalty error:", error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

exports.getCustomerLoyaltyHistory = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { phone } = req.params;
    const { page, limit } = req.query;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Customer phone is required",
      });
    }

    const data = await getCustomerLoyaltyHistoryDB(phone, tenantId, page, limit);
    return res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error("getCustomerLoyaltyHistory error:", error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

exports.adjustCustomerPoints = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username;
    const { phone } = req.params;
    const { points, notes } = req.body;

    const deltaPoints = parseInt(points, 10);
    if (isNaN(deltaPoints) || deltaPoints === 0) {
      return res.status(400).json({
        success: false,
        message: "A valid positive or negative points amount is required",
      });
    }

    const updated = await manualAdjustPointsDB(phone, deltaPoints, notes, username, tenantId);
    return res.status(200).json({
      success: true,
      message: "Points adjusted successfully",
      loyalty: updated,
    });
  } catch (error) {
    console.error("adjustCustomerPoints error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || req.__("something_went_wrong_try_later"),
    });
  }
};
