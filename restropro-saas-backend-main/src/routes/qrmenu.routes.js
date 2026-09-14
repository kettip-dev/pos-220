const { Router } = require("express");
const { getQRMenuInit , placeOrderViaQrMenu, collectFeedback, callWaiterFromQrMenu } = require("../controllers/qrmenu.controller");
const router = Router();

router.get(
  "/:qrcode",
  getQRMenuInit
);

router.post(
  "/:qrcode/place-order",
  placeOrderViaQrMenu
);

router.post(
  "/:qrcode/feedback",
  collectFeedback
)

router.post(
  "/:qrcode/call-waiter",
  callWaiterFromQrMenu
)

module.exports = router;
