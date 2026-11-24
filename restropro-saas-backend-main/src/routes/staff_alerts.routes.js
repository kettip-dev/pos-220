const { Router } = require("express");
const {
  isLoggedIn,
  isAuthenticated,
  authorize,
  isSubscriptionActive,
} = require("../middlewares/auth.middleware");
const { requiresSingleBusiness } = require("../middlewares/data_scope.middleware");
const { SCOPES } = require("../config/user.config");
const { getSettings, updateSettings, checkDay } = require("../controllers/staff_alerts.controller");

const router = Router();

// Owners / managers only: this is about watching staff.
const guard = [isLoggedIn, isAuthenticated, isSubscriptionActive, authorize([SCOPES.SETTINGS]), requiresSingleBusiness];

router.get("/settings", ...guard, getSettings);
router.post("/settings", ...guard, updateSettings);
router.post("/check", ...guard, checkDay);

module.exports = router;
