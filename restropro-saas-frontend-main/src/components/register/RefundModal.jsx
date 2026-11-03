import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import clsx from "clsx";
import { IconReceiptRefund, IconMinus, IconPlus } from "@tabler/icons-react";
import RegisterModalShell, { ModalButton, FieldLabel, inputClass } from "./RegisterModalShell";
import ManagerPinModal from "../common/ManagerPinModal";
import { getRefundableItems, refundInvoice } from "../../controllers/register.controller";
import { iconStroke } from "../../config/config";

const REASON_LABELS = {
  WRONG_ITEM: "Wrong item",
  QUALITY: "Food quality",
  LONG_WAIT: "Long wait",
  OVERCHARGED: "Overcharged",
  CUSTOMER_CHANGED_MIND: "Changed mind",
  DUPLICATE_PAYMENT: "Duplicate payment",
  OTHER: "Other",
};

const MODES = [
  { id: "ITEMS", label: "By item" },
  { id: "PARTIAL", label: "Amount" },
  { id: "FULL", label: "Full refund" },
];

/** Refund all or part of a paid invoice: by item, by amount, or in full. */
export default function RefundModal({ isOpen, onClose, invoiceId, currency = "$", paymentTypes = [], onRefunded }) {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState("ITEMS");
  const [qty, setQty] = useState({});
  const [amount, setAmount] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [reason, setReason] = useState("");
  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !invoiceId) return;
    setData(null);
    setMode("ITEMS");
    setQty({});
    setAmount("");
    setReasonCode("");
    setReason("");
    setPaymentTypeId("");
    getRefundableItems(invoiceId)
      .then((res) => setData(res.data))
      .catch((error) => toast.error(error?.response?.data?.message || "Could not load the invoice."));
  }, [isOpen, invoiceId]);

  const invoice = data?.invoice;
  const items = data?.items || [];
  const gross = items.reduce((acc, it) => acc + it.price * it.quantity, 0) || 1;
  const itemEstimate = items.reduce((acc, it) => acc + ((it.price * (qty[it.orderItemId] || 0)) / gross) * (invoice?.total || 0), 0);
  const estimate = mode === "FULL" ? invoice?.refundable || 0 : mode === "PARTIAL" ? Number(amount) || 0 : itemEstimate;
  const fmt = (v) => `${currency}${Number(v || 0).toFixed(2)}`;

  const valid =
    invoice &&
    invoice.refundable > 0 &&
    reasonCode &&
    (reasonCode !== "OTHER" || reason.trim()) &&
    estimate > 0 &&
    estimate <= invoice.refundable + 0.001;

  const submit = async (managerPin) => {
    try {
      setIsBusy(true);
      const res = await refundInvoice(invoiceId, {
        refundType: mode,
        amount: mode === "PARTIAL" ? Number(amount) : undefined,
        items: mode === "ITEMS" ? Object.entries(qty).filter(([, q]) => q > 0).map(([orderItemId, quantity]) => ({ orderItemId: Number(orderItemId), quantity })) : undefined,
        reasonCode,
        reason: reason.trim(),
        paymentTypeId: paymentTypeId || null,
        managerPin,
      });
      toast.success(res.data?.message || "Refund recorded.");
      onRefunded?.(res.data?.refund);
      onClose?.();
    } catch (error) {
      const resp = error?.response?.data;
      if (resp?.code === "MANAGER_PIN_REQUIRED" || resp?.code === "INVALID_MANAGER_PIN") {
        if (resp.code === "INVALID_MANAGER_PIN") toast.error(resp.message);
        setPinOpen(true);
        return;
      }
      toast.error(resp?.message || "Refund failed.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <RegisterModalShell
        isOpen={isOpen && !pinOpen}
        onClose={onClose}
        icon={<IconReceiptRefund size={22} stroke={iconStroke} />}
        title={`Refund invoice #${invoiceId}`}
        subtitle={invoice ? `Paid ${fmt(invoice.total)} · already refunded ${fmt(invoice.refunded_total)} · refundable ${fmt(invoice.refundable)}` : "Loading…"}
        footer={
          <>
            <ModalButton onClick={onClose}>Cancel</ModalButton>
            <ModalButton variant="danger" onClick={() => submit()} disabled={!valid || isBusy} className="min-w-[200px]">
              Refund {fmt(estimate)}
            </ModalButton>
          </>
        }
      >
        {invoice && invoice.refundable <= 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">This invoice has already been fully refunded.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={clsx(
                    "min-h-[48px] rounded-xl border text-sm font-semibold transition active:scale-95 cursor-pointer",
                    mode === m.id ? "border-sky-500 ring-2 ring-sky-500/25 bg-sky-50 dark:bg-sky-500/10 text-sky-800 dark:text-sky-200" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {mode === "ITEMS" && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((it) => {
                  const left = it.quantity - it.refundedQuantity;
                  const q = qty[it.orderItemId] || 0;
                  const set = (n) => setQty((prev) => ({ ...prev, [it.orderItemId]: Math.min(Math.max(n, 0), left) }));
                  return (
                    <div key={it.orderItemId} className="flex items-center gap-2 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{it.title}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {it.quantity} × {fmt(it.price)}
                          {it.refundedQuantity ? ` · ${it.refundedQuantity} refunded` : ""}
                        </div>
                      </div>
                      <button type="button" disabled={q <= 0} onClick={() => set(q - 1)} className="w-[42px] h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-40 active:scale-95">
                        <IconMinus size={16} />
                      </button>
                      <span className="w-8 text-center font-bold tabular-nums text-slate-900 dark:text-white">{q}</span>
                      <button type="button" disabled={q >= left} onClick={() => set(q + 1)} className="w-[42px] h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-40 active:scale-95">
                        <IconPlus size={16} />
                      </button>
                    </div>
                  );
                })}
                {items.length === 0 && <p className="p-3 text-sm text-slate-500">No item lines on this invoice; refund by amount instead.</p>}
              </div>
            )}
            {mode === "ITEMS" && itemEstimate > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">Item refunds include their share of tax, service charge and discounts.</p>
            )}

            {mode === "PARTIAL" && (
              <div>
                <FieldLabel>Refund amount (max {fmt(invoice?.refundable)})</FieldLabel>
                <input type="number" inputMode="decimal" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={clsx(inputClass, "text-lg font-bold tabular-nums")} />
              </div>
            )}

            <div>
              <FieldLabel>Reason</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {(data?.reasonCodes || Object.keys(REASON_LABELS)).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setReasonCode(code)}
                    className={clsx(
                      "min-h-[42px] px-3 rounded-xl text-xs font-semibold border transition active:scale-95 cursor-pointer",
                      reasonCode === code ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    )}
                  >
                    {REASON_LABELS[code] || code}
                  </button>
                ))}
              </div>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={reasonCode === "OTHER" ? "Describe the reason (required)" : "Notes (optional)"} className={clsx(inputClass, "mt-2")} />
            </div>

            <div>
              <FieldLabel>Refund to</FieldLabel>
              <select value={paymentTypeId} onChange={(e) => setPaymentTypeId(e.target.value)} className={inputClass}>
                <option value="">Original payment method(s)</option>
                {(paymentTypes || []).filter((p) => p.is_active !== 0).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Cash refunds are paid from the open register on this device.</p>
            </div>

            {(data?.refunds || []).length > 0 && (
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Previous refunds</div>
                {data.refunds.map((r) => (
                  <div key={r.id} className="flex justify-between text-sm py-0.5 text-slate-700 dark:text-slate-200">
                    <span>
                      #{r.refund_no} · {REASON_LABELS[r.reason_code] || r.reason_code} · {r.created_by}
                    </span>
                    <span className="tabular-nums">{fmt(r.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </RegisterModalShell>

      <ManagerPinModal
        isOpen={pinOpen}
        onClose={() => setPinOpen(false)}
        onSuccess={(pin) => {
          setPinOpen(false);
          submit(pin);
        }}
        title="Approve refund"
        description="Refunds over the set amount need a manager PIN."
      />
    </>
  );
}
