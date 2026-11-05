import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  IconBolt,
  IconShoppingBag,
  IconChefHat,
  IconCalendarEvent,
  IconUsers,
  IconReceipt2,
  IconChartBar,
  IconNote,
  IconClock,
  IconTarget,
  IconBox,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";

/* ─────────────────────────────────────────────────────────────────
   Quick Action Launcher
   - User-configurable buttons that route to common pages.
   ─────────────────────────────────────────────────────────────── */

const ACTION_LIBRARY = {
  pos:         { label: "Open POS",        icon: IconShoppingBag,   to: "/dashboard/pos",         color: "#70B56A" },
  kitchen:     { label: "Kitchen",         icon: IconChefHat,       to: "/dashboard/kitchen",     color: "#F97316" },
  orders:      { label: "Orders",          icon: IconReceipt2,      to: "/dashboard/orders",      color: "#4ECDC4" },
  reservation: { label: "Reservations",    icon: IconCalendarEvent, to: "/dashboard/reservation", color: "#A78BFA" },
  customers:   { label: "Customers",       icon: IconUsers,         to: "/dashboard/customers",   color: "#06B6D4" },
  reports:     { label: "Reports",         icon: IconChartBar,      to: "/dashboard/reports",     color: "#EC4899" },
  inventory:   { label: "Inventory",       icon: IconBox,           to: "/dashboard/inventory",   color: "#F59E0B" },
};

