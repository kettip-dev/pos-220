/**
 * Push notification service (Firebase Cloud Messaging).
 *
 * The waiter app and the owner app register device tokens; kitchen and captain
 * apps trigger notifications indirectly through their normal REST calls
 * (kitchen marks items completed, captain raises a service request).
 *
 * Two audiences share one `devices` table:
 *  - waiter alerts (ORDER_READY, CAPTAIN_CALL) route by table assignment;
 *  - owner alerts (DAY_END_RECONCILIATION, LOW_STOCK) route to admins and to
 *    users holding the matching management scope — see `sendToManagers`.
 *
 * Every public function here is fire-and-forget safe: it logs and swallows
 * errors so a Firebase outage can never fail the API request (or the nightly
 * scheduler run) that triggered the notification.
 */
const { getMessaging, getFirebaseAccessToken } = require("../config/firebase");
const { CONFIG } = require("../config");
const { SCOPES } = require("../config/user.config");
const {
  deleteDeviceTokensDB,
  getUserDeviceTokensDB,
  getTenantDeviceTokensDB,
  getManagerDeviceTokensDB,
  getAssignedWaitersForTableDB,
  getOrdersForNotificationDB,
  ORDER_NOTIFICATION_ITEM_SEPARATOR,
} = require("./device.service");

const NOTIFICATION_TYPES = {
  ORDER_READY: "ORDER_READY",
  CAPTAIN_CALL: "CAPTAIN_CALL",
  DAY_END_RECONCILIATION: "DAY_END_RECONCILIATION",
  LOW_STOCK: "LOW_STOCK",
  VOID_INVOICE: "VOID_INVOICE",
};
exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;

// Which management scope may receive each owner alert. Mirrors the scope the
// Owner App screen the notification deep-links to is itself guarded by, so a
// tap can never land on a 403.
// VOID_INVOICE is gated on VIEW_INVOICE_AUDIT_LOG (the review/oversight
// scope), not VOID_INVOICES (the act-of-voiding scope) -- this is an alert
// *about* a void for people positioned to review it, not a receipt for
// whoever just performed it.
const OWNER_ALERT_SCOPES = {
  [NOTIFICATION_TYPES.DAY_END_RECONCILIATION]: [SCOPES.REPORTS],
  [NOTIFICATION_TYPES.LOW_STOCK]: [SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY, SCOPES.MANAGE_INVENTORY],
  [NOTIFICATION_TYPES.VOID_INVOICE]: [SCOPES.VIEW_INVOICE_AUDIT_LOG],
};
exports.OWNER_ALERT_SCOPES = OWNER_ALERT_SCOPES;

// FCM error codes that mean the token is gone for good and must be purged.
const INVALID_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

// FCM data payload values must all be strings.
const toStringData = (data = {}) => {
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    out[key] = String(value);
  }
  return out;
};

/**
 * Send one notification to many device tokens and purge the tokens Firebase
 * reports as dead. Returns { successCount, failureCount } (zeros when
 * Firebase is not configured or there are no tokens).
 */
const sendToTokens = async (tokens, { title, body, data }) => {
  const uniqueTokens = [...new Set(tokens)].filter(Boolean);
  if (uniqueTokens.length === 0) return { successCount: 0, failureCount: 0 };

  // Resolves DB-configured credentials first, then .env; null when Firebase
  // is unconfigured or disabled by the superadmin -> skip sending silently.
  const messaging = await getMessaging();
  if (!messaging) return { successCount: 0, failureCount: 0 };

  const response = await messaging.sendEachForMulticast({
    tokens: uniqueTokens,
    notification: { title, body },
    data: toStringData(data),
    android: {
      priority: "high",
      notification: {
        channelId: "default",
        sound: "default",
      },
    },
    apns: {
      payload: {
        aps: { sound: "default" },
      },
    },
  });

  const invalidTokens = [];
  response.responses.forEach((res, i) => {
    if (!res.success && INVALID_TOKEN_CODES.has(res.error?.code)) {
      invalidTokens.push(uniqueTokens[i]);
    }
  });

  if (invalidTokens.length > 0) {
    const removed = await deleteDeviceTokensDB(invalidTokens).catch(() => 0);
    console.log(`[push] Purged ${removed} invalid device token(s).`);
  }

  return { successCount: response.successCount, failureCount: response.failureCount };
};
exports.sendToTokens = sendToTokens;

