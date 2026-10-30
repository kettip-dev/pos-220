const { getAllMenuItemsDB, getAllAddonsDB, getAllVariantsDB, getAllRecipeItemsDB } = require("../services/menu_item.service");
const { checkInvoiceIdDB } = require("../services/orders.service");
const {
  getStoreSettingDB,
  getCategoriesDB,
  getTenantIdFromQRCode,
  getStoreTableByEncryptedIdDB,
  getPublicStoreTablesDB,
  verifyTablePinOrTokenDB,
  placeOrderViaQrMenuDB,
  getTableLiveQrSessionDB,
  saveFeedbackDB,
  getServiceChargeDB,
} = require("../services/settings.service");
const { approveQROrderDB } = require("../services/pos.service");
const { getSuperAdminImageStorageConfigDB } = require("../services/image_storage.service");
const { createServiceRequestDB, getServiceRequestByIdDB } = require("../services/waiter.service");
const { getActivePromotions } = require("../services/promotions.service");

const QR_CALL_REASONS = ["water", "bill", "order_more", "cutlery", "condiments", "napkins", "clean_table", "complaint", "captain", "other"];

exports.getQRMenuInit = async (req, res) => {
  try {
    const qrcode = req.params.qrcode;
    const tableId = req.query.tableId;
    const sessionToken = req.query.sessionToken || req.query.token || null;

    const tenantId = await getTenantIdFromQRCode(qrcode);

    if (!tenantId) {
      return res.status(404).json({
        success: false,
        message: req.__("qr_digital_menu_not_found"),
      });
    }

    const [categories, storeSettings, storeTable, publicTables, serviceCharge, storageConfig, promotions] = await Promise.all([
      getCategoriesDB(tenantId),
      getStoreSettingDB(tenantId),
      getStoreTableByEncryptedIdDB(tenantId, tableId),
      getPublicStoreTablesDB(tenantId),
      getServiceChargeDB(tenantId),
      getSuperAdminImageStorageConfigDB(),
      getActivePromotions(tenantId),
    ]);

    const [menuItems, addons, variants, recipeItems] = await Promise.all([
      getAllMenuItemsDB(tenantId),
      getAllAddonsDB(tenantId),
      getAllVariantsDB(tenantId),
      getAllRecipeItemsDB(tenantId),
    ]);

    let isTablePinVerified = false;
    let verifiedSessionToken = null;
    let activeSessionSummary = null;

    if (storeTable && sessionToken) {
      const verification = await verifyTablePinOrTokenDB(tenantId, storeTable.id, sessionToken);
      if (verification.valid) {
        isTablePinVerified = true;
        verifiedSessionToken = verification.sessionToken;
        activeSessionSummary = await getTableLiveQrSessionDB(tenantId, storeTable.id);
      }
    }

    const formattedMenuItems = menuItems.map((item) => {
      const itemAddons = addons.filter((addon) => addon.item_id == item.id);
      const itemVariants = variants.filter((variant) => variant.item_id == item.id);
      const itemRecipeItems = recipeItems.filter((recipeItem) => recipeItem.menu_item_id == item.id);

      return {
        ...item,
        addons: [...itemAddons],
        variants: [...itemVariants],
        recipeItems: [...itemRecipeItems],
      };
    });

    let imageStorageConfig = { mode: "local", publicUrl: null };
    if (storageConfig && storageConfig.status === 1 && storageConfig.credentials) {
      imageStorageConfig = {
        mode: "cloud",
        publicUrl: storageConfig.credentials.public_url || null,
      };
    }

    return res.status(200).json({
      categories,
      storeSettings,
      menuItems: formattedMenuItems,
      storeTable,
      publicTables,
      isTablePinVerified,
      verifiedSessionToken,
      activeSessionSummary,
      serviceCharge,
      promotions: promotions || [],
      imageStorageConfig,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

exports.verifyTablePinFromQrMenu = async (req, res) => {
  try {
    const qrcode = req.params.qrcode;
    const { tableId, pin } = req.body || {};

    const tenantId = await getTenantIdFromQRCode(qrcode);
    if (!tenantId) {
      return res.status(404).json({
        success: false,
        message: req.__("qr_digital_menu_not_found"),
      });
    }

    if (!tableId || !pin) {
      return res.status(400).json({
        success: false,
        code: "INVALID_TABLE_PIN",
        message: "Please select a table and enter the 4-digit Table PIN.",
      });
    }

    const verification = await verifyTablePinOrTokenDB(tenantId, tableId, pin);
    if (!verification.valid || !verification.table) {
      return res.status(403).json({
        success: false,
        code: "INVALID_TABLE_PIN",
        message: "Invalid 4-digit Table PIN. Please check your table slip or ask your server.",
      });
    }

    const activeSessionSummary = await getTableLiveQrSessionDB(tenantId, verification.table.id);

    return res.status(200).json({
      success: true,
      storeTable: verification.table,
      sessionToken: verification.sessionToken,
      activeSessionSummary,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("error_processing_request_try_later"),
    });
  }
};

exports.placeOrderViaQrMenu = async (req, res) => {
  try {
    const qrcode = req.params.qrcode;

    const tenantId = await getTenantIdFromQRCode(qrcode);
    if (!tenantId) {
      return res.status(404).json({
        success: false,
        message: req.__("qr_digital_menu_not_found"),
      });
    }

    const storeSettings = await getStoreSettingDB(tenantId);
    if (!storeSettings?.is_qr_menu_enabled || !storeSettings?.is_qr_order_enabled) {
      return res.status(403).json({
        success: false,
        message: "QR ordering is currently disabled for this restaurant.",
      });
    }

    const { deliveryType, cartItems, customerType, customer, tableId, tablePin, sessionToken } = req.body || {};

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: req.__("cart_is_empty"),
      });
    }

    if (!tableId) {
      return res.status(400).json({
        success: false,
        code: "TABLE_REQUIRED",
        message: "Please select your table before placing an order.",
      });
    }

    // Verify 4-digit Table PIN or active Table Session Token
    const pinOrToken = sessionToken || tablePin;
    const verification = await verifyTablePinOrTokenDB(tenantId, tableId, pinOrToken);
    if (!verification.valid || !verification.table) {
      return res.status(403).json({
        success: false,
        code: "INVALID_TABLE_PIN",
        message: "Invalid or expired Table PIN. Please enter the current 4-digit PIN for your table.",
      });
    }

    const verifiedTableId = verification.table.id;
    const safeDeliveryType = deliveryType || "dinein";

    const result = await placeOrderViaQrMenuDB(
      tenantId,
      safeDeliveryType,
      cartItems,
      customerType || "WALKIN",
      customer?.phone || null,
      verifiedTableId,
      customer?.name || null
    );

    const io = req.app.get("io");
    let autoSentToKitchen = false;
    let kitchenOrderId = null;
    let tokenNo = null;

    if (Boolean(storeSettings?.is_qr_order_auto_kitchen)) {
      const approved = await approveQROrderDB(tenantId, result.orderId, null);
      autoSentToKitchen = true;
      kitchenOrderId = approved.orderId;
      tokenNo = approved.tokenNo;

      if (io) {
        io.to(String(tenantId)).emit("new_order", approved.tokenNo);
        io.to(String(tenantId)).emit("order_update", {
          orderId: approved.orderId,
          qrOrderId: result.orderId,
          tableId: verifiedTableId,
        });
        io.to(String(tenantId)).emit("table_status_update", {
          action: "new_order",
          orderId: approved.orderId,
          tableId: verifiedTableId,
        });
      }
    } else if (io) {
      io.to(String(tenantId)).emit("new_qrorder", {
        qrOrderId: result.orderId,
        tableId: verifiedTableId,
        tableTitle: verification.table.table_title,
      });
      io.to(String(tenantId)).emit("table_status_update", {
        action: "new_qrorder",
        qrOrderId: result.orderId,
        tableId: verifiedTableId,
      });
    }

    return res.status(200).json({
      success: true,
      message: req.__("order_placed_successfully"),
      orderId: result.orderId,
      kitchenOrderId,
      tokenNo,
      autoSentToKitchen,
      storeTable: verification.table,
      sessionToken: verification.sessionToken,
    });
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : req.__("error_processing_request_try_later"),
    });
  }
};

