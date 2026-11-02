import React, { Fragment, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Transition } from "@headlessui/react";
import { useTranslation } from "react-i18next";
import {
  IconBuildingStore,
  IconChevronDown,
  IconCashRegister,
  IconArmchair,
  IconChefHat,
  IconToolsKitchen3,
  IconCalendarEvent,
  IconFileInvoice,
  IconUsersGroup,
  IconBuildingWarehouse,
  IconDatabase,
  IconChartArea,
  IconSettings2,
  IconHistory,
  IconStars,
  IconFriends,
  IconSearch,
  IconMenu2,
  IconX,
  IconLayoutDashboard,
  IconTruck,
  IconHelp,
  IconLayoutGrid,
  IconBrandTelegram,
  IconCalendar,
  IconUserCheck,
  IconUsers,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { SCOPES, PLAN_FEATURES, hasFullBusinessAccess } from "../config/scopes";
import BusinessSwitcher from "./BusinessSwitcher";
import AppBarDropdown from "./AppBarDropdown";
import { useStoreSettings } from "../controllers/settings.controller";
import { getImageURL } from "../helpers/ImageHelper";
import QuickNewMenu from "./QuickNewMenu";
import { showSearchModal } from "./SearchModal";
import clsx from "clsx";

export default function TopNavbar() {
  const { t } = useTranslation();
  const location = useLocation();

  const { data: storeSettingsData } = useStoreSettings();
  const storeLogo = storeSettingsData?.storeImage;
  const storeName = storeSettingsData?.storeName;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const user = getUserDetailsInLocalStorage();
  const { role: userRole, scope, planFeautures } = user || {};
  const userScopes = scope?.split(",") || [];
  const userPlanFeatures = Array.isArray(planFeautures)
    ? planFeautures
    : planFeautures?.split(",") || [];

  const hasAccess = (requiredScopes = [], requiredFeatures = []) => {
    if (userRole === "admin") return true;
    if (hasFullBusinessAccess(userRole)) return true;
    const hasFeature =
      requiredFeatures.length === 0 ||
      requiredFeatures.some((f) => userPlanFeatures.includes(f));
    const hasScope =
      requiredScopes.length === 0 ||
      requiredScopes.some((s) => userScopes.includes(s));
    return hasFeature && hasScope;
  };

  const navSections = [
    {
      id: "orders",
      label: t("navbar.orders", "Orders"),
      icon: <IconToolsKitchen3 size={17} stroke={iconStroke} className="text-amber-500" />,
      items: [
        {
          label: t("navbar.invoices", "Invoices & Receipts"),
          path: "/dashboard/invoices",
          icon: <IconFileInvoice size={17} stroke={iconStroke} className="text-indigo-500" />,
          scopes: [SCOPES.INVOICES],
          features: [PLAN_FEATURES.INVOICES],
        },
        {
          label: t("navbar.audit_logs", "Invoice Audit Logs"),
          path: "/dashboard/audit-logs",
          icon: <IconHistory size={17} stroke={iconStroke} className="text-gray-500" />,
          scopes: [SCOPES.VIEW_INVOICE_AUDIT_LOG],
          features: [PLAN_FEATURES.INVOICES],
        },
      ],
    },
    {
      id: "inventory",
      label: t("navbar.inventory", "Inventory"),
      items: [
        {
          label: t("navbar.inventory_items", "Stock & Items"),
          path: "/dashboard/inventory",
          icon: <IconBuildingWarehouse size={17} stroke={iconStroke} className="text-sky-500" />,
          scopes: [SCOPES.INVENTORY],
          features: [PLAN_FEATURES.INVENTORY],
        },
        {
          label: t("navbar.inventory_dashboard", "Inventory Overview"),
          path: "/dashboard/inventory/dashboard",
          icon: <IconBuildingWarehouse size={17} stroke={iconStroke} className="text-sky-500" />,
          scopes: [SCOPES.INVENTORY],
          features: [PLAN_FEATURES.INVENTORY],
        },
        {
          label: t("navbar.stock_movements", "Stock Movements & Logs"),
          path: "/dashboard/inventory/stock-movements",
          icon: <IconHistory size={17} stroke={iconStroke} className="text-sky-500" />,
          scopes: [SCOPES.INVENTORY],
          features: [PLAN_FEATURES.INVENTORY],
        },
        {
          label: t("navbar.stock_adjustment", "Stock Adjustment"),
          path: "/dashboard/inventory/adjustments",
          icon: <IconDatabase size={17} stroke={iconStroke} className="text-emerald-500" />,
          scopes: [SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY],
          features: [PLAN_FEATURES.INVENTORY],
        },
        {
          label: t("navbar.stock_transfers", "Stock Transfers"),
          path: "/dashboard/inventory/transfers",
          icon: <IconTruck size={17} stroke={iconStroke} className="text-indigo-500" />,
          scopes: [SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY],
          features: [PLAN_FEATURES.INVENTORY],
        },
      ],
    },
    {
      id: "customers",
      label: t("navbar.customers", "Customers"),
      items: [
        {
          label: t("navbar.customers", "Customer Directory"),
          path: "/dashboard/customers",
          icon: <IconFriends size={17} stroke={iconStroke} className="text-teal-500" />,
          scopes: [SCOPES.CUSTOMERS],
          features: [PLAN_FEATURES.CUSTOMERS],
        },
        {
          label: t("navbar.customer_groups", "Customer Groups"),
          path: "/dashboard/customer-groups",
          icon: <IconUsers size={17} stroke={iconStroke} className="text-indigo-500" />,
          scopes: [SCOPES.CUSTOMERS],
          features: [PLAN_FEATURES.CUSTOMERS],
        },
        {
          label: t("navbar.import_customers", "Import Customers"),
          path: "/dashboard/customers/import",
          icon: <IconFriends size={17} stroke={iconStroke} className="text-teal-500" />,
          scopes: [SCOPES.CUSTOMERS],
          features: [PLAN_FEATURES.CUSTOMERS],
        },
        {
          label: t("navbar.feedbacks", "Customer Feedback"),
          path: "/dashboard/feedbacks",
          icon: <IconStars size={17} stroke={iconStroke} className="text-yellow-500" />,
          scopes: [SCOPES.FEEDBACK],
          features: [PLAN_FEATURES.FEEDBACK],
        },
      ],
    },
    {
      id: "vendors",
      label: t("navbar.vendors", "Vendors"),
      items: [
        {
          label: t("navbar.vendors_directory", "Suppliers Directory"),
          path: "/dashboard/inventory?tab=vendors",
          icon: <IconTruck size={17} stroke={iconStroke} className="text-orange-500" />,
          scopes: [SCOPES.INVENTORY],
          features: [PLAN_FEATURES.INVENTORY],
        },
        {
          label: t("navbar.purchase_orders", "Purchase Orders"),
          path: "/dashboard/inventory?tab=purchase-orders",
          icon: <IconBuildingWarehouse size={17} stroke={iconStroke} className="text-orange-500" />,
          scopes: [SCOPES.INVENTORY],
          features: [PLAN_FEATURES.INVENTORY],
        },
      ],
    },
    {
      id: "employees",
      label: t("navbar.employees", "Employees"),
      items: [
        {
          label: t("navbar.users", "Staff & Users"),
          path: "/dashboard/users",
          icon: <IconUsersGroup size={17} stroke={iconStroke} className="text-blue-500" />,
          scopes: [SCOPES.USER],
          features: [PLAN_FEATURES.USER],
        },
        {
          label: t("navbar.table_assignments", "Table Assignments"),
          path: "/dashboard/settings/table-assignments",
          icon: <IconArmchair size={17} stroke={iconStroke} className="text-blue-500" />,
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.shift_roster", "Roster & Shifts"),
          path: "/dashboard/shifts-roster",
          icon: <IconCalendar size={17} stroke={iconStroke} className="text-blue-500" />,
          scopes: [SCOPES.USER, SCOPES.SETTINGS],
          features: [PLAN_FEATURES.USER, PLAN_FEATURES.SETTINGS],
        },
      ],
    },
    {
      id: "reporting",
      label: t("navbar.reporting", "Reporting"),
      items: [
        {
          label: t("navbar.reports", "Reports & Analytics"),
          path: "/dashboard/reports",
          icon: <IconChartArea size={17} stroke={iconStroke} className="text-purple-500" />,
          scopes: [SCOPES.REPORTS],
          features: [PLAN_FEATURES.REPORTS],
        },
        {
          label: t("navbar.staff_attendance", "Staff Attendance"),
          path: "/dashboard/attendance",
          icon: <IconUserCheck size={17} stroke={iconStroke} className="text-purple-500" />,
          scopes: [SCOPES.REPORTS, SCOPES.USER, SCOPES.SETTINGS],
          features: [PLAN_FEATURES.REPORTS],
        },
      ],
    },
    {
      id: "settings",
      label: t("navbar.settings", "Settings"),
      items: [
        {
          label: t("navbar.store_details", "Store Details"),
          path: "/dashboard/settings/details",
          icon: <IconSettings2 size={17} stroke={iconStroke} className="text-slate-500" />,
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.menu_items", "Menu Items & Pricing"),
          path: "/dashboard/settings/menu-items",
          icon: <IconSettings2 size={17} stroke={iconStroke} className="text-slate-500" />,
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.categories", "Menu Categories"),
          path: "/dashboard/settings/menu-items/categories",
          icon: <IconSettings2 size={17} stroke={iconStroke} className="text-slate-500" />,
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.tax_setup", "Tax Setup"),
          path: "/dashboard/settings/tax-setup",
          icon: <IconSettings2 size={17} stroke={iconStroke} className="text-slate-500" />,
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.payment_types", "Payment Types"),
          path: "/dashboard/settings/payment-types",
          icon: <IconSettings2 size={17} stroke={iconStroke} className="text-slate-500" />,
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.kitchen_stations", "Kitchen Stations"),
          path: "/dashboard/settings/kitchen-stations",
          icon: <IconSettings2 size={17} stroke={iconStroke} className="text-slate-500" />,
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.thermal_printers", "Thermal Printers"),
          path: "/dashboard/settings/thermal-printers",
          icon: <IconSettings2 size={17} stroke={iconStroke} className="text-slate-500" />,
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.print_settings", "Print Settings"),
          path: "/dashboard/settings/print-settings",
          icon: <IconSettings2 size={17} stroke={iconStroke} className="text-slate-500" />,
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.telegram_notifications", "Telegram Notifications"),
          path: "/dashboard/settings/telegram",
          icon: <IconBrandTelegram size={17} stroke={iconStroke} className="text-[#229ED9]" />,
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.tables_setup", "Tables & Floors"),
          path: "/dashboard/settings/tables",
          icon: <IconSettings2 size={17} stroke={iconStroke} className="text-slate-500" />,
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.settings_home", "Settings Overview"),
          path: "/dashboard/settings",
          icon: <IconSettings2 size={17} stroke={iconStroke} className="text-slate-500" />,
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
      ],
    },
    {
      id: "help",
      label: t("navbar.help_contact", "Help & Contact"),
      path: "/dashboard/contact-support",
      icon: <IconHelp size={17} stroke={iconStroke} className="text-slate-400" />,
    },
  ];

  return (
    <header className="w-full h-15 bg-[#0D233A] dark:bg-[#081426] border-b border-[#1C3550] dark:border-[#1E293B] px-3 sm:px-5 flex items-center justify-between gap-4 text-white z-50 shrink-0 sticky top-0 shadow-sm select-none">
      {/* Left: Brand Identity, Logo, and Business Switcher */}
      <div className="flex items-center gap-3 shrink-0">
        <Link
          to="/dashboard/home"
          className="flex items-center gap-2.5 group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-[#2CA01C] flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition overflow-hidden">
            {storeLogo ? (
              <img src={getImageURL(storeLogo)} alt={storeName || "Store Logo"} className="w-full h-full object-cover" />
            ) : (
              <IconBuildingStore size={19} stroke={2.2} />
            )}
          </div>
          <span className="font-bold text-sm tracking-wide text-white hidden sm:inline">
            {storeName || "RestroPRO"}
          </span>
        </Link>

        {/* Business Switcher Dropdown */}
        <div className="hidden md:block max-w-[210px]">
          <BusinessSwitcher />
        </div>
      </div>

      {/* Center: Categorized Dropdown Navigation Bars (Desktop) */}
      <nav className="hidden lg:flex items-center gap-1">
        {/* Direct Link: Dashboard */}
        <Link
          to="/dashboard/home"
          className={clsx(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5",
            location.pathname === "/dashboard/home" || location.pathname === "/dashboard"
              ? "bg-[#1C3B5E] text-white border-b-2 border-[#2CA01C]"
              : "text-slate-300 hover:text-white hover:bg-white/10"
          )}
        >
          <IconLayoutDashboard size={15} stroke={iconStroke} />
          <span>{t("navbar.dashboard", "Dashboard")}</span>
        </Link>

        {/* Categorized Dropdown Menus */}
        {navSections.map((section) => {
          if (section.path) {
            // Direct Link (e.g. Reports)
            if (!hasAccess(section.scopes, section.features)) return null;
            const isActive = location.pathname.startsWith(section.path);
            return (
              <Link
                key={section.id}
                to={section.path}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5",
                  isActive
                    ? "bg-[#1C3B5E] text-white border-b-2 border-[#2CA01C]"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                )}
              >
                {section.icon}
                <span>{section.label}</span>
              </Link>
            );
          }

          // Dropdown Section
          const validItems = section.items.filter((item) =>
            hasAccess(item.scopes, item.features)
          );
          if (validItems.length === 0) return null;

          const isAnyItemActive = validItems.some((item) =>
            location.pathname.startsWith(item.path)
          );

          return (
            <Menu as="div" key={section.id} className="relative inline-block text-left">
              <Menu.Button
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer",
                  isAnyItemActive
                    ? "bg-[#1C3B5E] text-white border-b-2 border-[#2CA01C]"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                )}
              >
                <span>{section.label}</span>
                <IconChevronDown size={14} stroke={iconStroke} className="text-slate-400" />
              </Menu.Button>

              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute left-0 mt-2 w-56 origin-top-left divide-y divide-gray-100 dark:divide-zinc-800 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-2xl p-1.5 focus:outline-none z-[100]">
                  <div className="space-y-0.5">
                    {validItems.map((item, idx) => (
                      <Menu.Item key={idx}>
                        {({ active }) => (
                          <Link
                            to={item.path}
                            className={clsx(
                              "flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors",
                              active
                                ? "bg-emerald-50 dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400"
                                : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
                            )}
                          >
                            <span className="p-1 rounded-md bg-gray-50 dark:bg-zinc-800 shadow-2xs">
                              {item.icon}
                            </span>
                            <span>{item.label}</span>
                          </Link>
                        )}
                      </Menu.Item>
                    ))}
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
          );
        })}
      </nav>

      {/* Right: Quick Action Buttons & User Profile */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* QuickBooks "+ New Action" Flyout */}
        <div className="hidden sm:block">
          <QuickNewMenu isCollapsed={false} compact={true} />
        </div>

        {/* Native Tablet POS & Floor Plan Segmented Switcher */}
        {hasAccess([SCOPES.POS], [PLAN_FEATURES.POS]) && (() => {
          const isTablesActive = location.pathname.startsWith("/dashboard/tables");
          const isPosActive = location.pathname.startsWith("/dashboard/pos");
          return (
            <div className="flex items-center h-9 p-0.5 rounded-full bg-slate-900/80 dark:bg-black/40 border border-slate-700/80 shadow-inner">
              {/* Tables / Floor Plan Segment */}
              <Link
                to="/dashboard/tables"
                title={t("top_bar.tables", "Floor Plan & Tables")}
                className={clsx(
                  "h-8 px-2.5 sm:px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold transition-all duration-150 active:scale-95 touch-manipulation whitespace-nowrap select-none",
                  isTablesActive
                    ? "bg-[#2CA01C] text-white shadow-sm font-bold"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                )}
              >
                <IconArmchair
                  size={15}
                  stroke={2}
                  className={isTablesActive ? "text-white" : "text-emerald-400"}
                />
                <span>{t("top_bar.tables", "Tables")}</span>
              </Link>

              {/* Inactive Divider between unselected segments */}
              {!isTablesActive && !isPosActive && (
                <div className="w-[1px] h-3.5 bg-slate-700/60 shrink-0" />
              )}

              {/* POS Register Segment */}
              <Link
                to="/dashboard/pos"
                title={t("top_bar.open_pos", "Open Register / POS")}
                className={clsx(
                  "h-8 px-2.5 sm:px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold transition-all duration-150 active:scale-95 touch-manipulation whitespace-nowrap select-none",
                  isPosActive
                    ? "bg-[#2CA01C] text-white shadow-sm font-bold"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                )}
              >
                <IconCashRegister
                  size={16}
                  stroke={1.9}
                  className={isPosActive ? "text-white" : "text-emerald-400"}
                />
                <span>{t("top_bar.pos", "POS")}</span>
              </Link>
            </div>
          );
        })()}

        {/* Global Search (Cmd+K) */}
        <button
          type="button"
          onClick={showSearchModal}
          title={`${t("appbar.search_placeholder", "Search")} (Cmd+K)`}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer border border-white/10 active:scale-95"
        >
          <IconSearch size={16} stroke={iconStroke} />
        </button>

        {/* User Profile Avatar with dropdown */}
        <div className="relative">
          <AppBarDropdown isCollapsed={true} className="!w-9 !h-9 !p-0.5" />
        </div>

        {/* Mobile Hamburger Drawer Toggle (under lg) */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
        >
          {mobileMenuOpen ? <IconX size={20} /> : <IconMenu2 size={20} />}
        </button>
      </div>

      {/* Mobile Drawer (visible when toggled on smaller screens) */}
      {mobileMenuOpen && (
        <div className="fixed inset-x-0 top-15 bottom-0 bg-[#0D233A] dark:bg-[#081426] z-50 p-4 overflow-y-auto lg:hidden animate-in slide-in-from-top-2 duration-150 border-t border-[#1C3550]">
          <div className="space-y-4">
            <div className="w-full">
              <BusinessSwitcher />
            </div>

            <div className="space-y-1">
              <Link
                to="/dashboard/home"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white hover:bg-white/10"
              >
                <IconLayoutDashboard size={18} />
                <span>{t("navbar.dashboard", "Dashboard")}</span>
              </Link>

              {navSections.map((sec) => (
                <div key={sec.id} className="pt-2">
                  <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {sec.label}
                  </p>
                  <div className="mt-1 space-y-0.5">
                    {(sec.items || [sec]).map((sub, sIdx) => {
                      if (!hasAccess(sub.scopes, sub.features)) return null;
                      return (
                        <Link
                          key={sIdx}
                          to={sub.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-200 hover:text-white hover:bg-white/10"
                        >
                          {sub.icon}
                          <span>{sub.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
