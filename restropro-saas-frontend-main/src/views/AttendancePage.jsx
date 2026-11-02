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
} from "@tabler/icons-react";
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

  const { data: attendance = [], isLoading, mutate } = useAttendanceReport(startDate, endDate, selectedStaff);
  const { data: usersData } = useUsers();

  const staffList = useMemo(() => {
    return usersData?.users || [];
  }, [usersData]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalMinutes = 0;
    let lateCount = 0;
    let overrideCount = 0;

    attendance.forEach((item) => {
      totalMinutes += item.duration_minutes || 0;
      if (item.status === "late") lateCount++;
      if (item.status === "override") overrideCount++;
    });

    const totalHours = (totalMinutes / 60).toFixed(1);

    return {
      totalShifts: attendance.length,
      totalHours,
      lateCount,
      overrideCount,
    };
  }, [attendance]);

  // CSV Export helper
  const handleExportCSV = () => {
    if (attendance.length === 0) {
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

    const rows = attendance.map((r) => [
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

  return (
    <Page className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <IconUserCheck className="text-primary-500" size={32} />
            {t("reports.staff_attendance", "Staff Attendance & Timesheets")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("attendance.subtitle", "Track staff clock-in/out timestamps, scheduled shift adherence, worked hours, and manager overrides.")}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="h-11 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition active:scale-95 cursor-pointer shadow-2xs"
        >
          <IconDownload size={17} />
          <span>{t("common.export_csv", "Export CSV")}</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t("attendance.total_shifts", "Total Shifts")}
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white mt-1">
            {stats.totalShifts}
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t("attendance.total_hours_worked", "Total Hours Worked")}
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.totalHours} <span className="text-sm font-normal text-slate-400">hrs</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t("attendance.late_arrivals", "Late Arrivals")}
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
            {stats.lateCount}
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t("attendance.manager_overrides", "Manager Overrides")}
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-purple-600 dark:text-purple-400 mt-1">
            {stats.overrideCount}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Start Date */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t("common.from", "From:")}</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
            />
          </div>

          {/* End Date */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t("common.to", "To:")}</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
            />
          </div>

          {/* Staff Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t("common.staff", "Staff:")}</span>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="h-10 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
            >
              <option value="">{t("common.all_staff", "All Staff")}</option>
              {staffList.map((s) => (
                <option key={s.username} value={s.username}>
                  {s.name} ({s.designation || s.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => mutate()}
          className="h-10 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition active:scale-95 cursor-pointer"
        >
          {t("common.refresh", "Refresh")}
        </button>
      </div>

      {/* Attendance Records Table */}
      <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
        <table className="w-full border-collapse min-w-[850px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              <th className="py-4 px-4 text-left">{t("attendance.staff_member", "Staff Member")}</th>
              <th className="py-4 px-4 text-left">{t("attendance.shift", "Scheduled Shift")}</th>
              <th className="py-4 px-4 text-left">{t("attendance.clock_in", "Clock In")}</th>
              <th className="py-4 px-4 text-left">{t("attendance.clock_out", "Clock Out")}</th>
              <th className="py-4 px-4 text-left">{t("attendance.duration", "Duration")}</th>
              <th className="py-4 px-4 text-left">{t("attendance.status", "Status")}</th>
              <th className="py-4 px-4 text-left">{t("attendance.override", "Manager Override")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {attendance.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  {t("attendance.no_records_found", "No attendance records found for this period.")}
                </td>
              </tr>
            ) : (
              attendance.map((rec) => {
                const durationHrs = rec.duration_minutes ? (rec.duration_minutes / 60).toFixed(1) : "0";

                return (
                  <tr key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{rec.staff_name}</div>
                      <div className="text-[11px] text-slate-400">{rec.staff_designation || rec.username}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {rec.shift_name || t("attendance.unscheduled", "Unscheduled")}
                      </div>
                      {rec.shift_start_time && (
                        <div className="text-[11px] font-mono text-slate-400">
                          {rec.shift_start_time} - {rec.shift_end_time}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {new Date(rec.clock_in_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    <td className="py-3 px-4 font-mono">
                      {rec.clock_out_at ? (
                        <span className="font-bold text-slate-900 dark:text-white">
                          {new Date(rec.clock_out_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider text-[10px] animate-pulse">
                          ● {t("attendance.on_duty", "On Duty")}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {durationHrs} hrs
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={clsx(
                          "px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider border",
                          rec.status === "on_time" &&
                            "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
                          rec.status === "late" &&
                            "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
                          rec.status === "override" &&
                            "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800"
                        )}
                      >
                        {rec.status}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {rec.manager_name ? (
                        <span className="text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                          <IconShieldLock size={14} /> {rec.manager_name}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
