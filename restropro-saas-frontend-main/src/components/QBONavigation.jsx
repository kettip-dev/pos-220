import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import {
  IconBookmark,
  IconHome,
  IconChartLine,
  IconGridDots,
  IconAdjustmentsHorizontal,
  IconDeviceIpadHorizontal,
  IconCashRegister,
  IconArmchair,
  IconToolsKitchen3,
  IconFriends,
  IconBuildingWarehouse,
  IconDatabase,
  IconUsersGroup,
  IconSettings,
  IconSettings2,
  IconChevronUp,
  IconChevronDown,
  IconArrowBarToLeft,
  IconArrowBarToRight,
  IconHelp,
  IconMenu2,
  IconX,
  IconCheck,
  IconReceiptTax,
  IconTruck,
  IconLayoutGrid,
  IconPin,
  IconTag,
} from "@tabler/icons-react";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { SCOPES, PLAN_FEATURES, hasFullBusinessAccess } from "../config/scopes";
import { REPORT_CATEGORIES } from "../config/reportCatalog";
import BusinessSwitcher from "./BusinessSwitcher";
import AppBarDropdown from "./AppBarDropdown";
import QuickNewMenu from "./QuickNewMenu";
import { useStoreSettings } from "../controllers/settings.controller";
import { getImageURL } from "../helpers/ImageHelper";

const PINNED_STORAGE_KEY = "restro_qbo_pinned_apps_v6";
const BOOKMARKS_STORAGE_KEY = "restro_qbo_bookmarks_v3";

const DEFAULT_PINNED_IDS = ["orders", "inventory", "stock_adjustment", "stock_transfers", "customers", "settings"];

const DEFAULT_BOOKMARKS = [
  { label: "POS Register", path: "/dashboard/pos" },
  { label: "Floor Plan & Tables", path: "/dashboard/tables" },
  { label: "Invoices & Receipts", path: "/dashboard/invoices" },
  { label: "Reports & Analytics", path: "/dashboard/reports" },
];

export function useQBOAccess() {
  const user = getUserDetailsInLocalStorage();
  const { role: userRole, scope, planFeautures } = user || {};
  const userScopes = scope?.split(",") || [];
  const userPlanFeatures = Array.isArray(planFeautures)
    ? planFeautures
    : planFeautures?.split(",") || [];

  const hasAccess = useCallback(
    (requiredScopes = [], requiredFeatures = []) => {
      if (userRole === "admin") return true;
      if (hasFullBusinessAccess(userRole)) return true;
      const hasFeature =
        requiredFeatures.length === 0 ||
        requiredFeatures.some((f) => userPlanFeatures.includes(f));
      const hasScope =
        requiredScopes.length === 0 ||
        requiredScopes.some((s) => userScopes.includes(s));
      return hasFeature && hasScope;
    },
    [userRole, userPlanFeatures, userScopes]
  );

  return { hasAccess, userRole, userScopes, userPlanFeatures };
}

