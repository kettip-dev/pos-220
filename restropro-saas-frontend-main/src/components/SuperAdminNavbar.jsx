import React, { useContext, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  IconLogin2,
  IconBuildingStore,
  IconChartArea,
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown,
  IconLayoutDashboard,
  IconPremiumRights,
  IconUsersGroup,
  IconCreditCard,
  IconCloudUpload,
  IconBellRinging,
  IconPlus,
} from "@tabler/icons-react";
import { clsx } from "clsx";
import AvatarImg from "../assets/avatar.svg";
import { iconStroke } from "../config/config";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { NavbarContext } from "../contexts/NavbarContext";
import { toggleNavbar } from "../helpers/NavbarSettings";
import { useTheme } from "../contexts/ThemeContext";

/**
 * Enterprise Information Architecture Grouping
 */
export const getSuperAdminNavGroups = (t) => [
  {
    id: "overview",
    isCollapsible: false,
    items: [
      {
        id: "dashboard",
        type: "link",
        text: t("superadmin_navbar.dashboard", "Dashboard"),
        icon: <IconLayoutDashboard stroke={iconStroke} size={20} />,
        path: "/superadmin/dashboard/home",
      },
    ],
  },
  {
    id: "clients",
    title: t("superadmin_navbar.group_clients", "Business Management"),
    items: [
      {
        id: "tenants",
        type: "link",
        text: t("superadmin_navbar.tenants", "Businesses"),
        icon: <IconBuildingStore stroke={iconStroke} size={20} />,
        path: "/superadmin/dashboard/tenants",
      },
      {
        id: "business-groups",
        type: "link",
        text: t("superadmin_navbar.business_groups", "Business Groups"),
        icon: <IconUsersGroup stroke={iconStroke} size={20} />,
        path: "/superadmin/dashboard/business-groups",
      },
    ],
  },
  {
    id: "billing",
    title: t("superadmin_navbar.group_billing", "Monetization & Analytics"),
    items: [
      {
        id: "plans",
        type: "link",
        text: t("superadmin_navbar.plans", "Subscription Plans"),
        icon: <IconPremiumRights stroke={iconStroke} size={20} />,
        path: "/superadmin/dashboard/plans",
      },
      {
        id: "payment-gateways",
        type: "link",
        text: t("superadmin_navbar.payment_gateways", "Payment Gateways"),
        icon: <IconCreditCard stroke={iconStroke} size={20} />,
        path: "/superadmin/dashboard/payment-gateways",
      },
      {
        id: "reports",
        type: "link",
        text: t("superadmin_navbar.reports", "Reports & Analytics"),
        icon: <IconChartArea stroke={iconStroke} size={20} />,
        path: "/superadmin/dashboard/reports",
      },
    ],
  },
  {
    id: "system",
    title: t("superadmin_navbar.group_system", "Platform Settings"),
    items: [
      {
        id: "push-notifications",
        type: "link",
        text: t("superadmin_navbar.push_notifications", "Push Notifications"),
        icon: <IconBellRinging stroke={iconStroke} size={20} />,
        path: "/superadmin/dashboard/push-notifications",
      },
      {
        id: "image-storage",
        type: "link",
        text: t("superadmin_navbar.image_storage", "Image Storage"),
        icon: <IconCloudUpload stroke={iconStroke} size={20} />,
        path: "/superadmin/dashboard/image-storage",
      },
      {
        id: "google-auth",
        type: "link",
        text: t("superadmin_navbar.authentication", "Authentication"),
        icon: <IconLogin2 stroke={iconStroke} size={20} />,
        path: "/superadmin/dashboard/google",
      },
    ],
  },
];

/**
 * Backward compatibility helper for flat navbar list (used in mobile navbar)
 */
export const getSuperAdminNavbarItems = (t) => {
  const groups = getSuperAdminNavGroups(t);
  return groups.flatMap((group) => group.items);
};

