import {
  IconArmchair,
  IconArmchair2,
  IconBook,
  IconChartArea,
  IconChefHat,
  IconChevronDown,
  IconChevronRight,
  IconCommand,
  IconDeviceTablet,
  IconDevices,
  IconFileInvoice,
  IconFriends,
  IconInfoSquareRounded,
  IconLayoutDashboard,
  IconLifebuoy,
  IconLogout,
  IconPrinter,
  IconReceiptTax,
  IconSearch,
  IconToolsKitchen3,
  IconUser,
  IconUsersGroup,
  IconX,
} from "@tabler/icons-react";
import { Fragment, useEffect, useState } from "react";
import { iconStroke } from "../config/config";
import AvatarImg from "../assets/avatar.svg";
import { Menu, Transition } from "@headlessui/react";
import { signOut } from "../controllers/auth.controller";
import { toast } from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { PLAN_FEATURES, SCOPES, hasFullBusinessAccess } from "../config/scopes";
import AppBarDropdown from "./AppBarDropdown";
import BusinessSwitcher from "./BusinessSwitcher";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";

export default function AppBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { theme } = useTheme();

  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        btnShowSearchModal();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const user = getUserDetailsInLocalStorage();
  const { role: userRole, scope, planFeautures } = user;
  const userScopes = scope?.split(",");
  const userPlanFeatures = Array.isArray(planFeautures)
  ? planFeautures
  : planFeautures?.split(",") || [];

  const btnLogout = async () => {
    try {
      toast.loading("Please wait...");
      const response = await signOut();
      if (response.status == 200) {
        toast.dismiss();
        toast.success(response.data.message);
        navigate("/login", { replace: true });
      }
    } catch (error) {
      const message =
        error?.response?.data?.message || "Something went wrong! Try later!";
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  };

  const btnShowSearchModal = () => {
    document.getElementById("search-modal").showModal();
  };

  const searchItems = [
    {
      title: t("appbar.dashboard"),
      description: "",
      icon: <IconLayoutDashboard stroke={iconStroke} />,
      link: "/dashboard/home",
      scopes: [SCOPES.DASHBOARD],
      features: [PLAN_FEATURES.DASHBOARD]
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
      scopes: [SCOPES.KITCHEN, SCOPES.KITCHEN_DISPLAY],
      features: [PLAN_FEATURES.KITCHEN]
    },
    {
      title: t("appbar.orders"),
      description: "",
      icon: <IconToolsKitchen3 stroke={iconStroke} />,
      link: "/dashboard/orders",
      scopes: [SCOPES.POS, SCOPES.ORDERS, SCOPES.ORDER_STATUS, SCOPES.ORDER_STATUS_DISPLAY],
      features: [PLAN_FEATURES.ORDERS],
    },
    {
      title: t("appbar.reservations"),
      description: "",
      icon: <IconArmchair2 stroke={iconStroke} />,
      link: "/dashboard/reservation",
      scopes: [SCOPES.RESERVATIONS, SCOPES.VIEW_RESERVATIONS, SCOPES.MANAGE_RESERVATIONS],
      features: [PLAN_FEATURES.RESERVATIONS],
    },
    {
      title: t("navbar.tables", "Tables / Floor Plan"),
      description: "",
      icon: <IconArmchair stroke={iconStroke} />,
      link: "/dashboard/tables",
      scopes: [SCOPES.POS, SCOPES.SETTINGS, SCOPES.DASHBOARD],
      features: [PLAN_FEATURES.POS],
    },
    {
      title: t("appbar.customers"),
      description: "",
      icon: <IconFriends stroke={iconStroke} />,
      link: "/dashboard/customers",
      scopes: [SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS, SCOPES.MANAGE_CUSTOMERS],
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
      scopes: [SCOPES.SETTINGS],
      features: [PLAN_FEATURES.SETTINGS],
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
      icon: <IconInfoSquareRounded stroke={iconStroke} />,
      link: "/dashboard/settings",
      scopes: [SCOPES.SETTINGS],
      features: [PLAN_FEATURES.SETTINGS],
    },
    {
      title: t("appbar.print_settings"),
      description: "",
      icon: <IconPrinter stroke={iconStroke} />,
      link: "/dashboard/settings/print-settings",
      scopes: [SCOPES.SETTINGS],
      features: [PLAN_FEATURES.SETTINGS],
    },
    {
      title: t("appbar.store_tables"),
      description: "",
      icon: <IconArmchair2 stroke={iconStroke} />,
      link: "/dashboard/settings/tables",
      scopes: [SCOPES.SETTINGS],
      features: [PLAN_FEATURES.SETTINGS],
    },
    {
      title: t("appbar.menu_items"),
      description: "",
      icon: <IconBook stroke={iconStroke} />,
      link: "/dashboard/settings/menu-items",
      scopes: [SCOPES.SETTINGS],
      features: [PLAN_FEATURES.SETTINGS],
    },
    {
      title: t("appbar.tax_setup"),
      description: "",
      icon: <IconReceiptTax stroke={iconStroke} />,
      link: "/dashboard/settings/tax-setup",
      scopes: [PLAN_FEATURES.SETTINGS]
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
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b w-full sticky top-0 backdrop-blur-md z-[9999] border-restro-border-green">
        {/* left cluster: search + business switcher. Grouped so the switcher
            sits beside the search box instead of being spread to the middle by
            the container's justify-between. */}
        <div className="flex items-center gap-3">
          {/* search */}
          <button
            onClick={btnShowSearchModal}
            className="rounded-full flex items-center px-3 py-2 gap-2 bg-restro-green-light text-restro-text"
          >
            <IconSearch stroke={iconStroke} />
            <div
              type="text"
              className="bg-transparent outline-none text-start w-48 md:flex items-center justify-between hidden"
              placeholder={t('appbar.search_placeholder')}
            >
              <p>{t('appbar.search_placeholder')}</p>
              <div className="flex items-center gap-2">
                <div className="kbd kbd-sm rounded-lg"><IconCommand stroke={iconStroke} size={20}/></div>
                <div className="kbd kbd-sm rounded-lg">K</div>
              </div>
            </div>
          </button>
          {/* search */}

          {/* business switcher — renders null for every role except group_owner */}
          <BusinessSwitcher />
          {/* business switcher */}
        </div>

        {/* profile */}
        <AppBarDropdown />
        {/* profile */}
      </div>

      <dialog id="search-modal" className="modal">
        <div className="modal-box max-h-96 relative rounded-2xl">
          <div className= "flex items-center justify-between gap-4 sticky top-0 text-restro-text">
            <input type="search" className="input input-bordered w-full rounded-2xl outline-none focus:ring-0" placeholder={t('appbar.search_placeholder')} autoFocus value={search} onChange={e=>setSearch(e.target.value)} />

            <div>
              <form method="dialog">
                {/* if there is a button in form, it will close the modal */}
                <button className="btn btn-circle"><IconX stroke={iconStroke} /></button>
              </form>
            </div>
          </div>

          <div className="my-4">
            <form method="dialog">
            {
              searchItems
              .filter(item => {
                const requiredScopes = item.features;

                if(requiredScopes?.length == 0) {
                  return true;
                }
                 return requiredScopes?.some(scope => userPlanFeatures.includes(scope))
              })
              .filter((navItem)=>{
                const requiredScopes = navItem.scopes;
                if(hasFullBusinessAccess(userRole)) {
                  return true;
                }

                if(requiredScopes.length == 0) {
                  return true;
                }

                return requiredScopes.some((scope)=>userScopes.includes(scope));
              })
              .filter((item)=>item.title.toLowerCase().includes(search.trim().toLowerCase())).map((item, index)=>{
                return <button
                  onClick={()=>navigate(item.link)}
                  key={index}
                  className="flex items-center w-full gap-2 px-4 py-3 mb-2 transition active:scale-90 rounded-2xl justify-between hover:bg-restro-button-hover"
                >
                  <div className="flex items-center w-full transition-colors">
                    <div className="mr-2">
                      {item.icon}
                    </div>
                    <div className="flex-1 text-start">
                      <p className="transition-colors">{item.title}</p>
                      <p className="text-xs">{item.description}</p>
                    </div>
                    <div>
                      <IconChevronRight stroke={iconStroke} />
                    </div>
                  </div>
                </button>
              })
            }
            </form>
          </div>

          <p className="py-4 text-sm text-center text-slate-400">
            {t('appbar.press_esc_to_close')}
          </p>
        </div>
      </dialog>
    </>
  );
}
