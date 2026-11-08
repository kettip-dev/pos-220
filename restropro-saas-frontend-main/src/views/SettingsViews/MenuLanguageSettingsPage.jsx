import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import {
  IconArrowLeft,
  IconCheck,
  IconChefHat,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconLanguage,
  IconPlus,
  IconReceipt,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import Page from "../../components/Page";
import { iconStroke } from "../../config/config";
import { saveMenuLanguageSettings, useMenuLanguageSettings } from "../../controllers/settings.controller";
import {
  LANGUAGE_PRESETS,
  getModeOptions,
  localizeParts,
  setMenuLanguageSettings as applyMenuLanguageSettings,
} from "../../helpers/MenuLanguageHelper";

// Field base without a width, so callers can size each input.
const fieldCls =
  "text-sm rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green min-h-[42px] text-restro-text disabled:opacity-60";

const cardCls = "rounded-2xl border border-restro-border-green bg-restro-card-bg";

const SAMPLE = {
  title: "Fried Rice",
  translations: {
    km: { title: "បាយឆា" },
    zh: { title: "炒饭" },
    th: { title: "ข้าวผัด" },
    vi: { title: "Cơm chiên" },
    ja: { title: "チャーハン" },
    ko: { title: "볶음밥" },
    fr: { title: "Riz frit" },
    lo: { title: "ເຂົ້າຂົ້ວ" },
    my: { title: "ထမင်းကြော်" },
    ms: { title: "Nasi goreng" },
    id: { title: "Nasi goreng" },
    hi: { title: "फ्राइड राइस" },
    ar: { title: "أرز مقلي" },
  },
};

const norm = (s) => String(s || "").trim().toLowerCase();

/** A preset duplicates the default language when their names match, e.g. "English". */
function isSameAsDefault(preset, primaryLabel) {
  const p = norm(primaryLabel);
  if (!p) return false;
  const label = norm(preset.label);
  const inner = (label.match(/\(([^)]+)\)/) || [])[1] || "";
  return label === p || inner === p || label.split(" (")[0] === p;
}

function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="min-h-[42px] min-w-[56px] flex items-center justify-center shrink-0 transition active:scale-95 disabled:opacity-50"
    >
      <span
        className={clsx(
          "relative w-12 h-7 rounded-full transition-colors",
          checked ? "bg-[#59A352]" : "bg-gray-300 dark:bg-gray-600"
        )}
      >
        <span
          className={clsx(
            "absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5"
          )}
        />
      </span>
    </button>
  );
}

function SectionHeader({ title, description, children }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-bold text-restro-text">{title}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function ModeCard({ icon, title, description, value, onChange, options, disabled, languages }) {
  const { t } = useTranslation();
  const both = value?.startsWith("both:");
  const code = both ? value.slice(5) : value;
  const lang = languages.find((l) => l.code === code);
  const sampleTr = SAMPLE.translations[code]
    ? SAMPLE.translations
    : lang
      ? { [code]: { title: `${SAMPLE.title} (${lang.label})` } }
      : {};
  const { primary, secondary } = localizeParts(SAMPLE.title, sampleTr, value);

  return (
    <div className={clsx(cardCls, "p-4 flex flex-col gap-3 h-full")}>
      <div className="flex items-start gap-3 flex-1">
        <div className="w-10 h-10 rounded-xl bg-restro-green/10 text-restro-green flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-restro-text leading-tight">{title}</p>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
      </div>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(fieldCls, "w-full")}
        disabled={disabled}
        aria-label={title}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <div className="rounded-xl border border-dashed border-restro-border-green bg-restro-gray/60 dark:bg-black/30 px-3 py-2.5 min-h-[72px]">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {t("menu_language.preview", "Preview")}
        </p>
        <div className="flex items-baseline justify-between gap-3 mt-1">
          <div className="min-w-0">
            <p className="text-sm font-bold text-restro-text truncate">{primary}</p>
            {secondary && <p className="text-xs text-gray-500 truncate">{secondary}</p>}
          </div>
          <span className="text-xs font-semibold text-gray-400 tabular-nums shrink-0">1 ×</span>
        </div>
      </div>
    </div>
  );
}

