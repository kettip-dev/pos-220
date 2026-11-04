import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Page from "../components/Page";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import {
  IconClock,
  IconCalendar,
  IconUserCheck,
  IconUserX,
  IconAlertCircle,
  IconShieldLock,
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
  IconArrowRight,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { useAttendanceReport } from "../controllers/shift_roster.controller";
import { useUsers } from "../controllers/users.controller";
import { formatLocalDate } from "../components/roster/rosterUtils";
import { formatClockTime, formatShortDate, formatWeekday } from "../helpers/DateHelper";
import clsx from "clsx";

const STATUS_STYLES = {
  on_time: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/60", dot: "bg-emerald-500" },
  late: { badge: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/60", dot: "bg-amber-500" },
  early: { badge: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/60", dot: "bg-blue-500" },
  override: { badge: "bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800/60", dot: "bg-purple-500" },
  absent: { badge: "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800/60", dot: "bg-rose-500" },
  unscheduled: { badge: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-neutral-800 dark:text-slate-300 dark:border-neutral-700", dot: "bg-slate-400" },
  auto: { badge: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-neutral-800 dark:text-slate-300 dark:border-neutral-700", dot: "bg-slate-400" },
};

const formatHrs = (mins) => (Number(mins || 0) / 60).toFixed(1).replace(/\.0$/, "");

function dateRangeForPreset(preset) {
  const today = new Date();
  const start = new Date(today);
  if (preset === "week") {
    const day = today.getDay();
    start.setDate(today.getDate() + ((day === 0 ? -6 : 1) - day));
  } else if (preset === "month") {
    start.setDate(1);
  }
  return [formatLocalDate(start), formatLocalDate(today)];
}

export default function AttendancePage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  // Date range state (default to current month, in local time)
  const [startDate, setStartDate] = useState(() => dateRangeForPreset("month")[0]);
  const [endDate, setEndDate] = useState(() => dateRangeForPreset("month")[1]);
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

  const statusLabel = (status) =>
    ({
      on_time: t("attendance.status_on_time", "On Time"),
      late: t("attendance.status_late", "Late"),
      early: t("attendance.status_early", "Left Early"),
      override: t("attendance.status_override", "Override"),
      absent: t("attendance.status_absent", "Absent"),
      unscheduled: t("attendance.status_unscheduled", "No Shift"),
      auto: t("attendance.status_auto", "Auto Log"),
    })[status] || status;

  const activePreset = useMemo(() => {
    return ["today", "week", "month"].find((p) => {
      const [s, e] = dateRangeForPreset(p);
      return s === startDate && e === endDate;
    });
  }, [startDate, endDate]);

  const applyPreset = (preset) => {
    const [s, e] = dateRangeForPreset(preset);
    setStartDate(s);
    setEndDate(e);
    setPage(1);
  };

  const changeStatusFilter = (status) => {
    setStatusFilter(status);
    setPage(1);
  };

  // Aggregate stats across full fetched dataset
  const stats = useMemo(() => {
    let workedMinutes = 0;
    let scheduledMinutes = 0;
    let lateCount = 0;
    let overrideCount = 0;
    let absentCount = 0;
    let onDutyCount = 0;
    let shiftCount = 0;

    attendance.forEach((item) => {
      scheduledMinutes += item.scheduled_minutes || 0;
      if (item.status === "absent") {
        absentCount++;
        return;
      }
      shiftCount++;
      workedMinutes += item.duration_minutes || 0;
      if (item.status === "late") lateCount++;
      if (item.status === "override") overrideCount++;
      if (!item.clock_out_at) onDutyCount++;
    });

    return {
      totalShifts: shiftCount,
      workedHours: formatHrs(workedMinutes),
      scheduledHours: formatHrs(scheduledMinutes),
      lateCount,
      overrideCount,
      absentCount,
      onDutyCount,
    };
  }, [attendance]);

  // Client-side filtering (Search & Status)
  const filteredAttendance = useMemo(() => {
    return attendance.filter((rec) => {
      // Status filter
      if (statusFilter === "on_duty" && (rec.clock_out_at || rec.status === "absent")) return false;
      if (statusFilter !== "all" && statusFilter !== "on_duty" && rec.status !== statusFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const haystack = [rec.staff_name, rec.username, rec.staff_designation, rec.shift_name, rec.manager_name, rec.notes];
        if (!haystack.some((v) => (v || "").toLowerCase().includes(q))) return false;
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
  const handleExportCSV = () => {
    const data = selectedIds.size > 0 ? attendance.filter((r) => selectedIds.has(r.id)) : filteredAttendance;

    if (data.length === 0) {
      toast.error(t("attendance.no_records_to_export", "No records to export"));
      return;
    }

    const headers = [
      "Staff Name",
      "Username",
      "Designation",
      "Shift Date",
      "Shift",
      "Shift Start",
      "Shift End",
      "Clock In",
      "Clock Out",
      "Scheduled (Mins)",
      "Worked (Mins)",
      "Late (Mins)",
      "Status",
      "Manager Override",
      "Notes",
    ];

    const rows = data.map((r) => [
      `"${r.staff_name || ""}"`,
      `"${r.username || ""}"`,
      `"${r.staff_designation || ""}"`,
      `"${r.roster_date ? formatLocalDate(new Date(r.roster_date)) : ""}"`,
      `"${r.shift_name || "Unscheduled"}"`,
      `"${r.shift_start_time || ""}"`,
      `"${r.shift_end_time || ""}"`,
      `"${r.clock_in_at || ""}"`,
      `"${r.clock_out_at || (r.clock_in_at ? "In Progress" : "")}"`,
      r.scheduled_minutes || 0,
      r.duration_minutes || 0,
      Math.max(0, r.late_minutes || 0),
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

  const kpiCards = [
    {
      key: "all",
      label: t("attendance.total_shifts", "Total Shifts"),
      value: stats.totalShifts,
      sub: stats.onDutyCount > 0 ? t("attendance.n_on_duty", "{{count}} on duty now", { count: stats.onDutyCount }) : null,
      icon: IconHistory,
      iconClass: "bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-300",
      valueClass: "text-slate-900 dark:text-white",
    },
    {
      key: "hours",
      label: t("attendance.total_hours_worked", "Hours Worked"),
      value: (
        <>
          {stats.workedHours} <span className="text-xs font-normal text-slate-400">{t("attendance.hrs", "hrs")}</span>
        </>
      ),
      sub: t("attendance.of_scheduled_hours", "of {{hours}} hrs scheduled", { hours: stats.scheduledHours }),
      icon: IconClock,
      iconClass: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400",
      valueClass: "text-emerald-600 dark:text-emerald-400",
    },
    {
      key: "late",
      label: t("attendance.late_arrivals", "Late Arrivals"),
      value: stats.lateCount,
      icon: IconAlertCircle,
      iconClass: "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400",
      valueClass: "text-amber-600 dark:text-amber-400",
    },
    {
      key: "absent",
      label: t("attendance.absences", "Absences"),
      value: stats.absentCount,
      sub: t("attendance.absences_sub", "Rostered shifts with no clock-in"),
      icon: IconUserX,
      iconClass: "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400",
      valueClass: "text-rose-600 dark:text-rose-400",
    },
    {
      key: "override",
      label: t("attendance.manager_overrides", "Manager Overrides"),
      value: stats.overrideCount,
      icon: IconShieldLock,
      iconClass: "bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400",
      valueClass: "text-purple-600 dark:text-purple-400",
    },
  ];

  const toolbarBtn =
    "w-[42px] h-[42px] rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95 shadow-xs cursor-pointer";

  const shiftDateLabel = (rec) => {
    const date = rec.roster_date || rec.clock_in_at;
    return date ? `${formatWeekday(date, lang)}, ${formatShortDate(date, lang)}` : "";
  };

  return (
    <Page className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
      {/* ── 1. Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <IconUserCheck className="text-emerald-600 dark:text-emerald-500" size={30} stroke={iconStroke} />
            {t("attendance.title", "Staff Attendance & Timesheets")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 mt-1">
            {t("attendance.subtitle", "Compare clock-in/out times against the roster: lateness, absences, worked hours and manager overrides.")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/dashboard/shifts-roster"
            className="min-h-[42px] h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-neutral-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition active:scale-95 cursor-pointer shadow-2xs"
          >
            <IconCalendar size={16} stroke={iconStroke} />
            <span>{t("attendance.open_roster", "Roster")}</span>
            <IconArrowRight size={14} stroke={iconStroke} className="text-slate-400" />
          </Link>
          <button
            type="button"
            onClick={handleExportCSV}
            className="min-h-[42px] h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-neutral-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition active:scale-95 cursor-pointer shadow-2xs"
          >
            <IconDownload size={16} stroke={iconStroke} />
            <span>{t("attendance.export_csv", "Export CSV")}</span>
          </button>
          <button
            type="button"
            onClick={() => mutate()}
            className={toolbarBtn}
            title={t("common.refresh", "Refresh")}
          >
            <IconRefresh size={16} stroke={iconStroke} />
          </button>
        </div>
      </div>

      {/* ── 2. Summary KPI Metric Cards — tap one to filter the table ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {kpiCards.map((card) => {
          const filterKey = card.key === "hours" ? "all" : card.key;
          const isActive = card.key !== "hours" && card.key !== "all" && statusFilter === filterKey;
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => changeStatusFilter(isActive ? "all" : filterKey)}
              className={clsx(
                "p-4 rounded-2xl bg-white dark:bg-neutral-900 border shadow-xs text-left transition active:scale-[0.98] cursor-pointer hover:border-slate-300 dark:hover:border-neutral-700",
                isActive ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-200/80 dark:border-neutral-800"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{card.label}</span>
                <span className={clsx("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", card.iconClass)}>
                  <Icon size={16} stroke={iconStroke} />
                </span>
              </div>
              <div className={clsx("text-2xl font-bold mt-2 tabular-nums", card.valueClass)}>{card.value}</div>
              {card.sub && <div className="text-[11px] text-slate-400 dark:text-neutral-500 mt-0.5 truncate">{card.sub}</div>}
            </button>
          );
        })}
      </div>

      {/* ── 3. Filter & Action Toolbar ── */}
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
              placeholder={t("attendance.search_placeholder", "Search staff, shift, notes...")}
              className="w-full min-h-[42px] pl-9 pr-8 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
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

          {/* Date presets */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-neutral-800">
            {[
              ["today", t("attendance.preset_today", "Today")],
              ["week", t("attendance.preset_week", "This Week")],
              ["month", t("attendance.preset_month", "This Month")],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className={clsx(
                  "min-h-[34px] px-3 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer whitespace-nowrap",
                  activePreset === key
                    ? "bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-white"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Date Pickers */}
          <div className="flex items-center gap-1.5 min-h-[42px] bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-700 px-2 py-1">
            <span className="text-[11px] font-bold text-slate-400">{t("attendance.from", "From")}</span>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="h-7 text-xs font-medium bg-transparent text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            />
            <span className="text-slate-300 dark:text-neutral-700">|</span>
            <span className="text-[11px] font-bold text-slate-400">{t("attendance.to", "To")}</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
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
            className="min-h-[42px] px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            <option value="">{t("attendance.all_staff", "All Staff")}</option>
            {staffList.map((s) => (
              <option key={s.username} value={s.username}>
                {s.name} ({s.designation || s.role})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => changeStatusFilter(e.target.value)}
            className="min-h-[42px] px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            <option value="all">{t("attendance.all_statuses", "All Statuses")}</option>
            <option value="on_duty">{t("attendance.on_duty_now", "On Duty Now")}</option>
            {["on_time", "late", "early", "absent", "override", "unscheduled"].map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
        </div>

        {/* Right: Print, Export & Inline Compact Pagination */}
        <div className="flex items-center gap-2 justify-end shrink-0">
          <button type="button" onClick={handlePrint} className={toolbarBtn} title={t("attendance.print", "Print")}>
            <IconPrinter size={16} stroke={iconStroke} />
          </button>

          {/* Inline Compact Pagination */}
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-neutral-400 pl-2 border-l border-slate-200 dark:border-neutral-700">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              title={t("attendance.previous", "Previous")}
              className={clsx(
                "w-[34px] h-[34px] rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition cursor-pointer",
                page <= 1 && "opacity-40 cursor-not-allowed hover:bg-transparent"
              )}
            >
              <IconChevronLeft size={16} stroke={iconStroke} />
            </button>

            <span className="font-medium text-slate-800 dark:text-slate-200 tabular-nums whitespace-nowrap">
              {totalItems > 0 ? `${startIndex + 1} - ${endIndex}` : "0 - 0"}
              <span className="text-slate-400 font-normal"> / {totalItems}</span>
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              title={t("attendance.next", "Next")}
              className={clsx(
                "w-[34px] h-[34px] rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition cursor-pointer",
                page >= totalPages && "opacity-40 cursor-not-allowed hover:bg-transparent"
              )}
            >
              <IconChevronRight size={16} stroke={iconStroke} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Selection Action Strip (When rows are checked) ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <IconCheck size={16} />
            <span>{t("attendance.n_selected", "{{count}} selected", { count: selectedIds.size })}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="min-h-[34px] px-3 rounded-lg text-xs font-bold bg-white dark:bg-neutral-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100/50 transition active:scale-95 cursor-pointer"
            >
              {t("attendance.export_selected", "Export Selected")}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="min-h-[34px] px-2 text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              {t("attendance.deselect_all", "Deselect All")}
            </button>
          </div>
        </div>
      )}

      {/* ── 4. Compact Data Table (Flat Container) ── */}
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
                  aria-label={t("attendance.select_all", "Select all rows")}
                  className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                />
              </th>
              <th className="px-3 py-2.5">{t("attendance.staff_member", "Staff Member")}</th>
              <th className="px-3 py-2.5">{t("attendance.scheduled_shift", "Scheduled Shift")}</th>
              <th className="px-3 py-2.5">{t("attendance.clock_in", "Clock In")}</th>
              <th className="px-3 py-2.5">{t("attendance.clock_out", "Clock Out")}</th>
              <th className="px-3 py-2.5 text-center">{t("attendance.duration", "Worked")}</th>
              <th className="px-3 py-2.5">{t("attendance.status", "Status")}</th>
              <th className="px-3 py-2.5">{t("attendance.override", "Manager Override")}</th>
              <th className="px-3 py-2.5">{t("attendance.notes", "Notes")}</th>
              <th className="px-3 py-2.5 text-right">{t("attendance.action", "Action")}</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="py-14 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                    <span className="loading loading-spinner loading-md text-emerald-600"></span>
                    <span className="text-xs font-medium">{t("common.loading", "Loading...")}</span>
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
                      {t("attendance.no_records_hint", "Adjust your date range or search query to find records.")}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedAttendance.map((rec) => {
                const isSelected = selectedIds.has(rec.id);
                const isAbsent = rec.status === "absent";
                const style = STATUS_STYLES[rec.status] || STATUS_STYLES.auto;

                return (
                  <tr
                    key={rec.id}
                    className={clsx(
                      "hover:bg-slate-50/70 dark:hover:bg-neutral-800/40 transition text-xs sm:text-[13px]",
                      isSelected && "bg-emerald-50/40 dark:bg-emerald-950/20",
                      isAbsent && !isSelected && "bg-rose-50/30 dark:bg-rose-950/10"
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
                      {rec.shift_name ? (
                        <>
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: rec.shift_color || "#94a3b8" }} />
                            {rec.shift_name}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-neutral-500">
                            {shiftDateLabel(rec)} · <span className="font-mono">{rec.shift_start_time}–{rec.shift_end_time}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-slate-400 italic">{t("attendance.unscheduled", "Unscheduled")}</div>
                          <div className="text-[11px] text-slate-400 dark:text-neutral-500">{shiftDateLabel(rec)}</div>
                        </>
                      )}
                    </td>

                    {/* Clock In */}
                    <td className="px-3 py-2.5 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {rec.clock_in_at ? (
                        <>
                          <div className="font-bold text-slate-900 dark:text-white">{formatClockTime(rec.clock_in_at, lang)}</div>
                          {rec.late_minutes > 5 && (
                            <div className="text-[11px] font-sans font-semibold text-amber-600 dark:text-amber-400">
                              {t("attendance.minutes_late", "{{count}} min late", { count: rec.late_minutes })}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-300 dark:text-neutral-600">—</span>
                      )}
                    </td>

                    {/* Clock Out */}
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                      {rec.clock_out_at ? (
                        <>
                          <div className="font-bold text-slate-900 dark:text-white">{formatClockTime(rec.clock_out_at, lang)}</div>
                          {rec.early_leave_minutes > 5 && (
                            <div className="text-[11px] font-sans font-semibold text-blue-600 dark:text-blue-400">
                              {t("attendance.minutes_early", "{{count}} min early", { count: rec.early_leave_minutes })}
                            </div>
                          )}
                        </>
                      ) : isAbsent ? (
                        <span className="text-slate-300 dark:text-neutral-600">—</span>
                      ) : (
                        /* On Duty pulsing badge */
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-sans font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {t("attendance.on_duty", "On Duty")}
                        </span>
                      )}
                    </td>

                    {/* Worked vs Scheduled Duration */}
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap tabular-nums">
                      {isAbsent ? (
                        <span className="text-slate-300 dark:text-neutral-600">—</span>
                      ) : (
                        <>
                          {formatHrs(rec.duration_minutes)}
                          {rec.scheduled_minutes ? (
                            <span className="font-normal text-[11px] text-slate-400"> / {formatHrs(rec.scheduled_minutes)}</span>
                          ) : null}{" "}
                          <span className="font-normal text-[11px] text-slate-400">{t("attendance.hrs", "hrs")}</span>
                        </>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={clsx("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border", style.badge)}>
                        <span className={clsx("w-1.5 h-1.5 rounded-full", style.dot, rec.status === "late" && "animate-pulse")} />
                        {statusLabel(rec.status)}
                      </span>
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
                        className="w-9 h-9 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-slate-100 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95 cursor-pointer ml-auto"
                        title={t("attendance.view_details", "View Details")}
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

      {/* ── 5. Bottom Pagination Bar ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2 px-1 text-xs text-slate-600 dark:text-neutral-400">
        <div className="text-slate-500 dark:text-neutral-400">
          {t("attendance.showing_entries", "Showing {{from}} to {{to}} of {{total}} entries", {
            from: totalItems > 0 ? startIndex + 1 : 0,
            to: endIndex,
            total: totalItems,
          })}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className={clsx(
              "min-h-[34px] px-2 flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition cursor-pointer font-medium",
              page <= 1 && "opacity-40 cursor-not-allowed hover:text-slate-600"
            )}
          >
            <IconChevronLeft size={14} stroke={iconStroke} />
            <span>{t("attendance.previous", "Previous")}</span>
          </button>

          <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded bg-slate-100 dark:bg-neutral-800">
            {t("attendance.page_of", "Page {{page}} of {{total}}", { page, total: totalPages })}
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className={clsx(
              "min-h-[34px] px-2 flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition cursor-pointer font-medium",
              page >= totalPages && "opacity-40 cursor-not-allowed hover:text-slate-600"
            )}
          >
            <span>{t("attendance.next", "Next")}</span>
            <IconChevronRight size={14} stroke={iconStroke} />
          </button>
        </div>
      </div>

      {/* ── Detail Modal ── */}
      {selectedRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t("attendance.details_title", "Timesheet Details")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  {selectedRecord.staff_name} • {selectedRecord.username}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="w-[42px] h-[42px] -mr-2 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-neutral-800 dark:hover:text-white transition active:scale-95 cursor-pointer"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Scheduled vs actual */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("attendance.scheduled", "Scheduled")}</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {selectedRecord.shift_name || t("attendance.unscheduled", "Unscheduled")}
                  </div>
                  {selectedRecord.shift_start_time && (
                    <div className="text-[11px] font-mono text-slate-500">
                      {selectedRecord.shift_start_time}–{selectedRecord.shift_end_time}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-400">{shiftDateLabel(selectedRecord)}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("attendance.worked", "Worked")}</div>
                  <div className="font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 text-sm">
                    {formatHrs(selectedRecord.duration_minutes)} {t("attendance.hrs", "hrs")}
                  </div>
                  {selectedRecord.scheduled_minutes ? (
                    <div className="text-[11px] text-slate-400">
                      {t("attendance.of_scheduled_hours", "of {{hours}} hrs scheduled", { hours: formatHrs(selectedRecord.scheduled_minutes) })}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2.5 border-t border-b border-slate-100 dark:border-neutral-800 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500 font-medium">{t("attendance.clock_in", "Clock In")}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-right">
                    {selectedRecord.clock_in_at
                      ? `${formatShortDate(selectedRecord.clock_in_at, lang)} ${formatClockTime(selectedRecord.clock_in_at, lang)}`
                      : "—"}
                    {selectedRecord.late_minutes > 5 && (
                      <span className="ml-2 font-sans text-amber-600 dark:text-amber-400">
                        {t("attendance.minutes_late", "{{count}} min late", { count: selectedRecord.late_minutes })}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500 font-medium">{t("attendance.clock_out", "Clock Out")}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-right">
                    {selectedRecord.clock_out_at
                      ? `${formatShortDate(selectedRecord.clock_out_at, lang)} ${formatClockTime(selectedRecord.clock_out_at, lang)}`
                      : selectedRecord.clock_in_at
                        ? t("attendance.on_duty", "On Duty")
                        : "—"}
                    {selectedRecord.early_leave_minutes > 5 && (
                      <span className="ml-2 font-sans text-blue-600 dark:text-blue-400">
                        {t("attendance.minutes_early", "{{count}} min early", { count: selectedRecord.early_leave_minutes })}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500 font-medium">{t("attendance.status", "Status")}</span>
                  <span className={clsx("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border", (STATUS_STYLES[selectedRecord.status] || STATUS_STYLES.auto).badge)}>
                    {statusLabel(selectedRecord.status)}
                  </span>
                </div>
                {selectedRecord.manager_name && (
                  <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 font-semibold">
                    <span className="flex items-center gap-1"><IconShieldLock size={14} /> {t("attendance.authorized_by", "Authorized By")}</span>
                    <span>{selectedRecord.manager_name}</span>
                  </div>
                )}
              </div>

              {selectedRecord.notes && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t("attendance.notes", "Notes")}</div>
                  <p className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-200">
                    {selectedRecord.notes}
                  </p>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="min-h-[42px] px-5 rounded-xl bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 font-bold text-slate-700 dark:text-slate-200 transition active:scale-95 cursor-pointer"
                >
                  {t("common.close", "Close")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
