import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { IconX, IconCheck, IconPlus, IconMinus, IconNote, IconAlertTriangleFilled } from '@tabler/icons-react';
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

  // Live item total calculation
  const calculatedUnitPrice = useMemo(() => {
    if (!item) return 0;
    const base = selectedVariant ? Number(selectedVariant.price) : Number(item.price);
    const addonsTotal = selectedAddons.reduce((sum, a) => sum + Number(a.price || 0), 0);
    return base + addonsTotal;
  }, [item, selectedVariant, selectedAddons]);

  const totalPrice = calculatedUnitPrice * quantity;

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
      variant: selectedVariant ? { id: selectedVariant.id, title: selectedVariant.title, price: selectedVariant.price } : null,
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
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
      />

      {/* Sheet Container */}
      <div 
        className={clsx(
          "relative w-full max-w-lg bg-background rounded-t-3xl sm:rounded-3xl border border-restro-border-green shadow-2xl z-10 flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in slide-in-from-bottom-6 duration-200"
        )}
      >
        {/* Header with Drag Handle & Close Button */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-restro-border-green shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {itemImage && (
              <img 
                src={itemImage} 
                alt={item.title} 
                className="w-12 h-12 rounded-xl object-cover border border-restro-border-green shrink-0" 
              />
            )}
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-restro-text truncate">
                {item.title}
              </h3>
              <p className="text-xs text-restro-green font-extrabold">
                {currency}{calculatedUnitPrice.toFixed(2)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-restro-gray hover:bg-restro-button-hover text-restro-text flex items-center justify-center transition active:scale-95 cursor-pointer"
            title="Close"
          >
            <IconX size={18} stroke={iconStroke} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scrollbar-thin">
          
          {/* Section 1: Variants (Single Choice) */}
          {item.variants && item.variants.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  {t('pos.select_variant', 'Select Size / Variant')}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                  Required
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {item.variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleVariantSelect(v)}
                      className={clsx(
                        "min-h-[48px] p-3 rounded-2xl border text-left flex items-center justify-between transition-all active:scale-[0.98] cursor-pointer touch-manipulation",
                        isSelected
                          ? "border-restro-green bg-emerald-500/10 text-restro-green ring-2 ring-restro-green font-bold shadow-xs"
                          : "border-restro-border-green bg-restro-card-bg text-restro-text hover:bg-restro-button-hover"
                      )}
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <div className={clsx(
                          "w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                          isSelected ? "border-restro-green bg-restro-green text-white" : "border-gray-400"
                        )}>
                          {isSelected && <IconCheck size={10} stroke={3} />}
                        </div>
                        <span className="text-xs truncate">{v.title}</span>
                      </div>
                      <span className="text-xs font-extrabold shrink-0 ml-1">
                        {currency}{Number(v.price).toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Add-ons (Multiple Choice) */}
          {item.addons && item.addons.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  {t('pos.select_addons', 'Add-ons & Extras')}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-gray-500">
                  Optional
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {item.addons.map((addon) => {
                  const isChecked = selectedAddons.some(a => a.id === addon.id);
                  return (
                    <button
                      key={addon.id}
                      type="button"
                      onClick={() => toggleAddon(addon)}
                      className={clsx(
                        "min-h-[48px] p-3 rounded-2xl border text-left flex items-center justify-between transition-all active:scale-[0.98] cursor-pointer touch-manipulation",
                        isChecked
                          ? "border-restro-green bg-emerald-500/10 text-restro-green ring-2 ring-restro-green font-bold shadow-xs"
                          : "border-restro-border-green bg-restro-card-bg text-restro-text hover:bg-restro-button-hover"
                      )}
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <div className={clsx(
                          "w-4 h-4 rounded-md border flex items-center justify-center shrink-0",
                          isChecked ? "border-restro-green bg-restro-green text-white" : "border-gray-400"
                        )}>
                          {isChecked && <IconCheck size={10} stroke={3} />}
                        </div>
                        <span className="text-xs truncate">{addon.title}</span>
                      </div>
                      <span className="text-xs font-extrabold shrink-0 ml-1">
                        +{currency}{Number(addon.price).toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 3: Special Kitchen Instructions & Quick Presets */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
              <IconNote size={14} stroke={iconStroke} />
              <span>{t('pos.notes', 'Kitchen Instructions')}</span>
            </span>

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
                      "text-[11px] font-semibold px-2.5 py-1 rounded-xl border transition active:scale-95 cursor-pointer touch-manipulation",
                      isActive
                        ? "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 font-bold"
                        : "bg-restro-gray border-restro-border-green text-gray-500 hover:text-restro-text"
                    )}
                  >
                    {isActive ? `✓ ${note}` : `+ ${note}`}
                  </button>
                );
              })}
            </div>

            {/* Custom Notes Input */}
            <input
              type="text"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder={t('pos.notes_placeholder', 'Custom notes (e.g. less salt, warm water)...')}
              className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-restro-border-green bg-background text-restro-text focus:outline-restro-green shadow-xs"
            />
          </div>

        </div>

        {/* Sticky Action Footer: Quantity Stepper + Add Button */}
        <div className="p-4 border-t border-restro-border-green bg-restro-gray/40 flex items-center gap-3 shrink-0">
          
          {/* Quantity Stepper (Min 48px touch height) */}
          <div className="flex items-center bg-background border border-restro-border-green rounded-2xl p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 rounded-xl bg-restro-gray hover:bg-restro-button-hover text-restro-text flex items-center justify-center font-bold active:scale-95 cursor-pointer touch-manipulation"
              title="Decrease quantity"
            >
              <IconMinus size={16} stroke={iconStroke} />
            </button>
            <span className="w-10 text-center font-extrabold text-sm text-restro-text">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 rounded-xl bg-restro-gray hover:bg-restro-button-hover text-restro-text flex items-center justify-center font-bold active:scale-95 cursor-pointer touch-manipulation"
              title="Increase quantity"
            >
              <IconPlus size={16} stroke={iconStroke} />
            </button>
          </div>

          {/* Add to Order Button */}
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 min-h-[48px] px-4 py-3 rounded-2xl bg-restro-green hover:bg-restro-green-button-hover text-white font-extrabold text-sm flex items-center justify-between shadow-md active:scale-[0.98] transition cursor-pointer touch-manipulation"
          >
            <span>{t('pos.add_to_order', 'Add to Order')}</span>
            <span className="px-2.5 py-1 rounded-xl bg-white/20 text-xs font-mono font-black">
              {currency}{totalPrice.toFixed(2)}
            </span>
          </button>

        </div>
      </div>
    </div>
  );
}
