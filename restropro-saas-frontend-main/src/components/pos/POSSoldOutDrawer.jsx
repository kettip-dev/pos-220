import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconX, IconBan, IconMinus, IconPlus, IconRotate, IconSearch, IconInfinity } from '@tabler/icons-react';
import { clsx } from 'clsx';
import { toast } from 'react-hot-toast';
import { iconStroke } from '../../config/config';
import { displayName } from '../../helpers/MenuLanguageHelper';
import { updateMenuAvailability, resetMenuAvailability } from '../../controllers/pos.controller';

/**
 * 86 board: mark items sold out or cap the portions left for this shift.
 * Opens on a single item (long-press a tile) or as the full board.
 */
export default function POSSoldOutDrawer({ isOpen, onClose, menuItems = [], focusItemId = null, onItemsChanged }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setShowAll(Boolean(focusItemId));
    }
  }, [isOpen, focusItemId]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = (menuItems || []).filter((i) => i.is_enabled);
    if (focusItemId) {
      const focused = items.find((i) => String(i.id) === String(focusItemId));
      items = focused ? [focused, ...items.filter((i) => i !== focused)] : items;
    }
    if (!showAll && !q) {
      items = items.filter((i) => Number(i.is_sold_out) === 1 || (i.stock_limit !== null && i.stock_limit !== undefined));
    }
    if (q) items = items.filter((i) => `${i.title} ${displayName(i)}`.toLowerCase().includes(q));
    return items;
  }, [menuItems, query, showAll, focusItemId]);

  const flaggedCount = (menuItems || []).filter(
    (i) => Number(i.is_sold_out) === 1 || (i.stock_limit !== null && i.stock_limit !== undefined)
  ).length;

  if (!isOpen) return null;

  const save = async (item, payload) => {
    try {
      setBusyId(item.id);
      const res = await updateMenuAvailability(item.id, payload);
      if (res.status === 200) onItemsChanged?.([res.data.item]);
    } catch (error) {
      toast.error(error?.response?.data?.message || t('pos_ops.save_failed', 'Could not save'));
    } finally {
      setBusyId(null);
    }
  };

  const handleResetAll = async () => {
    try {
      await resetMenuAvailability('all');
      onItemsChanged?.(null);
      toast.success(t('pos_ops.all_back_on_menu', 'All items are back on the menu'));
    } catch (error) {
      toast.error(error?.response?.data?.message || t('pos_ops.save_failed', 'Could not save'));
    }
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('pos_ops.sold_out_board', '86 board')}
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] bg-background text-foreground border-l border-restro-border-green shadow-2xl flex flex-col overflow-hidden select-none"
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-restro-border-green/80 bg-restro-gray/40 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-red-500/15 text-red-600 flex items-center justify-center shrink-0">
              <IconBan size={22} stroke={iconStroke} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-restro-text leading-tight truncate">
                {t('pos_ops.sold_out_board', '86 board')}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {t('pos_ops.sold_out_hint', 'Mark items sold out or set how many portions are left')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            className="min-h-[42px] min-w-[42px] rounded-xl flex items-center justify-center hover:bg-restro-gray active:scale-95 transition cursor-pointer"
          >
            <IconX size={20} stroke={iconStroke} />
          </button>
        </header>

        <div className="px-5 pt-3 pb-2 flex flex-col gap-2 shrink-0">
          <div className="relative">
            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('pos_ops.search_items', 'Search items')}
              className="w-full min-h-[42px] pl-9 pr-3 rounded-xl border border-restro-border-green bg-restro-gray/30 text-sm outline-none focus:ring-2 focus:ring-restro-green/40"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className={clsx(
                'min-h-[42px] px-3.5 rounded-full text-xs font-bold border active:scale-95 transition cursor-pointer',
                !showAll ? 'bg-[#0D233A] text-white border-[#0D233A]' : 'border-restro-border-green text-restro-text'
              )}
            >
              {t('pos_ops.flagged', 'Sold out & limited')} ({flaggedCount})
            </button>
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className={clsx(
                'min-h-[42px] px-3.5 rounded-full text-xs font-bold border active:scale-95 transition cursor-pointer',
                showAll ? 'bg-[#0D233A] text-white border-[#0D233A]' : 'border-restro-border-green text-restro-text'
              )}
            >
              {t('pos_ops.all_items', 'All items')}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-2">
          {list.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-10">
              {t('pos_ops.nothing_sold_out', 'Nothing is sold out. Long-press any item to 86 it.')}
            </p>
          )}
          {list.map((item) => {
            const soldOut = Number(item.is_sold_out) === 1;
            const limited = item.stock_limit !== null && item.stock_limit !== undefined;
            const count = limited ? Number(item.stock_limit) : null;
            const busy = busyId === item.id;
            const focused = String(item.id) === String(focusItemId);
            return (
              <div
                key={item.id}
                className={clsx(
                  'rounded-2xl border p-3 flex flex-col gap-2.5 transition',
                  focused ? 'border-restro-green ring-2 ring-restro-green/30' : 'border-restro-border-green',
                  soldOut && 'bg-red-50/70 dark:bg-red-950/20',
                  busy && 'opacity-60 pointer-events-none'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-restro-text truncate">{displayName(item)}</p>
                    <p className={clsx('text-[11px] font-semibold', soldOut ? 'text-red-600' : limited ? 'text-amber-600' : 'text-gray-500')}>
                      {soldOut
                        ? t('pos_ops.sold_out', 'Sold out')
                        : limited
                        ? t('pos_ops.n_left', '{{count}} left', { count })
                        : t('pos_ops.available', 'Available')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => save(item, { isSoldOut: !soldOut, ...(soldOut && limited && count === 0 ? { stockLimit: null } : {}) })}
                    className={clsx(
                      'min-h-[42px] px-4 rounded-xl text-xs font-black active:scale-95 transition cursor-pointer shrink-0',
                      soldOut ? 'bg-restro-green text-white' : 'bg-red-600 text-white'
                    )}
                  >
                    {soldOut ? t('pos_ops.back_on_menu', 'Back on menu') : t('pos_ops.mark_sold_out', '86 it')}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-gray-500">{t('pos_ops.portions_left', 'Portions left')}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={t('pos_ops.fewer', 'Fewer')}
                      disabled={!limited || count <= 0}
                      onClick={() => save(item, { stockLimit: Math.max(0, count - 1) })}
                      className="min-h-[42px] min-w-[42px] rounded-xl border border-restro-border-green flex items-center justify-center active:scale-95 disabled:opacity-40 cursor-pointer"
                    >
                      <IconMinus size={16} />
                    </button>
                    <input
                      key={`${item.id}-${count}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      defaultValue={limited ? count : ''}
                      placeholder="∞"
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        const next = raw === '' ? null : Math.max(0, parseInt(raw, 10) || 0);
                        if (next !== count) save(item, { stockLimit: next });
                      }}
                      className="w-16 min-h-[42px] rounded-xl border border-restro-border-green text-center font-bold tabular-nums bg-transparent outline-none focus:ring-2 focus:ring-restro-green/40"
                    />
                    <button
                      type="button"
                      aria-label={t('pos_ops.more', 'More')}
                      onClick={() => save(item, { stockLimit: (limited ? count : 0) + 1 })}
                      className="min-h-[42px] min-w-[42px] rounded-xl border border-restro-border-green flex items-center justify-center active:scale-95 cursor-pointer"
                    >
                      <IconPlus size={16} />
                    </button>
                    <button
                      type="button"
                      title={t('pos_ops.unlimited', 'Unlimited')}
                      aria-label={t('pos_ops.unlimited', 'Unlimited')}
                      disabled={!limited}
                      onClick={() => save(item, { stockLimit: null, isSoldOut: false })}
                      className="min-h-[42px] min-w-[42px] rounded-xl border border-restro-border-green flex items-center justify-center active:scale-95 disabled:opacity-40 cursor-pointer"
                    >
                      <IconInfinity size={16} />
                    </button>
                  </div>
                </div>

                {(soldOut || limited) && (
                  <label className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300 min-h-[32px] cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-restro-green"
                      checked={Number(item.sold_out_auto_reset ?? 1) === 1}
                      onChange={(e) => save(item, { autoReset: e.target.checked })}
                    />
                    {t('pos_ops.auto_reset', 'Put back on the menu automatically next business day')}
                  </label>
                )}
              </div>
            );
          })}
        </div>

        {flaggedCount > 0 && (
          <footer className="px-5 py-3 border-t border-restro-border-green/80 shrink-0">
            <button
              type="button"
              onClick={handleResetAll}
              className="w-full min-h-[48px] rounded-xl bg-restro-green text-white font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
            >
              <IconRotate size={18} stroke={iconStroke} />
              {t('pos_ops.reset_all', 'Put everything back on the menu')}
            </button>
          </footer>
        )}
      </aside>
    </>
  );
}
