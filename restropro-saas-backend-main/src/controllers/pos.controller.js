const { translateError } = require("./customer_credit.controller");
const {
  getCategoriesDB,
  getPaymentTypesDB,
  getPrintSettingDB,
  getMenuLanguageSettingsDB,
  getStoreSettingDB,
  getStoreTablesDB,
  getServiceChargeDB,
  rotateTablePinsByOrderIdsDB,
} = require("../services/settings.service");
const {
  getAllMenuItemsDB,
  getAllAddonsDB,
  getAllVariantsDB,
  getAllRecipeItemsDB,
} = require("../services/menu_item.service");
const { createOrderDB, getPOSQROrdersCountDB, getPOSQROrdersDB, updateQROrderStatusDB, approveQROrderDB, cancelAllQROrdersDB } = require("../services/pos.service");
const { createInvoiceDB } = require("../services/orders.service");
const { getPrinterConfigsDB, addPrinterConfigDB, updatePrinterConfigDB, deletePrinterConfigDB, buildTestPrintPayloadDB } = require("../services/printer.service");
const { submitPrintJob } = require("../services/print_job.service");
const { getPosPrintFormatDB, upsertPosPrintFormatDB } = require("../services/pos-print-format.service");
const { getSuperAdminImageStorageConfigDB } = require("../services/image_storage.service");
const { checkAvailabilityTx, resetSoldOutDB } = require("../services/menu_availability.service");
const { getMySqlPromiseConnection } = require("../config/mysql.db");

/** Tell every POS / QR screen of the tenant that item availability changed. */
function emitAvailability(req, tenantId, items) {
  if (!items || items.length === 0) return;
  const io = req.app.get("io");
  if (io) io.to(String(tenantId)).emit("menu_availability_update", { items });
}
exports.emitAvailability = emitAvailability;

function soldOutResponse(res, error) {
  return res.status(409).json({
    success: false,
    code: "ITEM_SOLD_OUT",
    message: error.message,
    soldOutItems: error.soldOutItems || [],
  });
}

async function precheckAvailability(tenantId, cart) {
  const conn = await getMySqlPromiseConnection();
  try {
    await checkAvailabilityTx(conn, tenantId, cart);
  } finally {
    conn.release();
  }
  const { precheckCartAdjustmentsDB } = require("../services/line_adjustment.service");
  await precheckCartAdjustmentsDB(tenantId, cart);
}

/** Known business-rule errors (sold out, bad approval) go back to the POS as-is. */
function knownErrorResponse(res, error) {
  if (error?.code === "ITEM_SOLD_OUT") return soldOutResponse(res, error);
  if (error?.statusCode && error?.code && String(error.code).startsWith("LINE_ADJUST")) {
    return res.status(error.statusCode).json({ success: false, code: error.code, message: error.message });
  }
  return null;
}

