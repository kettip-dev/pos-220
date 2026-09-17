import React from "react";
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
} from "@tabler/icons-react";
import moment from "moment";

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
}) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const isOccupied = Boolean(selectedTable?.active_order_id);

  return (
    <aside className="w-80 md:w-96 h-full bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col shrink-0 select-none z-30 transition-all">
      {/* 1. Unified Top Header (No duplicate table card) */}
      <div className="px-4 py-3.5 border-b border-slate-200 dark:border-zinc-800 shrink-0 bg-slate-50/70 dark:bg-zinc-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
              isOccupied
                ? "bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300"
                : "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {selectedTable?.table_title || <IconArmchair size={18} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                {selectedTable
                  ? `${t("tables.table", "Table")} ${selectedTable.table_title}`
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
            <p className="text-[11px] text-slate-400">
              {selectedTable
                ? `${selectedTable.seating_capacity || 2} ${t("tables.seats", "Seats")} • Floor ${selectedTable.floor}`
                : t("tables.floor_plan_management", "Floor Plan Management")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedTable && (
            <button
              type="button"
              onClick={() => onEditTable(selectedTable)}
              title={t("table_settings.update_table", "Edit Table")}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <IconPencil size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <IconX size={18} />
          </button>
        </div>
      </div>

      {/* 2. Drawer Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {selectedTable ? (
          <div className="space-y-3.5">
            {/* Customer Management Card */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-750 shadow-2xs flex items-center justify-between">
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
                className="px-2.5 py-1.5 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/30 text-[#0284c7] dark:text-sky-300 hover:bg-sky-100/70 text-xs font-bold transition active:scale-95 cursor-pointer shrink-0"
              >
                {selectedTable?.customer_name ? t("common.change", "Change") : t("customers.assign", "+ Assign")}
              </button>
            </div>

            {/* OCCUPIED TABLE: ACTIVE ORDER BREAKDOWN + ACTIONS */}
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
                        {moment(selectedTable.active_order_date).fromNow()}
                      </span>
                    )}
                  </div>

                  {/* Itemized Order List with Void/Delete buttons */}
                  <div className="border-t border-slate-100 dark:border-zinc-800 pt-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {t("tables.ordered_items", "Ordered Items")}
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold">
                        {(activeOrderSummary?.orders?.[0]?.items || []).reduce((acc, i) => acc + Number(i.quantity), 0) || selectedTable.order_items_count || 0} {t("tables.items", "items")}
                      </span>
                    </div>

                    {isLoadingOrderSummary ? (
                      <div className="py-4 flex items-center justify-center gap-2 text-xs text-slate-400">
                        <div className="w-4 h-4 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin"></div>
                        <span>{t("common.loading", "Loading items...")}</span>
                      </div>
                    ) : activeOrderSummary?.orders?.length > 0 ? (
                      <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 text-xs">
                        {(activeOrderSummary.orders || []).flatMap((ord) => ord.items || []).map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-zinc-800/60 last:border-0 gap-2"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-800 dark:text-slate-100">
                                  {item.quantity}x {item.title}
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
                                  +{item.addons.map((a) => a.title).join(", ")}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {currency}{(Number(item.price) * Number(item.quantity)).toFixed(2)}
                              </span>
                              {/* Void Item Button */}
                              <button
                                type="button"
                                onClick={() => onVoidItem(item)}
                                title={t("orders.void_item", "Void / Cancel item")}
                                className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                              >
                                <IconTrash size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
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
                        {currency}
                        {Number(
                          activeOrderSummary?.total ||
                            selectedTable.active_order_total ||
                            selectedTable.order_total ||
                            0
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* PRIMARY ACTION BUTTONS: Add Items + Pay */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onAddMenuItems(selectedTable)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md hover:shadow-lg transition active:scale-98 cursor-pointer"
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
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-black text-sm shadow-md hover:shadow-lg transition active:scale-98 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <IconCash size={18} />
                      {t("tables.settle_bill", "Pay / Settle Bill")}
                    </span>
                    <span className="text-xs font-semibold bg-sky-700 px-2 py-0.5 rounded-lg opacity-90">
                      Pay Now
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              /* AVAILABLE TABLE: TAKE ORDER ACTION */
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => onAddMenuItems(selectedTable)}
                  className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md hover:shadow-lg transition active:scale-98 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <IconShoppingCartPlus size={19} />
                    {t("tables.take_order_add_items", "+ Take Order / Add Items")}
                  </span>
                  <span className="text-xs font-semibold bg-emerald-700 px-2 py-0.5 rounded-lg opacity-90">
                    POS →
                  </span>
                </button>

                {/* Quick New Order Options */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onNewOrder("take_away", selectedTable)}
                    className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-700 text-xs font-bold transition cursor-pointer"
                  >
                    <IconShoppingBag size={16} className="text-[#0ea5e9]" />
                    <span>{t("orders.take_away", "Take Away")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNewOrder("delivery", selectedTable)}
                    className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-700 text-xs font-bold transition cursor-pointer"
                  >
                    <IconTruckDelivery size={16} className="text-[#0ea5e9]" />
                    <span>{t("orders.delivery", "Delivery")}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Table Management Utilities (Move, Merge, Split, Move Item) */}
            <div className="pt-2 border-t border-slate-200/70 dark:border-zinc-800">
              <h4 className="text-[11px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500 mb-2">
                {t("tables.table_management", "Table Management")}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onMoveTable(selectedTable)}
                  className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 text-slate-700 dark:text-slate-200 font-bold text-xs hover:border-[#0ea5e9] transition cursor-pointer shadow-2xs"
                >
                  <IconArrowsExchange size={18} className="text-[#0ea5e9]" />
                  <span>{t("tables.move_table", "Move Table")}</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleMergeMode}
                  className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border font-bold text-xs transition cursor-pointer shadow-2xs ${
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
                  className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 text-slate-700 dark:text-slate-200 font-bold text-xs hover:border-[#0ea5e9] transition cursor-pointer shadow-2xs"
                >
                  <IconArrowsLeftRight size={18} className="text-purple-500" />
                  <span>{t("tables.move_line_item", "Move Item")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSplitChecks(selectedTable)}
                  className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 text-slate-700 dark:text-slate-200 font-bold text-xs hover:border-[#0ea5e9] transition cursor-pointer shadow-2xs"
                >
                  <IconReceiptTax size={18} className="text-emerald-500" />
                  <span>{t("tables.split_checks", "Split Checks")}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-dashed border-slate-200 dark:border-zinc-700 text-center text-xs text-slate-400 space-y-2 mt-4">
            <IconArmchair size={28} className="mx-auto text-slate-300 dark:text-zinc-600" />
            <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">
              {t("tables.no_table_selected", "No Table Selected")}
            </p>
            <p className="text-slate-400 max-w-xs mx-auto">
              {t("tables.tap_table_hint", "Tap any table on the canvas to view order details, add menu items, or settle payment.")}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