exports.getLiveTableSessionStatus = async (req, res) => {
  try {
    const qrcode = req.params.qrcode;
    const { tableId, sessionToken, qrOrderId } = req.query || {};

    const tenantId = await getTenantIdFromQRCode(qrcode);
    if (!tenantId) {
      return res.status(404).json({
        success: false,
        message: req.__("qr_digital_menu_not_found"),
      });
    }

    const [storeSettings, serviceCharge] = await Promise.all([
      getStoreSettingDB(tenantId),
      getServiceChargeDB(tenantId),
    ]);

    let verifiedTable = null;
    let isTablePinVerified = false;

    if (tableId && sessionToken) {
      const verification = await verifyTablePinOrTokenDB(tenantId, tableId, sessionToken);
      if (verification.valid) {
        verifiedTable = verification.table;
        isTablePinVerified = true;
      } else {
        verifiedTable = await getStoreTableByEncryptedIdDB(tenantId, tableId);
      }
    } else if (tableId) {
      verifiedTable = await getStoreTableByEncryptedIdDB(tenantId, tableId);
    }

    if (!isTablePinVerified && !qrOrderId) {
      return res.status(200).json({
        success: true,
        isTablePinVerified: false,
        storeTable: verifiedTable,
        kitchenOrders: [],
        pendingQrOrders: [],
        allQrOrders: [],
        serviceCharge,
        storeSettings,
      });
    }

    const sessionData = await getTableLiveQrSessionDB(
      tenantId,
      isTablePinVerified ? verifiedTable?.id : null,
      qrOrderId || null
    );

    return res.status(200).json({
      success: true,
      isTablePinVerified,
      storeTable: verifiedTable,
      ...sessionData,
      serviceCharge,
      storeSettings,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("error_processing_request_try_later"),
    });
  }
};

