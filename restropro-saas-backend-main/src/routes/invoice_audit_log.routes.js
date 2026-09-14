const { Router } = require("express");

const {
  isLoggedIn,
  isAuthenticated,
  authorize,
  isSubscriptionActive,
} = require("../middlewares/auth.middleware");
const { SCOPES } = require("../config/user.config");
const { resolveDataScope } = require("../middlewares/data_scope.middleware");
const {
  getInvoiceAuditLogs,
  getInvoiceAuditLogForInvoice,
} = require("../controllers/invoice_audit_log.controller");

const router = Router();

router.get(
  "/",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.VIEW_INVOICE_AUDIT_LOG]),
  resolveDataScope,
  getInvoiceAuditLogs
);

router.get(
  "/invoice/:invoiceId",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.VIEW_INVOICE_AUDIT_LOG]),
  resolveDataScope,
  getInvoiceAuditLogForInvoice
);

module.exports = router;
