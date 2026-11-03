import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

// 1. Shifts
export function useShifts() {
  const APIURL = `/shift-roster/shifts`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return {
    data: data?.shifts || [],
    error,
    isLoading,
    mutate,
    APIURL,
  };
}

export async function addShift(payload) {
  return await ApiClient.post("/shift-roster/shifts", payload);
}

export async function updateShift(id, payload) {
  return await ApiClient.put(`/shift-roster/shifts/${id}`, payload);
}

export async function deleteShift(id) {
  return await ApiClient.delete(`/shift-roster/shifts/${id}`);
}

// 2. Settings
export function useShiftSettings() {
  const APIURL = `/shift-roster/settings`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return {
    data: data?.settings || {
      shift_grace_before_mins: 15,
      shift_grace_after_mins: 30,
      is_shift_enforcement_enabled: 1,
      weekly_hours_limit: 48,
    },
    error,
    isLoading,
    mutate,
  };
}

export async function updateShiftSettings(payload) {
  return await ApiClient.put("/shift-roster/settings", payload);
}

// 3. Weekly Roster
export function useWeeklyRoster(startDate, endDate) {
  const APIURL = startDate && endDate ? `/shift-roster/roster?startDate=${startDate}&endDate=${endDate}` : null;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return {
    data: data?.roster || [],
    error,
    isLoading,
    mutate,
  };
}

export async function assignRosterShift(payload) {
  return await ApiClient.post("/shift-roster/roster/assign", payload);
}

export async function bulkAssignRoster(entries) {
  return await ApiClient.post("/shift-roster/roster/bulk-assign", { entries });
}

export async function updateRosterShift(id, payload) {
  return await ApiClient.put(`/shift-roster/roster/${id}`, payload);
}

export async function clearRosterRange(payload) {
  return await ApiClient.post("/shift-roster/roster/clear", payload);
}

export async function removeRosterShift(id) {
  return await ApiClient.delete(`/shift-roster/roster/${id}`);
}

export async function copyWeeklyRoster(payload) {
  return await ApiClient.post("/shift-roster/roster/copy-week", payload);
}

// 4. Current user heartbeat / POS eligibility
export async function checkMyShiftEligibility() {
  return await ApiClient.get("/shift-roster/my-eligibility");
}

// 5. Attendance & Timesheets
export function useAttendanceReport(startDate, endDate, username = "") {
  const userParam = username ? `&username=${encodeURIComponent(username)}` : "";
  const APIURL = startDate && endDate ? `/shift-roster/attendance?startDate=${startDate}&endDate=${endDate}${userParam}` : null;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return {
    data: data?.attendance || [],
    error,
    isLoading,
    mutate,
  };
}

export function useMyAttendance(enabled = true) {
  const { data, error, isLoading, mutate } = useSWR(enabled ? "/shift-roster/attendance/me" : null, fetcher);
  return { data, error, isLoading, mutate };
}

export async function clockIn(payload) {
  return await ApiClient.post("/shift-roster/attendance/clock-in", payload);
}

export async function clockOut(payload) {
  return await ApiClient.post("/shift-roster/attendance/clock-out", payload);
}

// 6. Manager Quick PIN & Shift Enforcement Toggle
export async function setUserQuickPin(payload) {
  return await ApiClient.post("/shift-roster/user/pin", payload);
}

export async function verifyManagerPin(pin) {
  return await ApiClient.post("/shift-roster/verify-manager-pin", { pin });
}

export async function toggleShiftEnforcement(payload) {
  return await ApiClient.post("/shift-roster/user/toggle-enforcement", payload);
}
