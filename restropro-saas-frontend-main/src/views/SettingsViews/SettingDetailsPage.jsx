import React, { useRef, useState, useEffect } from "react";
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
  IconExternalLink,
  IconQrcode,
  IconTrash,
  IconUpload,
  IconPhone,
  IconMail,
  IconBuildingStore,
  IconChevronDown,
  IconDeviceMobile,
  IconMessageCheck,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import QRCode from "qrcode";
import { getQRMenuLink } from "../../helpers/QRMenuHelper";
import imageCompression from "browser-image-compression";
import { getImageURL } from "../../helpers/ImageHelper";
import { useTheme } from "../../contexts/ThemeContext";
import { getUserDetailsInLocalStorage } from "../../helpers/UserDetails";
import { PLAN_FEATURES } from "../../config/scopes";

export default function SettingDetailsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const storeNameRef = useRef();
  const addressRef = useRef();
  const emailRef = useRef();
  const phoneRef = useRef();
  const currencyRef = useRef();
  const exchangeRateRef = useRef();
  const isQRMenuEnabledRef = useRef();
  const isQROrderEnabledRef = useRef();
  const isFeedbackEnabledRef = useRef();
  const { theme } = useTheme();
  const user = getUserDetailsInLocalStorage();
  const { planFeautures } = user;
  const userPlanFeatures = Array.isArray(planFeautures)
    ? planFeautures
    : planFeautures?.split(",") || [];

  const isQrMenuAccess = userPlanFeatures?.includes(
    PLAN_FEATURES?.QRMENU,
  );

  const { APIURL, data, error, isLoading } =
    useStoreSettings();

  const [qrMenuChecked, setQrMenuChecked] = useState(false);

  useEffect(() => {
    if (data?.isQRMenuEnabled !== undefined) {
      setQrMenuChecked(data.isQRMenuEnabled);
    }
  }, [data?.isQRMenuEnabled]);

  if (isLoading) {
    return (
      <Page className="px-4 sm:px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <span className="loading loading-spinner loading-md text-[#22C55E]"></span>
            <p className="text-sm font-medium">
              {t("settings.please_wait")}
            </p>
          </div>
        </div>
      </Page>
    );
  }

  if (error) {
    console.error(error);
    return (
      <Page className="px-4 sm:px-8 py-6 max-w-7xl mx-auto">
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 text-red-600 rounded-2xl p-5 text-center text-sm">
          {t("settings.error_loading_data")}
        </div>
      </Page>
    );
  }

  const {
    storeImage,
    storeName,
    email,
    address,
    phone,
    currency,
    isQRMenuEnabled,
    uniqueQRCode,
    isQROrderEnabled,
    isFeedbackEnabled,
    uniqueId,
  } = data;

  const QR_MENU_LINK = getQRMenuLink(uniqueQRCode);

  const btnSave = async () => {
    const storeNameVal = storeNameRef.current.value;
    const addressVal = addressRef.current.value;
    const emailVal = emailRef.current.value;
    const phoneVal = phoneRef.current.value;
    const currencyVal = currencyRef.current.value;
    const exchangeRateVal = exchangeRateRef.current?.value || 4100;
    const isQRMenuEnabledVal =
      isQRMenuEnabledRef.current.checked;
    const isQROrderEnabledVal =
      isQROrderEnabledRef.current.checked;
    const isFeedbackEnabledVal =
      isFeedbackEnabledRef.current.checked;

    try {
      toast.loading(t("settings.please_wait"));
      const res = await saveStoreSettings(
        storeNameVal,
        addressVal,
        phoneVal,
        emailVal,
        currencyVal,
        null,
        isQRMenuEnabledVal,
        isQROrderEnabledVal,
        isFeedbackEnabledVal,
        Number(exchangeRateVal) || 4100,
      );

      if (res.status == 200) {
        await mutate(APIURL);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        t("settings.something_went_wrong");
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  };

  const btnDownloadMenuQR = async () => {
    try {
      const qrDataURL = await QRCode.toDataURL(
        QR_MENU_LINK,
        { width: 1080 },
      );
      const link = document.createElement("a");
      link.download = "qr.png";
      link.href = qrDataURL;
      link.click();
      link.remove();
    } catch (error) {
      console.error(error);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];

    if (!file) {
      return;
    }

    try {
      toast.loading(t("settings.please_wait"));
      const compressedImage = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 512,
        useWebWorker: true,
      });

      const formData = new FormData();
      formData.append("store_image", compressedImage);

      const res = await uploadStoreImage(formData);
      if (res.status == 200) {
        toast.dismiss();
        toast.success(res.data.message);
        await mutate(APIURL);
      }
    } catch (error) {
      console.error(error);
      toast.dismiss();
      const message =
        error?.response?.data?.message ||
        t("settings.something_went_wrong");
      toast.error(message);
    }
  };

  const handleFileDelete = async () => {
    try {
      toast.loading(t("settings.please_wait"));

      const res = await deleteStoreImage(uniqueId);
      if (res.status == 200) {
        toast.dismiss();
        toast.success(res.data.message);
        await mutate(APIURL);
      }
    } catch (error) {
      console.error(error);
      toast.dismiss();
      const message =
        error?.response?.data?.message ||
        t("settings.something_went_wrong");
      toast.error(message);
    }
  };

  const handleToggleChange = (e, toggleType) => {
    if (!isQrMenuAccess) {
      e.target.checked = !e.target.checked;
      document
        .getElementById("modal-upgrade-required")
        .showModal();
      return;
    }
    if (toggleType === "qrmenu") {
      setQrMenuChecked(e.target.checked);
    }
  };

  const handleUpgradeClick = () => {
    document
      .getElementById("modal-upgrade-required")
      .close();
    navigate("/dashboard/profile");
  };

  return (
    <Page className="px-4 sm:px-8 py-6 max-w-7xl mx-auto">
      {/* HEADER: Clean non-bold title without icon */}
      <h3 className="text-2xl sm:text-3xl font-light text-gray-800 dark:text-white mb-6">
        {t("settings.store_details")}
      </h3>

      {/* TWO MATCHING CARDS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* LEFT CARD: STORE IMAGE */}
        <div className="lg:col-span-4 xl:col-span-3 w-full">
          <div className="h-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-between text-center">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-4 w-full text-center">
              {t("settings.store_image") || "Store Image"}
            </h4>

            {/* Dashed Upload Box */}
            <div className="relative w-44 h-44 sm:w-48 sm:h-48 aspect-square rounded-2xl bg-white dark:bg-neutral-800/40 border-2 border-dashed border-restro-green hover:cursor-pointer transition-all duration-200 flex flex-col items-center justify-center p-3 group shadow-sm mx-auto">
              <input
                type="file"
                name="storeImage"
                id="storeImage"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              {storeImage ? (
                <label
                  htmlFor="storeImage"
                  className="w-full h-full flex items-center justify-center overflow-hidden rounded-xl cursor-pointer"
                  title="Click to change logo"
                >
                  <img
                    src={getImageURL(storeImage)}
                    alt="Store Logo"
                    className="w-full h-full object-cover rounded-xl bg-white"
                  />
                </label>
              ) : (
                <label
                  htmlFor="storeImage"
                  className="w-full h-full flex flex-col items-center justify-center cursor-pointer gap-2"
                >
                  <div className="w-10 h-10 rounded-full bg-[#F2FBF5] dark:bg-neutral-800 text-[#22C55E] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                    <IconUpload size={20} stroke={1.8} />
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {t("settings.no_image")}
                  </span>
                </label>
              )}

              {/* Delete Button on Outer Border Div when image is present */}
              {storeImage && (
                <button
                  type="button"
                  onClick={handleFileDelete}
                  className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-white text-red-500 border-2 border-red-400 shadow-md flex items-center justify-center cursor-pointer hover:bg-red-500 hover:text-white transition-all active:scale-95 z-10"
                  title="Delete Logo"
                >
                  <IconTrash size={15} stroke={2} />
                </button>
              )}
            </div>

            {/* Recommended Size Note */}
            <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 leading-relaxed text-center">
              <p className="font-medium text-gray-700 dark:text-gray-300">
                Recommended size
              </p>
              <p>500 × 500 px</p>
              <p className="text-[11px] text-gray-400">
                JPG or PNG
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT CARD: STORE INFORMATION */}
        <div className="lg:col-span-8 xl:col-span-9 w-full">
          <div className="h-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm space-y-4">
            {/* Store Name */}
            <div>
              <label
                htmlFor="name"
                className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block"
              >
                {t("settings.store_name")}
              </label>
              <div className="relative flex items-center">
                {/* <div className="absolute left-3 text-[#22C55E] pointer-events-none flex items-center">
                  <div className="w-7 h-7 rounded-md bg-[#F2FBF5] dark:bg-emerald-950/40 flex items-center justify-center">
                    <IconBuildingStore size={16} stroke={1.8} />
                  </div>
                </div> */}
                <input
                  ref={storeNameRef}
                  type="text"
                  name="name"
                  id="name"
                  defaultValue={storeName}
                  placeholder={t(
                    "settings.store_name_placeholder",
                  )}
                  className="w-full h-10 pl-3 pr-3.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-800 dark:text-white  focus:ring-2 focus:ring-[#22C55E]/15 focus:outline-none transition-all placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label
                htmlFor="address"
                className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block"
              >
                {t("settings.address")}
              </label>
              <textarea
                ref={addressRef}
                name="address"
                id="address"
                rows={2}
                defaultValue={address}
                placeholder={t(
                  "settings.address_placeholder",
                )}
                className="w-full min-h-[76px] px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-800 dark:text-white  focus:ring-2 focus:ring-[#22C55E]/15 focus:outline-none transition-all resize-y placeholder:text-gray-400"
              />
            </div>

            {/* Email & Phone Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block"
                >
                  {t("settings.email")}
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-restro-green pointer-events-none flex items-center">
                    <div className="w-7 h-7 rounded-md bg-[#F2FBF5] dark:bg-emerald-950/40 flex items-center justify-center">
                      <IconMail size={16} stroke={1.8} />
                    </div>
                  </div>
                  <input
                    ref={emailRef}
                    type="email"
                    name="email"
                    id="email"
                    defaultValue={email}
                    placeholder={t(
                      "settings.email_placeholder",
                    )}
                    className="w-full h-10 pl-11 pr-3.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-800 dark:text-white  focus:ring-2 focus:ring-[#22C55E]/15 focus:outline-none transition-all placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="phone"
                  className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block"
                >
                  {t("settings.phone")}
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-restro-green pointer-events-none flex items-center">
                    <div className="w-7 h-7 rounded-md bg-[#F2FBF5] dark:bg-emerald-950/40 flex items-center justify-center">
                      <IconPhone size={16} stroke={1.8} />
                    </div>
                  </div>
                  <input
                    ref={phoneRef}
                    type="tel"
                    name="phone"
                    id="phone"
                    defaultValue={phone}
                    placeholder={t(
                      "settings.phone_placeholder",
                    )}
                    className="w-full h-10 pl-11 pr-3.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-800 dark:text-white  focus:ring-2 focus:ring-[#22C55E]/15 focus:outline-none transition-all placeholder:text-gray-400"
                  />
                </div>
              </div>
            </div>

            {/* Currency */}
            <div>
              <label
                htmlFor="currency"
                className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block"
              >
                {t("settings.currency")}
              </label>
              <div className="relative flex items-center">
                <select
                  ref={currencyRef}
                  name="currency"
                  id="currency"
                  defaultValue={currency}
                  className="w-full h-10 pl-3.5 pr-9 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-800 dark:text-white  focus:ring-2 focus:ring-[#22C55E]/15 focus:outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="" hidden>
                    {t("settings.select_currency")}
                  </option>
                  {CURRENCIES.map((item, index) => (
                    <option value={item.cc} key={index}>
                      {item.name} - ({item.symbol})
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 text-gray-400 pointer-events-none">
                  <IconChevronDown size={18} stroke={1.8} />
                </div>
              </div>
            </div>

            {/* Exchange Rate USD to KHR (Cambodia Dual-Currency Support) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="exchangeRate"
                  className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 block"
                >
                  {t("settings.exchange_rate_khr", "Cash Exchange Rate (1 USD to KHR)")}
                </label>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                  Dual Currency POS
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  ref={exchangeRateRef}
                  type="number"
                  name="exchangeRate"
                  id="exchangeRate"
                  step="10"
                  defaultValue={data?.exchangeRateUsdToKhr || 4100}
                  placeholder="4100"
                  className="w-full h-10 pl-3.5 pr-14 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-800 dark:text-white focus:ring-2 focus:ring-[#22C55E]/15 focus:outline-none transition-all placeholder:text-gray-400"
                />
                <span className="absolute right-3.5 text-xs font-bold text-gray-400 font-mono">
                  ៛ / $
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                {t("settings.exchange_rate_hint", "Used on the POS payment screen to accept mixed USD & Riel cash and compute change advice.")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* STORE FEATURES SECTION */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm mt-6">
        <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Store Features
        </h4>

        <div className="divide-y divide-gray-100 dark:divide-neutral-800">
          {/* FEATURE 1: Enable QR Menu */}
          <div className="py-4 px-2 sm:px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start justify-between w-full md:w-auto gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F2FBF5] dark:bg-emerald-950/40 text-restro-green flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                  <IconQrcode size={20} stroke={1.8} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h5 className="text-sm font-semibold text-gray-800 dark:text-white">
                      {t("settings.enable_qr_menu")}
                    </h5>
                    <Popover text={t("settings.qr_menu_tooltip")} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Allow customers to view your menu using QR Code.
                  </p>
                </div>
              </div>

              {/* Mobile Toggle Switch (Top Right) */}
              <div className="md:hidden shrink-0 mt-0.5">
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    ref={isQRMenuEnabledRef}
                    defaultChecked={isQRMenuEnabled}
                    type="checkbox"
                    name="qrmenu_mobile"
                    id="qrmenu_mobile"
                    className="sr-only peer"
                    onChange={(e) => handleToggleChange(e, "qrmenu")}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#59A352]"></div>
                </label>
              </div>
            </div>

            {/* Buttons & Desktop Toggle */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              {qrMenuChecked && isQrMenuAccess && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={btnDownloadMenuQR}
                    className="h-9 px-3.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                  >
                    <IconQrcode size={16} stroke={1.8} />
                    <span>{t("settings.download_qr_code")}</span>
                  </button>
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href={QR_MENU_LINK}
                    className="h-9 px-3.5 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                  >
                    <IconExternalLink size={16} stroke={1.8} />
                    <span>{t("settings.view_digital_menu")}</span>
                  </a>
                </div>
              )}

              {/* Desktop Toggle Switch */}
              <div className="hidden md:block shrink-0">
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    ref={isQRMenuEnabledRef}
                    defaultChecked={isQRMenuEnabled}
                    type="checkbox"
                    name="qrmenu"
                    id="qrmenu"
                    className="sr-only peer"
                    onChange={(e) => handleToggleChange(e, "qrmenu")}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-restro-green"></div>
                </label>
              </div>
            </div>
          </div>

          {/* FEATURE 2: Enable Order via QR Menu */}
          <div className="py-4 px-2 sm:px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors flex items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F2FBF5] dark:bg-emerald-950/40 text-restro-green flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <IconDeviceMobile size={20} stroke={1.8} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h5 className="text-sm font-semibold text-gray-800 dark:text-white">
                    {t("settings.enable_qr_order")}
                  </h5>
                  <Popover text={t("settings.qr_order_tooltip")} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Allow customers to place orders directly through QR.
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5 sm:mt-0">
              <input
                ref={isQROrderEnabledRef}
                defaultChecked={isQROrderEnabled}
                type="checkbox"
                name="qrorder"
                id="qrorder"
                className="sr-only peer"
                onChange={(e) => handleToggleChange(e, "qrorder")}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-restro-green"></div>
            </label>
          </div>

          {/* FEATURE 3: Enable Collecting Feedback */}
          <div className="py-4 px-2 sm:px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors flex items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F2FBF5] dark:bg-emerald-950/40 text-restro-green flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <IconMessageCheck size={20} stroke={1.8} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h5 className="text-sm font-semibold text-gray-800 dark:text-white">
                    {t("settings.enable_feedback")}
                  </h5>
                  <Popover text={t("settings.feedback_tooltip")} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Collect customer feedback and improve customer experience.
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5 sm:mt-0">
              <input
                ref={isFeedbackEnabledRef}
                defaultChecked={isFeedbackEnabled}
                type="checkbox"
                name="feedback"
                id="feedback"
                className="sr-only peer"
                onChange={(e) => handleToggleChange(e, "feedback")}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-restro-green"></div>
            </label>
          </div>
        </div>

        {/* PRIMARY SAVE BUTTON */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={btnSave}
            className="w-full sm:w-auto h-11 px-6 bg-restro-green hover:bg-[#16A34A] text-white font-medium text-sm rounded-xl shadow-sm transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <IconDeviceFloppy size={18} stroke={2} />
            <span>
              {t("settings.save") || "Save Changes"}
            </span>
          </button>
        </div>
      </div>

      {/* UPGRADE REQUIRED DIALOG */}
        <dialog
          id="modal-upgrade-required"
          className="modal modal-bottom sm:modal-middle"
        >
          <div className="modal-box border border-gray-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-xl">
            <h3 className="font-bold text-lg text-gray-800 dark:text-white">
              {t("settings.upgread.upgrade_required")}
            </h3>
            <p className="py-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {t("settings.upgread.upgrade_message")}
            </p>
            <div className="modal-action flex items-center gap-3">
              <form method="dialog">
                <button className="h-10 px-4 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 font-medium text-xs hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors">
                  {t("settings.upgread.close")}
                </button>
              </form>
              <button
                type="button"
                onClick={handleUpgradeClick}
                className="h-10 px-4 rounded-xl bg-restro-green hover:bg-[#16A34A] text-white font-medium text-xs shadow-sm transition-all active:scale-95"
              >
                {t("settings.upgread.upgrade_button")}
              </button>
            </div>
          </div>
        </dialog>
      </Page>
    );
  }
