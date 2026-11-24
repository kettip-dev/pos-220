const { Router } = require("express");
const {
  isLoggedIn,
  isAuthenticated,
  authorize,
  isSubscriptionActive,
} = require("../middlewares/auth.middleware");
const { requiresSingleBusiness } = require("../middlewares/data_scope.middleware");
const { SCOPES } = require("../config/user.config");
const {
  getDeliveryPlatforms,
  addDeliveryPlatform,
  updateDeliveryPlatform,
  deleteDeliveryPlatform,
} = require("../controllers/delivery_platform.controller");

const router = Router();

const base = [isLoggedIn, isAuthenticated, isSubscriptionActive];
const readGuard = [...base, authorize([SCOPES.POS, SCOPES.SETTINGS, SCOPES.REPORTS]), requiresSingleBusiness];
const settingsGuard = [...base, authorize([SCOPES.SETTINGS]), requiresSingleBusiness];

router.get("/", ...readGuard, getDeliveryPlatforms);
router.post("/add", ...settingsGuard, addDeliveryPlatform);
router.post("/:id/update", ...settingsGuard, updateDeliveryPlatform);
router.delete("/:id", ...settingsGuard, deleteDeliveryPlatform);

module.exports = router;
