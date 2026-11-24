import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useSWR from "swr";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import {
  IconPlus,
  IconTrash,
  IconPencil,
  IconX,
  IconReportMoney,
  IconInfoCircle,
  IconRefresh,
  IconReceipt2,
} from "@tabler/icons-react";
import Page from "../components/Page";
import ApiClient from "../helpers/ApiClient";
import { iconStroke } from "../config/config";
import { useStoreSettings } from "../controllers/settings.controller";
import { CURRENCIES } from "../config/currencies.config";

const fetcher = (url) => ApiClient.get(url).then((r) => r.data);

export const EXPENSE_CATEGORIES = [
  { code: "rent", label: "Rent", emoji: "🏠" },
  { code: "staff", label: "Staff wages", emoji: "👥" },
  { code: "utilities", label: "Electricity & water", emoji: "💡" },
  { code: "gas", label: "Gas", emoji: "🔥" },
  { code: "market", label: "Market buys", emoji: "🥬" },
  { code: "supplies", label: "Supplies", emoji: "🧻" },
  { code: "repairs", label: "Repairs", emoji: "🔧" },
  { code: "marketing", label: "Marketing", emoji: "📣" },
  { code: "bank_fees", label: "Bank & card fees", emoji: "🏦" },
  { code: "other", label: "Other", emoji: "📦" },
];

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const rangeFor = (key) => {
  const now = new Date();
  if (key === "today") return [ymd(now), ymd(now)];
  if (key === "last_7days") {
    const s = new Date(now);
    s.setDate(s.getDate() - 6);
    return [ymd(s), ymd(now)];
  }
  if (key === "last_month") {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    return [ymd(s), ymd(e)];
  }
  return [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(now)];
};

