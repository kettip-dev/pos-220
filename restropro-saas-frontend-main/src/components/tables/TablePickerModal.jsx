import React, { useState, useMemo, useContext, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  IconX,
  IconArmchair2,
  IconSearch,
  IconZoomIn,
  IconZoomOut,
  IconArrowsMaximize,
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

  // Floors
  const floors = useMemo(() => {
    const set = new Set();
    rawTables.forEach((tbl) => {
      if (tbl.floor) set.add(tbl.floor);
    });
    if (set.size === 0) set.add("1");
    return Array.from(set);
  }, [rawTables]);

  const [currentFloor, setCurrentFloor] = useState("1");
  const [activeDetailsTable, setActiveDetailsTable] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (floors.length > 0 && !floors.includes(currentFloor)) {
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

  const tablesOnFloor = useMemo(() => {
    return rawTables.filter((tbl) => {
      if (String(tbl.floor) !== String(currentFloor)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return tbl.table_title.toLowerCase().includes(q);
      }
      return true;
    });
  }, [rawTables, currentFloor, searchQuery]);

  const currentFloorLayout = useMemo(() => {
    const found = rawLayouts.find((l) => l.floor === currentFloor);
    return {
      show_cashier: found?.show_cashier !== 0,
      cashier_x: found?.cashier_x ?? 60,
      cashier_y: found?.cashier_y ?? 260,
      cashier_w: found?.cashier_w ?? 80,
      cashier_h: found?.cashier_h ?? 180,
      floor_plan_image: found?.floor_plan_image ?? null,
      floor_plan_opacity: found?.floor_plan_opacity ?? 0.8,
      floor_plan_fit: found?.floor_plan_fit ?? "contain",
    };
  }, [rawLayouts, currentFloor]);

  // Virtual Canvas Dimension required by tables on this floor
  const virtualBounds = useMemo(() => {
    let maxTableX = 960;
    let maxTableY = 620;
    tablesOnFloor.forEach((t) => {
      const x = (t.pos_x ?? 220) + (t.shape === "rectangle" ? 160 : 110);
      const y = (t.pos_y ?? 100) + 110;
      if (x > maxTableX) maxTableX = x;
      if (y > maxTableY) maxTableY = y;
    });
    return {
      width: Math.max(1020, maxTableX + 40),
      height: Math.max(660, maxTableY + 40),
    };
  }, [tablesOnFloor]);

  // Container Measurement & Auto-fit scaling
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 1000, height: 600 });
  const [userZoom, setUserZoom] = useState(null); // null means auto-fit

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      setContainerSize({
        width: el.clientWidth || 1000,
        height: el.clientHeight || 600,
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(el);
    return () => observer.disconnect();
  }, [isOpen]);

  // Reset zoom to auto-fit whenever floor changes or modal opens
  useEffect(() => {
    setUserZoom(null);
  }, [currentFloor, isOpen]);

  // Compute auto-fit scale
  const autoFitScale = useMemo(() => {
    if (!containerSize.width || !containerSize.height) return 1;
    const padding = 20;
    const availW = Math.max(200, containerSize.width - padding);
    const availH = Math.max(200, containerSize.height - padding);
    const scaleX = availW / virtualBounds.width;
    const scaleY = availH / virtualBounds.height;
    return Math.min(scaleX, scaleY, 1.2);
  }, [containerSize, virtualBounds]);

  const effectiveScale = userZoom ?? autoFitScale;

  if (!isOpen) return null;

  const handleTableClick = (table) => {
    if (table.active_order_id) {
      // Occupied: open details
      setActiveDetailsTable(table);
    } else {
      // Free: select table immediately
      onSelectTable(table);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 md:p-6 animate-fade-in">
      <div className="w-full max-w-6xl h-[90vh] max-h-[920px] bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-zinc-800 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <IconArmchair2 size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {t("tables.select_table_floor", "Select Table on Floor Plan")}
              </h3>
              <p className="text-xs text-gray-500">
                {t("tables.picker_hint", "Tap an available table to assign it to this order.")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative hidden sm:block">
              <IconSearch
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder={t("tables.search_table", "Search table...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white outline-none w-36"
              />
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 flex items-center justify-center text-gray-500 transition cursor-pointer"
            >
              <IconX size={18} />
            </button>
          </div>
        </div>

        {/* Floor Tabs */}
        {floors.length > 0 && (
          <div className="flex items-center gap-2 px-6 pt-3 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30 shrink-0">
            {floors.map((fl) => (
              <button
                key={fl}
                onClick={() => setCurrentFloor(fl)}
                className={`px-4 py-2 rounded-t-xl text-xs font-semibold transition border-b-2 cursor-pointer ${
                  currentFloor === fl
                    ? "border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-zinc-900"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {t("table_settings.floor", "Floor")} {fl}
              </button>
            ))}
          </div>
        )}

        {/* Canvas Area with Centered Auto-Fit Scaling */}
        <div
          ref={containerRef}
          className="relative flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center p-3 bg-gray-100/70 dark:bg-zinc-950"
        >
          <div
            style={{
              width: `${virtualBounds.width}px`,
              height: `${virtualBounds.height}px`,
              transform: `scale(${effectiveScale})`,
              transformOrigin: "center center",
              transition: "transform 0.15s ease-out",
            }}
            className="shrink-0 shadow-xl rounded-2xl overflow-hidden"
          >
            <FloorPlanCanvas
              tables={tablesOnFloor}
              floorSettings={currentFloorLayout}
              isEditMode={false}
              selectedTableId={selectedTableId}
              onSelectTable={() => {}}
              onTableClick={handleTableClick}
              canvasHeight={virtualBounds.height}
            />
          </div>
        </div>

        {/* Footer with Info and Zoom Controls */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between text-xs text-gray-500 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-medium text-gray-600 dark:text-gray-300">
              {tablesOnFloor.length} {t("tables.tables_on_floor", "tables on this floor")}
            </span>

            {/* Compact Zoom Controls */}
            <div className="hidden sm:flex items-center gap-1.5 ml-3 pl-3 border-l border-gray-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setUserZoom(autoFitScale)}
                title={t("tables.fit_to_screen", "Fit to screen")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition cursor-pointer ${
                  userZoom === null || Math.abs(effectiveScale - autoFitScale) < 0.01
                    ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold"
                    : "border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-300"
                }`}
              >
                <IconArrowsMaximize size={13} />
                <span>{t("tables.fit", "Fit")}</span>
              </button>

              <button
                type="button"
                onClick={() => setUserZoom((prev) => Math.max(0.4, (prev ?? autoFitScale) - 0.1))}
                title={t("tables.zoom_out", "Zoom Out")}
                className="p-1 rounded-lg border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-300 transition cursor-pointer"
              >
                <IconZoomOut size={14} />
              </button>

              <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 w-11 text-center select-none">
                {Math.round(effectiveScale * 100)}%
              </span>

              <button
                type="button"
                onClick={() => setUserZoom((prev) => Math.min(1.6, (prev ?? autoFitScale) + 0.1))}
                title={t("tables.zoom_in", "Zoom In")}
                className="p-1 rounded-lg border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-300 transition cursor-pointer"
              >
                <IconZoomIn size={14} />
              </button>

              <button
                type="button"
                onClick={() => setUserZoom(1.0)}
                title={t("tables.reset_zoom", "Reset to 100%")}
                className={`px-2 py-1 rounded-lg border text-xs font-medium transition cursor-pointer ${
                  Math.abs(effectiveScale - 1.0) < 0.01
                    ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold"
                    : "border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-300"
                }`}
              >
                100%
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            {t("common.close", "Close")}
          </button>
        </div>
      </div>

      {/* Table Details Modal for Occupied Table */}
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
