import { parseOrderDate } from "../../helpers/DateHelper";

export const DONE_STATUSES = ["completed", "delivered", "cancelled"];
export const ACTIVE_STATUSES = ["created", "preparing"];

export const isItemDone = (item) => DONE_STATUSES.includes(item?.status);
export const isItemActive = (item) => ACTIVE_STATUSES.includes(item?.status);

export const toMs = (value) => {
  const d = parseOrderDate(value);
  return d ? d.getTime() : null;
};

export const formatDuration = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

// `t` is optional so the helpers stay usable outside React; English is the fallback.
const fallbackT = (_key, def, vars = {}) => String(def).replace(/{{(\w+)}}/g, (_, k) => vars[k] ?? "");

export const formatAgo = (ms, nowMs, t = fallbackT) => {
  if (!ms) return "";
  const diff = Math.max(0, Math.floor((nowMs - ms) / 1000));
  if (diff < 60) return t("kitchen.kds.just_now", "just now");
  const m = Math.floor(diff / 60);
  if (m < 60) return t("kitchen.kds.minutes_ago", "{{m}}m ago", { m });
  const h = Math.floor(m / 60);
  return t("kitchen.kds.hours_ago", "{{h}}h {{m}}m ago", { h, m: m % 60 });
};

/**
 * Ticket clock starts at the earliest *active* item on the ticket, so a table
 * that orders a second round an hour later does not show up as instantly late.
 */
export const getTicketStartMs = (order, items) => {
  const active = (items || []).filter(isItemActive);
  const source = active.length > 0 ? active : items || [];
  const itemTimes = source.map((i) => toMs(i.date)).filter(Boolean);
  if (itemTimes.length > 0) return Math.min(...itemTimes);
  return toMs(order?.date) || Date.now();
};

/** Item was fired after the original ticket (second round / add-on). */
export const isAddedLater = (order, item) => {
  const orderMs = toMs(order?.date);
  const itemMs = toMs(item?.date);
  if (!orderMs || !itemMs) return false;
  return itemMs - orderMs > 120 * 1000;
};

export const getUrgency = (elapsedSec, settings) => {
  const warnSec = (settings?.warnMinutes ?? 5) * 60;
  const lateSec = (settings?.lateMinutes ?? 10) * 60;
  if (elapsedSec >= lateSec) return "late";
  if (elapsedSec >= warnSec) return "warning";
  return "ontime";
};

export const DINING_TYPES = [
  { id: "all", label: "All" },
  { id: "dinein", label: "Dine-in" },
  { id: "takeaway", label: "Takeaway" },
  { id: "delivery", label: "Delivery" },
];

export const DEFAULT_KDS_SETTINGS = {
  warnMinutes: 5,
  lateMinutes: 10,
  textSize: "md", // sm | md | lg
  sortOrder: "oldest", // oldest | newest
  showAllDay: true, // "all day" counts of what is still to cook
};

/** When an item started counting against its target (fired time for held courses). */
const itemStartMs = (item) => toMs(item?.fired_at) || toMs(item?.date);

/** Extra minutes the kitchen added to a line (delay / +time). */
export const itemDelayMinutes = (item) => Math.max(0, Number(item?.delay_minutes) || 0);

/** Cooking-time target in minutes including any delay, or null when the item has no time set. */
export const itemTargetMinutes = (item) => {
  const prep = Number(item?.prep_minutes);
  if (!prep) return null;
  return prep + itemDelayMinutes(item);
};

/** Seconds an item has been cooking against its own target (null = no target). */
export const itemOverTarget = (item, nowMs) => {
  const target = itemTargetMinutes(item);
  if (!target || !["created", "preparing"].includes(item?.status)) return null;
  const startMs = itemStartMs(item);
  if (!startMs) return null;
  return Math.floor((nowMs - startMs) / 1000) - target * 60;
};

/** Share of the target time after which a ticket turns amber. */
export const WARN_RATIO = 0.7;

/**
 * Ticket timing from its items' own cooking times.
 *  - If any open item has a cooking time, the ticket is due when its slowest item is due
 *    (amber after 70% of that time, red once it is past).
 *  - Otherwise the screen's warn/late minutes apply, pushed back by any delay the kitchen added.
 * Returns { urgency, dueMs, delayMinutes, delayReason }.
 */
