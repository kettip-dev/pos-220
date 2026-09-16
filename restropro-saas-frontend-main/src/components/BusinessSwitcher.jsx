import React, { Fragment, useEffect, useState } from "react";
import { Menu, Transition } from "@headlessui/react";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import {
  IconBuilding,
  IconBuildingStore,
  IconCheck,
  IconChevronDown,
  IconEye,
} from "@tabler/icons-react";

import { iconStroke } from "../config/config";
import {
  getUserDetailsInLocalStorage,
  saveUserDetailsInLocalStorage,
} from "../helpers/UserDetails";
import {
  hasGroupOwnerCapability,
  SCOPE_ALL,
  SCOPE_TENANT,
  getBusinessScope,
  saveBusinessScope,
} from "../helpers/BusinessScope";
import { getMyBusinesses, switchBusiness } from "../controllers/auth.controller";

/**
 * Business Switcher (Phase 2) — Business Group Owners only.
 *
 * Renders nothing at all for Business Admins and Staff, so their AppBar is
 * unchanged. The backend independently rejects /auth/my-businesses and
 * /auth/switch-business for those roles, so hiding this is a UX measure only —
 * it is never the access control.
 *
 * Switching calls the backend, which re-issues the auth cookies with the new
 * tenant context. The page is then reloaded so every already-mounted screen
 * refetches against the newly selected business rather than showing stale data
 * from the previous one.
 */
