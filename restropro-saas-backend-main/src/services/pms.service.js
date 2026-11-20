const { getMySqlPromiseConnection } = require("../config/mysql.db");

const POST_CHARGE_PATH = "/api/v1/integrations/pos/post-charge";
const VOID_CHARGE_PATH = "/api/v1/integrations/pos/void-charge";
const MAX_SYNC_ATTEMPTS = 5;
// The POS backend runs in Docker: "localhost" there is the container itself,
// so a PMS on the same machine is reached through host.docker.internal.
const DEFAULT_PMS_URL = "http://host.docker.internal:8000";

function pmsError(message, status = 400, code = "PMS_ERROR") {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.isPmsError = true;
  return err;
}

/**
 * A charge is only worth retrying when the PMS could not be reached or failed
 * on its side. A 4xx is the PMS saying "no" (guest checked out, limit reached,
 * charges not allowed); retrying will never change that.
 */
function isRetryable(error) {
  return Boolean(error?.isNetworkError) || !error?.status || error.status >= 500;
}

/**
 * Retrieves PMS integration settings for a tenant, including the API key.
 * Internal use only: send toPublicPmsSettings() to the browser.
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
        pms_base_url: DEFAULT_PMS_URL,
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
 * Settings as the browser may see them: the API key is replaced by a hint.
 */
exports.toPublicPmsSettings = (settings) => {
  if (!settings) return settings;
  const { pms_api_key, ...rest } = settings;
  const key = pms_api_key ? String(pms_api_key) : "";
  return {
    ...rest,
    has_api_key: key.length > 0,
    api_key_hint: key.length > 4 ? `••••${key.slice(-4)}` : key ? "••••" : null,
  };
};

/**
 * Saves or updates PMS integration settings for a tenant.
 * An empty API key keeps the stored one, so the settings form never needs to
 * read the key back. Also makes sure a room-charge payment type exists.
 */
