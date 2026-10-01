import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { getCompleteOrderPaymentSummary, payAndCompleteKitchenOrder } from "../../controllers/orders.controller";
import { triggerPrintReceipt } from "../../helpers/ReceiptHelper";
import POSPaymentDrawer from "../pos/POSPaymentDrawer";

/**
 * TablePayModal — Settle Bill from the Floor Plan / Tables page.
 *
 * Now reuses the full POSPaymentDrawer for a 100% consistent payment
 * experience (dual-currency numpad, banknote presets, change advice,
 * exchange rate editor) — identical to paying from the POS screen.
 */
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

  // Payment state — mirrored from POSPage's pattern
  const [selectedPaymentType, setSelectedPaymentType] = useState(null);
  const [tenderedAmount, setTenderedAmount] = useState("");
  const [customExchangeRate, setCustomExchangeRate] = useState(null);

  // Fetch fresh order payment summary when modal opens
  useEffect(() => {
    if (!isOpen || !table?.active_order_id) {
      setSummaryData(null);
      return;
    }

    let isMounted = true;
    const fetchSummary = async () => {
      try {
        setIsLoading(true);
        const res = await getCompleteOrderPaymentSummary([table.active_order_id]);
        if (isMounted && res?.status === 200 && res?.data) {
          setSummaryData(res.data);
        }
      } catch (err) {
        console.error("Failed to load table payment summary:", err);
        toast.error(err?.response?.data?.message || t("common.error", "Failed to load order summary"));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchSummary();
    return () => { isMounted = false; };
  }, [isOpen, table?.active_order_id, t]);

  // Auto-select first payment method
  useEffect(() => {
    if (paymentTypes?.length > 0 && !selectedPaymentType) {
      setSelectedPaymentType(paymentTypes[0].id);
    }
  }, [paymentTypes, selectedPaymentType]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSummaryData(null);
      setTenderedAmount("");
      setCustomExchangeRate(null);
      // Keep selectedPaymentType so it remembers across quick re-opens
    }
  }, [isOpen]);

  if (!isOpen || !table) return null;

  const totalPayable  = Number(summaryData?.total            || table?.order_total || 0);
  const subtotal      = Number(summaryData?.subtotal         || table?.order_total || 0);
  const taxTotal      = Number(summaryData?.taxTotal         || 0);
  const serviceCharge = Number(summaryData?.serviceChargeTotal || 0);

  // Derive exchange rate: custom override > store setting > default 4100
  const exchangeRate =
    customExchangeRate ||
    storeSettings?.exchange_rate_usd_to_khr ||
    storeSettings?.exchangeRateUsdToKhr ||
    4100;

  // Final settle handler called by POSPaymentDrawer's onPayAndComplete
  const handlePayAndComplete = async (tenderData) => {
    if (!selectedPaymentType) {
      toast.error(t("orders.select_payment_method", "Please select a payment method"));
      return;
    }

    try {
      setIsSubmitting(true);
      const orderIds = [table.active_order_id];

      const res = await payAndCompleteKitchenOrder(
        orderIds,
        subtotal,
        taxTotal,
        serviceCharge,
        totalPayable,
        selectedPaymentType,
        null, // discountType
        0,    // discountValue
        0     // discountTotal
      );

      if (res?.status === 200) {
        toast.success(t("orders.order_completed_successfully", "Table bill settled and order completed!"));

        // Print receipt
        try {
          const formattedItems = [];
          (summaryData?.orders || []).forEach((ord) => {
            (ord.items || []).forEach((item) => {
              formattedItems.push({
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
            cartItems: formattedItems,
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
            serviceChargeTotal: serviceCharge,
            payableTotal: totalPayable,
            currency,
            paymentType: paymentTypes.find((p) => p.id === selectedPaymentType)?.title || "Cash",
            tenderedAmount: tenderData?.totalReceivedUSD ?? (parseFloat(tenderedAmount) || totalPayable),
            changeDue: Math.max(0, (parseFloat(tenderedAmount) || 0) - totalPayable),
            invoiceNo: res?.data?.invoiceNo || res?.data?.invoiceId,
            orderIds: orderIds.join(", "),
          });
        } catch (printErr) {
          console.warn("Print receipt failed:", printErr);
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

  // Show loading spinner while fetching order summary
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950/90 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-zinc-400">
            {t("orders.loading_summary", "Loading bill details...")}
          </span>
        </div>
      </div>
    );
  }

  return (
    <POSPaymentDrawer
      isOpen={isOpen}
      onClose={onClose}
      paymentTypes={paymentTypes}
      selectedPaymentType={selectedPaymentType}
      onSelectPaymentType={setSelectedPaymentType}
      payableTotal={totalPayable}
      itemsTotal={subtotal}
      taxTotal={taxTotal}
      serviceChargeTotal={serviceCharge}
      discountAmount={0}
      discountType="fixed"
      discountValue={0}
      currency={currency}
      exchangeRateUsdToKhr={exchangeRate}
      onUpdateExchangeRate={setCustomExchangeRate}
      tenderedAmount={tenderedAmount}
      onTenderedAmountChange={setTenderedAmount}
      onPayAndComplete={handlePayAndComplete}
      isProcessing={isSubmitting}
    />
  );
}
