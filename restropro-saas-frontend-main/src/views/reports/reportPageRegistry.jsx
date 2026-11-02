import React from "react";
import clsx from "clsx";
import ReactApexChart from "react-apexcharts";
import { formatReportValue } from "../../utils/reportExports.jsx";
import { useTheme } from "../../contexts/ThemeContext";

// Brand-led categorical palette. Every colour stays legible on both the light
// (white) and dark (zinc-900) chart surfaces.
const PALETTE = ["#2CA01C", "#0EA5E9", "#F59E0B", "#8B5CF6", "#F43F5E", "#14B8A6", "#64748B", "#EAB308"];

// Shared theme-aware base options so charts adapt to light/dark mode.
const useChartTheme = () => {
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const foreColor = isDark ? "#A1A1AA" : "#64748B";
  const gridBorder = isDark ? "#27272A" : "#E2E8F0";

  return {
    isDark,
    foreColor,
    baseOptions: {
      theme: { mode: isDark ? "dark" : "light" },
      chart: { background: "transparent", foreColor, toolbar: { show: false }, fontFamily: "inherit", animations: { speed: 350 } },
      grid: { borderColor: gridBorder, strokeDashArray: 4 },
      tooltip: { theme: isDark ? "dark" : "light" },
      legend: { labels: { colors: foreColor }, fontWeight: 600 },
      dataLabels: { enabled: false },
      colors: PALETTE,
    },
  };
};

/* --------------------------------- helpers -------------------------------- */

const NUMERIC_TYPES = ["money", "number", "quantity"];

const getTable = (data, index = 0) => data?.tables?.[index] || { rows: [], columns: [] };

// Build chart series from a table's column definitions, keeping only columns that exist.
const seriesFrom = (columns = [], ...keys) => keys
  .map((key) => columns.find((column) => column.key === key))
  .filter(Boolean)
  .map((column) => ({ key: column.key, name: column.label, type: column.type }));

const hasUsableValues = (rows = [], keys = []) => (
  rows.length > 0 && keys.some((key) => rows.some((row) => Number(row?.[key] || 0) !== 0))
);

const toLocalDateKey = (value) => {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const formatLabel = (value, labelType) => {
  if (value == null || value === "") return "—";
  const raw = String(value);
  if (labelType === "hour") return `${raw.padStart(2, "0")}:00`;
  if (labelType === "month") {
    const [year, month] = raw.split("-").map(Number);
    if (year && month) return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }
  if (labelType === "date") {
    const key = toLocalDateKey(raw);
    if (key) {
      const [year, month, day] = key.split("-").map(Number);
      return new Date(year, month - 1, day).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    }
  }
  return raw.replace(/_/g, " ");
};

const compactFormatter = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const formatAxis = (value, type, currency) => {
  const number = Number(value || 0);
  if (type === "money") return `${number < 0 ? "-" : ""}${currency}${compactFormatter.format(Math.abs(number))}`;
  return compactFormatter.format(number);
};

// Sum a value per label, largest first. valueKey === null counts rows instead.
const sumBy = (rows, labelKey, valueKey = null, labelFn = (row) => row[labelKey]) => {
  const grouped = new Map();
  rows.forEach((row) => {
    const label = labelFn(row) ?? "—";
    grouped.set(label, (grouped.get(label) || 0) + (valueKey ? Number(row[valueKey] || 0) : 1));
  });
  return [...grouped.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
};
const countBy = (rows, labelKey) => sumBy(rows, labelKey, null);

// Bucket rows into local calendar days, oldest first.
const byDate = (rows, dateKey, valueKey = null) => sumBy(rows, dateKey, valueKey, (row) => toLocalDateKey(row[dateKey]))
  .filter((row) => row.label !== "—" && row.label != null)
  .sort((a, b) => String(a.label).localeCompare(String(b.label)));

const sortAsc = (rows, key) => [...rows].sort((a, b) => String(a[key] ?? "").localeCompare(String(b[key] ?? ""), undefined, { numeric: true }));

const fillHours = (rows) => {
  const byHour = new Map(rows.map((row) => [String(row.hour).padStart(2, "0"), row]));
  return Array.from({ length: 24 }, (_, hour) => {
    const key = String(hour).padStart(2, "0");
    return byHour.get(key) || { hour: key };
  });
};

const withLabel = (rows, ...keys) => rows.map((row) => ({
  ...row,
  _label: keys.map((key) => row[key]).filter((value) => value != null && value !== "").join(" · ") || "—",
}));

/* --------------------------------- charts --------------------------------- */

function ChartPanel({ title, subtitle, children }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="px-4 pt-4">
        <h2 className="text-sm font-black tracking-tight text-slate-900 dark:text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">{subtitle}</p>}
      </div>
      <div className="px-2 pb-2">{children}</div>
    </div>
  );
}

