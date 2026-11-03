const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { getShiftSettingsDB } = require("./shift.service");

/**
 * Get weekly roster for a date range (typically Monday to Sunday)
 */
exports.getWeeklyRosterDB = async (tenantId, startDate, endDate) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      SELECT 
        sr.id,
        sr.tenant_id,
        sr.username,
        u.name AS staff_name,
        u.photo AS staff_photo,
        u.designation AS staff_designation,
        u.role AS staff_role,
        u.enforce_shift_roster,
        sr.shift_id,
        s.name AS shift_name,
        TIME_FORMAT(s.start_time, '%H:%i') AS start_time,
        TIME_FORMAT(s.end_time, '%H:%i') AS end_time,
        s.is_overnight,
        s.color AS shift_color,
        DATE_FORMAT(sr.roster_date, '%Y-%m-%d') AS roster_date,
        sr.notes,
        sr.created_at,
        sr.updated_at
      FROM staff_rosters sr
      JOIN users u ON sr.username = u.username AND sr.tenant_id = u.tenant_id
      JOIN shifts s ON sr.shift_id = s.id AND sr.tenant_id = s.tenant_id
      WHERE sr.tenant_id = ?
        AND sr.roster_date >= ?
        AND sr.roster_date <= ?
      ORDER BY sr.roster_date ASC, s.start_time ASC, u.name ASC;
    `;
    const [rows] = await conn.query(sql, [tenantId, startDate, endDate]);
    return rows;
  } catch (error) {
    console.error("Error in getWeeklyRosterDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function rosterError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Ensure every username and shift id belongs to the tenant before writing rosters.
 */
async function assertRosterTargets(conn, tenantId, usernames, shiftIds) {
  const uniqueUsers = [...new Set(usernames)];
  const uniqueShifts = [...new Set(shiftIds.map(Number))];

  if (uniqueUsers.length > 0) {
    const [userRows] = await conn.query(
      `SELECT username FROM users WHERE tenant_id = ? AND username IN (?)`,
      [tenantId, uniqueUsers]
    );
    if (userRows.length !== uniqueUsers.length) {
      throw rosterError("One or more staff members do not belong to this store.");
    }
  }

  if (uniqueShifts.length > 0) {
    const [shiftRows] = await conn.query(
      `SELECT id FROM shifts WHERE tenant_id = ? AND id IN (?)`,
      [tenantId, uniqueShifts]
    );
    if (shiftRows.length !== uniqueShifts.length) {
      throw rosterError("One or more shifts do not belong to this store.");
    }
  }
}

/**
 * Assign a shift to a user on a given date
 */
exports.assignRosterShiftDB = async (tenantId, username, shiftId, rosterDate, notes = null) => {
  const conn = await getMySqlPromiseConnection();
  try {
    if (!DATE_RE.test(rosterDate)) throw rosterError("Invalid roster date.");
    await assertRosterTargets(conn, tenantId, [username], [shiftId]);

    const sql = `
      INSERT INTO staff_rosters 
      (tenant_id, username, shift_id, roster_date, notes)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        shift_id = VALUES(shift_id),
        notes = VALUES(notes);
    `;
    const [result] = await conn.query(sql, [
      tenantId,
      username,
      Number(shiftId),
      rosterDate,
      notes,
    ]);
    return result.insertId || true;
  } catch (error) {
    console.error("Error in assignRosterShiftDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Assign many (username, shift, date) entries in one transaction
 * entries: [{ username, shiftId, rosterDate, notes }]
 */
exports.bulkAssignRosterDB = async (tenantId, entries) => {
  const conn = await getMySqlPromiseConnection();
  try {
    for (const e of entries) {
      if (!e.username || !e.shiftId || !DATE_RE.test(e.rosterDate || "")) {
        throw rosterError("Each entry requires username, shiftId and a valid rosterDate.");
      }
    }
    await assertRosterTargets(
      conn,
      tenantId,
      entries.map((e) => e.username),
      entries.map((e) => e.shiftId)
    );

    await conn.beginTransaction();
    for (const e of entries) {
      await conn.query(
        `
        INSERT INTO staff_rosters
        (tenant_id, username, shift_id, roster_date, notes)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          notes = VALUES(notes);
      `,
        [tenantId, e.username, Number(e.shiftId), e.rosterDate, e.notes || null]
      );
    }
    await conn.commit();
    return { assigned: entries.length };
  } catch (error) {
    await conn.rollback().catch(() => {});
    console.error("Error in bulkAssignRosterDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Edit or move a roster assignment (change staff, date, shift or notes)
 */
exports.updateRosterShiftDB = async (tenantId, rosterId, { username, shiftId, rosterDate, notes }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [existingRows] = await conn.query(
      `SELECT id, username, shift_id, DATE_FORMAT(roster_date, '%Y-%m-%d') AS roster_date, notes
       FROM staff_rosters WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [rosterId, tenantId]
    );
    if (existingRows.length === 0) throw rosterError("Roster assignment not found.", 404);
    const existing = existingRows[0];

    const next = {
      username: username || existing.username,
      shiftId: Number(shiftId || existing.shift_id),
      rosterDate: rosterDate || existing.roster_date,
      notes: notes !== undefined ? notes || null : existing.notes,
    };
    if (!DATE_RE.test(next.rosterDate)) throw rosterError("Invalid roster date.");
    await assertRosterTargets(conn, tenantId, [next.username], [next.shiftId]);

    try {
      await conn.query(
        `UPDATE staff_rosters
         SET username = ?, shift_id = ?, roster_date = ?, notes = ?
         WHERE id = ? AND tenant_id = ?`,
        [next.username, next.shiftId, next.rosterDate, next.notes, rosterId, tenantId]
      );
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        throw rosterError("This staff member already has that shift on that day.", 409);
      }
      throw err;
    }
    return true;
  } catch (error) {
    console.error("Error in updateRosterShiftDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Remove all roster assignments within a date range (optionally for one staff member)
 */
exports.clearRosterRangeDB = async (tenantId, startDate, endDate, username = null) => {
  const conn = await getMySqlPromiseConnection();
  try {
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) throw rosterError("Invalid date range.");
    const params = [tenantId, startDate, endDate];
    let sql = `DELETE FROM staff_rosters WHERE tenant_id = ? AND roster_date >= ? AND roster_date <= ?`;
    if (username) {
      sql += ` AND username = ?`;
      params.push(username);
    }
    const [result] = await conn.query(sql, params);
    return { removed: result.affectedRows };
  } catch (error) {
    console.error("Error in clearRosterRangeDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Remove a roster assignment
 */
exports.removeRosterShiftDB = async (tenantId, rosterId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `DELETE FROM staff_rosters WHERE id = ? AND tenant_id = ?;`;
    await conn.query(sql, [rosterId, tenantId]);
    return true;
  } catch (error) {
    console.error("Error in removeRosterShiftDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Copy a whole week of rosters into target week
 * fromStartDate: YYYY-MM-DD (Monday)
 * toStartDate: YYYY-MM-DD (Monday)
 */
exports.copyWeeklyRosterDB = async (tenantId, fromStartDate, toStartDate) => {
  const conn = await getMySqlPromiseConnection();
  try {
    // 1. Fetch source week rosters (7 days)
    const [sourceRows] = await conn.query(
      `
      SELECT sr.username, sr.shift_id, sr.roster_date, sr.notes,
             DATEDIFF(sr.roster_date, ?) AS day_offset
      FROM staff_rosters sr
      JOIN shifts s ON s.id = sr.shift_id AND s.tenant_id = sr.tenant_id
      WHERE sr.tenant_id = ? 
        AND sr.roster_date >= ? 
        AND sr.roster_date < DATE_ADD(?, INTERVAL 7 DAY)
        AND s.is_active = 1;
    `,
      [fromStartDate, tenantId, fromStartDate, fromStartDate]
    );

    if (sourceRows.length === 0) {
      return { copied: 0, message: "No rosters found in source week." };
    }

    let inserted = 0;
    for (const row of sourceRows) {
      await conn.query(
        `
        INSERT INTO staff_rosters 
        (tenant_id, username, shift_id, roster_date, notes)
        VALUES (?, ?, ?, DATE_ADD(?, INTERVAL ? DAY), ?)
        ON DUPLICATE KEY UPDATE
          shift_id = VALUES(shift_id),
          notes = VALUES(notes);
      `,
        [tenantId, row.username, row.shift_id, toStartDate, row.day_offset, row.notes]
      );
      inserted++;
    }

    return { copied: inserted };
  } catch (error) {
    console.error("Error in copyWeeklyRosterDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Check if a user is currently eligible to log in or operate based on their shifts.
 * Returns { allowed: boolean, reason, shift, roster, nextShift }
 */
exports.checkUserShiftEligibilityDB = async (tenantId, username) => {
  const conn = await getMySqlPromiseConnection();
  try {
    // 1. Fetch user's shift enforcement setting
    const [userRows] = await conn.query(
      `SELECT username, role, enforce_shift_roster FROM users WHERE username = ? AND tenant_id = ? LIMIT 1`,
      [username, tenantId]
    );

    if (userRows.length === 0) {
      return { allowed: false, reason: "user_not_found" };
    }

    const user = userRows[0];

    // Admin & Group Owners are always exempt
    if (user.role === "admin" || user.role === "group_owner" || user.role === "superadmin") {
      return { allowed: true, reason: "admin_exempt" };
    }

    // If individual user has enforcement disabled
    if (user.enforce_shift_roster === 0) {
      return { allowed: true, reason: "user_exempt" };
    }

    // 2. Fetch tenant shift settings
    const settings = await getShiftSettingsDB(tenantId);
    if (!settings.is_shift_enforcement_enabled) {
      return { allowed: true, reason: "enforcement_disabled" };
    }

    const graceBeforeMins = settings.shift_grace_before_mins ?? 15;
    const graceAfterMins = settings.shift_grace_after_mins ?? 30;

    // 3. Query potential active shifts: yesterday (if overnight), today, or tomorrow
    const [rosterRows] = await conn.query(
      `
      SELECT 
        sr.id AS roster_id,
        sr.roster_date,
        s.id AS shift_id,
        s.name AS shift_name,
        TIME_FORMAT(s.start_time, '%H:%i') AS start_time,
        TIME_FORMAT(s.end_time, '%H:%i') AS end_time,
        s.is_overnight,
        s.color AS shift_color,
        NOW() AS db_now,
        DATE_ADD(CONCAT(sr.roster_date, ' ', s.start_time), INTERVAL -? MINUTE) AS window_start,
        CASE 
          WHEN s.is_overnight = 1 THEN DATE_ADD(CONCAT(DATE_ADD(sr.roster_date, INTERVAL 1 DAY), ' ', s.end_time), INTERVAL ? MINUTE)
          ELSE DATE_ADD(CONCAT(sr.roster_date, ' ', s.end_time), INTERVAL ? MINUTE)
        END AS window_end,
        CONCAT(sr.roster_date, ' ', s.start_time) AS exact_start,
        CASE 
          WHEN s.is_overnight = 1 THEN CONCAT(DATE_ADD(sr.roster_date, INTERVAL 1 DAY), ' ', s.end_time)
          ELSE CONCAT(sr.roster_date, ' ', s.end_time)
        END AS exact_end
      FROM staff_rosters sr
      JOIN shifts s ON sr.shift_id = s.id AND sr.tenant_id = s.tenant_id
      WHERE sr.tenant_id = ?
        AND sr.username = ?
        AND sr.roster_date >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        AND sr.roster_date <= DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        AND s.is_active = 1
      ORDER BY sr.roster_date ASC, s.start_time ASC;
    `,
      [graceBeforeMins, graceAfterMins, graceAfterMins, tenantId, username]
    );

    // Find any matching active window right now
    const now = new Date();
    for (const row of rosterRows) {
      const windowStart = new Date(row.window_start);
      const windowEnd = new Date(row.window_end);
      const dbNow = new Date(row.db_now);

      if (dbNow >= windowStart && dbNow <= windowEnd) {
        return {
          allowed: true,
          reason: "within_shift",
          roster: {
            id: row.roster_id,
            roster_date: row.roster_date,
            shift_id: row.shift_id,
            shift_name: row.shift_name,
            start_time: row.start_time,
            end_time: row.end_time,
            is_overnight: row.is_overnight,
            window_start: row.window_start,
            window_end: row.window_end,
            exact_start: row.exact_start,
            exact_end: row.exact_end,
          },
        };
      }
    }

    // If not within window, find the next upcoming shift for today or future
    const [nextRows] = await conn.query(
      `
      SELECT 
        sr.id AS roster_id,
        sr.roster_date,
        s.id AS shift_id,
        s.name AS shift_name,
        TIME_FORMAT(s.start_time, '%H:%i') AS start_time,
        TIME_FORMAT(s.end_time, '%H:%i') AS end_time,
        s.is_overnight,
        s.color AS shift_color,
        CONCAT(sr.roster_date, ' ', s.start_time) AS exact_start
      FROM staff_rosters sr
      JOIN shifts s ON sr.shift_id = s.id AND sr.tenant_id = s.tenant_id
      WHERE sr.tenant_id = ?
        AND sr.username = ?
        AND CONCAT(sr.roster_date, ' ', s.start_time) > NOW()
        AND s.is_active = 1
      ORDER BY exact_start ASC
      LIMIT 1;
    `,
      [tenantId, username]
    );

    return {
      allowed: false,
      reason: "outside_shift",
      nextShift: nextRows[0] || null,
      graceBeforeMins,
      graceAfterMins,
    };
  } catch (error) {
    console.error("Error in checkUserShiftEligibilityDB:", error);
    throw error;
  } finally {
    conn.release();
  }
};
