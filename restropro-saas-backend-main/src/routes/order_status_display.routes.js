const { Router } = require("express");
const { getOrderStatusDisplay } = require("../controllers/order_status_display.controller");

const router = Router();

router.get("/:qrcode", getOrderStatusDisplay);

module.exports = router;
