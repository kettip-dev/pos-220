import moment from "moment";

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

  return moment(parsed).fromNow();
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
