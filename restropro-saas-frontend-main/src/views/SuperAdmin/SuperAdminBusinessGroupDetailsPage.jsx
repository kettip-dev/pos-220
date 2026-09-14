import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import {
  IconSearch,
  IconBuildingStore,
  IconUsersGroup,
  IconCheck,
  IconX,
  IconArrowLeft,
  IconLinkPlus,
  IconUnlink,
  IconUserPlus,
  IconUserMinus,
  IconUserShield,
  IconEye,
  IconPencil,
} from "@tabler/icons-react";
import { toast } from "react-hot-toast";

import Page from "../../components/Page";
import DeleteModal from "../../components/DeleteModal";
import { iconStroke } from "../../config/config";
import useDebounce from "../../utils/useDebounce";
import { validateEmail } from "../../utils/emailValidator";
import {
  getBusinessGroupDetails,
  getAvailableBusinesses,
  linkBusinessToGroup,
  unlinkBusinessFromGroup,
  getBusinessGroupOwners,
  createBusinessGroupOwner,
  updateBusinessGroupOwnerStatus,
  updateBusinessGroupOwnerPermission,
  removeBusinessGroupOwner,
  getGroupOwnerCandidates,
  assignExistingUserAsGroupOwner,
  removeGroupOwnerCapability,
} from "../../controllers/business_group.controller";

/**
 * Business Group Details (Phase 1) — Super Admin only.
 * Shows the group header plus its member businesses, and manages membership.
 * Linking only ever changes tenants.business_group_id; the businesses stay
 * fully independent tenants.
 */
