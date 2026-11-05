const { translateError } = require("./customer_credit.controller");
const { getOrdersDB, updateOrderItemStatusDB, cancelOrderDB, completeOrderDB, getOrdersPaymentSummaryDB, createInvoiceDB, completeOrdersAndSaveInvoiceIdDB, getInvoiceIdFromOrderIdsDB, getEncryptedInvoiceIdDB, getCustomerPhoneFromOrderIdsDB, updateOrderCustomerDB, transferTableOrderDB, moveOrderItemsDB, splitCheckByItemsDB, createSplitSubInvoicesDB, getOrderSubInvoicesDB, settleSubInvoiceDB, cancelSplitPlanDB, mergeTablesDB, unlinkTablesDB } = require("../services/orders.service");
const {
  getPaymentTypesDB,
  getPrintSettingDB,
  getStoreSettingDB,
  getServiceChargeDB,
} = require("../services/settings.service");

exports.getOrders = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    const {kitchenOrders,kitchenOrdersItems,addons} = await getOrdersDB(tenantId);

    const formattedOrders = kitchenOrders.map((order)=>{
      const orderItems = kitchenOrdersItems.filter((oi)=>oi.order_id == order.id);

      orderItems.forEach((oi, index)=>{
        let addonsIds = [];
        try {
          addonsIds = oi?.addons ? JSON.parse(oi?.addons) : [];
        } catch (e) {
          addonsIds = [];
        }

        if (Array.isArray(addonsIds) && addonsIds.length > 0) {
          const itemAddons = addonsIds.map((addonRef)=>{
            if (typeof addonRef === 'object' && addonRef !== null) {
              return addonRef;
            }
            const found = addons.find((a) =>
              (typeof addonRef === 'number' || !isNaN(Number(addonRef)))
                ? a.id == addonRef
                : a.title?.toLowerCase() === String(addonRef).toLowerCase()
            );
            return found || { id: null, title: String(addonRef), price: 0 };
          });
          orderItems[index].addons = [...itemAddons.filter(Boolean)];
        } else {
          orderItems[index].addons = [];
        }
      });

      return {
        ...order,
        items: orderItems
      }
    })

    // group orders based on table id
    let ordersGroupedByTable = [];

    for (const order of formattedOrders) {
        const tableId = order.table_id;

        if(!tableId) {
            ordersGroupedByTable.push({
                table_id: tableId,
                table_title: order.table_title,
                floor: order.floor,
                orders: [{...order}],
                order_ids: [order.id],
            })
            continue;
        }

        const orderIndex = ordersGroupedByTable.findIndex(o=>o.table_id==tableId);
        if(orderIndex == -1) {
            ordersGroupedByTable.push({
                table_id: tableId,
                table_title: order.table_title,
                floor: order.floor,
                orders: [{...order}],
                order_ids: [order.id],
            })
        } else {
            ordersGroupedByTable[orderIndex].orders.push({...order})
            ordersGroupedByTable[orderIndex].order_ids.push(order.id)
        }
    }

    // add orders where table not present


    return res.status(200).json(ordersGroupedByTable);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.getOrdersInit = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const [paymentTypes, printSettings, storeSettings] = await Promise.all([
      getPaymentTypesDB(true, tenantId),
      getPrintSettingDB(tenantId),
      getStoreSettingDB(tenantId),
    ]);

    return res.status(200).json({
      paymentTypes,
      printSettings,
      storeSettings,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.updateKitchenOrderItemStatus = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const orderItemId = req.params.id;
    const { status } = req.body

    if(!status) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request") // Translate message
      });
    }

    await updateOrderItemStatusDB(orderItemId, status, tenantId)

    return res.status(200).json({
      success: true,
      message: req.__("order_item_status_updated") // Translate message
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.cancelKitchenOrder = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { orderIds } = req.body

    if(!orderIds || orderIds?.length == 0) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request") // Translate message
      });
    }

    await cancelOrderDB(orderIds, tenantId);

    return res.status(200).json({
      success: true,
      message: req.__("order_cancelled_successfully") // Translate message
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.completeKitchenOrder = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { orderIds } = req.body

    if(!orderIds || orderIds?.length == 0) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request") // Translate message
      });
    }

    await completeOrderDB(orderIds, tenantId);

    return res.status(200).json({
      success: true,
      message: req.__("order_completed_successfully") // Translate message
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.getOrdersPaymentSummary = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const orderIds = req.body.orderIds;

    if(!orderIds || orderIds?.length == 0) {
      return res.status(400).JSON({
        success: false,
        message: req.__("invalid_request") // Translate message
      });
    }

    const orderIdsParams = orderIds.join(",");

    const [ordersPaymentSummaryData, applicableServiceChargePercentage] = await Promise.all([
      getOrdersPaymentSummaryDB(orderIdsParams, tenantId),
      getServiceChargeDB(tenantId),
    ]);

    const { kitchenOrders, kitchenOrdersItems, addons } = ordersPaymentSummaryData;


    const formattedOrders = kitchenOrders.map((order)=>{
      const orderItems = kitchenOrdersItems.filter((oi)=>oi.order_id == order.id);

      orderItems.forEach((oi, index)=>{
        let addonsIds = [];
        try {
          addonsIds = oi?.addons ? JSON.parse(oi?.addons) : [];
        } catch (e) {
          addonsIds = [];
        }

        if (Array.isArray(addonsIds) && addonsIds.length > 0) {
          const itemAddons = addonsIds.map((addonRef)=>{
            if (typeof addonRef === 'object' && addonRef !== null) {
              return addonRef;
            }
            const found = addons.find((a) =>
              (typeof addonRef === 'number' || !isNaN(Number(addonRef)))
                ? a.id == addonRef
                : a.title?.toLowerCase() === String(addonRef).toLowerCase()
            );
            return found || { id: null, title: String(addonRef), price: 0 };
          });
          orderItems[index].addons = [...itemAddons.filter(Boolean)];
        } else {
          orderItems[index].addons = [];
        }
      });

      return {
        ...order,
        items: orderItems
      }
    })


    // calculate summary
    let subtotal = 0;
    let taxTotal = 0;
    let serviceChargeTotal = 0;
    let total = 0;

    for (const order of formattedOrders) {
      const items = order.items;

      for (let index = 0; index < items.length; index++) {
        const item = items[index];

        const { variant_price, price, tax_rate, tax_type: taxType, quantity, addons } = item;

        const taxRate = Number(tax_rate);
        let addonsTotal = 0;
        if(addons) {
          for (const addon of addons) {
            addonsTotal += Number(addon.price)
          }
        }

        const itemPrice = ((Number(variant_price?variant_price:price) + addonsTotal) * Number(quantity));

        if (taxType == "exclusive") {
          const tax = (itemPrice * taxRate) / 100;
          const priceWithTax = itemPrice + tax;

          taxTotal += tax;
          subtotal += itemPrice;
          total += priceWithTax;
        } else if (taxType == "inclusive") {
          const tax = itemPrice - (itemPrice * (100 / (100 + taxRate)));
          const priceWithoutTax = itemPrice - tax;

          taxTotal += tax;
          subtotal += priceWithoutTax;
          total += itemPrice;
        } else {
          subtotal += itemPrice;
          total += itemPrice;
        }
      }

    }

    // Calculate Total Service charge % from items total
    if (applicableServiceChargePercentage) {
      let serviceCharge = (Number(subtotal) * Number(applicableServiceChargePercentage)) / 100;
      serviceChargeTotal += serviceCharge;
      total += serviceCharge;
    }
    // calculate summary



    return res.status(200).json({
      subtotal,
      taxTotal,
      serviceChargeTotal,
      total,
      orders: formattedOrders
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.payAndCompleteKitchenOrder = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username;
    const { orderIds, subTotal, taxTotal, serviceChargeTotal, total, selectedPaymentType, discountType, discountValue, discountTotal, appliedPromotions, promotionDiscountTotal, loyaltyPointsRedeemed, customerId, customerGroupId, customerGroupName, customerGroupDiscountTotal, payments, payLater } = req.body;

    if(!orderIds || orderIds?.length == 0) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request") // Translate message
      });
    }

    let custPhone = customerId?.phone || (typeof customerId === 'string' ? customerId : null);
    if (!custPhone) {
      custPhone = await getCustomerPhoneFromOrderIdsDB(orderIds, tenantId);
    }

    const now = new Date();
    const date = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    // get invoice id
    const invoiceId = await createInvoiceDB(subTotal, taxTotal, serviceChargeTotal, total, date, selectedPaymentType, tenantId, username, discountType || null, discountValue || 0, discountTotal || null, appliedPromotions || null, promotionDiscountTotal || 0, loyaltyPointsRedeemed || 0, custPhone, orderIds[0] || null, customerGroupId || null, customerGroupName || null, customerGroupDiscountTotal || 0, { session: req.registerSession, payments, payLater: payLater || null });

    await completeOrdersAndSaveInvoiceIdDB(orderIds, invoiceId, tenantId, customerGroupId || null, customerGroupName || null, customerGroupDiscountTotal || 0);

    // get encrypted invoice id and customer id.
    const result = await getEncryptedInvoiceIdDB(invoiceId, tenantId);

    return res.status(200).json({
      success: true,
      message: req.__("order_completed_successfully"), // Translate message
      invoiceId: result?.invoice_id || null,
      invoiceNo: invoiceId,
      customerId: result?.customer_id || null,
    });
  } catch (error) {
    if (error?.isRegisterError) {
      return res.status(400).json({ success: false, code: error.code, message: translateError(req, error) });
    }
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.getInvoiceIdFromOrderId = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { orderIds } = req.body

    if(!orderIds || orderIds?.length == 0) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request") // Translate message
      });
    }

    const result = await getInvoiceIdFromOrderIdsDB(orderIds, tenantId);

    return res.status(200).json({
      invoiceId: result?.invoice_id || null,
      customerId: result?.customer_id || null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.updateOrderCustomer = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { orderId, customerPhone, customerType } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request"),
      });
    }

    await updateOrderCustomerDB(orderId, customerPhone, customerType, tenantId);

    const io = req.app.get("io");
    if (io) {
      io.to(tenantId).emit("table_status_update", { action: "customer_updated", orderId });
      io.to(tenantId).emit("order_update", { orderId });
    }

    return res.status(200).json({
      success: true,
      message: req.__("customer_updated") || "Customer updated successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"),
    });
  }
};

