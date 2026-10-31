import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IconX,
  IconArrowsExchange,
  IconLink,
  IconUnlink,
  IconArrowsLeftRight,
  IconReceiptTax,
  IconShoppingBag,
  IconTruckDelivery,
  IconUser,
  IconPencil,
  IconShoppingCartPlus,
  IconCash,
  IconReceipt2,
  IconClock,
  IconArmchair,
  IconTrash,
  IconShieldLock,
  IconRefresh,
  IconPrinter,
  IconQrcode,
  IconCheck,
  IconLayoutColumns,
  IconLayoutSidebar,
} from "@tabler/icons-react";
import moment from "moment";
import { formatRelativeTime } from "../../helpers/DateHelper";
import toast from "react-hot-toast";
import { rotateStoreTablePin } from "../../controllers/settings.controller";
import { approveQROrder, cancelQROrder, getQROrders } from "../../controllers/pos.controller";
import { printTableQRPinSlip } from "../../helpers/QRMenuHelper";
import { formatTableTitle, formatFloorTitle } from "../../helpers/TableHelper";

export default function BindoActionDrawer({
  isOpen = true,
  onClose = () => {},
  selectedTable = null,
  isMergeMode = false,
  onToggleMergeMode = () => {},
  onMoveTable = () => {},
  onSplitChecks = () => {},
  onMoveLineItem = () => {},
  onNewOrder = () => {},
  onAddMenuItems = () => {},
  onPayTable = () => {},
  onOpenCustomerModal = () => {},
  onVoidItem = () => {},
  activeOrderSummary = null,
  isLoadingOrderSummary = false,
  onEditTable = () => {},
  currency = "$",
  storeSettings = null,
  onRefreshTables = () => {},
}) {
  const { t } = useTranslation();
  const [tableQrOrders, setTableQrOrders] = useState([]);
  const [isRotatingPin, setIsRotatingPin] = useState(false);
  const [processingQrOrderId, setProcessingQrOrderId] = useState(null);

  // Manual column layout override: null = auto (2-col if occupied, 1-col if free)
  const [manualTwoColumn, setManualTwoColumn] = useState(null);

  const isOccupied = Boolean(selectedTable?.active_order_id);
  // Auto-switch to 2 columns when table is occupied, unless user explicitly toggled
  const isTwoColumn = manualTwoColumn !== null ? manualTwoColumn : isOccupied;

  // Reset manual override when selected table changes so each table opens in optimal view
  useEffect(() => {
    setManualTwoColumn(null);
  }, [selectedTable?.id]);

  const loadTablePendingQrOrders = async () => {
    if (!selectedTable?.id) {
      setTableQrOrders([]);
      return;
    }
    try {
      const res = await getQROrders();
      if (res.status === 200 && Array.isArray(res.data)) {
        const filtered = res.data.filter((o) => Number(o.table_id) === Number(selectedTable.id));
        setTableQrOrders(filtered);
      }
    } catch (err) {
      console.error("Failed to load table QR orders:", err);
    }
  };

  useEffect(() => {
    if (isOpen && selectedTable?.id) {
      loadTablePendingQrOrders();
    } else {
      setTableQrOrders([]);
    }
  }, [isOpen, selectedTable?.id, selectedTable?.pending_qr_orders_count]);

  const handleRotatePin = async () => {
    if (!selectedTable?.id) return;
    try {
      setIsRotatingPin(true);
      const res = await rotateStoreTablePin(selectedTable.id);
      if (res.status === 200) {
        toast.success(`New PIN for ${formatTableTitle(selectedTable.table_title, t("tables.table", "Table"))}: ${res.data.table_pin}`);
        onRefreshTables();
      }
    } catch (err) {
      toast.error("Failed to rotate Table PIN");
    } finally {
      setIsRotatingPin(false);
    }
  };

  const handleApproveQrOrder = async (qrOrderId) => {
    try {
      setProcessingQrOrderId(qrOrderId);
      const res = await approveQROrder(qrOrderId);
      if (res.status === 200) {
        toast.success(res.data?.message || "QR Order approved and sent to kitchen!");
        await loadTablePendingQrOrders();
        onRefreshTables();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to approve QR order");
    } finally {
      setProcessingQrOrderId(null);
    }
  };

  const handleRejectQrOrder = async (qrOrderId) => {
    try {
      setProcessingQrOrderId(qrOrderId);
      const res = await cancelQROrder(qrOrderId);
      if (res.status === 200) {
        toast.success("QR Order rejected");
        await loadTablePendingQrOrders();
        onRefreshTables();
      }
    } catch (err) {
      toast.error("Failed to reject QR order");
    } finally {
      setProcessingQrOrderId(null);
    }
  };

  if (!isOpen) return null;

  const orderItemsList = (activeOrderSummary?.orders || []).flatMap((ord) => ord.items || []);
  const totalPayable = Number(
    activeOrderSummary?.total ||
      selectedTable?.active_order_total ||
      selectedTable?.order_total ||
      0
  );
  const totalItemsCount =
    orderItemsList.reduce((acc, i) => acc + Number(i.quantity || 1), 0) ||
    selectedTable?.order_items_count ||
    0;

  // ─────────────────────────────────────────────────────────────
  // REUSABLE SUB-CARDS (Orders & Other)
  // ─────────────────────────────────────────────────────────────

  // Card: Table Security PIN & QR Slip
  const renderPinCard = () => (
    <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/60 space-y-2 shrink-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 text-emerald-600 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
            <IconShieldLock size={16} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {t("tables.table_qr_pin", "Table QR PIN")}
            </p>
            <p className="font-mono text-base font-black tracking-widest text-slate-900 dark:text-white">
              {selectedTable?.table_pin || "----"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={isRotatingPin}
            onClick={handleRotatePin}
            title={t("tables.reset_pin_tooltip", "Reset 4-Digit Table PIN")}
            className="min-h-[38px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
          >
            <IconRefresh size={13} className={isRotatingPin ? "animate-spin" : ""} />
            <span>{t("tables.reset", "Reset")}</span>
          </button>

          {storeSettings?.uniqueQRCode && (
            <button
              type="button"
              onClick={() =>
                printTableQRPinSlip({
                  storeName: storeSettings?.storeName || "Restaurant",
                  uniqueQRCode: storeSettings.uniqueQRCode,
                  table: selectedTable,
                })
              }
              title={t("tables.print_slip_tooltip", "Print QR + PIN Slip for Guests")}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
            >
              <IconPrinter size={13} />
              <span>{t("tables.slip", "Slip")}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Card: Customer Management
  const renderCustomerCard = () => (
    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-750 shadow-2xs flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-zinc-700 flex items-center justify-center shrink-0">
          <IconUser size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            {t("common.customer", "Customer")}
          </p>
          <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
            {selectedTable?.customer_name || t("pos.walkin_customer", "Walk-in Guest")}
          </p>
          {selectedTable?.customer_phone && (
            <p className="text-[10px] text-slate-400 truncate">{selectedTable.customer_phone}</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpenCustomerModal(selectedTable)}
        className="min-h-[38px] px-2.5 py-1.5 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/30 text-[#0284c7] dark:text-sky-300 hover:bg-sky-100/70 text-xs font-bold transition active:scale-95 cursor-pointer shrink-0"
      >
        {selectedTable?.customer_name ? t("common.change", "Change") : t("customers.assign", "+ Assign")}
      </button>
    </div>
  );

  // Card: Pending QR Orders (1-Tap Approve / Reject)
  const renderQrOrdersCard = () => {
    if (!tableQrOrders || tableQrOrders.length === 0) return null;
    return (
      <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <IconQrcode size={15} />
            <span>{t("tables.pending_qr_orders", "Pending QR Orders")} ({tableQrOrders.length})</span>
          </span>
        </div>

        <div className="space-y-2">
          {tableQrOrders.map((qrOrd) => (
            <div
              key={qrOrd.id}
              className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/60 space-y-2"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  QR #{qrOrd.id} • {qrOrd.customer_name || "Guest"}
                </span>
                <span className="text-slate-400">
                  {qrOrd.date ? formatRelativeTime(qrOrd.date, t("pos.just_now", "Just now")) : t("pos.just_now", "Just now")}
                </span>
              </div>
              <div className="text-xs space-y-1">
                {(qrOrd.items || []).map((it, idx) => (
                  <div key={idx} className="flex justify-between text-slate-700 dark:text-slate-300">
                    <span>
                      <b>{it.quantity}x</b> {it.item_title}
                      {it.variant_title ? ` (${it.variant_title})` : ""}
                    </span>
                    <span className="font-semibold">
                      {currency}
                      {(Number(it.price) * Number(it.quantity)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  disabled={processingQrOrderId === qrOrd.id}
                  onClick={() => handleApproveQrOrder(qrOrd.id)}
                  className="min-h-[38px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                >
                  <IconCheck size={14} />
                  <span>{t("tables.approve_kds", "Approve → KDS")}</span>
                </button>
                <button
                  type="button"
                  disabled={processingQrOrderId === qrOrd.id}
                  onClick={() => handleRejectQrOrder(qrOrd.id)}
                  className="min-h-[38px] rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-900/60 text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                >
                  <IconX size={14} />
                  <span>{t("common.reject", "Reject")}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Card: Table Management Utilities (Move Table, Merge Table, Split Checks, Move Item)
  const renderTableManagementCard = () => (
    <div className="p-3 rounded-2xl bg-slate-50/70 dark:bg-zinc-850 border border-slate-200/80 dark:border-zinc-750 space-y-2.5 shrink-0">
      <h4 className="text-[11px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
        {t("tables.table_management", "Table Management")}
      </h4>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onMoveTable(selectedTable)}
          className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 text-slate-700 dark:text-slate-200 font-bold text-xs hover:border-[#0ea5e9] transition cursor-pointer shadow-2xs min-h-[46px] active:scale-95"
        >
          <IconArrowsExchange size={18} className="text-[#0ea5e9]" />
          <span>{t("tables.move_table", "Move Table")}</span>
        </button>

        <button
          type="button"
          onClick={onToggleMergeMode}
          className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border font-bold text-xs transition cursor-pointer shadow-2xs min-h-[46px] active:scale-95 ${
            isMergeMode
              ? "border-amber-500 bg-amber-500 text-white animate-pulse"
              : "border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 text-slate-700 dark:text-slate-200 hover:border-[#0ea5e9]"
          }`}
        >
          {isMergeMode ? <IconUnlink size={18} /> : <IconLink size={18} className="text-amber-500" />}
          <span>
            {isMergeMode ? t("tables.exit_merge", "Exit Merge") : t("tables.merge_table", "Merge Table")}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onMoveLineItem(selectedTable)}
          className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 text-slate-700 dark:text-slate-200 font-bold text-xs hover:border-[#0ea5e9] transition cursor-pointer shadow-2xs min-h-[46px] active:scale-95"
        >
          <IconArrowsLeftRight size={18} className="text-purple-500" />
          <span>{t("tables.move_line_item", "Move Item")}</span>
        </button>

        <button
          type="button"
          onClick={() => onSplitChecks(selectedTable)}
          className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 text-slate-700 dark:text-slate-200 font-bold text-xs hover:border-[#0ea5e9] transition cursor-pointer shadow-2xs min-h-[46px] active:scale-95"
        >
          <IconReceiptTax size={18} className="text-emerald-500" />
          <span>{t("tables.split_checks", "Split Checks")}</span>
        </button>
      </div>
    </div>
  );

  return (
    <aside
      className={`h-full bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col shrink-0 select-none z-30 transition-all duration-200 ease-in-out ${
        isTwoColumn
          ? "w-full sm:w-[620px] md:w-[700px] lg:w-[760px] xl:w-[820px]"
          : "w-80 md:w-96"
      }`}
    >
      {/* 1. Unified Top Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 shrink-0 bg-slate-50/70 dark:bg-zinc-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isOccupied
                ? "bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300"
                : "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            <IconArmchair size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                {selectedTable
                  ? formatTableTitle(selectedTable.table_title, t("tables.table", "Table"))
                  : t("tables.table_actions", "Table Actions")}
              </h3>
              {selectedTable && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    isOccupied
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  }`}
                >
                  {isOccupied ? t("tables.occupied", "Occupied") : t("tables.available", "Available")}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {selectedTable
                ? `${selectedTable.seating_capacity || 0} ${
                    Number(selectedTable.seating_capacity) === 1
                      ? t("tables.seat", "Seat")
                      : t("tables.seats", "Seats")
                  }${
                    selectedTable.floor !== undefined &&
                    selectedTable.floor !== null &&
                    String(selectedTable.floor).trim() !== ""
                      ? ` • ${formatFloorTitle(selectedTable.floor, t("tables.floor", "Floor"))}`
                      : ""
                  }`
                : t("tables.floor_plan_management", "Floor Plan Management")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Column Layout Switcher (1 Col vs 2 Cols) */}
          {selectedTable && (
            <button
              type="button"
              onClick={() => setManualTwoColumn(!isTwoColumn)}
              title={
                isTwoColumn
                  ? t("tables.switch_single_column", "Switch to 1 Column View")
                  : t("tables.switch_two_column", "Split into 2 Columns (Orders & Other)")
              }
              className={`min-h-[34px] px-2 py-1 rounded-lg border text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer ${
                isTwoColumn
                  ? "border-sky-300 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-300"
                  : "border-slate-200 dark:border-zinc-700 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800"
              }`}
            >
              {isTwoColumn ? <IconLayoutSidebar size={15} /> : <IconLayoutColumns size={15} />}
              <span className="hidden sm:inline text-[11px]">
                {isTwoColumn ? t("tables.col_1", "1 Col") : t("tables.col_2", "2 Cols")}
              </span>
            </button>
          )}

          {selectedTable && (
            <button
              type="button"
              onClick={() => onEditTable(selectedTable)}
              title={t("table_settings.update_table", "Edit Table")}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition active:scale-95 cursor-pointer"
            >
              <IconPencil size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition active:scale-95 cursor-pointer"
          >
            <IconX size={18} />
          </button>
        </div>
      </div>

      {/* 2. Drawer Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden p-3.5">
        {!selectedTable ? (
          <div className="h-full flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-dashed border-slate-200 dark:border-zinc-700 text-center text-xs text-slate-400 space-y-2">
            <IconArmchair size={28} className="mx-auto text-slate-300 dark:text-zinc-600" />
            <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">
              {t("tables.no_table_selected", "No Table Selected")}
            </p>
            <p className="text-slate-400 max-w-xs mx-auto">
              {t("tables.tap_table_hint", "Tap any table on the canvas to view order details, add menu items, or settle payment.")}
            </p>
          </div>
        ) : isTwoColumn ? (
          /* ========================================================
             TWO COLUMNS LAYOUT:
             Column 1: Orders (Order Breakdown, Tall Scrollable Items, Total, POS & Pay Now)
             Column 2: Other (Table QR PIN, Customer card, Pending QR orders, Table Management)
             ======================================================== */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 h-full min-h-0 overflow-y-auto sm:overflow-hidden">
            {/* COLUMN 1: ORDERS */}
            <div className="flex flex-col h-full min-h-[380px] sm:min-h-0 bg-white dark:bg-zinc-850 rounded-2xl border border-slate-200 dark:border-zinc-750 shadow-2xs overflow-hidden">
              {isOccupied ? (
                <>
                  {/* Order Header */}
                  <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40 shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <IconReceipt2 size={16} className="text-[#0ea5e9] shrink-0" />
                      <span className="font-extrabold text-xs text-slate-800 dark:text-white truncate">
                        {t("orders.order", "Order")} #{selectedTable.active_order_token || selectedTable.active_order_id}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 shrink-0">
                        {totalItemsCount} {t("tables.items", "items")}
                      </span>
                    </div>
                    {selectedTable.active_order_date && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0">
                        <IconClock size={12} />
                        {formatRelativeTime(selectedTable.active_order_date, t("pos.just_now", "Just now"))}
                      </span>
                    )}
                  </div>

                  {/* Scrollable Order Items List - Fills full vertical height */}
                  <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-1.5">
                    {isLoadingOrderSummary ? (
                      <div className="h-full flex items-center justify-center gap-2 text-xs text-slate-400 py-8">
                        <div className="w-4 h-4 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin"></div>
                        <span>{t("common.loading", "Loading items...")}</span>
                      </div>
                    ) : orderItemsList.length > 0 ? (
                      orderItemsList.map((item, idx) => {
                        const itemName = item.item_title || item.title || t("common.item", "Item");
                        const addonsSum = Array.isArray(item.addons)
                          ? item.addons.reduce((acc, a) => acc + Number(a?.price || 0), 0)
                          : 0;
                        const unitPrice = Number(item.variant_price || item.price || 0) + addonsSum;
                        const lineTotal = unitPrice * Number(item.quantity || 1);

                        return (
                          <div
                            key={item.id || idx}
                            className="group flex items-start justify-between p-2 rounded-xl bg-slate-50/70 dark:bg-zinc-800/40 hover:bg-slate-100/70 dark:hover:bg-zinc-800/80 border border-slate-100/80 dark:border-zinc-800 transition gap-2"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                                  {item.quantity}x {itemName}
                                </span>
                                {item.status && item.status !== "cancelled" && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-zinc-700/70 text-slate-600 dark:text-slate-300 font-semibold shrink-0 uppercase tracking-tight">
                                    {item.status}
                                  </span>
                                )}
                              </div>
                              {item.variant_title && (
                                <span className="text-[10px] text-slate-400 block truncate font-medium">
                                  {item.variant_title}
                                </span>
                              )}
                              {item.addons && item.addons.length > 0 && (
                                <span className="text-[10px] text-sky-500 dark:text-sky-400 block truncate font-medium">
                                  +{item.addons.filter(Boolean).map((a) => a.title).join(", ")}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                              <span className="font-black text-slate-800 dark:text-slate-200 text-xs">
                                {currency}{lineTotal.toFixed(2)}
                              </span>
                              <button
                                type="button"
                                onClick={() => onVoidItem(item)}
                                title={t("orders.void_item", "Void / Cancel item")}
                                className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 flex items-center justify-center transition active:scale-95 cursor-pointer"
                              >
                                <IconTrash size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400 italic py-6 text-center">
                        {selectedTable.order_items_count || 0} {t("tables.items_active", "items in order")}
                      </p>
                    )}
                  </div>

                  {/* Pinned Bottom Tray: Total Payable & Primary POS / Pay Actions */}
                  <div className="shrink-0 p-3 bg-slate-50/80 dark:bg-zinc-800/60 border-t border-slate-200/80 dark:border-zinc-750 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {t("orders.total", "Total Payable")}
                      </span>
                      <span className="text-xl font-black text-[#0ea5e9]">
                        {currency}{totalPayable.toFixed(2)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => onAddMenuItems(selectedTable)}
                        className="w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-sm hover:shadow-md transition active:scale-98 cursor-pointer"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <IconShoppingCartPlus size={18} className="shrink-0" />
                          <span className="truncate">{t("tables.add_more_items", "+ Add Menu Items")}</span>
                        </span>
                        <span className="text-[11px] font-semibold bg-emerald-700 px-2 py-0.5 rounded-lg opacity-90 shrink-0">
                          POS →
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onPayTable(selectedTable)}
                        className="w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-black text-xs sm:text-sm shadow-sm hover:shadow-md transition active:scale-98 cursor-pointer"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <IconCash size={18} className="shrink-0" />
                          <span className="truncate">{t("tables.settle_bill", "Pay / Settle Bill")}</span>
                        </span>
                        <span className="text-[11px] font-semibold bg-sky-700 px-2 py-0.5 rounded-lg opacity-90 shrink-0">
                          {t("tables.pay_now", "Pay Now")}
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* Available Table in Column 1 */
                <div className="p-4 flex flex-col justify-between h-full space-y-4">
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                      <p className="text-xs font-black">{t("tables.available", "Table Available")}</p>
                      <p className="text-[11px] opacity-80 mt-0.5">
                        {t("tables.ready_for_guests", "Ready for new guests. Tap below to start order.")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAddMenuItems(selectedTable)}
                      className="w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-sm transition active:scale-98 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <IconShoppingCartPlus size={18} />
                        <span>{t("tables.take_order_add_items", "+ Take Order / Add Items")}</span>
                      </span>
                      <span className="text-[11px] font-semibold bg-emerald-700 px-2 py-0.5 rounded-lg opacity-90">
                        POS →
                      </span>
                    </button>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      {t("tables.quick_new_order", "Quick New Order")}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onNewOrder("take_away", selectedTable)}
                        className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-700 text-xs font-bold transition cursor-pointer min-h-[42px] active:scale-95"
                      >
                        <IconShoppingBag size={15} className="text-[#0ea5e9]" />
                        <span>{t("orders.take_away", "Take Away")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onNewOrder("delivery", selectedTable)}
                        className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-700 text-xs font-bold transition cursor-pointer min-h-[42px] active:scale-95"
                      >
                        <IconTruckDelivery size={15} className="text-[#0ea5e9]" />
                        <span>{t("orders.delivery", "Delivery")}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* COLUMN 2: OTHER (Table Security PIN, Customer, QR Orders, Table Management) */}
            <div className="flex flex-col h-full min-h-0 overflow-y-auto space-y-3 pr-1">
              {renderPinCard()}
              {renderCustomerCard()}
              {renderQrOrdersCard()}
              {renderTableManagementCard()}
            </div>
          </div>
        ) : (
          /* ========================================================
             SINGLE COLUMN LAYOUT (Compact / Free Table Default)
             ======================================================== */
          <div className="h-full overflow-y-auto pr-1 space-y-3.5">
            {renderPinCard()}
            {renderQrOrdersCard()}
            {renderCustomerCard()}

            {/* Occupied vs Available in Single Column */}
            {isOccupied ? (
              <div className="space-y-3.5">
                {/* Active Order Card */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-850 border border-slate-200 dark:border-zinc-750 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                      <IconReceipt2 size={16} className="text-[#0ea5e9]" />
                      {t("orders.order", "Order")} #{selectedTable.active_order_token || selectedTable.active_order_id}
                    </span>
                    {selectedTable.active_order_date && (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <IconClock size={13} />
                        {formatRelativeTime(selectedTable.active_order_date, t("pos.just_now", "Just now"))}
                      </span>
                    )}
                  </div>

                  <div className="border-t border-slate-100 dark:border-zinc-800 pt-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {t("tables.ordered_items", "Ordered Items")}
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold">
                        {totalItemsCount} {t("tables.items", "items")}
                      </span>
                    </div>

                    {isLoadingOrderSummary ? (
                      <div className="py-4 flex items-center justify-center gap-2 text-xs text-slate-400">
                        <div className="w-4 h-4 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin"></div>
                        <span>{t("common.loading", "Loading items...")}</span>
                      </div>
                    ) : orderItemsList.length > 0 ? (
                      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 text-xs">
                        {orderItemsList.map((item, idx) => {
                          const itemName = item.item_title || item.title || t("common.item", "Item");
                          const addonsSum = Array.isArray(item.addons)
                            ? item.addons.reduce((acc, a) => acc + Number(a?.price || 0), 0)
                            : 0;
                          const unitPrice = Number(item.variant_price || item.price || 0) + addonsSum;
                          const lineTotal = unitPrice * Number(item.quantity || 1);

                          return (
                            <div
                              key={item.id || idx}
                              className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-zinc-800/60 last:border-0 gap-2"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                    {item.quantity}x {itemName}
                                  </span>
                                  {item.status && item.status !== "cancelled" && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 font-medium shrink-0">
                                      {item.status}
                                    </span>
                                  )}
                                </div>
                                {item.variant_title && (
                                  <span className="text-[10px] text-slate-400 block truncate">{item.variant_title}</span>
                                )}
                                {item.addons && item.addons.length > 0 && (
                                  <span className="text-[10px] text-sky-500 block truncate">
                                    +{item.addons.filter(Boolean).map((a) => a.title).join(", ")}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                  {currency}{lineTotal.toFixed(2)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onVoidItem(item)}
                                  title={t("orders.void_item", "Void / Cancel item")}
                                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center transition active:scale-95 cursor-pointer"
                                >
                                  <IconTrash size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic py-1">
                        {selectedTable.order_items_count || 0} {t("tables.items_active", "items in order")}
                      </p>
                    )}

                    {/* Total Tray */}
                    <div className="pt-2 mt-2 border-t border-slate-200/80 dark:border-zinc-700/80 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">{t("orders.total", "Total Payable")}</span>
                      <span className="text-lg font-black text-[#0ea5e9]">
                        {currency}{totalPayable.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onAddMenuItems(selectedTable)}
                    className="w-full min-h-[44px] flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md hover:shadow-lg transition active:scale-98 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <IconShoppingCartPlus size={18} />
                      {t("tables.add_more_items", "+ Add Menu Items")}
                    </span>
                    <span className="text-xs font-semibold bg-emerald-700 px-2 py-0.5 rounded-lg opacity-90">
                      POS →
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onPayTable(selectedTable)}
                    className="w-full min-h-[44px] flex items-center justify-between px-4 py-3 rounded-xl bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-black text-sm shadow-md hover:shadow-lg transition active:scale-98 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <IconCash size={18} />
                      {t("tables.settle_bill", "Pay / Settle Bill")}
                    </span>
                    <span className="text-xs font-semibold bg-sky-700 px-2 py-0.5 rounded-lg opacity-90">
                      {t("tables.pay_now", "Pay Now")}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              /* Available Table Actions in Single Column */
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => onAddMenuItems(selectedTable)}
                  className="w-full min-h-[44px] flex items-center justify-between px-4 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md hover:shadow-lg transition active:scale-98 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <IconShoppingCartPlus size={19} />
                    {t("tables.take_order_add_items", "+ Take Order / Add Items")}
                  </span>
                  <span className="text-xs font-semibold bg-emerald-700 px-2 py-0.5 rounded-lg opacity-90">
                    POS →
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onNewOrder("take_away", selectedTable)}
                    className="min-h-[42px] flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-700 text-xs font-bold transition active:scale-95 cursor-pointer"
                  >
                    <IconShoppingBag size={16} className="text-[#0ea5e9]" />
                    <span>{t("orders.take_away", "Take Away")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNewOrder("delivery", selectedTable)}
                    className="min-h-[42px] flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-700 text-xs font-bold transition active:scale-95 cursor-pointer"
                  >
                    <IconTruckDelivery size={16} className="text-[#0ea5e9]" />
                    <span>{t("orders.delivery", "Delivery")}</span>
                  </button>
                </div>
              </div>
            )}

            {renderTableManagementCard()}
          </div>
        )}
      </div>
    </aside>
  );
}
