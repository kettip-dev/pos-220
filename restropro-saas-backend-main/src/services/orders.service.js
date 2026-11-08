const { CONFIG } = require("../config");
const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { rotateTablePinsByOrderIdsDB } = require("./settings.service");
const { processLoyaltyOnCheckoutTx } = require("./loyalty.service");
const { normalisePaymentLines, recordPaymentsTx, writeAuditTx } = require("./register.service");
const { prepareCreditSaleTx, markInvoiceOnAccountTx } = require("./customer_credit.service");

exports.getOrdersDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {

    const sql = `
    SELECT
      o.id,
      o.date,
      o.delivery_type,
      o.customer_type,
      o.customer_id,
      c. \`name\` AS customer_name,
      o.table_id,
      st.table_title,
      st. \`floor\`,
      o.status,
      o.payment_status,
      o.split_status,
      o.token_no,
      o.customer_group_id,
      o.customer_group_name,
      o.customer_group_discount_total
    FROM
      orders o
      LEFT JOIN customers c ON o.customer_id = c.phone AND c.tenant_id = o.tenant_id
      LEFT JOIN store_tables st ON o.table_id = st.id
    WHERE
      date >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      AND date <= DATE_ADD(NOW(), INTERVAL 1 DAY)
      AND o.status NOT IN ('completed', 'cancelled')
      AND o.tenant_id = ?
    `;

    const [kitchenOrders] = await conn.query(sql, [tenantId]);

    let kitchenOrdersItems = [];
    let addons = [];

    if(kitchenOrders.length > 0) {
      const orderIds = kitchenOrders.map(o=>o.id);
      const sql2 = `
      SELECT
        oi.id,
        oi.order_id,
        oi.item_id,
        COALESCE(oi.custom_title, mi.title) AS item_title,
        oi.variant_id,
        miv.title as variant_title,
        oi.price,
        oi.quantity,
        oi.status,
        oi.date,
        oi.addons,
        oi.notes,
        oi.kitchen_station_id,
        ks.name AS station_name,
        ks.color AS station_color,
        ks.icon AS station_icon
      FROM
        order_items oi
        LEFT JOIN menu_items mi ON oi.item_id = mi.id
        LEFT JOIN menu_item_variants miv ON oi.item_id = miv.item_id AND oi.variant_id = miv.id
        LEFT JOIN kitchen_stations ks ON oi.kitchen_station_id = ks.id
        
      WHERE oi.order_id IN (?)
      `;
      const [kitchenOrdersItemsResult] = await conn.query(sql2, [orderIds]);
      kitchenOrdersItems = kitchenOrdersItemsResult;

      const rawAddons = kitchenOrdersItems.flatMap((o) => {
        try {
          return o.addons ? JSON.parse(o.addons) : [];
        } catch (e) {
          return [];
        }
      });

      const numericIds = [...new Set(
        rawAddons
          .map((a) => (typeof a === "object" && a !== null ? a.id : a))
          .filter((a) => a !== null && a !== undefined && !isNaN(Number(a)))
          .map(Number)
      )];

      const titleNames = [...new Set(
        rawAddons
          .map((a) => (typeof a === "object" && a !== null ? a.title : a))
          .filter((a) => typeof a === "string" && isNaN(Number(a)) && a.trim().length > 0)
      )];

      if (numericIds.length > 0 || titleNames.length > 0) {
        const whereClauses = [];
        const queryParams = [];

        if (numericIds.length > 0) {
          whereClauses.push(`id IN (?)`);
          queryParams.push(numericIds);
        }
        if (titleNames.length > 0) {
          whereClauses.push(`title IN (?)`);
          queryParams.push(titleNames);
        }

        queryParams.push(tenantId);

        const [addonsResult] = await conn.query(
          `SELECT id, item_id, title, price FROM menu_item_addons WHERE (${whereClauses.join(" OR ")}) AND tenant_id = ?;`,
          queryParams
        );
        addons = addonsResult || [];
      }
    }
    let subInvoices = [];
    const splitOrderIds = kitchenOrders.filter((o) => o.split_status === "split_in_progress").map((o) => o.id);
    if (splitOrderIds.length > 0) {
      const [subs] = await conn.query(
        `SELECT * FROM order_sub_invoices WHERE order_id IN (?) AND tenant_id = ? ORDER BY id ASC`,
        [splitOrderIds, tenantId]
      );
      if (subs.length > 0) {
        const subIds = subs.map((s) => s.id);
        const [subItems] = await conn.query(
          `SELECT * FROM order_sub_invoice_items WHERE order_sub_invoice_id IN (?) AND tenant_id = ?`,
          [subIds, tenantId]
        );
        subInvoices = subs.map((s) => ({
          ...s,
          items: subItems.filter((it) => it.order_sub_invoice_id === s.id),
        }));
      }
    }

    return {
      kitchenOrders,
      kitchenOrdersItems,
      addons,
      subInvoices,
    };

  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
}
};

exports.updateOrderItemStatusDB = async (orderItemId, status, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {

    const sql = `
    UPDATE order_items SET
    status = ?
    WHERE id = ? AND tenant_id = ?;
    `;

    await conn.query(sql, [status, orderItemId, tenantId]);

    return;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
}
};

const autoUnlinkTablesByOrderIdsDB = async (tenantId, orderIds, conn) => {
  try {
    if (!orderIds || !orderIds.length) return;
    const cleanIds = orderIds.map((id) => Number(id)).filter(Boolean);
    if (!cleanIds.length) return;
    const orderIdsText = cleanIds.join(",");

    const [tableRows] = await conn.query(
      `SELECT DISTINCT table_id FROM orders WHERE id IN (${orderIdsText}) AND tenant_id = ? AND table_id IS NOT NULL`,
      [tenantId]
    );
    if (!tableRows.length) return;
    const tableIds = tableRows.map((r) => String(r.table_id));

    const [layouts] = await conn.query(
      `SELECT id, floor, merged_pairs FROM store_floor_layouts WHERE tenant_id = ? AND merged_pairs IS NOT NULL`,
      [tenantId]
    );

    for (const layout of layouts) {
      if (!layout.merged_pairs) continue;
      let pairs = [];
      try {
        pairs = typeof layout.merged_pairs === "string" ? JSON.parse(layout.merged_pairs) : layout.merged_pairs;
      } catch {
        pairs = [];
      }
      if (!Array.isArray(pairs) || !pairs.length) continue;

      const updated = pairs.filter(([a, b]) => !tableIds.includes(String(a)) && !tableIds.includes(String(b)));
      if (updated.length !== pairs.length) {
        await conn.query(
          `UPDATE store_floor_layouts SET merged_pairs = ? WHERE id = ? AND tenant_id = ?`,
          [JSON.stringify(updated), layout.id, tenantId]
        );
      }
    }
  } catch (err) {
    console.error("autoUnlinkTablesByOrderIdsDB error:", err);
  }
};

