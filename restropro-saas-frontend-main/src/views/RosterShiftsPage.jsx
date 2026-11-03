import React, { useState, useMemo, useEffect, useRef } from "react";
import Page from "../components/Page";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import {
  IconCalendar,
  IconCalendarEvent,
  IconClock,
  IconPlus,
  IconTrash,
  IconEdit,
  IconCopy,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
  IconMoon,
  IconSun,
  IconUser,
  IconUsers,
  IconSearch,
  IconBrush,
  IconEraser,
  IconDownload,
  IconPrinter,
  IconClearAll,
  IconAlertTriangle,
  IconNote,
  IconX,
  IconClockHour4,
  IconUserCheck,
  IconCalendarOff,
  IconShieldLock,
  IconCheck,
} from "@tabler/icons-react";
import {
  useShifts,
  addShift,
  updateShift,
  deleteShift,
  useWeeklyRoster,
  assignRosterShift,
  removeRosterShift,
  copyWeeklyRoster,
  bulkAssignRoster,
  updateRosterShift,
  clearRosterRange,
  useShiftSettings,
  updateShiftSettings,
} from "../controllers/shift_roster.controller";
import { useUsers } from "../controllers/users.controller";
import clsx from "clsx";
import ShiftTemplateModal from "../components/roster/ShiftTemplateModal";
import RosterAssignModal from "../components/roster/RosterAssignModal";
import {
  formatLocalDate,
  getWeekRange,
  weekOffsetForDate,
  parseLocalDate,
  shiftDurationMinutes,
  formatHours,
  findOverlaps,
  initials,
  downloadRosterCsv,
  timeToMinutes,
} from "../components/roster/rosterUtils";

const ERASER = "eraser";

