/**
 * Line-level comp / void / discount with a reason and manager approval.
 *
 * Two paths:
 *  - Unsent cart lines: the POS asks for approval first (authorizeUnsentAdjustmentDB),
 *    gets a signed single-use token, and sends it with the order. createOrderDB
 *    verifies the token and links the audit row to the stored order item.
 *  - Lines already sent to the kitchen: adjustSentItemDB changes the stored line
 *    directly (void = status 'cancelled', comp/discount = new unit price).
 *
 * Every action writes a row to pos_line_adjustments for the audit report.
 */
const jsonwebtoken = require("jsonwebtoken");
const { CONFIG } = require("../config");
const { getMySqlPromiseConnection } = require("../config/mysql.db");

const REASON_CODES = {
  void: ["WRONG_ITEM", "CUSTOMER_CHANGED_MIND", "KITCHEN_ERROR", "LONG_WAIT", "QUALITY", "DUPLICATE", "OTHER"],
  comp: ["QUALITY", "LONG_WAIT", "MANAGER_COMP", "STAFF_MEAL", "VIP_GUEST", "BIRTHDAY", "OTHER"],
  discount: ["QUALITY", "LONG_WAIT", "LOYAL_GUEST", "STAFF_DISCOUNT", "PRICE_MATCH", "OTHER"],
};
exports.REASON_CODES = REASON_CODES;
const ACTIONS = Object.keys(REASON_CODES);

function adjustError(message, statusCode = 400, code = "LINE_ADJUST_INVALID") {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Unit price after a discount. */
function discountedPrice(base, discountType, discountValue) {
  const v = Math.max(0, Number(discountValue) || 0);
  if (discountType === "percent") return round2(Math.max(0, base * (1 - Math.min(v, 100) / 100)));
  return round2(Math.max(0, base - v));
}
exports.discountedPrice = discountedPrice;

function validateInput({ action, reasonCode, note, discountType, discountValue }) {
  if (!ACTIONS.includes(action)) throw adjustError("Unknown action");
  if (!REASON_CODES[action].includes(reasonCode)) throw adjustError("Choose a reason");
  if (reasonCode === "OTHER" && !String(note || "").trim()) throw adjustError("Add a note for 'Other'");
  if (action === "discount") {
    if (!["percent", "fixed"].includes(discountType)) throw adjustError("Choose % or amount");
    if (!(Number(discountValue) > 0)) throw adjustError("Enter a discount");
  }
}

async function insertAudit(conn, tenantId, row) {
  const [res] = await conn.query(
    `INSERT INTO pos_line_adjustments
     (tenant_id, action, reason_code, note, order_id, order_item_id, item_id, item_title, quantity, amount, sent_to_kitchen, performed_by, approved_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      row.action,
      row.reasonCode,
      row.note ? String(row.note).slice(0, 255) : null,
      row.orderId || null,
      row.orderItemId || null,
      row.itemId || null,
      row.itemTitle ? String(row.itemTitle).slice(0, 255) : null,
      Math.max(1, parseInt(row.quantity, 10) || 1),
      round2(row.amount),
      row.sentToKitchen ? 1 : 0,
      row.performedBy || null,
      row.approvedBy || null,
    ]
  );
  return res.insertId;
}

/**
 * Approve a comp / discount on a cart line that has not been sent yet.
 * Returns { token, auditId }; the token travels on the cart line as `adjust.approval`.
 */
exports.authorizeUnsentAdjustmentDB = async (tenantId, input) => {
  validateInput(input);
  if (input.action === "void") throw adjustError("Unsent lines are removed, not voided");
  const conn = await getMySqlPromiseConnection();
  try {
    const auditId = await insertAudit(conn, tenantId, { ...input, sentToKitchen: false });
    const token = jsonwebtoken.sign(
      { kind: "line_adjust", tenant_id: tenantId, audit_id: auditId, action: input.action },
      CONFIG.JWT_SECRET
    );
    return { token, auditId };
  } finally {
    conn.release();
  }
};

/**
 * Inside createOrderDB: verify approvals for adjusted cart lines and stamp the
 * stored order items. `insertedIds[i]` is the order_items.id of cartItems[i].
 */
exports.applyCartAdjustmentsTx = async (conn, tenantId, orderId, cartItems, insertedIds, username) => {
  for (let i = 0; i < cartItems.length; i++) {
    const adj = cartItems[i]?.adjust;
    if (!adj || !adj.type) continue;

    let payload;
    try {
      payload = jsonwebtoken.verify(String(adj.approval || ""), CONFIG.JWT_SECRET);
    } catch {
      throw adjustError("Comp/discount approval is missing or invalid. Approve it again.", 403, "LINE_ADJUST_UNAUTHORIZED");
    }
    if (payload.kind !== "line_adjust" || Number(payload.tenant_id) !== Number(tenantId) || payload.action !== adj.type) {
      throw adjustError("Comp/discount approval does not match this line.", 403, "LINE_ADJUST_UNAUTHORIZED");
    }

    const [[audit]] = await conn.query(
      `SELECT id, reason_code, note, approved_by FROM pos_line_adjustments
       WHERE id = ? AND tenant_id = ? AND order_item_id IS NULL FOR UPDATE`,
      [payload.audit_id, tenantId]
    );
    if (!audit) {
      throw adjustError("This comp/discount approval was already used.", 403, "LINE_ADJUST_UNAUTHORIZED");
    }

    const orderItemId = insertedIds[i];
    await conn.query(
      `UPDATE order_items
       SET original_price = ?, adjust_type = ?, adjust_reason = ?, adjust_note = ?,
           adjust_discount_type = ?, adjust_discount_value = ?,
           adjusted_by = ?, adjust_approved_by = ?, adjusted_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [
        round2(adj.original_price ?? cartItems[i].price),
        adj.type,
        audit.reason_code,
        audit.note,
        adj.type === "discount" ? adj.discount_type || null : null,
        adj.type === "discount" ? Number(adj.discount_value) || 0 : null,
        username || null,
        audit.approved_by,
        orderItemId,
        tenantId,
      ]
    );
    await conn.query(
      `UPDATE pos_line_adjustments SET order_id = ?, order_item_id = ?, sent_to_kitchen = 0 WHERE id = ? AND tenant_id = ?`,
      [orderId, orderItemId, audit.id, tenantId]
    );
  }
};

