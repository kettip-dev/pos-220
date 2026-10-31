import React, { useEffect, useState } from "react";
import Logo from "../assets/logo.svg";
import { toast } from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { SCOPES } from "../config/scopes";
import { signUp, signIn, googleSignIn } from "../controllers/auth.controller";
import { validateEmail } from "../utils/emailValidator";
import { useTranslation } from "react-i18next";
import LanguageChanger from "../components/LanguageChanger";
import { signInWithPopup } from "firebase/auth";
import { getGoogleAuthClient } from "../config/firebase";
import {
  saveUserDetailsInLocalStorage,
  getUserDetailsInLocalStorage,
} from "../helpers/UserDetails";
import ApiClient from "../helpers/ApiClient";
import {
  IconBuildingStore,
  IconEye,
  IconEyeOff,
  IconMail,
  IconLock,
  IconSparkles,
  IconShieldCheck,
  IconBolt,
  IconUser,
  IconPhone,
  IconMapPin,
  IconArrowRight,
  IconArrowLeft,
  IconCheck,
  IconPlus,
  IconToolsKitchen2,
  IconCoffee,
  IconGlassFull,
  IconBurger,
  IconTruck,
  IconPizza,
  IconBed,
  IconBuilding,
  IconLayoutDashboard,
} from "@tabler/icons-react";

