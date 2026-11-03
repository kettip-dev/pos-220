const bcrypt = require("bcrypt");
const { getMySqlPromiseConnection } = require("../config/mysql.db");

/**
 * Record a clock-in for a staff member (called automatically on login or manually via override)
 */
exports.clockInDB = async (tenantId, username, rosterId = null, shiftId = null, managerOverrideBy = null, status = "on_time", notes = null) => {
  const conn = await getMySqlPromiseConnection();
  try {
    // Check if the user already has an open clock-in within the past 16 hours
    const [existing] = await conn.query(
      `
      SELECT id, clock_in_at 
      FROM staff_attendance 
      WHERE tenant_id = ? 
        AND username = ? 
        AND clock_out_at IS NULL 
        AND clock_in_at >= DATE_SUB(NOW(), INTERVAL 16 HOUR)
      ORDER BY clock_in_at DESC 
      LIMIT 1;
    `,
      [tenantId, username]
    );

    if (existing.length > 0) {
      // User is already clocked in
      return { id: existing[0].id, alreadyClockedIn: true };
    }

    const sql = `
      INSERT INTO staff_attendance 
      (tenant_id, username, roster_id, shift_id, clock_in_at, manager_override_by, status, notes)
      VALUES (?, ?, ?, ?, NOW(), ?, ?, ?);
    `;
    const [result] = await conn.query(sql, [
      tenantId,
      username,
      rosterId ? Number(rosterId) : null,
      shiftId ? Number(shiftId) : null,
      managerOverrideBy,
      status,
      notes,
    ]);

    return { id: result.insertId, alreadyClockedIn: false };
  } catch (error) {
    console.error("Error in clockInDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Record a clock-out for a staff member (called on logout or shift end)
 */
exports.clockOutDB = async (tenantId, username, notes = null) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      UPDATE staff_attendance 
      SET 
        clock_out_at = NOW(),
        notes = CASE 
          WHEN ? IS NOT NULL THEN CONCAT(COALESCE(notes, ''), ' | ', ?) 
          ELSE notes 
        END
      WHERE tenant_id = ? 
        AND username = ? 
        AND clock_out_at IS NULL
      ORDER BY clock_in_at DESC
      LIMIT 1;
    `;
    const [result] = await conn.query(sql, [notes, notes, tenantId, username]);
    return result.affectedRows > 0;
  } catch (error) {
    console.error("Error in clockOutDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Get the staff member's open clock-in (same 16 hour window as clockInDB), or null
 */
exports.getOpenAttendanceDB = async (tenantId, username) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `
      SELECT id, clock_in_at, status
      FROM staff_attendance
      WHERE tenant_id = ?
        AND username = ?
        AND clock_out_at IS NULL
        AND clock_in_at >= DATE_SUB(NOW(), INTERVAL 16 HOUR)
      ORDER BY clock_in_at DESC
      LIMIT 1;
    `,
      [tenantId, username]
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Error in getOpenAttendanceDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Get Attendance / Timesheet report
 */
exports.getAttendanceReportDB = async (tenantId, startDate, endDate, filterUsername = null) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const params = [tenantId, startDate, endDate];
    let userFilterSql = "";

    if (filterUsername) {
      userFilterSql = " AND sa.username = ? ";
      params.push(filterUsername);
    }

    const sql = `
      SELECT 
        sa.id,
        sa.tenant_id,
        sa.username,
        u.name AS staff_name,
        u.photo AS staff_photo,
        u.designation AS staff_designation,
        sa.roster_id,
        sa.shift_id,
        s.name AS shift_name,
        TIME_FORMAT(s.start_time, '%H:%i') AS shift_start_time,
        TIME_FORMAT(s.end_time, '%H:%i') AS shift_end_time,
        sa.clock_in_at,
        sa.clock_out_at,
        TIMESTAMPDIFF(MINUTE, sa.clock_in_at, COALESCE(sa.clock_out_at, NOW())) AS duration_minutes,
        sa.manager_override_by,
        mgr.name AS manager_name,
        sa.status,
        sa.notes,
        sa.created_at
      FROM staff_attendance sa
      JOIN users u ON sa.username = u.username AND sa.tenant_id = u.tenant_id
      LEFT JOIN shifts s ON sa.shift_id = s.id AND sa.tenant_id = s.tenant_id
      LEFT JOIN users mgr ON sa.manager_override_by = mgr.username AND sa.tenant_id = mgr.tenant_id
      WHERE sa.tenant_id = ?
        AND DATE(sa.clock_in_at) >= ?
        AND DATE(sa.clock_in_at) <= ?
        ${userFilterSql}
      ORDER BY sa.clock_in_at DESC;
    `;
    const [rows] = await conn.query(sql, params);
    return rows;
  } catch (error) {
    console.error("Error in getAttendanceReportDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Update a user's Quick PIN (4 to 6 digits)
 */
exports.updateUserQuickPinDB = async (tenantId, username, pin) => {
  const conn = await getMySqlPromiseConnection();
  try {
    let pinHash = null;
    if (pin) {
      pinHash = await bcrypt.hash(String(pin), 10);
    }
    const sql = `UPDATE users SET quick_pin = ? WHERE username = ? AND tenant_id = ?;`;
    await conn.query(sql, [pinHash, username, tenantId]);
    return true;
  } catch (error) {
    console.error("Error in updateUserQuickPinDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Verify a Manager Quick PIN for overrides
 * Matches any user with role = 'admin' or designation = 'manager' (or anyone with quick_pin set who has admin rights)
 */
exports.verifyManagerQuickPinDB = async (tenantId, pin) => {
  if (!pin) return { verified: false, message: "PIN is required." };

  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      SELECT username, name, role, quick_pin, password 
      FROM users 
      WHERE tenant_id = ? 
        AND (role = 'admin' OR designation LIKE '%manager%' OR designation LIKE '%supervisor%')
        AND (quick_pin IS NOT NULL OR password IS NOT NULL);
    `;
    const [managers] = await conn.query(sql, [tenantId]);

    for (const manager of managers) {
      // 1. If quick_pin is set, verify against it
      if (manager.quick_pin) {
        const isMatch = await bcrypt.compare(String(pin), manager.quick_pin);
        if (isMatch) {
          return {
            verified: true,
            manager: {
              username: manager.username,
              name: manager.name,
              role: manager.role,
            },
          };
        }
      }
    }

    return { verified: false, message: "Invalid manager PIN." };
  } catch (error) {
    console.error("Error in verifyManagerQuickPinDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Toggle individual staff shift enforcement
 */
exports.updateUserShiftEnforcementDB = async (tenantId, username, enforceShiftRoster) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `UPDATE users SET enforce_shift_roster = ? WHERE username = ? AND tenant_id = ?;`;
    await conn.query(sql, [enforceShiftRoster ? 1 : 0, username, tenantId]);
    return true;
  } catch (error) {
    console.error("Error in updateUserShiftEnforcementDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};
