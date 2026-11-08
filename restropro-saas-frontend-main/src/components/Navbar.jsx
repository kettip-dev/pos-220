import React, { useContext, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  IconArmchair,
  IconBuildingWarehouse,
  IconChartArea,
  IconChefHat,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDatabase,
  IconDeviceIpadHorizontal,
  IconFileInvoice,
  IconFriends,
  IconHistory,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconSettings2,
  IconStars,
  IconToolsKitchen3,
  IconTruck,
  IconUsersGroup,
  IconSearch,
  IconHelp,
  IconLogout,
  IconCalendarEvent,
} from "@tabler/icons-react";
import { clsx } from "clsx";
import toast from "react-hot-toast";
import { iconStroke } from "../config/config";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { NavbarContext } from "../contexts/NavbarContext";
import { toggleNavbar } from "../helpers/NavbarSettings";
import { PLAN_FEATURES, SCOPES, hasFullBusinessAccess } from "../config/scopes";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { signOut } from "../controllers/auth.controller";
import AppBarDropdown from "./AppBarDropdown";
import BusinessSwitcher from "./BusinessSwitcher";
import { showSearchModal } from "./SearchModal";
import QuickNewMenu from "./QuickNewMenu";
import { useStoreSettings } from "../controllers/settings.controller";

/**
 * Grouped Navigation Architecture matching user-requested menu structure
 */
