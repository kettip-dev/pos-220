import React, { useRef, useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Page from "../../components/Page";
import { CURRENCIES } from "../../config/currencies.config";
import {
  saveStoreSettings,
  useStoreSettings,
  uploadStoreImage,
  deleteStoreImage,
} from "../../controllers/settings.controller";
import { toast } from "react-hot-toast";
import { mutate } from "swr";
import Popover from "../../components/Popover";
import {
  IconBuildingStore,
  IconPhoto,
  IconUpload,
  IconTrash,
  IconCopy,
  IconCheck,
  IconPhone,
  IconMail,
  IconMapPin,
  IconCoins,
  IconReceipt2,
  IconQrcode,
  IconExternalLink,
  IconDownload,
  IconDeviceFloppy,
  IconClock,
  IconCash,
  IconArrowsExchange,
  IconSparkles,
  IconChevronDown,
  IconChefHat,
} from "@tabler/icons-react";
import QRCode from "qrcode";
import { getQRMenuLink } from "../../helpers/QRMenuHelper";
import imageCompression from "browser-image-compression";
import { getImageURL } from "../../helpers/ImageHelper";
import { useTheme } from "../../contexts/ThemeContext";
import { getUserDetailsInLocalStorage } from "../../helpers/UserDetails";
import { PLAN_FEATURES } from "../../config/scopes";
import useConfirm from "../../hooks/useConfirm";

export default function SettingDetailsPage() {
  const { t } = useTranslation();
  const [confirm, ConfirmDialog] = useConfirm();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const user = getUserDetailsInLocalStorage();
  const { planFeautures } = user || {};
  const userPlanFeatures = Array.isArray(planFeautures)
    ? planFeautures
    : planFeautures?.split(",") || [];

  const isQrMenuAccess = userPlanFeatures?.includes(PLAN_FEATURES?.QRMENU);

  const { APIURL, data, error, isLoading } = useStoreSettings();

  // Form State
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState(4100);
  const [isQRMenuEnabled, setIsQRMenuEnabled] = useState(false);
  const [isQROrderEnabled, setIsQROrderEnabled] = useState(false);
  const [isQROrderAutoKitchen, setIsQROrderAutoKitchen] = useState(false);
  const [isFeedbackEnabled, setIsFeedbackEnabled] = useState(false);
  const [posPaymentMode, setPosPaymentMode] = useState("flexible");
  const [isKitchenEnabled, setIsKitchenEnabled] = useState(true);

  // Local Image State & Preview
  const [localImagePreview, setLocalImagePreview] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Initialize form state when server data is loaded
  useEffect(() => {
    if (data) {
      setStoreName(data.storeName || "");
      setAddress(data.address || "");
      setEmail(data.email || "");
      setPhone(data.phone || "");
      setCurrency(data.currency || "USD");
      setExchangeRate(Number(data.exchangeRateUsdToKhr) || 4100);
      setIsQRMenuEnabled(Boolean(data.isQRMenuEnabled));
      setIsQROrderEnabled(Boolean(data.isQROrderEnabled));
      setIsQROrderAutoKitchen(Boolean(data.isQROrderAutoKitchen));
      setIsFeedbackEnabled(Boolean(data.isFeedbackEnabled));
      setPosPaymentMode(data.posPaymentMode || "flexible");
      setIsKitchenEnabled(data.isKitchenEnabled !== false);
    }
  }, [data]);

  // Dirty State Checker
  const isDirty = useMemo(() => {
    if (!data) return false;
    return (
      storeName !== (data.storeName || "") ||
      address !== (data.address || "") ||
      email !== (data.email || "") ||
      phone !== (data.phone || "") ||
      currency !== (data.currency || "USD") ||
      Number(exchangeRate) !== (Number(data.exchangeRateUsdToKhr) || 4100) ||
      Boolean(isQRMenuEnabled) !== Boolean(data.isQRMenuEnabled) ||
      Boolean(isQROrderEnabled) !== Boolean(data.isQROrderEnabled) ||
      Boolean(isQROrderAutoKitchen) !== Boolean(data.isQROrderAutoKitchen) ||
      Boolean(isFeedbackEnabled) !== Boolean(data.isFeedbackEnabled) ||
      posPaymentMode !== (data.posPaymentMode || "flexible") ||
      Boolean(isKitchenEnabled) !== (data.isKitchenEnabled !== false)
    );
  }, [
    data,
    storeName,
    address,
    email,
    phone,
    currency,
    exchangeRate,
    isQRMenuEnabled,
    isQROrderEnabled,
    isQROrderAutoKitchen,
    isFeedbackEnabled,
    posPaymentMode,
    isKitchenEnabled,
  ]);

  if (isLoading) {
    return (
      <Page className="px-4 sm:px-8 py-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4 text-gray-500">
            <span className="loading loading-spinner loading-lg text-[#22C55E]"></span>
            <p className="text-sm font-medium tracking-wide">
              {t("settings.please_wait", "Loading store settings...")}
            </p>
          </div>
        </div>
      </Page>
    );
  }

  if (error) {
    console.error(error);
    return (
      <Page className="px-4 sm:px-8 py-8 max-w-4xl mx-auto">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-2xl p-6 text-center text-sm shadow-xs">
          <p className="font-semibold text-base mb-1">{t("settings.error_loading_data", "Failed to load store settings")}</p>
          <p className="text-xs text-red-500/80">Please check your network connection or reload the page.</p>
        </div>
      </Page>
    );
  }

  const { storeImage, uniqueQRCode, uniqueId } = data || {};
  const currentLogoSrc = localImagePreview || (storeImage ? getImageURL(storeImage) : null);
  const QR_MENU_LINK = getQRMenuLink(uniqueQRCode);

  // Discard all changes
  const handleDiscard = () => {
    if (!data) return;
    setStoreName(data.storeName || "");
    setAddress(data.address || "");
    setEmail(data.email || "");
    setPhone(data.phone || "");
    setCurrency(data.currency || "USD");
    setExchangeRate(Number(data.exchangeRateUsdToKhr) || 4100);
    setIsQRMenuEnabled(Boolean(data.isQRMenuEnabled));
    setIsQROrderEnabled(Boolean(data.isQROrderEnabled));
    setIsQROrderAutoKitchen(Boolean(data.isQROrderAutoKitchen));
    setIsFeedbackEnabled(Boolean(data.isFeedbackEnabled));
    setPosPaymentMode(data.posPaymentMode || "flexible");
    setLocalImagePreview(null);
    toast.success(t("settings.changes_discarded", "Changes discarded"));
  };

  // Save Settings
  const btnSave = async () => {
    if (!storeName.trim()) {
      toast.error(t("settings.store_name_required", "Store name is required"));
      return;
    }

    try {
      setIsSaving(true);
      toast.loading(t("settings.please_wait", "Saving settings..."));

      const res = await saveStoreSettings(
        storeName.trim(),
        address.trim(),
        phone.trim(),
        email.trim(),
        currency,
        null,
        isQRMenuEnabled,
        isQROrderEnabled,
        isFeedbackEnabled,
        Number(exchangeRate) || 4100,
        isQROrderAutoKitchen,
        posPaymentMode,
        isKitchenEnabled,
      );

      if (res.status === 200) {
        await mutate(APIURL);
        toast.dismiss();
        toast.success(res.data.message || t("settings.saved_successfully", "Settings saved successfully!"));
      }
    } catch (err) {
      console.error(err);
      toast.dismiss();
      const message = err?.response?.data?.message || t("settings.something_went_wrong", "Something went wrong");
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Upload Logo
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingImage(true);
      toast.loading(t("settings.uploading_image", "Uploading store logo..."));

      const compressedImage = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 512,
        useWebWorker: true,
      });

      // Show immediate local preview
      const previewUrl = URL.createObjectURL(compressedImage);
      setLocalImagePreview(previewUrl);

      const formData = new FormData();
      formData.append("store_image", compressedImage);

      const res = await uploadStoreImage(formData);
      if (res.status === 200) {
        toast.dismiss();
        toast.success(res.data.message || t("settings.image_uploaded", "Logo updated successfully!"));
        await mutate(APIURL);
      }
    } catch (err) {
      console.error(err);
      toast.dismiss();
      const message = err?.response?.data?.message || t("settings.something_went_wrong", "Upload failed");
      toast.error(message);
      setLocalImagePreview(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Delete Logo
  const handleFileDelete = async () => {
    if (!(await confirm({ title: t("settings.remove_logo_title", "Remove Logo"), description: t("settings.confirm_delete_logo", "Are you sure you want to remove the store logo?"), confirmText: t("common.remove", "Remove") }))) {
      return;
    }

    try {
      toast.loading(t("settings.please_wait", "Removing logo..."));
      const res = await deleteStoreImage(uniqueId);
      if (res.status === 200) {
        setLocalImagePreview(null);
        toast.dismiss();
        toast.success(res.data.message || t("settings.logo_deleted", "Logo removed"));
        await mutate(APIURL);
      }
    } catch (err) {
      console.error(err);
      toast.dismiss();
      const message = err?.response?.data?.message || t("settings.something_went_wrong", "Delete failed");
      toast.error(message);
    }
  };

  // Download QR Code
  const btnDownloadMenuQR = async () => {
    try {
      const qrDataURL = await QRCode.toDataURL(QR_MENU_LINK, {
        width: 1200,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      const link = document.createElement("a");
      link.download = `${storeName.replace(/\s+/g, "_") || "store"}_menu_qr.png`;
      link.href = qrDataURL;
      link.click();
      link.remove();
      toast.success(t("settings.qr_downloaded", "QR Code downloaded!"));
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate QR code");
    }
  };

  // Copy Menu URL
  const btnCopyMenuLink = async () => {
    try {
      await navigator.clipboard.writeText(QR_MENU_LINK);
      setCopiedLink(true);
      toast.success(t("settings.link_copied", "Menu link copied to clipboard!"));
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error(err);
      toast.error("Failed to copy link");
    }
  };

  // Handle plan restriction check on QR features
  const handleToggleChange = (feature, newValue) => {
    if (!isQrMenuAccess && ["qrmenu", "qrorder", "qrorder_auto_kitchen"].includes(feature)) {
      document.getElementById("modal-upgrade-required")?.showModal();
      return;
    }

    switch (feature) {
      case "qrmenu":
        setIsQRMenuEnabled(newValue);
        break;
      case "qrorder":
        setIsQROrderEnabled(newValue);
        break;
      case "qrorder_auto_kitchen":
        setIsQROrderAutoKitchen(newValue);
        break;
      case "feedback":
        setIsFeedbackEnabled(newValue);
        break;
      default:
        break;
    }
  };

  const handleUpgradeClick = () => {
    document.getElementById("modal-upgrade-required")?.close();
    navigate("/dashboard/profile");
  };

  return (
    <Page className="px-4 sm:px-8 py-6 max-w-4xl mx-auto">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
            <span>Settings</span>
            <span>/</span>
            <span>Store Operations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
              <IconBuildingStore size={26} stroke={1.8} />
            </span>
            {t("settings.store_details", "Store Details & Operations")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
            Configure your restaurant branding, dual-currency cash rates, POS billing workflow, and customer self-ordering.
          </p>
        </div>

        {/* Status Chip */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {isDirty ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Unsaved Changes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <IconCheck size={14} stroke={2.2} />
              Up to date
            </span>
          )}
        </div>
      </div>

      {/* 5 LOGICAL SETTINGS SECTIONS */}
      <div className="space-y-6 pb-28">
        {/* SECTION 1: BRAND IDENTITY & LOGO */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200/80 dark:border-neutral-800 rounded-2xl p-6 shadow-xs hover:border-gray-300 dark:hover:border-neutral-700 transition-all">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-gray-100 dark:border-neutral-800">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <IconPhoto size={18} stroke={2} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("settings.brand_identity", "Brand Identity & Logo")}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Displayed on customer receipts, customer digital menus, and POS terminals.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
            {/* Logo Upload Box */}
            <div className="sm:col-span-4 flex flex-col items-center">
              <div className="relative w-40 h-40 aspect-square rounded-2xl bg-gray-50 dark:bg-neutral-800/60 border-2 border-dashed border-emerald-500/40 hover:border-emerald-500 transition-all duration-200 flex flex-col items-center justify-center p-2 group shadow-xs">
                <input
                  type="file"
                  name="storeImage"
                  id="storeImage"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isUploadingImage}
                />

                {currentLogoSrc ? (
                  <label
                    htmlFor="storeImage"
                    className="w-full h-full flex items-center justify-center overflow-hidden rounded-xl cursor-pointer relative group"
                    title={t("settings.click_to_change", "Click to change logo")}
                  >
                    <img
                      src={currentLogoSrc}
                      alt="Store Logo"
                      className="w-full h-full object-contain rounded-xl bg-white dark:bg-neutral-900 p-1"
                    />
                    <div className="absolute inset-0 bg-black/45 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 text-xs font-medium backdrop-blur-xs">
                      <IconUpload size={20} stroke={2} />
                      <span>Change Logo</span>
                    </div>
                  </label>
                ) : (
                  <label
                    htmlFor="storeImage"
                    className="w-full h-full flex flex-col items-center justify-center cursor-pointer gap-2.5 p-3 text-center"
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                      <IconUpload size={22} stroke={2} />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">
                        Upload Logo
                      </span>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 block">
                        500 × 500 px
                      </span>
                    </div>
                  </label>
                )}

                {/* Remove Button if Logo Present */}
                {currentLogoSrc && (
                  <button
                    type="button"
                    onClick={handleFileDelete}
                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white dark:bg-neutral-800 text-red-500 border border-red-200 dark:border-red-900 shadow-md flex items-center justify-center cursor-pointer hover:bg-red-500 hover:text-white transition-all active:scale-95 z-10"
                    title={t("settings.delete_logo", "Remove Logo")}
                  >
                    <IconTrash size={14} stroke={2} />
                  </button>
                )}
              </div>
              <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 text-center">
                PNG, JPG or WebP up to 2MB
              </span>
            </div>

            {/* Store Name Input */}
            <div className="sm:col-span-8 space-y-4">
              <div>
                <label htmlFor="storeName" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  {t("settings.store_name", "Store / Restaurant Name")} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="storeName"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder={t("settings.store_name_placeholder", "e.g. The Rustic Fork & Bistro")}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none transition-all placeholder:text-gray-400"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  This official name appears on customer bills, digital menus, and kitchen tickets.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: LOCATION & CONTACT */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200/80 dark:border-neutral-800 rounded-2xl p-6 shadow-xs hover:border-gray-300 dark:hover:border-neutral-700 transition-all">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-gray-100 dark:border-neutral-800">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <IconMapPin size={18} stroke={2} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("settings.contact_location", "Contact & Location")}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Customer reachability, receipt contact details, and location.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Address */}
            <div>
              <label htmlFor="address" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                {t("settings.address", "Store Address / Location")}
              </label>
              <div className="relative">
                <textarea
                  id="address"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t("settings.address_placeholder", "Street address, Building / Floor, City, Country")}
                  className="w-full min-h-[76px] px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none transition-all resize-y placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Phone & Email Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  {t("settings.phone", "Contact Phone")}
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-gray-400 dark:text-neutral-500 pointer-events-none">
                    <IconPhone size={18} stroke={1.8} />
                  </span>
                  <input
                    type="tel"
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("settings.phone_placeholder", "+855 12 345 678")}
                    className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none transition-all placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  {t("settings.email", "Store Email Address")}
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-gray-400 dark:text-neutral-500 pointer-events-none">
                    <IconMail size={18} stroke={1.8} />
                  </span>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("settings.email_placeholder", "contact@restaurant.com")}
                    className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none transition-all placeholder:text-gray-400"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: DUAL-CURRENCY & EXCHANGE OPERATIONS */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200/80 dark:border-neutral-800 rounded-2xl p-6 shadow-xs hover:border-gray-300 dark:hover:border-neutral-700 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-5 border-b border-gray-100 dark:border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <IconCoins size={18} stroke={2} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  {t("settings.currency_operations", "Currency & Dual-Currency Operations")}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Set your store accounting currency and Cambodia Riel (KHR) cash exchange rate.
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0 self-start sm:self-auto">
              <IconSparkles size={13} stroke={2} />
              Dual-Currency POS
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Primary Currency */}
            <div>
              <label htmlFor="currency" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                {t("settings.currency", "Primary Store Currency")}
              </label>
              <div className="relative">
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full min-h-[44px] pl-3.5 pr-10 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="USD">USD - US Dollar ($)</option>
                  <option value="KHR">KHR - Cambodian Riel (៛)</option>
                  <option disabled>──────────</option>
                  {CURRENCIES.filter((c) => !["USD", "KHR"].includes(c.cc)).map((item, idx) => (
                    <option value={item.cc} key={idx}>
                      {item.cc} - {item.name} ({item.symbol})
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <IconChevronDown size={18} stroke={2} />
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Base unit for product pricing, ledger, and sales reports.
              </p>
            </div>

            {/* Cash Exchange Rate (1 USD to KHR) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="exchangeRate" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  {t("settings.exchange_rate_khr", "Cash Exchange Rate (1 USD to KHR)")}
                </label>
                <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  $1.00 = {Number(exchangeRate || 4100).toLocaleString()} ៛
                </span>
              </div>

              <div className="relative flex items-center">
                <input
                  type="number"
                  id="exchangeRate"
                  step="10"
                  min="1000"
                  max="10000"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(Number(e.target.value))}
                  placeholder="4100"
                  className="w-full min-h-[44px] pl-3.5 pr-14 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 text-sm font-mono font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none transition-all"
                />
                <span className="absolute right-3.5 text-xs font-bold text-gray-400 dark:text-neutral-500 font-mono pointer-events-none">
                  ៛ / $
                </span>
              </div>

              {/* Quick Presets for Cambodia Market */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[10px] uppercase font-semibold text-gray-400 mr-1">Presets:</span>
                {[4000, 4100, 4150, 4200].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setExchangeRate(rate)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all active:scale-95 cursor-pointer ${
                      Number(exchangeRate) === rate
                        ? "bg-emerald-600 text-white shadow-xs font-semibold"
                        : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700 border border-gray-200 dark:border-neutral-700"
                    }`}
                  >
                    {rate.toLocaleString()} ៛
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: POS BILLING & PAYMENT WORKFLOW */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200/80 dark:border-neutral-800 rounded-2xl p-6 shadow-xs hover:border-gray-300 dark:hover:border-neutral-700 transition-all">
          <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-gray-100 dark:border-neutral-800">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <IconReceipt2 size={18} stroke={2} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("settings.pos_billing_mode", "POS Billing & Settlement Mode")}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Defines checkout behavior on cashier terminals.
              </p>
            </div>
          </div>

          {/* 3-Card Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Option 1: Flexible */}
            <div
              onClick={() => setPosPaymentMode("flexible")}
              className={`min-h-[110px] p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between active:scale-[0.98] select-none ${
                posPaymentMode === "flexible"
                  ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/25 shadow-xs"
                  : "border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 hover:border-gray-300 dark:hover:border-neutral-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${posPaymentMode === "flexible" ? "bg-emerald-500 ring-2 ring-emerald-500/20" : "bg-gray-300 dark:bg-neutral-600"}`} />
                    Flexible / Dual
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300">
                    Standard
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  Cashier can choose per order: instant <strong>Pay & Settle</strong> or <strong>Send to Kitchen</strong> (Pay Later).
                </p>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-neutral-800/60 flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <IconArrowsExchange size={13} stroke={2} />
                Best for mixed formats
              </div>
            </div>

            {/* Option 2: Prepaid Only */}
            <div
              onClick={() => setPosPaymentMode("prepaid")}
              className={`min-h-[110px] p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between active:scale-[0.98] select-none ${
                posPaymentMode === "prepaid"
                  ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/25 shadow-xs"
                  : "border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 hover:border-gray-300 dark:hover:border-neutral-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${posPaymentMode === "prepaid" ? "bg-emerald-500 ring-2 ring-emerald-500/20" : "bg-gray-300 dark:bg-neutral-600"}`} />
                    Prepaid Only
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    Pay First
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  Orders must be paid upfront before dispatching to the kitchen.
                </p>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-neutral-800/60 flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <IconCash size={13} stroke={2} />
                Counter / Fast casual
              </div>
            </div>

            {/* Option 3: Postpaid Only */}
            <div
              onClick={() => setPosPaymentMode("postpaid")}
              className={`min-h-[110px] p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between active:scale-[0.98] select-none ${
                posPaymentMode === "postpaid"
                  ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/25 shadow-xs"
                  : "border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 hover:border-gray-300 dark:hover:border-neutral-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${posPaymentMode === "postpaid" ? "bg-emerald-500 ring-2 ring-emerald-500/20" : "bg-gray-300 dark:bg-neutral-600"}`} />
                    Postpaid Only
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                    Pay Later
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  Orders route immediately to kitchen KDS and are settled when the guest leaves.
                </p>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-neutral-800/60 flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                <IconClock size={13} stroke={2} />
                Full-service dine-in
              </div>
            </div>
          </div>
        </div>

        {/* SECTION: KITCHEN & FOOD PREPARATION WORKFLOW */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200/80 dark:border-neutral-800 rounded-2xl p-6 shadow-xs hover:border-gray-300 dark:hover:border-neutral-700 transition-all">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100 dark:border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <IconChefHat size={18} stroke={2} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  {t("settings.kitchen_operations", "Kitchen & Food Prep Workflow")}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Control whether your store operates a kitchen display system (KDS), prep stations, and kitchen routing.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t("settings.enable_kitchen_kds", "Enable Kitchen / KDS Workflow")}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isKitchenEnabled 
                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                }`}>
                  {isKitchenEnabled ? "Kitchen Active" : "No Kitchen / Direct Counter"}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xl leading-relaxed">
                {isKitchenEnabled
                  ? "Orders route to Kitchen KDS screens and multiple prep stations. Cashiers can 'Send to Kitchen' before payment."
                  : "Turned OFF for coffee kiosks, bars, bakeries, or retail counters. Checkout completes orders instantly without kitchen prep stages, and hides KDS screens."}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={isKitchenEnabled}
                  onChange={(e) => setIsKitchenEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-gray-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* SECTION 5: QR DIGITAL MENU & SELF-ORDERING */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200/80 dark:border-neutral-800 rounded-2xl p-6 shadow-xs hover:border-gray-300 dark:hover:border-neutral-700 transition-all">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100 dark:border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <IconQrcode size={18} stroke={2} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  {t("settings.qr_digital_menu", "QR Digital Menu & Ordering")}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Empower guests to browse contactless menus, order from tables, and leave reviews.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 divide-y divide-gray-100 dark:divide-neutral-800">
            {/* Feature 1: QR Menu Master Switch */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {t("settings.enable_qr_menu", "Enable Digital QR Menu")}
                  </span>
                  <Popover text={t("settings.qr_menu_tooltip", "Enables public viewing of your online menu via QR code.")} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Customers can scan table QR codes to view live items, variants, and pricing.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={isQRMenuEnabled}
                    onChange={(e) => handleToggleChange("qrmenu", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-gray-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {/* QR Quick Action Bar (when enabled) */}
            {isQRMenuEnabled && (
              <div className="pt-3 pb-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={btnDownloadMenuQR}
                  className="min-h-[40px] px-3.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-750 text-gray-700 dark:text-gray-200 font-medium text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                >
                  <IconDownload size={15} stroke={2} />
                  <span>Download QR Code (PNG)</span>
                </button>

                <button
                  type="button"
                  onClick={btnCopyMenuLink}
                  className="min-h-[40px] px-3.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-750 text-gray-700 dark:text-gray-200 font-medium text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                >
                  {copiedLink ? <IconCheck size={15} stroke={2.5} className="text-emerald-500" /> : <IconCopy size={15} stroke={2} />}
                  <span>{copiedLink ? "Link Copied!" : "Copy Menu Link"}</span>
                </button>

                <a
                  target="_blank"
                  rel="noreferrer"
                  href={QR_MENU_LINK}
                  className="min-h-[40px] px-3.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-750 text-gray-700 dark:text-gray-200 font-medium text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                >
                  <IconExternalLink size={15} stroke={2} />
                  <span>View Digital Menu</span>
                </a>
              </div>
            )}

            {/* Feature 2: Table Self-Ordering via QR */}
            <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {t("settings.enable_qr_order", "Customer Self-Ordering via QR")}
                  </span>
                  <Popover text={t("settings.qr_order_tooltip", "Allows customers to place orders directly from their phones.")} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Customers place orders from their table (protected by rotating 4-digit Table PIN to prevent fraudulent orders).
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={isQROrderEnabled}
                  onChange={(e) => handleToggleChange("qrorder", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-gray-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Feature 3: Auto-Send Verified QR Orders to Kitchen KDS */}
            {isKitchenEnabled && (
              <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {t("settings.qr_auto_kitchen", "Auto-Send Verified QR Orders to Kitchen (KDS)")}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    When <strong>OFF</strong>, orders wait in POS Approval Queue for cashier confirmation. When <strong>ON</strong>, PIN-verified orders fire straight to Kitchen prep stations.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={isQROrderAutoKitchen}
                    onChange={(e) => handleToggleChange("qrorder_auto_kitchen", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-gray-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            )}

            {/* Feature 4: Feedback & Rating Collection */}
            <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {t("settings.enable_feedback", "Collect Customer Feedback & Reviews")}
                  </span>
                  <Popover text={t("settings.feedback_tooltip", "Collect customer star ratings & suggestions via digital menu.")} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Prompts guests for a quick rating after inspecting their digital check.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={isFeedbackEnabled}
                  onChange={(e) => handleToggleChange("feedback", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-gray-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* STICKY BOTTOM ACTION BAR */}
      {/* ======================================================== */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-t border-gray-200 dark:border-neutral-800 py-3.5 px-4 sm:px-8 shadow-2xl transition-all">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Change Status Indicator */}
          <div className="flex items-center gap-2">
            {isDirty ? (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs sm:text-sm font-medium text-amber-700 dark:text-amber-400">
                  You have unsaved changes
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                  All changes saved
                </span>
              </div>
            )}
          </div>

          {/* Right: Discard & Save Actions */}
          <div className="flex items-center gap-3">
            {isDirty && (
              <button
                type="button"
                onClick={handleDiscard}
                disabled={isSaving}
                className="min-h-[42px] px-4 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-200 font-medium text-xs sm:text-sm transition-all active:scale-95 cursor-pointer"
              >
                {t("settings.discard", "Discard")}
              </button>
            )}

            <button
              type="button"
              onClick={btnSave}
              disabled={isSaving || !isDirty}
              className={`min-h-[44px] px-6 rounded-xl font-semibold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer ${
                isDirty
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                  : "bg-gray-200 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 cursor-not-allowed"
              }`}
            >
              {isSaving ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  <span>{t("settings.saving", "Saving...")}</span>
                </>
              ) : (
                <>
                  <IconDeviceFloppy size={18} stroke={2} />
                  <span>{t("settings.save_changes", "Save Changes")}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: PLAN UPGRADE REQUIRED */}
      <dialog id="modal-upgrade-required" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box border border-gray-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-xl">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">
            {t("settings.upgread.upgrade_required", "Upgrade Required")}
          </h3>
          <p className="py-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            {t(
              "settings.upgread.upgrade_message",
              "This feature requires a premium plan. Please upgrade your subscription to unlock contactless QR menus and customer self-ordering.",
            )}
          </p>
          <div className="modal-action flex items-center gap-3">
            <form method="dialog">
              <button className="min-h-[40px] px-4 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 font-medium text-xs hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors">
                {t("settings.upgread.close", "Close")}
              </button>
            </form>
            <button
              type="button"
              onClick={handleUpgradeClick}
              className="min-h-[40px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              {t("settings.upgread.upgrade_button", "View Plans & Upgrade")}
            </button>
          </div>
        </div>
      </dialog>
      <ConfirmDialog />
    </Page>
  );
}
