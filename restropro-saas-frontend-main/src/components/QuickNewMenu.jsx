import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import {
  IconPlus,
  IconDeviceIpadHorizontal,
  IconArmchair,
  IconFileInvoice,
  IconUsers,
  IconUsersGroup,
  IconCalendarEvent,
  IconBuildingWarehouse,
  IconDatabase,
  IconToolsKitchen3,
  IconChefHat,
  IconChartBar,
  IconTruck,
  IconX,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { useTranslation } from "react-i18next";

export default function QuickNewMenu({ isCollapsed = false, compact = false, qboRail = false }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const quickActionGroups = [
    {
      title: t("quick_new.sales_orders", "Sales & Orders"),
      badgeColor: "bg-emerald-500",
      items: [
        {
          label: t("quick_new.pos_order", "New POS Sale"),
          path: "/dashboard/pos",
          icon: <IconDeviceIpadHorizontal size={18} stroke={iconStroke} />,
          iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white",
        },
        {
          label: t("quick_new.tables", "Tables & Floor"),
          path: "/dashboard/tables",
          icon: <IconArmchair size={18} stroke={iconStroke} />,
          iconBg: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white",
        },
        {
          label: t("quick_new.kitchen", "Kitchen (KDS)"),
          path: "/dashboard/kitchen",
          icon: <IconChefHat size={18} stroke={iconStroke} />,
          iconBg: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white",
        },
      ],
    },
    {
      title: t("quick_new.billing_reports", "Billing & Customers"),
      badgeColor: "bg-indigo-500",
      items: [
        {
          label: t("quick_new.invoices", "Invoices & Receipts"),
          path: "/dashboard/invoices",
          icon: <IconFileInvoice size={18} stroke={iconStroke} />,
          iconBg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white",
        },
        {
          label: t("quick_new.customers", "Customers"),
          path: "/dashboard/customers",
          icon: <IconUsersGroup size={18} stroke={iconStroke} />,
          iconBg: "bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400 group-hover:bg-teal-500 group-hover:text-white",
        },
        {
          label: t("navbar.customer_groups", "Customer Groups"),
          path: "/dashboard/customer-groups",
          icon: <IconUsers size={18} stroke={iconStroke} />,
          iconBg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white",
        },
        {
          label: t("quick_new.reservation", "Table Reservations"),
          path: "/dashboard/reservation",
          icon: <IconCalendarEvent size={18} stroke={iconStroke} />,
          iconBg: "bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400 group-hover:bg-orange-500 group-hover:text-white",
        },
      ],
    },
    {
      title: t("quick_new.operations", "Operations & Catalog"),
      badgeColor: "bg-rose-500",
      items: [
        {
          label: t("quick_new.menu_items", "Menu & Pricing"),
          path: "/dashboard/settings/menu-items",
          icon: <IconToolsKitchen3 size={18} stroke={iconStroke} />,
          iconBg: "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 group-hover:bg-rose-500 group-hover:text-white",
        },
        {
          label: t("quick_new.inventory", "Inventory & Stock"),
          path: "/dashboard/inventory",
          icon: <IconBuildingWarehouse size={18} stroke={iconStroke} />,
          iconBg: "bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 group-hover:bg-purple-500 group-hover:text-white",
        },
        {
          label: t("navbar.add_stock_adjustment", "Add Stock Adjustment"),
          path: "/dashboard/inventory/adjustments/add",
          icon: <IconDatabase size={18} stroke={iconStroke} />,
          iconBg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white",
        },
        {
          label: t("navbar.add_stock_transfer", "Add Stock Transfer"),
          path: "/dashboard/inventory/transfers/add",
          icon: <IconTruck size={18} stroke={iconStroke} />,
          iconBg: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white",
        },
        {
          label: t("navbar.vendors_directory", "Suppliers Directory"),
          path: "/dashboard/suppliers",
          icon: <IconTruck size={18} stroke={iconStroke} />,
          iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white",
        },
        {
          label: t("quick_new.reports", "Sales Reports"),
          path: "/dashboard/reports",
          icon: <IconChartBar size={18} stroke={iconStroke} />,
          iconBg: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white",
        },
      ],
    },
  ];

  return (
    <div className={clsx("relative", compact ? "inline-block" : "w-full")} ref={menuRef}>
      {qboRail ? (
        // QBO Far-Left Rail '+ Create' (icon only, clean transparent background)
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title={t("quick_new.create", "Create")}
          aria-label={t("quick_new.create", "Create")}
          className="group w-full flex items-center justify-center py-1 cursor-pointer select-none focus:outline-none"
        >
          <span
            className={clsx(
              "w-[42px] h-[42px] rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 select-none",
              isOpen
                ? "bg-slate-100 dark:bg-slate-800 text-[#0D233A] dark:text-white"
                : "text-[#2CA01C] hover:text-[#248417] hover:bg-emerald-50/70 dark:hover:bg-slate-800/70"
            )}
          >
            <span
              className={clsx(
                "inline-flex items-center justify-center transition-transform duration-200",
                isOpen && "rotate-45"
              )}
            >
              <IconPlus size={24} stroke={2.4} />
            </span>
          </span>
        </button>
      ) : isCollapsed ? (
        // Collapsed mode: (icon only, clean transparent background)
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title={t("quick_new.new", "+ New")}
          aria-label={t("quick_new.new", "+ New")}
          className="w-full flex items-center justify-center py-1 cursor-pointer select-none focus:outline-none"
        >
          <span
            className={clsx(
              "w-[42px] h-[42px] mx-auto rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 select-none",
              isOpen
                ? "bg-slate-100 dark:bg-slate-800 text-[#0D233A] dark:text-white"
                : "text-[#2CA01C] hover:text-[#248417] hover:bg-emerald-50/70 dark:hover:bg-slate-800/70"
            )}
          >
            <span
              className={clsx(
                "inline-flex items-center justify-center transition-transform duration-200",
                isOpen && "rotate-45"
              )}
            >
              <IconPlus size={24} stroke={2.4} />
            </span>
          </span>
        </button>
      ) : compact ? (
        // Compact / Topbar mode: Sleek modern SaaS pill matching exact h-9 height
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            "h-9 px-3.5 flex items-center justify-center gap-2 rounded-full font-semibold text-xs transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 select-none",
            "bg-[#2CA01C] hover:bg-[#248417] text-white shadow-sm hover:shadow-[0_0_14px_rgba(44,160,28,0.4)]",
            isOpen && "ring-2 ring-emerald-400/40 bg-[#248417]"
          )}
        >
          <span
            className={clsx(
              "w-4 h-4 rounded-full bg-white/20 flex items-center justify-center transition-transform duration-200",
              isOpen && "rotate-45"
            )}
          >
            <IconPlus size={12} stroke={3} />
          </span>
          <span>{t("quick_new.new_action", "New Action")}</span>
        </button>
      ) : (
        // Expanded sidebar mode: full-width pill button
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-[#2CA01C] hover:bg-[#248417] text-white font-semibold text-sm shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer",
            isOpen && "ring-2 ring-emerald-400/40 bg-[#248417]"
          )}
        >
          <span
            className={clsx(
              "w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-transform duration-200",
              isOpen && "rotate-45"
            )}
          >
            <IconPlus size={14} stroke={3} />
          </span>
          <span>{t("quick_new.new_action", "New Action")}</span>
        </button>
      )}

      {/* Flyout Quick Actions Menu */}
      {isOpen && (
        <div
          className={clsx(
            "absolute z-[200] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md",
            isCollapsed || qboRail ? "left-full ml-3 top-0 w-[710px] max-w-[92vw]" : "right-0 top-full mt-2 w-80"
          )}
        >
          {/* Header */}
          <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-zinc-800/60 border-b border-slate-200/70 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#2CA01C]" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                {t("quick_new.quick_create", "Create & Quick Actions")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded shadow-2xs">
                ESC
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-6 h-6 rounded-md hover:bg-slate-200/70 dark:hover:bg-zinc-700/80 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
                title="Close"
              >
                <IconX size={15} stroke={2} />
              </button>
            </div>
          </div>

          {/* 3 Columns Grid with soft card groups */}
          <div
            className={clsx(
              "p-4 max-h-[80vh] overflow-y-auto",
              isCollapsed || qboRail
                ? "grid grid-cols-1 sm:grid-cols-3 gap-3.5"
                : "space-y-3"
            )}
          >
            {quickActionGroups.map((group, gIdx) => (
              <div
                key={gIdx}
                className="flex flex-col p-2.5 rounded-xl bg-slate-50/60 dark:bg-zinc-800/30 border border-slate-100 dark:border-zinc-800/50"
              >
                <div className="flex items-center gap-1.5 px-2 pb-2 mb-1 border-b border-slate-200/40 dark:border-zinc-800/40">
                  <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", group.badgeColor)} />
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                    {group.title}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  {group.items.map((item, iIdx) => (
                    <Link
                      key={iIdx}
                      to={item.path}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13px] font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white transition-all shadow-2xs hover:shadow-sm border border-transparent hover:border-slate-200/60 dark:hover:border-zinc-700/50 group"
                    >
                      <span className={clsx("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors shadow-2xs", item.iconBg)}>
                        {item.icon}
                      </span>
                      <span className="truncate whitespace-nowrap">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
