const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { getCurrencyDB, getStoreSettingDB } = require("./settings.service");
const {
  claimScheduledDispatchDB,
  recordScheduledDispatchResultDB,
  releaseScheduledDispatchDB,
} = require("./notification_dispatch.service");

const escapeHtml = (text) => {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

/**
 * Fetch telegram settings for a specific tenant.
 */
exports.getTelegramSettingsDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT * FROM telegram_settings WHERE tenant_id = ? LIMIT 1`,
      [tenantId]
    );

    if (rows.length === 0) {
      return {
        tenant_id: tenantId,
        bot_token: null,
        orders_chat_id: null,
        orders_thread_id: null,
        eod_chat_id: null,
        eod_thread_id: null,
        is_orders_enabled: 1,
        is_eod_enabled: 1,
        eod_time: "23:59",
      };
    }

    return rows[0];
  } finally {
    conn.release();
  }
};

/**
 * Upsert telegram settings for a tenant.
 */
exports.updateTelegramSettingsDB = async (tenantId, data) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const {
      bot_token = null,
      orders_chat_id = null,
      orders_thread_id = null,
      eod_chat_id = null,
      eod_thread_id = null,
      is_orders_enabled = 1,
      is_eod_enabled = 1,
      eod_time = "23:59",
    } = data;

    await conn.query(
      `INSERT INTO telegram_settings (
        tenant_id, bot_token, orders_chat_id, orders_thread_id,
        eod_chat_id, eod_thread_id, is_orders_enabled, is_eod_enabled, eod_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        bot_token = VALUES(bot_token),
        orders_chat_id = VALUES(orders_chat_id),
        orders_thread_id = VALUES(orders_thread_id),
        eod_chat_id = VALUES(eod_chat_id),
        eod_thread_id = VALUES(eod_thread_id),
        is_orders_enabled = VALUES(is_orders_enabled),
        is_eod_enabled = VALUES(is_eod_enabled),
        eod_time = VALUES(eod_time)
      `,
      [
        tenantId,
        bot_token ? String(bot_token).trim() : null,
        orders_chat_id ? String(orders_chat_id).trim() : null,
        orders_thread_id ? String(orders_thread_id).trim() : null,
        eod_chat_id ? String(eod_chat_id).trim() : null,
        eod_thread_id ? String(eod_thread_id).trim() : null,
        is_orders_enabled ? 1 : 0,
        is_eod_enabled ? 1 : 0,
        eod_time ? String(eod_time).trim() : "23:59",
      ]
    );

    return exports.getTelegramSettingsDB(tenantId);
  } finally {
    conn.release();
  }
};

/**
 * Send raw message to Telegram Bot API.
 */
exports.sendTelegramMessage = async (botToken, chatId, text, { threadId = null, parseMode = "HTML" } = {}) => {
  if (!botToken || !chatId || !text) {
    throw new Error("botToken, chatId, and text are required");
  }

  const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
  };

  if (threadId) {
    const parsedThread = Number(threadId);
    if (!isNaN(parsedThread) && parsedThread > 0) {
      payload.message_thread_id = parsedThread;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.description || `Telegram API returned status ${res.status}`);
    }

    return { success: true, result: data.result };
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Telegram API request timed out after 10s");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Send a test verification message to test bot credentials.
 */
exports.testTelegramConnection = async (botToken, chatId, threadId = null) => {
  const timestamp = new Date().toLocaleString();
  const testMessage = [
    `<b>BONG POS — Connection Test</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `<b>Status:</b> Success. Your Telegram bot is connected and ready to send notifications.`,
    `<b>Sent:</b> <i>${escapeHtml(timestamp)}</i>`,
  ].join("\n");

  return exports.sendTelegramMessage(botToken, chatId, testMessage, { threadId, parseMode: "HTML" });
};

/**
 * Format and send New Order ticket to Telegram.
 * Safe fire-and-forget: does not throw unhandled errors.
 */
