const { getMySqlPromiseConnection } = require("../config/mysql.db");

/**
 * Retrieves PMS integration settings for a tenant.
 */
exports.getPmsSettingsDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT tenant_id, is_enabled, pms_base_url, pms_property_id, pms_api_key, auto_post_on_settle, updated_at
       FROM pms_settings
       WHERE tenant_id = ?
       LIMIT 1`,
      [tenantId]
    );

    if (rows.length === 0) {
      return {
        tenant_id: tenantId,
        is_enabled: 0,
        pms_base_url: "http://localhost:8000",
        pms_property_id: null,
        pms_api_key: null,
        auto_post_on_settle: 1,
      };
    }
    return rows[0];
  } finally {
    conn.release();
  }
};

/**
 * Saves or updates PMS integration settings for a tenant.
 * Also registers "Charge to Room" payment type if enabled.
 */
exports.savePmsSettingsDB = async (
  tenantId,
  { is_enabled = 0, pms_base_url = "http://localhost:8000", pms_property_id = null, pms_api_key = null, auto_post_on_settle = 1 }
) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const cleanUrl = (pms_base_url || "http://localhost:8000").trim().replace(/\/+$/, "");

    await conn.query(
      `INSERT INTO pms_settings (tenant_id, is_enabled, pms_base_url, pms_property_id, pms_api_key, auto_post_on_settle)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         is_enabled = VALUES(is_enabled),
         pms_base_url = VALUES(pms_base_url),
         pms_property_id = VALUES(pms_property_id),
         pms_api_key = VALUES(pms_api_key),
         auto_post_on_settle = VALUES(auto_post_on_settle)`,
      [tenantId, is_enabled ? 1 : 0, cleanUrl, pms_property_id, pms_api_key, auto_post_on_settle ? 1 : 0]
    );

    // If PMS is enabled, ensure "Charge to Room" payment type exists for this tenant
    if (is_enabled) {
      const [existingPayment] = await conn.query(
        `SELECT id FROM payment_types WHERE tenant_id = ? AND title = 'Charge to Room' LIMIT 1`,
        [tenantId]
      );
      if (existingPayment.length === 0) {
        await conn.query(
          `INSERT INTO payment_types (title, is_active, tenant_id, icon) VALUES ('Charge to Room', 1, ?, 'bed')`,
          [tenantId]
        );
      }
    }

    return exports.getPmsSettingsDB(tenantId);
  } finally {
    conn.release();
  }
};

/**
 * Internal helper to dispatch an HTTP request to the PMS API with timeout.
 */
async function callPmsApi(pmsConfig, path, options = {}) {
  const { pms_base_url, pms_property_id, pms_api_key } = pmsConfig;
  if (!pms_base_url || !pms_property_id || !pms_api_key) {
    const err = new Error("PMS is not configured properly (missing base URL, property ID, or API key).");
    err.isConfigError = true;
    throw err;
  }

  const cleanBase = pms_base_url.trim().replace(/\/+$/, "");
  const targetUrl = `${cleanBase}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = {
    "X-PMS-API-Key": pms_api_key,
    "X-Property-ID": pms_property_id,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 8000);

    const response = await fetch(targetUrl, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const err = new Error(data?.detail || data?.message || `PMS API error (HTTP ${response.status})`);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError" || error.code === "ECONNREFUSED" || error.code === "ENOTFOUND" || error.code === "ETIMEDOUT") {
      error.isNetworkError = true;
    }
    throw error;
  }
}

/**
 * Real-time room verification: checks if a room is occupied by a checked-in guest.
 */
exports.verifyRoomGuestDB = async (tenantId, roomNumber) => {
  const settings = await exports.getPmsSettingsDB(tenantId);
  if (!settings || !settings.is_enabled) {
    return {
      valid: false,
      error: "PMS_DISABLED",
      message: "PMS integration is disabled in settings.",
    };
  }

  const data = await callPmsApi(
    settings,
    `/api/v1/integrations/pos/verify-room?room_number=${encodeURIComponent(roomNumber)}`
  );
  return data;
};

/**
 * Fetches list of all currently checked-in rooms from PMS for quick room picker.
 */
exports.getCheckedInRoomsDB = async (tenantId) => {
  const settings = await exports.getPmsSettingsDB(tenantId);
  if (!settings || !settings.is_enabled) {
    return { property_id: null, total: 0, rooms: [] };
  }

  const data = await callPmsApi(settings, `/api/v1/integrations/pos/checked-in-rooms`);
  return data;
};

