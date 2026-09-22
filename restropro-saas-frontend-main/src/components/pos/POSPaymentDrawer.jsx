import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  IconX, 
  IconCash, 
  IconCheck, 
  IconChevronUp, 
  IconReceipt, 
  IconBackspace, 
  IconPercentage, 
  IconCoin,
  IconPencil,
  IconArrowsExchange,
  IconQrcode,
  IconCreditCard
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
  exchangeRateUsdToKhr = 4100,
  onUpdateExchangeRate,
  tenderedAmount = '',
  onTenderedAmountChange,
  onPayAndComplete,
  isProcessing = false,
}) {
  const { t } = useTranslation();
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

  // Exchange rate state (1 USD = X KHR)
  const [currentRate, setCurrentRate] = useState(Number(exchangeRateUsdToKhr) || 4100);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRateInput, setTempRateInput] = useState(String(Number(exchangeRateUsdToKhr) || 4100));

  useEffect(() => {
    if (exchangeRateUsdToKhr) {
      setCurrentRate(Number(exchangeRateUsdToKhr) || 4100);
      setTempRateInput(String(Number(exchangeRateUsdToKhr) || 4100));
    }
  }, [exchangeRateUsdToKhr]);

  // Base Currency Detection (is primary store currency KHR or USD?)
  const isBaseKHR = currency === '៛' || String(currency).toUpperCase() === 'KHR';

  const rate = (Number(currentRate) > 0) ? Number(currentRate) : 4100;
  const safePayable = Number(payableTotal) || 0;

  // Symmetrical Total calculations
  const totalKHR = isBaseKHR ? safePayable : safePayable * rate;
  const totalUSD = isBaseKHR ? (rate > 0 ? safePayable / rate : safePayable) : safePayable;

  // Dual Tender input state: Cashier can enter USD, KHR, or both
  const [activeTenderCurrency, setActiveTenderCurrency] = useState(isBaseKHR ? 'KHR' : 'USD');
  const [tenderedUSD, setTenderedUSD] = useState('');
  const [tenderedKHR, setTenderedKHR] = useState('');

  // Change Return Advice Mode: 'riel' (100% in Riel) or 'mixed' (USD whole bills + Riel cents)
  const [changeAdviceMode, setChangeAdviceMode] = useState('riel');

  // Reset tender inputs when modal opens with fresh payableTotal
  useEffect(() => {
    if (isOpen) {
      setTenderedUSD('');
      setTenderedKHR('');
      setIsEditingRate(false);
    }
  }, [isOpen, payableTotal]);

  // Payment method classification
  const paymentList = Array.isArray(paymentTypes) ? paymentTypes : [];
  const selectedPaymentObj = paymentList.find(pt => pt.id === selectedPaymentType);
  const selectedPaymentTitle = (selectedPaymentObj?.title || '').toLowerCase();
  const isCash = selectedPaymentTitle.includes('cash') || selectedPaymentTitle.includes('សាច់ប្រាក់') || !selectedPaymentType;
  const isQr = selectedPaymentTitle.includes('qr') || selectedPaymentTitle.includes('qrcode');

  // Numerical tender conversions
  const numUSD = parseFloat(tenderedUSD) || 0;
  const numKHR = parseFloat(tenderedKHR) || 0;

  // Total cash received converted to both currencies
  const totalReceivedKHR = numKHR + (numUSD * rate);
  const totalReceivedUSD = (rate > 0 ? (numKHR / rate) : 0) + numUSD;

  // Difference in KHR (positive = change due, negative = short)
  const diffKHR = totalReceivedKHR - totalKHR;
  const isSufficient = diffKHR >= -0.5 || (numUSD === 0 && numKHR === 0 && safePayable === 0);

  // Rounded change calculations (Nearest ៛100 note)
  const rawChangeKHR = Math.max(0, diffKHR);
  const changeTotalKHR = Math.round(rawChangeKHR / 100) * 100;
  const changeTotalUSD = rate > 0 ? changeTotalKHR / rate : 0;

  // Smart Mixed Change Breakdown:
  // Whole dollar bills in USD + remaining cents in KHR rounded to nearest ៛100
  const changeBreakdownUSD = rate > 0 ? Math.floor(changeTotalKHR / rate) : 0;
  const changeBreakdownKHR = Math.round((changeTotalKHR - (changeBreakdownUSD * rate)) / 100) * 100;

  // Sync back to parent tenderedAmount for backward compatibility
  useEffect(() => {
    if (onTenderedAmountChange) {
      const primaryTender = isBaseKHR ? totalReceivedKHR : totalReceivedUSD;
      onTenderedAmountChange(primaryTender > 0 ? String(primaryTender.toFixed(2)) : '');
    }
  }, [totalReceivedKHR, totalReceivedUSD, isBaseKHR, onTenderedAmountChange]);

  // On-screen touch numpad handler targeting the currently active currency
  const handleNumpadPress = (val) => {
    const currentVal = activeTenderCurrency === 'USD' ? tenderedUSD : tenderedKHR;
    const setter = activeTenderCurrency === 'USD' ? setTenderedUSD : setTenderedKHR;

    if (val === 'CLEAR') {
      setter('');
      return;
    }
    if (val === 'CLEAR_ALL') {
      setTenderedUSD('');
      setTenderedKHR('');
      return;
    }
    if (val === 'BACKSPACE') {
      setter(currentVal.slice(0, -1));
      return;
    }
    if (val === '.') {
      if (activeTenderCurrency === 'KHR') return; // Riel has no decimal cents
      if (currentVal.includes('.')) return;
      setter(currentVal ? `${currentVal}.` : '0.');
      return;
    }
    if (val === '00') {
      if (!currentVal || currentVal === '0') return;
      setter(`${currentVal}00`);
      return;
    }
    if (val === '000') {
      if (!currentVal || currentVal === '0') return;
      setter(`${currentVal}000`);
      return;
    }

    if (currentVal === '0') {
      setter(val);
    } else {
      setter(`${currentVal}${val}`);
    }
  };

  // Quick preset banknote chips
  const usdChips = [
    { label: 'Exact ($)', value: totalUSD.toFixed(2) },
    { label: '$1', value: '1' },
    { label: '$5', value: '5' },
    { label: '$10', value: '10' },
    { label: '$20', value: '20' },
    { label: '$50', value: '50' },
    { label: '$100', value: '100' },
  ];

  const khrChips = [
    { label: 'Exact (៛)', value: String(Math.round(totalKHR)) },
    { label: '៛1k', value: '1000' },
    { label: '៛5k', value: '5000' },
    { label: '៛10k', value: '10000' },
    { label: '៛20k', value: '20000' },
    { label: '៛50k', value: '50000' },
    { label: '៛100k', value: '100000' },
  ];

  const handleSaveRate = () => {
    const rateNum = Number(tempRateInput);
    if (rateNum && rateNum >= 1000 && rateNum <= 10000) {
      setCurrentRate(rateNum);
      if (onUpdateExchangeRate) {
        onUpdateExchangeRate(rateNum);
      }
    }
    setIsEditingRate(false);
  };

  const handleFinalizePayment = useCallback(() => {
    const tenderData = {
      tenderedUSD: numUSD,
      tenderedKHR: numKHR,
      totalReceivedKHR,
      totalReceivedUSD,
      changeTotalKHR,
      changeTotalUSD,
      changeBreakdownUSD,
      changeBreakdownKHR,
      changeMode: changeAdviceMode,
      exchangeRate: currentRate,
      isBaseKHR,
    };
    if (onPayAndComplete) {
      onPayAndComplete(tenderData);
    }
  }, [
    numUSD,
    numKHR,
    totalReceivedKHR,
    totalReceivedUSD,
    changeTotalKHR,
    changeTotalUSD,
    changeBreakdownUSD,
    changeBreakdownKHR,
    changeAdviceMode,
    currentRate,
    isBaseKHR,
    onPayAndComplete
  ]);

  // Keyboard Shortcuts (Esc to close, F4 / Enter to finalize)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleFinalizePayment();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleFinalizePayment, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col overflow-hidden select-none animate-in fade-in duration-200">
      
      {/* ==================== TOP NAVIGATION HEADER BAR ==================== */}
      <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-zinc-800 shrink-0 bg-zinc-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#0ea5e9]/15 text-[#0ea5e9] flex items-center justify-center font-bold shadow-xs">
            <IconCash size={22} stroke={iconStroke} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                {t('pos.collect_payment', 'Settle Payment')}
              </h3>
              <span className="hidden sm:inline-block text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Cambodian Dual-Currency
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Mixed USD &amp; Riel cash tender with smart change advice
            </p>
          </div>
        </div>

        {/* Live Exchange Rate Badge & Close Button */}
        <div className="flex items-center gap-2.5">
          {/* Shift Rate Badge with Inline Editor Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsEditingRate(!isEditingRate)}
              className="px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
              title="Click to adjust exchange rate for this shift"
            >
              <IconArrowsExchange size={15} />
              <span>1$ = ៛{currentRate.toLocaleString()}</span>
              <IconPencil size={12} className="text-amber-400" />
            </button>

            {isEditingRate && (
              <div className="absolute right-0 top-full mt-2 w-72 p-3 bg-zinc-900 border border-amber-500/40 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95">
                <p className="text-xs font-bold mb-1.5 text-white">Shift Exchange Rate (1 USD to KHR)</p>
                <div className="flex gap-1.5 mb-2">
                  {[4000, 4100, 4150].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setTempRateInput(String(r));
                        setCurrentRate(r);
                        if (onUpdateExchangeRate) onUpdateExchangeRate(r);
                        setIsEditingRate(false);
                      }}
                      className={clsx(
                        "flex-1 text-[11px] font-bold py-1 px-1.5 rounded-lg border transition active:scale-95 cursor-pointer",
                        currentRate === r
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700"
                      )}
                    >
                      ៛{r.toLocaleString()}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={tempRateInput}
                    onChange={(e) => setTempRateInput(e.target.value)}
                    placeholder="e.g. 4100"
                    className="w-full text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]"
                  />
                  <button
                    type="button"
                    onClick={handleSaveRate}
                    className="px-3 py-1.5 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-bold cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Close Button */}
          <button 
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            title="Close (Esc)"
          >
            <IconX size={20} stroke={iconStroke} />
            <span className="hidden sm:inline font-mono text-[10px] px-1 py-0.5 rounded bg-white/10 text-zinc-400">Esc</span>
          </button>
        </div>
      </div>

      {/* ==================== 2-COLUMN FULL-SCREEN WORKSPACE ==================== */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 p-4 sm:p-5 overflow-hidden min-h-0 bg-zinc-950">
        
        {/* ----------------- LEFT COLUMN (5 of 12 cols) ----------------- */}
        <div className="md:col-span-5 flex flex-col justify-between h-full space-y-3.5 min-h-0 overflow-y-auto md:overflow-hidden">
          
          <div className="space-y-3">
            {/* Card 1: Payable Total Due */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                  {t('pos.payable_total', 'Payable Total Due')}
                </span>
                <button
                  type="button"
                  onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                  className="text-[11px] font-bold text-zinc-500 hover:text-white flex items-center gap-1 transition cursor-pointer"
                >
                  <span>{isSummaryExpanded ? t('pos.hide', 'Hide') : t('pos.details', 'Details')}</span>
                  <IconChevronUp size={13} className={clsx("transition-transform duration-200", !isSummaryExpanded && "rotate-180")} />
                </button>
              </div>

              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-emerald-400">
                  {isBaseKHR ? `៛${Math.round(totalKHR).toLocaleString()}` : `$${totalUSD.toFixed(2)}`}
                </div>
                <div className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 font-mono font-bold text-xs sm:text-sm border border-emerald-500/30">
                  ≈ {isBaseKHR ? `$${totalUSD.toFixed(2)} USD` : `៛${Math.round(totalKHR).toLocaleString()} KHR`}
                </div>
              </div>

              {/* Collapsible details breakdown */}
              {isSummaryExpanded && (
                <div className="mt-2.5 pt-2.5 border-t border-emerald-500/20 text-xs font-mono space-y-1 text-zinc-400 animate-in fade-in">
                  <div className="flex justify-between">
                    <span>{t('pos.items_net_total', 'Items Net Total')}</span>
                    <span>{currency}{Number(itemsTotal).toFixed(2)}</span>
                  </div>
                  {Number(discountAmount) > 0 && (
                    <div className="flex justify-between text-emerald-400 font-semibold">
                      <span>{t('pos.discount', 'Discount')}</span>
                      <span>-{currency}{Number(discountAmount).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(taxTotal) > 0 && (
                    <div className="flex justify-between">
                      <span>{t('pos.tax_total', 'Tax Total')}</span>
                      <span>+{currency}{Number(taxTotal).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(serviceChargeTotal) > 0 && (
                    <div className="flex justify-between">
                      <span>{t('pos.service_charge', 'Service Charge')}</span>
                      <span>+{currency}{Number(serviceChargeTotal).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Card 2: Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                {t('orders.select_payment_method', 'Select Payment Method')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {paymentList.map((pt) => {
                  const isSelected = selectedPaymentType === pt.id;
                  const iconElement = (pt.icon && PAYMENT_ICONS[pt.icon]) ? PAYMENT_ICONS[pt.icon] : <IconCash size={16} stroke={iconStroke} />;
                  return (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => onSelectPaymentType(pt.id)}
                      className={clsx(
                        "relative min-h-[50px] p-3 rounded-2xl border flex items-center gap-2.5 transition active:scale-95 text-left cursor-pointer select-none",
                        isSelected
                          ? "border-[#0ea5e9] bg-[#0ea5e9]/10 text-[#0ea5e9] shadow-xs ring-2 ring-[#0ea5e9]/20"
                          : "border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                      )}
                    >
                      <div className={clsx(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 [&>svg]:w-4 [&>svg]:h-4",
                        isSelected ? "bg-[#0ea5e9] text-white" : "bg-zinc-700 text-zinc-400"
                      )}>
                        {iconElement}
                      </div>
                      <div className="truncate font-bold text-xs flex-1">
                        {pt.title}
                      </div>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-[#0ea5e9] text-white flex items-center justify-center shrink-0">
                          <IconCheck size={11} stroke={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card 3: Smart Change Advice & Rounding (When Cash is selected) */}
            {isCash && (
              <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-3.5 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                    Change Return Advice
                  </span>
                  <div className="flex items-center gap-1 bg-zinc-800 p-0.5 rounded-lg border border-zinc-700">
                    <button
                      type="button"
                      onClick={() => setChangeAdviceMode('riel')}
                      className={clsx(
                        "text-[10px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer",
                        changeAdviceMode === 'riel'
                          ? "bg-zinc-700 text-white shadow-xs"
                          : "text-zinc-500 hover:text-white"
                      )}
                    >
                      ៛ All Riel
                    </button>
                    <button
                      type="button"
                      onClick={() => setChangeAdviceMode('mixed')}
                      className={clsx(
                        "text-[10px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer",
                        changeAdviceMode === 'mixed'
                          ? "bg-zinc-700 text-white shadow-xs"
                          : "text-zinc-500 hover:text-white"
                      )}
                    >
                      $ + ៛ Mixed
                    </button>
                  </div>
                </div>

                {/* Cash Received summary */}
                <div className="flex items-center justify-between text-xs py-1 border-b border-zinc-700">
                  <span className="text-zinc-500">Total Cash Received:</span>
                  <span className="font-mono font-bold text-xs sm:text-sm text-zinc-200">
                    ៛{Math.round(totalReceivedKHR).toLocaleString()}{" "}
                    <span className="text-zinc-500 font-normal text-[11px]">(${totalReceivedUSD.toFixed(2)})</span>
                  </span>
                </div>

                {/* Change Result or Shortfall Notice */}
                {isSufficient ? (
                  <div className="rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider">
                        Change Due {changeAdviceMode === 'mixed' ? '(Mixed $ + ៛)' : '(All Riel ៛)'}:
                      </span>
                      <span className="text-xl font-black font-mono">
                        {changeAdviceMode === 'mixed' && changeBreakdownUSD > 0
                          ? `$${changeBreakdownUSD} + ៛${changeBreakdownKHR.toLocaleString()}`
                          : `៛${changeTotalKHR.toLocaleString()}`}
                      </span>
                    </div>
                    <div className="text-[10px] text-emerald-400/80 mt-1 flex items-center justify-between">
                      <span>Nearest ៛100 note rounding</span>
                      <span>≈ ${changeTotalUSD.toFixed(2)} USD</span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-bold">Needs More Cash:</span>
                      <span className="text-sm sm:text-base font-black font-mono">
                        ៛{Math.round(Math.abs(diffKHR)).toLocaleString()}{" "}
                        <span className="text-[11px] font-normal text-amber-400">(${Math.abs(diffKHR / currentRate).toFixed(2)})</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Primary Action Bar */}
          <div className="space-y-2 pt-2 shrink-0">
            <button
              type="button"
              onClick={handleFinalizePayment}
              disabled={isProcessing || (isCash && !isSufficient && (numUSD > 0 || numKHR > 0))}
              className={clsx(
                "w-full min-h-[56px] px-5 py-3 rounded-2xl font-black text-sm text-white flex items-center justify-between transition active:scale-[0.98] shadow-lg touch-manipulation cursor-pointer select-none",
                isProcessing || (isCash && !isSufficient && (numUSD > 0 || numKHR > 0))
                  ? "opacity-50 cursor-not-allowed bg-zinc-700 shadow-none"
                  : "bg-restro-green hover:bg-restro-green-button-hover shadow-emerald-600/25"
              )}
            >
              <span className="flex items-center gap-2">
                <IconReceipt size={20} stroke={iconStroke} />
                <span>{isProcessing ? t('pos.please_wait', 'Processing...') : t('pos.settle_and_print', 'Settle & Print Receipt')}</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/20 text-white">F4</span>
              </span>
              <span className="font-extrabold text-sm sm:text-base bg-white/20 px-3 py-1 rounded-xl font-mono">
                {currency}{Number(payableTotal).toFixed(2)}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[40px] py-1.5 rounded-xl text-xs font-bold text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition active:scale-95 cursor-pointer"
            >
              {t('pos.cancel_and_return', 'Cancel & Return to Order Ticket')}
            </button>
          </div>

        </div>


        {/* ----------------- RIGHT COLUMN (7 of 12 cols) ----------------- */}
        <div className="md:col-span-7 flex flex-col justify-between h-full bg-zinc-900 rounded-3xl p-4 sm:p-5 border border-zinc-800 shadow-xs min-h-0 overflow-y-auto md:overflow-hidden">
          
          {/* CASH PAYMENT WORKSPACE */}
          {isCash ? (
            <div className="flex flex-col justify-between h-full space-y-3 min-h-0">
              
              {/* 1. Dual Tender Display Cards */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                    Cash Tendered (Tap Card to Select)
                  </span>
                  {(tenderedUSD || tenderedKHR) && (
                    <button
                      type="button"
                      onClick={() => { setTenderedUSD(''); setTenderedKHR(''); }}
                      className="text-[11px] font-bold text-red-400 hover:text-red-300 transition active:scale-95 cursor-pointer"
                    >
                      Clear Both
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* USD Tender Card */}
                  <div
                    onClick={() => setActiveTenderCurrency('USD')}
                    className={clsx(
                      "p-3.5 rounded-2xl border-2 transition cursor-pointer relative select-none",
                      activeTenderCurrency === 'USD'
                        ? "border-[#0ea5e9] bg-[#0ea5e9]/10 ring-2 ring-[#0ea5e9]/20 shadow-md"
                        : "border-zinc-700 bg-zinc-800 hover:bg-zinc-750"
                    )}
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-500 mb-0.5">
                      <span>USD ($)</span>
                      {tenderedUSD && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setTenderedUSD(''); }}
                          className="p-1 rounded-md hover:bg-white/10 text-zinc-500 hover:text-red-400 cursor-pointer"
                        >
                          <IconX size={13} />
                        </button>
                      )}
                    </div>
                    <div className="text-2xl font-black font-mono text-white truncate">
                      ${tenderedUSD || '0'}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                      ≈ ៛{Math.round(numUSD * currentRate).toLocaleString()}
                    </div>
                  </div>

                  {/* RIEL Tender Card */}
                  <div
                    onClick={() => setActiveTenderCurrency('KHR')}
                    className={clsx(
                      "p-3.5 rounded-2xl border-2 transition cursor-pointer relative select-none",
                      activeTenderCurrency === 'KHR'
                        ? "border-[#0ea5e9] bg-[#0ea5e9]/10 ring-2 ring-[#0ea5e9]/20 shadow-md"
                        : "border-zinc-700 bg-zinc-800 hover:bg-zinc-750"
                    )}
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-500 mb-0.5">
                      <span>RIEL (៛)</span>
                      {tenderedKHR && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setTenderedKHR(''); }}
                          className="p-1 rounded-md hover:bg-white/10 text-zinc-500 hover:text-red-400 cursor-pointer"
                        >
                          <IconX size={13} />
                        </button>
                      )}
                    </div>
                    <div className="text-2xl font-black font-mono text-white truncate">
                      ៛{tenderedKHR ? Number(tenderedKHR).toLocaleString() : '0'}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                      ≈ ${(numKHR / currentRate).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Banknote Quick Preset Chips (Both currencies stacked) */}
              <div className="space-y-1.5">
                {/* USD Banknotes */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Quick USD Banknotes ($):
                  </span>
                  <div className="grid grid-cols-7 gap-1.5">
                    {usdChips.map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTenderedUSD(chip.value);
                          setActiveTenderCurrency('USD');
                        }}
                        className={clsx(
                          "min-h-[42px] px-1 py-1 rounded-xl font-mono font-bold text-[11px] border transition active:scale-95 cursor-pointer flex items-center justify-center truncate",
                          tenderedUSD === chip.value
                            ? "bg-[#0ea5e9] text-white border-[#0ea5e9]"
                            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700"
                        )}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* KHR Banknotes */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Quick Riel Banknotes (៛):
                  </span>
                  <div className="grid grid-cols-7 gap-1.5">
                    {khrChips.map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTenderedKHR(chip.value);
                          setActiveTenderCurrency('KHR');
                        }}
                        className={clsx(
                          "min-h-[42px] px-1 py-1 rounded-xl font-mono font-bold text-[11px] border transition active:scale-95 cursor-pointer flex items-center justify-center truncate",
                          tenderedKHR === chip.value
                            ? "bg-[#0ea5e9] text-white border-[#0ea5e9]"
                            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700"
                        )}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. High-Density Touch Numpad */}
              <div className="flex-1 flex flex-col justify-between min-h-0 pt-1">
                <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleNumpadPress(n)}
                      className="min-h-[80px] rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white text-2xl font-mono font-black border border-zinc-700 transition active:scale-95 flex items-center justify-center cursor-pointer shadow-md select-none"
                    >
                      {n}
                    </button>
                  ))}

                  {/* Dynamic Key: '000' for Riel, '.' for USD */}
                  <button
                    type="button"
                    onClick={() => handleNumpadPress(activeTenderCurrency === 'KHR' ? '000' : '.')}
                    className="min-h-[80px] rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white text-lg font-mono font-black border border-zinc-700 transition active:scale-95 flex items-center justify-center cursor-pointer shadow-md select-none"
                  >
                    {activeTenderCurrency === 'KHR' ? '000' : '.'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNumpadPress('0')}
                    className="min-h-[80px] rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white text-2xl font-mono font-black border border-zinc-700 transition active:scale-95 flex items-center justify-center cursor-pointer shadow-md select-none"
                  >
                    0
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNumpadPress('00')}
                    className="min-h-[80px] rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white text-lg font-mono font-black border border-zinc-700 transition active:scale-95 flex items-center justify-center cursor-pointer shadow-md select-none"
                  >
                    00
                  </button>
                </div>

                {/* Numpad Action Row */}
                <div className="grid grid-cols-2 gap-2 mt-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleNumpadPress('CLEAR')}
                    className="min-h-[48px] rounded-2xl bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white text-xs font-bold border border-zinc-600 transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer select-none"
                  >
                    Clear {activeTenderCurrency}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNumpadPress('BACKSPACE')}
                    className="min-h-[48px] rounded-2xl bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white text-xs font-bold border border-zinc-600 transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer select-none"
                  >
                    <IconBackspace size={17} stroke={iconStroke} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

            </div>
          ) : isQr ? (
            /* NON-CASH: POS QRCODE WORKSPACE */
            <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-xs">
                <IconQrcode size={44} stroke={iconStroke} />
              </div>

              <div>
                <h4 className="text-xl font-black text-white">
                  Scan to Pay with KHQR / Banking App
                </h4>
                <p className="text-xs text-zinc-500 max-w-sm mt-1">
                  Customer scans via ABA Mobile, Wing, Bakong, or any local banking application
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-800 border border-zinc-700 space-y-1 w-full max-w-xs">
                <div className="text-xs text-zinc-500">Total QR Amount:</div>
                <div className="text-3xl font-black font-mono text-emerald-400">
                  {isBaseKHR ? `៛${Math.round(totalKHR).toLocaleString()}` : `$${totalUSD.toFixed(2)}`}
                </div>
                <div className="text-xs font-mono text-zinc-500">
                  ≈ {isBaseKHR ? `$${totalUSD.toFixed(2)} USD` : `៛${Math.round(totalKHR).toLocaleString()} KHR`}
                </div>
              </div>

              <button
                type="button"
                onClick={handleFinalizePayment}
                disabled={isProcessing}
                className="w-full max-w-xs min-h-[56px] py-3 rounded-2xl bg-restro-green hover:bg-restro-green-button-hover text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition active:scale-95 cursor-pointer"
              >
                {isProcessing ? t('pos.please_wait', 'Processing...') : 'Confirm QR Payment & Print Receipt'}
              </button>
            </div>
          ) : (
            /* OTHER NON-CASH (Card, etc.) */
            <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-[#0ea5e9]/10 text-[#0ea5e9] flex items-center justify-center border border-[#0ea5e9]/30 shadow-xs">
                <IconCreditCard size={44} stroke={iconStroke} />
              </div>
              <div>
                <h4 className="text-xl font-black text-white">
                  Electronic Payment Terminal
                </h4>
                <p className="text-xs text-zinc-500 max-w-sm mt-1">
                  Swipe or tap customer card on the payment terminal
                </p>
              </div>
              <button
                type="button"
                onClick={handleFinalizePayment}
                disabled={isProcessing}
                className="w-full max-w-xs min-h-[56px] py-3 rounded-2xl bg-restro-green hover:bg-restro-green-button-hover text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition active:scale-95 cursor-pointer"
              >
                {isProcessing ? t('pos.please_wait', 'Processing...') : 'Confirm Card Payment & Print Receipt'}
              </button>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