function BarChart({ title, subtitle, rows, labelKey, labelType, series, currency, horizontal = false, stacked = false, limit = 12 }) {
  const { baseOptions } = useChartTheme();
  if (!BarChart.isVisible({ rows, series, limit })) return null;
  const chartRows = rows.slice(0, limit);
  const valueType = series[0]?.type;
  const height = horizontal ? Math.max(220, chartRows.length * 34 + 60) : 300;

  return (
    <ChartPanel title={title} subtitle={subtitle}>
      <ReactApexChart
        type="bar"
        height={height}
        series={series.map((item) => ({ name: item.name, data: chartRows.map((row) => Number(row[item.key] || 0)) }))}
        options={{
          ...baseOptions,
          chart: { ...baseOptions.chart, stacked },
          plotOptions: {
            bar: {
              horizontal,
              borderRadius: 5,
              borderRadiusApplication: "end",
              borderRadiusWhenStacked: "last",
              columnWidth: chartRows.length > 12 ? "70%" : "48%",
              barHeight: "62%",
            },
          },
          legend: { ...baseOptions.legend, show: series.length > 1, position: "top", horizontalAlign: "left" },
          xaxis: {
            categories: chartRows.map((row) => formatLabel(row[labelKey], labelType)),
            labels: horizontal
              ? { formatter: (value) => formatAxis(value, valueType, currency) }
              : { rotate: -35, trim: true, hideOverlappingLabels: true },
          },
          yaxis: {
            labels: horizontal
              ? { maxWidth: 160 }
              : { formatter: (value) => formatAxis(value, valueType, currency) },
          },
          tooltip: { ...baseOptions.tooltip, y: { formatter: (value, { seriesIndex }) => formatReportValue(value, series[seriesIndex]?.type, currency) } },
        }}
      />
    </ChartPanel>
  );
}
BarChart.isVisible = ({ rows = [], series = [], limit = 12 }) => hasUsableValues(rows.slice(0, limit), series.map((item) => item.key));

function LineChart({ title, subtitle, rows, labelKey, labelType, series, currency, area = false }) {
  const { baseOptions } = useChartTheme();
  if (!LineChart.isVisible({ rows, series })) return null;
  const valueType = series[0]?.type;
  // A single point draws nothing as a line, so fall back to columns.
  const type = rows.length < 2 ? "bar" : area ? "area" : "line";

  return (
    <ChartPanel title={title} subtitle={subtitle}>
      <ReactApexChart
        type={type}
        height={300}
        series={series.map((item) => ({ name: item.name, data: rows.map((row) => Number(row[item.key] || 0)) }))}
        options={{
          ...baseOptions,
          // ApexCharts crashes on an explicit `fill: undefined`, so only set it for areas.
          ...(type === "area" ? { fill: { type: "gradient", gradient: { shadeIntensity: 0.2, opacityFrom: 0.35, opacityTo: 0.02 } } } : {}),
          stroke: { curve: "smooth", width: type === "bar" ? 0 : 2.5 },
          markers: { size: rows.length <= 14 ? 3 : 0, strokeWidth: 0 },
          plotOptions: { bar: { borderRadius: 5, columnWidth: "30%" } },
          legend: { ...baseOptions.legend, show: series.length > 1, position: "top", horizontalAlign: "left" },
          xaxis: {
            categories: rows.map((row) => formatLabel(row[labelKey], labelType)),
            labels: { rotate: -35, hideOverlappingLabels: true },
            tickAmount: rows.length > 16 ? 12 : undefined,
          },
          yaxis: { labels: { formatter: (value) => formatAxis(value, valueType, currency) } },
          tooltip: { ...baseOptions.tooltip, y: { formatter: (value, { seriesIndex }) => formatReportValue(value, series[seriesIndex]?.type, currency) } },
        }}
      />
    </ChartPanel>
  );
}
LineChart.isVisible = ({ rows = [], series = [] }) => hasUsableValues(rows, series.map((item) => item.key));

