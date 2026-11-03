import React, { useEffect, useRef, useState } from "react";
import Logo from "../assets/logo.svg";
import { toast } from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { signUp, signIn, googleSignIn } from "../controllers/auth.controller";
import { validateEmail } from "../utils/emailValidator";
import { useTranslation } from "react-i18next";
import LanguageChanger from "../components/LanguageChanger";
import { signInWithPopup } from "firebase/auth";
import { getGoogleAuthClient } from "../config/firebase";
import { saveUserDetailsInLocalStorage } from "../helpers/UserDetails";
import ApiClient from "../helpers/ApiClient";
import {
  IconBuildingStore,
  IconEye,
  IconEyeOff,
  IconMail,
  IconLock,
  IconShieldCheck,
  IconUser,
  IconPhone,
  IconMapPin,
  IconArrowRight,
  IconArrowLeft,
  IconCheck,
  IconToolsKitchen2,
  IconCoffee,
  IconGlassFull,
  IconBurger,
  IconTruck,
  IconPizza,
  IconBed,
  IconBuilding,
  IconLayoutDashboard,
  IconDeviceTablet,
  IconChefHat,
  IconArmchair,
  IconCashRegister,
  IconArrowsShuffle,
  IconAlertCircle,
} from "@tabler/icons-react";

// Flow: 1 Business -> 2 How you serve -> 3 Owner account -> 4 Done
const STEPS = [
  { id: 1, titleKey: "register.nav_business", fallback: "Your business" },
  { id: 2, titleKey: "register.nav_service", fallback: "How you serve" },
  { id: 3, titleKey: "register.nav_account", fallback: "Your account" },
];
const DONE_STEP = 4;

const CATEGORIES = [
  { id: "restaurant", icon: IconToolsKitchen2, labelKey: "register.business_type_restaurant", fallback: "Restaurant" },
  { id: "cafe", icon: IconCoffee, labelKey: "register.business_type_cafe", fallback: "Cafe & Bakery" },
  { id: "bar", icon: IconGlassFull, labelKey: "register.business_type_bar", fallback: "Bar & Lounge" },
  { id: "fast_food", icon: IconBurger, labelKey: "register.business_type_fast_food", fallback: "Fast Food" },
  { id: "food_truck", icon: IconTruck, labelKey: "register.business_type_food_truck", fallback: "Food Truck & Kiosk" },
  { id: "pizzeria", icon: IconPizza, labelKey: "register.pizzeria", fallback: "Pizzeria & Bistro" },
  { id: "hotel", icon: IconBed, labelKey: "register.hotel", fallback: "Hotel Dining" },
  { id: "other", icon: IconBuilding, labelKey: "register.business_type_other", fallback: "Other" },
];

const SERVICE_MODES = [
  {
    id: "postpaid",
    icon: IconArmchair,
    titleKey: "register.mode_postpaid_title",
    fallback: "Table service",
    descKey: "register.mode_postpaid_desc",
    descFallback: "Guests order at the table and pay at the end.",
  },
  {
    id: "prepaid",
    icon: IconCashRegister,
    titleKey: "register.mode_prepaid_title",
    fallback: "Counter service",
    descKey: "register.mode_prepaid_desc",
    descFallback: "Guests order and pay first, then food is served.",
  },
  {
    id: "flexible",
    icon: IconArrowsShuffle,
    titleKey: "register.mode_flexible_title",
    fallback: "Both",
    descKey: "register.mode_flexible_desc",
    descFallback: "Mix table and counter orders. Change it any time.",
  },
];

const CURRENCIES = [
  { code: "USD", symbol: "$", labelKey: "register.currency_usd", fallback: "US Dollar" },
  { code: "KHR", symbol: "៛", labelKey: "register.currency_khr", fallback: "Khmer Riel" },
];

const getPasswordStrength = (password) => {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.max(score, 1);
};