/**
 * Posts room charge for a finalized order to the PMS guest folio in integer USD cents.
 * If PMS is unreachable, queues the payload into pms_sync_queue for background sync.
 */
exports.postRoomChargeForOrderDB = async (tenantId, orderId, postedByName = "Bong POS") => {
  const conn = await getMySqlPromiseConnection();
  try {
    // 1. Fetch order details with associated invoice
    const [orders] = await conn.query(
      `SELECT o.id, o.delivery_type, o.invoice_id, o.pms_reservation_id, o.pms_room_number,
              o.pms_guest_name, o.pms_charge_id, o.pms_sync_status,
              i.total, i.sub_total
       FROM orders o
       LEFT JOIN invoices i ON i.id = o.invoice_id AND i.tenant_id = o.tenant_id
       WHERE o.id = ? AND o.tenant_id = ?
       LIMIT 1`,
      [orderId, tenantId]
    );

    if (orders.length === 0) {
      throw new Error(`Order #${orderId} not found`);
    }

    const order = orders[0];
    if (!order.pms_reservation_id) {
      throw new Error(`Order #${orderId} is not linked to any PMS reservation.`);
    }

    if (order.pms_sync_status === "SYNCED" && order.pms_charge_id) {
      return { success: true, alreadySynced: true, charge_id: order.pms_charge_id };
    }

    // 2. Resolve store currency & exchange rate to calculate USD cents
    const [storeRows] = await conn.query(
      `SELECT currency, exchange_rate_usd_to_khr FROM store_details WHERE tenant_id = ? LIMIT 1`,
      [tenantId]
    );
    const store = storeRows[0] || { currency: "USD", exchange_rate_usd_to_khr: 4100 };
    const billTotal = Number(order.total || order.sub_total || 0);

    let amountUsdCents = 0;
    if ((store.currency || "").toUpperCase() === "KHR") {
      const rate = Number(store.exchange_rate_usd_to_khr) || 4100;
      amountUsdCents = Math.round((billTotal / rate) * 100);
    } else {
      amountUsdCents = Math.round(billTotal * 100);
    }

    if (amountUsdCents <= 0) {
      amountUsdCents = 100; // minimum charge fallback
    }

    const chargePayload = {
      reservation_id: order.pms_reservation_id,
      pos_order_id: String(order.id),
      pos_order_number: `ORD-${order.id}`,
      category: "ROOM_SERVICE",
      description_en: `Room Service - Order #${order.id} (Room ${order.pms_room_number || "N/A"})`,
      amount_usd_cents: amountUsdCents,
      posted_by_name: postedByName || "Bong POS",
    };

    const pmsSettings = await exports.getPmsSettingsDB(tenantId);
    if (!pmsSettings || !pmsSettings.is_enabled) {
      throw new Error("PMS integration is disabled.");
    }

    // 3. Attempt direct call to PMS
    try {
      const pmsRes = await callPmsApi(pmsSettings, "/api/v1/integrations/pos/post-charge", {
        method: "POST",
        body: chargePayload,
      });

      // Successful post -> update orders table
      await conn.query(
        `UPDATE orders
         SET pms_charge_id = ?, pms_sync_status = 'SYNCED'
         WHERE id = ? AND tenant_id = ?`,
        [pmsRes.charge_id, order.id, tenantId]
      );

      return {
        success: true,
        queued: false,
        charge_id: pmsRes.charge_id,
        amount_usd_cents: amountUsdCents,
        status: "SYNCED",
      };
    } catch (apiError) {
      console.warn(`[PMS Integration] Failed direct charge post for Order #${order.id}:`, apiError.message);

      // If network failure / timeout -> queue into pms_sync_queue
      await conn.query(
        `INSERT INTO pms_sync_queue (tenant_id, order_id, action, payload, status, last_error)
         VALUES (?, ?, 'POST_CHARGE', ?, 'PENDING', ?)`,
        [tenantId, order.id, JSON.stringify(chargePayload), apiError.message]
      );

      await conn.query(
        `UPDATE orders
         SET pms_sync_status = 'PENDING'
         WHERE id = ? AND tenant_id = ?`,
        [order.id, tenantId]
      );

      return {
        success: true,
        queued: true,
        message: "PMS is temporarily unreachable. Charge queued for background retry.",
        status: "PENDING",
      };
    }
  } finally {
    conn.release();
  }
};

/**
 * Voids a posted charge in PMS when an order is cancelled or refunded.
 */
