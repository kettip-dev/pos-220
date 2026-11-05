import React, { useContext } from 'react'
import { Outlet } from "react-router-dom"
import SuperAdminNavbar from '../../components/SuperAdminNavbar'
import SuperAdminMobileNavbar from '../../components/SuperAdminMobileNavbar'
import SuperAdminAppBar from '../../components/SuperAdminAppBar'
import { NavbarContext } from '../../contexts/NavbarContext'
import useAuth from '../../helpers/useAuth'

export default function SuperAdminDashboadLayout() {
  const { ready } = useAuth();
  const [isNavbarCollapsed] = useContext(NavbarContext)

  // Don't fire any data requests until the session has been refreshed once.
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#0D1117]">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#2CA01C]" />
          <span className="text-xs font-medium text-gray-500">Loading Bong POS Super Admin...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white dark:bg-[#0D1117]">
      <SuperAdminNavbar />
      <div
        className={
          isNavbarCollapsed
            ? "w-full ml-0 md:ml-16 overflow-y-auto h-screen pb-20 md:pb-0 bg-white dark:bg-[#0D1117] transition-all duration-200"
            : "w-full ml-0 md:ml-64 overflow-y-auto h-screen pb-20 md:pb-0 bg-white dark:bg-[#0D1117] transition-all duration-200"
        }
      >
        <SuperAdminAppBar />
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
      <SuperAdminMobileNavbar />
    </div>
  );
}
