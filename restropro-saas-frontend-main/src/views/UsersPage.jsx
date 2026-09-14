import React, { useRef, useState } from "react";
import Page from "../components/Page";
import { isAllBusinessesScope } from "../helpers/BusinessScope";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import DeleteModal from "../components/DeleteModal";
import {
  IconId,
  IconInfoCircle,
  IconKey,
  IconLock,
  IconMail,
  IconPhone,
  IconPlus,
  IconUser,
  IconUserEdit,
  IconUserPlus,
  IconX,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { SCOPES } from "../config/scopes";
import { toast } from "react-hot-toast";
import { mutate } from "swr";
import { addNewUser, deleteUser, resetUserPassword, updateUser, useUsers } from "../controllers/users.controller";
import { validateEmail } from "../utils/emailValidator";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import PermissionSelector from "../components/PermissionSelector";

export default function UsersPage() {
  const { t } = useTranslation();
  // Enterprise "All Businesses" view: read-only staff summary. All user
  // management is gated to a single business by the backend.
  const isConsolidated = isAllBusinessesScope(getUserDetailsInLocalStorage()?.role);
  const [state, setState] = useState({
    selectedScopes: [],
  });

  const [userToDelete, setUserToDelete] = useState(null);

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
  const emailUpdateRef = useRef();
  const designationUpdateRef = useRef();

  const { APIURL, data: users, error, isLoading } = useUsers();
  const {theme} = useTheme();

  if (isLoading) {
    return <Page>{t("users.loading")}</Page>;
  }

  if (error) {
    console.error(error);
    return <Page>{t("users.error_loading")}</Page>;
  }

  const { selectedScopes } = state;

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
    if(!validateEmail(username)) {
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

      if (res.status == 200) {
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

      if(res.status == 200) {
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
    document.getElementById("modal-reset-password").showModal()
  };

  const btnChangePassword = async () => {
    const username = changePasswordModalUsernameRef.current.value;
    const password = changePasswordModalNewPasswordRef.current.value;

    if(!(username)) {
      toast.error(t("users.invalid_request"));
      return;
    }
    if(!(password)) {
      toast.error(t("users.new_password_error"));
      return;
    }

    try {
      toast.loading(t("users.loading_message"));
      const res = await resetUserPassword(
        username,
        password,
      );

      if (res.status == 200) {
        
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
      selectedScopes: scope ? new String(scope).split(",") : []
    })

    document.getElementById("modal-update").showModal()
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
        name, designation, phone, null, userScopes
      );

      if (res.status == 200) {
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

  return (
    <Page>
      <div className="flex items-center gap-6">
        <h3 className="text-3xl font-light">{t("users.title")}</h3>
        <button
          onClick={() => document.getElementById("modal-add").showModal()}
          className='border transition active:scale-95 hover:shadow-lg px-2 py-1 flex items-center gap-1 w-fit text-restro-text rounded-lg bg-restro-card-bg border-restro-border-green hover:bg-restro-button-hover'
        >
          <IconPlus size={22} stroke={iconStroke} /> {t("users.new")}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
        {users.map((user, index) => {
          const {
            username,
            name,
            role,
            photo,
            designation,
            phone,
            email,
            scope,
            business,
          } = user;

          const userScopes = scope ? new String(scope).split(",") : [];

          return (
            <div
              key={index}
              className='px-4 py-5 flex-col rounded-2xl flex flex-wrap items-center gap-2 text-sm border border-restro-border-green'
            >
              <div className="flex-1">
                <div className="flex items-center flex-col text-center gap-2">
                  <div className='flex w-24 h-24 rounded-full items-center justify-center text-gray-500 dark:text-white bg-restro-bg-gray border-restro-border-green'>
                    <IconUser size={32} stroke={iconStroke} />
                  </div>
                  <div>
                    <p>{name}</p>
                    <p className="text-xs text-gray-500">
                      {role.toUpperCase()} 
                    </p>
                    {isConsolidated && business && (
                      <span className="inline-block mt-1 rounded-[42px] bg-restro-gray px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {business}
                      </span>
                    )}
                    <p className="flex gap-1 text-xs text-gray-500"><IconMail stroke={iconStroke} size={18} /> {username}</p>
                    {designation && <p className="text-xs text-white bg-restro-green rounded-full w-fit px-2 mx-auto mt-1">{designation}</p>}
                  </div>
                </div>

                {phone && (
                  <p className="mt-2 text-sm flex items-center gap-1 text-gray-500">
                    <IconPhone stroke={iconStroke} size={18} /> {phone}
                  </p>
                )}
                {email && (
                  <p className="mt-2 text-sm flex flex-wrap items-center gap-1 text-gray-500 truncate ">
                    <IconMail stroke={iconStroke} size={18} /> {email}
                  </p>
                )}

                {userScopes.length > 0 && (
                  <div>
                    <p className="text-xs mt-2 mb-2">{t("users.scopes")}:</p>
                    <div className="flex flex-wrap gap-2 w-full">
                      {userScopes.map((s, i) => (
                        <div
                          key={i}
                          className='text-xs dark:rounded-full gap-1 flex items-center px-2 py-1 border rounded-full bg-restro-gray border-restro-border-green text-restro-text outline-restro-border-green-light'
                        >
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {role != "admin" && (
                <div className="flex flex-wrap gap-2 mt-4 ">
                  <button
                    onClick={() => {
                      btnShowUpdate(username, name, phone, null, designation, scope);
                    }}
                    // className="btn btn-xs text-gray-500 flex-1"
                    className='btn btn-xs flex-1 transition active:scale-95 hover:shadow-lg px-4 py-1 h-9 items-center justify-center align-center rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text'
                  >
                    {t("users.edit_user")}
                  </button>
                  <button
                    onClick={() => {
                      btnShowChangePassword(username);
                    }}
                    className='btn btn-xs flex-1 transition active:scale-95 hover:shadow-lg px-4 py-1 h-9 items-center justify-center align-center rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text'
                  >
                    {t("users.reset_password")}
                  </button>
                  <button
                    onClick={() => {
                      setUserToDelete(username);
                    }}
                    className='btn btn-xs text-restro-red flex-1 transition active:scale-95 hover:shadow-lg px-4 py-1 h-9 items-center justify-center align-center rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover'
                  >
                    {t("users.delete_user")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* modal add */}
      <dialog id="modal-add" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box w-full max-w-full sm:max-w-4xl p-0 max-h-[92vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-restro-border-green bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden'>
          
          {/* Header */}
          <div className="sticky top-0 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-b border-restro-border-green px-4 sm:px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-1 bg-gray-300 dark:bg-zinc-700 rounded-full mx-auto sm:hidden absolute top-2 left-1/2 -translate-x-1/2" />
              <h3 className="font-bold text-base sm:text-lg text-restro-text flex items-center gap-2">
                <IconUserPlus className="text-restro-green" size={22} />
                {t("users.add_new_user")}
              </h3>
            </div>
            <form method="dialog">
              <button className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors">
                <IconX size={20} />
              </button>
            </form>
          </div>

          {/* Main Body Container (Fixed/Non-Scrollable) */}
          <div className="flex-1 overflow-hidden p-4 sm:p-6 space-y-4 flex flex-col min-h-0">
            <div className="shrink-0 bg-restro-gray/40 dark:bg-zinc-950/60 p-3.5 sm:p-4 rounded-2xl border border-restro-border-green space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                <IconUser size={16} className="text-restro-green" /> Details & Credentials
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="name" className="mb-1 block text-restro-text text-xs font-semibold">
                    {t("users.name_label")} <span className="text-xs text-gray-400">- ({t("users.required")})</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <IconUser size={16} />
                    </div>
                    <input
                      ref={nameRef}
                      type="text"
                      name="name"
                      className='text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-restro-border-green bg-restro-gray dark:bg-black focus:outline-restro-border-green'
                      placeholder={t("users.name_placeholder")}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="username" className="mb-1 block text-restro-text text-xs font-semibold">
                    {t("users.email_label")} <span className="text-xs text-gray-400">- ({t("users.required")})</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <IconMail size={16} />
                    </div>
                    <input
                      ref={usernameRef}
                      type="email"
                      name="username"
                      className='text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-restro-border-green bg-restro-gray dark:bg-black focus:outline-restro-border-green'
                      placeholder={t("users.email_placeholder")}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="password" className="mb-1 block text-restro-text text-xs font-semibold">
                    {t("users.password_label")} <span className="text-xs text-gray-400">- ({t("users.required")})</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <IconLock size={16} />
                    </div>
                    <input
                      ref={passwordRef}
                      type="password"
                      name="password"
                      className='text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-restro-border-green bg-restro-gray dark:bg-black focus:outline-restro-border-green'
                      placeholder={t("users.password_placeholder")}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="phone" className="mb-1 block text-restro-text text-xs font-semibold">
                    {t("users.phone_label")}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <IconPhone size={16} />
                    </div>
                    <input
                      ref={phoneRef}
                      type="tel"
                      name="phone"
                      className='text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-restro-border-green bg-restro-gray dark:bg-black focus:outline-restro-border-green'
                      placeholder={t("users.phone_placeholder")}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="designation" className="mb-1 block text-restro-text text-xs font-semibold">
                    {t("users.designation_label")}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <IconId size={16} />
                    </div>
                    <input
                      ref={designationRef}
                      type="text"
                      name="designation"
                      className='text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-restro-border-green bg-restro-gray dark:bg-black focus:outline-restro-border-green'
                      placeholder={t("users.designation_placeholder")}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* PERMISSION ASSIGNMENT MATRIX */}
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

          {/* Footer Action Bar */}
          <div className="sticky bottom-0 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-t border-restro-border-green px-4 sm:px-6 py-3 flex items-center justify-end gap-3 shadow-lg">
            <form method="dialog" className="flex items-center gap-3 w-full sm:w-auto">
              <button type="submit" className='flex-1 sm:flex-initial btn btn-sm transition active:scale-95 px-5 py-2 rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text font-semibold'>
                {t("users.close")}
              </button>
              <button
                type="button"
                onClick={() => {
                  btnAdd();
                }}
                className='flex-1 sm:flex-initial btn btn-sm rounded-xl transition active:scale-95 px-6 py-2 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover font-semibold shadow-xs'
              >
                {t("users.save")}
              </button>
            </form>
          </div>
        </div>
      </dialog>
      {/* modal add */}

      {/* modal update */}
      <dialog id="modal-update" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box w-full max-w-full sm:max-w-4xl p-0 max-h-[92vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-restro-border-green bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden'>
          
          {/* Header */}
          <div className="sticky top-0 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-b border-restro-border-green px-4 sm:px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-1 bg-gray-300 dark:bg-zinc-700 rounded-full mx-auto sm:hidden absolute top-2 left-1/2 -translate-x-1/2" />
              <h3 className="font-bold text-base sm:text-lg text-restro-text flex items-center gap-2">
                <IconUserEdit className="text-restro-green" size={22} />
                {t("users.update_user")}
              </h3>
            </div>
            <form method="dialog">
              <button className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors">
                <IconX size={20} />
              </button>
            </form>
          </div>

          {/* Main Body Container (Fixed/Non-Scrollable) */}
          <div className="flex-1 overflow-hidden p-4 sm:p-6 space-y-4 flex flex-col min-h-0">
            <div className="shrink-0 bg-restro-gray/40 dark:bg-zinc-950/60 p-3.5 sm:p-4 rounded-2xl border border-restro-border-green space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                <IconUser size={16} className="text-restro-green" /> Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="username" className="mb-1 block text-gray-500 text-xs font-semibold">
                    {t("users.username_label")} <span className="text-xs text-gray-400">- ({t("users.required")})</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <IconMail size={16} />
                    </div>
                    <input
                      ref={usernameUpdateRef}
                      disabled
                      type="email"
                      name="username"
                      className='text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-restro-border-green bg-restro-gray dark:bg-black focus:outline-restro-border-green cursor-not-allowed opacity-75'
                      placeholder={t("users.username_placeholder")}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="name" className="mb-1 block text-gray-500 text-xs font-semibold">
                    {t("users.name_label")} <span className="text-xs text-gray-400">- ({t("users.required")})</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <IconUser size={16} />
                    </div>
                    <input
                      ref={nameUpdateRef}
                      type="text"
                      name="name"
                      className='text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-restro-border-green bg-restro-gray dark:bg-black focus:outline-restro-border-green'
                      placeholder={t("users.name_placeholder")}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="phone" className="mb-1 block text-gray-500 text-xs font-semibold">
                    {t("users.phone_label")}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <IconPhone size={16} />
                    </div>
                    <input
                      ref={phoneUpdateRef}
                      type="tel"
                      name="phone"
                      className='text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-restro-border-green bg-restro-gray dark:bg-black focus:outline-restro-border-green'
                      placeholder={t("users.phone_placeholder")}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="designation" className="mb-1 block text-gray-500 text-xs font-semibold">
                    {t("users.designation_label")}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <IconId size={16} />
                    </div>
                    <input
                      ref={designationUpdateRef}
                      type="text"
                      name="designation"
                      className='text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-restro-border-green bg-restro-gray dark:bg-black focus:outline-restro-border-green'
                      placeholder={t("users.designation_placeholder")}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* PERMISSION ASSIGNMENT MATRIX */}
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

          {/* Footer Action Bar */}
          <div className="sticky bottom-0 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-t border-restro-border-green px-4 sm:px-6 py-3 flex items-center justify-end gap-3 shadow-lg">
            <form method="dialog" className="flex items-center gap-3 w-full sm:w-auto">
              <button type="submit" className='flex-1 sm:flex-initial btn btn-sm transition active:scale-95 px-5 py-2 rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text font-semibold'>
                {t("users.close")}
              </button>
              <button
                type="button"
                onClick={() => {
                  btnUpdate();
                }}
                className='flex-1 sm:flex-initial btn btn-sm rounded-xl transition active:scale-95 px-6 py-2 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover font-semibold shadow-xs'
              >
                {t("users.save")}
              </button>
            </form>
          </div>
        </div>
      </dialog>
      {/* modal update */}

      {/* modal reset password */}
      <dialog id="modal-reset-password" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box w-full max-w-full sm:max-w-md p-0 rounded-t-3xl sm:rounded-2xl border border-restro-border-green bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden'>
          <div className="sticky top-0 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-b border-restro-border-green px-4 sm:px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-1 bg-gray-300 dark:bg-zinc-700 rounded-full mx-auto sm:hidden absolute top-2 left-1/2 -translate-x-1/2" />
              <h3 className="font-bold text-base sm:text-lg text-restro-text flex items-center gap-2">
                <IconKey className="text-restro-green" size={22} />
                {t("users.reset_password")}
              </h3>
            </div>
            <form method="dialog">
              <button className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors">
                <IconX size={20} />
              </button>
            </form>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex-1">
              <label
                htmlFor="username"
                className="mb-1 block text-gray-500 text-xs font-semibold"
              >
                {t("users.username_label")}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <IconMail size={16} />
                </div>
                <input
                  ref={changePasswordModalUsernameRef}
                  disabled
                  type="text"
                  name="username"
                  className='text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green opacity-75'
                  placeholder={t("users.username_placeholder")}
                />
              </div>
            </div>
            <div className="flex-1">
              <label
                htmlFor="password"
                className="mb-1 block text-gray-500 text-xs font-semibold"
              >
                {t("users.password_label")}{" "}
                <span className="text-xs text-gray-400">- ({t("users.required")})</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <IconLock size={16} />
                </div>
                <input
                  ref={changePasswordModalNewPasswordRef}
                  type="password"
                  name="password"
                  className='text-xs sm:text-sm w-full rounded-xl pl-9 pr-3 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green'
                  placeholder={t("users.password_placeholder")}
                />
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-20 border-t border-restro-border-green px-4 sm:px-6 py-3 flex items-center justify-end gap-3 bg-white/95 dark:bg-zinc-900/95 shadow-lg">
            <form method="dialog" className="flex items-center gap-3 w-full sm:w-auto">
              <button type="submit" className='flex-1 sm:flex-initial btn btn-sm transition active:scale-95 px-5 py-2 rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text font-semibold'>
                {t("users.close")}
              </button>
              <button
                type="button"
                onClick={() => {
                  btnChangePassword();
                }}
                className='flex-1 sm:flex-initial btn btn-sm rounded-xl transition active:scale-95 px-6 py-2 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover font-semibold shadow-xs'
              >
                {t("users.save")}
              </button>
            </form>
          </div>
        </div>
      </dialog>
      {/* modal change password */}

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