export default function MenuLanguageSettingsPage() {
  const { t } = useTranslation();
  const { data, error, isLoading, mutate } = useMenuLanguageSettings();
  const [form, setForm] = useState(null);
  const [presetCode, setPresetCode] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !form) setForm({ ...data, languages: data.languages || [] });
  }, [data, form]);

  const modeOptions = useMemo(() => (form ? getModeOptions(form) : []), [form]);
  const dirty = useMemo(() => {
    if (!form || !data) return false;
    const pick = (s) =>
      JSON.stringify({
        is_enabled: !!s.is_enabled,
        primary_label: s.primary_label || "",
        languages: s.languages || [],
        display_mode: s.display_mode,
        receipt_print_mode: s.receipt_print_mode,
        kitchen_print_mode: s.kitchen_print_mode,
        allow_device_override: !!s.allow_device_override,
      });
    return pick(form) !== pick(data);
  }, [form, data]);

  if (isLoading || (!form && !error)) {
    return <Page className="p-4 md:p-8 max-w-5xl mx-auto">{t("menu_language.loading", "Please wait...")}</Page>;
  }
  if (error) {
    return (
      <Page className="p-4 md:p-8 max-w-5xl mx-auto">
        {t("menu_language.load_failed", "Failed to load menu language settings.")}
      </Page>
    );
  }

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const codes = form.languages.map((l) => l.code);
  const availablePresets = LANGUAGE_PRESETS.filter(
    (p) => !codes.includes(p.code) && !isSameAsDefault(p, form.primary_label)
  );
  const isOff = !form.is_enabled;

  const addLanguage = (code, label) => {
    const c = norm(code);
    const l = String(label || "").trim();
    if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(c)) return toast.error(t("menu_language.err_code")), false;
    if (!l) return toast.error(t("menu_language.err_name")), false;
    if (codes.includes(c) || norm(l) === norm(form.primary_label)) return toast.error(t("menu_language.err_duplicate")), false;
    if (form.languages.length >= 10) return toast.error(t("menu_language.err_max")), false;
    set({ languages: [...form.languages, { code: c, label: l }] });
    return true;
  };

  // A removed language can no longer be a display / print mode.
  const removeLanguage = (code) => {
    const fix = (mode) => (mode === code || mode === `both:${code}` ? "primary" : mode);
    set({
      languages: form.languages.filter((l) => l.code !== code),
      display_mode: fix(form.display_mode),
      receipt_print_mode: fix(form.receipt_print_mode),
      kitchen_print_mode: fix(form.kitchen_print_mode),
    });
  };

  const renameLanguage = (code, label) =>
    set({ languages: form.languages.map((l) => (l.code === code ? { ...l, label } : l)) });

  const handleSave = async () => {
    if (form.is_enabled && form.languages.length === 0) {
      return toast.error(t("menu_language.err_need_one"));
    }
    setSaving(true);
    try {
      const res = await saveMenuLanguageSettings(form);
      const saved = res.data?.settings || form;
      applyMenuLanguageSettings(saved);
      await mutate(saved, { revalidate: true });
      setForm({ ...saved });
      toast.success(t("menu_language.saved"));
    } catch (err) {
      toast.error(err?.response?.data?.message || t("menu_language.save_failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page className="p-4 md:p-8 max-w-5xl mx-auto space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Link
            to="/dashboard/settings"
            aria-label={t("menu_language.back", "Back to settings")}
            className="w-[42px] h-[42px] rounded-2xl flex items-center justify-center bg-gray-100 dark:bg-[#333] hover:bg-gray-200 dark:hover:bg-[#444] transition-colors text-slate-600 dark:text-gray-300 active:scale-95 shrink-0"
          >
            <IconArrowLeft stroke={iconStroke} className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-restro-green-dark dark:text-white leading-tight">
              {t("menu_language.title", "Menu Languages")}
            </h1>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 max-w-2xl">{t("menu_language.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
          {dirty && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              {t("menu_language.unsaved", "Unsaved changes")}
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="min-h-[42px] px-5 rounded-2xl bg-restro-green hover:bg-restro-green-button-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2 transition active:scale-95"
          >
            <IconCheck size={18} stroke={iconStroke} />
            {saving ? t("menu_language.saving", "Saving...") : t("menu_language.save", "Save")}
          </button>
        </div>
      </div>

      {/* ── Enable ── */}
      <div className={clsx(cardCls, "p-4 flex items-center justify-between gap-4")}>
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-restro-green/10 text-restro-green flex items-center justify-center shrink-0">
            <IconLanguage stroke={iconStroke} size={22} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-restro-text">{t("menu_language.enable_title")}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t("menu_language.enable_desc")}</p>
          </div>
        </div>
        <Toggle checked={!!form.is_enabled} onChange={(v) => set({ is_enabled: v })} label={t("menu_language.enable_aria")} />
      </div>

      {isOff && (
        <p className="text-xs text-gray-500 -mt-2 px-1">
          {t("menu_language.off_hint", "Turn this on to use the languages below. You can set them up first and save.")}
        </p>
      )}

      {/* ── Languages ── */}
      <section className={clsx(cardCls, "p-4 space-y-4 transition-opacity", isOff && "opacity-70")}>
        <SectionHeader title={t("menu_language.languages_title")} description={t("menu_language.languages_desc")}>
          <span className="text-xs font-semibold text-gray-400 tabular-nums shrink-0 mt-0.5">
            {form.languages.length}/10
          </span>
        </SectionHeader>

        <ul className="rounded-xl border border-restro-border-green divide-y divide-restro-border-green overflow-hidden">
          {/* Default language */}
          <li className="flex items-center gap-3 px-3 py-2 bg-restro-green/5">
            <span className="min-w-[56px] shrink-0 text-center text-[10px] font-bold uppercase tracking-wide whitespace-nowrap px-2 py-1 rounded-md bg-restro-green text-white">
              {t("menu_language.default_badge", "Default")}
            </span>
            <input
              id="primary-label"
              value={form.primary_label}
              onChange={(e) => set({ primary_label: e.target.value })}
              className={clsx(fieldCls, "flex-1 min-w-0")}
              placeholder="English"
              maxLength={50}
              aria-label={t("menu_language.default_language_name")}
            />
            <span className="w-[42px] shrink-0" aria-hidden="true" />
          </li>

          {form.languages.map((l) => (
            <li key={l.code} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-[56px] shrink-0 text-center text-xs font-mono font-bold uppercase px-1.5 py-1 rounded-md bg-restro-gray text-restro-green border border-restro-border-green">
                {l.code}
              </span>
              <input
                value={l.label}
                onChange={(e) => renameLanguage(l.code, e.target.value)}
                className={clsx(fieldCls, "flex-1 min-w-0")}
                maxLength={50}
                aria-label={t("menu_language.name_for", { code: l.code })}
              />
              <button
                type="button"
                onClick={() => removeLanguage(l.code)}
                aria-label={t("menu_language.remove_named", { name: l.label })}
                title={t("menu_language.remove_named", { name: l.label })}
                className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition active:scale-95 shrink-0"
              >
                <IconTrash size={18} stroke={iconStroke} />
              </button>
            </li>
          ))}
        </ul>

        {/* Add language */}
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={presetCode}
            onChange={(e) => setPresetCode(e.target.value)}
            className={clsx(fieldCls, "w-full sm:flex-1 min-w-0")}
            aria-label={t("menu_language.add_language_placeholder")}
          >
            <option value="">{t("menu_language.add_language_placeholder")}</option>
            {availablePresets.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!presetCode}
              onClick={() => {
                const p = LANGUAGE_PRESETS.find((x) => x.code === presetCode);
                if (p && addLanguage(p.code, p.label)) setPresetCode("");
              }}
              className="flex-1 sm:flex-none min-h-[42px] px-5 rounded-xl bg-restro-green hover:bg-restro-green-button-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <IconPlus size={16} stroke={iconStroke} /> {t("menu_language.add")}
            </button>
            {!showCustom && (
              <button
                type="button"
                onClick={() => setShowCustom(true)}
                className="flex-1 sm:flex-none min-h-[42px] px-4 rounded-xl border border-restro-border-green bg-restro-gray hover:bg-restro-button-hover text-restro-text text-sm font-semibold transition active:scale-95 whitespace-nowrap"
              >
                {t("menu_language.other_language", "Other language")}
              </button>
            )}
          </div>
        </div>

        {showCustom && (
          <div className="rounded-xl border border-dashed border-restro-border-green p-3 flex flex-col sm:flex-row gap-2">
            <input
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              className={clsx(fieldCls, "w-full sm:w-28 shrink-0 font-mono lowercase")}
              placeholder={t("menu_language.custom_code")}
              aria-label={t("menu_language.custom_code")}
              maxLength={12}
              autoFocus
            />
            <input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              className={clsx(fieldCls, "w-full sm:flex-1 min-w-0")}
              placeholder={t("menu_language.custom_name")}
              aria-label={t("menu_language.custom_name")}
              maxLength={50}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!customCode || !customLabel}
                onClick={() => {
                  if (addLanguage(customCode, customLabel)) {
                    setCustomCode("");
                    setCustomLabel("");
                    setShowCustom(false);
                  }
                }}
                className="flex-1 sm:flex-none min-h-[42px] px-5 rounded-xl bg-restro-green hover:bg-restro-green-button-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <IconPlus size={16} stroke={iconStroke} /> {t("menu_language.add")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCustom(false);
                  setCustomCode("");
                  setCustomLabel("");
                }}
                aria-label={t("menu_language.cancel", "Cancel")}
                className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-gray-500 hover:bg-restro-button-hover transition active:scale-95 shrink-0"
              >
                <IconX size={18} stroke={iconStroke} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Display & print ── */}
      <section className={clsx("space-y-3 transition-opacity", isOff && "opacity-70")}>
        <SectionHeader title={t("menu_language.which_name_title")} description={t("menu_language.which_name_desc")} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
          <ModeCard
            icon={<IconDeviceDesktop stroke={iconStroke} size={22} />}
            title={t("menu_language.screen_title")}
            description={t("menu_language.screen_desc")}
            value={form.display_mode}
            onChange={(v) => set({ display_mode: v })}
            options={modeOptions}
            disabled={isOff}
            languages={form.languages}
          />
          <ModeCard
            icon={<IconReceipt stroke={iconStroke} size={22} />}
            title={t("menu_language.receipt_title")}
            description={t("menu_language.receipt_desc")}
            value={form.receipt_print_mode}
            onChange={(v) => set({ receipt_print_mode: v })}
            options={modeOptions}
            disabled={isOff}
            languages={form.languages}
          />
          <ModeCard
            icon={<IconChefHat stroke={iconStroke} size={22} />}
            title={t("menu_language.kitchen_title")}
            description={t("menu_language.kitchen_desc")}
            value={form.kitchen_print_mode}
            onChange={(v) => set({ kitchen_print_mode: v })}
            options={modeOptions}
            disabled={isOff}
            languages={form.languages}
          />
        </div>

        <div className={clsx(cardCls, "p-4 flex items-center justify-between gap-4")}>
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-restro-green/10 text-restro-green flex items-center justify-center shrink-0">
              <IconDeviceMobile stroke={iconStroke} size={22} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-restro-text">{t("menu_language.device_override")}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {t("menu_language.device_override_desc", "Adds a language button to the POS. Printing always follows the settings above.")}
              </p>
            </div>
          </div>
          <Toggle
            checked={!!form.allow_device_override}
            onChange={(v) => set({ allow_device_override: v })}
            label={t("menu_language.device_override_aria")}
            disabled={isOff}
          />
        </div>

        <p className="text-[11px] text-gray-400 px-1">{t("menu_language.rawbt_note")}</p>
      </section>
    </Page>
  );
}
