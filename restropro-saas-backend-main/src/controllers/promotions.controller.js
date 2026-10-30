const promotionsService = require("../services/promotions.service");

exports.getPromotions = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { search, status } = req.query;
    const result = await promotionsService.getPromotions(tenantId, { search, status });
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("getPromotions error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch promotions.",
    });
  }
};

exports.getPromotionById = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const promotion = await promotionsService.getPromotionById(id, tenantId);
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: "Promotion not found.",
      });
    }
    return res.status(200).json({
      success: true,
      promotion,
    });
  } catch (error) {
    console.error("getPromotionById error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch promotion.",
    });
  }
};

exports.createPromotion = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const result = await promotionsService.createPromotion(tenantId, req.body);
    return res.status(200).json({
      success: true,
      message: "Promotion created successfully.",
      ...result,
    });
  } catch (error) {
    console.error("createPromotion error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create promotion.",
    });
  }
};

exports.updatePromotion = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const result = await promotionsService.updatePromotion(id, tenantId, req.body);
    return res.status(200).json({
      success: true,
      message: "Promotion updated successfully.",
      ...result,
    });
  } catch (error) {
    console.error("updatePromotion error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update promotion.",
    });
  }
};

exports.togglePromotionStatus = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const { is_active } = req.body;
    const result = await promotionsService.togglePromotionStatus(id, tenantId, is_active);
    return res.status(200).json({
      success: true,
      message: `Promotion ${is_active ? "activated" : "deactivated"} successfully.`,
      ...result,
    });
  } catch (error) {
    console.error("togglePromotionStatus error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to toggle promotion status.",
    });
  }
};

exports.deletePromotion = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const result = await promotionsService.deletePromotion(id, tenantId);
    return res.status(200).json({
      success: true,
      message: "Promotion deleted successfully.",
      ...result,
    });
  } catch (error) {
    console.error("deletePromotion error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to delete promotion.",
    });
  }
};

exports.getActivePromotions = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const promotions = await promotionsService.getActivePromotions(tenantId);
    return res.status(200).json({
      success: true,
      promotions,
    });
  } catch (error) {
    console.error("getActivePromotions error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch active promotions.",
    });
  }
};

exports.evaluateCart = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { cartItems, diningOption, enteredCode } = req.body;
    const result = await promotionsService.evaluateCart(tenantId, {
      cartItems,
      diningOption,
      enteredCode,
    });
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("evaluateCart error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to evaluate cart promotions.",
    });
  }
};
