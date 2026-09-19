const { getMySqlPromiseConnection } = require("../config/mysql.db");

/**
 * Get all kitchen stations for a tenant with printer info and assigned item/category counts.
 */
exports.getKitchenStationsDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      SELECT 
        ks.id, 
        ks.tenant_id, 
        ks.name, 
        ks.color, 
        ks.icon, 
        ks.printer_id, 
        ks.is_enabled, 
        ks.sort_order, 
        ks.created_at, 
        ks.updated_at,
        p.name AS printer_name,
        p.transport AS printer_transport,
        p.address AS printer_address,
        (SELECT COUNT(*) FROM categories c WHERE c.kitchen_station_id = ks.id AND c.tenant_id = ks.tenant_id) AS category_count,
        (SELECT COUNT(*) FROM menu_items m WHERE m.kitchen_station_id = ks.id AND m.tenant_id = ks.tenant_id) AS item_count
      FROM kitchen_stations ks
      LEFT JOIN printer_configs p ON ks.printer_id = p.id AND p.tenant_id = ks.tenant_id
      WHERE ks.tenant_id = ?
      ORDER BY ks.sort_order ASC, ks.id ASC;
    `;
    const [rows] = await conn.query(sql, [tenantId]);
    return rows;
  } catch (error) {
    console.error("Error in getKitchenStationsDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Add a new kitchen station.
 */
exports.addKitchenStationDB = async (tenantId, { name, color, icon, printer_id, is_enabled, sort_order }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      INSERT INTO kitchen_stations
      (tenant_id, name, color, icon, printer_id, is_enabled, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `;
    const [result] = await conn.query(sql, [
      tenantId,
      name,
      color || '#f97316',
      icon || 'Flame',
      printer_id ? Number(printer_id) : null,
      is_enabled !== undefined ? (is_enabled ? 1 : 0) : 1,
      sort_order !== undefined ? Number(sort_order) : 0,
    ]);
    return result.insertId;
  } catch (error) {
    console.error("Error in addKitchenStationDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Update an existing kitchen station.
 */
exports.updateKitchenStationDB = async (tenantId, id, { name, color, icon, printer_id, is_enabled, sort_order }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const fields = [];
    const values = [];

    if (name !== undefined) {
      fields.push("name = ?");
      values.push(name);
    }
    if (color !== undefined) {
      fields.push("color = ?");
      values.push(color);
    }
    if (icon !== undefined) {
      fields.push("icon = ?");
      values.push(icon);
    }
    if (printer_id !== undefined) {
      fields.push("printer_id = ?");
      values.push(printer_id ? Number(printer_id) : null);
    }
    if (is_enabled !== undefined) {
      fields.push("is_enabled = ?");
      values.push(is_enabled ? 1 : 0);
    }
    if (sort_order !== undefined) {
      fields.push("sort_order = ?");
      values.push(Number(sort_order));
    }

    if (fields.length === 0) return;

    values.push(id, tenantId);
    const sql = `UPDATE kitchen_stations SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?;`;
    await conn.query(sql, values);
  } catch (error) {
    console.error("Error in updateKitchenStationDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Delete a kitchen station.
 * Unbinds references in categories and menu_items first to preserve data integrity.
 */
exports.deleteKitchenStationDB = async (tenantId, id) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    // 1. Reset categories mapped to this station
    await conn.query(
      `UPDATE categories SET kitchen_station_id = NULL WHERE kitchen_station_id = ? AND tenant_id = ?`,
      [id, tenantId]
    );

    // 2. Reset menu items mapped to this station
    await conn.query(
      `UPDATE menu_items SET kitchen_station_id = NULL WHERE kitchen_station_id = ? AND tenant_id = ?`,
      [id, tenantId]
    );

    // 3. Delete the station
    await conn.query(`DELETE FROM kitchen_stations WHERE id = ? AND tenant_id = ?`, [id, tenantId]);

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    console.error("Error in deleteKitchenStationDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};
