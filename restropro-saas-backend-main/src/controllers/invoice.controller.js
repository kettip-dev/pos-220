const {
  getInvoicesDB,
  getInvoiceOrdersDB,
  searchInvoicesDB,
  getInvoiceByIdDB,
  voidInvoiceDB,
  getOrderIdsForInvoiceDB,
} = require("../services/invoice.service");
const {
  getPrintSettingDB,
  getStoreSettingDB,
  getPaymentTypesDB,
  getServiceChargeDB,
} = require("../services/settings.service");
const { notifyVoidInvoice } = require("../services/notification.service");

exports.getInvoicesInit = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    const [printSettings, storeSettings, paymentTypes] = await Promise.all([
      getPrintSettingDB(tenantId),
      getStoreSettingDB(tenantId),
      getPaymentTypesDB(false, tenantId),
    ]);

    return res.status(200).json({
      printSettings,
      storeSettings,
      paymentTypes
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

/**
 * Business label for a consolidated row, from the scope the middleware already
 * resolved. No query, and nothing is added for a single business.
 */
const businessNameOf = (scope, tenantId) =>
  scope?.businessNames?.[tenantId] || `#${tenantId}`;

/**
 * Grouping key for an invoice.
 *
 * Invoice numbers are PER BUSINESS — `invoices` is keyed on (id, tenant_id) and
 * every tenant has its own row in `invoice_sequences`. So #1001 exists in each
 * business, and grouping consolidated rows by invoice_id alone would merge two
 * unrelated invoices into one. The owning business is therefore part of the key.
 */
const invoiceKey = (invoice) =>
  invoice.business_tenant_id != null
    ? `${invoice.business_tenant_id}:${invoice.invoice_id}`
    : String(invoice.invoice_id);

/**
 * Collapse the flat order-level rows into one entry per invoice, each carrying
 * its orders. Shared by the list and the search so they can never disagree
 * about how invoices are grouped.
 */
const groupInvoiceRows = (rows, scope) => {
  const invoices = [];
  // Keyed lookup rather than a linear findIndex per row: that was
  // O(rows x invoices), which shows once a list spans a whole business group.
  const indexByKey = new Map();

  for (const row of rows) {
    const {
      order_id,
      payment_status,
      token_no,
      business_tenant_id,
      ...invoiceFields
    } = row;

    const key = invoiceKey(row);

    if (!indexByKey.has(key)) {
      indexByKey.set(key, invoices.length);
      invoices.push({
        ...invoiceFields,
        // Present only when consolidating, so a single-business response stays
        // byte-identical to before Enterprise mode.
        ...(business_tenant_id != null
          ? {
            business: businessNameOf(scope, business_tenant_id),
            businessTenantId: business_tenant_id,
          }
          : {}),
        orders: [{ order_id, payment_status, token_no }],
      });
    } else {
      invoices[indexByKey.get(key)].orders.push({
        order_id,
        payment_status,
        token_no,
      });
    }
  }

  return invoices;
};

exports.getInvoices = async (req, res) => {
  try {
    const scope = req.dataScope;

    const from = req.query.from || null;
    const to = req.query.to || null;
    const type = req.query.type;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: req.__("please_provide_required_details"), // Translate message
      });
    }

    if (type == "custom") {
      if (!(from && to)) {
        return res.status(400).json({
          success: false,
          message: req.__("provide_from_to_dates"), // Translate message
        });
      }
    }

    const result = await getInvoicesDB(type, from, to, scope);

    if (result.length > 0) {
      return res.status(200).json(groupInvoiceRows(result, scope));
    } else {
      return res.status(200).json([]);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.searchInvoices = async (req, res) => {
  try {
    const scope = req.dataScope;
    const searchString = req.query.q;

    if (!searchString) {
      return res.status(400).json({
        success: false,
        message: req.__("please_provide_required_details"), // Translate message
      });
    }

    const result = await searchInvoicesDB(searchString, scope);

    if (result.length > 0) {
      return res.status(200).json(groupInvoiceRows(result, scope));
    } else {
      return res.status(200).json([]);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

const INVOICE_ACTION_ERROR_MESSAGES = {
  INVOICE_NOT_FOUND: "invoice_not_found",
  INVOICE_ALREADY_VOIDED: "invoice_already_voided",
};

exports.voidInvoice = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username;
    const invoiceId = req.params.id;
    const reason = req.body?.reason?.trim();

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: req.__("please_provide_required_details"), // Translate message
      });
    }

    const result = await voidInvoiceDB(invoiceId, tenantId, reason, username);

    // Fire-and-forget: never let a notification failure affect the void's
    // response, and never delay the response waiting on it (same contract as
    // notifyOrderReady/notifyCaptainCall).
    getOrderIdsForInvoiceDB(invoiceId, tenantId)
      .then((orderIds) =>
        notifyVoidInvoice(tenantId, {
          invoiceId,
          voidedByName: req.user.name || username,
          voidReason: reason,
          voidedAt: new Date().toISOString(),
          orderIds,
        })
      )
      .catch((err) => console.error("[push] void invoice notify failed:", err));

    return res.status(200).json({ success: true, invoice: result });
  } catch (error) {
    if (INVOICE_ACTION_ERROR_MESSAGES[error?.code]) {
      return res.status(400).json({
        success: false,
        message: req.__(INVOICE_ACTION_ERROR_MESSAGES[error.code]), // Translate message
      });
    }
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};

exports.getInvoiceOrders = async (req, res) => {
  try {
    const scope = req.dataScope;
    const orderIds = req.body.orderIds;
    const invoiceId = req.body.invoiceId;

    if (!orderIds || orderIds?.length == 0) {
      return res.status(400).json({
        success: false,
        message: req.__("invalid_request"), // Translate message
      });
    }

    // Orders are resolved FIRST and scoped to the caller's businesses. Order ids
    // are globally unique, so this is unambiguous; invoice numbers are not
    // (they restart per business), which is why the invoice is then looked up
    // against the business that actually owns these orders rather than against
    // the whole group.
    const invoiceOrdersData = await getInvoiceOrdersDB(orderIds, scope);
    const { kitchenOrders, kitchenOrdersItems, addons } = invoiceOrdersData;

    if (kitchenOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: req.__("no_records_found"),
      });
    }


    const owningTenantId = kitchenOrders[0].business_tenant_id;
    const invoiceData = await getInvoiceByIdDB(invoiceId, {
      mode: "tenant",
      tenantIds: [owningTenantId],
    });

    if (!invoiceData) {
      return res.status(404).json({
        success: false,
        message: req.__("no_records_found"),
      });
    }
    const { sub_total, tax_total, discount_total, discount_type, discount_value, service_charge_total, total, status, voided_at, voided_by, void_reason } = invoiceData;

    const formattedOrders = kitchenOrders.map(({ business_tenant_id, ...order }) => {
      // business_tenant_id is fetched for the ownership lookup above but is an
      // internal field — dropped here so a single-business response carries
      // exactly the keys it did before Enterprise mode.
      const orderItems = kitchenOrdersItems.filter(
        (oi) => oi.order_id == order.id
      );

      orderItems.forEach((oi, index) => {
        const addonsIds = oi?.addons ? JSON.parse(oi?.addons) : null;

        if (addonsIds) {
          const itemAddons = addonsIds.map((addonId) => {
            const addon = addons.filter((a) => a.id == addonId);
            return addon[0];
          });
          orderItems[index].addons = [...itemAddons];
        }
      });

      return {
        ...order,
        items: orderItems,
      };
    });

    return res.status(200).json({
      subtotal: sub_total,
      taxTotal: tax_total,
      serviceChargeTotal: service_charge_total,
      discountType: discount_type,
      discountValue: discount_value,
      discountTotal: discount_total,
      total: total,
      // Identifies the owning business on the detail view. Only added when
      // consolidating, so the single-business response is unchanged.
      ...(scope?.mode === "all"
        ? { business: businessNameOf(scope, owningTenantId), businessTenantId: owningTenantId }
        : {}),
      status: status,
      voidedAt: voided_at,
      voidedBy: voided_by,
      voidReason: void_reason,
      orders: formattedOrders,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later"), // Translate message
    });
  }
};
