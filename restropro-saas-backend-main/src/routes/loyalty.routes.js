const { Router } = require("express");
const {
  isLoggedIn,
  isAuthenticated,
  authorize,
  isSubscriptionActive,
} = require("../middlewares/auth.middleware");
const { SCOPES } = require("../config/user.config");
const {
  getLoyaltySettings,
  updateLoyaltySettings,
  getCustomerLoyalty,
  getCustomerLoyaltyHistory,
  adjustCustomerPoints,
} = require("../controllers/loyalty.controller");

const router = Router();

// Tenant Loyalty Settings
router.get(
  "/settings",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS, SCOPES.POS, SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS]),
  getLoyaltySettings
);

router.post(
  "/settings",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS]),
  updateLoyaltySettings
);

// Customer Loyalty Profile & History
router.get(
  "/customer/:phone",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS]),
  getCustomerLoyalty
);

router.get(
  "/customer/:phone/history",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS]),
  getCustomerLoyaltyHistory
);

// Manager Points Adjustment
router.post(
  "/customer/:phone/adjust",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.CUSTOMERS, SCOPES.MANAGE_CUSTOMERS]),
  adjustCustomerPoints
);

module.exports = router;