export function getQBOAppCategories(t, options = {}) {
  const isKitchenEnabled = options.isKitchenEnabled !== false;
  return [
    {
      id: "dashboard",
      shortLabel: t("navbar.dashboard", "Dashboard"),
      label: t("navbar.dashboard", "Dashboard"),
      Icon: IconHome,
      badgeBg: "bg-transparent text-gray-700 dark:text-slate-300",
      badgeIcon: <IconHome size={18} stroke={1.8} />,
      railIcon: <IconHome size={20} stroke={1.8} />,
      defaultPath: "/dashboard/home",
      scopes: [],
      features: [],
      items: [
        {
          label: t("navbar.dashboard_overview", "Dashboard Overview"),
          path: "/dashboard/home",
          scopes: [],
          features: [],
        },
      ],
    },
    {
      id: "orders",
      shortLabel: t("navbar.orders", "Orders"),
      label: t("navbar.orders", "Orders"),
      Icon: IconToolsKitchen3,
      badgeBg: "bg-transparent text-gray-700 dark:text-slate-300",
      badgeIcon: <IconToolsKitchen3 size={18} stroke={1.8} />,
      railIcon: <IconToolsKitchen3 size={20} stroke={1.8} />,
      defaultPath: "/dashboard/invoices",
      scopes: [
        SCOPES.INVOICES,
        SCOPES.VIEW_INVOICE_AUDIT_LOG,
      ],
      features: [PLAN_FEATURES.INVOICES],
      items: [
        {
          label: t("navbar.invoices", "Invoices & Receipts"),
          path: "/dashboard/invoices",
          scopes: [SCOPES.INVOICES],
          features: [PLAN_FEATURES.INVOICES],
        },
        {
          label: t("navbar.audit_logs", "Invoice Audit Logs"),
          path: "/dashboard/audit-logs",
          scopes: [SCOPES.VIEW_INVOICE_AUDIT_LOG],
          features: [PLAN_FEATURES.INVOICES],
        },
      ],
    },
    {
      id: "promotions",
      shortLabel: t("navbar.promotions_short", "Deals"),
      label: t("navbar.promotions", "Promotions & Deals"),
      Icon: IconTag,
      badgeBg: "bg-transparent text-gray-700 dark:text-slate-300",
      badgeIcon: <IconTag size={18} stroke={1.8} />,
      railIcon: <IconTag size={20} stroke={1.8} />,
      defaultPath: "/dashboard/promotions",
      scopes: [SCOPES.SETTINGS, SCOPES.POS, SCOPES.ORDERS],
      features: [PLAN_FEATURES.SETTINGS, PLAN_FEATURES.POS],
      items: [
        {
          label: t("navbar.promotions_list", "Campaigns & Coupons"),
          path: "/dashboard/promotions",
          scopes: [SCOPES.SETTINGS, SCOPES.POS],
          features: [PLAN_FEATURES.SETTINGS, PLAN_FEATURES.POS],
        },
      ],
    },
    {
      id: "inventory",
      shortLabel: t("navbar.inventory", "Inventory"),
      label: t("navbar.inventory", "Inventory"),
      Icon: IconBuildingWarehouse,
      badgeBg: "bg-transparent text-gray-700 dark:text-slate-300",
      badgeIcon: <IconBuildingWarehouse size={18} stroke={1.8} />,
      railIcon: <IconBuildingWarehouse size={20} stroke={1.8} />,
      defaultPath: "/dashboard/inventory",
      scopes: [SCOPES.INVENTORY],
      features: [PLAN_FEATURES.INVENTORY],
      items: [
        {
          label: t("navbar.inventory_items", "Stock & Items"),
          path: "/dashboard/inventory",
          scopes: [SCOPES.INVENTORY],
          features: [PLAN_FEATURES.INVENTORY],
        },
        {
          label: t("navbar.inventory_dashboard", "Inventory Overview"),
          path: "/dashboard/inventory/dashboard",
          scopes: [SCOPES.INVENTORY],
          features: [PLAN_FEATURES.INVENTORY],
        },
        {
          label: t("navbar.stock_movements", "Stock Movements & Logs"),
          path: "/dashboard/inventory/stock-movements",
          scopes: [SCOPES.INVENTORY],
          features: [PLAN_FEATURES.INVENTORY],
        },
        {
          label: t("navbar.stock_adjustment", "Stock Adjustment"),
          path: "/dashboard/inventory/adjustments",
          scopes: [SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY],
          features: [PLAN_FEATURES.INVENTORY],
        },
        {
          label: t("navbar.stock_transfers", "Stock Transfers"),
          path: "/dashboard/inventory/transfers",
          scopes: [SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY],
          features: [PLAN_FEATURES.INVENTORY],
        },
      ],
    },
    {
      id: "stock_adjustment",
      shortLabel: t("navbar.stock_adjustment", "Stock Adjustment"),
      label: t("navbar.stock_adjustment", "Stock Adjustment"),
      Icon: IconDatabase,
      badgeBg: "bg-transparent text-gray-700 dark:text-slate-300",
      badgeIcon: <IconDatabase size={18} stroke={1.8} />,
      railIcon: <IconDatabase size={20} stroke={1.8} />,
      defaultPath: "/dashboard/inventory/adjustments",
      scopes: [SCOPES.INVENTORY],
      features: [PLAN_FEATURES.INVENTORY],
      items: [
        {
          label: t("navbar.stock_adjustment", "Stock Adjustment"),
          path: "/dashboard/inventory/adjustments",
          scopes: [SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY],
          features: [PLAN_FEATURES.INVENTORY],
        },
      ],
    },
    {
      id: "stock_transfers",
      shortLabel: t("navbar.stock_transfers", "Stock Transfers"),
      label: t("navbar.stock_transfers", "Stock Transfers"),
      Icon: IconTruck,
      badgeBg: "bg-transparent text-gray-700 dark:text-slate-300",
      badgeIcon: <IconTruck size={18} stroke={1.8} />,
      railIcon: <IconTruck size={20} stroke={1.8} />,
      defaultPath: "/dashboard/inventory/transfers",
      scopes: [SCOPES.INVENTORY],
      features: [PLAN_FEATURES.INVENTORY],
      items: [
        {
          label: t("navbar.stock_transfers", "Stock Transfers"),
          path: "/dashboard/inventory/transfers",
          scopes: [SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY],
          features: [PLAN_FEATURES.INVENTORY],
        },
      ],
    },
    {
      id: "vendors",
      shortLabel: t("navbar.vendors", "Vendors"),
      label: t("navbar.vendors", "Vendors"),
      Icon: IconTruck,
      badgeBg: "bg-transparent text-gray-700 dark:text-slate-300",
      badgeIcon: <IconTruck size={18} stroke={1.8} />,
      railIcon: <IconTruck size={20} stroke={1.8} />,
      defaultPath: "/dashboard/suppliers",
      scopes: [SCOPES.INVENTORY],
      features: [PLAN_FEATURES.INVENTORY],
      items: [
        {
          label: t("navbar.vendors_directory", "Suppliers Directory"),
          path: "/dashboard/suppliers",
          scopes: [SCOPES.INVENTORY],
          features: [PLAN_FEATURES.INVENTORY],
        },
        {
          label: t("navbar.purchase_orders", "Purchase Orders"),
          path: "/dashboard/purchase-orders",
          scopes: [SCOPES.INVENTORY],
          features: [PLAN_FEATURES.INVENTORY],
        },
      ],
    },
    {
      id: "customers",
      shortLabel: t("navbar.customers", "Customers"),
      label: t("navbar.customers", "Customer Hub"),
      Icon: IconFriends,
      badgeBg: "bg-transparent text-gray-700 dark:text-slate-300",
      badgeIcon: <IconFriends size={18} stroke={1.8} />,
      railIcon: <IconFriends size={20} stroke={1.8} />,
      defaultPath: "/dashboard/customers",
      scopes: [SCOPES.CUSTOMERS],
      features: [PLAN_FEATURES.CUSTOMERS],
      items: [
        {
          label: t("navbar.customers", "Customer Directory"),
          path: "/dashboard/customers",
          scopes: [SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS, SCOPES.MANAGE_CUSTOMERS],
          features: [PLAN_FEATURES.CUSTOMERS],
        },
        {
          label: t("navbar.customer_dues", "Customer Dues"),
          path: "/dashboard/customer-dues",
          scopes: [SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS, SCOPES.MANAGE_CUSTOMERS, SCOPES.POS],
          features: [PLAN_FEATURES.CUSTOMERS],
        },
        {
          label: t("navbar.customer_groups", "Customer Groups"),
          path: "/dashboard/customer-groups",
          scopes: [SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS, SCOPES.MANAGE_CUSTOMERS],
          features: [PLAN_FEATURES.CUSTOMERS],
        },
        {
          label: t("navbar.import_customers", "Import Customers"),
          path: "/dashboard/customers/import",
          scopes: [SCOPES.CUSTOMERS, SCOPES.MANAGE_CUSTOMERS],
          features: [PLAN_FEATURES.CUSTOMERS],
        },
        {
          label: t("navbar.feedbacks", "Customer Feedback"),
          path: "/dashboard/feedbacks",
          scopes: [SCOPES.FEEDBACK],
          features: [PLAN_FEATURES.FEEDBACK],
        },
      ],
    },
    {
      id: "employees",
      shortLabel: t("navbar.employees", "Employees"),
      label: t("navbar.employees", "Employees & Staff"),
      Icon: IconUsersGroup,
      badgeBg: "bg-transparent text-gray-700 dark:text-slate-300",
      badgeIcon: <IconUsersGroup size={18} stroke={1.8} />,
      railIcon: <IconUsersGroup size={20} stroke={1.8} />,
      defaultPath: "/dashboard/users",
      scopes: [SCOPES.USER, SCOPES.SETTINGS],
      features: [PLAN_FEATURES.USER, PLAN_FEATURES.SETTINGS],
      items: [
        {
          label: t("navbar.users", "Staff & Users"),
          path: "/dashboard/users",
          scopes: [SCOPES.USER],
          features: [PLAN_FEATURES.USER],
        },
        {
          label: t("navbar.table_assignments", "Table Assignments"),
          path: "/dashboard/settings/table-assignments",
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.shift_roster", "Roster & Shifts"),
          path: "/dashboard/shifts-roster",
          scopes: [SCOPES.USER, SCOPES.SETTINGS],
          features: [PLAN_FEATURES.USER, PLAN_FEATURES.SETTINGS],
        },
      ],
    },
    {
      id: "reporting",
      shortLabel: t("navbar.reporting", "Reporting"),
      label: t("navbar.reporting", "Reporting & Finance"),
      Icon: IconChartLine,
      badgeBg: "bg-transparent text-gray-700 dark:text-slate-300",
      badgeIcon: <IconChartLine size={18} stroke={1.8} />,
      railIcon: <IconChartLine size={20} stroke={1.8} />,
      defaultPath: "/dashboard/reports",
      scopes: [SCOPES.REPORTS],
      features: [PLAN_FEATURES.REPORTS],
      items: [
        {
          label: t("navbar.reports", "Reports & Analytics"),
          path: "/dashboard/reports",
          scopes: [SCOPES.REPORTS],
          features: [PLAN_FEATURES.REPORTS],
        },
        {
          label: t("navbar.staff_attendance", "Staff Attendance"),
          path: "/dashboard/attendance",
          scopes: [SCOPES.REPORTS, SCOPES.USER, SCOPES.SETTINGS],
          features: [PLAN_FEATURES.REPORTS],
        },
      ],
    },
    {
      id: "settings",
      shortLabel: t("navbar.settings", "Settings"),
      label: t("navbar.settings", "Store & Settings"),
      Icon: IconSettings,
      badgeBg: "bg-transparent text-gray-700 dark:text-slate-300",
      badgeIcon: <IconSettings size={18} stroke={1.8} />,
      railIcon: <IconSettings size={20} stroke={1.8} />,
      defaultPath: "/dashboard/settings",
      scopes: [SCOPES.SETTINGS],
      features: [PLAN_FEATURES.SETTINGS],
      items: [
        {
          label: t("navbar.store_details", "Store Details"),
          path: "/dashboard/settings/details",
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.menu_items", "Menu Items & Pricing"),
          path: "/dashboard/settings/menu-items",
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.menu_languages", "Menu Languages"),
          path: "/dashboard/settings/menu-languages",
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.categories", "Categories Setup"),
          path: "/dashboard/settings/menu-items/categories",
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.addons", "Add-ons"),
          path: "/dashboard/settings/menu-items/addons",
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.promotions", "Promotions & Discounts"),
          path: "/dashboard/promotions",
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        ...(isKitchenEnabled ? [{
          label: t("navbar.kitchen_stations", "Kitchen Stations"),
          path: "/dashboard/settings/kitchen-stations",
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        }] : []),
        {
          label: t("navbar.tables_settings", "Tables & Floor Setup"),
          path: "/dashboard/settings/tables",
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.taxes_charges", "Taxes & Charges"),
          path: "/dashboard/settings/tax-setup",
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.payment_types", "Payment Types"),
          path: "/dashboard/settings/payment-types",
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.print_settings", "Print & Receipt Settings"),
          path: "/dashboard/settings/print-settings",
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.thermal_printers", "Thermal Printers Hardware"),
          path: "/dashboard/settings/thermal-printers",
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
        {
          label: t("navbar.telegram_notifications", "Telegram Notifications"),
          path: "/dashboard/settings/telegram",
          scopes: [SCOPES.SETTINGS],
          features: [PLAN_FEATURES.SETTINGS],
        },
      ],
    },
    {
      id: "support",
      shortLabel: t("navbar.support", "Support"),
      label: t("navbar.support", "Help & Preferences"),
      Icon: IconHelp,
      badgeBg: "bg-transparent text-gray-700 dark:text-slate-300",
      isMarketing: true,
      badgeIcon: <IconHelp size={18} stroke={1.8} />,
      railIcon: <IconHelp size={20} stroke={1.8} />,
      defaultPath: "/dashboard/contact-support",
      scopes: [],
      features: [],
      items: [
        {
          label: t("navbar.user_guide", "User Guide"),
          path: "/dashboard/user-guide",
          scopes: [],
          features: [],
        },
        {
          label: t("navbar.contact_support", "Contact Support"),
          path: "/dashboard/contact-support",
          scopes: [],
          features: [],
        },
        {
          label: t("navbar.language", "Language Settings"),
          path: "/dashboard/language",
          scopes: [],
          features: [],
        },
        {
          label: t("navbar.profile", "My Profile"),
          path: "/dashboard/profile",
          scopes: [],
          features: [],
        },
      ],
    },
  ];
}

// VS Code–style tooltip for the icon rail: dark label with an arrow, shown to the right
// of the hovered (or keyboard-focused) item. Rendered in a portal with fixed positioning
// so the rail's scroll container can't clip it. Touch taps don't trigger it.
function RailTooltip({ label, children, className }) {
  const anchorRef = useRef(null);
  const timerRef = useRef(null);
  const [pos, setPos] = useState(null);

  const show = useCallback((delay) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ top: r.top + r.height / 2, left: r.right + 8 });
    }, delay);
  }, []);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setPos(null);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div
      ref={anchorRef}
      className={className}
      onPointerEnter={(e) => e.pointerType !== "touch" && show(250)}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(e) => e.target.matches?.(":focus-visible") && show(0)}
      onBlur={hide}
    >
      {children}
      {pos && label &&
        createPortal(
          <div
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-[200] -translate-y-1/2 pointer-events-none animate-in fade-in duration-100"
          >
            <span className="absolute -left-[5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 bg-[#1F2937] dark:bg-[#2B3A4F] border-l border-b border-black/10 dark:border-white/10" />
            <span className="relative block whitespace-nowrap rounded-md bg-[#1F2937] dark:bg-[#2B3A4F] px-2.5 py-1.5 text-[12px] font-medium leading-normal text-white shadow-lg ring-1 ring-black/10 dark:ring-white/10">
              {label}
            </span>
          </div>,
          document.body
        )}
    </div>
  );
}

