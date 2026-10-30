import React, { useRef, useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Page from "../components/Page";
import DeleteModal from "../components/DeleteModal";
import {
  IconCalendarPlus,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
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
  IconUsers,
  IconX,
  IconMail,
  IconCheck,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import DialogAddCustomer from "../components/DialogAddCustomer";
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
import { useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";

export default function CustomersPage() {
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

  // Table options (QuickBooks gear icon settings)
  const [tableSettings, setTableSettings] = useState({
    compactDensity: false,
    pageSize: 10,
    showGearMenu: false,
    visibleColumns: {
      phone: true,
      email: true,
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

  if (isLoading) {
    return (
      <Page>
        <div className="flex items-center justify-center p-20 text-slate-400 gap-3">
          <span className="loading loading-spinner loading-md"></span>
          <span className="text-sm font-medium">
            {t("customers.please_wait")}
          </span>
        </div>
      </Page>
    );
  }

  if (error) {
    console.error(error);
    return (
      <Page>
        <div className="p-8 text-center text-rose-500 text-sm font-medium">
          {t("customers.error_loading_details")}
        </div>
      </Page>
    );
  }

  const {
    customers = [],
    currentPage = 1,
    totalPages = 1,
    totalCustomers = 0,
  } = data || {};

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
    const searchQuery = searchRef.current?.value || "";
    setState((prev) => ({
      ...prev,
      search: searchQuery.trim(),
      spage: 1,
    }));
  };

  const btnClearSearch = () => {
    if (searchRef.current) {
      searchRef.current.value = "";
    }
    setState((prev) => ({
      ...prev,
      search: "",
      spage: 1,
    }));
  };

  // Update Customer Handlers
  const btnShowUpdate = (phone, name, email, birthDate, gender) => {
    if (phoneRef.current) phoneRef.current.value = phone;
    if (nameRef.current) nameRef.current.value = name;
    if (emailRef.current) emailRef.current.value = email || "";

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
      const res = await updateCustomer(phone, name, email, birthDate, gender);

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
  const startIndex = (currentPage - 1) * tableSettings.pageSize;
  const endIndex = Math.min(
    startIndex + tableSettings.pageSize,
    totalCustomers || customers.length
  );

  return (
    <Page>
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400 font-normal mb-1">
        <span>Customers & CRM</span>
        <span className="text-slate-300 dark:text-neutral-600">/</span>
        <span className="text-slate-700 dark:text-neutral-300 font-medium">
          {t("customers.title") || "Customers"}
        </span>
      </div>

      {/* ── QuickBooks Header & Primary Action ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
            {t("customers.title") || "Customers"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
            {t(
              "customers.subtitle",
              "Manage customer accounts, contact details and insights"
            )}
          </p>
        </div>

        {/* Top Right Header Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Actions Dropdown */}
          <div className="relative" ref={actionsBtnRef}>
            <button
              type="button"
              onClick={() => setShowActionsDropdown((p) => !p)}
              className="min-h-[42px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#18181b] hover:bg-slate-50 dark:hover:bg-[#202020] text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium flex items-center gap-1.5 active:scale-95 transition"
            >
              <span>{t("customers.actions") || "Actions"}</span>
              <IconChevronDown size={14} stroke={iconStroke} />
            </button>

            {showActionsDropdown && (
              <ul className="absolute right-0 top-12 z-[100] p-1.5 shadow-xl bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-neutral-700 rounded-xl w-48 text-xs font-medium space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setShowActionsDropdown(false);
                      btnDownloadCustomerDataVisible();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition active:scale-95"
                  >
                    <IconDownload size={15} stroke={iconStroke} />
                    <span>{t("customers.download_visible")}</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setShowActionsDropdown(false);
                      btnDownloadCustomerAllData();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition active:scale-95"
                  >
                    <IconFileSpreadsheet
                      size={15}
                      stroke={iconStroke}
                      className="text-emerald-600"
                    />
                    <span>{t("customers.download_all")}</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setShowActionsDropdown(false);
                      navigate("import");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition active:scale-95"
                  >
                    <IconTableImport size={15} stroke={iconStroke} />
                    <span>{t("customers.import")}</span>
                  </button>
                </li>
              </ul>
            )}
          </div>

          {/* QuickBooks Signature Green New Customer Button */}
          {isManageAllowed && (
            <button
              type="button"
              onClick={() =>
                document.getElementById("modal-add-customer")?.showModal()
              }
              className="min-h-[42px] px-4 py-2 rounded-lg bg-[#107c41] hover:bg-[#0c6634] text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 active:scale-95 transition shadow-xs"
            >
              <IconPlus size={16} stroke={iconStroke} />
              <span>{t("customers.new") || "New customer"}</span>
            </button>
          )}
        </div>
      </div>

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

      {/* ── Filter & Action Bar Directly Above Table (QuickBooks Style) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        {/* Left Side: Filter input */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <IconSearch size={16} stroke={iconStroke} />
            </div>
            <input
              ref={searchRef}
              defaultValue={state.search}
              type="text"
              placeholder={
                t("customers.search_placeholder") || "Filter by name or phone..."
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  btnSearch();
                }
              }}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  btnClearSearch();
                }
              }}
              className="w-full min-h-[38px] pl-9 pr-8 py-1.5 text-xs sm:text-[13px] rounded-md border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#18181b] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition"
            />
            {state.search && (
              <button
                type="button"
                onClick={btnClearSearch}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <IconX size={14} stroke={iconStroke} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={btnSearch}
            className="min-h-[38px] px-3.5 py-1.5 rounded-md border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#18181b] hover:bg-slate-50 dark:hover:bg-[#202020] text-slate-700 dark:text-slate-200 text-xs sm:text-[13px] font-medium transition active:scale-95"
          >
            {t("customers.search") || "Search"}
          </button>
        </div>

        {/* Right Side: Print, Export, Gear, and Pagination */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* Action Icons */}
          <div className="flex items-center gap-1 border-r border-slate-200 dark:border-neutral-700 pr-3">
            {/* Print Table */}
            <button
              type="button"
              onClick={handlePrintTable}
              title="Print table"
              className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition active:scale-95"
            >
              <IconPrinter size={16} stroke={iconStroke} />
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={btnDownloadCustomerDataVisible}
              title="Export table data"
              className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition active:scale-95"
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
                  "w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition active:scale-95",
                  tableSettings.showGearMenu &&
                    "bg-slate-200 dark:bg-neutral-800 text-slate-900"
                )}
              >
                <IconSettings size={16} stroke={iconStroke} />
              </button>

              {tableSettings.showGearMenu && (
                <div className="absolute right-0 top-9 w-60 p-3 bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl border border-slate-200 dark:border-neutral-700 text-xs z-[100] animate-in fade-in duration-100">
                  <div className="font-bold text-slate-900 dark:text-white pb-2 mb-2 border-b border-slate-100 dark:border-neutral-800">
                    Columns
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {[
                      { key: "phone", label: "Phone (Account type)" },
                      { key: "email", label: "Email (Detail type)" },
                      { key: "created", label: "Created Date" },
                      ...(isConsolidated
                        ? [{ key: "business", label: "Business" }]
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

          {/* Pagination Text: < Previous  1 - 10 of 42  Next > */}
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-neutral-400">
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
              <span>Previous</span>
            </button>

            <span className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
              {totalCustomers > 0
                ? `${startIndex + 1} - ${endIndex}`
                : "0 - 0"}
              <span className="text-slate-400 font-normal">
                {" "}
                of {totalCustomers || customers.length}
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
              <span>Next</span>
              <IconChevronRight size={14} stroke={iconStroke} />
            </button>
          </div>
        </div>
      </div>

      {/* ── QuickBooks Data Table Container (Matching Image 2 Reference) ── */}
      <div className="w-full overflow-x-auto border border-slate-200 dark:border-neutral-800 rounded-md bg-white dark:bg-[#18181b]">
        <table className="w-full text-left border-collapse">
          {/* Header Row */}
          <thead>
            <tr className="border-b border-slate-300 dark:border-neutral-700 text-[13px] font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-[#18181b]">
              {/* Checkbox column */}
              <th className="w-10 px-3 py-3 text-center border-r border-slate-200 dark:border-neutral-800">
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
                className="px-3 py-3 border-r border-slate-200 dark:border-neutral-800 cursor-pointer select-none hover:text-emerald-700 transition"
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

              {/* Account type ↑ Column (with BAL badge indicator) */}
              {visibleColumns.phone && (
                <th
                  onClick={() => handleSort("phone")}
                  className="px-3 py-3 border-r border-slate-200 dark:border-neutral-800 cursor-pointer select-none hover:text-emerald-700 transition"
                >
                  <div className="flex items-center gap-1">
                    <span>Account type</span>
                    <span className="text-xs">
                      {sorting.field === "phone"
                        ? sorting.direction === "asc"
                          ? "↑"
                          : "↓"
                        : "↑"}
                    </span>
                  </div>
                </th>
              )}

              {/* Detail type Column */}
              {visibleColumns.email && (
                <th
                  onClick={() => handleSort("email")}
                  className="px-3 py-3 border-r border-slate-200 dark:border-neutral-800 cursor-pointer select-none hover:text-emerald-700 transition"
                >
                  <div className="flex items-center gap-1">
                    <span>Detail type</span>
                    {sorting.field === "email" && (
                      <span className="text-xs">
                        {sorting.direction === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
              )}

              {/* Consolidated Business Column */}
              {isConsolidated && visibleColumns.business && (
                <th className="px-3 py-3 border-r border-slate-200 dark:border-neutral-800">
                  <span>{t("business_switcher.business", "Business")}</span>
                </th>
              )}

              {/* Created Date Column */}
              {visibleColumns.created && (
                <th
                  onClick={() => handleSort("created_at")}
                  className="px-3 py-3 border-r border-slate-200 dark:border-neutral-800 cursor-pointer select-none hover:text-emerald-700 transition"
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
              <th className="px-4 py-3 text-right">
                <span>{t("customers.actions") || "Action"}</span>
              </th>
            </tr>
          </thead>

          {/* QuickBooks Data Rows */}
          <tbody>
            {sortedCustomers.length === 0 ? (
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
                  is_member,
                } = customer;
                const isSelected = selectedCustomers.has(phone);

                return (
                  <tr
                    key={phone || index}
                    onClick={() => toggleSelectRow(phone)}
                    className={clsx(
                      "transition-colors cursor-pointer select-none border-b border-slate-200 dark:border-neutral-800",
                      compactDensity ? "text-xs" : "text-[13px]",
                      isSelected
                        ? "bg-[#e8f4fd] dark:bg-emerald-950/20"
                        : "hover:bg-[#f8f9fa] dark:hover:bg-[#202020]"
                    )}
                  >
                    {/* Checkbox Cell */}
                    <td
                      className={clsx(
                        "w-10 px-3 text-center border-r border-slate-200 dark:border-neutral-800",
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
                        "px-3 border-r border-slate-200 dark:border-neutral-800 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap",
                        compactDensity ? "py-1.5" : "py-2.5"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span>{name}</span>
                        {customer.membership_tier && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-amber-500/15 text-amber-700 dark:text-amber-300">
                            {customer.membership_tier}
                          </span>
                        )}
                        {Number(customer.points_balance || 0) > 0 && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold font-mono bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                            {customer.points_balance} pts
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Account Type (Phone) Cell with BAL badge */}
                    {visibleColumns.phone && (
                      <td
                        className={clsx(
                          "px-3 border-r border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-slate-300 whitespace-nowrap",
                          compactDensity ? "py-1.5" : "py-2.5"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-normal">{phone}</span>
                          <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#d1fae5] text-[#008927] dark:bg-emerald-950/60 dark:text-emerald-400 select-none tracking-wide uppercase">
                            BAL
                          </span>
                        </div>
                      </td>
                    )}

                    {/* Detail Type (Email) Cell */}
                    {visibleColumns.email && (
                      <td
                        className={clsx(
                          "px-3 border-r border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-slate-400 truncate max-w-[220px]",
                          compactDensity ? "py-1.5" : "py-2.5"
                        )}
                      >
                        <span>{email || "Customer Account"}</span>
                      </td>
                    )}

                    {/* Consolidated Business Cell */}
                    {isConsolidated && visibleColumns.business && (
                      <td
                        className={clsx(
                          "px-3 border-r border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-slate-400 text-xs",
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
                          "px-3 border-r border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-slate-400 whitespace-nowrap",
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

                    {/* Action Cell (QuickBooks Clean Toolbar) */}
                    <td
                      className={clsx(
                        "px-4 text-right whitespace-nowrap",
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
                            title="View Insights"
                            className="p-1.5 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-slate-100 dark:hover:bg-neutral-800 dark:text-slate-400 dark:hover:text-emerald-400 transition active:scale-95"
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
                                customer.gender
                              )
                            }
                            title="Edit Customer"
                            className="p-1.5 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-slate-100 dark:hover:bg-neutral-800 dark:text-slate-400 dark:hover:text-emerald-400 transition active:scale-95"
                          >
                            <IconPencil size={16} stroke={iconStroke} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteCustomerPhone(phone)}
                            title="Delete Customer"
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition active:scale-95"
                          >
                            <IconTrash size={16} stroke={iconStroke} />
                          </button>
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
