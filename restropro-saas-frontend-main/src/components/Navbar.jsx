import React, { useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  IconArmchair,
  IconArmchair2,
  IconBuildingWarehouse,
  IconChartArea,
  IconChefHat,
  IconChevronLeft,
  IconChevronRight,
  IconDeviceIpadHorizontal,
  IconFileInvoice,
  IconFriends,
  IconHistory,
  IconLayoutDashboard,
  IconSettings2,
  IconStars,
  IconToolsKitchen3,
  IconUsersGroup,
  IconSearch,
  IconCommand,
} from "@tabler/icons-react";
import { clsx } from "clsx";
import AvatarImg from "../assets/avatar.svg";
import { iconStroke } from "../config/config";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { NavbarContext } from "../contexts/NavbarContext";
import { toggleNavbar } from "../helpers/NavbarSettings";
import { PLAN_FEATURES, SCOPES, hasFullBusinessAccess } from "../config/scopes";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import AppBarDropdown from "./AppBarDropdown";
import BusinessSwitcher from "./BusinessSwitcher";
import { showSearchModal } from "./SearchModal";
import QuickNewMenu from "./QuickNewMenu";

export const getNavbarItems = (t) => [
  {
    type: "link",
    text: t("navbar.dashboard"),
    icon: <IconLayoutDashboard stroke={iconStroke} />,
    path: "/dashboard/home",
    scopes: [SCOPES.DASHBOARD],
    features: [PLAN_FEATURES.DASHBOARD],
  },
  {
    type: "link",
    text: t("navbar.pos"),
    icon: <IconDeviceIpadHorizontal stroke={iconStroke} />,
    path: "/dashboard/pos",
    scopes: [SCOPES.POS],
    features: [PLAN_FEATURES.POS],
  },
  {
    type: "link",
    text: t("navbar.tables", "Tables"),
    icon: <IconArmchair stroke={iconStroke} />,
    path: "/dashboard/tables",
    scopes: [SCOPES.POS, SCOPES.SETTINGS, SCOPES.DASHBOARD],
    features: [PLAN_FEATURES.POS],
  },
  {
    type: "link",
    text: t("navbar.orders"),
    icon: <IconToolsKitchen3 stroke={iconStroke} />,
    path: "/dashboard/orders",
    scopes: [
      SCOPES.POS,
      SCOPES.ORDERS,
      SCOPES.ORDER_STATUS,
      SCOPES.ORDER_STATUS_DISPLAY,
    ],
    features: [PLAN_FEATURES.POS],
  },
  {
    type: "link",
    text: t("navbar.kitchen"),
    icon: <IconChefHat stroke={iconStroke} />,
    path: "/dashboard/kitchen",
    scopes: [SCOPES.KITCHEN, SCOPES.KITCHEN_DISPLAY],
    features: [PLAN_FEATURES.KITCHEN],
  },
  {
    type: "link",
    text: t("navbar.reservation"),
    icon: <IconArmchair2 stroke={iconStroke} />,
    path: "/dashboard/reservation",
    scopes: [
      SCOPES.RESERVATIONS,
      SCOPES.VIEW_RESERVATIONS,
      SCOPES.MANAGE_RESERVATIONS,
    ],
    features: [PLAN_FEATURES.RESERVATIONS],
  },
  {
    type: "link",
    text: t("navbar.customers"),
    icon: <IconFriends stroke={iconStroke} />,
    path: "/dashboard/customers",
    scopes: [
      SCOPES.CUSTOMERS,
      SCOPES.VIEW_CUSTOMERS,
      SCOPES.MANAGE_CUSTOMERS,
    ],
    features: [PLAN_FEATURES.CUSTOMERS],
  },
  {
    type: "link",
    text: t("navbar.invoices"),
    icon: <IconFileInvoice stroke={iconStroke} />,
    path: "/dashboard/invoices",
    scopes: [SCOPES.INVOICES],
    features: [PLAN_FEATURES.INVOICES],
  },
  {
    type: "link",
    text: t("navbar.inventory"),
    icon: <IconBuildingWarehouse stroke={iconStroke} />,
    path: "/dashboard/inventory",
    scopes: [SCOPES.INVENTORY],
    features: [PLAN_FEATURES.INVENTORY],
  },
  {
    type: "link",
    text: t("navbar.feedbacks"),
    icon: <IconStars stroke={iconStroke} />,
    path: "/dashboard/feedbacks",
    scopes: [SCOPES.FEEDBACK],
    features: [PLAN_FEATURES.FEEDBACK],
  },
  {
    type: "link",
    text: t("navbar.users"),
    icon: <IconUsersGroup stroke={iconStroke} />,
    path: "/dashboard/users",
    scopes: [SCOPES.USER],
    features: [PLAN_FEATURES.USER],
  },
  {
    type: "link",
    text: t("navbar.reports"),
    icon: <IconChartArea stroke={iconStroke} />,
    path: "/dashboard/reports",
    scopes: [SCOPES.REPORTS],
    features: [PLAN_FEATURES.REPORTS],
  },
  {
    type: "link",
    text: t("navbar.audit_logs"),
    icon: <IconHistory stroke={iconStroke} />,
    path: "/dashboard/audit-logs",
    scopes: [SCOPES.VIEW_INVOICE_AUDIT_LOG],
    features: [PLAN_FEATURES.INVOICES],
  },
  {
    type: "link",
    text: t("navbar.settings"),
    icon: <IconSettings2 stroke={iconStroke} />,
    path: "/dashboard/settings",
    scopes: [SCOPES.SETTINGS],
    features: [PLAN_FEATURES.SETTINGS],
  },
];

