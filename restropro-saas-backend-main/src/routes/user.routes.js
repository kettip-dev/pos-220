const { Router } = require("express");

const { isLoggedIn, isAuthenticated, isSubscriptionActive } = require("../middlewares/auth.middleware");
const { requiresSingleBusiness } = require("../middlewares/data_scope.middleware");
const { getAllUsers, addUser, deleteUser, updateUser, updateUserPassword, getAllScopes } = require("../controllers/user.controller");

const router = Router();

router.get("/", isLoggedIn, isAuthenticated, isSubscriptionActive, getAllUsers);
router.get("/scopes", isLoggedIn, isAuthenticated, isSubscriptionActive, getAllScopes);
router.post("/add", isLoggedIn, isAuthenticated, isSubscriptionActive, requiresSingleBusiness, addUser);
router.delete("/delete/:id", isLoggedIn, isAuthenticated, isSubscriptionActive, requiresSingleBusiness, deleteUser);
router.post("/update/:id", isLoggedIn, isAuthenticated, isSubscriptionActive, requiresSingleBusiness, updateUser);
router.post("/update-password/:id", isLoggedIn, isAuthenticated, isSubscriptionActive, requiresSingleBusiness, updateUserPassword);

module.exports = router;