/**
 * Void / comp / discount / restore a line that is already on an open order.
 * Returns the affected line (with table/token/station for the void ticket).
 */
exports.adjustSentItemDB = async (tenantId, orderItemId, input) => {
  const { action, quantity, username, approvedBy } = input;
  if (action !== "restore") validateInput(input);

  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [[item]] = await conn.query(
      `SELECT oi.*, o.payment_status, o.status AS order_status, o.token_no, o.table_id, o.delivery_type,
              mi.title AS item_title, miv.title AS variant_title, st.table_title,
              ks.name AS station_name
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id
       LEFT JOIN menu_items mi ON mi.id = oi.item_id AND mi.tenant_id = oi.tenant_id
       LEFT JOIN menu_item_variants miv ON miv.id = oi.variant_id AND miv.item_id = oi.item_id
       LEFT JOIN store_tables st ON st.id = o.table_id AND st.tenant_id = o.tenant_id
       LEFT JOIN kitchen_stations ks ON ks.id = oi.kitchen_station_id AND ks.tenant_id = oi.tenant_id
       WHERE oi.id = ? AND oi.tenant_id = ?
       FOR UPDATE`,
      [orderItemId, tenantId]
    );

    if (!item) throw adjustError("Item not found", 404, "NOT_FOUND");
    if (item.status === "cancelled") throw adjustError("This item is already voided");
    if (item.payment_status === "paid" || ["completed", "cancelled"].includes(item.order_status)) {
      throw adjustError("This order is closed. Use a refund instead.", 409, "ORDER_CLOSED");
    }

    const lineQty = Number(item.quantity) || 1;
    let qty = Math.min(lineQty, Math.max(1, parseInt(quantity, 10) || lineQty));
    // A combo is voided as a whole (with its components); comps/discounts apply to its price line.
    if (Number(item.is_combo_parent) === 1 && action === "void") qty = lineQty;
    if (item.combo_parent_id && action !== "restore") {
      throw adjustError("This item is part of a combo. Adjust the combo line instead.");
    }
    const currentPrice = Number(item.price) || 0;
    const basePrice = item.original_price !== null && item.original_price !== undefined ? Number(item.original_price) : currentPrice;

    // Partial quantity: split the line so only `qty` units change.
    let targetId = item.id;
    if (qty < lineQty && action !== "restore") {
      await conn.query(`UPDATE order_items SET quantity = quantity - ? WHERE id = ? AND tenant_id = ?`, [qty, item.id, tenantId]);
      const [ins] = await conn.query(
        `INSERT INTO order_items
         (order_id, item_id, variant_id, price, quantity, status, date, notes, addons, tenant_id, kitchen_station_id,
          original_price, adjust_type, adjust_reason, adjust_note, adjust_discount_type, adjust_discount_value, adjusted_by, adjust_approved_by, adjusted_at)
         SELECT order_id, item_id, variant_id, price, ?, status, date, notes, addons, tenant_id, kitchen_station_id,
          original_price, adjust_type, adjust_reason, adjust_note, adjust_discount_type, adjust_discount_value, adjusted_by, adjust_approved_by, adjusted_at
         FROM order_items WHERE id = ? AND tenant_id = ?`,
        [qty, item.id, tenantId]
      );
      targetId = ins.insertId;
    }

    let amount = 0;
    if (action === "void") {
      amount = currentPrice * qty;
      if (Number(item.is_combo_parent) === 1) {
        await conn.query(
          `UPDATE order_items
           SET status = 'cancelled', adjust_type = 'void', adjust_reason = ?, adjusted_by = ?, adjust_approved_by = ?, adjusted_at = NOW()
           WHERE combo_parent_id = ? AND tenant_id = ? AND status <> 'cancelled'`,
          [input.reasonCode, username, approvedBy, item.id, tenantId]
        );
      }
      await conn.query(
        `UPDATE order_items
         SET status = 'cancelled', adjust_type = 'void', adjust_reason = ?, adjust_note = ?,
             adjusted_by = ?, adjust_approved_by = ?, adjusted_at = NOW()
         WHERE id = ? AND tenant_id = ?`,
        [input.reasonCode, input.note || null, username, approvedBy, targetId, tenantId]
      );
    } else if (action === "comp") {
      amount = currentPrice * qty;
      await conn.query(
        `UPDATE order_items
         SET original_price = ?, price = 0, adjust_type = 'comp', adjust_reason = ?, adjust_note = ?,
             adjust_discount_type = NULL, adjust_discount_value = NULL,
             adjusted_by = ?, adjust_approved_by = ?, adjusted_at = NOW()
         WHERE id = ? AND tenant_id = ?`,
        [basePrice, input.reasonCode, input.note || null, username, approvedBy, targetId, tenantId]
      );
    } else if (action === "discount") {
      const newPrice = discountedPrice(basePrice, input.discountType, input.discountValue);
      amount = (currentPrice - newPrice) * qty;
      await conn.query(
        `UPDATE order_items
         SET original_price = ?, price = ?, adjust_type = 'discount', adjust_reason = ?, adjust_note = ?,
             adjust_discount_type = ?, adjust_discount_value = ?,
             adjusted_by = ?, adjust_approved_by = ?, adjusted_at = NOW()
         WHERE id = ? AND tenant_id = ?`,
        [basePrice, newPrice, input.reasonCode, input.note || null, input.discountType, Number(input.discountValue), username, approvedBy, targetId, tenantId]
      );
    } else if (action === "restore") {
      if (!item.adjust_type) throw adjustError("Nothing to undo on this line");
      amount = (basePrice - currentPrice) * lineQty;
      await conn.query(
        `UPDATE order_items
         SET price = COALESCE(original_price, price), original_price = NULL, adjust_type = NULL, adjust_reason = NULL,
             adjust_note = NULL, adjust_discount_type = NULL, adjust_discount_value = NULL,
             adjusted_by = NULL, adjust_approved_by = NULL, adjusted_at = NULL
         WHERE id = ? AND tenant_id = ?`,
        [targetId, tenantId]
      );
    } else {
      throw adjustError("Unknown action");
    }

    await insertAudit(conn, tenantId, {
      action,
      reasonCode: action === "restore" ? "UNDO" : input.reasonCode,
      note: input.note,
      orderId: item.order_id,
      orderItemId: targetId,
      itemId: item.item_id,
      itemTitle: item.item_title,
      quantity: action === "restore" ? lineQty : qty,
      amount,
      sentToKitchen: true,
      performedBy: username,
      approvedBy,
    });

    await conn.commit();

    let addons = [];
    try {
      addons = item.addons ? JSON.parse(item.addons) : [];
    } catch {
      addons = [];
    }

    return {
      action,
      orderId: item.order_id,
      orderItemId: targetId,
      quantity: action === "restore" ? lineQty : qty,
      itemStatus: item.status,
      ticket: {
        tokenNo: item.token_no,
        tableId: item.table_id,
        tableName: item.table_title,
        deliveryType: item.delivery_type,
        stationName: item.station_name,
        kitchenStationId: item.kitchen_station_id,
        item: {
          id: item.item_id,
          title: item.item_title,
          variant: item.variant_title ? { title: item.variant_title } : null,
          quantity: qty,
          notes: input.note ? `VOID: ${input.note}` : `VOID: ${String(input.reasonCode || "").replace(/_/g, " ")}`,
          kitchen_station_id: item.kitchen_station_id,
          addons_ids: addons,
        },
      },
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

/** Audit report rows for a date range. */
exports.getLineAdjustmentsDB = async (tenantId, { from, to, limit = 500 } = {}) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const params = [tenantId];
    let where = "tenant_id = ?";
    if (from) {
      where += " AND created_at >= ?";
      params.push(from);
    }
    if (to) {
      where += " AND created_at < DATE_ADD(?, INTERVAL 1 DAY)";
      params.push(to);
    }
    params.push(Math.min(Number(limit) || 500, 2000));
    const [rows] = await conn.query(
      `SELECT * FROM pos_line_adjustments WHERE ${where} ORDER BY created_at DESC LIMIT ?`,
      params
    );
    return rows;
  } finally {
    conn.release();
  }
};

