import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconX, IconGift, IconPercentage, IconBan, IconArrowBackUp, IconMinus, IconPlus } from '@tabler/icons-react';
import { clsx } from 'clsx';
import { toast } from 'react-hot-toast';
import { iconStroke } from '../../config/config';
import ManagerPinModal from '../common/ManagerPinModal';
import { authorizeLineAdjustment, adjustOrderItem } from '../../controllers/pos.controller';

export const LINE_REASONS = {
  void: ['WRONG_ITEM', 'CUSTOMER_CHANGED_MIND', 'KITCHEN_ERROR', 'LONG_WAIT', 'QUALITY', 'DUPLICATE', 'OTHER'],
  comp: ['QUALITY', 'LONG_WAIT', 'MANAGER_COMP', 'STAFF_MEAL', 'VIP_GUEST', 'BIRTHDAY', 'OTHER'],
  discount: ['QUALITY', 'LONG_WAIT', 'LOYAL_GUEST', 'STAFF_DISCOUNT', 'PRICE_MATCH', 'OTHER'],
};

const REASON_LABELS = {
  WRONG_ITEM: 'Wrong item',
  CUSTOMER_CHANGED_MIND: 'Guest changed mind',
  KITCHEN_ERROR: 'Kitchen error',
  LONG_WAIT: 'Long wait',
  QUALITY: 'Quality issue',
  DUPLICATE: 'Entered twice',
  MANAGER_COMP: 'Manager comp',
  STAFF_MEAL: 'Staff meal',
  VIP_GUEST: 'VIP guest',
  BIRTHDAY: 'Birthday',
  LOYAL_GUEST: 'Regular guest',
  STAFF_DISCOUNT: 'Staff discount',
  PRICE_MATCH: 'Price match',
  OTHER: 'Other',
};

export function reasonLabel(t, code) {
  return t(`pos_ops.reason_${String(code || '').toLowerCase()}`, REASON_LABELS[code] || code || '');
}

/**
 * Comp / discount / void a ticket line with a reason and manager approval.
 *
 * mode "cart": unsent POS line. Comp/discount ask the server for a single-use
 *              approval token; `onApplied` gets { action, adjust, unitPrice }.
 * mode "sent": line already on an order. Void/comp/discount/undo are applied
 *              on the server; `onApplied` gets the server result.
 */
