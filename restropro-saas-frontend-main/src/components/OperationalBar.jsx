import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  IconArmchair,
  IconDeviceIpadHorizontal,
  IconChefHat,
  IconCalendarEvent,
  IconToolsKitchen3,
  IconSearch,
  IconLayoutDashboard,
  IconBuildingStore,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import AppBarDropdown from "./AppBarDropdown";
import { showSearchModal } from "./SearchModal";
import clsx from "clsx";

export default function OperationalBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUserDetailsInLocalStorage();

  const operationalNavTabs = [
    {
      id: "tables",
      label: t("navbar.tables", "Floor Plan"),
      icon: <IconArmchair size={18} stroke={iconStroke} />,
      path: "/dashboard/tables",
    },
    {
      id: "pos",
      label: t("navbar.pos", "Register"),
      icon: <IconDeviceIpadHorizontal size={18} stroke={iconStroke} />,
      path: "/dashboard/pos",
    },
    {
      id: "kitchen",
      label: t("navbar.kitchen", "Kitchen KDS"),
      icon: <IconChefHat size={18} stroke={iconStroke} />,
      path: "/dashboard/kitchen",
    },
    {
      id: "orders",
      label: t("navbar.orders", "Orders"),
      icon: <IconToolsKitchen3 size={18} stroke={iconStroke} />,
      path: "/dashboard/orders",
    },
    {
      id: "reservation",
      label: t("navbar.reservation", "Reservations"),
      icon: <IconCalendarEvent size={18} stroke={iconStroke} />,
      path: "/dashboard/reservation",
    },
  ];

  const isTabActive = (itemPath) => {
    return location.pathname.startsWith(itemPath);
  };

  return (
    <header className="w-full h-13 bg-[#0D233A] dark:bg-[#081426] border-b border-[#1C3550] dark:border-[#1E293B] px-3 sm:px-4 flex items-center justify-between gap-3 text-white select-none z-50 shrink-0 sticky top-0 shadow-sm">
      {/* Left: Brand Identity & Quick Store Indicator */}
      <div className="flex items-center gap-3 shrink-0">
        <Link
          to="/dashboard/home"
          title={t("navbar.dashboard", "Back to Backoffice")}
          className="flex items-center gap-2 group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-[#2CA01C] flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition">
            <IconBuildingStore size={19} stroke={2.2} />
          </div>
          <div className="hidden lg:block text-left">
            <p className="font-bold text-xs tracking-wide text-white leading-tight">
              RestroPRO
            </p>
            <p className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase">
              Operational Mode
            </p>
          </div>
        </Link>
      </div>

      {/* Center: Fast 1-Tap Operational Mode Tabs */}
      <nav className="flex items-center gap-1 sm:gap-1.5 p-1 bg-[#091827] dark:bg-[#050D18] rounded-xl border border-[#1C3550]/70">
        {operationalNavTabs.map((tab) => {
          const active = isTabActive(tab.path);
          return (
            <Link
              key={tab.id}
              to={tab.path}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap",
                active
                  ? "bg-[#2CA01C] text-white shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              )}
            >
              {tab.icon}
              <span className="hidden md:inline">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right: Quick Search, Cashier Profile, and Exit to Backoffice Button */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Quick Search */}
        <button
          type="button"
          onClick={showSearchModal}
          title={`${t("appbar.search_placeholder", "Search")} (Cmd+K)`}
          className="w-8 h-8 hidden sm:flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer border border-white/10"
        >
          <IconSearch size={16} stroke={iconStroke} />
        </button>

        {/* Exit to Backoffice / Manager Dashboard Button */}
        <Link
          to="/dashboard/home"
          title={t("navbar.dashboard", "Back to Backoffice")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1C3550] hover:bg-[#23456C] text-slate-200 hover:text-white transition border border-[#2B4B70] shadow-2xs active:scale-95 cursor-pointer"
        >
          <IconLayoutDashboard size={15} stroke={iconStroke} className="text-emerald-400" />
          <span className="hidden sm:inline">{t("top_bar.exit_to_office", "Backoffice")}</span>
        </Link>

        {/* User Profile Avatar with dropdown */}
        <div className="relative">
          <AppBarDropdown isCollapsed={true} className="!w-9 !h-9 !p-0.5" />
        </div>
      </div>
    </header>
  );
}
