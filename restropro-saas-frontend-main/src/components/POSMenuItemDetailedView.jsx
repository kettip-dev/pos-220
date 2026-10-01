import React, { useRef, useEffect } from 'react';
import { getImageURL } from '../helpers/ImageHelper';
import { IconAlertTriangleFilled, IconToolsKitchen2, IconPlus, IconMinus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useTheme } from '../contexts/ThemeContext';

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
  scrollTopRatio = null 
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
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

  const filteredMenuItems = menuItems.filter((menuItem) => menuItem.is_enabled)
    .filter((menuItem) => {
      if (selectedCategory === "all") {
        return !menuItem.category_id || categories.find(category => category.id === menuItem.category_id && category.is_enabled);
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
    <div className='w-full h-full overflow-hidden'>
      {filteredMenuItems.length === 0 ? (
        <div className="flex flex-col justify-center items-center w-full h-full py-12">
          <img src="/assets/illustrations/pos-not-found.webp" alt={t('pos.not_found_img_alt')} className="w-1/4 max-w-[180px] mb-4 opacity-80" />
          <p className="text-lg text-restro-green font-bold">{t("pos_menu.not_found_title")}</p>
          <p className="text-gray-500 text-sm">{t("pos_menu.not_found_message")}</p>
          <p className="text-gray-400 text-xs mt-1">{t("pos_menu.not_found_carrot")}</p>
        </div>
      ) : (
        <div ref={containerRef} onScroll={onScroll} className='grid grid-cols-1 lg:grid-cols-2 gap-3.5 w-full z-0 px-4 pb-6 rounded-b-2xl overflow-y-auto h-full content-start'>
          {filteredMenuItems.map((menuItem, i) => {
            const { title, description, id, price, image, category_id, category_title, addons, variants } = menuItem;

            const imageURL = image ? getImageURL(image) : null;
            const hasVariantOrAddon = variants?.length > 0 || addons?.length > 0;
            const isHovered = String(hoveredItemId) === String(id);

            const inCartCount = cartItems?.reduce((acc, c) => c.id === id ? acc + (Number(c.quantity) || 1) : acc, 0) || 0;

            const baseRecipeItems = menuItem.recipeItems?.filter(
              (r) => r.variant_id === 0 && r.addon_id === 0
            );

            const isLowStock = baseRecipeItems?.some(
              (r) => parseFloat(r.current_quantity) <= parseFloat(r.min_quantity_threshold)
            );

            const quantitiesPossible = baseRecipeItems?.map(r => {
              const currentQty = parseFloat(r.current_quantity || "0");
              const requiredQty = parseFloat(r.recipe_quantity || "1");
              return Math.floor(currentQty / requiredQty);
            });

            const minItemsCanBeMade = quantitiesPossible?.length > 0
              ? Math.min(...quantitiesPossible)
              : null;

            return (
              <div
                className={`group relative flex gap-3 min-h-32 max-h-36 rounded-2xl shadow-sm border text-restro-text bg-restro-card-bg transition-all duration-200 overflow-hidden select-none ${
                  inCartCount > 0
                    ? 'ring-2 ring-restro-green border-restro-green shadow-emerald-500/10 shadow-md'
                    : isHovered
                    ? 'ring-2 ring-restro-green/60 border-restro-green scale-[1.01] shadow-md z-10'
                    : 'border-restro-border-green hover:border-restro-green/50 hover:shadow-md'
                }`}
                key={i}
                onMouseEnter={() => onItemHover && onItemHover(id)}
                onMouseLeave={() => onItemHover && onItemHover(null)}
              >
                {/* In-Cart Badge */}
                {inCartCount > 0 && !isReadOnly && (
                  <div className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded-full text-[11px] font-extrabold font-mono bg-restro-green text-white shadow-md flex items-center gap-1 border border-white/40 backdrop-blur-sm">
                    <span>x{inCartCount}</span>
                  </div>
                )}

                <div className='relative w-28 md:w-32 flex-shrink-0 h-full flex items-center justify-center rounded-l-2xl text-restro-text bg-restro-gray/80 dark:bg-restro-bg-seconday-dark-mode overflow-hidden'>
                  {image ? (
                    <img
                      src={imageURL}
                      alt={title}
                      className="w-full h-full absolute top-0 left-0 rounded-l-2xl object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full absolute top-0 left-0 rounded-l-2xl flex flex-col items-center justify-center bg-gradient-to-br from-emerald-500/15 via-restro-gray/90 to-emerald-500/5 dark:from-emerald-950/40 dark:via-restro-bg-seconday-dark-mode dark:to-emerald-950/20 text-restro-text">
                      <div className="w-10 h-10 rounded-2xl bg-white/80 dark:bg-white/10 shadow-xs flex items-center justify-center text-restro-green border border-emerald-500/20">
                        <IconToolsKitchen2 size={20} stroke={1.8} />
                      </div>
                    </div>
                  )}

                  {!isReadOnly && category_title && (
                    <div className="absolute top-2 left-2 z-10 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-lg border border-white/15 shadow-xs max-w-[80%] truncate">
                      {category_title}
                    </div>
                  )}

                  {!isReadOnly && isLowStock && (
                    <div className="absolute left-0 bottom-0 bg-amber-500/95 text-white text-[10px] font-semibold px-1.5 py-0.5 z-10 w-full flex items-center justify-center gap-1 backdrop-blur-sm">
                      <IconAlertTriangleFilled size={12} />
                      <span>{t('inventory.low_stock', 'Low Stock')} ({minItemsCanBeMade})</span>
                    </div>
                  )}
                </div>

                <div className="p-3 flex flex-col justify-between gap-1.5 w-full min-w-0">
                  <div>
                    <div className='flex items-start justify-between gap-2 pr-2'>
                      <p className='line-clamp-1 text-sm text-ellipsis font-semibold text-restro-text group-hover:text-restro-green transition-colors'>{title}</p>
                    </div>
                    <p className='line-clamp-2 text-ellipsis text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed'>{description}</p>
                  </div>

                  <div className="flex justify-between items-center gap-2 pt-1 border-t border-restro-border-green/40">
                    <div className="flex flex-col">
                      <p className='text-restro-green dark:text-emerald-400 font-extrabold text-sm sm:text-base leading-none font-mono'>{currency}{Number(price).toFixed(2)}</p>
                      {(variants?.length > 0 || addons?.length > 0) && (
                        <p className="text-[10px] font-semibold text-gray-500 mt-1 flex items-center gap-1">
                          {variants?.length > 0 && <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">{variants?.length} {t("pos_menu.variants")}</span>}
                          {addons?.length > 0 && <span className="bg-restro-gray dark:bg-white/10 px-1.5 py-0.5 rounded border border-restro-border-green/40">{addons?.length} {t("pos_menu.addons")}</span>}
                        </p>
                      )}
                    </div>

                    {!isReadOnly && (
                      inCartCount > 0 && !hasVariantOrAddon && onMinusItem ? (
                        <div className="flex items-center gap-1 bg-restro-green text-white rounded-full p-0.5 shadow-sm">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMinusItem(id);
                            }}
                            aria-label="Decrease quantity"
                            className="w-6 h-6 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/30 active:scale-90 transition"
                          >
                            <IconMinus size={13} stroke={2.5} />
                          </button>
                          <span className="text-xs font-bold px-1.5 min-w-[16px] text-center">{inCartCount}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addItemToCart(menuItem);
                            }}
                            aria-label="Increase quantity"
                            className="w-6 h-6 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/30 active:scale-90 transition"
                          >
                            <IconPlus size={13} stroke={2.5} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (hasVariantOrAddon) {
                              btnOpenVariantAndAddonModal(id);
                            } else {
                              addItemToCart(menuItem);
                            }
                          }}
                          className={`rounded-xl px-3.5 py-1.5 transition active:scale-95 text-white flex items-center justify-center font-semibold text-xs shadow-sm hover:shadow ${
                            inCartCount > 0 ? 'bg-restro-green ring-2 ring-restro-green/40' : 'bg-restro-green hover:bg-restro-green-button-hover'
                          }`}
                        >
                          {inCartCount > 0 ? `+ ${t("pos_menu.add")}` : t("pos_menu.add")}
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
