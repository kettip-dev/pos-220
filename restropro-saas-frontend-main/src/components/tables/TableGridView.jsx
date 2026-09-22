import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  IconTableAlias,
  IconArmchair,
  IconReceipt2,
  IconClock,
  IconUser,
  IconPlus,
  IconRefresh,
} from "@tabler/icons-react";
import { BINDO_STATUS_CONFIG, getTableBindoStatus } from "./BindoTableNode";

// ─────────────────────────────────────────────────────────────
// Status → rich dark card style mapping (matches plan design)
// ─────────────────────────────────────────────────────────────
const GRID_STATUS_STYLE = {
  available: {
    card: "bg-[#1a2e1a] border-[#22c55e]/40 hover:border-[#22c55e]",
    num: "text-[#4ade80]",
    dot: "bg-[#22c55e]",
    label: "FREE",
    labelCls: "bg-[#22c55e]/20 text-[#4ade80]",
  },
  seated: {
    card: "bg-[#172135] border-[#0ea5e9]/40 hover:border-[#0ea5e9]",
    num: "text-[#38bdf8]",
    dot: "bg-[#0ea5e9]",
    label: "SEATED",
    labelCls: "bg-[#0ea5e9]/20 text-[#38bdf8]",
  },
  ordered: {
    card: "bg-[#0f1623] border-[#6366f1]/40 hover:border-[#6366f1]",
    num: "text-[#818cf8]",
    dot: "bg-[#6366f1]",
    label: "ORDERED",
    labelCls: "bg-[#6366f1]/20 text-[#818cf8]",
  },
  ck_dropped: {
    card: "bg-[#2a1500] border-[#f97316]/40 hover:border-[#f97316]",
    num: "text-[#fb923c]",
    dot: "bg-[#f97316]",
    label: "BILL REQ",
    labelCls: "bg-[#f97316]/20 text-[#fb923c]",
  },
  paid: {
    card: "bg-[#0d2010] border-[#22c55e]/40 hover:border-[#22c55e]",
    num: "text-[#4ade80]",
    dot: "bg-[#4ade80]",
    label: "PAID",
    labelCls: "bg-[#4ade80]/20 text-[#4ade80]",
  },
  unsent: {
    card: "bg-[#1e1a00] border-[#facc15]/40 hover:border-[#facc15]",
    num: "text-[#fde047]",
    dot: "bg-[#facc15]",
    label: "UNSENT",
    labelCls: "bg-[#facc15]/20 text-[#fde047]",
  },
  alert: {
    card: "bg-[#25062b] border-[#d946ef]/40 hover:border-[#d946ef]",
    num: "text-[#e879f9]",
    dot: "bg-[#d946ef]",
    label: "ALERT",
    labelCls: "bg-[#d946ef]/20 text-[#e879f9]",
  },
  over_time: {
    card: "bg-[#2e1010] border-[#ef4444]/40 hover:border-[#ef4444]",
    num: "text-[#f87171]",
    dot: "bg-[#ef4444]",
    label: "OVER TIME",
    labelCls: "bg-[#ef4444]/20 text-[#f87171]",
  },
  reserved: {
    card: "bg-[#1c0a2e] border-[#a855f7]/40 hover:border-[#a855f7]",
    num: "text-[#c084fc]",
    dot: "bg-[#a855f7]",
    label: "RESERVED",
    labelCls: "bg-[#a855f7]/20 text-[#c084fc]",
  },
  multiple: {
    card: "bg-[#2a0a1e] border-[#ec4899]/40 hover:border-[#ec4899]",
    num: "text-[#f472b6]",
    dot: "bg-[#ec4899]",
    label: "MULTI",
    labelCls: "bg-[#ec4899]/20 text-[#f472b6]",
  },
  blocked: {
    card: "bg-zinc-900 border-zinc-700/40 hover:border-zinc-600",
    num: "text-slate-400",
    dot: "bg-slate-500",
    label: "BLOCKED",
    labelCls: "bg-zinc-800 text-slate-400",
  },
};

function getStyle(statusKey) {
  return GRID_STATUS_STYLE[statusKey] || GRID_STATUS_STYLE.available;
}

