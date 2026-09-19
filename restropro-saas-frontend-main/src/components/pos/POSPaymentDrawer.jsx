import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  IconX, 
  IconCash, 
  IconCheck, 
  IconChevronUp, 
  IconReceipt, 
  IconBackspace, 
  IconPercentage, 
  IconCoin
} from '@tabler/icons-react';
import { PAYMENT_ICONS } from '../../config/payment_icons';
import { clsx } from 'clsx';
import { iconStroke } from '../../config/config';

export default function POSPaymentDrawer({
  isOpen,
  onClose,
  paymentTypes = [],
  selectedPaymentType,
  onSelectPaymentType,
  payableTotal = 0,
  itemsTotal = 0,
  taxTotal = 0,
  serviceChargeTotal = 0,
  discountAmount = 0,
  discountType = 'fixed',
  discountValue = 0,
  onDiscountChange,
  currency = '$',
  tenderedAmount = '',
  onTenderedAmountChange,
  onPayAndComplete,
  isProcessing = false,
}) {
  const { t } = useTranslation();
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isDiscountExpanded, setIsDiscountExpanded] = useState(false);

  // Dynamic quick cash steps
  const quickCashPresets = useMemo(() => {
    const presets = [];
    presets.push({ label: `Exact (${currency}${payableTotal.toFixed(2)})`, value: payableTotal.toFixed(2) });
    
    [10, 20, 50, 100].forEach((step) => {
      const targetVal = Math.ceil((payableTotal + 0.01) / step) * step;
      if (targetVal > payableTotal && !presets.some(p => p.value === targetVal.toFixed(2))) {
        presets.push({ label: `${currency}${targetVal}`, value: targetVal.toFixed(2) });
      }
    });
    return presets;
  }, [payableTotal, currency]);

  // Numerical change due calculations
  const numericTendered = parseFloat(tenderedAmount) || 0;
  const changeDue = numericTendered - payableTotal;
  const isSufficient = numericTendered >= payableTotal;

  // On-screen touch numpad handler
  const handleNumpadPress = (val) => {
    if (val === 'CLEAR') {
      onTenderedAmountChange('');
      return;
    }
    if (val === 'BACKSPACE') {
      onTenderedAmountChange(tenderedAmount.slice(0, -1));
      return;
    }
    if (val === '.') {
      if (tenderedAmount.includes('.')) return;
      onTenderedAmountChange(tenderedAmount ? `${tenderedAmount}.` : '0.');
      return;
    }
    if (val === '00') {
      if (!tenderedAmount || tenderedAmount === '0') return;
      onTenderedAmountChange(`${tenderedAmount}00`);
      return;
    }
    // Append number
    if (tenderedAmount === '0') {
      onTenderedAmountChange(val);
    } else {
      onTenderedAmountChange(`${tenderedAmount}${val}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-Over Panel Container */}
      <div 
        className={clsx(
          "relative w-full max-w-md md:max-w-lg bg-background border-l border-restro-border-green shadow-2xl z-10 flex flex-col h-full animate-in slide-in-from-right duration-250 ease-out"
        )}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-restro-border-green shrink-0 bg-restro-gray/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-restro-green/15 text-restro-green flex items-center justify-center">
              <IconCash size={20} stroke={iconStroke} />
            </div>
            <div>
              <h3 className="text-base font-bold text-restro-text">
                {t('pos.collect_payment', 'Settle Payment')}
              </h3>
              <p className="text-[11px] text-gray-400">
                {t('pos.select_tender_type', 'Choose payment method & finalize ticket')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-restro-gray hover:bg-restro-button-hover text-restro-text flex items-center justify-center transition active:scale-95 cursor-pointer"
            title="Close payment drawer (Esc)"
          >
            <IconX size={18} stroke={iconStroke} />
          </button>
        </div>

        {/* Scrollable Main Area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin">
          
          {/* Total Payable Summary Card */}
          <div className="rounded-2xl border border-restro-border-green bg-restro-card-bg shadow-sm overflow-hidden">
            <div 
              onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-restro-button-hover transition select-none"
            >
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                  {t('pos.payable_total', 'Total Due')}
                </span>
                <span className="text-2xl sm:text-3xl font-black text-restro-green tracking-tight mt-0.5 block">
                  {currency}{payableTotal.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold">
                <span>{isSummaryExpanded ? 'Hide breakdown' : 'View breakdown'}</span>
                <IconChevronUp 
                  size={16} 
                  stroke={iconStroke} 
                  className={clsx("transition-transform duration-200", !isSummaryExpanded && "rotate-180")} 
                />
              </div>
            </div>

            {/* Collapsible Order Breakdown */}
            {isSummaryExpanded && (
              <div className="px-4 pb-3.5 pt-1 space-y-2 border-t border-restro-border-green/50 text-xs bg-restro-gray/30 animate-in fade-in duration-150">
                <div className="flex justify-between text-gray-500">
                  <span>{t('pos.items_net_total', 'Items Subtotal')}</span>
                  <span className="font-semibold text-restro-text">{currency}{itemsTotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>{t('pos.discount_total', 'Discount')}</span>
                    <span>-{currency}{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-500">
                  <span>{t('pos.tax_total', 'Tax')}</span>
                  <span className="font-semibold text-restro-text">+{currency}{taxTotal.toFixed(2)}</span>
                </div>
                {serviceChargeTotal > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>{t('pos.service_charge_total', 'Service Charge')}</span>
                    <span className="font-semibold text-restro-text">+{currency}{serviceChargeTotal.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment Method Selector Grid */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block">
              {t('orders.select_payment_method', 'Payment Method')}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {paymentTypes.map((pt) => {
                const isSelected = String(selectedPaymentType) === String(pt.id);
                return (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => onSelectPaymentType(pt.id)}
                    className={clsx(
                      "min-h-[60px] p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.97] cursor-pointer touch-manipulation relative shadow-xs select-none",
                      isSelected
                        ? "border-restro-green bg-emerald-500/10 text-restro-green ring-2 ring-restro-green font-bold shadow-sm"
                        : "border-restro-border-green bg-restro-card-bg text-restro-text hover:bg-restro-button-hover"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-restro-green text-white flex items-center justify-center shadow">
                        <IconCheck size={10} stroke={3} />
                      </div>
                    )}
                    {pt.icon && <span className="text-2xl leading-none">{PAYMENT_ICONS[pt.icon] || '💳'}</span>}
                    <span className="text-xs font-semibold truncate w-full text-center leading-tight">
                      {pt.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cash Tendered & Built-in Virtual Numpad (Tablet Optimized) */}
          <div className="p-3.5 rounded-2xl border border-restro-border-green bg-restro-gray/40 space-y-3 select-none">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                {t('pos.cash_tendered', 'Cash Tendered')}
              </span>
              {tenderedAmount && (
                <button
                  type="button"
                  onClick={() => onTenderedAmountChange('')}
                  className="text-xs text-red-500 hover:underline font-bold cursor-pointer active:scale-95"
                >
                  {t('pos.clear', 'Clear')}
                </button>
              )}
            </div>

            {/* Display Box */}
            <div className="flex items-center justify-between bg-background border border-restro-border-green rounded-2xl px-4 py-2.5 shadow-inner">
              <span className="text-base font-bold text-gray-400">{currency}</span>
              <span className="text-2xl font-black text-restro-text font-mono tracking-wider">
                {tenderedAmount || '0.00'}
              </span>
            </div>

            {/* Quick Cash Presets (Exact + Round Bills) */}
            <div className="flex flex-wrap gap-1.5">
              {quickCashPresets.map((preset, idx) => {
                const isExact = preset.value === payableTotal.toFixed(2);
                const isCurrent = tenderedAmount === preset.value;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onTenderedAmountChange(preset.value)}
                    className={clsx(
                      "min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer touch-manipulation shadow-xs",
                      isCurrent
                        ? "bg-restro-green text-white border-restro-green"
                        : isExact
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25"
                        : "bg-background border-restro-border-green text-restro-text hover:bg-restro-button-hover"
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Touch Virtual Numpad (Prevents OS virtual keyboard popping up on tablets) */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {[
                '1', '2', '3',
                '4', '5', '6',
                '7', '8', '9',
                '.', '0', '00'
              ].map((keyVal) => (
                <button
                  key={keyVal}
                  type="button"
                  onClick={() => handleNumpadPress(keyVal)}
                  className="min-h-[50px] rounded-2xl border border-restro-border-green bg-background text-restro-text text-lg font-black hover:bg-restro-button-hover active:scale-95 transition shadow-2xs flex items-center justify-center cursor-pointer touch-manipulation"
                >
                  {keyVal}
                </button>
              ))}
            </div>

            {/* Numpad Action Row: Backspace & Clear */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleNumpadPress('CLEAR')}
                className="min-h-[44px] rounded-xl border border-restro-border-green bg-restro-gray text-gray-500 text-xs font-bold hover:bg-restro-button-hover active:scale-95 transition flex items-center justify-center cursor-pointer touch-manipulation"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={() => handleNumpadPress('BACKSPACE')}
                className="min-h-[44px] rounded-xl border border-restro-border-green bg-restro-gray text-restro-text text-xs font-bold hover:bg-restro-button-hover active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation"
              >
                <IconBackspace size={19} stroke={iconStroke} />
                <span>Delete</span>
              </button>
            </div>

            {/* Change Due / Remaining Banner */}
            {numericTendered > 0 && (
              <div 
                className={clsx(
                  "p-3 rounded-2xl border flex items-center justify-between shadow-xs animate-in zoom-in-95 duration-150",
                  isSufficient
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                )}
              >
                <span className="text-xs font-bold uppercase tracking-wider">
                  {isSufficient ? t('pos.change_due', 'Change Due') : t('pos.remaining_due', 'Remaining Due')}
                </span>
                <span className="text-lg font-black font-mono">
                  {currency}{Math.abs(changeDue).toFixed(2)}
                </span>
              </div>
            )}

          </div>

          {/* Quick Discount Tool */}
          <div className="p-3 rounded-2xl border border-restro-border-green bg-restro-gray/30 space-y-2">
            <div 
              onClick={() => setIsDiscountExpanded(!isDiscountExpanded)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <IconPercentage size={15} stroke={iconStroke} />
                <span>{t('pos.apply_discount', 'Apply Discount')}</span>
              </span>
              <span className="text-xs text-restro-green font-bold">
                {discountAmount > 0 ? `-${currency}${discountAmount.toFixed(2)}` : '+ add'}
              </span>
            </div>

            {isDiscountExpanded && (
              <div className="pt-2 space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <div className="flex p-0.5 rounded-xl border border-restro-border-green bg-background">
                    <button
                      type="button"
                      onClick={() => onDiscountChange && onDiscountChange('fixed', discountValue)}
                      className={clsx(
                        "px-3 py-1 rounded-lg text-xs font-bold transition",
                        discountType === 'fixed' ? "bg-restro-green text-white shadow-xs" : "text-gray-500"
                      )}
                    >
                      Fixed ({currency})
                    </button>
                    <button
                      type="button"
                      onClick={() => onDiscountChange && onDiscountChange('percentage', discountValue)}
                      className={clsx(
                        "px-3 py-1 rounded-lg text-xs font-bold transition",
                        discountType === 'percentage' ? "bg-restro-green text-white shadow-xs" : "text-gray-500"
                      )}
                    >
                      Percent (%)
                    </button>
                  </div>

                  <input
                    type="number"
                    min="0"
                    placeholder="Value"
                    value={discountValue || ''}
                    onChange={(e) => onDiscountChange && onDiscountChange(discountType, e.target.value)}
                    className="flex-1 min-h-[38px] px-3 py-1.5 text-xs font-bold rounded-xl border border-restro-border-green bg-background text-restro-text focus:outline-restro-green"
                  />
                  {discountValue > 0 && (
                    <button
                      type="button"
                      onClick={() => onDiscountChange && onDiscountChange(discountType, 0)}
                      className="text-xs text-gray-400 hover:text-red-500 px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Action Footer: Settle & Print Receipt */}
        <div className="p-4 border-t border-restro-border-green bg-restro-gray/40 shrink-0">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onPayAndComplete}
            className={clsx(
              "w-full min-h-[52px] px-5 py-3.5 rounded-2xl font-black text-sm text-white flex items-center justify-between transition-all active:scale-[0.98] shadow-lg cursor-pointer touch-manipulation",
              isProcessing
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-restro-green hover:bg-restro-green-button-hover shadow-emerald-600/25"
            )}
          >
            <span className="flex items-center gap-2">
              <IconReceipt size={22} stroke={iconStroke} />
              <span>{isProcessing ? t('pos.processing', 'Processing...') : t('pos.complete_and_print', 'Settle & Print Receipt')}</span>
            </span>
            <span className="px-3 py-1 rounded-xl bg-white/20 text-xs font-mono font-black">
              {currency}{payableTotal.toFixed(2)}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}
