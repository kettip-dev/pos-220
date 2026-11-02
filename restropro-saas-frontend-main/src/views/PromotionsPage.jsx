import React, { useState, useMemo, useRef, useEffect } from "react";
import Page from "../components/Page";
import DeleteModal from "../components/DeleteModal";
import {
  IconTag,
  IconPlus,
  IconPencil,
  IconTrash,
  IconSearch,
  IconCheck,
  IconX,
  IconCopy,
  IconClock,
  IconCalendar,
  IconPercentage,
  IconCurrencyDollar,
  IconGift,
  IconSparkles,
  IconAdjustmentsHorizontal,
  IconBuildingStore,
  IconFlame,
  IconReceipt,
  IconDeviceTablet,
  IconTrendingUp,
  IconLayoutGrid,
  IconList,
  IconPrinter,
  IconDownload,
  IconSettings,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import {
  usePromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  togglePromotionStatus,
} from "../controllers/promotions.controller";
import { useCategories } from "../controllers/settings.controller";
import { useMenuItems } from "../controllers/menu_item.controller";
import { useCustomerGroups } from "../controllers/customer_groups.controller";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

const DAYS_OF_WEEK = [
  { id: 1, label: "Mon" },
  { id: 2, label: "Tue" },
  { id: 3, label: "Wed" },
  { id: 4, label: "Thu" },
  { id: 5, label: "Fri" },
  { id: 6, label: "Sat" },
  { id: 7, label: "Sun" },
];

const DINING_TYPES = [
  { id: "dinein", label: "Dine-In" },
  { id: "takeaway", label: "Takeaway" },
  { id: "delivery", label: "Delivery" },
];

const PRESET_TEMPLATES = [
  {
    icon: "⚡",
    name: "Happy Hour 20%",
    data: {
      title: "Happy Hour 20% Off",
      description: "20% off all orders between 2 PM - 5 PM on weekdays",
      promo_code: "",
      promo_type: "ORDER_PERCENTAGE",
      discount_value: 20,
      max_discount_cap: 10,
      min_order_amount: 0,
      apply_to: "ALL",
      is_automatic: true,
      is_stackable: false,
      dining_options: ["dinein", "takeaway"],
      start_time: "14:00",
      end_time: "17:00",
      days_of_week: [1, 2, 3, 4, 5],
    },
  },
  {
    icon: "🎁",
    name: "Buy 1 Get 1 (BOGO)",
    data: {
      title: "Buy 1 Get 1 Free",
      description: "Buy one item, get second free",
      promo_code: "",
      promo_type: "BOGO",
      buy_qty: 1,
      get_qty: 1,
      get_discount_percent: 100,
      apply_to: "ALL",
      is_automatic: true,
      is_stackable: false,
      dining_options: ["dinein", "takeaway", "delivery"],
      days_of_week: [1, 2, 3, 4, 5, 6, 7],
    },
  },
  {
    icon: "💰",
    name: "Spend $30 Save $5",
    data: {
      title: "Spend $30 Get $5 Off",
      description: "$5 fixed discount when spending $30 or more",
      promo_code: "",
      promo_type: "ORDER_FIXED",
      discount_value: 5,
      min_order_amount: 30,
      apply_to: "ALL",
      is_automatic: true,
      is_stackable: true,
      dining_options: ["dinein", "takeaway", "delivery"],
      days_of_week: [1, 2, 3, 4, 5, 6, 7],
    },
  },
  {
    icon: "🎟️",
    name: "VIP $10 Voucher",
    data: {
      title: "VIP Welcome $10 Voucher",
      description: "Coupon code VIP10 on orders over $25",
      promo_code: "VIP10",
      promo_type: "ORDER_FIXED",
      discount_value: 10,
      min_order_amount: 25,
      apply_to: "ALL",
      is_automatic: false,
      is_stackable: true,
      dining_options: ["dinein", "takeaway", "delivery"],
      days_of_week: [1, 2, 3, 4, 5, 6, 7],
    },
  },
];

function getPromoTypeBadge(promoType, t) {
  switch (promoType) {
    case "ORDER_PERCENTAGE":
      return t("promotions.type_order_percentage", "Order %");
    case "ORDER_FIXED":
      return t("promotions.type_order_fixed", "Order Fixed $");
    case "ITEM_PERCENTAGE":
      return t("promotions.type_item_percentage", "Item %");
    case "ITEM_FIXED":
      return t("promotions.type_item_fixed", "Item Fixed $");
    case "BOGO":
      return t("promotions.type_bogo", "BOGO");
    default:
      return promoType ? promoType.replace(/_/g, " ") : "";
  }
}

export default function PromotionsPage() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { promotions, stats, isLoading, mutate } = usePromotions({
    search: searchTerm,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const { data: categories = [] } = useCategories();
  const { data: menuItems = [] } = useMenuItems();
  const { customerGroups = [] } = useCustomerGroups();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [promoToDelete, setPromoToDelete] = useState(null);
  const [activeStep, setActiveStep] = useState(1);
  const [previewTab, setPreviewTab] = useState("pos"); // 'pos' | 'receipt'
  const [copiedId, setCopiedId] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem("promotions_view_mode") || "grid";
    } catch {
      return "grid";
    }
  });

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("promotions_view_mode", mode);
    } catch (e) {
      console.error(e);
    }
  };

  // Table options (QuickBooks-style settings)
  const [tableSettings, setTableSettings] = useState({
    compactDensity: false,
    pageSize: 10,
    currentPage: 1,
    showGearMenu: false,
    visibleColumns: {
      code: true,
      benefit: true,
      conditions: true,
      redemptions: true,
    },
  });

  const [sorting, setSorting] = useState({
    field: "id",
    direction: "desc",
  });

  const [selectedPromos, setSelectedPromos] = useState(new Set());
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

  // Sorted and Paginated promotions
  const sortedPromotions = useMemo(() => {
    let list = [...(promotions || [])];
    list.sort((a, b) => {
      let valA = a[sorting.field];
      let valB = b[sorting.field];
      if (
        sorting.field === "discount_value" ||
        sorting.field === "id" ||
        sorting.field === "times_redeemed"
      ) {
        valA = Number(valA || 0);
        valB = Number(valB || 0);
      } else {
        valA = String(valA || "").toLowerCase();
        valB = String(valB || "").toLowerCase();
      }
      if (valA < valB) return sorting.direction === "asc" ? -1 : 1;
      if (valA > valB) return sorting.direction === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [promotions, sorting]);

  const totalItems = sortedPromotions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / tableSettings.pageSize));
  const currentPage = Math.min(tableSettings.currentPage, totalPages);
  const startIndex = (currentPage - 1) * tableSettings.pageSize;
  const endIndex = Math.min(startIndex + tableSettings.pageSize, totalItems);
  const paginatedPromotions = sortedPromotions.slice(startIndex, endIndex);

  const isAllCurrentPageSelected =
    paginatedPromotions.length > 0 &&
    paginatedPromotions.every((p) => selectedPromos.has(p.id));

  const toggleSelectAll = () => {
    const next = new Set(selectedPromos);
    if (isAllCurrentPageSelected) {
      paginatedPromotions.forEach((p) => next.delete(p.id));
    } else {
      paginatedPromotions.forEach((p) => next.add(p.id));
    }
    setSelectedPromos(next);
  };

  const toggleSelectRow = (id) => {
    const next = new Set(selectedPromos);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedPromos(next);
  };

  const handleSort = (field) => {
    setSorting((prev) => {
      if (prev.field === field) {
        return {
          field,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { field, direction: "asc" };
    });
  };

  const handlePrintTable = () => {
    window.print();
  };

  const handleExportToExcel = async () => {
    try {
      toast.loading("Preparing export...");
      const XLSX = await import("xlsx");
      const exportList =
        selectedPromos.size > 0
          ? sortedPromotions.filter((p) => selectedPromos.has(p.id))
          : sortedPromotions;

      const exportData = exportList.map((p) => ({
        ID: p.id,
        Title: p.title,
        Code: p.promo_code || "Auto-Applied",
        Type: p.promo_type,
        Value: p.discount_value,
        Active: p.is_active ? "YES" : "NO",
        Redemptions: p.times_redeemed,
        Limit: p.usage_limit_total || "Unlimited",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Promotions");
      XLSX.writeFile(
        workbook,
        `Promotions_Export_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      toast.dismiss();
      toast.success("Promotions exported successfully!");
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error("Failed to export promotions");
    }
  };

  // Form State
  const initialFormData = {
    title: "",
    description: "",
    promo_code: "",
    promo_type: "ORDER_PERCENTAGE",
    discount_value: "",
    max_discount_cap: "",
    min_order_amount: "",
    apply_to: "ALL",
    target_category_ids: [],
    target_item_ids: [],
    buy_qty: 1,
    get_qty: 1,
    get_discount_percent: 100,
    is_automatic: true,
    is_stackable: false,
    dining_options: ["dinein", "takeaway", "delivery"],
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    days_of_week: [1, 2, 3, 4, 5, 6, 7],
    usage_limit_total: "",
    applicable_customer_group_ids: null,
    is_active: true,
  };

  const [formData, setFormData] = useState(initialFormData);

  const openCreateModal = () => {
    setEditingPromotion(null);
    setFormData(initialFormData);
    setActiveStep(1);
    setIsModalOpen(true);
  };

  const applyPreset = (preset) => {
    setFormData((prev) => ({
      ...prev,
      ...preset.data,
    }));
    toast.success(`Loaded "${preset.name}" preset!`);
  };

  const openEditModal = (promo) => {
    setEditingPromotion(promo);

    let parsedCatIds = [];
    if (promo.target_category_ids) {
      parsedCatIds = typeof promo.target_category_ids === "string"
        ? JSON.parse(promo.target_category_ids)
        : promo.target_category_ids;
    }

    let parsedItemIds = [];
    if (promo.target_item_ids) {
      parsedItemIds = typeof promo.target_item_ids === "string"
        ? JSON.parse(promo.target_item_ids)
        : promo.target_item_ids;
    }

    let parsedDays = [1, 2, 3, 4, 5, 6, 7];
    if (promo.days_of_week) {
      parsedDays = typeof promo.days_of_week === "string"
        ? JSON.parse(promo.days_of_week)
        : promo.days_of_week;
    }

    let parsedDining = ["dinein", "takeaway", "delivery"];
    if (promo.dining_options) {
      parsedDining = typeof promo.dining_options === "string"
        ? JSON.parse(promo.dining_options)
        : promo.dining_options;
    }

    let parsedGroupIds = null;
    if (promo.applicable_customer_group_ids) {
      parsedGroupIds = typeof promo.applicable_customer_group_ids === "string"
        ? JSON.parse(promo.applicable_customer_group_ids)
        : promo.applicable_customer_group_ids;
    }

    setFormData({
      title: promo.title || "",
      description: promo.description || "",
      promo_code: promo.promo_code || "",
      promo_type: promo.promo_type || "ORDER_PERCENTAGE",
      discount_value: promo.discount_value != null ? promo.discount_value : "",
      max_discount_cap: promo.max_discount_cap != null ? promo.max_discount_cap : "",
      min_order_amount: promo.min_order_amount != null ? promo.min_order_amount : "",
      apply_to: promo.apply_to || "ALL",
      target_category_ids: parsedCatIds || [],
      target_item_ids: parsedItemIds || [],
      buy_qty: promo.buy_qty || 1,
      get_qty: promo.get_qty || 1,
      get_discount_percent: promo.get_discount_percent != null ? promo.get_discount_percent : 100,
      is_automatic: Boolean(promo.is_automatic),
      is_stackable: Boolean(promo.is_stackable),
      dining_options: parsedDining,
      start_date: promo.start_date ? promo.start_date.substring(0, 10) : "",
      end_date: promo.end_date ? promo.end_date.substring(0, 10) : "",
      start_time: promo.start_time ? promo.start_time.substring(0, 5) : "",
      end_time: promo.end_time ? promo.end_time.substring(0, 5) : "",
      days_of_week: parsedDays,
      usage_limit_total: promo.usage_limit_total != null ? promo.usage_limit_total : "",
      applicable_customer_group_ids: parsedGroupIds,
      is_active: Boolean(promo.is_active),
    });
    setActiveStep(1);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (promo, e) => {
    e.stopPropagation();
    try {
      const nextStatus = !promo.is_active;
      await togglePromotionStatus(promo.id, nextStatus);
      toast.success(
        nextStatus
          ? t("promotions.activated", "Promotion activated")
          : t("promotions.deactivated", "Promotion deactivated")
      );
      mutate();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to update status");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!promoToDelete) return;
    try {
      await deletePromotion(promoToDelete.id);
      toast.success(t("promotions.deleted", "Promotion deleted successfully"));
      setIsDeleteModalOpen(false);
      setPromoToDelete(null);
      mutate();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to delete promotion");
    }
  };

  const handleCopyCode = (code, id, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success(t("promotions.code_copied", "Coupon code copied to clipboard!"));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error(t("promotions.title_required", "Please enter a promotion title"));
      return;
    }

    try {
      const payload = {
        ...formData,
        promo_code: formData.promo_code.trim() || null,
        discount_value: Number(formData.discount_value) || 0,
        max_discount_cap: formData.max_discount_cap !== "" ? Number(formData.max_discount_cap) : null,
        min_order_amount: Number(formData.min_order_amount) || 0,
        buy_qty: Number(formData.buy_qty) || 1,
        get_qty: Number(formData.get_qty) || 1,
        get_discount_percent: Number(formData.get_discount_percent) || 100,
        usage_limit_total: formData.usage_limit_total !== "" ? Number(formData.usage_limit_total) : null,
        start_time: formData.start_time ? `${formData.start_time}:00` : null,
        end_time: formData.end_time ? `${formData.end_time}:00` : null,
        target_category_ids: formData.apply_to === "CATEGORY" ? formData.target_category_ids : null,
        target_item_ids: formData.apply_to === "ITEMS" ? formData.target_item_ids : null,
        applicable_customer_group_ids: Array.isArray(formData.applicable_customer_group_ids) && formData.applicable_customer_group_ids.length > 0 ? formData.applicable_customer_group_ids : null,
      };

      if (editingPromotion) {
        await updatePromotion(editingPromotion.id, payload);
        toast.success(t("promotions.updated", "Promotion updated successfully"));
      } else {
        await createPromotion(payload);
        toast.success(t("promotions.created", "Promotion created successfully"));
      }

      setIsModalOpen(false);
      mutate();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to save promotion");
    }
  };

  return (
    <Page>
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2.5">
            <span className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shadow-xs">
              <IconTag size={22} stroke={iconStroke} />
            </span>
            {t("promotions.page_title", "Promotions & Marketing Deals")}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t("promotions.page_subtitle", "Manage coupons, happy hours, BOGO specials, and automatic cart discounts")}
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="min-h-[44px] px-5 bg-restro-green hover:bg-restro-green/90 text-white font-bold rounded-2xl transition flex items-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 text-xs"
        >
          <IconPlus size={18} stroke={iconStroke} />
          {t("promotions.create_button", "Create Promotion")}
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>{t("promotions.active_campaigns", "Active Deals")}</span>
            <IconSparkles size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white font-mono">
            {stats.activePromos} <span className="text-xs font-normal text-gray-400">/ {stats.totalPromos}</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>{t("promotions.total_redemptions", "Times Redeemed")}</span>
            <IconCheck size={16} className="text-blue-500" />
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white font-mono">
            {stats.totalRedemptions}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>{t("promotions.discounts_given", "Discounts Absorbed")}</span>
            <IconCurrencyDollar size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white font-mono">
            ${stats.totalDiscountGiven.toFixed(2)}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>{t("promotions.happy_hours", "Engine Mode")}</span>
            <IconFlame size={16} className="text-orange-500" />
          </div>
          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            {t("promotions.live_sync", "Live Auto-Routing")}
          </div>
        </div>
      </div>

      {/* ── Selection Action Banner (When rows are checked) ── */}
      {selectedPromos.size > 0 && (
        <div className="mb-3 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              {selectedPromos.size} promotion{selectedPromos.size > 1 ? "s" : ""} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportToExcel}
              className="px-3 py-1.5 rounded-md bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-semibold hover:bg-emerald-100 dark:hover:bg-neutral-700 transition active:scale-95"
            >
              {t("promotions.export_selected", "Export Selected")}
            </button>
            <button
              type="button"
              onClick={() => setSelectedPromos(new Set())}
              className="px-3 py-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium hover:bg-slate-200/60 dark:hover:bg-neutral-800 transition"
            >
              {t("promotions.deselect_all", "Deselect All")}
            </button>
          </div>
        </div>
      )}

      {/* ── Filter & Action Bar Directly Above Table (QuickBooks Style - Matching First Image) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        {/* Left Side: Filter by name or code + Status Select */}
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          {/* Search Input Box */}
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <IconSearch size={16} stroke={iconStroke} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("promotions.search_placeholder", "Search campaigns, codes...")}
              className="w-full min-h-[38px] pl-9 pr-8 py-1.5 text-xs sm:text-[13px] rounded-md border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#18181b] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <IconX size={14} stroke={iconStroke} />
              </button>
            )}
          </div>

          {/* Quick Filter Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-h-[38px] px-3 pr-8 py-1.5 text-xs sm:text-[13px] font-normal rounded-md border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#18181b] text-slate-800 dark:text-slate-100 appearance-none focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
            >
              <option value="all">{t("promotions.filter_all", "All")}</option>
              <option value="active">{t("promotions.status_active", "Active")}</option>
              <option value="inactive">{t("promotions.status_inactive", "Inactive")}</option>
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
              title={t("promotions.print_table", "Print table")}
              className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition active:scale-95"
            >
              <IconPrinter size={16} stroke={iconStroke} />
            </button>

            {/* Export Excel */}
            <button
              type="button"
              onClick={handleExportToExcel}
              title={t("promotions.export_excel", "Export to Excel")}
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
                title={t("promotions.table_settings", "Table settings")}
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
                      { key: "code", label: "Trigger / Code" },
                      { key: "benefit", label: "Benefit" },
                      { key: "conditions", label: "Conditions" },
                      { key: "redemptions", label: "Redemptions" },
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

          {/* View Switcher: Cards vs Table */}
          <div className="flex items-center p-0.5 rounded-lg border border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800 shrink-0">
            <button
              type="button"
              onClick={() => handleSetViewMode("grid")}
              title={t("promotions.view_cards", "Cards View")}
              className={clsx(
                "p-1.5 rounded-md text-xs font-medium transition active:scale-95",
                viewMode === "grid"
                  ? "bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <IconLayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode("table")}
              title={t("promotions.view_table", "Table View")}
              className={clsx(
                "p-1.5 rounded-md text-xs font-medium transition active:scale-95",
                viewMode === "table"
                  ? "bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <IconList size={15} />
            </button>
          </div>

          {/* Pagination Text: < Previous  1 - 7 of 7  Next > */}
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

      {/* Promotions Content (Grid vs Table) */}
      {isLoading ? (
        <div className="flex items-center justify-center p-16">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-restro-green" />
        </div>
      ) : promotions.length === 0 ? (
        <div className="text-center p-12 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-gray-300 dark:border-slate-800">
          <div className="w-16 h-16 mx-auto mb-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center shadow-xs">
            <IconTag size={32} stroke={iconStroke} />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            {t("promotions.no_promotions_found", "No promotions created yet")}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1 mb-5">
            {t("promotions.no_promotions_desc", "Set up automatic happy hours, promo coupons, or BOGO deals to drive repeat customer visits.")}
          </p>
          <button
            onClick={openCreateModal}
            className="min-h-[44px] px-5 bg-restro-green text-white text-xs font-bold rounded-2xl inline-flex items-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95"
          >
            <IconPlus size={16} />
            {t("promotions.create_first_deal", "Create Your First Deal")}
          </button>
        </div>
      ) : viewMode === "table" ? (
        /* ======================== TABLE VIEW (QuickBooks Style) ======================== */
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
                      aria-label="Select all promotions"
                      className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                  <th
                    onClick={() => handleSort("is_active")}
                    className="px-3 py-3 cursor-pointer select-none hover:text-emerald-700 transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      {sorting.field === "is_active" && (
                        <span className="text-xs">
                          {sorting.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("title")}
                    className="px-3 py-3 cursor-pointer select-none hover:text-emerald-700 transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>Promotion campaign</span>
                      {sorting.field === "title" && (
                        <span className="text-xs">
                          {sorting.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  {tableSettings.visibleColumns.code && (
                    <th className="px-3 py-3">Trigger / Code</th>
                  )}
                  {tableSettings.visibleColumns.benefit && (
                    <th
                      onClick={() => handleSort("discount_value")}
                      className="px-3 py-3 cursor-pointer select-none hover:text-emerald-700 transition"
                    >
                      <div className="flex items-center gap-1">
                        <span>Benefit</span>
                        {sorting.field === "discount_value" && (
                          <span className="text-xs">
                            {sorting.direction === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                  )}
                  {tableSettings.visibleColumns.conditions && (
                    <th className="px-3 py-3">Conditions</th>
                  )}
                  {tableSettings.visibleColumns.redemptions && (
                    <th
                      onClick={() => handleSort("times_redeemed")}
                      className="px-3 py-3 cursor-pointer select-none hover:text-emerald-700 transition"
                    >
                      <div className="flex items-center gap-1">
                        <span>Redemptions</span>
                        {sorting.field === "times_redeemed" && (
                          <span className="text-xs">
                            {sorting.direction === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                  )}
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80">
                {paginatedPromotions.map((promo) => {
                  const isPercent = promo.promo_type.includes("PERCENTAGE");
                  const isBogo = promo.promo_type === "BOGO";
                  const isCopied = copiedId === promo.id;
                  const progress = promo.usage_limit_total
                    ? Math.min(100, (promo.times_redeemed / promo.usage_limit_total) * 100)
                    : null;

                  const benefitDisplay = isBogo
                    ? `${t("promotions.buy", "Buy")} ${promo.buy_qty} ${t("promotions.get", "Get")} ${promo.get_qty} ${promo.get_discount_percent >= 100 ? t("promotions.free", "Free") : `${promo.get_discount_percent}%`}`
                    : isPercent
                    ? `${promo.discount_value}% ${t("promotions.off", "Off")}`
                    : `$${Number(promo.discount_value).toFixed(2)} ${t("promotions.off", "Off")}`;

                  const isSelected = selectedPromos.has(promo.id);

                  return (
                    <tr
                      key={promo.id}
                      className={clsx(
                        "hover:bg-slate-50/70 dark:hover:bg-neutral-800/40 transition",
                        isSelected && "bg-emerald-50/40 dark:bg-emerald-950/20",
                        !promo.is_active && "opacity-75",
                        tableSettings.compactDensity ? "text-xs" : "text-xs sm:text-[13px]"
                      )}
                    >
                      {/* Checkbox */}
                      <td className="w-10 px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(promo.id)}
                          className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      {/* Status */}
                      <td className={clsx("px-3 whitespace-nowrap", tableSettings.compactDensity ? "py-2" : "py-3")}>
                        <div className="flex items-center gap-2">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(promo.is_active)}
                              onChange={(e) => handleToggleStatus(promo, e)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-gray-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#107c41]" />
                          </label>
                          {promo.is_active ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-[#dcfce7] text-[#15803d] dark:bg-emerald-950/70 dark:text-emerald-400 border border-[#bbf7d0] dark:border-emerald-800 uppercase">
                              {t("promotions.status_active", "Active")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-400 border border-slate-200 dark:border-neutral-700 uppercase">
                              {t("promotions.status_inactive", "Inactive")}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Promotion Campaign */}
                      <td className={clsx("px-3", tableSettings.compactDensity ? "py-2" : "py-3")}>
                        <div className="max-w-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              onClick={() => openEditModal(promo)}
                              className="font-semibold text-slate-900 dark:text-slate-100 hover:text-emerald-700 dark:hover:text-emerald-400 cursor-pointer transition line-clamp-1"
                            >
                              {promo.title}
                            </span>
                            <span
                              className={clsx(
                                "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                                isBogo
                                  ? "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300"
                                  : promo.promo_type.startsWith("ITEM")
                                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                                  : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                              )}
                            >
                              {getPromoTypeBadge(promo.promo_type, t)}
                            </span>
                            {promo.applicable_customer_group_ids && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                                👥 {t('customer_groups.customer_group', 'Group Only')}
                              </span>
                            )}
                          </div>
                          {promo.description && (
                            <p className="text-[11px] text-slate-400 dark:text-neutral-500 line-clamp-1 mt-0.5">
                              {promo.description}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Trigger / Code */}
                      {tableSettings.visibleColumns.code && (
                        <td className={clsx("px-3 whitespace-nowrap", tableSettings.compactDensity ? "py-2" : "py-3")}>
                          {promo.promo_code ? (
                            <button
                              type="button"
                              onClick={(e) => handleCopyCode(promo.promo_code, promo.id, e)}
                              className="min-h-[28px] px-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-mono text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-100 transition active:scale-95 shadow-2xs"
                            >
                              {promo.promo_code}
                              {isCopied ? <IconCheck size={13} className="text-emerald-600" /> : <IconCopy size={13} />}
                            </button>
                          ) : (
                            <span className="min-h-[24px] px-2 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-medium inline-flex items-center gap-1">
                              <IconSparkles size={12} />
                              {t("promotions.auto_applied", "Auto-Applied")}
                            </span>
                          )}
                        </td>
                      )}

                      {/* Benefit */}
                      {tableSettings.visibleColumns.benefit && (
                        <td className={clsx("px-3 whitespace-nowrap", tableSettings.compactDensity ? "py-2" : "py-3")}>
                          <span className="text-sm font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                            {benefitDisplay}
                          </span>
                        </td>
                      )}

                      {/* Conditions */}
                      {tableSettings.visibleColumns.conditions && (
                        <td className={clsx("px-3 text-[11px]", tableSettings.compactDensity ? "py-2" : "py-3")}>
                          <div className="space-y-0.5 max-w-[200px]">
                            {(promo.start_time || promo.end_time) && (
                              <div className="text-orange-600 dark:text-orange-400 font-medium flex items-center gap-1 truncate">
                                <IconClock size={12} className="shrink-0" />
                                <span>{t("promotions.happy_hour", "Happy Hour")}: {promo.start_time?.substring(0, 5)} - {promo.end_time?.substring(0, 5)}</span>
                              </div>
                            )}
                            {promo.min_order_amount > 0 && (
                              <div className="text-slate-500 truncate">
                                {t("promotions.min_spend", "Min spend")}: <strong className="text-slate-700 dark:text-slate-300">${Number(promo.min_order_amount).toFixed(2)}</strong>
                                {promo.max_discount_cap > 0 && ` • ${t("promotions.cap", "Cap")}: $${Number(promo.max_discount_cap).toFixed(2)}`}
                              </div>
                            )}
                            {!promo.start_time && !promo.end_time && promo.min_order_amount <= 0 && (
                              <span className="text-slate-400">{t("promotions.no_restrictions", "No restrictions")}</span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Redemptions */}
                      {tableSettings.visibleColumns.redemptions && (
                        <td className={clsx("px-3 whitespace-nowrap", tableSettings.compactDensity ? "py-2" : "py-3")}>
                          <div className="w-28 space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                {promo.times_redeemed}
                              </span>
                              <span className="text-slate-400 font-mono text-[10px]">
                                {promo.usage_limit_total ? `/ ${promo.usage_limit_total}` : t("promotions.unlimited", "unlimited")}
                              </span>
                            </div>
                            {progress !== null && (
                              <div className="w-full bg-slate-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-emerald-500 h-full rounded-full transition-all"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Actions */}
                      <td className={clsx("px-4 text-right whitespace-nowrap", tableSettings.compactDensity ? "py-2" : "py-3")}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(promo)}
                            className="w-8 h-8 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-slate-100 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95"
                            title={t("promotions.edit_deal", "Edit Deal")}
                          >
                            <IconPencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPromoToDelete(promo);
                              setIsDeleteModalOpen(true);
                            }}
                            className="w-8 h-8 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition active:scale-95"
                            title={t("promotions.delete_deal", "Delete Deal")}
                          >
                            <IconTrash size={15} />
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
              {t("promotions.showing", "Showing")} {totalItems > 0 ? startIndex + 1 : 0} {t("promotions.to", "to")} {endIndex} {t("promotions.of", "of")}{" "}
              {totalItems} {t("promotions.entries", "entries")}
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
                <span>{t("promotions.previous", "Previous")}</span>
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
                <span>{t("promotions.next", "Next")}</span>
                <IconChevronRight size={14} stroke={iconStroke} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ======================== COMPACT CARDS GRID ======================== */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {promotions.map((promo) => {
            const isPercent = promo.promo_type.includes("PERCENTAGE");
            const isBogo = promo.promo_type === "BOGO";
            const isCopied = copiedId === promo.id;
            const progress = promo.usage_limit_total
              ? Math.min(100, (promo.times_redeemed / promo.usage_limit_total) * 100)
              : null;

            const benefitDisplay = isBogo
              ? `${t("promotions.buy", "Buy")} ${promo.buy_qty} ${t("promotions.get", "Get")} ${promo.get_qty} ${promo.get_discount_percent >= 100 ? t("promotions.free", "Free") : `${promo.get_discount_percent}%`}`
              : isPercent
              ? `${promo.discount_value}% ${t("promotions.off", "Off")}`
              : `$${Number(promo.discount_value).toFixed(2)} ${t("promotions.off", "Off")}`;

            return (
              <div
                key={promo.id}
                className={clsx(
                  "p-3.5 rounded-2xl border transition-all flex flex-col justify-between shadow-2xs",
                  promo.is_active
                    ? "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 hover:border-restro-green/60 hover:shadow-xs"
                    : "bg-gray-50/70 dark:bg-slate-900/40 border-gray-200 dark:border-slate-800/80 opacity-70"
                )}
              >
                <div>
                  {/* Top Header: Compact Type Pill & Active Toggle */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={clsx(
                          "text-[9px] font-black tracking-wide uppercase px-2 py-0.5 rounded-md flex items-center gap-1",
                          isBogo
                            ? "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300"
                            : promo.promo_type.startsWith("ITEM")
                            ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                            : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                        )}
                      >
                        {isBogo && <IconGift size={11} />}
                        {getPromoTypeBadge(promo.promo_type, t)}
                      </span>
                      {promo.applicable_customer_group_ids && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                          👥 Group
                        </span>
                      )}
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(promo.is_active)}
                        onChange={(e) => handleToggleStatus(promo, e)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-gray-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-restro-green" />
                    </label>
                  </div>

                  {/* Title & Description */}
                  <h3
                    onClick={() => openEditModal(promo)}
                    className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1 hover:text-restro-green cursor-pointer transition"
                    title={promo.title}
                  >
                    {promo.title}
                  </h3>
                  {promo.description && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1" title={promo.description}>
                      {promo.description}
                    </p>
                  )}

                  {/* Sleek Compact Benefit & Code Strip */}
                  <div className="mt-2.5 p-2 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
                    <div className="min-w-0">
                      <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider leading-none">
                        {t("promotions.benefit", "Benefit")}
                      </span>
                      <span className="text-sm font-black text-gray-900 dark:text-white font-mono mt-0.5 block truncate">
                        {benefitDisplay}
                      </span>
                    </div>

                    {promo.promo_code ? (
                      <button
                        type="button"
                        onClick={(e) => handleCopyCode(promo.promo_code, promo.id, e)}
                        className="min-h-[30px] px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-mono text-xs font-black flex items-center gap-1 hover:bg-emerald-100 transition active:scale-95 shadow-2xs shrink-0"
                      >
                        {promo.promo_code}
                        {isCopied ? <IconCheck size={13} className="text-emerald-700" /> : <IconCopy size={13} />}
                      </button>
                    ) : (
                      <span className="min-h-[26px] px-2 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold flex items-center gap-1 shrink-0">
                        <IconSparkles size={11} />
                        {t("promotions.auto", "Auto")}
                      </span>
                    )}
                  </div>

                  {/* Conditions & Timing (Compact) */}
                  <div className="mt-2 space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                    {(promo.start_time || promo.end_time) && (
                      <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-semibold truncate">
                        <IconClock size={13} className="shrink-0" />
                        <span className="truncate">{t("promotions.happy_hour", "Happy Hour")}: {promo.start_time?.substring(0, 5)} - {promo.end_time?.substring(0, 5)}</span>
                      </div>
                    )}

                    {(promo.start_date || promo.end_date) && (
                      <div className="flex items-center gap-1 text-gray-400 truncate">
                        <IconCalendar size={13} className="shrink-0" />
                        <span className="truncate">{promo.start_date?.substring(0, 10)} {t("promotions.to", "to")} {promo.end_date?.substring(0, 10) || t("promotions.ongoing", "Ongoing")}</span>
                      </div>
                    )}

                    {promo.min_order_amount > 0 && (
                      <div className="text-[11px] text-gray-500 truncate">
                        {t("promotions.min", "Min")}: <strong className="text-gray-700 dark:text-gray-200">${Number(promo.min_order_amount).toFixed(2)}</strong>
                        {promo.max_discount_cap > 0 && ` • ${t("promotions.cap", "Cap")}: $${Number(promo.max_discount_cap).toFixed(2)}`}
                      </div>
                    )}
                  </div>

                  {/* Progress Bar for Limits */}
                  {progress !== null && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
                        <span>{t("promotions.th_redemptions", "Redemptions")}</span>
                        <span className="font-mono">{promo.times_redeemed} / {promo.usage_limit_total}</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer: Usage + Actions */}
                <div className="mt-3 pt-2 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">
                    {t("promotions.used", "Used:")} <strong className="text-gray-700 dark:text-gray-200 font-mono">{promo.times_redeemed}</strong> {t("promotions.times", "times")}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(promo)}
                      className="min-w-[34px] min-h-[34px] rounded-lg text-gray-500 hover:text-restro-green hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center transition active:scale-95"
                      title={t("promotions.edit_deal", "Edit Deal")}
                    >
                      <IconPencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPromoToDelete(promo);
                        setIsDeleteModalOpen(true);
                      }}
                      className="min-w-[34px] min-h-[34px] rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center transition active:scale-95"
                      title={t("promotions.delete_deal", "Delete Deal")}
                    >
                      <IconTrash size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4-Step Promotion Builder Modal with Live Preview */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl border border-gray-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                    <IconTag size={18} />
                  </span>
                  {editingPromotion ? "Edit Promotion Campaign" : "Promotion Campaign Builder"}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Step {activeStep} of 4:{" "}
                  {activeStep === 1 && "Basic Info & Coupon Code"}
                  {activeStep === 2 && "Discount Benefit & Rules"}
                  {activeStep === 3 && "Menu Scope & Dining Types"}
                  {activeStep === 4 && "Happy Hour Schedule & Limits"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-w-[42px] min-h-[42px] rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <IconX size={20} />
              </button>
            </div>

            {/* Stepper Navigation */}
            <div className="flex border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 px-5 py-2.5 gap-2">
              {[
                { step: 1, label: "1. Info & Code" },
                { step: 2, label: "2. Benefit & Rules" },
                { step: 3, label: "3. Scope & Channels" },
                { step: 4, label: "4. Schedule & Limits" },
              ].map(({ step, label }) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setActiveStep(step)}
                  className={clsx(
                    "min-h-[38px] px-3.5 rounded-xl text-xs font-bold transition active:scale-95",
                    activeStep === step
                      ? "bg-restro-green text-white shadow-xs"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-slate-800"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Modal Body: Split into Form on Left & Live Preview on Right */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-slate-800">
              {/* Left Column: Form Controls */}
              <form onSubmit={handleSubmit} className="lg:col-span-7 p-6 space-y-4">
                {/* STEP 1: Basic Info & Presets */}
                {activeStep === 1 && (
                  <div className="space-y-4 animate-fadeIn">
                    {!editingPromotion && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                          Quick Presets (1-Click Fill)
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {PRESET_TEMPLATES.map((p) => (
                            <button
                              key={p.name}
                              type="button"
                              onClick={() => applyPreset(p)}
                              className="min-h-[42px] px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-500/50 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 transition active:scale-95"
                            >
                              <span>{p.icon}</span>
                              <span className="truncate">{p.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                        Campaign Title *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Summer Happy Hour 20% Off"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full min-h-[44px] px-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-background text-sm focus:outline-restro-green font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                        Description (Optional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Applicable on all coffee and pastries between 2 PM - 5 PM"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-background text-xs focus:outline-restro-green"
                      />
                    </div>

                    <div className="p-4 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">
                            Trigger Mode
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {formData.is_automatic
                              ? "Automatically applies to qualifying cart"
                              : "Requires cashier or customer to enter coupon code"}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, is_automatic: !formData.is_automatic })}
                          className={clsx(
                            "min-h-[38px] px-3.5 rounded-xl text-xs font-bold transition active:scale-95",
                            formData.is_automatic ? "bg-blue-600 text-white" : "bg-amber-600 text-white"
                          )}
                        >
                          {formData.is_automatic ? "⚡ Automatic" : "🎟️ Promo Code"}
                        </button>
                      </div>

                      {!formData.is_automatic && (
                        <div className="pt-2">
                          <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                            Coupon Code *
                          </label>
                          <input
                            type="text"
                            required={!formData.is_automatic}
                            placeholder="e.g. SAVE20"
                            value={formData.promo_code}
                            onChange={(e) => setFormData({ ...formData, promo_code: e.target.value.toUpperCase() })}
                            className="w-full min-h-[44px] px-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-background text-sm font-mono uppercase font-black focus:outline-restro-green"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-2xl border border-gray-200 dark:border-slate-800">
                      <div>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">
                          Allow Stacking
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Can combine with other discounts on the same ticket
                        </span>
                      </div>

                      <input
                        type="checkbox"
                        checked={formData.is_stackable}
                        onChange={(e) => setFormData({ ...formData, is_stackable: e.target.checked })}
                        className="w-5 h-5 text-restro-green rounded-md focus:ring-restro-green"
                      />
                    </div>
                  </div>
                )}

                {/* STEP 2: Benefit & Rules */}
                {activeStep === 2 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div>
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                        Promotion Type
                      </label>
                      <select
                        value={formData.promo_type}
                        onChange={(e) => setFormData({ ...formData, promo_type: e.target.value })}
                        className="w-full min-h-[44px] px-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-background text-xs font-bold focus:outline-restro-green"
                      >
                        <option value="ORDER_PERCENTAGE">Whole Order Percentage Discount (%)</option>
                        <option value="ORDER_FIXED">Whole Order Fixed Dollar Discount ($)</option>
                        <option value="ITEM_PERCENTAGE">Item / Category Percentage Discount (%)</option>
                        <option value="ITEM_FIXED">Item / Category Fixed Discount ($)</option>
                        <option value="BOGO">BOGO (Buy X Get Y Free/Discounted)</option>
                      </select>
                    </div>

                    {formData.promo_type !== "BOGO" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                            Discount Value {formData.promo_type.includes("PERCENTAGE") ? "(%)" : "($)"} *
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            max={formData.promo_type.includes("PERCENTAGE") ? "100" : undefined}
                            required
                            placeholder={formData.promo_type.includes("PERCENTAGE") ? "e.g. 15" : "e.g. 5.00"}
                            value={formData.discount_value}
                            onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                            className="w-full min-h-[44px] px-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-background text-sm font-mono font-bold focus:outline-restro-green"
                          />
                        </div>

                        {formData.promo_type.includes("PERCENTAGE") && (
                          <div>
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                              Max Discount Cap ($) (Optional)
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              placeholder="e.g. 10.00"
                              value={formData.max_discount_cap}
                              onChange={(e) => setFormData({ ...formData, max_discount_cap: e.target.value })}
                              className="w-full min-h-[44px] px-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-background text-sm font-mono focus:outline-restro-green"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl border border-purple-200 dark:border-purple-900/40 bg-purple-50/40 dark:bg-purple-950/20 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                              Buy Qty
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={formData.buy_qty}
                              onChange={(e) => setFormData({ ...formData, buy_qty: e.target.value })}
                              className="w-full min-h-[42px] px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-background text-sm font-mono font-bold"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                              Get Qty
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={formData.get_qty}
                              onChange={(e) => setFormData({ ...formData, get_qty: e.target.value })}
                              className="w-full min-h-[42px] px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-background text-sm font-mono font-bold"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                              Discount %
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={formData.get_discount_percent}
                              onChange={(e) => setFormData({ ...formData, get_discount_percent: e.target.value })}
                              className="w-full min-h-[42px] px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-background text-sm font-mono font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                        Minimum Order Spend ($)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="e.g. 20.00 (leave 0 for no minimum spend)"
                        value={formData.min_order_amount}
                        onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value })}
                        className="w-full min-h-[44px] px-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-background text-sm font-mono focus:outline-restro-green"
                      />
                    </div>
                  </div>
                )}

                {/* STEP 3: Scope & Channels */}
                {activeStep === 3 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div>
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                        Apply Promotion To
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "ALL", label: "Entire Menu" },
                          { id: "CATEGORY", label: "Specific Categories" },
                          { id: "ITEMS", label: "Specific Menu Items" },
                        ].map(({ id, label }) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setFormData({ ...formData, apply_to: id })}
                            className={clsx(
                              "min-h-[42px] px-3 rounded-xl text-xs font-bold border transition text-center active:scale-95",
                              formData.apply_to === id
                                ? "bg-restro-green text-white border-restro-green shadow-xs"
                                : "border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {formData.apply_to === "CATEGORY" && (
                      <div>
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                          Select Categories
                        </label>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 dark:border-slate-800 rounded-2xl">
                          {categories.map((cat) => {
                            const isSelected = formData.target_category_ids.includes(cat.id);
                            return (
                              <label
                                key={cat.id}
                                className={clsx(
                                  "flex items-center gap-2 p-2 rounded-xl text-xs cursor-pointer transition border",
                                  isSelected
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold"
                                    : "border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const current = [...formData.target_category_ids];
                                    if (e.target.checked) current.push(cat.id);
                                    else current.splice(current.indexOf(cat.id), 1);
                                    setFormData({ ...formData, target_category_ids: current });
                                  }}
                                  className="w-4 h-4 text-restro-green rounded-md"
                                />
                                <span className="truncate">{cat.title}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {formData.apply_to === "ITEMS" && (
                      <div>
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                          Select Menu Items
                        </label>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 dark:border-slate-800 rounded-2xl">
                          {menuItems.map((item) => {
                            const isSelected = formData.target_item_ids.includes(item.id);
                            return (
                              <label
                                key={item.id}
                                className={clsx(
                                  "flex items-center gap-2 p-2 rounded-xl text-xs cursor-pointer transition border",
                                  isSelected
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold"
                                    : "border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const current = [...formData.target_item_ids];
                                    if (e.target.checked) current.push(item.id);
                                    else current.splice(current.indexOf(item.id), 1);
                                    setFormData({ ...formData, target_item_ids: current });
                                  }}
                                  className="w-4 h-4 text-restro-green rounded-md"
                                />
                                <span className="truncate">{item.title}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                        Allowed Dining Channels
                      </label>
                      <div className="flex gap-2">
                        {DINING_TYPES.map((dt) => {
                          const isChecked = formData.dining_options.includes(dt.id);
                          return (
                            <button
                              key={dt.id}
                              type="button"
                              onClick={() => {
                                const current = [...formData.dining_options];
                                const idx = current.indexOf(dt.id);
                                if (idx !== -1) {
                                  if (current.length > 1) current.splice(idx, 1);
                                } else {
                                  current.push(dt.id);
                                }
                                setFormData({ ...formData, dining_options: current });
                              }}
                              className={clsx(
                                "min-h-[42px] px-4 rounded-xl text-xs font-bold border transition active:scale-95",
                                isChecked
                                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-400"
                                  : "bg-gray-50 dark:bg-slate-800 text-gray-500 border-gray-200 dark:border-slate-800"
                              )}
                            >
                              {dt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Customer Group Targeting */}
                    <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                          {t('customer_groups.target_groups', 'Target Customer Groups')}
                        </label>
                        <span className="text-[11px] text-gray-400">
                          {formData.applicable_customer_group_ids && formData.applicable_customer_group_ids.length > 0
                            ? `${formData.applicable_customer_group_ids.length} group(s) selected`
                            : t('customer_groups.target_all_customers', 'All Customers (including Guests)')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, applicable_customer_group_ids: null })}
                          className={clsx(
                            "min-h-[42px] px-3 rounded-xl text-xs font-bold border transition text-center active:scale-95",
                            !formData.applicable_customer_group_ids || formData.applicable_customer_group_ids.length === 0
                              ? "bg-restro-green text-white border-restro-green shadow-xs"
                              : "border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                          )}
                        >
                          {t('customer_groups.target_all_customers', 'All Customers (including Guests)')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!formData.applicable_customer_group_ids || formData.applicable_customer_group_ids.length === 0) {
                              setFormData({
                                ...formData,
                                applicable_customer_group_ids: customerGroups.length > 0 ? [customerGroups[0].id] : []
                              });
                            }
                          }}
                          className={clsx(
                            "min-h-[42px] px-3 rounded-xl text-xs font-bold border transition text-center active:scale-95",
                            formData.applicable_customer_group_ids && formData.applicable_customer_group_ids.length > 0
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                              : "border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                          )}
                        >
                          {t('customer_groups.target_specific_groups', 'Restricted to Specific Groups')}
                        </button>
                      </div>

                      {formData.applicable_customer_group_ids && (
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-2xl">
                          {customerGroups.length === 0 ? (
                            <p className="text-xs text-gray-500 col-span-2 p-2 text-center">
                              No customer groups created yet.
                            </p>
                          ) : (
                            customerGroups.map((grp) => {
                              const isSelected = (formData.applicable_customer_group_ids || []).includes(grp.id);
                              return (
                                <label
                                  key={grp.id}
                                  className={clsx(
                                    "flex items-center gap-2 p-2 rounded-xl text-xs cursor-pointer transition border",
                                    isSelected
                                      ? "bg-white dark:bg-slate-900 border-indigo-500 text-indigo-900 dark:text-indigo-200 font-bold shadow-xs"
                                      : "border-transparent text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-slate-800"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const current = Array.isArray(formData.applicable_customer_group_ids)
                                        ? [...formData.applicable_customer_group_ids]
                                        : [];
                                      if (e.target.checked) {
                                        current.push(grp.id);
                                      } else {
                                        const idx = current.indexOf(grp.id);
                                        if (idx !== -1) current.splice(idx, 1);
                                      }
                                      setFormData({
                                        ...formData,
                                        applicable_customer_group_ids: current.length > 0 ? current : null
                                      });
                                    }}
                                    className="w-4 h-4 text-indigo-600 rounded-md"
                                  />
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: grp.color || '#6366F1' }}
                                  />
                                  <span className="truncate">{grp.name}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 4: Schedule & Limits (Happy Hour) */}
                {activeStep === 4 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                          className="w-full min-h-[44px] px-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-background text-sm focus:outline-restro-green"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                          className="w-full min-h-[44px] px-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-background text-sm focus:outline-restro-green"
                        />
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border border-orange-200 dark:border-orange-950/50 bg-orange-50/40 dark:bg-orange-950/20 space-y-3">
                      <span className="text-xs font-bold text-orange-900 dark:text-orange-300 flex items-center gap-1.5">
                        <IconClock size={16} />
                        Happy Hour Time Window (Optional)
                      </span>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400 block mb-1">
                            Start Time
                          </label>
                          <input
                            type="time"
                            value={formData.start_time}
                            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                            className="w-full min-h-[42px] px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-background text-sm"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400 block mb-1">
                            End Time
                          </label>
                          <input
                            type="time"
                            value={formData.end_time}
                            onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                            className="w-full min-h-[42px] px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-background text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                        Active Days of Week
                      </label>
                      <div className="flex gap-1.5">
                        {DAYS_OF_WEEK.map((d) => {
                          const isSelected = formData.days_of_week.includes(d.id);
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => {
                                const current = [...formData.days_of_week];
                                const idx = current.indexOf(d.id);
                                if (idx !== -1) {
                                  if (current.length > 1) current.splice(idx, 1);
                                } else {
                                  current.push(d.id);
                                }
                                setFormData({ ...formData, days_of_week: current });
                              }}
                              className={clsx(
                                "w-11 h-11 rounded-xl text-xs font-bold border transition active:scale-95 flex items-center justify-center",
                                isSelected
                                  ? "bg-restro-green text-white border-restro-green shadow-xs"
                                  : "bg-gray-50 dark:bg-slate-800 text-gray-400 border-gray-200 dark:border-slate-800"
                              )}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                        Total Usage Redemption Limit
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 100 total redemptions (leave empty for unlimited)"
                        value={formData.usage_limit_total}
                        onChange={(e) => setFormData({ ...formData, usage_limit_total: e.target.value })}
                        className="w-full min-h-[44px] px-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-background text-sm font-mono focus:outline-restro-green"
                      />
                    </div>
                  </div>
                )}
              </form>

              {/* Right Column: Live Interactive Visual Preview */}
              <div className="lg:col-span-5 p-6 bg-gray-50/60 dark:bg-slate-800/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Live Customer Preview
                    </span>

                    <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => setPreviewTab("pos")}
                        className={clsx(
                          "px-2.5 py-1 text-[11px] font-bold rounded-md transition flex items-center gap-1",
                          previewTab === "pos" ? "bg-restro-green text-white" : "text-gray-500"
                        )}
                      >
                        <IconDeviceTablet size={13} />
                        POS
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewTab("receipt")}
                        className={clsx(
                          "px-2.5 py-1 text-[11px] font-bold rounded-md transition flex items-center gap-1",
                          previewTab === "receipt" ? "bg-restro-green text-white" : "text-gray-500"
                        )}
                      >
                        <IconReceipt size={13} />
                        Receipt
                      </button>
                    </div>
                  </div>

                  {previewTab === "pos" ? (
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-md space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {formData.promo_type.replace(/_/g, " ")}
                        </span>
                        {formData.promo_code ? (
                          <span className="font-mono text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-300">
                            {formData.promo_code}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                            ⚡ Auto
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        {formData.title || "Untitled Promotion Campaign"}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {formData.description || "Promotion details will appear here."}
                      </p>

                      <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800 flex items-center justify-between">
                        <span className="text-xs text-gray-500">Customer Benefit</span>
                        <span className="text-base font-black text-emerald-600 font-mono">
                          {formData.promo_type === "BOGO"
                            ? `Buy ${formData.buy_qty} Get ${formData.get_qty} ${formData.get_discount_percent >= 100 ? "Free" : `${formData.get_discount_percent}%`}`
                            : formData.promo_type.includes("PERCENTAGE")
                            ? `${formData.discount_value || 0}% Off`
                            : `$${Number(formData.discount_value || 0).toFixed(2)} Off`}
                        </span>
                      </div>

                      <div className="text-[11px] text-gray-400 space-y-1 pt-1">
                        {formData.start_time && formData.end_time && (
                          <p>⏰ Happy Hour: {formData.start_time} - {formData.end_time}</p>
                        )}
                        {formData.min_order_amount > 0 && (
                          <p>🎯 Min order subtotal: ${formData.min_order_amount}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 rounded-2xl bg-[#FFFDF9] dark:bg-slate-900 border border-amber-200/80 dark:border-slate-700 shadow-md font-mono text-xs space-y-2 relative overflow-hidden text-gray-800 dark:text-gray-200">
                      {/* Paper serrated top */}
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" />

                      <div className="text-center pb-2 border-b border-dashed border-gray-300 dark:border-slate-700 space-y-0.5">
                        <p className="font-black text-sm tracking-widest uppercase">RESTRO PRO CAFE</p>
                        <p className="text-[10px] text-gray-500">Thermal Receipt #INV-8821</p>
                        <p className="text-[10px] text-gray-400">{new Date().toLocaleDateString()}</p>
                      </div>

                      <div className="space-y-1 py-1 text-[11px]">
                        <div className="flex justify-between">
                          <span>1x Classic Cheeseburger</span>
                          <span>$14.50</span>
                        </div>
                        <div className="flex justify-between">
                          <span>1x Craft Draft Beer</span>
                          <span>$7.50</span>
                        </div>
                        <div className="flex justify-between">
                          <span>1x Truffle Fries</span>
                          <span>$6.00</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-dashed border-gray-300 dark:border-slate-700 space-y-1">
                        <div className="flex justify-between text-gray-600 dark:text-gray-400">
                          <span>Subtotal:</span>
                          <span>$28.00</span>
                        </div>

                        {/* Promotion discount line */}
                        <div className="flex justify-between font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-1.5 rounded-md">
                          <span className="truncate">
                            🏷️ {formData.promo_code ? `PROMO (${formData.promo_code})` : formData.title || "Special Deal"}
                          </span>
                          <span>
                            {formData.promo_type === "BOGO"
                              ? "-$7.50 (FREE)"
                              : formData.promo_type.includes("PERCENTAGE")
                              ? `-$${((28 * (Number(formData.discount_value) || 0)) / 100).toFixed(2)}`
                              : `-$${Number(formData.discount_value || 0).toFixed(2)}`}
                          </span>
                        </div>

                        <div className="flex justify-between text-gray-500 text-[11px]">
                          <span>Tax (10%):</span>
                          <span>$2.35</span>
                        </div>

                        <div className="flex justify-between font-black text-sm pt-2 border-t border-dashed border-gray-300 dark:border-slate-700">
                          <span>TOTAL PAID:</span>
                          <span>$25.85</span>
                        </div>
                      </div>

                      {/* Barcode Simulation */}
                      <div className="pt-3 text-center space-y-1">
                        <div className="flex justify-center items-center gap-0.5 h-6 opacity-75">
                          {[2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 3, 1, 2, 4].map((w, i) => (
                            <div key={i} className="bg-gray-800 dark:bg-gray-300 h-full" style={{ width: `${w}px` }} />
                          ))}
                        </div>
                        <p className="text-[9px] text-gray-400 tracking-widest">THANK YOU FOR DINING WITH US</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-gray-200 dark:border-slate-800 text-[11px] text-gray-500">
                  💡 <strong>Tip:</strong> Automated promotions trigger automatically on POS and customer QR Menus as soon as cart requirements are met.
                </div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 flex items-center justify-between">
              {activeStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep(activeStep - 1)}
                  className="min-h-[44px] px-5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-background text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 transition active:scale-95"
                >
                  Back
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                {activeStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setActiveStep(activeStep + 1)}
                    className="min-h-[44px] px-6 rounded-2xl bg-restro-green text-white text-xs font-bold hover:bg-restro-green/90 transition shadow-md shadow-emerald-600/20 active:scale-95"
                  >
                    Next Step
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="min-h-[44px] px-7 rounded-2xl bg-restro-green text-white text-xs font-black hover:bg-restro-green/90 transition shadow-md shadow-emerald-600/20 active:scale-95 flex items-center gap-2"
                  >
                    <IconCheck size={18} />
                    {editingPromotion ? "Update Promotion" : "Launch Promotion"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <DeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setPromoToDelete(null);
          }}
          onConfirm={handleDeleteConfirm}
          title={t("promotions.delete_title", "Delete Promotion")}
          message={t(
            "promotions.delete_confirm",
            "Are you sure you want to delete this promotion? This action cannot be undone."
          )}
        />
      )}
    </Page>
  );
}
