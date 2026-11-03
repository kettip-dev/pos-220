import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import clsx from "clsx";
import { IconCashRegister, IconPlus, IconTrash, IconDeviceFloppy, IconEye, IconPrinter, IconLockOpen, IconCalendarCheck } from "@tabler/icons-react";
import Page from "../../components/Page";
import RegisterModalShell, { ModalButton, FieldLabel, inputClass } from "../../components/register/RegisterModalShell";
import RegisterReportView from "../../components/register/RegisterReportView";
import DayCloseModal from "../../components/register/DayCloseModal";
import {
  useRegisters,
  useRegisterSettings,
  useRegisterSessions,
  useBusinessDays,
  addRegister,
  updateRegister,
  deleteRegister,
  updateRegisterSettings,
  setPaymentTypeCash,
  getSessionSummary,
  reopenRegisterSession,
} from "../../controllers/register.controller";
import { usePaymentTypes, usePrintSettings, useStoreSettings } from "../../controllers/settings.controller";
import { formatCurrencyAmount, printRegisterReport } from "../../helpers/RegisterPrintHelper";
import { iconStroke } from "../../config/config";

const Section = ({ title, description, children, action }) => (
  <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6">
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
        {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const Toggle = ({ checked, onChange, label, hint }) => (
  <label className="flex items-start gap-3 min-h-[42px] cursor-pointer select-none py-1">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 w-5 h-5 accent-emerald-600" />
    <span>
      <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
      {hint && <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
    </span>
  </label>
);

export default function RegistersSettingsPage() {
  const { data: registers, mutate: mutateRegisters } = useRegisters();
  const { data: settings, mutate: mutateSettings } = useRegisterSettings();
  const { data: sessions, mutate: mutateSessions } = useRegisterSessions();
  const { data: days, mutate: mutateDays } = useBusinessDays();
  const { data: paymentTypes } = usePaymentTypes();
  const { data: printSettings } = usePrintSettings();
  const { data: storeSettings } = useStoreSettings();
  const currency = storeSettings?.currency || "USD";

  const [form, setForm] = useState(null);
  const [newName, setNewName] = useState("");
  const [cashFlags, setCashFlags] = useState({});
  const [viewing, setViewing] = useState(null);
  const [reopenTarget, setReopenTarget] = useState(null);
  const [reopenReason, setReopenReason] = useState("");
  const [isDayClosing, setIsDayClosing] = useState(false);

  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const saveSettings = async () => {
    try {
      const res = await updateRegisterSettings(form);
      toast.success(res.data?.message || "Saved.");
      setForm(res.data?.settings || form);
      mutateSettings();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not save.");
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await addRegister(newName.trim());
      setNewName("");
      mutateRegisters();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not add register.");
    }
  };

  const handleUpdate = async (register, patch) => {
    try {
      await updateRegister(register.id, { name: register.name, printerId: register.printer_id, isActive: Number(register.is_active) === 1, ...patch });
      mutateRegisters();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not update register.");
    }
  };

  const handleDelete = async (register) => {
    try {
      await deleteRegister(register.id);
      mutateRegisters();
      toast.success("Register deleted.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not delete register.");
    }
  };

  const handleCashFlag = async (pt, isCash) => {
    setCashFlags((prev) => ({ ...prev, [pt.id]: isCash }));
    try {
      await setPaymentTypeCash(pt.id, isCash);
    } catch (error) {
      setCashFlags((prev) => ({ ...prev, [pt.id]: !isCash }));
      toast.error(error?.response?.data?.message || "Could not update payment method.");
    }
  };

  const openSummary = async (session) => {
    try {
      const res = await getSessionSummary(session.id);
      setViewing(res.data);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not load the report.");
    }
  };

  const handleReopen = async () => {
    try {
      const res = await reopenRegisterSession(reopenTarget.id, reopenReason.trim());
      toast.success(res.data?.message || "Reopened.");
      setReopenTarget(null);
      setReopenReason("");
      mutateSessions();
      mutateRegisters();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not reopen.");
    }
  };

  return (
    <Page className="px-4 sm:px-8 py-6 space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <IconCashRegister size={30} stroke={iconStroke} className="text-emerald-600" />
        <h3 className="text-3xl font-light">Registers &amp; Cash</h3>
      </div>

      <Section title="Registers" description="Each physical till. A device is bound to a register when a cashier opens it on that device.">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {(Array.isArray(registers) ? registers : []).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 py-2">
              <input
                defaultValue={r.name}
                onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== r.name && handleUpdate(r, { name: e.target.value.trim() })}
                className={clsx(inputClass, "max-w-xs")}
              />
              <span className={clsx("text-xs font-semibold px-2 py-1 rounded-lg", r.open_session_id ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300")}>
                {r.open_session_id ? `Open · ${r.current_cashier}` : "Closed"}
              </span>
              <label className="flex items-center gap-2 min-h-[42px] text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                <input type="checkbox" checked={Number(r.is_active) === 1} onChange={(e) => handleUpdate(r, { isActive: e.target.checked })} className="w-5 h-5 accent-emerald-600" />
                Active
              </label>
              <button type="button" onClick={() => handleDelete(r)} className="ml-auto w-[42px] h-[42px] rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center active:scale-95" title="Delete (only if never used)">
                <IconTrash size={18} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New register, e.g. Bar Till" className={clsx(inputClass, "max-w-xs")} />
          <ModalButton onClick={handleAdd} disabled={!newName.trim()}>
            <IconPlus size={18} /> Add register
          </ModalButton>
        </div>
      </Section>

      {form && (
        <Section
          title="Cash control rules"
          action={
            <ModalButton variant="primary" onClick={saveSettings}>
              <IconDeviceFloppy size={18} /> Save
            </ModalButton>
          }
        >
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
            <Toggle checked={Number(form.enforce_session) === 1} onChange={(v) => setField("enforce_session", v)} label="Require an open register to take payments" hint="Payments, split checks and refunds are refused until a till is opened with a counted float." />
            <Toggle checked={Number(form.blind_close) === 1} onChange={(v) => setField("blind_close", v)} label="Blind close" hint="Cashiers count the drawer before seeing the expected amount. Register managers always see it." />
            <div>
              <FieldLabel>Variance needing manager approval ({currency})</FieldLabel>
              <input type="number" min="0" step="0.01" value={form.variance_threshold} onChange={(e) => setField("variance_threshold", e.target.value)} className={inputClass} />
            </div>
            <div>
              <FieldLabel>Prompt a safe drop above ({currency}, 0 = off)</FieldLabel>
              <input type="number" min="0" step="1" value={form.cash_drop_threshold} onChange={(e) => setField("cash_drop_threshold", e.target.value)} className={inputClass} />
            </div>
            <div>
              <FieldLabel>Refunds needing a manager PIN above ({currency}, 0 = off)</FieldLabel>
              <input type="number" min="0" step="0.01" value={form.refund_pin_threshold} onChange={(e) => setField("refund_pin_threshold", e.target.value)} className={inputClass} />
            </div>
            <div>
              <FieldLabel>Business day starts at (hour)</FieldLabel>
              <select value={form.day_cutoff_hour} onChange={(e) => setField("day_cutoff_hour", e.target.value)} className={inputClass}>
                {Array.from({ length: 13 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00{h === 0 ? " (midnight)" : " — sales before this count for the previous day"}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Cashier change mid-shift</FieldLabel>
              <div className="grid sm:grid-cols-2 gap-2">
                {[
                  { id: "shared", title: "Shared drawer", hint: "Hand over the open register without a recount." },
                  { id: "strict", title: "Strict accountability", hint: "Each cashier closes (Z) their own drawer before the next opens." },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setField("handover_mode", opt.id)}
                    className={clsx(
                      "min-h-[64px] p-3 rounded-xl border text-left transition active:scale-95",
                      form.handover_mode === opt.id ? "border-sky-500 ring-2 ring-sky-500/25 bg-sky-50 dark:bg-sky-500/10" : "border-slate-200 dark:border-slate-700"
                    )}
                  >
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{opt.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{opt.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>
      )}

      <Section title="Payment methods in the drawer" description="Mark which methods put physical cash in the till. Only these count towards expected cash.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {(Array.isArray(paymentTypes) ? paymentTypes : []).map((pt) => {
            const isCash = cashFlags[pt.id] !== undefined ? cashFlags[pt.id] : Number(pt.is_cash) === 1;
            return (
              <label key={pt.id} className="flex items-center gap-3 min-h-[48px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input type="checkbox" checked={isCash} onChange={(e) => handleCashFlag(pt, e.target.checked)} className="w-5 h-5 accent-emerald-600" />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100 flex-1">{pt.title}</span>
                <span className="text-xs text-slate-500">{isCash ? "Cash" : "Non-cash"}</span>
              </label>
            );
          })}
        </div>
      </Section>

      <Section
        title="Register history"
        description="Every session with its Z report. Reopening a closed register is logged and only possible while its business day is open."
        action={
          <ModalButton onClick={() => setIsDayClosing(true)}>
            <IconCalendarCheck size={18} /> Close business day
          </ModalButton>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-3">Z #</th>
                <th className="py-2 pr-3">Register</th>
                <th className="py-2 pr-3">Day</th>
                <th className="py-2 pr-3">Opened</th>
                <th className="py-2 pr-3">Closed</th>
                <th className="py-2 pr-3 text-right">Net sales</th>
                <th className="py-2 pr-3 text-right">Over / short</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(Array.isArray(sessions) ? sessions : []).map((s) => {
                const v = Number(s.variance_base || 0);
                return (
                  <tr key={s.id}>
                    <td className="py-2 pr-3 font-semibold">{s.z_number ? `#${s.z_number}` : "—"}</td>
                    <td className="py-2 pr-3">{s.register_name}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{s.business_date || "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {new Date(s.opened_at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {s.opened_by}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {s.status === "OPEN" ? <span className="text-emerald-600 font-semibold">Open</span> : `${new Date(s.closed_at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ${s.closed_by}`}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{s.net_sales !== null ? formatCurrencyAmount(s.net_sales, s.primary_currency) : "—"}</td>
                    <td className={clsx("py-2 pr-3 text-right tabular-nums font-semibold", v < 0 ? "text-rose-600" : v > 0 ? "text-emerald-600" : "")}>
                      {s.status === "CLOSED" ? formatCurrencyAmount(v, s.primary_currency) : "—"}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button type="button" onClick={() => openSummary(s)} className="w-[42px] h-[42px] rounded-xl inline-flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95" title="View report">
                        <IconEye size={18} />
                      </button>
                      {s.status === "CLOSED" && (
                        <button type="button" onClick={() => setReopenTarget(s)} className="w-[42px] h-[42px] rounded-xl inline-flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95" title="Reopen">
                          <IconLockOpen size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!sessions || sessions.length === 0) && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">No register sessions yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Business days">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {(Array.isArray(days) ? days : []).map((d) => {
            const summary = typeof d.summary === "string" ? JSON.parse(d.summary) : d.summary;
            return (
              <div key={d.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-white">{d.business_date}</span>
                  <span className={clsx("text-xs font-semibold", d.status === "OPEN" ? "text-emerald-600" : "text-slate-500")}>{d.status}</span>
                </div>
                {summary?.totals && (
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    Net {formatCurrencyAmount(summary.totals.net_sales, currency)} · {summary.totals.bill_count} bills · over/short {formatCurrencyAmount(summary.totals.variance_base, currency)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <RegisterModalShell
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        size="lg"
        icon={<IconCashRegister size={22} stroke={iconStroke} />}
        title={viewing?.status === "CLOSED" ? `Z report #${viewing?.z_number}` : "X report"}
        subtitle={viewing ? `${viewing.register_name} · ${viewing.business_date || ""}` : ""}
        footer={
          <>
            <ModalButton onClick={() => printRegisterReport(viewing, { printSettings, storeName: storeSettings?.storeName })}>
              <IconPrinter size={18} /> Print
            </ModalButton>
            <ModalButton variant="primary" onClick={() => setViewing(null)}>Done</ModalButton>
          </>
        }
      >
        <RegisterReportView summary={viewing} />
      </RegisterModalShell>

      <RegisterModalShell
        isOpen={Boolean(reopenTarget)}
        onClose={() => setReopenTarget(null)}
        size="sm"
        icon={<IconLockOpen size={22} stroke={iconStroke} />}
        title={`Reopen Z #${reopenTarget?.z_number || ""}`}
        subtitle={reopenTarget?.register_name}
        footer={
          <>
            <ModalButton onClick={() => setReopenTarget(null)}>Cancel</ModalButton>
            <ModalButton variant="danger" onClick={handleReopen} disabled={!reopenReason.trim()}>
              Reopen
            </ModalButton>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">The session goes back to open so it can take corrections, then must be counted and closed again. The original Z figures stay in the audit log.</p>
        <FieldLabel>Reason</FieldLabel>
        <input value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="e.g. Card batch entered on wrong till" className={inputClass} />
      </RegisterModalShell>

      <DayCloseModal
        isOpen={isDayClosing}
        onClose={() => setIsDayClosing(false)}
        currency={currency}
        onDone={() => {
          mutateDays();
          mutateSessions();
        }}
      />
    </Page>
  );
}
