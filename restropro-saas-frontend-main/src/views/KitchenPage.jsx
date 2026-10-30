import React, { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Page from "../components/Page";
import { iconStroke } from "../config/config";
import {
  IconArmchair,
  IconBoxSeam,
  IconCheck,
  IconChecks,
  IconClock,
  IconDotsVertical,
  IconRefresh,
  IconX,
  IconLock,
  IconLockOpen,
  IconToolsKitchen2,
  IconChefHat,
  IconVolume,
  IconVolumeOff,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconHistory,
  IconAlertCircle,
  IconFlame,
} from "@tabler/icons-react";

// Safe inline SVG helpers for player play & undo
const IconPlayerPlay = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className}>
    <polygon points="6 4 20 12 6 20 6 4" />
  </svg>
);

const IconArrowBackUp = ({ size = 15, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 14l-4-4 4-4" />
    <path d="M5 10h11a4 4 0 1 1 0 8h-1" />
  </svg>
);
import {
  bulkUpdateKitchenOrderItemStatus,
  getKitchenOrders,
  markOrderAllItemsStatus,
  updateKitchenOrderItemStatus,
} from "../controllers/kitchen.controller";
import { useKitchenStations } from "../controllers/kitchen_stations.controller";
import { toast } from "react-hot-toast";
import { SocketContext } from "../contexts/SocketContext";
import { initSocket } from "../utils/socket";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import clsx from "clsx";

// Helpers for live elapsed timers
const getElapsedSeconds = (orderDate, nowMs) => {
  if (!orderDate) return 0;
  const parsed = new Date(
    typeof orderDate === "string" ? orderDate.replace(" ", "T") : orderDate
  ).getTime();
  if (isNaN(parsed)) return 0;
  return Math.max(0, Math.floor((nowMs - parsed) / 1000));
};

const formatElapsedTime = (totalSeconds) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export default function KitchenPage() {
  const { t } = useTranslation();
  const user = getUserDetailsInLocalStorage();
  const { socket, isSocketConnected } = useContext(SocketContext);

  // Kitchen Stations hook
  const { data: stations = [] } = useKitchenStations();

  // Active Station Tab & Lock State (Persisted in localStorage)
  const [selectedStationId, setSelectedStationId] = useState(() => {
    return localStorage.getItem("kds_selected_station_id") || "all";
  });
  const [isStationLocked, setIsStationLocked] = useState(() => {
    return localStorage.getItem("kds_is_station_locked") === "true";
  });

  // Sound Notification State
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem("kds_sound_enabled") !== "false";
  });

  // Fullscreen State
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Recall Slide-out Drawer State
  const [isRecallOpen, setIsRecallOpen] = useState(false);

  // Live Clock for ticking elapsed order timers
  const [currentTime, setCurrentTime] = useState(Date.now());

  const [state, setState] = useState({
    kitchenOrders: [],
    isLoading: true,
  });

  // Ticking timer effect every 1 second
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timerInterval);
  }, []);

  // Fullscreen event listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  useEffect(() => {
    _init();
    _initSocket();

    return () => {
      socket.off("new_order");
      socket.off("order_update");
    };
  }, []);

  const { kitchenOrders, isLoading } = state;

  const _init = async () => {
    try {
      const res = await getKitchenOrders();
      if (res.status === 200) {
        const orders = res?.data || [];
        setState({
          ...state,
          kitchenOrders: orders || [],
          isLoading: false,
        });
      }
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error(t("kitchen.error_loading_orders", "Error loading kitchen orders"));
      setState({
        ...state,
        isLoading: false,
      });
    }
  };

  const _initSocket = () => {
    const audio = new Audio("/new_order_sound.mp3");

    const handleNewOrder = (payload) => {
      console.log("New order received:", payload);
      try {
        const isSoundOn = localStorage.getItem("kds_sound_enabled") !== "false";
        if (isSoundOn) {
          audio.play().catch(() => {});
        }
      } catch (e) {
        console.error(e);
      }
      btnRefresh();
    };

    const handleOrderUpdate = () => {
      console.log("Order update received");
      btnRefresh();
    };

    if (isSocketConnected) {
      socket.emit("authenticate", user.tenant_id);
      socket.on("new_order", handleNewOrder);
      socket.on("order_update", handleOrderUpdate);
    } else {
      initSocket();
      socket.emit("authenticate", user.tenant_id);
      socket.on("new_order", handleNewOrder);
      socket.on("order_update", handleOrderUpdate);
    }
  };

  const sendOrderUpdateEvent = () => {
    const u = getUserDetailsInLocalStorage();
    if (isSocketConnected) {
      socket.emit("order_update_backend", {}, u.tenant_id);
    } else {
      initSocket();
      socket.emit("order_update_backend", {}, u.tenant_id);
    }
  };

  async function btnRefresh() {
    try {
      const res = await getKitchenOrders();
      if (res.status === 200) {
        const orders = res?.data || [];
        setState((prev) => ({
          ...prev,
          kitchenOrders: orders || [],
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error(error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  }

  const handleStationChange = (stationId) => {
    if (isStationLocked && stationId !== selectedStationId) {
      toast.error("Station view is locked. Unlock it to switch stations.");
      return;
    }
    setSelectedStationId(stationId);
    localStorage.setItem("kds_selected_station_id", stationId);
  };

  const handleToggleLock = () => {
    const nextLocked = !isStationLocked;
    setIsStationLocked(nextLocked);
    localStorage.setItem("kds_is_station_locked", String(nextLocked));
    if (nextLocked) {
      toast.success(
        `KDS locked to ${
          selectedStationId === "all"
            ? "Expo / All Stations"
            : stations.find((s) => String(s.id) === String(selectedStationId))?.name || "Station"
        }`
      );
    } else {
      toast("KDS unlocked — station switching enabled");
    }
  };

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("kds_sound_enabled", String(next));
    if (next) {
      toast.success("KDS order chime enabled");
      try {
        new Audio("/new_order_sound.mp3").play().catch(() => {});
      } catch (e) {}
    } else {
      toast("KDS order chime muted");
    }
  };

  const btnStartPreparingOrderItem = async (orderItemId) => {
    try {
      toast.loading(t("kitchen.loading_message", "Updating item..."));
      const res = await updateKitchenOrderItemStatus(orderItemId, "preparing");
      toast.dismiss();
      if (res.status === 200) {
        await btnRefresh();
        sendOrderUpdateEvent();
        toast.success(res.data.message || "Item started");
      }
    } catch (error) {
      const message = error?.response?.data?.message || t("kitchen.error_processing_request", "Error updating item");
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  };

  const btnCompletePreparingOrderItem = async (orderItemId) => {
    try {
      toast.loading(t("kitchen.loading_message", "Completing item..."));
      const res = await updateKitchenOrderItemStatus(orderItemId, "completed");
      toast.dismiss();
      if (res.status === 200) {
        sendOrderUpdateEvent();
        await btnRefresh();
        toast.success(res.data.message || "Item completed");
      }
    } catch (error) {
      const message = error?.response?.data?.message || t("kitchen.error_processing_request", "Error completing item");
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  };

  const btnMarkOrderAllItems = async (orderId, targetStatus, fromStatuses) => {
    try {
      toast.loading(t("kitchen.loading_message", "Updating order..."));
      const stationParam = selectedStationId === "all" ? null : selectedStationId;
      const res = await markOrderAllItemsStatus(orderId, targetStatus, fromStatuses, stationParam);
      toast.dismiss();
      if (res.status === 200) {
        sendOrderUpdateEvent();
        await btnRefresh();
        toast.success(res.data.message || "Order updated");
      }
    } catch (error) {
      const message = error?.response?.data?.message || t("kitchen.error_processing_request", "Error processing request");
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  };

  // Restore / Recall an accidentally bumped order
  const btnRecallOrder = async (orderId) => {
    try {
      toast.loading("Restoring order to kitchen...");
      const stationParam = selectedStationId === "all" ? null : selectedStationId;
      const res = await markOrderAllItemsStatus(orderId, "preparing", ["completed"], stationParam);
      toast.dismiss();
      if (res.status === 200) {
        sendOrderUpdateEvent();
        await btnRefresh();
        toast.success("Order recalled back to kitchen queue!");
      }
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to restore order");
    }
  };

  // Filter orders that have pending items
  const activeOrders = useMemo(() => {
    return kitchenOrders.filter((order) => {
      return !order.items.every(
        (item) => item.status === "completed" || item.status === "delivered" || item.status === "cancelled"
      );
    });
  }, [kitchenOrders]);

  // Orders that are fully completed (available for Recall)
  const completedOrders = useMemo(() => {
    return kitchenOrders.filter((order) => {
      return (
        order.items.length > 0 &&
        order.items.every(
          (item) => item.status === "completed" || item.status === "delivered" || item.status === "cancelled"
        )
      );
    });
  }, [kitchenOrders]);

  // Compute pending ticket count per station for badges
  const stationCounts = useMemo(() => {
    const counts = { all: activeOrders.length, unassigned: 0 };
    stations.forEach((s) => {
      counts[s.id] = 0;
    });

    activeOrders.forEach((order) => {
      const stationSet = new Set();
      let hasUnassigned = false;

      order.items.forEach((item) => {
        if (item.status === "created" || item.status === "preparing") {
          if (item.kitchen_station_id) {
            stationSet.add(item.kitchen_station_id);
          } else {
            hasUnassigned = true;
          }
        }
      });

      stationSet.forEach((stId) => {
        if (counts[stId] !== undefined) counts[stId] += 1;
      });
      if (hasUnassigned) counts.unassigned += 1;
    });

    return counts;
  }, [activeOrders, stations]);

  // Split items into displayItems vs companionItems based on active station filter
  const displayOrders = useMemo(() => {
    return activeOrders
      .map((order) => {
        if (selectedStationId === "all") {
          return {
            ...order,
            displayItems: order.items,
            companionItems: [],
          };
        }

        const isUnassignedFilter = selectedStationId === "unassigned";
        const stationIdNum = Number(selectedStationId);

        const displayItems = order.items.filter((item) => {
          if (isUnassignedFilter) return !item.kitchen_station_id;
          return item.kitchen_station_id === stationIdNum;
        });

        const companionItems = order.items.filter((item) => {
          if (isUnassignedFilter) return Boolean(item.kitchen_station_id);
          return item.kitchen_station_id !== stationIdNum;
        });

        return {
          ...order,
          displayItems,
          companionItems,
        };
      })
      .filter((order) => {
        if (selectedStationId === "all") return true;
        return order.displayItems.length > 0;
      });
  }, [activeOrders, selectedStationId]);

  // Helper to summarize companion items by station
  const renderCompanionBadge = (companionItems) => {
    if (!companionItems || companionItems.length === 0) return null;

    const grouped = {};
    companionItems.forEach((item) => {
      const name = item.station_name || "General Kitchen";
      const color = item.station_color || "#3b82f6";
      if (!grouped[name]) {
        grouped[name] = { count: 0, completed: 0, preparing: 0, color };
      }
      grouped[name].count += item.quantity || 1;
      if (item.status === "completed" || item.status === "delivered") {
        grouped[name].completed += item.quantity || 1;
      } else if (item.status === "preparing") {
        grouped[name].preparing += item.quantity || 1;
      }
    });

    return (
      <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap gap-1.5 items-center">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Other Stations:
        </span>
        {Object.entries(grouped).map(([stationName, info]) => {
          const allDone = info.completed === info.count;
          return (
            <span
              key={stationName}
              className={clsx(
                "text-[11px] font-medium px-2 py-0.5 rounded-lg flex items-center gap-1.5 border transition-all",
                allDone
                  ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/60"
                  : "bg-slate-900/80 text-slate-300 border-slate-800"
              )}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: info.color }}
              />
              <span className="font-semibold">{stationName}</span>
              <span className="text-[10px] opacity-80">
                ({info.completed}/{info.count} done)
              </span>
            </span>
          );
        })}
      </div>
    );
  };

  const enabledStations = stations.filter((s) => s.is_enabled);

  return (
    <Page className="h-full flex flex-col bg-[#0b0c10] text-slate-100 overflow-hidden select-none p-3 sm:p-5 relative font-sans">
      {/* ── TOP CONTROL BAR: Title, Live Count, Station Lock, Recall, Sound, Fullscreen, Refresh ── */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold shadow-inner">
            <IconToolsKitchen2 size={24} stroke={iconStroke} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <span>{t("kitchen.title", "Kitchen KDS")}</span>
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950 shadow-sm">
                {displayOrders.length} {displayOrders.length === 1 ? "Ticket" : "Tickets"}
              </span>
              {isStationLocked && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                  <IconLock size={12} stroke={iconStroke} /> Locked
                </span>
              )}
            </div>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">
              Real-time multi-station kitchen display system
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Recall Drawer Button */}
          <button
            onClick={() => setIsRecallOpen(true)}
            className="h-10 px-3.5 rounded-xl bg-[#171821] hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-white font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-sm"
            title="Recall recently completed tickets"
          >
            <IconHistory size={16} stroke={iconStroke} />
            <span>Recall</span>
            {completedOrders.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-700 text-slate-200">
                {completedOrders.length}
              </span>
            )}
          </button>

          {/* Sound Alert Toggle */}
          <button
            onClick={toggleSound}
            className={clsx(
              "h-10 px-3 rounded-xl border font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-sm",
              soundEnabled
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                : "bg-[#171821] text-slate-400 border-slate-800 hover:bg-slate-800"
            )}
            title={soundEnabled ? "Mute order sound chime" : "Enable order sound chime"}
          >
            {soundEnabled ? (
              <>
                <IconVolume size={16} stroke={iconStroke} />
                <span className="hidden md:inline">Sound On</span>
              </>
            ) : (
              <>
                <IconVolumeOff size={16} stroke={iconStroke} />
                <span className="hidden md:inline">Muted</span>
              </>
            )}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="h-10 px-3 rounded-xl bg-[#171821] hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-white font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-sm"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen (Kiosk Mode)"}
          >
            {isFullscreen ? (
              <>
                <IconArrowsMinimize size={16} stroke={iconStroke} />
                <span className="hidden md:inline">Exit Full</span>
              </>
            ) : (
              <>
                <IconArrowsMaximize size={16} stroke={iconStroke} />
                <span className="hidden md:inline">Fullscreen</span>
              </>
            )}
          </button>

          {/* Lock Screen Toggle */}
          <button
            onClick={handleToggleLock}
            className={clsx(
              "h-10 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-sm border",
              isStationLocked
                ? "bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-rose-900/40"
                : "bg-[#171821] hover:bg-slate-800 text-slate-300 border-slate-700/80"
            )}
            title={
              isStationLocked
                ? "Unlock to switch kitchen stations"
                : "Lock current station on this screen"
            }
          >
            {isStationLocked ? (
              <>
                <IconLock size={15} stroke={iconStroke} />
                <span>Station Locked</span>
              </>
            ) : (
              <>
                <IconLockOpen size={15} stroke={iconStroke} />
                <span>Lock View</span>
              </>
            )}
          </button>

          {/* Refresh Button (Icon Only with Tooltip) */}
          <button
            type="button"
            onClick={btnRefresh}
            className="h-10 w-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 flex items-center justify-center transition active:scale-95 shadow-sm shrink-0"
            title={t("kitchen.refresh", "Refresh")}
            aria-label={t("kitchen.refresh", "Refresh")}
          >
            <IconRefresh
              size={17}
              stroke={iconStroke}
              className={clsx(state.isLoading && "animate-spin text-emerald-400")}
            />
          </button>
        </div>
      </header>

      {/* ── HORIZONTAL STATION BAR: Station Pills with Count Badges ── */}
      {enabledStations.length > 0 && (
        <nav aria-label="Kitchen Stations" className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 shrink-0">
          {/* Expo Master Tab */}
          <button
            disabled={isStationLocked && selectedStationId !== "all"}
            onClick={() => handleStationChange("all")}
            className={clsx(
              "flex items-center gap-2 px-4 h-11 rounded-xl text-xs font-bold shrink-0 transition-all border shadow-md active:scale-95",
              selectedStationId === "all"
                ? "bg-white text-slate-950 border-white shadow-lg"
                : "bg-[#161722] text-slate-300 border-slate-800 hover:bg-[#1e1f2d] hover:text-white",
              isStationLocked && selectedStationId !== "all" && "opacity-35 cursor-not-allowed"
            )}
          >
            <IconChefHat size={18} stroke={iconStroke} />
            <span>All Stations (Expo)</span>
            <span
              className={clsx(
                "px-2 py-0.5 rounded-full text-[11px] font-black",
                selectedStationId === "all"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-800 text-slate-300"
              )}
            >
              {stationCounts.all}
            </span>
          </button>

          {/* Individual Station Pills */}
          {enabledStations.map((station) => {
            const isSelected = String(selectedStationId) === String(station.id);
            const count = stationCounts[station.id] || 0;

            return (
              <button
                key={station.id}
                disabled={isStationLocked && !isSelected}
                onClick={() => handleStationChange(String(station.id))}
                className={clsx(
                  "flex items-center gap-2 px-4 h-11 rounded-xl text-xs font-bold shrink-0 transition-all border shadow-md active:scale-95",
                  isSelected
                    ? "text-white shadow-lg border-transparent scale-[1.02]"
                    : "bg-[#161722] text-slate-300 border-slate-800 hover:bg-[#1e1f2d] hover:text-white",
                  isStationLocked && !isSelected && "opacity-35 cursor-not-allowed"
                )}
                style={{
                  backgroundColor: isSelected ? station.color || "#f97316" : undefined,
                  borderColor: isSelected ? station.color || "#f97316" : undefined,
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                  style={{
                    backgroundColor: isSelected ? "#ffffff" : station.color || "#f97316",
                  }}
                />
                <span>{station.name}</span>
                <span
                  className={clsx(
                    "px-2 py-0.5 rounded-full text-[11px] font-black",
                    isSelected
                      ? "bg-black/30 text-white"
                      : "bg-slate-800 text-slate-300"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {/* Unassigned Items Tab */}
          {stationCounts.unassigned > 0 && (
            <button
              disabled={isStationLocked && selectedStationId !== "unassigned"}
              onClick={() => handleStationChange("unassigned")}
              className={clsx(
                "flex items-center gap-2 px-4 h-11 rounded-xl text-xs font-bold shrink-0 transition-all border shadow-md active:scale-95",
                selectedStationId === "unassigned"
                  ? "bg-slate-700 text-white border-slate-600 shadow-lg"
                  : "bg-[#161722] text-slate-300 border-slate-800 hover:bg-[#1e1f2d]",
                isStationLocked && selectedStationId !== "unassigned" && "opacity-35 cursor-not-allowed"
              )}
            >
              <span>Unassigned</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-800 text-slate-200">
                {stationCounts.unassigned}
              </span>
            </button>
          )}
        </nav>
      )}

      {/* ── TICKETS CONTENT AREA (Full-height Scrollable Grid) ── */}
      <main className="mt-3 flex-1 overflow-y-auto no-scrollbar pb-6">
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-20 text-slate-400 gap-3">
            <span className="loading loading-spinner loading-lg text-amber-500"></span>
            <span className="text-sm font-semibold tracking-wide">
              {t("kitchen.loading_message", "Loading kitchen tickets...")}
            </span>
          </div>
        )}

        {!isLoading && displayOrders?.length === 0 && (
          <div className="w-full h-full min-h-[380px] flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-4 shadow-xl">
              <IconToolsKitchen2 size={40} stroke={iconStroke} />
            </div>
            <h3 className="font-extrabold text-lg text-slate-200">
              {selectedStationId === "all"
                ? "All caught up! No pending tickets"
                : "No pending orders for this station"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              {selectedStationId === "all"
                ? "New orders placed in POS or QR dining will appear here automatically with real-time sound alert."
                : "Switch to 'All Stations (Expo)' or wait for new orders routed to this station."}
            </p>
          </div>
        )}

        {!isLoading && displayOrders?.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {displayOrders.map((order, orderIndex) => {
              const {
                id: orderId,
                date: orderDate,
                delivery_type,
                customer_type,
                customer_name,
                table_id,
                table_title,
                floor,
                token_no,
                displayItems = [],
                companionItems = [],
              } = order;

              // Elapsed time calculation
              const elapsedSec = getElapsedSeconds(orderDate, currentTime);
              const elapsedFormatted = formatElapsedTime(elapsedSec);

              // Urgency thresholds
              // < 5m: Normal (Emerald) | 5-10m: Warning (Amber) | >= 10m: Urgent (Red)
              const isUrgent = elapsedSec >= 600;
              const isWarning = elapsedSec >= 300 && elapsedSec < 600;

              const isAllDisplayItemsCompleted = displayItems.every(
                (i) =>
                  i.status === "completed" ||
                  i.status === "delivered" ||
                  i.status === "cancelled"
              );

              const hasUnstartedItems = displayItems.some(
                (i) => i.status === "created"
              );
              const hasActiveItems = displayItems.some(
                (i) => i.status === "created" || i.status === "preparing"
              );

              return (
                <article
                  aria-label={`Order ticket #${token_no}`}
                  key={orderId || orderIndex}
                  className={clsx(
                    "flex flex-col justify-between rounded-2xl bg-[#14151e] border-2 shadow-2xl transition-all duration-200 overflow-hidden relative",
                    isUrgent
                      ? "border-rose-500/80 shadow-rose-950/30"
                      : isWarning
                      ? "border-amber-500/80 shadow-amber-950/20"
                      : "border-slate-800 shadow-slate-950/40",
                    isAllDisplayItemsCompleted && "opacity-60 border-slate-800"
                  )}
                >
                  {/* Top Urgency Accent Bar */}
                  <div
                    className={clsx(
                      "h-1.5 w-full shrink-0",
                      isUrgent
                        ? "bg-rose-500 animate-pulse"
                        : isWarning
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    )}
                  />

                  {/* ── CARD HEADER ── */}
                  <div className="p-3.5 pb-2.5 border-b border-slate-800/80">
                    <div className="flex items-center justify-between gap-2">
                      {/* Left: Dining Type & Table / Customer */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={clsx(
                            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold",
                            delivery_type === "dinein"
                              ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                              : "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                          )}
                        >
                          {delivery_type === "dinein" ? (
                            <IconArmchair size={18} stroke={iconStroke} />
                          ) : (
                            <IconBoxSeam size={18} stroke={iconStroke} />
                          )}
                        </div>

                        <div className="truncate">
                          <p className="font-black text-sm text-white truncate leading-tight">
                            {table_id ? table_title : (customer_name || `${delivery_type}`).toUpperCase()}
                          </p>
                          <p className="text-[10px] font-semibold text-slate-400 truncate">
                            {floor ? floor : `${delivery_type} • ${customer_type || "Guest"}`}
                          </p>
                        </div>
                      </div>

                      {/* Right: Ticket Token # & Live Timer Pill */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Token Badge */}
                        <span className="px-2 py-1 rounded-lg font-black text-xs bg-slate-800 text-white border border-slate-700 shadow-sm">
                          #{token_no}
                        </span>

                        {/* Urgency Timer Pill */}
                        <div
                          className={clsx(
                            "flex items-center gap-1 px-2 py-1 rounded-lg font-black text-xs border tracking-wider shadow-sm",
                            isUrgent
                              ? "bg-rose-500 text-white border-rose-600 animate-pulse"
                              : isWarning
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          )}
                        >
                          <IconClock size={13} stroke={iconStroke} />
                          <span>{elapsedFormatted}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── CARD BODY (ORDER ITEMS) ── */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div className="flex flex-col divide-y divide-slate-800/60">
                      {displayItems.map((item, itemIdx) => {
                        const {
                          id: orderItemId,
                          item_title,
                          variant_title,
                          quantity,
                          status,
                          addons,
                          notes,
                          station_name,
                          station_color,
                        } = item;

                        const isCompleted =
                          status === "completed" ||
                          status === "delivered" ||
                          status === "cancelled";
                        const isPreparing = status === "preparing";
                        const isCreated = status === "created";

                        const addonsText =
                          addons?.length > 0
                            ? addons.map((a) => a.title).join(", ")
                            : null;

                        return (
                          <div
                            key={orderItemId || itemIdx}
                            className={clsx(
                              "py-2.5 flex items-start gap-2.5 transition-all rounded-lg",
                              isCompleted && "opacity-45"
                            )}
                          >
                            {/* Tap-to-Progress Status Button (min 42px touch target) */}
                            <button
                              type="button"
                              onClick={() => {
                                if (isCreated) {
                                  btnStartPreparingOrderItem(orderItemId);
                                } else if (isPreparing) {
                                  btnCompletePreparingOrderItem(orderItemId);
                                }
                              }}
                              className={clsx(
                                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition active:scale-90 border mt-0.5",
                                isCompleted
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                  : isPreparing
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse"
                                  : "bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700 hover:border-slate-500"
                              )}
                              title={
                                isCreated
                                  ? "Tap to Start making"
                                  : isPreparing
                                  ? "Tap to Complete item"
                                  : "Completed"
                              }
                            >
                              {isCompleted && (
                                <IconCheck size={16} stroke={iconStroke} />
                              )}
                              {isPreparing && (
                                <IconClock size={16} stroke={iconStroke} />
                              )}
                              {isCreated && (
                                <div className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                              )}
                            </button>

                            {/* Item Details */}
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => {
                                if (isCreated) {
                                  btnStartPreparingOrderItem(orderItemId);
                                } else if (isPreparing) {
                                  btnCompletePreparingOrderItem(orderItemId);
                                }
                              }}
                            >
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={clsx(
                                    "font-bold text-xs text-slate-100",
                                    isCompleted && "line-through text-slate-500"
                                  )}
                                >
                                  {item_title}
                                  {variant_title ? ` (${variant_title})` : ""}
                                </span>

                                <span className="px-1.5 py-0.5 rounded-md font-black text-[11px] bg-slate-800 text-amber-400 border border-slate-700">
                                  x{quantity}
                                </span>

                                {/* Station chip in Expo view */}
                                {selectedStationId === "all" && station_name && (
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 border"
                                    style={{
                                      backgroundColor: `${station_color || "#3b82f6"}22`,
                                      borderColor: `${station_color || "#3b82f6"}55`,
                                      color: station_color || "#60a5fa",
                                    }}
                                  >
                                    <span
                                      className="w-1.5 h-1.5 rounded-full"
                                      style={{ backgroundColor: station_color || "#3b82f6" }}
                                    />
                                    <span>{station_name}</span>
                                  </span>
                                )}
                              </div>

                              {/* Modifiers / Addons */}
                              {addonsText && (
                                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                                  + {addonsText}
                                </p>
                              )}

                              {/* Kitchen Notes / Allergy Alert */}
                              {notes && (
                                <div className="mt-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold inline-flex items-center gap-1">
                                  <IconAlertCircle size={12} stroke={iconStroke} />
                                  <span>Note: {notes}</span>
                                </div>
                              )}
                            </div>

                            {/* Item Action Quick Chip */}
                            <div className="shrink-0">
                              {isCreated && (
                                <button
                                  type="button"
                                  onClick={() => btnStartPreparingOrderItem(orderItemId)}
                                  className="h-7 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider transition active:scale-95"
                                >
                                  Start
                                </button>
                              )}
                              {isPreparing && (
                                <button
                                  type="button"
                                  onClick={() => btnCompletePreparingOrderItem(orderItemId)}
                                  className="h-7 px-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase tracking-wider transition active:scale-95"
                                >
                                  Done
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Companion Station Items (when filtered by station) */}
                    {selectedStationId !== "all" && renderCompanionBadge(companionItems)}
                  </div>

                  {/* ── CARD FOOTER (PRO BUMPER BAR ≥ 48px) ── */}
                  <div className="p-3 bg-[#111219] border-t border-slate-800/80 flex items-center gap-2">
                    {/* Quick Start All (if unstarted items exist) */}
                    {hasUnstartedItems && (
                      <button
                        type="button"
                        onClick={() =>
                          btnMarkOrderAllItems(orderId, "preparing", ["created"])
                        }
                        className="h-12 px-3.5 rounded-xl bg-amber-600/25 hover:bg-amber-600/35 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shrink-0"
                        title="Start making all items on this ticket"
                      >
                        <IconPlayerPlay size={16} stroke={iconStroke} />
                        <span>Start All</span>
                      </button>
                    )}

                    {/* Primary Bumper Button (COMPLETE ALL / BUMP) */}
                    {hasActiveItems ? (
                      <button
                        type="button"
                        onClick={() =>
                          btnMarkOrderAllItems(orderId, "completed", [
                            "created",
                            "preparing",
                          ])
                        }
                        className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition active:scale-[0.98] border border-emerald-500/50"
                      >
                        <IconCheck size={20} stroke={iconStroke} />
                        <span>BUMP TICKET</span>
                      </button>
                    ) : (
                      <div className="flex-1 h-12 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-400 font-bold text-xs flex items-center justify-center gap-1.5">
                        <IconChecks size={18} stroke={iconStroke} />
                        <span>Ticket Completed</span>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* ── RECALL SLIDE-OUT DRAWER ── */}
      {isRecallOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-[#13141c] border-l border-slate-800 h-full flex flex-col shadow-2xl p-4 md:p-6 text-slate-100">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-amber-400">
                  <IconHistory size={20} stroke={iconStroke} />
                </div>
                <div>
                  <h2 className="font-black text-base text-white">Recall Tickets</h2>
                  <p className="text-xs text-slate-400">
                    Recently completed kitchen orders
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRecallOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <IconX size={18} stroke={iconStroke} />
              </button>
            </div>

            {/* Completed Orders List */}
            <div className="mt-4 flex-1 overflow-y-auto no-scrollbar flex flex-col gap-3">
              {completedOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-500">
                  <IconHistory size={36} stroke={iconStroke} className="opacity-40 mb-2" />
                  <p className="text-sm font-semibold">No completed tickets yet</p>
                  <p className="text-xs mt-0.5">
                    Orders bumped from the active screen will appear here so you can recall them.
                  </p>
                </div>
              ) : (
                completedOrders.map((cOrder) => {
                  return (
                    <div
                      key={cOrder.id}
                      className="p-3.5 rounded-xl bg-[#1a1b26] border border-slate-800 flex flex-col gap-2.5 shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-sm text-white">
                            {cOrder.table_id ? cOrder.table_title : cOrder.delivery_type.toUpperCase()}
                          </span>
                          <span className="ml-2 font-black text-xs text-amber-400">
                            #{cOrder.token_no}
                          </span>
                        </div>

                        {/* Recall / Un-bump Button */}
                        <button
                          type="button"
                          onClick={async () => {
                            await btnRecallOrder(cOrder.id);
                          }}
                          className="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                        >
                          <IconArrowBackUp size={15} stroke={iconStroke} />
                          <span>Recall</span>
                        </button>
                      </div>

                      {/* Items Summary */}
                      <div className="text-xs text-slate-400 border-t border-slate-800/80 pt-2 flex flex-col gap-1">
                        {cOrder.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-300">
                              {it.quantity}x {it.item_title}
                            </span>
                            <span className="text-emerald-400 font-semibold text-[10px]">
                              Completed
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
