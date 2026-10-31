import React, { useState } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconCalendar,
  IconPlus,
  IconClock,
  IconArmchair,
  IconFriends,
  IconX,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { STATUS_CONFIG } from "./ReservationCard";
import { useTranslation } from "react-i18next";

export default function ReservationCalendarView({
  reservations = [],
  onSelectDate,
  onUpdate,
  onDelete,
  onAddNewOnDate,
  onStatusChange,
}) {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayReservations, setSelectedDayReservations] = useState(null);
  const [selectedDayLabel, setSelectedDayLabel] = useState("");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar calculations
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const monthName = currentDate.toLocaleString("en", { month: "long" });

  // Map reservations by "YYYY-MM-DD"
  const reservationsByDate = reservations.reduce((acc, r) => {
    if (!r.date) return acc;
    const d = new Date(r.date);
    if (isNaN(d.getTime())) return acc;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  // Generate days array
  const calendarCells = [];

  // Previous month padding days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    calendarCells.push({
      dayNumber: daysInPrevMonth - i,
      isCurrentMonth: false,
      dateKey: `${year}-${String(month).padStart(2, "0")}-${String(daysInPrevMonth - i).padStart(2, "0")}`,
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    calendarCells.push({
      dayNumber: day,
      isCurrentMonth: true,
      dateKey: key,
    });
  }

  // Next month padding days to complete 35 or 42 cells
  const remaining = (7 - (calendarCells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    calendarCells.push({
      dayNumber: i,
      isCurrentMonth: false,
      dateKey: `${year}-${String(month + 2).padStart(2, "0")}-${String(i).padStart(2, "0")}`,
    });
  }

  const todayKey = new Date().toISOString().slice(0, 10);

  const handleCellClick = (cell) => {
    const list = reservationsByDate[cell.dateKey] || [];
    setSelectedDayReservations(list);
    const d = new Date(cell.dateKey);
    setSelectedDayLabel(
      d.toLocaleDateString("en", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-3">
      {/* Calendar Header: Month, Year, and Prev/Next */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-restro-green/10 text-restro-green">
            <IconCalendar size={20} stroke={iconStroke} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
              {monthName} {year}
            </h3>
            <span className="text-[11px] text-gray-400">
              {reservations.length} {t("reservations.calendar_view.total_loaded") || "total bookings loaded"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={goToToday}
            className="h-8 rounded-lg border border-gray-200 bg-restro-gray px-2.5 text-xs font-semibold text-gray-700 transition active:scale-95 hover:bg-gray-200 dark:border-zinc-700 dark:text-gray-200"
          >
            {t("reservations.calendar_view.today") || "Today"}
          </button>
          <button
            onClick={prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition active:scale-95 hover:bg-gray-100 dark:border-zinc-700 dark:text-gray-300"
          >
            <IconChevronLeft size={16} stroke={iconStroke} />
          </button>
          <button
            onClick={nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition active:scale-95 hover:bg-gray-100 dark:border-zinc-700 dark:text-gray-300"
          >
            <IconChevronRight size={16} stroke={iconStroke} />
          </button>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 flex flex-col">
        {/* Days of week */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/75 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:border-zinc-800 dark:bg-zinc-850 dark:text-gray-400 py-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName) => (
            <div key={dayName}>{dayName}</div>
          ))}
        </div>

        {/* Calendar Days Cells */}
        <div className="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y divide-gray-100 dark:divide-zinc-800/80">
          {calendarCells.map((cell, idx) => {
            const isToday = cell.dateKey === todayKey;
            const dayBookings = reservationsByDate[cell.dateKey] || [];
            const hasBookings = dayBookings.length > 0;

            return (
              <div
                key={idx}
                onClick={() => handleCellClick(cell)}
                className={`group relative flex flex-col p-1.5 transition cursor-pointer min-h-[90px] ${
                  cell.isCurrentMonth
                    ? "bg-white hover:bg-gray-50/80 dark:bg-zinc-900 dark:hover:bg-zinc-800/50"
                    : "bg-gray-50/40 text-gray-300 dark:bg-zinc-950/40 dark:text-zinc-600"
                } ${isToday ? "ring-2 ring-inset ring-restro-green/60" : ""}`}
              >
                {/* Cell Header: Day Number & Count */}
                <div className="flex items-center justify-between">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      isToday
                        ? "bg-restro-green text-white shadow-xs"
                        : cell.isCurrentMonth
                        ? "text-gray-800 dark:text-gray-200"
                        : "text-gray-400 dark:text-zinc-600"
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {hasBookings && (
                    <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      {dayBookings.length}
                    </span>
                  )}
                </div>

                {/* Reservation Event Chips */}
                <div className="mt-1 flex-1 space-y-1 overflow-hidden">
                  {dayBookings.slice(0, 2).map((r) => {
                    const time = new Date(r.date).toLocaleTimeString("en", {
                      hour: "numeric",
                      minute: "2-digit",
                    });
                    const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.booked;

                    return (
                      <div
                        key={r.unique_code || r.id}
                        className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-tight truncate ${cfg.bg}`}
                      >
                        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${cfg.dot}`} />
                        <span className="font-bold flex-shrink-0">{time}</span>
                        <span className="truncate">{r.customer_name}</span>
                      </div>
                    );
                  })}

                  {dayBookings.length > 2 && (
                    <span className="block text-[10px] font-semibold text-gray-400 pl-1">
                      +{dayBookings.length - 2} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Agenda Modal */}
      {selectedDayReservations && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-zinc-800">
              <div>
                <h4 className="text-base font-bold text-gray-900 dark:text-white">
                  {selectedDayLabel}
                </h4>
                <p className="text-xs text-gray-500">
                  {selectedDayReservations.length} reservations scheduled
                </p>
              </div>
              <button
                onClick={() => setSelectedDayReservations(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800"
              >
                <IconX size={18} stroke={iconStroke} />
              </button>
            </div>

            {/* List of day's reservations */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2">
              {selectedDayReservations.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  No reservations booked for this day.
                </div>
              ) : (
                selectedDayReservations.map((r) => {
                  const time = new Date(r.date).toLocaleTimeString("en", {
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.booked;

                  return (
                    <div
                      key={r.unique_code || r.id}
                      className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-gray-50/50 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-850"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 font-bold text-gray-800 dark:text-gray-200">
                          <IconClock size={13} stroke={iconStroke} className="text-restro-green" />
                          <span>{time}</span>
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white">
                            {r.customer_name}
                          </div>
                          <div className="text-[11px] text-gray-400 flex items-center gap-2">
                            <span>{r.table_title || "No table"}</span>
                            <span>•</span>
                            <span>{r.people_count}p</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${cfg.bg}`}>
                          {cfg.label}
                        </span>
                        <button
                          onClick={() => {
                            setSelectedDayReservations(null);
                            onUpdate(r);
                          }}
                          className="rounded-lg border border-gray-200 px-2 py-1 font-semibold text-gray-700 hover:bg-gray-100 dark:border-zinc-700 dark:text-gray-300"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 pt-3 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setSelectedDayReservations(null)}
                className="rounded-xl bg-restro-gray px-4 py-2 text-xs font-semibold text-restro-text hover:bg-gray-200 dark:hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
