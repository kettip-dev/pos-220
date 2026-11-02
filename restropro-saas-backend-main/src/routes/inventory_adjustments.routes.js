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
  getStockAdjustments,
  getStockAdjustmentById,
  createStockAdjustment,
  completeDraftAdjustment,
  deleteStockAdjustment,
} = require("../controllers/inventory_adjustments.controller");

const router = Router();

// List adjustments
router.get(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY, SCOPES.MANAGE_INVENTORY]),
  getStockAdjustments
);

// Get single adjustment voucher details
router.get(
  "/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY, SCOPES.MANAGE_INVENTORY]),
  getStockAdjustmentById
);

// Create adjustment voucher (draft or completed)
router.post(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.MANAGE_INVENTORY]),
  requiresSingleBusiness,
  createStockAdjustment
);

// Complete a draft adjustment
router.post(
  "/:id/complete",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.MANAGE_INVENTORY]),
  requiresSingleBusiness,
  completeDraftAdjustment
);

// Delete draft adjustment
router.delete(
  "/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.MANAGE_INVENTORY]),
  requiresSingleBusiness,
  deleteStockAdjustment
);

module.exports = router;
