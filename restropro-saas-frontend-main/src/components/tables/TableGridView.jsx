import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  IconArmchair,
  IconClock,
  IconSearch,
  IconX,
  IconPlus,
  IconReceipt2,
  IconCreditCard,
  IconDotsVertical,
  IconArrowsExchange,
  IconUser,
  IconCheck,
  IconAlertTriangle,
  IconCalendarEvent,
  IconFilter,
  IconSortAscending,
} from "@tabler/icons-react";
import {
  getTableBindoStatus,
  formatElapsedOrderTime,
} from "./BindoTableNode";

// ─────────────────────────────────────────────────────────────
// Status Presentation Metadata (Modern POS standard)
// ─────────────────────────────────────────────────────────────
const STATUS_METADATA = {
  available: {
    label: "FREE",
    badgeCls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    dotCls: "bg-emerald-500",
    cardCls: "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-emerald-400 dark:hover:border-emerald-500/60 hover:shadow-md",
    titleCls: "text-slate-800 dark:text-zinc-100",
  },
  seated: {
    label: "SEATED",
    badgeCls: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
    dotCls: "bg-sky-500",
    cardCls: "bg-gradient-to-b from-sky-50/60 via-white to-white dark:from-sky-950/30 dark:via-zinc-900 dark:to-zinc-900 border-sky-300 dark:border-sky-700 shadow-sm hover:shadow-lg",
    titleCls: "text-sky-950 dark:text-sky-200",
  },
  ordered: {
    label: "ORDERED",
    badgeCls: "bg-indigo-600 text-white border-transparent shadow-xs",
    dotCls: "bg-white",
    cardCls: "bg-gradient-to-b from-indigo-50/70 via-white to-white dark:from-indigo-950/40 dark:via-zinc-900 dark:to-zinc-900 border-indigo-300 dark:border-indigo-600 shadow-sm hover:shadow-xl hover:border-indigo-500",
    titleCls: "text-indigo-950 dark:text-indigo-100",
  },
  ck_dropped: {
    label: "BILL REQ",
    badgeCls: "bg-amber-500 text-white border-transparent shadow-xs",
    dotCls: "bg-white",
    cardCls: "bg-gradient-to-b from-amber-50/80 via-white to-white dark:from-amber-950/40 dark:via-zinc-900 dark:to-zinc-900 border-amber-400 dark:border-amber-500 shadow-md hover:shadow-xl",
    titleCls: "text-amber-950 dark:text-amber-200",
  },
  paid: {
    label: "PAID",
    badgeCls: "bg-emerald-600 text-white border-transparent shadow-xs",
    dotCls: "bg-white",
    cardCls: "bg-gradient-to-b from-emerald-50/60 via-white to-white dark:from-emerald-950/30 dark:via-zinc-900 dark:to-zinc-900 border-emerald-400 dark:border-emerald-600 shadow-sm hover:shadow-lg",
    titleCls: "text-emerald-950 dark:text-emerald-200",
  },
  unsent: {
    label: "UNSENT",
    badgeCls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700",
    dotCls: "bg-amber-500",
    cardCls: "bg-gradient-to-b from-amber-50/50 via-white to-white dark:from-amber-950/30 dark:via-zinc-900 dark:to-zinc-900 border-amber-300 dark:border-amber-700",
    titleCls: "text-amber-950 dark:text-amber-200",
  },
  alert: {
    label: "ALERT",
    badgeCls: "bg-fuchsia-600 text-white border-transparent shadow-xs",
    dotCls: "bg-white",
    cardCls: "bg-gradient-to-b from-fuchsia-50/60 via-white to-white dark:from-fuchsia-950/30 dark:via-zinc-900 dark:to-zinc-900 border-fuchsia-400 dark:border-fuchsia-600",
    titleCls: "text-fuchsia-950 dark:text-fuchsia-200",
  },
  over_time: {
    label: "OVERTIME",
    badgeCls: "bg-rose-600 text-white border-transparent shadow-xs",
    dotCls: "bg-white",
    cardCls: "bg-gradient-to-b from-rose-50/60 via-white to-white dark:from-rose-950/30 dark:via-zinc-900 dark:to-zinc-900 border-rose-400 dark:border-rose-600 shadow-md",
    titleCls: "text-rose-950 dark:text-rose-200",
  },
  reserved: {
    label: "RESERVED",
    badgeCls: "bg-purple-600 text-white border-transparent shadow-xs",
    dotCls: "bg-white",
    cardCls: "bg-gradient-to-b from-purple-50/60 via-white to-white dark:from-purple-950/30 dark:via-zinc-900 dark:to-zinc-900 border-purple-300 dark:border-purple-600",
    titleCls: "text-purple-950 dark:text-purple-200",
  },
  multiple: {
    label: "MULTI",
    badgeCls: "bg-pink-600 text-white border-transparent shadow-xs",
    dotCls: "bg-white",
    cardCls: "bg-pink-50/40 dark:bg-pink-950/20 border-pink-300 dark:border-pink-600",
    titleCls: "text-pink-950 dark:text-pink-200",
  },
  blocked: {
    label: "BLOCKED",
    badgeCls: "bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
    dotCls: "bg-zinc-500",
    cardCls: "bg-zinc-100/80 dark:bg-zinc-900/40 border-zinc-300 dark:border-zinc-800 opacity-60",
    titleCls: "text-zinc-600 dark:text-zinc-400",
  },
};

