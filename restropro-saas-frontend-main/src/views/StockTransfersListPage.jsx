import React, { useState, useRef, useEffect } from "react";
import Page from "../components/Page";
import { Link } from "react-router-dom";
import {
  IconPlus,
  IconSearch,
  IconPrinter,
  IconDownload,
  IconEye,
  IconTruckDelivery,
  IconCheck,
  IconBan,
  IconClock,
  IconBuildingStore,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconAlertCircle,
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconTruck,
  IconSettings,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import {
  useStockTransfers,
  useStockTransferDetails,
  receiveStockTransfer,
  cancelStockTransfer,
} from "../controllers/inventory.controller";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import clsx from "clsx";
import useConfirm from "../hooks/useConfirm";

export default function StockTransfersListPage() {
  const { t } = useTranslation();
  const [confirm, ConfirmDialog] = useConfirm();
  const user = getUserDetailsInLocalStorage();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedTransferId, setSelectedTransferId] = useState(null);
  const [receivingTransfer, setReceivingTransfer] = useState(null);
  const [receivingItems, setReceivingItems] = useState([]);
  const [isReceivingSubmitting, setIsReceivingSubmitting] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const settingsBtnRef = useRef(null);

  const { data, isLoading, mutate } = useStockTransfers({
    page,
    limit: pageSize,
    search,
    direction: directionFilter,
    status: statusFilter,
  });

  const transfers = data?.transfers || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };
  const summary = data?.summary || { total_count: 0, in_transit_count: 0, completed_count: 0, outgoing_count: 0, incoming_count: 0, pending_incoming_count: 0 };

  const totalItems = pagination.total || transfers.length;
  const totalPages = Math.max(1, pagination.totalPages || Math.ceil(totalItems / pageSize));
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + transfers.length, totalItems);

  const { transfer: activeTransfer, isLoading: isTransferDetailsLoading } = useStockTransferDetails(selectedTransferId);

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
  const isAllSelected = transfers.length > 0 && transfers.every((tr) => selectedRowIds.has(tr.id));
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(transfers.map((tr) => tr.id)));
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

  // Open Receive Modal
  const handleOpenReceiveModal = (transfer) => {
    setReceivingTransfer(transfer);
    setSelectedTransferId(transfer.id);
  };

  // Confirm receive
  const handleConfirmReceive = async () => {
    if (!receivingTransfer) return;
    setIsReceivingSubmitting(true);
    const toastId = toast.loading(t("toast.please_wait", "Please wait..."));

    try {
      const itemsToSubmit = (activeTransfer?.items || []).map((it) => {
        const override = receivingItems.find((r) => r.id === it.id);
        return {
          id: it.id,
          quantity_received: override !== undefined ? override.quantity_received : parseFloat(it.quantity_sent),
        };
      });

      await receiveStockTransfer(receivingTransfer.id, itemsToSubmit);
      toast.success(t("stock_transfers.status_completed", "Transfer received & completed!"), { id: toastId });
      setReceivingTransfer(null);
      setSelectedTransferId(null);
      mutate();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message, { id: toastId });
    } finally {
      setIsReceivingSubmitting(false);
    }
  };

  // Cancel transfer
  const handleCancelTransfer = async (id, refNo) => {
    if (!(await confirm({ title: t("stock_transfers.cancel_title", "Cancel Transfer"), description: t("stock_transfers.confirm_cancel", { ref: refNo, defaultValue: "Are you sure you want to cancel transfer {{ref}}? Any dispatched stock will be returned to the sending branch." }), confirmText: t("stock_transfers.cancel_action", "Yes, Cancel Transfer"), cancelText: t("common.keep_it", "No, keep it") }))) {
      return;
    }
    const toastId = toast.loading(t("toast.please_wait", "Please wait..."));
    try {
      await cancelStockTransfer(id);
      toast.success(t("stock_transfers.status_cancelled", "Transfer cancelled"), { id: toastId });
      mutate();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message, { id: toastId });
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!transfers.length) {
      toast.error("No transfers to export");
      return;
    }
    const headers = ["Reference No", "Date", "Direction", "From Branch", "To Branch", "Status", "Items", "Total Quantity", "Dispatched By", "Received By"];
    const rows = transfers.map((t) => [
      `"${t.reference_no}"`,
      `"${t.transfer_date}"`,
      `"${t.direction}"`,
      `"${t.from_tenant_name}"`,
      `"${t.to_tenant_name}"`,
      `"${t.status}"`,
      t.total_items,
      t.total_quantity,
      `"${t.dispatched_by || ""}"`,
      `"${t.received_by || ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_transfers_${new Date().toISOString().slice(0, 10)}.csv`);
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
            <IconTruck className="text-emerald-600 dark:text-emerald-400" size={26} stroke={iconStroke} />
            {t("stock_transfers.title", "Stock Transfers")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("stock_transfers.subtitle", "Inter-branch inventory dispatches and receiving between stores.")}
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
            to="/dashboard/inventory/transfers/add"
            className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 text-xs sm:text-sm font-semibold transition active:scale-95 shadow-sm shadow-emerald-600/20"
          >
            <IconPlus size={18} stroke={iconStroke} />
            <span>{t("stock_transfers.add_title", "Add Stock Transfer")}</span>
          </Link>
        </div>
      </div>

      {/* ── Summary Stat Cards (Image 2 Style) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Total Transfers */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide">
              {t("stock_transfers.card_total_transfers", "Total Transfers")}
            </span>
            <span className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <IconTruckDelivery size={16} stroke={iconStroke} />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {summary.total_count || 0}
          </div>
        </div>

        {/* In Transit */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide">
              {t("stock_transfers.card_in_transit", "In Transit")}
            </span>
            <span className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <IconClock size={16} stroke={iconStroke} />
            </span>
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2 tabular-nums">
            {summary.in_transit_count || 0}
          </div>
        </div>

        {/* Completed */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide">
              {t("stock_transfers.card_completed", "Completed")}
            </span>
            <span className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <IconCheck size={16} stroke={iconStroke} />
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">
            {summary.completed_count || 0}
          </div>
        </div>

        {/* Pending to Receive */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide">
              {t("stock_transfers.card_pending_incoming", "Pending to Receive")}
            </span>
            <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <IconArrowDownLeft size={16} stroke={iconStroke} />
            </span>
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2 tabular-nums">
            {summary.pending_incoming_count || 0}
          </div>
        </div>
      </div>

      {/* ── Filter Toolbar (Image 3 Style) ── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2">
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto flex-1">
          {/* Search */}
          <div className="relative flex-1 sm:max-w-xs w-full">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t("stock_transfers.search_placeholder", "Search reference, branch, or notes...")}
              className="w-full min-h-[38px] pl-9 pr-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>

          {/* Direction Filter */}
          <select
            value={directionFilter}
            onChange={(e) => {
              setDirectionFilter(e.target.value);
              setPage(1);
            }}
            className="min-h-[38px] px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            <option value="all">{t("stock_transfers.all_directions", "All Directions")}</option>
            <option value="outgoing">{t("stock_transfers.dir_outgoing", "Outgoing (Sent)")}</option>
            <option value="incoming">{t("stock_transfers.dir_incoming", "Incoming (Received)")}</option>
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
            <option value="in_transit">{t("stock_transfers.status_in_transit", "In Transit")}</option>
            <option value="completed">{t("stock_transfers.status_completed", "Completed")}</option>
            <option value="draft">{t("stock_transfers.status_draft", "Draft")}</option>
            <option value="cancelled">{t("stock_transfers.status_cancelled", "Cancelled")}</option>
          </select>
        </div>

        {/* Action Utility Buttons & Compact Inline Pagination */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={() => window.print()}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95 shadow-xs"
            title={t("stock_transfers.print_table", "Print Table")}
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
              <th className="px-3 py-2.5">{t("stock_transfers.status", "Status")}</th>
              <th className="px-3 py-2.5">{t("stock_transfers.ref_no", "Reference No")}</th>
              <th className="px-3 py-2.5">{t("stock_transfers.transfer_date", "Date")}</th>
              <th className="px-3 py-2.5">{t("stock_transfers.direction", "Direction")}</th>
              <th className="px-3 py-2.5">{t("stock_transfers.from_branch", "From Branch")}</th>
              <th className="px-3 py-2.5">{t("stock_transfers.to_branch", "To Branch")}</th>
              <th className="px-3 py-2.5 text-center">{t("stock_transfers.total_items", "Items")}</th>
              <th className="px-3 py-2.5 text-right">{t("stock_transfers.total_quantity", "Total Qty")}</th>
              <th className="px-4 py-2.5 text-right">{t("stock_transfers.actions", "Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80 text-slate-700 dark:text-slate-200">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  <span className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mr-2" />
                  {t("toast.please_wait", "Please wait...")}
                </td>
              </tr>
            ) : transfers.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  <IconAlertCircle className="mx-auto mb-2 text-slate-300 dark:text-neutral-600" size={32} />
                  <p className="text-sm font-medium">{t("stock_transfers.no_transfers_found", "No stock transfers found.")}</p>
                </td>
              </tr>
            ) : (
              transfers.map((trx) => {
                const isOutgoing = trx.direction === "outgoing";
                const isSelected = selectedRowIds.has(trx.id);

                return (
                  <tr
                    key={trx.id}
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
                        onChange={() => toggleSelectRow(trx.id)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>

                    {/* Status with Dot */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {trx.status === "completed" ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {t("stock_transfers.status_completed", "Completed")}
                        </span>
                      ) : trx.status === "in_transit" ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          {t("stock_transfers.status_in_transit", "In Transit")}
                        </span>
                      ) : trx.status === "cancelled" ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          {t("stock_transfers.status_cancelled", "Cancelled")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200/60 dark:bg-neutral-800 dark:text-slate-300 dark:border-neutral-700/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          {t("stock_transfers.status_draft", "Draft")}
                        </span>
                      )}
                    </td>

                    {/* Reference No */}
                    <td className="px-3 py-2.5 font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedTransferId(trx.id)}
                        className="hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer text-left font-mono"
                      >
                        {trx.reference_no}
                      </button>
                    </td>

                    {/* Date */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {trx.transfer_date}
                    </td>

                    {/* Direction */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${isOutgoing ? "bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40" : "bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40"}`}>
                        {isOutgoing ? (
                          <>
                            <IconArrowUpRight size={13} stroke={2.5} />
                            {t("stock_transfers.dir_outgoing", "Outgoing")}
                          </>
                        ) : (
                          <>
                            <IconArrowDownLeft size={13} stroke={2.5} />
                            {t("stock_transfers.dir_incoming", "Incoming")}
                          </>
                        )}
                      </span>
                    </td>

                    {/* From Branch */}
                    <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                      <span className="flex items-center gap-1.5">
                        <IconBuildingStore size={15} className="text-slate-400" />
                        {trx.from_tenant_name}
                      </span>
                    </td>

                    {/* To Branch */}
                    <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                      <span className="flex items-center gap-1.5">
                        <IconBuildingStore size={15} className="text-slate-400" />
                        {trx.to_tenant_name}
                      </span>
                    </td>

                    {/* Total items */}
                    <td className="px-3 py-2.5 text-center font-medium tabular-nums">
                      {trx.total_items}
                    </td>

                    {/* Total quantity */}
                    <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums whitespace-nowrap text-slate-900 dark:text-white">
                      {parseFloat(trx.total_quantity || 0)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedTransferId(trx.id)}
                          title={t("stock_transfers.view_transfer", "View Transfer Details")}
                          className="w-8 h-8 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-slate-100 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95"
                        >
                          <IconEye size={15} />
                        </button>

                        {/* If incoming & in_transit -> Receive Button */}
                        {!isOutgoing && trx.status === "in_transit" && (
                          <button
                            type="button"
                            onClick={() => handleOpenReceiveModal(trx)}
                            title={t("stock_transfers.receive_btn", "Receive Stock")}
                            className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition active:scale-95 shadow-xs"
                          >
                            <IconCheck size={13} />
                            <span>{t("stock_transfers.receive_btn", "Receive")}</span>
                          </button>
                        )}

                        {/* If outgoing & in_transit -> Cancel Button */}
                        {isOutgoing && trx.status === "in_transit" && (
                          <button
                            type="button"
                            onClick={() => handleCancelTransfer(trx.id, trx.reference_no)}
                            title={t("stock_transfers.cancel_btn", "Cancel Transfer")}
                            className="w-8 h-8 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition active:scale-95"
                          >
                            <IconBan size={15} />
                          </button>
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

      {/* ── Transfer Waybill / Manifest Modal ── */}
      {selectedTransferId && !receivingTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-neutral-700 shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-neutral-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <IconTruckDelivery size={22} className="text-emerald-600" />
                  {t("stock_transfers.waybill_title", "STOCK TRANSFER DISPATCH VOUCHER")}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Ref: {activeTransfer?.reference_no}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition active:scale-95"
                  title="Print Waybill"
                >
                  <IconPrinter size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTransferId(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition active:scale-95"
                >
                  <IconX size={20} />
                </button>
              </div>
            </div>

            {isTransferDetailsLoading ? (
              <div className="py-8 text-center text-slate-400">Loading transfer details...</div>
            ) : activeTransfer ? (
              <div className="space-y-4">
                {/* Route header */}
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 text-xs">
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider text-[10px] block">Sending Store (Source)</span>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{activeTransfer.from_tenant_name}</span>
                    <span className="block text-slate-500 mt-0.5">Dispatched By: {activeTransfer.dispatched_by || "Staff"}</span>
                    <span className="block text-slate-500">Date: {activeTransfer.transfer_date}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider text-[10px] block">Destination Store</span>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{activeTransfer.to_tenant_name}</span>
                    <span className="block text-slate-500 mt-0.5">Received By: {activeTransfer.received_by || "Pending Receipt"}</span>
                    <span className="block text-slate-500">Status: <strong className="capitalize">{activeTransfer.status}</strong></span>
                  </div>
                </div>

                {activeTransfer.notes && (
                  <div className="text-xs text-slate-600 dark:text-slate-300 bg-amber-50/60 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/30">
                    <span className="font-semibold block mb-0.5 text-amber-800 dark:text-amber-400">Dispatch Notes:</span>
                    {activeTransfer.notes}
                  </div>
                )}

                {/* Items */}
                <div className="rounded-xl border border-slate-200 dark:border-neutral-800 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Item</th>
                        <th className="py-2.5 px-3 text-right">Qty Sent</th>
                        <th className="py-2.5 px-3 text-right">Qty Received</th>
                        <th className="py-2.5 px-3">Line Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                      {activeTransfer.items?.map((it) => (
                        <tr key={it.id}>
                          <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                            {it.item_title} <span className="text-slate-400 font-normal">({it.unit})</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold">{parseFloat(it.quantity_sent)}</td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {it.quantity_received !== null ? (
                              <span className="text-emerald-600 font-semibold">{parseFloat(it.quantity_received)}</span>
                            ) : (
                              <span className="text-slate-400">Pending</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 italic">{it.notes || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Signatures */}
                <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs text-slate-400">
                  <div className="border-t border-slate-300 dark:border-neutral-700 pt-2">
                    Dispatched By ({activeTransfer.dispatched_by || "Driver / Staff"})
                  </div>
                  <div className="border-t border-slate-300 dark:border-neutral-700 pt-2">
                    Received By ({activeTransfer.received_by || "Store Manager"})
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Receiving Confirmation Modal ── */}
      {receivingTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-neutral-700 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-neutral-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t("stock_transfers.confirm_incoming", "Receive Stock Transfer")}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Ref: {receivingTransfer.reference_no} (From: {receivingTransfer.from_tenant_name})
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReceivingTransfer(null);
                  setSelectedTransferId(null);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <IconX size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              {t("stock_transfers.receive_instructions", "Inspect the incoming delivery. Adjust the quantity received if there was any transit breakage or shortage before confirming receipt into your inventory.")}
            </p>

            {isTransferDetailsLoading ? (
              <div className="py-6 text-center text-slate-400">Loading delivery details...</div>
            ) : activeTransfer ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 dark:border-neutral-800 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Item</th>
                        <th className="py-2.5 px-3 text-center">Qty Sent</th>
                        <th className="py-2.5 px-3 text-right w-36">Qty Received</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                      {activeTransfer.items?.map((it) => {
                        const sentQty = parseFloat(it.quantity_sent);
                        const curReceived = receivingItems.find((r) => r.id === it.id)?.quantity_received ?? sentQty;

                        return (
                          <tr key={it.id}>
                            <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                              {it.item_title} <span className="text-slate-400 font-normal">({it.unit})</span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono">{sentQty}</td>
                            <td className="py-2.5 px-3 text-right">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max={sentQty}
                                value={curReceived}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setReceivingItems((prev) => {
                                    const next = prev.filter((r) => r.id !== it.id);
                                    return [...next, { id: it.id, quantity_received: val }];
                                  });
                                }}
                                className="w-24 text-right font-mono font-semibold py-1 px-2 rounded-lg border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setReceivingTransfer(null);
                      setSelectedTransferId(null);
                    }}
                    className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-neutral-700 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800 transition active:scale-95"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmReceive}
                    disabled={isReceivingSubmitting}
                    className="min-h-[42px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-sm shadow-emerald-600/30"
                  >
                    <IconCheck size={16} />
                    <span>Confirm & Accept into Stock</span>
                  </button>
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