export function QuickActionsWidget({ config = {} }) {
  const keys = Array.isArray(config.actions) && config.actions.length
    ? config.actions
    : ["pos", "kitchen", "orders", "reservation"];

  return (
    <div className="grid h-full grid-cols-2 gap-3 content-start">
      {keys.map((k) => {
        const a = ACTION_LIBRARY[k];
        if (!a) return null;
        const Icon = a.icon;
        return (
          <Link
            key={k}
            to={a.to}
            className="group flex flex-col items-center justify-center gap-1.5 rounded-xl border border-restro-border-green bg-background py-4 transition hover:-translate-y-0.5 hover:shadow-md active:scale-95"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
              style={{ backgroundColor: `${a.color}18`, color: a.color }}
            >
              <Icon size={20} stroke={iconStroke} />
            </span>
            <span className="text-xs font-bold text-foreground">{a.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Sticky Notes — local-only (per browser) jotting space.
   ─────────────────────────────────────────────────────────────── */

export function NotesWidget({ itemId }) {
  const storageKey = `dashboard.notes.${itemId || "default"}`;
  const [text, setText] = useState("");

  useEffect(() => {
    try {
      setText(localStorage.getItem(storageKey) || "");
    } catch {}
  }, [storageKey]);

  const onChange = (e) => {
    const v = e.target.value;
    setText(v);
    try { localStorage.setItem(storageKey, v); } catch {}
  };

  return (
    <textarea
      value={text}
      onChange={onChange}
      placeholder="Jot a note for your team…"
      className="h-full w-full resize-none rounded-xl border border-restro-border-green bg-amber-50/40 dark:bg-amber-950/10 p-3 text-sm text-foreground placeholder:text-restro-text focus:outline-none focus:ring-2 focus:ring-restro-green/30"
    />
  );
}

/* ─────────────────────────────────────────────────────────────────
   Clock & Greeting
   ─────────────────────────────────────────────────────────────── */

export function ClockWidget() {
  const { t } = useTranslation();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const hour = now.getHours();
  const greeting =
    hour < 5 ? t("dashboard.late_night", "Late night")
    : hour < 12 ? t("dashboard.good_morning", "Good morning")
    : hour < 17 ? t("dashboard.good_afternoon", "Good afternoon")
    : hour < 21 ? t("dashboard.good_evening", "Good evening")
    : t("dashboard.good_night", "Good night");

  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-restro-text">
        {greeting}
      </p>
      <p className="mt-1 text-4xl font-extrabold tabular-nums text-foreground">
        {time}
      </p>
      <p className="mt-1 text-xs text-restro-text">{date}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Sales Goal Gauge — compares todayRevenue to a configurable target.
   ─────────────────────────────────────────────────────────────── */

import { AutoSizeChart } from "../../components/DashboardWidgets";
import { CURRENCIES } from "../../config/currencies.config";
import { ContextLoading } from "../system/EmptyContext";

export function SalesGoalWidget({ config = {}, context }) {
  const { t } = useTranslation();
  if (!context || context.isLoading || !context.data) return <ContextLoading />;
  const target = Number(config.target || 10000);
  const today = Number(context.data?.todayRevenue?.total_revenue || 0);
  const rawPct = target > 0 ? (today / target) * 100 : 0;
  const pct = Math.min(100, rawPct);
  const reached = rawPct >= 100;
  const remaining = Math.max(0, target - today);

  const code = context.data?.currency;
  const sym = CURRENCIES.find((c) => c.cc === code)?.symbol || "";
  const money = (v) => `${sym}${Math.round(v).toLocaleString()}`;
  const color = reached ? "#16A34A" : "#2CA01C";

  const options = {
    chart: { type: "radialBar", sparkline: { enabled: true } },
    plotOptions: {
      radialBar: {
        startAngle: -120,
        endAngle: 120,
        hollow: { size: "66%" },
        track: { background: "rgba(156,163,175,0.18)", strokeWidth: "100%" },
        dataLabels: { show: false },
      },
    },
    fill: { type: "solid", colors: [color] },
    // A round cap on a 0-length arc renders as a lone dot — use a butt cap
    // until there is real progress to show.
    stroke: { lineCap: pct > 0 ? "round" : "butt" },
    states: { hover: { filter: { type: "none" } }, active: { filter: { type: "none" } } },
  };

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <AutoSizeChart className="h-full w-full" options={options} series={[Math.round(pct * 10) / 10]} type="radialBar" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-3xl font-extrabold leading-none tabular-nums" style={{ color: pct > 0 ? color : undefined }}>
            {rawPct >= 10 || rawPct === 0 ? Math.round(rawPct) : rawPct.toFixed(1)}%
          </p>
          <p className="mt-1 text-[11px] font-semibold text-restro-text">{t("widgets.of_daily_goal", "of daily goal")}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-restro-bg-gray px-3 py-2 text-xs">
        <div className="min-w-0">
          <p className="text-[11px] text-restro-text">{t("widgets.sold_today", "Sold today")}</p>
          <p data-sensitive className="truncate font-bold tabular-nums text-foreground">{money(today)}</p>
        </div>
        <div className="min-w-0 text-right">
          {reached ? (
            <>
              <p className="text-[11px] text-restro-text">{t("widgets.goal", "Goal")} {money(target)}</p>
              <p className="font-bold text-emerald-600 dark:text-emerald-400">{t("widgets.goal_reached", "Goal reached 🎉")}</p>
            </>
          ) : (
            <>
              <p className="text-[11px] text-restro-text">{t("widgets.to_go", "To go")}</p>
              <p data-sensitive className="truncate font-bold tabular-nums text-foreground">{money(remaining)}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Welcome / Greeting Banner
   ─────────────────────────────────────────────────────────────── */

export function WelcomeBannerWidget({ context }) {
  const { t } = useTranslation();
  const userName = context?.user?.name || "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("dashboard.good_morning", "Good morning")
    : hour < 17 ? t("dashboard.good_afternoon", "Good afternoon")
    : t("dashboard.good_evening", "Good evening");

  return (
    <div className="flex h-full flex-col justify-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-restro-text">
        {greeting}
      </p>
      <h2 className="mt-1 text-2xl font-extrabold text-foreground">
        {t("dashboard.welcome_back", "Welcome back, {{name}} ", { name: userName })}
      </h2>
      <p className="mt-1 text-sm text-restro-text">
        {t("dashboard.happening_today", "Here's what's happening at your restaurant today.")}
      </p>
    </div>
  );
}

export const ICONS = { IconBolt, IconNote, IconClock, IconTarget };
