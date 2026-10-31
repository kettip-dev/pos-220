import React, { useRef, useState } from "react";
import Page from "../components/Page";
import { IconFilter, IconArrowUpRight, IconArrowDownLeft, IconSearch, IconBox, IconAlertTriangle, IconCircleMinus, IconCopyMinus } from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { useInventoryDashboard } from "../controllers/inventory.controller";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";

export default function InventoryDashboardPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const filters = [
    { key: "today", value: t("inventory.filters_option_today") },
    { key: "yesterday", value: t("inventory.filters_option_yesterday") },
    { key: "last_7days", value: t("inventory.filters_option_last_7_days") },
    { key: "this_month", value: t("inventory.filters_option_this_month") },
    { key: "last_month", value: t("inventory.filters_option_last_month") },
    { key: "custom", value: t("inventory.filters_option_custom") },
  ];

  const fromDateRef = useRef();
  const toDateRef = useRef();
  const filterTypeRef = useRef();

  const now = new Date();
  const defaultDateFrom = `${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
  const defaultDateTo = `${now.getFullYear()}-${(now.getMonth() + 2)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;

  const [state, setState] = useState({
    filter: filters[0].key,
    fromDate: null,
    toDate: null,
    warehouseId: "",
    search: ""
  });

  const { APIURL, data, error, isLoading } = useInventoryDashboard({
    type: state.filter,
    from: state.fromDate,
    to: state.toDate,
  });

  const {
    cummulativeInventoryMovements = [],
    inventoryUsageVSCurrentStock = []
  } = data || {};

  // Summary KPI statistics - must be declared before any early returns to satisfy React Rules of Hooks
  const summaryKpis = React.useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let totalWastage = 0;
    let totalMovements = 0;

    (cummulativeInventoryMovements || []).forEach((item) => {
      totalIn += parseFloat(item.total_in || 0);
      totalOut += parseFloat(item.total_out || 0);
      totalWastage += parseFloat(item.total_wastage || 0);
      totalMovements += parseInt(item.movement_count || 0, 10);
    });

    const lowStockCount = (inventoryUsageVSCurrentStock || []).filter(
      (item) => item.status === "low" || item.status === "out"
    ).length;

    return { totalIn, totalOut, totalWastage, totalMovements, lowStockCount };
  }, [cummulativeInventoryMovements, inventoryUsageVSCurrentStock]);

  if (isLoading) {
    return <Page>{t("inventory.loading_message")}</Page>;
  }

  if (error) {
    return <Page>{t("inventory.error_loading_message")}</Page>;
  }

  return (
    <Page>
      <div className="breadcrumbs text-xs text-slate-500 mb-2">
        <ul>
          <li>
            <Link to="/dashboard/inventory" className="hover:text-emerald-600 transition">
              {t("inventory.breadcrumbs_inventory")}
            </Link>
          </li>
          <li className="font-semibold text-slate-700 dark:text-slate-300">
            {t("inventory.breadcrumbs_dashboard")}
          </li>
        </ul>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t("inventory.page_title_dashboard")}
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-neutral-400">
            {t("inventory.showing_data_for")}{" "}
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {filters.find((f) => f.key == state.filter)?.value}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 md:w-72">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              className="w-full min-h-[42px] pl-9 pr-3 py-2 text-xs sm:text-[13px] rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#18181b] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-500 transition shadow-xs"
              placeholder={t("inventory.search_placeholder")}
              value={state.search}
              onChange={(e) => {
                setState({
                  ...state,
                  search: e.target.value,
                });
              }}
            />
          </div>
          <button
            onClick={() => document.getElementById("filter-dialog").showModal()}
            className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition active:scale-95 flex items-center gap-1.5 bg-white dark:bg-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-neutral-700 shadow-xs"
          >
            <IconFilter stroke={iconStroke} size={18} />
            <span>{t("inventory.filters_button")}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mt-3 mb-6">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t("inventory.stock_movements_all", "Total Movements")}
            </span>
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-300">
              <IconBox size={18} stroke={iconStroke} />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {summaryKpis.totalMovements}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              {t("inventory.table_header_in", "Stock In")}
            </span>
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
              <IconArrowDownLeft size={18} stroke={iconStroke} />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
            {summaryKpis.totalIn.toFixed(1)}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">
              {t("inventory.table_header_out", "Stock Out")}
            </span>
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              <IconArrowUpRight size={18} stroke={iconStroke} />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1 tabular-nums">
            {summaryKpis.totalOut.toFixed(1)}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">
              {t("inventory.table_header_wastage", "Wastage")}
            </span>
            <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
              <IconCircleMinus size={18} stroke={iconStroke} />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1 tabular-nums">
            {summaryKpis.totalWastage.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Two Responsive Grid Widgets */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Moving Inventory Items */}
        <div className="flex flex-col min-h-[460px] max-h-[580px] rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/80 dark:bg-neutral-850/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                {t("inventory.cummulative_inventory_movements")}
              </h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-neutral-800 text-slate-700 dark:text-slate-300">
              {cummulativeInventoryMovements?.length || 0}
            </span>
          </div>

          <div className="flex-1 overflow-auto">
            {cummulativeInventoryMovements?.filter((item) => {
              if (!state.search) return true;
              return String(item.title).trim().toLowerCase().includes(state.search.trim().toLowerCase());
            })?.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs sm:text-[13px]">
                <thead className="sticky top-0 z-10 bg-slate-100/90 dark:bg-neutral-800/90 backdrop-blur border-b border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-300 font-semibold">
                  <tr>
                    <th className="px-3.5 py-2.5 w-10">#</th>
                    <th className="px-3.5 py-2.5">{t("inventory.table_header_item")}</th>
                    <th className="px-3.5 py-2.5 text-emerald-700 dark:text-emerald-400">{t("inventory.table_header_in")}</th>
                    <th className="px-3.5 py-2.5 text-blue-700 dark:text-blue-400">{t("inventory.table_header_out")}</th>
                    <th className="px-3.5 py-2.5 text-rose-700 dark:text-rose-400">{t("inventory.table_header_wastage")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                  {cummulativeInventoryMovements.filter((item) => {
                    if (!state.search) return true;
                    return String(item.title).trim().toLowerCase().includes(state.search.trim().toLowerCase());
                  })?.map((item, index) => (
                    <tr key={item.inventory_item_id || index} className="hover:bg-slate-50 dark:hover:bg-neutral-800/40 transition">
                      <td className="px-3.5 py-3 font-mono text-slate-400 text-xs">{index + 1}</td>
                      <td className="px-3.5 py-3 font-medium text-slate-900 dark:text-white">{item.title}</td>
                      <td className="px-3.5 py-3 text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                        <div className="flex items-center gap-1">
                          <IconArrowDownLeft stroke={iconStroke} size={15} />
                          <span>{Number(item.total_in).toFixed(1)} {item.unit}</span>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-blue-600 dark:text-blue-400 font-semibold tabular-nums">
                        <div className="flex items-center gap-1">
                          <IconArrowUpRight stroke={iconStroke} size={15} />
                          <span>{Number(item.total_out).toFixed(1)} {item.unit}</span>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-rose-600 dark:text-rose-400 font-semibold tabular-nums">
                        {parseFloat(item.total_wastage) > 0 ? (
                          <div className="flex items-center gap-1">
                            <IconCircleMinus stroke={iconStroke} size={15} />
                            <span>{Number(item.total_wastage).toFixed(1)} {item.unit}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-normal">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400 text-xs sm:text-sm">
                <img
                  src="/assets/illustrations/top-selling-not-found.webp"
                  alt={t("inventory.no_data_image_alt")}
                  className="w-32 sm:w-40 mb-3 opacity-90"
                />
                <span className="font-medium text-slate-500">{t("inventory.no_inventory_movements_message")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Usage vs Current Stock */}
        <div className="flex flex-col min-h-[460px] max-h-[580px] rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/80 dark:bg-neutral-850/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                {t("inventory.usage_vs_current_stock")}
              </h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-neutral-800 text-slate-700 dark:text-slate-300">
              {inventoryUsageVSCurrentStock?.length || 0}
            </span>
          </div>

          <div className="flex-1 overflow-auto">
            {inventoryUsageVSCurrentStock?.filter((item) => {
              if (!state.search) return true;
              return String(item.title).trim().toLowerCase().includes(state.search.trim().toLowerCase());
            })?.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs sm:text-[13px]">
                <thead className="sticky top-0 z-10 bg-slate-100/90 dark:bg-neutral-800/90 backdrop-blur border-b border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-300 font-semibold">
                  <tr>
                    <th className="px-3.5 py-2.5 w-10">#</th>
                    <th className="px-3.5 py-2.5">{t("inventory.table_header_item")}</th>
                    <th className="px-3.5 py-2.5 text-blue-700 dark:text-blue-400">{t("inventory.table_header_used")}</th>
                    <th className="px-3.5 py-2.5 text-emerald-700 dark:text-emerald-400">{t("inventory.table_header_current_stock")}</th>
                    <th className="px-3.5 py-2.5 text-amber-700 dark:text-amber-400">{t("inventory.table_header_min_qty")}</th>
                    <th className="px-3.5 py-2.5 text-center">{t("inventory.table_header_status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                  {inventoryUsageVSCurrentStock.filter((item) => {
                    if (!state.search) return true;
                    return String(item.title).trim().toLowerCase().includes(state.search.trim().toLowerCase());
                  }).map((item, index) => (
                    <tr key={item.inventory_item_id || index} className="hover:bg-slate-50 dark:hover:bg-neutral-800/40 transition">
                      <td className="px-3.5 py-3 font-mono text-slate-400 text-xs">{index + 1}</td>
                      <td className="px-3.5 py-3 font-medium text-slate-900 dark:text-white">{item.title}</td>
                      <td className="px-3.5 py-3 text-blue-600 dark:text-blue-400 font-semibold tabular-nums">
                        <div className="flex items-center gap-1">
                          <IconCopyMinus stroke={iconStroke} size={15} />
                          <span>{Number(item.total_usage || 0).toFixed(1)} {item.unit}</span>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                        <div className="flex items-center gap-1">
                          <IconBox stroke={iconStroke} size={15} />
                          <span>{Number(item.current_stock || 0).toFixed(1)} {item.unit}</span>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-amber-600 dark:text-amber-400 tabular-nums">
                        <div className="flex items-center gap-1">
                          <IconAlertTriangle stroke={iconStroke} size={14} />
                          <span>{Number(item.min_quantity_threshold || 0).toFixed(1)} {item.unit}</span>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        <span
                          className={clsx(
                            "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border",
                            item.status === "in" && "bg-[#dcfce7] text-[#15803d] dark:bg-emerald-950/70 dark:text-emerald-400 border-[#bbf7d0] dark:border-emerald-800",
                            item.status === "low" && "bg-[#fef3c7] text-[#b45309] dark:bg-amber-950/70 dark:text-amber-400 border-[#fde68a] dark:border-amber-800",
                            item.status === "out" && "bg-[#fee2e2] text-[#991b1b] dark:bg-rose-950/70 dark:text-rose-400 border-[#fecaca] dark:border-rose-800"
                          )}
                        >
                          {item.status === "in" && t("inventory.status_in_stock")}
                          {item.status === "low" && t("inventory.status_low_stock")}
                          {item.status === "out" && t("inventory.status_out_of_stock")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400 text-xs sm:text-sm">
                <img
                  src="/assets/illustrations/kitchen-order-not-found.webp"
                  alt={t("inventory.no_data_image_alt")}
                  className="w-32 sm:w-40 mb-3 opacity-90"
                />
                <span className="font-medium text-slate-500">{t("inventory.no_usage_vs_stock_message")}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* filter dialog */}
      <dialog id="filter-dialog" className="modal">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <h3 className="font-bold text-lg flex items-center">
            <IconFilter stroke={iconStroke} /> {t("inventory.filters_dialog_title")}
          </h3>
          {/* filters */}
          <div className="my-4">
            <div>
              <label className=" block text-gray-500 text-sm">{t("inventory.filters_filter_label")}</label>
              <select
                className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green'
                ref={filterTypeRef}
              >
                {filters.map((filter, index) => (
                  <option key={index} value={filter.key}>
                    {filter.value}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 mt-4">
              <div className="flex-1">
                <label
                  htmlFor="fromDate"
                  className=" block text-gray-500 text-sm"
                >
                  {t("inventory.filters_from_date_label")}
                </label>
                <input
                  defaultValue={defaultDateFrom}
                  type="date"
                  ref={fromDateRef}
                  className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green'
                />
              </div>
              <div className="flex-1">
                <label
                  htmlFor="toDate"
                  className=" block text-gray-500 text-sm"
                >
                  {t("inventory.filters_to_date_label")}
                </label>
                <input
                  defaultValue={defaultDateTo}
                  type="date"
                  ref={toDateRef}
                  className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green'
                />
              </div>
            </div>
          </div>
          {/* filters */}
          <div className="modal-action">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className='btn transition active:scale-95 hover:shadow-lg px-4 py-3 flex-1 items-center justify-center align-center rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text'>{t("inventory.filters_close_button")}</button>
              <button
                onClick={() => {
                  setState({
                    ...state,
                    filter: filterTypeRef.current.value,
                    fromDate: fromDateRef.current.value || null,
                    toDate: toDateRef.current.value || null,
                  });
                }}
                className='rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white ml-3 border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'>{t("inventory.filters_apply_button")}
              </button>
            </form>
          </div>
        </div>
      </dialog>
      {/* filter dialog */}
    </Page>
  );
}