exports.savePmsSettingsDB = async (
  tenantId,
  { is_enabled = 0, pms_base_url = DEFAULT_PMS_URL, pms_property_id = null, pms_api_key = null, auto_post_on_settle = 1 }
) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const cleanUrl = (pms_base_url || DEFAULT_PMS_URL).trim().replace(/\/+$/, "");
    const newKey = pms_api_key && String(pms_api_key).trim() ? String(pms_api_key).trim() : null;

    await conn.query(
      `INSERT INTO pms_settings (tenant_id, is_enabled, pms_base_url, pms_property_id, pms_api_key, auto_post_on_settle)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         is_enabled = VALUES(is_enabled),
         pms_base_url = VALUES(pms_base_url),
         pms_property_id = VALUES(pms_property_id),
         pms_api_key = COALESCE(VALUES(pms_api_key), pms_api_key),
         auto_post_on_settle = VALUES(auto_post_on_settle)`,
      [tenantId, is_enabled ? 1 : 0, cleanUrl, pms_property_id, newKey, auto_post_on_settle ? 1 : 0]
    );

    if (is_enabled) {
      const [existingPayment] = await conn.query(
        `SELECT id FROM payment_types WHERE tenant_id = ? AND is_room_charge = 1 LIMIT 1`,
        [tenantId]
      );
      if (existingPayment.length > 0) {
        await conn.query(`UPDATE payment_types SET is_active = 1 WHERE id = ? AND tenant_id = ?`, [existingPayment[0].id, tenantId]);
      } else {
        await conn.query(
          `INSERT INTO payment_types (title, is_active, tenant_id, icon, is_room_charge) VALUES ('Charge to Room', 1, ?, 'bed', 1)`,
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
    err.status = 400;
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 8000);
  try {
    const response = await fetch(targetUrl, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const detail = Array.isArray(data?.detail) ? data.detail.map((d) => d.msg).join("; ") : data?.detail;
      const err = new Error(detail || data?.message || `PMS API error (HTTP ${response.status})`);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (error) {
    if (!error.status) {
      // fetch() rejects with a TypeError (cause: ECONNREFUSED, ENOTFOUND...) or an AbortError.
      error.isNetworkError = true;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
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

  return callPmsApi(
    settings,
    `/api/v1/integrations/pos/verify-room?room_number=${encodeURIComponent(roomNumber)}`
  );
};

/**
 * Fetches list of all currently checked-in rooms from PMS for quick room picker.
 */
exports.getCheckedInRoomsDB = async (tenantId) => {
  const settings = await exports.getPmsSettingsDB(tenantId);
  if (!settings || !settings.is_enabled) {
    return { property_id: null, total: 0, rooms: [] };
  }

  return callPmsApi(settings, `/api/v1/integrations/pos/checked-in-rooms`);
};

/**
 * IDs of this tenant's room-charge payment types.
 */
async function getRoomChargeTypeIds(conn, tenantId) {
  const [rows] = await conn.query(
    `SELECT id FROM payment_types WHERE tenant_id = ? AND is_room_charge = 1`,
    [tenantId]
  );
  return rows.map((r) => Number(r.id));
}

exports.getRoomChargeTypeIdsDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    return await getRoomChargeTypeIds(conn, tenantId);
  } finally {
    conn.release();
  }
};

/**
 * Store-currency amount of a bill that was paid with a room-charge tender
 * (amount + tip, net of any reversals). Cash, card etc. never reach the folio.
 */
async function getRoomChargeAmountForInvoice(conn, tenantId, invoiceId) {
  const typeIds = await getRoomChargeTypeIds(conn, tenantId);
  if (!invoiceId || typeIds.length === 0) return 0;
  const [rows] = await conn.query(
    `SELECT COALESCE(SUM(amount + COALESCE(tip_amount, 0)), 0) AS total
     FROM register_payments
     WHERE tenant_id = ? AND invoice_id = ? AND payment_type_id IN (?)`,
    [tenantId, invoiceId, typeIds]
  );
  return Math.max(0, Number(rows[0]?.total || 0));
}

async function toUsdCents(conn, tenantId, amount) {
  const [storeRows] = await conn.query(
    `SELECT currency, exchange_rate_usd_to_khr FROM store_details WHERE tenant_id = ? LIMIT 1`,
    [tenantId]
  );
  const store = storeRows[0] || { currency: "USD", exchange_rate_usd_to_khr: 4100 };
  if ((store.currency || "").toUpperCase() === "KHR") {
    const rate = Number(store.exchange_rate_usd_to_khr) || 4100;
    return Math.round((amount / rate) * 100);
  }
  return Math.round(amount * 100);
}

/**
 * Store-currency amount of the room-charge lines in a tender, before the bill
 * is written. A single tender line (or none) pays the whole bill.
 */
function roomChargeAmountFromTender({ payments, selectedPaymentType, total, roomTypeIds }) {
  const isRoom = (id) => id !== null && id !== undefined && id !== "" && roomTypeIds.includes(Number(id));
  const lines = (Array.isArray(payments) ? payments : []).filter((l) => l && l.paymentTypeId !== undefined && l.paymentTypeId !== null && l.paymentTypeId !== "");
  if (lines.length <= 1) {
    const typeId = lines[0]?.paymentTypeId ?? selectedPaymentType;
    return isRoom(typeId) ? Number(total || 0) : 0;
  }
  return lines
    .filter((l) => isRoom(l.paymentTypeId))
    .reduce((sum, l) => sum + Number(l.amount || 0) + Number(l.tip || 0), 0);
}

/**
 * Called before a bill is written. If any of the tender goes to a room, the
 * order must be linked to a checked-in guest who may still charge that much.
 * When the PMS cannot be reached the sale is allowed and the charge queued.
 * Throws a 400 pmsError when the room charge must be refused.
 */
exports.assertRoomChargeAllowedDB = async (tenantId, { payments, selectedPaymentType, total, payLater, reservationId, roomNumber }) => {
  if (payLater) return { roomChargeAmount: 0 };
  const conn = await getMySqlPromiseConnection();
  let roomChargeAmount;
  let amountUsdCents;
  try {
    const roomTypeIds = await getRoomChargeTypeIds(conn, tenantId);
    if (roomTypeIds.length === 0) return { roomChargeAmount: 0 };
    roomChargeAmount = roomChargeAmountFromTender({ payments, selectedPaymentType, total, roomTypeIds });
    if (roomChargeAmount <= 0) return { roomChargeAmount: 0 };
    amountUsdCents = await toUsdCents(conn, tenantId, roomChargeAmount);
  } finally {
    conn.release();
  }

  if (!reservationId || !roomNumber) {
    throw pmsError("Charge to Room needs a hotel room. Choose Room Service and pick the guest's room first.", 400, "ROOM_REQUIRED");
  }

  const settings = await exports.getPmsSettingsDB(tenantId);
  if (!settings?.is_enabled) {
    throw pmsError("Hotel PMS integration is turned off. Use another payment method.", 400, "PMS_DISABLED");
  }

  let guest;
  try {
    guest = await callPmsApi(settings, `/api/v1/integrations/pos/verify-room?room_number=${encodeURIComponent(roomNumber)}`, { timeoutMs: 5000 });
  } catch (error) {
    if (isRetryable(error)) return { roomChargeAmount, offline: true };
    throw pmsError(error.message || "The hotel PMS refused the room check.", 400, "PMS_REJECTED");
  }

  if (!guest?.valid || String(guest.reservation_id) !== String(reservationId)) {
    throw pmsError(`Room ${roomNumber} no longer has this guest checked in. Pick the room again or use another payment method.`, 400, "GUEST_NOT_IN_HOUSE");
  }
  if (!guest.can_post_charges) {
    throw pmsError(guest.message || "Room charges are not allowed for this guest. Collect payment at the POS.", 400, "ROOM_CHARGE_NOT_ALLOWED");
  }
  const remaining = guest.room_charge_remaining_usd_cents;
  if (remaining !== null && remaining !== undefined && amountUsdCents > Number(remaining)) {
    throw pmsError(`Room charge limit: only USD ${(Number(remaining) / 100).toFixed(2)} left for this guest. Split the bill or use another payment method.`, 400, "ROOM_CHARGE_LIMIT");
  }
  return { roomChargeAmount };
};

/**
 * Queues a PMS call for the background worker, unless the same action is
 * already waiting for this order.
 */
async function enqueue(conn, tenantId, orderId, action, payload, lastError) {
  const [pending] = await conn.query(
    `SELECT id FROM pms_sync_queue
     WHERE tenant_id = ? AND order_id = ? AND action = ? AND status IN ('PENDING', 'PROCESSING')
     LIMIT 1`,
    [tenantId, orderId, action]
  );
  if (pending.length > 0) {
    await conn.query(`UPDATE pms_sync_queue SET payload = ?, last_error = ? WHERE id = ?`, [JSON.stringify(payload), lastError, pending[0].id]);
    return;
  }
  await conn.query(
    `INSERT INTO pms_sync_queue (tenant_id, order_id, action, payload, status, last_error)
     VALUES (?, ?, ?, ?, 'PENDING', ?)`,
    [tenantId, orderId, action, JSON.stringify(payload), lastError]
  );
}

/** Keeps a refused call visible in the queue monitor without retrying it. */
async function recordRejected(conn, tenantId, orderId, action, payload, lastError) {
  await conn.query(
    `INSERT INTO pms_sync_queue (tenant_id, order_id, action, payload, status, last_error, attempts)
     VALUES (?, ?, ?, ?, 'REJECTED', ?, 1)`,
    [tenantId, orderId, action, JSON.stringify(payload), lastError]
  );
}

/**
 * Posts the room-charge part of an order's bill to the guest folio in integer
 * USD cents. Only tender paid with a room-charge payment type is posted.
 * If the PMS is unreachable the charge is queued for the background worker;
 * if the PMS refuses it, the order is marked FAILED and the reason returned.
 */
exports.postRoomChargeForOrderDB = async (tenantId, orderId, postedByName = "Bong POS") => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [orders] = await conn.query(
      `SELECT id, invoice_id, status, pms_reservation_id, pms_room_number, pms_guest_name, pms_charge_id, pms_sync_status
       FROM orders
       WHERE id = ? AND tenant_id = ?
       LIMIT 1`,
      [orderId, tenantId]
    );

    if (orders.length === 0) {
      throw pmsError(`Order #${orderId} not found`, 404, "ORDER_NOT_FOUND");
    }

    const order = orders[0];
    if (!order.pms_reservation_id) {
      throw pmsError(`Order #${orderId} is not linked to a hotel room.`, 400, "ROOM_REQUIRED");
    }
    if (order.status === "cancelled") {
      throw pmsError(`Order #${orderId} is cancelled.`, 400, "ORDER_CANCELLED");
    }
    if (order.pms_sync_status === "SYNCED" && order.pms_charge_id) {
      return { success: true, alreadySynced: true, charge_id: order.pms_charge_id, status: "SYNCED" };
    }
    if (!order.invoice_id) {
      throw pmsError(`Order #${orderId} has not been paid yet.`, 400, "ORDER_NOT_PAID");
    }

    const roomAmount = await getRoomChargeAmountForInvoice(conn, tenantId, order.invoice_id);
    const amountUsdCents = roomAmount > 0 ? await toUsdCents(conn, tenantId, roomAmount) : 0;
    if (amountUsdCents <= 0) {
      // Paid some other way (or comped): nothing goes to the folio.
      return { success: true, skipped: true, reason: "NO_ROOM_CHARGE_TENDER", status: order.pms_sync_status };
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
      throw pmsError("PMS integration is disabled.", 400, "PMS_DISABLED");
    }

    try {
      const pmsRes = await callPmsApi(pmsSettings, POST_CHARGE_PATH, { method: "POST", body: chargePayload });

      await conn.query(
        `UPDATE orders SET pms_charge_id = ?, pms_sync_status = 'SYNCED' WHERE id = ? AND tenant_id = ?`,
        [pmsRes.charge_id, order.id, tenantId]
      );

      return { success: true, queued: false, charge_id: pmsRes.charge_id, amount_usd_cents: amountUsdCents, status: "SYNCED" };
    } catch (apiError) {
      console.warn(`[PMS Integration] Charge post failed for Order #${order.id}:`, apiError.message);

      if (!isRetryable(apiError)) {
        await recordRejected(conn, tenantId, order.id, "POST_CHARGE", chargePayload, apiError.message);
        await conn.query(`UPDATE orders SET pms_sync_status = 'FAILED' WHERE id = ? AND tenant_id = ?`, [order.id, tenantId]);
        return { success: false, rejected: true, status: "FAILED", message: `Hotel PMS refused the room charge: ${apiError.message}` };
      }

      await enqueue(conn, tenantId, order.id, "POST_CHARGE", chargePayload, apiError.message);
      await conn.query(`UPDATE orders SET pms_sync_status = 'PENDING' WHERE id = ? AND tenant_id = ?`, [order.id, tenantId]);

      return { success: true, queued: true, status: "PENDING", message: "Hotel PMS is unreachable. The room charge is queued and will be sent automatically." };
    }
  } finally {
    conn.release();
  }
};

/**
 * Voids a posted charge in PMS when an order is cancelled or its bill voided.
 * A charge still waiting in the queue is simply cancelled.
 */
exports.voidRoomChargeForOrderDB = async (tenantId, orderId, voidReason = "Order cancelled") => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [orders] = await conn.query(
      `SELECT id, pms_reservation_id, pms_charge_id, pms_sync_status FROM orders WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [orderId, tenantId]
    );

    if (orders.length === 0) {
      throw pmsError(`Order #${orderId} not found`, 404, "ORDER_NOT_FOUND");
    }

    const order = orders[0];
    if (!order.pms_reservation_id) {
      return { success: true, message: "Order is not linked to a hotel room." };
    }

    if (!order.pms_charge_id) {
      // Never reached the PMS: stop the queued post instead.
      const [cancelled] = await conn.query(
        `UPDATE pms_sync_queue SET status = 'CANCELLED', last_error = ?
         WHERE tenant_id = ? AND order_id = ? AND action = 'POST_CHARGE' AND status = 'PENDING'`,
        [voidReason, tenantId, order.id]
      );
      if (cancelled.affectedRows > 0 || order.pms_sync_status === "PENDING") {
        await conn.query(`UPDATE orders SET pms_sync_status = 'VOIDED' WHERE id = ? AND tenant_id = ?`, [order.id, tenantId]);
      }
      return { success: true, message: "No PMS charge was posted for this order." };
    }

    if (order.pms_sync_status === "VOIDED") {
      return { success: true, is_void: true, charge_id: order.pms_charge_id, status: "VOIDED" };
    }

    const voidPayload = {
      charge_id: order.pms_charge_id,
      pos_order_id: String(order.id),
      void_reason: voidReason || "Order cancelled in POS",
    };

    const pmsSettings = await exports.getPmsSettingsDB(tenantId);
    if (!pmsSettings || !pmsSettings.is_enabled) {
      // Keep the void so it goes out once the integration is back on.
      await enqueue(conn, tenantId, order.id, "VOID_CHARGE", voidPayload, "PMS integration is disabled.");
      return { success: true, queued: true, message: "PMS integration is off. Void request queued." };
    }

    try {
      const pmsRes = await callPmsApi(pmsSettings, VOID_CHARGE_PATH, { method: "POST", body: voidPayload });
      await conn.query(`UPDATE orders SET pms_sync_status = 'VOIDED' WHERE id = ? AND tenant_id = ?`, [order.id, tenantId]);
      return { success: true, is_void: true, charge_id: pmsRes.charge_id, status: "VOIDED" };
    } catch (apiError) {
      console.warn(`[PMS Integration] Void failed for Order #${order.id}:`, apiError.message);

      if (!isRetryable(apiError)) {
        await recordRejected(conn, tenantId, order.id, "VOID_CHARGE", voidPayload, apiError.message);
        return { success: false, rejected: true, message: `Hotel PMS refused the void: ${apiError.message}` };
      }

      await enqueue(conn, tenantId, order.id, "VOID_CHARGE", voidPayload, apiError.message);
      return { success: true, queued: true, message: "PMS is offline. Void request queued for automatic retry." };
    }
  } finally {
    conn.release();
  }
};

