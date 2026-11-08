import { useSyncExternalStore } from "react";
import ApiClient from "./ApiClient";

/**
 * Multi-language menu content.
 *
 * Categories, menu items, variants and add-ons carry a `translations` object:
 *   { km: { title: "បាយឆា", description: "..." }, zh: { title: "炒饭" } }
 *
 * Tenant settings decide, per channel, which name is shown:
 *   "primary"      → default name only
 *   "<code>"       → translated name (falls back to the default name)
 *   "both:<code>"  → default name + translated name
 * Channels: "display" (POS / kitchen screens), "receipt", "kitchen" (KOT).
 */

export const LANGUAGE_PRESETS = [
  { code: "km", label: "ខ្មែរ (Khmer)" },
  { code: "en", label: "English" },
  { code: "zh", label: "中文 (Chinese)" },
  { code: "th", label: "ไทย (Thai)" },
  { code: "vi", label: "Tiếng Việt (Vietnamese)" },
  { code: "ja", label: "日本語 (Japanese)" },
  { code: "ko", label: "한국어 (Korean)" },
  { code: "fr", label: "Français (French)" },
  { code: "lo", label: "ລາວ (Lao)" },
  { code: "my", label: "မြန်မာ (Burmese)" },
  { code: "ms", label: "Bahasa Melayu" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "ar", label: "العربية (Arabic)" },
];

const DEVICE_DISPLAY_KEY = "RESTROPROSAAS__MENU_LANG_DISPLAY";
const SETTINGS_CACHE_KEY = "RESTROPROSAAS__MENU_LANG";

const DEFAULT_SETTINGS = {
  is_enabled: false,
  primary_label: "English",
  languages: [],
  display_mode: "primary",
  receipt_print_mode: "primary",
  kitchen_print_mode: "primary",
  allow_device_override: true,
};

let state = {
  settings: readCachedSettings(),
  maps: { items: {}, addons: {}, variants: {}, categories: {} },
  deviceDisplayMode: readDeviceMode(),
  loadedFromServer: false,
};
let version = 0;
const listeners = new Set();
let inflight = null;

function readCachedSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

function readDeviceMode() {
  try {
    return localStorage.getItem(DEVICE_DISPLAY_KEY) || null;
  } catch (_) {
    return null;
  }
}

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

function parseTranslations(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

/* ───────────────────────── settings ───────────────────────── */

export function getMenuLanguageSettings() {
  return state.settings;
}

export function setMenuLanguageSettings(settings) {
  const next = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  delete next.translations;
  state = { ...state, settings: next, loadedFromServer: true };
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(next));
  } catch (_) {}
  if (settings?.translations) setTranslationMaps(settings.translations);
  else emit();
}

function setTranslationMaps(maps) {
  state = {
    ...state,
    maps: {
      items: maps.items || {},
      addons: maps.addons || {},
      variants: maps.variants || {},
      categories: maps.categories || {},
    },
  };
  emit();
}

/** Builds the id → translations lookup from POS init data (no extra request). */
export function registerMenuTranslations({ menuItems = [], categories = [] } = {}) {
  const maps = { items: {}, addons: {}, variants: {}, categories: {} };
  const put = (bucket, row) => {
    const tr = parseTranslations(row?.translations);
    if (row?.id != null && tr && Object.keys(tr).length) bucket[row.id] = { title: row.title, translations: tr };
  };
  categories.forEach((c) => put(maps.categories, c));
  menuItems.forEach((item) => {
    put(maps.items, item);
    (item.addons || []).forEach((a) => put(maps.addons, a));
    (item.variants || []).forEach((v) => put(maps.variants, v));
  });
  setTranslationMaps(maps);
}

/**
 * Loads settings + translation map from the server once per page load.
 * Screens that print or show orders (orders, kitchen, invoices) call this.
 */
