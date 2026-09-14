import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import {
  IconChevronRight,
  IconLoader2,
  IconLayoutDashboard,
  IconAdjustments,
  IconPlus,
  IconCheck,
  IconRotateClockwise2,
  IconLayout2,
  IconX,
} from "@tabler/icons-react";

import Page from "../components/Page";
import { iconStroke } from "../config/config";

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

  const dashData = useDashboardData();
  const seed = useCallback(() => buildTemplate(DEFAULT_TEMPLATE_KEY), []);
  const layoutHook = useDashboardLayout(seed);

  const [editMode, setEditMode] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

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
    if (!confirm("Reset to the default dashboard? Your customizations will be lost.")) return;
    await layoutHook.resetLayout();
    layoutHook.updateLayout(buildTemplate(DEFAULT_TEMPLATE_KEY), { immediate: true });
    toast.success("Dashboard reset");
  }, [layoutHook]);

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

  // ─── Render ──────────────────────────────────────────────────
  return (
    <Page>
      <div className="px-1 pb-12">
        {/* Toolbar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-restro-green-10 text-restro-green">
              <IconLayoutDashboard size={20} stroke={iconStroke} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-foreground">Dashboard</h1>
              <p className="text-xs text-restro-text">
                {editMode ? "Drag, resize, add or remove widgets." : "Your personalized command center."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!editMode ? (
              <>
                <Link
                  to="/dashboard/reports"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-restro-border-green bg-background px-3 py-2 text-sm font-bold text-foreground transition hover:bg-restro-bg-gray"
                >
                  View Reports <IconChevronRight size={14} stroke={iconStroke} />
                </Link>
                <button
                  onClick={() => setEditMode(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-restro-green px-4 py-2 text-sm font-bold text-white transition hover:bg-restro-green/90 active:scale-95"
                >
                  <IconAdjustments size={15} stroke={iconStroke} /> Customize
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setPickerOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-restro-green px-3 py-2 text-sm font-bold text-white hover:bg-restro-green/90 active:scale-95"
                >
                  <IconPlus size={15} stroke={iconStroke} /> Add widget
                </button>
                <button
                  onClick={() => setTemplatesOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-restro-border-green bg-background px-3 py-2 text-sm font-bold text-foreground hover:bg-restro-bg-gray"
                >
                  <IconLayout2 size={15} stroke={iconStroke} /> Templates
                </button>
                <button
                  onClick={resetDashboard}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-restro-border-green bg-background px-3 py-2 text-sm font-bold text-foreground hover:bg-restro-bg-gray"
                >
                  <IconRotateClockwise2 size={15} stroke={iconStroke} /> Reset
                </button>
                <button
                  onClick={() => { layoutHook.saveNow(); setEditMode(false); }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2 text-sm font-bold text-background hover:opacity-90 active:scale-95"
                >
                  <IconCheck size={15} stroke={iconStroke} /> Done
                </button>
              </>
            )}
          </div>
        </div>

        {/* Save indicator */}
        {editMode && (layoutHook.dirty || layoutHook.saving) && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-restro-bg-gray/60 px-3 py-1 text-xs text-restro-text">
            {layoutHook.saving ? (
              <>
                <IconLoader2 size={12} className="animate-spin" /> Saving…
              </>
            ) : (
              <>● Unsaved changes</>
            )}
          </div>
        )}

        {/* Canvas */}
        <WidgetCanvas
          layout={layoutHook.layout}
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
