import React, { useRef, useEffect } from 'react';
import { getImageURL } from '../helpers/ImageHelper';
import { IconAlertTriangleFilled, IconMinus, IconSearch, IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  formatPOSPrice,
  getCategoryFallbackIcon,
} from './POSMenuItemCompactView';

const POSMenuItemDetailedView = ({
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
        <div className="flex flex-col justify-center items-center w-full h-full py-12 text-center px-4">
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
          className="grid grid-cols-1 lg:grid-cols-2 auto-rows-max gap-3 w-full z-0 px-3.5 sm:px-4 pt-1.5 pb-6 rounded-b-xl overflow-y-auto h-full content-start"
        >
          {filteredMenuItems.map((menuItem, i) => {
            const { title, description, id, price, image, category_title, addons, variants } = menuItem;

            const imageURL = image ? getImageURL(image) : null;
            const hasVariantOrAddon = variants?.length > 0 || addons?.length > 0;
            const isHovered = String(hoveredItemId) === String(id);

            const inCartCount =
              cartItems?.reduce((acc, c) => (c.id === id ? acc + (Number(c.quantity) || 1) : acc), 0) || 0;

            const showBottomStepper = !isReadOnly && inCartCount > 0 && !hasVariantOrAddon && Boolean(onMinusItem);
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
                role={!isReadOnly ? 'button' : undefined}
                aria-label={title}
                onMouseEnter={() => onItemHover && onItemHover(id)}
                onMouseLeave={() => onItemHover && onItemHover(null)}
                onClick={triggerPrimaryAction}
                className={`group relative h-32 sm:h-36 overflow-hidden rounded-xl bg-[#0D233A] select-none transition-all duration-150 ${
                  inCartCount > 0
                    ? 'ring-[3px] ring-[#F97316] shadow-[0_8px_20px_-10px_rgba(249,115,22,0.7)]'
                    : isHovered
                    ? 'ring-2 ring-[#008489] shadow-lg -translate-y-0.5 z-10'
                    : 'shadow-[0_1px_3px_rgba(15,23,42,0.18)] hover:shadow-[0_12px_24px_-12px_rgba(15,23,42,0.55)] hover:-translate-y-0.5'
                } ${!isReadOnly ? 'cursor-pointer active:scale-[0.99] active:translate-y-0' : ''}`}
              >
                {/* Full-bleed photo */}
                {image ? (
                  <img
                    src={imageURL}
                    alt=""
                    className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                      isOutOfStock ? 'grayscale opacity-60' : ''
                    }`}
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-end pr-[12%] bg-gradient-to-br from-[#0D233A] via-[#123553] to-[#006B6F]">
                    <FallbackIcon size={48} stroke={1.5} className="text-white/30" />
                  </div>
                )}

                {/* Legibility scrim: text sits on a dark left-side gradient */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/5" />

                {/* In-cart count badge */}
                {inCartCount > 0 && (
                  <div className="absolute top-2 right-2 z-20 min-w-[26px] h-[26px] px-1.5 rounded-full bg-[#F97316] text-white text-xs font-extrabold tabular-nums flex items-center justify-center shadow-md ring-2 ring-white/90">
                    {inCartCount}
                  </div>
                )}

                {/* Text overlay */}
                <div className="absolute inset-y-0 left-0 z-10 w-[72%] flex flex-col justify-between p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {!isReadOnly && isLowStock && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] font-bold text-white shrink-0 ${
                            isOutOfStock ? 'bg-red-600' : 'bg-amber-500'
                          }`}
                        >
                          <IconAlertTriangleFilled size={11} />
                          {minItemsCanBeMade !== null ? minItemsCanBeMade : t('inventory.low_stock', 'Low Stock')}
                        </span>
                      )}
                      {!isReadOnly && selectedCategory === "all" && category_title && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60 truncate">
                          {category_title}
                        </span>
                      )}
                    </div>
                    <p
                      title={title}
                      className="mt-0.5 line-clamp-1 text-sm sm:text-[15px] font-bold leading-snug text-white drop-shadow-sm"
                    >
                      {title}
                    </p>
                    {description ? (
                      <p className="mt-0.5 line-clamp-2 text-[11px] sm:text-xs leading-snug text-white/70">
                        {description}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-base sm:text-lg font-extrabold leading-none tabular-nums text-white drop-shadow-sm shrink-0">
                      {formatPOSPrice(price, currency)}
                    </p>
                    {hasVariantOrAddon && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-sm ring-1 ring-white/20 px-2 py-[3px] text-[10px] font-semibold text-white/90 truncate">
                        <IconAdjustmentsHorizontal size={12} stroke={2.2} className="shrink-0" />
                        {variants?.length > 0 && `${variants.length} ${t("pos_menu.variants", "Variants")}`}
                        {variants?.length > 0 && addons?.length > 0 && ' • '}
                        {addons?.length > 0 && `+${addons.length} ${t("pos_menu.addons", "Addons")}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick remove for simple items already in the cart (tap row = +1) */}
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

export default POSMenuItemDetailedView;
