import { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

import AvatarImg from "../assets/avatar.svg";
import {
  IconChevronDown,
  IconDevices,
  IconLanguage,
  IconLifebuoy,
  IconLogout,
  IconUser,
  IconSun,
  IconMoon
} from "@tabler/icons-react";

import { signOut } from "../controllers/auth.controller";
import { iconStroke } from "../config/config";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { useTheme } from "../contexts/ThemeContext";
import clsx from "clsx";

export default function AppBarDropdown({ isCollapsed = false, className = "", align = "right" }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = getUserDetailsInLocalStorage();
  const { theme, toggleTheme } = useTheme();

  const btnLogout = async () => {
    try {
      toast.loading(t("toast.please_wait"));
      const response = await signOut();
      if (response.status === 200) {
        toast.dismiss();
        toast.success(t("toast.logout_success"));
        navigate("/login", { replace: true });
      }
    } catch (error) {
      const message = error?.response?.data?.message || t("toast.something_went_wrong");
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  };

  const itemBaseClasses =
    "group flex gap-2.5 w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer";

  return (
    <Menu as="div" className="relative inline-block text-left z-50">
      <div>
        <Menu.Button
          className={clsx(
            "text-sm transition rounded-xl flex items-center justify-between gap-2 p-1.5 w-full cursor-pointer",
            isCollapsed
              ? "w-11 h-11 justify-center rounded-xl hover:bg-white/10"
              : "hover:bg-white/10 border border-transparent hover:border-white/15",
            className
          )}
        >
          <div className="flex items-center gap-2.5 overflow-hidden text-left">
            <img
              src={AvatarImg}
              alt="avatar"
              className="w-10 h-10 rounded-full shrink-0 border border-white/20 p-0.5 bg-white/10"
            />
            {!isCollapsed && (
              <div className="truncate">
                <p className="font-semibold text-sm text-white truncate">
                  {user.name}
                </p>
                <p className="text-[11px] text-slate-300 capitalize">
                  {user.role}
                  {user.designation ? ` • ${user.designation}` : ""}
                </p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <IconChevronDown stroke={iconStroke} className="text-slate-300 shrink-0 mr-1" size={18} />
          )}
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
        <Menu.Items
          className={clsx(
            "absolute z-[100] divide-y divide-gray-100 dark:divide-zinc-800 rounded-2xl shadow-2xl ring-1 ring-black/10 focus:outline-none bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-1.5 w-64",
            align === "left"
              ? isCollapsed
                ? "left-full ml-3 top-0 origin-top-left"
                : "left-0 top-full mt-2 origin-top-left"
              : "right-0 top-full mt-2 origin-top-right"
          )}
        >
          {/* User Profile Card Header */}
          <div className="px-3 py-2.5 mb-1 bg-gray-50 dark:bg-zinc-800/60 rounded-xl">
            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
              {user.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize truncate">
              {user.role}
              {user.designation ? ` • ${user.designation}` : ""}
            </p>
          </div>

          <div className="py-1">
            {[
              {
                label: t("appbar.profile"),
                icon: <IconUser stroke={iconStroke} size={18} className="text-gray-500 dark:text-gray-400 group-hover:text-[#2CA01C] transition-colors shrink-0" />,
                to: "/dashboard/profile"
              },
              {
                label: t("appbar.my_devices"),
                icon: <IconDevices stroke={iconStroke} size={18} className="text-gray-500 dark:text-gray-400 group-hover:text-[#2CA01C] transition-colors shrink-0" />,
                to: "/dashboard/devices"
              },
              {
                label: t("appbar.language"),
                icon: <IconLanguage stroke={iconStroke} size={18} className="text-gray-500 dark:text-gray-400 group-hover:text-[#2CA01C] transition-colors shrink-0" />,
                to: "/dashboard/language"
              },
              {
                label: t("appbar.support"),
                icon: <IconLifebuoy stroke={iconStroke} size={18} className="text-gray-500 dark:text-gray-400 group-hover:text-[#2CA01C] transition-colors shrink-0" />,
                to: "/dashboard/contact-support"
              }
            ].map((item, idx) => (
              <Menu.Item key={idx}>
                {({ active }) => (
                  <Link
                    to={item.to}
                    className={clsx(
                      itemBaseClasses,
                      active && "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white"
                    )}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                )}
              </Menu.Item>
            ))}

            {/* Theme Toggle */}
            <Menu.Item>
              {({ active }) => (
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={clsx(
                    itemBaseClasses,
                    active && "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white"
                  )}
                >
                  {theme === "light" ? (
                    <IconMoon stroke={iconStroke} size={18} className="text-gray-500 dark:text-gray-400 group-hover:text-[#2CA01C] transition-colors shrink-0" />
                  ) : (
                    <IconSun stroke={iconStroke} size={18} className="text-gray-500 dark:text-gray-400 group-hover:text-[#2CA01C] transition-colors shrink-0" />
                  )}
                  <span>{theme === "light" ? t("appbar.dark_mode") : t("appbar.light_mode")}</span>
                </button>
              )}
            </Menu.Item>
          </div>

          {/* Logout */}
          <div className="pt-1">
            <Menu.Item>
              {({ active }) => (
                <button
                  type="button"
                  onClick={btnLogout}
                  className={clsx(
                    "group flex gap-2.5 w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer",
                    active && "bg-red-50 dark:bg-red-950/30"
                  )}
                >
                  <IconLogout stroke={iconStroke} size={18} className="text-red-500 dark:text-red-400 shrink-0" />
                  <span>{t("appbar.logout")}</span>
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
