const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { syncLowStockAlertsDB } = require("./inventory.service");
const { queueLowStockAlerts } = require("./notification.service");

/**
 * Generate sequential reference number for Stock Adjustments (e.g. ADJ-20261101-0001)
 */
async function getNextAdjustmentReference(conn, tenantId, dateStr) {
  const cleanDate = (dateStr || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
  const [seqRow] = await conn.query(
    `SELECT current_value FROM sequences WHERE tenant_id = ? AND table_name = 'inventory_stock_adjustments' LIMIT 1 FOR UPDATE`,
    [tenantId]
  );

  let seqNum = 1;
  if (seqRow.length > 0) {
    seqNum = Number(seqRow[0].current_value || 0) + 1;
    await conn.query(
      `UPDATE sequences SET current_value = ? WHERE tenant_id = ? AND table_name = 'inventory_stock_adjustments'`,
      [seqNum, tenantId]
    );
  } else {
    await conn.query(
      `INSERT INTO sequences (tenant_id, table_name, current_value) VALUES (?, 'inventory_stock_adjustments', ?)`,
      [tenantId, seqNum]
    );
  }

  const paddedSeq = String(seqNum).padStart(4, "0");
  return `ADJ-${cleanDate}-${paddedSeq}`;
}

/**
 * List Stock Adjustments with filters, pagination, and summary counts
 */
exports.getStockAdjustmentsDB = async (tenantId, { page = 1, limit = 10, search = "", status = "all", reason = "all", fromDate = "", toDate = "" } = {}) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const whereClauses = ["a.tenant_id = ?"];
    const params = [tenantId];

    if (status && status !== "all") {
      whereClauses.push("a.status = ?");
      params.push(status);
    }

    if (reason && reason !== "all") {
      whereClauses.push("a.reason = ?");
      params.push(reason);
    }

    if (fromDate) {
      whereClauses.push("a.adjustment_date >= ?");
      params.push(fromDate);
    }

    if (toDate) {
      whereClauses.push("a.adjustment_date <= ?");
      params.push(toDate);
    }

    if (search && search.trim()) {
      whereClauses.push("(a.reference_no LIKE ? OR a.notes LIKE ?)");
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    const whereSql = whereClauses.join(" AND ");

    // 1. Get total matching count
    const [countRows] = await conn.query(
      `SELECT COUNT(*) AS total FROM inventory_stock_adjustments a WHERE ${whereSql}`,
      params
    );
    const totalRecords = countRows[0]?.total || 0;

    // 2. Summary stats for quick cards
    const [summaryRows] = await conn.query(
      `SELECT 
        COUNT(*) AS total_count,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN net_quantity_change ELSE 0 END), 0) AS net_units_adjusted
       FROM inventory_stock_adjustments
       WHERE tenant_id = ?`,
      [tenantId]
    );

    // 3. Get paginated rows
    const listParams = [...params, limitNum, offset];
    const [rows] = await conn.query(
      `SELECT 
        a.id,
        a.reference_no,
        DATE_FORMAT(a.adjustment_date, '%Y-%m-%d') AS adjustment_date,
        a.reason,
        a.status,
        a.total_items,
        a.net_quantity_change,
        a.notes,
        a.created_by,
        a.completed_by,
        a.completed_at,
        a.created_at
       FROM inventory_stock_adjustments a
       WHERE ${whereSql}
       ORDER BY a.adjustment_date DESC, a.id DESC
       LIMIT ? OFFSET ?`,
      listParams
    );

    return {
      adjustments: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalRecords,
        totalPages: Math.ceil(totalRecords / limitNum),
      },
      summary: summaryRows[0] || {
        total_count: 0,
        draft_count: 0,
        completed_count: 0,
        net_units_adjusted: 0,
      },
    };
  } finally {
    conn.release();
  }
};

/**
 * Get detailed Stock Adjustment by ID with line items
 */
