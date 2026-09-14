import React from "react";
import { IconUsers, IconUserCheck } from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import { ContextLoading } from "../system/EmptyContext";

function ready(c) { return c && !c.isLoading && c.data; }

/**
 * New vs Returning customers split.
 */
export function CustomerSplitWidget({ context }) {
  if (!ready(context)) return <ContextLoading />;
  const fresh = Number(context.data?.newCustomerCount || 0);
  const repeat = Number(context.data?.repeatedCustomerCount || 0);
  const total = fresh + repeat;
  const freshPct = total ? (fresh / total) * 100 : 0;
  const repeatPct = total ? (repeat / total) * 100 : 0;

  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> New today
          </span>
          <span className="text-sm font-bold text-foreground">{fresh}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-restro-bg-gray">
          <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${freshPct}%` }} />
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-restro-green" /> Returning
          </span>
          <span className="text-sm font-bold text-foreground">{repeat}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-restro-bg-gray">
          <div className="h-full rounded-full bg-restro-green transition-all" style={{ width: `${repeatPct}%` }} />
        </div>
      </div>
      <p className="text-center text-xs text-restro-text">
        Total customers today: <span className="font-bold text-foreground">{total}</span>
      </p>
    </div>
  );
}

export const ICONS = { IconUsers, IconUserCheck };
