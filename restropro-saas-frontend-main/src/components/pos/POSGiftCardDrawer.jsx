import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconX, IconGift, IconSearch, IconCheck } from '@tabler/icons-react';
import { clsx } from 'clsx';
import { toast } from 'react-hot-toast';
import { iconStroke } from '../../config/config';
import { issueGiftCard, lookupGiftCard } from '../../controllers/pos.controller';

const QUICK_AMOUNTS = [10, 20, 25, 50, 100];

/**
 * Gift cards at the counter: sell a new card or top one up (money goes into
 * the drawer, not sales), and check a card's balance and history.
 */
export default function POSGiftCardDrawer({ isOpen, onClose, paymentTypes = [], customer = null, currency = '', onIssued }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('sell');
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentTypeId, setPaymentTypeId] = useState(null);
  const [linkCustomer, setLinkCustomer] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [issued, setIssued] = useState(null);
  const [lookupCode, setLookupCode] = useState('');
  const [card, setCard] = useState(null);

  const tenders = (paymentTypes || []).filter((p) => Number(p.is_gift_card) !== 1 && p.is_active !== 0);

  useEffect(() => {
    if (!isOpen) return;
    setTab('sell');
    setCode('');
    setAmount('');
    setPaymentTypeId(tenders[0]?.id || null);
    setLinkCustomer(true);
    setIssued(null);
    setLookupCode('');
    setCard(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleIssue = async () => {
    const value = Number(amount);
    if (!(value > 0)) return toast.error(t('pos_ops.enter_amount', 'Enter an amount'));
    if (!paymentTypeId) return toast.error(t('pos_ops.choose_tender', 'Choose how it is paid'));
    try {
      setIsBusy(true);
      const res = await issueGiftCard({
        code: code.trim() || undefined,
        amount: value,
        paymentTypeId,
        customerPhone: linkCustomer && customer?.phone ? customer.phone : undefined,
      });
      setIssued(res.data.card);
      onIssued?.(res.data.card);
      toast.success(
        res.data.card.type === 'RELOAD'
          ? t('pos_ops.gift_card_reloaded', 'Card topped up')
          : t('pos_ops.gift_card_issued', 'Gift card issued')
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || t('pos_ops.save_failed', 'Could not save'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleLookup = async () => {
    if (!lookupCode.trim()) return;
    try {
      setIsBusy(true);
      const res = await lookupGiftCard(lookupCode);
      setCard(res.data);
    } catch (error) {
      setCard(null);
      toast.error(error?.response?.data?.message || t('pos_ops.gift_card_not_found', 'Gift card not found'));
    } finally {
      setIsBusy(false);
    }
  };

  const money = (v) => `${currency}${Number(v || 0).toFixed(2)}`;

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('pos_ops.gift_cards', 'Gift cards')}
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-background text-foreground border-l border-restro-border-green shadow-2xl flex flex-col overflow-hidden select-none"
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-restro-border-green/80 bg-restro-gray/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pink-500/15 text-pink-600 flex items-center justify-center">
              <IconGift size={22} stroke={iconStroke} />
            </div>
            <h3 className="text-base sm:text-lg font-black text-restro-text">{t('pos_ops.gift_cards', 'Gift cards')}</h3>
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

        <div className="px-5 pt-3 shrink-0">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-restro-gray/60">
            {[
              ['sell', t('pos_ops.sell_or_top_up', 'Sell / top up')],
              ['balance', t('pos_ops.check_balance_tab', 'Check balance')],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={clsx(
                  'min-h-[42px] rounded-xl text-sm font-bold transition cursor-pointer',
                  tab === key ? 'bg-white dark:bg-slate-900 shadow-xs text-restro-text' : 'text-gray-500'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {tab === 'sell' && (issued ? (
            <div className="rounded-2xl border-2 border-dashed border-pink-400 p-5 text-center flex flex-col items-center gap-2">
              <IconCheck size={28} className="text-emerald-600" />
              <p className="text-xs uppercase tracking-wider font-bold text-gray-500">
                {issued.type === 'RELOAD' ? t('pos_ops.gift_card_reloaded', 'Card topped up') : t('pos_ops.gift_card_issued', 'Gift card issued')}
              </p>
              <p className="text-2xl font-black font-mono tracking-wider">{issued.display_code}</p>
              <p className="text-sm">{t('pos_ops.gift_card_balance', 'Balance {{amount}}', { amount: money(issued.balance) })}</p>
              <p className="text-[11px] text-gray-500">{t('pos_ops.write_code_hint', 'Write this number on the card or give the guest a printout.')}</p>
              <button
                type="button"
                onClick={() => {
                  setIssued(null);
                  setCode('');
                  setAmount('');
                }}
                className="mt-2 min-h-[42px] px-4 rounded-xl border border-restro-border-green text-sm font-bold active:scale-95 cursor-pointer"
              >
                {t('pos_ops.another_card', 'Another card')}
              </button>
            </div>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
                {t('pos_ops.card_number_optional', 'Card number (scan a physical card, or leave empty to create one)')}
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX"
                  className="min-h-[46px] px-3 rounded-xl border border-restro-border-green bg-restro-gray/30 text-sm font-mono outline-none focus:ring-2 focus:ring-restro-green/40"
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-gray-500">{t('pos_ops.amount', 'Amount')}</span>
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAmount(String(v))}
                      className={clsx(
                        'min-h-[46px] min-w-[64px] px-3 rounded-xl border text-sm font-black active:scale-95 cursor-pointer',
                        Number(amount) === v ? 'bg-pink-600 text-white border-pink-600' : 'border-restro-border-green'
                      )}
                    >
                      {currency}
                      {v}
                    </button>
                  ))}
                  <input
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={t('pos_ops.other_amount', 'Other')}
                    className="w-28 min-h-[46px] px-3 rounded-xl border border-restro-border-green text-sm font-bold bg-transparent outline-none focus:ring-2 focus:ring-restro-green/40"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-gray-500">{t('pos_ops.paid_with', 'Paid with')}</span>
                <div className="grid grid-cols-2 gap-2">
                  {tenders.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPaymentTypeId(p.id)}
                      className={clsx(
                        'min-h-[46px] px-3 rounded-xl border text-sm font-bold text-left active:scale-95 cursor-pointer',
                        paymentTypeId === p.id ? 'bg-[#0D233A] text-white border-[#0D233A]' : 'border-restro-border-green'
                      )}
                    >
                      {p.title}
                    </button>
                  ))}
                </div>
              </div>

              {customer?.phone && (
                <label className="flex items-center gap-2 text-sm min-h-[42px] cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-restro-green" checked={linkCustomer} onChange={(e) => setLinkCustomer(e.target.checked)} />
                  {t('pos_ops.link_card_to', 'Link to {{name}}', { name: customer.name || customer.phone })}
                </label>
              )}
            </>
          ))}

          {tab === 'balance' && (
            <>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus
                    value={lookupCode}
                    onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                    placeholder="XXXX-XXXX-XXXX"
                    className="w-full min-h-[46px] pl-9 pr-3 rounded-xl border border-restro-border-green bg-restro-gray/30 text-sm font-mono outline-none focus:ring-2 focus:ring-restro-green/40"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleLookup}
                  disabled={isBusy}
                  className="min-h-[46px] px-4 rounded-xl bg-[#0D233A] text-white text-sm font-bold active:scale-95 cursor-pointer disabled:opacity-60"
                >
                  {t('pos_ops.check_balance', 'Check')}
                </button>
              </div>
              {card && (
                <div className="rounded-2xl border border-restro-border-green p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black tracking-wider">{card.display_code}</span>
                    <span className={clsx('text-[11px] font-black px-2 py-0.5 rounded-full', card.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-rose-500/15 text-rose-700')}>
                      {card.status}
                    </span>
                  </div>
                  <p className="text-3xl font-black tabular-nums">{money(card.balance)}</p>
                  <p className="text-xs text-gray-500">
                    {t('pos_ops.initial_value', 'Issued at {{amount}}', { amount: money(card.initial_balance) })}
                    {card.customer_name ? ` · ${card.customer_name}` : ''}
                    {card.expires_at ? ` · ${t('pos_ops.expires', 'Expires')} ${String(card.expires_at).slice(0, 10)}` : ''}
                  </p>
                  <ul className="mt-2 divide-y divide-restro-border-green text-xs">
                    {(card.transactions || []).map((tx, i) => (
                      <li key={i} className="py-1.5 flex items-center justify-between gap-2">
                        <span className="font-bold">{tx.type}{tx.invoice_id ? ` · #${tx.invoice_id}` : ''}</span>
                        <span className="text-gray-500">{new Date(tx.created_at).toLocaleDateString()}</span>
                        <span className={clsx('font-mono font-bold', Number(tx.amount) < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                          {Number(tx.amount) > 0 ? '+' : ''}
                          {Number(tx.amount).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {tab === 'sell' && !issued && (
          <footer className="px-5 py-3 border-t border-restro-border-green/80 shrink-0">
            <button
              type="button"
              disabled={isBusy}
              onClick={handleIssue}
              className="w-full min-h-[52px] rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-black text-sm active:scale-95 transition cursor-pointer disabled:opacity-60"
            >
              {code.trim() ? t('pos_ops.sell_or_top_up_btn', 'Sell or top up') : t('pos_ops.sell_card', 'Sell gift card')}
              {Number(amount) > 0 ? ` · ${money(amount)}` : ''}
            </button>
          </footer>
        )}
      </aside>
    </>
  );
}
