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
  getTransferEligibleBranches,
  getStockTransfers,
  getStockTransferById,
  createStockTransfer,
  dispatchDraftTransfer,
  receiveStockTransfer,
  cancelStockTransfer,
} = require("../controllers/inventory_transfers.controller");

const router = Router();

// Eligible branches for inter-branch transfer
router.get(
  "/branches",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY, SCOPES.MANAGE_INVENTORY]),
  getTransferEligibleBranches
);

// List transfers
router.get(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY, SCOPES.MANAGE_INVENTORY]),
  getStockTransfers
);

// Get single transfer details
router.get(
  "/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY, SCOPES.MANAGE_INVENTORY]),
  getStockTransferById
);

// Create transfer (draft or in-transit dispatch)
router.post(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.MANAGE_INVENTORY]),
  requiresSingleBusiness,
  createStockTransfer
);

// Dispatch a draft transfer
router.post(
  "/:id/dispatch",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.MANAGE_INVENTORY]),
  requiresSingleBusiness,
  dispatchDraftTransfer
);

// Receive transfer at destination branch
router.post(
  "/:id/receive",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.MANAGE_INVENTORY]),
  requiresSingleBusiness,
  receiveStockTransfer
);

// Cancel transfer
router.post(
  "/:id/cancel",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.MANAGE_INVENTORY]),
  requiresSingleBusiness,
  cancelStockTransfer
);

module.exports = router;
