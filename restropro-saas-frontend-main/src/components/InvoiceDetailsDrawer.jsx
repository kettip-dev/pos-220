import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IconX,
  IconReceipt,
  IconPrinter,
  IconBan,
  IconHistory,
  IconClock,
  IconArmchair,
  IconShoppingBag,
  IconTruckDelivery,
  IconUser,
  IconCash,
  IconCreditCard,
  IconAlertTriangle,
  IconNotes,
  IconCheck,
  IconBuildingStore,
  IconTag,
  IconPercentage,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { getInvoiceOrders } from "../controllers/invoices.controller";
import clsx from "clsx";

/**
 * Slide-over drawer for viewing full invoice details, items, variants,
 * addons, taxes, discounts, and order tickets.
 */
export default function InvoiceDetailsDrawer({
  isOpen,
  onClose,
  invoiceId,
  orderIdsArr = [],
  tokens = "",
  paymentTypeId = null,
  invoiceSummary = null,
  currency = "$",
  paymentTypes = [],
  storeSettings = null,
  printSettings = null,
  canVoid = false,
  canViewAuditLog = false,
  onPrintReceipt,
  onOpenVoidModal,
  onOpenAuditLogModal,
}) {
  const { t } = useTranslation();
  const [details, setDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Fetch full invoice orders and details
  useEffect(() => {
    if (!isOpen || !invoiceId) {
      setDetails(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const fetchDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getInvoiceOrders(invoiceId, orderIdsArr);
        if (!cancelled && res.status === 200) {
          setDetails(res.data);
        }
      } catch (err) {
        console.error("Error fetching invoice details:", err);
        if (!cancelled) {
          setError(
            err?.response?.data?.message ||
              t("invoices.error_loading_details", "Error loading invoice details")
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchDetails();

    return () => {
      cancelled = true;
    };
  }, [isOpen, invoiceId, JSON.stringify(orderIdsArr)]);

  if (!isOpen) return null;

  // Resolve status & basic summary from details or invoiceSummary fallback
  const isVoid =
    details?.status === "VOID" || invoiceSummary?.status === "VOID";
  const displayTokens =
    tokens ||
    (details?.orders?.map((o) => o.token_no).filter(Boolean).join(", ") ||
      invoiceSummary?.tokens ||
      "");
  const displayCreatedAt =
    invoiceSummary?.created_at || details?.orders?.[0]?.date || null;
  const deliveryType =
    details?.orders?.[0]?.delivery_type ||
    invoiceSummary?.delivery_type ||
    "dinein";
  const customerName =
    details?.orders?.[0]?.customer_name ||
    invoiceSummary?.name ||
    invoiceSummary?.customer_id ||
    "";
  const customerType =
    details?.orders?.[0]?.customer_type || invoiceSummary?.customer_type || "";
  const tableTitle =
    details?.orders?.[0]?.table_title || invoiceSummary?.table_title || null;
  const businessName =
    details?.business || invoiceSummary?.business || null;

  // Payment method label
  let paymentMethodName = "";
  const effectivePaymentTypeId = paymentTypeId || invoiceSummary?.payment_type_id;
  if (effectivePaymentTypeId) {
    const pt = paymentTypes.find((p) => String(p.id) === String(effectivePaymentTypeId));
    if (pt) paymentMethodName = pt.title;
  }

  // Delivery label helper
  const getDeliveryLabel = (type) => {
    if (!type) return t("invoices.dinein", "Dine-In");
    const key = String(type).toLowerCase();
    if (key.includes("dine")) return t("invoices.dinein", "Dine-In");
    if (key.includes("take")) return t("invoices.takeaway", "Takeaway");
    if (key.includes("deliv")) return t("invoices.delivery", "Delivery");
    return type;
  };

  const getDeliveryIcon = (type) => {
    const key = String(type || "").toLowerCase();
    if (key.includes("dine")) return <IconArmchair size={22} stroke={iconStroke} />;
    if (key.includes("deliv")) return <IconTruckDelivery size={22} stroke={iconStroke} />;
    return <IconShoppingBag size={22} stroke={iconStroke} />;
  };

  const formatMoney = (val) => {
    const num = Number(val) || 0;
    return `${currency}${num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Financial values: use details if available, fallback to invoiceSummary
  const subtotal = details?.subtotal ?? invoiceSummary?.sub_total ?? 0;
  const discountTotal = details?.discountTotal ?? invoiceSummary?.discount_total ?? 0;
  const taxTotal = details?.taxTotal ?? invoiceSummary?.tax_total ?? 0;
  const serviceChargeTotal =
    details?.serviceChargeTotal ?? invoiceSummary?.service_charge_total ?? 0;
  const payableTotal = details?.total ?? invoiceSummary?.total ?? 0;
  const discountType = details?.discountType;
  const discountValue = details?.discountValue;
  const appliedPromotions = details?.applied_promotions
    ? typeof details.applied_promotions === "string"
      ? JSON.parse(details.applied_promotions)
      : details.applied_promotions
    : [];
  const promotionDiscountTotal = details?.promotion_discount_total || 0;

  // Compute total item count from loaded orders
  let totalItemsCount = 0;
  if (details?.orders) {
    details.orders.forEach((o) => {
      (o.items || []).forEach((item) => {
        totalItemsCount += Number(item.quantity) || 1;
      });
    });
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-lg md:max-w-xl bg-white dark:bg-[#18181b] border-l border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
          
          {/* ── Drawer Header ── */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/60 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={clsx(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs border",
                    isVoid
                      ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50"
                  )}
                >
                  {getDeliveryIcon(deliveryType)}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                      {t("invoices.invoice_no", "Invoice")} #{invoiceId}
                    </h2>

                    {/* Paid vs Void Badge */}
                    {isVoid ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-300 dark:border-rose-800 uppercase">
                        {t("invoices.void_badge", "VOID")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 uppercase">
                        {t("invoices.paid_badge", "PAID")}
                      </span>
                    )}

                    {businessName && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                        <IconBuildingStore size={12} stroke={iconStroke} />
                        <span>{businessName}</span>
                      </span>
                    )}
                  </div>

                  {/* Sub-line: Delivery Type, Table, Token, Time */}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-slate-600 dark:text-zinc-400">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">
                      {getDeliveryLabel(deliveryType)}
                      {tableTitle ? ` • ${tableTitle}` : ""}
                    </span>

                    {displayTokens && (
                      <span className="inline-flex items-center gap-1 font-bold text-xs text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-zinc-700">
                        <span>{t("orders.tokens", "Token")}:</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          #{displayTokens}
                        </span>
                      </span>
                    )}

                    {displayCreatedAt && (
                      <span className="inline-flex items-center gap-1 text-slate-500 dark:text-zinc-400">
                        <IconClock size={13} stroke={iconStroke} />
                        <span>
                          {new Intl.DateTimeFormat("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(displayCreatedAt))}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-zinc-800 transition active:scale-95 shrink-0 cursor-pointer"
              >
                <IconX size={20} stroke={iconStroke} />
              </button>
            </div>
          </div>

          {/* ── Scrollable Body ── */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            
            {/* Void Notice Banner */}
            {isVoid && (
              <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 p-3.5 sm:p-4 text-xs text-rose-900 dark:text-rose-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-400">
                  <IconBan size={16} stroke={iconStroke} />
                  <span>{t("invoices.void_notice", "This invoice has been voided")}</span>
                </div>
                {details?.voidReason && (
                  <p className="text-rose-800/90 dark:text-rose-300">
                    <span className="font-semibold">{t("invoices.void_reason", "Reason")}: </span>
                    {details.voidReason}
                  </p>
                )}
                {(details?.voidedBy || details?.voidedAt) && (
                  <p className="text-[11px] text-rose-700/80 dark:text-rose-400/80">
                    {details.voidedBy && `${t("invoices.voided_by", "Voided by")} ${details.voidedBy}`}
                    {details.voidedBy && details.voidedAt && " • "}
                    {details.voidedAt &&
                      new Intl.DateTimeFormat("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(details.voidedAt))}
                  </p>
                )}
              </div>
            )}

            {/* Customer Details Card (if customer exists) */}
            {customerName && (
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-3.5 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 flex items-center justify-center shrink-0">
                    <IconUser size={16} stroke={iconStroke} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">
                      {customerName}
                    </p>
                    {customerType && (
                      <p className="text-[11px] text-slate-400 dark:text-zinc-500 capitalize">
                        {customerType}
                      </p>
                    )}
                  </div>
                </div>

                {paymentMethodName && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                    <IconCash size={14} stroke={iconStroke} />
                    <span>{paymentMethodName}</span>
                  </div>
                )}
              </div>
            )}

            {/* Loading State Spinner / Shimmer */}
            {isLoading && (
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 flex flex-col items-center justify-center text-slate-400 gap-3">
                <span className="loading loading-spinner loading-md text-emerald-600"></span>
                <span className="text-xs font-medium">
                  {t("invoices.loading_details", "Loading invoice order details...")}
                </span>
              </div>
            )}

            {/* Error Message */}
            {error && !isLoading && (
              <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-4 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <IconAlertTriangle size={18} stroke={iconStroke} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Order Tickets and Items List */}
            {!isLoading && details?.orders && details.orders.length > 0 && (
              <div className="space-y-3">
                {details.orders.map((order, orderIdx) => {
                  const {
                    id: orderId,
                    token_no,
                    date: orderDate,
                    items = [],
                  } = order;

                  return (
                    <div
                      key={orderId || orderIdx}
                      className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 overflow-hidden shadow-2xs"
                    >
                      {/* Sub-order Ticket Header */}
                      <div className="px-4 py-2.5 bg-slate-50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs tracking-wide">
                            #{token_no || orderId}
                          </span>
                          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                            {t("orders.order_id", "Order")} #{orderId}
                          </span>
                        </div>

                        {orderDate && (
                          <span className="text-[11px] font-medium text-slate-400">
                            {new Intl.DateTimeFormat("en-US", {
                              timeStyle: "short",
                            }).format(new Date(orderDate))}
                          </span>
                        )}
                      </div>

                      {/* Items */}
                      <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                        {items.map((item, itemIdx) => {
                          const {
                            id: itemId,
                            item_title,
                            variant_title,
                            quantity = 1,
                            price = 0,
                            addons = [],
                            notes,
                            station_name,
                            station_color,
                          } = item;

                          const unitPrice = Number(price) || 0;
                          const addonsTotal = (addons || []).reduce(
                            (sum, a) => sum + (Number(a.price) || 0),
                            0
                          );
                          const lineTotal =
                            (unitPrice + addonsTotal) * Number(quantity);

                          return (
                            <div
                              key={itemId || itemIdx}
                              className="p-3 sm:px-4 flex items-start justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                  <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-xs font-bold flex items-center justify-center shrink-0">
                                    {quantity}
                                  </span>
                                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
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
                                        {Number(a.price) > 0 &&
                                          ` (${currency}${Number(a.price).toFixed(2)})`}
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

                                {station_name && (
                                  <div className="ml-7 mt-1">
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border"
                                      style={{
                                        borderColor: station_color
                                          ? `${station_color}60`
                                          : undefined,
                                        color: station_color || undefined,
                                        backgroundColor: station_color
                                          ? `${station_color}15`
                                          : undefined,
                                      }}
                                    >
                                      <span
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{
                                          backgroundColor:
                                            station_color || "#f97316",
                                        }}
                                      />
                                      <span>{station_name}</span>
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Line Total */}
                              <div className="flex flex-col items-end shrink-0">
                                <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                                  {formatMoney(lineTotal)}
                                </span>
                                {Number(quantity) > 1 && (
                                  <span className="text-[11px] text-slate-400">
                                    {formatMoney(unitPrice + addonsTotal)} ea
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Financial / Totals Breakdown Card ── */}
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/60 p-4 space-y-2.5 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 pb-1 border-b border-slate-200/70 dark:border-zinc-800">
                {t("invoices.payment_summary", "Payment Summary")}
              </h3>

              {/* Items Subtotal */}
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
                <span>
                  {t("invoices.subtotal", "Subtotal")}
                  {totalItemsCount > 0 && ` (${totalItemsCount} items)`}
                </span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200 tabular-nums">
                  {formatMoney(subtotal)}
                </span>
              </div>

              {/* Discount if any */}
              {Number(discountTotal) > 0 && (
                <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
                  <span className="flex items-center gap-1">
                    <IconTag size={13} stroke={iconStroke} />
                    <span>{t("invoices.discount", "Discount")}</span>
                    {discountType === "percentage" && discountValue && (
                      <span className="text-[11px] opacity-80">
                        ({discountValue}%)
                      </span>
                    )}
                  </span>
                  <span className="font-semibold tabular-nums">
                    -{formatMoney(discountTotal)}
                  </span>
                </div>
              )}

              {/* Applied Promotions */}
              {appliedPromotions?.length > 0 && (
                <div className="space-y-1 pt-0.5">
                  {appliedPromotions.map((promo, pIdx) => (
                    <div
                      key={pIdx}
                      className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400"
                    >
                      <span className="truncate pr-2">
                        • {promo.title || promo.name || "Promotion"}
                      </span>
                      <span className="font-semibold tabular-nums shrink-0">
                        -{formatMoney(promo.discount_amount || promo.amount || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tax */}
              {Number(taxTotal) > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
                  <span>{t("invoices.tax", "Tax")}</span>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200 tabular-nums">
                    {formatMoney(taxTotal)}
                  </span>
                </div>
              )}

              {/* Service Charge */}
              {Number(serviceChargeTotal) > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
                  <span>{t("invoices.service_charge", "Service Charge")}</span>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200 tabular-nums">
                    {formatMoney(serviceChargeTotal)}
                  </span>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex items-center justify-between pt-2.5 border-t border-slate-200 dark:border-zinc-800">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {t("invoices.total", "Total Amount")}
                </span>
                <span
                  className={clsx(
                    "text-xl font-black tabular-nums",
                    isVoid
                      ? "line-through text-slate-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {formatMoney(payableTotal)}
                </span>
              </div>

              {/* Payment Method Badge */}
              {paymentMethodName && (
                <div className="flex items-center justify-between pt-1 text-xs text-slate-500 dark:text-zinc-400">
                  <span>{t("invoices.payment_method", "Tender / Payment")}:</span>
                  <span className="font-semibold text-slate-700 dark:text-zinc-300">
                    {paymentMethodName}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Footer Touch Action Controls (min-h-[42px]) ── */}
          <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 space-y-2">
            <div className="flex items-center gap-2">
              {/* Print Receipt Button */}
              <button
                type="button"
                onClick={() =>
                  onPrintReceipt &&
                  onPrintReceipt(
                    invoiceId,
                    orderIdsArr,
                    displayTokens,
                    effectivePaymentTypeId
                  )
                }
                title={t("invoices.print_receipt", "Print Receipt")}
                className="h-[42px] min-h-[42px] flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-4 flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <IconPrinter size={18} stroke={iconStroke} />
                <span>{t("invoices.print_receipt", "Print Receipt")}</span>
              </button>

              {/* Audit Log Button */}
              {canViewAuditLog && (
                <button
                  type="button"
                  onClick={() => onOpenAuditLogModal && onOpenAuditLogModal(invoiceId)}
                  title={t("auditLogs.audit_log_action_title", "Audit Log")}
                  className="h-[42px] min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 flex items-center justify-center gap-1.5 text-xs font-semibold whitespace-nowrap transition active:scale-95 cursor-pointer shadow-2xs"
                >
                  <IconHistory size={16} stroke={iconStroke} />
                  <span className="hidden sm:inline">
                    {t("auditLogs.audit_log_action_title", "Audit Log")}
                  </span>
                </button>
              )}

              {/* Void Button */}
              {canVoid && !isVoid && (
                <button
                  type="button"
                  onClick={() => onOpenVoidModal && onOpenVoidModal(invoiceId)}
                  title={t("invoices.void_invoice", "Void Invoice")}
                  className="h-[42px] min-h-[42px] px-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5 text-xs font-semibold whitespace-nowrap transition active:scale-95 cursor-pointer shadow-2xs"
                >
                  <IconBan size={16} stroke={iconStroke} />
                  <span className="hidden sm:inline">
                    {t("invoices.void_invoice", "Void")}
                  </span>
                </button>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="h-[42px] min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 flex items-center justify-center text-xs font-semibold transition active:scale-95 cursor-pointer"
              >
                {t("common.close", "Close")}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
