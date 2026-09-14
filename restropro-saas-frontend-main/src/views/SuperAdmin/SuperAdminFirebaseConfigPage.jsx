import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Page from "../../components/Page";
import {
  IconBellRinging,
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconFileUpload,
  IconFileCheck,
  IconFlask,
  IconDeviceFloppy,
  IconTrash,
  IconX,
  IconInfoCircle,
  IconExternalLink,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import { toast } from "react-hot-toast";
import { useTheme } from "../../contexts/ThemeContext";
import { clsx } from "clsx";
import {
  useFirebaseConfig,
  updateFirebaseConfig,
  testFirebaseConfig,
  deleteFirebaseConfig,
} from "../../controllers/superadmin.controller";

/**
 * Superadmin -> Settings -> Push Notifications (FCM).
 *
 * Manages the platform-global Firebase service account used by the backend
 * to send waiter push notifications. Credentials are write-only: the page
 * only ever displays sanitized status returned by the backend (configured /
 * enabled / project id / last updated) — never key material.
 */
export default function SuperAdminFirebaseConfigPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { data: config, error, isLoading, mutate } = useFirebaseConfig();

  // Raw text of the picked service account file; null until a file is chosen.
  const [uploadedJson, setUploadedJson] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);
  const deleteDialogRef = useRef(null);

  if (isLoading) {
    return <Page>{t("superadmin_firebase.loading", "Please wait...")}</Page>;
  }
  if (error) {
    return <Page>{t("superadmin_firebase.error_loading", "Error loading details! Please try later!")}</Page>;
  }

  const apiMessage = (err, fallback) =>
    err?.response?.data?.message || err?.message || fallback;

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    // allow re-selecting the same file later
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    try {
      JSON.parse(text);
    } catch {
      toast.error(t("superadmin_firebase.invalid_json_file", "That file is not valid JSON."));
      return;
    }
    setUploadedJson(text);
    setUploadedFileName(file.name);
  };

  const btnTest = async () => {
    setBusy(true);
    try {
      // Test the picked file when present, otherwise the stored config.
      const res = await testFirebaseConfig(uploadedJson ?? undefined);
      toast.success(
        t("superadmin_firebase.test_success", "Configuration is valid — project: ") +
          res.data.projectId
      );
    } catch (err) {
      console.error(err);
      toast.error(apiMessage(err, t("superadmin_firebase.test_failed", "Invalid Firebase configuration.")));
    } finally {
      setBusy(false);
    }
  };

  const btnSave = async () => {
    if (!uploadedJson) {
      toast.error(t("superadmin_firebase.pick_file_first", "Upload a service account JSON file first."));
      return;
    }
    setBusy(true);
    try {
      await updateFirebaseConfig({ serviceAccountJson: uploadedJson });
      toast.success(t("superadmin_firebase.saved", "Firebase configuration saved."));
      setUploadedJson(null);
      setUploadedFileName(null);
      await mutate();
    } catch (err) {
      console.error(err);
      toast.error(apiMessage(err, t("superadmin_firebase.save_failed", "Could not save configuration.")));
    } finally {
      setBusy(false);
    }
  };

  const btnToggleEnabled = async () => {
    setBusy(true);
    try {
      await updateFirebaseConfig({ isEnabled: !config.enabled });
      await mutate();
      toast.success(
        !config.enabled
          ? t("superadmin_firebase.enabled_toast", "Push notifications enabled.")
          : t("superadmin_firebase.disabled_toast", "Push notifications disabled.")
      );
    } catch (err) {
      console.error(err);
      toast.error(apiMessage(err, t("superadmin_firebase.toggle_failed", "Could not update status.")));
    } finally {
      setBusy(false);
    }
  };

  const btnDelete = async () => {
    deleteDialogRef.current?.close();
    setBusy(true);
    try {
      await deleteFirebaseConfig();
      await mutate();
      toast.success(t("superadmin_firebase.deleted", "Firebase configuration removed."));
    } catch (err) {
      console.error(err);
      toast.error(apiMessage(err, t("superadmin_firebase.delete_failed", "Could not remove configuration.")));
    } finally {
      setBusy(false);
    }
  };

  const isEnabled = config.active;

  return (
    <Page className="px-4 py-1 overflow-x-hidden h-full">
      <div className="flex gap-6 items-center mb-6 mt-2">
        <h1 className="text-2xl font-semibold">
          {t("superadmin_firebase.title", "Push Notifications (FCM)")}
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
                    ? "bg-restro-green-10 text-restro-green border border-restro-green"
                    : "bg-gray-100 text-gray-400 border border-gray-200",
                )}
              >
                <IconBellRinging
                  size={20}
                  stroke={iconStroke}
                />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-restro-text">
                    {t("superadmin_firebase.title", "Push Notifications (FCM)")}
                  </h2>
                  <span
                    className={clsx(
                      "px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5",
                      isEnabled
                        ? "bg-restro-green  text-restro-green-dark/50 dark:bg-restro-green-dark dark:text-restro-green"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                    )}
                  >
                    <span
                      className={clsx(
                        "w-2 h-2 rounded-full",
                        isEnabled
                          ? "bg-restro-green-dark/50 animate-pulse"
                          : "bg-gray-400",
                      )}
                    />
                    {isEnabled
                      ? t("superadmin_firebase.status_active", "Active & Ready")
                      : t("superadmin_firebase.status_disabled", "Disabled")}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
                  {t(
                    "superadmin_firebase.subtitle",
                    "One Firebase project serves the whole platform. Waiter apps receive notifications; delivery is routed per restaurant automatically."
                  )}
                </p>
              </div>
            </div>

            {config.configured && (
              <input
                type="checkbox"
                className="toggle checked:bg-restro-green checked:border-restro-green"
                checked={config.enabled}
                disabled={busy}
                onChange={btnToggleEnabled}
              />
            )}
          </div>

          {/* Status Details Grid */}
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-gray-50 dark:bg-gray-800/30 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-y-3 text-xs sm:text-sm">
              <p className="text-gray-500">{t("superadmin_firebase.status", "Status")}</p>
              <div>
                {isEnabled ? (
                  <span className="flex items-center gap-1 text-restro-green font-medium">
                    <IconCircleCheckFilled size={18} /> {t("superadmin_firebase.status_active", "Active")}
                    {config.source === "env" && (
                      <span className="text-xs text-gray-500 font-normal ml-1">
                        {t("superadmin_firebase.source_env", "(.env credentials)")}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-500 font-medium">
                    <IconCircleXFilled size={18} /> {t("superadmin_firebase.status_disabled", "Disabled")}
                  </span>
                )}
              </div>

              <p className="text-gray-500">{t("superadmin_firebase.project", "Firebase Project")}</p>
              <p className="font-medium text-restro-text">{config.projectId ?? "—"}</p>

              <p className="text-gray-500">{t("superadmin_firebase.service_account", "Service Account")}</p>
              <p className="font-medium text-restro-text">
                {config.configured
                  ? t("superadmin_firebase.configured", "Configured ✓")
                  : t("superadmin_firebase.not_configured", "Not configured")}
              </p>

              <p className="text-gray-500">{t("superadmin_firebase.last_updated", "Last Updated")}</p>
              <p className="font-medium text-restro-text">
                {config.updatedAt ? new Date(config.updatedAt).toLocaleString() : "—"}
                {/* {config.updatedBy && <span className="text-gray-500"> · {config.updatedBy}</span>} */}
              </p>
            </div>
          </div>

          {/* Actions & Upload Section */}
          <div className="flex flex-col gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onPickFile}
            />

            {/* Dropzone Upload Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={clsx(
                "group relative flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center",
                uploadedFileName
                  ? "border-restro-green-dark/70 bg-restro-green-10 dark:bg-restro-green-dark/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-restro-green bg-gray-50/50 dark:bg-gray-800/20 hover:bg-restro-green-10"
              )}
            >
              {uploadedFileName ? (
                <div className="flex flex-wrap items-center justify-between gap-3 w-full px-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-restro-green-10 text-restro-green-dark border border-restro-green-dark/20 shrink-0">
                      <IconFileCheck size={22} stroke={iconStroke} />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-xs font-semibold text-restro-green dark:text-restro-green-dark truncate">
                        {uploadedFileName}
                      </p>
                      <p className="text-[11px] text-restro-green-dark/80">
                        {t("superadmin_firebase.ready_to_save", "File uploaded — ready to save")}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-restro-green-dark bg-restro-green-10 hover:bg-restro-green/20 dark:bg-restro-green-dark/50 dark:text-restro-green transition-colors shrink-0"
                  >
                    {t("superadmin_firebase.change_file", "Change")}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-1">
                  <div className="p-2.5 rounded-full bg-restro-green/10 text-restro-green group-hover:scale-110 transition-transform">
                    <IconFileUpload size={20} stroke={iconStroke} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-restro-text">
                      {t("superadmin_firebase.upload", "Upload Service Account JSON")}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      {t("superadmin_firebase.upload_drag_drop", "Click or drag & drop JSON credentials file here")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Note & Hint Box */}
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-xs">
              <IconInfoCircle size={20} stroke={iconStroke} className="shrink-0 text-blue-500 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-blue-900 dark:text-blue-200 text-xs mb-0.5">
                  {t("superadmin_firebase.how_to_get_key", "Where to get key?")}
                </p>
                <p className="text-[11px] leading-normal text-blue-800/80 dark:text-blue-300/80">
                  {t(
                    "superadmin_firebase.upload_hint",
                    "Firebase console → Project settings → Service accounts → Generate new private key. Do NOT use google-services.json."
                  )}
                </p>
              </div>
            </div>



            {/* Action Buttons Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <div>
                {config.configured && (
                  <button
                    type="button"
                    onClick={() => deleteDialogRef.current?.showModal()}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition text-xs font-semibold"
                  >
                    <IconTrash stroke={iconStroke} size={16} />
                    <span>{t("superadmin_firebase.delete", "Delete Configuration")}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5 ml-auto">
                <button
                  type="button"
                  onClick={btnTest}
                  disabled={busy || (!uploadedJson && !config.configured)}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-restro-text text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <IconFlask stroke={iconStroke} size={16} />
                  <span>{t("superadmin_firebase.test", "Test Configuration")}</span>
                </button>

                <button
                  type="button"
                  onClick={btnSave}
                  disabled={busy || !uploadedJson}
                  className="flex items-center gap-1.5 rounded-xl px-5 py-2 text-white bg-restro-green hover:bg-restro-green-button-hover transition text-xs font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <IconDeviceFloppy stroke={iconStroke} size={16} />
                  <span>{t("superadmin_firebase.save", "Save")}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Container: Setup Guide (col-span-1) */}
        <div className="lg:col-span-1 flex flex-col h-fit p-6 border border-restro-border-green rounded-3xl bg-white dark:bg-restro-card-bg space-y-6">
            {/* Warning Box */}
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 text-xs">
              <IconAlertTriangle size={20} stroke={iconStroke} className="shrink-0 text-amber-500 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-amber-900 dark:text-amber-200 text-xs mb-0.5">
                  {t("superadmin_firebase.warning_title", "Important Notice")}
                </p>
                <p className="text-[11px] leading-normal text-amber-800/80 dark:text-amber-300/80">
                  {t(
                    "superadmin_firebase.warning_google_login",
                    "Turning off notifications will also turn off Google Sign-In."
                  )}
                </p>
              </div>
            </div>
          
          
          <div className="flex items-center gap-2 text-amber-500">
            <IconInfoCircle
              size={18}
              stroke={iconStroke}
            />
            <h3 className="font-bold text-restro-text text-sm sm:text-base">
              {t("superadmin_firebase.setup_guide", "Setup Guide")}
            </h3>
          </div>

          <ol className="relative border-l border-gray-200 dark:border-gray-800 ml-3 space-y-5 text-xs text-gray-600 dark:text-gray-400 flex-grow">
            <li className="ml-5">
              <span className="absolute flex items-center justify-center w-5 h-5 rounded-full -left-2.5 ring-4 ring-white dark:ring-gray-900 bg-blue-100 text-blue-600 font-bold text-[10px]">
                1
              </span>
              <h4 className="font-semibold text-restro-text text-xs mb-0.5">
                {t("superadmin_firebase.step_1_title", "Open Firebase Console")}
              </h4>
              <p>
                {t("superadmin_firebase.step_1_desc", "Go to Firebase Console and select your project.")}
              </p>
            </li>

            <li className="ml-5">
              <span className="absolute flex items-center justify-center w-5 h-5 rounded-full -left-2.5 ring-4 ring-white dark:ring-gray-900 bg-purple-100 text-purple-600 font-bold text-[10px]">
                2
              </span>
              <h4 className="font-semibold text-restro-text text-xs mb-0.5">
                {t("superadmin_firebase.step_2_title", "Project Settings & Service Accounts")}
              </h4>
              <p>
                {t("superadmin_firebase.step_2_desc", "Click ⚙️ Project Settings and navigate to the Service accounts tab.")}
              </p>
            </li>

            <li className="ml-5">
              <span className="absolute flex items-center justify-center w-5 h-5 rounded-full -left-2.5 ring-4 ring-white dark:ring-gray-900 bg-restro-green-10 text-restro-green-dark font-bold text-[10px]">
                3
              </span>
              <h4 className="font-semibold text-restro-text text-xs mb-0.5">
                {t("superadmin_firebase.step_3_title", "Generate Private Key")}
              </h4>
              <p>
                {t("superadmin_firebase.step_3_desc", "Click Generate new private key to download your Service Account JSON file.")}
              </p>
            </li>

            <li className="ml-5">
              <span className="absolute flex items-center justify-center w-5 h-5 rounded-full -left-2.5 ring-4 ring-white dark:ring-gray-900 bg-amber-100 text-amber-600 font-bold text-[10px]">
                4
              </span>
              <h4 className="font-semibold text-restro-text text-xs mb-0.5">
                {t("superadmin_firebase.step_4_title", "Upload and Save")}
              </h4>
              <p>
                {t("superadmin_firebase.step_4_desc", "Upload the JSON file into the field on the left and click Save.")}
              </p>
            </li>
          </ol>

          <a
            href="https://console.firebase.google.com/"
            target="_blank"
            rel="noreferrer"
            className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-xs transition-colors"
          >
            <span>{t("superadmin_firebase.open_firebase_console", "Open Firebase Console")}</span>
            <IconExternalLink
              size={14}
              stroke={iconStroke}
            />
          </a>
        </div>
      </div>

      {/* Delete confirmation */}
      <dialog ref={deleteDialogRef} className="modal modal-bottom sm:modal-middle">
        <div className="modal-box border border-restro-border-green dark:rounded-2xl">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">
              {t("superadmin_firebase.delete_title", "Delete Firebase configuration?")}
            </h3>
            <form method="dialog">
              <button className="btn btn-circle btn-ghost">
                <IconX stroke={iconStroke} />
              </button>
            </form>
          </div>
          <p className="py-4 text-sm">
            {t(
              "superadmin_firebase.delete_body",
              "The stored service account will be removed and push notifications will stop for all restaurants. Device tokens are kept, so uploading a new key restores notifications without any app changes."
            )}
          </p>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn rounded-full">{t("superadmin_firebase.cancel", "Cancel")}</button>
            </form>
            <button onClick={btnDelete} className="btn rounded-full bg-red-500 hover:bg-red-600 text-white">
              {t("superadmin_firebase.delete_confirm", "Delete")}
            </button>
          </div>
        </div>
      </dialog>
    </Page>
  );
}

