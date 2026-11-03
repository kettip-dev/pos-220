const { Router } = require("express");

const {
  isLoggedIn,
  isAuthenticated,
  authorize,
  isSubscriptionActive,
} = require("../middlewares/auth.middleware");
const { SCOPES } = require("../config/user.config");
const { attachRegisterSessionOptional } = require("../middlewares/register.middleware");
const {
  getInvoices,
  getInvoicesInit,
  getInvoiceOrders,
  searchInvoices,
  voidInvoice,
  getRefundableItems,
  refundInvoice,
} = require("../controllers/invoice.controller");

const router = Router();

router.get(
  "/search",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVOICES, SCOPES.POS]),
  searchInvoices
);
router.get(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVOICES, SCOPES.POS]),
  getInvoices
);
router.get(
  "/init",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVOICES, SCOPES.POS]),
  getInvoicesInit
);

router.post(
  "/orders",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.INVOICES, SCOPES.POS]),
  getInvoiceOrders
);

// Deliberately not OR'd with INVOICES/POS -- void is its own permission,
// separate from being able to view/create invoices.
router.post(
  "/:id/void",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.VOID_INVOICES]),
  attachRegisterSessionOptional,
  voidInvoice
);

router.get(
  "/:id/refundable",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.REFUND_INVOICES, SCOPES.INVOICES]),
  getRefundableItems
);

// Refunding is its own permission, like void.
router.post(
  "/:id/refund",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.REFUND_INVOICES]),
  attachRegisterSessionOptional,
  refundInvoice
);

module.exports = router;