export default function ExpensesPage() {
  const { t } = useTranslation();
  const [range, setRange] = useState("this_month");
  const [from, to] = useMemo(() => rangeFor(range), [range]);
  const { data, isLoading, mutate } = useSWR(`/expenses?from=${from}&to=${to}`, fetcher);
  const { data: store } = useStoreSettings();
  const symbol = CURRENCIES.find((c) => c.cc === store?.currency)?.symbol || store?.currency || "$";
  const money = (n) => `${symbol}${Number(n || 0).toFixed(2)}`;
  const [editing, setEditing] = useState(null);

  const catLabel = (code) => {
    const c = EXPENSE_CATEGORIES.find((x) => x.code === code);
    return c ? `${c.emoji} ${t(`expenses.cat_${c.code}`, c.label)}` : code;
  };

  const remove = async (item) => {
    try {
      await ApiClient.delete(`/expenses/${item.id}`);
      toast.success(t("expenses.deleted", "Deleted"));
      mutate();
    } catch (err) {
      toast.error(err?.response?.data?.message || t("expenses.error", "Something went wrong"));
    }
  };

  const ranges = [
    { key: "today", label: t("expenses.today", "Today") },
    { key: "last_7days", label: t("expenses.last_7days", "Last 7 days") },
    { key: "this_month", label: t("expenses.this_month", "This month") },
    { key: "last_month", label: t("expenses.last_month", "Last month") },
  ];

  const items = data?.items || [];
  const byCategory = Object.entries(data?.byCategory || {}).sort((a, b) => b[1] - a[1]);

  return (
    <Page className="px-4 py-4 md:px-8 md:py-6 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">{t("expenses.title", "Expenses")}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("expenses.subtitle", "Rent, wages, gas, market buys and other costs, for your Profit & Loss.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/dashboard/reports/profit-and-loss"
            className="flex h-[44px] items-center gap-1.5 rounded-xl border border-gray-200 dark:border-zinc-700 px-4 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 active:scale-95"
          >
            <IconReportMoney size={18} stroke={iconStroke} />
            {t("expenses.view_pnl", "Profit & Loss")}
          </Link>
          <button
            onClick={() => setEditing({})}
            className="flex h-[44px] items-center gap-1.5 rounded-xl bg-restro-green px-4 text-sm font-bold text-white hover:bg-restro-green-button-hover active:scale-95"
          >
            <IconPlus size={18} stroke={iconStroke} />
            {t("expenses.add", "Add expense")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-2xl border border-gray-200 bg-gray-50 p-1 dark:border-zinc-800 dark:bg-zinc-900 w-fit">
        {ranges.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={clsx(
              "min-h-[42px] rounded-xl px-3.5 text-sm font-semibold transition active:scale-95",
              range === r.key ? "bg-restro-green text-white shadow-sm" : "text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-zinc-800"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t("expenses.total", "Total")}</p>
          <p className="mt-1 text-3xl font-black text-gray-900 dark:text-white tabular-nums">{money(data?.total)}</p>
          <div className="mt-4 space-y-1.5">
            {byCategory.map(([code, amount]) => (
              <div key={code} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">{catLabel(code)}</span>
                <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{money(amount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-2 overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center"><IconRefresh className="h-7 w-7 animate-spin text-restro-green" /></div>
          ) : items.length === 0 ? (
            <div className="py-14 text-center">
              <IconReceipt2 size={40} stroke={1.4} className="mx-auto text-gray-400" />
              <p className="mt-2 font-semibold text-gray-700 dark:text-gray-200">{t("expenses.empty", "No expenses in this period")}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-semibold text-gray-900 dark:text-white">{catLabel(item.category)}</span>
                      <span className="shrink-0 font-bold tabular-nums text-gray-900 dark:text-white">{money(item.amount)}</span>
                    </div>
                    <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {item.date}
                      {item.paid_with ? ` · ${t(`expenses.paid_${item.paid_with}`, item.paid_with)}` : ""}
                      {item.note ? ` · ${item.note}` : ""}
                    </div>
                  </div>
                  <button onClick={() => setEditing(item)} aria-label={t("expenses.edit", "Edit")} className="flex h-[42px] w-[42px] items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95">
                    <IconPencil size={18} stroke={iconStroke} />
                  </button>
                  <button onClick={() => remove(item)} aria-label={t("expenses.delete", "Delete")} className="flex h-[42px] w-[42px] items-center justify-center rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 active:scale-95">
                    <IconTrash size={18} stroke={iconStroke} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
        <IconInfoCircle size={16} className="mt-0.5 shrink-0" />
        {t("expenses.payout_note", "Cash taken from the till with a Pay Out is already counted in Profit & Loss. Don't enter it here as well.")}
      </p>

      {editing && (
        <ExpenseModal
          item={editing}
          symbol={symbol}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); mutate(); }}
          t={t}
        />
      )}
    </Page>
  );
}

function ExpenseModal({ item, symbol, onClose, onSaved, t }) {
  const isNew = !item.id;
  const [amount, setAmount] = useState(item.amount ? String(item.amount) : "");
  const [category, setCategory] = useState(item.category || "");
  const [date, setDate] = useState(item.date || ymd(new Date()));
  const [paidWith, setPaidWith] = useState(item.paid_with || "cash");
  const [note, setNote] = useState(item.note || "");
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!category) {
      toast.error(t("expenses.pick_category", "Pick a category"));
      return;
    }
    setSaving(true);
    const payload = { amount: Number(amount), category, date, paidWith, note };
    try {
      if (isNew) await ApiClient.post("/expenses/add", payload);
      else await ApiClient.post(`/expenses/${item.id}/update`, payload);
      toast.success(t("expenses.saved", "Saved"));
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.message || t("expenses.error", "Something went wrong"));
    } finally {
      setSaving(false);
    }
  };

  const chip = (on) =>
    clsx(
      "min-h-[44px] rounded-xl px-3 text-sm font-semibold transition active:scale-95",
      on ? "bg-restro-green text-white shadow-sm" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-700"
    );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-gray-900 dark:text-white">{isNew ? t("expenses.add", "Add expense") : t("expenses.edit_title", "Edit expense")}</h3>
          <button type="button" onClick={onClose} className="flex h-[42px] w-[42px] items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800">
            <IconX size={20} />
          </button>
        </div>

        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-400">{symbol}</span>
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full h-[64px] pl-14 pr-4 rounded-2xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-3xl font-black tabular-nums text-gray-900 dark:text-white outline-none focus:border-restro-green"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {EXPENSE_CATEGORIES.map((c) => (
            <button type="button" key={c.code} onClick={() => setCategory(c.code)} className={chip(category === c.code)}>
              {c.emoji} {t(`expenses.cat_${c.code}`, c.label)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">{t("expenses.date", "Date")}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-[46px] px-3 rounded-2xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">{t("expenses.paid_with", "Paid with")}</label>
            <select value={paidWith} onChange={(e) => setPaidWith(e.target.value)} className="w-full h-[46px] px-3 rounded-2xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm text-gray-900 dark:text-white">
              <option value="cash">{t("expenses.paid_cash", "Cash")}</option>
              <option value="bank">{t("expenses.paid_bank", "Bank transfer")}</option>
              <option value="card">{t("expenses.paid_card", "Card")}</option>
              <option value="other">{t("expenses.paid_other", "Other")}</option>
            </select>
          </div>
        </div>

        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} placeholder={t("expenses.note_placeholder", "Note (optional), e.g. November rent")} className="w-full h-[46px] px-4 rounded-2xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm text-gray-900 dark:text-white" />

        <button type="submit" disabled={saving} className="flex h-[50px] w-full items-center justify-center rounded-2xl bg-restro-green text-base font-bold text-white hover:bg-restro-green-button-hover active:scale-95 disabled:opacity-60">
          {t("expenses.save", "Save")}
        </button>
      </form>
    </div>
  );
}
