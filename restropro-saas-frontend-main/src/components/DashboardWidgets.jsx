import React, { useMemo } from "react";
import Chart from "react-apexcharts";
import {
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconReceipt2,
  IconShoppingCart,
  IconTicket,
  IconUserPlus,
  IconCarrot,
  IconAlertTriangle,
  IconStar,
  IconStarFilled,
  IconStarHalfFilled,
  IconClock,
  IconFriends,
  IconArmchair2,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";

// ─── Helpers ─────────────────────────────────────────────────────
function calcDelta(today, yesterday) {
  if (!yesterday || yesterday === 0) return today > 0 ? 100 : 0;
  return ((today - yesterday) / yesterday) * 100;
}

function formatCurrency(value, symbol) {
  const num = Number(value) || 0;
  if (num >= 10000000) return `${symbol}${(num / 10000000).toFixed(1)}Cr`;
  if (num >= 100000) return `${symbol}${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `${symbol}${(num / 1000).toFixed(1)}K`;
  return `${symbol}${num.toFixed(num % 1 === 0 ? 0 : 2)}`;
}

function formatNumber(value) {
  const num = Number(value) || 0;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

const chartBaseConfig = {
  chart: {
    toolbar: { show: false },
    sparkline: { enabled: false },
    fontFamily: "Inter, sans-serif",
  },
  grid: { show: false },
  tooltip: {
    theme: "dark",
    style: { fontFamily: "Inter, sans-serif" },
  },
};

// ─── KPI Card ─────────────────────────────────────────────────────
export function KPICard({ label, value, delta, icon: Icon, iconColor, isMoney, currencySymbol }) {
  const deltaVal = Number(delta) || 0;
  const isPositive = deltaVal > 0;
  const isNeutral = deltaVal === 0;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-restro-border-green bg-restro-card-bg p-5 transition-all shadow-xs hover:shadow-md hover:-translate-y-0.5">
      {/* Subtle background gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2CA01C]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 truncate">{label}</p>
          <p className="mt-1.5 text-3xl font-extrabold tracking-tight text-foreground">
            {isMoney ? formatCurrency(value, currencySymbol) : formatNumber(value)}
          </p>

          {/* Delta badge */}
          <div className="mt-2 flex items-center gap-1.5">
            {isNeutral ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-restro-bg-gray px-2 py-0.5 text-xs font-bold text-restro-text">
                <IconMinus size={12} stroke={2} /> 0%
              </span>
            ) : isPositive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <IconTrendingUp size={12} stroke={2} /> +{deltaVal.toFixed(1)}%
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/30 px-2 py-0.5 text-xs font-bold text-red-500 dark:text-red-400">
                <IconTrendingDown size={12} stroke={2} /> {deltaVal.toFixed(1)}%
              </span>
            )}
            <span className="text-[11px] text-restro-text">vs yesterday</span>
          </div>
        </div>

        {/* Icon */}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors"
          style={{ backgroundColor: `${iconColor}15`, color: iconColor }}
        >
          <Icon size={24} stroke={iconStroke} />
        </div>
      </div>
    </div>
  );
}

// ─── Revenue Trend Chart (7 days) ─────────────────────────────────
export function RevenueTrendChart({ data, currencySymbol }) {
  const categories = useMemo(() => {
    return (data || []).map((d) => {
      const date = new Date(d.date);
      return date.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" });
    });
  }, [data]);

  const series = useMemo(() => {
    return [{ name: "Revenue", data: (data || []).map((d) => Number(d.revenue) || 0) }];
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-restro-border-green bg-background p-6">
        <h3 className="font-bold text-foreground">Revenue Trend</h3>
        <p className="mt-4 text-sm text-restro-text">No revenue data for the last 7 days.</p>
      </div>
    );
  }

  const options = {
    ...chartBaseConfig,
    chart: {
      ...chartBaseConfig.chart,
      type: "area",
      height: 260,
      zoom: { enabled: false },
    },
    colors: ["#18181b"],
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [0, 100],
      },
    },
    stroke: { curve: "smooth", width: 3 },
    dataLabels: { enabled: false },
    xaxis: {
      categories,
      labels: {
        style: { colors: "#9ca3af", fontFamily: "Nunito", fontSize: "11px" },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: "#9ca3af", fontFamily: "Nunito", fontSize: "11px" },
        formatter: (val) => formatCurrency(val, currencySymbol),
      },
    },
    tooltip: {
      ...chartBaseConfig.tooltip,
      y: { formatter: (val) => `${currencySymbol}${Number(val).toLocaleString()}` },
    },
    grid: {
      borderColor: "rgba(156, 163, 175, 0.15)",
      strokeDashArray: 4,
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } },
    },
  };

  return (
    <div className="rounded-2xl border border-restro-border-green bg-background p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-foreground">Revenue Trend</h3>
        <span className="text-xs font-semibold text-restro-text">Last 7 days</span>
      </div>
      <Chart options={options} series={series} type="area" height={260} />
    </div>
  );
}

// ─── Peak Hours Chart ─────────────────────────────────────────────
export function PeakHoursChart({ data, currencySymbol }) {
  const fullHours = useMemo(() => {
    const hourMap = {};
    (data || []).forEach((d) => { hourMap[d.hour] = d; });
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${i === 0 ? "12" : i > 12 ? i - 12 : i}${i < 12 ? "am" : "pm"}`,
      revenue: Number(hourMap[i]?.revenue || 0),
      orders: Number(hourMap[i]?.orders || 0),
    }));
  }, [data]);

  const series = [{ name: "Orders", data: fullHours.map((h) => h.orders) }];
  const categories = fullHours.map((h) => h.label);

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-restro-border-green bg-background p-6 h-full">
        <h3 className="font-bold text-foreground">Peak Hours</h3>
        <p className="mt-4 text-sm text-restro-text">No sales data yet today.</p>
      </div>
    );
  }

  const maxOrders = Math.max(...fullHours.map((h) => h.orders));

  const options = {
    ...chartBaseConfig,
    chart: {
      ...chartBaseConfig.chart,
      type: "bar",
      height: 220,
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: "55%",
        distributed: false,
      },
    },
    colors: fullHours.map((h) =>
      h.orders >= maxOrders * 0.8 ? "#18181b" : h.orders >= maxOrders * 0.4 ? "#52525b" : "#a1a1aa"
    ),
    fill: { opacity: 1 },
    dataLabels: { enabled: false },
    xaxis: {
      categories,
      labels: {
        style: { colors: "#9ca3af", fontFamily: "Nunito", fontSize: "10px" },
        rotate: -45,
        rotateAlways: true,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: "#9ca3af", fontFamily: "Nunito", fontSize: "11px" },
      },
    },
    tooltip: {
      ...chartBaseConfig.tooltip,
      y: { formatter: (val) => `${val} orders` },
    },
    grid: {
      borderColor: "rgba(156, 163, 175, 0.15)",
      strokeDashArray: 4,
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } },
    },
  };

  return (
    <div className="rounded-2xl border border-restro-border-green bg-background p-6 h-full">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-foreground">Peak Hours</h3>
        <span className="text-xs font-semibold text-restro-text">Today</span>
      </div>
      <Chart options={options} series={series} type="bar" height={220} />
    </div>
  );
}

