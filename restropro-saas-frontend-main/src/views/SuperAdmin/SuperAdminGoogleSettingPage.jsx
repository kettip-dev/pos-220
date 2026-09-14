import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Page from "../../components/Page";
import {
  IconBrandGoogle,
  IconShieldCheck,
  IconKey,
  IconCopy,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconExternalLink,
  IconDeviceFloppy,
  IconInfoCircle,
  IconSparkles,
  IconBuildingStore,
  IconLock,
  IconRefresh,
  IconWorld,
  IconChecklist,
  IconAlertCircle,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import { toast } from "react-hot-toast";
import { useTheme } from "../../contexts/ThemeContext";
import { clsx } from "clsx";

import { updateGoogleAuth } from "../../controllers/superadmin.controller";
import ApiClient from "../../helpers/ApiClient";

export default function SuperAdminGoogleSettingPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  // State for Google Auth Configuration
  const [isEnabled, setIsEnabled] = useState(false);
  const [isFirebaseConfigured, setIsFirebaseConfigured] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [authDomain, setAuthDomain] = useState("");
  const [projectId, setProjectId] = useState("");
  const [storageBucket, setStorageBucket] = useState("");
  const [messagingSenderId, setMessagingSenderId] = useState("");
  const [appId, setAppId] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAppId, setShowAppId] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [configuredFields, setConfiguredFields] = useState({});

  const loadGoogleAuthConfig = async () => {
    try {
      const { data } = await ApiClient.get("/superadmin/google-auth");
      const hasFirebase = data.is_firebase_service_config !== false;
      setIsFirebaseConfigured(hasFirebase);
      setIsEnabled(Number(data.status) === 1 && hasFirebase);
      setConfiguredFields(data.configured_fields || {});
    } catch (error) {
      console.error("Unable to load Google Auth configuration", error);
    }
  };

  useEffect(() => {
    loadGoogleAuthConfig();
  }, []);

  const configuredPlaceholder = (field, fallback) =>
    configuredFields[field]
      ? `•••••••• (${t("superadmin_google.configured", "configured")})`
      : fallback;

  // System Callback URIs
  const redirectUri =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/auth/google/callback`
      : "https://app.yourdomain.com/api/auth/google/callback";
  const jsOrigin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://app.yourdomain.com";

  const handleCopy = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`${fieldName} ${t("superadmin_google.copied", "copied to clipboard!")}`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      const updateCredentials = [
        apiKey,
        authDomain,
        projectId,
        storageBucket,
        messagingSenderId,
        appId,
      ].some((value) => value.trim());
      const res = await updateGoogleAuth(
        isEnabled,
        apiKey,
        authDomain,
        projectId,
        storageBucket,
        messagingSenderId,
        appId,
        updateCredentials,
      );
      if (res.status === 200 && res.data?.success) {
        await loadGoogleAuthConfig();
        toast.success(
          res.data.message || t("superadmin_google.success_toast", "Google Authentication settings updated successfully!")
        );
        setApiKey("");
        setAuthDomain("");
        setProjectId("");
        setStorageBucket("");
        setMessagingSenderId("");
        setAppId("");
      } else {
        toast.error(res.data?.message || t("superadmin_google.error_toast", "Failed to update Google Auth settings"));
      }
    } catch (error) {
      console.error(error);
      const msg = error?.response?.data?.message || error?.message || t("superadmin_google.error_toast", "Failed to update Google Auth settings");
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    setPendingStatus(isEnabled);
  };

  const requestStatusChange = () => {
    if (!isFirebaseConfigured) {
      toast.error(
        t(
          "superadmin_google.upload_service_account_warning",
          "Upload Service Account JSON from PUSH Notification to enable Google auth."
        )
      );
      return;
    }
    setIsEnabled((current) => !current);
  };

  const confirmStatusChange = () => {
    saveSettings();
    setPendingStatus(null);
  };

  return (
    <Page className="px-4 py-3 overflow-x-hidden h-full">
      <div className="flex gap-6 items-center mb-6 mt-6">
        <h1 className="text-2xl font-semibold">
          {t("superadmin_google.title", "Google Authentication")}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
        {/* Left Container: Settings & Credentials (col-span-2) */}
        <div className="lg:col-span-2 flex flex-col h-fit p-6 border border-restro-border-green rounded-3xl bg-white dark:bg-restro-card-bg space-y-6">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={clsx(
                  "flex shrink-0 items-center justify-center rounded-lg p-2 transition-colors",
                  isEnabled
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    : "bg-gray-100 text-gray-400 border border-gray-200",
                )}
              >
                <IconBrandGoogle
                  size={20}
                  stroke={iconStroke}
                />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-restro-text">
                    {t("superadmin_google.title", "Google Authentication")}
                  </h2>
                  <span
                    className={clsx(
                      "px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5",
                      isEnabled
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                    )}
                  >
                    <span
                      className={clsx(
                        "w-2 h-2 rounded-full",
                        isEnabled
                          ? "bg-emerald-500 animate-pulse"
                          : "bg-gray-400",
                      )}
                    />
                    {isEnabled
                      ? t("superadmin_google.active_status", "Active & Ready")
                      : t("superadmin_google.disabled_status", "Disabled")}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
                  {t(
                    "superadmin_google.subtitle",
                    "Configure Firebase credentials and control Google Sign-In availability for business login and registration.",
                  )}
                </p>
              </div>
            </div>

            {/* Custom Switch Component */}
            <button
              type="button"
              role="switch"
              aria-checked={isEnabled}
              disabled={!isFirebaseConfigured}
              onClick={requestStatusChange}
              className={clsx(
                "relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-restro-green focus:ring-offset-2",
                isEnabled
                  ? "bg-restro-green"
                  : "bg-gray-300 dark:bg-gray-700",
                !isFirebaseConfigured && "opacity-50 cursor-not-allowed",
              )}
            >
              <span
                className={clsx(
                  "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  isEnabled
                    ? "translate-x-7"
                    : "translate-x-0",
                )}
              />
            </button>
          </div>

          {!isFirebaseConfigured && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
              <IconAlertCircle className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" size={20} stroke={iconStroke} />
              <div className="text-xs sm:text-sm">
                <p className="font-semibold text-amber-800 dark:text-amber-300">
                  {t(
                    "superadmin_google.upload_service_account_warning",
                    "Upload Service Account JSON from PUSH Notification to enable Google auth."
                  )}
                </p>
                <Link
                  to="/superadmin/dashboard/push-notifications"
                  className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-restro-green hover:underline"
                >
                  <span>{t("superadmin_google.go_to_push_notification", "Go to Push Notification Settings")}</span>
                  <IconExternalLink size={14} stroke={iconStroke} />
                </Link>
              </div>
            </div>
          )}

          <form onSubmit={handleSave} className="mt-5 space-y-3 border-t border-gray-100 pt-5 dark:border-gray-800/80 sm:mt-6 sm:pt-6">
            {isEnabled && (
              <>
            <div className="mb-5 flex items-center gap-3 sm:mb-6">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20">
              <IconKey size={18} stroke={iconStroke} />
            </div>
            <div>
              <h2 className="text-base font-bold text-restro-text">
                {t("superadmin_google.api_credentials", "API Credentials")}
              </h2>
              <p className="text-xs text-gray-500">
                {t("superadmin_google.api_credentials_desc", "Obtain these credentials from your Google Cloud Console project.")}
              </p>
            </div>
            </div>

            {/* Row 1: API Key — full width */}
            <div>
              <label className="text-xs font-semibold text-restro-text mb-1.5 flex items-center justify-between">
                <span>{t("superadmin_google.api_key", "API Key")} <span className="text-red-500">*</span></span>
                <span className="font-normal text-gray-400">{t("superadmin_google.firebase_api_key_hint", "Firebase project API key")}</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={configuredPlaceholder("api_key", "AIzaSy...")}
                  className={clsx(
                    "w-full pr-20 pl-3 py-2 rounded-xl text-xs font-mono transition-all border outline-none focus:ring-2 focus:ring-restro-green/30",
                    theme === "black"
                      ? "bg-gray-800/70 border-gray-700 text-gray-100 focus:border-restro-green"
                      : "bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-restro-green",
                  )}
                />
                <div className="absolute right-2 flex items-center gap-0.5">
                  <button type="button" onClick={() => setShowApiKey(!showApiKey)} title={showApiKey ? "Hide" : "Show"} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors">
                    {showApiKey ? <IconEyeOff size={15} stroke={iconStroke} /> : <IconEye size={15} stroke={iconStroke} />}
                  </button>
                  <button type="button" onClick={() => handleCopy(apiKey, "API Key")} title="Copy" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors">
                    {copiedField === "API Key" ? <IconCheck size={15} className="text-emerald-500" /> : <IconCopy size={15} stroke={iconStroke} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Auth Domain + Project ID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-restro-text mb-1.5 flex items-center justify-between">
                  <span>{t("superadmin_google.auth_domain", "Auth Domain")} <span className="text-red-500">*</span></span>
                  <span className="font-normal text-gray-400">{t("superadmin_google.auth_domain", "Auth Domain")}</span>
                </label>
                <div className="relative flex items-center">
                  <input type="text" value={authDomain} onChange={(e) => setAuthDomain(e.target.value)} placeholder={configuredPlaceholder("auth_domain", "your-project.firebaseapp.com")}
                    className={clsx("w-full pr-9 pl-3 py-2 rounded-xl text-xs font-mono transition-all border outline-none focus:ring-2 focus:ring-restro-green/30",
                      theme === "black" ? "bg-gray-800/70 border-gray-700 text-gray-100 focus:border-restro-green" : "bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-restro-green")} />
                  <button type="button" onClick={() => handleCopy(authDomain, "Auth Domain")} title="Copy" className="absolute right-2 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors">
                    {copiedField === "Auth Domain" ? <IconCheck size={15} className="text-emerald-500" /> : <IconCopy size={15} stroke={iconStroke} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-restro-text mb-1.5 flex items-center justify-between">
                  <span>{t("superadmin_google.project_id", "Project ID")} <span className="text-red-500">*</span></span>
                  <span className="font-normal text-gray-400">{t("superadmin_google.project_id", "Project ID")}</span>
                </label>
                <div className="relative flex items-center">
                  <input type="text" value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder={configuredPlaceholder("project_id", "your-project-id")}
                    className={clsx("w-full pr-9 pl-3 py-2 rounded-xl text-xs font-mono transition-all border outline-none focus:ring-2 focus:ring-restro-green/30",
                      theme === "black" ? "bg-gray-800/70 border-gray-700 text-gray-100 focus:border-restro-green" : "bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-restro-green")} />
                  <button type="button" onClick={() => handleCopy(projectId, "Project ID")} title="Copy" className="absolute right-2 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors">
                    {copiedField === "Project ID" ? <IconCheck size={15} className="text-emerald-500" /> : <IconCopy size={15} stroke={iconStroke} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Row 3: Storage Bucket + Messaging Sender ID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-restro-text mb-1.5 flex items-center justify-between">
                  <span>{t("superadmin_google.storage_bucket", "Storage Bucket")} <span className="text-red-500">*</span></span>
                  <span className="font-normal text-gray-400">{t("superadmin_google.storage_bucket", "Storage Bucket")}</span>
                </label>
                <div className="relative flex items-center">
                  <input type="text" value={storageBucket} onChange={(e) => setStorageBucket(e.target.value)} placeholder={configuredPlaceholder("storage_bucket", "your-project.appspot.com")}
                    className={clsx("w-full pr-9 pl-3 py-2 rounded-xl text-xs font-mono transition-all border outline-none focus:ring-2 focus:ring-restro-green/30",
                      theme === "black" ? "bg-gray-800/70 border-gray-700 text-gray-100 focus:border-restro-green" : "bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-restro-green")} />
                  <button type="button" onClick={() => handleCopy(storageBucket, "Storage Bucket")} title="Copy" className="absolute right-2 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors">
                    {copiedField === "Storage Bucket" ? <IconCheck size={15} className="text-emerald-500" /> : <IconCopy size={15} stroke={iconStroke} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-restro-text mb-1.5 flex items-center justify-between">
                  <span>{t("superadmin_google.messaging_sender_id", "Messaging Sender ID")} <span className="text-red-500">*</span></span>
                  <span className="font-normal text-gray-400">{t("superadmin_google.sender_id", "Sender ID")}</span>
                </label>
                <div className="relative flex items-center">
                  <input type="text" value={messagingSenderId} onChange={(e) => setMessagingSenderId(e.target.value)} placeholder={configuredPlaceholder("messaging_sender_id", "123456789012")}
                    className={clsx("w-full pr-9 pl-3 py-2 rounded-xl text-xs font-mono transition-all border outline-none focus:ring-2 focus:ring-restro-green/30",
                      theme === "black" ? "bg-gray-800/70 border-gray-700 text-gray-100 focus:border-restro-green" : "bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-restro-green")} />
                  <button type="button" onClick={() => handleCopy(messagingSenderId, "Messaging Sender ID")} title="Copy" className="absolute right-2 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors">
                    {copiedField === "Messaging Sender ID" ? <IconCheck size={15} className="text-emerald-500" /> : <IconCopy size={15} stroke={iconStroke} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Row 4: App ID — full width */}
            <div>
              <label className="text-xs font-semibold text-restro-text mb-1.5 flex items-center justify-between">
                <span>{t("superadmin_google.app_id", "App ID")} <span className="text-red-500">*</span></span>
                <span className="font-normal text-gray-400">{t("superadmin_google.firebase_app_id_hint", "Firebase App ID")}</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type={showAppId ? "text" : "password"}
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder={configuredPlaceholder("app_id", "1:123456789012:web:abc123def456")}
                  className={clsx(
                    "w-full pr-20 pl-3 py-2 rounded-xl text-xs font-mono transition-all border outline-none focus:ring-2 focus:ring-restro-green/30",
                    theme === "black"
                      ? "bg-gray-800/70 border-gray-700 text-gray-100 focus:border-restro-green"
                      : "bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-restro-green",
                  )}
                />
                <div className="absolute right-2 flex items-center gap-0.5">
                  <button type="button" onClick={() => setShowAppId(!showAppId)} title={showAppId ? "Hide" : "Show"} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors">
                    {showAppId ? <IconEyeOff size={15} stroke={iconStroke} /> : <IconEye size={15} stroke={iconStroke} />}
                  </button>
                  <button type="button" onClick={() => handleCopy(appId, "App ID")} title="Copy" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors">
                    {copiedField === "App ID" ? <IconCheck size={15} className="text-emerald-500" /> : <IconCopy size={15} stroke={iconStroke} />}
                  </button>
                </div>
              </div>
            </div>
              </>
            )}

            {/* Save Button */}
            <div className="pt-3">
              <button type="submit" disabled={isSaving}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-6 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100">
                {isSaving ? (
                  <>
                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>{t("superadmin_google.saving", "Saving...")}</span>
                  </>
                ) : (
                  <>
                    <IconDeviceFloppy size={17} stroke={iconStroke} />
                    <span>{t("superadmin_google.save_settings", "Save Settings")}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Container: Setup Guide (col-span-1) */}
        <div className="lg:col-span-1 flex flex-col h-fit p-6 border border-restro-border-green rounded-3xl bg-white dark:bg-restro-card-bg space-y-6">
          <div className="flex items-center gap-2 text-amber-500">
            <IconInfoCircle
              size={18}
              stroke={iconStroke}
            />
            <h3 className="font-bold text-restro-text text-sm sm:text-base">
              {t("superadmin_google.setup_guide", "Setup Guide")}
            </h3>
          </div>

          <ol className="relative border-l border-gray-200 dark:border-gray-800 ml-3 space-y-5 text-xs text-gray-600 dark:text-gray-400 flex-grow">
            <li className="ml-5">
              <span className="absolute flex items-center justify-center w-5 h-5 rounded-full -left-2.5 ring-4 ring-white dark:ring-gray-900 bg-blue-100 text-blue-600 font-bold text-[10px]">
                1
              </span>
              <h4 className="font-semibold text-restro-text text-xs mb-0.5">
                {t("superadmin_google.step_1_title", "Open Firebase Console")}
              </h4>
              <p>
                {t("superadmin_google.step_1_desc", "Go to Firebase Console and select your project (Create your project).")}
              </p>
            </li>

            <li className="ml-5">
              <span className="absolute flex items-center justify-center w-5 h-5 rounded-full -left-2.5 ring-4 ring-white dark:ring-gray-900 bg-purple-100 text-purple-600 font-bold text-[10px]">
                2
              </span>
              <h4 className="font-semibold text-restro-text text-xs mb-0.5">
                {t("superadmin_google.step_2_title", "Project Settings")}
              </h4>
              <p>
                {t("superadmin_google.step_2_desc", "Click the ⚙️ Project Settings icon next to Project Overview and stay on the General tab.")}
              </p>
            </li>

            <li className="ml-5">
              <span className="absolute flex items-center justify-center w-5 h-5 rounded-full -left-2.5 ring-4 ring-white dark:ring-gray-900 bg-emerald-100 text-emerald-600 font-bold text-[10px]">
                3
              </span>
              <h4 className="font-semibold text-restro-text text-xs mb-0.5">
                {t("superadmin_google.step_3_title", "Register Web App")}
              </h4>
              <p>
                {t("superadmin_google.step_3_desc", "Scroll down to Your apps, click Add app (</> Web), enter a nickname, and click Register app.")}
              </p>
            </li>

            <li className="ml-5">
              <span className="absolute flex items-center justify-center w-5 h-5 rounded-full -left-2.5 ring-4 ring-white dark:ring-gray-900 bg-amber-100 text-amber-600 font-bold text-[10px]">
                4
              </span>
              <h4 className="font-semibold text-restro-text text-xs mb-0.5">
                {t("superadmin_google.step_4_title", "Locate and Copy SDK Configuration")}
              </h4>
              <p>
                {t("superadmin_google.step_4_desc", "Firebase will display the SDK config object. Copy the values into the fields on the left and save.")}
              </p>
            </li>

            <li className="ml-5">
              <span className="absolute flex items-center justify-center w-5 h-5 rounded-full -left-2.5 ring-4 ring-white dark:ring-gray-900 bg-indigo-100 text-indigo-600 font-bold text-[10px]">
                5
              </span>
              <h4 className="font-semibold text-restro-text text-xs mb-0.5">
                {t("superadmin_google.step_5_title", "Upload Service Account JSON (On This Dashboard)")}
              </h4>
              <p>
                {t("superadmin_google.step_5_desc", "Here in this admin dashboard website, go to Platform Settings → Push Notifications and upload your downloaded Service Account JSON file.")}
              </p>
            </li>
          </ol>

          <a
            href="https://console.firebase.google.com/"
            target="_blank"
            rel="noreferrer"
            className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-xs transition-colors"
          >
            <span>{t("superadmin_google.open_firebase_console", "Open Firebase Console")}</span>
            <IconExternalLink
              size={14}
              stroke={iconStroke}
            />
          </a>
        </div>
      </div>

      {pendingStatus !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="google-auth-warning-title"
        >
          <div
            className={clsx(
              "w-full max-w-md rounded-2xl border p-4 shadow-2xl sm:p-6",
              theme === "black"
                ? "border-gray-700 bg-gray-900"
                : "border-gray-200 bg-white",
            )}
          >
            <div className="flex items-start gap-3 bg-transparent">
              <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600">
                <IconInfoCircle size={24} stroke={iconStroke} />
              </div>
              <div>
                <h2 id="google-auth-warning-title" className="text-lg font-bold text-restro-text">
                  {pendingStatus
                    ? t("superadmin_google.enable_title", "Enable Google Sign-In?")
                    : t("superadmin_google.disable_title", "Disable Google Sign-In?")}
                </h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {pendingStatus
                    ? t("superadmin_google.enable_body", "On enabling, businesses can log in through Google and email.")
                    : t("superadmin_google.disable_body", "On disabling, businesses can only log in through email and password.")}
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  {t("superadmin_google.confirm_hint", "Confirm to save this change.")}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => setPendingStatus(null)}
                className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 sm:w-auto"
              >
                {t("superadmin_google.cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={confirmStatusChange}
                className={clsx(
                  "w-full rounded-xl px-4 py-2 text-sm font-semibold text-white sm:w-auto",
                  pendingStatus
                    ? "bg-restro-green hover:bg-restro-green-button-hover"
                    : "bg-red-600 hover:bg-red-700",
                )}
              >
                {pendingStatus
                  ? t("superadmin_google.enable", "Enable")
                  : t("superadmin_google.disable", "Disable")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