/** Send to every device of the given users (multi-device aware). */
exports.sendToUsers = async (tenantId, userIds, payload) => {
  try {
    const rows = await getUserDeviceTokensDB(tenantId, userIds);
    return await sendToTokens(rows.map((r) => r.fcm_token), payload);
  } catch (error) {
    console.error("[push] sendToUsers failed:", error);
    return { successCount: 0, failureCount: 0 };
  }
};

/**
 * Route a table-scoped notification to its waiters: the table's assigned
 * waiter(s) when an assignment exists, otherwise every signed-in waiter
 * device in the tenant (open venues don't use assignments).
 */
const sendToWaitersForTable = async (tenantId, tableId, payload) => {
  const assigned = tableId ? await getAssignedWaitersForTableDB(tenantId, tableId) : [];
  const rows =
    assigned.length > 0
      ? await getUserDeviceTokensDB(tenantId, assigned)
      : await getTenantDeviceTokensDB(tenantId);
  return sendToTokens(rows.map((r) => r.fcm_token), payload);
};

// A single menu title can be up to 255 chars, which would push the two names
// we show past what any launcher renders on one line. Trimming per name keeps
// the body readable and the payload comfortably inside FCM's 4KB limit.
const MAX_ITEM_TITLE_LENGTH = 28;
const ITEMS_SHOWN = 2;

const truncateItemTitle = (title) => {
  const clean = String(title || "").trim();
  return clean.length > MAX_ITEM_TITLE_LENGTH ? `${clean.slice(0, MAX_ITEM_TITLE_LENGTH - 1)}…` : clean;
};

/**
 * "Butter Naan, Paneer Tikka +3 more" — the first two items by name, then a
 * count of everything else. `itemCount` is the order's true line count, which
 * can exceed the names available if a menu item was deleted since ordering.
 */
const formatOrderItems = (itemTitles, itemCount) => {
  const titles = String(itemTitles || "")
    .split(ORDER_NOTIFICATION_ITEM_SEPARATOR)
    .map(truncateItemTitle)
    .filter(Boolean);
  if (titles.length === 0) return "";

  const total = Math.max(Number(itemCount) || 0, titles.length);
  const shown = titles.slice(0, ITEMS_SHOWN).join(", ");
  const remaining = total - Math.min(titles.length, ITEMS_SHOWN);
  return remaining > 0 ? `${shown} +${remaining} more` : shown;
};

/**
 * Kitchen -> Waiter: order (items) marked completed / ready for pickup.
 * The kitchen controller only knows item ids or an order id, so resolve the
 * affected orders + tables here, then notify each order's waiter.
 *
 * The title identifies *where* the order goes (dine-in table or a takeaway
 * token) and the body says *what* is on it, so a waiter can act on the push
 * without opening the app.
 */
exports.notifyOrderReady = async (tenantId, { orderId, orderItemIds }) => {
  try {
    const orders = await getOrdersForNotificationDB(tenantId, { orderId, orderItemIds });
    for (const order of orders) {
      // Orders predating token sequencing can have a null token_no; fall back
      // to the order id so the title never reads "Token #null".
      const token = order.token_no ?? order.id;
      const title = order.table_title
        ? `🍽️ Table ${order.table_title} • Token #${token}`
        : `🛍️ Token #${token}`;
      const items = formatOrderItems(order.item_titles, order.item_count);

      const body = items
        ? (order.item_count > 1 ? `Items ready: ${items}.` : `Item ready: ${items}.`)
        : "Order item is ready.";

      const result = await sendToWaitersForTable(tenantId, order.table_id, {
        title,
        body,
        data: {
          type: NOTIFICATION_TYPES.ORDER_READY,
          orderId: order.id,
          tableId: order.table_id,
          tokenNumber: order.token_no,
          restaurantId: tenantId,
        },
      });
      console.log(
        `[push] ORDER_READY order=${order.id} sent=${result.successCount} failed=${result.failureCount}`
      );
    }
  } catch (error) {
    console.error("[push] notifyOrderReady failed:", error);
  }
};

/** Captain -> Waiter: captain calls the waiter (service request). */
exports.notifyCaptainCall = async (tenantId, { requestId, tableId, tableTitle }) => {
  try {
    const result = await sendToWaitersForTable(tenantId, tableId, {
      title: "Captain Call",
      body: tableTitle ? `Captain is calling you to Table ${tableTitle}.` : "Captain is calling you.",
      data: {
        type: NOTIFICATION_TYPES.CAPTAIN_CALL,
        requestId,
        tableId,
        restaurantId: tenantId,
      },
    });
    console.log(
      `[push] CAPTAIN_CALL request=${requestId} sent=${result.successCount} failed=${result.failureCount}`
    );
  } catch (error) {
    console.error("[push] notifyCaptainCall failed:", error);
  }
};

