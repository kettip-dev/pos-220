import React, { useRef, useEffect } from 'react';
import { getImageURL } from '../helpers/ImageHelper';
import { IconAlertTriangleFilled, IconCarrot, IconPlus, IconMinus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useTheme } from '../contexts/ThemeContext';
import { iconStroke } from '../config/config';

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
        <div className="flex flex-col justify-center items-center w-full h-full rounded-2xl py-12">
          <img src="/assets/illustrations/pos-not-found.webp" alt={t('pos.not_found_img_alt')} className="w-1/4 max-w-[180px] mb-4 opacity-80" />
          <p className="text-lg text-restro-green font-bold">{t("pos_menu.not_found_title")}</p>
          <p className="text-gray-500 text-sm">{t("pos_menu.not_found_message")}</p>
          <p className="text-gray-400 text-xs mt-1">{t("pos_menu.not_found_carrot")}</p>
        </div>
      ) : (
        <div ref={containerRef} onScroll={onScroll} className='grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-3.5 w-full z-0 px-4 pt-2 pb-6 rounded-b-2xl overflow-y-auto h-full content-start'>
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
             className={`group relative flex flex-col h-56 md:h-52 overflow-hidden rounded-2xl bg-restro-card-bg shadow-sm border transition-all duration-200 select-none ${
               inCartCount > 0
                 ? 'ring-2 ring-restro-green border-restro-green shadow-emerald-500/10 shadow-md'
                 : isHovered
                 ? 'ring-2 ring-restro-green/60 border-restro-green scale-[1.01] shadow-md z-10'
                 : 'border-restro-border-green hover:border-restro-green/50 hover:shadow-md'
             } ${!isReadOnly ? 'hover:cursor-pointer' : ''}`} key={i}
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
            >
              {/* In-Cart Badge for items with variants */}
              {inCartCount > 0 && !isReadOnly && hasVariantOrAddon && (
                <div className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded-full text-xs font-bold bg-restro-green text-white shadow-lg flex items-center gap-1 border border-white/40 backdrop-blur-sm">
                  <span>x{inCartCount}</span>
                </div>
              )}

              <div className="flex-shrink-0 relative overflow-hidden">
                <div className='flex items-center justify-center relative w-full flex-shrink-0 h-28 md:h-26 rounded-t-2xl text-restro-text bg-restro-gray'>
                  {image ? (
                    <img
                      src={imageURL}
                      alt={title}
                      className="w-full h-full absolute top-0 left-0 rounded-t-2xl object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <IconCarrot size={28} stroke={iconStroke} />
                    </div>
                  )}

                  {!isReadOnly && category_title && (
                    <div className="absolute top-0 left-0 text-white bg-black/60 backdrop-blur-md text-[10px] font-semibold px-2 py-0.5 rounded-tl-2xl rounded-br-lg shadow-sm">
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
              </div>

              <div className="px-3 pb-2.5 pt-2 flex flex-col justify-between w-full flex-grow min-h-0 bg-restro-card-bg">
                <div className='text-left'>
                  <p className='line-clamp-1 text-ellipsis text-sm font-semibold text-restro-text leading-snug group-hover:text-restro-green transition-colors'>{title}</p>
                  {(variants?.length > 0 || addons?.length > 0) && (
                    <p className="text-[10px] text-gray-500 font-medium leading-tight mt-0.5 flex items-center gap-1">
                      {variants?.length > 0 && <span className="bg-restro-gray px-1.5 py-0.5 rounded-md">{variants?.length} {t("pos_menu.variants", "Variants")}</span>}
                      {addons?.length > 0 && <span className="bg-restro-gray px-1.5 py-0.5 rounded-md">{addons?.length} {t("pos_menu.addons", "Addons")}</span>}
                    </p>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between gap-1">
                  <span className='text-left text-restro-green font-bold text-sm leading-tight tracking-tight'>
                    {currency}{Number(price).toFixed(2)}
                  </span>

                  {!isReadOnly && (
                    inCartCount > 0 && !hasVariantOrAddon && onMinusItem ? (
                      /* On-card interactive stepper */
                      <div 
                        onClick={(e) => e.stopPropagation()} 
                        className="flex items-center gap-1 bg-restro-green text-white rounded-full p-0.5 shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMinusItem(id);
                          }}
                          aria-label="Decrease quantity"
                          className="w-5 h-5 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/30 active:scale-90 transition"
                        >
                          <IconMinus size={12} stroke={2.5} />
                        </button>
                        <span className="text-xs font-bold px-1 min-w-[14px] text-center">{inCartCount}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addItemToCart(menuItem);
                          }}
                          aria-label="Increase quantity"
                          className="w-5 h-5 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/30 active:scale-90 transition"
                        >
                          <IconPlus size={12} stroke={2.5} />
                        </button>
                      </div>
                    ) : (
                      /* Add button / customized button */
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
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-white shadow-sm transition-all duration-200 active:scale-90 ${
                          inCartCount > 0 ? 'bg-restro-green ring-2 ring-restro-green/40' : 'bg-restro-green hover:bg-restro-green-button-hover'
                        }`}
                      >
                        <IconPlus size={16} stroke={iconStroke} />
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
