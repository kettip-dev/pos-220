import React, { useState, useMemo } from "react";
import Page from "../components/Page";
import { Link, useNavigate } from "react-router-dom";
import {
  IconArrowLeft,
  IconSearch,
  IconTrash,
  IconCheck,
  IconDeviceFloppy,
  IconTruckDelivery,
  IconAlertCircle,
  IconBuildingStore,
  IconTruck,
  IconPlus,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import {
  useTransferBranches,
  useInventoryItems,
  createStockTransfer,
} from "../controllers/inventory.controller";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import useConfirm from "../hooks/useConfirm";

export default function AddStockTransferPage() {
  const { t } = useTranslation();
  const [confirm, ConfirmDialog] = useConfirm();
  const navigate = useNavigate();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [toTenantId, setToTenantId] = useState("");
  const [transferDate, setTransferDate] = useState(todayStr);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available branches
  const { branches, isLoading: isBranchesLoading } = useTransferBranches();

  // Selected items list
  const [items, setItems] = useState([]);

  // Item catalog from sender branch
  const [itemSearch, setItemSearch] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const { data: inventoryData, isLoading: isCatalogLoading } = useInventoryItems({ status: "all" });
  const allCatalogItems = useMemo(() => {
    if (Array.isArray(inventoryData)) return inventoryData;
    return inventoryData?.items || inventoryData?.inventory || [];
  }, [inventoryData]);

  // Filter catalog items
  const filteredCatalog = useMemo(() => {
    if (!itemSearch.trim()) return allCatalogItems.filter(it => parseFloat(it.quantity || 0) > 0).slice(0, 10);
    const q = itemSearch.toLowerCase().trim();
    return allCatalogItems
      .filter((it) => it.title?.toLowerCase().includes(q) || it.unit?.toLowerCase().includes(q))
      .slice(0, 15);
  }, [allCatalogItems, itemSearch]);

  // Add item
  const handleAddItem = (item) => {
    if (items.some((it) => it.from_item_id === item.id)) {
      toast.error(`"${item.title}" is already in this transfer.`);
      return;
    }

    const availableStock = parseFloat(item.quantity || 0);
    if (availableStock <= 0) {
      toast.error(`"${item.title}" has 0 stock available to transfer.`);
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        from_item_id: item.id,
        item_title: item.title,
        unit: item.unit,
        available_stock: availableStock,
        quantity_sent: 1,
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

  // Change quantity sent
  const handleQtySentChange = (index, value) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, quantity_sent: value } : it))
    );
  };

  // Change line note
  const handleLineNoteChange = (index, value) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, note: value } : it))
    );
  };

  // Total quantity
  const totalQuantity = useMemo(() => {
    let sum = 0;
    items.forEach((it) => {
      sum += parseFloat(it.quantity_sent || 0);
    });
    return Math.round(sum * 1000) / 1000;
  }, [items]);

  // Submit transfer
  const handleSubmit = async (submitStatus) => {
    if (!toTenantId) {
      toast.error(t("stock_transfers.select_branch_placeholder", "Please select a destination branch."));
      return;
    }

    if (items.length === 0) {
      toast.error(t("stock_transfers.select_item_placeholder", "Please add at least one item to transfer."));
      return;
    }

    // Validate quantities
    for (const it of items) {
      const q = parseFloat(it.quantity_sent);
      if (isNaN(q) || q <= 0) {
        toast.error(`Quantity for "${it.item_title}" must be greater than zero.`);
        return;
      }
      if (submitStatus === "in_transit" && q > it.available_stock) {
        toast.error(`Cannot send ${q} ${it.unit} of "${it.item_title}". Only ${it.available_stock} available.`);
        return;
      }
    }

    if (submitStatus === "in_transit") {
      const destBranchName = branches.find((b) => String(b.id) === String(toTenantId))?.name || "destination branch";
      const confirmMsg = t("stock_transfers.confirm_dispatch", {
        branch: destBranchName,
        defaultValue: 'Dispatch this transfer to "{{branch}}"? Items will be deducted from your branch inventory immediately.',
      });
      if (!(await confirm({ title: t("stock_transfers.dispatch_title", "Dispatch Transfer"), description: confirmMsg, confirmText: t("stock_transfers.dispatch_action", "Dispatch"), tone: "primary" }))) return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(t("toast.please_wait", "Please wait..."));

    try {
      const payload = {
        to_tenant_id: toTenantId,
        transfer_date: transferDate,
        status: submitStatus,
        notes,
        items: items.map((it) => ({
          from_item_id: it.from_item_id,
          item_title: it.item_title,
          unit: it.unit,
          quantity_sent: parseFloat(it.quantity_sent),
          note: it.note,
        })),
      };

      await createStockTransfer(payload);
      toast.success(
        submitStatus === "in_transit"
          ? t("stock_transfers.status_in_transit", "Transfer dispatched!")
          : t("stock_transfers.status_draft", "Draft transfer saved!"),
        { id: toastId }
      );
      navigate("/dashboard/inventory/transfers");
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
            to="/dashboard/inventory/transfers"
            className="min-h-[42px] min-w-[42px] rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-700 flex items-center justify-center transition active:scale-95 shadow-sm"
          >
            <IconArrowLeft size={20} stroke={iconStroke} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <IconTruck className="text-emerald-600 dark:text-emerald-400" size={26} stroke={iconStroke} />
              {t("stock_transfers.add_title", "Add Stock Transfer")}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {t("stock_transfers.add_subtitle", "Dispatch stock to another branch within your restaurant group.")}
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
            <span>{t("stock_transfers.save_draft_btn", "Save as Draft")}</span>
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit("in_transit")}
            className="min-h-[42px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 text-sm font-semibold transition active:scale-95 shadow-sm shadow-emerald-600/20 disabled:opacity-50"
          >
            <IconTruckDelivery size={18} stroke={iconStroke} />
            <span>{t("stock_transfers.dispatch_btn", "Dispatch Transfer")}</span>
          </button>
        </div>
      </div>

      {/* Transfer Route & Details Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-800/90 border border-slate-200/80 dark:border-neutral-700/80 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <IconBuildingStore size={18} className="text-emerald-600" />
          {t("stock_transfers.details_heading", "Transfer Destination & Schedule")}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Destination Branch */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t("stock_transfers.to_branch", "Destination Branch")} *
            </label>
            <select
              value={toTenantId}
              onChange={(e) => setToTenantId(e.target.value)}
              className="w-full min-h-[42px] px-3.5 text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50/50 dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
            >
              <option value="">{t("stock_transfers.select_branch_placeholder", "-- Select destination branch --")}</option>
              {(branches || []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.branch_code ? `(${b.branch_code})` : ""} {b.is_main_branch ? "★ Main" : ""}
                </option>
              ))}
            </select>
            {!isBranchesLoading && (branches || []).length === 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                {t("stock_transfers.no_branches_warning", "No other branches found in this business group.")}
              </p>
            )}
          </div>

          {/* Transfer Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t("stock_transfers.transfer_date", "Transfer Date")} *
            </label>
            <input
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              className="w-full min-h-[42px] px-3.5 text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50/50 dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Transfer Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t("stock_adjustments.notes", "Waybill Notes / Vehicle No")}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("stock_transfers.notes_placeholder", "e.g. Delivery Van A, Driver John, Refrigerator Box...")}
              className="w-full min-h-[42px] px-3.5 text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50/50 dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>
      </div>

      {/* Transfer Items Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-800/90 border border-slate-200/80 dark:border-neutral-700/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
              {t("stock_transfers.items_heading", "Items to Transfer")} ({items.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {t("stock_transfers.transfer_hint", "Items will be deducted from this store upon dispatch and credited to the destination branch on receipt.")}
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
                placeholder={t("stock_transfers.select_item_placeholder", "Search item to transfer...")}
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
                    <div className="p-4 text-xs text-center text-slate-400">{t("common.no_records_found", "No items available")}</div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 dark:bg-neutral-900/80 sticky top-0 border-b border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold z-10">
                          <tr>
                            <th className="py-2.5 px-3.5">{t("stock_transfers.table_item", "Item Name")}</th>
                            <th className="py-2.5 px-3 text-center w-20">{t("stock_transfers.unit", "Unit")}</th>
                            <th className="py-2.5 px-3.5 text-right w-28">{t("stock_transfers.table_available_stock", "Available")}</th>
                            <th className="py-2.5 px-3 text-center w-16"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-neutral-700/60">
                          {filteredCatalog.map((item) => {
                            const availQty = parseFloat(item.quantity || 0);
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
                                  <span className="text-emerald-600 dark:text-emerald-400">
                                    {availQty}
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

        {/* Items Table */}
        {items.length === 0 ? (
          <div className="py-10 px-4 border-2 border-dashed border-slate-200 dark:border-neutral-700/80 rounded-2xl text-center text-slate-400 space-y-3">
            <IconAlertCircle className="mx-auto text-slate-300 dark:text-neutral-600" size={32} />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t("stock_transfers.no_transfers_found", "No items added yet.")}</p>
            <p className="text-xs">{t("stock_transfers.select_item_hint", "Search and select items from your branch inventory to dispatch, or click below:")}</p>

            {(allCatalogItems || []).filter(ci => parseFloat(ci.quantity || 0) > 0).length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto pt-2">
                {(allCatalogItems || []).filter(ci => parseFloat(ci.quantity || 0) > 0).slice(0, 10).map((catItem) => (
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
                  <th className="py-3 px-4 font-semibold">{t("stock_transfers.table_item", "Item & Unit")}</th>
                  <th className="py-3 px-4 font-semibold text-center w-32">{t("stock_transfers.table_available_stock", "Available Stock")}</th>
                  <th className="py-3 px-4 font-semibold text-center w-36">{t("stock_transfers.table_qty_to_send", "Quantity to Send")}</th>
                  <th className="py-3 px-4 font-semibold">{t("stock_adjustments.table_notes", "Notes")}</th>
                  <th className="py-3 px-4 font-semibold text-right w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-700/60 text-slate-700 dark:text-slate-200">
                {items.map((it, idx) => {
                  const qty = parseFloat(it.quantity_sent) || 0;
                  const isExceeding = qty > it.available_stock;

                  return (
                    <tr key={it.from_item_id} className="hover:bg-slate-50/50 dark:hover:bg-neutral-800/50 transition">
                      {/* Item */}
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                        {it.item_title}
                        <span className="block text-xs font-normal text-slate-400">Unit: {it.unit}</span>
                      </td>

                      {/* Available Stock */}
                      <td className="py-3 px-4 text-center font-mono font-medium text-slate-600 dark:text-slate-300">
                        {it.available_stock}
                      </td>

                      {/* Quantity to send */}
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          max={it.available_stock}
                          value={it.quantity_sent}
                          onChange={(e) => handleQtySentChange(idx, e.target.value)}
                          className={`w-full min-h-[42px] px-3 text-center text-sm font-mono font-bold rounded-xl border bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                            isExceeding
                              ? "border-rose-500 text-rose-600 focus:ring-rose-500/20"
                              : "border-slate-200 dark:border-neutral-700 text-emerald-600 dark:text-emerald-400"
                          }`}
                        />
                      </td>

                      {/* Line note */}
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={it.note}
                          onChange={(e) => handleLineNoteChange(idx, e.target.value)}
                          placeholder={t("stock_transfers.line_note_placeholder", "Batch no, expiration, or storage instruction...")}
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
          <div className="pt-4 border-t border-slate-200 dark:border-neutral-700/80 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-500">
              {t("stock_transfers.total_items", "Total Items")}: <span className="text-slate-900 dark:text-white font-mono text-sm">{items.length}</span>
            </span>

            <div className="text-sm">
              <span className="text-slate-500 mr-2">{t("stock_transfers.total_quantity", "Total Units to Transfer")}:</span>
              <span className="font-bold font-mono text-base text-emerald-600 dark:text-emerald-400">
                {totalQuantity}
              </span>
            </div>
          </div>
        )}
      </div>
      <ConfirmDialog />
    </Page>
  );
}