// ─────────────────────────────────────────────────────────────
// Tablet-Native Elevated Table Card
// ─────────────────────────────────────────────────────────────
function TableCard({
  table,
  isSelected,
  currency = "$",
  onTableClick,
  onNewOrder,
  onPayTable,
  onMoveTable,
}) {
  const { t } = useTranslation();
  const statusKey = getTableBindoStatus(table);
  const meta = STATUS_METADATA[statusKey] || STATUS_METADATA.available;
  const isOccupied = Boolean(table.active_order_id);
  const elapsed = isOccupied ? formatElapsedOrderTime(table.active_order_date) : null;
  const hasItems = Number(table.order_items_count || 0) > 0;
  const seatingCap = table.seating_capacity || 2;

  const isSplitInProgress = (table.active_split_status || table.split_status) === "split_in_progress";
  const formattedAmount = useMemo(() => {
    const rawNum = isSplitInProgress && Number(table.split_remaining_payable) > 0
      ? Number(table.split_remaining_payable)
      : table.active_order_total != null
      ? Number(table.active_order_total)
      : null;
    if (rawNum == null) return null;
    const num = Number(rawNum);
    if (Number.isNaN(num)) return null;
    return `${currency} ${num.toLocaleString(undefined, {
      minimumFractionDigits: num % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  }, [table.active_order_total, table.split_remaining_payable, isSplitInProgress, currency]);

  return (
    <div
      onClick={() => onTableClick(table)}
      className={`
        relative group flex flex-col justify-between
        rounded-2xl border-2 p-3.5 transition-all duration-150
        cursor-pointer select-none text-left min-h-[148px]
        ${meta.cardCls}
        ${
          isSelected
            ? "ring-2 ring-[#0ea5e9] shadow-xl scale-[1.01] border-[#0ea5e9]"
            : "hover:-translate-y-0.5"
        }
      `}
    >
      {/* ── Top Header: Table Title + Capacity + Status Badge ── */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          {/* Table Title & Seating */}
          <div className="min-w-0">
            <h3 className={`text-xl font-black tracking-tight leading-tight truncate ${meta.titleCls}`}>
              {table.table_title}
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-zinc-400 mt-0.5">
              <IconArmchair size={13} className="shrink-0" />
              <span>{seatingCap} {t("tables.seats", "seats")}</span>
            </span>
          </div>

          {/* Status Badge + Live dot */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={`
                inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider
                px-2 py-0.5 rounded-full border ${meta.badgeCls}
              `}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${meta.dotCls} ${
                  isOccupied ? "animate-pulse" : ""
                }`}
              />
              <span>{meta.label}</span>
            </span>

            {/* Live Elapsed Timer */}
            {elapsed && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-zinc-400 bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded-md">
                <IconClock size={11} className="shrink-0" />
                <span>{elapsed}</span>
              </span>
            )}
          </div>
        </div>

        {/* ── Middle Info: Order details / Guest / Amount ── */}
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
          {isOccupied ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600 dark:text-zinc-300 truncate max-w-[120px]">
                  {table.active_order_token ? `#${table.active_order_token}` : t("pos.dinein", "Dine-in")}
                  {table.customer_name ? ` • ${table.customer_name}` : ""}
                </span>
                {hasItems && (
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                    {table.order_items_count} {t("tables.items", "items")}
                  </span>
                )}
              </div>

              {formattedAmount && (
                <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  {formattedAmount}
                </div>
              )}
            </div>
          ) : (
            <div className="py-1 text-xs font-medium text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
              <span>{t("tables.ready_for_guests", "Ready for guests")}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Quick Action Row (Tablet-native touch targets >= 42px) ── */}
      <div className="mt-3 pt-2">
        {isOccupied ? (
          <div className="grid grid-cols-4 gap-1.5">
            {/* Primary Action: Settle / Pay Bill */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isSplitInProgress) {
                  if (onSplitChecks) onSplitChecks(table);
                } else {
                  if (onPayTable) onPayTable(table);
                }
              }}
              title={isSplitInProgress ? t("tables.settle_split", "Settle Split Checks") : t("tables.settle_bill", "Settle Bill")}
              className={`
                col-span-3 min-h-[42px] px-3 rounded-xl font-bold text-xs
                flex items-center justify-center gap-1.5 text-white transition-all
                cursor-pointer active:scale-95 shadow-xs
                ${
                  isSplitInProgress
                    ? "bg-purple-600 hover:bg-purple-700"
                    : statusKey === "ck_dropped"
                    ? "bg-amber-500 hover:bg-amber-600"
                    : statusKey === "paid"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }
              `}
            >
              <IconCreditCard size={15} />
              <span>
                {isSplitInProgress
                  ? `${t("tables.split_badge", "Split")} (${table.split_paid_checks || 0}/${table.split_total_checks || 2})`
                  : statusKey === "paid"
                  ? t("tables.paid", "Paid")
                  : statusKey === "ck_dropped"
                  ? t("tables.pay_bill", "Pay Bill")
                  : t("tables.pay_order", "Pay / Settle")}
              </span>
            </button>

            {/* Quick Drawer trigger */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTableClick(table);
              }}
              title={t("tables.more_actions", "More Actions")}
              className="col-span-1 min-h-[42px] rounded-xl font-bold text-slate-600 dark:text-zinc-300 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-all flex items-center justify-center cursor-pointer active:scale-95 border border-slate-200 dark:border-zinc-700"
            >
              <IconDotsVertical size={16} />
            </button>
          </div>
        ) : (
          /* Available Table: 1-Tap "+ New Order" Button */
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onNewOrder) onNewOrder(table);
              else onTableClick(table);
            }}
            className="w-full min-h-[42px] px-3 rounded-xl font-black text-xs bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-950/40 dark:hover:bg-emerald-600 dark:text-emerald-300 dark:hover:text-white border border-emerald-200 dark:border-emerald-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
          >
            <IconPlus size={15} />
            <span>{t("tables.new_order", "+ New Order")}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Grid View Component
