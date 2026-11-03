import React, { useEffect } from "react";
import clsx from "clsx";
import { IconArrowBackUp, IconHistory, IconX, IconArmchair, IconBoxSeam, IconMotorbike } from "@tabler/icons-react";
import { formatAgo, formatDuration, getOrderTitle } from "./kdsUtils";

const DiningIcon = ({ type }) => {
  if (type === "dinein") return <IconArmchair size={15} stroke={2} />;
  if (type === "delivery") return <IconMotorbike size={15} stroke={2} />;
  return <IconBoxSeam size={15} stroke={2} />;
};

/**
 * Slide-over listing tickets bumped from the current view (station-scoped),
 * newest first, so an accidental bump can be put back on the rail.
 */
export default function KdsRecallDrawer({ open, onClose, entries, nowMs, scopeLabel, onRecall }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close recall" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-[2px] cursor-default" />
      <aside className="relative w-full max-w-md h-full bg-[#111318] border-l border-white/[0.07] flex flex-col shadow-2xl kds-slide-in">
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.07] flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-white">
              <IconHistory size={20} stroke={2} className="text-amber-400" />
              <h2 className="font-black text-lg">Recall</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Bumped from <span className="font-semibold text-slate-200">{scopeLabel}</span>. Put a ticket back if it went out by mistake.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 flex items-center justify-center transition active:scale-95"
            aria-label="Close"
          >
            <IconX size={20} stroke={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-3">
          {entries.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 text-slate-500">
              <IconHistory size={40} stroke={1.5} className="opacity-40 mb-3" />
              <p className="font-semibold text-slate-300">Nothing bumped yet</p>
              <p className="text-xs mt-1 max-w-[260px]">Tickets you bump from this screen show up here until the bill is settled.</p>
            </div>
          ) : (
            entries.map(({ order, items, bumpedAtMs, durationSec }) => (
              <div key={order.id} className="rounded-2xl bg-[#171a22] border border-white/[0.06] overflow-hidden">
                <div className="px-4 pt-3.5 pb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-white tabular-nums">#{order.token_no ?? order.id}</span>
                      <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 truncate">
                        <DiningIcon type={order.delivery_type} />
                        {getOrderTitle(order)}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 font-medium">
                      {bumpedAtMs ? `Bumped ${formatAgo(bumpedAtMs, nowMs)}` : "Completed"}
                      {durationSec != null && <span> · took {formatDuration(durationSec)}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRecall(order)}
                    className="h-11 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm flex items-center gap-1.5 shrink-0 transition active:scale-95"
                  >
                    <IconArrowBackUp size={17} stroke={2.4} />
                    Recall
                  </button>
                </div>
                <ul className="px-4 pb-3 pt-2.5 border-t border-white/[0.05] flex flex-col gap-1">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-center gap-2 text-[13px]">
                      <span className="w-6 text-right font-black text-slate-400 tabular-nums">{it.quantity}×</span>
                      <span className={clsx("flex-1 truncate", it.status === "cancelled" ? "text-rose-300/70 line-through" : "text-slate-200")}>
                        {it.item_title}
                        {it.variant_title ? ` · ${it.variant_title}` : ""}
                      </span>
                      {it.station_name && (
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: it.station_color || "#64748b" }} title={it.station_name} />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
