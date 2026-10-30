import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  IconArrowLeft,
  IconAward,
  IconCheck,
  IconDeviceFloppy,
  IconSparkles,
  IconCoin,
  IconShieldCheck,
  IconHelp,
} from "@tabler/icons-react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useLoyaltySettings, updateLoyaltySettings } from "../../controllers/loyalty.controller";
import Page from "../../components/Page";

export default function LoyaltySettingsPage() {
  const { t } = useTranslation();
  const { data: settings, isLoading, mutate } = useLoyaltySettings();

  const [isEnabled, setIsEnabled] = useState(true);
  const [pointsPerDollar, setPointsPerDollar] = useState("1.00");
  const [dollarValuePerPoint, setDollarValuePerPoint] = useState("0.0100");
  const [minPointsToRedeem, setMinPointsToRedeem] = useState("10");
  const [maxDiscountPercentage, setMaxDiscountPercentage] = useState("100");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.is_enabled !== false);
      setPointsPerDollar(String(settings.points_per_dollar_spent ?? "1.00"));
      setDollarValuePerPoint(String(settings.dollar_value_per_point ?? "0.0100"));
      setMinPointsToRedeem(String(settings.min_points_to_redeem ?? "10"));
      setMaxDiscountPercentage(String(settings.max_discount_percentage ?? "100"));
    }
  }, [settings]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await updateLoyaltySettings({
        is_enabled: isEnabled,
        points_per_dollar_spent: parseFloat(pointsPerDollar) || 1.0,
        dollar_value_per_point: parseFloat(dollarValuePerPoint) || 0.01,
        min_points_to_redeem: parseInt(minPointsToRedeem, 10) || 0,
        max_discount_percentage: parseFloat(maxDiscountPercentage) || 100,
      });
      await mutate();
      toast.success(t("settings.loyalty_saved", "Loyalty program settings saved successfully!"));
    } catch (err) {
      toast.error(err?.response?.data?.message || t("common.error_occurred", "Failed to save settings"));
    } finally {
      setIsSaving(false);
    }
  };

  const ptsPerDollarNum = parseFloat(pointsPerDollar) || 1.0;
  const valPerPtNum = parseFloat(dollarValuePerPoint) || 0.01;
  const pointsForOneDollar = valPerPtNum > 0 ? Math.round(1 / valPerPtNum) : 100;

  return (
    <Page>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Navigation Bar */}
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/settings"
            className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
          >
            <IconArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-amber-500 text-white">
                <IconAward size={20} />
              </span>
              {t("settings.loyalty_program", "Loyalty & Rewards Program")}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {t(
                "settings.loyalty_desc",
                "Configure how your customers earn points on purchases and redeem them at the POS checkout."
              )}
            </p>
          </div>
        </div>

        {/* Live Simulation Calculator Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-linear-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <IconSparkles size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {t("settings.loyalty_rule_summary", "Active Rules Preview")}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Spend <strong className="text-slate-900 dark:text-white font-mono">$1.00</strong> = Earn{" "}
                <strong className="text-amber-600 dark:text-amber-400 font-mono">
                  {ptsPerDollarNum} {ptsPerDollarNum === 1 ? "point" : "points"}
                </strong>
                . <br className="hidden sm:inline" />
                Redeem <strong className="text-amber-600 dark:text-amber-400 font-mono">{pointsForOneDollar} points</strong> ={" "}
                <strong className="text-emerald-600 dark:text-emerald-400 font-mono">$1.00 discount</strong> at POS.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase font-mono bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
            {isEnabled ? "● Program Active" : "○ Disabled"}
          </span>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSave} className="space-y-6">
          <div className="p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-6">
            {/* Toggle Enable/Disable */}
            <div className="flex items-center justify-between pb-5 border-b border-slate-200 dark:border-slate-800">
              <div>
                <label className="text-sm font-bold text-slate-900 dark:text-white block">
                  {t("settings.enable_loyalty", "Enable Customer Loyalty Program")}
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t(
                    "settings.enable_loyalty_hint",
                    "When enabled, POS terminals award points on completed orders and allow point redemption in the payment drawer."
                  )}
                </p>
              </div>
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="toggle toggle-success"
              />
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Points per dollar spent */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {t("settings.points_per_dollar", "Points Earned per $1 Spent")}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={pointsPerDollar}
                    onChange={(e) => setPointsPerDollar(e.target.value)}
                    disabled={!isEnabled}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-50"
                    placeholder="1.00"
                    required
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                    pts / $
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Example: 1 means spending $50 gives 50 points.
                </p>
              </div>

              {/* Dollar value per point */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {t("settings.value_per_point", "Dollar Value per Point ($)")}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0.0001"
                    value={dollarValuePerPoint}
                    onChange={(e) => setDollarValuePerPoint(e.target.value)}
                    disabled={!isEnabled}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-50"
                    placeholder="0.0100"
                    required
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                    $ / pt
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Default: 0.0100 (100 points = $1.00 redemption discount).
                </p>
              </div>

              {/* Minimum points to redeem */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {t("settings.min_points_to_redeem", "Minimum Points Required to Redeem")}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={minPointsToRedeem}
                    onChange={(e) => setMinPointsToRedeem(e.target.value)}
                    disabled={!isEnabled}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-50"
                    placeholder="10"
                    required
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                    pts min
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Prevents trivial redemptions; customer must accumulate at least this balance.
                </p>
              </div>

              {/* Max discount cap */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {t("settings.max_discount_cap", "Max Bill Discount Allowed (%)")}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="5"
                    min="1"
                    max="100"
                    value={maxDiscountPercentage}
                    onChange={(e) => setMaxDiscountPercentage(e.target.value)}
                    disabled={!isEnabled}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-50"
                    placeholder="100"
                    required
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                    %
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Maximum percent of the payable bill points can cover (e.g. 50% or 100%).
                </p>
              </div>
            </div>

            {/* Member Tiers Reference Table */}
            <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <IconShieldCheck size={16} className="text-amber-500" />
                {t("settings.membership_tiers", "Automatic Membership Tiers Reference")}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <span className="text-xs font-extrabold uppercase text-slate-600 dark:text-slate-400">Standard</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-1">0 - 499 pts</p>
                  <span className="text-[10px] text-slate-400">Entry Tier</span>
                </div>
                <div className="p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/70">
                  <span className="text-xs font-extrabold uppercase text-slate-700 dark:text-slate-200">Silver</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-1">500+ pts</p>
                  <span className="text-[10px] text-slate-500">Regular Guest</span>
                </div>
                <div className="p-3 rounded-2xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/20">
                  <span className="text-xs font-extrabold uppercase text-amber-700 dark:text-amber-400">Gold</span>
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-200 font-mono mt-1">2,000+ pts</p>
                  <span className="text-[10px] text-amber-600">Frequent Diner</span>
                </div>
                <div className="p-3 rounded-2xl border border-purple-300 dark:border-purple-700/60 bg-purple-50 dark:bg-purple-950/20">
                  <span className="text-xs font-extrabold uppercase text-purple-700 dark:text-purple-400">VIP</span>
                  <p className="text-sm font-bold text-purple-900 dark:text-purple-200 font-mono mt-1">5,000+ pts</p>
                  <span className="text-[10px] text-purple-600">Top Tier Member</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-[46px] px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition active:scale-95 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <IconDeviceFloppy size={18} />
              <span>{isSaving ? t("common.saving", "Saving...") : t("common.save", "Save Changes")}</span>
            </button>
          </div>
        </form>
      </div>
    </Page>
  );
}
