import React, { useState, useMemo, useRef, useEffect } from "react";
import Page from "../components/Page";
import { Link } from "react-router-dom";
import {
  IconPlus,
  IconSearch,
  IconPrinter,
  IconDownload,
  IconEye,
  IconTrash,
  IconCheck,
  IconFileText,
  IconClock,
  IconChecklist,
  IconAlertCircle,
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconDatabase,
  IconSettings,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import {
  useStockAdjustments,
  useStockAdjustmentDetails,
  completeDraftAdjustment,
  deleteStockAdjustment,
} from "../controllers/inventory.controller";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import clsx from "clsx";
import useConfirm from "../hooks/useConfirm";

const REASON_COLORS = {
  physical_count: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60",
  spoilage: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
  damage: "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60",
  theft_loss: "bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60",
  internal_use: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
  correction: "bg-cyan-50 text-cyan-700 border-cyan-200/60 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/60",
  other: "bg-slate-50 text-slate-700 border-slate-200/60 dark:bg-neutral-800 dark:text-slate-300 dark:border-neutral-700/60",
};

export default function StockAdjustmentsListPage() {
  const { t } = useTranslation();
  const [confirm, ConfirmDialog] = useConfirm();
  const user = getUserDetailsInLocalStorage();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [selectedVoucherId, setSelectedVoucherId] = useState(null);
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const settingsBtnRef = useRef(null);

  const { data, isLoading, mutate } = useStockAdjustments({
    page,
    limit: pageSize,
    search,
    status: statusFilter,
    reason: reasonFilter,
  });

  const adjustments = data?.adjustments || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };
  const summary = data?.summary || { total_count: 0, draft_count: 0, completed_count: 0, net_units_adjusted: 0 };

  const totalItems = pagination.total || adjustments.length;
  const totalPages = Math.max(1, pagination.totalPages || Math.ceil(totalItems / pageSize));
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + adjustments.length, totalItems);

  const { adjustment: activeVoucher, isLoading: isVoucherLoading } = useStockAdjustmentDetails(selectedVoucherId);

  // Close gear menu when clicking outside
  useEffect(() => {
    if (!showSettingsMenu) return;
    const handleClickOutside = (e) => {
      if (settingsBtnRef.current && !settingsBtnRef.current.contains(e.target)) {
        setShowSettingsMenu(false);
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [showSettingsMenu]);

  // Checkbox Selection
  const isAllSelected = adjustments.length > 0 && adjustments.every((adj) => selectedRowIds.has(adj.id));
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(adjustments.map((a) => a.id)));
    }
  };

  const toggleSelectRow = (id) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Complete draft
  const handleCompleteDraft = async (id, refNo) => {
    if (!(await confirm({ title: t("stock_adjustments.complete_title", "Complete Adjustment"), description: t("stock_adjustments.confirm_complete", "Are you sure you want to complete this adjustment? This will immediately update your inventory stock."), confirmText: t("stock_adjustments.complete_action", "Complete"), tone: "primary" }))) {
      return;
    }
    const toastId = toast.loading(t("toast.please_wait", "Please wait..."));
    try {
      await completeDraftAdjustment(id);
      toast.success(t("stock_adjustments.status_completed", "Completed"), { id: toastId });
      mutate();
      if (selectedVoucherId === id) setSelectedVoucherId(null);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message, { id: toastId });
    }
  };

  // Delete draft
  const handleDeleteDraft = async (id) => {
    if (!(await confirm({ title: t("stock_adjustments.delete_title", "Delete Draft"), description: t("stock_adjustments.confirm_delete", "Are you sure you want to delete this draft adjustment?") }))) {
      return;
    }
    const toastId = toast.loading(t("toast.please_wait", "Please wait..."));
    try {
      await deleteStockAdjustment(id);
      toast.success(t("toast.success", "Success"), { id: toastId });
      mutate();
      if (selectedVoucherId === id) setSelectedVoucherId(null);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message, { id: toastId });
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!adjustments.length) {
      toast.error("No adjustments to export");
      return;
    }
    const headers = ["Reference No", "Date", "Reason", "Status", "Total Items", "Net Change", "Created By", "Notes"];
    const rows = adjustments.map((a) => [
      `"${a.reference_no}"`,
      `"${a.adjustment_date}"`,
      `"${a.reason}"`,
      `"${a.status}"`,
      a.total_items,
      a.net_quantity_change,
      `"${a.created_by || ""}"`,
      `"${(a.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_adjustments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Page className="px-4 py-4 max-w-7xl mx-auto space-y-4">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <IconDatabase className="text-emerald-600 dark:text-emerald-400" size={26} stroke={iconStroke} />
            {t("stock_adjustments.title", "Stock Adjustments")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("stock_adjustments.subtitle", "Track and reconcile inventory discrepancies, physical counts, and spoilage logs.")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-700 flex items-center gap-2 text-xs sm:text-sm font-medium transition active:scale-95 shadow-xs"
          >
            <IconDownload size={18} stroke={iconStroke} />
            <span>{t("stock_adjustments.export_csv", "Export CSV")}</span>
          </button>

          <Link
            to="/dashboard/inventory/adjustments/add"
            className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 text-xs sm:text-sm font-semibold transition active:scale-95 shadow-sm shadow-emerald-600/20"
          >
            <IconPlus size={18} stroke={iconStroke} />
            <span>{t("stock_adjustments.add_title", "Add Stock Adjustment")}</span>
          </Link>
        </div>
      </div>

      {/* ── Summary Stat Cards (Image 2 Style) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Total Adjustments */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide">
              {t("stock_adjustments.card_total_adjustments", "Total Adjustments")}
            </span>
            <span className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <IconChecklist size={16} stroke={iconStroke} />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {summary.total_count || 0}
          </div>
        </div>

        {/* Completed */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide">
              {t("stock_adjustments.status_completed", "Completed")}
            </span>
            <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <IconCheck size={16} stroke={iconStroke} />
            </span>
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2 tabular-nums">
            {summary.completed_count || 0}
          </div>
        </div>

        {/* Pending Drafts */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide">
              {t("stock_adjustments.card_pending_drafts", "Pending Drafts")}
            </span>
            <span className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <IconClock size={16} stroke={iconStroke} />
            </span>
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2 tabular-nums">
            {summary.draft_count || 0}
          </div>
        </div>

        {/* Net Units Adjusted */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide">
              {t("stock_adjustments.card_net_units", "Net Units Adjusted")}
            </span>
            <span className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <IconFileText size={16} stroke={iconStroke} />
            </span>
          </div>
          <div className={clsx(
            "text-2xl font-bold mt-2 tabular-nums",
            summary.net_units_adjusted >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          )}>
            {summary.net_units_adjusted > 0 ? `+${summary.net_units_adjusted}` : summary.net_units_adjusted || 0}
          </div>
        </div>
      </div>

      {/* ── Filter Toolbar (Image 3 Style) ── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2">
        {/* Search & Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto flex-1">
          {/* Search Input */}
          <div className="relative flex-1 sm:max-w-xs w-full">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t("stock_adjustments.search_placeholder", "Search by reference or note...")}
              className="w-full min-h-[38px] pl-9 pr-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>

          {/* Reason Filter */}
          <select
            value={reasonFilter}
            onChange={(e) => {
              setReasonFilter(e.target.value);
              setPage(1);
            }}
            className="min-h-[38px] px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            <option value="all">{t("stock_adjustments.all_reasons", "All Reasons")}</option>
            <option value="physical_count">{t("stock_adjustments.reason_physical_count", "Physical Count")}</option>
            <option value="spoilage">{t("stock_adjustments.reason_spoilage", "Expired / Spoilage")}</option>
            <option value="damage">{t("stock_adjustments.reason_damage", "Damaged / Broken")}</option>
            <option value="theft_loss">{t("stock_adjustments.reason_theft_loss", "Theft / Missing")}</option>
            <option value="internal_use">{t("stock_adjustments.reason_internal_use", "Internal Kitchen Use")}</option>
            <option value="correction">{t("stock_adjustments.reason_correction", "Correction")}</option>
            <option value="other">{t("stock_adjustments.reason_other", "Other")}</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="min-h-[38px] px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            <option value="all">{t("stock_adjustments.all_statuses", "All Statuses")}</option>
            <option value="completed">{t("stock_adjustments.status_completed", "Completed")}</option>
            <option value="draft">{t("stock_adjustments.status_draft", "Draft")}</option>
          </select>
        </div>

        {/* Action Utility Buttons & Compact Inline Pagination */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={() => window.print()}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95 shadow-xs"
            title={t("stock_adjustments.print_table", "Print Table")}
          >
            <IconPrinter size={16} stroke={iconStroke} />
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95 shadow-xs"
            title={t("stock_adjustments.export_csv", "Export CSV")}
          >
            <IconDownload size={16} stroke={iconStroke} />
          </button>

          <div className="relative" ref={settingsBtnRef}>
            <button
              type="button"
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95 shadow-xs"
              title={t("common.settings", "Settings")}
            >
              <IconSettings size={16} stroke={iconStroke} />
            </button>

            {showSettingsMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-slate-200 dark:border-neutral-700 py-2 z-20 text-xs">
                <div className="px-3 py-1 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                  {t("common.rows_per_page", "Rows per page")}
                </div>
                {[10, 20, 50].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setPageSize(size);
                      setPage(1);
                      setShowSettingsMenu(false);
                    }}
                    className={clsx(
                      "w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-neutral-700 transition flex items-center justify-between",
                      pageSize === size ? "text-emerald-600 font-semibold" : "text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <span>{size} {t("common.rows", "rows")}</span>
                    {pageSize === size && <IconCheck size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Compact Inline Pagination (< Previous 1 - 10 of 25 Next >) */}
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-neutral-400 pl-2 border-l border-slate-200 dark:border-neutral-700">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={clsx(
                "flex items-center gap-0.5 hover:text-slate-900 dark:hover:text-white transition",
                page <= 1 && "opacity-40 cursor-not-allowed hover:text-slate-600"
              )}
            >
              <IconChevronLeft size={14} stroke={iconStroke} />
              <span>{t("promotions.previous", "Previous")}</span>
            </button>

            <span className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
              {totalItems > 0 ? `${startIndex + 1} - ${endIndex}` : "0 - 0"}
              <span className="text-slate-400 font-normal"> of {totalItems}</span>
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={clsx(
                "flex items-center gap-0.5 hover:text-slate-900 dark:hover:text-white transition",
                page >= totalPages && "opacity-40 cursor-not-allowed hover:text-slate-600"
              )}
            >
              <span>{t("promotions.next", "Next")}</span>
              <IconChevronRight size={14} stroke={iconStroke} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Compact Flat Table ("small table" from Image 3) ── */}
      <div className="w-full overflow-x-auto border-t border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-neutral-800 text-[13px] font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-[#18181b]">
              <th className="w-10 px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all"
                  className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </th>
              <th className="px-3 py-2.5">{t("stock_adjustments.status", "Status")}</th>
              <th className="px-3 py-2.5">{t("stock_adjustments.ref_no", "Reference No")}</th>
              <th className="px-3 py-2.5">{t("stock_adjustments.adjustment_date", "Date")}</th>
              <th className="px-3 py-2.5">{t("stock_adjustments.reason", "Reason")}</th>
              <th className="px-3 py-2.5 text-center">{t("stock_adjustments.total_items", "Items")}</th>
              <th className="px-3 py-2.5 text-right">{t("stock_adjustments.net_change", "Net Difference")}</th>
              <th className="px-3 py-2.5">{t("stock_adjustments.created_by", "Added By")}</th>
              <th className="px-4 py-2.5 text-right">{t("stock_adjustments.actions", "Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80 text-slate-700 dark:text-slate-200">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <span className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mr-2" />
                  {t("toast.please_wait", "Please wait...")}
                </td>
              </tr>
            ) : adjustments.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <IconAlertCircle className="mx-auto mb-2 text-slate-300 dark:text-neutral-600" size={32} />
                  <p className="text-sm font-medium">{t("stock_adjustments.no_items_added", "No stock adjustments found.")}</p>
                </td>
              </tr>
            ) : (
              adjustments.map((adj) => {
                const netChange = parseFloat(adj.net_quantity_change || 0);
                const reasonBadgeClass = REASON_COLORS[adj.reason] || REASON_COLORS.other;
                const isSelected = selectedRowIds.has(adj.id);

                return (
                  <tr
                    key={adj.id}
                    className={clsx(
                      "hover:bg-slate-50/70 dark:hover:bg-neutral-800/40 transition text-xs sm:text-[13px]",
                      isSelected && "bg-emerald-50/40 dark:bg-emerald-950/20"
                    )}
                  >
                    {/* Checkbox */}
                    <td className="w-10 px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(adj.id)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>

                    {/* Status Pill Badge (with dot indicator) */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {adj.status === "completed" ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {t("stock_adjustments.status_completed", "Completed")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          {t("stock_adjustments.status_draft", "Draft")}
                        </span>
                      )}
                    </td>

                    {/* Reference No */}
                    <td className="px-3 py-2.5 font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedVoucherId(adj.id)}
                        className="hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer text-left font-mono"
                      >
                        {adj.reference_no}
                      </button>
                    </td>

                    {/* Date */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {adj.adjustment_date}
                    </td>

                    {/* Reason Badge */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize border ${reasonBadgeClass}`}>
                        {t(`stock_adjustments.reason_${adj.reason}`, adj.reason.replace(/_/g, " "))}
                      </span>
                    </td>

                    {/* Total items */}
                    <td className="px-3 py-2.5 text-center font-medium tabular-nums">
                      {adj.total_items}
                    </td>

                    {/* Net delta */}
                    <td className="px-3 py-2.5 text-right font-semibold font-mono tabular-nums whitespace-nowrap">
                      <span className={netChange > 0 ? "text-emerald-600 dark:text-emerald-400" : netChange < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-500"}>
                        {netChange > 0 ? `+${netChange}` : netChange}
                      </span>
                    </td>

                    {/* Created By */}
                    <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400 max-w-[130px] truncate">
                      {adj.created_by || "System"}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedVoucherId(adj.id)}
                          title={t("stock_adjustments.view_voucher", "View Voucher")}
                          className="w-8 h-8 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-slate-100 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95"
                        >
                          <IconEye size={15} />
                        </button>

                        {adj.status === "draft" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCompleteDraft(adj.id, adj.reference_no)}
                              title={t("stock_adjustments.complete_btn", "Complete Adjustment")}
                              className="w-8 h-8 rounded-md text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-center transition active:scale-95"
                            >
                              <IconCheck size={15} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteDraft(adj.id)}
                              title={t("stock_adjustments.delete_draft", "Delete Draft")}
                              className="w-8 h-8 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition active:scale-95"
                            >
                              <IconTrash size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Bottom Pagination Bar (Image 3 Style) ── */}
      <div className="flex items-center justify-between py-3 px-1 text-xs text-slate-600 dark:text-neutral-400">
        <div className="text-slate-500">
          {t("promotions.showing", "Showing")} {totalItems > 0 ? startIndex + 1 : 0} {t("promotions.to", "to")} {endIndex} {t("promotions.of", "of")}{" "}
          {totalItems} {t("promotions.entries", "entries")}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className={clsx(
              "flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition",
              page <= 1 && "opacity-40 cursor-not-allowed hover:text-slate-600"
            )}
          >
            <IconChevronLeft size={14} stroke={iconStroke} />
            <span>{t("promotions.previous", "Previous")}</span>
          </button>

          <span className="tabular-nums font-medium text-slate-800 dark:text-slate-200">
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className={clsx(
              "flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition",
              page >= totalPages && "opacity-40 cursor-not-allowed hover:text-slate-600"
            )}
          >
            <span>{t("promotions.next", "Next")}</span>
            <IconChevronRight size={14} stroke={iconStroke} />
          </button>
        </div>
      </div>

      {/* ── Voucher Detail & Print Modal ── */}
      {selectedVoucherId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-neutral-700 shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-neutral-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t("stock_adjustments.voucher_title", "STOCK ADJUSTMENT VOUCHER")}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Ref: {activeVoucher?.reference_no}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition active:scale-95"
                  title={t("stock_adjustments.print_voucher", "Print Voucher")}
                >
                  <IconPrinter size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedVoucherId(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition active:scale-95"
                >
                  <IconX size={20} />
                </button>
              </div>
            </div>

            {isVoucherLoading ? (
              <div className="py-8 text-center text-slate-400">Loading voucher details...</div>
            ) : activeVoucher ? (
              <div className="space-y-4">
                {/* Meta details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 text-xs">
                  <div>
                    <span className="text-slate-400 block">{t("stock_adjustments.adjustment_date", "Date")}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{activeVoucher.adjustment_date}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{t("stock_adjustments.reason", "Reason")}</span>
                    <span className="font-semibold capitalize text-slate-800 dark:text-slate-200">{activeVoucher.reason?.replace(/_/g, " ")}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{t("stock_adjustments.status", "Status")}</span>
                    <span className="font-semibold capitalize text-slate-800 dark:text-slate-200">{activeVoucher.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{t("stock_adjustments.created_by", "Created By")}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{activeVoucher.created_by || "System"}</span>
                  </div>
                </div>

                {activeVoucher.notes && (
                  <div className="text-xs text-slate-600 dark:text-slate-300 bg-amber-50/60 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/30">
                    <span className="font-semibold block mb-0.5 text-amber-800 dark:text-amber-400">Notes:</span>
                    {activeVoucher.notes}
                  </div>
                )}

                {/* Items Table */}
                <div className="rounded-xl border border-slate-200 dark:border-neutral-800 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Item</th>
                        <th className="py-2.5 px-3 text-right">Previous</th>
                        <th className="py-2.5 px-3 text-right">Counted</th>
                        <th className="py-2.5 px-3 text-right">Difference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                      {activeVoucher.items?.map((it) => (
                        <tr key={it.id}>
                          <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                            {it.item_title} <span className="text-slate-400 font-normal">({it.unit})</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">{parseFloat(it.current_quantity)}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{parseFloat(it.counted_quantity)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold">
                            <span className={parseFloat(it.delta_quantity) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                              {parseFloat(it.delta_quantity) > 0 ? `+${it.delta_quantity}` : it.delta_quantity}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer Signatures */}
                <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs text-slate-400">
                  <div className="border-t border-slate-300 dark:border-neutral-700 pt-2">
                    Prepared By ({activeVoucher.created_by || "Staff"})
                  </div>
                  <div className="border-t border-slate-300 dark:border-neutral-700 pt-2">
                    {t("stock_adjustments.authorized_signature", "Authorized Signature")}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
      <ConfirmDialog />
    </Page>
  );
}
