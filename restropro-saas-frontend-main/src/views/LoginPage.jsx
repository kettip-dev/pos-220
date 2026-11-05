import React, { useEffect, useRef, useState } from "react";
import Logo from "../assets/logo.svg";
import { toast } from "react-hot-toast";
import {
  signIn,
  googleSignIn,
} from "../controllers/auth.controller";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { isRestroUserAuthenticated } from "../helpers/AuthStatus";
import {
  getUserDetailsInLocalStorage,
  saveUserDetailsInLocalStorage,
} from "../helpers/UserDetails";
import { parseUser, getHomePathForUser, getSafeNextPath, getDesktopBridge } from "../helpers/SignInHelper";
import { useTranslation } from "react-i18next";
import LanguageChanger from "../components/LanguageChanger";
import ManagerPinModal from "../components/common/ManagerPinModal";
import { signInWithPopup } from "firebase/auth";
import { getGoogleAuthClient } from "../config/firebase";
import ApiClient from "../helpers/ApiClient";
import { validateEmail } from "../utils/emailValidator";
import {
  IconEye,
  IconEyeOff,
  IconMail,
  IconLock,
  IconShieldCheck,
  IconArrowRight,
  IconAlertCircle,
  IconAlertTriangle,
  IconCashRegister,
  IconChefHat,
  IconLayoutDashboard,
  IconX,
  IconExternalLink,
} from "@tabler/icons-react";

// Shared tablets: remember the last email so staff only type their password
const LAST_EMAIL_KEY = "restro_last_login_email";

const readLastEmail = () => {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) || "";
  } catch {
    return "";
  }
};

const writeLastEmail = (email) => {
  try {
    localStorage.setItem(LAST_EMAIL_KEY, email);
  } catch {
    // storage blocked (private mode) — nothing to remember
  }
};

const inputClass = (hasError) =>
  `w-full pl-11 pr-4 min-h-[52px] text-[15px] rounded-xl outline-none border bg-white dark:bg-[#0D1117] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 transition ${
    hasError
      ? "border-rose-400 focus:ring-4 focus:ring-rose-500/15"
      : "border-slate-200 dark:border-[#30363D] focus:border-slate-900 dark:focus:border-zinc-400 focus:ring-4 focus:ring-slate-900/10 dark:focus:ring-white/10"
  }`;

