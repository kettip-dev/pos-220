import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMenuLanguage, loadMenuLanguage } from "../helpers/MenuLanguageHelper";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { toast } from "react-hot-toast";
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconChefHat,
  IconHistory,
  IconLock,
  IconLockOpen,
  IconMoon,
  IconRefresh,
  IconSun,
  IconSettings,
  IconToolsKitchen2,
  IconVolume,
  IconVolumeOff,
  IconCircleCheck,
} from "@tabler/icons-react";

import Page from "../components/Page";
import { useStoreSettings } from "../controllers/settings.controller";
import {
  bulkUpdateKitchenOrderItemStatus,
  getKitchenOrders,
  markOrderAllItemsStatus,
  updateKitchenOrderItemStatus,
} from "../controllers/kitchen.controller";
import { useKitchenStations } from "../controllers/kitchen_stations.controller";
import { SocketContext } from "../contexts/SocketContext";
import { initSocket } from "../utils/socket";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";

import KdsTicketCard from "../components/kitchen/KdsTicketCard";
import KdsRecallDrawer from "../components/kitchen/KdsRecallDrawer";
import KdsSettingsPopover from "../components/kitchen/KdsSettingsPopover";
import {
  DINING_TYPES,
  filterCompanionItems,
  filterItemsForStation,
  formatDuration,
  getTicketStartMs,
  getUrgency,
  isItemActive,
  isItemDone,
  loadKdsSettings,
  saveKdsSettings,
  toMs,
} from "../components/kitchen/kdsUtils";

const GRID_MIN_WIDTH = { sm: 280, md: 330, lg: 400 };

const readLS = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch (e) {
    return fallback;
  }
};
const writeLS = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    /* ignore */
  }
};

