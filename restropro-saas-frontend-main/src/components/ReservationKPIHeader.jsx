import React from "react";
import {
  IconCalendarEvent,
  IconUserCheck,
  IconClock,
  IconFriends,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";

export default function ReservationKPIHeader({
  summary,
  reservations = [],
  activeStatusFilter,
  onStatusFilterChange,
}) {
  const totalCount = reservations.length;
  const seatedCount = reservations.filter((r) => r.status === "seated").length;
  const bookedCount = reservations.filter((r) => r.status === "booked").length;
  const totalGuests = reservations.reduce((sum, r) => sum + (Number(r.people_count) || 0), 0);

  const stats = [
    {
      id: "all",
      label: "Total Bookings",
      value: summary?.today ?? totalCount,
      subtext: "Selected",
      icon: IconCalendarEvent,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      id: "seated",
      label: "Currently Seated",
      value: seatedCount,
      subtext: "Dining",
      icon: IconUserCheck,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      id: "booked",
      label: "Upcoming / Booked",
      value: bookedCount,
      subtext: "Confirmed",
      icon: IconClock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      id: "guests",
      label: "Total Guests",
      value: totalGuests,
      subtext: "Expected",
      icon: IconFriends,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 flex-shrink-0">
      {stats.map((st) => {
        const Icon = st.icon;
        const isSelected = activeStatusFilter === st.id;
        return (
          <div
            key={st.id}
            onClick={() => {
              if (st.id === "guests") return;
              onStatusFilterChange(isSelected ? "all" : st.id);
            }}
            className={`flex items-center justify-between cursor-pointer rounded-xl border px-3 py-2 transition-all duration-150 active:scale-95 ${
              isSelected
                ? "border-restro-border-green bg-restro-green/10 shadow-xs ring-1 ring-restro-border-green/50"
                : "border-gray-200/80 bg-white hover:border-gray-300 dark:border-zinc-800 dark:bg-zinc-900"
            }`}
          >
            <div>
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                {st.label}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black tracking-tight text-gray-900 dark:text-white">
                  {st.value}
                </span>
                <span className="text-[10px] text-gray-400">({st.subtext})</span>
              </div>
            </div>

            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${st.bg} ${st.color}`}>
              <Icon size={17} stroke={iconStroke} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