/* ------------------------------------------------------------------------ *
 * Owner App alerts
 * ------------------------------------------------------------------------ */

/**
 * Send an owner alert to the tenant's owner/manager devices only. The audience
 * is derived from the notification type via OWNER_ALERT_SCOPES, so a waiter
 * signed in on the same tenant never receives it.
 */
const sendToManagers = async (tenantId, notificationType, payload) => {
  const rows = await getManagerDeviceTokensDB(tenantId, OWNER_ALERT_SCOPES[notificationType] || []);
  return sendToTokens(rows.map((r) => r.fcm_token), payload);
};
exports.sendToManagers = sendToManagers;

/**
 * Money for a notification body. store_details.currency holds an ISO code
 * ("INR", "USD"); Intl renders the symbol so the push reads "₹24,560" rather
 * than "INR 24560". Falls back to "<code> <amount>" if the code is unknown.
 */
const formatMoney = (amount, currency) => {
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: String(currency || "INR").toUpperCase(),
      // Whole amounts read as "₹24,560", not "₹24,560.00"; fractions keep both
      // decimal places rather than rendering as "$1,234.5".
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || ""} ${value.toLocaleString("en-IN")}`.trim();
  }
};

/** Trim the trailing zeros MySQL DECIMAL(10,4) adds: 2.0000 -> 2, 1.5000 -> 1.5. */
const formatQuantity = (quantity) => {
  const value = Number(quantity || 0);
  return Number.isInteger(value) ? String(value) : String(parseFloat(value.toFixed(3)));
};

/**
 * Day-end payment reconciliation summary (scheduler-driven, once per tenant
 * per day — the guard lives in notification_dispatch.service).
 *
 * `summary` comes straight from reports.service, so the figures in the push
 * always match the report the tap opens.
 */
exports.notifyDayEndReconciliation = async (tenantId, { date, totalSales, currency, invoiceCount, reportId }) => {
  try {
    const result = await sendToManagers(tenantId, NOTIFICATION_TYPES.DAY_END_RECONCILIATION, {
      title: "Day-End Reconciliation",
      body: `Today's sales totaled ${formatMoney(totalSales, currency)}. Tap to view the payment breakdown and reconciliation summary.`,
      data: {
        type: NOTIFICATION_TYPES.DAY_END_RECONCILIATION,
        date,
        totalSales,
        currency,
        invoiceCount,
        // The Owner App report the tap opens; sent in the payload so the target
        // screen can change without shipping a new build.
        reportId: reportId || "payment-summary",
        restaurantId: tenantId,
      },
    });
    console.log(
      `[push] DAY_END_RECONCILIATION tenant=${tenantId} date=${date} sent=${result.successCount} failed=${result.failureCount}`
    );
    return result;
  } catch (error) {
    console.error("[push] notifyDayEndReconciliation failed:", error);
    return { successCount: 0, failureCount: 0 };
  }
};

/**
 * Void Invoice (event-driven -- fired once, right after the void commits,
 * not on a schedule; no dispatch-log dedupe, same as ORDER_READY/CAPTAIN_CALL).
 * `orderIds` is only used for the deep link, so the tap can open the invoice
 * detail screen directly without a second lookup endpoint.
 */
exports.notifyVoidInvoice = async (tenantId, { invoiceId, voidedByName, voidReason, voidedAt, orderIds }) => {
  try {
    const result = await sendToManagers(tenantId, NOTIFICATION_TYPES.VOID_INVOICE, {
      title: "Invoice Voided",
      body: voidedByName
        ? `Invoice #${invoiceId} was voided by ${voidedByName}.`
        : `Invoice #${invoiceId} was voided.`,
      data: {
        type: NOTIFICATION_TYPES.VOID_INVOICE,
        invoiceId,
        voidedByName,
        voidReason,
        voidedAt,
        orderIds: (orderIds || []).join(","),
        restaurantId: tenantId,
      },
    });
    console.log(
      `[push] VOID_INVOICE tenant=${tenantId} invoice=${invoiceId} sent=${result.successCount} failed=${result.failureCount}`
    );
    return result;
  } catch (error) {
    console.error("[push] notifyVoidInvoice failed:", error);
    return { successCount: 0, failureCount: 0 };
  }
};

