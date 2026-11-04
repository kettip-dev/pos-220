import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconClock, IconX, IconLogin2, IconLogout2 } from "@tabler/icons-react";
import { toast } from "react-hot-toast";
import clsx from "clsx";
import { clockIn, clockOut } from "../../controllers/shift_roster.controller";
import { getUserDetailsInLocalStorage } from "../../helpers/UserDetails";
import { formatClockTime } from "../../helpers/DateHelper";

function formatDuration(fromDate, now, t) {
  const mins = Math.max(0, Math.floor((now - fromDate) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hLabel = t("attendance.h_short", "h");
  const mLabel = t("attendance.m_short", "m");
  return h > 0 ? `${h}${hLabel} ${m}${mLabel}` : `${m}${mLabel}`;
}

/**
 * Self-service clock in / out for the logged-in staff member.
 * `attendance` is the /shift-roster/attendance/me payload; `onChanged` revalidates it.
 */
export default function ClockInOutModal({ isOpen, onClose, attendance, onChanged }) {
  const { t, i18n } = useTranslation();
  const user = getUserDetailsInLocalStorage();
  const [isLoading, setIsLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const isClockedIn = !!attendance?.isClockedIn;
  const clockInAt = attendance?.clockInAt ? new Date(attendance.clockInAt) : null;
  const shift = attendance?.shift;
  const isLate = isClockedIn && attendance?.status === "late";

  useEffect(() => {
    if (!isOpen) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggle = async () => {
    try {
      setIsLoading(true);
      const res = isClockedIn ? await clockOut({}) : await clockIn({});
      if (res.data?.success) {
        toast.success(
          isClockedIn
            ? t("attendance.clocked_out", "Clocked out")
            : t("attendance.clocked_in", "Clocked in")
        );
        await onChanged?.();
        onClose();
      } else {
        toast.error(res.data?.message || t("common.error", "Something went wrong"));
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || t("common.error", "Something went wrong"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-start justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#2CA01C]/10 text-[#2CA01C] flex items-center justify-center border border-[#2CA01C]/20">
              <IconClock size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {t("attendance.clock_title", "Clock In / Out")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[220px]">
                {user?.name || user?.username}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-[42px] h-[42px] -mr-2 -mt-2 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Status */}
        <div className="py-6 px-5 flex flex-col items-center justify-center text-center bg-slate-50/70 dark:bg-slate-950/40">
          <span
            className={clsx(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
              isClockedIn
                ? "bg-[#2CA01C]/10 text-[#2CA01C]"
                : "bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            )}
          >
            <span className={clsx("w-2 h-2 rounded-full", isClockedIn ? "bg-[#2CA01C]" : "bg-slate-400")} />
            {isClockedIn
              ? t("attendance.on_shift", "On shift")
              : t("attendance.off_shift", "Not clocked in")}
          </span>

          {isClockedIn && clockInAt ? (
            <>
              <div className="mt-3 text-3xl font-bold font-mono text-slate-900 dark:text-white">
                {formatDuration(clockInAt, now, t)}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t("attendance.since", "Since")} {formatClockTime(clockInAt, i18n.language)}
                {isLate && (
                  <span className="ml-1.5 font-semibold text-amber-600 dark:text-amber-400">
                    · {t("attendance.status_late", "Late")}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="mt-3 text-3xl font-bold font-mono text-slate-900 dark:text-white">
              {formatClockTime(now, i18n.language)}
            </div>
          )}

          {/* The rostered shift this clock-in counts against */}
          <div className="mt-4 w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {isClockedIn ? t("attendance.current_shift", "Shift") : t("attendance.next_shift", "Next shift")}
            </span>
            {shift ? (
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                {shift.name} <span className="font-mono font-medium text-slate-500">{shift.startTime}–{shift.endTime}</span>
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-400 italic">{t("attendance.no_shift_scheduled", "Not on the roster")}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            disabled={isLoading || !attendance}
            onClick={handleToggle}
            className={clsx(
              "flex-1 h-12 rounded-2xl disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-bold transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-md",
              isClockedIn
                ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20"
                : "bg-[#2CA01C] hover:bg-[#258a17] shadow-[#2CA01C]/20"
            )}
          >
            {isClockedIn ? <IconLogout2 size={18} /> : <IconLogin2 size={18} />}
            <span>
              {isClockedIn
                ? t("attendance.clock_out", "Clock Out")
                : t("attendance.clock_in", "Clock In")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
