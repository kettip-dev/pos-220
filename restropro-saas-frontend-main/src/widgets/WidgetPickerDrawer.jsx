import React, { Fragment, useMemo, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  IconX,
  IconSearch,
  IconPlus,
  IconLock,
  IconCheck,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import {
  getAllWidgets, getCategoryOrder, getCategoryMeta, isWidgetLockedByPlan,
} from "./registry";

/**
 * WidgetPickerDrawer
 * ──────────────────────────────────────────────────────────────
 * Right-side slide-over drawer that lets the user browse all
 * registered widgets, search/filter, and add to the dashboard.
 *
 * Filters:
 *   - Visible categories first; "All" tab shows every widget.
 *   - Search by title/description/tag.
 *   - RBAC: hides widgets the user doesn't have scope for.
 *   - Plan: shows lock badge for plan-gated widgets.
 */
export default function WidgetPickerDrawer({
  open, onClose, onAdd,
  userScopes = [], userPlan = null, userRole = null,
  alreadyAddedTypes = [],   // list of widget types already on the dashboard — hidden from the picker
}) {
  const [activeCat, setActiveCat] = useState("all");
  const [query, setQuery] = useState("");

  // Count how many of each type are already on the dashboard.
  const countByType = useMemo(() => {
    const m = new Map();
    for (const t of alreadyAddedTypes) m.set(t, (m.get(t) || 0) + 1);
    return m;
  }, [alreadyAddedTypes]);

  const all = useMemo(() => {
    const scopeSet = new Set(userScopes);
    const isAdmin = userRole === "admin";
    return getAllWidgets().filter((w) => {
      // Admins bypass scope checks (mirrors ScopeProtectedRoute behavior).
      if (!isAdmin && w.scope && !scopeSet.has(w.scope)) return false;
      // Single-instance widgets disappear once added; allowMultiple widgets
      // (Sticky Notes, Quick Actions) stay listed with an "Added × N" badge.
      const count = countByType.get(w.type) || 0;
      if (count > 0 && !w.allowMultiple) return false;
      return true;
    });
  }, [userScopes, userRole, countByType]);

  const cats = useMemo(() => {
    const order = getCategoryOrder();
    const seen = new Set(all.map((w) => w.category));
    return order.filter((c) => seen.has(c));
  }, [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((w) => {
      if (activeCat !== "all" && w.category !== activeCat) return false;
      if (!q) return true;
      const hay = `${w.title} ${w.description} ${(w.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [all, activeCat, query]);

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[10000]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-y-0 right-0 flex max-w-full">
            <Transition.Child
              as={Fragment}
              enter="transform transition ease-out duration-300"
              enterFrom="translate-x-full"
              enterTo="translate-x-0"
              leave="transform transition ease-in duration-200"
              leaveFrom="translate-x-0"
              leaveTo="translate-x-full"
            >
              <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                <div className="flex h-full flex-col bg-background border-l border-restro-border-green shadow-2xl">
                  {/* Header */}
                  <div className="border-b border-restro-border-green px-5 py-4">
                    <div className="flex items-center justify-between">
                      <Dialog.Title className="text-lg font-extrabold text-foreground">
                        Add a widget
                      </Dialog.Title>
                      <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-restro-text hover:bg-restro-bg-gray hover:text-foreground"
                      >
                        <IconX size={18} stroke={iconStroke} />
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-restro-text">
                      Pick a widget. Drag and resize after it lands on your dashboard.
                    </p>

                    {/* Search */}
                    <div className="relative mt-3">
                      <IconSearch
                        size={15} stroke={iconStroke}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-restro-text"
                      />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search widgets…"
                        className="w-full rounded-xl border border-restro-border-green bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-restro-text focus:outline-none focus:ring-2 focus:ring-restro-green/30"
                      />
                    </div>
                  </div>

                  {/* Categories */}
                  <div className="border-b border-restro-border-green px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      <CatChip active={activeCat === "all"} onClick={() => setActiveCat("all")}>
                        All
                      </CatChip>
                      {cats.map((c) => {
                        const meta = getCategoryMeta(c);
                        return (
                          <CatChip
                            key={c}
                            active={activeCat === c}
                            color={meta?.color}
                            onClick={() => setActiveCat(c)}
                          >
                            {meta?.label || c}
                          </CatChip>
                        );
                      })}
                    </div>
                  </div>

                  {/* Grid */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {filtered.length === 0 ? (
                      <div className="flex h-full items-center justify-center">
                        <p className="text-sm text-restro-text">No matching widgets.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {filtered.map((w) => {
                          const locked = isWidgetLockedByPlan(w, userPlan);
                          const Icon = w.icon;
                          const addedCount = countByType.get(w.type) || 0;
                          return (
                            <button
                              key={w.type}
                              onClick={() => !locked && onAdd && onAdd(w.type)}
                              disabled={locked}
                              className={`group relative flex flex-col items-start rounded-xl border bg-background p-3 text-left transition ${
                                locked
                                  ? "border-restro-border-green opacity-60 cursor-not-allowed"
                                  : "border-restro-border-green hover:border-restro-green hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
                              }`}
                            >
                              <div className="mb-2 flex w-full items-center justify-between">
                                <div
                                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                                  style={{
                                    backgroundColor: `${getCategoryMeta(w.category)?.color || "#70B56A"}18`,
                                    color: getCategoryMeta(w.category)?.color || "#70B56A",
                                  }}
                                >
                                  {Icon ? <Icon size={18} stroke={iconStroke} /> : null}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {addedCount > 0 && (
                                    <span
                                      className="inline-flex items-center gap-1 rounded-full bg-restro-green-10 px-2 py-0.5 text-[10px] font-bold text-restro-green"
                                      title={`Already added ${addedCount} time${addedCount > 1 ? "s" : ""}`}
                                    >
                                      <IconCheck size={10} stroke={3} />
                                      Added × {addedCount}
                                    </span>
                                  )}
                                  {locked ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                                      <IconLock size={10} /> {w.plan}
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-restro-green-10 p-1 text-restro-green opacity-0 transition group-hover:opacity-100">
                                      <IconPlus size={14} stroke={iconStroke} />
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm font-bold text-foreground">{w.title}</p>
                              {w.description && (
                                <p className="mt-0.5 text-xs text-restro-text line-clamp-2">
                                  {w.description}
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

function CatChip({ active, color, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active
          ? "bg-restro-green text-white"
          : "bg-restro-bg-gray/60 text-restro-text hover:bg-restro-bg-gray"
      }`}
      style={active && color ? { backgroundColor: color, color: "#fff" } : undefined}
    >
      {children}
    </button>
  );
}
