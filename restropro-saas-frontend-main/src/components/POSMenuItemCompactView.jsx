import React, { useRef, useEffect } from 'react';
import { getImageURL } from '../helpers/ImageHelper';
import {
  IconAlertTriangleFilled,
  IconToolsKitchen2,
  IconChefHat,
  IconCoffee,
  IconSoup,
  IconPlus,
  IconMinus,
  IconSearch,
  IconStack2,
  IconAdjustmentsHorizontal,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

// Smart POS price formatter: adds thousands commas and strips unnecessary .00 for KHR (៛) or whole numbers
export const formatPOSPrice = (price, currency = '') => {
  const num = Number(price);
  if (isNaN(num)) return `${currency}0`;
  const isKHR = currency === '៛' || String(currency).toUpperCase().includes('KHR');
  const isWhole = Number.isInteger(num) || Math.abs(num - Math.round(num)) < 0.001;

  if (isKHR || isWhole) {
    return `${currency}${Math.round(num).toLocaleString('en-US')}`;
  }
  return `${currency}${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const getCategoryFallbackIcon = (categoryTitle = '', title = '') => {
  const text = `${categoryTitle} ${title}`.toLowerCase();
  if (
    text.includes('drink') ||
    text.includes('coffee') ||
    text.includes('tea') ||
    text.includes('latte') ||
    text.includes('americano') ||
    text.includes('ភេសជ្ជៈ') ||
    text.includes('កាហ្វេ') ||
    text.includes('តែ')
  ) {
    return IconCoffee;
  }
  if (
    text.includes('soup') ||
    text.includes('noodle') ||
    text.includes('គុយទាវ') ||
    text.includes('មី') ||
    text.includes('ស៊ុប')
  ) {
    return IconSoup;
  }
  if (text.includes('បាយ')) {
    return IconChefHat;
  }
  return IconToolsKitchen2;
};

const POSMenuItemCompactView = ({
  menuItems,
  selectedCategory,
  categories,
  searchQuery,
  currency,
  btnOpenVariantAndAddonModal,
  addItemToCart,
  onMinusItem = null,
  cartItems = [],
  isReadOnly = false,
  hoveredItemId = null,
  onItemHover = null,
  onScroll = null,
  scrollTopRatio = null,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef(null);

  useEffect(() => {
    if (isReadOnly && containerRef.current && typeof scrollTopRatio === 'number') {
      const { scrollHeight, clientHeight } = containerRef.current;
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll > 0) {
        containerRef.current.scrollTop = scrollTopRatio * maxScroll;
      }
    }
  }, [scrollTopRatio, isReadOnly]);

  const filteredMenuItems = menuItems
    .filter((menuItem) => menuItem.is_enabled)
    .filter((menuItem) => {
      if (selectedCategory === "all") {
        return !menuItem.category_id || categories.find((category) => category.id === menuItem.category_id && category.is_enabled);
      }
      return selectedCategory === menuItem.category_id;
    })
    .filter((menuItem) => {
      if (!searchQuery) {
        return true;
      }
      return menuItem.title.trim().toLowerCase().includes(searchQuery.trim().toLowerCase());
    });

  return (
    <div className="w-full h-full overflow-hidden">
      {filteredMenuItems.length === 0 ? (
        <div className="flex flex-col justify-center items-center w-full h-full rounded-xl py-12 text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3 shadow-xs">
            <IconSearch size={30} stroke={1.75} />
          </div>
          <p className="text-base text-gray-800 dark:text-white font-bold">{t("pos_menu.not_found_title")}</p>
          <p className="text-gray-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">{t("pos_menu.not_found_message")}</p>
          <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">{t("pos_menu.not_found_carrot")}</p>
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={onScroll}
          className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 auto-rows-max gap-3 sm:gap-3.5 w-full z-0 px-3.5 sm:px-4 pt-1.5 pb-6 rounded-b-xl overflow-y-auto h-full content-start"
        >
          {filteredMenuItems.map((menuItem, i) => {
            const { title, id, price, image, category_title, addons, variants } = menuItem;

            const imageURL = image ? getImageURL(image) : null;
            const hasVariantOrAddon = variants?.length > 0 || addons?.length > 0;
            const isHovered = String(hoveredItemId) === String(id);

            const inCartCount =
              cartItems?.reduce((acc, c) => (c.id === id ? acc + (Number(c.quantity) || 1) : acc), 0) || 0;

            const showBottomStepper = !isReadOnly && inCartCount > 0 && !hasVariantOrAddon && Boolean(onMinusItem);
            // Only show top-right quantity pill when bottom stepper isn't already showing the count
            const showTopRightBadge = inCartCount > 0 && (!showBottomStepper || isReadOnly);

            const baseRecipeItems = menuItem.recipeItems?.filter(
              (r) => r.variant_id === 0 && r.addon_id === 0
            );

            const isLowStock = baseRecipeItems?.some(
              (r) => parseFloat(r.current_quantity) <= parseFloat(r.min_quantity_threshold)
            );

            const quantitiesPossible = baseRecipeItems?.map((r) => {
              const currentQty = parseFloat(r.current_quantity || "0");
              const requiredQty = parseFloat(r.recipe_quantity || "1");
              return Math.floor(currentQty / requiredQty);
            });

            const minItemsCanBeMade =
              quantitiesPossible?.length > 0 ? Math.min(...quantitiesPossible) : null;

            const FallbackIcon = getCategoryFallbackIcon(category_title, title);

            const isOutOfStock = isLowStock && minItemsCanBeMade !== null && minItemsCanBeMade <= 0;

            const triggerPrimaryAction = () => {
              if (isReadOnly) return;
              if (hasVariantOrAddon) {
                btnOpenVariantAndAddonModal(id);
              } else {
                addItemToCart(menuItem);
              }
            };

            return (
              <div
                key={id || i}
                onMouseEnter={() => onItemHover && onItemHover(id)}
                onMouseLeave={() => onItemHover && onItemHover(null)}
                onClick={triggerPrimaryAction}
                className={`group relative flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-150 select-none ${
                  inCartCount > 0
                    ? 'border-[#2CA01C] ring-2 ring-[#2CA01C]/70 shadow-[0_6px_18px_-8px_rgba(44,160,28,0.55)]'
                    : isHovered
                    ? 'border-[#0D233A] ring-2 ring-[#0D233A]/40 shadow-lg -translate-y-0.5 z-10'
                    : 'border-slate-200/90 dark:border-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.06)] hover:shadow-[0_10px_24px_-12px_rgba(15,23,42,0.35)] hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700'
                } ${!isReadOnly ? 'cursor-pointer active:scale-[0.98] active:translate-y-0' : ''}`}
              >
                {/* Image */}
                <div className="relative w-full h-28 sm:h-32 flex-shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-800/70">
                  {image ? (
                    <img
                      src={imageURL}
                      alt={title}
                      className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                        isOutOfStock ? 'grayscale opacity-70' : ''
                      }`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-[#E6EEF0] dark:from-slate-800/90 dark:via-slate-800/70 dark:to-slate-900">
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center text-[#008489] dark:text-emerald-400">
                        <FallbackIcon size={24} stroke={1.75} />
                      </div>
                    </div>
                  )}

                  {/* Soft top scrim keeps overlay chips legible on bright photos */}
                  {image && (isLowStock || showTopRightBadge) && (
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/35 to-transparent" />
                  )}

                  {/* Low stock chip (top-left) */}
                  {!isReadOnly && isLowStock && (
                    <div
                      className={`absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-bold text-white shadow-sm ${
                        isOutOfStock ? 'bg-red-600' : 'bg-amber-500'
                      }`}
                    >
                      <IconAlertTriangleFilled size={11} />
                      <span>
                        {t('inventory.low_stock', 'Low Stock')}
                        {minItemsCanBeMade !== null ? ` · ${minItemsCanBeMade}` : ''}
                      </span>
                    </div>
                  )}

                  {/* In-cart quantity badge (top-right) */}
                  {showTopRightBadge && (
                    <div className="absolute top-2 right-2 z-20 min-w-[26px] h-[26px] px-1.5 rounded-full bg-[#2CA01C] text-white text-xs font-extrabold tabular-nums flex items-center justify-center shadow-md ring-2 ring-white dark:ring-slate-900">
                      {inCartCount}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div
                  className={`flex flex-col flex-1 min-h-0 px-3 pt-2.5 pb-3 ${
                    inCartCount > 0 ? 'bg-[#2CA01C]/[0.04] dark:bg-emerald-950/20' : ''
                  }`}
                >
                  {/* Category eyebrow — only useful when browsing "All" */}
                  {!isReadOnly && selectedCategory === "all" && category_title && (
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate mb-0.5">
                      {category_title}
                    </p>
                  )}

                  <p
                    title={title}
                    className="line-clamp-2 min-h-[2.5rem] text-[13px] sm:text-sm font-semibold text-slate-800 dark:text-slate-100 leading-5"
                  >
                    {title}
                  </p>

                  {/* Options summary */}
                  <div className="h-4 mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 min-w-0">
                    {hasVariantOrAddon && (
                      <>
                        {variants?.length > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[#008489] dark:text-emerald-400 shrink-0">
                            <IconStack2 size={12} stroke={2.2} />
                            {variants.length} {t("pos_menu.variants", "Variants")}
                          </span>
                        )}
                        {variants?.length > 0 && addons?.length > 0 && (
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                        )}
                        {addons?.length > 0 && (
                          <span className="truncate">
                            +{addons.length} {t("pos_menu.addons", "Addons")}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Price & action */}
                  <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                    <span className="text-base sm:text-[17px] font-bold tracking-tight tabular-nums text-slate-900 dark:text-white truncate">
                      {formatPOSPrice(price, currency)}
                    </span>

                    {!isReadOnly && (
                      showBottomStepper ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center h-[42px] rounded-xl bg-[#2CA01C] text-white shadow-sm shrink-0 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMinusItem(id);
                            }}
                            aria-label="Decrease quantity"
                            className="w-[38px] h-full flex items-center justify-center hover:bg-black/10 active:bg-black/20 transition touch-manipulation cursor-pointer"
                          >
                            <IconMinus size={18} stroke={2.6} />
                          </button>
                          <span className="min-w-[22px] text-center text-sm font-extrabold tabular-nums">
                            {inCartCount}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addItemToCart(menuItem);
                            }}
                            aria-label="Increase quantity"
                            className="w-[38px] h-full flex items-center justify-center hover:bg-black/10 active:bg-black/20 transition touch-manipulation cursor-pointer"
                          >
                            <IconPlus size={18} stroke={2.6} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerPrimaryAction();
                          }}
                          aria-label={hasVariantOrAddon ? t("pos_menu.customize", "Customize") : t("pos_menu.add", "Add")}
                          title={hasVariantOrAddon ? t("pos_menu.customize", "Customize") : t("pos_menu.add", "Add")}
                          className={`w-[42px] h-[42px] rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-all duration-150 active:scale-95 touch-manipulation cursor-pointer ${
                            inCartCount > 0
                              ? 'bg-[#2CA01C] text-white hover:bg-[#258A17]'
                              : hasVariantOrAddon
                              ? 'bg-white dark:bg-slate-800 text-[#008489] dark:text-emerald-400 border border-[#008489]/40 dark:border-emerald-500/40 hover:bg-[#008489] hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white'
                              : 'bg-[#0D233A] dark:bg-slate-700 text-white hover:bg-[#008489] dark:hover:bg-emerald-600'
                          }`}
                        >
                          {hasVariantOrAddon ? (
                            <IconAdjustmentsHorizontal size={20} stroke={2.2} />
                          ) : (
                            <IconPlus size={22} stroke={2.6} />
                          )}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default POSMenuItemCompactView;