exports.getPOSInitData = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    // Items 86'd on a previous day come back on the first POS load of a new day.
    await resetSoldOutDB(tenantId, "stale").catch((e) => console.error("[pos] stale sold-out reset failed:", e.message));

    const [categories, paymentTypes, printSettings, storeSettings, storeTables, serviceCharge, printerConfigs, printFormat, globalStorage, menuLanguage] = await Promise.all([
      getCategoriesDB(tenantId),
      getPaymentTypesDB(true, tenantId),
      getPrintSettingDB(tenantId),
      getStoreSettingDB(tenantId),
      getStoreTablesDB(tenantId),
      getServiceChargeDB(tenantId),
      getPrinterConfigsDB(tenantId),
      getPosPrintFormatDB(tenantId),
      getSuperAdminImageStorageConfigDB(),
      getMenuLanguageSettingsDB(tenantId)
    ]);

    const [menuItems, addons, variants, recipeItems] = await Promise.all([
      getAllMenuItemsDB(tenantId),
      getAllAddonsDB(tenantId),
      getAllVariantsDB(tenantId),
      getAllRecipeItemsDB(tenantId)
    ]);

    const formattedMenuItems = menuItems.map((item) => {
      const itemAddons = addons.filter((addon) => addon.item_id == item.id && addon.is_enabled !== 0);
      const itemVariants = variants.filter(
        (variant) => variant.item_id == item.id
      );
      const itemRecipeItems = recipeItems.filter(
        (recipeItem) => recipeItem.menu_item_id == item.id
      );

      return {
        ...item,
        addons: [...itemAddons],
        variants: [...itemVariants],
        recipeItems: [...itemRecipeItems]
      };
    });

    return res.status(200).json({
      categories,
      paymentTypes,
      printSettings,
      storeSettings,
      storeTables,
      menuItems: formattedMenuItems,
      serviceCharge,
      printerConfigs,
      printFormat,
      menuLanguage,
      imageStorageConfig: globalStorage && globalStorage.status === 1 && globalStorage.credentials
        ? { publicUrl: globalStorage.credentials.public_url || null }
        : { publicUrl: null }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username;
    const {cart, deliveryType, customerType, customerId, tableId, selectedQrOrderItem, appliedPromotions, promotionDiscountTotal, customerGroupId, customerGroupName, customerGroupDiscountTotal} = req.body;

    if(cart?.length == 0) {
      return res.status(400).json({
        success: false,
        message: req.__("cart_is_empty") // Translate message
      });
    }

    const result = await createOrderDB(tenantId, cart, deliveryType, customerType, customerId?.phone || null, tableId || null, 'pending', null, username, appliedPromotions || null, promotionDiscountTotal || 0, customerGroupId || null, customerGroupName || null, customerGroupDiscountTotal || 0);
    emitAvailability(req, tenantId, result.availabilityChanges);

    if(selectedQrOrderItem) {
      await updateQROrderStatusDB(tenantId, selectedQrOrderItem, "completed", result.orderId);
    }

    return res.status(200).json({
      success: true,
      message: req.__("order_created_token", { token: result.tokenNo }), // Translate message
      tokenNo: result.tokenNo,
      orderId: result.orderId,
    });

  } catch (error) {
    const known = knownErrorResponse(res, error);
    if (known) return known;
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("error_processing_request_try_later") // Translate message
    });
  }
};


function canPrepareMenuItem(menuItem, quantity = 1) {
  const selectedVariantId = parseInt(menuItem.variant_id);
  const selectedAddonIds = (menuItem.addons_ids || []).map(String);

  const relevantRecipeItems = menuItem.recipeItems.filter((recipe) => {
    if (recipe.variant_id === 0 && recipe.addon_id === 0) return true;
    if (recipe.variant_id > 0 && recipe.variant_id == selectedVariantId) return true;
    if (recipe.addon_id > 0 && selectedAddonIds.includes(String(recipe.addon_id))) return true;
    return false;
  });

  const insufficientIngredients = [];

  for (const recipe of relevantRecipeItems) {
    const currentQty = parseFloat(recipe.current_quantity);
    const requiredQty = parseFloat(recipe.recipe_quantity) * quantity;
    if (currentQty < requiredQty) {
      insufficientIngredients.push({
        itemTitle: menuItem.title,
        variantTitle: menuItem.variant?.title || '',
        addonTitle: recipe.addon_title || '',
        ingredientTitle: recipe.ingredient_title,
        requiredQty,
        currentQty,
      });
    }
  }

  return insufficientIngredients;
}

