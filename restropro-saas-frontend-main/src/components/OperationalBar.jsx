import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  IconArmchair,
  IconDeviceIpadHorizontal,
  IconChefHat,
  IconCalendarEvent,
  IconToolsKitchen3,
  IconSearch,
  IconHome,
  IconBuildingStore,
  IconArrowBarToLeft,
  IconArrowBarToRight,
  IconSettings,
} from "@tabler/icons-react";
import AppBarDropdown from "./AppBarDropdown";
import { showSearchModal } from "./SearchModal";
import clsx from "clsx";
import { useStoreSettings } from "../controllers/settings.controller";
import { getImageURL } from "../helpers/ImageHelper";

export default function OperationalBar({ isCollapsed = false, onToggleCollapse }) {
  const { t } = useTranslation();
  const location = useLocation();

  const { data: storeSettingsData } = useStoreSettings();
  const storeLogo = storeSettingsData?.storeImage;
  const storeName = storeSettingsData?.storeName;

  const operationalNavTabs = [
    {
      id: "tables",
      shortLabel: t("navbar.tables_short", "Tables"),
      label: t("navbar.tables", "Floor Plan"),
      Icon: IconArmchair,
      path: "/dashboard/tables",
    },
    {
      id: "pos",
      shortLabel: t("navbar.pos_short", t("top_bar.pos", "POS")),
      label: t("navbar.pos", "Register (POS)"),
      Icon: IconDeviceIpadHorizontal,
      path: "/dashboard/pos",
    },
    {
      id: "kitchen",
      shortLabel: t("navbar.kitchen_short", "Kitchen"),
      label: t("navbar.kitchen", "Kitchen KDS"),
      Icon: IconChefHat,
      path: "/dashboard/kitchen",
    },
    {
      id: "orders",
      shortLabel: t("navbar.orders", "Orders"),
      label: t("navbar.orders", "Orders"),
      Icon: IconToolsKitchen3,
      path: "/dashboard/orders",
    },
    {
      id: "reservation",
      shortLabel: t("navbar.reserve_short", "Reserve"),
      label: t("navbar.reservation", "Reservations"),
      Icon: IconCalendarEvent,
      path: "/dashboard/reservation",
    },
  ];

  const isTabActive = (itemPath) => {
    return location.pathname.startsWith(itemPath);
  };

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={onToggleCollapse}
        title={t("navbar.expand_nav", "Open Left Navigation")}
        className="fixed left-0 bottom-4 z-50 h-10 pl-1.5 pr-2.5 rounded-r-full bg-[#0D233A] hover:bg-[#16385c] text-white border border-l-0 border-white/20 shadow-lg flex items-center gap-1.5 transition active:scale-95 cursor-pointer select-none"
      >
        <span className="w-6 h-6 rounded-full bg-[#2CA01C] flex items-center justify-center text-white shrink-0 overflow-hidden ring-1 ring-white/20">
          {storeLogo ? (
            <img src={getImageURL(storeLogo)} alt="Store Logo" className="w-full h-full object-cover" />
          ) : (
            <IconBuildingStore size={14} stroke={2.2} />
          )}
        </span>
        <IconArrowBarToRight size={15} stroke={2.2} className="text-white" />
      </button>
    );
  }

  return (
    <aside className="w-[68px] shrink-0 h-screen bg-white dark:bg-[#0B1522] border-r border-[#E3E5E8] dark:border-slate-800/90 flex flex-col items-center justify-between py-2 select-none z-50">
      {/* Center Scrollable Rail Items */}
      <div className="w-full flex flex-col items-center gap-1 overflow-y-auto no-scrollbar flex-1">

        {/* Home (Backoffice) Link with Store Logo */}
        <div className="w-full px-1">
          <Link
            to="/dashboard/home"
            title={storeName || t("navbar.home", "Home")}
            className="group relative w-full flex flex-col items-center gap-0.5 py-1.5 cursor-pointer"
          >
            <span className="w-8 h-8 rounded-full bg-[#2CA01C] flex items-center justify-center text-white overflow-hidden shadow-2xs ring-1 ring-black/5 dark:ring-white/10 group-hover:scale-105 transition-transform">
              {storeLogo ? (
                <img
                  src={getImageURL(storeLogo)}
                  alt={storeName || "Store Logo"}
                  className="w-full h-full object-cover"
                />
              ) : storeName ? (
                <span className="font-bold text-[11px] uppercase tracking-tight select-none">
                  {storeName.trim().slice(0, 2)}
                </span>
              ) : (
                <IconHome size={18} stroke={1.8} />
              )}
            </span>
            <span className="text-[10px] font-medium text-gray-600 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-white leading-tight truncate max-w-[60px] transition-colors">
              {storeName ? storeName.trim().slice(0, 8) : t("navbar.home", "Home")}
            </span>
          </Link>
        </div>

        {/* Operational Modules Section */}
        <div className="w-full pt-2 mt-0.5 border-t border-gray-200/80 dark:border-slate-800 flex flex-col items-center gap-1 px-1">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
            {t("navbar.pos_section", "POS")}
          </span>

          {operationalNavTabs.map((tab) => {
            const active = isTabActive(tab.path);
            const TabIcon = tab.Icon;
            return (
              <Link
                key={tab.id}
                to={tab.path}
                title={tab.label}
                className="group relative w-full flex flex-col items-center gap-0.5 py-1.5 cursor-pointer"
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#2CA01C] rounded-r-full" />
                )}
                <span
                  className={clsx(
                    "w-10 h-7 flex items-center justify-center transition-colors",
                    active
                      ? "text-[#2CA01C] dark:text-[#2CA01C]"
                      : "text-gray-500 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-white"
                  )}
                >
                  <TabIcon size={20} stroke={active ? 2.2 : 1.8} />
                </span>
                <span
                  className={clsx(
                    "text-[10px] leading-tight truncate max-w-[62px] transition-colors",
                    active
                      ? "font-bold text-gray-900 dark:text-white"
                      : "font-medium text-gray-600 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-white"
                  )}
                >
                  {tab.shortLabel}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Backoffice Shortcuts: Settings */}
        <div className="w-full pt-2 mt-0.5 border-t border-gray-200/80 dark:border-slate-800 flex flex-col items-center gap-1 px-1">
          <Link
            to="/dashboard/settings"
            title={t("navbar.settings", "Settings")}
            className="group relative w-full flex flex-col items-center gap-0.5 py-1.5 cursor-pointer"
          >
            {isTabActive("/dashboard/settings") && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#2CA01C] rounded-r-full" />
            )}
            <span
              className={clsx(
                "w-10 h-7 flex items-center justify-center transition-colors",
                isTabActive("/dashboard/settings")
                  ? "text-[#2CA01C] dark:text-[#2CA01C]"
                  : "text-gray-500 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-white"
              )}
            >
              <IconSettings size={20} stroke={isTabActive("/dashboard/settings") ? 2.2 : 1.8} />
            </span>
            <span
              className={clsx(
                "text-[10px] leading-tight truncate max-w-[62px] transition-colors",
                isTabActive("/dashboard/settings")
                  ? "font-bold text-gray-900 dark:text-white"
                  : "font-medium text-gray-600 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-white"
              )}
            >
              {t("navbar.settings_short", "Settings")}
            </span>
          </Link>
        </div>
      </div>

      {/* Bottom Controls: Search, Minimize/Hide Rail, & Profile Avatar */}
      <div className="w-full pt-1.5 border-t border-gray-200/80 dark:border-slate-800 flex flex-col items-center gap-1.5 px-1 shrink-0">
        {/* Global Search */}
        <button
          type="button"
          onClick={showSearchModal}
          title={`${t("appbar.search_placeholder", "Search")} (Cmd+K)`}
          className="group w-full flex flex-col items-center gap-0.5 py-0.5 cursor-pointer"
        >
          <span className="w-10 h-7 flex items-center justify-center text-gray-500 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
            <IconSearch size={18} stroke={1.9} />
          </span>
          <span className="text-[10px] font-medium text-gray-600 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-white leading-tight transition-colors">
            {t("appbar.search_placeholder", "Search")}
          </span>
        </button>

        {/* Hide / Collapse Left Rail Button */}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={t("navbar.collapse_nav", "Hide Left Rail (Fullscreen)")}
            className="group w-full flex flex-col items-center gap-0.5 py-0.5 cursor-pointer"
          >
            <span className="w-10 h-7 flex items-center justify-center text-gray-500 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
              <IconArrowBarToLeft size={16} stroke={2} />
            </span>
            <span className="text-[9px] font-medium text-gray-500 dark:text-slate-400 leading-tight">
              {t("navbar.hide", "Hide")}
            </span>
          </button>
        )}

        {/* User Profile Avatar (opens menu upward to the right of the left rail) */}
        <div className="pt-0.5">
          <AppBarDropdown isCollapsed={true} align="left" direction="up" className="!w-9 !h-9 !p-0.5" />
        </div>
      </div>
    </aside>
  );
}
