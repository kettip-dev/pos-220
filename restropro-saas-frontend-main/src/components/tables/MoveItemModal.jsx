import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  IconX,
  IconArrowsLeftRight,
  IconPlus,
  IconMinus,
  IconCheck,
  IconLoader2,
  IconArmchair,
  IconSearch,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import { moveOrderItems } from "../../controllers/orders.controller";
import { formatTableTitle, formatFloorTitle } from "../../helpers/TableHelper";

export default function MoveItemModal({
  isOpen,
  onClose,
  sourceTable,
  activeOrderSummary,
  tables = [],
  currency = "$",
  onSuccess,
}) {
  const { t } = useTranslation();
  const [destinationTableId, setDestinationTableId] = useState("");
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [tableSearch, setTableSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState({}); // { [itemId]: quantityToMove }
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Flatten active items from order summary
  const orderItems = useMemo(() => {
    if (!activeOrderSummary?.orders) return [];
    return activeOrderSummary.orders
      .flatMap((o) => o.items || [])
      .filter((i) => i.status !== "cancelled");
  }, [activeOrderSummary]);

  // Destination tables (excluding source table)
  const candidateTables = useMemo(() => {
    if (!sourceTable) return [];
    return tables.filter((t) => {
      if (String(t.id) === String(sourceTable.id)) return false;
      if (selectedFloor !== "all" && String(t.floor) !== String(selectedFloor)) return false;
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase().trim();
        const matchTitle = String(t.table_title || "").toLowerCase().includes(q);
        if (!matchTitle) return false;
      }
      return true;
    });
  }, [tables, sourceTable, selectedFloor, tableSearch]);

  // Available floors from candidate tables
  const floors = useMemo(() => {
    const set = new Set();
    tables.forEach((t) => {
      if (t.floor !== undefined && t.floor !== null) set.add(String(t.floor));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [tables]);

  // Destination table object
  const destinationTable = useMemo(() => {
    if (!destinationTableId) return null;
    return tables.find((t) => String(t.id) === String(destinationTableId)) || null;
  }, [tables, destinationTableId]);

  // Initialize selected items (default all selected for fast 1-tap transfer)
  React.useEffect(() => {
    if (isOpen && orderItems.length > 0) {
      const initial = {};
      orderItems.forEach((item) => {
        initial[item.id] = Number(item.quantity || 1);
      });
      setSelectedItems(initial);
      setDestinationTableId("");
      setTableSearch("");
      setSelectedFloor("all");
    }
  }, [isOpen, orderItems]);

  if (!isOpen || !sourceTable) return null;

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

  const handleConfirmMove = async () => {
    if (!destinationTableId) {
      toast.error(t("tables.select_dest_table_first", "Please select a destination table"));
      return;
    }

    const itemsPayload = Object.entries(selectedItems).map(([id, quantity]) => ({
      id: Number(id),
      quantity: Number(quantity),
    }));

    if (itemsPayload.length === 0) {
      toast.error(t("tables.select_at_least_one_item", "Please select at least one item to transfer"));
      return;
    }

    try {
      setIsSubmitting(true);
      toast.loading(t("tables.moving_items", "Transferring items..."));
      const sourceOrderId = sourceTable.active_order_id;
      const res = await moveOrderItems(sourceOrderId, destinationTableId, itemsPayload);
      toast.dismiss();

      if (res?.status === 200) {
        toast.success(
          t(
            "tables.items_moved_success",
            `Transferred ${itemsPayload.length} item(s) to ${formatTableTitle(destinationTable?.table_title, t("tables.table", "Table"))}`
          )
        );
        onSuccess && onSuccess();
        onClose();
      }
    } catch (err) {
      toast.dismiss();
      console.error(err);
      toast.error(err?.response?.data?.message || t("common.error", "Failed to move items"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = Object.keys(selectedItems).length;
  const selectedTotal = orderItems.reduce((acc, item) => {
    const qty = selectedItems[item.id] || 0;
    const unitPrice = Number(item.variant_price || item.price || 0);
    return acc + unitPrice * qty;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 animate-fade-in select-none">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden max-h-[90vh]">
        {/* 1. Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-zinc-850/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0ea5e9]/10 text-[#0284c7] dark:text-sky-300 flex items-center justify-center shrink-0 border border-[#0ea5e9]/20">
              <IconArrowsLeftRight size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {t("tables.move_line_item", "Move Order Items")}
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#0ea5e9]/10 text-[#0284c7] dark:text-sky-300 font-extrabold border border-[#0ea5e9]/20">
                  {formatTableTitle(sourceTable.table_title, t("tables.table", "Table"))}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t("tables.move_item_desc", "Select items and tap the target table to transfer")}
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

        {/* 2. Destination Table Touch Selector */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-850/40 shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-wider uppercase text-slate-500">
              {t("tables.select_dest_table_label", "1. Destination Table")}
              {destinationTable && (
                <span className="ml-2 text-[#0284c7] dark:text-sky-400 font-black normal-case">
                  &rarr; {formatTableTitle(destinationTable.table_title, t("tables.table", "Table"))} ({formatFloorTitle(destinationTable.floor, t("tables.floor", "Floor"))})
                </span>
              )}
            </span>

            {/* Quick floor tabs */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedFloor("all")}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  selectedFloor === "all"
                    ? "bg-[#0ea5e9] text-white"
                    : "bg-slate-200/70 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300"
                }`}
              >
                All
              </button>
              {floors.map((fl) => (
                <button
                  key={fl}
                  type="button"
                  onClick={() => setSelectedFloor(fl)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                    selectedFloor === fl
                      ? "bg-[#0ea5e9] text-white"
                      : "bg-slate-200/70 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300"
                  }`}
                >
                  F{fl}
                </button>
              ))}
            </div>
          </div>

          {/* Visual Table Pill Scroll Track */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {candidateTables.length > 0 ? (
              candidateTables.map((tbl) => {
                const isSelected = String(destinationTableId) === String(tbl.id);
                const isOccupied = Boolean(tbl.active_order_id);

                return (
                  <button
                    key={tbl.id}
                    type="button"
                    onClick={() => setDestinationTableId(tbl.id)}
                    className={`h-[44px] min-w-[108px] px-3 rounded-xl border-2 flex items-center justify-between gap-2 shrink-0 transition-all cursor-pointer ${
                      isSelected
                        ? "border-[#0ea5e9] bg-[#0ea5e9]/10 text-[#0284c7] dark:text-sky-300 ring-2 ring-[#0ea5e9]/30"
                        : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 hover:border-slate-400"
                    }`}
                  >
                    <div className="text-left leading-tight">
                      <p className="text-xs font-black">{formatTableTitle(tbl.table_title, t("tables.table", "Table"))}</p>
                      <p className="text-[10px] text-slate-400">
                        {isOccupied ? "Occupied" : "Available"}
                      </p>
                    </div>

                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isOccupied ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                    />
                  </button>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 italic py-1">No destination tables found</p>
            )}
          </div>
        </div>

        {/* 3. Items Selection Header */}
        <div className="px-5 py-2.5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-900">
          <span className="text-[11px] font-extrabold tracking-wider uppercase text-slate-500">
            {t("tables.select_items_to_move", "2. Select Items to Move")} ({selectedCount}/{orderItems.length})
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-bold text-[#0ea5e9] hover:underline cursor-pointer"
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

        {/* 4. Items List */}
        <div className="p-5 overflow-y-auto max-h-72 space-y-2.5">
          {orderItems.length > 0 ? (
            orderItems.map((item) => {
              const isChecked = selectedItems[item.id] !== undefined;
              const moveQty = selectedItems[item.id] || item.quantity || 1;
              const itemName = item.item_title || item.title || "Item";
              const unitPrice = Number(item.variant_price || item.price || 0);

              return (
                <div
                  key={item.id}
                  onClick={() => handleToggleItem(item)}
                  className={`p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    isChecked
                      ? "border-[#0ea5e9] bg-[#0ea5e9]/5 dark:bg-sky-950/20 shadow-xs"
                      : "border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-850 hover:border-slate-300"
                  }`}
                >
                  {/* Left: Custom Tactile Checkbox + Item Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isChecked
                          ? "bg-[#0ea5e9] border-[#0ea5e9] text-white"
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
                        <span className="text-xs font-extrabold text-[#0284c7] dark:text-sky-400">
                          {currency}
                          {unitPrice % 1 === 0 ? unitPrice.toLocaleString() : unitPrice.toFixed(2)}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          • Total ordered: {item.quantity}x
                        </span>
                        {item.variant_title && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-slate-300 rounded">
                            {item.variant_title}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Tablet-Sized Touch Stepper */}
                  {isChecked && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-1 shrink-0 shadow-2xs"
                    >
                      <button
                        type="button"
                        disabled={moveQty <= 1}
                        onClick={() => handleChangeQty(item, -1)}
                        className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-red-500 transition active:scale-90 disabled:opacity-30 cursor-pointer"
                      >
                        <IconMinus size={20} stroke={2.5} />
                      </button>

                      <span className="w-7 text-center text-sm font-black text-slate-900 dark:text-white tabular-nums">
                        {moveQty}
                      </span>

                      <button
                        type="button"
                        disabled={moveQty >= item.quantity}
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

        {/* 5. Footer with Selection Value Summary & Action Button */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0 bg-slate-50/70 dark:bg-zinc-850/60">
          <div>
            <p className="text-xs font-bold text-slate-500">
              {selectedCount} item(s) selected
            </p>
            {selectedTotal > 0 && (
              <p className="text-sm font-black text-slate-900 dark:text-white">
                {currency}
                {selectedTotal % 1 === 0 ? selectedTotal.toLocaleString() : selectedTotal.toFixed(2)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-[44px] px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              {t("common.cancel", "Cancel")}
            </button>

            <button
              type="button"
              disabled={selectedCount === 0 || !destinationTableId || isSubmitting}
              onClick={handleConfirmMove}
              className="h-[44px] px-5 rounded-xl bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-black shadow-md transition active:scale-95 disabled:opacity-40 flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : (
                <IconArrowsLeftRight size={16} />
              )}
              <span>
                {destinationTable
                  ? `Transfer to ${formatTableTitle(destinationTable.table_title, t("tables.table", "Table"))}`
                  : t("tables.confirm_move_items", "Transfer Items")}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
