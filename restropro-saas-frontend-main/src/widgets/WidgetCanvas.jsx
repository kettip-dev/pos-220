import React, { useMemo, useCallback } from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "./widget-canvas.css";

import WidgetRenderer from "./WidgetRenderer";
import { getWidget } from "./registry";
import { BREAKPOINTS, COLS, ROW_HEIGHT, GRID_MARGIN, CONTAINER_PADDING } from "./types";

const ResponsiveGridLayout = WidthProvider(Responsive);

/**
 * WidgetCanvas
 * ──────────────────────────────────────────────────────────────
 * The main grid surface. Renders all widgets registered on the layout,
 * wires up react-grid-layout, and emits `onLayoutChange` whenever the
 * user drags/resizes a widget. The parent owns the layout state.
 *
 * In view mode, drag/resize is disabled and the canvas behaves like a
 * static composition.
 */
export default function WidgetCanvas({
  layout,                  // normalized DashboardLayout
  editMode = false,
  context = {},            // shared bag (data, currency, t, ...)
  onLayoutChange,          // (nextLayout) => void
  onRemoveItem,            // (itemId) => void
}) {
  const items = layout?.items || [];

  // Build the per-breakpoint layouts RGL expects.
  const rglLayouts = useMemo(() => {
    const breakpoints = Object.keys(layout?.breakpoints || BREAKPOINTS);
    const out = {};
    for (const bp of breakpoints) {
      out[bp] = items.map((it) => {
        const desc = getWidget(it.type);
        const fallback = {
          x: 0,
          y: Infinity,
          w: desc?.defaultSize?.w ?? 4,
          h: desc?.defaultSize?.h ?? 3,
        };
        const placement = it.layout?.[bp] || it.layout?.lg || fallback;
        return {
          i: it.i,
          x: placement.x,
          y: placement.y,
          w: placement.w,
          h: placement.h,
          minW: desc?.minSize?.w ?? 2,
          minH: desc?.minSize?.h ?? 2,
          maxW: desc?.maxSize?.w ?? 12,
          maxH: desc?.maxSize?.h ?? 12,
        };
      });
    }
    return out;
  }, [items, layout]);

  const handleLayoutChange = useCallback(
    (currentLayout, allLayouts) => {
      if (!editMode || !onLayoutChange) return;

      const nextItems = items.map((it) => {
        const next = { ...it, layout: { ...(it.layout || {}) } };
        for (const bp of Object.keys(allLayouts || {})) {
          const placed = (allLayouts[bp] || []).find((p) => p.i === it.i);
          if (placed) {
            next.layout[bp] = { x: placed.x, y: placed.y, w: placed.w, h: placed.h };
          }
        }
        return next;
      });

      onLayoutChange({ ...layout, items: nextItems });
    },
    [editMode, items, layout, onLayoutChange]
  );

  if (!layout || items.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-dashed border-restro-border-green p-10 text-center">
        <div>
          <p className="text-base font-bold text-foreground">Your dashboard is empty</p>
          <p className="mt-1 text-sm text-restro-text">
            Click <span className="font-semibold">Customize</span> to add widgets.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveGridLayout
      className={`widget-canvas ${editMode ? "is-editing" : ""}`}
      layouts={rglLayouts}
      breakpoints={layout.breakpoints || BREAKPOINTS}
      cols={layout.cols || COLS}
      rowHeight={ROW_HEIGHT}
      margin={GRID_MARGIN}
      containerPadding={CONTAINER_PADDING}
      isDraggable={editMode}
      isResizable={editMode}
      draggableHandle=".widget-drag-handle"
      onLayoutChange={handleLayoutChange}
      compactType="vertical"
      preventCollision={false}
      useCSSTransforms
      measureBeforeMount={false}
    >
      {items.map((it) => (
        <div key={it.i} className="widget-cell">
          <WidgetRenderer
            item={it}
            editMode={editMode}
            context={context}
            onRemove={() => onRemoveItem && onRemoveItem(it.i)}
          />
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
