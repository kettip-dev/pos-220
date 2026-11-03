import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import clsx from "clsx";
import { IconArrowDownCircle, IconArrowUpCircle, IconBuildingBank, IconCoins, IconLockOpen } from "@tabler/icons-react";
import RegisterModalShell, { ModalButton, FieldLabel, inputClass } from "./RegisterModalShell";
import ManagerPinModal from "../common/ManagerPinModal";
import { addCashMovement } from "../../controllers/register.controller";
import { useUsers } from "../../controllers/users.controller";
import { kickCashDrawer } from "../../helpers/RegisterPrintHelper";
import { iconStroke } from "../../config/config";

export const MOVEMENT_TYPES = {
  PAY_IN: { label: "Pay In", hint: "Cash added to the drawer (e.g. extra change).", icon: IconArrowDownCircle, needsReason: true },
  PAY_OUT: { label: "Pay Out", hint: "Cash paid out for an expense. Needs a manager.", icon: IconArrowUpCircle, needsReason: true },
  DROP: { label: "Safe Drop", hint: "Excess cash moved from the drawer to the safe.", icon: IconBuildingBank },
  TIP_PAYOUT: { label: "Tip Payout", hint: "Card/QR tips paid to staff in cash. Needs a manager.", icon: IconCoins },
  NO_SALE: { label: "No Sale", hint: "Open the drawer without a sale, e.g. to give change.", icon: IconLockOpen, needsReason: true },
};

const REASON_PRESETS = {
  PAY_IN: ["Extra change", "Float top-up", "Owner deposit"],
  PAY_OUT: ["Ingredients", "Ice / water", "Delivery fee", "Supplies"],
  NO_SALE: ["Give change", "Check drawer", "Wrong drawer"],
};

export default function CashMovementModal({ isOpen, onClose, session, initialType = "PAY_IN", printSettings, onDone }) {
  const [type, setType] = useState(initialType);
  const [amountP, setAmountP] = useState("");
  const [amountS, setAmountS] = useState("");
  const [reason, setReason] = useState("");
  const [staff, setStaff] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const { data: users } = useUsers();

  useEffect(() => {
    if (!isOpen) return;
    setType(initialType);
    setAmountP("");
    setAmountS("");
    setReason("");
    setStaff("");
  }, [isOpen, initialType]);

  if (!session) return null;
  const p = session.primary_currency;
  const s = session.secondary_currency;
  const meta = MOVEMENT_TYPES[type];

  const submit = async (managerPin) => {
    try {
      setIsBusy(true);
      const res = await addCashMovement(session.id, {
        type,
        amountPrimary: Number(amountP) || 0,
        amountSecondary: Number(amountS) || 0,
        reason: reason.trim(),
        staffUsername: staff || null,
        managerPin,
      });
      // Every movement but a drop physically needs the drawer open.
      if (type !== "DROP") kickCashDrawer({ printSettings });
      toast.success(managerPin && res.data?.approvedBy ? `${meta.label} recorded (approved by ${res.data.approvedBy}).` : `${meta.label} recorded.`);
      onDone?.();
      onClose?.();
    } catch (error) {
      const data = error?.response?.data;
      if (data?.code === "MANAGER_PIN_REQUIRED" || data?.code === "INVALID_MANAGER_PIN") {
        if (data.code === "INVALID_MANAGER_PIN") toast.error(data.message);
        setPinOpen(true);
        return;
      }
      toast.error(data?.message || "Could not record the cash movement.");
    } finally {
      setIsBusy(false);
    }
  };

  const hasAmount = Number(amountP) > 0 || Number(amountS) > 0;
  const canSubmit = !isBusy && (type === "NO_SALE" || hasAmount) && (!meta.needsReason || reason.trim()) && (type !== "TIP_PAYOUT" || staff);

  return (
    <>
      <RegisterModalShell
        isOpen={isOpen && !pinOpen}
        onClose={onClose}
        icon={<meta.icon size={22} stroke={iconStroke} />}
        title="Cash In / Out"
        subtitle={session.register_name}
        footer={
          <>
            <ModalButton onClick={onClose}>Cancel</ModalButton>
            <ModalButton variant="primary" onClick={() => submit()} disabled={!canSubmit} className="min-w-[180px]">
              Record {meta.label}
            </ModalButton>
          </>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
          {Object.entries(MOVEMENT_TYPES).map(([key, m]) => (
            <button
              key={key}
              type="button"
              onClick={() => setType(key)}
              className={clsx(
                "min-h-[64px] px-2 py-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-all duration-150 active:scale-95 cursor-pointer",
                type === key
                  ? "border-sky-500 ring-2 ring-sky-500/25 bg-sky-50 dark:bg-sky-500/10 text-sky-800 dark:text-sky-200"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              )}
            >
              <m.icon size={20} stroke={iconStroke} />
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{meta.hint}</p>

        {type !== "NO_SALE" && (
          <div className={clsx("grid gap-3 mb-4", s ? "grid-cols-2" : "grid-cols-1")}>
            <div>
              <FieldLabel>Amount ({p})</FieldLabel>
              <input type="number" inputMode="decimal" min="0" value={amountP} onChange={(e) => setAmountP(e.target.value)} className={clsx(inputClass, "text-lg font-bold tabular-nums")} placeholder="0" />
            </div>
            {s && (
              <div>
                <FieldLabel>Amount ({s})</FieldLabel>
                <input type="number" inputMode="decimal" min="0" value={amountS} onChange={(e) => setAmountS(e.target.value)} className={clsx(inputClass, "text-lg font-bold tabular-nums")} placeholder="0" />
              </div>
            )}
          </div>
        )}

        {type === "TIP_PAYOUT" && (
          <div className="mb-4">
            <FieldLabel>Paid to</FieldLabel>
            <select value={staff} onChange={(e) => setStaff(e.target.value)} className={inputClass}>
              <option value="">Choose staff…</option>
              {(Array.isArray(users) ? users : []).map((u) => (
                <option key={u.username} value={u.username}>
                  {u.name || u.username}
                </option>
              ))}
            </select>
          </div>
        )}

        <FieldLabel>Reason{meta.needsReason ? "" : " (optional)"}</FieldLabel>
        {REASON_PRESETS[type] && (
          <div className="flex flex-wrap gap-2 mb-2">
            {REASON_PRESETS[type].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={clsx(
                  "min-h-[42px] px-3 rounded-xl text-xs font-semibold border transition active:scale-95 cursor-pointer",
                  reason === r ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        )}
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className={inputClass} />
      </RegisterModalShell>

      <ManagerPinModal
        isOpen={pinOpen}
        onClose={() => setPinOpen(false)}
        onSuccess={(pin) => {
          setPinOpen(false);
          submit(pin);
        }}
        title={`Approve ${meta.label}`}
        description="A manager PIN is required to take cash out of the drawer."
      />
    </>
  );
}
