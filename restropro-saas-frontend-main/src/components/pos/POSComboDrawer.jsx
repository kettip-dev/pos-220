import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconX, IconCheck, IconMinus, IconPlus } from '@tabler/icons-react';
import { clsx } from 'clsx';
import { iconStroke } from '../../config/config';
import { displayName } from '../../helpers/MenuLanguageHelper';
import { getImageURL } from '../../helpers/ImageHelper';

/**
 * Combo builder: pick the items of each choice group ("Pick 1 drink").
 * Group min/max rules gate the Add button; extras add to the combo price.
 */
export default function POSComboDrawer({ isOpen, onClose, combo, currency = '', onAdd }) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState({});
  const [quantity, setQuantity] = useState(1);

  const groups = combo?.combo_groups || [];

  useEffect(() => {
    if (!isOpen || !combo) return;
    // Pre-select the only option of single-option groups.
    const initial = {};
    (combo.combo_groups || []).forEach((g) => {
      const available = (g.options || []).filter((o) => Number(o.is_sold_out) !== 1 && o.is_enabled !== 0);
      initial[g.id] = available.length === 1 && Number(g.min_select) >= 1 ? [available[0].id] : [];
    });
    setPicked(initial);
    setQuantity(1);
  }, [isOpen, combo?.id]);

  const extras = useMemo(
    () =>
      groups.reduce(
        (sum, g) => sum + (picked[g.id] || []).reduce((s, oid) => s + Number(g.options.find((o) => o.id === oid)?.extra_price || 0), 0),
        0
      ),
    [groups, picked]
  );

  if (!isOpen || !combo) return null;

  const unitPrice = Number(combo.price || 0) + extras;
  const groupDone = (g) => {
    const n = (picked[g.id] || []).length;
    return n >= Number(g.min_select) && n <= Number(g.max_select);
  };
  const ready = groups.every(groupDone);

  const toggle = (g, option) => {
    if (Number(option.is_sold_out) === 1) return;
    setPicked((prev) => {
      const current = prev[g.id] || [];
      if (current.includes(option.id)) return { ...prev, [g.id]: current.filter((id) => id !== option.id) };
      if (Number(g.max_select) === 1) return { ...prev, [g.id]: [option.id] };
      if (current.length >= Number(g.max_select)) return prev;
      return { ...prev, [g.id]: [...current, option.id] };
    });
  };

  const handleAdd = () => {
    if (!ready) return;
    const chosen = groups.flatMap((g) =>
      (picked[g.id] || []).map((oid) => {
        const o = g.options.find((x) => x.id === oid);
        return {
          option_id: o.id,
          menu_item_id: o.menu_item_id,
          title: displayName(o),
          variant_title: o.variant_title || null,
          extra_price: Number(o.extra_price || 0),
          group_title: g.title,
          kitchen_station_id: o.kitchen_station_id || null,
          kitchen_station_name: o.kitchen_station_name || null,
        };
      })
    );
    onAdd?.({
      ...combo,
      price: Math.round(unitPrice * 100) / 100,
      quantity,
      recipeItems: [],
      addons: [],
      variants: [],
      combo: { options: chosen.map((c) => c.option_id), components: chosen },
    });
    onClose();
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={displayName(combo)}
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-background text-foreground border-l border-restro-border-green shadow-2xl flex flex-col overflow-hidden select-none"
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-restro-border-green/80 bg-restro-gray/40 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-black text-restro-text truncate">{displayName(combo)}</h3>
            <p className="text-[11px] text-gray-500">
              {t('pos_ops.combo', 'Combo')} · {currency}
              {Number(combo.price || 0).toFixed(2)}
            </p>
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

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {groups.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">{t('pos_ops.combo_not_set_up', 'This combo has no choices yet. Set it up in Settings → Combos.')}</p>
          )}
          {groups.map((g) => {
            const count = (picked[g.id] || []).length;
            const rule =
              Number(g.min_select) === Number(g.max_select)
                ? t('pos_ops.choose_n', 'Choose {{count}}', { count: g.max_select })
                : t('pos_ops.choose_range', 'Choose {{min}}–{{max}}', { min: g.min_select, max: g.max_select });
            return (
              <section key={g.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-sm text-restro-text">{g.title}</h4>
                  <span
                    className={clsx(
                      'text-[11px] font-bold px-2 py-0.5 rounded-full',
                      groupDone(g) ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    )}
                  >
                    {rule} · {count}/{g.max_select}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(g.options || []).map((o) => {
                    const selected = (picked[g.id] || []).includes(o.id);
                    const soldOut = Number(o.is_sold_out) === 1;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        disabled={soldOut}
                        onClick={() => toggle(g, o)}
                        className={clsx(
                          'relative min-h-[64px] rounded-2xl border-2 p-2.5 text-left flex items-center gap-2.5 active:scale-95 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
                          selected ? 'border-[#2CA01C] bg-emerald-50 dark:bg-emerald-950/30' : 'border-restro-border-green'
                        )}
                      >
                        {o.image ? (
                          <img src={getImageURL(o.image)} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" loading="lazy" />
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-bold leading-tight line-clamp-2">{displayName(o)}</span>
                          {o.variant_title && <span className="block text-[10px] text-gray-500">{o.variant_title}</span>}
                          <span className="block text-[11px] font-semibold text-gray-500">
                            {soldOut
                              ? t('pos_ops.sold_out', 'Sold out')
                              : Number(o.extra_price) > 0
                              ? `+${currency}${Number(o.extra_price).toFixed(2)}`
                              : t('pos_ops.included', 'Included')}
                          </span>
                        </span>
                        {selected && (
                          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#2CA01C] text-white flex items-center justify-center">
                            <IconCheck size={13} stroke={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <footer className="px-5 py-3 border-t border-restro-border-green/80 shrink-0 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label={t('pos_ops.fewer', 'Fewer')}
              className="min-h-[48px] min-w-[48px] rounded-xl border border-restro-border-green flex items-center justify-center active:scale-95 cursor-pointer"
            >
              <IconMinus size={18} />
            </button>
            <span className="w-8 text-center font-black tabular-nums">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              aria-label={t('pos_ops.more', 'More')}
              className="min-h-[48px] min-w-[48px] rounded-xl border border-restro-border-green flex items-center justify-center active:scale-95 cursor-pointer"
            >
              <IconPlus size={18} />
            </button>
          </div>
          <button
            type="button"
            disabled={!ready}
            onClick={handleAdd}
            className="flex-1 min-h-[52px] rounded-xl bg-[#2CA01C] hover:bg-[#248417] disabled:bg-gray-300 dark:disabled:bg-slate-700 text-white font-black text-sm active:scale-95 transition cursor-pointer disabled:cursor-not-allowed"
          >
            {ready ? `${t('pos_ops.add_to_ticket', 'Add to ticket')} · ${currency}${(unitPrice * quantity).toFixed(2)}` : t('pos_ops.finish_choices', 'Finish the choices')}
          </button>
        </footer>
      </aside>
    </>
  );
}
