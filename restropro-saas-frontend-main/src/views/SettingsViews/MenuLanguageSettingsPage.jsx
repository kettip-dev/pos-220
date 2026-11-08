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
  IconLanguage,
  IconPlus,
  IconReceipt,
  IconTrash,
} from "@tabler/icons-react";
import Page from "../../components/Page";
import { iconStroke } from "../../config/config";
import { saveMenuLanguageSettings, useMenuLanguageSettings } from "../../controllers/settings.controller";
import {
  LANGUAGE_PRESETS,
  getModeOptions,
  localizeText,
  setMenuLanguageSettings as applyMenuLanguageSettings,
} from "../../helpers/MenuLanguageHelper";

const inputCls =
  "text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green min-h-[42px] text-restro-text";

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
  },
};

function Toggle({ checked, onChange, label }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer min-h-[42px]" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
      <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[11px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#59A352]"></div>
    </label>
  );
}

function ModeCard({ icon, title, description, value, onChange, options, settings, children }) {
  const { t } = useTranslation();
  const preview = localizeText(SAMPLE.title, SAMPLE.translations, value, "title", " / ");
  return (
    <div className="rounded-2xl border border-restro-border-green bg-restro-card-bg p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-restro-green/10 text-restro-green flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-restro-text">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} disabled={!settings.is_enabled}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="text-xs text-gray-500">
        {t("menu_language.preview", "Preview")}: <span className="font-semibold text-restro-text">{preview}</span>
      </div>
      {children}
    </div>
  );
}

