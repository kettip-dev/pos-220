import React, { useState, useMemo } from "react";
import Page from "../components/Page";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import {
  IconClock,
  IconCalendar,
  IconUserCheck,
  IconAlertCircle,
  IconShieldLock,
  IconFilter,
  IconDownload,
  IconCheck,
  IconX,
  IconHistory,
  IconSearch,
  IconPrinter,
  IconChevronLeft,
  IconChevronRight,
  IconEye,
  IconRefresh,
  IconUser,
  IconChecklist,
  IconArrowsSort,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { useAttendanceReport } from "../controllers/shift_roster.controller";
import { useUsers } from "../controllers/users.controller";
import clsx from "clsx";

export default function AttendancePage() {
  const { t } = useTranslation();

  // Date range state (default to current month)
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const monthStartStr = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  }, []);

  const [startDate, setStartDate] = useState(monthStartStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination & Selection State
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedRecord, setSelectedRecord] = useState(null);

  const { data: attendance = [], isLoading, mutate } = useAttendanceReport(startDate, endDate, selectedStaff);
  const { data: usersData } = useUsers();

  const staffList = useMemo(() => {
    const users = Array.isArray(usersData) ? usersData : (usersData?.users || []);
    return users.filter((u) => u.role !== "group_owner" && u.role !== "superadmin");
  }, [usersData]);

  // Aggregate stats across full fetched dataset
  const stats = useMemo(() => {
    let totalMinutes = 0;
    let lateCount = 0;
    let overrideCount = 0;
    let onDutyCount = 0;

    attendance.forEach((item) => {
      totalMinutes += item.duration_minutes || 0;
      if (item.status === "late") lateCount++;
      if (item.status === "override") overrideCount++;
      if (!item.clock_out_at) onDutyCount++;
    });

    const totalHours = (totalMinutes / 60).toFixed(1);

    return {
      totalShifts: attendance.length,
      totalHours,
      lateCount,
      overrideCount,
      onDutyCount,
    };
  }, [attendance]);

  // Client-side filtering (Search & Status)
  const filteredAttendance = useMemo(() => {
    return attendance.filter((rec) => {
      // Status filter
      if (statusFilter === "on_duty" && rec.clock_out_at) return false;
      if (statusFilter !== "all" && statusFilter !== "on_duty" && rec.status !== statusFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesStaff = (rec.staff_name || "").toLowerCase().includes(q);
        const matchesUsername = (rec.username || "").toLowerCase().includes(q);
        const matchesDesignation = (rec.staff_designation || "").toLowerCase().includes(q);
        const matchesShift = (rec.shift_name || "").toLowerCase().includes(q);
        const matchesManager = (rec.manager_name || "").toLowerCase().includes(q);
        const matchesNotes = (rec.notes || "").toLowerCase().includes(q);

        if (!matchesStaff && !matchesUsername && !matchesDesignation && !matchesShift && !matchesManager && !matchesNotes) {
          return false;
        }
      }

      return true;
    });
  }, [attendance, statusFilter, searchQuery]);

  // Pagination calculation
  const totalItems = filteredAttendance.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedAttendance = useMemo(() => {
    return filteredAttendance.slice(startIndex, endIndex);
  }, [filteredAttendance, startIndex, endIndex]);

  // Selection helpers
  const isAllCurrentPageSelected = paginatedAttendance.length > 0 && paginatedAttendance.every((r) => selectedIds.has(r.id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllCurrentPageSelected) {
        paginatedAttendance.forEach((r) => next.delete(r.id));
      } else {
        paginatedAttendance.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // CSV Export helper
  const handleExportCSV = (recordsToExport = null) => {
    const data = recordsToExport || (selectedIds.size > 0 ? attendance.filter((r) => selectedIds.has(r.id)) : filteredAttendance);

    if (data.length === 0) {
      toast.error(t("attendance.no_records_to_export", "No records to export"));
      return;
    }

    const headers = [
      "Staff Name",
      "Username",
      "Designation",
      "Shift",
      "Clock In",
      "Clock Out",
      "Duration (Mins)",
      "Status",
      "Manager Override",
      "Notes",
    ];

    const rows = data.map((r) => [
      `"${r.staff_name || ""}"`,
      `"${r.username || ""}"`,
      `"${r.staff_designation || ""}"`,
      `"${r.shift_name || "Unassigned"}"`,
      `"${r.clock_in_at || ""}"`,
      `"${r.clock_out_at || "In Progress"}"`,
      r.duration_minutes || 0,
      r.status,
      `"${r.manager_name || ""}"`,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Page className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
      {/* ── 1. Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <IconUserCheck className="text-emerald-600 dark:text-emerald-500" size={30} stroke={iconStroke} />
            {t("reports.staff_attendance", "Staff Attendance & Timesheets")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 mt-1">
            {t("attendance.subtitle", "Track staff clock-in/out timestamps, shift adherence, worked hours, and manager overrides.")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleExportCSV()}
            className="min-h-[38px] h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-neutral-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition active:scale-95 cursor-pointer shadow-2xs"
          >
            <IconDownload size={16} stroke={iconStroke} />
            <span>{t("common.export_csv", "Export CSV")}</span>
          </button>
          <button
            type="button"
            onClick={() => mutate()}
            className="min-h-[38px] h-[38px] px-3 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-600 dark:text-slate-300 flex items-center justify-center transition active:scale-95 cursor-pointer shadow-2xs"
            title={t("common.refresh", "Refresh")}
          >
            <IconRefresh size={16} stroke={iconStroke} />
          </button>
        </div>
      </div>

      {/* ── 2. Summary KPI Metric Cards (Section 6 Standard) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Total Shifts */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t("attendance.total_shifts", "Total Shifts")}
            </span>
            <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
              <IconHistory size={16} stroke={iconStroke} />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {stats.totalShifts}
          </div>
        </div>

        {/* Total Hours Worked */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t("attendance.total_hours_worked", "Hours Worked")}
            </span>
            <span className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <IconClock size={16} stroke={iconStroke} />
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">
            {stats.totalHours} <span className="text-xs font-normal text-slate-400">hrs</span>
          </div>
        </div>

        {/* Late Arrivals */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t("attendance.late_arrivals", "Late Arrivals")}
            </span>
            <span className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <IconAlertCircle size={16} stroke={iconStroke} />
            </span>
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2 tabular-nums">
            {stats.lateCount}
          </div>
        </div>

        {/* Manager Overrides */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t("attendance.manager_overrides", "Manager Overrides")}
            </span>
            <span className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <IconShieldLock size={16} stroke={iconStroke} />
            </span>
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2 tabular-nums">
            {stats.overrideCount}
          </div>
        </div>
      </div>

      {/* ── 3. Filter & Action Toolbar (Section 3 Standard) ── */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 py-1">
        {/* Left: Search Bar & Filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Real-time Search */}
          <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} stroke={iconStroke} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder={t("common.search", "Search staff, shift, notes...")}
              className="w-full min-h-[38px] pl-9 pr-8 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <IconX size={14} />
              </button>
            )}
          </div>

          {/* Date Pickers */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-700 px-2 py-1">
            <span className="text-[11px] font-bold text-slate-400">{t("common.from", "From:")}</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="h-7 text-xs font-medium bg-transparent text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            />
            <span className="text-slate-300 dark:text-neutral-700">|</span>
            <span className="text-[11px] font-bold text-slate-400">{t("common.to", "To:")}</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="h-7 text-xs font-medium bg-transparent text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            />
          </div>

          {/* Staff Filter Dropdown */}
          <select
            value={selectedStaff}
            onChange={(e) => {
              setSelectedStaff(e.target.value);
              setPage(1);
            }}
            className="min-h-[38px] px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            <option value="">{t("common.all_staff", "All Staff")}</option>
            {staffList.map((s) => (
              <option key={s.username} value={s.username}>
                {s.name} ({s.designation || s.role})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="min-h-[38px] px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="on_time">On Time</option>
            <option value="late">Late Arrival</option>
            <option value="override">Manager Override</option>
            <option value="early">Early Departure</option>
            <option value="on_duty">Currently On Duty</option>
          </select>
        </div>

        {/* Right: Print, Export & Inline Compact Pagination */}
        <div className="flex items-center gap-2 justify-end shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95 shadow-xs cursor-pointer"
            title="Print Table"
          >
            <IconPrinter size={16} stroke={iconStroke} />
          </button>

          <button
            type="button"
            onClick={() => handleExportCSV()}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95 shadow-xs cursor-pointer"
            title="Export CSV"
          >
            <IconDownload size={16} stroke={iconStroke} />
          </button>

          {/* Inline Compact Pagination */}
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-neutral-400 pl-2 border-l border-slate-200 dark:border-neutral-700">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={clsx(
                "flex items-center gap-0.5 hover:text-slate-900 dark:hover:text-white transition cursor-pointer",
                page <= 1 && "opacity-40 cursor-not-allowed hover:text-slate-600"
              )}
            >
              <IconChevronLeft size={14} stroke={iconStroke} />
              <span>Prev</span>
            </button>

            <span className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
              {totalItems > 0 ? `${startIndex + 1} - ${endIndex}` : "0 - 0"}
              <span className="text-slate-400 font-normal"> of {totalItems}</span>
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={clsx(
                "flex items-center gap-0.5 hover:text-slate-900 dark:hover:text-white transition cursor-pointer",
                page >= totalPages && "opacity-40 cursor-not-allowed hover:text-slate-600"
              )}
            >
              <span>Next</span>
              <IconChevronRight size={14} stroke={iconStroke} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Selection Action Strip (When rows are checked) ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <IconCheck size={16} />
            <span>{selectedIds.size} record{selectedIds.size > 1 ? "s" : ""} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExportCSV()}
              className="px-3 py-1 rounded-lg text-xs font-bold bg-white dark:bg-neutral-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100/50 transition cursor-pointer"
            >
              Export Selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* ── 4. Compact Data Table (Section 2 Flat Container) ── */}
      <div className="w-full overflow-x-auto border-t border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b]">
        <table className="w-full text-left border-collapse min-w-[950px]">
          {/* Table Header */}
          <thead>
            <tr className="border-b border-slate-200 dark:border-neutral-800 text-[13px] font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-[#18181b]">
              <th className="w-10 px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={isAllCurrentPageSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all rows"
                  className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                />
              </th>
              <th className="px-3 py-2.5">{t("attendance.staff_member", "Staff Member")}</th>
              <th className="px-3 py-2.5">{t("attendance.shift", "Scheduled Shift")}</th>
              <th className="px-3 py-2.5">{t("attendance.clock_in", "Clock In")}</th>
              <th className="px-3 py-2.5">{t("attendance.clock_out", "Clock Out")}</th>
              <th className="px-3 py-2.5 text-center">{t("attendance.duration", "Duration")}</th>
              <th className="px-3 py-2.5">{t("attendance.status", "Status")}</th>
              <th className="px-3 py-2.5">{t("attendance.override", "Manager Override")}</th>
              <th className="px-3 py-2.5">{t("attendance.notes", "Notes")}</th>
              <th className="px-3 py-2.5 text-right">{t("common.action", "Action")}</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="py-14 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                    <span className="loading loading-spinner loading-md text-emerald-600"></span>
                    <span className="text-xs font-medium">{t("common.loading", "Loading attendance records...")}</span>
                  </div>
                </td>
              </tr>
            ) : paginatedAttendance.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-sm text-slate-500 dark:text-neutral-400">
                  <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                    <IconUserCheck className="text-slate-300 dark:text-neutral-700" size={40} stroke={iconStroke} />
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      {t("attendance.no_records_found", "No attendance records found.")}
                    </p>
                    <p className="text-xs text-slate-400">
                      Adjust your date range or search query to find records.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedAttendance.map((rec) => {
                const isSelected = selectedIds.has(rec.id);
                const durationHrs = rec.duration_minutes ? (rec.duration_minutes / 60).toFixed(1) : "0";

                return (
                  <tr
                    key={rec.id}
                    className={clsx(
                      "hover:bg-slate-50/70 dark:hover:bg-neutral-800/40 transition text-xs sm:text-[13px]",
                      isSelected && "bg-emerald-50/40 dark:bg-emerald-950/20"
                    )}
                  >
                    {/* Checkbox */}
                    <td className="w-10 px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(rec.id)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                      />
                    </td>

                    {/* Staff Member */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-neutral-800 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-[11px] shrink-0">
                          {rec.staff_name?.slice(0, 2).toUpperCase() || "U"}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate">
                            {rec.staff_name}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-neutral-500 truncate">
                            {rec.staff_designation || rec.username}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Scheduled Shift */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {rec.shift_name || <span className="text-slate-400 font-normal italic">{t("attendance.unscheduled", "Unscheduled")}</span>}
                      </div>
                      {rec.shift_start_time && (
                        <div className="text-[11px] font-mono text-slate-400 dark:text-neutral-500">
                          {rec.shift_start_time} - {rec.shift_end_time}
                        </div>
                      )}
                    </td>

                    {/* Clock In */}
                    <td className="px-3 py-2.5 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {new Date(rec.clock_in_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                      <span className="font-bold text-slate-900 dark:text-white">
                        {new Date(rec.clock_in_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>

                    {/* Clock Out */}
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                      {rec.clock_out_at ? (
                        <span>
                          {new Date(rec.clock_out_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                          <span className="font-bold text-slate-900 dark:text-white">
                            {new Date(rec.clock_out_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </span>
                      ) : (
                        /* On Duty pulsing badge */
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {t("attendance.on_duty", "On Duty")}
                        </span>
                      )}
                    </td>

                    {/* Duration */}
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap tabular-nums">
                      {durationHrs} <span className="font-normal text-[11px] text-slate-400">hrs</span>
                    </td>

                    {/* Status Badge (Section 4 Standard) */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {rec.status === "on_time" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          On Time
                        </span>
                      )}

                      {rec.status === "late" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Late Arrival
                        </span>
                      )}

                      {rec.status === "override" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/60 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          Override
                        </span>
                      )}

                      {rec.status === "early" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          Early Leave
                        </span>
                      )}

                      {rec.status === "auto" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-slate-300 dark:border-neutral-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          Auto Log
                        </span>
                      )}
                    </td>

                    {/* Manager Override */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {rec.manager_name ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-400 text-xs">
                          <IconShieldLock size={14} />
                          {rec.manager_name}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-neutral-600">-</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-3 py-2.5 max-w-xs truncate text-slate-500 dark:text-neutral-400 text-xs">
                      {rec.notes || <span className="text-slate-300 dark:text-neutral-600">-</span>}
                    </td>

                    {/* Action Icon Button */}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedRecord(rec)}
                        className="w-8 h-8 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-slate-100 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95 cursor-pointer ml-auto"
                        title="View Details"
                      >
                        <IconEye size={15} stroke={iconStroke} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── 5. Bottom Pagination Bar (Section 5 Standard) ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2 px-1 text-xs text-slate-600 dark:text-neutral-400">
        <div className="text-slate-500 dark:text-neutral-400">
          {t("common.showing", "Showing")} {totalItems > 0 ? startIndex + 1 : 0} {t("common.to", "to")} {endIndex} {t("common.of", "of")}{" "}
          {totalItems} {t("common.entries", "entries")}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className={clsx(
              "flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition cursor-pointer font-medium",
              page <= 1 && "opacity-40 cursor-not-allowed hover:text-slate-600"
            )}
          >
            <IconChevronLeft size={14} stroke={iconStroke} />
            <span>{t("common.previous", "Previous")}</span>
          </button>

          <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded bg-slate-100 dark:bg-neutral-800">
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className={clsx(
              "flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition cursor-pointer font-medium",
              page >= totalPages && "opacity-40 cursor-not-allowed hover:text-slate-600"
            )}
          >
            <span>{t("common.next", "Next")}</span>
            <IconChevronRight size={14} stroke={iconStroke} />
          </button>
        </div>
      </div>

      {/* ── Detail Drawer / Modal ── */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Timesheet Details
                </h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  {selectedRecord.staff_name} • {selectedRecord.username}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Scheduled Shift</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {selectedRecord.shift_name || "Unscheduled"}
                  </div>
                  {selectedRecord.shift_start_time && (
                    <div className="text-[11px] font-mono text-slate-500">
                      {selectedRecord.shift_start_time} - {selectedRecord.shift_end_time}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Worked Duration</div>
                  <div className="font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 text-sm">
                    {selectedRecord.duration_minutes ? (selectedRecord.duration_minutes / 60).toFixed(1) : 0} hrs
                  </div>
                  <div className="text-[11px] text-slate-400">
                    ({selectedRecord.duration_minutes || 0} minutes)
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-b border-slate-100 dark:border-neutral-800 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Clock In Timestamp:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {new Date(selectedRecord.clock_in_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Clock Out Timestamp:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {selectedRecord.clock_out_at ? new Date(selectedRecord.clock_out_at).toLocaleString() : "Currently Active"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Adherence Status:</span>
                  <span className="font-bold capitalize text-slate-900 dark:text-white">
                    {selectedRecord.status}
                  </span>
                </div>
                {selectedRecord.manager_name && (
                  <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 font-semibold">
                    <span className="flex items-center gap-1"><IconShieldLock size={14} /> Authorized By:</span>
                    <span>{selectedRecord.manager_name}</span>
                  </div>
                )}
              </div>

              {selectedRecord.notes && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Notes / Reason</div>
                  <p className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-200">
                    {selectedRecord.notes}
                  </p>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="min-h-[38px] px-5 rounded-xl bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
