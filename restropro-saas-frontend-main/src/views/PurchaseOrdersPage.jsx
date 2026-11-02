import React, { useState, useEffect, useMemo, useRef } from "react";
import Page from "../components/Page";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { useLocation } from "react-router-dom";
import {
  usePurchaseOrders,
  createPurchaseOrder,
  fulfillPurchaseOrder,
  cancelPurchaseOrder,
} from "../controllers/purchase_orders.controller";
import { useSuppliersSimple } from "../controllers/supplier.controller";
import { useInventoryItems } from "../controllers/inventory.controller";
import {
  IconReceipt2,
  IconPlus,
  IconSearch,
  IconCheck,
  IconX,
  IconPrinter,
  IconAlertCircle,
  IconTruck,
  IconTrash,
  IconFileText,
  IconCalendar,
  IconEye,
  IconChevronRight,
  IconChevronLeft,
  IconChevronDown,
  IconArrowLeft,
  IconDownload,
  IconSettings,
  IconBuildingStore,
  IconPhone,
  IconUser,
  IconSparkles,
  IconPackage,
  IconMail,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import toast from "react-hot-toast";
import clsx from "clsx";
import moment from "moment";
import { Link } from "react-router-dom";

export default function PurchaseOrdersPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const location = useLocation();

  // Query params
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, error, isLoading, mutate } = usePurchaseOrders({
    page,
    perPage,
    status,
    search,
  });

  const orders = data?.orders || [];
  const pagination = data?.pagination || {
    page: 1,
    perPage: 10,
    total: 0,
    totalPages: 1,
  };
  const totalOrders = pagination.total || orders.length;
  const totalPages = pagination.totalPages || 1;

  // Table options (QuickBooks-style settings)
  const [tableSettings, setTableSettings] = useState({
    compactDensity: false,
    showGearMenu: false,
    visibleColumns: {
      items: true,
      date: true,
      amount: true,
      status: true,
    },
  });

  const [selectedOrders, setSelectedOrders] = useState(new Set());
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

  const isAllCurrentPageSelected =
    orders.length > 0 && orders.every((po) => selectedOrders.has(po.id));

  const toggleSelectAll = () => {
    const next = new Set(selectedOrders);
    if (isAllCurrentPageSelected) {
      orders.forEach((po) => next.delete(po.id));
    } else {
      orders.forEach((po) => next.add(po.id));
    }
    setSelectedOrders(next);
  };

  const toggleSelectRow = (id) => {
    const next = new Set(selectedOrders);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedOrders(next);
  };

  const handlePrintTable = () => {
    window.print();
  };

  const handleExportToExcel = async () => {
    try {
      toast.loading("Preparing export...");
      const XLSX = await import("xlsx");
      const exportList =
        selectedOrders.size > 0
          ? orders.filter((po) => selectedOrders.has(po.id))
          : orders;

      const exportData = exportList.map((po) => ({
        "PO #": `#${po.id}`,
        Supplier: po.vendor_name,
        Contact: po.contact_person,
        Phone: po.phone,
        Items: po.item_count || po.items?.length || 0,
        Date: moment(po.created_at).format("DD MMM YYYY, hh:mm A"),
        "Total Amount": parseFloat(po.total_amount || 0).toFixed(2),
        Status: po.status,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "PurchaseOrders");
      XLSX.writeFile(
        workbook,
        `Purchase_Orders_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      toast.dismiss();
      toast.success("Purchase orders exported successfully!");
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error("Failed to export purchase orders");
    }
  };

  const { suppliers } = useSuppliersSimple();
  const { data: invData } = useInventoryItems({ status: "all" });
  const inventoryItems = invData?.items || [];

  // Create PO Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View / Print PO Modal
  const [viewingPO, setViewingPO] = useState(null);

  // Fulfill confirmation modal
  const [fulfillTarget, setFulfillTarget] = useState(null);

  // Form State
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [poItems, setPoItems] = useState([
    { inventory_item_id: "", name: "", unit: "pc", current_stock: null, min_quantity_threshold: null, quantity: 1, unit_cost: 0 },
  ]);

  // Supplier Combobox State
  const [supplierSearch, setSupplierSearch] = useState("");
  const [isSupplierOpen, setIsSupplierOpen] = useState(false);

  // Item Drop Table List State
  const [itemSearch, setItemSearch] = useState("");
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false);
  const [itemFilterTab, setItemFilterTab] = useState("all"); // "all" | "low" | "out"

  // Selected supplier object from directory
  const selectedSupplier = useMemo(() => {
    if (!selectedVendorId) return null;
    return (suppliers || []).find((s) => String(s.id) === String(selectedVendorId)) || null;
  }, [suppliers, selectedVendorId]);

  // Filtered suppliers based on search query
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers || [];
    const q = supplierSearch.toLowerCase().trim();
    return (suppliers || []).filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.contact_person?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
    );
  }, [suppliers, supplierSearch]);

  const handleSelectSupplier = (s) => {
    setSelectedVendorId(String(s.id));
    setVendorName(s.name || "");
    setContactPerson(s.contact_person || "");
    setPhone(s.phone || "");
    setSupplierSearch("");
    setIsSupplierOpen(false);
  };

  const handleSetCustomSupplier = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSelectedVendorId("");
    setVendorName(trimmed);
    setSupplierSearch("");
    setIsSupplierOpen(false);
  };

  const handleClearSupplier = () => {
    setSelectedVendorId("");
    setVendorName("");
    setContactPerson("");
    setPhone("");
    setSupplierSearch("");
  };

  // Counts for catalog tabs
  const catalogCounts = useMemo(() => {
    const all = (inventoryItems || []).length;
    let low = 0;
    let out = 0;
    for (const it of inventoryItems || []) {
      const q = parseFloat(it.quantity || 0);
      const th = parseFloat(it.min_quantity_threshold || 0);
      if (q <= 0) out++;
      else if (q <= th) low++;
    }
    return { all, low, out };
  }, [inventoryItems]);

  // Filtered catalog items for drop table list
  const filteredCatalog = useMemo(() => {
    let list = inventoryItems || [];

    if (itemFilterTab === "low") {
      list = list.filter((i) => {
        const q = parseFloat(i.quantity || 0);
        const th = parseFloat(i.min_quantity_threshold || 0);
        return q <= th && q > 0;
      });
    } else if (itemFilterTab === "out") {
      list = list.filter((i) => parseFloat(i.quantity || 0) <= 0);
    }

    if (itemSearch.trim()) {
      const q = itemSearch.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.title?.toLowerCase().includes(q) ||
          i.unit?.toLowerCase().includes(q) ||
          String(i.id).includes(q)
      );
    }

    return list;
  }, [inventoryItems, itemFilterTab, itemSearch]);

  // Add catalog item to poItems
  const handleAddCatalogItem = (catItem) => {
    setPoItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) => String(it.inventory_item_id) === String(catItem.id)
      );
      if (existingIdx >= 0) {
        const copy = [...prev];
        const curQty = parseFloat(copy[existingIdx].quantity || 0);
        copy[existingIdx] = {
          ...copy[existingIdx],
          quantity: Math.round((curQty + 1) * 100) / 100,
        };
        toast.success(`Incremented ${catItem.title} quantity to ${copy[existingIdx].quantity}`);
        return copy;
      }

      const curStock = parseFloat(catItem.quantity || 0);
      const threshold = parseFloat(catItem.min_quantity_threshold || 0);
      const newItem = {
        inventory_item_id: catItem.id,
        name: catItem.title,
        unit: catItem.unit || "pc",
        current_stock: curStock,
        min_quantity_threshold: threshold,
        quantity: 1,
        unit_cost: 0,
      };

      if (prev.length === 1 && !prev[0].name && !prev[0].inventory_item_id) {
        toast.success(`Added ${catItem.title}`);
        return [newItem];
      }

      toast.success(`Added ${catItem.title}`);
      return [...prev, newItem];
    });
  };

  // Add custom item from search input
  const handleAddCustomItem = () => {
    if (!itemSearch.trim()) return;
    const name = itemSearch.trim();
    setPoItems((prev) => {
      const newItem = {
        inventory_item_id: "",
        name,
        unit: "pc",
        current_stock: null,
        min_quantity_threshold: null,
        quantity: 1,
        unit_cost: 0,
      };
      if (prev.length === 1 && !prev[0].name && !prev[0].inventory_item_id) {
        return [newItem];
      }
      return [...prev, newItem];
    });
    toast.success(`Added "${name}" as custom restock item`);
    setItemSearch("");
    setIsItemPickerOpen(false);
  };

  // Add empty custom item line directly
  const handleAddEmptyCustomRow = () => {
    setPoItems((prev) => [
      ...prev,
      {
        inventory_item_id: "",
        name: "",
        unit: "pc",
        current_stock: null,
        min_quantity_threshold: null,
        quantity: 1,
        unit_cost: 0,
      },
    ]);
  };

  // Auto-Add all low stock or depleted items
  const handleAutoAddLowStock = () => {
    const lowItems = (inventoryItems || []).filter((item) => {
      const q = parseFloat(item.quantity || 0);
      const th = parseFloat(item.min_quantity_threshold || 0);
      return q <= th;
    });

    if (lowItems.length === 0) {
      toast("No low-stock or depleted items in inventory catalog.", { icon: "ℹ️" });
      return;
    }

    setPoItems((prev) => {
      const existingIds = new Set(
        prev.filter((i) => i.inventory_item_id).map((i) => String(i.inventory_item_id))
      );

      const itemsToAdd = lowItems
        .filter((item) => !existingIds.has(String(item.id)))
        .map((item) => {
          const curStock = parseFloat(item.quantity || 0);
          const threshold = parseFloat(item.min_quantity_threshold || 0);
          const targetQty = Math.max(1, Math.ceil(threshold > 0 ? threshold * 2 - curStock : 10));

          return {
            inventory_item_id: item.id,
            name: item.title,
            unit: item.unit || "pc",
            current_stock: curStock,
            min_quantity_threshold: threshold,
            quantity: targetQty,
            unit_cost: 0,
          };
        });

      if (itemsToAdd.length === 0) {
        toast("All low stock items are already added to this purchase order.", { icon: "ℹ️" });
        return prev;
      }

      toast.success(`Added ${itemsToAdd.length} low-stock items to order!`);
      const cleanPrev = prev.filter((i) => i.name || i.inventory_item_id);
      return [...cleanPrev, ...itemsToAdd];
    });
  };

  const handleRemoveItemRow = (index) => {
    if (poItems.length === 1) {
      setPoItems([
        {
          inventory_item_id: "",
          name: "",
          unit: "pc",
          current_stock: null,
          min_quantity_threshold: null,
          quantity: 1,
          unit_cost: 0,
        },
      ]);
      return;
    }
    setPoItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index, field, value) => {
    setPoItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Stock badge rendering helper
  const renderStockBadge = (stockQty, threshold) => {
    if (stockQty === null || stockQty === undefined) {
      return <span className="text-gray-400 font-mono text-xs">—</span>;
    }
    const q = parseFloat(stockQty);
    const th = parseFloat(threshold || 0);

    if (q <= 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40">
          Out ({q})
        </span>
      );
    }
    if (q <= th) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
          Low ({q})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
        {q} in stock
      </span>
    );
  };

  // Live order calculations
  const orderSummary = useMemo(() => {
    const validLines = poItems.filter((i) => (i.name && i.name.trim()) || i.inventory_item_id);
    let totalUnits = 0;
    let totalCost = 0;
    for (const it of validLines) {
      const q = parseFloat(it.quantity) || 0;
      const c = parseFloat(it.unit_cost) || 0;
      totalUnits += q;
      totalCost += q * c;
    }
    return {
      lineCount: validLines.length,
      totalUnits: Math.round(totalUnits * 100) / 100,
      totalCost,
    };
  }, [poItems]);

  const resetCreateForm = () => {
    setSelectedVendorId("");
    setVendorName("");
    setContactPerson("");
    setPhone("");
    setNotes("");
    setSupplierSearch("");
    setIsSupplierOpen(false);
    setItemSearch("");
    setIsItemPickerOpen(false);
    setItemFilterTab("all");
    setPoItems([
      {
        inventory_item_id: "",
        name: "",
        unit: "pc",
        current_stock: null,
        min_quantity_threshold: null,
        quantity: 1,
        unit_cost: 0,
      },
    ]);
  };

  // Check URL query parameters for pre-selected vendor or action
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get("action");
    const vId = params.get("vendorId");

    if (vId && suppliers.length > 0) {
      const found = suppliers.find((s) => String(s.id) === String(vId));
      if (found) {
        setSelectedVendorId(String(found.id));
        setVendorName(found.name);
        setContactPerson(found.contact_person || "");
        setPhone(found.phone || "");
      }
    }

    if (action === "create") {
      setIsCreateModalOpen(true);
    }
  }, [location.search, suppliers]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    if (!vendorName.trim()) {
      toast.error(t("purchase_orders.vendor_required", "Please select or enter a supplier name."));
      return;
    }

    const validItems = poItems.filter((it) => it.name && it.name.trim());
    if (validItems.length === 0) {
      toast.error(t("purchase_orders.item_required", "Please add at least one item to the purchase order."));
      return;
    }

    try {
      setIsSubmitting(true);
      await createPurchaseOrder({
        vendorId: selectedVendorId ? Number(selectedVendorId) : null,
        vendorName: vendorName.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
        items: validItems,
      });

      toast.success(t("purchase_orders.created_success", "Purchase Order created successfully!"));
      setIsCreateModalOpen(false);
      resetCreateForm();
      mutate();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || t("purchase_orders.create_failed", "Failed to create order.");
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFulfillOrder = async () => {
    if (!fulfillTarget) return;
    try {
      setIsSubmitting(true);
      await fulfillPurchaseOrder(fulfillTarget.id);
      toast.success(
        t(
          "purchase_orders.received_success",
          "Goods received! Inventory quantities have been automatically restocked."
        )
      );
      setFulfillTarget(null);
      mutate();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || t("purchase_orders.fulfill_failed", "Failed to receive order.");
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async (po) => {
    if (!window.confirm(t("purchase_orders.confirm_cancel", "Are you sure you want to cancel this order?"))) {
      return;
    }
    try {
      await cancelPurchaseOrder(po.id);
      toast.success(t("purchase_orders.cancelled_success", "Purchase order cancelled."));
      mutate();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to cancel order.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Page className="px-4 py-4 md:px-8 md:py-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-gray-100 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard/suppliers"
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 md:hidden"
            >
              <IconArrowLeft size={20} />
            </Link>
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <IconReceipt2 size={24} stroke={2} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                {t("navbar.purchase_orders", "Purchase Orders & Restock")}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t(
                  "purchase_orders.subtitle",
                  "Create restock orders to suppliers, receive deliveries, and automatically replenish inventory."
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            to="/dashboard/suppliers"
            className="min-h-[42px] px-4 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-200 font-medium text-sm flex items-center gap-2 transition active:scale-95"
          >
            <IconTruck size={18} />
            <span>{t("navbar.vendors_directory", "Suppliers Directory")}</span>
          </Link>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="min-h-[42px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-medium text-sm flex items-center gap-2 shadow-sm transition"
          >
            <IconPlus size={18} stroke={2.5} />
            <span>{t("purchase_orders.btn_create", "New Purchase Order")}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 my-5 overflow-x-auto pb-1">
        {[
          { id: "all", label: t("common.all", "All Orders") },
          { id: "ordered", label: t("purchase_orders.status_pending", "Pending Delivery") },
          { id: "completed", label: t("purchase_orders.status_received", "Received / Restocked") },
          { id: "cancelled", label: t("purchase_orders.status_cancelled", "Cancelled") },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setStatus(tab.id);
              setPage(1);
            }}
            className={clsx(
              "min-h-[38px] px-4 rounded-xl text-xs font-semibold whitespace-nowrap transition active:scale-95",
              status === tab.id
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm"
                : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Selection Action Banner (When rows are checked) ── */}
      {selectedOrders.size > 0 && (
        <div className="mb-3 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              {selectedOrders.size} order{selectedOrders.size > 1 ? "s" : ""} selected
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
              onClick={() => setSelectedOrders(new Set())}
              className="px-3 py-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium hover:bg-slate-200/60 dark:hover:bg-neutral-800 transition"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* ── Filter & Action Bar Directly Above Table (QuickBooks Style - Matching First Image) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        {/* Left Side: Filter by name or number + Status Dropdown */}
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          {/* Search Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput);
              setPage(1);
            }}
            className="relative flex-1 min-w-[200px]"
          >
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <IconSearch size={16} stroke={iconStroke} />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Filter by name or number"
              className="w-full min-h-[38px] pl-9 pr-8 py-1.5 text-xs sm:text-[13px] rounded-md border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#18181b] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setPage(1);
                }}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <IconX size={14} stroke={iconStroke} />
              </button>
            )}
          </form>

          {/* Quick Filter Dropdown */}
          <div className="relative">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="min-h-[38px] px-3 pr-8 py-1.5 text-xs sm:text-[13px] font-normal rounded-md border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#18181b] text-slate-800 dark:text-slate-100 appearance-none focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
            >
              <option value="all">All</option>
              <option value="ordered">Pending Delivery</option>
              <option value="completed">Received</option>
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
                      { key: "items", label: "Items" },
                      { key: "date", label: "Date" },
                      { key: "amount", label: "Total Amount" },
                      { key: "status", label: "Status" },
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
                    value={perPage}
                    onChange={(e) => {
                      setPerPage(Number(e.target.value));
                      setPage(1);
                    }}
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
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className={clsx(
                "flex items-center gap-0.5 hover:text-slate-900 dark:hover:text-white transition",
                page <= 1 && "opacity-40 cursor-not-allowed hover:text-slate-600"
              )}
            >
              <IconChevronLeft size={14} stroke={iconStroke} />
              <span>Previous</span>
            </button>

            <span className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
              {totalOrders > 0
                ? `${(page - 1) * perPage + 1} - ${Math.min(
                    page * perPage,
                    totalOrders
                  )}`
                : "0 - 0"}
              <span className="text-slate-400 font-normal"> of {totalOrders}</span>
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              className={clsx(
                "flex items-center gap-0.5 hover:text-slate-900 dark:hover:text-white transition",
                page >= totalPages && "opacity-40 cursor-not-allowed hover:text-slate-600"
              )}
            >
              <span>Next</span>
              <IconChevronRight size={14} stroke={iconStroke} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Orders Table Container (QuickBooks Style) ── */}
      <div>
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-400">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-600" />
            <span className="text-sm">{t("common.loading", "Loading purchase orders...")}</span>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-red-500 text-sm">
            {t("purchase_orders.error_loading", "Failed to load purchase orders.")}
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 px-4 text-center flex flex-col items-center justify-center bg-white dark:bg-[#18181b] rounded-2xl border border-slate-200 dark:border-neutral-800">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-neutral-800 flex items-center justify-center text-gray-400 mb-3">
              <IconReceipt2 size={32} />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
              {t("purchase_orders.no_orders", "No purchase orders found")}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-4">
              {t(
                "purchase_orders.no_orders_desc",
                "Create a purchase order to request new ingredients and restock supplies from your vendors."
              )}
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center gap-2"
            >
              <IconPlus size={18} />
              <span>{t("purchase_orders.btn_create", "New Purchase Order")}</span>
            </button>
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
                        aria-label="Select all purchase orders"
                        className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-3">PO #</th>
                    <th className="px-3 py-3">{t("purchase_orders.col_supplier", "Supplier")}</th>
                    {tableSettings.visibleColumns.items && (
                      <th className="px-3 py-3">{t("purchase_orders.col_items", "Items")}</th>
                    )}
                    {tableSettings.visibleColumns.date && (
                      <th className="px-3 py-3">{t("purchase_orders.col_date", "Date")}</th>
                    )}
                    {tableSettings.visibleColumns.amount && (
                      <th className="px-3 py-3 text-right">{t("purchase_orders.col_amount", "Total Amount")}</th>
                    )}
                    {tableSettings.visibleColumns.status && (
                      <th className="px-3 py-3 text-center">{t("common.status", "Status")}</th>
                    )}
                    <th className="px-4 py-3 text-right">{t("common.actions", "Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80">
                  {orders.map((po) => {
                    const isSelected = selectedOrders.has(po.id);

                    return (
                      <tr
                        key={po.id}
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
                            onChange={() => toggleSelectRow(po.id)}
                            className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>

                        {/* PO # */}
                        <td className={clsx("px-3 font-mono font-bold text-slate-900 dark:text-white", tableSettings.compactDensity ? "py-2" : "py-3")}>
                          #{po.id}
                        </td>

                        {/* Supplier */}
                        <td className={clsx("px-3", tableSettings.compactDensity ? "py-2" : "py-3")}>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {po.vendor_name}
                          </div>
                          {po.contact_person && (
                            <div className="text-xs text-slate-400 dark:text-neutral-500">
                              {po.contact_person} {po.phone ? `(${po.phone})` : ""}
                            </div>
                          )}
                        </td>

                        {/* Items */}
                        {tableSettings.visibleColumns.items && (
                          <td className={clsx("px-3", tableSettings.compactDensity ? "py-2" : "py-3")}>
                            <div className="text-xs text-slate-700 dark:text-slate-300">
                              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                {po.item_count || po.items?.length || 0} items
                              </span>
                              {po.items && po.items.length > 0 && (
                                <div className="text-[11px] text-slate-400 dark:text-neutral-500 truncate max-w-xs mt-0.5">
                                  {po.items.map((i) => `${i.inventory_item_name} (${i.quantity} ${i.inventory_item_unit})`).join(", ")}
                                </div>
                              )}
                            </div>
                          </td>
                        )}

                        {/* Date */}
                        {tableSettings.visibleColumns.date && (
                          <td className={clsx("px-3", tableSettings.compactDensity ? "py-2" : "py-3")}>
                            <div className="text-xs text-slate-800 dark:text-slate-200">
                              {moment(po.created_at).format("DD MMM YYYY")}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-neutral-500">
                              {moment(po.created_at).format("hh:mm A")}
                            </div>
                          </td>
                        )}

                        {/* Total Amount */}
                        {tableSettings.visibleColumns.amount && (
                          <td className={clsx("px-3 text-right font-medium tabular-nums text-slate-900 dark:text-white whitespace-nowrap", tableSettings.compactDensity ? "py-2" : "py-3")}>
                            ${parseFloat(po.total_amount || 0).toFixed(2)}
                          </td>
                        )}

                        {/* Status (BAL style) */}
                        {tableSettings.visibleColumns.status && (
                          <td className={clsx("px-3 text-center whitespace-nowrap", tableSettings.compactDensity ? "py-2" : "py-3")}>
                            <span
                              className={clsx(
                                "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border",
                                po.status === "completed"
                                  ? "bg-[#dcfce7] text-[#15803d] dark:bg-emerald-950/70 dark:text-emerald-400 border-[#bbf7d0] dark:border-emerald-800"
                                  : po.status === "ordered"
                                  ? "bg-[#fef3c7] text-[#b45309] dark:bg-amber-950/70 dark:text-amber-400 border-[#fde68a] dark:border-amber-800"
                                  : "bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-400 border-slate-200 dark:border-neutral-700"
                              )}
                            >
                              {po.status === "completed"
                                ? t("purchase_orders.status_received", "Received & Restocked")
                                : po.status === "ordered"
                                ? t("purchase_orders.status_pending", "Pending Delivery")
                                : po.status}
                            </span>
                          </td>
                        )}

                        {/* Actions */}
                        <td className={clsx("px-4 text-right whitespace-nowrap", tableSettings.compactDensity ? "py-2" : "py-3")}>
                          <div className="flex items-center justify-end gap-1.5">
                            {po.status === "ordered" && (
                              <button
                                onClick={() => setFulfillTarget(po)}
                                className="min-h-[30px] px-2.5 rounded-md bg-[#107c41] hover:bg-[#0c6634] active:scale-95 text-white font-medium text-xs flex items-center gap-1 shadow-2xs transition"
                                title={t("purchase_orders.btn_receive", "Receive Goods & Restock")}
                              >
                                <IconCheck size={13} stroke={2.5} />
                                <span>{t("purchase_orders.btn_receive", "Receive Goods")}</span>
                              </button>
                            )}

                            <button
                              onClick={() => setViewingPO(po)}
                              className="w-8 h-8 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 transition active:scale-95 flex items-center justify-center"
                              title={t("purchase_orders.view_po", "View / Print Invoice")}
                            >
                              <IconEye size={16} />
                            </button>

                            {po.status === "ordered" && (
                              <button
                                onClick={() => handleCancelOrder(po)}
                                className="w-8 h-8 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition active:scale-95 flex items-center justify-center"
                                title={t("common.cancel", "Cancel Order")}
                              >
                                <IconX size={16} />
                              </button>
                            )}
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
                Showing {totalOrders > 0 ? (page - 1) * perPage + 1 : 0} to{" "}
                {Math.min(page * perPage, totalOrders)} of {totalOrders} entries
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className={clsx(
                    "flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition",
                    page <= 1 && "opacity-40 cursor-not-allowed hover:text-slate-600"
                  )}
                >
                  <IconChevronLeft size={14} stroke={iconStroke} />
                  <span>Previous</span>
                </button>

                <span className="tabular-nums">
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className={clsx(
                    "flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition",
                    page >= totalPages && "opacity-40 cursor-not-allowed hover:text-slate-600"
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

      {/* Create Purchase Order Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-4xl lg:max-w-5xl max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between bg-slate-50/50 dark:bg-neutral-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <IconReceipt2 size={22} stroke={iconStroke} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    {t("purchase_orders.create_title", "Create Purchase Order to Supplier")}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("purchase_orders.create_subtitle", "Search catalog items, review live inventory stock, and dispatch PO to vendor.")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  resetCreateForm();
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition"
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* Section 1: Supplier & Delivery Details */}
              <div className="bg-slate-50/70 dark:bg-neutral-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-neutral-700/80 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <IconBuildingStore size={16} className="text-emerald-600 dark:text-emerald-400" />
                    <span>{t("purchase_orders.supplier_details", "Supplier Information")}</span>
                  </span>
                  {(selectedVendorId || vendorName) && (
                    <button
                      type="button"
                      onClick={handleClearSupplier}
                      className="text-xs text-slate-500 hover:text-rose-600 transition flex items-center gap-1"
                    >
                      <IconX size={13} />
                      <span>{t("common.clear", "Change Supplier")}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Supplier Search Combobox */}
                  <div className="md:col-span-6 relative">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {t("purchase_orders.supplier_combobox_label", "Select or Search Supplier")} *
                    </label>
                    <div className="relative">
                      <IconBuildingStore
                        size={18}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        required
                        value={isSupplierOpen ? supplierSearch : vendorName || supplierSearch}
                        onFocus={() => {
                          setIsSupplierOpen(true);
                          setSupplierSearch(vendorName);
                        }}
                        onChange={(e) => {
                          setSupplierSearch(e.target.value);
                          setVendorName(e.target.value);
                          setIsSupplierOpen(true);
                        }}
                        placeholder={t("purchase_orders.search_supplier_placeholder", "Search supplier by name, phone, or contact...")}
                        className="w-full min-h-[42px] pl-10 pr-9 text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                      {(vendorName || supplierSearch) && (
                        <button
                          type="button"
                          onClick={handleClearSupplier}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <IconX size={15} />
                        </button>
                      )}
                    </div>

                    {/* Supplier Dropdown Popover */}
                    {isSupplierOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-30"
                          onClick={() => setIsSupplierOpen(false)}
                        />
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-2xl shadow-2xl z-40 max-h-64 overflow-y-auto">
                          {filteredSuppliers.length === 0 ? (
                            <div className="p-3.5 text-xs text-slate-400 text-center">
                              {t("purchase_orders.no_suppliers_found", "No registered suppliers match your search.")}
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-100 dark:divide-neutral-700/60">
                              {filteredSuppliers.map((s) => (
                                <div
                                  key={s.id}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectSupplier(s);
                                  }}
                                  className="p-3 hover:bg-emerald-50/70 dark:hover:bg-neutral-700/70 cursor-pointer transition flex items-center justify-between"
                                >
                                  <div>
                                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                                      {s.name}
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                                      {s.contact_person && <span>{s.contact_person}</span>}
                                      {s.phone && (
                                        <span className="font-mono text-emerald-600 dark:text-emerald-400">
                                          {s.phone}
                                        </span>
                                      )}
                                      {s.city && <span>• {s.city}</span>}
                                    </div>
                                  </div>
                                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                                    Select
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {supplierSearch.trim() &&
                            !filteredSuppliers.some(
                              (s) => s.name?.toLowerCase() === supplierSearch.toLowerCase().trim()
                            ) && (
                              <div
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSetCustomSupplier(supplierSearch);
                                }}
                                className="p-3 border-t border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-900/60 hover:bg-emerald-50 dark:hover:bg-neutral-700/80 cursor-pointer transition text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"
                              >
                                <IconPlus size={14} />
                                <span>
                                  {t("purchase_orders.use_custom_supplier", "Use \"{{name}}\" as new supplier", {
                                    name: supplierSearch.trim(),
                                  })}
                                </span>
                              </div>
                            )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Contact Person */}
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {t("purchase_orders.form_contact_person", "Contact Person")}
                    </label>
                    <div className="relative">
                      <IconUser
                        size={17}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        placeholder="e.g. Sales Rep / Manager"
                        className="w-full min-h-[42px] pl-10 pr-3 text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {t("purchase_orders.form_phone", "Phone / Telegram")}
                    </label>
                    <div className="relative">
                      <IconPhone
                        size={17}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +855 12 345 678"
                        className="w-full min-h-[42px] pl-10 pr-3 text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>
                  </div>
                </div>

                {/* Selected Supplier Live Card (if from directory) */}
                {selectedSupplier && (
                  <div className="p-3 rounded-xl bg-white dark:bg-neutral-800 border border-emerald-200 dark:border-emerald-800/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                        <IconBuildingStore size={15} className="text-emerald-600" />
                        {selectedSupplier.name}
                      </span>
                      {selectedSupplier.contact_person && (
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <IconUser size={13} /> {selectedSupplier.contact_person}
                        </span>
                      )}
                      {selectedSupplier.phone && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
                          <IconPhone size={13} /> {selectedSupplier.phone}
                        </span>
                      )}
                      {selectedSupplier.email && (
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <IconMail size={13} /> {selectedSupplier.email}
                        </span>
                      )}
                      {selectedSupplier.tax_id_no && (
                        <span className="text-slate-500 dark:text-slate-400">
                          Tax ID: {selectedSupplier.tax_id_no}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                      Directory Supplier
                    </span>
                  </div>
                )}
              </div>

              {/* Section 2: Restock Items & Drop Table List */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {t("purchase_orders.form_items", "Restock Items & Ingredients")}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-300">
                      {orderSummary.lineCount} {orderSummary.lineCount === 1 ? "line" : "lines"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAutoAddLowStock}
                      className="min-h-[36px] px-3 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                    >
                      <IconSparkles size={15} className="text-amber-600 dark:text-amber-400" />
                      <span>{t("purchase_orders.btn_auto_add_low_stock", "Auto-Add Low Stock Items")}</span>
                      {catalogCounts.low + catalogCounts.out > 0 && (
                        <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
                          {catalogCounts.low + catalogCounts.out}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleAddEmptyCustomRow}
                      className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 transition active:scale-95"
                    >
                      <IconPlus size={14} />
                      <span>{t("purchase_orders.add_custom_line", "Add Blank Row")}</span>
                    </button>
                  </div>
                </div>

                {/* Global Search Bar + Drop Table List */}
                <div className="relative">
                  <div className="relative">
                    <IconSearch
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      value={itemSearch}
                      onFocus={() => setIsItemPickerOpen(true)}
                      onChange={(e) => {
                        setItemSearch(e.target.value);
                        setIsItemPickerOpen(true);
                      }}
                      placeholder={t(
                        "purchase_orders.search_catalog_placeholder",
                        "Search catalog item to add (or type custom item name)..."
                      )}
                      className="w-full min-h-[42px] pl-10 pr-9 text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50/50 dark:bg-neutral-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                    {itemSearch && (
                      <button
                        type="button"
                        onClick={() => setItemSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <IconX size={16} />
                      </button>
                    )}
                  </div>

                  {/* Drop Table List Popover */}
                  {isItemPickerOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setIsItemPickerOpen(false)}
                      />
                      <div className="absolute top-full left-0 right-0 sm:left-auto sm:right-0 sm:w-[600px] mt-1.5 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-2xl shadow-2xl z-30 overflow-hidden flex flex-col">
                        {/* Dropdown Filter Tabs */}
                        <div className="px-3.5 py-2 border-b border-slate-100 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-900/60 flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setItemFilterTab("all")}
                              className={clsx(
                                "px-2.5 py-1 rounded-lg text-xs font-semibold transition",
                                itemFilterTab === "all"
                                  ? "bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-xs"
                                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                              )}
                            >
                              All ({catalogCounts.all})
                            </button>
                            <button
                              type="button"
                              onClick={() => setItemFilterTab("low")}
                              className={clsx(
                                "px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1",
                                itemFilterTab === "low"
                                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 shadow-xs"
                                  : "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                              )}
                            >
                              Low Stock ({catalogCounts.low})
                            </button>
                            <button
                              type="button"
                              onClick={() => setItemFilterTab("out")}
                              className={clsx(
                                "px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1",
                                itemFilterTab === "out"
                                  ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 shadow-xs"
                                  : "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                              )}
                            >
                              Out of Stock ({catalogCounts.out})
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsItemPickerOpen(false)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            <IconX size={15} />
                          </button>
                        </div>

                        {/* Dropdown Catalog Table */}
                        <div className="max-h-72 overflow-y-auto">
                          {filteredCatalog.length === 0 ? (
                            <div className="p-6 text-center text-xs text-slate-400">
                              {t("purchase_orders.no_catalog_items_match", "No catalog items match your search.")}
                            </div>
                          ) : (
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-slate-50/80 dark:bg-neutral-900/80 sticky top-0 border-b border-slate-100 dark:border-neutral-700/60 text-slate-500 uppercase tracking-wider font-semibold z-10 text-[10px]">
                                <tr>
                                  <th className="py-2 px-3.5">Catalog Item</th>
                                  <th className="py-2 px-2 text-center w-16">Unit</th>
                                  <th className="py-2 px-3 text-right w-28">Live Stock</th>
                                  <th className="py-2 px-3 text-center w-16"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-neutral-700/60">
                                {filteredCatalog.map((item) => (
                                  <tr
                                    key={item.id}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleAddCatalogItem(item);
                                    }}
                                    className="hover:bg-emerald-50/70 dark:hover:bg-neutral-700/60 transition cursor-pointer group"
                                  >
                                    <td className="py-2.5 px-3.5 font-medium text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                                      {item.title}
                                    </td>
                                    <td className="py-2.5 px-2 text-center">
                                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                                        {item.unit}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      {renderStockBadge(item.quantity, item.min_quantity_threshold)}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <span className="min-h-[26px] px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white text-[11px] font-semibold transition flex items-center justify-center gap-1">
                                        <IconPlus size={12} stroke={2.5} />
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>

                        {/* Custom Item Fallback Action */}
                        {itemSearch.trim() && (
                          <div
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleAddCustomItem();
                            }}
                            className="p-3 border-t border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-900/60 hover:bg-emerald-50 dark:hover:bg-neutral-700/80 cursor-pointer transition text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-between"
                          >
                            <span className="flex items-center gap-1.5">
                              <IconPlus size={15} />
                              <span>
                                {t("purchase_orders.add_custom_item", "Add \"{{name}}\" as custom restock item", {
                                  name: itemSearch.trim(),
                                })}
                              </span>
                            </span>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                              Custom Row
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* 7-Column Line Items Table */}
                <div className="border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-white dark:bg-neutral-900">
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                      <thead className="bg-slate-50 dark:bg-neutral-800/80 border-b border-slate-200 dark:border-neutral-800 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                        <tr>
                          <th className="py-3 px-3 w-10 text-center">#</th>
                          <th className="py-3 px-3">{t("purchase_orders.table_item", "Item Description")}</th>
                          <th className="py-3 px-3 w-28 text-center">{t("purchase_orders.table_stock", "Current Stock")}</th>
                          <th className="py-3 px-3 w-28 text-center">{t("purchase_orders.table_qty", "Order Qty")} *</th>
                          <th className="py-3 px-3 w-24 text-center">{t("purchase_orders.table_unit", "Unit")}</th>
                          <th className="py-3 px-3 w-32 text-right">{t("purchase_orders.table_cost", "Unit Cost ($)")}</th>
                          <th className="py-3 px-3 w-32 text-right">{t("purchase_orders.table_line_total", "Line Total ($)")}</th>
                          <th className="py-3 px-3 w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                        {poItems.map((row, idx) => {
                          const qty = parseFloat(row.quantity) || 0;
                          const cost = parseFloat(row.unit_cost) || 0;
                          const lineTotal = qty * cost;

                          return (
                            <tr
                              key={idx}
                              className="hover:bg-slate-50/60 dark:hover:bg-neutral-800/50 transition"
                            >
                              {/* Row index */}
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>

                              {/* Item Description */}
                              <td className="py-2.5 px-3">
                                {row.inventory_item_id ? (
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-900 dark:text-white text-xs">
                                      {row.name}
                                    </span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                                      Catalog
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      required
                                      value={row.name}
                                      onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                                      placeholder="Custom item name..."
                                      className="w-full min-h-[34px] px-2.5 text-xs rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    />
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-neutral-700 shrink-0">
                                      Custom
                                    </span>
                                  </div>
                                )}
                              </td>

                              {/* Current Stock */}
                              <td className="py-2.5 px-3 text-center">
                                {row.inventory_item_id
                                  ? renderStockBadge(row.current_stock, row.min_quantity_threshold)
                                  : <span className="text-slate-400 font-mono text-xs">—</span>}
                              </td>

                              {/* Order Qty */}
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="number"
                                  step="any"
                                  min="0.01"
                                  required
                                  value={row.quantity}
                                  onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                                  className="w-full min-h-[36px] px-2 text-center text-xs font-bold rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </td>

                              {/* Unit */}
                              <td className="py-2.5 px-3 text-center">
                                <select
                                  value={row.unit}
                                  onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                                  className="w-full min-h-[36px] px-1.5 text-center text-xs rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                >
                                  <option value="kg">kg</option>
                                  <option value="g">g</option>
                                  <option value="pc">pc</option>
                                  <option value="l">l</option>
                                  <option value="ml">ml</option>
                                  <option value="box">box</option>
                                  <option value="bottle">bottle</option>
                                  <option value="pack">pack</option>
                                  <option value="can">can</option>
                                </select>
                              </td>

                              {/* Unit Cost */}
                              <td className="py-2.5 px-3 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={row.unit_cost}
                                  onChange={(e) => handleItemChange(idx, "unit_cost", e.target.value)}
                                  placeholder="0.00"
                                  className="w-full min-h-[36px] px-2 text-right font-mono text-xs rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </td>

                              {/* Line Total */}
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                ${lineTotal.toFixed(2)}
                              </td>

                              {/* Action */}
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemRow(idx)}
                                  disabled={poItems.length === 1 && !poItems[0].name}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-20 transition"
                                >
                                  <IconTrash size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Sub-bar: Summary & Fast Row Add */}
                  <div className="p-3.5 bg-slate-50 dark:bg-neutral-800/60 border-t border-slate-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAddEmptyCustomRow}
                        className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <IconPlus size={14} />
                        <span>{t("purchase_orders.add_line_item", "Add Another Line")}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <div className="text-slate-500 dark:text-slate-400">
                        {t("purchase_orders.total_units", "Total Units:")}{" "}
                        <span className="font-bold text-slate-900 dark:text-white font-mono">
                          {orderSummary.totalUnits}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="text-slate-500 dark:text-slate-400 font-normal">
                          {t("common.subtotal", "Est. Total:")}
                        </span>
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          ${orderSummary.totalCost.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Notes / Supplier Instructions */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("purchase_orders.form_notes", "Notes & Delivery Instructions for Supplier")}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Please deliver before 10:00 AM, send commercial invoice on delivery."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              {/* Footer Actions */}
              <div className="pt-4 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    resetCreateForm();
                  }}
                  className="min-h-[42px] px-5 rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-slate-300 text-sm font-medium transition"
                >
                  {t("common.cancel", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !vendorName.trim() || orderSummary.lineCount === 0}
                  className="min-h-[42px] px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold shadow-sm transition active:scale-95 flex items-center gap-2"
                >
                  <IconReceipt2 size={18} />
                  <span>
                    {isSubmitting
                      ? t("common.saving", "Saving Order...")
                      : t("purchase_orders.submit_order", "Create & Dispatch PO")}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fulfill / Goods Receipt Confirmation Modal */}
      {fulfillTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-100 dark:border-neutral-800">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
              <IconCheck size={28} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              {t("purchase_orders.fulfill_modal_title", "Confirm Goods Receipt")}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {t(
                "purchase_orders.fulfill_modal_desc",
                "Receiving PO #{{id}} from {{vendor}} will automatically add all item quantities to your live restaurant stock and record an IN inventory log.",
                { id: fulfillTarget.id, vendor: fulfillTarget.vendor_name }
              )}
            </p>

            <div className="bg-gray-50 dark:bg-neutral-800/50 p-3 rounded-xl mb-6 text-xs space-y-1">
              {fulfillTarget.items?.map((it, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{it.inventory_item_name}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    +{it.quantity} {it.inventory_item_unit}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setFulfillTarget(null)}
                className="min-h-[42px] px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-100 dark:hover:bg-neutral-800 transition"
              >
                {t("common.cancel", "Cancel")}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFulfillOrder}
                className="min-h-[42px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium shadow-sm transition active:scale-95"
              >
                {isSubmitting
                  ? t("common.processing", "Processing...")
                  : t("purchase_orders.btn_confirm_receive", "Confirm & Restock Stock")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View / Print Purchase Order Modal */}
      {viewingPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 dark:border-neutral-800 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between print:hidden">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <IconFileText size={20} className="text-emerald-600" />
                <span>Purchase Order #{viewingPO.id}</span>
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="min-h-[36px] px-3 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                >
                  <IconPrinter size={15} />
                  <span>{t("common.print", "Print")}</span>
                </button>
                <button
                  onClick={() => setViewingPO(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition"
                >
                  <IconX size={18} />
                </button>
              </div>
            </div>

            {/* Printable Body */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 text-gray-800 dark:text-gray-200" id="printable-po">
              {/* Invoice Header */}
              <div className="flex justify-between items-start pb-6 border-b border-gray-200 dark:border-neutral-700">
                <div>
                  <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                    PURCHASE ORDER
                  </h1>
                  <div className="text-sm font-mono text-gray-500 mt-1">PO #{viewingPO.id}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Date: {moment(viewingPO.created_at).format("DD MMMM YYYY, hh:mm A")}
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={clsx(
                      "inline-block px-3 py-1 rounded-full text-xs font-bold uppercase",
                      viewingPO.status === "completed"
                        ? "bg-emerald-100 text-emerald-800"
                        : viewingPO.status === "ordered"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-gray-100 text-gray-700"
                    )}
                  >
                    {viewingPO.status}
                  </span>
                </div>
              </div>

              {/* Vendor & Delivery Details */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-bold text-gray-400 uppercase tracking-wider mb-1">VENDOR / SUPPLIER</div>
                  <div className="font-bold text-sm text-gray-900 dark:text-white">{viewingPO.vendor_name}</div>
                  {viewingPO.contact_person && <div>Contact: {viewingPO.contact_person}</div>}
                  {viewingPO.phone && <div>Phone: {viewingPO.phone}</div>}
                  {viewingPO.tax_id_no && <div>Tax ID: {viewingPO.tax_id_no}</div>}
                </div>

                <div className="text-right">
                  <div className="font-bold text-gray-400 uppercase tracking-wider mb-1">ORDER CREATED BY</div>
                  <div className="font-semibold text-gray-900 dark:text-white">{viewingPO.created_by || "Restaurant Staff"}</div>
                  {viewingPO.fullfilled_at && (
                    <div className="text-emerald-600 mt-1">
                      Received on: {moment(viewingPO.fullfilled_at).format("DD MMM YYYY, hh:mm A")}
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items */}
              <div className="border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-neutral-800 font-semibold text-gray-600 dark:text-gray-300">
                    <tr>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3 text-center">Unit</th>
                      <th className="py-2.5 px-3 text-center">Quantity</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                    {viewingPO.items?.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">
                          {item.inventory_item_name}
                        </td>
                        <td className="py-2.5 px-3 text-center">{item.inventory_item_unit}</td>
                        <td className="py-2.5 px-3 text-center font-bold">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right">${parseFloat(item.unit_cost || 0).toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-semibold">
                          ${parseFloat(item.subtotal || item.quantity * item.unit_cost || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-neutral-800 font-bold">
                    <tr>
                      <td colSpan={4} className="py-3 px-3 text-right text-gray-600 dark:text-gray-300">
                        TOTAL ESTIMATED AMOUNT:
                      </td>
                      <td className="py-3 px-3 text-right text-base text-emerald-600">
                        ${parseFloat(viewingPO.total_amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Notes */}
              {viewingPO.notes && (
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-800 text-xs">
                  <span className="font-bold text-gray-700 dark:text-gray-300">Order Notes: </span>
                  <span>{viewingPO.notes}</span>
                </div>
              )}

              {/* Signature Line */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-xs text-center">
                <div>
                  <div className="border-b border-gray-300 dark:border-neutral-600 pb-8 mb-2"></div>
                  <div className="text-gray-500">Authorized Signature (Restaurant)</div>
                </div>
                <div>
                  <div className="border-b border-gray-300 dark:border-neutral-600 pb-8 mb-2"></div>
                  <div className="text-gray-500">Received By (Supplier / Driver)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