exports.cancelOrderDB = async (orderIds, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const orderIdsText = orderIds.join(",");

    await conn.query(
      `UPDATE orders SET status = 'cancelled' WHERE id IN (${orderIdsText}) AND tenant_id = ?;`,
      [tenantId]
    );
    await conn.query(
      `UPDATE order_items SET status = 'cancelled' WHERE order_id IN (${orderIdsText}) AND tenant_id = ?;`,
      [tenantId]
    );

    await autoUnlinkTablesByOrderIdsDB(tenantId, orderIds, conn);

    return;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};


exports.completeOrderDB = async (orderIds, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {

    const orderIdsText = orderIds.join(",");

    const sql = `
    UPDATE orders SET
    status = 'completed'
    WHERE id IN (${orderIdsText}) AND tenant_id = ?;
    `;

    await conn.query(sql, [tenantId]);
    await rotateTablePinsByOrderIdsDB(tenantId, orderIds);
    await autoUnlinkTablesByOrderIdsDB(tenantId, orderIds, conn);

    return;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.getInvoiceIdFromOrderIdsDB = async (orderIds, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {

    const orderIdsText = orderIds.join(",");

    const sql = `
    SELECT
      HEX(AES_ENCRYPT(hex(invoice_id), ?)) as invoice_id,
      customer_id
    FROM
      orders o
    WHERE
      id IN (${orderIdsText}) AND tenant_id = ?
    LIMIT
      1
    `;

    const [result] = await conn.query(sql, [CONFIG.ENCRYPTION_KEY, tenantId]);

    return result[0];
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.getCustomerPhoneFromOrderIdsDB = async (orderIds, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
    const [rows] = await conn.query(
      `SELECT customer_id FROM orders WHERE id IN (?) AND tenant_id = ? AND customer_id IS NOT NULL LIMIT 1`,
      [ids, tenantId]
    );
    return rows[0]?.customer_id || null;
  } catch (error) {
    console.error(error);
    return null;
  } finally {
    conn.release();
  }
};

exports.getEncryptedInvoiceIdDB = async (invoiceId, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {

    const sql = `
    SELECT
      HEX(AES_ENCRYPT(hex(invoice_id), ?)) as invoice_id,
      customer_id
    FROM
      orders o
    WHERE
      invoice_id = ? AND tenant_id = ?
    LIMIT
      1
    `;

    const [result] = await conn.query(sql, [CONFIG.ENCRYPTION_KEY, invoiceId, tenantId]);

    return result[0];
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.checkInvoiceIdDB = async (encryptedInvoiceId) => {
  const conn = await getMySqlPromiseConnection();
  try {

    const sql = `
    SELECT
      invoice_id,
      customer_id
    FROM
      orders o
    WHERE
      AES_DECRYPT(UNHEX(?), ?) = HEX(invoice_id)
    LIMIT
      1
    `;

    const [result] = await conn.query(sql, [encryptedInvoiceId, CONFIG.ENCRYPTION_KEY]);

    return result[0];
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.getOrdersPaymentSummaryDB = async (orderIdsToFindSummary, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const ids = Array.isArray(orderIdsToFindSummary)
      ? orderIdsToFindSummary.map(Number).filter(n => Number.isInteger(n) && n > 0)
      : String(orderIdsToFindSummary || '')
          .split(',')
          .map(s => Number(s.trim()))
          .filter(n => Number.isInteger(n) && n > 0);

    if (ids.length === 0) {
      return {
        kitchenOrders: [],
        kitchenOrdersItems: [],
        addons: []
      };
    }

    const sql = `
    SELECT
      o.id,
      o.date,
      o.delivery_type,
      o.customer_type,
      o.customer_id,
      c. \`name\` AS customer_name,
      o.table_id,
      st.table_title,
      st. \`floor\`,
      o.status,
      o.payment_status,
      o.split_status,
      o.token_no,
      o.customer_group_id,
      o.customer_group_name,
      o.customer_group_discount_total
    FROM
      orders o
      LEFT JOIN customers c ON o.customer_id = c.phone AND c.tenant_id = o.tenant_id
      LEFT JOIN store_tables st ON o.table_id = st.id
    WHERE
      date >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      AND date <= DATE_ADD(NOW(), INTERVAL 1 DAY)
      AND o.status NOT IN ('completed', 'cancelled')
      AND o.id IN (?) AND o.tenant_id = ?
    `;

    const [kitchenOrders] = await conn.query(sql, [ids, tenantId]);

    let kitchenOrdersItems = [];
    let addons = [];

    if(kitchenOrders.length > 0) {
      const orderIds = kitchenOrders.map(o=>o.id);
      const sql2 = `
      SELECT
        oi.id,
        oi.order_id,
        oi.item_id,
        COALESCE(oi.custom_title, mi.title) AS item_title,
        oi.variant_id,
        miv.title as variant_title,
        -- Comped / discounted lines are priced from the stored line price
        -- (which already includes add-ons); see orders.controller.
        CASE WHEN oi.adjust_type IN ('comp','discount') OR oi.custom_title IS NOT NULL OR oi.is_combo_parent = 1 OR oi.combo_parent_id IS NOT NULL THEN NULL ELSE miv.price END as variant_price,
        CASE WHEN oi.adjust_type IN ('comp','discount') OR oi.custom_title IS NOT NULL OR oi.is_combo_parent = 1 OR oi.combo_parent_id IS NOT NULL THEN oi.price ELSE mi.price END AS price,
        oi.is_combo_parent,
        oi.combo_parent_id,
        oi.custom_title,
        oi.original_price,
        oi.adjust_type,
        oi.adjust_reason,
        oi.adjust_discount_type,
        oi.adjust_discount_value,
        oi.course,
        oi.seat_no,
        oi.fire_status,
        mi.tax_id,
        t.title as tax_title,
        t.rate as tax_rate,
        t.type as tax_type,
        oi.quantity,
        oi.status,
        oi.date,
        oi.addons,
        oi.notes,
        oi.kitchen_station_id,
        ks.name AS station_name,
        ks.color AS station_color,
        ks.icon AS station_icon
      FROM
        order_items oi
        LEFT JOIN menu_items mi ON oi.item_id = mi.id
        LEFT JOIN menu_item_variants miv ON oi.item_id = miv.item_id AND oi.variant_id = miv.id
        LEFT JOIN taxes t ON mi.tax_id = t.id
        LEFT JOIN kitchen_stations ks ON oi.kitchen_station_id = ks.id

      WHERE oi.order_id IN (?) AND oi.status NOT IN ('cancelled')
      `;
      const [kitchenOrdersItemsResult] = await conn.query(sql2, [orderIds]);
      kitchenOrdersItems = kitchenOrdersItemsResult;

      const rawAddons = kitchenOrdersItems.flatMap((o) => {
        try {
          return o.addons ? JSON.parse(o.addons) : [];
        } catch (e) {
          return [];
        }
      });

      const numericIds = [...new Set(
        rawAddons
          .map((a) => (typeof a === "object" && a !== null ? a.id : a))
          .filter((a) => a !== null && a !== undefined && !isNaN(Number(a)))
          .map(Number)
      )];

      const titleNames = [...new Set(
        rawAddons
          .map((a) => (typeof a === "object" && a !== null ? a.title : a))
          .filter((a) => typeof a === "string" && isNaN(Number(a)) && a.trim().length > 0)
      )];

      if (numericIds.length > 0 || titleNames.length > 0) {
        const whereClauses = [];
        const queryParams = [];

        if (numericIds.length > 0) {
          whereClauses.push(`id IN (?)`);
          queryParams.push(numericIds);
        }
        if (titleNames.length > 0) {
          whereClauses.push(`title IN (?)`);
          queryParams.push(titleNames);
        }

        queryParams.push(tenantId);

        const [addonsResult] = await conn.query(
          `SELECT id, item_id, title, price FROM menu_item_addons WHERE (${whereClauses.join(" OR ")}) AND tenant_id = ?;`,
          queryParams
        );
        addons = addonsResult || [];
      }
    }


    let subInvoices = [];
    const splitOrderIds = kitchenOrders.filter((o) => o.split_status === "split_in_progress").map((o) => o.id);
    if (splitOrderIds.length > 0) {
      const [subs] = await conn.query(
        `SELECT * FROM order_sub_invoices WHERE order_id IN (?) AND tenant_id = ? ORDER BY id ASC`,
        [splitOrderIds, tenantId]
      );
      if (subs.length > 0) {
        const subIds = subs.map((s) => s.id);
        const [subItems] = await conn.query(
          `SELECT * FROM order_sub_invoice_items WHERE order_sub_invoice_id IN (?) AND tenant_id = ?`,
          [subIds, tenantId]
        );
        subInvoices = subs.map((s) => ({
          ...s,
          items: subItems.filter((it) => it.order_sub_invoice_id === s.id),
        }));
      }
    }

    return {
      kitchenOrders,
      kitchenOrdersItems,
      addons,
      subInvoices,
    };

  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
}
};

/**
 * `register` = { session, payments } ties the bill to a register session: the
 * tender lines (split tender, cash tendered/change) are checked against the
 * server-verified total and written to the drawer ledger in this transaction.
 */
exports.createInvoiceDB = async (subtotal, taxTotal, serviceChargeTotal, total, date, selectedPaymentType, tenantId, username = null, discountType = null, discountValue = 0, discountTotal = null, appliedPromotions = null, promotionDiscountTotal = 0, loyaltyPointsRedeemed = 0, customerPhone = null, orderId = null, customerGroupId = null, customerGroupName = null, customerGroupDiscountTotal = 0, register = null) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    let invoiceId = 0;

    const [invoiceSequence] = await conn.query("SELECT sequence_no FROM invoice_sequences WHERE tenant_id = ? LIMIT 1 FOR UPDATE", [tenantId]);
    invoiceId = invoiceSequence[0]?.sequence_no || 0;

    invoiceId += 1;

    let calcDiscountTotal = 0;
    const dVal = Number(discountValue || 0);
    const sub = Number(subtotal || 0);
    const tax = Number(taxTotal || 0);
    const service = Number(serviceChargeTotal || 0);
    const promoDiscount = Number(promotionDiscountTotal || 0);
    const groupDiscount = Number(customerGroupDiscountTotal || 0);

    if (discountType === 'fixed') {
      calcDiscountTotal = Math.min(Math.max(dVal, 0), sub);
    } else if (discountType === 'percentage') {
      const safePerc = Math.min(Math.max(dVal, 0), 100);
      calcDiscountTotal = (sub * safePerc) / 100;
    } else if (discountTotal !== null && discountTotal !== undefined) {
      calcDiscountTotal = Math.min(Math.max(Number(discountTotal || 0), 0), sub);
    }

    if (dVal === 0 && calcDiscountTotal === 0) {
      discountType = null;
    }

    // Verify and recalculate total = subtotal + taxTotal + serviceChargeTotal - discountTotal - promoDiscount - groupDiscount
    const allDiscounts = calcDiscountTotal + promoDiscount + groupDiscount;
    const expectedTotal = Math.max(0, sub + tax + service - allDiscounts);
    const verifiedTotal = Number(expectedTotal.toFixed(2));

    // Process Loyalty Points (earn & redeem)
    let pointsRedeemed = 0;
    let loyaltyDiscount = 0;
    let pointsEarned = 0;

    if (customerPhone) {
      const loyaltyRes = await processLoyaltyOnCheckoutTx(conn, {
        tenantId,
        customerPhone,
        invoiceId,
        orderId,
        payableTotal: verifiedTotal,
        requestedPointsRedeemed: loyaltyPointsRedeemed,
        userId: username,
      });
      pointsRedeemed = loyaltyRes.pointsRedeemed;
      loyaltyDiscount = loyaltyRes.loyaltyDiscount;
      pointsEarned = loyaltyRes.pointsEarned;
    }

    const finalPayableTotal = Math.max(0, Number((verifiedTotal - loyaltyDiscount).toFixed(2)));

    // Pay Later: tender lines are only a deposit; the rest goes on the customer's account.
    const credit = register?.payLater
      ? await prepareCreditSaleTx(conn, { tenantId, customerPhone, payments: register?.payments, total: finalPayableTotal, payLater: register.payLater })
      : null;
    const paymentLines = credit
      ? credit.paymentLines
      : normalisePaymentLines(register?.payments, selectedPaymentType, finalPayableTotal);
    // Legacy single-type reports read invoices.payment_type_id: use the line that paid the most.
    const primaryPaymentType = paymentLines.length > 1
      ? [...paymentLines].sort((a, b) => b.amount - a.amount)[0].paymentTypeId
      : credit
        ? paymentLines[0]?.paymentTypeId || null
        : selectedPaymentType;

    const cleanAppliedPromos = appliedPromotions && Array.isArray(appliedPromotions) && appliedPromotions.length > 0
      ? JSON.stringify(appliedPromotions)
      : null;

    const sql = `
    INSERT INTO invoices
    (id, sub_total, tax_total, service_charge_total, discount_type, discount_value, discount_total, applied_promotions, promotion_discount_total, customer_group_id, customer_group_name, customer_group_discount_total, loyalty_points_redeemed, loyalty_discount_amount, loyalty_points_earned, total, created_at, payment_type_id, tenant_id, created_by, customer_phone, register_session_id)
    VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await conn.query(sql, [
      invoiceId,
      sub,
      tax,
      service,
      discountType || null,
      dVal,
      calcDiscountTotal,
      cleanAppliedPromos,
      promoDiscount,
      customerGroupId ? Number(customerGroupId) : null,
      customerGroupName || null,
      groupDiscount,
      pointsRedeemed,
      loyaltyDiscount,
      pointsEarned,
      finalPayableTotal,
      date,
      primaryPaymentType,
      tenantId,
      username,
      customerPhone || null,
      register?.session?.id || null,
    ]);

    // Gift card tenders: check and deduct the card balance in this transaction.
    const { redeemGiftCardLinesTx } = require("./gift_card.service");
    await redeemGiftCardLinesTx(conn, { tenantId, invoiceId, lines: paymentLines, session: register?.session || null, username });

    await recordPaymentsTx(conn, {
      tenantId,
      session: register?.session || null,
      source: "SALE",
      invoiceId,
      orderId,
      lines: paymentLines,
      createdBy: username,
    });

    if (credit) {
      await markInvoiceOnAccountTx(conn, { tenantId, invoiceId, credit, username });
    }

    await conn.query("INSERT INTO invoice_sequences ( sequence_no, tenant_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE sequence_no = VALUES(sequence_no);", [invoiceId, tenantId]);

    await conn.commit();

    return invoiceId;
  } catch (error) {
    console.error(error);
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

exports.completeOrdersAndSaveInvoiceIdDB = async (orderIds, invoiceId, tenantId, customerGroupId = null, customerGroupName = null, customerGroupDiscountTotal = 0) => {
  const conn = await getMySqlPromiseConnection();
  try {

    const orderIdsText = orderIds.join(",");

    let sql = `
    UPDATE orders SET
    status = 'completed', payment_status = 'paid', invoice_id = ?
    `;
    const params = [invoiceId];

    if (customerGroupId || customerGroupName || Number(customerGroupDiscountTotal) > 0) {
      sql += `, customer_group_id = ?, customer_group_name = ?, customer_group_discount_total = ?`;
      params.push(
        customerGroupId ? Number(customerGroupId) : null,
        customerGroupName || null,
        Number(customerGroupDiscountTotal || 0)
      );
    }

    sql += ` WHERE id IN (${orderIdsText}) AND tenant_id = ?;`;
    params.push(tenantId);

    await conn.query(sql, params);
    await rotateTablePinsByOrderIdsDB(tenantId, orderIds);
    await autoUnlinkTablesByOrderIdsDB(tenantId, orderIds, conn);

    return;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
}

exports.updateOrderCustomerDB = async (orderId, customerPhone, customerType, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
    UPDATE orders SET
      customer_id = ?,
      customer_type = ?
    WHERE id = ? AND tenant_id = ?;
    `;
    await conn.query(sql, [customerPhone || null, customerType || (customerPhone ? "CUSTOM" : "WALKIN"), orderId, tenantId]);
    return true;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.transferTableOrderDB = async (sourceTableId, destinationTableId, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [sourceOrders] = await conn.query(
      `SELECT id FROM orders WHERE table_id = ? AND tenant_id = ? AND status NOT IN ('completed', 'cancelled')`,
      [sourceTableId, tenantId]
    );

    if (!sourceOrders || sourceOrders.length === 0) {
      throw new Error("No active orders found on source table");
    }

    const [destTable] = await conn.query(
      `SELECT id, table_title FROM store_tables WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [destinationTableId, tenantId]
    );

    if (!destTable || destTable.length === 0) {
      throw new Error("Destination table does not exist");
    }

    await conn.query(
      `UPDATE orders SET table_id = ? WHERE table_id = ? AND tenant_id = ? AND status NOT IN ('completed', 'cancelled')`,
      [destinationTableId, sourceTableId, tenantId]
    );

    await conn.commit();
    return {
      success: true,
      transferredOrdersCount: sourceOrders.length,
      destinationTableTitle: destTable[0].table_title,
    };
  } catch (error) {
    await conn.rollback();
    console.error("transferTableOrderDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.moveOrderItemsDB = async (sourceOrderId, destinationTableId, itemsToMove = [], tenantId, username = null) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [sourceOrderRows] = await conn.query(
      `SELECT * FROM orders WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [sourceOrderId, tenantId]
    );
    if (!sourceOrderRows.length) throw new Error("Source order not found");
    const sourceOrder = sourceOrderRows[0];

    const [destTableRows] = await conn.query(
      `SELECT id, table_title FROM store_tables WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [destinationTableId, tenantId]
    );
    if (!destTableRows.length) throw new Error("Destination table not found");

    // Check if destination table already has an active order
    const [existingDestOrder] = await conn.query(
      `SELECT id, token_no FROM orders WHERE table_id = ? AND tenant_id = ? AND status NOT IN ('completed', 'cancelled') ORDER BY id DESC LIMIT 1`,
      [destinationTableId, tenantId]
    );

    let destinationOrderId;
    if (existingDestOrder.length > 0) {
      destinationOrderId = existingDestOrder[0].id;
    } else {
      // Create new active order on destination table
      let tokenNo = 0;
      const [tokenSequence] = await conn.query(
        "SELECT sequence_no, DATE(last_updated) as last_updated, DATE(NOW()) as todays_date FROM token_sequences WHERE tenant_id = ? LIMIT 1 FOR UPDATE",
        [tenantId]
      );
      tokenNo = tokenSequence[0]?.sequence_no || 0;
      const tokenLastUpdated = tokenSequence[0]?.last_updated
        ? new Date(tokenSequence[0].last_updated).toISOString().substring(0, 10)
        : new Date().toISOString().substring(0, 10);
      const today = new Date().toISOString().substring(0, 10);
      if (tokenLastUpdated !== today) tokenNo = 0;
      tokenNo += 1;

      await conn.query(
        `INSERT INTO token_sequences (sequence_no, last_updated, tenant_id) VALUES (?, NOW(), ?) ON DUPLICATE KEY UPDATE sequence_no = VALUES(sequence_no), last_updated = NOW()`,
        [tokenNo, tenantId]
      );

      const [newOrderRes] = await conn.query(
        `INSERT INTO orders (delivery_type, customer_type, customer_id, table_id, token_no, status, payment_status, tenant_id, created_by)
         VALUES ('dinein', ?, ?, ?, ?, 'created', 'pending', ?, ?)`,
        [sourceOrder.customer_type || "WALKIN", sourceOrder.customer_id || null, destinationTableId, tokenNo, tenantId, username]
      );
      destinationOrderId = newOrderRes.insertId;
    }

    // Process each item to move
    for (const moveReq of itemsToMove) {
      const itemId = Number(moveReq.id);
      const moveQty = Number(moveReq.quantity || 1);
      if (!itemId || moveQty <= 0) continue;

      const [itemRows] = await conn.query(
        `SELECT * FROM order_items WHERE id = ? AND order_id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE`,
        [itemId, sourceOrderId, tenantId]
      );
      if (!itemRows.length) continue;
      const currentItem = itemRows[0];

      if (moveQty >= currentItem.quantity) {
        // Move entire line item
        await conn.query(
          `UPDATE order_items SET order_id = ? WHERE id = ? AND tenant_id = ?`,
          [destinationOrderId, itemId, tenantId]
        );
      } else {
        // Split line item: deduct from source, create on destination
        await conn.query(
          `UPDATE order_items SET quantity = quantity - ? WHERE id = ? AND tenant_id = ?`,
          [moveQty, itemId, tenantId]
        );
        await conn.query(
          `INSERT INTO order_items (order_id, item_id, variant_id, price, quantity, status, date, notes, addons, tenant_id, kitchen_station_id,
             course, seat_no, fire_status, fired_at, original_price, adjust_type, adjust_reason, adjust_note, adjust_discount_type, adjust_discount_value, adjusted_by, adjust_approved_by, adjusted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            destinationOrderId,
            currentItem.item_id,
            currentItem.variant_id,
            currentItem.price,
            moveQty,
            currentItem.status,
            currentItem.date || new Date(),
            currentItem.notes,
            currentItem.addons,
            tenantId,
            currentItem.kitchen_station_id,
            currentItem.course ?? null,
            currentItem.seat_no ?? null,
            currentItem.fire_status || "fired",
            currentItem.fired_at || null,
            currentItem.original_price ?? null,
            currentItem.adjust_type || null,
            currentItem.adjust_reason || null,
            currentItem.adjust_note || null,
            currentItem.adjust_discount_type || null,
            currentItem.adjust_discount_value ?? null,
            currentItem.adjusted_by || null,
            currentItem.adjust_approved_by || null,
            currentItem.adjusted_at || null,
          ]
        );
      }
    }

    // Check if source order has remaining items
    const [[remaining]] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM order_items WHERE order_id = ? AND status NOT IN ('cancelled') AND tenant_id = ?`,
      [sourceOrderId, tenantId]
    );

    if (Number(remaining?.cnt || 0) === 0) {
      // Free source table by completing or cancelling empty order
      await conn.query(
        `UPDATE orders SET status = 'completed', payment_status = 'paid' WHERE id = ? AND tenant_id = ?`,
        [sourceOrderId, tenantId]
      );
    }

    await conn.commit();
    return {
      success: true,
      destinationOrderId,
      sourceOrderRemainingItems: Number(remaining?.cnt || 0),
    };
  } catch (error) {
    await conn.rollback();
    console.error("moveOrderItemsDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.splitCheckByItemsDB = async (sourceOrderId, itemsToSplit = [], tenantId, username = null) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [sourceOrderRows] = await conn.query(
      `SELECT * FROM orders WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [sourceOrderId, tenantId]
    );
    if (!sourceOrderRows.length) throw new Error("Source order not found");
    const sourceOrder = sourceOrderRows[0];

    // Generate new token for the split check
    let tokenNo = 0;
    const [tokenSequence] = await conn.query(
      "SELECT sequence_no, DATE(last_updated) as last_updated, DATE(NOW()) as todays_date FROM token_sequences WHERE tenant_id = ? LIMIT 1 FOR UPDATE",
      [tenantId]
    );
    tokenNo = tokenSequence[0]?.sequence_no || 0;
    const tokenLastUpdated = tokenSequence[0]?.last_updated
      ? new Date(tokenSequence[0].last_updated).toISOString().substring(0, 10)
      : new Date().toISOString().substring(0, 10);
    const today = new Date().toISOString().substring(0, 10);
    if (tokenLastUpdated !== today) tokenNo = 0;
    tokenNo += 1;

    await conn.query(
      `INSERT INTO token_sequences (sequence_no, last_updated, tenant_id) VALUES (?, NOW(), ?) ON DUPLICATE KEY UPDATE sequence_no = VALUES(sequence_no), last_updated = NOW()`,
      [tokenNo, tenantId]
    );

    // Create new split check order on same table
    const [splitOrderRes] = await conn.query(
      `INSERT INTO orders (delivery_type, customer_type, customer_id, table_id, token_no, status, payment_status, tenant_id, created_by)
       VALUES (?, ?, ?, ?, ?, 'created', 'pending', ?, ?)`,
      [sourceOrder.delivery_type, sourceOrder.customer_type, sourceOrder.customer_id, sourceOrder.table_id, tokenNo, tenantId, username]
    );
    const splitOrderId = splitOrderRes.insertId;

    for (const splitReq of itemsToSplit) {
      const itemId = Number(splitReq.id);
      const splitQty = Number(splitReq.quantity || 1);
      if (!itemId || splitQty <= 0) continue;

      const [itemRows] = await conn.query(
        `SELECT * FROM order_items WHERE id = ? AND order_id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE`,
        [itemId, sourceOrderId, tenantId]
      );
      if (!itemRows.length) continue;
      const currentItem = itemRows[0];

      if (splitQty >= currentItem.quantity) {
        await conn.query(
          `UPDATE order_items SET order_id = ? WHERE id = ? AND tenant_id = ?`,
          [splitOrderId, itemId, tenantId]
        );
      } else {
        await conn.query(
          `UPDATE order_items SET quantity = quantity - ? WHERE id = ? AND tenant_id = ?`,
          [splitQty, itemId, tenantId]
        );
        await conn.query(
          `INSERT INTO order_items (order_id, item_id, variant_id, price, quantity, status, date, notes, addons, tenant_id, kitchen_station_id,
             course, seat_no, fire_status, fired_at, original_price, adjust_type, adjust_reason, adjust_note, adjust_discount_type, adjust_discount_value, adjusted_by, adjust_approved_by, adjusted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            splitOrderId,
            currentItem.item_id,
            currentItem.variant_id,
            currentItem.price,
            splitQty,
            currentItem.status,
            currentItem.date || new Date(),
            currentItem.notes,
            currentItem.addons,
            tenantId,
            currentItem.kitchen_station_id,
            currentItem.course ?? null,
            currentItem.seat_no ?? null,
            currentItem.fire_status || "fired",
            currentItem.fired_at || null,
            currentItem.original_price ?? null,
            currentItem.adjust_type || null,
            currentItem.adjust_reason || null,
            currentItem.adjust_note || null,
            currentItem.adjust_discount_type || null,
            currentItem.adjust_discount_value ?? null,
            currentItem.adjusted_by || null,
            currentItem.adjust_approved_by || null,
            currentItem.adjusted_at || null,
          ]
        );
      }
    }

    await conn.commit();
    return {
      success: true,
      splitOrderId,
      splitTokenNo: tokenNo,
    };
  } catch (error) {
    await conn.rollback();
    console.error("splitCheckByItemsDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Advanced Bill Splitting: Create sub-invoices with proportional tax, service charge, and discount distribution.
 */
exports.createSplitSubInvoicesDB = async (tenantId, orderId, splitMode, splits = [], username = null) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [orderRows] = await conn.query(
      `SELECT * FROM orders WHERE id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE`,
      [orderId, tenantId]
    );
    if (!orderRows.length) throw new Error("Order not found");
    const order = orderRows[0];

    // Check if there are already paid sub-invoices
    const [existingSubInvoices] = await conn.query(
      `SELECT * FROM order_sub_invoices WHERE order_id = ? AND tenant_id = ?`,
      [orderId, tenantId]
    );
    const hasPaid = existingSubInvoices.some((s) => s.payment_status === "paid");
    if (hasPaid) {
      throw new Error("Cannot re-split an order with already settled sub-checks");
    }

    // Clean up any pending un-paid sub-invoices if re-configuring split plan
    if (existingSubInvoices.length > 0) {
      const subIds = existingSubInvoices.map((s) => s.id);
      await conn.query(
        `DELETE FROM order_sub_invoice_items WHERE order_sub_invoice_id IN (?) AND tenant_id = ?`,
        [subIds, tenantId]
      );
      await conn.query(
        `DELETE FROM order_sub_invoices WHERE order_id = ? AND tenant_id = ?`,
        [orderId, tenantId]
      );
    }

    // Strict penny balancing & totals validation
    if (splitMode === "evenly" && splits.length > 0) {
      const splitsSubtotal = splits.reduce(
        (sum, s) => sum + Number(s.subtotal || 0),
        0
      );
      const [orderItemsRows] = await conn.query(
        `SELECT price, quantity FROM order_items WHERE order_id = ? AND tenant_id = ? AND status NOT IN ('cancelled')`,
        [orderId, tenantId]
      );
      const rawDbSubtotal = orderItemsRows.reduce(
        (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 1),
        0
      );
      const orderItemsSubtotal = splitsSubtotal > 0 ? splitsSubtotal : rawDbSubtotal;

      const count = splits.length;
      if (orderItemsSubtotal > 0) {
        const baseSub = Math.floor((orderItemsSubtotal / count) * 100) / 100;
        const remainderSubCents = Math.round((orderItemsSubtotal - (baseSub * count)) * 100);

        const totalTax = splits.reduce((sum, s) => sum + Number(s.taxTotal || 0), 0);
        const baseTax = Math.floor((totalTax / count) * 100) / 100;
        const remainderTaxCents = Math.round((totalTax - (baseTax * count)) * 100);

        const totalService = splits.reduce((sum, s) => sum + Number(s.serviceChargeTotal || 0), 0);
        const baseService = Math.floor((totalService / count) * 100) / 100;
        const remainderServiceCents = Math.round((totalService - (baseService * count)) * 100);

        for (let i = 0; i < count; i++) {
          splits[i].subtotal = Number((baseSub + (i < remainderSubCents ? 0.01 : 0)).toFixed(2));
          splits[i].taxTotal = Number((baseTax + (i < remainderTaxCents ? 0.01 : 0)).toFixed(2));
          splits[i].serviceChargeTotal = Number((baseService + (i < remainderServiceCents ? 0.01 : 0)).toFixed(2));
          splits[i].discountTotal = 0;
        }
      }
    }

    const createdSubInvoices = [];
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const suffix = alphabet[i % alphabet.length] || String(i + 1);
      const subInvoiceNumber = `CHK-${order.token_no || order.id}-${suffix}`;
      const seatLabel = split.seatLabel || `Guest ${i + 1}`;

      const subtotal = Number(Number(split.subtotal || 0).toFixed(2));
      const taxTotal = Number(Number(split.taxTotal || 0).toFixed(2));
      const serviceChargeTotal = Number(Number(split.serviceChargeTotal || 0).toFixed(2));
      const discountTotal = Number(Number(split.discountTotal || 0).toFixed(2));
      const payableTotal = Number(
        (subtotal + taxTotal + serviceChargeTotal - discountTotal).toFixed(2)
      );

      const [insertRes] = await conn.query(
        `INSERT INTO order_sub_invoices 
         (tenant_id, order_id, sub_invoice_number, seat_label, subtotal, tax_total, service_charge_total, discount_total, payable_total, payment_status, server_username)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          tenantId,
          orderId,
          subInvoiceNumber,
          seatLabel,
          subtotal,
          taxTotal,
          serviceChargeTotal,
          discountTotal,
          payableTotal,
          username,
        ]
      );
      const subInvoiceId = insertRes.insertId;

      // Insert assigned items if split by items
      if (Array.isArray(split.items) && split.items.length > 0) {
        for (const item of split.items) {
          await conn.query(
            `INSERT INTO order_sub_invoice_items 
             (tenant_id, order_sub_invoice_id, order_item_id, item_title, variant_title, quantity, price)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              tenantId,
              subInvoiceId,
              item.order_item_id || null,
              item.item_title || item.title || "Item",
              item.variant_title || null,
              Number(item.quantity || 1),
              Number(item.price || 0),
            ]
          );
        }
      }

      createdSubInvoices.push({
        id: subInvoiceId,
        sub_invoice_number: subInvoiceNumber,
        seat_label: seatLabel,
        subtotal,
        tax_total: taxTotal,
        service_charge_total: serviceChargeTotal,
        discount_total: discountTotal,
        payable_total: payableTotal,
        payment_status: "pending",
      });
    }

    await conn.query(
      `UPDATE orders SET split_status = 'split_in_progress' WHERE id = ? AND tenant_id = ?`,
      [orderId, tenantId]
    );

    await conn.commit();
    return createdSubInvoices;
  } catch (error) {
    await conn.rollback();
    console.error("createSplitSubInvoicesDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Fetch all sub-invoices and their line items for an order.
 */
exports.getOrderSubInvoicesDB = async (tenantId, orderId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [subInvoices] = await conn.query(
      `SELECT * FROM order_sub_invoices WHERE order_id = ? AND tenant_id = ? ORDER BY id ASC`,
      [orderId, tenantId]
    );

    if (subInvoices.length === 0) {
      return [];
    }

    const subIds = subInvoices.map((s) => s.id);
    const [items] = await conn.query(
      `SELECT * FROM order_sub_invoice_items WHERE order_sub_invoice_id IN (?) AND tenant_id = ?`,
      [subIds, tenantId]
    );

    return subInvoices.map((sub) => ({
      ...sub,
      items: items.filter((it) => it.order_sub_invoice_id === sub.id),
    }));
  } catch (error) {
    console.error("getOrderSubInvoicesDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Settle an individual sub-invoice (record tender + server tip, and evaluate master order status).
 */
exports.settleSubInvoiceDB = async (
  tenantId,
  subInvoiceId,
  paymentTypeId,
  paymentTypeTitle,
  tipAmount = 0,
  username = null,
  notes = null,
  session = null,
  tender = null,
  reference = null
) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [subRows] = await conn.query(
      `SELECT * FROM order_sub_invoices WHERE id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE`,
      [subInvoiceId, tenantId]
    );
    if (!subRows.length) throw new Error("Sub-invoice not found");
    const subInvoice = subRows[0];

    if (subInvoice.payment_status === "paid") {
      throw new Error("This sub-check has already been paid");
    }

    const tip = Number(Number(tipAmount || 0).toFixed(2));

    await conn.query(
      `UPDATE order_sub_invoices SET
         payment_type_id = ?,
         payment_type_title = ?,
         tip_amount = ?,
         payment_status = 'paid',
         server_username = ?,
         notes = ?,
         paid_at = NOW(),
         register_session_id = ?
       WHERE id = ? AND tenant_id = ?`,
      [paymentTypeId, paymentTypeTitle, tip, username, notes, session?.id || null, subInvoiceId, tenantId]
    );

    await recordPaymentsTx(conn, {
      tenantId,
      session,
      source: "SUB_INVOICE",
      subInvoiceId: Number(subInvoiceId),
      orderId: subInvoice.order_id,
      lines: [{
        paymentTypeId,
        paymentTypeTitle,
        amount: Number(subInvoice.payable_total || 0),
        tip,
        tender,
        reference,
      }],
      createdBy: username,
      serverUsername: subInvoice.server_username || username,
    });

    // Update order cumulative tips
    await conn.query(
      `UPDATE orders SET tip_total = tip_total + ? WHERE id = ? AND tenant_id = ?`,
      [tip, subInvoice.order_id, tenantId]
    );

    // Check overall split completion
    const [allSubs] = await conn.query(
      `SELECT * FROM order_sub_invoices WHERE order_id = ? AND tenant_id = ?`,
      [subInvoice.order_id, tenantId]
    );

    const allPaid = allSubs.every((s) => s.payment_status === "paid");
    let isFullyCompleted = false;

    if (allPaid) {
      await conn.query(
        `UPDATE orders SET
           status = 'completed',
           payment_status = 'paid',
           split_status = 'split_settled'
         WHERE id = ? AND tenant_id = ?`,
        [subInvoice.order_id, tenantId]
      );
      await rotateTablePinsByOrderIdsDB(tenantId, [subInvoice.order_id]);
      isFullyCompleted = true;
    } else {
      await conn.query(
        `UPDATE orders SET
           payment_status = 'pending',
           split_status = 'split_in_progress'
         WHERE id = ? AND tenant_id = ?`,
        [subInvoice.order_id, tenantId]
      );
    }

    await conn.commit();
    return {
      success: true,
      subInvoiceId,
      orderId: subInvoice.order_id,
      isFullyCompleted,
      allPaid,
      tipAmount: tip,
    };
  } catch (error) {
    await conn.rollback();
    console.error("settleSubInvoiceDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Cancel/revert an active split plan if no sub-invoices have been settled yet.
 */
exports.cancelSplitPlanDB = async (tenantId, orderId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [existingSubInvoices] = await conn.query(
      `SELECT * FROM order_sub_invoices WHERE order_id = ? AND tenant_id = ?`,
      [orderId, tenantId]
    );
    const hasPaid = existingSubInvoices.some((s) => s.payment_status === "paid");
    if (hasPaid) {
      throw new Error("Cannot cancel split plan with settled checks");
    }

    if (existingSubInvoices.length > 0) {
      const subIds = existingSubInvoices.map((s) => s.id);
      await conn.query(
        `DELETE FROM order_sub_invoice_items WHERE order_sub_invoice_id IN (?) AND tenant_id = ?`,
        [subIds, tenantId]
      );
      await conn.query(
        `DELETE FROM order_sub_invoices WHERE order_id = ? AND tenant_id = ?`,
        [orderId, tenantId]
      );
    }

    await conn.query(
      `UPDATE orders SET split_status = 'none' WHERE id = ? AND tenant_id = ?`,
      [orderId, tenantId]
    );

    await conn.commit();
    return { success: true };
  } catch (error) {
    await conn.rollback();
    console.error("cancelSplitPlanDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Merge two tables: transfers all order items from sourceTable to destinationTable,
 * links them in store_floor_layouts merged_pairs, and marks source order cancelled.
 */
exports.mergeTablesDB = async (sourceTableId, destinationTableId, floor, tenantId, username = null) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [tables] = await conn.query(
      `SELECT id, table_title, floor FROM store_tables WHERE id IN (?, ?) AND tenant_id = ?`,
      [sourceTableId, destinationTableId, tenantId]
    );
    if (tables.length < 2) {
      throw new Error("One or both tables not found");
    }

    const sourceTable = tables.find((t) => String(t.id) === String(sourceTableId));
    const destTable = tables.find((t) => String(t.id) === String(destinationTableId));

    const [sourceOrders] = await conn.query(
      `SELECT * FROM orders WHERE table_id = ? AND tenant_id = ? AND status NOT IN ('completed', 'cancelled') ORDER BY id DESC LIMIT 1`,
      [sourceTableId, tenantId]
    );
    const [destOrders] = await conn.query(
      `SELECT * FROM orders WHERE table_id = ? AND tenant_id = ? AND status NOT IN ('completed', 'cancelled') ORDER BY id DESC LIMIT 1`,
      [destinationTableId, tenantId]
    );

    let masterOrderId = null;
    let mergedItemsCount = 0;

    if (sourceOrders.length > 0 && destOrders.length > 0) {
      const sourceOrder = sourceOrders[0];
      const destOrder = destOrders[0];
      masterOrderId = destOrder.id;

      const [items] = await conn.query(
        `SELECT id FROM order_items WHERE order_id = ? AND tenant_id = ? AND status NOT IN ('cancelled')`,
        [sourceOrder.id, tenantId]
      );
      mergedItemsCount = items.length;

      if (items.length > 0) {
        await conn.query(
          `UPDATE order_items SET order_id = ? WHERE order_id = ? AND tenant_id = ?`,
          [destOrder.id, sourceOrder.id, tenantId]
        );
      }

      await conn.query(
        `UPDATE orders SET status = 'cancelled' WHERE id = ? AND tenant_id = ?`,
        [sourceOrder.id, tenantId]
      );
    } else if (sourceOrders.length > 0 && destOrders.length === 0) {
      const sourceOrder = sourceOrders[0];
      await conn.query(
        `UPDATE orders SET table_id = ? WHERE id = ? AND tenant_id = ?`,
        [destinationTableId, sourceOrder.id, tenantId]
      );
      masterOrderId = sourceOrder.id;
    } else if (destOrders.length > 0) {
      masterOrderId = destOrders[0].id;
    }

    const targetFloor = floor || destTable.floor || sourceTable.floor;
    const [layoutRows] = await conn.query(
      `SELECT id, merged_pairs FROM store_floor_layouts WHERE tenant_id = ? AND floor = ? LIMIT 1`,
      [tenantId, targetFloor]
    );

    let pairs = [];
    if (layoutRows.length > 0 && layoutRows[0].merged_pairs) {
      try {
        pairs = typeof layoutRows[0].merged_pairs === "string"
          ? JSON.parse(layoutRows[0].merged_pairs)
          : layoutRows[0].merged_pairs;
      } catch {
        pairs = [];
      }
    }

    const pairExists = pairs.some(
      ([a, b]) =>
        (String(a) === String(destinationTableId) && String(b) === String(sourceTableId)) ||
        (String(a) === String(sourceTableId) && String(b) === String(destinationTableId))
    );

    if (!pairExists) {
      pairs.push([destinationTableId, sourceTableId]);
      if (layoutRows.length > 0) {
        await conn.query(
          `UPDATE store_floor_layouts SET merged_pairs = ? WHERE id = ? AND tenant_id = ?`,
          [JSON.stringify(pairs), layoutRows[0].id, tenantId]
        );
      } else {
        await conn.query(
          `INSERT INTO store_floor_layouts (tenant_id, floor, merged_pairs) VALUES (?, ?, ?)`,
          [tenantId, targetFloor, JSON.stringify(pairs)]
        );
      }
    }

    await conn.commit();
    return {
      success: true,
      masterOrderId,
      mergedItemsCount,
      sourceTableTitle: sourceTable.table_title,
      destinationTableTitle: destTable.table_title,
      mergedPairs: pairs,
    };
  } catch (error) {
    await conn.rollback();
    console.error("mergeTablesDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Unlink two tables: removes them from store_floor_layouts merged_pairs.
 */
exports.unlinkTablesDB = async (tableAId, tableBId, floor, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [layoutRows] = await conn.query(
      `SELECT id, merged_pairs FROM store_floor_layouts WHERE tenant_id = ? AND floor = ? LIMIT 1`,
      [tenantId, floor]
    );

    let pairs = [];
    if (layoutRows.length > 0 && layoutRows[0].merged_pairs) {
      try {
        pairs = typeof layoutRows[0].merged_pairs === "string"
          ? JSON.parse(layoutRows[0].merged_pairs)
          : layoutRows[0].merged_pairs;
      } catch {
        pairs = [];
      }
    }

    const updated = pairs.filter(
      ([a, b]) =>
        !(
          (String(a) === String(tableAId) && String(b) === String(tableBId)) ||
          (String(a) === String(tableBId) && String(b) === String(tableAId))
        )
    );

    if (layoutRows.length > 0) {
      await conn.query(
        `UPDATE store_floor_layouts SET merged_pairs = ? WHERE id = ? AND tenant_id = ?`,
        [JSON.stringify(updated), layoutRows[0].id, tenantId]
      );
    }

    await conn.commit();
    return {
      success: true,
      mergedPairs: updated,
    };
  } catch (error) {
    await conn.rollback();
    console.error("unlinkTablesDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

