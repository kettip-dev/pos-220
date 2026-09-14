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
} from "@tabler/icons-react";
import {
  KPICard,
  RevenueTrendChart,
  PeakHoursChart,
  DonutWidget,
  TopItemsList,
  calcDelta,
  formatCurrency,
} from "../../components/DashboardWidgets";
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

export function RevenueKPI({ context }) {
  if (!ready(context)) return <ContextLoading />;
  const sym = useCurrencySymbol(context);
  const today = Number(context.data?.todayRevenue?.total_revenue || 0);
  const yest = Number(context.data?.yesterdayRevenue?.total_revenue || 0);
  return (
    <KPICard
      label="Today's Revenue"
      value={today}
      delta={calcDelta(today, yest)}
      icon={IconReceipt2}
      iconColor="#70B56A"
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
    <KPICard
      label="Orders"
      value={today}
      delta={calcDelta(today, yest)}
      icon={IconShoppingCart}
      iconColor="#4ECDC4"
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
    <KPICard
      label="Avg Order Value"
      value={today}
      delta={calcDelta(today, yest)}
      icon={IconTicket}
      iconColor="#A78BFA"
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
    <KPICard
      label="New Customers"
      value={today}
      delta={calcDelta(today, yest)}
      icon={IconUserPlus}
      iconColor="#F97316"
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
  const value = (() => {
    switch (variant) {
      case "repeat_customers":
        return { v: Number(context.data?.repeatedCustomerCount || 0), label: "Repeat Customers", money: false };
      case "cancelled_orders":
        return { v: Number(context.data?.cancelledOrders || 0), label: "Cancelled Orders", money: false };
      case "tax_collected":
        return { v: Number(context.data?.todayRevenue?.tax_total || 0), label: "Tax Collected", money: true };
      case "service_charge":
        return { v: Number(context.data?.todayRevenue?.service_charge_total || 0), label: "Service Charge", money: true };
      default:
        return { v: 0, label: "—", money: false };
    }
  })();

  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="text-3xl font-extrabold text-foreground">
        {value.money ? formatCurrency(value.v, sym) : value.v}
      </p>
      <p className="mt-1 text-xs font-semibold text-restro-text">{value.label}</p>
    </div>
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
