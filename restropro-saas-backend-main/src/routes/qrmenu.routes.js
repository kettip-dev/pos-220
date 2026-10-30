const { Router } = require("express");
const { rateLimit } = require("express-rate-limit");
const { createRateLimitStore } = require("../utils/rate_limit.util");
const {
  getQRMenuInit,
  verifyTablePinFromQrMenu,
  placeOrderViaQrMenu,
  getLiveTableSessionStatus,
  collectFeedback,
  callWaiterFromQrMenu,
} = require("../controllers/qrmenu.controller");

const router = Router();

// Brute-force limiter for 4-digit Table PIN verification (max 10 tries per 5 min per IP)
const pinVerifyLimiter = rateLimit({
  max: 10,
  windowMs: 5 * 60 * 1000,
  legacyHeaders: false,
  standardHeaders: true,
  store: createRateLimitStore("qr_pin_verify"),
  message: {
    success: false,
    code: "RATE_LIMITED",
    message: "Too many PIN verification attempts. Please wait a few minutes or ask your server.",
  },
});

// Anti-spam limiter for QR order submissions (max 12 orders per 5 min per IP)
const placeOrderLimiter = rateLimit({
  max: 12,
  windowMs: 5 * 60 * 1000,
  legacyHeaders: false,
  standardHeaders: true,
  store: createRateLimitStore("qr_place_order"),
  message: {
    success: false,
    code: "RATE_LIMITED",
    message: "You are placing orders too quickly. Please wait a moment and try again.",
  },
});

// Cooldown limiter for Call Waiter requests (max 6 calls per 3 min per IP)
const waiterCallLimiter = rateLimit({
  max: 6,
  windowMs: 3 * 60 * 1000,
  legacyHeaders: false,
  standardHeaders: true,
  store: createRateLimitStore("qr_call_waiter"),
  message: {
    success: false,
    code: "RATE_LIMITED",
    message: "Waiter has already been notified. Please wait a moment.",
  },
});

router.get("/:qrcode", getQRMenuInit);

router.get("/:qrcode/live-status", getLiveTableSessionStatus);

router.post("/:qrcode/verify-pin", pinVerifyLimiter, verifyTablePinFromQrMenu);

router.post("/:qrcode/place-order", placeOrderLimiter, placeOrderViaQrMenu);

router.post("/:qrcode/feedback", collectFeedback);

router.post("/:qrcode/call-waiter", waiterCallLimiter, callWaiterFromQrMenu);

module.exports = router;
