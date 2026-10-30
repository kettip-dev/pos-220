const { Router } = require("express");
const {
  isLoggedIn,
  isAuthenticated,
  authorize,
  isSubscriptionActive,
} = require("../middlewares/auth.middleware");
const { SCOPES } = require("../config/user.config");
const {
  getSettings,
  updateSettings,
  testConnection,
  sendManualEod,
} = require("../controllers/telegram.controller");

const router = Router();

const settingsGuard = [
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS]),
];

const eodGuard = [
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS, SCOPES.REPORTS, SCOPES.POS]),
];

router.get("/settings", ...settingsGuard, getSettings);
router.post("/settings", ...settingsGuard, updateSettings);
router.post("/test", ...settingsGuard, testConnection);
router.post("/send-eod", ...eodGuard, sendManualEod);

module.exports = router;