const STRENGTH_LEVELS = [
  null,
  { key: "register.strength_weak", fallback: "Weak", bar: "bg-rose-500", text: "text-rose-600" },
  { key: "register.strength_fair", fallback: "Fair", bar: "bg-amber-500", text: "text-amber-600" },
  { key: "register.strength_good", fallback: "Good", bar: "bg-emerald-500", text: "text-emerald-600" },
  { key: "register.strength_strong", fallback: "Strong", bar: "bg-emerald-600", text: "text-emerald-700" },
];

const parseUser = (resultUser) => ({
  ...resultUser,
  planFeautures: resultUser.features ? JSON.parse(resultUser.features) : null,
  features_description: resultUser.features_description
    ? JSON.parse(resultUser.features_description)
    : null,
});

const inputClass = (hasError) =>
  `w-full pl-11 pr-4 min-h-[48px] text-[15px] rounded-xl outline-none border bg-white dark:bg-[#0D1117] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 transition ${
    hasError
      ? "border-rose-400 focus:ring-4 focus:ring-rose-500/15"
      : "border-slate-200 dark:border-[#30363D] focus:border-slate-900 dark:focus:border-zinc-400 focus:ring-4 focus:ring-slate-900/10 dark:focus:ring-white/10"
  }`;

function Field({ id, label, optional, error, icon: Icon, optionalLabel, children }) {
  return (
    <div>
      <label htmlFor={id} className="flex items-center justify-between mb-1.5 text-sm font-semibold text-slate-800 dark:text-zinc-200">
        <span>{label}</span>
        {optional && <span className="text-xs font-medium text-slate-400 dark:text-zinc-500">{optionalLabel}</span>}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 pointer-events-none">
            <Icon size={20} />
          </div>
        )}
        {children}
      </div>
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-600" role="alert">
          <IconAlertCircle size={14} className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export default function RegistrationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const headingRef = useRef(null);

  const [googleAuthClient, setGoogleAuthClient] = useState(null);
  const [activeStep, setActiveStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    biz_name: "",
    business_type: "restaurant",
    currency: "USD",
    pos_payment_mode: "flexible",
    phone: "",
    address: "",
    owner_name: "",
    username: "",
    password: "",
  });

  useEffect(() => {
    let isMounted = true;

    const loadGoogleAuth = async () => {
      try {
        const { data } = await ApiClient.get("/auth/google-config");
        if (data.enabled && isMounted) {
          setGoogleAuthClient(getGoogleAuthClient(data.firebaseConfig));
        }
      } catch (error) {
        console.error("Unable to load Google Sign-In configuration", error);
      }
    };

    loadGoogleAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  // Move focus to the step heading so keyboard / screen-reader users follow the flow
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeStep]);

  const setField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleChange = (e) => setField(e.target.name, e.target.value);

  const goToStep = (step) => {
    setErrors({});
    setActiveStep(step);
  };

  const selectedCategory = CATEGORIES.find((c) => c.id === formData.business_type) || CATEGORIES[0];
  const selectedMode = SERVICE_MODES.find((m) => m.id === formData.pos_payment_mode) || SERVICE_MODES[2];
  const selectedCurrency = CURRENCIES.find((c) => c.code === formData.currency) || CURRENCIES[0];

  const validateBusiness = () => {
    if (!formData.biz_name.trim()) {
      setErrors({ biz_name: t("register.business_name_error", "Please enter your business name") });
      return false;
    }
    return true;
  };

  const validateAccount = () => {
    const next = {};
    const email = formData.username.trim();
    if (!email) next.username = t("register.email_error", "Please enter your email address");
    else if (!validateEmail(email)) next.username = t("register.valid_email_error", "Please enter a valid email address");
    if (!formData.password) next.password = t("register.password_error", "Please enter a password");
    else if (formData.password.length < 6) next.password = t("register.password_too_short", "Password must be at least 6 characters");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (activeStep === 1 && !validateBusiness()) return;
    goToStep(activeStep + 1);
  };

  const handleBack = () => {
    if (activeStep > 1) goToStep(activeStep - 1);
  };

  const businessPayload = () => ({
    business_type: formData.business_type,
    currency: formData.currency,
    pos_payment_mode: formData.pos_payment_mode,
    phone: formData.phone.trim(),
    address: formData.address.trim(),
  });

  const handleGoogleAuth = async () => {
    if (!googleAuthClient || isLoading) return;
    if (!validateBusiness()) {
      goToStep(1);
      return;
    }

    try {
      setIsLoading(true);
      const result = await signInWithPopup(googleAuthClient.auth, googleAuthClient.googleProvider);
      const idToken = await result.user.getIdToken();
      const biz = businessPayload();

      const res = await googleSignIn(idToken, formData.biz_name.trim(), {
        businessType: biz.business_type,
        currency: biz.currency,
        posPaymentMode: biz.pos_payment_mode,
        phone: biz.phone,
        address: biz.address,
      });

      if (res.status === 200) {
        saveUserDetailsInLocalStorage(parseUser(res.data.user));
        setIsAuthenticated(true);
        setActiveStep(DONE_STEP);
      } else {
        toast.error(res.data.message || t("register.error_message", "Something went wrong. Please try again."));
      }
    } catch (error) {
      console.error(error);
      if (error?.code === "auth/popup-closed-by-user") return;
      toast.error(
        error?.response?.data?.message || error?.message || t("register.error_message", "Something went wrong. Please try again.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    if (!validateBusiness()) {
      goToStep(1);
      return;
    }
    if (!validateAccount()) return;

    const email = formData.username.trim();
    const password = formData.password;

    try {
      setIsLoading(true);

      const res = await signUp(formData.biz_name.trim(), email, password, {
        ...businessPayload(),
        owner_name: formData.owner_name.trim(),
      });

      if (res.status !== 200) {
        toast.error(res.data.message || t("register.error_message", "Something went wrong. Please try again."));
        return;
      }

      // Sign the new owner straight in so the next screen can open the workspace
      try {
        const loginRes = await signIn(email, password);
        if (loginRes.status === 200) {
          saveUserDetailsInLocalStorage(parseUser(loginRes.data.user));
          setIsAuthenticated(true);
        }
      } catch (loginErr) {
        console.warn("Auto sign-in failed, owner will sign in manually:", loginErr);
      }

      setActiveStep(DONE_STEP);
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message || t("register.error_message", "Something went wrong. Please try again.");
      // Most likely "account already exists" — surface it on the email field
      if (error?.response?.status === 400) setErrors({ username: message });
      else toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const openWorkspace = (path) => navigate(isAuthenticated ? path : "/login", { replace: true });

  const stepSummary = (stepId) => {
    if (stepId === 1 && formData.biz_name.trim()) {
      return `${formData.biz_name.trim()} · ${t(selectedCategory.labelKey, selectedCategory.fallback)}`;
    }
    if (stepId === 2 && activeStep > 2) {
      return `${t(selectedMode.titleKey, selectedMode.fallback)} · ${selectedCurrency.code}`;
    }
    if (stepId === 3 && activeStep === DONE_STEP) return formData.username.trim() || null;
    return null;
  };

  const strength = getPasswordStrength(formData.password);
  const strengthLevel = STRENGTH_LEVELS[strength];
  const isDone = activeStep === DONE_STEP;

  const HEADINGS = {
    1: {
      title: t("register.step1_title", "Let's set up your business"),
      subtitle: t("register.step1_subtitle", "Tell us your name and what kind of place you run."),
    },
    2: {
      title: t("register.step2_title", "How do you serve guests?"),
      subtitle: t("register.step2_subtitle", "We'll set up your POS to match. You can change this later in Settings."),
    },
    3: {
      title: t("register.step3_title", "Create your owner account"),
      subtitle: t("register.step3_subtitle", "You'll use this to sign in and manage your team."),
    },
  };

  const primaryButton =
    "flex-1 min-h-[52px] px-6 rounded-xl font-bold text-[15px] text-white bg-slate-900 hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-zinc-200 active:scale-95 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed";
  const backButton =
    "min-h-[52px] min-w-[52px] px-4 rounded-xl font-semibold text-sm text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-[#30363D] bg-white dark:bg-transparent hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer";

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white dark:bg-[#0D1117] transition-colors duration-300">
      {/* LEFT PANEL: progress rail (large tablet & desktop) */}
      <aside className="relative hidden lg:flex lg:w-[38%] xl:w-[34%] flex-col justify-between p-10 xl:p-12 overflow-hidden bg-gradient-to-br from-[#0B0D13] via-[#121622] to-[#080A0E] text-white select-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03] pointer-events-none" />

        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {t("register.rail_label", "Create your workspace")}
          </p>
          <h2 className="mt-2 text-2xl xl:text-3xl font-black leading-tight tracking-tight">
            {t("register.rail_title", "Ready to take orders in about 2 minutes")}
          </h2>
        </div>

        {/* Vertical stepper */}
        <ol className="relative z-10 my-10 space-y-1">
          {STEPS.map((step, idx) => {
            const isComplete = activeStep > step.id;
            const isCurrent = activeStep === step.id;
            const canJump = isComplete && !isDone;
            const summary = stepSummary(step.id);
            return (
              <li key={step.id} className="relative">
                {idx < STEPS.length - 1 && (
                  <span
                    className={`absolute left-[21px] top-[50px] bottom-[-6px] w-0.5 rounded-full ${
                      isComplete ? "bg-emerald-500/60" : "bg-white/10"
                    }`}
                  />
                )}
                <button
                  type="button"
                  disabled={!canJump}
                  onClick={() => goToStep(step.id)}
                  className={`w-full flex items-start gap-4 p-1 rounded-2xl text-left transition ${
                    canJump ? "hover:bg-white/5 cursor-pointer" : "cursor-default"
                  }`}
                >
                  <span
                    className={`w-[42px] h-[42px] shrink-0 rounded-full flex items-center justify-center text-sm font-bold border transition ${
                      isComplete
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : isCurrent
                        ? "bg-white border-white text-slate-900"
                        : "bg-transparent border-white/20 text-zinc-400"
                    }`}
                  >
                    {isComplete ? <IconCheck size={20} className="stroke-[3]" /> : step.id}
                  </span>
                  <span className="pt-2 pb-6 min-w-0">
                    <span className={`block text-[15px] font-semibold ${isCurrent || isComplete ? "text-white" : "text-zinc-400"}`}>
                      {t(step.titleKey, step.fallback)}
                    </span>
                    {summary && <span className="block mt-0.5 text-sm text-zinc-400 truncate">{summary}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <ul className="relative z-10 space-y-3 pt-6 border-t border-white/10 text-sm text-zinc-300">
          {[
            { icon: IconDeviceTablet, key: "register.perk_devices", fb: "Works on any tablet, phone or PC" },
            { icon: IconChefHat, key: "register.perk_kds", fb: "Kitchen display included" },
            { icon: IconShieldCheck, key: "register.perk_secure", fb: "Your data stays private to your business" },
          ].map(({ icon: PerkIcon, key, fb }) => (
            <li key={key} className="flex items-center gap-3">
              <PerkIcon size={18} className="text-emerald-400 shrink-0" />
              <span>{t(key, fb)}</span>
            </li>
          ))}
        </ul>
      </aside>

      {/* RIGHT PANEL: active step */}
      <main className="flex-1 min-h-screen flex flex-col">
        <header className="w-full px-5 sm:px-8 lg:px-12 pt-5 flex items-center justify-between gap-3">
          <Link to="/" className="shrink-0 hover:opacity-90 transition">
            <img src={Logo} alt="Restro PRO" className="h-8 sm:h-9 w-auto dark:invert" />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageChanger className="min-h-[42px] px-3 text-sm font-semibold rounded-full border border-slate-200 dark:border-[#30363D] bg-white dark:bg-[#161B22] text-slate-700 dark:text-zinc-300 outline-none cursor-pointer hover:border-slate-300 transition" />
            {!isDone && (
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center min-h-[42px] px-4 text-sm font-semibold rounded-full text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5 transition"
              >
                {t("register.signin_link", "Sign in")}
              </Link>
            )}
          </div>
        </header>

        <div className="flex-1 w-full max-w-[560px] mx-auto px-5 sm:px-8 py-8 sm:py-12 flex flex-col justify-center">
          {/* Compact progress for phones / portrait tablets */}
          {!isDone && (
            <div className="lg:hidden mb-6">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2">
                <span>{t("register.step_of", { current: activeStep, total: STEPS.length, defaultValue: `Step ${activeStep} of ${STEPS.length}` })}</span>
                <span className="text-slate-700 dark:text-zinc-300">{t(STEPS[activeStep - 1].titleKey, STEPS[activeStep - 1].fallback)}</span>
              </div>
              <div className="flex gap-1.5">
                {STEPS.map((s) => (
                  <span
                    key={s.id}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      activeStep > s.id ? "bg-emerald-500" : activeStep === s.id ? "bg-slate-900 dark:bg-white" : "bg-slate-200 dark:bg-zinc-800"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {!isDone && (
            <div className="mb-7">
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-snug outline-none"
              >
                {HEADINGS[activeStep].title}
              </h1>
              <p className="mt-2 text-sm sm:text-[15px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                {HEADINGS[activeStep].subtitle}
              </p>
            </div>
          )}

          {/* STEP 1: BUSINESS NAME & TYPE */}
          {activeStep === 1 && (
            <form onSubmit={handleNext} noValidate className="space-y-6">
              <Field id="biz_name" label={t("register.business_name_label", "Business name")} icon={IconBuildingStore} error={errors.biz_name}>
                <input
                  type="text"
                  id="biz_name"
                  name="biz_name"
                  value={formData.biz_name}
                  onChange={handleChange}
                  autoFocus
                  autoComplete="organization"
                  aria-invalid={!!errors.biz_name}
                  placeholder={t("register.business_name_placeholder", "e.g. The Golden Spoon")}
                  className={inputClass(errors.biz_name)}
                />
              </Field>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-slate-800 dark:text-zinc-200">
                  {t("register.business_type_label", "Type of business")}
                </legend>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {CATEGORIES.map((cat) => {
                    const isSelected = formData.business_type === cat.id;
                    const CatIcon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setField("business_type", cat.id)}
                        className={`relative min-h-[88px] p-3 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition active:scale-95 cursor-pointer ${
                          isSelected
                            ? "border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                            : "border-slate-200 dark:border-[#30363D] bg-white dark:bg-[#161B22] text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-600"
                        }`}
                      >
                        <CatIcon size={24} className={isSelected ? "" : "text-slate-500 dark:text-zinc-400"} />
                        <span className="text-xs sm:text-[13px] font-semibold leading-tight">{t(cat.labelKey, cat.fallback)}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <button type="submit" className={`${primaryButton} w-full`}>
                <span>{t("register.continue_button", "Continue")}</span>
                <IconArrowRight size={18} />
              </button>
            </form>
          )}

          {/* STEP 2: SERVICE MODE, CURRENCY, CONTACT */}
          {activeStep === 2 && (
            <form onSubmit={handleNext} noValidate className="space-y-6">
              <fieldset>
                <legend className="sr-only">{t("register.billing_mode_label", "Service style")}</legend>
                <div className="space-y-2.5">
                  {SERVICE_MODES.map((mode) => {
                    const isSelected = formData.pos_payment_mode === mode.id;
                    const ModeIcon = mode.icon;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setField("pos_payment_mode", mode.id)}
                        className={`w-full min-h-[72px] p-4 rounded-2xl border-2 text-left flex items-center gap-4 transition active:scale-[0.98] cursor-pointer ${
                          isSelected
                            ? "border-slate-900 dark:border-white bg-slate-50 dark:bg-white/5"
                            : "border-slate-200 dark:border-[#30363D] bg-white dark:bg-[#161B22] hover:border-slate-300 dark:hover:border-zinc-600"
                        }`}
                      >
                        <span
                          className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${
                            isSelected ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                          }`}
                        >
                          <ModeIcon size={22} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] font-bold text-slate-900 dark:text-white">{t(mode.titleKey, mode.fallback)}</span>
                          <span className="block mt-0.5 text-[13px] text-slate-500 dark:text-zinc-400 leading-snug">{t(mode.descKey, mode.descFallback)}</span>
                        </span>
                        <span
                          className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? "border-slate-900 dark:border-white bg-slate-900 dark:bg-white" : "border-slate-300 dark:border-zinc-600"
                          }`}
                        >
                          {isSelected && <IconCheck size={14} className="stroke-[3] text-white dark:text-slate-900" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-slate-800 dark:text-zinc-200">
                  {t("register.currency_label", "Main currency")}
                </legend>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-[#161B22] border border-slate-200 dark:border-[#30363D]">
                  {CURRENCIES.map((c) => {
                    const isSelected = formData.currency === c.code;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setField("currency", c.code)}
                        className={`min-h-[48px] px-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer ${
                          isSelected
                            ? "bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm"
                            : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
                        }`}
                      >
                        <span className="text-base font-bold">{c.symbol}</span>
                        <span>{c.code}</span>
                        <span className="hidden sm:inline font-normal opacity-70">· {t(c.labelKey, c.fallback)}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
                  {t("register.currency_hint", "You can accept a second currency at checkout later.")}
                </p>
              </fieldset>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  id="phone"
                  label={t("register.phone_label", "Business phone")}
                  optional
                  optionalLabel={t("register.optional", "Optional")}
                  icon={IconPhone}
                >
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    autoComplete="tel"
                    placeholder={t("register.phone_placeholder", "+855 12 345 678")}
                    className={inputClass(false)}
                  />
                </Field>
                <Field
                  id="address"
                  label={t("register.address_label", "City")}
                  optional
                  optionalLabel={t("register.optional", "Optional")}
                  icon={IconMapPin}
                >
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    autoComplete="address-level2"
                    placeholder={t("register.address_placeholder", "e.g. Phnom Penh")}
                    className={inputClass(false)}
                  />
                </Field>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={handleBack} className={backButton} aria-label={t("register.back", "Back")}>
                  <IconArrowLeft size={18} />
                  <span className="hidden sm:inline">{t("register.back", "Back")}</span>
                </button>
                <button type="submit" className={primaryButton}>
                  <span>{t("register.continue_button", "Continue")}</span>
                  <IconArrowRight size={18} />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: OWNER ACCOUNT */}
          {activeStep === 3 && (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {googleAuthClient && (
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
                    <span>{t("register.continue_with_google", "Continue with Google")}</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 border-b border-slate-200 dark:border-[#30363D]" />
                    <span className="text-xs font-medium text-slate-400 dark:text-zinc-500">
                      {t("register.or_email", "or use your email")}
                    </span>
                    <div className="flex-1 border-b border-slate-200 dark:border-[#30363D]" />
                  </div>
                </>
              )}

              <Field
                id="owner_name"
                label={t("register.owner_name_label", "Your name")}
                optional
                optionalLabel={t("register.optional", "Optional")}
                icon={IconUser}
              >
                <input
                  type="text"
                  id="owner_name"
                  name="owner_name"
                  value={formData.owner_name}
                  onChange={handleChange}
                  autoComplete="name"
                  placeholder={t("register.owner_name_placeholder", "e.g. Sokha Chan")}
                  className={inputClass(false)}
                />
              </Field>

              <Field id="username" label={t("register.email_label", "Email")} icon={IconMail} error={errors.username}>
                <input
                  type="email"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  autoComplete="email"
                  inputMode="email"
                  aria-invalid={!!errors.username}
                  placeholder={t("register.email_placeholder", "you@restaurant.com")}
                  className={inputClass(errors.username)}
                />
              </Field>

              <div>
                <Field id="password" label={t("register.password_label", "Password")} icon={IconLock} error={errors.password}>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                    aria-invalid={!!errors.password}
                    placeholder={t("register.password_placeholder", "At least 6 characters")}
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
                </Field>
                {formData.password && !errors.password && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? strengthLevel.bar : "bg-slate-200 dark:bg-zinc-800"}`}
                        />
                      ))}
                    </div>
                    <span className={`text-xs font-semibold ${strengthLevel.text}`}>{t(strengthLevel.key, strengthLevel.fallback)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={handleBack} disabled={isLoading} className={backButton} aria-label={t("register.back", "Back")}>
                  <IconArrowLeft size={18} />
                  <span className="hidden sm:inline">{t("register.back", "Back")}</span>
                </button>
                <button type="submit" disabled={isLoading} className={primaryButton}>
                  {isLoading ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      <span>{t("register.creating", "Creating your workspace…")}</span>
                    </>
                  ) : (
                    <span>{t("register.create_account", "Create account")}</span>
                  )}
                </button>
              </div>

              <p className="text-xs text-center text-slate-500 dark:text-zinc-500 leading-relaxed">
                {t("register.terms_note", "By creating an account you agree to our Terms of Service and Privacy Policy.")}
              </p>
            </form>
          )}

          {/* DONE */}
          {isDone && (
            <div className="text-center">
              <div className="relative mx-auto w-16 h-16 mb-6">
                <div className="absolute inset-0 rounded-full bg-emerald-400/25 animate-ping" />
                <div className="relative w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <IconCheck size={34} className="stroke-[3]" />
                </div>
              </div>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-snug outline-none"
              >
                {t("register.done_title", { name: formData.biz_name.trim(), defaultValue: `${formData.biz_name.trim()} is ready` })}
              </h1>
              <p className="mt-2 text-sm sm:text-[15px] text-slate-500 dark:text-zinc-400">
                {isAuthenticated
                  ? t("register.done_subtitle", "Your workspace is set up. Add your menu and start taking orders.")
                  : t("register.done_subtitle_signin", "Your account is created. Sign in to open your workspace.")}
              </p>

              <dl className="mt-7 text-left rounded-2xl border border-slate-200 dark:border-[#30363D] bg-slate-50 dark:bg-[#161B22] divide-y divide-slate-200 dark:divide-[#30363D]">
                {[
                  { label: t("register.summary_type", "Business type"), value: t(selectedCategory.labelKey, selectedCategory.fallback) },
                  { label: t("register.summary_service", "Service style"), value: t(selectedMode.titleKey, selectedMode.fallback) },
                  { label: t("register.summary_currency", "Currency"), value: `${selectedCurrency.code} (${selectedCurrency.symbol})` },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                    <dt className="text-slate-500 dark:text-zinc-400">{row.label}</dt>
                    <dd className="font-semibold text-slate-900 dark:text-white text-right">{row.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-7 space-y-2.5">
                <button type="button" onClick={() => openWorkspace("/dashboard/home")} className={`${primaryButton} w-full`}>
                  {isAuthenticated ? (
                    <>
                      <IconLayoutDashboard size={18} />
                      <span>{t("register.launch_dashboard", "Go to dashboard")}</span>
                    </>
                  ) : (
                    <span>{t("register.signin_link", "Sign in")}</span>
                  )}
                  <IconArrowRight size={18} />
                </button>
                {isAuthenticated && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <button type="button" onClick={() => openWorkspace("/dashboard/pos")} className={`${backButton} w-full`}>
                      <IconCashRegister size={18} />
                      <span>{t("register.open_pos", "Open POS")}</span>
                    </button>
                    <button type="button" onClick={() => openWorkspace("/dashboard/kitchen")} className={`${backButton} w-full`}>
                      <IconChefHat size={18} />
                      <span>{t("register.open_kds", "Open kitchen")}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeStep === 1 && (
            <p className="mt-8 text-center text-sm text-slate-500 dark:text-zinc-400">
              {t("register.have_account", "Already have an account?")}{" "}
              <Link to="/login" className="font-semibold text-slate-900 dark:text-white underline-offset-4 hover:underline">
                {t("register.signin_link", "Sign in")}
              </Link>
            </p>
          )}
        </div>

        <footer className="w-full py-5 text-center text-xs text-slate-400 dark:text-zinc-600">
          © {new Date().getFullYear()} Restro PRO
        </footer>
      </main>
    </div>
  );
}