export default function RosterShiftsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("km") ? "km-KH" : "en-US";
  const [activeTab, setActiveTab] = useState("roster"); // 'roster' | 'shifts' | 'settings'
  const [weekOffset, setWeekOffset] = useState(0);

  const weekInfo = useMemo(() => getWeekRange(weekOffset, locale), [weekOffset, locale]);

  // SWR queries
  const { data: shifts = [], mutate: mutateShifts } = useShifts();
  const { data: roster = [], mutate: mutateRoster, isLoading: isRosterLoading } = useWeeklyRoster(weekInfo.startDate, weekInfo.endDate);
  // Previous week too, so overnight shifts from last Sunday are considered in overlap checks
  const prevWeek = useMemo(() => getWeekRange(weekOffset - 1, locale), [weekOffset, locale]);
  const { data: prevRoster = [] } = useWeeklyRoster(prevWeek.endDate, prevWeek.endDate);
  const { data: shiftSettings, mutate: mutateSettings } = useShiftSettings();
  const { data: usersData, isLoading: isUsersLoading } = useUsers();

  const staffList = useMemo(() => {
    const users = Array.isArray(usersData) ? usersData : usersData?.users || [];
    // Include all restaurant team members (staff and store admins), exclude group_owner/superadmin
    return users.filter((u) => u.role !== "group_owner" && u.role !== "superadmin");
  }, [usersData]);

  const weeklyLimitMins = (Number(shiftSettings?.weekly_hours_limit) || 48) * 60;

  // Modals
  const [shiftModal, setShiftModal] = useState({ open: false, shift: null });
  const [assignModal, setAssignModal] = useState({ open: false, assignment: null, username: null, date: null });

  // Roster toolbar state
  const [search, setSearch] = useState("");
  const [scheduledOnly, setScheduledOnly] = useState(false);
  const [paintMode, setPaintMode] = useState(false);
  const [paintShiftId, setPaintShiftId] = useState(null);
  const [busyCells, setBusyCells] = useState({});
  const [dragOverCell, setDragOverCell] = useState(null);
  const dateInputRef = useRef(null);

  const activeShifts = useMemo(() => shifts.filter((s) => s.is_active), [shifts]);

  useEffect(() => {
    if (paintMode && !paintShiftId && activeShifts[0]) setPaintShiftId(activeShifts[0].id);
  }, [paintMode, paintShiftId, activeShifts]);

  // ---------- Derived roster data ----------
  const cellMap = useMemo(() => {
    const map = {};
    for (const r of roster) {
      const key = `${r.username}|${r.roster_date?.slice(0, 10)}`;
      (map[key] = map[key] || []).push(r);
    }
    return map;
  }, [roster]);
  const cellsFor = (username, date) => cellMap[`${username}|${date}`] || [];

  const minutesByUser = useMemo(() => {
    const totals = {};
    for (const r of roster) {
      totals[r.username] = (totals[r.username] || 0) + shiftDurationMinutes(r.start_time, r.end_time, r.is_overnight);
    }
    return totals;
  }, [roster]);
  const hoursFor = (username) => minutesByUser[username] || 0;

  // Overlap flags per assignment id
  const conflictIds = useMemo(() => {
    const ids = new Set();
    const all = [...prevRoster, ...roster];
    for (const r of roster) {
      const mine = all.filter((x) => x.username === r.username && x.id !== r.id);
      if (findOverlaps(r, r.roster_date, mine).length > 0) ids.add(r.id);
    }
    return ids;
  }, [roster, prevRoster]);

  const visibleStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staffList.filter((s) => {
      if (q && !(`${s.name} ${s.username} ${s.designation || ""} ${s.role || ""}`.toLowerCase().includes(q))) return false;
      if (scheduledOnly && !minutesByUser[s.username]) return false;
      return true;
    });
  }, [staffList, search, scheduledOnly, minutesByUser]);

  const stats = useMemo(() => {
    const totalMins = Object.values(minutesByUser).reduce((a, b) => a + b, 0);
    const scheduledStaff = staffList.filter((s) => minutesByUser[s.username]).length;
    const overtime = staffList.filter((s) => (minutesByUser[s.username] || 0) > weeklyLimitMins).length;
    const openDays = weekInfo.days.filter((d) => !roster.some((r) => r.roster_date === d.date)).length;
    return { totalMins, scheduledStaff, overtime, openDays, shiftCount: roster.length };
  }, [minutesByUser, staffList, weeklyLimitMins, weekInfo, roster]);

  const dayCoverage = useMemo(
    () =>
      weekInfo.days.map((d) => {
        const items = roster.filter((r) => r.roster_date === d.date);
        const byShift = {};
        items.forEach((r) => (byShift[r.shift_id] = (byShift[r.shift_id] || 0) + 1));
        return {
          date: d.date,
          headcount: new Set(items.map((r) => r.username)).size,
          mins: items.reduce((a, r) => a + shiftDurationMinutes(r.start_time, r.end_time, r.is_overnight), 0),
          byShift,
        };
      }),
    [weekInfo, roster]
  );

  // ---------- Actions ----------
  const refreshAll = () => {
    mutateRoster();
    mutateShifts();
  };

  const handleCellTap = async (staff, day) => {
    if (!paintMode) {
      setAssignModal({ open: true, assignment: null, username: staff.username, date: day.date });
      return;
    }
    const key = `${staff.username}|${day.date}`;
    if (busyCells[key]) return;
    const existing = cellsFor(staff.username, day.date);

    setBusyCells((b) => ({ ...b, [key]: true }));
    try {
      if (paintShiftId === ERASER) {
        await Promise.all(existing.map((a) => removeRosterShift(a.id)));
      } else if (paintShiftId) {
        const same = existing.find((a) => a.shift_id === paintShiftId);
        if (same) await removeRosterShift(same.id); // tap again to toggle off
        else await assignRosterShift({ username: staff.username, shiftId: paintShiftId, rosterDate: day.date });
      }
      await refreshAll();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("common.error_occurred", "An error occurred"));
    } finally {
      setBusyCells((b) => {
        const next = { ...b };
        delete next[key];
        return next;
      });
    }
  };

  const handleChipTap = (e, asgn, staff, day) => {
    e.stopPropagation();
    if (paintMode) {
      handleCellTap(staff, day);
      return;
    }
    setAssignModal({ open: true, assignment: asgn, username: asgn.username, date: asgn.roster_date });
  };

  const handleDrop = async (e, staff, day) => {
    e.preventDefault();
    setDragOverCell(null);
    let payload;
    try {
      payload = JSON.parse(e.dataTransfer.getData("application/x-roster"));
    } catch {
      return;
    }
    if (!payload || (payload.username === staff.username && payload.roster_date === day.date)) return;
    const copy = e.ctrlKey || e.altKey || e.metaKey;
    try {
      if (copy) {
        await bulkAssignRoster([{ username: staff.username, shiftId: payload.shift_id, rosterDate: day.date, notes: payload.notes }]);
        toast.success(t("shift_roster.shift_copied", "Shift copied"));
      } else {
        await updateRosterShift(payload.id, { username: staff.username, rosterDate: day.date });
        toast.success(t("shift_roster.shift_moved", "Shift moved"));
      }
      refreshAll();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("common.error_occurred", "An error occurred"));
    }
  };

  const handleCopyPreviousWeek = async () => {
    const prevMonday = new Date(weekInfo.monday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    if (!window.confirm(t("shift_roster.confirm_copy_week", "Copy all shift assignments from the previous week into this week?"))) return;
    try {
      const res = await copyWeeklyRoster({ fromStartDate: formatLocalDate(prevMonday), toStartDate: weekInfo.startDate });
      if (res.data?.copied === 0) toast(t("shift_roster.nothing_to_copy", "Previous week has no shifts to copy."));
      else toast.success(t("shift_roster.week_copied_count", "Copied {{count}} shifts from last week", { count: res.data?.copied }));
      refreshAll();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("shift_roster.copy_failed", "Failed to copy schedule"));
    }
  };

  const handleClearRange = async (username = null, staffName = null) => {
    const msg = username
      ? t("shift_roster.confirm_clear_staff_week", "Remove all of {{name}}'s shifts for this week?", { name: staffName })
      : t("shift_roster.confirm_clear_week", "Remove ALL shifts for this week? This cannot be undone.");
    if (!window.confirm(msg)) return;
    try {
      const res = await clearRosterRange({ startDate: weekInfo.startDate, endDate: weekInfo.endDate, username });
      toast.success(t("shift_roster.shifts_removed_count", "Removed {{count}} shifts", { count: res.data?.removed ?? 0 }));
      refreshAll();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("common.error_occurred", "An error occurred"));
    }
  };

  const handleJumpToDate = (value) => {
    if (!value) return;
    setWeekOffset(weekOffsetForDate(parseLocalDate(value)));
  };

  // ---------- Templates tab actions ----------
  const handleDeleteShift = async (id) => {
    if (!window.confirm(t("shift_roster.confirm_delete_shift", "Are you sure you want to delete this shift template?"))) return;
    try {
      await deleteShift(id);
      toast.success(t("shift_roster.shift_deleted", "Shift deleted"));
      mutateShifts();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("shift_roster.cannot_delete_active_shift", "Cannot delete active shift"));
    }
  };

  const handleToggleShiftActive = async (shift) => {
    try {
      await updateShift(shift.id, { ...shift, is_active: !shift.is_active });
      mutateShifts();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("common.error_occurred", "An error occurred"));
    }
  };

  const handleDuplicateShift = async (shift) => {
    try {
      await addShift({ ...shift, name: `${shift.name} (${t("shift_roster.copy_suffix", "copy")})` });
      toast.success(t("shift_roster.shift_created", "Shift created successfully"));
      mutateShifts();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("common.error_occurred", "An error occurred"));
    }
  };

  const tabs = [
    { key: "roster", icon: IconCalendar, label: t("shift_roster.weekly_roster", "Weekly Roster") },
    { key: "shifts", icon: IconClock, label: t("shift_roster.shift_templates", "Shift Templates") },
    { key: "settings", icon: IconSettings, label: t("shift_roster.settings", "Settings") },
  ];

  return (
    <Page className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto space-y-5">
      {/* Top Header & Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <IconCalendar className="text-restro-green" size={32} />
            {t("navbar.shift_roster", "Staff Roster & Shifts")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("shift_roster.subtitle", "Schedule staff shifts, enforce strict login hours, and manage store operational rosters.")}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
          {tabs.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={clsx(
                "px-4 rounded-xl text-sm font-bold transition cursor-pointer select-none touch-manipulation min-h-[42px] flex items-center gap-2 whitespace-nowrap active:scale-95",
                activeTab === key
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              <Icon size={17} />
              {label}
              {key === "shifts" && shifts.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200">{shifts.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: WEEKLY ROSTER */}
      {activeTab === "roster" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
            <div className="flex items-center gap-2 flex-wrap">
              <ToolbarIconButton onClick={() => setWeekOffset((p) => p - 1)} title={t("shift_roster.previous_week", "Previous Week")}>
                <IconChevronLeft size={20} />
              </ToolbarIconButton>
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                disabled={weekOffset === 0}
                className="px-4 h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-default transition active:scale-95 cursor-pointer"
              >
                {t("shift_roster.today", "This Week")}
              </button>
              <ToolbarIconButton onClick={() => setWeekOffset((p) => p + 1)} title={t("shift_roster.next_week", "Next Week")}>
                <IconChevronRight size={20} />
              </ToolbarIconButton>
              <button
                type="button"
                onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
                className="relative ml-1 h-[42px] px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 font-extrabold text-base text-slate-800 dark:text-white cursor-pointer active:scale-95 transition"
                title={t("shift_roster.jump_to_date", "Jump to date")}
              >
                <IconCalendarEvent size={18} className="text-slate-400" />
                {weekInfo.label}
                <input
                  ref={dateInputRef}
                  type="date"
                  tabIndex={-1}
                  className="absolute inset-0 opacity-0 pointer-events-none"
                  value={weekInfo.startDate}
                  onChange={(e) => handleJumpToDate(e.target.value)}
                />
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("shift_roster.search_staff", "Search staff...")}
                  className="h-[42px] w-44 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-restro-green"
                />
              </div>
              <button
                type="button"
                onClick={() => setPaintMode((v) => !v)}
                className={clsx(
                  "h-[42px] px-4 rounded-xl border text-sm font-bold flex items-center gap-2 transition active:scale-95 cursor-pointer",
                  paintMode
                    ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
                title={t("shift_roster.quick_fill_hint", "Pick a shift, then tap cells to fill the roster fast")}
              >
                <IconBrush size={17} />
                <span className="hidden sm:inline">{t("shift_roster.quick_fill", "Quick Fill")}</span>
              </button>
              <button
                type="button"
                onClick={handleCopyPreviousWeek}
                className="h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <IconCopy size={17} />
                <span className="hidden sm:inline">{t("shift_roster.copy_last_week", "Copy Last Week")}</span>
              </button>
              <ToolbarIconButton
                onClick={() => downloadRosterCsv({ weekInfo, staff: visibleStaff, cellsFor, hoursFor })}
                title={t("shift_roster.export_csv", "Export CSV")}
              >
                <IconDownload size={18} />
              </ToolbarIconButton>
              <ToolbarIconButton onClick={() => window.print()} title={t("shift_roster.print", "Print roster")}>
                <IconPrinter size={18} />
              </ToolbarIconButton>
              <ToolbarIconButton
                onClick={() => handleClearRange()}
                disabled={roster.length === 0}
                title={t("shift_roster.clear_week", "Clear week")}
                danger
              >
                <IconClearAll size={18} />
              </ToolbarIconButton>
              <button
                type="button"
                onClick={() => setAssignModal({ open: true, assignment: null, username: null, date: null })}
                className="h-[42px] px-4 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white text-sm font-bold flex items-center gap-2 transition active:scale-95 cursor-pointer shadow-sm"
              >
                <IconPlus size={17} />
                <span>{t("shift_roster.assign_shift", "Assign Shift")}</span>
              </button>
            </div>
          </div>

          {/* Print-only title */}
          <div className="hidden print:block text-xl font-extrabold text-black">
            {t("navbar.shift_roster", "Staff Roster & Shifts")} — {weekInfo.label}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
            <StatCard
              icon={IconClockHour4}
              tone="emerald"
              label={t("shift_roster.stat_scheduled_hours", "Scheduled hours")}
              value={formatHours(stats.totalMins)}
              sub={t("shift_roster.stat_shift_count", "{{count}} shifts", { count: stats.shiftCount })}
            />
            <StatCard
              icon={IconUserCheck}
              tone="blue"
              label={t("shift_roster.stat_staff_scheduled", "Staff scheduled")}
              value={`${stats.scheduledStaff}/${staffList.length}`}
              sub={t("shift_roster.stat_unscheduled", "{{count}} with no shifts", { count: staffList.length - stats.scheduledStaff })}
            />
            <StatCard
              icon={IconAlertTriangle}
              tone={stats.overtime > 0 || conflictIds.size > 0 ? "amber" : "slate"}
              label={t("shift_roster.stat_warnings", "Warnings")}
              value={stats.overtime + conflictIds.size}
              sub={t("shift_roster.stat_warnings_sub", "{{overtime}} over {{limit}}h · {{overlaps}} overlaps", {
                overtime: stats.overtime,
                limit: weeklyLimitMins / 60,
                overlaps: conflictIds.size,
              })}
            />
            <StatCard
              icon={IconCalendarOff}
              tone={stats.openDays > 0 ? "rose" : "slate"}
              label={t("shift_roster.stat_open_days", "Uncovered days")}
              value={stats.openDays}
              sub={t("shift_roster.stat_open_days_sub", "Days with nobody scheduled")}
            />
          </div>

          {/* Quick fill palette */}
          {paintMode && (
            <div className="flex items-center gap-2 p-2 pl-4 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white overflow-x-auto print:hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap mr-1">
                {t("shift_roster.tap_cells_with", "Tap cells with")}
              </span>
              {activeShifts.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setPaintShiftId(s.id)}
                  className={clsx(
                    "h-[42px] px-3 rounded-xl flex items-center gap-2 text-sm font-bold whitespace-nowrap transition active:scale-95 cursor-pointer border-2",
                    paintShiftId === s.id ? "bg-white text-slate-900" : "border-transparent hover:bg-white/10"
                  )}
                  style={paintShiftId === s.id ? { borderColor: s.color } : undefined}
                >
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                  <span className="text-[11px] font-mono opacity-60">{s.start_time}</span>
                </button>
              ))}
              {activeShifts.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShiftModal({ open: true, shift: null })}
                  className="h-[42px] px-3 rounded-xl text-sm font-bold hover:bg-white/10 flex items-center gap-1.5 cursor-pointer"
                >
                  <IconPlus size={16} /> {t("shift_roster.create_shift_first", "Create Shift Template")}
                </button>
              )}
              <span className="w-px h-6 bg-white/20 mx-1" />
              <button
                type="button"
                onClick={() => setPaintShiftId(ERASER)}
                className={clsx(
                  "h-[42px] px-3 rounded-xl flex items-center gap-2 text-sm font-bold whitespace-nowrap transition active:scale-95 cursor-pointer",
                  paintShiftId === ERASER ? "bg-rose-500 text-white" : "hover:bg-white/10"
                )}
              >
                <IconEraser size={17} /> {t("shift_roster.eraser", "Eraser")}
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setPaintMode(false)}
                className="h-[42px] px-4 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-sm font-bold flex items-center gap-1.5 whitespace-nowrap active:scale-95 cursor-pointer"
              >
                <IconCheck size={16} /> {t("common.done", "Done")}
              </button>
            </div>
          )}

          {/* Grid */}
          <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm print:overflow-visible print:shadow-none">
            <table className="w-full border-collapse min-w-[1040px] print:min-w-0 table-fixed">
              <colgroup>
                <col className="w-[240px]" />
                {weekInfo.days.map((d) => (
                  <col key={d.date} />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                  <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-800 py-3 px-4 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        {t("shift_roster.staff_member", "Staff Member")}
                      </span>
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 cursor-pointer print:hidden">
                        <input
                          type="checkbox"
                          checked={scheduledOnly}
                          onChange={(e) => setScheduledOnly(e.target.checked)}
                          className="checkbox checkbox-xs"
                        />
                        {t("shift_roster.scheduled_only", "Scheduled only")}
                      </label>
                    </div>
                  </th>
                  {weekInfo.days.map((day) => (
                    <th
                      key={day.date}
                      className={clsx(
                        "py-2.5 px-2 text-center border-l border-slate-200 dark:border-slate-800",
                        day.isToday && "bg-emerald-50 dark:bg-emerald-950/30"
                      )}
                    >
                      <div
                        className={clsx(
                          "text-[11px] font-extrabold uppercase tracking-wider",
                          day.isToday ? "text-restro-green" : day.isWeekend ? "text-slate-400" : "text-slate-600 dark:text-slate-300"
                        )}
                      >
                        {day.dayName}
                      </div>
                      <div
                        className={clsx(
                          "mx-auto mt-1 w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold",
                          day.isToday ? "bg-restro-green text-white" : "text-slate-800 dark:text-slate-100"
                        )}
                      >
                        {day.dayNum}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isUsersLoading || isRosterLoading ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                        <span className="loading loading-spinner loading-md text-restro-green"></span>
                        <span className="text-xs font-medium">{t("common.loading", "Loading roster & staff...")}</span>
                      </div>
                    </td>
                  </tr>
                ) : staffList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                        <IconUsers className="text-slate-300 dark:text-slate-600" size={44} />
                        <p className="font-semibold text-slate-700 dark:text-slate-200">{t("shift_roster.no_staff_found", "No staff accounts found.")}</p>
                        <p className="text-xs text-slate-400">{t("shift_roster.no_staff_desc", "Add staff members in the Staff & Users page to assign shifts.")}</p>
                        <Link
                          to="/dashboard/users"
                          className="mt-2 inline-flex items-center gap-1.5 min-h-[42px] px-4 rounded-xl text-sm font-bold text-restro-green bg-restro-green-10 hover:bg-restro-green hover:text-white transition cursor-pointer"
                        >
                          <IconUser size={16} />
                          {t("shift_roster.go_to_users", "Go to Staff & Users →")}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : visibleStaff.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                      {t("shift_roster.no_staff_match", "No staff match your filters.")}
                    </td>
                  </tr>
                ) : (
                  visibleStaff.map((staff) => {
                    const mins = hoursFor(staff.username);
                    const pct = Math.min(100, (mins / weeklyLimitMins) * 100);
                    const over = mins > weeklyLimitMins;
                    return (
                      <tr key={staff.username} className="group/row">
                        {/* Staff column */}
                        <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 py-3 px-4 align-middle border-r border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                            {staff.photo ? (
                              <img src={staff.photo} alt={staff.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-10 h-10 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs">
                                {initials(staff.name)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-slate-900 dark:text-white truncate" title={staff.name}>
                                {staff.name}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                                <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{staff.designation || staff.role}</span>
                                {staff.role === "admin" && (
                                  <span className="shrink-0 text-[9px] uppercase font-bold tracking-wider px-1.5 py-px rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <div className="mt-1.5 flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div className={clsx("h-full rounded-full", over ? "bg-amber-500" : "bg-restro-green")} style={{ width: `${pct}%` }} />
                                </div>
                                <span className={clsx("text-[11px] font-bold tabular-nums", over ? "text-amber-600" : "text-slate-500 dark:text-slate-400")}>
                                  {formatHours(mins)}
                                </span>
                              </div>
                            </div>
                            {mins > 0 && (
                              <button
                                type="button"
                                onClick={() => handleClearRange(staff.username, staff.name)}
                                className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 opacity-60 group-hover/row:opacity-100 transition active:scale-95 cursor-pointer print:hidden"
                                title={t("shift_roster.clear_staff_week", "Clear this staff member's week")}
                              >
                                <IconX size={15} />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Day cells */}
                        {weekInfo.days.map((day) => {
                          const key = `${staff.username}|${day.date}`;
                          const assignments = cellsFor(staff.username, day.date);
                          const busy = !!busyCells[key];
                          return (
                            <td
                              key={day.date}
                              onClick={() => handleCellTap(staff, day)}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = e.ctrlKey || e.altKey || e.metaKey ? "copy" : "move";
                                if (dragOverCell !== key) setDragOverCell(key);
                              }}
                              onDragLeave={() => setDragOverCell((c) => (c === key ? null : c))}
                              onDrop={(e) => handleDrop(e, staff, day)}
                              className={clsx(
                                "p-1.5 align-top border-l border-slate-100 dark:border-slate-800 cursor-pointer transition-colors",
                                day.isToday && "bg-emerald-50/40 dark:bg-emerald-950/10",
                                day.isPast && !day.isToday && "bg-slate-50/50 dark:bg-slate-900/50",
                                dragOverCell === key && "!bg-emerald-100/70 dark:!bg-emerald-900/30",
                                paintMode && "hover:bg-slate-100 dark:hover:bg-slate-800"
                              )}
                            >
                              <div className={clsx("min-h-[64px] h-full flex flex-col gap-1.5", busy && "opacity-50 pointer-events-none")}>
                                {assignments.map((asgn) => (
                                  <ShiftChip
                                    key={asgn.id}
                                    asgn={asgn}
                                    conflict={conflictIds.has(asgn.id)}
                                    draggable={!paintMode}
                                    onClick={(e) => handleChipTap(e, asgn, staff, day)}
                                    t={t}
                                  />
                                ))}
                                {assignments.length === 0 ? (
                                  <div className="flex-1 min-h-[56px] rounded-xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:border-restro-green hover:text-restro-green hover:bg-restro-green-10 transition print:border-none">
                                    {busy ? <span className="loading loading-spinner loading-xs" /> : <IconPlus size={18} className="print:hidden" />}
                                  </div>
                                ) : (
                                  !paintMode && (
                                    <div className="h-7 rounded-lg flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-restro-green hover:bg-restro-green-10 transition print:hidden">
                                      <IconPlus size={14} />
                                    </div>
                                  )
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Coverage footer */}
              {visibleStaff.length > 0 && !isRosterLoading && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                    <td className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800 py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      {t("shift_roster.daily_coverage", "Daily coverage")}
                    </td>
                    {dayCoverage.map((c) => (
                      <td key={c.date} className="py-2.5 px-2 border-l border-slate-200 dark:border-slate-700 align-top">
                        <div className="flex items-baseline justify-center gap-1">
                          <span className={clsx("text-lg font-extrabold", c.headcount === 0 ? "text-rose-500" : "text-slate-900 dark:text-white")}>
                            {c.headcount}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {t("shift_roster.staff_short", "staff")} · {formatHours(c.mins)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                          {shifts
                            .filter((s) => c.byShift[s.id])
                            .map((s) => (
                              <span
                                key={s.id}
                                title={s.name}
                                className="inline-flex items-center gap-1 px-1.5 h-5 rounded-md text-[10px] font-bold"
                                style={{ backgroundColor: `${s.color}1f`, color: s.color }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                                {c.byShift[s.id]}
                              </span>
                            ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400 px-1">
            {activeShifts.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="font-semibold text-slate-700 dark:text-slate-200">{s.name}</span>
                <span className="font-mono">{s.start_time}–{s.end_time}</span>
              </span>
            ))}
            <span className="hidden lg:inline-flex items-center gap-1.5 ml-auto print:hidden">
              {t("shift_roster.drag_hint", "Drag a shift to move it · hold Ctrl/Alt to copy")}
            </span>
          </div>
        </div>
      )}

      {/* TAB 2: SHIFT TEMPLATES */}
      {activeTab === "shifts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("shift_roster.shift_templates_title", "Configured Shifts")}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("shift_roster.shift_templates_desc", "Reusable shift blocks used to build the weekly roster.")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShiftModal({ open: true, shift: null })}
              className="min-h-[42px] px-4 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white text-sm font-bold flex items-center gap-2 transition active:scale-95 cursor-pointer shadow-sm"
            >
              <IconPlus size={18} />
              <span>{t("shift_roster.add_new_shift", "Add Shift Template")}</span>
            </button>
          </div>

          {shifts.length === 0 ? (
            <div className="py-16 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center gap-3 text-center">
              <IconClock size={44} className="text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-700 dark:text-slate-200">{t("shift_roster.no_shifts_yet", "No shift templates created yet.")}</p>
              <button
                type="button"
                onClick={() => setShiftModal({ open: true, shift: null })}
                className="min-h-[42px] px-4 rounded-xl text-sm font-bold text-restro-green bg-restro-green-10 hover:bg-restro-green hover:text-white transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <IconPlus size={16} /> {t("shift_roster.create_shift_first", "Create Shift Template")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {shifts.map((shift) => (
                <ShiftTemplateCard
                  key={shift.id}
                  shift={shift}
                  t={t}
                  onEdit={() => setShiftModal({ open: true, shift })}
                  onDelete={() => handleDeleteShift(shift.id)}
                  onDuplicate={() => handleDuplicateShift(shift)}
                  onToggleActive={() => handleToggleShiftActive(shift)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SETTINGS */}
      {activeTab === "settings" && <ShiftSettingsPanel settings={shiftSettings} onSaved={mutateSettings} t={t} />}

      <ShiftTemplateModal
        open={shiftModal.open}
        shift={shiftModal.shift}
        onClose={() => setShiftModal({ open: false, shift: null })}
        onSaved={refreshAll}
      />

      <RosterAssignModal
        open={assignModal.open}
        assignment={assignModal.assignment}
        initialUsername={assignModal.username}
        initialDate={assignModal.date}
        shifts={shifts}
        staffList={staffList}
        weekInfo={weekInfo}
        roster={[...prevRoster, ...roster]}
        onClose={() => setAssignModal({ open: false, assignment: null, username: null, date: null })}
        onSaved={refreshAll}
        onCreateShift={() => {
          setAssignModal({ open: false, assignment: null, username: null, date: null });
          setShiftModal({ open: true, shift: null });
        }}
      />
    </Page>
  );
}

function ToolbarIconButton({ children, onClick, title, disabled, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={clsx(
        "w-[42px] h-[42px] shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
        danger
          ? "text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
      )}
    >
      {children}
    </button>
  );
}

const STAT_TONES = {
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
  slate: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

function StatCard({ icon: Icon, tone, label, value, sub }) {
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
      <div className={clsx("w-11 h-11 shrink-0 rounded-xl flex items-center justify-center", STAT_TONES[tone])}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">{label}</div>
        <div className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">{value}</div>
        <div className="text-[11px] text-slate-400 truncate">{sub}</div>
      </div>
    </div>
  );
}

function ShiftChip({ asgn, conflict, draggable, onClick, t }) {
  const color = asgn.shift_color || "#3B82F6";
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-roster", JSON.stringify(asgn));
        e.dataTransfer.effectAllowed = "copyMove";
      }}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick(e)}
      style={{ backgroundColor: `${color}14`, borderLeftColor: color }}
      className={clsx(
        "relative text-left px-2 py-1.5 rounded-xl border-l-4 hover:shadow-md transition active:scale-[0.98] cursor-pointer select-none",
        conflict && "ring-2 ring-amber-400"
      )}
      title={asgn.notes || undefined}
    >
      <div className="flex items-center gap-1">
        <span className="text-xs font-extrabold truncate text-slate-800 dark:text-slate-100">{asgn.shift_name}</span>
        {conflict && <IconAlertTriangle size={12} className="text-amber-500 shrink-0" title={t("shift_roster.overlap_warning", "Overlapping shifts")} />}
        {!!asgn.is_overnight && <IconMoon size={12} className="text-purple-500 shrink-0" />}
      </div>
      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 leading-tight">
        {asgn.start_time}–{asgn.end_time}
      </div>
      {asgn.notes && (
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 truncate">
          <IconNote size={11} className="shrink-0" />
          <span className="truncate">{asgn.notes}</span>
        </div>
      )}
    </div>
  );
}

function ShiftTemplateCard({ shift, t, onEdit, onDelete, onDuplicate, onToggleActive }) {
  const mins = shiftDurationMinutes(shift.start_time, shift.end_time, shift.is_overnight);
  const startPct = (timeToMinutes(shift.start_time) / 1440) * 100;
  const widthPct = (mins / 1440) * 100;
  const segments =
    startPct + widthPct > 100
      ? [
          [startPct, 100 - startPct],
          [0, startPct + widthPct - 100],
        ]
      : [[startPct, widthPct]];

  return (
    <div
      className={clsx(
        "p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition flex flex-col",
        !shift.is_active && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: shift.color }}>
            {shift.is_overnight ? <IconMoon size={18} /> : <IconSun size={18} />}
          </span>
          <div className="min-w-0">
            <div className="text-base font-extrabold text-slate-900 dark:text-white truncate">{shift.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {formatHours(mins)} · {shift.is_overnight ? t("shift_roster.crosses_midnight", "Crosses Midnight (Next Day)") : t("shift_roster.same_day", "Same-day Shift")}
            </div>
          </div>
        </div>
        <input type="checkbox" checked={!!shift.is_active} onChange={onToggleActive} className="toggle toggle-success toggle-sm mt-1" title={t("common.active", "Active")} />
      </div>

      <div className="mt-4 text-2xl font-black font-mono text-slate-900 dark:text-white">
        {shift.start_time} – {shift.end_time}
      </div>

      {/* 24h timeline */}
      <div className="mt-3">
        <div className="relative h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          {segments.map(([left, width], i) => (
            <div key={i} className="absolute top-0 h-full rounded-full" style={{ left: `${left}%`, width: `${width}%`, backgroundColor: shift.color }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] font-mono text-slate-400">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-bold text-slate-700 dark:text-slate-200">{shift.assignment_count || 0}</span>{" "}
          {t("shift_roster.scheduled_assignments", "assignments")}
        </span>
        <div className="flex items-center gap-1">
          <CardIconButton onClick={onDuplicate} title={t("shift_roster.duplicate", "Duplicate")}>
            <IconCopy size={17} />
          </CardIconButton>
          <CardIconButton onClick={onEdit} title={t("common.edit", "Edit")}>
            <IconEdit size={17} />
          </CardIconButton>
          <CardIconButton onClick={onDelete} title={t("common.delete", "Delete")} danger>
            <IconTrash size={17} />
          </CardIconButton>
        </div>
      </div>
    </div>
  );
}

function CardIconButton({ children, onClick, title, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={clsx(
        "w-[42px] h-[42px] rounded-xl flex items-center justify-center transition active:scale-95 cursor-pointer",
        danger ? "text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
      )}
    >
      {children}
    </button>
  );
}

function ShiftSettingsPanel({ settings, onSaved, t }) {
  const [graceBefore, setGraceBefore] = useState(15);
  const [graceAfter, setGraceAfter] = useState(30);
  const [enforcementEnabled, setEnforcementEnabled] = useState(true);
  const [weeklyLimit, setWeeklyLimit] = useState(48);
  const [saving, setSaving] = useState(false);

  // Sync once the settings request resolves (the hook returns defaults first)
  const settingsKey = JSON.stringify(settings || {});
  useEffect(() => {
    if (!settings) return;
    setGraceBefore(settings.shift_grace_before_mins ?? 15);
    setGraceAfter(settings.shift_grace_after_mins ?? 30);
    setEnforcementEnabled(settings.is_shift_enforcement_enabled !== 0);
    setWeeklyLimit(settings.weekly_hours_limit ?? 48);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsKey]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateShiftSettings({
        shift_grace_before_mins: graceBefore,
        shift_grace_after_mins: graceAfter,
        is_shift_enforcement_enabled: enforcementEnabled ? 1 : 0,
        weekly_hours_limit: weeklyLimit,
      });
      toast.success(t("shift_roster.settings_saved", "Shift settings saved"));
      onSaved();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("common.error_occurred", "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  // Live example: 08:00–16:00 shift
  const fmt = (m) => {
    const x = ((m % 1440) + 1440) % 1440;
    return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
  };
  const exampleStart = 8 * 60;
  const exampleEnd = 16 * 60;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t("shift_roster.login_policy_settings", "Shift & Login Enforcement Settings")}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t("shift_roster.settings_desc", "Configure buffer times allowing staff to prepare cash registers before start and reconcile orders after shift.")}
          </p>
        </div>

        <label className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 cursor-pointer">
          <div className="flex items-start gap-3">
            <IconShieldLock size={22} className="text-restro-green shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{t("shift_roster.enforce_shift_login", "Strict Shift Login Enforcement")}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t("shift_roster.enforce_shift_login_desc", "Block staff from logging in outside their rostered shifts unless authorized by Manager PIN.")}
              </div>
            </div>
          </div>
          <input type="checkbox" checked={enforcementEnabled} onChange={(e) => setEnforcementEnabled(e.target.checked)} className="toggle toggle-success" />
        </label>

        <div className={clsx("grid grid-cols-1 sm:grid-cols-2 gap-4", !enforcementEnabled && "opacity-50")}>
          <NumberStepper
            label={t("shift_roster.grace_before", "Early Login Grace Period (Minutes Before Shift)")}
            hint={t("shift_roster.grace_before_hint", "Staff can log in this many minutes before shift begins to count cash float.")}
            value={graceBefore}
            onChange={setGraceBefore}
            min={0}
            max={120}
            step={5}
            unit={t("shift_roster.minutes_short", "min")}
          />
          <NumberStepper
            label={t("shift_roster.grace_after", "Post-Shift Grace Period (Minutes After Shift End)")}
            hint={t("shift_roster.grace_after_hint", "Staff have this many minutes after shift ends to finish bills before new orders require Manager PIN.")}
            value={graceAfter}
            onChange={setGraceAfter}
            min={0}
            max={180}
            step={5}
            unit={t("shift_roster.minutes_short", "min")}
          />
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <NumberStepper
            label={t("shift_roster.weekly_hours_limit", "Weekly Hours Limit")}
            hint={t("shift_roster.weekly_hours_limit_hint", "Staff scheduled above this many hours per week are flagged for overtime on the roster.")}
            value={weeklyLimit}
            onChange={setWeeklyLimit}
            min={1}
            max={168}
            step={1}
            unit={t("shift_roster.hours_short", "h")}
          />
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="min-h-[42px] px-6 rounded-xl bg-restro-green hover:bg-restro-green-button-hover disabled:opacity-60 text-white font-bold text-sm transition active:scale-95 cursor-pointer shadow-sm"
          >
            {t("common.save_settings", "Save Settings")}
          </button>
        </div>
      </div>

      {/* Live preview */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 h-fit">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t("shift_roster.preview", "Preview")}</div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t("shift_roster.preview_desc", "For a shift scheduled 08:00 – 16:00:")}
        </p>
        <div className="space-y-2">
          <PreviewRow color="bg-sky-500" label={t("shift_roster.preview_login_opens", "Login opens")} value={enforcementEnabled ? fmt(exampleStart - graceBefore) : "—"} />
          <PreviewRow color="bg-restro-green" label={t("shift_roster.preview_shift", "Shift")} value="08:00 – 16:00" />
          <PreviewRow color="bg-amber-500" label={t("shift_roster.preview_orders_locked", "New orders need PIN after")} value={enforcementEnabled ? fmt(exampleEnd + graceAfter) : "—"} />
        </div>
        {!enforcementEnabled && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t("shift_roster.enforcement_off_note", "Enforcement is off — staff can log in at any time.")}
          </p>
        )}
      </div>
    </div>
  );
}

function PreviewRow({ color, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
      <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <span className={clsx("w-2 h-2 rounded-full", color)} />
        {label}
      </span>
      <span className="font-mono font-bold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

function NumberStepper({ label, hint, value, onChange, min, max, step, unit }) {
  const clamp = (v) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(clamp(value - step))}
          className="w-[42px] h-12 rounded-xl border border-slate-200 dark:border-slate-700 text-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 cursor-pointer"
        >
          −
        </button>
        <div className="relative">
          <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
            className="w-24 h-12 pl-3 pr-9 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-center text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-restro-green"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{unit}</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(clamp(value + step))}
          className="w-[42px] h-12 rounded-xl border border-slate-200 dark:border-slate-700 text-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 cursor-pointer"
        >
          +
        </button>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}
