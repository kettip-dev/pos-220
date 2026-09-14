import React from "react";
import {
  IconActivityHeartbeat,
  IconClock,
  IconClipboardList,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import { ContextLoading, NoData } from "../system/EmptyContext";

function ready(c) { return c && !c.isLoading && c.data; }

/**
 * Order Status Board — derives from ordersByType + ordersCount
 */
export function OrderStatusBoardWidget({ context }) {
  if (!ready(context)) return <ContextLoading />;
  const total = Number(context.data?.ordersCount || 0);
  const cancelled = Number(context.data?.cancelledOrders || 0);
  const completed = Math.max(0, total - cancelled);

  const rows = [
    { label: "Total today", v: total, color: "#70B56A" },
    { label: "Completed",   v: completed, color: "#22c55e" },
    { label: "Cancelled",   v: cancelled, color: "#ef4444" },
  ];

  return (
    <div className="flex h-full flex-col gap-3">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-center justify-between rounded-xl bg-restro-bg-gray/40 px-4 py-3"
        >
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color }} />
            <span className="text-sm font-semibold text-foreground">{r.label}</span>
          </div>
          <span className="text-xl font-extrabold tabular-nums text-foreground">
            {r.v}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Live Orders Ticker — placeholder using top selling items as a "recent activity" feed.
 * In Phase 3.5 this can be wired to socket.io for true real-time.
 */
export function LiveOrdersTickerWidget({ context }) {
  if (!ready(context)) return <ContextLoading />;
  const items = (context.data?.topSellingItems || []).slice(0, 6);
  if (!items.length) return <NoData message="No live activity yet." />;

  return (
    <div className="space-y-2 overflow-y-auto">
      {items.map((it, i) => (
        <div key={it.id || i} className="flex items-center gap-3 rounded-lg bg-restro-bg-gray/40 px-3 py-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-restro-green-10 text-xs font-bold text-restro-green">
            {it.orders_count}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{it.title}</p>
          </div>
          <IconActivityHeartbeat size={14} stroke={iconStroke} className="text-restro-green animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export const ICONS = { IconActivityHeartbeat, IconClock, IconClipboardList };