/**
 * Retrieves the retry queue items for monitoring.
 */
/**
 * Paid room-service bills whose Charge to Room part has not reached the hotel:
 * never posted (auto-post off) or refused by the PMS. Charges already waiting
 * in the retry queue are left out; the queue sends those itself.
 */
exports.getUnpostedRoomChargesDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const typeIds = await getRoomChargeTypeIds(conn, tenantId);
    if (typeIds.length === 0) return [];
    const [rows] = await conn.query(
      `SELECT o.id, o.date, o.pms_room_number, o.pms_guest_name, o.pms_sync_status,
              SUM(rp.amount + COALESCE(rp.tip_amount, 0)) AS room_amount
       FROM orders o
       JOIN register_payments rp
         ON rp.tenant_id = o.tenant_id AND rp.invoice_id = o.invoice_id AND rp.payment_type_id IN (?)
       WHERE o.tenant_id = ?
         AND o.pms_reservation_id IS NOT NULL
         AND o.invoice_id IS NOT NULL
         AND o.pms_charge_id IS NULL
         AND o.pms_sync_status IN ('NONE', 'FAILED')
         AND o.status <> 'cancelled'
         AND o.date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY o.id
       HAVING room_amount > 0
       ORDER BY o.id DESC
       LIMIT 100`,
      [typeIds, tenantId]
    );
    return rows;
  } finally {
    conn.release();
  }
};

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
 * Sends queued charges and voids to the PMS. Each item is claimed with an
 * atomic status change first, so two runs (worker + manual retry) never send
 * the same item twice.
 */
