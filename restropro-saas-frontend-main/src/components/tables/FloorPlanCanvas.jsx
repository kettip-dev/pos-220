import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
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

const GRID_SIZE = 28;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const DRAG_THRESHOLD = 6; // px of movement before a touch becomes a pan (keeps taps as taps)
const MAX_FLING_SPEED = 2.5; // px per ms — caps momentum so a fast flick glides ~500px, not off-screen

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

  const [showGrid, setShowGrid] = useState(true);

  // ── Smooth pan / zoom engine ─────────────────────────────────────────
  // The live view lives in a ref and is written straight to the DOM once per
  // animation frame. React state is only updated when a gesture settles, so
  // tables do not re-render while the user is scrolling.
  const contentRef = useRef(null);
  const gridRef = useRef(null);
  const viewRef = useRef({ x: panOffset.x, y: panOffset.y, z: zoomLevel });
  const lastCommittedRef = useRef({ x: panOffset.x, y: panOffset.y, z: zoomLevel });
  const rafRef = useRef(0);
  const momentumRafRef = useRef(0);
  const wheelCommitTimerRef = useRef(0);
  const transitionTimerRef = useRef(0);
  const pointersRef = useRef(new Map()); // pointerId -> { x, y }
  const gestureRef = useRef(null); // { type: "pending" | "pan" | "pinch", ... }
  const velocitySamplesRef = useRef([]); // [{ t, x, y }]
  const suppressClickRef = useRef(false);
  const settersRef = useRef({ setPanOffset, setZoomLevel });
  settersRef.current = { setPanOffset, setZoomLevel };

  const applyView = (animate = false) => {
    const { x, y, z } = viewRef.current;
    const content = contentRef.current;
    if (content) {
      content.style.transition = animate ? "transform 160ms ease-out" : "none";
      content.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${z})`;
    }
    const grid = gridRef.current;
    if (grid) {
      const size = GRID_SIZE * z;
      grid.style.backgroundSize = `${size}px ${size}px`;
      grid.style.backgroundPosition = `${x}px ${y}px`;
    }
    if (animate) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = setTimeout(() => {
        if (contentRef.current) contentRef.current.style.transition = "none";
      }, 180);
    }
  };

  const scheduleApply = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      applyView();
    });
  };

  const setGestureActive = (active) => {
    const content = contentRef.current;
    // will-change only while moving: keeps panning on the GPU without leaving
    // text blurry (rasterised at the old scale) once the gesture ends.
    if (content) content.style.willChange = active ? "transform" : "auto";
    if (canvasRef.current) canvasRef.current.style.cursor = active ? "grabbing" : "";
  };

  const commitView = () => {
    const { x, y, z } = viewRef.current;
    const last = lastCommittedRef.current;
    if (last.x === x && last.y === y && last.z === z) return;
    lastCommittedRef.current = { x, y, z };
    if (last.x !== x || last.y !== y) settersRef.current.setPanOffset({ x, y });
    if (last.z !== z) settersRef.current.setZoomLevel(z);
  };

  const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  // Zoom keeping the content point under (clientX, clientY) fixed on screen
  const zoomAt = (nextZ, clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const v = viewRef.current;
    const z = clampZoom(nextZ);
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const cx = (px - v.x) / v.z;
    const cy = (py - v.y) / v.z;
    viewRef.current = { x: px - cx * z, y: py - cy * z, z };
  };

  const stopMomentum = () => {
    if (momentumRafRef.current) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = 0;
    }
  };

  const startMomentum = () => {
    const samples = velocitySamplesRef.current;
    const now = performance.now();
    const recent = samples.filter((s) => now - s.t < 100);
    if (recent.length < 2) return false;
    const first = recent[0];
    const last = recent[recent.length - 1];
    const dt = last.t - first.t;
    // Finger paused before lifting → no fling
    if (dt <= 0 || now - last.t > 50) return false;
    let vx = (last.x - first.x) / dt; // px per ms
    let vy = (last.y - first.y) / dt;
    const speed = Math.hypot(vx, vy);
    if (speed < 0.25) return false;
    if (speed > MAX_FLING_SPEED) {
      vx = (vx / speed) * MAX_FLING_SPEED;
      vy = (vy / speed) * MAX_FLING_SPEED;
    }

    setGestureActive(true);
    let prev = now;
    const step = (t) => {
      const elapsed = Math.min(32, t - prev);
      prev = t;
      const decay = Math.pow(0.995, elapsed); // friction per ms
      vx *= decay;
      vy *= decay;
      viewRef.current = {
        ...viewRef.current,
        x: viewRef.current.x + vx * elapsed,
        y: viewRef.current.y + vy * elapsed,
      };
      applyView();
      if (Math.hypot(vx, vy) < 0.02) {
        momentumRafRef.current = 0;
        setGestureActive(false);
        commitView();
        return;
      }
      momentumRafRef.current = requestAnimationFrame(step);
    };
    momentumRafRef.current = requestAnimationFrame(step);
    return true;
  };

  // External / button-driven changes to zoom & pan flow back into the live view
  useLayoutEffect(() => {
    const last = lastCommittedRef.current;
    if (last.x === panOffset.x && last.y === panOffset.y && last.z === zoomLevel) return;
    lastCommittedRef.current = { x: panOffset.x, y: panOffset.y, z: zoomLevel };
    viewRef.current = { x: panOffset.x, y: panOffset.y, z: zoomLevel };
  }, [panOffset.x, panOffset.y, zoomLevel]);

  // Keep the DOM in sync with the live view after every render (cheap: 2 style writes)
  useLayoutEffect(() => {
    applyView();
  });

  const startPinch = () => {
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    gestureRef.current = {
      type: "pinch",
      startDist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      startMidX: (a.x + b.x) / 2,
      startMidY: (a.y + b.y) / 2,
      startView: { ...viewRef.current },
    };
    setGestureActive(true);
  };

  const startPendingPan = (x, y, alreadyMoved = false) => {
    gestureRef.current = {
      type: alreadyMoved ? "pan" : "pending",
      startX: x,
      startY: y,
      startPanX: viewRef.current.x,
      startPanY: viewRef.current.y,
    };
    velocitySamplesRef.current = [{ t: performance.now(), x: viewRef.current.x, y: viewRef.current.y }];
  };

  // Capture phase: runs before table nodes stop propagation, so a swipe that
  // starts on a table still scrolls the floor (a plain tap still opens it).
  const handleCanvasPointerDownCapture = (e) => {
    suppressClickRef.current = false;
    stopMomentum();
    if (isDrawingWall) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const onPanSurface =
      e.target === canvasRef.current || e.target.classList?.contains("canvas-pan-surface");
    // In edit mode, pointer-downs on tables / cashier drag the item instead.
    if (isEditMode && !onPanSurface && (e.isPrimary || pointersRef.current.size === 0)) return;

    // A primary pointer means no other pointer is down: drop any stale entries
    // (e.g. a pointerup that was swallowed by an alert or a lost window focus).
    if (e.isPrimary) pointersRef.current.clear();
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2) {
      setDraggingItem(null);
      startPinch();
    } else {
      startPendingPan(e.clientX, e.clientY);
    }
  };

  // Window-level gesture listeners, registered once and reading refs only
  useEffect(() => {
    const onMove = (e) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gestureRef.current;
      if (!g) return;

      if (g.type === "pinch") {
        const pts = [...pointersRef.current.values()];
        if (pts.length < 2) return;
        const [a, b] = pts;
        const dist = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const sv = g.startView;
        const z = clampZoom((sv.z * dist) / g.startDist);
        // Content point that was under the starting midpoint follows the fingers
        const cx = (g.startMidX - rect.left - sv.x) / sv.z;
        const cy = (g.startMidY - rect.top - sv.y) / sv.z;
        viewRef.current = { x: midX - rect.left - cx * z, y: midY - rect.top - cy * z, z };
        scheduleApply();
        return;
      }

      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (g.type === "pending") {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        g.type = "pan";
        suppressClickRef.current = true;
        setGestureActive(true);
      }
      viewRef.current = { ...viewRef.current, x: g.startPanX + dx, y: g.startPanY + dy };
      const samples = velocitySamplesRef.current;
      samples.push({ t: performance.now(), x: viewRef.current.x, y: viewRef.current.y });
      if (samples.length > 8) samples.shift();
      scheduleApply();
    };

    const onUp = (e) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.delete(e.pointerId);
      const g = gestureRef.current;
      if (!g) return;

      if (g.type === "pinch") {
        suppressClickRef.current = true;
        const remaining = [...pointersRef.current.values()][0];
        if (remaining) {
          // One finger lifted: continue as a pan with the other finger
          startPendingPan(remaining.x, remaining.y, true);
          return;
        }
      }

      if (pointersRef.current.size > 0) return;
      gestureRef.current = null;
      if (g.type === "pending") return; // simple tap — let the click through

      applyView();
      const flung = e.type === "pointerup" && g.type === "pan" && startMomentum();
      if (!flung) {
        setGestureActive(false);
        commitView();
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swallow the click that follows a drag so panning never opens a table
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onClickCapture = (e) => {
      if (!suppressClickRef.current) return;
      suppressClickRef.current = false;
      e.stopPropagation();
      e.preventDefault();
    };
    el.addEventListener("click", onClickCapture, true);
    return () => el.removeEventListener("click", onClickCapture, true);
  }, []);

  // Mouse wheel / trackpad: two-finger scroll pans, pinch or Ctrl+wheel zooms.
  // Must be a non-passive native listener so preventDefault works.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      stopMomentum();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1;
      const dx = e.deltaX * unit;
      const dy = e.deltaY * unit;
      if (e.ctrlKey || e.metaKey) {
        zoomAt(viewRef.current.z * Math.exp(-dy * 0.01), e.clientX, e.clientY);
      } else if (e.shiftKey && dx === 0) {
        viewRef.current = { ...viewRef.current, x: viewRef.current.x - dy };
      } else {
        viewRef.current = {
          ...viewRef.current,
          x: viewRef.current.x - dx,
          y: viewRef.current.y - dy,
        };
      }
      scheduleApply();
      clearTimeout(wheelCommitTimerRef.current);
      wheelCommitTimerRef.current = setTimeout(commitView, 150);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Safari trackpad pinch fires gesture events instead of ctrl+wheel
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof window.GestureEvent === "undefined") return;
    let startZ = 1;
    const onStart = (e) => {
      e.preventDefault();
      startZ = viewRef.current.z;
    };
    const onChange = (e) => {
      e.preventDefault();
      zoomAt(startZ * e.scale, e.clientX, e.clientY);
      scheduleApply();
    };
    const onEnd = (e) => {
      e.preventDefault();
      commitView();
    };
    el.addEventListener("gesturestart", onStart);
    el.addEventListener("gesturechange", onChange);
    el.addEventListener("gestureend", onEnd);
    return () => {
      el.removeEventListener("gesturestart", onStart);
      el.removeEventListener("gesturechange", onChange);
      el.removeEventListener("gestureend", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup any in-flight frames / timers on unmount
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(momentumRafRef.current);
      clearTimeout(wheelCommitTimerRef.current);
      clearTimeout(transitionTimerRef.current);
    },
    []
  );

  // Zoom buttons: zoom around the centre of the visible canvas, animated
  const zoomByButton = (delta) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    stopMomentum();
    const next = Number((viewRef.current.z + delta).toFixed(2));
    zoomAt(next, rect.left + rect.width / 2, rect.top + rect.height / 2);
    applyView(true);
    commitView();
  };

  const resetView = () => {
    stopMomentum();
    viewRef.current = { x: 0, y: 0, z: 1 };
    applyView(true);
    commitView();
  };

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

  // Convert a screen point to snapped floor-plan coordinates
  const toFloorPoint = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const v = viewRef.current;
    return {
      x: Math.round((clientX - rect.left - v.x) / v.z / 10) * 10,
      y: Math.round((clientY - rect.top - v.y) / v.z / 10) * 10,
    };
  };

  // Canvas wall drawing / deselect handler (panning is handled in the capture phase)
  const handleCanvasPointerDown = (e) => {
    if (isDrawingWall) {
      if (!canvasRef.current) return;
      const { x, y } = toFloorPoint(e.clientX, e.clientY);
      setDrawingWall({ x1: x, y1: y, x2: x, y2: y });
      return;
    }

    if (e.target !== canvasRef.current && !e.target.classList.contains("canvas-pan-surface")) return;
    if (isEditMode) onSelectTable(null);
  };

  // Edit-mode item dragging & wall drawing. Only re-subscribes when a drag or
  // wall starts/changes — never during plain panning.
  useEffect(() => {
    if (!drawingWall && !draggingItem) return;

    const handlePointerMove = (e) => {
      if (drawingWall) {
        if (!canvasRef.current) return;
        let { x: snapX, y: snapY } = toFloorPoint(e.clientX, e.clientY);

        if (e.shiftKey) {
          const dx = Math.abs(snapX - drawingWall.x1);
          const dy = Math.abs(snapY - drawingWall.y1);
          if (dx > dy) snapY = drawingWall.y1;
          else snapX = drawingWall.x1;
        }

        setDrawingWall((prev) => (prev ? { ...prev, x2: snapX, y2: snapY } : null));
        return;
      }

      if (!draggingItem) return;
      // Second finger turned this into a pinch — stop dragging the item
      if (gestureRef.current?.type === "pinch") return;

      const z = viewRef.current.z;
      const deltaX = (e.clientX - draggingItem.startMouseX) / z;
      const deltaY = (e.clientY - draggingItem.startMouseY) / z;

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

      setDraggingItem(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingItem, drawingWall, onTableUpdate, onFloorSettingsChange]);

  // Stable callbacks for memoised BindoTableNode — always call the latest props
  const latestRef = useRef({});
  latestRef.current = {
    onSelectTable,
    onTableClick,
    onTableUpdate,
    onTableDelete,
    onOpenEditModal,
    handlePointerDownItem,
  };

  const handleNodePointerDown = useCallback((e, table) => {
    latestRef.current.handlePointerDownItem(e, "table", table.id, table.pos_x, table.pos_y);
  }, []);

  const handleNodeClick = useCallback((tbl) => {
    latestRef.current.onSelectTable(tbl.id);
    latestRef.current.onTableClick(tbl);
  }, []);

  const handleRotateTable = useCallback((e, table) => {
    e.stopPropagation();
    const currentRot = table.rotation || 0;
    const nextRot = (currentRot + 45) % 360;
    latestRef.current.onTableUpdate(table.id, { rotation: nextRot });
  }, []);

  const handleNodeDelete = useCallback((...args) => latestRef.current.onTableDelete(...args), []);
  const handleNodeEdit = useCallback((...args) => latestRef.current.onOpenEditModal(...args), []);

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
      onPointerDownCapture={handleCanvasPointerDownCapture}
      onPointerDown={handleCanvasPointerDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="absolute inset-0 w-full h-full bg-white dark:bg-zinc-950 overflow-hidden select-none"
      style={{
        cursor: isDrawingWall ? "crosshair" : undefined,
        // The canvas owns all touch gestures: stops the browser from scrolling /
        // zooming the page mid-drag (which cancels the pointer and stutters).
        touchAction: "none",
        overscrollBehavior: "contain",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      {/* Blueprint Grid Lines Background (Subtle architectural dot/grid pattern) */}
      {showGrid ? (
        <div
          ref={gridRef}
          className="canvas-pan-surface absolute inset-0 pointer-events-auto"
          style={{
            backgroundImage: isDark
              ? "linear-gradient(to right, rgba(63,63,70,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(63,63,70,0.35) 1px, transparent 1px)"
              : "linear-gradient(to right, rgba(226,232,240,0.75) 1px, transparent 1px), linear-gradient(to bottom, rgba(226,232,240,0.75) 1px, transparent 1px)",
          }}
        />
      ) : (
        <div className="canvas-pan-surface absolute inset-0 pointer-events-auto" />
      )}

      {/* Main Transform Container for Zoom & Pan */}
      <div
        ref={contentRef}
        className="absolute inset-0 origin-top-left pointer-events-none"
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
            className={`absolute rounded-2xl border-2 border-slate-300/90 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center shadow-sm z-[3] group transition-colors ${
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
                onPointerDown={handleNodePointerDown}
                onClick={handleNodeClick}
                onRotate={handleRotateTable}
                onDelete={handleNodeDelete}
                onEdit={handleNodeEdit}
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
            onClick={() => zoomByButton(-0.15)}
            title="Zoom Out"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <IconMinus size={16} />
          </button>

          <button
            type="button"
            onClick={() => zoomByButton(0.15)}
            title="Zoom In"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <IconPlus size={16} />
          </button>

          <button
            type="button"
            onClick={resetView}
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
