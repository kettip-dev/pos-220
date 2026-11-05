import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import { clsx } from "clsx";
import Chart from "react-apexcharts";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconAward,
  IconCake,
  IconCalendarEvent,
  IconCash,
  IconCheck,
  IconClockDollar,
  IconEye,
  IconHistory,
  IconMessageStar,
  IconNotes,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconReceipt,
  IconReceiptOff,
  IconRefresh,
  IconStar,
  IconTag,
  IconToolsKitchen2,
  IconTrendingUp,
  IconUserPlus,
  IconX,
} from "@tabler/icons-react";
import Page from "../components/Page";
import { iconStroke } from "../config/config";
import { CURRENCIES } from "../config/currencies.config";
import { useTheme } from "../contexts/ThemeContext";
import { getImageURL } from "../helpers/ImageHelper";
import { triggerPrintReceipt } from "../helpers/ReceiptHelper";
import { getInvoiceOrders, getInvoicesInit } from "../controllers/invoices.controller";
import { useCustomer360, useCustomerInvoices, saveCustomerProfileNotes } from "../controllers/customers.controller";
import { useCustomerLoyaltyHistory, adjustCustomerPoints } from "../controllers/loyalty.controller";
import { CustomerCreditPanel, CollectPaymentModal } from "./CustomerDuesPage";

/**
 * Customer 360: one screen with everything the restaurant knows about a
 * guest — who they are, what they are worth, how and when they come, what
 * they order, what they owe, and what happened on every visit.
 */

const SEGMENT_STYLES = {
  vip: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  loyal: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  new: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  occasional: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
  at_risk: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
  lapsed: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  prospect: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
};

const SEGMENT_LABELS = {
  vip: "VIP",
  loyal: "Loyal",
  new: "New",
  occasional: "Occasional",
  at_risk: "At risk",
  lapsed: "Lapsed",
  prospect: "No visits yet",
};

const TAG_SUGGESTIONS = ["VIP", "Regular", "Corporate", "Family", "Vegetarian", "Vegan", "Halal", "No spicy", "Birthday club", "Staff"];

