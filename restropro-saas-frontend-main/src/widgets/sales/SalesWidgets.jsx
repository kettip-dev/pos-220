import React from "react";
import {
  IconReceipt2,
  IconShoppingCart,
  IconTicket,
  IconUserPlus,
  IconChartLine,
  IconClock,
  IconChartPie,
  IconCreditCard,
  IconStar,
  IconReceiptTax,
  IconCash,
  IconArrowUpRight,
  IconArrowDownRight,
  IconUsers,
  IconCircleX,
} from "@tabler/icons-react";
import {
  RevenueTrendChart,
  PeakHoursChart,
  DonutWidget,
  TopItemsList,
  calcDelta,
  formatCurrency,
  formatNumber,
} from "../../components/DashboardWidgets";
import { iconStroke } from "../../config/config";
import { CURRENCIES } from "../../config/currencies.config";
import { ContextLoading } from "../system/EmptyContext";

function useCurrencySymbol(context) {
  const code = context?.data?.currency;
  const c = CURRENCIES.find((x) => x.cc === code);
  return c?.symbol || "";
}
function ready(context) {
  return context && !context.isLoading && context.data;
}

// All widget bodies render their inner element directly (no wrapper div).
// The flatten-CSS rule in widget-canvas.css strips the inner card chrome
// so the WidgetShell owns the visual frame.

/**
 * KpiTile — body for "compact" widgets (no shell header). Sized to fit a
 * 2-row grid cell: label + icon, headline value, then the vs-yesterday delta.
 * Pass delta = null to omit the comparison row.
 */
