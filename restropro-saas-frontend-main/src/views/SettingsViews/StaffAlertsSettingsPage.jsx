import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useSWR from "swr";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import {
  IconArrowLeft,
  IconShieldExclamation,
  IconRefresh,
  IconCheck,
  IconSearch,
  IconBrandTelegram,
  IconAlertTriangle,
  IconCircleCheck,
} from "@tabler/icons-react";
import Page from "../../components/Page";
import ApiClient from "../../helpers/ApiClient";
import { iconStroke } from "../../config/config";
import { useStoreSettings } from "../../controllers/settings.controller";
import { CURRENCIES } from "../../config/currencies.config";

const fetcher = (url) => ApiClient.get(url).then((r) => r.data);
const inputClass =
  "w-full h-[46px] px-4 rounded-2xl bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#59A352]";
const cardClass = "rounded-3xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#252525] p-6 space-y-5 shadow-sm";

function NumberField({ label, hint, value, onChange, step = "1", suffix }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-300 mb-1.5">{label}</label>
      <div className="relative">
        <input type="number" inputMode="decimal" step={step} min="0" value={value} onChange={(e) => onChange(e.target.value)} className={clsx(inputClass, suffix && "pr-12")} />
        {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">{suffix}</span>}
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

export default function StaffAlertsSettingsPage() {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useSWR("/staff-alerts/settings", fetcher);
  const { data: store } = useStoreSettings();
  const currency = CURRENCIES.find((c) => c.cc === store?.currency)?.symbol || store?.currency || "$";

  const [enabled, setEnabled] = useState(true);
  const [rate, setRate] = useState("5");
  const [minAmount, setMinAmount] = useState("10");
  const [peer, setPeer] = useState("2.5");
  const [noSales, setNoSales] = useState("5");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState(null);

  useEffect(() => {
    if (!data) return;
    setEnabled(Boolean(data.is_enabled));
    setRate(String(data.max_rate_percent));
    setMinAmount(String(data.min_amount));
    setPeer(String(data.peer_multiple));
    setNoSales(String(data.max_no_sales));
  }, [data]);

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      await ApiClient.post("/staff-alerts/settings", {
        is_enabled: enabled,
        max_rate_percent: Number(rate),
        min_amount: Number(minAmount),
        peer_multiple: Number(peer),
        max_no_sales: Number(noSales),
      });
      await mutate();
      toast.success(t("staff_alerts.saved", "Saved"));
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.message || t("staff_alerts.error", "Something went wrong"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const runCheck = async (send) => {
    setChecking(true);
    try {
      if (!(await save())) return;
      const res = await ApiClient.post("/staff-alerts/check", { send });
      setCheck(res.data);
      if (send) {
        const o = res.data.outcome;
        if (o === "sent") toast.success(t("staff_alerts.sent", "Alert sent to Telegram"));
        else if (o === "nothing-flagged") toast(t("staff_alerts.nothing_to_send", "Nobody is flagged today, so nothing was sent"));
        else if (o === "no-telegram") toast.error(t("staff_alerts.no_telegram", "Set up Telegram (bot and chat) first"));
        else if (o === "failed") toast.error(res.data.error || t("staff_alerts.send_failed", "Telegram send failed"));
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || t("staff_alerts.error", "Something went wrong"));
    } finally {
      setChecking(false);
    }
  };

  if (isLoading) {
    return (
      <Page className="p-4 md:p-8 max-w-4xl mx-auto flex items-center justify-center min-h-[400px]">
        <IconRefresh className="w-8 h-8 animate-spin text-[#59A352]" />
      </Page>
    );
  }

  const money = (n) => `${currency}${Number(n || 0).toFixed(2)}`;

  return (
    <Page className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard/settings"
          className="w-[42px] h-[42px] rounded-2xl flex items-center justify-center bg-gray-100 dark:bg-[#333] hover:bg-gray-200 dark:hover:bg-[#444] text-slate-600 dark:text-gray-300 active:scale-95 shrink-0"
        >
          <IconArrowLeft stroke={iconStroke} className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-restro-green-dark dark:text-white">{t("staff_alerts.title", "Unusual Staff Activity")}</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400">
            {t("staff_alerts.subtitle", "Get a Telegram alert at closing time when someone voids, refunds, discounts or comps far more than usual.")}
          </p>
        </div>
      </div>

      <form onSubmit={save} className={cardClass}>
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center shrink-0">
              <IconShieldExclamation stroke={iconStroke} className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-white">{t("staff_alerts.rules", "When to flag someone")}</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                {t("staff_alerts.rules_hint", "Counts voided bills, refunds, bill discounts, and item comps, discounts and voids, compared with what each person sold that day.")}
              </p>
            </div>
          </div>
          <label className="flex min-h-[42px] shrink-0 items-center gap-2 text-sm font-semibold text-slate-700 dark:text-gray-200">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5 accent-[#59A352]" />
            {t("staff_alerts.enabled", "Daily alert on")}
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberField
            label={t("staff_alerts.max_rate", "More than this % of their own sales")}
            value={rate}
            onChange={setRate}
            step="0.5"
            suffix="%"
          />
          <NumberField
            label={t("staff_alerts.peer_multiple", "Or this many times the team average")}
            value={peer}
            onChange={setPeer}
            step="0.5"
            suffix="×"
          />
          <NumberField
            label={t("staff_alerts.min_amount", "Ignore amounts below")}
            hint={t("staff_alerts.min_amount_hint", "So one small mistake doesn't raise an alert.")}
            value={minAmount}
            onChange={setMinAmount}
            step="1"
            suffix={currency}
          />
          <NumberField
            label={t("staff_alerts.max_no_sales", "No-sale drawer opens in a day")}
            hint={t("staff_alerts.max_no_sales_hint", "Flag at this many or more. 0 turns this check off.")}
            value={noSales}
            onChange={setNoSales}
          />
        </div>

        <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-gray-400">
          <IconBrandTelegram size={16} className="mt-0.5 shrink-0 text-[#229ED9]" />
          <span>
            {t("staff_alerts.telegram_note", "Sent to your end-of-day Telegram chat at its closing time, only on days when someone is flagged.")}{" "}
            <Link to="/dashboard/settings/telegram" className="font-semibold text-[#229ED9] hover:underline">
              {t("staff_alerts.telegram_settings", "Telegram settings")}
            </Link>
          </span>
        </p>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => runCheck(false)}
            disabled={checking || saving}
            className="flex h-[46px] items-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 px-4 text-sm font-bold text-slate-700 dark:text-gray-200 hover:border-[#59A352] active:scale-95 disabled:opacity-60"
          >
            {checking ? <IconRefresh className="w-4 h-4 animate-spin" /> : <IconSearch stroke={iconStroke} className="w-4 h-4" />}
            {t("staff_alerts.check_today", "Check today")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex h-[46px] items-center gap-2 rounded-2xl bg-[#59A352] px-5 text-sm font-bold text-white hover:bg-[#4a8b44] active:scale-95 disabled:opacity-60"
          >
            <IconCheck stroke={iconStroke} className="w-4 h-4" />
            {t("staff_alerts.save", "Save")}
          </button>
        </div>
      </form>

      {check && (
        <div className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-white">
                {t("staff_alerts.today_result", "Today ({{date}})", { date: check.date })}
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                {t("staff_alerts.team_rate", "Team average: {{rate}}% of sales taken off", { rate: check.teamRate })}
              </p>
            </div>
            {check.flaggedCount > 0 && (
              <button
                type="button"
                onClick={() => runCheck(true)}
                disabled={checking}
                className="flex h-[44px] items-center gap-2 rounded-2xl bg-[#229ED9] px-4 text-sm font-bold text-white active:scale-95 disabled:opacity-60"
              >
                <IconBrandTelegram className="w-4 h-4" />
                {t("staff_alerts.send_now", "Send alert now")}
              </button>
            )}
          </div>

          {check.rows.length === 0 ? (
            <p className="text-sm text-slate-500">{t("staff_alerts.no_activity", "No sales or exceptions recorded today yet.")}</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {check.rows.map((r) => (
                <div key={r.username} className="flex items-start gap-3 py-3">
                  {r.flags.length > 0 ? (
                    <IconAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  ) : (
                    <IconCircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-bold text-slate-900 dark:text-white">{r.username}</span>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {t("staff_alerts.row_numbers", "Sales {{sales}} · taken off {{off}} ({{rate}})", {
                          sales: money(r.sales),
                          off: money(r.exception_amount),
                          rate: r.exception_rate === null ? "–" : `${r.exception_rate}%`,
                        })}
                      </span>
                    </div>
                    {r.flags.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-sm text-amber-700 dark:text-amber-300">
                        {r.flags.map((f) => <li key={f.code}>• {f.text}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Page>
  );
}
