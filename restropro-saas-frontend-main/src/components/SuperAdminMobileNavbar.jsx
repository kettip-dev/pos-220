import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";
import { iconStroke } from "../config/config";
import { getSuperAdminNavGroups, getSuperAdminNavbarItems } from "./SuperAdminNavbar";

export default function SuperAdminMobileNavbar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const navGroups = getSuperAdminNavGroups(t);
  const navbarItems = getSuperAdminNavbarItems(t);

  const primaryItems = navbarItems
    .filter((item) => item.type === "link")
    .slice(0, 3);

  const isRouteActive = (path) => pathname.includes(path);

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white dark:bg-restro-card-bg border-t border-gray-200 dark:border-restro-border-green">
        <div className="flex items-center justify-between px-2 py-2.5">
          {primaryItems.map((item, index) => {
            const active = isRouteActive(item.path);
            return (
              <Link
                key={`${item.path}-${index}`}
                to={item.path}
                className={clsx(
                  "flex flex-col items-center justify-center flex-1 gap-0.5 py-1 transition-colors",
                  active ? "text-restro-green font-semibold" : "text-gray-500 dark:text-gray-400"
                )}
              >
                {React.cloneElement(item.icon, {
                  stroke: iconStroke,
                  className: clsx("w-6 h-6", {
                    "text-restro-green": active,
                    "text-gray-500 dark:text-gray-400": !active,
                  }),
                })}
                <span className="text-[10px] truncate max-w-[4.5rem]">
                  {item.text}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            className={clsx(
              "flex flex-col items-center justify-center flex-1 gap-0.5 py-1 transition-colors",
              isMoreOpen ? "text-restro-green font-semibold" : "text-gray-500 dark:text-gray-400"
            )}
          >
            <IconMenu2
              stroke={iconStroke}
              className={clsx("w-6 h-6", {
                "text-restro-green": isMoreOpen,
                "text-gray-500 dark:text-gray-400": !isMoreOpen,
              })}
            />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {isMoreOpen && (
        <button
          type="button"
          onClick={() => setIsMoreOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
        />
      )}

      <div
        className={clsx(
          "fixed inset-x-0 bottom-0 z-50 md:hidden transform transition-transform duration-300 ease-out",
          isMoreOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="mx-2 rounded-t-3xl bg-white dark:bg-restro-card-bg shadow-[0_-10px_40px_rgba(0,0,0,0.15)] dark:border-t dark:border-restro-border-green pb-8 pt-4">
          <div className="flex items-center justify-between px-5 pb-3">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Super Admin Menu
            </h2>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setIsMoreOpen(false)}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-restro-gray transition-colors"
            >
              <IconX stroke={iconStroke} className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="h-px bg-gray-100 dark:bg-restro-border-green mx-4 mb-3" />

          <div className="max-h-[65vh] overflow-y-auto px-3 flex flex-col gap-4 no-scrollbar">
            {navGroups.map((group) => (
              <div key={group.id} className="flex flex-col gap-1">
                <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-gray-900 dark:text-gray-100">
                  {group.title}
                </span>
                {group.items.map((item) => {
                  const active = isRouteActive(item.path);
                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      onClick={() => setIsMoreOpen(false)}
                      className={clsx(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors",
                        active
                          ? "bg-restro-green-light dark:bg-restro-gray text-restro-green font-bold"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-restro-gray/60"
                      )}
                    >
                      {React.cloneElement(item.icon, {
                        stroke: iconStroke,
                        className: clsx("w-5 h-5", {
                          "text-restro-green": active,
                          "text-gray-500 dark:text-gray-400": !active,
                        }),
                      })}
                      <span>{item.text}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