exports.voidRoomChargeForOrderDB = async (tenantId, orderId, voidReason = "Order cancelled") => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [orders] = await conn.query(
      `SELECT id, pms_charge_id, pms_sync_status FROM orders WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [orderId, tenantId]
    );

    if (orders.length === 0) {
      throw new Error(`Order #${orderId} not found`);
    }

    const order = orders[0];
    if (!order.pms_charge_id) {
      // Nothing posted to PMS
      return { success: true, message: "No PMS charge was posted for this order." };
    }

    const voidPayload = {
      charge_id: order.pms_charge_id,
      pos_order_id: String(order.id),
      void_reason: voidReason || "Order cancelled in POS",
    };

    const pmsSettings = await exports.getPmsSettingsDB(tenantId);
    if (!pmsSettings || !pmsSettings.is_enabled) {
      throw new Error("PMS integration is disabled.");
    }

    try {
      const pmsRes = await callPmsApi(pmsSettings, "/api/v1/integrations/pos/void-charge", {
        method: "POST",
        body: voidPayload,
      });

      await conn.query(
        `UPDATE orders SET pms_sync_status = 'VOIDED' WHERE id = ? AND tenant_id = ?`,
        [order.id, tenantId]
      );

      return {
        success: true,
        is_void: true,
        charge_id: pmsRes.charge_id,
        status: "VOIDED",
      };
    } catch (apiError) {
      console.warn(`[PMS Integration] Failed direct void for Order #${order.id}:`, apiError.message);

      await conn.query(
        `INSERT INTO pms_sync_queue (tenant_id, order_id, action, payload, status, last_error)
         VALUES (?, ?, 'VOID_CHARGE', ?, 'PENDING', ?)`,
        [tenantId, order.id, JSON.stringify(voidPayload), apiError.message]
      );

      return {
        success: true,
        queued: true,
        message: "PMS is offline. Void request queued for automatic retry.",
      };
    }
  } finally {
    conn.release();
  }
};

/**
 * Retrieves the retry queue items for monitoring.
 */
exports.getSyncQueueDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT id, tenant_id, order_id, action, payload, attempts, status, last_error, created_at, updated_at
       FROM pms_sync_queue
       WHERE tenant_id = ?
       ORDER BY id DESC
       LIMIT 50`,
      [tenantId]
    );
    return rows;
  } finally {
    conn.release();
  }
};

/**
 * Processes queued pending sync items against the PMS.
 */
exports.processSyncQueueDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const pmsSettings = await exports.getPmsSettingsDB(tenantId);
    if (!pmsSettings || !pmsSettings.is_enabled) {
      return { processed: 0, message: "PMS is disabled." };
    }

    const [queueItems] = await conn.query(
      `SELECT * FROM pms_sync_queue
       WHERE tenant_id = ? AND status IN ('PENDING', 'FAILED') AND attempts < 5
       ORDER BY id ASC
       LIMIT 20`,
      [tenantId]
    );

    let processedCount = 0;

    for (const item of queueItems) {
      let payload = item.payload;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          // ignore
        }
      }

      const endpoint = item.action === "POST_CHARGE"
        ? "/api/v1/integrations/pos/post-charge"
        : "/api/v1/integrations/pos/void-charge";

      try {
        const res = await callPmsApi(pmsSettings, endpoint, {
          method: "POST",
          body: payload,
        });

        await conn.query(
          `UPDATE pms_sync_queue
           SET status = 'COMPLETED', updated_at = NOW()
           WHERE id = ?`,
          [item.id]
        );

        if (item.action === "POST_CHARGE" && res.charge_id) {
          await conn.query(
            `UPDATE orders
             SET pms_charge_id = ?, pms_sync_status = 'SYNCED'
             WHERE id = ? AND tenant_id = ?`,
            [res.charge_id, item.order_id, tenantId]
          );
        } else if (item.action === "VOID_CHARGE") {
          await conn.query(
            `UPDATE orders
             SET pms_sync_status = 'VOIDED'
             WHERE id = ? AND tenant_id = ?`,
            [item.order_id, tenantId]
          );
        }
        processedCount++;
      } catch (err) {
        const newAttempts = item.attempts + 1;
        const newStatus = newAttempts >= 5 ? "FAILED" : "PENDING";
        await conn.query(
          `UPDATE pms_sync_queue
           SET attempts = ?, status = ?, last_error = ?, updated_at = NOW()
           WHERE id = ?`,
          [newAttempts, newStatus, err.message, item.id]
        );
      }
    }

    return { total: queueItems.length, processed: processedCount };
  } finally {
    conn.release();
  }
};
