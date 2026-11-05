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
      return res.status(400).json({ success: false, message: req.__("addon_library_name_price_required") });
    }

    const existing = await findLibraryAddonByTitleDB(tenantId, title);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: req.__("addon_library_exists", { name: existing.title }),
        addon: existing,
      });
    }

    const id = await createLibraryAddonDB(tenantId, title, price);
    return res.status(200).json({ success: true, message: req.__("addon_library_created"), id });
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
      return res.status(400).json({ success: false, message: req.__("addon_library_name_price_required") });
    }
    if (await findLibraryAddonByTitleDB(tenantId, title, id)) {
      return res.status(409).json({ success: false, message: req.__("addon_library_name_taken", { name: title }) });
    }

    const affected = await updateLibraryAddonDB(tenantId, id, title, price);
    if (!affected) return res.status(404).json({ success: false, message: req.__("addon_library_not_found") });

    return res.status(200).json({ success: true, message: req.__("addon_library_updated") });
  } catch (error) {
    return serverError(req, res, error);
  }
};

exports.setLibraryAddonEnabled = async (req, res) => {
  try {
    const { isEnabled } = req.body || {};
    if (typeof isEnabled !== "boolean") {
      return res.status(400).json({ success: false, message: req.__("addon_library_enabled_invalid") });
    }
    const affected = await setLibraryAddonEnabledDB(req.user.tenant_id, Number(req.params.id), isEnabled);
    if (!affected) return res.status(404).json({ success: false, message: req.__("addon_library_not_found") });

    return res.status(200).json({
      success: true,
      message: isEnabled ? req.__("addon_library_available") : req.__("addon_library_hidden_all"),
    });
  } catch (error) {
    return serverError(req, res, error);
  }
};

exports.deleteLibraryAddon = async (req, res) => {
  try {
    const affected = await deleteLibraryAddonDB(req.user.tenant_id, Number(req.params.id));
    if (!affected) return res.status(404).json({ success: false, message: req.__("addon_library_not_found") });
    return res.status(200).json({ success: true, message: req.__("addon_library_deleted") });
  } catch (error) {
    return serverError(req, res, error);
  }
};

exports.upsertLibraryRecipe = async (req, res) => {
  try {
    const inventoryItemId = Number(req.body?.inventoryItemId);
    const quantity = Number(req.body?.quantity);
    if (!inventoryItemId || !Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ success: false, message: req.__("addon_library_ingredient_required") });
    }

    const affected = await upsertLibraryRecipeDB(
      req.user.tenant_id,
      Number(req.params.id),
      inventoryItemId,
      quantity
    );
    if (!affected) return res.status(404).json({ success: false, message: req.__("addon_library_ingredient_target_not_found") });

    return res.status(200).json({ success: true, message: req.__("addon_library_ingredient_saved") });
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
    if (!affected) return res.status(404).json({ success: false, message: req.__("addon_library_ingredient_not_found") });
    return res.status(200).json({ success: true, message: req.__("addon_library_ingredient_removed") });
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
    if (!addonId) return res.status(404).json({ success: false, message: req.__("addon_library_item_or_addon_not_found") });
    return res.status(200).json({ success: true, message: req.__("addon_library_added_to_item"), addonId });
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
        return res.status(400).json({ success: false, message: req.__("addon_library_valid_price") });
      }
    }

    const affected = await setItemAddonPriceDB(
      req.user.tenant_id,
      Number(req.params.itemId),
      Number(req.params.addonId),
      price
    );
    if (!affected) return res.status(404).json({ success: false, message: req.__("addon_library_not_on_item") });

    return res.status(200).json({
      success: true,
      message: price === null ? req.__("addon_library_price_reset") : req.__("addon_library_price_saved"),
    });
  } catch (error) {
    return serverError(req, res, error);
  }
};
