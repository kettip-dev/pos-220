import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams } from "react-router-dom";
import { getOrderStatusDisplayData } from "../controllers/order_status_display.controller";
import { SocketContext } from "../contexts/SocketContext";
import { initSocket } from "../utils/socket";
import { useTheme } from "../contexts/ThemeContext";
import { getImageURL } from "../helpers/ImageHelper";
import {
  IconCheck,
  IconChecks,
  IconClock,
  IconChefHat,
  IconSparkles,
  IconLayoutColumns,
  IconLayoutRows,
  IconListDetails,
  IconHash,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";

export default function OrderStatusDisplayPage() {
  const { qrcode } = useParams();
  const { socket, isSocketConnected } = useContext(SocketContext);
  const { theme } = useTheme();

  const [state, setState] = useState({
    storeName: "",
    storeImage: null,
    orders: [],
    isLoading: true,
    error: null,
    tenantId: null,
  });

  // Display mode state: "detailed" (Full Item & Prep details) vs "token" (Token Numbers Only)
  const [displayMode, setDisplayMode] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlMode = searchParams.get("mode");
    if (urlMode === "token" || urlMode === "detailed") return urlMode;
    return localStorage.getItem("orderStatusDisplayMode") || "detailed";
  });

  const displayModeRef = useRef(displayMode);
  useEffect(() => {
    displayModeRef.current = displayMode;
  }, [displayMode]);

  const toggleDisplayMode = (mode) => {
    setDisplayMode(mode);
    localStorage.setItem("orderStatusDisplayMode", mode);
  };

  // Sound announcement enable/disable state
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem("orderStatusSoundEnabled");
    return saved !== null ? saved === "true" : true;
  });

  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("orderStatusSoundEnabled", String(next));
      if (!next && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };

  // Layout mode state for Detailed View: "vertical" (Side-by-Side) vs "horizontal" (Stacked Top/Bottom)
  const [layoutMode, setLayoutMode] = useState(() => {
    return localStorage.getItem("orderStatusLayout") || "vertical";
  });

  const layoutModeRef = useRef(layoutMode);
  useEffect(() => {
    layoutModeRef.current = layoutMode;
  }, [layoutMode]);

  // Resizable Split Ratios for Vertical (left %) and Horizontal (top %)
  const [splitRatioVert, setSplitRatioVert] = useState(() => {
    const saved = localStorage.getItem("orderStatusSplitRatioVertical");
    return saved ? Number(saved) : 50;
  });

  const [splitRatioHoriz, setSplitRatioHoriz] = useState(() => {
    const saved = localStorage.getItem("orderStatusSplitRatioHorizontal");
    return saved ? Number(saved) : 50;
  });

  const isDraggingRef = useRef(false);
  const mainContainerRef = useRef(null);

  const toggleLayoutMode = () => {
    const nextMode = layoutMode === "vertical" ? "horizontal" : "vertical";
    setLayoutMode(nextMode);
    localStorage.setItem("orderStatusLayout", nextMode);
  };

  // Drag handlers for LeetCode-style resizable split screen (Vertical & Horizontal)
  const handleMouseDown = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = layoutModeRef.current === "vertical" ? "col-resize" : "row-resize";
  };

  const resetSplitRatio = () => {
    if (layoutMode === "vertical") {
      setSplitRatioVert(50);
      localStorage.setItem("orderStatusSplitRatioVertical", "50");
    } else {
      setSplitRatioHoriz(50);
      localStorage.setItem("orderStatusSplitRatioHorizontal", "50");
    }
  };

  useEffect(() => {
    const handlePointerMove = (clientX, clientY) => {
      if (!isDraggingRef.current || !mainContainerRef.current) return;
      const rect = mainContainerRef.current.getBoundingClientRect();

      if (layoutModeRef.current === "vertical") {
        const relativeX = clientX - rect.left;
        let newRatio = (relativeX / rect.width) * 100;
        newRatio = Math.max(15, Math.min(85, newRatio));
        setSplitRatioVert(newRatio);
        localStorage.setItem("orderStatusSplitRatioVertical", String(newRatio));
      } else {
        const relativeY = clientY - rect.top;
        let newRatio = (relativeY / rect.height) * 100;
        newRatio = Math.max(15, Math.min(85, newRatio));
        setSplitRatioHoriz(newRatio);
        localStorage.setItem("orderStatusSplitRatioHorizontal", String(newRatio));
      }
    };

    const handleMouseMove = (e) => {
      handlePointerMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e) => {
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleEnd = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, []);

  const [heroToken, setHeroToken] = useState(null);
  const [rightPanelTokens, setRightPanelTokens] = useState([]);
  const heroTimeoutRef = useRef(null);
  const processedOrderIdsRef = useRef(new Set());

  // Token Announcement Transition Effect (Left Hero Panel vs Right Side Panel Grid)
  useEffect(() => {
    if (displayMode !== "token") return;

    // Filter 100% ready orders strictly and sort by ready timestamp (oldest to newest)
    const currentReadyOrders = state.orders
      .filter((order) => {
        if (!order.items || order.items.length === 0) return false;
        const activeItems = order.items.filter((i) => i.status !== "cancelled");
        if (activeItems.length === 0) return false;

        const allItemsReady = activeItems.every(
          (i) => i.status === "completed" || i.status === "delivered"
        );
        const hasPendingItems = activeItems.some(
          (i) => i.status === "created" || i.status === "preparing" || !i.status
        );

        return allItemsReady && !hasPendingItems;
      })
      .sort((a, b) => {
        const timeA = readyTimestampsRef.current[a.id] || (a.id * 1000);
        const timeB = readyTimestampsRef.current[b.id] || (b.id * 1000);
        return timeA - timeB; // Ascending: latest ready order at end of array
      });

    const currentReadyIds = new Set(currentReadyOrders.map((o) => o.id));

    // Find new ready orders not yet processed into hero or right panel
    const newReadyOrders = currentReadyOrders.filter(
      (o) => !processedOrderIdsRef.current.has(o.id)
    );

    if (newReadyOrders.length > 0) {
      // Mark current ready orders as processed
      currentReadyOrders.forEach((o) => processedOrderIdsRef.current.add(o.id));

      const latestNewOrder = newReadyOrders[newReadyOrders.length - 1];
      const otherNewOrders = newReadyOrders.filter((o) => o.id !== latestNewOrder.id);

      setHeroToken((prevHero) => {
        // If there was an existing heroToken, move it to right panel immediately!
        if (prevHero && prevHero.id !== latestNewOrder.id && currentReadyIds.has(prevHero.id)) {
          setRightPanelTokens((prevRight) => {
            const filtered = prevRight.filter((o) => currentReadyIds.has(o.id));
            const existingIds = new Set(filtered.map((o) => o.id));
            const toAdd = [prevHero, ...otherNewOrders].filter((o) => !existingIds.has(o.id));
            return [...toAdd, ...filtered];
          });
        } else {
          setRightPanelTokens((prevRight) => {
            const filtered = prevRight.filter((o) => currentReadyIds.has(o.id));
            const existingIds = new Set(filtered.map((o) => o.id));
            const toAdd = otherNewOrders.filter((o) => !existingIds.has(o.id));
            return [...toAdd, ...filtered];
          });
        }
        return latestNewOrder;
      });

      // Clear existing timer and start fresh 15-second timer for latestNewOrder
      if (heroTimeoutRef.current) {
        clearTimeout(heroTimeoutRef.current);
      }

      heroTimeoutRef.current = setTimeout(() => {
        setHeroToken((currentHero) => {
          if (currentHero && currentHero.id === latestNewOrder.id) {
            setRightPanelTokens((prevRight) => {
              const exists = prevRight.some((item) => item.id === currentHero.id);
              if (!exists) {
                return [currentHero, ...prevRight];
              }
              return prevRight;
            });
            return null;
          }
          return currentHero;
        });
      }, 15000);
    } else {
      // Sync removals (if an order was collected/completed in POS)
      setHeroToken((prevHero) => {
        if (prevHero && !currentReadyIds.has(prevHero.id)) {
          return null;
        }
        return prevHero;
      });
      setRightPanelTokens((prevRight) => {
        return prevRight.filter((o) => currentReadyIds.has(o.id));
      });
    }
  }, [state.orders, displayMode]);

  const [currentTime, setCurrentTime] = useState(new Date());
  const readyScrollRef = useRef(null);
  const previousReadyItemsCountRef = useRef(0);
  const previousTokenReadyOrdersCountRef = useRef(0);
  const readyTimestampsRef = useRef({});
  const preparingTimestampsRef = useRef({});
  const orderReadyCountsRef = useRef({});

  // Web Speech API Voice Token Announcement Helper (Female Voice Priority)
  const speakTokenAnnouncement = (tokenNo) => {
    if (!soundEnabledRef.current) return;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel(); // Clear any pending speech queue
        const message = `Token number ${tokenNo}`;
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 0.9;
        utterance.pitch = 1; // Female tone pitch
        utterance.lang = "en-US";

        // Query available browser voices and pick a female voice (Windows Zira, Mac Samantha/Victoria, Chrome Female)
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const femaleVoice = voices.find((v) => {
            const name = v.name.toLowerCase();
            return (
              v.lang.startsWith("en") &&
              (name.includes("female") ||
                name.includes("zira") ||
                name.includes("samantha") ||
                name.includes("victoria") ||
                name.includes("karen") ||
                name.includes("google us english"))
            );
          });

          if (femaleVoice) {
            utterance.voice = femaleVoice;
          }
        }

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error("Speech synthesis error:", err);
      }
    }
  };

  // Pre-load Web Speech voices for immediate availability
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Live clock timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch data from backend
  const fetchData = async (playChimeOnReadyIncrease = false) => {
    try {
      const res = await getOrderStatusDisplayData(qrcode);
      if (res.status === 200 && res.data.success) {
        const { storeName, storeImage, orders, tenantId } = res.data;

        // 1. Calculate individual ready items count (for Detailed View)
        const currentReadyItemsCount = (orders || []).reduce((acc, order) => {
          if (!order.items) return acc;
          return (
            acc +
            order.items.filter(
              (i) => i.status === "completed" || i.status === "delivered"
            ).length
          );
        }, 0);

        // 2. Calculate 100% fully ready token orders count (for Token Display View)
        const currentTokenReadyOrdersCount = (orders || []).filter((order) => {
          if (!order.items || order.items.length === 0) return false;
          const activeItems = order.items.filter((i) => i.status !== "cancelled");
          if (activeItems.length === 0) return false;
          const allItemsReady = activeItems.every(
            (i) => i.status === "completed" || i.status === "delivered"
          );
          const hasPendingItems = activeItems.some(
            (i) => i.status === "created" || i.status === "preparing" || !i.status
          );
          return allItemsReady && !hasPendingItems;
        }).length;

        // 3. Play Web Speech Voice Announcement based on active display mode:
        // - In Token Mode: Voice announces ONLY when a NEW TOKEN is added to the screen
        // - In Detailed View: Voice announces when ready items count increases
        const shouldPlayChimeInTokenMode =
          displayModeRef.current === "token" &&
          currentTokenReadyOrdersCount > previousTokenReadyOrdersCountRef.current;

        const shouldPlayChimeInDetailedMode =
          displayModeRef.current === "detailed" &&
          currentReadyItemsCount > previousReadyItemsCountRef.current;

        if (
          playChimeOnReadyIncrease &&
          soundEnabledRef.current &&
          (shouldPlayChimeInTokenMode || shouldPlayChimeInDetailedMode)
        ) {
          try {
            let targetOrderToAnnounce = null;
            if (displayModeRef.current === "token") {
              const currentTokenReadyOrders = (orders || []).filter((order) => {
                if (!order.items || order.items.length === 0) return false;
                const activeItems = order.items.filter((i) => i.status !== "cancelled");
                if (activeItems.length === 0) return false;
                const allItemsReady = activeItems.every(
                  (i) => i.status === "completed" || i.status === "delivered"
                );
                const hasPendingItems = activeItems.some(
                  (i) => i.status === "created" || i.status === "preparing" || !i.status
                );
                return allItemsReady && !hasPendingItems;
              });
              if (currentTokenReadyOrders.length > 0) {
                targetOrderToAnnounce = currentTokenReadyOrders[currentTokenReadyOrders.length - 1];
              }
            } else {
              const currentReadyOrders = (orders || []).filter((order) => {
                if (!order.items || order.items.length === 0) return false;
                return order.items.some((i) => i.status === "completed" || i.status === "delivered");
              });
              if (currentReadyOrders.length > 0) {
                targetOrderToAnnounce = currentReadyOrders[currentReadyOrders.length - 1];
              }
            }

            if (targetOrderToAnnounce && targetOrderToAnnounce.token_no) {
              speakTokenAnnouncement(targetOrderToAnnounce.token_no);
            } else {
              const audio = new Audio("/new_order_sound.mp3");
              audio.play().catch((e) => console.log("Audio play suppressed:", e));
            }
          } catch (e) {
            console.error(e);
          }
        }

        previousReadyItemsCountRef.current = currentReadyItemsCount;
        previousTokenReadyOrdersCountRef.current = currentTokenReadyOrdersCount;

        // Track state transition timestamps for ordering (Preparing and Ready for Pickup)
        const now = Date.now();
        (orders || []).forEach((order) => {
          if (order.items && order.items.length > 0) {
            // Track preparing timestamps
            const isPreparing = order.items.some(
              (i) => i.status === "created" || i.status === "preparing"
            );
            if (isPreparing && !preparingTimestampsRef.current[order.id]) {
              preparingTimestampsRef.current[order.id] = now;
            }

            // Track ready timestamps & item count increases
            const readyItemsCount = order.items.filter(
              (i) => i.status === "completed" || i.status === "delivered"
            ).length;

            if (readyItemsCount > 0) {
              const prevCount = orderReadyCountsRef.current[order.id] || 0;
              if (readyItemsCount > prevCount || !readyTimestampsRef.current[order.id]) {
                readyTimestampsRef.current[order.id] = now;
              }
            }
            orderReadyCountsRef.current[order.id] = readyItemsCount;
          }
        });

        setState({
          storeName: storeName || "RestroPro",
          storeImage: storeImage || null,
          orders: orders || [],
          isLoading: false,
          error: null,
          tenantId: tenantId,
        });

        if (tenantId && isSocketConnected && socket) {
          socket.emit("authenticate", tenantId);
        }
      }
    } catch (err) {
      console.error(err);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Unable to load order status display.",
      }));
    }
  };

  useEffect(() => {
    fetchData();
  }, [qrcode]);

  // Socket listener for live updates
  useEffect(() => {
    if (!state.tenantId) return;

    const handleUpdate = () => {
      fetchData(true);
    };

    if (isSocketConnected && socket) {
      socket.emit("authenticate", state.tenantId);
      socket.on("order_update", handleUpdate);
      socket.on("new_order", handleUpdate);
      socket.on("ready_for_pickup", handleUpdate);
    } else {
      initSocket();
      socket.emit("authenticate", state.tenantId);
      socket.on("order_update", handleUpdate);
      socket.on("new_order", handleUpdate);
      socket.on("ready_for_pickup", handleUpdate);
    }

    return () => {
      if (socket) {
        socket.off("order_update", handleUpdate);
        socket.off("new_order", handleUpdate);
        socket.off("ready_for_pickup", handleUpdate);
      }
    };
  }, [state.tenantId, isSocketConnected]);



  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-[#f8faf8] dark:bg-[#0a0a0a] text-gray-900 dark:text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-restro-green border-t-transparent rounded-full animate-spin"></div>
          <p className="text-restro-text text-lg tracking-wide">Loading Order Status Display...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-[#f8faf8] dark:bg-[#0a0a0a] text-gray-900 dark:text-white flex items-center justify-center">
        <div className="text-center p-8 bg-white dark:bg-restro-gray border border-restro-border-green rounded-2xl max-w-md shadow-md">
          <p className="text-restro-red text-xl font-bold mb-2">Display Error</p>
          <p className="text-restro-text">{state.error}</p>
        </div>
      </div>
    );
  }

  // --- Detailed View Filters ---
  // PREPARING orders: orders with at least 1 item created or preparing, sorted newest to top (position 1)
  const preparingOrders = state.orders
    .filter((order) => {
      if (!order.items || order.items.length === 0) return false;
      return order.items.some((i) => i.status === "created" || i.status === "preparing");
    })
    .sort((a, b) => {
      const timeA = preparingTimestampsRef.current[a.id] || (a.id * 1000);
      const timeB = preparingTimestampsRef.current[b.id] || (b.id * 1000);
      return timeB - timeA;
    });

  // READY orders: orders with at least 1 item completed or delivered, sorted newest to top (position 1)
  const readyOrders = state.orders
    .filter((order) => {
      if (!order.items || order.items.length === 0) return false;
      return order.items.some((i) => i.status === "completed" || i.status === "delivered");
    })
    .sort((a, b) => {
      const timeA = readyTimestampsRef.current[a.id] || (a.id * 1000);
      const timeB = readyTimestampsRef.current[b.id] || (b.id * 1000);
      return timeB - timeA;
    });

  // --- Token Display View Filters (Driven strictly by 100% overall order completion) ---
  // Token READY orders: orders where ALL active items are completed/delivered and ZERO items are created/preparing
  const tokenReadyOrders = state.orders.filter((order) => {
    if (!order.items || order.items.length === 0) return false;
    const activeItems = order.items.filter((i) => i.status !== "cancelled");
    if (activeItems.length === 0) return false;

    const allItemsReady = activeItems.every(
      (i) => i.status === "completed" || i.status === "delivered"
    );
    const hasPendingItems = activeItems.some(
      (i) => i.status === "created" || i.status === "preparing" || !i.status
    );

    return allItemsReady && !hasPendingItems;
  });

  return (
    <div className="h-screen max-h-screen min-h-screen bg-[#f8faf8] dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100 flex flex-col overflow-hidden transition-colors">
      {/* Compact Header Bar */}
      <header className="bg-white dark:bg-[#121212] border-b border-restro-border-green dark:border-emerald-500/30 px-6 py-2 flex items-center justify-between shadow-xs shrink-0 z-10">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-restro-green-light dark:bg-emerald-950/60 border border-restro-border-green dark:border-emerald-500/40 flex items-center justify-center text-restro-green dark:text-emerald-400 shadow-inner overflow-hidden shrink-0">
            {state.storeImage ? (
              <img
                src={getImageURL(state.storeImage)}
                alt={state.storeName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = "none";
                  if (e.target.nextSibling) {
                    e.target.nextSibling.style.display = "flex";
                  }
                }}
              />
            ) : null}
            <div
              className={`w-full h-full items-center justify-center ${
                state.storeImage ? "hidden" : "flex"
              }`}
            >
              <IconChefHat size={20} stroke={iconStroke} />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{state.storeName}</h1>
            <p className="text-[10px] text-restro-text dark:text-gray-400 uppercase tracking-wider font-bold">
              {displayMode === "token" ? "Token Display Screen" : "Live Order Tracker"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Order Token Sound Toggle Button (Available in both modes) */}
          <button
            onClick={toggleSound}
            title={soundEnabled ? "Mute Order Token Sound" : "Enable Order Token Sound"}
            className={`p-2 rounded-xl border transition-all shadow-xs shrink-0 ${
              soundEnabled
                ? "bg-restro-gray dark:bg-[#1e1e1e] border-restro-border-green dark:border-emerald-500/40 text-restro-green dark:text-emerald-400 hover:bg-restro-green-light dark:hover:bg-emerald-950/60"
                : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/50 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60"
            }`}
          >
            {soundEnabled ? (
              <IconVolume size={20} stroke={iconStroke} />
            ) : (
              <IconVolumeOff size={20} stroke={iconStroke} />
            )}
          </button>

          {/* Icon-Only Mode Toggle Button (Detailed View <-> Token Display) */}
          <button
            onClick={() => toggleDisplayMode(displayMode === "detailed" ? "token" : "detailed")}
            title={`Switch to ${displayMode === "detailed" ? "Token Display" : "Detailed View"}`}
            className="p-2 rounded-xl bg-restro-gray dark:bg-[#1e1e1e] border border-restro-border-green dark:border-emerald-500/40 text-restro-green dark:text-emerald-400 hover:bg-restro-green-light dark:hover:bg-emerald-950/60 transition-all shadow-xs shrink-0"
          >
            {displayMode === "detailed" ? (
              <IconHash size={20} stroke={iconStroke} />
            ) : (
              <IconListDetails size={20} stroke={iconStroke} />
            )}
          </button>

          {/* Icon-Only Layout Orientation Toggle Button (Detailed Mode Only) */}
          {displayMode === "detailed" && (
            <button
              onClick={toggleLayoutMode}
              title={`Switch to ${layoutMode === "vertical" ? "Horizontal (Stacked)" : "Vertical (Side-by-Side)"} view`}
              className="p-2 rounded-xl bg-restro-gray dark:bg-[#1e1e1e] border border-restro-border-green dark:border-emerald-500/40 text-restro-green dark:text-emerald-400 hover:bg-restro-green-light dark:hover:bg-emerald-950/60 transition-all shadow-xs shrink-0"
            >
              {layoutMode === "vertical" ? (
                <IconLayoutColumns size={20} stroke={iconStroke} />
              ) : (
                <IconLayoutRows size={20} stroke={iconStroke} />
              )}
            </button>
          )}

          {/* Time Display */}
          <div className="text-right border-l border-restro-border-green dark:border-emerald-500/30 pl-3">
            <p className="text-lg font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
              {currentTime.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
            <p className="text-[10px] text-restro-text dark:text-gray-400 font-medium">
              {currentTime.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </header>

      {/* Main Container: Render either Hero + Queue Token Display or Detailed Order Status Swimlanes */}
      {displayMode === "token" ? (
        <main className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col md:flex-row gap-5 h-[calc(100vh-60px)] bg-[#f8faf8] dark:bg-[#0a0a0a]">
          {/* LEFT HERO PANEL (RECENTLY CALLED TOKEN) */}
          <section className="w-full md:w-5/12 flex flex-col items-center justify-center rounded-3xl border border-restro-border-green dark:border-emerald-500/30 bg-white dark:bg-[#121212] p-6 shrink-0 max-h-full">
            <h2 className="text-base font-extrabold text-gray-800 dark:text-gray-200 tracking-wider uppercase mb-6">
              RECENTLY CALLED TOKEN
            </h2>

            {/* Big Token Hero Card with exact requested background class and no shadow */}
            <div className="bg-gray-50 dark:bg-restro-gray border border-restro-border-green dark:border-emerald-500/40 rounded-3xl p-8 md:p-12 flex flex-col items-center justify-center w-full max-w-md min-h-[280px] transition-all duration-300">
              {heroToken ? (
                <>
                  <span className="text-7xl sm:text-8xl md:text-9xl font-extrabold text-gray-900 dark:text-white leading-none tracking-tight">
                    {heroToken.token_no}
                  </span>
                  <span className="px-5 py-2 rounded-full text-xs sm:text-sm font-extrabold uppercase tracking-wider bg-restro-green-light dark:bg-emerald-950/80 text-restro-green-dark dark:text-emerald-300 border border-restro-border-green dark:border-emerald-500/40 flex items-center gap-1.5 mt-8">
                    <IconCheck size={16} stroke={iconStroke} /> READY FOR PICKUP
                  </span>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-4">
                  <div className="w-14 h-14 rounded-full bg-restro-gray dark:bg-emerald-950/60 border border-restro-border-green dark:border-emerald-500/40 flex items-center justify-center mb-3">
                    <IconSparkles size={28} stroke={iconStroke} className="text-restro-green dark:text-emerald-400" />
                  </div>
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Waiting for call...</p>
                  <p className="text-xs text-restro-text dark:text-gray-400 mt-1">Tokens will be announced here</p>
                </div>
              )}
            </div>
          </section>

          {/* RIGHT SIDE PANEL (OTHER READY TOKENS GRID) */}
          <section className="w-full md:w-7/12 flex flex-col rounded-3xl border border-restro-border-green dark:border-emerald-500/30 bg-white dark:bg-[#121212] p-5 overflow-hidden shrink-0 max-h-full">
            <div className="flex items-center justify-between pb-3 border-b border-restro-border-green dark:border-emerald-500/30 mb-4 shrink-0">
              <h2 className="text-sm font-extrabold text-restro-green dark:text-emerald-400 tracking-widest uppercase">
                Ready Tokens
              </h2>
              <span className="px-3 py-0.5 rounded-full bg-restro-green-light dark:bg-emerald-950/70 border border-restro-border-green dark:border-emerald-500/40 text-restro-green dark:text-emerald-400 text-xs font-bold">
                {rightPanelTokens.length} Ready
              </span>
            </div>

            <div className="overflow-y-auto no-scrollbar flex-1 pr-1 min-h-0">
              {rightPanelTokens.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-restro-text dark:text-gray-400">
                  <div className="w-12 h-12 rounded-full bg-restro-gray dark:bg-emerald-950/60 border border-restro-border-green dark:border-emerald-500/40 flex items-center justify-center mb-3">
                    <IconSparkles size={24} stroke={iconStroke} className="text-restro-green dark:text-emerald-400" />
                  </div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">No other ready tokens</p>
                  <p className="text-xs text-restro-text dark:text-gray-400 mt-1">Tokens move here after announcement</p>
                </div>
              ) : (
                <div
                  className="grid gap-3.5 items-start"
                  style={{
                    gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, 180px), 1fr))`,
                  }}
                >
                  {rightPanelTokens.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-2xl border border-restro-border-green dark:border-emerald-500/30 bg-white dark:bg-[#161616] p-4 flex flex-col items-center justify-between transition-all duration-200 min-h-[120px]"
                    >
                      <div className="flex-1 flex items-center justify-center py-1">
                        <span className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white leading-none tracking-tight">
                          {order.token_no}
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-restro-green-light dark:bg-emerald-950/80 text-restro-green-dark dark:text-emerald-300 border border-restro-border-green dark:border-emerald-500/40 flex items-center gap-1 shrink-0">
                        <IconCheck size={11} stroke={iconStroke} /> READY FOR PICKUP
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      ) : (
        /* Main Swimlane Layout Container for Detailed View with Resizable Split Screen */
        <main
          ref={mainContainerRef}
          className={`flex-1 p-3 overflow-hidden ${
            layoutMode === "vertical"
              ? "flex flex-row gap-0.5 h-[calc(100vh-60px)]"
              : "flex flex-col gap-0.5 h-[calc(100vh-60px)]"
          }`}
        >
          {/* Preparing Swimlane Panel */}
          <section
            style={
              layoutMode === "vertical"
                ? { width: `calc(${splitRatioVert}% - 6px)`, height: "100%" }
                : { height: `calc(${splitRatioHoriz}% - 6px)`, width: "100%" }
            }
            className="flex flex-col rounded-2xl border border-restro-border-green bg-white dark:bg-[#121212] p-3 overflow-hidden shadow-xs shrink-0 max-h-full"
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between pb-2 border-b border-restro-border-green mb-2 shrink-0">
              <h2 className="text-sm font-extrabold text-gray-900 dark:text-white tracking-wide uppercase">
                Preparing
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-restro-gray border border-restro-border-green text-restro-text text-xs font-bold">
                {preparingOrders.length} {preparingOrders.length === 1 ? "Order" : "Orders"}
              </span>
            </div>

            {/* Inner Scrollable Cards Container */}
            <div className="overflow-y-auto no-scrollbar flex-1 pr-1 min-h-0">
              {preparingOrders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 min-h-[140px]">
                  <div className="w-12 h-12 rounded-full bg-restro-gray dark:bg-restro-gray/60 border border-restro-border-green flex items-center justify-center mb-2 text-restro-text">
                    <IconChefHat size={26} stroke={iconStroke} />
                  </div>
                  <p className="text-restro-text font-bold text-sm">All caught up!</p>
                  <p className="text-xs text-restro-text mt-0.5">No orders currently in preparation</p>
                </div>
              ) : (
                <div
                  className="grid gap-2.5 items-start transition-all duration-200 ease-in-out"
                  style={{
                    gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, 270px), 1fr))`,
                  }}
                >
                  {preparingOrders.map((order) => {
                    const totalItems = order.items.length;
                    const completedItems = order.items.filter(
                      (i) => i.status === "completed" || i.status === "delivered"
                    ).length;

                    return (
                      <div
                        key={order.id}
                        className="rounded-2xl border border-restro-border-green bg-white dark:bg-[#181818] p-3 shadow-sm flex flex-col justify-start space-y-2 transition-all duration-200 ease-in-out transform hover:-translate-y-0.5 hover:shadow-md h-full"
                      >
                        {/* Single Horizontal Header Row */}
                        <div className="flex items-center justify-between pb-1">
                          <div className="w-9 h-9 rounded-full bg-gray-800 dark:bg-[#0a0a0a] text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                            {order.token_no}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-restro-text bg-restro-gray border border-restro-border-green px-2 py-0.5 rounded-full">
                              {completedItems}/{totalItems} ready
                            </span>
                            <span className="text-xs text-restro-text font-bold">
                              {new Date(order.date).toLocaleTimeString("en-US", { timeStyle: "short" })}
                            </span>
                          </div>
                        </div>

                        {/* Vertically Stacked Pending Items List with horizontal dividers */}
                        <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700/60 pt-1 border-t border-restro-border-green/60 max-h-48 overflow-y-auto no-scrollbar">
                          {order.items
                            .filter((item) => item.status !== "completed" && item.status !== "delivered")
                            .map((item, idx) => {
                              const isPrep = item.status === "preparing";

                              return (
                                <div key={idx} className="py-1.5 flex items-center justify-between text-xs font-semibold">
                                  <div className="flex items-center gap-2 truncate pr-2">
                                    {isPrep ? (
                                      <IconClock size={15} stroke={iconStroke} className="text-restro-text shrink-0 animate-pulse" />
                                    ) : (
                                      <span className="w-3.5 shrink-0"></span>
                                    )}
                                    <span className="truncate text-gray-800 dark:text-gray-200">
                                      {item.item_title} {item.variant_title && `(${item.variant_title})`} x {item.quantity}
                                    </span>
                                  </div>
                                  <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                                    isPrep
                                      ? "bg-restro-gray text-restro-text border border-restro-border-green"
                                      : "text-restro-text"
                                  }`}>
                                    {isPrep ? "Cooking" : "Queued"}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* LeetCode Style Draggable Divider Handle */}
          {layoutMode === "vertical" ? (
            <div
              onMouseDown={handleMouseDown}
              onTouchStart={() => { isDraggingRef.current = true; }}
              onDoubleClick={resetSplitRatio}
              title="Drag left/right to resize panels | Double-click to reset 50/50"
              className="w-3 hover:w-4 bg-transparent hover:bg-restro-green/20 dark:hover:bg-restro-green-10 flex items-center justify-center cursor-col-resize group transition-all shrink-0 select-none h-full py-4 z-20"
            >
              <div className="w-1.5 h-14 rounded-full bg-restro-border-green group-hover:bg-restro-green transition-colors flex flex-col items-center justify-center gap-1 shadow-xs">
                <div className="w-0.5 h-0.5 rounded-full bg-white dark:bg-gray-900"></div>
                <div className="w-0.5 h-0.5 rounded-full bg-white dark:bg-gray-900"></div>
                <div className="w-0.5 h-0.5 rounded-full bg-white dark:bg-gray-900"></div>
              </div>
            </div>
          ) : (
            <div
              onMouseDown={handleMouseDown}
              onTouchStart={() => { isDraggingRef.current = true; }}
              onDoubleClick={resetSplitRatio}
              title="Drag up/down to resize panels | Double-click to reset 50/50"
              className="h-3 hover:h-4 bg-transparent hover:bg-restro-green/20 dark:hover:bg-restro-green-10 flex items-center justify-center cursor-row-resize group transition-all shrink-0 select-none w-full px-4 z-20"
            >
              <div className="h-1.5 w-14 rounded-full bg-restro-border-green group-hover:bg-restro-green transition-colors flex items-center justify-center gap-1 shadow-xs">
                <div className="w-0.5 h-0.5 rounded-full bg-white dark:bg-gray-900"></div>
                <div className="w-0.5 h-0.5 rounded-full bg-white dark:bg-gray-900"></div>
                <div className="w-0.5 h-0.5 rounded-full bg-white dark:bg-gray-900"></div>
              </div>
            </div>
          )}

          {/* Ready for Pickup Swimlane Panel */}
          <section
            style={
              layoutMode === "vertical"
                ? { width: `calc(${100 - splitRatioVert}% - 6px)`, height: "100%" }
                : { height: `calc(${100 - splitRatioHoriz}% - 6px)`, width: "100%" }
            }
            className="flex flex-col rounded-2xl border border-restro-border-green bg-white dark:bg-[#121212] p-3 overflow-hidden shadow-xs shrink-0 max-h-full"
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between pb-2 border-b border-restro-border-green mb-2 shrink-0">
              <h2 className="text-sm font-extrabold text-restro-green tracking-wide uppercase">
                Ready for Pickup
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-restro-green-light dark:bg-restro-green-10 border border-restro-border-green text-restro-green text-xs font-bold">
                {readyOrders.length} {readyOrders.length === 1 ? "Order" : "Orders"}
              </span>
            </div>

            {/* Inner Scrollable Cards Container */}
            <div ref={readyScrollRef} className="overflow-y-auto no-scrollbar flex-1 pr-1 min-h-0">
              {readyOrders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 min-h-[140px]">
                  <div className="w-12 h-12 rounded-full bg-restro-gray dark:bg-restro-gray/60 border border-restro-border-green flex items-center justify-center mb-2 text-restro-text">
                    <IconSparkles size={26} stroke={iconStroke} />
                  </div>
                  <p className="text-restro-text font-bold text-sm">No orders ready yet</p>
                  <p className="text-xs text-restro-text mt-0.5">Orders will pop up here when kitchen completes them</p>
                </div>
              ) : (
                <div
                  className="grid gap-2.5 items-start transition-all duration-200 ease-in-out"
                  style={{
                    gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, 270px), 1fr))`,
                  }}
                >
                  {readyOrders.map((order) => {
                    const readyItems = order.items.filter(
                      (i) => i.status === "completed" || i.status === "delivered"
                    );
                    const isFullyReady = readyItems.length === order.items.length;

                    return (
                      <div
                        key={order.id}
                        className="rounded-2xl border border-restro-border-green bg-restro-green-light/40 dark:bg-[#181818] p-3 shadow-sm flex flex-col justify-start space-y-2 transition-all duration-200 ease-in-out transform hover:-translate-y-0.5 hover:shadow-md h-full"
                      >
                        {/* Single Horizontal Header Row */}
                        <div className="flex items-center justify-between pb-1">
                          <div className="w-9 h-9 rounded-full bg-restro-green text-white flex items-center justify-center font-bold text-sm shadow-sm border border-emerald-400 shrink-0">
                            {order.token_no}
                          </div>
                          <div className="flex items-center gap-2">
                            {isFullyReady ? (
                              <span className="text-[10px] font-bold text-restro-green-dark bg-restro-green-light border border-restro-border-green px-2 py-0.5 rounded-full flex items-center gap-1">
                                <IconCheck size={12} stroke={iconStroke} /> Complete & Ready
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-restro-green-dark bg-restro-green-light border border-restro-border-green px-2 py-0.5 rounded-full flex items-center gap-1">
                                <IconCheck size={12} stroke={iconStroke} /> Items Ready ({readyItems.length}/{order.items.length})
                              </span>
                            )}
                            <span className="text-xs text-restro-text font-bold">
                              {new Date(order.date).toLocaleTimeString("en-US", { timeStyle: "short" })}
                            </span>
                          </div>
                        </div>

                        {/* Vertically Stacked Ready Items List with horizontal dividers */}
                        <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700/60 pt-1 border-t border-restro-border-green/60 max-h-48 overflow-y-auto no-scrollbar">
                          {readyItems.map((item, idx) => (
                            <div key={idx} className="py-1.5 flex items-center justify-between text-xs font-semibold">
                              <div className="flex items-center gap-2 truncate pr-2">
                                <IconChecks size={15} stroke={iconStroke} className="text-restro-green shrink-0" />
                                <span className="truncate text-gray-900 dark:text-gray-100 font-bold">
                                  {item.item_title} {item.variant_title && `(${item.variant_title})`} x {item.quantity}
                                </span>
                              </div>
                              <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-restro-green-light text-restro-green-dark">
                                Ready
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
