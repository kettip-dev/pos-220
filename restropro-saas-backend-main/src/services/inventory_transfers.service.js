const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { syncLowStockAlertsDB } = require("./inventory.service");
const { queueLowStockAlerts } = require("./notification.service");

/**
 * Generate sequential reference number for Stock Transfers (e.g. TRX-20261101-0001)
 */
async function getNextTransferReference(conn, tenantId, dateStr) {
  const cleanDate = (dateStr || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
  const [seqRow] = await conn.query(
    `SELECT current_value FROM sequences WHERE tenant_id = ? AND table_name = 'inventory_stock_transfers' LIMIT 1 FOR UPDATE`,
    [tenantId]
  );

  let seqNum = 1;
  if (seqRow.length > 0) {
    seqNum = Number(seqRow[0].current_value || 0) + 1;
    await conn.query(
      `UPDATE sequences SET current_value = ? WHERE tenant_id = ? AND table_name = 'inventory_stock_transfers'`,
      [seqNum, tenantId]
    );
  } else {
    await conn.query(
      `INSERT INTO sequences (tenant_id, table_name, current_value) VALUES (?, 'inventory_stock_transfers', ?)`,
      [tenantId, seqNum]
    );
  }

  const paddedSeq = String(seqNum).padStart(4, "0");
  return `TRX-${cleanDate}-${paddedSeq}`;
}

/**
 * Get other branches in the same business group eligible for transfer
 */
exports.getTransferEligibleBranchesDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    // 1. Get current tenant's business_group_id
    const [currentTenant] = await conn.query(
      `SELECT id, business_group_id, name FROM tenants WHERE id = ?`,
      [tenantId]
    );

    if (currentTenant.length === 0) return [];

    const businessGroupId = currentTenant[0].business_group_id;

    if (businessGroupId) {
      const [branches] = await conn.query(
        `SELECT id, name, branch_code, address, is_main_branch 
         FROM tenants 
         WHERE business_group_id = ? AND id != ?
         ORDER BY is_main_branch DESC, name ASC`,
        [businessGroupId, tenantId]
      );
      return branches;
    }

    // Fallback: if no business group assigned, return any other active tenant
    const [branches] = await conn.query(
      `SELECT id, name, branch_code, address, is_main_branch 
       FROM tenants 
       WHERE id != ?
       ORDER BY name ASC 
       LIMIT 50`,
      [tenantId]
    );
    return branches;
  } finally {
    conn.release();
  }
};

/**
 * List Stock Transfers (Outgoing and Incoming)
 */
exports.getStockTransfersDB = async (tenantId, { page = 1, limit = 10, search = "", status = "all", direction = "all", fromDate = "", toDate = "" } = {}) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const whereClauses = [];
    const params = [];

    // Direction scoping
    if (direction === "outgoing") {
      whereClauses.push("t.from_tenant_id = ?");
      params.push(tenantId);
    } else if (direction === "incoming") {
      whereClauses.push("t.to_tenant_id = ?");
      params.push(tenantId);
    } else {
      whereClauses.push("(t.from_tenant_id = ? OR t.to_tenant_id = ?)");
      params.push(tenantId, tenantId);
    }

    if (status && status !== "all") {
      whereClauses.push("t.status = ?");
      params.push(status);
    }

    if (fromDate) {
      whereClauses.push("t.transfer_date >= ?");
      params.push(fromDate);
    }

    if (toDate) {
      whereClauses.push("t.transfer_date <= ?");
      params.push(toDate);
    }

    if (search && search.trim()) {
      whereClauses.push("(t.reference_no LIKE ? OR t.notes LIKE ? OR from_t.name LIKE ? OR to_t.name LIKE ?)");
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    const whereSql = whereClauses.join(" AND ");

    // 1. Total records
    const [countRows] = await conn.query(
      `SELECT COUNT(*) AS total 
       FROM inventory_stock_transfers t
       LEFT JOIN tenants from_t ON from_t.id = t.from_tenant_id
       LEFT JOIN tenants to_t ON to_t.id = t.to_tenant_id
       WHERE ${whereSql}`,
      params
    );
    const totalRecords = countRows[0]?.total || 0;

    // 2. Summary counts for current branch
    const [summaryRows] = await conn.query(
      `SELECT 
        COUNT(*) AS total_count,
        SUM(CASE WHEN status = 'in_transit' THEN 1 ELSE 0 END) AS in_transit_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
        SUM(CASE WHEN from_tenant_id = ? THEN 1 ELSE 0 END) AS outgoing_count,
        SUM(CASE WHEN to_tenant_id = ? THEN 1 ELSE 0 END) AS incoming_count,
        SUM(CASE WHEN to_tenant_id = ? AND status = 'in_transit' THEN 1 ELSE 0 END) AS pending_incoming_count
       FROM inventory_stock_transfers
       WHERE from_tenant_id = ? OR to_tenant_id = ?`,
      [tenantId, tenantId, tenantId, tenantId, tenantId]
    );

    // 3. Paginated list
    const listParams = [...params, limitNum, offset];
    const [rows] = await conn.query(
      `SELECT 
        t.id,
        t.business_group_id,
        t.from_tenant_id,
        from_t.name AS from_tenant_name,
        t.to_tenant_id,
        to_t.name AS to_tenant_name,
        t.reference_no,
        DATE_FORMAT(t.transfer_date, '%Y-%m-%d') AS transfer_date,
        t.status,
        t.total_items,
        t.total_quantity,
        t.notes,
        t.dispatched_by,
        t.dispatched_at,
        t.received_by,
        t.received_at,
        t.created_at,
        CASE WHEN t.from_tenant_id = ? THEN 'outgoing' ELSE 'incoming' END AS direction
       FROM inventory_stock_transfers t
       LEFT JOIN tenants from_t ON from_t.id = t.from_tenant_id
       LEFT JOIN tenants to_t ON to_t.id = t.to_tenant_id
       WHERE ${whereSql}
       ORDER BY t.transfer_date DESC, t.id DESC
       LIMIT ? OFFSET ?`,
      [tenantId, ...listParams]
    );

    return {
      transfers: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalRecords,
        totalPages: Math.ceil(totalRecords / limitNum),
      },
      summary: summaryRows[0] || {
        total_count: 0,
        in_transit_count: 0,
        completed_count: 0,
        outgoing_count: 0,
        incoming_count: 0,
        pending_incoming_count: 0,
      },
    };
  } finally {
    conn.release();
  }
};

