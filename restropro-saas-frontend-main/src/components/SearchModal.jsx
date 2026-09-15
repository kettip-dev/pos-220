import {
  IconArmchair,
  IconArmchair2,
  IconBook,
  IconChartArea,
  IconChefHat,
  IconChevronRight,
  IconCommand,
  IconDeviceTablet,
  IconDevices,
  IconFileInvoice,
  IconFriends,
  IconInfoSquareRounded,
  IconLayoutDashboard,
  IconLifebuoy,
  IconPrinter,
  IconReceiptTax,
  IconSearch,
  IconToolsKitchen3,
  IconUser,
  IconUsersGroup,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { iconStroke } from "../config/config";
import { useNavigate } from "react-router-dom";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { PLAN_FEATURES, SCOPES, hasFullBusinessAccess } from "../config/scopes";
import { useTranslation } from "react-i18next";

export function showSearchModal() {
  const modal = document.getElementById("search-modal");
  if (modal && typeof modal.showModal === "function") {
    modal.showModal();
  }
}

export default function SearchModal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        showSearchModal();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const user = getUserDetailsInLocalStorage();
  const { role: userRole, scope, planFeautures } = user || {};
  const userScopes = scope?.split(",") || [];
  const userPlanFeatures = Array.isArray(planFeautures)
    ? planFeautures
    : planFeautures?.split(",") || [];

  const searchItems = [
    {
      title: t("appbar.dashboard"),
      description: "",
      icon: <IconLayoutDashboard stroke={iconStroke} />,
      link: "/dashboard/home",
      scopes: [SCOPES.DASHBOARD],
      features: [PLAN_FEATURES.DASHBOARD],
    },
    {
      title: t("appbar.pos"),
      description: "",
      icon: <IconDeviceTablet stroke={iconStroke} />,
      link: "/dashboard/pos",
      scopes: [SCOPES.POS],
      features: [PLAN_FEATURES.POS],
    },
    {
      title: t("appbar.kitchen"),
      description: "",
      icon: <IconChefHat stroke={iconStroke} />,
      link: "/dashboard/kitchen",
      scopes: [SCOPES.KITCHEN],
      features: [PLAN_FEATURES.KITCHEN],
    },
    {
      title: t("appbar.orders"),
      description: "",
      icon: <IconToolsKitchen3 stroke={iconStroke} />,
      link: "/dashboard/orders",
      scopes: [SCOPES.ORDERS],
      features: [PLAN_FEATURES.ORDERS],
    },
    {
      title: t("appbar.reservations"),
      description: "",
      icon: <IconArmchair stroke={iconStroke} />,
      link: "/dashboard/reservation",
      scopes: [SCOPES.RESERVATIONS],
      features: [PLAN_FEATURES.RESERVATIONS],
    },
    {
      title: t("appbar.customers"),
      description: "",
      icon: <IconFriends stroke={iconStroke} />,
      link: "/dashboard/customers",
      scopes: [SCOPES.CUSTOMERS],
      features: [PLAN_FEATURES.CUSTOMERS],
    },
    {
      title: t("appbar.invoices"),
      description: "",
      icon: <IconFileInvoice stroke={iconStroke} />,
      link: "/dashboard/invoices",
      scopes: [SCOPES.INVOICES],
      features: [PLAN_FEATURES.INVOICES],
    },
    {
      title: t("appbar.users"),
      description: "",
      icon: <IconUsersGroup stroke={iconStroke} />,
      link: "/dashboard/users",
      scopes: [SCOPES.USERS],
      features: [PLAN_FEATURES.USERS],
    },
    {
      title: t("appbar.reports"),
      description: "",
      icon: <IconChartArea stroke={iconStroke} />,
      link: "/dashboard/reports",
      scopes: [SCOPES.REPORTS],
      features: [PLAN_FEATURES.REPORTS],
    },
    {
      title: t("appbar.store_settings"),
      description: "",
      icon: <IconBook stroke={iconStroke} />,
      link: "/dashboard/settings",
      scopes: [PLAN_FEATURES.SETTINGS],
    },
    {
      title: t("appbar.print_settings"),
      description: "",
      icon: <IconPrinter stroke={iconStroke} />,
      link: "/dashboard/settings/print-settings",
      scopes: [PLAN_FEATURES.SETTINGS],
    },
    {
      title: t("appbar.store_tables"),
      description: "",
      icon: <IconArmchair2 stroke={iconStroke} />,
      link: "/dashboard/settings/tables",
      scopes: [PLAN_FEATURES.SETTINGS],
    },
    {
      title: t("appbar.menu_items"),
      description: "",
      icon: <IconBook stroke={iconStroke} />,
      link: "/dashboard/settings/menu-items",
      scopes: [PLAN_FEATURES.SETTINGS],
    },
    {
      title: t("appbar.tax_setup"),
      description: "",
      icon: <IconReceiptTax stroke={iconStroke} />,
      link: "/dashboard/settings/tax-setup",
      scopes: [PLAN_FEATURES.SETTINGS],
    },
    {
      title: t("appbar.devices"),
      description: "",
      icon: <IconDevices stroke={iconStroke} />,
      link: "/dashboard/devices",
      scopes: [],
      features: [],
    },
    {
      title: t("appbar.profile"),
      description: "",
      icon: <IconUser stroke={iconStroke} />,
      link: "/dashboard/profile",
      scopes: [],
      features: [],
    },
    {
      title: t("appbar.support"),
      description: "",
      icon: <IconLifebuoy stroke={iconStroke} />,
      link: "/dashboard/contact-support",
      scopes: [],
      features: [],
    },
  ];

  return (
    <dialog id="search-modal" className="modal">
      <div className="modal-box max-h-96 relative rounded-2xl">
        <div className="flex items-center justify-between gap-4 sticky top-0 text-restro-text">
          <input
            type="search"
            className="input input-bordered w-full rounded-2xl outline-none focus:ring-0"
            placeholder={t("appbar.search_placeholder", "Search...")}
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div>
            <form method="dialog">
              <button className="btn btn-circle">
                <IconX stroke={iconStroke} />
              </button>
            </form>
          </div>
        </div>

        <div className="my-4">
          <form method="dialog">
            {searchItems
              .filter((item) => {
                const requiredScopes = item.features;
                if (!requiredScopes || requiredScopes.length === 0) return true;
                return requiredScopes.some((scope) => userPlanFeatures.includes(scope));
              })
              .filter((navItem) => {
                const requiredScopes = navItem.scopes;
                if (hasFullBusinessAccess(userRole)) return true;
                if (!requiredScopes || requiredScopes.length === 0) return true;
                return requiredScopes.some((scope) => userScopes.includes(scope));
              })
              .filter((item) => item.title.toLowerCase().includes(search.trim().toLowerCase()))
              .map((item, index) => {
                return (
                  <button
                    onClick={() => navigate(item.link)}
                    key={index}
                    className="flex items-center w-full gap-2 px-4 py-3 mb-2 transition active:scale-90 rounded-2xl justify-between hover:bg-restro-button-hover"
                  >
                    <div className="flex items-center w-full transition-colors">
                      <div className="mr-2">{item.icon}</div>
                      <div className="flex-1 text-start">
                        <p className="transition-colors">{item.title}</p>
                        <p className="text-xs">{item.description}</p>
                      </div>
                      <div>
                        <IconChevronRight stroke={iconStroke} />
                      </div>
                    </div>
                  </button>
                );
              })}
          </form>
        </div>

        <p className="py-4 text-sm text-center text-slate-400">
          {t("appbar.press_esc_to_close", "Press ESC to close")}
        </p>
      </div>
    </dialog>
  );
}
