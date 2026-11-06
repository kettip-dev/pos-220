import React, { useState, useEffect, useRef } from "react";
import Page from "../components/Page";
import {
  IconUser,
  IconCamera,
  IconLock,
  IconCreditCard,
  IconEye,
  IconEyeOff,
  IconCheck,
  IconTrash,
  IconUpload,
  IconShieldLock,
  IconBuildingStore,
  IconIdBadge,
} from "@tabler/icons-react";
import { getUserDetailsInLocalStorage, updateUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { iconStroke } from "../config/config";
import SubscriptionDetails from "../components/SubscriptionDetails";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import {
  useProfile,
  updateProfile,
  uploadProfilePhoto,
  removeProfilePhoto,
  changePassword,
} from "../controllers/profile.controller";
import { getImageURL } from "../helpers/ImageHelper";
import AvatarImg from "../assets/avatar.svg";
import toast from "react-hot-toast";
import clsx from "clsx";
import useConfirm from "../hooks/useConfirm";

export default function ProfilePage() {
  const { t } = useTranslation();
  const [confirm, ConfirmDialog] = useConfirm();
  const { theme } = useTheme();
  const fileInputRef = useRef(null);

  // Profile data from API + fallback from localStorage
  const { profile, isLoading: isProfileLoading, mutate } = useProfile();
  const localUser = getUserDetailsInLocalStorage() || {};

  const [activeTab, setActiveTab] = useState("personal"); // 'personal' | 'photo' | 'security' | 'account'

  // Personal Info form state
  const [formData, setFormData] = useState({
    name: "",
    designation: "",
    phone: "",
    email: "",
    username: "",
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Photo state
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false);

  // Password state
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Sync form when profile data loads
  useEffect(() => {
    const activeData = profile || localUser;
    setFormData({
      name: activeData.name || "",
      designation: activeData.designation || "",
      phone: activeData.phone || "",
      email: activeData.email || "",
      username: activeData.username || "",
    });
  }, [profile]);

  const currentUser = profile || localUser;
  const userPhoto = currentUser?.photo ? getImageURL(currentUser.photo) : AvatarImg;

  // Handle personal information save
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error(t("profile.name_label") + " is required");
      return;
    }

    try {
      setIsUpdatingProfile(true);
      toast.loading(t("toast.please_wait"));

      const res = await updateProfile({
        name: formData.name.trim(),
        designation: formData.designation.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
      });

      toast.dismiss();
      if (res.status === 200) {
        toast.success(t("profile.profile_updated"));
        mutate();
      }
    } catch (error) {
      toast.dismiss();
      console.error(error);
      const message = error?.response?.data?.message || t("toast.something_went_wrong");
      toast.error(message);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Release the local preview blob when it is replaced or the page unmounts
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const openFilePicker = () => {
    if (isUploadingPhoto) return;
    fileInputRef.current?.click();
  };

  // Validate the picked image and upload it straight away (one tap, like Toast/Square)
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange
    e.target.value = "";
    if (!file) return;

    if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/i)) {
      toast.error("Please upload a PNG, JPG, or WEBP image");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be less than 5MB");
      return;
    }

    setPhotoPreview(URL.createObjectURL(file));
    await handlePhotoUpload(file);
  };

  // Upload the picked photo
  const handlePhotoUpload = async (file) => {
    if (!file) return;

    try {
      setIsUploadingPhoto(true);
      toast.loading(t("toast.please_wait"));

      const res = await uploadProfilePhoto(file);
      toast.dismiss();

      if (res.status === 200) {
        toast.success(t("profile.photo_uploaded"));
        await mutate();
      }
    } catch (error) {
      toast.dismiss();
      console.error(error);
      const message = error?.response?.data?.message || t("toast.something_went_wrong");
      toast.error(message);
    } finally {
      setPhotoPreview(null);
      setIsUploadingPhoto(false);
    }
  };

  // Handle removing photo
  const handlePhotoRemove = async () => {
    const isConfirm = await confirm({ title: t("profile.remove_photo_title", "Remove Photo"), description: t("profile.confirm_remove_photo", "Are you sure you want to remove your custom profile photo?"), confirmText: t("common.remove", "Remove") });
    if (!isConfirm) return;

    try {
      setIsRemovingPhoto(true);
      toast.loading(t("toast.please_wait"));

      const res = await removeProfilePhoto();
      toast.dismiss();

      if (res.status === 200) {
        toast.success(t("profile.photo_removed"));
        setPhotoPreview(null);
        mutate();
      }
    } catch (error) {
      toast.dismiss();
      console.error(error);
      const message = error?.response?.data?.message || t("toast.something_went_wrong");
      toast.error(message);
    } finally {
      setIsRemovingPhoto(false);
    }
  };

  // Handle password change
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (!passwords.currentPassword) {
      toast.error("Please enter your current password");
      return;
    }
    if (!passwords.newPassword) {
      toast.error("Please enter your new password");
      return;
    }
    if (passwords.newPassword.length < 6) {
      toast.error(t("profile.password_min_length"));
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }

    try {
      setIsChangingPassword(true);
      toast.loading(t("toast.please_wait"));

      const res = await changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
        confirmPassword: passwords.confirmPassword,
      });

      toast.dismiss();
      if (res.status === 200) {
        toast.success(t("profile.password_updated"));
        setPasswords({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }
    } catch (error) {
      toast.dismiss();
      console.error(error);
      const message = error?.response?.data?.message || t("toast.something_went_wrong");
      toast.error(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const tabs = [
    { id: "personal", label: t("profile.tab_personal"), icon: <IconUser size={18} stroke={iconStroke} /> },
    { id: "photo", label: t("profile.tab_photo"), icon: <IconCamera size={18} stroke={iconStroke} /> },
    { id: "security", label: t("profile.tab_security"), icon: <IconShieldLock size={18} stroke={iconStroke} /> },
    { id: "account", label: t("profile.tab_account"), icon: <IconCreditCard size={18} stroke={iconStroke} /> },
  ];

  return (
    <Page>
      <div className="max-w-3xl mx-auto py-4 sm:py-6 px-2 sm:px-4">
        {/* Page Title */}
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-6">
          {t("profile.title")}
        </h2>

        {/* Hero Profile Card */}
        <div className="w-full bg-white dark:bg-zinc-900 rounded-3xl border border-restro-border-green shadow-xs overflow-hidden mb-6 transition-all">
          <div className="w-full h-24 relative bg-restro-green flex items-center justify-center">
            {/* Circular Avatar placed on banner edge */}
            <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2">
              <div className="relative group">
                <img
                  src={photoPreview || userPhoto}
                  alt={currentUser.name}
                  onError={(e) => {
                    e.currentTarget.src = AvatarImg;
                  }}
                  className="w-20 h-20 rounded-full object-cover border-4 border-white dark:border-zinc-900 shadow-md bg-gray-100 dark:bg-zinc-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("photo");
                    openFilePicker();
                  }}
                  disabled={isUploadingPhoto}
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-restro-green text-white shadow-md hover:bg-green-700 active:scale-95 transition-transform"
                  title={t("profile.upload_new_photo")}
                >
                  <IconCamera size={16} stroke={iconStroke} />
                </button>
              </div>
            </div>
          </div>

          <div className="pt-12 pb-6 px-6 text-center">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate">
              {currentUser.name || "—"}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize mt-0.5">
              {currentUser.designation || currentUser.role || "User"}
            </p>
            <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 text-xs font-medium border border-green-200 dark:border-green-800/40">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>{t("profile.active")}</span>
              <span className="opacity-70">•</span>
              <span className="capitalize">{currentUser.role}</span>
            </div>
          </div>
        </div>

        {/* Tab Buttons (Touch optimized targets >= 42px) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all whitespace-nowrap min-h-[42px] cursor-pointer active:scale-95",
                  isActive
                    ? "bg-restro-green text-white shadow-xs"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Personal Information */}
        {activeTab === "personal" && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 p-6 shadow-xs animate-in fade-in duration-200">
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <IconUser stroke={iconStroke} size={20} className="text-restro-green" />
              {t("profile.tab_personal")}
            </h4>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    {t("profile.name")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t("profile.name")}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-gray-300 dark:border-zinc-700 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-restro-green text-sm"
                  />
                </div>

                {/* Designation */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    {t("profile.designation")}
                  </label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Head Chef, Store Manager, Cashier"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-gray-300 dark:border-zinc-700 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-restro-green text-sm"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    {t("profile.phone")}
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+855 12 345 678"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-gray-300 dark:border-zinc-700 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-restro-green text-sm"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    {t("profile.email")}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@example.com"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-gray-300 dark:border-zinc-700 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-restro-green text-sm"
                  />
                </div>
              </div>

              {/* Username (Read-Only) */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                  {t("profile.username")}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    value={formData.username}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-800/60 text-gray-500 dark:text-gray-400 cursor-not-allowed text-sm"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    <IconLock size={16} stroke={iconStroke} />
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  {t("profile.username_readonly_note")}
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="min-h-[44px] px-6 rounded-2xl bg-restro-green text-white font-semibold text-sm hover:bg-green-700 active:scale-95 transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <IconCheck size={18} stroke={iconStroke} />
                  <span>{isUpdatingProfile ? t("profile.saving") : t("profile.save_changes")}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Profile Photo */}
        {activeTab === "photo" && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 p-6 shadow-xs animate-in fade-in duration-200">
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <IconCamera stroke={iconStroke} size={20} className="text-restro-green" />
              {t("profile.tab_photo")}
            </h4>

            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800">
              <div className="relative shrink-0">
                <img
                  src={photoPreview || userPhoto}
                  alt={currentUser.name}
                  onError={(e) => {
                    e.currentTarget.src = AvatarImg;
                  }}
                  className="w-28 h-28 rounded-full object-cover border-4 border-white dark:border-zinc-900 shadow-md bg-gray-100 dark:bg-zinc-800"
                />
              </div>

              <div className="space-y-3 text-center sm:text-left flex-1">
                <div>
                  <h5 className="font-semibold text-gray-900 dark:text-white text-sm">
                    {t("profile.upload_new_photo")}
                  </h5>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t("profile.photo_specs")}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <button
                    type="button"
                    onClick={openFilePicker}
                    disabled={isUploadingPhoto}
                    className="min-h-[42px] px-4 rounded-xl bg-restro-green text-white text-xs font-semibold hover:bg-green-700 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    <IconUpload size={16} stroke={iconStroke} />
                    <span>
                      {isUploadingPhoto
                        ? t("profile.uploading", "Uploading...")
                        : t("profile.choose_photo", "Choose Photo")}
                    </span>
                  </button>

                  {currentUser?.photo && !isUploadingPhoto && (
                    <button
                      type="button"
                      onClick={handlePhotoRemove}
                      disabled={isRemovingPhoto}
                      className="min-h-[42px] px-4 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-100 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <IconTrash size={16} stroke={iconStroke} />
                      <span>{t("profile.remove_photo")}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Security & Password */}
        {activeTab === "security" && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 p-6 shadow-xs animate-in fade-in duration-200">
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <IconShieldLock stroke={iconStroke} size={20} className="text-restro-green" />
              {t("profile.tab_security")}
            </h4>

            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  {t("profile.current_password")} *
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    required
                    value={passwords.currentPassword}
                    onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                    placeholder="••••••••"
                    className="w-full min-h-[44px] px-3.5 pr-10 rounded-xl border border-gray-300 dark:border-zinc-700 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-restro-green text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    {showCurrentPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  {t("profile.new_password")} *
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={passwords.newPassword}
                    onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                    placeholder="••••••••"
                    className="w-full min-h-[44px] px-3.5 pr-10 rounded-xl border border-gray-300 dark:border-zinc-700 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-restro-green text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    {showNewPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  {t("profile.password_min_length")}
                </p>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  {t("profile.confirm_password")} *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={passwords.confirmPassword}
                    onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    className="w-full min-h-[44px] px-3.5 pr-10 rounded-xl border border-gray-300 dark:border-zinc-700 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-restro-green text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    {showConfirmPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit Password Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="min-h-[44px] px-6 rounded-2xl bg-restro-green text-white font-semibold text-sm hover:bg-green-700 active:scale-95 transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <IconCheck size={18} stroke={iconStroke} />
                  <span>{isChangingPassword ? t("profile.saving") : t("profile.change_password")}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 4: Account & Plan / Subscription Details */}
        {activeTab === "account" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {currentUser.role === "admin" ? (
              <SubscriptionDetails />
            ) : (
              <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-restro-border-green p-6 shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 flex items-center justify-center rounded-2xl bg-restro-green text-white">
                    <IconIdBadge stroke={iconStroke} size={22} />
                  </div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white">
                    {t("profile.profile_details")}
                  </h4>
                </div>

                <div className="space-y-3 divide-y divide-gray-100 dark:divide-zinc-800 text-sm">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-500 dark:text-gray-400">{t("profile.staff_account_status")}</span>
                    <span className="font-semibold text-green-600 dark:text-green-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      {t("profile.active")}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-500 dark:text-gray-400">{t("profile.role")}</span>
                    <span className="font-semibold text-gray-900 dark:text-white capitalize">
                      {currentUser.role}
                    </span>
                  </div>

                  {currentUser.business_name && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-500 dark:text-gray-400">{t("profile.business_name")}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {currentUser.business_name}
                      </span>
                    </div>
                  )}

                  <div className="py-2">
                    <span className="text-gray-500 dark:text-gray-400 block mb-2">{t("profile.permissions")}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {currentUser.scope ? (
                        currentUser.scope.split(",").map((s) => (
                          <span
                            key={s}
                            className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 text-xs font-medium"
                          >
                            {s.trim()}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">
                          {t("profile.all_permissions")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Always mounted so the avatar camera button works from any tab */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
      <ConfirmDialog />
    </Page>
  );
}
