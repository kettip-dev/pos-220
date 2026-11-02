import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Page from "../components/Page";
import { SelectBusinessEmptyState } from "../components/RequiresSingleBusiness";
import { isBusinessRequiredError } from "../helpers/BusinessScope";
import {
  cancelKitchenOrder,
  completeKitchenOrder,
  getCompleteOrderPaymentSummary,
  getInvoiceIdFromOrderId,
  getOrders,
  getOrdersInit,
  payAndCompleteKitchenOrder,
  updateKitchenOrderItemStatus,
} from "../controllers/orders.controller";
import { toast } from "react-hot-toast";
import {
  IconArmchair,
  IconBoxSeam,
  IconCash,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconDeviceTv,
  IconExternalLink,
  IconGridDots,
  IconHash,
  IconLayoutGrid,
  IconListDetails,
  IconReceipt,
  IconRefresh,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconStars,
  IconTicket,
  IconToolsKitchen2,
  IconX,
} from "@tabler/icons-react";
import { formatElapsedOrderTime, parseOrderDate } from "../helpers/DateHelper";
import { iconStroke } from "../config/config";
import { CURRENCIES } from "../config/currencies.config";
import { triggerPrintReceipt } from "../helpers/ReceiptHelper";
import { SocketContext } from "../contexts/SocketContext";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import QRCode from "qrcode";
import { getQRMenuLink } from "../helpers/QRMenuHelper";
import { useTheme } from "../contexts/ThemeContext";
import clsx from "clsx";

// Redesigned Tablet-Native Subcomponents
import OrderCard, {
  WAIT_LATE_MINS,
  WAIT_WARN_MINS,
  formatMoney,
  getEarliestOrderDate,
  getElapsedMinutes,
} from "../components/orders/OrderCard";
import OrderDetailsDrawer from "../components/orders/OrderDetailsDrawer";
import POSPaymentDrawer from "../components/pos/POSPaymentDrawer";
import POSSplitBillDrawer from "../components/pos/POSSplitBillDrawer";

