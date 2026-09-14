import React, { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  IconRotate,
  IconPencil,
  IconTrash,
  IconUpload,
  IconPhoto,
  IconAspectRatio,
  IconLoader2,
  IconPlus,
  IconMinus,
  IconFocusCentered,
  IconLink,
} from "@tabler/icons-react";
import { useTheme } from "../../contexts/ThemeContext";
import { getImageURL } from "../../helpers/ImageHelper";
import BindoTableNode, { BINDO_STATUS_CONFIG, getTableBindoStatus } from "./BindoTableNode";

function getBezierPath(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / (dist || 1);
  const ny = dx / (dist || 1);
  const curvature = Math.min(32, Math.max(12, dist * 0.2));

  const cx1 = x1 + dx * 0.35 + nx * curvature;
  const cy1 = y1 + dy * 0.35 + ny * curvature;
  const cx2 = x1 + dx * 0.65 + nx * curvature;
  const cy2 = y1 + dy * 0.65 + ny * curvature;

  return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
}

export default function FloorPlanCanvas({
  tables = [],
  floorSettings = {
    show_cashier: true,
    cashier_x: 60,
    cashier_y: 260,
    floor_plan_image: null,
    floor_plan_opacity: 0.8,
    floor_plan_fit: "contain",
    walls: null,
  },
  mergedPairs = [], // e.g. [ [id1, id2], [id2, id3] ]
  isMergeMode = false,
  mergeSourceId = null,
  isEditMode = false,
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
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Dragging state for tables, walls, and cashier
  const [draggingItem, setDraggingItem] = useState(null); // { type, id, startMouseX, startMouseY, startX, startY }

  // Default architectural walls if none saved in floorSettings
  const defaultWalls = useMemo(() => [
    { id: "w1", x1: 50, y1: 80, x2: 50, y2: 560 },
    { id: "w2", x1: 50, y1: 80, x2: 500, y2: 80 },
    { id: "w3", x1: 260, y1: 120, x2: 480, y2: 120 },
    { id: "w4", x1: 480, y1: 180, x2: 600, y2: 280 },
    { id: "w5", x1: 240, y1: 420, x2: 380, y2: 560 },
    { id: "w6", x1: 160, y1: 580, x2: 520, y2: 580 },
  ], []);

  const walls = floorSettings.walls || defaultWalls;

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

      const shape = tbl.shape || (tbl.seating_capacity > 4 ? "rectangle" : tbl.seating_capacity > 2 ? "square" : "round");
      let w = 72;
      let h = 72;
      if (shape === "round") {
        w = (tbl.seating_capacity || 2) >= 8 ? 96 : 80;
        h = w;
      } else if (shape === "rectangle") {
        w = 124;
        h = 74;
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

  // Canvas pan handler (when clicking blank canvas in non-edit mode)
  const handleCanvasPointerDown = (e) => {
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
          ...floorSettings,
          cashier_x: Math.max(10, snappedX),
          cashier_y: Math.max(10, snappedY),
        });
      }
    };

    const handlePointerUp = () => {
      setIsPanning(false);
      setDraggingItem(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isPanning, panStart, draggingItem, zoomLevel, onTableUpdate, onFloorSettingsChange, floorSettings]);

  const handleRotateTable = (e, table) => {
    e.stopPropagation();
    const currentRot = table.rotation || 0;
    const nextRot = (currentRot + 45) % 360;
    onTableUpdate(table.id, { rotation: nextRot });
  };

  const isDark = theme === "black";

  // Build curved connection paths for merged table groups
  const mergeConnections = useMemo(() => {
    const lines = [];
    mergedPairs.forEach(([id1, id2], idx) => {
      const t1 = processedTables.find((t) => String(t.id) === String(id1));
      const t2 = processedTables.find((t) => String(t.id) === String(id2));
      if (t1 && t2) {
        const path = getBezierPath(t1.center_x, t1.center_y, t2.center_x, t2.center_y);
        const status1 = getTableBindoStatus(t1);
        const color = BINDO_STATUS_CONFIG[status1]?.bg.replace("bg-[", "").replace("]", "") || "#0ea5e9";
        lines.push({ id: `merge-${idx}`, path, x1: t1.center_x, y1: t1.center_y, x2: t2.center_x, y2: t2.center_y, color });
      }
    });
    return lines;
  }, [mergedPairs, processedTables]);

  return (
    <div
      ref={canvasRef}
      onPointerDown={handleCanvasPointerDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative w-full h-full bg-[#f8fafc] dark:bg-zinc-950 overflow-hidden select-none"
      style={{
        height: typeof canvasHeight === "number" ? `${canvasHeight}px` : canvasHeight,
        cursor: isPanning ? "grabbing" : "default",
      }}
    >
      {/* Blueprint Grid Lines Background (Faint Bindo pattern) */}
      <div
        className="canvas-pan-surface absolute inset-0 pointer-events-auto"
        style={{
          backgroundImage: isDark
            ? "linear-gradient(to right, #27272a 1px, transparent 1px), linear-gradient(to bottom, #27272a 1px, transparent 1px)"
            : "linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
        }}
      />

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

        {/* SVG Layer: Architectural Boundary Walls & Merged Table Bezier Curves */}
        <svg
          className="absolute inset-0 w-[2400px] h-[1600px] pointer-events-none z-5 overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Architectural Wall Dividers */}
          <g opacity={isDark ? "0.6" : "0.75"}>
            {walls.map((w) => (
              <line
                key={w.id}
                x1={w.x1}
                y1={w.y1}
                x2={w.x2}
                y2={w.y2}
                stroke={isDark ? "#3f3f46" : "#cbd5e1"}
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>

          {/* Curved Bezier Connection Lines for Merged Tables */}
          {mergeConnections.map((m) => (
            <g key={m.id} className="animate-fade-in">
              <path
                d={m.path}
                fill="none"
                stroke={m.color}
                strokeWidth="4"
                strokeLinecap="round"
                className="drop-shadow-sm"
              />
              <circle cx={m.x1} cy={m.y1} r="5" fill={m.color} />
              <circle cx={m.x2} cy={m.y2} r="5" fill={m.color} />
            </g>
          ))}
        </svg>

        {/* Cashier Station (if enabled) */}
        {floorSettings.show_cashier && (
          <div
            onPointerDown={(e) =>
              handlePointerDownItem(
                e,
                "cashier",
                "cashier",
                floorSettings.cashier_x ?? 60,
                floorSettings.cashier_y ?? 260
              )
            }
            className={`absolute rounded-2xl border-2 border-slate-300 dark:border-zinc-700 bg-slate-100/90 dark:bg-zinc-800/90 flex items-center justify-center text-xs font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase shadow-xs pointer-events-auto ${
              isEditMode ? "cursor-grab active:cursor-grabbing hover:border-[#0ea5e9]" : ""
            }`}
            style={{
              left: `${floorSettings.cashier_x ?? 60}px`,
              top: `${floorSettings.cashier_y ?? 260}px`,
              width: "74px",
              height: "160px",
            }}
          >
            <span className="rotate-[-90deg] select-none pointer-events-none">
              {t("tables.cashier", "CASHIER")}
            </span>
          </div>
        )}

        {/* Interactive Bindo Tables */}
        <div className="absolute inset-0 pointer-events-auto z-10">
          {processedTables.map((table) => {
            const isSelected = selectedTableId === table.id;
            const isMergeSource = mergeSourceId === table.id;
            const isDimmed =
              activeFilter &&
              activeFilter !== "pax" &&
              getTableBindoStatus(table) !== activeFilter;

            return (
              <BindoTableNode
                key={table.id}
                table={table}
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

      {/* Floating Bottom Left Zoom Controls (Matching Bindo Labs iPad POS) */}
      <div className="absolute bottom-4 left-4 flex items-center gap-1 p-1 bg-white/95 dark:bg-zinc-900/95 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg backdrop-blur-md z-30 select-none">
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
