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
  addCustomer,
  getCustomers,
  updateCustomer,
  deleteCustomer,
  getCustomer,
  searchCustomer,
  getAllCustomers,
  uploadBulkCustomers,
  getCustomerInsights,
  getCustomerInvoices,
} = require("../controllers/customer.controller");

const router = Router();

router.post(
  "/add",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.MANAGE_CUSTOMERS]),
  requiresSingleBusiness,
  addCustomer
);

router.get(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS]),
  getCustomers
);

router.get(
  "/download/all",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS]),
  getAllCustomers
);

router.post(
  "/upload/bulk",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.CUSTOMERS, SCOPES.MANAGE_CUSTOMERS]),
  requiresSingleBusiness,
  uploadBulkCustomers
);

router.get(
  "/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS]),
  requiresSingleBusiness,
  getCustomer
);
router.get(
  "/search-by-phone-name/search",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS]),
  searchCustomer
);

router.post(
  "/:id/update",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.CUSTOMERS, SCOPES.MANAGE_CUSTOMERS]),
  requiresSingleBusiness,
  updateCustomer
);
router.delete(
  "/:id/delete",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.CUSTOMERS, SCOPES.MANAGE_CUSTOMERS]),
  requiresSingleBusiness,
  deleteCustomer
);

router.get(
  "/:id/insights",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS]),
  requiresSingleBusiness,
  getCustomerInsights
);

router.get(
  "/:id/invoices",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS]),
  requiresSingleBusiness,
  getCustomerInvoices
);

module.exports = router;
