const { Router } = require("express");
const {
  isLoggedIn,
  isAuthenticated,
  authorize,
  isSubscriptionActive,
} = require("../middlewares/auth.middleware");
const { SCOPES } = require("../config/user.config");
const {
  getPmsSettings,
  savePmsSettings,
  verifyRoom,
  getCheckedInRooms,
  postRoomCharge,
  voidRoomCharge,
  getSyncQueue,
  getUnpostedRoomCharges,
  retrySyncQueue,
  testPmsConnection,
} = require("../controllers/pms.controller");

const router = Router();

// PMS Configuration Settings
router.get(
  "/settings",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS, SCOPES.POS]),
  getPmsSettings
);

router.post(
  "/settings",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS]),
  savePmsSettings
);

router.post(
  "/settings/test",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS]),
  testPmsConnection
);

// Room Verification & Directory Lookup
router.get(
  "/verify-room",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.ORDERS, SCOPES.WAITER]),
  verifyRoom
);

router.get(
  "/checked-in-rooms",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.ORDERS, SCOPES.WAITER]),
  getCheckedInRooms
);

// Room Charge Posting & Voiding
router.get(
  "/unposted-charges",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS, SCOPES.POS, SCOPES.ORDERS]),
  getUnpostedRoomCharges
);

router.post(
  "/orders/:id/post-charge",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.ORDERS]),
  postRoomCharge
);

router.post(
  "/orders/:id/void-charge",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.ORDERS, SCOPES.VOID_INVOICES]),
  voidRoomCharge
);

// Background Retry Sync Queue
router.get(
  "/sync-queue",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS, SCOPES.POS]),
  getSyncQueue
);

router.post(
  "/sync-queue/retry",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS, SCOPES.POS]),
  retrySyncQueue
);

module.exports = router;
