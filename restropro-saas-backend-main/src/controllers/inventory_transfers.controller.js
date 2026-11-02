const {
  getTransferEligibleBranchesDB,
  getStockTransfersDB,
  getStockTransferByIdDB,
  createStockTransferDB,
  dispatchDraftTransferDB,
  receiveStockTransferDB,
  cancelStockTransferDB,
} = require("../services/inventory_transfers.service");

/**
 * GET /api/v1/inventory/transfers/branches
 */
exports.getTransferEligibleBranches = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const branches = await getTransferEligibleBranchesDB(tenantId);
    return res.status(200).json({
      success: true,
      branches,
    });
  } catch (error) {
    console.error("getTransferEligibleBranches error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || req.__("failed_to_fetch_transfer_branches"),
    });
  }
};

/**
 * GET /api/v1/inventory/transfers
 */
exports.getStockTransfers = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { page, limit, search, status, direction, fromDate, toDate } = req.query;

    const data = await getStockTransfersDB(tenantId, {
      page,
      limit,
      search,
      status,
      direction,
      fromDate,
      toDate,
    });

    return res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error("getStockTransfers error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || req.__("failed_to_fetch_stock_transfers"),
    });
  }
};

/**
 * GET /api/v1/inventory/transfers/:id
 */
exports.getStockTransferById = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    const transfer = await getStockTransferByIdDB(id, tenantId);
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: req.__("stock_transfer_not_found"),
      });
    }

    return res.status(200).json({
      success: true,
      transfer,
    });
  } catch (error) {
    console.error("getStockTransferById error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || req.__("failed_to_fetch_stock_transfer"),
    });
  }
};

/**
 * POST /api/v1/inventory/transfers
 */
exports.createStockTransfer = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username || "System";
    const { to_tenant_id, transfer_date, status, notes, items } = req.body;

    if (!to_tenant_id || !transfer_date || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: req.__("provide_required_fields"),
      });
    }

    const result = await createStockTransferDB({
      tenantId,
      toTenantId: to_tenant_id,
      transferDate: transfer_date,
      status: status || "in_transit",
      notes: notes || "",
      items,
      username,
    });

    return res.status(201).json({
      success: true,
      message: req.__(result.status === "draft" ? "stock_transfer_draft_saved" : "stock_transfer_dispatched_success"),
      transfer: result,
    });
  } catch (error) {
    console.error("createStockTransfer error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || req.__("failed_to_create_stock_transfer"),
    });
  }
};

/**
 * POST /api/v1/inventory/transfers/:id/dispatch
 */
exports.dispatchDraftTransfer = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username || "System";
    const { id } = req.params;

    await dispatchDraftTransferDB(id, tenantId, username);

    return res.status(200).json({
      success: true,
      message: req.__("stock_transfer_dispatched_success"),
    });
  } catch (error) {
    console.error("dispatchDraftTransfer error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || req.__("failed_to_dispatch_stock_transfer"),
    });
  }
};

/**
 * POST /api/v1/inventory/transfers/:id/receive
 */
exports.receiveStockTransfer = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username || "System";
    const { id } = req.params;
    const { items } = req.body;

    await receiveStockTransferDB(id, tenantId, items || [], username);

    return res.status(200).json({
      success: true,
      message: req.__("stock_transfer_received_success"),
    });
  } catch (error) {
    console.error("receiveStockTransfer error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || req.__("failed_to_receive_stock_transfer"),
    });
  }
};

/**
 * POST /api/v1/inventory/transfers/:id/cancel
 */
exports.cancelStockTransfer = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username || "System";
    const { id } = req.params;

    await cancelStockTransferDB(id, tenantId, username);

    return res.status(200).json({
      success: true,
      message: req.__("stock_transfer_cancelled_success"),
    });
  } catch (error) {
    console.error("cancelStockTransfer error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || req.__("failed_to_cancel_stock_transfer"),
    });
  }
};