export default function RegistrationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [googleAuthClient, setGoogleAuthClient] = useState(null);
  const [activeStep, setActiveStep] = useState(1); // 1: Goals, 2: Category, 3: Venue Info, 4: Credentials, 5: Completed
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Step 1: Selected Goals / Needs (multi-select like reference screenshot)
  const [selectedGoals, setSelectedGoals] = useState([
    "dine_in",
    "counter",
    "kds",
  ]);

  // Step 2: Selected Category
  const [selectedCategory, setSelectedCategory] = useState("restaurant");

  // Step 3 & 4: Business Details & Credentials
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
    confirm_password: "",
  });

  const GOALS = [
    { id: "dine_in", labelKey: "register.help_dine_in", fallback: "Sell in-store (Table POS)" },
    { id: "counter", labelKey: "register.help_counter", fallback: "Quick counter checkout" },
    { id: "kds", labelKey: "register.help_kds", fallback: "Kitchen display (KDS)" },
    { id: "qr_menu", labelKey: "register.help_qr", fallback: "QR code table ordering" },
    { id: "takeaway", labelKey: "register.help_takeaway", fallback: "Takeaway & pickup" },
    { id: "thermal_print", labelKey: "register.help_printing", fallback: "Thermal receipt & KOT printing" },
    { id: "multi_currency", labelKey: "register.help_multi_currency", fallback: "Dual-currency (USD & KHR)" },
    { id: "move_pos", labelKey: "register.help_move_pos", fallback: "Move existing store" },
  ];

  const CATEGORIES = [
    { id: "restaurant", icon: IconToolsKitchen2, labelKey: "register.business_type_restaurant", fallback: "Dine-In Restaurant" },
    { id: "cafe", icon: IconCoffee, labelKey: "register.business_type_cafe", fallback: "Cafe & Bakery" },
    { id: "bar", icon: IconGlassFull, labelKey: "register.business_type_bar", fallback: "Bar, Pub & Lounge" },
    { id: "fast_food", icon: IconBurger, labelKey: "register.business_type_fast_food", fallback: "Quick Service / Fast Food" },
    { id: "food_truck", icon: IconTruck, labelKey: "register.business_type_food_truck", fallback: "Food Truck & Kiosk" },
    { id: "pizzeria", icon: IconPizza, labelKey: "register.pizzeria", fallback: "Pizzeria & Bistro" },
    { id: "hotel", icon: IconBed, labelKey: "register.hotel", fallback: "Hotel & Resort Dining" },
    { id: "other", icon: IconBuilding, labelKey: "register.business_type_other", fallback: "Other Hospitality" },
  ];

  const CURRENCIES = [
    { code: "USD", symbol: "$", label: "USD ($)" },
    { code: "KHR", symbol: "៛", label: "KHR (៛)" },
  ];

  const BILLING_MODES = [
    {
      id: "flexible",
      titleKey: "register.billing_mode_flexible",
      fallback: "Flexible (Table & Counter)",
    },
    {
      id: "postpaid",
      titleKey: "register.billing_mode_postpaid",
      fallback: "Dine-In (Pay Later)",
    },
    {
      id: "prepaid",
      titleKey: "register.billing_mode_prepaid",
      fallback: "Counter (Pay Upfront)",
    },
  ];

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleGoal = (goalId) => {
    setSelectedGoals((prev) =>
      prev.includes(goalId) ? prev.filter((id) => id !== goalId) : [...prev, goalId]
    );
  };

  const handleStep1Continue = (e) => {
    e.preventDefault();
    setActiveStep(2);
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    setFormData((prev) => ({ ...prev, business_type: categoryId }));
  };

  const handleStep2Continue = (e) => {
    e.preventDefault();
    setActiveStep(3);
  };

  const handleStep3Continue = (e) => {
    e.preventDefault();
    if (!formData.biz_name.trim()) {
      toast.error(t("register.business_name_error") || "Please enter your business name");
      return;
    }
    setActiveStep(4);
  };

  const handleBack = () => {
    if (activeStep > 1) {
      setActiveStep((prev) => prev - 1);
    } else {
      navigate(-1);
    }
  };

  const routeUserAfterAuth = (user) => {
    saveUserDetailsInLocalStorage(user);
    const { role, scope } = getUserDetailsInLocalStorage();
    if (role === "admin" || role === "group_owner") {
      navigate("/dashboard/home", { replace: true });
      return;
    }
    const userScopes = scope?.split(",") || [];
    if (userScopes.includes(SCOPES.DASHBOARD)) {
      navigate("/dashboard/home", { replace: true });
    } else {
      navigate("/dashboard/profile", { replace: true });
    }
  };

  const handleGoogleAuth = async () => {
    if (!googleAuthClient) return;

    const bizName = formData.biz_name.trim() || "My Restaurant";

    try {
      setIsLoading(true);
      toast.loading(t("register.loading_message") || "Setting up your workspace...");
      const result = await signInWithPopup(
        googleAuthClient.auth,
        googleAuthClient.googleProvider
      );
      const idToken = await result.user.getIdToken();

      const res = await googleSignIn(
        idToken,
        bizName,
        formData.business_type || selectedCategory,
        formData.currency,
        formData.pos_payment_mode
      );

      if (res.status === 200) {
        toast.dismiss();
        toast.success(
          res.data.message || t("register.success_message") || "Account created successfully!"
        );

        const resultUser = res.data.user;
        const user = {
          ...resultUser,
          planFeautures: resultUser.features ? JSON.parse(resultUser.features) : null,
          features_description: resultUser.features_description
            ? JSON.parse(resultUser.features_description)
            : null,
        };

        setIsAuthenticated(true);
        setActiveStep(5);
      } else {
        toast.dismiss();
        toast.error(res.data.message || "Failed to create account.");
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        t("register.error_message") ||
        "An error occurred during Google Sign-In.";
      toast.dismiss();
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const bizName = formData.biz_name.trim();
    const email = formData.username.trim();
    const password = formData.password;
    const confirmPassword = formData.confirm_password;

    if (!bizName) {
      toast.error(t("register.business_name_error") || "Please enter your business name!");
      setActiveStep(3);
      return;
    }

    if (!email) {
      toast.error(t("register.email_error") || "Please enter your email address!");
      return;
    }

    if (!validateEmail(email)) {
      toast.error(t("register.valid_email_error") || "Please enter a valid email address!");
      return;
    }

    if (!password) {
      toast.error(t("register.password_error") || "Please enter a password!");
      return;
    }

    if (password.length < 6) {
      toast.error(t("register.password_too_short") || "Password must be at least 6 characters!");
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t("register.passwords_dont_match") || "Passwords do not match!");
      return;
    }

    try {
      setIsLoading(true);
      toast.loading(t("register.loading_message") || "Setting up your restaurant workspace...");

      const res = await signUp(
        bizName,
        email,
        password,
        formData.business_type || selectedCategory,
        formData.currency,
        formData.pos_payment_mode,
        formData.phone,
        formData.address,
        formData.owner_name
      );

      if (res.status === 200) {
        toast.dismiss();

        // Automatically sign in the freshly created user
        try {
          const loginRes = await signIn(email, password);
          if (loginRes.status === 200) {
            const resultUser = loginRes.data.user;
            const user = {
              ...resultUser,
              planFeautures: resultUser.features ? JSON.parse(resultUser.features) : null,
              features_description: resultUser.features_description
                ? JSON.parse(resultUser.features_description)
                : null,
            };
            saveUserDetailsInLocalStorage(user);
            setIsAuthenticated(true);
          }
        } catch (loginErr) {
          console.warn("Auto sign-in fallback:", loginErr);
        }

        toast.success(
          res.data.message || t("register.success_message") || "Account created successfully!"
        );
        setActiveStep(5);
      } else {
        toast.dismiss();
        toast.error(res.data.message || "Failed to create account.");
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        t("register.error_message") ||
        "An error occurred. Please try again.";
      toast.dismiss();
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const getSelectedCategory = () => {
    return CATEGORIES.find((c) => c.id === (formData.business_type || selectedCategory)) || CATEGORIES[0];
  };

  return (
    <div className="min-h-screen w-full bg-white text-slate-900 flex flex-col justify-between relative overflow-x-hidden selection:bg-emerald-500 selection:text-white">
      {/* Subtle Ambient Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[360px] bg-gradient-to-b from-slate-200/50 via-emerald-100/20 to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:28px_28px] opacity-[0.22] pointer-events-none" />

      {/* TOP NAVIGATION BAR */}
      <header className="relative z-10 w-full px-6 py-5 max-w-6xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition">
          <img
            src={Logo}
            alt="Restro PRO"
            className="h-9 sm:h-10 w-auto"
          />
        </Link>

        {/* Minimalist Step Progress Indicator */}
        <div className="hidden sm:flex items-center gap-2">
          {[1, 2, 3, 4].map((step) => (
            <button
              key={step}
              type="button"
              disabled={activeStep === 5}
              onClick={() => {
                if (step < activeStep && activeStep !== 5) setActiveStep(step);
              }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                activeStep === 5
                  ? "w-6 bg-emerald-500"
                  : activeStep === step
                  ? "w-8 bg-slate-900"
                  : activeStep > step
                  ? "w-4 bg-emerald-500 cursor-pointer"
                  : "w-4 bg-slate-200"
              }`}
              title={t("register.step", { step })}
              aria-label={t("register.step", { step })}
            />
          ))}
        </div>

        {/* Right Tools: Language & Sign In */}
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageChanger className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm outline-none cursor-pointer hover:border-slate-300 transition" />

          {activeStep !== 5 && (
            <Link
              to="/login"
              className="hidden md:inline-flex text-xs font-semibold px-4 py-2 rounded-full border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 shadow-sm transition"
            >
              {t("register.signin_button") || "Sign in"}
            </Link>
          )}
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col items-center my-auto">
        {/* Dynamic Step Headings (Centered, bold, crystal clear) */}
        <div className="text-center mb-8 sm:mb-10 max-w-xl">
          {activeStep === 1 && (
            <>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                {t("register.help_title") || "What can we help you do?"}
              </h1>
              <p className="mt-2.5 text-sm sm:text-base text-slate-600 font-normal">
                {t("register.help_subtitle") || "Select all that apply. We'll tailor your setup."}
              </p>
            </>
          )}

          {activeStep === 2 && (
            <>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                {t("register.type_title") || "Which best describes your business?"}
              </h1>
              <p className="mt-2.5 text-sm sm:text-base text-slate-600 font-normal">
                {t("register.type_subtitle") || "Choose the category that fits your establishment best."}
              </p>
            </>
          )}

          {activeStep === 3 && (
            <>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                {t("register.biz_info_title") || "Tell us about your business"}
              </h1>
              <p className="mt-2.5 text-sm sm:text-base text-slate-600 font-normal">
                {t("register.biz_info_subtitle") || "Name your restaurant and select your primary operating currency."}
              </p>
            </>
          )}

          {activeStep === 4 && (
            <>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                {t("register.account_title") || "Create your owner account"}
              </h1>
              <p className="mt-2.5 text-sm sm:text-base text-slate-600 font-normal">
                {t("register.account_subtitle") || "Set up your login credentials to launch your POS terminal."}
              </p>
            </>
          )}

          {activeStep === 5 && (
            <>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold tracking-wide uppercase mb-3">
                <IconSparkles size={14} />
                <span>{t("register.status_ready") || "Ready to Serve"}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                {t("register.completed_title", { name: formData.biz_name }) || `You're all set, ${formData.biz_name}!`}
              </h1>
              <p className="mt-2.5 text-sm sm:text-base text-slate-600 font-normal">
                {t("register.completed_subtitle") || "Your restaurant POS workspace is configured and ready to serve."}
              </p>
            </>
          )}
        </div>

        {/* FLOATING CARD CONTAINER WITH CIRCULAR BACK BUTTON */}
        <div className="relative w-full max-w-[560px] mx-auto">
          {/* Circular Back Button (Shown on steps 1-4; hidden on step 5) */}
          {activeStep < 5 && (
            <button
              type="button"
              onClick={handleBack}
              className="sm:absolute sm:-left-16 sm:top-4 mb-4 sm:mb-0 w-11 h-11 rounded-full bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 flex items-center justify-center transition active:scale-95 border border-slate-200 shadow-sm cursor-pointer"
              aria-label={t("register.back") || "Back"}
              title={t("register.back") || "Back"}
            >
              <IconArrowLeft size={20} />
            </button>
          )}

          {/* Crisp Pure White Floating Card */}
          <div className="bg-white rounded-[28px] p-6 sm:p-9 shadow-xl shadow-slate-200/70 border border-slate-200 text-slate-900 transition-all duration-200">
            {/* ================================================================ */}
            {/* STEP 1: WHAT CAN WE HELP YOU DO? (Interactive Pills)             */}
            {/* ================================================================ */}
            {activeStep === 1 && (
              <form onSubmit={handleStep1Continue}>
                <div className="flex flex-wrap gap-2.5 sm:gap-3 items-center">
                  {GOALS.map((goal) => {
                    const isSelected = selectedGoals.includes(goal.id);
                    return (
                      <button
                        key={goal.id}
                        type="button"
                        onClick={() => toggleGoal(goal.id)}
                        className={`min-h-[44px] px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-150 flex items-center gap-1.5 select-none active:scale-95 cursor-pointer ${
                          isSelected
                            ? "bg-slate-900 text-white shadow-sm"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                        }`}
                      >
                        {isSelected ? (
                          <IconCheck size={16} className="text-white shrink-0 stroke-[2.5]" />
                        ) : (
                          <IconPlus size={16} className="text-slate-500 shrink-0 stroke-[2.5]" />
                        )}
                        <span>{t(goal.labelKey) || goal.fallback}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[50px] mt-8 rounded-full sm:rounded-2xl font-bold text-sm sm:text-base text-white bg-slate-900 hover:bg-black active:scale-95 shadow-md shadow-slate-900/10 transition-all flex items-center justify-center cursor-pointer"
                >
                  {t("register.continue_button") || "Continue"}
                </button>
              </form>
            )}

            {/* ================================================================ */}
            {/* STEP 2: BUSINESS CATEGORY SELECTION                              */}
            {/* ================================================================ */}
            {activeStep === 2 && (
              <form onSubmit={handleStep2Continue}>
                <div className="flex flex-wrap gap-2.5 sm:gap-3 items-center">
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    const CatIcon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleCategorySelect(cat.id)}
                        className={`min-h-[44px] px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-150 flex items-center gap-2 select-none active:scale-95 cursor-pointer ${
                          isSelected
                            ? "bg-slate-900 text-white shadow-sm"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                        }`}
                      >
                        <CatIcon size={18} className={isSelected ? "text-white shrink-0" : "text-slate-600 shrink-0"} />
                        <span>{t(cat.labelKey) || cat.fallback}</span>
                        {isSelected && (
                          <IconCheck size={16} className="text-white shrink-0 stroke-[2.5] ml-1" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[50px] mt-8 rounded-full sm:rounded-2xl font-bold text-sm sm:text-base text-white bg-slate-900 hover:bg-black active:scale-95 shadow-md shadow-slate-900/10 transition-all flex items-center justify-center cursor-pointer"
                >
                  {t("register.continue_button") || "Continue"}
                </button>
              </form>
            )}

            {/* ================================================================ */}
            {/* STEP 3: BUSINESS NAME & CURRENCY                                 */}
            {/* ================================================================ */}
            {activeStep === 3 && (
              <form onSubmit={handleStep3Continue} className="space-y-5">
                {/* Business / Restaurant Name */}
                <div>
                  <label
                    htmlFor="biz_name"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
                  >
                    {t("register.business_name_label") || "Business / Restaurant Name"} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <IconBuildingStore size={20} />
                    </div>
                    <input
                      type="text"
                      id="biz_name"
                      name="biz_name"
                      value={formData.biz_name}
                      onChange={handleChange}
                      required
                      autoFocus
                      placeholder={t("register.business_name_placeholder") || "e.g. The Golden Spoon Bistro"}
                      className="w-full pl-11 pr-4 py-3 min-h-[48px] text-sm font-medium rounded-2xl outline-none border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900 transition-all"
                    />
                  </div>
                </div>

                {/* Operating Currency Pills */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    {t("register.currency_label") || "Primary Operating Currency"}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CURRENCIES.map((c) => {
                      const isSelected = formData.currency === c.code;
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, currency: c.code }))}
                          className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                            isSelected
                              ? "bg-slate-900 text-white shadow-sm"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                          }`}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* POS Billing Mode Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    {t("register.billing_mode_label") || "Order & Billing Mode"}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {BILLING_MODES.map((mode) => {
                      const isSelected = formData.pos_payment_mode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, pos_payment_mode: mode.id }))}
                          className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold text-center transition active:scale-95 cursor-pointer border ${
                            isSelected
                              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent"
                          }`}
                        >
                          {t(mode.titleKey) || mode.fallback}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Phone & Address */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                    >
                      {t("register.phone_label") || "Business Phone"}
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <IconPhone size={18} />
                      </div>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder={t("register.phone_placeholder") || "+855 12 345 678"}
                        className="w-full pl-10 pr-3 py-2.5 min-h-[44px] text-sm rounded-xl outline-none border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="address"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                    >
                      {t("register.address_label") || "Location / City"}
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <IconMapPin size={18} />
                      </div>
                      <input
                        type="text"
                        id="address"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        placeholder={t("register.address_placeholder") || "e.g. Phnom Penh"}
                        className="w-full pl-10 pr-3 py-2.5 min-h-[44px] text-sm rounded-xl outline-none border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900 transition"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[50px] mt-6 rounded-full sm:rounded-2xl font-bold text-sm sm:text-base text-white bg-slate-900 hover:bg-black active:scale-95 shadow-md shadow-slate-900/10 transition-all flex items-center justify-center cursor-pointer"
                >
                  {t("register.continue_button") || "Continue"}
                </button>
              </form>
            )}

            {/* ================================================================ */}
            {/* STEP 4: OWNER ACCOUNT & SECURITY CREDENTIALS                    */}
            {/* ================================================================ */}
            {activeStep === 4 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Owner / Manager Name */}
                <div>
                  <label
                    htmlFor="owner_name"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                  >
                    {t("register.owner_name_label") || "Owner / Manager Full Name"}
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <IconUser size={18} />
                    </div>
                    <input
                      type="text"
                      id="owner_name"
                      name="owner_name"
                      value={formData.owner_name}
                      onChange={handleChange}
                      placeholder={t("register.owner_name_placeholder") || "e.g. Sokha Chan"}
                      className="w-full pl-10 pr-4 py-2.5 min-h-[44px] text-sm rounded-xl outline-none border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900 transition"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label
                    htmlFor="username"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                  >
                    {t("register.email_label") || "Business Email Address"} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <IconMail size={18} />
                    </div>
                    <input
                      type="email"
                      id="username"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      required
                      placeholder={t("register.email_placeholder") || "owner@restaurant.com"}
                      className="w-full pl-10 pr-4 py-2.5 min-h-[44px] text-sm rounded-xl outline-none border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900 transition"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                  >
                    {t("register.password_label") || "Password"} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <IconLock size={18} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      placeholder={t("register.password_placeholder") || "At least 6 characters"}
                      className="w-full pl-10 pr-11 py-2.5 min-h-[44px] text-sm rounded-xl outline-none border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] p-2 rounded-lg text-slate-400 hover:text-slate-600 transition flex items-center justify-center cursor-pointer"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label
                    htmlFor="confirm_password"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                  >
                    {t("register.confirm_password_label") || "Confirm Password"} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <IconLock size={18} />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirm_password"
                      name="confirm_password"
                      value={formData.confirm_password}
                      onChange={handleChange}
                      required
                      placeholder={t("register.confirm_password_placeholder") || "Re-enter your password"}
                      className={`w-full pl-10 pr-11 py-2.5 min-h-[44px] text-sm rounded-xl outline-none border bg-slate-50 text-slate-900 placeholder-slate-400 transition ${
                        formData.confirm_password &&
                        formData.confirm_password !== formData.password
                          ? "border-rose-400 focus:ring-2 focus:ring-rose-400/30"
                          : "border-slate-200 focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] p-2 rounded-lg text-slate-400 hover:text-slate-600 transition flex items-center justify-center cursor-pointer"
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirmPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full min-h-[50px] mt-4 rounded-full sm:rounded-2xl font-bold text-sm sm:text-base text-white bg-slate-900 hover:bg-black active:scale-95 shadow-md shadow-slate-900/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <>
                      <IconCheck size={18} />
                      <span>{t("register.register_button") || "Create Account & Launch POS"}</span>
                    </>
                  )}
                </button>

                {/* OR Divider */}
                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 border-b border-slate-200" />
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    {t("register.or") || "OR"}
                  </span>
                  <div className="flex-1 border-b border-slate-200" />
                </div>

                {/* Google Sign-Up Button */}
                {googleAuthClient && (
                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    disabled={isLoading}
                    className="w-full min-h-[44px] rounded-full sm:rounded-xl font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
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
                    <span className="text-sm font-semibold">
                      {t("register.continue_with_google") || "Continue with Google"}
                    </span>
                  </button>
                )}

                {/* Already Have an Account Link */}
                <Link
                  to="/login"
                  className="w-full min-h-[44px] rounded-full sm:rounded-xl text-xs sm:text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center mt-2"
                >
                  {t("register.signin_button") || "Already have an account? Sign In"}
                </Link>
              </form>
            )}

            {/* ================================================================ */}
            {/* STEP 5: SETUP COMPLETED / LAUNCHPAD CELEBRATION                  */}
            {/* ================================================================ */}
            {activeStep === 5 && (
              <div className="text-center py-2 space-y-6">
                {/* Glowing Celebration Badge */}
                <div className="relative mx-auto w-16 h-16">
                  <div className="absolute inset-0 rounded-full bg-emerald-400/25 animate-ping" />
                  <div className="relative w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <IconCheck size={36} className="stroke-[3]" />
                  </div>
                </div>

                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {formData.biz_name}
                  </h3>
                  {(() => {
                    const selCat = getSelectedCategory();
                    const CatIcon = selCat.icon;
                    return (
                      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <CatIcon size={15} className="text-slate-600" />
                        <span>{t(selCat.labelKey) || selCat.fallback}</span>
                        <span>•</span>
                        <span>{t("register.status_ready") || "Ready to Serve"}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Tailored Setup Summary Box */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left space-y-2.5">
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">{t("register.currency") || "Currency"}</span>
                    <span className="font-bold text-slate-800">{formData.currency} ({formData.currency === "KHR" ? "៛" : "$"})</span>
                  </div>

                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">{t("register.billing_mode") || "Billing Mode"}</span>
                    <span className="font-bold text-slate-800 capitalize">{formData.pos_payment_mode}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">{t("register.kitchen_routing") || "Kitchen Routing"}</span>
                    <span className="font-bold text-emerald-600 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {t("register.kitchen_active_station") || "1 Station Active (Kitchen)"}
                    </span>
                  </div>

                  {/* Active capabilities pills */}
                  <div className="pt-1.5">
                    <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      {t("register.tailored_setup") || "Tailored Setup"}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedGoals.map((gId) => {
                        const goal = GOALS.find((g) => g.id === gId);
                        if (!goal) return null;
                        return (
                          <span
                            key={gId}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          >
                            <IconCheck size={12} className="stroke-[3]" />
                            {t(goal.labelKey) || goal.fallback}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Quick-Action Launch Buttons */}
                <div className="space-y-2.5 pt-2">
                  {/* Primary: Launch POS Terminal */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isAuthenticated) {
                        navigate("/dashboard/home", { replace: true });
                      } else {
                        navigate("/login", { replace: true });
                      }
                    }}
                    className="w-full min-h-[50px] rounded-full sm:rounded-2xl font-bold text-sm sm:text-base text-white bg-slate-900 hover:bg-black active:scale-95 shadow-md shadow-slate-900/10 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    <IconBolt size={18} className="text-amber-400" />
                    <span>{t("register.launch_pos") || "Launch POS Terminal"}</span>
                    <IconArrowRight size={18} />
                  </button>

                  {/* Secondary: Admin Dashboard */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isAuthenticated) {
                        navigate("/dashboard/home", { replace: true });
                      } else {
                        navigate("/login", { replace: true });
                      }
                    }}
                    className="w-full min-h-[46px] rounded-full sm:rounded-2xl font-semibold text-xs sm:text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <IconLayoutDashboard size={17} />
                    <span>{t("register.launch_dashboard") || "Go to Admin Dashboard"}</span>
                  </button>

                  {/* Tertiary: Kitchen KDS */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isAuthenticated) {
                        navigate("/kitchen", { replace: true });
                      } else {
                        navigate("/login", { replace: true });
                      }
                    }}
                    className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition py-1 cursor-pointer"
                  >
                    {t("register.launch_kds") || "Open Kitchen KDS →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Security / Multi-Tenant Badge */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <IconShieldCheck size={16} className="text-emerald-600" />
            <span>{t("register.secure_multi_tenant") || "Secure 256-Bit Multi-Tenant Architecture"}</span>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 w-full py-4 text-center text-xs text-slate-400">
        <span>© {new Date().getFullYear()} Restro PRO. {t("common.rights_reserved") || "All rights reserved."}</span>
      </footer>
    </div>
  );
}
