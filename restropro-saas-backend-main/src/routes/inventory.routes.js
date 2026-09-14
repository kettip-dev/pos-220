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
  addInventoryItem,
  getInventoryItems,
  updateInventoryItem,
  deleteInventoryItem,
  addInventoryItemStockMovement,
  getInventoryLogs,
  getInventoryDashboardData
} = require("../controllers/inventory.controller.js");

const router = Router();

router.post(
  "/add-item",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.MANAGE_INVENTORY]),
  requiresSingleBusiness,
  addInventoryItem
);

router.get(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY, SCOPES.MANAGE_INVENTORY]),
  getInventoryItems
);

router.put(
  "/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.MANAGE_INVENTORY]),
  requiresSingleBusiness,
  updateInventoryItem
);

router.patch(
  "/:id/add-stock-movement",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.MANAGE_INVENTORY]),
  requiresSingleBusiness,
  addInventoryItemStockMovement
);

router.delete(
  "/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.MANAGE_INVENTORY]),
  requiresSingleBusiness,
  deleteInventoryItem
);

router.get(
  "/logs",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY, SCOPES.MANAGE_INVENTORY]),
  getInventoryLogs
);

router.get(
  "/dashboard",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY, SCOPES.MANAGE_INVENTORY]),
  getInventoryDashboardData
);

module.exports = router;
