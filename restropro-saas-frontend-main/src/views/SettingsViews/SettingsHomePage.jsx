import React from "react";
import { useNavigate } from "react-router-dom";
import {
  IconArmchair2,
  IconArrowUpRight,
  IconBook,
  IconBrandTelegram,
  IconChefHat,
  IconCreditCard,
  IconInfoSquareRounded,
  IconPrinter,
  IconReceiptTax,
  IconUsers,
  IconTag,
  IconAward,
  IconCashRegister,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import Page from "../../components/Page";
import { useTranslation } from "react-i18next";
import { useStoreSettings } from "../../controllers/settings.controller";

export default function SettingsHomePage() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const { data: storeSettings } = useStoreSettings();
  const isKitchenEnabled = storeSettings?.isKitchenEnabled !== false;

  const rawSettingsCards = [
    {
      id: "store-details",
      title: t("settings.store_details", "Store Details"),
      description: t(
        "settings.desc_store_details",
        "Manage restaurant profile, logo, store address, contact details, and QR menu preferences."
      ),
      path: "/dashboard/settings/details",
      category: t("settings.cat_general_operations", "General & Operations"),
      icon: <IconInfoSquareRounded stroke={iconStroke} className="w-6 h-6" />,
    },
    {
      id: "print-settings",
      title: t("settings.print_settings", "Print Settings"),
      description: t(
        "settings.desc_print_settings",
        "Configure receipt header/footer, thermal printer connections, KOT auto-print options."
      ),
      path: "/dashboard/settings/print-settings",
      category: t("settings.cat_general_operations", "General & Operations"),
      icon: <IconPrinter stroke={iconStroke} className="w-6 h-6" />,
    },
    {
      id: "telegram-notifications",
      title: t("settings.telegram_notifications", "Telegram Notifications"),
      description: t(
        "settings.desc_telegram_notifications",
        "Configure Telegram bot token, group chat IDs, order dispatch tickets, and daily EOD summary reports."
      ),
      path: "/dashboard/settings/telegram",
      category: t("settings.cat_general_operations", "General & Operations"),
      icon: <IconBrandTelegram stroke={iconStroke} className="w-6 h-6 text-[#229ED9]" />,
    },
    {
      id: "thermal-printers",
      title: t("settings.thermal_printers", "Thermal Printers (LAN / TCP)"),
      description: t(
        "settings.desc_thermal_printers",
        "Manage network ESC/POS thermal printers, configure IP & Port 9100, paper size, auto-cut, and test connectivity."
      ),
      path: "/dashboard/settings/thermal-printers",
      category: t("settings.cat_general_operations", "General & Operations"),
      icon: <IconPrinter stroke={iconStroke} className="w-6 h-6 text-emerald-600" />,
    },
    {
      id: "kitchen-stations",
      title: t("settings.kitchen_stations", "Kitchen Stations"),
      description: t(
        "settings.desc_kitchen_stations",
        "Configure multiple prep stations (Hot Kitchen, Bar, Grill) and route thermal KOT printers."
      ),
      path: "/dashboard/settings/kitchen-stations",
      category: t("settings.cat_general_operations", "General & Operations"),
      icon: <IconChefHat stroke={iconStroke} className="w-6 h-6" />,
    },
    {
      id: "tables-seating",
      title: t("settings.tables", "Tables & Seating"),
      description: t(
        "settings.desc_tables",
        "Define floor plan layouts, dining areas, table numbers, and seating capacities."
      ),
      path: "/dashboard/settings/tables",
      category: t("settings.cat_dining_layout", "Dining & Layout"),
      icon: <IconArmchair2 stroke={iconStroke} className="w-6 h-6" />,
    },
    {
      id: "table-assignments",
      title: t("settings.table_assignments", "Table Assignments"),
      description: t(
        "settings.desc_table_assignments",
        "Assign waitstaff and servers to designated dining sections or specific tables."
      ),
      path: "/dashboard/settings/table-assignments",
      category: t("settings.cat_dining_layout", "Dining & Layout"),
      icon: <IconUsers stroke={iconStroke} className="w-6 h-6" />,
    },
    {
      id: "menu-items",
      title: t("settings.menu_items", "Menu Items"),
      description: t(
        "settings.desc_menu_items",
        "Organize categories, food items, price list, variant options, and item availability."
      ),
      path: "/dashboard/settings/menu-items",
      category: t("settings.cat_menu_catalog", "Menu & Catalog"),
      icon: <IconBook stroke={iconStroke} className="w-6 h-6" />,
    },
    {
      id: "tax-setup",
      title: t("settings.tax_setup", "Tax Setup"),
      description: t(
        "settings.desc_tax_setup",
        "Configure GST, VAT, service taxes, and select inclusive or exclusive tax modes."
      ),
      path: "/dashboard/settings/tax-setup",
      category: t("settings.cat_finance_tax", "Finance & Tax"),
      icon: <IconReceiptTax stroke={iconStroke} className="w-6 h-6" />,
    },
    {
      id: "promotions-marketing",
      title: t("settings.promotions_marketing_title", "Promotions & Marketing"),
      description: t(
        "settings.promotions_marketing_desc",
        "Manage happy hours, discount coupons, BOGO deals, and automatic order/item discounts."
      ),
      path: "/dashboard/promotions",
      category: t("settings.category_marketing", "Marketing & Discounts"),
      icon: <IconTag stroke={iconStroke} className="w-6 h-6 text-emerald-600" />,
    },
    {
      id: "loyalty-rewards",
      title: t("settings.loyalty_rewards", "Loyalty & Rewards"),
      description: t(
        "settings.desc_loyalty_rewards",
        "Configure points earning rules, cash redemption conversion rate, minimum point thresholds, and member tiers."
      ),
      path: "/dashboard/settings/loyalty",
      category: t("settings.category_marketing", "Marketing & Discounts"),
      icon: <IconAward stroke={iconStroke} className="w-6 h-6 text-amber-500" />,
    },
    {
      id: "payment-types",
      title: t("settings.payment_types", "Payment Types"),
      description: t(
        "settings.desc_payment_types",
        "Enable Cash, Credit/Debit Card, UPI, online payment gateways, and custom payment options."
      ),
      path: "/dashboard/settings/payment-types",
      category: t("settings.cat_finance_tax", "Finance & Tax"),
      icon: <IconCreditCard stroke={iconStroke} className="w-6 h-6" />,
    },
    {
      id: "registers",
      title: t("settings.registers", "Registers & Cash"),
      description: t(
        "settings.desc_registers",
        "Tills, opening floats, blind close, cash variance limits, refunds approval, Z reports and business-day close."
      ),
      path: "/dashboard/settings/registers",
      category: t("settings.cat_finance_tax", "Finance & Tax"),
      icon: <IconCashRegister stroke={iconStroke} className="w-6 h-6" />,
    },
  ];

  const settingsCards = rawSettingsCards.filter((card) => {
    if (card.id === "kitchen-stations" && !isKitchenEnabled) {
      return false;
    }
    return true;
  });

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