exports.processSyncQueueDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const pmsSettings = await exports.getPmsSettingsDB(tenantId);
    if (!pmsSettings || !pmsSettings.is_enabled) {
      return { processed: 0, message: "PMS is disabled." };
    }

    // A run that died mid-item leaves it PROCESSING: hand it back after 5 minutes.
    await conn.query(
      `UPDATE pms_sync_queue SET status = 'PENDING'
       WHERE tenant_id = ? AND status = 'PROCESSING' AND updated_at < NOW() - INTERVAL 5 MINUTE`,
      [tenantId]
    );

    const [queueItems] = await conn.query(
      `SELECT * FROM pms_sync_queue
       WHERE tenant_id = ? AND status = 'PENDING' AND attempts < ?
       ORDER BY id ASC
       LIMIT 20`,
      [tenantId, MAX_SYNC_ATTEMPTS]
    );

    let processedCount = 0;

    for (const item of queueItems) {
      const [claim] = await conn.query(
        `UPDATE pms_sync_queue SET status = 'PROCESSING', updated_at = NOW() WHERE id = ? AND status = 'PENDING'`,
        [item.id]
      );
      if (claim.affectedRows === 0) continue;

      let payload = item.payload;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          // ignore
        }
      }

      if (item.action === "POST_CHARGE") {
        const [orderRows] = await conn.query(
          `SELECT status, pms_sync_status, pms_charge_id FROM orders WHERE id = ? AND tenant_id = ? LIMIT 1`,
          [item.order_id, tenantId]
        );
        const o = orderRows[0];
        if (!o || o.status === "cancelled" || o.pms_sync_status === "VOIDED" || o.pms_charge_id) {
          await conn.query(`UPDATE pms_sync_queue SET status = 'CANCELLED', updated_at = NOW() WHERE id = ?`, [item.id]);
          continue;
        }
      }

      const endpoint = item.action === "POST_CHARGE" ? POST_CHARGE_PATH : VOID_CHARGE_PATH;

      try {
        const res = await callPmsApi(pmsSettings, endpoint, { method: "POST", body: payload });

        await conn.query(`UPDATE pms_sync_queue SET status = 'COMPLETED', updated_at = NOW() WHERE id = ?`, [item.id]);

        if (item.action === "POST_CHARGE" && res.charge_id) {
          await conn.query(
            `UPDATE orders SET pms_charge_id = ?, pms_sync_status = 'SYNCED' WHERE id = ? AND tenant_id = ?`,
            [res.charge_id, item.order_id, tenantId]
          );
        } else if (item.action === "VOID_CHARGE") {
          await conn.query(`UPDATE orders SET pms_sync_status = 'VOIDED' WHERE id = ? AND tenant_id = ?`, [item.order_id, tenantId]);
        }
        processedCount++;
      } catch (err) {
        const newAttempts = item.attempts + 1;
        const newStatus = !isRetryable(err) ? "REJECTED" : newAttempts >= MAX_SYNC_ATTEMPTS ? "FAILED" : "PENDING";
        await conn.query(
          `UPDATE pms_sync_queue SET attempts = ?, status = ?, last_error = ?, updated_at = NOW() WHERE id = ?`,
          [newAttempts, newStatus, err.message, item.id]
        );
        if (item.action === "POST_CHARGE" && newStatus !== "PENDING") {
          await conn.query(`UPDATE orders SET pms_sync_status = 'FAILED' WHERE id = ? AND tenant_id = ?`, [item.order_id, tenantId]);
        }
      }
    }

    return { total: queueItems.length, processed: processedCount };
  } finally {
    conn.release();
  }
};

