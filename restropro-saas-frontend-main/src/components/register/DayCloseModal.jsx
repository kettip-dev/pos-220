import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import clsx from "clsx";
import { IconCalendarCheck, IconCircleCheck, IconAlertTriangle, IconCashRegister } from "@tabler/icons-react";
import RegisterModalShell, { ModalButton } from "./RegisterModalShell";
import { closeBusinessDay, getDayCloseChecklist } from "../../controllers/register.controller";
import { formatCurrencyAmount } from "../../helpers/RegisterPrintHelper";
import { iconStroke } from "../../config/config";

const Check = ({ ok, title, detail, children }) => (
  <div className={clsx("rounded-2xl border p-4", ok ? "border-emerald-200 dark:border-emerald-500/30" : "border-amber-300 dark:border-amber-500/40 bg-amber-50/60 dark:bg-amber-500/5")}>
    <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
      {ok ? <IconCircleCheck size={20} className="text-emerald-600" /> : <IconAlertTriangle size={20} className="text-amber-600" />}
      {title}
    </div>
    {detail && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{detail}</p>}
    {children}
  </div>
);

/** End of trading day: every till closed, unpaid orders settled or carried over, then lock the day. */
export default function DayCloseModal({ isOpen, onClose, currency, onDone }) {
  const [checklist, setChecklist] = useState(null);
  const [carryOver, setCarryOver] = useState(false);
  const [summary, setSummary] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  const load = () =>
    getDayCloseChecklist()
      .then((res) => setChecklist(res.data))
      .catch(() => toast.error("Could not load the day-close checklist."));

  useEffect(() => {
    if (!isOpen) return;
    setSummary(null);
    setCarryOver(false);
    setChecklist(null);
    load();
  }, [isOpen]);

  const submit = async () => {
    try {
      setIsBusy(true);
      const res = await closeBusinessDay(carryOver);
      setSummary(res.data?.summary);
      toast.success(res.data?.message || "Business day closed.");
      onDone?.();
    } catch (error) {
      const data = error?.response?.data;
      if (data?.checklist) setChecklist((prev) => ({ ...prev, ...data.checklist }));
      toast.error(data?.message || "Could not close the business day.");
    } finally {
      setIsBusy(false);
    }
  };

  const fmt = (v) => formatCurrencyAmount(v, currency || "USD");
  const openSessions = checklist?.openSessions || [];
  const openOrders = checklist?.openOrders || [];
  const pendingQr = Number(checklist?.pendingQrOrders || 0);
  const canClose = checklist?.day && openSessions.length === 0 && (carryOver || (openOrders.length === 0 && pendingQr === 0));

  return (
    <RegisterModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      icon={<IconCalendarCheck size={22} stroke={iconStroke} />}
      title={summary ? `Day closed · ${summary.business_date}` : "Close Business Day"}
      subtitle={checklist?.day ? `Business day ${checklist.day.business_date}, opened by ${checklist.day.opened_by || "—"}` : "End-of-day checklist"}
      footer={
        summary ? (
          <ModalButton variant="primary" onClick={onClose}>Done</ModalButton>
        ) : (
          <>
            <ModalButton onClick={onClose}>Cancel</ModalButton>
            <ModalButton variant="primary" onClick={submit} disabled={!canClose || isBusy} className="min-w-[200px]">
              Close day
            </ModalButton>
          </>
        )
      }
    >
      {summary ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Net sales", fmt(summary.totals.net_sales)],
              ["Bills", summary.totals.bill_count],
              ["Voids + refunds", fmt(Number(summary.totals.void_total) + Number(summary.totals.refund_total))],
              ["Cash over / short", fmt(summary.totals.variance_base)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
                <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{value}</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Payments</h4>
            {summary.payments.map((p) => (
              <div key={p.title} className="flex justify-between py-1.5 text-sm">
                <span className="text-slate-600 dark:text-slate-300">{p.title} ({p.count})</span>
                <span className="tabular-nums font-semibold text-slate-900 dark:text-white">{fmt(p.net)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {summary.sessions.length} register session(s): Z {summary.sessions.map((s) => `#${s.z_number}`).join(", ") || "—"}.
            {summary.carried_over_orders.length ? ` ${summary.carried_over_orders.length} unpaid order(s) carried over.` : ""} The owner's day-end report has been sent.
          </p>
        </div>
      ) : !checklist ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !checklist.day ? (
        <Check ok title="No open business day" detail="The day opens automatically when the first register is opened." />
      ) : (
        <div className="space-y-3">
          <Check
            ok={openSessions.length === 0}
            title={openSessions.length === 0 ? "All registers closed" : `${openSessions.length} register(s) still open`}
            detail={openSessions.length ? "Each till must be counted and closed (Z report) before the day can close." : null}
          >
            {openSessions.map((s) => (
              <div key={s.id} className="mt-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <IconCashRegister size={16} /> {s.register_name} · {s.current_cashier}
              </div>
            ))}
          </Check>
          <Check
            ok={openOrders.length === 0 && pendingQr === 0}
            title={openOrders.length === 0 && pendingQr === 0 ? "No unpaid orders" : `${openOrders.length} unpaid order(s)${pendingQr ? `, ${pendingQr} pending QR order(s)` : ""}`}
            detail={openOrders.length || pendingQr ? "Settle them, or carry them over into the next business day." : null}
          >
            {openOrders.slice(0, 8).map((o) => (
              <div key={o.id} className="mt-1.5 text-sm text-slate-700 dark:text-slate-200">
                #{o.token_no || o.id} {o.table_title ? `· ${o.table_title}` : ""} · {new Date(o.date).toLocaleString()}
              </div>
            ))}
            {openOrders.length > 8 && <div className="mt-1 text-xs text-slate-500">and {openOrders.length - 8} more…</div>}
            {(openOrders.length > 0 || pendingQr > 0) && (
              <label className="mt-3 flex items-center gap-3 min-h-[42px] cursor-pointer select-none">
                <input type="checkbox" checked={carryOver} onChange={(e) => setCarryOver(e.target.checked)} className="w-5 h-5 accent-emerald-600" />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Carry unpaid orders over to the next day</span>
              </label>
            )}
          </Check>
        </div>
      )}
    </RegisterModalShell>
  );
}
