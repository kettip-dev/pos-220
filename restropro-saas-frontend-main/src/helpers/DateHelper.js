import moment from "moment";
import "moment/locale/km";
import { getLanguage } from "./LocalizationHelper";

// Loading a moment locale also makes it the global default; keep English as the
// global so other moment.format() callers are unaffected, and pick per call.
moment.locale("en");

const momentLocale = () => {
  try {
    return getLanguage() === "km" ? "km" : "en";
  } catch {
    return "en";
  }
};

/**
 * Safely parses any date representation (Date, ISO string, MySQL datetime string)
 * into a valid JavaScript Date object across all browsers (including Safari).
 *
 * @param {Date|string|number|null|undefined} dateVal
 * @returns {Date|null}
 */
export function parseOrderDate(dateVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? null : dateVal;
  }

  if (typeof dateVal === "number") {
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof dateVal === "string") {
    const trimmed = dateVal.trim();
    if (!trimmed) return null;

    // ISO string with UTC 'Z' or explicit timezone offset (e.g. +07:00, -05:00)
    if (trimmed.includes("Z") || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? null : d;
    }

    // Standard MySQL datetime string "YYYY-MM-DD HH:MM:SS"
    // Safari requires "T" separator instead of space
    const isoCompatible = trimmed.replace(" ", "T");
    const d = new Date(isoCompatible);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Returns human-readable relative time (e.g., "Just now", "5 minutes ago", "2 hours ago").
 * Handles small clock skews / drift between server and client without showing "in a few seconds".
 *
 * @param {Date|string|number|null|undefined} dateVal
 * @param {string} [fallback="Just now"]
 * @returns {string}
 */
export function formatRelativeTime(dateVal, fallback = "Just now") {
  const parsed = parseOrderDate(dateVal);
  if (!parsed) return fallback;

  const diffMs = Date.now() - parsed.getTime();
  // Within 45 seconds past or 30 seconds future drift -> "Just now"
  if (diffMs >= -30000 && diffMs < 45000) {
    return fallback;
  }

  return moment(parsed).locale(momentLocale()).fromNow();
}

/**
 * Live elapsed time formatting for orders and table chips.
 * Returns "<1m", "5m", "1h 12m", "2d 4h".
 *
 * @param {Date|string|number|null|undefined} dateVal
 * @returns {string|null}
 */
export function formatElapsedOrderTime(dateVal) {
  const parsed = parseOrderDate(dateVal);
  if (!parsed) return null;

  const diffMs = Math.max(0, Date.now() - parsed.getTime());
  const totalMins = Math.floor(diffMs / 60000);

  if (totalMins < 1) return "<1m";
  if (totalMins < 60) return `${totalMins}m`;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

// Khmer day and month names, spelled out because the Intl/moment Khmer data is either
// missing in some browsers or abbreviates weekdays to a single, ambiguous letter.
const KM_WEEKDAYS = ["អាទិត្យ", "ច័ន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍"];
const KM_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];

const isKhmer = (lang) => String(lang || "").startsWith("km");

/** "Mon" / "ច័ន្ទ" */
export function formatWeekday(dateVal, lang) {
  const d = parseOrderDate(dateVal);
  if (!d) return "";
  return isKhmer(lang) ? KM_WEEKDAYS[d.getDay()] : d.toLocaleDateString("en-US", { weekday: "short" });
}

/** "Nov 4" / "4 វិច្ឆិកា", with the year appended when withYear is set */
export function formatShortDate(dateVal, lang, withYear = false) {
  const d = parseOrderDate(dateVal);
  if (!d) return "";
  if (isKhmer(lang)) {
    return `${d.getDate()} ${KM_MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ""}`;
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear && { year: "numeric" }) });
}

/** "08:51 AM" / "08:51 ព្រឹក" */
export function formatClockTime(dateVal, lang) {
  const d = parseOrderDate(dateVal);
  if (!d) return "";
  if (isKhmer(lang)) {
    const h = d.getHours();
    const h12 = String(h % 12 || 12).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h12}:${m} ${h < 12 ? "ព្រឹក" : "ល្ងាច"}`;
  }
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}
