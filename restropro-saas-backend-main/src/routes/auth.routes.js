const express = require("express");
const { signIn, signOut, getNewAccessToken, removeDeviceAccessToken, getDevices, signUp, getGoogleAuthConfig, googleSignIn, stripeProductSubscriptionLookup, stripeWebhook, getSubscriptionDetails, cancelSubscription, forgotPassword, resetPassword, paystackWebhook, getMyBusinesses, switchBusiness, createDesktopLoginCode, exchangeDesktopLoginCode } = require("../controllers/auth.controller");
const { isLoggedIn, isAuthenticated, hasRefreshToken, authorize, isGroupOwnerOrSuperAdmin } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/signin", signIn);
router.post("/signup", signUp);
router.get("/google-config", getGoogleAuthConfig);
router.post("/google", googleSignIn);
router.post("/signout", isLoggedIn, isAuthenticated, signOut);
router.post("/refresh-token", hasRefreshToken, getNewAccessToken);
router.post("/remove-device", isLoggedIn, isAuthenticated, removeDeviceAccessToken);
router.get("/devices", isLoggedIn, isAuthenticated, getDevices);

// Business Group Owner — Business Switcher (Phase 2).
// isGroupOwnerOrSuperAdmin keeps Business Admins and Staff out, so they can
// neither see nor switch businesses. Both paths are also allowlisted in
// verifyGroupOwnerScope so a read-only owner with no business selected can
// still reach them.
router.get("/my-businesses", isLoggedIn, isAuthenticated, isGroupOwnerOrSuperAdmin, getMyBusinesses);
router.post("/switch-business", isLoggedIn, isAuthenticated, isGroupOwnerOrSuperAdmin, switchBusiness);

// Desktop app "Sign in with your browser": the signed-in browser creates a
// one-time code, the app exchanges it (with its PKCE verifier) for a session.
router.post("/desktop/code", isLoggedIn, isAuthenticated, createDesktopLoginCode);
router.post("/desktop/exchange", exchangeDesktopLoginCode);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// router.get("/subscription-details", isLoggedIn, isAuthenticated, authorize([]), getSubscriptionDetails);
// router.post("/cancel-subscription", isLoggedIn, isAuthenticated, authorize([]), cancelSubscription);
router.get("/subscription-details", isLoggedIn, isAuthenticated, getSubscriptionDetails);
router.post("/cancel-subscription", isLoggedIn, isAuthenticated, cancelSubscription);

router.post("/stripe-product-lookup", isLoggedIn, isAuthenticated, stripeProductSubscriptionLookup)
router.post("/stripe-webhook", stripeWebhook)
router.post("/paystack-webhook", paystackWebhook)

module.exports = router;
