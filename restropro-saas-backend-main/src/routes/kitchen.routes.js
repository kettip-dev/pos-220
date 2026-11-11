const { Router } = require("express");

const { isLoggedIn, isAuthenticated,
    authorize,
    isSubscriptionActive,
  } = require("../middlewares/auth.middleware");
  const { SCOPES } = require("../config/user.config");
const {
  getKitchenOrders,
  updateKitchenOrderItemStatus,
  bulkUpdateKitchenOrderItemStatus,
  markOrderAllItemsStatus,
  getDelayReasons,
  saveDelayReasons,
  addKitchenDelay,
} = require("../controllers/kitchen.controller");

const router = Router();
const KITCHEN_SCOPES = [SCOPES.KITCHEN, SCOPES.KITCHEN_DISPLAY];

router.get("/", isLoggedIn, isAuthenticated, isSubscriptionActive, authorize(KITCHEN_SCOPES), getKitchenOrders);
router.post("/bulk-update-status", isLoggedIn, isAuthenticated, isSubscriptionActive, authorize(KITCHEN_SCOPES), bulkUpdateKitchenOrderItemStatus);
router.post("/order/:orderId/mark-all", isLoggedIn, isAuthenticated, isSubscriptionActive, authorize(KITCHEN_SCOPES), markOrderAllItemsStatus);
// Delay reasons: the KDS reads them; owners edit them in Settings.
router.get("/delay-reasons", isLoggedIn, isAuthenticated, isSubscriptionActive, authorize([...KITCHEN_SCOPES, SCOPES.SETTINGS]), getDelayReasons);
router.put("/delay-reasons", isLoggedIn, isAuthenticated, isSubscriptionActive, authorize([SCOPES.SETTINGS]), saveDelayReasons);
router.post("/delay", isLoggedIn, isAuthenticated, isSubscriptionActive, authorize(KITCHEN_SCOPES), addKitchenDelay);
router.post("/:id", isLoggedIn, isAuthenticated, isSubscriptionActive, authorize(KITCHEN_SCOPES), updateKitchenOrderItemStatus);

module.exports = router;