/**
 * Background worker: every minute, sends whatever is waiting in any tenant's queue.
 */
exports.startPmsSyncWorker = (intervalMs = 60 * 1000) => {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const conn = await getMySqlPromiseConnection();
      let tenants;
      try {
        const [rows] = await conn.query(
          `SELECT DISTINCT tenant_id FROM pms_sync_queue
           WHERE status = 'PENDING' OR (status = 'PROCESSING' AND updated_at < NOW() - INTERVAL 5 MINUTE)`
        );
        tenants = rows.map((r) => r.tenant_id);
      } finally {
        conn.release();
      }
      for (const tenantId of tenants) {
        try {
          const result = await exports.processSyncQueueDB(tenantId);
          if (result.processed) console.log(`[PMS sync] tenant ${tenantId}: sent ${result.processed}/${result.total}`);
        } catch (error) {
          console.error(`[PMS sync] tenant ${tenantId} failed:`, error.message);
        }
      }
    } catch (error) {
      console.error("[PMS sync] worker error:", error.message);
    } finally {
      running = false;
    }
  };
  setTimeout(run, 30 * 1000).unref();
  setInterval(run, intervalMs).unref();
};

/**
 * After a bill is paid: posts the room-charge part to the folio when the
 * tenant has auto-post on. Never throws; the sale is already final.
 */
