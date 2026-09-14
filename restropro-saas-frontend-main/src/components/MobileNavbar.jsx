import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";
import { iconStroke } from "../config/config";
import { useTheme } from "../contexts/ThemeContext";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { getNavbarItems } from "./Navbar";

function filterByPlanAndScope(items, user) {
  const { role: userRole, scope, planFeautures } = user;
  const userScopes = scope?.split(",") || [];
  const userPlanFeatures = Array.isArray(planFeautures)
    ? planFeautures
    : planFeautures?.split(",") || [];

  return items
    .filter((item) => {
      if (userRole === "admin") return true;
      const requiredFeatures = item.features || [];
      if (requiredFeatures.length === 0) return true;
      return requiredFeatures.some((feature) =>
        userPlanFeatures.includes(feature)
      );
    })
    .filter((item) => {
      if (item.type === "text") return true;
      if (item.type === "link") {
        if (userRole === "admin") return true;
        const requiredScopes = item.scopes || [];
        return requiredScopes.some((sc) => userScopes.includes(sc));
      }
      return false;
    });
}

export default function MobileNavbar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { theme } = useTheme();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const user = getUserDetailsInLocalStorage();
  const baseItems = getNavbarItems(t);
  const navbarItems = filterByPlanAndScope(baseItems, user);

  const primaryItems = navbarItems
    .filter((item) => item.type === "link")
    .slice(0, 3);

  const isRouteActive = (path) => pathname.startsWith(path);

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white dark:bg-background border-t border-gray-200 dark:border-restro-border-green">
        <div className="flex items-center justify-between px-2 py-2.5">
          {primaryItems.map((item, index) => {
            const active = isRouteActive(item.path);
            return (
              <Link
                key={`${item.path}-${index}`}
                to={item.path}
                className={clsx(
                  "flex flex-col items-center justify-center flex-1 gap-0.5 py-1 transition-colors",
                  active ? "text-restro-green" : "text-gray-500 dark:text-gray-400"
                )}
              >
                {React.cloneElement(item.icon, {
                  stroke: iconStroke,
                  className: clsx("w-6 h-6", {
                    "text-restro-green": active,
                    "text-gray-500 dark:text-gray-400": !active,
                  }),
                })}
                <span className="text-[10px] font-medium truncate max-w-[4rem]">
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
              isMoreOpen ? "text-restro-green" : "text-gray-500 dark:text-gray-400"
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
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
        />
      )}

      <div
        className={clsx(
          "fixed inset-x-0 bottom-0 z-50 md:hidden transform transition-transform duration-300 ease-out",
          isMoreOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="mx-3 rounded-t-3xl bg-white dark:bg-[#1A1A1A] shadow-[0_24px_60px_rgba(15,23,42,0.25)] dark:shadow-none dark:border dark:border-restro-border-green dark:border-b-0 pb-6 pt-4">
          <div className="flex items-center justify-between px-4 pb-3">
            <h2 className="text-lg font-semibold text-restro-green-dark dark:text-foreground">
              Menu
            </h2>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setIsMoreOpen(false)}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors"
            >
              <IconX stroke={iconStroke} className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            </button>
          </div>

          <div className="h-px bg-gray-100 dark:bg-restro-border-green mx-4 mb-3" />

          <div className="max-h-[60vh] overflow-y-auto px-2">
            {navbarItems
              .filter(
                (item) =>
                  item.type === "text" ||
                  (item.type === "link" &&
                    !primaryItems.some((pItem) => pItem.path === item.path))
              )
              .map((item, index) => {
                if (item.type === "text") {
                  return (
                    <div
                      key={`section-${item.text}-${index}`}
                      className="mt-4 mb-1 px-2 text-[10px] font-semibold tracking-[0.18em] uppercase text-gray-400"
                    >
                      {item.text}
                    </div>
                  );
                }

                const active = isRouteActive(item.path);
                return (
                  <Link
                    key={`item-${item.path}-${index}`}
                    to={item.path}
                    onClick={() => setIsMoreOpen(false)}
                    className={clsx(
                      "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-restro-green-light text-gray-900 dark:text-foreground"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2A2A2A]"
                    )}
                  >
                    {React.cloneElement(item.icon, {
                      stroke: iconStroke,
                      className: clsx("w-6 h-6", {
                        "text-gray-500 dark:text-gray-400": !active,
                        "text-gray-700 dark:text-foreground": active,
                      }),
                    })}
                    <span>{item.text}</span>
                  </Link>
                );
              })}
          </div>
        </div>
      </div>
    </>
  );
}

