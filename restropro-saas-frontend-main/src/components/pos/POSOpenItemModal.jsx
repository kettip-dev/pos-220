import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconX, IconBackspace } from '@tabler/icons-react';
import { clsx } from 'clsx';
import { toast } from 'react-hot-toast';
import { iconStroke } from '../../config/config';

/**
 * Open item: sell something that is not on the menu (custom name + price),
 * optionally routed to a kitchen station. Price is typed on a touch numpad.
 */
export default function POSOpenItemModal({ isOpen, onClose, onAdd, stations = [], currency = '' }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [priceText, setPriceText] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [stationId, setStationId] = useState(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setPriceText('');
      setQuantity(1);
      setStationId(null);
      setNotes('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const press = (key) => {
    setPriceText((prev) => {
      if (key === 'back') return prev.slice(0, -1);
      if (key === 'clear') return '';
      if (key === '.' && prev.includes('.')) return prev;
      const next = prev === '0' && key !== '.' ? key : prev + key;
      const [, decimals = ''] = next.split('.');
      if (decimals.length > 2) return prev;
      if (next.length > 9) return prev;
      return next;
    });
  };

  const price = Number(priceText) || 0;

  const handleAdd = () => {
    const name = title.trim();
    if (!name) {
      toast.error(t('pos_ops.open_item_name_required', 'Enter a name'));
      return;
    }
    if (price < 0) return;
    onAdd?.({ title: name, price, quantity, stationId, notes: notes.trim() || null });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('pos_ops.open_item', 'Open item')}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-background text-foreground rounded-t-3xl sm:rounded-3xl shadow-2xl border border-restro-border-green flex flex-col max-h-[95vh] overflow-hidden"
      >
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-restro-border-green/80">
          <div>
            <h3 className="text-base font-black text-restro-text">{t('pos_ops.open_item', 'Open item')}</h3>
            <p className="text-[11px] text-gray-500">{t('pos_ops.open_item_hint', 'Sell something that is not on the menu')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            className="min-h-[42px] min-w-[42px] rounded-xl flex items-center justify-center hover:bg-restro-gray active:scale-95 cursor-pointer"
          >
            <IconX size={20} stroke={iconStroke} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder={t('pos_ops.open_item_name', 'Item name (e.g. Birthday cake service)')}
            className="w-full min-h-[46px] px-3 rounded-xl border border-restro-border-green bg-restro-gray/30 text-sm font-semibold outline-none focus:ring-2 focus:ring-restro-green/40"
          />

          <div className="rounded-2xl bg-restro-gray/40 border border-restro-border-green px-4 py-3 text-right">
            <span className="text-xs text-gray-500 mr-2">{t('pos_ops.price', 'Price')}</span>
            <span className="text-3xl font-black tabular-nums">
              {currency}
              {priceText || '0'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                className="min-h-[52px] rounded-xl border border-restro-border-green bg-white dark:bg-slate-900 text-lg font-black active:scale-95 transition cursor-pointer flex items-center justify-center"
                aria-label={k === 'back' ? t('pos_ops.backspace', 'Delete digit') : k}
              >
                {k === 'back' ? <IconBackspace size={20} /> : k}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">{t('pos_ops.quantity', 'Quantity')}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="min-h-[42px] min-w-[42px] rounded-xl border border-restro-border-green font-black active:scale-95 cursor-pointer"
              >
                −
              </button>
              <span className="w-8 text-center font-black tabular-nums">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                className="min-h-[42px] min-w-[42px] rounded-xl border border-restro-border-green font-black active:scale-95 cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {stations.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-gray-500">{t('pos_ops.send_to_station', 'Kitchen station')}</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setStationId(null)}
                  className={clsx(
                    'min-h-[42px] px-3 rounded-full border text-xs font-bold active:scale-95 cursor-pointer',
                    stationId === null ? 'bg-[#0D233A] text-white border-[#0D233A]' : 'border-restro-border-green'
                  )}
                >
                  {t('pos_ops.no_station', 'None')}
                </button>
                {stations.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStationId(st.id)}
                    className={clsx(
                      'min-h-[42px] px-3 rounded-full border text-xs font-bold active:scale-95 cursor-pointer flex items-center gap-1.5',
                      stationId === st.id ? 'bg-[#0D233A] text-white border-[#0D233A]' : 'border-restro-border-green'
                    )}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color || '#94a3b8' }} />
                    {st.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={200}
            placeholder={t('pos_ops.kitchen_note', 'Kitchen note (optional)')}
            className="w-full min-h-[42px] px-3 rounded-xl border border-restro-border-green bg-restro-gray/30 text-sm outline-none focus:ring-2 focus:ring-restro-green/40"
          />
        </div>

        <footer className="px-5 py-3 border-t border-restro-border-green/80">
          <button
            type="button"
            onClick={handleAdd}
            className="w-full min-h-[52px] rounded-xl bg-[#2CA01C] hover:bg-[#248417] text-white font-black text-sm active:scale-95 transition cursor-pointer"
          >
            {t('pos_ops.add_to_ticket', 'Add to ticket')} · {currency}
            {(price * quantity).toFixed(2)}
          </button>
        </footer>
      </div>
    </div>
  );
}
