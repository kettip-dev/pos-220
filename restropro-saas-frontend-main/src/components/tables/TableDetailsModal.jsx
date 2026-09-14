import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import {
  IconArmchair2,
  IconUser,
  IconReceipt2,
  IconClock,
  IconShoppingCartPlus,
  IconToolsKitchen3,
  IconX,
} from "@tabler/icons-react";

export default function TableDetailsModal({
  isOpen,
  onClose,
  table,
  currency = "$",
  onSelectForOrder = null,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!isOpen || !table) return null;

  const isOccupied = Boolean(table.active_order_id);

  const handleStartOrder = () => {
    if (onSelectForOrder) {
      onSelectForOrder(table);
      onClose();
      return;
    }
    navigate(`/dashboard/pos?table_id=${table.id}`);
    onClose();
  };

  const handleViewOrders = () => {
    navigate(`/dashboard/orders?search=${table.active_order_token || ""}`);
    onClose();
  };

  const handleViewInvoices = () => {
    navigate(`/dashboard/invoices`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-zinc-800 p-6 overflow-hidden relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 flex items-center justify-center text-gray-500 transition"
        >
          <IconX size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              isOccupied
                ? "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                : "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
            }`}
          >
            <IconArmchair2 size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {table.table_title}
              </h3>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  isOccupied
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                }`}
              >
                {isOccupied ? t("tables.occupied", "Occupied") : t("tables.available", "Available")}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {t("table_settings.floor", "Floor")}: {table.floor} •{" "}
              {t("table_settings.seating_capacity", "Capacity")}: {table.seating_capacity}{" "}
              {t("pos.person", "persons")}
            </p>
          </div>
        </div>

        {/* Occupied Details */}
        {isOccupied ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <IconReceipt2 size={16} /> {t("orders.order_id", "Active Order")}
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  #{table.active_order_token || table.active_order_id}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <IconUser size={16} /> {t("common.customer", "Customer")}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {table.customer_name || t("pos.walkin_customer", "Walk-in Customer")}
                </span>
              </div>

              {table.active_order_date && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <IconClock size={16} /> {t("orders.seated_time", "Seated Since")}
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    {moment(table.active_order_date).fromNow()}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-gray-200 dark:border-zinc-700 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("orders.current_total", "Current Total")} ({table.order_items_count || 0} items)
                </span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {currency}
                  {Number(table.order_total || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={handleStartOrder}
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
              >
                <IconShoppingCartPlus size={16} />
                {t("tables.add_more_items", "Add More Items")}
              </button>
              <button
                onClick={handleViewOrders}
                className="py-2.5 px-3 rounded-xl border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <IconToolsKitchen3 size={16} />
                {t("tables.view_order", "View in Kitchen")}
              </button>
            </div>
            <button
              onClick={handleViewInvoices}
              className="w-full py-2.5 px-3 rounded-xl border border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <IconReceipt2 size={16} />
              {t("tables.settle_bill", "Settle Bill & Invoices")}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-center">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                {t("tables.table_is_available", "This table is currently free and ready for guests.")}
              </p>
            </div>

            <button
              onClick={handleStartOrder}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center justify-center gap-2 transition active:scale-95 shadow-md"
            >
              <IconShoppingCartPlus size={18} />
              {onSelectForOrder
                ? t("tables.select_this_table", "Select this Table")
                : t("tables.start_dine_in_order", "Start Dine-in Order")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
