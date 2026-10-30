import React, { useState, useRef, useMemo, useEffect } from "react";
import Page from "../components/Page";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import {
  useSuppliers,
  addSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierDetails,
} from "../controllers/supplier.controller";
import {
  IconTruck,
  IconPlus,
  IconSearch,
  IconPhone,
  IconBrandTelegram,
  IconMail,
  IconMapPin,
  IconBuildingBank,
  IconReceipt2,
  IconPencil,
  IconTrash,
  IconDownload,
  IconX,
  IconDotsVertical,
  IconHistory,
  IconCheck,
  IconAlertCircle,
  IconPrinter,
  IconSettings,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import toast from "react-hot-toast";
import clsx from "clsx";
import moment from "moment";
import { Link } from "react-router-dom";

export default function SuppliersPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, error, isLoading, mutate } = useSuppliers({
    page,
    perPage,
    search,
  });

  const suppliers = data?.vendors || [];
  const pagination = data?.pagination || {
    page: 1,
    perPage: 10,
    total: 0,
    totalPages: 1,
  };
  const totalVendors = pagination.total || suppliers.length;
  const totalPages = pagination.totalPages || 1;

  // Table options (QuickBooks-style settings)
  const [tableSettings, setTableSettings] = useState({
    compactDensity: false,
    showGearMenu: false,
    visibleColumns: {
      contact: true,
      location: true,
      payment: true,
      orders: true,
    },
  });

  const [selectedSuppliers, setSelectedSuppliers] = useState(new Set());
  const settingsBtnRef = useRef(null);

  // Close gear menu when clicking outside
  useEffect(() => {
    if (!tableSettings.showGearMenu) return;
    const handleClickOutside = (e) => {
      if (settingsBtnRef.current && !settingsBtnRef.current.contains(e.target)) {
        setTableSettings((prev) => ({ ...prev, showGearMenu: false }));
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [tableSettings.showGearMenu]);

  const isAllCurrentPageSelected =
    suppliers.length > 0 &&
    suppliers.every((s) => selectedSuppliers.has(s.id));

  const toggleSelectAll = () => {
    const next = new Set(selectedSuppliers);
    if (isAllCurrentPageSelected) {
      suppliers.forEach((s) => next.delete(s.id));
    } else {
      suppliers.forEach((s) => next.add(s.id));
    }
    setSelectedSuppliers(next);
  };

  const toggleSelectRow = (id) => {
    const next = new Set(selectedSuppliers);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedSuppliers(next);
  };

  const handlePrintTable = () => {
    window.print();
  };

  const handleExportToExcel = async () => {
    try {
      toast.loading("Preparing export...");
      const XLSX = await import("xlsx");
      const exportList =
        selectedSuppliers.size > 0
          ? suppliers.filter((s) => selectedSuppliers.has(s.id))
          : suppliers;

      const exportData = exportList.map((s) => ({
        ID: s.id,
        Name: s.name,
        Contact: s.contact_person,
        Phone: s.phone,
        Email: s.email,
        Telegram: s.telegram,
        Address: [s.address_line1, s.city].filter(Boolean).join(", "),
        "Tax ID": s.tax_id_no,
        "Payment Terms": s.payment_terms,
        "Total Orders": s.total_orders || 0,
        "Total Spend": s.total_spend || 0,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Suppliers");
      XLSX.writeFile(
        workbook,
        `Suppliers_Export_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      toast.dismiss();
      toast.success("Suppliers exported successfully!");
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error("Failed to export suppliers");
    }
  };

  // Modal / Drawer state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields state
  const [formData, setFormData] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    telegram: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "Cambodia",
    zipcode: "",
    taxIdNo: "",
    paymentTerms: "Cash on Delivery",
    bankDetails: "",
    notes: "",
  });

  const handleOpenAddModal = () => {
    setEditingSupplier(null);
    setFormData({
      name: "",
      contactPerson: "",
      phone: "",
      email: "",
      telegram: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      country: "Cambodia",
      zipcode: "",
      taxIdNo: "",
      paymentTerms: "Cash on Delivery",
      bankDetails: "",
      notes: "",
    });
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name || "",
      contactPerson: supplier.contact_person || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      telegram: supplier.telegram || "",
      addressLine1: supplier.address_line1 || "",
      addressLine2: supplier.address_line2 || "",
      city: supplier.city || "",
      state: supplier.state || "",
      country: supplier.country || "Cambodia",
      zipcode: supplier.zipcode || "",
      taxIdNo: supplier.tax_id_no || "",
      paymentTerms: supplier.payment_terms || "Cash on Delivery",
      bankDetails: supplier.bank_details || "",
      notes: supplier.notes || "",
    });
    setIsFormModalOpen(true);
  };

  const handleOpenDetails = async (supplier) => {
    try {
      const details = await getSupplierDetails(supplier.id);
      setSelectedSupplierDetail(details || supplier);
      setIsDetailDrawerOpen(true);
    } catch (err) {
      console.error(err);
      setSelectedSupplierDetail(supplier);
      setIsDetailDrawerOpen(true);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error(t("suppliers.name_required", "Supplier name is required."));
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, formData);
        toast.success(t("suppliers.updated_success", "Supplier updated successfully."));
      } else {
        await addSupplier(formData);
        toast.success(t("suppliers.added_success", "Supplier added successfully."));
      }
      setIsFormModalOpen(false);
      mutate();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || t("suppliers.error_generic", "An error occurred.");
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsSubmitting(true);
      await deleteSupplier(deleteTarget.id);
      toast.success(t("suppliers.deleted_success", "Supplier deleted successfully."));
      setDeleteTarget(null);
      mutate();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || t("suppliers.delete_failed", "Failed to delete supplier.");
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const list = data?.vendors || [];
    if (list.length === 0) {
      toast.error(t("suppliers.no_data_export", "No suppliers to export."));
      return;
    }

    const headers = [
      "ID",
      "Supplier Name",
      "Contact Person",
      "Phone",
      "Email",
      "Telegram",
      "City",
      "Payment Terms",
      "Bank Details",
      "Tax ID",
      "Total Orders",
      "Total Spend",
    ];

    const rows = list.map((s) => [
      s.id,
      `"${(s.name || "").replace(/"/g, '""')}"`,
      `"${(s.contact_person || "").replace(/"/g, '""')}"`,
      `"${s.phone || ""}"`,
      `"${s.email || ""}"`,
      `"${s.telegram || ""}"`,
      `"${(s.city || "").replace(/"/g, '""')}"`,
      `"${(s.payment_terms || "").replace(/"/g, '""')}"`,
      `"${(s.bank_details || "").replace(/"/g, '""')}"`,
      `"${s.tax_id_no || ""}"`,
      s.total_orders || 0,
      s.total_spend || 0,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `suppliers_${moment().format("YYYYMMDD_HHmm")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Aggregate stats
  const stats = useMemo(() => {
    let spend = 0;
    let orders = 0;
    suppliers.forEach((s) => {
      spend += parseFloat(s.total_spend || 0);
      orders += parseInt(s.total_orders || 0, 10);
    });
    return { spend, orders };
  }, [suppliers]);

  return (
    <Page className="px-4 py-4 md:px-8 md:py-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-gray-100 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <IconTruck size={24} stroke={2} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                {t("navbar.vendors_directory", "Suppliers Directory")}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t(
                  "suppliers.subtitle",
                  "Manage restaurant ingredient vendors, payment terms, contact details & restock orders."
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            to="/dashboard/purchase-orders"
            className="min-h-[42px] px-4 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-200 font-medium text-sm flex items-center gap-2 transition active:scale-95"
          >
            <IconReceipt2 size={18} />
            <span>{t("navbar.purchase_orders", "Purchase Orders")}</span>
          </Link>

          <button
            onClick={handleExportCSV}
            className="min-h-[42px] px-3.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-200 font-medium text-sm flex items-center gap-2 transition active:scale-95"
            title={t("common.export_csv", "Export to CSV")}
          >
            <IconDownload size={18} />
            <span className="hidden sm:inline">{t("common.export", "Export")}</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="min-h-[42px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-medium text-sm flex items-center gap-2 shadow-sm transition"
          >
            <IconPlus size={18} stroke={2.5} />
            <span>{t("suppliers.btn_add", "Add Supplier")}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-4 my-6">
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <IconTruck size={22} />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("suppliers.stat_total", "Total Suppliers")}
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {totalVendors}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <IconCheck size={22} />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("suppliers.stat_active", "Active Accounts")}
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {totalVendors}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <IconReceipt2 size={22} />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("suppliers.stat_orders", "Restock Orders")}
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {stats.orders}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <IconBuildingBank size={22} />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("suppliers.stat_spend", "Fulfilled Spend")}
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              ${stats.spend.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Selection Action Banner (When rows are checked) ── */}
      {selectedSuppliers.size > 0 && (
        <div className="mb-3 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              {selectedSuppliers.size} supplier{selectedSuppliers.size > 1 ? "s" : ""} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportToExcel}
              className="px-3 py-1.5 rounded-md bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-semibold hover:bg-emerald-100 dark:hover:bg-neutral-700 transition active:scale-95"
            >
              Export Selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedSuppliers(new Set())}
              className="px-3 py-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium hover:bg-slate-200/60 dark:hover:bg-neutral-800 transition"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* ── Filter & Action Bar Directly Above Table (QuickBooks Style - Matching First Image) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        {/* Left Side: Filter by name or number */}
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          {/* Search Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput);
              setPage(1);
            }}
            className="relative flex-1 min-w-[200px]"
          >
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <IconSearch size={16} stroke={iconStroke} />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Filter by name or number"
              className="w-full min-h-[38px] pl-9 pr-8 py-1.5 text-xs sm:text-[13px] rounded-md border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#18181b] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setPage(1);
                }}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <IconX size={14} stroke={iconStroke} />
              </button>
            )}
          </form>
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

            {/* Export Excel */}
            <button
              type="button"
              onClick={handleExportToExcel}
              title="Export to Excel"
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
                  tableSettings.showGearMenu && "bg-slate-200 dark:bg-neutral-800 text-slate-900"
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
                      { key: "contact", label: "Direct Contact" },
                      { key: "location", label: "Location" },
                      { key: "payment", label: "Terms & Bank" },
                      { key: "orders", label: "Orders / Spend" },
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
                    value={perPage}
                    onChange={(e) => {
                      setPerPage(Number(e.target.value));
                      setPage(1);
                    }}
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
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className={clsx(
                "flex items-center gap-0.5 hover:text-slate-900 dark:hover:text-white transition",
                page <= 1 && "opacity-40 cursor-not-allowed hover:text-slate-600"
              )}
            >
              <IconChevronLeft size={14} stroke={iconStroke} />
              <span>Previous</span>
            </button>

            <span className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
              {totalVendors > 0
                ? `${(page - 1) * perPage + 1} - ${Math.min(
                    page * perPage,
                    totalVendors
                  )}`
                : "0 - 0"}
              <span className="text-slate-400 font-normal"> of {totalVendors}</span>
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              className={clsx(
                "flex items-center gap-0.5 hover:text-slate-900 dark:hover:text-white transition",
                page >= totalPages && "opacity-40 cursor-not-allowed hover:text-slate-600"
              )}
            >
              <span>Next</span>
              <IconChevronRight size={14} stroke={iconStroke} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Table Container (QuickBooks Style) ── */}
      <div>
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-400">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-600" />
            <span className="text-sm">{t("common.loading", "Loading suppliers...")}</span>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-red-500 text-sm">
            {t("suppliers.error_loading", "Failed to load suppliers.")}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="py-16 px-4 text-center flex flex-col items-center justify-center bg-white dark:bg-[#18181b] rounded-2xl border border-slate-200 dark:border-neutral-800">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-neutral-800 flex items-center justify-center text-gray-400 mb-3">
              <IconTruck size={32} />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
              {search
                ? t("suppliers.no_results", "No matching suppliers found")
                : t("suppliers.no_suppliers", "No suppliers registered yet")}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-4">
              {search
                ? t("suppliers.no_results_desc", "Try adjusting your search keywords.")
                : t(
                    "suppliers.no_suppliers_desc",
                    "Add your vegetable, meat, seafood, and beverage suppliers to track restocks."
                  )}
            </p>
            {!search && (
              <button
                onClick={handleOpenAddModal}
                className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center gap-2"
              >
                <IconPlus size={18} />
                <span>{t("suppliers.btn_add_first", "Add First Supplier")}</span>
              </button>
            )}
          </div>
        ) : (
          <div>
            <div className="w-full overflow-x-auto border-t border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-neutral-800 text-[13px] font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-[#18181b]">
                    <th className="w-10 px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isAllCurrentPageSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all suppliers"
                        className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-3">{t("suppliers.col_supplier", "Supplier")}</th>
                    {tableSettings.visibleColumns.contact && (
                      <th className="px-3 py-3">{t("suppliers.col_contact", "Direct Contact")}</th>
                    )}
                    {tableSettings.visibleColumns.location && (
                      <th className="px-3 py-3">{t("suppliers.col_location", "Location")}</th>
                    )}
                    {tableSettings.visibleColumns.payment && (
                      <th className="px-3 py-3">{t("suppliers.col_payment", "Terms & Bank")}</th>
                    )}
                    {tableSettings.visibleColumns.orders && (
                      <th className="px-3 py-3 text-center">{t("suppliers.col_orders", "Orders / Spend")}</th>
                    )}
                    <th className="px-4 py-3 text-right">{t("common.actions", "Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80">
                  {suppliers.map((supplier) => {
                    const telegramClean = (supplier.telegram || "")
                      .replace(/^@/, "")
                      .replace(/^https:\/\/t\.me\//, "");

                    const isSelected = selectedSuppliers.has(supplier.id);

                    return (
                      <tr
                        key={supplier.id}
                        className={clsx(
                          "hover:bg-slate-50/70 dark:hover:bg-neutral-800/40 transition group",
                          isSelected && "bg-emerald-50/40 dark:bg-emerald-950/20",
                          tableSettings.compactDensity ? "text-xs" : "text-xs sm:text-[13px]"
                        )}
                      >
                        {/* Checkbox */}
                        <td className="w-10 px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(supplier.id)}
                            className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>

                        {/* Supplier Name & Contact Person */}
                        <td className={clsx("px-3", tableSettings.compactDensity ? "py-2" : "py-3")}>
                          <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span>{supplier.name}</span>
                            {supplier.tax_id_no && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-400 font-mono border border-slate-200 dark:border-neutral-700">
                                VAT: {supplier.tax_id_no}
                              </span>
                            )}
                          </div>
                          {supplier.contact_person && (
                            <div className="text-xs text-slate-400 dark:text-neutral-500 mt-0.5">
                              {supplier.contact_person}
                            </div>
                          )}
                        </td>

                        {/* Contact */}
                        {tableSettings.visibleColumns.contact && (
                          <td className={clsx("px-3", tableSettings.compactDensity ? "py-2" : "py-3")}>
                            <div className="flex flex-col gap-1">
                              {supplier.phone ? (
                                <a
                                  href={`tel:${supplier.phone}`}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                                >
                                  <IconPhone size={14} />
                                  <span>{supplier.phone}</span>
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )}

                              {telegramClean && (
                                <a
                                  href={`https://t.me/${telegramClean}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:underline"
                                >
                                  <IconBrandTelegram size={14} />
                                  <span>@{telegramClean}</span>
                                </a>
                              )}
                            </div>
                          </td>
                        )}

                        {/* Location */}
                        {tableSettings.visibleColumns.location && (
                          <td className={clsx("px-3", tableSettings.compactDensity ? "py-2" : "py-3")}>
                            <div className="text-xs text-slate-700 dark:text-slate-300">
                              {supplier.city || supplier.address_line1 ? (
                                <span className="inline-flex items-center gap-1">
                                  <IconMapPin size={13} className="text-slate-400 shrink-0" />
                                  <span>{[supplier.address_line1, supplier.city].filter(Boolean).join(", ")}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </div>
                          </td>
                        )}

                        {/* Terms & Bank */}
                        {tableSettings.visibleColumns.payment && (
                          <td className={clsx("px-3", tableSettings.compactDensity ? "py-2" : "py-3")}>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                                {supplier.payment_terms || "Cash on Delivery"}
                              </span>
                              {supplier.bank_details && (
                                <span className="text-[11px] text-slate-400 dark:text-neutral-500 truncate max-w-xs" title={supplier.bank_details}>
                                  {supplier.bank_details}
                                </span>
                              )}
                            </div>
                          </td>
                        )}

                        {/* Orders / Spend in Soft Badge */}
                        {tableSettings.visibleColumns.orders && (
                          <td className={clsx("px-3 text-center", tableSettings.compactDensity ? "py-2" : "py-3")}>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#dcfce7] text-[#15803d] dark:bg-emerald-950/70 dark:text-emerald-400 border border-[#bbf7d0] dark:border-emerald-800">
                              {supplier.total_orders || 0} POs (${parseFloat(supplier.total_spend || 0).toFixed(2)})
                            </span>
                          </td>
                        )}

                        {/* Actions */}
                        <td className={clsx("px-4 text-right whitespace-nowrap", tableSettings.compactDensity ? "py-2" : "py-3")}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenDetails(supplier)}
                              className="w-8 h-8 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-slate-100 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95"
                              title={t("suppliers.view_details", "View Restock History")}
                            >
                              <IconHistory size={16} />
                            </button>

                            <button
                              onClick={() => handleOpenEditModal(supplier)}
                              className="w-8 h-8 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95"
                              title={t("common.edit", "Edit")}
                            >
                              <IconPencil size={16} />
                            </button>

                            <button
                              onClick={() => setDeleteTarget(supplier)}
                              className="w-8 h-8 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition active:scale-95"
                              title={t("common.delete", "Delete")}
                            >
                              <IconTrash size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Bottom Pagination Bar ── */}
            <div className="flex items-center justify-between py-3 text-xs text-slate-600 dark:text-neutral-400">
              <div className="text-slate-500">
                Showing {totalVendors > 0 ? (page - 1) * perPage + 1 : 0} to{" "}
                {Math.min(page * perPage, totalVendors)} of {totalVendors} entries
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className={clsx(
                    "flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition",
                    page <= 1 && "opacity-40 cursor-not-allowed hover:text-slate-600"
                  )}
                >
                  <IconChevronLeft size={14} stroke={iconStroke} />
                  <span>Previous</span>
                </button>

                <span className="tabular-nums">
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className={clsx(
                    "flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition",
                    page >= totalPages && "opacity-40 cursor-not-allowed hover:text-slate-600"
                  )}
                >
                  <span>Next</span>
                  <IconChevronRight size={14} stroke={iconStroke} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Supplier Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 dark:border-neutral-800 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <IconTruck size={20} className="text-emerald-600" />
                <span>
                  {editingSupplier
                    ? t("suppliers.modal_edit_title", "Edit Supplier Profile")
                    : t("suppliers.modal_add_title", "New Supplier Registration")}
                </span>
              </h2>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition"
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {t("suppliers.form_name", "Supplier / Company Name")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., CP Cambodia, Lucky Farm, Eco Packaging"
                    className="w-full min-h-[42px] px-3.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {t("suppliers.form_contact_person", "Contact Person")}
                  </label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="e.g., Mr. Sokha"
                    className="w-full min-h-[42px] px-3.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {t("suppliers.form_phone", "Primary Phone")}
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="012 345 678"
                    className="w-full min-h-[42px] px-3.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {t("suppliers.form_telegram", "Telegram Username / Link")}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                    <input
                      type="text"
                      value={formData.telegram}
                      onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
                      placeholder="supplier_order_bot"
                      className="w-full min-h-[42px] pl-8 pr-3.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {t("suppliers.form_email", "Email Address")}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="orders@supplier.com"
                    className="w-full min-h-[42px] px-3.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {t("suppliers.form_address", "Street Address & City")}
                  </label>
                  <input
                    type="text"
                    value={formData.addressLine1}
                    onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                    placeholder="e.g., St 271, Toul Tompoung"
                    className="w-full min-h-[42px] px-3.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-2"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="City (e.g. Phnom Penh)"
                      className="w-full min-h-[42px] px-3.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      type="text"
                      value={formData.taxIdNo}
                      onChange={(e) => setFormData({ ...formData, taxIdNo: e.target.value })}
                      placeholder="Tax ID / VAT No."
                      className="w-full min-h-[42px] px-3.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {t("suppliers.form_payment_terms", "Payment Terms")}
                  </label>
                  <select
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Cash on Delivery">Cash on Delivery (COD)</option>
                    <option value="ABA Bank Transfer">ABA Bank Transfer</option>
                    <option value="Net 7">Net 7 Days Credit</option>
                    <option value="Net 15">Net 15 Days Credit</option>
                    <option value="Net 30">Net 30 Days Credit</option>
                    <option value="Prepaid">Prepaid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {t("suppliers.form_bank_details", "Bank Account Info (ABA / Acleda)")}
                  </label>
                  <input
                    type="text"
                    value={formData.bankDetails}
                    onChange={(e) => setFormData({ ...formData, bankDetails: e.target.value })}
                    placeholder="ABA: 001 888 999 (Sokha Trade)"
                    className="w-full min-h-[42px] px-3.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {t("suppliers.form_notes", "Internal Notes")}
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Delivery schedules, cutoff times, discounts, etc."
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="min-h-[42px] px-4 rounded-xl border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 text-sm font-medium transition"
                >
                  {t("common.cancel", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[42px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium shadow-sm transition active:scale-95"
                >
                  {isSubmitting
                    ? t("common.saving", "Saving...")
                    : editingSupplier
                    ? t("suppliers.save_changes", "Save Changes")
                    : t("suppliers.register_supplier", "Register Supplier")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-100 dark:border-neutral-800">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
              <IconAlertCircle size={28} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              {t("suppliers.confirm_delete_title", "Delete Supplier?")}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {t(
                "suppliers.confirm_delete_desc",
                "Are you sure you want to delete '{{name}}'? This action cannot be undone.",
                { name: deleteTarget.name }
              )}
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="min-h-[42px] px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-100 dark:hover:bg-neutral-800 transition"
              >
                {t("common.cancel", "Cancel")}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDelete}
                className="min-h-[42px] px-5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium shadow-sm transition active:scale-95"
              >
                {isSubmitting ? t("common.deleting", "Deleting...") : t("common.delete", "Delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Detail / History Drawer */}
      {isDetailDrawerOpen && selectedSupplierDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-lg h-full flex flex-col shadow-2xl border-l border-gray-100 dark:border-neutral-800 overflow-hidden animate-slideInRight">
            {/* Drawer Header */}
            <div className="p-6 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">
                  {t("suppliers.drawer_subtitle", "Supplier File")}
                </span>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {selectedSupplierDetail.name}
                </h2>
              </div>
              <button
                onClick={() => setIsDetailDrawerOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition"
              >
                <IconX size={20} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Quick Contact Bar */}
              <div className="flex items-center gap-2">
                {selectedSupplierDetail.phone && (
                  <a
                    href={`tel:${selectedSupplierDetail.phone}`}
                    className="flex-1 min-h-[42px] px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium text-xs flex items-center justify-center gap-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition active:scale-95"
                  >
                    <IconPhone size={16} />
                    <span>Call ({selectedSupplierDetail.phone})</span>
                  </a>
                )}
                {selectedSupplierDetail.telegram && (
                  <a
                    href={`https://t.me/${selectedSupplierDetail.telegram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 min-h-[42px] px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium text-xs flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition active:scale-95"
                  >
                    <IconBrandTelegram size={16} />
                    <span>Telegram</span>
                  </a>
                )}
              </div>

              {/* Information Cards */}
              <div className="bg-gray-50 dark:bg-neutral-800/50 p-4 rounded-xl space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-200/50 dark:border-neutral-700/50">
                  <span className="text-gray-500">{t("suppliers.contact_person", "Contact Person")}</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {selectedSupplierDetail.contact_person || "-"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200/50 dark:border-neutral-700/50">
                  <span className="text-gray-500">{t("suppliers.email", "Email")}</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {selectedSupplierDetail.email || "-"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200/50 dark:border-neutral-700/50">
                  <span className="text-gray-500">{t("suppliers.payment_terms", "Payment Terms")}</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {selectedSupplierDetail.payment_terms || "Cash on Delivery"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200/50 dark:border-neutral-700/50">
                  <span className="text-gray-500">{t("suppliers.bank_info", "Bank Details")}</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {selectedSupplierDetail.bank_details || "-"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">{t("suppliers.tax_id", "Tax / VAT ID")}</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 font-mono">
                    {selectedSupplierDetail.tax_id_no || "-"}
                  </span>
                </div>
              </div>

              {/* Recent Restock Orders */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <IconReceipt2 size={16} className="text-emerald-600" />
                    <span>{t("suppliers.recent_orders", "Recent Restock Orders")}</span>
                  </h3>
                  <Link
                    to={`/dashboard/purchase-orders?vendorId=${selectedSupplierDetail.id}`}
                    className="text-xs text-emerald-600 hover:underline font-medium"
                  >
                    {t("common.view_all", "View All")}
                  </Link>
                </div>

                {(!selectedSupplierDetail.recentOrders || selectedSupplierDetail.recentOrders.length === 0) ? (
                  <div className="p-6 text-center text-xs text-gray-400 bg-gray-50 dark:bg-neutral-800/40 rounded-xl">
                    {t("suppliers.no_recent_orders", "No purchase orders created for this supplier yet.")}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedSupplierDetail.recentOrders.map((po) => (
                      <div
                        key={po.id}
                        className="p-3 rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-850 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            PO #{po.id}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {moment(po.created_at).format("DD MMM YYYY, hh:mm A")}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-bold text-gray-900 dark:text-white">
                            ${parseFloat(po.total_amount || 0).toFixed(2)}
                          </div>
                          <span
                            className={clsx(
                              "inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase",
                              po.status === "completed"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : po.status === "ordered"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400"
                            )}
                          >
                            {po.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  setIsDetailDrawerOpen(false);
                  handleOpenEditModal(selectedSupplierDetail);
                }}
                className="flex-1 min-h-[42px] px-4 rounded-xl border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <IconPencil size={15} />
                <span>{t("common.edit", "Edit Profile")}</span>
              </button>

              <Link
                to={`/dashboard/purchase-orders?action=create&vendorId=${selectedSupplierDetail.id}`}
                className="flex-1 min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
              >
                <IconPlus size={15} stroke={2.5} />
                <span>{t("suppliers.create_po", "Create Restock PO")}</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
