import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IconX,
  IconClipboardList,
  IconTrash,
  IconArrowBackUp,
  IconClock,
  IconArmchair,
  IconClearAll,
  IconToolsKitchen2,
  IconShoppingBag,
  IconTruckDelivery,
  IconUser,
  IconDeviceFloppy,
  IconCheck,
} from '@tabler/icons-react';
import { clsx } from 'clsx';
import { iconStroke } from '../../config/config';

export default function POSDraftsDrawer({
  isOpen,
  onClose,
  drafts = [],
  onRestoreDraft,
  onDeleteDraft,
  onClearAllDrafts,
  currency = '$',
  exchangeRateUsdToKhr = 4100,
  activeCartItemsCount = 0,
  onHoldCurrentAndRestore,
}) {
  const { t } = useTranslation();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  if (!isOpen) return null;

  const isBaseKHR = currency === '៛' || String(currency).toUpperCase() === 'KHR';
  const rate = Number(exchangeRateUsdToKhr) || 4100;

  const handleCardClick = (draft, index) => {
    if (activeCartItemsCount > 0 && onHoldCurrentAndRestore) {
      // Seamless auto-hold active cart and restore selected draft (Zero data loss)
      onHoldCurrentAndRestore(draft, index);
    } else {
      // Cart is empty, restore directly
      onRestoreDraft(draft, index);
      onClose();
    }
  };

  const formatDualCurrency = (amountVal) => {
    const val = Number(amountVal) || 0;
    if (isBaseKHR) {
      const primary = `៛${Math.round(val).toLocaleString()}`;
      const secondary = `$${(val / rate).toFixed(2)}`;
      return { primary, secondary };
    } else {
      const primary = `$${val.toFixed(2)}`;
      const secondary = `៛${Math.round(val * rate).toLocaleString()}`;
      return { primary, secondary };
    }
  };

  const getDiningBadge = (draft) => {
    const opt = (draft.diningOption || 'dinein').toLowerCase();
    if (opt === 'takeaway') {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center gap-1.5 border border-blue-500/30 shrink-0">
          <IconShoppingBag size={14} stroke={iconStroke} />
          <span>{t('pos.takeaway', 'Takeaway')}</span>
        </span>
      );
    }
    if (opt === 'delivery') {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center gap-1.5 border border-purple-500/30 shrink-0">
          <IconTruckDelivery size={14} stroke={iconStroke} />
          <span>{t('pos.delivery', 'Delivery')}</span>
        </span>
      );
    }
    // Default: Dine-In
    return (
      <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 border border-emerald-500/30 shrink-0">
        <IconArmchair size={14} stroke={iconStroke} />
        <span className="truncate">{draft.tableTitle || (draft.tableId ? `Table ${draft.tableId}` : t('pos.dinein', 'Dine-In'))}</span>
      </span>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      />

      {/* Slide-over Drawer Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('pos.drafts', 'Held Orders & Drafts')}
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] md:w-[530px] bg-background text-foreground border-l border-restro-border-green shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 select-none"
      >
        {/* Top Header */}
        <header className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-restro-border-green/80 bg-restro-gray/40 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-restro-green/15 text-restro-green flex items-center justify-center font-bold shrink-0 shadow-xs">
              <IconClipboardList size={22} stroke={iconStroke} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-restro-text leading-tight truncate">
                  {t('pos.drafts', 'Held Orders & Drafts')}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-restro-green/15 text-restro-green border border-restro-green/30 shrink-0">
                  {drafts.length}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {activeCartItemsCount > 0
                  ? t('pos.drafts_autohold_hint', 'Tapping a card auto-holds active cart and resumes draft')
                  : t('pos.drafts_subtitle', '1-tap to resume temporarily held tickets')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {drafts.length > 0 && !showClearConfirm && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                title={t('pos.clear_all_drafts', 'Clear All Drafts')}
                className="min-h-[42px] px-3.5 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
              >
                <IconClearAll size={16} stroke={iconStroke} />
                <span className="hidden sm:inline">{t('pos.clear_all', 'Clear All')}</span>
              </button>
            )}

            {showClearConfirm && (
              <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-xl p-1 animate-in fade-in duration-100">
                <button
                  type="button"
                  onClick={() => {
                    onClearAllDrafts();
                    setShowClearConfirm(false);
                  }}
                  className="min-h-[38px] px-2.5 rounded-lg bg-red-500 text-white text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
                >
                  <IconCheck size={14} stroke={iconStroke} />
                  <span>{t('common.confirm', 'Yes, Clear')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="min-h-[38px] px-2 rounded-lg bg-restro-gray text-gray-500 text-xs font-bold hover:text-restro-text transition active:scale-95 cursor-pointer"
                >
                  <IconX size={14} stroke={iconStroke} />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 min-h-[42px] min-w-[42px] rounded-xl bg-restro-gray hover:bg-restro-button-hover border border-restro-border-green flex items-center justify-center text-restro-text transition active:scale-95 cursor-pointer shadow-xs"
              title={t('common.close', 'Close (Esc)')}
            >
              <IconX size={18} stroke={iconStroke} />
            </button>
          </div>
        </header>

        {/* Drafts List Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3.5 scrollbar-thin">
          {drafts.map((draft, index) => {
            const itemCount = draft.cart?.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0) || draft.cart?.length || 0;
            const itemsPreview = draft.cart
              ?.map((item) => `${item.quantity || 1}x ${item.title || item.name || 'Item'}`)
              .join(', ');

            const { primary, secondary } = formatDualCurrency(draft.payableTotal || draft.total || 0);

            return (
              <div
                key={index}
                onClick={() => handleCardClick(draft, index)}
                className="group relative rounded-2xl p-4 sm:p-4.5 border border-restro-border-green bg-restro-gray/40 hover:bg-restro-gray/80 hover:border-restro-green transition-all duration-150 cursor-pointer shadow-xs flex flex-col justify-between gap-3 active:scale-[0.99]"
              >
                {/* Top Row: Dining Badge + Title + Dual Currency */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    {getDiningBadge(draft)}

                    <h4 className="text-sm sm:text-base font-black text-restro-text truncate leading-tight group-hover:text-restro-green transition-colors">
                      {draft.nameRef}
                    </h4>

                    {draft.customer?.label && (
                      <span className="px-2 py-0.5 rounded-lg bg-restro-gray border border-restro-border-green text-[11px] text-gray-500 font-medium flex items-center gap-1">
                        <IconUser size={12} stroke={iconStroke} />
                        <span className="truncate max-w-[120px]">{draft.customer.label.split(' - ')[0]}</span>
                      </span>
                    )}
                  </div>

                  {/* Dual Currency Stack */}
                  <div className="flex flex-col items-end shrink-0">
                    <span className="font-mono text-sm sm:text-base font-black text-restro-green leading-tight">
                      {primary}
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                      {secondary}
                    </span>
                  </div>
                </div>

                {/* Middle Row: Item count, timestamp & preview */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 font-semibold">
                    <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 font-bold text-restro-text">
                      {itemCount} {itemCount === 1 ? t('pos.item', 'item') : t('pos.items', 'items')}
                    </span>
                    <span className="flex items-center gap-1 text-gray-400">
                      <IconClock size={13} stroke={iconStroke} />
                      {draft.date}
                    </span>
                  </div>

                  {itemsPreview && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed font-medium bg-background/50 dark:bg-zinc-900/40 rounded-xl px-3 py-1.5 border border-restro-border-green/40">
                      {itemsPreview}
                    </p>
                  )}
                </div>

                {/* Bottom Action Tray */}
                <div className="pt-2 border-t border-restro-border-green/50 flex items-center justify-between text-xs gap-2">
                  <span className="text-[11px] font-bold text-restro-green flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <IconArrowBackUp size={14} stroke={iconStroke} />
                    <span>
                      {activeCartItemsCount > 0
                        ? t('pos.tap_to_swap', 'Tap to swap with active cart')
                        : t('pos.tap_to_restore', 'Tap card to resume')}
                    </span>
                  </span>

                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleCardClick(draft, index)}
                      className="min-h-[38px] px-3.5 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-2xs cursor-pointer"
                    >
                      <IconArrowBackUp size={15} stroke={iconStroke} />
                      <span>{t('pos.restore', 'Restore')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteDraft(index)}
                      className="min-h-[38px] w-9 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition active:scale-95 cursor-pointer shadow-2xs"
                      title={t('pos.delete', 'Delete')}
                    >
                      <IconTrash size={16} stroke={iconStroke} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {drafts.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
              <div className="w-16 h-16 rounded-full bg-restro-gray border border-restro-border-green flex items-center justify-center text-gray-400 mb-3 shadow-inner">
                <IconClipboardList size={28} stroke={1.5} />
              </div>
              <h4 className="text-base font-bold text-restro-text">
                {t('pos.no_drafts', 'No Held Orders in Drafts')}
              </h4>
              <p className="text-xs text-gray-400 mt-1 max-w-[280px] leading-relaxed">
                {t(
                  'pos.drafts_empty_hint',
                  'When a customer pauses or steps away, tap [ 💾 Draft ] in the cart to hold their ticket here.'
                )}
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
