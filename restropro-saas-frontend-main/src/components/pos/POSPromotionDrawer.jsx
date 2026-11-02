import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  IconTag,
  IconX,
  IconCheck,
  IconSparkles,
  IconClock,
  IconTicket,
  IconGift,
  IconPercentage,
  IconCurrencyDollar,
  IconTrash,
  IconArrowRight,
  IconKeyboard,
  IconBackspace,
  IconFlame,
  IconTrendingUp,
  IconSearch,
  IconInfoCircle,
} from "@tabler/icons-react";
import { clsx } from "clsx";
import { iconStroke } from "../../config/config";
import toast from "react-hot-toast";

const NUMPAD_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["CLEAR", "0", "BACKSPACE"],
];

const QWERTY_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
];

export default function POSPromotionDrawer({
  isOpen,
  onClose,
  promotions = [],
  enteredCouponCode = "",
  onApplyCouponCode,
  onRemoveCouponCode,
  appliedPromotions = [],
  eligiblePromotions = [],
  totalPromotionDiscount = 0,
  rawSubtotal = 0,
  currency = "$",
  exchangeRateUsdToKhr = 4100,
}) {
  const { t } = useTranslation();
  const [codeInput, setCodeInput] = useState(enteredCouponCode || "");
  const [showKeypad, setShowKeypad] = useState(false);
  const [keypadMode, setKeypadMode] = useState("abc"); // "abc" | "123"
  const [searchFilter, setSearchFilter] = useState("");

  if (!isOpen) return null;

  const isBaseKHR = currency === "៛" || String(currency).toUpperCase() === "KHR";
  const rate = Number(exchangeRateUsdToKhr) || 4100;

  const formatPrice = (amount) => {
    const val = Number(amount) || 0;
    if (isBaseKHR) {
      return `${Math.round(val).toLocaleString()} ៛`;
    }
    return `$${val.toFixed(2)}`;
  };

  const handleApply = (e) => {
    e?.preventDefault();
    const clean = codeInput.trim().toUpperCase();
    if (!clean) {
      toast.error(t("promotions.enter_code", "Please enter a coupon code"));
      return;
    }
    onApplyCouponCode(clean);
  };

  const handleQuickApplyPromo = (promo) => {
    if (promo.promo_code) {
      setCodeInput(promo.promo_code);
      onApplyCouponCode(promo.promo_code);
    }
  };

  const handleKeypadPress = (val) => {
    if (val === "CLEAR") {
      setCodeInput("");
    } else if (val === "BACKSPACE") {
      setCodeInput((prev) => prev.slice(0, -1));
    } else if (val === "SPACE") {
      setCodeInput((prev) => (prev + " ").slice(0, 20));
    } else {
      setCodeInput((prev) => (prev + val).slice(0, 20));
    }
  };

  // Find next potential unlockable promotion (Toast-style upsell)
  const unlockablePromo = eligiblePromotions.find((promo) => {
    const minSpend = Number(promo.min_order_amount) || 0;
    return minSpend > 0 && rawSubtotal < minSpend;
  });

  const shortfall = unlockablePromo
    ? Number(unlockablePromo.min_order_amount) - rawSubtotal
    : 0;

  // Available coupon codes that can be 1-tapped
  const availableCoupons = eligiblePromotions.filter(
    (p) => Boolean(p.promo_code) && p.promo_code !== enteredCouponCode
  );

  // Filtered eligible deals by search keyword
  const filteredEligible = eligiblePromotions.filter((p) => {
    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    return (
      p.title?.toLowerCase().includes(query) ||
      p.promo_code?.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-fadeIn"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-md sm:max-w-lg bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-gray-200 dark:border-slate-800 animate-slideInRight">
          {/* Header */}
          <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shrink-0 shadow-xs border border-emerald-200 dark:border-emerald-800/60">
                <IconTag size={24} stroke={iconStroke} />
              </span>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                  {t("pos.promotions_and_coupons", "Promotions & Discounts")}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {appliedPromotions.length > 0
                    ? t("pos.specials_active", { count: appliedPromotions.length, defaultValue: `${appliedPromotions.length} special(s) active on cart` })
                    : t("pos.tap_to_apply", "Tap to apply coupons or specials")}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition active:scale-95"
            >
              <IconX size={22} stroke={iconStroke} />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Dynamic Upsell / Unlock Progress Banner */}
            {unlockablePromo && shortfall > 0 && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-300 dark:border-amber-700/60 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                    <IconFlame size={16} className="text-orange-500 animate-pulse" />
                    <span>{t("pos.spend_more_to_unlock", "Spend More to Unlock")}</span>
                  </div>
                  <span className="font-mono text-amber-700 dark:text-amber-300">
                    {formatPrice(rawSubtotal)} / {formatPrice(unlockablePromo.min_order_amount)}
                  </span>
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-200">
                  {t("pos.add_more_to_unlock_prefix", "Add")}{" "}
                  <strong className="text-amber-600 dark:text-amber-400 font-mono font-black">{formatPrice(shortfall)}</strong>{" "}
                  {t("pos.add_more_to_unlock_middle", "more items to unlock")}{" "}
                  <strong>{unlockablePromo.title}</strong>!
                </p>
                <div className="w-full bg-gray-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden mt-2.5 shadow-inner">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all duration-300 rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(8, (rawSubtotal / Number(unlockablePromo.min_order_amount)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Quick 1-Tap Coupon Pills */}
            {availableCoupons.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                    Quick 1-Tap Codes
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {t("pos.tap_to_apply_code", "Tap to apply code instantly")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableCoupons.map((promo) => (
                    <button
                      key={promo.id}
                      type="button"
                      onClick={() => handleQuickApplyPromo(promo)}
                      className="min-h-[42px] px-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 text-xs font-bold font-mono flex items-center gap-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition active:scale-95 shadow-xs"
                    >
                      <IconTicket size={15} />
                      {promo.promo_code}
                      <span className="text-[10px] font-sans font-medium text-emerald-600 dark:text-emerald-400">
                        ({promo.promo_type.includes("PERCENTAGE") ? `${promo.discount_value}%` : `$${promo.discount_value}`})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Coupon Code Input & Touch Pad */}
            <div className="p-3.5 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <IconTicket size={16} className="text-emerald-500" />
                  {t("pos.enter_promo_code", "Voucher / Promo Code")}
                </label>

                <button
                  type="button"
                  onClick={() => setShowKeypad(!showKeypad)}
                  className="min-h-[38px] px-3 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 flex items-center gap-1.5 hover:bg-gray-100 transition active:scale-95 shadow-xs"
                >
                  <IconKeyboard size={16} />
                  {showKeypad ? t("pos.hide_keyboard", "Hide Keyboard") : t("pos.tablet_keyboard", "Tablet Keyboard")}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={t("pos.promo_code_placeholder", "e.g. SAVE20")}
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleApply(e);
                  }}
                  className="flex-1 min-h-[46px] px-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-background text-sm font-mono uppercase font-bold focus:outline-restro-green"
                />

                <button
                  type="button"
                  onClick={handleApply}
                  className="min-h-[46px] px-5 rounded-xl bg-restro-green text-white text-xs font-bold hover:bg-restro-green/90 transition shadow-xs active:scale-95 flex items-center gap-1.5"
                >
                  <IconCheck size={16} />
                  {t("pos.apply", "Apply")}
                </button>
              </div>

              {/* Enhanced On-Screen Tablet Keyboard (QWERTY + Numpad Toggle) */}
              {showKeypad && (
                <div className="pt-2 border-t border-gray-200 dark:border-slate-700 space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      {t("pos.virtual_touch_keypad", "Virtual Touch Keypad")}
                    </span>
                    <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => setKeypadMode("abc")}
                        className={clsx(
                          "min-h-[32px] px-3 text-xs font-bold rounded-md transition",
                          keypadMode === "abc"
                            ? "bg-restro-green text-white shadow-xs"
                            : "text-gray-500 hover:text-gray-800"
                        )}
                      >
                        ABC
                      </button>
                      <button
                        type="button"
                        onClick={() => setKeypadMode("123")}
                        className={clsx(
                          "min-h-[32px] px-3 text-xs font-bold rounded-md transition",
                          keypadMode === "123"
                            ? "bg-restro-green text-white shadow-xs"
                            : "text-gray-500 hover:text-gray-800"
                        )}
                      >
                        123
                      </button>
                    </div>
                  </div>

                  {keypadMode === "123" ? (
                    /* 3x4 Numpad */
                    <div className="grid grid-cols-3 gap-1.5">
                      {NUMPAD_KEYS.map((row) =>
                        row.map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => handleKeypadPress(k)}
                            className={clsx(
                              "min-h-[46px] rounded-xl font-bold font-mono text-sm transition active:scale-95 flex items-center justify-center shadow-xs",
                              k === "CLEAR"
                                ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
                                : k === "BACKSPACE"
                                ? "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200"
                                : "bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-800 dark:text-white hover:bg-gray-100"
                            )}
                          >
                            {k === "BACKSPACE" ? <IconBackspace size={18} /> : k}
                          </button>
                        ))
                      )}
                    </div>
                  ) : (
                    /* Full QWERTY Touch Layout */
                    <div className="space-y-1.5">
                      {QWERTY_ROWS.map((row, rIdx) => (
                        <div key={rIdx} className="flex justify-center gap-1">
                          {row.map((key) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => handleKeypadPress(key)}
                              className={clsx(
                                "min-h-[42px] px-2 rounded-xl font-bold font-mono text-xs sm:text-sm transition active:scale-95 flex items-center justify-center shadow-xs",
                                key === "BACKSPACE"
                                  ? "flex-1 max-w-[60px] bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200"
                                  : "flex-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-800 dark:text-white hover:bg-gray-100"
                              )}
                            >
                              {key === "BACKSPACE" ? <IconBackspace size={16} /> : key}
                            </button>
                          ))}
                        </div>
                      ))}
                      <div className="flex gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleKeypadPress("CLEAR")}
                          className="min-h-[42px] px-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 text-xs font-bold border border-red-200 dark:border-red-800 active:scale-95 shadow-xs"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => handleKeypadPress("SPACE")}
                          className="flex-1 min-h-[42px] rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 text-xs font-bold border border-gray-200 dark:border-slate-600 active:scale-95 shadow-xs"
                        >
                          Space
                        </button>
                        <button
                          type="button"
                          onClick={handleApply}
                          className="min-h-[42px] px-4 rounded-xl bg-restro-green text-white text-xs font-bold active:scale-95 shadow-xs flex items-center gap-1"
                        >
                          <IconCheck size={15} /> Apply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {enteredCouponCode && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-100/70 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800">
                  <div className="flex items-center gap-2">
                    <IconCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs text-emerald-900 dark:text-emerald-200 font-medium">
                      Applied Code: <strong className="font-mono text-emerald-700 dark:text-emerald-300 font-bold">{enteredCouponCode}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCodeInput("");
                      onRemoveCouponCode();
                    }}
                    className="min-h-[38px] px-3 rounded-lg text-xs font-bold text-red-600 hover:bg-red-100 dark:hover:bg-red-950/60 transition flex items-center gap-1 active:scale-95 border border-red-200 dark:border-red-900/60"
                  >
                    <IconTrash size={14} />
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Applied Promotions Summary */}
            {appliedPromotions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Active Discounts on Cart ({appliedPromotions.length})
                  </h3>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    Calculated in real-time
                  </span>
                </div>

                <div className="space-y-2">
                  {appliedPromotions.map((promo, idx) => {
                    const isBogo = promo.promo_type === "BOGO";
                    return (
                      <div
                        key={idx}
                        className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80 rounded-2xl flex items-center justify-between shadow-xs animate-fadeIn"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                            {isBogo ? <IconGift size={20} /> : <IconSparkles size={20} />}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-gray-900 dark:text-white block line-clamp-1">
                              {promo.title}
                            </span>
                            <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1 mt-0.5">
                              {promo.promo_code ? `Coupon: ${promo.promo_code}` : "⚡ Automatic Special"}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-base font-black text-emerald-700 dark:text-emerald-300 font-mono">
                            -{formatPrice(promo.discount_amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total Savings Card */}
                <div className="p-3.5 bg-gray-900 dark:bg-slate-800 text-white rounded-2xl flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <IconTrendingUp size={20} />
                    </span>
                    <div>
                      <span className="text-xs text-gray-400 block font-medium">{t("pos.customer_savings", "Customer Savings")}</span>
                      <span className="text-xs font-bold">{t("pos.total_promo_discount", "Total Promo Discount")}</span>
                    </div>
                  </div>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    -{formatPrice(totalPromotionDiscount)}
                  </span>
                </div>
              </div>
            )}

            {/* Available Specials List with Search */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t("pos.scheduled_specials_today", "Scheduled Specials Today")} ({eligiblePromotions.length})
                </h3>
              </div>

              {eligiblePromotions.length > 3 && (
                <div className="relative">
                  <IconSearch
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder={t("pos.search_deals_placeholder", "Search deals by name or code...")}
                    className="w-full min-h-[42px] pl-9 pr-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-background text-xs focus:outline-restro-green"
                  />
                </div>
              )}

              {filteredEligible.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl space-y-1">
                  <IconTag size={28} className="mx-auto text-gray-300 dark:text-slate-700 mb-1" />
                  <p className="font-semibold">
                    {searchFilter ? t("pos.no_promotions_match", "No promotions match your search.") : t("pos.no_promotions_scheduled", "No promotions scheduled right now.")}
                  </p>
                  <p className="text-[11px]">{t("pos.deals_configured_hint", "Deals configured in Backoffice will automatically appear here.")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredEligible.map((promo) => {
                    const isAlreadyApplied = appliedPromotions.some((p) => p.id === promo.id);
                    const isBogo = promo.promo_type === "BOGO";
                    const isPercent = promo.promo_type.includes("PERCENTAGE");

                    return (
                      <div
                        key={promo.id}
                        className={clsx(
                          "p-3.5 rounded-2xl border transition-all",
                          isAlreadyApplied
                            ? "bg-white dark:bg-slate-900 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                            : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 hover:border-gray-300"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold text-gray-900 dark:text-white block truncate">
                              {promo.title}
                            </span>
                            {promo.description && (
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                                {promo.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px]">
                              <span className="font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                {isBogo
                                  ? t("pos.bogo_free", "BOGO Free")
                                  : isPercent
                                  ? `${promo.discount_value}% ${t("pos.off", "Off")}`
                                  : `${formatPrice(promo.discount_value)} ${t("pos.off", "Off")}`}
                              </span>
                              {promo.min_order_amount > 0 && (
                                <span className="text-gray-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-medium">
                                  {t("pos.min_spend", "Min: ")} {formatPrice(promo.min_order_amount)}
                                </span>
                              )}
                              {promo.max_discount_cap > 0 && (
                                <span className="text-gray-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-medium">
                                  {t("pos.max_cap", "Max Cap: ")} {formatPrice(promo.max_discount_cap)}
                                </span>
                              )}
                              {promo.is_stackable && (
                                <span className="text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-300 px-1.5 py-0.5 rounded-md font-semibold text-[10px]">
                                  {t("pos.stackable", "Stackable")}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isAlreadyApplied ? (
                              <span className="min-h-[42px] px-3.5 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 text-xs font-bold flex items-center gap-1.5 shadow-xs">
                                <IconCheck size={16} />
                                {t("pos.active", "Active")}
                              </span>
                            ) : promo.promo_code ? (
                              <button
                                type="button"
                                onClick={() => handleQuickApplyPromo(promo)}
                                className="min-h-[42px] px-3.5 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-gray-800 dark:text-gray-200 text-xs font-bold font-mono transition active:scale-95 flex items-center gap-1.5 border border-gray-200 dark:border-slate-700"
                              >
                                {promo.promo_code}
                                <IconArrowRight size={14} />
                              </button>
                            ) : (
                              <span className="min-h-[38px] px-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center gap-1">
                                <IconSparkles size={14} />
                                {t("pos.auto_cart", "Auto-Cart")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[50px] rounded-2xl bg-restro-green text-white text-sm font-bold hover:bg-restro-green/90 transition shadow-md shadow-emerald-600/20 active:scale-98 flex items-center justify-center gap-2"
            >
              <IconCheck size={18} />
              {t("pos.done", "Done")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
