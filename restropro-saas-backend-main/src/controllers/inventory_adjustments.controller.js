const {
  getStockAdjustmentsDB,
  getStockAdjustmentByIdDB,
  createStockAdjustmentDB,
  completeDraftAdjustmentDB,
  deleteStockAdjustmentDB,
} = require("../services/inventory_adjustments.service");

/**
 * GET /api/v1/inventory/adjustments
 */
exports.getStockAdjustments = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { page, limit, search, status, reason, fromDate, toDate } = req.query;

    const data = await getStockAdjustmentsDB(tenantId, {
      page,
      limit,
      search,
      status,
      reason,
      fromDate,
      toDate,
    });

    return res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error("getStockAdjustments error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || req.__("failed_to_fetch_stock_adjustments"),
    });
  }
};

/**
 * GET /api/v1/inventory/adjustments/:id
 */
exports.getStockAdjustmentById = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    const adjustment = await getStockAdjustmentByIdDB(id, tenantId);
    if (!adjustment) {
      return res.status(404).json({
        success: false,
        message: req.__("stock_adjustment_not_found"),
      });
    }

    return res.status(200).json({
      success: true,
      adjustment,
    });
  } catch (error) {
    console.error("getStockAdjustmentById error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || req.__("failed_to_fetch_stock_adjustment"),
    });
  }
};

/**
 * POST /api/v1/inventory/adjustments
 */
exports.createStockAdjustment = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username || "System";
    const { adjustment_date, reason, status, notes, items } = req.body;

    if (!adjustment_date || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: req.__("provide_required_fields"),
      });
    }

    const result = await createStockAdjustmentDB({
      tenantId,
      adjustmentDate: adjustment_date,
      reason: reason || "physical_count",
      status: status || "completed",
      notes: notes || "",
      items,
      username,
    });

    return res.status(201).json({
      success: true,
      message: req.__(result.status === "draft" ? "stock_adjustment_draft_saved" : "stock_adjustment_completed_success"),
      adjustment: result,
    });
  } catch (error) {
    console.error("createStockAdjustment error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || req.__("failed_to_create_stock_adjustment"),
    });
  }
};

/**
 * POST /api/v1/inventory/adjustments/:id/complete
 */
exports.completeDraftAdjustment = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username || "System";
    const { id } = req.params;

    await completeDraftAdjustmentDB(id, tenantId, username);

    return res.status(200).json({
      success: true,
      message: req.__("stock_adjustment_completed_success"),
    });
  } catch (error) {
    console.error("completeDraftAdjustment error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || req.__("failed_to_complete_stock_adjustment"),
    });
  }
};

/**
 * DELETE /api/v1/inventory/adjustments/:id
 */
exports.deleteStockAdjustment = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    await deleteStockAdjustmentDB(id, tenantId);

    return res.status(200).json({
      success: true,
      message: req.__("stock_adjustment_deleted_success"),
    });
  } catch (error) {
    console.error("deleteStockAdjustment error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || req.__("failed_to_delete_stock_adjustment"),
    });
  }
};