export default function OrdersPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const orderDisplayMenuRef = useRef(null);
  const user = getUserDetailsInLocalStorage();
  const { socket, isSocketConnected } = useContext(SocketContext);

  // Filter & View States
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("table"); // "table" (Group by Table) | "ticket" (Individual Tickets)
  const [density, setDensity] = useState(() => {
    try {
      return localStorage.getItem("restro_orders_density") || "compact";
    } catch {
      return "compact";
    }
  });

  const handleDensityChange = (nextDensity) => {
    setDensity(nextDensity);
    try {
      localStorage.setItem("restro_orders_density", nextDensity);
    } catch (e) {
      console.warn("Could not save orders density to localStorage", e);
    }
  };
  const [showOrderDisplayMenu, setShowOrderDisplayMenu] = useState(false);
  const [sortOrder, setSortOrder] = useState("oldest"); // "oldest" | "newest"

  // Re-render every 30s so elapsed timers on cards and KPIs stay live
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Slide-over Drawer for deep order inspection
  const [selectedOrderGroup, setSelectedOrderGroup] = useState(null);

  // Main Page State
  const [state, setState] = useState({
    kitchenOrders: [],
    printSettings: null,
    storeSettings: null,
    paymentTypes: [],
    isLoading: true,
    requiresSingleBusiness: false,
    currency: "$",

    cancelOrderIds: [],
    completeOrderIds: [],

    feedbackInvoiceId: null,
    feedbackCustomerId: null,
    feedbackQRCode: null,
  });

  // Unified POS Payment Drawer State (Consistent with POS & Tables)
  const [paymentDrawerState, setPaymentDrawerState] = useState({
    isOpen: false,
    orderIds: [],
    orderGroup: null,
    summaryOrders: [],
    cartItems: [],
    subtotal: 0,
    taxTotal: 0,
    serviceCharge: 0,
    discountType: "fixed",
    discountValue: 0,
    discountTotal: 0,
    totalPayable: 0,
    selectedPaymentType: null,
    tenderedAmount: "",
    customExchangeRate: null,
    isSubmitting: false,
  });

  const [splitDrawerState, setSplitDrawerState] = useState({
    isOpen: false,
    order: null,
  });

  const handleOpenSplitDrawer = (orderGroup) => {
    if (!orderGroup || !orderGroup.order_ids || orderGroup.order_ids.length === 0) return;
    const primaryOrderId = orderGroup.order_ids[0];

    const allItems = [];
    (orderGroup.orders || []).forEach((o) => {
      (o.items || []).forEach((it) => {
        allItems.push({
          id: it.id,
          order_id: it.order_id,
          item_title: it.item_title,
          variant_title: it.variant_title,
          price: Number(it.price || 0),
          quantity: Number(it.quantity || 1),
        });
      });
    });

    const calculatedSubtotal = allItems.reduce(
      (sum, it) => sum + Number(it.price) * Number(it.quantity),
      0
    );

    setSplitDrawerState({
      isOpen: true,
      order: {
        id: primaryOrderId,
        order_ids: orderGroup.order_ids,
        table_title: orderGroup.table_title,
        token_no: orderGroup.orders?.map((o) => o.token_no).join(", "),
        subtotal: calculatedSubtotal,
        total: calculatedSubtotal,
        tax_total: 0,
        service_charge_total: 0,
        items: allItems,
      },
    });
  };

  const handlePrintSubReceipt = (sub, order) => {
    const formattedItems = (sub.items || []).map((it) => ({
      title: it.item_title,
      variant: it.variant_title ? { title: it.variant_title } : null,
      price: it.price,
      quantity: it.quantity,
    }));

    triggerPrintReceipt({
      order_id: `${order?.token_no || order?.id} (${sub.seat_label})`,
      order_title: `${order?.table_title ? order.table_title + " - " : ""}${sub.seat_label}`,
      token_no: sub.sub_invoice_number,
      customer_type: "dinein",
      customer_name: sub.seat_label,
      items: formattedItems,
      sub_total: sub.subtotal,
      tax_total: sub.tax_total,
      service_charge_total: sub.service_charge_total,
      discount_total: sub.discount_total,
      total: sub.payable_total,
      tip_amount: sub.tip_amount,
      payment_type: sub.payment_type_title || "Cash",
      date: sub.paid_at || new Date().toISOString(),
      printSettings: state.printSettings,
      storeSettings: state.storeSettings,
    });
  };

  // Close Order Display dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        orderDisplayMenuRef.current &&
        !orderDisplayMenuRef.current.contains(e.target)
      ) {
        setShowOrderDisplayMenu(false);
      }
    };
    if (showOrderDisplayMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showOrderDisplayMenu]);

  useEffect(() => {
    _init();
    _initSocket();

    return () => {
      if (socket) {
        socket.off("new_order");
        socket.off("order_update");
      }
    };
  }, []);

  const {
    kitchenOrders,
    printSettings,
    storeSettings,
    paymentTypes,
    isLoading,
    currency,
  } = state;

  const _init = async () => {
    try {
      const [ordersResponse, ordersInitResponse] = await Promise.all([
        getOrders(),
        getOrdersInit(),
      ]);

      if (ordersResponse.status === 200 && ordersInitResponse.status === 200) {
        const orders = ordersResponse?.data || [];
        const ordersInit = ordersInitResponse.data;

        const currencyObj = CURRENCIES.find(
          (c) => c.cc === ordersInit?.storeSettings?.currency
        );
        const resolvedCurrency = currencyObj?.symbol || ordersInit?.storeSettings?.currency || "$";

        setState((prev) => ({
          ...prev,
          kitchenOrders: orders,
          printSettings: ordersInit.printSettings,
          storeSettings: ordersInit.storeSettings,
          paymentTypes: ordersInit.paymentTypes || [],
          currency: resolvedCurrency,
          isLoading: false,
          requiresSingleBusiness: false,
        }));
      }
    } catch (error) {
      if (isBusinessRequiredError(error)) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          requiresSingleBusiness: true,
        }));
        return;
      }
      toast.dismiss();
      toast.error(t("orders.error_loading_orders"));
      setState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  };

  const _initSocket = () => {
    const audio = new Audio("/new_order_sound.mp3");
    if (isSocketConnected && socket) {
      socket.emit("authenticate", user.tenant_id);
      socket.on("new_order", (payload) => {
        audio.play().catch(() => {});
        refreshOrders();
      });
      socket.on("order_update", () => {
        refreshOrders();
      });
    }
  };

  const sendOrderUpdateEvent = () => {
    if (isSocketConnected && socket) {
      socket.emit("order_update", user.tenant_id);
    }
  };

  const refreshOrders = async () => {
    try {
      const res = await getOrders();
      if (res.status === 200) {
        setState((prev) => ({
          ...prev,
          kitchenOrders: res.data || [],
        }));
      }
    } catch (error) {
      console.error("Refresh orders error:", error);
    }
  };

  // ── Compute High-Level Metrics for Stat Ribbon ──
  const summaryMetrics = useMemo(() => {
    let openOrdersCount = 0;
    let dineInCount = 0;
    let takeawayCount = 0;
    let deliveryCount = 0;
    let unpaidCount = 0;
    let unpaidTotal = 0;
    let paidCount = 0;
    let paidTotal = 0;
    let oldestDate = null;
    let oldestLabel = "";

    (kitchenOrders || []).forEach((group) => {
      (group.orders || []).forEach((ord) => {
        openOrdersCount += 1;
        const parsed = parseOrderDate(ord.date);
        if (parsed && (!oldestDate || parsed < parseOrderDate(oldestDate))) {
          oldestDate = ord.date;
          oldestLabel = `${group.table_title || ord.delivery_type || ""} #${ord.token_no}`.trim();
        }
        const type = String(
          ord.delivery_type || (group.table_id ? "dinein" : "takeaway")
        ).toLowerCase();
        if (type.includes("dine")) dineInCount += 1;
        else if (type.includes("deliv")) deliveryCount += 1;
        else takeawayCount += 1;

        // Calculate order value
        let ordAmount = 0;
        (ord.items || []).forEach((i) => {
          const qty = Number(i.quantity) || 1;
          const p = Number(i.price) || 0;
          const add = (i.addons || []).reduce(
            (sum, a) => sum + (Number(a.price) || 0),
            0
          );
          ordAmount += (p + add) * qty;
        });

        if (ord.payment_status === "paid") {
          paidCount += 1;
          paidTotal += ordAmount;
        } else {
          unpaidCount += 1;
          unpaidTotal += ordAmount;
        }
      });
    });

    return {
      openOrdersCount,
      dineInCount,
      takeawayCount,
      deliveryCount,
      unpaidCount,
      unpaidTotal,
      paidCount,
      paidTotal,
      oldestElapsed: oldestDate ? formatElapsedOrderTime(oldestDate) : null,
      oldestMins: oldestDate ? getElapsedMinutes(oldestDate) : 0,
      oldestLabel,
    };
  }, [kitchenOrders, nowTick]);

  // Filter Tabs Definition
  const filterTabs = [
    {
      key: "all",
      label: t("orders.filter_all", "All"),
      count: summaryMetrics.openOrdersCount,
    },
    {
      key: "dinein",
      label: t("orders.filter_dinein", "Dine-In"),
      count: summaryMetrics.dineInCount,
    },
    {
      key: "takeaway",
      label: t("orders.filter_takeaway", "Takeaway & Delivery"),
      count: summaryMetrics.takeawayCount + summaryMetrics.deliveryCount,
    },
    {
      key: "unpaid",
      label: t("orders.filter_unpaid", "Unpaid"),
      count: summaryMetrics.unpaidCount,
    },
    {
      key: "paid",
      label: t("orders.filter_paid", "Paid"),
      count: summaryMetrics.paidCount,
    },
  ];

  // ── Derived Order Cards Based on View Mode & Active Filters ──
  const filteredOrders = useMemo(() => {
    let list = [];

    if (viewMode === "ticket") {
      // Flatten into individual order ticket cards
      (kitchenOrders || []).forEach((group) => {
        (group.orders || []).forEach((ord) => {
          list.push({
            table_id: group.table_id,
            table_title: group.table_title,
            floor: group.floor,
            orders: [ord],
            order_ids: [ord.id],
          });
        });
      });
    } else {
      // Group by table
      list = [...(kitchenOrders || [])];
    }

    // Filter by Active Tab
    if (activeFilter === "dinein") {
      list = list.filter(
        (g) =>
          g.table_id != null ||
          g.orders.some((o) =>
            String(o.delivery_type || "").toLowerCase().includes("dine")
          )
      );
    } else if (activeFilter === "takeaway") {
      list = list.filter((g) =>
        g.orders.some((o) => {
          const dt = String(o.delivery_type || "").toLowerCase();
          return dt.includes("take") || dt.includes("deliv");
        })
      );
    } else if (activeFilter === "unpaid") {
      list = list.filter((g) =>
        g.orders.some((o) => o.payment_status !== "paid")
      );
    } else if (activeFilter === "paid") {
      list = list.filter((g) =>
        g.orders.every((o) => o.payment_status === "paid")
      );
    }

    // Filter by Search Query (Order #, Table, Customer, Items)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((g) => {
        const matchTable = g.table_title?.toLowerCase().includes(q);
        const matchFloor = g.floor?.toLowerCase().includes(q);
        const matchTokens = g.orders.some((o) =>
          String(o.token_no).includes(q)
        );
        const matchCustomer = g.orders.some((o) =>
          o.customer_name?.toLowerCase().includes(q)
        );
        const matchItems = g.orders.some((o) =>
          (o.items || []).some((i) =>
            i.item_title?.toLowerCase().includes(q)
          )
        );
        return (
          matchTable || matchFloor || matchTokens || matchCustomer || matchItems
        );
      });
    }

    // Sort by earliest order time in each card (FIFO by default)
    const toTime = (g) => parseOrderDate(getEarliestOrderDate(g.orders))?.getTime() ?? 0;
    list.sort((a, b) =>
      sortOrder === "oldest" ? toTime(a) - toTime(b) : toTime(b) - toTime(a)
    );

    return list;
  }, [kitchenOrders, viewMode, activeFilter, searchQuery, sortOrder]);

  // ── Item Status Tap Handler (Optimistic Local + Server) ──
  const handleDirectItemStatusChange = async (orderItemId, newStatus) => {
    try {
      // Optimistically update local state in kitchenOrders
      setState((prev) => {
        const updated = prev.kitchenOrders.map((group) => ({
          ...group,
          orders: group.orders.map((ord) => ({
            ...ord,
            items: (ord.items || []).map((item) =>
              item.id === orderItemId ? { ...item, status: newStatus } : item
            ),
          })),
        }));
        return { ...prev, kitchenOrders: updated };
      });

      // Also update selectedOrderGroup if drawer is open
      setSelectedOrderGroup((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          orders: prev.orders.map((ord) => ({
            ...ord,
            items: (ord.items || []).map((item) =>
              item.id === orderItemId ? { ...item, status: newStatus } : item
            ),
          })),
        };
      });

      const res = await updateKitchenOrderItemStatus(orderItemId, newStatus);
      if (res.status === 200) {
        sendOrderUpdateEvent();
        toast.success(t("orders.order_item_status_success", "Item status updated!"));
      }
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || t("orders.error_processing_request"));
      refreshOrders();
    }
  };

  // ── Payment Settlement Flow (POSPaymentDrawer) ──
  const handleOpenPayDrawer = async (orderIds, orderGroup) => {
    try {
      toast.loading(t("orders.loading_message"));
      const res = await getCompleteOrderPaymentSummary(orderIds);
      toast.dismiss();

      if (res.status === 200) {
        const {
          subtotal = 0,
          taxTotal = 0,
          serviceChargeTotal = 0,
          discountType = "fixed",
          discountValue = 0,
          discountTotal = 0,
          total = 0,
          orders = [],
        } = res.data;

        const firstPaymentId = paymentTypes?.[0]?.id || null;

        // Flatten cart items for drawer breakdown
        const cartItemsList = [];
        (orders || []).forEach((ord) => {
          (ord.items || []).forEach((item) => {
            cartItemsList.push({
              title: item.item_title || item.title,
              quantity: item.quantity,
              price: item.price,
              addons: item.addons,
            });
          });
        });

        // Exchange rate from storeSettings
        const storeRate =
          storeSettings?.exchange_rate_usd_to_khr ||
          storeSettings?.exchangeRateUsdToKhr ||
          4100;

        const firstOrder = orders[0] || {};
        const customerGroupId = firstOrder.customer_group_id || orderGroup?.customer_group_id || null;
        const customerGroupName = firstOrder.customer_group_name || orderGroup?.customer_group_name || null;
        const customerGroupDiscountTotal = Number(firstOrder.customer_group_discount_total || orderGroup?.customer_group_discount_total || 0);

        setPaymentDrawerState({
          isOpen: true,
          orderIds,
          orderGroup,
          summaryOrders: orders,
          cartItems: cartItemsList,
          subtotal: Number(subtotal),
          taxTotal: Number(taxTotal),
          serviceCharge: Number(serviceChargeTotal),
          discountType: discountType || "fixed",
          discountValue: Number(discountValue) || 0,
          discountTotal: Number(discountTotal) || 0,
          customerGroupId,
          customerGroupName,
          customerGroupDiscountTotal,
          totalPayable: Number(total),
          selectedPaymentType: firstPaymentId,
          tenderedAmount: "",
          customExchangeRate: storeRate,
          isSubmitting: false,
        });
      }
    } catch (error) {
      toast.dismiss();
      console.error(error);
      toast.error(error?.response?.data?.message || t("orders.error_processing_request"));
    }
  };

  const handlePaymentDrawerDiscountChange = (type, val) => {
    const numVal = parseFloat(val) || 0;
    const netTotal = paymentDrawerState.subtotal || 0;
    let discountTotal = 0;
    if (type === "percentage") {
      discountTotal = (netTotal * Math.min(100, Math.max(0, numVal))) / 100;
    } else {
      discountTotal = Math.min(netTotal, Math.max(0, numVal));
    }
    const tax = paymentDrawerState.taxTotal || 0;
    const service = paymentDrawerState.serviceCharge || 0;
    const payable = Math.max(0, netTotal - discountTotal + tax + service);

    setPaymentDrawerState((prev) => ({
      ...prev,
      discountType: type,
      discountValue: numVal,
      discountTotal,
      totalPayable: payable,
    }));
  };

  const handleConfirmPayAndComplete = async (tenderData) => {
    const {
      orderIds,
      selectedPaymentType,
      subtotal,
      taxTotal,
      serviceCharge,
      totalPayable,
      discountType,
      discountValue,
      discountTotal,
      summaryOrders,
      orderGroup,
    } = paymentDrawerState;

    if (!selectedPaymentType) {
      toast.error(t("orders.select_payment_method", "Please select a payment method"));
      return;
    }

    try {
      setPaymentDrawerState((prev) => ({ ...prev, isSubmitting: true }));
      const loyaltyPointsRedeemed = tenderData?.loyaltyPointsRedeemed || 0;
      const res = await payAndCompleteKitchenOrder(
        orderIds,
        subtotal,
        taxTotal,
        serviceCharge,
        totalPayable,
        selectedPaymentType,
        discountType,
        discountValue,
        discountTotal,
        null,
        0,
        loyaltyPointsRedeemed,
        orderGroup?.customer_id || orderGroup?.orders?.[0]?.customer_id || null,
        paymentDrawerState.customerGroupId,
        paymentDrawerState.customerGroupName,
        paymentDrawerState.customerGroupDiscountTotal
      );

      if (res.status === 200) {
        toast.success(
          res.data?.message || t("orders.order_completed_successfully", "Bill settled and order completed!")
        );

        // Automatic Thermal / Browser Receipt Printing
        try {
          const formattedItems = [];
          (summaryOrders || []).forEach((ord) => {
            (ord.items || []).forEach((item) => {
              formattedItems.push({
                title: item.title || item.item_title,
                quantity: item.quantity,
                price: item.price,
                variant:
                  item.variant ||
                  (item.variant_id
                    ? {
                        id: item.variant_id,
                        title: item.variant_title,
                        price: item.variant_price,
                      }
                    : null),
                addons: item.addons,
                notes: item.notes,
              });
            });
          });

          triggerPrintReceipt({
            cartItems: formattedItems,
            deliveryType:
              orderGroup?.orders?.[0]?.delivery_type ||
              (orderGroup?.table_id ? "dinein" : "takeaway"),
            customerType: orderGroup?.orders?.[0]?.customer_type || "WALKIN",
            customer: {
              name: orderGroup?.orders?.[0]?.customer_name || "Walk-in Guest",
              id: orderGroup?.orders?.[0]?.customer_id,
            },
            table: orderGroup?.table_id
              ? {
                  table_id: orderGroup.table_id,
                  table_title: orderGroup.table_title,
                  floor: orderGroup.floor,
                }
              : null,
            tableId: orderGroup?.table_id,
            printSettings,
            storeSettings,
            itemsTotal: subtotal,
            taxTotal,
            serviceChargeTotal: serviceCharge,
            payableTotal: totalPayable,
            currency,
            discountType,
            discountValue,
            discountAmount: discountTotal || 0,
            customer_group_id: paymentDrawerState.customerGroupId,
            customer_group_name: paymentDrawerState.customerGroupName,
            customer_group_discount: paymentDrawerState.customerGroupDiscountTotal,
            loyaltyPointsRedeemed: tenderData?.loyaltyPointsRedeemed || 0,
            loyaltyDiscountAmount: tenderData?.loyaltyDiscountAmount || 0,
            loyaltyPointsEarned: tenderData?.loyaltyPointsEarned || 0,
            paymentType:
              paymentTypes.find((p) => p.id === selectedPaymentType)?.title || "Cash",
            tenderedAmount:
              tenderData?.totalReceivedUSD ??
              (parseFloat(paymentDrawerState.tenderedAmount) || totalPayable),
            changeDue:
              tenderData?.changeTotalUSD ??
              Math.max(0, (parseFloat(paymentDrawerState.tenderedAmount) || 0) - totalPayable),
            invoiceNo: res?.data?.invoiceNo || res?.data?.invoiceId,
            orderIds: orderIds.join(", "),
            tokenNo: orderGroup?.orders?.map((o) => o.token_no)?.join(", ") || "",
          });
        } catch (printErr) {
          console.warn("Print receipt error:", printErr);
        }

        setPaymentDrawerState((prev) => ({
          ...prev,
          isOpen: false,
          isSubmitting: false,
        }));
        setSelectedOrderGroup(null);
        await refreshOrders();
        sendOrderUpdateEvent();
      }
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || t("orders.error_processing_request"));
      setPaymentDrawerState((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // ── Modal Actions: Complete Order, Cancel Order, Print, Feedback ──
  const btnShowCompleteOrderModal = (orderIds) => {
    setState((prev) => ({ ...prev, completeOrderIds: orderIds }));
    document.getElementById("modal-order-complete").showModal();
  };

  const btnCompleteOrder = async () => {
    try {
      toast.loading(t("orders.loading_message"));
      const res = await completeKitchenOrder(state.completeOrderIds);
      toast.dismiss();

      if (res.status === 200) {
        toast.success(res.data.message);
        sendOrderUpdateEvent();
        setSelectedOrderGroup(null);
        refreshOrders();
      }
    } catch (error) {
      toast.dismiss();
      console.error(error);
      toast.error(error?.response?.data?.message || t("orders.error_processing_request"));
    }
  };

  const btnShowCancelOrderModal = (orderIds) => {
    setState((prev) => ({ ...prev, cancelOrderIds: orderIds }));
    document.getElementById("modal-order-cancel").showModal();
  };

  const btnCancelOrder = async () => {
    try {
      toast.loading(t("orders.loading_message"));
      const res = await cancelKitchenOrder(state.cancelOrderIds);
      toast.dismiss();

      if (res.status === 200) {
        toast.success(res.data.message);
        sendOrderUpdateEvent();
        setSelectedOrderGroup(null);
        refreshOrders();
      }
    } catch (error) {
      toast.dismiss();
      console.error(error);
      toast.error(error?.response?.data?.message || t("orders.error_processing_request"));
    }
  };

  const btnPrintReceipt = async (orderIdsArr, tokens, tableId = null) => {
    try {
      toast.loading(t("orders.loading_message"));
      const res = await getCompleteOrderPaymentSummary(orderIdsArr);
      toast.dismiss();

      if (res.status === 200) {
        const {
          subtotal,
          taxTotal,
          serviceChargeTotal,
          discountType,
          discountValue,
          discountTotal,
          total,
          orders: ordersArr,
        } = res.data;

        const formattedOrders = [];
        const orderIds = orderIdsArr.join(", ");

        for (const o of ordersArr || []) {
          (o.items || []).forEach((i) => {
            const variant = i.variant_id
              ? { id: i.variant_id, title: i.variant_title, price: i.variant_price }
              : null;
            formattedOrders.push({
              ...i,
              title: i.item_title,
              addons_ids: i?.addons?.length > 0 ? i?.addons?.map((a) => a.id) : [],
              variant,
            });
          });
        }

        const firstOrder = ordersArr?.[0] || {};
        const { customer_id, customer_type, customer_name, delivery_type } = firstOrder;

        triggerPrintReceipt({
          cartItems: formattedOrders,
          deliveryType: delivery_type || "dinein",
          customerType: customer_type || "WALKIN",
          customer: { id: customer_id, name: customer_name },
          tableId,
          currency,
          storeSettings,
          printSettings,
          itemsTotal: subtotal,
          discountType,
          discountValue,
          discountAmount: discountTotal || 0,
          customer_group_id: firstOrder.customer_group_id || null,
          customer_group_name: firstOrder.customer_group_name || null,
          customer_group_discount: Number(firstOrder.customer_group_discount_total || 0),
          taxTotal,
          serviceChargeTotal,
          payableTotal: total,
          tokenNo: tokens,
          orderId: orderIds,
        });
      }
    } catch (error) {
      toast.dismiss();
      console.error(error);
      toast.error(error?.response?.data?.message || t("orders.error_processing_request"));
    }
  };

  const btnCollectFeedback = async (orderIdsArr) => {
    try {
      toast.loading(t("orders.loading_message"));
      const res = await getInvoiceIdFromOrderId(orderIdsArr);
      toast.dismiss();

      if (res.status === 200) {
        const { invoiceId, customerId } = res.data;

        if (!invoiceId) {
          toast.error(t("orders.please_finish_order_for_feedback_message"));
          return;
        }

        const link =
          getQRMenuLink(storeSettings?.unique_qr_code) +
          `/feedback?_ref=${invoiceId}${customerId ? `&_cref=${customerId}` : ""}`;

        const qrDataURL = await QRCode.toDataURL(link, { width: 1080 });

        setState((prev) => ({
          ...prev,
          feedbackInvoiceId: invoiceId,
          feedbackCustomerId: customerId,
          feedbackQRCode: qrDataURL,
        }));

        document.getElementById("modal-collect-feedback").showModal();
      }
    } catch (error) {
      toast.dismiss();
      console.error(error);
      toast.error(error?.response?.data?.message || t("orders.error_processing_request"));
    }
  };

  const btnOpenFeedbackLink = () => {
    const link =
      getQRMenuLink(storeSettings?.unique_qr_code) +
      `/feedback?_ref=${state.feedbackInvoiceId}${
        state.feedbackCustomerId ? `&_cref=${state.feedbackCustomerId}` : ""
      }`;
    window.open(link, "_blank");
  };

  if (state.requiresSingleBusiness) {
    return (
      <Page>
        <SelectBusinessEmptyState />
      </Page>
    );
  }

  return (
    <Page>
      {/* ── Header: Title, live sync, display menu & refresh ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#2CA01C] text-white flex items-center justify-center shrink-0 shadow-sm">
            <IconReceipt size={22} stroke={iconStroke} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                {t("orders.title")}
              </h1>
              <span
                className={clsx(
                  "inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11px] font-bold select-none",
                  isSocketConnected
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                    : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
                )}
                title={isSocketConnected ? t("orders.socket_connected", "Live Socket Sync Active") : t("orders.socket_connecting", "Connecting...")}
              >
                <span className="relative flex h-2 w-2">
                  {isSocketConnected && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span
                    className={clsx(
                      "relative inline-flex rounded-full h-2 w-2",
                      isSocketConnected ? "bg-emerald-500" : "bg-slate-300 dark:bg-zinc-600"
                    )}
                  />
                </span>
                {isSocketConnected ? t("orders.live", "Live") : t("orders.offline", "Offline")}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
              {t("orders.subtitle")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Order Display Dropdown */}
          <div ref={orderDisplayMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setShowOrderDisplayMenu((prev) => !prev)}
              className="h-[42px] flex items-center gap-2 rounded-xl transition-all active:scale-95 px-3.5 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 font-bold text-sm cursor-pointer"
            >
              <IconDeviceTv size={18} stroke={iconStroke} className="text-[#2CA01C]" />
              <span>{t("orders.order_display")}</span>
              <IconChevronDown
                size={15}
                stroke={iconStroke}
                className={clsx("transition-transform duration-200 text-slate-400", showOrderDisplayMenu && "rotate-180")}
              />
            </button>

            {showOrderDisplayMenu && (
              <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-72 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-1.5 flex flex-col gap-1">
                {[
                  {
                    mode: "detailed",
                    icon: IconListDetails,
                    title: t("orders.detailed_view", "Detailed View"),
                    desc: t("orders.detailed_view_desc", "Shows items & prep progress"),
                  },
                  {
                    mode: "token",
                    icon: IconHash,
                    title: t("orders.token_display_mode", "Token Display Mode"),
                    desc: t("orders.token_display_mode_desc", "Minimal TV view with tokens only"),
                  },
                ].map(({ mode, icon: ModeIcon, title, desc }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setShowOrderDisplayMenu(false);
                      if (!storeSettings?.unique_qr_code) {
                        toast.error("Store QR code not found!");
                        return;
                      }
                      window.open(
                        `/order-status/${storeSettings.unique_qr_code}?mode=${mode}`,
                        "_blank"
                      );
                    }}
                    className="min-h-[52px] flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all text-left cursor-pointer active:scale-[0.98]"
                  >
                    <span className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-[#2CA01C] flex items-center justify-center shrink-0">
                      <ModeIcon size={18} stroke={iconStroke} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-900 dark:text-white">{title}</span>
                      <span className="block text-xs text-slate-500 dark:text-zinc-400">{desc}</span>
                    </span>
                    <IconExternalLink size={15} stroke={iconStroke} className="text-slate-300 dark:text-zinc-600 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={refreshOrders}
            disabled={state.isLoading}
            title={t("orders.refresh", "Refresh")}
            className="h-[42px] w-[42px] flex items-center justify-center rounded-xl text-slate-600 dark:text-zinc-300 transition-all active:scale-95 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 cursor-pointer disabled:opacity-60"
          >
            <IconRefresh
              size={18}
              stroke={iconStroke}
              className={clsx(state.isLoading && "animate-spin text-[#2CA01C]")}
            />
          </button>
        </div>
      </div>

      {/* ── KPI tiles (tap to filter) ── */}
      {kitchenOrders?.length > 0 && (
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {[
            {
              key: "all",
              label: t("orders.active_orders_metric", "Active Orders"),
              value: summaryMetrics.openOrdersCount,
              hint: `${summaryMetrics.dineInCount} ${t("orders.filter_dinein", "Dine-In")} · ${summaryMetrics.takeawayCount + summaryMetrics.deliveryCount} ${t("pos.takeaway", "Takeaway")}`,
              icon: IconReceipt,
              tone: "slate",
            },
            {
              key: "unpaid",
              label: t("orders.unpaid_balance_metric", "Unpaid Balance"),
              value: `${currency}${formatMoney(summaryMetrics.unpaidTotal)}`,
              hint: `${summaryMetrics.unpaidCount} ${t("orders.filter_unpaid", "Unpaid")}`,
              icon: IconCash,
              tone: "amber",
            },
            {
              key: "paid",
              label: t("orders.paid_ready_metric", "Paid & In Kitchen"),
              value: `${currency}${formatMoney(summaryMetrics.paidTotal)}`,
              hint: `${summaryMetrics.paidCount} ${t("orders.filter_paid", "Paid")}`,
              icon: IconCheck,
              tone: "emerald",
            },
            {
              key: null,
              label: t("orders.longest_wait_metric", "Longest Wait"),
              value: summaryMetrics.oldestElapsed || "—",
              hint: summaryMetrics.oldestLabel || "",
              icon: IconClock,
              tone:
                summaryMetrics.oldestMins >= WAIT_LATE_MINS
                  ? "rose"
                  : summaryMetrics.oldestMins >= WAIT_WARN_MINS
                  ? "amber"
                  : "slate",
            },
          ].map((kpi) => {
            const KpiIcon = kpi.icon;
            const isActive = kpi.key && activeFilter === kpi.key;
            const toneCls = {
              slate: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300",
              amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
              emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
              rose: "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400",
            }[kpi.tone];
            const valueCls = {
              slate: "text-slate-900 dark:text-white",
              amber: "text-amber-700 dark:text-amber-300",
              emerald: "text-emerald-700 dark:text-emerald-300",
              rose: "text-rose-600 dark:text-rose-400",
            }[kpi.tone];

            return (
              <button
                key={kpi.label}
                type="button"
                disabled={!kpi.key}
                onClick={() => kpi.key && setActiveFilter(kpi.key)}
                className={clsx(
                  "text-left px-4 py-3 rounded-2xl border bg-white dark:bg-zinc-900 flex items-center gap-3 transition-all duration-150",
                  kpi.key ? "cursor-pointer active:scale-[0.98] hover:border-slate-300 dark:hover:border-zinc-700" : "cursor-default",
                  isActive
                    ? "border-[#2CA01C] ring-2 ring-[#2CA01C]/20"
                    : "border-slate-200 dark:border-zinc-800"
                )}
              >
                <span className={clsx("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", toneCls)}>
                  <KpiIcon size={20} stroke={iconStroke} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 truncate">
                    {kpi.label}
                  </span>
                  <span className={clsx("block text-xl font-black tabular-nums leading-tight truncate", valueCls)}>
                    {kpi.value}
                  </span>
                  {kpi.hint && (
                    <span className="block text-[11px] font-medium text-slate-400 dark:text-zinc-500 truncate">
                      {kpi.hint}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Toolbar: filter tabs · search · sort · view · density ── */}
      {kitchenOrders?.length > 0 && (
        <div className="mt-4 flex flex-col xl:flex-row xl:items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800/80 overflow-x-auto no-scrollbar touch-pan-x min-w-0">
            {filterTabs.map((tab) => {
              const isSelected = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key)}
                  className={clsx(
                    "h-[42px] flex items-center gap-2 px-3.5 rounded-lg text-sm font-bold shrink-0 whitespace-nowrap transition-all duration-150 active:scale-95 cursor-pointer",
                    isSelected
                      ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={clsx(
                      "min-w-[22px] h-[22px] px-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-black tabular-nums",
                      isSelected
                        ? "bg-[#2CA01C] text-white"
                        : "bg-slate-200/80 text-slate-500 dark:bg-zinc-700 dark:text-zinc-300"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 xl:ml-auto">
            <div className="h-[42px] flex-1 xl:w-72 xl:flex-none px-3 rounded-xl flex items-center gap-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 focus-within:border-[#2CA01C] focus-within:ring-2 focus-within:ring-[#2CA01C]/15 transition min-w-0">
              <IconSearch size={18} stroke={iconStroke} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("orders.search_placeholder")}
                className="bg-transparent text-sm text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 outline-none w-full min-w-0"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
                >
                  <IconX stroke={iconStroke} size={15} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === "oldest" ? "newest" : "oldest"))}
              title={sortOrder === "oldest" ? t("orders.sort_oldest", "Oldest first") : t("orders.sort_newest", "Newest first")}
              className="h-[42px] flex items-center gap-1.5 px-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 text-sm font-bold transition active:scale-95 cursor-pointer shrink-0"
            >
              {sortOrder === "oldest" ? (
                <IconSortAscending size={18} stroke={iconStroke} />
              ) : (
                <IconSortDescending size={18} stroke={iconStroke} />
              )}
              <span className="hidden sm:inline whitespace-nowrap">
                {sortOrder === "oldest" ? t("orders.sort_oldest", "Oldest first") : t("orders.sort_newest", "Newest first")}
              </span>
            </button>

            {[
              {
                value: viewMode,
                onChange: setViewMode,
                options: [
                  { key: "table", icon: IconArmchair, title: t("orders.group_by_table", "Group by Table") },
                  { key: "ticket", icon: IconTicket, title: t("orders.individual_tickets", "Individual Tickets") },
                ],
              },
              {
                value: density,
                onChange: handleDensityChange,
                options: [
                  { key: "normal", icon: IconLayoutGrid, title: t("orders.comfortable_view", "Normal / Comfortable View") },
                  { key: "compact", icon: IconGridDots, title: t("orders.compact_view", "Compact View") },
                ],
              },
            ].map((group, gi) => (
              <div key={gi} className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-zinc-800/80 shrink-0">
                {group.options.map(({ key, icon: OptIcon, title }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => group.onChange(key)}
                    title={title}
                    aria-pressed={group.value === key}
                    className={clsx(
                      "w-[42px] h-[40px] flex items-center justify-center rounded-lg transition active:scale-95 cursor-pointer",
                      group.value === key
                        ? "bg-white dark:bg-zinc-900 text-[#2CA01C] shadow-sm"
                        : "text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
                    )}
                  >
                    <OptIcon size={18} stroke={iconStroke} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty State: No Active Orders at all ── */}
      {kitchenOrders?.length === 0 && !isLoading && (
        <div className="mt-6 rounded-3xl border-2 border-dashed border-slate-200 dark:border-zinc-800 min-h-[50vh] flex gap-3 flex-col items-center justify-center text-center px-4 py-16">
          <div className="w-20 h-20 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1">
            <IconToolsKitchen2 size={38} stroke={iconStroke} />
          </div>
          <h3 className="font-black text-lg text-slate-800 dark:text-zinc-200 mt-2">
            {t("orders.no_orders")}
          </h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm">
            {t("orders.no_orders_subtitle")}
          </p>
        </div>
      )}

      {/* ── Empty State: Filtered out ── */}
      {kitchenOrders?.length > 0 && filteredOrders.length === 0 && (
        <div className="mt-5 rounded-3xl border-2 border-dashed border-slate-200 dark:border-zinc-800 py-16 px-4 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-400 flex items-center justify-center">
            <IconSearch size={26} stroke={iconStroke} />
          </div>
          <p className="mt-3 font-black text-lg text-slate-800 dark:text-zinc-200">
            {t("orders.no_matching_orders")}
          </p>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            {t("orders.no_matching_orders_subtitle")}
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveFilter("all");
              setSearchQuery("");
            }}
            className="mt-5 h-[42px] px-5 rounded-xl bg-[#2CA01C] hover:bg-[#248217] text-white text-sm font-bold active:scale-95 transition cursor-pointer"
          >
            {t("orders.filter_all")}
          </button>
        </div>
      )}

      {/* ── Orders Grid ── */}
      {filteredOrders?.length > 0 && (
        <div
          className={clsx(
            "mt-4 grid items-stretch",
            density === "compact"
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3"
              : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4"
          )}
        >
          {filteredOrders.map((orderGroup) => (
            <OrderCard
              key={`${viewMode}-${orderGroup.table_id ?? "x"}-${orderGroup.order_ids?.join("-")}`}
              orderGroup={orderGroup}
              currency={currency}
              viewMode={viewMode}
              density={density}
              onCardClick={(grp) => setSelectedOrderGroup(grp)}
              onPrintReceipt={btnPrintReceipt}
              onPayAndComplete={handleOpenPayDrawer}
              onCompleteOrder={btnShowCompleteOrderModal}
              onCancelOrder={btnShowCancelOrderModal}
              onCollectFeedback={btnCollectFeedback}
              onDirectItemStatusChange={handleDirectItemStatusChange}
              storeSettings={storeSettings}
            />
          ))}
        </div>
      )}

      {/* ── Slide-over Order Details Drawer ── */}
      <OrderDetailsDrawer
        isOpen={Boolean(selectedOrderGroup)}
        onClose={() => setSelectedOrderGroup(null)}
        orderGroup={selectedOrderGroup}
        currency={currency}
        paymentTypes={paymentTypes}
        storeSettings={storeSettings}
        printSettings={printSettings}
        onDirectItemStatusChange={handleDirectItemStatusChange}
        onPayAndComplete={handleOpenPayDrawer}
        onCompleteOrder={btnShowCompleteOrderModal}
        onCancelOrder={btnShowCancelOrderModal}
        onPrintReceipt={btnPrintReceipt}
        onCollectFeedback={btnCollectFeedback}
        onSplitBill={handleOpenSplitDrawer}
      />

      {/* ── Advanced Bill Splitting Drawer ── */}
      <POSSplitBillDrawer
        isOpen={splitDrawerState.isOpen}
        onClose={() => setSplitDrawerState({ isOpen: false, order: null })}
        order={splitDrawerState.order}
        currency={currency}
        paymentTypes={paymentTypes}
        onPaymentComplete={() => {
          refreshOrders();
        }}
        onPrintSubReceipt={handlePrintSubReceipt}
      />

      {/* ── Unified POS Payment Drawer (Dual currency numpad, banknote presets, change calculator) ── */}
      <POSPaymentDrawer
        isOpen={paymentDrawerState.isOpen}
        onClose={() =>
          setPaymentDrawerState((prev) => ({ ...prev, isOpen: false }))
        }
        paymentTypes={paymentTypes}
        selectedPaymentType={paymentDrawerState.selectedPaymentType}
        onSelectPaymentType={(id) =>
          setPaymentDrawerState((prev) => ({
            ...prev,
            selectedPaymentType: id,
          }))
        }
        payableTotal={paymentDrawerState.totalPayable}
        itemsTotal={paymentDrawerState.subtotal}
        taxTotal={paymentDrawerState.taxTotal}
        serviceChargeTotal={paymentDrawerState.serviceCharge}
        discountAmount={paymentDrawerState.discountTotal}
        customerGroupDiscountTotal={paymentDrawerState.customerGroupDiscountTotal}
        customerGroup={paymentDrawerState.customerGroupName ? { name: paymentDrawerState.customerGroupName } : null}
        discountType={paymentDrawerState.discountType}
        discountValue={paymentDrawerState.discountValue}
        onDiscountChange={handlePaymentDrawerDiscountChange}
        currency={currency}
        exchangeRateUsdToKhr={
          paymentDrawerState.customExchangeRate ||
          storeSettings?.exchange_rate_usd_to_khr ||
          4100
        }
        onUpdateExchangeRate={(rate) =>
          setPaymentDrawerState((prev) => ({
            ...prev,
            customExchangeRate: rate,
          }))
        }
        tenderedAmount={paymentDrawerState.tenderedAmount}
        onTenderedAmountChange={(amt) =>
          setPaymentDrawerState((prev) => ({
            ...prev,
            tenderedAmount: amt,
          }))
        }
        onPayAndComplete={handleConfirmPayAndComplete}
        isProcessing={paymentDrawerState.isSubmitting}
        cartItems={paymentDrawerState.cartItems}
        customer={paymentDrawerState.orderGroup?.customer_id ? { phone: paymentDrawerState.orderGroup.customer_id, name: paymentDrawerState.orderGroup.customer_name } : null}
        customerType={paymentDrawerState.orderGroup?.customer_id ? "CUSTOMER" : "WALKIN"}
        tableTitle={
          paymentDrawerState.orderGroup?.table_title ||
          paymentDrawerState.orderGroup?.orders?.[0]?.delivery_type?.toUpperCase() ||
          ""
        }
      />

      {/* ── Confirmation Modal: Cancel Order ── */}
      <dialog id="modal-order-cancel" className="modal">
        <div className="modal-box border border-slate-200 dark:border-zinc-800 rounded-3xl bg-white dark:bg-zinc-900 p-6">
          <h3 className="font-black text-lg text-slate-900 dark:text-white">
            {t("orders.alert")}
          </h3>
          <p className="py-3 text-sm text-slate-600 dark:text-zinc-300">
            {t("orders.cancel_order_alert")}
          </p>
          <div className="modal-action">
            <form method="dialog" className="flex items-center gap-2">
              <button className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-bold transition active:scale-95 cursor-pointer">
                {t("orders.dismiss")}
              </button>
              <button
                type="button"
                onClick={() => {
                  document.getElementById("modal-order-cancel").close();
                  btnCancelOrder();
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition active:scale-95 cursor-pointer"
              >
                {t("orders.confirm")}
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* ── Confirmation Modal: Complete Order ── */}
      <dialog id="modal-order-complete" className="modal">
        <div className="modal-box border border-slate-200 dark:border-zinc-800 rounded-3xl bg-white dark:bg-zinc-900 p-6">
          <h3 className="font-black text-lg text-slate-900 dark:text-white">
            {t("orders.alert")}
          </h3>
          <p className="py-3 text-sm text-slate-600 dark:text-zinc-300">
            {t("orders.complete_order_alert")}
          </p>
          <div className="modal-action">
            <form method="dialog" className="flex items-center gap-2">
              <button className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-bold transition active:scale-95 cursor-pointer">
                {t("orders.dismiss")}
              </button>
              <button
                type="button"
                onClick={() => {
                  document.getElementById("modal-order-complete").close();
                  btnCompleteOrder();
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition active:scale-95 cursor-pointer"
              >
                {t("orders.confirm")}
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* ── Modal: Collect Feedback QR ── */}
      <dialog id="modal-collect-feedback" className="modal">
        <div className="modal-box border border-slate-200 dark:border-zinc-800 rounded-3xl bg-white dark:bg-zinc-900 p-6">
          <div className="mx-auto w-14 h-14 flex items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-200 dark:border-amber-900">
            <IconStars stroke={iconStroke} size={28} />
          </div>
          <h3 className="mt-3 font-black text-lg text-center text-slate-900 dark:text-white">
            {t("orders.collect_feedback")}
          </h3>

          <div className="absolute top-5 right-5">
            <form method="dialog">
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-rose-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition active:scale-95 cursor-pointer">
                <IconX stroke={iconStroke} size={18} />
              </button>
            </form>
          </div>

          <div className="my-4">
            {state.feedbackQRCode && (
              <img
                src={state.feedbackQRCode}
                alt={t("orders.feedback_qr_img_alt")}
                className="w-48 h-48 mx-auto border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-sm"
              />
            )}
          </div>

          <p
            className="text-center italic mb-6 text-xs text-slate-600 dark:text-zinc-400"
            dangerouslySetInnerHTML={{ __html: t("orders.feedback_message") }}
          />

          <div className="modal-action justify-center">
            <form method="dialog">
              <button
                type="button"
                onClick={() => {
                  btnOpenFeedbackLink();
                }}
                className="min-h-[42px] flex items-center gap-2 transition active:scale-95 hover:shadow-lg px-5 py-2 bg-[#2CA01C] hover:bg-[#248217] text-white rounded-xl font-bold text-xs sm:text-sm cursor-pointer"
              >
                <span>{t("orders.open_in_new_tab")}</span>
                <IconExternalLink stroke={iconStroke} size={16} />
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </Page>
  );
}
