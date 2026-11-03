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
  { key: 'less_sweet', label: 'Less sweet' },
  { key: 'no_sugar', label: 'No sugar' },
  { key: 'extra_shot', label: 'Extra shot' },
  { key: 'no_ice', label: 'No ice' },
  { key: 'less_ice', label: 'Less ice' },
  { key: 'extra_ice', label: 'Extra ice' },
  { key: 'sauce_on_side', label: 'Sauce on side' },
  { key: 'allergy_alert', label: 'Allergy alert' },
];

const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

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
  const [selectedPresets, setSelectedPresets] = useState([]);
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
      setSelectedPresets([]);
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

  // Hide quick notes that duplicate an add-on of this item (e.g. a "No Ice" add-on)
  const presetNotes = useMemo(() => {
    const addonKeys = new Set((item?.addons || []).map(a => normalize(a.title)));
    return PRESET_NOTES.filter(p => !addonKeys.has(normalize(p.label)));
  }, [item]);

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

  const handleTogglePresetNote = (label) => {
    setSelectedPresets(prev =>
      prev.includes(label) ? prev.filter(n => n !== label) : [...prev, label]
    );
  };

  const combinedNotes = [...selectedPresets, customNotes.trim()].filter(Boolean).join(', ');

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
      notes: combinedNotes || null,
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
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    {selectedVariant && <IconCheck size={10} stroke={3} />}
                    {t('pos.modifier_required', 'Required')}
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
                          "min-h-[48px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-all active:scale-[0.98] cursor-pointer touch-manipulation",
                          isSelected
                            ? "border-restro-green bg-emerald-500/10 text-foreground ring-1 ring-restro-green shadow-xs"
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
                  <span>{t('pos.special_instructions', 'Kitchen Instructions')}</span>
                </span>
                {combinedNotes && (
                  <button
                    type="button"
                    onClick={() => { setSelectedPresets([]); setCustomNotes(''); }}
                    className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-full transition cursor-pointer"
                  >
                    {t('pos.clear_all', 'Clear All')}
                  </button>
                )}
              </div>

              {/* Quick Preset Tags */}
              {presetNotes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {presetNotes.map((note) => {
                    const isActive = selectedPresets.includes(note.label);
                    return (
                      <button
                        key={note.key}
                        type="button"
                        onClick={() => handleTogglePresetNote(note.label)}
                        aria-pressed={isActive}
                        className={clsx(
                          "text-xs sm:text-sm font-semibold px-3 rounded-full border transition active:scale-95 cursor-pointer touch-manipulation flex items-center gap-1.5 min-h-[42px]",
                          isActive
                            ? "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 shadow-xs"
                            : "bg-background border-zinc-200 dark:border-zinc-700/70 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        )}
                      >
                        {isActive ? (
                          <IconCheck size={13} stroke={3} />
                        ) : (
                          <IconPlus size={12} stroke={2.5} className="opacity-50" />
                        )}
                        <span>{t(`pos.modifier_presets.${note.key}`, note.label)}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Custom Notes Input */}
              <div className="relative">
                <input
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder={t('pos.special_instructions_placeholder', 'Other instructions for the kitchen...')}
                  className="w-full text-sm font-medium pl-9 pr-11 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 text-foreground placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-restro-green focus:border-restro-green focus:bg-background transition min-h-[44px]"
                />
                <IconNote size={16} stroke={iconStroke} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                {customNotes && (
                  <button
                    type="button"
                    onClick={() => setCustomNotes('')}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-[42px] h-[42px] rounded-lg text-zinc-400 hover:text-foreground flex items-center justify-center transition active:scale-90"
                    title="Clear note"
                  >
                    <IconX size={16} stroke={2.5} />
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
                  {selectedAddons.length > 0
                    ? t('pos.modifier_selected', '{{count}} selected', { count: selectedAddons.length })
                    : t('pos.modifier_optional', 'Optional')}
                </span>
              </div>

              {/* Touch Cards Grid: full names wrap to 2 lines instead of truncating */}
              <div className="flex-1 overflow-y-auto no-scrollbar pr-0.5">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {item.addons.map((addon) => {
                    const isChecked = selectedAddons.some(a => a.id === addon.id);
                    const isFree = !Number(addon.price);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => toggleAddon(addon)}
                        aria-pressed={isChecked}
                        className={clsx(
                          "relative min-h-[64px] pl-3 pr-9 py-2.5 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all active:scale-[0.98] cursor-pointer touch-manipulation",
                          isChecked
                            ? "border-restro-green bg-emerald-500/10 ring-1 ring-restro-green shadow-xs"
                            : "border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/50 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70 text-foreground"
                        )}
                      >
                        <span className={clsx(
                          "text-sm leading-snug line-clamp-2 break-words",
                          isChecked ? "font-bold text-foreground" : "font-medium text-zinc-800 dark:text-zinc-200"
                        )} title={addon.title}>
                          {addon.title}
                        </span>
                        <span className={clsx(
                          "text-xs font-bold tabular-nums",
                          isChecked
                            ? "text-restro-green"
                            : isFree ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-500 dark:text-zinc-400"
                        )}>
                          {isFree ? t('pos.modifier_free', 'Free') : `+${formatPrice(addon.price)}`}
                        </span>
                        <div className={clsx(
                          "absolute top-2.5 right-2.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                          isChecked
                            ? "border-restro-green bg-restro-green text-white"
                            : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                        )}>
                          {isChecked && <IconCheck size={13} stroke={3} />}
                        </div>
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
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl p-1 select-none shrink-0 border border-zinc-200/60 dark:border-zinc-700/60">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="w-11 h-11 flex items-center justify-center rounded-lg bg-background shadow-xs text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-90 transition cursor-pointer touch-manipulation disabled:opacity-30 disabled:shadow-none disabled:bg-transparent disabled:cursor-not-allowed"
              title="Decrease quantity"
            >
              <IconMinus size={18} stroke={2.5} />
            </button>
            <span className="w-9 text-center font-black text-lg text-foreground tabular-nums select-none">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              className="w-11 h-11 flex items-center justify-center rounded-lg bg-background shadow-xs text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-90 transition cursor-pointer touch-manipulation"
              title="Increase quantity"
            >
              <IconPlus size={18} stroke={2.5} />
            </button>
          </div>

          {/* Add to Order CTA Button */}
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 min-w-0 min-h-[52px] px-5 rounded-xl bg-restro-green hover:bg-restro-green-button-hover active:scale-[0.98] text-white font-extrabold text-sm sm:text-base flex items-center justify-between gap-3 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer touch-manipulation"
          >
            <span className="flex items-center gap-2 min-w-0">
              <IconPlus size={18} stroke={3} className="shrink-0" />
              <span className="truncate">{t('pos.add_to_order', 'Add to Order')}</span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              {quantity > 1 && (
                <span className="hidden sm:inline text-xs font-semibold text-white/80 tabular-nums">
                  {quantity} × {formatPrice(calculatedUnitPrice)}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-lg bg-white/20 text-sm sm:text-base font-black tabular-nums">
                {formatPrice(totalPrice)}
              </span>
            </span>
          </button>

        </div>

      </div>
    </div>
  );
}
