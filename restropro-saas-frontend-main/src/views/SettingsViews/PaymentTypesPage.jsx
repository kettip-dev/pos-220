import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Page from "../../components/Page";
import DeleteModal from "../../components/DeleteModal";
import {
  IconCheck,
  IconPencil,
  IconPlus,
  IconTrash,
  IconSearch,
  IconX,
  IconCreditCard,
  IconAlertCircle,
  IconArrowLeft,
  IconFilter,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import {
  PAYMENT_ICON_OPTIONS,
  getPaymentIconData,
} from "../../config/payment_icons";
import {
  addNewPaymentType,
  deletePaymentType,
  togglePaymentType,
  updatePaymentType,
  usePaymentTypes,
} from "../../controllers/settings.controller";
import toast from "react-hot-toast";
import { mutate } from "swr";
import clsx from "clsx";

export default function PaymentTypesPage() {
  const { t } = useTranslation();

  const { APIURL, data: rawPaymentTypes, error, isLoading } = usePaymentTypes();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'active' | 'inactive'

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editItem, setEditItem] = useState(null); // object when editing
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for Add modal
  const [addTitle, setAddTitle] = useState("");
  const [addIcon, setAddIcon] = useState("cash");

  // Form states for Edit modal
  const [editTitle, setEditTitle] = useState("");
  const [editIcon, setEditIcon] = useState("cash");
  const [editIsActive, setEditIsActive] = useState(true);

  const paymentTypesList = useMemo(() => {
    if (!rawPaymentTypes) return [];
    if (Array.isArray(rawPaymentTypes)) return rawPaymentTypes;
    if (Array.isArray(rawPaymentTypes.paymentTypes)) return rawPaymentTypes.paymentTypes;
    return [];
  }, [rawPaymentTypes]);

  // Filtered payment methods
  const filteredPaymentTypes = useMemo(() => {
    return paymentTypesList.filter((pt) => {
      const isItemActive = pt.is_active === 1 || pt.is_active === true;
      if (statusFilter === "active" && !isItemActive) return false;
      if (statusFilter === "inactive" && isItemActive) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = (pt.title || "").toLowerCase().includes(query);
        const matchesIcon = (pt.icon || "").toLowerCase().includes(query);
        return matchesTitle || matchesIcon;
      }
      return true;
    });
  }, [paymentTypesList, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = paymentTypesList.length;
    const active = paymentTypesList.filter(
      (pt) => pt.is_active === 1 || pt.is_active === true
    ).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [paymentTypesList]);

  if (isLoading) {
    return (
      <Page className="px-4 md:px-8 py-6">
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-slate-500">
          <div className="loading loading-spinner loading-md text-emerald-600"></div>
          <p className="text-sm">{t("payment_types.please_wait", "Loading payment methods...")}</p>
        </div>
      </Page>
    );
  }

  if (error) {
    console.error(error);
    return (
      <Page className="px-4 md:px-8 py-6">
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3">
          <IconAlertCircle size={22} stroke={iconStroke} />
          <p className="text-sm font-medium">
            {t("payment_types.error_loading_data", "Failed to load payment methods. Please refresh.")}
          </p>
        </div>
      </Page>
    );
  }

  // Action: Add Payment Type
  const handleAddSubmit = async (e) => {
    e?.preventDefault();
    const title = addTitle.trim();
    if (!title) {
      toast.error(t("payment_types.payment_type_title", "Please enter a payment method name"));
      return;
    }

    try {
      setIsSubmitting(true);
      const toastId = toast.loading(t("payment_types.please_wait", "Saving..."));
      const res = await addNewPaymentType(title, true, addIcon);

      if (res.status === 200) {
        setAddTitle("");
        setAddIcon("cash");
        setIsAddOpen(false);
        await mutate(APIURL);
        toast.dismiss(toastId);
        toast.success(res.data?.message || "Payment method added successfully");
      }
    } catch (err) {
      toast.dismiss();
      const message = err?.response?.data?.message || t("payment_types.something_went_wrong", "Something went wrong");
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (item) => {
    setEditItem(item);
    setEditTitle(item.title || "");
    setEditIcon(item.icon || "cash");
    setEditIsActive(item.is_active === 1 || item.is_active === true);
  };

  // Action: Update Payment Type
  const handleUpdateSubmit = async (e) => {
    e?.preventDefault();
    if (!editItem) return;

    const title = editTitle.trim();
    if (!title) {
      toast.error(t("payment_types.payment_type_title", "Please enter a payment method name"));
      return;
    }

    try {
      setIsSubmitting(true);
      const toastId = toast.loading(t("payment_types.please_wait", "Updating..."));
      const res = await updatePaymentType(editItem.id, title, editIsActive, editIcon);

      if (res.status === 200) {
        setEditItem(null);
        await mutate(APIURL);
        toast.dismiss(toastId);
        toast.success(res.data?.message || "Payment method updated successfully");
      }
    } catch (err) {
      toast.dismiss();
      const message = err?.response?.data?.message || t("payment_types.something_went_wrong", "Something went wrong");
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Toggle Active Status
  const handleToggle = async (id, currentVal) => {
    const newVal = !currentVal;
    try {
      const toastId = toast.loading(t("payment_types.please_wait", "Updating status..."));
      const res = await togglePaymentType(id, newVal);

      if (res.status === 200) {
        await mutate(APIURL);
        toast.dismiss(toastId);
        toast.success(res.data?.message || "Status updated");
      }
    } catch (err) {
      toast.dismiss();
      const message = err?.response?.data?.message || t("payment_types.something_went_wrong", "Something went wrong");
      toast.error(message);
    }
  };

  // Action: Delete Payment Type
  const handleDelete = async (id) => {
    try {
      const toastId = toast.loading(t("payment_types.please_wait", "Deleting..."));
      const res = await deletePaymentType(id);

      if (res.status === 200) {
        await mutate(APIURL);
        toast.dismiss(toastId);
        toast.success(res.data?.message || "Payment method deleted");
      }
    } catch (err) {
      toast.dismiss();
      const message = err?.response?.data?.message || t("payment_types.something_went_wrong", "Something went wrong");
      toast.error(message);
    }
  };

  return (
    <Page className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
      {/* ── Breadcrumb & Navigation ── */}
      <div className="flex items-center gap-2 mb-2 text-xs font-medium text-slate-400 dark:text-zinc-500">
        <Link
          to="/dashboard/settings"
          className="hover:text-emerald-600 transition flex items-center gap-1"
        >
          <IconArrowLeft size={14} stroke={iconStroke} />
          {t("settings.title", "Settings")}
        </Link>
        <span>/</span>
        <span className="text-slate-600 dark:text-zinc-300">
          {t("payment_types.title", "Payment Types")}
        </span>
      </div>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t("payment_types.title", "Payment Methods")}
            </h1>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
              {stats.active} Active
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Configure tender options accepted at POS checkout, terminal payments, and customer receipts.
          </p>
        </div>

        <button
          onClick={() => {
            setAddTitle("");
            setAddIcon("cash");
            setIsAddOpen(true);
          }}
          className="rounded-xl border border-emerald-600 transition active:scale-95 hover:shadow-md px-4 py-2.5 text-sm flex items-center justify-center gap-2 text-white bg-emerald-600 hover:bg-emerald-700 font-semibold shrink-0 min-h-[42px] shadow-sm cursor-pointer"
        >
          <IconPlus size={18} stroke={iconStroke} />
          <span>{t("payment_types.new", "Add Payment Method")}</span>
        </button>
      </div>

      {/* ── Search, Stats & Filter Bar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-6 mb-6">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <IconSearch
            size={18}
            stroke={iconStroke}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("payment_types.search_placeholder", "Search payment methods...")}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-sm h-[42px]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
            >
              <IconX size={16} stroke={iconStroke} />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/60 dark:border-zinc-700/60 self-start md:self-auto">
          <button
            onClick={() => setStatusFilter("all")}
            className={clsx(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition active:scale-95",
              statusFilter === "all"
                ? "bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
            )}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={clsx(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition active:scale-95",
              statusFilter === "active"
                ? "bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
            )}
          >
            Active ({stats.active})
          </button>
          <button
            onClick={() => setStatusFilter("inactive")}
            className={clsx(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition active:scale-95",
              statusFilter === "inactive"
                ? "bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
            )}
          >
            Disabled ({stats.inactive})
          </button>
        </div>
      </div>

      {/* ── Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {/* Quick Add Card */}
        <button
          onClick={() => {
            setAddTitle("");
            setAddIcon("cash");
            setIsAddOpen(true);
          }}
          className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-800 hover:border-emerald-500/60 bg-white/50 dark:bg-[#1a1a1a]/50 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10 transition-all duration-200 p-6 min-h-[160px] cursor-pointer active:scale-95"
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/60 flex items-center justify-center transition shadow-sm">
            <IconPlus size={24} stroke={iconStroke} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-center">
            <span className="text-sm font-bold text-slate-700 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition block">
              {t("payment_types.new", "Add Payment Method")}
            </span>
            <span className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5 block">
              Cash, Card, QR, or Rewards
            </span>
          </div>
        </button>

        {/* Payment Method Cards */}
        {filteredPaymentTypes.map((paymentType) => {
          const { id, title, is_active, icon } = paymentType;
          const isActive = is_active === 1 || is_active === true;
          const iconData = getPaymentIconData(icon, title);
          const IconComponent = iconData.Icon || IconCreditCard;

          return (
            <div
              key={id}
              className={clsx(
                "relative flex flex-col justify-between rounded-2xl border transition-all duration-200 overflow-hidden bg-white dark:bg-[#1e1e1e] shadow-sm hover:shadow-md",
                isActive
                  ? "border-slate-200 dark:border-zinc-800"
                  : "border-slate-200/60 dark:border-zinc-800/60 opacity-75"
              )}
            >
              {/* Top Accent Strip */}
              <div
                className="h-1.5 w-full"
                style={{ backgroundColor: iconData.accent || "#10b981" }}
              />

              {/* Main Content */}
              <div className="p-5 flex-1 flex flex-col justify-between gap-5">
                {/* Header Row: Icon, Title & Toggle Switch */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Styled Icon Badge */}
                    <div
                      className={clsx(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition shadow-sm",
                        iconData.bg,
                        iconData.border,
                        iconData.color
                      )}
                    >
                      <IconComponent size={24} stroke={iconStroke} />
                    </div>

                    {/* Method Details */}
                    <div className="min-w-0">
                      <h3
                        className="font-bold text-base text-slate-900 dark:text-white leading-tight truncate"
                        title={title}
                      >
                        {title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 truncate">
                        {iconData.label}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <label
                    className="relative flex items-center cursor-pointer shrink-0 mt-0.5"
                    title={isActive ? "Disable payment method" : "Enable payment method"}
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => handleToggle(id, isActive)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Footer Row: Status Pill & Action Buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                  {/* Status Indicator */}
                  <span
                    className={clsx(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                        : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400"
                    )}
                  >
                    <span
                      className={clsx(
                        "w-2 h-2 rounded-full",
                        isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400 dark:bg-zinc-500"
                      )}
                    />
                    {isActive ? "Active at POS" : "Disabled"}
                  </span>

                  {/* Edit & Delete Action Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(paymentType)}
                      title="Edit payment method"
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition active:scale-95 border border-slate-200/60 dark:border-zinc-700/60"
                    >
                      <IconPencil size={17} stroke={iconStroke} />
                    </button>
                    <button
                      onClick={() => setItemToDelete({ id, title })}
                      title="Delete payment method"
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 transition active:scale-95 border border-rose-200/60 dark:border-rose-900/40"
                    >
                      <IconTrash size={17} stroke={iconStroke} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State when no results match search or filter */}
      {filteredPaymentTypes.length === 0 && (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-800 p-12 text-center flex flex-col items-center justify-center bg-white/50 dark:bg-[#1a1a1a]/50">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-400 flex items-center justify-center mb-4">
            <IconSearch size={32} stroke={iconStroke} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            No payment methods found
          </h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm mt-1 mb-5">
            {searchQuery
              ? `No methods match "${searchQuery}". Try a different search query.`
              : "No payment methods match the selected filter."}
          </p>
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery("")}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition"
            >
              Clear Search
            </button>
          ) : (
            <button
              onClick={() => {
                setAddTitle("");
                setAddIcon("cash");
                setIsAddOpen(true);
              }}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition active:scale-95"
            >
              Add Payment Method
            </button>
          )}
        </div>
      )}

      {/* ── Modal: Add Payment Type ── */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <IconPlus size={20} stroke={iconStroke} />
                </div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  {t("payment_types.add_new_payment_type", "New Payment Method")}
                </h3>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                <IconX size={18} stroke={iconStroke} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddSubmit} className="mt-5 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                  {t("payment_types.payment_type_title", "Payment Method Title")} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder="e.g. Starbucks Card / Rewards, KHQR, ABA Mobile, Cash"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition text-sm h-11"
                  required
                />
              </div>

              {/* Visual Icon Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                  {t("payment_types.icon", "Choose Icon")}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {PAYMENT_ICON_OPTIONS.map((item) => {
                    const isSelected = addIcon === item.id;
                    const ItemIcon = item.Icon;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setAddIcon(item.id)}
                        className={clsx(
                          "flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition active:scale-95",
                          isSelected
                            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                            : "border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700"
                        )}
                      >
                        <div
                          className={clsx(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            item.bg,
                            item.color
                          )}
                        >
                          <ItemIcon size={18} stroke={iconStroke} />
                        </div>
                        <span className="text-xs font-semibold truncate flex-1">
                          {item.label}
                        </span>
                        {isSelected && (
                          <IconCheck size={16} stroke={iconStroke} className="text-emerald-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition font-medium text-sm min-h-[42px] active:scale-95 cursor-pointer"
                >
                  {t("payment_types.close", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition active:scale-95 shadow-sm text-sm min-h-[42px] flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="loading loading-spinner loading-xs text-white" />
                  ) : (
                    <IconPlus size={18} stroke={iconStroke} />
                  )}
                  <span>{t("payment_types.save", "Save Payment Method")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Update Payment Type ── */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <IconPencil size={20} stroke={iconStroke} />
                </div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  {t("payment_types.update_payment_type", "Edit Payment Method")}
                </h3>
              </div>
              <button
                onClick={() => setEditItem(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                <IconX size={18} stroke={iconStroke} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUpdateSubmit} className="mt-5 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                  {t("payment_types.payment_type_title", "Payment Method Title")} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. Starbucks Card / Rewards, KHQR, ABA Mobile, Cash"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition text-sm h-11"
                  required
                />
              </div>

              {/* Status Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                    {t("payment_types.active", "Active Status")}
                  </label>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Allow cashiers to accept this tender at POS checkout
                  </p>
                </div>
                <label className="relative flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Visual Icon Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                  {t("payment_types.icon", "Choose Icon")}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {PAYMENT_ICON_OPTIONS.map((item) => {
                    const isSelected = editIcon === item.id;
                    const ItemIcon = item.Icon;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setEditIcon(item.id)}
                        className={clsx(
                          "flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition active:scale-95",
                          isSelected
                            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                            : "border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700"
                        )}
                      >
                        <div
                          className={clsx(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            item.bg,
                            item.color
                          )}
                        >
                          <ItemIcon size={18} stroke={iconStroke} />
                        </div>
                        <span className="text-xs font-semibold truncate flex-1">
                          {item.label}
                        </span>
                        {isSelected && (
                          <IconCheck size={16} stroke={iconStroke} className="text-emerald-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition font-medium text-sm min-h-[42px] active:scale-95 cursor-pointer"
                >
                  {t("payment_types.close", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition active:scale-95 shadow-sm text-sm min-h-[42px] flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="loading loading-spinner loading-xs text-white" />
                  ) : (
                    <IconCheck size={18} stroke={iconStroke} />
                  )}
                  <span>{t("payment_types.save", "Save Changes")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      <DeleteModal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onConfirm={async () => {
          const targetId = itemToDelete?.id;
          setItemToDelete(null);
          if (targetId) {
            await handleDelete(targetId);
          }
        }}
        title={t("payment_types.delete_payment_type", "Delete Payment Type")}
        description={t(
          "payment_types.delete_confirm",
          "Are you sure you want to delete this payment method? This action cannot be undone."
        )}
        itemName={itemToDelete?.title}
      />
    </Page>
  );
}
