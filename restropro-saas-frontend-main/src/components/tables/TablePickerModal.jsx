import React, { useState, useMemo, useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  IconArrowLeft,
  IconSearch,
  IconGridDots,
  IconColumns,
  IconArmchair,
  IconShoppingBag,
  IconX,
} from "@tabler/icons-react";
import { SocketContext } from "../../contexts/SocketContext";
import { useStoreTablesLiveStatus } from "../../controllers/settings.controller";
import FloorPlanCanvas from "./FloorPlanCanvas";
import TableDetailsModal from "./TableDetailsModal";
import TableGridView from "./TableGridView";
import BindoBottomBar from "./BindoBottomBar";
import { getTableBindoStatus } from "./BindoTableNode";

export default function TablePickerModal({
  isOpen,
  onClose,
  selectedTableId: externalSelectedTableId,
  onSelectTable,
  currency = "$",
}) {
  const { t } = useTranslation();
  const { socket } = useContext(SocketContext);

  const { data: storeData, isLoading, mutate } = useStoreTablesLiveStatus();
  const rawTables = useMemo(() => storeData?.tables || [], [storeData]);
  const rawLayouts = useMemo(() => storeData?.layouts || [], [storeData]);

  // Normalize floor string
  const normalizeFloor = (f) => {
    if (f === null || f === undefined) return "";
    return String(f)
      .trim()
      .replace(/[០-៩]/g, (d) => "0123456789"["០១២៣៤៥៦៧៨៩".indexOf(d)]);
  };

  const formatZoneLabel = (zone) => {
    const s = String(zone).trim();
    if (/^(zone|floor)\b/i.test(s)) return s;
    if (/^[\d០-៩]+$/.test(s)) return `${t("tables.zone", "Zone")} ${s}`;
    return s;
  };

  // Floors / Zones list derived strictly like TablesPage
  const zones = useMemo(() => {
    const set = new Set();
    rawTables.forEach((tbl) => {
      if (tbl.floor !== undefined && tbl.floor !== null && String(tbl.floor).trim() !== "") {
        set.add(String(tbl.floor));
      }
    });
    rawLayouts.forEach((lay) => {
      if (lay.floor !== undefined && lay.floor !== null && String(lay.floor).trim() !== "") {
        set.add(String(lay.floor));
      }
    });
    if (set.size === 0) set.add("0");
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rawTables, rawLayouts]);

  const [currentFloor, setCurrentFloor] = useState(zones[0] || "0");
  const [viewMode, setViewMode] = useState("canvas"); // "canvas" (floor plan) | "grid"
  const [activeFilter, setActiveFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTableId, setSelectedTableId] = useState(externalSelectedTableId || null);
  const [activeDetailsTable, setActiveDetailsTable] = useState(null);

  useEffect(() => {
    if (externalSelectedTableId) {
      setSelectedTableId(externalSelectedTableId);
    }
  }, [externalSelectedTableId]);

  useEffect(() => {
    if (zones.length > 0 && !zones.some((z) => normalizeFloor(z) === normalizeFloor(currentFloor))) {
      setCurrentFloor(zones[0]);
    }
  }, [zones, currentFloor]);

  // Real-time socket updates in modal
  useEffect(() => {
    if (!socket || !isOpen) return;

    const handleTableStatusUpdate = () => mutate();
    const handleNewOrder = () => mutate();
    const handleOrderUpdate = () => mutate();

    socket.on("table_status_update", handleTableStatusUpdate);
    socket.on("new_order", handleNewOrder);
    socket.on("order_update", handleOrderUpdate);

    return () => {
      socket.off("table_status_update", handleTableStatusUpdate);
      socket.off("new_order", handleNewOrder);
      socket.off("order_update", handleOrderUpdate);
    };
  }, [socket, isOpen, mutate]);

  // Tables on current floor
  const tablesOnFloor = useMemo(() => {
    return rawTables.filter(
      (tbl) => normalizeFloor(tbl.floor) === normalizeFloor(currentFloor)
    );
  }, [rawTables, currentFloor]);

  // Search filtered tables on current floor
  const filteredTables = useMemo(() => {
    if (!searchQuery.trim()) return tablesOnFloor;
    const q = searchQuery.toLowerCase().trim();
    return tablesOnFloor.filter((tbl) => {
      const titleMatch = tbl.table_title?.toLowerCase().includes(q);
      const serverMatch = (tbl.customer_name || tbl.server_name || "")?.toLowerCase().includes(q);
      return titleMatch || serverMatch;
    });
  }, [tablesOnFloor, searchQuery]);

  // Live order counters for Top Bar
  const { dineInCount, pickUpCount } = useMemo(() => {
    let dineIn = 0;
    let pickUp = 0;
    rawTables.forEach((t) => {
      if (t.active_order_id) {
        if (t.delivery_type === "takeaway") pickUp++;
        else dineIn++;
      }
    });
    return { dineInCount: dineIn, pickUpCount: pickUp };
  }, [rawTables]);

  // Bindo Metrics for Bottom Status Bar
  const bindoMetrics = useMemo(() => {
    let seated = 0;
    let ordered = 0;
    let ck_dropped = 0;
    let paid = 0;
    let over_time = 0;
    let alert = 0;
    let total_pax = 0;

    tablesOnFloor.forEach((tbl) => {
      const st = getTableBindoStatus(tbl);
      if (st === "seated") seated++;
      else if (st === "ordered") ordered++;
      else if (st === "ck_dropped") ck_dropped++;
      else if (st === "paid") paid++;

      if (tbl.is_over_time) over_time++;
      if (tbl.is_alert) alert++;
      if (tbl.active_order_id) {
        total_pax += Number(tbl.seating_capacity) || Number(tbl.active_order_guests) || 2;
      }
    });

    const available = tablesOnFloor.filter((t) => !t.active_order_id).length;
    const occupied = tablesOnFloor.filter((t) => Boolean(t.active_order_id)).length;

    return {
      all: tablesOnFloor.length,
      available,
      occupied,
      seated,
      ordered,
      ck_dropped,
      paid,
      over_time,
      alert,
      total_pax,
    };
  }, [tablesOnFloor]);

  // Floor layout settings for current floor
  const currentFloorLayout = useMemo(() => {
    const found = rawLayouts.find((l) => normalizeFloor(l.floor) === normalizeFloor(currentFloor));
    return {
      show_cashier: found?.show_cashier !== 0,
      cashier_x: found?.cashier_x ?? 60,
      cashier_y: found?.cashier_y ?? 260,
      cashier_w: found?.cashier_w ?? 80,
      cashier_h: found?.cashier_h ?? 180,
      cashier_rotation: found?.cashier_rotation ?? 0,
      floor_plan_image: found?.floor_plan_image ?? null,
      floor_plan_opacity: found?.floor_plan_opacity ?? 0.8,
      floor_plan_fit: found?.floor_plan_fit ?? "contain",
      walls: found?.walls || [],
    };
  }, [rawLayouts, currentFloor]);

  if (!isOpen) return null;

  const handleTableClick = (table) => {
    setSelectedTableId(table.id);
    if (table.active_order_id) {
      setActiveDetailsTable(table);
    } else {
      onSelectTable(table);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col w-screen h-screen bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 overflow-hidden select-none animate-in fade-in duration-150">
      {/* 1. Top Navigation Bar (Consistent with TablesPage BindoTopBar) */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-white/95 dark:bg-zinc-900/95 border-b border-slate-200 dark:border-zinc-800 backdrop-blur-md select-none shrink-0 z-20 transition-colors duration-200">
        {/* Left: Back to POS & View Switcher & Zone Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {/* Back to POS Button */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 hover:border-[#0ea5e9] hover:text-[#0ea5e9] text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs shrink-0"
            title={t("pos.back_to_pos", "Back to Menu")}
          >
            <IconArrowLeft size={18} stroke={2.5} />
            <span className="hidden sm:inline">{t("pos.back_to_menu", "Back to POS")}</span>
          </button>

          <div className="w-px h-6 bg-slate-200 dark:bg-zinc-700 hidden sm:block" />

          {/* View Mode Toggle: Canvas <-> Grid */}
          <button
            type="button"
            onClick={() => setViewMode((prev) => (prev === "grid" ? "canvas" : "grid"))}
            title={viewMode === "grid" ? t("tables.floor_plan_view", "Floor Plan View") : t("tables.grid_view", "Grid View")}
            className={`flex items-center gap-1.5 h-[42px] px-3.5 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer shrink-0 ${
              viewMode === "grid"
                ? "border-[#0ea5e9] bg-[#0ea5e9]/10 text-[#0ea5e9]"
                : "border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:border-[#0ea5e9] hover:text-[#0ea5e9]"
            }`}
          >
            {viewMode === "grid" ? <IconColumns size={16} /> : <IconGridDots size={16} />}
            <span className="inline">
              {viewMode === "grid" ? t("tables.floor_plan", "Floor Plan") : t("tables.grid", "Grid View")}
            </span>
          </button>

          {/* Zone Pills (e.g. Main Lounge, Outdoor Patio) */}
          <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-zinc-800/90 p-1 rounded-xl overflow-x-auto no-scrollbar">
            {zones.map((zone) => {
              const isActive = normalizeFloor(currentFloor) === normalizeFloor(zone);
              return (
                <button
                  key={zone}
                  type="button"
                  onClick={() => setCurrentFloor(zone)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-[#0ea5e9] text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-zinc-700/60"
                  }`}
                >
                  {formatZoneLabel(zone)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Live Order Counters, Socket Status & Search Input */}
        <div className="flex items-center gap-3">
          {/* Live Order Stats (Dine-in, Pick-up) */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/40 text-sky-700 dark:text-sky-300 text-xs font-bold">
              <IconArmchair size={13} />
              {dineInCount}
              <span className="font-medium opacity-70 hidden md:inline">{t("tables.dine_in", "Dine-in")}</span>
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold">
              <IconShoppingBag size={13} />
              {pickUpCount}
              <span className="font-medium opacity-70 hidden md:inline">{t("tables.pick_up", "Pick-up")}</span>
            </span>
          </div>

          <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-zinc-700" />

          {/* Live Socket Connection indicator */}
          <div
            title={Boolean(socket?.connected) ? t("tables.live_status_connected", "Live Status Connected") : t("tables.connecting", "Connecting...")}
            className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400"
          >
            {Boolean(socket?.connected) ? (
              <>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="hidden lg:inline text-emerald-600 dark:text-emerald-400">{t("tables.live", "Live")}</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="hidden lg:inline text-amber-600 dark:text-amber-400">{t("tables.connecting", "Connecting")}</span>
              </>
            )}
          </div>

          {/* Search Input */}
          <div className="relative w-36 sm:w-52">
            <IconSearch
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder={t("tables.search_table", "Search table...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-7 py-1.5 h-[42px] rounded-xl text-xs font-medium border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-white outline-none focus:border-[#0ea5e9] shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <IconX size={14} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Main Workspace: Floor Plan Canvas OR Dense Grid View */}
      <div className="relative flex-1 w-full min-h-0 overflow-hidden flex">
        {viewMode === "grid" ? (
          <TableGridView
            tables={rawTables}
            zones={zones}
            currentFloor={currentFloor}
            currency={currency}
            selectedTableId={selectedTableId}
            activeFilter={activeFilter}
            onSelectFilter={setActiveFilter}
            onSelectZone={(zone) => setCurrentFloor(zone)}
            onTableClick={handleTableClick}
            onRefresh={() => mutate()}
            isRefreshing={isLoading}
            isSocketConnected={Boolean(socket?.connected)}
            dineInCount={dineInCount}
            pickUpCount={pickUpCount}
          />
        ) : (
          <div className="relative flex-1 min-h-0 w-full h-full overflow-hidden bg-white dark:bg-zinc-950">
            <FloorPlanCanvas
              tables={filteredTables}
              currency={currency}
              floorSettings={currentFloorLayout}
              isEditMode={false}
              selectedTableId={selectedTableId}
              activeFilter={activeFilter}
              onSelectTable={(id) => setSelectedTableId(id)}
              onTableClick={handleTableClick}
              hideControls={false}
              canvasHeight="100%"
            />
          </div>
        )}
      </div>

      {/* 3. Bottom Status Bar (Consistent with TablesPage BindoBottomBar) */}
      <BindoBottomBar
        metrics={bindoMetrics}
        activeFilter={activeFilter}
        onSelectFilter={(key) => setActiveFilter(key)}
        onRefresh={() => mutate()}
        isRefreshing={isLoading}
        isDrawerOpen={false}
        onToggleDrawer={() => {}}
      />

      {/* 4. Table Details Modal for Occupied Table */}
      <TableDetailsModal
        isOpen={Boolean(activeDetailsTable)}
        onClose={() => setActiveDetailsTable(null)}
        table={activeDetailsTable}
        currency={currency}
        onSelectForOrder={(tbl) => {
          onSelectTable(tbl);
          onClose();
        }}
      />
    </div>
  );
}