export default function BusinessSwitcher() {
  const { t } = useTranslation();
  const user = getUserDetailsInLocalStorage();

  const [state, setState] = useState({
    businesses: [],
    activeTenantId: null,
    permissionLevel: null,
    businessGroupName: null,
    isLoading: false,
    isSwitching: false,
  });

  // CAPABILITY, not role: a dual-role Business Admin (role "admin" with a
  // business_group_id) must see the switcher too. Keying on the role alone hid
  // it from them entirely.
  const isGroupOwner = hasGroupOwnerCapability(user);

  useEffect(() => {
    if (!isGroupOwner) return;

    let cancelled = false;

    const fetchBusinesses = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true }));
        const { data } = await getMyBusinesses();

        if (cancelled) return;

        setState((prev) => ({
          ...prev,
          businesses: data?.businesses || [],
          activeTenantId: data?.activeTenantId ?? null,
          permissionLevel: data?.permissionLevel ?? null,
          businessGroupName: data?.businessGroupName ?? null,
          isLoading: false,
        }));
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    fetchBusinesses();

    return () => {
      cancelled = true;
    };
  }, [isGroupOwner]);

  // Business Admins and Staff must never see the switcher.
  if (!isGroupOwner) {
    return null;
  }

  const activeBusiness =
    state.businesses.find((b) => b.tenantId === state.activeTenantId) || null;

  // Enterprise consolidated view. Purely a client preference — no API call, and
  // `active_tenant_id` on the server is left alone so switching back returns to
  // the business the owner was last on.
  const isAllBusinesses = getBusinessScope(user?.role) === SCOPE_ALL;

  const btnSelectAllBusinesses = () => {
    if (isAllBusinesses || state.isSwitching) return;
    saveBusinessScope(SCOPE_ALL);
    // Full reload for the same reason an individual switch reloads: every
    // mounted screen must refetch against the new scope.
    window.location.reload();
  };

  const btnSwitch = async (tenantId) => {
    if (state.isSwitching) return;

    // Already on this business in single-business mode -> nothing to do. While
    // consolidating, the SAME business is still a real change (all -> that one),
    // so it must not be short-circuited here.
    if (!isAllBusinesses && tenantId === state.activeTenantId) return;

    // Leaving the consolidated view. Recorded before the request so a failure
    // cannot strand the UI showing "All Businesses" over single-business data.
    saveBusinessScope(SCOPE_TENANT);

    try {
      setState((prev) => ({ ...prev, isSwitching: true }));
      toast.loading(t("business_switcher.switching", "Switching business..."));

      const res = await switchBusiness(tenantId);

      if (res.status == 200) {
        // The selection lives server-side on the user row — switching issues no
        // new token. Mirror it into the cached user so the reload does not
        // briefly render the previous business.
        const current = getUserDetailsInLocalStorage();
        if (current) {
          saveUserDetailsInLocalStorage({
            ...current,
            tenant_id: res.data?.activeTenantId ?? tenantId,
          });
        }

        toast.dismiss();
        toast.success(res.data.message);

        // Full reload: every mounted screen must refetch for the new business.
        window.location.reload();
        return;
      }

      setState((prev) => ({ ...prev, isSwitching: false }));
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message ||
        t("business_switcher.switch_failed", "Could not switch business");

      toast.dismiss();
      toast.error(message);
      setState((prev) => ({ ...prev, isSwitching: false }));
    }
  };

  const isReadOnly = state.permissionLevel === "read";

  return (
    <Menu as="div" className="relative inline-block text-left">
      <Menu.Button
        disabled={state.isSwitching}
        className="rounded-lg w-full flex items-center justify-between gap-2 px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/15 text-white disabled:opacity-60 transition cursor-pointer shadow-2xs"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isAllBusinesses ? (
            <IconBuilding size={18} stroke={iconStroke} className="text-emerald-400 shrink-0" />
          ) : (
            <IconBuildingStore size={18} stroke={iconStroke} className="text-emerald-400 shrink-0" />
          )}
          <div className="text-start truncate">
            <div className="text-[11px] text-slate-300 leading-none">
              {isAllBusinesses
                ? t("business_switcher.viewing", "Viewing")
                : t("business_switcher.current_business", "Current Business")}
            </div>
            <div className="text-sm font-semibold leading-tight text-white truncate mt-0.5">
              {isAllBusinesses
                ? t("business_switcher.all_businesses", "All Businesses")
                : state.isLoading
                  ? t("business_switcher.loading", "Loading...")
                  : activeBusiness?.name ||
                    t("business_switcher.no_business_selected", "Select a business")}
            </div>
          </div>
        </div>
        <IconChevronDown size={16} stroke={iconStroke} className="text-slate-300 shrink-0" />
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute left-0 z-[10000] mt-2 w-72 origin-top-left divide-y divide-gray-100 dark:divide-zinc-800 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl focus:outline-none">
          <div className="px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("business_switcher.business_group", "Business Group")}
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {state.businessGroupName || "-"}
            </p>
            {isReadOnly && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-[42px] bg-gray-100 dark:bg-zinc-800 px-2 py-1 text-xs text-gray-600 dark:text-gray-300">
                <IconEye size={12} stroke={iconStroke} />
                {t("business_switcher.read_only", "Read Only")}
              </span>
            )}
          </div>

          {/* Enterprise consolidated view, pinned above the individual
              businesses. Group Owners only — this whole component already
              returns null for Business Admins and Staff. */}
          <div className="py-2">
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={btnSelectAllBusinesses}
                  disabled={state.isSwitching}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 transition-colors ${
                    active ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white" : ""
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <IconBuilding size={16} stroke={iconStroke} />
                    <span className="font-medium">
                      {t("business_switcher.all_businesses", "All Businesses")}
                    </span>
                  </span>
                  {isAllBusinesses && (
                    <IconCheck
                      size={16}
                      stroke={iconStroke}
                      className="text-[#2CA01C]"
                    />
                  )}
                </button>
              )}
            </Menu.Item>
          </div>

          <div className="max-h-72 overflow-y-auto py-2 divide-y divide-gray-100 dark:divide-zinc-800/50">
            {state.businesses.length === 0 ? (
              <p className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                {t("business_switcher.no_businesses", "No businesses in this group")}
              </p>
            ) : (
              state.businesses.map((business) => (
                <Menu.Item key={business.tenantId}>
                  {({ active }) => (
                    <button
                      onClick={() => btnSwitch(business.tenantId)}
                      disabled={state.isSwitching}
                      className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 transition-colors ${
                        active ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white" : ""
                      }`}
                    >
                      <span className="flex flex-col items-start">
                        <span className="font-medium">{business.name}</span>
                        {/* The user's own business is reached with full admin
                            rights, and stays listed even after it has been
                            unlinked from the group — the two accesses are
                            independent. Labelling it avoids it looking like a
                            group member. */}
                        {business.isOwnBusiness && (
                          <span className="text-xs text-gray-500">
                            {business.isGroupMember
                              ? t("business_switcher.your_business", "Your business")
                              : t(
                                  "business_switcher.your_business_not_in_group",
                                  "Your business · not in this group",
                                )}
                          </span>
                        )}
                        {business.isActive != 1 && (
                          <span className="text-xs text-red-500">
                            {t("business_switcher.inactive", "Inactive")}
                          </span>
                        )}
                      </span>
                      {!isAllBusinesses && business.tenantId === state.activeTenantId && (
                        <IconCheck
                          size={16}
                          stroke={iconStroke}
                          className="text-restro-green"
                        />
                      )}
                    </button>
                  )}
                </Menu.Item>
              ))
            )}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
