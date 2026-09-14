const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { queueLowStockAlerts } = require("./notification.service");
const { tenantFilter } = require("../utils/tenant_scope");

const VENDOR_SORT_COLUMNS = {
    created_at: "created_at",
    name: "name",
    phone: "phone",
    city: "city",
    country: "country",
};

/**
 * Reconcile the low-stock alert ledger for the given items and return the ones
 * that *just* crossed below their threshold.
 *
 * Takes the caller's connection so the reconciliation runs inside the same
 * transaction as the stock change that caused it: if the stock update rolls
 * back, so does the alert, and the row lock on inventory_items serialises
 * concurrent updates to the same item (two simultaneous deductions cannot both
 * report the crossing).
 *
 * "Already alerted" is a row in inventory_low_stock_alerts, deleted the moment
 * the item is replenished above its threshold — that is what stops repeat
 * pushes for an item that simply stays low, while still allowing a fresh alert
 * after a restock/re-dip cycle.
 *
 * Callers must send the returned items *after* committing (see
 * notification.service `queueLowStockAlerts`).
 *
 * May throw; callers go through the best-effort `syncLowStockAlerts` wrapper
 * below rather than calling this directly.
 */
const reconcileLowStockAlerts = async (conn, tenantId, itemIds) => {
  const ids = [...new Set((itemIds || []).map(Number).filter(Boolean))];
  if (ids.length === 0) return [];

  const [items] = await conn.query(
    `SELECT id, title, quantity, unit, min_quantity_threshold
     FROM inventory_items
     WHERE tenant_id = ? AND id IN (?)`,
    [tenantId, ids]
  );

  const newlyLow = [];
  const replenished = [];

  for (const item of items) {
    const quantity = parseFloat(item.quantity);
    const threshold = parseFloat(item.min_quantity_threshold);

    // Covers both the 'low' and 'out' item statuses: out of stock is the most
    // severe form of low stock, not a separate condition.
    if (quantity <= threshold) {
      const [result] = await conn.query(
        `INSERT IGNORE INTO inventory_low_stock_alerts
         (tenant_id, inventory_item_id, quantity, min_quantity_threshold)
         VALUES (?, ?, ?, ?)`,
        [tenantId, item.id, quantity, threshold]
      );
      // affectedRows === 0 means an alert is already open -> stay quiet.
      if (result.affectedRows === 1) {
        newlyLow.push({
          id: item.id,
          title: item.title,
          quantity,
          unit: item.unit,
          min_quantity_threshold: threshold,
        });
      }
    } else {
      replenished.push(item.id);
    }
  }

  if (replenished.length > 0) {
    await conn.query(
      `DELETE FROM inventory_low_stock_alerts WHERE tenant_id = ? AND inventory_item_id IN (?)`,
      [tenantId, replenished]
    );
  }

  return newlyLow;
};

/**
 * InnoDB rolls the *whole* transaction back on a deadlock, so by the time this
 * error surfaces the caller's stock change is already gone. Swallowing it would
 * let the caller go on to commit an empty transaction and report success — a
 * silently lost order. Everything else (a missing alert table, a bad row, a
 * lock-wait timeout, which under the default innodb_rollback_on_timeout=OFF
 * discards only the failed statement) leaves the caller's transaction intact
 * and is safe to ignore.
 */
const isTransactionFatal = (error) =>
  error?.code === "ER_LOCK_DEADLOCK" || error?.errno === 1213;

/**
 * Best-effort wrapper around `reconcileLowStockAlerts`.
 *
 * Alerting is a side effect of a stock change, never a precondition for it:
 * an unusable alert ledger must not be able to reject an order, an inventory
 * edit or a purchase order. On failure the caller simply gets no items to
 * notify about, and the affected items re-reconcile on their next stock
 * movement.
 *
 * This is the only entry point callers use, so the guarantee holds for future
 * call sites too rather than depending on each one remembering to catch.
 */
const syncLowStockAlerts = async (conn, tenantId, itemIds) => {
  try {
    return await reconcileLowStockAlerts(conn, tenantId, itemIds);
  } catch (error) {
    if (isTransactionFatal(error)) throw error;
    console.error(`[low-stock] alert sync failed for tenant=${tenantId} (ignored):`, error);
    return [];
  }
};
exports.syncLowStockAlertsDB = syncLowStockAlerts;