function DonutChart({ title, subtitle, rows, labelKey = "label", labelType, valueKey = "value", valueType = "number", currency, limit = 8 }) {
  const { baseOptions, foreColor } = useChartTheme();
  if (!DonutChart.isVisible({ rows, valueKey })) return null;

  // Fold the long tail into "Other" so the legend stays readable.
  const positive = rows.filter((row) => Number(row[valueKey] || 0) > 0);
  const head = positive.slice(0, limit);
  const tailTotal = positive.slice(limit).reduce((sum, row) => sum + Number(row[valueKey] || 0), 0);
  const labels = head.map((row) => formatLabel(row[labelKey], labelType));
  const values = head.map((row) => Number(row[valueKey] || 0));
  if (tailTotal > 0) {
    labels.push("Other");
    values.push(tailTotal);
  }
  const total = values.reduce((sum, value) => sum + value, 0);

  return (
    <ChartPanel title={title} subtitle={subtitle}>
      <ReactApexChart
        type="donut"
        height={300}
        series={values}
        options={{
          ...baseOptions,
          labels,
          stroke: { width: 0 },
          legend: { ...baseOptions.legend, position: "bottom", labels: { colors: foreColor } },
          plotOptions: {
            pie: {
              donut: {
                size: "68%",
                labels: {
                  show: true,
                  value: { fontSize: "20px", fontWeight: 800, formatter: (value) => formatReportValue(value, valueType, currency) },
                  total: { show: true, label: "Total", color: foreColor, fontWeight: 600, formatter: () => formatReportValue(total, valueType, currency) },
                },
              },
            },
          },
          tooltip: {
            ...baseOptions.tooltip,
            y: { formatter: (value) => `${formatReportValue(value, valueType, currency)} (${total ? ((value / total) * 100).toFixed(1) : 0}%)` },
          },
        }}
      />
    </ChartPanel>
  );
}
DonutChart.isVisible = ({ rows = [], valueKey = "value" }) => rows.some((row) => Number(row[valueKey] || 0) > 0);

function HeatmapChart({ title, subtitle, rows, xKey, xType, yKey, valueKey, valueType = "number", currency }) {
  const { baseOptions } = useChartTheme();
  if (!HeatmapChart.isVisible({ rows, valueKey })) return null;

  const xValues = [...new Set(rows.map((row) => String(row[xKey] ?? "—")))].sort();
  const yValues = [...new Set(rows.map((row) => String(row[yKey] ?? "—")))];
  const series = yValues.map((yValue) => ({
    name: formatLabel(yValue),
    data: xValues.map((xValue) => ({
      x: formatLabel(xValue, xType),
      y: rows
        .filter((row) => String(row[xKey] ?? "—") === xValue && String(row[yKey] ?? "—") === yValue)
        .reduce((sum, row) => sum + Number(row[valueKey] || 0), 0),
    })),
  }));

  return (
    <ChartPanel title={title} subtitle={subtitle}>
      <ReactApexChart
        type="heatmap"
        height={Math.max(220, yValues.length * 40 + 80)}
        series={series}
        options={{
          ...baseOptions,
          colors: [PALETTE[0]],
          plotOptions: { heatmap: { radius: 4, shadeIntensity: 0.6, enableShades: true } },
          stroke: { width: 2, colors: ["transparent"] },
          xaxis: { labels: { rotate: -35, trim: true } },
          tooltip: { ...baseOptions.tooltip, y: { formatter: (value) => formatReportValue(value, valueType, currency) } },
        }}
      />
    </ChartPanel>
  );
}
HeatmapChart.isVisible = ({ rows = [], valueKey }) => hasUsableValues(rows, [valueKey]);

function TreemapChart({ title, subtitle, rows, labelKey = "label", valueKey = "value", valueType = "money", currency }) {
  const { baseOptions } = useChartTheme();
  if (!TreemapChart.isVisible({ rows, valueKey })) return null;

  return (
    <ChartPanel title={title} subtitle={subtitle}>
      <ReactApexChart
        type="treemap"
        height={320}
        series={[{
          data: rows
            .filter((row) => Number(row[valueKey] || 0) > 0)
            .slice(0, 24)
            .map((row) => ({ x: formatLabel(row[labelKey]), y: Number(row[valueKey] || 0) })),
        }]}
        options={{
          ...baseOptions,
          legend: { show: false },
          plotOptions: { treemap: { distributed: true, enableShades: false } },
          dataLabels: { enabled: true, style: { fontSize: "12px", fontWeight: 700 } },
          tooltip: { ...baseOptions.tooltip, y: { formatter: (value) => formatReportValue(value, valueType, currency) } },
        }}
      />
    </ChartPanel>
  );
}
TreemapChart.isVisible = ({ rows = [], valueKey = "value" }) => rows.some((row) => Number(row[valueKey] || 0) > 0);

function RadarChart({ title, subtitle, metrics }) {
  const { baseOptions, foreColor } = useChartTheme();
  if (!RadarChart.isVisible({ metrics })) return null;
  const chartMetrics = metrics.filter((metric) => Number(metric.value) > 0);
  // Ratings are 1–5 today; widen the scale automatically if a 0–10 score appears.
  const max = Math.max(...chartMetrics.map((metric) => Number(metric.value))) > 5 ? 10 : 5;

  return (
    <ChartPanel title={title} subtitle={subtitle}>
      <ReactApexChart
        type="radar"
        height={320}
        series={[{ name: "Average", data: chartMetrics.map((metric) => Number(Number(metric.value).toFixed(2))) }]}
        options={{
          ...baseOptions,
          labels: chartMetrics.map((metric) => metric.label),
          yaxis: { min: 0, max, tickAmount: 5, labels: { formatter: (value) => Number(value).toFixed(0) } },
          xaxis: { labels: { style: { colors: chartMetrics.map(() => foreColor), fontWeight: 600 } } },
          markers: { size: 4 },
          fill: { opacity: 0.2 },
          stroke: { width: 2 },
        }}
      />
    </ChartPanel>
  );
}
RadarChart.isVisible = ({ metrics = [] }) => metrics.some((metric) => Number(metric.value) > 0);

