import React from "react";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import { formatCurrencyAmount } from "../../helpers/RegisterPrintHelper";

export const DENOMINATIONS = {
  USD: [100, 50, 20, 10, 5, 2, 1],
  KHR: [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 100],
};

/** Sum of a count map ({ denomination: quantity }) plus any loose amount. */
export const countTotal = (counts = {}, loose = 0) =>
  Object.entries(counts).reduce((acc, [denom, qty]) => acc + Number(denom) * (Number(qty) || 0), 0) + (Number(loose) || 0);

/** Count rows the API stores alongside the open/close count. */
export const toDenominationRows = (currency, counts = {}) =>
  Object.entries(counts)
    .filter(([, qty]) => Number(qty) > 0)
    .map(([denomination, quantity]) => ({ currency, denomination: Number(denomination), quantity: Number(quantity) }));

/**
 * Note-by-note cash count for one currency. Currencies without a note list
 * (anything but USD/KHR) are counted as a single total in the "loose" field.
 */
export default function DenominationCounter({ currency, counts = {}, loose = "", onChange, onLooseChange }) {
  const notes = DENOMINATIONS[currency] || [];
  const setQty = (denom, qty) => onChange({ ...counts, [denom]: Math.max(0, qty) });
  const total = countTotal(counts, loose);
  const label = (d) => (currency === "KHR" ? (d >= 1000 ? `${d / 1000}k` : String(d)) : `${d}`);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{currency}</span>
        <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{formatCurrencyAmount(total, currency)}</span>
      </div>
      {notes.length > 0 && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {notes.map((denom) => {
            const qty = Number(counts[denom] || 0);
            return (
              <div key={denom} className="flex items-center gap-2 px-3 py-1.5">
                <span className="w-16 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">{label(denom)}</span>
                <span className="text-slate-400 text-xs">×</span>
                <button
                  type="button"
                  onClick={() => setQty(denom, qty - 1)}
                  className="w-[42px] h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center active:scale-95 transition cursor-pointer"
                >
                  <IconMinus size={16} />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={qty || ""}
                  placeholder="0"
                  onChange={(e) => setQty(denom, parseInt(e.target.value, 10) || 0)}
                  className="w-16 h-[42px] text-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setQty(denom, qty + 1)}
                  className="w-[42px] h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center active:scale-95 transition cursor-pointer"
                >
                  <IconPlus size={16} />
                </button>
                <span className="ml-auto text-sm tabular-nums text-slate-500 dark:text-slate-400">
                  {qty > 0 ? formatCurrencyAmount(denom * qty, currency) : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-100 dark:border-slate-800">
        <span className="text-sm text-slate-600 dark:text-slate-300 flex-1">{notes.length ? "Coins / other" : "Total counted"}</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step={currency === "KHR" ? "100" : "0.01"}
          value={loose}
          placeholder="0"
          onChange={(e) => onLooseChange(e.target.value)}
          className="w-36 h-[42px] text-right px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>
    </div>
  );
}
