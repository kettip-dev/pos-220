import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  IconArmchair,
  IconShoppingBag,
  IconTruckDelivery,
  IconClock,
  IconUser,
  IconPrinter,
  IconCash,
  IconCheck,
  IconChecks,
  IconDotsVertical,
  IconReceipt,
  IconStars,
  IconX,
  IconAlertCircle,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import { formatElapsedOrderTime, parseOrderDate } from "../../helpers/DateHelper";
import clsx from "clsx";

export default function OrderCard({
  orderGroup,
  currency = "$",
  viewMode = "table", // "table" | "ticket"
  density = "normal", // "normal" | "compact"
  onCardClick,
  onPrintReceipt,
  onPayAndComplete,
  onCompleteOrder,
  onCancelOrder,
  onCollectFeedback,
  onDirectItemStatusChange,
  storeSettings,
}) {
  const { t } = useTranslation();
  const isCompact = density === "compact";

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

  // Derive delivery type
  const deliveryType = orders[0]?.delivery_type || (table_id ? "dinein" : "takeaway");

  // Derive customer label
  const customerName = orders.find((o) => o.customer_name)?.customer_name || null;

  // Earliest date for live timer
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

  // Compute total items and total monetary value
  const { totalItemsCount, totalAmount, allItems } = useMemo(() => {
    let count = 0;
    let sum = 0;
    const itemsList = [];

    orders.forEach((ord) => {
      (ord.items || []).forEach((item) => {
        const qty = Number(item.quantity) || 1;
        count += qty;
        const basePrice = Number(item.price) || 0;
        const addonsPrice = (item.addons || []).reduce(
          (acc, a) => acc + (Number(a.price) || 0),
          0
        );
        sum += (basePrice + addonsPrice) * qty;
        itemsList.push({
          ...item,
          order_token: ord.token_no,
        });
      });
    });

    return { totalItemsCount: count, totalAmount: sum, allItems: itemsList };
  }, [orders]);

  // Status icon and color mapping
  const renderItemStatusIcon = (status, orderItemId) => {
    const handleAdvance = (e) => {
      e.stopPropagation();
      let nextStatus = "completed";
      if (status === "created") nextStatus = "preparing";
      else if (status === "preparing") nextStatus = "completed";
      else if (status === "completed") nextStatus = "delivered";
      else if (status === "delivered") return;

      onDirectItemStatusChange && onDirectItemStatusChange(orderItemId, nextStatus);
    };

    const iconSz = isCompact ? 14 : 16;

    if (status === "preparing") {
      return (
        <button
          type="button"
          onClick={handleAdvance}
          title={t("orders.preparing")}
          className="p-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-950/60 transition active:scale-90"
        >
          <IconClock size={iconSz} stroke={iconStroke} className="text-amber-500" />
        </button>
      );
    }
    if (status === "completed") {
      return (
        <button
          type="button"
          onClick={handleAdvance}
          title={t("orders.completed")}
          className="p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition active:scale-90"
        >
          <IconCheck size={iconSz} stroke={iconStroke} className="text-emerald-500" />
        </button>
      );
    }
    if (status === "delivered") {
      return (
        <span title={t("orders.delivered")} className="p-0.5">
          <IconChecks size={iconSz} stroke={iconStroke} className="text-teal-600" />
        </span>
      );
    }
    if (status === "cancelled") {
      return (
        <span title={t("orders.cancelled")} className="p-0.5">
          <IconX size={iconSz} stroke={iconStroke} className="text-rose-500" />
        </span>
      );
    }
    // Default: created
    return (
      <button
        type="button"
        onClick={handleAdvance}
        title={t("orders.created", "Created (tap to prepare)")}
        className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-zinc-700 transition active:scale-90"
      >
        <div className={clsx("rounded-full border-2 border-slate-300 dark:border-zinc-600", isCompact ? "w-3 h-3" : "w-3.5 h-3.5")} />
      </button>
    );
  };

  const getDiningLabel = (type) => {
    const k = String(type || "").toLowerCase();
    if (k.includes("dine")) return t("pos.dinein", "Dine-In");
    if (k.includes("take")) return t("pos.takeaway", "Takeaway");
    if (k.includes("deliv")) return t("pos.delivery", "Delivery");
    return type || t("pos.dinein", "Dine-In");
  };

  // Visible items count limit for clean card layout
  const maxDisplayItems = isCompact ? 2 : 4;
  const displayItems = allItems.slice(0, maxDisplayItems);
  const remainingCount = allItems.length - maxDisplayItems;

  return (
    <div
      onClick={() => onCardClick && onCardClick(orderGroup)}
      className={clsx(
        "group relative flex flex-col justify-between rounded-2xl border-2 transition-all duration-150 cursor-pointer select-none text-left shadow-xs hover:shadow-md hover:-translate-y-0.5",
        isCompact ? "p-2.5 sm:p-3" : "p-3.5 sm:p-4",
        isPaid
          ? "border-emerald-300/80 dark:border-emerald-800/60 bg-gradient-to-b from-emerald-50/40 via-white to-white dark:from-emerald-950/20 dark:via-zinc-900 dark:to-zinc-900"
          : "border-amber-300/80 dark:border-amber-700/60 bg-gradient-to-b from-amber-50/40 via-white to-white dark:from-amber-950/20 dark:via-zinc-900 dark:to-zinc-900"
      )}
    >
      <div>
        {/* ── Top Header: Icon + Table/Dining Title + Elapsed Timer + Status Badge + Dropdown ── */}
        <div className={clsx("flex items-start justify-between gap-2 border-b border-slate-100 dark:border-zinc-800/80", isCompact ? "pb-2" : "pb-2.5")}>
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={clsx(
                "flex items-center justify-center shrink-0 border shadow-2xs",
                isCompact ? "w-8 h-8 rounded-lg" : "w-11 h-11 rounded-xl",
                table_id
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800"
                  : deliveryType === "delivery"
                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800"
                  : "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-800"
              )}
            >
              {table_id ? (
                <IconArmchair size={isCompact ? 17 : 22} stroke={iconStroke} />
              ) : deliveryType === "delivery" ? (
                <IconTruckDelivery size={isCompact ? 17 : 22} stroke={iconStroke} />
              ) : (
                <IconShoppingBag size={isCompact ? 17 : 22} stroke={iconStroke} />
              )}
            </div>

            <div className="min-w-0">
              <h3 className={clsx(
                "font-black tracking-tight text-slate-900 dark:text-white truncate leading-tight",
                isCompact ? "text-sm sm:text-base" : "text-base sm:text-lg"
              )}>
                {table_id ? table_title : getDiningLabel(deliveryType)}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {floor && (
                  <span className={clsx(
                    "font-semibold text-slate-500 dark:text-zinc-400 truncate",
                    isCompact ? "text-[10px]" : "text-[11px]"
                  )}>
                    {floor}
                  </span>
                )}
                {tokens && (
                  <span className={clsx(
                    "font-bold text-slate-700 dark:text-zinc-300 bg-black/5 dark:bg-white/10 px-1.5 py-0.2 rounded",
                    isCompact ? "text-[10px]" : "text-[11px]"
                  )}>
                    #{tokens}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Header: Timer, Status Pill, Dropdown */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-end gap-1">
              {/* Payment Status Pill */}
              <span
                className={clsx(
                  "inline-flex items-center gap-1 font-black uppercase tracking-wider rounded-full border",
                  isCompact ? "text-[9px] px-1.5 py-0.2" : "text-[10px] px-2 py-0.5",
                  isPaid
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
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

              {/* Elapsed live timer */}
              {elapsed && (
                <span className={clsx(
                  "inline-flex items-center gap-1 font-bold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 rounded-md",
                  isCompact ? "text-[9px] px-1 py-0.2" : "text-[10px] px-1.5 py-0.5"
                )}>
                  <IconClock size={isCompact ? 10 : 11} stroke={iconStroke} />
                  <span>{elapsed}</span>
                </span>
              )}
            </div>

            {/* Dropdown 3-dots */}
            <div className="dropdown dropdown-end">
              <div
                tabIndex={0}
                role="button"
                className={clsx(
                  "rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition active:scale-95 cursor-pointer",
                  isCompact ? "w-7 h-7" : "w-8 h-8"
                )}
              >
                <IconDotsVertical size={isCompact ? 15 : 16} stroke={iconStroke} />
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content z-20 menu p-1.5 shadow-xl bg-white dark:bg-zinc-900 rounded-2xl w-52 border border-slate-200 dark:border-zinc-800 text-xs"
              >
                <li>
                  <button
                    className="flex items-center gap-2 py-2 font-medium text-slate-700 dark:text-zinc-200"
                    onClick={() => onPrintReceipt && onPrintReceipt(order_ids, tokens, table_id)}
                  >
                    <IconReceipt size={16} stroke={iconStroke} />
                    <span>{t("orders.print_receipt")}</span>
                  </button>
                </li>
                {storeSettings?.is_feedback_enabled && (
                  <li>
                    <button
                      className="flex items-center gap-2 py-2 font-medium text-slate-700 dark:text-zinc-200"
                      onClick={() => onCollectFeedback && onCollectFeedback(order_ids)}
                    >
                      <IconStars size={16} stroke={iconStroke} />
                      <span>{t("orders.collect_feedback")}</span>
                    </button>
                  </li>
                )}
                <li>
                  <button
                    className="flex items-center gap-2 py-2 font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    onClick={() => onCancelOrder && onCancelOrder(order_ids)}
                  >
                    <IconX size={16} stroke={iconStroke} />
                    <span>{t("orders.cancel")}</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* ── Sub-header: Customer & Financial Total ── */}
        <div className={clsx("flex items-center justify-between gap-2", isCompact ? "mt-1.5" : "mt-2.5")}>
          {customerName ? (
            <span className={clsx("inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-zinc-300 truncate max-w-[150px]", isCompact ? "text-[11px]" : "text-xs")}>
              <IconUser size={isCompact ? 11 : 13} stroke={iconStroke} className="text-slate-400 shrink-0" />
              <span className="truncate">{customerName}</span>
            </span>
          ) : (
            <span className={clsx("font-medium text-slate-400", isCompact ? "text-[10px]" : "text-[11px]")}>
              {orders.length > 1
                ? `${orders.length} ${t("orders.tokens", "orders")}`
                : t("orders.dine_out_or_delivery", "Order")}
            </span>
          )}

          <div className="text-right">
            <span className={clsx(
              "font-black text-slate-900 dark:text-white tabular-nums tracking-tight",
              isCompact ? "text-sm sm:text-base" : "text-base sm:text-lg"
            )}>
              {currency}
              {totalAmount.toLocaleString(undefined, {
                minimumFractionDigits: totalAmount % 1 === 0 ? 0 : 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        {/* ── Items Preview List ── */}
        <div className={clsx(
          "border-t border-slate-100 dark:border-zinc-800/80",
          isCompact ? "mt-1.5 pt-1.5 space-y-1" : "mt-2 pt-2 space-y-1.5"
        )}>
          {displayItems.map((item, i) => {
            const {
              id: orderItemId,
              item_title,
              variant_title,
              quantity = 1,
              status = "created",
              addons = [],
              notes,
            } = item;

            return (
              <div
                key={i}
                className={clsx("flex items-start justify-between gap-1.5", isCompact ? "text-[11px]" : "text-xs")}
              >
                <div className="flex items-start gap-1.5 min-w-0 flex-1">
                  <span className="mt-0.5 shrink-0">
                    {renderItemStatusIcon(status, orderItemId)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={clsx(
                        "font-medium text-slate-800 dark:text-zinc-200 truncate leading-snug",
                        status === "cancelled" && "line-through text-slate-400"
                      )}
                    >
                      <span className="font-bold text-slate-900 dark:text-white mr-1">
                        {quantity}x
                      </span>
                      {item_title}
                      {variant_title && (
                        <span className={clsx("text-slate-400 ml-1", isCompact ? "text-[10px]" : "text-[11px]")}>
                          ({variant_title})
                        </span>
                      )}
                    </p>
                    {addons?.length > 0 && (
                      <p className={clsx("text-slate-400 dark:text-zinc-400 truncate", isCompact ? "text-[9px]" : "text-[10px]")}>
                        +{addons.map((a) => a.title).join(", ")}
                      </p>
                    )}
                    {notes && (
                      <p className={clsx("text-amber-600 dark:text-amber-400 truncate font-medium", isCompact ? "text-[9px]" : "text-[10px]")}>
                        * {notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {remainingCount > 0 && (
            <p className={clsx("font-semibold text-emerald-600 dark:text-emerald-400", isCompact ? "text-[10px] pt-0.5" : "text-[11px] pt-1")}>
              +{remainingCount} {t("orders.more_items", "more items")} &rarr;
            </p>
          )}
        </div>
      </div>

      {/* ── Card Touch Action Footer (min-h-[42px]) ── */}
      <div
        className={clsx(
          "border-t border-slate-100 dark:border-zinc-800/80 flex items-center gap-2",
          isCompact ? "mt-2 pt-2" : "mt-3 pt-3"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Receipt Print Button */}
        <button
          type="button"
          onClick={() => onPrintReceipt && onPrintReceipt(order_ids, tokens, table_id)}
          title={t("orders.print_receipt")}
          className={clsx(
            "rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 flex items-center justify-center transition active:scale-95 cursor-pointer shadow-2xs",
            isCompact ? "h-9 w-9 min-h-[36px] min-w-[36px]" : "h-11 min-h-[42px] min-w-[42px] px-3"
          )}
        >
          <IconPrinter size={isCompact ? 16 : 18} stroke={iconStroke} />
        </button>

        {/* Primary Action Button: Pay & Settle vs Complete */}
        {!isPaid ? (
          <button
            type="button"
            onClick={() => onPayAndComplete && onPayAndComplete(order_ids, orderGroup)}
            className={clsx(
              "flex-1 rounded-xl bg-[#2CA01C] hover:bg-[#248217] text-white font-bold flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap",
              isCompact ? "h-9 min-h-[36px] px-2.5 text-[11px]" : "h-11 min-h-[42px] px-3.5 text-xs"
            )}
          >
            <IconCash size={isCompact ? 16 : 18} stroke={iconStroke} className="shrink-0" />
            <span className="truncate">{t("orders.pay_complete", "Pay & Settle")}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onCompleteOrder && onCompleteOrder(order_ids)}
            className={clsx(
              "flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap",
              isCompact ? "h-9 min-h-[36px] px-2.5 text-[11px]" : "h-11 min-h-[42px] px-3.5 text-xs"
            )}
          >
            <IconCheck size={isCompact ? 16 : 18} stroke={iconStroke} className="shrink-0" />
            <span className="truncate">{t("orders.complete", "Complete Order")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
