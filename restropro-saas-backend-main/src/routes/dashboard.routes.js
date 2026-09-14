const { Router } = require("express");

const {
  isLoggedIn,
  isAuthenticated,
  authorize,
  isSubscriptionActive,
} = require("../middlewares/auth.middleware");
const { SCOPES } = require("../config/user.config");
const { getDashboardData } = require("../controllers/dashboard.controller");
const {
  getMyLayout,
  saveMyLayout,
  resetMyLayout,
} = require("../controllers/dashboard_layout.controller");

const router = Router();

router.get(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.DASHBOARD]),
  getDashboardData
);

// ─── Customizable dashboard layout (per-user) ──────────────────────────────
// All authenticated users can manage their own dashboard composition,
// regardless of role — the dashboard is personal scratch space.
router.get(
  "/layout",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  getMyLayout
);

router.put(
  "/layout",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  saveMyLayout
);

router.post(
  "/layout/reset",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  resetMyLayout
);

module.exports = router;