exports.collectFeedback = async (req, res) => {
  try {
    const qrcode = req.params.qrcode;

    const tenantId = await getTenantIdFromQRCode(qrcode);

    const {
      invoiceId: encryptedInvoiceId,
      customerId,
      name,
      phone,
      email,
      birthdate,
      food_quality,
      service,
      ambiance,
      staff_behavior,
      recommend,
      remarks,
    } = req.body;

    const averageRating =
      (Number(food_quality) + Number(service) + Number(ambiance) + Number(staff_behavior) + Number(recommend)) / 5;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: req.__("broken_link_goto_homepage"),
      });
    }

    const { invoice_id, customer_id } = await checkInvoiceIdDB(encryptedInvoiceId);

    await saveFeedbackDB(
      tenantId,
      invoice_id,
      customer_id,
      phone,
      name,
      email,
      birthdate,
      averageRating,
      food_quality,
      service,
      ambiance,
      staff_behavior,
      recommend,
      remarks
    );

    return res.status(200).json({
      success: true,
      message: req.__("feedback_saved_successfully"),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("error_processing_request_try_later"),
    });
  }
};

exports.callWaiterFromQrMenu = async (req, res) => {
  try {
    const qrcode = req.params.qrcode;
    const { tableId, reason, notes } = req.body || {};

    const tenantId = await getTenantIdFromQRCode(qrcode);
    if (!tenantId) {
      return res.status(404).json({ success: false, message: req.__("qr_digital_menu_not_found") });
    }

    let table = null;
    if (tableId) {
      table = await getStoreTableByEncryptedIdDB(tenantId, tableId);
    }

    const safeReason = QR_CALL_REASONS.includes(reason) ? reason : "other";

    const insertId = await createServiceRequestDB({
      tenantId,
      tableId: table?.id || null,
      tableTitle: table?.table_title || null,
      floor: table?.floor || null,
      reason: safeReason,
      notes: typeof notes === "string" ? notes.slice(0, 500) : null,
      raisedBy: "qrmenu",
    });

    const created = await getServiceRequestByIdDB(tenantId, insertId);

    const io = req.app.get("io");
    if (io) io.to(String(tenantId)).emit("table_call", created);

    return res.status(201).json({ success: true, request: created });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: req.__("error_processing_request_try_later") });
  }
};
