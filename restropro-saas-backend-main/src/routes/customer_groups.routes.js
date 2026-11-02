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
  getCustomerGroups,
  getCustomerGroupById,
  createCustomerGroup,
  updateCustomerGroup,
  deleteCustomerGroup,
  bulkAssignCustomers,
} = require("../controllers/customer_groups.controller");

const router = Router();

// Get all customer groups
router.get(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([
    SCOPES.CUSTOMERS,
    SCOPES.VIEW_CUSTOMERS,
    SCOPES.MANAGE_CUSTOMERS,
    SCOPES.POS,
    SCOPES.SETTINGS,
  ]),
  getCustomerGroups
);

// Get single customer group
router.get(
  "/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([
    SCOPES.CUSTOMERS,
    SCOPES.VIEW_CUSTOMERS,
    SCOPES.MANAGE_CUSTOMERS,
    SCOPES.POS,
    SCOPES.SETTINGS,
  ]),
  getCustomerGroupById
);

// Create customer group
router.post(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.CUSTOMERS, SCOPES.MANAGE_CUSTOMERS, SCOPES.SETTINGS]),
  requiresSingleBusiness,
  createCustomerGroup
);

// Update customer group
router.put(
  "/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.CUSTOMERS, SCOPES.MANAGE_CUSTOMERS, SCOPES.SETTINGS]),
  requiresSingleBusiness,
  updateCustomerGroup
);

// Delete customer group with fallback
router.delete(
  "/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.CUSTOMERS, SCOPES.MANAGE_CUSTOMERS, SCOPES.SETTINGS]),
  requiresSingleBusiness,
  deleteCustomerGroup
);

// Bulk assign customers to a group
router.post(
  "/bulk-assign",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.CUSTOMERS, SCOPES.MANAGE_CUSTOMERS]),
  requiresSingleBusiness,
  bulkAssignCustomers
);

module.exports = router;