/** Inventory items with an alert currently open (Owner App low-stock screen / digests). */
exports.getOpenLowStockAlertsDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT ii.id, ii.title, ii.quantity, ii.unit, ii.min_quantity_threshold, a.notified_at
       FROM inventory_low_stock_alerts a
         JOIN inventory_items ii ON ii.id = a.inventory_item_id AND ii.tenant_id = a.tenant_id
       WHERE a.tenant_id = ?
       ORDER BY ii.title ASC`,
      [tenantId]
    );
    return rows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

const getVendorSortClause = (sort) => {
    if (!sort) {
        return "ORDER BY created_at DESC";
    }

    const sortValue = String(sort).trim();
    const direction = sortValue.startsWith("-") ? "DESC" : "ASC";
    const columnKey = sortValue.replace(/^-/, "");
    const column = VENDOR_SORT_COLUMNS[columnKey];

    if (!column) {
        return "ORDER BY created_at DESC";
    }

    return `ORDER BY ${column} ${direction}`;
};

exports.addInventoryItemDB = async (
  title,
  quantity,
  unit,
  minQuantityThreshold,
  tenantId,
  username
) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    let status = 'out';
    if (quantity > 0 && quantity <= minQuantityThreshold) {
      status = 'low';
    } else if (quantity > minQuantityThreshold) {
      status = 'in';
    }

    const sql = `
      INSERT INTO inventory_items
      (title, quantity, unit, min_quantity_threshold, status, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await conn.query(sql, [
      title,
      quantity,
      unit,
      minQuantityThreshold,
      status,
      tenantId,
    ]);

    const inventoryItemId = result.insertId;

    await conn.query(
      `INSERT INTO inventory_logs
      (tenant_id, inventory_item_id, type, quantity_change, previous_quantity, new_quantity, note, created_by)
      VALUES (?, ?, 'IN', ?, 0, ?, 'Initial stock', ?)`,
      [tenantId, inventoryItemId, quantity, quantity, username]
    );

    // An item can be created already at/below its threshold; seeding the alert
    // ledger here both notifies the owner and stops a later stock movement
    // reporting the same state as if it had just crossed.
    const newlyLow = await syncLowStockAlerts(conn, tenantId, [inventoryItemId]);

    await conn.commit();

    queueLowStockAlerts(tenantId, newlyLow);

    return result.insertId;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Enterprise inventory summary (READ-ONLY).
 *
 * NOTE ON "INVENTORY VALUE": `inventory_items` stores quantity, unit and a
 * reorder threshold — there is NO unit cost or price column anywhere in the
 * inventory schema (verified against the live database: inventory_items,
 * inventory_logs, inventory_low_stock_alerts). A monetary valuation therefore
 * cannot be computed, and this returns stock QUANTITY figures instead of
 * inventing one. Adding a `unit_cost` column would make valuation possible.
 */
exports.getInventorySummaryDB = async (scope) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const { sql: tenantSql, params } = tenantFilter(scope);

    const [rows] = await conn.query(`
      SELECT
        COUNT(*) AS total_items,
        COUNT(CASE WHEN status = 'low' THEN 1 END) AS low_stock,
        COUNT(CASE WHEN status = 'out' THEN 1 END) AS out_of_stock,
        COUNT(CASE WHEN status = 'in' THEN 1 END) AS in_stock,
        COUNT(CASE WHEN quantity <= min_quantity_threshold THEN 1 END) AS at_or_below_threshold
      FROM inventory_items
      WHERE ${tenantSql}
    `, params);

    return rows[0];
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Per-business inventory breakdown — one `GROUP BY tenant_id`, never a loop.
 * Quantity is reported per unit family because summing 'kg' with 'pc' would be
 * meaningless; the caller renders counts, and quantity only within a unit.
 */
exports.getInventoryByBusinessDB = async (scope) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const { sql: tenantSql, params } = tenantFilter(scope);

    const [rows] = await conn.query(`
      SELECT
        tenant_id,
        COUNT(*) AS total_items,
        COUNT(CASE WHEN status = 'low' THEN 1 END) AS low_stock,
        COUNT(CASE WHEN status = 'out' THEN 1 END) AS out_of_stock,
        COUNT(CASE WHEN status = 'in' THEN 1 END) AS in_stock
      FROM inventory_items
      WHERE ${tenantSql}
      GROUP BY tenant_id
      ORDER BY total_items DESC
    `, params);

    return rows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Items currently at or below their reorder threshold, richest signal first
 * (out of stock before low). Carries the owning business so the consolidated
 * alert list can label each row.
 */
exports.getInventoryAlertsByBusinessDB = async (scope, limit = 20) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const { sql: tenantSql, params } = tenantFilter(scope);

    const [rows] = await conn.query(`
      SELECT
        id, title, quantity, unit, min_quantity_threshold, status,
        tenant_id AS business_tenant_id
      FROM inventory_items
      WHERE ${tenantSql} AND quantity <= min_quantity_threshold
      ORDER BY
        CASE status WHEN 'out' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
        quantity ASC
      LIMIT ?
    `, [...params, Number(limit) || 20]);

    return rows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Most-consumed items across the scope, from the stock-movement ledger.
 * Grouped by TITLE, because the same ingredient is a different
 * `inventory_items` row in each business.
 */
exports.getTopConsumedItemsDB = async (scope, limit = 10) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const { sql: tenantSql, params } = tenantFilter(scope, "il");

    const [rows] = await conn.query(`
      SELECT
        ii.title,
        ii.unit,
        COUNT(DISTINCT il.tenant_id) AS business_count,
        COALESCE(SUM(il.quantity_change), 0) AS consumed
      FROM inventory_logs il
        JOIN inventory_items ii ON ii.id = il.inventory_item_id AND ii.tenant_id = il.tenant_id
      WHERE ${tenantSql} AND il.type IN ('OUT', 'WASTAGE')
      GROUP BY ii.title, ii.unit
      ORDER BY consumed DESC
      LIMIT ?
    `, [...params, Number(limit) || 10]);

    return rows;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.getInventoryItemsDB = async (status, scope) => {
  const conn = await getMySqlPromiseConnection();
  try {
    let sql = '';
    const { sql: tenantSql, params: tenantParams } = tenantFilter(scope);

    let countsSql = `
      SELECT
        status,
        COUNT(*) AS count
      FROM inventory_items
      WHERE ${tenantSql}
      GROUP BY status
    `;

    const [statusCounts] = await conn.query(countsSql, tenantParams);

    const statusCountMap = {
      in: 0,
      low: 0,
      out: 0,
    };

    statusCounts.forEach(({ status, count }) => {
      if (statusCountMap[status] !== undefined) {
        statusCountMap[status] = count;
      }
    });

    if(status != 'all'){
      sql = `
      SELECT
        id,
        title,
        quantity,
        unit,
        min_quantity_threshold,
        status,
        tenant_id,
        created_at,
        updated_at
      FROM inventory_items
      WHERE ${tenantSql} AND status = ?
      ORDER BY id DESC
    `;
      const [rows] = await conn.query(sql, [...tenantParams, status]);
      return {items: rows, statusCounts: statusCountMap};
    }else{
      sql = `
      SELECT
        id,
        title,
        quantity,
        unit,
        min_quantity_threshold,
        status,
        tenant_id,
        created_at,
        updated_at
      FROM inventory_items
      WHERE ${tenantSql}
      ORDER BY id DESC
    `;
      const [rows] = await conn.query(sql, tenantParams);
      return { items: rows, statusCounts: statusCountMap };
    }

  } catch (error) {
    throw error;
  } finally {
    conn.release();
  }
};

exports.updateInventoryItemDB = async (
  itemId,
  title,
  unit,
  minQuantityThreshold,
  tenantId
) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT quantity FROM inventory_items WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [itemId, tenantId]
    );

    if (rows.length === 0) {
      return;
    }

    const quantity = parseFloat(rows[0].quantity);
    let status = 'out';
    if (quantity > 0 && quantity <= minQuantityThreshold) {
      status = 'low';
    } else if (quantity > minQuantityThreshold) {
      status = 'in';
    }

    const sql = `
      UPDATE inventory_items
      SET title = ?, unit = ?, min_quantity_threshold = ?, status = ?
      WHERE id = ? AND tenant_id = ?
    `;
    await conn.query(sql, [
      title,
      unit,
      minQuantityThreshold,
      status,
      itemId,
      tenantId,
    ]);

    // Raising the threshold can make an untouched item low (and lowering it can
    // clear the alert), so the ledger is reconciled on threshold edits too.
    queueLowStockAlerts(tenantId, await syncLowStockAlerts(conn, tenantId, [itemId]));
  } catch (error) {
    throw error;
  } finally {
    conn.release();
  }
};