export default function KitchenPage() {
  const { t } = useTranslation();
  useMenuLanguage();

  // Kitchen orders only carry item ids + default names; load the translation map.
  useEffect(() => {
    loadMenuLanguage();
  }, []);
  const navigate = useNavigate();
  const { socket, isSocketConnected } = useContext(SocketContext);
  const { data: storeSettings, isLoading: isSettingsLoading } = useStoreSettings();
  const { data: stations = [] } = useKitchenStations();

  useEffect(() => {
    if (!isSettingsLoading && storeSettings && storeSettings.isKitchenEnabled === false) {
      toast.error(t("kitchen.disabled_notice", "Kitchen / KDS workflow is disabled for this store."));
      navigate("/dashboard/pos", { replace: true });
    }
  }, [storeSettings, isSettingsLoading, navigate, t]);

  // ── View state (persisted per device so each kitchen tablet remembers its role) ──
  const [selectedStationId, setSelectedStationId] = useState(() => readLS("kds_selected_station_id", "all"));
  const [isStationLocked, setIsStationLocked] = useState(() => readLS("kds_is_station_locked", "false") === "true");
  const [soundEnabled, setSoundEnabled] = useState(() => readLS("kds_sound_enabled", "true") !== "false");
  const [diningFilter, setDiningFilter] = useState(() => readLS("kds_dining_filter", "all"));
  const [kdsTheme, setKdsTheme] = useState(() => (readLS("kds_theme", "dark") === "light" ? "light" : "dark"));
  const [settings, setSettings] = useState(loadKdsSettings);

  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRecallOpen, setIsRecallOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [now, setNow] = useState(Date.now());

  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const lastBumpRef = useRef(null);

  const enabledStations = useMemo(() => stations.filter((s) => s.is_enabled), [stations]);
  const isExpo = selectedStationId === "all";
  const stationParam = isExpo ? null : selectedStationId;

  // If the remembered station was deleted or disabled, fall back to Expo.
  useEffect(() => {
    if (!stations.length || selectedStationId === "all" || selectedStationId === "unassigned") return;
    if (!enabledStations.some((s) => String(s.id) === String(selectedStationId))) {
      setSelectedStationId("all");
      writeLS("kds_selected_station_id", "all");
    }
  }, [stations, enabledStations, selectedStationId]);

  // ── Clock ──
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // ── Data ──
  // `t` is read through a ref so a language switch never re-creates `refresh`
  // (which would re-run the initial load, socket binding and polling effects).
  const tRef = useRef(t);
  tRef.current = t;
  // Handlers below are also called from the keyboard listener, so they read `t` fresh.
  const tr = (...args) => tRef.current(...args);

  const refresh = useCallback(
    async ({ silent = true } = {}) => {
      if (!silent) setIsRefreshing(true);
      try {
        const res = await getKitchenOrders();
        if (res.status === 200) setOrders(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error(error);
        if (!silent) toast.error(tRef.current("kitchen.error_loading_orders", "Error loading kitchen orders"));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    refresh({ silent: false });
  }, [refresh]);

  // Socket: new orders chime + refresh; any order update refreshes.
  useEffect(() => {
    const user = getUserDetailsInLocalStorage();
    const audio = new Audio("/new_order_sound.mp3");

    const onNewOrder = () => {
      if (soundEnabledRef.current) audio.play().catch(() => {});
      refresh();
    };
    const onOrderUpdate = () => refresh();

    if (!socket.connected) initSocket();
    if (user?.tenant_id) socket.emit("authenticate", user.tenant_id);
    socket.on("new_order", onNewOrder);
    socket.on("order_update", onOrderUpdate);
    return () => {
      socket.off("new_order", onNewOrder);
      socket.off("order_update", onOrderUpdate);
    };
  }, [socket, refresh]);

  // Safety-net polling: fast when the socket is down, slow otherwise.
  useEffect(() => {
    const id = setInterval(() => refresh(), isSocketConnected ? 60000 : 15000);
    return () => clearInterval(id);
  }, [isSocketConnected, refresh]);

  const broadcastUpdate = () => {
    const user = getUserDetailsInLocalStorage();
    if (!socket.connected) initSocket();
    socket.emit("order_update_backend", {}, user?.tenant_id);
  };

  // ── Optimistic status changes ──
  const patchLocalItems = (shouldPatch, status) => {
    const stamp = new Date().toISOString();
    setOrders((prev) =>
      prev.map((o) => ({
        ...o,
        items: o.items.map((i) => {
          if (!shouldPatch(i, o)) return i;
          return {
            ...i,
            status,
            started_at: status === "created" ? null : i.started_at || stamp,
            completed_at: status === "completed" ? stamp : null,
          };
        }),
      }))
    );
  };

  const runAction = async (optimistic, request, errorMessage) => {
    optimistic();
    try {
      await request();
      broadcastUpdate();
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || errorMessage || tr("kitchen.error_processing_request", "Could not update the ticket"));
    } finally {
      refresh();
    }
  };

  const inScope = useCallback(
    (item) => {
      if (selectedStationId === "all") return true;
      if (selectedStationId === "unassigned") return !item.kitchen_station_id;
      return Number(item.kitchen_station_id) === Number(selectedStationId);
    },
    [selectedStationId]
  );

  const advanceItem = (item) => {
    const next = item.status === "created" ? "preparing" : item.status === "preparing" ? "completed" : null;
    if (!next) return;
    runAction(
      () => patchLocalItems((i) => i.id === item.id, next),
      () => updateKitchenOrderItemStatus(item.id, next)
    );
  };

  const undoItem = (item) => {
    runAction(
      () => patchLocalItems((i) => i.id === item.id, "preparing"),
      () => updateKitchenOrderItemStatus(item.id, "preparing")
    );
  };

  const startAll = (order) => {
    runAction(
      () => patchLocalItems((i, o) => o.id === order.id && inScope(i) && i.status === "created", "preparing"),
      () => markOrderAllItemsStatus(order.id, "preparing", ["created"], stationParam)
    );
  };

  const undoBump = async (bump = lastBumpRef.current) => {
    if (!bump) return;
    lastBumpRef.current = null;
    toast.dismiss(`bump-${bump.orderId}`);
    const byStatus = {};
    bump.items.forEach((i) => {
      (byStatus[i.status] = byStatus[i.status] || []).push(i.id);
    });
    await runAction(
      () =>
        setOrders((prev) =>
          prev.map((o) => ({
            ...o,
            items: o.items.map((i) => {
              const was = bump.items.find((b) => b.id === i.id);
              return was ? { ...i, status: was.status, completed_at: null } : i;
            }),
          }))
        ),
      () => Promise.all(Object.entries(byStatus).map(([status, ids]) => bulkUpdateKitchenOrderItemStatus(ids, status)))
    );
    toast.success(tr("kitchen.kds.ticket_back", "Ticket #{{token}} is back on the rail", { token: bump.token }));
  };

  const bumpTicket = (order) => {
    const bumpedItems = order.items.filter((i) => inScope(i) && isItemActive(i)).map((i) => ({ id: i.id, status: i.status }));
    if (bumpedItems.length === 0) return;
    const bump = { orderId: order.id, token: order.token_no ?? order.id, items: bumpedItems };
    lastBumpRef.current = bump;

    runAction(
      () => patchLocalItems((i, o) => o.id === order.id && inScope(i) && isItemActive(i), "completed"),
      () => markOrderAllItemsStatus(order.id, "completed", ["created", "preparing"], stationParam)
    );

    toast(
      (tt) => (
        <span className="flex items-center gap-3">
          <span className="font-semibold">{tr("kitchen.kds.ticket_bumped", "Ticket #{{token}} bumped", { token: bump.token })}</span>
          <button
            type="button"
            onClick={() => {
              toast.dismiss(tt.id);
              undoBump(bump);
            }}
            className="h-[42px] px-4 rounded-lg bg-slate-900 text-white text-xs font-bold active:scale-95"
          >
            {tr("kitchen.kds.undo", "Undo")}
          </button>
        </span>
      ),
      { id: `bump-${order.id}`, duration: 6000 }
    );
  };

  const recallTicket = (order) => {
    runAction(
      () => patchLocalItems((i, o) => o.id === order.id && inScope(i) && i.status === "completed", "preparing"),
      () => markOrderAllItemsStatus(order.id, "preparing", ["completed"], stationParam),
      tr("kitchen.kds.recall_failed", "Failed to recall ticket")
    );
    toast.success(tr("kitchen.kds.ticket_recalled", "Ticket #{{token}} recalled", { token: order.token_no ?? order.id }));
  };

  // ── Derived views ──
  const stationCounts = useMemo(() => {
    const counts = { all: 0, unassigned: 0 };
    orders.forEach((o) => {
      const active = o.items.filter(isItemActive);
      if (active.length === 0) return;
      counts.all += 1;
      const ids = new Set(active.map((i) => i.kitchen_station_id || "unassigned"));
      ids.forEach((id) => {
        counts[id] = (counts[id] || 0) + 1;
      });
    });
    return counts;
  }, [orders]);

  const scopedTickets = useMemo(() => {
    return orders
      .map((order) => {
        const displayItems = filterItemsForStation(order.items, selectedStationId);
        if (!displayItems.some(isItemActive)) return null;
        const startMs = getTicketStartMs(order, displayItems);
        return {
          order,
          displayItems,
          companionItems: filterCompanionItems(order.items, selectedStationId),
          startMs,
        };
      })
      .filter(Boolean);
  }, [orders, selectedStationId]);

  const diningCounts = useMemo(() => {
    const c = { all: scopedTickets.length };
    scopedTickets.forEach(({ order }) => {
      c[order.delivery_type] = (c[order.delivery_type] || 0) + 1;
    });
    return c;
  }, [scopedTickets]);

  const tickets = useMemo(() => {
    const list = scopedTickets
      .filter(({ order }) => diningFilter === "all" || order.delivery_type === diningFilter)
      .map((tk) => {
        const elapsedSec = Math.max(0, Math.floor((now - tk.startMs) / 1000));
        return { ...tk, elapsedSec, urgency: getUrgency(elapsedSec, settings) };
      });
    list.sort((a, b) => (settings.sortOrder === "newest" ? b.startMs - a.startMs : a.startMs - b.startMs));
    return list;
  }, [scopedTickets, diningFilter, now, settings]);

  const recallEntries = useMemo(() => {
    return orders
      .map((order) => {
        const items = filterItemsForStation(order.items, selectedStationId);
        if (items.length === 0 || items.some(isItemActive)) return null;
        if (!items.some((i) => i.status === "completed" || i.status === "delivered")) return null;
        const doneTimes = items.map((i) => toMs(i.completed_at)).filter(Boolean);
        const bumpedAtMs = doneTimes.length ? Math.max(...doneTimes) : null;
        const startMs = getTicketStartMs(order, items);
        return {
          order,
          items,
          bumpedAtMs,
          durationSec: bumpedAtMs ? Math.max(0, Math.round((bumpedAtMs - startMs) / 1000)) : null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.bumpedAtMs || 0) - (a.bumpedAtMs || 0));
  }, [orders, selectedStationId]);

  const stats = useMemo(() => {
    const newCount = tickets.filter((tk) => tk.displayItems.filter(isItemActive).every((i) => i.status === "created")).length;
    const cookingCount = tickets.filter((tk) => tk.displayItems.some((i) => i.status === "preparing")).length;
    const lateCount = tickets.filter((tk) => tk.urgency === "late").length;
    const recent = recallEntries.filter((e) => e.durationSec != null && e.bumpedAtMs && now - e.bumpedAtMs < 60 * 60 * 1000);
    const avgSec = recent.length ? Math.round(recent.reduce((s, e) => s + e.durationSec, 0) / recent.length) : null;
    return { newCount, cookingCount, lateCount, avgSec, avgSample: recent.length };
  }, [tickets, recallEntries, now]);

  const scopeLabel = useMemo(() => {
    if (selectedStationId === "all") return t("kitchen.kds.all_stations", "All stations");
    if (selectedStationId === "unassigned") return t("kitchen.kds.unassigned_items", "Unassigned items");
    return enabledStations.find((s) => String(s.id) === String(selectedStationId))?.name || t("kitchen.kds.station", "Station");
  }, [selectedStationId, enabledStations, t]);

  // Keep the keyboard selection on a ticket that still exists.
  useEffect(() => {
    if (selectedTicketId && !tickets.some((tk) => tk.order.id === selectedTicketId)) setSelectedTicketId(null);
  }, [tickets, selectedTicketId]);

  // ── Controls ──
  const changeStation = (id) => {
    if (isStationLocked && String(id) !== String(selectedStationId)) {
      toast.error(t("kitchen.kds.locked_notice", "Screen is locked to this station. Unlock to switch."));
      return;
    }
    setSelectedStationId(String(id));
    writeLS("kds_selected_station_id", String(id));
    setSelectedTicketId(null);
  };

  const changeDining = (id) => {
    setDiningFilter(id);
    writeLS("kds_dining_filter", id);
  };

  const toggleLock = () => {
    const next = !isStationLocked;
    setIsStationLocked(next);
    writeLS("kds_is_station_locked", String(next));
    if (next) toast.success(t("kitchen.kds.locked_to", "Screen locked to {{scope}}", { scope: scopeLabel }));
    else toast(t("kitchen.kds.unlocked", "Station switching unlocked"));
  };

  const toggleTheme = () => {
    const next = kdsTheme === "light" ? "dark" : "light";
    setKdsTheme(next);
    writeLS("kds_theme", next);
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    writeLS("kds_sound_enabled", String(next));
    if (next) new Audio("/new_order_sound.mp3").play().catch(() => {});
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  };

  const updateSettings = (next) => {
    setSettings(next);
    saveKdsSettings(next);
  };

  // ── Bump-bar / keyboard shortcuts ──
  const keyStateRef = useRef({});
  keyStateRef.current = { tickets, selectedTicketId, isRecallOpen, isSettingsOpen };

  useEffect(() => {
    const onKey = (e) => {
      const { tickets: list, selectedTicketId: sel, isRecallOpen: recallOpen, isSettingsOpen: settingsOpen } = keyStateRef.current;
      if (recallOpen || settingsOpen) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const idx = list.findIndex((tk) => tk.order.id === sel);
      const selected = idx >= 0 ? list[idx] : null;

      if (/^[1-9]$/.test(e.key)) {
        const target = list[Number(e.key) - 1];
        if (target) setSelectedTicketId(target.order.id);
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        if (list.length) setSelectedTicketId(list[Math.min(list.length - 1, idx + 1)].order.id);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (list.length) setSelectedTicketId(list[Math.max(0, idx - 1)].order.id);
        return;
      }
      if (e.key === "Enter" && selected) {
        e.preventDefault();
        bumpTicket(selected.order);
        return;
      }
      if (e.key === " " && selected) {
        e.preventDefault();
        startAll(selected.order);
        return;
      }
      if (e.key === "u" || e.key === "U") {
        undoBump();
        return;
      }
      if (e.key === "r" || e.key === "R") {
        setIsRecallOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // handlers read fresh state through keyStateRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStationId]);

  const clock = new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const otherStationsBusy = !isExpo && stationCounts.all > 0;

  return (
    <Page
      className={clsx(
        "kds-root h-full flex flex-col bg-[var(--kds-bg)] text-[color:var(--kds-text)] overflow-hidden select-none relative font-sans",
        kdsTheme === "light" && "kds-light"
      )}
    >
      <style>{`
        .kds-root {
          --kds-bg: #0b0c10; --kds-surface: #13151c; --kds-panel: #171a22; --kds-drawer: #111318; --kds-header: #1c1f2a;
          --kds-chip: rgba(255,255,255,.03); --kds-chip-hover: rgba(255,255,255,.07); --kds-soft: rgba(255,255,255,.06); --kds-soft-2: rgba(255,255,255,.1);
          --kds-line: rgba(255,255,255,.07); --kds-line-2: rgba(255,255,255,.14); --kds-well: rgba(0,0,0,.2); --kds-kbd: rgba(0,0,0,.4);
          --kds-text: #f8fafc; --kds-text-2: #cbd5e1; --kds-muted: #94a3b8; --kds-faint: #64748b; --kds-dim: #475569;
          --kds-invert-bg: #ffffff; --kds-invert-text: #020617; --kds-invert-muted: #64748b;
          --kds-card-shadow: 0 18px 40px -24px rgba(0,0,0,.9); --kds-pop-shadow: 0 24px 60px -12px rgba(0,0,0,.8);
          color-scheme: dark;
        }
        .kds-root.kds-light {
          --kds-bg: #eef1f5; --kds-surface: #ffffff; --kds-panel: #ffffff; --kds-drawer: #f8fafc; --kds-header: #f1f5f9;
          --kds-chip: #ffffff; --kds-chip-hover: #f1f5f9; --kds-soft: rgba(15,23,42,.06); --kds-soft-2: rgba(15,23,42,.1);
          --kds-line: rgba(15,23,42,.1); --kds-line-2: rgba(15,23,42,.18); --kds-well: #f8fafc; --kds-kbd: #f1f5f9;
          --kds-text: #0f172a; --kds-text-2: #334155; --kds-muted: #64748b; --kds-faint: #94a3b8; --kds-dim: #cbd5e1;
          --kds-invert-bg: #0f172a; --kds-invert-text: #ffffff; --kds-invert-muted: #94a3b8;
          --kds-card-shadow: 0 10px 28px -18px rgba(15,23,42,.35); --kds-pop-shadow: 0 24px 60px -12px rgba(15,23,42,.3);
          color-scheme: light;
        }
        /* Pale accents are tuned for dark glass; darken them on white so they keep contrast. */
        .kds-light .text-amber-200, .kds-light .text-amber-300 { color: #b45309; }
        .kds-light .text-sky-300 { color: #0369a1; }
        .kds-light .text-emerald-300, .kds-light .text-emerald-400 { color: #047857; }
        .kds-light .text-rose-300, .kds-light .text-rose-400 { color: #be123c; }
        .kds-light .text-violet-300 { color: #6d28d9; }
        @keyframes kdsFresh { 0%,100% { box-shadow: 0 0 0 0 rgba(56,189,248,0) } 50% { box-shadow: 0 0 0 4px rgba(56,189,248,0.35) } }
        .kds-fresh { animation: kdsFresh 1.6s ease-in-out 3; }
        @keyframes kdsSlideIn { from { transform: translateX(24px); opacity: 0 } to { transform: none; opacity: 1 } }
        .kds-slide-in { animation: kdsSlideIn .18s ease-out; }
      `}</style>

      {/* ── Top bar ── */}
      <header className="shrink-0 px-4 sm:px-5 pt-4 pb-3 flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-[color:var(--kds-line)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
            <IconToolsKitchen2 size={22} stroke={2} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-[color:var(--kds-text)] truncate">{t("kitchen.title", "Kitchen")}</h1>
              {isStationLocked && (
                <span className="h-6 px-2 rounded-md bg-amber-400/15 text-amber-300 border border-amber-400/30 text-[11px] font-bold flex items-center gap-1">
                  <IconLock size={12} stroke={2.4} /> {t("kitchen.kds.locked", "Locked")}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-[color:var(--kds-muted)] font-medium">
              <span className={clsx("flex items-center gap-1.5", isSocketConnected ? "text-emerald-400" : "text-amber-300")}>
                <span className={clsx("w-1.5 h-1.5 rounded-full", isSocketConnected ? "bg-emerald-400" : "bg-amber-300 animate-pulse")} />
                {isSocketConnected ? t("kitchen.kds.live", "Live") : t("kitchen.kds.reconnecting", "Reconnecting…")}
              </span>
              <span className="text-[color:var(--kds-dim)]">•</span>
              <span className="truncate">{scopeLabel}</span>
              <span className="text-[color:var(--kds-dim)]">•</span>
              <span className="tabular-nums">{clock}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 order-3 lg:order-none w-full lg:w-auto lg:flex-1 lg:justify-center overflow-x-auto no-scrollbar">
          <Stat label={t("kitchen.kds.stat_open", "Open")} value={tickets.length} tone="white" />
          <Stat label={t("kitchen.kds.stat_new", "New")} value={stats.newCount} tone="sky" />
          <Stat label={t("kitchen.kds.stat_cooking", "Cooking")} value={stats.cookingCount} tone="amber" />
          <Stat label={t("kitchen.kds.stat_late", "Late")} value={stats.lateCount} tone={stats.lateCount > 0 ? "rose" : "muted"} />
          <Stat
            label={t("kitchen.kds.stat_avg", "Avg time")}
            value={stats.avgSec != null ? formatDuration(stats.avgSec) : "—"}
            tone="muted"
            title={
              stats.avgSample
                ? t("kitchen.kds.avg_hint", "Average of {{count}} tickets bumped in the last hour", { count: stats.avgSample })
                : t("kitchen.kds.avg_none", "No tickets bumped in the last hour")
            }
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto">
          <ToolButton onClick={() => setIsRecallOpen(true)} title={t("kitchen.kds.recall_hint", "Recall bumped tickets (R)")}>
            <IconHistory size={19} stroke={2} />
            <span className="hidden xl:inline">{t("kitchen.kds.recall", "Recall")}</span>
            {recallEntries.length > 0 && (
              <span className="min-w-[20px] h-5 px-1 rounded-full bg-[var(--kds-soft-2)] text-[11px] font-black tabular-nums flex items-center justify-center">
                {recallEntries.length}
              </span>
            )}
          </ToolButton>
          <ToolButton onClick={toggleSound} active={soundEnabled} title={soundEnabled ? t("kitchen.kds.mute", "Mute new-order chime") : t("kitchen.kds.unmute", "Turn on new-order chime")}>
            {soundEnabled ? <IconVolume size={19} stroke={2} /> : <IconVolumeOff size={19} stroke={2} />}
          </ToolButton>
          <ToolButton onClick={toggleLock} warn={isStationLocked} title={isStationLocked ? t("kitchen.kds.unlock", "Unlock station switching") : t("kitchen.kds.lock", "Lock this screen to the current station")}>
            {isStationLocked ? <IconLock size={19} stroke={2} /> : <IconLockOpen size={19} stroke={2} />}
          </ToolButton>
          <ToolButton
            onClick={toggleTheme}
            title={kdsTheme === "light" ? t("kitchen.kds.dark_mode", "Dark mode") : t("kitchen.kds.light_mode", "Light mode")}
          >
            {kdsTheme === "light" ? <IconMoon size={19} stroke={2} /> : <IconSun size={19} stroke={2} />}
          </ToolButton>
          <ToolButton
            onClick={toggleFullscreen}
            title={isFullscreen ? t("kitchen.kds.exit_fullscreen", "Exit full screen") : t("kitchen.kds.fullscreen", "Full screen")}
          >
            {isFullscreen ? <IconArrowsMinimize size={19} stroke={2} /> : <IconArrowsMaximize size={19} stroke={2} />}
          </ToolButton>
          <ToolButton onClick={() => refresh({ silent: false })} title={t("kitchen.refresh", "Refresh")}>
            <IconRefresh size={19} stroke={2} className={clsx(isRefreshing && "animate-spin")} />
          </ToolButton>
          <div className="relative">
            <ToolButton data-kds-settings-toggle onClick={() => setIsSettingsOpen((v) => !v)} active={isSettingsOpen} title={t("kitchen.kds.screen_settings", "Screen settings")}>
              <IconSettings size={19} stroke={2} />
            </ToolButton>
            <KdsSettingsPopover
              open={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
              settings={settings}
              onChange={updateSettings}
              theme={kdsTheme}
              onThemeChange={(next) => next !== kdsTheme && toggleTheme()}
            />
          </div>
        </div>
      </header>

      {/* ── Station rail + dining filter ── */}
      <div className="shrink-0 px-4 sm:px-5 py-3 flex items-center gap-3 border-b border-[color:var(--kds-line)]">
        <nav aria-label={t("kitchen.kds.stations_aria", "Kitchen stations")} className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto no-scrollbar touch-pan-x">
          <StationTab
            label={t("kitchen.kds.all_stations", "All stations")}
            sublabel={t("kitchen.kds.expo", "Expo")}
            icon={<IconChefHat size={18} stroke={2} />}
            count={stationCounts.all}
            selected={isExpo}
            disabled={isStationLocked && !isExpo}
            onClick={() => changeStation("all")}
          />
          {enabledStations.map((st) => (
            <StationTab
              key={st.id}
              label={st.name}
              color={st.color || "#f97316"}
              count={stationCounts[st.id] || 0}
              selected={String(selectedStationId) === String(st.id)}
              disabled={isStationLocked && String(selectedStationId) !== String(st.id)}
              onClick={() => changeStation(st.id)}
            />
          ))}
          {(stationCounts.unassigned > 0 || selectedStationId === "unassigned") && (
            <StationTab
              label={t("kitchen.kds.unassigned", "Unassigned")}
              color="#64748b"
              count={stationCounts.unassigned}
              selected={selectedStationId === "unassigned"}
              disabled={isStationLocked && selectedStationId !== "unassigned"}
              onClick={() => changeStation("unassigned")}
            />
          )}
        </nav>

        <div className="hidden md:flex items-center p-1 rounded-xl bg-[var(--kds-chip)] border border-[color:var(--kds-line)] shrink-0">
          {DINING_TYPES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => changeDining(d.id)}
              className={clsx(
                "h-[42px] px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95",
                diningFilter === d.id
                  ? "bg-[var(--kds-invert-bg)] text-[color:var(--kds-invert-text)]"
                  : "text-[color:var(--kds-muted)] hover:text-[color:var(--kds-text)]"
              )}
            >
              {t(`kitchen.kds.dining_${d.id}`, d.label)}
              <span className={clsx("tabular-nums", diningFilter === d.id ? "text-[color:var(--kds-invert-muted)]" : "text-[color:var(--kds-faint)]")}>{diningCounts[d.id] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Ticket rail ── */}
      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 sm:px-5 py-4" onClick={() => setSelectedTicketId(null)}>
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-[color:var(--kds-muted)]">
            <span className="loading loading-spinner loading-lg text-amber-400" />
            <span className="text-sm font-semibold">{t("kitchen.loading_message", "Loading tickets…")}</span>
          </div>
        ) : tickets.length === 0 ? (
          <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center px-6">
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5">
              <IconCircleCheck size={40} stroke={1.6} />
            </div>
            <h3 className="text-xl font-black text-[color:var(--kds-text)]">
              {diningFilter !== "all" && scopedTickets.length > 0
                ? t("kitchen.kds.empty_filtered", "No tickets for this order type")
                : t("kitchen.kds.empty_title", "All caught up")}
            </h3>
            <p className="text-sm text-[color:var(--kds-muted)] mt-1.5 max-w-md">
              {diningFilter !== "all" && scopedTickets.length > 0
                ? t("kitchen.kds.hidden_by_filter", "{{count}} other tickets are hidden by the order-type filter.", { count: scopedTickets.length })
                : isExpo
                ? t("kitchen.kds.empty_expo", "New orders from POS and QR ordering land here instantly, with a chime.")
                : t("kitchen.kds.empty_station", "Nothing waiting at {{scope}}. Items routed here will appear automatically.", { scope: scopeLabel })}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {diningFilter !== "all" && scopedTickets.length > 0 && (
                <button type="button" onClick={() => changeDining("all")} className="h-11 px-5 rounded-xl bg-[var(--kds-invert-bg)] text-[color:var(--kds-invert-text)] font-bold text-sm active:scale-95 transition"
                >
                  {t("kitchen.kds.show_all_types", "Show all order types")}
                </button>
              )}
              {otherStationsBusy && !isStationLocked && (
                <button
                  type="button"
                  onClick={() => changeStation("all")}
                  className="h-11 px-5 rounded-xl bg-[var(--kds-soft)] hover:bg-[var(--kds-soft-2)] border border-[color:var(--kds-line)] text-[color:var(--kds-text)] font-bold text-sm active:scale-95 transition"
                >
                  {t("kitchen.kds.view_all_stations", "View all stations")} · {stationCounts.all}
                </button>
              )}
              {recallEntries.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsRecallOpen(true)}
                  className="h-11 px-5 rounded-xl text-[color:var(--kds-muted)] hover:text-[color:var(--kds-text)] font-bold text-sm flex items-center gap-2 active:scale-95 transition"
                >
                  <IconHistory size={17} stroke={2} /> {t("kitchen.kds.recall", "Recall")} ({recallEntries.length})
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            className="grid gap-4 items-start"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${GRID_MIN_WIDTH[settings.textSize] || 330}px), 1fr))` }}
          >
            {tickets.map((tk, index) => (
              <KdsTicketCard
                key={tk.order.id}
                order={tk.order}
                index={index}
                displayItems={tk.displayItems}
                companionItems={tk.companionItems}
                elapsedSec={tk.elapsedSec}
                urgency={tk.urgency}
                isExpo={isExpo}
                size={settings.textSize}
                isSelected={selectedTicketId === tk.order.id}
                onSelect={(e) => {
                  e?.stopPropagation?.();
                  setSelectedTicketId(tk.order.id);
                }}
                onAdvanceItem={advanceItem}
                onUndoItem={undoItem}
                onStartAll={() => startAll(tk.order)}
                onBump={() => bumpTicket(tk.order)}
              />
            ))}
          </div>
        )}
      </main>

      <KdsRecallDrawer
        open={isRecallOpen}
        onClose={() => setIsRecallOpen(false)}
        entries={recallEntries}
        nowMs={now}
        scopeLabel={scopeLabel}
        onRecall={recallTicket}
      />
    </Page>
  );
}

// ── Small presentational pieces ──

const STAT_TONES = {
  white: "text-[color:var(--kds-text)]",
  sky: "text-sky-300",
  amber: "text-amber-300",
  rose: "text-rose-400",
  muted: "text-[color:var(--kds-text-2)]",
};

function Stat({ label, value, tone = "white", title }) {
  return (
    <div title={title} className="h-11 px-3.5 rounded-xl bg-[var(--kds-chip)] border border-[color:var(--kds-line)] flex items-center gap-2 shrink-0">
      <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--kds-faint)] whitespace-nowrap">{label}</span>
      <span className={clsx("text-lg font-black tabular-nums", STAT_TONES[tone])}>{value}</span>
    </div>
  );
}

function ToolButton({ children, onClick, title, active, warn, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      {...rest}
      className={clsx(
        "h-11 min-w-[44px] px-3 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 transition active:scale-95",
        warn
          ? "bg-amber-400 text-slate-950 border-amber-400"
          : active
          ? "bg-[var(--kds-soft-2)] text-[color:var(--kds-text)] border-[color:var(--kds-line-2)]"
          : "bg-[var(--kds-chip)] text-[color:var(--kds-text-2)] border-[color:var(--kds-line)] hover:bg-[var(--kds-chip-hover)] hover:text-[color:var(--kds-text)]"
      )}
    >
      {children}
    </button>
  );
}

function StationTab({ label, sublabel, icon, color, count, selected, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "relative h-12 pl-3.5 pr-2.5 rounded-xl border flex items-center gap-2.5 shrink-0 transition active:scale-95",
        selected
          ? "bg-[var(--kds-invert-bg)] text-[color:var(--kds-invert-text)] border-[color:var(--kds-invert-bg)]"
          : "bg-[var(--kds-chip)] text-[color:var(--kds-text-2)] border-[color:var(--kds-line)] hover:bg-[var(--kds-chip-hover)]",
        disabled && "opacity-30 cursor-not-allowed active:scale-100"
      )}
    >
      {icon ? (
        <span className={selected ? "text-[color:var(--kds-invert-text)]" : "text-[color:var(--kds-muted)]"}>{icon}</span>
      ) : (
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      )}
      <span className="text-sm font-bold whitespace-nowrap">
        {label}
        {sublabel && <span className={clsx("ml-1.5 font-semibold", selected ? "text-[color:var(--kds-invert-muted)]" : "text-[color:var(--kds-faint)]")}>{sublabel}</span>}
      </span>
      <span
        className={clsx(
          "min-w-[26px] h-7 px-1.5 rounded-lg text-xs font-black tabular-nums flex items-center justify-center",
          count > 0
            ? selected
              ? "bg-[var(--kds-invert-text)] text-[color:var(--kds-invert-bg)]"
              : "bg-amber-400 text-slate-950"
            : selected
            ? "bg-[var(--kds-soft-2)] text-[color:var(--kds-invert-muted)]"
            : "bg-[var(--kds-soft)] text-[color:var(--kds-faint)]"
        )}
      >
        {count}
      </span>
      {disabled && <IconLock size={13} stroke={2.2} className="text-[color:var(--kds-muted)] -ml-1" />}
      {selected && color && <span className="absolute left-3 right-3 -bottom-[1px] h-[3px] rounded-full" style={{ backgroundColor: color }} />}
    </button>
  );
}
