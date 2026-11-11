import React, { useContext, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import { IconClockPlus, IconX } from "@tabler/icons-react";
import { SocketContext } from "../../contexts/SocketContext";
import { delayReasonLabel, diningLabel } from "./kdsUtils";

/**
 * Front-of-house alert when the kitchen adds time to a ticket, so the cashier
 * or waiter can tell the guest. Mounted once in the operational layout.
 */
export default function KitchenDelayAlerts() {
  const { socket } = useContext(SocketContext);
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (!socket) return undefined;
    const onDelay = (payload) => {
      if (!payload || !payload.minutes || payload.minutes <= 0) return;
      const tr = tRef.current;
      const where = payload.tableTitle || diningLabel(payload.deliveryType, tr);
      const reason = payload.reason ? delayReasonLabel(payload.reason, payload.reasonCode, tr) : null;
      const items = Array.isArray(payload.items) ? payload.items.slice(0, 3).join(", ") : "";
      const more = Array.isArray(payload.items) && payload.items.length > 3 ? ` +${payload.items.length - 3}` : "";

      toast.custom(
        (tt) => (
          <div
            role="alert"
            className={`pointer-events-auto w-[min(92vw,380px)] rounded-2xl bg-amber-400 text-slate-950 shadow-2xl border border-amber-500 p-3.5 flex gap-3 transition-all duration-200 ${
              tt.visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
            }`}
          >
            <div className="w-10 h-10 shrink-0 rounded-xl bg-black/10 flex items-center justify-center text-xl">
              {payload.reasonIcon || <IconClockPlus size={22} stroke={2.2} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm leading-tight">
                {tr("kitchen.delay.alert_title", "#{{token}} · {{where}} needs +{{m}} min", {
                  token: payload.tokenNo ?? payload.orderId,
                  where,
                  m: payload.minutes,
                })}
              </p>
              {reason && <p className="text-sm font-semibold mt-0.5">{reason}</p>}
              {items && (
                <p className="text-xs mt-1 opacity-80 truncate">
                  {items}
                  {more}
                </p>
              )}
              <p className="text-[11px] mt-1 font-semibold opacity-70">{tr("kitchen.delay.alert_hint", "Please let the guest know.")}</p>
            </div>
            <button
              type="button"
              onClick={() => toast.dismiss(tt.id)}
              className="w-[42px] h-[42px] -mr-1 -mt-1 shrink-0 rounded-xl hover:bg-black/10 flex items-center justify-center active:scale-95"
              aria-label={tr("kitchen.kds.close", "Close")}
            >
              <IconX size={18} stroke={2.4} />
            </button>
          </div>
        ),
        { id: `kitchen-delay-${payload.orderId}`, duration: 12000, position: "top-right" }
      );
      try {
        if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
      } catch {
        /* vibration not supported */
      }
    };
    socket.on("kitchen_delay", onDelay);
    return () => socket.off("kitchen_delay", onDelay);
  }, [socket]);

  return null;
}
