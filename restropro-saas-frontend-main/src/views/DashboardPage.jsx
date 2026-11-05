import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import {
  IconLoader2,
  IconAdjustments,
  IconPlus,
  IconCheck,
  IconRotateClockwise2,
  IconLayout2,
  IconX,
  IconEyeOff,
  IconEye,
  IconRefresh,
  IconShoppingBag,
  IconArmchair,
  IconChefHat,
  IconReceipt2,
  IconCalendarEvent,
  IconBox,
  IconChartBar,
} from "@tabler/icons-react";

import Page from "../components/Page";
import { iconStroke } from "../config/config";
import { useQBOAccess } from "../components/QBONavigation";
import { SCOPES } from "../config/scopes";

// ─── Widget framework ──────────────────────────────────────────
import "../widgets/register-all";  // side-effect: registers all widgets
import WidgetCanvas from "../widgets/WidgetCanvas";
import WidgetPickerDrawer from "../widgets/WidgetPickerDrawer";
import OnboardingWizard from "../widgets/OnboardingWizard";
import { useDashboardLayout } from "../widgets/hooks/useDashboardLayout";
import { useDashboardData } from "../widgets/hooks/useDashboardData";
import { getWidget } from "../widgets/registry";
import { TEMPLATES, buildTemplate, DEFAULT_TEMPLATE_KEY } from "../widgets/templates";
import { BREAKPOINTS, COLS } from "../widgets/types";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import useConfirm from "../hooks/useConfirm";

// Touch-first launchers shown under the greeting. Scopes mirror the
// ScopeProtectedRoute guards in App.jsx so tiles never lead to a 403.
const QUICK_ACTIONS = [
  { key: "pos",         labelKey: "quick_new.pos_order",   fallback: "POS order",    to: "/dashboard/pos",         icon: IconShoppingBag,   color: "#2CA01C", scopes: [SCOPES.POS], primary: true },
  { key: "tables",      labelKey: "quick_new.tables",      fallback: "Tables",       to: "/dashboard/tables",      icon: IconArmchair,      color: "#0EA5E9", scopes: [SCOPES.POS, SCOPES.SETTINGS, SCOPES.DASHBOARD] },
  { key: "orders",      labelKey: "navbar.orders",         fallback: "Orders",       to: "/dashboard/orders",      icon: IconReceipt2,      color: "#14B8A6", scopes: [SCOPES.POS, SCOPES.ORDERS, SCOPES.ORDER_STATUS, SCOPES.ORDER_STATUS_DISPLAY] },
  { key: "kitchen",     labelKey: "quick_new.kitchen",     fallback: "Kitchen",      to: "/dashboard/kitchen",     icon: IconChefHat,       color: "#F97316", scopes: [SCOPES.KITCHEN, SCOPES.KITCHEN_DISPLAY] },
  { key: "reservation", labelKey: "quick_new.reservation", fallback: "Reservations", to: "/dashboard/reservation", icon: IconCalendarEvent, color: "#8B5CF6", scopes: [SCOPES.RESERVATIONS, SCOPES.VIEW_RESERVATIONS, SCOPES.MANAGE_RESERVATIONS] },
  { key: "inventory",   labelKey: "quick_new.inventory",   fallback: "Inventory",    to: "/dashboard/inventory",   icon: IconBox,           color: "#F59E0B", scopes: [SCOPES.INVENTORY] },
  { key: "reports",     labelKey: "quick_new.reports",     fallback: "Reports",      to: "/dashboard/reports",     icon: IconChartBar,      color: "#6366F1", scopes: [SCOPES.REPORTS] },
];

let _idCounter = 0;
const newId = () => `w_${Date.now().toString(36)}_${(++_idCounter).toString(36)}`;

/**
 * DashboardPage — the customizable widget dashboard.
 *
 * View modes:
 *   - View mode (default): widgets render statically. "Customize" button enters edit.
 *   - Edit mode: widgets become draggable/resizable; "Add widget" + "Templates" + "Done"
 *     appear in the toolbar.
 *
 * First-time experience: if the server returns no saved layout, we show the
 * onboarding wizard which seeds the user's layout with one of 5 templates.
 */