function ChartGrid({ children }) {
  const visibleChildren = React.Children.toArray(children).filter((child) => (
    React.isValidElement(child) && (child.type.isVisible ? child.type.isVisible(child.props) : true)
  ));
  if (visibleChildren.length === 0) return null;

  // Charts flow two per row; a `wide` chart takes a full row, and a chart that
  // would otherwise sit alone in a row stretches to fill it.
  let column = 0;
  const spans = visibleChildren.map((child, index) => {
    const next = visibleChildren[index + 1];
    const full = child.props.wide || (column === 0 && (!next || next.props.wide));
    column = full ? 0 : (column + 1) % 2;
    return full;
  });

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {visibleChildren.map((child, index) => (
        <div key={child.key ?? index} className={clsx("min-w-0", spans[index] && "xl:col-span-2")}>
          {child}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ per-report charts ------------------------------ */

const averageOf = (rows, key) => (rows.length ? rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length : 0);

const ratingMetrics = (rows, columns, keys) => keys
  .filter((key) => columns.some((column) => column.key === key))
  .map((key) => ({ label: columns.find((column) => column.key === key)?.label || key, value: averageOf(rows, key) }));

const VALUE = (label, type) => [{ key: "value", name: label, type }];

const timeTrendCharts = (rows, columns, labelKey, labelType, trendKeys, volumeKeys, currency, titles = {}) => {
  const sorted = sortAsc(rows, labelKey);
  return [
    <LineChart key="trend" title={titles.trend || "Trend"} rows={sorted} labelKey={labelKey} labelType={labelType} series={seriesFrom(columns, ...trendKeys)} currency={currency} area />,
    <BarChart key="volume" title={titles.volume || "Volume"} rows={sorted} labelKey={labelKey} labelType={labelType} series={seriesFrom(columns, ...volumeKeys)} currency={currency} stacked={volumeKeys.length > 1} limit={62} />,
  ];
};

const CHARTS = {
  /* Sales */
  "sales-summary": ({ data, currency }) => {
    const items = getTable(data, 0);
    const payments = getTable(data, 1);
    return [
      <BarChart key="items" title="Top Selling Items" subtitle="By gross sales" rows={items.rows} labelKey="title" series={seriesFrom(items.columns, "gross_sales")} currency={currency} horizontal limit={10} />,
      <DonutChart key="payments" title="Payment Mix" rows={payments.rows} labelKey="payment_type" valueKey="total" valueType="money" currency={currency} />,
    ];
  },
  "gross-sales": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    return [
      <BarChart key="items" title="Top Items" subtitle="By gross sales" rows={rows} labelKey="item" series={seriesFrom(columns, "gross_sales")} currency={currency} horizontal limit={10} />,
      <DonutChart key="categories" title="Sales by Category" rows={sumBy(rows, "category", "gross_sales")} valueType="money" currency={currency} />,
    ];
  },
  "net-sales": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    return timeTrendCharts(rows, columns, "date", "date", ["total_sales", "net_sales"], ["tax_total", "service_charge_total", "discount_total"], currency, {
      trend: "Sales Trend",
      volume: "Taxes, Service & Discounts",
    });
  },
  "sales-by-hour": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    const hours = fillHours(rows);
    return [
      <BarChart key="revenue" wide title="Revenue by Hour" subtitle="Spot your peak trading hours" rows={hours} labelKey="hour" labelType="hour" series={seriesFrom(columns, "revenue")} currency={currency} limit={24} />,
      <BarChart key="invoices" title="Invoices by Hour" rows={hours} labelKey="hour" labelType="hour" series={seriesFrom(columns, "invoices")} currency={currency} limit={24} />,
      <LineChart key="aov" title="Average Order Value by Hour" rows={hours} labelKey="hour" labelType="hour" series={seriesFrom(columns, "average_order_value")} currency={currency} />,
    ];
  },
  "sales-by-day": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    return timeTrendCharts(rows, columns, "date", "date", ["revenue", "net_sales"], ["invoices"], currency, { trend: "Daily Revenue", volume: "Invoices per Day" });
  },
  "sales-by-month": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    return timeTrendCharts(rows, columns, "month", "month", ["revenue", "net_sales"], ["invoices"], currency, { trend: "Monthly Revenue", volume: "Invoices per Month" });
  },
  "sales-by-order-type": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    return [
      <DonutChart key="mix" title="Revenue by Order Type" rows={rows} labelKey="order_type" valueKey="revenue" valueType="money" currency={currency} />,
      <BarChart key="aov" title="Average Order Value" rows={rows} labelKey="order_type" series={seriesFrom(columns, "average_order_value")} currency={currency} />,
    ];
  },
  "sales-by-table": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    return [
      <BarChart key="revenue" title="Top Tables by Revenue" rows={rows} labelKey="table_title" series={seriesFrom(columns, "revenue")} currency={currency} horizontal limit={10} />,
      <DonutChart key="floors" title="Revenue by Floor" rows={sumBy(rows, "floor", "revenue")} valueType="money" currency={currency} />,
    ];
  },
  "invoice-detail": ({ data, currency }) => {
    const { rows } = getTable(data);
    return [
      <LineChart key="daily" title="Revenue by Day" rows={byDate(rows, "created_at", "total")} labelKey="label" labelType="date" series={VALUE("Revenue", "money")} currency={currency} area />,
      <DonutChart key="payments" title="By Payment Type" rows={sumBy(rows, "payment_type", "total")} valueType="money" currency={currency} />,
      <DonutChart key="types" title="By Order Type" rows={sumBy(rows, "order_type", "total")} valueType="money" currency={currency} />,
    ];
  },
  "voids-cancellations": ({ data, currency }) => {
    const cancelled = getTable(data, 0);
    const voided = getTable(data, 1);
    return [
      <BarChart key="items" title="Most Cancelled Items" subtitle="By lost sales" rows={sumBy(cancelled.rows, "item", "lost_sales")} labelKey="label" series={VALUE("Lost Sales", "money")} currency={currency} horizontal limit={10} />,
      <DonutChart key="voided-by" title="Voids by Staff" rows={sumBy(voided.rows, "voided_by", "total")} valueType="money" currency={currency} />,
    ];
  },
  "average-order-value": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    return timeTrendCharts(rows, columns, "date", "date", ["average_order_value"], ["invoices"], currency, { trend: "Average Order Value", volume: "Invoices per Day" });
  },

  /* Payments */
  "payment-summary": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    return [
      <DonutChart key="mix" title="Payment Mix" rows={rows} labelKey="payment_type" valueKey="total" valueType="money" currency={currency} />,
      <BarChart key="count" title="Transactions by Method" rows={rows} labelKey="payment_type" series={seriesFrom(columns, "invoice_count")} currency={currency} horizontal />,
    ];
  },
  "cash-report": ({ data, currency }) => paymentProgressCharts(data, currency),
  "card-report": ({ data, currency }) => paymentProgressCharts(data, currency),
  "unpaid-orders": ({ data, currency }) => {
    const { rows } = getTable(data);
    return [
      <DonutChart key="types" title="Outstanding by Order Type" rows={sumBy(rows, "order_type", "estimated_total")} valueType="money" currency={currency} />,
      <BarChart key="tables" title="Outstanding by Table" rows={sumBy(rows, "table_title", "estimated_total")} labelKey="label" series={VALUE("Outstanding", "money")} currency={currency} horizontal limit={10} />,
    ];
  },

  /* Menu */
  "top-selling-items": ({ data, currency }) => itemSalesCharts(data, currency, "Best Sellers"),
  "low-selling-items": ({ data, currency }) => itemSalesCharts(data, currency, "Slowest Movers", false),
  "item-sales": ({ data, currency }) => itemSalesCharts(data, currency, "Top Items"),
  "category-sales": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    return [
      <DonutChart key="mix" title="Sales Mix by Category" rows={rows} labelKey="category" valueKey="gross_sales" valueType="money" currency={currency} />,
      <BarChart key="qty" title="Quantity Sold by Category" rows={rows} labelKey="category" series={seriesFrom(columns, "quantity_sold")} currency={currency} horizontal />,
    ];
  },
  "variant-sales": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    return [
      <BarChart key="sales" wide title="Top Variants" subtitle="By gross sales" rows={withLabel(rows, "item", "variant")} labelKey="_label" series={seriesFrom(columns, "gross_sales")} currency={currency} horizontal limit={12} />,
    ];
  },
  "addon-sales": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    const sorted = [...rows].sort((a, b) => Number(b.addon_sales || 0) - Number(a.addon_sales || 0));
    return [
      <BarChart key="sales" title="Top Add-ons" subtitle="By add-on revenue" rows={withLabel(sorted, "addon", "item")} labelKey="_label" series={seriesFrom(columns, "addon_sales")} currency={currency} horizontal limit={10} />,
      <DonutChart key="attach" title="Add-on Revenue Mix" rows={sumBy(rows, "addon", "addon_sales")} valueType="money" currency={currency} />,
    ];
  },
  "menu-price-audit": ({ data }) => {
    const { rows } = getTable(data);
    return [
      <DonutChart key="categories" title="Menu Lines by Category" rows={countBy(rows, "category")} />,
      <DonutChart key="types" title="Menu Lines by Type" rows={countBy(rows, "type")} />,
    ];
  },

  /* Customers */
  "customer-summary": ({ data, currency }) => customerCharts(data, currency),
  "returning-customers": ({ data, currency }) => customerCharts(data, currency),
  "top-customers": ({ data, currency }) => customerCharts(data, currency),
  "member-customers": ({ data, currency }) => customerCharts(data, currency),
  "new-customers": ({ data }) => {
    const { rows } = getTable(data);
    return [
      <BarChart key="signups" title="New Customers by Day" rows={byDate(rows, "created_at")} labelKey="label" labelType="date" series={VALUE("Customers", "number")} limit={62} />,
      <DonutChart key="membership" title="Membership" rows={countBy(rows, "membership")} />,
    ];
  },
  "customer-birthdays": ({ data }) => {
    const { rows } = getTable(data);
    return [<DonutChart key="membership" title="Birthdays by Membership" rows={countBy(rows, "membership")} />];
  },

  /* Operations */
  "order-status": ({ data }) => {
    const { rows } = getTable(data);
    return [
      <DonutChart key="status" title="Orders by Status" rows={sumBy(rows, "status", "orders")} />,
      <HeatmapChart key="matrix" title="Status × Payment" rows={rows} xKey="status" yKey="payment_status" valueKey="orders" />,
    ];
  },
  "kitchen-performance": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    return [
      <DonutChart key="qty" title="Item Quantity by Status" rows={rows} labelKey="status" valueKey="quantity" />,
      <BarChart key="value" title="Sales Value by Status" rows={rows} labelKey="status" series={seriesFrom(columns, "sales_value")} currency={currency} />,
    ];
  },
  "token-report": ({ data, currency }) => {
    const { rows } = getTable(data);
    return [
      <DonutChart key="types" title="Tokens by Order Type" rows={countBy(rows, "order_type")} />,
      <DonutChart key="payment" title="Value by Payment Status" rows={sumBy(rows, "payment_status", "total")} valueType="money" currency={currency} />,
    ];
  },
  "qr-order-report": ({ data, currency }) => {
    const { rows } = getTable(data);
    return [
      <BarChart key="daily" title="QR Orders by Day" rows={byDate(rows, "date")} labelKey="label" labelType="date" series={VALUE("Orders", "number")} limit={62} />,
      <DonutChart key="tables" title="Value by Table" rows={sumBy(rows, "table_title", "estimated_total")} valueType="money" currency={currency} />,
    ];
  },
  "table-turnover": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    const sorted = [...rows].sort((a, b) => Number(b.orders || 0) - Number(a.orders || 0));
    return [
      <BarChart key="orders" title="Busiest Tables" subtitle="By number of orders" rows={sorted} labelKey="table_title" series={seriesFrom(columns, "orders")} currency={currency} horizontal limit={10} />,
      <TreemapChart key="revenue" title="Revenue by Table" rows={rows} labelKey="table_title" valueKey="revenue" currency={currency} />,
    ];
  },
  "staff-created-orders": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    return [
      <BarChart key="revenue" title="Revenue by Staff" rows={rows} labelKey="staff_name" series={seriesFrom(columns, "revenue")} currency={currency} horizontal limit={10} />,
      <BarChart key="outcome" title="Order Outcomes by Staff" rows={rows} labelKey="staff_name" series={seriesFrom(columns, "completed_orders", "cancelled_orders")} currency={currency} horizontal stacked limit={10} />,
    ];
  },

  /* Inventory — units differ per item, so charts compare counts or per-item values only. */
  "inventory-summary": ({ data }) => {
    const { rows } = getTable(data);
    return [<DonutChart key="status" title="Stock Health" rows={countBy(rows, "status")} />];
  },
  "low-stock": ({ data }) => reorderCharts(data),
  "stock-reorder": ({ data }) => reorderCharts(data),
  "stock-movements": ({ data }) => {
    const { rows } = getTable(data);
    const daily = rows.map((row) => ({ ...row, day: toLocalDateKey(row.created_at), moves: 1 }));
    return [
      <DonutChart key="types" title="Movements by Type" rows={countBy(rows, "movement_type")} />,
      <HeatmapChart key="matrix" title="Movement Activity" subtitle="Number of movements per day" rows={daily} xKey="day" xType="date" yKey="movement_type" valueKey="moves" />,
    ];
  },
  "wastage": ({ data }) => {
    const { rows, columns } = getTable(data);
    return [
      <BarChart key="waste" title="Most Wasted Items" rows={withLabel(rows, "item", "unit")} labelKey="_label" series={seriesFrom(columns, "wasted_quantity")} horizontal limit={10} />,
      <BarChart key="events" title="Wastage Events" rows={rows} labelKey="item" series={seriesFrom(columns, "movement_count")} horizontal limit={10} />,
    ];
  },
  "recipe-usage": ({ data }) => {
    const { rows } = getTable(data);
    const usage = sumBy(rows, "inventory_item", "estimated_usage", (row) => [row.inventory_item, row.unit].filter(Boolean).join(" · "));
    return [<BarChart key="usage" wide title="Estimated Ingredient Usage" rows={usage} labelKey="label" series={VALUE("Estimated Usage", "quantity")} horizontal limit={12} />];
  },

  /* Accounting */
  "tax-summary": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    return timeTrendCharts(rows, columns, "date", "date", ["tax_total"], ["taxable_sales"], currency, { trend: "Tax Collected", volume: "Taxable Sales" });
  },
  "tax-by-item": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    const sorted = [...rows].sort((a, b) => Number(b.estimated_tax || 0) - Number(a.estimated_tax || 0));
    return [
      <BarChart key="items" title="Tax by Item" rows={sorted} labelKey="item" series={seriesFrom(columns, "estimated_tax")} currency={currency} horizontal limit={10} />,
      <DonutChart key="rates" title="Tax by Rate" rows={sumBy(rows, "tax", "estimated_tax")} valueType="money" currency={currency} />,
    ];
  },
  "service-charge": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    return timeTrendCharts(rows, columns, "date", "date", ["service_charge_total"], ["invoices"], currency, { trend: "Service Charge Collected", volume: "Invoices per Day" });
  },
  "discount-summary": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    const ledger = getTable(data, 1);
    const sorted = sortAsc(rows, "date");
    const mix = [
      { label: "Fixed", value: rows.reduce((sum, row) => sum + Number(row.fixed_discount_total || 0), 0) },
      { label: "Percentage", value: rows.reduce((sum, row) => sum + Number(row.percentage_discount_total || 0), 0) },
    ];
    return [
      <LineChart key="trend" title="Discounts Given" rows={sorted} labelKey="date" labelType="date" series={seriesFrom(columns, "discount_total")} currency={currency} area />,
      <DonutChart key="mix" title="Discount Type Mix" rows={mix.some((row) => row.value > 0) ? mix : sumBy(ledger.rows, "discount_type", "discount_total")} valueType="money" currency={currency} />,
      <BarChart key="count" wide title="Discounted vs Total Invoices" rows={sorted} labelKey="date" labelType="date" series={seriesFrom(columns, "invoices", "discounted_invoices")} currency={currency} limit={62} />,
    ];
  },
  "daily-close": ({ data, currency }) => {
    const { rows, columns } = getTable(data);
    const sorted = sortAsc(rows, "date");
    return [
      <LineChart key="trend" title="Revenue" rows={sorted} labelKey="date" labelType="date" series={seriesFrom(columns, "revenue", "net_sales")} currency={currency} area />,
      <BarChart key="adjust" title="Taxes, Service & Discounts" rows={sorted} labelKey="date" labelType="date" series={seriesFrom(columns, "tax_total", "service_charge_total", "discount_total")} currency={currency} stacked limit={62} />,
      <BarChart key="exceptions" wide title="Unpaid & Cancelled Orders" rows={sorted} labelKey="date" labelType="date" series={seriesFrom(columns, "unpaid_orders", "cancelled_orders")} currency={currency} stacked limit={62} />,
    ];
  },
  "invoice-register": ({ data, currency }) => {
    const { rows } = getTable(data);
    return [
      <LineChart key="daily" title="Invoiced by Day" rows={byDate(rows, "created_at", "total")} labelKey="label" labelType="date" series={VALUE("Total", "money")} currency={currency} area />,
      <DonutChart key="payments" title="By Payment Type" rows={sumBy(rows, "payment_type", "total")} valueType="money" currency={currency} />,
    ];
  },

  /* Reservations */
  "reservation-summary": ({ data }) => {
    const { rows } = getTable(data);
    return [
      <DonutChart key="status" title="Reservations by Status" rows={sumBy(rows, "status", "reservations")} />,
      <BarChart key="guests" title="Guests by Table" rows={sumBy(rows, "table_title", "guests")} labelKey="label" series={VALUE("Guests", "number")} horizontal limit={10} />,
      <HeatmapChart key="matrix" title="Table × Status" rows={rows} xKey="status" yKey="table_title" valueKey="reservations" />,
    ];
  },
  "upcoming-reservations": ({ data }) => reservationListCharts(data),
  "reservation-no-show": ({ data }) => reservationListCharts(data),

  /* Feedback */
  "feedback-summary": ({ data }) => {
    const { rows, columns } = getTable(data);
    const sorted = sortAsc(rows, "date");
    return [
      <LineChart key="scores" title="Rating Trend" rows={sorted} labelKey="date" labelType="date" series={seriesFrom(columns, "average_rating", "food_quality_rating", "service_rating")} />,
      <RadarChart key="radar" title="Rating Dimensions" metrics={ratingMetrics(rows, columns, ["food_quality_rating", "service_rating", "staff_behavior_rating", "ambiance_rating", "recommend_rating"])} />,
      <BarChart key="count" wide title="Feedback Received" rows={sorted} labelKey="date" labelType="date" series={seriesFrom(columns, "feedback_count")} limit={62} />,
    ];
  },
  "negative-feedback": ({ data }) => {
    const { rows, columns } = getTable(data);
    return [
      <BarChart key="daily" title="Negative Feedback by Day" rows={byDate(rows, "date")} labelKey="label" labelType="date" series={VALUE("Feedback", "number")} limit={62} />,
      <RadarChart key="radar" title="Where Scores Drop" metrics={ratingMetrics(rows, columns, ["food_quality_rating", "service_rating", "recommend_rating"])} />,
    ];
  },
  "recommendation-score": ({ data }) => {
    const { rows, columns } = getTable(data);
    return [
      <DonutChart key="mix" title="Recommendation Mix" rows={rows} labelKey="recommendation_group" valueKey="feedback_count" />,
      <BarChart key="rating" title="Average Rating by Group" rows={rows} labelKey="recommendation_group" series={seriesFrom(columns, "average_rating")} />,
    ];
  },
};

