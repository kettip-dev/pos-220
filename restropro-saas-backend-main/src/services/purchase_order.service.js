const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { syncLowStockAlertsDB } = require("./inventory.service");
const { queueLowStockAlerts } = require("./notification.service");

/**
 * Create a new Purchase Order
 */
exports.createPurchaseOrderDB = async (payload, userId, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const {
      vendorId,
      vendorName,
      contactPerson,
      phone,
      taxIdNo,
      address,
      notes,
      currency = "$",
      items = [],
      status = "ordered",
    } = payload;

    if (!items || items.length === 0) {
      throw new Error("Purchase Order must contain at least one item.");
    }

    // Calculate total amount
    let totalAmount = 0;
    for (const item of items) {
      const qty = parseFloat(item.quantity) || 0;
      const unitCost = parseFloat(item.unit_cost || item.unitCost || 0);
      totalAmount += qty * unitCost;
    }

    // Insert purchase order
    const insertPoSql = `
      INSERT INTO inventory_purchase_orders
      (tenant_id, vendor_id, vendor_name, contact_person, phone, tax_id_no, address,
       total_amount, currency, created_by, notes, status, created_at)
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW());
    `;

    const [poResult] = await conn.query(insertPoSql, [
      tenantId,
      vendorId || null,
      vendorName,
      contactPerson || null,
      phone || null,
      taxIdNo || null,
      address || null,
      totalAmount,
      currency,
      userId,
      notes || null,
      status || "ordered",
    ]);

    const poId = poResult.insertId;

    // Prepare line items
    const lineItemValues = items.map((item) => {
      const qty = parseFloat(item.quantity) || 0;
      const unitCost = parseFloat(item.unit_cost || item.unitCost || 0);
      const subtotal = qty * unitCost;
      return [
        poId,
        tenantId,
        item.inventory_item_id || item.itemId || null,
        item.inventory_item_name || item.name || item.title || "Item",
        item.inventory_item_unit || item.unit || "pc",
        qty,
        unitCost,
        subtotal,
      ];
    });

    const insertItemsSql = `
      INSERT INTO inventory_purchase_order_items
      (purchase_order_id, tenant_id, inventory_item_id, inventory_item_name,
       inventory_item_unit, quantity, unit_cost, subtotal)
      VALUES ?;
    `;

    await conn.query(insertItemsSql, [lineItemValues]);

    // If any items came from draft, clear them
    const draftIds = items.map((i) => i.draft_id).filter(Boolean);
    if (draftIds.length > 0) {
      await conn.query(
        `DELETE FROM inventory_purchase_orders_drafts WHERE id IN (?) AND tenant_id = ?`,
        [draftIds, tenantId]
      );
    }

    await conn.commit();
    return { id: poId, totalAmount, status };
  } catch (error) {
    await conn.rollback();
    console.error("createPurchaseOrderDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Get paginated list of Purchase Orders with filter
 */
exports.getPurchaseOrdersDB = async (page = 1, perPage = 10, filter = {}, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(perPage, 10) || 10, 1), 100);
    const offset = (currentPage - 1) * limit;

    let filterClause = "WHERE po.tenant_id = ?";
    const params = [tenantId];

    if (filter.status && filter.status !== "all") {
      filterClause += " AND po.status = ?";
      params.push(filter.status);
    }

    if (filter.vendorId) {
      filterClause += " AND po.vendor_id = ?";
      params.push(filter.vendorId);
    }

    if (filter.search && filter.search.trim()) {
      const q = `%${filter.search.trim()}%`;
      filterClause += " AND (po.vendor_name LIKE ? OR po.contact_person LIKE ? OR po.notes LIKE ? OR CAST(po.id AS CHAR) LIKE ?)";
      params.push(q, q, q, q);
    }

    if (filter.fromDate) {
      filterClause += " AND DATE(po.created_at) >= DATE(?)";
      params.push(filter.fromDate);
    }

    if (filter.toDate) {
      filterClause += " AND DATE(po.created_at) <= DATE(?)";
      params.push(filter.toDate);
    }

    const countSql = `SELECT COUNT(*) AS total FROM inventory_purchase_orders po ${filterClause};`;
    const [countRes] = await conn.query(countSql, params);
    const total = countRes[0]?.total || 0;

    const sql = `
      SELECT
        po.id,
        po.tenant_id,
        po.vendor_id,
        po.vendor_name,
        po.contact_person,
        po.phone,
        po.tax_id_no,
        po.address,
        po.total_amount,
        po.currency,
        po.created_by,
        po.notes,
        po.status,
        po.created_at,
        po.fullfilled_at
      FROM inventory_purchase_orders po
      ${filterClause}
      ORDER BY po.created_at DESC
      LIMIT ? OFFSET ?;
    `;

    const [orders] = await conn.query(sql, [...params, limit, offset]);

    if (orders.length > 0) {
      const orderIds = orders.map((o) => o.id);
      const [items] = await conn.query(
        `SELECT
           id,
           purchase_order_id,
           inventory_item_id,
           inventory_item_name,
           inventory_item_unit,
           quantity,
           unit_cost,
           subtotal
         FROM inventory_purchase_order_items
         WHERE purchase_order_id IN (?) AND tenant_id = ?;`,
        [orderIds, tenantId]
      );

      const itemsByOrderId = {};
      items.forEach((it) => {
        if (!itemsByOrderId[it.purchase_order_id]) {
          itemsByOrderId[it.purchase_order_id] = [];
        }
        itemsByOrderId[it.purchase_order_id].push(it);
      });

      orders.forEach((o) => {
        o.items = itemsByOrderId[o.id] || [];
        o.item_count = o.items.length;
      });
    }

    return {
      orders,
      currentPage,
      perPage: limit,
      totalPages: Math.ceil(total / limit),
      totalOrders: total,
    };
  } catch (error) {
    console.error("getPurchaseOrdersDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Get single Purchase Order by ID
 */
exports.getPurchaseOrderByIdDB = async (id, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [orders] = await conn.query(
      `SELECT * FROM inventory_purchase_orders WHERE id = ? AND tenant_id = ? LIMIT 1;`,
      [id, tenantId]
    );

    if (orders.length === 0) return null;
    const po = orders[0];

    const [items] = await conn.query(
      `SELECT
         id,
         purchase_order_id,
         inventory_item_id,
         inventory_item_name,
         inventory_item_unit,
         quantity,
         unit_cost,
         subtotal
       FROM inventory_purchase_order_items
       WHERE purchase_order_id = ? AND tenant_id = ?;`,
      [id, tenantId]
    );

    po.items = items;
    return po;
  } catch (error) {
    console.error("getPurchaseOrderByIdDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Fulfill / Receive Purchase Order:
 * Increments inventory stock, records IN log, triggers recipes check and low stock reconciliation
 */
exports.fulfillPurchaseOrderDB = async (id, userId, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [poRows] = await conn.query(
      `SELECT id, vendor_name, status FROM inventory_purchase_orders WHERE id = ? AND tenant_id = ? FOR UPDATE;`,
      [id, tenantId]
    );

    if (poRows.length === 0) {
      throw new Error("Purchase order not found.");
    }

    const po = poRows[0];
    if (po.status === "completed") {
      throw new Error("Purchase order is already fulfilled/completed.");
    }
    if (po.status === "cancelled") {
      throw new Error("Cannot fulfill a cancelled purchase order.");
    }

    // 1. Mark PO as completed
    await conn.query(
      `UPDATE inventory_purchase_orders
       SET status = 'completed', fullfilled_at = NOW()
       WHERE id = ? AND tenant_id = ?;`,
      [id, tenantId]
    );

    // 2. Fetch PO line items
    const [poItems] = await conn.query(
      `SELECT inventory_item_id, inventory_item_name, quantity
       FROM inventory_purchase_order_items
       WHERE purchase_order_id = ? AND tenant_id = ?;`,
      [id, tenantId]
    );

    const inventoryItemIds = poItems
      .map((i) => i.inventory_item_id)
      .filter(Boolean);

    let inventoryItems = [];
    if (inventoryItemIds.length > 0) {
      const [res] = await conn.query(
        `SELECT id, quantity, title FROM inventory_items WHERE id IN (?) AND tenant_id = ? FOR UPDATE;`,
        [inventoryItemIds, tenantId]
      );
      inventoryItems = res;
    }

    const inventoryLogs = [];

    // Check if userId is a valid username for foreign key in inventory_logs
    let validCreatedBy = null;
    if (userId) {
      const [userRows] = await conn.query(
        `SELECT username FROM users WHERE username = ? LIMIT 1;`,
        [userId]
      );
      if (userRows.length > 0) {
        validCreatedBy = userRows[0].username;
      }
    }

    // 3. Increment stock & prepare movement logs
    for (const poItem of poItems) {
      if (!poItem.inventory_item_id) continue;

      const invItem = inventoryItems.find((ii) => ii.id === poItem.inventory_item_id);
      if (invItem) {
        const prevQty = parseFloat(invItem.quantity) || 0;
        const addQty = parseFloat(poItem.quantity) || 0;
        const newQty = prevQty + addQty;

        await conn.query(
          `UPDATE inventory_items
           SET quantity = ?, status = CASE
             WHEN ? <= min_quantity_threshold THEN 'low'
             ELSE 'in'
           END
           WHERE id = ? AND tenant_id = ?;`,
          [newQty, newQty, invItem.id, tenantId]
        );

        inventoryLogs.push([
          tenantId,
          invItem.id,
          "IN",
          addQty,
          prevQty,
          newQty,
          `PO #${id} received from ${po.vendor_name}`,
          validCreatedBy,
          new Date(),
        ]);
      }
    }

    // 4. Batch insert inventory logs
    if (inventoryLogs.length > 0) {
      await conn.query(
        `INSERT INTO inventory_logs
         (tenant_id, inventory_item_id, type, quantity_change, previous_quantity, new_quantity, note, created_by, created_at)
         VALUES ?;`,
        [inventoryLogs]
      );
    }

    // 5. Re-enable recipes if any menu items were out of ingredients
    const [disabledMenuItems] = await conn.query(
      `SELECT id FROM menu_items WHERE is_enabled = 0 AND tenant_id = ?;`,
      [tenantId]
    );

    for (const menu of disabledMenuItems) {
      const menuItemId = menu.id;
      const [recipes] = await conn.query(
        `SELECT mir.inventory_item_id, mir.quantity, ii.quantity AS available_quantity
         FROM menu_item_recipes mir
         JOIN inventory_items ii ON mir.inventory_item_id = ii.id AND mir.tenant_id = ii.tenant_id
         WHERE mir.menu_item_id = ? AND mir.variant_id = 0 AND mir.addon_id = 0 AND mir.tenant_id = ?;`,
        [menuItemId, tenantId]
      );

      const canEnable = recipes.length > 0 && recipes.every((r) =>
        parseFloat(r.available_quantity) >= parseFloat(r.quantity)
      );

      if (canEnable) {
        await conn.query(
          `UPDATE menu_items SET is_enabled = 1 WHERE id = ? AND tenant_id = ?;`,
          [menuItemId, tenantId]
        );
      }
    }

    // 6. Low stock reconciliation
    let newlyLow = [];
    if (syncLowStockAlertsDB && inventoryItemIds.length > 0) {
      newlyLow = await syncLowStockAlertsDB(conn, tenantId, inventoryItemIds);
    }

    await conn.commit();

    if (queueLowStockAlerts && newlyLow && newlyLow.length > 0) {
      queueLowStockAlerts(tenantId, newlyLow);
    }

    return true;
  } catch (error) {
    await conn.rollback();
    console.error("fulfillPurchaseOrderDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Cancel a Purchase Order
 */
exports.cancelPurchaseOrderDB = async (id, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [poRows] = await conn.query(
      `SELECT id, status FROM inventory_purchase_orders WHERE id = ? AND tenant_id = ?;`,
      [id, tenantId]
    );

    if (poRows.length === 0) throw new Error("Purchase order not found.");
    if (poRows[0].status === "completed") {
      throw new Error("Cannot cancel a completed/fulfilled purchase order.");
    }

    const [result] = await conn.query(
      `UPDATE inventory_purchase_orders SET status = 'cancelled' WHERE id = ? AND tenant_id = ?;`,
      [id, tenantId]
    );

    return result.affectedRows > 0;
  } catch (error) {
    console.error("cancelPurchaseOrderDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};