/**
 * Get detailed Stock Transfer by ID with line items
 */
exports.getStockTransferByIdDB = async (transferId, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [trxRows] = await conn.query(
      `SELECT 
        t.id,
        t.business_group_id,
        t.from_tenant_id,
        from_t.name AS from_tenant_name,
        from_t.address AS from_tenant_address,
        t.to_tenant_id,
        to_t.name AS to_tenant_name,
        to_t.address AS to_tenant_address,
        t.reference_no,
        DATE_FORMAT(t.transfer_date, '%Y-%m-%d') AS transfer_date,
        t.status,
        t.total_items,
        t.total_quantity,
        t.notes,
        t.dispatched_by,
        t.dispatched_at,
        t.received_by,
        t.received_at,
        t.created_at,
        CASE WHEN t.from_tenant_id = ? THEN 'outgoing' ELSE 'incoming' END AS direction
       FROM inventory_stock_transfers t
       LEFT JOIN tenants from_t ON from_t.id = t.from_tenant_id
       LEFT JOIN tenants to_t ON to_t.id = t.to_tenant_id
       WHERE t.id = ? AND (t.from_tenant_id = ? OR t.to_tenant_id = ?)`,
      [tenantId, transferId, tenantId, tenantId]
    );

    if (trxRows.length === 0) return null;

    const transfer = trxRows[0];

    const [items] = await conn.query(
      `SELECT 
        ti.id,
        ti.transfer_id,
        ti.from_item_id,
        ti.to_item_id,
        ti.item_title,
        ti.unit,
        ti.quantity_sent,
        ti.quantity_received,
        ti.note,
        ti.created_at
       FROM inventory_stock_transfer_items ti
       WHERE ti.transfer_id = ?
       ORDER BY ti.id ASC`,
      [transferId]
    );

    transfer.items = items;
    return transfer;
  } finally {
    conn.release();
  }
};

/**
 * Create a new Stock Transfer (Draft or In-Transit Dispatch)
 */
