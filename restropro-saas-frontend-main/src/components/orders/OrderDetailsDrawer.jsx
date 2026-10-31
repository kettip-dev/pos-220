import React from "react";
import { useTranslation } from "react-i18next";
import {
  IconX,
  IconReceipt,
  IconPrinter,
  IconCash,
  IconCheck,
  IconClock,
  IconChecks,
  IconArmchair,
  IconBoxSeam,
  IconShoppingBag,
  IconTruckDelivery,
  IconUser,
  IconPhone,
  IconStars,
  IconAlertTriangle,
  IconNotes,
  IconArrowsSplit2,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import { formatElapsedOrderTime, parseOrderDate } from "../../helpers/DateHelper";
import clsx from "clsx";

export default function OrderDetailsDrawer({
  isOpen,
  onClose,
  orderGroup,
  currency = "$",
  paymentTypes = [],
  storeSettings = null,
  printSettings = null,
  onDirectItemStatusChange,
  onPayAndComplete,
  onCompleteOrder,
  onCancelOrder,
  onPrintReceipt,
  onCollectFeedback,
  onSplitBill,
}) {
  const { t } = useTranslation();

  if (!isOpen || !orderGroup) return null;

  const {
    table_id,
    table_title,
    floor,
    orders = [],
    order_ids = [],
  } = orderGroup;

  const isPaid = orders.length > 0 && orders.every((o) => o.payment_status === "paid");
  const tokenNoArray = orders.map((o) => o.token_no);
  const tokens = tokenNoArray.join(", ");

  // Primary delivery type of this group
  const deliveryType = orders[0]?.delivery_type || (table_id ? "dinein" : "takeaway");

  // Calculate earliest order time for live elapsed display
  const earliestDate = orders.reduce((minDate, o) => {
    if (!o.date) return minDate;
    if (!minDate) return o.date;
    const parsedO = parseOrderDate(o.date);
    const parsedMin = parseOrderDate(minDate);
    if (!parsedO) return minDate;
    if (!parsedMin) return o.date;
    return parsedO < parsedMin ? o.date : minDate;
  }, null);
  const elapsed = earliestDate ? formatElapsedOrderTime(earliestDate) : null;

  // Compute total item count & estimated subtotal
  let totalItemsCount = 0;
  let estimatedTotal = 0;
  orders.forEach((o) => {
    (o.items || []).forEach((item) => {
      const qty = Number(item.quantity) || 1;
      totalItemsCount += qty;
      const basePrice = Number(item.price) || 0;
      const addonsPrice = (item.addons || []).reduce(
        (sum, a) => sum + (Number(a.price) || 0),
        0
      );
      estimatedTotal += (basePrice + addonsPrice) * qty;
    });
  });

  // Cycle status on tap: created -> preparing -> completed -> delivered
  const getNextStatus = (currentStatus) => {
    switch (currentStatus) {
      case "created":
        return "preparing";
      case "preparing":
        return "completed";
      case "completed":
        return "delivered";
      default:
        return "completed";
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "created":
        return {
          label: t("orders.created", "Created"),
          cls: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
          icon: <div className="w-2 h-2 rounded-full border-2 border-slate-400" />,
        };
      case "preparing":
        return {
          label: t("orders.preparing", "Preparing"),
          cls: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800",
          icon: <IconClock size={14} stroke={iconStroke} className="text-amber-600 dark:text-amber-400" />,
        };
      case "completed":
        return {
          label: t("orders.completed", "Ready"),
          cls: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800",
          icon: <IconCheck size={14} stroke={iconStroke} className="text-emerald-600 dark:text-emerald-400" />,
        };
      case "delivered":
        return {
          label: t("orders.delivered", "Delivered"),
          cls: "bg-teal-50 text-teal-700 border-teal-300 dark:bg-teal-950/50 dark:text-teal-400 dark:border-teal-800",
          icon: <IconChecks size={14} stroke={iconStroke} className="text-teal-600 dark:text-teal-400" />,
        };
      case "cancelled":
        return {
          label: t("orders.cancelled", "Cancelled"),
          cls: "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800 line-through",
          icon: <IconX size={14} stroke={iconStroke} className="text-rose-600 dark:text-rose-400" />,
        };
      default:
        return {
          label: status,
          cls: "bg-slate-100 text-slate-700 border-slate-300",
          icon: null,
        };
    }
  };

  const getDiningLabel = (type) => {
    const k = String(type || "").toLowerCase();
    if (k.includes("dine")) return t("pos.dinein", "Dine-In");
    if (k.includes("take")) return t("pos.takeaway", "Takeaway");
    if (k.includes("deliv")) return t("pos.delivery", "Delivery");
    return type || t("pos.dinein", "Dine-In");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-lg bg-white dark:bg-[#18181b] border-l border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col justify-between overflow-hidden">
          
          {/* ── Top Header ── */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-zinc-800/80 bg-slate-50/70 dark:bg-zinc-900/50 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={clsx(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs border",
                    table_id
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                      : "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800"
                  )}
                >
                  {table_id ? (
                    <IconArmchair size={26} stroke={iconStroke} />
                  ) : deliveryType === "delivery" ? (
                    <IconTruckDelivery size={26} stroke={iconStroke} />
                  ) : (
                    <IconShoppingBag size={26} stroke={iconStroke} />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                      {table_id ? table_title : getDiningLabel(deliveryType)}
                    </h2>
                    {floor && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                        {floor}
                      </span>
                    )}
                  </div>
                  
                  {/* Token & Elapsed Sub-line */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 font-bold text-xs text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-zinc-700">
                      <span>{t("orders.tokens", "Token")}:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">#{tokens}</span>
                    </span>

                    {elapsed && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                        <IconClock size={13} stroke={iconStroke} />
                        <span>{elapsed}</span>
                      </span>
                    )}

                    {/* Paid/Unpaid Status Pill */}
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border",
                        isPaid
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                          : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                      )}
                    >
                      <span
                        className={clsx(
                          "w-1.5 h-1.5 rounded-full",
                          isPaid ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                        )}
                      />
                      <span>
                        {isPaid
                          ? t("orders.paid_status", "PAID")
                          : t("orders.unpaid_status", "UNPAID")}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-zinc-800 transition active:scale-95 shrink-0"
              >
                <IconX size={20} stroke={iconStroke} />
              </button>
            </div>
          </div>

          {/* ── Scrollable Body: Tickets & Items ── */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {orders.map((subOrder, subIdx) => {
              const {
                id: orderId,
                token_no,
                date,
                delivery_type: subDelivery,
                customer_name,
                customer_id,
                payment_status,
                items = [],
              } = subOrder;

              return (
                <div
                  key={orderId || subIdx}
                  className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 overflow-hidden shadow-xs"
                >
                  {/* Sub-order Header */}
                  <div className="px-4 py-2.5 bg-slate-50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs tracking-wide">
                        #{token_no}
                      </span>
                      {customer_name && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          <IconUser size={13} stroke={iconStroke} className="text-slate-400" />
                          <span>{customer_name}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-right">
                      <span className="text-[11px] font-medium text-slate-400">
                        {date
                          ? new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(
                              new Date(date)
                            )
                          : ""}
                      </span>
                      <span
                        className={clsx(
                          "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                          payment_status === "paid"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400"
                        )}
                      >
                        {payment_status === "paid"
                          ? t("orders.paid_status", "PAID")
                          : t("orders.pending_status", "PENDING")}
                      </span>
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                    {items.map((item, itemIdx) => {
                      const {
                        id: orderItemId,
                        item_title,
                        variant_title,
                        quantity = 1,
                        price = 0,
                        status = "created",
                        addons = [],
                        notes,
                        station_name,
                        station_color,
                      } = item;

                      const statusMeta = getStatusBadge(status);
                      const unitPrice = Number(price) || 0;
                      const addonsTotal = (addons || []).reduce(
                        (sum, a) => sum + (Number(a.price) || 0),
                        0
                      );
                      const lineTotal = (unitPrice + addonsTotal) * Number(quantity);

                      return (
                        <div
                          key={orderItemId || itemIdx}
                          className="p-3 sm:px-4 flex items-start justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-xs font-bold flex items-center justify-center shrink-0">
                                {quantity}
                              </span>
                              <h4
                                className={clsx(
                                  "font-semibold text-sm text-slate-900 dark:text-white",
                                  status === "cancelled" && "line-through text-slate-400"
                                )}
                              >
                                {item_title}
                                {variant_title && (
                                  <span className="text-xs font-normal text-slate-500 dark:text-zinc-400 ml-1">
                                    ({variant_title})
                                  </span>
                                )}
                              </h4>
                            </div>

                            {/* Addons & Notes */}
                            {addons?.length > 0 && (
                              <div className="ml-7 mt-1 flex flex-wrap gap-1">
                                {addons.map((a, aIdx) => (
                                  <span
                                    key={aIdx}
                                    className="text-[11px] font-medium text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded"
                                  >
                                    +{a.title}
                                    {Number(a.price) > 0 && ` (${currency}${Number(a.price).toFixed(2)})`}
                                  </span>
                                ))}
                              </div>
                            )}

                            {notes && (
                              <p className="ml-7 mt-1 text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <IconNotes size={13} stroke={iconStroke} />
                                <span>{notes}</span>
                              </p>
                            )}

                            {/* Station Badge (if any) */}
                            {station_name && (
                              <div className="ml-7 mt-1">
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border"
                                  style={{
                                    borderColor: station_color ? `${station_color}60` : undefined,
                                    color: station_color || undefined,
                                    backgroundColor: station_color ? `${station_color}15` : undefined,
                                  }}
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: station_color || "#f97316" }}
                                  />
                                  <span>{station_name}</span>
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Line Total & Interactive Status Toggle */}
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                              {currency}
                              {lineTotal.toFixed(2)}
                            </span>

                            {/* One-tap status badge button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (status === "delivered" || status === "cancelled") return;
                                const next = getNextStatus(status);
                                onDirectItemStatusChange && onDirectItemStatusChange(orderItemId, next);
                              }}
                              title={
                                status === "delivered"
                                  ? t("orders.delivered")
                                  : t("orders.tap_to_advance_status", "Tap to advance status")
                              }
                              className={clsx(
                                "min-h-[30px] inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border transition active:scale-95 cursor-pointer",
                                statusMeta.cls
                              )}
                            >
                              {statusMeta.icon}
                              <span>{statusMeta.label}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* ── Financial Summary Box ── */}
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/60 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                <span>{t("orders.items_count", { count: totalItemsCount })}</span>
                <span className="font-semibold text-slate-700 dark:text-zinc-200">
                  {orders.length} {t("orders.tokens", "Order(s)")}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-zinc-800 text-sm">
                <span className="font-bold text-slate-800 dark:text-zinc-100">
                  {t("orders.payable_total", "Estimated Total")}
                </span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {currency}
                  {estimatedTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Footer Touch Action Controls (min-h-[42px]) ── */}
          <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 space-y-2.5">
            <div className="flex items-center gap-2">
              {/* Print Receipt Button (Icon Only) */}
              <button
                type="button"
                onClick={() => onPrintReceipt && onPrintReceipt(order_ids, tokens, table_id)}
                title={t("orders.print_receipt", "Print Receipt")}
                aria-label={t("orders.print_receipt", "Print Receipt")}
                className="h-[42px] w-[42px] min-h-[42px] min-w-[42px] shrink-0 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 flex items-center justify-center transition active:scale-95 cursor-pointer shadow-2xs"
              >
                <IconPrinter size={18} stroke={iconStroke} />
              </button>

              {/* Feedback Button (if enabled - Icon Only) */}
              {storeSettings?.is_feedback_enabled && (
                <button
                  type="button"
                  onClick={() => onCollectFeedback && onCollectFeedback(order_ids)}
                  title={t("orders.collect_feedback", "Collect Feedback")}
                  aria-label={t("orders.collect_feedback", "Collect Feedback")}
                  className="h-[42px] w-[42px] min-h-[42px] min-w-[42px] shrink-0 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 flex items-center justify-center transition active:scale-95 cursor-pointer shadow-2xs"
                >
                  <IconStars size={18} stroke={iconStroke} className="text-amber-500" />
                </button>
              )}

              {/* Cancel Button */}
              <button
                type="button"
                onClick={() => onCancelOrder && onCancelOrder(order_ids)}
                title={t("orders.cancel", "Cancel Order")}
                className="h-[42px] min-h-[42px] px-3.5 shrink-0 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5 text-xs font-semibold whitespace-nowrap transition active:scale-95 cursor-pointer shadow-2xs"
              >
                <IconX size={16} stroke={iconStroke} />
                <span>{t("orders.cancel", "Cancel")}</span>
              </button>

              {/* Split Bill Button */}
              {!isPaid && (
                <button
                  type="button"
                  onClick={() => onSplitBill && onSplitBill(orderGroup)}
                  title={t("orders.split_bill", "Split Bill")}
                  className="h-[42px] min-h-[42px] px-3 shrink-0 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-1.5 text-xs font-semibold whitespace-nowrap transition active:scale-95 cursor-pointer shadow-2xs"
                >
                  <IconArrowsSplit2 size={16} stroke={iconStroke} />
                  <span>{t("orders.split_bill", "Split")}</span>
                </button>
              )}

              {/* Primary Action Button: Pay & Settle vs Complete Order */}
              {!isPaid ? (
                <button
                  type="button"
                  onClick={() => onPayAndComplete && onPayAndComplete(order_ids, orderGroup)}
                  className="h-[42px] min-h-[42px] flex-1 rounded-xl bg-[#2CA01C] hover:bg-[#248217] text-white font-bold text-xs sm:text-sm px-4 flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <IconCash size={19} stroke={iconStroke} className="shrink-0" />
                  <span className="truncate">{t("orders.pay_complete", "Pay & Settle")}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onCompleteOrder && onCompleteOrder(order_ids)}
                  className="h-[42px] min-h-[42px] flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-4 flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <IconCheck size={19} stroke={iconStroke} className="shrink-0" />
                  <span className="truncate">{t("orders.complete", "Complete Order")}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
