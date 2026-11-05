import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import { clsx } from "clsx";
import {
  IconAlertTriangle,
  IconCash,
  IconCheck,
  IconClockDollar,
  IconHistory,
  IconPencil,
  IconRefresh,
  IconSearch,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import Page from "../components/Page";
import RequiresSingleBusiness from "../components/RequiresSingleBusiness";
import { iconStroke } from "../config/config";
import { CURRENCIES } from "../config/currencies.config";
import { getInvoicesInit } from "../controllers/invoices.controller";
import { isRegisterClosedError } from "../controllers/register.controller";
import {
  useOutstandingCustomers,
  useCustomerCredit,
  collectCustomerPayment,
  writeOffInvoiceBalance,
  setCustomerCreditLimit,
  creditErrorMessage,
} from "../controllers/customer_credit.controller";

/**
 * Customer Dues: everyone who took a bill on "Pay Later", how old the debt
 * is, and the place to take their payment when they come back.
 */
export default function CustomerDuesPage() {
  return (
    <RequiresSingleBusiness>
      <CustomerDuesContent />
    </RequiresSingleBusiness>
  );
}

function CustomerDuesContent() {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [collectFor, setCollectFor] = useState(null);
  const [init, setInit] = useState({ paymentTypes: [], currency: "$", storeSettings: {} });

  const { data, error, isLoading, mutate } = useOutstandingCustomers(search);

  useEffect(() => {
    getInvoicesInit()
      .then((res) => {
        const d = res?.data || {};
        const currency = CURRENCIES.find((c) => c.cc === d?.storeSettings?.currency);
        setInit({
          paymentTypes: (d.paymentTypes || []).filter((p) => p.is_active === undefined || Number(p.is_active) === 1),
          currency: currency?.symbol || "$",
          storeSettings: d.storeSettings || {},
        });
      })
      .catch(() => {});
  }, []);

  const money = (v) => `${init.currency}${Number(v || 0).toFixed(2)}`;
  const totals = data?.totals || {};
  const customers = data?.customers || [];

  const stats = [
    { label: t("dues.total_outstanding", "Total owed"), value: money(totals.outstanding), tone: "amber" },
    { label: t("dues.overdue", "Overdue"), value: money(totals.overdue), tone: Number(totals.overdue) > 0 ? "rose" : "slate" },
    { label: t("dues.customers_owing", "Customers owing"), value: totals.customers || 0, sub: `${totals.open_invoices || 0} ${t("dues.bills", "bills")}`, tone: "slate" },
    { label: t("dues.collected_30d", "Collected (30 days)"), value: money(totals.collected_last_30_days), sub: `${totals.collections_last_30_days || 0} ${t("dues.payments", "payments")}`, tone: "emerald" },
  ];

  const refreshAll = () => mutate();

  return (
    <Page>
      <div className="flex flex-wrap gap-3 flex-col md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <IconClockDollar size={22} stroke={iconStroke} />
          </div>
          <div>
            <h3 className="text-2xl leading-tight">{t("dues.title", "Customer Dues")}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("dues.subtitle", "Bills customers chose to pay later. Collect payments and manage credit limits.")}
            </p>
          </div>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput.trim());
          }}
        >
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("dues.search", "Search name or phone")}
            className="h-[42px] px-3 rounded-xl bg-restro-gray border border-restro-border-green outline-none text-sm w-56"
          />
          <button type="submit" className="h-[42px] px-3 rounded-xl text-white bg-restro-green hover:bg-restro-green-button-hover flex items-center gap-1 text-sm active:scale-95">
            <IconSearch size={16} stroke={iconStroke} /> {t("invoices.search", "Search")}
          </button>
          {search && (
            <button type="button" onClick={() => { setSearch(""); setSearchInput(""); }} className="w-[42px] h-[42px] flex items-center justify-center text-gray-400 active:scale-95">
              <IconX size={18} stroke={iconStroke} />
            </button>
          )}
          <button type="button" onClick={refreshAll} title={t("dues.refresh", "Refresh")} className="w-[42px] h-[42px] flex items-center justify-center text-gray-400 rounded-full hover:bg-restro-button-hover active:scale-95">
            <IconRefresh stroke={iconStroke} />
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={clsx(
              "rounded-2xl border p-4",
              s.tone === "amber" && "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30",
              s.tone === "rose" && "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30",
              s.tone === "emerald" && "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30",
              s.tone === "slate" && "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800"
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{s.label}</p>
            <p className="text-2xl font-bold tabular-nums mt-1 text-slate-900 dark:text-white">{s.value}</p>
            {s.sub && <p className="text-xs text-slate-500 mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {isLoading && <div className="h-[40vh] flex items-center justify-center text-gray-500">{t("dues.loading", "Loading...")}</div>}
      {!isLoading && error && (
        <div className="h-[40vh] flex items-center justify-center text-red-600">{creditErrorMessage(error, t("dues.error", "Could not load customer dues"))}</div>
      )}
      {!isLoading && !error && customers.length === 0 && (
        <div className="h-[40vh] flex flex-col items-center justify-center text-gray-500">
          <IconCheck size={36} stroke={iconStroke} className="text-emerald-500 mb-2" />
          <p className="text-sm font-semibold">{search ? t("dues.no_match", "No customer with dues matches your search") : t("dues.none", "Nobody owes anything right now")}</p>
        </div>
      )}

      {!isLoading && !error && customers.length > 0 && (
        <div className="w-full overflow-x-auto mt-4 border border-slate-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                <th className="py-3 px-3">{t("dues.customer", "Customer")}</th>
                <th className="py-3 px-3 text-right">{t("dues.owed", "Owed")}</th>
                <th className="py-3 px-3 text-right">{t("dues.overdue", "Overdue")}</th>
                <th className="py-3 px-3 text-right">0–30</th>
                <th className="py-3 px-3 text-right">31–60</th>
                <th className="py-3 px-3 text-right">61–90</th>
                <th className="py-3 px-3 text-right">90+</th>
                <th className="py-3 px-3 text-right">{t("dues.limit", "Limit")}</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {customers.map((c) => (
                <tr key={c.phone} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                  <td className="py-2 px-3">
                    <button type="button" onClick={() => setSelectedPhone(c.phone)} className="text-left min-h-[42px] cursor-pointer">
                      <p className="font-semibold text-slate-900 dark:text-white">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.phone} • {c.open_invoices} {t("dues.bills", "bills")}</p>
                    </button>
                  </td>
                  <td className="py-2 px-3 text-right font-bold tabular-nums">{money(c.outstanding)}</td>
                  <td className={clsx("py-2 px-3 text-right tabular-nums", c.overdue > 0 ? "text-rose-600 font-semibold" : "text-slate-400")}>{c.overdue > 0 ? money(c.overdue) : "—"}</td>
                  {["0_30", "31_60", "61_90", "90_plus"].map((k) => (
                    <td key={k} className={clsx("py-2 px-3 text-right tabular-nums", c.aging[k] > 0 ? (k === "90_plus" || k === "61_90" ? "text-rose-600" : "") : "text-slate-300 dark:text-zinc-600")}>
                      {c.aging[k] > 0 ? money(c.aging[k]) : "—"}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right tabular-nums text-slate-500">{c.credit_limit === null ? "—" : money(c.credit_limit)}</td>
                  <td className="py-2 px-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPhone(c.phone)}
                        className="h-[42px] px-3 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm font-semibold flex items-center gap-1 active:scale-95"
                      >
                        <IconHistory size={16} stroke={iconStroke} /> {t("dues.details", "Details")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCollectFor({ phone: c.phone, name: c.name, outstanding: c.outstanding })}
                        className="h-[42px] px-3 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white text-sm font-semibold flex items-center gap-1 active:scale-95"
                      >
                        <IconCash size={16} stroke={iconStroke} /> {t("dues.collect", "Collect")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedPhone && (
        <CustomerCreditPanel
          phone={selectedPhone}
          money={money}
          onClose={() => setSelectedPhone(null)}
          onCollect={(c) => setCollectFor(c)}
          onChanged={refreshAll}
        />
      )}

      {collectFor && (
        <CollectPaymentModal
          target={collectFor}
          paymentTypes={init.paymentTypes}
          currency={init.currency}
          storeSettings={init.storeSettings}
          money={money}
          onClose={() => setCollectFor(null)}
          onDone={() => {
            setCollectFor(null);
            refreshAll();
          }}
        />
      )}
    </Page>
  );
}

function CustomerCreditPanel({ phone, money, onClose, onCollect, onChanged }) {
  const { t } = useTranslation();
  const { data, error, isLoading, mutate } = useCustomerCredit(phone);
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState("");
  const [writeOff, setWriteOff] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLimitInput(data?.credit_limit === null || data?.credit_limit === undefined ? "" : String(data.credit_limit));
  }, [data?.credit_limit]);

  const saveLimit = async () => {
    try {
      setBusy(true);
      await setCustomerCreditLimit(phone, limitInput === "" ? null : Number(limitInput));
      toast.success(t("dues.limit_saved", "Credit limit saved"));
      setIsEditingLimit(false);
      mutate();
      onChanged();
    } catch (e) {
      toast.error(creditErrorMessage(e, t("dues.limit_failed", "Could not save the credit limit")));
    } finally {
      setBusy(false);
    }
  };

  const confirmWriteOff = async () => {
    if (!writeOff?.reason?.trim()) return toast.error(t("dues.reason_required", "Give a reason"));
    try {
      setBusy(true);
      await writeOffInvoiceBalance(phone, writeOff.invoiceId, writeOff.reason.trim());
      toast.success(t("dues.written_off", "Balance written off"));
      setWriteOff(null);
      mutate();
      onChanged();
    } catch (e) {
      toast.error(creditErrorMessage(e, t("dues.write_off_failed", "Could not write off this balance")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-xl h-full bg-white dark:bg-zinc-900 shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
            <IconUser size={20} stroke={iconStroke} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-lg font-bold truncate">{data?.customer?.name || phone}</h4>
            <p className="text-xs text-slate-500">{phone}</p>
          </div>
          <button type="button" onClick={onClose} className="w-[42px] h-[42px] rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-95">
            <IconX size={20} stroke={iconStroke} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading && <p className="text-sm text-slate-500">{t("dues.loading", "Loading...")}</p>}
          {error && <p className="text-sm text-red-600">{creditErrorMessage(error, t("dues.error", "Could not load"))}</p>}
          {data && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-3">
                  <p className="text-[11px] font-semibold uppercase text-amber-700 dark:text-amber-300">{t("dues.owed", "Owed")}</p>
                  <p className="text-lg font-bold tabular-nums">{money(data.outstanding)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-zinc-800 p-3">
                  <p className="text-[11px] font-semibold uppercase text-slate-500">{t("dues.limit", "Limit")}</p>
                  {isEditingLimit ? (
                    <div className="flex gap-1 mt-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={limitInput}
                        onChange={(e) => setLimitInput(e.target.value)}
                        placeholder={t("dues.no_limit", "No limit")}
                        className="w-full h-[42px] px-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                        autoFocus
                      />
                      <button type="button" disabled={busy} onClick={saveLimit} className="w-[42px] h-[42px] shrink-0 rounded-lg bg-restro-green text-white flex items-center justify-center active:scale-95">
                        <IconCheck size={16} />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setIsEditingLimit(true)} className="min-h-[42px] w-full text-lg font-bold tabular-nums flex items-center justify-center gap-1">
                      {data.credit_limit === null ? t("dues.no_limit", "No limit") : money(data.credit_limit)}
                      <IconPencil size={14} className="text-slate-400" />
                    </button>
                  )}
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-zinc-800 p-3">
                  <p className="text-[11px] font-semibold uppercase text-slate-500">{t("dues.available", "Available")}</p>
                  <p className="text-lg font-bold tabular-nums">{data.available === null ? "∞" : money(data.available)}</p>
                </div>
              </div>
              {isEditingLimit && (
                <p className="text-xs text-slate-500 -mt-3">
                  {t("dues.limit_hint", "Leave empty for no limit. Set 0 to stop this customer from paying later.")}
                </p>
              )}

              <button
                type="button"
                disabled={data.outstanding <= 0}
                onClick={() => onCollect({ phone, name: data.customer.name, outstanding: data.outstanding })}
                className="w-full h-14 rounded-xl bg-restro-green hover:bg-restro-green-button-hover disabled:bg-slate-300 text-white font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <IconCash size={20} stroke={iconStroke} /> {t("dues.collect_payment", "Collect payment")}
              </button>

              <section>
                <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{t("dues.open_bills", "Open bills")}</h5>
                {data.open_invoices.length === 0 && <p className="text-sm text-slate-500">{t("dues.no_open_bills", "No open bills")}</p>}
                <div className="space-y-2">
                  {data.open_invoices.map((inv) => (
                    <div key={inv.id} className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">
                            #{inv.id}
                            {inv.is_overdue && (
                              <span className="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                                {t("dues.overdue", "Overdue")}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(inv.created_at).toLocaleString()} • {t("dues.bill_total", "Bill")} {money(inv.total)}
                            {inv.due_date ? ` • ${t("dues.due", "Due")} ${String(inv.due_date).slice(0, 10)}` : ""}
                          </p>
                          {inv.credit_note && <p className="text-xs text-slate-500 italic mt-0.5">“{inv.credit_note}”</p>}
                        </div>
                        <div className="text-right">
                          <p className="font-bold tabular-nums">{money(inv.balance_due)}</p>
                          <button
                            type="button"
                            onClick={() => setWriteOff({ invoiceId: inv.id, amount: inv.balance_due, reason: "" })}
                            className="min-h-[42px] text-xs text-rose-600 hover:underline"
                          >
                            {t("dues.write_off", "Write off")}
                          </button>
                        </div>
                      </div>
                      {writeOff?.invoiceId === inv.id && (
                        <div className="mt-2 flex gap-2">
                          <input
                            value={writeOff.reason}
                            onChange={(e) => setWriteOff((w) => ({ ...w, reason: e.target.value }))}
                            placeholder={t("dues.write_off_reason", "Reason, e.g. customer unreachable")}
                            className="flex-1 h-[42px] px-3 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                            autoFocus
                          />
                          <button type="button" disabled={busy} onClick={confirmWriteOff} className="h-[42px] px-3 rounded-lg bg-rose-600 text-white text-sm font-semibold active:scale-95">
                            {t("dues.write_off_confirm", "Write off {{amount}}", { amount: money(writeOff.amount) })}
                          </button>
                          <button type="button" onClick={() => setWriteOff(null)} className="w-[42px] h-[42px] rounded-lg border border-slate-200 dark:border-zinc-700 flex items-center justify-center active:scale-95">
                            <IconX size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{t("dues.payment_history", "Payments received")}</h5>
                {data.payments.length === 0 && <p className="text-sm text-slate-500">{t("dues.no_payments", "No payments yet")}</p>}
                <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {data.payments.map((p) => (
                    <div key={p.id} className="py-2 flex items-center gap-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{p.payment_type_title}{p.reference ? ` • ${p.reference}` : ""}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(p.created_at).toLocaleString()} • {p.created_by}
                          {p.allocations?.length ? ` • ${p.allocations.map((a) => `#${a.invoiceId}`).join(", ")}` : ""}
                        </p>
                      </div>
                      <p className="font-bold tabular-nums text-emerald-600">{money(p.amount)}</p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CollectPaymentModal({ target, paymentTypes, currency, storeSettings, money, onClose, onDone }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(String(Number(target.outstanding || 0).toFixed(2)));
  const [paymentTypeId, setPaymentTypeId] = useState(paymentTypes.find((p) => Number(p.is_cash) === 1)?.id || paymentTypes[0]?.id || null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [cashUSD, setCashUSD] = useState("");
  const [cashKHR, setCashKHR] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!paymentTypeId && paymentTypes.length) {
      setPaymentTypeId(paymentTypes.find((p) => Number(p.is_cash) === 1)?.id || paymentTypes[0].id);
    }
  }, [paymentTypes, paymentTypeId]);

  const selectedType = paymentTypes.find((p) => p.id === paymentTypeId);
  const isCash = Number(selectedType?.is_cash) === 1;
  const isBaseKHR = currency === "៛" || String(currency).toUpperCase() === "KHR";
  const rate = Number(storeSettings?.exchange_rate_usd_to_khr) || 4100;
  const amountNum = Number(amount) || 0;

  // Cash handed over in either currency (optional): lets the drawer count USD and KHR separately.
  const tender = useMemo(() => {
    const usd = Number(cashUSD) || 0;
    const khr = Number(cashKHR) || 0;
    if (!isCash || (usd <= 0 && khr <= 0)) return null;
    const receivedBase = isBaseKHR ? khr + usd * rate : usd + khr / rate;
    const changeBase = Math.max(0, receivedBase - amountNum);
    const changeKHR = Math.round((isBaseKHR ? changeBase : changeBase * rate) / 100) * 100;
    return { tenderedUSD: usd, tenderedKHR: khr, changeUSD: 0, changeKHR, receivedBase, short: receivedBase + 0.004 < amountNum };
  }, [cashUSD, cashKHR, isCash, isBaseKHR, rate, amountNum]);

  const canSubmit = !busy && amountNum > 0 && amountNum <= Number(target.outstanding) + 0.004 && paymentTypeId && !tender?.short;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      setBusy(true);
      const res = await collectCustomerPayment(target.phone, {
        amount: amountNum,
        paymentTypeId,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
        tender: tender ? { tenderedUSD: tender.tenderedUSD, tenderedKHR: tender.tenderedKHR, changeUSD: 0, changeKHR: tender.changeKHR } : undefined,
      });
      const left = Number(res?.data?.balance_after || 0);
      toast.success(
        left > 0
          ? t("dues.collected_partial", "Received {{amount}}. Still owes {{left}}.", { amount: money(amountNum), left: money(left) })
          : t("dues.collected_full", "Received {{amount}}. Account settled.", { amount: money(amountNum) })
      );
      onDone();
    } catch (e) {
      toast.error(
        isRegisterClosedError(e)
          ? t("dues.register_closed", "Open a register before taking payments.")
          : creditErrorMessage(e, t("dues.collect_failed", "Could not record the payment"))
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[calc(100dvh-2rem)] flex flex-col bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <IconCash size={22} stroke={iconStroke} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-lg font-bold">{t("dues.collect_payment", "Collect payment")}</h4>
            <p className="text-xs text-slate-500 truncate">{target.name} • {t("dues.owes", "owes")} {money(target.outstanding)}</p>
          </div>
          <button type="button" onClick={onClose} className="w-[42px] h-[42px] rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-95">
            <IconX size={20} stroke={iconStroke} />
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1 min-h-0 overflow-y-auto">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500 mb-1">{t("dues.amount", "Amount")} ({currency})</p>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full h-14 px-3 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-2xl font-bold tabular-nums"
            />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button type="button" onClick={() => setAmount(Number(target.outstanding).toFixed(2))} className="min-h-[42px] rounded-xl border border-slate-200 dark:border-zinc-700 text-sm font-semibold active:scale-95">
                {t("dues.pay_all", "All")} {money(target.outstanding)}
              </button>
              <button type="button" onClick={() => setAmount((Number(target.outstanding) / 2).toFixed(2))} className="min-h-[42px] rounded-xl border border-slate-200 dark:border-zinc-700 text-sm font-semibold active:scale-95">
                {t("dues.pay_half", "Half")} {money(Number(target.outstanding) / 2)}
              </button>
            </div>
            {amountNum > Number(target.outstanding) + 0.004 && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1"><IconAlertTriangle size={14} /> {t("dues.more_than_owed", "More than the customer owes")}</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase text-slate-500 mb-1">{t("dues.method", "Payment method")}</p>
            <div className="grid grid-cols-2 gap-2">
              {paymentTypes.map((pt) => (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() => setPaymentTypeId(pt.id)}
                  className={clsx(
                    "min-h-[48px] px-3 rounded-xl border text-sm font-semibold text-left active:scale-95",
                    paymentTypeId === pt.id ? "border-sky-500 ring-2 ring-sky-500/25 bg-sky-50 dark:bg-sky-500/10" : "border-slate-200 dark:border-zinc-700"
                  )}
                >
                  {pt.title}
                </button>
              ))}
            </div>
          </div>

          {isCash ? (
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 mb-1">{t("dues.cash_received", "Cash received (optional)")}</p>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min="0" step="0.01" value={cashUSD} onChange={(e) => setCashUSD(e.target.value)} placeholder="USD $" className="h-[42px] px-3 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm tabular-nums" />
                <input type="number" min="0" step="100" value={cashKHR} onChange={(e) => setCashKHR(e.target.value)} placeholder="KHR ៛" className="h-[42px] px-3 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm tabular-nums" />
              </div>
              {tender && (
                <p className={clsx("text-xs mt-1", tender.short ? "text-rose-600" : "text-emerald-600")}>
                  {tender.short
                    ? t("dues.cash_short", "Not enough cash for this amount")
                    : `${t("dues.change", "Change")}: ៛${tender.changeKHR.toLocaleString()}`}
                </p>
              )}
            </div>
          ) : (
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t("dues.reference", "Reference / transaction ID (optional)")}
              className="w-full h-[42px] px-3 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
            />
          )}

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("dues.note", "Note (optional)")}
            className="w-full h-[42px] px-3 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
          />
          <p className="text-xs text-slate-500">{t("dues.oldest_first", "Payments are applied to the oldest bill first.")}</p>
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-slate-200 dark:border-zinc-800">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className={clsx(
              "w-full h-14 rounded-xl text-white font-bold flex items-center justify-center gap-2 active:scale-[0.98]",
              canSubmit ? "bg-restro-green hover:bg-restro-green-button-hover" : "bg-slate-300 dark:bg-zinc-700 cursor-not-allowed"
            )}
          >
            <IconCheck size={20} />
            {busy ? t("pos.please_wait", "Processing...") : t("dues.record_payment", "Record {{amount}}", { amount: money(amountNum) })}
          </button>
        </div>
      </div>
    </div>
  );
}
