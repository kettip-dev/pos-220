import React from "react";
import ReservationCard from "./ReservationCard";
import { IconClock, IconCalendarEvent } from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { useTranslation } from "react-i18next";

export default function ReservationTimelineView({
  reservations = [],
  onUpdate,
  onDelete,
  onStatusChange,
}) {
  const { t } = useTranslation();

  if (!reservations || reservations.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 p-8 text-center dark:border-zinc-800">
        <IconCalendarEvent size={36} stroke={iconStroke} className="text-gray-300 dark:text-zinc-700 mb-2" />
        <p className="text-xs font-semibold text-gray-500">
          {t("reservations.timeline.no_reservations") || "No reservations found in timeline"}
        </p>
      </div>
    );
  }

  // Sort reservations chronologically
  const sorted = [...reservations].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Group by date, then hour slot
  const groups = sorted.reduce((acc, r) => {
    const d = new Date(r.date);
    const dateKey = d.toLocaleDateString("en", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const hourSlot = d.toLocaleTimeString("en", {
      hour: "numeric",
      minute: "2-digit",
    });

    if (!acc[dateKey]) acc[dateKey] = {};
    if (!acc[dateKey][hourSlot]) acc[dateKey][hourSlot] = [];
    acc[dateKey][hourSlot].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6 pb-6">
      {Object.entries(groups).map(([dateLabel, slotGroups]) => (
        <div key={dateLabel} className="space-y-3">
          {/* Date separator header */}
          <div className="sticky top-0 z-10 flex items-center gap-2 bg-white/95 py-1.5 backdrop-blur-xs dark:bg-zinc-950/95">
            <span className="flex h-6 items-center rounded-md bg-restro-green px-2.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-xs">
              {dateLabel}
            </span>
            <div className="h-px flex-1 bg-gray-200 dark:bg-zinc-800" />
          </div>

          {/* Slots & Timeline Connector */}
          <div className="relative pl-5 space-y-4 before:absolute before:bottom-2 before:left-1.5 before:top-2 before:w-0.5 before:bg-gradient-to-b before:from-restro-green before:via-gray-300 before:to-gray-200 dark:before:via-zinc-700 dark:before:to-zinc-800">
            {Object.entries(slotGroups).map(([hourSlot, items]) => (
              <div key={hourSlot} className="relative space-y-2">
                {/* Timeline node icon */}
                <div className="absolute -left-[20px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-restro-green shadow-xs dark:border-zinc-950">
                  <div className="h-1.5 w-1.5 rounded-full bg-white" />
                </div>

                {/* Time slot header */}
                <div className="flex items-center gap-1.5">
                  <IconClock size={14} stroke={iconStroke} className="text-gray-400" />
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    {hourSlot}
                  </span>
                  <span className="rounded-full bg-restro-gray px-1.5 py-0.2 text-[10px] font-semibold text-gray-500">
                    {items.length} {items.length === 1 ? "booking" : "bookings"}
                  </span>
                </div>

                {/* Compact reservation cards for this slot */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {items.map((r) => {
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
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