function KpiTile({ label, value, delta = null, icon: Icon, color, isMoney, currencySymbol }) {
  const d = Number(delta) || 0;
  const tone =
    d > 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
    : d < 0 ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
    : "bg-restro-bg-gray text-restro-text";
  const Arrow = d > 0 ? IconArrowUpRight : d < 0 ? IconArrowDownRight : null;

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] font-semibold text-restro-text">{label}</p>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}1f`, color }}
        >
          <Icon size={17} stroke={iconStroke} />
        </span>
      </div>
      <p data-sensitive className="truncate text-[28px] font-extrabold leading-none tracking-tight tabular-nums text-foreground">
        {isMoney ? formatCurrency(value, currencySymbol) : formatNumber(value)}
      </p>
      {delta === null ? (
        <span className="h-5" />
      ) : (
        <div className="flex items-center gap-1.5 text-xs">
          <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-bold tabular-nums ${tone}`}>
            {Arrow && <Arrow size={13} stroke={2.2} />}
            {d > 0 ? "+" : ""}{d.toFixed(1)}%
          </span>
          <span className="truncate text-restro-text">vs yesterday</span>
        </div>
      )}
    </div>
  );
}

export function RevenueKPI({ context }) {
  if (!ready(context)) return <ContextLoading />;
  const sym = useCurrencySymbol(context);
  const today = Number(context.data?.todayRevenue?.total_revenue || 0);
  const yest = Number(context.data?.yesterdayRevenue?.total_revenue || 0);
  return (
    <KpiTile
      label="Today's Revenue"
      value={today}
      delta={calcDelta(today, yest)}
      icon={IconReceipt2}
      color="#70B56A"
      isMoney
      currencySymbol={sym}
    />
  );
}

export function OrdersKPI({ context }) {
  if (!ready(context)) return <ContextLoading />;
  const sym = useCurrencySymbol(context);
  const today = Number(context.data?.ordersCount || 0);
  const yest = Number(context.data?.yesterdayOrders || 0);
  return (
    <KpiTile
      label="Orders"
      value={today}
      delta={calcDelta(today, yest)}
      icon={IconShoppingCart}
      color="#4ECDC4"
      currencySymbol={sym}
    />
  );
}

export function AOVKPI({ context }) {
  if (!ready(context)) return <ContextLoading />;
  const sym = useCurrencySymbol(context);
  const today = Number(context.data?.todayRevenue?.average_order_value || 0);
  const yest = Number(context.data?.yesterdayRevenue?.average_order_value || 0);
  return (
    <KpiTile
      label="Avg Order Value"
      value={today}
      delta={calcDelta(today, yest)}
      icon={IconTicket}
      color="#A78BFA"
      isMoney
      currencySymbol={sym}
    />
  );
}

export function NewCustomersKPI({ context }) {
  if (!ready(context)) return <ContextLoading />;
  const sym = useCurrencySymbol(context);
  const today = Number(context.data?.newCustomerCount || 0);
  const yest = Number(context.data?.yesterdayNewCustomers || 0);
  return (
    <KpiTile
      label="New Customers"
      value={today}
      delta={calcDelta(today, yest)}
      icon={IconUserPlus}
      color="#F97316"
      currencySymbol={sym}
    />
  );
}

export function RevenueTrendWidget({ context }) {
  if (!ready(context)) return <ContextLoading />;
  const sym = useCurrencySymbol(context);
  return <RevenueTrendChart data={context.data?.revenueTrend || []} currencySymbol={sym} />;
}

export function PeakHoursWidget({ context }) {
  if (!ready(context)) return <ContextLoading />;
  const sym = useCurrencySymbol(context);
  return <PeakHoursChart data={context.data?.salesByHour || []} currencySymbol={sym} />;
}

export function TopItemsWidget({ context }) {
  if (!ready(context)) return <ContextLoading />;
  const sym = useCurrencySymbol(context);
  return <TopItemsList items={context.data?.topSellingItems || []} currencySymbol={sym} />;
}

export function OrderTypeDonutWidget({ context }) {
  if (!ready(context)) return <ContextLoading />;
  const sym = useCurrencySymbol(context);
  return (
    <DonutWidget
      title="Order Type Breakdown"
      data={context.data?.ordersByType || []}
      labelKey="order_type"
      valueKey="count"
      currencySymbol={sym}
    />
  );
}

export function PaymentMixWidget({ context }) {
  if (!ready(context)) return <ContextLoading />;
  const sym = useCurrencySymbol(context);
  return (
    <DonutWidget
      title="Payment Mix"
      data={context.data?.paymentMix || []}
      labelKey="payment_type"
      valueKey="total"
      isMoney
      currencySymbol={sym}
    />
  );
}

export function QuickStatWidget({ config = {}, context }) {
  if (!ready(context)) return <ContextLoading />;
  const sym = useCurrencySymbol(context);
  const variant = config.variant || "repeat_customers";
  const stat = (() => {
    switch (variant) {
      case "repeat_customers":
        return { v: Number(context.data?.repeatedCustomerCount || 0), label: "Repeat Customers", icon: IconUsers, color: "#06B6D4" };
      case "cancelled_orders":
        return { v: Number(context.data?.cancelledOrders || 0), label: "Cancelled Orders", icon: IconCircleX, color: "#EF4444" };
      case "tax_collected":
        return { v: Number(context.data?.todayRevenue?.tax_total || 0), label: "Tax Collected", icon: IconReceiptTax, color: "#EC4899", money: true };
      case "service_charge":
        return { v: Number(context.data?.todayRevenue?.service_charge_total || 0), label: "Service Charge", icon: IconCash, color: "#F59E0B", money: true };
      default:
        return { v: 0, label: "—", icon: IconReceipt2, color: "#9CA3AF" };
    }
  })();

  return (
    <KpiTile
      label={stat.label}
      value={stat.v}
      icon={stat.icon}
      color={stat.color}
      isMoney={stat.money}
      currencySymbol={sym}
    />
  );
}

export const ICONS = {
  IconReceipt2,
  IconShoppingCart,
  IconTicket,
  IconUserPlus,
  IconChartLine,
  IconClock,
  IconChartPie,
  IconCreditCard,
  IconStar,
  IconReceiptTax,
  IconCash,
};
