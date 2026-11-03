const { Router } = require("express");

const {
  isLoggedIn,
  isAuthenticated,
  authorize,
  isSubscriptionActive,
} = require("../middlewares/auth.middleware");
const { SCOPES } = require("../config/user.config");
const { attachRegisterSession } = require("../middlewares/register.middleware");
const {
  getPOSInitData,
  createOrder,
  createOrderAndInvoice,
  getPOSQROrdersCount,
  getPOSQROrders,
  cancelAllQROrders,
  updatePOSQROrderStatus,
  approvePOSQROrder,
  getPrinterConfigs,
  addPrinterConfig,
  updatePrinterConfig,
  deletePrinterConfig,
  printToPrinter,
  testPrintToPrinter,
  getPosPrintFormat,
  updatePosPrintFormat,
} = require("../controllers/pos.controller");
const {
  getPrintAgents,
  createPrintAgent,
  regeneratePrintAgentToken,
  deletePrintAgent,
  getPrintJobs,
  retryPrintJob,
} = require("../controllers/print_agent.controller");

const router = Router();

router.get(
  "/init",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS]),
  getPOSInitData
);
router.post(
  "/create-order",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS]),
  createOrder
);
router.post(
  "/create-order-and-invoice",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS]),
  attachRegisterSession,
  createOrderAndInvoice
);

router.get(
  "/qrorders/count",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.SETTINGS, SCOPES.DASHBOARD]),
  getPOSQROrdersCount
)

router.get(
  "/qrorders",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.SETTINGS, SCOPES.DASHBOARD]),
  getPOSQROrders
)

router.post(
  "/qrorders/update-status/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.SETTINGS, SCOPES.DASHBOARD]),
  updatePOSQROrderStatus
)

router.post(
  "/qrorders/approve/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.SETTINGS, SCOPES.DASHBOARD]),
  approvePOSQROrder
)

router.post(
  "/qrorders/cancel-all",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.SETTINGS, SCOPES.DASHBOARD]),
  cancelAllQROrders
)

// ─── Printer Config ───────────────────────────────────────

router.get(
  "/printers",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.SETTINGS]),
  getPrinterConfigs
);

router.post(
  "/printers",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.SETTINGS]),
  addPrinterConfig
);

router.patch(
  "/printers/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.SETTINGS]),
  updatePrinterConfig
);

router.delete(
  "/printers/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.SETTINGS]),
  deletePrinterConfig
);

router.post(
  "/printers/:id/print",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.SETTINGS]),
  printToPrinter
);

router.post(
  "/printers/:id/test",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.SETTINGS]),
  testPrintToPrinter
);

// ─── Print Agents & Print Jobs ────────────────────────────

router.get(
  "/print-agents",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.SETTINGS]),
  getPrintAgents
);

router.post(
  "/print-agents",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS]),
  createPrintAgent
);

router.post(
  "/print-agents/:id/regenerate-token",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS]),
  regeneratePrintAgentToken
);

router.delete(
  "/print-agents/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS]),
  deletePrintAgent
);

router.get(
  "/print-jobs",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.SETTINGS]),
  getPrintJobs
);

router.post(
  "/print-jobs/:id/retry",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.SETTINGS]),
  retryPrintJob
);

// ─── Receipt / KOT print format ───────────────────────────

router.get(
  "/print-format",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS]),
  getPosPrintFormat
);

router.put(
  "/print-format",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS]),
  updatePosPrintFormat
);

module.exports = router;
