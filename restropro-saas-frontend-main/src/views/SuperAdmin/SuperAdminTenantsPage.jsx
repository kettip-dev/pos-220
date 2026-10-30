import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import Page from "../../components/Page";
import DeleteModal from "../../components/DeleteModal";
import {
  IconSearch,
  IconFilter,
  IconBuildingStore,
  IconCheck,
  IconX,
  IconPencil,
  IconCalendarEvent,
  IconTrash,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconPlus,
  IconDownload,
  IconPrinter,
  IconSettings,
  IconRefresh,
} from "@tabler/icons-react";
import { iconStroke, subscriptionPrice } from "../../config/config";
import {
  getTenantsData,
  addTenant,
  updateTenant,
  deleteTenant,
  getTenantsDataByStatus,
  getSuperAdminTenantsData,
} from "../../controllers/superadmin.controller";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { validateEmail } from "../../utils/emailValidator";
import useDebounce from "../../utils/useDebounce";
import { Link } from "react-router-dom";
import { useTheme } from "../../contexts/ThemeContext";
import { getPlans } from "../../controllers/plans.controller";

export default function SuperAdminTenantsPage() {
  const { t } = useTranslation();
  const filters = [
    { key: "today", value: "Today" },
    { key: "tomorrow", value: "Tomorrow" },
    { key: "yesterday", value: "Yesterday" },
    { key: "last_7days", value: "Last 7 Days" },
    { key: "this_month", value: "This Month" },
    { key: "last_month", value: "Last Month" },
    { key: "custom", value: "Custom" },
  ];

  const filterTypeRef = useRef();
  const fromDateRef = useRef();
  const toDateRef = useRef();
  const { theme } = useTheme();

  // For Add tenant
  const nameRef = useRef();
  const usernameRef = useRef();
  const passwordRef = useRef();
  const isActiveRef = useRef();
  const planRef = useRef();
  const [plansList, setPlansList] = useState([]);

  // For update
  const [tenantIdForUpdate, setTenantIdForUpdate] = useState(null);
  const [selectedPlanForUpdate, setSelectedPlanForUpdate] = useState("");

  const updatenameRef = useRef();
  const updateusernameRef = useRef();
  const updatepasswordRef = useRef();
  const updateisActiveRef = useRef();

  // For Delete
  const [tenantIdForDelete, setTenantIdForDelete] = useState(null);

  // Selected row ids for QuickBooks batch selection
  const [selectedTenantIds, setSelectedTenantIds] = useState([]);

  const now = new Date();
  const defaultDateFrom = `${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
  const defaultDateTo = `${now.getFullYear()}-${(now.getMonth() + 2)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;

  const [state, setState] = useState({
    status: "active",
    tenants: [],
    search: "",
    page: 1,
    perPage: 10,
    totalPages: 1,
    totalTenants: 0,
    activeTenants: 0,
    inactiveTenants: 0,
    allTenants: 0,
    filter: null,
    fromDate: null,
    toDate: null,
    isLoading: true,
  });

  const fetchData = async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      const superAdminTenantsData = await getSuperAdminTenantsData();
      const { activeTenants, inactiveTenants, allTenants } =
        superAdminTenantsData.data;

      const { data } = await getTenantsData({
        page: state.page,
        perPage: state.perPage,
        search: state.search,
        status: state.status,
        type: state.filter,
        from: state.fromDate,
        to: state.toDate,
      });

      if (data) {
        const { tenants, currentPage, perPage } = data;
        const { status } = state;

        let totalTenants;
        let totalPages;

        switch (status) {
          case "active":
            totalTenants = activeTenants;
            totalPages = Math.max(1, Math.ceil(activeTenants / perPage));
            break;
          case "inactive":
            totalTenants = inactiveTenants;
            totalPages = Math.max(1, Math.ceil(inactiveTenants / perPage));
            break;
          default:
            totalTenants = allTenants;
            totalPages = Math.max(1, Math.ceil(allTenants / perPage));
        }

        setState((prevState) => ({
          ...prevState,
          tenants: tenants || [],
          page: currentPage,
          perPage,
          totalPages,
          totalTenants,
          activeTenants,
          inactiveTenants,
          allTenants,
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error(t("superadmin_tenants.error_loading_tenants_data"), error);
      setState((prev) => ({ ...prev, isLoading: false }));
      toast.dismiss();
      toast.error(t("superadmin_tenants.error_loading_tenants_data"));
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await getPlans();
      if (res.status === 200) {
        const list = Array.isArray(res.data?.data)
          ? res.data.data
          : res.data?.data?.plans || res.data?.plans || [];
        setPlansList(list);
      }
    } catch (err) {
      console.error("Error fetching plans:", err);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    fetchData();
  }, [
    state.status,
    state.perPage,
    state.page,
    state.filter,
    state.fromDate,
    state.toDate,
  ]);

  const handleTabChange = (newStatus) => {
    setState((prevState) => ({
      ...prevState,
      status: newStatus,
      page: 1,
    }));
    setSelectedTenantIds([]);
  };

  useDebounce(
    () => {
      fetchData();
    },
    [state.search],
    500
  );

  const handleSearchChange = (event) => {
    const searchTerm = event.target.value;
    setState((prevState) => ({
      ...prevState,
      search: searchTerm,
      page: 1,
    }));
  };

  const handlePerPageChange = (e) => {
    const newPerPage = parseInt(e.target.value, 10);
    setState((prev) => ({
      ...prev,
      perPage: newPerPage,
      page: 1,
    }));
  };

  const btnPaginationFirstPage = () => {
    setState((prev) => ({ ...prev, page: 1 }));
  };

  const btnPaginationLastPage = () => {
    setState((prevState) => ({
      ...prevState,
      page: prevState.totalPages,
    }));
  };

  const btnPaginationNextPage = () => {
    if (state.page < state.totalPages) {
      setState((prevState) => ({
        ...prevState,
        page: prevState.page + 1,
      }));
    }
  };

  const btnPaginationPreviousPage = () => {
    if (state.page > 1) {
      setState((prevState) => ({
        ...prevState,
        page: prevState.page - 1,
      }));
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = state.tenants.map((t) => t.id);
      setSelectedTenantIds(allIds);
    } else {
      setSelectedTenantIds([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedTenantIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExportCSV = async () => {
    try {
      const { Parser } = await import("@json2csv/plainjs");
      const { saveAs } = await import("file-saver");

      const opts = {};
      const parser = new Parser(opts);

      const currStatus = state.status !== "" ? state.status : "all";
      const res = await getTenantsDataByStatus(currStatus);

      if (res.status === 200) {
        const data = res.data.map((tenant) => ({
          Name: tenant.name || "",
          Email: tenant.email || "",
          Status: tenant.is_active ? "Active" : "Inactive",
          Subscription_Start_Date: tenant.subscription_start || "",
          Subscription_End_Date: tenant.subscription_end || "",
          Plan: tenant.plan_title || subscriptionPrice || "Full Access",
        }));

        const csv = parser.parse(data);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

        const formattedStatus =
          state.status !== ""
            ? `${state.status.charAt(0).toUpperCase() + state.status.slice(1)}`
            : "All";
        const formattedDate = `${new Date().toISOString().substring(0, 10)}`;
        const fileName = `${formattedStatus} Tenants Data - ${formattedDate}.csv`;

        saveAs(blob, fileName);

        toast.dismiss();
        toast.success(t("superadmin_tenants.data_exported_successfully"));
      }
    } catch (error) {
      console.error(t("superadmin_tenants.failed_to_export_data"), error);
      toast.dismiss();
      toast.error(t("superadmin_tenants.failed_to_export_data"));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const btnAdd = async () => {
    const name = nameRef.current.value;
    const username = usernameRef.current.value;
    const password = passwordRef.current.value;
    const isActive = isActiveRef.current.checked;

    if (!name) {
      toast.error(t("superadmin_tenants.please_provide_name"));
      return;
    }
    if (!username) {
      toast.error(t("superadmin_tenants.please_provide_email"));
      return;
    }
    if (!password) {
      toast.error(t("superadmin_tenants.please_provide_password"));
      return;
    }

    if (!validateEmail(username)) {
      toast.error(t("superadmin_tenants.please_provide_valid_email"));
      return;
    }

    try {
      toast.loading(t("superadmin_tenants.please_wait"));
      const selectedPlan = planRef.current?.value || null;
      const res = await addTenant(
        name,
        username,
        password,
        isActive,
        selectedPlan
      );

      if (res.status === 200) {
        nameRef.current.value = "";
        usernameRef.current.value = "";
        passwordRef.current.value = "";
        isActiveRef.current.checked = true;
        if (planRef.current) planRef.current.value = "";

        const modal = document.getElementById("modal-add");
        if (modal) modal.close();

        await fetchData();

        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      console.log(t("superadmin_tenants.something_went_wrong"), error);
      const message =
        error?.response?.data?.message ||
        t("superadmin_tenants.something_went_wrong");
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  };

  const btnShowUpdate = (
    name,
    email,
    isActive,
    tenantId,
    paymentGatewayProductId
  ) => {
    updatenameRef.current.value = name || "";
    updateusernameRef.current.value = email || "";
    if (updatepasswordRef.current) updatepasswordRef.current.value = "";
    updateisActiveRef.current.checked = Boolean(isActive);
    setSelectedPlanForUpdate(paymentGatewayProductId || "");

    setTenantIdForUpdate(tenantId);

    const modal = document.getElementById("modal-update-tenant");
    if (modal) modal.showModal();
  };

  async function btnUpdate() {
    const name = updatenameRef.current.value;
    const email = updateusernameRef.current.value;
    const isActive = updateisActiveRef.current.checked ? 1 : 0;

    if (!name) {
      toast.error(t("superadmin_tenants.please_provide_name"));
      return;
    }

    if (!email) {
      toast.error(t("superadmin_tenants.please_provide_email"));
      return;
    }

    if (!validateEmail(email)) {
      toast.error(t("superadmin_tenants.please_provide_valid_email"));
      return;
    }

    try {
      toast.loading(t("superadmin_tenants.please_wait"));
      const password = updatepasswordRef.current?.value || null;
      const res = await updateTenant(
        name,
        email,
        isActive,
        tenantIdForUpdate,
        selectedPlanForUpdate || null,
        password
      );

      if (res.status === 200) {
        updatenameRef.current.value = "";
        updateusernameRef.current.value = "";
        if (updatepasswordRef.current) updatepasswordRef.current.value = "";
        updateisActiveRef.current.checked = false;
        setSelectedPlanForUpdate("");

        const modal = document.getElementById("modal-update-tenant");
        if (modal) modal.close();

        await fetchData();

        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        t("superadmin_tenants.something_went_wrong");
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  }

  const btnDelete = async (tenantId) => {
    try {
      toast.loading(t("superadmin_tenants.please_wait"));
      const res = await deleteTenant(tenantId);

      if (res.status === 200) {
        await fetchData();
        setSelectedTenantIds((prev) => prev.filter((id) => id !== tenantId));
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      console.log(error);
      const message =
        error?.response?.data?.message ||
        t("superadmin_tenants.something_went_wrong");
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  };

  const isAllSelected =
    state.tenants.length > 0 &&
    state.tenants.every((t) => selectedTenantIds.includes(t.id));

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      
      {/* Page Title & QuickBooks Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <span>Dashboard</span>
            <span>/</span>
            <span>Business Management</span>
            <span>/</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              {t("superadmin_tenants.title", "Businesses")}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {t("superadmin_tenants.title", "All Businesses")}
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
              {state.totalTenants} {t("superadmin_tenants.all", "Total")}
            </span>
          </div>
        </div>

        {/* Action Group */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData()}
            title="Refresh Data"
            className="p-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161B22] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition shadow-2xs"
          >
            <IconRefresh
              size={18}
              stroke={iconStroke}
              className={state.isLoading ? "animate-spin" : ""}
            />
          </button>

          <button
            onClick={() => document.getElementById("modal-add").showModal()}
            className="inline-flex items-center gap-2 bg-[#2CA01C] hover:bg-[#248417] text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-full shadow-sm hover:shadow transition active:scale-95"
          >
            <IconPlus size={18} stroke={2.5} />
            <span>{t("superadmin_tenants.add_tenant", "Add Business")}</span>
          </button>
        </div>
      </div>

      {/* QuickBooks Iconic Horizontal Status Ribbon / "Money Bar" */}
      <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs overflow-hidden grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 dark:divide-gray-800">
        
        {/* Active Tab */}
        <button
          type="button"
          onClick={() => handleTabChange("active")}
          className={clsx(
            "relative text-left p-4 sm:p-5 transition-all flex flex-col justify-between group",
            state.status === "active"
              ? "bg-emerald-50/60 dark:bg-emerald-950/20"
              : "hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
          )}
        >
          {/* Top Indicator Strip */}
          <div
            className={clsx(
              "absolute top-0 left-0 right-0 h-1 transition-all",
              state.status === "active" ? "bg-[#2CA01C]" : "bg-transparent group-hover:bg-emerald-400/50"
            )}
          />
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2CA01C]" />
              {t("superadmin_tenants.active", "Active")}
            </span>
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
              Live
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              {state.activeTenants}
            </span>
            <span className="text-xs text-gray-500 font-normal">
              tenants operational
            </span>
          </div>
        </button>

        {/* Inactive Tab */}
        <button
          type="button"
          onClick={() => handleTabChange("inactive")}
          className={clsx(
            "relative text-left p-4 sm:p-5 transition-all flex flex-col justify-between group",
            state.status === "inactive"
              ? "bg-amber-50/60 dark:bg-amber-950/20"
              : "hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
          )}
        >
          <div
            className={clsx(
              "absolute top-0 left-0 right-0 h-1 transition-all",
              state.status === "inactive" ? "bg-amber-500" : "bg-transparent group-hover:bg-amber-400/50"
            )}
          />
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {t("superadmin_tenants.inactive", "Inactive")}
            </span>
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
              Paused
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              {state.inactiveTenants}
            </span>
            <span className="text-xs text-gray-500 font-normal">
              needs attention
            </span>
          </div>
        </button>

        {/* All Tab */}
        <button
          type="button"
          onClick={() => handleTabChange("")}
          className={clsx(
            "relative text-left p-4 sm:p-5 transition-all flex flex-col justify-between group",
            state.status === ""
              ? "bg-blue-50/60 dark:bg-blue-950/20"
              : "hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
          )}
        >
          <div
            className={clsx(
              "absolute top-0 left-0 right-0 h-1 transition-all",
              state.status === "" ? "bg-[#0077C5]" : "bg-transparent group-hover:bg-blue-400/50"
            )}
          />
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0077C5]" />
              {t("superadmin_tenants.all", "All Businesses")}
            </span>
            <span className="text-[11px] font-medium text-blue-700 dark:text-blue-400 bg-blue-100/70 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
              Total
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              {state.allTenants}
            </span>
            <span className="text-xs text-gray-500 font-normal">
              registered restaurants
            </span>
          </div>
        </button>

      </div>

      {/* QuickBooks Pro Data Table Card */}
      <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs overflow-hidden">
        
        {/* Table Toolbar Header */}
        <div className="p-3.5 sm:p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#FAFBFD] dark:bg-[#161B22]">
          
          {/* Left: Search & Filter */}
          <div className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <IconSearch size={16} stroke={iconStroke} />
              </div>
              <input
                type="search"
                placeholder={t("superadmin_tenants.search_placeholder", "Filter by business name or email...")}
                value={state.search}
                onChange={handleSearchChange}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2CA01C] focus:border-[#2CA01C] transition"
              />
            </div>

            <button
              onClick={() => document.getElementById("filter-dialog").showModal()}
              type="button"
              className={clsx(
                "h-8 px-2.5 rounded-md border text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs",
                state.filter
                  ? "border-[#2CA01C] bg-emerald-50 text-[#108000] dark:bg-emerald-950/40"
                  : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50"
              )}
            >
              <IconFilter size={15} stroke={iconStroke} />
              <span className="hidden sm:inline">{t("superadmin_tenants.filter", "Filter")}</span>
              {state.filter && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#2CA01C]" />
              )}
            </button>

            {state.filter && (
              <button
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    filter: null,
                    fromDate: null,
                    toDate: null,
                  }))
                }
                title="Clear filter"
                className="text-xs text-red-600 hover:underline px-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* Right: QuickBooks Actions (Export, Print, Gear) */}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleExportCSV}
              type="button"
              title="Export Table to CSV"
              className="h-8 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
            >
              <IconDownload size={15} stroke={iconStroke} />
              <span>
                {state.status !== ""
                  ? t("superadmin_tenants.export_active_tenants", "Export Active")
                  : t("superadmin_tenants.export_all_tenants", "Export All")}
              </span>
            </button>

            <button
              onClick={handlePrint}
              type="button"
              title="Print Table"
              className="h-8 w-8 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60 flex items-center justify-center transition shadow-2xs"
            >
              <IconPrinter size={15} stroke={iconStroke} />
            </button>

            <button
              type="button"
              title="Table Preferences"
              className="h-8 w-8 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60 flex items-center justify-center transition shadow-2xs"
            >
              <IconSettings size={15} stroke={iconStroke} />
            </button>
          </div>

        </div>

        {/* Selected Rows Batch Bar (QuickBooks standard) */}
        {selectedTenantIds.length > 0 && (
          <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-xs font-medium text-emerald-900 dark:text-emerald-200">
            <span>
              {selectedTenantIds.length} business{selectedTenantIds.length > 1 ? "es" : ""} selected
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedTenantIds([])}
                className="hover:underline text-gray-600 dark:text-gray-400"
              >
                Deselect all
              </button>
            </div>
          </div>
        )}

        {/* Table Body Area */}
        {state.isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2">
            <span className="w-8 h-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#2CA01C]" />
            <p className="text-xs text-gray-500">Loading business tenants...</p>
          </div>
        ) : state.tenants.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center px-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3 text-gray-400">
              <IconBuildingStore size={24} stroke={iconStroke} />
            </div>
            <p className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
              {t("superadmin_tenants.no_tenants_found", "No businesses found")}
            </p>
            <p className="text-xs text-gray-500 max-w-sm mb-4">
              Try adjusting your search criteria or add a new restaurant tenant.
            </p>
            <button
              onClick={() => document.getElementById("modal-add").showModal()}
              className="inline-flex items-center gap-1.5 bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-semibold px-3 py-1.5 rounded-full transition shadow-xs"
            >
              <IconPlus size={16} stroke={2.5} />
              <span>{t("superadmin_tenants.add_tenant", "Add Business")}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              {/* Proper QuickBooks Table Header */}
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-[#F8F9FA] dark:bg-[#161B22] text-gray-600 dark:text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-[#2CA01C] focus:ring-[#2CA01C] cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4 min-w-[220px]">
                    {t("superadmin_tenants.tenant_details", "Business Details")}
                  </th>
                  <th className="py-3 px-4 min-w-[110px]">
                    {t("superadmin_tenants.status", "Status")}
                  </th>
                  <th className="py-3 px-4 min-w-[140px]">
                    {t("superadmin_tenants.subscription_start", "Subscription Start")}
                  </th>
                  <th className="py-3 px-4 min-w-[140px]">
                    {t("superadmin_tenants.subscription_end", "Subscription End")}
                  </th>
                  <th className="py-3 px-4 min-w-[120px]">
                    {t("superadmin_tenants.plan", "Plan")}
                  </th>
                  <th className="py-3 px-4 text-right min-w-[130px]">
                    {t("superadmin_tenants.actions", "Actions")}
                  </th>
                </tr>
              </thead>

              {/* Rows */}
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {state.tenants.map((tenant) => {
                  const isSelected = selectedTenantIds.includes(tenant.id);
                  const isLive = tenant.is_active === 1;

                  return (
                    <tr
                      key={tenant.id}
                      className={clsx(
                        "transition-colors group",
                        isSelected
                          ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                          : "hover:bg-[#F9FAFB] dark:hover:bg-[#1C2128]"
                      )}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(tenant.id)}
                          className="rounded border-gray-300 text-[#2CA01C] focus:ring-[#2CA01C] cursor-pointer"
                        />
                      </td>

                      {/* Business Details */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/60 text-[#2CA01C] flex items-center justify-center shrink-0">
                            <IconBuildingStore size={18} stroke={iconStroke} />
                          </div>
                          <div className="truncate">
                            <div className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm hover:text-[#2CA01C] cursor-pointer transition-colors truncate">
                              {tenant.name}
                            </div>
                            <div className="text-[11px] text-gray-500 font-normal truncate">
                              {tenant.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
                            isLive
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-[#108000] dark:text-[#2CA01C] border-emerald-200 dark:border-emerald-800/60"
                              : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/60"
                          )}
                        >
                          <span
                            className={clsx(
                              "w-1.5 h-1.5 rounded-full",
                              isLive ? "bg-[#2CA01C]" : "bg-red-500"
                            )}
                          />
                          {isLive
                            ? t("superadmin_tenants.active", "Active")
                            : t("superadmin_tenants.inactive", "Inactive")}
                        </span>
                      </td>

                      {/* Subscription Start */}
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300 font-medium">
                        {tenant.subscription_start ? (
                          <div className="flex items-center gap-1.5">
                            <IconCalendarEvent size={14} className="text-gray-400 shrink-0" />
                            <span>{tenant.subscription_start}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Subscription End */}
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300 font-medium">
                        {tenant.subscription_end ? (
                          <div className="flex items-center gap-1.5">
                            <IconCalendarEvent size={14} className="text-gray-400 shrink-0" />
                            <span>{tenant.subscription_end}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Plan */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/60">
                          {tenant.plan_title || "Full Access"}
                        </span>
                      </td>

                      {/* QuickBooks Action Column */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          <button
                            onClick={() =>
                              btnShowUpdate(
                                tenant.name,
                                tenant.email,
                                tenant.is_active,
                                tenant.id,
                                tenant.payment_gateway_product_id
                              )
                            }
                            title={t("superadmin_tenants.edit", "Edit")}
                            className="h-7 px-2.5 rounded-md border border-emerald-200 dark:border-emerald-800 text-[#108000] dark:text-[#2CA01C] hover:bg-emerald-50 dark:hover:bg-emerald-950/50 font-semibold text-xs flex items-center gap-1 transition"
                          >
                            <IconPencil size={13} stroke={iconStroke} />
                            <span>Edit</span>
                          </button>

                          <Link
                            to={`/superadmin/dashboard/tenants/${tenant.id}/subscription-history`}
                            title="Subscription History"
                            className="h-7 w-7 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition"
                          >
                            <IconCalendarEvent size={14} stroke={iconStroke} />
                          </Link>

                          <button
                            onClick={() => setTenantIdForDelete(tenant.id)}
                            title={t("superadmin_tenants.delete", "Delete")}
                            className="h-7 w-7 rounded-md border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center transition"
                          >
                            <IconTrash size={14} stroke={iconStroke} />
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

        {/* QuickBooks Table Footer / Pagination */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-[#FAFBFD] dark:bg-[#161B22] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600 dark:text-gray-400">
          
          {/* Left: Summary text */}
          <div>
            <span>
              {t("superadmin_tenants.showing", "Showing")}
            </span>{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {state.tenants.length > 0 ? (state.page - 1) * state.perPage + 1 : 0}
            </span>{" "}
            -{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {Math.min(state.page * state.perPage, state.totalTenants)}
            </span>{" "}
            {t("superadmin_tenants.of", "of")}{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {state.totalTenants}
            </span>{" "}
            businesses
          </div>

          {/* Right: Per page & Page controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500">Rows:</span>
              <select
                value={state.perPage}
                onChange={handlePerPageChange}
                className="py-1 px-2 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={btnPaginationFirstPage}
                disabled={state.page <= 1}
                title="First Page"
                className="p-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <IconChevronsLeft size={14} stroke={iconStroke} />
              </button>
              <button
                onClick={btnPaginationPreviousPage}
                disabled={state.page <= 1}
                title="Previous Page"
                className="p-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <IconChevronLeft size={14} stroke={iconStroke} />
              </button>

              <span className="px-2.5 py-1 text-xs font-semibold rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                {state.page} / {state.totalPages}
              </span>

              <button
                onClick={btnPaginationNextPage}
                disabled={state.page >= state.totalPages}
                title="Next Page"
                className="p-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <IconChevronRight size={14} stroke={iconStroke} />
              </button>
              <button
                onClick={btnPaginationLastPage}
                disabled={state.page >= state.totalPages}
                title="Last Page"
                className="p-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <IconChevronsRight size={14} stroke={iconStroke} />
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* QuickBooks Filter Dialog */}
      <dialog id="filter-dialog" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161B22] p-6 max-w-md">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
              <IconFilter size={18} stroke={iconStroke} className="text-[#2CA01C]" />
              {t("superadmin_tenants.filter", "Filter Businesses")}
            </h3>
            <form method="dialog">
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs">
                
              </button>
            </form>
          </div>

          <div className="py-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("superadmin_tenants.filter", "Date Range Filter")}
              </label>
              <select
                ref={filterTypeRef}
                defaultValue="today"
                className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-[#2CA01C]"
              >
                {filters.map((filter) => (
                  <option key={filter.key} value={filter.key}>
                    {filter.value}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("superadmin_tenants.from", "From Date")}
                </label>
                <input
                  defaultValue={defaultDateFrom}
                  type="date"
                  ref={fromDateRef}
                  className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-[#2CA01C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("superadmin_tenants.to", "To Date")}
                </label>
                <input
                  defaultValue={defaultDateTo}
                  type="date"
                  ref={toDateRef}
                  className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-[#2CA01C]"
                />
              </div>
            </div>
          </div>

          <div className="modal-action pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
            <form method="dialog" className="flex gap-2">
              <button className="px-3.5 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50">
                {t("superadmin_tenants.close", "Cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setState({
                    ...state,
                    filter: filterTypeRef.current.value,
                    fromDate: fromDateRef.current.value || null,
                    toDate: toDateRef.current.value || null,
                  });
                  const modal = document.getElementById("filter-dialog");
                  if (modal) modal.close();
                }}
                className="px-4 py-1.5 rounded-md bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-semibold shadow-xs"
              >
                {t("superadmin_tenants.apply", "Apply Filter")}
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* QuickBooks Add Tenant Modal */}
      <dialog id="modal-add" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161B22] p-6 max-w-lg">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                {t("superadmin_tenants.add_new_tenant", "Add New Business")}
              </h3>
              <p className="text-xs text-gray-500">
                Create a new restaurant tenant and setup its administrator credentials.
              </p>
            </div>
            <form method="dialog">
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs">
                
              </button>
            </form>
          </div>

          <div className="py-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {t("superadmin_tenants.tenant_name", "Business / Restaurant Name")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                ref={nameRef}
                type="text"
                placeholder={t("superadmin_tenants.enter_tenant_name", "e.g. Bistro Gourmet")}
                className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2CA01C] focus:border-[#2CA01C]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t("superadmin_tenants.email", "Admin Email")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  ref={usernameRef}
                  type="email"
                  placeholder={t("superadmin_tenants.enter_email", "admin@restaurant.com")}
                  className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2CA01C] focus:border-[#2CA01C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t("superadmin_tenants.password", "Initial Password")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  ref={passwordRef}
                  type="password"
                  placeholder={t("superadmin_tenants.enter_password", "••••••••")}
                  className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2CA01C] focus:border-[#2CA01C]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {t("superadmin_tenants.assign_plan", "Subscription Plan")}
              </label>
              <select
                ref={planRef}
                className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
              >
                <option value="">Full Access (All Enterprise Features)</option>
                {plansList.map((p) => (
                  <option key={p.id} value={p.payment_gateway_product_id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                ref={isActiveRef}
                type="checkbox"
                id="modal-add-active"
                defaultChecked={true}
                className="rounded border-gray-300 text-[#2CA01C] focus:ring-[#2CA01C]"
              />
              <label
                htmlFor="modal-add-active"
                className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                {t("superadmin_tenants.active", "Activate business immediately upon creation")}
              </label>
            </div>
          </div>

          <div className="modal-action pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
            <form method="dialog" className="flex gap-2">
              <button className="px-3.5 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50">
                {t("superadmin_tenants.close", "Cancel")}
              </button>
              <button
                type="button"
                onClick={btnAdd}
                className="px-4 py-2 rounded-md bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-semibold shadow-xs"
              >
                {t("superadmin_tenants.save", "Save Business")}
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* QuickBooks Update Tenant Modal */}
      <dialog id="modal-update-tenant" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161B22] p-6 max-w-lg">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                {t("superadmin_tenants.update_tenant", "Edit Business")}
              </h3>
              <p className="text-xs text-gray-500">
                Update restaurant profile, plan assignment, or credentials.
              </p>
            </div>
            <form method="dialog">
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs">
                
              </button>
            </form>
          </div>

          <div className="py-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {t("superadmin_tenants.tenant_name", "Business Name")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                ref={updatenameRef}
                type="text"
                className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {t("superadmin_tenants.email", "Admin Email")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                ref={updateusernameRef}
                type="email"
                className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {t("superadmin_tenants.password", "New Password")}{" "}
                <span className="text-xs font-normal text-gray-400">
                  (Leave blank to keep current password)
                </span>
              </label>
              <input
                ref={updatepasswordRef}
                type="password"
                placeholder="Enter new password (optional)"
                className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {t("superadmin_tenants.assign_plan", "Subscription Plan")}
              </label>
              <select
                value={selectedPlanForUpdate}
                onChange={(e) => setSelectedPlanForUpdate(e.target.value)}
                className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
              >
                <option value="">Full Access (All Features)</option>
                {plansList.map((p) => (
                  <option key={p.id} value={p.payment_gateway_product_id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                ref={updateisActiveRef}
                type="checkbox"
                id="modal-update-active"
                className="rounded border-gray-300 text-[#2CA01C] focus:ring-[#2CA01C]"
              />
              <label
                htmlFor="modal-update-active"
                className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                {t("superadmin_tenants.active", "Tenant Account Active")}
              </label>
            </div>
          </div>

          <div className="modal-action pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
            <form method="dialog" className="flex gap-2">
              <button className="px-3.5 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50">
                {t("superadmin_tenants.close", "Cancel")}
              </button>
              <button
                type="button"
                onClick={btnUpdate}
                className="px-4 py-2 rounded-md bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-semibold shadow-xs"
              >
                {t("superadmin_tenants.save", "Save Changes")}
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={Boolean(tenantIdForDelete)}
        onClose={() => setTenantIdForDelete(null)}
        onConfirm={async () => {
          const id = tenantIdForDelete;
          setTenantIdForDelete(null);
          await btnDelete(id);
        }}
        title={t("superadmin_tenants.are_you_sure", "Are you sure?")}
        description={t(
          "superadmin_tenants.irreversible_action",
          "This will delete the restaurant tenant and its operational database."
        )}
        warningMessage={t(
          "superadmin_tenants.permanently_deleted",
          "This action cannot be undone."
        )}
        confirmText={t("superadmin_tenants.yes_delete", "Delete Business")}
        cancelText={t("superadmin_tenants.cancel", "Cancel")}
      />

    </div>
  );
}
