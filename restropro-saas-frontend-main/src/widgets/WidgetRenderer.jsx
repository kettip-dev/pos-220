import React, { Suspense } from "react";
import { IconLoader2, IconQuestionMark } from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { getWidget } from "./registry";
import WidgetShell from "./WidgetShell";

/**
 * WidgetRenderer
 * ──────────────────────────────────────────────────────────────
 * Resolves a layout item → registered descriptor → component, then
 * renders it inside a <WidgetShell>. All widget instances on the
 * dashboard go through here, so cross-cutting concerns (drag handle,
 * error boundary, refresh, fullscreen) live in exactly one place.
 */
export default function WidgetRenderer({
  item,                 // LayoutItem
  editMode,
  onRemove,
  onConfigure,
  onRefresh,
  isRefreshing,
  context,              // shared bag passed to every widget (data, currency, etc.)
}) {
  const descriptor = getWidget(item.type);

  if (!descriptor) {
    return (
      <WidgetShell
        descriptor={{ title: "Unknown widget", icon: IconQuestionMark }}
        editMode={editMode}
        onRemove={onRemove}
      >
        <div className="flex h-full flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold text-foreground">Widget not registered</p>
          <p className="mt-1 text-xs text-restro-text">type: {item.type}</p>
        </div>
      </WidgetShell>
    );
  }

  const Comp = descriptor.component;
  const config = { ...(descriptor.defaultConfig || {}), ...(item.config || {}) };

  return (
    <WidgetShell
      descriptor={descriptor}
      editMode={editMode}
      onRemove={onRemove}
      onConfigure={onConfigure}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
    >
      <Suspense fallback={<WidgetSpinner />}>
        <Comp
          config={config}
          context={context}
          itemId={item.i}
        />
      </Suspense>
    </WidgetShell>
  );
}

function WidgetSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <IconLoader2 className="animate-spin text-restro-green" size={22} stroke={iconStroke} />
    </div>
  );
}