function FieldError({ children }) {
  if (!children) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-600" role="alert">
      <IconAlertCircle size={14} className="shrink-0" />
      {children}
    </p>
  );
}

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  // Inside the Bong POS desktop app, sign-in can happen in the system browser
  // (Google, saved passwords, password managers) like VS Code.
  const desktop = getDesktopBridge();
  const canUseBrowserSignIn = typeof desktop?.signInWithBrowser === "function";
  const [browserSignInStarted, setBrowserSignInStarted] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const [googleAuthClient, setGoogleAuthClient] = useState(null);
  const [email, setEmail] = useState(readLastEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
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
    navigate(getSafeNextPath(location.search) || getHomePathForUser(user), {
      replace: true,
    });
  };

  const handleBrowserSignIn = () => {
    desktop?.signInWithBrowser();
    setBrowserSignInStarted(true);
  };

  useEffect(() => {
    const restroAuthenticated = isRestroUserAuthenticated();
    if (restroAuthenticated) {
      routeAuthenticatedUser();
      return;
    }
    // Returning staff land straight on the password field
    (email ? passwordRef : emailRef).current?.focus();
  }, []);

  const completeSignIn = (resultUser, signedInEmail) => {
    if (signedInEmail) writeLastEmail(signedInEmail);
    saveUserDetailsInLocalStorage(parseUser(resultUser));
    toast.success(t("login.success_message"));
    routeAuthenticatedUser();
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
    if (formError) setFormError("");
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
    if (formError) setFormError("");
  };

  const handlePasswordKey = (e) => {
    if (typeof e.getModifierState === "function") {
      setCapsLockOn(e.getModifierState("CapsLock"));
    }
  };

  const forgetEmail = () => {
    setEmail("");
    writeLastEmail("");
    emailRef.current?.focus();
  };

  const handleGoogleAuth = async () => {
    if (!googleAuthClient || isLoading) return;

    try {
      setIsLoading(true);
      setFormError("");

      const result = await signInWithPopup(
        googleAuthClient.auth,
        googleAuthClient.googleProvider
      );
      const idToken = await result.user.getIdToken();

      const res = await googleSignIn(idToken);

      if (res.status === 200) {
        completeSignIn(res.data.user, result.user.email);
        return;
      }
      setFormError(res.data.message || t("login.error_message"));
    } catch (error) {
      console.error(error);
      if (error?.code === "auth/popup-closed-by-user") return;
      setFormError(
        error?.response?.data?.message ||
        error?.message ||
        t("login.error_message")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    const username = email.trim();
    const next = {};
    if (!username) next.email = t("login.email_required", "Enter your email address");
    else if (!validateEmail(username)) next.email = t("login.email_invalid", "Enter a valid email address");
    if (!password) next.password = t("login.password_required", "Enter your password");
    setErrors(next);
    setFormError("");

    if (next.email) {
      emailRef.current?.focus();
      return;
    }
    if (next.password) {
      passwordRef.current?.focus();
      return;
    }

    try {
      setIsLoading(true);

      const res = await signIn(username, password);

      if (res.status === 200) {
        completeSignIn(res.data.user, username);
        return;
      }
      setFormError(res.data.message || t("login.error_message"));
    } catch (error) {
      console.error(error);
      if (error?.response?.status === 403 && error?.response?.data?.shift_restricted) {
        setPendingCredentials({ username, password });
        setShiftRestrictedMessage(
          error?.response?.data?.message ||
          t("shift_roster.shift_login_restricted", "Login restricted: You are not scheduled for an active shift. Enter Manager PIN to authorize.")
        );
        setShowManagerPinModal(true);
        return;
      }

      setFormError(
        error?.response?.data?.message ||
        (!error?.response
          ? t("login.network_error", "Can't reach the server. Check your internet connection and try again.")
          : t("login.error_message"))
      );
      // Keep the email, clear the password so the retry is one field
      setPassword("");
      passwordRef.current?.focus();
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
        toast.success(t("shift_roster.manager_override_success", "Manager override authorized! Logging in..."));
        writeLastEmail(pendingCredentials.username);
        saveUserDetailsInLocalStorage(parseUser(res.data.user));
        routeAuthenticatedUser();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || t("shift_roster.override_failed", "Manager override failed"));
    } finally {
      setIsLoading(false);
      setPendingCredentials(null);
    }
  };

  const rememberedEmail = readLastEmail();
  const isReturning = !!rememberedEmail && email === rememberedEmail;

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white dark:bg-[#0D1117] transition-colors duration-300">
      {/* LEFT PANEL: brand rail (large tablet & desktop) */}
      <aside className="relative hidden lg:flex lg:w-[38%] xl:w-[34%] flex-col justify-between p-10 xl:p-12 overflow-hidden bg-gradient-to-br from-[#0B0D13] via-[#121622] to-[#080A0E] text-white select-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03] pointer-events-none" />

        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {t("login.rail_label", "Bong POS")}
          </p>
          <h2 className="mt-2 text-2xl xl:text-3xl font-black leading-tight tracking-tight">
            {t("login.rail_title", "Everything your shift needs, in one place")}
          </h2>
          <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
            {t("login.rail_desc", "Sign in once and pick up where the last shift left off.")}
          </p>
        </div>

        <ul className="relative z-10 my-10 space-y-3">
          {[
            { icon: IconCashRegister, key: "login.perk_pos", fb: "Take orders and settle bills", descKey: "login.perk_pos_desc", descFb: "Tables, takeaway and delivery from any tablet." },
            { icon: IconChefHat, key: "login.perk_kds", fb: "Send tickets to the kitchen", descKey: "login.perk_kds_desc", descFb: "Each station sees only its own items, instantly." },
            { icon: IconLayoutDashboard, key: "login.perk_reports", fb: "See today's sales live", descKey: "login.perk_reports_desc", descFb: "Revenue, best sellers and staff at a glance." },
          ].map(({ icon: PerkIcon, key, fb, descKey, descFb }) => (
            <li key={key} className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/10">
              <span className="w-[42px] h-[42px] shrink-0 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center justify-center">
                <PerkIcon size={22} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-white">{t(key, fb)}</span>
                <span className="block mt-0.5 text-sm text-zinc-400 leading-snug">{t(descKey, descFb)}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="relative z-10 pt-6 border-t border-white/10 flex items-center gap-3 text-sm text-zinc-300">
          <IconShieldCheck size={18} className="text-emerald-400 shrink-0" />
          <span>{t("register.perk_secure", "Your data stays private to your business")}</span>
        </div>
      </aside>

      {/* RIGHT PANEL: sign-in form */}
      <main className="flex-1 min-h-screen flex flex-col">
        <header className="w-full px-5 sm:px-8 lg:px-12 pt-5 flex items-center justify-between gap-3">
          <Link to="/" className="shrink-0 hover:opacity-90 transition">
            <img src={Logo} alt="Bong POS" className="h-8 sm:h-9 w-auto dark:invert" />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageChanger className="min-h-[42px] px-3 text-sm font-semibold rounded-full border border-slate-200 dark:border-[#30363D] bg-white dark:bg-[#161B22] text-slate-700 dark:text-zinc-300 outline-none cursor-pointer hover:border-slate-300 transition" />
            <Link
              to="/register"
              className="hidden sm:inline-flex items-center min-h-[42px] px-4 text-sm font-semibold rounded-full text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5 transition"
            >
              {t("login.create_account")}
            </Link>
          </div>
        </header>

        <div className="flex-1 w-full max-w-[440px] mx-auto px-5 sm:px-8 py-8 sm:py-12 flex flex-col justify-center">
          <div className="mb-7">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
              {t("login.welcome_title", "Welcome back")}
            </h1>
            <p className="mt-2 text-sm sm:text-[15px] text-slate-500 dark:text-zinc-400 leading-relaxed">
              {t("login.welcome_subtitle", "Sign in to open your POS, kitchen and dashboard.")}
            </p>
          </div>

          {formError && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 p-3.5 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-sm text-rose-700 dark:text-rose-300"
            >
              <IconAlertCircle size={20} className="shrink-0 mt-px" />
              <span className="flex-1">{formError}</span>
            </div>
          )}

          {canUseBrowserSignIn && (
            <>
              <button
                type="button"
                onClick={handleBrowserSignIn}
                disabled={isLoading}
                className="w-full min-h-[52px] rounded-xl font-bold text-[15px] bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
              >
                <IconExternalLink size={20} />
                <span>{t("login.desktop_browser_signin", "Sign in with your browser")}</span>
              </button>
              <p className="mt-2 text-xs text-center text-slate-500 dark:text-zinc-400 leading-relaxed">
                {browserSignInStarted
                  ? t("login.desktop_browser_waiting", "Finish signing in in your browser. Bong POS opens again by itself.")
                  : t("login.desktop_browser_hint", "Opens your web browser to sign in with Google or email, then returns here.")}
              </p>

              <div className="my-5 flex items-center gap-3">
                <div className="flex-1 border-b border-slate-200 dark:border-[#30363D]" />
                <span className="text-xs font-medium text-slate-400 dark:text-zinc-500">
                  {t("login.desktop_or_here", "or sign in here")}
                </span>
                <div className="flex-1 border-b border-slate-200 dark:border-[#30363D]" />
              </div>
            </>
          )}

          {googleAuthClient && !canUseBrowserSignIn && (
            <>
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full min-h-[52px] rounded-xl font-semibold text-[15px] border border-slate-200 dark:border-[#30363D] bg-white dark:bg-[#161B22] text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95 transition flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>{t("login.continue_with_google")}</span>
              </button>

              <div className="my-5 flex items-center gap-3">
                <div className="flex-1 border-b border-slate-200 dark:border-[#30363D]" />
                <span className="text-xs font-medium text-slate-400 dark:text-zinc-500">
                  {t("login.or_email", "or sign in with email")}
                </span>
                <div className="flex-1 border-b border-slate-200 dark:border-[#30363D]" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="username" className="flex items-center justify-between mb-1.5 text-sm font-semibold text-slate-800 dark:text-zinc-200">
                <span>{t("login.email_label")}</span>
                {isReturning && (
                  <button
                    type="button"
                    onClick={forgetEmail}
                    className="inline-flex items-center gap-1 min-h-[32px] -my-1 px-2 rounded-lg text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
                  >
                    <IconX size={14} />
                    {t("login.not_you", "Not you?")}
                  </button>
                )}
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 pointer-events-none">
                  <IconMail size={20} />
                </div>
                <input
                  ref={emailRef}
                  type="email"
                  id="username"
                  name="username"
                  value={email}
                  onChange={handleEmailChange}
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={!!errors.email}
                  placeholder={t("register.email_placeholder", "you@restaurant.com")}
                  className={inputClass(errors.email)}
                />
              </div>
              <FieldError>{errors.email}</FieldError>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                  {t("login.password_label")}
                </label>
                <Link
                  to="/forgot-password"
                  className="inline-flex items-center min-h-[32px] -my-1 px-2 -mr-2 rounded-lg text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition"
                >
                  {t("login.forgot_password")}
                </Link>
              </div>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 pointer-events-none">
                  <IconLock size={20} />
                </div>
                <input
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={password}
                  onChange={handlePasswordChange}
                  onKeyDown={handlePasswordKey}
                  onKeyUp={handlePasswordKey}
                  onBlur={() => setCapsLockOn(false)}
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  placeholder={t("login.password_hint", "Your password")}
                  className={`${inputClass(errors.password)} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-[42px] h-[42px] rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition flex items-center justify-center cursor-pointer"
                  aria-label={showPassword ? t("register.hide_password", "Hide password") : t("register.show_password", "Show password")}
                >
                  {showPassword ? <IconEyeOff size={20} /> : <IconEye size={20} />}
                </button>
              </div>
              <FieldError>{errors.password}</FieldError>
              {capsLockOn && !errors.password && (
                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <IconAlertTriangle size={14} className="shrink-0" />
                  {t("login.caps_lock_on", "Caps Lock is on")}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[52px] px-6 rounded-xl font-bold text-[15px] text-white bg-slate-900 hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-zinc-200 active:scale-95 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  <span>{t("login.signing_in", "Signing in…")}</span>
                </>
              ) : (
                <>
                  <span>{t("login.login_button")}</span>
                  <IconArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500 dark:text-zinc-400">
            {t("login.new_here", "New to Bong POS?")}{" "}
            <Link to="/register" className="font-semibold text-slate-900 dark:text-white underline-offset-4 hover:underline">
              {t("login.create_account")}
            </Link>
          </p>
        </div>

        <footer className="w-full py-5 text-center text-xs text-slate-400 dark:text-zinc-600">
          © {new Date().getFullYear()} Bong POS
        </footer>
      </main>

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
