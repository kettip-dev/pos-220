import React from "react";
import { useTranslation } from "react-i18next";
import { IconRefresh, IconList, IconDots, IconLayoutSidebarRight, IconLayoutSidebarRightCollapse } from "@tabler/icons-react";

export default function BindoBottomBar({
  metrics = {
    seated: 0,
    ordered: 0,
    ck_dropped: 0,
    paid: 0,
    unsent: 0,
    alert: 0,
    over_time: 0,
    reserved: 0,
    multiple: 0,
    available: 0,
    blocked: 0,
    total_pax: 0,
  },
  activeFilter = null,
  onSelectFilter = () => {},
  onRefresh = () => {},
  isRefreshing = false,
  isDrawerOpen = true,
  onToggleDrawer = () => {},
  onOpenOptionsMenu = () => {},
}) {
  const { t } = useTranslation();

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());

  const statusChips = [
    { key: "seated", label: t("tables.seated", "SEATED"), count: metrics.seated, bg: "bg-[#0ea5e9]", text: "text-white" },
    { key: "ordered", label: t("tables.ordered", "ORDERED"), count: metrics.ordered, bg: "bg-[#1e293b]", text: "text-white" },
    { key: "ck_dropped", label: t("tables.ck_dropped", "CK DROPPED"), count: metrics.ck_dropped, bg: "bg-[#f97316]", text: "text-white" },
    { key: "paid", label: t("tables.paid", "PAID"), count: metrics.paid, bg: "bg-[#4ade80]", text: "text-[#064e3b]" },
    { key: "unsent", label: t("tables.unsent_items", "UNSENT ITEMS"), count: metrics.unsent, bg: "bg-[#facc15]", text: "text-[#713f12]" },
    { key: "alert", label: t("tables.alert", "ALERT"), count: metrics.alert, bg: "bg-[#d946ef]", text: "text-white" },
    { key: "over_time", label: t("tables.over_time", "OVER TIME"), count: metrics.over_time, bg: "bg-[#f87171]", text: "text-white" },
    { key: "reserved", label: t("tables.reserved", "RESERVED"), count: metrics.reserved, bg: "bg-[#c084fc]", text: "text-white" },
    { key: "multiple", label: t("tables.multiple", "MULTIPLE"), count: metrics.multiple, bg: "bg-[#f472b6]", text: "text-white" },
    { key: "available", label: t("tables.available", "AVAILABLE"), count: metrics.available, bg: "bg-[#475569]", text: "text-white" },
    { key: "blocked", label: t("tables.blocked", "BLOCKED"), count: metrics.blocked, bg: "bg-[#94a3b8]", text: "text-white" },
    { key: "pax", label: t("tables.pax", "PAX"), count: metrics.total_pax, bg: "bg-[#334155]", text: "text-white" },
  ];

  return (
    <footer className="flex items-center justify-between gap-2 px-3 py-2 bg-[#0f172a] text-white border-t border-slate-800 shadow-2xl shrink-0 select-none z-20">
      {/* Left: Date / Shift Pill */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 shrink-0">
        <span className="text-xs font-bold text-slate-200 whitespace-nowrap">
          {t("tables.today", "Today")} - {formattedDate}
        </span>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30 animate-pulse" />
      </div>

      {/* Center: Scrollable Live Status KPI Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-1">
        {statusChips.map((chip) => {
          const isSelected = activeFilter === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => onSelectFilter(isSelected ? null : chip.key)}
              className={`flex flex-col items-center justify-center min-w-[54px] px-2 py-1 rounded-lg text-center transition-all cursor-pointer ${
                chip.bg
              } ${chip.text} ${
                isSelected
                  ? "ring-2 ring-white scale-105 shadow-md brightness-110"
                  : activeFilter
                  ? "opacity-40 hover:opacity-100"
                  : "hover:scale-102 hover:brightness-105"
              }`}
            >
              <span className="text-xs font-black leading-none">{chip.count}</span>
              <span className="text-[8px] font-bold tracking-tighter uppercase whitespace-nowrap leading-tight opacity-90 mt-0.5">
                {chip.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right: Quick Tool Buttons (Refresh, Drawer Toggle, Menu) */}
      <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-slate-800">
        <button
          type="button"
          onClick={onRefresh}
          title={t("common.refresh", "Refresh Live Status")}
          className={`p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ${
            isRefreshing ? "animate-spin text-cyan-400" : ""
          }`}
        >
          <IconRefresh size={18} />
        </button>

        <button
          type="button"
          onClick={onToggleDrawer}
          title={isDrawerOpen ? t("tables.close_sidebar", "Close Sidebar") : t("tables.open_sidebar", "Open Sidebar")}
          className={`p-2 rounded-xl transition cursor-pointer ${
            isDrawerOpen
              ? "bg-[#0ea5e9] text-white shadow-xs"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <IconList size={18} />
        </button>

        <button
          type="button"
          onClick={onOpenOptionsMenu}
          title={t("common.options", "Options")}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <IconDots size={18} />
        </button>
      </div>
    </footer>
  );
}
