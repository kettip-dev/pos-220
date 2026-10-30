import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  IconBellRinging,
  IconCheck,
  IconChefHat,
  IconCircleCheckFilled,
  IconClock,
  IconPlus,
  IconReceipt2,
  IconRefresh,
  IconToolsKitchen2,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  callWaiterFromQrMenu,
  getLastQROrderReceipt,
  getQRLiveOrderStatus,
  getQRTableSession,
} from "../controllers/qrmenu.controller";
import { CURRENCIES } from "../config/currencies.config";
import { SocketContext } from "../contexts/SocketContext";
import { initSocket } from "../utils/socket";

function OrderSuccessPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { socket, isSocketConnected } = useContext(SocketContext);

  const lastReceipt = useMemo(() => getLastQROrderReceipt(), []);
  const qrcode = searchParams.get("qrcode") || lastReceipt?.qrcode || "";
  const savedSession = useMemo(() => getQRTableSession(qrcode), [qrcode]);

  const tableParam =
    searchParams.get("table") ||
    savedSession?.encryptedTableId ||
    lastReceipt?.storeTable?.encrypted_id ||
    lastReceipt?.storeTable?.id ||
    "";
  const orderIdParam = searchParams.get("orderId") || lastReceipt?.orderId || null;
  const sessionToken = savedSession?.sessionToken || lastReceipt?.sessionToken || null;

  const [liveData, setLiveData] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(qrcode));
  const [isCallingWaiter, setIsCallingWaiter] = useState(false);

  const fetchLiveStatus = async () => {
    if (!qrcode) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await getQRLiveOrderStatus(qrcode, {
        tableId: tableParam,
        sessionToken,
        qrOrderId: orderIdParam,
      });
      if (res.status === 200 && res.data?.success) {
        setLiveData(res.data);
      }
    } catch (err) {
      console.error("Live status fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveStatus();
    const interval = setInterval(fetchLiveStatus, 8000);
    return () => clearInterval(interval);
  }, [qrcode, tableParam, orderIdParam, sessionToken]);

  useEffect(() => {
    if (!qrcode) return;
    if (!isSocketConnected) {
      initSocket();
    }
    if (socket) {
      socket.emit("join_qrmenu_backend", qrcode);
      const handleRealtimeUpdate = () => fetchLiveStatus();
      socket.on("order_update", handleRealtimeUpdate);
      socket.on("new_order", handleRealtimeUpdate);
      socket.on("table_status_update", handleRealtimeUpdate);
      return () => {
        socket.off("order_update", handleRealtimeUpdate);
        socket.off("new_order", handleRealtimeUpdate);
        socket.off("table_status_update", handleRealtimeUpdate);
      };
    }
  }, [qrcode, socket, isSocketConnected]);

  const currencySymbol = useMemo(() => {
    if (liveData?.storeSettings?.currency) {
      const c = CURRENCIES.find((x) => x.cc === liveData.storeSettings.currency);
      if (c?.symbol) return c.symbol;
    }
    return lastReceipt?.currency || savedSession?.currency || "$";
  }, [liveData, lastReceipt, savedSession]);

  const storeTable = liveData?.storeTable || lastReceipt?.storeTable || null;
  const kitchenOrders = liveData?.kitchenOrders || [];
  const pendingQrOrders = liveData?.pendingQrOrders || [];
  const serviceChargePercentage =
    liveData?.serviceCharge ?? lastReceipt?.serviceCharge ?? null;

  // Determine overall progress stage:
  // 1 = Waiting for Staff Approval, 2 = Preparing in Kitchen, 3 = Ready / Served
  const currentStage = useMemo(() => {
    if (kitchenOrders.length > 0) {
      const allItems = kitchenOrders.flatMap((o) => o.items || []).filter((i) => i.status !== "cancelled");
      if (
        allItems.length > 0 &&
        allItems.every((i) => i.status === "completed" || i.status === "delivered")
      ) {
        return 3;
      }
      return 2;
    }
    if (pendingQrOrders.length > 0) {
      return 1;
    }
    if (lastReceipt?.autoSentToKitchen) {
      return 2;
    }
    return 1;
  }, [kitchenOrders, pendingQrOrders, lastReceipt]);

  // Calculate Running Table Bill Summary across active kitchen orders + pending QR orders
  const runningBill = useMemo(() => {
    const allActiveItems = [
      ...kitchenOrders.flatMap((o) => o.items || []),
      ...pendingQrOrders.flatMap((o) => o.items || []),
    ].filter((i) => i.status !== "cancelled");

    if (allActiveItems.length === 0 && lastReceipt?.items?.length > 0) {
      return {
        itemsTotal: Number(lastReceipt.itemsTotal || 0),
        taxTotal: Number(lastReceipt.taxTotal || 0),
        serviceChargeTotal: Number(lastReceipt.serviceChargeTotal || 0),
        payableTotal: Number(lastReceipt.payableTotal || 0),
      };
    }

    let itemsTotal = 0;
    let taxTotal = 0;
    let serviceChargeTotal = 0;
    let payableTotal = 0;

    allActiveItems.forEach((item) => {
      const taxRate = Number(item.tax_rate) || 0;
      const taxType = item.tax_type;
      const itemPrice = (Number(item.price) || 0) * (Number(item.quantity) || 1);

      if (taxType === "exclusive") {
        const tax = (itemPrice * taxRate) / 100;
        taxTotal += tax;
        itemsTotal += itemPrice;
        payableTotal += itemPrice + tax;
      } else if (taxType === "inclusive") {
        const tax = itemPrice - itemPrice * (100 / (100 + taxRate));
        taxTotal += tax;
        itemsTotal += itemPrice - tax;
        payableTotal += itemPrice;
      } else {
        itemsTotal += itemPrice;
        payableTotal += itemPrice;
      }
    });

    if (serviceChargePercentage) {
      const sc = (itemsTotal * Number(serviceChargePercentage)) / 100;
      serviceChargeTotal += sc;
      payableTotal += sc;
    }

    return { itemsTotal, taxTotal, serviceChargeTotal, payableTotal };
  }, [kitchenOrders, pendingQrOrders, serviceChargePercentage, lastReceipt]);

  const handleQuickWaiterCall = async (reason = "bill") => {
    if (!qrcode) return;
    try {
      setIsCallingWaiter(true);
      await callWaiterFromQrMenu(qrcode, {
        tableId: storeTable?.encrypted_id || tableParam || storeTable?.id,
        reason,
        notes: reason === "bill" ? "Guest requested the bill from QR tracker" : "",
      });
      toast.success(
        reason === "bill"
          ? "Bill requested! A server will bring your check shortly."
          : "Server notified! Someone will be right with you."
      );
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Could not notify server. Please try again in a moment."
      );
    } finally {
      setIsCallingWaiter(false);
    }
  };

  const handleOrderMore = () => {
    if (!qrcode) {
      navigate(-1);
      return;
    }
    const tbl = storeTable?.encrypted_id || tableParam;
    navigate(`/m/${qrcode}${tbl ? `?table=${encodeURIComponent(tbl)}` : ""}`);
  };

  const getItemBadge = (status, source) => {
    if (source === "qr_pending") {
      return {
        label: "Awaiting Approval",
        cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
      };
    }
    if (status === "completed" || status === "delivered") {
      return {
        label: "Ready / Served",
        cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
      };
    }
    if (status === "preparing") {
      return {
        label: "Preparing",
        cls: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
      };
    }
    if (status === "cancelled") {
      return {
        label: "Cancelled",
        cls: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
      };
    }
    return {
      label: "In Kitchen",
      cls: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
    };
  };

  return (
    <div className="min-h-screen w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 pb-32">
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-4">
        {/* 1. HERO CONFIRMATION & LIVE STATUS TRACKER */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
                <IconCircleCheckFilled size={32} />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {currentStage === 1
                    ? "Order Sent for Confirmation"
                    : currentStage === 2
                    ? "Kitchen is Preparing Your Order"
                    : "Your Order is Ready / Served!"}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {storeTable
                    ? `Table ${storeTable.table_title}${storeTable.floor ? ` • ${storeTable.floor}` : ""}`
                    : t("order_success.thank_you_message", "Thank you for your order!")}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchLiveStatus}
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 flex items-center justify-center active:scale-95 transition cursor-pointer"
              title="Refresh Status"
            >
              <IconRefresh size={17} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* 3-Step Live Progress Bar */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {/* Step 1 */}
            <div
              className={`p-3 rounded-2xl border text-center transition ${
                currentStage >= 1
                  ? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/30"
                  : "border-slate-200 dark:border-zinc-800 opacity-50"
              }`}
            >
              <div className="w-7 h-7 mx-auto rounded-full bg-emerald-600 text-white flex items-center justify-center mb-1.5">
                {currentStage > 1 ? <IconCheck size={15} /> : <IconClock size={15} />}
              </div>
              <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
                1. Received
              </p>
              <p className="text-[10px] text-slate-500">
                {currentStage === 1 ? "Staff reviewing" : "Confirmed"}
              </p>
            </div>

            {/* Step 2 */}
            <div
              className={`p-3 rounded-2xl border text-center transition ${
                currentStage >= 2
                  ? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/30"
                  : "border-slate-200 dark:border-zinc-800 opacity-50"
              }`}
            >
              <div
                className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center mb-1.5 ${
                  currentStage >= 2
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 dark:bg-zinc-800 text-slate-500"
                }`}
              >
                <IconChefHat size={15} />
              </div>
              <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
                2. Kitchen
              </p>
              <p className="text-[10px] text-slate-500">
                {currentStage === 2
                  ? "Preparing now"
                  : currentStage > 2
                  ? "Completed"
                  : "Up next"}
              </p>
            </div>

            {/* Step 3 */}
            <div
              className={`p-3 rounded-2xl border text-center transition ${
                currentStage >= 3
                  ? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/30"
                  : "border-slate-200 dark:border-zinc-800 opacity-50"
              }`}
            >
              <div
                className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center mb-1.5 ${
                  currentStage >= 3
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 dark:bg-zinc-800 text-slate-500"
                }`}
              >
                <IconToolsKitchen2 size={15} />
              </div>
              <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
                3. Served
              </p>
              <p className="text-[10px] text-slate-500">Enjoy your meal</p>
            </div>
          </div>
        </div>

        {/* 2. ACTIVE TABLE ORDERS & ITEMS */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <IconReceipt2 size={17} className="text-emerald-600" />
              <span>Running Table Tab</span>
            </h2>
            {kitchenOrders[0]?.token_no && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold">
                Token #{kitchenOrders[0].token_no}
              </span>
            )}
          </div>

          {/* Pending QR Orders (Waiting for Approval) */}
          {pendingQrOrders.map((qo) => (
            <div
              key={`qr-${qo.id}`}
              className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-amber-800 dark:text-amber-300">
                  QR Order #{qo.id}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[10px] font-bold">
                  Waiting for Staff Approval
                </span>
              </div>
              <div className="divide-y divide-amber-200/40 dark:divide-amber-800/40">
                {(qo.items || []).map((item) => {
                  const badge = getItemBadge(item.status, "qr_pending");
                  return (
                    <div key={item.id} className="py-2 flex items-start justify-between gap-2 text-xs">
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100">
                          {item.quantity}x {item.item_title}
                        </p>
                        {item.variant_title && (
                          <p className="text-[11px] text-slate-500">{item.variant_title}</p>
                        )}
                        {item.addons_list?.length > 0 && (
                          <p className="text-[11px] text-emerald-600">
                            + {item.addons_list.map((a) => a.title).join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold">
                          {currencySymbol}
                          {(Number(item.price) * Number(item.quantity)).toFixed(2)}
                        </p>
                        <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Kitchen Orders */}
          {kitchenOrders.map((ko) => (
            <div
              key={`ko-${ko.id}`}
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/80 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-800 dark:text-slate-100">
                  Kitchen Order #{ko.token_no || ko.id}
                </span>
                <span className="text-[11px] font-semibold text-emerald-600">
                  Approved & In Kitchen
                </span>
              </div>
              <div className="divide-y divide-slate-200/60 dark:divide-zinc-700/60">
                {(ko.items || []).map((item) => {
                  const badge = getItemBadge(item.status, "kitchen");
                  return (
                    <div key={item.id} className="py-2 flex items-start justify-between gap-2 text-xs">
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100">
                          {item.quantity}x {item.item_title}
                        </p>
                        {item.variant_title && (
                          <p className="text-[11px] text-slate-500">{item.variant_title}</p>
                        )}
                        {item.addons_list?.length > 0 && (
                          <p className="text-[11px] text-emerald-600">
                            + {item.addons_list.map((a) => a.title).join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold">
                          {currencySymbol}
                          {(Number(item.price) * Number(item.quantity)).toFixed(2)}
                        </p>
                        <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Fallback if neither API list returned yet, show lastReceipt */}
          {kitchenOrders.length === 0 &&
            pendingQrOrders.length === 0 &&
            lastReceipt?.items?.length > 0 && (
              <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                {lastReceipt.items.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-bold">
                        {item.quantity}x {item.title}
                      </p>
                      {item.variant?.title && (
                        <p className="text-xs text-slate-500">{item.variant.title}</p>
                      )}
                    </div>
                    <span className="font-bold">
                      {currencySymbol}
                      {(Number(item.price) * Number(item.quantity)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}

          {/* Bill Breakdown */}
          <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>{t("cart.items_total", "Items Subtotal")}</span>
              <span>
                {currencySymbol}
                {runningBill.itemsTotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>{t("cart.tax_total", "Tax")}</span>
              <span>
                {currencySymbol}
                {runningBill.taxTotal.toFixed(2)}
              </span>
            </div>
            {runningBill.serviceChargeTotal > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>{t("cart.service_charge_total", "Service Charge")}</span>
                <span>
                  {currencySymbol}
                  {runningBill.serviceChargeTotal.toFixed(2)}
                </span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center text-base font-extrabold">
              <span>Running Table Total</span>
              <span className="text-emerald-600 text-lg">
                {currencySymbol}
                {runningBill.payableTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* 3. QUICK WAITER / REQUEST BILL ACTIONS */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isCallingWaiter}
            onClick={() => handleQuickWaiterCall("water")}
            className="min-h-[48px] rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-4 py-3 text-xs font-extrabold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 shadow-2xs active:scale-95 transition cursor-pointer"
          >
            <IconBellRinging size={17} className="text-amber-500" />
            <span>Call Server</span>
          </button>

          <button
            type="button"
            disabled={isCallingWaiter}
            onClick={() => handleQuickWaiterCall("bill")}
            className="min-h-[48px] rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 px-4 py-3 text-xs font-extrabold text-amber-800 dark:text-amber-300 flex items-center justify-center gap-2 shadow-2xs active:scale-95 transition cursor-pointer"
          >
            <IconReceipt2 size={17} />
            <span>Request Bill</span>
          </button>
        </div>
      </div>

      {/* 4. STICKY BOTTOM "ORDER MORE ITEMS" BUTTON */}
      <div className="fixed bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-zinc-950 dark:via-zinc-950/95">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={handleOrderMore}
            className="w-full min-h-[54px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base py-3.5 px-5 shadow-lg flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer"
          >
            <IconPlus size={20} stroke={2.5} />
            <span>Order More Items for This Table</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default OrderSuccessPage;
