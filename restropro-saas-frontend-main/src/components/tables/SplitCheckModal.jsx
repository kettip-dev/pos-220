import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  IconX,
  IconReceiptTax,
  IconCheck,
  IconUsers,
  IconPlus,
  IconMinus,
  IconLoader2,
  IconCash,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import { splitCheckByItems } from "../../controllers/orders.controller";
import { formatTableTitle } from "../../helpers/TableHelper";

export default function SplitCheckModal({
  isOpen,
  onClose,
  table,
  activeOrderSummary,
  currency = "$",
  onSuccess,
  onPayPartial,
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("items"); // "items" | "equal"
  const [selectedItems, setSelectedItems] = useState({}); // { [itemId]: quantityToSplit }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [splitPersons, setSplitPersons] = useState(2);

  // Flatten active items
  const orderItems = useMemo(() => {
    if (!activeOrderSummary?.orders) return [];
    return activeOrderSummary.orders
      .flatMap((o) => o.items || [])
      .filter((i) => i.status !== "cancelled");
  }, [activeOrderSummary]);

  const totalBill = Number(
    activeOrderSummary?.total ||
    table?.order_total ||
    table?.active_order_total ||
    0
  );

  const perPersonAmount = splitPersons > 0 ? totalBill / splitPersons : totalBill;

  if (!isOpen || !table) return null;

  const handleToggleItem = (item) => {
    setSelectedItems((prev) => {
      const current = prev[item.id];
      if (current !== undefined) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }
      return { ...prev, [item.id]: Number(item.quantity || 1) };
    });
  };

  const handleSelectAll = () => {
    const all = {};
    orderItems.forEach((i) => {
      all[i.id] = Number(i.quantity || 1);
    });
    setSelectedItems(all);
  };

  const handleDeselectAll = () => {
    setSelectedItems({});
  };

  const handleChangeQty = (item, delta) => {
    setSelectedItems((prev) => {
      const max = Number(item.quantity || 1);
      const current = prev[item.id] || 0;
      const nextVal = Math.max(1, Math.min(max, current + delta));
      return { ...prev, [item.id]: nextVal };
    });
  };

  const handleConfirmItemSplit = async () => {
    const itemsPayload = Object.entries(selectedItems).map(([id, quantity]) => ({
      id: Number(id),
      quantity: Number(quantity),
    }));

    if (itemsPayload.length === 0) {
      toast.error(t("tables.select_at_least_one_item", "Please select at least one item to split into Check #2"));
      return;
    }

    try {
      setIsSubmitting(true);
      toast.loading(t("tables.splitting_check", "Splitting check..."));
      const sourceOrderId = table.active_order_id;
      const res = await splitCheckByItems(sourceOrderId, itemsPayload);
      toast.dismiss();

      if (res?.status === 200) {
        toast.success(res.data?.message || t("tables.check_split_success", "Check split successfully!"));
        onSuccess && onSuccess();
        onClose();
      }
    } catch (err) {
      toast.dismiss();
      console.error(err);
      toast.error(err?.response?.data?.message || t("common.error", "Failed to split check"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = Object.keys(selectedItems).length;
  const splitItemsTotal = orderItems.reduce((acc, item) => {
    const qty = selectedItems[item.id] || 0;
    const unitPrice = Number(item.variant_price || item.price || 0);
    return acc + unitPrice * qty;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 animate-fade-in select-none">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-zinc-850/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-900">
              <IconReceiptTax size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {t("tables.split_checks", "Split Table Check")}
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-extrabold border border-emerald-200 dark:border-emerald-800">
                  {formatTableTitle(table.table_title, t("tables.table", "Table"))}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Total Bill: <span className="font-black text-emerald-600 dark:text-emerald-400">{currency}{totalBill.toFixed(2)}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
          >
            <IconX size={17} />
          </button>
        </div>

        {/* Tab Toggle: By Item vs Equal Share */}
        <div className="p-2 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2 shrink-0 bg-slate-50/40 dark:bg-zinc-850/40">
          <button
            type="button"
            onClick={() => setActiveTab("items")}
            className={`flex-1 h-[42px] text-xs font-black rounded-xl border transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "items"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-50"
            }`}
          >
            <IconReceiptTax size={16} />
            <span>{t("tables.split_by_items", "Split by Items (Check #2)")}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("equal")}
            className={`flex-1 h-[42px] text-xs font-black rounded-xl border transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "equal"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-50"
            }`}
          >
            <IconUsers size={16} />
            <span>{t("tables.split_equal", "Equal Share Split")}</span>
          </button>
        </div>

        {/* Tab 1: Split by Items */}
        {activeTab === "items" ? (
          <>
            <div className="px-5 py-2.5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-900">
              <span className="text-[11px] font-extrabold tracking-wider uppercase text-slate-500">
                Select items to move into Check #2 ({selectedCount}/{orderItems.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300 dark:text-zinc-700">•</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto max-h-72 space-y-2.5">
              {orderItems.length > 0 ? (
                orderItems.map((item) => {
                  const isChecked = selectedItems[item.id] !== undefined;
                  const splitQty = selectedItems[item.id] || item.quantity || 1;
                  const itemName = item.item_title || item.title || "Item";
                  const unitPrice = Number(item.variant_price || item.price || 0);

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleItem(item)}
                      className={`p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isChecked
                          ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs"
                          : "border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-850 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isChecked
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                          }`}
                        >
                          {isChecked && <IconCheck size={15} strokeWidth={3} />}
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 dark:text-white truncate leading-snug">
                            {itemName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                              {currency}
                              {unitPrice % 1 === 0 ? unitPrice.toLocaleString() : unitPrice.toFixed(2)}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              • Ordered: {item.quantity}x
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stepper */}
                      {isChecked && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-1 shrink-0 shadow-2xs"
                        >
                          <button
                            type="button"
                            disabled={splitQty <= 1}
                            onClick={() => handleChangeQty(item, -1)}
                            className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-red-500 transition active:scale-90 disabled:opacity-30 cursor-pointer"
                          >
                            <IconMinus size={20} stroke={2.5} />
                          </button>

                          <span className="w-7 text-center text-sm font-black text-slate-900 dark:text-white tabular-nums">
                            {splitQty}
                          </span>

                          <button
                            type="button"
                            disabled={splitQty >= item.quantity}
                            onClick={() => handleChangeQty(item, 1)}
                            className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-[#2CA01C] transition active:scale-90 disabled:opacity-30 cursor-pointer"
                          >
                            <IconPlus size={20} stroke={2.5} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="py-8 text-center text-xs text-slate-400 italic">
                  {t("tables.no_items_in_order", "No ordered items found on this table")}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0 bg-slate-50/70 dark:bg-zinc-850/60">
              <div>
                <p className="text-xs font-bold text-slate-500">
                  {selectedCount} item(s) in Check #2
                </p>
                {splitItemsTotal > 0 && (
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {currency}
                    {splitItemsTotal % 1 === 0 ? splitItemsTotal.toLocaleString() : splitItemsTotal.toFixed(2)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-[44px] px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition cursor-pointer"
                >
                  {t("common.cancel", "Cancel")}
                </button>
                <button
                  type="button"
                  disabled={selectedCount === 0 || isSubmitting}
                  onClick={handleConfirmItemSplit}
                  className="h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition active:scale-95 disabled:opacity-40 flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? <IconLoader2 size={16} className="animate-spin" /> : <IconReceiptTax size={16} />}
                  <span>{t("tables.create_split_check", "Create Check #2")}</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Tab 2: Equal Share Split */
          <div className="p-6 space-y-6">
            <div className="text-center space-y-2">
              <p className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                {t("tables.split_between_guests", "Split Total Between Guests")}
              </p>

              <div className="flex items-center justify-center gap-4 py-2">
                <button
                  type="button"
                  disabled={splitPersons <= 2}
                  onClick={() => setSplitPersons((p) => Math.max(2, p - 1))}
                  className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 flex items-center justify-center text-slate-700 dark:text-white transition active:scale-90 disabled:opacity-30 cursor-pointer shadow-xs"
                >
                  <IconMinus size={20} />
                </button>

                <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700">
                  <IconUsers size={22} className="text-emerald-600" />
                  <span className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                    {splitPersons}
                  </span>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Guests</span>
                </div>

                <button
                  type="button"
                  disabled={splitPersons >= 20}
                  onClick={() => setSplitPersons((p) => Math.min(20, p + 1))}
                  className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 flex items-center justify-center text-slate-700 dark:text-white transition active:scale-90 disabled:opacity-30 cursor-pointer shadow-xs"
                >
                  <IconPlus size={20} />
                </button>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border-2 border-emerald-200 dark:border-emerald-800 text-center space-y-1">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t("tables.each_guest_pays", "Each Guest Pays")}
              </p>
              <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {currency}
                {perPersonAmount % 1 === 0 ? perPersonAmount.toLocaleString() : perPersonAmount.toFixed(2)}
              </p>
              <p className="text-[11px] text-slate-400">
                ({currency}{totalBill.toFixed(2)} ÷ {splitPersons} people)
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-[44px] px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition cursor-pointer"
              >
                {t("common.close", "Close")}
              </button>
              <button
                type="button"
                onClick={() => {
                  onPayPartial && onPayPartial(table, perPersonAmount);
                  onClose();
                }}
                className="h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md flex items-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <IconCash size={18} />
                <span>Pay 1 Share ({currency}{perPersonAmount.toFixed(2)})</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
