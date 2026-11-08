import React from "react";
import { IconLanguage } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  useMenuLanguage,
  getModeOptions,
  describeMode,
  setDeviceDisplayMode,
} from "../../helpers/MenuLanguageHelper";

/**
 * Per-device menu language picker for the POS / kitchen screens.
 * Hidden unless multi-language menu is on and the store allows device overrides.
 * The choice is stored on this device only; printing is not affected.
 */
export default function MenuLanguageSwitcher({ className = "" }) {
  const { t } = useTranslation();
  const { settings, isEnabled, deviceDisplayMode, displayMode } = useMenuLanguage();
  if (!isEnabled || !settings.allow_device_override || !(settings.languages || []).length) return null;

  const storeDefault = describeMode(settings.display_mode, settings);
  const options = getModeOptions(settings);

  return (
    <label
      className={`relative min-h-[42px] min-w-[42px] rounded-xl border border-[#D4D7DC] dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-[#F4F5F8] dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300 flex items-center gap-1.5 px-2.5 transition active:scale-95 cursor-pointer ${className}`}
      title={t("menu_language.current_language", { mode: describeMode(displayMode, settings) })}
    >
      <IconLanguage size={18} stroke={1.75} className="shrink-0" />
      <span className="hidden lg:inline text-xs font-semibold max-w-[110px] truncate">
        {describeMode(displayMode, settings)}
      </span>
      <select
        aria-label={t("menu_language.device_select_aria")}
        value={deviceDisplayMode || ""}
        onChange={(e) => setDeviceDisplayMode(e.target.value || null)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      >
        <option value="">{t("menu_language.store_default", { mode: storeDefault })}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
