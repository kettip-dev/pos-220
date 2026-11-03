import React, { useState, useEffect } from "react";
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
  IconDots,
  IconX,
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
  const isKitchenEnabled = storeSettingsData?.isKitchenEnabled !== false;

  const rawNavTabs = [
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

  const operationalNavTabs = rawNavTabs.filter((tab) => {
    if (tab.id === "kitchen" && !isKitchenEnabled) return false;
    return true;
  });

  const isTabActive = (itemPath) => {
    return location.pathname.startsWith(itemPath);
  };

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={onToggleCollapse}
        title={t("navbar.expand_nav", "Open Left Navigation")}
        className="hidden fixed left-0 bottom-4 z-50 h-10 pl-1.5 pr-2.5 rounded-r-full bg-[#0D233A] hover:bg-[#16385c] text-white border border-l-0 border-white/20 shadow-lg md:flex items-center gap-1.5 transition active:scale-95 cursor-pointer select-none"
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
    <aside className="hidden md:flex w-[68px] shrink-0 h-full bg-white dark:bg-[#0B1522] border-r border-[#E3E5E8] dark:border-slate-800/90 flex-col items-center justify-between py-2 select-none z-50">
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

/**
 * Phone-width replacement for the left rail: a bottom tab bar with the main
 * service screens, plus a "More" sheet for Home, Reservations, Settings and Search.
 */
export function OperationalBottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const { data: storeSettingsData } = useStoreSettings();
  const storeLogo = storeSettingsData?.storeImage;
  const storeName = storeSettingsData?.storeName;
  const isKitchenEnabled = storeSettingsData?.isKitchenEnabled !== false;

  // Close the sheet whenever the route changes
  useEffect(() => {
    setIsMoreOpen(false);
  }, [location.pathname]);

  const primaryTabs = [
    { id: "tables", label: t("navbar.tables_short", "Tables"), Icon: IconArmchair, path: "/dashboard/tables" },
    { id: "pos", label: t("navbar.pos_short", t("top_bar.pos", "POS")), Icon: IconDeviceIpadHorizontal, path: "/dashboard/pos" },
    { id: "kitchen", label: t("navbar.kitchen_short", "Kitchen"), Icon: IconChefHat, path: "/dashboard/kitchen" },
    { id: "orders", label: t("navbar.orders", "Orders"), Icon: IconToolsKitchen3, path: "/dashboard/orders" },
  ].filter((tab) => tab.id !== "kitchen" || isKitchenEnabled);

  const moreLinks = [
    { id: "home", label: storeName || t("navbar.home", "Home"), Icon: IconHome, path: "/dashboard/home" },
    { id: "reservation", label: t("navbar.reservation", "Reservations"), Icon: IconCalendarEvent, path: "/dashboard/reservation" },
    { id: "settings", label: t("navbar.settings", "Settings"), Icon: IconSettings, path: "/dashboard/settings" },
  ];

  const isActive = (path) => location.pathname.startsWith(path);
  const isMoreActive = moreLinks.some((l) => isActive(l.path));

  return (
    <>
      {isMoreOpen && (
        <>
          <button
            type="button"
            aria-label={t("navbar.close", "Close")}
            onClick={() => setIsMoreOpen(false)}
            className="md:hidden fixed inset-0 z-[55] bg-black/40 backdrop-blur-xs"
          />
          <div className="md:hidden fixed inset-x-0 bottom-0 z-[60] rounded-t-3xl bg-white dark:bg-[#0B1522] border-t border-[#E3E5E8] dark:border-slate-800 shadow-2xl pb-[calc(12px+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-6 duration-200">
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1.5 rounded-full bg-gray-300 dark:bg-slate-600" />
            </div>
            <div className="flex items-center justify-between px-4 pb-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-9 h-9 rounded-full bg-[#2CA01C] flex items-center justify-center text-white overflow-hidden shrink-0">
                  {storeLogo ? (
                    <img src={getImageURL(storeLogo)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <IconBuildingStore size={18} stroke={2} />
                  )}
                </span>
                <span className="font-bold text-sm text-gray-900 dark:text-white truncate">
                  {storeName || t("navbar.home", "Home")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 active:scale-95 transition"
              >
                <IconX size={20} stroke={2} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 px-4">
              {moreLinks.map(({ id, label, Icon, path }) => (
                <Link
                  key={id}
                  to={path}
                  className={clsx(
                    "min-h-[56px] px-3.5 rounded-2xl border flex items-center gap-3 text-sm font-semibold active:scale-95 transition",
                    isActive(path)
                      ? "border-[#2CA01C] bg-[#2CA01C]/10 text-[#2CA01C]"
                      : "border-[#E3E5E8] dark:border-slate-800 bg-[#F4F5F8] dark:bg-slate-800/60 text-gray-800 dark:text-slate-100"
                  )}
                >
                  <Icon size={20} stroke={1.9} className="shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              ))}
              <button
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  showSearchModal();
                }}
                className="min-h-[56px] px-3.5 rounded-2xl border border-[#E3E5E8] dark:border-slate-800 bg-[#F4F5F8] dark:bg-slate-800/60 text-gray-800 dark:text-slate-100 flex items-center gap-3 text-sm font-semibold active:scale-95 transition"
              >
                <IconSearch size={20} stroke={1.9} className="shrink-0" />
                <span className="truncate">{t("appbar.search_placeholder", "Search")}</span>
              </button>
            </div>
          </div>
        </>
      )}

      <nav className="md:hidden shrink-0 z-50 bg-white dark:bg-[#0B1522] border-t border-[#E3E5E8] dark:border-slate-800 pb-[env(safe-area-inset-bottom)] select-none">
        <div className="flex items-stretch h-[60px] px-1">
          {primaryTabs.map(({ id, label, Icon, path }) => {
            const active = isActive(path);
            return (
              <Link
                key={id}
                to={path}
                className="relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition touch-manipulation"
              >
                {active && <span className="absolute top-0 inset-x-4 h-[3px] rounded-b-full bg-[#2CA01C]" />}
                <Icon
                  size={22}
                  stroke={active ? 2.2 : 1.8}
                  className={active ? "text-[#2CA01C]" : "text-gray-500 dark:text-slate-400"}
                />
                <span
                  className={clsx(
                    "text-[10px] leading-tight truncate max-w-full px-0.5",
                    active ? "font-bold text-gray-900 dark:text-white" : "font-medium text-gray-500 dark:text-slate-400"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            className="relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition touch-manipulation cursor-pointer"
          >
            {isMoreActive && <span className="absolute top-0 inset-x-4 h-[3px] rounded-b-full bg-[#2CA01C]" />}
            <IconDots size={22} stroke={2} className={isMoreActive ? "text-[#2CA01C]" : "text-gray-500 dark:text-slate-400"} />
            <span className={clsx("text-[10px] leading-tight", isMoreActive ? "font-bold text-gray-900 dark:text-white" : "font-medium text-gray-500 dark:text-slate-400")}>
              {t("navbar.more", "More")}
            </span>
          </button>

          <div className="flex-1 min-w-0 flex items-center justify-center">
            <AppBarDropdown isCollapsed={true} align="right" direction="up" className="!w-9 !h-9 !p-0.5" />
          </div>
        </div>
      </nav>
    </>
  );
}
