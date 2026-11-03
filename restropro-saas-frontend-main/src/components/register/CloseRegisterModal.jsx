import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import clsx from "clsx";
import { IconAlertTriangle, IconPrinter, IconDoorExit } from "@tabler/icons-react";
import RegisterModalShell, { ModalButton, FieldLabel, inputClass } from "./RegisterModalShell";
import DenominationCounter, { countTotal, toDenominationRows } from "./DenominationCounter";
import RegisterReportView from "./RegisterReportView";
import ManagerPinModal from "../common/ManagerPinModal";
import { closeRegisterSession, getSessionSummary } from "../../controllers/register.controller";
import { formatCurrencyAmount, printRegisterReport } from "../../helpers/RegisterPrintHelper";
import { iconStroke } from "../../config/config";

/**
 * Close a till: count the drawer (blind when the business requires it), see the
 * variance, get a manager PIN when it is over the limit, then print the Z report.
 */
export default function CloseRegisterModal({ isOpen, onClose, session, printSettings, storeName, onClosed, onCloseDay }) {
  const [countsP, setCountsP] = useState({});
  const [countsS, setCountsS] = useState({});
  const [looseP, setLooseP] = useState("");
  const [looseS, setLooseS] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState(null);
  const [variance, setVariance] = useState(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [zReport, setZReport] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!isOpen || !session) return;
    setCountsP({});
    setCountsS({});
    setLooseP("");
    setLooseS("");
    setNote("");
    setVariance(null);
    setZReport(null);
    setPreview(null);
    getSessionSummary(session.id)
      .then((res) => setPreview(res.data))
      .catch(() => setPreview(null));
    // Only reset when the dialog opens; a closed session must not wipe the Z on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // The Z view must survive the status refresh that clears the (now closed) session.
  const p = session?.primary_currency;
  const s = session?.secondary_currency;
  const totalP = countTotal(countsP, looseP);
  const totalS = s ? countTotal(countsS, looseS) : 0;
  const blind = preview?.blind === true;

  const submit = async (managerPin) => {
    try {
      setIsBusy(true);
      const res = await closeRegisterSession(session.id, {
        countedPrimary: totalP,
        countedSecondary: totalS,
        denominations: [...toDenominationRows(p, countsP), ...(s ? toDenominationRows(s, countsS) : [])],
        note: note.trim(),
        managerPin,
      });
      const summary = res.data?.summary;
      setZReport(summary);
      toast.success(res.data?.message || "Register closed.");
      printRegisterReport(summary, { printSettings, storeName });
      onClosed?.(summary);
    } catch (error) {
      const data = error?.response?.data;
      if (data?.code === "VARIANCE_APPROVAL_REQUIRED") {
        setVariance(data.variance || null);
        if (data.reason === "INVALID_MANAGER_PIN") toast.error("Invalid manager PIN.");
        return;
      }
      toast.error(data?.message || "Could not close the register.");
    } finally {
      setIsBusy(false);
    }
  };

  if (zReport) {
    return (
      <RegisterModalShell
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
        icon={<IconDoorExit size={22} stroke={iconStroke} />}
        title={`Register closed · Z #${zReport.z_number}`}
        subtitle={`${zReport.register_name} · ${zReport.business_date || ""}`}
        footer={
          <>
            <ModalButton onClick={() => printRegisterReport(zReport, { printSettings, storeName })}>
              <IconPrinter size={18} /> Reprint Z
            </ModalButton>
            {onCloseDay && (
              <ModalButton onClick={onCloseDay}>Close business day…</ModalButton>
            )}
            <ModalButton variant="primary" onClick={onClose}>Done</ModalButton>
          </>
        }
      >
        <RegisterReportView summary={zReport} />
      </RegisterModalShell>
    );
  }

  if (!session) return null;
  const varianceBase = variance ? Number(variance.base) : null;

  return (
    <>
      <RegisterModalShell
        isOpen={isOpen && !pinOpen}
        onClose={onClose}
        size="lg"
        icon={<IconDoorExit size={22} stroke={iconStroke} />}
        title={`Close ${session.register_name}`}
        subtitle={blind ? "Blind close: count the drawer before the expected total is shown" : "Count the drawer"}
        footer={
          variance ? (
            <>
              <ModalButton onClick={() => setVariance(null)}>Recount</ModalButton>
              <ModalButton variant="danger" onClick={() => setPinOpen(true)} disabled={isBusy}>
                Manager approve &amp; close
              </ModalButton>
            </>
          ) : (
            <>
              <ModalButton onClick={onClose}>Cancel</ModalButton>
              <ModalButton variant="primary" onClick={() => submit()} disabled={isBusy} className="min-w-[220px]">
                Close &amp; print Z report
              </ModalButton>
            </>
          )
        }
      >
        {variance ? (
          <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-200">
            <div className="flex items-center gap-2 font-bold text-lg">
              <IconAlertTriangle size={22} /> Drawer is {varianceBase < 0 ? "short" : "over"} by {formatCurrencyAmount(Math.abs(varianceBase), p)}
            </div>
            <p className="text-sm mt-2">
              {formatCurrencyAmount(variance.primary, p)}
              {s ? ` and ${formatCurrencyAmount(variance.secondary, s)}` : ""} against what the register expected. Recount, or ask a manager to approve the
              variance.
            </p>
          </div>
        ) : (
          <>
            {!blind && preview?.cash?.expected_primary !== null && preview?.cash && (
              <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-sm text-slate-700 dark:text-slate-200 flex flex-wrap gap-x-4">
                <span>
                  Expected: <b className="tabular-nums">{formatCurrencyAmount(preview.cash.expected_primary, p)}</b>
                </span>
                {s && (
                  <span>
                    <b className="tabular-nums">{formatCurrencyAmount(preview.cash.expected_secondary, s)}</b>
                  </span>
                )}
                <span>
                  Counted: <b className={clsx("tabular-nums")}>{formatCurrencyAmount(totalP, p)}</b>
                </span>
              </div>
            )}
            <div className={clsx("grid gap-3", s ? "md:grid-cols-2" : "grid-cols-1")}>
              <DenominationCounter currency={p} counts={countsP} loose={looseP} onChange={setCountsP} onLooseChange={setLooseP} />
              {s && <DenominationCounter currency={s} counts={countsS} loose={looseS} onChange={setCountsS} onLooseChange={setLooseS} />}
            </div>
            <div className="mt-4">
              <FieldLabel>Closing note (optional)</FieldLabel>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. $5 given to delivery driver, receipt in drawer" className={inputClass} />
            </div>
          </>
        )}
      </RegisterModalShell>

      <ManagerPinModal
        isOpen={pinOpen}
        onClose={() => setPinOpen(false)}
        onSuccess={(pin) => {
          setPinOpen(false);
          submit(pin);
        }}
        title="Approve cash variance"
        description="The drawer count is outside the allowed variance."
      />
    </>
  );
}