// ─── Donut Chart (generic for Order Type / Payment Mix) ──────────
export function DonutWidget({ title, data, labelKey, valueKey, valuePrefix, isMoney, currencySymbol }) {
  const labels = (data || []).map((d) => d[labelKey] || "Other");
  const values = (data || []).map((d) => Number(d[valueKey]) || 0);
  const total = values.reduce((s, v) => s + v, 0);

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-restro-border-green bg-background p-6 h-full">
        <h3 className="font-bold text-foreground">{title}</h3>
        <p className="mt-4 text-sm text-restro-text">No data available.</p>
      </div>
    );
  }

  const palette = ["#18181b", "#4ECDC4", "#FF6B6B", "#FFE66D", "#A78BFA", "#F97316", "#06B6D4", "#EC4899"];

  const options = {
    chart: {
      type: "donut",
      fontFamily: "Nunito, sans-serif",
    },
    labels,
    colors: palette.slice(0, labels.length),
    legend: {
      position: "bottom",
      fontSize: "12px",
      fontFamily: "Nunito",
      labels: { colors: "#9ca3af" },
      markers: { width: 10, height: 10, radius: 3 },
    },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: {
          size: "70%",
          labels: {
            show: true,
            name: { fontSize: "13px", fontFamily: "Nunito", color: "#9ca3af" },
            value: {
              fontSize: "20px",
              fontFamily: "Nunito",
              fontWeight: 700,
              formatter: (val) =>
                isMoney ? `${currencySymbol}${Number(val).toLocaleString()}` : Number(val).toLocaleString(),
            },
            total: {
              show: true,
              label: "Total",
              fontSize: "12px",
              fontFamily: "Nunito",
              color: "#9ca3af",
              formatter: () =>
                isMoney ? formatCurrency(total, currencySymbol) : total.toLocaleString(),
            },
          },
        },
      },
    },
    stroke: { width: 0 },
    tooltip: {
      theme: "dark",
      y: {
        formatter: (val) => {
          const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0.0";
          return isMoney
            ? `${currencySymbol}${Number(val).toLocaleString()} (${pct}%)`
            : `${val} (${pct}%)`;
        },
      },
    },
  };

  return (
    <div className="rounded-2xl border border-restro-border-green bg-background p-6 h-full">
      <h3 className="font-bold text-foreground mb-2">{title}</h3>
      <Chart options={options} series={values} type="donut" height={260} />
    </div>
  );
}

