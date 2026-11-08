const { getMySqlPromiseConnection } = require("../config/mysql.db")
const { syncLowStockAlertsDB } = require("./inventory.service");
const { queueLowStockAlerts } = require("./notification.service");
const { sendOrderTelegramNotification } = require("./telegram.service");
const { consumeMenuItemStockTx } = require("./menu_availability.service");

exports.createOrderDB = async (tenantId, cartItems, deliveryType, customerType, customerId, tableId, paymentStatus = 'pending', invoiceId = null, username = null, appliedPromotions = null, promotionDiscountTotal = 0, customerGroupId = null, customerGroupName = null, customerGroupDiscountTotal = 0, orderStatus = 'created') => {
  const conn = await getMySqlPromiseConnection();

  try {
    // start transaction
    await conn.beginTransaction();

    // step 1: get current token no. from table token_sequences
    // if no data found give 0
    let tokenNo = 0;

    const [tokenSequence] = await conn.query("SELECT sequence_no, DATE(last_updated) as last_updated, DATE(NOW()) as todays_date FROM token_sequences WHERE tenant_id = ? LIMIT 1 FOR UPDATE", [tenantId]);
    tokenNo = tokenSequence[0]?.sequence_no || 0;
    const tokenLastUpdated = tokenSequence[0]?.last_updated ? new Date(tokenSequence[0]?.last_updated).toISOString().substring(0, 10) : new Date().toISOString().substring(0,10);

    const today = new Date(tokenSequence[0]?.todays_date || Date.now()).toISOString().substring(0,10);

    console.log(tokenLastUpdated, today);

    if(tokenLastUpdated != today) {
      tokenNo = 0;
    }

    // step 2: increase the token no. by +1
    tokenNo += 1;

    // step 3: save data to orders table
    const cleanAppliedPromos = appliedPromotions && Array.isArray(appliedPromotions) && appliedPromotions.length > 0
      ? JSON.stringify(appliedPromotions)
      : null;
    const promoDiscount = Number(promotionDiscountTotal || 0);
    const groupDiscount = Number(customerGroupDiscountTotal || 0);

    const [orderResult] = await conn.query(
      `INSERT INTO orders (delivery_type, customer_type, customer_id, customer_group_id, customer_group_name, customer_group_discount_total, table_id, token_no, payment_status, invoice_id, applied_promotions, promotion_discount_total, tenant_id, created_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [deliveryType, customerType, customerId, customerGroupId ? Number(customerGroupId) : null, customerGroupName || null, groupDiscount, tableId, tokenNo, paymentStatus || 'pending', invoiceId || null, cleanAppliedPromos, promoDiscount, tenantId, username, orderStatus || 'created']
    );

    const orderId = orderResult.insertId;

    // Sold-out / portion-count guard. Locks the menu rows so two terminals
    // cannot both sell the last portion.
    const availabilityChanges = await consumeMenuItemStockTx(conn, tenantId, cartItems);

    // Increment promotion redemptions if applied
    if (appliedPromotions && Array.isArray(appliedPromotions) && appliedPromotions.length > 0) {
      const promoIds = appliedPromotions.map(p => p.id).filter(Boolean);
      if (promoIds.length > 0) {
        const { incrementRedemptions } = require("./promotions.service");
        await incrementRedemptions(tenantId, promoIds, conn);
      }
    }

    // step 4: save data to order_items with station resolution
    const itemIds = [...new Set(cartItems.map(i => i.id).filter(Boolean))];
    const itemStationMap = new Map();
    if (itemIds.length > 0) {
      const [stationRows] = await conn.query(`
        SELECT mi.id, mi.kitchen_station_id, c.kitchen_station_id AS cat_station_id
        FROM menu_items mi
        LEFT JOIN categories c ON mi.category = c.id
        WHERE mi.id IN (?) AND mi.tenant_id = ?
      `, [itemIds, tenantId]);
      stationRows.forEach(r => {
        itemStationMap.set(r.id, r.kitchen_station_id || r.cat_station_id || null);
      });
    }

    const itemStatus = orderStatus === 'completed' ? 'completed' : 'created';

    const sqlOrderItems = `
    INSERT INTO order_items
    (order_id, item_id, variant_id, price, quantity, notes, addons, tenant_id, kitchen_station_id, status, course, seat_no, fire_status, fired_at)
    VALUES ?
    `;

    await conn.query(sqlOrderItems, [
      cartItems.map((item) => {
        const stationId = item.kitchen_station_id || item.effective_kitchen_station_id || itemStationMap.get(item.id) || null;
        // Held courses wait for "Fire"; without a kitchen workflow everything is fired.
        const course = Number(item.course) > 0 ? Math.min(Number(item.course), 9) : null;
        const seat = Number(item.seat) > 0 ? Math.min(Number(item.seat), 99) : null;
        const held = Boolean(item.hold) && orderStatus !== 'completed';
        return [
          orderId,
          item.id,
          item.variant_id || item.variant?.id || null,
          item.price,
          item.quantity,
          item.notes,
          item?.addons_ids?.length > 0
            ? JSON.stringify(item.addons_ids)
            : (item?.addons?.length > 0
                ? JSON.stringify(item.addons.map(a => typeof a === 'object' && a !== null ? a.id : a).filter(Boolean))
                : null),
          tenantId,
          stationId ? Number(stationId) : null,
          itemStatus,
          course,
          seat,
          held ? 'held' : 'fired',
          held ? null : new Date()
        ];
      })
    ]);

    // step 5: comp / discount approvals on cart lines (audit-linked, single use)
    if (cartItems.some((ci) => ci?.adjust?.type)) {
      const { applyCartAdjustmentsTx } = require("./line_adjustment.service");
      const [insertedRows] = await conn.query(
        `SELECT id FROM order_items WHERE order_id = ? AND tenant_id = ? ORDER BY id ASC`,
        [orderId, tenantId]
      );
      await applyCartAdjustmentsTx(conn, tenantId, orderId, cartItems, insertedRows.map((r) => r.id), username);
    }

    // step 6: Save updated token no. to table token_sequences
    await conn.query("INSERT INTO token_sequences ( sequence_no, last_updated, tenant_id) VALUES (?, NOW(), ?) ON DUPLICATE KEY UPDATE sequence_no = VALUES(sequence_no), last_updated = VALUES(last_updated) ;", [tokenNo, tenantId]);

     // Track Recipe/Inventory Item Usuage
     const inventoryUsage = {};

     cartItems.forEach(item => {
       (item.recipeItems || []).forEach(recipe => {
         const { inventory_item_id, recipe_quantity, ingredient_title, unit, variant_id, addon_id } = recipe;

         // Skip if variant-specific and doesn't match
         if (variant_id && variant_id != item.variant_id) return;

         // Skip if addon-specific and not included
         if (addon_id && !item.addons_ids?.map(String).includes(String(addon_id))) return;

         const invId = inventory_item_id;
         const qtyNeeded = parseFloat(recipe_quantity) * item.quantity;

         if (!inventoryUsage[invId]) {
           inventoryUsage[invId] = {
             ingredient_title,
             unit,
             total_quantity: 0
           };
         }

         inventoryUsage[invId].total_quantity += qtyNeeded;
       });
     });


      // Step 7: Update inventory_items and insert into inventory_logs
      const updateInventorySql = `
        UPDATE inventory_items
        SET quantity = ?, status = ?
        WHERE id = ? AND tenant_id = ?
      `;

      const insertLogSql = `
        INSERT INTO inventory_logs
        (tenant_id, inventory_item_id, type, quantity_change, previous_quantity, new_quantity, note, created_by, order_id)
        VALUES (?, ?, 'OUT', ?, ?, ?, ?, ?, ?)
      `;

      for (const [inventoryItemId, usage] of Object.entries(inventoryUsage)) {
        const invId = parseInt(inventoryItemId);
        const qtyUsed = parseFloat(usage.total_quantity);

        const [[currentItem]] = await conn.query(
          'SELECT quantity, min_quantity_threshold FROM inventory_items WHERE id = ? AND tenant_id = ? FOR UPDATE',
          [invId, tenantId]
        );

        const previousQty = parseFloat(currentItem?.quantity || 0);
        const newQty = previousQty - qtyUsed;
        const minQuantityThreshold = parseFloat(currentItem?.min_quantity_threshold || 0);

        // Insert into inventory_logs
        await conn.query(insertLogSql, [
          tenantId,
          invId,
          qtyUsed,
          previousQty,
          newQty,
          invoiceId ? `Auto deduction for recipe usage in invoice #${invoiceId}` : 'Auto deduction for recipe usage in order',
          username,
          orderId
        ]);

        let status = 'out';
        if (newQty > 0 && newQty <= minQuantityThreshold) {
          status = 'low';
        } else if (newQty > minQuantityThreshold) {
          status = 'in';
        }

        // Update inventory_items
        await conn.query(updateInventorySql, [newQty, status, invId, tenantId]);

        // if (newQty <= 0) {
        //   const [[recipeCheck]] = await conn.query(
        //     `SELECT quantity
        //      FROM menu_item_recipes
        //      WHERE inventory_item_id = ? AND variant_id = 0 AND addon_id = 0 AND tenant_id = ?`,
        //     [invId, tenantId]
        //   );

        //   if ((recipeCheck && newQty < parseFloat(recipeCheck.quantity)) || newQty <= 0) {
        //     const [menuItemsToDisable] = await conn.query(
        //       `SELECT DISTINCT mi.id
        //        FROM menu_items mi
        //        JOIN menu_item_recipes mir ON mi.id = mir.menu_item_id
        //        WHERE mir.inventory_item_id = ?
        //          AND mir.variant_id = 0
        //          AND mir.addon_id = 0
        //          AND mi.tenant_id = ?`,
        //       [invId, tenantId]
        //     );

        //     if (menuItemsToDisable.length > 0) {
        //       const menuItemIds = menuItemsToDisable.map(row => row.id);
        //       if (menuItemIds.length > 0) {
        //         await conn.query(
        //           `UPDATE menu_items
        //            SET is_enabled = 0
        //            WHERE tenant_id = ? AND id IN (?)`,
        //           [tenantId, menuItemIds]
        //         );
        //       }
        //     }
        //   }
        // }
      }

    // Recipe deduction is the highest-volume way stock falls below its
    // threshold. One order can take several ingredients low at once, so the
    // whole set is reconciled together and sent as a single alert.
    const newlyLowItems = await syncLowStockAlertsDB(
      conn,
      tenantId,
      Object.keys(inventoryUsage).map(Number)
    );

    // step 7: commit transaction / if any exception occurs then rollback
    await conn.commit();

    // Post-commit and fire-and-forget: a push must never delay or fail an order.
    queueLowStockAlerts(tenantId, newlyLowItems);

    // Push notification to Telegram (if configured and enabled)
    sendOrderTelegramNotification(tenantId, orderId).catch((err) => {
      console.error(`[pos.service] Telegram order notify failed for order #${orderId}:`, err.message);
    });

    if (availabilityChanges.length > 0) {
      const { invalidateTenantCatalog } = require("../utils/cache.util");
      await invalidateTenantCatalog(tenantId).catch(() => {});
    }

    return {
      tokenNo,
      orderId,
      availabilityChanges
    }
  } catch (error) {
    console.error(error);
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.getPOSQROrdersCountDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();

    try {
      const sql = `
        SELECT COUNT(*) AS total_orders FROM qr_orders o
        WHERE o.tenant_id = ?
          AND o.status NOT IN('completed', 'cancelled')
          AND EXISTS (
            SELECT 1 FROM qr_order_items qoi
            WHERE qoi.order_id = o.id AND qoi.tenant_id = o.tenant_id
          );
      `;

      const [result] = await conn.query(sql, [tenantId]);
      return result[0].total_orders ?? 0;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getPOSQROrdersDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();

    try {
      // Auto-cleanup any orphaned qr_orders that have 0 items so they never get stuck
      await conn.query(`
        UPDATE qr_orders o
        SET o.status = 'cancelled'
        WHERE o.tenant_id = ?
          AND o.status NOT IN ('completed', 'cancelled')
          AND NOT EXISTS (
            SELECT 1 FROM qr_order_items qoi
            WHERE qoi.order_id = o.id AND qoi.tenant_id = o.tenant_id
          )
      `, [tenantId]);

      const sql = `
       SELECT
        o.id,
        o.date,
        o.delivery_type,
        o.customer_type,
        o.customer_id,
        c.name AS customer_name,
        o.table_id,
        st.table_title,
        st.floor,
        st.seating_capacity,
        o.status,
        o.payment_status
      FROM
        qr_orders o
        LEFT JOIN customers c ON o.customer_id = c.phone AND c.tenant_id = o.tenant_id
        LEFT JOIN store_tables st ON o.table_id = st.id AND st.tenant_id = o.tenant_id
      WHERE
        o.status NOT IN('completed', 'cancelled')
        AND o.tenant_id = ?
        AND EXISTS (
          SELECT 1 FROM qr_order_items qoi
          WHERE qoi.order_id = o.id AND qoi.tenant_id = o.tenant_id
        )
      ORDER BY o.id DESC
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
            mi.image AS item_image,
            mi.tax_id,
            t.title as tax_title,
            t.rate as tax_rate,
            t.type as tax_type,
            oi.variant_id,
            miv.title AS variant_title,
            miv.price AS variant_price,
            oi.price,
            oi.quantity,
            oi.status,
            oi.date,
            oi.addons,
            oi.notes
          FROM
            qr_order_items oi
            LEFT JOIN menu_items mi ON oi.item_id = mi.id AND mi.tenant_id = oi.tenant_id
            LEFT JOIN taxes t ON t.id = mi.tax_id AND t.tenant_id = oi.tenant_id
            LEFT JOIN menu_item_variants miv ON oi.item_id = miv.item_id
              AND oi.variant_id = miv.id
          WHERE
            oi.order_id IN (?) AND oi.tenant_id = ?
        `
        const [kitchenOrdersItemsResult] = await conn.query(sql2, [orderIds, tenantId]);
        kitchenOrdersItems = kitchenOrdersItemsResult;

        const rawAddons = kitchenOrdersItems.flatMap((o) => {
          try {
            return o.addons ? JSON.parse(o.addons) : [];
          } catch {
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

      // Get recipe items for all menu items
      const recipeSql = `
        SELECT
          mir.id,
          mir.menu_item_id,
          mir.variant_id,
          mir.addon_id,
          mir.inventory_item_id,
          mi.title AS menu_item_title,
          v.title AS variant_title,
          a.title AS addon_title,
          ii.title AS ingredient_title,
          ii.unit,
          ii.quantity as current_quantity,
          ii.min_quantity_threshold,
          mir.quantity as recipe_quantity,
          'item' AS source,
          NULL AS library_addon_id
        FROM
          menu_item_recipes mir
        LEFT JOIN menu_items mi ON mir.menu_item_id = mi.id
        LEFT JOIN menu_item_variants v ON mir.variant_id = v.id
        LEFT JOIN menu_item_addons a ON mir.addon_id = a.id
        LEFT JOIN inventory_items ii ON mir.inventory_item_id = ii.id
        WHERE mir.tenant_id = ?
        UNION ALL
        SELECT
            -alr.id AS id,
            mia.item_id AS menu_item_id,
            0 AS variant_id,
            mia.id AS addon_id,
            alr.inventory_item_id,
            mi.title AS menu_item_title,
            NULL AS variant_title,
            mia.title AS addon_title,
            ii.title AS ingredient_title,
            ii.unit,
            ii.quantity as current_quantity,
            ii.min_quantity_threshold,
            alr.quantity as recipe_quantity,
            'library' AS source,
            alr.library_addon_id
        FROM addon_library_recipes alr
        JOIN menu_item_addons mia ON mia.library_addon_id = alr.library_addon_id AND mia.tenant_id = alr.tenant_id
        LEFT JOIN menu_items mi ON mi.id = mia.item_id
        LEFT JOIN inventory_items ii ON ii.id = alr.inventory_item_id
        WHERE alr.tenant_id = ?
      `;

      const [recipeItemsResult] = await conn.query(recipeSql, [tenantId, tenantId]);
      recipeItems = recipeItemsResult;

      // Attach recipeItems to each kitchenOrderItem
      kitchenOrdersItems = kitchenOrdersItems.map(oi => {
        const relevantRecipeItems = recipeItems.filter(ri =>
          ri.menu_item_id === oi.item_id &&
          (ri.variant_id == 0 || ri.variant_id === oi.variant_id) &&
          (ri.addon_id === 0 || oi.addons?.includes(ri.addon_id))
        );
        return {
          ...oi,
          recipeItems: relevantRecipeItems
        };
      });

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

exports.updateQROrderStatusDB = async (tenantId, orderId, status, linkedOrderId = null) => {
  const conn = await getMySqlPromiseConnection();

  try {
    const sql = linkedOrderId
      ? `UPDATE qr_orders SET status = ?, linked_order_id = ? WHERE tenant_id = ? AND id = ?;`
      : `UPDATE qr_orders SET status = ? WHERE tenant_id = ? AND id = ?;`;

    const params = linkedOrderId
      ? [status, Number(linkedOrderId), tenantId, orderId]
      : [status, tenantId, orderId];

    await conn.query(sql, params);
    return;
  } catch (error) {
      console.error(error);
      throw error;
  } finally {
      conn.release();
  }
};

exports.approveQROrderDB = async (tenantId, qrOrderId, username = "Staff") => {
  const conn = await getMySqlPromiseConnection();
  let qrOrder = null;
  let cartItems = [];
  let validCreatedBy = null;

  try {
    if (username) {
      const [userRows] = await conn.query(
        `SELECT username FROM users WHERE username = ? AND tenant_id = ? LIMIT 1`,
        [username, tenantId]
      );
      if (userRows.length > 0) {
        validCreatedBy = userRows[0].username;
      }
    }

    const [orderRows] = await conn.query(
      `SELECT id, delivery_type, customer_type, customer_id, table_id, status, payment_status
       FROM qr_orders
       WHERE id = ? AND tenant_id = ?
       LIMIT 1`,
      [qrOrderId, tenantId]
    );

    qrOrder = orderRows[0];
    if (!qrOrder) {
      const err = new Error("QR order not found");
      err.statusCode = 404;
      throw err;
    }

    if (qrOrder.status === "completed" || qrOrder.status === "cancelled") {
      const err = new Error(`QR order is already ${qrOrder.status}`);
      err.statusCode = 400;
      throw err;
    }

    const [itemRows] = await conn.query(
      `SELECT qoi.id, qoi.item_id, qoi.variant_id, qoi.price, qoi.quantity, qoi.notes, qoi.addons,
              mi.kitchen_station_id, c.kitchen_station_id AS cat_station_id
       FROM qr_order_items qoi
       LEFT JOIN menu_items mi ON qoi.item_id = mi.id
       LEFT JOIN categories c ON mi.category = c.id
       WHERE qoi.order_id = ? AND qoi.tenant_id = ?`,
      [qrOrderId, tenantId]
    );

    if (!itemRows.length) {
      const err = new Error("QR order has no items");
      err.statusCode = 400;
      throw err;
    }

    const [recipeRows] = await conn.query(
      `SELECT mir.id, mir.menu_item_id, mir.variant_id, mir.addon_id, mir.inventory_item_id,
              ii.title AS ingredient_title, ii.unit, mir.quantity AS recipe_quantity
       FROM menu_item_recipes mir
       LEFT JOIN inventory_items ii ON mir.inventory_item_id = ii.id
       WHERE mir.tenant_id = ?`,
      [tenantId]
    );

    cartItems = itemRows.map((row) => {
      let addonsIds = [];
      try {
        addonsIds = row.addons ? JSON.parse(row.addons) : [];
      } catch {
        addonsIds = [];
      }
      const itemRecipes = recipeRows.filter((r) => Number(r.menu_item_id) === Number(row.item_id));
      return {
        id: row.item_id,
        variant_id: row.variant_id,
        price: row.price,
        quantity: row.quantity,
        notes: row.notes,
        addons_ids: Array.isArray(addonsIds) ? addonsIds : [],
        kitchen_station_id: row.kitchen_station_id || row.cat_station_id || null,
        recipeItems: itemRecipes,
      };
    });
  } finally {
    conn.release();
  }

  // Create real kitchen order with station routing & recipe deduction
  const created = await exports.createOrderDB(
    tenantId,
    cartItems,
    qrOrder.delivery_type || (qrOrder.table_id ? "dinein" : null),
    qrOrder.customer_type || "WALKIN",
    qrOrder.customer_id || null,
    qrOrder.table_id || null,
    qrOrder.payment_status || "pending",
    null,
    validCreatedBy
  );

  await exports.updateQROrderStatusDB(tenantId, qrOrderId, "completed", created.orderId);

  return {
    qrOrderId: Number(qrOrderId),
    orderId: created.orderId,
    tokenNo: created.tokenNo,
    tableId: qrOrder.table_id || null,
    availabilityChanges: created.availabilityChanges || [],
  };
};


exports.cancelAllQROrdersDB = async (tenantId, status) => {
  const conn = await getMySqlPromiseConnection();

  try {
    const sql = `
      UPDATE qr_orders
      SET status = ?
      WHERE tenant_id = ? AND status NOT IN ('completed', 'cancelled');
    `;

    const [result] = await conn.query(sql, [status, tenantId]);
    return;
  } catch (error) {
      console.error(error);
      throw error;
  } finally {
      conn.release();
  }
};


/**
 * Fire held courses on an order. With `course`, only that course; otherwise
 * every held line. Fired lines get a fresh `date` so KDS timers start now.
 * Returns the fired lines (for the "FIRE" kitchen ticket).
 */
exports.fireHeldItemsDB = async (tenantId, orderId, { course = null, itemIds = null } = {}) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();
    const params = [orderId, tenantId];
    let where = `oi.order_id = ? AND oi.tenant_id = ? AND oi.fire_status = 'held' AND oi.status <> 'cancelled'`;
    if (course) {
      where += ` AND oi.course = ?`;
      params.push(Number(course));
    }
    if (Array.isArray(itemIds) && itemIds.length > 0) {
      where += ` AND oi.id IN (?)`;
      params.push(itemIds.map(Number));
    }

    const [rows] = await conn.query(
      `SELECT oi.id, oi.item_id, oi.variant_id, oi.quantity, oi.notes, oi.addons, oi.course, oi.seat_no,
              oi.kitchen_station_id, mi.title AS item_title, miv.title AS variant_title, ks.name AS station_name
       FROM order_items oi
       LEFT JOIN menu_items mi ON mi.id = oi.item_id AND mi.tenant_id = oi.tenant_id
       LEFT JOIN menu_item_variants miv ON miv.id = oi.variant_id AND miv.item_id = oi.item_id
       LEFT JOIN kitchen_stations ks ON ks.id = oi.kitchen_station_id AND ks.tenant_id = oi.tenant_id
       WHERE ${where}
       FOR UPDATE`,
      params
    );
    if (rows.length === 0) {
      await conn.rollback();
      return { fired: [], order: null };
    }

    await conn.query(
      `UPDATE order_items SET fire_status = 'fired', fired_at = NOW(), date = NOW() WHERE id IN (?) AND tenant_id = ?`,
      [rows.map((r) => r.id), tenantId]
    );

    const [[order]] = await conn.query(
      `SELECT o.id, o.token_no, o.table_id, o.delivery_type, st.table_title
       FROM orders o LEFT JOIN store_tables st ON st.id = o.table_id AND st.tenant_id = o.tenant_id
       WHERE o.id = ? AND o.tenant_id = ?`,
      [orderId, tenantId]
    );
    const [[remaining]] = await conn.query(
      `SELECT COUNT(*) AS held FROM order_items WHERE order_id = ? AND tenant_id = ? AND fire_status = 'held' AND status <> 'cancelled'`,
      [orderId, tenantId]
    );
    await conn.commit();

    const fired = rows.map((r) => {
      let addonIds = [];
      try {
        addonIds = r.addons ? JSON.parse(r.addons) : [];
      } catch {
        addonIds = [];
      }
      return {
        id: r.item_id,
        order_item_id: r.id,
        title: r.item_title,
        variant: r.variant_title ? { title: r.variant_title } : null,
        quantity: r.quantity,
        notes: r.notes,
        addons_ids: addonIds,
        course: r.course,
        seat: r.seat_no,
        kitchen_station_id: r.kitchen_station_id,
        kitchen_station_name: r.station_name,
      };
    });

    return { fired, order, stillHeld: Number(remaining?.held || 0) };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};
