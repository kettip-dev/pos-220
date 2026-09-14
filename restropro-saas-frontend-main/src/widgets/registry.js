/**
 * Widget Registry
 * ──────────────────────────────────────────────────────────────
 * The single source of truth for every widget that can be placed
 * on the customizable dashboard. Each widget registers a descriptor
 * (see ./types.js) that drives the picker, the renderer, RBAC/plan
 * gating, and the auto-generated settings panel.
 *
 * Adding a widget:
 *   import { registerWidget } from "../registry";
 *   registerWidget({ type, category, title, ..., component });
 *
 * The dashboard never imports concrete widget components directly —
 * everything flows through getWidget(type) so the framework stays
 * loosely coupled to the catalog.
 */

const _registry = new Map();
const _categories = new Map();

const DEFAULT_CATEGORY_ORDER = [
  "sales", "orders", "kitchen", "inventory",
  "customers", "ops", "finance", "productivity", "system",
];

export function registerWidget(descriptor) {
  if (!descriptor || !descriptor.type) {
    throw new Error("registerWidget: descriptor.type is required");
  }
  if (!descriptor.component) {
    throw new Error(`registerWidget(${descriptor.type}): component is required`);
  }
  if (_registry.has(descriptor.type)) {
    if (import.meta.env?.DEV) {
      console.warn(`[widgets] re-registering type "${descriptor.type}"`);
    }
  }
  const normalized = {
    type: descriptor.type,
    category: descriptor.category || "system",
    title: descriptor.title || descriptor.type,
    description: descriptor.description || "",
    icon: descriptor.icon || null,
    scope: descriptor.scope || null,
    plan: descriptor.plan || null,
    defaultSize: descriptor.defaultSize || { w: 4, h: 3 },
    minSize: descriptor.minSize || { w: 2, h: 2 },
    maxSize: descriptor.maxSize || { w: 12, h: 12 },
    configSchema: descriptor.configSchema || [],
    defaultConfig: descriptor.defaultConfig || {},
    component: descriptor.component,
    preview: descriptor.preview || null,
    tags: descriptor.tags || [],
    refreshable: descriptor.refreshable !== false,
    fullscreenable: descriptor.fullscreenable !== false,
    allowMultiple: !!descriptor.allowMultiple,
  };
  _registry.set(normalized.type, normalized);

  const cat = normalized.category;
  if (!_categories.has(cat)) _categories.set(cat, new Set());
  _categories.get(cat).add(normalized.type);

  return normalized;
}

export function registerCategory(key, meta) {
  // Optional: register category metadata (label, icon, color).
  // Categories work without registration but this is how you give them
  // a translated label for the picker UI.
  _categories.set(key, _categories.get(key) || new Set());
  _categories.set(`__meta:${key}`, meta);
}

export function getWidget(type) {
  return _registry.get(type) || null;
}

export function getAllWidgets() {
  return Array.from(_registry.values());
}

export function getWidgetsByCategory(category) {
  const set = _categories.get(category);
  if (!set || !(set instanceof Set)) return [];
  return Array.from(set).map((t) => _registry.get(t)).filter(Boolean);
}

export function getCategoryMeta(key) {
  return _categories.get(`__meta:${key}`) || null;
}

export function getCategoryOrder() {
  // Stable ordering: known categories first, then any custom ones.
  const known = DEFAULT_CATEGORY_ORDER.filter((k) => _categories.has(k));
  const extras = Array.from(_categories.keys()).filter(
    (k) => !k.startsWith("__meta:") && !DEFAULT_CATEGORY_ORDER.includes(k)
  );
  return [...known, ...extras];
}

/**
 * Filter the catalog by a user's RBAC scopes and plan tier.
 * Used by the picker to only show widgets the user can actually use.
 */
export function getAvailableWidgets({ userScopes = [], userPlan = null } = {}) {
  const scopeSet = new Set(userScopes);
  return getAllWidgets().filter((w) => {
    if (w.scope && !scopeSet.has(w.scope)) return false;
    // Plan gating is informational at this layer — we still return the widget
    // and let the picker render an "upgrade" badge. Server enforces hard gating.
    return true;
  });
}

export function isWidgetLockedByPlan(widget, userPlan) {
  if (!widget?.plan) return false;
  if (!userPlan) return false;
  const order = ["free", "starter", "pro", "business", "enterprise"];
  const required = order.indexOf(String(widget.plan).toLowerCase());
  const have = order.indexOf(String(userPlan).toLowerCase());
  if (required === -1 || have === -1) return false;
  return have < required;
}
