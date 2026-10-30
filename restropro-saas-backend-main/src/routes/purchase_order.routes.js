const { Router } = require("express");
const {
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize,
} = require("../middlewares/auth.middleware");
const { requiresSingleBusiness } = require("../middlewares/data_scope.middleware");
const { SCOPES } = require("../config/user.config");

const {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  fulfillPurchaseOrder,
  cancelPurchaseOrder,
} = require("../controllers/purchase_order.controller");

const router = Router();

// List purchase orders
router.get(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY, SCOPES.MANAGE_INVENTORY]),
  getPurchaseOrders
);

// Get single purchase order
router.get(
  "/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY, SCOPES.MANAGE_INVENTORY]),
  getPurchaseOrderById
);

// Create purchase order
router.post(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.MANAGE_INVENTORY]),
  requiresSingleBusiness,
  createPurchaseOrder
);

// Fulfill (receive) purchase order & restock inventory
router.patch(
  "/:id/receive",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.MANAGE_INVENTORY]),
  requiresSingleBusiness,
  fulfillPurchaseOrder
);

// Cancel purchase order
router.patch(
  "/:id/cancel",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.MANAGE_INVENTORY]),
  requiresSingleBusiness,
  cancelPurchaseOrder
);

module.exports = router;
