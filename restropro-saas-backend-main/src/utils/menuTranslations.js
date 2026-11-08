/**
 * Helpers for multi-language menu content stored in `translations` JSON columns.
 * Shape: { "km": { "title": "បាយឆា", "description": "..." }, "zh": { "title": "炒饭" } }
 */

const LANG_CODE_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;
const MODE_RE = /^(primary|both:[a-z]{2,3}(-[A-Za-z0-9]{2,8})?|[a-z]{2,3}(-[A-Za-z0-9]{2,8})?)$/;
const MAX_TITLE = 255;
const MAX_DESCRIPTION = 1000;
const MAX_LANGUAGES = 10;

function parseMaybeJson(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

/**
 * Normalises a translations payload from a request.
 * Returns `undefined` when the field was not sent (leave column untouched),
 * otherwise a JSON string, or null when nothing is left after cleaning.
 */
function sanitizeTranslations(input, { allowDescription = false } = {}) {
  if (input === undefined) return undefined;
  const parsed = parseMaybeJson(input);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const clean = {};
  for (const [code, entry] of Object.entries(parsed)) {
    if (!LANG_CODE_RE.test(code)) continue;
    const value = typeof entry === "string" ? { title: entry } : entry;
    if (!value || typeof value !== "object") continue;

    const out = {};
    const title = typeof value.title === "string" ? value.title.trim().slice(0, MAX_TITLE) : "";
    if (title) out.title = title;
    if (allowDescription) {
      const description =
        typeof value.description === "string" ? value.description.trim().slice(0, MAX_DESCRIPTION) : "";
      if (description) out.description = description;
    }
    if (Object.keys(out).length) clean[code] = out;
  }
  return Object.keys(clean).length ? JSON.stringify(clean) : null;
}

const DEFAULT_SETTINGS = Object.freeze({
  is_enabled: false,
  primary_label: "English",
  languages: [],
  display_mode: "primary",
  receipt_print_mode: "primary",
  kitchen_print_mode: "primary",
  allow_device_override: true,
});

function sanitizeMode(mode, languageCodes) {
  if (typeof mode !== "string" || !MODE_RE.test(mode)) return "primary";
  if (mode === "primary") return mode;
  const code = mode.startsWith("both:") ? mode.slice(5) : mode;
  return languageCodes.includes(code) ? mode : "primary";
}

/** Cleans the settings body posted from the Menu Languages page. */
function sanitizeLanguageSettings(body = {}) {
  const seen = new Set();
  const languages = (Array.isArray(body.languages) ? body.languages : [])
    .map((l) => ({
      code: String(l?.code || "").trim(),
      label: String(l?.label || "").trim().slice(0, 50),
    }))
    .filter((l) => LANG_CODE_RE.test(l.code) && l.label && !seen.has(l.code) && seen.add(l.code))
    .slice(0, MAX_LANGUAGES);
  const codes = languages.map((l) => l.code);

  return {
    is_enabled: !!body.is_enabled,
    primary_label: String(body.primary_label || DEFAULT_SETTINGS.primary_label).trim().slice(0, 50) || "English",
    languages,
    display_mode: sanitizeMode(body.display_mode, codes),
    receipt_print_mode: sanitizeMode(body.receipt_print_mode, codes),
    kitchen_print_mode: sanitizeMode(body.kitchen_print_mode, codes),
    allow_device_override: body.allow_device_override === undefined ? true : !!body.allow_device_override,
  };
}

/** DB row → API shape. */
function formatLanguageSettings(row) {
  if (!row) return { ...DEFAULT_SETTINGS, languages: [] };
  const languages = parseMaybeJson(row.languages);
  return {
    is_enabled: !!row.is_enabled,
    primary_label: row.primary_label || DEFAULT_SETTINGS.primary_label,
    languages: Array.isArray(languages) ? languages : [],
    display_mode: row.display_mode || "primary",
    receipt_print_mode: row.receipt_print_mode || "primary",
    kitchen_print_mode: row.kitchen_print_mode || "primary",
    allow_device_override: row.allow_device_override === undefined ? true : !!row.allow_device_override,
  };
}

module.exports = {
  parseMaybeJson,
  sanitizeTranslations,
  sanitizeLanguageSettings,
  formatLanguageSettings,
  DEFAULT_SETTINGS,
};
