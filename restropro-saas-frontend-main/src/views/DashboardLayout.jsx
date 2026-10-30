import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import QBONavigation from "../components/QBONavigation";
import OperationalBar from "../components/OperationalBar";
import SearchModal from "../components/SearchModal";
import useAuth from "../helpers/useAuth";

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
  if (isOperationalRoute) {
    return (
      <div className="flex flex-row h-screen w-screen overflow-hidden bg-background text-foreground font-sans relative">
        <OperationalBar
          isCollapsed={isOperationalBarCollapsed}
          onToggleCollapse={toggleOperationalBar}
        />
        <main className="flex-1 flex flex-col min-w-0 h-screen max-h-screen overflow-hidden transition-all duration-300">
          <Outlet context={{ isOperationalBarCollapsed, toggleOperationalBar }} />
        </main>
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
