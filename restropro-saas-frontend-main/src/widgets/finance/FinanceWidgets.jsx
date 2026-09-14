import React from "react";
import { IconReceiptTax, IconCash, IconReceipt } from "@tabler/icons-react";
import { CURRENCIES } from "../../config/currencies.config";
import { ContextLoading } from "../system/EmptyContext";

function ready(c) { return c && !c.isLoading && c.data; }
function symFor(c) {
  const code = c?.data?.currency;
  return CURRENCIES.find((x) => x.cc === code)?.symbol || "";
}

export function TaxAccruedWidget({ context }) {
  if (!ready(context)) return <ContextLoading />;
  const sym = symFor(context);
  const tax = Number(context.data?.todayRevenue?.tax_total || 0);
  const svc = Number(context.data?.todayRevenue?.service_charge_total || 0);
  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <div className="flex flex-col items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/20 p-3">
        <IconReceiptTax className="mb-1 text-emerald-600" size={22} />
        <p className="text-xl font-extrabold text-foreground">{sym}{tax.toFixed(0)}</p>
        <p className="mt-0.5 text-[11px] font-semibold text-restro-text">Tax today</p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-950/20 p-3">
        <IconCash className="mb-1 text-violet-600" size={22} />
        <p className="text-xl font-extrabold text-foreground">{sym}{svc.toFixed(0)}</p>
        <p className="mt-0.5 text-[11px] font-semibold text-restro-text">Service charge</p>
      </div>
    </div>
  );
}

export const ICONS = { IconReceiptTax, IconCash, IconReceipt };
