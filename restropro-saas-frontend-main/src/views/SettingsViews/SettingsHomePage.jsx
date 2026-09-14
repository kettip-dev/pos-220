import React from "react";
import { useNavigate } from "react-router-dom";
import {
  IconArmchair2,
  IconArrowUpRight,
  IconBook,
  IconCreditCard,
  IconInfoSquareRounded,
  IconPrinter,
  IconReceiptTax,
  IconUsers,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import Page from "../../components/Page";
import { useTranslation } from "react-i18next";

export default function SettingsHomePage() {
  const {t} = useTranslation();
  const navigate = useNavigate();

  const settingsCards = [
    {
      id: "store-details",
      title: t("settings.store_details"),
      description:
        "Manage restaurant profile, logo, store address, contact details, and QR menu preferences.",
      path: "/dashboard/settings/details",
      category: "General & Operations",
      icon: <IconInfoSquareRounded stroke={iconStroke} className="w-6 h-6" />,
    },
    {
      id: "print-settings",
      title: t("settings.print_settings"),
      description:
        "Configure receipt header/footer, thermal printer connections, KOT auto-print options.",
      path: "/dashboard/settings/print-settings",
      category: "General & Operations",
      icon: <IconPrinter stroke={iconStroke} className="w-6 h-6" />,
    },
    {
      id: "tables-seating",
      title: t("settings.tables"),
      description:
        "Define floor plan layouts, dining areas, table numbers, and seating capacities.",
      path: "/dashboard/settings/tables",
      category: "Dining & Layout",
      icon: <IconArmchair2 stroke={iconStroke} className="w-6 h-6" />,
    },
    {
      id: "table-assignments",
      title: t("settings.table_assignments"),
      description:
        "Assign waitstaff and servers to designated dining sections or specific tables.",
      path: "/dashboard/settings/table-assignments",
      category: "Dining & Layout",
      icon: <IconUsers stroke={iconStroke} className="w-6 h-6" />,
    },
    {
      id: "menu-items",
      title: t("settings.menu_items"),
      description:
        "Organize categories, food items, price list, variant options, and item availability.",
      path: "/dashboard/settings/menu-items",
      category: "Menu & Catalog",
      icon: <IconBook stroke={iconStroke} className="w-6 h-6" />,
    },
    {
      id: "tax-setup",
      title: t("settings.tax_setup"),
      description:
        "Configure GST, VAT, service taxes, and select inclusive or exclusive tax modes.",
      path: "/dashboard/settings/tax-setup",
      category: "Finance & Tax",
      icon: <IconReceiptTax stroke={iconStroke} className="w-6 h-6" />,
    },
    {
      id: "payment-types",
      title: t("settings.payment_types"),
      description:
        "Enable Cash, Credit/Debit Card, UPI, online payment gateways, and custom payment options.",
      path: "/dashboard/settings/payment-types",
      category: "Finance & Tax",
      icon: <IconCreditCard stroke={iconStroke} className="w-6 h-6" />,
    },
  ];

  return (
    <Page className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Settings Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsCards.map((card) => (
          <div
            key={card.id}
            onClick={() => navigate(card.path)}
            className="rounded-3xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#252525] p-6 hover:border-[#59A352] dark:hover:border-[#59A352]/50 transition-all duration-200 group cursor-pointer flex flex-col justify-between min-h-[155px]"
          >
            <div>
              {/* Card Top Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Icon Container matching reference image */}
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gray-100 dark:bg-[#333] text-[#59A352] group-hover:bg-[#59A352] group-hover:text-white transition-colors shrink-0">
                    {card.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-restro-green-dark dark:text-white group-hover:text-[#59A352] transition-colors leading-tight">
                      {card.title}
                    </h3>
                    <span className="text-[11px] font-medium text-slate-400 dark:text-gray-500 mt-0.5 block">
                      {card.category}
                    </span>
                  </div>
                </div>

                {/* Top Right Action Arrow Icon */}
                <div className="p-1.5 rounded-full text-slate-400 group-hover:text-[#59A352] transition-all transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0">
                  <IconArrowUpRight stroke={iconStroke} className="w-5 h-5" />
                </div>
              </div>

              {/* Short Description */}
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-3.5 leading-relaxed">
                {card.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}