exports.transferTableOrder = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { sourceTableId, destinationTableId } = req.body;

    if (!sourceTableId || !destinationTableId) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request") || "Source and destination table are required",
      });
    }

    if (String(sourceTableId) === String(destinationTableId)) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request") || "Destination table cannot be the same as source table",
      });
    }

    const result = await transferTableOrderDB(sourceTableId, destinationTableId, tenantId);

    const io = req.app.get("io");
    if (io) {
      io.to(String(tenantId)).emit("table_status_update", { action: "table_transferred", sourceTableId, destinationTableId });
      io.to(String(tenantId)).emit("order_update", {});
    }

    return res.status(200).json({
      success: true,
      message: `Order successfully moved to ${result.destinationTableTitle}`,
      data: result,
    });
  } catch (error) {
    console.error("transferTableOrder controller error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || req.__("something_went_wrong_try_later"),
    });
  }
};

exports.moveOrderItems = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username;
    const { sourceOrderId, destinationTableId, items } = req.body;

    if (!sourceOrderId || !destinationTableId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request") || "Invalid items or destination table",
      });
    }

    const result = await moveOrderItemsDB(sourceOrderId, destinationTableId, items, tenantId, username);

    const io = req.app.get("io");
    if (io) {
      io.to(String(tenantId)).emit("table_status_update", { action: "items_moved" });
      io.to(String(tenantId)).emit("order_update", { orderId: sourceOrderId });
    }

    return res.status(200).json({
      success: true,
      message: "Items transferred successfully",
      data: result,
    });
  } catch (error) {
    console.error("moveOrderItems controller error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || req.__("something_went_wrong_try_later"),
    });
  }
};

