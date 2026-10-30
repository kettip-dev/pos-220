import React, { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  IconRotate,
  IconPencil,
  IconTrash,
  IconUpload,
  IconPhoto,
  IconLoader2,
  IconPlus,
  IconMinus,
  IconLink,
  IconGridDots,
  IconDeviceDesktopAnalytics,
} from "@tabler/icons-react";
import { useTheme } from "../../contexts/ThemeContext";
import { getImageURL } from "../../helpers/ImageHelper";
import BindoTableNode, { getTableBindoStatus } from "./BindoTableNode";

function getBezierCurveData(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / (dist || 1);
  const ny = dx / (dist || 1);
  const curvature = Math.min(36, Math.max(14, dist * 0.18));

  const cx1 = x1 + dx * 0.35 + nx * curvature;
  const cy1 = y1 + dy * 0.35 + ny * curvature;
  const cx2 = x1 + dx * 0.65 + nx * curvature;
  const cy2 = y1 + dy * 0.65 + ny * curvature;

  // Exact midpoint on cubic Bezier at t = 0.5
  const midX = 0.125 * x1 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x2;
  const midY = 0.125 * y1 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y2;

  return {
    path: `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`,
    midX,
    midY,
  };
}

export default function FloorPlanCanvas({
  tables = [],
  currency = "$",
  floorSettings = {
    show_cashier: true,
    cashier_x: 60,
    cashier_y: 260,
    cashier_rotation: 0,
    floor_plan_image: null,
    floor_plan_opacity: 0.8,
    floor_plan_fit: "contain",
    walls: [],
  },
  mergedPairs = [], // e.g. [ [id1, id2], [id2, id3] ]
  isMergeMode = false,
  mergeSourceId = null,
  isEditMode = false,
  isDrawingWall = false,
  selectedTableId = null,
  activeFilter = null,
  onSelectTable = () => {},
  onTableClick = () => {},
  onTableUpdate = () => {},
  onTableDelete = () => {},
  onOpenEditModal = () => {},
  onFloorSettingsChange = () => {},
  onFloorPlanUpload = () => {},
  onFloorPlanDelete = () => {},
  canvasHeight = "100%",
  hideControls = false,
  zoomLevel: externalZoomLevel = null,
  setZoomLevel: externalSetZoomLevel = null,
  panOffset: externalPanOffset = null,
  setPanOffset: externalSetPanOffset = null,
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const floorSettingsRef = useRef(floorSettings);
  useEffect(() => {
    floorSettingsRef.current = floorSettings;
  }, [floorSettings]);

  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [internalZoomLevel, setInternalZoomLevel] = useState(1);
  const [internalPanOffset, setInternalPanOffset] = useState({ x: 0, y: 0 });

  const zoomLevel =
    externalZoomLevel !== null && externalZoomLevel !== undefined
      ? externalZoomLevel
      : internalZoomLevel;
  const setZoomLevel = externalSetZoomLevel || setInternalZoomLevel;

  const panOffset =
    externalPanOffset !== null && externalPanOffset !== undefined
      ? externalPanOffset
      : internalPanOffset;
  const setPanOffset = externalSetPanOffset || setInternalPanOffset;

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);

  // Wall drawing states
  const [drawingWall, setDrawingWall] = useState(null); // { x1, y1, x2, y2 }
  const [hoveredWallId, setHoveredWallId] = useState(null);

  // Dragging state for tables, walls, and cashier
  const [draggingItem, setDraggingItem] = useState(null); // { type, id, startMouseX, startMouseY, startX, startY }

  // Custom walls (starts completely clean, no fake default lines)
  const walls = Array.isArray(floorSettings?.walls) ? floorSettings.walls : [];

  // Compute layout positions for tables lacking coordinates
  const processedTables = useMemo(() => {
    return tables.map((tbl, index) => {
      let x = tbl.pos_x;
      let y = tbl.pos_y;

      if (x === null || x === undefined || y === null || y === undefined) {
        const col = index % 5;
        const row = Math.floor(index / 5);
        x = 180 + col * 140;
        y = 120 + row * 140;
      }

      const shape =
        tbl.shape ||
        (tbl.seating_capacity > 4 ? "rectangle" : tbl.seating_capacity > 2 ? "square" : "round");
      let w = 76;
      let h = 76;
      if (shape === "round") {
        w = (tbl.seating_capacity || 2) >= 8 ? 96 : 82;
        h = w;
      } else if (shape === "rectangle") {
        w = 128;
        h = 76;
      }

      return {
        ...tbl,
        pos_x: x,
        pos_y: y,
        shape,
        rotation: tbl.rotation || 0,
        center_x: x + w / 2,
        center_y: y + h / 2,
      };
    });
  }, [tables]);

  // Drag & drop handlers for floor plan image
  const handleDragOver = (e) => {
    if (!isEditMode) return;
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    if (!isEditMode) return;
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e) => {
    if (!isEditMode) return;
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      try {
        setIsUploading(true);
        await onFloorPlanUpload(file);
      } catch (err) {
        console.error(err);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      await onFloorPlanUpload(file);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Pointer down handler for dragging items on canvas
  const handlePointerDownItem = (e, itemType, itemId, currentX, currentY) => {
    if (!isEditMode) return;
    if (isDrawingWall) return;
    e.stopPropagation();

    if (itemType === "table") {
      onSelectTable(itemId);
    }

    setDraggingItem({
      type: itemType,
      id: itemId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: currentX,
      startY: currentY,
    });
  };

  // Canvas pan or wall drawing handler
  const handleCanvasPointerDown = (e) => {
    if (isDrawingWall) {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const rawX = (e.clientX - rect.left - panOffset.x) / zoomLevel;
      const rawY = (e.clientY - rect.top - panOffset.y) / zoomLevel;
      const snapX = Math.round(rawX / 10) * 10;
      const snapY = Math.round(rawY / 10) * 10;
      setDrawingWall({ x1: snapX, y1: snapY, x2: snapX, y2: snapY });
      return;
    }

    if (e.target !== canvasRef.current && !e.target.classList.contains("canvas-pan-surface")) return;
    if (isEditMode) {
      onSelectTable(null);
      return;
    }
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (drawingWall) {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const rawX = (e.clientX - rect.left - panOffset.x) / zoomLevel;
        const rawY = (e.clientY - rect.top - panOffset.y) / zoomLevel;
        let snapX = Math.round(rawX / 10) * 10;
        let snapY = Math.round(rawY / 10) * 10;

        if (e.shiftKey) {
          const dx = Math.abs(snapX - drawingWall.x1);
          const dy = Math.abs(snapY - drawingWall.y1);
          if (dx > dy) snapY = drawingWall.y1;
          else snapX = drawingWall.x1;
        }

        setDrawingWall((prev) => (prev ? { ...prev, x2: snapX, y2: snapY } : null));
        return;
      }

      if (isPanning) {
        setPanOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
        return;
      }

      if (!draggingItem) return;

      const deltaX = (e.clientX - draggingItem.startMouseX) / zoomLevel;
      const deltaY = (e.clientY - draggingItem.startMouseY) / zoomLevel;

      const rawX = draggingItem.startX + deltaX;
      const rawY = draggingItem.startY + deltaY;
      const snappedX = Math.round(rawX / 10) * 10;
      const snappedY = Math.round(rawY / 10) * 10;

      if (draggingItem.type === "table") {
        onTableUpdate(draggingItem.id, {
          pos_x: Math.max(10, snappedX),
          pos_y: Math.max(10, snappedY),
        });
      } else if (draggingItem.type === "cashier") {
        onFloorSettingsChange({
          ...floorSettingsRef.current,
          cashier_x: Math.max(10, snappedX),
          cashier_y: Math.max(10, snappedY),
        });
      }
    };

    const handlePointerUp = () => {
      if (drawingWall) {
        const dist = Math.hypot(drawingWall.x2 - drawingWall.x1, drawingWall.y2 - drawingWall.y1);
        if (dist >= 20) {
          const newWall = {
            id: `w_${Date.now()}`,
            x1: drawingWall.x1,
            y1: drawingWall.y1,
            x2: drawingWall.x2,
            y2: drawingWall.y2,
          };
          const currentWalls = Array.isArray(floorSettingsRef.current?.walls)
            ? floorSettingsRef.current.walls
            : [];
          onFloorSettingsChange({
            ...floorSettingsRef.current,
            walls: [...currentWalls, newWall],
          });
        }
        setDrawingWall(null);
      }

      setIsPanning(false);
      setDraggingItem(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    isPanning,
    panStart,
    draggingItem,
    drawingWall,
    zoomLevel,
    panOffset,
    onTableUpdate,
    onFloorSettingsChange,
    setPanOffset,
  ]);

  const handleRotateTable = (e, table) => {
    e.stopPropagation();
    const currentRot = table.rotation || 0;
    const nextRot = (currentRot + 45) % 360;
    onTableUpdate(table.id, { rotation: nextRot });
  };

  const isDark = theme === "black" || theme === "dark";

  // Build curved connection paths for merged table groups (strictly behind table nodes)
  const mergeConnections = useMemo(() => {
    const lines = [];
    mergedPairs.forEach(([id1, id2], idx) => {
      const t1 = processedTables.find((t) => String(t.id) === String(id1));
      const t2 = processedTables.find((t) => String(t.id) === String(id2));
      if (t1 && t2) {
        const { path, midX, midY } = getBezierCurveData(
          t1.center_x,
          t1.center_y,
          t2.center_x,
          t2.center_y
        );
        const isEitherOccupied = Boolean(t1.active_order_id || t2.active_order_id);
        const color = isEitherOccupied ? "#0ea5e9" : "#64748b";
        lines.push({
          id: `merge-${idx}`,
          path,
          midX,
          midY,
          label: `${t1.table_title} + ${t2.table_title}`,
          color,
          isEitherOccupied,
        });
      }
    });
    return lines;
  }, [mergedPairs, processedTables]);

  const isCashierHorizontal = (floorSettings.cashier_rotation || 0) % 180 === 90;

  return (
    <div
      ref={canvasRef}
      onPointerDown={handleCanvasPointerDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="absolute inset-0 w-full h-full bg-white dark:bg-zinc-950 overflow-hidden select-none"
      style={{
        cursor: isDrawingWall ? "crosshair" : isPanning ? "grabbing" : "default",
      }}
    >
      {/* Blueprint Grid Lines Background (Subtle architectural dot/grid pattern) */}
      {showGrid ? (
        <div
          className="canvas-pan-surface absolute inset-0 pointer-events-auto"
          style={{
            backgroundImage: isDark
              ? "linear-gradient(to right, rgba(63,63,70,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(63,63,70,0.35) 1px, transparent 1px)"
              : "linear-gradient(to right, rgba(226,232,240,0.75) 1px, transparent 1px), linear-gradient(to bottom, rgba(226,232,240,0.75) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
          }}
        />
      ) : (
        <div className="canvas-pan-surface absolute inset-0 pointer-events-auto" />
      )}

      {/* Main Transform Container for Zoom & Pan */}
      <div
        className="absolute inset-0 origin-top-left transition-transform duration-75 pointer-events-none"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
        }}
      >
        {/* Optional Custom Floor Plan Background Image */}
        {floorSettings?.floor_plan_image && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 flex items-center justify-center">
            <img
              src={getImageURL(floorSettings.floor_plan_image)}
              alt="Floor Plan Background"
              className="w-full h-full select-none"
              style={{
                objectFit: floorSettings.floor_plan_fit || "contain",
                opacity: floorSettings.floor_plan_opacity ?? 0.8,
              }}
            />
          </div>
        )}

        {/* SVG Layer (z-[1]): Architectural Boundary Walls & Merged Table Connectors (Strictly Behind Tables) */}
        <svg
          className="absolute inset-0 w-[2400px] h-[1600px] pointer-events-none z-[1] overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Architectural Wall Dividers */}
          <g>
            {walls.map((w) => {
              const isHovered = isEditMode && hoveredWallId === w.id;
              const midX = (w.x1 + w.x2) / 2;
              const midY = (w.y1 + w.y2) / 2;
              return (
                <g
                  key={w.id}
                  onMouseEnter={() => isEditMode && setHoveredWallId(w.id)}
                  onMouseLeave={() => isEditMode && setHoveredWallId(null)}
                  className={isEditMode ? "pointer-events-auto cursor-pointer" : "pointer-events-none"}
                >
                  <line
                    x1={w.x1}
                    y1={w.y1}
                    x2={w.x2}
                    y2={w.y2}
                    stroke={isHovered ? "#ef4444" : isDark ? "#475569" : "#94a3b8"}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-colors duration-150"
                  />
                  {isEditMode && (
                    <line
                      x1={w.x1}
                      y1={w.y1}
                      x2={w.x2}
                      y2={w.y2}
                      stroke="transparent"
                      strokeWidth="26"
                      strokeLinecap="round"
                    />
                  )}
                  {isHovered && (
                    <g
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextWalls = walls.filter((item) => item.id !== w.id);
                        onFloorSettingsChange({
                          ...floorSettingsRef.current,
                          walls: nextWalls,
                        });
                        setHoveredWallId(null);
                      }}
                    >
                      <circle cx={midX} cy={midY} r="13" fill="#ef4444" className="shadow-lg" />
                      <line
                        x1={midX - 4}
                        y1={midY - 4}
                        x2={midX + 4}
                        y2={midY + 4}
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <line
                        x1={midX + 4}
                        y1={midY - 4}
                        x2={midX - 4}
                        y2={midY + 4}
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </g>
                  )}
                </g>
              );
            })}

            {/* Currently drawing wall preview */}
            {drawingWall && (
              <g className="pointer-events-none">
                <line
                  x1={drawingWall.x1}
                  y1={drawingWall.y1}
                  x2={drawingWall.x2}
                  y2={drawingWall.y2}
                  stroke="#0ea5e9"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray="8 6"
                />
                <circle cx={drawingWall.x1} cy={drawingWall.y1} r="5" fill="#0ea5e9" />
                <circle cx={drawingWall.x2} cy={drawingWall.y2} r="5" fill="#0ea5e9" />
              </g>
            )}
          </g>

          {/* Curved Bezier Connection Lines for Merged Tables (Rendered Behind Table Nodes) */}
          {mergeConnections.map((m) => (
            <g key={m.id}>
              {/* Soft outer glow halo */}
              <path
                d={m.path}
                fill="none"
                stroke={m.color}
                strokeOpacity="0.18"
                strokeWidth="10"
                strokeLinecap="round"
              />
              {/* Crisp dashed link line */}
              <path
                d={m.path}
                fill="none"
                stroke={m.color}
                strokeWidth="3"
                strokeDasharray="7 5"
                strokeLinecap="round"
              />
            </g>
          ))}
        </svg>

        {/* Midpoint Linked Badges for Merged Tables (z-[2] — above SVG curve, strictly below z-10 tables) */}
        <div className="absolute inset-0 pointer-events-none z-[2]">
          {mergeConnections.map((m) => (
            <div
              key={`${m.id}-badge`}
              style={{
                left: `${m.midX}px`,
                top: `${m.midY}px`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full bg-white/95 dark:bg-zinc-900/95 border border-sky-200 dark:border-sky-800 shadow-sm flex items-center gap-1 text-[9.5px] font-extrabold text-[#0284c7] dark:text-sky-300 whitespace-nowrap"
            >
              <IconLink size={11} className="shrink-0" />
              <span>{m.label}</span>
            </div>
          ))}
        </div>

        {/* Cashier Station (z-[3] — Architectural Counter Card) */}
        {floorSettings.show_cashier && (
          <div
            onPointerDown={(e) =>
              isEditMode &&
              handlePointerDownItem(
                e,
                "cashier",
                "cashier",
                floorSettings.cashier_x ?? 60,
                floorSettings.cashier_y ?? 260
              )
            }
            className={`absolute rounded-2xl border-2 border-slate-300/90 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xs flex items-center justify-center shadow-sm z-[3] group transition-all ${
              isEditMode
                ? "cursor-grab active:cursor-grabbing hover:border-[#0ea5e9] hover:shadow-md pointer-events-auto"
                : "pointer-events-none"
            }`}
            style={{
              left: `${floorSettings.cashier_x ?? 60}px`,
              top: `${floorSettings.cashier_y ?? 260}px`,
              width: isCashierHorizontal ? "168px" : "76px",
              height: isCashierHorizontal ? "72px" : "168px",
            }}
          >
            {/* Subtle Counter Accent Rim */}
            <div
              className={`absolute bg-slate-200/80 dark:bg-zinc-800 rounded-full ${
                isCashierHorizontal
                  ? "top-1.5 left-3 right-3 h-1.5"
                  : "left-1.5 top-3 bottom-3 w-1.5"
              }`}
            />

            <div
              className={`select-none pointer-events-none flex items-center justify-center gap-1.5 px-2 text-center ${
                isCashierHorizontal ? "flex-row" : "flex-col rotate-[-90deg] whitespace-nowrap"
              }`}
            >
              <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                <IconDeviceDesktopAnalytics size={13} />
              </div>
              <span className="text-[11px] font-extrabold tracking-wider text-slate-600 dark:text-slate-300 uppercase leading-snug">
                {t("tables.cashier", "CASHIER")}
              </span>
            </div>

            {/* In Edit Mode: rotate & hide buttons */}
            {isEditMode && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const nextRot = ((floorSettings.cashier_rotation || 0) + 90) % 360;
                    onFloorSettingsChange({
                      ...floorSettingsRef.current,
                      cashier_rotation: nextRot,
                    });
                  }}
                  title={t("tables.rotate", "Rotate 90°")}
                  className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 shadow-md flex items-center justify-center text-slate-600 dark:text-slate-200 hover:text-[#0ea5e9] hover:border-[#0ea5e9] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity z-30"
                >
                  <IconRotate size={13} />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFloorSettingsChange({
                      ...floorSettingsRef.current,
                      show_cashier: false,
                    });
                  }}
                  title={t("tables.hide_cashier", "Hide Cashier")}
                  className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-white dark:bg-zinc-800 border border-rose-300 dark:border-rose-900 shadow-md flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity z-30"
                >
                  <IconTrash size={13} />
                </button>
              </>
            )}
          </div>
        )}

        {/* Interactive Bindo Tables (z-10) */}
        <div className="absolute inset-0 pointer-events-none z-10">
          {processedTables.map((table) => {
            const isSelected = String(selectedTableId) === String(table.id);
            const isMergeSource = String(mergeSourceId) === String(table.id);
            const isOccupied = Boolean(table.active_order_id);
            let isDimmed = false;
            if (activeFilter === "available") {
              isDimmed = isOccupied;
            } else if (activeFilter === "occupied") {
              isDimmed = !isOccupied;
            } else if (activeFilter === "reserved") {
              isDimmed = !table.has_reservation || isOccupied;
            } else if (activeFilter === "attention") {
              isDimmed = !table.is_over_time && !table.is_alert;
            } else if (activeFilter && activeFilter !== "all" && activeFilter !== "pax") {
              isDimmed = getTableBindoStatus(table) !== activeFilter;
            }

            return (
              <BindoTableNode
                key={table.id}
                table={table}
                currency={currency}
                isSelected={isSelected}
                isMergeSource={isMergeSource}
                isMergeTarget={isMergeMode && !isMergeSource}
                isEditMode={isEditMode}
                isDimmed={isDimmed}
                onPointerDown={(e) =>
                  handlePointerDownItem(e, "table", table.id, table.pos_x, table.pos_y)
                }
                onClick={(tbl) => {
                  onSelectTable(tbl.id);
                  onTableClick(tbl);
                }}
                onRotate={handleRotateTable}
                onDelete={onTableDelete}
                onEdit={onOpenEditModal}
              />
            );
          })}
        </div>
      </div>

      {/* Floating Bottom Left Zoom & Grid Controls */}
      {!hideControls && (
        <div className="absolute bottom-4 left-4 flex items-center gap-1 p-1 bg-white/95 dark:bg-zinc-900/95 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg backdrop-blur-md z-30 select-none">
          <button
            type="button"
            onClick={() => setShowGrid((prev) => !prev)}
            title={showGrid ? t("tables.hide_grid", "Hide Grid Lines") : t("tables.show_grid", "Show Grid Lines")}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition cursor-pointer ${
              showGrid
                ? "text-[#0ea5e9] bg-sky-50 dark:bg-zinc-800"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            <IconGridDots size={16} />
          </button>

          <div className="w-[1px] h-4 bg-slate-200 dark:bg-zinc-700 my-auto mx-0.5" />

          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
            title="Zoom Out"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <IconMinus size={16} />
          </button>

          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))))}
            title="Zoom In"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <IconPlus size={16} />
          </button>

          <button
            type="button"
            onClick={() => {
              setZoomLevel(1);
              setPanOffset({ x: 0, y: 0 });
            }}
            title="Reset Zoom"
            className="px-2.5 h-8 flex items-center justify-center rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <span>{Math.round(zoomLevel * 100)}%</span>
          </button>
        </div>
      )}

      {/* Drag & Drop Floor Plan File Overlay (in Edit Mode) */}
      {isDragOver && (
        <div className="absolute inset-0 z-40 bg-sky-500/10 border-2 border-dashed border-[#0ea5e9] rounded-2xl flex items-center justify-center pointer-events-none backdrop-blur-2xs">
          <div className="bg-white dark:bg-zinc-800 px-5 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-[#0ea5e9] font-bold text-sm">
            <IconUpload size={22} className="animate-bounce" />
            <span>{t("tables.drop_floor_plan", "Drop floor plan background image here")}</span>
          </div>
        </div>
      )}

      {/* Edit Mode Floor Plan Toolbar (Top Right) */}
      {isEditMode && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-3.5 right-4 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200 dark:border-zinc-800 text-xs shadow-md z-30"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={handleFileSelect}
          />

          {!floorSettings?.floor_plan_image ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-[#0284c7] dark:bg-sky-950/60 dark:text-sky-300 font-bold transition border border-sky-200 dark:border-sky-800 cursor-pointer"
            >
              {isUploading ? <IconLoader2 size={15} className="animate-spin" /> : <IconUpload size={15} />}
              <span>{t("tables.upload_floor_plan", "Upload Floor Plan")}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <IconPhoto size={14} className="text-[#0ea5e9]" />
                {t("tables.floor_plan", "Floor Plan")}
              </span>
              <button
                type="button"
                onClick={onFloorPlanDelete}
                className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
              >
                <IconTrash size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