exports.sendOrderTelegramNotification = async (tenantId, orderId) => {
  try {
    const settings = await exports.getTelegramSettingsDB(tenantId);
    if (!settings || !settings.bot_token || !settings.orders_chat_id || !settings.is_orders_enabled) {
      return;
    }

    const conn = await getMySqlPromiseConnection();
    let orderRow = null;
    let orderItems = [];
    let addonsMap = new Map();
    let storeInfo = null;

    try {
      const [storeRows] = await conn.query(
        `SELECT store_name, currency FROM store_details WHERE tenant_id = ? LIMIT 1`,
        [tenantId]
      );
      storeInfo = storeRows[0] || {};

      const [orderRows] = await conn.query(
        `SELECT 
          o.id, o.token_no, o.delivery_type, o.customer_type, o.customer_id, 
          o.status, o.payment_status, o.created_by, o.date,
          st.table_title, st.floor,
          c.name AS customer_name, c.phone AS customer_phone
        FROM orders o
        LEFT JOIN store_tables st ON st.id = o.table_id AND st.tenant_id = o.tenant_id
        LEFT JOIN customers c ON c.phone = o.customer_id AND c.tenant_id = o.tenant_id
        WHERE o.id = ? AND o.tenant_id = ?
        LIMIT 1`,
        [orderId, tenantId]
      );

      if (orderRows.length === 0) {
        return;
      }
      orderRow = orderRows[0];

      const [itemsRows] = await conn.query(
        `SELECT 
          oi.id, oi.item_id, oi.variant_id, oi.price, oi.quantity, oi.notes, oi.addons,
          COALESCE(oi.custom_title, mi.title) AS item_title,
          mv.title AS variant_title
        FROM order_items oi
        LEFT JOIN menu_items mi ON mi.id = oi.item_id AND mi.tenant_id = oi.tenant_id
        LEFT JOIN menu_item_variants mv ON mv.id = oi.variant_id AND mv.tenant_id = oi.tenant_id
        WHERE oi.order_id = ? AND oi.tenant_id = ?`,
        [orderId, tenantId]
      );
      orderItems = itemsRows;

      // Extract addons IDs/titles if any
      const rawAddons = orderItems.flatMap((item) => {
        try {
          return item.addons ? JSON.parse(item.addons) : [];
        } catch {
          return [];
        }
      });

      const numericIds = [
        ...new Set(
          rawAddons
            .map((a) => (typeof a === "object" && a !== null ? a.id : a))
            .filter((a) => a !== null && a !== undefined && !isNaN(Number(a)))
            .map(Number)
        ),
      ];

      if (numericIds.length > 0) {
        const [addonsRows] = await conn.query(
          `SELECT id, title, price FROM menu_item_addons WHERE id IN (?) AND tenant_id = ?`,
          [numericIds, tenantId]
        );
        addonsRows.forEach((a) => addonsMap.set(Number(a.id), a));
      }
    } finally {
      conn.release();
    }

    const currency = storeInfo.currency || "$";
    const storeName = storeInfo.store_name || "Restaurant POS";

    // Delivery type text
    let typeDisplay = "Dine-In";
    if (orderRow.delivery_type === "takeaway") typeDisplay = "Takeaway";
    else if (orderRow.delivery_type === "delivery") typeDisplay = "Delivery";

    // Build items summary
    let totalEstimated = 0;
    let totalQty = 0;

    const itemsTextLines = orderItems.map((item) => {
      const qty = Number(item.quantity) || 1;
      const unitPrice = Number(item.price) || 0;
      const lineTotal = unitPrice * qty;
      totalEstimated += lineTotal;
      totalQty += qty;

      let itemLine = `• <b>${qty}x</b> ${escapeHtml(item.item_title || "Item")}`;
      if (item.variant_title) {
        itemLine += ` (<i>${escapeHtml(item.variant_title)}</i>)`;
      }

      // Addons
      if (item.addons) {
        try {
          const itemAddonList = JSON.parse(item.addons);
          const addonTitles = itemAddonList
            .map((a) => {
              const id = typeof a === "object" && a !== null ? a.id : a;
              const found = addonsMap.get(Number(id));
              return found ? found.title : typeof a === "string" ? a : null;
            })
            .filter(Boolean);

          if (addonTitles.length > 0) {
            itemLine += `\n   + <i>${escapeHtml(addonTitles.join(", "))}</i>`;
          }
        } catch {}
      }

      // Item notes
      if (item.notes && item.notes.trim()) {
        itemLine += `\n   <i>Note: ${escapeHtml(item.notes.trim())}</i>`;
      }

      itemLine += ` — <code>${currency} ${lineTotal.toFixed(2)}</code>`;
      return itemLine;
    });

    const orderTime = new Date(orderRow.date || Date.now()).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const lines = [
      `<b>NEW ORDER #${orderRow.id}</b> ${orderRow.token_no ? `(Token: <b>#${orderRow.token_no}</b>)` : ""}`,
      `<b>${escapeHtml(storeName)}</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `<b>Type:</b> ${typeDisplay}${orderRow.table_title ? ` | <b>Table:</b> ${escapeHtml(orderRow.table_title)}` : ""}`,
      `<b>Staff:</b> ${escapeHtml(orderRow.created_by || "POS")}`,
    ];

    if (orderRow.customer_name || orderRow.customer_phone) {
      const custDetails = [orderRow.customer_name, orderRow.customer_phone].filter(Boolean).join(" - ");
      lines.push(`<b>Customer:</b> ${escapeHtml(custDetails)}`);
    }

    lines.push(`<b>Time:</b> ${escapeHtml(orderTime)}`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`<b>Items (${totalQty}):</b>`);
    lines.push(itemsTextLines.join("\n"));
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`<b>Total:</b> <b>${currency} ${totalEstimated.toFixed(2)}</b>`);
    lines.push(`<b>Payment:</b> ${orderRow.payment_status?.toUpperCase() || "PENDING"}`);

    const finalMessage = lines.join("\n");

    await exports.sendTelegramMessage(settings.bot_token, settings.orders_chat_id, finalMessage, {
      threadId: settings.orders_thread_id,
      parseMode: "HTML",
    });

    console.log(`[telegram] Order #${orderId} sent to chat ${settings.orders_chat_id} (tenant ${tenantId})`);
  } catch (err) {
    console.error(`[telegram] Failed to send order notification for order #${orderId} (tenant ${tenantId}):`, err.message);
  }
};

/**
 * Format and send End-of-Day (EOD) summary report to Telegram.
 * Supports automated scheduler runs or manual triggers.
 */
exports.sendEodTelegramNotification = async (tenantId, date, { force = false } = {}) => {
  const settings = await exports.getTelegramSettingsDB(tenantId);
  if (!settings || !settings.bot_token || !settings.is_eod_enabled) {
    return "skipped";
  }

  const targetChatId = settings.eod_chat_id || settings.orders_chat_id;
  const targetThreadId = settings.eod_chat_id ? settings.eod_thread_id : (settings.eod_thread_id || settings.orders_thread_id);

  if (!targetChatId) {
    return "skipped";
  }

  const claimed = force || (await claimScheduledDispatchDB(tenantId, "TELEGRAM_EOD", date));
  if (!claimed) {
    return "already-sent";
  }

  const conn = await getMySqlPromiseConnection();
  try {
    const [storeRows] = await conn.query(
      `SELECT store_name, currency FROM store_details WHERE tenant_id = ? LIMIT 1`,
      [tenantId]
    );
    const storeInfo = storeRows[0] || {};
    const currency = storeInfo.currency || "$";
    const storeName = storeInfo.store_name || "Restaurant POS";

    // 1. Invoice totals for today
    const [invoiceTotalsRows] = await conn.query(
      `SELECT
        COUNT(*) AS invoice_count,
        COALESCE(SUM(sub_total), 0) AS net_sales,
        COALESCE(SUM(discount_total), 0) AS discount_total,
        COALESCE(SUM(tax_total), 0) AS tax_total,
        COALESCE(SUM(service_charge_total), 0) AS service_charge_total,
        COALESCE(SUM(total), 0) AS total_sales,
        COALESCE(AVG(total), 0) AS average_order_value
      FROM invoices
      WHERE tenant_id = ? 
        AND DATE(created_at) = ?
        AND (status IS NULL OR status != 'void')`,
      [tenantId, date]
    );
    const invTotals = invoiceTotalsRows[0] || {};

    // 2. Orders count for today
    const [orderTotalsRows] = await conn.query(
      `SELECT
        COUNT(*) AS orders_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
        SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) AS unpaid_orders
      FROM orders
      WHERE tenant_id = ? AND DATE(date) = ?`,
      [tenantId, date]
    );
    const ordTotals = orderTotalsRows[0] || {};

    // 3. Payment methods mix for today
    const [paymentRows] = await conn.query(
      `SELECT
        COALESCE(pt.title, 'Unassigned') AS payment_type,
        COUNT(i.id) AS invoice_count,
        COALESCE(SUM(i.total), 0) AS total
      FROM invoices i
      LEFT JOIN payment_types pt ON pt.id = i.payment_type_id AND pt.tenant_id = i.tenant_id
      WHERE i.tenant_id = ?
        AND DATE(i.created_at) = ?
        AND (i.status IS NULL OR i.status != 'void')
      GROUP BY COALESCE(pt.title, 'Unassigned')
      ORDER BY total DESC`,
      [tenantId, date]
    );

    const totalOrders = Number(ordTotals.orders_count || 0);
    const totalInvoices = Number(invTotals.invoice_count || 0);
    const grossSales = Number(invTotals.total_sales || 0);
    const netSales = Number(invTotals.net_sales || 0);
    const discountTotal = Number(invTotals.discount_total || 0);
    const taxTotal = Number(invTotals.tax_total || 0);
    const serviceChargeTotal = Number(invTotals.service_charge_total || 0);

    // Skip if restaurant had 0 orders and 0 sales
    if (totalOrders === 0 && grossSales === 0) {
      console.log(`[telegram] EOD tenant=${tenantId} date=${date} skipped (no orders/sales)`);
      return "skipped";
    }

    const paymentMixLines = paymentRows.length > 0
      ? paymentRows.map((r) => `• ${escapeHtml(r.payment_type)}: <b>${currency} ${Number(r.total).toFixed(2)}</b> (<i>${r.invoice_count} inv</i>)`).join("\n")
      : "• <i>No settled payments</i>";

    const lines = [
      `<b>END OF DAY SUMMARY REPORT</b>`,
      `<b>${escapeHtml(storeName)}</b>`,
      `<b>Date:</b> ${date}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `<b>Financial Overview:</b>`,
      `• <b>Gross Revenue:</b> <b>${currency} ${grossSales.toFixed(2)}</b>`,
      `• <b>Net Sales:</b> ${currency} ${netSales.toFixed(2)}`,
      discountTotal > 0 ? `• <b>Discounts:</b> -${currency} ${discountTotal.toFixed(2)}` : null,
      taxTotal > 0 ? `• <b>Taxes:</b> ${currency} ${taxTotal.toFixed(2)}` : null,
      serviceChargeTotal > 0 ? `• <b>Service Charges:</b> ${currency} ${serviceChargeTotal.toFixed(2)}` : null,
      `━━━━━━━━━━━━━━━━━━━━`,
      `<b>Operations:</b>`,
      `• <b>Total Orders:</b> ${totalOrders}`,
      `• <b>Paid Invoices:</b> ${totalInvoices}`,
      Number(ordTotals.unpaid_orders || 0) > 0 ? `• <b>Unpaid Orders:</b> ${ordTotals.unpaid_orders}` : null,
      Number(ordTotals.cancelled_orders || 0) > 0 ? `• <b>Cancelled Orders:</b> ${ordTotals.cancelled_orders}` : null,
      `━━━━━━━━━━━━━━━━━━━━`,
      `<b>Payment Methods:</b>`,
      paymentMixLines,
      `━━━━━━━━━━━━━━━━━━━━`,
      `<i>Generated at ${new Date().toLocaleTimeString()}</i>`,
    ].filter(Boolean);

    const messageText = lines.join("\n");

    await exports.sendTelegramMessage(settings.bot_token, targetChatId, messageText, {
      threadId: targetThreadId,
      parseMode: "HTML",
    });

    await recordScheduledDispatchResultDB(tenantId, "TELEGRAM_EOD", date, 1);
    console.log(`[telegram] EOD tenant=${tenantId} date=${date} dispatched to chat=${targetChatId}`);
    return "sent";
  } catch (err) {
    console.error(`[telegram] EOD tenant=${tenantId} date=${date} failed:`, err);
    if (!force) {
      await releaseScheduledDispatchDB(tenantId, "TELEGRAM_EOD", date);
    }
    throw err;
  } finally {
    conn.release();
  }
};
