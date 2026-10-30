import React from "react";
import {
  IconArmchair,
  IconFriends,
  IconPencil,
  IconTrash,
  IconUserCheck,
  IconCheck,
  IconClock,
  IconPhone,
  IconInfoSquareRounded,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { STATUS_CONFIG } from "./ReservationCard";
import { useTranslation } from "react-i18next";

export default function ReservationTableView({
  reservations = [],
  onUpdate,
  onDelete,
  onStatusChange,
}) {
  const { t } = useTranslation();

  if (!reservations || reservations.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 p-8 text-center dark:border-zinc-800">
        <p className="text-sm font-semibold text-gray-500">No reservations found in list</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto border-t border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b]">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 dark:border-neutral-800 text-[13px] font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-[#18181b]">
            <th className="py-3 px-4">Reservation</th>
            <th className="py-3 px-3">Guest</th>
            <th className="py-3 px-3">Guests</th>
            <th className="py-3 px-3">Table</th>
            <th className="py-3 px-3">Notes</th>
            <th className="py-3 px-3 text-center">Status</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80">
          {reservations.map((r) => {
            const dateObj = new Date(r.date);
            const dateLocal = dateObj.toLocaleDateString("en", {
              month: "short",
              day: "numeric",
            });
            const timeLocal = dateObj.toLocaleTimeString("en", {
              hour: "numeric",
              minute: "2-digit",
            });

            const currentStatus = String(r.status || "booked").toLowerCase();

            return (
              <tr
                key={r.unique_code || r.id}
                className="hover:bg-slate-50/70 dark:hover:bg-neutral-800/40 transition group"
              >
                {/* Reservation Time & Code */}
                <td className="py-3 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
                      <IconClock size={16} stroke={iconStroke} />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {timeLocal}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {dateLocal} {r.unique_code ? `• #${r.unique_code}` : ""}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Customer Info */}
                <td className="py-3 px-3 whitespace-nowrap">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {r.customer_name || "Guest Customer"}
                  </div>
                  {r.customer_id && (
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <IconPhone size={12} stroke={iconStroke} />
                      <a href={`tel:${r.customer_id}`} className="hover:underline">
                        {r.customer_id}
                      </a>
                    </div>
                  )}
                  {r.business && (
                    <span className="inline-block mt-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] text-slate-500">
                      {r.business}
                    </span>
                  )}
                </td>

                {/* Guests */}
                <td className="py-3 px-3 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <IconFriends size={14} stroke={iconStroke} className="text-emerald-600" />
                    {r.people_count || 1} {Number(r.people_count) > 1 ? "guests" : "guest"}
                  </span>
                </td>

                {/* Table Assignment */}
                <td className="py-3 px-3 whitespace-nowrap">
                  {r.table_title ? (
                    <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      <IconArmchair size={14} stroke={iconStroke} />
                      <span>{r.table_title}</span>
                      {r.floor && <span className="opacity-60">({r.floor})</span>}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Unassigned</span>
                  )}
                </td>

                {/* Notes */}
                <td className="py-3 px-3 max-w-[200px]">
                  {r.notes ? (
                    <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 truncate" title={r.notes}>
                      <IconInfoSquareRounded size={14} stroke={iconStroke} className="flex-shrink-0 text-amber-500" />
                      <span className="truncate">{r.notes}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300 dark:text-neutral-700">—</span>
                  )}
                </td>

                {/* Status Badge (BAL style) */}
                <td className="py-3 px-3 whitespace-nowrap text-center">
                  <span
                    className={clsx(
                      "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border",
                      currentStatus === "seated" &&
                        "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400 border-blue-200 dark:border-blue-800",
                      currentStatus === "completed" &&
                        "bg-[#dcfce7] text-[#15803d] dark:bg-emerald-950/70 dark:text-emerald-400 border-[#bbf7d0] dark:border-emerald-800",
                      currentStatus === "cancelled" &&
                        "bg-[#fee2e2] text-[#991b1b] dark:bg-rose-950/70 dark:text-rose-400 border-[#fecaca] dark:border-rose-800",
                      currentStatus === "booked" &&
                        "bg-[#fef3c7] text-[#b45309] dark:bg-amber-950/70 dark:text-amber-400 border-[#fde68a] dark:border-amber-800"
                    )}
                  >
                    {currentStatus}
                  </span>
                </td>

                {/* Actions */}
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    {currentStatus === "booked" && (
                      <button
                        onClick={() => onStatusChange(r.id, "seated")}
                        className="min-h-[28px] px-2.5 rounded-md bg-[#107c41] hover:bg-[#0c6634] text-xs font-semibold text-white shadow-2xs transition active:scale-95 flex items-center gap-1"
                        title="Seat Guest"
                      >
                        <IconUserCheck size={13} stroke={iconStroke} />
                        <span>Seat</span>
                      </button>
                    )}

                    {currentStatus === "seated" && (
                      <button
                        onClick={() => onStatusChange(r.id, "completed")}
                        className="min-h-[28px] px-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-2xs transition active:scale-95 flex items-center gap-1"
                        title="Finish Dining"
                      >
                        <IconCheck size={13} stroke={iconStroke} />
                        <span>Finish</span>
                      </button>
                    )}

                    <button
                      onClick={() => onUpdate(r)}
                      className="w-8 h-8 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 transition active:scale-95 flex items-center justify-center"
                      title="Edit"
                    >
                      <IconPencil size={15} stroke={iconStroke} />
                    </button>

                    <button
                      onClick={() => onDelete(r.id)}
                      className="w-8 h-8 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition active:scale-95 flex items-center justify-center"
                      title="Delete"
                    >
                      <IconTrash size={15} stroke={iconStroke} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