export function loadMenuLanguage({ force = false } = {}) {
  if (!force && state.loadedFromServer && Object.keys(state.maps.items).length + Object.keys(state.maps.addons).length + Object.keys(state.maps.variants).length > 0) {
    return Promise.resolve(state.settings);
  }
  if (!force && inflight) return inflight;
  inflight = ApiClient.get("/settings/menu-language", { params: { include: "translations" } })
    .then((res) => {
      setMenuLanguageSettings(res.data);
      return state.settings;
    })
    .catch(() => state.settings)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/* ───────────────────────── device override ───────────────────────── */

export function getDeviceDisplayMode() {
  return state.deviceDisplayMode;
}

/** Per-device screen language (null = follow store setting). */
export function setDeviceDisplayMode(mode) {
  try {
    if (mode) localStorage.setItem(DEVICE_DISPLAY_KEY, mode);
    else localStorage.removeItem(DEVICE_DISPLAY_KEY);
  } catch (_) {}
  state = { ...state, deviceDisplayMode: mode || null };
  emit();
}

/* ───────────────────────── mode resolution ───────────────────────── */

function isValidMode(mode, settings) {
  if (!mode || mode === "primary") return true;
  const code = mode.startsWith("both:") ? mode.slice(5) : mode;
  return (settings.languages || []).some((l) => l.code === code);
}

/** Effective mode for a channel: "display" | "receipt" | "kitchen". */
export function resolveMode(channel = "display", settings = state.settings) {
  if (!settings?.is_enabled) return "primary";
  let mode = "primary";
  if (channel === "receipt") mode = settings.receipt_print_mode;
  else if (channel === "kitchen") mode = settings.kitchen_print_mode;
  else {
    mode = settings.display_mode;
    if (settings.allow_device_override && state.deviceDisplayMode && isValidMode(state.deviceDisplayMode, settings)) {
      mode = state.deviceDisplayMode;
    }
  }
  return isValidMode(mode, settings) ? mode || "primary" : "primary";
}

/** Human label for a mode, e.g. "English + ខ្មែរ". */
export function describeMode(mode, settings = state.settings) {
  const primary = settings?.primary_label || "Default";
  if (!mode || mode === "primary") return primary;
  const both = mode.startsWith("both:");
  const code = both ? mode.slice(5) : mode;
  const lang = (settings?.languages || []).find((l) => l.code === code);
  const label = lang?.label || code;
  return both ? `${primary} + ${label}` : label;
}

/** All selectable modes for the current language list. */
export function getModeOptions(settings = state.settings) {
  const options = [{ value: "primary", label: describeMode("primary", settings) }];
  (settings?.languages || []).forEach((l) => {
    options.push({ value: l.code, label: describeMode(l.code, settings) });
    options.push({ value: `both:${l.code}`, label: describeMode(`both:${l.code}`, settings) });
  });
  return options;
}

/* ───────────────────────── text helpers ───────────────────────── */

/** Returns { primary, secondary } for a mode; secondary is set only for "both". */
export function localizeParts(primary, translations, mode, field = "title") {
  const base = primary ?? "";
  if (!mode || mode === "primary") return { primary: base, secondary: null };
  const both = mode.startsWith("both:");
  const code = both ? mode.slice(5) : mode;
  const tr = parseTranslations(translations)?.[code];
  const translated = typeof tr === "string" ? (field === "title" ? tr : "") : tr?.[field];
  if (!translated || !String(translated).trim()) return { primary: base, secondary: null };
  if (both) {
    return String(translated).trim() === String(base).trim()
      ? { primary: base, secondary: null }
      : { primary: base, secondary: translated };
  }
  return { primary: translated, secondary: null };
}

/** Single-string version: "both" joins as "Default / Translated". */
export function localizeText(primary, translations, mode, field = "title", joiner = " / ") {
  const { primary: p, secondary } = localizeParts(primary, translations, mode, field);
  return secondary ? `${p}${joiner}${secondary}` : p;
}

/** Name of a menu entity (item, category, variant, add-on) for the screen. */
export function displayName(entity, field = "title", channel = "display") {
  if (!entity) return "";
  return localizeText(entity[field], entity.translations, resolveMode(channel), field);
}

/** Primary + secondary lines for the screen (secondary only in "both" mode). */
export function displayParts(entity, field = "title", channel = "display") {
  if (!entity) return { primary: "", secondary: null };
  return localizeParts(entity[field], entity.translations, resolveMode(channel), field);
}

/* ───────────────────────── lookups by id ───────────────────────── */

function lookup(bucket, id) {
  if (id === undefined || id === null || id === "") return null;
  return state.maps[bucket]?.[id] || null;
}

/** Localizes a name using the id lookup, falling back to the given text. */
export function localizeById(bucket, id, fallbackTitle, mode) {
  const entry = lookup(bucket, id);
  if (!entry) return fallbackTitle;
  return localizeText(entry.title ?? fallbackTitle, entry.translations, mode);
}

/* ───────────────────────── print payloads ───────────────────────── */

function localizeAddon(addon, mode) {
  if (!addon || typeof addon !== "object") return addon;
  const translations = addon.translations || lookup("addons", addon.id)?.translations;
  const base = lookup("addons", addon.id)?.title ?? addon.title ?? addon.name;
  if (!translations) return addon;
  const text = localizeText(base, translations, mode);
  return { ...addon, title: text, ...(addon.name !== undefined ? { name: text } : {}) };
}

function localizeOrderItem(item, mode) {
  if (!item || typeof item !== "object") return item;
  const isServerRow = item.order_id !== undefined || item.item_title !== undefined;
  const menuItemId = item.item_id ?? (isServerRow ? undefined : item.id);
  const entry = lookup("items", menuItemId);
  const itemTranslations = (!isServerRow && item.translations) || entry?.translations;
  const out = { ...item };

  if (itemTranslations) {
    const base = entry?.title ?? item.title ?? item.item_title;
    const text = localizeText(base, itemTranslations, mode);
    if (item.title !== undefined || !isServerRow) out.title = text;
    if (item.item_title !== undefined) out.item_title = text;
    if (item.name !== undefined) out.name = text;
  }

  // Variant: POS cart → item.variant object; server rows → variant_id / variant_title
  if (item.variant && typeof item.variant === "object") {
    const vEntry = lookup("variants", item.variant.id);
    const vTr = item.variant.translations || vEntry?.translations;
    if (vTr) out.variant = { ...item.variant, title: localizeText(vEntry?.title ?? item.variant.title, vTr, mode) };
  }
  if (item.variant_title) {
    const vEntry = lookup("variants", item.variant_id);
    if (vEntry) out.variant_title = localizeText(vEntry.title ?? item.variant_title, vEntry.translations, mode);
  }

  if (Array.isArray(item.addons)) out.addons = item.addons.map((a) => localizeAddon(a, mode));
  if (Array.isArray(item.selectedAddons)) out.selectedAddons = item.selectedAddons.map((a) => localizeAddon(a, mode));
  return out;
}

/**
 * Returns a copy of a receipt / KOT payload with menu names in the language
 * configured for that print channel. Idempotent: names are always rebuilt from
 * the default name, so retrying a print does not double-translate.
 */
export async function localizePrintDetails(details, channel = "receipt") {
  if (!details || typeof details !== "object") return details;
  if (!state.loadedFromServer) {
    await loadMenuLanguage();
  } else if (state.settings.is_enabled && Object.keys(state.maps.items).length === 0) {
    await loadMenuLanguage({ force: true });
  }
  const mode = resolveMode(channel);
  if (mode === "primary") return details;

  const out = { ...details };
  ["cartItems", "items", "orderItems"].forEach((key) => {
    if (Array.isArray(details[key])) out[key] = details[key].map((i) => localizeOrderItem(i, mode));
  });
  if (Array.isArray(details.orders)) {
    out.orders = details.orders.map((o) =>
      o && Array.isArray(o.items) ? { ...o, items: o.items.map((i) => localizeOrderItem(i, mode)) } : o
    );
  }
  return out;
}

/** Localizes a server order row's item for screens (kitchen, orders). */
export function displayOrderItem(item, channel = "display") {
  return localizeOrderItem(item, resolveMode(channel));
}

/* ───────────────────────── React hook ───────────────────────── */

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getVersion() {
  return version;
}

/** Re-renders the caller whenever settings, translations or device mode change. */
export function useMenuLanguage() {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const settings = state.settings;
  return {
    settings,
    isEnabled: !!settings.is_enabled,
    displayMode: resolveMode("display"),
    deviceDisplayMode: state.deviceDisplayMode,
    displayName,
    displayParts,
    displayOrderItem,
  };
}

/** Search helper: matches the default name or any translated name. */
export function matchesMenuSearch(entity, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  if (String(entity?.title || "").toLowerCase().includes(q)) return true;
  const tr = parseTranslations(entity?.translations);
  return !!tr && Object.values(tr).some((v) => String((typeof v === "string" ? v : v?.title) || "").toLowerCase().includes(q));
}

/** Category name for a menu item row (uses `category_translations`). */
export function displayCategoryName(item, channel = "display") {
  if (!item) return "";
  return localizeText(item.category_title, item.category_translations, resolveMode(channel));
}
