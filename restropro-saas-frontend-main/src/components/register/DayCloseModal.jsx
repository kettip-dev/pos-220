import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const [checklist, setChecklist] = useState(null);
  const [carryOver, setCarryOver] = useState(false);
  const [summary, setSummary] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  const load = () =>
    getDayCloseChecklist()
      .then((res) => setChecklist(res.data))
      .catch(() => toast.error(t("registers.dayclose.load_failed", "Could not load the day-close checklist.")));

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
      toast.success(res.data?.message || t("registers.dayclose.closed_toast", "Business day closed."));
      onDone?.();
    } catch (error) {
      const data = error?.response?.data;
      if (data?.checklist) setChecklist((prev) => ({ ...prev, ...data.checklist }));
      toast.error(data?.message || t("registers.dayclose.close_failed", "Could not close the business day."));
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
      title={summary ? t("registers.dayclose.title_done", "Day closed · {{date}}", { date: summary.business_date }) : t("registers.dayclose.title", "Close Business Day")}
      subtitle={checklist?.day ? t("registers.dayclose.subtitle_day", "Business day {{date}}, opened by {{user}}", { date: checklist.day.business_date, user: checklist.day.opened_by || "—" }) : t("registers.dayclose.subtitle", "End-of-day checklist")}
      footer={
        summary ? (
          <ModalButton variant="primary" onClick={onClose}>{t("registers.done", "Done")}</ModalButton>
        ) : (
          <>
            <ModalButton onClick={onClose}>{t("registers.cancel", "Cancel")}</ModalButton>
            <ModalButton variant="primary" onClick={submit} disabled={!canClose || isBusy} className="min-w-[200px]">
              {t("registers.dayclose.close_day", "Close day")}
            </ModalButton>
          </>
        )
      }
    >
      {summary ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              [t("registers.report.net_sales", "Net sales"), fmt(summary.totals.net_sales)],
              [t("registers.report.bills", "Bills"), summary.totals.bill_count],
              [t("registers.dayclose.voids_refunds", "Voids + refunds"), fmt(Number(summary.totals.void_total) + Number(summary.totals.refund_total))],
              [t("registers.report.over_short", "Over / short"), fmt(summary.totals.variance_base)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
                <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{value}</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">{t("registers.report.payments", "Payments")}</h4>
            {summary.payments.map((p) => (
              <div key={p.title} className="flex justify-between py-1.5 text-sm">
                <span className="text-slate-600 dark:text-slate-300">{p.title} ({p.count})</span>
                <span className="tabular-nums font-semibold text-slate-900 dark:text-white">{fmt(p.net)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("registers.dayclose.sessions_line", "{{count}} register session(s): Z {{z}}.", { count: summary.sessions.length, z: summary.sessions.map((s) => `#${s.z_number}`).join(", ") || "—" })}
            {summary.carried_over_orders.length ? ` ${t("registers.dayclose.carried_line", "{{count}} unpaid order(s) carried over.", { count: summary.carried_over_orders.length })}` : ""} {t("registers.dayclose.owner_sent", "The owner's day-end report has been sent.")}
          </p>
        </div>
      ) : !checklist ? (
        <p className="text-sm text-slate-500">{t("registers.dayclose.loading", "Loading…")}</p>
      ) : !checklist.day ? (
        <Check ok title={t("registers.dayclose.no_day", "No open business day")} detail={t("registers.dayclose.no_day_detail", "The day opens automatically when the first register is opened.")} />
      ) : (
        <div className="space-y-3">
          <Check
            ok={openSessions.length === 0}
            title={openSessions.length === 0 ? t("registers.dayclose.all_closed", "All registers closed") : t("registers.dayclose.still_open", "{{count}} register(s) still open", { count: openSessions.length })}
            detail={openSessions.length ? t("registers.dayclose.still_open_detail", "Each till must be counted and closed (Z report) before the day can close.") : null}
          >
            {openSessions.map((s) => (
              <div key={s.id} className="mt-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <IconCashRegister size={16} /> {s.register_name} · {s.current_cashier}
              </div>
            ))}
          </Check>
          <Check
            ok={openOrders.length === 0 && pendingQr === 0}
            title={openOrders.length === 0 && pendingQr === 0 ? t("registers.dayclose.no_unpaid", "No unpaid orders") : `${t("registers.dayclose.unpaid", "{{count}} unpaid order(s)", { count: openOrders.length })}${pendingQr ? t("registers.dayclose.unpaid_qr", ", {{count}} pending QR order(s)", { count: pendingQr }) : ""}`}
            detail={openOrders.length || pendingQr ? t("registers.dayclose.unpaid_detail", "Settle them, or carry them over into the next business day.") : null}
          >
            {openOrders.slice(0, 8).map((o) => (
              <div key={o.id} className="mt-1.5 text-sm text-slate-700 dark:text-slate-200">
                #{o.token_no || o.id} {o.table_title ? `· ${o.table_title}` : ""} · {new Date(o.date).toLocaleString()}
              </div>
            ))}
            {openOrders.length > 8 && <div className="mt-1 text-xs text-slate-500">{t("registers.dayclose.and_more", "and {{count}} more…", { count: openOrders.length - 8 })}</div>}
            {(openOrders.length > 0 || pendingQr > 0) && (
              <label className="mt-3 flex items-center gap-3 min-h-[42px] cursor-pointer select-none">
                <input type="checkbox" checked={carryOver} onChange={(e) => setCarryOver(e.target.checked)} className="w-5 h-5 accent-emerald-600" />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("registers.dayclose.carry_over", "Carry unpaid orders over to the next day")}</span>
              </label>
            )}
          </Check>
        </div>
      )}
    </RegisterModalShell>
  );
}
