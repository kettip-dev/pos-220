import React from "react";
import {
  IconArmchair,
  IconTrash,
  IconFriends,
  IconPencil,
  IconInfoSquareRounded,
  IconClock,
  IconPhone,
  IconUserCheck,
  IconCheck,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { useTranslation } from "react-i18next";

export const STATUS_CONFIG = {
  booked: {
    label: "Booked",
    bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    dot: "bg-amber-500",
  },
  seated: {
    label: "Seated",
    bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-500 animate-pulse",
  },
  completed: {
    label: "Completed",
    bg: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    dot: "bg-slate-400",
  },
  cancelled: {
    label: "Cancelled",
    bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    dot: "bg-rose-500",
  },
  no_show: {
    label: "No-Show",
    bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    dot: "bg-purple-500",
  },
  paid: {
    label: "Paid",
    bg: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
    dot: "bg-teal-500",
  },
};

export default function ReservationCard({
  id,
  unique_code,
  customer_id,
  customer_name,
  dateLocal,
  timeLocal,
  people_count,
  table_title,
  seating_capacity,
  floor,
  notes,
  status,
  business,
  btnUpdate,
  btnDelete,
  onStatusChange,
}) {
  const { t } = useTranslation();
  const currentStatus = String(status || "booked").toLowerCase();
  const statusCfg = STATUS_CONFIG[currentStatus] || {
    label: status || "Booked",
    bg: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    dot: "bg-gray-400",
  };
  const statusLabel = t(`reservations.status_${currentStatus}`) || statusCfg.label;

  return (
    <div
      key={unique_code || id}
      className="group relative flex flex-col justify-between rounded-xl border border-gray-200/90 bg-white p-3 shadow-xs transition-all duration-150 hover:border-restro-border-green hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      {/* Top Row: Time, Table & Status */}
      <div className="flex items-center justify-between gap-1.5 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex items-center gap-1 font-bold text-gray-900 dark:text-gray-100">
            <IconClock size={13} stroke={iconStroke} className="text-restro-green flex-shrink-0" />
            <span className="whitespace-nowrap">{timeLocal}</span>
          </span>

          {table_title && (
            <span className="truncate rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              {table_title}
            </span>
          )}
        </div>

        {/* Status Pill */}
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${statusCfg.bg}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
          {statusLabel}
        </span>
      </div>

      {/* Middle Row: Guest Name & Party Size */}
      <div className="my-1.5 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h5 className="truncate text-sm font-bold text-gray-900 dark:text-white">
              {customer_name || "Guest Customer"}
            </h5>
            {business && (
              <span className="rounded bg-gray-100 px-1 text-[9px] text-gray-500 dark:bg-zinc-800">
                {business}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            {customer_id && (
              <span className="flex items-center gap-0.5 truncate hover:text-restro-green">
                <IconPhone size={11} stroke={iconStroke} />
                <a href={`tel:${customer_id}`}>{customer_id}</a>
              </span>
            )}
            {notes && (
              <div className="tooltip tooltip-bottom" data-tip={notes}>
                <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 cursor-pointer">
                  <IconInfoSquareRounded size={12} stroke={iconStroke} /> {t("reservations.notes") || "Note"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Party Count Chip */}
        <span className="inline-flex items-center gap-1 rounded-lg bg-restro-gray px-2 py-0.5 text-xs font-bold text-restro-text whitespace-nowrap">
          <IconFriends size={13} stroke={iconStroke} className="text-restro-green" />
          <span>{people_count || 1}p</span>
        </span>
      </div>

      {/* Bottom Action Strip: Compact inline controls */}
      <div className="flex items-center justify-between gap-1 border-t border-gray-100 pt-1.5 dark:border-zinc-800/80">
        <div className="flex items-center gap-1">
          {currentStatus === "booked" && onStatusChange && (
            <button
              onClick={() => onStatusChange("seated")}
              className="flex h-7 items-center gap-1 rounded-lg bg-emerald-600 px-2 text-[11px] font-bold text-white shadow-xs transition active:scale-95 hover:bg-emerald-700"
            >
              <IconUserCheck size={13} stroke={iconStroke} />
              <span>{t("reservations.action_seat") || "Seat"}</span>
            </button>
          )}

          {currentStatus === "seated" && onStatusChange && (
            <button
              onClick={() => onStatusChange("completed")}
              className="flex h-7 items-center gap-1 rounded-lg bg-blue-600 px-2 text-[11px] font-bold text-white shadow-xs transition active:scale-95 hover:bg-blue-700"
            >
              <IconCheck size={13} stroke={iconStroke} />
              <span>{t("reservations.action_finish") || "Finish"}</span>
            </button>
          )}

          {currentStatus !== "cancelled" && currentStatus !== "completed" && onStatusChange && (
            <div className="dropdown dropdown-top">
              <button
                tabIndex={0}
                className="flex h-7 items-center rounded-lg border border-gray-200 bg-restro-gray px-1.5 text-[10px] font-semibold text-gray-600 transition active:scale-95 hover:bg-gray-200 dark:border-zinc-700 dark:text-gray-300"
              >
                {t("reservations.status") || "Status"}
              </button>
              <ul
                tabIndex={0}
                className="dropdown-content menu z-20 mb-1 w-32 rounded-xl border border-gray-200 bg-white p-1 text-[11px] shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
              >
                {currentStatus !== "booked" && (
                  <li>
                    <button onClick={() => onStatusChange("booked")}>{t("reservations.mark_booked") || "Mark Booked"}</button>
                  </li>
                )}
                {currentStatus !== "seated" && (
                  <li>
                    <button onClick={() => onStatusChange("seated")}>{t("reservations.mark_seated") || "Mark Seated"}</button>
                  </li>
                )}
                {currentStatus !== "completed" && (
                  <li>
                    <button onClick={() => onStatusChange("completed")}>{t("reservations.mark_completed") || "Mark Completed"}</button>
                  </li>
                )}
                {currentStatus !== "no_show" && (
                  <li>
                    <button onClick={() => onStatusChange("no_show")} className="text-purple-600">
                      {t("reservations.status_no_show") || "No-Show"}
                    </button>
                  </li>
                )}
                {currentStatus !== "cancelled" && (
                  <li>
                    <button onClick={() => onStatusChange("cancelled")} className="text-rose-600">
                      {t("reservations.action_cancel") || "Cancel"}
                    </button>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={btnUpdate}
            title={t("reservations.edit_reservation") || "Edit Reservation"}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition active:scale-95 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
          >
            <IconPencil size={14} stroke={iconStroke} />
          </button>
          <button
            onClick={btnDelete}
            title={t("reservations.delete_confirm") || "Delete Reservation"}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-400 transition active:scale-95 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
          >
            <IconTrash size={14} stroke={iconStroke} />
          </button>
        </div>
            title="Delete Reservation"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-400 transition active:scale-95 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
          >
            <IconTrash size={14} stroke={iconStroke} />
          </button>
        </div>
      </div>
    </div>
  );
}