exports.getStockAdjustmentByIdDB = async (adjustmentId, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [adjRows] = await conn.query(
      `SELECT 
        a.id,
        a.tenant_id,
        a.reference_no,
        DATE_FORMAT(a.adjustment_date, '%Y-%m-%d') AS adjustment_date,
        a.reason,
        a.status,
        a.total_items,
        a.net_quantity_change,
        a.notes,
        a.created_by,
        a.completed_by,
        a.completed_at,
        a.created_at,
        a.updated_at
       FROM inventory_stock_adjustments a
       WHERE a.id = ? AND a.tenant_id = ?`,
      [adjustmentId, tenantId]
    );

    if (adjRows.length === 0) return null;

    const adjustment = adjRows[0];

    const [items] = await conn.query(
      `SELECT 
        i.id,
        i.adjustment_id,
        i.inventory_item_id,
        i.item_title,
        i.unit,
        i.current_quantity,
        i.counted_quantity,
        i.delta_quantity,
        i.note,
        i.created_at
       FROM inventory_stock_adjustment_items i
       WHERE i.adjustment_id = ? AND i.tenant_id = ?
       ORDER BY i.id ASC`,
      [adjustmentId, tenantId]
    );

    adjustment.items = items;
    return adjustment;
  } finally {
    conn.release();
  }
};

/**
 * Create a new Stock Adjustment voucher
 * Handles both Draft and Completed directly within a transaction
 */