exports.createStockTransferDB = async ({ tenantId, toTenantId, transferDate, status = "in_transit", notes = "", items = [], username = "" }) => {
  if (!toTenantId || Number(toTenantId) === Number(tenantId)) {
    throw new Error("Invalid destination branch. Cannot transfer to the same branch.");
  }

  if (!items || items.length === 0) {
    throw new Error("Transfer must contain at least one item.");
  }

  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    // Verify destination tenant
    const [destTenant] = await conn.query(`SELECT id, name, business_group_id FROM tenants WHERE id = ?`, [toTenantId]);
    if (destTenant.length === 0) {
      throw new Error("Destination branch not found.");
    }
    const destName = destTenant[0].name;
    const businessGroupId = destTenant[0].business_group_id;

    const referenceNo = await getNextTransferReference(conn, tenantId, transferDate);

    let totalQuantity = 0;
    for (const it of items) {
      totalQuantity += parseFloat(it.quantity_sent || 0);
    }

    const isDispatch = status === "in_transit";

    // 1. Insert header
    const [headerResult] = await conn.query(
      `INSERT INTO inventory_stock_transfers 
        (business_group_id, from_tenant_id, to_tenant_id, reference_no, transfer_date, status, total_items, total_quantity, notes, dispatched_by, dispatched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        businessGroupId,
        tenantId,
        toTenantId,
        referenceNo,
        transferDate,
        isDispatch ? "in_transit" : "draft",
        items.length,
        totalQuantity,
        notes,
        isDispatch ? username : null,
        isDispatch ? new Date() : null,
      ]
    );

    const transferId = headerResult.insertId;

    // 2. Insert items and deduct stock if dispatching
    const touchedItemIds = [];
    for (const it of items) {
      const qtySent = parseFloat(it.quantity_sent || 0);
      if (qtySent <= 0) {
        throw new Error(`Transfer quantity for "${it.item_title}" must be greater than zero.`);
      }

      await conn.query(
        `INSERT INTO inventory_stock_transfer_items
          (transfer_id, from_item_id, item_title, unit, quantity_sent, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [transferId, it.from_item_id, it.item_title, it.unit, qtySent, it.note || ""]
      );

      if (isDispatch) {
        touchedItemIds.push(it.from_item_id);

        const [itemRows] = await conn.query(
          `SELECT quantity, min_quantity_threshold FROM inventory_items WHERE id = ? AND tenant_id = ? FOR UPDATE`,
          [it.from_item_id, tenantId]
        );

        if (itemRows.length === 0) {
          throw new Error(`Item "${it.item_title}" not found in sender inventory.`);
        }

        const prevStock = parseFloat(itemRows[0].quantity);
        const threshold = parseFloat(itemRows[0].min_quantity_threshold);

        if (prevStock < qtySent) {
          throw new Error(`Insufficient stock for "${it.item_title}". Available: ${prevStock} ${it.unit}, Requested: ${qtySent} ${it.unit}`);
        }

        const newStock = prevStock - qtySent;
        let itemStatus = "out";
        if (newStock > 0 && newStock <= threshold) {
          itemStatus = "low";
        } else if (newStock > threshold) {
          itemStatus = "in";
        }

        await conn.query(
          `UPDATE inventory_items SET quantity = ?, status = ? WHERE id = ? AND tenant_id = ?`,
          [newStock, itemStatus, it.from_item_id, tenantId]
        );

        const logNote = `Stock Transfer Dispatched to "${destName}" (${referenceNo})${it.note ? `: ${it.note}` : ""}`;
        await conn.query(
          `INSERT INTO inventory_logs (tenant_id, inventory_item_id, type, quantity_change, previous_quantity, new_quantity, note, created_by)
           VALUES (?, ?, 'OUT', ?, ?, ?, ?, ?)`,
          [tenantId, it.from_item_id, qtySent, prevStock, newStock, logNote, username]
        );
      }
    }

    let newlyLow = [];
    if (isDispatch && touchedItemIds.length > 0) {
      newlyLow = await syncLowStockAlertsDB(conn, tenantId, touchedItemIds);
    }

    await conn.commit();

    if (newlyLow.length > 0) {
      queueLowStockAlerts(tenantId, newlyLow);
    }

    return {
      id: transferId,
      reference_no: referenceNo,
      status: isDispatch ? "in_transit" : "draft",
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Dispatch an existing Draft Transfer
 */
exports.dispatchDraftTransferDB = async (transferId, tenantId, username) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [trxRows] = await conn.query(
      `SELECT t.*, to_t.name AS to_tenant_name 
       FROM inventory_stock_transfers t
       JOIN tenants to_t ON to_t.id = t.to_tenant_id
       WHERE t.id = ? AND t.from_tenant_id = ? FOR UPDATE`,
      [transferId, tenantId]
    );

    if (trxRows.length === 0) {
      throw new Error("Transfer not found or not authorized.");
    }

    const transfer = trxRows[0];
    if (transfer.status !== "draft") {
      throw new Error(`Transfer cannot be dispatched because its status is "${transfer.status}".`);
    }

    const [items] = await conn.query(
      `SELECT * FROM inventory_stock_transfer_items WHERE transfer_id = ?`,
      [transferId]
    );

    const touchedItemIds = [];
    for (const it of items) {
      const qtySent = parseFloat(it.quantity_sent || 0);
      touchedItemIds.push(it.from_item_id);

      const [itemRows] = await conn.query(
        `SELECT quantity, min_quantity_threshold FROM inventory_items WHERE id = ? AND tenant_id = ? FOR UPDATE`,
        [it.from_item_id, tenantId]
      );

      if (itemRows.length === 0) {
        throw new Error(`Item "${it.item_title}" not found in sender inventory.`);
      }

      const prevStock = parseFloat(itemRows[0].quantity);
      const threshold = parseFloat(itemRows[0].min_quantity_threshold);

      if (prevStock < qtySent) {
        throw new Error(`Insufficient stock for "${it.item_title}". Available: ${prevStock} ${it.unit}, Requested: ${qtySent} ${it.unit}`);
      }

      const newStock = prevStock - qtySent;
      let itemStatus = "out";
      if (newStock > 0 && newStock <= threshold) {
        itemStatus = "low";
      } else if (newStock > threshold) {
        itemStatus = "in";
      }

      await conn.query(
        `UPDATE inventory_items SET quantity = ?, status = ? WHERE id = ? AND tenant_id = ?`,
        [newStock, itemStatus, it.from_item_id, tenantId]
      );

      const logNote = `Stock Transfer Dispatched to "${transfer.to_tenant_name}" (${transfer.reference_no})${it.note ? `: ${it.note}` : ""}`;
      await conn.query(
        `INSERT INTO inventory_logs (tenant_id, inventory_item_id, type, quantity_change, previous_quantity, new_quantity, note, created_by)
         VALUES (?, ?, 'OUT', ?, ?, ?, ?, ?)`,
        [tenantId, it.from_item_id, qtySent, prevStock, newStock, logNote, username]
      );
    }

    await conn.query(
      `UPDATE inventory_stock_transfers 
       SET status = 'in_transit', dispatched_by = ?, dispatched_at = NOW() 
       WHERE id = ?`,
      [username, transferId]
    );

    let newlyLow = [];
    if (touchedItemIds.length > 0) {
      newlyLow = await syncLowStockAlertsDB(conn, tenantId, touchedItemIds);
    }

    await conn.commit();

    if (newlyLow.length > 0) {
      queueLowStockAlerts(tenantId, newlyLow);
    }

    return { success: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Receive In-Transit Transfer at Destination Branch
 * Auto-matches items by title & unit; creates missing items at destination branch.
 */
exports.receiveStockTransferDB = async (transferId, receiverTenantId, receivedItems = [], username = "") => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [trxRows] = await conn.query(
      `SELECT t.*, from_t.name AS from_tenant_name 
       FROM inventory_stock_transfers t
       JOIN tenants from_t ON from_t.id = t.from_tenant_id
       WHERE t.id = ? AND t.to_tenant_id = ? FOR UPDATE`,
      [transferId, receiverTenantId]
    );

    if (trxRows.length === 0) {
      throw new Error("Transfer not found or not assigned to your branch.");
    }

    const transfer = trxRows[0];
    if (transfer.status !== "in_transit") {
      throw new Error(`Cannot receive transfer because it is currently "${transfer.status}".`);
    }

    const [dbItems] = await conn.query(
      `SELECT * FROM inventory_stock_transfer_items WHERE transfer_id = ?`,
      [transferId]
    );

    // Map received quantities by item ID
    const receivedMap = new Map();
    for (const r of receivedItems) {
      receivedMap.set(Number(r.id), parseFloat(r.quantity_received !== undefined ? r.quantity_received : r.quantity_sent));
    }

    for (const it of dbItems) {
      const qtyReceived = receivedMap.has(it.id) ? receivedMap.get(it.id) : parseFloat(it.quantity_sent);
      if (qtyReceived < 0) {
        throw new Error(`Received quantity for "${it.item_title}" cannot be negative.`);
      }

      // Step A: Find matching item in destination tenant
      const [destItemRows] = await conn.query(
        `SELECT id, quantity, min_quantity_threshold 
         FROM inventory_items 
         WHERE tenant_id = ? AND LOWER(TRIM(title)) = LOWER(TRIM(?)) AND LOWER(TRIM(unit)) = LOWER(TRIM(?))
         LIMIT 1 FOR UPDATE`,
        [receiverTenantId, it.item_title, it.unit]
      );

      let destItemId;
      let prevStock = 0;
      let newStock = qtyReceived;

      if (destItemRows.length > 0) {
        // Item exists at destination branch -> update stock
        destItemId = destItemRows[0].id;
        prevStock = parseFloat(destItemRows[0].quantity);
        newStock = prevStock + qtyReceived;
        const threshold = parseFloat(destItemRows[0].min_quantity_threshold);

        let itemStatus = "out";
        if (newStock > 0 && newStock <= threshold) {
          itemStatus = "low";
        } else if (newStock > threshold) {
          itemStatus = "in";
        }

        await conn.query(
          `UPDATE inventory_items SET quantity = ?, status = ? WHERE id = ? AND tenant_id = ?`,
          [newStock, itemStatus, destItemId, receiverTenantId]
        );
      } else {
        // Auto-create item at destination branch with received stock!
        const defaultThreshold = 5;
        let itemStatus = newStock > defaultThreshold ? "in" : (newStock > 0 ? "low" : "out");

        const [insertRes] = await conn.query(
          `INSERT INTO inventory_items (tenant_id, title, unit, quantity, min_quantity_threshold, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [receiverTenantId, it.item_title, it.unit, newStock, defaultThreshold, itemStatus]
        );
        destItemId = insertRes.insertId;
      }

      // Record in transfer item
      await conn.query(
        `UPDATE inventory_stock_transfer_items 
         SET to_item_id = ?, quantity_received = ? 
         WHERE id = ?`,
        [destItemId, qtyReceived, it.id]
      );

      // Record in destination branch's inventory_logs
      const logNote = `Stock Received from "${transfer.from_tenant_name}" (${transfer.reference_no})`;
      await conn.query(
        `INSERT INTO inventory_logs (tenant_id, inventory_item_id, type, quantity_change, previous_quantity, new_quantity, note, created_by)
         VALUES (?, ?, 'IN', ?, ?, ?, ?, ?)`,
        [receiverTenantId, destItemId, qtyReceived, prevStock, newStock, logNote, username]
      );
    }

    // Mark transfer as completed
    await conn.query(
      `UPDATE inventory_stock_transfers 
       SET status = 'completed', received_by = ?, received_at = NOW() 
       WHERE id = ?`,
      [username, transferId]
    );

    await conn.commit();
    return { success: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Cancel a Transfer (Draft or In-Transit return to sender)
 */
exports.cancelStockTransferDB = async (transferId, tenantId, username) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [trxRows] = await conn.query(
      `SELECT * FROM inventory_stock_transfers WHERE id = ? AND (from_tenant_id = ? OR to_tenant_id = ?) FOR UPDATE`,
      [transferId, tenantId, tenantId]
    );

    if (trxRows.length === 0) {
      throw new Error("Transfer not found or not authorized.");
    }

    const transfer = trxRows[0];
    if (transfer.status === "completed") {
      throw new Error("Completed transfers cannot be cancelled.");
    }
    if (transfer.status === "cancelled") {
      throw new Error("Transfer is already cancelled.");
    }

    // If cancelled while in_transit, rollback stock back to sender branch
    if (transfer.status === "in_transit") {
      const [items] = await conn.query(
        `SELECT * FROM inventory_stock_transfer_items WHERE transfer_id = ?`,
        [transferId]
      );

      for (const it of items) {
        const qtySent = parseFloat(it.quantity_sent || 0);

        const [itemRows] = await conn.query(
          `SELECT quantity, min_quantity_threshold FROM inventory_items WHERE id = ? AND tenant_id = ? FOR UPDATE`,
          [it.from_item_id, transfer.from_tenant_id]
        );

        if (itemRows.length > 0) {
          const prevStock = parseFloat(itemRows[0].quantity);
          const threshold = parseFloat(itemRows[0].min_quantity_threshold);
          const newStock = prevStock + qtySent;

          let itemStatus = "out";
          if (newStock > 0 && newStock <= threshold) {
            itemStatus = "low";
          } else if (newStock > threshold) {
            itemStatus = "in";
          }

          await conn.query(
            `UPDATE inventory_items SET quantity = ?, status = ? WHERE id = ? AND tenant_id = ?`,
            [newStock, itemStatus, it.from_item_id, transfer.from_tenant_id]
          );

          const logNote = `Stock Transfer Cancelled Return (${transfer.reference_no})`;
          await conn.query(
            `INSERT INTO inventory_logs (tenant_id, inventory_item_id, type, quantity_change, previous_quantity, new_quantity, note, created_by)
             VALUES (?, ?, 'IN', ?, ?, ?, ?, ?)`,
            [transfer.from_tenant_id, it.from_item_id, qtySent, prevStock, newStock, logNote, username]
          );
        }
      }
    }

    await conn.query(
      `UPDATE inventory_stock_transfers SET status = 'cancelled' WHERE id = ?`,
      [transferId]
    );

    await conn.commit();
    return { success: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
