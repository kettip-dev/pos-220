import React, { useRef, useState, useMemo, useEffect } from "react";
import Page from "../components/Page";
import {
  IconCarrot,
  IconFilter,
  IconDownload,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconSearch,
  IconBox,
  IconAlertTriangle,
  IconCircleArrowDownLeft,
  IconCircleArrowUpRight,
  IconCircleMinus,
  IconArrowsRandom,
  IconLibraryMinus,
  IconPrinter,
  IconSettings,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconX,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import { iconStroke } from "../config/config";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { useInventoryLogs } from "../controllers/inventory.controller";
import moment from "moment";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
export default function InventoryLogsPage() {
  const { t } = useTranslation();
  const filters = [
    { key: "today", value: t("inventory.filters_option_today") },
    { key: "yesterday", value: t("inventory.filters_option_yesterday") },
    { key: "last_7days", value: t("inventory.filters_option_last_7_days") },
    { key: "this_month", value: t("inventory.filters_option_this_month") },
    { key: "last_month", value: t("inventory.filters_option_last_month") },
    { key: "custom", value: t("inventory.filters_option_custom") },
  ];

  const [selectedMovementType, setSelectedMovementType] = useState("all");

  const fromDateRef = useRef();
  const toDateRef = useRef();
  const filterTypeRef = useRef();
  const { theme } = useTheme();
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

  const { APIURL, data, error, isLoading } = useInventoryLogs({
    type: state.filter,
    from: state.fromDate,
    to: state.toDate,
    movementType: selectedMovementType,
  });

  // Table options (QuickBooks-style settings)
  const [tableSettings, setTableSettings] = useState({
    compactDensity: false,
    pageSize: 10,
    currentPage: 1,
    showGearMenu: false,
    visibleColumns: {
      quantity: true,
      movement: true,
      dateTime: true,
      remarks: true,
      updatedBy: true,
    },
  });

  const [selectedLogs, setSelectedLogs] = useState(new Set());
  const settingsBtnRef = useRef(null);

  // Close gear menu when clicking outside
  useEffect(() => {
    if (!tableSettings.showGearMenu) return;
    const handleClickOutside = (e) => {
      if (settingsBtnRef.current && !settingsBtnRef.current.contains(e.target)) {
        setTableSettings((prev) => ({ ...prev, showGearMenu: false }));
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [tableSettings.showGearMenu]);

  const filteredLogs = useMemo(() => {
    let list = data || [];
    if (selectedMovementType !== "all") {
      list = list.filter((i) => i.type === selectedMovementType);
    }
    if (state.search) {
      const q = String(state.search).trim().toLowerCase();
      list = list.filter((i) =>
        String(i.title || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, selectedMovementType, state.search]);

  const totalItems = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / tableSettings.pageSize));
  const currentPage = Math.min(tableSettings.currentPage, totalPages);
  const startIndex = (currentPage - 1) * tableSettings.pageSize;
  const endIndex = Math.min(startIndex + tableSettings.pageSize, totalItems);
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  const isAllCurrentPageSelected =
    paginatedLogs.length > 0 &&
    paginatedLogs.every((item) => selectedLogs.has(item.id));

  const toggleSelectAll = () => {
    const next = new Set(selectedLogs);
    if (isAllCurrentPageSelected) {
      paginatedLogs.forEach((item) => next.delete(item.id));
    } else {
      paginatedLogs.forEach((item) => next.add(item.id));
    }
    setSelectedLogs(next);
  };

  const toggleSelectRow = (id) => {
    const next = new Set(selectedLogs);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedLogs(next);
  };

  const handlePrintTable = () => {
    window.print();
  };

  const handleExportToExcel = async () => {
    try {
      toast.loading("Preparing export...");
      const XLSX = await import("xlsx");
      const exportList =
        selectedLogs.size > 0
          ? filteredLogs.filter((item) => selectedLogs.has(item.id))
          : filteredLogs;

      const exportData = exportList.map((item) => ({
        ID: item.id,
        Item: item.title,
        Quantity: item.quantity,
        Unit: item.unit,
        Movement: item.type,
        "Date & Time": item.created_at
          ? moment.utc(item.created_at).local().format("DD/MM/YYYY, h:mm A")
          : "-",
        Remarks: item.note || "-",
        "Updated By": item.created_by || "-",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "StockMovements");
      XLSX.writeFile(
        workbook,
        `Stock_Movements_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      toast.dismiss();
      toast.success("Stock movements exported successfully!");
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error("Failed to export stock movements");
    }
  };

  if (isLoading) {
    return <Page>{t("inventory.loading_message")}</Page>;
  }

  if (error) {
    return <Page>{t("inventory.error_loading_message")}</Page>;
  }

  const handleExportData = async () => {
    try {
      const { Parser } = await import("@json2csv/plainjs");
      const { saveAs } = await import("file-saver");

      if (data.length != 0){
        const formattedData = data.map((entry) => ({
          title: entry.title,
          movement: entry.type,
          quantity: entry.quantity,
          unit:entry.unit || '',
          remarks: entry.note,
          updated_by: entry.created_by,
          created_at: moment.utc(entry.created_at).local().format("YYYY-MM-DD HH:mm"),
        }));

        const opts = {
          fields: ["title", "movement", "quantity", "unit", "remarks", "updated_by", "created_at"],
        };

        const parser = new Parser(opts);
        const csv = parser.parse(formattedData);

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

        const formattedDate = `${new Date().toISOString().substring(0, 10)}`;
        const fileName = `Inventory Logs - ${formattedDate}.csv`;

        saveAs(blob, fileName);
        toast.success(t("inventory.export_success_message"));
      } else {
        toast.error(t("inventory.export_no_data_message"));
      }

    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.dismiss();
      toast.error(t("inventory.export_error_message"));
    }
  };

  return (
    <Page>
      <div className="breadcrumbs text-sm mb-1">
        <ul>
          <li>
            <Link to="/dashboard/inventory">{t("inventory.breadcrumbs_inventory")}</Link>
          </li>
          <li>{t("inventory.breadcrumbs_movements")}</li>
        </ul>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <h3 className="text-2xl flex-1">{t("inventory.page_title")}</h3>
        <div className="relative md:w-80">
          <IconSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            className="input input-sm input-bordered focus:outline-none focus:ring-1 focus-within:ring-gray-200 transition pl-8 pr-2 w-full rounded-lg text-gray-500 py-4 h-8"
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
          className='btn btn-sm transition active:scale-95 hover:shadow-lg px-4 py-1 border bg-restro-gray hover:bg-restro-button-hover rounded-lg'>
          <IconFilter stroke={iconStroke} /> {t("inventory.filters_button")}
        </button>
        <button
          onClick={handleExportData}
          className='btn btn-sm transitiontransition active:scale-95 hover:shadow-lg px-4 py-1 border bg-restro-bg-gray hover:bg-restro-button-hover rounded-lg w-fit`'>
          <IconDownload stroke={iconStroke} size={20} />
        </button>
      </div>

      <h3 className="mt-1 text-gray-500 text-base">
        {t("inventory.showing_data_for")} {filters.find((f) => f.key == state.filter).value}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 text-restro-text">
        {[
          {
            label: t("inventory.stock_movements_all"),
            icon: <IconArrowsRandom stroke={1.5} className="text-gray-600" />,
            type: "all",
            border: "border-l-gray-400",
            countColor: "text-gray-600",
          },
          {
            label: t("inventory.stock_movements_in"),
            icon: <IconCircleArrowDownLeft stroke={1.5} className="text-green-600" />,
            type: "IN",
            border: "border-l-restro-green",
            countColor: "text-restro-green",
          },
          {
            label: t("inventory.stock_movements_out"),
            icon: <IconCircleArrowUpRight stroke={1.5} className="text-yellow-600" />,
            type: "OUT",
            border: "border-l-yellow-600",
            countColor: "text-yellow-600",
          },
          {
            label: t("inventory.stock_movements_wastage"),
            icon: <IconLibraryMinus stroke={1.5} className="text-red-600" />,
            type: "WASTAGE",
            border: "border-l-red-600",
            countColor: "text-red-100",
          },
        ].map(({ label, icon, type, border, countColor }) => {
          const isSelected = selectedMovementType === type;
          return (
            <div
              key={type}
              onClick={() => setSelectedMovementType(type)}
              className={clsx(
                "cursor-pointer flex items-center gap-4 px-4 py-4 rounded-xl border border-l-8 transition-all duration-200",
                countColor,
                border,
                isSelected
                  ? theme === "black"
                    ? "bg-restro-card-bg text-white border-restro-border-dark-mode"
                    : "bg-gray-100 text-gray-900 border-restro-green-light"
                  : theme === "black"
                    ? "text-white border-restro-border-dark-mode"
                    : "text-gray-700 border-restro-green-light"

              )}
            >
              <div className='p-3 rounded-lg shadow-inner bg-restro-bg-gray'>{icon}</div>
              <div>
                <div className="text-sm font-medium text-gray-600">{label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Selection Action Banner (When rows are checked) ── */}
      {selectedLogs.size > 0 && (
        <div className="mb-3 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              {selectedLogs.size} log{selectedLogs.size > 1 ? "s" : ""} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportToExcel}
              className="px-3 py-1.5 rounded-md bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-semibold hover:bg-emerald-100 dark:hover:bg-neutral-700 transition active:scale-95"
            >
              Export Selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedLogs(new Set())}
              className="px-3 py-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium hover:bg-slate-200/60 dark:hover:bg-neutral-800 transition"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* ── Filter & Action Bar Directly Above Table (QuickBooks Style - Matching First Image) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2 mt-4">
        {/* Left Side: Filter by name or number + Movement Dropdown */}
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          {/* Search Input Box */}
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <IconSearch size={16} stroke={iconStroke} />
            </div>
            <input
              type="text"
              value={state.search}
              onChange={(e) => {
                setState((p) => ({ ...p, search: e.target.value }));
                setTableSettings((p) => ({ ...p, currentPage: 1 }));
              }}
              placeholder="Filter by name or number"
              className="w-full min-h-[38px] pl-9 pr-8 py-1.5 text-xs sm:text-[13px] rounded-md border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#18181b] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition"
            />
            {state.search && (
              <button
                type="button"
                onClick={() => {
                  setState((p) => ({ ...p, search: "" }));
                  setTableSettings((p) => ({ ...p, currentPage: 1 }));
                }}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <IconX size={14} stroke={iconStroke} />
              </button>
            )}
          </div>

          {/* Quick Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedMovementType}
              onChange={(e) => {
                setSelectedMovementType(e.target.value);
                setTableSettings((p) => ({ ...p, currentPage: 1 }));
              }}
              className="min-h-[38px] px-3 pr-8 py-1.5 text-xs sm:text-[13px] font-normal rounded-md border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#18181b] text-slate-800 dark:text-slate-100 appearance-none focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
            >
              <option value="all">All Movements</option>
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
              <option value="WASTAGE">WASTAGE</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-500">
              <IconChevronDown size={14} stroke={iconStroke} />
            </div>
          </div>
        </div>

        {/* Right Side: Print, Export, Gear, and Pagination */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* Action Icons */}
          <div className="flex items-center gap-1 border-r border-slate-200 dark:border-neutral-700 pr-3">
            {/* Print Table */}
            <button
              type="button"
              onClick={handlePrintTable}
              title="Print table"
              className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition active:scale-95"
            >
              <IconPrinter size={16} stroke={iconStroke} />
            </button>

            {/* Export Excel */}
            <button
              type="button"
              onClick={handleExportToExcel}
              title="Export to Excel"
              className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition active:scale-95"
            >
              <IconDownload size={16} stroke={iconStroke} />
            </button>

            {/* Settings Gear Popover */}
            <div className="relative" ref={settingsBtnRef}>
              <button
                type="button"
                onClick={() =>
                  setTableSettings((p) => ({
                    ...p,
                    showGearMenu: !p.showGearMenu,
                  }))
                }
                title="Table settings"
                className={clsx(
                  "w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition active:scale-95",
                  tableSettings.showGearMenu && "bg-slate-200 dark:bg-neutral-800 text-slate-900"
                )}
              >
                <IconSettings size={16} stroke={iconStroke} />
              </button>

              {tableSettings.showGearMenu && (
                <div className="absolute right-0 top-9 w-60 p-3 bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl border border-slate-200 dark:border-neutral-700 text-xs z-[100] animate-in fade-in duration-100">
                  <div className="font-bold text-slate-900 dark:text-white pb-2 mb-2 border-b border-slate-100 dark:border-neutral-800">
                    Columns
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {[
                      { key: "quantity", label: "Quantity" },
                      { key: "movement", label: "Movement" },
                      { key: "dateTime", label: "Date & Time" },
                      { key: "remarks", label: "Remarks" },
                      { key: "updatedBy", label: "Updated By" },
                    ].map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      >
                        <input
                          type="checkbox"
                          checked={tableSettings.visibleColumns[col.key]}
                          onChange={(e) =>
                            setTableSettings((p) => ({
                              ...p,
                              visibleColumns: {
                                ...p.visibleColumns,
                                [col.key]: e.target.checked,
                              },
                            }))
                          }
                          className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>{col.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="font-bold text-slate-900 dark:text-white pb-1 mb-2 border-b border-slate-100 dark:border-neutral-800">
                    Display
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300 mb-3">
                    <input
                      type="checkbox"
                      checked={tableSettings.compactDensity}
                      onChange={(e) =>
                        setTableSettings((p) => ({
                          ...p,
                          compactDensity: e.target.checked,
                        }))
                      }
                      className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Compact rows</span>
                  </label>

                  <div className="font-bold text-slate-900 dark:text-white pb-1 mb-1 border-b border-slate-100 dark:border-neutral-800">
                    Rows per page
                  </div>
                  <select
                    value={tableSettings.pageSize}
                    onChange={(e) =>
                      setTableSettings((p) => ({
                        ...p,
                        pageSize: Number(e.target.value),
                        currentPage: 1,
                      }))
                    }
                    className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Pagination Text: < Previous  1 - 10 of 42  Next > */}
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-neutral-400">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() =>
                setTableSettings((p) => ({
                  ...p,
                  currentPage: Math.max(1, p.currentPage - 1),
                }))
              }
              className={clsx(
                "flex items-center gap-0.5 hover:text-slate-900 dark:hover:text-white transition",
                currentPage <= 1 && "opacity-40 cursor-not-allowed hover:text-slate-600"
              )}
            >
              <IconChevronLeft size={14} stroke={iconStroke} />
              <span>Previous</span>
            </button>

            <span className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
              {totalItems > 0 ? `${startIndex + 1} - ${endIndex}` : "0 - 0"}
              <span className="text-slate-400 font-normal"> of {totalItems}</span>
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() =>
                setTableSettings((p) => ({
                  ...p,
                  currentPage: Math.min(totalPages, p.currentPage + 1),
                }))
              }
              className={clsx(
                "flex items-center gap-0.5 hover:text-slate-900 dark:hover:text-white transition",
                currentPage >= totalPages && "opacity-40 cursor-not-allowed hover:text-slate-600"
              )}
            >
              <span>Next</span>
              <IconChevronRight size={14} stroke={iconStroke} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Table Container (QuickBooks Style) ── */}
      <div className="w-full">
        {paginatedLogs.length === 0 ? (
          <div className="flex flex-col justify-center items-center text-center p-14 bg-white dark:bg-[#18181b] rounded-2xl border border-slate-200 dark:border-neutral-800">
            <img
              src="/assets/illustrations/orders-not-found.webp"
              alt={t("inventory.no_stock_movements_image_alt")}
              className="w-1/2 md:w-60 mb-3"
            />
            <p className='text-sm text-slate-500'>{t("inventory.no_stock_movements_message")}</p>
          </div>
        ) : (
          <div>
            <div className="w-full overflow-x-auto border-t border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-neutral-800 text-[13px] font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-[#18181b]">
                    <th className="w-10 px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isAllCurrentPageSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all movements"
                        className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-3 w-12">#</th>
                    <th className="px-3 py-3">{t("inventory.table_header_item")}</th>
                    {tableSettings.visibleColumns.quantity && (
                      <th className="px-3 py-3">{t("inventory.table_header_quantity")}</th>
                    )}
                    {tableSettings.visibleColumns.movement && (
                      <th className="px-3 py-3 text-center">{t("inventory.table_header_movement")}</th>
                    )}
                    {tableSettings.visibleColumns.dateTime && (
                      <th className="px-3 py-3">{t("inventory.table_header_date_time")}</th>
                    )}
                    {tableSettings.visibleColumns.remarks && (
                      <th className="px-3 py-3 max-w-60">{t("inventory.table_header_remarks")}</th>
                    )}
                    {tableSettings.visibleColumns.updatedBy && (
                      <th className="px-4 py-3 text-right">{t("inventory.table_header_updated_by")}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80">
                  {paginatedLogs.map((inventoryItem, i) => {
                    const { id, title, type, quantity, unit, note, created_by, created_at } = inventoryItem;
                    const isSelected = selectedLogs.has(id || i);

                    return (
                      <tr
                        key={id || i}
                        className={clsx(
                          "hover:bg-slate-50/70 dark:hover:bg-neutral-800/40 transition group",
                          isSelected && "bg-emerald-50/40 dark:bg-emerald-950/20",
                          tableSettings.compactDensity ? "text-xs" : "text-xs sm:text-[13px]"
                        )}
                      >
                        {/* Checkbox */}
                        <td className="w-10 px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(id || i)}
                            className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>

                        {/* # */}
                        <td className={clsx("px-3 text-slate-400 font-mono text-xs", tableSettings.compactDensity ? "py-2" : "py-3")}>
                          {startIndex + i + 1}
                        </td>

                        {/* Title */}
                        <td className={clsx("px-3 font-semibold text-slate-900 dark:text-white", tableSettings.compactDensity ? "py-2" : "py-3")}>
                          <p className="text-ellipsis line-clamp-2">{title}</p>
                        </td>

                        {/* Quantity */}
                        {tableSettings.visibleColumns.quantity && (
                          <td className={clsx("px-3 tabular-nums font-medium text-slate-800 dark:text-slate-200", tableSettings.compactDensity ? "py-2" : "py-3")}>
                            {quantity ? `${Number(quantity).toLocaleString()} ${unit || ""}` : t("inventory.default_no_remarks")}
                          </td>
                        )}

                        {/* Movement (BAL style) */}
                        {tableSettings.visibleColumns.movement && (
                          <td className={clsx("px-3 text-center whitespace-nowrap", tableSettings.compactDensity ? "py-2" : "py-3")}>
                            <span
                              className={clsx(
                                "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border",
                                type === "IN" &&
                                  "bg-[#dcfce7] text-[#15803d] dark:bg-emerald-950/70 dark:text-emerald-400 border-[#bbf7d0] dark:border-emerald-800",
                                type === "OUT" &&
                                  "bg-[#fef3c7] text-[#b45309] dark:bg-amber-950/70 dark:text-amber-400 border-[#fde68a] dark:border-amber-800",
                                type === "WASTAGE" &&
                                  "bg-[#fee2e2] text-[#991b1b] dark:bg-rose-950/70 dark:text-rose-400 border-[#fecaca] dark:border-rose-800"
                              )}
                            >
                              {t(`inventory.movement_type_${String(type).toLowerCase()}`)}
                            </span>
                          </td>
                        )}

                        {/* Date & Time */}
                        {tableSettings.visibleColumns.dateTime && (
                          <td className={clsx("px-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap", tableSettings.compactDensity ? "py-2" : "py-3")}>
                            {created_at ? moment.utc(created_at).local().format("DD/MM/YYYY, h:mm A") : t("inventory.default_no_date")}
                          </td>
                        )}

                        {/* Remarks */}
                        {tableSettings.visibleColumns.remarks && (
                          <td className={clsx("px-3 text-xs text-slate-600 dark:text-slate-300 max-w-60 truncate", tableSettings.compactDensity ? "py-2" : "py-3")} title={note}>
                            {note || t("inventory.default_no_remarks")}
                          </td>
                        )}

                        {/* Updated By */}
                        {tableSettings.visibleColumns.updatedBy && (
                          <td className={clsx("px-4 text-right text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap", tableSettings.compactDensity ? "py-2" : "py-3")}>
                            {created_by || t("inventory.default_no_updated_by")}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Bottom Pagination Bar ── */}
            <div className="flex items-center justify-between py-3 text-xs text-slate-600 dark:text-neutral-400">
              <div className="text-slate-500">
                Showing {totalItems > 0 ? startIndex + 1 : 0} to {endIndex} of{" "}
                {totalItems} entries
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() =>
                    setTableSettings((p) => ({
                      ...p,
                      currentPage: Math.max(1, p.currentPage - 1),
                    }))
                  }
                  className={clsx(
                    "flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition",
                    currentPage <= 1 && "opacity-40 cursor-not-allowed hover:text-slate-600"
                  )}
                >
                  <IconChevronLeft size={14} stroke={iconStroke} />
                  <span>Previous</span>
                </button>

                <span className="tabular-nums">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setTableSettings((p) => ({
                      ...p,
                      currentPage: Math.min(totalPages, p.currentPage + 1),
                    }))
                  }
                  className={clsx(
                    "flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition",
                    currentPage >= totalPages && "opacity-40 cursor-not-allowed hover:text-slate-600"
                  )}
                >
                  <span>Next</span>
                  <IconChevronRight size={14} stroke={iconStroke} />
                </button>
              </div>
            </div>
          </div>
        )}
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
              <label className = "block text-gray-500 text-sm">{t("inventory.filters_filter_label")}</label>
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
              <button className='px-4 py-3 rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text'>{t("inventory.filters_close_button")}</button>
              <button
                onClick={() => {
                  setState({
                    ...state,
                    filter: filterTypeRef.current.value,
                    fromDate: fromDateRef.current.value || null,
                    toDate: toDateRef.current.value || null,
                  });
                }}
               className='rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white ml-3 border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'
              >
                {t("inventory.filters_apply_button")}
              </button>
            </form>
          </div>
        </div>
      </dialog>
      {/* filter dialog */}
    </Page>
  );
}