function paymentProgressCharts(data, currency) {
  const { rows } = getTable(data);
  return [
    <LineChart key="amount" title="Amount by Day" rows={byDate(rows, "created_at", "total")} labelKey="label" labelType="date" series={VALUE("Amount", "money")} currency={currency} area />,
    <BarChart key="count" title="Transactions by Day" rows={byDate(rows, "created_at")} labelKey="label" labelType="date" series={VALUE("Transactions", "number")} currency={currency} limit={62} />,
  ];
}

function itemSalesCharts(data, currency, title, sortDesc = true) {
  const { rows, columns } = getTable(data);
  const ordered = sortDesc ? [...rows].sort((a, b) => Number(b.gross_sales || 0) - Number(a.gross_sales || 0)) : rows;
  return [
    <BarChart key="items" title={title} subtitle="By gross sales" rows={ordered} labelKey="item" series={seriesFrom(columns, "gross_sales")} currency={currency} horizontal limit={10} />,
    <DonutChart key="categories" title="Sales by Category" rows={sumBy(rows, "category", "gross_sales")} valueType="money" currency={currency} />,
  ];
}

function customerCharts(data, currency) {
  const { rows, columns } = getTable(data);
  const byRevenue = [...rows].sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0));
  const byOrders = [...rows].sort((a, b) => Number(b.orders || 0) - Number(a.orders || 0));
  return [
    <BarChart key="revenue" title="Top Customers by Spend" rows={byRevenue} labelKey="name" series={seriesFrom(columns, "revenue")} currency={currency} horizontal limit={10} />,
    <BarChart key="orders" title="Most Frequent Customers" rows={byOrders} labelKey="name" series={seriesFrom(columns, "orders")} currency={currency} horizontal limit={10} />,
  ];
}

