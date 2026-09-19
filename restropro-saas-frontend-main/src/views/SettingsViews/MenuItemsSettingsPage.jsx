import React, { useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Page from "../../components/Page";
import {
  IconAlertTriangle,
  IconCarrot,
  IconCategory2,
  IconChevronDown,
  IconDownload,
  IconEye,
  IconEyeOff,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import { useCategories, useTaxes } from "../../controllers/settings.controller";
import toast from "react-hot-toast";
import { mutate } from "swr";
import { Link, useNavigate } from "react-router-dom";
import {
  addMenuItem,
  changeMenuItemVisibility,
  deleteMenuItem,
  useMenuItems,
  exportMenuItems,
} from "../../controllers/menu_item.controller";
import { useKitchenStations } from "../../controllers/kitchen_stations.controller";
import { useTheme } from "../../contexts/ThemeContext";
import { getImageURL } from "../../helpers/ImageHelper";
import ImportMenuItemsModal from "../../components/ImportMenuItemsModal";
import DeleteModal from "../../components/DeleteModal";
import clsx from "clsx";

export default function MenuItemsSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const titleRef = useRef();
  const descriptionRef = useRef();
  const priceRef = useRef();
  const netPriceRef = useRef();
  const taxIdRef = useRef();
  const categoryIdRef = useRef();
  const kitchenStationIdRef = useRef();
  const { theme } = useTheme();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [deleteItemData, setDeleteItemData] = useState(null);
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const {
    APIURL: APIURLCategories,
    data: categories,
    error: errorCategories,
    isLoading: isLoadingCategories,
  } = useCategories();

  const {
    APIURL: APIURLTaxes,
    data: taxes,
    error: errorTaxes,
    isLoading: isLoadingTaxes,
  } = useTaxes();

  const { APIURL, data: menuItems, error, isLoading } = useMenuItems();
  const { data: stations } = useKitchenStations();

  const filteredItems = useMemo(() => {
    if (!menuItems) return [];
    return menuItems.filter((item) => {
      const matchesCategory =
        selectedCategory === "all" || String(item.category_id) === String(selectedCategory);
      const matchesSearch =
        !search || item.title.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategory, search]);

  const categoryItemCounts = useMemo(() => {
    if (!menuItems) return {};
    const counts = { all: menuItems.length };
    menuItems.forEach((item) => {
      if (item.category_id) {
        counts[item.category_id] = (counts[item.category_id] || 0) + 1;
      }
    });
    return counts;
  }, [menuItems]);

  if (isLoadingCategories || isLoadingTaxes || isLoading) {
    return <Page>{t("menu_items.please_wait")}</Page>;
  }

  if (errorCategories || errorTaxes || error) {
    return <Page>{t("menu_items.error_loading_details")}</Page>;
  }

  async function btnAdd() {
    const title = titleRef.current.value;
    const description = descriptionRef.current.value || null;
    const price = priceRef.current.value;
    const netPrice = netPriceRef.current.value || null;
    const categoryId = categoryIdRef.current.value || null;
    const taxId = taxIdRef.current.value || null;
    const kitchenStationId = kitchenStationIdRef.current?.value || null;

    if (!title) {
      toast.error(t("menu_items.please_enter_title"));
      return;
    }
    if (price < 0) {
      toast.error(t("menu_items.please_provide_valid_price"));
      return;
    }

    try {
      toast.loading(t("menu_items.please_wait"));
      const res = await addMenuItem(title, description, price, netPrice, categoryId, taxId, kitchenStationId);

      if (res.status == 200) {
        titleRef.current.value = null;
        descriptionRef.current.value = null;
        priceRef.current.value = null;
        netPriceRef.current.value = null;
        categoryIdRef.current.value = "";
        taxIdRef.current.value = "";
        if (kitchenStationIdRef.current) kitchenStationIdRef.current.value = "";
        setIsAddDrawerOpen(false);
        await mutate(APIURL);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error.response.data.message || t("menu_items.something_went_wrong");
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  }

  const btnDelete = (id, title) => {
    setDeleteItemData({ id, title });
  };

  const confirmDelete = async () => {
    if (!deleteItemData) return;
    try {
      toast.loading(t("menu_items.please_wait"));
      const res = await deleteMenuItem(deleteItemData.id);
      if (res.status == 200) {
        await mutate(APIURL);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t("menu_items.something_went_wrong");
      console.error(error);
      toast.dismiss();
      toast.error(message);
    } finally {
      setDeleteItemData(null);
    }
  };

  const btnShowUpdate = (id) => {
    navigate(`/dashboard/settings/menu-items/${id}`);
  };

  const btnChangeItemVisibilty = async (id, isEnabled) => {
    try {
      toast.loading(t("menu_items.please_wait"));
      const res = await changeMenuItemVisibility(id, isEnabled);
      if (res.status == 200) {
        await mutate(APIURL);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t("menu_items.something_went_wrong");
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  };

  return (
    <Page className="px-4 md:px-8 py-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="text-2xl font-bold text-restro-text">{t("menu_items.title")}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {menuItems?.length || 0} items across {categories?.length || 0} categories
          </p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap py-0.5 no-scrollbar">
          <button
            id="btn-add-menu-item"
            onClick={() => setIsAddDrawerOpen(true)}
            className="rounded-xl border border-restro-border-green transition active:scale-95 hover:shadow-md px-3 py-2 text-sm whitespace-nowrap shrink-0 flex items-center gap-1.5 text-white bg-restro-green hover:bg-restro-green-button-hover font-semibold"
          >
            <IconPlus size={16} stroke={iconStroke} /> {t("menu_items.new")}
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="rounded-xl border border-restro-border-green transition active:scale-95 hover:shadow-md px-3 py-2 text-sm whitespace-nowrap shrink-0 flex items-center gap-1.5 text-restro-text bg-restro-gray hover:bg-restro-button-hover font-medium"
          >
            <IconUpload size={16} stroke={iconStroke} /> Import
          </button>
          <button
            onClick={async () => {
              try {
                toast.loading("Exporting...");
                const response = await exportMenuItems();
                const blob = new Blob([response.data], { type: "text/csv" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "menu_items_export.csv";
                a.click();
                window.URL.revokeObjectURL(url);
                toast.dismiss();
                toast.success("Exported successfully!");
              } catch (err) {
                toast.dismiss();
                toast.error("Export failed.");
              }
            }}
            className="rounded-xl border border-restro-border-green transition active:scale-95 hover:shadow-md px-3 py-2 text-sm whitespace-nowrap shrink-0 flex items-center gap-1.5 text-restro-text bg-restro-gray hover:bg-restro-button-hover font-medium"
          >
            <IconDownload size={16} stroke={iconStroke} /> Export
          </button>
          <Link
            to="categories"
            className="rounded-xl border border-restro-border-green transition active:scale-95 hover:shadow-md px-3 py-2 text-sm whitespace-nowrap shrink-0 flex items-center gap-1.5 text-restro-text bg-restro-gray hover:bg-restro-button-hover font-medium"
          >
            <IconCategory2 size={16} stroke={iconStroke} /> {t("menu_items.categories")}
          </Link>
        </div>
      </div>

      {/* ── Search & Category Filter ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search bar */}
        <div className="relative flex-1 max-w-md">
          <IconSearch
            size={16}
            stroke={iconStroke}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search items by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 w-full text-sm rounded-xl border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green placeholder-gray-400"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
            >
              <IconX size={14} />
            </button>
          )}
        </div>

        {/* Category filter pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setSelectedCategory("all")}
            className={clsx(
              "px-3 py-1.5 rounded-full text-xs font-semibold transition shrink-0 border",
              selectedCategory === "all"
                ? "bg-restro-green text-white border-restro-green"
                : "text-restro-text bg-restro-gray border-restro-border-green hover:bg-restro-button-hover"
            )}
          >
            All <span className="ml-1 opacity-70">({categoryItemCounts.all || 0})</span>
          </button>
          {categories?.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(String(cat.id))}
              className={clsx(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition shrink-0 border whitespace-nowrap",
                String(selectedCategory) === String(cat.id)
                  ? "bg-restro-green text-white border-restro-green"
                  : "text-restro-text bg-restro-gray border-restro-border-green hover:bg-restro-button-hover"
              )}
            >
              {cat.title}
              <span className="ml-1 opacity-70">({categoryItemCounts[cat.id] || 0})</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Item Grid ── */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-restro-gray flex items-center justify-center mb-4 text-gray-400">
            <IconCarrot size={32} stroke={iconStroke} />
          </div>
          <p className="text-base font-semibold text-restro-text mb-1">No items found</p>
          <p className="text-sm text-gray-500">
            {search ? `No results for "${search}"` : "Add your first menu item to get started."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filteredItems.map((menuItem) => {
            const {
              id,
              title,
              price,
              category_title,
              addons,
              variants,
              is_enabled,
              image,
              kitchen_station_id,
              effective_kitchen_station_name,
              effective_kitchen_station_color,
            } = menuItem;
            const imageURL = image ? getImageURL(image) : null;

            return (
              <div
                key={id}
                onClick={() => btnShowUpdate(id)}
                className={clsx(
                  "group relative flex flex-col rounded-2xl border overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5",
                  is_enabled
                    ? "bg-white dark:bg-[#252525] border-restro-border-green hover:border-restro-green/50"
                    : "bg-gray-100 dark:bg-gray-900/40 border-restro-border-green opacity-70"
                )}
              >
                {/* Image area */}
                <div className="relative w-full h-40 bg-restro-gray overflow-hidden flex items-center justify-center flex-shrink-0">
                  {imageURL ? (
                    <img
                      src={imageURL}
                      alt={title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400 gap-2">
                      <IconCarrot size={32} stroke={iconStroke} />
                    </div>
                  )}

                  {/* Status badge */}
                  <div
                    className={clsx(
                      "absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border",
                      is_enabled
                        ? "bg-emerald-500/90 text-white border-emerald-400/40"
                        : "bg-gray-500/80 text-white border-gray-400/40"
                    )}
                  >
                    {is_enabled ? "Active" : "Hidden"}
                  </div>

                  {/* Category badge */}
                  {category_title && (
                    <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50 backdrop-blur-sm text-[10px] text-white font-medium truncate">
                      {category_title}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 p-3">
                  <p className="font-semibold text-sm text-restro-text group-hover:text-restro-green transition-colors truncate leading-snug">
                    {title}
                  </p>

                  {/* Chips row */}
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {effective_kitchen_station_name && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border border-black/5 dark:border-white/10"
                        style={{
                          backgroundColor: `${effective_kitchen_station_color || '#f97316'}20`,
                          color: effective_kitchen_station_color || '#f97316'
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: effective_kitchen_station_color || '#f97316' }} />
                        <span>{effective_kitchen_station_name}</span>
                        {kitchen_station_id && <span className="text-[9px] opacity-75 font-normal">(Override)</span>}
                      </span>
                    )}
                    {variants?.length > 0 && (
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        {variants.length} Variants
                      </span>
                    )}
                    {addons?.length > 0 && (
                      <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        {addons.length} Addons
                      </span>
                    )}
                  </div>

                  {/* Price + Actions */}
                  <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                    <span className="text-restro-green font-bold text-sm">
                      {price}
                    </span>
                    <div
                      className="flex items-center gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        title={is_enabled ? "Hide item" : "Show item"}
                        onClick={(e) => {
                          e.stopPropagation();
                          btnChangeItemVisibilty(id, !is_enabled);
                        }}
                        className={clsx(
                          "w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-95 text-restro-text",
                          theme === "light"
                            ? "hover:bg-restro-button-hover"
                            : "hover:bg-restro-button-hover text-white"
                        )}
                      >
                        {is_enabled ? (
                          <IconEye size={16} stroke={iconStroke} />
                        ) : (
                          <IconEyeOff size={16} stroke={iconStroke} />
                        )}
                      </button>
                      <button
                        title="Edit item"
                        onClick={(e) => {
                          e.stopPropagation();
                          btnShowUpdate(id);
                        }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-95 text-restro-text hover:bg-restro-button-hover"
                      >
                        <IconPencil size={16} stroke={iconStroke} />
                      </button>
                      <button
                        title="Delete item"
                        onClick={(e) => {
                          e.stopPropagation();
                          btnDelete(id, title);
                        }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-restro-red transition active:scale-95 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <IconTrash size={16} stroke={iconStroke} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Right-Side Add Drawer ── */}
      {/* Overlay */}
      <div
        onClick={() => setIsAddDrawerOpen(false)}
        className={clsx(
          "fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300",
          isAddDrawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      />
      {/* Drawer panel */}
      <div
        className={clsx(
          "fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-[#1a1a1a] shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out",
          isAddDrawerOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-restro-border-green shrink-0">
          <div>
            <h3 className="text-lg font-bold text-restro-text">Add New Item</h3>
            <p className="text-xs text-gray-500 mt-0.5">Fill in the details below</p>
          </div>
          <button
            onClick={() => setIsAddDrawerOpen(false)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-restro-text hover:bg-restro-button-hover transition active:scale-95"
          >
            <IconX size={20} stroke={iconStroke} />
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="mb-1 block text-gray-500 text-sm font-medium">
              {t("menu_items.item_title")} <span className="text-red-400">*</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              className="text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green"
              placeholder={t("menu_items.enter_item_title")}
            />
          </div>

          <div>
            <label className="mb-1 block text-gray-500 text-sm font-medium">
              {t("menu_items.item_description")}
              <span className="text-xs text-gray-400 ml-1">{t("menu_items.max_chars")}</span>
            </label>
            <textarea
              ref={descriptionRef}
              className="text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green resize-none"
              placeholder={t("menu_items.enter_item_description")}
              rows="3"
              maxLength={500}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-gray-500 text-sm font-medium">
                {t("menu_items.item_price")} <span className="text-red-400">*</span>
              </label>
              <input
                ref={priceRef}
                type="number"
                className="text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-1 block text-gray-500 text-sm font-medium">
                {t("menu_items.item_net_price")}
              </label>
              <input
                ref={netPriceRef}
                type="number"
                className="text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-gray-500 text-sm font-medium">
                {t("menu_items.item_category")}
              </label>
              <select
                ref={categoryIdRef}
                className="text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green"
              >
                <option value="">{t("menu_items.none")}</option>
                {categories?.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-gray-500 text-sm font-medium">
                {t("menu_items.item_tax")}
              </label>
              <select
                ref={taxIdRef}
                className="text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green"
              >
                <option value="">{t("menu_items.none")}</option>
                {taxes?.map((tax) => (
                  <option value={tax.id} key={tax.id}>
                    {tax.title} - {tax.rate}% ({tax.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-gray-500 text-sm font-medium">
              Kitchen Station
            </label>
            <select
              ref={kitchenStationIdRef}
              className="text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green"
            >
              <option value="">Category Default (Auto-routes by category)</option>
              {stations?.filter((s) => s.is_enabled)?.map((station) => (
                <option value={station.id} key={station.id}>
                  {station.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">
              Override prep station routing for this item, or leave as Category Default.
            </p>
          </div>

          <div className="pt-2 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 px-4 py-3 flex gap-2">
            <IconAlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" stroke={iconStroke} />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              After saving, open the item to upload a photo and add variants or addons.
            </p>
          </div>
        </div>

        {/* Drawer footer */}
        <div className="px-6 py-4 border-t border-restro-border-green shrink-0 flex gap-3">
          <button
            onClick={() => setIsAddDrawerOpen(false)}
            className="flex-1 rounded-xl border border-restro-border-green px-4 py-2.5 text-sm font-medium text-restro-text bg-restro-gray hover:bg-restro-button-hover transition active:scale-95"
          >
            {t("menu_items.close")}
          </button>
          <button
            onClick={btnAdd}
            className="flex-1 rounded-xl border border-restro-border-green px-4 py-2.5 text-sm font-semibold text-white bg-restro-green hover:bg-restro-green-button-hover transition active:scale-95"
          >
            {t("menu_items.save")}
          </button>
        </div>
      </div>

      {/* Import Modal */}
      <ImportMenuItemsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => mutate(APIURL)}
      />

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={Boolean(deleteItemData)}
        onClose={() => setDeleteItemData(null)}
        onConfirm={confirmDelete}
        title="Delete Menu Item?"
        description={t("menu_items.process_irreversible")}
        cancelText={t("menu_items.close") || "Cancel"}
        confirmText="Delete Item"
      />
    </Page>
  );
}
