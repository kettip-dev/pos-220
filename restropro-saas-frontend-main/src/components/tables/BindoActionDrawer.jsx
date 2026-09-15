import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IconX,
  IconArrowsExchange,
  IconLink,
  IconUnlink,
  IconArrowsLeftRight,
  IconReceiptTax,
  IconToolsKitchen2,
  IconShoppingBag,
  IconTruckDelivery,
  IconCalendarEvent,
  IconPrinter,
  IconSearch,
  IconChevronDown,
  IconChevronRight,
  IconUser,
  IconPhone,
  IconUsers,
  IconCheck,
  IconPencil,
} from "@tabler/icons-react";

export default function BindoActionDrawer({
  isOpen = true,
  onClose = () => {},
  activeTab = "actions", // "actions" | "list"
  onTabChange = () => {},
  selectedTable = null,
  isMergeMode = false,
  onToggleMergeMode = () => {},
  onMoveTable = () => {},
  onSplitChecks = () => {},
  onMoveLineItem = () => {},
  onNewOrder = () => {}, // (orderType: "dine_in" | "take_away" | "delivery", table)
  onEditTable = () => {},
  onReservationOverview = () => {},
  onPrintReservation = () => {},
  // Table list & reservations data
  reservations = [],
  queueList = [],
  seatedTables = [],
  pendingOrders = [],
  onSeatReservation = () => {},
  currency = "$",
}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [openSections, setOpenSections] = useState({
    queue: false,
    reserved: true,
    seated: false,
    pending: false,
  });

  if (!isOpen) return null;

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredReservations = reservations.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.customer_name || "").toLowerCase().includes(q) ||
      (r.customer_phone || "").includes(q) ||
      (r.notes || "").toLowerCase().includes(q)
    );
  });

  return (
    <aside className="w-80 md:w-96 h-full bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col shrink-0 select-none z-30 transition-all">
      {/* Header with Mode Tabs & Close (X) button */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl">
          <button
            type="button"
            onClick={() => onTabChange("actions")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === "actions"
                ? "bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            {t("tables.floor_plan_actions", "Floor Plan Actions")}
          </button>
          <button
            type="button"
            onClick={() => onTabChange("list")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === "list"
                ? "bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            {t("tables.table_list", "Table List")}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
        >
          <IconX size={18} />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeTab === "actions" ? (
          /* ================= VIEW A: FLOOR PLAN ACTIONS ================= */
          <>
            {/* Selected Table Snapshot (if a table is picked) */}
            {selectedTable ? (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-slate-900 dark:text-white">
                      {t("tables.table", "Table")} {selectedTable.table_title}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-300">
                      {selectedTable.seating_capacity || 2} {t("tables.seats", "Seats")}
                    </span>
                  </div>
                  {selectedTable.customer_name && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedTable.customer_name}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {selectedTable.active_order_total && (
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">{t("orders.total", "Total")}</span>
                      <span className="text-base font-black text-[#0ea5e9]">
                        {currency}{Number(selectedTable.active_order_total).toFixed(2)}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onEditTable(selectedTable)}
                    title={t("table_settings.update_table", "Edit Table")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-700 text-xs font-bold shadow-2xs transition active:scale-95 cursor-pointer"
                  >
                    <IconPencil size={14} />
                    <span>{t("common.edit", "Edit")}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-dashed border-slate-200 dark:border-zinc-700 text-center text-xs text-slate-400">
                {t("tables.tap_table_hint", "Tap any table on the canvas to execute table-specific actions")}
              </div>
            )}

            {/* Section: Quick Action (2x2 Grid) */}
            <div>
              <h4 className="text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500 mb-2.5">
                {t("tables.quick_action", "Quick Action")}
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => onMoveTable(selectedTable)}
                  className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/50 dark:bg-sky-950/20 text-[#0284c7] dark:text-sky-300 font-bold text-xs hover:bg-sky-100/70 dark:hover:bg-sky-900/40 transition cursor-pointer"
                >
                  <IconArrowsExchange size={20} />
                  <span>{t("tables.move_table", "Move Table")}</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleMergeMode}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border font-bold text-xs transition cursor-pointer ${
                    isMergeMode
                      ? "border-amber-500 bg-amber-500 text-white shadow-md animate-pulse"
                      : "border-sky-200 dark:border-sky-900/60 bg-sky-50/50 dark:bg-sky-950/20 text-[#0284c7] dark:text-sky-300 hover:bg-sky-100/70 dark:hover:bg-sky-900/40"
                  }`}
                >
                  {isMergeMode ? <IconUnlink size={20} /> : <IconLink size={20} />}
                  <span>{isMergeMode ? t("tables.exit_merge", "Exit Merge") : t("tables.merge_table", "Merge Table")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onMoveLineItem(selectedTable)}
                  className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/50 dark:bg-sky-950/20 text-[#0284c7] dark:text-sky-300 font-bold text-xs hover:bg-sky-100/70 dark:hover:bg-sky-900/40 transition cursor-pointer"
                >
                  <IconArrowsLeftRight size={20} />
                  <span>{t("tables.move_line_item", "Move Line Item")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSplitChecks(selectedTable)}
                  className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/50 dark:bg-sky-950/20 text-[#0284c7] dark:text-sky-300 font-bold text-xs hover:bg-sky-100/70 dark:hover:bg-sky-900/40 transition cursor-pointer"
                >
                  <IconReceiptTax size={20} />
                  <span>{t("tables.split_checks", "Split Checks")}</span>
                </button>
              </div>
            </div>

            {/* Section: New Order (3 Full Width Action Buttons) */}
            <div>
              <h4 className="text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500 mb-2.5">
                {t("tables.new_order", "New Order")}
              </h4>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onNewOrder("dine_in", selectedTable)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold text-sm shadow-xs transition active:scale-98 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <IconToolsKitchen2 size={18} />
                    {t("orders.dine_in", "Dine-in")}
                  </span>
                  <span className="text-xs opacity-80">→</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNewOrder("take_away", selectedTable)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold text-sm shadow-xs transition active:scale-98 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <IconShoppingBag size={18} />
                    {t("orders.take_away", "Take Away")}
                  </span>
                  <span className="text-xs opacity-80">→</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNewOrder("delivery", selectedTable)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold text-sm shadow-xs transition active:scale-98 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <IconTruckDelivery size={18} />
                    {t("orders.delivery", "Delivery")}
                  </span>
                  <span className="text-xs opacity-80">→</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* ================= VIEW B: TABLE LIST & RESERVATIONS ================= */
          <>
            {/* Search Input */}
            <div className="relative">
              <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("common.search", "Search guest or table...")}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs text-slate-800 dark:text-white outline-none focus:border-[#0ea5e9]"
              />
            </div>

            {/* Accordion 1: Queueing */}
            <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection("queue")}
                className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800/60 font-bold text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {openSections.queue ? <IconChevronDown size={15} /> : <IconChevronRight size={15} />}
                  <span>{t("tables.queueing", "Queueing")}</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-400">
                  {queueList.length} guests
                </span>
              </button>
              {openSections.queue && (
                <div className="p-3 bg-white dark:bg-zinc-900 divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
                  {queueList.length === 0 ? (
                    <p className="text-slate-400 text-center py-2 text-[11px]">
                      {t("tables.no_queue", "No guests in queue")}
                    </p>
                  ) : (
                    queueList.map((item, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-100">{item.name}</p>
                          <p className="text-[10px] text-slate-400">{item.party_size} pax • {item.wait_time}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSeatReservation(item)}
                          className="px-2.5 py-1 rounded-lg bg-[#0ea5e9] text-white font-bold text-[10px]"
                        >
                          {t("tables.seat", "Seat")}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Accordion 2: Reserved (with Guest Cards from image) */}
            <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection("reserved")}
                className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800/60 font-bold text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {openSections.reserved ? <IconChevronDown size={15} /> : <IconChevronRight size={15} />}
                  <span>{t("tables.reserved", "Reserved")}</span>
                </div>
                <span className="text-[11px] font-semibold text-[#0ea5e9]">
                  {filteredReservations.length} {t("tables.reservations", "bookings")}
                </span>
              </button>

              {openSections.reserved && (
                <div className="p-2 space-y-2 bg-slate-50/50 dark:bg-zinc-900/50">
                  {filteredReservations.length === 0 ? (
                    <p className="text-slate-400 text-center py-4 text-xs">
                      {t("tables.no_reservations_today", "No active reservations")}
                    </p>
                  ) : (
                    filteredReservations.map((res) => (
                      <div
                        key={res.id}
                        className="p-3 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 shadow-2xs space-y-1.5"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-100 block">
                              {res.customer_name || t("common.guest", "Guest")}
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <IconUsers size={11} /> {res.people_count || 2} {t("tables.pax", "pax")}
                              {res.customer_phone && ` • ${res.customer_phone}`}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                            {res.reservation_time || "Today"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-zinc-700/60">
                          <span className="text-[10px] font-semibold text-slate-500">
                            {res.table_title ? `Table ${res.table_title}` : t("tables.unassigned", "Unassigned")}
                          </span>
                          <button
                            type="button"
                            onClick={() => onSeatReservation(res)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold text-[10px] transition cursor-pointer"
                          >
                            <IconCheck size={12} />
                            <span>{t("tables.seat_now", "Seat Now")}</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Accordion 3: Seated Tables */}
            <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection("seated")}
                className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800/60 font-bold text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {openSections.seated ? <IconChevronDown size={15} /> : <IconChevronRight size={15} />}
                  <span>{t("tables.seated_tables", "Seated Tables")}</span>
                </div>
                <span className="text-[11px] font-semibold text-emerald-600">
                  {seatedTables.length} {t("tables.active", "active")}
                </span>
              </button>
              {openSections.seated && (
                <div className="p-3 bg-white dark:bg-zinc-900 divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
                  {seatedTables.length === 0 ? (
                    <p className="text-slate-400 text-center py-2 text-[11px]">
                      {t("tables.no_seated", "No tables currently seated")}
                    </p>
                  ) : (
                    seatedTables.map((tbl) => (
                      <div key={tbl.id} className="py-2 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-100">
                            {t("tables.table", "Table")} {tbl.table_title}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {tbl.customer_name || "Dine-in"} • {tbl.seating_capacity || 2} seats
                          </p>
                        </div>
                        {tbl.active_order_total && (
                          <span className="font-bold text-slate-900 dark:text-white">
                            {currency}{Number(tbl.active_order_total).toFixed(2)}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
