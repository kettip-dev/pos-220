import React, { useState, useEffect, useRef, useMemo } from "react";
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
  IconPlus,
  IconStar,
  IconAlertCircle,
  IconCalendarEvent,
  IconRefresh,
  IconClock,
} from "@tabler/icons-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";

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
  createBranchInGroup,
  updateBusinessGroupBranchLimit,
  setMainBranch,
} from "../../controllers/business_group.controller";

/**
 * Business Group Details (Phase 1 & 2) — Super Admin only.
 * Shows the group header, 3-segment QuickBooks KPI ribbon, member branches table,
 * and group owners table.
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

  // Inline table filters for QuickBooks toolbar
  const [branchSearch, setBranchSearch] = useState("");
  const [branchStatusFilter, setBranchStatusFilter] = useState("all"); // "all" | "active" | "inactive"
  const [ownerSearch, setOwnerSearch] = useState("");

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

  // Create Branch dialog state
  const [createBranchState, setCreateBranchState] = useState({
    name: "",
    branchCode: "",
    email: "",
    password: "",
    isMainBranch: false,
    initMode: "blank", // "blank" | "clone"
    cloneFromTenantId: "",
    cloneFloorTables: false,
    isSubmitting: false,
  });

  // Update Branch Limit dialog state
  const [limitModalState, setLimitModalState] = useState({
    maxBranches: 5,
    isSubmitting: false,
  });

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

  const handleRefreshAll = async () => {
    await Promise.all([fetchData(), fetchOwners()]);
  };

  const btnShowCreateBranchModal = () => {
    const mainBranch = state.businesses.find((b) => b.is_main_branch === 1);
    const defaultCloneId = mainBranch?.id || state.businesses[0]?.id || "";

    setCreateBranchState({
      name: "",
      branchCode: "",
      email: "",
      password: "",
      isMainBranch: state.businesses.length === 0,
      initMode: "blank",
      cloneFromTenantId: defaultCloneId,
      cloneFloorTables: false,
      isSubmitting: false,
    });

    document.getElementById("modal-create-branch").showModal();
  };

  const handleCreateBranchSubmit = async (e) => {
    e.preventDefault();
    const {
      name,
      branchCode,
      email,
      password,
      isMainBranch,
      initMode,
      cloneFromTenantId,
      cloneFloorTables,
    } = createBranchState;

    if (!name?.trim()) {
      toast.error("Please enter a branch name");
      return;
    }
    if (!email?.trim() || !validateEmail(email.trim())) {
      toast.error("Please enter a valid branch admin email");
      return;
    }
    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setCreateBranchState((prev) => ({ ...prev, isSubmitting: true }));
      toast.loading(t("superadmin_business_groups.please_wait", "Please wait..."));

      const payload = {
        name: name.trim(),
        branchCode: branchCode?.trim() || null,
        email: email.trim().toLowerCase(),
        password,
        isMainBranch: Boolean(isMainBranch),
        cloneFromTenantId:
          initMode === "clone" && cloneFromTenantId ? cloneFromTenantId : null,
        cloneFloorTables: initMode === "clone" && Boolean(cloneFloorTables),
      };

      const res = await createBranchInGroup(groupId, payload);

      if (res.status === 201 || res.status === 200) {
        document.getElementById("modal-create-branch").close();
        await fetchData();
        toast.dismiss();
        toast.success(res.data?.message || "Branch created successfully!");
      }
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error(error?.response?.data?.message || "Failed to create branch");
    } finally {
      setCreateBranchState((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const btnShowUpdateBranchLimit = () => {
    setLimitModalState({
      maxBranches: state.group?.max_branches || 5,
      isSubmitting: false,
    });
    document.getElementById("modal-update-branch-limit").showModal();
  };

  const handleUpdateBranchLimitSubmit = async (e) => {
    e.preventDefault();
    const limit = parseInt(limitModalState.maxBranches, 10);
    if (!Number.isInteger(limit) || limit < 1) {
      toast.error("Please enter a valid limit (at least 1)");
      return;
    }

    try {
      setLimitModalState((prev) => ({ ...prev, isSubmitting: true }));
      toast.loading(t("superadmin_business_groups.please_wait", "Please wait..."));

      const res = await updateBusinessGroupBranchLimit(groupId, limit);
      if (res.status === 200) {
        document.getElementById("modal-update-branch-limit").close();
        await fetchData();
        toast.dismiss();
        toast.success(res.data?.message || "Branch limit updated successfully!");
      }
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error(error?.response?.data?.message || "Failed to update branch limit");
    } finally {
      setLimitModalState((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleSetMainBranch = async (tenantId) => {
    try {
      toast.loading(t("superadmin_business_groups.please_wait", "Please wait..."));
      const res = await setMainBranch(groupId, tenantId);
      if (res.status === 200) {
        await fetchData();
        toast.dismiss();
        toast.success(res.data?.message || "Main branch updated successfully!");
      }
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error(error?.response?.data?.message || "Failed to update main branch");
    }
  };

  useEffect(() => {
    if (!groupId) return;
    fetchData();
    fetchOwners();
  }, [groupId]);

  const btnShowCreateOwnerDialog = () => {
    if (ownerFirstNameRef.current) ownerFirstNameRef.current.value = "";
    if (ownerLastNameRef.current) ownerLastNameRef.current.value = "";
    if (ownerEmailRef.current) ownerEmailRef.current.value = "";
    if (ownerPhoneRef.current) ownerPhoneRef.current.value = "";
    if (ownerPasswordRef.current) ownerPasswordRef.current.value = "";
    if (ownerPermissionRef.current) ownerPermissionRef.current.value = "read";
    if (ownerStatusRef.current) ownerStatusRef.current.value = "active";

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

    if (!firstName) {
      toast.error(
        t("superadmin_business_groups.please_provide_first_name", "Please provide a first name"),
      );
      return;
    }

    if (!email) {
      toast.error(
        t("superadmin_business_groups.please_provide_email", "Please provide an email"),
      );
      return;
    }

    if (!validateEmail(email)) {
      toast.error(
        t("superadmin_business_groups.please_provide_valid_email", "Please provide a valid email"),
      );
      return;
    }

    if (!password || password.length < 8) {
      toast.error(
        t("superadmin_business_groups.password_too_short", "Password must be at least 8 characters"),
      );
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
      const res = await updateBusinessGroupOwnerStatus(
        groupId,
        owner.username,
        nextStatus,
      );

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
        t(
          "superadmin_business_groups.please_select_business",
          "Please select a business to link",
        ),
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

  const filteredBusinesses = useMemo(() => {
    const q = branchSearch.trim().toLowerCase();
    return (state.businesses || []).filter((b) => {
      if (branchStatusFilter === "active" && b.is_active != 1) return false;
      if (branchStatusFilter === "inactive" && b.is_active == 1) return false;
      if (!q) return true;
      return (
        (b.name || "").toLowerCase().includes(q) ||
        (b.branch_code || "").toLowerCase().includes(q) ||
        (b.owner_name || "").toLowerCase().includes(q) ||
        (b.owner_email || "").toLowerCase().includes(q)
      );
    });
  }, [state.businesses, branchSearch, branchStatusFilter]);

  const filteredOwners = useMemo(() => {
    const q = ownerSearch.trim().toLowerCase();
    if (!q) return ownersState.owners || [];
    return (ownersState.owners || []).filter(
      (o) =>
        (o.name || "").toLowerCase().includes(q) ||
        (o.email || o.username || "").toLowerCase().includes(q) ||
        (o.home_business_name || "").toLowerCase().includes(q),
    );
  }, [ownersState.owners, ownerSearch]);

  if (state.isLoading) {
    return (
      <div className="w-full h-[65vh] flex flex-col items-center justify-center gap-3">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#2CA01C]" />
        <p className="text-xs text-gray-500">
          {t("superadmin_business_groups.loading", "Loading business group details...")}
        </p>
      </div>
    );
  }

  if (state.error || !state.group) {
    return (
      <div className="w-full h-[65vh] flex flex-col items-center justify-center gap-4 text-gray-500">
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-medium">
          {state.error || "Business group not found"}
        </div>
        <Link
          to="/superadmin/dashboard/business-groups"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2CA01C] hover:underline"
        >
          <IconArrowLeft size={15} stroke={iconStroke} />
          {t("superadmin_business_groups.back_to_groups", "Back to Business Groups")}
        </Link>
      </div>
    );
  }

  const { group, businesses } = state;
  const maxBranches = group.max_branches || 5;
  const quotaPercent = Math.min(100, Math.round((businesses.length / maxBranches) * 100));
  const isAtQuota = businesses.length >= maxBranches;
  const activeBranchesCount = businesses.filter((b) => b.is_active == 1).length;
  const inactiveBranchesCount = businesses.length - activeBranchesCount;
  const mainBranch = businesses.find((b) => b.is_main_branch === 1);
  const writeOwnersCount = ownersState.owners.filter(
    (o) => o.group_permission_level === "write",
  ).length;
  const readOwnersCount = ownersState.owners.length - writeOwnersCount;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* QuickBooks Profile Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <Link
            to="/superadmin/dashboard/business-groups"
            title={t("superadmin_business_groups.back_to_groups", "Back to Business Groups")}
            className="mt-1 w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161B22] hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 transition shadow-2xs shrink-0"
          >
            <IconArrowLeft size={18} stroke={iconStroke} />
          </Link>

          <div>
            {/* Breadcrumbs */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 mb-1">
              <Link
                to="/superadmin/dashboard/home"
                className="hover:text-[#2CA01C] transition-colors"
              >
                Dashboard
              </Link>
              <span>/</span>
              <Link
                to="/superadmin/dashboard/business-groups"
                className="hover:text-[#2CA01C] transition-colors"
              >
                {t("superadmin_business_groups.title", "Business Groups")}
              </Link>
              <span>/</span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {group.name}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-800/60 text-[#2CA01C] flex items-center justify-center shrink-0">
                <IconUsersGroup size={18} stroke={iconStroke} />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {group.name}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-[#108000] dark:text-[#2CA01C] border border-emerald-200 dark:border-emerald-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2CA01C]" />
                {t("superadmin_business_groups.group_details", "Business Group")}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-500">
              <span>{group.description || "No description provided"}</span>
              <span className="text-gray-300 dark:text-gray-700">•</span>
              <span className="inline-flex items-center gap-1">
                <IconCalendarEvent size={13} className="text-gray-400" />
                {t("superadmin_business_groups.created_date", "Created")}:{" "}
                <strong className="font-medium text-gray-700 dark:text-gray-300">
                  {group.created_at
                    ? new Date(group.created_at).toLocaleDateString()
                    : "-"}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshAll}
            title="Refresh Group Data"
            className="p-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161B22] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition shadow-2xs"
          >
            <IconRefresh size={17} stroke={iconStroke} />
          </button>

          <button
            type="button"
            onClick={btnShowUpdateBranchLimit}
            className="h-9 px-3.5 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#161B22] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-2xs"
          >
            <IconPencil size={14} stroke={iconStroke} />
            <span>{t("superadmin_business_groups.edit_limit", "Edit Limit")}</span>
          </button>

          <button
            type="button"
            onClick={btnShowCreateBranchModal}
            className="h-9 px-4 rounded-full bg-[#2CA01C] hover:bg-[#248417] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shadow-sm hover:shadow transition active:scale-95"
          >
            <IconPlus size={16} stroke={2.5} />
            <span>{t("superadmin_business_groups.create_branch", "Create Branch")}</span>
          </button>
        </div>
      </div>

      {/* QuickBooks 3-Segment KPI Status Ribbon */}
      <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-800">
        
        {/* Segment 1: Branch Quota */}
        <div className="relative p-4 sm:p-5 flex flex-col justify-between">
          <div
            className={clsx(
              "absolute top-0 left-0 right-0 h-1",
              isAtQuota ? "bg-amber-500" : "bg-[#2CA01C]",
            )}
          />
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <span
                className={clsx(
                  "w-2 h-2 rounded-full",
                  isAtQuota ? "bg-amber-500" : "bg-[#2CA01C]",
                )}
              />
              {t("superadmin_business_groups.branches_quota", "Branches / Quota")}
            </span>
            <button
              type="button"
              onClick={btnShowUpdateBranchLimit}
              className="text-[11px] font-semibold text-[#108000] dark:text-[#2CA01C] hover:underline flex items-center gap-1"
            >
              <IconPencil size={12} stroke={iconStroke} />
              {t("superadmin_business_groups.edit_limit", "Edit Limit")}
            </button>
          </div>

          <div className="flex items-baseline justify-between gap-2 my-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                {businesses.length}
              </span>
              <span className="text-base font-bold text-gray-400">
                / {maxBranches}
              </span>
              <span className="text-xs text-gray-500 ml-1">configured</span>
            </div>
            <span
              className={clsx(
                "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                isAtQuota
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  : "bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
              )}
            >
              {quotaPercent}% used
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mt-2">
            <div
              className={clsx(
                "h-full rounded-full transition-all duration-300",
                isAtQuota ? "bg-amber-500" : "bg-[#2CA01C]",
              )}
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
        </div>

        {/* Segment 2: Active Outlets & Main Branch */}
        <div className="relative p-4 sm:p-5 flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#0077C5]" />
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0077C5]" />
              {t("superadmin_business_groups.branches", "Active Outlets")}
            </span>
            <span className="text-[11px] font-medium text-blue-700 dark:text-blue-400 bg-blue-100/70 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
              {activeBranchesCount} Active · {inactiveBranchesCount} Inactive
            </span>
          </div>

          <div className="flex items-baseline gap-2 my-1">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              {activeBranchesCount}
            </span>
            <span className="text-xs text-gray-500">
              operational restaurant{activeBranchesCount === 1 ? "" : "s"}
            </span>
          </div>

          <div className="text-xs text-gray-500 mt-1.5 flex items-center gap-1.5 truncate">
            <IconStar
              size={14}
              stroke={iconStroke}
              className="text-emerald-600 fill-emerald-500 shrink-0"
            />
            <span className="truncate">
              {t("superadmin_business_groups.main_branch", "Main Branch")}:{" "}
              <strong className="font-semibold text-gray-800 dark:text-gray-200">
                {mainBranch ? mainBranch.name : "Not assigned"}
              </strong>
            </span>
          </div>
        </div>

        {/* Segment 3: Business Group Owners */}
        <div className="relative p-4 sm:p-5 flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-600" />
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              {t("superadmin_business_groups.group_owners", "Group Owners")}
            </span>
            <button
              type="button"
              onClick={btnShowCreateOwnerDialog}
              className="text-[11px] font-semibold text-[#108000] dark:text-[#2CA01C] hover:underline flex items-center gap-1"
            >
              <IconPlus size={12} stroke={2.5} />
              Add Owner
            </button>
          </div>

          <div className="flex items-baseline gap-2 my-1">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              {ownersState.owners.length}
            </span>
            <span className="text-xs text-gray-500">
              assigned administrator{ownersState.owners.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="text-xs text-gray-500 mt-1.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
              {writeOwnersCount} Read + Write
            </span>
            <span>•</span>
            <span>{readOwnersCount} Read Only</span>
          </div>
        </div>

      </div>

      {/* SECTION 1: Branches & Outlets — QuickBooks Pro Data Table Card */}
      <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs overflow-hidden">
        
        {/* Card Header */}
        <div className="px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {t("superadmin_business_groups.branches", "Branches & Outlets")}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                {businesses.length} / {maxBranches}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {businesses.length} of {maxBranches} branches configured in this business group
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={btnShowLinkDialog}
              className="h-8 px-3.5 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-2xs"
            >
              <IconLinkPlus size={15} stroke={iconStroke} />
              <span>{t("superadmin_business_groups.link_business", "Link Existing")}</span>
            </button>

            <button
              type="button"
              onClick={btnShowCreateBranchModal}
              className="h-8 px-4 rounded-full bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs active:scale-95"
            >
              <IconPlus size={15} stroke={2.5} />
              <span>{t("superadmin_business_groups.create_branch", "Create Branch")}</span>
            </button>
          </div>
        </div>

        {/* Table Toolbar: Search & Status Filter */}
        <div className="px-4 sm:px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-[#FAFBFD] dark:bg-[#161B22] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <IconSearch
              size={15}
              stroke={iconStroke}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="search"
              value={branchSearch}
              onChange={(e) => setBranchSearch(e.target.value)}
              placeholder={t(
                "superadmin_business_groups.search_branches_placeholder",
                "Filter branches by name, code, or owner...",
              )}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2CA01C] focus:border-[#2CA01C] transition"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {[
              { id: "all", label: `All (${businesses.length})` },
              { id: "active", label: `Active (${activeBranchesCount})` },
              { id: "inactive", label: `Inactive (${inactiveBranchesCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setBranchStatusFilter(tab.id)}
                className={clsx(
                  "px-2.5 py-1 rounded-md text-xs font-semibold transition",
                  branchStatusFilter === tab.id
                    ? "bg-emerald-50 dark:bg-emerald-950/50 text-[#108000] dark:text-[#2CA01C] border border-emerald-200 dark:border-emerald-800/70"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Branches Table Body */}
        {businesses.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-center px-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3 text-gray-400">
              <IconBuildingStore size={24} stroke={iconStroke} />
            </div>
            <p className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
              {t(
                "superadmin_business_groups.no_linked_businesses",
                "No businesses linked to this group yet",
              )}
            </p>
            <p className="text-xs text-gray-500 max-w-sm mb-4">
              Create a new branch or link an existing restaurant tenant to this group.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={btnShowCreateBranchModal}
                className="inline-flex items-center gap-1.5 bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-semibold px-3.5 py-1.5 rounded-full transition shadow-xs"
              >
                <IconPlus size={15} stroke={2.5} />
                <span>{t("superadmin_business_groups.create_branch", "Create Branch")}</span>
              </button>
              <button
                type="button"
                onClick={btnShowLinkDialog}
                className="inline-flex items-center gap-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-semibold px-3.5 py-1.5 rounded-full transition"
              >
                <IconLinkPlus size={15} stroke={iconStroke} />
                <span>{t("superadmin_business_groups.link_business", "Link Existing")}</span>
              </button>
            </div>
          </div>
        ) : filteredBusinesses.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-center px-4 text-xs text-gray-500">
            <p>No branches match your current filter.</p>
            <button
              type="button"
              onClick={() => {
                setBranchSearch("");
                setBranchStatusFilter("all");
              }}
              className="mt-2 text-[#2CA01C] font-semibold hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-[#F8F9FA] dark:bg-[#161B22] text-gray-600 dark:text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 min-w-[230px]">
                    {t("superadmin_business_groups.business_name", "Business Name")}
                  </th>
                  <th className="py-3 px-4 min-w-[180px]">
                    {t("superadmin_business_groups.owner", "Owner")}
                  </th>
                  <th className="py-3 px-4 min-w-[170px]">
                    {t("superadmin_business_groups.subscription", "Subscription")}
                  </th>
                  <th className="py-3 px-4 min-w-[110px]">
                    {t("superadmin_business_groups.status", "Status")}
                  </th>
                  <th className="py-3 px-4 text-right min-w-[170px]">
                    {t("superadmin_business_groups.action", "Action")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredBusinesses.map((business) => {
                  const isLive = business.is_active == 1;
                  const isMain = business.is_main_branch === 1;

                  return (
                    <tr
                      key={business.id}
                      className="hover:bg-[#F9FAFB] dark:hover:bg-[#1C2128] transition-colors"
                    >
                      {/* Business Name & Branch Code */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={clsx(
                              "w-9 h-9 rounded-lg border flex items-center justify-center shrink-0",
                              isMain
                                ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-[#2CA01C]"
                                : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300",
                            )}
                          >
                            <IconBuildingStore size={18} stroke={iconStroke} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm truncate">
                                {business.name}
                              </span>
                              {business.branch_code && (
                                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                                  {business.branch_code}
                                </span>
                              )}
                            </div>
                            {isMain && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#108000] dark:text-[#2CA01C] mt-0.5">
                                <IconStar
                                  size={12}
                                  stroke={iconStroke}
                                  className="fill-[#2CA01C] text-[#2CA01C]"
                                />
                                {t("superadmin_business_groups.main_branch", "Main Branch")}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 dark:text-white text-xs">
                          {business.owner_name || "-"}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {business.owner_email || "-"}
                        </div>
                      </td>

                      {/* Subscription */}
                      <td className="py-3.5 px-4">
                        {business.subscription_start || business.subscription_end ? (
                          <div className="space-y-0.5 text-xs">
                            <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 font-medium">
                              <IconCalendarEvent size={13} className="text-gray-400 shrink-0" />
                              <span>{business.subscription_start || "-"}</span>
                            </div>
                            <div className="text-[11px] text-gray-500 pl-5">
                              {t("superadmin_business_groups.to", "to")}{" "}
                              {business.subscription_end || "-"}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                            {t("superadmin_business_groups.no_subscription", "No subscription")}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
                            isLive
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-[#108000] dark:text-[#2CA01C] border-emerald-200 dark:border-emerald-800/60"
                              : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/60",
                          )}
                        >
                          <span
                            className={clsx(
                              "w-1.5 h-1.5 rounded-full",
                              isLive ? "bg-[#2CA01C]" : "bg-red-500",
                            )}
                          />
                          {isLive
                            ? t("superadmin_business_groups.active", "Active")
                            : t("superadmin_business_groups.inactive", "Inactive")}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {!isMain && (
                            <button
                              type="button"
                              onClick={() => handleSetMainBranch(business.id)}
                              title={t(
                                "superadmin_business_groups.set_main_branch",
                                "Set as Main Branch",
                              )}
                              className="h-7 px-2.5 rounded-md border border-emerald-200 dark:border-emerald-800 text-[#108000] dark:text-[#2CA01C] hover:bg-emerald-50 dark:hover:bg-emerald-950/50 font-semibold text-xs inline-flex items-center gap-1 transition"
                            >
                              <IconStar size={12} stroke={iconStroke} />
                              <span>{t("superadmin_business_groups.set_main", "Set Main")}</span>
                            </button>
                          )}

                          <Link
                            to={`/superadmin/dashboard/tenants/${business.id}/subscription-history`}
                            title="Subscription History"
                            className="h-7 w-7 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition"
                          >
                            <IconCalendarEvent size={14} stroke={iconStroke} />
                          </Link>

                          <button
                            type="button"
                            onClick={() => setBusinessForUnlink(business)}
                            title={t("superadmin_business_groups.remove_link", "Remove Link")}
                            className="h-7 w-7 rounded-md border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center transition"
                          >
                            <IconUnlink size={14} stroke={iconStroke} />
                          </button>
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

      {/* SECTION 2: Business Group Owners — QuickBooks Pro Data Table Card */}
      <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs overflow-hidden">
        
        {/* Card Header */}
        <div className="px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {t("superadmin_business_groups.group_owners", "Business Group Owners")}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                {ownersState.owners.length}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {t(
                "superadmin_business_groups.group_owners_hint",
                "Owners manage every business in this group with a single login.",
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {ownersState.owners.length > 0 && (
              <div className="relative">
                <IconSearch
                  size={14}
                  stroke={iconStroke}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="search"
                  value={ownerSearch}
                  onChange={(e) => setOwnerSearch(e.target.value)}
                  placeholder="Search owners..."
                  className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2CA01C] focus:border-[#2CA01C]"
                />
              </div>
            )}

            <button
              type="button"
              onClick={btnShowCreateOwnerDialog}
              className="h-8 px-4 rounded-full bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs active:scale-95"
            >
              <IconUserPlus size={15} stroke={2} />
              <span>{t("superadmin_business_groups.create_owner", "Create Group Owner")}</span>
            </button>
          </div>
        </div>

        {/* Owners Table Body */}
        {ownersState.isLoading ? (
          <div className="h-44 flex flex-col items-center justify-center gap-2">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-[#2CA01C]" />
            <p className="text-xs text-gray-500">Loading group owners...</p>
          </div>
        ) : ownersState.owners.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center px-4">
            <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-2.5 text-gray-400">
              <IconUserShield size={22} stroke={iconStroke} />
            </div>
            <p className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
              {t("superadmin_business_groups.no_owners", "No group owners assigned yet")}
            </p>
            <p className="text-xs text-gray-500 max-w-sm mb-3.5">
              Assign an existing Business Admin or create a dedicated Group Owner account.
            </p>
            <button
              type="button"
              onClick={btnShowCreateOwnerDialog}
              className="inline-flex items-center gap-1.5 bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-semibold px-3.5 py-1.5 rounded-full transition shadow-xs"
            >
              <IconUserPlus size={15} stroke={2} />
              <span>{t("superadmin_business_groups.create_owner", "Create Group Owner")}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-[#F8F9FA] dark:bg-[#161B22] text-gray-600 dark:text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 min-w-[220px]">
                    {t("superadmin_business_groups.owner_name", "Name")}
                  </th>
                  <th className="py-3 px-4 min-w-[190px]">
                    {t("superadmin_business_groups.email", "Email")}
                  </th>
                  <th className="py-3 px-4 min-w-[130px]">
                    {t("superadmin_business_groups.permission", "Permission")}
                  </th>
                  <th className="py-3 px-4 min-w-[110px]">
                    {t("superadmin_business_groups.status", "Status")}
                  </th>
                  <th className="py-3 px-4 min-w-[150px]">
                    {t("superadmin_business_groups.last_login", "Last Login")}
                  </th>
                  <th className="py-3 px-4 text-right min-w-[130px]">
                    {t("superadmin_business_groups.actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredOwners.map((owner) => {
                  const isActive = owner.status === "active";
                  const isDedicated = Boolean(owner.is_dedicated_owner);
                  const isWrite = owner.group_permission_level === "write";

                  return (
                    <tr
                      key={owner.username}
                      className="hover:bg-[#F9FAFB] dark:hover:bg-[#1C2128] transition-colors"
                    >
                      {/* Owner Name & Role Subtitle */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/70 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                            <IconUserShield size={18} stroke={iconStroke} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm truncate">
                              {owner.name || "-"}
                            </div>
                            {!owner.is_dedicated_owner && owner.home_business_name ? (
                              <div className="text-[11px] text-gray-500 truncate mt-0.5">
                                {t("superadmin_business_groups.business_admin", "Business Admin")}
                                {" · "}
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                  {owner.home_business_name}
                                </span>
                              </div>
                            ) : (
                              <div className="text-[11px] text-gray-400 mt-0.5">
                                Dedicated Group Owner
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 font-medium text-gray-700 dark:text-gray-300 break-all">
                        {owner.email || owner.username}
                      </td>

                      {/* Permission */}
                      <td className="py-3.5 px-4">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border",
                            isWrite
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-[#108000] dark:text-[#2CA01C] border-emerald-200 dark:border-emerald-800/60"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700",
                          )}
                        >
                          {isWrite ? (
                            <>
                              <IconPencil size={12} stroke={iconStroke} />
                              {t("superadmin_business_groups.read_write", "Read + Write")}
                            </>
                          ) : (
                            <>
                              <IconEye size={12} stroke={iconStroke} />
                              {t("superadmin_business_groups.read_only", "Read Only")}
                            </>
                          )}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
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
                          className={clsx(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition",
                            isActive
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-[#108000] dark:text-[#2CA01C] border-emerald-200 dark:border-emerald-800/60"
                              : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/60",
                            isDedicated
                              ? "cursor-pointer hover:opacity-80"
                              : "cursor-default opacity-80",
                          )}
                        >
                          <span
                            className={clsx(
                              "w-1.5 h-1.5 rounded-full",
                              isActive ? "bg-[#2CA01C]" : "bg-red-500",
                            )}
                          />
                          {isActive
                            ? t("superadmin_business_groups.active", "Active")
                            : t("superadmin_business_groups.inactive", "Inactive")}
                        </button>
                      </td>

                      {/* Last Login */}
                      <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300 font-medium">
                        {owner.last_login ? (
                          <div className="flex items-center gap-1.5">
                            <IconClock size={13} className="text-gray-400 shrink-0" />
                            <span>{new Date(owner.last_login).toLocaleString()}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">
                            {t("superadmin_business_groups.never", "Never")}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => btnShowChangePermission(owner)}
                            title={t(
                              "superadmin_business_groups.change_permission",
                              "Change Permission",
                            )}
                            className="h-7 px-2.5 rounded-md border border-emerald-200 dark:border-emerald-800 text-[#108000] dark:text-[#2CA01C] hover:bg-emerald-50 dark:hover:bg-emerald-950/50 font-semibold text-xs inline-flex items-center gap-1 transition"
                          >
                            <IconPencil size={13} stroke={iconStroke} />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setOwnerForRemoval(owner)}
                            title={t("superadmin_business_groups.remove_owner", "Remove Owner")}
                            className="h-7 w-7 rounded-md border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center transition"
                          >
                            <IconUserMinus size={14} stroke={iconStroke} />
                          </button>
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

      {/* MODAL 1: Add / Assign Business Group Owner */}
      <dialog id="modal-create-owner" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161B22] p-6 max-w-lg">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                {t("superadmin_business_groups.add_owner", "Add Business Group Owner")}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {group?.name}
              </p>
            </div>
            <form method="dialog">
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs">
                
              </button>
            </form>
          </div>

          {/* QuickBooks Tabs: Create New vs Assign Existing */}
          <div className="mt-3 flex gap-2 border-b border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setAssignState((prev) => ({ ...prev, tab: "create" }))}
              className={clsx(
                "px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition",
                assignState.tab === "create"
                  ? "border-[#2CA01C] text-[#108000] dark:text-[#2CA01C]"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              )}
            >
              {t("superadmin_business_groups.tab_create_new", "Create New User")}
            </button>
            <button
              type="button"
              onClick={btnSelectAssignTab}
              className={clsx(
                "px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition",
                assignState.tab === "assign"
                  ? "border-[#2CA01C] text-[#108000] dark:text-[#2CA01C]"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              )}
            >
              {t("superadmin_business_groups.tab_assign_existing", "Assign Existing User")}
            </button>
          </div>

          {assignState.tab === "assign" ? (
            <div className="py-4 space-y-3.5">
              <p className="text-xs text-gray-500">
                {t(
                  "superadmin_business_groups.assign_existing_hint",
                  "Grants Group Owner access to an existing Business Admin. No new account is created — they keep their login, their business and full admin rights over it.",
                )}
              </p>

              <div className="relative">
                <IconSearch
                  stroke={iconStroke}
                  size={15}
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
                  className="w-full text-xs rounded-md pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C] focus:border-[#2CA01C]"
                  placeholder={t(
                    "superadmin_business_groups.search_users",
                    "Search by name, email, phone or business...",
                  )}
                />
              </div>

              <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                {assignState.isSearching ? (
                  <p className="px-4 py-6 text-center text-xs text-gray-500">
                    {t("superadmin_business_groups.please_wait", "Please wait...")}
                  </p>
                ) : assignState.candidates.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-gray-500">
                    {t(
                      "superadmin_business_groups.no_eligible_users",
                      "No eligible Business Admins found. Users already in a group are not listed.",
                    )}
                  </p>
                ) : (
                  assignState.candidates.map((candidate) => {
                    const isSelected =
                      assignState.selected?.username === candidate.username;
                    return (
                      <button
                        type="button"
                        key={candidate.username}
                        onClick={() =>
                          setAssignState((prev) => ({ ...prev, selected: candidate }))
                        }
                        className={clsx(
                          "flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-xs transition",
                          isSelected
                            ? "bg-emerald-50/80 dark:bg-emerald-950/40"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800/50",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block font-semibold text-gray-900 dark:text-white truncate">
                            {candidate.name || candidate.username}
                          </span>
                          <span className="block text-[11px] text-gray-500 truncate">
                            {candidate.email}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                              {candidate.businessName}
                            </span>
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                              {t("superadmin_business_groups.business_admin", "Business Admin")}
                            </span>
                          </span>
                        </span>
                        {isSelected && (
                          <IconCheck
                            size={16}
                            stroke={2.5}
                            className="text-[#2CA01C] shrink-0"
                          />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {assignState.selected && (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 space-y-2">
                  <div>
                    <p className="text-[11px] text-gray-500">
                      {t("superadmin_business_groups.resulting_role", "Resulting role")}
                    </p>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">
                      {t("superadmin_business_groups.business_admin", "Business Admin")}
                      {" + "}
                      {t("superadmin_business_groups.group_owner", "Business Group Owner")}
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="assignPermission"
                      className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300"
                    >
                      {t("superadmin_business_groups.permission_level", "Permission Level")}
                    </label>
                    <select
                      id="assignPermission"
                      value={assignState.permissionLevel}
                      onChange={(e) =>
                        setAssignState((prev) => ({
                          ...prev,
                          permissionLevel: e.target.value,
                        }))
                      }
                      className="text-xs w-full rounded-md p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
                    >
                      <option value="read">
                        {t("superadmin_business_groups.read_only", "Read Only")}
                      </option>
                      <option value="write">
                        {t("superadmin_business_groups.read_write", "Read + Write")}
                      </option>
                    </select>
                  </div>
                </div>
              )}

              <div className="modal-action pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
                <form method="dialog">
                  <button className="px-3.5 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50">
                    {t("superadmin_business_groups.cancel", "Cancel")}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={btnAssignExistingUser}
                  disabled={!assignState.selected || assignState.isAssigning}
                  className="px-4 py-2 rounded-md bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {t("superadmin_business_groups.assign_group_owner", "Assign Group Owner")}
                </button>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-3.5">
              <p className="text-xs text-gray-500">
                {t(
                  "superadmin_business_groups.create_owner_hint",
                  "Creates a new, dedicated account that exists only to own this business group.",
                )}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {t("superadmin_business_groups.first_name", "First Name")}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={ownerFirstNameRef}
                    type="text"
                    maxLength={40}
                    className="text-xs w-full rounded-md p-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
                    placeholder={t(
                      "superadmin_business_groups.enter_first_name",
                      "Enter first name",
                    )}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {t("superadmin_business_groups.last_name", "Last Name")}
                  </label>
                  <input
                    ref={ownerLastNameRef}
                    type="text"
                    maxLength={40}
                    className="text-xs w-full rounded-md p-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
                    placeholder={t(
                      "superadmin_business_groups.enter_last_name",
                      "Enter last name",
                    )}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {t("superadmin_business_groups.email", "Email (Login)")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  ref={ownerEmailRef}
                  type="email"
                  autoComplete="off"
                  className="text-xs w-full rounded-md p-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
                  placeholder={t("superadmin_business_groups.enter_email", "owner@company.com")}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {t("superadmin_business_groups.phone", "Phone")}
                  </label>
                  <input
                    ref={ownerPhoneRef}
                    type="tel"
                    maxLength={20}
                    className="text-xs w-full rounded-md p-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
                    placeholder={t("superadmin_business_groups.enter_phone", "Enter phone")}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {t("superadmin_business_groups.password", "Password")}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={ownerPasswordRef}
                    type="password"
                    autoComplete="new-password"
                    className="text-xs w-full rounded-md p-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
                    placeholder={t(
                      "superadmin_business_groups.min_8_chars",
                      "Minimum 8 characters",
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {t("superadmin_business_groups.permission_level", "Permission Level")}
                  </label>
                  <select
                    ref={ownerPermissionRef}
                    defaultValue="read"
                    className="text-xs w-full rounded-md p-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
                  >
                    <option value="read">
                      {t("superadmin_business_groups.read_only", "Read Only")}
                    </option>
                    <option value="write">
                      {t("superadmin_business_groups.read_write", "Read + Write")}
                    </option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {t("superadmin_business_groups.status", "Status")}
                  </label>
                  <select
                    ref={ownerStatusRef}
                    defaultValue="active"
                    className="text-xs w-full rounded-md p-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
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

              <div className="modal-action pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
                <form method="dialog">
                  <button className="px-3.5 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50">
                    {t("superadmin_business_groups.close", "Cancel")}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={btnCreateOwner}
                  disabled={isCreatingOwner}
                  className="px-4 py-2 rounded-md bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {t("superadmin_business_groups.create_user", "Create User")}
                </button>
              </div>
            </div>
          )}
        </div>
      </dialog>

      {/* MODAL 2: Change Owner Permission */}
      <dialog
        id="modal-change-owner-permission"
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="modal-box rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161B22] p-6 max-w-sm">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                {t("superadmin_business_groups.change_permission", "Change Permission")}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {ownerForPermission?.name || ownerForPermission?.username}
              </p>
            </div>
            <form method="dialog">
              <button
                onClick={() => setOwnerForPermission(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
              >
                
              </button>
            </form>
          </div>

          <div className="py-4">
            <label
              htmlFor="updatePermission"
              className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300"
            >
              {t("superadmin_business_groups.permission_level", "Permission Level")}
            </label>
            <select
              ref={changePermissionRef}
              name="updatePermission"
              key={ownerForPermission?.username}
              defaultValue={ownerForPermission?.group_permission_level || "read"}
              className="text-xs w-full rounded-md p-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
            >
              <option value="read">
                {t("superadmin_business_groups.read_only", "Read Only")}
              </option>
              <option value="write">
                {t("superadmin_business_groups.read_write", "Read + Write")}
              </option>
            </select>
          </div>

          <div className="modal-action pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
            <form method="dialog">
              <button
                onClick={() => setOwnerForPermission(null)}
                className="px-3.5 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50"
              >
                {t("superadmin_business_groups.close", "Cancel")}
              </button>
            </form>
            <button
              type="button"
              onClick={btnChangePermission}
              className="px-4 py-2 rounded-md bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-semibold shadow-xs"
            >
              {t("superadmin_business_groups.save", "Save Changes")}
            </button>
          </div>
        </div>
      </dialog>

      {/* Remove Owner Confirmation */}
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

      {/* MODAL 3: Link Existing Business */}
      <dialog id="modal-link-business" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161B22] p-6 max-w-md">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                {t("superadmin_business_groups.link_business", "Link Existing Business")}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {t(
                  "superadmin_business_groups.link_business_hint",
                  "Only businesses that do not already belong to a group are listed.",
                )}
              </p>
            </div>
            <form method="dialog">
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs">
                
              </button>
            </form>
          </div>

          <div className="py-4 space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t("superadmin_business_groups.search_business", "Search Business")}
              </label>
              <div className="relative">
                <IconSearch
                  size={15}
                  stroke={iconStroke}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
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
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="business"
                className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300"
              >
                {t("superadmin_business_groups.select_business", "Select Business")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <select
                ref={selectedBusinessRef}
                name="business"
                size={6}
                className="w-full h-auto text-xs rounded-md p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
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
                    <option key={business.id} value={business.id} className="py-1.5 px-2">
                      {business.name}
                      {business.owner_email ? ` — ${business.owner_email}` : ""}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="modal-action pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
            <form method="dialog">
              <button className="px-3.5 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50">
                {t("superadmin_business_groups.close", "Cancel")}
              </button>
            </form>
            <button
              type="button"
              onClick={btnLinkBusiness}
              disabled={linkState.availableBusinesses.length === 0}
              className="px-4 py-2 rounded-md bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
            >
              {t("superadmin_business_groups.link", "Link Business")}
            </button>
          </div>
        </div>
      </dialog>

      {/* MODAL 4: Create New Branch */}
      <dialog id="modal-create-branch" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161B22] p-6 max-w-xl">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                {t("superadmin_business_groups.create_new_branch", "Create New Branch")}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">{group?.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={clsx(
                  "px-2.5 py-0.5 rounded-full text-xs font-semibold",
                  isAtQuota
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                )}
              >
                {businesses.length} / {maxBranches}{" "}
                {t("superadmin_business_groups.used", "Used")}
              </span>
              <form method="dialog">
                <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs">
                  
                </button>
              </form>
            </div>
          </div>

          {isAtQuota && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-start gap-2.5 text-amber-800 dark:text-amber-300 text-xs">
              <IconAlertCircle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {t(
                    "superadmin_business_groups.limit_reached_title",
                    "Branch Limit Reached",
                  )}
                </p>
                <p className="mt-0.5">
                  {t(
                    "superadmin_business_groups.limit_reached_desc",
                    "This group has reached its maximum branch limit. Please increase the branch limit first before creating another branch.",
                  )}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleCreateBranchSubmit} className="py-4 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t("superadmin_business_groups.branch_name", "Branch Name")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createBranchState.name}
                  onChange={(e) =>
                    setCreateBranchState((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder={t(
                    "superadmin_business_groups.branch_name_ph",
                    "e.g. Westside Outlet",
                  )}
                  className="w-full text-xs rounded-md p-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t("superadmin_business_groups.branch_code", "Branch Code")}
                </label>
                <input
                  type="text"
                  value={createBranchState.branchCode}
                  onChange={(e) =>
                    setCreateBranchState((p) => ({
                      ...p,
                      branchCode: e.target.value,
                    }))
                  }
                  placeholder={t("superadmin_business_groups.branch_code_ph", "e.g. WS-02")}
                  className="w-full text-xs rounded-md p-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t("superadmin_business_groups.admin_email", "Admin Email (Login)")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={createBranchState.email}
                  onChange={(e) =>
                    setCreateBranchState((p) => ({ ...p, email: e.target.value }))
                  }
                  placeholder="admin@branch.com"
                  className="w-full text-xs rounded-md p-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t("superadmin_business_groups.admin_password", "Admin Password")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={createBranchState.password}
                  onChange={(e) =>
                    setCreateBranchState((p) => ({
                      ...p,
                      password: e.target.value,
                    }))
                  }
                  placeholder="••••••••"
                  className="w-full text-xs rounded-md p-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <input
                type="checkbox"
                id="create-branch-main"
                checked={createBranchState.isMainBranch}
                disabled={businesses.length === 0}
                onChange={(e) =>
                  setCreateBranchState((p) => ({
                    ...p,
                    isMainBranch: e.target.checked,
                  }))
                }
                className="rounded border-gray-300 text-[#2CA01C] focus:ring-[#2CA01C]"
              />
              <label
                htmlFor="create-branch-main"
                className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                {t("superadmin_business_groups.set_as_main_branch", "Set as Main Branch")}
              </label>
            </div>

            {/* Initialization Mode */}
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-3.5 bg-gray-50/60 dark:bg-gray-900/40">
              <span className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2.5">
                {t("superadmin_business_groups.data_init_mode", "Data Initialization Mode")}
              </span>

              <div className="space-y-2.5">
                <label
                  className={clsx(
                    "flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer bg-white dark:bg-[#161B22] transition",
                    createBranchState.initMode === "blank"
                      ? "border-[#2CA01C] ring-1 ring-[#2CA01C]/20"
                      : "border-gray-200 dark:border-gray-800 hover:bg-gray-50",
                  )}
                >
                  <input
                    type="radio"
                    name="initMode"
                    value="blank"
                    checked={createBranchState.initMode === "blank"}
                    onChange={() =>
                      setCreateBranchState((p) => ({ ...p, initMode: "blank" }))
                    }
                    className="mt-0.5 text-[#2CA01C] focus:ring-[#2CA01C]"
                  />
                  <div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-white">
                      {t("superadmin_business_groups.blank_branch", "Blank Branch (Default)")}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {t(
                        "superadmin_business_groups.blank_desc",
                        "Starts clean with empty menu and categories, and standard kitchen station.",
                      )}
                    </div>
                  </div>
                </label>

                <label
                  className={clsx(
                    "flex flex-col gap-2 p-3 rounded-lg border bg-white dark:bg-[#161B22] transition",
                    businesses.length === 0
                      ? "opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-800"
                      : createBranchState.initMode === "clone"
                      ? "border-[#2CA01C] ring-1 ring-[#2CA01C]/20 cursor-pointer"
                      : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 cursor-pointer",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="initMode"
                      value="clone"
                      disabled={businesses.length === 0}
                      checked={createBranchState.initMode === "clone"}
                      onChange={() =>
                        setCreateBranchState((p) => ({ ...p, initMode: "clone" }))
                      }
                      className="mt-0.5 text-[#2CA01C] focus:ring-[#2CA01C]"
                    />
                    <div>
                      <div className="text-xs font-semibold text-gray-900 dark:text-white">
                        {t(
                          "superadmin_business_groups.clone_from_branch",
                          "Clone Data from Existing Branch",
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {businesses.length === 0
                          ? t(
                              "superadmin_business_groups.no_branch_to_clone",
                              "No branches exist in this group yet to clone from.",
                            )
                          : t(
                              "superadmin_business_groups.clone_desc",
                              "Replicates menu items, categories, variants, addons, kitchen stations, and tax rates.",
                            )}
                      </div>
                    </div>
                  </div>

                  {createBranchState.initMode === "clone" && businesses.length > 0 && (
                    <div className="ml-6 mt-1.5 pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                          {t(
                            "superadmin_business_groups.source_branch",
                            "Source Branch to Clone From",
                          )}
                          :
                        </label>
                        <select
                          value={createBranchState.cloneFromTenantId}
                          onChange={(e) =>
                            setCreateBranchState((p) => ({
                              ...p,
                              cloneFromTenantId: e.target.value,
                            }))
                          }
                          className="w-full text-xs rounded-md p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
                        >
                          {businesses.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}{" "}
                              {b.is_main_branch === 1
                                ? `(${t("superadmin_business_groups.main", "Main")})`
                                : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2 pt-0.5">
                        <input
                          type="checkbox"
                          id="clone-floor-tables"
                          checked={createBranchState.cloneFloorTables}
                          onChange={(e) =>
                            setCreateBranchState((p) => ({
                              ...p,
                              cloneFloorTables: e.target.checked,
                            }))
                          }
                          className="rounded border-gray-300 text-[#2CA01C] focus:ring-[#2CA01C]"
                        />
                        <label
                          htmlFor="clone-floor-tables"
                          className="text-xs text-gray-600 dark:text-gray-300 cursor-pointer"
                        >
                          {t(
                            "superadmin_business_groups.clone_floors_tables",
                            "Also clone floor layouts & dining tables",
                          )}
                        </label>
                      </div>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="modal-action pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => document.getElementById("modal-create-branch").close()}
                className="px-3.5 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50"
              >
                {t("superadmin_business_groups.close", "Cancel")}
              </button>
              <button
                type="submit"
                disabled={isAtQuota || createBranchState.isSubmitting}
                className="px-4 py-2 rounded-md bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {createBranchState.isSubmitting
                  ? t("superadmin_business_groups.creating", "Creating...")
                  : t("superadmin_business_groups.create_branch", "Create Branch")}
              </button>
            </div>
          </form>
        </div>
      </dialog>

      {/* MODAL 5: Update Branch Limit */}
      <dialog
        id="modal-update-branch-limit"
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="modal-box rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161B22] p-6 max-w-sm">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                {t("superadmin_business_groups.edit_branch_limit", "Edit Branch Limit")}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {t(
                  "superadmin_business_groups.edit_branch_limit_desc",
                  "Set the maximum number of branches this group can contain.",
                )}
              </p>
            </div>
            <form method="dialog">
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs">
                
              </button>
            </form>
          </div>

          <form onSubmit={handleUpdateBranchLimitSubmit} className="py-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                {t(
                  "superadmin_business_groups.max_branches",
                  "Maximum Allowed Branches",
                )}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                required
                value={limitModalState.maxBranches}
                onChange={(e) =>
                  setLimitModalState((p) => ({
                    ...p,
                    maxBranches: e.target.value,
                  }))
                }
                className="w-full text-xs rounded-md p-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
              />
              <p className="text-[11px] text-gray-500 mt-1.5">
                {t("superadmin_business_groups.current_count", "Current branches")}:{" "}
                <strong className="font-semibold text-gray-700 dark:text-gray-300">
                  {businesses.length}
                </strong>
              </p>
            </div>

            <div className="modal-action pt-4 mt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  document.getElementById("modal-update-branch-limit").close()
                }
                className="px-3.5 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50"
              >
                {t("superadmin_business_groups.close", "Cancel")}
              </button>
              <button
                type="submit"
                disabled={limitModalState.isSubmitting}
                className="px-4 py-2 rounded-md bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {limitModalState.isSubmitting
                  ? t("superadmin_business_groups.saving", "Saving...")
                  : t("superadmin_business_groups.save", "Save Limit")}
              </button>
            </div>
          </form>
        </div>
      </dialog>

      {/* Unlink Business Confirmation */}
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

    </div>
  );
}
