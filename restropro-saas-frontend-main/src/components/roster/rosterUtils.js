// Shared date & time math for the staff roster screens.

export const SHIFT_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EF4444", // Rose
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#64748B", // Slate
];

// Format Date object into YYYY-MM-DD in local timezone
export function formatLocalDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Whole weeks between this week's Monday and the Monday of the week containing `date`
export function weekOffsetForDate(date) {
  const mondayOf = (d) => {
    const x = new Date(d);
    const day = x.getDay();
    x.setDate(x.getDate() + ((day === 0 ? -6 : 1) - day));
    x.setHours(0, 0, 0, 0);
    return x;
  };
  return Math.round((mondayOf(date) - mondayOf(new Date())) / (7 * 24 * 3600 * 1000));
}

// Week start (Monday) and end (Sunday) for a given offset from the current week
export function getWeekRange(offsetWeeks = 0, locale = "en-US") {
  const now = new Date();
  const todayStr = formatLocalDate(now);
  const day = now.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = formatLocalDate(d);
    days.push({
      index: i,
      date: dateStr,
      dayName: d.toLocaleDateString(locale, { weekday: "short" }),
      dayNum: d.getDate(),
      formattedDate: d.toLocaleDateString(locale, { month: "short", day: "numeric" }),
      isToday: dateStr === todayStr,
      isPast: dateStr < todayStr,
      isWeekend: i >= 5,
    });
  }

  return {
    startDate: formatLocalDate(monday),
    endDate: formatLocalDate(sunday),
    label: `${monday.toLocaleDateString(locale, { month: "short", day: "numeric" })} – ${sunday.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })}`,
    days,
    monday,
  };
}

export function timeToMinutes(hhmm = "00:00") {
  const [h, m] = String(hhmm).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Minutes covered by a shift; overnight (or end <= start) wraps into the next day
export function shiftDurationMinutes(start, end, isOvernight) {
  let mins = timeToMinutes(end) - timeToMinutes(start);
  if (isOvernight || mins <= 0) mins += 24 * 60;
  return mins;
}

export function formatHours(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}m`;
}

// [start, end) in minutes relative to midnight of the roster day
function intervalFor(a, dayShift = 0) {
  const start = timeToMinutes(a.start_time) + dayShift;
  return [start, start + shiftDurationMinutes(a.start_time, a.end_time, a.is_overnight)];
}

/**
 * Returns the assignments (from `existing`) that overlap the candidate shift on `date`.
 * Accounts for overnight shifts spilling in from the previous day.
 */
export function findOverlaps(candidate, date, existing) {
  const prevDate = formatLocalDate(new Date(parseLocalDate(date).getTime() - 24 * 3600 * 1000));
  const nextDate = formatLocalDate(new Date(parseLocalDate(date).getTime() + 24 * 3600 * 1000));
  const [cs, ce] = intervalFor(candidate);
  return existing.filter((a) => {
    if (a.id && candidate.id && a.id === candidate.id) return false;
    let offset;
    if (a.roster_date === date) offset = 0;
    else if (a.roster_date === prevDate) offset = -24 * 60;
    else if (a.roster_date === nextDate) offset = 24 * 60;
    else return false;
    const [s, e] = intervalFor(a, offset);
    return cs < e && s < ce;
  });
}

export function initials(name = "") {
  const parts = String(name).replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name).slice(0, 2).toUpperCase();
}

// Download the visible roster as CSV (staff rows x day columns)
export function downloadRosterCsv({ weekInfo, staff, cellsFor, hoursFor }) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Staff", "Role", ...weekInfo.days.map((d) => `${d.dayName} ${d.date}`), "Total Hours"];
  const rows = staff.map((s) => [
    s.name,
    s.designation || s.role,
    ...weekInfo.days.map((d) =>
      cellsFor(s.username, d.date)
        .map((a) => `${a.shift_name} ${a.start_time}-${a.end_time}${a.notes ? ` (${a.notes})` : ""}`)
        .join(" | ")
    ),
    (hoursFor(s.username) / 60).toFixed(2),
  ]);
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `roster_${weekInfo.startDate}_${weekInfo.endDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
