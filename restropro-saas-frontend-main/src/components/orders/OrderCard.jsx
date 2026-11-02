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
  IconDots,
  IconReceipt,
  IconStars,
  IconX,
  IconFlame,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import { formatElapsedOrderTime, parseOrderDate } from "../../helpers/DateHelper";
import clsx from "clsx";

// Wait-time thresholds (minutes) used to colour the elapsed timer
export const WAIT_WARN_MINS = 15;
export const WAIT_LATE_MINS = 30;

export const getElapsedMinutes = (dateVal) => {
  const parsed = parseOrderDate(dateVal);
  if (!parsed) return null;
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 60000));
};

export const getEarliestOrderDate = (orders = []) =>
  orders.reduce((minDate, o) => {
    if (!o.date) return minDate;
    if (!minDate) return o.date;
    const parsedO = parseOrderDate(o.date);
    const parsedMin = parseOrderDate(minDate);
    if (!parsedO) return minDate;
    if (!parsedMin) return o.date;
    return parsedO < parsedMin ? o.date : minDate;
  }, null);

export const formatMoney = (amount) =>
  Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

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
  const tokens = orders.map((o) => o.token_no).join(", ");

  const deliveryType = String(
    orders[0]?.delivery_type || (table_id ? "dinein" : "takeaway")
  ).toLowerCase();
  const isDelivery = deliveryType.includes("deliv");

  const customerName = orders.find((o) => o.customer_name)?.customer_name || null;

  // Live elapsed timer (parent re-renders on an interval)
  const earliestDate = getEarliestOrderDate(orders);
  const elapsed = earliestDate ? formatElapsedOrderTime(earliestDate) : null;
  const elapsedMins = earliestDate ? getElapsedMinutes(earliestDate) : null;
  const waitLevel =
    elapsedMins == null
      ? "ok"
      : elapsedMins >= WAIT_LATE_MINS
      ? "late"
      : elapsedMins >= WAIT_WARN_MINS
      ? "warn"
      : "ok";

  const { totalAmount, allItems, activeItemsCount, readyItemsCount } = useMemo(() => {
    let sum = 0;
    let active = 0;
    let ready = 0;
    const itemsList = [];

    orders.forEach((ord) => {
      (ord.items || []).forEach((item) => {
        const qty = Number(item.quantity) || 1;
        const basePrice = Number(item.price) || 0;
        const addonsPrice = (item.addons || []).reduce(
          (acc, a) => acc + (Number(a.price) || 0),
          0
        );
        sum += (basePrice + addonsPrice) * qty;
        if (item.status !== "cancelled") {
          active += 1;
          if (item.status === "completed" || item.status === "delivered") ready += 1;
        }
        itemsList.push({ ...item, order_token: ord.token_no });
      });
    });

    return {
      totalAmount: sum,
      allItems: itemsList,
      activeItemsCount: active,
      readyItemsCount: ready,
    };
  }, [orders]);

  const progressPct = activeItemsCount > 0 ? (readyItemsCount / activeItemsCount) * 100 : 0;
  const allReady = activeItemsCount > 0 && readyItemsCount === activeItemsCount;

  const getDiningLabel = () => {
    if (deliveryType.includes("dine")) return t("pos.dinein", "Dine-In");
    if (deliveryType.includes("take")) return t("pos.takeaway", "Takeaway");
    if (isDelivery) return t("pos.delivery", "Delivery");
    return orders[0]?.delivery_type || t("pos.dinein", "Dine-In");
  };

  // Item status: tap to advance created → preparing → completed → delivered
  const renderItemStatusButton = (status, orderItemId) => {
    const handleAdvance = (e) => {
      e.stopPropagation();
      let nextStatus = "completed";
      if (status === "created") nextStatus = "preparing";
      else if (status === "preparing") nextStatus = "completed";
      else if (status === "completed") nextStatus = "delivered";
      onDirectItemStatusChange && onDirectItemStatusChange(orderItemId, nextStatus);
    };

    const boxCls = clsx(
      "shrink-0 rounded-lg flex items-center justify-center transition-all duration-150",
      isCompact ? "w-7 h-7" : "w-9 h-9"
    );
    const iconSz = isCompact ? 14 : 16;

    if (status === "delivered") {
      return (
        <span title={t("orders.delivered")} className={clsx(boxCls, "bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400")}>
          <IconChecks size={iconSz} stroke={iconStroke} />
        </span>
      );
    }
    if (status === "cancelled") {
      return (
        <span title={t("orders.cancelled")} className={clsx(boxCls, "bg-rose-50 text-rose-500 dark:bg-rose-950/40")}>
          <IconX size={iconSz} stroke={iconStroke} />
        </span>
      );
    }

    const styles = {
      preparing: {
        title: t("orders.preparing"),
        cls: "bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900",
        icon: <IconFlame size={iconSz} stroke={iconStroke} />,
      },
      completed: {
        title: t("orders.completed"),
        cls: "bg-emerald-500 text-white hover:bg-emerald-600",
        icon: <IconCheck size={iconSz} stroke={2.5} />,
      },
      created: {
        title: t("orders.tap_to_advance_status", "Tap to advance status"),
        cls: "border-2 border-dashed border-slate-300 text-transparent hover:border-slate-400 hover:bg-slate-50 dark:border-zinc-600 dark:hover:bg-zinc-800",
        icon: null,
      },
    };
    const s = styles[status] || styles.created;

    return (
      <button
        type="button"
        onClick={handleAdvance}
        title={s.title}
        className={clsx(boxCls, s.cls, "active:scale-90 cursor-pointer")}
      >
        {s.icon}
      </button>
    );
  };

  const maxDisplayItems = isCompact ? 3 : 5;
  const displayItems = allItems.slice(0, maxDisplayItems);
  const remainingCount = allItems.length - maxDisplayItems;

  const TypeIcon = table_id ? IconArmchair : isDelivery ? IconTruckDelivery : IconShoppingBag;

  return (
    <div
      onClick={() => onCardClick && onCardClick(orderGroup)}
      className={clsx(
        "group relative flex flex-col rounded-2xl border bg-white dark:bg-zinc-900 overflow-hidden transition-all duration-150 cursor-pointer select-none text-left shadow-sm hover:shadow-md active:scale-[0.99]",
        waitLevel === "late" && !isPaid
          ? "border-rose-200 dark:border-rose-900/70"
          : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700"
      )}
    >
      {/* Payment status accent stripe */}
      <span
        aria-hidden
        className={clsx(
          "absolute inset-y-0 left-0 w-1",
          isPaid ? "bg-emerald-500" : "bg-amber-400"
        )}
      />

      {/* ── Header ── */}
      <div className={clsx("flex items-start gap-2.5", isCompact ? "pl-3.5 pr-2 pt-2.5" : "pl-5 pr-3 pt-4")}>
        <div
          className={clsx(
            "flex items-center justify-center shrink-0",
            isCompact ? "w-9 h-9 rounded-lg" : "w-11 h-11 rounded-xl",
            table_id
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
              : isDelivery
              ? "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400"
              : "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400"
          )}
        >
          <TypeIcon size={isCompact ? 18 : 22} stroke={iconStroke} />
        </div>

        <div className="min-w-0 flex-1">
          <h3
            className={clsx(
              "font-black tracking-tight text-slate-900 dark:text-white truncate leading-tight",
              isCompact ? "text-sm" : "text-lg"
            )}
          >
            {table_id ? table_title : getDiningLabel()}
          </h3>
          <div className={clsx("flex items-center gap-1.5 mt-0.5 min-w-0 text-slate-500 dark:text-zinc-400", isCompact ? "text-[11px]" : "text-xs")}>
            {floor && <span className="truncate font-medium">{floor}</span>}
            {floor && tokens && <span className="text-slate-300 dark:text-zinc-600">•</span>}
            {tokens && (
              <span className="font-bold text-slate-700 dark:text-zinc-300 tabular-nums shrink-0">
                #{tokens}
              </span>
            )}
          </div>
        </div>

        {/* Elapsed timer + more menu */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {elapsed && (
            <span
              title={t("orders.elapsed_time", "Time since order")}
              className={clsx(
                "inline-flex items-center gap-1 font-bold tabular-nums rounded-lg",
                isCompact ? "text-[11px] px-1.5 h-6" : "text-xs px-2 h-7",
                waitLevel === "late"
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                  : waitLevel === "warn"
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                  : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
              )}
            >
              <IconClock size={isCompact ? 12 : 14} stroke={iconStroke} />
              {elapsed}
            </span>
          )}

          <div className="dropdown dropdown-end">
            <div
              tabIndex={0}
              role="button"
              title={t("orders.more_actions", "More")}
              className={clsx(
                "rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition active:scale-95 cursor-pointer",
                isCompact ? "w-8 h-8" : "w-10 h-10"
              )}
            >
              <IconDots size={18} stroke={iconStroke} />
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content z-20 menu p-1.5 shadow-xl bg-white dark:bg-zinc-900 rounded-2xl w-56 border border-slate-200 dark:border-zinc-800 text-sm"
            >
              <li>
                <button
                  className="flex items-center gap-2.5 min-h-[42px] font-medium text-slate-700 dark:text-zinc-200"
                  onClick={() => onPrintReceipt && onPrintReceipt(order_ids, tokens, table_id)}
                >
                  <IconReceipt size={18} stroke={iconStroke} />
                  <span>{t("orders.print_receipt")}</span>
                </button>
              </li>
              {isPaid && (
                <li>
                  <button
                    className="flex items-center gap-2.5 min-h-[42px] font-medium text-slate-700 dark:text-zinc-200"
                    onClick={() => onCompleteOrder && onCompleteOrder(order_ids)}
                  >
                    <IconCheck size={18} stroke={iconStroke} />
                    <span>{t("orders.complete", "Complete")}</span>
                  </button>
                </li>
              )}
              {storeSettings?.is_feedback_enabled && (
                <li>
                  <button
                    className="flex items-center gap-2.5 min-h-[42px] font-medium text-slate-700 dark:text-zinc-200"
                    onClick={() => onCollectFeedback && onCollectFeedback(order_ids)}
                  >
                    <IconStars size={18} stroke={iconStroke} />
                    <span>{t("orders.collect_feedback")}</span>
                  </button>
                </li>
              )}
              <li>
                <button
                  className="flex items-center gap-2.5 min-h-[42px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  onClick={() => onCancelOrder && onCancelOrder(order_ids)}
                >
                  <IconX size={18} stroke={iconStroke} />
                  <span>{t("orders.cancel")}</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Meta chips: payment, dining type, customer ── */}
      <div className={clsx("flex items-center gap-1.5 flex-wrap", isCompact ? "pl-3.5 pr-2 mt-2" : "pl-5 pr-3 mt-3")}>
        <span
          className={clsx(
            "inline-flex items-center gap-1 font-bold rounded-md",
            isCompact ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-1",
            isPaid
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
          )}
        >
          <span className={clsx("w-1.5 h-1.5 rounded-full", isPaid ? "bg-emerald-500" : "bg-amber-500")} />
          {isPaid ? t("orders.paid_status", "PAID") : t("orders.unpaid_status", "UNPAID")}
        </span>
        {!table_id && (
          <span className={clsx("inline-flex items-center font-semibold rounded-md bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300", isCompact ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-1")}>
            {getDiningLabel()}
          </span>
        )}
        {viewMode === "table" && orders.length > 1 && (
          <span className={clsx("inline-flex items-center font-semibold rounded-md bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300", isCompact ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-1")}>
            {orders.length} {t("orders.tokens", "Tokens")}
          </span>
        )}
        {customerName && (
          <span className={clsx("inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-zinc-300 min-w-0 max-w-full", isCompact ? "text-[11px]" : "text-xs")}>
            <IconUser size={isCompact ? 12 : 14} stroke={iconStroke} className="text-slate-400 shrink-0" />
            <span className="truncate">{customerName}</span>
          </span>
        )}
      </div>

      {/* ── Prep progress ── */}
      {activeItemsCount > 0 && (
        <div className={clsx("flex items-center gap-2", isCompact ? "pl-3.5 pr-3 mt-2" : "pl-5 pr-4 mt-3")}>
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className={clsx("h-full rounded-full transition-all duration-300", allReady ? "bg-emerald-500" : "bg-amber-400")}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className={clsx("font-bold tabular-nums shrink-0", isCompact ? "text-[10px]" : "text-[11px]", allReady ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-zinc-400")}>
            {t("orders.items_ready", {
              done: readyItemsCount,
              total: activeItemsCount,
              defaultValue: "{{done}}/{{total}} ready",
            })}
          </span>
        </div>
      )}

      {/* ── Items ── */}
      <div className={clsx("flex-1", isCompact ? "pl-3 pr-2 mt-1.5 pb-1" : "pl-4 pr-3 mt-2 pb-2")}>
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
            <div key={i} className={clsx("flex items-center gap-2", isCompact ? "py-0.5" : "py-1")}>
              {renderItemStatusButton(status, orderItemId)}
              <div className="min-w-0 flex-1">
                <p
                  className={clsx(
                    "text-slate-800 dark:text-zinc-200 truncate leading-snug",
                    isCompact ? "text-xs" : "text-sm",
                    status === "cancelled" && "line-through text-slate-400 dark:text-zinc-500",
                    (status === "completed" || status === "delivered") && "text-slate-400 dark:text-zinc-500"
                  )}
                >
                  <span className="font-black tabular-nums mr-1">{quantity}×</span>
                  <span className="font-semibold">{item_title}</span>
                  {variant_title && (
                    <span className="text-slate-400 dark:text-zinc-500 ml-1 font-normal">· {variant_title}</span>
                  )}
                </p>
                {addons?.length > 0 && (
                  <p className={clsx("text-slate-400 dark:text-zinc-500 truncate", isCompact ? "text-[10px]" : "text-[11px]")}>
                    + {addons.map((a) => a.title).join(", ")}
                  </p>
                )}
                {notes && (
                  <p className={clsx("text-amber-600 dark:text-amber-400 truncate font-semibold", isCompact ? "text-[10px]" : "text-[11px]")}>
                    ✎ {notes}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {remainingCount > 0 && (
          <p className={clsx("font-bold text-[#2CA01C] pl-1", isCompact ? "text-[11px] pt-0.5" : "text-xs pt-1")}>
            +{remainingCount} {t("orders.more_items", "more items")} →
          </p>
        )}
      </div>

      {/* ── Footer actions ── */}
      <div
        className={clsx(
          "mt-auto flex items-center gap-2 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900",
          isCompact ? "pl-3.5 pr-2.5 py-2" : "pl-5 pr-3 py-3"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onPrintReceipt && onPrintReceipt(order_ids, tokens, table_id)}
          title={t("orders.print_receipt")}
          className={clsx(
            "shrink-0 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-200 flex items-center justify-center transition active:scale-95 cursor-pointer",
            isCompact ? "w-[42px] h-[42px]" : "w-12 h-12"
          )}
        >
          <IconPrinter size={isCompact ? 18 : 20} stroke={iconStroke} />
        </button>

        {!isPaid ? (
          <button
            type="button"
            onClick={() => onPayAndComplete && onPayAndComplete(order_ids, orderGroup)}
            className={clsx(
              "flex-1 min-w-0 rounded-xl bg-[#2CA01C] hover:bg-[#248217] text-white font-bold flex items-center justify-between gap-2 shadow-sm transition active:scale-95 cursor-pointer",
              isCompact ? "h-[42px] px-3 text-xs" : "h-12 px-4 text-sm"
            )}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <IconCash size={isCompact ? 17 : 19} stroke={iconStroke} className="shrink-0" />
              <span className="truncate">{t("orders.pay_complete", "Pay & Settle")}</span>
            </span>
            <span className={clsx("font-black tabular-nums shrink-0 rounded-lg bg-white/20", isCompact ? "px-1.5 py-0.5" : "px-2 py-1")}>
              {currency}
              {formatMoney(totalAmount)}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onCompleteOrder && onCompleteOrder(order_ids)}
            className={clsx(
              "flex-1 min-w-0 rounded-xl font-bold flex items-center justify-between gap-2 transition active:scale-95 cursor-pointer border",
              allReady
                ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm"
                : "bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-zinc-800 dark:text-emerald-400 dark:border-emerald-800",
              isCompact ? "h-[42px] px-3 text-xs" : "h-12 px-4 text-sm"
            )}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <IconChecks size={isCompact ? 17 : 19} stroke={iconStroke} className="shrink-0" />
              <span className="truncate">{t("orders.complete", "Complete")}</span>
            </span>
            <span className="font-black tabular-nums shrink-0 opacity-80">
              {currency}
              {formatMoney(totalAmount)}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
