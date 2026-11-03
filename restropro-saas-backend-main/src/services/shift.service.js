const { getMySqlPromiseConnection } = require("../config/mysql.db");

/**
 * Get all shifts for a tenant
 */
exports.getShiftsDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      SELECT 
        s.id,
        s.tenant_id,
        s.name,
        TIME_FORMAT(s.start_time, '%H:%i') AS start_time,
        TIME_FORMAT(s.end_time, '%H:%i') AS end_time,
        s.is_overnight,
        s.color,
        s.is_active,
        s.created_at,
        s.updated_at,
        (SELECT COUNT(*) FROM staff_rosters sr WHERE sr.shift_id = s.id AND sr.tenant_id = s.tenant_id) AS assignment_count
      FROM shifts s
      WHERE s.tenant_id = ?
      ORDER BY s.start_time ASC, s.id ASC;
    `;
    const [rows] = await conn.query(sql, [tenantId]);
    return rows;
  } catch (error) {
    console.error("Error in getShiftsDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Add a new shift template
 */
exports.addShiftDB = async (tenantId, { name, start_time, end_time, is_overnight, color, is_active }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      INSERT INTO shifts 
      (tenant_id, name, start_time, end_time, is_overnight, color, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `;
    const [result] = await conn.query(sql, [
      tenantId,
      name,
      start_time,
      end_time,
      is_overnight ? 1 : 0,
      color || "#3B82F6",
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
    ]);
    return result.insertId;
  } catch (error) {
    console.error("Error in addShiftDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Update an existing shift template
 */
exports.updateShiftDB = async (tenantId, id, { name, start_time, end_time, is_overnight, color, is_active }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      UPDATE shifts 
      SET 
        name = ?,
        start_time = ?,
        end_time = ?,
        is_overnight = ?,
        color = ?,
        is_active = ?
      WHERE id = ? AND tenant_id = ?;
    `;
    await conn.query(sql, [
      name,
      start_time,
      end_time,
      is_overnight ? 1 : 0,
      color || "#3B82F6",
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      id,
      tenantId,
    ]);
    return true;
  } catch (error) {
    console.error("Error in updateShiftDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Delete a shift template (if not currently in active roster)
 */
exports.deleteShiftDB = async (tenantId, id) => {
  const conn = await getMySqlPromiseConnection();
  try {
    // Check if assigned in future or existing rosters
    const [existing] = await conn.query(
      `SELECT COUNT(*) AS count FROM staff_rosters WHERE shift_id = ? AND tenant_id = ? AND roster_date >= CURDATE()`,
      [id, tenantId]
    );
    if (existing[0]?.count > 0) {
      throw new Error("Cannot delete shift with active or future roster assignments. Deactivate it instead.");
    }

    const sql = `DELETE FROM shifts WHERE id = ? AND tenant_id = ?;`;
    await conn.query(sql, [id, tenantId]);
    return true;
  } catch (error) {
    console.error("Error in deleteShiftDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Get tenant shift settings
 */
exports.getShiftSettingsDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      SELECT 
        tenant_id,
        shift_grace_before_mins,
        shift_grace_after_mins,
        is_shift_enforcement_enabled,
        weekly_hours_limit
      FROM shift_settings
      WHERE tenant_id = ?
      LIMIT 1;
    `;
    const [rows] = await conn.query(sql, [tenantId]);
    if (rows.length > 0) {
      return rows[0];
    }
    // Return defaults if not initialized
    return {
      tenant_id: tenantId,
      shift_grace_before_mins: 15,
      shift_grace_after_mins: 30,
      is_shift_enforcement_enabled: 1,
      weekly_hours_limit: 48,
    };
  } catch (error) {
    console.error("Error in getShiftSettingsDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Update tenant shift settings
 */
exports.updateShiftSettingsDB = async (tenantId, { shift_grace_before_mins, shift_grace_after_mins, is_shift_enforcement_enabled, weekly_hours_limit }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      INSERT INTO shift_settings 
      (tenant_id, shift_grace_before_mins, shift_grace_after_mins, is_shift_enforcement_enabled, weekly_hours_limit)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        shift_grace_before_mins = VALUES(shift_grace_before_mins),
        shift_grace_after_mins = VALUES(shift_grace_after_mins),
        is_shift_enforcement_enabled = VALUES(is_shift_enforcement_enabled),
        weekly_hours_limit = VALUES(weekly_hours_limit);
    `;
    await conn.query(sql, [
      tenantId,
      Number.isFinite(Number(shift_grace_before_mins)) ? Number(shift_grace_before_mins) : 15,
      Number.isFinite(Number(shift_grace_after_mins)) ? Number(shift_grace_after_mins) : 30,
      is_shift_enforcement_enabled !== undefined ? (is_shift_enforcement_enabled ? 1 : 0) : 1,
      Math.min(Math.max(Number(weekly_hours_limit) || 48, 1), 168),
    ]);
    return true;
  } catch (error) {
    console.error("Error in updateShiftSettingsDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};
