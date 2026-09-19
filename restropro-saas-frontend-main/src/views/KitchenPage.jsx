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
  IconFlame,
  IconChefHat,
  IconGlassFull,
  IconAlertCircle,
} from "@tabler/icons-react";
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
import { useTheme } from "../contexts/ThemeContext";
import clsx from "clsx";

export default function KitchenPage() {
  const { t } = useTranslation();
  const user = getUserDetailsInLocalStorage();
  const { socket, isSocketConnected } = useContext(SocketContext);
  const { theme } = useTheme();

  // Kitchen Stations hook
  const { data: stations = [] } = useKitchenStations();

  // Active Station Tab & Lock State (Persisted in localStorage)
  const [selectedStationId, setSelectedStationId] = useState(() => {
    return localStorage.getItem("kds_selected_station_id") || "all";
  });
  const [isStationLocked, setIsStationLocked] = useState(() => {
    return localStorage.getItem("kds_is_station_locked") === "true";
  });

  const [state, setState] = useState({
    kitchenOrders: [],
    isLoading: true,
  });

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
      toast.error(t("kitchen.error_loading_orders"));
      setState({
        ...state,
        isLoading: false,
      });
    }
  };

  const _initSocket = () => {
    const audio = new Audio("/new_order_sound.mp3");
    if (isSocketConnected) {
      socket.emit("authenticate", user.tenant_id);
      socket.on("new_order", (payload) => {
        console.log("New order received:", payload);
        audio.play().catch(() => {});
        btnRefresh();
      });

      socket.on("order_update", () => {
        console.log("Order update received");
        btnRefresh();
      });
    } else {
      initSocket();
      socket.emit("authenticate", user.tenant_id);
      socket.on("new_order", (payload) => {
        console.log("New order received:", payload);
        audio.play().catch(() => {});
        btnRefresh();
      });

      socket.on("order_update", () => {
        console.log("Order update received");
        btnRefresh();
      });
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
      toast("KDS unlocked - you can now switch stations freely.");
    }
  };

  const btnStartPreparingOrderItem = async (orderItemId) => {
    try {
      toast.loading(t("kitchen.loading_message"));
      const res = await updateKitchenOrderItemStatus(orderItemId, "preparing");
      toast.dismiss();
      if (res.status === 200) {
        await btnRefresh();
        sendOrderUpdateEvent();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t("kitchen.error_processing_request");
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  };

  const btnCompletePreparingOrderItem = async (orderItemId) => {
    try {
      toast.loading(t("kitchen.loading_message"));
      const res = await updateKitchenOrderItemStatus(orderItemId, "completed");
      toast.dismiss();
      if (res.status === 200) {
        sendOrderUpdateEvent();
        await btnRefresh();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t("kitchen.error_processing_request");
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  };

  const btnMarkOrderAllItems = async (orderId, targetStatus, fromStatuses) => {
    try {
      toast.loading(t("kitchen.loading_message"));
      // Pass the current station filter so station cooks only complete their station's items!
      const stationParam = selectedStationId === "all" ? null : selectedStationId;
      const res = await markOrderAllItemsStatus(orderId, targetStatus, fromStatuses, stationParam);
      toast.dismiss();
      if (res.status === 200) {
        sendOrderUpdateEvent();
        await btnRefresh();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t("kitchen.error_processing_request");
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  };

  // Filter orders that have pending items (not all completed/delivered/cancelled)
  const activeOrders = useMemo(() => {
    return kitchenOrders.filter((order) => {
      return !order.items.every(
        (item) => item.status === "completed" || item.status === "delivered" || item.status === "cancelled"
      );
    });
  }, [kitchenOrders]);

  // Compute pending ticket count per station for the station badges
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

  // Split items into displayItems vs companionItems based on the selected station filter
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
        // When filtered to a station, show only tickets that have items on this station!
        if (selectedStationId === "all") return true;
        return order.displayItems.length > 0;
      });
  }, [activeOrders, selectedStationId]);

  // Helper to summarize companion items by station
  const renderCompanionBadge = (companionItems) => {
    if (!companionItems || companionItems.length === 0) return null;

    // Group companion items by station name
    const grouped = {};
    companionItems.forEach((item) => {
      const name = item.station_name || "General Kitchen";
      const color = item.station_color || "#f97316";
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
      <div className="mt-3 pt-2.5 border-t border-dashed border-slate-200 dark:border-[#333] flex flex-wrap gap-1.5 items-center">
        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Companion:
        </span>
        {Object.entries(grouped).map(([stationName, info]) => {
          const allDone = info.completed === info.count;
          return (
            <span
              key={stationName}
              className={clsx(
                "text-[11px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 border",
                allDone
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                  : "bg-slate-100 text-slate-700 dark:bg-[#2a2a2a] dark:text-slate-300 border-slate-200 dark:border-[#3a3a3a]"
              )}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: info.color }}
              />
              <span>
                {info.count} at {stationName}
              </span>
              {info.completed > 0 && (
                <span className="text-[10px] opacity-80">
                  ({info.completed}/{info.count} done)
                </span>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  const enabledStations = stations.filter((s) => s.is_enabled);

  return (
    <Page>
      {/* ── Top Bar: Title, Refresh, Lock Toggle ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#2a2a2a]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
            <IconToolsKitchen2 size={22} stroke={iconStroke} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <span>{t("kitchen.title")}</span>
              {isStationLocked && (
                <span className="badge badge-sm bg-amber-500 text-white font-semibold gap-1 border-none shadow-sm">
                  <IconLock size={12} stroke={iconStroke} /> Locked
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400">
              Live Kitchen Display System (KDS) with station routing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Lock to Station Toggle Button */}
          <button
            onClick={handleToggleLock}
            className={clsx(
              "btn btn-sm rounded-xl gap-1.5 normal-case font-medium transition active:scale-95 shadow-sm border",
              isStationLocked
                ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600"
                : "bg-white dark:bg-[#252525] border-slate-200 dark:border-[#3a3a3a] text-slate-600 dark:text-slate-300 hover:bg-slate-50"
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
                <span>Lock Screen</span>
              </>
            )}
          </button>

          {/* Refresh Button */}
          <button
            onClick={btnRefresh}
            className="btn btn-sm bg-white dark:bg-[#252525] hover:bg-slate-100 dark:hover:bg-[#2e2e2e] border-slate-200 dark:border-[#3a3a3a] text-slate-700 dark:text-slate-200 rounded-xl gap-1 normal-case shadow-sm"
          >
            <IconRefresh size={16} stroke={iconStroke} />
            <span>{t("kitchen.refresh")}</span>
          </button>
        </div>
      </div>

      {/* ── Horizontal Station Tabs ── */}
      {enabledStations.length > 0 && (
        <div className="mt-4 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1">
          {/* All Stations / Expo Master Tab */}
          <button
            disabled={isStationLocked && selectedStationId !== "all"}
            onClick={() => handleStationChange("all")}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all border shadow-sm",
              selectedStationId === "all"
                ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-md scale-[1.02]"
                : "bg-white dark:bg-[#252525] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#333] hover:bg-slate-50 dark:hover:bg-[#2c2c2c]",
              isStationLocked && selectedStationId !== "all" && "opacity-40 cursor-not-allowed"
            )}
          >
            <IconChefHat size={16} stroke={iconStroke} />
            <span>All Stations (Expo)</span>
            <span
              className={clsx(
                "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                selectedStationId === "all"
                  ? "bg-white/20 dark:bg-black/20 text-inherit"
                  : "bg-slate-100 dark:bg-[#333] text-slate-600 dark:text-slate-300"
              )}
            >
              {stationCounts.all}
            </span>
          </button>

          {/* Individual Station Tabs */}
          {enabledStations.map((station) => {
            const isSelected = String(selectedStationId) === String(station.id);
            const count = stationCounts[station.id] || 0;

            return (
              <button
                key={station.id}
                disabled={isStationLocked && !isSelected}
                onClick={() => handleStationChange(String(station.id))}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all border shadow-sm",
                  isSelected
                    ? "text-white shadow-md scale-[1.02] border-transparent"
                    : "bg-white dark:bg-[#252525] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#333] hover:bg-slate-50 dark:hover:bg-[#2c2c2c]",
                  isStationLocked && !isSelected && "opacity-40 cursor-not-allowed"
                )}
                style={{
                  backgroundColor: isSelected ? station.color || "#f97316" : undefined,
                  borderColor: isSelected ? station.color || "#f97316" : undefined,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: isSelected ? "#ffffff" : station.color || "#f97316",
                  }}
                />
                <span>{station.name}</span>
                <span
                  className={clsx(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                    isSelected
                      ? "bg-white/25 text-white"
                      : "bg-slate-100 dark:bg-[#333] text-slate-600 dark:text-slate-300"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {/* Unassigned Items Tab (if any) */}
          {stationCounts.unassigned > 0 && (
            <button
              disabled={isStationLocked && selectedStationId !== "unassigned"}
              onClick={() => handleStationChange("unassigned")}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all border shadow-sm",
                selectedStationId === "unassigned"
                  ? "bg-slate-700 text-white border-slate-700 shadow-md scale-[1.02]"
                  : "bg-white dark:bg-[#252525] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#333] hover:bg-slate-50",
                isStationLocked && selectedStationId !== "unassigned" && "opacity-40 cursor-not-allowed"
              )}
            >
              <span>Unassigned</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-[#333]">
                {stationCounts.unassigned}
              </span>
            </button>
          )}
        </div>
      )}

      {/* ── Content Area: Loading / Empty / Order Cards ── */}
      {isLoading && (
        <div className="flex items-center justify-center p-12 text-slate-400 gap-3">
          <span className="loading loading-spinner loading-md"></span>
          <span>{t("kitchen.loading_message")}</span>
        </div>
      )}

      {!isLoading && displayOrders?.length === 0 && (
        <div className="w-full h-[calc(100vh-280px)] flex gap-4 flex-col items-center justify-center">
          <img
            src="/assets/illustrations/kitchen-order-not-found.webp"
            alt={t("kitchen.no_orders_img_alt")}
            className="w-1/2 md:w-56 opacity-90 drop-shadow-sm"
          />
          <div className="text-center">
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">
              {selectedStationId === "all"
                ? t("kitchen.no_pending_orders")
                : `No pending orders for this station`}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {selectedStationId === "all"
                ? "New orders placed in POS or QR will arrive here in real time."
                : "Switch to 'All Stations (Expo)' or check back when items for this station are placed."}
            </p>
          </div>
        </div>
      )}

      {!isLoading && displayOrders?.length > 0 && (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
          {displayOrders.map((order, index) => {
            const {
              id,
              delivery_type,
              customer_type,
              table_id,
              table_title,
              floor,
              token_no,
              displayItems = [],
              companionItems = [],
            } = order;

            const isAllDisplayItemsCompleted = displayItems.every(
              (i) => i.status === "completed" || i.status === "delivered" || i.status === "cancelled"
            );

            return (
              <div
                key={id || index}
                className={clsx(
                  "border rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md bg-white dark:bg-[#1f1f1f]",
                  isAllDisplayItemsCompleted
                    ? "border-emerald-300 dark:border-emerald-900/60 opacity-80"
                    : "border-slate-200 dark:border-[#2f2f2f]"
                )}
              >
                {/* ── Order Header ── */}
                <div>
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-[#2a2a2a]">
                    <div className="flex items-center gap-2.5">
                      <div className="flex w-10 h-10 rounded-xl items-center justify-center bg-slate-100 dark:bg-[#282828] text-slate-700 dark:text-slate-200">
                        {delivery_type === "dinein" ? (
                          <IconArmchair size={22} stroke={iconStroke} />
                        ) : (
                          <IconBoxSeam size={22} stroke={iconStroke} />
                        )}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                          {table_id ? table_title : `${delivery_type} ${customer_type}`.toUpperCase()}
                        </p>
                        {floor && <p className="text-xs text-slate-400">{floor}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-end">
                        <span className="badge badge-sm font-bold bg-slate-100 dark:bg-[#2a2a2a] text-slate-800 dark:text-slate-200 border-none px-2 py-2">
                          #{token_no}
                        </span>
                      </div>

                      {/* Dropdown for Start All / Complete All */}
                      {(displayItems.some((i) => i.status === "created") ||
                        displayItems.some((i) => i.status === "preparing")) && (
                        <div className="dropdown dropdown-end">
                          <div
                            tabIndex={0}
                            role="button"
                            className="btn btn-sm btn-circle btn-ghost text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 h-8 w-8 min-h-0"
                          >
                            <IconDotsVertical size={16} stroke={iconStroke} />
                          </div>
                          <ul
                            tabIndex={0}
                            className="dropdown-content z-20 menu p-1.5 shadow-xl bg-white dark:bg-[#252525] rounded-xl w-48 border border-slate-200 dark:border-[#3a3a3a]"
                          >
                            {displayItems.some((i) => i.status === "created") && (
                              <li>
                                <button
                                  className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400"
                                  onClick={() => {
                                    if (document.activeElement && typeof document.activeElement.blur === "function") {
                                      document.activeElement.blur();
                                    }
                                    btnMarkOrderAllItems(id, "preparing", ["created"]);
                                  }}
                                >
                                  <IconClock size={16} stroke={iconStroke} />
                                  <span>Start All ({displayItems.length})</span>
                                </button>
                              </li>
                            )}
                            {displayItems.some((i) => i.status === "created" || i.status === "preparing") && (
                              <li>
                                <button
                                  className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                                  onClick={() => {
                                    if (document.activeElement && typeof document.activeElement.blur === "function") {
                                      document.activeElement.blur();
                                    }
                                    btnMarkOrderAllItems(id, "completed", ["created", "preparing"]);
                                  }}
                                >
                                  <IconCheck size={16} stroke={iconStroke} />
                                  <span>Complete All ({displayItems.length})</span>
                                </button>
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Order Display Items ── */}
                  <div className="mt-3 flex flex-col divide-y divide-slate-100 dark:divide-[#282828]">
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

                      const addonsText =
                        addons?.length > 0 ? addons?.map((a) => a.title)?.join(", ") : null;

                      return (
                        <div key={orderItemId || itemIdx} className="flex items-start gap-2.5 py-2.5">
                          {/* Item status icon */}
                          <div className="pt-0.5">
                            {status === "preparing" && (
                              <IconClock stroke={iconStroke} size={18} className="text-amber-500 shrink-0" />
                            )}
                            {status === "completed" && (
                              <IconCheck stroke={iconStroke} size={18} className="text-emerald-500 shrink-0" />
                            )}
                            {status === "cancelled" && (
                              <IconX stroke={iconStroke} size={18} className="text-rose-500 shrink-0" />
                            )}
                            {status === "delivered" && (
                              <IconChecks stroke={iconStroke} size={18} className="text-emerald-600 shrink-0" />
                            )}
                            {status === "created" && (
                              <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 mt-0.5" />
                            )}
                          </div>

                          {/* Item Title, Notes, and Station Tag (Expo Mode) */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                                {item_title} {variant_title ? `(${variant_title})` : ""}
                              </span>
                              <span className="badge badge-sm font-bold bg-slate-100 dark:bg-[#282828] text-slate-600 dark:text-slate-300 text-[10px]">
                                x{quantity}
                              </span>

                              {/* In Expo View, render station color chip */}
                              {selectedStationId === "all" && station_name && (
                                <span
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border border-black/5 dark:border-white/10"
                                  style={{
                                    backgroundColor: `${station_color || "#f97316"}20`,
                                    color: station_color || "#f97316",
                                  }}
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: station_color || "#f97316" }}
                                  />
                                  <span>{station_name}</span>
                                </span>
                              )}
                            </div>

                            {addonsText && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                + {addonsText}
                              </p>
                            )}
                            {notes && (
                              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                                Note: {notes}
                              </p>
                            )}
                          </div>

                          {/* Action Button */}
                          <div className="pt-0.5 shrink-0">
                            {status === "created" && (
                              <button
                                onClick={() => btnStartPreparingOrderItem(orderItemId)}
                                className="btn btn-xs bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-700 dark:bg-[#282828] dark:hover:bg-amber-950/40 dark:text-slate-200 dark:hover:text-amber-400 border-none rounded-lg font-medium transition active:scale-95"
                              >
                                {t("kitchen.start_making")}
                              </button>
                            )}
                            {status === "preparing" && (
                              <button
                                onClick={() => btnCompletePreparingOrderItem(orderItemId)}
                                className="btn btn-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-400 border-none rounded-lg font-semibold transition active:scale-95"
                              >
                                {t("kitchen.complete")}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Companion Items Badge (Station Mode) ── */}
                {selectedStationId !== "all" && renderCompanionBadge(companionItems)}
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
