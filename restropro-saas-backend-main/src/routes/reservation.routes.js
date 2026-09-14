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
  addReservation,
  updateReservation,
  cancelReservation,
  deleteReservation,
  searchReservation,
  getReservations,
  initReservation,
} = require("../controllers/reservation.controller");

const router = Router();

router.post(
  "/add",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.RESERVATIONS, SCOPES.MANAGE_RESERVATIONS]),
  requiresSingleBusiness,
  addReservation
);
router.post(
  "/update/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.RESERVATIONS, SCOPES.MANAGE_RESERVATIONS]),
  requiresSingleBusiness,
  updateReservation
);
router.post(
  "/cancel/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.RESERVATIONS, SCOPES.MANAGE_RESERVATIONS]),
  requiresSingleBusiness,
  cancelReservation
);
router.delete(
  "/delete/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.RESERVATIONS, SCOPES.MANAGE_RESERVATIONS]),
  requiresSingleBusiness,
  deleteReservation
);

router.get(
  "/search",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([
    SCOPES.RESERVATIONS,
    SCOPES.MANAGE_RESERVATIONS,
    SCOPES.VIEW_RESERVATIONS,
  ]),
  searchReservation
);
router.get(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([
    SCOPES.RESERVATIONS,
    SCOPES.MANAGE_RESERVATIONS,
    SCOPES.VIEW_RESERVATIONS,
  ]),
  getReservations
);

router.get(
  "/init",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([
    SCOPES.RESERVATIONS,
    SCOPES.MANAGE_RESERVATIONS,
    SCOPES.VIEW_RESERVATIONS,
  ]),
  initReservation
);


module.exports = router;
