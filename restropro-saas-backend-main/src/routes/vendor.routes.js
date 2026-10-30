const { Router } = require("express");
const {
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize,
} = require("../middlewares/auth.middleware");
const { requiresSingleBusiness } = require("../middlewares/data_scope.middleware");
const { SCOPES } = require("../config/user.config");

const {
  addVendor,
  getVendors,
  getVendorDetails,
  updateVendor,
  deleteVendor,
  getAllVendorsSimple,
} = require("../controllers/vendor.controller");

const router = Router();

// Simple dropdown list
router.get(
  "/simple-list",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY, SCOPES.MANAGE_INVENTORY]),
  getAllVendorsSimple
);

// Get paginated vendors
router.get(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY, SCOPES.MANAGE_INVENTORY]),
  getVendors
);

// Get single vendor details
router.get(
  "/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY, SCOPES.MANAGE_INVENTORY]),
  getVendorDetails
);

// Add vendor
router.post(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.MANAGE_INVENTORY]),
  requiresSingleBusiness,
  addVendor
);

// Update vendor
router.put(
  "/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.MANAGE_INVENTORY]),
  requiresSingleBusiness,
  updateVendor
);

// Delete vendor
router.delete(
  "/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVENTORY, SCOPES.MANAGE_INVENTORY]),
  requiresSingleBusiness,
  deleteVendor
);

module.exports = router;
