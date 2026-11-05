import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import {
  IconCheck,
  IconEyeOff,
  IconPencil,
  IconPlus,
  IconSearch,
  IconSettings,
  IconX,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import DeleteModal from "../DeleteModal";
import {
  attachLibraryAddonToItem,
  createLibraryAddon,
  setItemAddonPrice,
  useAddonLibrary,
} from "../../controllers/addon_library.controller";
import {
  changeMenuItemAddonAvailability,
  deleteMenuItemAddon,
} from "../../controllers/menu_item.controller";

export const ADDON_LIBRARY_PATH = "/dashboard/settings/menu-items/addons";

const errMsg = (error, fallback) => error?.response?.data?.message || fallback;

const isOn = (v) => v === undefined || v === null || Number(v) === 1;

/** Small 44×24 switch inside a 42px touch target. */
export function AddonSwitch({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onChange}
      className="w-[56px] h-[42px] flex items-center justify-center shrink-0 rounded-xl active:scale-95 transition disabled:opacity-40 disabled:active:scale-100"
    >
      <span
        className={clsx(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
          checked ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"
        )}
      >
        <span
          className={clsx(
            "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}

/**
 * Menu item → Add-ons card.
 * Add-ons are picked from the shared add-on list (Settings → Add-ons); a new one can be created inline.
 * Per item you can switch an add-on off or give it a different price.
 */
export default function ItemAddonsCard({ itemId, addons = [], onChanged, formatPrice, currency }) {
  const { t } = useTranslation();
  const { data: library = [], mutate: mutateLibrary } = useAddonLibrary();
  const fail = (error) => toast.error(errMsg(error, t("addons.error_generic")));
  const priceText = (v) => (Number(v) ? `+${formatPrice(v)}` : t("addons.free"));

  const [query, setQuery] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [localEnabled, setLocalEnabled] = useState({}); // optimistic per-item switch
  const [priceEdit, setPriceEdit] = useState(null); // { addon, value }
  const [removeTarget, setRemoveTarget] = useState(null);

  const attachedLibraryIds = useMemo(
    () => new Set(addons.map((a) => a.library_addon_id).filter(Boolean)),
    [addons]
  );

  const q = query.trim().toLowerCase();
  const available = useMemo(
    () =>
      (Array.isArray(library) ? library : [])
        .filter((l) => !attachedLibraryIds.has(l.id))
        .filter((l) => !q || l.title.toLowerCase().includes(q)),
    [library, attachedLibraryIds, q]
  );
  const exactMatch = (Array.isArray(library) ? library : []).find(
    (l) => l.title.trim().toLowerCase() === q
  );

  const refresh = async () => {
    await Promise.all([onChanged?.(), mutateLibrary()]);
  };

  const attach = async (libraryAddon) => {
    if (busy) return;
    setBusy(true);
    try {
      await attachLibraryAddonToItem(itemId, libraryAddon.id);
      await refresh();
      setQuery("");
      setNewPrice("");
      toast.success(t("addons.added_named", { name: libraryAddon.title }));
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const createAndAttach = async () => {
    const title = query.trim();
    if (!title) {
      toast.error(t("addons.type_name_first"));
      return;
    }
    if (exactMatch) {
      if (attachedLibraryIds.has(exactMatch.id)) {
        toast(t("addons.already_on_named", { name: exactMatch.title }));
      } else {
        await attach(exactMatch);
      }
      return;
    }
    const price = newPrice === "" ? 0 : Number(newPrice);
    if (Number.isNaN(price) || price < 0) {
      toast.error(t("addons.invalid_price"));
      return;
    }
    setBusy(true);
    try {
      const res = await createLibraryAddon(title, price);
      await attachLibraryAddonToItem(itemId, res.data.id);
      await refresh();
      setQuery("");
      setNewPrice("");
      toast.success(t("addons.created_added_named", { name: title }));
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const toggleItem = async (addon) => {
    const current = localEnabled[addon.id] ?? isOn(addon.item_enabled ?? addon.is_enabled);
    const next = !current;
    setLocalEnabled((s) => ({ ...s, [addon.id]: next }));
    try {
      await changeMenuItemAddonAvailability(itemId, addon.id, next);
      await onChanged?.();
      setLocalEnabled((s) => {
        const { [addon.id]: _drop, ...rest } = s;
        return rest;
      });
      toast.success(
        next
          ? t("addons.item_available_named", { name: addon.title })
          : t("addons.item_hidden_named", { name: addon.title })
      );
    } catch (error) {
      setLocalEnabled((s) => ({ ...s, [addon.id]: current }));
      fail(error);
    }
  };

  const savePrice = async (reset = false) => {
    if (!priceEdit) return;
    const { addon, value } = priceEdit;
    let price = null;
    if (!reset) {
      price = value === "" ? 0 : Number(value);
      if (Number.isNaN(price) || price < 0) {
        toast.error(t("addons.invalid_price"));
        return;
      }
    }
    try {
      const res = await setItemAddonPrice(itemId, addon.id, price);
      await onChanged?.();
      setPriceEdit(null);
      toast.success(res.data?.message || t("addons.saved"));
    } catch (error) {
      fail(error);
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    try {
      await deleteMenuItemAddon(itemId, removeTarget.id);
      await refresh();
      toast.success(t("addons.removed_from_item_named", { name: removeTarget.title }));
    } catch (error) {
      fail(error);
    } finally {
      setRemoveTarget(null);
    }
  };

  const enabledCount = addons.filter(
    (a) => (localEnabled[a.id] ?? isOn(a.item_enabled ?? a.is_enabled)) && isOn(a.library_enabled)
  ).length;

  return (
    <div className="rounded-2xl border border-restro-border-green bg-white dark:bg-[#252525] p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wider text-restro-text">{t("addons.title")}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {addons.length
              ? t("addons.item_subtitle_count", { available: enabledCount, total: addons.length })
              : t("addons.item_subtitle_empty")}
          </p>
        </div>
        <Link
          to={ADDON_LIBRARY_PATH}
          className="min-h-[42px] px-3 rounded-xl border border-restro-border-green text-xs font-bold text-restro-text hover:bg-restro-button-hover flex items-center gap-1.5 shrink-0 transition active:scale-95"
        >
          <IconSettings size={16} stroke={iconStroke} /> {t("addons.manage_list")}
        </Link>
      </div>

      {/* Picker: search shared list, or create a new add-on */}
      <div className="mb-4 p-3 rounded-xl bg-restro-gray/50 border border-restro-border-green">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <IconSearch
              size={16}
              stroke={iconStroke}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createAndAttach()}
              placeholder={t("addons.picker_placeholder")}
              className="min-h-[42px] w-full text-sm rounded-xl pl-9 pr-3.5 py-2 border border-restro-border-green bg-white dark:bg-black focus:outline-restro-border-green"
            />
          </div>
          {q && !exactMatch && (
            <div className="relative w-full sm:w-36">
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
                onKeyDown={(e) => e.key === "Enter" && createAndAttach()}
                placeholder={`0.00 ${currency || ""}`.trim()}
                className="min-h-[42px] w-full text-sm rounded-xl pl-7 pr-3.5 py-2 border border-restro-border-green bg-white dark:bg-black focus:outline-restro-border-green"
              />
            </div>
          )}
          {q && (
            <button
              type="button"
              disabled={busy}
              onClick={createAndAttach}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition active:scale-95"
            >
              <IconPlus size={16} stroke={iconStroke} />
              {exactMatch
                ? t("addons.add_named", { name: exactMatch.title })
                : t("addons.create_named", { name: query.trim() })}
            </button>
          )}
        </div>

        {available.length > 0 ? (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
              {t("addons.tap_to_add")}
            </p>
            <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto">
              {available.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  disabled={busy}
                  onClick={() => attach(l)}
                  className={clsx(
                    "min-h-[42px] pl-3 pr-2 rounded-xl border text-sm font-semibold flex items-center gap-2 transition active:scale-95",
                    isOn(l.is_enabled)
                      ? "border-restro-border-green bg-white dark:bg-black text-restro-text hover:border-purple-400"
                      : "border-dashed border-gray-300 dark:border-gray-700 bg-transparent text-gray-400"
                  )}
                  title={isOn(l.is_enabled) ? t("addons.add_to_item") : t("addons.off_in_list")}
                >
                  <IconPlus size={14} stroke={iconStroke} className="text-purple-500" />
                  {l.title}
                  <span className="px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-restro-gray text-gray-500 tabular-nums">
                    {priceText(l.price)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          q === "" &&
          library.length > 0 && (
            <p className="mt-3 text-xs text-gray-400">
              {t("addons.all_added")}
            </p>
          )
        )}
      </div>

      {/* Selected add-ons */}
      {addons.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          {t("addons.item_empty")}
        </p>
      ) : (
        <ul className="rounded-xl border border-restro-border-green divide-y divide-restro-border-green overflow-hidden">
          {addons.map((addon) => {
            const itemOn = localEnabled[addon.id] ?? isOn(addon.item_enabled ?? addon.is_enabled);
            const libOn = isOn(addon.library_enabled);
            const live = itemOn && libOn;
            const custom = Number(addon.has_custom_price) === 1;
            const isFree = !Number(addon.price);
            return (
              <li
                key={addon.id}
                className={clsx(
                  "flex items-center gap-2 sm:gap-3 pl-1 pr-2 py-2 min-h-[60px] transition",
                  live ? "hover:bg-restro-gray/40" : "bg-gray-50 dark:bg-white/[0.02]"
                )}
              >
                <AddonSwitch
                  checked={itemOn}
                  disabled={!libOn}
                  onChange={() => toggleItem(addon)}
                  label={
                    !libOn
                      ? t("addons.off_all_label")
                      : itemOn
                      ? t("addons.hide_item_named", { name: addon.title })
                      : t("addons.show_item_named", { name: addon.title })
                  }
                />

                <div className="flex-1 min-w-0">
                  <p className={clsx("text-sm font-bold truncate", live ? "text-restro-text" : "text-gray-400")}>
                    {addon.title}
                  </p>
                  {!libOn ? (
                    <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                      <IconEyeOff size={12} stroke={iconStroke} />
                      {t("addons.off_all_items")} ·{" "}
                      <Link to={ADDON_LIBRARY_PATH} className="underline">
                        {t("addons.change_in_list")}
                      </Link>
                    </p>
                  ) : !itemOn ? (
                    <p className="text-[11px] font-semibold text-gray-400 flex items-center gap-1 mt-0.5">
                      <IconEyeOff size={12} stroke={iconStroke} />
                      {t("addons.hidden_this_item")}
                    </p>
                  ) : custom ? (
                    <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
                      {t("addons.custom_price_default", { price: priceText(addon.library_price) })}
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => setPriceEdit({ addon, value: String(Number(addon.price || 0)) })}
                  title={t("addons.change_price_title")}
                  className={clsx(
                    "min-h-[42px] px-2.5 rounded-xl text-xs font-bold tabular-nums shrink-0 flex items-center gap-1 transition active:scale-95",
                    !live
                      ? "bg-gray-100 dark:bg-white/5 text-gray-400"
                      : isFree
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-purple-500/10 text-purple-600 dark:text-purple-400",
                    custom && "ring-1 ring-inset ring-amber-400"
                  )}
                >
                  {priceText(addon.price)}
                  <IconPencil size={13} stroke={iconStroke} className="opacity-60" />
                </button>

                <button
                  type="button"
                  title={t("addons.remove_from_item")}
                  aria-label={t("addons.remove_from_item_named", { name: addon.title })}
                  onClick={() => setRemoveTarget(addon)}
                  className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 transition active:scale-95 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                >
                  <IconX stroke={iconStroke} size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Price for this item */}
      {priceEdit && createPortal(
        <div
          className="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={() => setPriceEdit(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#252525] border border-restro-border-green p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-bold text-restro-text">{priceEdit.addon.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {t("addons.price_modal_hint", { price: priceText(priceEdit.addon.library_price) })}
            </p>
            <div className="relative mt-4">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                +
              </span>
              <input
                autoFocus
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={priceEdit.value}
                onChange={(e) => setPriceEdit((p) => ({ ...p, value: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && savePrice(false)}
                className="min-h-[42px] w-full text-sm rounded-xl pl-7 pr-12 py-2 border border-restro-border-green bg-white dark:bg-black focus:outline-restro-border-green"
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                {currency}
              </span>
            </div>
            <div className="flex gap-2 mt-4">
              {Number(priceEdit.addon.has_custom_price) === 1 && (
                <button
                  type="button"
                  onClick={() => savePrice(true)}
                  className="min-h-[42px] flex-1 rounded-xl border border-restro-border-green text-xs font-bold text-restro-text hover:bg-restro-button-hover transition active:scale-95"
                >
                  {t("addons.use_default")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setPriceEdit(null)}
                className="min-h-[42px] flex-1 rounded-xl border border-restro-border-green text-xs font-bold text-gray-500 hover:bg-restro-button-hover transition active:scale-95"
              >
                {t("addons.cancel")}
              </button>
              <button
                type="button"
                onClick={() => savePrice(false)}
                className="min-h-[42px] flex-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <IconCheck size={16} stroke={iconStroke} /> {t("addons.save")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <DeleteModal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={confirmRemove}
        title={t("addons.remove_title")}
        description={t("addons.remove_desc")}
        itemName={removeTarget?.title}
        confirmText={t("addons.remove_confirm")}
      />
    </div>
  );
}
