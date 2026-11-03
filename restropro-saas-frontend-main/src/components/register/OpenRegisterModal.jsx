import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import clsx from "clsx";
import { IconCashRegister, IconCheck, IconPlus, IconLock } from "@tabler/icons-react";
import RegisterModalShell, { ModalButton, FieldLabel, inputClass } from "./RegisterModalShell";
import DenominationCounter, { countTotal, toDenominationRows } from "./DenominationCounter";
import { addRegister, getSuggestedFloat, openRegisterSession } from "../../controllers/register.controller";
import { setBoundRegisterId } from "../../helpers/RegisterBinding";
import { formatCurrencyAmount } from "../../helpers/RegisterPrintHelper";
import { iconStroke } from "../../config/config";

export const currencyPair = (storeCurrency) => {
  const primary = String(storeCurrency || "USD").toUpperCase();
  if (primary === "USD") return { primary, secondary: "KHR" };
  if (primary === "KHR") return { primary, secondary: "USD" };
  return { primary, secondary: null };
};

/**
 * Bind this device to a till and, if it is closed, open it with a counted float.
 * A till that is already open (e.g. opened on another tablet) is simply bound.
 */
export default function OpenRegisterModal({ isOpen, onClose, status, storeCurrency, exchangeRate, onOpened, dismissable = true }) {
  const { primary, secondary } = currencyPair(storeCurrency);
  const registers = (status?.registers || []).filter((r) => Number(r.is_active) === 1);
  const canManage = Boolean(status?.canManage);

  const [registerId, setRegisterId] = useState(null);
  const [newName, setNewName] = useState("");
  const [countsP, setCountsP] = useState({});
  const [countsS, setCountsS] = useState({});
  const [looseP, setLooseP] = useState("");
  const [looseS, setLooseS] = useState("");
  const [suggested, setSuggested] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCountsP({});
    setCountsS({});
    setLooseP("");
    setLooseS("");
    setNewName("");
    const preferred = registers.find((r) => Number(r.id) === Number(status?.boundRegisterId)) || (registers.length === 1 ? registers[0] : null);
    setRegisterId(preferred ? preferred.id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const selected = registers.find((r) => Number(r.id) === Number(registerId)) || null;

  useEffect(() => {
    setSuggested(null);
    if (!isOpen || !selected || selected.open_session_id) return;
    getSuggestedFloat(selected.id)
      .then((res) => setSuggested(res.data || null))
      .catch(() => setSuggested(null));
  }, [isOpen, selected?.id, selected?.open_session_id]);

  const totalP = countTotal(countsP, looseP);
  const totalS = secondary ? countTotal(countsS, looseS) : 0;

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      setIsBusy(true);
      const res = await addRegister(name);
      toast.success(res.data?.message || "Register added.");
      setNewName("");
      setRegisterId(res.data?.id);
      await onOpened?.(null);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not add register.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleBindOnly = async () => {
    setBoundRegisterId(selected.id);
    toast.success(`This device is now ${selected.name}.`);
    await onOpened?.(null);
    onClose?.();
  };

  const handleOpen = async () => {
    if (!selected) return;
    try {
      setIsBusy(true);
      const res = await openRegisterSession({
        registerId: selected.id,
        floatPrimary: totalP,
        floatSecondary: totalS,
        denominations: [...toDenominationRows(primary, countsP), ...(secondary ? toDenominationRows(secondary, countsS) : [])],
        exchangeRate,
      });
      setBoundRegisterId(selected.id);
      toast.success(res.data?.message || "Register opened.");
      await onOpened?.(res.data?.session);
      onClose?.();
    } catch (error) {
      const data = error?.response?.data;
      if (data?.code === "REGISTER_ALREADY_OPEN") {
        setBoundRegisterId(selected.id);
        toast.success(`${selected.name} is already open — this device is now using it.`);
        await onOpened?.(null);
        onClose?.();
        return;
      }
      toast.error(data?.message || "Could not open the register.");
    } finally {
      setIsBusy(false);
    }
  };

  const floatMismatch =
    suggested && suggested.counted_primary !== null && (Number(suggested.counted_primary) !== totalP || (secondary && Number(suggested.counted_secondary || 0) !== totalS));

  return (
    <RegisterModalShell
      isOpen={isOpen}
      onClose={onClose}
      dismissable={dismissable}
      size="lg"
      icon={<IconCashRegister size={22} stroke={iconStroke} />}
      title="Open Register"
      subtitle={status?.businessDay ? `Business day ${status.businessDay.business_date}` : "Count the starting cash float"}
      footer={
        <>
          {dismissable && <ModalButton onClick={onClose}>Cancel</ModalButton>}
          {selected?.open_session_id ? (
            <ModalButton variant="primary" onClick={handleBindOnly} disabled={isBusy}>
              <IconCheck size={18} /> Use {selected.name}
            </ModalButton>
          ) : (
            <ModalButton variant="primary" onClick={handleOpen} disabled={isBusy || !selected} className="min-w-[220px]">
              <IconCashRegister size={18} /> Open with {formatCurrencyAmount(totalP, primary)}
              {secondary && totalS > 0 ? ` + ${formatCurrencyAmount(totalS, secondary)}` : ""}
            </ModalButton>
          )}
        </>
      }
    >
      <FieldLabel>Register (this device)</FieldLabel>
      {registers.length === 0 && !canManage && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 text-sm flex items-center gap-2">
          <IconLock size={18} /> No registers are set up yet. Ask a manager to add one in Settings → Registers.
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {registers.map((r) => {
          const isSelected = Number(r.id) === Number(registerId);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setRegisterId(r.id)}
              className={clsx(
                "min-h-[64px] px-3 py-2 rounded-xl border text-left transition-all duration-150 active:scale-95 cursor-pointer",
                isSelected
                  ? "border-sky-500 ring-2 ring-sky-500/25 bg-sky-50 dark:bg-sky-500/10"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
              )}
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{r.name}</div>
              <div className={clsx("text-xs mt-0.5", r.open_session_id ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400")}>
                {r.open_session_id ? `Open · ${r.current_cashier || r.opened_by}` : "Closed"}
              </div>
            </button>
          );
        })}
      </div>
      {canManage && (
        <div className="flex gap-2 mt-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New register name, e.g. Front Counter" className={inputClass} />
          <ModalButton onClick={handleCreate} disabled={isBusy || !newName.trim()}>
            <IconPlus size={18} /> Add
          </ModalButton>
        </div>
      )}

      {selected && !selected.open_session_id && (
        <div className="mt-5">
          <div className="flex items-end justify-between gap-3 mb-2">
            <FieldLabel>Starting float</FieldLabel>
            {suggested && suggested.counted_primary !== null && (
              <span className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                Last close counted {formatCurrencyAmount(suggested.counted_primary, primary)}
                {secondary ? ` + ${formatCurrencyAmount(suggested.counted_secondary, secondary)}` : ""}
              </span>
            )}
          </div>
          <div className={clsx("grid gap-3", secondary ? "md:grid-cols-2" : "grid-cols-1")}>
            <DenominationCounter currency={primary} counts={countsP} loose={looseP} onChange={setCountsP} onLooseChange={setLooseP} />
            {secondary && <DenominationCounter currency={secondary} counts={countsS} loose={looseS} onChange={setCountsS} onLooseChange={setLooseS} />}
          </div>
          {floatMismatch && (totalP > 0 || totalS > 0) && (
            <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">
              This float differs from the last close. It will be recorded in the register audit log.
            </p>
          )}
        </div>
      )}
    </RegisterModalShell>
  );
}
