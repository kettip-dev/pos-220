import React, { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import Page from "../components/Page";
import { SelectBusinessEmptyState } from "../components/RequiresSingleBusiness";
import { isBusinessRequiredError } from "../helpers/BusinessScope";
import {
  IconAlertTriangle,
  IconArchive,
  IconArrowLeft,
  IconArrowsSort,
  IconCalendarEvent,
  IconCalendarStats,
  IconChartBar,
  IconChefHat,
  IconChevronDown,
  IconChevronRight,
  IconClockHour4,
  IconCreditCard,
  IconDownload,
  IconFileSpreadsheet,
  IconLayoutList,
  IconLoader2,
  IconMoodSmile,
  IconReceiptTax,
  IconRefresh,
  IconReportAnalytics,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconStar,
  IconStarFilled,
  IconToolsKitchen2,
  IconUsers,
  IconX,
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

// Reports where the Telegram end-of-day summary is the natural next action.
const TELEGRAM_EOD_REPORTS = new Set(["sales-summary", "daily-close"]);

const CATEGORY_META = {
  Sales: { icon: IconChartBar, tile: "bg-emerald-50 text-[#2CA01C] dark:bg-emerald-950/40 dark:text-emerald-400" },
  Payments: { icon: IconCreditCard, tile: "bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400" },
  Menu: { icon: IconToolsKitchen2, tile: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400" },
  Customers: { icon: IconUsers, tile: "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400" },
  Operations: { icon: IconChefHat, tile: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400" },
  Inventory: { icon: IconArchive, tile: "bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400" },
  Accounting: { icon: IconReceiptTax, tile: "bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400" },
  Reservations: { icon: IconCalendarStats, tile: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400" },
  Feedback: { icon: IconMoodSmile, tile: "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/40 dark:text-fuchsia-400" },
};
const FALLBACK_CATEGORY_META = { icon: IconReportAnalytics, tile: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300" };
const getCategoryMeta = (category) => CATEGORY_META[category] || FALLBACK_CATEGORY_META;

const isReportReady = (report) => READY_REPORTS.has(report.id) && report.status === "ready";

const getDefaultDate = (offsetDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const formatShortDate = (value) => {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return value || "";
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

function getCurrencySymbol(currencyCode) {
  return CURRENCIES.find((currency) => currency.cc === currencyCode)?.symbol || "";
}

function useCategoryLabel() {
  const { t } = useTranslation();
  return (cat) => {
    if (cat === "Favourites") return t("reports.favourites", "Favourites");
    if (cat === "Sales") return t("reports.categories.business_overview_and_sales", "Business overview & Sales");
    return t(`reports.categories.${cat.toLowerCase()}`, cat);
  };
}

function useSendTelegramEod() {
  const { t } = useTranslation();
  const [isSending, setIsSending] = useState(false);

  const send = async (payload = {}) => {
    try {
      setIsSending(true);
      const res = await sendManualEodReport(payload);
      toast.success(res?.message || t("reports.eod_sent", "EOD Summary sent to Telegram!"));
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || t("reports.eod_failed", "Failed to send EOD report"));
    } finally {
      setIsSending(false);
    }
  };

  return { send, isSending };
}

function TelegramButton({ onClick, isSending, label }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSending}
      title={t("reports.send_eod_telegram", "Send EOD to Telegram")}
      className="h-[42px] min-w-[42px] shrink-0 flex items-center justify-center gap-2 rounded-xl border border-[#229ED9]/40 bg-[#229ED9]/10 px-2.5 sm:px-3.5 text-sm font-bold text-[#229ED9] transition-all hover:bg-[#229ED9]/20 active:scale-95 disabled:opacity-50 cursor-pointer"
    >
      {isSending ? <IconLoader2 size={18} className="animate-spin" /> : <IconBrandTelegram size={18} stroke={iconStroke} />}
      <span className="hidden sm:inline">{isSending ? t("reports.sending", "Sending...") : label}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Reports index                                */
/* -------------------------------------------------------------------------- */

const FAV_REPORTS_STORAGE_KEY = "restro_qbo_fav_reports_v1";
const RECENT_REPORTS_STORAGE_KEY = "restro_recent_reports_v1";
const COLLAPSED_SECTIONS_STORAGE_KEY = "restro_reports_collapsed_v1";
const DEFAULT_FAV_REPORTS = ["sales-summary", "gross-sales", "net-sales", "daily-close"];
const MAX_RECENT_REPORTS = 6;

const readStoredList = (key, fallback) => {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(saved)) return saved;
  } catch {}
  return fallback;
};

const writeStored = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

const rememberRecentReport = (reportId) => {
  const recent = readStoredList(RECENT_REPORTS_STORAGE_KEY, []).filter((id) => id !== reportId);
  writeStored(RECENT_REPORTS_STORAGE_KEY, [reportId, ...recent].slice(0, MAX_RECENT_REPORTS));
};

function FavouriteButton({ isFav, onToggle }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      title={isFav ? t("reports.remove_from_favourites", "Remove from Favourites") : t("reports.add_to_favourites", "Add to Favourites")}
      aria-pressed={isFav}
      className="h-[42px] w-[42px] shrink-0 flex items-center justify-center rounded-xl transition-all hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-90 cursor-pointer"
    >
      {isFav ? (
        <IconStarFilled size={18} className="text-amber-400" />
      ) : (
        <IconStar size={18} stroke={1.8} className="text-slate-300 dark:text-zinc-600 group-hover:text-slate-400" />
      )}
    </button>
  );
}

function ReportRow({ report, isFav, onToggleFav, onOpen }) {
  const { t } = useTranslation();
  const ready = isReportReady(report);
  const Icon = report.icon;
  const title = t(`reports.catalog.${report.id}.title`, report.title);
  const description = t(`reports.catalog.${report.id}.description`, report.description);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(report)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(report);
        }
      }}
      className="group min-h-[60px] flex items-center gap-3 rounded-xl px-2.5 py-2 transition-all hover:bg-slate-50 dark:hover:bg-zinc-800/60 active:scale-[0.99] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2CA01C]/40"
    >
      <span className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-emerald-50 group-hover:text-[#2CA01C] dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:bg-emerald-950/40 dark:group-hover:text-emerald-400">
        <Icon size={18} stroke={iconStroke} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-slate-800 group-hover:text-slate-950 dark:text-zinc-100 dark:group-hover:text-white">
            {title}
          </span>
          {!ready && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
              {t("reports.soon", "Soon")}
            </span>
          )}
        </span>
        {description && (
          <span className="block truncate text-xs text-slate-500 dark:text-zinc-400" title={description}>
            {description}
          </span>
        )}
      </span>
      <FavouriteButton isFav={isFav} onToggle={() => onToggleFav(report.id)} />
    </div>
  );
}