// ─────────────────────────────────────────────────────────────
export default function TableGridView({
  tables = [],
  zones = [],
  currentFloor = "0",
  currency = "$",
  selectedTableId = null,
  activeFilter = null,
  onSelectFilter = () => {},
  onSelectZone = () => {},
  onTableClick = () => {},
  onNewOrder = () => {},
  onPayTable = () => {},
  onMoveTable = () => {},
  onSplitChecks = () => {},
  onRefresh,
  isRefreshing = false,
  isSocketConnected = true,
  dineInCount = 0,
  pickUpCount = 0,
}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "available" | "ordered" | "ck_dropped" | "paid"
  const [sortBy, setSortBy] = useState("name"); // "name" | "status" | "amount"

  const normalizeFloor = (f) => {
    if (f === null || f === undefined) return "";
    return String(f)
      .trim()
      .replace(/[០-៩]/g, (d) => "0123456789"["០១២៣៤៥៦៧៨៩".indexOf(d)]);
  };

  // Tables on the current zone
  const tablesOnFloor = useMemo(() => {
    return tables.filter(
      (t) => normalizeFloor(t.floor) === normalizeFloor(currentFloor)
    );
  }, [tables, currentFloor]);

  // Status statistics for this zone
  const stats = useMemo(() => {
    let free = 0;
    let ordered = 0;
    let ck_dropped = 0;
    let paid = 0;
    let totalSales = 0;

    tablesOnFloor.forEach((tbl) => {
      const st = getTableBindoStatus(tbl);
      if (st === "available") free++;
      else if (st === "ordered" || st === "seated") ordered++;
      else if (st === "ck_dropped") ck_dropped++;
      else if (st === "paid") paid++;

      if (tbl.active_order_total) {
        totalSales += Number(tbl.active_order_total) || 0;
      }
    });

    const occupied = tablesOnFloor.length - free;
    const occPct = tablesOnFloor.length > 0 ? Math.round((occupied / tablesOnFloor.length) * 100) : 0;

    return {
      total: tablesOnFloor.length,
      free,
      occupied,
      ordered,
      ck_dropped,
      paid,
      totalSales,
      occPct,
    };
  }, [tablesOnFloor]);

  // Sync external bottom bar activeFilter if set
  const effectiveFilter = activeFilter || statusFilter;

  // Filtered & Sorted tables
  const displayedTables = useMemo(() => {
    let list = [...tablesOnFloor];

    // Status filter
    if (effectiveFilter && effectiveFilter !== "all") {
      list = list.filter((tbl) => {
        const st = getTableBindoStatus(tbl);
        if (effectiveFilter === "available") return st === "available";
        if (effectiveFilter === "occupied") return Boolean(tbl.active_order_id);
        if (effectiveFilter === "ordered") return st === "ordered" || st === "seated";
        if (effectiveFilter === "ck_dropped") return st === "ck_dropped";
        if (effectiveFilter === "attention") return Boolean(tbl.is_over_time || tbl.is_alert);
        if (effectiveFilter === "paid") return st === "paid";
        return st === effectiveFilter;
      });
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (tbl) =>
          String(tbl.table_title || "").toLowerCase().includes(q) ||
          String(tbl.active_order_token || "").toLowerCase().includes(q) ||
          String(tbl.customer_name || "").toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === "amount") {
        return (Number(b.active_order_total) || 0) - (Number(a.active_order_total) || 0);
      }
      if (sortBy === "status") {
        const orderWeight = { ordered: 1, ck_dropped: 2, seated: 3, paid: 4, available: 5 };
        const wa = orderWeight[getTableBindoStatus(a)] || 9;
        const wb = orderWeight[getTableBindoStatus(b)] || 9;
        return wa - wb;
      }
      // default: alphanumeric by table_title
      return String(a.table_title || "").localeCompare(
        String(b.table_title || ""),
        undefined,
        { numeric: true }
      );
    });

    return list;
  }, [tablesOnFloor, effectiveFilter, searchQuery, sortBy]);

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-slate-50 dark:bg-zinc-950 overflow-hidden">
      {/* ── POS Grid Operations & Filter Bar ───────────────────── */}
      <div className="px-4 py-3 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Search input + Quick Filter Chips */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative w-full sm:w-56 md:w-64">
              <IconSearch
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("tables.search_tables", "Search table # or name...")}
                className="w-full h-[42px] pl-9 pr-8 text-xs font-medium rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/80 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0ea5e9] focus:border-[#0ea5e9] transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-0.5 rounded cursor-pointer"
                >
                  <IconX size={14} />
                </button>
              )}
            </div>

            {/* Quick Status Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {[
                { key: "all", label: t("common.all", "All"), count: stats.total },
                { key: "available", label: t("tables.free", "Free"), count: stats.free, color: "text-emerald-600" },
                { key: "ordered", label: t("tables.ordered", "Ordered"), count: stats.ordered, color: "text-indigo-600" },
                { key: "ck_dropped", label: t("tables.ck_dropped", "Bill Req"), count: stats.ck_dropped, color: "text-amber-600" },
                { key: "paid", label: t("tables.paid", "Paid"), count: stats.paid, color: "text-teal-600" },
              ].map((chip) => {
                const isActive = (effectiveFilter || "all") === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => {
                      setStatusFilter(chip.key);
                      onSelectFilter(chip.key === "all" ? null : chip.key);
                    }}
                    className={`
                      h-[42px] px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap
                      flex items-center gap-1.5 cursor-pointer select-none border
                      ${
                        isActive
                          ? "bg-slate-900 text-white dark:bg-white dark:text-zinc-950 border-slate-900 dark:border-white shadow-xs"
                          : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/60 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700/60"
                      }
                    `}
                  >
                    <span>{chip.label}</span>
                    <span
                      className={`
                        text-[10px] font-black px-1.5 py-0.5 rounded-full
                        ${
                          isActive
                            ? "bg-white/20 text-white dark:bg-black/20 dark:text-black"
                            : "bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400"
                        }
                      `}
                    >
                      {chip.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Live Occupancy & Financial KPI pill */}
          <div className="flex items-center gap-2 text-xs font-bold shrink-0">
            {/* Occupancy pill */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>
                {stats.occupied}/{stats.total} {t("tables.occupied", "Occupied")} ({stats.occPct}%)
              </span>
            </div>

            {/* Total Active Sales pill */}
            {stats.totalSales > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
                <IconReceipt2 size={15} />
                <span>
                  {currency} {stats.totalSales.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {/* Sort Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-zinc-700">
              {[
                { key: "name", label: t("tables.sort_num", "#") },
                { key: "status", label: t("tables.sort_status", "Status") },
                { key: "amount", label: t("tables.sort_amount", "$$") },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSortBy(opt.key)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    sortBy === opt.key
                      ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs"
                      : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Responsive Card Grid ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {displayedTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-16">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 dark:text-zinc-500">
              <IconArmchair size={36} />
            </div>
            <div>
              <p className="text-slate-800 dark:text-zinc-200 font-bold text-base">
                {searchQuery || effectiveFilter !== "all"
                  ? t("tables.no_matching_tables", "No tables match current filters")
                  : t("tables.no_tables_on_zone", "No tables on this zone")}
              </p>
              <p className="text-slate-400 dark:text-zinc-500 text-xs mt-1">
                {searchQuery || effectiveFilter !== "all"
                  ? t("tables.try_clear_filter", "Try clearing search keywords or status filter")
                  : t("tables.add_tables_from_canvas", "Switch to Floor Plan view to add or configure tables")}
              </p>
            </div>
            {(searchQuery || (effectiveFilter && effectiveFilter !== "all")) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  onSelectFilter(null);
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-200 transition cursor-pointer"
              >
                {t("tables.clear_filters", "Clear Filters")}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3.5 md:gap-4">
            {displayedTables.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                isSelected={selectedTableId === table.id}
                currency={currency}
                onTableClick={onTableClick}
                onNewOrder={onNewOrder}
                onPayTable={onPayTable}
                onMoveTable={onMoveTable}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
