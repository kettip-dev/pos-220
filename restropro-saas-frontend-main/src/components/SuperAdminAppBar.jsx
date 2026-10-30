import { Fragment, useContext } from "react";
import AvatarImg from "../assets/avatar.svg";
import { Menu, Transition } from "@headlessui/react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { signOut } from "../controllers/superadmin.controller";
import {
  IconChevronDown,
  IconLanguage,
  IconLifebuoy,
  IconLogout,
  IconSun,
  IconMoon,
  IconSearch,
  IconSettings,
  IconMenu2,
  IconBell,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { NavbarContext } from "../contexts/NavbarContext";
import { toggleNavbar } from "../helpers/NavbarSettings";
import clsx from "clsx";

export default function SuperAdminAppBar() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const user = getUserDetailsInLocalStorage();
  const [isNavbarCollapsed, setIsNavbarCollapsed] = useContext(NavbarContext);

  const btnLogout = async () => {
    try {
      toast.loading("Please wait...");
      const response = await signOut();
      if (response.status === 200) {
        toast.dismiss();
        toast.success(response.data.message);
        navigate("/superadmin", { replace: true });
      }
    } catch (error) {
      const message =
        error?.response?.data?.message || "Something went wrong! Try later!";
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  };

  const btnToggleSidebar = () => {
    const isNavCollapsed = toggleNavbar();
    setIsNavbarCollapsed(Boolean(isNavCollapsed));
  };

  return (
    <header className="h-14 flex items-center justify-between px-4 sm:px-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161B22] sticky top-0 z-20 transition-colors">
      
      {/* Left: Sidebar Toggle & Platform Status */}
      <div className="flex items-center gap-3">
        <button
          onClick={btnToggleSidebar}
          type="button"
          title="Toggle Navigation"
          className="p-1.5 rounded-md text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none"
        >
          <IconMenu2 stroke={iconStroke} size={19} />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 text-[#108000] dark:text-[#2CA01C] font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#2CA01C] animate-pulse" />
            <span>Platform Active</span>
          </div>
        </div>
      </div>

      {/* Middle: QuickBooks Global Search Bar */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
        <div className="w-full relative flex items-center">
          <div className="absolute left-3 text-gray-400 pointer-events-none">
            <IconSearch stroke={iconStroke} size={16} />
          </div>
          <input
            type="search"
            placeholder={t("appbar.search_placeholder", "Search businesses, plans, reports... (Ctrl + /)")}
            className="w-full pl-9 pr-12 py-1.5 text-xs rounded-full border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2CA01C] focus:border-[#2CA01C] transition-all"
          />
          <div className="absolute right-2.5">
            <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-2xs">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right: Utility Icons & User Menu */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Help & Support */}
        <Link
          to="/superadmin/dashboard/contact-support"
          title={t("appbar.support", "Support & Help")}
          className="p-2 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <IconLifebuoy stroke={iconStroke} size={18} />
        </Link>

        {/* Language switch */}
        <Link
          to="/superadmin/dashboard/language"
          title={t("appbar.language", "Language")}
          className="p-2 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <IconLanguage stroke={iconStroke} size={18} />
        </Link>

        {/* Theme mode toggle */}
        <button
          onClick={toggleTheme}
          type="button"
          title={theme === "light" ? t("appbar.dark_mode", "Dark Mode") : t("appbar.light_mode", "Light Mode")}
          className="p-2 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {theme === "light" ? (
            <IconMoon stroke={iconStroke} size={18} />
          ) : (
            <IconSun stroke={iconStroke} size={18} />
          )}
        </button>

        {/* QuickBooks Settings Gear Icon */}
        <Link
          to="/superadmin/dashboard/google"
          title="Settings"
          className="p-2 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <IconSettings stroke={iconStroke} size={18} />
        </Link>

        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1 hidden sm:block" />

        {/* Profile Menu */}
        <Menu as="div" className="relative inline-block text-left z-50">
          <div>
            <Menu.Button className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <div className="relative">
                <img
                  src={AvatarImg}
                  alt="avatar"
                  className="w-7 h-7 rounded-full object-cover"
                />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#2CA01C] ring-1 ring-white dark:ring-[#161B22]" />
              </div>
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 hidden md:block max-w-[120px] truncate">
                {user.name}
              </span>
              <IconChevronDown
                stroke={iconStroke}
                size={14}
                className="text-gray-400"
              />
            </Menu.Button>
          </div>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-gray-800 rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800">
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                  {user.name}
                </p>
                <p className="text-[11px] text-gray-500 truncate">
                  {new String(user.role).toUpperCase()}
                </p>
              </div>

              <div className="p-1">
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      to="/superadmin/dashboard/contact-support"
                      className={clsx(
                        "group flex gap-2.5 w-full items-center rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                        active
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-[#108000] dark:text-[#2CA01C]"
                          : "text-gray-700 dark:text-gray-300"
                      )}
                    >
                      <IconLifebuoy stroke={iconStroke} size={16} />
                      Support & Help
                    </Link>
                  )}
                </Menu.Item>

                <Menu.Item>
                  {({ active }) => (
                    <Link
                      to="/superadmin/dashboard/language"
                      className={clsx(
                        "group flex gap-2.5 w-full items-center rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                        active
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-[#108000] dark:text-[#2CA01C]"
                          : "text-gray-700 dark:text-gray-300"
                      )}
                    >
                      <IconLanguage stroke={iconStroke} size={16} />
                      {t("appbar.language", "Language")}
                    </Link>
                  )}
                </Menu.Item>

                <Menu.Item>
                  {({ active }) => (
                    <Link
                      to="/superadmin/dashboard/google"
                      className={clsx(
                        "group flex gap-2.5 w-full items-center rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                        active
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-[#108000] dark:text-[#2CA01C]"
                          : "text-gray-700 dark:text-gray-300"
                      )}
                    >
                      <IconSettings stroke={iconStroke} size={16} />
                      Account Settings
                    </Link>
                  )}
                </Menu.Item>
              </div>

              <div className="p-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={btnLogout}
                      className={clsx(
                        "group flex gap-2.5 w-full items-center rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                        active
                          ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                          : "text-red-600 dark:text-red-400"
                      )}
                    >
                      <IconLogout stroke={iconStroke} size={16} />
                      Sign Out
                    </button>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Transition>
        </Menu>

      </div>
    </header>
  );
}
