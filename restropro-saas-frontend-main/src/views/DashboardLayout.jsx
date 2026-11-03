import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import QBONavigation from "../components/QBONavigation";
import OperationalBar, { OperationalBottomNav } from "../components/OperationalBar";
import SearchModal from "../components/SearchModal";
import useAuth from "../helpers/useAuth";

const LAYOUT_MODE_KEY = "restro_dashboard_layout_mode";

export default function DashboardLayout() {
  const { ready } = useAuth();
  const location = useLocation();

  const [isOperationalBarCollapsed, setIsOperationalBarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("restro_operational_bar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleOperationalBar = () => {
    setIsOperationalBarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("restro_operational_bar_collapsed", String(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const isOperationalRoute = [
    "/dashboard/pos",
    "/dashboard/tables",
    "/dashboard/kitchen",
    "/dashboard/orders",
    "/dashboard/reservation",
  ].some((route) => location.pathname.startsWith(route));

  // Back-office pages also reachable from the OperationalBar rail. They keep whichever
  // layout the user arrived from, so staff on the POS keep the rail and managers in the
  // back office keep its navigation.
  const isSharedPageRoute = [
    "/dashboard/invoices",
    "/dashboard/customers",
  ].some((route) => location.pathname.startsWith(route));

  if (!isSharedPageRoute) {
    try {
      sessionStorage.setItem(LAYOUT_MODE_KEY, isOperationalRoute ? "operational" : "backoffice");
    } catch {
      // storage unavailable: shared pages fall back to the back-office layout
    }
  }

  let isShiftPageRoute = false;
  if (isSharedPageRoute) {
    try {
      isShiftPageRoute = sessionStorage.getItem(LAYOUT_MODE_KEY) === "operational";
    } catch {
      isShiftPageRoute = false;
    }
  }

  // Don't render until the session has been refreshed once
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
      </div>
    );
  }

  // Operational Terminal Screens (POS / Tables / Kitchen / Orders / Reservations)
  // Must use flex-row so the vertical OperationalBar rail is on the left and the page content fills the right.
  if (isOperationalRoute || isShiftPageRoute) {
    return (
      <div className="flex flex-col md:flex-row h-dvh w-screen overflow-hidden bg-background text-foreground font-sans relative">
        <OperationalBar
          isCollapsed={isOperationalBarCollapsed}
          onToggleCollapse={toggleOperationalBar}
        />
        {isShiftPageRoute ? (
          <main className="flex-1 min-w-0 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-white dark:bg-[#08101D]">
            <Outlet context={{ isOperationalBarCollapsed, toggleOperationalBar }} />
          </main>
        ) : (
          <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden transition-all duration-300">
            <Outlet context={{ isOperationalBarCollapsed, toggleOperationalBar }} />
          </main>
        )}
        {/* Phones: bottom tab bar replaces the left rail */}
        <OperationalBottomNav />
        <SearchModal />
      </div>
    );
  }

  // Backoffice Layout with QuickBooks-style Dual Navigation
  return (
    <QBONavigation>
      <main className="w-full flex-1 min-h-[calc(100vh-56px)] pb-16 md:pb-8 p-4 sm:p-6 lg:p-8 bg-white dark:bg-[#08101D]">
        <Outlet context={{ isOperationalBarCollapsed, toggleOperationalBar }} />
      </main>
      <SearchModal />
    </QBONavigation>
  );
}
