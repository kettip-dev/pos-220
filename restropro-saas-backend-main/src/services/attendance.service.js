const bcrypt = require("bcrypt");
const { getMySqlPromiseConnection } = require("../config/mysql.db");

// Minutes after shift start before a clock-in counts as late,
// and minutes before shift end before a clock-out counts as an early leave
const LATE_GRACE_MINS = 5;
const EARLY_LEAVE_GRACE_MINS = 5;
// How long before a shift starts a clock-in still links to it
const LINK_BEFORE_START_MINS = 180;

// Rostered shift start/end as DATETIME expressions (overnight shifts end the next day)
const SHIFT_START_SQL = "TIMESTAMP(sr.roster_date, s.start_time)";
const SHIFT_END_SQL =
  "TIMESTAMP(IF(s.is_overnight = 1 OR s.end_time <= s.start_time, DATE_ADD(sr.roster_date, INTERVAL 1 DAY), sr.roster_date), s.end_time)";

/**
 * Find the rostered shift a clock-in happening now belongs to: the one whose window
 * (a few hours before start .. end) contains NOW(), closest start first.
 * When rosterId is given, that roster entry is used instead.
 */
async function findRosterForClockIn(conn, tenantId, username, rosterId = null) {
  const params = [tenantId, username];
  let matchSql = `
      AND sr.roster_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND CURDATE()
      AND NOW() BETWEEN DATE_SUB(${SHIFT_START_SQL}, INTERVAL ${LINK_BEFORE_START_MINS} MINUTE) AND ${SHIFT_END_SQL}`;
  if (rosterId) {
    matchSql = " AND sr.id = ? ";
    params.push(Number(rosterId));
  }

  const [rows] = await conn.query(
    `
    SELECT
      sr.id AS roster_id,
      s.id AS shift_id,
      TIMESTAMPDIFF(MINUTE, ${SHIFT_START_SQL}, NOW()) AS mins_after_start
    FROM staff_rosters sr
    JOIN shifts s ON sr.shift_id = s.id AND sr.tenant_id = s.tenant_id
    WHERE sr.tenant_id = ?
      AND sr.username = ?
      ${matchSql}
    ORDER BY ABS(TIMESTAMPDIFF(MINUTE, ${SHIFT_START_SQL}, NOW())) ASC
    LIMIT 1;
  `,
    params
  );
  return rows[0] || null;
}

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

    // Link the clock-in to the staff member's rostered shift so the timesheet can compare them
    const roster = await findRosterForClockIn(conn, tenantId, username, rosterId);
    if (roster && status === "on_time" && roster.mins_after_start > LATE_GRACE_MINS) {
      status = "late";
    }

    const sql = `
      INSERT INTO staff_attendance
      (tenant_id, username, roster_id, shift_id, clock_in_at, manager_override_by, status, notes)
      VALUES (?, ?, ?, ?, NOW(), ?, ?, ?);
    `;
    const [result] = await conn.query(sql, [
      tenantId,
      username,
      roster?.roster_id || null,
      roster?.shift_id || (shiftId ? Number(shiftId) : null),
      managerOverrideBy,
      status,
      notes,
    ]);

    return { id: result.insertId, alreadyClockedIn: false, status };
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
      SELECT
        sa.id,
        sa.clock_in_at,
        sa.status,
        s.name AS shift_name,
        TIME_FORMAT(s.start_time, '%H:%i') AS shift_start_time,
        TIME_FORMAT(s.end_time, '%H:%i') AS shift_end_time
      FROM staff_attendance sa
      LEFT JOIN shifts s ON sa.shift_id = s.id AND sa.tenant_id = s.tenant_id
      WHERE sa.tenant_id = ?
        AND sa.username = ?
        AND sa.clock_out_at IS NULL
        AND sa.clock_in_at >= DATE_SUB(NOW(), INTERVAL 16 HOUR)
      ORDER BY sa.clock_in_at DESC
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
 * The staff member's next rostered shift that hasn't ended yet, or null
 */