exports.splitCheckByItems = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username;
    const { sourceOrderId, items } = req.body;

    if (!sourceOrderId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request") || "Select at least one item to split",
      });
    }

    const result = await splitCheckByItemsDB(sourceOrderId, items, tenantId, username);

    const io = req.app.get("io");
    if (io) {
      io.to(String(tenantId)).emit("table_status_update", { action: "check_split" });
      io.to(String(tenantId)).emit("order_update", { orderId: sourceOrderId });
    }

    return res.status(200).json({
      success: true,
      message: `Check split successfully (New Check #${result.splitTokenNo})`,
      data: result,
    });
  } catch (error) {
    console.error("splitCheckByItems controller error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || req.__("something_went_wrong_try_later"),
    });
  }
};

exports.createSplitSubInvoices = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username;
    const { orderId, splitMode, splits } = req.body;

    if (!orderId || !Array.isArray(splits) || splits.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Invalid split configuration. At least 2 splits are required.",
      });
    }

    const result = await createSplitSubInvoicesDB(tenantId, orderId, splitMode, splits, username);

    const io = req.app.get("io");
    if (io) {
      io.to(String(tenantId)).emit("table_status_update", { action: "split_created", orderId });
      io.to(String(tenantId)).emit("order_update", { orderId });
    }

    return res.status(200).json({
      success: true,
      message: "Split checks created successfully",
      data: result,
    });
  } catch (error) {
    console.error("createSplitSubInvoices error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || req.__("something_went_wrong_try_later"),
    });
  }
};

