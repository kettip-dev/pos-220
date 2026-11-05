import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import {
  IconCarrot,
  IconCheck,
  IconEyeOff,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import Page from "../../components/Page";
import DeleteModal from "../../components/DeleteModal";
import { AddonSwitch } from "../../components/menu/ItemAddonsCard";
import { iconStroke } from "../../config/config";
import { useStoreSettings } from "../../controllers/settings.controller";
import { useInventoryItems } from "../../controllers/inventory.controller";
import {
  createLibraryAddon,
  deleteLibraryAddon,
  removeLibraryAddonIngredient,
  saveLibraryAddonIngredient,
  setLibraryAddonEnabled,
  updateLibraryAddon,
  useAddonLibrary,
} from "../../controllers/addon_library.controller";

const errMsg = (error, fallback) => error?.response?.data?.message || fallback;
const isOn = (v) => v === undefined || v === null || Number(v) === 1;

const fieldCls =
  "min-h-[42px] text-sm rounded-xl px-3.5 py-2 border border-restro-border-green bg-white dark:bg-black focus:outline-restro-border-green";
const inputCls = `${fieldCls} w-full`;

/**
 * Settings → Menu → Add-ons
 * One shared list of add-ons. Name, default price, on/off and ingredients are managed here once;
 * menu items just pick which add-ons they offer.
 */
export default function AddonsLibraryPage() {
  const { t } = useTranslation();
  const fail = (error) => toast.error(errMsg(error, t("addons.error_generic")));
  const { data: storeSettings } = useStoreSettings();
  const currency = storeSettings?.currency || "$";
  const formatPrice = (val) => `${currency}${Number(val || 0).toFixed(2)}`;
  const priceLabel = (val) => (Number(val) ? `+${formatPrice(val)}` : t("addons.free"));

  const { data, isLoading, mutate } = useAddonLibrary();
  const addons = Array.isArray(data) ? data : [];

  const [search, setSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [optimistic, setOptimistic] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? addons.filter((a) => a.title.toLowerCase().includes(q)) : addons;
  }, [addons, search]);

  const editing = addons.find((a) => a.id === editingId) || null;
  const enabledCount = addons.filter((a) => optimistic[a.id] ?? isOn(a.is_enabled)).length;

  const handleCreate = async () => {
    const title = newTitle.trim();
    const price = newPrice === "" ? 0 : Number(newPrice);
    if (!title) return toast.error(t("addons.type_name"));
    if (Number.isNaN(price) || price < 0) return toast.error(t("addons.invalid_price"));
    try {
      await createLibraryAddon(title, price);
      await mutate();
      setNewTitle("");
      setNewPrice("");
      toast.success(t("addons.created_named", { name: title }));
    } catch (error) {
      fail(error);
    }
  };

  const handleToggle = async (addon) => {
    const current = optimistic[addon.id] ?? isOn(addon.is_enabled);
    const next = !current;
    setOptimistic((s) => ({ ...s, [addon.id]: next }));
    try {
      await setLibraryAddonEnabled(addon.id, next);
      await mutate();
      toast.success(
        next
          ? t("addons.available_again_named", { name: addon.title })
          : t("addons.hidden_all_named", { name: addon.title })
      );
    } catch (error) {
      fail(error);
    } finally {
      setOptimistic((s) => {
        const { [addon.id]: _drop, ...rest } = s;
        return rest;
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteLibraryAddon(deleteTarget.id);
      await mutate();
      toast.success(t("addons.deleted_named", { name: deleteTarget.title }));
    } catch (error) {
      fail(error);
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <Page className="px-4 md:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <Link
            to="/dashboard/settings/menu-items"
            className="text-sm text-gray-500 hover:text-restro-green transition"
          >
            ← {t("menu_items.title", "Menu Items")}
          </Link>
          <h3 className="text-2xl font-bold text-restro-text">{t("addons.title")}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {addons.length
              ? t("addons.summary", { total: addons.length, available: enabledCount })
              : t("addons.page_empty_subtitle")}
          </p>
        </div>
      </div>

      <div className="max-w-4xl space-y-4">
        {/* Create */}
        <div className="flex flex-col sm:flex-row gap-2.5 p-3 rounded-2xl bg-restro-gray/50 border border-restro-border-green">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder={t("addons.new_name_placeholder")}
            className={clsx(inputCls, "flex-1")}
          />
          <div className="relative w-full sm:w-40">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
              +
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder={`0.00 ${currency}`}
              className={clsx(inputCls, "pl-7")}
            />
          </div>
          <button
            type="button"
            onClick={handleCreate}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition active:scale-95"
          >
            <IconPlus size={16} stroke={iconStroke} /> {t("addons.create")}
          </button>
        </div>

        {/* Search */}
        {addons.length > 6 && (
          <div className="relative">
            <IconSearch
              size={16}
              stroke={iconStroke}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("addons.search_placeholder")}
              className={clsx(inputCls, "pl-9")}
            />
          </div>
        )}

        {/* List */}
        <div className="rounded-2xl border border-restro-border-green bg-white dark:bg-[#252525] overflow-hidden">
          {isLoading ? (
            <p className="text-sm text-gray-400 text-center py-10">{t("addons.loading")}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">
              {addons.length ? t("addons.no_match") : t("addons.empty_list")}
            </p>
          ) : (
            <ul className="divide-y divide-restro-border-green">
              {filtered.map((addon) => {
                const on = optimistic[addon.id] ?? isOn(addon.is_enabled);
                const ingredients = addon.recipeItems?.length || 0;
                return (
                  <li
                    key={addon.id}
                    className={clsx(
                      "flex items-center gap-2 sm:gap-3 pl-2 pr-3 py-2 min-h-[64px]",
                      on ? "hover:bg-restro-gray/40" : "bg-gray-50 dark:bg-white/[0.02]"
                    )}
                  >
                    <AddonSwitch
                      checked={on}
                      onChange={() => handleToggle(addon)}
                      label={
                        on
                          ? t("addons.hide_all_named", { name: addon.title })
                          : t("addons.show_all_named", { name: addon.title })
                      }
                    />

                    <button
                      type="button"
                      onClick={() => setEditingId(addon.id)}
                      className="flex-1 min-w-0 text-left min-h-[42px]"
                    >
                      <p className={clsx("text-sm font-bold truncate", on ? "text-restro-text" : "text-gray-400")}>
                        {addon.title}
                      </p>
                      <p className="text-[11px] font-semibold text-gray-400 flex items-center gap-2 flex-wrap mt-0.5">
                        {!on && (
                          <span className="flex items-center gap-1">
                            <IconEyeOff size={12} stroke={iconStroke} /> {t("addons.hidden_all_items")} ·
                          </span>
                        )}
                        <span>
                          {addon.used_by_count
                            ? t("addons.used_on_count", { count: addon.used_by_count })
                            : t("addons.not_on_any_item")}
                        </span>
                        <span
                          className={clsx(
                            "flex items-center gap-0.5",
                            ingredients ? "text-orange-600 dark:text-orange-400" : ""
                          )}
                        >
                          <IconCarrot size={12} stroke={iconStroke} />
                          {ingredients ? t("addons.ingredients_count", { count: ingredients }) : t("addons.no_recipe")}
                        </span>
                      </p>
                    </button>

                    <span
                      className={clsx(
                        "px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums shrink-0",
                        !on
                          ? "bg-gray-100 dark:bg-white/5 text-gray-400"
                          : Number(addon.price)
                          ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {priceLabel(addon.price)}
                    </span>

                    <button
                      type="button"
                      title={t("addons.edit_addon")}
                      aria-label={t("addons.edit_named", { name: addon.title })}
                      onClick={() => setEditingId(addon.id)}
                      className="w-[42px] h-[42px] rounded-xl flex items-center justify-center transition active:scale-95 text-gray-500 hover:text-restro-text hover:bg-restro-button-hover shrink-0"
                    >
                      <IconPencil stroke={iconStroke} size={18} />
                    </button>
                    <button
                      type="button"
                      title={t("addons.delete_addon")}
                      aria-label={t("addons.delete_named", { name: addon.title })}
                      onClick={() => setDeleteTarget(addon)}
                      className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 transition active:scale-95 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                    >
                      <IconTrash stroke={iconStroke} size={18} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {editing && (
        <EditAddonPanel
          key={editing.id}
          addon={editing}
          currency={currency}
          priceLabel={priceLabel}
          onClose={() => setEditingId(null)}
          onChanged={mutate}
        />
      )}

      <DeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t("addons.delete_title")}
        itemName={deleteTarget?.title}
        description={
          deleteTarget?.used_by_count
            ? t("addons.delete_desc_used", { count: deleteTarget.used_by_count })
            : t("addons.delete_desc_unused")
        }
        warningMessage={t("addons.delete_warning")}
      />
    </Page>
  );
}

/** Edit name / default price, ingredients, and see which items use the add-on. */
function EditAddonPanel({ addon, currency, priceLabel, onClose, onChanged }) {
  const { t } = useTranslation();
  const fail = (error) => toast.error(errMsg(error, t("addons.error_generic")));
  const [title, setTitle] = useState(addon.title);
  const [price, setPrice] = useState(String(Number(addon.price || 0)));
  const [saving, setSaving] = useState(false);
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");

  const { data: inventoryData } = useInventoryItems({ status: "all" });
  const inventory = inventoryData?.items || [];
  const selectedIngredient = inventory.find((i) => String(i.id) === String(ingredientId));

  const dirty = title.trim() !== addon.title || Number(price || 0) !== Number(addon.price || 0);

  const saveDetails = async () => {
    const p = price === "" ? 0 : Number(price);
    if (!title.trim()) return toast.error(t("addons.name_empty"));
    if (Number.isNaN(p) || p < 0) return toast.error(t("addons.invalid_price"));
    setSaving(true);
    try {
      const res = await updateLibraryAddon(addon.id, title.trim(), p);
      await onChanged();
      toast.success(res.data?.message || t("addons.saved"));
    } catch (error) {
      fail(error);
    } finally {
      setSaving(false);
    }
  };

  const addIngredient = async () => {
    const qty = Number(quantity);
    if (!ingredientId) return toast.error(t("addons.choose_ingredient_error"));
    if (!qty || qty <= 0) return toast.error(t("addons.qty_error"));
    try {
      await saveLibraryAddonIngredient(addon.id, Number(ingredientId), qty);
      await onChanged();
      setIngredientId("");
      setQuantity("");
      toast.success(t("addons.ingredient_saved"));
    } catch (error) {
      fail(error);
    }
  };

  const removeIngredient = async (recipe) => {
    try {
      await removeLibraryAddonIngredient(addon.id, recipe.id);
      await onChanged();
      toast.success(t("addons.ingredient_removed_named", { name: recipe.ingredient_title }));
    } catch (error) {
      fail(error);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9990] flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-md bg-white dark:bg-[#1e1e1e] border-l border-restro-border-green shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-restro-border-green">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t("addons.edit_addon")}</p>
            <p className="text-lg font-bold text-restro-text truncate">{addon.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("addons.close")}
            className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-gray-500 hover:bg-restro-button-hover transition active:scale-95"
          >
            <IconX size={20} stroke={iconStroke} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Details */}
          <section className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500">{t("addons.name")}</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={clsx(inputCls, "mt-1")} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">{t("addons.default_price", { currency })}</label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                  +
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={clsx(inputCls, "pl-7")}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                {t("addons.default_price_hint")}
              </p>
            </div>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={saveDetails}
              className="min-h-[42px] w-full rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <IconCheck size={16} stroke={iconStroke} /> {t("addons.save_changes")}
            </button>
          </section>

          {/* Recipe */}
          <section>
            <p className="text-sm font-bold uppercase tracking-wider text-restro-text">{t("addons.ingredients")}</p>
            <p className="text-xs text-gray-400 mt-0.5 mb-3">
              {t("addons.ingredients_hint")}
            </p>

            {addon.recipeItems?.length > 0 && (
              <ul className="rounded-xl border border-restro-border-green divide-y divide-restro-border-green mb-3">
                {addon.recipeItems.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 pl-3 pr-1 min-h-[52px]">
                    <IconCarrot size={16} stroke={iconStroke} className="text-orange-500 shrink-0" />
                    <span className="flex-1 min-w-0 text-sm font-semibold text-restro-text truncate">
                      {r.ingredient_title || t("addons.deleted_ingredient")}
                    </span>
                    <span className="text-xs font-bold text-gray-500 tabular-nums">
                      {Number(r.quantity)} {r.unit}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeIngredient(r)}
                      aria-label={t("addons.remove_named", { name: r.ingredient_title })}
                      className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition active:scale-95"
                    >
                      <IconX size={16} stroke={iconStroke} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <select
                value={ingredientId}
                onChange={(e) => setIngredientId(e.target.value)}
                className={clsx(fieldCls, "flex-1 min-w-0")}
              >
                <option value="">{t("addons.choose_ingredient")}</option>
                {inventory.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title} ({i.unit})
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.001"
                min="0"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addIngredient()}
                placeholder={selectedIngredient?.unit || t("addons.qty")}
                className={clsx(fieldCls, "w-24 shrink-0")}
              />
              <button
                type="button"
                onClick={addIngredient}
                aria-label={t("addons.add_ingredient")}
                className="min-h-[42px] w-[42px] rounded-xl bg-orange-500 hover:bg-orange-400 text-white flex items-center justify-center shrink-0 transition active:scale-95"
              >
                <IconPlus size={18} stroke={iconStroke} />
              </button>
            </div>
          </section>

          {/* Used on */}
          <section>
            <p className="text-sm font-bold uppercase tracking-wider text-restro-text">{t("addons.used_on")}</p>
            <p className="text-xs text-gray-400 mt-0.5 mb-3">
              {t("addons.used_on_hint", { price: priceLabel(addon.price) })}
            </p>
            {addon.items?.length ? (
              <div className="flex flex-wrap gap-2">
                {addon.items.map((item) => (
                  <Link
                    key={item.id}
                    to={`/dashboard/settings/menu-items/${item.id}`}
                    className="min-h-[36px] px-3 rounded-xl border border-restro-border-green text-xs font-semibold text-restro-text hover:bg-restro-button-hover flex items-center"
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">{t("addons.not_on_any_item_yet")}</p>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
