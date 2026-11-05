const {
  getLibraryAddonsDB,
  findLibraryAddonByTitleDB,
  createLibraryAddonDB,
  updateLibraryAddonDB,
  setLibraryAddonEnabledDB,
  deleteLibraryAddonDB,
  upsertLibraryRecipeDB,
  deleteLibraryRecipeDB,
  attachLibraryAddonToItemDB,
  setItemAddonPriceDB,
} = require("../services/addon_library.service");

const serverError = (req, res, error) => {
  console.error(error);
  return res.status(500).json({
    success: false,
    message: req.__("something_went_wrong_try_later"),
  });
};

const parsePrice = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

exports.getLibraryAddons = async (req, res) => {
  try {
    const addons = await getLibraryAddonsDB(req.user.tenant_id);
    return res.status(200).json(addons);
  } catch (error) {
    return serverError(req, res, error);
  }
};

exports.createLibraryAddon = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const title = String(req.body?.title || "").trim();
    const price = parsePrice(req.body?.price);

    if (!title || Number.isNaN(price)) {
      return res.status(400).json({ success: false, message: "Please provide an add-on name and a valid price." });
    }

    const existing = await findLibraryAddonByTitleDB(tenantId, title);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `"${existing.title}" already exists in the add-on list.`,
        addon: existing,
      });
    }

    const id = await createLibraryAddonDB(tenantId, title, price);
    return res.status(200).json({ success: true, message: "Add-on created.", id });
  } catch (error) {
    return serverError(req, res, error);
  }
};

exports.updateLibraryAddon = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const id = Number(req.params.id);
    const title = String(req.body?.title || "").trim();
    const price = parsePrice(req.body?.price);

    if (!title || Number.isNaN(price)) {
      return res.status(400).json({ success: false, message: "Please provide an add-on name and a valid price." });
    }
    if (await findLibraryAddonByTitleDB(tenantId, title, id)) {
      return res.status(409).json({ success: false, message: `Another add-on is already named "${title}".` });
    }

    const affected = await updateLibraryAddonDB(tenantId, id, title, price);
    if (!affected) return res.status(404).json({ success: false, message: "Add-on not found." });

    return res.status(200).json({ success: true, message: "Add-on updated on all items." });
  } catch (error) {
    return serverError(req, res, error);
  }
};

exports.setLibraryAddonEnabled = async (req, res) => {
  try {
    const { isEnabled } = req.body || {};
    if (typeof isEnabled !== "boolean") {
      return res.status(400).json({ success: false, message: "isEnabled must be true or false." });
    }
    const affected = await setLibraryAddonEnabledDB(req.user.tenant_id, Number(req.params.id), isEnabled);
    if (!affected) return res.status(404).json({ success: false, message: "Add-on not found." });

    return res.status(200).json({
      success: true,
      message: isEnabled ? "Add-on is available again." : "Add-on hidden on every item.",
    });
  } catch (error) {
    return serverError(req, res, error);
  }
};

exports.deleteLibraryAddon = async (req, res) => {
  try {
    const affected = await deleteLibraryAddonDB(req.user.tenant_id, Number(req.params.id));
    if (!affected) return res.status(404).json({ success: false, message: "Add-on not found." });
    return res.status(200).json({ success: true, message: "Add-on deleted." });
  } catch (error) {
    return serverError(req, res, error);
  }
};

exports.upsertLibraryRecipe = async (req, res) => {
  try {
    const inventoryItemId = Number(req.body?.inventoryItemId);
    const quantity = Number(req.body?.quantity);
    if (!inventoryItemId || !Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ success: false, message: "Please select an ingredient and a quantity above 0." });
    }

    const affected = await upsertLibraryRecipeDB(
      req.user.tenant_id,
      Number(req.params.id),
      inventoryItemId,
      quantity
    );
    if (!affected) return res.status(404).json({ success: false, message: "Add-on or ingredient not found." });

    return res.status(200).json({ success: true, message: "Ingredient saved." });
  } catch (error) {
    return serverError(req, res, error);
  }
};

exports.deleteLibraryRecipe = async (req, res) => {
  try {
    const affected = await deleteLibraryRecipeDB(
      req.user.tenant_id,
      Number(req.params.id),
      Number(req.params.recipeId)
    );
    if (!affected) return res.status(404).json({ success: false, message: "Ingredient not found." });
    return res.status(200).json({ success: true, message: "Ingredient removed." });
  } catch (error) {
    return serverError(req, res, error);
  }
};

/* ── Used from the menu item page ── */

exports.attachLibraryAddonToItem = async (req, res) => {
  try {
    const addonId = await attachLibraryAddonToItemDB(
      req.user.tenant_id,
      Number(req.params.itemId),
      Number(req.body?.libraryAddonId)
    );
    if (!addonId) return res.status(404).json({ success: false, message: "Item or add-on not found." });
    return res.status(200).json({ success: true, message: "Add-on added to item.", addonId });
  } catch (error) {
    return serverError(req, res, error);
  }
};

exports.setItemAddonPrice = async (req, res) => {
  try {
    const raw = req.body?.price;
    let price = null;
    if (raw !== null && raw !== undefined && raw !== "") {
      price = parsePrice(raw);
      if (Number.isNaN(price)) {
        return res.status(400).json({ success: false, message: "Please provide a valid price." });
      }
    }

    const affected = await setItemAddonPriceDB(
      req.user.tenant_id,
      Number(req.params.itemId),
      Number(req.params.addonId),
      price
    );
    if (!affected) return res.status(404).json({ success: false, message: "Add-on not found on this item." });

    return res.status(200).json({
      success: true,
      message: price === null ? "Price reset to the add-on default." : "Item price saved.",
    });
  } catch (error) {
    return serverError(req, res, error);
  }
};
