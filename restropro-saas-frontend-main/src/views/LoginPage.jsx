import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  signIn,
  googleSignIn,
} from "../controllers/auth.controller";
import { Link, useNavigate } from "react-router-dom";
import { isRestroUserAuthenticated } from "../helpers/AuthStatus";
import {
  getUserDetailsInLocalStorage,
  saveUserDetailsInLocalStorage,
} from "../helpers/UserDetails";
import { SCOPES } from "../config/scopes";
import { useTranslation } from "react-i18next";
import LanguageChanger from "../components/LanguageChanger";
import ManagerPinModal from "../components/common/ManagerPinModal";
import { signInWithPopup } from "firebase/auth";
import { getGoogleAuthClient } from "../config/firebase";
import ApiClient from "../helpers/ApiClient";
import {
  IconArmchair,
  IconChefHat,
  IconReceipt,
  IconEye,
  IconEyeOff,
  IconMail,
  IconLock,
  IconSparkles,
  IconShieldCheck,
  IconBolt,
  IconTrendingUp,
} from "@tabler/icons-react";

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [googleAuthClient, setGoogleAuthClient] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showManagerPinModal, setShowManagerPinModal] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState(null);
  const [shiftRestrictedMessage, setShiftRestrictedMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadGoogleAuth = async () => {
      try {
        const { data } = await ApiClient.get("/auth/google-config");
        if (data.enabled && isMounted) {
          setGoogleAuthClient(getGoogleAuthClient(data.firebaseConfig));
        }
      } catch (error) {
        console.error(
          "Unable to load Google Sign-In configuration",
          error
        );
      }
    };

    loadGoogleAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const routeAuthenticatedUser = () => {
    const user = getUserDetailsInLocalStorage();
    if (!user) return;

    const { role, scope } = user;

    if (role === "superadmin") {
      navigate("/superadmin/dashboard/home", {
        replace: true,
      });
      return;
    }

    // A Business Group Owner has no per-user scope string (their access comes
    // from the business group), so they route like an admin.
    if (role === "admin" || role === "group_owner") {
      navigate("/dashboard/home", {
        replace: true,
      });
      return;
    }

    const userScopes = scope?.split(",") || [];
    if (userScopes.includes(SCOPES.DASHBOARD)) {
      navigate("/dashboard/home", {
        replace: true,
      });
    } else {
      navigate("/dashboard/profile", {
        replace: true,
      });
    }
  };

  useEffect(() => {
    const restroAuthenticated = isRestroUserAuthenticated();
    if (restroAuthenticated) {
      routeAuthenticatedUser();
    }
  }, []);

  const handleGoogleAuth = async () => {
    if (!googleAuthClient || isLoading) return;

    try {
      setIsLoading(true);
      toast.loading(t("login.loading_message"));

      const result = await signInWithPopup(
        googleAuthClient.auth,
        googleAuthClient.googleProvider
      );
      const idToken = await result.user.getIdToken();

      const res = await googleSignIn(idToken);

      if (res.status === 200) {
        toast.dismiss();
        toast.success(t("login.success_message"));

        const resultUser = res.data.user;

        const user = {
          ...resultUser,
          planFeautures: resultUser.features
            ? JSON.parse(resultUser.features)
            : null,
          features_description: resultUser.features_description
            ? JSON.parse(resultUser.features_description)
            : null,
        };
        saveUserDetailsInLocalStorage(user);

        routeAuthenticatedUser();
        return;
      } else {
        const message = res.data.message;
        toast.dismiss();
        toast.error(message);
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        t("login.error_message");

      toast.dismiss();
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const username = e.target.username.value;
    const password = e.target.password.value;

    if (!username) {
      e.target.username.focus();
      toast.error(t("login.username_error"));
      return;
    }

    if (!password) {
      e.target.password.focus();
      toast.error(t("login.password_error"));
      return;
    }

    try {
      setIsLoading(true);
      toast.loading(t("login.loading_message"));

      const res = await signIn(username, password);

      if (res.status === 200) {
        toast.dismiss();
        toast.success(t("login.success_message"));

        const result = res.data.user;

        const user = {
          ...result,
          planFeautures: result.features
            ? JSON.parse(result.features)
            : null,
          features_description: result.features_description
            ? JSON.parse(result.features_description)
            : null,
        };
        saveUserDetailsInLocalStorage(user);

        routeAuthenticatedUser();
        return;
      } else {
        const message = res.data.message;
        toast.dismiss();
        toast.error(message);
      }
    } catch (error) {
      console.error(error);
      if (error?.response?.status === 403 && error?.response?.data?.shift_restricted) {
        setPendingCredentials({ username, password });
        setShiftRestrictedMessage(
          error?.response?.data?.message ||
          t("shift_roster.shift_login_restricted", "Login restricted: You are not scheduled for an active shift. Enter Manager PIN to authorize.")
        );
        setShowManagerPinModal(true);
        toast.dismiss();
        toast.error(error?.response?.data?.message || t("shift_roster.shift_login_restricted"));
        return;
      }

      const message =
        error?.response?.data?.message ||
        t("login.error_message");

      toast.dismiss();
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManagerOverrideSuccess = async (pin) => {
    if (!pendingCredentials) return;
    try {
      setIsLoading(true);
      const res = await signIn(pendingCredentials.username, pendingCredentials.password, pin);
      if (res.status === 200) {
        toast.dismiss();
        toast.success(t("shift_roster.manager_override_success", "Manager override authorized! Logging in..."));

        const result = res.data.user;
        const user = {
          ...result,
          planFeautures: result.features ? JSON.parse(result.features) : null,
          features_description: result.features_description ? JSON.parse(result.features_description) : null,
        };
        saveUserDetailsInLocalStorage(user);
        routeAuthenticatedUser();
      }
    } catch (err) {
      toast.dismiss();
      toast.error(err?.response?.data?.message || t("shift_roster.override_failed", "Manager override failed"));
    } finally {
      setIsLoading(false);
      setPendingCredentials(null);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white dark:bg-[#0D1117] transition-colors duration-300">
      {/* LEFT PANEL: Modern POS & Hospitality Showcase (Desktop & Large Tablet) */}
      <div className="relative hidden lg:flex lg:w-1/2 xl:w-7/12 flex-col justify-between p-10 xl:p-14 overflow-hidden bg-gradient-to-br from-[#0B0D13] via-[#121622] to-[#080A0E] text-white border-r border-slate-800/80 select-none">
        {/* Ambient atmospheric glows */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-slate-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03] pointer-events-none" />

        {/* Showcase Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-300 text-xs font-semibold tracking-wide uppercase">
            <IconSparkles size={14} />
            <span>{t("login.badge_pos") || "Next-Gen Restaurant OS"}</span>
          </div>
        </div>

        {/* Showcase Hero & Feature Highlights */}
        <div className="relative z-10 my-auto py-8 xl:py-12 max-w-xl">
          <div className="mb-8">
            <h1 className="text-3xl xl:text-5xl font-black text-white leading-tight tracking-tight">
              {t("login.showcase_title") || "Precision POS & Kitchen Operations"}
            </h1>
            <p className="mt-4 text-sm xl:text-base text-zinc-400 leading-relaxed font-normal">
              {t("login.showcase_desc") || "Designed for fast-paced cafes, restaurants, bars, and multi-station kitchens. Unify floor seating, order routing, and real-time sales on any device."}
            </p>
          </div>

          {/* Interactive Feature Cards */}
          <div className="space-y-3.5">
            {/* Card 1: Floor & Table Sync */}
            <div className="group flex items-start gap-4 p-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 hover:border-zinc-700 backdrop-blur-md transition-all duration-200">
              <div className="w-11 h-11 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/25 group-hover:scale-105 transition-transform">
                <IconArmchair size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-white">
                    {t("login.feature_floor") || "Dynamic Floor & Table Plan"}
                  </h4>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/10 text-zinc-300 border border-white/15 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {t("login.live_sync") || "Live Sync"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-300/80 leading-normal">
                  {t("login.feature_floor_desc") || "Interactive seating layout, multi-guest orders, split tickets & real-time occupancy."}
                </p>
              </div>
            </div>

            {/* Card 2: Multi-Station KDS */}
            <div className="group flex items-start gap-4 p-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 hover:border-zinc-700 backdrop-blur-md transition-all duration-200">
              <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 group-hover:scale-105 transition-transform">
                <IconChefHat size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-white">
                    {t("login.feature_kds") || "Intelligent Multi-Station KDS"}
                  </h4>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/25 shrink-0">
                    <IconBolt size={12} />
                    {t("login.instant_kot") || "Instant KOT"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-300/80 leading-normal">
                  {t("login.feature_kds_desc") || "Auto-routing to Kitchen, Grill, Fryer, and Bar with companion item synchronization."}
                </p>
              </div>
            </div>

            {/* Card 3: Fast Settlement */}
            <div className="group flex items-start gap-4 p-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 hover:border-zinc-700 backdrop-blur-md transition-all duration-200">
              <div className="w-11 h-11 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30 group-hover:scale-105 transition-transform">
                <IconReceipt size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-white">
                    {t("login.feature_settlement") || "High-Speed Touch Checkout"}
                  </h4>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 shrink-0">
                    <IconTrendingUp size={12} />
                    {t("login.uptime") || "99.9% Uptime"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-300/80 leading-normal">
                  {t("login.feature_settlement_desc") || "Multi-tender settlement, thermal ESC/POS receipt generation & cloud reporting."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Showcase Footer / Social Proof */}
        <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              <div className="w-6 h-6 rounded-full bg-zinc-700 border border-zinc-900 flex items-center justify-center text-[10px] text-white font-bold">R</div>
              <div className="w-6 h-6 rounded-full bg-zinc-600 border border-zinc-900 flex items-center justify-center text-[10px] text-white font-bold">P</div>
              <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-900 flex items-center justify-center text-[10px] text-white font-bold">O</div>
            </div>
            <span className="text-zinc-300 font-medium">{t("login.powering_venues") || "Powering 1,000+ venues worldwide"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{t("login.cloud_sync_active") || "Cloud Sync Active"}</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Sleek, Touch-Friendly Login Card */}
      <div className="w-full lg:w-1/2 xl:w-5/12 min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-12 relative overflow-y-auto">
        {/* Top Bar with Language Changer */}
        <div className="flex items-center justify-between lg:justify-end w-full">
          {/* Mobile Top Brand (visible only on < lg screens) */}
          <div className="lg:hidden flex items-center gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
              {t("top_bar.pos") || "POS Terminal"}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageChanger className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm outline-none cursor-pointer hover:border-slate-300 transition" />
          </div>
        </div>

        {/* Central Auth Card */}
        <div className="w-full max-w-[420px] mx-auto my-auto py-6">
          <div className="bg-white dark:bg-[#161B22] rounded-3xl p-7 sm:p-9 shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/70 border border-slate-200/80 dark:border-[#30363D] transition-all">
            {/* Card Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {t("login.title")}
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
                Sign in to manage your restaurant orders, kitchen, and POS.
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email / Username Field */}
              <div>
                <label
                  htmlFor="username"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5"
                >
                  {t("login.email_label")}
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 pointer-events-none">
                    <IconMail size={18} />
                  </div>
                  <input
                    type="email"
                    id="username"
                    name="username"
                    required
                    tabIndex={1}
                    placeholder={t("login.email_placeholder")}
                    className="w-full pl-10 pr-4 py-3 min-h-[44px] text-sm rounded-xl outline-none border border-slate-200 dark:border-[#30363D] bg-slate-50/80 dark:bg-[#0D1117] text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:bg-white dark:focus:bg-[#0D1117] focus:ring-2 focus:ring-[#2CA01C]/30 focus:border-[#2CA01C] transition-all"
                  />
                </div>
              </div>

              {/* Password Field with Eye Toggle */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300"
                  >
                    {t("login.password_label")}
                  </label>
                  <Link
                    tabIndex={5}
                    to="/forgot-password"
                    className="text-xs font-medium text-[#2CA01C] hover:text-[#248417] dark:hover:text-emerald-400 hover:underline transition"
                  >
                    {t("login.forgot_password")}
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 pointer-events-none">
                    <IconLock size={18} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    required
                    tabIndex={2}
                    placeholder={t("login.password_placeholder")}
                    className="w-full pl-10 pr-11 py-3 min-h-[44px] text-sm rounded-xl outline-none border border-slate-200 dark:border-[#30363D] bg-slate-50/80 dark:bg-[#0D1117] text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:bg-white dark:focus:bg-[#0D1117] focus:ring-2 focus:ring-[#2CA01C]/30 focus:border-[#2CA01C] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition flex items-center justify-center cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                tabIndex={3}
                className="w-full mt-2 min-h-[46px] rounded-xl font-semibold text-white bg-[#2CA01C] hover:bg-[#248417] active:scale-95 shadow-md shadow-[#2CA01C]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <span>{t("login.login_button")}</span>
                )}
              </button>

              {/* OR Divider */}
              <div className="flex items-center gap-4 py-1">
                <div className="flex-1 border-b border-slate-200 dark:border-[#30363D]" />
                <span className="text-xs uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-medium">
                  {t("login.or")}
                </span>
                <div className="flex-1 border-b border-slate-200 dark:border-[#30363D]" />
              </div>

              {/* Google Sign-In Button */}
              {googleAuthClient && (
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={isLoading}
                  className="w-full min-h-[44px] rounded-xl font-medium border border-slate-200 dark:border-[#30363D] bg-white dark:bg-[#161B22] text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-[#21262D] active:scale-95 transition-all flex items-center justify-center gap-2.5 shadow-sm"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span className="text-sm">
                    {t("login.continue_with_google")}
                  </span>
                </button>
              )}

              {/* Create Account Link */}
              <Link
                to="/register"
                tabIndex={4}
                className="w-full min-h-[44px] rounded-xl text-sm font-semibold text-slate-700 dark:text-zinc-200 bg-slate-100 hover:bg-slate-200 dark:bg-[#21262D] dark:hover:bg-[#30363D] active:scale-95 transition-all flex items-center justify-center"
              >
                {t("login.create_account")}
              </Link>
            </form>
          </div>
        </div>

        {/* Security / System Footer */}
        <div className="text-center py-2">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-zinc-500">
            <IconShieldCheck size={15} className="text-[#2CA01C]" />
            <span>{t("register.secure_multi_tenant") || "Secure 256-Bit Multi-Tenant Architecture"}</span>
          </div>
        </div>
      </div>

      {/* Manager Override PIN Modal */}
      <ManagerPinModal
        isOpen={showManagerPinModal}
        onClose={() => {
          setShowManagerPinModal(false);
          setPendingCredentials(null);
        }}
        onSuccess={handleManagerOverrideSuccess}
        title={t("shift_roster.shift_restriction_title", "Shift Login Restriction")}
        description={shiftRestrictedMessage || t("shift_roster.shift_restriction_desc", "You are not scheduled for an active shift. Enter Manager PIN to override.")}
      />
    </div>
  );
}
