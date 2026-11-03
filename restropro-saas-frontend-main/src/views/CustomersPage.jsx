import React, { useRef, useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Page from "../components/Page";
import DeleteModal from "../components/DeleteModal";
import {
  IconAward,
  IconCalendarPlus,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconCoins,
  IconDownload,
  IconFileSpreadsheet,
  IconChartBar,
  IconPencil,
  IconPhone,
  IconPlus,
  IconPrinter,
  IconSearch,
  IconSettings,
  IconTableImport,
  IconTrash,
  IconUser,
  IconUserCheck,
  IconUsers,
  IconX,
  IconMail,
  IconCheck,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import DialogAddCustomer from "../components/DialogAddCustomer";
import CustomerGroupsTab from "./CustomerGroupsTab";
import {
  useCustomerGroups,
  bulkAssignCustomerGroup,
} from "../controllers/customer_groups.controller";
import {
  deleteCustomer,
  getAllCustomers,
  updateCustomer,
  useCustomers,
} from "../controllers/customers.controller";
import clsx from "clsx";
import { toast } from "react-hot-toast";
import { mutate } from "swr";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { isAllBusinessesScope } from "../helpers/BusinessScope";
import { SCOPES, hasFullBusinessAccess } from "../config/scopes";
import { validateEmail } from "../utils/emailValidator";
import { validatePhone } from "../utils/phoneValidator";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";

export default function CustomersPage({ initialTab = "customers" }) {
  const { t } = useTranslation();
  const { role, scope } = getUserDetailsInLocalStorage();
  const isConsolidated = isAllBusinessesScope(role);
  const userScopes = scope?.split(",") || [];
  const { theme } = useTheme();

  let isManageAllowed = false;
  if (hasFullBusinessAccess(role)) {
    isManageAllowed = true;
  } else {
    if (
      userScopes.includes(SCOPES.CUSTOMERS) ||
      userScopes.includes(SCOPES.MANAGE_CUSTOMERS)
    ) {
      isManageAllowed = true;
    }
  }

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const isGroupsRoute =
    initialTab === "groups" ||
    searchParams.get("tab") === "groups" ||
    location.pathname.includes("customer-groups") ||
    location.pathname.includes("customers/groups");

  const [activeMainTab, setActiveMainTab] = useState(
    isGroupsRoute ? "groups" : "customers"
  );

  useEffect(() => {
    const isGroups =
      initialTab === "groups" ||
      searchParams.get("tab") === "groups" ||
      location.pathname.includes("customer-groups") ||
      location.pathname.includes("customers/groups");
    setActiveMainTab(isGroups ? "groups" : "customers");
  }, [location.pathname, searchParams, initialTab]);

  const handleTabChange = (tab) => {
    setActiveMainTab(tab);
    if (tab === "groups") {
      navigate("/dashboard/customer-groups");
    } else {
      navigate("/dashboard/customers");
    }
  };

  const phoneRef = useRef();
  const nameRef = useRef();
  const emailRef = useRef();
  const genderRef = useRef();
  const birthDateRef = useRef();
  const searchRef = useRef();
  const settingsBtnRef = useRef();
  const actionsBtnRef = useRef();

  const [deleteCustomerPhone, setDeleteCustomerPhone] = useState(null);
  const [selectedCustomers, setSelectedCustomers] = useState(new Set());
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [editCustomerGroupId, setEditCustomerGroupId] = useState("");
  const [bulkGroupDropdownOpen, setBulkGroupDropdownOpen] = useState(false);
  const { customerGroups = [], mutate: mutateGroups } = useCustomerGroups();

  // Table options (QuickBooks gear icon settings)
  const [tableSettings, setTableSettings] = useState({
    compactDensity: false,
    pageSize: 10,
    showGearMenu: false,
    visibleColumns: {
      phone: true,
      email: true,
      group: true,
      created: true,
      business: true,
    },
  });

  const [sorting, setSorting] = useState({
    field: "created_at",
    direction: "desc",
  });

  const [state, setState] = useState({
    spage: 1,
    search: "",
  });
  const [searchInput, setSearchInput] = useState(state.search);

  // Debounced search sync
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.trim() !== state.search) {
        setState((prev) => ({
          ...prev,
          search: searchInput.trim(),
          spage: 1,
        }));
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, state.search]);

  const { APIURL, data, error, isLoading } = useCustomers({
    page: state.spage,
    perPage: tableSettings.pageSize,
    filter: state.search,
    sort: sorting.field,
  });

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        settingsBtnRef.current &&
        !settingsBtnRef.current.contains(e.target)
      ) {
        setTableSettings((p) => ({ ...p, showGearMenu: false }));
      }
      if (
        actionsBtnRef.current &&
        !actionsBtnRef.current.contains(e.target)
      ) {
        setShowActionsDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const {
    customers = [],
    currentPage = 1,
    totalPages = 1,
    totalCustomers = 0,
    summary,
  } = data || {};

  // Prefer the server's page-independent totals; fall back to the current
  // page if an older backend doesn't send `summary`.
  const loyaltyMembersCount = useMemo(() => {
    if (summary) return Number(summary.loyaltyMembers || 0);
    return customers.filter((c) => c.is_member || c.membership_tier).length;
  }, [summary, customers]);

  const totalRewardPoints = useMemo(() => {
    if (summary) return Number(summary.totalPoints || 0);
    return customers.reduce((sum, c) => sum + Number(c.points_balance || 0), 0);
  }, [summary, customers]);

  // Client-side sort fallback / refinement
  const sortedCustomers = [...customers].sort((a, b) => {
    let aVal = a[sorting.field] || "";
    let bVal = b[sorting.field] || "";

    if (sorting.field === "created_at") {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    } else {
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
    }

    if (aVal < bVal) return sorting.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sorting.direction === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (field) => {
    setSorting((prev) => {
      if (prev.field === field) {
        return {
          field,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { field, direction: "asc" };
    });
  };

  // Pagination Handlers
  const btnPaginationPreviousPage = () => {
    if (currentPage <= 1) return;
    setState((prev) => ({ ...prev, spage: prev.spage - 1 }));
  };

  const btnPaginationNextPage = () => {
    if (currentPage >= totalPages) return;
    setState((prev) => ({ ...prev, spage: prev.spage + 1 }));
  };

  // Selection Logic
  const isAllCurrentPageSelected =
    customers.length > 0 &&
    customers.every((c) => selectedCustomers.has(c.phone));

  const toggleSelectAll = () => {
    if (isAllCurrentPageSelected) {
      setSelectedCustomers(new Set());
    } else {
      const allPhones = new Set(customers.map((c) => c.phone));
      setSelectedCustomers(allPhones);
    }
  };

  const toggleSelectRow = (phone) => {
    setSelectedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) {
        next.delete(phone);
      } else {
        next.add(phone);
      }
      return next;
    });
  };

  // Delete Action
  const btnDelete = async (id) => {
    try {
      toast.loading(t("customers.please_wait"));
      const res = await deleteCustomer(id);

      if (res.status === 200) {
        await mutate(APIURL);
        setSelectedCustomers((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (err) {
      const message =
        err?.response?.data?.message || t("customers.something_went_wrong");
      console.error(err);
      toast.dismiss();
      toast.error(message);
    }
  };

  // Search Handlers
  const btnSearch = () => {
    setState((prev) => ({
      ...prev,
      search: searchInput.trim(),
      spage: 1,
    }));
  };

  const btnClearSearch = () => {
    setSearchInput("");
    setState((prev) => ({
      ...prev,
      search: "",
      spage: 1,
    }));
  };

  // Update Customer Handlers
  const btnShowUpdate = (phone, name, email, birthDate, gender, customerGroupId = null) => {
    if (phoneRef.current) phoneRef.current.value = phone;
    if (nameRef.current) nameRef.current.value = name;
    if (emailRef.current) emailRef.current.value = email || "";
    setEditCustomerGroupId(customerGroupId ? String(customerGroupId) : "");

    const bDate = birthDate ? new Date(birthDate) : null;
    if (birthDateRef.current) {
      birthDateRef.current.value = bDate
        ? `${bDate.getFullYear()}-${(bDate.getMonth() + 1)
            .toString()
            .padStart(2, "0")}-${bDate.getDate().toString().padStart(2, "0")}`
        : "";
    }
    if (genderRef.current) genderRef.current.value = gender || "";

    document.getElementById("modal-update-customer")?.showModal();
  };

  async function btnUpdate() {
    const phone = phoneRef.current?.value;
    const name = nameRef.current?.value;
    const email = emailRef.current?.value || null;
    const gender = genderRef.current?.value || null;
    const birthDate = birthDateRef.current?.value || null;
    const customerGroupId = editCustomerGroupId ? Number(editCustomerGroupId) : null;

    if (!phone) {
      toast.error(t("customers.please_provide_phone"));
      return;
    }

    if (!name) {
      toast.error(t("customers.please_provide_name"));
      return;
    }

    if (email && !validateEmail(email)) {
      toast.error(t("customers.please_provide_valid_email"));
      return;
    }
    if (!validatePhone(phone)) {
      toast.error(t("customers.please_provide_valid_phone"));
      return;
    }

    try {
      toast.loading(t("customers.please_wait"));
      const res = await updateCustomer(phone, name, email, birthDate, gender, customerGroupId);

      if (res.status === 200) {
        if (phoneRef.current) phoneRef.current.value = "";
        if (nameRef.current) nameRef.current.value = "";
        if (emailRef.current) emailRef.current.value = "";
        if (genderRef.current) genderRef.current.value = "";
        if (birthDateRef.current) birthDateRef.current.value = "";

        await mutate(APIURL);

        toast.dismiss();
        toast.success(res.data.message);
        document.getElementById("modal-update-customer")?.close();
      }
    } catch (err) {
      const message =
        err?.response?.data?.message || t("customers.something_went_wrong");
      console.error(err);
      toast.dismiss();
      toast.error(message);
    }
  }

  // Export handlers
  const btnDownloadCustomerDataVisible = async () => {
    try {
      toast.loading(t("customers.please_wait"));
      if (customers.length === 0) {
        toast.dismiss();
        toast.error("No data found!");
        return;
      }

      const { Parser } = await import("@json2csv/plainjs");
      const { saveAs } = await import("file-saver");
      const parser = new Parser({});
      const csv = parser.parse(customers);

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      toast.dismiss();
      saveAs(blob, "Customers_Page.csv");
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error(t("customers.something_went_wrong"));
    }
  };

  const btnDownloadCustomerAllData = async () => {
    try {
      toast.loading("Please wait...");
      const res = await getAllCustomers();

      if (res.status === 200) {
        toast.dismiss();
        if (res.data?.length === 0) {
          toast.error("No data found!");
          return;
        }
        const allList = res.data;
        const { Parser } = await import("@json2csv/plainjs");
        const { saveAs } = await import("file-saver");
        const parser = new Parser({});
        const csv = parser.parse(allList);

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        saveAs(blob, "All_Customers.csv");
      }
    } catch (err) {
      const message =
        err?.response?.data?.message || t("customers.something_went_wrong");
      console.error(err);
      toast.dismiss();
      toast.error(message);
    }
  };

  const btnDownloadSelected = async () => {
    try {
      toast.loading(t("customers.please_wait"));
      const selectedList = customers.filter((c) =>
        selectedCustomers.has(c.phone)
      );
      if (selectedList.length === 0) {
        toast.dismiss();
        toast.error("No customers selected");
        return;
      }

      const { Parser } = await import("@json2csv/plainjs");
      const { saveAs } = await import("file-saver");
      const parser = new Parser({});
      const csv = parser.parse(selectedList);

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      toast.dismiss();
      saveAs(blob, "Selected_Customers.csv");
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error(t("customers.something_went_wrong"));
    }
  };

  const handlePrintTable = () => {
    window.print();
  };

  const { compactDensity, visibleColumns } = tableSettings;
  const totalCustomerCount = totalCustomers || customers.length;
  const startIndex = (currentPage - 1) * tableSettings.pageSize;
  const endIndex = Math.min(
    startIndex + tableSettings.pageSize,
    totalCustomerCount
  );

  const isGroupsTab = activeMainTab === "groups";
  const listedCount = customers.length;
  // Denominator matches the source of the numerator: all customers when the
  // server sent a summary, otherwise just this page.
  const summaryBase = summary ? totalCustomerCount : listedCount;
  const loyaltyPercent = summaryBase
    ? Math.round((loyaltyMembersCount / summaryBase) * 100)
    : 0;
  const avgPoints = summaryBase
    ? Math.round((totalRewardPoints / summaryBase) * 10) / 10
    : 0;

  const summaryStats = [
    {
      key: "total",
      icon: IconUsers,
      iconClass: "text-emerald-600 dark:text-emerald-400",
      label: t("customers.total_customers", "Total Customers"),
      value: totalCustomerCount,
      hint: t("customers.stat_groups_hint", {
        count: customerGroups.length,
        defaultValue: "{{count}} customer groups",
      }),
    },
    {
      key: "loyalty",
      icon: IconAward,
      iconClass: "text-amber-500",
      label: t("customers.loyalty_members", "Loyalty Members"),
      value: loyaltyMembersCount,
      progress: loyaltyPercent,
      hint: t("customers.stat_loyalty_hint", {
        percent: loyaltyPercent,
        defaultValue: "{{percent}}% of customers",
      }),
    },
    {
      key: "points",
      icon: IconCoins,
      iconClass: "text-indigo-500 dark:text-indigo-400",
      label: t("customers.points_pool", "Reward Points"),
      value: totalRewardPoints,
      hint: t("customers.stat_points_hint", {
        avg: avgPoints.toLocaleString(),
        defaultValue: "≈ {{avg}} pts per customer",
      }),
    },
    {
      key: "page",
      icon: IconUserCheck,
      iconClass: "text-sky-600 dark:text-sky-400",
      label: t("customers.active_page", "Active on Page"),
      value: listedCount,
      hint: t("customers.stat_page_hint", {
        total: totalCustomerCount.toLocaleString(),
        defaultValue: "of {{total}} total",
      }),
    },
  ];

  return (
    <Page>
      {/* ── Page Header ── */}
      <header className="mb-5">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400 mb-2"
        >
          <span>Customers & CRM</span>
          <IconChevronRight
            size={12}
            stroke={iconStroke}
            className="text-slate-300 dark:text-neutral-600"
          />
          <span className="text-slate-700 dark:text-neutral-200 font-medium">
            {isGroupsTab
              ? t("customer_groups.title", "Customer Groups")
              : t("customers.title", "Customers")}
          </span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-[30px] font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                {isGroupsTab
                  ? t("customer_groups.title", "Customer Groups")
                  : t("customers.title", "Customers")}
              </h1>
              {!isLoading && (
                <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-200 dark:ring-emerald-800 px-2.5 py-0.5 text-sm font-semibold tabular-nums">
                  {(isGroupsTab
                    ? customerGroups.length
                    : totalCustomerCount
                  ).toLocaleString()}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">
              {isGroupsTab
                ? t(
                    "customer_groups.subtitle",
                    "Organize customer tiers, apply automated discounts and manage membership"
                  )
                : t(
                    "customers.subtitle",
                    "Manage customer accounts, contact details and insights"
                  )}
            </p>
          </div>

          {/* Primary actions */}
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {!isGroupsTab ? (
              <>
                <div className="relative" ref={actionsBtnRef}>
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={showActionsDropdown}
                    onClick={() => setShowActionsDropdown((p) => !p)}
                    className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-[#18181b] hover:bg-slate-50 dark:hover:bg-[#202020] text-slate-700 dark:text-slate-200 text-sm font-medium flex items-center gap-2 active:scale-95 transition shadow-xs"
                  >
                    <span>{t("customers.actions") || "Actions"}</span>
                    <IconChevronDown
                      size={15}
                      stroke={iconStroke}
                      className={clsx(
                        "text-slate-400 transition-transform",
                        showActionsDropdown && "rotate-180"
                      )}
                    />
                  </button>

                  {showActionsDropdown && (
                    <ul
                      role="menu"
                      className="absolute right-0 top-12 z-[100] p-1.5 shadow-xl bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-neutral-700 rounded-xl w-56 text-sm font-medium space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
                    >
                      <li>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowActionsDropdown(false);
                            btnDownloadCustomerDataVisible();
                          }}
                          className="flex w-full min-h-[42px] items-center gap-2.5 px-3 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition active:scale-95"
                        >
                          <IconDownload size={16} stroke={iconStroke} className="text-slate-400" />
                          <span>{t("customers.download_visible")}</span>
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowActionsDropdown(false);
                            btnDownloadCustomerAllData();
                          }}
                          className="flex w-full min-h-[42px] items-center gap-2.5 px-3 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition active:scale-95"
                        >
                          <IconFileSpreadsheet size={16} stroke={iconStroke} className="text-emerald-600" />
                          <span>{t("customers.download_all")}</span>
                        </button>
                      </li>
                      <li className="my-1 border-t border-slate-100 dark:border-neutral-800" aria-hidden="true" />
                      <li>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowActionsDropdown(false);
                            navigate("import");
                          }}
                          className="flex w-full min-h-[42px] items-center gap-2.5 px-3 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition active:scale-95"
                        >
                          <IconTableImport size={16} stroke={iconStroke} className="text-slate-400" />
                          <span>{t("customers.import")}</span>
                        </button>
                      </li>
                    </ul>
                  )}
                </div>

                {isManageAllowed && (
                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById("modal-add-customer")?.showModal()
                    }
                    className="min-h-[42px] pl-3.5 pr-4 rounded-xl bg-[#107c41] hover:bg-[#0c6634] text-white text-sm font-semibold flex items-center gap-2 active:scale-95 transition shadow-sm"
                  >
                    <IconPlus size={18} stroke={2.25} />
                    <span>{t("customers.new") || "New customer"}</span>
                  </button>
                )}
              </>
            ) : (
              isManageAllowed && (
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("open-add-customer-group"));
                  }}
                  className="min-h-[42px] pl-3.5 pr-4 rounded-xl bg-[#107c41] hover:bg-[#0c6634] text-white text-sm font-semibold flex items-center gap-2 active:scale-95 transition shadow-sm"
                >
                  <IconPlus size={18} stroke={2.25} />
                  <span>{t("customer_groups.new_group", "New Customer Group")}</span>
                </button>
              )
            )}
          </div>
        </div>
      </header>

      {/* ── Section switcher: Customers vs Customer Groups ── */}
      <div
        role="tablist"
        aria-label={t("customers.title", "Customers")}
        className="inline-flex max-w-full overflow-x-auto items-center gap-1 p-1 mb-5 rounded-xl bg-slate-100 dark:bg-neutral-900 border border-slate-200/70 dark:border-neutral-800"
      >
        {[
          {
            key: "customers",
            icon: IconUser,
            label: t("customer_groups.tab_customers", "Customers"),
            count: totalCustomerCount,
          },
          {
            key: "groups",
            icon: IconUsers,
            label: t("customer_groups.tab_groups", "Customer Groups"),
            count: customerGroups.length,
          },
        ].map(({ key, icon: TabIcon, label, count }) => {
          const isActive = activeMainTab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabChange(key)}
              className={clsx(
                "min-h-[42px] px-4 rounded-lg text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition active:scale-95",
                isActive
                  ? "bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200/70 dark:ring-neutral-700"
                  : "text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200"
              )}
            >
              <TabIcon
                size={18}
                stroke={iconStroke}
                className={isActive ? "text-[#107c41] dark:text-emerald-400" : ""}
              />
              <span>{label}</span>
              <span
                className={clsx(
                  "min-w-[22px] text-center text-xs px-1.5 py-0.5 rounded-md font-semibold tabular-nums",
                  isActive
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                    : "bg-slate-200/70 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {isGroupsTab ? (
        <CustomerGroupsTab isManageAllowed={isManageAllowed} />
      ) : (
        <>
          {/* ── Summary strip: one surface, four metrics ── */}
          <section
            aria-label={t("customers.summary", "Customer summary")}
            className="grid grid-cols-2 lg:grid-cols-4 gap-px mb-5 rounded-2xl overflow-hidden border border-slate-200 dark:border-neutral-800 bg-slate-200 dark:bg-neutral-800 shadow-xs"
          >
            {summaryStats.map((stat) => {
              const StatIcon = stat.icon;
              return (
                <div
                  key={stat.key}
                  className="bg-white dark:bg-neutral-900 p-4 sm:p-5 flex flex-col"
                >
                  <div className="flex items-center gap-2 text-[13px] font-medium text-slate-500 dark:text-neutral-400">
                    <StatIcon size={16} stroke={iconStroke} className={stat.iconClass} />
                    <span className="truncate">{stat.label}</span>
                  </div>
                  <div className="mt-3 text-[28px] sm:text-[32px] font-bold leading-none tracking-tight text-slate-900 dark:text-white tabular-nums">
                    {isLoading ? (
                      <span className="inline-block h-7 w-12 rounded-md bg-slate-100 dark:bg-neutral-800 animate-pulse" />
                    ) : (
                      stat.value.toLocaleString()
                    )}
                  </div>
                  {typeof stat.progress === "number" && (
                    <div
                      className="mt-3 h-1.5 w-full rounded-full bg-slate-100 dark:bg-neutral-800 overflow-hidden"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all"
                        style={{ width: `${stat.progress}%` }}
                      />
                    </div>
                  )}
                  <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400 truncate">
                    {stat.hint}
                  </p>
                </div>
              );
            })}
          </section>

      {/* ── Selection Action Banner (When rows are checked) ── */}
      {selectedCustomers.size > 0 && (
        <div className="mb-3 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              {selectedCustomers.size} customer
              {selectedCustomers.size > 1 ? "s" : ""} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Bulk Assign Customer Group Dropdown */}
            {isManageAllowed && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setBulkGroupDropdownOpen((p) => !p)}
                  className="px-3 py-1.5 rounded-md bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition active:scale-95 flex items-center gap-1.5"
                >
                  <IconUsers size={14} />
                  <span>{t("customer_groups.assign_to_group", "Assign to Group")}</span>
                  <IconChevronDown size={12} />
                </button>
                {bulkGroupDropdownOpen && (
                  <div className="absolute right-0 top-9 z-[120] p-1.5 shadow-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl w-56 text-xs space-y-1">
                    <button
                      type="button"
                      onClick={async () => {
                        setBulkGroupDropdownOpen(false);
                        try {
                          await bulkAssignCustomerGroup(Array.from(selectedCustomers), null);
                          toast.success(t("customer_groups.bulk_assign_success", { count: selectedCustomers.size }));
                          await mutate(APIURL);
                          mutateGroups();
                          setSelectedCustomers(new Set());
                        } catch (e) {
                          toast.error(e.message);
                        }
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium"
                    >
                      {t("customer_groups.no_group", "No Group (Clear)")}
                    </button>
                    {customerGroups.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={async () => {
                          setBulkGroupDropdownOpen(false);
                          try {
                            await bulkAssignCustomerGroup(Array.from(selectedCustomers), g.id);
                            toast.success(t("customer_groups.bulk_assign_success", { count: selectedCustomers.size }));
                            await mutate(APIURL);
                            mutateGroups();
                            setSelectedCustomers(new Set());
                          } catch (e) {
                            toast.error(e.message);
                          }
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-between font-medium"
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                          {g.name}
                        </span>
                        {g.discount_value > 0 && (
                          <span className="text-[10px] text-indigo-500 font-mono font-bold">
                            {g.discount_type === "PERCENTAGE" ? `${g.discount_value}%` : `$${g.discount_value}`}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={btnDownloadSelected}
              className="px-3 py-1.5 rounded-md bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-semibold hover:bg-emerald-100 dark:hover:bg-neutral-700 transition active:scale-95"
            >
              Export Selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedCustomers(new Set())}
              className="px-3 py-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium hover:bg-slate-200/60 dark:hover:bg-neutral-800 transition"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* ── Filter & Action Toolbar (table-design-system Standard) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        {/* Left Side: Real-time search */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <IconSearch size={16} stroke={iconStroke} />
            </div>
            <input
              ref={searchRef}
              type="text"
              value={searchInput}
              placeholder={
                t("customers.search_placeholder") || "Filter by name or phone..."
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  btnSearch();
                }
              }}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full min-h-[38px] pl-9 pr-8 py-1.5 text-xs sm:text-[13px] rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-[#18181b] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-xs"
            />
            {searchInput && (
              <button
                type="button"
                onClick={btnClearSearch}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <IconX size={14} stroke={iconStroke} />
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Print, Export, Gear Settings, and Inline Pagination */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          {/* Action Icons */}
          <div className="flex items-center gap-1.5 border-r border-slate-200 dark:border-neutral-700 pr-2.5">
            {/* Print Table */}
            <button
              type="button"
              onClick={handlePrintTable}
              title="Print table"
              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-[#18181b] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95 shadow-xs"
            >
              <IconPrinter size={16} stroke={iconStroke} />
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={btnDownloadCustomerDataVisible}
              title="Export table data"
              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-[#18181b] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95 shadow-xs"
            >
              <IconDownload size={16} stroke={iconStroke} />
            </button>

            {/* Settings Gear Popover */}
            <div className="relative" ref={settingsBtnRef}>
              <button
                type="button"
                onClick={() =>
                  setTableSettings((p) => ({
                    ...p,
                    showGearMenu: !p.showGearMenu,
                  }))
                }
                title="Table settings"
                className={clsx(
                  "w-9 h-9 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-[#18181b] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95 shadow-xs",
                  tableSettings.showGearMenu &&
                    "bg-slate-200 dark:bg-neutral-800 text-slate-900 dark:text-white"
                )}
              >
                <IconSettings size={16} stroke={iconStroke} />
              </button>

              {tableSettings.showGearMenu && (
                <div className="absolute right-0 top-11 w-60 p-3 bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl border border-slate-200 dark:border-neutral-700 text-xs z-[100] animate-in fade-in duration-100">
                  <div className="font-bold text-slate-900 dark:text-white pb-2 mb-2 border-b border-slate-100 dark:border-neutral-800">
                    Columns
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {[
                      { key: "phone", label: t("customers.phone", "Phone") },
                      { key: "email", label: t("customers.email", "Email") },
                      { key: "group", label: t("customer_groups.customer_group", "Customer Group") },
                      { key: "created", label: t("customers.created_at", "Created Date") },
                      ...(isConsolidated
                        ? [{ key: "business", label: t("business_switcher.business", "Business") }]
                        : []),
                    ].map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      >
                        <input
                          type="checkbox"
                          checked={tableSettings.visibleColumns[col.key]}
                          onChange={(e) =>
                            setTableSettings((p) => ({
                              ...p,
                              visibleColumns: {
                                ...p.visibleColumns,
                                [col.key]: e.target.checked,
                              },
                            }))
                          }
                          className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>{col.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="font-bold text-slate-900 dark:text-white pb-1 mb-2 border-b border-slate-100 dark:border-neutral-800">
                    Display
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300 mb-3">
                    <input
                      type="checkbox"
                      checked={tableSettings.compactDensity}
                      onChange={(e) =>
                        setTableSettings((p) => ({
                          ...p,
                          compactDensity: e.target.checked,
                        }))
                      }
                      className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Compact rows</span>
                  </label>

                  <div className="font-bold text-slate-900 dark:text-white pb-1 mb-1 border-b border-slate-100 dark:border-neutral-800">
                    Rows per page
                  </div>
                  <select
                    value={tableSettings.pageSize}
                    onChange={(e) =>
                      setTableSettings((p) => ({
                        ...p,
                        pageSize: Number(e.target.value),
                        spage: 1,
                      }))
                    }
                    className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Inline Compact Pagination */}
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-neutral-400 pl-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={btnPaginationPreviousPage}
              className={clsx(
                "flex items-center gap-0.5 hover:text-slate-900 dark:hover:text-white transition",
                currentPage <= 1 &&
                  "opacity-40 cursor-not-allowed hover:text-slate-600"
              )}
            >
              <IconChevronLeft size={14} stroke={iconStroke} />
              <span>{t("customers.previous", "Previous")}</span>
            </button>

            <span className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
              {totalCustomerCount > 0
                ? `${startIndex + 1} - ${endIndex}`
                : "0 - 0"}
              <span className="text-slate-400 font-normal">
                {" "}
                of {totalCustomerCount}
              </span>
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={btnPaginationNextPage}
              className={clsx(
                "flex items-center gap-0.5 hover:text-slate-900 dark:hover:text-white transition",
                currentPage >= totalPages &&
                  "opacity-40 cursor-not-allowed hover:text-slate-600"
              )}
            >
              <span>{t("customers.next", "Next")}</span>
              <IconChevronRight size={14} stroke={iconStroke} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Compact Data Table (Flat, full-bleed container) ── */}
      <div className="w-full overflow-x-auto border-t border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b]">
        <table className="w-full text-left border-collapse">
          {/* Header Row */}
          <thead>
            <tr className="border-b border-slate-200 dark:border-neutral-800 text-[13px] font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-[#18181b]">
              {/* Checkbox column */}
              <th className="w-10 px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={isAllCurrentPageSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all customers"
                  className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </th>

              {/* Name Column */}
              <th
                onClick={() => handleSort("name")}
                className="px-3 py-2.5 cursor-pointer select-none hover:text-emerald-700 transition"
              >
                <div className="flex items-center gap-1">
                  <span>{t("customers.name") || "Name"}</span>
                  {sorting.field === "name" && (
                    <span className="text-xs">
                      {sorting.direction === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </div>
              </th>

              {/* Phone Column */}
              {visibleColumns.phone && (
                <th
                  onClick={() => handleSort("phone")}
                  className="px-3 py-2.5 cursor-pointer select-none hover:text-emerald-700 transition"
                >
                  <div className="flex items-center gap-1">
                    <span>{t("customers.phone") || "Phone"}</span>
                    {sorting.field === "phone" && (
                      <span className="text-xs">
                        {sorting.direction === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
              )}

              {/* Email Column */}
              {visibleColumns.email && (
                <th
                  onClick={() => handleSort("email")}
                  className="px-3 py-2.5 cursor-pointer select-none hover:text-emerald-700 transition"
                >
                  <div className="flex items-center gap-1">
                    <span>{t("customers.email") || "Email"}</span>
                    {sorting.field === "email" && (
                      <span className="text-xs">
                        {sorting.direction === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
              )}

              {/* Customer Group Column */}
              {visibleColumns.group && (
                <th className="px-3 py-2.5">
                  <span>{t("customer_groups.customer_group", "Customer Group")}</span>
                </th>
              )}

              {/* Consolidated Business Column */}
              {isConsolidated && visibleColumns.business && (
                <th className="px-3 py-2.5">
                  <span>{t("business_switcher.business", "Business")}</span>
                </th>
              )}

              {/* Created Date Column */}
              {visibleColumns.created && (
                <th
                  onClick={() => handleSort("created_at")}
                  className="px-3 py-2.5 cursor-pointer select-none hover:text-emerald-700 transition"
                >
                  <div className="flex items-center gap-1">
                    <span>{t("customers.created_at") || "Created"}</span>
                    {sorting.field === "created_at" && (
                      <span className="text-xs">
                        {sorting.direction === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
              )}

              {/* Action Column */}
              <th className="px-3 py-2.5 text-right">
                <span>{t("customers.actions") || "Action"}</span>
              </th>
            </tr>
          </thead>

          {/* Table Data Rows */}
          <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80">
            {isLoading ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-14 text-center text-slate-400 dark:text-neutral-500 text-xs sm:text-sm"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="loading loading-spinner loading-md"></span>
                    <span>{t("customers.please_wait", "Please wait...")}</span>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-14 text-center text-rose-500 text-xs sm:text-sm font-medium"
                >
                  {t("customers.error_loading_details", "Error loading customers")}
                </td>
              </tr>
            ) : sortedCustomers.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-14 text-center text-slate-400 dark:text-neutral-500 text-xs sm:text-sm"
                >
                  {state.search
                    ? t("invoices.no_result_found", "No results found")
                    : t("customers.no_customers_found", "No customers found.")}
                </td>
              </tr>
            ) : (
              sortedCustomers.map((customer, index) => {
                const {
                  phone,
                  name,
                  email,
                  created_at,
                  businesses,
                } = customer;
                const isSelected = selectedCustomers.has(phone);

                return (
                  <tr
                    key={phone || index}
                    onClick={() => toggleSelectRow(phone)}
                    className={clsx(
                      "hover:bg-slate-50/70 dark:hover:bg-neutral-800/40 transition cursor-pointer select-none text-xs sm:text-[13px]",
                      isSelected && "bg-emerald-50/40 dark:bg-emerald-950/20"
                    )}
                  >
                    {/* Checkbox Cell */}
                    <td
                      className={clsx(
                        "w-10 px-3 text-center",
                        compactDensity ? "py-1.5" : "py-2.5"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(phone)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>

                    {/* Name Cell */}
                    <td
                      className={clsx(
                        "px-3 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap",
                        compactDensity ? "py-1.5" : "py-2.5"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span>{name}</span>
                        {customer.membership_tier && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/60">
                            {customer.membership_tier}
                          </span>
                        )}
                        {Number(customer.points_balance || 0) > 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/60">
                            {customer.points_balance} pts
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Phone Cell */}
                    {visibleColumns.phone && (
                      <td
                        className={clsx(
                          "px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap font-normal",
                          compactDensity ? "py-1.5" : "py-2.5"
                        )}
                      >
                        <span>{phone}</span>
                      </td>
                    )}

                    {/* Email Cell */}
                    {visibleColumns.email && (
                      <td
                        className={clsx(
                          "px-3 text-slate-600 dark:text-slate-400 truncate max-w-[220px]",
                          compactDensity ? "py-1.5" : "py-2.5"
                        )}
                      >
                        <span>{email || "-"}</span>
                      </td>
                    )}

                    {/* Customer Group Cell */}
                    {visibleColumns.group && (
                      <td
                        className={clsx(
                          "px-3 whitespace-nowrap",
                          compactDensity ? "py-1.5" : "py-2.5"
                        )}
                      >
                        {customer.customer_group_name ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-white text-[11px] font-bold shadow-xs"
                            style={{ backgroundColor: customer.customer_group_color || "#6366f1" }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
                            {customer.customer_group_name}
                            {customer.group_discount_value > 0 && (
                              <span className="bg-black/20 px-1 py-0.2 rounded text-[10px]">
                                {customer.group_discount_type === "PERCENTAGE" ? `${customer.group_discount_value}%` : `$${customer.group_discount_value}`} Off
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">—</span>
                        )}
                      </td>
                    )}

                    {/* Consolidated Business Cell */}
                    {isConsolidated && visibleColumns.business && (
                      <td
                        className={clsx(
                          "px-3 text-slate-600 dark:text-slate-400 text-xs",
                          compactDensity ? "py-1.5" : "py-2.5"
                        )}
                      >
                        <div className="flex flex-wrap gap-1">
                          {(businesses || []).map((b) => (
                            <span
                              key={b}
                              className="rounded px-1.5 py-0.5 bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium"
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      </td>
                    )}

                    {/* Created Date Cell */}
                    {visibleColumns.created && (
                      <td
                        className={clsx(
                          "px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap",
                          compactDensity ? "py-1.5" : "py-2.5"
                        )}
                      >
                        <span>
                          {created_at
                            ? new Date(created_at).toLocaleDateString()
                            : "-"}
                        </span>
                      </td>
                    )}

                    {/* Action Cell */}
                    <td
                      className={clsx(
                        "px-3 text-right whitespace-nowrap",
                        compactDensity ? "py-1.5" : "py-2.5"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isConsolidated ? (
                        <span className="text-xs text-slate-400">
                          {t(
                            "business_switcher.select_business_to_manage",
                            "Select business"
                          )}
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`${phone}/insights`)}
                            title={t("customers.insights", "View Insights")}
                            className="w-8 h-8 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-slate-100 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95"
                          >
                            <IconChartBar size={16} stroke={iconStroke} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              btnShowUpdate(
                                phone,
                                name,
                                email,
                                customer.birth_date,
                                customer.gender,
                                customer.customer_group_id
                              )
                            }
                            title={t("customers.edit", "Edit Customer")}
                            className="w-8 h-8 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-slate-100 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95"
                          >
                            <IconPencil size={16} stroke={iconStroke} />
                          </button>
                          {isManageAllowed && (
                            <button
                              type="button"
                              onClick={() => setDeleteCustomerPhone(phone)}
                              title={t("customers.delete", "Delete Customer")}
                              className="w-8 h-8 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition active:scale-95"
                            >
                              <IconTrash size={16} stroke={iconStroke} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Bottom Pagination Bar (table-design-system Standard) ── */}
      <div className="flex items-center justify-between py-3 px-1 text-xs text-slate-600 dark:text-neutral-400">
        <div className="text-slate-500">
          {t("customers.showing", "Showing")} {totalCustomerCount > 0 ? startIndex + 1 : 0}{" "}
          {t("customers.to", "to")} {endIndex} {t("customers.of", "of")}{" "}
          {totalCustomerCount} {t("customers.entries", "entries")}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={btnPaginationPreviousPage}
            className={clsx(
              "flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition",
              currentPage <= 1 && "opacity-40 cursor-not-allowed hover:text-slate-600"
            )}
          >
            <IconChevronLeft size={14} stroke={iconStroke} />
            <span>{t("customers.previous", "Previous")}</span>
          </button>

          <span className="tabular-nums font-medium text-slate-800 dark:text-slate-200">
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={btnPaginationNextPage}
            className={clsx(
              "flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition",
              currentPage >= totalPages && "opacity-40 cursor-not-allowed hover:text-slate-600"
            )}
          >
            <span>{t("customers.next", "Next")}</span>
            <IconChevronRight size={14} stroke={iconStroke} />
          </button>
        </div>
      </div>
      </>
      )}

      {/* ── Dialogs ── */}
      <DialogAddCustomer APIURL={APIURL} />

      {/* Update Customer Dialog */}
      <dialog
        id="modal-update-customer"
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="modal-box bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-2xl p-6">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">
            {t("customers.update_customer")}
          </h3>

          <div className="mt-4">
            <label
              htmlFor="phone"
              className="mb-1 block text-slate-500 dark:text-slate-400 text-xs font-medium"
            >
              {t("customers.phone")}{" "}
              <span className="text-slate-400">
                - ({t("customers.required")})
              </span>
            </label>
            <input
              ref={phoneRef}
              type="tel"
              name="phone"
              disabled
              className="text-xs sm:text-sm w-full rounded-lg px-3.5 py-2 border border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-900 text-slate-500 dark:text-slate-400 cursor-not-allowed"
              placeholder={t("customers.phone")}
            />
          </div>

          <div className="mt-4">
            <label
              htmlFor="name"
              className="mb-1 block text-slate-500 dark:text-slate-400 text-xs font-medium"
            >
              {t("customers.name")}{" "}
              <span className="text-slate-400">
                - ({t("customers.required")})
              </span>
            </label>
            <input
              ref={nameRef}
              type="text"
              name="name"
              className="text-xs sm:text-sm w-full rounded-lg px-3.5 py-2 border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              placeholder={t("customers.name")}
            />
          </div>

          <div className="mt-4">
            <label
              htmlFor="email"
              className="mb-1 block text-slate-500 dark:text-slate-400 text-xs font-medium"
            >
              {t("customers.email")}
            </label>
            <input
              ref={emailRef}
              type="email"
              name="email"
              className="text-xs sm:text-sm w-full rounded-lg px-3.5 py-2 border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              placeholder={t("customers.email")}
            />
          </div>

          <div className="mt-4">
            <label
              htmlFor="edit_customer_group"
              className="mb-1 block text-slate-500 dark:text-slate-400 text-xs font-medium"
            >
              {t("customer_groups.customer_group")}
            </label>
            <select
              value={editCustomerGroupId}
              onChange={(e) => setEditCustomerGroupId(e.target.value)}
              className="text-xs sm:text-sm w-full rounded-lg px-3.5 py-2 border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="">{t("customer_groups.no_group")}</option>
              {customerGroups.map((grp) => (
                <option key={grp.id} value={grp.id}>
                  {grp.name} {grp.is_default ? `(${t("common.default", "Default")})` : ""} {grp.discount_value > 0 ? `• ${grp.discount_type === "PERCENTAGE" ? `${grp.discount_value}%` : `$${grp.discount_value}`} Off` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-4 w-full my-4">
            <div className="flex-1">
              <label
                htmlFor="birthdate"
                className="mb-1 block text-slate-500 dark:text-slate-400 text-xs font-medium"
              >
                {t("customers.birth_date")}
              </label>
              <input
                ref={birthDateRef}
                type="date"
                name="birthdate"
                max={new Date().toISOString().substring(0, 10)}
                className="text-xs sm:text-sm w-full rounded-lg px-3.5 py-2 border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor="type"
                className="mb-1 block text-slate-500 dark:text-slate-400 text-xs font-medium"
              >
                {t("customers.gender")}
              </label>
              <select
                ref={genderRef}
                name="type"
                className="text-xs sm:text-sm w-full rounded-lg px-3.5 py-2 border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="">{t("customers.gender")}</option>
                <option value="female">{t("customers.female")}</option>
                <option value="male">{t("customers.male")}</option>
                <option value="other">{t("customers.other")}</option>
              </select>
            </div>
          </div>

          <div className="modal-action mt-6 flex items-center justify-end gap-2">
            <form method="dialog" className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  document.getElementById("modal-update-customer")?.close()
                }
                className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 text-xs sm:text-sm font-medium transition active:scale-95"
              >
                {t("customers.close")}
              </button>
              <button
                type="button"
                onClick={btnUpdate}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-[#107c41] hover:bg-[#0c6634] text-white text-xs sm:text-sm font-semibold transition active:scale-95 shadow-xs"
              >
                {t("customers.save")}
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={Boolean(deleteCustomerPhone)}
        onClose={() => setDeleteCustomerPhone(null)}
        onConfirm={async () => {
          const id = deleteCustomerPhone;
          setDeleteCustomerPhone(null);
          await btnDelete(id);
        }}
        title={t("customers.delete_customer", "Delete Customer")}
        description={t("customers.are_you_sure")}
      />
    </Page>
  );
}
