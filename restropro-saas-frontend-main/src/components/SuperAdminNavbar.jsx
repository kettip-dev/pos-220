import React, { useContext, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
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
  IconShieldCheck,
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
        icon: <IconLayoutDashboard stroke={iconStroke} size={22} />,
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
        icon: <IconBuildingStore stroke={iconStroke} size={22} />,
        path: "/superadmin/dashboard/tenants",
      },
      {
        id: "business-groups",
        type: "link",
        text: t("superadmin_navbar.business_groups", "Business Groups"),
        icon: <IconUsersGroup stroke={iconStroke} size={22} />,
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
        icon: <IconPremiumRights stroke={iconStroke} size={22} />,
        path: "/superadmin/dashboard/plans",
      },
      {
        id: "payment-gateways",
        type: "link",
        text: t("superadmin_navbar.payment_gateways", "Payment Gateways"),
        icon: <IconCreditCard stroke={iconStroke} size={22} />,
        path: "/superadmin/dashboard/payment-gateways",
      },
      {
        id: "reports",
        type: "link",
        text: t("superadmin_navbar.reports", "Reports & Analytics"),
        icon: <IconChartArea stroke={iconStroke} size={22} />,
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
        icon: <IconBellRinging stroke={iconStroke} size={22} />,
        path: "/superadmin/dashboard/push-notifications",
      },
      {
        id: "image-storage",
        type: "link",
        text: t("superadmin_navbar.image_storage", "Image Storage"),
        icon: <IconCloudUpload stroke={iconStroke} size={22} />,
        path: "/superadmin/dashboard/image-storage",
      },
      {
        id: "google-auth",
        type: "link",
        text: t("superadmin_navbar.authentication", "Authentication"),
        icon: <IconLogin2 stroke={iconStroke} size={22} />,
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
    navGroups.forEach((group) => {
      if (group.isCollapsible === false) return;
      const hasActiveChild = group.items.some((item) =>
        pathname.includes(item.path)
      );
      if (hasActiveChild && collapsedGroups[group.id]) {
        setCollapsedGroups((prev) => {
          const next = { ...prev, [group.id]: false };
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
    });
  }, [pathname]);

  const toggleGroup = (groupId) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
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

  // -------------------------------------------------------------
  // Mini Rail Mode (Collapsed Sidebar)
  // -------------------------------------------------------------
  if (isNavbarCollapsed) {
    return (
      <div className="relative">
        <aside className="hidden md:flex flex-col items-center justify-between h-screen w-[5.5rem] py-6 fixed left-0 top-0 border-r border-restro-border-green bg-restro-card-bg z-30 transition-all duration-300">
          <div className="flex flex-col items-center gap-6 w-full px-3">
            {/* Icon Rail Groups */}
            <div className="w-full flex flex-col gap-3 overflow-y-auto no-scrollbar items-center py-2">
              {navGroups.map((group, gIdx) => (
                <React.Fragment key={group.id}>
                  {gIdx > 0 && (
                    <div className="w-8 h-px bg-restro-border-green my-1" />
                  )}
                  {group.items.map((item) => {
                    const active = isRouteActive(item.path);
                    return (
                      <div key={item.id} className="relative group/tooltip">
                        <Link
                          to={item.path}
                          className={clsx(
                            "w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200 relative",
                            {
                              "bg-restro-bg-hover-dark-mode font-medium text-restro-green":
                                theme === "black" && active,
                              "bg-restro-border-green-light font-medium text-restro-green":
                                theme !== "black" && active,
                              "hover:bg-restro-bg-hover-dark-mode text-white":
                                theme === "black" && !active,
                              "hover:bg-restro-border-green-light text-black":
                                theme !== "black" && !active,
                            }
                          )}
                        >
                          {item.icon}
                        </Link>
                        {/* Hover Tooltip */}
                        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all duration-150 z-50">
                          {item.text}
                          <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-1 border-4 border-transparent border-r-gray-900" />
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* User Profile Mini & Expand Button */}
          <div className="flex flex-col items-center gap-4 w-full px-3">
            <div className="relative group/tooltip">
              <img
                src={AvatarImg}
                alt="avatar"
                className="w-10 h-10 rounded-full block border border-restro-border-green object-cover"
              />
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all duration-150 z-50">
                {user.name} ({new String(user.role).toUpperCase()})
              </div>
            </div>

            <button
              onClick={btnToggleNavbar}
              title="Expand Sidebar"
              className="w-12 h-12 flex items-center justify-center rounded-full border border-restro-border-green transition-colors bg-restro-green-light dark:bg-restro-gray hover:bg-restro-border-green text-restro-text"
            >
              <IconChevronRight stroke={iconStroke} />
            </button>
          </div>
        </aside>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Expanded Enterprise Sidebar Mode
  // -------------------------------------------------------------
  return (
    <div className="relative">
      <aside className="hidden md:flex md:w-72 flex-col justify-between h-screen fixed left-0 top-0 border-r border-restro-border-green bg-restro-card-bg z-30 transition-all duration-300">
        
        {/* Top Header & Navigation */}
        <div className="flex flex-col h-full overflow-hidden">
          
          {/* Admin User Profile */}
          <div className="flex items-center gap-3 px-5 pt-6 pb-3 mb-2">
            <img
              src={AvatarImg}
              alt="avatar"
              className="w-12 h-12 rounded-full block border border-restro-border-green object-cover"
            />
            <div className="truncate">
              <p className="font-medium text-base text-gray-900 dark:text-white truncate">
                {user.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {new String(user.role).toUpperCase()}
                {user.designation && <span>, {user.designation}</span>}
              </p>
            </div>
          </div>

          {/* Collapsible Section Groups List */}
          <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-4 no-scrollbar">
            {navGroups.map((group) => {
              if (group.isCollapsible === false) {
                return (
                  <div key={group.id} className="flex flex-col gap-1">
                    {group.items.map((item) => {
                      const active = isRouteActive(item.path);
                      return (
                        <Link
                          key={item.id}
                          to={item.path}
                          className={clsx(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-full transition-all text-sm font-medium",
                            {
                              "bg-restro-bg-hover-dark-mode font-medium text-restro-green":
                                theme === "black" && active,
                              "bg-restro-border-green-light font-medium text-restro-green":
                                theme !== "black" && active,
                              "hover:bg-restro-bg-hover-dark-mode hover:text-white text-gray-300":
                                theme === "black" && !active,
                              "hover:bg-restro-border-green-light text-gray-700":
                                theme !== "black" && !active,
                            }
                          )}
                        >
                          <span className="flex items-center justify-center">
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
                <div key={group.id} className="flex flex-col gap-1">
                  {/* Group Section Header Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-2 py-1.5 select-none group/hdr"
                  >
                    <span
                      className={clsx("font-bold text-sm tracking-wide transition-colors", {
                        "text-restro-green": hasActiveChild && isCollapsed,
                        "text-gray-900 dark:text-white": !(hasActiveChild && isCollapsed),
                      })}
                    >
                      {group.title}
                    </span>
                    <IconChevronDown
                      size={18}
                      className={clsx(
                        "transition-transform duration-200",
                        {
                          "text-restro-green": hasActiveChild && isCollapsed,
                          "text-gray-500 dark:text-gray-400": !(hasActiveChild && isCollapsed),
                          "-rotate-90": isCollapsed,
                          "rotate-0": !isCollapsed,
                        }
                      )}
                    />
                  </button>

                  {/* Group Items Accordion Container */}
                  <div
                    className={clsx(
                      "flex flex-col gap-1 transition-all duration-200 overflow-hidden",
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
                            "w-full flex items-center gap-3 px-4 py-3 rounded-full transition-all text-sm font-medium",
                            {
                              "bg-restro-bg-hover-dark-mode font-medium text-restro-green":
                                theme === "black" && active,
                              "bg-restro-border-green-light font-medium text-restro-green":
                                theme !== "black" && active,
                              "hover:bg-restro-bg-hover-dark-mode hover:text-white text-gray-300":
                                theme === "black" && !active,
                              "hover:bg-restro-border-green-light text-gray-700":
                                theme !== "black" && !active,
                            }
                          )}
                        >
                          <span className="flex items-center justify-center">
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

        </div>

        {/* Bottom Toggle Collapse Button */}
        <button
          onClick={btnToggleNavbar}
          title="Collapse Sidebar"
          className="w-9 h-9 hidden md:flex items-center justify-center rounded-full border border-restro-border-green transition-all bg-restro-green-light dark:bg-restro-gray hover:bg-gray-200 dark:hover:bg-restro-button-hover text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 fixed bottom-4 left-[17.5rem] -translate-x-1/2 z-40 shadow-xs"
        >
          <IconChevronLeft stroke={iconStroke} size={18} />
        </button>
      </aside>
    </div>
  );
}
