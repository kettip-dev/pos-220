import React, { useEffect, useState } from "react";
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
    hour < 5 ? "Late night"
    : hour < 12 ? "Good morning"
    : hour < 17 ? "Good afternoon"
    : hour < 21 ? "Good evening"
    : "Good night";

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

import Chart from "react-apexcharts";
import { CURRENCIES } from "../../config/currencies.config";
import { ContextLoading } from "../system/EmptyContext";

export function SalesGoalWidget({ config = {}, context }) {
  if (!context || context.isLoading || !context.data) return <ContextLoading />;
  const target = Number(config.target || 10000);
  const today = Number(context.data?.todayRevenue?.total_revenue || 0);
  const pct = target > 0 ? Math.min(100, (today / target) * 100) : 0;

  const code = context.data?.currency;
  const sym = CURRENCIES.find((c) => c.cc === code)?.symbol || "";

  const options = {
    chart: { type: "radialBar", sparkline: { enabled: true } },
    plotOptions: {
      radialBar: {
        startAngle: -130,
        endAngle: 130,
        hollow: { size: "62%" },
        track: { background: "rgba(156,163,175,0.18)", strokeWidth: "100%" },
        dataLabels: {
          name: { show: true, color: "#9ca3af", fontFamily: "Nunito", fontSize: "11px", offsetY: 10 },
          value: {
            color: "#70B56A",
            fontFamily: "Nunito",
            fontWeight: 800,
            fontSize: "26px",
            offsetY: -22,
            formatter: () => `${pct.toFixed(0)}%`,
          },
        },
      },
    },
    fill: { type: "solid", colors: [pct >= 100 ? "#22c55e" : "#70B56A"] },
    stroke: { lineCap: "round" },
    labels: ["of daily goal"],
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1">
        <Chart options={options} series={[Math.round(pct)]} type="radialBar" height="100%" />
      </div>
      <div className="text-center">
        <p className="text-xs text-restro-text">
          <span className="font-bold text-foreground">{sym}{today.toLocaleString()}</span>
          {" / "}
          <span>{sym}{target.toLocaleString()}</span>
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Welcome / Greeting Banner
   ─────────────────────────────────────────────────────────────── */

export function WelcomeBannerWidget({ context }) {
  const userName = context?.user?.name || "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning"
    : hour < 17 ? "Good afternoon"
    : "Good evening";

  return (
    <div className="flex h-full flex-col justify-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-restro-text">
        {greeting}
      </p>
      <h2 className="mt-1 text-2xl font-extrabold text-foreground">
        Welcome back, {userName} 👋
      </h2>
      <p className="mt-1 text-sm text-restro-text">
        Here's what's happening at your restaurant today.
      </p>
    </div>
  );
}

export const ICONS = { IconBolt, IconNote, IconClock, IconTarget };
