const { Router } = require("express");
const {
  isLoggedIn,
  isAuthenticated,
  authorize,
  isSubscriptionActive,
} = require("../middlewares/auth.middleware");
const { SCOPES } = require("../config/user.config");
const {
  getShifts,
  addShift,
  updateShift,
  deleteShift,
  getShiftSettings,
  updateShiftSettings,
  getWeeklyRoster,
  assignRosterShift,
  removeRosterShift,
  copyWeeklyRoster,
  bulkAssignRoster,
  updateRosterShift,
  clearRosterRange,
  checkMyShiftEligibility,
  getAttendanceReport,
  clockIn,
  clockOut,
  setUserQuickPin,
  verifyManagerPin,
  toggleShiftEnforcement,
} = require("../controllers/shift_roster.controller");

const router = Router();

// 1. Shift Templates
router.get(
  "/shifts",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.USER, SCOPES.SETTINGS, SCOPES.POS, SCOPES.REPORTS]),
  getShifts
);

router.post(
  "/shifts",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.USER, SCOPES.SETTINGS]),
  addShift
);

router.put(
  "/shifts/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.USER, SCOPES.SETTINGS]),
  updateShift
);

router.delete(
  "/shifts/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.USER, SCOPES.SETTINGS]),
  deleteShift
);

// 2. Shift Settings
router.get(
  "/settings",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.USER, SCOPES.SETTINGS]),
  getShiftSettings
);

router.put(
  "/settings",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.USER, SCOPES.SETTINGS]),
  updateShiftSettings
);

// 3. Weekly Roster
router.get(
  "/roster",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.USER, SCOPES.SETTINGS, SCOPES.POS, SCOPES.REPORTS]),
  getWeeklyRoster
);

router.post(
  "/roster/assign",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.USER, SCOPES.SETTINGS]),
  assignRosterShift
);

router.post(
  "/roster/bulk-assign",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.USER, SCOPES.SETTINGS]),
  bulkAssignRoster
);

router.post(
  "/roster/clear",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.USER, SCOPES.SETTINGS]),
  clearRosterRange
);

router.put(
  "/roster/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.USER, SCOPES.SETTINGS]),
  updateRosterShift
);

router.delete(
  "/roster/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.USER, SCOPES.SETTINGS]),
  removeRosterShift
);

router.post(
  "/roster/copy-week",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.USER, SCOPES.SETTINGS]),
  copyWeeklyRoster
);

// 4. Current User Eligibility Check (POS / In-Session)
router.get(
  "/my-eligibility",
  isLoggedIn,
  isAuthenticated,
  checkMyShiftEligibility
);

// 5. Attendance / Timesheet
router.get(
  "/attendance",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.USER, SCOPES.REPORTS, SCOPES.SETTINGS]),
  getAttendanceReport
);

router.post(
  "/attendance/clock-in",
  isLoggedIn,
  isAuthenticated,
  clockIn
);

router.post(
  "/attendance/clock-out",
  isLoggedIn,
  isAuthenticated,
  clockOut
);

// 6. Manager Quick PIN & Enforcement Toggles
router.post(
  "/user/pin",
  isLoggedIn,
  isAuthenticated,
  setUserQuickPin
);

router.post(
  "/verify-manager-pin",
  isLoggedIn,
  isAuthenticated,
  verifyManagerPin
);

router.post(
  "/user/toggle-enforcement",
  isLoggedIn,
  isAuthenticated,
  authorize([SCOPES.USER, SCOPES.SETTINGS]),
  toggleShiftEnforcement
);

module.exports = router;
