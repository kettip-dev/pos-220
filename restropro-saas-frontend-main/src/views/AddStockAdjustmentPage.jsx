import React, { useState, useMemo } from "react";
import Page from "../components/Page";
import { Link, useNavigate } from "react-router-dom";
import {
  IconArrowLeft,
  IconPlus,
  IconSearch,
  IconTrash,
  IconCheck,
  IconDeviceFloppy,
  IconAlertCircle,
  IconDatabase,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import {
  useInventoryItems,
  createStockAdjustment,
} from "../controllers/inventory.controller";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

export default function AddStockAdjustmentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [adjustmentDate, setAdjustmentDate] = useState(todayStr);
  const [reason, setReason] = useState("physical_count");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected items list
  const [items, setItems] = useState([]);

  // Item catalog search
  const [itemSearch, setItemSearch] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const { data: inventoryData, isLoading: isCatalogLoading } = useInventoryItems({ status: "all" });
  const allCatalogItems = useMemo(() => {
    if (Array.isArray(inventoryData)) return inventoryData;
    return inventoryData?.items || inventoryData?.inventory || [];
  }, [inventoryData]);

  // Filter available items
  const filteredCatalog = useMemo(() => {
    if (!itemSearch.trim()) return allCatalogItems.slice(0, 10);
    const q = itemSearch.toLowerCase().trim();
    return allCatalogItems
      .filter((it) => it.title?.toLowerCase().includes(q) || it.unit?.toLowerCase().includes(q))
      .slice(0, 15);
  }, [allCatalogItems, itemSearch]);

  // Add item to voucher
  const handleAddItem = (item) => {
    if (items.some((it) => it.inventory_item_id === item.id)) {
      toast.error(`"${item.title}" is already in this adjustment.`);
      return;
    }

    const currentQty = parseFloat(item.quantity || 0);
    setItems((prev) => [
      ...prev,
      {
        inventory_item_id: item.id,
        item_title: item.title,
        unit: item.unit,
        current_quantity: currentQty,
        counted_quantity: currentQty, // default to match
        delta_quantity: 0,
        note: "",
      },
    ]);
    setItemSearch("");
    setIsPickerOpen(false);
  };

  // Remove item
  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Bidirectional dual-entry updates:
  // 1. Changing counted stock -> updates delta
  const handleCountedChange = (index, value) => {
    const countedVal = parseFloat(value) || 0;
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const delta = Math.round((countedVal - it.current_quantity) * 1000) / 1000;
        return {
          ...it,
          counted_quantity: value,
          delta_quantity: delta,
        };
      })
    );
  };

  // 2. Changing delta (+/-) -> updates counted stock
  const handleDeltaChange = (index, value) => {
    const deltaVal = parseFloat(value) || 0;
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const counted = Math.round((it.current_quantity + deltaVal) * 1000) / 1000;
        return {
          ...it,
          delta_quantity: value,
          counted_quantity: counted,
        };
      })
    );
  };

  // Update line note
  const handleLineNoteChange = (index, value) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, note: value } : it))
    );
  };

  // Totals
  const { totalAdditions, totalReductions, netChange } = useMemo(() => {
    let add = 0;
    let red = 0;
    items.forEach((it) => {
      const delta = parseFloat(it.delta_quantity) || 0;
      if (delta > 0) add += delta;
      else if (delta < 0) red += Math.abs(delta);
    });
    return {
      totalAdditions: Math.round(add * 1000) / 1000,
      totalReductions: Math.round(red * 1000) / 1000,
      netChange: Math.round((add - red) * 1000) / 1000,
    };
  }, [items]);

  // Submit action (Draft or Completed)
  const handleSubmit = async (submitStatus) => {
    if (items.length === 0) {
      toast.error(t("stock_adjustments.no_items_added", "Please add at least one item."));
      return;
    }

    // Validate that negative adjustments don't go below 0
    for (const it of items) {
      const finalCount = parseFloat(it.counted_quantity);
      if (finalCount < 0) {
        toast.error(`"${it.item_title}" counted stock cannot be negative.`);
        return;
      }
    }

    if (submitStatus === "completed") {
      const confirmMsg = t(
        "stock_adjustments.confirm_complete",
        "Are you sure you want to complete this adjustment? This will immediately update your inventory stock."
      );
      if (!window.confirm(confirmMsg)) return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(t("toast.please_wait", "Please wait..."));

    try {
      const payload = {
        adjustment_date: adjustmentDate,
        reason,
        status: submitStatus,
        notes,
        items: items.map((it) => ({
          inventory_item_id: it.inventory_item_id,
          item_title: it.item_title,
          unit: it.unit,
          current_quantity: it.current_quantity,
          counted_quantity: parseFloat(it.counted_quantity || 0),
          delta_quantity: parseFloat(it.delta_quantity || 0),
          note: it.note,
        })),
      };

      await createStockAdjustment(payload);
      toast.success(
        submitStatus === "completed"
          ? t("stock_adjustments.status_completed", "Adjustment completed!")
          : t("stock_adjustments.status_draft", "Draft saved!"),
        { id: toastId }
      );
      navigate("/dashboard/inventory/adjustments");
    } catch (err) {
      toast.error(err.response?.data?.message || err.message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Page className="px-4 py-4 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/inventory/adjustments"
            className="min-h-[42px] min-w-[42px] rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-700 flex items-center justify-center transition active:scale-95 shadow-sm"
          >
            <IconArrowLeft size={20} stroke={iconStroke} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <IconDatabase className="text-emerald-600 dark:text-emerald-400" size={26} stroke={iconStroke} />
              {t("stock_adjustments.add_title", "Add Stock Adjustment")}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {t("stock_adjustments.add_subtitle", "Record physical counts or manual quantity corrections for items.")}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit("draft")}
            className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-700 flex items-center gap-2 text-sm font-medium transition active:scale-95 shadow-sm disabled:opacity-50"
          >
            <IconDeviceFloppy size={18} stroke={iconStroke} />
            <span>{t("stock_adjustments.save_draft_btn", "Save as Draft")}</span>
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit("completed")}
            className="min-h-[42px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 text-sm font-semibold transition active:scale-95 shadow-sm shadow-emerald-600/20 disabled:opacity-50"
          >
            <IconCheck size={18} stroke={iconStroke} />
            <span>{t("stock_adjustments.complete_btn", "Complete Adjustment")}</span>
          </button>
        </div>
      </div>

      {/* Adjustment Voucher Info Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-800/90 border border-slate-200/80 dark:border-neutral-700/80 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
          {t("stock_adjustments.details_heading", "Adjustment Details")}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Adjustment Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t("stock_adjustments.adjustment_date", "Adjustment Date")} *
            </label>
            <input
              type="date"
              value={adjustmentDate}
              onChange={(e) => setAdjustmentDate(e.target.value)}
              className="w-full min-h-[42px] px-3.5 text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50/50 dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Adjustment Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t("stock_adjustments.reason", "Adjustment Reason")} *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full min-h-[42px] px-3.5 text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50/50 dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="physical_count">{t("stock_adjustments.reason_physical_count", "Physical Count / Audit")}</option>
              <option value="spoilage">{t("stock_adjustments.reason_spoilage", "Expired / Spoilage")}</option>
              <option value="damage">{t("stock_adjustments.reason_damage", "Damaged / Broken")}</option>
              <option value="theft_loss">{t("stock_adjustments.reason_theft_loss", "Theft / Missing")}</option>
              <option value="internal_use">{t("stock_adjustments.reason_internal_use", "Internal Kitchen Use")}</option>
              <option value="correction">{t("stock_adjustments.reason_correction", "Inventory Correction")}</option>
              <option value="other">{t("stock_adjustments.reason_other", "Other Reason")}</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t("stock_adjustments.notes", "General Notes")}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("stock_adjustments.notes_placeholder", "e.g. Monthly physical audit, walk-in cooler inspection...")}
              className="w-full min-h-[42px] px-3.5 text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50/50 dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-800/90 border border-slate-200/80 dark:border-neutral-700/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
              {t("stock_adjustments.items_heading", "Items to Adjust")} ({items.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {t("stock_adjustments.dual_entry_hint", "Dual-entry mode: Entering counted stock updates the difference automatically, and vice-versa.")}
            </p>
          </div>

          {/* Item Selector Dropdown */}
          <div className="relative w-full sm:w-80">
            <div className="relative">
              <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={itemSearch}
                onFocus={() => setIsPickerOpen(true)}
                onChange={(e) => {
                  setItemSearch(e.target.value);
                  setIsPickerOpen(true);
                }}
                placeholder={t("stock_adjustments.select_item_placeholder", "Search & add inventory item...")}
                className="w-full min-h-[42px] pl-10 pr-4 text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50/50 dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {isPickerOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsPickerOpen(false)}
                />
                <div className="absolute top-full right-0 sm:left-auto w-full sm:w-[540px] mt-1.5 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-2xl shadow-2xl z-30 overflow-hidden">
                  {isCatalogLoading ? (
                    <div className="p-4 text-xs text-center text-slate-400">{t("common.loading", "Loading catalog...")}</div>
                  ) : filteredCatalog.length === 0 ? (
                    <div className="p-4 text-xs text-center text-slate-400">{t("common.no_records_found", "No matching items found")}</div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 dark:bg-neutral-900/80 sticky top-0 border-b border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold z-10">
                          <tr>
                            <th className="py-2.5 px-3.5">{t("stock_adjustments.table_item", "Item Name")}</th>
                            <th className="py-2.5 px-3 text-center w-20">{t("stock_adjustments.unit", "Unit")}</th>
                            <th className="py-2.5 px-3.5 text-right w-28">{t("stock_adjustments.table_current_stock", "Current Stock")}</th>
                            <th className="py-2.5 px-3 text-center w-16"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-neutral-700/60">
                          {filteredCatalog.map((item) => {
                            const stockQty = parseFloat(item.quantity || 0);
                            return (
                              <tr
                                key={item.id}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleAddItem(item);
                                }}
                                className="hover:bg-emerald-50/60 dark:hover:bg-neutral-700/60 transition cursor-pointer group"
                              >
                                <td className="py-2.5 px-3.5 font-medium text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                                  {item.title}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                                    {item.unit}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3.5 text-right font-mono font-semibold">
                                  <span
                                    className={
                                      stockQty <= 0
                                        ? "text-rose-600 dark:text-rose-400"
                                        : "text-slate-800 dark:text-slate-200"
                                    }
                                  >
                                    {stockQty}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="min-h-[26px] px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white text-[11px] font-semibold transition flex items-center justify-center gap-1">
                                    <IconPlus size={12} stroke={2.5} />
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Table of items */}
        {items.length === 0 ? (
          <div className="py-10 px-4 border-2 border-dashed border-slate-200 dark:border-neutral-700/80 rounded-2xl text-center text-slate-400 space-y-3">
            <IconAlertCircle className="mx-auto text-slate-300 dark:text-neutral-600" size={32} />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t("stock_adjustments.no_items_added", "No inventory items added yet.")}</p>
            <p className="text-xs">{t("stock_adjustments.select_item_hint", "Use the search bar above or click any item below to add to adjustment:")}</p>

            {allCatalogItems.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto pt-2">
                {allCatalogItems.slice(0, 10).map((catItem) => (
                  <button
                    key={catItem.id}
                    type="button"
                    onClick={() => handleAddItem(catItem)}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                  >
                    <IconPlus size={14} />
                    <span>{catItem.title}</span>
                    <span className="text-slate-400 font-mono">({parseFloat(catItem.quantity || 0)} {catItem.unit})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-neutral-700/80">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-neutral-900/60 border-b border-slate-200 dark:border-neutral-700 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-semibold">{t("stock_adjustments.table_item", "Item & Unit")}</th>
                  <th className="py-3 px-4 font-semibold text-center w-28">{t("stock_adjustments.table_current_stock", "Current Stock")}</th>
                  <th className="py-3 px-4 font-semibold text-center w-36">{t("stock_adjustments.table_counted_stock", "Counted Stock")}</th>
                  <th className="py-3 px-4 font-semibold text-center w-36">{t("stock_adjustments.table_difference", "Difference (+/-)")}</th>
                  <th className="py-3 px-4 font-semibold">{t("stock_adjustments.table_notes", "Line Notes")}</th>
                  <th className="py-3 px-4 font-semibold text-right w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-700/60 text-slate-700 dark:text-slate-200">
                {items.map((it, idx) => {
                  const delta = parseFloat(it.delta_quantity) || 0;

                  return (
                    <tr key={it.inventory_item_id} className="hover:bg-slate-50/50 dark:hover:bg-neutral-800/50 transition">
                      {/* Title & Unit */}
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                        {it.item_title}
                        <span className="block text-xs font-normal text-slate-400">Unit: {it.unit}</span>
                      </td>

                      {/* Current Stock */}
                      <td className="py-3 px-4 text-center font-mono font-semibold text-slate-600 dark:text-slate-300">
                        {it.current_quantity}
                      </td>

                      {/* Counted Stock Input */}
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={it.counted_quantity}
                          onChange={(e) => handleCountedChange(idx, e.target.value)}
                          className="w-full min-h-[42px] px-3 text-center text-sm font-mono rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </td>

                      {/* Delta Input */}
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          step="any"
                          value={it.delta_quantity}
                          onChange={(e) => handleDeltaChange(idx, e.target.value)}
                          className={`w-full min-h-[42px] px-3 text-center text-sm font-mono font-bold rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                            delta > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : delta < 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-slate-500"
                          }`}
                        />
                      </td>

                      {/* Line note */}
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={it.note}
                          onChange={(e) => handleLineNoteChange(idx, e.target.value)}
                          placeholder={t("stock_adjustments.line_note_placeholder", "Optional note for this item...")}
                          className="w-full min-h-[42px] px-3 text-xs rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </td>

                      {/* Delete */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="min-h-[38px] min-w-[38px] rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition active:scale-95"
                        >
                          <IconTrash size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary Footer */}
        {items.length > 0 && (
          <div className="pt-4 border-t border-slate-200 dark:border-neutral-700/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold">
            <div className="flex items-center gap-6">
              <span className="text-slate-500">
                {t("stock_adjustments.total_items", "Total Items")}: <span className="text-slate-900 dark:text-white font-mono text-sm">{items.length}</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400">
                {t("stock_adjustments.additions", "Additions (+)")}: <span className="font-mono text-sm">+{totalAdditions}</span>
              </span>
              <span className="text-rose-600 dark:text-rose-400">
                {t("stock_adjustments.reductions", "Reductions (-)")}: <span className="font-mono text-sm">-{totalReductions}</span>
              </span>
            </div>

            <div className="text-sm">
              <span className="text-slate-500 mr-2">{t("stock_adjustments.net_change", "Net Difference")}:</span>
              <span className={`font-bold font-mono text-base ${netChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {netChange > 0 ? `+${netChange}` : netChange}
              </span>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
