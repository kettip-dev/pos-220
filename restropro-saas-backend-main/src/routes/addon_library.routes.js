const { Router } = require("express");

const {
  isLoggedIn,
  isAuthenticated,
  authorize,
  isSubscriptionActive,
} = require("../middlewares/auth.middleware");
const { SCOPES } = require("../config/user.config");
const {
  getLibraryAddons,
  createLibraryAddon,
  updateLibraryAddon,
  setLibraryAddonEnabled,
  deleteLibraryAddon,
  upsertLibraryRecipe,
  deleteLibraryRecipe,
  attachLibraryAddonToItem,
  setItemAddonPrice,
} = require("../controllers/addon_library.controller");

const router = Router();
const guard = [isLoggedIn, isAuthenticated, isSubscriptionActive, authorize([SCOPES.SETTINGS])];

/* Shared add-on library */
router.get("/", ...guard, getLibraryAddons);
router.post("/", ...guard, createLibraryAddon);
router.put("/:id", ...guard, updateLibraryAddon);
router.patch("/:id/availability", ...guard, setLibraryAddonEnabled);
router.delete("/:id", ...guard, deleteLibraryAddon);

/* Library recipe (inventory deduction for every item using the add-on) */
router.post("/:id/recipe", ...guard, upsertLibraryRecipe);
router.delete("/:id/recipe/:recipeId", ...guard, deleteLibraryRecipe);

/* Item links */
router.post("/items/:itemId/attach", ...guard, attachLibraryAddonToItem);
router.patch("/items/:itemId/price/:addonId", ...guard, setItemAddonPrice);

module.exports = router;
