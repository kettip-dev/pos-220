import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import Page from "../components/Page";
import { SelectBusinessEmptyState } from "../components/RequiresSingleBusiness";
import { isBusinessRequiredError } from "../helpers/BusinessScope";
import {
  IconArrowLeft,
  IconChevronRight,
  IconChevronDown,
  IconChevronUp,
  IconDownload,
  IconFileSpreadsheet,
  IconLoader2,
  IconSearch,
  IconFilter,
  IconStar,
  IconStarFilled,
  IconDotsVertical,
  IconHelpCircle,
  IconBrandTelegram,
} from "@tabler/icons-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { iconStroke } from "../config/config";
import { CURRENCIES } from "../config/currencies.config";
import { REPORT_CATALOG, REPORT_CATEGORIES } from "../config/reportCatalog";
import { useReport } from "../controllers/reports.controller";
import {
  exportReportToExcel,
  exportReportToPdf,
  formatReportValue,
} from "../utils/reportExports.jsx";
import { getReportPageComponent } from "./reports/reportPageRegistry.jsx";
import { sendManualEodReport } from "../controllers/telegram.controller";

const DATE_FILTERS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last_7days", label: "Last 7 Days" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "custom", label: "Custom Range" },
];

const READY_REPORTS = new Set([
  "sales-summary", "gross-sales", "net-sales", "sales-by-hour", "sales-by-day",
  "sales-by-month", "sales-by-order-type", "sales-by-table", "invoice-detail",
  "voids-cancellations", "average-order-value", "payment-summary", "cash-report",
  "card-report", "unpaid-orders", "payment-type-mix", "top-selling-items",
  "low-selling-items", "item-sales", "category-sales", "variant-sales",
  "addon-sales", "menu-price-audit", "customer-summary", "new-customers",
  "returning-customers", "top-customers", "customer-birthdays", "member-customers",
  "order-status", "kitchen-performance", "token-report", "qr-order-report",
  "table-turnover", "staff-created-orders", "inventory-summary", "low-stock",
  "stock-movements", "wastage", "recipe-usage", "stock-reorder", "tax-summary",
  "tax-by-item", "service-charge", "discount-summary", "daily-close", "invoice-register",
  "reservation-summary", "upcoming-reservations", "reservation-no-show",
  "feedback-summary", "negative-feedback", "recommendation-score",
]);

const categoryAccentClasses = [
  "text-restro-green bg-restro-green-10",
  "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
  "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
  "text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/30",
  "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30",
  "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
  "text-rose-600 bg-rose-50 dark:bg-rose-950/30",
  "text-violet-600 bg-violet-50 dark:bg-violet-950/30",
  "text-teal-600 bg-teal-50 dark:bg-teal-950/30",
];

