import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  IconX,
  IconSearch,
  IconArmchair,
  IconClock,
  IconUser,
  IconToolsKitchen2,
  IconLayoutGrid,
  IconCircle,
  IconSquare,
  IconRectangle,
  IconReceipt2,
} from "@tabler/icons-react";
import { BINDO_STATUS_CONFIG, getTableBindoStatus } from "./BindoTableNode";

export default function AllTablesCardsModal({
  isOpen,
  onClose,
  tables = [],
  zones = [],
  currentFloor = "0",
  onSelectTable = () => {},
  onNewOrder = () => {},
  currency = "$",
}) {
  const { t } = useTranslation();

  const [selectedFloorFilter, setSelectedFloorFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const formatZoneLabel = (zone) => {
    const s = String(zone).trim();
    if (/^(zone|floor)\b/i.test(s)) return s;
    return `${t("tables.zone", "Zone")} ${s}`;
  };

  // Filtered tables list
  const filteredTables = useMemo(() => {
    return tables.filter((table) => {
      // Floor filter
      if (selectedFloorFilter !== "all" && String(table.floor) !== String(selectedFloorFilter)) {
        return false;
      }

      const statusKey = getTableBindoStatus(table);

      // Status filter
      if (selectedStatusFilter === "available" && statusKey !== "available") {
        return false;
      }
      if (selectedStatusFilter === "occupied" && statusKey === "available") {
        return false;
      }
      if (
        selectedStatusFilter !== "all" &&
        selectedStatusFilter !== "available" &&
        selectedStatusFilter !== "occupied" &&
        statusKey !== selectedStatusFilter
      ) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = String(table.table_title || "").toLowerCase().includes(q);
        const guestMatch = String(table.customer_name || "").toLowerCase().includes(q);
        const orderMatch = String(table.active_order_id || "").includes(q);
        if (!titleMatch && !guestMatch && !orderMatch) return false;
      }

      return true;
    });
  }, [tables, selectedFloorFilter, selectedStatusFilter, searchQuery]);

  // Quick KPI summary counts across all tables
  const { totalCount, availableCount, occupiedCount, totalPax } = useMemo(() => {
    let avail = 0;
    let occ = 0;
    let pax = 0;
    tables.forEach((t) => {
      const isOcc = Boolean(t.active_order_id);
      if (isOcc) occ++;
      else avail++;
      pax += Number(t.seating_capacity || 2);
    });
    return {
      totalCount: tables.length,
      availableCount: avail,
      occupiedCount: occ,
      totalPax: pax,
    };
  }, [tables]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 animate-fade-in select-none">
      <div className="w-full max-w-5xl max-h-[92vh] bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-4 shrink-0 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-950/40 text-[#0284c7] flex items-center justify-center shrink-0">
              <IconLayoutGrid size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {t("tables.all_tables_overview", "All Tables Overview")}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-300">
                  {filteredTables.length} / {totalCount}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t("tables.click_table_to_manage", "Click any table card to view order or manage floor plan actions")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition cursor-pointer"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Filter Toolbar: Floor Tabs, Status Filters, & Search Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 space-y-3 bg-white dark:bg-zinc-900 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Floor Selection Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl">
              <button
                type="button"
                onClick={() => setSelectedFloorFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedFloorFilter === "all"
                    ? "bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {t("tables.all_floors", "All Floors")}
              </button>
              {zones.map((zone) => (
                <button
                  key={zone}
                  type="button"
                  onClick={() => setSelectedFloorFilter(String(zone))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    selectedFloorFilter === String(zone)
                      ? "bg-[#0ea5e9] text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {formatZoneLabel(zone)}
                </button>
              ))}
            </div>

            {/* Quick Search */}
            <div className="relative flex-1 sm:max-w-xs">
              <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("tables.search_table_or_guest", "Search table or guest...")}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/80 text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-[#0ea5e9] focus:outline-none transition"
              />
            </div>
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            {[
              { key: "all", label: t("common.all", "All Status"), count: tables.length },
              { key: "available", label: t("tables.available", "Available"), count: availableCount, bg: "bg-[#475569]" },
              { key: "occupied", label: t("tables.occupied", "Occupied"), count: occupiedCount, bg: "bg-[#0ea5e9]" },
              { key: "ordered", label: t("tables.ordered", "Ordered"), bg: "bg-[#1e293b]" },
              { key: "ck_dropped", label: t("tables.ck_dropped", "Check Dropped"), bg: "bg-[#f97316]" },
              { key: "paid", label: t("tables.paid", "Paid"), bg: "bg-[#4ade80]" },
            ].map((st) => {
              const isActive = selectedStatusFilter === st.key;
              return (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setSelectedStatusFilter(st.key)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                      : "bg-slate-100 dark:bg-zinc-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {st.bg && <span className={`w-2 h-2 rounded-full ${st.bg}`} />}
                  <span>{st.label}</span>
                  {st.count !== undefined && <span className="opacity-70 text-[11px]">({st.count})</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Card Grid Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {filteredTables.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <IconArmchair size={48} className="text-slate-300 dark:text-zinc-700 mb-2" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                {t("tables.no_tables_found", "No tables match your filter")}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedFloorFilter("all");
                  setSelectedStatusFilter("all");
                  setSearchQuery("");
                }}
                className="mt-3 text-xs font-bold text-[#0ea5e9] hover:underline cursor-pointer"
              >
                {t("tables.clear_filters", "Clear all filters")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredTables.map((table) => {
                const statusKey = getTableBindoStatus(table);
                const status = BINDO_STATUS_CONFIG[statusKey] || BINDO_STATUS_CONFIG.available;
                const isOccupied = Boolean(table.active_order_id);
                const timerText = table.elapsed_time || table.timer_badge || (isOccupied ? "-00:33" : null);

                let ShapeIcon = IconCircle;
                if (table.shape === "square") ShapeIcon = IconSquare;
                if (table.shape === "rectangle") ShapeIcon = IconRectangle;

                return (
                  <div
                    key={table.id}
                    onClick={() => onSelectTable(table)}
                    className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white dark:bg-zinc-800/80 border-2 border-slate-200 dark:border-zinc-700 hover:border-[#0ea5e9] dark:hover:border-[#0ea5e9] shadow-xs hover:shadow-xl transition-all duration-200 cursor-pointer hover:-translate-y-0.5 overflow-hidden"
                  >
                    {/* Top Stripe with Status Color */}
                    <div className={`absolute top-0 inset-x-0 h-1.5 ${status.bg}`} />

                    {/* Table Title, Floor Badge & Capacity */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mt-1">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                              {table.table_title}
                            </span>
                            <ShapeIcon size={14} className="text-slate-400" />
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            {formatZoneLabel(table.floor || "0")}
                          </span>
                        </div>

                        {/* Status Chip Badge */}
                        <div
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight shadow-xs ${status.bg} ${status.text}`}
                        >
                          {status.label}
                        </div>
                      </div>

                      {/* Seating Capacity */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 mt-2.5">
                        <IconArmchair size={15} className="text-slate-400" />
                        <span>
                          {table.seating_capacity || 2} {t("tables.seats", "Seats")}
                        </span>
                      </div>

                      {/* Active Order Details (if occupied) */}
                      {isOccupied ? (
                        <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 font-medium">
                              {t("orders.order", "Order")} #{table.active_order_id}
                            </span>
                            <span className="font-black text-sm text-[#0ea5e9]">
                              {currency}{Number(table.active_order_total || 0).toFixed(2)}
                            </span>
                          </div>

                          {table.customer_name && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400 truncate">
                              <IconUser size={13} className="shrink-0 text-slate-400" />
                              <span className="truncate">{table.customer_name}</span>
                            </div>
                          )}

                          {timerText && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                              <IconClock size={13} />
                              <span>{timerText}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-3 py-3 px-2 rounded-xl bg-slate-50/60 dark:bg-zinc-900/30 border border-dashed border-slate-200 dark:border-zinc-800 text-center">
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            ✓ {t("tables.ready_for_guests", "Ready for guests")}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Card Action Footer */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-700/60 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-400 group-hover:text-[#0ea5e9] transition flex items-center gap-1">
                        <span>{t("tables.view_table", "Manage Table")}</span>
                        <span>→</span>
                      </span>

                      {!isOccupied && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNewOrder("dine_in", table);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-[11px] font-bold shadow-xs transition active:scale-95 cursor-pointer"
                        >
                          + {t("orders.dine_in", "Dine-in")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Summary Bar */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/90 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-4">
            <span>
              {t("tables.total_tables", "Total Tables")}: <strong className="text-slate-900 dark:text-white">{totalCount}</strong>
            </span>
            <span>
              {t("tables.available", "Available")}: <strong className="text-emerald-600 dark:text-emerald-400">{availableCount}</strong>
            </span>
            <span>
              {t("tables.occupied", "Occupied")}: <strong className="text-[#0ea5e9]">{occupiedCount}</strong>
            </span>
            <span>
              {t("tables.pax", "Total Capacity")}: <strong className="text-slate-900 dark:text-white">{totalPax}p</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-300 font-bold transition cursor-pointer"
          >
            {t("common.close", "Close")}
          </button>
        </div>
      </div>
    </div>
  );
}
