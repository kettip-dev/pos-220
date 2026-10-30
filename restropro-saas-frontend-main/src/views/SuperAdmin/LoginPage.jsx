import React, { useEffect, useState } from "react";
import Logo from "../../assets/logo.svg";
import LogoDark from "../../assets/LogoDark.svg";
import { toast } from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isRestroUserAuthenticated } from "../../helpers/AuthStatus";
import {
  getUserDetailsInLocalStorage,
  saveUserDetailsInLocalStorage,
} from "../../helpers/UserDetails";
import { signIn } from "../../controllers/superadmin.controller";
import { useTheme } from "../../contexts/ThemeContext";
import LanguageChanger from "../../components/LanguageChanger";
import {
  IconShieldLock,
  IconEye,
  IconEyeOff,
  IconMail,
  IconLock,
  IconSun,
  IconMoon,
  IconArrowLeft,
  IconShieldCheck,
} from "@tabler/icons-react";

export default function SuperAdminLoginPage() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const restroAuthenticated = isRestroUserAuthenticated();
    if (restroAuthenticated) {
      const user = getUserDetailsInLocalStorage();
      if (!user) return;
      const { role } = user;
      if (role === "superadmin") {
        navigate("/superadmin/dashboard/home", {
          replace: true,
        });
        return;
      }
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const username = e.target.username.value;
    const password = e.target.password.value;

    if (!username) {
      e.target.username.focus();
      toast.error(t("superadmin_login.username_error"));
      return;
    }

    if (!password) {
      e.target.password.focus();
      toast.error(t("superadmin_login.password_error"));
      return;
    }

    try {
      setIsLoading(true);
      toast.loading(t("superadmin_login.loading_message"));

      const res = await signIn(username, password);

      if (res.status === 200) {
        toast.dismiss();
        toast.success(t("superadmin_login.success_message"));

        const user = res.data.user;
        saveUserDetailsInLocalStorage(user);

        navigate("/superadmin/dashboard/home", {
          replace: true,
        });
        return;
      } else {
        const message = res.data.message;
        toast.dismiss();
        toast.error(message);
        return;
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message || t("superadmin_login.error_message");

      toast.dismiss();
      toast.error(message);
      return;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white dark:bg-[#0D1117] transition-colors duration-300">
      {/* RIGHT PANEL: Modern Authentication Console */}
      <div className="w-full min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-12 relative overflow-y-auto">
        {/* Top Control Bar: Brand Pill + Language + Theme Switcher */}
        <div className="flex items-center justify-between w-full">
          {/* Mobile Badge / Brand */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
              <IconShieldLock size={14} />
              <span>SuperAdmin</span>
            </span>
          </div>

          {/* Quick Controls: Language & Theme Switch */}
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageChanger className="min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-[#30363D] bg-white dark:bg-[#161B22] text-slate-700 dark:text-zinc-200 outline-none cursor-pointer hover:border-slate-300 dark:hover:border-zinc-600 transition shadow-sm" />

            {toggleTheme && (
              <button
                type="button"
                onClick={toggleTheme}
                className="min-h-[38px] min-w-[38px] p-2 rounded-xl border border-slate-200 dark:border-[#30363D] bg-white dark:bg-[#161B22] text-slate-600 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-95 transition-all shadow-sm flex items-center justify-center cursor-pointer"
                title={theme === "black" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                aria-label="Toggle theme"
              >
                {theme === "black" ? <IconSun size={18} /> : <IconMoon size={18} />}
              </button>
            )}
          </div>
        </div>

        {/* Central Auth Card */}
        <div className="w-full max-w-[420px] mx-auto my-auto py-6">
          <div className="bg-white dark:bg-[#161B22] rounded-3xl p-7 sm:p-9 shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/70 border border-slate-200/80 dark:border-[#30363D] transition-all">
            {/* Card Header & Brand Logo */}
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <img
                  src={theme === "black" ? LogoDark : Logo}
                  alt="Restro PRO Logo"
                  className="h-12 w-auto object-contain"
                />
              </div>

              <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {t("superadmin_login.title")} {t("superadmin_login.login")}
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                {t("superadmin_login.subtitle", "Enter master credentials to access the SaaS management console and global fleet operations.")}
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
                  {t("superadmin_login.email_label")}
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
                    autoComplete="username"
                    placeholder={t("superadmin_login.email_placeholder")}
                    className="w-full pl-10 pr-4 py-3 min-h-[44px] text-sm rounded-xl outline-none border border-slate-200 dark:border-[#30363D] bg-slate-50/80 dark:bg-[#0D1117] text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:bg-white dark:focus:bg-[#0D1117] focus:ring-2 focus:ring-[#2CA01C]/30 focus:border-[#2CA01C] transition-all"
                  />
                </div>
              </div>

              {/* Password Field with Eye Toggle */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5"
                >
                  {t("superadmin_login.password_label")}
                </label>
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
                    autoComplete="current-password"
                    placeholder={t("superadmin_login.password_placeholder")}
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
                  <>
                    <IconShieldLock size={18} />
                    <span>{t("superadmin_login.login_button")}</span>
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4 py-1">
                <div className="flex-1 border-b border-slate-200 dark:border-[#30363D]" />
                <span className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-medium">
                  {t("superadmin_login.portal_badge", "SuperAdmin Console")}
                </span>
                <div className="flex-1 border-b border-slate-200 dark:border-[#30363D]" />
              </div>

              {/* Return to Tenant POS Link */}
              <Link
                to="/login"
                tabIndex={4}
                className="w-full min-h-[44px] rounded-xl text-sm font-semibold text-slate-700 dark:text-zinc-200 bg-slate-100 hover:bg-slate-200 dark:bg-[#21262D] dark:hover:bg-[#30363D] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <IconArrowLeft size={16} />
                <span>{t("superadmin_login.back_to_pos", "Back to Restaurant POS Login")}</span>
              </Link>
            </form>
          </div>
        </div>

        {/* Security & System Footer */}
        <div className="text-center py-2">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-zinc-500">
            <IconShieldCheck size={15} className="text-[#2CA01C]" />
            <span>{t("superadmin_login.security_note", "Restricted Master Access • 256-Bit TLS End-to-End Encrypted")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
