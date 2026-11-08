import React from "react";
import { IconLanguage } from "@tabler/icons-react";
import { useMenuLanguageSettings } from "../../controllers/settings.controller";

/**
 * Translation inputs for a menu entity (category, item, variant, add-on).
 * Renders nothing until multi-language menu is enabled in Settings → Menu Languages.
 *
 * value:    { km: { title, description }, ... } (may be null / JSON string)
 * onChange: (nextValue) => void
 * fields:   ["title"] or ["title", "description"]
 */
export default function TranslationFields({
  value,
  onChange,
  fields = ["title"],
  compact = false,
  className = "",
  primaryTitle = "",
}) {
  const { data: settings } = useMenuLanguageSettings();
  const languages = settings?.is_enabled ? settings.languages || [] : [];
  if (languages.length === 0) return null;

  const current = normalizeTranslations(value);

  const update = (code, field, text) => {
    const next = { ...current, [code]: { ...(current[code] || {}), [field]: text } };
    onChange?.(next);
  };

  const inputCls =
    "text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green min-h-[42px] text-restro-text";

  return (
    <div className={`rounded-xl border border-dashed border-restro-border-green p-3 ${className}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-restro-text/70 mb-2">
        <IconLanguage size={16} stroke={1.75} />
        Translations
      </div>
      <div className={compact ? "flex flex-col gap-2" : "grid grid-cols-1 gap-3"}>
        {languages.map((lang) => (
          <div key={lang.code} className="flex flex-col gap-1.5">
            <label className="text-xs text-restro-text/60" htmlFor={`tr-${lang.code}-title`}>
              {lang.label}
            </label>
            {fields.includes("title") && (
              <input
                id={`tr-${lang.code}-title`}
                type="text"
                lang={lang.code}
                value={current[lang.code]?.title || ""}
                onChange={(e) => update(lang.code, "title", e.target.value)}
                placeholder={primaryTitle ? `${primaryTitle} (${lang.label})` : `Name in ${lang.label}`}
                className={inputCls}
                maxLength={255}
              />
            )}
            {fields.includes("description") && (
              <textarea
                lang={lang.code}
                value={current[lang.code]?.description || ""}
                onChange={(e) => update(lang.code, "description", e.target.value)}
                placeholder={`Description in ${lang.label}`}
                rows={2}
                className={`${inputCls} resize-none`}
                maxLength={1000}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function normalizeTranslations(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }
  return typeof value === "object" ? value : {};
}

/** True when multi-language editing is on (so callers can send translations). */
export function useTranslationsEnabled() {
  const { data: settings } = useMenuLanguageSettings();
  return !!(settings?.is_enabled && (settings.languages || []).length > 0);
}
