import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconLanguage, IconCheck, IconChevronDown } from "@tabler/icons-react";
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
export default function MenuLanguageSwitcher({ className = "", bare = false }) {
  const { t } = useTranslation();
  const { settings, isEnabled, deviceDisplayMode, displayMode } = useMenuLanguage();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const panelRef = useRef(null);

  // The menu is portaled to <body> with fixed positioning so the catalog's
  // sticky/overflow-hidden containers can neither cover nor clip it.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const r = rootRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(288, window.innerWidth - 32);
      const left = Math.max(16, Math.min(r.right - width, window.innerWidth - width - 16));
      setPos({ top: r.bottom + 8, left, width, maxHeight: Math.max(200, window.innerHeight - r.bottom - 24) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!isEnabled || !settings.allow_device_override || !(settings.languages || []).length) return null;

  const options = getModeOptions(settings);
  const single = options.filter((o) => o.kind === "single");
  const both = options.filter((o) => o.kind === "both");
  const current = describeMode(displayMode, settings);
  const selected = deviceDisplayMode || "";

  const choose = (value) => {
    setDeviceDisplayMode(value || null);
    setOpen(false);
  };

  const Row = ({ value, label, hint }) => {
    const active = selected === value;
    return (
      <button
        type="button"
        role="menuitemradio"
        aria-checked={active}
        onClick={() => choose(value)}
        className={`w-full min-h-[44px] flex items-center gap-3 px-3 rounded-lg text-left transition active:scale-[0.98] ${
          active
            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
            : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
      >
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium truncate">{label}</span>
          {hint && (
            <span className={`block text-xs truncate ${active ? "opacity-70" : "text-slate-500 dark:text-slate-400"}`}>
              {hint}
            </span>
          )}
        </span>
        <IconCheck size={18} stroke={2.25} className={`shrink-0 ${active ? "opacity-100" : "opacity-0"}`} />
      </button>
    );
  };

  const GroupLabel = ({ children }) => (
    <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
      {children}
    </div>
  );

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("menu_language.device_select_aria")}
        title={t("menu_language.current_language", { mode: current })}
        onClick={() => setOpen((v) => !v)}
        className={`min-h-[42px] min-w-[42px] flex items-center gap-1.5 px-2.5 transition active:scale-95 text-slate-600 dark:text-slate-300 ${
          bare
            ? "rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            : "rounded-xl border border-[#D4D7DC] dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-[#F4F5F8] dark:hover:bg-slate-800"
        } ${open ? "bg-slate-100 dark:bg-slate-800" : ""}`}
      >
        <IconLanguage size={20} stroke={1.75} className="shrink-0" />
        <span className="hidden 2xl:inline text-xs font-medium max-w-[110px] truncate">{current}</span>
        <IconChevronDown
          size={14}
          stroke={2}
          className={`hidden 2xl:inline shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          role="menu"
          style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          className="fixed z-[1000] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1.5"
        >
          <Row
            value=""
            label={t("menu_language.store_default_label", "Store default")}
            hint={describeMode(settings.display_mode, settings)}
          />

          <div className="my-1.5 h-px bg-slate-100 dark:bg-slate-800" />
          <GroupLabel>{t("menu_language.single_language", "One language")}</GroupLabel>
          {single.map((o) => (
            <Row key={o.value} value={o.value} label={o.label} />
          ))}

          {both.length > 0 && (
            <>
              <div className="my-1.5 h-px bg-slate-100 dark:bg-slate-800" />
              <GroupLabel>{t("menu_language.bilingual", "Two languages")}</GroupLabel>
              {both.map((o) => (
                <Row key={o.value} value={o.value} label={o.label} />
              ))}
            </>
          )}

          <p className="px-3 pt-2 pb-1.5 text-xs text-slate-400 dark:text-slate-500">
            {t("menu_language.device_only_hint", "Only this screen changes. Printing is not affected.")}
          </p>
        </div>,
        document.body
      )}
    </div>
  );
}
