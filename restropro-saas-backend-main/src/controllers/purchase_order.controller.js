const {
  createPurchaseOrderDB,
  getPurchaseOrdersDB,
  getPurchaseOrderByIdDB,
  fulfillPurchaseOrderDB,
  cancelPurchaseOrderDB,
} = require("../services/purchase_order.service");

exports.createPurchaseOrder = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.username || req.user.name || "Staff";
    const { vendorName, items } = req.body;

    if (!vendorName || !vendorName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vendor / Supplier name is required.",
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one item is required in the purchase order.",
      });
    }

    const po = await createPurchaseOrderDB(req.body, userId, tenantId);

    return res.status(201).json({
      success: true,
      message: "Purchase Order created successfully.",
      purchaseOrder: po,
    });
  } catch (error) {
    console.error("createPurchaseOrder error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create purchase order.",
    });
  }
};

exports.getPurchaseOrders = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { page = 1, perPage = 10, status, search, fromDate, toDate, vendorId } = req.query;

    const data = await getPurchaseOrdersDB(
      page,
      perPage,
      { status, search, fromDate, toDate, vendorId },
      tenantId
    );

    return res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error("getPurchaseOrders error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch purchase orders.",
    });
  }
};

exports.getPurchaseOrderById = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    const po = await getPurchaseOrderByIdDB(id, tenantId);

    if (!po) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found.",
      });
    }

    return res.status(200).json({
      success: true,
      purchaseOrder: po,
    });
  } catch (error) {
    console.error("getPurchaseOrderById error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch purchase order.",
    });
  }
};

exports.fulfillPurchaseOrder = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.username || req.user.name || "Staff";
    const { id } = req.params;

    await fulfillPurchaseOrderDB(id, userId, tenantId);

    return res.status(200).json({
      success: true,
      message: "Purchase order received and inventory restocked successfully.",
    });
  } catch (error) {
    console.error("fulfillPurchaseOrder error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to receive purchase order.",
    });
  }
};

exports.cancelPurchaseOrder = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    await cancelPurchaseOrderDB(id, tenantId);

    return res.status(200).json({
      success: true,
      message: "Purchase order cancelled successfully.",
    });
  } catch (error) {
    console.error("cancelPurchaseOrder error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to cancel purchase order.",
    });
  }
};
