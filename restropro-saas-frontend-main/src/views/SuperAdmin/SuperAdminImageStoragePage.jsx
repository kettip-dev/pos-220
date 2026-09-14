import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Page from "../../components/Page";
import {
  IconAlertTriangle,
  IconCloudUpload,
  IconDeviceFloppy,
  IconServer,
  IconInfoCircle,
  IconKey,
  IconCheck,
  IconCopy,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import ApiClient from "../../helpers/ApiClient";
import { iconStroke } from "../../config/config";
import { useTheme } from "../../contexts/ThemeContext";
import { clsx } from "clsx";

const emptyCredentials = {
  endpoint: "",
  region: "",
  access_key_id: "",
  secret_access_key: "",
  bucket_name: "",
  public_url: "",
};

const isCloudflareR2Endpoint = (endpoint) =>
  /^https?:\/\/[^/]+\.r2\.cloudflarestorage\.com\/?$/i.test(endpoint.trim());

export default function SuperAdminImageStoragePage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentMode, setCurrentMode] = useState("local");
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [credentialsConfigured, setCredentialsConfigured] = useState(false);
  const [credentials, setCredentials] = useState(emptyCredentials);
  const [showWarning, setShowWarning] = useState(false);
  const [migrationConfirmed, setMigrationConfirmed] = useState(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data } = await ApiClient.get("/superadmin/image-storage");
      const isCloud = data.mode === "cloud";
      setCurrentMode(isCloud ? "cloud" : "local");
      setCloudEnabled(isCloud);
      setCredentialsConfigured(Boolean(data.credentials_configured));
      setCredentials(emptyCredentials);
    } catch (error) {
      console.error(error);
      toast.error(t("superadmin_image_storage.unable_load", "Unable to load image storage settings."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const updateCredential = (key, value) => {
    setCredentials((previous) => {
      const updated = { ...previous, [key]: value };
      if (key === "endpoint") {
        updated.region = isCloudflareR2Endpoint(value) ? "auto" : previous.region === "auto" ? "" : previous.region;
      }
      return updated;
    });
  };

  const save = async (acknowledged = false) => {
    const targetMode = cloudEnabled ? "cloud" : "local";
    const changedCredentials = Object.fromEntries(
      Object.entries(credentials).filter(([, value]) => value.trim() !== "")
    );

    if (targetMode === "cloud" && !credentialsConfigured && Object.keys(changedCredentials).length !== 6) {
      toast.error(t("superadmin_image_storage.enter_all_credentials", "Enter all cloud storage credentials before enabling cloud storage."));
      return;
    }

    try {
      setSaving(true);
      await ApiClient.post("/superadmin/image-storage", {
        provider_name: targetMode === "cloud" ? "s3" : "local",
        status: targetMode === "cloud" ? 1 : 0,
        credentials: changedCredentials,
        migrationAcknowledged: acknowledged,
      });
      toast.success(
        t("superadmin_image_storage.switched_toast", "Image storage settings updated successfully.")
      );
      setShowWarning(false);
      setMigrationConfirmed(false);
      await loadSettings();
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || t("superadmin_image_storage.unable_save", "Unable to save image storage settings."));
    } finally {
      setSaving(false);
    }
  };

  const requestSave = () => {
    const targetMode = cloudEnabled ? "cloud" : "local";
    if (targetMode !== currentMode) {
      setMigrationConfirmed(false);
      setShowWarning(true);
      return;
    }
    save(false);
  };

  const targetLabel = cloudEnabled
    ? t("superadmin_image_storage.cloud_storage", "Cloud storage")
    : t("superadmin_image_storage.local_server_disk", "Local server disk");
  const sourceLabel = currentMode === "cloud"
    ? t("superadmin_image_storage.cloud_storage", "Cloud storage")
    : t("superadmin_image_storage.local_server_disk", "Local server disk");

  return (
    <Page className="px-4 py-3 overflow-x-hidden h-full">
      <div className="flex gap-6 items-center mb-6 mt-6">
        <h1 className="text-2xl font-semibold">
          {t("superadmin_image_storage.title", "Image Storage")}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
        {/* Left Container: Settings & Credentials (col-span-2) */}
        <div className="lg:col-span-2 flex flex-col h-fit p-6 border border-restro-border-green rounded-3xl bg-white dark:bg-restro-card-bg space-y-6">
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-12 w-full rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-10 w-full rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={clsx(
                      "flex shrink-0 items-center justify-center rounded-lg p-2 transition-colors",
                      cloudEnabled
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        : "bg-blue-500/10 text-blue-600 border border-blue-500/20",
                    )}
                  >
                    {cloudEnabled ? (
                      <IconCloudUpload size={20} stroke={iconStroke} />
                    ) : (
                      <IconServer size={20} stroke={iconStroke} />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-restro-text">
                        {cloudEnabled
                          ? t("superadmin_image_storage.cloud_storage", "Cloud storage")
                          : t("superadmin_image_storage.local_server_disk", "Local server disk")}
                      </h2>
                      <span
                        className={clsx(
                          "px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5",
                          cloudEnabled
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
                        )}
                      >
                        <span
                          className={clsx(
                            "w-2 h-2 rounded-full",
                            cloudEnabled ? "bg-emerald-500 animate-pulse" : "bg-blue-500",
                          )}
                        />
                        {cloudEnabled ? "S3 Cloud Storage" : "Local Disk Storage"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
                      {cloudEnabled
                        ? t("superadmin_image_storage.cloud_desc", "New images for all businesses are stored in the configured cloud provider.")
                        : t("superadmin_image_storage.local_desc", "New images for all businesses are stored on this application server.")}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={cloudEnabled}
                  onClick={() => setCloudEnabled(!cloudEnabled)}
                  className={clsx(
                    "relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-restro-green focus:ring-offset-2",
                    cloudEnabled ? "bg-restro-green" : "bg-gray-300 dark:bg-gray-700",
                  )}
                >
                  <span
                    className={clsx(
                      "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      cloudEnabled ? "translate-x-7" : "translate-x-0",
                    )}
                  />
                </button>
              </div>

              {cloudEnabled && (
                <div className="space-y-4 border-t border-gray-100 pt-5 dark:border-gray-800/80">
                  <div>
                    <h2 className="text-base font-bold text-restro-text sm:text-lg">
                      {t("superadmin_image_storage.cloud_credentials", "Cloud storage credentials")}
                    </h2>
                    <p className="text-xs text-gray-500">
                      {t("superadmin_image_storage.cloud_credentials_desc", "Use any S3-compatible provider. Leave a configured field blank to keep its existing value.")}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={t("superadmin_image_storage.endpoint_url", "Endpoint URL")} value={credentials.endpoint} onChange={(value) => updateCredential("endpoint", value)} configured={credentialsConfigured} placeholder="https://s3.example.com" theme={theme} t={t} />
                    <Field label={t("superadmin_image_storage.region", "Region")} value={credentials.region} onChange={(value) => updateCredential("region", value)} configured={credentialsConfigured} placeholder="R2: auto · AWS: e.g. ap-south-1" theme={theme} t={t} />
                    <Field label={t("superadmin_image_storage.access_key_id", "Access Key ID")} value={credentials.access_key_id} onChange={(value) => updateCredential("access_key_id", value)} configured={credentialsConfigured} secret theme={theme} t={t} />
                    <Field label={t("superadmin_image_storage.secret_access_key", "Secret Access Key")} value={credentials.secret_access_key} onChange={(value) => updateCredential("secret_access_key", value)} configured={credentialsConfigured} secret theme={theme} t={t} />
                    <Field label={t("superadmin_image_storage.bucket_name", "Bucket Name")} value={credentials.bucket_name} onChange={(value) => updateCredential("bucket_name", value)} configured={credentialsConfigured} secret theme={theme} t={t} />
                    <Field label={t("superadmin_image_storage.public_url", "Public URL")} value={credentials.public_url} onChange={(value) => updateCredential("public_url", value)} placeholder="https://cdn.example.com" theme={theme} t={t} />
                  </div>
                </div>
              )}

              <div className="pt-3">
                <button
                  type="button"
                  onClick={requestSave}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-6 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <IconDeviceFloppy size={18} stroke={iconStroke} />
                  <span>{saving ? t("superadmin_image_storage.saving", "Saving…") : t("superadmin_image_storage.save_settings", "Save storage settings")}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Container: Setup Guide (col-span-1) */}
        <div className="lg:col-span-1 flex flex-col h-fit p-6 border border-restro-border-green rounded-3xl bg-white dark:bg-restro-card-bg space-y-6">
          <div className="flex items-center gap-2 text-amber-500">
            <IconInfoCircle
              size={18}
              stroke={iconStroke}
            />
            <h3 className="font-bold text-restro-text text-sm sm:text-base">
              {t("superadmin_image_storage.setup_guide", "Setup Guide")}
            </h3>
          </div>

          <ol className="relative border-l border-gray-200 dark:border-gray-800 ml-3 space-y-5 text-xs text-gray-600 dark:text-gray-400 flex-grow">
            <li className="ml-5">
              <span className="absolute flex items-center justify-center w-5 h-5 rounded-full -left-2.5 ring-4 ring-white dark:ring-gray-900 bg-blue-100 text-blue-600 font-bold text-[10px]">
                1
              </span>
              <h4 className="font-semibold text-restro-text text-xs mb-0.5">
                {t("superadmin_image_storage.step_1_title", "Select Storage Provider")}
              </h4>
              <p>
                {t("superadmin_image_storage.step_1_desc", "Choose between local server disk or an S3-compatible cloud provider (AWS S3, Cloudflare R2, DigitalOcean Spaces).")}
              </p>
            </li>

            <li className="ml-5">
              <span className="absolute flex items-center justify-center w-5 h-5 rounded-full -left-2.5 ring-4 ring-white dark:ring-gray-900 bg-purple-100 text-purple-600 font-bold text-[10px]">
                2
              </span>
              <h4 className="font-semibold text-restro-text text-xs mb-0.5">
                {t("superadmin_image_storage.step_2_title", "Obtain Credentials")}
              </h4>
              <p>
                {t("superadmin_image_storage.step_2_desc", "For cloud storage, generate your Access Key ID, Secret Access Key, Bucket Name, and Endpoint URL.")}
              </p>
            </li>

            <li className="ml-5">
              <span className="absolute flex items-center justify-center w-5 h-5 rounded-full -left-2.5 ring-4 ring-white dark:ring-gray-900 bg-emerald-100 text-emerald-600 font-bold text-[10px]">
                3
              </span>
              <h4 className="font-semibold text-restro-text text-xs mb-0.5">
                {t("superadmin_image_storage.step_3_title", "Configure & Save")}
              </h4>
              <p>
                {t("superadmin_image_storage.step_3_desc", "Enter the credentials in the form on the left and click Save storage settings.")}
              </p>
            </li>

            <li className="ml-5">
              <span className="absolute flex items-center justify-center w-5 h-5 rounded-full -left-2.5 ring-4 ring-white dark:ring-gray-900 bg-amber-100 text-amber-600 font-bold text-[10px]">
                4
              </span>
              <h4 className="font-semibold text-restro-text text-xs mb-0.5">
                {t("superadmin_image_storage.step_4_title", "Migrate Existing Files")}
              </h4>
              <p>
                {t("superadmin_image_storage.step_4_desc", "Before switching storage locations in production, migrate all existing image files to prevent broken images.")}
              </p>
            </li>
          </ol>
        </div>
      </div>

      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-restro-card-bg" role="dialog" aria-modal="true" aria-labelledby="storage-switch-title">
            <div className="flex gap-3">
              <IconAlertTriangle className="shrink-0 text-amber-500" size={26} stroke={iconStroke} />
              <div>
                <h2 id="storage-switch-title" className="text-lg font-bold text-gray-900 dark:text-white">
                  {t("superadmin_image_storage.migrate_title", "Migrate images before switching")}
                </h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  {t("superadmin_image_storage.migrate_desc_start", "You are changing storage for every business from")}{" "}
                  <strong>{sourceLabel}</strong>{" "}
                  {t("superadmin_image_storage.migrate_desc_to", "to")}{" "}
                  <strong>{targetLabel}</strong>
                  {t("superadmin_image_storage.migrate_desc_end", ". Existing images are not moved automatically.")}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              {t("superadmin_image_storage.migrate_warning_box", "Before continuing, migrate your existing image files and update their database paths. Switching first can make existing images unavailable.")}
            </div>
            <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-gray-700 dark:text-gray-200">
              <input type="checkbox" checked={migrationConfirmed} onChange={(event) => setMigrationConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-restro-green" />
              <span>{t("superadmin_image_storage.migrate_confirm_checkbox", "I confirm that I am responsible for migrating all existing images before this storage-location change.")}</span>
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => { setCloudEnabled(currentMode === "cloud"); setShowWarning(false); }} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium dark:border-gray-600">
                {t("superadmin_image_storage.cancel", "Cancel")}
              </button>
              <button type="button" disabled={!migrationConfirmed || saving} onClick={() => save(true)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
                {saving
                  ? t("superadmin_image_storage.switching", "Switching…")
                  : cloudEnabled
                  ? t("superadmin_image_storage.switch_to_cloud", "Switch to cloud")
                  : t("superadmin_image_storage.switch_to_local", "Switch to local")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

function Field({ label, value, onChange, configured, secret, placeholder, theme, t, className = "" }) {
  return (
    <div className={className}>
      <label className="text-xs font-semibold text-restro-text mb-1.5 flex items-center justify-between">
        <span>{label}</span>
        {configured ? <span className="font-normal text-xs text-restro-green">{t ? t("superadmin_image_storage.configured", "Configured") : "Configured"}</span> : null}
      </label>
      <input
        type={secret ? "password" : "text"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={configured ? "••••••••••••" : placeholder || `${t ? t("superadmin_image_storage.enter", "Enter") : "Enter"} ${label}`}
        className={clsx(
          "w-full pr-3 pl-3 py-2 rounded-xl text-xs font-mono transition-all border outline-none focus:ring-2 focus:ring-restro-green/30",
          theme === "black"
            ? "bg-gray-800/70 border-gray-700 text-gray-100 focus:border-restro-green"
            : "bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-restro-green",
        )}
      />
    </div>
  );
}

