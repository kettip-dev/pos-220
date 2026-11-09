/**
 * Migration: inventory costing (P&L Phase 1).
 *
 * Adds `inventory_items.unit_cost` — the current weighted-average cost of ONE
 * unit of the item, in the item's own unit (per kg, per pc, per ml...). It is
 * what turns recipe quantities into food cost.
 *
 * Idempotent: the column is only added when INFORMATION_SCHEMA says it is
 * missing. On that first run, items are seeded from the most recent received
 * purchase-order line that carried a cost, so existing tenants start with a
 * sensible figure instead of zero.
 */
exports.ensureInventoryCostingSchema = async (pool) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const [cols] = await conn.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'unit_cost'
    `);

    if (cols.length === 0) {
      await conn.query(
        `ALTER TABLE inventory_items ADD COLUMN unit_cost DECIMAL(14,4) NOT NULL DEFAULT 0.0000 AFTER min_quantity_threshold`
      );
      console.log("[Migration] Added column unit_cost to inventory_items");

      // One-time seed from the latest costed PO line per item (same tenant).
      await conn.query(`
        UPDATE inventory_items ii
        JOIN (
          SELECT poi.tenant_id, poi.inventory_item_id, poi.unit_cost
          FROM inventory_purchase_order_items poi
          JOIN inventory_purchase_orders po
            ON po.id = poi.purchase_order_id AND po.tenant_id = poi.tenant_id
          JOIN (
            SELECT poi2.tenant_id, poi2.inventory_item_id, MAX(poi2.id) AS last_id
            FROM inventory_purchase_order_items poi2
            JOIN inventory_purchase_orders po2
              ON po2.id = poi2.purchase_order_id AND po2.tenant_id = poi2.tenant_id
            WHERE po2.status = 'completed' AND poi2.unit_cost > 0 AND poi2.inventory_item_id IS NOT NULL
            GROUP BY poi2.tenant_id, poi2.inventory_item_id
          ) latest ON latest.last_id = poi.id
        ) src ON src.inventory_item_id = ii.id AND src.tenant_id = ii.tenant_id
        SET ii.unit_cost = src.unit_cost
        WHERE ii.unit_cost = 0
      `).catch((err) => {
        // PO tables may not exist yet on a brand-new database; costs can be set by hand.
        console.warn("[Migration] unit_cost seed from purchase orders skipped:", err.message);
      });
    }

    console.log("[Migration] Inventory costing schema verified/migrated successfully.");
  } catch (err) {
    console.error("[Migration] Error in ensureInventoryCostingSchema:", err.message);
  } finally {
    if (conn) conn.release();
  }
};
