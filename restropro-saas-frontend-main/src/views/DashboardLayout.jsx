import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import TopNavbar from "../components/TopNavbar";
import OperationalBar from "../components/OperationalBar";
import SearchModal from "../components/SearchModal";
import MobileNavbar from "../components/MobileNavbar";
import useAuth from "../helpers/useAuth";

export default function DashboardLayout() {
  const { ready } = useAuth();
  const location = useLocation();

  const isOperationalRoute = [
    "/dashboard/pos",
    "/dashboard/tables",
    "/dashboard/kitchen",
    "/dashboard/orders",
    "/dashboard/reservation",
  ].some((route) => location.pathname.startsWith(route));

  // Don't render (and thus don't fire any data requests) until the session has
  // been refreshed once. Guarantees the first request carries a fresh token.
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
      </div>
    );
  }

  return (
    <div
      className={
        isOperationalRoute
          ? "flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground font-sans"
          : "flex flex-col min-h-screen bg-background text-foreground font-sans"
      }
    >
      {/* Navigation: Operational Bar for POS/Tables/Kitchen OR TopNavbar for Backoffice */}
      {isOperationalRoute ? <OperationalBar /> : <TopNavbar />}

      {/* Main View Canvas */}
      <main
        className={
          isOperationalRoute
            ? "w-full flex-1 flex flex-col min-h-0 h-[calc(100vh-52px)] max-h-[calc(100vh-52px)] overflow-hidden"
            : "w-full flex-1 min-h-[calc(100vh-60px)] pb-16 md:pb-8"
        }
      >
        <Outlet />
      </main>

      {/* Mobile nav only in Backoffice, never covering operational screens */}
      {!isOperationalRoute && <MobileNavbar />}
      <SearchModal />
    </div>
  );
}

