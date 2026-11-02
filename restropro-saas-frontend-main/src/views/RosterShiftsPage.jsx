import React, { useState, useMemo } from "react";
import Page from "../components/Page";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import {
  IconCalendar,
  IconClock,
  IconPlus,
  IconTrash,
  IconEdit,
  IconCopy,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
  IconCheck,
  IconX,
  IconSun,
  IconMoon,
  IconUser,
  IconUsers,
  IconRefresh,
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
  useShiftSettings,
  updateShiftSettings,
} from "../controllers/shift_roster.controller";
import { useUsers } from "../controllers/users.controller";
import clsx from "clsx";

// Helper to format Date object into YYYY-MM-DD in local timezone
function formatLocalDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper to get week start (Monday) and end (Sunday) for a given offset
function getWeekRange(offsetWeeks = 0) {
  const now = new Date();
  const todayStr = formatLocalDate(now);
  const day = now.getDay();
  // Adjust so Monday is 0 (Sunday is 6)
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = formatLocalDate(d);
    days.push({
      date: dateStr,
      dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
      formattedDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      isToday: dateStr === todayStr,
    });
  }

  return {
    startDate: formatLocalDate(monday),
    endDate: formatLocalDate(sunday),
    label: `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
    days,
    monday,
  };
}

const SHIFT_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EF4444", // Rose
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#64748B", // Slate
];

export default function RosterShiftsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("roster"); // 'roster' | 'shifts' | 'settings'
  const [weekOffset, setWeekOffset] = useState(0);

  // Week calculation
  const weekInfo = useMemo(() => getWeekRange(weekOffset), [weekOffset]);

  // SWR queries
  const { data: shifts = [], mutate: mutateShifts } = useShifts();
  const { data: roster = [], mutate: mutateRoster, isLoading: isRosterLoading } = useWeeklyRoster(weekInfo.startDate, weekInfo.endDate);
  const { data: shiftSettings, mutate: mutateSettings } = useShiftSettings();
  const { data: usersData, isLoading: isUsersLoading } = useUsers();

  const staffList = useMemo(() => {
    const users = Array.isArray(usersData) ? usersData : (usersData?.users || []);
    // Include all restaurant team members (staff and store admins), exclude group_owner/superadmin
    return users.filter((u) => u.role !== "group_owner" && u.role !== "superadmin");
  }, [usersData]);

  // Shift Form Modal
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [shiftForm, setShiftForm] = useState({
    name: "",
    start_time: "08:00",
    end_time: "16:00",
    is_overnight: false,
    color: "#3B82F6",
    is_active: true,
  });

  // Assign Shift Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null); // { username, date, staffName }
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [assignNotes, setAssignNotes] = useState("");

  // Settings State
  const [graceBefore, setGraceBefore] = useState(shiftSettings?.shift_grace_before_mins || 15);
  const [graceAfter, setGraceAfter] = useState(shiftSettings?.shift_grace_after_mins || 30);
  const [enforcementEnabled, setEnforcementEnabled] = useState(shiftSettings?.is_shift_enforcement_enabled !== 0);

  // Open Shift Create/Edit Modal
  const handleOpenShiftModal = (shift = null) => {
    if (shift) {
      setEditingShift(shift);
      setShiftForm({
        name: shift.name,
        start_time: shift.start_time,
        end_time: shift.end_time,
        is_overnight: !!shift.is_overnight,
        color: shift.color || "#3B82F6",
        is_active: !!shift.is_active,
      });
    } else {
      setEditingShift(null);
      setShiftForm({
        name: "",
        start_time: "08:00",
        end_time: "16:00",
        is_overnight: false,
        color: "#3B82F6",
        is_active: true,
      });
    }
    setShiftModalOpen(true);
  };

  // Save Shift
  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!shiftForm.name) {
      toast.error(t("shift_roster.shift_name_required", "Shift name is required"));
      return;
    }

    try {
      if (editingShift) {
        await updateShift(editingShift.id, shiftForm);
        toast.success(t("shift_roster.shift_updated", "Shift updated successfully"));
      } else {
        await addShift(shiftForm);
        toast.success(t("shift_roster.shift_created", "Shift created successfully"));
      }
      setShiftModalOpen(false);
      mutateShifts();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("common.error_occurred", "An error occurred"));
    }
  };

  // Delete Shift
  const handleDeleteShift = async (id) => {
    if (!window.confirm(t("shift_roster.confirm_delete_shift", "Are you sure you want to delete this shift template?"))) {
      return;
    }
    try {
      await deleteShift(id);
      toast.success(t("shift_roster.shift_deleted", "Shift deleted"));
      mutateShifts();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("shift_roster.cannot_delete_active_shift", "Cannot delete active shift"));
    }
  };

  // Open Assign Shift Modal
  const handleOpenAssignModal = (username, staffName, date) => {
    setSelectedCell({ username, staffName, date });
    setSelectedShiftId(shifts[0]?.id || "");
    setAssignNotes("");
    setAssignModalOpen(true);
  };

  // Submit Shift Assignment
  const handleAssignShift = async () => {
    if (!selectedShiftId) {
      toast.error(t("shift_roster.select_shift_error", "Please select a shift"));
      return;
    }

    try {
      await assignRosterShift({
        username: selectedCell.username,
        shiftId: selectedShiftId,
        rosterDate: selectedCell.date,
        notes: assignNotes,
      });
      toast.success(t("shift_roster.shift_assigned", "Shift assigned"));
      setAssignModalOpen(false);
      mutateRoster();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("common.error_occurred", "Failed to assign shift"));
    }
  };

  // Remove Roster Assignment
  const handleRemoveRosterAssignment = async (rosterId) => {
    try {
      await removeRosterShift(rosterId);
      toast.success(t("shift_roster.assignment_removed", "Assignment removed"));
      mutateRoster();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("common.error_occurred", "Failed to remove assignment"));
    }
  };

  // Copy Previous Week
  const handleCopyPreviousWeek = async () => {
    const prevMonday = new Date(weekInfo.monday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    const prevStart = formatLocalDate(prevMonday);

    if (!window.confirm(t("shift_roster.confirm_copy_week", "Copy all shift assignments from the previous week into this week?"))) {
      return;
    }

    try {
      const res = await copyWeeklyRoster({
        fromStartDate: prevStart,
        toStartDate: weekInfo.startDate,
      });
      toast.success(res.data?.message || t("shift_roster.week_copied", "Previous week schedule copied successfully!"));
      mutateRoster();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("shift_roster.copy_failed", "Failed to copy schedule"));
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    try {
      await updateShiftSettings({
        shift_grace_before_mins: graceBefore,
        shift_grace_after_mins: graceAfter,
        is_shift_enforcement_enabled: enforcementEnabled ? 1 : 0,
      });
      toast.success(t("shift_roster.settings_saved", "Shift settings saved"));
      mutateSettings();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("common.error_occurred", "Failed to save settings"));
    }
  };

  return (
    <Page className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <IconCalendar className="text-restro-green" size={32} />
            {t("navbar.shift_roster", "Staff Roster & Shifts")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("shift_roster.subtitle", "Schedule staff shifts, enforce strict login hours, and manage store operational rosters.")}
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab("roster")}
            className={clsx(
              "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer select-none touch-manipulation min-h-[42px] flex items-center gap-2",
              activeTab === "roster"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <IconCalendar size={17} />
            {t("shift_roster.weekly_roster", "Weekly Roster")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("shifts")}
            className={clsx(
              "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer select-none touch-manipulation min-h-[42px] flex items-center gap-2",
              activeTab === "shifts"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <IconClock size={17} />
            {t("shift_roster.shift_templates", "Shift Templates")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={clsx(
              "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer select-none touch-manipulation min-h-[42px] flex items-center gap-2",
              activeTab === "settings"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <IconSettings size={17} />
            {t("shift_roster.settings", "Settings")}
          </button>
        </div>
      </div>

      {/* TAB 1: WEEKLY ROSTER GRID */}
      {activeTab === "roster" && (
        <div className="space-y-4">
          {/* Week Navigation & Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeekOffset((prev) => prev - 1)}
                className="w-[42px] h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
                title={t("shift_roster.previous_week", "Previous Week")}
              >
                <IconChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="px-4 h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
              >
                {t("shift_roster.today", "This Week")}
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset((prev) => prev + 1)}
                className="w-[42px] h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
                title={t("shift_roster.next_week", "Next Week")}
              >
                <IconChevronRight size={20} />
              </button>
              <div className="ml-2 font-extrabold text-sm sm:text-base text-slate-800 dark:text-white">
                {weekInfo.label}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyPreviousWeek}
                className="min-h-[42px] h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition active:scale-95 cursor-pointer shadow-2xs"
              >
                <IconCopy size={16} />
                <span>{t("shift_roster.copy_last_week", "Copy Last Week")}</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenShiftModal()}
                className="min-h-[42px] h-[42px] px-4 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white text-xs font-bold flex items-center gap-2 transition active:scale-95 cursor-pointer shadow-sm"
              >
                <IconPlus size={16} />
                <span>{t("shift_roster.new_shift", "New Shift Template")}</span>
              </button>
            </div>
          </div>

          {/* Interactive Weekly Grid */}
          <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  <th className="py-4 px-4 text-left w-56">{t("shift_roster.staff_member", "Staff Member")}</th>
                  {weekInfo.days.map((day) => (
                    <th
                      key={day.date}
                      className={clsx(
                        "py-3 px-3 text-center border-l border-slate-200 dark:border-slate-800",
                        day.isToday && "bg-emerald-50/70 dark:bg-emerald-950/20 text-restro-green dark:text-emerald-400"
                      )}
                    >
                      <div className="text-[11px] font-extrabold">{day.dayName}</div>
                      <div className="text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5">{day.formattedDate}</div>
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
                        <p className="font-semibold text-slate-700 dark:text-slate-200">
                          {t("shift_roster.no_staff_found", "No staff accounts found.")}
                        </p>
                        <p className="text-xs text-slate-400">
                          {t("shift_roster.no_staff_desc", "Add staff members in the Staff & Users page to assign shifts.")}
                        </p>
                        <Link
                          to="/dashboard/users"
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-restro-green bg-restro-green-10 hover:bg-restro-green hover:text-white transition cursor-pointer"
                        >
                          <IconUser size={14} />
                          {t("shift_roster.go_to_users", "Go to Staff & Users →")}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  staffList.map((staff) => (
                    <tr key={staff.username} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      {/* Staff Info Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {staff.photo ? (
                            <img src={staff.photo} alt={staff.name} className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs">
                              {staff.name?.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {staff.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {staff.designation || staff.role}
                              </span>
                              {staff.role === "admin" && (
                                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                  Admin
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Day Columns */}
                      {weekInfo.days.map((day) => {
                        const assignments = roster.filter(
                          (r) => r.username === staff.username && r.roster_date === day.date
                        );

                        return (
                          <td
                            key={day.date}
                            className={clsx(
                              "p-2 text-center border-l border-slate-100 dark:border-slate-800/80 align-top",
                              day.isToday && "bg-emerald-50/30 dark:bg-emerald-950/10"
                            )}
                          >
                            <div className="min-h-[56px] flex flex-col gap-1.5 justify-center">
                              {assignments.map((asgn) => (
                                <div
                                  key={asgn.id}
                                  style={{ borderLeftColor: asgn.shift_color || "#3B82F6" }}
                                  className="group relative text-left p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-l-4 border shadow-2xs hover:shadow-xs transition"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-extrabold truncate text-slate-800 dark:text-slate-200">
                                      {asgn.shift_name}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveRosterAssignment(asgn.id)}
                                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                                      title={t("common.remove", "Remove")}
                                    >
                                      <IconX size={12} />
                                    </button>
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                                    {asgn.start_time} - {asgn.end_time}
                                    {asgn.is_overnight ? " 🌙" : ""}
                                  </div>
                                </div>
                              ))}

                              {/* Add Shift Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenAssignModal(staff.username, staff.name, day.date)}
                                className="w-full h-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-restro-green hover:bg-restro-green-10 text-slate-400 hover:text-restro-green flex items-center justify-center transition active:scale-95 cursor-pointer"
                                title={t("shift_roster.assign_shift", "Assign Shift")}
                              >
                                <IconPlus size={14} />
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SHIFT TEMPLATES */}
      {activeTab === "shifts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {t("shift_roster.shift_templates_title", "Configured Shifts")}
            </h2>
            <button
              type="button"
              onClick={() => handleOpenShiftModal()}
              className="min-h-[42px] h-[42px] px-4 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition active:scale-95 cursor-pointer shadow-sm"
            >
              <IconPlus size={18} />
              <span>{t("shift_roster.add_new_shift", "Add Shift Template")}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shifts.map((shift) => (
              <div
                key={shift.id}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      style={{ backgroundColor: `${shift.color}20`, color: shift.color, borderColor: `${shift.color}40` }}
                      className="px-3 py-1 rounded-xl text-xs font-extrabold border flex items-center gap-1.5"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: shift.color }} />
                      {shift.name}
                    </span>

                    <span
                      className={clsx(
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md",
                        shift.is_active
                          ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      )}
                    >
                      {shift.is_active ? t("common.active", "Active") : t("common.inactive", "Inactive")}
                    </span>
                  </div>

                  <div className="text-2xl font-black font-mono text-slate-900 dark:text-white flex items-baseline gap-2">
                    <span>{shift.start_time} - {shift.end_time}</span>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {shift.is_overnight ? (
                      <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-semibold">
                        <IconMoon size={14} /> {t("shift_roster.crosses_midnight", "Crosses Midnight (Next Day)")}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                        <IconSun size={14} /> {t("shift_roster.same_day", "Same-day Shift")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-mono">
                    {shift.assignment_count || 0} {t("shift_roster.scheduled_assignments", "assignments")}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenShiftModal(shift)}
                      className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
                      title={t("common.edit", "Edit")}
                    >
                      <IconEdit size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteShift(shift.id)}
                      className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition active:scale-95 cursor-pointer"
                      title={t("common.delete", "Delete")}
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SHIFT & LOGIN SETTINGS */}
      {activeTab === "settings" && (
        <div className="max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {t("shift_roster.login_policy_settings", "Shift & Login Enforcement Settings")}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t("shift_roster.settings_desc", "Configure buffer times allowing staff to prepare cash registers before start and reconcile orders after shift.")}
            </p>
          </div>

          <div className="space-y-4">
            {/* Global Shift Enforcement Toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {t("shift_roster.enforce_shift_login", "Strict Shift Login Enforcement")}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("shift_roster.enforce_shift_login_desc", "Block staff from logging in outside their rostered shifts unless authorized by Manager PIN.")}
                </div>
              </div>
              <input
                type="checkbox"
                checked={enforcementEnabled}
                onChange={(e) => setEnforcementEnabled(e.target.checked)}
                className="w-5 h-5 rounded text-restro-green focus:ring-restro-green cursor-pointer accent-restro-green"
              />
            </div>

            {/* Grace Window Before Shift */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {t("shift_roster.grace_before", "Early Login Grace Period (Minutes Before Shift)")}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={graceBefore}
                  onChange={(e) => setGraceBefore(Number(e.target.value))}
                  className="w-32 h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-restro-green"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t("shift_roster.grace_before_hint", "Staff can log in this many minutes before shift begins to count cash float.")}
                </span>
              </div>
            </div>

            {/* Grace Window After Shift */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {t("shift_roster.grace_after", "Post-Shift Grace Period (Minutes After Shift End)")}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={graceAfter}
                  onChange={(e) => setGraceAfter(Number(e.target.value))}
                  className="w-32 h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-restro-green"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t("shift_roster.grace_after_hint", "Staff have this many minutes after shift ends to finish bills before new orders require Manager PIN.")}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={handleSaveSettings}
              className="min-h-[42px] h-[42px] px-6 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white font-bold text-sm transition active:scale-95 cursor-pointer shadow-sm"
            >
              {t("common.save_settings", "Save Settings")}
            </button>
          </div>
        </div>
      )}

      {/* SHIFT CREATE / EDIT MODAL */}
      {shiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingShift ? t("shift_roster.edit_shift", "Edit Shift Template") : t("shift_roster.create_shift", "New Shift Template")}
              </h3>
              <button
                type="button"
                onClick={() => setShiftModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveShift} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t("shift_roster.shift_name", "Shift Name (e.g. Morning, Evening)")}
                </label>
                <input
                  type="text"
                  required
                  placeholder="Morning Shift"
                  value={shiftForm.name}
                  onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t("shift_roster.start_time", "Start Time")}
                  </label>
                  <input
                    type="time"
                    required
                    value={shiftForm.start_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                    className="w-full h-11 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t("shift_roster.end_time", "End Time")}
                  </label>
                  <input
                    type="time"
                    required
                    value={shiftForm.end_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                    className="w-full h-11 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Overnight Shift Toggle */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <IconMoon size={18} className="text-purple-500" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {t("shift_roster.crosses_midnight_label", "Crosses Midnight (Next Day)")}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {t("shift_roster.crosses_midnight_hint", "Shift ends the following morning (e.g. 18:00 - 02:00)")}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={shiftForm.is_overnight}
                  onChange={(e) => setShiftForm({ ...shiftForm, is_overnight: e.target.checked })}
                  className="w-4 h-4 rounded text-restro-green focus:ring-restro-green cursor-pointer accent-restro-green"
                />
              </div>

              {/* Color Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t("shift_roster.shift_badge_color", "Badge Color")}
                </label>
                <div className="flex items-center gap-2">
                  {SHIFT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setShiftForm({ ...shiftForm, color: c })}
                      style={{ backgroundColor: c }}
                      className={clsx(
                        "w-8 h-8 rounded-full transition active:scale-90 cursor-pointer flex items-center justify-center text-white",
                        shiftForm.color === c ? "ring-2 ring-offset-2 ring-restro-green scale-110" : ""
                      )}
                    >
                      {shiftForm.color === c && <IconCheck size={14} />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShiftModalOpen(false)}
                  className="min-h-[42px] h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
                >
                  {t("common.cancel", "Cancel")}
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] h-[42px] px-5 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-sm"
                >
                  {t("common.save", "Save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN SHIFT MODAL */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t("shift_roster.assign_shift_modal_title", "Assign Shift")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedCell?.staffName} • {selectedCell?.date}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t("shift_roster.select_shift_template", "Select Shift")}
                </label>
                {shifts.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t("shift_roster.no_shifts_yet", "No shift templates created yet.")}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setAssignModalOpen(false);
                        handleOpenShiftModal();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-restro-green bg-restro-green-10 hover:bg-restro-green hover:text-white transition cursor-pointer"
                    >
                      <IconPlus size={14} />
                      {t("shift_roster.create_shift_first", "Create Shift Template")}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {shifts.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedShiftId(s.id)}
                        className={clsx(
                          "w-full p-3 rounded-2xl border text-left transition active:scale-95 cursor-pointer flex items-center justify-between",
                          selectedShiftId === s.id
                            ? "border-restro-green bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-restro-green"
                            : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">{s.name}</div>
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              {s.start_time} - {s.end_time} {s.is_overnight ? "🌙" : ""}
                            </div>
                          </div>
                        </div>
                        {selectedShiftId === s.id && <IconCheck size={18} className="text-restro-green" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t("shift_roster.notes_optional", "Notes (Optional)")}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cashier station 1"
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="flex-1 min-h-[42px] h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
                >
                  {t("common.cancel", "Cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleAssignShift}
                  disabled={shifts.length === 0}
                  className={clsx(
                    "flex-1 min-h-[42px] h-[42px] rounded-xl text-white text-xs font-bold transition active:scale-95 shadow-sm",
                    shifts.length === 0
                      ? "bg-slate-300 dark:bg-slate-700 cursor-not-allowed text-slate-500"
                      : "bg-restro-green hover:bg-restro-green-button-hover cursor-pointer"
                  )}
                >
                  {t("common.assign", "Assign")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
