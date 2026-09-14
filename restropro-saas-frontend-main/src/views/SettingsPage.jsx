import React, { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import HorizontalSettingsNav from "../components/HorizontalSettingsNav";

export default function SettingsPage() {
  const { pathname } = useLocation();
  const contentContainerRef = useRef(null);

  // Automatically scroll page up to top whenever setting route changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (contentContainerRef.current) {
      contentContainerRef.current.scrollTop = 0;
    }
    // Also scroll all scrollable parent containers to top
    const scrollableContainers = document.querySelectorAll(".overflow-y-auto");
    scrollableContainers.forEach((container) => {
      container.scrollTop = 0;
    });
  }, [pathname]);

  // Check if we are on the main Settings Home landing page route
  const isSettingsHome =
    pathname === "/dashboard/settings" || pathname === "/dashboard/settings/";

  return (
    <div className="w-full min-h-[calc(100vh-64px)] flex flex-col">
      {/* Top Horizontal Navigation Strip rendered only on setting sub-pages */}
      {!isSettingsHome && <HorizontalSettingsNav />}

      {/* Main Content Area */}
      <div ref={contentContainerRef} className="flex-1 w-full overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