/** Send one low-stock push for a batch of items that just crossed their threshold. */
const notifyLowStock = async (tenantId, items) => {
  if (!Array.isArray(items) || items.length === 0) return { successCount: 0, failureCount: 0 };

  const single = items.length === 1 ? items[0] : null;
  const body = single
    ? `${single.title} is running low (${formatQuantity(single.quantity)} ${single.unit} remaining). Restock soon.`
    : `${items.length} inventory items are running low. Tap to review.`;

  try {
    const result = await sendToManagers(tenantId, NOTIFICATION_TYPES.LOW_STOCK, {
      title: "Low Stock Alert",
      body,
      data: {
        type: NOTIFICATION_TYPES.LOW_STOCK,
        count: items.length,
        // Single-item fields are omitted for a batch so the app can tell the
        // two cases apart without parsing the body.
        ...(single
          ? {
              itemId: single.id,
              itemTitle: single.title,
              remainingQuantity: single.quantity,
              unit: single.unit,
              threshold: single.min_quantity_threshold,
            }
          : { itemIds: items.map((item) => item.id).join(",") }),
        restaurantId: tenantId,
      },
    });
    console.log(
      `[push] LOW_STOCK tenant=${tenantId} items=${items.length} sent=${result.successCount} failed=${result.failureCount}`
    );
    return result;
  } catch (error) {
    console.error("[push] notifyLowStock failed:", error);
    return { successCount: 0, failureCount: 0 };
  }
};
exports.notifyLowStock = notifyLowStock;

// Coalescing window for low-stock alerts. One order deducting five ingredients
// already arrives as a single batch, but a burst of separate orders/adjustments
// would otherwise produce a push each. Buffering per tenant for a few seconds
// turns that burst into one "N items are running low" alert. Set
// LOW_STOCK_ALERT_DEBOUNCE_MS=0 to send immediately.
const LOW_STOCK_DEBOUNCE_MS = Number.isFinite(Number(process.env.LOW_STOCK_ALERT_DEBOUNCE_MS))
  ? Number(process.env.LOW_STOCK_ALERT_DEBOUNCE_MS)
  : 15000;

const pendingLowStock = new Map(); // tenantId -> { items: Map<itemId, item>, timer }

const flushLowStock = (tenantId) => {
  const pending = pendingLowStock.get(tenantId);
  if (!pending) return;
  pendingLowStock.delete(tenantId);
  clearTimeout(pending.timer);
  notifyLowStock(tenantId, [...pending.items.values()]);
};

/**
 * Queue newly low items for the tenant's next low-stock push.
 *
 * Call this *after* the stock transaction commits: the de-duplication row was
 * already written by `syncLowStockAlertsDB` inside that transaction, so an item
 * queued here is guaranteed not to be queued again until it is replenished.
 *
 * Fire-and-forget — never awaited by, and never able to fail, the caller.
 */
exports.queueLowStockAlerts = (tenantId, items) => {
  if (!Array.isArray(items) || items.length === 0) return;

  if (LOW_STOCK_DEBOUNCE_MS <= 0) {
    notifyLowStock(tenantId, items);
    return;
  }

  const pending = pendingLowStock.get(tenantId) || { items: new Map(), timer: null };
  items.forEach((item) => pending.items.set(item.id, item));

  if (!pending.timer) {
    pending.timer = setTimeout(() => flushLowStock(tenantId), LOW_STOCK_DEBOUNCE_MS);
    // A pending alert must never hold the process open at shutdown.
    pending.timer.unref?.();
  }
  pendingLowStock.set(tenantId, pending);
};

/**
 * iOS devices running expo-notifications hand us a raw APNs token. Firebase
 * Admin can only target FCM registration tokens, so exchange it via FCM's
 * batchImport endpoint. Returns the FCM token, or null if the exchange
 * failed (missing credentials, APNs not configured in Firebase, etc.).
 */
exports.convertApnsTokenToFcm = async (apnsToken) => {
  try {
    const accessToken = await getFirebaseAccessToken();
    if (!accessToken) return null;

    const response = await fetch("https://iid.googleapis.com/iid/v1:batchImport", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        access_token_auth: "true",
      },
      body: JSON.stringify({
        application: CONFIG.FIREBASE_IOS_BUNDLE_ID,
        sandbox: CONFIG.FIREBASE_APNS_SANDBOX,
        apns_tokens: [apnsToken],
      }),
    });

    if (!response.ok) {
      console.error(`[push] APNs token import failed: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    const result = data?.results?.[0];
    if (result?.status !== "OK" || !result?.registration_token) {
      console.error("[push] APNs token import rejected:", result?.status);
      return null;
    }
    return result.registration_token;
  } catch (error) {
    console.error("[push] APNs token import failed:", error);
    return null;
  }
};
