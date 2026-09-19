import React, { useRef, useState, useMemo } from "react";
import Page from "../../components/Page";
import DeleteModal from "../../components/DeleteModal";
import {
  IconCategory2,
  IconEye,
  IconEyeOff,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import {
  addCategory,
  deleteCategory,
  updateCategory,
  useCategories,
  changeCategoryVisibilty,
} from "../../controllers/settings.controller";
import { useMenuItems } from "../../controllers/menu_item.controller";
import { useKitchenStations } from "../../controllers/kitchen_stations.controller";
import toast from "react-hot-toast";
import { mutate } from "swr";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../contexts/ThemeContext";
import { Link } from "react-router-dom";
import clsx from "clsx";

// Consistent gradient palette keyed by index
const CATEGORY_GRADIENTS = [
  "from-emerald-500 to-teal-600",
  "from-blue-500 to-indigo-600",
  "from-purple-500 to-violet-600",
  "from-rose-500 to-pink-600",
  "from-orange-500 to-amber-600",
  "from-cyan-500 to-sky-600",
  "from-lime-500 to-green-600",
  "from-fuchsia-500 to-purple-600",
];

export default function CategoriesPage() {
  const { t } = useTranslation();
  const categoryTitleRef = useRef();
  const categoryIdRef = useRef();
  const categoryTitleUpdateRef = useRef();
  const [deleteCategoryId, setDeleteCategoryId] = useState(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editCategory, setEditCategory] = useState(null); // { id, title, kitchen_station_id }
  const [addStationId, setAddStationId] = useState("");
  const [editStationId, setEditStationId] = useState("");
  const { theme } = useTheme();

  const { APIURL, data: categories, error, isLoading } = useCategories();
  const { data: menuItems } = useMenuItems();
  const { data: stations } = useKitchenStations();

  // Count items per category
  const itemCounts = useMemo(() => {
    if (!menuItems) return {};
    const counts = {};
    menuItems.forEach((item) => {
      if (item.category_id) {
        counts[item.category_id] = (counts[item.category_id] || 0) + 1;
      }
    });
    return counts;
  }, [menuItems]);

  if (isLoading) {
    return <Page className="px-8 py-6">{t("categories.please_wait")}</Page>;
  }

  if (error) {
    console.error(error);
    return <Page className="px-8 py-6">{t("categories.error_loading_data")}</Page>;
  }

  async function btnAdd() {
    const title = categoryTitleRef.current?.value?.trim();
    if (!title) {
      toast.error(t("categories.please_provide_category_title"));
      return;
    }
    try {
      toast.loading(t("categories.please_wait"));
      const res = await addCategory(title, addStationId || null);
      if (res.status == 200) {
        categoryTitleRef.current.value = "";
        setAddStationId("");
        setIsAddOpen(false);
        await mutate(APIURL);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t("categories.something_went_wrong");
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  }

  const btnUpdate = async () => {
    const id = editCategory?.id;
    const title = categoryTitleUpdateRef.current?.value?.trim();
    if (!title) {
      toast.error(t("categories.please_provide_category_title"));
      return;
    }
    try {
      toast.loading(t("categories.please_wait"));
      const res = await updateCategory(id, title, editStationId || null);
      if (res.status == 200) {
        setEditCategory(null);
        setEditStationId("");
        await mutate(APIURL);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t("categories.something_went_wrong");
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  };

  const btnDelete = async (id) => {
    try {
      toast.loading(t("categories.please_wait"));
      const res = await deleteCategory(id);
      if (res.status == 200) {
        await mutate(APIURL);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t("categories.something_went_wrong");
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  };

  const btnChangeCategoryVisibilty = async (id, isEnabled) => {
    try {
      toast.loading(t("categories.please_wait"));
      const res = await changeCategoryVisibilty(id, isEnabled);
      if (res.status == 200) {
        await mutate(APIURL);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t("categories.something_went_wrong");
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  };

  return (
    <Page className="px-4 md:px-8 py-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Link
              to="/dashboard/settings/menu-items"
              className="text-sm text-gray-500 hover:text-restro-green transition"
            >
              ← Menu Items
            </Link>
          </div>
          <h3 className="text-2xl font-bold text-restro-text">{t("categories.title")}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{categories?.length || 0} categories</p>
        </div>
        <button
          id="btn-add-category"
          onClick={() => setIsAddOpen(true)}
          className="rounded-xl border border-restro-border-green transition active:scale-95 hover:shadow-md px-3 py-2 text-sm flex items-center gap-1.5 text-white bg-restro-green hover:bg-restro-green-button-hover font-semibold shrink-0"
        >
          <IconPlus size={16} stroke={iconStroke} /> {t("categories.new")}
        </button>
      </div>

      {/* ── Category Card Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {/* Add new card */}
        <button
          onClick={() => setIsAddOpen(true)}
          className="group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-restro-border-green hover:border-restro-green/60 bg-restro-gray hover:bg-restro-button-hover transition-all duration-200 p-6 min-h-[140px] cursor-pointer active:scale-95"
        >
          <div className="w-10 h-10 rounded-xl bg-restro-green/10 group-hover:bg-restro-green/20 flex items-center justify-center transition">
            <IconPlus size={22} stroke={iconStroke} className="text-restro-green" />
          </div>
          <span className="text-sm font-semibold text-restro-text/70 group-hover:text-restro-text transition">
            Add Category
          </span>
        </button>

        {/* Category cards */}
        {categories?.map((category, index) => {
          const { id, title, is_enabled } = category;
          const count = itemCounts[id] || 0;
          const gradient = CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length];
          const initials = title.slice(0, 2).toUpperCase();

          return (
            <div
              key={id}
              className={clsx(
                "relative flex flex-col rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-md",
                is_enabled
                  ? "bg-white dark:bg-[#252525] border-restro-border-green"
                  : "bg-gray-100 dark:bg-gray-900/40 border-restro-border-green opacity-60"
              )}
            >
              {/* Top color band with initials avatar */}
              <div className={clsx("h-16 bg-gradient-to-br flex items-center justify-center", gradient)}>
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-base shadow-sm">
                  {initials}
                </div>
              </div>

              {/* Body */}
              <div className="p-3 flex-1 flex flex-col gap-2">
                <p className="font-semibold text-sm text-restro-text truncate">{title}</p>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Item count badge */}
                  <span className="text-[10px] font-semibold bg-restro-gray text-restro-text px-2 py-0.5 rounded-full border border-restro-border-green">
                    {count} items
                  </span>
                  {/* Visibility badge */}
                  <span
                    className={clsx(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide",
                      is_enabled
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                    )}
                  >
                    {is_enabled ? "Visible" : "Hidden"}
                  </span>
                  {/* Station badge */}
                  {cat.kitchen_station_name && (
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border border-black/5 dark:border-white/10"
                      style={{
                        backgroundColor: `${cat.kitchen_station_color || '#f97316'}20`,
                        color: cat.kitchen_station_color || '#f97316'
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.kitchen_station_color || '#f97316' }} />
                      <span>{cat.kitchen_station_name}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Action bar */}
              <div className="px-3 pb-3 flex items-center gap-1 justify-end">
                <button
                  title={is_enabled ? "Hide category" : "Show category"}
                  onClick={() => btnChangeCategoryVisibilty(id, !is_enabled)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-95 text-restro-text hover:bg-restro-button-hover"
                >
                  {is_enabled ? (
                    <IconEye size={15} stroke={iconStroke} />
                  ) : (
                    <IconEyeOff size={15} stroke={iconStroke} />
                  )}
                </button>
                <button
                  title="Edit category"
                  onClick={() => {
                    setEditCategory(cat);
                    setEditStationId(cat.kitchen_station_id ? String(cat.kitchen_station_id) : "");
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-95 text-restro-text hover:bg-restro-button-hover"
                >
                  <IconPencil size={15} stroke={iconStroke} />
                </button>
                <button
                  title="Delete category"
                  onClick={() => setDeleteCategoryId(id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-restro-red transition active:scale-95 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <IconTrash size={15} stroke={iconStroke} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Add Category Mini Modal ── */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsAddOpen(false)}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl border border-restro-border-green p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-restro-text">{t("categories.add_new_category")}</h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-restro-text hover:bg-restro-button-hover transition"
              >
                <IconX size={18} stroke={iconStroke} />
              </button>
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-gray-500 text-sm font-medium">
                {t("categories.category_title")}
              </label>
              <input
                ref={categoryTitleRef}
                type="text"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && btnAdd()}
                className="text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green"
                placeholder={t("categories.enter_category_title")}
              />
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-gray-500 text-sm font-medium">
                Kitchen Station
              </label>
              <select
                value={addStationId}
                onChange={(e) => setAddStationId(e.target.value)}
                className="text-sm w-full rounded-xl px-3 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green"
              >
                <option value="">Default (Master Kitchen)</option>
                {stations?.filter(s => s.is_enabled)?.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                Items in this category route to this station by default.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsAddOpen(false)}
                className="flex-1 rounded-xl border border-restro-border-green px-4 py-2.5 text-sm font-medium text-restro-text bg-restro-gray hover:bg-restro-button-hover transition active:scale-95"
              >
                {t("categories.close")}
              </button>
              <button
                onClick={btnAdd}
                className="flex-1 rounded-xl border border-restro-border-green px-4 py-2.5 text-sm font-semibold text-white bg-restro-green hover:bg-restro-green-button-hover transition active:scale-95"
              >
                {t("categories.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Category Mini Modal ── */}
      {editCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setEditCategory(null)}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl border border-restro-border-green p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-restro-text">{t("categories.update_category")}</h3>
              <button
                onClick={() => setEditCategory(null)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-restro-text hover:bg-restro-button-hover transition"
              >
                <IconX size={18} stroke={iconStroke} />
              </button>
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-gray-500 text-sm font-medium">
                {t("categories.category_title")}
              </label>
              <input
                ref={categoryTitleUpdateRef}
                type="text"
                autoFocus
                defaultValue={editCategory.title}
                onKeyDown={(e) => e.key === "Enter" && btnUpdate()}
                className="text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green"
                placeholder={t("categories.enter_category_title")}
              />
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-gray-500 text-sm font-medium">
                Kitchen Station
              </label>
              <select
                value={editStationId}
                onChange={(e) => setEditStationId(e.target.value)}
                className="text-sm w-full rounded-xl px-3 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green"
              >
                <option value="">Default (Master Kitchen)</option>
                {stations?.filter(s => s.is_enabled)?.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                Items in this category route to this station by default.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setEditCategory(null)}
                className="flex-1 rounded-xl border border-restro-border-green px-4 py-2.5 text-sm font-medium text-restro-text bg-restro-gray hover:bg-restro-button-hover transition active:scale-95"
              >
                {t("categories.close")}
              </button>
              <button
                onClick={btnUpdate}
                className="flex-1 rounded-xl border border-restro-border-green px-4 py-2.5 text-sm font-semibold text-white bg-restro-green hover:bg-restro-green-button-hover transition active:scale-95"
              >
                {t("categories.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      <DeleteModal
        isOpen={Boolean(deleteCategoryId)}
        onClose={() => setDeleteCategoryId(null)}
        onConfirm={async () => {
          const id = deleteCategoryId;
          setDeleteCategoryId(null);
          await btnDelete(id);
        }}
        title={t("categories.delete_category", "Delete Category")}
        description={t("categories.are_you_sure")}
      />
    </Page>
  );
}
