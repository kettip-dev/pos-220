import React, { useEffect, useRef, useState, useMemo } from "react";
import Page from "../components/Page";
import { isAllBusinessesScope } from "../helpers/BusinessScope";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import DeleteModal from "../components/DeleteModal";
import {
  IconAlertTriangle,
  IconBox,
  IconCarrot,
  IconCategory2,
  IconCircleMinus,
  IconDotsVertical,
  IconLogs,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
  IconX,
  IconPrinter,
  IconDownload,
  IconSettings,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { iconStroke } from "../config/config";
import {
  addInventoryItem,
  addInventoryItemStockMovement,
  deleteInventoryItem,
  updateInventoryItem,
  useInventoryItems,
} from "../controllers/inventory.controller";
import toast from "react-hot-toast";
import moment from "moment";
import { mutate } from "swr";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";

export const UNIT_LABELS = {
  kg: "Kilograms",
  g: "Grams",
  l: "Liters",
  ml: "Milliliters",
  pc: "Pieces",
};

export default function InventoryPage() {
  const { t } = useTranslation();
  // Enterprise "All Businesses" view: summary + read-only list. Every write is
  // gated to a single business by the backend.
  const isConsolidated = isAllBusinessesScope(getUserDetailsInLocalStorage()?.role);
  const {theme} = useTheme();
  const [selectedStatus, setSelectedStatus] = useState("all");

  const [state, setState] = useState({
    search: '',
    inventory: [],
    statusCounts: {
      all: 0,
      in: 0,
      low: 0,
      out: 0,
    },
  })

  const titleRef = useRef(null);
  const quantityRef = useRef(null);
  const unitRef = useRef(null);
  const minQuantityThresholdRef = useRef(null);

  const updateTitleRef = useRef(null);
  const updateQuantityRef = useRef(null);
  const updateUnitRef = useRef(null);
  const updateMinQuantityThresholdRef = useRef(null);

  const [selectedUpdateItem, setSelectedUpdateItem] = useState(null);

  const [selectedDeletItem, setSelectedDeleteItem] = useState(null);

  const addStockMovementTypeRef = useRef("IN");
  const addStockMovementItemIdRef = useRef(null);
  const addStockMovementQuantityRef = useRef(null);
  const addStockMovementNoteRef = useRef(null);

  const { APIURL, data, error, isLoading } = useInventoryItems({
    status: selectedStatus
  });

  // Table options (QuickBooks-style settings)
  const [tableSettings, setTableSettings] = useState({
    compactDensity: false,
    pageSize: 10,
    currentPage: 1,
    showGearMenu: false,
    visibleColumns: {
      currentStock: true,
      minStock: true,
      status: true,
      updatedOn: true,
    },
  });

  const [selectedInventory, setSelectedInventory] = useState(new Set());
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

  const filteredInventory = useMemo(() => {
    let list = state.inventory || [];
    if (state.search) {
      const q = state.search.trim().toLowerCase();
      list = list.filter((item) =>
        item.title?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [state.inventory, state.search]);

  const totalItems = filteredInventory.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / tableSettings.pageSize));
  const currentPage = Math.min(tableSettings.currentPage, totalPages);
  const startIndex = (currentPage - 1) * tableSettings.pageSize;
  const endIndex = Math.min(startIndex + tableSettings.pageSize, totalItems);
  const paginatedInventory = filteredInventory.slice(startIndex, endIndex);

  const isAllCurrentPageSelected =
    paginatedInventory.length > 0 &&
    paginatedInventory.every((item) => selectedInventory.has(item.id));

  const toggleSelectAll = () => {
    const next = new Set(selectedInventory);
    if (isAllCurrentPageSelected) {
      paginatedInventory.forEach((item) => next.delete(item.id));
    } else {
      paginatedInventory.forEach((item) => next.add(item.id));
    }
    setSelectedInventory(next);
  };

  const toggleSelectRow = (id) => {
    const next = new Set(selectedInventory);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedInventory(next);
  };

  const handlePrintTable = () => {
    window.print();
  };

  const handleExportToExcel = async () => {
    try {
      toast.loading("Preparing export...");
      const XLSX = await import("xlsx");
      const exportList =
        selectedInventory.size > 0
          ? filteredInventory.filter((item) => selectedInventory.has(item.id))
          : filteredInventory;

      const exportData = exportList.map((item) => ({
        ID: item.id,
        Item: item.title,
        Quantity: item.quantity,
        Unit: item.unit,
        "Min Threshold": item.min_quantity_threshold,
        Status: item.status,
        "Updated At": item.updated_at
          ? moment.utc(item.updated_at).local().format("DD/MM/YYYY, h:mm A")
          : "-",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
      XLSX.writeFile(
        workbook,
        `Inventory_Export_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      toast.dismiss();
      toast.success("Inventory exported successfully!");
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error("Failed to export inventory");
    }
  };

  useEffect(() => {
    if (data) {
      setState({
        ...state,
        inventory: data.items || [],
        statusCounts: data.statusCounts || {},
      });
    }
  }, [data])

  if (isLoading) {
    return <Page>{t('inventory.loading_text')}</Page>;
  }

  if (error) {
    return <Page>{t('inventory.error_loading_text')}</Page>;
  }

  const handleAddInventoryItem = async () => {
    const title = titleRef.current?.value.trim();
    const quantity = parseFloat(quantityRef.current?.value || 0);
    const unit = unitRef.current?.value;
    const minQuantityThreshold = parseFloat(minQuantityThresholdRef.current?.value || 0);

    if (!title) {
      toast.error(t('inventory.toast_item_name_required'));
      return;
    }
    if (!quantity || quantity <= 0) {
      toast.error(t('inventory.toast_quantity_positive_required'));
      return;
    }
    if (!unit) {
      toast.error(t('inventory.toast_unit_required'));
      return;
    }
    if (!minQuantityThreshold || minQuantityThreshold <= 0) {
      toast.error(t('inventory.toast_min_quantity_positive_required'));
      return;
    }
    if (minQuantityThreshold > quantity) {
      toast.error(t('inventory.toast_min_quantity_less_than_stock'));
      return;
    }

    try {
      const res = await addInventoryItem({
        title,
        quantity,
        unit,
        min_quantity_threshold: minQuantityThreshold,
      });

      if (res.status === 200) {
        toast.dismiss();
        toast.success(res.data.message);

        titleRef.current.value = "";
        quantityRef.current.value = "";
        unitRef.current.value = "pc";
        minQuantityThresholdRef.current.value = "";

        document.getElementById('modal-add-inventory-item').close();

        await mutate(APIURL);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('inventory.toast_default_error');
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  };

  const handleUpdateInventoryItem = async () => {
    const title = updateTitleRef.current?.value.trim();
    const quantity = parseFloat(updateQuantityRef.current?.value || 0);
    const unit = updateUnitRef.current?.value;
    const minQuantityThreshold = parseFloat(updateMinQuantityThresholdRef.current?.value || 0);

    if(!selectedUpdateItem){
      toast.error(t('inventory.toast_invalid_request'));
      return;
    }
    if (!title) {
      toast.error(t('inventory.toast_item_name_required'));
      return;
    }
    if (!quantity || quantity <= 0) {
      toast.error(t('inventory.toast_quantity_positive_required'));
      return;
    }
    if (!unit) {
      toast.error(t('inventory.toast_unit_required'));
      return;
    }
    if (!minQuantityThreshold || minQuantityThreshold <= 0) {
      toast.error(t('inventory.toast_min_quantity_positive_required'));
      return;
    }
    if (minQuantityThreshold > quantity) {
      toast.error(t('inventory.toast_min_quantity_less_than_stock'));
      return;
    }

    try {
      const res = await updateInventoryItem({
        id: selectedUpdateItem,
        title,
        unit,
        min_quantity_threshold: minQuantityThreshold,
      });

      if (res.status === 200) {
        toast.dismiss();
        toast.success(res.data.message);

        updateTitleRef.current.value = "";
        updateQuantityRef.current.value = "";
        updateUnitRef.current.value = "pc";
        updateMinQuantityThresholdRef.current.value = "";
        setSelectedUpdateItem(null);

        document.getElementById('modal-update-inventory-item').close();

        await mutate(APIURL);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('inventory.toast_default_error');
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  };

  const handleDeleteInventoryItem = async () => {
    if(!selectedDeletItem){
      toast.error(t('inventory.toast_invalid_request'));
      return;
    }

    try {
      const res = await deleteInventoryItem({
        id: selectedDeletItem
      });

      if (res.status === 200) {
        toast.dismiss();
        toast.success(res.data.message);

        setSelectedDeleteItem(null);
        await mutate(APIURL);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('inventory.toast_default_error');
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  };

  const handleAddItemStockMovement = async () => {
    const movementType = addStockMovementTypeRef.current?.value || null;
    const itemId = addStockMovementItemIdRef.current?.value || null;
    const quantity = parseFloat(addStockMovementQuantityRef.current?.value || "0");
    const note = addStockMovementNoteRef.current?.value?.trim();

    if(!itemId){
      toast.error(t('inventory.toast_invalid_request'));
      return;
    }

    if(!movementType){
      toast.error(t('inventory.toast_select_movement_type'));
      return;
    }

    if (isNaN(quantity) || quantity <= 0) {
      toast.error(t('inventory.toast_invalid_quantity'));
      return;
    }

    try {
      const res = await addInventoryItemStockMovement({
        id: itemId,
        movementType,
        quantity,
        note
      });

      if (res.status === 200) {
        toast.dismiss();
        toast.success(res.data.message);

        addStockMovementTypeRef.current.value = 'IN'
        addStockMovementItemIdRef?.current.value == null;
        addStockMovementQuantityRef.current.value = "";
        addStockMovementNoteRef.current.value = "";

        document.getElementById("modal-add-inventory-stock-movement")?.close();

        await mutate(APIURL);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('inventory.toast_default_error');
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  };

  return (
    <Page>
      <div className="flex flex-wrap gap-4 flex-col md:flex-row items-center justify-between">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <h3 className="text-2xl">{t('inventory.title')}</h3>
          <Link
            to="dashboard"
            className='rounded-lg border-none b shadow-none transition active:scale-95 text-restro-text px-2 py-1 flex items-center gap-1 bg-restro-bg-gray hover:bg-restro-button-hover'
          >
            <IconCategory2 stroke={iconStroke} size={18} /> {t('inventory.dashboard')}
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <div className="flex items-center justify-between">
            <div className="relative md:w-80">
              <IconSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="search"
                className="input input-sm input-bordered focus:outline-none focus:ring-1 focus-within:ring-gray-200 transition pl-8 pr-2 w-full rounded-lg text-gray-500 py-4 h-8"
                placeholder={t('inventory.search_placeholder')}
                value={state.search}
                onChange={(e) => {
                  setState({
                    ...state,
                    search: e.target.value,
                  });
                }}
              />
            </div>
            <div></div>
          </div>
          <button onClick={()=>{
              document.getElementById('modal-add-inventory-item').showModal();
          }}  className = "text-sm rounded-lg border transition active:scale-95 hover:shadow-lg px-2 py-1 flex items-center gap-1 text-restro-text bg-restro-gray border-restro-border-green hover:bg-restro-button-hover">
            <IconPlus size={18} stroke={iconStroke}/>
            {t('inventory.add_stock_item')}
          </button>
          <Link
            to="stock-movements"
            className='rounded-lg border-none b shadow-none transition active:scale-95 text-restro-text px-2 py-1 flex items-center gap-1 bg-restro-bg-gray hover:bg-restro-button-hover'
          >
            <IconLogs stroke={iconStroke} size={18} /> {t('inventory.stock_movements')}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        {[
          {
            label: t('inventory.status_all'),
            icon: <IconBox stroke={1.5} className="text-gray-600" />,
            status: "all",
            count: state.inventory?.length || 0,
            border: "border-l-gray-400",
            countColor: "text-gray-600",
          },
          {
            label: t('inventory.status_in'),
            icon: <IconCarrot stroke={1.5} className="text-green-600" />,
            status: "in",
            count: state.statusCounts?.in,
            border: "border-l-restro-green",
            countColor: "text-restro-green",
          },
          {
            label: t('inventory.status_low'),
            icon: <IconAlertTriangle stroke={1.5} className="text-yellow-600" />,
            status: "low",
            count: state.statusCounts?.low,
            border: "border-l-yellow-600",
            countColor: "text-yellow-600",
          },
          {
            label: t('inventory.status_out'),
            icon: <IconCircleMinus stroke={1.5} className="text-red-600"/>,
            status: "out",
            count: state.statusCounts?.out,
            border: "border-l-red-600",
            countColor: "text-red-600",
          },
        ].map(({ label, icon, status, count, border, countColor }) => {
          const isSelected = selectedStatus === status;
          return (
            <div
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={clsx(
                "cursor-pointer flex items-center gap-4 px-4 py-4 rounded-xl border border-l-8 transition-all duration-200",
                border,
                isSelected
                  ? theme === 'black'
                    ? "bg-restro-card-iconbg/80 border-restro-border-dark-mode"
                    : "border-restro-green-light bg-gray-50"
                  : theme === 'black'
                    ? " border-restro-border-dark-mode"
                    : "border-restro-green-light"
              )}
            >
              <div className='p-3 rounded-lg  shadow-inner bg-restro-card-bg'>{icon}</div>
              <div>
                <div className={`text-sm font-medium ${theme === 'black' ? 'text-white' : 'text-gray-600'} `}>{label}</div>
                <div className={`text-lg font-bold ${countColor}`}>{count}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Selection Action Banner (When rows are checked) ── */}
      {selectedInventory.size > 0 && (
        <div className="mb-3 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              {selectedInventory.size} item{selectedInventory.size > 1 ? "s" : ""} selected
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
              onClick={() => setSelectedInventory(new Set())}
              className="px-3 py-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium hover:bg-slate-200/60 dark:hover:bg-neutral-800 transition"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* ── Filter & Action Bar Directly Above Table (QuickBooks Style - Matching First Image) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2 mt-4">
        {/* Left Side: Filter by name or number + Status Dropdown */}
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
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setTableSettings((p) => ({ ...p, currentPage: 1 }));
              }}
              className="min-h-[38px] px-3 pr-8 py-1.5 text-xs sm:text-[13px] font-normal rounded-md border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#18181b] text-slate-800 dark:text-slate-100 appearance-none focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
            >
              <option value="all">All</option>
              <option value="in">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
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
                      { key: "currentStock", label: "Current Stock" },
                      { key: "minStock", label: "Min Stock" },
                      { key: "status", label: "Stock Status" },
                      { key: "updatedOn", label: "Updated On" },
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

      {/* ── Inventory Table (QuickBooks Style) ── */}
      <div className="w-[100%]">
        {paginatedInventory.length === 0 ? (
          <div className="flex flex-col justify-center items-center text-center p-14 bg-white dark:bg-[#18181b] rounded-2xl border border-slate-200 dark:border-neutral-800">
            <img
              src="/assets/illustrations/orders-not-found.webp"
              alt={t('inventory.no_items_image_alt')}
              className="w-1/2 md:w-60 mb-3"
            />
            <p className='text-sm text-slate-500'>{t('inventory.no_items_message')}</p>
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
                        aria-label="Select all inventory items"
                        className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-3 w-12">#</th>
                    <th className="px-3 py-3">{t('inventory.table_item')}</th>
                    {isConsolidated && <th className="px-3 py-3">{t("business_switcher.business", "Business")}</th>}
                    {tableSettings.visibleColumns.currentStock && (
                      <th className="px-3 py-3">{t('inventory.table_current_stock')}</th>
                    )}
                    {tableSettings.visibleColumns.minStock && (
                      <th className="px-3 py-3">{t('inventory.table_min_stock')}</th>
                    )}
                    {tableSettings.visibleColumns.status && (
                      <th className="px-3 py-3 text-center">{t('inventory.table_stock_status')}</th>
                    )}
                    {tableSettings.visibleColumns.updatedOn && (
                      <th className="px-3 py-3">{t('inventory.table_updated_on')}</th>
                    )}
                    <th className="px-4 py-3 text-right">{t('inventory.table_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80">
                  {paginatedInventory.map((inventoryItem, i) => {
                    const { id, title, quantity, unit, min_quantity_threshold, status, updated_at, business } = inventoryItem;
                    const isSelected = selectedInventory.has(id);

                    return (
                      <tr
                        key={id}
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
                            onChange={() => toggleSelectRow(id)}
                            className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>

                        {/* # */}
                        <td className={clsx("px-3 text-slate-400 font-mono text-xs", tableSettings.compactDensity ? "py-2" : "py-3")}>
                          {startIndex + i + 1}
                        </td>

                        {/* Item Title */}
                        <td className={clsx("px-3 font-semibold text-slate-900 dark:text-white", tableSettings.compactDensity ? "py-2" : "py-3")}>
                          <p className="text-ellipsis line-clamp-2">{title}</p>
                        </td>

                        {/* Business (if consolidated) */}
                        {isConsolidated && (
                          <td className={clsx("px-3", tableSettings.compactDensity ? "py-2" : "py-3")}>
                            <span className="rounded-full bg-slate-100 dark:bg-neutral-800 px-2.5 py-0.5 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap border border-slate-200 dark:border-neutral-700">
                              {business}
                            </span>
                          </td>
                        )}

                        {/* Current Stock */}
                        {tableSettings.visibleColumns.currentStock && (
                          <td className={clsx("px-3 tabular-nums font-medium text-slate-800 dark:text-slate-200", tableSettings.compactDensity ? "py-2" : "py-3")}>
                            {quantity ? quantity : "-"} <span className="text-slate-400 font-normal">{unit}</span>
                          </td>
                        )}

                        {/* Min Stock */}
                        {tableSettings.visibleColumns.minStock && (
                          <td className={clsx("px-3 tabular-nums text-slate-500 dark:text-slate-400", tableSettings.compactDensity ? "py-2" : "py-3")}>
                            {minQuantityThresholdRef ? min_quantity_threshold : "-"} <span className="text-slate-400 font-normal">{unit}</span>
                          </td>
                        )}

                        {/* Stock Status (BAL style) */}
                        {tableSettings.visibleColumns.status && (
                          <td className={clsx("px-3 text-center whitespace-nowrap", tableSettings.compactDensity ? "py-2" : "py-3")}>
                            <span
                              className={clsx(
                                "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border",
                                status === "in" &&
                                  "bg-[#dcfce7] text-[#15803d] dark:bg-emerald-950/70 dark:text-emerald-400 border-[#bbf7d0] dark:border-emerald-800",
                                status === "low" &&
                                  "bg-[#fef3c7] text-[#b45309] dark:bg-amber-950/70 dark:text-amber-400 border-[#fde68a] dark:border-amber-800",
                                status === "out" &&
                                  "bg-[#fee2e2] text-[#991b1b] dark:bg-rose-950/70 dark:text-rose-400 border-[#fecaca] dark:border-rose-800"
                              )}
                            >
                              {status === "in"
                                ? t("inventory.stock_status_in")
                                : status === "low"
                                ? t("inventory.stock_status_low")
                                : status === "out"
                                ? t("inventory.stock_status_out")
                                : "-"}
                            </span>
                          </td>
                        )}

                        {/* Updated On */}
                        {tableSettings.visibleColumns.updatedOn && (
                          <td className={clsx("px-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap", tableSettings.compactDensity ? "py-2" : "py-3")}>
                            {updated_at
                              ? moment.utc(updated_at).local().format("DD/MM/YYYY, h:mm A")
                              : "-"}
                          </td>
                        )}

                        {/* Actions */}
                        <td className={clsx("px-4 text-right whitespace-nowrap", tableSettings.compactDensity ? "py-2" : "py-3")}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                requestAnimationFrame(() => {
                                  if (addStockMovementItemIdRef?.current) {
                                    addStockMovementItemIdRef.current.value = inventoryItem.id;
                                  }
                                });
                                document.getElementById("modal-add-inventory-stock-movement").showModal();
                              }}
                              className="w-8 h-8 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-slate-100 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95"
                              title={t("inventory.dropdown_add_stock_movement")}
                            >
                              <IconPlus size={16} stroke={iconStroke} />
                            </button>

                            <button
                              onClick={() => {
                                requestAnimationFrame(() => {
                                  setSelectedUpdateItem(inventoryItem.id);
                                  updateTitleRef.current.value = inventoryItem.title;
                                  updateQuantityRef.current.value = inventoryItem.quantity;
                                  updateUnitRef.current.value = inventoryItem.unit;
                                  updateMinQuantityThresholdRef.current.value = inventoryItem.min_quantity_threshold;
                                });
                                document.getElementById("modal-update-inventory-item").showModal();
                              }}
                              className="w-8 h-8 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95"
                              title={t("inventory.dropdown_update_item")}
                            >
                              <IconPencil size={16} stroke={iconStroke} />
                            </button>

                            <button
                              onClick={() => {
                                setSelectedDeleteItem(inventoryItem?.id || null);
                              }}
                              className="w-8 h-8 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition active:scale-95"
                              title={t("inventory.dropdown_delete_item")}
                            >
                              <IconTrash size={16} stroke={iconStroke} />
                            </button>
                          </div>
                        </td>
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
      {/* dialog: add stock items */}    
      <dialog id="modal-add-inventory-item" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <div className='flex justify-between items-center'>
            <h3 className="font-bold text-lg">{t('inventory.modal_add_title')}</h3>
            <button className='text-red-500 p-2 rounded-full bg-restro-bg-gray hover:bg-restro-button-hover'  onClick={() => document.getElementById('modal-add-inventory-item').close()}><IconX size={18} stroke={iconStroke}/></button>
          </div>

          {/* Title */}
          <div className="mt-4">
            <label htmlFor="item_title" className="mb-1 block text-gray-500 text-sm">{t('inventory.form_item_name_label')}</label>
            <input ref={titleRef} type="text"  className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green' placeholder={t('inventory.form_item_name_placeholder')} />
          </div>

          <div className="mt-4 flex items-end gap-4">
            <div className="flex-1">
              <label htmlFor="item_unit" className="mb-1 block text-gray-500 text-sm">{t('inventory.form_item_unit_label')}</label>
              <select ref={unitRef} className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green'>
                <option value="pc">{t('inventory.form_item_unit_pc')}</option>
                <option value="kg">{t('inventory.form_item_unit_kg')}</option>
                <option value="g">{t('inventory.form_item_unit_g')}</option>
                <option value="l">{t('inventory.form_item_unit_l')}</option>
                <option value="ml">{t('inventory.form_item_unit_ml')}</option>
              </select>
            </div>
          </div>

          {/* Current Qty and Min Qty */}
          <div className="mt-4 flex items-center gap-4">
            <div className="flex-1">
              <label htmlFor="item_qty" className="mb-1 block text-gray-500 text-sm">{t('inventory.form_item_qty_label')}</label>
              <input ref={quantityRef} type="number"  className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green' placeholder={t('inventory.form_item_qty_placeholder')} />
            </div>
            <div className="flex-1">
              <label htmlFor="low_stock_qty" className="mb-1 block text-gray-500 text-sm">{t('inventory.form_item_min_qty_label')}</label>
              <input ref={minQuantityThresholdRef} type="number" className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green' placeholder={t('inventory.form_item_min_qty_placeholder')} />
            </div>
          </div>

          {/* Actions */}
          <div className="modal-action w-full">
            <form method="dialog" className="w-full">
              <button
                type="button"
                onClick={handleAddInventoryItem}
                className='flex justify-center w-full rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'>{t('inventory.form_save_button')}</button>
            </form>
          </div>
        </div>
      </dialog>

      {/* dialog: update item */}
      <dialog id="modal-update-inventory-item" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <div className='flex justify-between items-center'>
            <h3 className="font-bold text-lg">{t('inventory.modal_update_title')}</h3>
            <button className='text-red-600 p-2 rounded-full bg-restro-bg-gray hover:bg-restro-button-hover' onClick={() => document.getElementById('modal-update-inventory-item').close()}><IconX size={18} stroke={iconStroke}/></button>
          </div>

          {/* Title */}
          <div className="mt-4">
            <label htmlFor="item_title" className="mb-1 block text-gray-500 text-sm">{t('inventory.form_update_item_name_label')}</label>
            <input ref={updateTitleRef} type="text" className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green' placeholder={t('inventory.form_item_name_placeholder')} />
          </div>

          <div className="mt-4 flex items-end gap-4">
            <div className="flex-1">
              <label htmlFor="item_unit" className="mb-1 block text-gray-500 text-sm">{t('inventory.form_update_unit_label')}</label>
              <select ref={updateUnitRef} disabled className='disabled:cursor-not-allowed text-sm w-full border rounded-lg px-4 py-2 border-restro-border-green dark:bg-black focus:outline-restro-border-green' >
                <option value="pc">{t('inventory.form_item_unit_pc')}</option>
                <option value="kg">{t('inventory.form_item_unit_kg')}</option>
                <option value="g">{t('inventory.form_item_unit_g')}</option>
                <option value="l">{t('inventory.form_item_unit_l')}</option>
                <option value="ml">{t('inventory.form_item_unit_ml')}</option>
              </select>
            </div>
          </div>

          {/* Current Qty and Min Qty */}
          <div className="mt-4 flex items-center gap-4">
            <div className="flex-1">
              <label htmlFor="item_qty" className="mb-1 block text-gray-500 text-sm">{t('inventory.form_update_qty_label')}</label>
              <input ref={updateQuantityRef} type="number" disabled className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green' placeholder={t('inventory.form_update_qty_placeholder')} />
            </div>
            <div className="flex-1">
              <label htmlFor="low_stock_qty" className="mb-1 block text-gray-500 text-sm">{t('inventory.form_update_min_qty_label')}</label>
              <input ref={updateMinQuantityThresholdRef} type="number" className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green' placeholder={t('inventory.form_update_min_qty_placeholder')} />
            </div>
          </div>

          {/* Actions */}
          <div className="modal-action w-full">
            <form method="dialog" className="w-full">
              <button
                type="button"
                onClick={() => {
                  handleUpdateInventoryItem()
                }}
                className='flex w-full justify-center rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'>{t('inventory.form_save_button')}</button>
            </form>
          </div>
        </div>
      </dialog>
      {/* dialog: update item */}

      {/* dialog: add stock */}
      <dialog id="modal-add-inventory-stock-movement" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <div className='flex justify-between items-center'>
            <h3 className="font-bold text-lg">{t('inventory.modal_add_stock_movement_title')}</h3>
            <button  className='text-red-600 p-2 rounded-full hover:bg-restro-button-hover' onClick={() => document.getElementById('modal-add-inventory-stock-movement').close()}><IconX size={18} stroke={iconStroke}/></button>
          </div>

          <div className="mt-4">
            <label htmlFor="movement_type" className="mb-1 block text-gray-500 text-sm">
              {t('inventory.modal_add_stock_movement_type')}
            </label>
            <select
              ref={addStockMovementTypeRef}
              name="movement_type"
              className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green'
              defaultValue="IN"
            >
              <option value="IN">{t('inventory.movement_type_in')}</option>
              <option value="OUT">{t('inventory.movement_type_out')}</option>
              <option value="WASTAGE">{t('inventory.movement_type_wastage')}</option>
            </select>
          </div>

          <div className="mt-4">
            <input type="hidden" ref={addStockMovementItemIdRef} />
            <label htmlFor="add_quantity" className="mb-1 block text-gray-500 text-sm">{t('inventory.form_add_stock_qty_label')}</label>
            <input
              ref={addStockMovementQuantityRef}
              type="number"
              name="add_quantity"
              className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green' 
              placeholder={t('inventory.form_add_stock_qty_placeholder')}
            />
          </div>

          <div className="mt-4">
            <label htmlFor="add_notes" className="mb-1 block text-gray-500 text-sm">{t('inventory.form_add_stock_notes_label')}</label>
            <textarea
              ref={addStockMovementNoteRef}
              name="add_notes"
              rows={4}
              className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green resize-none'
              placeholder={t('inventory.form_add_stock_notes_placeholder')}
            />
          </div>

          <div className="modal-action w-full">
            <form method="dialog" className="w-full">
              <button
                type="button"
                onClick={handleAddItemStockMovement}
                className='rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white w-full border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'
              >
                {t('inventory.form_save_button')}
              </button>
            </form>
          </div>
        </div>
      </dialog>
      {/* dialog: add stock */}

      {/* dialog: delete inventory item */}
      <DeleteModal
        isOpen={Boolean(selectedDeletItem)}
        onClose={() => setSelectedDeleteItem(null)}
        onConfirm={handleDeleteInventoryItem}
        title={t('inventory.modal_delete_title')}
        description={t('inventory.modal_delete_confirm')}
        confirmText={t('inventory.modal_delete_confirm_button')}
        cancelText={t('inventory.modal_delete_cancel')}
      />
      {/* dialog: delete inventory item */}


    </Page>
  );
}
