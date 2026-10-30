import React, { useRef, useState, useMemo } from "react";
import Page from "../components/Page";
import { isAllBusinessesScope } from "../helpers/BusinessScope";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import DeleteModal from "../components/DeleteModal";
import {
  IconBuilding,
  IconCheck,
  IconDotsVertical,
  IconEye,
  IconFilter,
  IconId,
  IconKey,
  IconLock,
  IconMail,
  IconPhone,
  IconPlus,
  IconSearch,
  IconShieldCheck,
  IconTrash,
  IconUser,
  IconUserCheck,
  IconUserEdit,
  IconUserPlus,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { SCOPES } from "../config/scopes";
import {
  ROLE_PRESETS,
  SCOPE_CATEGORIES,
  SCOPE_METADATA,
} from "../config/permissionTemplates";
import { toast } from "react-hot-toast";
import { mutate } from "swr";
import {
  addNewUser,
  deleteUser,
  resetUserPassword,
  updateUser,
  useUsers,
} from "../controllers/users.controller";
import { validateEmail } from "../utils/emailValidator";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import PermissionSelector from "../components/PermissionSelector";

const AVATAR_PALETTES = [
  {
    bg: "bg-emerald-100 dark:bg-emerald-950/70",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  {
    bg: "bg-sky-100 dark:bg-sky-950/70",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-200 dark:border-sky-800",
  },
  {
    bg: "bg-indigo-100 dark:bg-indigo-950/70",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-200 dark:border-indigo-800",
  },
  {
    bg: "bg-violet-100 dark:bg-violet-950/70",
    text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-200 dark:border-violet-800",
  },
  {
    bg: "bg-amber-100 dark:bg-amber-950/70",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  {
    bg: "bg-teal-100 dark:bg-teal-950/70",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-200 dark:border-teal-800",
  },
  {
    bg: "bg-rose-100 dark:bg-rose-950/70",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
  },
];

function getAvatarPalette(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UsersPage() {
  const { t } = useTranslation();
  const isConsolidated = isAllBusinessesScope(getUserDetailsInLocalStorage()?.role);

  const [state, setState] = useState({
    selectedScopes: [],
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [userToDelete, setUserToDelete] = useState(null);
  const [viewingPermissionsUser, setViewingPermissionsUser] = useState(null);

  const nameRef = useRef();
  const usernameRef = useRef();
  const passwordRef = useRef();
  const phoneRef = useRef();
  const designationRef = useRef();

  const changePasswordModalUsernameRef = useRef();
  const changePasswordModalNewPasswordRef = useRef();

  const nameUpdateRef = useRef();
  const usernameUpdateRef = useRef();
  const phoneUpdateRef = useRef();
  const designationUpdateRef = useRef();

  const { APIURL, data: users, error, isLoading } = useUsers();
  const { theme } = useTheme();

  const { selectedScopes } = state;

  const stats = useMemo(() => {
    if (!users || !Array.isArray(users)) return { total: 0, admins: 0, staff: 0 };
    const total = users.length;
    const admins = users.filter((u) => u.role === "admin").length;
    const staff = total - admins;
    return { total, admins, staff };
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (!users || !Array.isArray(users)) return [];
    return users.filter((user) => {
      if (roleFilter === "admin" && user.role !== "admin") return false;
      if (roleFilter === "user" && user.role === "admin") return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = user.name?.toLowerCase().includes(q);
      const usernameMatch = user.username?.toLowerCase().includes(q);
      const emailMatch = user.email?.toLowerCase().includes(q);
      const phoneMatch = user.phone?.toLowerCase().includes(q);
      const designationMatch = user.designation?.toLowerCase().includes(q);
      const businessMatch = user.business?.toLowerCase().includes(q);

      return (
        nameMatch ||
        usernameMatch ||
        emailMatch ||
        phoneMatch ||
        designationMatch ||
        businessMatch
      );
    });
  }, [users, roleFilter, searchQuery]);

  const getScopePresetInfo = (scopes = []) => {
    if (!scopes || scopes.length === 0) {
      return {
        title: t("users.unassigned"),
        count: 0,
        isCustom: false,
      };
    }
    const scopeSet = new Set(scopes);
    for (const preset of ROLE_PRESETS) {
      if (
        preset.scopes.length === scopes.length &&
        preset.scopes.every((s) => scopeSet.has(s))
      ) {
        return { title: preset.title, count: scopes.length, isCustom: false };
      }
    }
    return {
      title: t("users.custom_access"),
      count: scopes.length,
      isCustom: true,
    };
  };

  const btnAdd = async () => {
    const name = nameRef.current.value;
    const username = usernameRef.current.value;
    const password = passwordRef.current.value;
    const phone = phoneRef.current.value || null;
    const designation = designationRef.current.value || null;
    const userScopes = selectedScopes;

    if (!name) {
      toast.error(t("users.name_error"));
      return;
    }
    if (!username) {
      toast.error(t("users.username_error"));
      return;
    }
    if (!password) {
      toast.error(t("users.password_error"));
      return;
    }
    if (!validateEmail(username)) {
      toast.error(t("users.valid_email_error"));
      return;
    }

    try {
      toast.loading(t("users.loading_message"));
      const res = await addNewUser(
        username,
        password,
        name,
        designation,
        phone,
        null,
        userScopes
      );

      if (res.status === 200) {
        nameRef.current.value = null;
        usernameRef.current.value = null;
        passwordRef.current.value = null;
        phoneRef.current.value = null;
        designationRef.current.value = null;

        await mutate(APIURL);

        setState({
          ...state,
          selectedScopes: [],
        });

        document.getElementById("modal-add")?.close();
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t("users.error_message");
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  };

  const btnDelete = async (username) => {
    try {
      toast.loading(t("users.loading_message"));
      const res = await deleteUser(username);

      if (res.status === 200) {
        await mutate(APIURL);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t("users.error_message");
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  };

  const btnShowChangePassword = (username) => {
    changePasswordModalUsernameRef.current.value = username;
    document.getElementById("modal-reset-password").showModal();
  };

  const btnChangePassword = async () => {
    const username = changePasswordModalUsernameRef.current.value;
    const password = changePasswordModalNewPasswordRef.current.value;

    if (!username) {
      toast.error(t("users.invalid_request"));
      return;
    }
    if (!password) {
      toast.error(t("users.new_password_error"));
      return;
    }

    try {
      toast.loading(t("users.loading_message"));
      const res = await resetUserPassword(username, password);

      if (res.status === 200) {
        changePasswordModalUsernameRef.current.value = null;
        changePasswordModalNewPasswordRef.current.value = null;

        await mutate(APIURL);

        document.getElementById("modal-reset-password")?.close();
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t("users.error_message");
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  };

  const btnShowUpdate = (username, name, phone, email, designation, scope) => {
    usernameUpdateRef.current.value = username;
    nameUpdateRef.current.value = name;
    phoneUpdateRef.current.value = phone;
    designationUpdateRef.current.value = designation;

    setState({
      ...state,
      selectedScopes: scope ? new String(scope).split(",") : [],
    });

    document.getElementById("modal-update").showModal();
  };

  const btnUpdate = async () => {
    const username = usernameUpdateRef.current.value;
    const name = nameUpdateRef.current.value;
    const phone = phoneUpdateRef.current.value;
    const designation = designationUpdateRef.current.value;
    const userScopes = selectedScopes;

    if (!name) {
      toast.error(t("users.name_error"));
      return;
    }
    if (!username) {
      toast.error(t("users.username_error"));
      return;
    }

    try {
      toast.loading(t("users.loading_message"));
      const res = await updateUser(
        username,
        name,
        designation,
        phone,
        null,
        userScopes
      );

      if (res.status === 200) {
        usernameUpdateRef.current.value = null;
        nameUpdateRef.current.value = null;
        phoneUpdateRef.current.value = null;
        designationUpdateRef.current.value = null;

        await mutate(APIURL);

        setState({
          ...state,
          selectedScopes: [],
        });

        document.getElementById("modal-update")?.close();
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t("users.error_message");
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  };

  if (isLoading) {
    return (
      <Page>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <span className="loading loading-spinner loading-lg text-restro-green"></span>
            <p className="text-sm font-medium">{t("users.loading")}</p>
          </div>
        </div>
      </Page>
    );
  }

  if (error) {
    console.error(error);
    return (
      <Page>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-2">
            <p className="text-rose-500 font-semibold">{t("users.error_loading")}</p>
            <button
              onClick={() => mutate(APIURL)}
              className="btn btn-sm btn-outline rounded-xl"
            >
              Retry
            </button>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      {/* ── Page Header & Stats Toolbar ── */}
      <div className="flex flex-col gap-4 pb-2">
        {/* Title, Counts & Primary Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t("users.title")}
            </h3>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
              {stats.total} {t("users.total_staff")}
            </span>
          </div>

          <button
            onClick={() => document.getElementById("modal-add").showModal()}
            className="min-h-[42px] h-[42px] px-4 rounded-xl flex items-center justify-center gap-2 text-white font-medium bg-restro-green hover:bg-restro-green-button-hover active:scale-95 shadow-sm transition-all duration-150 self-start sm:self-auto cursor-pointer"
          >
            <IconUserPlus size={19} stroke={iconStroke} />
            <span className="text-sm">{t("users.add_new_user")}</span>
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
          {/* Search Box */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <IconSearch size={18} stroke={iconStroke} />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("users.search_placeholder")}
              className="w-full min-h-[42px] h-[42px] pl-10 pr-9 text-sm rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-restro-green transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300"
              >
                <IconX size={16} />
              </button>
            )}
          </div>

          {/* Role Filter Segmented Buttons */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-neutral-800/80 border border-slate-200/80 dark:border-neutral-700/60 shrink-0 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={() => setRoleFilter("all")}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 min-h-[34px] rounded-lg text-xs font-semibold transition ${
                roleFilter === "all"
                  ? "bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {t("users.filter_all")} ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("admin")}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 min-h-[34px] rounded-lg text-xs font-semibold transition ${
                roleFilter === "admin"
                  ? "bg-white dark:bg-neutral-900 text-indigo-700 dark:text-indigo-300 shadow-xs"
                  : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {t("users.filter_admin")} ({stats.admins})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("user")}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 min-h-[34px] rounded-lg text-xs font-semibold transition ${
                roleFilter === "user"
                  ? "bg-white dark:bg-neutral-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                  : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {t("users.filter_staff")} ({stats.staff})
            </button>
          </div>
        </div>
      </div>

      {/* ── Modern Touch-Friendly Cards Grid ── */}
      {filteredUsers.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/40">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-neutral-800 flex items-center justify-center text-slate-400 mb-3">
            <IconUsers size={28} stroke={iconStroke} />
          </div>
          <h4 className="text-base font-semibold text-slate-800 dark:text-neutral-200">
            {t("users.no_users_found")}
          </h4>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 max-w-sm">
            {t("users.no_users_subtitle")}
          </p>
          {(searchQuery || roleFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setRoleFilter("all");
              }}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 transition"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUsers.map((user, index) => {
            const {
              username,
              name,
              role,
              designation,
              phone,
              email,
              scope,
              business,
            } = user;

            const userScopes = scope ? new String(scope).split(",") : [];
            const isAdmin = role === "admin";
            const initials = getInitials(name || username);
            const palette = getAvatarPalette(username || name);
            const presetInfo = getScopePresetInfo(userScopes);

            return (
              <div
                key={username || index}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs hover:shadow-md transition-all duration-200 overflow-visible"
              >
                {/* Card Top Section */}
                <div className="p-5 flex-1 flex flex-col">
                  {/* Row 1: Role Pill & 3-Dots Action Menu */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/80">
                          <IconShieldCheck size={14} />
                          {t("users.filter_admin")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/80">
                          <IconUser size={14} />
                          {t("users.filter_staff")}
                        </span>
                      )}

                      {isConsolidated && business && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400">
                          <IconBuilding size={12} /> {business}
                        </span>
                      )}
                    </div>

                    {/* Action Dropdown Menu */}
                    {!isAdmin ? (
                      <div className="dropdown dropdown-end">
                        <button
                          tabIndex={0}
                          type="button"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition active:scale-95 cursor-pointer"
                          title={t("users.edit_user")}
                        >
                          <IconDotsVertical size={18} stroke={iconStroke} />
                        </button>
                        <ul
                          tabIndex={0}
                          className="dropdown-content z-30 menu p-1.5 shadow-xl bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 w-52 text-xs font-medium space-y-0.5"
                        >
                          <li>
                            <button
                              type="button"
                              onClick={() =>
                                btnShowUpdate(
                                  username,
                                  name,
                                  phone,
                                  null,
                                  designation,
                                  scope
                                )
                              }
                              className="flex items-center gap-2 py-2 text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-lg cursor-pointer"
                            >
                              <IconUserEdit size={16} className="text-restro-green" />
                              <span>{t("users.edit_user")}</span>
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              onClick={() => btnShowChangePassword(username)}
                              className="flex items-center gap-2 py-2 text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-lg cursor-pointer"
                            >
                              <IconKey size={16} className="text-amber-500" />
                              <span>{t("users.reset_password")}</span>
                            </button>
                          </li>
                          <div className="my-1 border-t border-slate-100 dark:border-neutral-800" />
                          <li>
                            <button
                              type="button"
                              onClick={() => setUserToDelete(username)}
                              className="flex items-center gap-2 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                            >
                              <IconTrash size={16} />
                              <span>{t("users.delete_user")}</span>
                            </button>
                          </li>
                        </ul>
                      </div>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-neutral-500 px-2 py-0.5 rounded-full bg-slate-50 dark:bg-neutral-800/60"
                        title={t("users.protected_account")}
                      >
                        <IconLock size={12} />
                        {t("users.protected_account")}
                      </span>
                    )}
                  </div>

                  {/* User Identity: Initials Avatar, Name & Designation */}
                  <div className="flex items-start gap-3.5 mb-4">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm border shrink-0 shadow-xs ${palette.bg} ${palette.text} ${palette.border}`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4
                        className="font-semibold text-slate-900 dark:text-white text-base leading-snug truncate"
                        title={name}
                      >
                        {name}
                      </h4>
                      {designation ? (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 truncate max-w-full">
                          {designation}
                        </span>
                      ) : (
                        <span className="inline-block mt-0.5 text-xs text-slate-400 dark:text-neutral-500">
                          {isAdmin ? t("users.filter_admin") : t("users.filter_staff")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-neutral-400 mt-auto pt-2">
                    <div className="flex items-center gap-2 truncate" title={username}>
                      <IconMail
                        size={15}
                        className="shrink-0 text-slate-400 dark:text-neutral-500"
                        stroke={iconStroke}
                      />
                      <span className="truncate">{username}</span>
                    </div>
                    {phone ? (
                      <div className="flex items-center gap-2 truncate" title={phone}>
                        <IconPhone
                          size={15}
                          className="shrink-0 text-slate-400 dark:text-neutral-500"
                          stroke={iconStroke}
                        />
                        <span className="truncate font-mono">{phone}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Card Bottom / Permissions Preview Bar */}
                <div className="bg-slate-50/80 dark:bg-neutral-950/50 border-t border-slate-100 dark:border-neutral-800/80 px-4 py-3 flex items-center justify-between gap-2 rounded-b-2xl">
                  {isAdmin ? (
                    <div className="flex items-center justify-between w-full text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-neutral-300">
                        <IconShieldCheck size={16} className="text-indigo-500" />
                        {t("users.full_access")}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                        {Object.keys(SCOPES).length} / {Object.keys(SCOPES).length}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full text-xs">
                      <div className="min-w-0 pr-2">
                        <p
                          className="font-medium text-slate-800 dark:text-neutral-200 truncate"
                          title={presetInfo.title}
                        >
                          {presetInfo.title}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-neutral-500">
                          {presetInfo.count} {t("users.permissions_summary")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setViewingPermissionsUser({
                            name,
                            username,
                            role,
                            designation,
                            scopes: userScopes,
                          });
                          document
                            .getElementById("modal-view-permissions")
                            ?.showModal();
                        }}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-700 border border-slate-200 dark:border-neutral-700 transition active:scale-95 shadow-2xs cursor-pointer"
                      >
                        <IconEye
                          size={14}
                          className="text-slate-500 dark:text-neutral-400"
                        />
                        <span>{t("users.view_details")}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: View Assigned Permissions ── */}
      <dialog id="modal-view-permissions" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box w-full max-w-full sm:max-w-2xl p-0 max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 z-20 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-neutral-800 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                <IconShieldCheck size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                  {t("users.permissions_modal_title")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  {viewingPermissionsUser?.name} ({viewingPermissionsUser?.username})
                </p>
              </div>
            </div>
            <form method="dialog">
              <button className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer">
                <IconX size={20} />
              </button>
            </form>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {viewingPermissionsUser?.role === "admin" ? (
              <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-start gap-3">
                <IconShieldCheck className="text-indigo-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="font-semibold text-sm text-indigo-950 dark:text-indigo-200">
                    {t("users.full_access")}
                  </h4>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">
                    This account is an Administrator and has full operational access to all system modules, configurations, and reports.
                  </p>
                </div>
              </div>
            ) : viewingPermissionsUser?.scopes?.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="text-sm font-medium">{t("users.unassigned")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {SCOPE_CATEGORIES.map((cat) => {
                  const categoryScopes = cat.scopes.filter((scopeKey) =>
                    viewingPermissionsUser?.scopes?.includes(scopeKey)
                  );

                  if (categoryScopes.length === 0) return null;

                  return (
                    <div
                      key={cat.id}
                      className="rounded-xl border border-slate-200/90 dark:border-neutral-800 p-3.5 bg-slate-50/50 dark:bg-neutral-950/40 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
                          {cat.title}
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {categoryScopes.length} granted
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {categoryScopes.map((scopeKey) => {
                          const meta = SCOPE_METADATA[scopeKey];
                          return (
                            <span
                              key={scopeKey}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700/80 text-slate-800 dark:text-neutral-200 shadow-2xs"
                              title={meta?.description || scopeKey}
                            >
                              <IconCheck size={13} className="text-restro-green" />
                              {meta?.title || scopeKey}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 z-20 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-neutral-800 px-5 py-3 flex items-center justify-end">
            <form method="dialog">
              <button className="min-h-[38px] px-5 rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-200 text-xs font-semibold transition cursor-pointer">
                {t("users.close")}
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* ── Modal: Add New User ── */}
      <dialog id="modal-add" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box w-full max-w-full sm:max-w-4xl p-0 max-h-[92vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 z-20 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-neutral-800 px-4 sm:px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-1 bg-gray-300 dark:bg-zinc-700 rounded-full mx-auto sm:hidden absolute top-2 left-1/2 -translate-x-1/2" />
              <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <IconUserPlus className="text-restro-green" size={22} />
                {t("users.add_new_user")}
              </h3>
            </div>
            <form method="dialog">
              <button className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer">
                <IconX size={20} />
              </button>
            </form>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-hidden p-4 sm:p-6 space-y-4 flex flex-col min-h-0">
            <div className="shrink-0 bg-slate-50 dark:bg-neutral-950/60 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400 flex items-center gap-1.5">
                <IconUser size={16} className="text-restro-green" /> Details & Credentials
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="name" className="mb-1 block text-slate-700 dark:text-neutral-300 text-xs font-semibold">
                    {t("users.name_label")} <span className="text-xs text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <IconUser size={16} />
                    </div>
                    <input
                      ref={nameRef}
                      type="text"
                      name="name"
                      className="text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:border-restro-green"
                      placeholder={t("users.name_placeholder")}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="username" className="mb-1 block text-slate-700 dark:text-neutral-300 text-xs font-semibold">
                    {t("users.email_label")} <span className="text-xs text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <IconMail size={16} />
                    </div>
                    <input
                      ref={usernameRef}
                      type="email"
                      name="username"
                      className="text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:border-restro-green"
                      placeholder={t("users.email_placeholder")}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="password" className="mb-1 block text-slate-700 dark:text-neutral-300 text-xs font-semibold">
                    {t("users.password_label")} <span className="text-xs text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <IconLock size={16} />
                    </div>
                    <input
                      ref={passwordRef}
                      type="password"
                      name="password"
                      className="text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:border-restro-green"
                      placeholder={t("users.password_placeholder")}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="phone" className="mb-1 block text-slate-700 dark:text-neutral-300 text-xs font-semibold">
                    {t("users.phone_label")}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <IconPhone size={16} />
                    </div>
                    <input
                      ref={phoneRef}
                      type="tel"
                      name="phone"
                      className="text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:border-restro-green"
                      placeholder={t("users.phone_placeholder")}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="designation" className="mb-1 block text-slate-700 dark:text-neutral-300 text-xs font-semibold">
                    {t("users.designation_label")}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <IconId size={16} />
                    </div>
                    <input
                      ref={designationRef}
                      type="text"
                      name="designation"
                      className="text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:border-restro-green"
                      placeholder={t("users.designation_placeholder")}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Permission Matrix */}
            <PermissionSelector
              selectedScopes={selectedScopes}
              onChange={(newScopes) =>
                setState({
                  ...state,
                  selectedScopes: newScopes,
                })
              }
            />
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 z-20 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-neutral-800 px-4 sm:px-6 py-3 flex items-center justify-end gap-3 shadow-lg">
            <form method="dialog" className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="submit"
                className="flex-1 sm:flex-initial min-h-[42px] px-5 rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-200 text-xs font-semibold transition active:scale-95 cursor-pointer"
              >
                {t("users.close")}
              </button>
              <button
                type="button"
                onClick={btnAdd}
                className="flex-1 sm:flex-initial min-h-[42px] px-6 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white text-xs font-semibold transition active:scale-95 shadow-xs cursor-pointer"
              >
                {t("users.save")}
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* ── Modal: Update User ── */}
      <dialog id="modal-update" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box w-full max-w-full sm:max-w-4xl p-0 max-h-[92vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 z-20 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-neutral-800 px-4 sm:px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-1 bg-gray-300 dark:bg-zinc-700 rounded-full mx-auto sm:hidden absolute top-2 left-1/2 -translate-x-1/2" />
              <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <IconUserEdit className="text-restro-green" size={22} />
                {t("users.update_user")}
              </h3>
            </div>
            <form method="dialog">
              <button className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer">
                <IconX size={20} />
              </button>
            </form>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-hidden p-4 sm:p-6 space-y-4 flex flex-col min-h-0">
            <div className="shrink-0 bg-slate-50 dark:bg-neutral-950/60 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400 flex items-center gap-1.5">
                <IconUser size={16} className="text-restro-green" /> Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="username" className="mb-1 block text-slate-700 dark:text-neutral-300 text-xs font-semibold">
                    {t("users.username_label")}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <IconMail size={16} />
                    </div>
                    <input
                      ref={usernameUpdateRef}
                      disabled
                      type="email"
                      name="username"
                      className="text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800 text-slate-500 cursor-not-allowed opacity-75"
                      placeholder={t("users.username_placeholder")}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="name" className="mb-1 block text-slate-700 dark:text-neutral-300 text-xs font-semibold">
                    {t("users.name_label")} <span className="text-xs text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <IconUser size={16} />
                    </div>
                    <input
                      ref={nameUpdateRef}
                      type="text"
                      name="name"
                      className="text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:border-restro-green"
                      placeholder={t("users.name_placeholder")}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="phone" className="mb-1 block text-slate-700 dark:text-neutral-300 text-xs font-semibold">
                    {t("users.phone_label")}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <IconPhone size={16} />
                    </div>
                    <input
                      ref={phoneUpdateRef}
                      type="tel"
                      name="phone"
                      className="text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:border-restro-green"
                      placeholder={t("users.phone_placeholder")}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="designation" className="mb-1 block text-slate-700 dark:text-neutral-300 text-xs font-semibold">
                    {t("users.designation_label")}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <IconId size={16} />
                    </div>
                    <input
                      ref={designationUpdateRef}
                      type="text"
                      name="designation"
                      className="text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:border-restro-green"
                      placeholder={t("users.designation_placeholder")}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Permission Matrix */}
            <PermissionSelector
              selectedScopes={selectedScopes}
              onChange={(newScopes) =>
                setState({
                  ...state,
                  selectedScopes: newScopes,
                })
              }
            />
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 z-20 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-neutral-800 px-4 sm:px-6 py-3 flex items-center justify-end gap-3 shadow-lg">
            <form method="dialog" className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="submit"
                className="flex-1 sm:flex-initial min-h-[42px] px-5 rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-200 text-xs font-semibold transition active:scale-95 cursor-pointer"
              >
                {t("users.close")}
              </button>
              <button
                type="button"
                onClick={btnUpdate}
                className="flex-1 sm:flex-initial min-h-[42px] px-6 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white text-xs font-semibold transition active:scale-95 shadow-xs cursor-pointer"
              >
                {t("users.save")}
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* ── Modal: Reset Password ── */}
      <dialog id="modal-reset-password" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box w-full max-w-full sm:max-w-md p-0 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden">
          <div className="sticky top-0 z-20 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-neutral-800 px-4 sm:px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-1 bg-gray-300 dark:bg-zinc-700 rounded-full mx-auto sm:hidden absolute top-2 left-1/2 -translate-x-1/2" />
              <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <IconKey className="text-amber-500" size={22} />
                {t("users.reset_password")}
              </h3>
            </div>
            <form method="dialog">
              <button className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer">
                <IconX size={20} />
              </button>
            </form>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div>
              <label htmlFor="username" className="mb-1 block text-slate-700 dark:text-neutral-300 text-xs font-semibold">
                {t("users.username_label")}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <IconMail size={16} />
                </div>
                <input
                  ref={changePasswordModalUsernameRef}
                  disabled
                  type="text"
                  name="username"
                  className="text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800 text-slate-500 cursor-not-allowed opacity-75"
                  placeholder={t("users.username_placeholder")}
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-slate-700 dark:text-neutral-300 text-xs font-semibold">
                {t("users.password_label")} <span className="text-xs text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <IconLock size={16} />
                </div>
                <input
                  ref={changePasswordModalNewPasswordRef}
                  type="password"
                  name="password"
                  className="text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:border-restro-green"
                  placeholder={t("users.password_placeholder")}
                />
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-20 border-t border-slate-200 dark:border-neutral-800 px-4 sm:px-6 py-3 flex items-center justify-end gap-3 bg-white/95 dark:bg-neutral-900/95 shadow-lg">
            <form method="dialog" className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="submit"
                className="flex-1 sm:flex-initial min-h-[42px] px-5 rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-200 text-xs font-semibold transition active:scale-95 cursor-pointer"
              >
                {t("users.close")}
              </button>
              <button
                type="button"
                onClick={btnChangePassword}
                className="flex-1 sm:flex-initial min-h-[42px] px-6 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white text-xs font-semibold transition active:scale-95 shadow-xs cursor-pointer"
              >
                {t("users.save")}
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* ── Modal: Delete Confirmation ── */}
      <DeleteModal
        isOpen={Boolean(userToDelete)}
        onClose={() => setUserToDelete(null)}
        onConfirm={async () => {
          const target = userToDelete;
          setUserToDelete(null);
          await btnDelete(target);
        }}
        title={t("users.delete_user")}
        description={t("users.delete_confirm")}
      />
    </Page>
  );
}
