import React, { useState } from "react";
import {
  IconLink,
  IconUnlink,
  IconArrowsExchange,
  IconReceipt2,
  IconAlertCircle,
  IconX,
  IconCheck,
  IconArrowRight,
  IconSplit,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { formatTableTitle } from "../../helpers/TableHelper";

export default function MergeTableModal({
  isOpen,
  onClose,
  mode = "merge_orders", // "merge_orders" | "link_empty" | "unlink"
  sourceTable,
  targetTable,
  currency = "$",
  onConfirmMerge,
  onConfirmUnlink,
  onOpenSplitCheck,
  isSubmitting = false,
}) {
  const { t } = useTranslation();
  const [swapped, setSwapped] = useState(false);

  if (!isOpen || !sourceTable || !targetTable) return null;

  // Compute master vs secondary based on swap state
  const master = swapped ? targetTable : sourceTable;
  const secondary = swapped ? sourceTable : targetTable;

  const masterTotal = Number(master.active_order_total || master.order_total || 0);
  const secondaryTotal = Number(secondary.active_order_total || secondary.order_total || 0);
  const combinedTotal = (masterTotal + secondaryTotal).toFixed(2);

  const hasMasterOrder = Boolean(master.active_order_id);
  const hasSecondaryOrder = Boolean(secondary.active_order_id);

  const handleSwap = () => {
    setSwapped((prev) => !prev);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-800/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                mode === "unlink"
                  ? "bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400"
                  : "bg-sky-100 dark:bg-sky-950/60 text-[#0ea5e9] dark:text-sky-400"
              }`}
            >
              {mode === "unlink" ? <IconUnlink size={20} /> : <IconLink size={20} />}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {mode === "unlink"
                  ? t("tables.unlink_tables_title", "Unlink Tables")
                  : mode === "merge_orders"
                  ? t("tables.merge_orders_title", "Merge Orders & Link Tables")
                  : t("tables.link_tables_title", "Link Floor Tables")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {mode === "unlink"
                  ? t("tables.unlink_tables_desc", "Separate linked tables and restore independent operation")
                  : t("tables.merge_tables_desc", "Combine guest checks into a shared master ticket")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {mode === "unlink" ? (
            /* UNLINK WORKFLOW */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-750 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                    {t("tables.currently_linked", "Currently Linked")}
                  </span>
                  <span className="text-base font-extrabold text-slate-800 dark:text-white">
                    {formatTableTitle(sourceTable.table_title, t("tables.table", "Table"))} +{" "}
                    {formatTableTitle(targetTable.table_title, t("tables.table", "Table"))}
                  </span>
                </div>
                {(hasMasterOrder || hasSecondaryOrder) && (
                  <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                    {currency}
                    {combinedTotal}
                  </span>
                )}
              </div>

              {(hasMasterOrder || hasSecondaryOrder) ? (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-200">
                  <IconAlertCircle size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <p>
                    {t(
                      "tables.unlink_with_active_order_notice",
                      "These tables currently have an active shared order. You can split items back to separate checks, or keep all items on the master table."
                    )}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-600 dark:text-zinc-400">
                  {t(
                    "tables.unlink_empty_confirm",
                    "Do you want to unlink these tables? Both tables will be freely available on the floor plan."
                  )}
                </p>
              )}
            </div>
          ) : (
            /* MERGE / LINK WORKFLOW */
            <div className="space-y-4">
              {/* Table Pair Visual Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
                {/* Secondary Table (Will be merged INTO master) */}
                <div className="p-4 rounded-2xl border-2 border-slate-200 dark:border-zinc-750 bg-slate-50/60 dark:bg-zinc-800/40 flex flex-col justify-between relative">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 inline-block mb-1">
                      {hasSecondaryOrder ? t("tables.secondary_merging", "Merging into Master") : t("tables.secondary_table", "Secondary Table")}
                    </span>
                    <h4 className="text-base font-extrabold text-slate-800 dark:text-white truncate">
                      {formatTableTitle(secondary.table_title, t("tables.table", "Table"))}
                    </h4>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-750 flex items-center justify-between text-xs">
                    {hasSecondaryOrder ? (
                      <>
                        <span className="text-slate-500 dark:text-zinc-400 font-bold">
                          {t("orders.order", "Order")} #{secondary.active_order_token || secondary.active_order_id}
                        </span>
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {currency}
                          {secondaryTotal.toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400 dark:text-zinc-500 font-medium italic">
                        {t("tables.available", "Available / Empty")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Master Destination Table */}
                <div className="p-4 rounded-2xl border-2 border-sky-400 dark:border-sky-600 bg-sky-50/50 dark:bg-sky-950/20 flex flex-col justify-between relative shadow-xs">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-sky-500 text-white inline-block mb-1">
                      {t("tables.master_table", "Master Destination")}
                    </span>
                    <h4 className="text-base font-extrabold text-sky-950 dark:text-sky-100 truncate">
                      {formatTableTitle(master.table_title, t("tables.table", "Table"))}
                    </h4>
                  </div>
                  <div className="mt-3 pt-3 border-t border-sky-200 dark:border-sky-800/60 flex items-center justify-between text-xs">
                    {hasMasterOrder ? (
                      <>
                        <span className="text-sky-700 dark:text-sky-300 font-bold">
                          {t("orders.order", "Order")} #{master.active_order_token || master.active_order_id}
                        </span>
                        <span className="font-extrabold text-sky-950 dark:text-white">
                          {currency}
                          {masterTotal.toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <span className="text-sky-600/70 dark:text-sky-400/70 font-medium italic">
                        {t("tables.available", "Available / Empty")}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Swap roles button */}
              {(hasMasterOrder && hasSecondaryOrder) && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleSwap}
                    className="min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <IconArrowsExchange size={16} />
                    <span>{t("tables.swap_master_table", "Swap Master Table Direction")}</span>
                  </button>
                </div>
              )}

              {/* Combined Bill Summary Card */}
              {mode === "merge_orders" && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                      <IconReceipt2 size={16} />
                      {t("tables.combined_order_total", "New Combined Order Total")}
                    </span>
                    <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                      {currency}
                      {combinedTotal}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 leading-tight">
                    {t(
                      "tables.merge_orders_notice",
                      "All open items from {{secondary}} will be transferred into Order #{{token}} under {{master}}. Both tables will remain occupied together.",
                      {
                        secondary: secondary.table_title,
                        token: master.active_order_token || master.active_order_id,
                        master: master.table_title,
                      }
                    )}
                  </p>
                </div>
              )}

              {mode === "link_empty" && (
                <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/40 text-xs text-sky-800 dark:text-sky-200 flex items-start gap-2.5">
                  <IconLink size={18} className="shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
                  <p>
                    {t(
                      "tables.link_empty_notice",
                      "Linking {{secondary}} to {{master}} will share the current tab and mark both tables as seated for the same group.",
                      {
                        secondary: secondary.table_title,
                        master: master.table_title,
                      }
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Action Buttons Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-800/40 shrink-0 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-200 transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {t("common.cancel", "Cancel")}
          </button>

          {mode === "unlink" ? (
            <>
              {(hasMasterOrder || hasSecondaryOrder) && onOpenSplitCheck && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSplitCheck && onOpenSplitCheck(master, secondary);
                  }}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <IconSplit size={16} />
                  <span>{t("tables.split_items_back", "Split Items Back")}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onConfirmUnlink(sourceTable, targetTable)}
                disabled={isSubmitting}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <IconUnlink size={16} />
                <span>
                  {hasMasterOrder || hasSecondaryOrder
                    ? t("tables.unlink_keep_master", "Unlink (Keep on Master)")
                    : t("tables.confirm_unlink", "Unlink Tables")}
                </span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onConfirmMerge(secondary, master)}
              disabled={isSubmitting}
              className={`w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl text-white text-xs font-bold shadow-md transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 ${
                mode === "merge_orders"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-[#0ea5e9] hover:bg-sky-600"
              }`}
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <IconCheck size={16} />
              )}
              <span>
                {mode === "merge_orders"
                  ? t("tables.confirm_merge_orders", "Confirm & Merge Orders")
                  : t("tables.confirm_link_tables", "Confirm Link Tables")}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
