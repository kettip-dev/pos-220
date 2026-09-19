const { Router } = require("express");
const {
  isLoggedIn,
  isAuthenticated,
  authorize,
  isSubscriptionActive,
} = require("../middlewares/auth.middleware");
const { SCOPES } = require("../config/user.config");
const {
  getKitchenStations,
  addKitchenStation,
  updateKitchenStation,
  deleteKitchenStation,
} = require("../controllers/kitchen_stations.controller");

const router = Router();

// Read kitchen stations: accessible by Settings, Kitchen, KDS, and POS users
router.get(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS, SCOPES.KITCHEN, SCOPES.KITCHEN_DISPLAY, SCOPES.POS]),
  getKitchenStations
);

// Manage kitchen stations: accessible by Settings users
router.post(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS]),
  addKitchenStation
);

router.post(
  "/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS]),
  updateKitchenStation
);

router.put(
  "/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS]),
  updateKitchenStation
);

router.delete(
  "/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS]),
  deleteKitchenStation
);

module.exports = router;