exports.createOrderAndInvoice = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username;
    const {cart, deliveryType, customerType, customerId, tableId, netTotal, taxTotal, serviceChargeTotal, total, selectedQrOrderItem, selectedPaymentType, discountType, discountValue, discountTotal, appliedPromotions, promotionDiscountTotal, loyaltyPointsRedeemed, customerGroupId, customerGroupName, customerGroupDiscountTotal, payments, payLater} = req.body;

    if(cart?.length == 0) {
      return res.status(400).json({
        success: false,
        message: req.__("cart_is_empty") // Translate message
      });
    }

    let allInsufficientIngredients = [];

    for (const item of cart) {
      const result = canPrepareMenuItem(item, item.quantity);
      if (result.length > 0) {
        allInsufficientIngredients = [...allInsufficientIngredients, ...result];
      }
    }

    if (allInsufficientIngredients.length > 0) {
      const messages = allInsufficientIngredients.map(i =>
        `‘${i.itemTitle} ${i.variantTitle ? `(${i.variantTitle})` : ''}${i.addonTitle ? ` + ${i.addonTitle}` : ''}’ is missing '${i.ingredientTitle}' (need ${i.requiredQty}, have ${i.currentQty})`
      );

      return res.status(400).json({
        success: false,
        message: "Unavailable: Not enough stock." + "\n" + messages.join("; "),
      });
    }

    // Sold-out items must be rejected before the invoice is written.
    await precheckAvailability(tenantId, cart);

    // create invoice
    const now = new Date();
    const date = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    const custPhone = customerId?.phone || (typeof customerId === 'string' ? customerId : null);
    const invoiceId = await createInvoiceDB(netTotal, taxTotal, serviceChargeTotal, total, date, selectedPaymentType, tenantId, username, discountType || null, discountValue || 0, discountTotal || null, appliedPromotions || null, promotionDiscountTotal || 0, loyaltyPointsRedeemed || 0, custPhone, null, customerGroupId || null, customerGroupName || null, customerGroupDiscountTotal || 0, { session: req.registerSession, payments, payLater: payLater || null });
    // create invoice

    const storeSettings = await getStoreSettingDB(tenantId);
    const isKitchenDisabled = storeSettings && (storeSettings.is_kitchen_enabled === 0 || storeSettings.is_kitchen_enabled === false);
    const targetOrderStatus = isKitchenDisabled ? 'completed' : 'created';

    const result = await createOrderDB(tenantId, cart, deliveryType, customerType, custPhone, tableId || null, 'paid', invoiceId, username, appliedPromotions || null, promotionDiscountTotal || 0, customerGroupId || null, customerGroupName || null, customerGroupDiscountTotal || 0, targetOrderStatus);
    const orderId = result.orderId;
    const tokenNo = result.tokenNo;
    emitAvailability(req, tenantId, result.availabilityChanges);

    if(selectedQrOrderItem) {
      await updateQROrderStatusDB(tenantId, selectedQrOrderItem, "completed", result.orderId);
    }

    return res.status(200).json({
      success: true,
      message: req.__("order_created_token", { token: tokenNo }), // Translate message
      tokenNo,
      orderId,
      invoiceId
    });

  } catch (error) {
    const known = knownErrorResponse(res, error);
    if (known) return known;
    if (error?.isRegisterError) {
      return res.status(400).json({ success: false, code: error.code, message: translateError(req, error) });
    }
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("error_processing_request_try_later") // Translate message
    });
  }
};

exports.getPOSQROrdersCount = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    const totalQROrders = await getPOSQROrdersCountDB(tenantId);
    return res.status(200).json({
      status: true,
      totalQROrders: totalQROrders
    })
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.getPOSQROrders = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    const { kitchenOrders, kitchenOrdersItems, addons } = await getPOSQROrdersDB(tenantId);

    const formattedOrders = kitchenOrders.map((order)=>{
      const orderItems = kitchenOrdersItems.filter((oi)=>oi.order_id == order.id);

      orderItems.forEach((oi, index)=>{
        const addonsIds = oi?.addons ? JSON.parse(oi?.addons) : null;

        if(addonsIds) {
          const itemAddons = addonsIds.map((addonId)=>{
            const addon = addons.filter((a)=>a.id == addonId);
            return addon[0];
          });
          orderItems[index].addons = [...itemAddons];
        }
      });

      return {
        ...order,
        items: orderItems
      }
    })

    return res.status(200).json(formattedOrders)
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.updatePOSQROrderStatus = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const orderId = req.params.id;
    const status = req.body.status;

    if(!status) {
      return res.status(400).json({
        success: false,
        message: req.__("please_provide_required_details") // Translate message
      });
    }

    await updateQROrderStatusDB(tenantId, orderId, status);
    const io = req.app.get("io");
    if (io) {
      io.to(String(tenantId)).emit("order_update", { qrOrderId: Number(orderId), status });
      io.to(String(tenantId)).emit("table_status_update", { action: "qr_order_updated", qrOrderId: Number(orderId), status });
    }
    return res.status(200).json({
      status: true,
      message: req.__("qr_order_item_status_updated") // Translate message
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.approvePOSQROrder = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username || "Staff";
    const qrOrderId = req.params.id;

    const approved = await approveQROrderDB(tenantId, qrOrderId, username);
    emitAvailability(req, tenantId, approved.availabilityChanges);

    const io = req.app.get("io");
    if (io) {
      io.to(String(tenantId)).emit("new_order", approved.tokenNo);
      io.to(String(tenantId)).emit("order_update", {
        orderId: approved.orderId,
        qrOrderId: approved.qrOrderId,
        tableId: approved.tableId,
      });
      io.to(String(tenantId)).emit("table_status_update", {
        action: "qr_order_approved",
        orderId: approved.orderId,
        qrOrderId: approved.qrOrderId,
        tableId: approved.tableId,
      });
    }

    return res.status(200).json({
      success: true,
      status: true,
      message: req.__("order_created_token", { token: approved.tokenNo }) || `Order #${approved.tokenNo} sent to kitchen`,
      ...approved,
    });
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : req.__("something_went_wrong_try_later"),
    });
  }
};

