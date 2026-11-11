import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { IconClockPlus, IconX, IconCheck, IconRotateClockwise } from "@tabler/icons-react";
import { useMenuLanguage } from "../../helpers/MenuLanguageHelper";
import { getOrderTitle, itemDelayMinutes, delayReasonLabel } from "./kdsUtils";

export const QUICK_ADD_MINUTES = [2, 5, 10, 15, 20];

/**
 * Bottom sheet to add cooking time to a ticket, with an optional reason
 * (waiting for ingredients, no gas, ...). Front of house gets an alert.
 */
export default function KdsDelaySheet({ open, ticket, reasons, onClose, onSubmit, onClear, busy = false }) {
  const { t } = useTranslation();
  const { displayOrderItem } = useMenuLanguage();
  const [minutes, setMinutes] = useState(5);
  const [reasonId, setReasonId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const items = ticket?.items || [];
  const orderId = ticket?.order?.id ?? null;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Reset only when a different ticket opens: the ticket object is rebuilt every clock tick.
  useEffect(() => {
    if (!open) return;
    setMinutes(5);
    setReasonId(null);
    setSelectedIds(itemsRef.current.map((i) => i.id));
  }, [open, orderId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !ticket) return null;

  const currentDelay = Math.max(0, ...items.map(itemDelayMinutes));
  const currentReason = items.find((i) => itemDelayMinutes(i) === currentDelay)?.delay_reason;
  // Lines finished while the sheet was open drop out of the selection.
  const liveSelected = selectedIds.filter((id) => items.some((i) => i.id === id));
  const canSubmit = liveSelected.length > 0 && minutes > 0 && !busy;

  const toggleItem = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const pickReason = (r) => {
    if (reasonId === r.id) {
      setReasonId(null);
      return;
    }
    setReasonId(r.id);
    if (Number(r.default_minutes) > 0) setMinutes(Number(r.default_minutes));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button
        type="button"
        aria-label={t("kitchen.kds.close", "Close")}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] cursor-default"
      />
      <section
        role="dialog"
        aria-modal="true"
        className="relative w-full sm:max-w-xl max-h-[92dvh] flex flex-col bg-[var(--kds-drawer)] border border-[color:var(--kds-line)] rounded-t-3xl sm:rounded-3xl shadow-2xl"
      >
        <header className="px-5 pt-5 pb-4 border-b border-[color:var(--kds-line)] flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[color:var(--kds-text)]">
              <IconClockPlus size={22} stroke={2} className="text-amber-400" />
              <h2 className="font-black text-lg">
                {t("kitchen.delay.title", "Add cooking time")} · #{ticket.order.token_no ?? ticket.order.id}
              </h2>
            </div>
            <p className="text-xs text-[color:var(--kds-muted)] mt-1 truncate">
              {getOrderTitle(ticket.order, t)} · {t("kitchen.delay.subtitle", "Front of house will be told about the delay.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 shrink-0 rounded-xl bg-[var(--kds-soft)] hover:bg-[var(--kds-soft-2)] text-[color:var(--kds-text-2)] flex items-center justify-center transition active:scale-95"
            aria-label={t("kitchen.kds.close", "Close")}
          >
            <IconX size={20} stroke={2} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 flex flex-col gap-5">
          {currentDelay > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 bg-amber-400/10 border border-amber-400/30">
              <span className="text-sm font-bold text-amber-200">
                {t("kitchen.delay.current", "Already delayed +{{m}} min", { m: currentDelay })}
                {currentReason ? ` · ${delayReasonLabel(currentReason, null, t)}` : ""}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => onClear(items.map((i) => i.id))}
                className="h-[42px] px-3 rounded-xl bg-[var(--kds-soft)] hover:bg-[var(--kds-soft-2)] text-[color:var(--kds-text)] text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
              >
                <IconRotateClockwise size={15} stroke={2.2} />
                {t("kitchen.delay.clear", "Clear delay")}
              </button>
            </div>
          )}

          {/* Reasons */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--kds-faint)] mb-2">
              {t("kitchen.delay.reason", "Reason (optional)")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(reasons || []).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => pickReason(r)}
                  className={clsx(
                    "min-h-[52px] px-3 rounded-2xl border text-left flex items-center gap-3 transition active:scale-[0.98]",
                    reasonId === r.id
                      ? "bg-amber-400 border-amber-400 text-slate-950"
                      : "bg-[var(--kds-chip)] border-[color:var(--kds-line)] text-[color:var(--kds-text)] hover:bg-[var(--kds-chip-hover)]"
                  )}
                >
                  <span className="text-xl leading-none w-7 text-center">{r.icon || "⏱"}</span>
                  <span className="flex-1 min-w-0 text-sm font-bold leading-snug">{delayReasonLabel(r.label, r.code, t)}</span>
                  {Number(r.default_minutes) > 0 && (
                    <span className={clsx("text-xs font-black tabular-nums", reasonId === r.id ? "" : "text-[color:var(--kds-muted)]")}>
                      +{r.default_minutes}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Minutes */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--kds-faint)] mb-2">
              {t("kitchen.delay.extra_time", "Extra time")}
            </h3>
            <div className="flex flex-wrap gap-2">
              {QUICK_ADD_MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinutes(m)}
                  className={clsx(
                    "h-12 min-w-[64px] px-3 rounded-xl border font-black tabular-nums text-base transition active:scale-95",
                    minutes === m
                      ? "bg-sky-500 border-sky-500 text-white"
                      : "bg-[var(--kds-chip)] border-[color:var(--kds-line)] text-[color:var(--kds-text)] hover:bg-[var(--kds-chip-hover)]"
                  )}
                >
                  +{m}
                </button>
              ))}
              <div className="h-12 flex items-center rounded-xl border border-[color:var(--kds-line)] bg-[var(--kds-chip)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setMinutes((m) => Math.max(1, m - 1))}
                  className="w-12 h-12 text-xl font-black text-[color:var(--kds-text)] hover:bg-[var(--kds-chip-hover)] active:scale-95"
                  aria-label={t("kitchen.delay.less", "One minute less")}
                >
                  −
                </button>
                <span className="min-w-[56px] text-center font-black tabular-nums text-[color:var(--kds-text)]">
                  {t("kitchen.prep.min_short", "{{m}} min", { m: minutes })}
                </span>
                <button
                  type="button"
                  onClick={() => setMinutes((m) => Math.min(240, m + 1))}
                  className="w-12 h-12 text-xl font-black text-[color:var(--kds-text)] hover:bg-[var(--kds-chip-hover)] active:scale-95"
                  aria-label={t("kitchen.delay.more", "One minute more")}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Items */}
          {items.length > 1 && (
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--kds-faint)] mb-2">
                {t("kitchen.delay.items", "Which items?")}
              </h3>
              <div className="flex flex-col gap-1.5">
                {items.map((item) => {
                  const on = selectedIds.includes(item.id);
                  const view = displayOrderItem(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className={clsx(
                        "min-h-[46px] px-3 rounded-xl border flex items-center gap-3 text-left transition active:scale-[0.99]",
                        on
                          ? "bg-sky-500/10 border-sky-500/40 text-[color:var(--kds-text)]"
                          : "bg-transparent border-[color:var(--kds-line)] text-[color:var(--kds-faint)]"
                      )}
                    >
                      <span
                        className={clsx(
                          "w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0",
                          on ? "bg-sky-500 border-sky-500 text-white" : "border-[color:var(--kds-dim)]"
                        )}
                      >
                        {on && <IconCheck size={15} stroke={3} />}
                      </span>
                      <span className="font-bold text-sm">
                        {item.quantity}× {view.item_title}
                        {view.variant_title ? ` · ${view.variant_title}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <footer className="p-4 border-t border-[color:var(--kds-line)] bg-[var(--kds-well)] rounded-b-3xl">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit({ minutes, reasonId, orderItemIds: liveSelected })}
            className={clsx(
              "w-full h-14 rounded-2xl font-black text-base uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-[0.98]",
              canSubmit ? "bg-amber-400 hover:bg-amber-300 text-slate-950" : "bg-[var(--kds-soft)] text-[color:var(--kds-faint)]"
            )}
          >
            <IconClockPlus size={20} stroke={2.4} />
            {t("kitchen.delay.submit", "Add +{{m}} min", { m: minutes })}
          </button>
        </footer>
      </section>
    </div>
  );
}