exports.autoPostRoomChargeDB = async (tenantId, orderId, postedByName) => {
  try {
    const settings = await exports.getPmsSettingsDB(tenantId);
    if (!settings?.is_enabled) return null;
    if (!Number(settings.auto_post_on_settle)) {
      return { success: true, skipped: true, reason: "AUTO_POST_OFF" };
    }
    const result = await exports.postRoomChargeForOrderDB(tenantId, orderId, postedByName);
    return result?.skipped ? null : result;
  } catch (error) {
    console.warn(`[PMS] Auto-post failed for Order #${orderId}:`, error.message);
    return { success: false, message: error.message };
  }
};

/** First order in the list that is linked to a hotel room. */
exports.getRoomLinkForOrdersDB = async (tenantId, orderIds) => {
  const ids = (orderIds || []).map(Number).filter(Boolean);
  if (ids.length === 0) return null;
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT id, pms_reservation_id, pms_room_number FROM orders
       WHERE tenant_id = ? AND id IN (?) AND pms_reservation_id IS NOT NULL
       ORDER BY id ASC LIMIT 1`,
      [tenantId, ids]
    );
    return rows[0] || null;
  } finally {
    conn.release();
  }
};

/**
 * Tries a connection with the values typed in the settings form (falling back
 * to the stored API key when the key field is blank). Nothing is saved.
 */
exports.testPmsConnectionDB = async (tenantId, { pms_base_url, pms_property_id, pms_api_key }) => {
  const stored = await exports.getPmsSettingsDB(tenantId);
  const config = {
    pms_base_url: (pms_base_url || stored.pms_base_url || DEFAULT_PMS_URL).trim(),
    pms_property_id: (pms_property_id || "").trim() || stored.pms_property_id,
    pms_api_key: (pms_api_key || "").trim() || stored.pms_api_key,
  };
  try {
    const data = await callPmsApi(config, "/api/v1/integrations/pos/checked-in-rooms", { timeoutMs: 6000 });
    return { ok: true, checked_in: Number(data?.total ?? (data?.rooms || []).length) || 0 };
  } catch (error) {
    let message = error.message;
    if (error.isConfigError) message = "Enter the PMS address, property ID and API key.";
    else if (error.isNetworkError) message = `Cannot reach the PMS at ${config.pms_base_url}. Check the address and that the PMS is running.`;
    else if (error.status === 401) message = "The PMS rejected the API key or property ID.";
    return { ok: false, message };
  }
};
