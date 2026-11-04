import React from "react";
import {
  IconCalendarEvent,
  IconUserCheck,
  IconClock,
  IconFriends,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { useTranslation } from "react-i18next";

export default function ReservationKPIHeader({
  summary,
  reservations = [],
  activeStatusFilter,
  onStatusFilterChange,
}) {
  const { t } = useTranslation();

  const totalCount = reservations.length;
  const seatedCount = reservations.filter((r) => r.status === "seated").length;
  const bookedCount = reservations.filter((r) => r.status === "booked").length;
  const totalGuests = reservations.reduce((sum, r) => sum + (Number(r.people_count) || 0), 0);

  const stats = [
    {
      id: "all",
      label: t("reservations.kpi.total_bookings") || "Total Bookings",
      value: totalCount,
      subtext: t("reservations.kpi.selected") || "Selected",
      icon: IconCalendarEvent,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      id: "seated",
      label: t("reservations.kpi.currently_seated") || "Currently Seated",
      value: seatedCount,
      subtext: t("reservations.kpi.dining") || "Dining",
      icon: IconUserCheck,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      id: "booked",
      label: t("reservations.kpi.upcoming_booked") || "Upcoming / Booked",
      value: bookedCount,
      subtext: t("reservations.kpi.confirmed") || "Confirmed",
      icon: IconClock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      id: "guests",
      label: t("reservations.kpi.total_guests") || "Total Guests",
      value: totalGuests,
      subtext: t("reservations.kpi.expected") || "Expected",
      icon: IconFriends,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-shrink-0">
      {stats.map((st) => {
        const Icon = st.icon;
        const isSelected = activeStatusFilter === st.id;
        const clickable = st.id !== "guests";
        return (
          <button
            type="button"
            key={st.id}
            onClick={() => {
              if (!clickable) return;
              onStatusFilterChange(isSelected ? "all" : st.id);
            }}
            className={`flex min-h-[72px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-150 ${
              clickable ? "cursor-pointer active:scale-95" : "cursor-default"
            } ${
              isSelected
                ? "border-restro-border-green bg-restro-green/10 shadow-sm ring-1 ring-restro-border-green/50"
                : "border-gray-200/80 bg-white hover:border-gray-300 dark:border-zinc-800 dark:bg-zinc-900"
            }`}
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${st.bg} ${st.color}`}>
              <Icon size={22} stroke={iconStroke} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold leading-snug text-gray-500 dark:text-gray-400">
                {st.label}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black leading-tight tracking-tight text-gray-900 dark:text-white">
                  {st.value}
                </span>
                <span className="truncate text-xs leading-snug text-gray-400">{st.subtext}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
