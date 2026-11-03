/**
 * Dashboard Templates
 * ──────────────────────────────────────────────────────────────
 * Each template is a complete DashboardLayout — a one-click starter
 * pack a user (or new account) can apply. The first-time onboarding
 * wizard picks one of these.
 *
 * Layout JSON shape matches what is persisted server-side.
 */

import { BREAKPOINTS, COLS } from "../types";

let _idCounter = 0;
const id = () => `w_${Date.now().toString(36)}_${(++_idCounter).toString(36)}`;

// Helper to mirror the same lg placement to the smaller breakpoints
// (the canvas auto-stacks vertically below sm, so we only need lg/md/sm).
function place(x, y, w, h, mdW = w, smW = Math.min(w, 6)) {
  return {
    lg: { x, y, w, h },
    md: { x: Math.min(x, 10 - mdW), y, w: mdW, h },
    // Half-width tiles pair up two-per-row on tablets instead of stacking.
    sm: { x: smW <= 3 ? x % 6 : 0, y, w: smW, h },
    xs: { x: 0, y, w: 4, h },
    xxs: { x: 0, y, w: 2, h },
  };
}

function makeLayout(items) {
  return {
    version: 1,
    breakpoints: BREAKPOINTS,
    cols: COLS,
    items,
  };
}

// ─── Owner Overview (default for first-time users) ──────────────
export function ownerOverviewTemplate() {
  return makeLayout([
    { i: id(), type: "kpi.revenue",                   layout: place(0, 0, 3, 2) },
    { i: id(), type: "kpi.orders",                    layout: place(3, 0, 3, 2) },
    { i: id(), type: "kpi.aov",                       layout: place(6, 0, 3, 2) },
    { i: id(), type: "kpi.newCustomers",              layout: place(9, 0, 3, 2) },

    { i: id(), type: "sales.revenueTrend",            layout: place(0, 2, 8, 5) },
    { i: id(), type: "productivity.salesGoal",        layout: place(8, 2, 4, 5) },

    { i: id(), type: "sales.topItems",                layout: place(0, 7, 4, 5) },
    { i: id(), type: "sales.orderTypeDonut",          layout: place(4, 7, 4, 5) },
    { i: id(), type: "sales.paymentMix",              layout: place(8, 7, 4, 5) },

    { i: id(), type: "inventory.lowStock",            layout: place(0, 12, 4, 5) },
    { i: id(), type: "ops.feedback",                  layout: place(4, 12, 4, 5) },
    { i: id(), type: "ops.reservations",              layout: place(8, 12, 4, 5) },

    { i: id(), type: "sales.quickStat.repeatCustomers", layout: place(0, 17, 3, 2) },
    { i: id(), type: "sales.quickStat.cancelled",       layout: place(3, 17, 3, 2) },
    { i: id(), type: "sales.quickStat.tax",             layout: place(6, 17, 3, 2) },
    { i: id(), type: "sales.quickStat.serviceCharge",   layout: place(9, 17, 3, 2) },
  ]);
}

// ─── Cashier Focus ──────────────────────────────────────────────
export function cashierFocusTemplate() {
  return makeLayout([
    { i: id(), type: "kpi.revenue",            layout: place(0, 0, 4, 2) },
    { i: id(), type: "kpi.orders",             layout: place(4, 0, 4, 2) },
    { i: id(), type: "kpi.aov",                layout: place(8, 0, 4, 2) },

    { i: id(), type: "productivity.quickActions", layout: place(0, 2, 4, 5) },
    { i: id(), type: "orders.liveTicker",      layout: place(4, 2, 4, 5) },
    { i: id(), type: "sales.paymentMix",       layout: place(8, 2, 4, 5) },
  ]);
}

// ─── Kitchen Head ───────────────────────────────────────────────
export function kitchenHeadTemplate() {
  return makeLayout([
    { i: id(), type: "kpi.orders",              layout: place(0, 0, 4, 2) },
    { i: id(), type: "sales.quickStat.cancelled", layout: place(4, 0, 4, 2) },
    { i: id(), type: "productivity.clock",      layout: place(8, 0, 4, 2) },

    { i: id(), type: "orders.statusBoard",      layout: place(0, 2, 4, 4) },
    { i: id(), type: "sales.peakHours",         layout: place(4, 2, 8, 4) },

    { i: id(), type: "sales.topItems",          layout: place(0, 6, 6, 5) },
    { i: id(), type: "inventory.lowStock",      layout: place(6, 6, 6, 5) },
  ]);
}

// ─── Inventory Manager ──────────────────────────────────────────
export function inventoryManagerTemplate() {
  return makeLayout([
    { i: id(), type: "kpi.revenue",             layout: place(0, 0, 4, 2) },
    { i: id(), type: "kpi.orders",              layout: place(4, 0, 4, 2) },
    { i: id(), type: "kpi.aov",                 layout: place(8, 0, 4, 2) },

    { i: id(), type: "inventory.lowStock",      layout: place(0, 2, 6, 6) },
    { i: id(), type: "sales.topItems",          layout: place(6, 2, 6, 6) },
  ]);
}

// ─── HQ / Multi-location overview (single-tenant version for v1) ─
export function hqOverviewTemplate() {
  return makeLayout([
    { i: id(), type: "kpi.revenue",              layout: place(0, 0, 3, 2) },
    { i: id(), type: "kpi.orders",               layout: place(3, 0, 3, 2) },
    { i: id(), type: "kpi.aov",                  layout: place(6, 0, 3, 2) },
    { i: id(), type: "kpi.newCustomers",         layout: place(9, 0, 3, 2) },

    { i: id(), type: "sales.revenueTrend",       layout: place(0, 2, 8, 5) },
    { i: id(), type: "productivity.salesGoal",   layout: place(8, 2, 4, 5) },

    { i: id(), type: "customers.split",          layout: place(0, 7, 4, 4) },
    { i: id(), type: "finance.taxAccrued",       layout: place(4, 7, 4, 4) },
    { i: id(), type: "ops.feedback",             layout: place(8, 7, 4, 4) },
  ]);
}

export const TEMPLATES = [
  {
    key: "owner_overview",
    title: "Owner Overview",
    description: "All the key numbers at a glance. The default for owners and managers.",
    color: "#70B56A",
    build: ownerOverviewTemplate,
    recommendedFor: ["admin", "manager", "owner"],
  },
  {
    key: "cashier_focus",
    title: "Cashier Focus",
    description: "POS launcher, today's revenue, live activity.",
    color: "#4ECDC4",
    build: cashierFocusTemplate,
    recommendedFor: ["cashier", "captain"],
  },
  {
    key: "kitchen_head",
    title: "Kitchen Head",
    description: "Order board, peak hours, low stock — built for kitchen leads.",
    color: "#F97316",
    build: kitchenHeadTemplate,
    recommendedFor: ["chef", "kitchen"],
  },
  {
    key: "inventory_manager",
    title: "Inventory Manager",
    description: "Stock alerts and consumption-led KPIs.",
    color: "#F59E0B",
    build: inventoryManagerTemplate,
    recommendedFor: ["inventory"],
  },
  {
    key: "hq_overview",
    title: "HQ Overview",
    description: "Top-level KPIs + finance + customer split for owners with multiple sites.",
    color: "#A78BFA",
    build: hqOverviewTemplate,
    recommendedFor: ["admin", "owner"],
  },
];

export function getTemplate(key) {
  return TEMPLATES.find((t) => t.key === key) || null;
}

export function buildTemplate(key) {
  const t = getTemplate(key);
  return t ? t.build() : null;
}

export const DEFAULT_TEMPLATE_KEY = "owner_overview";
