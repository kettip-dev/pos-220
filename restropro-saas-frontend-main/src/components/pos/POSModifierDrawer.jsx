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
  "Less spicy",
  "Extra spicy",
  "No onions",
  "No ice",
  "Sauce on side",
  "Allergy alert",
  "Well done",
  "Packing separate"
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
      setCustomNotes(prev => prev.replace(note, '').replace(/,\s*,/g, ',').trim());
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden">
      {/* Native Frosted Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
      />

      {/* Sheet Container: Anchors to bottom on mobile, floating modal on tablet/desktop */}
      <div 
        className={clsx(
          "relative w-full max-w-lg bg-background rounded-t-[32px] sm:rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl z-10 flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-in slide-in-from-bottom-8 duration-300 ease-out"
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Native Mobile Pull Handle */}
        <div className="pt-3 pb-1 flex justify-center shrink-0 sm:hidden">
          <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full" />
        </div>

        {/* Header: Item Identity & Close Button */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3.5 border-b border-zinc-100 dark:border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            {itemImage ? (
              <img 
                src={itemImage} 
                alt={item.title} 
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-zinc-200/80 dark:border-zinc-700/80 shadow-xs shrink-0" 
              />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <IconCoffee size={24} className="text-restro-green" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-foreground truncate tracking-tight">
                {item.title}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm sm:text-base font-black text-restro-green">
                  {formatPrice(calculatedUnitPrice)}
                </span>
                {selectedVariant && (
                  <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 truncate">
                    • {selectedVariant.title}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 hover:text-foreground flex items-center justify-center transition active:scale-90 cursor-pointer shrink-0"
            title="Close"
          >
            <IconX size={18} stroke={iconStroke} />
          </button>
        </div>

        {/* Scrollable Content Body with Hidden Scrollbar */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 no-scrollbar overscroll-contain">
          
          {/* Section 1: Variants (Single Choice / Size) */}
          {item.variants && item.variants.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {t('pos.select_variant', 'Select Size / Variant')}
                </span>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Required
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {item.variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleVariantSelect(v)}
                      className={clsx(
                        "min-h-[50px] px-3.5 py-2.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all active:scale-[0.98] cursor-pointer touch-manipulation",
                        isSelected
                          ? "border-restro-green bg-emerald-500/10 text-foreground ring-1.5 ring-restro-green shadow-xs"
                          : "border-zinc-200/90 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 hover:bg-zinc-100/80 dark:hover:bg-zinc-800 text-foreground"
                      )}
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        {/* Native Radio Circle */}
                        <div className={clsx(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                          isSelected ? "border-restro-green bg-restro-green text-white" : "border-zinc-300 dark:border-zinc-600 bg-background"
                        )}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <span className={clsx(
                          "text-xs sm:text-sm font-semibold leading-snug break-words",
                          isSelected ? "text-restro-green font-bold" : "text-zinc-800 dark:text-zinc-200"
                        )}>
                          {v.title}
                        </span>
                      </div>
                      <span className={clsx(
                        "text-xs sm:text-sm font-extrabold shrink-0 px-2 py-0.5 rounded-lg tabular-nums",
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

          {/* Section 2: Add-ons (Multiple Choice - Fluid Wrap to Prevent Truncation) */}
          {item.addons && item.addons.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {t('pos.select_addons', 'Add-ons & Extras')}
                </span>
                <span className={clsx(
                  "text-[10px] font-bold px-2.5 py-0.5 rounded-full transition-colors",
                  selectedAddons.length > 0
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                )}>
                  {selectedAddons.length > 0 ? `${selectedAddons.length} selected` : 'Optional'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {item.addons.map((addon) => {
                  const isChecked = selectedAddons.some(a => a.id === addon.id);
                  return (
                    <button
                      key={addon.id}
                      type="button"
                      onClick={() => toggleAddon(addon)}
                      className={clsx(
                        "min-h-[50px] px-3.5 py-2.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all active:scale-[0.98] cursor-pointer touch-manipulation",
                        isChecked
                          ? "border-restro-green bg-emerald-500/10 ring-1.5 ring-restro-green shadow-xs"
                          : "border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/50 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70 text-foreground"
                      )}
                    >
                      <div className="min-w-0 flex items-center gap-3 flex-1">
                        {/* Native Checkbox */}
                        <div className={clsx(
                          "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                          isChecked
                            ? "border-restro-green bg-restro-green text-white shadow-xs"
                            : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                        )}>
                          {isChecked && <IconCheck size={12} stroke={3} />}
                        </div>
                        <span className={clsx(
                          "text-xs sm:text-sm leading-snug break-words",
                          isChecked ? "font-bold text-foreground" : "font-medium text-zinc-700 dark:text-zinc-300"
                        )}>
                          {addon.title}
                        </span>
                      </div>
                      <span className={clsx(
                        "text-xs font-bold font-mono shrink-0 px-2 py-0.5 rounded-lg tabular-nums",
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
          )}

          {/* Section 3: Special Kitchen Instructions & Quick Presets */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                <IconNote size={14} stroke={iconStroke} />
                <span>{t('pos.notes', 'Kitchen Instructions')}</span>
              </span>
              {customNotes && (
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  Note added
                </span>
              )}
            </div>

            {/* Quick Preset Tags (Pill Shape) */}
            <div className="flex flex-wrap gap-1.5">
              {PRESET_NOTES.map((note) => {
                const isActive = customNotes.includes(note);
                return (
                  <button
                    key={note}
                    type="button"
                    onClick={() => handleTogglePresetNote(note)}
                    className={clsx(
                      "text-xs font-medium px-3 py-1.5 rounded-full border transition active:scale-95 cursor-pointer touch-manipulation flex items-center gap-1",
                      isActive
                        ? "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 font-bold shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200/80 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"
                    )}
                  >
                    {isActive ? (
                      <IconCheck size={12} stroke={3} />
                    ) : (
                      <IconPlus size={11} stroke={2.5} className="opacity-60" />
                    )}
                    <span>{note}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Notes Input with Clear Button */}
            <div className="relative">
              <input
                type="text"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder={t('pos.notes_placeholder', 'Custom notes (e.g. less sweet, extra hot)...')}
                className="w-full text-xs sm:text-sm font-medium pl-9 pr-9 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 text-foreground placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-restro-green focus:bg-background transition shadow-xs"
              />
              <IconNote size={15} stroke={iconStroke} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              {customNotes && (
                <button
                  type="button"
                  onClick={() => setCustomNotes('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-zinc-200/80 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-500 hover:text-foreground flex items-center justify-center transition active:scale-90"
                  title="Clear note"
                >
                  <IconX size={12} stroke={2.5} />
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Sticky Action Footer: Tactile Stepper + Add Button */}
        <div className="p-4 sm:p-5 border-t border-zinc-100 dark:border-zinc-800/80 bg-background/95 backdrop-blur-md flex items-center gap-3 shrink-0">
          
          {/* Native Mobile Quantity Stepper: borderless & backgroundless */}
          <div className="flex items-center gap-1 select-none shrink-0">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="w-10 h-10 flex items-center justify-center text-foreground hover:text-red-500 font-bold active:scale-90 transition cursor-pointer touch-manipulation disabled:opacity-30 disabled:cursor-not-allowed"
              title="Decrease quantity"
            >
              <IconMinus size={22} stroke={2.5} />
            </button>
            <span className="w-8 text-center font-black text-base text-foreground tabular-nums select-none">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 flex items-center justify-center text-foreground hover:text-[#2CA01C] font-bold active:scale-90 transition cursor-pointer touch-manipulation"
              title="Increase quantity"
            >
              <IconPlus size={22} stroke={2.5} />
            </button>
          </div>

          {/* Add to Order CTA Button */}
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 min-h-[48px] h-12 px-4 sm:px-5 rounded-2xl bg-restro-green hover:bg-restro-green-button-hover active:scale-[0.98] text-white font-extrabold text-sm sm:text-base flex items-center justify-between shadow-lg shadow-emerald-600/20 transition-all cursor-pointer touch-manipulation"
          >
            <span className="flex items-center gap-2">
              <IconCheck size={18} stroke={3} />
              <span>{t('pos.add_to_order', 'Add to Order')}</span>
            </span>
            <span className="px-2.5 sm:px-3 py-1 rounded-xl bg-white/20 text-xs sm:text-sm font-mono font-black tabular-nums shadow-xs">
              {formatPrice(totalPrice)}
            </span>
          </button>

        </div>
      </div>
    </div>
  );
}