export default function SuperAdminNavbar() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = getUserDetailsInLocalStorage();

  const [isNavbarCollapsed, setIsNavbarCollapsed] = useContext(NavbarContext);

  const navGroups = getSuperAdminNavGroups(t);

  // Group accordion state initialized from localStorage
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try {
      const saved = localStorage.getItem("superadmin_collapsed_nav_groups");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Auto-expand group if current route is inside a collapsed group
  useEffect(() => {
    let matchedGroupId = null;
    navGroups.forEach((group) => {
      if (group.isCollapsible === false) return;
      const hasActiveChild = group.items.some((item) =>
        pathname.includes(item.path)
      );
      if (hasActiveChild) {
        matchedGroupId = group.id;
      }
    });

    if (matchedGroupId && collapsedGroups[matchedGroupId]) {
      setCollapsedGroups((prev) => {
        const allCollapsed = {};
        navGroups.forEach((g) => {
          if (g.isCollapsible !== false) allCollapsed[g.id] = true;
        });
        const next = { ...allCollapsed, [matchedGroupId]: false };
        try {
          localStorage.setItem(
            "superadmin_collapsed_nav_groups",
            JSON.stringify(next)
          );
        } catch (e) {
          console.error(e);
        }
        return next;
      });
    }
  }, [pathname]);

  const toggleGroup = (groupId) => {
    setCollapsedGroups((prev) => {
      const isCurrentlyCollapsed = !!prev[groupId];
      if (!isCurrentlyCollapsed) {
        // Toggle closed
        const next = { ...prev, [groupId]: true };
        try {
          localStorage.setItem(
            "superadmin_collapsed_nav_groups",
            JSON.stringify(next)
          );
        } catch (e) {
          console.error(e);
        }
        return next;
      }
      // Expand selected group and collapse all others
      const allCollapsed = {};
      navGroups.forEach((g) => {
        if (g.isCollapsible !== false) allCollapsed[g.id] = true;
      });
      const next = { ...allCollapsed, [groupId]: false };
      try {
        localStorage.setItem(
          "superadmin_collapsed_nav_groups",
          JSON.stringify(next)
        );
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const btnToggleNavbar = () => {
    const isNavCollapsed = toggleNavbar();
    if (isNavCollapsed) {
      setIsNavbarCollapsed(true);
    } else {
      setIsNavbarCollapsed(false);
    }
  };

  const isRouteActive = (path) => pathname.includes(path);

  const handleQuickNewAction = () => {
    if (pathname.includes("/superadmin/dashboard/tenants")) {
      const modal = document.getElementById("modal-add");
      if (modal) modal.showModal();
    } else {
      navigate("/superadmin/dashboard/tenants");
      setTimeout(() => {
        const modal = document.getElementById("modal-add");
        if (modal) modal.showModal();
      }, 250);
    }
  };

  // -------------------------------------------------------------
  // Mini Rail Mode (Collapsed Sidebar) - QuickBooks Minimalist Rail
  // -------------------------------------------------------------
  if (isNavbarCollapsed) {
    return (
      <div className="relative">
        <aside className="hidden md:flex flex-col items-center justify-between h-screen w-16 py-4 fixed left-0 top-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161B22] z-30 transition-all duration-200">
          <div className="flex flex-col items-center gap-4 w-full px-2">
            {/* QuickBooks Small Logo Glyph */}
            <Link
              to="/superadmin/dashboard/home"
              className="w-10 h-10 rounded-lg bg-[#2CA01C] text-white flex items-center justify-center font-black text-lg shadow-xs hover:bg-[#248417] transition-colors"
              title="Restro SaaS Super Admin"
            >
              R
            </Link>

            {/* QuickBooks Quick "+ New" Round Button */}
            <button
              onClick={handleQuickNewAction}
              title={t("superadmin_tenants.add_tenant", "Add Business")}
              className="w-10 h-10 rounded-full bg-[#2CA01C] hover:bg-[#248417] text-white flex items-center justify-center shadow-sm transition active:scale-95"
            >
              <IconPlus size={20} stroke={3} />
            </button>

            <div className="w-8 h-px bg-gray-200 dark:bg-gray-800 my-1" />

            {/* Icon Rail Groups */}
            <div className="w-full flex flex-col gap-1 overflow-y-auto no-scrollbar items-center py-1">
              {navGroups.map((group, gIdx) => (
                <React.Fragment key={group.id}>
                  {gIdx > 0 && (
                    <div className="w-6 h-px bg-gray-200 dark:bg-gray-800 my-1.5" />
                  )}
                  {group.items.map((item) => {
                    const active = isRouteActive(item.path);
                    return (
                      <div key={item.id} className="relative group/tooltip">
                        <Link
                          to={item.path}
                          className={clsx(
                            "w-10 h-10 flex items-center justify-center rounded-lg transition-all relative",
                            active
                              ? "bg-emerald-50 dark:bg-emerald-950/50 text-[#2CA01C] font-semibold border border-emerald-200 dark:border-emerald-800/60"
                              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/70 hover:text-gray-900 dark:hover:text-white"
                          )}
                        >
                          {item.icon}
                        </Link>
                        {/* Hover Tooltip */}
                        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-gray-900 dark:bg-gray-800 text-white text-xs font-medium rounded-md shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all duration-150 z-50">
                          {item.text}
                          <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-1 border-4 border-transparent border-r-gray-900 dark:border-r-gray-800" />
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* User Profile Mini & Expand Button */}
          <div className="flex flex-col items-center gap-3 w-full px-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={btnToggleNavbar}
              title="Expand Sidebar"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 text-gray-600 dark:text-gray-300 transition-colors"
            >
              <IconChevronRight stroke={iconStroke} size={18} />
            </button>
          </div>
        </aside>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Expanded Enterprise QuickBooks Sidebar Mode
  // -------------------------------------------------------------
  return (
    <div className="relative">
      <aside className="hidden md:flex md:w-64 flex-col justify-between h-screen fixed left-0 top-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161B22] z-30 transition-all duration-200">
        
        {/* Top Header & Navigation */}
        <div className="flex flex-col h-full overflow-hidden">
          
          {/* QuickBooks Platform Brand Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
            <Link to="/superadmin/dashboard/home" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#2CA01C] text-white flex items-center justify-center font-extrabold text-base shadow-xs">
                R
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-gray-900 dark:text-white">
                    Restro
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-[#108000] dark:text-[#2CA01C]">
                    PRO
                  </span>
                </div>
                <span className="text-[10px] text-gray-500 font-medium leading-none">
                  SaaS Administration
                </span>
              </div>
            </Link>

            <button
              onClick={btnToggleNavbar}
              title="Collapse Sidebar"
              className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <IconChevronLeft stroke={iconStroke} size={18} />
            </button>
          </div>

          {/* Iconic QuickBooks "+ New" Action Button */}
          <div className="px-4 pt-4 pb-2">
            <button
              onClick={handleQuickNewAction}
              className="w-full flex items-center justify-center gap-2 bg-[#2CA01C] hover:bg-[#248417] text-white text-sm font-semibold py-2 px-3.5 rounded-full shadow-sm hover:shadow transition active:scale-98"
            >
              <IconPlus size={18} stroke={2.5} />
              <span>{t("superadmin_tenants.add_tenant", "+ New Business")}</span>
            </button>
          </div>

          {/* Section Groups List */}
          <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-4 no-scrollbar">
            {navGroups.map((group) => {
              if (group.isCollapsible === false) {
                return (
                  <div key={group.id} className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const active = isRouteActive(item.path);
                      return (
                        <Link
                          key={item.id}
                          to={item.path}
                          className={clsx(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-xs font-medium",
                            active
                              ? "bg-emerald-50/80 dark:bg-emerald-950/40 text-[#108000] dark:text-[#2CA01C] font-semibold border-l-4 border-[#2CA01C] rounded-l-none pl-2 shadow-2xs"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60"
                          )}
                        >
                          <span
                            className={clsx(
                              "flex items-center justify-center transition-colors",
                              active
                                ? "text-[#2CA01C]"
                                : "text-gray-500 dark:text-gray-400"
                            )}
                          >
                            {item.icon}
                          </span>
                          <span className="truncate">{item.text}</span>
                        </Link>
                      );
                    })}
                  </div>
                );
              }

              const isCollapsed = !!collapsedGroups[group.id];
              const hasActiveChild = group.items.some((item) =>
                isRouteActive(item.path)
              );

              return (
                <div key={group.id} className="flex flex-col gap-0.5">
                  {/* Group Section Header Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 select-none text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    <span
                      className={clsx({
                        "text-[#2CA01C] font-bold": hasActiveChild && isCollapsed,
                      })}
                    >
                      {group.title}
                    </span>
                    <IconChevronDown
                      size={14}
                      className={clsx("transition-transform duration-200", {
                        "-rotate-90": isCollapsed,
                        "rotate-0": !isCollapsed,
                      })}
                    />
                  </button>

                  {/* Group Items Accordion Container */}
                  <div
                    className={clsx(
                      "flex flex-col gap-0.5 transition-all duration-200 overflow-hidden",
                      {
                        "max-h-0 opacity-0 pointer-events-none": isCollapsed,
                        "max-h-[500px] opacity-100": !isCollapsed,
                      }
                    )}
                  >
                    {group.items.map((item) => {
                      const active = isRouteActive(item.path);
                      return (
                        <Link
                          key={item.id}
                          to={item.path}
                          className={clsx(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-xs font-medium",
                            active
                              ? "bg-emerald-50/80 dark:bg-emerald-950/40 text-[#108000] dark:text-[#2CA01C] font-semibold border-l-4 border-[#2CA01C] rounded-l-none pl-2 shadow-2xs"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60"
                          )}
                        >
                          <span
                            className={clsx(
                              "flex items-center justify-center transition-colors",
                              active
                                ? "text-[#2CA01C]"
                                : "text-gray-500 dark:text-gray-400"
                            )}
                          >
                            {item.icon}
                          </span>
                          <span className="truncate">{item.text}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom QuickBooks User Bar */}
          <div className="p-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5 truncate">
              <div className="relative">
                <img
                  src={AvatarImg}
                  alt="avatar"
                  className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 object-cover"
                />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#2CA01C] ring-1 ring-white dark:ring-[#161B22]" />
              </div>
              <div className="truncate text-left leading-tight">
                <p className="font-semibold text-xs text-gray-900 dark:text-white truncate">
                  {user.name}
                </p>
                <p className="text-[10px] text-gray-500 truncate">
                  {new String(user.role).toUpperCase()}
                </p>
              </div>
            </div>

            <Link
              to="/superadmin/dashboard/google"
              title="Settings"
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <IconLogin2 stroke={iconStroke} size={16} />
            </Link>
          </div>

        </div>
      </aside>
    </div>
  );
}
