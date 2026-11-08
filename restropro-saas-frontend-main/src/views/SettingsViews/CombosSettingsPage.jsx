import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import clsx from "clsx";
import useSWR from "swr";
import { useTranslation } from "react-i18next";
import { IconPlus, IconTrash, IconPencil, IconX, IconSearch, IconStack2 } from "@tabler/icons-react";
import Page from "../../components/Page";
import { iconStroke } from "../../config/config";
import { useStoreSettings, useCategories } from "../../controllers/settings.controller";
import { useMenuItems } from "../../controllers/menu_item.controller";
import { getCombos, saveCombo, deleteCombo } from "../../controllers/pos.controller";
import { CURRENCIES } from "../../config/currencies.config";

const fieldCls =
  "min-h-[42px] text-sm rounded-xl px-3.5 py-2 border border-restro-border-green bg-white dark:bg-black focus:outline-restro-border-green";

const emptyGroup = (n) => ({ key: `${Date.now()}-${n}`, title: "", minSelect: 1, maxSelect: 1, options: [] });

/**
 * Settings → Menu → Combos
 * A combo is sold at one price; each choice group lets the guest pick items
 * ("Pick 1 drink"), optionally with an extra charge.
 */
export default function CombosSettingsPage() {
  const { t } = useTranslation();
  const { data: storeSettings } = useStoreSettings();
  const currency = CURRENCIES.find((c) => c.cc === storeSettings?.currency)?.symbol || storeSettings?.currency || "$";
  const { data: categoriesData } = useCategories();
  const categories = Array.isArray(categoriesData) ? categoriesData : [];
  const { data: menuData } = useMenuItems();
  const menuItems = (Array.isArray(menuData) ? menuData : []).filter((m) => Number(m.is_combo) !== 1);

  const { data: combosRes, mutate, isLoading } = useSWR("/pos/combos", () => getCombos().then((r) => r.data));
  const combos = Array.isArray(combosRes) ? combosRes : [];

  const [editing, setEditing] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const openNew = () =>
    setEditing({ id: null, title: "", price: "", categoryId: "", isEnabled: true, groups: [emptyGroup(1)] });

  const openEdit = (combo) =>
    setEditing({
      id: combo.id,
      title: combo.title,
      price: String(combo.price ?? ""),
      categoryId: combo.category_id || "",
      isEnabled: Number(combo.is_enabled) === 1,
      groups: (combo.groups || []).map((g) => ({
        key: `g-${g.id}`,
        title: g.title,
        minSelect: g.min_select,
        maxSelect: g.max_select,
        options: (g.options || []).map((o) => ({ menuItemId: o.menu_item_id, title: o.title, extraPrice: String(o.extra_price ?? "0") })),
      })),
    });

  const handleSave = async () => {
    if (!editing) return;
    try {
      setIsSaving(true);
      await saveCombo(editing.id, {
        title: editing.title,
        price: Number(editing.price),
        categoryId: editing.categoryId || null,
        isEnabled: editing.isEnabled,
        groups: editing.groups.map((g) => ({
          title: g.title,
          minSelect: Number(g.minSelect),
          maxSelect: Number(g.maxSelect),
          options: g.options.map((o) => ({ menuItemId: o.menuItemId, extraPrice: Number(o.extraPrice) || 0 })),
        })),
      });
      toast.success(t("combos.saved", "Combo saved"));
      setEditing(null);
      mutate();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("combos.save_failed", "Could not save the combo"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (combo) => {
    if (!window.confirm(t("combos.confirm_delete", 'Delete "{{name}}"?', { name: combo.title }))) return;
    try {
      await deleteCombo(combo.id);
      toast.success(t("combos.deleted", "Combo deleted"));
      mutate();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("combos.save_failed", "Could not save the combo"));
    }
  };

  return (
    <Page className="px-4 sm:px-8 py-6">
      <div className="mb-5">
        <Link to="/dashboard/settings/menu-items" className="text-sm text-gray-500 hover:text-restro-green transition">
          ← {t("menu_items.title", "Menu Items")}
        </Link>
        <div className="flex items-center justify-between gap-3 mt-1">
          <div>
            <h3 className="text-2xl font-bold text-restro-text">{t("combos.title", "Combos & set meals")}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {t("combos.subtitle", "One price, with choices like “pick 1 drink”. Combos appear on the POS in their category.")}
            </p>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="min-h-[42px] px-4 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white text-sm font-bold flex items-center gap-1.5 active:scale-95 transition shrink-0"
          >
            <IconPlus size={16} stroke={iconStroke} /> {t("combos.new", "New combo")}
          </button>
        </div>
      </div>

      <div className="max-w-4xl rounded-2xl border border-restro-border-green bg-white dark:bg-[#252525] overflow-hidden">
        {isLoading ? (
          <p className="text-sm text-gray-400 text-center py-10">{t("common.loading", "Loading...")}</p>
        ) : combos.length === 0 ? (
          <div className="text-center py-12 px-4">
            <IconStack2 size={32} className="mx-auto text-gray-300" />
            <p className="text-sm text-gray-500 mt-2">{t("combos.empty", "No combos yet. Create one to sell set meals at a single price.")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-restro-border-green">
            {combos.map((combo) => (
              <li key={combo.id} className="flex items-center gap-3 px-4 py-3 min-h-[64px]">
                <div className="flex-1 min-w-0">
                  <p className={clsx("font-bold text-sm truncate", Number(combo.is_enabled) !== 1 && "text-gray-400 line-through")}>{combo.title}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {currency}
                    {Number(combo.price).toFixed(2)} · {(combo.groups || []).map((g) => g.title).join(" + ") || t("combos.no_groups", "No choices")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(combo)}
                  aria-label={t("common.edit", "Edit")}
                  className="min-h-[42px] min-w-[42px] rounded-xl border border-restro-border-green flex items-center justify-center hover:bg-restro-gray active:scale-95"
                >
                  <IconPencil size={16} stroke={iconStroke} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(combo)}
                  aria-label={t("common.delete", "Delete")}
                  className="min-h-[42px] min-w-[42px] rounded-xl border border-red-200 text-red-500 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/40 active:scale-95"
                >
                  <IconTrash size={16} stroke={iconStroke} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <ComboEditor
          value={editing}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          isSaving={isSaving}
          categories={categories}
          menuItems={menuItems}
          currency={currency}
        />
      )}
    </Page>
  );
}

function ComboEditor({ value, onChange, onClose, onSave, isSaving, categories, menuItems, currency }) {
  const { t } = useTranslation();
  const [pickerFor, setPickerFor] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => setQuery(""), [pickerFor]);

  const set = (patch) => onChange({ ...value, ...patch });
  const setGroup = (idx, patch) => set({ groups: value.groups.map((g, i) => (i === idx ? { ...g, ...patch } : g)) });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const group = pickerFor !== null ? value.groups[pickerFor] : null;
    const taken = new Set((group?.options || []).map((o) => o.menuItemId));
    return menuItems
      .filter((m) => !taken.has(m.id))
      .filter((m) => !q || String(m.title).toLowerCase().includes(q))
      .slice(0, 40);
  }, [menuItems, query, pickerFor, value.groups]);

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs" />
      <aside
        role="dialog"
        aria-modal="true"
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[560px] bg-background text-foreground border-l border-restro-border-green shadow-2xl flex flex-col overflow-hidden"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-restro-border-green/80 shrink-0">
          <h3 className="text-lg font-black">{value.id ? t("combos.edit", "Edit combo") : t("combos.new", "New combo")}</h3>
          <button type="button" onClick={onClose} aria-label={t("common.close", "Close")} className="min-h-[42px] min-w-[42px] rounded-xl flex items-center justify-center hover:bg-restro-gray">
            <IconX size={20} stroke={iconStroke} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <label className="sm:col-span-2 flex flex-col gap-1 text-xs font-bold text-gray-500">
              {t("combos.name", "Name")}
              <input value={value.title} onChange={(e) => set({ title: e.target.value })} className={fieldCls} placeholder={t("combos.name_ph", "e.g. Lunch set")} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
              {t("combos.price", "Price")} ({currency})
              <input type="number" min="0" step="0.01" inputMode="decimal" value={value.price} onChange={(e) => set({ price: e.target.value })} className={fieldCls} />
            </label>
            <label className="sm:col-span-2 flex flex-col gap-1 text-xs font-bold text-gray-500">
              {t("combos.category", "Category on the POS")}
              <select value={value.categoryId || ""} onChange={(e) => set({ categoryId: e.target.value ? Number(e.target.value) : "" })} className={fieldCls}>
                <option value="">{t("combos.no_category", "No category")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold mt-5 min-h-[42px] cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-restro-green" checked={value.isEnabled} onChange={(e) => set({ isEnabled: e.target.checked })} />
              {t("combos.on_sale", "On sale")}
            </label>
          </div>

          {value.groups.map((g, gi) => (
            <section key={g.key} className="rounded-2xl border border-restro-border-green p-3 flex flex-col gap-2.5">
              <div className="flex items-end gap-2">
                <label className="flex-1 flex flex-col gap-1 text-xs font-bold text-gray-500">
                  {t("combos.group_name", "Choice")}
                  <input value={g.title} onChange={(e) => setGroup(gi, { title: e.target.value })} className={fieldCls} placeholder={t("combos.group_ph", "e.g. Drink")} />
                </label>
                <label className="w-16 flex flex-col gap-1 text-xs font-bold text-gray-500">
                  {t("combos.min", "Min")}
                  <input type="number" min="0" value={g.minSelect} onChange={(e) => setGroup(gi, { minSelect: e.target.value })} className={fieldCls} />
                </label>
                <label className="w-16 flex flex-col gap-1 text-xs font-bold text-gray-500">
                  {t("combos.max", "Max")}
                  <input type="number" min="1" value={g.maxSelect} onChange={(e) => setGroup(gi, { maxSelect: e.target.value })} className={fieldCls} />
                </label>
                <button
                  type="button"
                  onClick={() => set({ groups: value.groups.filter((_, i) => i !== gi) })}
                  aria-label={t("common.delete", "Delete")}
                  className="min-h-[42px] min-w-[42px] rounded-xl border border-red-200 text-red-500 flex items-center justify-center"
                >
                  <IconTrash size={16} />
                </button>
              </div>

              <ul className="flex flex-col gap-1.5">
                {g.options.map((o, oi) => (
                  <li key={o.menuItemId} className="flex items-center gap-2">
                    <span className="flex-1 text-sm font-semibold truncate">{o.title || menuItems.find((m) => m.id === o.menuItemId)?.title}</span>
                    <span className="text-xs text-gray-500">+{currency}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={o.extraPrice}
                      onChange={(e) => setGroup(gi, { options: g.options.map((x, i) => (i === oi ? { ...x, extraPrice: e.target.value } : x)) })}
                      className={clsx(fieldCls, "w-24")}
                      aria-label={t("combos.extra_price", "Extra charge")}
                    />
                    <button
                      type="button"
                      onClick={() => setGroup(gi, { options: g.options.filter((_, i) => i !== oi) })}
                      aria-label={t("common.delete", "Delete")}
                      className="min-h-[42px] min-w-[42px] rounded-xl text-gray-400 hover:text-red-500 flex items-center justify-center"
                    >
                      <IconX size={16} />
                    </button>
                  </li>
                ))}
              </ul>

              {pickerFor === gi ? (
                <div className="rounded-xl border border-restro-border-green p-2 flex flex-col gap-1.5">
                  <div className="relative">
                    <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} className={clsx(fieldCls, "w-full pl-9")} placeholder={t("combos.search_items", "Search menu items")} />
                  </div>
                  <div className="max-h-56 overflow-y-auto flex flex-col">
                    {results.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setGroup(gi, { options: [...g.options, { menuItemId: m.id, title: m.title, extraPrice: "0" }] })}
                        className="min-h-[42px] px-2 rounded-lg text-left text-sm hover:bg-restro-gray flex items-center justify-between"
                      >
                        <span className="truncate">{m.title}</span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {currency}
                          {Number(m.price).toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setPickerFor(null)} className="min-h-[42px] rounded-xl text-sm font-bold border border-restro-border-green">
                    {t("common.done", "Done")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerFor(gi)}
                  className="min-h-[42px] rounded-xl border-2 border-dashed border-restro-border-green text-sm font-bold text-gray-600 dark:text-gray-300 flex items-center justify-center gap-1.5"
                >
                  <IconPlus size={16} /> {t("combos.add_items", "Add items")}
                </button>
              )}
            </section>
          ))}

          <button
            type="button"
            onClick={() => set({ groups: [...value.groups, emptyGroup(value.groups.length + 1)] })}
            className="min-h-[42px] rounded-xl border border-restro-border-green text-sm font-bold flex items-center justify-center gap-1.5"
          >
            <IconPlus size={16} /> {t("combos.add_group", "Add a choice")}
          </button>
        </div>

        <footer className="px-5 py-3 border-t border-restro-border-green/80 shrink-0">
          <button
            type="button"
            disabled={isSaving}
            onClick={onSave}
            className="w-full min-h-[48px] rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white font-black text-sm active:scale-95 transition disabled:opacity-60"
          >
            {isSaving ? t("common.saving", "Saving...") : t("common.save", "Save")}
          </button>
        </footer>
      </aside>
    </>
  );
}
