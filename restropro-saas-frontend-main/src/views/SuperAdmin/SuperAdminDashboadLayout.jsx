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
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
      </div>
    );
  }

  return (
   <div className='flex'>
      <SuperAdminNavbar />
      <div className={isNavbarCollapsed?`w-full ml-[5.5rem] md:ml-[5.5rem] overflow-y-auto h-screen pb-20 md:pb-0`:`w-full ml-0 md:ml-72 overflow-y-auto h-screen pb-20 md:pb-0`}>
        <SuperAdminAppBar />
        <Outlet />
      </div>
      <SuperAdminMobileNavbar />
    </div>
  )
}