export default function SuperAdminBusinessGroupDetailsPage() {
  const { t } = useTranslation();
  const params = useParams();
  const groupId = params.id;

  const selectedBusinessRef = useRef();

  // Owner assignment (Phase 2)
  const ownerFirstNameRef = useRef();
  const ownerLastNameRef = useRef();
  const ownerEmailRef = useRef();
  const ownerPhoneRef = useRef();
  const ownerPasswordRef = useRef();
  const ownerPermissionRef = useRef();
  const ownerStatusRef = useRef();
  const changePermissionRef = useRef();

  const [state, setState] = useState({
    group: null,
    businesses: [],
    isLoading: true,
    error: null,
  });

  // Business Group Owners section (Phase 2)
  const [ownersState, setOwnersState] = useState({
    owners: [],
    isLoading: false,
  });

  // "Create Group Owner" dialog
  const [isCreatingOwner, setIsCreatingOwner] = useState(false);

  // Owner assignment has two routes to the same capability:
  //   "create" — a NEW dedicated account that exists only to own the group
  //   "assign" — grant the capability to an EXISTING Business Admin, who keeps
  //              their role, business, password and history (dual role)
  const [assignState, setAssignState] = useState({
    tab: "create",
    search: "",
    candidates: [],
    isSearching: false,
    selected: null,
    permissionLevel: "read",
    isAssigning: false,
  });

  // "Change Permission" dialog target
  const [ownerForPermission, setOwnerForPermission] = useState(null);

  // "Remove Owner" confirmation target
  const [ownerForRemoval, setOwnerForRemoval] = useState(null);

  // "Link Business" dialog
  const [linkState, setLinkState] = useState({
    search: "",
    availableBusinesses: [],
    isLoading: false,
  });

  // "Remove Link" confirmation
  const [businessForUnlink, setBusinessForUnlink] = useState(null);

  const fetchData = async () => {
    try {
      const { data } = await getBusinessGroupDetails(groupId);

      setState({
        group: data.group,
        businesses: data.businesses || [],
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error(error);
      setState((prevState) => ({
        ...prevState,
        isLoading: false,
        error:
          error?.response?.data?.message ||
          t("superadmin_business_groups.error_loading_group", "Error loading business group"),
      }));
    }
  };

  const fetchOwners = async () => {
    try {
      setOwnersState((prev) => ({ ...prev, isLoading: true }));
      const { data } = await getBusinessGroupOwners(groupId);

      setOwnersState({
        owners: data?.owners || [],
        isLoading: false,
      });
    } catch (error) {
      console.error(error);
      setOwnersState((prev) => ({ ...prev, isLoading: false }));
      toast.dismiss();
      toast.error(
        error?.response?.data?.message ||
          t("superadmin_business_groups.error_loading_owners", "Error loading group owners"),
      );
    }
  };

  useEffect(() => {
    if (!groupId) return;
    fetchData();
    fetchOwners();
  }, [groupId]);

  const btnShowCreateOwnerDialog = () => {
    ownerFirstNameRef.current.value = "";
    ownerLastNameRef.current.value = "";
    ownerEmailRef.current.value = "";
    ownerPhoneRef.current.value = "";
    ownerPasswordRef.current.value = "";
    ownerPermissionRef.current.value = "read";
    ownerStatusRef.current.value = "active";

    // Reopening always starts on the create tab with a clean assign panel, so a
    // previous search or selection never leaks into the next assignment.
    setAssignState({
      tab: "create",
      search: "",
      candidates: [],
      isSearching: false,
      selected: null,
      permissionLevel: "read",
      isAssigning: false,
    });

    document.getElementById("modal-create-owner").showModal();
  };

  /** Load eligible Business Admins. Runs on tab open and on each search. */
  const loadCandidates = async (search) => {
    setAssignState((prev) => ({ ...prev, isSearching: true }));
    try {
      const res = await getGroupOwnerCandidates(groupId, search);
      setAssignState((prev) => ({
        ...prev,
        candidates: res?.data?.candidates || [],
        isSearching: false,
      }));
    } catch (error) {
      console.error(error);
      setAssignState((prev) => ({ ...prev, candidates: [], isSearching: false }));
      toast.error(
        error?.response?.data?.message ||
          t("superadmin_business_groups.something_went_wrong", "Something went wrong"),
      );
    }
  };

  const btnSelectAssignTab = () => {
    setAssignState((prev) => ({ ...prev, tab: "assign" }));
    loadCandidates("");
  };

  /**
   * Grant Group Owner capability to the selected Business Admin.
   *
   * Additive: no account is created and the user keeps administering their own
   * business. The backend answers 409 with a `reason` for the validation cases
   * (already in a group, inactive, not a Business Admin).
   */
  const btnAssignExistingUser = async () => {
    const { selected, permissionLevel } = assignState;

    if (!selected) {
      toast.error(
        t("superadmin_business_groups.select_a_user", "Select a user to assign"),
      );
      return;
    }

    setAssignState((prev) => ({ ...prev, isAssigning: true }));
    try {
      toast.loading(t("superadmin_business_groups.please_wait", "Please wait..."));
      const res = await assignExistingUserAsGroupOwner(
        groupId,
        selected.username,
        permissionLevel,
      );
      toast.dismiss();

      if (res.status === 200) {
        toast.success(res.data.message);
        document.getElementById("modal-create-owner").close();
        await fetchOwners();
      }
    } catch (error) {
      toast.dismiss();
      console.error(error);
      toast.error(
        error?.response?.data?.message ||
          t("superadmin_business_groups.something_went_wrong", "Something went wrong"),
      );
    } finally {
      setAssignState((prev) => ({ ...prev, isAssigning: false }));
    }
  };

  const btnCreateOwner = async () => {
    const firstName = ownerFirstNameRef.current?.value?.trim();
    const lastName = ownerLastNameRef.current?.value?.trim();
    const email = ownerEmailRef.current?.value?.trim();
    const phone = ownerPhoneRef.current?.value?.trim();
    const password = ownerPasswordRef.current?.value;
    const permissionLevel = ownerPermissionRef.current?.value;
    const status = ownerStatusRef.current?.value;

    // Client-side checks are for feedback only — the backend re-validates all
    // of this and is the source of truth.
    if (!firstName) {
      toast.error(t("superadmin_business_groups.please_provide_first_name", "Please provide a first name"));
      return;
    }

    if (!email) {
      toast.error(t("superadmin_business_groups.please_provide_email", "Please provide an email"));
      return;
    }

    if (!validateEmail(email)) {
      toast.error(t("superadmin_business_groups.please_provide_valid_email", "Please provide a valid email"));
      return;
    }

    if (!password || password.length < 8) {
      toast.error(t("superadmin_business_groups.password_too_short", "Password must be at least 8 characters"));
      return;
    }

    try {
      setIsCreatingOwner(true);
      toast.loading(t("superadmin_business_groups.please_wait", "Please wait..."));

      const res = await createBusinessGroupOwner(groupId, {
        firstName,
        lastName,
        email,
        phone,
        password,
        permissionLevel,
        status,
      });

      if (res.status == 200) {
        document.getElementById("modal-create-owner").close();
        await fetchOwners();

        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message ||
        t("superadmin_business_groups.something_went_wrong", "Something went wrong!");

      toast.dismiss();
      toast.error(message);
    } finally {
      setIsCreatingOwner(false);
    }
  };

  const btnToggleOwnerStatus = async (owner) => {
    const nextStatus = owner.status === "active" ? "inactive" : "active";

    try {
      toast.loading(t("superadmin_business_groups.please_wait", "Please wait..."));
      const res = await updateBusinessGroupOwnerStatus(groupId, owner.username, nextStatus);

      if (res.status == 200) {
        await fetchOwners();
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message ||
        t("superadmin_business_groups.something_went_wrong", "Something went wrong!");

      toast.dismiss();
      toast.error(message);
    }
  };


  const btnShowChangePermission = (owner) => {
    setOwnerForPermission(owner);
    document.getElementById("modal-change-owner-permission").showModal();
  };

  const btnChangePermission = async () => {
    const permissionLevel = changePermissionRef.current?.value;

    try {
      toast.loading(t("superadmin_business_groups.please_wait", "Please wait..."));
      const res = await updateBusinessGroupOwnerPermission(
        groupId,
        ownerForPermission.username,
        permissionLevel,
      );

      if (res.status == 200) {
        document.getElementById("modal-change-owner-permission").close();
        setOwnerForPermission(null);

        await fetchOwners();

        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message ||
        t("superadmin_business_groups.something_went_wrong", "Something went wrong!");

      toast.dismiss();
      toast.error(message);
    }
  };

  /**
   * Remove an owner. What "remove" means depends on which kind they are:
   *
   *  - DEDICATED owner → delete the account. It exists only to own this group,
   *    so there is nothing left for it to do.
   *  - DUAL-ROLE Business Admin → revoke ONLY the capability
   *    (business_group_id + group_permission_level). The account, its login,
   *    its business and its history all survive; they simply go back to being
   *    a Business Admin.
   *
   * Sending a dual-role owner down the delete path would try to delete a
   * working Business Admin, which is why the two are routed separately here.
   */
  const btnRemoveOwner = async (owner) => {
    const username = typeof owner === "string" ? owner : owner?.username;
    const isDedicated =
      typeof owner === "string" ? true : Boolean(owner?.is_dedicated_owner);

    try {
      toast.loading(t("superadmin_business_groups.please_wait", "Please wait..."));
      const res = isDedicated
        ? await removeBusinessGroupOwner(groupId, username)
        : await removeGroupOwnerCapability(groupId, username);

      if (res.status == 200) {
        await fetchOwners();
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message ||
        t("superadmin_business_groups.something_went_wrong", "Something went wrong!");

      toast.dismiss();
      toast.error(message);
    }
  };

  const fetchAvailableBusinesses = async () => {
    try {
      setLinkState((prevState) => ({ ...prevState, isLoading: true }));
      const { data } = await getAvailableBusinesses(groupId, linkState.search);

      setLinkState((prevState) => ({
        ...prevState,
        availableBusinesses: data.businesses || [],
        isLoading: false,
      }));
    } catch (error) {
      console.error(error);
      setLinkState((prevState) => ({ ...prevState, isLoading: false }));
      toast.dismiss();
      toast.error(
        error?.response?.data?.message ||
          t("superadmin_business_groups.error_loading_businesses", "Error loading businesses"),
      );
    }
  };

  // Server-side search so the dropdown never has to hold every tenant, and so
  // it can only ever offer businesses that still have no group.
  useDebounce(
    () => {
      if (!groupId) return;
      fetchAvailableBusinesses();
    },
    [linkState.search],
    500,
  );

  const btnShowLinkDialog = async () => {
    document.getElementById("modal-link-business").showModal();
    await fetchAvailableBusinesses();
  };

  const btnLinkBusiness = async () => {
    const tenantId = selectedBusinessRef.current?.value;

    if (!tenantId) {
      toast.error(
        t("superadmin_business_groups.please_select_business", "Please select a business to link"),
      );
      return;
    }

    try {
      toast.loading(t("superadmin_business_groups.please_wait", "Please wait..."));
      const res = await linkBusinessToGroup(groupId, tenantId);

      if (res.status == 200) {
        document.getElementById("modal-link-business").close();
        setLinkState((prevState) => ({ ...prevState, search: "" }));

        await fetchData();

        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message ||
        t("superadmin_business_groups.something_went_wrong", "Something went wrong!");

      toast.dismiss();
      toast.error(message);

      // The business was taken/changed by someone else — refresh both lists so
      // the dropdown stops offering a business that is no longer available.
      await fetchAvailableBusinesses();
    }
  };

  const btnUnlinkBusiness = async (tenantId) => {
    try {
      toast.loading(t("superadmin_business_groups.please_wait", "Please wait..."));
      const res = await unlinkBusinessFromGroup(groupId, tenantId);

      if (res.status == 200) {
        await fetchData();
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message ||
        t("superadmin_business_groups.something_went_wrong", "Something went wrong!");

      toast.dismiss();
      toast.error(message);
    }
  };

  if (state.isLoading) {
    return (
      <Page className="px-4 py-3">
        <div className="w-full h-[70vh] flex items-center justify-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
        </div>
      </Page>
    );
  }

  if (state.error || !state.group) {
    return (
      <Page className="px-4 py-3">
        <div className="w-full h-[70vh] flex flex-col items-center justify-center gap-4 text-gray-500">
          <p>{state.error}</p>
          <Link
            to="/superadmin/dashboard/business-groups"
            className="text-restro-green underline"
          >
            {t("superadmin_business_groups.back_to_groups", "Back to Business Groups")}
          </Link>
        </div>
      </Page>
    );
  }

  const { group, businesses } = state;

  return (
    <Page className="px-4 py-3 overflow-x-hidden h-full">
      <div className="flex items-center gap-3 mb-6 mt-6">
        <Link
          to="/superadmin/dashboard/business-groups"
          className="rounded-[42px] bg-gray-100 dark:bg-restro-bg-gray p-2 text-restro-text"
        >
          <IconArrowLeft size={20} stroke={iconStroke} />
        </Link>
        <h1 className="text-2xl font-semibold">
          {t("superadmin_business_groups.group_details", "Business Group Details")}
        </h1>
      </div>

      {/* group summary */}
      <div className="flex flex-col md:flex-row md:items-center gap-6 px-6 py-6 border border-restro-border-green rounded-3xl mb-6">
        <div className="bg-gray-50 dark:bg-restro-bg-gray rounded-[42px] p-6">
          <IconUsersGroup size={28} stroke={iconStroke} />
        </div>
        <div className="flex-1">
          <div className="text-xl font-bold">{group.name}</div>
          <div className="text-sm text-gray-500 mt-1">
            {group.description || "-"}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {t("superadmin_business_groups.created_date", "Created Date")}:{" "}
            {group.created_at
              ? new Date(group.created_at).toLocaleDateString()
              : "-"}
          </div>
        </div>
        <div className="flex flex-col items-center px-6">
          <span className="text-4xl font-black text-restro-green">
            {businesses.length}
          </span>
          <span className="text-sm text-gray-500">
            {t("superadmin_business_groups.businesses_count", "Businesses")}
          </span>
        </div>
      </div>

      {/* linked businesses */}
      <div className="flex flex-col px-6 py-6 border border-restro-border-green rounded-3xl">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
          <h2 className="text-lg font-semibold">
            {t("superadmin_business_groups.linked_businesses", "Linked Businesses")}
          </h2>
          <button
            onClick={btnShowLinkDialog}
            className="bg-restro-green text-white text-sm px-6 py-2 rounded-[42px] hover:bg-restro-green/80 flex items-center gap-2 whitespace-nowrap"
          >
            <IconLinkPlus size={16} stroke={iconStroke} />
            {t("superadmin_business_groups.link_business", "Link Business")}
          </button>
        </div>

        {businesses.length === 0 ? (
          <div className="text-center w-full h-[40vh] flex flex-col items-center justify-center text-gray-500">
            <p>
              {t(
                "superadmin_business_groups.no_linked_businesses",
                "No businesses linked to this group yet",
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-auto w-full border-separate border-spacing-y-1">
              <thead className="bg-transparent">
                <tr>
                  <th className="rounded-[42px] px-3 flex items-center justify-between">
                    <div className="text-start px-0 py-1 w-1/4 min-w-[220px] max-w-[280px] text-sm md:text-sm lg:text-base">
                      {t("superadmin_business_groups.business_name", "Business Name")}
                    </div>
                    <div className="px-2 py-1 w-1/4 min-w-[180px] max-w-[220px] text-sm md:text-sm lg:text-base">
                      {t("superadmin_business_groups.owner", "Owner")}
                    </div>
                    <div className="px-2 py-1 w-1/4 min-w-[180px] max-w-[220px] text-sm md:text-sm lg:text-base">
                      {t("superadmin_business_groups.subscription", "Subscription")}
                    </div>
                    <div className="px-2 py-1 w-1/6 min-w-[100px] max-w-[140px] text-sm md:text-sm lg:text-base">
                      {t("superadmin_business_groups.status", "Status")}
                    </div>
                    <div className="px-2 py-1 w-1/6 min-w-[100px] max-w-[140px] text-sm md:text-sm lg:text-base mr-4">
                      {t("superadmin_business_groups.action", "Action")}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {businesses.map((business) => (
                  <tr key={business.id}>
                    <td className="py-1">
                      <div className="bg-gray-100 dark:bg-restro-card-bg rounded-[42px] px-3 flex items-center justify-between">
                        <div className="flex items-center py-2 w-1/4 min-w-[220px] max-w-[280px]">
                          <div className="bg-gray-50 dark:bg-restro-bg-gray rounded-[42px] p-4 mr-3">
                            <IconBuildingStore size={18} stroke={iconStroke} />
                          </div>
                          <div className="font-bold text-sm">{business.name}</div>
                        </div>
                        <div className="w-1/4 min-w-[180px] max-w-[220px] text-center">
                          <div className="text-sm font-semibold">
                            {business.owner_name || "-"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {business.owner_email || "-"}
                          </div>
                        </div>
                        <div className="w-1/4 min-w-[180px] max-w-[220px] text-center text-xs font-semibold">
                          {business.subscription_start || business.subscription_end ? (
                            <>
                              <div>{business.subscription_start || "-"}</div>
                              <div className="text-gray-500">
                                {t("superadmin_business_groups.to", "to")}{" "}
                                {business.subscription_end || "-"}
                              </div>
                            </>
                          ) : (
                            <span className="text-gray-500">
                              {t("superadmin_business_groups.no_subscription", "No subscription")}
                            </span>
                          )}
                        </div>
                        <div className="w-1/6 min-w-[100px] max-w-[140px] flex items-center justify-center">
                          <span
                            className={`px-3 py-2 text-xs rounded-[42px] bg-white dark:bg-restro-gray flex items-center gap-1 ${
                              business.is_active == 1
                                ? "text-green-600"
                                : "text-red-700"
                            }`}
                          >
                            {business.is_active == 1 ? (
                              <>
                                <IconCheck size={14} stroke={iconStroke} />
                                {t("superadmin_business_groups.active", "Active")}
                              </>
                            ) : (
                              <>
                                <IconX size={14} stroke={iconStroke} />
                                {t("superadmin_business_groups.inactive", "Inactive")}
                              </>
                            )}
                          </span>
                        </div>
                        <div className="w-1/6 min-w-[100px] max-w-[140px] flex justify-end">
                          <button
                            onClick={() => setBusinessForUnlink(business)}
                            title={t("superadmin_business_groups.remove_link", "Remove Link")}
                            className="rounded-[42px] bg-white p-3 text-red-500 dark:bg-restro-gray"
                          >
                            <IconUnlink size={20} stroke={iconStroke} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* business group owners (Phase 2) */}
      <div className="flex flex-col px-6 py-6 border border-restro-border-green rounded-3xl mt-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
          <div>
            <h2 className="text-lg font-semibold">
              {t("superadmin_business_groups.group_owners", "Business Group Owners")}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {t(
                "superadmin_business_groups.group_owners_hint",
                "Owners manage every business in this group with a single login.",
              )}
            </p>
          </div>
          <button
            onClick={btnShowCreateOwnerDialog}
            className="bg-restro-green text-white text-sm px-6 py-2 rounded-[42px] hover:bg-restro-green/80 flex items-center gap-2 whitespace-nowrap"
          >
            <IconUserPlus size={16} stroke={iconStroke} />
            {t("superadmin_business_groups.create_owner", "Create Group Owner")}
          </button>
        </div>

        {ownersState.isLoading ? (
          <div className="w-full h-32 flex items-center justify-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
          </div>
        ) : ownersState.owners.length === 0 ? (
          <div className="text-center w-full h-32 flex flex-col items-center justify-center text-gray-500">
            <p>
              {t(
                "superadmin_business_groups.no_owners",
                "No group owners assigned yet",
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-auto w-full border-separate border-spacing-y-1">
              <thead className="bg-transparent">
                <tr>
                  <th className="rounded-[42px] px-3 flex items-center justify-between">
                    <div className="text-start px-0 py-1 w-1/4 min-w-[200px] max-w-[260px] text-sm md:text-sm lg:text-base">
                      {t("superadmin_business_groups.owner_name", "Name")}
                    </div>
                    <div className="px-2 py-1 w-1/4 min-w-[200px] max-w-[240px] text-sm md:text-sm lg:text-base">
                      {t("superadmin_business_groups.email", "Email")}
                    </div>
                    <div className="px-2 py-1 w-1/6 min-w-[120px] max-w-[160px] text-sm md:text-sm lg:text-base">
                      {t("superadmin_business_groups.permission", "Permission")}
                    </div>
                    <div className="px-2 py-1 w-1/6 min-w-[100px] max-w-[130px] text-sm md:text-sm lg:text-base">
                      {t("superadmin_business_groups.status", "Status")}
                    </div>
                    <div className="px-2 py-1 w-1/6 min-w-[130px] max-w-[170px] text-sm md:text-sm lg:text-base">
                      {t("superadmin_business_groups.last_login", "Last Login")}
                    </div>
                    <div className="px-2 py-1 w-1/6 min-w-[110px] max-w-[140px] text-sm md:text-sm lg:text-base mr-4">
                      {t("superadmin_business_groups.actions", "Actions")}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ownersState.owners.map((owner) => {
                  const isActive = owner.status === "active";
                  // A dual-role owner is a Business Admin who also owns the
                  // group. Their ACCOUNT status gates login to their own
                  // business too, so it is managed in User Management — only a
                  // dedicated owner's status belongs on this screen.
                  const isDedicated = Boolean(owner.is_dedicated_owner);

                  return (
                    <tr key={owner.username}>
                      <td className="py-1">
                        <div className="bg-gray-100 dark:bg-restro-card-bg rounded-[42px] px-3 flex items-center justify-between">
                          <div className="flex items-center py-2 w-1/4 min-w-[200px] max-w-[260px]">
                            <div className="bg-gray-50 dark:bg-restro-bg-gray rounded-[42px] p-4 mr-3">
                              <IconUserShield size={18} stroke={iconStroke} />
                            </div>
                            <div className="font-bold text-sm">
                              {owner.name || "-"}
                              {/* A dual-role owner is a Business Admin who also
                                  owns the group; a dedicated owner has no
                                  business of their own. */}
                              {!owner.is_dedicated_owner && owner.home_business_name && (
                                <span className="mt-1 block font-normal text-xs text-gray-500">
                                  {t("superadmin_business_groups.business_admin", "Business Admin")}
                                  {" · "}
                                  {owner.home_business_name}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="w-1/4 min-w-[200px] max-w-[240px] text-center text-xs font-semibold break-all">
                            {owner.email || owner.username}
                          </div>
                          <div className="w-1/6 min-w-[120px] max-w-[160px] flex items-center justify-center">
                            <span
                              className={`px-3 py-2 text-xs rounded-[42px] bg-white dark:bg-restro-gray flex items-center gap-1 ${
                                owner.group_permission_level === "write"
                                  ? "text-restro-green"
                                  : "text-gray-600 dark:text-gray-300"
                              }`}
                            >
                              {owner.group_permission_level === "write" ? (
                                <>
                                  <IconPencil size={14} stroke={iconStroke} />
                                  {t("superadmin_business_groups.read_write", "Read + Write")}
                                </>
                              ) : (
                                <>
                                  <IconEye size={14} stroke={iconStroke} />
                                  {t("superadmin_business_groups.read_only", "Read Only")}
                                </>
                              )}
                            </span>
                          </div>
                          <div className="w-1/6 min-w-[100px] max-w-[130px] flex items-center justify-center">
                            <button
                              onClick={() => isDedicated && btnToggleOwnerStatus(owner)}
                              disabled={!isDedicated}
                              title={
                                isDedicated
                                  ? t("superadmin_business_groups.toggle_status", "Change status")
                                  : t(
                                      "superadmin_business_groups.status_managed_in_users",
                                      "Managed in User Management — this account also signs in to its own business",
                                    )
                              }
                              className={`px-3 py-2 text-xs rounded-[42px] bg-white dark:bg-restro-gray flex items-center gap-1 ${
                                isActive ? "text-green-600" : "text-red-600"
                              } ${isDedicated ? "" : "cursor-default opacity-70"}`}
                            >
                              {isActive ? (
                                <>
                                  <IconCheck size={14} stroke={iconStroke} />
                                  {t("superadmin_business_groups.active", "Active")}
                                </>
                              ) : (
                                <>
                                  <IconX size={14} stroke={iconStroke} />
                                  {t("superadmin_business_groups.inactive", "Inactive")}
                                </>
                              )}
                            </button>
                          </div>
                          <div className="w-1/6 min-w-[130px] max-w-[170px] text-center text-xs font-semibold">
                            {owner.last_login
                              ? new Date(owner.last_login).toLocaleString()
                              : t("superadmin_business_groups.never", "Never")}
                          </div>
                          <div className="w-1/6 min-w-[110px] max-w-[140px] flex justify-end gap-2">
                            <button
                              onClick={() => btnShowChangePermission(owner)}
                              title={t(
                                "superadmin_business_groups.change_permission",
                                "Change Permission",
                              )}
                              className="rounded-[42px] bg-white dark:bg-restro-bg-gray p-3 text-restro-text"
                            >
                              <IconPencil size={20} stroke={iconStroke} />
                            </button>
                            <button
                              onClick={() => setOwnerForRemoval(owner)}
                              title={t("superadmin_business_groups.remove_owner", "Remove Owner")}
                              className="rounded-[42px] bg-white p-3 text-red-500 dark:bg-restro-gray"
                            >
                              <IconUserMinus size={20} stroke={iconStroke} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* business group owners */}

      {/* create group owner dialog */}
      <dialog
        id="modal-create-owner"
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="modal-box border border-restro-border-green dark:rounded-2xl">
          <h3 className="font-bold text-lg">
            {t("superadmin_business_groups.add_owner", "Add Business Group Owner")}
          </h3>

          {/* Two routes to the same capability. */}
          <div className="mt-4 flex gap-2 border-b border-restro-border-green">
            <button
              onClick={() => setAssignState((prev) => ({ ...prev, tab: "create" }))}
              className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
                assignState.tab === "create"
                  ? "border-restro-green text-restro-green"
                  : "border-transparent text-gray-500"
              }`}
            >
              {t("superadmin_business_groups.tab_create_new", "Create New User")}
            </button>
            <button
              onClick={btnSelectAssignTab}
              className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
                assignState.tab === "assign"
                  ? "border-restro-green text-restro-green"
                  : "border-transparent text-gray-500"
              }`}
            >
              {t("superadmin_business_groups.tab_assign_existing", "Assign Existing User")}
            </button>
          </div>

          {assignState.tab === "assign" ? (
            <div className="mt-4">
              <p className="text-sm text-gray-500">
                {t(
                  "superadmin_business_groups.assign_existing_hint",
                  "Grants Group Owner access to an existing Business Admin. No new account is created — they keep their login, their business and full admin rights over it, and gain Group Owner access to the group's other businesses.",
                )}
              </p>

              <div className="relative mt-4">
                <IconSearch
                  stroke={iconStroke}
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="search"
                  value={assignState.search}
                  onChange={(e) => {
                    const search = e.target.value;
                    setAssignState((prev) => ({ ...prev, search }));
                    loadCandidates(search);
                  }}
                  className="text-sm w-full rounded-lg pl-9 pr-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green"
                  placeholder={t(
                    "superadmin_business_groups.search_users",
                    "Search by name, email, phone or business",
                  )}
                />
              </div>

              <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-restro-border-green divide-y divide-restro-border-green">
                {assignState.isSearching ? (
                  <p className="px-4 py-6 text-center text-sm text-gray-500">
                    {t("superadmin_business_groups.please_wait", "Please wait...")}
                  </p>
                ) : assignState.candidates.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-gray-500">
                    {t(
                      "superadmin_business_groups.no_eligible_users",
                      "No eligible Business Admins found. Users already in a group are not listed.",
                    )}
                  </p>
                ) : (
                  assignState.candidates.map((candidate) => {
                    const isSelected = assignState.selected?.username === candidate.username;
                    return (
                      <button
                        key={candidate.username}
                        onClick={() =>
                          setAssignState((prev) => ({ ...prev, selected: candidate }))
                        }
                        className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition ${
                          isSelected ? "bg-restro-green-light" : "hover:bg-restro-button-hover"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block font-medium text-restro-text truncate">
                            {candidate.name || candidate.username}
                          </span>
                          <span className="block text-xs text-gray-500 truncate">
                            {candidate.email}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="rounded-[42px] bg-restro-gray px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300">
                              {candidate.businessName}
                            </span>
                            <span className="rounded-[42px] bg-restro-gray px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300">
                              {t("superadmin_business_groups.business_admin", "Business Admin")}
                            </span>
                          </span>
                        </span>
                        {isSelected && (
                          <IconCheck size={18} stroke={iconStroke} className="text-restro-green shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {assignState.selected && (
                <div className="mt-4 rounded-lg border border-restro-border-green p-3">
                  <p className="text-xs text-gray-500">
                    {t("superadmin_business_groups.resulting_role", "Resulting role")}
                  </p>
                  <p className="text-sm font-semibold text-restro-text">
                    {t("superadmin_business_groups.business_admin", "Business Admin")}
                    {" + "}
                    {t("superadmin_business_groups.group_owner", "Business Group Owner")}
                  </p>

                  <label htmlFor="assignPermission" className="mt-3 mb-1 block text-gray-500 text-sm">
                    {t("superadmin_business_groups.permission_level", "Permission Level")}
                  </label>
                  <select
                    id="assignPermission"
                    value={assignState.permissionLevel}
                    onChange={(e) =>
                      setAssignState((prev) => ({ ...prev, permissionLevel: e.target.value }))
                    }
                    className="text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green"
                  >
                    <option value="read">
                      {t("superadmin_business_groups.read_only", "Read Only")}
                    </option>
                    <option value="write">
                      {t("superadmin_business_groups.read_write", "Read + Write")}
                    </option>
                  </select>
                  <p className="mt-2 text-xs text-gray-500">
                    {t(
                      "superadmin_business_groups.permission_scope_hint",
                      "Applies to the group's other businesses. Their own business always keeps full Business Admin access.",
                    )}
                  </p>
                </div>
              )}

              <div className="modal-action">
                <form method="dialog">
                  <button className="rounded-lg border border-restro-border-green px-4 py-2 text-sm">
                    {t("superadmin_business_groups.cancel", "Cancel")}
                  </button>
                </form>
                <button
                  onClick={btnAssignExistingUser}
                  disabled={!assignState.selected || assignState.isAssigning}
                  className="rounded-lg bg-restro-green px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  {t("superadmin_business_groups.assign_group_owner", "Assign Group Owner")}
                </button>
              </div>
            </div>
          ) : (
          <>
          <p className="text-sm text-gray-500 mt-4">
            {t(
              "superadmin_business_groups.create_owner_hint",
              "Creates a new, dedicated account that exists only to own this business group.",
            )}
          </p>

          <div className="flex gap-4 w-full mt-4">
            <div className="flex-1">
              <label htmlFor="firstName" className="mb-1 block text-gray-500 text-sm">
                {t("superadmin_business_groups.first_name", "First Name")}{" "}
                <span className="text-xs text-gray-400">
                  {t("superadmin_business_groups.required", "Required")}
                </span>
              </label>
              <input
                ref={ownerFirstNameRef}
                type="text"
                name="firstName"
                maxLength={40}
                className="text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green"
                placeholder={t("superadmin_business_groups.enter_first_name", "Enter first name")}
              />
            </div>
            <div className="flex-1">
              <label htmlFor="lastName" className="mb-1 block text-gray-500 text-sm">
                {t("superadmin_business_groups.last_name", "Last Name")}
              </label>
              <input
                ref={ownerLastNameRef}
                type="text"
                name="lastName"
                maxLength={40}
                className="text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green"
                placeholder={t("superadmin_business_groups.enter_last_name", "Enter last name")}
              />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="email" className="mb-1 block text-gray-500 text-sm">
              {t("superadmin_business_groups.email", "Email")}{" "}
              <span className="text-xs text-gray-400">
                {t("superadmin_business_groups.required", "Required")}
              </span>
            </label>
            <input
              ref={ownerEmailRef}
              type="email"
              name="email"
              autoComplete="off"
              className="text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green"
              placeholder={t("superadmin_business_groups.enter_email", "Enter email")}
            />
            <p className="mt-1 text-xs text-gray-400">
              {t("superadmin_business_groups.email_is_login", "This email is the owner's login.")}
            </p>
          </div>

          <div className="flex gap-4 w-full mt-4">
            <div className="flex-1">
              <label htmlFor="phone" className="mb-1 block text-gray-500 text-sm">
                {t("superadmin_business_groups.phone", "Phone")}
              </label>
              <input
                ref={ownerPhoneRef}
                type="tel"
                name="phone"
                maxLength={20}
                className="text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green"
                placeholder={t("superadmin_business_groups.enter_phone", "Enter phone")}
              />
            </div>
            <div className="flex-1">
              <label htmlFor="password" className="mb-1 block text-gray-500 text-sm">
                {t("superadmin_business_groups.password", "Password")}{" "}
                <span className="text-xs text-gray-400">
                  {t("superadmin_business_groups.required", "Required")}
                </span>
              </label>
              <input
                ref={ownerPasswordRef}
                type="password"
                name="password"
                autoComplete="new-password"
                className="text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green"
                placeholder={t("superadmin_business_groups.min_8_chars", "Minimum 8 characters")}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-gray-500 text-sm">
              {t("superadmin_business_groups.business_group", "Business Group")}
            </label>
            {/* Fixed by the page context — an owner belongs to exactly one group. */}
            <input
              type="text"
              value={state.group?.name || ""}
              readOnly
              disabled
              className="text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green bg-restro-gray dark:bg-restro-bg-gray text-gray-500"
            />
          </div>

          <div className="flex gap-4 w-full mt-4">
            <div className="flex-1">
              <label htmlFor="permission" className="mb-1 block text-gray-500 text-sm">
                {t("superadmin_business_groups.permission_level", "Permission Level")}
              </label>
              <select
                ref={ownerPermissionRef}
                name="permission"
                defaultValue="read"
                className="select select-sm w-full border border-restro-border-green rounded-lg focus:outline-none focus:ring-2 focus:ring-restro-gray dark:bg-black dark:text-white"
              >
                <option value="read">
                  {t("superadmin_business_groups.read_only", "Read Only")}
                </option>
                <option value="write">
                  {t("superadmin_business_groups.read_write", "Read + Write")}
                </option>
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="status" className="mb-1 block text-gray-500 text-sm">
                {t("superadmin_business_groups.status", "Status")}
              </label>
              <select
                ref={ownerStatusRef}
                name="status"
                defaultValue="active"
                className="select select-sm w-full border border-restro-border-green rounded-lg focus:outline-none focus:ring-2 focus:ring-restro-gray dark:bg-black dark:text-white"
              >
                <option value="active">
                  {t("superadmin_business_groups.active", "Active")}
                </option>
                <option value="inactive">
                  {t("superadmin_business_groups.inactive", "Inactive")}
                </option>
              </select>
            </div>
          </div>

          <div className="modal-action mt-4">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className="btn transition active:scale-95 hover:shadow-lg px-4 py-3 rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text">
                {t("superadmin_business_groups.close", "Close")}
              </button>
            </form>
            <button
              onClick={btnCreateOwner}
              disabled={isCreatingOwner}
              className="btn ml-2 rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover disabled:opacity-50"
            >
              {t("superadmin_business_groups.create_user", "Create User")}
            </button>
          </div>
          </>
          )}
        </div>
      </dialog>
      {/* create group owner dialog */}

      {/* change permission dialog */}
      <dialog
        id="modal-change-owner-permission"
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="modal-box border border-restro-border-green dark:rounded-2xl">
          <h3 className="font-bold text-lg">
            {t("superadmin_business_groups.change_permission", "Change Permission")}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {ownerForPermission?.name || ownerForPermission?.username}
          </p>

          <div className="mt-4">
            <label
              htmlFor="updatePermission"
              className="mb-1 block text-gray-500 text-sm"
            >
              {t("superadmin_business_groups.permission_level", "Permission Level")}
            </label>
            <select
              ref={changePermissionRef}
              name="updatePermission"
              key={ownerForPermission?.username}
              defaultValue={ownerForPermission?.group_permission_level || "read"}
              className="select select-sm w-full border border-restro-border-green rounded-lg focus:outline-none focus:ring-2 focus:ring-restro-gray dark:bg-black dark:text-white"
            >
              <option value="read">
                {t("superadmin_business_groups.read_only", "Read Only")}
              </option>
              <option value="write">
                {t("superadmin_business_groups.read_write", "Read + Write")}
              </option>
            </select>
          </div>

          <div className="modal-action mt-4">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button
                onClick={() => setOwnerForPermission(null)}
                className="btn transition active:scale-95 hover:shadow-lg px-4 py-3 rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text"
              >
                {t("superadmin_business_groups.close", "Close")}
              </button>
            </form>
            <button
              onClick={btnChangePermission}
              className="btn ml-2 rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover"
            >
              {t("superadmin_business_groups.save", "Save")}
            </button>
          </div>
        </div>
      </dialog>
      {/* change permission dialog */}

      {/* remove owner confirmation */}
      <DeleteModal
        isOpen={Boolean(ownerForRemoval)}
        onClose={() => setOwnerForRemoval(null)}
        onConfirm={async () => {
          const owner = ownerForRemoval;
          setOwnerForRemoval(null);
          await btnRemoveOwner(owner);
        }}
        title={t(
          "superadmin_business_groups.remove_owner_confirm",
          "Remove this owner from the group?",
        )}
        description={
          ownerForRemoval && !ownerForRemoval.is_dedicated_owner
            ? t(
                "superadmin_business_groups.remove_capability_description",
                "Removes Group Owner access only. The account, its login and its own business are kept — they remain a Business Admin.",
              )
            : t(
                "superadmin_business_groups.remove_owner_description",
                "This deletes the owner's dedicated account. Business Admin and Staff accounts are never affected.",
              )
        }
        itemName={ownerForRemoval?.name || ownerForRemoval?.username}
        confirmText={t("superadmin_business_groups.yes_remove", "Yes, Remove")}
        cancelText={t("superadmin_business_groups.cancel", "Cancel")}
      />
      {/* remove owner confirmation */}

      {/* link business dialog */}
      <dialog
        id="modal-link-business"
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="modal-box border border-restro-border-green dark:rounded-2xl">
          <h3 className="font-bold text-lg">
            {t("superadmin_business_groups.link_business", "Link Business")}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {t(
              "superadmin_business_groups.link_business_hint",
              "Only businesses that do not already belong to a group are listed.",
            )}
          </p>

          <div className="mt-4">
            <label className="mb-1 block text-gray-500 text-sm">
              {t("superadmin_business_groups.search_business", "Search Business")}
            </label>
            <label className="bg-restro-gray rounded-[42px] px-3 py-2 text-gray-500 flex items-center gap-2 w-full">
              <IconSearch size={16} stroke={iconStroke} />
              <input
                type="search"
                placeholder={t(
                  "superadmin_business_groups.search_business_placeholder",
                  "Search by name or owner email...",
                )}
                value={linkState.search}
                onChange={(e) =>
                  setLinkState((prevState) => ({
                    ...prevState,
                    search: e.target.value,
                  }))
                }
                className="w-full bg-transparent outline-none text-sm"
              />
            </label>
          </div>

          <div className="mt-4">
            <label
              htmlFor="business"
              className="mb-1 block text-gray-500 text-sm"
            >
              {t("superadmin_business_groups.select_business", "Select Business")}{" "}
              <span className="text-xs text-gray-400">
                {t("superadmin_business_groups.required", "Required")}
              </span>
            </label>
            <select
              ref={selectedBusinessRef}
              name="business"
              size={6}
              className="select w-full h-auto border border-restro-border-green rounded-lg focus:outline-none focus:ring-2 focus:ring-restro-gray dark:bg-black dark:text-white"
            >
              {linkState.isLoading ? (
                <option disabled>
                  {t("superadmin_business_groups.loading", "Loading...")}
                </option>
              ) : linkState.availableBusinesses.length === 0 ? (
                <option disabled>
                  {t(
                    "superadmin_business_groups.no_available_businesses",
                    "No businesses available to link",
                  )}
                </option>
              ) : (
                linkState.availableBusinesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                    {business.owner_email ? ` — ${business.owner_email}` : ""}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="modal-action mt-4">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className="btn transition active:scale-95 hover:shadow-lg px-4 py-3 rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text">
                {t("superadmin_business_groups.close", "Close")}
              </button>
            </form>
            <button
              onClick={btnLinkBusiness}
              disabled={linkState.availableBusinesses.length === 0}
              className="btn ml-2 rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover disabled:opacity-50"
            >
              {t("superadmin_business_groups.link", "Link")}
            </button>
          </div>
        </div>
      </dialog>
      {/* link business dialog */}

      {/* unlink confirmation */}
      <DeleteModal
        isOpen={Boolean(businessForUnlink)}
        onClose={() => setBusinessForUnlink(null)}
        onConfirm={async () => {
          const tenantId = businessForUnlink?.id;
          setBusinessForUnlink(null);
          await btnUnlinkBusiness(tenantId);
        }}
        title={t(
          "superadmin_business_groups.remove_business_confirm",
          "Remove this business from the group?",
        )}
        description={t(
          "superadmin_business_groups.remove_business_description",
          "The business is only removed from this group. Its data, users, subscription and settings are not affected.",
        )}
        itemName={businessForUnlink?.name}
        confirmText={t("superadmin_business_groups.yes_remove", "Yes, Remove")}
        cancelText={t("superadmin_business_groups.cancel", "Cancel")}
      />
    </Page>
  );
}
