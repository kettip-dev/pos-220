const { CONFIG } = require("../config");
const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { rotateTablePinsByOrderIdsDB } = require("./settings.service");

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
      o.token_no
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
        mi.title AS item_title,
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
    return {
      kitchenOrders,
      kitchenOrdersItems,
      addons
    }

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
      o.token_no
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
        mi.title AS item_title,
        oi.variant_id,
        miv.title as variant_title,
        miv.price as variant_price,
        mi.price,
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


    return {
      kitchenOrders,
      kitchenOrdersItems,
      addons
    }

  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
}
};

exports.createInvoiceDB = async (subtotal, taxTotal, serviceChargeTotal, total, date, selectedPaymentType, tenantId, username = null, discountType = null, discountValue = 0, discountTotal = null) => {
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

    // Verify and recalculate total = subtotal + taxTotal + serviceChargeTotal - discountTotal
    const expectedTotal = Math.max(0, sub + tax + service - calcDiscountTotal);
    const verifiedTotal = Number(expectedTotal.toFixed(2));

    const sql = `
    INSERT INTO invoices
    (id, sub_total, tax_total, service_charge_total, discount_type, discount_value, discount_total, total, created_at, payment_type_id, tenant_id, created_by)
    VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await conn.query(sql, [invoiceId, sub, tax, service, discountType || null, dVal, calcDiscountTotal, verifiedTotal, date, selectedPaymentType, tenantId, username]);

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

exports.completeOrdersAndSaveInvoiceIdDB = async (orderIds, invoiceId, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {

    const orderIdsText = orderIds.join(",");

    const sql = `
    UPDATE orders SET
    status = 'completed', payment_status = 'paid', invoice_id = ?
    WHERE id IN (${orderIdsText}) AND tenant_id = ?;
    `;

    await conn.query(sql, [invoiceId, tenantId]);
    await rotateTablePinsByOrderIdsDB(tenantId, orderIds);

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
          `INSERT INTO order_items (order_id, item_id, variant_id, price, quantity, status, date, notes, addons, tenant_id, kitchen_station_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          `INSERT INTO order_items (order_id, item_id, variant_id, price, quantity, status, date, notes, addons, tenant_id, kitchen_station_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

