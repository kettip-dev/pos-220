const { Router } = require("express");

const {
  isLoggedIn,
  isAuthenticated,
  authorize,
  isSubscriptionActive,
} = require("../middlewares/auth.middleware");
const { SCOPES } = require("../config/user.config");
const {
  getPOSInitData,
  createOrder,
  createOrderAndInvoice,
  getPOSQROrdersCount,
  getPOSQROrders,
  cancelAllQROrders,
  updatePOSQROrderStatus,
  getPrinterConfigs,
  addPrinterConfig,
  updatePrinterConfig,
  deletePrinterConfig,
  getPosPrintFormat,
  updatePosPrintFormat,
} = require("../controllers/pos.controller");

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
  createOrderAndInvoice
);

router.get(
  "/qrorders/count",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS]),
  getPOSQROrdersCount
)

router.get(
  "/qrorders",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS]),
  getPOSQROrders
)

router.post(
  "/qrorders/update-status/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS]),
  updatePOSQROrderStatus
)

router.post(
  "/qrorders/cancel-all",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS]),
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
  authorize([SCOPES.POS]),
  updatePrinterConfig
);

router.delete(
  "/printers/:id",
  isLoggedIn,
  isAuthenticated,
  isSubscriptionActive,
  authorize([SCOPES.POS]),
  deletePrinterConfig
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
