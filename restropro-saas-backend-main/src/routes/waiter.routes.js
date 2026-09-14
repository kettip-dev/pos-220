const { Router } = require("express");

const {
  isLoggedIn,
  isAuthenticated,
  authorize,
  isSubscriptionActive,
} = require("../middlewares/auth.middleware");
const { SCOPES } = require("../config/user.config");
const {
  getPickupQueue,
  serveItem,
  bulkServeItems,
  serveOrderAll,
  listRequests,
  createRequest,
  ackRequest,
  resolveRequest,
  cancelRequest,
  getFloor,
  getMyZones,
  setMyZones,
  getTableAssignments,
  setTableAssignments,
  setTableAssignment,
} = require("../controllers/waiter.controller");

const router = Router();
const WAITER_SCOPES = [SCOPES.WAITER, SCOPES.POS, SCOPES.ORDERS];
// Managing assignments is a back-of-house task — allow settings/admin scope too.
const MANAGE_SCOPES = [SCOPES.WAITER, SCOPES.POS, SCOPES.ORDERS, SCOPES.SETTINGS];

const guard = [isLoggedIn, isAuthenticated, isSubscriptionActive, authorize(WAITER_SCOPES)];
const manageGuard = [isLoggedIn, isAuthenticated, isSubscriptionActive, authorize(MANAGE_SCOPES)];

// Pickup queue
router.get("/queue", ...guard, getPickupQueue);
router.post("/items/bulk-serve", ...guard, bulkServeItems);
router.post("/items/:id/serve", ...guard, serveItem);
router.post("/order/:orderId/serve-all", ...guard, serveOrderAll);

// Service requests
router.get("/requests", ...guard, listRequests);
router.post("/requests", ...guard, createRequest);
router.post("/requests/:id/ack", ...guard, ackRequest);
router.post("/requests/:id/resolve", ...guard, resolveRequest);
router.post("/requests/:id/cancel", ...guard, cancelRequest);

// Floor + zones
router.get("/floor", ...guard, getFloor);
router.get("/zones", ...guard, getMyZones);
router.post("/zones", ...guard, setMyZones);

// Table assignments (read by apps, written from web/management)
router.get("/assignments", ...guard, getTableAssignments);
router.post("/assignments", ...manageGuard, setTableAssignments);
router.post("/assignments/table", ...manageGuard, setTableAssignment);

module.exports = router;
