const { Router } = require("express");

const { isLoggedIn, isAuthenticated, isSuperAdmin } = require("../middlewares/auth.middleware");
const {
  getBusinessGroups,
  getBusinessGroupDetails,
  createBusinessGroup,
  updateBusinessGroup,
  deleteBusinessGroup,
  getAvailableBusinesses,
  linkBusiness,
  unlinkBusiness,
  getBusinessGroupOwners,
  createBusinessGroupOwner,
  updateBusinessGroupOwnerPermission,
  updateBusinessGroupOwnerStatus,
  removeBusinessGroupOwner,
  getGroupOwnerCandidates,
  assignExistingUserAsGroupOwner,
  removeGroupOwnerCapability
} = require("../controllers/business_group.controller");

const router = Router();

// Business Groups (Phase 1) — Super Admin only.
// Every route carries the same isLoggedIn + isAuthenticated + isSuperAdmin chain
// used by the rest of the superadmin surface, so a tenant admin token is
// rejected by isSuperAdmin before any handler runs.
router.get("/", isLoggedIn, isAuthenticated, isSuperAdmin, getBusinessGroups);
router.post("/", isLoggedIn, isAuthenticated, isSuperAdmin, createBusinessGroup);

router.get("/:id", isLoggedIn, isAuthenticated, isSuperAdmin, getBusinessGroupDetails);
router.put("/:id", isLoggedIn, isAuthenticated, isSuperAdmin, updateBusinessGroup);
router.delete("/:id", isLoggedIn, isAuthenticated, isSuperAdmin, deleteBusinessGroup);

// Membership management
router.get("/:id/available-businesses", isLoggedIn, isAuthenticated, isSuperAdmin, getAvailableBusinesses);
router.post("/:id/businesses", isLoggedIn, isAuthenticated, isSuperAdmin, linkBusiness);
router.delete("/:id/businesses/:tenantId", isLoggedIn, isAuthenticated, isSuperAdmin, unlinkBusiness);

// Business Group Owners (Phase 2). Super Admin only — creating owners and
// changing their permission level is never delegated to a Business Admin or to
// the group owners themselves.
//
// POST creates a DEDICATED owner account. There is deliberately no endpoint for
// promoting an existing Business Admin or Staff user into an owner: those roles
// manage a single business, owners manage many, and combining them produces
// conflicting permissions.
//
// The identifier is :username because users.username is the table's primary key
// (there is no surrogate id column).
router.get("/:id/owners", isLoggedIn, isAuthenticated, isSuperAdmin, getBusinessGroupOwners);

// Dual-role assignment: grant group-owner capability to an EXISTING Business
// Admin without creating a user or changing their role. Mounted before the
// ":username" routes so "candidates" is not captured as a username.
router.get("/:id/owners/candidates", isLoggedIn, isAuthenticated, isSuperAdmin, getGroupOwnerCandidates);
router.post("/:id/owners/assign", isLoggedIn, isAuthenticated, isSuperAdmin, assignExistingUserAsGroupOwner);
router.delete("/:id/owners/:username/capability", isLoggedIn, isAuthenticated, isSuperAdmin, removeGroupOwnerCapability);
router.post("/:id/owners", isLoggedIn, isAuthenticated, isSuperAdmin, createBusinessGroupOwner);
router.put("/:id/owners/:username", isLoggedIn, isAuthenticated, isSuperAdmin, updateBusinessGroupOwnerPermission);
router.patch("/:id/owners/:username/status", isLoggedIn, isAuthenticated, isSuperAdmin, updateBusinessGroupOwnerStatus);
router.delete("/:id/owners/:username", isLoggedIn, isAuthenticated, isSuperAdmin, removeBusinessGroupOwner);

module.exports = router;
