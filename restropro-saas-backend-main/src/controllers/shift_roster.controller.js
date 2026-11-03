const {
  getShiftsDB,
  addShiftDB,
  updateShiftDB,
  deleteShiftDB,
  getShiftSettingsDB,
  updateShiftSettingsDB,
} = require("../services/shift.service");

const {
  getWeeklyRosterDB,
  assignRosterShiftDB,
  removeRosterShiftDB,
  copyWeeklyRosterDB,
  checkUserShiftEligibilityDB,
  bulkAssignRosterDB,
  updateRosterShiftDB,
  clearRosterRangeDB,
} = require("../services/roster.service");

const {
  clockInDB,
  clockOutDB,
  getAttendanceReportDB,
  updateUserQuickPinDB,
  verifyManagerQuickPinDB,
  updateUserShiftEnforcementDB,
} = require("../services/attendance.service");

/**
 * Get all shifts
 */
exports.getShifts = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const shifts = await getShiftsDB(tenantId);
    return res.status(200).json({ success: true, shifts });
  } catch (error) {
    console.error("Error in getShifts controller:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Add shift
 */
exports.addShift = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { name, start_time, end_time, is_overnight, color, is_active } = req.body;
    if (!name || !start_time || !end_time) {
      return res.status(400).json({ success: false, message: "Name, start time, and end time are required." });
    }

    const shiftId = await addShiftDB(tenantId, {
      name,
      start_time,
      end_time,
      is_overnight,
      color,
      is_active,
    });
    return res.status(201).json({ success: true, message: "Shift created successfully.", shiftId });
  } catch (error) {
    console.error("Error in addShift controller:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update shift
 */
exports.updateShift = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const { name, start_time, end_time, is_overnight, color, is_active } = req.body;

    await updateShiftDB(tenantId, id, {
      name,
      start_time,
      end_time,
      is_overnight,
      color,
      is_active,
    });
    return res.status(200).json({ success: true, message: "Shift updated successfully." });
  } catch (error) {
    console.error("Error in updateShift controller:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete shift
 */
exports.deleteShift = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    await deleteShiftDB(tenantId, id);
    return res.status(200).json({ success: true, message: "Shift deleted successfully." });
  } catch (error) {
    console.error("Error in deleteShift controller:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Get shift settings
 */
exports.getShiftSettings = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const settings = await getShiftSettingsDB(tenantId);
    return res.status(200).json({ success: true, settings });
  } catch (error) {
    console.error("Error in getShiftSettings controller:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update shift settings
 */
exports.updateShiftSettings = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { shift_grace_before_mins, shift_grace_after_mins, is_shift_enforcement_enabled, weekly_hours_limit } = req.body;

    await updateShiftSettingsDB(tenantId, {
      shift_grace_before_mins,
      shift_grace_after_mins,
      is_shift_enforcement_enabled,
      weekly_hours_limit,
    });
    return res.status(200).json({ success: true, message: "Shift settings updated successfully." });
  } catch (error) {
    console.error("Error in updateShiftSettings controller:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get weekly roster
 */
exports.getWeeklyRoster = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "startDate and endDate are required." });
    }

    const roster = await getWeeklyRosterDB(tenantId, startDate, endDate);
    return res.status(200).json({ success: true, roster });
  } catch (error) {
    console.error("Error in getWeeklyRoster controller:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Assign shift to user
 */
exports.assignRosterShift = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { username, shiftId, rosterDate, notes } = req.body;
    if (!username || !shiftId || !rosterDate) {
      return res.status(400).json({ success: false, message: "username, shiftId, and rosterDate are required." });
    }

    await assignRosterShiftDB(tenantId, username, shiftId, rosterDate, notes);
    return res.status(200).json({ success: true, message: "Shift assigned successfully." });
  } catch (error) {
    console.error("Error in assignRosterShift controller:", error);
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * Bulk assign shifts (many staff x many days)
 */
exports.bulkAssignRoster = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, message: "entries must be a non-empty array." });
    }
    if (entries.length > 500) {
      return res.status(400).json({ success: false, message: "Too many entries in one request (max 500)." });
    }

    const result = await bulkAssignRosterDB(tenantId, entries);
    return res.status(200).json({ success: true, ...result, message: `Assigned ${result.assigned} shifts.` });
  } catch (error) {
    console.error("Error in bulkAssignRoster controller:", error);
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * Edit / move a roster assignment
 */
exports.updateRosterShift = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const { username, shiftId, rosterDate, notes } = req.body;

    await updateRosterShiftDB(tenantId, id, { username, shiftId, rosterDate, notes });
    return res.status(200).json({ success: true, message: "Roster assignment updated." });
  } catch (error) {
    console.error("Error in updateRosterShift controller:", error);
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * Clear roster assignments in a date range (optionally a single staff member)
 */
exports.clearRosterRange = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { startDate, endDate, username } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "startDate and endDate are required." });
    }

    const result = await clearRosterRangeDB(tenantId, startDate, endDate, username || null);
    return res.status(200).json({ success: true, ...result, message: `Removed ${result.removed} shifts.` });
  } catch (error) {
    console.error("Error in clearRosterRange controller:", error);
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * Remove roster assignment
 */
exports.removeRosterShift = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    await removeRosterShiftDB(tenantId, id);
    return res.status(200).json({ success: true, message: "Roster assignment removed." });
  } catch (error) {
    console.error("Error in removeRosterShift controller:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Copy weekly roster
 */
exports.copyWeeklyRoster = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { fromStartDate, toStartDate } = req.body;
    if (!fromStartDate || !toStartDate) {
      return res.status(400).json({ success: false, message: "fromStartDate and toStartDate are required." });
    }

    const result = await copyWeeklyRosterDB(tenantId, fromStartDate, toStartDate);
    return res.status(200).json({ success: true, ...result, message: `Successfully copied ${result.copied} shifts.` });
  } catch (error) {
    console.error("Error in copyWeeklyRoster controller:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Check current user shift eligibility (heartbeat / POS check)
 */
exports.checkMyShiftEligibility = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.user.username;

    const result = await checkUserShiftEligibilityDB(tenantId, username);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Error in checkMyShiftEligibility controller:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get attendance report
 */
exports.getAttendanceReport = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { startDate, endDate, username } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "startDate and endDate are required." });
    }

    const attendance = await getAttendanceReportDB(tenantId, startDate, endDate, username);
    return res.status(200).json({ success: true, attendance });
  } catch (error) {
    console.error("Error in getAttendanceReport controller:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Manual Clock-in
 */
exports.clockIn = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.body.username || req.user.username;
    const { rosterId, shiftId, managerPin, notes } = req.body;

    let managerOverrideBy = null;
    let status = "on_time";

    if (managerPin) {
      const pinResult = await verifyManagerQuickPinDB(tenantId, managerPin);
      if (!pinResult.verified) {
        return res.status(400).json({ success: false, message: "Invalid manager PIN." });
      }
      managerOverrideBy = pinResult.manager.username;
      status = "override";
    }

    const result = await clockInDB(tenantId, username, rosterId, shiftId, managerOverrideBy, status, notes);
    return res.status(200).json({ success: true, message: "Clocked in successfully.", ...result });
  } catch (error) {
    console.error("Error in clockIn controller:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Manual Clock-out
 */
exports.clockOut = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const username = req.body.username || req.user.username;
    const { notes } = req.body;

    await clockOutDB(tenantId, username, notes);
    return res.status(200).json({ success: true, message: "Clocked out successfully." });
  } catch (error) {
    console.error("Error in clockOut controller:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update user Quick PIN
 */
exports.setUserQuickPin = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const targetUsername = req.body.username || req.user.username;
    const { pin } = req.body;

    // Only allow changing self or must be admin
    if (targetUsername !== req.user.username && req.user.role !== "admin" && req.user.role !== "group_owner") {
      return res.status(403).json({ success: false, message: "Permission denied." });
    }

    if (pin && (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin))) {
      return res.status(400).json({ success: false, message: "PIN must be between 4 and 6 numeric digits." });
    }

    await updateUserQuickPinDB(tenantId, targetUsername, pin);
    return res.status(200).json({ success: true, message: "Quick PIN updated successfully." });
  } catch (error) {
    console.error("Error in setUserQuickPin controller:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Verify Manager Quick PIN
 */
exports.verifyManagerPin = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { pin } = req.body;

    const result = await verifyManagerQuickPinDB(tenantId, pin);
    if (!result.verified) {
      return res.status(400).json({ success: false, message: result.message || "Invalid manager PIN." });
    }
    return res.status(200).json({ success: true, manager: result.manager });
  } catch (error) {
    console.error("Error in verifyManagerPin controller:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Toggle individual staff shift enforcement
 */
exports.toggleShiftEnforcement = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { username, enforceShiftRoster } = req.body;

    if (req.user.role !== "admin" && req.user.role !== "group_owner") {
      return res.status(403).json({ success: false, message: "Only administrators can configure shift enforcement." });
    }

    await updateUserShiftEnforcementDB(tenantId, username, enforceShiftRoster);
    return res.status(200).json({ success: true, message: "Shift enforcement updated for user." });
  } catch (error) {
    console.error("Error in toggleShiftEnforcement controller:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