const getDefaultDate = (offsetDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function getCurrencySymbol(currencyCode) {
  return CURRENCIES.find((currency) => currency.cc === currencyCode)?.symbol || "";
}

function ReportStatus({ status }) {
  const isReady = status === "ready";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${isReady ? "bg-restro-green-10 text-restro-green" : "bg-restro-bg-gray text-restro-text"}`}>
      {isReady ? "Ready" : "Planned"}
    </span>
  );
}

function ReportCard({ report, onOpen }) {
  const Icon = report.icon;

  return (
    <button
      type="button"
      onClick={() => onOpen(report)}
      className="group relative flex h-full flex-col items-start rounded-xl border border-restro-border-green bg-background p-5 text-left transition-all hover:-translate-y-1 hover:border-restro-green hover:shadow-md"
    >
      <div className="flex w-full items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-restro-bg-gray text-restro-text transition-colors group-hover:bg-restro-green-10 group-hover:text-restro-green">
          <Icon size={20} stroke={iconStroke} />
        </span>
        <ReportStatus status={report.status} />
      </div>

      <div className="mt-4 flex-1">
        <h3 className="font-bold text-foreground group-hover:text-restro-green">{report.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-restro-text">{report.description}</p>
      </div>

      <div className="mt-4 flex w-full items-center justify-end">
        <span className="flex items-center gap-1 text-xs font-bold text-restro-text opacity-0 transition-all group-hover:text-restro-green group-hover:opacity-100">
          Open Report <IconChevronRight size={14} stroke={iconStroke} />
        </span>
      </div>
    </button>
  );
}

const FAV_REPORTS_STORAGE_KEY = "restro_qbo_fav_reports_v1";
const DEFAULT_FAV_REPORTS = [
  "sales-summary",
  "gross-sales",
  "net-sales",
  "daily-close",
];

function QBOReportRow({ report, isFav, onToggleFav, onOpen }) {
  const { t } = useTranslation();
  const title = t(`reports.catalog.${report.id}.title`, report.title);
  const description = t(`reports.catalog.${report.id}.description`, report.description);

  return (
    <div
      onClick={() => onOpen(report)}
      className="group flex items-center justify-between border-b border-gray-200/80 dark:border-slate-800 py-1.5 px-2 hover:bg-[#F4F5F8] dark:hover:bg-slate-800/60 transition-colors cursor-pointer rounded-xs"
    >
      <div className="flex items-center gap-1.5 min-w-0 pr-2">
        <span className="text-[13px] font-medium text-gray-700 dark:text-slate-200 group-hover:text-gray-900 dark:group-hover:text-white truncate">
          {title}
        </span>
        {description && (
          <span
            title={description}
            onClick={(e) => e.stopPropagation()}
            className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <IconHelpCircle size={14} stroke={1.8} />
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFav(report.id);
          }}
          title={isFav ? t("reports.remove_from_favourites", "Remove from Favourites") : t("reports.add_to_favourites", "Add to Favourites")}
          className="p-1 rounded hover:bg-gray-200/70 dark:hover:bg-slate-700 transition cursor-pointer"
        >
          {isFav ? (
            <IconStarFilled size={15} className="text-[#008489] dark:text-emerald-400" />
          ) : (
            <IconStar size={15} stroke={1.8} className="text-gray-400 dark:text-slate-500 hover:text-[#008489]" />
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(report);
          }}
          title={t("reports.open_report", "Open Report")}
          className="p-1 rounded text-gray-400 hover:text-gray-800 dark:text-slate-500 dark:hover:text-white hover:bg-gray-200/70 dark:hover:bg-slate-700 transition cursor-pointer"
        >
          <IconDotsVertical size={14} stroke={2} />
        </button>
      </div>
    </div>
  );
}

function ReportsIndex() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const category = searchParams.get("category") || "All";
  const normalizedQuery = query.trim().toLowerCase();

  const getCategoryLabel = (cat) => {
    if (cat === "Favourites") return t("reports.favourites", "Favourites");
    if (cat === "Sales") return t("reports.categories.business_overview_and_sales", "Business overview & Sales");
    return t(`reports.categories.${cat.toLowerCase()}`, cat);
  };

  const [favReportIds, setFavReportIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAV_REPORTS_STORAGE_KEY));
      if (Array.isArray(saved)) return saved;
    } catch {}
    return DEFAULT_FAV_REPORTS;
  });

  const [collapsedSections, setCollapsedSections] = useState({});

  const toggleSection = (key) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleFavReport = (reportId) => {
    setFavReportIds((prev) => {
      const next = prev.includes(reportId)
        ? prev.filter((id) => id !== reportId)
        : [...prev, reportId];
      try {
        localStorage.setItem(FAV_REPORTS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const setCategoryFilter = (cat) => {
    if (!cat || cat === "All") {
      setSearchParams({});
    } else {
      setSearchParams({ category: cat });
    }
  };

  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const handleSendTelegramEod = async () => {
    try {
      setIsSendingTelegram(true);
      const res = await sendManualEodReport({});
      toast.success(res?.message || "EOD Summary sent to Telegram!");
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to send EOD report");
    } finally {
      setIsSendingTelegram(false);
    }
  };

  const favouriteReports = useMemo(() => {
    return REPORT_CATALOG.filter((report) => {
      if (!favReportIds.includes(report.id)) return false;
      if (!normalizedQuery) return true;
      const translatedTitle = t(`reports.catalog.${report.id}.title`, report.title);
      const translatedDesc = t(`reports.catalog.${report.id}.description`, report.description);
      const searchable = [
        report.title,
        translatedTitle,
        report.category,
        getCategoryLabel(report.category),
        report.description,
        translatedDesc,
        ...(report.keywords || []),
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [favReportIds, normalizedQuery, t]);

  const groupedReports = useMemo(() => {
    if (category === "Favourites") return [];
    return REPORT_CATEGORIES.map((categoryName) => {
      const reports = REPORT_CATALOG.filter((report) => {
        if (report.category !== categoryName) return false;
        if (category !== "All" && report.category !== category) return false;
        if (!normalizedQuery) return true;

        const translatedTitle = t(`reports.catalog.${report.id}.title`, report.title);
        const translatedDesc = t(`reports.catalog.${report.id}.description`, report.description);
        const searchable = [
          report.title,
          translatedTitle,
          report.category,
          getCategoryLabel(report.category),
          report.description,
          translatedDesc,
          report.priority,
          ...(report.keywords || []),
        ]
          .join(" ")
          .toLowerCase();

        return searchable.includes(normalizedQuery);
      });

      return { category: categoryName, reports };
    }).filter((group) => group.reports.length > 0);
  }, [category, normalizedQuery, t]);

  return (
    <Page className="min-h-[calc(100vh-56px)] bg-white dark:bg-[#08101D] px-4 sm:px-6 py-4">
      <div className="mx-auto max-w-5xl">
        {/* Top QBO Search & Filter Bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1 flex items-center rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-[#008489] focus-within:ring-1 focus-within:ring-[#008489] transition">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-9 w-full bg-transparent px-3 text-xs sm:text-sm text-gray-800 dark:text-slate-100 placeholder-gray-400 outline-none"
                placeholder={t("reports.search_placeholder", "Type report name here")}
              />
              <span className="h-9 px-2.5 border-l border-gray-200 dark:border-slate-800 flex items-center justify-center text-gray-500">
                <IconChevronDown size={15} />
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendTelegramEod}
              disabled={isSendingTelegram}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#229ED9]/40 bg-[#229ED9]/10 hover:bg-[#229ED9]/20 text-[#229ED9] text-xs font-bold transition active:scale-95 disabled:opacity-50"
              title="Send End-of-Day Summary to Telegram"
            >
              <IconBrandTelegram size={16} stroke={iconStroke} />
              <span>{isSendingTelegram ? t("reports.sending", "Sending...") : t("reports.send_eod_telegram", "Send EOD to Telegram")}</span>
            </button>
          </div>

          {category !== "All" && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                {t("reports.filtered_by", "Filtered by:")}{" "}
                <strong className="text-gray-900 dark:text-white">{getCategoryLabel(category)}</strong>
              </span>
              <button
                type="button"
                onClick={() => setCategoryFilter("All")}
                className="text-xs font-semibold text-[#0077C5] hover:underline cursor-pointer"
              >
                {t("reports.show_all_reports", "Show all reports")}
              </button>
            </div>
          )}
        </div>

        {/* Collapsible QBO Report Cards */}
        <div className="space-y-3">
          {/* 1. Favourites Card */}
          {(category === "All" || category === "Favourites") &&
            favouriteReports.length > 0 && (
              <section className="rounded-xl border border-gray-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-3.5 sm:p-4 shadow-2xs">
                <button
                  type="button"
                  onClick={() => toggleSection("Favourites")}
                  className="flex items-center gap-2 text-left cursor-pointer focus:outline-none"
                >
                  {collapsedSections["Favourites"] ? (
                    <IconChevronRight size={17} stroke={2} className="text-gray-700 dark:text-slate-300" />
                  ) : (
                    <IconChevronDown size={17} stroke={2} className="text-gray-700 dark:text-slate-300" />
                  )}
                  <h2 className="text-[15px] font-bold text-gray-800 dark:text-white">
                    {getCategoryLabel("Favourites")}
                  </h2>
                </button>

                {!collapsedSections["Favourites"] && (
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5">
                    {favouriteReports.map((report) => (
                      <QBOReportRow
                        key={report.id}
                        report={report}
                        isFav={true}
                        onToggleFav={toggleFavReport}
                        onOpen={(r) => navigate(`/dashboard/reports/${r.id}`)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

          {/* 2. Category Report Sections */}
          {groupedReports.map((group) => {
            const isCollapsed = !!collapsedSections[group.category];
            return (
              <section
                key={group.category}
                className="rounded-xl border border-gray-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-3.5 sm:p-4 shadow-2xs"
              >
                <button
                  type="button"
                  onClick={() => toggleSection(group.category)}
                  className="flex items-center gap-2 text-left cursor-pointer focus:outline-none"
                >
                  {isCollapsed ? (
                    <IconChevronRight size={17} stroke={2} className="text-gray-700 dark:text-slate-300" />
                  ) : (
                    <IconChevronDown size={17} stroke={2} className="text-gray-700 dark:text-slate-300" />
                  )}
                  <h2 className="text-[15px] font-bold text-gray-800 dark:text-white">
                    {getCategoryLabel(group.category)}
                  </h2>
                </button>

                {!isCollapsed && (
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5">
                    {group.reports.map((report) => (
                      <QBOReportRow
                        key={report.id}
                        report={report}
                        isFav={favReportIds.includes(report.id)}
                        onToggleFav={toggleFavReport}
                        onOpen={(r) => navigate(`/dashboard/reports/${r.id}`)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {groupedReports.length === 0 &&
          (category !== "Favourites" || favouriteReports.length === 0) && (
            <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 dark:border-slate-800 bg-white dark:bg-slate-900 py-12 text-center">
              <IconSearch className="mb-3 text-gray-400" size={36} stroke={iconStroke} />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {t("reports.no_reports_found", "No reports found")}
              </h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                {t("reports.try_adjusting_search", "Try adjusting your search or category filter.")}
              </p>
              <button
                onClick={() => {
                  setQuery("");
                  setCategoryFilter("All");
                }}
                className="mt-4 rounded-lg bg-[#2CA01C] px-4 py-2 text-xs font-bold text-white hover:bg-[#248417] cursor-pointer"
              >
                {t("reports.show_all_reports", "Show all reports")}
              </button>
            </div>
          )}
      </div>
    </Page>
  );
}

function SummaryGrid({ summary, currency }) {
  if (!summary?.length) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {summary.map((item) => (
        <div key={item.label} className="flex flex-col justify-center rounded-xl border border-restro-border-green bg-background p-5 shadow-sm">
          <p className="text-sm font-medium text-restro-text">{item.label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{formatReportValue(item.value, item.type, currency)}</p>
        </div>
      ))}
    </div>
  );
}

function DataTable({ table, currency }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b] shadow-2xs">
      <div className="border-b border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/50 px-5 py-3.5">
        <h2 className="font-semibold text-slate-900 dark:text-white text-sm tracking-tight">{table.title}</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-neutral-800 text-[13px] font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-[#18181b]">
              {(table.columns || []).map((column) => (
                <th key={column.key} className={`whitespace-nowrap px-4 py-3 font-semibold ${column.type === "money" || column.type === "number" || column.type === "quantity" ? "text-right" : ""}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80">
            {(table.rows || []).length === 0 && (
              <tr>
                <td colSpan={(table.columns || []).length || 1} className="py-12 text-center text-slate-400 dark:text-neutral-500">
                  No data available for this period.
                </td>
              </tr>
            )}
            {(table.rows || []).map((row, rowIndex) => (
              <tr key={row.id || row.invoice_id || row.order_item_id || rowIndex} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-neutral-800/40">
                {(table.columns || []).map((column) => (
                  <td key={column.key} className={`whitespace-nowrap px-4 py-3 ${column.type === "money" || column.type === "number" || column.type === "quantity" ? "text-right tabular-nums font-medium text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"}`}>
                    {formatReportValue(row[column.key], column.type, currency)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportFilterBar({ state, setState, isLoading }) {
  const isCustom = state.filter === "custom";

  return (
    <div className="rounded-xl border border-restro-border-green bg-background p-2 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="custom-scroll-wrapper flex gap-1 overflow-x-auto pb-1 xl:pb-0">
          {DATE_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              disabled={isLoading}
              onClick={() => {
                if (filter.key === "custom") {
                  setState((current) => ({
                    filter: "custom",
                    fromDate: current.fromDate || getDefaultDate(-6),
                    toDate: current.toDate || getDefaultDate(),
                  }));
                  return;
                }
                setState({ filter: filter.key, fromDate: null, toDate: null });
              }}
              className={`h-10 shrink-0 rounded-lg px-4 text-sm font-semibold transition ${state.filter === filter.key ? "bg-restro-text text-white shadow-md" : "text-restro-text hover:bg-restro-bg-gray hover:text-foreground"} disabled:opacity-50`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {isCustom && (
          <div className="flex items-center gap-2 xl:w-auto">
            <div className="flex items-center rounded-lg border border-restro-border-green bg-background px-2 focus-within:border-restro-green">
              <span className="text-xs font-bold text-restro-text">From</span>
              <input
                type="date"
                value={state.fromDate || getDefaultDate(-6)}
                onChange={(event) => setState((current) => ({ ...current, fromDate: event.target.value }))}
                className="h-10 border-none bg-transparent px-2 text-sm text-foreground outline-none dark:[color-scheme:dark]"
              />
            </div>
            <span className="text-restro-text">-</span>
            <div className="flex items-center rounded-lg border border-restro-border-green bg-background px-2 focus-within:border-restro-green">
              <span className="text-xs font-bold text-restro-text">To</span>
              <input
                type="date"
                value={state.toDate || getDefaultDate()}
                onChange={(event) => setState((current) => ({ ...current, toDate: event.target.value }))}
                className="h-10 border-none bg-transparent px-2 text-sm text-foreground outline-none dark:[color-scheme:dark]"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExportMenu({ isExporting, data, onExport }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isExporting || !data}
        onClick={() => onExport("excel")}
        className="flex h-10 items-center gap-2 rounded-lg border border-restro-border-green bg-background px-4 text-sm font-bold text-foreground transition hover:bg-restro-bg-gray disabled:opacity-50"
      >
        <IconFileSpreadsheet size={18} stroke={iconStroke} /> Excel
      </button>
      <button
        type="button"
        disabled={isExporting || !data}
        onClick={() => onExport("pdf")}
        className="flex h-10 items-center gap-2 rounded-lg bg-restro-green px-4 text-sm font-bold text-white transition hover:bg-restro-green/90 disabled:opacity-50"
      >
        <IconDownload size={18} stroke={iconStroke} /> PDF
      </button>
    </div>
  );
}

function PlannedReport({ report }) {
  const Icon = report.icon;
  const navigate = useNavigate();

  return (
    <Page className="bg-restro-bg-gray/20 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <button type="button" onClick={() => navigate("/dashboard/reports")} className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-restro-text transition hover:text-foreground">
          <IconArrowLeft size={18} stroke={iconStroke} /> Back to Reports
        </button>

        <div className="rounded-2xl border border-restro-border-green bg-background p-8 shadow-sm md:p-10">
          <div className="flex flex-col items-start gap-6 md:flex-row">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-restro-bg-gray text-restro-text">
              <Icon size={32} stroke={iconStroke} />
            </span>
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-restro-green">{report.category}</p>
              <h1 className="mt-1 text-3xl font-bold text-foreground">{report.title}</h1>
              <p className="mt-3 text-lg text-restro-text">{report.description}</p>
            </div>
          </div>

          <div className="mt-10 flex items-center gap-3 rounded-xl border border-dashed border-restro-border-green bg-restro-bg-gray/30 p-5 text-restro-text">
            <IconLoader2 className="animate-spin text-restro-green" size={24} />
            <p>This report is planned for a later phase and is currently being tracked in <span className="font-bold text-foreground">docs/reports-roadmap.md</span>.</p>
          </div>
        </div>
      </div>
    </Page>
  );
}

function ReportDetail({ report }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const ReportPageComponent = getReportPageComponent(report.id);
  const [filterState, setFilterState] = useState({ filter: "today", fromDate: null, toDate: null });
  const [isExporting, setIsExporting] = useState(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const { data, error, isLoading } = useReport({
    reportId: report.id,
    type: filterState.filter,
    from: filterState.fromDate,
    to: filterState.toDate,
  });

  const getCategoryLabel = (cat) => {
    if (cat === "Favourites") return t("reports.favourites", "Favourites");
    if (cat === "Sales") return t("reports.categories.business_overview_and_sales", "Business overview & Sales");
    return t(`reports.categories.${cat.toLowerCase()}`, cat);
  };

  const handleSendTelegramEod = async () => {
    try {
      setIsSendingTelegram(true);
      const date = filterState.fromDate || new Date().toISOString().substring(0, 10);
      const res = await sendManualEodReport({ date });
      toast.success(res?.message || "EOD Summary sent to Telegram!");
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to send EOD report");
    } finally {
      setIsSendingTelegram(false);
    }
  };

  const filterLabel = DATE_FILTERS.find((filter) => filter.key === filterState.filter)?.label || filterState.filter;
  const currency = getCurrencySymbol(data?.currency);

  const exportReport = async (format) => {
    try {
      setIsExporting(true);
      if (format === "excel") {
        await exportReportToExcel(data, currency);
      } else {
        await exportReportToPdf(data, currency, filterLabel);
      }
      toast.success(`${format === "excel" ? "Excel" : "PDF"} report exported`);
    } catch (error) {
      console.error(error);
      toast.error("Could not export report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const translatedTitle = t(`reports.catalog.${report.id}.title`, report.title);

  return (
    <Page className="bg-restro-bg-gray/20 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <button type="button" onClick={() => navigate("/dashboard/reports")} className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-restro-text transition hover:text-foreground">
          <IconArrowLeft size={18} stroke={iconStroke} /> {t("reports.back_to_reports", "Back to Reports")}
        </button>

        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-restro-green-10 text-restro-green">
                <report.icon size={18} stroke={iconStroke} />
              </span>
              <p className="text-sm font-bold uppercase tracking-wider text-restro-green">{getCategoryLabel(report.category)}</p>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{translatedTitle}</h1>
            <p className="mt-2 text-restro-text">
              {t("reports.showing_data_for", { filter: filterLabel })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSendingTelegram}
              onClick={handleSendTelegramEod}
              className="flex h-10 items-center gap-2 rounded-lg border border-[#229ED9]/40 bg-[#229ED9]/10 hover:bg-[#229ED9]/20 text-[#229ED9] px-4 text-sm font-bold transition active:scale-95 disabled:opacity-50"
              title="Send Summary to Telegram"
            >
              <IconBrandTelegram size={18} stroke={iconStroke} />
              <span>{isSendingTelegram ? t("reports.sending", "Sending...") : t("reports.send_to_telegram", "Send to Telegram")}</span>
            </button>
            <ExportMenu isExporting={isExporting} data={data} onExport={exportReport} />
          </div>
        </div>

        <div className="mt-8">
          <ReportFilterBar state={filterState} setState={setFilterState} isLoading={isLoading} />
        </div>

        {isLoading && (
          <div className="mt-10 flex min-h-[40vh] flex-col items-center justify-center gap-4 text-restro-text">
            <IconLoader2 className="animate-spin text-restro-green" size={40} stroke={iconStroke} />
            <p className="font-medium">Crunching the numbers...</p>
          </div>
        )}

        {/* Operational reports (per-table, per-kitchen, per-shift) cannot be
            consolidated. That is an expected state in All Businesses mode, so it
            gets the same "select a business" screen as the gated modules rather
            than a red failure panel. */}
        {error && isBusinessRequiredError(error) && <SelectBusinessEmptyState />}

        {error && !isBusinessRequiredError(error) && (
          <div className="mt-10 rounded-2xl border border-dashed border-red-200 bg-red-50 p-10 text-center text-red-600 dark:border-red-900/50 dark:bg-red-950/20">
            <h3 className="text-lg font-bold">Failed to load report</h3>
            <p className="mt-1 text-sm opacity-80">There was a problem fetching this data. Please try again later.</p>
          </div>
        )}

        {data && (
          <ReportPageComponent
            report={report}
            data={data}
            currency={currency}
            filterLabel={filterLabel}
            components={{ SummaryGrid, DataTable }}
          />
        )}
      </div>
    </Page>
  );
}

export default function ReportsPage() {
  const { reportId } = useParams();
  const selectedReport = REPORT_CATALOG.find((report) => report.id === reportId);

  if (reportId && !selectedReport) {
    return (
      <Page className="flex min-h-[50vh] items-center justify-center px-4 py-8">
        <div className="rounded-xl border border-restro-border-green bg-background p-10 text-center shadow-sm">
          <h2 className="text-xl font-bold text-foreground">Report Not Found</h2>
          <p className="mt-2 text-restro-text">The report you are looking for doesn't exist or has been moved.</p>
        </div>
      </Page>
    );
  }

  if (selectedReport && (!READY_REPORTS.has(selectedReport.id) || selectedReport.status !== "ready")) {
    return <PlannedReport report={selectedReport} />;
  }

  if (selectedReport) {
    return <ReportDetail report={selectedReport} />;
  }

  return <ReportsIndex />;
}