function QuickReportCard({ report, onOpen, isFav, onToggleFav }) {
  const { t } = useTranslation();
  const getCategoryLabel = useCategoryLabel();
  const meta = getCategoryMeta(report.category);
  const Icon = report.icon;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(report)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(report);
        }
      }}
      className="group relative flex min-h-[76px] w-[250px] shrink-0 items-center gap-3 sm:w-auto rounded-2xl border border-slate-200 bg-white p-3 pr-1.5 transition-all hover:border-[#2CA01C]/50 hover:shadow-md active:scale-[0.98] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2CA01C]/40 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <span className={clsx("h-11 w-11 shrink-0 flex items-center justify-center rounded-xl", meta.tile)}>
        <Icon size={20} stroke={iconStroke} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
          {t(`reports.catalog.${report.id}.title`, report.title)}
        </span>
        <span className="block truncate text-xs text-slate-500 dark:text-zinc-400">{getCategoryLabel(report.category)}</span>
      </span>
      <FavouriteButton isFav={isFav} onToggle={() => onToggleFav(report.id)} />
    </div>
  );
}

function CategoryChip({ active, onClick, icon: Icon, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "h-[42px] shrink-0 flex items-center gap-2 rounded-xl px-3.5 text-sm font-bold transition-all active:scale-95 cursor-pointer",
        active
          ? "bg-[#2CA01C] text-white shadow-sm"
          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-800"
      )}
    >
      {Icon && <Icon size={16} stroke={iconStroke} className={active ? "text-white" : "text-slate-400 dark:text-zinc-500"} />}
      <span className="whitespace-nowrap">{label}</span>
      <span
        className={clsx(
          "min-w-[22px] rounded-full px-1.5 py-0.5 text-[11px] font-black tabular-nums",
          active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function ReportsIndex() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const getCategoryLabel = useCategoryLabel();
  const searchInputRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const category = searchParams.get("category") || "All";
  const normalizedQuery = query.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;
  const { send: sendTelegramEod, isSending: isSendingTelegram } = useSendTelegramEod();

  const [favReportIds, setFavReportIds] = useState(() => readStoredList(FAV_REPORTS_STORAGE_KEY, DEFAULT_FAV_REPORTS));
  const [recentReportIds] = useState(() => readStoredList(RECENT_REPORTS_STORAGE_KEY, []));
  const [collapsedSections, setCollapsedSections] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(COLLAPSED_SECTIONS_STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  });

  // "/" jumps to search, like most back-office tools.
  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName;
      if (event.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && !event.target?.isContentEditable) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const updateCollapsed = (next) => {
    setCollapsedSections(next);
    writeStored(COLLAPSED_SECTIONS_STORAGE_KEY, next);
  };

  const toggleSection = (key) => updateCollapsed({ ...collapsedSections, [key]: !collapsedSections[key] });

  const toggleFavReport = (reportId) => {
    setFavReportIds((prev) => {
      const next = prev.includes(reportId) ? prev.filter((id) => id !== reportId) : [...prev, reportId];
      writeStored(FAV_REPORTS_STORAGE_KEY, next);
      return next;
    });
  };

  const setCategoryFilter = (cat) => {
    if (!cat || cat === "All") setSearchParams({});
    else setSearchParams({ category: cat });
  };

  const openReport = (report) => navigate(`/dashboard/reports/${report.id}`);

  const matchesQuery = (report) => {
    if (!normalizedQuery) return true;
    return [
      report.title,
      t(`reports.catalog.${report.id}.title`, report.title),
      report.category,
      getCategoryLabel(report.category),
      report.description,
      t(`reports.catalog.${report.id}.description`, report.description),
      report.priority,
      ...(report.keywords || []),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  };

  const categoryCounts = useMemo(() => {
    const counts = {};
    REPORT_CATALOG.forEach((report) => {
      counts[report.category] = (counts[report.category] || 0) + 1;
    });
    return counts;
  }, []);

  const favouriteReports = useMemo(
    () => favReportIds.map((id) => REPORT_CATALOG.find((report) => report.id === id)).filter(Boolean),
    [favReportIds]
  );

  const recentReports = useMemo(
    () => recentReportIds
      .map((id) => REPORT_CATALOG.find((report) => report.id === id))
      .filter((report) => report && isReportReady(report))
      .slice(0, 4),
    [recentReportIds]
  );

  const groupedReports = useMemo(() => {
    if (category === "Favourites") {
      const reports = favouriteReports.filter(matchesQuery);
      return reports.length ? [{ category: "Favourites", reports }] : [];
    }
    return REPORT_CATEGORIES
      .filter((categoryName) => category === "All" || categoryName === category)
      .map((categoryName) => ({
        category: categoryName,
        reports: REPORT_CATALOG.filter((report) => report.category === categoryName && matchesQuery(report)),
      }))
      .filter((group) => group.reports.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, normalizedQuery, favouriteReports, t]);

  const resultCount = groupedReports.reduce((sum, group) => sum + group.reports.length, 0);
  const readyCount = REPORT_CATALOG.filter(isReportReady).length;
  const showQuickAccess = category === "All" && !isSearching;
  const allCollapsed = groupedReports.length > 0 && groupedReports.every((group) => collapsedSections[group.category]);

  const setAllCollapsed = (collapsed) => {
    const next = { ...collapsedSections };
    groupedReports.forEach((group) => {
      next[group.category] = collapsed;
    });
    updateCollapsed(next);
  };

  return (
    <Page className="min-h-[calc(100vh-56px)] bg-slate-50/60 px-3 py-4 sm:px-6 sm:py-5 dark:bg-[#08101D]">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl bg-[#2CA01C] text-white shadow-sm">
              <IconReportAnalytics size={22} stroke={iconStroke} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black leading-tight tracking-tight text-slate-900 sm:text-2xl dark:text-white">
                {t("reports.title", "Reports")}
              </h1>
              <p className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm dark:text-zinc-400">
                {t("reports.index_subtitle", "{{count}} reports across {{categories}} categories", {
                  count: readyCount,
                  categories: REPORT_CATEGORIES.length,
                })}
              </p>
            </div>
          </div>
          <TelegramButton
            onClick={() => sendTelegramEod({})}
            isSending={isSendingTelegram}
            label={t("reports.send_eod_telegram", "Send EOD to Telegram")}
          />
        </div>

        {/* Search */}
        <div className="mt-4 flex items-center gap-2">
          <div className="h-[46px] min-w-0 flex-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 transition focus-within:border-[#2CA01C] focus-within:ring-2 focus-within:ring-[#2CA01C]/15 dark:border-zinc-700 dark:bg-zinc-900">
            <IconSearch size={18} stroke={iconStroke} className="shrink-0 text-slate-400" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setQuery("");
                if (event.key === "Enter" && resultCount === 1) openReport(groupedReports[0].reports[0]);
              }}
              className="w-full min-w-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-zinc-100"
              placeholder={t("reports.search_placeholder_long", "Search reports — sales, tax, stock, customers…")}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 cursor-pointer"
                aria-label={t("reports.clear_search", "Clear search")}
              >
                <IconX size={16} />
              </button>
            ) : (
              <kbd className="hidden shrink-0 rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] font-bold text-slate-400 sm:inline dark:border-zinc-700">/</kbd>
            )}
          </div>
          {groupedReports.length > 1 && (
            <button
              type="button"
              onClick={() => setAllCollapsed(!allCollapsed)}
              title={allCollapsed ? t("reports.expand_all", "Expand all") : t("reports.collapse_all", "Collapse all")}
              className="h-[46px] shrink-0 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <IconLayoutList size={18} stroke={iconStroke} />
              <span className="hidden md:inline">{allCollapsed ? t("reports.expand_all", "Expand all") : t("reports.collapse_all", "Collapse all")}</span>
            </button>
          )}
        </div>

        {/* Category chips */}
        <div className="no-scrollbar -mx-3 mt-3 flex touch-pan-x gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
          <CategoryChip
            active={category === "All"}
            onClick={() => setCategoryFilter("All")}
            icon={IconReportAnalytics}
            label={t("reports.all", "All")}
            count={REPORT_CATALOG.length}
          />
          <CategoryChip
            active={category === "Favourites"}
            onClick={() => setCategoryFilter("Favourites")}
            icon={IconStarFilled}
            label={getCategoryLabel("Favourites")}
            count={favouriteReports.length}
          />
          {REPORT_CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat}
              active={category === cat}
              onClick={() => setCategoryFilter(cat)}
              icon={getCategoryMeta(cat).icon}
              label={t(`reports.categories.${cat.toLowerCase()}`, cat)}
              count={categoryCounts[cat] || 0}
            />
          ))}
        </div>

        {/* Quick access: favourites + recently viewed */}
        {showQuickAccess && (favouriteReports.length > 0 || recentReports.length > 0) && (
          <div className="mt-5 space-y-5">
            {favouriteReports.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <IconStarFilled size={13} className="text-amber-400" />
                  {getCategoryLabel("Favourites")}
                </h2>
                <div className="no-scrollbar -mx-3 flex touch-pan-x gap-2.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
                  {favouriteReports.map((report) => (
                    <QuickReportCard key={report.id} report={report} isFav onToggleFav={toggleFavReport} onOpen={openReport} />
                  ))}
                </div>
              </section>
            )}
            {recentReports.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <IconClockHour4 size={14} stroke={2} />
                  {t("reports.recently_viewed", "Recently viewed")}
                </h2>
                <div className="no-scrollbar flex touch-pan-x gap-2 overflow-x-auto pb-1">
                  {recentReports.map((report) => (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => openReport(report)}
                      className="h-[42px] shrink-0 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition-all hover:border-[#2CA01C]/50 hover:text-slate-900 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 cursor-pointer"
                    >
                      <report.icon size={16} stroke={iconStroke} className="text-slate-400" />
                      {t(`reports.catalog.${report.id}.title`, report.title)}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {isSearching && resultCount > 0 && (
          <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-zinc-400">
            {t("reports.search_results", "{{count}} matching reports", { count: resultCount })}
            {resultCount === 1 && <span className="ml-1 text-slate-400">· {t("reports.press_enter_to_open", "press Enter to open")}</span>}
          </p>
        )}

        {/* Category sections */}
        <div className={clsx("space-y-3", showQuickAccess ? "mt-6" : "mt-4")}>
          {groupedReports.map((group) => {
            // Searching always shows matches, regardless of collapsed state.
            const isCollapsed = !isSearching && !!collapsedSections[group.category];
            const meta = group.category === "Favourites"
              ? { icon: IconStarFilled, tile: "bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400" }
              : getCategoryMeta(group.category);
            const CategoryIcon = meta.icon;

            return (
              <section
                key={group.category}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90"
              >
                <button
                  type="button"
                  onClick={() => toggleSection(group.category)}
                  aria-expanded={!isCollapsed}
                  className="min-h-[60px] w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 cursor-pointer focus:outline-none"
                >
                  <span className={clsx("h-10 w-10 shrink-0 flex items-center justify-center rounded-xl", meta.tile)}>
                    <CategoryIcon size={20} stroke={iconStroke} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-black text-slate-900 dark:text-white">
                      {getCategoryLabel(group.category)}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-zinc-400">
                      {t("reports.report_count", "{{count}} reports", { count: group.reports.length })}
                    </span>
                  </span>
                  <IconChevronDown
                    size={18}
                    stroke={2}
                    className={clsx("shrink-0 text-slate-400 transition-transform duration-200", isCollapsed && "-rotate-90")}
                  />
                </button>

                {!isCollapsed && (
                  <div className="grid grid-cols-1 gap-x-2 border-t border-slate-100 p-1.5 md:grid-cols-2 xl:grid-cols-3 dark:border-zinc-800">
                    {group.reports.map((report) => (
                      <ReportRow
                        key={report.id}
                        report={report}
                        isFav={favReportIds.includes(report.id)}
                        onToggleFav={toggleFavReport}
                        onOpen={openReport}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {groupedReports.length === 0 && (
          <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            {category === "Favourites" && !isSearching ? (
              <>
                <IconStar className="mb-3 text-slate-300" size={36} stroke={iconStroke} />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{t("reports.no_favourites", "No favourites yet")}</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                  {t("reports.no_favourites_hint", "Tap the star on any report to pin it here.")}
                </p>
              </>
            ) : (
              <>
                <IconSearch className="mb-3 text-slate-300" size={36} stroke={iconStroke} />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{t("reports.no_reports_found", "No reports found")}</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                  {t("reports.try_adjusting_search", "Try adjusting your search or category filter.")}
                </p>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategoryFilter("All");
              }}
              className="mt-4 h-[42px] rounded-xl bg-[#2CA01C] px-4 text-sm font-bold text-white transition-all hover:bg-[#248417] active:scale-95 cursor-pointer"
            >
              {t("reports.show_all_reports", "Show all reports")}
            </button>
          </div>
        )}
      </div>
    </Page>
  );
}

/* -------------------------------------------------------------------------- */
/*                         Shared report building blocks                      */
/* -------------------------------------------------------------------------- */

function SummaryGrid({ summary, currency }) {
  if (!summary?.length) return null;

  return (
    <div
      className={clsx(
        "grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4",
        summary.length % 5 === 0 && "xl:grid-cols-5",
        summary.length === 3 && "lg:grid-cols-3"
      )}
    >
      {summary.map((item, index) => {
        const isPrimary = index === 0;
        const value = formatReportValue(item.value, item.type, currency);
        return (
          <div
            key={item.label}
            className={clsx(
              "min-w-0 rounded-2xl border p-3.5 sm:p-4",
              isPrimary
                ? "border-[#2CA01C]/30 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/30"
                : "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            )}
          >
            <p className="truncate text-xs font-semibold text-slate-500 dark:text-zinc-400" title={item.label}>{item.label}</p>
            <p
              className={clsx(
                "mt-1 truncate text-xl font-black tabular-nums tracking-tight sm:text-2xl",
                isPrimary ? "text-[#1C6B12] dark:text-emerald-400" : "text-slate-900 dark:text-white"
              )}
              title={String(value)}
            >
              {value}
            </p>
          </div>
        );
      })}
    </div>
  );
}

const NUMERIC_TYPES = new Set(["money", "number", "quantity"]);
// Columns that are rates, prices, scores or identifiers: a column total would be meaningless.
const NON_SUMMABLE_KEY = /average|avg|price|rate|rating|threshold|capacity|days_until|discount_value|_id$|^id$/;
const TABLE_PAGE_SIZE = 50;

const STATUS_KEYS = new Set(["status", "payment_status", "movement_type", "recommendation_group"]);
const statusTone = (value) => {
  const v = String(value || "").toLowerCase();
  if (/(complete|paid|served|ready|done|confirmed|promoter|in$|restock|purchase)/.test(v)) return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
  if (/(cancel|void|unpaid|no.?show|detractor|waste|out)/.test(v)) return "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400";
  if (/(pending|prepar|progress|created|passive|adjust|booked)/.test(v)) return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
  return "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300";
};

const isSummableColumn = (column) => (
  (column.type === "money" || column.type === "number") && !NON_SUMMABLE_KEY.test(column.key)
);

const compareValues = (a, b, type) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (NUMERIC_TYPES.has(type)) return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
};

function DataTable({ table, currency }) {
  const { t } = useTranslation();
  const columns = table.columns || [];
  const rows = table.rows || [];
  const [sort, setSort] = useState({ key: null, dir: "desc" });
  const [filter, setFilter] = useState("");
  const [visibleCount, setVisibleCount] = useState(TABLE_PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(TABLE_PAGE_SIZE);
  }, [rows, filter, sort]);

  const filteredRows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => columns.some((column) => (
      String(formatReportValue(row[column.key], column.type, currency) ?? "").toLowerCase().includes(needle)
    )));
  }, [rows, columns, filter, currency]);

  const sortedRows = useMemo(() => {
    if (!sort.key) return filteredRows;
    const type = columns.find((column) => column.key === sort.key)?.type;
    const sorted = [...filteredRows].sort((a, b) => compareValues(a[sort.key], b[sort.key], type));
    return sort.dir === "desc" ? sorted.reverse() : sorted;
  }, [filteredRows, sort, columns]);

  const totals = useMemo(() => {
    const summable = columns.filter(isSummableColumn);
    if (filteredRows.length < 2 || summable.length === 0) return null;
    return summable.reduce((result, column) => {
      result[column.key] = filteredRows.reduce((sum, row) => sum + Number(row[column.key] || 0), 0);
      return result;
    }, {});
  }, [filteredRows, columns]);

  const toggleSort = (column) => {
    setSort((current) => {
      if (current.key !== column.key) return { key: column.key, dir: NUMERIC_TYPES.has(column.type) ? "desc" : "asc" };
      if (current.dir === "desc") return { key: column.key, dir: "asc" };
      return { key: null, dir: "desc" };
    });
  };

  const visibleRows = sortedRows.slice(0, visibleCount);
  const remaining = sortedRows.length - visibleRows.length;
  const isNumeric = (column) => NUMERIC_TYPES.has(column.type);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-black tracking-tight text-slate-900 dark:text-white">{table.title}</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {filter
              ? t("reports.rows_filtered", "{{shown}} of {{total}} rows", { shown: sortedRows.length, total: rows.length })
              : t("reports.rows_count", "{{count}} rows", { count: rows.length })}
          </p>
        </div>
        {rows.length > 8 && (
          <div className="h-[42px] w-full sm:w-64 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 transition focus-within:border-[#2CA01C] focus-within:ring-2 focus-within:ring-[#2CA01C]/15 dark:border-zinc-700 dark:bg-zinc-900">
            <IconSearch size={16} stroke={iconStroke} className="shrink-0 text-slate-400" />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={t("reports.filter_rows", "Filter rows…")}
              className="w-full min-w-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-zinc-100"
            />
            {filter && (
              <button type="button" onClick={() => setFilter("")} className="shrink-0 text-slate-400 hover:text-slate-600 cursor-pointer" aria-label={t("reports.clear_search", "Clear search")}>
                <IconX size={15} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-zinc-800">
            <tr className="text-xs font-bold text-slate-600 dark:text-zinc-300">
              {columns.map((column) => {
                const active = sort.key === column.key;
                const SortIcon = !active ? IconArrowsSort : sort.dir === "asc" ? IconSortAscending : IconSortDescending;
                return (
                  <th
                    key={column.key}
                    className={clsx("whitespace-nowrap border-b border-slate-200 p-0 dark:border-zinc-700", isNumeric(column) && "text-right")}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className={clsx(
                        "min-h-[42px] w-full flex items-center gap-1 px-4 py-2 transition-colors hover:text-slate-900 dark:hover:text-white cursor-pointer",
                        isNumeric(column) && "justify-end",
                        active && "text-slate-900 dark:text-white"
                      )}
                    >
                      {column.label}
                      <SortIcon size={13} stroke={2} className={active ? "text-[#2CA01C]" : "text-slate-300 dark:text-zinc-600"} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={columns.length || 1} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                  {filter ? t("reports.no_matching_rows", "No rows match your filter.") : t("reports.no_data_period", "No data available for this period.")}
                </td>
              </tr>
            )}
            {visibleRows.map((row, rowIndex) => (
              <tr key={row.id || row.invoice_id || row.order_item_id || rowIndex} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
                {columns.map((column, columnIndex) => {
                  const raw = row[column.key];
                  const value = formatReportValue(raw, column.type, currency);
                  const isEmpty = raw == null || raw === "";
                  return (
                    <td
                      key={column.key}
                      className={clsx(
                        "whitespace-nowrap px-4 py-3",
                        isNumeric(column)
                          ? "text-right font-semibold tabular-nums text-slate-900 dark:text-zinc-100"
                          : columnIndex === 0
                            ? "font-semibold text-slate-900 dark:text-zinc-100"
                            : "text-slate-600 dark:text-zinc-300",
                        isNumeric(column) && Number(raw) < 0 && "text-red-600 dark:text-red-400"
                      )}
                    >
                      {isEmpty && !isNumeric(column) ? (
                        <span className="text-slate-300 dark:text-zinc-600">—</span>
                      ) : STATUS_KEYS.has(column.key) ? (
                        <span className={clsx("inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold capitalize", statusTone(raw))}>
                          {String(value).replace(/_/g, " ")}
                        </span>
                      ) : (
                        value
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot className="sticky bottom-0 bg-slate-50 dark:bg-zinc-800">
              <tr className="text-[13px] font-black text-slate-900 dark:text-white">
                {columns.map((column, columnIndex) => (
                  <td
                    key={column.key}
                    className={clsx("whitespace-nowrap border-t border-slate-200 px-4 py-3 dark:border-zinc-700", isNumeric(column) && "text-right tabular-nums")}
                  >
                    {column.key in totals
                      ? formatReportValue(totals[column.key], column.type, currency)
                      : columnIndex === 0
                        ? t("reports.total", "Total")
                        : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {remaining > 0 && (
        <div className="border-t border-slate-200 p-2 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + TABLE_PAGE_SIZE)}
            className="h-[42px] w-full rounded-xl text-sm font-bold text-[#2CA01C] transition-all hover:bg-emerald-50 active:scale-[0.99] dark:hover:bg-emerald-950/30 cursor-pointer"
          >
            {t("reports.show_more_rows", "Show {{count}} more", { count: Math.min(remaining, TABLE_PAGE_SIZE) })}
            <span className="ml-1 font-semibold text-slate-400">({t("reports.remaining", "{{count}} remaining", { count: remaining })})</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Report detail                               */
/* -------------------------------------------------------------------------- */

const readFilterState = (searchParams) => {
  const range = searchParams.get("range");
  if (range === "custom") {
    return {
      filter: "custom",
      fromDate: searchParams.get("from") || getDefaultDate(-6),
      toDate: searchParams.get("to") || getDefaultDate(),
    };
  }
  return {
    filter: DATE_FILTERS.some((filter) => filter.key === range) ? range : "today",
    fromDate: null,
    toDate: null,
  };
};

function ReportFilterBar({ state, onChange, isRefreshing }) {
  const { t } = useTranslation();
  const isCustom = state.filter === "custom";

  const setCustomDate = (field, value) => {
    if (!value) return;
    const next = { ...state, [field]: value };
    // Keep the range valid: dragging one end past the other moves both.
    if (next.fromDate > next.toDate) {
      if (field === "fromDate") next.toDate = value;
      else next.fromDate = value;
    }
    onChange(next);
  };

  return (
    <div className="relative flex flex-col gap-2 lg:flex-row lg:items-center">
      <div className="no-scrollbar flex min-w-0 touch-pan-x items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-zinc-800/80">
        {DATE_FILTERS.map((filter) => {
          const active = state.filter === filter.key;
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => {
                if (filter.key === "custom") {
                  onChange({
                    filter: "custom",
                    fromDate: state.fromDate || getDefaultDate(-6),
                    toDate: state.toDate || getDefaultDate(),
                  });
                  return;
                }
                onChange({ filter: filter.key, fromDate: null, toDate: null });
              }}
              className={clsx(
                "h-[42px] shrink-0 flex items-center gap-1.5 rounded-lg px-3.5 text-sm font-bold transition-all active:scale-95 cursor-pointer",
                active
                  ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-950 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100"
              )}
            >
              {filter.key === "custom" && <IconCalendarEvent size={16} stroke={iconStroke} />}
              {t(`reports.filters.${filter.key}`, filter.label)}
            </button>
          );
        })}
      </div>

      {isCustom && (
        <div className="flex items-center gap-2">
          <label className="h-[42px] flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-[#2CA01C] dark:border-zinc-700 dark:bg-zinc-900">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">{t("reports.from", "From")}</span>
            <input
              type="date"
              value={state.fromDate || getDefaultDate(-6)}
              max={getDefaultDate()}
              onChange={(event) => setCustomDate("fromDate", event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none dark:text-zinc-100 dark:[color-scheme:dark]"
            />
          </label>
          <label className="h-[42px] flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-[#2CA01C] dark:border-zinc-700 dark:bg-zinc-900">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">{t("reports.to", "To")}</span>
            <input
              type="date"
              value={state.toDate || getDefaultDate()}
              onChange={(event) => setCustomDate("toDate", event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none dark:text-zinc-100 dark:[color-scheme:dark]"
            />
          </label>
        </div>
      )}

      {isRefreshing && (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 lg:ml-auto dark:text-zinc-400">
          <IconLoader2 size={15} className="animate-spin text-[#2CA01C]" />
          {t("reports.updating", "Updating…")}
        </span>
      )}
    </div>
  );
}

function ExportButtons({ isExporting, disabled, onExport }) {
  return (
    <>
      <button
        type="button"
        disabled={isExporting || disabled}
        onClick={() => onExport("excel")}
        className="h-[42px] flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
      >
        <IconFileSpreadsheet size={18} stroke={iconStroke} className="text-[#2CA01C]" />
        <span>Excel</span>
      </button>
      <button
        type="button"
        disabled={isExporting || disabled}
        onClick={() => onExport("pdf")}
        className="h-[42px] flex items-center gap-2 rounded-xl bg-[#2CA01C] px-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#248417] active:scale-95 disabled:opacity-50 cursor-pointer"
      >
        {isExporting ? <IconLoader2 size={18} className="animate-spin" /> : <IconDownload size={18} stroke={iconStroke} />}
        <span>PDF</span>
      </button>
    </>
  );
}

function ReportSkeleton() {
  return (
    <div className="mt-5 animate-pulse space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-[84px] rounded-2xl bg-slate-200/70 dark:bg-zinc-800/70" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="h-[340px] rounded-2xl bg-slate-200/70 dark:bg-zinc-800/70" />
        <div className="h-[340px] rounded-2xl bg-slate-200/70 dark:bg-zinc-800/70" />
      </div>
      <div className="h-64 rounded-2xl bg-slate-200/70 dark:bg-zinc-800/70" />
    </div>
  );
}

function ReportHeader({ report, subtitle, actions }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const getCategoryLabel = useCategoryLabel();
  const meta = getCategoryMeta(report.category);
  const Icon = report.icon;

  return (
    <>
      <nav className="flex min-w-0 items-center gap-1 text-xs font-semibold text-slate-500 dark:text-zinc-400">
        <button
          type="button"
          onClick={() => navigate("/dashboard/reports")}
          className="-ml-2 min-h-[42px] flex items-center gap-1.5 rounded-lg px-2 transition-colors hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          <IconArrowLeft size={16} stroke={iconStroke} />
          {t("reports.title", "Reports")}
        </button>
        <IconChevronRight size={14} className="shrink-0 text-slate-300 dark:text-zinc-600" />
        <button
          type="button"
          onClick={() => navigate(`/dashboard/reports?category=${encodeURIComponent(report.category)}`)}
          className="min-h-[42px] truncate rounded-lg px-2 transition-colors hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          {getCategoryLabel(report.category)}
        </button>
      </nav>

      <div className="mt-1 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className={clsx("h-11 w-11 shrink-0 flex items-center justify-center rounded-xl", meta.tile)}>
            <Icon size={22} stroke={iconStroke} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black leading-tight tracking-tight text-slate-900 sm:text-2xl dark:text-white">
              {t(`reports.catalog.${report.id}.title`, report.title)}
            </h1>
            {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm dark:text-zinc-400">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </>
  );
}

function SiblingReports({ report }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const siblings = REPORT_CATALOG.filter((item) => item.category === report.category && isReportReady(item));
  if (siblings.length < 2) return null;
  const search = searchParams.toString();

  return (
    <div className="no-scrollbar -mx-3 flex touch-pan-x gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:px-0">
      {siblings.map((item) => {
        const active = item.id === report.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => !active && navigate(`/dashboard/reports/${item.id}${search ? `?${search}` : ""}`)}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "h-[42px] shrink-0 rounded-xl px-3.5 text-sm font-bold transition-all active:scale-95 cursor-pointer",
              active
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            )}
          >
            {t(`reports.catalog.${item.id}.title`, item.title)}
          </button>
        );
      })}
    </div>
  );
}

function PlannedReport({ report }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Page className="min-h-[calc(100vh-56px)] bg-slate-50/60 px-3 py-4 sm:px-6 sm:py-5 dark:bg-[#08101D]">
      <div className="mx-auto max-w-3xl">
        <ReportHeader report={report} subtitle={t(`reports.catalog.${report.id}.description`, report.description)} />
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <span className="h-12 w-12 flex items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
            <IconClockHour4 size={24} stroke={iconStroke} />
          </span>
          <h2 className="mt-4 text-lg font-black text-slate-900 dark:text-white">{t("reports.coming_soon", "Coming soon")}</h2>
          <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-zinc-400">
            {t("reports.coming_soon_hint", "This report is planned for a later release. In the meantime, the other reports in this category may cover what you need.")}
          </p>
          <button
            type="button"
            onClick={() => navigate(`/dashboard/reports?category=${encodeURIComponent(report.category)}`)}
            className="mt-5 h-[42px] rounded-xl bg-[#2CA01C] px-4 text-sm font-bold text-white transition-all hover:bg-[#248417] active:scale-95 cursor-pointer"
          >
            {t("reports.browse_category", "Browse related reports")}
          </button>
        </div>
      </div>
    </Page>
  );
}

const hasAnyData = (data) => (
  (data?.tables || []).some((table) => (table.rows || []).length > 0)
  || (data?.summary || []).some((item) => Number(item.value || 0) !== 0)
);

function ReportDetail({ report }) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const ReportPageComponent = getReportPageComponent(report.id);
  const filterState = useMemo(() => readFilterState(searchParams), [searchParams]);
  const [isExporting, setIsExporting] = useState(false);
  const { send: sendTelegramEod, isSending: isSendingTelegram } = useSendTelegramEod();
  const { data: rawData, error, isLoading, isValidating, mutate } = useReport({
    reportId: report.id,
    type: filterState.filter,
    from: filterState.fromDate,
    to: filterState.toDate,
  });
  // keepPreviousData can hand us the previous report's payload while the new one
  // loads; never render it with this report's layout.
  const data = rawData?.reportId === report.id ? rawData : null;
  const isRefreshing = Boolean(data) && isValidating;

  useEffect(() => {
    rememberRecentReport(report.id);
  }, [report.id]);

  const setFilterState = (next) => {
    const params = new URLSearchParams(searchParams);
    params.set("range", next.filter);
    if (next.filter === "custom") {
      params.set("from", next.fromDate);
      params.set("to", next.toDate);
    } else {
      params.delete("from");
      params.delete("to");
    }
    setSearchParams(params, { replace: true });
  };

  const filterLabel = filterState.filter === "custom"
    ? `${formatShortDate(filterState.fromDate)} – ${formatShortDate(filterState.toDate)}`
    : t(`reports.filters.${filterState.filter}`, DATE_FILTERS.find((filter) => filter.key === filterState.filter)?.label || filterState.filter);
  const currency = getCurrencySymbol(data?.currency);

  const handleSendTelegramEod = () => {
    const date = filterState.filter === "custom"
      ? filterState.fromDate
      : getDefaultDate(filterState.filter === "yesterday" ? -1 : 0);
    sendTelegramEod({ date });
  };

  const exportReport = async (format) => {
    try {
      setIsExporting(true);
      if (format === "excel") {
        await exportReportToExcel(data, currency);
      } else {
        await exportReportToPdf(data, currency, filterLabel);
      }
      toast.success(`${format === "excel" ? "Excel" : "PDF"} ${t("reports.exported", "report exported")}`);
    } catch (exportError) {
      console.error(exportError);
      toast.error(t("reports.export_failed", "Could not export report. Please try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const showEmptyHint = data && !hasAnyData(data) && filterState.filter !== "last_month" && filterState.filter !== "custom";

  return (
    <Page className="min-h-[calc(100vh-56px)] bg-slate-50/60 px-3 py-4 sm:px-6 sm:py-5 dark:bg-[#08101D]">
      <div className="mx-auto max-w-7xl">
        <ReportHeader
          report={report}
          subtitle={t("reports.showing_data_for", { filter: filterLabel, defaultValue: "Showing data for {{filter}}" })}
          actions={(
            <>
              {TELEGRAM_EOD_REPORTS.has(report.id) && (
                <TelegramButton
                  onClick={handleSendTelegramEod}
                  isSending={isSendingTelegram}
                  label={t("reports.send_to_telegram", "Send to Telegram")}
                />
              )}
              <ExportButtons isExporting={isExporting} disabled={!data} onExport={exportReport} />
            </>
          )}
        />

        <div className="mt-4 space-y-3">
          <SiblingReports report={report} />
          <ReportFilterBar state={filterState} onChange={setFilterState} isRefreshing={isRefreshing} />
        </div>

        {(isLoading || (!data && isValidating)) && !error && <ReportSkeleton />}

        {/* Operational reports (per-table, per-kitchen, per-shift) cannot be
            consolidated. That is an expected state in All Businesses mode, so it
            gets the same "select a business" screen as the gated modules rather
            than a red failure panel. */}
        {error && isBusinessRequiredError(error) && <SelectBusinessEmptyState />}

        {error && !isBusinessRequiredError(error) && (
          <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-red-200 bg-red-50 px-6 py-10 text-center text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
            <IconAlertTriangle size={32} stroke={iconStroke} />
            <h3 className="mt-2 text-lg font-black">{t("reports.load_failed", "Failed to load report")}</h3>
            <p className="mt-1 text-sm opacity-80">{t("reports.load_failed_hint", "There was a problem fetching this data. Please try again.")}</p>
            <button
              type="button"
              onClick={() => mutate()}
              className="mt-4 h-[42px] flex items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition-all hover:bg-red-700 active:scale-95 cursor-pointer"
            >
              <IconRefresh size={17} stroke={iconStroke} />
              {t("reports.retry", "Retry")}
            </button>
          </div>
        )}

        {showEmptyHint && (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/50 dark:bg-amber-950/20">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {t("reports.no_activity", "No activity recorded for {{filter}}.", { filter: filterLabel })}
            </p>
            <button
              type="button"
              onClick={() => setFilterState({ filter: "this_month", fromDate: null, toDate: null })}
              className="h-[42px] shrink-0 rounded-xl bg-white px-3.5 text-sm font-bold text-amber-800 shadow-sm transition-all hover:bg-amber-100 active:scale-95 dark:bg-zinc-900 dark:text-amber-300 cursor-pointer"
            >
              {t("reports.view_this_month", "View this month")}
            </button>
          </div>
        )}

        {data && (
          <div className={clsx("transition-opacity", isRefreshing && "opacity-60")}>
            <ReportPageComponent
              report={report}
              data={data}
              currency={currency}
              filterLabel={filterLabel}
              components={{ SummaryGrid, DataTable }}
            />
          </div>
        )}
      </div>
    </Page>
  );
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { reportId } = useParams();
  const selectedReport = REPORT_CATALOG.find((report) => report.id === reportId);

  if (reportId && !selectedReport) {
    return (
      <Page className="flex min-h-[50vh] items-center justify-center px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">{t("reports.not_found", "Report Not Found")}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
            {t("reports.not_found_hint", "The report you are looking for doesn't exist or has been moved.")}
          </p>
          <button
            type="button"
            onClick={() => navigate("/dashboard/reports")}
            className="mt-5 h-[42px] rounded-xl bg-[#2CA01C] px-4 text-sm font-bold text-white transition-all hover:bg-[#248417] active:scale-95 cursor-pointer"
          >
            {t("reports.back_to_reports", "Back to Reports")}
          </button>
        </div>
      </Page>
    );
  }

  if (selectedReport && !isReportReady(selectedReport)) {
    return <PlannedReport report={selectedReport} />;
  }

  if (selectedReport) {
    return <ReportDetail key={selectedReport.id} report={selectedReport} />;
  }

  return <ReportsIndex />;
}
