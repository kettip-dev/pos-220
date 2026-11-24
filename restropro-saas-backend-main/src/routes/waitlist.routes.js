const { Router } = require("express");
const { rateLimit } = require("express-rate-limit");
const { createRateLimitStore } = require("../utils/rate_limit.util");
const {
  isLoggedIn,
  isAuthenticated,
  authorize,
  isSubscriptionActive,
} = require("../middlewares/auth.middleware");
const { requiresSingleBusiness } = require("../middlewares/data_scope.middleware");
const { SCOPES } = require("../config/user.config");
const {
  getWaitlist,
  addWaitlistEntry,
  updateWaitlistEntry,
  setWaitlistStatus,
  notifyWaitlistEntry,
  deleteWaitlistEntry,
  getSmsSettings,
  updateSmsSettings,
  testSms,
  getPublicWaitlistStatus,
} = require("../controllers/waitlist.controller");

const router = Router();

// The host stand is run by reservation and POS staff.
const staffGuard = [
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.RESERVATIONS, SCOPES.MANAGE_RESERVATIONS, SCOPES.POS]),
  requiresSingleBusiness,
];

const settingsGuard = [
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS]),
  requiresSingleBusiness,
];

// Test SMS costs money: cap it.
const testSmsLimiter = rateLimit({
  max: 5,
  windowMs: 10 * 60 * 1000,
  legacyHeaders: false,
  standardHeaders: true,
  store: createRateLimitStore("sms_test"),
  message: { success: false, code: "RATE_LIMITED", message: "Too many test messages. Try again in a few minutes." },
});

// Guests' phones poll their status page.
const publicStatusLimiter = rateLimit({
  max: 120,
  windowMs: 5 * 60 * 1000,
  legacyHeaders: false,
  standardHeaders: true,
  store: createRateLimitStore("waitlist_public"),
  message: { success: false, code: "RATE_LIMITED", message: "Too many requests" },
});

router.get("/public/:code", publicStatusLimiter, getPublicWaitlistStatus);

router.get("/sms-settings", ...settingsGuard, getSmsSettings);
router.post("/sms-settings", ...settingsGuard, updateSmsSettings);
router.post("/sms-test", ...settingsGuard, testSmsLimiter, testSms);

router.get("/", ...staffGuard, getWaitlist);
router.post("/add", ...staffGuard, addWaitlistEntry);
router.post("/:id/update", ...staffGuard, updateWaitlistEntry);
router.post("/:id/status", ...staffGuard, setWaitlistStatus);
router.post("/:id/notify", ...staffGuard, notifyWaitlistEntry);
router.delete("/:id", ...staffGuard, deleteWaitlistEntry);

module.exports = router;
