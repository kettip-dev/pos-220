const { Router } = require("express");

const {
  isLoggedIn,
  isAuthenticated,
  authorize,
  isSubscriptionActive,
} = require("../middlewares/auth.middleware");
const { requiresSingleBusiness } = require("../middlewares/data_scope.middleware");
const { SCOPES } = require("../config/user.config");
const { attachRegisterSession } = require("../middlewares/register.middleware");
const {
  getOutstandingCustomers,
  getCustomerCredit,
  collectCustomerPayment,
  writeOffInvoiceBalance,
  setCustomerCreditLimit,
} = require("../controllers/customer_credit.controller");
const {
  getCustomer360,
  updateCustomerProfileNotes,
} = require("../controllers/customer360.controller");
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
  authorize([
    SCOPES.CUSTOMERS,
    SCOPES.MANAGE_CUSTOMERS,
    SCOPES.POS,
    SCOPES.RESERVATIONS,
  ]),
  requiresSingleBusiness,
  addCustomer
);

router.get(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS, SCOPES.POS]),
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
  authorize([
    SCOPES.CUSTOMERS,
    SCOPES.VIEW_CUSTOMERS,
    SCOPES.POS,
    SCOPES.RESERVATIONS,
  ]),
  requiresSingleBusiness,
  getCustomer
);
router.get(
  "/search-by-phone-name/search",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([
    SCOPES.CUSTOMERS,
    SCOPES.VIEW_CUSTOMERS,
    SCOPES.POS,
    SCOPES.RESERVATIONS,
  ]),
  searchCustomer
);

router.post(
  "/:id/update",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.CUSTOMERS, SCOPES.MANAGE_CUSTOMERS, SCOPES.POS]),
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

// ─── Customer 360 ─────────────────────────────────────────

router.get(
  "/:id/360",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS]),
  requiresSingleBusiness,
  getCustomer360
);

// Notes/allergies are also editable from the POS so a cashier can record them at the counter.
router.post(
  "/:id/profile-notes",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.CUSTOMERS, SCOPES.MANAGE_CUSTOMERS, SCOPES.POS]),
  requiresSingleBusiness,
  updateCustomerProfileNotes
);

// ─── Pay Later (customer credit / house accounts) ─────────

const creditBase = [isLoggedIn, isAuthenticated, isSubscriptionActive];

router.get(
  "/credit/outstanding",
  ...creditBase,
  authorize([SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS, SCOPES.POS]),
  requiresSingleBusiness,
  getOutstandingCustomers
);

router.get(
  "/:id/credit",
  ...creditBase,
  authorize([SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS, SCOPES.POS]),
  requiresSingleBusiness,
  getCustomerCredit
);

// Money moves into a drawer, so the register must be open when sessions are enforced.
router.post(
  "/:id/credit/payments",
  ...creditBase,
  authorize([SCOPES.CUSTOMERS, SCOPES.MANAGE_CUSTOMERS, SCOPES.POS]),
  requiresSingleBusiness,
  attachRegisterSession,
  collectCustomerPayment
);

router.post(
  "/:id/credit/write-off",
  ...creditBase,
  authorize([SCOPES.CUSTOMERS, SCOPES.MANAGE_CUSTOMERS]),
  requiresSingleBusiness,
  writeOffInvoiceBalance
);

router.post(
  "/:id/credit-limit",
  ...creditBase,
  authorize([SCOPES.CUSTOMERS, SCOPES.MANAGE_CUSTOMERS]),
  requiresSingleBusiness,
  setCustomerCreditLimit
);

module.exports = router;