const RESERVATION_STYLES = {
  booked: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  seated: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
  no_show: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

const card = "p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-2xs";
const touchBtn =
  "min-h-[42px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50";

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : "—");
const fmtDateTime = (v) =>
  v ? `${new Date(v).toLocaleDateString()} ${new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "—";
const fmtHour = (h) => (h === null || h === undefined ? "—" : `${String(h).padStart(2, "0")}:00`);

export default function Customer360Page() {
  const { phone } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "black";

  const [tab, setTab] = useState("overview");
  const [init, setInit] = useState({ currency: "$", printSettings: {}, storeSettings: {}, paymentTypes: [] });
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isCreditOpen, setIsCreditOpen] = useState(false);
  const [collectFor, setCollectFor] = useState(null);

  const { data, error, isLoading, mutate } = useCustomer360(phone);

  useEffect(() => {
    getInvoicesInit()
      .then((res) => {
        const d = res?.data || {};
        const currency = CURRENCIES.find((c) => c.cc === d?.storeSettings?.currency);
        setInit({
          currency: currency?.symbol || "$",
          printSettings: d.printSettings || {},
          storeSettings: d.storeSettings || {},
          paymentTypes: (d.paymentTypes || []).filter((p) => p.is_active === undefined || Number(p.is_active) === 1),
        });
      })
      .catch(() => {});
  }, []);

  const money = (v) => `${init.currency}${Number(v || 0).toFixed(2)}`;

  if (isLoading) {
    return (
      <Page>
        <div className="flex items-center justify-center min-h-[300px]">
          <span className="loading loading-spinner loading-md text-amber-500"></span>
        </div>
      </Page>
    );
  }

  if (error || !data) {
    return (
      <Page>
        <div className="p-8 text-center">
          <p className="text-slate-500">{error?.response?.data?.message || t("customer360.not_found", "Customer not found")}</p>
          <button onClick={() => navigate("/dashboard/customers")} className={clsx(touchBtn, "mx-auto mt-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800")}>
            {t("customer360.back", "Back to Customers")}
          </button>
        </div>
      </Page>
    );
  }

  const { profile, segment, stats, loyalty, credit, reservations, feedback } = data;

  const tabs = [
    { key: "overview", label: t("customer360.tab_overview", "Overview"), icon: IconTrendingUp },
    { key: "bills", label: t("customer360.tab_bills", "Bills"), icon: IconReceipt, count: stats.visits + stats.void_count },
    { key: "loyalty", label: t("customer360.tab_loyalty", "Loyalty"), icon: IconAward },
    { key: "dues", label: t("customer360.tab_dues", "Dues"), icon: IconClockDollar, count: credit.open_bills || null, alert: credit.overdue > 0 },
    { key: "reservations", label: t("customer360.tab_reservations", "Reservations"), icon: IconCalendarEvent, count: reservations.total || null },
    { key: "feedback", label: t("customer360.tab_feedback", "Feedback"), icon: IconMessageStar, count: feedback.count || null },
    { key: "timeline", label: t("customer360.tab_timeline", "Timeline"), icon: IconHistory },
  ];

  return (
    <Page>
      <div className="flex flex-col gap-4 w-full pb-8 max-w-7xl mx-auto">
        <Header
          profile={profile}
          segment={segment}
          loyalty={loyalty}
          onBack={() => navigate("/dashboard/customers")}
          onRefresh={() => mutate()}
          onEditNotes={() => setIsNotesOpen(true)}
          onAdjustPoints={() => setIsAdjustOpen(true)}
          t={t}
        />

        {(profile.allergies || profile.notes) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {profile.allergies && (
              <div className="p-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 flex items-start gap-2.5">
                <IconAlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
                    {t("customer360.allergies", "Allergies / dietary")}
                  </p>
                  <p className="text-sm font-bold text-rose-900 dark:text-rose-100 break-words">{profile.allergies}</p>
                </div>
              </div>
            )}
            {profile.notes && (
              <button
                type="button"
                onClick={() => setIsNotesOpen(true)}
                className="text-left p-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 flex items-start gap-2.5 cursor-pointer hover:bg-amber-500/10 transition"
              >
                <IconNotes size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    {t("customer360.staff_notes", "Staff notes")}
                  </p>
                  <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line line-clamp-3 break-words">{profile.notes}</p>
                </div>
              </button>
            )}
          </div>
        )}

        <KpiRow stats={stats} loyalty={loyalty} credit={credit} money={money} t={t} onOpenDues={() => setTab("dues")} />

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 overflow-x-auto">
          {tabs.map(({ key, label, icon: Icon, count, alert }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={clsx(
                "min-h-[42px] px-3.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95",
                tab === key
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Icon size={15} stroke={iconStroke} />
              <span>{label}</span>
              {count ? (
                <span
                  className={clsx(
                    "px-1.5 rounded-md text-[10px] font-mono",
                    alert ? "bg-rose-500 text-white" : "bg-slate-200/70 dark:bg-slate-700"
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab data={data} money={money} isDark={isDark} t={t} onEditNotes={() => setIsNotesOpen(true)} />}
        {tab === "bills" && <BillsTab phone={profile.phone} init={init} money={money} t={t} />}
        {tab === "loyalty" && <LoyaltyTab phone={profile.phone} loyalty={loyalty} t={t} onAdjust={() => setIsAdjustOpen(true)} />}
        {tab === "dues" && (
          <DuesTab
            credit={credit}
            money={money}
            t={t}
            onManage={() => setIsCreditOpen(true)}
            onCollect={() => setCollectFor({ phone: profile.phone, name: profile.name, outstanding: credit.outstanding })}
          />
        )}
        {tab === "reservations" && <ReservationsTab reservations={reservations} t={t} />}
        {tab === "feedback" && <FeedbackTab feedback={feedback} t={t} />}
        {tab === "timeline" && <TimelineTab timeline={data.timeline} money={money} t={t} />}
      </div>

      {isNotesOpen && (
        <NotesModal
          profile={profile}
          t={t}
          onClose={() => setIsNotesOpen(false)}
          onSaved={() => {
            setIsNotesOpen(false);
            mutate();
          }}
        />
      )}

      {isAdjustOpen && (
        <AdjustPointsModal
          profile={profile}
          balance={loyalty.points_balance}
          t={t}
          onClose={() => setIsAdjustOpen(false)}
          onSaved={() => {
            setIsAdjustOpen(false);
            mutate();
          }}
        />
      )}

      {isCreditOpen && (
        <CustomerCreditPanel
          phone={profile.phone}
          money={money}
          onClose={() => setIsCreditOpen(false)}
          onCollect={(c) => setCollectFor(c)}
          onChanged={() => mutate()}
        />
      )}

      {collectFor && (
        <CollectPaymentModal
          target={collectFor}
          paymentTypes={init.paymentTypes}
          currency={init.currency}
          storeSettings={init.storeSettings}
          money={money}
          onClose={() => setCollectFor(null)}
          onDone={() => {
            setCollectFor(null);
            mutate();
          }}
        />
      )}
    </Page>
  );
}

const segmentReason = (segment, t) => t(`customer360.reason_${segment.key}`, segment.reason, segment.args || {});

/* ─── Header ─────────────────────────────────────────────── */

function Header({ profile, segment, loyalty, onBack, onRefresh, onEditNotes, onAdjustPoints, t }) {
  const birthdaySoon = profile.birthday && profile.birthday.days_until <= 14;
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-start gap-3 min-w-0">
        <button
          onClick={onBack}
          className="w-[42px] h-[42px] shrink-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
          title={t("customer360.back", "Back to Customers")}
        >
          <IconArrowLeft stroke={iconStroke} size={18} />
        </button>
        <div className="w-[42px] h-[42px] shrink-0 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold flex items-center justify-center font-mono text-sm border border-amber-500/20">
          {profile.name?.substring(0, 2).toUpperCase() || "CU"}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight truncate">{profile.name}</h1>
            <span
              className={clsx("px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border", SEGMENT_STYLES[segment.key])}
              title={segmentReason(segment, t)}
            >
              {t(`customer360.segment_${segment.key}`, SEGMENT_LABELS[segment.key])}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
              {loyalty.membership_tier}
            </span>
            {profile.customer_group_name && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: profile.customer_group_color || "#6366F1" }}
              >
                {profile.customer_group_name}
              </span>
            )}
            {profile.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                #{tag}
              </span>
            ))}
            {birthdaySoon && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/15 text-pink-700 dark:text-pink-300 border border-pink-500/30 flex items-center gap-1">
                <IconCake size={12} />
                {profile.birthday.days_until === 0
                  ? t("customer360.birthday_today", "Birthday today!")
                  : t("customer360.birthday_in", "Birthday in {{days}} days", { days: profile.birthday.days_until })}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">
            {profile.phone}
            {profile.email ? ` • ${profile.email}` : ""}
            {` • ${t("customer360.member_since", "Customer since")} ${fmtDate(profile.created_at)}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={onRefresh} className={clsx(touchBtn, "w-[42px] justify-center px-0 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800")} title={t("customer360.refresh", "Refresh")}>
          <IconRefresh size={16} stroke={iconStroke} />
        </button>
        <button type="button" onClick={onEditNotes} className={clsx(touchBtn, "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800")}>
          <IconNotes size={16} stroke={iconStroke} />
          <span>{t("customer360.notes_tags", "Notes & tags")}</span>
        </button>
        <button type="button" onClick={onAdjustPoints} className={clsx(touchBtn, "border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-200")}>
          <IconAward size={16} className="text-amber-500" />
          <span>{t("customer360.adjust_points", "Adjust points")}</span>
        </button>
      </div>
    </div>
  );
}

