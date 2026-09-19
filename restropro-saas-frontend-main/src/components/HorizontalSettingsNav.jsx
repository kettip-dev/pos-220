import React, { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { clsx } from "clsx";
import {
  IconArmchair2,
  IconBook,
  IconChefHat,
  IconCreditCard,
  IconInfoSquareRounded,
  IconPrinter,
  IconReceiptTax,
  IconUsers,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";

export default function HorizontalSettingsNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { theme } = useTheme();
  const activeTabRef = useRef(null);

  // Automatically scroll active selected setting option into view
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [pathname]);

  const navItems = [
    {
      icon: <IconInfoSquareRounded stroke={iconStroke} />,
      text: t("settings.store_details"),
      path: "/dashboard/settings/details",
      aliasPaths: ["/dashboard/settings/details"],
    },
    {
      icon: <IconPrinter stroke={iconStroke} />,
      text: t("settings.print_settings") ,
      path: "/dashboard/settings/print-settings",
      aliasPaths: ["/dashboard/settings/print-settings"],
    },
    {
      icon: <IconChefHat stroke={iconStroke} />,
      text: "Kitchen Stations",
      path: "/dashboard/settings/kitchen-stations",
      aliasPaths: ["/dashboard/settings/kitchen-stations"],
    },
    {
      icon: <IconArmchair2 stroke={iconStroke} />,
      text: t("settings.tables"),
      path: "/dashboard/settings/tables",
      aliasPaths: ["/dashboard/settings/tables"],
    },
    {
      icon: <IconUsers stroke={iconStroke} />,
      text: t("settings.table_assignments"),
      path: "/dashboard/settings/table-assignments",
      aliasPaths: ["/dashboard/settings/table-assignments"],
    },
    {
      icon: <IconBook stroke={iconStroke} />,
      text: t("settings.menu_items") || "Menu Items",
      path: "/dashboard/settings/menu-items",
      aliasPaths: [
        "/dashboard/settings/menu-items",
        "/dashboard/settings/menu-items/categories",
      ],
    },
    {
      icon: <IconReceiptTax stroke={iconStroke} />,
      text: t("settings.tax_setup") || "Tax Setup",
      path: "/dashboard/settings/tax-setup",
      aliasPaths: ["/dashboard/settings/tax-setup"],
    },
    {
      icon: <IconCreditCard stroke={iconStroke} />,
      text: t("settings.payment_types") || "Payment Types",
      path: "/dashboard/settings/payment-types",
      aliasPaths: ["/dashboard/settings/payment-types"],
    },
  ];

  return (
    <div className="w-full border-b border-restro-border-green px-4 py-3 bg-white dark:bg-[#1a1a1a] sticky top-0 z-30">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
        {/* Setting Navigation Pills */}
        {navItems.map((item, index) => {
          const isActive =
            pathname === item.path ||
            item.aliasPaths?.some((p) => pathname.startsWith(p));

          return (
            <Link
              key={index}
              ref={isActive ? activeTabRef : null}
              to={item.path}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all shrink-0 border",
                isActive
                  ? theme === "black"
                    ? "border-restro-border-green bg-[#252525] text-emerald-400 font-semibold"
                    : "bg-restro-green-light text-restro-green-dark border-restro-border-green font-medium"
                  : theme === "black"
                  ? "border-transparent text-gray-300 hover:bg-[#59A352] hover:text-white"
                  : "border-transparent text-slate-700 hover:bg-[#59A352] hover:text-white"
              )}
            >
              <span className="w-4 h-4 flex items-center justify-center">
                {React.cloneElement(item.icon, {
                  className: "w-4 h-4",
                })}
              </span>
              <span>{item.text}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
