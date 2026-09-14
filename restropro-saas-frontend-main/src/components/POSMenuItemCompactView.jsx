import React, { useRef, useEffect } from 'react';
import { getImageURL } from '../helpers/ImageHelper';
import { IconAlertTriangleFilled, IconCarrot, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useTheme } from '../contexts/ThemeContext';
import { iconStroke } from '../config/config';

const POSMenuItemCompactView = ({ menuItems, selectedCategory, categories, searchQuery, currency, btnOpenVariantAndAddonModal, addItemToCart, isReadOnly = false, hoveredItemId = null, onItemHover = null, onScroll = null, scrollTopRatio = null }) => {
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
        <div className="flex flex-col justify-center items-center w-full h-full rounded-2xl">
          <img src="/assets/illustrations/pos-not-found.webp" alt={t('pos.not_found_img_alt')} className="w-1/4 mb-4" />
          <p className="text-lg text-restro-green font-bold">{t("pos_menu.not_found_title")}</p>
          <p className="text-gray-500">{t("pos_menu.not_found_message")}</p>
          <p className="text-gray-500">{t("pos_menu.not_found_carrot")}</p>
        </div>
      ) : (
        <div ref={containerRef} onScroll={onScroll} className='grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 w-full z-0 px-4 pt-2 pb-4 rounded-b-2xl overflow-y-auto h-full content-start'>
        {filteredMenuItems.map((menuItem, i) => {
          const { title, description, id, price, image, category_id, category_title, addons, variants } = menuItem;

          const imageURL = image ? getImageURL(image) : null;
          const hasVariantOrAddon = variants?.length > 0 || addons?.length > 0;
          const isHovered = String(hoveredItemId) === String(id);

          const baseRecipeItems = menuItem.recipeItems?.filter(
            (r) => r.variant_id === 0 && r.addon_id === 0
          );

          const isLowStock = baseRecipeItems?.some(
            (r) => parseFloat(r.current_quantity) <= parseFloat(r.min_quantity_threshold)
          );

          const quantitiesPossible = baseRecipeItems.map(r => {
            const currentQty = parseFloat(r.current_quantity || "0");
            const requiredQty = parseFloat(r.recipe_quantity || "1");
            return Math.floor(currentQty / requiredQty);
          });

          const minItemsCanBeMade = quantitiesPossible.length > 0
            ? Math.min(...quantitiesPossible)
            : null;

          return (
            <div
             className={`flex flex-col h-52 md:h-48 overflow-hidden rounded-2xl bg-background shadow-sm md:shadow-none border md:border transition-all duration-200 ${
               isHovered
                 ? 'ring-2 ring-restro-green border-restro-green scale-[1.02] shadow-lg z-10'
                 : 'border-restro-border-green'
             } ${!isReadOnly ? 'hover:cursor-pointer active:scale-[0.98]' : ''}`} key={i}
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
              <div className="flex-shrink-0">
                <div className='flex items-center justify-center relative w-full flex-shrink-0 h-28 md:h-26 rounded-t-2xl text-restro-text bg-restro-gray border-restro-green-light'>
                  {image ? <img src={imageURL} alt={title} className="w-full h-full absolute top-0 left-0 rounded-t-2xl object-cover" /> : <IconCarrot />}
                  {!isReadOnly && category_title && (
                    <div className="absolute top-0 left-0 text-white bg-restro-green text-xs font-semibold px-2 py-1 rounded-tl-2xl rounded-br-xl">
                      {category_title}
                    </div>
                  )}
                  {!isReadOnly && isLowStock && (
                    <div className="absolute left-0 bottom-0 bg-amber-50 text-amber-600 text-[10px] font-medium px-1 py-[1px] z-9 w-full flex flex-col items-center gap-[2px] ">
                      <div className="flex items-center gap-1">
                        <IconAlertTriangleFilled size={12} />
                        <span>Low Stock - {minItemsCanBeMade} Qty</span>
                      </div>
                    </div>
                  )}
                  {!isReadOnly && (
                    <div className="absolute -bottom-3.5 right-2 w-7 h-7 rounded-full flex items-center justify-center text-white bg-restro-green shadow-md">
                      <IconPlus size={16} stroke={iconStroke} />
                    </div>
                  )}
                </div>
              </div>
              <div className="px-2.5 pb-2.5 pt-1.5 flex flex-col justify-between w-full flex-grow min-h-0">
                <div className='text-left'>
                  <p className='line-clamp-1 text-ellipsis text-sm font-semibold leading-snug'>{title}</p>
                  {(variants?.length > 0 || addons?.length > 0) && (
                    <p className="text-[10px] text-gray-500 font-medium leading-tight mt-0.5">
                      {variants?.length > 0 && <span>{variants?.length} {t("pos_menu.variants", "Variants")}</span>}
                      {variants?.length > 0 && addons?.length > 0 && <span> • </span>}
                      {addons?.length > 0 && <span>{addons?.length} {t("pos_menu.addons", "Addons")}</span>}
                    </p>
                  )}
                </div>
                <div className="mt-1">
                  <p className='text-left text-restro-green font-bold text-sm leading-tight'>{currency}{price}</p>
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
