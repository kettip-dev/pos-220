import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import Page from "../../components/Page";
import {
  IconSettings,
  IconX,
  IconLock,
  IconExternalLink,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import { toast } from "react-hot-toast";
import { useTheme } from "../../contexts/ThemeContext";
import {
  getPaymentGateways,
  updatePaymentGatewayStatus,
  updatePaymentGatewayCredentials,
} from "../../controllers/superadmin.controller";
import { clsx } from "clsx";
import {
  getPaymentGatewayIcon,
  getPaymentGatewayName,
  getPaymentGatewayCredentials,
  getAllPaymentGateways,
  getPaymentGateway,
} from "../../config/payment-gateway";

export default function SuperAdminPaymentGatewaysPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [allGateways, setAllGateways] = useState([]);
  const [selectedGateway, setSelectedGateway] = useState(null);
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [storedGateways, setStoredGateways] = useState({});
  const manageDialogRef = useRef(null);
  const confirmDialogRef = useRef(null);

  useEffect(() => {
    fetchGateways();
  }, []);

  useEffect(() => {
    if (selectedGateway) {
      // setCredentials(selectedGateway.credentials || {});
      setCredentials({});
      setIsEditing(false);
    }
  }, [selectedGateway]);

  const openManageDialog = (gateway) => {
    if (!gateway.isEnabled) {
      toast.error(t('superadmin_payment_gateways.this_payment_gateway_is_coming_soon'));
      return;
    }
    setSelectedGateway(gateway);
    // setCredentials(gateway.credentials || {});
    setCredentials({});
    setIsEditing(true);
    if (manageDialogRef.current) {
      manageDialogRef.current.showModal();
    }
  };

  const closeManageDialog = () => {
    if (manageDialogRef.current) {
      manageDialogRef.current.close();
    }
    setIsEditing(false);
    if (selectedGateway) {
      // setCredentials(selectedGateway.credentials || {});
      setCredentials({});
    }
  };

  const fetchGateways = async () => {
    try {
      setLoading(true);
      const res = await getPaymentGateways();
      const gatewaysData = res.data.data || res.data || [];

      // Convert array to object keyed by gateway name for easy lookup
      const gatewaysMap = {};
      gatewaysData.forEach((gw) => {
        gatewaysMap[gw.gateway_name] = {
          enabled: !!gw.status,
          credentials: gw.credentials || {},
        };
      });
      setStoredGateways(gatewaysMap);

      // Get all gateways from config and merge with API data
      const configGateways = getAllPaymentGateways();
      const mergedGateways = configGateways.map((configGw) => {
        const stored = gatewaysMap[configGw.name];
        return {
          ...configGw,
          enabled: stored ? stored.enabled : false,
          credentials: stored ? stored.credentials : {},
        };
      });

      setAllGateways(mergedGateways);
      if (mergedGateways.length > 0 && !selectedGateway) {
        setSelectedGateway(mergedGateways[0]);
      }
    } catch (error) {
      console.error("Error fetching gateways:", error);
      // Fallback to config gateways only
      const configGateways = getAllPaymentGateways();
      const fallbackGateways = configGateways.map((gw) => ({
        ...gw,
        enabled: false,
        credentials: {},
      }));
      setAllGateways(fallbackGateways);
      if (fallbackGateways.length > 0 && !selectedGateway) {
        setSelectedGateway(fallbackGateways[0]);
      }
      toast.error(t('superadmin_payment_gateways.failed_to_load_payment_gateways'));
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (gateway) => {
    // Don't allow toggling if gateway is not enabled in config
    if (!gateway.isEnabled) {
      toast.error(t('superadmin_payment_gateways.this_payment_gateway_is_coming_soon'));
      return;
    }

    try {
      const newStatus = !gateway.enabled;
      toast.loading(t('superadmin_payment_gateways.updating_status'));

      await updatePaymentGatewayStatus(gateway.name, newStatus);

      // Update local state
      const updatedGateways = allGateways.map((g) =>
        g.name === gateway.name ? { ...g, enabled: newStatus } : g
      );
      setAllGateways(updatedGateways);

      if (selectedGateway?.name === gateway.name) {
        setSelectedGateway({ ...selectedGateway, enabled: newStatus });
      }

      // Update stored gateways map
      setStoredGateways((prev) => ({
        ...prev,
        [gateway.name]: {
          ...prev[gateway.name],
          enabled: newStatus,
        },
      }));

      toast.dismiss();
      toast.success(t('superadmin_payment_gateways.update_status_success'));
      fetchGateways();
    } catch (error) {
      toast.dismiss();
      toast.error(error.response?.data?.message || t('superadmin_payment_gateways.update_status_error'));
    }
  };

  const handleUpdateCredentials = async () => {
    if (!selectedGateway) return;

    // Don't allow updating credentials if gateway is not enabled in config
    if (!selectedGateway.isEnabled) {
      toast.error(t('superadmin_payment_gateways.this_payment_gateway_is_coming_soon'));
      return;
    }

    
    // ✅ 1. SEND ONLY REAL USER INPUT
    const payload = Object.fromEntries(
      Object.entries(credentials).filter(
        ([_, value]) => value && value.trim() !== ""
      )
    );

    if (Object.keys(payload).length === 0) {
      toast.error(t('superadmin_payment_gateways.no_changes_to_save_for_this_payment_gateway'));
      return;
    }

    console.log(payload)


    try {
      toast.loading(t('superadmin_payment_gateways.updating_credentials'));

      // await updatePaymentGatewayCredentials(selectedGateway.name, credentials);
      await updatePaymentGatewayCredentials(selectedGateway.name, payload);

      // Update local state
      const updatedGateway = { ...selectedGateway, credentials };
      const updatedGateways = allGateways.map((g) =>
        g.name === selectedGateway.name ? updatedGateway : g
      );
      setAllGateways(updatedGateways);
      setSelectedGateway(updatedGateway);
      setIsEditing(false);

      // Update stored gateways map
      setStoredGateways((prev) => ({
        ...prev,
        [selectedGateway.name]: {
          ...prev[selectedGateway.name],
          credentials: credentials,
        },
      }));

      toast.dismiss();
      toast.success(t('superadmin_payment_gateways.update_credentials_success'));

      // ✅ 2. CLEAR LOCAL STATE (never store secrets)
      setCredentials({});

      // ✅ 3. REFRESH FROM BACKEND (sanitized response)
      await fetchGateways();
      closeManageDialog();
    } catch (error) {
      toast.dismiss();
      toast.error(
        error.response?.data?.message || t('superadmin_payment_gateways.update_credentials_error')
      );
    }
  };

  const hasCredentialChanges = () => {
    if (!selectedGateway) return false;
    const original = selectedGateway.credentials || {};
    try {
      return JSON.stringify(original) !== JSON.stringify(credentials || {});
    } catch {
      return true;
    }
  };

  const openConfirmDialog = () => {
    if (confirmDialogRef.current) {
      confirmDialogRef.current.showModal();
    }
  };

  const closeConfirmDialog = () => {
    if (confirmDialogRef.current) {
      confirmDialogRef.current.close();
    }
  };

  const handleSaveClick = () => {
    if (!selectedGateway) return;

    if (!selectedGateway.isEnabled) {
      toast.error(t('superadmin_payment_gateways.this_payment_gateway_is_coming_soon'));
      return;
    }

    if (!hasCredentialChanges()) {
      toast.error(t('superadmin_payment_gateways.no_changes_to_save_for_this_payment_gateway'));
      return;
    }

    openConfirmDialog();
  };

  const getDomainFromWebsite = (website) => {
    if (!website) return "";
    try {
      const url = new URL(website);
      return url.hostname.replace("www.", "");
    } catch {
      return website
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0];
    }
  };

  const getCredentialFields = (gatewayName) => {
    return getPaymentGatewayCredentials(gatewayName);
  };

  if (loading && allGateways.length === 0) {
    return (
      <Page className="px-2 sm:px-4 py-3 overflow-x-hidden h-full">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-restro-green border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground text-sm">
              {t('superadmin_payment_gateways.loading_payment_gateways')}
            </p>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page className="px-2 sm:px-4 py-3 overflow-x-hidden h-full">
      <div className="flex justify-between items-center mb-6 mt-6">
        <h1 className="text-2xl font-semibold">{t('superadmin_payment_gateways.title')}</h1>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {allGateways.map((gateway) => {
          const gatewayConfig = getPaymentGateway(gateway.name);
          const domain = gatewayConfig?.website
            ? getDomainFromWebsite(gatewayConfig.website)
            : "";
          const isConfigEnabled = gateway.isEnabled;
          const isStoredEnabled = gateway.enabled;

          return (
            <div
              key={gateway.name}
              className={clsx(
                "bg-white dark:bg-black border border-restro-border-green rounded-2xl p-5 lg:p-6 flex flex-col transition-all duration-200"
              )}
            >
              {/* Header with Toggle */}
              <div className="flex items-start justify-between mb-4">
                {/* Logo */}
                <div
                  className={clsx(
                    "w-12 h-12 lg:w-14 lg:h-14 rounded-xl bg-white dark:bg-white flex items-center justify-center flex-shrink-0 p-2 border border-restro-border-green",
                    {
                      "blur-sm": !isConfigEnabled,
                    }
                  )}
                >
                  {getPaymentGatewayIcon(gateway.name, 40)}
                </div>
                {/* Toggle Switch */}
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isStoredEnabled && isConfigEnabled}
                    onChange={() => handleToggle(gateway)}
                    disabled={!isConfigEnabled}
                    className="sr-only peer"
                  />
                  <div
                    className={clsx(
                      "w-11 h-6 rounded-full relative transition-all duration-200",
                      {
                        "bg-restro-green": isStoredEnabled && isConfigEnabled,
                        "bg-gray-300 dark:bg-gray-600":
                          !isStoredEnabled || !isConfigEnabled,
                        "cursor-not-allowed": !isConfigEnabled,
                      }
                    )}
                  >
                    <div
                      className={clsx(
                        "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200",
                        {
                          "translate-x-5": isStoredEnabled && isConfigEnabled,
                        }
                      )}
                    />
                  </div>
                </label>
              </div>

              {/* Domain */}
              {domain && (
                <div className="flex items-center gap-1 mb-2">
                  <a
                    href={gatewayConfig.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-restro-green transition-colors flex items-center gap-1"
                    onClick={(e) => {
                      if (!isConfigEnabled) {
                        e.preventDefault();
                      }
                    }}
                  >
                    {domain}
                    <IconExternalLink size={12} stroke={iconStroke} />
                  </a>
                </div>
              )}

              {/* Name */}
              <h3 className="text-lg font-semibold mb-2">
                {getPaymentGatewayName(gateway.name)}
              </h3>

              {/* Description */}
              <p className="text-sm text-muted-foreground mb-4 flex-1">
                {gateway.description ||
                  gatewayConfig?.description ||
                  "Configure payment gateway settings"}
              </p>

              {/* Manage Button */}
              <button
                onClick={() => openManageDialog(gateway)}
                disabled={!isConfigEnabled}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 text-sm font-medium w-full justify-center",
                  {
                    "bg-restro-gray dark:bg-restro-gray hover:bg-restro-button-hover text-foreground":
                      isConfigEnabled,
                    "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed":
                      !isConfigEnabled,
                  }
                )}
              >
                <IconSettings size={16} stroke={iconStroke} />
                {t('superadmin_payment_gateways.manage')}
              </button>
            </div>
          );
        })}
      </div>

      {/* Manage Dialog */}
      <dialog
        ref={manageDialogRef}
        id="modal-manage-gateway"
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <div
            onClick={closeManageDialog}
            className={`absolute inset-0 backdrop-blur-sm transition-opacity ${
              theme === "light" ? "bg-black/40" : "bg-black/60"
            }`}
          />

          {/* Modal */}
          {selectedGateway && (
            <div
              className={`relative w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl border transition-all ${
                theme === "light"
                  ? "bg-white border-restro-border-green"
                  : "bg-restro-card-bg border-restro-border-green"
              }`}
            >
              {/* Header */}
              <div
                className={`sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b backdrop-blur-md ${
                  theme === "light"
                    ? "bg-white/95 border-restro-border-green"
                    : "bg-restro-card-bg/95 border-restro-border-green"
                }`}
              >
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center p-2 border flex-shrink-0 ${
                      theme === "light"
                        ? "bg-white border-restro-green shadow-sm"
                        : "bg-restro-card-bg border-restro-green"
                    }`}
                  >
                    {getPaymentGatewayIcon(selectedGateway.name, 40)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3
                      className={`font-bold text-xl sm:text-2xl truncate ${
                        theme === "light" ? "text-gray-900" : "text-restro-text"
                      }`}
                    >
                      {getPaymentGatewayName(selectedGateway.name)}
                    </h3>
                    <p
                      className={`text-xs sm:text-sm mt-0.5 ${
                        theme === "light" ? "text-gray-500" : "text-gray-400"
                      }`}
                    >
                      {t('superadmin_payment_gateways.manage_api_credentials')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeManageDialog}
                  className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ml-2 ${
                    theme === "light"
                      ? "hover:bg-restro-gray text-gray-600"
                      : "hover:bg-restro-gray text-gray-400"
                  }`}
                  aria-label="Close"
                >
                  <IconX size={20} stroke={iconStroke} />
                </button>
              </div>

              {/* Body */}
              <div
                className={`overflow-y-auto max-h-[calc(95vh-200px)] sm:max-h-[calc(90vh-200px)] px-4 sm:px-6 py-4 sm:py-6 ${
                  theme === "light" ? "bg-white" : "bg-restro-card-bg"
                }`}
              >
                {/* Fields */}
                <div className="space-y-4 sm:space-y-5">
                  {getCredentialFields(selectedGateway.name).map((field) => (
                    <div key={field.key} className="space-y-1.5">
                    <div className="flex items-center">
                     <label
                        className={`text-sm sm:text-[15px] font-medium flex items-center gap-1 ${
                          theme === "light"
                            ? "text-gray-900"
                            : "text-restro-text"
                        }`}
                      >
                        {field.label}
                        {field.required && (
                          <span className="text-red-500 text-base">*</span>
                        )}
                      </label>
                      {selectedGateway.credentials?.[field.key] === "configured" && (
                        <span className="ml-2 text-xs text-green-600">✓ Configured</span>
                      )}
                    </div>
                     
                      {field.type === "select" ? (
                        <select
                          value={credentials[field.key] || ""}
                          onChange={(e) =>
                            setCredentials({
                              ...credentials,
                              [field.key]: e.target.value,
                            })
                          }
                          className={`w-full h-11 border rounded-lg px-3 outline-none focus:ring-2 focus:ring-restro-green/50 focus:border-transparent transition-all ${
                            theme === "light"
                              ? "bg-restro-gray border-restro-border-green text-gray-900"
                              : "bg-restro-gray border-restro-border-green text-restro-text"
                          }`}
                        >
                          <option value="">
                            {field.placeholder || "Select an option"}
                          </option>
                          {field.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          value={credentials[field.key] || ""}
                          autoComplete="off"
                          onChange={(e) =>
                            setCredentials({
                              ...credentials,
                              [field.key]: e.target.value,
                            })
                          }
                          className={`w-full h-11 border rounded-lg px-3 outline-none focus:ring-2 focus:ring-restro-green/50 focus:border-transparent transition-all ${
                            theme === "light"
                              ? "bg-restro-gray border-restro-border-green text-gray-900 placeholder-gray-400"
                              : "bg-restro-gray border-restro-border-green text-restro-text placeholder-gray-500"
                          }`}
                          // placeholder={
                          //   field.placeholder ||
                          //   `Enter ${field.label.toLowerCase()}`
                          // }
                          placeholder={
                            selectedGateway.credentials?.[field.key] === "configured"
                              ? "••••••••"           // ✅ UI hint only
                              : field.placeholder
                          }
                        />
                        
                      )}
                      {field.description && (
                        <p
                          className={`text-xs mt-0.5 pl-0.5 ${
                            theme === "light"
                              ? "text-gray-500"
                              : "text-gray-400"
                          }`}
                        >
                          {field.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Webhook URL */}
                {(() => {
                  const gatewayConfig = getPaymentGateway(selectedGateway.name);
                  const webhookUrl = gatewayConfig?.webhookUrl || "";
                  return webhookUrl ? (
                    <div className="mt-5 sm:mt-6">
                      <label
                        className={`text-sm sm:text-[15px] font-medium block mb-2 ${
                          theme === "light"
                            ? "text-gray-900"
                            : "text-restro-text"
                        }`}
                      >
                        {t('superadmin_payment_gateways.webhook_url')}
                      </label>
                      <div
                        className={`flex items-center gap-2 border rounded-lg px-3 sm:px-4 py-2.5 ${
                          theme === "light"
                            ? "bg-restro-gray border-restro-border-green"
                            : "bg-restro-gray border-restro-border-green"
                        }`}
                      >
                        <span
                          className={`text-xs sm:text-sm select-all flex-1 min-w-0 truncate ${
                            theme === "light"
                              ? "text-gray-600"
                              : "text-gray-400"
                          }`}
                          title={webhookUrl}
                        >
                          {webhookUrl}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(webhookUrl);
                            toast.success(t('superadmin_payment_gateways.webhook_url_copied_to_clipboard'));
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-restro-green/10 hover:bg-restro-green/20 text-restro-green text-xs font-medium transition-all flex-shrink-0 active:scale-95"
                          title="Copy to clipboard"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <rect
                              x="9"
                              y="9"
                              width="13"
                              height="13"
                              rx="2"
                              strokeWidth="2"
                            />
                            <rect
                              x="3"
                              y="3"
                              width="13"
                              height="13"
                              rx="2"
                              strokeWidth="2"
                            />
                          </svg>
                          <span className="hidden sm:inline">{t('superadmin_payment_gateways.copy')}</span>
                        </button>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Footer */}
              <div
                className={`sticky bottom-0 z-10 flex items-center justify-end gap-3 px-4 sm:px-6 py-4 sm:py-5 border-t backdrop-blur-md ${
                  theme === "light"
                    ? "bg-white/95 border-restro-border-green"
                    : "bg-restro-card-bg/95 border-restro-border-green"
                }`}
              >
                <button
                  onClick={closeManageDialog}
                  className={`h-10 sm:h-11 px-4 sm:px-5 rounded-xl font-medium transition-all active:scale-95 ${
                    theme === "light"
                      ? "bg-restro-gray hover:bg-restro-button-hover text-gray-700 border border-restro-border-green"
                      : "bg-restro-gray hover:bg-restro-button-hover text-restro-text border border-restro-border-green"
                  }`}
                >
                  {t('superadmin_payment_gateways.cancel')}
                </button>
                <button
                  onClick={handleSaveClick}
                  className={`h-10 sm:h-11 px-5 sm:px-6 rounded-xl font-semibold text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover transition-all active:scale-95`}
                >
                  {t('superadmin_payment_gateways.save')}
                </button>
              </div>
            </div>
          )}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={closeManageDialog}>{t('superadmin_payment_gateways.close')}</button>
        </form>
      </dialog>
      {/* Confirm Update Credentials Dialog */}
      <dialog
        ref={confirmDialogRef}
        id="modal-confirm-update-gateway"
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <div
            onClick={closeConfirmDialog}
            className={`absolute inset-0 backdrop-blur-sm transition-opacity ${
              theme === "light" ? "bg-black/40" : "bg-black/60"
            }`}
          />

          <div
            className={`relative w-full max-w-md overflow-hidden rounded-2xl shadow-2xl border transition-all ${
              theme === "light"
                ? "bg-white border-red-200"
                : "bg-restro-card-bg border-red-500/40"
            }`}
          >
            <div
              className={`px-4 sm:px-6 py-4 sm:py-5 border-b flex items-center gap-3 ${
                theme === "light"
                  ? "bg-red-50 border-red-100"
                  : "bg-red-950/40 border-red-900/40"
              }`}
            >
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-red-500/10 text-red-600">
                <IconLock size={20} stroke={iconStroke} />
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  className={`font-semibold text-base sm:text-lg truncate ${
                    theme === "light" ? "text-red-700" : "text-red-300"
                  }`}
                >
                  {t('superadmin_payment_gateways.update_warning.title')}
                </h3>
                <p
                  className={`text-xs sm:text-sm mt-0.5 ${
                    theme === "light" ? "text-red-600" : "text-red-400"
                  }`}
                >
                  {t('superadmin_payment_gateways.update_warning.description')}
                </p>
              </div>
            </div>

            <div
              className={`px-4 sm:px-6 py-4 sm:py-5 text-sm space-y-3 ${
                theme === "light" ? "bg-white" : "bg-restro-card-bg"
              }`}
            >
              <p
                className={
                  theme === "light" ? "text-gray-700" : "text-restro-text"
                }
              >
               {t('superadmin_payment_gateways.update_warning.warning_title')}
                <span className="font-semibold text-red-600">
                  {t('superadmin_payment_gateways.update_warning.warning_description')}
                </span>
              </p>
              <ul
                className={`list-disc list-inside space-y-1 ${
                  theme === "light" ? "text-gray-700" : "text-gray-300"
                }`}
              >
                <li>{t('superadmin_payment_gateways.update_warning.warning_2_title')}</li>
                <li>
                  {t('superadmin_payment_gateways.update_warning.warning_2_description')}
                </li>
                <li>
                  {t('superadmin_payment_gateways.update_warning.warning_3_title')}
                </li>
              </ul>
              <p
                className={
                  theme === "light" ? "text-gray-700" : "text-gray-300"
                }
              >
                {t('superadmin_payment_gateways.update_warning.warning_3_description')}
              </p>
            </div>

            <div
              className={`px-4 sm:px-6 py-3 sm:py-4 border-t flex items-center justify-end gap-3 backdrop-blur-md ${
                theme === "light"
                  ? "bg-white/95 border-red-100"
                  : "bg-restro-card-bg/95 border-red-900/40"
              }`}
            >
              <button
                type="button"
                onClick={closeConfirmDialog}
                className={`h-9 sm:h-10 px-4 sm:px-5 rounded-xl font-medium transition-all active:scale-95 ${
                  theme === "light"
                    ? "bg-restro-gray hover:bg-restro-button-hover text-gray-700 border border-restro-border-green"
                    : "bg-restro-gray hover:bg-restro-button-hover text-restro-text border border-restro-border-green"
                }`}
              >
                {t('superadmin_payment_gateways.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  closeConfirmDialog();
                  handleUpdateCredentials();
                }}
                className="h-9 sm:h-10 px-5 sm:px-6 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 border border-red-500/70 transition-all active:scale-95"
              >
                {t('superadmin_payment_gateways.yes_update')}
              </button>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={closeConfirmDialog}>{t('superadmin_payment_gateways.close')}</button>
        </form>
      </dialog>
    </Page>
  );
}