exports.addInventoryItemStockMovementDB = async (req, itemId, movementType, quantity, note, tenantId, username) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    // Step 1: Get current quantity
    const [rows] = await conn.query(
      `SELECT quantity, min_quantity_threshold FROM inventory_items WHERE id = ? AND tenant_id = ? FOR UPDATE`,
      [itemId, tenantId]
    );
    if (rows.length === 0) throw new Error(req.__('inventory_item_not_found_message'));

    const previousQuantity = parseFloat(rows[0].quantity);
    const minQuantityThreshold = parseFloat(rows[0].min_quantity_threshold);

    // Determine quantity delta based on movement type
    let deltaQuantity;
    switch (movementType) {
      case 'IN':
        deltaQuantity = parseFloat(quantity);
        break;
      case 'OUT':
      case 'WASTAGE':
        deltaQuantity = -1 * parseFloat(quantity);
        break;
      default:
        throw new Error(req.__('invalid_movement_type_message'));
    }

    const newQuantity = previousQuantity + deltaQuantity;

    // Prevent negative inventory
    if (newQuantity < 0) throw new Error(req.__('insufficient_inventory_quantity_message'));

    // Determine new status
    let status = 'out';
    if (newQuantity > 0 && newQuantity <= minQuantityThreshold) {
      status = 'low';
    } else if (newQuantity > minQuantityThreshold) {
      status = 'in';
    }

    // Step 2: Update inventory quantity and status
    await conn.query(
      `UPDATE inventory_items SET quantity = ?, status = ? WHERE id = ? AND tenant_id = ?`,
      [newQuantity, status, itemId, tenantId]
    );

    // Step 3: Insert inventory log with correct type
    await conn.query(
      `INSERT INTO inventory_logs (tenant_id, inventory_item_id, type, quantity_change, previous_quantity, new_quantity, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, itemId, movementType, Math.abs(deltaQuantity), previousQuantity, newQuantity, note, username]
    );

    // Manual adjustment (IN / OUT / WASTAGE): detect the crossing inside the
    // transaction, push only once it is durable.
    const newlyLow = await syncLowStockAlerts(conn, tenantId, [itemId]);

    await conn.commit();

    queueLowStockAlerts(tenantId, newlyLow);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};


exports.deleteInventoryItemDB = async (itemId, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `DELETE FROM inventory_items WHERE id = ? AND tenant_id = ?`;
    await conn.query(sql, [itemId, tenantId]);
  } catch (error) {
    throw error;
  } finally {
    conn.release();
  }
};

exports.getInventoryLogsDB = async (movementType, type, from, to, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const {filter, params} = getFilterCondition('l.created_at', type, from, to);
    const queryParams = [tenantId, ...params];
    const movementTypeFilter = movementType && movementType != 'all' ? 'AND l.type = ?' : '';

    if (movementTypeFilter) {
      queryParams.push(movementType);
    }

    const sql = `
        SELECT
          l.id,
          l.inventory_item_id,
          i.title,
          i.unit,
          l.type,
          l.quantity_change as quantity,
          l.note,
          l.created_by,
          l.created_at
        FROM inventory_logs l
        JOIN inventory_items i ON i.id = l.inventory_item_id
        WHERE l.tenant_id = ? AND ${filter} ${movementTypeFilter}
        ORDER BY l.created_at DESC
      `;
    const [rows] = await conn.query(sql, queryParams);
    return rows;

  } catch (error) {
    throw error;
  } finally {
    conn.release();
  }
};

exports.getCummulativeInventoryMovementsDB = async (type, from, to, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const { filter, params } = getFilterCondition('l.created_at', type, from, to);

    const sql = `
      SELECT
        l.inventory_item_id,
        i.title,
        i.unit,
        SUM(CASE WHEN l.type = 'in' THEN l.quantity_change ELSE 0 END) AS total_in,
        SUM(CASE WHEN l.type = 'out' THEN l.quantity_change ELSE 0 END) AS total_out,
        SUM(CASE WHEN l.type = 'wastage' THEN l.quantity_change ELSE 0 END) AS total_wastage,
        COUNT(*) AS movement_count
      FROM inventory_logs l
      JOIN inventory_items i ON i.id = l.inventory_item_id
      WHERE l.tenant_id = ? AND ${filter}
      GROUP BY l.inventory_item_id
      ORDER BY (total_in + total_out + total_wastage) DESC
    `;

    const [rows] = await conn.query(sql, [tenantId, ...params]);
    return rows;
  } catch (error) {
    throw error;
  } finally {
    conn.release();
  }
};

exports.getInventoryUsageVsCurrentStockDB = async (type, from, to, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const { filter, params } = getFilterCondition('l.created_at', type, from, to);

    const sql = `
      SELECT
        i.id AS inventory_item_id,
        i.title,
        i.quantity AS current_stock,
        i.min_quantity_threshold,
        i.unit,
        i.status,
        SUM(CASE WHEN l.type = 'out' THEN l.quantity_change ELSE 0 END) AS total_usage
      FROM inventory_items i
      LEFT JOIN inventory_logs l
        ON l.inventory_item_id = i.id AND l.tenant_id = i.tenant_id AND ${filter}
      WHERE i.tenant_id = ?
      GROUP BY i.id
      ORDER BY total_usage DESC
    `;

    const [rows] = await conn.query(sql, [...params, tenantId]);
    return rows;
  } catch (error) {
    throw error;
  } finally {
    conn.release();
  }
};

const getFilterCondition = (field, type, from, to) => {
  const params = [];
  let filter = '';

  switch (type) {
      case 'custom': {
          params.push(from, to);
          filter = `DATE(${field}) >= ? AND DATE(${field}) <= ?`;
          break;
      }
      case 'today': {
          filter = `DATE(${field}) = CURDATE()`;
          break;
      }
      case 'this_month': {
          filter = `YEAR(${field}) = YEAR(NOW()) AND MONTH(${field}) = MONTH(NOW())`;
          break;
      }
      case 'last_month': {
          // filter = `DATE(${field}) >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND DATE(${field}) <= CURDATE()`;
          filter = `MONTH(${field}) = MONTH(DATE_ADD(NOW(), INTERVAL -1 MONTH)) AND YEAR(${field}) = YEAR(DATE_ADD(NOW(), INTERVAL -1 MONTH))`;
          break;
      }
      case 'last_7days': {
          filter = `DATE(${field}) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND DATE(${field}) <= CURDATE()`;
          break;
      }
      case 'yesterday': {
          filter = `DATE(${field}) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`;
          break;
      }
      case 'tomorrow': {
          filter = `DATE(${field}) = DATE_ADD(CURDATE(), INTERVAL 1 DAY)`;
          break;
      }
      default: {
          filter = '1 = 1';
      }
  }

  return { params, filter };
}

/* inventory_vendors */
exports.addVendorDB = async (phone, name, contactPerson, addressLine1, addressLine2, city, state, country, zipcode, taxIdNo, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        INSERT INTO inventory_vendors
        (phone, name, contact_person, address_line1, address_line2, city, state, country, zipcode, tax_id_no, tenant_id)
        VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;

        const [result] = await conn.query(sql, [phone, name, contactPerson, addressLine1, addressLine2, city, state, country, zipcode, taxIdNo, tenantId]);

        return result.insertId;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getVendorsDB = async(page, perPage, sort, filter, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        // Validate and sanitize inputs
        const currentPage = Math.max(parseInt(page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(perPage, 10) || 10, 1), 100);
        const offset = (currentPage - 1) * limit;
        const sortedBy = getVendorSortClause(sort);

        const filterQuery = filter ? `WHERE (name LIKE ? OR phone = ?) AND tenant_id = ?` : `WHERE tenant_id = ?`;
        const filterParams = filter ? [`${filter}%`, filter, tenantId] : [tenantId];

        const [vendors] = await conn.query(
            `SELECT id, phone, name, contact_person, address_line1, address_line2, city, state, country, zipcode, tax_id_no, created_at FROM inventory_vendors ${filterQuery} ${sortedBy} LIMIT ? OFFSET ? ;`,
            [...filterParams, limit, offset]
        );

        // Prepared statement for total customer count
        const [totalVendors] = await conn.query(
            `SELECT COUNT(*) AS total FROM inventory_vendors ${filterQuery} ;`,
            filterParams
        );

        // Prepare response data
        const response = {
            vendors,
            currentPage,
            perPage: limit,
            totalPages: Math.ceil(totalVendors[0].total / limit),
            totalVendors: totalVendors[0].total
        };



        return response;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
}

exports.getAllVendorsDB = async(tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const sql = `
        SELECT id, phone, name, contact_person, address_line1, address_line2, city, state, country, zipcode, tax_id_no, created_at FROM inventory_vendors
        WHERE
            tenant_id = ?
        ORDER BY
            created_at DESC
        `
        const [result] = await conn.query(sql, [tenantId]);

        return result;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
}
exports.getVendorDB = async(id, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {

      const [result] = await conn.query(
          `SELECT id, phone, name, contact_person, address_line1, address_line2, city, state, country, zipcode, tax_id_no, created_at FROM inventory_vendors
          WHERE id = ? AND tenant_id = ?
          LIMIT 1;`,
          [id, tenantId]
      );

      return result[0];
  } catch (error) {
      console.error(error);
      throw error;
  } finally {
      conn.release();
  }
}

exports.searchVendorDB = async(searchString, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {

      const [result] = await conn.query(
          `
          SELECT id, phone, name, contact_person, address_line1, address_line2, city, state, country, zipcode, tax_id_no, created_at FROM inventory_vendors
          WHERE (phone LIKE ? OR name LIKE ?) AND tenant_id = ?
          LIMIT 10
          ;`,
          [`${searchString}%`, `%${searchString}%`, tenantId]
      );

      return result;
  } catch (error) {
      console.error(error);
      throw error;
  } finally {
      conn.release();
  }
}

exports.updateVendorDB = async (id, phone, name, contactPerson, addressLine1, addressLine2, city, state, country, zipcode, taxIdNo, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {

      const sql = `
      UPDATE inventory_vendors
      SET
      name = ?, phone = ?, contact_person = ?, address_line1 = ?,
      address_line2 = ?, city = ?, state = ?, country = ?, zipcode = ?, tax_id_no = ?, updated_at = NOW()
      WHERE id = ? AND tenant_id = ?
      `;

      await conn.query(sql, [name, phone, contactPerson, addressLine1, addressLine2, city, state, country, zipcode, taxIdNo, id, tenantId]);
      return;
  } catch (error) {
      console.error(error);
      throw error;
  } finally {
      conn.release();
  }
};

exports.deleteVendorDB = async (id, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {

      const sql = `
      DELETE FROM inventory_vendors
      WHERE id = ? AND tenant_id = ?;
      `;

      await conn.query(sql, [id, tenantId]);

      return;
  } catch (error) {
      console.error(error);
      throw error;
  } finally {
      conn.release();
  }
};
/* inventory_vendors */

/* Purchase Orders */
exports.addItemToPurchaseOrdersDraftsDB = async (inventoryItemId, tenantId, quantity) => {
  const conn = await getMySqlPromiseConnection();
  try {

      const sql = `
      INSERT INTO inventory_purchase_orders_drafts
      (item_id, quantity, tenant_id, created_at)
      VALUES
      (?, ?, ?, NOW());
      `;

      const [result] = await conn.query(sql, [inventoryItemId, quantity, tenantId]);

      return result.insertId;
  } catch (error) {
      console.error(error);
      throw error;
  } finally {
      conn.release();
  }
};
exports.addBulkItemsToPurchaseOrdersDraftsDB = async (items) => {
  const conn = await getMySqlPromiseConnection();
  try {

      const sql = `
      INSERT INTO inventory_purchase_orders_drafts
      (item_id, quantity, tenant_id)
      VALUES
      ?
      `;

      const [result] = await conn.query(sql, [items]);

      return;
  } catch (error) {
      console.error(error);
      throw error;
  } finally {
      conn.release();
  }
};
exports.getPurchaseOrderDraftsDB = async(tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {

      const [result] = await conn.query(
        `
        SELECT
        inv_pod.id, item_id,
        inv_pod.quantity, inv_pod.created_at,
        inv_items.title,
        inv_items.unit
        FROM inventory_purchase_orders_drafts inv_pod
        LEFT JOIN inventory_items inv_items ON inv_pod.item_id = inv_items.id
        WHERE inv_pod.tenant_id = ?
        `,
        [tenantId]
      );

      return result;
  } catch (error) {
      console.error(error);
      throw error;
  } finally {
      conn.release();
  }
}
exports.updatePurchaseOrderDraftItemQuantityDB = async (id, quantity, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {

      const sql = `
      UPDATE inventory_purchase_orders_drafts
      SET
      quantity = ?, updated_at = NOW()
      WHERE id = ? AND tenant_id = ?
      `;

      await conn.query(sql, [quantity, id, tenantId]);
      return;
  } catch (error) {
      console.error(error);
      throw error;
  } finally {
      conn.release();
  }
};
exports.deletePurchaseOrderDraftItemDB = async (id, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {

      const sql = `
      DELETE FROM inventory_purchase_orders_drafts
      WHERE id = ? AND tenant_id = ?
      `;

      await conn.query(sql, [id, tenantId]);
      return;
  } catch (error) {
      console.error(error);
      throw error;
  } finally {
      conn.release();
  }
};

exports.createPurchaseOrderDB = async (vendorId, vendorName, contactPerson, taxIdNo, address, notes, items, userId, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction()

    // get PO sequence
    let purchaseOrderId = 0;

    const [orderIdRes] = await conn.query(`SELECT current_value FROM sequences WHERE tenant_id = ? AND table_name='inventory_purchase_orders' LIMIT 1 FOR UPDATE`, [tenantId])
    if(orderIdRes.length > 0) {
      purchaseOrderId = Number(orderIdRes[0]?.current_value || 0)
    }

    purchaseOrderId += 1

    // insert into po
    await conn.query(`
      INSERT INTO inventory_purchase_orders (id, tenant_id, created_at, vendor_id, vendor_name, contact_person, tax_id_no, address, created_by, notes, status) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)
    `, [purchaseOrderId, tenantId, vendorId, vendorName, contactPerson, taxIdNo, address, userId, notes, 'ordered'])

    const itemsParams = items.map((item)=>[purchaseOrderId, tenantId, item.item_id, item.title, item.unit, item.quantity])

    // insert into po items
    await conn.query(`
      INSERT INTO inventory_purchase_order_items (purchase_order_id, tenant_id, inventory_item_id, inventory_item_name, inventory_item_unit, quantity) VALUES ?
    `, [itemsParams])

    // delete from drafts
    const draftIds = items.map((item) => item.id).filter(Boolean);
    if (draftIds.length > 0) {
      await conn.query(`DELETE FROM inventory_purchase_orders_drafts WHERE id IN (?) AND tenant_id = ?`, [draftIds, tenantId]);
    }

    // update sequence
    await conn.query(
      `INSERT INTO sequences
      (tenant_id, table_name, current_value)
      VALUES (?, 'inventory_purchase_orders', ?)
      ON DUPLICATE KEY UPDATE
      current_value = VALUES(current_value)
      `
      , [tenantId, purchaseOrderId]);

    await conn.commit();
    return;
  } catch (error) {
    await conn.rollback();
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.updatePurchaseOrderToCompleteDB = async (
  id,
  fullfilledDate,
  userId,
  tenantId
) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const sql = `
      UPDATE inventory_purchase_orders
      SET
      status = 'completed', fullfilled_at = ?
      WHERE id = ? AND tenant_id = ?
      `;

    await conn.query(sql, [fullfilledDate, id, tenantId]);

    // Add to inventory
    const [purchaseOrderItems] = await conn.query(
      `
        SELECT inventory_item_id, quantity FROM inventory_purchase_order_items
        WHERE purchase_order_id = ? AND tenant_id = ?
      `,
      [id, tenantId]
    );

    const inventoryItemIds = purchaseOrderItems
      .map((item) => item.inventory_item_id)
      .filter(Boolean);

    const [inventoryItems] = inventoryItemIds.length > 0
      ? await conn.query(
          `
            SELECT id, quantity FROM inventory_items
            WHERE id IN (?) AND tenant_id = ?
            FOR UPDATE
          `,
          [inventoryItemIds, tenantId]
        )
      : [[]];

    const inventoryUpdates = [];
    const inventoryLogs = [];

    purchaseOrderItems.forEach((poItem) => {
      const inventoryItem = inventoryItems.find(
        (item) => item.id === poItem.inventory_item_id
      );
      if (inventoryItem) {
        const previousQuantity = parseFloat(inventoryItem.quantity);
        const newQuantity = previousQuantity + parseFloat(poItem.quantity);

        // Prepare inventory update
        inventoryUpdates.push([newQuantity, inventoryItem.id, tenantId]);

        // Prepare inventory log
        inventoryLogs.push([
          tenantId,
          inventoryItem.id,
          "IN",
          poItem.quantity,
          previousQuantity,
          newQuantity,
          `Purchase Order #${id} fulfilled`,
          userId,
          new Date(),
        ]);
      }
    });

    // Update inventory quantities
    for (const [newQuantity, itemId, tenantId] of inventoryUpdates) {
      await conn.query(
        `
          UPDATE inventory_items
          SET quantity = ?
          WHERE id = ? AND tenant_id = ?
        `,
        [newQuantity, itemId, tenantId]
      );
    }

    // Add to inventory logs
    if (inventoryLogs.length > 0) {
      await conn.query(
        `
          INSERT INTO inventory_logs
          (tenant_id, inventory_item_id, type, quantity_change, previous_quantity, new_quantity, note, created_by, created_at)
          VALUES ?
        `,
        [inventoryLogs]
      );
    }

    // ENable Menu item again if disbaled and inventory items required for preparation are all available now
    const [disabledMenuItems] = await conn.query(
      `SELECT id FROM menu_items WHERE is_enabled = 0 AND tenant_id = ?`,
      [tenantId]
    );

    for (const menu of disabledMenuItems) {
      const menuItemId = menu.id;

      // Step 2: Get base recipe inventory requirements
      const [recipes] = await conn.query(
        `SELECT mir.inventory_item_id, mir.quantity, ii.quantity AS available_quantity
        FROM menu_item_recipes mir
        JOIN inventory_items ii ON mir.inventory_item_id = ii.id AND mir.tenant_id = ii.tenant_id
        WHERE mir.menu_item_id = ? AND mir.variant_id = 0 AND mir.addon_id = 0 AND mir.tenant_id = ?`,
        [menuItemId, tenantId]
      );

      // Step 3: Check if all required items are available
      const canEnable = recipes.length > 0 && recipes.every(r =>
        parseFloat(r.available_quantity) >= parseFloat(r.quantity)
      );

      // Step 4: Enable if all ingredients are sufficient
      if (canEnable) {
        await conn.query(
          `UPDATE menu_items SET is_enabled = 1 WHERE id = ? AND tenant_id = ?`,
          [menuItemId, tenantId]
        );
      }
    }

    // Fulfilling a PO is the main way stock comes back: reconciling here closes
    // the open alerts so the same items can alert again if they dip later.
    // (Items still short of their threshold keep their existing alert.)
    const newlyLow = await syncLowStockAlerts(conn, tenantId, inventoryItemIds);

    await conn.commit();

    queueLowStockAlerts(tenantId, newlyLow);
    return;
  } catch (error) {
    await conn.rollback();
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.getPurchaseOrdersDB = async (type, from, to, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const { filter, params } = getFilterCondition(
      `po.created_at`,
      type,
      from,
      to
    );

    const sql = `
        SELECT id, tenant_id, created_at, fullfilled_at, vendor_id, vendor_name, contact_person, tax_id_no, address, created_by, notes, status
        FROM rasoirasta.inventory_purchase_orders po
        WHERE ${filter} AND tenant_id = ?
        ORDER BY po.created_at DESC
        `;

    const [results] = await conn.query(sql, [...params, tenantId]);
    return results;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.getPurchaseOrderItemsDB = async (purchaseOrderIds, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      SELECT id, purchase_order_id, tenant_id, inventory_item_id, inventory_item_name, inventory_item_unit, quantity FROM inventory_purchase_order_items
      WHERE purchase_order_id IN (?) AND tenant_id = ?
    `;

    const [results] = await conn.query(sql, [purchaseOrderIds, tenantId]);
    return results;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/* Purchase Orders */
