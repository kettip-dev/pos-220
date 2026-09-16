import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  IconPlus,
  IconDeviceIpadHorizontal,
  IconArmchair,
  IconFileInvoice,
  IconUsersGroup,
  IconCalendarEvent,
  IconBuildingWarehouse,
  IconToolsKitchen3,
  IconChefHat,
  IconChartBar,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { useTranslation } from "react-i18next";

export default function QuickNewMenu({ isCollapsed = false }) {
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
      items: [
        {
          label: t("quick_new.pos_order", "New POS Sale"),
          path: "/dashboard/pos",
          icon: <IconDeviceIpadHorizontal size={18} stroke={iconStroke} className="text-emerald-500" />,
        },
        {
          label: t("quick_new.tables", "Dine-in Floor / Tables"),
          path: "/dashboard/tables",
          icon: <IconArmchair size={18} stroke={iconStroke} className="text-blue-500" />,
        },
        {
          label: t("quick_new.kitchen", "Kitchen Display (KDS)"),
          path: "/dashboard/kitchen",
          icon: <IconChefHat size={18} stroke={iconStroke} className="text-orange-500" />,
        },
      ],
    },
    {
      title: t("quick_new.billing_reports", "Billing & Customers"),
      items: [
        {
          label: t("quick_new.invoices", "Invoices & Receipts"),
          path: "/dashboard/invoices",
          icon: <IconFileInvoice size={18} stroke={iconStroke} className="text-indigo-500" />,
        },
        {
          label: t("quick_new.customers", "Customer Directory"),
          path: "/dashboard/customers",
          icon: <IconUsersGroup size={18} stroke={iconStroke} className="text-teal-500" />,
        },
        {
          label: t("quick_new.reservation", "New Table Reservation"),
          path: "/dashboard/reservation",
          icon: <IconCalendarEvent size={18} stroke={iconStroke} className="text-amber-500" />,
        },
      ],
    },
    {
      title: t("quick_new.operations", "Operations"),
      items: [
        {
          label: t("quick_new.inventory", "Inventory & Stock"),
          path: "/dashboard/inventory",
          icon: <IconBuildingWarehouse size={18} stroke={iconStroke} className="text-purple-500" />,
        },
        {
          label: t("quick_new.reports", "Financial Sales Reports"),
          path: "/dashboard/reports",
          icon: <IconChartBar size={18} stroke={iconStroke} className="text-cyan-500" />,
        },
      ],
    },
  ];

  return (
    <div className="relative w-full" ref={menuRef}>
      {isCollapsed ? (
        // Collapsed mode: Circular button
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title={t("quick_new.new", "+ New")}
          className="w-11 h-11 mx-auto flex items-center justify-center rounded-full bg-[#2CA01C] hover:bg-[#248417] text-white shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer font-bold"
        >
          <IconPlus size={20} stroke={2.5} />
        </button>
      ) : (
        // Expanded mode: QuickBooks pill button
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-[#2CA01C] hover:bg-[#248417] text-white font-semibold text-sm shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
            <IconPlus size={14} stroke={3} />
          </span>
          <span>{t("quick_new.new_action", "New Action")}</span>
        </button>
      )}

      {/* Flyout Quick Actions Menu */}
      {isOpen && (
        <div
          className={`absolute z-[100] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
            isCollapsed ? "left-full ml-3 top-0 w-80" : "left-0 top-full mt-2 w-full min-w-[280px]"
          }`}
        >
          <div className="px-4 py-3 bg-gray-50 dark:bg-zinc-800/60 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t("quick_new.quick_create", "Quick Actions")}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-semibold">
              QuickBooks
            </span>
          </div>

          <div className="p-2 divide-y divide-gray-100 dark:divide-zinc-800 max-h-[70vh] overflow-y-auto">
            {quickActionGroups.map((group, gIdx) => (
              <div key={gIdx} className={gIdx > 0 ? "pt-2 mt-2" : ""}>
                <p className="px-2.5 pb-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  {group.title}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item, iIdx) => (
                    <Link
                      key={iIdx}
                      to={item.path}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-zinc-800/80 hover:text-emerald-700 dark:hover:text-emerald-400 transition group"
                    >
                      <span className="p-1 rounded-md bg-gray-50 dark:bg-zinc-800 group-hover:bg-white dark:group-hover:bg-zinc-700 transition shadow-2xs">
                        {item.icon}
                      </span>
                      <span className="font-medium">{item.label}</span>
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