/* ─── KPI row ────────────────────────────────────────────── */

function Kpi({ label, value, sub, icon: Icon, tone = "slate", onClick }) {
  const tones = {
    slate: "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80",
    amber: "border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20",
    rose: "border-rose-500/40 bg-rose-500/5 dark:bg-rose-950/20",
    emerald: "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20",
  };
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={clsx("p-3.5 rounded-2xl border shadow-2xs flex flex-col justify-between text-left min-h-[96px]", tones[tone], onClick && "cursor-pointer active:scale-95 transition")}
    >
      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-semibold">
        <Icon size={15} stroke={iconStroke} />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-mono leading-none truncate">{value}</h2>
        {sub && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">{sub}</p>}
      </div>
    </Tag>
  );
}

function KpiRow({ stats, loyalty, credit, money, t, onOpenDues }) {
  const lastVisitText =
    stats.days_since_last_visit === null
      ? "—"
      : stats.days_since_last_visit === 0
        ? t("customer360.today", "Today")
        : t("customer360.days_ago", "{{days}}d ago", { days: stats.days_since_last_visit });
  const nextVisit = stats.next_visit_expected
    ? t("customer360.expected_back", "Expected back ~{{date}}", { date: fmtDate(stats.next_visit_expected) })
    : stats.avg_days_between_visits
      ? t("customer360.every_n_days", "Every ~{{days}} days", { days: Math.round(stats.avg_days_between_visits) })
      : fmtDate(stats.last_visit);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-6 gap-3">
      <Kpi
        icon={IconCash}
        tone="emerald"
        label={t("customer360.lifetime_value", "Lifetime value")}
        value={money(stats.net_spend)}
        sub={
          stats.spend_percentile !== null && stats.ranked_customers > 1
            ? t("customer360.top_percent", "Top {{pct}}% of customers", { pct: Math.max(1, 100 - stats.spend_percentile) })
            : t("customer360.net_of_refunds", "Net of refunds")
        }
      />
      <Kpi
        icon={IconReceipt}
        label={t("customer360.visits", "Visits")}
        value={stats.visits}
        sub={t("customer360.visits_90d", "{{n}} in last 90 days", { n: stats.visits_90d })}
      />
      <Kpi
        icon={IconToolsKitchen2}
        label={t("customer360.avg_bill", "Avg bill")}
        value={money(stats.avg_bill)}
        sub={t("customer360.biggest", "Biggest {{amount}}", { amount: money(stats.biggest_bill) })}
      />
      <Kpi icon={IconCalendarEvent} label={t("customer360.last_visit", "Last visit")} value={lastVisitText} sub={nextVisit} />
      <Kpi
        icon={IconAward}
        tone="amber"
        label={t("customer360.points", "Loyalty points")}
        value={loyalty.points_balance}
        sub={t("customer360.lifetime_points", "Lifetime {{n}} pts", { n: loyalty.lifetime_points_earned })}
      />
      <Kpi
        icon={IconClockDollar}
        tone={credit.overdue > 0 ? "rose" : credit.outstanding > 0 ? "amber" : "slate"}
        label={t("customer360.balance_due", "Balance due")}
        value={money(credit.outstanding)}
        sub={
          credit.overdue > 0
            ? t("customer360.overdue_amount", "{{amount}} overdue", { amount: money(credit.overdue) })
            : credit.credit_limit !== null
              ? t("customer360.limit", "Limit {{amount}}", { amount: money(credit.credit_limit) })
              : t("customer360.no_limit", "No credit limit")
        }
        onClick={onOpenDues}
      />
    </div>
  );
}

/* ─── Overview ───────────────────────────────────────────── */

function BarList({ rows, labelKey, valueKey, format = (v) => v, color = "bg-emerald-500" }) {
  const max = Math.max(1, ...rows.map((r) => r[valueKey]));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r[labelKey]} className="flex items-center gap-2 text-xs">
          <span className="w-24 shrink-0 truncate text-slate-600 dark:text-slate-400 capitalize">{r.label || r[labelKey]}</span>
          <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className={clsx("h-full rounded-full", color)} style={{ width: `${(r[valueKey] / max) * 100}%` }} />
          </div>
          <span className="w-10 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{format(r[valueKey])}</span>
        </div>
      ))}
    </div>
  );
}