exports.getOrderSubInvoices = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const data = await getOrderSubInvoicesDB(tenantId, Number(orderId));
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("getOrderSubInvoices error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || req.__("something_went_wrong_try_later"),
    });
  }
};

exports.settleSubInvoice = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username;
    const { subInvoiceId, paymentTypeId, paymentTypeTitle, tipAmount, notes, tender, reference } = req.body;

    if (!subInvoiceId || !paymentTypeId) {
      return res.status(400).json({
        success: false,
        message: "Sub-invoice ID and payment type are required",
      });
    }

    const result = await settleSubInvoiceDB(
      tenantId,
      subInvoiceId,
      paymentTypeId,
      paymentTypeTitle,
      tipAmount,
      username,
      notes,
      req.registerSession,
      tender || null,
      reference || null
    );

    const io = req.app.get("io");
    if (io) {
      io.to(String(tenantId)).emit("table_status_update", {
        action: "sub_invoice_settled",
        subInvoiceId,
        orderId: result.orderId,
        isFullyCompleted: result.isFullyCompleted,
      });
      io.to(String(tenantId)).emit("order_update", { subInvoiceId });
    }

    return res.status(200).json({
      success: true,
      message: result.isFullyCompleted
        ? "Sub-check settled. All checks paid and order completed!"
        : "Sub-check settled successfully",
      data: result,
    });
  } catch (error) {
    console.error("settleSubInvoice error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || req.__("something_went_wrong_try_later"),
    });
  }
};

exports.cancelSplitPlan = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const result = await cancelSplitPlanDB(tenantId, orderId);

    const io = req.app.get("io");
    if (io) {
      io.to(String(tenantId)).emit("table_status_update", { action: "split_cancelled", orderId });
      io.to(String(tenantId)).emit("order_update", { orderId });
    }

    return res.status(200).json({
      success: true,
      message: "Split plan reverted successfully",
      data: result,
    });
  } catch (error) {
    console.error("cancelSplitPlan error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || req.__("something_went_wrong_try_later"),
    });
  }
};

exports.mergeTables = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username;
    const { sourceTableId, destinationTableId, floor } = req.body;

    if (!sourceTableId || !destinationTableId) {
      return res.status(400).json({
        success: false,
        message: "sourceTableId and destinationTableId are required",
      });
    }

    const result = await mergeTablesDB(sourceTableId, destinationTableId, floor, tenantId, username);

    const io = req.app.get("io");
    if (io) {
      io.to(String(tenantId)).emit("table_status_update", {
        action: "tables_merged",
        sourceTableId,
        destinationTableId,
        masterOrderId: result.masterOrderId,
      });
      if (result.masterOrderId) {
        io.to(String(tenantId)).emit("order_update", { orderId: result.masterOrderId });
      }
    }

    return res.status(200).json({
      success: true,
      message: req.__("tables.merge_updated") || "Tables merged successfully!",
      data: result,
    });
  } catch (error) {
    console.error("mergeTables controller error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || req.__("something_went_wrong_try_later"),
    });
  }
};

exports.unlinkTables = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { tableAId, tableBId, floor } = req.body;

    if (!tableAId || !tableBId) {
      return res.status(400).json({
        success: false,
        message: "tableAId and tableBId are required",
      });
    }

    const result = await unlinkTablesDB(tableAId, tableBId, floor, tenantId);

    const io = req.app.get("io");
    if (io) {
      io.to(String(tenantId)).emit("table_status_update", {
        action: "tables_unlinked",
        tableAId,
        tableBId,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Tables unlinked successfully",
      data: result,
    });
  } catch (error) {
    console.error("unlinkTables controller error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || req.__("something_went_wrong_try_later"),
    });
  }
};

