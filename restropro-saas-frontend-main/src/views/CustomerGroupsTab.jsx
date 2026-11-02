import React, { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconCheck,
  IconX,
  IconUsers,
  IconTag,
  IconPercentage,
  IconCurrencyDollar,
  IconAlertTriangle,
  IconStar,
  IconSparkles,
  IconShieldCheck,
  IconInfoCircle,
  IconSearch,
  IconLayoutGrid,
  IconList,
  IconChevronDown,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import clsx from "clsx";
import {
  useCustomerGroups,
  createCustomerGroup,
  updateCustomerGroup,
  deleteCustomerGroup,
} from "../controllers/customer_groups.controller";
import { useCategories } from "../controllers/settings.controller";
import { toast } from "react-hot-toast";

const PRESET_COLORS = [
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#64748b", // Slate
];

const INITIAL_FORM = {
  name: "",
  code: "",
  color: "#6366f1",
  description: "",
  is_default: false,
  is_active: true,
  discount_type: "PERCENTAGE",
  discount_value: "",
  apply_to: "ALL",
  target_category_ids: [],
  min_order_amount: "",
  max_discount_cap: "",
};

export default function CustomerGroupsTab({ isManageAllowed = true }) {
  const { t } = useTranslation();
  const { customerGroups = [], isLoading, mutate } = useCustomerGroups();
  const { data: categories = [] } = useCategories();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Deletion state
  const [deletingGroup, setDeletingGroup] = useState(null);
  const [reassignChoice, setReassignChoice] = useState("default");
  const [isDeleting, setIsDeleting] = useState(false);

  // Search, Filter & View Mode state (Table Design System standard)
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'active' | 'inactive'
  const [offeringFilter, setOfferingFilter] = useState("all"); // 'all' | 'discount' | 'nodiscount'
  const [viewMode, setViewMode] = useState("table"); // 'table' | 'grid'

  // Listen to open-add-customer-group event dispatched by CustomersPage header button
  useEffect(() => {
    const handleOpenAddEvent = () => handleOpenAdd();
    window.addEventListener("open-add-customer-group", handleOpenAddEvent);
    return () => window.removeEventListener("open-add-customer-group", handleOpenAddEvent);
  }, []);

  // Filtered customer groups based on search & dropdowns
  const filteredGroups = useMemo(() => {
    return customerGroups.filter((g) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = g.name?.toLowerCase().includes(q);
        const matchCode = g.code?.toLowerCase().includes(q);
        const matchDesc = g.description?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchDesc) return false;
      }
      if (statusFilter === "active" && !g.is_active) return false;
      if (statusFilter === "inactive" && g.is_active) return false;

      const hasDiscount = Number(g.discount_value) > 0;
      if (offeringFilter === "discount" && !hasDiscount) return false;
      if (offeringFilter === "nodiscount" && hasDiscount) return false;

      return true;
    });
  }, [customerGroups, searchQuery, statusFilter, offeringFilter]);

  // Summary Metrics KPI Calculation
  const kpiStats = useMemo(() => {
    const totalGroups = customerGroups.length;
    const defaultGroup = customerGroups.find((g) => g.is_default);
    const activeGroupsCount = customerGroups.filter((g) => g.is_active).length;
    const totalAssignedCustomers = customerGroups.reduce(
      (acc, g) => acc + Number(g.customer_count || 0),
      0
    );
    const groupsWithDiscount = customerGroups.filter((g) => Number(g.discount_value) > 0).length;

    return {
      totalGroups,
      defaultGroupName: defaultGroup ? defaultGroup.name : "None",
      defaultGroupColor: defaultGroup ? defaultGroup.color : null,
      activeGroupsCount,
      totalAssignedCustomers,
      groupsWithDiscount,
    };
  }, [customerGroups]);

  const handleOpenAdd = () => {
    setEditingGroup(null);
    setFormData(INITIAL_FORM);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name || "",
      code: group.code || "",
      color: group.color || "#6366f1",
      description: group.description || "",
      is_default: Boolean(group.is_default),
      is_active: Boolean(group.is_active),
      discount_type: group.discount_type || "PERCENTAGE",
      discount_value: group.discount_value > 0 ? String(group.discount_value) : "",
      apply_to: group.apply_to || "ALL",
      target_category_ids: Array.isArray(group.target_category_ids) ? group.target_category_ids : [],
      min_order_amount: group.min_order_amount > 0 ? String(group.min_order_amount) : "",
      max_discount_cap: group.max_discount_cap != null ? String(group.max_discount_cap) : "",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error(t("customer_groups.group_name_placeholder", "Please provide a group name"));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code?.trim() || null,
        color: formData.color || "#6366f1",
        description: formData.description?.trim() || null,
        is_default: formData.is_default,
        is_active: formData.is_active,
        discount_type: formData.discount_type,
        discount_value: Number(formData.discount_value) || 0,
        apply_to: formData.apply_to,
        target_category_ids: formData.apply_to === "CATEGORY" ? formData.target_category_ids : [],
        min_order_amount: Number(formData.min_order_amount) || 0,
        max_discount_cap: formData.max_discount_cap !== "" && formData.max_discount_cap != null 
          ? Number(formData.max_discount_cap) 
          : null,
      };

      if (editingGroup) {
        await updateCustomerGroup(editingGroup.id, payload);
        toast.success(t("customer_groups.group_updated", "Customer group updated successfully!"));
      } else {
        await createCustomerGroup(payload);
        toast.success(t("customer_groups.group_created", "Customer group created successfully!"));
      }

      mutate();
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || err.message || t("customers.something_went_wrong", "Something went wrong! Try later!"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingGroup) return;
    setIsDeleting(true);
    try {
      await deleteCustomerGroup(deletingGroup.id, reassignChoice);
      toast.success(t("customer_groups.group_deleted", "Customer group deleted successfully!"));
      mutate();
      setDeletingGroup(null);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || err.message || t("customers.something_went_wrong", "Something went wrong! Try later!"));
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleCategorySelection = (categoryId) => {
    const id = Number(categoryId);
    setFormData((prev) => {
      const current = prev.target_category_ids || [];
      if (current.includes(id)) {
        return { ...prev, target_category_ids: current.filter((x) => x !== id) };
      }
      return { ...prev, target_category_ids: [...current, id] };
    });
  };

  // Live Rule Summary Generator for Modal
  const getDiscountPreview = () => {
    const val = Number(formData.discount_value) || 0;
    if (val <= 0) {
      return {
        hasDiscount: false,
        text: t("customer_groups.no_discount_preview", "No discount configured. This group functions as a segmentation tier for tracking and reporting."),
      };
    }
    const typeStr = formData.discount_type === "PERCENTAGE" ? `${val}%` : `$${val.toFixed(2)}`;
    const scopeStr =
      formData.apply_to === "ALL"
        ? t("customer_groups.apply_to_all", "Entire Order")
        : `${t("customer_groups.apply_to_categories", "Specific Categories")} (${formData.target_category_ids.length} selected)`;

    const minSpend = Number(formData.min_order_amount) || 0;
    const maxCap = Number(formData.max_discount_cap) || null;

    let condition = "";
    if (minSpend > 0 && maxCap) {
      condition = ` · Min spend: $${minSpend.toFixed(2)}, Max cap: $${maxCap.toFixed(2)}`;
    } else if (minSpend > 0) {
      condition = ` · Min spend: $${minSpend.toFixed(2)}`;
    } else if (maxCap) {
      condition = ` · Max cap: $${maxCap.toFixed(2)}`;
    }

    return {
      hasDiscount: true,
      text: `${typeStr} discount on ${scopeStr}${condition}`,
    };
  };

  return (
    <div className="space-y-5">
      {/* ── KPI Metric Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Groups */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t("customer_groups.total_groups", "Total Groups")}
            </span>
            <span className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <IconUsers size={16} />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {kpiStats.totalGroups}
          </div>
        </div>

        {/* Default Group Tier */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t("customer_groups.default_tier", "Default Tier")}
            </span>
            <span className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <IconStar size={16} className="fill-amber-500" />
            </span>
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-2 truncate flex items-center gap-2">
            {kpiStats.defaultGroupColor && (
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: kpiStats.defaultGroupColor }}
              />
            )}
            <span className="truncate">{kpiStats.defaultGroupName}</span>
          </div>
        </div>

        {/* Assigned Customers */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t("customer_groups.assigned_members", "Assigned Members")}
            </span>
            <span className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <IconShieldCheck size={16} />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {kpiStats.totalAssignedCustomers.toLocaleString()}
          </div>
        </div>

        {/* Discount Rules */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t("customer_groups.active_discounts", "Discount Rules")}
            </span>
            <span className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <IconTag size={16} />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {kpiStats.groupsWithDiscount} <span className="text-xs font-normal text-slate-400">tiers</span>
          </div>
        </div>
      </div>

      {/* ── Toolbar: Search, Filters & View Mode (Table Design System standard) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Left: Search Bar & Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1 max-w-2xl">
          {/* Search Input Box */}
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <IconSearch size={16} stroke={iconStroke} />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("customer_groups.search_placeholder", "Search groups by name, code...")}
              className="w-full min-h-[38px] pl-9 pr-8 py-1.5 text-xs sm:text-[13px] rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <IconX size={14} stroke={iconStroke} />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-h-[38px] px-3 pr-8 py-1.5 text-xs sm:text-[13px] rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-700 dark:text-slate-200 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">{t("customer_groups.status_all", "All Statuses")}</option>
              <option value="active">{t("customer_groups.status_active", "Active")}</option>
              <option value="inactive">{t("customer_groups.status_inactive", "Inactive")}</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400">
              <IconChevronDown size={14} stroke={iconStroke} />
            </div>
          </div>

          {/* Offering Filter */}
          <div className="relative">
            <select
              value={offeringFilter}
              onChange={(e) => setOfferingFilter(e.target.value)}
              className="min-h-[38px] px-3 pr-8 py-1.5 text-xs sm:text-[13px] rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-700 dark:text-slate-200 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">{t("customer_groups.offering_all", "All Offerings")}</option>
              <option value="discount">{t("customer_groups.offering_discount", "With Discount")}</option>
              <option value="nodiscount">{t("customer_groups.offering_no_discount", "No Discount (Tiers)")}</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400">
              <IconChevronDown size={14} stroke={iconStroke} />
            </div>
          </div>
        </div>

        {/* Right: Counter, View Mode Switcher & Quick Add Button */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden md:inline">
            {filteredGroups.length === 1
              ? t("customer_groups.showing_groups", { count: 1 })
              : t("customer_groups.showing_groups_plural", { count: filteredGroups.length })}
          </span>

          {/* View Mode Switcher: Table vs Cards */}
          <div className="flex items-center p-0.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title={t("customer_groups.view_table", "Table View")}
              className={clsx(
                "p-2 rounded-lg text-xs font-medium transition active:scale-95",
                viewMode === "table"
                  ? "bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <IconList size={16} stroke={iconStroke} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title={t("customer_groups.view_grid", "Cards View")}
              className={clsx(
                "p-2 rounded-lg text-xs font-medium transition active:scale-95",
                viewMode === "grid"
                  ? "bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <IconLayoutGrid size={16} stroke={iconStroke} />
            </button>
          </div>

          {/* Add Button in Toolbar */}
          {isManageAllowed && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="min-h-[38px] px-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 shadow-xs transition-all"
            >
              <IconPlus size={16} stroke={iconStroke} />
              <span>{t("customer_groups.new_group", "New Customer Group")}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Groups List (Table View vs Card Grid View) ── */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">{t("customers.please_wait", "Loading customer groups...")}</p>
        </div>
      ) : customerGroups.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-slate-300 dark:border-neutral-800 p-12 sm:p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4">
            <IconUsers className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
            {t("customer_groups.title", "No Customer Groups Yet")}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
            {t("customer_groups.description_placeholder", "Create your first group (e.g. VIP, Staff, Wholesale) to offer customized discounts and organize your patrons.")}
          </p>
          {isManageAllowed && (
            <button
              onClick={handleOpenAdd}
              className="min-h-[42px] px-5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl font-semibold inline-flex items-center gap-2 shadow-xs"
            >
              <IconPlus className="w-4 h-4" />
              <span>{t("customer_groups.new_group", "Create Your First Group")}</span>
            </button>
          )}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-slate-300 dark:border-neutral-800">
          <IconUsers className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {t("customer_groups.no_groups_found", "No groups found matching your search")}
          </h4>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
              setOfferingFilter("all");
            }}
            className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
          >
            Clear Filters
          </button>
        </div>
      ) : viewMode === "table" ? (
        /* ======================== COMPACT DATA TABLE VIEW ======================== */
        <div className="w-full overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-neutral-800 text-[12px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-neutral-800/40">
                <th className="px-4 py-3">{t("customer_groups.table_tier", "Tier / Group Name")}</th>
                <th className="px-3 py-3">{t("customer_groups.table_benefit", "Benefit / Discount")}</th>
                <th className="px-3 py-3">{t("customer_groups.table_scope", "Applicable Scope")}</th>
                <th className="px-3 py-3">{t("customer_groups.table_limits", "Spend Limits")}</th>
                <th className="px-3 py-3 text-center">{t("customer_groups.table_members", "Members")}</th>
                <th className="px-3 py-3 text-center">{t("customer_groups.table_status", "Status")}</th>
                <th className="px-4 py-3 text-right">{t("customer_groups.table_actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
              {filteredGroups.map((group) => {
                const hasDiscount = Number(group.discount_value) > 0;
                return (
                  <tr
                    key={group.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-neutral-800/50 transition text-xs sm:text-[13px]"
                  >
                    {/* Tier / Group Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-white dark:ring-neutral-900 shadow-xs"
                          style={{ backgroundColor: group.color || "#6366f1" }}
                        />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(group)}
                              className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition text-left cursor-pointer"
                            >
                              {group.name}
                            </button>
                            {group.code && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-300 font-mono font-bold uppercase">
                                {group.code}
                              </span>
                            )}
                            {group.is_default && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold">
                                <IconStar className="w-2.5 h-2.5 fill-amber-500" />
                                {t("common.default", "Default")}
                              </span>
                            )}
                          </div>
                          {group.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                              {group.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Benefit / Discount */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      {hasDiscount ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                          <IconTag size={12} />
                          <span>
                            {group.discount_type === "PERCENTAGE"
                              ? `${group.discount_value}% OFF`
                              : `$${Number(group.discount_value).toFixed(2)} OFF`}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">
                          {t("customer_groups.no_discount_tier", "No discount (Tier only)")}
                        </span>
                      )}
                    </td>

                    {/* Applicable Scope */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      {hasDiscount ? (
                        group.apply_to === "ALL" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                            {t("customer_groups.entire_order", "Entire Order")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
                            {t("customer_groups.categories_count", {
                              count: group.target_category_ids?.length || 0,
                            })}
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Spend Limits */}
                    <td className="px-3 py-3 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                      {group.min_order_amount > 0 || group.max_discount_cap > 0 ? (
                        <div className="space-y-0.5">
                          {group.min_order_amount > 0 && (
                            <div>
                              <span className="text-slate-400">Min spend: </span>
                              <span className="font-semibold tabular-nums">${Number(group.min_order_amount).toFixed(2)}</span>
                            </div>
                          )}
                          {group.max_discount_cap > 0 && (
                            <div>
                              <span className="text-slate-400">Cap: </span>
                              <span className="font-semibold tabular-nums">${Number(group.max_discount_cap).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">{t("customer_groups.no_spend_limits", "No restrictions")}</span>
                      )}
                    </td>

                    {/* Members Count */}
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300">
                        <IconUsers size={13} className="text-slate-400" />
                        <span className="tabular-nums font-bold">{group.customer_count || 0}</span>
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      {group.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {t("customer_groups.status_active", "Active")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-neutral-800 text-slate-500 border border-slate-200 dark:border-neutral-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          {t("customer_groups.status_inactive", "Inactive")}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {isManageAllowed && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(group)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-600 dark:text-slate-300 transition active:scale-95"
                            title={t("common.edit", "Edit")}
                          >
                            <IconPencil size={15} stroke={iconStroke} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeletingGroup(group);
                              setReassignChoice("default");
                            }}
                            className="p-1.5 rounded-lg border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition active:scale-95"
                            title={t("common.delete", "Delete")}
                          >
                            <IconTrash size={15} stroke={iconStroke} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ======================== CARD GRID VIEW ======================== */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredGroups.map((group) => {
            const hasDiscount = Number(group.discount_value) > 0;
            return (
              <div
                key={group.id}
                className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200/80 dark:border-neutral-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Top colored accent line */}
                <div
                  className="h-1.5 w-full shrink-0"
                  style={{ backgroundColor: group.color || "#6366f1" }}
                />

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-neutral-900 shadow-xs"
                          style={{ backgroundColor: group.color || "#6366f1" }}
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-slate-900 dark:text-white text-base">
                              {group.name}
                            </h3>
                            {group.code && (
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-300 font-mono font-bold">
                                {group.code}
                              </span>
                            )}
                            {group.is_default && (
                              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold">
                                <IconStar className="w-3 h-3 fill-amber-500" />
                                {t("common.default", "Default")}
                              </span>
                            )}
                          </div>
                          {group.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                              {group.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-[11px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                          group.is_active
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                            : "bg-slate-100 dark:bg-neutral-800 text-slate-500 border border-slate-200 dark:border-neutral-700"
                        }`}
                      >
                        {group.is_active ? t("common.active", "Active") : t("common.inactive", "Inactive")}
                      </span>
                    </div>

                    {/* Offering / Discount Info Box */}
                    <div className="mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-100 dark:border-neutral-800 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                          <IconTag className="w-4 h-4 text-slate-400" />
                          <span>{t("customer_groups.discount_settings", "Offering")}</span>
                        </span>
                        {hasDiscount ? (
                          <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                            {group.discount_type === "PERCENTAGE"
                              ? `${group.discount_value}% ${t("customer_groups.off", "OFF")}`
                              : `$${group.discount_value} ${t("customer_groups.off", "OFF")}`}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">
                            {t("customer_groups.no_discount_tier", "No discount configured")}
                          </span>
                        )}
                      </div>

                      {hasDiscount && (
                        <div className="text-[12px] text-slate-600 dark:text-slate-300 font-medium">
                          {group.apply_to === "ALL" ? (
                            <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs">
                              {t("customer_groups.apply_to_all", "Entire Order")}
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs">
                              {t("customer_groups.apply_to_categories", "Categories")} ({group.target_category_ids?.length || 0})
                            </span>
                          )}
                          {group.min_order_amount > 0 && (
                            <span className="text-slate-500 dark:text-slate-400 block text-[11px] mt-1">
                              {t("customer_groups.min_order_amount", "Min spend")}: ${Number(group.min_order_amount).toFixed(2)}
                            </span>
                          )}
                          {group.max_discount_cap > 0 && (
                            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                              {t("customer_groups.max_discount_cap", "Max discount cap")}: ${Number(group.max_discount_cap).toFixed(2)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Member Count & Actions */}
                  <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-neutral-800">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-3">
                      <span className="flex items-center gap-1.5 font-medium">
                        <IconUsers className="w-4 h-4 text-slate-400" />
                        <span>{t("customer_groups.customer_count", "Members")}:</span>
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-neutral-800 px-2.5 py-0.5 rounded-full tabular-nums">
                        {group.customer_count || 0}
                      </span>
                    </div>

                    {isManageAllowed && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(group)}
                          className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-slate-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors active:scale-95"
                        >
                          <IconPencil className="w-3.5 h-3.5" />
                          <span>{t("common.edit", "Edit")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingGroup(group);
                            setReassignChoice("default");
                          }}
                          className="min-h-[42px] px-3.5 rounded-xl border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors active:scale-95"
                          title="Delete Group"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                          <span>{t("common.delete", "Delete")}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Group Modal (UX Zero-Scroll 2-Column Responsive Layout) ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200/80 dark:border-neutral-800 shadow-2xl max-w-4xl w-full flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-3.5 bg-white dark:bg-neutral-900 border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <IconUsers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                    {editingGroup
                      ? t("customer_groups.edit_group", "Edit Customer Group")
                      : t("customer_groups.new_group", "New Customer Group")}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("customer_groups.modal_subtitle", "Configure tier details, discount rules and membership")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors active:scale-95 shrink-0"
                aria-label="Close"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body - 2 Columns Grid (No Scroll Needed) */}
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 flex flex-col">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-7">
                {/* ── Left Column: Tier Identity & Settings ── */}
                <div className="space-y-4 flex flex-col justify-between">
                  {/* Group Name & Code */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="col-span-2 space-y-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        {t("customer_groups.group_name", "Group Name")} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder={t("customer_groups.group_name_placeholder", "e.g. VIP, Staff")}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        {t("customer_groups.group_code", "Code")}
                      </label>
                      <input
                        type="text"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        placeholder="VIP"
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none uppercase transition"
                      />
                    </div>
                  </div>

                  {/* Badge Color Picker */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      {t("customer_groups.group_color", "Badge Color")}
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {PRESET_COLORS.map((c) => {
                        const isSelected = formData.color === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setFormData({ ...formData, color: c })}
                            className={`w-7 h-7 rounded-full transition-all active:scale-90 flex items-center justify-center relative shadow-xs ${
                              isSelected
                                ? "ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-neutral-900 scale-110"
                                : "hover:scale-105"
                            }`}
                            style={{ backgroundColor: c }}
                            title={c}
                          >
                            {isSelected && <IconCheck className="w-3.5 h-3.5 text-white stroke-[3]" />}
                          </button>
                        );
                      })}
                      <div className="relative flex items-center">
                        <input
                          type="color"
                          id="custom-color-picker"
                          value={formData.color}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          className="sr-only"
                        />
                        <label
                          htmlFor="custom-color-picker"
                          className="w-7 h-7 rounded-full border border-dashed border-slate-300 dark:border-neutral-600 hover:border-indigo-500 flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 bg-slate-50 dark:bg-neutral-800"
                          title="Custom Color"
                        >
                          <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: formData.color }} />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      {t("customer_groups.description", "Description")}
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={t("customer_groups.description_placeholder", "Describe benefits or eligibility criteria...")}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    />
                  </div>

                  {/* Toggles: Default Group & Active Status (Compact horizontal Switch Cards) */}
                  <div className="space-y-2 pt-0.5">
                    {/* Default Group Toggle */}
                    <div
                      onClick={() => setFormData((prev) => ({ ...prev, is_default: !prev.is_default }))}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none active:scale-[0.98] ${
                        formData.is_default
                          ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/60"
                          : "bg-slate-50 dark:bg-neutral-800/40 border-slate-200/80 dark:border-neutral-800 hover:bg-slate-100/60"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <IconStar className={`w-4 h-4 shrink-0 ${formData.is_default ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                        <div className="truncate">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {t("customer_groups.is_default", "Default Group for New Customers")}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {t("customer_groups.is_default_hint", "Auto-assign to new registered customers")}
                          </div>
                        </div>
                      </div>
                      <div className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${formData.is_default ? "bg-amber-500" : "bg-slate-300 dark:bg-neutral-600"}`}>
                        <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform transform ${formData.is_default ? "translate-x-3.5" : "translate-x-0"}`} />
                      </div>
                    </div>

                    {/* Active Status Toggle */}
                    <div
                      onClick={() => setFormData((prev) => ({ ...prev, is_active: !prev.is_active }))}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none active:scale-[0.98] ${
                        formData.is_active
                          ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/60"
                          : "bg-slate-50 dark:bg-neutral-800/40 border-slate-200/80 dark:border-neutral-800 hover:bg-slate-100/60"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <IconCheck className={`w-4 h-4 shrink-0 stroke-[3] ${formData.is_active ? "text-emerald-600" : "text-slate-400"}`} />
                        <div className="truncate">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {t("customer_groups.is_active", "Active Status")}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {t("common.active_status_hint", "Active groups offer discounts and can be assigned")}
                          </div>
                        </div>
                      </div>
                      <div className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${formData.is_active ? "bg-emerald-600" : "bg-slate-300 dark:bg-neutral-600"}`}>
                        <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform transform ${formData.is_active ? "translate-x-3.5" : "translate-x-0"}`} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Right Column: Offering & Discount Rules ── */}
                <div className="space-y-3.5 flex flex-col justify-between">
                  {/* Section Title */}
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-neutral-800">
                    <div className="flex items-center gap-1.5">
                      <IconTag className="w-4 h-4 text-indigo-500" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        {t("customer_groups.discount_settings", "Offering & Discounts")}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      {formData.discount_value > 0 ? "Configured" : "Optional"}
                    </span>
                  </div>

                  {/* Discount Type & Value */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        {t("customer_groups.discount_type", "Discount Type")}
                      </label>
                      <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-neutral-800 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, discount_type: "PERCENTAGE" })}
                          className={`min-h-[34px] px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                            formData.discount_type === "PERCENTAGE"
                              ? "bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          <IconPercentage className="w-3.5 h-3.5" />
                          <span>%</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, discount_type: "FIXED" })}
                          className={`min-h-[34px] px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                            formData.discount_type === "FIXED"
                              ? "bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          <IconCurrencyDollar className="w-3.5 h-3.5" />
                          <span>Fixed</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        {t("customer_groups.discount_value", "Discount Value")}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={formData.discount_type === "PERCENTAGE" ? "100" : undefined}
                          value={formData.discount_value}
                          onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                          placeholder="0.00"
                          className="w-full min-h-[40px] pl-3 pr-8 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-xs sm:text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                          {formData.discount_type === "PERCENTAGE" ? "%" : "$"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Applicable Items */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      {t("customer_groups.apply_to", "Applicable Items")}
                    </label>
                    <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-neutral-800 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, apply_to: "ALL" })}
                        className={`min-h-[34px] px-2 rounded-lg text-xs font-semibold transition-all ${
                          formData.apply_to === "ALL"
                            ? "bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {t("customer_groups.apply_to_all", "Entire Order")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, apply_to: "CATEGORY" })}
                        className={`min-h-[34px] px-2 rounded-lg text-xs font-semibold transition-all ${
                          formData.apply_to === "CATEGORY"
                            ? "bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {t("customer_groups.apply_to_categories", "Categories")}
                        {formData.target_category_ids.length > 0 && ` (${formData.target_category_ids.length})`}
                      </button>
                    </div>

                    {formData.apply_to === "CATEGORY" && (
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 space-y-1 mt-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Categories:</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, target_category_ids: categories.map((c) => Number(c.id)) })}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                            >
                              All
                            </button>
                            <span>·</span>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, target_category_ids: [] })}
                              className="text-slate-500 hover:underline"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                          {categories.map((cat) => {
                            const isSelected = formData.target_category_ids?.includes(Number(cat.id));
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => toggleCategorySelection(cat.id)}
                                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all active:scale-95 ${
                                  isSelected
                                    ? "bg-indigo-600 text-white font-bold"
                                    : "bg-white dark:bg-neutral-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-neutral-600"
                                }`}
                              >
                                {cat.title}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Spend Limits */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        {t("customer_groups.min_order_amount", "Min Spend ($)")}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.min_order_amount}
                        onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value })}
                        placeholder="0.00"
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        {t("customer_groups.max_discount_cap", "Max Cap ($)")}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.max_discount_cap}
                        onChange={(e) => setFormData({ ...formData, max_discount_cap: e.target.value })}
                        placeholder="Optional"
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Live Summary Strip */}
                  <div className={`p-2.5 rounded-xl border text-xs leading-snug flex items-center gap-2 ${
                    getDiscountPreview().hasDiscount
                      ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200"
                      : "bg-slate-50 dark:bg-neutral-800/40 border-slate-200 dark:border-neutral-800 text-slate-500"
                  }`}>
                    <IconSparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="truncate font-medium">{getDiscountPreview().text}</span>
                  </div>
                </div>
              </div>

              {/* Modal Action Buttons Footer */}
              <div className="pt-4 mt-5 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  * Required fields
                </span>
                <div className="flex items-center gap-2.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="min-h-[42px] px-5 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-semibold transition-all active:scale-95"
                  >
                    {t("common.cancel", "Cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="min-h-[42px] px-6 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
                  >
                    {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    <span>{editingGroup ? t("customer_groups.update_group", "Update Group") : t("customer_groups.create_group", "Create Group")}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Safe Delete Confirmation Modal ── */}
      {deletingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200/80 dark:border-neutral-800 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center">
              <IconAlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t("customer_groups.delete_confirm_title", "Delete Customer Group")}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t("customer_groups.delete_confirm_msg", "Are you sure you want to delete this group?")}{" "}
                <span className="font-semibold text-slate-800 dark:text-white">"{deletingGroup.name}"</span>
              </p>
            </div>

            {deletingGroup.customer_count > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2.5">
                <p className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                  {t("customer_groups.delete_has_members_warning", { count: deletingGroup.customer_count })}
                </p>
                <div className="space-y-1.5 text-xs text-slate-800 dark:text-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="reassign"
                      value="default"
                      checked={reassignChoice === "default"}
                      onChange={(e) => setReassignChoice(e.target.value)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{t("customer_groups.reassign_to_default", "Move to Default Group")}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="reassign"
                      value="none"
                      checked={reassignChoice === "none"}
                      onChange={(e) => setReassignChoice(e.target.value)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{t("customer_groups.reassign_to_none", "Set to No Group (None)")}</span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingGroup(null)}
                className="min-h-[42px] px-5 rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-slate-300 text-sm font-semibold transition-colors"
              >
                {t("common.cancel", "Cancel")}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="min-h-[42px] px-6 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-semibold rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isDeleting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>{t("common.delete", "Delete")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
