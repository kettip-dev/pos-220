import React, { useRef, useEffect } from 'react';
import { useMenuLanguage, displayParts, displayCategoryName, matchesMenuSearch } from "../helpers/MenuLanguageHelper";
import { getImageURL } from '../helpers/ImageHelper';
import {
  IconAlertTriangleFilled,
  IconToolsKitchen2,
  IconChefHat,
  IconCoffee,
  IconSoup,
  IconMinus,
  IconSearch,
  IconAdjustmentsHorizontal,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import useLongPress from '../helpers/useLongPress';

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
  onItemLongPress = null,
  onScroll = null,
  scrollTopRatio = null,
}) => {
  const { t } = useTranslation();
  useMenuLanguage();
  const bindLongPress = useLongPress(isReadOnly ? null : onItemLongPress);
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
      return matchesMenuSearch(menuItem, searchQuery);
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
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 auto-rows-max gap-2 sm:gap-3 w-full z-0 px-2 sm:px-4 pt-1 sm:pt-1.5 pb-24 md:pb-6 rounded-b-xl overflow-y-auto h-full content-start"
        >
          {filteredMenuItems.map((menuItem, i) => {
            const { id, price, image, addons, variants } = menuItem;
            const { primary: title, secondary: secondaryTitle } = displayParts(menuItem);
            const category_title = displayCategoryName(menuItem);

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
            const isSoldOut86 = Number(menuItem.is_sold_out) === 1;
            const portionsLeft = menuItem.stock_limit === null || menuItem.stock_limit === undefined ? null : Number(menuItem.stock_limit);

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
                role={!isReadOnly ? 'button' : undefined}
                aria-label={title}
                onMouseEnter={() => onItemHover && onItemHover(id)}
                onMouseLeave={() => onItemHover && onItemHover(null)}
                {...bindLongPress(id)}
                onClick={triggerPrimaryAction}
                className={`group relative aspect-[4/5] sm:aspect-[5/4] overflow-hidden rounded-xl bg-[#0D233A] select-none transition-all duration-150 ${
                  inCartCount > 0
                    ? 'ring-[3px] ring-[#F97316] shadow-[0_8px_20px_-10px_rgba(249,115,22,0.7)]'
                    : isHovered
                    ? 'ring-2 ring-[#008489] shadow-lg -translate-y-0.5 z-10'
                    : 'shadow-[0_1px_3px_rgba(15,23,42,0.18)] hover:shadow-[0_12px_24px_-12px_rgba(15,23,42,0.55)] hover:-translate-y-0.5'
                } ${!isReadOnly ? 'cursor-pointer active:scale-[0.97] active:translate-y-0' : ''}`}
              >
                {/* Full-bleed photo */}
                {image ? (
                  <img
                    src={imageURL}
                    alt=""
                    className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                      isOutOfStock || isSoldOut86 ? 'grayscale opacity-60' : ''
                    }`}
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-start justify-center pt-[18%] bg-gradient-to-br from-[#0D233A] via-[#123553] to-[#006B6F]">
                    <FallbackIcon size={40} stroke={1.5} className="text-white/35" />
                  </div>
                )}

                {/* Legibility scrim: text sits on a dark bottom gradient */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black/90 via-black/55 to-transparent" />

                {/* Top-left status chips */}
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1 max-w-[70%]">
                  {!isReadOnly && isLowStock && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-bold text-white shadow-sm ${
                        isOutOfStock ? 'bg-red-600' : 'bg-amber-500'
                      }`}
                    >
                      <IconAlertTriangleFilled size={11} />
                      {minItemsCanBeMade !== null ? minItemsCanBeMade : t('inventory.low_stock', 'Low Stock')}
                    </span>
                  )}
                  {hasVariantOrAddon && (
                    <span
                      title={t("pos_menu.customize", "Customize")}
                      className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/45 backdrop-blur-sm text-white ring-1 ring-white/25"
                    >
                      <IconAdjustmentsHorizontal size={13} stroke={2.2} />
                    </span>
                  )}
                </div>

                {/* 86 board: sold-out veil and portions-left chip */}
                {isSoldOut86 && (
                  <div className="pointer-events-none absolute inset-0 z-[15] bg-slate-900/55 flex items-center justify-center">
                    <span className="-rotate-12 px-3 py-1 rounded-lg border-2 border-white/90 text-white text-sm font-black tracking-widest uppercase bg-red-600/90 shadow-lg">
                      {t('pos_ops.sold_out', 'Sold out')}
                    </span>
                  </div>
                )}
                {!isSoldOut86 && portionsLeft !== null && (
                  <span className={`absolute ${inCartCount > 0 ? 'top-[38px]' : 'top-2'} right-2 z-[16] rounded-full bg-amber-500 text-white text-[10px] font-black px-2 py-[3px] shadow-md ring-1 ring-white/70 pointer-events-none`}>
                    {t('pos_ops.n_left', '{{count}} left', { count: portionsLeft })}
                  </span>
                )}

                {/* In-cart count badge */}
                {inCartCount > 0 && (
                  <div className="absolute top-2 right-2 z-20 min-w-[26px] h-[26px] px-1.5 rounded-full bg-[#F97316] text-white text-xs font-extrabold tabular-nums flex items-center justify-center shadow-md ring-2 ring-white/90">
                    {inCartCount}
                  </div>
                )}

                {/* Text overlay */}
                <div className={`absolute inset-x-0 bottom-0 z-10 px-2.5 pb-2.5 ${showBottomStepper ? 'pr-[52px]' : ''}`}>
                  <p className="text-[15px] sm:text-base font-extrabold leading-tight tabular-nums text-white drop-shadow-sm">
                    {formatPOSPrice(price, currency)}
                  </p>
                  <p
                    title={title}
                    className="mt-0.5 line-clamp-2 text-[12px] sm:text-[13px] font-semibold leading-[1.2] text-white drop-shadow-sm"
                  >
                    {title}
                  </p>
                  {secondaryTitle && (
                    <p className="line-clamp-1 text-[11px] font-medium leading-tight text-white/80 drop-shadow-sm">
                      {secondaryTitle}
                    </p>
                  )}
                  {!isReadOnly && selectedCategory === "all" && category_title && (
                    <p className="mt-0.5 text-[10px] font-medium text-white/65 truncate">
                      {category_title}
                    </p>
                  )}
                </div>

                {/* Quick remove for simple items already in the cart (tap tile = +1) */}
                {showBottomStepper && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMinusItem(id);
                    }}
                    aria-label="Decrease quantity"
                    className="absolute bottom-2 right-2 z-20 w-[42px] h-[42px] rounded-xl flex items-center justify-center bg-white/20 hover:bg-white/30 backdrop-blur-md text-white ring-1 ring-white/35 active:scale-95 transition touch-manipulation cursor-pointer"
                  >
                    <IconMinus size={20} stroke={2.6} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default POSMenuItemCompactView;