export default function MenuLanguageSettingsPage() {
  const { t } = useTranslation();
  const { data, error, isLoading, mutate } = useMenuLanguageSettings();
  const [form, setForm] = useState(null);
  const [presetCode, setPresetCode] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !form) setForm({ ...data, languages: data.languages || [] });
  }, [data, form]);

  const modeOptions = useMemo(() => (form ? getModeOptions(form) : []), [form]);

  if (isLoading || (!form && !error)) {
    return <Page className="p-4 md:p-8 max-w-5xl mx-auto">{t("menu_language.loading", "Please wait...")}</Page>;
  }
  if (error) {
    return <Page className="p-4 md:p-8 max-w-5xl mx-auto">{t("menu_language.load_failed", "Failed to load menu language settings.")}</Page>;
  }

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const codes = form.languages.map((l) => l.code);
  const availablePresets = LANGUAGE_PRESETS.filter((p) => !codes.includes(p.code));

  const addLanguage = (code, label) => {
    const c = String(code || "").trim().toLowerCase();
    const l = String(label || "").trim();
    if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(c)) return toast.error(t("menu_language.err_code"));
    if (!l) return toast.error(t("menu_language.err_name"));
    if (codes.includes(c)) return toast.error(t("menu_language.err_duplicate"));
    if (form.languages.length >= 10) return toast.error(t("menu_language.err_max"));
    set({ languages: [...form.languages, { code: c, label: l }] });
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
    <Page className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/settings"
            className="w-[42px] h-[42px] rounded-2xl flex items-center justify-center bg-gray-100 dark:bg-[#333] hover:bg-gray-200 dark:hover:bg-[#444] transition-colors text-slate-600 dark:text-gray-300 active:scale-95 shrink-0"
          >
            <IconArrowLeft stroke={iconStroke} className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-restro-green-dark dark:text-white">{t("menu_language.title", "Menu Languages")}</h1>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              {t("menu_language.subtitle")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="min-h-[42px] px-5 rounded-2xl bg-restro-green hover:bg-restro-green-button-hover disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition active:scale-95"
        >
          <IconCheck size={18} stroke={iconStroke} />
          {saving ? t("menu_language.saving", "Saving...") : t("menu_language.save", "Save")}
        </button>
      </div>

      {/* Enable */}
      <div className="rounded-2xl border border-restro-border-green bg-restro-card-bg p-4 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-restro-green/10 text-restro-green flex items-center justify-center shrink-0">
            <IconLanguage stroke={iconStroke} size={22} />
          </div>
          <div>
            <p className="font-bold text-restro-text">{t("menu_language.enable_title")}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {t("menu_language.enable_desc")}
            </p>
          </div>
        </div>
        <Toggle checked={!!form.is_enabled} onChange={(v) => set({ is_enabled: v })} label={t("menu_language.enable_aria")} />
      </div>

      {/* Languages */}
      <section className={clsx("rounded-2xl border border-restro-border-green bg-restro-card-bg p-4 space-y-4", !form.is_enabled && "opacity-60")}>
        <div>
          <p className="font-bold text-restro-text">{t("menu_language.languages_title")}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {t("menu_language.languages_desc")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3 items-center">
          <label className="text-xs font-semibold text-gray-500" htmlFor="primary-label">
            {t("menu_language.default_language_name")}
          </label>
          <input
            id="primary-label"
            value={form.primary_label}
            onChange={(e) => set({ primary_label: e.target.value })}
            className={inputCls}
            placeholder="English"
            maxLength={50}
          />
        </div>

        {form.languages.length > 0 && (
          <ul className="rounded-xl border border-restro-border-green divide-y divide-restro-border-green">
            {form.languages.map((l) => (
              <li key={l.code} className="flex items-center gap-3 pl-3 pr-1 py-1.5">
                <span className="text-xs font-mono font-bold uppercase w-12 shrink-0 text-restro-green">{l.code}</span>
                <input
                  value={l.label}
                  onChange={(e) => renameLanguage(l.code, e.target.value)}
                  className={clsx(inputCls, "flex-1")}
                  maxLength={50}
                  aria-label={t("menu_language.name_for", { code: l.code })}
                />
                <button
                  type="button"
                  onClick={() => removeLanguage(l.code)}
                  aria-label={t("menu_language.remove_named", { name: l.label })}
                  className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition active:scale-95 shrink-0"
                >
                  <IconTrash size={18} stroke={iconStroke} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex gap-2">
            <select value={presetCode} onChange={(e) => setPresetCode(e.target.value)} className={inputCls}>
              <option value="">{t("menu_language.add_language_placeholder")}</option>
              {availablePresets.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!presetCode}
              onClick={() => {
                const p = LANGUAGE_PRESETS.find((x) => x.code === presetCode);
                if (p) addLanguage(p.code, p.label);
                setPresetCode("");
              }}
              className="min-h-[42px] px-4 rounded-xl bg-restro-green hover:bg-restro-green-button-hover disabled:opacity-40 text-white text-sm font-semibold flex items-center gap-1 transition active:scale-95 shrink-0"
            >
              <IconPlus size={16} stroke={iconStroke} /> {t("menu_language.add")}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              className={clsx(inputCls, "w-24 shrink-0")}
              placeholder={t("menu_language.custom_code")}
              maxLength={12}
            />
            <input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              className={inputCls}
              placeholder={t("menu_language.custom_name")}
              maxLength={50}
            />
            <button
              type="button"
              disabled={!customCode || !customLabel}
              onClick={() => {
                addLanguage(customCode, customLabel);
                setCustomCode("");
                setCustomLabel("");
              }}
              className="min-h-[42px] px-4 rounded-xl border border-restro-border-green bg-restro-gray hover:bg-restro-button-hover disabled:opacity-40 text-restro-text text-sm font-semibold flex items-center gap-1 transition active:scale-95 shrink-0"
            >
              <IconPlus size={16} stroke={iconStroke} /> {t("menu_language.add")}
            </button>
          </div>
        </div>
      </section>

      {/* Display & print */}
      <section className="space-y-3">
        <div>
          <p className="font-bold text-restro-text">{t("menu_language.which_name_title")}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {t("menu_language.which_name_desc")}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ModeCard
            icon={<IconDeviceDesktop stroke={iconStroke} size={22} />}
            title={t("menu_language.screen_title")}
            description={t("menu_language.screen_desc")}
            value={form.display_mode}
            onChange={(v) => set({ display_mode: v })}
            options={modeOptions}
            settings={form}
          >
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-restro-border-green">
              <p className="text-xs text-gray-500">{t("menu_language.device_override")}</p>
              <Toggle
                checked={!!form.allow_device_override}
                onChange={(v) => set({ allow_device_override: v })}
                label={t("menu_language.device_override_aria")}
              />
            </div>
          </ModeCard>
          <ModeCard
            icon={<IconReceipt stroke={iconStroke} size={22} />}
            title={t("menu_language.receipt_title")}
            description={t("menu_language.receipt_desc")}
            value={form.receipt_print_mode}
            onChange={(v) => set({ receipt_print_mode: v })}
            options={modeOptions}
            settings={form}
          />
          <ModeCard
            icon={<IconChefHat stroke={iconStroke} size={22} />}
            title={t("menu_language.kitchen_title")}
            description={t("menu_language.kitchen_desc")}
            value={form.kitchen_print_mode}
            onChange={(v) => set({ kitchen_print_mode: v })}
            options={modeOptions}
            settings={form}
          />
        </div>
        <p className="text-[11px] text-gray-400">
          {t("menu_language.rawbt_note")}
        </p>
      </section>
    </Page>
  );
}
