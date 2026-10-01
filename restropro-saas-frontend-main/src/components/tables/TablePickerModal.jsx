import React, { useState, useMemo, useContext, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  IconArrowLeft,
  IconSearch,
  IconZoomIn,
  IconZoomOut,
  IconArrowsMaximize,
  IconMap,
  IconLayoutGrid,
  IconUsers,
  IconArmchair2,
  IconClock,
  IconX,
  IconReceipt2,
} from "@tabler/icons-react";
import { SocketContext } from "../../contexts/SocketContext";
import { useStoreTablesLiveStatus } from "../../controllers/settings.controller";
import FloorPlanCanvas from "./FloorPlanCanvas";
import TableDetailsModal from "./TableDetailsModal";

export default function TablePickerModal({
  isOpen,
  onClose,
  selectedTableId,
  onSelectTable,
  currency = "$",
}) {
  const { t } = useTranslation();
  const { socket } = useContext(SocketContext);

  const { data: storeData, mutate } = useStoreTablesLiveStatus();
  const rawTables = storeData?.tables || [];
  const rawLayouts = storeData?.layouts || [];

  // Floors list
  const floors = useMemo(() => {
    const set = new Set();
    rawTables.forEach((tbl) => {
      if (tbl.floor !== undefined && tbl.floor !== null) set.add(String(tbl.floor));
    });
    if (set.size === 0) set.add("0");
    return Array.from(set).sort();
  }, [rawTables]);

  const [currentFloor, setCurrentFloor] = useState(floors[0] || "0");
  const [viewMode, setViewMode] = useState("map"); // "map" or "grid"
  const [statusFilter, setStatusFilter] = useState("all"); // "all", "available", "occupied", "reserved"
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDetailsTable, setActiveDetailsTable] = useState(null);

  // Zoom & Pan state for Map Canvas
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    if (floors.length > 0 && currentFloor !== "all" && !floors.includes(currentFloor)) {
      setCurrentFloor(floors[0]);
    }
  }, [floors, currentFloor]);

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
    return rawTables.filter((tbl) => {
      if (currentFloor !== "all" && String(tbl.floor) !== String(currentFloor)) return false;
      return true;
    });
  }, [rawTables, currentFloor]);

  // Status-filtered and search-filtered tables
  const filteredTables = useMemo(() => {
    return tablesOnFloor.filter((tbl) => {
      const isOccupied = Boolean(tbl.active_order_id);
      const isReserved = tbl.has_reservation && !isOccupied;

      if (statusFilter === "available" && isOccupied) return false;
      if (statusFilter === "occupied" && !isOccupied) return false;
      if (statusFilter === "reserved" && (!isReserved || isOccupied)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = tbl.table_title?.toLowerCase().includes(q);
        const serverMatch = (tbl.customer_name || tbl.server_name || "")?.toLowerCase().includes(q);
        return titleMatch || serverMatch;
      }
      return true;
    });
  }, [tablesOnFloor, statusFilter, searchQuery]);

  // Floor layout settings for current floor
  const currentFloorLayout = useMemo(() => {
    const found = rawLayouts.find((l) => String(l.floor) === String(currentFloor));
    return {
      show_cashier: found?.show_cashier !== 0,
      cashier_x: found?.cashier_x ?? 60,
      cashier_y: found?.cashier_y ?? 260,
      cashier_w: found?.cashier_w ?? 80,
      cashier_h: found?.cashier_h ?? 180,
      floor_plan_image: found?.floor_plan_image ?? null,
      floor_plan_opacity: found?.floor_plan_opacity ?? 0.8,
      floor_plan_fit: found?.floor_plan_fit ?? "contain",
      walls: found?.walls || [],
    };
  }, [rawLayouts, currentFloor]);

  // Counts for status pills
  const availableCount = useMemo(
    () => tablesOnFloor.filter((t) => !t.active_order_id).length,
    [tablesOnFloor]
  );
  const occupiedCount = useMemo(
    () => tablesOnFloor.filter((t) => Boolean(t.active_order_id)).length,
    [tablesOnFloor]
  );
  const reservedCount = useMemo(
    () => tablesOnFloor.filter((t) => t.has_reservation && !t.active_order_id).length,
    [tablesOnFloor]
  );

  // Auto-fit & auto-center tables on the floor plan
  const autoFitAndCenter = () => {
    const el = containerRef.current;
    if (!el || tablesOnFloor.length === 0) {
      setZoomLevel(1);
      setPanOffset({ x: 40, y: 30 });
      return;
    }

    const cw = el.clientWidth || window.innerWidth || 1000;
    const ch = el.clientHeight || window.innerHeight || 600;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    tablesOnFloor.forEach((t) => {
      const x = t.pos_x ?? 180;
      const y = t.pos_y ?? 120;
      const w = t.shape === "rectangle" ? 140 : 90;
      const h = t.shape === "rectangle" ? 80 : 90;
      if (x < minX) minX = x;
      if (x + w > maxX) maxX = x + w;
      if (y < minY) minY = y;
      if (y + h > maxY) maxY = y + h;
    });

    if (minX === Infinity) {
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
      return;
    }

    const padding = 100;
    const contentW = Math.max(300, maxX - minX + padding * 2);
    const contentH = Math.max(200, maxY - minY + padding * 2);

    const scaleX = cw / contentW;
    const scaleY = ch / contentH;
    const fitScale = Math.min(1.2, Math.max(0.65, Math.min(scaleX, scaleY)));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const panX = Math.round(cw / 2 - centerX * fitScale);
    const panY = Math.round(ch / 2 - centerY * fitScale);

    setZoomLevel(Number(fitScale.toFixed(2)));
    setPanOffset({ x: panX, y: panY });
  };

  // Re-center on floor change or view mode switch
  useEffect(() => {
    if (isOpen && viewMode === "map") {
      const timer = setTimeout(autoFitAndCenter, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, currentFloor, viewMode, tablesOnFloor.length]);

  if (!isOpen) return null;

  const handleTableClick = (table) => {
    if (table.active_order_id) {
      // Occupied: open order summary drawer
      setActiveDetailsTable(table);
    } else {
      // Free: select table immediately & return to POS
      onSelectTable(table);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col w-screen h-screen bg-background text-foreground overflow-hidden select-none animate-in fade-in duration-150">
      {/* 1. Top Navigation Bar */}
      <header className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 border-b border-restro-border-green/80 bg-background/95 backdrop-blur-md shrink-0 gap-3 z-30 shadow-xs">
        {/* Left: Back to POS & View Switcher */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-3.5 sm:px-4 rounded-xl border border-restro-border-green bg-restro-gray hover:bg-restro-button-hover text-restro-text text-xs sm:text-sm font-bold flex items-center gap-2 transition active:scale-95 touch-manipulation cursor-pointer shadow-xs"
            title={t("pos.back_to_pos", "Back to Menu")}
          >
            <IconArrowLeft size={18} stroke={2.5} />
            <span className="hidden xs:inline">{t("pos.back_to_menu", "Back to POS")}</span>
          </button>

          <div className="h-6 w-[1px] bg-restro-border-green/80 hidden sm:block" />

          {/* View Mode Toggle: Floor Plan vs Grid Cards */}
          <div className="flex items-center p-1 rounded-xl bg-restro-gray border border-restro-border-green">
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                viewMode === "map"
                  ? "bg-restro-green text-white shadow-xs"
                  : "text-gray-500 hover:text-restro-text"
              }`}
            >
              <IconMap size={15} />
              <span className="hidden sm:inline">{t("tables.floor_plan", "Floor Plan")}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                viewMode === "grid"
                  ? "bg-restro-green text-white shadow-xs"
                  : "text-gray-500 hover:text-restro-text"
              }`}
            >
              <IconLayoutGrid size={15} />
              <span className="hidden sm:inline">{t("tables.grid_view", "Grid View")}</span>
            </button>
          </div>
        </div>

        {/* Center: Floor Switcher Tabs */}
        {floors.length > 0 && (
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-restro-gray border border-restro-border-green overflow-x-auto scrollbar-none max-w-[240px] sm:max-w-md">
            {floors.length > 1 && (
              <button
                type="button"
                onClick={() => setCurrentFloor("all")}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer whitespace-nowrap ${
                  currentFloor === "all"
                    ? "bg-restro-green text-white shadow-xs"
                    : "text-gray-500 hover:text-restro-text"
                }`}
              >
                {t("common.all", "All Floors")} ({rawTables.length})
              </button>
            )}

            {floors.map((fl) => {
              const floorCount = rawTables.filter((t) => String(t.floor) === String(fl)).length;
              return (
                <button
                  key={fl}
                  type="button"
                  onClick={() => setCurrentFloor(fl)}
                  className={`min-h-[34px] px-3.5 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer whitespace-nowrap ${
                    currentFloor === fl
                      ? "bg-restro-green text-white shadow-xs"
                      : "text-gray-500 hover:text-restro-text"
                  }`}
                >
                  {t("table_settings.floor", "Floor")} {fl}{" "}
                  <span className="text-[10px] opacity-75">({floorCount})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Right: Quick Search Input */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative w-36 sm:w-52">
            <IconSearch
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder={t("tables.search_table", "Search table...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-7 py-1.5 min-h-[42px] rounded-xl text-xs font-medium border border-restro-border-green bg-background text-restro-text outline-none focus:border-restro-green shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
              >
                <IconX size={14} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Interactive Status Filter Bar */}
      <div className="px-3 sm:px-6 py-2 border-b border-restro-border-green/60 bg-restro-gray/40 backdrop-blur-xs flex items-center justify-between gap-3 overflow-x-auto scrollbar-none z-20 shrink-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`min-h-[32px] px-3 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer ${
              statusFilter === "all"
                ? "bg-slate-800 text-white dark:bg-white dark:text-black shadow-xs"
                : "bg-background text-gray-600 dark:text-gray-400 hover:text-restro-text border border-restro-border-green/60"
            }`}
          >
            {t("common.all", "All")} ({tablesOnFloor.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("available")}
            className={`min-h-[32px] px-3 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "available"
                ? "bg-emerald-600 text-white shadow-xs shadow-emerald-500/20"
                : "bg-background text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-emerald-500/30"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            {t("tables.available", "Available")} ({availableCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("occupied")}
            className={`min-h-[32px] px-3 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "occupied"
                ? "bg-sky-600 text-white shadow-xs shadow-sky-500/20"
                : "bg-background text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30 border border-sky-500/30"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
            {t("tables.occupied", "Occupied")} ({occupiedCount})
          </button>

          {reservedCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter("reserved")}
              className={`min-h-[32px] px-3 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "reserved"
                  ? "bg-amber-600 text-white shadow-xs shadow-amber-500/20"
                  : "bg-background text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-amber-500/30"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              {t("tables.reserved", "Reserved")} ({reservedCount})
            </button>
          )}
        </div>

        {/* Tactile workflow reminder */}
        <div className="text-[11px] text-gray-500 hidden md:flex items-center gap-2">
          <span>
            {t(
              "tables.workflow_tip",
              "💡 Tap an available table to seat • Tap an occupied table for active bill"
            )}
          </span>
        </div>
      </div>

      {/* 3. Main Workspace: Seamless Full-Screen Map OR High-Speed Grid */}
      {viewMode === "map" ? (
        <div
          ref={containerRef}
          className="relative flex-1 min-h-0 w-full h-full overflow-hidden bg-[#f8fafc] dark:bg-zinc-950"
        >
          <FloorPlanCanvas
            tables={tablesOnFloor}
            floorSettings={currentFloorLayout}
            isEditMode={false}
            selectedTableId={selectedTableId}
            activeFilter={statusFilter === "all" ? null : statusFilter}
            onSelectTable={() => {}}
            onTableClick={handleTableClick}
            hideControls={true}
            zoomLevel={zoomLevel}
            setZoomLevel={setZoomLevel}
            panOffset={panOffset}
            setPanOffset={setPanOffset}
            canvasHeight="100%"
          />
        </div>
      ) : (
        /* High-Density Card Grid View */
        <div className="flex-1 min-h-0 w-full h-full overflow-y-auto p-4 sm:p-6 bg-slate-50/70 dark:bg-zinc-950">
          <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4">
            {filteredTables.map((table) => {
              const isOccupied = Boolean(table.active_order_id);
              const isReserved = table.has_reservation && !isOccupied;
              const isSelected = String(table.id) === String(selectedTableId);

              return (
                <div
                  key={table.id}
                  onClick={() => handleTableClick(table)}
                  className={`group relative rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-150 cursor-pointer select-none active:scale-95 min-h-[145px] border-2 shadow-xs hover:shadow-md ${
                    isSelected
                      ? "border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/40 ring-4 ring-cyan-400/20"
                      : isOccupied
                      ? "border-sky-500/80 bg-sky-50/50 dark:bg-sky-950/30 hover:border-sky-500"
                      : isReserved
                      ? "border-amber-500/80 bg-amber-50/50 dark:bg-amber-950/30 hover:border-amber-500"
                      : "border-slate-200 dark:border-zinc-800 bg-background hover:border-emerald-500 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20"
                  }`}
                >
                  {/* Top: Capacity and status chip */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
                      <IconUsers size={14} /> {table.seating_capacity || 2}p
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        isOccupied
                          ? "bg-sky-500 text-white"
                          : isReserved
                          ? "bg-amber-500 text-white"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {isOccupied
                        ? table.elapsed_time || "-00:33"
                        : isReserved
                        ? "Reserved"
                        : "Available"}
                    </span>
                  </div>

                  {/* Center: Table Title */}
                  <div className="my-2 text-center">
                    <h3 className="text-2xl sm:text-3xl font-black text-restro-text tracking-tight group-hover:scale-105 transition-transform">
                      {table.table_title}
                    </h3>
                    <span className="text-[11px] font-semibold text-gray-400">
                      {t("table_settings.floor", "Floor")} {table.floor}
                    </span>
                  </div>

                  {/* Bottom: Order Total or Select Hint */}
                  <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
                    {isOccupied ? (
                      <span className="text-sky-600 dark:text-sky-400 font-bold truncate">
                        {table.total_amount
                          ? `${currency}${Number(table.total_amount).toFixed(2)}`
                          : t("tables.view_bill", "View Bill →")}
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold group-hover:underline">
                        {t("tables.select", "Select Table →")}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400">
                      {table.shape || "square"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredTables.length === 0 && (
            <div className="h-64 flex flex-col items-center justify-center text-center text-gray-400">
              <IconArmchair2 size={44} className="opacity-30 mb-2" />
              <p className="font-bold text-sm">
                {t("tables.no_tables_found", "No tables match current filters")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 4. Bottom Docked Bar: Status Legend & Map Zoom Controls */}
      <footer className="px-3 sm:px-6 py-2.5 border-t border-restro-border-green/80 bg-background/95 backdrop-blur-md flex items-center justify-between text-xs text-gray-500 shrink-0 gap-3 z-20">
        {/* Left: Summary */}
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="font-bold text-restro-text whitespace-nowrap">
            {tablesOnFloor.length} {t("tables.tables_total", "tables total")}
          </span>

          <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-restro-border-green/60">
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {availableCount} {t("tables.available", "Available")}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-sky-500"></span>
              {occupiedCount} {t("tables.occupied", "Occupied")}
            </span>
            {reservedCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                {reservedCount} {t("tables.reserved", "Reserved")}
              </span>
            )}
          </div>
        </div>

        {/* Right: Map Zoom Controls (Visible when in Map View) */}
        {viewMode === "map" && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={autoFitAndCenter}
              title={t("tables.fit_to_screen", "Fit to screen")}
              className="min-h-[36px] flex items-center gap-1 px-3 rounded-xl border border-restro-border-green bg-restro-gray hover:bg-restro-button-hover text-restro-text text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs"
            >
              <IconArrowsMaximize size={14} />
              <span>{t("tables.fit", "Fit")}</span>
            </button>

            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
              title={t("tables.zoom_out", "Zoom Out")}
              className="w-9 h-9 rounded-xl border border-restro-border-green bg-restro-gray hover:bg-restro-button-hover text-restro-text flex items-center justify-center transition active:scale-95 cursor-pointer shadow-xs"
            >
              <IconZoomOut size={15} />
            </button>

            <span className="text-xs font-bold text-restro-text w-12 text-center select-none font-mono">
              {Math.round(zoomLevel * 100)}%
            </span>

            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(2.0, Number((z + 0.1).toFixed(2))))}
              title={t("tables.zoom_in", "Zoom In")}
              className="w-9 h-9 rounded-xl border border-restro-border-green bg-restro-gray hover:bg-restro-button-hover text-restro-text flex items-center justify-center transition active:scale-95 cursor-pointer shadow-xs"
            >
              <IconZoomIn size={15} />
            </button>

            <button
              type="button"
              onClick={() => {
                setZoomLevel(1);
                setPanOffset({ x: 0, y: 0 });
              }}
              title={t("tables.reset_zoom", "Reset to 100%")}
              className={`min-h-[36px] px-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs hidden sm:inline ${
                Math.abs(zoomLevel - 1.0) < 0.01
                  ? "bg-restro-green text-white border-restro-green"
                  : "border-restro-border-green bg-restro-gray hover:bg-restro-button-hover text-restro-text"
              }`}
            >
              100%
            </button>
          </div>
        )}
      </footer>

      {/* 5. Table Details Drawer / Modal for Occupied Table */}
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