// ─── Top Selling Items List ───────────────────────────────────────
export function TopItemsList({ items, currencySymbol }) {
  const maxCount = Math.max(...(items || []).map((i) => Number(i.orders_count) || 0), 1);

  return (
    <div className="rounded-2xl border border-restro-border-green bg-background p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-foreground">Top Selling Items</h3>
        <span className="text-xs font-semibold text-restro-text">Today</span>
      </div>

      {(!items || items.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-8">
          <IconCarrot className="text-restro-text opacity-40 mb-2" size={40} stroke={iconStroke} />
          <p className="text-sm text-restro-text">No items sold yet today.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 8).map((item, i) => {
            const pct = Math.max(((Number(item.orders_count) || 0) / maxCount) * 100, 8);
            return (
              <div key={item.id || i} className="group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-restro-green-10 text-xs font-bold text-restro-green">
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-foreground truncate">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-restro-text">{currencySymbol}{Number(item.price || 0).toFixed(0)}</span>
                    <span className="text-sm font-bold text-foreground tabular-nums w-8 text-right">
                      {item.orders_count}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-restro-bg-gray overflow-hidden">
                  <div
                    className="h-full rounded-full bg-restro-green transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Low Stock Alerts ─────────────────────────────────────────────
export function LowStockAlerts({ items }) {
  return (
    <div className="rounded-2xl border border-restro-border-green bg-background p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-foreground">Low Stock Alerts</h3>
        <IconAlertTriangle size={18} className="text-amber-500" stroke={iconStroke} />
      </div>

      {(!items || items.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 mb-2">
            <IconTrendingUp className="text-emerald-500" size={24} stroke={iconStroke} />
          </div>
          <p className="text-sm font-semibold text-foreground">All stocked up!</p>
          <p className="text-xs text-restro-text mt-1">No items below threshold.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const isOut = item.status === "out" || Number(item.quantity) <= 0;
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 ${
                  isOut
                    ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40"
                    : "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`flex h-2.5 w-2.5 shrink-0 rounded-full ${isOut ? "bg-red-500 animate-pulse" : "bg-amber-500"}`} />
                  <span className="text-sm font-semibold text-foreground truncate">{item.title}</span>
                </div>
                <span className={`text-xs font-bold shrink-0 ${isOut ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {Number(item.quantity).toFixed(1)} {item.unit}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Star Rating Helper ───────────────────────────────────────────
function StarRating({ rating, size = 14 }) {
  const stars = [];
  const r = Number(rating) || 0;
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(r)) {
      stars.push(<IconStarFilled key={i} size={size} className="text-amber-400" />);
    } else if (i - 0.5 <= r) {
      stars.push(<IconStarHalfFilled key={i} size={size} className="text-amber-400" />);
    } else {
      stars.push(<IconStar key={i} size={size} className="text-gray-300 dark:text-gray-600" stroke={iconStroke} />);
    }
  }
  return <div className="flex items-center gap-0.5">{stars}</div>;
}

// ─── Recent Feedback Widget ───────────────────────────────────────
export function FeedbackWidget({ feedbacks }) {
  return (
    <div className="rounded-2xl border border-restro-border-green bg-background p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-foreground">Recent Feedback</h3>
        <IconStar size={18} className="text-amber-400" stroke={iconStroke} />
      </div>

      {(!feedbacks || feedbacks.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-8">
          <IconStar className="text-restro-text opacity-40 mb-2" size={40} stroke={iconStroke} />
          <p className="text-sm text-restro-text">No feedback yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedbacks.map((fb) => (
            <div key={fb.id} className="rounded-xl bg-restro-bg-gray/50 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-foreground truncate max-w-[140px]">
                  {fb.customer_name}
                </span>
                <StarRating rating={fb.average_rating} />
              </div>
              {fb.remarks && (
                <p className="text-xs text-restro-text line-clamp-2 mt-1">"{fb.remarks}"</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Upcoming Reservations Widget ─────────────────────────────────
export function ReservationWidget({ reservations }) {
  return (
    <div className="rounded-2xl border border-restro-border-green bg-background p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-foreground">Today's Reservations</h3>
        <IconClock size={18} className="text-restro-green" stroke={iconStroke} />
      </div>

      {(!reservations || reservations.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-8">
          <IconArmchair2 className="text-restro-text opacity-40 mb-2" size={40} stroke={iconStroke} />
          <p className="text-sm text-restro-text">No reservations today.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {reservations.slice(0, 5).map((res, i) => {
            const time = new Intl.DateTimeFormat("en", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }).format(new Date(res.date));

            return (
              <div
                key={res.id || i}
                className="flex items-center gap-3 rounded-xl bg-restro-bg-gray/50 px-3.5 py-2.5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-restro-green-10 text-restro-green">
                  <IconClock size={18} stroke={iconStroke} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    {res.customer_name || res.customer_id}
                  </p>
                  <p className="text-xs text-restro-text flex items-center gap-2">
                    <span>{time}</span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5">
                      <IconFriends size={11} stroke={iconStroke} /> {res.people_count}
                    </span>
                    {res.table_title && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <IconArmchair2 size={11} stroke={iconStroke} /> {res.table_title}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Export helpers for DashboardPage ──────────────────────────────
export { calcDelta, formatCurrency, formatNumber };