export default function Navbar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const user = getUserDetailsInLocalStorage();
  const { role: userRole, scope, planFeautures } = user;
  const userScopes = scope?.split(",");
  const userPlanFeatures = Array.isArray(planFeautures)
    ? planFeautures
    : planFeautures?.split(",") || [];
  const { theme } = useTheme();
  const [isNavbarCollapsed, setIsNavbarCollapsed] = useContext(NavbarContext);

  const navbarItems = getNavbarItems(t);

  const btnToggleNavbar = () => {
    const isNavCollapsed = toggleNavbar();
    console.log(isNavCollapsed);
    if (isNavCollapsed) {
      setIsNavbarCollapsed(true);
    } else {
      setIsNavbarCollapsed(false);
    }
  };

  const isItemActive = (itemPath, currentPath) => {
    if (itemPath === "/dashboard" || itemPath === "/dashboard/home") {
      return currentPath === "/dashboard" || currentPath === "/dashboard/home";
    }
    return currentPath.startsWith(itemPath);
  };

  if (isNavbarCollapsed) {
    return (
      <div className="relative h-screen">
        <div className="flex flex-col items-center h-screen w-20 fixed left-0 top-0 bg-[#0D233A] dark:bg-[#081426] border-r border-[#1C3550] dark:border-[#1E293B] z-40">
          {/* Fixed top header area: overflow visible so popups fly out without clipping */}
          <div className="w-full flex flex-col items-center gap-2.5 pt-4 px-2.5 shrink-0 z-50">
            {/* User Profile Avatar with dropdown */}
            <div className="w-full flex justify-center">
              <AppBarDropdown isCollapsed={true} />
            </div>

            {/* QuickBooks "+ New" Button */}
            <div className="w-full flex justify-center">
              <QuickNewMenu isCollapsed={true} />
            </div>

            {/* Search button (Cmd+K) */}
            <button
              type="button"
              onClick={showSearchModal}
              title={`${t("appbar.search_placeholder", "Search")} (Cmd+K)`}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 transition cursor-pointer shadow-2xs"
            >
              <IconSearch size={18} stroke={iconStroke} />
            </button>

            <div className="w-8 h-[1px] bg-[#1C3550] my-1" />
          </div>

          {/* Scrollable nav items list */}
          <div className="flex-1 w-full flex flex-col items-center gap-2 px-2.5 overflow-y-auto overflow-x-hidden pb-20 pt-1">
            {navbarItems.filter(item => {
              if (userRole === "admin") return true;
              const requiredScopes = item.features;
              if (requiredScopes?.length == 0) {
                return true;
              }
              return requiredScopes?.some(scope => userPlanFeatures.includes(scope));
            }).filter((navItem) => {
              const requiredScopes = navItem.scopes;
              if (navItem.type == "link") {
                if (hasFullBusinessAccess(userRole)) {
                  return true;
                }
                return requiredScopes.some((scope) => userScopes.includes(scope));
              }
            }).map((item, index) => {
              if (item.type == "text") {
                return null;
              }

              const isActive = isItemActive(item.path, pathname);

              return (
                <Link
                  key={index}
                  title={item.text}
                  className={clsx(
                    "w-11 h-11 flex items-center justify-center rounded-lg transition-all",
                    {
                      "bg-[#1C3B5E] text-white font-semibold border-l-4 border-[#2CA01C] rounded-r-lg shadow-sm": isActive,
                      "text-slate-300 hover:bg-[#152E4A] hover:text-white": !isActive,
                    }
                  )}
                  to={item.path}
                >
                  {React.cloneElement(item.icon, {
                    className: clsx(
                      "transition-colors",
                      {
                        "text-white": isActive,
                        "text-slate-400 group-hover:text-white": !isActive,
                      }
                    ),
                    size: 20,
                  })}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Toggle Uncollapse / Expand Button */}
        <button
          type="button"
          onClick={btnToggleNavbar}
          title={t("navbar.expand", "Expand sidebar")}
          className="w-7 h-7 hidden md:flex items-center justify-center rounded-full border transition bg-[#0D233A] dark:bg-[#081426] border-[#23456C] hover:bg-[#152E4A] shadow-md text-slate-300 hover:text-white fixed bottom-6 left-20 -translate-x-1/2 z-50 cursor-pointer"
        >
          <IconChevronRight stroke={iconStroke} size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-screen">
      <div className="flex flex-col items-start h-screen md:w-72 fixed left-0 top-0 bg-[#0D233A] dark:bg-[#081426] border-r border-[#1C3550] dark:border-[#1E293B] text-slate-200 z-40">

        {/* Top Header in Sidebar: User Profile Dropdown & Business Switcher */}
        <div className="w-full px-3.5 pt-4 pb-2 shrink-0 z-50 space-y-2">
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 min-w-0">
              <AppBarDropdown isCollapsed={false} />
            </div>
            {/* Quick Search Icon Button */}
            <button
              type="button"
              onClick={showSearchModal}
              title={`${t("appbar.search_placeholder", "Search")} (Cmd+K)`}
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer shadow-2xs"
            >
              <IconSearch size={17} stroke={iconStroke} />
            </button>
          </div>
          <BusinessSwitcher />

          {/* QuickBooks "+ New" Button */}
          <div className="w-full my-1">
            <QuickNewMenu isCollapsed={false} />
          </div>

          <div className="w-full h-[1px] bg-[#1C3550] my-1" />
        </div>

        {/* Scrollable navigation items */}
        <div className="flex-1 w-full px-3.5 pb-20 overflow-y-auto overflow-x-hidden space-y-1">
          {navbarItems.filter(item => {
            if (userRole === "admin") return true;
            const requiredScopes = item.features;
            if (requiredScopes?.length == 0) return true;
            return requiredScopes?.some(scope => userPlanFeatures.includes(scope));
          }).filter((navItem) => {
            const requiredScopes = navItem.scopes;
            if (navItem.type == "text") {
              return true;
            }
            if (navItem.type == "link") {
              if (hasFullBusinessAccess(userRole)) {
                return true;
              }
              return requiredScopes.some((scope) => userScopes.includes(scope));
            }
          }).map((item, index) => {
            if (item.type == "text") {
              return (
                <p key={index} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 pt-3 pb-1 hidden md:block">
                  {item.text}
                </p>
              );
            }

            const isActive = isItemActive(item.path, pathname);

            return (
              <Link
                key={index}
                to={item.path}
                className={clsx(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all group",
                  {
                    "bg-[#1C3B5E] text-white font-semibold border-l-4 border-[#2CA01C] rounded-l-none shadow-xs": isActive,
                    "text-slate-300 hover:bg-[#152E4A] hover:text-white": !isActive,
                  }
                )}
              >
                {React.cloneElement(item.icon, {
                  className: clsx(
                    "transition-colors shrink-0",
                    {
                      "text-[#2CA01C]": isActive,
                      "text-slate-400 group-hover:text-white": !isActive,
                    }
                  ),
                  size: 19,
                })}
                <p className="hidden md:block truncate">
                  {item.text}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Toggle Collapse Button */}
      <button
        type="button"
        onClick={btnToggleNavbar}
        title={t("navbar.collapse", "Collapse sidebar")}
        className="w-7 h-7 hidden md:flex items-center justify-center rounded-full border transition bg-[#0D233A] dark:bg-[#081426] border-[#23456C] hover:bg-[#152E4A] shadow-md text-slate-300 hover:text-white fixed bottom-6 left-72 -translate-x-1/2 z-50 cursor-pointer"
      >
        <IconChevronLeft stroke={iconStroke} size={15} />
      </button>
    </div>
  );
}
