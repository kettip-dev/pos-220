import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import clsx from "clsx";
import {
  IconCashRegister,
  IconReportMoney,
  IconArrowsTransferDown,
  IconLockOpen,
  IconBuildingBank,
  IconUserShare,
  IconDoorExit,
  IconCalendarCheck,
  IconPrinter,
  IconRefresh,
  IconSwitchHorizontal,
  IconAlertTriangle,
} from "@tabler/icons-react";
import RegisterModalShell, { ModalButton, FieldLabel, inputClass } from "./RegisterModalShell";
import RegisterReportView from "./RegisterReportView";
import CashMovementModal from "./CashMovementModal";
import CloseRegisterModal from "./CloseRegisterModal";
import DayCloseModal from "./DayCloseModal";
import { getSessionSummary, handoverRegisterSession } from "../../controllers/register.controller";
import { useUsers } from "../../controllers/users.controller";
import { printRegisterReport } from "../../helpers/RegisterPrintHelper";
import { iconStroke } from "../../config/config";

const Tile = ({ icon: Icon, label, onClick, tone = "default", disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={clsx(
      "min-h-[76px] px-2 py-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 text-sm font-semibold transition-all duration-150 active:scale-95 cursor-pointer select-none touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed",
      tone === "default" && "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800",
      tone === "danger" && "border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 bg-rose-50/60 dark:bg-rose-500/10 hover:bg-rose-100",
      tone === "primary" && "border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-500/10 hover:bg-emerald-100"
    )}
  >
    <Icon size={22} stroke={iconStroke} />
    {label}
  </button>
);

/**
 * The register's control panel, opened from the POS header: X report, cash
 * in/out, no sale, safe drop, cashier handover, close (Z) and end of day.
 */
export default function RegisterPanel({ isOpen, onClose, status, onChanged, onRequestOpen, printSettings, storeName, storeCurrency }) {
  const session = status?.boundSession || null;
  const settings = status?.settings || {};
  const canManage = Boolean(status?.canManage);

  const [summary, setSummary] = useState(null);
  const [movementType, setMovementType] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const [closingSession, setClosingSession] = useState(null);
  const [isDayClosing, setIsDayClosing] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [handoverTo, setHandoverTo] = useState("");
  const { data: users } = useUsers();

  const loadSummary = useCallback(() => {
    if (!session) return setSummary(null);
    getSessionSummary(session.id)
      .then((res) => setSummary(res.data))
      .catch(() => setSummary(null));
  }, [session?.id]);

  useEffect(() => {
    if (isOpen) loadSummary();
  }, [isOpen, loadSummary]);

  const refresh = async () => {
    await onChanged?.();
    loadSummary();
  };

  const doHandover = async () => {
    try {
      const res = await handoverRegisterSession(session.id, handoverTo);
      toast.success(res.data?.message || "Register handed over.");
      setHandoverOpen(false);
      setHandoverTo("");
      refresh();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Handover failed.");
    }
  };

  const strictHandover = settings.handover_mode === "strict";

  return (
    <>
      <RegisterModalShell
        isOpen={isOpen && !movementType && !isClosing && !isDayClosing && !handoverOpen}
        onClose={onClose}
        size="lg"
        icon={<IconCashRegister size={22} stroke={iconStroke} />}
        title={session ? session.register_name : "Register"}
        subtitle={
          session
            ? `Open since ${new Date(session.opened_at).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })} · Cashier ${session.current_cashier}${session.business_date ? ` · Day ${session.business_date}` : ""}`
            : "This device has no open register"
        }
      >
        {!session ? (
          <div className="flex flex-col items-center text-center gap-4 py-8">
            <IconCashRegister size={48} stroke={1.2} className="text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-sm">
              Open a register to start taking payments on this device. The opening float is counted and becomes the start of the cash drawer.
            </p>
            <div className="flex gap-2">
              <ModalButton variant="primary" onClick={onRequestOpen}>
                <IconCashRegister size={18} /> Open register
              </ModalButton>
              {canManage && (
                <ModalButton onClick={() => setIsDayClosing(true)}>
                  <IconCalendarCheck size={18} /> Close business day
                </ModalButton>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {summary?.drop_suggested && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 text-sm font-medium flex items-center gap-2">
                <IconAlertTriangle size={18} /> The drawer holds more cash than the limit. Make a safe drop.
                <button type="button" onClick={() => setMovementType("DROP")} className="ml-auto min-h-[42px] px-3 rounded-lg bg-amber-500 text-white text-xs font-bold active:scale-95">
                  Safe drop
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <Tile icon={IconPrinter} label="Print X" onClick={() => summary && printRegisterReport(summary, { printSettings, storeName })} disabled={!summary} />
              <Tile icon={IconArrowsTransferDown} label="Cash in/out" onClick={() => setMovementType("PAY_IN")} />
              <Tile icon={IconLockOpen} label="No sale" onClick={() => setMovementType("NO_SALE")} />
              <Tile icon={IconBuildingBank} label="Safe drop" onClick={() => setMovementType("DROP")} />
              <Tile icon={IconUserShare} label="Hand over" onClick={() => setHandoverOpen(true)} />
              <Tile icon={IconDoorExit} label="Close (Z)" tone="danger" onClick={() => { setClosingSession(session); setIsClosing(true); }} />
            </div>

            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <IconReportMoney size={18} /> X report (so far)
              </h4>
              <div className="flex gap-2">
                <button type="button" onClick={loadSummary} className="w-[42px] h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 active:scale-95">
                  <IconRefresh size={18} />
                </button>
                <button
                  type="button"
                  onClick={onRequestOpen}
                  className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 active:scale-95"
                >
                  <IconSwitchHorizontal size={16} /> Switch register
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setIsDayClosing(true)}
                    className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 active:scale-95"
                  >
                    <IconCalendarCheck size={16} /> End of day
                  </button>
                )}
              </div>
            </div>
            {summary ? <RegisterReportView summary={summary} /> : <p className="text-sm text-slate-500">Loading…</p>}
          </div>
        )}
      </RegisterModalShell>

      <CashMovementModal
        isOpen={Boolean(movementType)}
        onClose={() => setMovementType(null)}
        session={session}
        initialType={movementType || "PAY_IN"}
        printSettings={printSettings}
        onDone={refresh}
      />

      <CloseRegisterModal
        isOpen={isClosing}
        onClose={() => {
          setIsClosing(false);
          setClosingSession(null);
          onClose?.();
        }}
        session={closingSession || session}
        printSettings={printSettings}
        storeName={storeName}
        onClosed={() => onChanged?.()}
        onCloseDay={
          canManage
            ? () => {
                setIsClosing(false);
                setIsDayClosing(true);
              }
            : null
        }
      />

      <DayCloseModal isOpen={isDayClosing} onClose={() => setIsDayClosing(false)} currency={storeCurrency} onDone={() => onChanged?.()} />

      <RegisterModalShell
        isOpen={handoverOpen}
        onClose={() => setHandoverOpen(false)}
        size="sm"
        icon={<IconUserShare size={22} stroke={iconStroke} />}
        title="Hand over register"
        subtitle={session?.register_name}
        footer={
          strictHandover ? (
            <>
              <ModalButton onClick={() => setHandoverOpen(false)}>Cancel</ModalButton>
              <ModalButton
                variant="danger"
                onClick={() => {
                  setHandoverOpen(false);
                  setClosingSession(session);
                  setIsClosing(true);
                }}
              >
                Close register (Z)
              </ModalButton>
            </>
          ) : (
            <>
              <ModalButton onClick={() => setHandoverOpen(false)}>Cancel</ModalButton>
              <ModalButton variant="primary" onClick={doHandover} disabled={!handoverTo}>
                Hand over
              </ModalButton>
            </>
          )
        }
      >
        {strictHandover ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            This business uses strict cashier accountability: each cashier counts and closes their own drawer. Close this register with a Z report, then the next
            cashier opens it with their own float count.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
              The drawer is shared: the next cashier continues this session without a recount. The handover is recorded in the register audit log.
            </p>
            <FieldLabel>Next cashier</FieldLabel>
            <select value={handoverTo} onChange={(e) => setHandoverTo(e.target.value)} className={inputClass}>
              <option value="">Choose staff…</option>
              {(Array.isArray(users) ? users : [])
                .filter((u) => u.username !== session?.current_cashier)
                .map((u) => (
                  <option key={u.username} value={u.username}>
                    {u.name || u.username}
                  </option>
                ))}
            </select>
          </>
        )}
      </RegisterModalShell>
    </>
  );
}
