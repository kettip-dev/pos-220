const { Router } = require("express");

const { isLoggedIn, isAuthenticated } = require("../middlewares/auth.middleware");
const { registerDevice, removeDevice } = require("../controllers/device.controller");

const router = Router();

// Any authenticated staff member may register their own device for push.
// No scope guard on purpose: tokens are always tied to req.user, so a user
// can only ever create/remove rows for themselves.
router.post("/", isLoggedIn, isAuthenticated, registerDevice);
router.delete("/", isLoggedIn, isAuthenticated, removeDevice);

module.exports = router;