/** Read-only check run before an invoice is written (createOrderAndInvoice). */
exports.precheckCartAdjustmentsDB = async (tenantId, cartItems = []) => {
  const adjusted = cartItems.filter((ci) => ci?.adjust?.type);
  if (adjusted.length === 0) return;
  const conn = await getMySqlPromiseConnection();
  try {
    for (const line of adjusted) {
      let payload;
      try {
        payload = jsonwebtoken.verify(String(line.adjust.approval || ""), CONFIG.JWT_SECRET);
      } catch {
        throw adjustError("Comp/discount approval is missing or invalid. Approve it again.", 403, "LINE_ADJUST_UNAUTHORIZED");
      }
      if (payload.kind !== "line_adjust" || Number(payload.tenant_id) !== Number(tenantId) || payload.action !== line.adjust.type) {
        throw adjustError("Comp/discount approval does not match this line.", 403, "LINE_ADJUST_UNAUTHORIZED");
      }
      const [[audit]] = await conn.query(
        `SELECT id FROM pos_line_adjustments WHERE id = ? AND tenant_id = ? AND order_item_id IS NULL`,
        [payload.audit_id, tenantId]
      );
      if (!audit) throw adjustError("This comp/discount approval was already used.", 403, "LINE_ADJUST_UNAUTHORIZED");
    }
  } finally {
    conn.release();
  }
};
