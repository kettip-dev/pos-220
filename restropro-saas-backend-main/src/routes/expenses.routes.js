const { Router } = require("express");
const {
  isLoggedIn,
  isAuthenticated,
  authorize,
  isSubscriptionActive,
} = require("../middlewares/auth.middleware");
const { requiresSingleBusiness } = require("../middlewares/data_scope.middleware");
const { SCOPES } = require("../config/user.config");
const { getExpenses, addExpense, updateExpense, deleteExpense } = require("../controllers/expenses.controller");

const router = Router();

// Owners / managers: the same people who see reports or change settings.
const guard = [isLoggedIn, isAuthenticated, isSubscriptionActive, authorize([SCOPES.REPORTS, SCOPES.SETTINGS]), requiresSingleBusiness];

router.get("/", ...guard, getExpenses);
router.post("/add", ...guard, addExpense);
router.post("/:id/update", ...guard, updateExpense);
router.delete("/:id", ...guard, deleteExpense);

module.exports = router;