exports.getUpcomingRosterDB = async (tenantId, username) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `
      SELECT
        sr.id AS roster_id,
        sr.roster_date,
        s.name AS shift_name,
        TIME_FORMAT(s.start_time, '%H:%i') AS shift_start_time,
        TIME_FORMAT(s.end_time, '%H:%i') AS shift_end_time,
        ${SHIFT_START_SQL} AS shift_start_at
      FROM staff_rosters sr
      JOIN shifts s ON sr.shift_id = s.id AND sr.tenant_id = s.tenant_id
      WHERE sr.tenant_id = ?
        AND sr.username = ?
        AND sr.roster_date >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        AND ${SHIFT_END_SQL} > NOW()
      ORDER BY shift_start_at ASC
      LIMIT 1;
    `,
      [tenantId, username]
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Error in getUpcomingRosterDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Get Attendance / Timesheet report.
 * Each clock-in is matched to the rostered shift it belongs to (the stored link, or for older
 * records the closest roster entry that day), so lateness and early leaves are measured against
 * the schedule. Rostered shifts that ended without any clock-in come back as "absent" rows.
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
        sr.id AS roster_id,
        sr.roster_date,
        s.id AS shift_id,
        s.name AS shift_name,
        s.color AS shift_color,
        TIME_FORMAT(s.start_time, '%H:%i') AS shift_start_time,
        TIME_FORMAT(s.end_time, '%H:%i') AS shift_end_time,
        IF(sr.id IS NULL, NULL, TIMESTAMPDIFF(MINUTE, ${SHIFT_START_SQL}, ${SHIFT_END_SQL})) AS scheduled_minutes,
        IF(sr.id IS NULL, NULL, TIMESTAMPDIFF(MINUTE, ${SHIFT_START_SQL}, sa.clock_in_at)) AS late_minutes,
        IF(sr.id IS NULL OR sa.clock_out_at IS NULL, NULL, TIMESTAMPDIFF(MINUTE, sa.clock_out_at, ${SHIFT_END_SQL})) AS early_leave_minutes,
        sa.clock_in_at,
        sa.clock_out_at,
        TIMESTAMPDIFF(MINUTE, sa.clock_in_at, COALESCE(sa.clock_out_at, NOW())) AS duration_minutes,
        sa.manager_override_by,
        mgr.name AS manager_name,
        sa.status,
        sa.notes,
        sa.created_at
      FROM (
        SELECT
          sa.*,
          COALESCE(sa.roster_id, (
            SELECT sr2.id
            FROM staff_rosters sr2
            JOIN shifts s2 ON sr2.shift_id = s2.id AND sr2.tenant_id = s2.tenant_id
            WHERE sr2.tenant_id = sa.tenant_id
              AND sr2.username = sa.username
              AND sr2.roster_date = DATE(sa.clock_in_at)
            ORDER BY ABS(TIMESTAMPDIFF(MINUTE, TIMESTAMP(sr2.roster_date, s2.start_time), sa.clock_in_at)) ASC
            LIMIT 1
          )) AS matched_roster_id
        FROM staff_attendance sa
        WHERE sa.tenant_id = ?
          AND DATE(sa.clock_in_at) >= ?
          AND DATE(sa.clock_in_at) <= ?
          ${userFilterSql}
      ) sa
      JOIN users u ON sa.username = u.username AND sa.tenant_id = u.tenant_id
      LEFT JOIN staff_rosters sr ON sr.id = sa.matched_roster_id AND sr.tenant_id = sa.tenant_id
      LEFT JOIN shifts s ON s.id = COALESCE(sr.shift_id, sa.shift_id) AND s.tenant_id = sa.tenant_id
      LEFT JOIN users mgr ON sa.manager_override_by = mgr.username AND sa.tenant_id = mgr.tenant_id
      ORDER BY sa.clock_in_at DESC;
    `;
    const [rows] = await conn.query(sql, params);

    const attendance = rows.map((row) => {
      // Overrides keep their status; everything else is measured against the linked shift
      let status = row.status;
      if (status !== "override") {
        if (!row.roster_id) status = "unscheduled";
        else if (row.late_minutes > LATE_GRACE_MINS) status = "late";
        else if (row.early_leave_minutes > EARLY_LEAVE_GRACE_MINS) status = "early";
        else status = "on_time";
      }
      return { ...row, status };
    });

    // Rostered shifts that are over with nobody clocked in for them
    const absentParams = [tenantId, startDate, endDate];
    let absentFilterSql = "";
    if (filterUsername) {
      absentFilterSql += " AND sr.username = ? ";
      absentParams.push(filterUsername);
    }
    const linkedRosterIds = attendance.filter((r) => r.roster_id).map((r) => r.roster_id);
    if (linkedRosterIds.length > 0) {
      absentFilterSql += " AND sr.id NOT IN (?) ";
      absentParams.push(linkedRosterIds);
    }

    const [absentRows] = await conn.query(
      `
      SELECT
        sr.id AS roster_id,
        sr.roster_date,
        sr.username,
        u.name AS staff_name,
        u.photo AS staff_photo,
        u.designation AS staff_designation,
        s.id AS shift_id,
        s.name AS shift_name,
        s.color AS shift_color,
        TIME_FORMAT(s.start_time, '%H:%i') AS shift_start_time,
        TIME_FORMAT(s.end_time, '%H:%i') AS shift_end_time,
        ${SHIFT_START_SQL} AS shift_start_at,
        TIMESTAMPDIFF(MINUTE, ${SHIFT_START_SQL}, ${SHIFT_END_SQL}) AS scheduled_minutes
      FROM staff_rosters sr
      JOIN shifts s ON sr.shift_id = s.id AND sr.tenant_id = s.tenant_id
      JOIN users u ON sr.username = u.username AND sr.tenant_id = u.tenant_id
      WHERE sr.tenant_id = ?
        AND sr.roster_date >= ?
        AND sr.roster_date <= ?
        AND ${SHIFT_END_SQL} < NOW()
        ${absentFilterSql};
    `,
      absentParams
    );

    const absent = absentRows.map((row) => ({
      ...row,
      id: `absent-${row.roster_id}`,
      clock_in_at: null,
      clock_out_at: null,
      duration_minutes: 0,
      late_minutes: null,
      early_leave_minutes: null,
      manager_name: null,
      status: "absent",
      notes: null,
    }));

    const sortTime = (r) => new Date(r.clock_in_at || r.shift_start_at).getTime();
    return [...attendance, ...absent].sort((a, b) => sortTime(b) - sortTime(a));
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
