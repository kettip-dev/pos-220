import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { IconX, IconCheck, IconSettings } from '@tabler/icons-react';

/**
 * Pick the delivery app (Grab, Foodpanda, ...) for this ticket and type the
 * app's order code. Calls onConfirm with the app details the POS needs.
 */
export default function DeliveryAppPickerModal({ isOpen, platforms = [], selected = null, onClose, onConfirm }) {
  const { t } = useTranslation();
  const [appId, setAppId] = useState(null);
  const [ref, setRef] = useState('');
  const refInput = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setAppId(selected?.id || (platforms.length === 1 ? platforms[0].id : null));
    setRef(selected?.ref || '');
  }, [isOpen, selected, platforms]);

  useEffect(() => {
    if (isOpen && appId) refInput.current?.focus();
  }, [isOpen, appId]);

  if (!isOpen) return null;

  const app = platforms.find((p) => p.id === appId);

  const confirm = (e) => {
    e?.preventDefault();
    if (!app) return;
    onConfirm({
      id: app.id,
      name: app.name,
      color: app.color,
      markup: Number(app.markup_percent || 0),
      paymentTypeId: app.payment_type_id || null,
      ref: ref.trim().toUpperCase().slice(0, 64),
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose}>
      <form
        onSubmit={confirm}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#0D1829] p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">{t('delivery_apps.pick_app', 'Pick delivery app')}</h3>
          <button type="button" onClick={onClose} className="flex h-[42px] w-[42px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95">
            <IconX size={20} />
          </button>
        </div>

        {platforms.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">
            <p>{t('delivery_apps.none_on_pos', 'No delivery apps are set up yet.')}</p>
            <Link to="/dashboard/settings/delivery-apps" className="mt-3 inline-flex min-h-[42px] items-center gap-1.5 rounded-xl px-3 font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-500/10">
              <IconSettings size={16} /> {t('delivery_apps.set_up', 'Set up delivery apps')}
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {platforms.map((p) => {
                const on = p.id === appId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setAppId(p.id)}
                    aria-pressed={on}
                    className={clsx(
                      'relative flex min-h-[64px] flex-col items-start justify-center rounded-2xl border-2 px-3 py-2 text-left transition active:scale-95',
                      on ? 'border-transparent text-white shadow-md' : 'border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                    )}
                    style={on ? { background: p.color || '#0f766e' } : undefined}
                  >
                    {!on && <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r" style={{ background: p.color || '#64748b' }} />}
                    <span className="text-base font-black leading-tight">{p.name}</span>
                    {Number(p.markup_percent) > 0 && (
                      <span className={clsx('text-xs font-bold', on ? 'text-white/90' : 'text-pink-600 dark:text-pink-400')}>
                        {t('delivery_apps.prices_plus', 'Prices +{{n}}%', { n: Number(p.markup_percent) })}
                      </span>
                    )}
                    {on && <IconCheck size={18} className="absolute right-2 top-2" />}
                  </button>
                );
              })}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                {t('delivery_apps.order_code', "App's order code")}
              </label>
              <input
                ref={refInput}
                value={ref}
                onChange={(e) => setRef(e.target.value.toUpperCase())}
                maxLength={64}
                placeholder="GF-123"
                autoCapitalize="characters"
                className="w-full h-[52px] px-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-lg font-bold tracking-wider text-slate-900 dark:text-white outline-none focus:border-teal-600"
              />
              <p className="mt-1 text-xs text-slate-500">{t('delivery_apps.order_code_hint', 'Printed on the kitchen ticket so the rider can match the bag.')}</p>
            </div>

            <button
              type="submit"
              disabled={!app}
              className="flex h-[52px] w-full items-center justify-center rounded-2xl bg-[#2CA01C] text-base font-bold text-white hover:bg-[#248417] active:scale-95 disabled:opacity-50"
            >
              {t('delivery_apps.use_app', 'Use {{name}}', { name: app?.name || '' })}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
