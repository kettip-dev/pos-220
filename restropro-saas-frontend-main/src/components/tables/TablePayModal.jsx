import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import {
  IconX,
  IconReceipt2,
  IconCheck,
  IconCash,
  IconCreditCard,
  IconDeviceFloppy,
  IconPrinter,
  IconChevronDown,
  IconChevronUp,
  IconArmchair,
  IconUser,
  IconClock,
} from "@tabler/icons-react";
import moment from "moment";
import {
  getCompleteOrderPaymentSummary,
  payAndCompleteKitchenOrder,
} from "../../controllers/orders.controller";
import { triggerPrintReceipt } from "../../helpers/ReceiptHelper";

export default function TablePayModal({
  isOpen,
  onClose,
  table,
  currency = "$",
  paymentTypes = [],
  printSettings = null,
  storeSettings = null,
  onSuccess = () => {},
}) {
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [selectedPaymentType, setSelectedPaymentType] = useState(null);
  const [tenderedAmount, setTenderedAmount] = useState("");
  const [isPrintReceipt, setIsPrintReceipt] = useState(true);
  const [isItemsExpanded, setIsItemsExpanded] = useState(false);

  // When modal opens or table changes, fetch fresh payment summary
  useEffect(() => {
    if (!isOpen || !table || !table.active_order_id) {
      setSummaryData(null);
      return;
    }

    const fetchSummary = async () => {
      try {
        setIsLoading(true);
        const orderIds = [table.active_order_id];
        const res = await getCompleteOrderPaymentSummary(orderIds);

        if (res?.status === 200 && res?.data) {
          setSummaryData(res.data);
          // Set initial tendered amount to exact total
          setTenderedAmount(String(Number(res.data.total || 0).toFixed(2)));
        }
      } catch (err) {
        console.error("Failed to load table payment summary:", err);
        toast.error(err?.response?.data?.message || t("common.error", "Failed to load order summary"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [isOpen, table, t]);

  // Set default payment method if available
  useEffect(() => {
    if (paymentTypes && paymentTypes.length > 0 && !selectedPaymentType) {
      setSelectedPaymentType(paymentTypes[0].id);
    }
  }, [paymentTypes, selectedPaymentType]);

  if (!isOpen || !table) return null;

  const totalPayable = Number(summaryData?.total || table?.order_total || 0);
  const subtotal = Number(summaryData?.subtotal || table?.order_total || 0);
  const taxTotal = Number(summaryData?.taxTotal || 0);
  const serviceChargeTotal = Number(summaryData?.serviceChargeTotal || 0);

  // Calculate change due
  const numTendered = parseFloat(tenderedAmount) || 0;
  const changeDue = Math.max(0, numTendered - totalPayable);
  const remainingDue = Math.max(0, totalPayable - numTendered);

  // Cash preset amounts
  const cashPresets = [
    { label: t("pos.exact", "Exact"), val: totalPayable },
    { label: `${currency}10`, val: 10 },
    { label: `${currency}20`, val: 20 },
    { label: `${currency}50`, val: 50 },
    { label: `${currency}100`, val: 100 },
  ];

  const handlePayAndComplete = async () => {
    if (!selectedPaymentType) {
      return toast.error(t("orders.select_payment_method", "Please select a payment method"));
    }

    try {
      setIsSubmitting(true);
      const orderIds = [table.active_order_id];

      const res = await payAndCompleteKitchenOrder(
        orderIds,
        subtotal,
        taxTotal,
        serviceChargeTotal,
        totalPayable,
        selectedPaymentType,
        null, // discountType
        0,    // discountValue
        0     // discountTotal
      );

      if (res?.status === 200) {
        toast.success(t("orders.order_completed_successfully", "Table bill settled and order completed!"));

        // Trigger Receipt Print if checked
        if (isPrintReceipt && summaryData) {
          try {
            const formattedOrders = [];
            (summaryData.orders || []).forEach((ord) => {
              (ord.items || []).forEach((item) => {
                formattedOrders.push({
                  title: item.title,
                  quantity: item.quantity,
                  price: item.price,
                  variant: item.variant,
                  addons: item.addons,
                  notes: item.notes,
                });
              });
            });

            triggerPrintReceipt({
              cartItems: formattedOrders,
              deliveryType: table.delivery_type || "dinein",
              customerType: table.customer_name ? "CUSTOM" : "WALKIN",
              customer: { name: table.customer_name || "Walk-in Guest" },
              table: {
                table_id: table.id,
                table_title: table.table_title,
                floor: table.floor,
              },
              printSettings,
              storeSettings,
              itemsTotal: subtotal,
              taxTotal,
              serviceChargeTotal,
              payableTotal: totalPayable,
              currency,
              paymentType: paymentTypes.find((p) => p.id === selectedPaymentType)?.title || "Cash",
              tenderedAmount: numTendered,
              changeDue: changeDue,
              invoiceNo: res?.data?.invoiceNo || res?.data?.invoiceId,
              orderIds: orderIds.join(", "),
            });
          } catch (printErr) {
            console.warn("Print receipt failed:", printErr);
          }
        }

        onSuccess();
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || t("common.error", "Payment failed. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-950/50 text-[#0284c7] flex items-center justify-center font-black">
              <IconReceipt2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {t("tables.table", "Table")} {table.table_title}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  #{table.active_order_token || table.active_order_id}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {table.customer_name || t("pos.walkin_customer", "Walk-in Guest")} • Floor {table.floor}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 flex items-center justify-center text-slate-500 transition cursor-pointer"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <div className="w-8 h-8 border-3 border-[#0ea5e9] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-semibold">{t("orders.loading_summary", "Loading bill details...")}</span>
            </div>
          ) : (
            <>
              {/* Order Items Breakdown Tray (Collapsible) */}
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsItemsExpanded(!isItemsExpanded)}
                  className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-zinc-800/80 transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <IconArmchair size={16} className="text-[#0ea5e9]" />
                    {t("tables.ordered_items", "Ordered Items")} (
                    {(summaryData?.orders?.[0]?.items || []).reduce((acc, i) => acc + Number(i.quantity), 0) || table.order_items_count || 0}
                    )
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-[#0ea5e9]">
                      {currency}{totalPayable.toFixed(2)}
                    </span>
                    {isItemsExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                  </div>
                </button>

                {isItemsExpanded && (
                  <div className="px-4 pb-3 border-t border-slate-200/60 dark:border-zinc-700/60 divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
                    {(summaryData?.orders || []).flatMap((ord) => ord.items || []).map((item, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between">
                        <div className="flex-1 pr-2">
                          <p className="font-bold text-slate-800 dark:text-white">
                            {item.quantity}x {item.title}
                          </p>
                          {item.variant_title && (
                            <span className="text-[10px] text-slate-400 block">{item.variant_title}</span>
                          )}
                          {item.addons && item.addons.length > 0 && (
                            <span className="text-[10px] text-sky-500 block">
                              +{item.addons.map((a) => a.title).join(", ")}
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {currency}{(Number(item.price) * Number(item.quantity)).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Financial Breakdown */}
              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-850 border border-slate-200 dark:border-zinc-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>{t("orders.subtotal", "Subtotal")}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {currency}{subtotal.toFixed(2)}
                  </span>
                </div>
                {taxTotal > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>{t("orders.tax", "Tax")}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {currency}{taxTotal.toFixed(2)}
                    </span>
                  </div>
                )}
                {serviceChargeTotal > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>{t("orders.service_charge", "Service Charge")}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {currency}{serviceChargeTotal.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 dark:border-zinc-700 flex justify-between items-center text-sm">
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {t("orders.total_payable", "Total Payable")}
                  </span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {currency}{totalPayable.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Payment Method Cards */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                  {t("orders.select_payment_method", "Select Payment Method")}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(paymentTypes || []).map((method) => {
                    const isSelected = selectedPaymentType === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setSelectedPaymentType(method.id)}
                        className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1 text-center transition cursor-pointer ${
                          isSelected
                            ? "border-[#0ea5e9] bg-sky-50 dark:bg-sky-950/40 text-[#0284c7] dark:text-sky-300 ring-2 ring-[#0ea5e9]/20 font-bold shadow-xs"
                            : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 font-semibold"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {method.icon?.toLowerCase().includes("card") ? (
                            <IconCreditCard size={18} />
                          ) : (
                            <IconCash size={18} />
                          )}
                          <span className="text-xs">{method.title}</span>
                          {isSelected && <IconCheck size={14} className="text-[#0ea5e9]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fast Cash Tender Presets & Input */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {t("pos.fast_cash_presets", "Cash Tendered & Presets")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {cashPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setTenderedAmount(String(Number(preset.val).toFixed(2)))}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer active:scale-95"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="relative mt-2">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    {currency}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tenderedAmount}
                    onChange={(e) => setTenderedAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-bold text-sm outline-none focus:border-[#0ea5e9]"
                  />
                </div>

                {/* Change Due / Remaining Badge */}
                {numTendered >= totalPayable ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      {t("pos.change_due", "Change Due:")}
                    </span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      {currency}{changeDue.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-700 dark:text-amber-400">
                    <span>{t("pos.amount_remaining", "Amount Remaining:")}</span>
                    <span className="font-bold">{currency}{remainingDue.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Print Receipt Checkbox */}
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isPrintReceipt}
                  onChange={(e) => setIsPrintReceipt(e.target.checked)}
                  className="rounded text-[#0ea5e9] focus:ring-[#0ea5e9] w-4 h-4 cursor-pointer"
                />
                <IconPrinter size={16} className="text-slate-400" />
                <span>{t("orders.print_receipt_option", "Print customer receipt upon payment")}</span>
              </label>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 font-bold text-xs text-slate-700 dark:text-slate-300 transition cursor-pointer"
          >
            {t("common.cancel", "Cancel")}
          </button>

          <button
            type="button"
            disabled={isSubmitting || isLoading || totalPayable <= 0}
            onClick={handlePayAndComplete}
            className="flex-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <IconCheck size={18} />
                <span>{t("tables.collect_payment_free_table", "Settle Bill & Free Table")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
