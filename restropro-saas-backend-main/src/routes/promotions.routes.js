const { Router } = require("express");
const {
  isLoggedIn,
  isAuthenticated,
  authorize,
  isSubscriptionActive,
} = require("../middlewares/auth.middleware");
const { SCOPES } = require("../config/user.config");
const {
  getPromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  togglePromotionStatus,
  deletePromotion,
  getActivePromotions,
  evaluateCart,
} = require("../controllers/promotions.controller");

const router = Router();

// POS / Terminals: active promotions & cart evaluation
router.get(
  "/active",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.SETTINGS, SCOPES.DASHBOARD, SCOPES.ORDERS]),
  getActivePromotions
);

router.post(
  "/evaluate",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.SETTINGS, SCOPES.DASHBOARD, SCOPES.ORDERS]),
  evaluateCart
);

// Backoffice Management
router.get(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS, SCOPES.DASHBOARD, SCOPES.POS]),
  getPromotions
);

router.get(
  "/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS]),
  getPromotionById
);

router.post(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS]),
  createPromotion
);

router.put(
  "/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS]),
  updatePromotion
);

router.patch(
  "/:id/status",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS]),
  togglePromotionStatus
);

router.delete(
  "/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS]),
  deletePromotion
);

module.exports = router;