export const getNavGroups = (t, options = {}) => {
  const isKitchenEnabled = options.isKitchenEnabled !== false;
  return [
  {
    id: "dashboard",
    type: "link",
    text: t("navbar.dashboard", "Dashboard"),
    icon: <IconLayoutDashboard stroke={iconStroke} />,
    path: "/dashboard/home",
    scopes: [SCOPES.DASHBOARD],
    features: [PLAN_FEATURES.DASHBOARD],
  },
  {
    id: "orders",
    type: "group",
    text: t("navbar.orders", "Orders"),
    icon: <IconToolsKitchen3 stroke={iconStroke} />,
    defaultPath: "/dashboard/invoices",
    scopes: [
      SCOPES.INVOICES,
      SCOPES.VIEW_INVOICE_AUDIT_LOG,
    ],
    features: [PLAN_FEATURES.INVOICES],
    items: [
      {
        text: t("navbar.invoices", "Invoices & Receipts"),
        path: "/dashboard/invoices",
        scopes: [SCOPES.INVOICES],
        features: [PLAN_FEATURES.INVOICES],
      },
      {
        text: t("navbar.audit_logs", "Invoice Audit Logs"),
        path: "/dashboard/audit-logs",
        scopes: [SCOPES.VIEW_INVOICE_AUDIT_LOG],
        features: [PLAN_FEATURES.INVOICES],
      },
    ],
  },
  {
    id: "inventory",
    type: "group",
    text: t("navbar.inventory", "Inventory"),
    icon: <IconBuildingWarehouse stroke={iconStroke} />,
    scopes: [SCOPES.INVENTORY],
    features: [PLAN_FEATURES.INVENTORY],
    defaultPath: "/dashboard/inventory",
    items: [
      {
        text: t("navbar.inventory_items", "Stock & Items"),
        path: "/dashboard/inventory",
        scopes: [SCOPES.INVENTORY],
        features: [PLAN_FEATURES.INVENTORY],
      },
      {
        text: t("navbar.inventory_dashboard", "Inventory Overview"),
        path: "/dashboard/inventory/dashboard",
        scopes: [SCOPES.INVENTORY],
        features: [PLAN_FEATURES.INVENTORY],
      },
      {
        text: t("navbar.stock_movements", "Stock Movements & Logs"),
        path: "/dashboard/inventory/stock-movements",
        scopes: [SCOPES.INVENTORY],
        features: [PLAN_FEATURES.INVENTORY],
      },
      {
        text: t("navbar.stock_adjustment", "Stock Adjustment"),
        path: "/dashboard/inventory/adjustments",
        scopes: [SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY],
        features: [PLAN_FEATURES.INVENTORY],
      },
      {
        text: t("navbar.stock_transfers", "Stock Transfers"),
        path: "/dashboard/inventory/transfers",
        scopes: [SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY],
        features: [PLAN_FEATURES.INVENTORY],
      },
    ],
  },
  {
    id: "stock_adjustment",
    type: "group",
    text: t("navbar.stock_adjustment", "Stock Adjustment"),
    icon: <IconDatabase stroke={iconStroke} />,
    scopes: [SCOPES.INVENTORY],
    features: [PLAN_FEATURES.INVENTORY],
    defaultPath: "/dashboard/inventory/adjustments",
    items: [
      {
        text: t("navbar.stock_adjustment", "Stock Adjustment"),
        path: "/dashboard/inventory/adjustments",
        scopes: [SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY],
        features: [PLAN_FEATURES.INVENTORY],
      },
    ],
  },
  {
    id: "stock_transfers",
    type: "group",
    text: t("navbar.stock_transfers", "Stock Transfers"),
    icon: <IconTruck stroke={iconStroke} />,
    scopes: [SCOPES.INVENTORY],
    features: [PLAN_FEATURES.INVENTORY],
    defaultPath: "/dashboard/inventory/transfers",
    items: [
      {
        text: t("navbar.stock_transfers", "Stock Transfers"),
        path: "/dashboard/inventory/transfers",
        scopes: [SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY],
        features: [PLAN_FEATURES.INVENTORY],
      },
    ],
  },
  {
    id: "customers",
    type: "group",
    text: t("navbar.customers", "Customers"),
    icon: <IconFriends stroke={iconStroke} />,
    scopes: [SCOPES.CUSTOMERS],
    features: [PLAN_FEATURES.CUSTOMERS],
    defaultPath: "/dashboard/customers",
    items: [
      {
        text: t("navbar.customers", "Customer Directory"),
        path: "/dashboard/customers",
        scopes: [SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS, SCOPES.MANAGE_CUSTOMERS],
        features: [PLAN_FEATURES.CUSTOMERS],
      },
      {
        text: t("navbar.customer_dues", "Customer Dues"),
        path: "/dashboard/customer-dues",
        scopes: [SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS, SCOPES.MANAGE_CUSTOMERS, SCOPES.POS],
        features: [PLAN_FEATURES.CUSTOMERS],
      },
      {
        text: t("navbar.customer_groups", "Customer Groups"),
        path: "/dashboard/customer-groups",
        scopes: [SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS, SCOPES.MANAGE_CUSTOMERS],
        features: [PLAN_FEATURES.CUSTOMERS],
      },
      {
        text: t("navbar.import_customers", "Import Customers"),
        path: "/dashboard/customers/import",
        scopes: [SCOPES.CUSTOMERS, SCOPES.MANAGE_CUSTOMERS],
        features: [PLAN_FEATURES.CUSTOMERS],
      },
      {
        text: t("navbar.feedbacks", "Customer Feedback"),
        path: "/dashboard/feedbacks",
        scopes: [SCOPES.FEEDBACK],
        features: [PLAN_FEATURES.FEEDBACK],
      },
    ],
  },
  {
    id: "vendors",
    type: "group",
    text: t("navbar.vendors", "Vendors"),
    icon: <IconTruck stroke={iconStroke} />,
    scopes: [SCOPES.INVENTORY],
    features: [PLAN_FEATURES.INVENTORY],
    defaultPath: "/dashboard/inventory",
    items: [
      {
        text: t("navbar.vendors_directory", "Suppliers Directory"),
        path: "/dashboard/inventory?tab=vendors",
        scopes: [SCOPES.INVENTORY],
        features: [PLAN_FEATURES.INVENTORY],
      },
      {
        text: t("navbar.purchase_orders", "Purchase Orders"),
        path: "/dashboard/inventory?tab=purchase-orders",
        scopes: [SCOPES.INVENTORY],
        features: [PLAN_FEATURES.INVENTORY],
      },
    ],
  },
  {
    id: "employees",
    type: "group",
    text: t("navbar.employees", "Employees"),
    icon: <IconUsersGroup stroke={iconStroke} />,
    scopes: [SCOPES.USER, SCOPES.SETTINGS],
    features: [PLAN_FEATURES.USER, PLAN_FEATURES.SETTINGS],
    defaultPath: "/dashboard/users",
    items: [
      {
        text: t("navbar.users", "Staff & Users"),
        path: "/dashboard/users",
        scopes: [SCOPES.USER],
        features: [PLAN_FEATURES.USER],
      },
      {
        text: t("navbar.table_assignments", "Table Assignments"),
        path: "/dashboard/settings/table-assignments",
        scopes: [SCOPES.SETTINGS],
        features: [PLAN_FEATURES.SETTINGS],
      },
      {
        text: t("navbar.shift_roster", "Roster & Shifts"),
        path: "/dashboard/shifts-roster",
        scopes: [SCOPES.USER, SCOPES.SETTINGS],
        features: [PLAN_FEATURES.USER, PLAN_FEATURES.SETTINGS],
      },
    ],
  },
  {
    id: "reporting",
    type: "link",
    text: t("navbar.reports", "Reports & Analytics"),
    icon: <IconChartArea stroke={iconStroke} />,
    path: "/dashboard/reports",
    scopes: [SCOPES.REPORTS],
    features: [PLAN_FEATURES.REPORTS],
  },
  {
    id: "settings",
    type: "group",
    text: t("navbar.settings", "Settings"),
    icon: <IconSettings2 stroke={iconStroke} />,
    scopes: [SCOPES.SETTINGS],
    features: [PLAN_FEATURES.SETTINGS],
    defaultPath: "/dashboard/settings",
    items: [
      {
        text: t("navbar.store_details", "Store Details"),
        path: "/dashboard/settings/details",
        scopes: [SCOPES.SETTINGS],
        features: [PLAN_FEATURES.SETTINGS],
      },
      {
        text: t("navbar.menu_items", "Menu Items & Pricing"),
        path: "/dashboard/settings/menu-items",
        scopes: [SCOPES.SETTINGS],
        features: [PLAN_FEATURES.SETTINGS],
      },
      {
        text: t("navbar.menu_languages", "Menu Languages"),
        path: "/dashboard/settings/menu-languages",
        scopes: [SCOPES.SETTINGS],
        features: [PLAN_FEATURES.SETTINGS],
      },
      {
        text: t("navbar.categories", "Menu Categories"),
        path: "/dashboard/settings/menu-items/categories",
        scopes: [SCOPES.SETTINGS],
        features: [PLAN_FEATURES.SETTINGS],
      },
      {
        text: t("navbar.addons", "Add-ons"),
        path: "/dashboard/settings/menu-items/addons",
        scopes: [SCOPES.SETTINGS],
        features: [PLAN_FEATURES.SETTINGS],
      },
      {
        text: t("navbar.tax_setup", "Tax Setup"),
        path: "/dashboard/settings/tax-setup",
        scopes: [SCOPES.SETTINGS],
        features: [PLAN_FEATURES.SETTINGS],
      },
      {
        text: t("navbar.payment_types", "Payment Types"),
        path: "/dashboard/settings/payment-types",
        scopes: [SCOPES.SETTINGS],
        features: [PLAN_FEATURES.SETTINGS],
      },
      ...(isKitchenEnabled ? [{
        text: t("navbar.kitchen_stations", "Kitchen Stations"),
        path: "/dashboard/settings/kitchen-stations",
        scopes: [SCOPES.SETTINGS],
        features: [PLAN_FEATURES.SETTINGS],
      }] : []),
      {
        text: t("navbar.thermal_printers", "Thermal Printers"),
        path: "/dashboard/settings/thermal-printers",
        scopes: [SCOPES.SETTINGS],
        features: [PLAN_FEATURES.SETTINGS],
      },
      {
        text: t("navbar.print_settings", "Print Settings"),
        path: "/dashboard/settings/print-settings",
        scopes: [SCOPES.SETTINGS],
        features: [PLAN_FEATURES.SETTINGS],
      },
      {
        text: t("navbar.telegram_notifications", "Telegram Notifications"),
        path: "/dashboard/settings/telegram",
        scopes: [SCOPES.SETTINGS],
        features: [PLAN_FEATURES.SETTINGS],
      },
      {
        text: t("navbar.tables_setup", "Tables & Floors"),
        path: "/dashboard/settings/tables",
        scopes: [SCOPES.SETTINGS],
        features: [PLAN_FEATURES.SETTINGS],
      },
      {
        text: t("navbar.settings_home", "Settings Overview"),
        path: "/dashboard/settings",
        exact: true,
        scopes: [SCOPES.SETTINGS],
        features: [PLAN_FEATURES.SETTINGS],
      },
    ],
  },
  {
    id: "help",
    type: "link",
    text: t("navbar.help_contact", "Help & Contact"),
    icon: <IconHelp stroke={iconStroke} />,
    path: "/dashboard/contact-support",
    scopes: [],
    features: [],
  },
  {
    id: "logout",
    type: "action",
    text: t("navbar.logout", "Logout"),
    icon: <IconLogout stroke={iconStroke} />,
    scopes: [],
    features: [],
  },
];

/**
 * Backward compatibility helper for flat navbar list (used in MobileNavbar)
 */
export const getNavbarItems = (t) => {
  const groups = getNavGroups(t);
  const flat = [];
  groups.forEach((g) => {
    if (g.type === "link") {
      flat.push({
        type: "link",
        text: g.text,
        icon: g.icon,
        path: g.path,
        scopes: g.scopes || [],
        features: g.features || [],
      });
    } else if (g.type === "group" && g.items) {
      g.items.forEach((item) => {
        flat.push({
          type: "link",
          text: item.text,
          icon: g.icon,
          path: item.path,
          scopes: item.scopes || [],
          features: item.features || [],
        });
      });
    }
  });
  return flat;
};

export default function Navbar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = getUserDetailsInLocalStorage() || {};
  const { role: userRole, scope, planFeautures } = user;
  const userScopes = scope?.split(",") || [];
  const userPlanFeatures = Array.isArray(planFeautures)
    ? planFeautures
    : planFeautures?.split(",") || [];
  const { theme } = useTheme();
  const [isNavbarCollapsed, setIsNavbarCollapsed] = useContext(NavbarContext);

  const { data: storeSettings } = useStoreSettings();
  const isKitchenEnabled = storeSettings?.isKitchenEnabled !== false;
  const navGroups = getNavGroups(t, { isKitchenEnabled });

  // Group accordion state
  const [collapsedGroups, setCollapsedGroups] = useState({
    inventory: true,
    customers: true,
    vendors: true,
    employees: true,
    reporting: true,
    apps: true,
    settings: true,
  });

  // Auto-expand group if current route matches any child, collapsing other menus
  useEffect(() => {
    let matchedGroupId = null;
    navGroups.forEach((group) => {
      if (group.type === "group") {
        const matchesChild = group.items.some((item) => {
          if (item.exact) return pathname === item.path;
          const basePath = item.path.split("?")[0];
          return pathname === basePath || pathname.startsWith(basePath + "/");
        });
        if (matchesChild) {
          matchedGroupId = group.id;
        }
      }
    });

    if (matchedGroupId) {
      const allCollapsed = {};
      navGroups.forEach((g) => {
        if (g.type === "group") allCollapsed[g.id] = true;
      });
      setCollapsedGroups({ ...allCollapsed, [matchedGroupId]: false });
    }
  }, [pathname]);

  const toggleGroup = (groupId) => {
    setCollapsedGroups((prev) => {
      const isCurrentlyCollapsed = !!prev[groupId];
      if (!isCurrentlyCollapsed) {
        // Toggle closed
        return { ...prev, [groupId]: true };
      }
      // Expand selected group and collapse all other groups
      const allCollapsed = {};
      navGroups.forEach((g) => {
        if (g.type === "group") allCollapsed[g.id] = true;
      });
      return { ...allCollapsed, [groupId]: false };
    });
  };

  const btnToggleNavbar = () => {
    const isNavCollapsed = toggleNavbar();
    setIsNavbarCollapsed(!!isNavCollapsed);
  };

  const handleLogout = async () => {
    try {
      toast.loading(t("appbar.please_wait", "Please wait..."));
      const response = await signOut();
      toast.dismiss();
      if (response?.status === 200) {
        toast.success(response.data?.message || t("navbar.logout_success", "Logged out successfully"));
      }
      navigate("/login", { replace: true });
    } catch (error) {
      toast.dismiss();
      const message = error?.response?.data?.message || t("navbar.logout_failed", "Logout error");
      toast.error(message);
      navigate("/login", { replace: true });
    }
  };

  const isItemActive = (itemPath, currentPath) => {
    if (itemPath === "/dashboard" || itemPath === "/dashboard/home") {
      return currentPath === "/dashboard" || currentPath === "/dashboard/home";
    }
    const basePath = itemPath.split("?")[0];
    return currentPath === basePath || currentPath.startsWith(basePath + "/");
  };

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

  // -------------------------------------------------------------
  // Collapsed Sidebar View (Mini Rail Mode)
  // -------------------------------------------------------------
  if (isNavbarCollapsed) {
    return (
      <div className="relative h-screen">
        <div className="flex flex-col items-center h-screen w-20 fixed left-0 top-0 bg-[#0D233A] dark:bg-[#081426] border-r border-[#1C3550] dark:border-[#1E293B] z-40">
          {/* Top Header */}
          <div className="w-full flex flex-col items-center gap-2.5 pt-4 px-2.5 shrink-0 z-50">
            <div className="w-full flex justify-center">
              <AppBarDropdown isCollapsed={true} />
            </div>

            <div className="w-full flex justify-center">
              <QuickNewMenu isCollapsed={true} />
            </div>

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

          {/* Scrollable Nav Icons */}
          <div className="flex-1 w-full flex flex-col items-center gap-2 px-2.5 overflow-y-auto overflow-x-hidden pb-20 pt-1">
            {navGroups
              .filter((group) => {
                if (group.type === "link") return hasAccess(group.scopes, group.features);
                if (group.type === "group") {
                  return group.items.some((it) => hasAccess(it.scopes, it.features));
                }
                return true;
              })
              .map((group) => {
                if (group.type === "link") {
                  const isActive = isItemActive(group.path, pathname);
                  return (
                    <Link
                      key={group.id}
                      title={group.text}
                      to={group.path}
                      className={clsx(
                        "w-11 h-11 flex items-center justify-center rounded-lg transition-all",
                        {
                          "bg-[#1C3B5E] text-white font-semibold border-l-4 border-[#2CA01C] rounded-r-lg shadow-sm": isActive,
                          "text-slate-300 hover:bg-[#152E4A] hover:text-white": !isActive,
                        }
                      )}
                    >
                      {React.cloneElement(group.icon, {
                        className: clsx("transition-colors", {
                          "text-white": isActive,
                          "text-slate-400 group-hover:text-white": !isActive,
                        }),
                        size: 20,
                      })}
                    </Link>
                  );
                }

                if (group.type === "action") {
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={handleLogout}
                      title={group.text}
                      className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-all cursor-pointer"
                    >
                      {React.cloneElement(group.icon, { size: 20 })}
                    </button>
                  );
                }

                const hasActiveChild = group.items.some((it) => isItemActive(it.path, pathname));
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      if (group.defaultPath) navigate(group.defaultPath);
                    }}
                    title={group.text}
                    className={clsx(
                      "w-11 h-11 flex items-center justify-center rounded-lg transition-all cursor-pointer",
                      {
                        "bg-[#1C3B5E] text-white font-semibold border-l-4 border-[#2CA01C] rounded-r-lg shadow-sm": hasActiveChild,
                        "text-slate-300 hover:bg-[#152E4A] hover:text-white": !hasActiveChild,
                      }
                    )}
                  >
                    {React.cloneElement(group.icon, {
                      className: clsx("transition-colors", {
                        "text-white": hasActiveChild,
                        "text-slate-400 group-hover:text-white": !hasActiveChild,
                      }),
                      size: 20,
                    })}
                  </button>
                );
              })}
          </div>
        </div>

        {/* Toggle Uncollapse Button */}
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

  // -------------------------------------------------------------
  // Expanded Sidebar View (Preserving Dark Navy Design)
  // -------------------------------------------------------------
  return (
    <div className="relative h-screen">
      <div className="flex flex-col items-start h-screen md:w-72 fixed left-0 top-0 bg-[#0D233A] dark:bg-[#081426] border-r border-[#1C3550] dark:border-[#1E293B] text-slate-200 z-40 select-none">

        {/* Top Header in Sidebar */}
        <div className="w-full px-3.5 pt-4 pb-2 shrink-0 z-50 space-y-2">
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 min-w-0">
              <AppBarDropdown isCollapsed={false} />
            </div>
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

          <div className="w-full my-1">
            <QuickNewMenu isCollapsed={false} />
          </div>

          <div className="w-full h-[1px] bg-[#1C3550] my-1" />
        </div>

        {/* Scrollable Navigation Groups */}
        <div className="flex-1 w-full px-3.5 pb-20 overflow-y-auto overflow-x-hidden space-y-1">
          {navGroups.map((entry) => {
            // Direct Link (Dashboard, Orders, Help & Contact)
            if (entry.type === "link") {
              if (!hasAccess(entry.scopes, entry.features)) return null;
              const isActive = isItemActive(entry.path, pathname);
              return (
                <Link
                  key={entry.id}
                  to={entry.path}
                  className={clsx(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all group",
                    {
                      "bg-[#1C3B5E] text-white font-semibold border-l-4 border-[#2CA01C] rounded-l-none shadow-xs": isActive,
                      "text-slate-300 hover:bg-[#152E4A] hover:text-white": !isActive,
                    }
                  )}
                >
                  {React.cloneElement(entry.icon, {
                    className: clsx("transition-colors shrink-0", {
                      "text-[#2CA01C]": isActive,
                      "text-slate-400 group-hover:text-white": !isActive,
                    }),
                    size: 19,
                  })}
                  <span className="truncate">{entry.text}</span>
                </Link>
              );
            }

            // Direct Action (Logout)
            if (entry.type === "action") {
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-all cursor-pointer text-left"
                >
                  {React.cloneElement(entry.icon, {
                    className: "text-slate-400 group-hover:text-red-400 shrink-0",
                    size: 19,
                  })}
                  <span className="truncate">{entry.text}</span>
                </button>
              );
            }

            // Collapsible Group
            const validChildren = entry.items.filter((child) =>
              hasAccess(child.scopes, child.features)
            );
            if (validChildren.length === 0) return null;

            const isCollapsed = !!collapsedGroups[entry.id];
            const hasActiveChild = validChildren.some((child) =>
              isItemActive(child.path, pathname)
            );

            return (
              <div key={entry.id} className="w-full flex flex-col">
                <button
                  type="button"
                  onClick={() => toggleGroup(entry.id)}
                  className={clsx(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all group cursor-pointer text-left select-none",
                    hasActiveChild && isCollapsed
                      ? "bg-[#1C3B5E]/60 text-white font-semibold"
                      : "text-slate-300 hover:bg-[#152E4A] hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {React.cloneElement(entry.icon, {
                      className: clsx("transition-colors shrink-0", {
                        "text-[#2CA01C]": hasActiveChild,
                        "text-slate-400 group-hover:text-white": !hasActiveChild,
                      }),
                      size: 19,
                    })}
                    <span className="truncate">{entry.text}</span>
                  </div>
                  <IconChevronDown
                    size={15}
                    className={clsx("transition-transform duration-200 text-slate-400", {
                      "rotate-180": !isCollapsed,
                      "rotate-0": isCollapsed,
                    })}
                  />
                </button>

                {/* Submenu Accordion */}
                {!isCollapsed && (
                  <div className="flex flex-col gap-0.5 ml-4 pl-3 border-l border-[#1C3550] my-1">
                    {validChildren.map((child, cIdx) => {
                      const isChildActive = isItemActive(child.path, pathname);
                      return (
                        <Link
                          key={cIdx}
                          to={child.path}
                          className={clsx(
                            "w-full px-2.5 py-1.5 rounded-md text-xs transition-colors truncate",
                            isChildActive
                              ? "bg-[#1C3B5E] text-[#2CA01C] font-bold"
                              : "text-slate-400 hover:text-white hover:bg-[#152E4A]/80"
                          )}
                        >
                          {child.text}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
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
