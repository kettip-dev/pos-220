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
  updateMenuAvailability,
  resetMenuAvailability,
  getLineAdjustmentReasons,
  authorizeLineAdjustment,
  adjustOrderItem,
  getLineAdjustments,
  fireOrderItems,
  getCombos,
  saveCombo,
  deleteCombo,
} = require("../controllers/pos.controller");
const {
  getPrintAgents,
  createPrintAgent,
  regeneratePrintAgentToken,
  deletePrintAgent,
  scanPrintAgentNetwork,
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

router.post(
  "/print-agents/:id/scan",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.SETTINGS]),
  scanPrintAgentNetwork
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

// ─── Menu availability (86 board) ─────────────────────────

router.patch(
  "/menu-availability/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.SETTINGS]),
  updateMenuAvailability
);

router.post(
  "/menu-availability/reset",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.SETTINGS]),
  resetMenuAvailability
);

// ─── Line comp / void / discount ──────────────────────────

router.get(
  "/line-adjustments/reasons",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.ORDERS]),
  getLineAdjustmentReasons
);

router.post(
  "/line-adjustments/authorize",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS]),
  authorizeLineAdjustment
);

router.post(
  "/order-items/:id/adjust",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.ORDERS]),
  adjustOrderItem
);

router.get(
  "/line-adjustments",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.REPORTS, SCOPES.VIEW_INVOICE_AUDIT_LOG]),
  getLineAdjustments
);

// ─── Hold & fire courses ──────────────────────────────────

router.post(
  "/orders/:id/fire",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS, SCOPES.ORDERS, SCOPES.WAITER]),
  fireOrderItems
);

// ─── Combos / set meals ───────────────────────────────────

router.get("/combos", isLoggedIn, isAuthenticated, isSubscriptionActive, authorize([SCOPES.SETTINGS, SCOPES.POS]), getCombos);
router.post("/combos", isLoggedIn, isAuthenticated, isSubscriptionActive, authorize([SCOPES.SETTINGS]), saveCombo);
router.put("/combos/:id", isLoggedIn, isAuthenticated, isSubscriptionActive, authorize([SCOPES.SETTINGS]), saveCombo);
router.delete("/combos/:id", isLoggedIn, isAuthenticated, isSubscriptionActive, authorize([SCOPES.SETTINGS]), deleteCombo);

module.exports = router;