function reorderCharts(data) {
  const { rows, columns } = getTable(data);
  return [
    <BarChart
      key="reorder"
      wide
      title="Stock on Hand vs Minimum"
      rows={withLabel(rows, "title", "unit")}
      labelKey="_label"
      series={seriesFrom(columns, "quantity", "min_quantity_threshold")}
      horizontal
      limit={12}
    />,
  ];
}

function reservationListCharts(data) {
  const { rows } = getTable(data);
  return [
    <BarChart key="guests" title="Guests by Day" rows={byDate(rows, "date", "people_count")} labelKey="label" labelType="date" series={VALUE("Guests", "number")} limit={62} />,
    <DonutChart key="status" title="By Status" rows={countBy(rows, "status")} />,
  ];
}

// Fallback for reports without a dedicated layout: chart the first numeric column.
function genericCharts({ data, currency }) {
  const { rows, columns } = getTable(data);
  const labelColumn = columns.find((column) => !NUMERIC_TYPES.includes(column.type));
  const valueColumn = columns.find((column) => NUMERIC_TYPES.includes(column.type));
  if (!labelColumn || !valueColumn) return [];
  return [
    <BarChart key="generic" wide title={`${data.title || "Report"} Snapshot`} rows={rows} labelKey={labelColumn.key} labelType={labelColumn.type} series={seriesFrom(columns, valueColumn.key)} currency={currency} />,
  ];
}

/* --------------------------------- layout --------------------------------- */

function ReportLayout({ report, data, currency, components }) {
  const { SummaryGrid, DataTable } = components;
  const buildCharts = CHARTS[report?.id || data?.reportId] || genericCharts;

  return (
    <div className="mt-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <SummaryGrid summary={data.summary} currency={currency} />
      <ChartGrid>{buildCharts({ data, currency })}</ChartGrid>
      {(data.tables || []).map((table) => (
        <DataTable key={table.title} table={table} currency={currency} />
      ))}
    </div>
  );
}

export function getReportPageComponent() {
  return ReportLayout;
}

export { ReportLayout as GenericReportPage };
