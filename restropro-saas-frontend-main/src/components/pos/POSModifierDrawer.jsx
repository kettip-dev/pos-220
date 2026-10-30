import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  IconX, 
  IconCheck, 
  IconPlus, 
  IconMinus, 
  IconNote, 
  IconCoffee 
} from '@tabler/icons-react';
import { getImageURL } from '../../helpers/ImageHelper';
import { clsx } from 'clsx';
import { iconStroke } from '../../config/config';

const PRESET_NOTES = [
  "Less sweet",
  "No sugar",
  "Extra shot",
  "No ice",
  "Less ice",
  "Extra ice",
  "Sauce on side",
  "Allergy alert"
];

export default function POSModifierDrawer({
  isOpen,
  onClose,
  item,
  currency = '$',
  onAddToCart,
  canPrepareMenuItem,
  broadcastVariantSelection,
}) {
  const { t } = useTranslation();

  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [customNotes, setCustomNotes] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Initialize or reset selections when a new item is opened
  useEffect(() => {
    if (item && isOpen) {
      if (item.variants && item.variants.length > 0) {
        setSelectedVariant(item.variants[0]);
      } else {
        setSelectedVariant(null);
      }
      setSelectedAddons([]);
      setCustomNotes('');
      setQuantity(1);

      if (broadcastVariantSelection) {
        const defaultVarId = item.variants?.[0]?.id || null;
        broadcastVariantSelection(item.id, defaultVarId, []);
      }
    }
  }, [item, isOpen]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Live item total calculation
  const calculatedUnitPrice = useMemo(() => {
    if (!item) return 0;
    const base = selectedVariant ? Number(selectedVariant.price) : Number(item.price);
    const addonsTotal = selectedAddons.reduce((sum, a) => sum + Number(a.price || 0), 0);
    return base + addonsTotal;
  }, [item, selectedVariant, selectedAddons]);

  const totalPrice = calculatedUnitPrice * quantity;

  // Smart price formatter (USD with decimals, KHR formatted as integers)
  const formatPrice = (price) => {
    const num = Number(price) || 0;
    const isKHR = currency === '៛' || String(currency).toUpperCase().includes('KHR');
    if (isKHR) {
      return `${currency}${Math.round(num).toLocaleString('en-US')}`;
    }
    return `${currency}${num.toFixed(2)}`;
  };

  if (!isOpen || !item) return null;

  const handleVariantSelect = (variant) => {
    setSelectedVariant(variant);
    if (broadcastVariantSelection) {
      broadcastVariantSelection(item.id, variant.id, selectedAddons.map(a => a.id));
    }
  };

  const toggleAddon = (addon) => {
    const isSelected = selectedAddons.some(a => a.id === addon.id);
    let nextAddons;
    if (isSelected) {
      nextAddons = selectedAddons.filter(a => a.id !== addon.id);
    } else {
      nextAddons = [...selectedAddons, addon];
    }
    setSelectedAddons(nextAddons);
    if (broadcastVariantSelection) {
      broadcastVariantSelection(item.id, selectedVariant?.id, nextAddons.map(a => a.id));
    }
  };

  const handleTogglePresetNote = (note) => {
    if (customNotes.includes(note)) {
      setCustomNotes(prev => prev.replace(note, '').replace(/,\s*,/g, ',').replace(/^,\s*|\s*,$/g, '').trim());
    } else {
      setCustomNotes(prev => prev ? `${prev}, ${note}` : note);
    }
  };

  const handleConfirm = () => {
    // Inventory recipe availability check
    if (canPrepareMenuItem) {
      const isAvailable = canPrepareMenuItem(
        item,
        quantity,
        selectedVariant?.id || null,
        selectedAddons.map(a => a.id.toString())
      );
      if (!isAvailable) {
        return;
      }
    }

    const cartPayload = {
      ...item,
      price: selectedVariant ? Number(selectedVariant.price) : Number(item.price),
      variant_id: selectedVariant ? selectedVariant.id : null,
      variant: selectedVariant ? { id: selectedVariant.id, title: selectedVariant.title, price: selectedVariant.price } : null,
      addons_ids: selectedAddons.map(a => a.id),
      addons: selectedAddons.map(a => ({ id: a.id, title: a.title, price: a.price })),
      quantity: quantity,
      notes: customNotes.trim() || null,
    };

    onAddToCart(cartPayload);
    onClose();
  };

  const itemImage = item.image ? getImageURL(item.image) : null;
  const hasVariants = Boolean(item.variants && item.variants.length > 0);
  const hasAddons = Boolean(item.addons && item.addons.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 lg:p-6 overflow-hidden">
      {/* Native Frosted Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
      />

      {/* Sheet Container: Bottom Sheet on Mobile, 2-Column Responsive Modal on Tablet/Desktop */}
      <div 
        className={clsx(
          "relative w-full bg-background rounded-t-[28px] md:rounded-3xl border border-zinc-200/90 dark:border-zinc-800 shadow-2xl z-10 flex flex-col max-h-[92vh] md:max-h-[85vh] animate-in slide-in-from-bottom-6 duration-200 ease-out",
          hasAddons 
            ? "md:max-w-4xl lg:max-w-5xl" 
            : "md:max-w-lg"
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Mobile Pull Indicator */}
        <div className="pt-2.5 pb-1 flex justify-center shrink-0 md:hidden">
          <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-600 rounded-full" />
        </div>

        {/* Modal Top Header (Full Width) */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 dark:border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {itemImage ? (
              <img 
                src={itemImage} 
                alt={item.title} 
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover border border-zinc-200/80 dark:border-zinc-700/80 shadow-xs shrink-0" 
              />
            ) : (
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <IconCoffee size={22} className="text-restro-green" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-foreground truncate tracking-tight">
                {item.title}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-black text-restro-green tabular-nums">
                  {formatPrice(calculatedUnitPrice)}
                </span>
                {selectedVariant && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 truncate">
                    {selectedVariant.title}
                  </span>
                )}
                {hasAddons && selectedAddons.length > 0 && (
                  <span className="hidden sm:inline-flex text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    +{selectedAddons.length} {selectedAddons.length === 1 ? 'add-on' : 'add-ons'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 hover:text-foreground flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
            title="Close"
          >
            <IconX size={18} stroke={iconStroke} />
          </button>
        </div>

        {/* Modal Main Body: 2-Column Split Layout on Tablet, Single Column Scroll on Mobile */}
        <div className={clsx(
          "flex-1 overflow-y-auto md:overflow-hidden",
          hasAddons 
            ? "flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-zinc-100 dark:divide-zinc-800/80" 
            : "flex flex-col p-4 sm:p-5"
        )}>
          
          {/* Column 1 (Left on Tablet): Variants & Kitchen Notes */}
          <div className={clsx(
            "flex flex-col overflow-y-auto no-scrollbar",
            hasAddons 
              ? "w-full md:w-[42%] lg:w-[38%] p-4 sm:p-5 space-y-4 shrink-0" 
              : "w-full space-y-4"
          )}>
            
            {/* Section: Size / Variant */}
            {hasVariants && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    {t('pos.select_variant', 'Select Size / Variant')}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Required
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-1.5">
                  {item.variants.map((v) => {
                    const isSelected = selectedVariant?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleVariantSelect(v)}
                        className={clsx(
                          "min-h-[44px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-all active:scale-[0.98] cursor-pointer touch-manipulation",
                          isSelected
                            ? "border-restro-green bg-emerald-500/10 text-foreground ring-1.5 ring-restro-green shadow-xs"
                            : "border-zinc-200/90 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 hover:bg-zinc-100/80 dark:hover:bg-zinc-800 text-foreground"
                        )}
                      >
                        <div className="min-w-0 flex items-center gap-2.5">
                          <div className={clsx(
                            "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                            isSelected ? "border-restro-green bg-restro-green text-white" : "border-zinc-300 dark:border-zinc-600 bg-background"
                          )}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className={clsx(
                            "text-xs sm:text-sm font-semibold truncate",
                            isSelected ? "text-restro-green font-bold" : "text-zinc-800 dark:text-zinc-200"
                          )}>
                            {v.title}
                          </span>
                        </div>
                        <span className={clsx(
                          "text-xs font-extrabold shrink-0 px-2 py-0.5 rounded-md tabular-nums",
                          isSelected ? "bg-emerald-500/20 text-restro-green font-black" : "text-zinc-600 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800"
                        )}>
                          {formatPrice(v.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section: Kitchen Instructions & Quick Presets */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                  <IconNote size={13} stroke={iconStroke} />
                  <span>{t('pos.notes', 'Kitchen Instructions')}</span>
                </span>
                {customNotes && (
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    Note active
                  </span>
                )}
              </div>

              {/* Quick Preset Tags */}
              <div className="flex flex-wrap gap-1.5">
                {PRESET_NOTES.map((note) => {
                  const isActive = customNotes.includes(note);
                  return (
                    <button
                      key={note}
                      type="button"
                      onClick={() => handleTogglePresetNote(note)}
                      className={clsx(
                        "text-xs font-medium px-2.5 py-1 rounded-lg border transition active:scale-95 cursor-pointer touch-manipulation flex items-center gap-1 min-h-[32px]",
                        isActive
                          ? "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 font-bold shadow-xs"
                          : "bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200/80 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"
                      )}
                    >
                      {isActive ? (
                        <IconCheck size={11} stroke={3} />
                      ) : (
                        <IconPlus size={10} stroke={2.5} className="opacity-60" />
                      )}
                      <span>{note}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Notes Input */}
              <div className="relative">
                <input
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder={t('pos.notes_placeholder', 'Type special instructions...')}
                  className="w-full text-xs sm:text-sm font-medium pl-8 pr-8 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 text-foreground placeholder:text-zinc-400 focus:outline-none focus:ring-1.5 focus:ring-restro-green focus:bg-background transition shadow-xs min-h-[38px]"
                />
                <IconNote size={14} stroke={iconStroke} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                {customNotes && (
                  <button
                    type="button"
                    onClick={() => setCustomNotes('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-zinc-200/80 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-500 hover:text-foreground flex items-center justify-center transition active:scale-90"
                    title="Clear note"
                  >
                    <IconX size={11} stroke={2.5} />
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Column 2 (Right on Tablet): Add-ons & Extras Grid */}
          {hasAddons && (
            <div className="flex-1 flex flex-col p-4 sm:p-5 overflow-hidden min-w-0">
              <div className="flex items-center justify-between pb-2.5 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    {t('pos.select_addons', 'Add-ons & Extras')}
                  </span>
                  <span className="text-[10px] font-semibold text-zinc-400">
                    ({item.addons.length})
                  </span>
                </div>
                <span className={clsx(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors",
                  selectedAddons.length > 0
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                )}>
                  {selectedAddons.length > 0 ? `${selectedAddons.length} selected` : 'Optional'}
                </span>
              </div>

              {/* High-Density Touch Cards Grid (2-3 Columns) */}
              <div className="flex-1 overflow-y-auto no-scrollbar pr-0.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  {item.addons.map((addon) => {
                    const isChecked = selectedAddons.some(a => a.id === addon.id);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => toggleAddon(addon)}
                        className={clsx(
                          "min-h-[44px] h-[44px] px-3 py-1.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all active:scale-[0.98] cursor-pointer touch-manipulation",
                          isChecked
                            ? "border-restro-green bg-emerald-500/10 ring-1.5 ring-restro-green shadow-xs"
                            : "border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/50 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70 text-foreground"
                        )}
                      >
                        <div className="min-w-0 flex items-center gap-2.5 flex-1">
                          <div className={clsx(
                            "w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                            isChecked
                              ? "border-restro-green bg-restro-green text-white shadow-xs"
                              : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                          )}>
                            {isChecked && <IconCheck size={11} stroke={3} />}
                          </div>
                          <span className={clsx(
                            "text-xs leading-tight truncate",
                            isChecked ? "font-bold text-foreground" : "font-medium text-zinc-700 dark:text-zinc-300"
                          )} title={addon.title}>
                            {addon.title}
                          </span>
                        </div>
                        <span className={clsx(
                          "text-[11px] font-bold font-mono shrink-0 px-1.5 py-0.5 rounded-md tabular-nums",
                          isChecked
                            ? "bg-emerald-500/20 text-restro-green font-extrabold"
                            : "text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800"
                        )}>
                          +{formatPrice(addon.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Full-Width Bottom Action Bar */}
        <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800/80 bg-background/95 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
          
          {/* Tactile Quantity Stepper */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl p-0.5 select-none shrink-0 border border-zinc-200/60 dark:border-zinc-700/60">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="w-10 h-10 min-w-[40px] flex items-center justify-center rounded-lg text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-90 transition cursor-pointer touch-manipulation disabled:opacity-30 disabled:cursor-not-allowed"
              title="Decrease quantity"
            >
              <IconMinus size={18} stroke={2.5} />
            </button>
            <span className="w-8 text-center font-black text-base text-foreground tabular-nums select-none">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 min-w-[40px] flex items-center justify-center rounded-lg text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-90 transition cursor-pointer touch-manipulation"
              title="Increase quantity"
            >
              <IconPlus size={18} stroke={2.5} />
            </button>
          </div>

          {/* Add to Order CTA Button */}
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 max-w-sm sm:max-w-md min-h-[46px] h-[46px] px-5 rounded-xl bg-restro-green hover:bg-restro-green-button-hover active:scale-[0.98] text-white font-extrabold text-sm sm:text-base flex items-center justify-between shadow-lg shadow-emerald-600/20 transition-all cursor-pointer touch-manipulation"
          >
            <span className="flex items-center gap-2">
              <IconCheck size={18} stroke={3} />
              <span>{t('pos.add_to_order', 'Add to Order')}</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-lg bg-white/20 text-xs sm:text-sm font-mono font-black tabular-nums shadow-xs">
              {formatPrice(totalPrice)}
            </span>
          </button>

        </div>

      </div>
    </div>
  );
}