function OverviewTab({ data, money, isDark, t, onEditNotes }) {
  const { behaviour, favorites, stats, profile, segment } = data;
  const months = behaviour.monthly.map((m) => {
    const [y, mo] = m.month.split("-").map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: "short" });
  });

  const chartOptions = {
    chart: { type: "line", toolbar: { show: false }, zoom: { enabled: false }, background: "transparent", fontFamily: "Inter, sans-serif" },
    theme: { mode: isDark ? "dark" : "light" },
    colors: ["#10b981", "#6366f1"],
    stroke: { width: [0, 2.5], curve: "smooth" },
    plotOptions: { bar: { borderRadius: 4, columnWidth: "55%" } },
    dataLabels: { enabled: false },
    xaxis: { categories: months, axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: "#94a3b8", fontSize: "11px" } } },
    yaxis: [
      { labels: { style: { colors: "#94a3b8" }, formatter: (v) => money(v).replace(/\.00$/, "") } },
      { opposite: true, labels: { style: { colors: "#94a3b8" }, formatter: (v) => Math.round(v) } },
    ],
    grid: { borderColor: isDark ? "#1e293b" : "#f1f5f9", strokeDashArray: 4 },
    legend: { position: "top", horizontalAlign: "right", labels: { colors: "#94a3b8" } },
    tooltip: { theme: isDark ? "dark" : "light" },
  };
  const chartSeries = [
    { name: t("customer360.spend", "Spend"), type: "column", data: behaviour.monthly.map((m) => m.spend) },
    { name: t("customer360.visits", "Visits"), type: "line", data: behaviour.monthly.map((m) => m.visits) },
  ];

  const daypartLabels = {
    breakfast: t("customer360.breakfast", "Breakfast"),
    lunch: t("customer360.lunch", "Lunch"),
    afternoon: t("customer360.afternoon", "Afternoon"),
    dinner: t("customer360.dinner", "Dinner"),
    late_night: t("customer360.late_night", "Late night"),
  };
  const channelLabel = (c) =>
    ({ dinein: t("customer360.dine_in", "Dine-in"), takeaway: t("customer360.takeaway", "Takeaway"), delivery: t("customer360.delivery", "Delivery") })[c] || c;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div className="lg:col-span-2 flex flex-col gap-3">
        <div className={card}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t("customer360.spend_12m", "Spend & visits — last 12 months")}</h3>
            <span className="text-[11px] text-slate-500 font-mono">
              {t("customer360.this_month", "This month")}: {money(stats.this_month_spend)}
            </span>
          </div>
          <Chart options={chartOptions} series={chartSeries} type="line" height={230} width="100%" />
        </div>

        <div className={card}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t("customer360.usual_order", "Usual order")}</h3>
            <span className="text-[11px] text-slate-400">{t("customer360.by_quantity", "Most ordered items")}</span>
          </div>
          {favorites.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">{t("customer360.no_items", "No items ordered yet.")}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {favorites.map((f, idx) => (
                <div key={f.id} className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden flex items-center justify-center">
                    {f.image ? (
                      <img src={getImageURL(f.image)} alt={f.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-slate-400">{idx + 1}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{f.title}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      ×{f.quantity} • {t("customer360.last_had", "last")} {fmtDate(f.last_ordered)}
                    </p>
                  </div>
                  <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">{money(f.spend)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className={card}>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">{t("customer360.at_a_glance", "At a glance")}</h3>
          <dl className="text-xs divide-y divide-slate-100 dark:divide-slate-800">
            {[
              [t("customer360.segment", "Segment"), `${t(`customer360.segment_${segment.key}`, SEGMENT_LABELS[segment.key])} — ${segmentReason(segment, t)}`],
              [t("customer360.first_visit", "First visit"), fmtDate(stats.first_visit)],
              [t("customer360.last_visit", "Last visit"), fmtDateTime(stats.last_visit)],
              [t("customer360.visit_frequency", "Visit frequency"), stats.avg_days_between_visits ? t("customer360.every_n_days", "Every ~{{days}} days", { days: Math.round(stats.avg_days_between_visits) }) : "—"],
              [t("customer360.spend_30d", "Spend (30 days)"), money(stats.spend_30d)],
              [t("customer360.spend_90d", "Spend (90 days)"), money(stats.spend_90d)],
              [t("customer360.savings", "Discounts received"), money(stats.savings)],
              [t("customer360.tips", "Tips given"), money(stats.tips)],
              [t("customer360.refunds", "Refunds"), money(stats.refunded)],
              [t("customer360.voids", "Voided bills"), stats.void_count],
              [t("customer360.birthday", "Birthday"), profile.birth_date ? fmtDate(`${profile.birth_date}T00:00:00`) : "—"],
              [t("customer360.gender", "Gender"), profile.gender || "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 py-1.5">
                <dt className="text-slate-500 shrink-0">{k}</dt>
                <dd className="font-semibold text-slate-800 dark:text-slate-200 text-right break-words min-w-0">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className={card}>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{t("customer360.habits", "Habits")}</h3>
          <p className="text-[11px] text-slate-500 mb-3">
            {behaviour.peak_day
              ? t("customer360.usually_comes", "Usually comes on {{day}} around {{hour}}", {
                  day: t(`customer360.day_${behaviour.peak_day.toLowerCase()}`, behaviour.peak_day),
                  hour: fmtHour(behaviour.peak_hour),
                })
              : t("customer360.no_habits", "Not enough visits yet.")}
          </p>
          <p className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">{t("customer360.when", "When")}</p>
          <BarList rows={behaviour.dayparts.map((d) => ({ ...d, label: daypartLabels[d.key] }))} labelKey="key" valueKey="visits" color="bg-indigo-500" />
          <p className="text-[10px] font-bold uppercase text-slate-400 mt-3 mb-1.5">{t("customer360.day_of_week", "Day of week")}</p>
          <BarList
            rows={behaviour.by_day.map((d) => ({ ...d, label: t(`customer360.day_${d.day.toLowerCase()}`, d.day).slice(0, 9) }))}
            labelKey="day"
            valueKey="visits"
            color="bg-emerald-500"
          />
          {behaviour.channels.length > 0 && (
            <>
              <p className="text-[10px] font-bold uppercase text-slate-400 mt-3 mb-1.5">{t("customer360.order_type", "Order type")}</p>
              <BarList rows={behaviour.channels.map((c) => ({ ...c, label: channelLabel(c.channel) }))} labelKey="channel" valueKey="orders" color="bg-sky-500" />
            </>
          )}
          {behaviour.payment_types.length > 0 && (
            <>
              <p className="text-[10px] font-bold uppercase text-slate-400 mt-3 mb-1.5">{t("customer360.pays_with", "Pays with")}</p>
              <BarList rows={behaviour.payment_types} labelKey="payment_type" valueKey="bills" color="bg-amber-500" />
            </>
          )}
        </div>

        <div className={card}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t("customer360.notes_tags", "Notes & tags")}</h3>
            <button type="button" onClick={onEditNotes} className={clsx(touchBtn, "px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700")}>
              <IconPencil size={14} />
              {t("common.edit", "Edit")}
            </button>
          </div>
          {!profile.notes && !profile.allergies && profile.tags.length === 0 ? (
            <p className="text-xs text-slate-400">{t("customer360.no_notes", "Add preferences, allergies or tags so every shift knows this guest.")}</p>
          ) : (
            <div className="space-y-2 text-xs">
              {profile.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {profile.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold">#{tag}</span>
                  ))}
                </div>
              )}
              {profile.allergies && <p className="text-rose-700 dark:text-rose-300 font-bold">⚠ {profile.allergies}</p>}
              {profile.notes && <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line break-words">{profile.notes}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Bills ──────────────────────────────────────────────── */

function BillsTab({ phone, init, money, t }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCustomerInvoices(phone, page, 10);
  const invoices = data?.invoices || [];
  const totalPages = data?.totalPages || 1;

  const printReceipt = async (invoice) => {
    try {
      toast.loading(t("invoices.please_wait", "Please wait..."));
      const res = await getInvoiceOrders(invoice.invoice_no, [invoice.order_id]);
      toast.dismiss();
      if (res.status !== 200) return;
      const { subtotal, taxTotal, serviceChargeTotal, discountType, discountValue, discountTotal, total, orders: ordersArr } = res.data;
      const cartItems = [];
      for (const o of ordersArr) {
        o.items.forEach((i) => {
          const variant = i.variant_id ? { id: i.variant_id, title: i.variant_title, price: i.variant_price } : null;
          cartItems.push({ ...i, title: i.item_title, addons_ids: i?.addons?.length > 0 ? i.addons.map((a) => a.id) : [], variant });
        });
      }
      const first = ordersArr[0] || {};
      triggerPrintReceipt({
        cartItems,
        deliveryType: first.delivery_type,
        customerType: first.customer_type,
        customer: { id: first.customer_id, name: first.customer_name },
        tableId: null,
        currency: init.currency,
        storeSettings: init.storeSettings,
        printSettings: init.printSettings,
        itemsTotal: subtotal,
        discountType,
        discountValue,
        discountAmount: discountTotal || 0,
        taxTotal,
        serviceChargeTotal,
        payableTotal: total,
        tokenNo: invoice.token_no,
        orderId: invoice.order_id,
        paymentMethod: invoice.payment_type,
      });
    } catch (error) {
      toast.dismiss();
      toast.error(error?.response?.data?.message || t("invoices.error_processing_request", "Could not load the receipt"));
    }
  };

  return (
    <div className={card}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <th className="py-2 px-3">{t("customer360.bill_no", "Bill #")}</th>
              <th className="py-2 px-3">{t("customer360.date", "Date")}</th>
              <th className="py-2 px-3">{t("customer360.order_type", "Order type")}</th>
              <th className="py-2 px-3">{t("customer360.payment", "Payment")}</th>
              <th className="py-2 px-3">{t("customer360.status", "Status")}</th>
              <th className="py-2 px-3 text-right">{t("customer360.total", "Total")}</th>
              <th className="py-2 px-3 text-right">{t("customer360.receipt", "Receipt")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading ? (
              <tr><td colSpan="7" className="text-center py-8 text-slate-400">…</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-8 text-slate-400">{t("customer360.no_bills", "No bills yet.")}</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={`${inv.invoice_no}-${inv.order_id}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="py-2 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">#{inv.invoice_no}</td>
                  <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{fmtDateTime(inv.created_at)}</td>
                  <td className="py-2 px-3 capitalize">{inv.order_type || "—"}</td>
                  <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{inv.payment_type || "—"}</td>
                  <td className="py-2 px-3">
                    <span
                      className={clsx("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono", {
                        "bg-rose-500/15 text-rose-700 dark:text-rose-300": inv.invoice_status === "VOID" || inv.status === "cancelled",
                        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300": inv.invoice_status !== "VOID" && inv.status === "completed",
                        "bg-amber-500/15 text-amber-700 dark:text-amber-300": inv.invoice_status !== "VOID" && inv.status === "created",
                      })}
                    >
                      {inv.invoice_status === "VOID" ? "void" : inv.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-bold font-mono text-slate-900 dark:text-white">{money(inv.total)}</td>
                  <td className="py-2 px-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => printReceipt(inv)} title={t("customer360.view_receipt", "View receipt")} className="w-[42px] h-[42px] rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 text-slate-500 cursor-pointer">
                        <IconEye size={17} stroke={iconStroke} />
                      </button>
                      <button type="button" onClick={() => printReceipt(inv)} title={t("customer360.print_receipt", "Print receipt")} className="w-[42px] h-[42px] rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 text-slate-500 cursor-pointer">
                        <IconPrinter size={17} stroke={iconStroke} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
        <span>{t("customer360.page_of", "Page {{page}} of {{total}}", { page, total: totalPages })}</span>
        <div className="flex gap-1.5">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={clsx(touchBtn, "border border-slate-200 dark:border-slate-700")}>
            {t("customer360.prev", "Prev")}
          </button>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className={clsx(touchBtn, "border border-slate-200 dark:border-slate-700")}>
            {t("customer360.next", "Next")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Loyalty ────────────────────────────────────────────── */

const LOYALTY_STYLES = {
  EARNED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  REDEEMED: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  VOID_REVERSAL: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  MANUAL_ADJUSTMENT: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
};

function LoyaltyTab({ phone, loyalty, t, onAdjust }) {
  const { transactions = [], isLoading } = useCustomerLoyaltyHistory(phone, { page: 1, limit: 50 });
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-xs text-slate-500">
          {t("customer360.points_summary", "{{balance}} pts available • {{lifetime}} earned lifetime • tier {{tier}}", {
            balance: loyalty.points_balance,
            lifetime: loyalty.lifetime_points_earned,
            tier: loyalty.membership_tier,
          })}
        </p>
        <button type="button" onClick={onAdjust} className={clsx(touchBtn, "border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200")}>
          <IconAward size={16} />
          {t("customer360.adjust_points", "Adjust points")}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <th className="py-2 px-3">{t("customer360.date", "Date")}</th>
              <th className="py-2 px-3">{t("customer360.type", "Type")}</th>
              <th className="py-2 px-3">{t("customer360.points_col", "Points")}</th>
              <th className="py-2 px-3">{t("customer360.balance_after", "Balance after")}</th>
              <th className="py-2 px-3">{t("customer360.note", "Note")}</th>
              <th className="py-2 px-3">{t("customer360.staff", "Staff")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading ? (
              <tr><td colSpan="6" className="text-center py-8 text-slate-400">…</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-8 text-slate-400">{t("customer360.no_loyalty", "No loyalty activity yet.")}</td></tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{fmtDateTime(tx.created_at)}</td>
                  <td className="py-2 px-3">
                    <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-black uppercase font-mono", LOYALTY_STYLES[tx.transaction_type])}>
                      {tx.transaction_type.replace("_", " ")}
                    </span>
                  </td>
                  <td className={clsx("py-2 px-3 font-mono font-black", tx.points > 0 ? "text-emerald-600" : "text-amber-600")}>
                    {tx.points > 0 ? `+${tx.points}` : tx.points}
                  </td>
                  <td className="py-2 px-3 font-mono font-bold">{tx.balance_after}</td>
                  <td className="py-2 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">{tx.notes || (tx.invoice_id ? `#${tx.invoice_id}` : "—")}</td>
                  <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{tx.created_by_user_id || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Dues ───────────────────────────────────────────────── */

function DuesTab({ credit, money, t, onManage, onCollect }) {
  return (
    <div className={card}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          [t("customer360.balance_due", "Balance due"), money(credit.outstanding), credit.outstanding > 0 ? "text-amber-600" : ""],
          [t("customer360.overdue", "Overdue"), money(credit.overdue), credit.overdue > 0 ? "text-rose-600" : ""],
          [t("customer360.credit_limit", "Credit limit"), credit.credit_limit === null ? t("customer360.no_limit", "No credit limit") : money(credit.credit_limit), ""],
          [t("customer360.next_due", "Next due date"), credit.next_due_date || "—", ""],
        ].map(([label, value, tone]) => (
          <div key={label} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
            <p className={clsx("text-lg font-bold font-mono mt-1", tone)}>{value}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-3">
        {credit.open_bills > 0
          ? t("customer360.open_bills_since", "{{n}} unpaid bill(s), oldest from {{date}}.", { n: credit.open_bills, date: fmtDate(credit.oldest_open) })
          : t("customer360.nothing_owed", "Nothing owed. Bills put on Pay Later show up here.")}
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        <button type="button" disabled={!(credit.outstanding > 0)} onClick={onCollect} className={clsx(touchBtn, "bg-emerald-600 hover:bg-emerald-700 text-white")}>
          <IconCash size={16} />
          {t("customer360.collect_payment", "Collect payment")}
        </button>
        <button type="button" onClick={onManage} className={clsx(touchBtn, "border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800")}>
          <IconClockDollar size={16} />
          {t("customer360.manage_dues", "Open bills, history & credit limit")}
        </button>
      </div>
    </div>
  );
}

/* ─── Reservations ───────────────────────────────────────── */

function ReservationsTab({ reservations, t }) {
  const statusLabel = (s) => t(`customer360.res_${s}`, s.replace("_", " "));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {Object.entries(reservations.by_status).map(([status, count]) => (
          <span key={status} className={clsx("px-3 py-1.5 rounded-xl text-xs font-bold capitalize", RESERVATION_STYLES[status] || "bg-slate-100")}>
            {statusLabel(status)}: {count}
          </span>
        ))}
      </div>
      {reservations.upcoming.length > 0 && (
        <div className={clsx(card, "border-sky-500/30 bg-sky-500/5")}>
          <h3 className="text-sm font-bold mb-2">{t("customer360.upcoming", "Upcoming")}</h3>
          {reservations.upcoming.map((r) => (
            <p key={r.id} className="text-xs">
              <strong>{fmtDateTime(r.date)}</strong> • {r.people_count} {t("customer360.guests", "Guests")}
              {r.table_title ? ` • ${r.table_title}` : ""}
              {r.notes ? ` — ${r.notes}` : ""}
            </p>
          ))}
        </div>
      )}
      <div className={card}>
        {reservations.recent.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">{t("customer360.no_reservations", "No reservations.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2 px-3">{t("customer360.date", "Date")}</th>
                  <th className="py-2 px-3">{t("customer360.guests", "Guests")}</th>
                  <th className="py-2 px-3">{t("customer360.table", "Table")}</th>
                  <th className="py-2 px-3">{t("customer360.status", "Status")}</th>
                  <th className="py-2 px-3">{t("customer360.note", "Note")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {reservations.recent.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 px-3 font-mono text-[11px]">{fmtDateTime(r.date)}</td>
                    <td className="py-2 px-3">{r.people_count}</td>
                    <td className="py-2 px-3">{r.table_title || "—"}</td>
                    <td className="py-2 px-3">
                      <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", RESERVATION_STYLES[r.status])}>{statusLabel(r.status)}</span>
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Feedback ───────────────────────────────────────────── */

function Stars({ value }) {
  const v = Math.round(Number(value || 0));
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <IconStar key={i} size={13} className={i <= v ? "text-amber-400 fill-amber-400" : "text-slate-300 dark:text-slate-600"} />
      ))}
    </span>
  );
}

function FeedbackTab({ feedback, t }) {
  if (!feedback.count) {
    return <div className={clsx(card, "text-center text-xs text-slate-400 py-8")}>{t("customer360.no_feedback", "This customer has not left feedback yet.")}</div>;
  }
  const dims = [
    ["food", t("customer360.fb_food", "Food")],
    ["service", t("customer360.fb_service", "Service")],
    ["staff", t("customer360.fb_staff", "Staff")],
    ["ambiance", t("customer360.fb_ambiance", "Ambiance")],
    ["recommend", t("customer360.fb_recommend", "Would recommend")],
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div className={card}>
        <p className="text-[10px] font-bold uppercase text-slate-500">{t("customer360.avg_rating", "Average rating")}</p>
        <p className="text-3xl font-black font-mono mt-1">{feedback.average?.toFixed(1) ?? "—"}</p>
        <Stars value={feedback.average} />
        <p className="text-[11px] text-slate-500 mt-1">{t("customer360.reviews", "{{n}} review(s)", { n: feedback.count })}</p>
        <div className="mt-3 space-y-1.5">
          {dims.map(([k, label]) => (
            <div key={k} className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">{label}</span>
              <span className="flex items-center gap-1.5">
                <Stars value={feedback[k]} />
                <span className="font-mono w-6 text-right">{feedback[k]?.toFixed(1) ?? "—"}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className={clsx(card, "lg:col-span-2 space-y-2")}>
        {feedback.recent.map((f) => (
          <div key={f.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <Stars value={f.average_rating} />
              <span className="text-[11px] text-slate-500 font-mono">
                {fmtDateTime(f.date)}
                {f.invoice_id ? ` • #${f.invoice_id}` : ""}
              </span>
            </div>
            {f.remarks && <p className="text-xs text-slate-700 dark:text-slate-300 mt-1.5 whitespace-pre-line">{f.remarks}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Timeline ───────────────────────────────────────────── */

function TimelineTab({ timeline, money, t }) {
  const describe = (e) => {
    switch (e.type) {
      case "bill":
        return {
          icon: IconReceipt,
          tone: "bg-emerald-500",
          title: t("customer360.ev_bill", "Bill #{{ref}} — {{amount}}", { ref: e.ref, amount: money(e.amount) }),
          sub: [e.detail.channel, e.detail.item_count ? `${e.detail.item_count} ${t("customer360.items", "items")}` : null, e.detail.payment_type, e.detail.payment_status && e.detail.payment_status !== "paid" ? t(`customer360.pay_${e.detail.payment_status}`, e.detail.payment_status) : null, e.detail.by]
            .filter(Boolean)
            .join(" • "),
        };
      case "bill_void":
        return { icon: IconReceiptOff, tone: "bg-rose-500", title: t("customer360.ev_void", "Bill #{{ref}} voided ({{amount}})", { ref: e.ref, amount: money(e.amount) }), sub: e.detail.by };
      case "due_payment":
        return { icon: IconCash, tone: "bg-teal-500", title: t("customer360.ev_due_payment", "Paid {{amount}} towards dues", { amount: money(e.amount) }), sub: [e.detail.payment_type, e.detail.note, e.detail.by].filter(Boolean).join(" • ") };
      case "reservation":
        return {
          icon: IconCalendarEvent,
          tone: "bg-sky-500",
          title: t("customer360.ev_reservation", "Reservation for {{n}} ({{status}})", { n: e.detail.people, status: t(`customer360.res_${e.detail.status}`, e.detail.status) }),
          sub: [e.detail.table, e.detail.note].filter(Boolean).join(" • "),
        };
      case "feedback":
        return { icon: IconMessageStar, tone: "bg-amber-500", title: t("customer360.ev_feedback", "Left feedback — {{rating}}/5", { rating: e.rating ?? "—" }), sub: e.detail.remarks };
      case "joined":
        return { icon: IconUserPlus, tone: "bg-violet-500", title: t("customer360.ev_joined", "Became a customer"), sub: "" };
      default:
        if (e.type.startsWith("loyalty_")) {
          return {
            icon: IconAward,
            tone: "bg-amber-500",
            title: t("customer360.ev_loyalty", "{{points}} points ({{kind}})", { points: e.points > 0 ? `+${e.points}` : e.points, kind: e.type.replace("loyalty_", "").replace("_", " ") }),
            sub: [e.detail.note, e.detail.by].filter(Boolean).join(" • "),
          };
        }
        return { icon: IconHistory, tone: "bg-slate-400", title: e.type, sub: "" };
    }
  };

  if (timeline.length === 0) return <div className={clsx(card, "text-center text-xs text-slate-400 py-8")}>—</div>;

  return (
    <div className={card}>
      <ol className="relative border-s border-slate-200 dark:border-slate-800 ms-3">
        {timeline.map((e, idx) => {
          const d = describe(e);
          const Icon = d.icon;
          return (
            <li key={`${e.type}-${e.ref}-${idx}`} className="ms-6 pb-4 last:pb-0">
              <span className={clsx("absolute -start-3 flex items-center justify-center w-6 h-6 rounded-full text-white ring-4 ring-white dark:ring-slate-900", d.tone)}>
                <Icon size={13} />
              </span>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{d.title}</p>
                <time className="text-[11px] text-slate-400 font-mono">{fmtDateTime(e.at)}</time>
              </div>
              {d.sub && <p className="text-[11px] text-slate-500 mt-0.5 break-words">{d.sub}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ─── Modals ─────────────────────────────────────────────── */

function Modal({ title, icon: Icon, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Icon size={18} className="text-amber-500" />
            {title}
          </h3>
          <button type="button" onClick={onClose} className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 cursor-pointer">
            <IconX size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">{children}</div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-800">{footer}</div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none";

function NotesModal({ profile, t, onClose, onSaved }) {
  const [notes, setNotes] = useState(profile.notes || "");
  const [allergies, setAllergies] = useState(profile.allergies || "");
  const [tags, setTags] = useState(profile.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);

  const suggestions = useMemo(() => TAG_SUGGESTIONS.filter((s) => !tags.includes(s)), [tags]);
  const addTag = (value) => {
    const v = String(value || "").trim().slice(0, 30);
    if (!v || tags.includes(v) || tags.length >= 12) return;
    setTags([...tags, v]);
    setTagInput("");
  };

  const save = async () => {
    try {
      setBusy(true);
      const pending = tagInput.trim() && !tags.includes(tagInput.trim()) ? [...tags, tagInput.trim()] : tags;
      await saveCustomerProfileNotes(profile.phone, { notes, allergies, tags: pending });
      toast.success(t("customer360.notes_saved", "Customer notes saved"));
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.message || t("customer360.notes_failed", "Could not save notes"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t("customer360.notes_tags", "Notes & tags")}
      icon={IconNotes}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={clsx(touchBtn, "text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800")}>
            {t("common.cancel", "Cancel")}
          </button>
          <button type="button" disabled={busy} onClick={save} className={clsx(touchBtn, "px-5 bg-amber-500 hover:bg-amber-600 text-white")}>
            <IconCheck size={16} />
            {busy ? t("customer360.saving", "Saving...") : t("common.save", "Save")}
          </button>
        </>
      }
    >
      <div>
        <label className="text-xs font-bold uppercase text-rose-600 block mb-1">{t("customer360.allergies", "Allergies / dietary")}</label>
        <input
          className={clsx(inputCls, "focus:ring-rose-500")}
          maxLength={500}
          value={allergies}
          placeholder={t("customer360.allergies_placeholder", "e.g. Peanuts, shellfish — shown to cashiers at the POS")}
          onChange={(e) => setAllergies(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">{t("customer360.staff_notes", "Staff notes")}</label>
        <textarea
          className={clsx(inputCls, "py-2.5 min-h-[110px]")}
          maxLength={2000}
          value={notes}
          placeholder={t("customer360.notes_placeholder", "Preferences, favourite table, how they like their coffee…")}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
          <IconTag size={13} className="inline -mt-0.5" /> {t("customer360.tags", "Tags")}
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setTags(tags.filter((x) => x !== tag))}
              className="min-h-[36px] px-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1 active:scale-95 cursor-pointer"
            >
              #{tag} <IconX size={12} />
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addTag(tagInput);
          }}
        >
          <input className={inputCls} maxLength={30} value={tagInput} placeholder={t("customer360.add_tag", "Add a tag")} onChange={(e) => setTagInput(e.target.value)} />
          <button type="submit" className={clsx(touchBtn, "w-[44px] justify-center px-0 bg-slate-100 dark:bg-slate-800")}>
            <IconPlus size={16} />
          </button>
        </form>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addTag(s)}
                className="min-h-[36px] px-3 rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 cursor-pointer"
              >
                + {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function AdjustPointsModal({ profile, balance, t, onClose, onSaved }) {
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const value = parseInt(points, 10);

  const save = async () => {
    try {
      setBusy(true);
      await adjustCustomerPoints(profile.phone, value, note);
      toast.success(t("customer360.points_adjusted", "Points adjusted"));
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || t("customer360.points_failed", "Could not adjust points"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t("customer360.adjust_points", "Adjust points")}
      icon={IconAward}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={clsx(touchBtn, "text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800")}>
            {t("common.cancel", "Cancel")}
          </button>
          <button type="button" disabled={busy || !value} onClick={save} className={clsx(touchBtn, "px-5 bg-amber-500 hover:bg-amber-600 text-white")}>
            <IconCheck size={16} />
            {busy ? t("customer360.saving", "Saving...") : t("customer360.apply", "Apply")}
          </button>
        </>
      }
    >
      <p className="text-xs text-slate-500">
        {t("customer360.adjust_help", "Credit (+) or deduct (−) points for {{name}}. Current balance: {{balance}} pts.", { name: profile.name, balance })}
      </p>
      <input type="number" step="1" autoFocus className={clsx(inputCls, "font-mono")} placeholder="+50 / -20" value={points} onChange={(e) => setPoints(e.target.value)} />
      <input className={inputCls} placeholder={t("customer360.adjust_reason", "Reason (e.g. birthday bonus, service recovery)")} value={note} onChange={(e) => setNote(e.target.value)} />
    </Modal>
  );
}
