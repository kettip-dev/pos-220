import React, { useRef, useEffect } from 'react';
import { getImageURL } from '../helpers/ImageHelper';
import { IconAlertTriangleFilled, IconPlus, IconMinus, IconSearch, IconStack2 } from "@tabler/icons-react";
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
          className="grid grid-cols-1 lg:grid-cols-2 auto-rows-max gap-3.5 w-full z-0 px-3.5 sm:px-4 pt-1.5 pb-6 rounded-b-xl overflow-y-auto h-full content-start"
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

            return (
              <div
                key={id || i}
                onMouseEnter={() => onItemHover && onItemHover(id)}
                onMouseLeave={() => onItemHover && onItemHover(null)}
                onClick={() => {
                  if (isReadOnly) return;
                  if (hasVariantOrAddon) {
                    btnOpenVariantAndAddonModal(id);
                  } else {
                    addItemToCart(menuItem);
                  }
                }}
                className={`group relative flex h-32 sm:h-36 rounded-xl border bg-white dark:bg-slate-900 transition-all duration-150 overflow-hidden select-none ${
                  inCartCount > 0
                    ? 'ring-2 ring-[#2CA01C] border-[#2CA01C] shadow-md'
                    : isHovered
                    ? 'ring-2 ring-[#0D233A]/50 border-[#0D233A] scale-[1.01] shadow-md z-10'
                    : 'border-[#E3E5E8] dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md'
                } ${!isReadOnly ? 'cursor-pointer active:scale-[0.99]' : ''}`}
              >
                {/* Top-Right In-Cart Badge */}
                {showTopRightBadge && (
                  <div className="absolute top-2 right-2 z-20 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold font-mono bg-[#2CA01C] text-white shadow-sm flex items-center gap-1 border border-white/60">
                    <span>x{inCartCount}</span>
                  </div>
                )}

                {/* Left Thumbnail */}
                <div className="relative w-28 sm:w-32 flex-shrink-0 h-full flex items-center justify-center rounded-l-xl bg-[#F4F5F8] dark:bg-slate-800/70 overflow-hidden border-r border-[#E3E5E8]/60 dark:border-slate-800">
                  {image ? (
                    <img
                      src={imageURL}
                      alt={title}
                      className="w-full h-full absolute top-0 left-0 rounded-l-xl object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full absolute top-0 left-0 rounded-l-xl flex flex-col items-center justify-center bg-gradient-to-br from-[#F4F5F8] via-[#EEF2F6] to-[#E6EEF0] dark:from-slate-800/90 dark:via-slate-800/70 dark:to-slate-900">
                      <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-900 border border-[#D4D7DC]/80 dark:border-slate-700 shadow-2xs flex items-center justify-center text-[#008489] dark:text-emerald-400">
                        <FallbackIcon size={21} stroke={1.75} />
                      </div>
                    </div>
                  )}

                  {!isReadOnly && selectedCategory === "all" && category_title && (
                    <div className="absolute top-2 left-2 z-10 bg-[#0D233A]/85 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md max-w-[82%] truncate">
                      {category_title}
                    </div>
                  )}

                  {!isReadOnly && isLowStock && (
                    <div className="absolute left-0 bottom-0 bg-amber-500/95 text-white text-[10px] font-semibold px-1.5 py-0.5 z-10 w-full flex items-center justify-center gap-1">
                      <IconAlertTriangleFilled size={12} />
                      <span>
                        {t('inventory.low_stock', 'Low Stock')} ({minItemsCanBeMade})
                      </span>
                    </div>
                  )}
                </div>

                {/* Right Content */}
                <div
                  className={`p-3 flex flex-col justify-between gap-1.5 w-full min-w-0 ${
                    inCartCount > 0
                      ? 'bg-[#2CA01C]/[0.04] dark:bg-emerald-950/20'
                      : 'bg-white dark:bg-slate-900'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 pr-6">
                      <p className="line-clamp-1 text-sm font-bold text-gray-800 dark:text-slate-100 group-hover:text-[#008489] transition-colors">
                        {title}
                      </p>
                    </div>
                    {description ? (
                      <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                        {description}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex justify-between items-center gap-2 pt-1.5 border-t border-gray-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <p className="text-gray-900 dark:text-white font-extrabold text-sm sm:text-base leading-none font-mono">
                        {formatPOSPrice(price, currency)}
                      </p>
                      {hasVariantOrAddon && (
                        <div className="flex items-center gap-1">
                          {variants?.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 bg-[#F4F5F8] dark:bg-slate-800 text-[#008489] dark:text-emerald-400 border border-[#E3E5E8] dark:border-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              <IconStack2 size={11} stroke={2.2} />
                              {variants.length} {t("pos_menu.variants", "Variants")}
                            </span>
                          )}
                          {addons?.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 bg-[#F4F5F8] dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-[#E3E5E8] dark:border-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              +{addons.length} {t("pos_menu.addons", "Addons")}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {!isReadOnly && (
                      showBottomStepper ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-0.5 select-none shrink-0"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMinusItem(id);
                            }}
                            aria-label="Decrease quantity"
                            className="min-w-[30px] min-h-[30px] flex items-center justify-center text-gray-700 dark:text-slate-200 hover:text-red-500 active:scale-90 transition cursor-pointer"
                          >
                            <IconMinus size={18} stroke={2.5} />
                          </button>
                          <span className="text-xs sm:text-sm font-extrabold px-1 min-w-[18px] text-center font-mono text-gray-900 dark:text-white">
                            {inCartCount}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addItemToCart(menuItem);
                            }}
                            aria-label="Increase quantity"
                            className="min-w-[30px] min-h-[30px] flex items-center justify-center text-gray-700 dark:text-slate-200 hover:text-[#2CA01C] dark:hover:text-[#2CA01C] active:scale-90 transition cursor-pointer"
                          >
                            <IconPlus size={18} stroke={2.5} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (hasVariantOrAddon) {
                              btnOpenVariantAndAddonModal(id);
                            } else {
                              addItemToCart(menuItem);
                            }
                          }}
                          aria-label={hasVariantOrAddon ? t("pos_menu.customize", "Customize") : t("pos_menu.add", "Add")}
                          className={`min-w-[32px] min-h-[32px] flex items-center justify-center transition-all duration-150 active:scale-90 touch-manipulation cursor-pointer shrink-0 ${
                            inCartCount > 0
                              ? 'text-[#2CA01C]'
                              : 'text-[#0D233A] dark:text-slate-200 hover:text-[#2CA01C] dark:hover:text-[#2CA01C]'
                          }`}
                        >
                          <IconPlus size={22} stroke={2.5} />
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

export default POSMenuItemDetailedView;
