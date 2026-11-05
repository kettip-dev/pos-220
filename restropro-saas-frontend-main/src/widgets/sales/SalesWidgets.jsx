import React from "react";
import { useTranslation } from "react-i18next";
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
 * 2-row grid cell: label + icon, headline value, then the comparison row.
 *
 * The comparison is deliberately honest: a % change is only shown when
 * both days have activity. Early in the day (today = 0) or after a quiet
 * yesterday (yesterday = 0) a percentage would read as a scary "-100%" or a
 * meaningless "+100%", so we show yesterday's figure as plain context instead.
 * Pass yesterday = undefined to omit the comparison row.
 */
function KpiTile({ label, value, yesterday, icon: Icon, color, isMoney, currencySymbol }) {
  const { t } = useTranslation();
  const fmt = (v) => (isMoney ? formatCurrency(v, currencySymbol) : formatNumber(v));
  const today = Number(value) || 0;
  const hasCompare = yesterday !== undefined && yesterday !== null;
  const yest = Number(yesterday) || 0;
  const showPct = hasCompare && today > 0 && yest > 0;
  const d = showPct ? calcDelta(today, yest) : 0;
  const flat = Math.abs(d) < 0.05;
  const tone = flat
    ? "bg-restro-bg-gray text-restro-text"
    : d > 0
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
      : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400";
  const Arrow = flat ? null : d > 0 ? IconArrowUpRight : IconArrowDownRight;

  return (
    <div className="flex h-full flex-col justify-between gap-1">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] font-semibold text-restro-text">{label}</p>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}1f`, color }}
        >
          <Icon size={17} stroke={iconStroke} />
        </span>
      </div>
      <p
        data-sensitive
        className={`truncate text-[28px] font-extrabold leading-none tracking-tight tabular-nums ${today === 0 ? "text-restro-text" : "text-foreground"}`}
      >
        {fmt(today)}
      </p>
      {!hasCompare ? (
        <span className="h-5" />
      ) : (
        <div className="flex min-w-0 items-center gap-1.5 text-xs">
          {showPct && (
            <span className={`inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 font-bold tabular-nums ${tone}`}>
              {Arrow && <Arrow size={13} stroke={2.2} />}
              {d > 0 ? "+" : ""}{d.toFixed(1)}%
            </span>
          )}
          <span className="truncate text-restro-text">
            {showPct
              ? t("widgets.vs_yesterday", "vs yesterday")
              : <>{t("widgets.yesterday", "Yesterday")} <span data-sensitive className="font-semibold tabular-nums text-foreground">{fmt(yest)}</span></>}
          </span>
        </div>
      )}
    </div>
  );
}

export function RevenueKPI({ context }) {
  const { t } = useTranslation();
  if (!ready(context)) return <ContextLoading />;
  const sym = useCurrencySymbol(context);
  return (
    <KpiTile
      label={t("widgets.todays_revenue", "Today's Revenue")}
      value={Number(context.data?.todayRevenue?.total_revenue || 0)}
      yesterday={Number(context.data?.yesterdayRevenue?.total_revenue || 0)}
      icon={IconReceipt2}
      color="#2CA01C"
      isMoney
      currencySymbol={sym}
    />
  );
}

export function OrdersKPI({ context }) {
  const { t } = useTranslation();
  if (!ready(context)) return <ContextLoading />;
  return (
    <KpiTile
      label={t("widgets.orders_today", "Orders Today")}
      value={Number(context.data?.ordersCount || 0)}
      yesterday={Number(context.data?.yesterdayOrders || 0)}
      icon={IconShoppingCart}
      color="#0EA5E9"
    />
  );
}

export function AOVKPI({ context }) {
  const { t } = useTranslation();
  if (!ready(context)) return <ContextLoading />;
  const sym = useCurrencySymbol(context);
  return (
    <KpiTile
      label={t("widgets.avg_order_value", "Avg Order Value")}
      value={Number(context.data?.todayRevenue?.average_order_value || 0)}
      yesterday={Number(context.data?.yesterdayRevenue?.average_order_value || 0)}
      icon={IconTicket}
      color="#8B5CF6"
      isMoney
      currencySymbol={sym}
    />
  );
}

export function NewCustomersKPI({ context }) {
  const { t } = useTranslation();
  if (!ready(context)) return <ContextLoading />;
  return (
    <KpiTile
      label={t("widgets.new_customers", "New Customers")}
      value={Number(context.data?.newCustomerCount || 0)}
      yesterday={Number(context.data?.yesterdayNewCustomers || 0)}
      icon={IconUserPlus}
      color="#F97316"
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
  const { t } = useTranslation();
  if (!ready(context)) return <ContextLoading />;
  const sym = useCurrencySymbol(context);
  const variant = config.variant || "repeat_customers";
  const stat = (() => {
    switch (variant) {
      case "repeat_customers":
        return { v: Number(context.data?.repeatedCustomerCount || 0), label: t("widgets.repeat_customers", "Repeat Customers"), icon: IconUsers, color: "#06B6D4" };
      case "cancelled_orders":
        return { v: Number(context.data?.cancelledOrders || 0), label: t("widgets.cancelled_orders", "Cancelled Orders"), icon: IconCircleX, color: "#EF4444" };
      case "tax_collected":
        return { v: Number(context.data?.todayRevenue?.tax_total || 0), label: t("widgets.tax_collected", "Tax Collected"), icon: IconReceiptTax, color: "#EC4899", money: true };
      case "service_charge":
        return { v: Number(context.data?.todayRevenue?.service_charge_total || 0), label: t("widgets.service_charge", "Service Charge"), icon: IconCash, color: "#F59E0B", money: true };
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
