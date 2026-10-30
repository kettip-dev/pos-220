import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  IconX,
  IconArrowsExchange,
  IconSearch,
  IconCheck,
  IconLoader2,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import { transferTableOrder } from "../../controllers/orders.controller";
import { formatTableTitle, formatFloorTitle } from "../../helpers/TableHelper";

export default function MoveTableModal({
  isOpen,
  onClose,
  sourceTable,
  tables = [],
  onSuccess,
}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [destinationTableId, setDestinationTableId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available floors
  const floors = useMemo(() => {
    const set = new Set();
    tables.forEach((tbl) => {
      if (tbl.floor !== undefined && tbl.floor !== null) set.add(String(tbl.floor));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [tables]);

  // Candidates for destination table (all tables except source)
  const candidateTables = useMemo(() => {
    if (!sourceTable) return [];
    return tables.filter((t) => {
      if (String(t.id) === String(sourceTable.id)) return false;
      if (selectedFloor !== "all" && String(t.floor) !== String(selectedFloor)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = String(t.table_title || "").toLowerCase().includes(q);
        if (!titleMatch) return false;
      }
      return true;
    });
  }, [tables, sourceTable, selectedFloor, searchQuery]);

  const destinationTable = useMemo(() => {
    if (!destinationTableId) return null;
    return tables.find((t) => String(t.id) === String(destinationTableId)) || null;
  }, [tables, destinationTableId]);

  if (!isOpen || !sourceTable) return null;

  const handleConfirmTransfer = async () => {
    if (!destinationTableId) {
      toast.error(t("tables.select_dest_table_first", "Please select a destination table first"));
      return;
    }

    const destTable = tables.find((t) => String(t.id) === String(destinationTableId));
    if (!destTable) return;

    try {
      setIsSubmitting(true);
      toast.loading(t("tables.moving_table", `Moving order from ${formatTableTitle(sourceTable.table_title, t("tables.table", "Table"))} to ${formatTableTitle(destTable.table_title, t("tables.table", "Table"))}...`));
      const res = await transferTableOrder(sourceTable.id, destinationTableId);
      toast.dismiss();

      if (res?.status === 200) {
        toast.success(res.data?.message || `Order successfully moved to ${formatTableTitle(destTable.table_title, t("tables.table", "Table"))}`);
        onSuccess && onSuccess(destTable);
        onClose();
      }
    } catch (err) {
      toast.dismiss();
      console.error(err);
      toast.error(err?.response?.data?.message || t("common.error", "Failed to move table"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 animate-fade-in select-none">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-zinc-850/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0ea5e9]/10 text-[#0284c7] dark:text-sky-300 flex items-center justify-center shrink-0 border border-[#0ea5e9]/20">
              <IconArrowsExchange size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {t("tables.move_table", "Move Entire Table Order")}
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#0ea5e9]/10 text-[#0284c7] dark:text-sky-300 font-extrabold border border-[#0ea5e9]/20">
                  {formatTableTitle(sourceTable.table_title, t("tables.table", "Table"))}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t("tables.move_table_desc", "Transfer the full tab and open items to another table")}
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

        {/* Search & Floor Filters */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-zinc-800 flex flex-wrap items-center gap-2 shrink-0 bg-slate-50/40 dark:bg-zinc-850/40">
          <div className="relative flex-1 min-w-[140px]">
            <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("tables.search_table", "Search table title...")}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedFloor("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedFloor === "all"
                  ? "bg-[#0ea5e9] text-white"
                  : "bg-slate-200/70 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300"
              }`}
            >
              {t("tables.all_floors", "All")}
            </button>
            {floors.map((fl) => (
              <button
                key={fl}
                type="button"
                onClick={() => setSelectedFloor(fl)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
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

        {/* Destination Table Grid Selection */}
        <div className="p-5 overflow-y-auto max-h-72 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {candidateTables.length > 0 ? (
            candidateTables.map((tbl) => {
              const isSelected = String(destinationTableId) === String(tbl.id);
              const isOccupied = Boolean(tbl.active_order_id);

              return (
                <button
                  key={tbl.id}
                  type="button"
                  onClick={() => setDestinationTableId(tbl.id)}
                  className={`relative p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer text-center ${
                    isSelected
                      ? "border-[#0ea5e9] bg-[#0ea5e9]/10 ring-2 ring-[#0ea5e9]/40 shadow-sm"
                      : isOccupied
                      ? "border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-400"
                      : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/70 hover:border-slate-300"
                  }`}
                >
                  {isSelected && (
                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#0ea5e9] text-white flex items-center justify-center">
                      <IconCheck size={13} strokeWidth={3} />
                    </span>
                  )}
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    {formatTableTitle(tbl.table_title, t("tables.table", "Table"))}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {formatFloorTitle(tbl.floor, t("tables.floor", "Floor"))} • {tbl.seating_capacity || 2} {Number(tbl.seating_capacity) === 1 ? t("tables.seat", "Seat") : t("tables.seats", "Seats")}
                  </span>
                  <span
                    className={`mt-1 text-[9px] font-black px-2 py-0.5 rounded-full ${
                      isOccupied
                        ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                        : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    {isOccupied ? "Occupied (Combine)" : "Available"}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="col-span-full py-8 text-center text-xs text-slate-400">
              {t("tables.no_destination_tables", "No available destination tables found")}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0 bg-slate-50/70 dark:bg-zinc-850/60">
          <span className="text-xs text-slate-500 font-bold">
            {destinationTable ? (
              <span className="text-[#0284c7] dark:text-sky-400 font-extrabold">
                Transfer &rarr; {formatTableTitle(destinationTable.table_title, t("tables.table", "Table"))}
              </span>
            ) : (
              "Select a destination table above"
            )}
          </span>

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
              disabled={!destinationTableId || isSubmitting}
              onClick={handleConfirmTransfer}
              className="h-[44px] px-5 rounded-xl bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-black shadow-md transition active:scale-95 disabled:opacity-40 flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : (
                <IconArrowsExchange size={16} />
              )}
              <span>{t("tables.confirm_move", "Transfer Order Now")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