// ─────────────────────────────────────────────────────────────
// Single table pill card
// ─────────────────────────────────────────────────────────────
function TablePill({ table, onTableClick }) {
  const statusKey = getTableBindoStatus(table);
  const style = getStyle(statusKey);
  const isOccupied = Boolean(table.active_order_id);

  return (
    <button
      type="button"
      onClick={() => onTableClick(table)}
      className={`
        relative flex flex-col items-center justify-center
        rounded-2xl border-2 transition-all duration-150
        select-none cursor-pointer active:scale-95
        ${style.card}
        min-h-[72px] px-2 py-2 gap-1
        shadow-sm hover:shadow-lg
      `}
    >
      {/* Status dot (top-right) */}
      <span
        className={`absolute top-2 right-2 w-2 h-2 rounded-full ${style.dot} ${
          isOccupied ? "animate-pulse" : ""
        }`}
      />

      {/* Table Number */}
      <span className={`text-xl font-black leading-none tracking-tight ${style.num}`}>
        {table.table_title}
      </span>

      {/* Status label */}
      <span
        className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${style.labelCls}`}
      >
        {getStyle(statusKey).label}
      </span>

      {/* Order total if occupied */}
      {isOccupied && table.active_order_total != null && (
        <span className="text-[10px] font-bold text-white/60 leading-none">
          ${Number(table.active_order_total).toFixed(2)}
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Legend bar
// ─────────────────────────────────────────────────────────────
function LegendBar() {
  const items = [
    { dot: "bg-[#22c55e]", label: "Free" },
    { dot: "bg-[#0ea5e9]", label: "Seated" },
    { dot: "bg-[#6366f1]", label: "Ordered" },
    { dot: "bg-[#f97316]", label: "Bill Req" },
    { dot: "bg-[#4ade80]", label: "Paid" },
    { dot: "bg-[#ef4444]", label: "Over Time" },
    { dot: "bg-[#a855f7]", label: "Reserved" },
    { dot: "bg-slate-500", label: "Blocked" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${i.dot} shrink-0`} />
          <span className="text-[11px] font-semibold text-slate-400">{i.label}</span>
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function TableGridView({
  tables = [],
  zones = [],
  currentFloor = "0",
  onSelectZone = () => {},
  onTableClick = () => {},
  onAddZone,
  onRefresh,
  isRefreshing = false,
  isSocketConnected = true,
  dineInCount = 0,
  pickUpCount = 0,
}) {
  const { t } = useTranslation();

  const normalizeFloor = (f) => {
    if (f === null || f === undefined) return "";
    return String(f)
      .trim()
      .replace(/[០-៩]/g, (d) => "0123456789"["០១២៣៤៥៦៧៨៩".indexOf(d)]);
  };

  const formatZoneLabel = (zone) => {
    const s = String(zone).trim();
    if (/^(zone|floor)\b/i.test(s)) return s;
    return `${t("tables.zone", "Zone")} ${s}`;
  };

  // Tables on the current zone
  const tablesOnFloor = useMemo(() => {
    return tables.filter(
      (t) => normalizeFloor(t.floor) === normalizeFloor(currentFloor)
    );
  }, [tables, currentFloor]);

  // Per-zone stats (free / occupied counts)
  const zoneStats = useMemo(() => {
    const stats = {};
    tables.forEach((tbl) => {
      const z = String(tbl.floor ?? "0");
      if (!stats[z]) stats[z] = { free: 0, occupied: 0 };
      if (tbl.active_order_id) stats[z].occupied++;
      else stats[z].free++;
    });
    return stats;
  }, [tables]);

  // Global stats for current zone
  const currentStats = zoneStats[String(currentFloor)] || { free: 0, occupied: 0 };

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 overflow-hidden">
      {/* ── Zone Tab Bar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-zinc-900/95 border-b border-zinc-800 backdrop-blur-md shrink-0 z-20">
        {/* Zone tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-zinc-800/80 p-1 rounded-xl">
          {(zones.length > 0 ? zones : ["0"]).map((zone) => {
            const isActive =
              normalizeFloor(currentFloor) === normalizeFloor(zone);
            const st = zoneStats[String(zone)] || { free: 0, occupied: 0 };
            return (
              <button
                key={zone}
                type="button"
                onClick={() => onSelectZone(zone)}
                className={`
                  flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold
                  transition-all whitespace-nowrap cursor-pointer
                  ${
                    isActive
                      ? "bg-[#0ea5e9] text-white shadow-md shadow-sky-900/30"
                      : "text-slate-400 hover:text-white hover:bg-zinc-700"
                  }
                `}
              >
                <span>{formatZoneLabel(zone)}</span>
                <span
                  className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-zinc-700 text-slate-300"
                  }`}
                >
                  {st.free}F / {st.occupied}O
                </span>
              </button>
            );
          })}

          {onAddZone && (
            <button
              type="button"
              onClick={onAddZone}
              title={t("tables.add_zone", "Add Zone")}
              className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-zinc-700 transition cursor-pointer"
            >
              <IconPlus size={14} />
            </button>
          )}
        </div>

        {/* Right: Stats + socket indicator + refresh */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Summary stats for current zone */}
          <div className="hidden sm:flex items-center gap-3 text-xs font-bold text-slate-400 border-r border-zinc-700 pr-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
              <span className="text-[#4ade80]">{currentStats.free} Free</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0ea5e9]" />
              <span className="text-[#38bdf8]">{currentStats.occupied} Occupied</span>
            </span>
          </div>

          {/* Dine-in / Pick-up */}
          <div className="hidden lg:flex items-center gap-3 text-xs font-bold text-slate-500 border-r border-zinc-700 pr-3">
            <span>🍽 {dineInCount}</span>
            <span>🥡 {pickUpCount}</span>
          </div>

          {/* Socket dot */}
          <div title={isSocketConnected ? "Live" : "Connecting..."}>
            {isSocketConnected ? (
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            )}
          </div>

          {/* Refresh */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
              title="Refresh tables"
            >
              <IconRefresh size={16} className={isRefreshing ? "animate-spin" : ""} />
            </button>
          )}
        </div>
      </div>

      {/* ── Dense Table Grid ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4">
        {tablesOnFloor.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <IconArmchair size={56} className="text-zinc-700" />
            <p className="text-slate-500 font-bold text-sm">
              {t("tables.no_tables_on_zone", "No tables on this zone")}
            </p>
            <p className="text-slate-600 text-xs">
              {t(
                "tables.add_tables_from_canvas",
                "Switch to Floor Plan view to add tables"
              )}
            </p>
          </div>
        ) : (
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
            }}
          >
            {tablesOnFloor.map((table) => (
              <TablePill
                key={table.id}
                table={table}
                onTableClick={onTableClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Legend Bar ───────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-2.5 border-t border-zinc-800 bg-zinc-900/80">
        <LegendBar />
      </div>
    </div>
  );
}