exports.cancelAllQROrders = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const status = 'cancelled';

    await cancelAllQROrdersDB(tenantId, status);
    const io = req.app.get("io");
    if (io) {
      io.to(String(tenantId)).emit("order_update", { action: "qr_orders_cleared" });
      io.to(String(tenantId)).emit("table_status_update", { action: "qr_orders_cleared" });
    }
    return res.status(200).json({
      status: true,
      message: req.__("all_qr_order_items_cleared") // Translate message
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

// ─── Printer Config CRUD ──────────────────────────────────

exports.getPrinterConfigs = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const printerConfigs = await getPrinterConfigsDB(tenantId);
    return res.status(200).json({ success: true, printerConfigs });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.addPrinterConfig = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { name, transport, address, paper_size, is_default, is_kot_printer, auto_cut, station_id, agent_id } = req.body;

    if (!name || !transport || !address) {
      return res.status(400).json({ success: false, message: 'Name, transport, and address are required.' });
    }

    const id = await addPrinterConfigDB(tenantId, { name, transport, address, paper_size, is_default, is_kot_printer, auto_cut, station_id, agent_id });

    // Return the full updated list so the client can sync
    const printerConfigs = await getPrinterConfigsDB(tenantId);

    return res.status(200).json({ success: true, id, printerConfigs });
  } catch (error) {
    return sendPrinterError(req, res, error);
  }
};

// Validation errors (bad address, unknown agent, …) carry a user-facing
// message; anything else is an unexpected failure.
function sendPrinterError(req, res, error) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  console.error(error);
  return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
}

// Map a dispatched job to an HTTP response: printed → 200, queued/awaiting
// agent confirmation → 202, failed → 502 so existing clients treat it as an error.
function sendPrintJobResult(res, result) {
  if (result.status === "printed") return res.status(200).json({ success: true, ...result });
  if (result.status === "queued" || result.status === "sending") return res.status(202).json({ success: true, ...result });
  return res.status(502).json({ success: false, ...result });
}

exports.updatePrinterConfig = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const printerId = req.params.id;
    const updates = req.body;

    await updatePrinterConfigDB(tenantId, printerId, updates);

    const printerConfigs = await getPrinterConfigsDB(tenantId);
    return res.status(200).json({ success: true, printerConfigs });
  } catch (error) {
    return sendPrinterError(req, res, error);
  }
};

