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

export default function AppBarDropdown({ isCollapsed = false, className = "" }) {
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
    "group flex gap-2 w-full items-center rounded-2xl px-3 py-2 text-sm transition-colors ";

  return (
    <Menu as="div" className="relative inline-block text-left z-50 w-full">
      <div>
        <Menu.Button
          className={clsx(
            "text-sm transition rounded-2xl flex items-center justify-between gap-2 p-1.5 w-full cursor-pointer",
            isCollapsed
              ? "w-11 h-11 justify-center rounded-full hover:bg-restro-border-green-light dark:hover:bg-zinc-800"
              : "hover:bg-restro-border-green-light/60 dark:hover:bg-zinc-800/60 border border-transparent hover:border-slate-200 dark:hover:border-zinc-700",
            className
          )}
        >
          <div className="flex items-center gap-2.5 overflow-hidden text-left">
            <img
              src={AvatarImg}
              alt="avatar"
              className="w-10 h-10 rounded-full shrink-0 border border-slate-200 dark:border-zinc-700 p-0.5 bg-white dark:bg-zinc-800"
            />
            {!isCollapsed && (
              <div className="truncate">
                <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                  {user.name}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                  {user.role}
                  {user.designation ? ` • ${user.designation}` : ""}
                </p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <IconChevronDown stroke={iconStroke} className="text-slate-400 shrink-0 mr-1" size={18} />
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
            "absolute left-0 mt-2 w-60 origin-top-left divide-y divide-gray-100 dark:divide-zinc-800 rounded-2xl shadow-2xl ring-1 ring-black/5 focus:outline-none bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 z-50 p-1"
          )}
        >
          <div className="px-1 py-1">
            {[
              {
                label: t("appbar.profile"),
                icon: <IconUser stroke={iconStroke} />,
                to: "/dashboard/profile"
              },
              {
                label: t("appbar.my_devices"),
                icon: <IconDevices stroke={iconStroke} />,
                to: "/dashboard/devices"
              },
              {
                label: t("appbar.language"),
                icon: <IconLanguage stroke={iconStroke} />,
                to: "/dashboard/language"
              },
              {
                label: t("appbar.support"),
                icon: <IconLifebuoy stroke={iconStroke} />,
                to: "/dashboard/contact-support"
              }
            ].map((item, idx) => (
              <Menu.Item key={idx}>
                {({ active }) => (
                  <Link
                    to={item.to}
                    className={clsx(
                      itemBaseClasses,
                      "hover:bg-restro-button-hover"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                )}
              </Menu.Item>
            ))}

            {/* Theme Toggle */}
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={toggleTheme}
                  className={clsx(
                    itemBaseClasses,
                    "hover:bg-restro-button-hover"
                  )}
                >
                  {theme === "light" ? <IconMoon stroke={iconStroke} /> : <IconSun stroke={iconStroke} />}
                  {theme === "light" ? t("appbar.dark_mode") : t("appbar.light_mode")}
                </button>
              )}
            </Menu.Item>

            {/* Logout */}
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={btnLogout}
                  className={clsx(
                    itemBaseClasses,
                    "hover:bg-red-100 dark:hover:bg-red-800/20",
                    theme === "black"
                      ? active
                        ? "bg-red-100 text-red-600"
                        : "text-red-500"
                      : active
                      ? "bg-red-100 text-red-400"
                      : "text-red-400"
                  )}
                >
                  <IconLogout stroke={iconStroke} />
                  {t("appbar.logout")}
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