export default function DashboardPage() {
  const { t } = useTranslation();
  const [confirm, ConfirmDialog] = useConfirm();

  const dashData = useDashboardData();
  const seed = useCallback(() => buildTemplate(DEFAULT_TEMPLATE_KEY), []);
  const layoutHook = useDashboardLayout(seed);

  const [editMode, setEditMode] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(() => {
    try {
      return localStorage.getItem("restro_qbo_privacy_mode") === "true";
    } catch {
      return false;
    }
  });

  const togglePrivacyMode = () => {
    setPrivacyMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("restro_qbo_privacy_mode", String(next));
      } catch {}
      return next;
    });
  };

  const { hasAccess } = useQBOAccess();
  const quickActions = useMemo(
    () => QUICK_ACTIONS.filter((a) => hasAccess(a.scopes)),
    [hasAccess]
  );

  // "Updated hh:mm" stamp for the glance section; bumps on every fetch.
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    if (dashData.data) setUpdatedAt(new Date());
  }, [dashData.data]);
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await dashData.refresh(); } finally { setRefreshing(false); }
  };

  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    // Restaurants close late: past midnight is still "evening", not morning.
    if (hour < 5) return t("dashboard.good_evening", "Good evening");
    if (hour < 12) return t("dashboard.good_morning", "Good morning");
    if (hour < 18) return t("dashboard.good_afternoon", "Good afternoon");
    return t("dashboard.good_evening", "Good evening");
  }, [t]);

  // Show onboarding if no saved layout was found (data has loaded but layout is null on server).
  // We can detect this from the SWR response being non-undefined but with `layout: null`.
  // The hook seeds a default; we treat "no saved" as "show wizard once".
  const [seenOnboarding, setSeenOnboarding] = useState(() => {
    try { return localStorage.getItem("dashboard.onboarded") === "1"; } catch { return true; }
  });

  useEffect(() => {
    if (seenOnboarding) return;
    if (layoutHook.isLoading) return;
    setOnboardingOpen(true);
  }, [layoutHook.isLoading, seenOnboarding]);

  const user = useMemo(() => {
    try { return getUserDetailsInLocalStorage() || {}; } catch { return {}; }
  }, []);

  const userScopes = user?.scope ? String(user.scope).split(",") : [];
  const userPlan = user?.plan || null;

  const context = useMemo(() => ({
    data: dashData.data,
    isLoading: dashData.isLoading,
    error: dashData.error,
    user,
    refresh: dashData.refresh,
  }), [dashData.data, dashData.isLoading, dashData.error, dashData.refresh, user]);

  // ─── Actions ─────────────────────────────────────────────────
  const addWidget = useCallback((type) => {
    const desc = getWidget(type);
    if (!desc) return;
    const w = desc.defaultSize?.w ?? 4;
    const h = desc.defaultSize?.h ?? 3;
    const newItem = {
      i: newId(),
      type,
      config: { ...(desc.defaultConfig || {}) },
      layout: {
        lg: { x: 0, y: Infinity, w, h },
        md: { x: 0, y: Infinity, w: Math.min(w, 10), h },
        sm: { x: 0, y: Infinity, w: Math.min(w, 6), h },
        xs: { x: 0, y: Infinity, w: 4, h },
        xxs: { x: 0, y: Infinity, w: 2, h },
      },
    };
    const next = {
      version: layoutHook.layout?.version || 1,
      breakpoints: layoutHook.layout?.breakpoints || BREAKPOINTS,
      cols: layoutHook.layout?.cols || COLS,
      items: [...(layoutHook.layout?.items || []), newItem],
    };
    layoutHook.updateLayout(next);
    toast.success(`${desc.title} added`);
  }, [layoutHook]);

  const removeWidget = useCallback((itemId) => {
    if (!layoutHook.layout) return;
    const next = {
      ...layoutHook.layout,
      items: layoutHook.layout.items.filter((it) => it.i !== itemId),
    };
    layoutHook.updateLayout(next);
  }, [layoutHook]);

  const onLayoutChange = useCallback((next) => {
    layoutHook.updateLayout(next);
  }, [layoutHook]);

  const applyTemplate = useCallback((templateKey) => {
    const tpl = buildTemplate(templateKey);
    if (!tpl) return;
    layoutHook.updateLayout(tpl, { immediate: true });
    setTemplatesOpen(false);
    setOnboardingOpen(false);
    setSeenOnboarding(true);
    try { localStorage.setItem("dashboard.onboarded", "1"); } catch {}
    toast.success(`Applied template: ${TEMPLATES.find((x) => x.key === templateKey)?.title}`);
  }, [layoutHook]);

  const skipOnboarding = useCallback(() => {
    setOnboardingOpen(false);
    setSeenOnboarding(true);
    try { localStorage.setItem("dashboard.onboarded", "1"); } catch {}
  }, []);

  const resetDashboard = useCallback(async () => {
    if (!(await confirm({ title: t("dashboard.reset_title", "Reset Dashboard"), description: t("dashboard.confirm_reset", "Reset to the default dashboard? Your customizations will be lost."), confirmText: t("dashboard.reset_action", "Reset") }))) return;
    await layoutHook.resetLayout();
    layoutHook.updateLayout(buildTemplate(DEFAULT_TEMPLATE_KEY), { immediate: true });
    toast.success("Dashboard reset");
  }, [layoutHook, confirm, t]);

  // ─── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "e" && !editMode) setEditMode(true);
      if (e.key === "Escape" && editMode) setEditMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editMode]);

  // ─── Loading / Error ─────────────────────────────────────────
  if (dashData.isLoading || layoutHook.isLoading) {
    return (
      <Page>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-restro-text">
          <IconLoader2 className="animate-spin text-restro-green" size={40} stroke={iconStroke} />
          <p className="font-medium">{t("dashboard.loading_message")}</p>
        </div>
      </Page>
    );
  }

  if (dashData.error) {
    console.error(dashData.error);
    return (
      <Page>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="rounded-2xl border border-dashed border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-10 text-center text-red-600">
            <h3 className="text-lg font-bold">{t("dashboard.error")}</h3>
          </div>
        </div>
      </Page>
    );
  }

  const firstName = (user?.name || "Manager").split(" ")[0];
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const visibleLayout = layoutHook.layout && {
    ...layoutHook.layout,
    items: (layoutHook.layout.items || []).filter((it) => !getWidget(it.type)?.hidden),
  };

  const toolbarBtn =
    "inline-flex h-[42px] items-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-95 cursor-pointer";

  // ─── Render ──────────────────────────────────────────────────
  return (
    <Page className="px-4 sm:px-6 lg:px-8 pt-6 pb-12 max-w-[1440px] mx-auto">
      {/* Edit toolbar — pinned while rearranging so Done is always in reach */}
      {editMode && (
        <div className="sticky top-2 z-30 mb-6 flex flex-col gap-3 rounded-2xl border border-[#2CA01C]/40 bg-background/95 p-3 pl-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-bold text-foreground">
              <IconAdjustments size={16} stroke={iconStroke} className="text-[#2CA01C]" />
              {t("dashboard.editing_title", "Editing your dashboard")}
              {(layoutHook.dirty || layoutHook.saving) && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-restro-text">
                  {layoutHook.saving ? (
                    <><IconLoader2 size={12} className="animate-spin" /> {t("dashboard.saving", "Saving…")}</>
                  ) : (
                    <>· {t("dashboard.unsaved", "Unsaved changes")}</>
                  )}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-restro-text">
              {t("dashboard.editing_hint", "Drag a widget by its header to move it, or drag its corner to resize.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setPickerOpen(true)} className={`${toolbarBtn} bg-[#2CA01C] text-white hover:bg-[#248417]`}>
              <IconPlus size={16} stroke={iconStroke} /> {t("dashboard.add_widget", "Add widget")}
            </button>
            <button onClick={() => setTemplatesOpen(true)} className={`${toolbarBtn} border border-restro-border-green bg-background text-foreground hover:bg-restro-bg-gray`}>
              <IconLayout2 size={16} stroke={iconStroke} /> {t("dashboard.templates", "Templates")}
            </button>
            <button onClick={resetDashboard} className={`${toolbarBtn} border border-restro-border-green bg-background text-foreground hover:bg-restro-bg-gray`}>
              <IconRotateClockwise2 size={16} stroke={iconStroke} /> {t("dashboard.reset", "Reset")}
            </button>
            <button
              onClick={() => {
                layoutHook.saveNow();
                setEditMode(false);
              }}
              className={`${toolbarBtn} bg-[#0D233A] text-white hover:opacity-90 dark:bg-white dark:text-[#0D233A]`}
            >
              <IconCheck size={16} stroke={iconStroke} /> {t("common.done", "Done")}
            </button>
          </div>
        </div>
      )}

      {/* Greeting */}
      <header className="mb-6 flex items-start justify-between gap-3 sm:items-end">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-restro-text">{todayLabel}</p>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-[28px]">
            {greetingText}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-restro-text">
            {t("dashboard.happening_today", "Here's what's happening at your restaurant today.")}
          </p>
        </div>

        {!editMode && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={togglePrivacyMode}
              aria-pressed={privacyMode}
              title={t("dashboard.privacy", "Privacy")}
              className={`${toolbarBtn} border ${privacyMode ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400" : "border-restro-border-green bg-background text-foreground hover:bg-restro-bg-gray"}`}
            >
              {privacyMode ? <IconEyeOff size={17} stroke={1.8} /> : <IconEye size={17} stroke={1.8} />}
              <span className="hidden sm:inline">{t("dashboard.privacy", "Privacy")}</span>
            </button>
            <button
              type="button"
              onClick={() => setEditMode(true)}
              title={t("navbar.customise", "Customise")}
              className={`${toolbarBtn} border border-restro-border-green bg-background text-foreground hover:bg-restro-bg-gray`}
            >
              <IconAdjustments size={17} stroke={1.8} />
              <span className="hidden sm:inline">{t("navbar.customise", "Customise")}</span>
            </button>
          </div>
        )}
      </header>

      {/* Quick actions */}
      {!editMode && quickActions.length > 0 && (
        <nav
          aria-label={t("dashboard.quick_actions", "Quick actions")}
          className="mb-8 grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-7"
        >
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.key}
                to={a.to}
                className={`group flex items-center justify-center gap-2 ${a.primary ? "col-span-3 min-h-[64px] flex-row sm:col-span-1 sm:min-h-[88px] sm:flex-col" : "min-h-[88px] flex-col"} rounded-2xl border px-2 py-3 text-center transition hover:-translate-y-0.5 hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2CA01C] focus-visible:ring-offset-2 ${
                  a.primary
                    ? "border-transparent bg-[#2CA01C] text-white shadow-sm shadow-[#2CA01C]/30 hover:bg-[#248417]"
                    : "border-restro-border-green bg-background text-foreground hover:border-gray-300 dark:hover:border-slate-600"
                }`}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                  style={a.primary ? { backgroundColor: "rgba(255,255,255,0.18)" } : { backgroundColor: `${a.color}1a`, color: a.color }}
                >
                  <Icon size={20} stroke={iconStroke} />
                </span>
                <span className={`text-[13px] font-bold leading-tight ${a.primary ? "line-clamp-1 sm:line-clamp-2" : "line-clamp-2"}`}>{t(a.labelKey, a.fallback)}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {/* Today at a glance */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-bold text-foreground">
            {t("dashboard.today_at_a_glance", "Today at a glance")}
          </h2>
          {updatedAt && (
            <span className="text-xs text-restro-text">
              {t("dashboard.updated_at", "Updated {{time}}", {
                time: updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {privacyMode && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              {t("dashboard.privacy_active", "Privacy mode active — sensitive figures blurred")}
            </span>
          )}
          {!editMode && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              title={t("dashboard.refresh", "Refresh")}
              className="flex h-[42px] w-[42px] items-center justify-center rounded-xl text-restro-text transition hover:bg-restro-bg-gray hover:text-foreground active:scale-95 disabled:opacity-60"
            >
              <IconRefresh size={18} stroke={iconStroke} className={refreshing ? "animate-spin" : ""} />
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className={privacyMode ? "[&_[data-sensitive]]:blur-md [&_.text-2xl]:blur-sm [&_.text-3xl]:blur-sm [&_.font-extrabold]:blur-xs transition-all" : ""}>
        <WidgetCanvas
          layout={visibleLayout}
          editMode={editMode}
          context={context}
          onLayoutChange={onLayoutChange}
          onRemoveItem={removeWidget}
        />
      </div>

      <WidgetPickerDrawer
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={(type) => { addWidget(type); }}
        userScopes={userScopes}
        userPlan={userPlan}
        userRole={user?.role}
        alreadyAddedTypes={(layoutHook.layout?.items || []).map((it) => it.type)}
      />

      <TemplateGalleryModal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onApply={applyTemplate}
      />

      <OnboardingWizard
        open={onboardingOpen}
        onApply={applyTemplate}
        onSkip={skipOnboarding}
      />
      <ConfirmDialog />
    </Page>
  );
}

// ─── Template Gallery (used from edit toolbar) ──────────────────
function TemplateGalleryModal({ open, onClose, onApply }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-restro-border-green bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-restro-border-green px-5 py-4">
          <h3 className="text-lg font-extrabold text-foreground">Apply a template</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-restro-text hover:bg-restro-bg-gray">
            <IconX size={18} stroke={iconStroke} />
          </button>
        </div>
        <div className="p-5">
          <p className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            Applying a template will replace your current dashboard composition.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                onClick={() => onApply(t.key)}
                className="flex flex-col rounded-xl border-2 border-restro-border-green p-4 text-left transition hover:border-restro-green hover:-translate-y-0.5"
              >
                <div
                  className="mb-3 h-1.5 w-12 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                <p className="text-base font-extrabold text-foreground">{t.title}</p>
                <p className="mt-1 text-xs text-restro-text">{t.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
