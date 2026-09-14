import React, { useContext } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import AppBar from "../components/AppBar";
import MobileNavbar from "../components/MobileNavbar";
import { NavbarContext } from "../contexts/NavbarContext";
import useAuth from "../helpers/useAuth";
import { useEffect } from "react";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

export default function DashboardLayout() {
  const { ready } = useAuth();
  const [isNavbarCollapsed] = useContext(NavbarContext);
  const navigate = useNavigate();

  //   useEffect(() => {
  //   const token = Cookies.get("accessToken");
  //   console.log("DashboardLayout - token:", token);
  //   if (!token) return;

  //   const decoded = jwtDecode(token);
  //   console.log(decoded);

  //   if (String(decoded.is_active) === "0") {
  //     navigate("/dashboard/inactive-subscription", { replace: true });
  //   }
  // }, [navigate]);

  const contentPaddingClass = isNavbarCollapsed
    ? "w-full md:pl-[5.5rem]"
    : "w-full md:pl-72";

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
    <div className="flex min-h-screen">
      <div className="hidden md:block">
        <Navbar />
      </div>
      {/* <div className={`${contentPaddingClass} pb-20`}> */}
      <div className={`${contentPaddingClass} pb-24 md:pb-0`}>
        <AppBar />
        <Outlet />
      </div>
      <MobileNavbar />
    </div>
  );
}