// Rail tile: icon only (like the VS Code activity bar). The label shows as a tooltip on hover.
function RailButton({ active, icon, label, onClick, title }) {
  const tip = title || label;
  return (
    <RailTooltip label={tip} className="w-full">
      <button
        type="button"
        onClick={onClick}
        aria-label={tip}
        aria-current={active ? "page" : undefined}
        className="group relative w-full h-[48px] flex items-center justify-center rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2CA01C]/50 active:scale-95 transition"
      >
        {active && (
          <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-[#2CA01C] rounded-r-full" />
        )}
        <span
          className={clsx(
            "w-[42px] h-[42px] rounded-xl flex items-center justify-center transition-colors",
            active
              ? "bg-[#2CA01C]/10 text-[#2CA01C] dark:bg-[#2CA01C]/20"
              : "text-gray-500 dark:text-slate-400 group-hover:bg-gray-100 group-hover:text-gray-900 dark:group-hover:bg-slate-800 dark:group-hover:text-white"
          )}
        >
          {icon}
        </span>
      </button>
    </RailTooltip>
  );
}

export default function QBONavigation({ children }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { data: storeSettingsData } = useStoreSettings();
  const storeLogo = storeSettingsData?.storeImage;
  const storeName = storeSettingsData?.storeName;

  const { hasAccess } = useQBOAccess();
  const user = getUserDetailsInLocalStorage();

  const isKitchenEnabled = storeSettingsData?.isKitchenEnabled !== false;
  const rawCategories = useMemo(() => getQBOAppCategories(t, { isKitchenEnabled }), [t, isKitchenEnabled]);

  // Filter categories and subitems strictly by active tenant permissions
  const categories = useMemo(() => {
    return rawCategories
      .map((cat) => {
        const visibleItems = cat.items.filter((it) =>
          hasAccess(it.scopes || [], it.features || [])
        );
        return { ...cat, items: visibleItems };
      })
      .filter((cat) => cat.items.length > 0);
  }, [rawCategories, hasAccess]);

  // Sub-panel mode: "all_apps" (default open matching image), "reports", "bookmarks", or null
  const [subPanelMode, setSubPanelMode] = useState(() => {
    try {
      const saved = localStorage.getItem("restro_qbo_panel_mode_v3");
      if (saved !== null) return saved === "closed" ? null : saved;
    } catch {}
    return "all_apps";
  });

  const updateSubPanelMode = (mode) => {
    setSubPanelMode(mode);
    try {
      localStorage.setItem("restro_qbo_panel_mode_v3", mode === null ? "closed" : mode);
    } catch {}
  };

  // Accordion state: only one menu group is open at a time; others collapse
  const [expandedGroups, setExpandedGroups] = useState(() => {
    try {
      const current = window.location.pathname;
      const initialCats = getQBOAppCategories((k, def) => def || k);
      const allItems = initialCats.flatMap((cat) => cat.items || []);
      const exact = allItems.find(
        (it) => it.path === current || (it.path === "/dashboard/home" && current === "/dashboard")
      );
      let matchedPath = exact?.path;
      if (!matchedPath) {
        const prefixMatches = allItems.filter(
          (it) =>
            it.path !== "/dashboard" &&
            it.path !== "/dashboard/home" &&
            current.startsWith(it.path + "/")
        );
        if (prefixMatches.length > 0) {
          prefixMatches.sort((a, b) => b.path.length - a.path.length);
          matchedPath = prefixMatches[0].path;
        }
      }
      if (matchedPath) {
        const matchedCat = initialCats.find((c) =>
          c.items?.some((it) => it.path === matchedPath)
        );
        if (matchedCat) return { [matchedCat.id]: true };
      }
    } catch {}
    return {};
  });

  const [reportCategoriesExpanded, setReportCategoriesExpanded] = useState(true);
  const [customiseModalOpen, setCustomiseModalOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Pinned categories in the rail
  const [pinnedIds, setPinnedIds] = useState(() => {
    try {
      const raw = localStorage.getItem(PINNED_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return DEFAULT_PINNED_IDS;
  });

  // Bookmarks
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return DEFAULT_BOOKMARKS;
  });

  // Identify the single most specific active item path for current location (prevents multi-highlight bugs)
  const activeItemPath = useMemo(() => {
    const current = location.pathname;
    const currentWithSearch = location.pathname + location.search;
    const allItems = categories.flatMap((cat) => cat.items || []);

    // 0. Exact path + query match first (for tabs / query routes)
    const exactQuery = allItems.find((it) => it.path === currentWithSearch);
    if (exactQuery) return exactQuery.path;

    // 1. Exact path match
    const exact = allItems.find((it) => {
      if (it.path === current) return true;
      if (it.path === "/dashboard/home" && current === "/dashboard") return true;
      if (current.includes("customer-groups") && it.path === "/dashboard/customer-groups") return true;
      return false;
    });
    if (exact) return exact.path;

    // 2. Longest matching path prefix for nested subroutes (e.g. /dashboard/inventory/adjustments/add)
    const prefixMatches = allItems.filter(
      (it) =>
        it.path !== "/dashboard" &&
        it.path !== "/dashboard/home" &&
        current.startsWith(it.path + "/")
    );

    if (prefixMatches.length > 0) {
      prefixMatches.sort((a, b) => b.path.length - a.path.length);
      return prefixMatches[0].path;
    }

    return null;
  }, [location.pathname, categories]);

  // Match current route to a category
  const activeCategoryForRoute = useMemo(() => {
    if (activeItemPath) {
      const found = categories.find((cat) =>
        cat.items?.some((it) => it.path === activeItemPath)
      );
      if (found) return found.id;
    }
    const current = location.pathname;
    for (const cat of categories) {
      if (
        cat.items?.some(
          (it) =>
            current === it.path ||
            (it.path !== "/dashboard" && current.startsWith(it.path + "/"))
        )
      ) {
        return cat.id;
      }
    }
    return null;
  }, [activeItemPath, location.pathname, categories]);

  // Keep only the active route's group expanded, collapsing other menus
  useEffect(() => {
    if (activeCategoryForRoute) {
      setExpandedGroups({
        [activeCategoryForRoute]: true,
      });
    } else {
      setExpandedGroups({});
    }
    setMobileDrawerOpen(false);
  }, [location.pathname, activeCategoryForRoute]);

  // Accordion toggle: opening any menu group collapses all other open menus
  const toggleGroupExpand = (groupId) => {
    setExpandedGroups((prev) => {
      const isCurrentlyOpen = !!prev[groupId];
      if (isCurrentlyOpen) {
        // Toggle closed if clicked again
        return {};
      }
      // Expand selected menu group and collapse all other menus
      return { [groupId]: true };
    });
  };

  const togglePinCategory = (catId) => {
    setPinnedIds((prev) => {
      const next = prev.includes(catId)
        ? prev.filter((id) => id !== catId)
        : [...prev, catId];
      try {
        localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const toggleBookmarkItem = (item) => {
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.path === item.path);
      const next = exists
        ? prev.filter((b) => b.path !== item.path)
        : [...prev, { label: item.label, path: item.path }];
      try {
        localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const isHomeRoute =
    location.pathname === "/dashboard" || location.pathname === "/dashboard/home";
  const isReportsRoute = location.pathname.startsWith("/dashboard/reports");

  const isSubItemActive = useCallback(
    (item) => {
      if (!item) return false;
      if (activeItemPath) {
        return item.path === activeItemPath;
      }
      return false;
    },
    [activeItemPath]
  );

  const pinnedCategories = useMemo(
    () => categories.filter((c) => pinnedIds.includes(c.id)),
    [categories, pinnedIds]
  );

  const activeReportCategory = searchParams.get("category") || "All";

  // Handlers for rail clicks
  const handleRailBookmarksClick = () => {
    updateSubPanelMode(subPanelMode === "bookmarks" ? "all_apps" : "bookmarks");
  };

  const handleRailReportsClick = () => {
    updateSubPanelMode("reports");
    if (!isReportsRoute) {
      navigate("/dashboard/reports");
    }
  };

  const handleRailAllAppsClick = () => {
    updateSubPanelMode(subPanelMode === "all_apps" ? null : "all_apps");
  };

  const handleRailPinnedClick = (cat) => {
    updateSubPanelMode("all_apps");
    setExpandedGroups({ [cat.id]: true });
    if (cat.defaultPath) {
      navigate(cat.defaultPath);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-white dark:bg-[#08101D] text-foreground font-sans">
      {/* 1. FAR-LEFT ICON RAIL (Desktop & Tablet >= md) */}
      <aside className="hidden md:flex flex-col items-center w-[64px] shrink-0 bg-white dark:bg-[#0B1522] border-r border-[#E3E5E8] dark:border-slate-800/90 h-screen sticky top-0 z-50 select-none py-3 justify-between">
        {/* Top: Logo & + Create */}
        <div className="w-full flex flex-col items-center shrink-0">
          {/* Circular Store Logo / Monogram */}
          <RailTooltip label={storeName || "Bong POS Home"} className="mb-2.5 shrink-0">
          <Link
            to="/dashboard/home"
            aria-label={storeName || "Bong POS Home"}
            className="w-10 h-10 rounded-full bg-[#2CA01C] hover:bg-[#258717] flex items-center justify-center text-white shadow-xs transition-transform active:scale-95 shrink-0 overflow-hidden ring-1 ring-black/5 dark:ring-white/10"
          >
            {storeLogo ? (
              <img
                src={getImageURL(storeLogo)}
                alt={storeName || "Store Logo"}
                className="w-full h-full object-cover"
              />
            ) : storeName ? (
              <span className="font-bold text-xs uppercase tracking-tight select-none">
                {storeName.trim().slice(0, 2)}
              </span>
            ) : (
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                <path d="M13 9a6 6 0 0 0-6 6v8h3v-8a3 3 0 1 1 6 0v8h3v-8a6 6 0 0 0-6-6z" fill="white" />
                <path d="M19 23a6 6 0 0 0 6-6V9h-3v8a3 3 0 1 1-6 0V9h-3v8a6 6 0 0 0 6 6z" fill="white" />
              </svg>
            )}
          </Link>
          </RailTooltip>

          {/* + Create Button */}
          <RailTooltip label={t("quick_new.create", "Create")} className="w-full px-1 shrink-0 mb-1">
            <QuickNewMenu qboRail={true} />
          </RailTooltip>
        </div>

        {/* Middle: Rail Items */}
        <div className="w-full flex flex-col items-center overflow-y-auto no-scrollbar flex-1 py-1">
          <div className="w-full flex flex-col items-center gap-0.5 px-1.5">
            <RailButton
              active={subPanelMode === "bookmarks"}
              onClick={handleRailBookmarksClick}
              label={t("navbar.bookmarks", "Bookmarks")}
              icon={<IconBookmark size={20} stroke={subPanelMode === "bookmarks" ? 2.2 : 1.8} />}
            />
            <RailButton
              active={subPanelMode === "all_apps"}
              onClick={handleRailAllAppsClick}
              label={t("navbar.all_apps", "Apps")}
              icon={<IconGridDots size={20} stroke={subPanelMode === "all_apps" ? 2.2 : 1.8} />}
            />
          </div>

          {/* PINNED Section */}
          {pinnedCategories.length > 0 && (
            <div className="w-full mt-2 pt-2 flex flex-col items-center gap-0.5 px-1.5">
              <div className="w-full flex items-center gap-1 mb-1 px-0.5">
                <span className="flex-1 h-px bg-gray-200 dark:bg-slate-800" />
                <RailTooltip label={t("navbar.customise_pinned", "Customise pinned apps")} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setCustomiseModalOpen(true)}
                    aria-label={t("navbar.customise_pinned", "Customise pinned apps")}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full text-gray-400 dark:text-slate-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-slate-800 dark:hover:text-white active:scale-95 transition cursor-pointer"
                  >
                    <IconPin size={14} stroke={2} />
                  </button>
                </RailTooltip>
                <span className="flex-1 h-px bg-gray-200 dark:bg-slate-800" />
              </div>

              {pinnedCategories.map((cat) => {
                const isCatActive = activeCategoryForRoute === cat.id;
                const IconComponent = cat.Icon;
                return (
                  <div key={cat.id} className="relative group w-full">
                    <RailButton
                      active={isCatActive}
                      onClick={() => handleRailPinnedClick(cat)}
                      title={cat.label}
                      label={cat.shortLabel}
                      icon={
                        IconComponent ? (
                          <IconComponent size={20} stroke={isCatActive ? 2.2 : 1.8} />
                        ) : (
                          cat.railIcon
                        )
                      }
                    />

                    {/* Quick 1-click Unpin button on hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinCategory(cat.id);
                      }}
                      title={t("navbar.unpin", "Unpin")}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white dark:bg-slate-700 text-gray-500 hover:text-red-600 ring-1 ring-gray-200 dark:ring-slate-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm cursor-pointer z-10"
                    >
                      <IconX size={11} stroke={2.5} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Customise */}
        <div className="w-full pt-1.5 border-t border-gray-200/80 dark:border-slate-800 px-1.5 shrink-0">
          <RailButton
            active={false}
            onClick={() => setCustomiseModalOpen(true)}
            label={t("navbar.customise", "Customise")}
            icon={<IconAdjustmentsHorizontal size={20} stroke={1.8} />}
          />
        </div>
      </aside>

      {/* 2. SECONDARY ALL APPS / FLYOUT PANEL */}
      {subPanelMode && (
        <aside className="hidden md:flex flex-col w-[268px] shrink-0 bg-white dark:bg-[#111C2D] border-r border-[#E3E5E8] dark:border-slate-800/90 h-screen sticky top-0 z-30 select-none animate-in fade-in slide-in-from-left-2 duration-150">
          {/* Sub-Panel Header aligned with Top Header bar */}
          <div className="h-14 pl-4 pr-2 flex items-center justify-between gap-2 shrink-0 border-b border-[#E3E5E8] dark:border-slate-800/90">
            <span className="min-w-0 truncate text-[15px] font-semibold leading-normal text-gray-900 dark:text-slate-100">
              {subPanelMode === "reports"
                ? t("navbar.reports_and_analytics", "Reports & Analytics")
                : subPanelMode === "bookmarks"
                  ? t("navbar.bookmarks", "Bookmarks")
                  : t("navbar.all_apps_upper", "All apps")}
            </span>
            <button
              type="button"
              onClick={() => updateSubPanelMode(null)}
              title={t("navbar.collapse_panel", "Collapse menu")}
              className="w-[42px] h-[42px] shrink-0 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 active:scale-95 transition cursor-pointer"
            >
              <IconArrowBarToLeft size={18} stroke={2} />
            </button>
          </div>

          {/* Sub-Sidebar Body */}
          <div className="flex-1 overflow-y-auto px-3 pb-8 space-y-1">
            {/* MODE: ALL APPS ACCORDION */}
            {subPanelMode === "all_apps" && (
              <div className="space-y-1">
                {categories.map((cat) => {
                  const isExpanded = !!expandedGroups[cat.id];
                  const hasActiveChild = cat.items.some((it) => isSubItemActive(it));
                  const isCatPinned = pinnedIds.includes(cat.id);
                  const isSingle = cat.items.length === 1;
                  const singleItem = isSingle ? cat.items[0] : null;
                  const isSingleBookmarked = singleItem
                    ? bookmarks.some((b) => b.path === singleItem.path)
                    : false;

                  // Merged single direct-link item (e.g. Reports) - removes redundant accordion header + subitem duplicate
                  if (isSingle) {
                    const active = isSubItemActive(singleItem);
                    return (
                      <div key={cat.id} className="pb-1">
                        <div
                          className={clsx(
                            "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[14px] transition-colors group/item",
                            active
                              ? "font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-800"
                              : "font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100/70 dark:hover:bg-slate-800/60"
                          )}
                        >
                          <Link
                            to={singleItem.path}
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <span
                              className={clsx(
                                "w-5 h-5 flex items-center justify-center shrink-0 transition-colors",
                                active
                                  ? "text-[#2CA01C] dark:text-[#2CA01C]"
                                  : "text-gray-500 dark:text-slate-400 group-hover/item:text-gray-800 dark:group-hover/item:text-white"
                              )}
                            >
                              {cat.Icon ? <cat.Icon size={18} stroke={1.8} /> : cat.badgeIcon}
                            </span>
                            <span className="truncate">{cat.label}</span>
                          </Link>

                          <div className="flex items-center gap-1 shrink-0 ml-1">
                            {/* Direct Bookmark button on hover or when bookmarked */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleBookmarkItem(singleItem);
                              }}
                              title={
                                isSingleBookmarked
                                  ? t("navbar.remove_bookmark", "Remove bookmark")
                                  : t("navbar.bookmark_page", "Bookmark page")
                              }
                              className={clsx(
                                "w-6 h-6 rounded-md flex items-center justify-center transition cursor-pointer shrink-0",
                                isSingleBookmarked
                                  ? "text-[#2CA01C] dark:text-[#2CA01C] opacity-100"
                                  : "opacity-0 group-hover/item:opacity-100 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-slate-700"
                              )}
                            >
                              <IconBookmark
                                size={14}
                                stroke={isSingleBookmarked ? 2.2 : 1.8}
                                className={isSingleBookmarked ? "fill-[#2CA01C]" : ""}
                              />
                            </button>

                            {/* Direct Pin / Unpin Button from All Apps */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePinCategory(cat.id);
                              }}
                              title={
                                isCatPinned
                                  ? t("navbar.unpin_from_rail", "Unpin from rail")
                                  : t("navbar.pin_to_rail", "Pin to rail")
                              }
                              className={clsx(
                                "w-6 h-6 rounded-md flex items-center justify-center transition cursor-pointer",
                                isCatPinned
                                  ? "text-[#2CA01C] hover:bg-emerald-50 dark:hover:bg-slate-800 opacity-100"
                                  : "text-gray-400 hover:text-gray-700 dark:hover:text-white opacity-0 group-hover/item:opacity-100 hover:bg-gray-200/60 dark:hover:bg-slate-700"
                              )}
                            >
                              <IconPin
                                size={14}
                                stroke={isCatPinned ? 2.2 : 1.8}
                                className={isCatPinned ? "fill-[#2CA01C]" : ""}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={cat.id} className="pb-1">
                      {/* Accordion Group Header */}
                      <div
                        className={clsx(
                          "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[14px] transition-colors group/header",
                          hasActiveChild
                            ? "font-bold text-gray-900 dark:text-white bg-gray-50/80 dark:bg-slate-800/40"
                            : "font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100/70 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleGroupExpand(cat.id)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <span
                            className={clsx(
                              "w-5 h-5 flex items-center justify-center shrink-0 transition-colors",
                              hasActiveChild
                                ? "text-[#2CA01C] dark:text-[#2CA01C]"
                                : "text-gray-500 dark:text-slate-400 group-hover/header:text-gray-800 dark:group-hover/header:text-white"
                            )}
                          >
                            {cat.Icon ? <cat.Icon size={18} stroke={1.8} /> : cat.badgeIcon}
                          </span>
                          <span className="truncate">{cat.label}</span>
                        </button>

                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          {/* Direct Pin / Unpin Button from All Apps */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePinCategory(cat.id);
                            }}
                            title={isCatPinned ? t("navbar.unpin_from_rail", "Unpin from rail") : t("navbar.pin_to_rail", "Pin to rail")}
                            className={clsx(
                              "w-6 h-6 rounded-md flex items-center justify-center transition cursor-pointer",
                              isCatPinned
                                ? "text-[#2CA01C] hover:bg-emerald-50 dark:hover:bg-slate-800 opacity-100"
                                : "text-gray-400 hover:text-gray-700 dark:hover:text-white opacity-0 group-hover/header:opacity-100 hover:bg-gray-200/60 dark:hover:bg-slate-700"
                            )}
                          >
                            <IconPin
                              size={14}
                              stroke={isCatPinned ? 2.2 : 1.8}
                              className={isCatPinned ? "fill-[#2CA01C]" : ""}
                            />
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleGroupExpand(cat.id)}
                            className="p-0.5 text-gray-500 hover:text-gray-800 dark:hover:text-white transition cursor-pointer"
                          >
                            {cat.isMarketing ? (
                              <span className="text-gray-700 dark:text-slate-300 shrink-0">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M6 3h12l4 6-10 13L2 9z" />
                                  <path d="M2 9h20" />
                                  <path d="M10 3l-2 6 4 13 4-13-2-6" />
                                </svg>
                              </span>
                            ) : isExpanded ? (
                              <IconChevronUp size={16} className="text-gray-600 dark:text-slate-400 shrink-0" />
                            ) : (
                              <IconChevronDown size={16} className="text-gray-600 dark:text-slate-400 shrink-0" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Accordion Subitems */}
                      {isExpanded && (
                        <div className="mt-1 space-y-0.5 pl-7 pr-1 animate-in fade-in-50 duration-150">
                          {cat.items.map((item, idx) => {
                            const active = isSubItemActive(item);
                            const isBookmarked = bookmarks.some((b) => b.path === item.path);

                            return (
                              <div
                                key={idx}
                                className={clsx(
                                  "group flex items-center justify-between rounded-lg px-3 py-1.5 text-[13.5px] transition-colors cursor-pointer",
                                  active
                                    ? "bg-gray-100 dark:bg-slate-800 font-semibold text-gray-900 dark:text-white"
                                    : "text-gray-700 dark:text-slate-300 hover:bg-gray-100/70 dark:hover:bg-slate-800/60 font-normal"
                                )}
                              >
                                <Link to={item.path} className="flex-1 truncate py-0.5">
                                  {item.label}
                                </Link>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleBookmarkItem(item);
                                  }}
                                  title={
                                    isBookmarked
                                      ? t("navbar.remove_bookmark", "Remove bookmark")
                                      : t("navbar.bookmark_page", "Bookmark page")
                                  }
                                  className={clsx(
                                    "w-6 h-6 rounded flex items-center justify-center transition cursor-pointer shrink-0 ml-1.5",
                                    isBookmarked
                                      ? "text-[#2CA01C] dark:text-[#2CA01C] opacity-100"
                                      : "opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-slate-700/50"
                                  )}
                                >
                                  <IconBookmark
                                    size={14}
                                    stroke={isBookmarked ? 2.2 : 1.8}
                                    className={isBookmarked ? "fill-[#2CA01C]" : ""}
                                  />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* MODE: REPORTS & ANALYTICS */}
            {subPanelMode === "reports" && (
              <div className="space-y-1">
                <Link
                  to="/dashboard/reports"
                  className={clsx(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-colors",
                    isReportsRoute && activeReportCategory === "All"
                      ? "bg-[#E8EAED] dark:bg-slate-800 font-semibold text-gray-900 dark:text-white"
                      : "text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800/60"
                  )}
                >
                  <span>{t("reports.standard_reports", "Standard reports")}</span>
                </Link>

                <Link
                  to="/dashboard/reports?category=Favourites"
                  className={clsx(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-colors",
                    activeReportCategory === "Favourites"
                      ? "bg-[#E8EAED] dark:bg-slate-800 font-semibold text-gray-900 dark:text-white"
                      : "text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800/60"
                  )}
                >
                  <span>{t("reports.favourites", "Favourites")}</span>
                </Link>

                {/* Expandable Report Categories */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setReportCategoriesExpanded(!reportCategoriesExpanded)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium text-gray-800 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800/60 transition cursor-pointer"
                  >
                    <span>{t("reports.report_categories", "Report categories")}</span>
                    {reportCategoriesExpanded ? (
                      <IconChevronUp size={15} className="text-gray-500" />
                    ) : (
                      <IconChevronDown size={15} className="text-gray-500" />
                    )}
                  </button>

                  {reportCategoriesExpanded && (
                    <div className="mt-0.5 space-y-0.5 pl-3">
                      {REPORT_CATEGORIES.map((catName) => {
                        const isSelected = activeReportCategory === catName;
                        return (
                          <Link
                            key={catName}
                            to={`/dashboard/reports?category=${encodeURIComponent(catName)}`}
                            className={clsx(
                              "block px-3 py-2 rounded-lg text-[13px] transition-colors",
                              isSelected
                                ? "bg-[#E8EAED] dark:bg-slate-800 font-semibold text-gray-900 dark:text-white"
                                : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800/60 hover:text-gray-900 dark:hover:text-white"
                            )}
                          >
                            {catName}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MODE: BOOKMARKS */}
            {subPanelMode === "bookmarks" && (
              <div className="pt-3 space-y-3">
                <p className="px-1 text-[12px] leading-relaxed text-gray-500 dark:text-slate-400">
                  {t("navbar.bookmarks_hint", "Quick access to your pinned pages and reports.")}
                </p>

                {bookmarks.length === 0 ? (
                  <div className="flex flex-col items-center text-center gap-2 px-4 py-8 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                    <span className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-400">
                      <IconBookmark size={20} stroke={1.8} />
                    </span>
                    <p className="text-[12px] leading-relaxed text-gray-500 dark:text-slate-400">
                      {t("navbar.no_bookmarks", "No bookmarks yet. Use the bookmark icon on any page to add it here.")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {bookmarks.map((bm, idx) => {
                      const active = location.pathname === bm.path;
                      const matchedCat = categories.find(
                        (c) =>
                          c.items?.some((it) => it.path === bm.path) ||
                          c.defaultPath === bm.path
                      );
                      const matchedItem = matchedCat?.items?.find((it) => it.path === bm.path);
                      const label = matchedItem?.label || matchedCat?.label || bm.label;
                      const BmIcon = matchedCat?.Icon || IconBookmark;
                      return (
                        <div
                          key={idx}
                          className={clsx(
                            "group relative flex items-center gap-1 rounded-xl transition-colors",
                            active
                              ? "bg-[#2CA01C]/10 dark:bg-[#2CA01C]/15"
                              : "hover:bg-gray-100 dark:hover:bg-slate-800/60"
                          )}
                        >
                          <Link
                            to={bm.path}
                            className="flex-1 min-w-0 min-h-[44px] flex items-center gap-3 pl-2 pr-1 py-1.5 active:scale-[0.98] transition"
                          >
                            <span
                              className={clsx(
                                "w-8 h-8 shrink-0 rounded-lg flex items-center justify-center",
                                active
                                  ? "bg-[#2CA01C] text-white"
                                  : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400 group-hover:bg-white dark:group-hover:bg-slate-700"
                              )}
                            >
                              <BmIcon size={17} stroke={1.9} />
                            </span>
                            <span
                              className={clsx(
                                "min-w-0 truncate text-[14px] leading-normal",
                                active
                                  ? "font-semibold text-gray-900 dark:text-white"
                                  : "font-medium text-gray-700 dark:text-slate-300"
                              )}
                            >
                              {label}
                            </span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => toggleBookmarkItem(bm)}
                            title={t("navbar.remove_bookmark", "Remove bookmark")}
                            className="w-[42px] h-[42px] shrink-0 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-white dark:hover:bg-slate-700 opacity-100 md:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 active:scale-95 transition cursor-pointer"
                          >
                            <IconX size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* 3. RIGHT MAIN AREA: TOP HEADER BAR + PAGE CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header Bar */}
        <header className="h-14 bg-white dark:bg-[#0D1829] border-b border-[#E3E5E8] dark:border-slate-800/90 px-3 sm:px-5 flex items-center justify-between gap-3 sticky top-0 z-30 shrink-0">
          {/* Left: Mobile hamburger & Expand sub-panel button */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile Hamburger Button (< md) */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
              className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              {mobileDrawerOpen ? <IconX size={20} /> : <IconMenu2 size={20} />}
            </button>

            {/* Expand Sub-Panel Button if sub-panel is closed */}
            {!subPanelMode && (
              <button
                type="button"
                onClick={() => updateSubPanelMode("all_apps")}
                title={t("navbar.expand_panel", "Open navigation menu")}
                className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <IconArrowBarToRight size={16} stroke={2} />
              </button>
            )}

            {/* Business Name / Switcher */}
            <BusinessSwitcher variant="qbo" />
          </div>

          {/* Right: Quick Tables & POS Launch Pills & Utility Icons */}
          <div className="flex items-center gap-2 shrink-0">
            {hasAccess([SCOPES.POS], [PLAN_FEATURES.POS]) && (
              <div className="hidden sm:flex items-center gap-1.5">
                <Link
                  to="/dashboard/tables"
                  title={t("navbar.floor_plan_tables", "Floor Plan & Tables")}
                  className="h-9 px-3 rounded-full border border-gray-200 dark:border-slate-700 bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 flex items-center gap-1.5 text-xs font-semibold transition active:scale-95 shadow-2xs"
                >
                  <IconArmchair size={16} stroke={2} className="text-[#008489] dark:text-[#2dd4bf] shrink-0" />
                  <span className="hidden lg:inline">{t("top_bar.tables", "Tables")}</span>
                </Link>

                <Link
                  to="/dashboard/pos"
                  title={t("top_bar.open_pos", "Open Register / POS")}
                  className="h-9 px-3.5 rounded-full bg-[#2CA01C] hover:bg-[#248417] text-white flex items-center gap-1.5 text-xs font-semibold shadow-2xs transition active:scale-95"
                >
                  <IconCashRegister size={16} stroke={2} className="shrink-0" />
                  <span>{t("top_bar.pos", "POS")}</span>
                </Link>
              </div>
            )}

            {/* User Profile Avatar Dropdown */}
            <div className="relative flex items-center justify-center shrink-0">
              <AppBarDropdown isCollapsed={true} className="!w-9 !h-9 !p-0 rounded-full" />
            </div>
          </div>
        </header>

        {/* Mobile Slide-Over Drawer (< md) */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 top-14 bg-white dark:bg-[#0D1829] z-50 overflow-y-auto p-4 md:hidden animate-in slide-in-from-left-2 duration-150">
            <div className="space-y-4 pb-16">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#2CA01C] flex items-center justify-center text-white shadow-xs overflow-hidden shrink-0 ring-1 ring-black/5 dark:ring-white/10">
                    {storeLogo ? (
                      <img
                        src={getImageURL(storeLogo)}
                        alt={storeName || "Store Logo"}
                        className="w-full h-full object-cover"
                      />
                    ) : storeName ? (
                      <span className="font-bold text-xs uppercase tracking-tight select-none">
                        {storeName.trim().slice(0, 2)}
                      </span>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                        <path d="M13 9a6 6 0 0 0-6 6v8h3v-8a3 3 0 1 1 6 0v8h3v-8a6 6 0 0 0-6-6z" fill="white" />
                        <path d="M19 23a6 6 0 0 0 6-6V9h-3v8a3 3 0 1 1-6 0V9h-3v8a6 6 0 0 0 6 6z" fill="white" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                      {storeName || "Bong POS"}
                    </h3>
                  </div>
                </div>
                <QuickNewMenu compact={true} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/dashboard/home"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-xs font-bold text-gray-900 dark:text-white"
                >
                  <IconHome size={16} />
                  <span>{t("navbar.home", "Home")}</span>
                </Link>
                <Link
                  to="/dashboard/reports"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-xs font-bold text-gray-900 dark:text-white"
                >
                  <IconChartLine size={16} />
                  <span>{t("navbar.reports", "Reports")}</span>
                </Link>
              </div>

              {categories.map((cat) => {
                const isSingle = cat.items.length === 1;
                if (isSingle) {
                  const singleItem = cat.items[0];
                  const active = isSubItemActive(singleItem);
                  return (
                    <div key={cat.id} className="pt-2 border-t border-gray-100 dark:border-slate-800">
                      <Link
                        to={singleItem.path}
                        onClick={() => setMobileDrawerOpen(false)}
                        className={clsx(
                          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                          active
                            ? "bg-gray-100 dark:bg-slate-800 font-semibold text-gray-900 dark:text-white"
                            : "text-gray-700 dark:text-slate-300 hover:bg-gray-100/70 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <span className="w-5 h-5 flex items-center justify-center shrink-0 text-gray-500 dark:text-slate-400">
                          {cat.Icon ? <cat.Icon size={16} stroke={1.8} /> : cat.badgeIcon}
                        </span>
                        <span>{cat.label}</span>
                      </Link>
                    </div>
                  );
                }

                return (
                  <div key={cat.id} className="pt-2 border-t border-gray-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 px-2 pb-1.5">
                      <span className="w-5 h-5 flex items-center justify-center shrink-0 text-gray-500 dark:text-slate-400">
                        {cat.Icon ? <cat.Icon size={16} stroke={1.8} /> : cat.badgeIcon}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300">
                        {cat.label}
                      </span>
                    </div>
                    <div className="space-y-0.5 pl-2">
                      {cat.items.map((item, idx) => (
                        <Link
                          key={idx}
                          to={item.path}
                          onClick={() => setMobileDrawerOpen(false)}
                          className={clsx(
                            "block px-3 py-2 rounded-lg text-sm transition-colors",
                            isSubItemActive(item)
                              ? "bg-gray-100 dark:bg-slate-800 font-semibold text-gray-900 dark:text-white"
                              : "text-gray-700 dark:text-slate-300 hover:bg-gray-100/70 dark:hover:bg-slate-800/60"
                          )}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Page Content Canvas */}
        <div className="flex-1 w-full">{children}</div>
      </div>

      {/* Customise Modal */}
      {customiseModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {t("navbar.customise_nav_title", "Customise left navigation")}
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  {t("navbar.customise_nav_desc", "Choose which app categories stay pinned on your left rail.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomiseModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {categories.map((cat) => {
                const isPinned = pinnedIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => togglePinCategory(cat.id)}
                    className={clsx(
                      "w-full flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer",
                      isPinned
                        ? "border-[#2CA01C] bg-emerald-50/40 dark:bg-emerald-950/20"
                        : "border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center shrink-0 text-gray-600 dark:text-slate-300">
                        {cat.Icon ? <cat.Icon size={20} stroke={1.8} /> : cat.badgeIcon}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{cat.label}</p>
                        {cat.items.length > 1 && (
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            {cat.items.map((i) => i.label).slice(0, 3).join(" • ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className={clsx(
                        "w-5 h-5 rounded-md flex items-center justify-center border",
                        isPinned
                          ? "bg-[#2CA01C] border-[#2CA01C] text-white"
                          : "border-gray-300 dark:border-slate-600"
                      )}
                    >
                      {isPinned && <IconCheck size={13} stroke={3} />}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="px-5 py-3 bg-gray-50 dark:bg-slate-800/60 border-t border-gray-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setCustomiseModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-bold transition cursor-pointer"
              >
                {t("common.done", "Done")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