export default function POSLineAdjustDrawer({ isOpen, onClose, mode = 'cart', line, currency = '', onApplied }) {
  const { t } = useTranslation();
  const isSent = mode === 'sent';
  const actions = isSent ? ['void', 'comp', 'discount'] : ['comp', 'discount'];

  const [action, setAction] = useState(actions[0]);
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [discountType, setDiscountType] = useState('percent');
  const [discountValue, setDiscountValue] = useState('10');
  const [quantity, setQuantity] = useState(1);
  const [isBusy, setIsBusy] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const lastActionRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setAction(actions[0]);
    setReason(null);
    setNote('');
    setDiscountType('percent');
    setDiscountValue('10');
    setQuantity(Number(line?.quantity) || 1);
    setIsBusy(false);
  }, [isOpen, line?.key]);

  if (!isOpen || !line) return null;

  const lineQty = Number(line.quantity) || 1;
  const basePrice = Number(line.originalPrice ?? line.unitPrice) || 0;
  const previewPrice = (() => {
    if (action === 'comp') return 0;
    if (action === 'discount') {
      const v = Math.max(0, Number(discountValue) || 0);
      return discountType === 'percent' ? Math.max(0, basePrice * (1 - Math.min(v, 100) / 100)) : Math.max(0, basePrice - v);
    }
    return basePrice;
  })();
  const isAdjusted = Boolean(line.adjustType);

  const handleError = (error) => {
    const code = error?.response?.data?.code;
    if (code === 'MANAGER_PIN_REQUIRED' || code === 'INVALID_MANAGER_PIN') {
      setPinOpen(true);
      return;
    }
    toast.error(error?.response?.data?.message || t('pos_ops.save_failed', 'Could not save'));
  };

  const submit = async (managerPin = undefined, overrideAction = undefined) => {
    const act = overrideAction || action;
    lastActionRef.current = act;
    if (act !== 'restore' && !reason) {
      toast.error(t('pos_ops.choose_reason', 'Choose a reason'));
      return;
    }
    if (reason === 'OTHER' && !note.trim() && act !== 'restore') {
      toast.error(t('pos_ops.note_required', "Add a note for 'Other'"));
      return;
    }
    setIsBusy(true);
    try {
      if (isSent) {
        const res = await adjustOrderItem(line.orderItemId, {
          action: act,
          reasonCode: reason,
          note: note.trim() || undefined,
          quantity: act === 'restore' ? undefined : quantity,
          discountType,
          discountValue: Number(discountValue),
          managerPin,
        });
        onApplied?.(res.data);
      } else {
        const unitPrice = Math.round(previewPrice * 100) / 100;
        const res = await authorizeLineAdjustment({
          action: act,
          reasonCode: reason,
          note: note.trim() || undefined,
          itemId: line.itemId,
          itemTitle: line.title,
          quantity: lineQty,
          amount: Math.round((basePrice - unitPrice) * lineQty * 100) / 100,
          discountType,
          discountValue: Number(discountValue),
          managerPin,
        });
        onApplied?.({
          action: act,
          unitPrice,
          approvedBy: res.data?.approvedBy,
          adjust: {
            type: act,
            approval: res.data?.token,
            original_price: basePrice,
            reason_code: reason,
            discount_type: act === 'discount' ? discountType : null,
            discount_value: act === 'discount' ? Number(discountValue) : null,
          },
        });
      }
      onClose();
    } catch (error) {
      handleError(error);
    } finally {
      setIsBusy(false);
    }
  };

  const actionMeta = {
    void: { label: t('pos_ops.void', 'Void'), icon: IconBan, color: 'bg-red-600' },
    comp: { label: t('pos_ops.comp', 'Comp'), icon: IconGift, color: 'bg-violet-600' },
    discount: { label: t('pos_ops.discount', 'Discount'), icon: IconPercentage, color: 'bg-amber-500' },
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('pos_ops.adjust_line', 'Adjust item')}
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-background text-foreground border-l border-restro-border-green shadow-2xl flex flex-col overflow-hidden select-none"
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-restro-border-green/80 bg-restro-gray/40 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-black text-restro-text leading-tight truncate">{line.title}</h3>
            <p className="text-[11px] text-gray-500 truncate">
              {lineQty} × {currency}{basePrice.toFixed(2)}
              {isAdjusted && (
                <span className="ml-1.5 font-bold text-violet-600 uppercase">
                  · {line.adjustType === 'comp' ? t('pos_ops.comp', 'Comp') : t('pos_ops.discount', 'Discount')}
                </span>
              )}
            </p>
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

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Action */}
          <div className={clsx('grid gap-2', actions.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
            {actions.map((a) => {
              const meta = actionMeta[a];
              const Icon = meta.icon;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => {
                    setAction(a);
                    setReason(null);
                  }}
                  className={clsx(
                    'min-h-[56px] rounded-2xl border-2 font-black text-sm flex flex-col items-center justify-center gap-0.5 active:scale-95 transition cursor-pointer',
                    action === a ? `${meta.color} text-white border-transparent` : 'border-restro-border-green text-restro-text'
                  )}
                >
                  <Icon size={18} stroke={iconStroke} />
                  {meta.label}
                </button>
              );
            })}
          </div>

          {/* Quantity (sent lines can be partially voided / comped) */}
          {isSent && lineQty > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">{t('pos_ops.how_many', 'How many?')}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="min-h-[42px] min-w-[42px] rounded-xl border border-restro-border-green flex items-center justify-center active:scale-95 cursor-pointer"
                  aria-label={t('pos_ops.fewer', 'Fewer')}
                >
                  <IconMinus size={16} />
                </button>
                <span className="w-10 text-center font-black tabular-nums">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(lineQty, q + 1))}
                  className="min-h-[42px] min-w-[42px] rounded-xl border border-restro-border-green flex items-center justify-center active:scale-95 cursor-pointer"
                  aria-label={t('pos_ops.more', 'More')}
                >
                  <IconPlus size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Discount amount */}
          {action === 'discount' && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                {['percent', 'fixed'].map((dt) => (
                  <button
                    key={dt}
                    type="button"
                    onClick={() => setDiscountType(dt)}
                    className={clsx(
                      'min-h-[42px] rounded-xl border text-sm font-bold active:scale-95 cursor-pointer',
                      discountType === dt ? 'bg-[#0D233A] text-white border-[#0D233A]' : 'border-restro-border-green'
                    )}
                  >
                    {dt === 'percent' ? '%' : currency || t('pos_ops.amount', 'Amount')}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {(discountType === 'percent' ? ['10', '15', '20', '50'] : ['0.5', '1', '2', '5']).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDiscountValue(v)}
                    className={clsx(
                      'min-h-[42px] min-w-[56px] px-3 rounded-xl border text-sm font-bold active:scale-95 cursor-pointer',
                      discountValue === v ? 'bg-amber-500 text-white border-amber-500' : 'border-restro-border-green'
                    )}
                  >
                    {discountType === 'percent' ? `${v}%` : `${currency}${v}`}
                  </button>
                ))}
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-24 min-h-[42px] rounded-xl border border-restro-border-green text-center font-bold bg-transparent outline-none focus:ring-2 focus:ring-restro-green/40"
                  aria-label={t('pos_ops.discount', 'Discount')}
                />
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-gray-500">{t('pos_ops.reason', 'Reason')}</span>
            <div className="flex flex-wrap gap-2">
              {LINE_REASONS[action].map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setReason(code)}
                  className={clsx(
                    'min-h-[42px] px-3.5 rounded-full border text-xs font-bold active:scale-95 transition cursor-pointer',
                    reason === code ? 'bg-[#0D233A] text-white border-[#0D233A]' : 'border-restro-border-green text-restro-text'
                  )}
                >
                  {reasonLabel(t, code)}
                </button>
              ))}
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder={reason === 'OTHER' ? t('pos_ops.note_required_ph', 'Note (required)') : t('pos_ops.note_optional', 'Note (optional)')}
              className="w-full min-h-[42px] px-3 rounded-xl border border-restro-border-green bg-restro-gray/30 text-sm outline-none focus:ring-2 focus:ring-restro-green/40"
            />
          </div>

          {/* Preview */}
          <div className="rounded-2xl bg-restro-gray/40 border border-restro-border-green p-3 text-sm flex items-center justify-between">
            <span className="text-gray-500">
              {action === 'void'
                ? t('pos_ops.void_preview', 'Removes {{count}} from the bill and prints a VOID ticket', { count: quantity })
                : t('pos_ops.new_price', 'New price')}
            </span>
            {action !== 'void' && (
              <span className="font-black tabular-nums">
                {basePrice !== previewPrice && <span className="line-through text-gray-400 mr-2 font-normal">{currency}{basePrice.toFixed(2)}</span>}
                {currency}{previewPrice.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        <footer className="px-5 py-3 border-t border-restro-border-green/80 shrink-0 flex flex-col gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => submit()}
            className={clsx(
              'w-full min-h-[52px] rounded-xl text-white font-black text-sm active:scale-95 transition cursor-pointer disabled:opacity-60',
              actionMeta[action].color
            )}
          >
            {isBusy ? t('common.processing', 'Processing...') : actionMeta[action].label}
          </button>
          {isAdjusted && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => (isSent ? submit(undefined, 'restore') : (onApplied?.({ action: 'restore' }), onClose()))}
              className="w-full min-h-[44px] rounded-xl border border-restro-border-green text-sm font-bold flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <IconArrowBackUp size={16} stroke={iconStroke} />
              {t('pos_ops.undo_adjust', 'Back to full price')}
            </button>
          )}
          <p className="text-[10px] text-center text-gray-400">
            {t('pos_ops.needs_manager', 'Needs a manager. You will be asked for a PIN if your role cannot approve.')}
          </p>
        </footer>
      </aside>

      <ManagerPinModal
        isOpen={pinOpen}
        onClose={() => setPinOpen(false)}
        onSuccess={(pin) => submit(pin, lastActionRef.current || undefined)}
        title={t('pos_ops.manager_approval', 'Manager approval')}
        description={t('pos_ops.manager_approval_desc', 'Enter a manager PIN to approve this {{action}}', { action: actionMeta[action].label.toLowerCase() })}
      />
    </>
  );
}