exports.createStockAdjustmentDB = async ({ tenantId, adjustmentDate, reason, status = "completed", notes = "", items = [], username = "" }) => {
  if (!items || items.length === 0) {
    throw new Error("Adjustment must contain at least one inventory item.");
  }

  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const referenceNo = await getNextAdjustmentReference(conn, tenantId, adjustmentDate);

    // Compute totals
    const totalItems = items.length;
    let netQuantityChange = 0;
    for (const it of items) {
      netQuantityChange += parseFloat(it.delta_quantity || 0);
    }

    const isCompleted = status === "completed";

    // 1. Insert header
    const [headerResult] = await conn.query(
      `INSERT INTO inventory_stock_adjustments 
        (tenant_id, reference_no, adjustment_date, reason, status, total_items, net_quantity_change, notes, created_by, completed_by, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        referenceNo,
        adjustmentDate,
        reason,
        isCompleted ? "completed" : "draft",
        totalItems,
        netQuantityChange,
        notes,
        username,
        isCompleted ? username : null,
        isCompleted ? new Date() : null,
      ]
    );

    const adjustmentId = headerResult.insertId;

    // 2. Insert line items
    const touchedItemIds = [];
    for (const it of items) {
      const currentQty = parseFloat(it.current_quantity || 0);
      const countedQty = parseFloat(it.counted_quantity !== undefined ? it.counted_quantity : (currentQty + parseFloat(it.delta_quantity || 0)));
      const deltaQty = parseFloat(it.delta_quantity || (countedQty - currentQty));

      await conn.query(
        `INSERT INTO inventory_stock_adjustment_items
          (tenant_id, adjustment_id, inventory_item_id, item_title, unit, current_quantity, counted_quantity, delta_quantity, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, adjustmentId, it.inventory_item_id, it.item_title, it.unit, currentQty, countedQty, deltaQty, it.note || ""]
      );

      // If completed, update live inventory
      if (isCompleted && deltaQty !== 0) {
        touchedItemIds.push(it.inventory_item_id);

        const [itemRows] = await conn.query(
          `SELECT quantity, min_quantity_threshold FROM inventory_items WHERE id = ? AND tenant_id = ? FOR UPDATE`,
          [it.inventory_item_id, tenantId]
        );

        if (itemRows.length > 0) {
          const prevStock = parseFloat(itemRows[0].quantity);
          const threshold = parseFloat(itemRows[0].min_quantity_threshold);
          const newStock = prevStock + deltaQty;

          if (newStock < 0) {
            throw new Error(`Insufficient stock for "${it.item_title}". Adjustment would result in negative stock (${newStock} ${it.unit}).`);
          }

          let itemStatus = "out";
          if (newStock > 0 && newStock <= threshold) {
            itemStatus = "low";
          } else if (newStock > threshold) {
            itemStatus = "in";
          }

          await conn.query(
            `UPDATE inventory_items SET quantity = ?, status = ? WHERE id = ? AND tenant_id = ?`,
            [newStock, itemStatus, it.inventory_item_id, tenantId]
          );

          // Determine log movement type
          let logType = "IN";
          if (deltaQty < 0) {
            logType = (reason === "spoilage" || reason === "damage" || reason === "theft_loss") ? "WASTAGE" : "OUT";
          }

          const logNote = `Stock Adjustment (${referenceNo} - ${reason})${it.note ? `: ${it.note}` : ""}`;
          await conn.query(
            `INSERT INTO inventory_logs (tenant_id, inventory_item_id, type, quantity_change, previous_quantity, new_quantity, note, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [tenantId, it.inventory_item_id, logType, Math.abs(deltaQty), prevStock, newStock, logNote, username]
          );
        }
      }
    }

    let newlyLow = [];
    if (isCompleted && touchedItemIds.length > 0) {
      newlyLow = await syncLowStockAlertsDB(conn, tenantId, touchedItemIds);
    }

    await conn.commit();

    if (newlyLow.length > 0) {
      queueLowStockAlerts(tenantId, newlyLow);
    }

    return {
      id: adjustmentId,
      reference_no: referenceNo,
      status: isCompleted ? "completed" : "draft",
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Complete an existing Draft Stock Adjustment
 */
exports.completeDraftAdjustmentDB = async (adjustmentId, tenantId, username) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [adjRows] = await conn.query(
      `SELECT * FROM inventory_stock_adjustments WHERE id = ? AND tenant_id = ? FOR UPDATE`,
      [adjustmentId, tenantId]
    );

    if (adjRows.length === 0) {
      throw new Error("Adjustment voucher not found.");
    }

    const adjustment = adjRows[0];
    if (adjustment.status === "completed") {
      throw new Error("This adjustment has already been completed.");
    }

    const [items] = await conn.query(
      `SELECT * FROM inventory_stock_adjustment_items WHERE adjustment_id = ? AND tenant_id = ?`,
      [adjustmentId, tenantId]
    );

    const touchedItemIds = [];
    for (const it of items) {
      const deltaQty = parseFloat(it.delta_quantity || 0);
      if (deltaQty !== 0) {
        touchedItemIds.push(it.inventory_item_id);

        const [itemRows] = await conn.query(
          `SELECT quantity, min_quantity_threshold FROM inventory_items WHERE id = ? AND tenant_id = ? FOR UPDATE`,
          [it.inventory_item_id, tenantId]
        );

        if (itemRows.length > 0) {
          const prevStock = parseFloat(itemRows[0].quantity);
          const threshold = parseFloat(itemRows[0].min_quantity_threshold);
          const newStock = prevStock + deltaQty;

          if (newStock < 0) {
            throw new Error(`Insufficient stock for "${it.item_title}". Current: ${prevStock}, change: ${deltaQty}`);
          }

          let itemStatus = "out";
          if (newStock > 0 && newStock <= threshold) {
            itemStatus = "low";
          } else if (newStock > threshold) {
            itemStatus = "in";
          }

          await conn.query(
            `UPDATE inventory_items SET quantity = ?, status = ? WHERE id = ? AND tenant_id = ?`,
            [newStock, itemStatus, it.inventory_item_id, tenantId]
          );

          let logType = "IN";
          if (deltaQty < 0) {
            logType = (adjustment.reason === "spoilage" || adjustment.reason === "damage" || adjustment.reason === "theft_loss") ? "WASTAGE" : "OUT";
          }

          const logNote = `Stock Adjustment Completed (${adjustment.reference_no} - ${adjustment.reason})${it.note ? `: ${it.note}` : ""}`;
          await conn.query(
            `INSERT INTO inventory_logs (tenant_id, inventory_item_id, type, quantity_change, previous_quantity, new_quantity, note, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [tenantId, it.inventory_item_id, logType, Math.abs(deltaQty), prevStock, newStock, logNote, username]
          );
        }
      }
    }

    await conn.query(
      `UPDATE inventory_stock_adjustments 
       SET status = 'completed', completed_by = ?, completed_at = NOW() 
       WHERE id = ? AND tenant_id = ?`,
      [username, adjustmentId, tenantId]
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
 * Delete a Draft adjustment voucher (only draft allowed)
 */
exports.deleteStockAdjustmentDB = async (adjustmentId, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [adjRows] = await conn.query(
      `SELECT status FROM inventory_stock_adjustments WHERE id = ? AND tenant_id = ?`,
      [adjustmentId, tenantId]
    );

    if (adjRows.length === 0) {
      throw new Error("Adjustment voucher not found.");
    }

    if (adjRows[0].status === "completed") {
      throw new Error("Completed stock adjustments cannot be deleted to preserve audit trails.");
    }

    await conn.query(`DELETE FROM inventory_stock_adjustments WHERE id = ? AND tenant_id = ?`, [adjustmentId, tenantId]);
    return { success: true };
  } finally {
    conn.release();
  }
};