exports.deletePrinterConfig = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const printerId = req.params.id;

    await deletePrinterConfigDB(tenantId, printerId);

    const printerConfigs = await getPrinterConfigsDB(tenantId);
    return res.status(200).json({ success: true, printerConfigs });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.printToPrinter = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const printerId = req.params.id;
    const { base64Data, jobType, reference, idempotencyKey } = req.body;

    const result = await submitPrintJob(tenantId, printerId, {
      payloadBase64: base64Data,
      jobType,
      reference,
      idempotencyKey,
    });
    return sendPrintJobResult(res, result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error("Print job execution error:", error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.testPrintToPrinter = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const printerId = req.params.id;

    const { printer, base64Data } = await buildTestPrintPayloadDB(tenantId, printerId);
    const result = await submitPrintJob(tenantId, printerId, {
      payloadBase64: base64Data,
      jobType: "test",
      reference: `Test print: ${printer.name}`,
    });
    if (result.status === "printed") result.message = `Test receipt printed on ${printer.name}`;
    return sendPrintJobResult(res, result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error("Test print execution error:", error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

// ─── Receipt / KOT print formatting ───────────────────────

exports.getPosPrintFormat = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const printFormat = await getPosPrintFormatDB(tenantId);
    return res.status(200).json({ success: true, printFormat });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.updatePosPrintFormat = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const printFormat = await upsertPosPrintFormatDB(tenantId, req.body || {});
    return res.status(200).json({ success: true, printFormat });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

// ─── Menu availability (86 board) ─────────────────────────

exports.updateMenuAvailability = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const itemId = Number(req.params.id);
    const { isSoldOut, stockLimit, autoReset } = req.body || {};
    if (!itemId) {
      return res.status(400).json({ success: false, message: req.__("please_provide_required_details") });
    }
    const { setMenuItemAvailabilityDB } = require("../services/menu_availability.service");
    const item = await setMenuItemAvailabilityDB(tenantId, itemId, { isSoldOut, stockLimit, autoReset });
    emitAvailability(req, tenantId, [item]);
    return res.status(200).json({ success: true, item });
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).json({ success: false, message: error.message });
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

exports.resetMenuAvailability = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const scope = req.body?.scope === "auto" ? "auto" : "all";
    const changed = await resetSoldOutDB(tenantId, scope);
    const io = req.app.get("io");
    if (io) io.to(String(tenantId)).emit("menu_availability_update", { reset: true });
    return res.status(200).json({ success: true, changed });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
  }
};

// ─── Line comp / void / discount ──────────────────────────

// Holders of VOID_INVOICES approve their own comps/voids; others need a manager PIN.
const LINE_APPROVAL_SCOPE = require("../config/user.config").SCOPES.VOID_INVOICES;

function approvalRefusal(res, reason) {
  return res.status(403).json({
    success: false,
    code: reason,
    message: reason === "INVALID_MANAGER_PIN" ? "Invalid manager PIN." : "Manager approval required.",
  });
}

function lineAdjustError(req, res, error) {
  if (error?.statusCode && error?.code) {
    return res.status(error.statusCode).json({ success: false, code: error.code, message: error.message });
  }
  console.error(error);
  return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
}

exports.getLineAdjustmentReasons = async (req, res) => {
  const { REASON_CODES } = require("../services/line_adjustment.service");
  return res.status(200).json({ reasons: REASON_CODES });
};

/** Approve a comp/discount on an unsent cart line; returns a single-use token. */
exports.authorizeLineAdjustment = async (req, res) => {
  try {
    const { resolveManagerApproval } = require("../middlewares/register.middleware");
    const approval = await resolveManagerApproval(req, LINE_APPROVAL_SCOPE);
    if (!approval.approved) return approvalRefusal(res, approval.reason);

    const { authorizeUnsentAdjustmentDB } = require("../services/line_adjustment.service");
    const { action, reasonCode, note, itemId, itemTitle, quantity, amount, discountType, discountValue } = req.body || {};
    const result = await authorizeUnsentAdjustmentDB(req.user.tenant_id, {
      action,
      reasonCode,
      note,
      itemId,
      itemTitle,
      quantity,
      amount,
      discountType,
      discountValue,
      performedBy: req.user.username,
      approvedBy: approval.approvedBy,
    });
    return res.status(200).json({ success: true, ...result, approvedBy: approval.approvedBy });
  } catch (error) {
    return lineAdjustError(req, res, error);
  }
};

/** Void / comp / discount / undo on an item already sent to the kitchen. */
exports.adjustOrderItem = async (req, res) => {
  try {
    const { resolveManagerApproval } = require("../middlewares/register.middleware");
    const approval = await resolveManagerApproval(req, LINE_APPROVAL_SCOPE);
    if (!approval.approved) return approvalRefusal(res, approval.reason);

    const { adjustSentItemDB } = require("../services/line_adjustment.service");
    const { action, reasonCode, note, quantity, discountType, discountValue } = req.body || {};
    const result = await adjustSentItemDB(req.user.tenant_id, Number(req.params.id), {
      action,
      reasonCode,
      note,
      quantity,
      discountType,
      discountValue,
      username: req.user.username,
      approvedBy: approval.approvedBy,
    });

    const io = req.app.get("io");
    if (io) {
      const room = String(req.user.tenant_id);
      io.to(room).emit("order_update", { source: "pos", orderId: result.orderId, orderItemId: result.orderItemId, action });
      io.to(room).emit("table_status_update", { action: `item_${action}`, orderId: result.orderId });
    }
    return res.status(200).json({ success: true, ...result, approvedBy: approval.approvedBy });
  } catch (error) {
    return lineAdjustError(req, res, error);
  }
};

exports.getLineAdjustments = async (req, res) => {
  try {
    const { getLineAdjustmentsDB } = require("../services/line_adjustment.service");
    const rows = await getLineAdjustmentsDB(req.user.tenant_id, { from: req.query.from, to: req.query.to, limit: req.query.limit });
    return res.status(200).json(rows);
  } catch (error) {
    return lineAdjustError(req, res, error);
  }
};
