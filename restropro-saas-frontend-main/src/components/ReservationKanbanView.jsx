import React from "react";
import ReservationCard from "./ReservationCard";
import {
  IconCalendarClock,
  IconUserCheck,
  IconCheck,
  IconCalendarX,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { useTranslation } from "react-i18next";

export default function ReservationKanbanView({
  reservations = [],
  onUpdate,
  onDelete,
  onStatusChange,
}) {
  const { t } = useTranslation();

  const columns = [
    {
      id: "booked",
      title: t("reservations.kanban.booked") || "Booked / Confirmed",
      icon: IconCalendarClock,
      badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      items: reservations.filter((r) => (r.status || "booked").toLowerCase() === "booked"),
    },
    {
      id: "seated",
      title: t("reservations.kanban.seated") || "Seated (Dining)",
      icon: IconUserCheck,
      badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      items: reservations.filter((r) => (r.status || "").toLowerCase() === "seated"),
    },
    {
      id: "completed",
      title: t("reservations.kanban.completed") || "Completed",
      icon: IconCheck,
      badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      items: reservations.filter(
        (r) =>
          (r.status || "").toLowerCase() === "completed" ||
          (r.status || "").toLowerCase() === "paid"
      ),
    },
    {
      id: "inactive",
      title: t("reservations.kanban.inactive") || "Cancelled / No-Show",
      icon: IconCalendarX,
      badgeColor: "bg-rose-500/10 text-rose-600 border-rose-500/20",
      items: reservations.filter((r) => {
        const s = (r.status || "").toLowerCase();
        return s === "cancelled" || s === "no_show";
      }),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 h-full min-h-0 overflow-x-auto overflow-y-hidden pb-1">
      {columns.map((col) => {
        const Icon = col.icon;
        return (
          <div
            key={col.id}
            className="flex flex-col h-full min-h-0 rounded-2xl border border-gray-200/80 bg-gray-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40"
          >
            {/* Column Header */}
            <div className="mb-2.5 flex items-center justify-between px-1 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <Icon size={16} stroke={iconStroke} className="text-restro-green" />
                <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  {col.title}
                </h4>
              </div>
              <span
                className={`rounded-full border px-2 py-0.2 text-[11px] font-extrabold ${col.badgeColor}`}
              >
                {col.items.length}
              </span>
            </div>

            {/* Column Cards Container - Scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {col.items.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400 dark:border-zinc-800">
                  {t("reservations.kanban.empty") || "No reservations"}
                </div>
              ) : (
                col.items.map((r) => {
                  const dateObj = new Date(r.date);
                  const dateLocal = dateObj.toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                  });
                  const timeLocal = dateObj.toLocaleTimeString("en", {
                    hour: "numeric",
                    minute: "2-digit",
                  });

                  return (
                    <ReservationCard
                      key={r.unique_code || r.id}
                      id={r.id}
                      unique_code={r.unique_code}
                      customer_id={r.customer_id}
                      customer_name={r.customer_name}
                      dateLocal={dateLocal}
                      timeLocal={timeLocal}
                      people_count={r.people_count}
                      table_id={r.table_id}
                      table_title={r.table_title}
                      seating_capacity={r.seating_capacity}
                      floor={r.floor}
                      notes={r.notes}
                      status={r.status}
                      business={r.business}
                      btnUpdate={() => onUpdate(r)}
                      btnDelete={() => onDelete(r.id)}
                      onStatusChange={(newStatus) => onStatusChange(r.id, newStatus)}
                    />
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
