const { Router } = require("express");

const {
  isLoggedIn,
  isAuthenticated,
  authorize,
  isSubscriptionActive,
} = require("../middlewares/auth.middleware");
const { SCOPES } = require("../config/user.config");
const {
  getRegisterStatus,
  getRegisterSettings,
  updateRegisterSettings,
  getRegisters,
  addRegister,
  updateRegister,
  deleteRegister,
  getSuggestedFloat,
  openSession,
  getSessions,
  getSessionSummary,
  getSessionAudit,
  addCashMovement,
  handoverSession,
  closeSession,
  reopenSession,
  getDayCloseChecklist,
  closeBusinessDay,
  getBusinessDays,
  setPaymentTypeCash,
} = require("../controllers/register.controller");

const router = Router();
const base = [isLoggedIn, isAuthenticated, isSubscriptionActive];

// Operating a till (open, cash in/out, close) is part of POS; manager-only
// actions (variance approval, reopen, day close, till setup) are REGISTER_MANAGE.
const operate = authorize([SCOPES.POS, SCOPES.REGISTER_MANAGE]);
const manage = authorize([SCOPES.REGISTER_MANAGE]);
const configure = authorize([SCOPES.REGISTER_MANAGE, SCOPES.SETTINGS]);
const review = authorize([SCOPES.REGISTER_MANAGE, SCOPES.REPORTS]);

router.get("/status", ...base, operate, getRegisterStatus);

router.get("/settings", ...base, operate, getRegisterSettings);
router.put("/settings", ...base, configure, updateRegisterSettings);

router.put("/payment-types/:id/cash", ...base, configure, setPaymentTypeCash);

router.get("/registers", ...base, operate, getRegisters);
router.post("/registers", ...base, configure, addRegister);
router.put("/registers/:id", ...base, configure, updateRegister);
router.delete("/registers/:id", ...base, configure, deleteRegister);
router.get("/registers/:id/suggested-float", ...base, operate, getSuggestedFloat);

router.post("/sessions/open", ...base, operate, openSession);
router.get("/sessions", ...base, review, getSessions);
router.get("/sessions/:id/summary", ...base, authorize([SCOPES.POS, SCOPES.REGISTER_MANAGE, SCOPES.REPORTS]), getSessionSummary);
router.get("/sessions/:id/audit", ...base, review, getSessionAudit);
router.post("/sessions/:id/movements", ...base, operate, addCashMovement);
router.post("/sessions/:id/handover", ...base, operate, handoverSession);
router.post("/sessions/:id/close", ...base, operate, closeSession);
router.post("/sessions/:id/reopen", ...base, manage, reopenSession);

router.get("/day/checklist", ...base, operate, getDayCloseChecklist);
router.post("/day/close", ...base, manage, closeBusinessDay);
router.get("/days", ...base, review, getBusinessDays);

module.exports = router;