export const getTicketTiming = (items, startMs, nowMs, settings) => {
  const open = (items || []).filter(isItemActive);
  let delayMinutes = 0;
  let delayReason = null;
  open.forEach((i) => {
    const d = itemDelayMinutes(i);
    if (d > delayMinutes) {
      delayMinutes = d;
      delayReason = i.delay_reason || null;
    }
  });

  let dueMs = null;
  open.forEach((i) => {
    const target = itemTargetMinutes(i);
    const s = itemStartMs(i) || startMs;
    if (target && s) dueMs = Math.max(dueMs || 0, s + target * 60000);
  });

  if (dueMs) {
    const total = Math.max(60000, dueMs - startMs);
    const elapsed = nowMs - startMs;
    const urgency = nowMs >= dueMs ? "late" : elapsed >= total * WARN_RATIO ? "warning" : "ontime";
    return { urgency, dueMs, delayMinutes, delayReason };
  }

  const elapsedSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const shifted = {
    warnMinutes: (settings?.warnMinutes ?? 5) + delayMinutes,
    lateMinutes: (settings?.lateMinutes ?? 10) + delayMinutes,
  };
  return { urgency: getUrgency(elapsedSec, shifted), dueMs: null, delayMinutes, delayReason };
};

/** Key used to group the same dish across tickets for the all-day bar. */
export const allDayKey = (item) => `${item?.item_title || ""}|${item?.variant_title || ""}`;

export const loadKdsSettings = () => {
  try {
    const raw = localStorage.getItem("kds_settings");
    if (!raw) return { ...DEFAULT_KDS_SETTINGS };
    return { ...DEFAULT_KDS_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_KDS_SETTINGS };
  }
};

export const saveKdsSettings = (settings) => {
  try {
    localStorage.setItem("kds_settings", JSON.stringify(settings));
  } catch (e) {
    /* storage unavailable (private mode) — settings stay in memory */
  }
};

/** Items on this ticket that belong to the station currently on screen. */
export const filterItemsForStation = (items, stationId) => {
  if (stationId === "all") return items;
  if (stationId === "unassigned") return items.filter((i) => !i.kitchen_station_id);
  const idNum = Number(stationId);
  return items.filter((i) => Number(i.kitchen_station_id) === idNum);
};

export const filterCompanionItems = (items, stationId) => {
  if (stationId === "all") return [];
  if (stationId === "unassigned") return items.filter((i) => Boolean(i.kitchen_station_id));
  const idNum = Number(stationId);
  return items.filter((i) => Number(i.kitchen_station_id) !== idNum);
};

export const getOrderTitle = (order, t = fallbackT) => {
  if (order?.table_id && order?.table_title) return order.table_title;
  if (order?.customer_name) return order.customer_name;
  return diningLabel(order?.delivery_type, t);
};

export const diningLabel = (type, t = fallbackT) => {
  const known = DINING_TYPES.find((d) => d.id === type && d.id !== "all");
  if (known) return t(`kitchen.kds.dining_${known.id}`, known.label);
  return type ? String(type) : t("kitchen.kds.order", "Order");
};

/** English labels the backend seeds for new tenants; matching labels are shown translated. */
export const DEFAULT_DELAY_REASON_LABELS = {
  ingredients: "Waiting for ingredients",
  no_gas: "No gas / equipment problem",
  busy: "Kitchen very busy",
  remake: "Remaking the dish",
  waiting_table: "Waiting for the rest of the table",
};

/** Delay reason for display: stock reasons are translated unless the owner renamed them. */
export const delayReasonLabel = (label, code, t = fallbackT) => {
  if (!label) return "";
  const stockCode =
    code && DEFAULT_DELAY_REASON_LABELS[code] === label
      ? code
      : Object.keys(DEFAULT_DELAY_REASON_LABELS).find((k) => DEFAULT_DELAY_REASON_LABELS[k] === label);
  return stockCode ? t(`kitchen.delay.reason_${stockCode}`, label) : label;
};
