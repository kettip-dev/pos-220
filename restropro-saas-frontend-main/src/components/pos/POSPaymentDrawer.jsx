import React, { useState, useMemo, useEffect } from 'react';
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
  IconArrowRight
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
  const [isDiscountExpanded, setIsDiscountExpanded] = useState(false);

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

  // Symmetrical Total calculations
  const totalKHR = isBaseKHR ? payableTotal : payableTotal * currentRate;
  const totalUSD = isBaseKHR ? payableTotal / currentRate : payableTotal;

  // Dual Tender input state: Cashier can enter USD, KHR, or both
  const [activeTenderCurrency, setActiveTenderCurrency] = useState(isBaseKHR ? 'KHR' : 'USD');
  const [tenderedUSD, setTenderedUSD] = useState('');
  const [tenderedKHR, setTenderedKHR] = useState('');

  // Change Return Advice Mode: 'riel' (100% in Riel) or 'mixed' (USD whole bills + Riel cents)
  const [changeAdviceMode, setChangeAdviceMode] = useState('riel');

  // Reset tender inputs when drawer opens with fresh payableTotal
  useEffect(() => {
    if (isOpen) {
      setTenderedUSD('');
      setTenderedKHR('');
      setIsEditingRate(false);
    }
  }, [isOpen, payableTotal]);

  // Numerical tender conversions
  const numUSD = parseFloat(tenderedUSD) || 0;
  const numKHR = parseFloat(tenderedKHR) || 0;

  // Total cash received converted to both currencies
  const totalReceivedKHR = numKHR + (numUSD * currentRate);
  const totalReceivedUSD = (numKHR / currentRate) + numUSD;

  // Difference in KHR (positive = change due, negative = short)
  const diffKHR = totalReceivedKHR - totalKHR;
  const isSufficient = diffKHR >= -0.5 || (numUSD === 0 && numKHR === 0 && payableTotal === 0);

  // Rounded change calculations (Nearest ៛100 note)
  const rawChangeKHR = Math.max(0, diffKHR);
  const changeTotalKHR = Math.round(rawChangeKHR / 100) * 100;
  const changeTotalUSD = changeTotalKHR / currentRate;

  // Smart Mixed Change Breakdown:
  // Whole dollar bills in USD + remaining cents in KHR rounded to nearest ៛100
  const changeBreakdownUSD = Math.floor(changeTotalKHR / currentRate);
  const changeBreakdownKHR = Math.round((changeTotalKHR - (changeBreakdownUSD * currentRate)) / 100) * 100;

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
    { label: '៛1,000', value: '1000' },
    { label: '៛5,000', value: '5000' },
    { label: '៛10,000', value: '10000' },
    { label: '៛20,000', value: '20000' },
    { label: '៛50,000', value: '50000' },
    { label: '៛100,000', value: '100000' },
  ];

  const handleChipClick = (val) => {
    if (activeTenderCurrency === 'USD') {
      setTenderedUSD(val);
    } else {
      setTenderedKHR(val);
    }
  };

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

  const handleFinalizePayment = () => {
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
          "relative w-full max-w-md md:max-w-xl bg-background border-l border-restro-border-green shadow-2xl z-10 flex flex-col h-full animate-in slide-in-from-right duration-250 ease-out"
        )}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-restro-border-green shrink-0 bg-restro-gray/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-restro-green/15 text-restro-green flex items-center justify-center">
              <IconCash size={20} stroke={iconStroke} />
            </div>
            <div>
              <h3 className="text-base font-bold text-restro-text leading-tight">
                {t('pos.collect_payment', 'Settle Payment')}
              </h3>
              <p className="text-[11px] text-gray-400">
                Cambodian Dual-Currency Checkout (USD & KHR)
              </p>
            </div>
          </div>

          {/* Rate Badge with Quick Edit */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditingRate(!isEditingRate)}
              className="px-2 py-1 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
              title="Click to adjust USD to KHR exchange rate"
            >
              <span>1$ = ៛{currentRate.toLocaleString()}</span>
              <IconPencil size={12} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-restro-gray hover:bg-restro-button-hover text-restro-text flex items-center justify-center transition active:scale-95 cursor-pointer"
              title="Close payment drawer (Esc)"
            >
              <IconX size={17} stroke={iconStroke} />
            </button>
          </div>
        </div>

        {/* Quick Rate Edit Box (if opened) */}
        {isEditingRate && (
          <div className="px-5 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 flex flex-wrap items-center justify-between gap-2 shrink-0 animate-in slide-in-from-top duration-150">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
              <span>Exchange Rate: 1 USD =</span>
              <input
                type="number"
                value={tempRateInput}
                onChange={(e) => setTempRateInput(e.target.value)}
                className="w-20 px-2 py-1 rounded-lg border border-amber-400 bg-background text-restro-text font-mono font-bold text-xs"
              />
              <span>៛</span>
            </div>
            <div className="flex items-center gap-1">
              {[4000, 4100, 4150].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTempRateInput(String(preset))}
                  className="px-2 py-0.5 rounded-md border border-amber-300 bg-amber-100/60 hover:bg-amber-200 text-amber-800 text-[10px] font-bold"
                >
                  ៛{preset}
                </button>
              ))}
              <button
                type="button"
                onClick={handleSaveRate}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 active:scale-95 ml-1"
              >
                Set
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Main Area */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3.5 scrollbar-thin">
          
          {/* Dual Total Due Card */}
          <div className="rounded-2xl border border-restro-border-green bg-restro-card-bg shadow-sm overflow-hidden">
            <div 
              onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
              className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-restro-button-hover transition select-none"
            >
              <div>
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                  {t('pos.payable_total', 'Total Due')}
                </span>
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <span className="text-2xl sm:text-3xl font-black text-restro-green tracking-tight font-mono">
                    {isBaseKHR ? `៛${Math.round(totalKHR).toLocaleString()}` : `$${totalUSD.toFixed(2)}`}
                  </span>
                  <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 font-mono">
                    ≈ {isBaseKHR ? `$${totalUSD.toFixed(2)} USD` : `៛${Math.round(totalKHR).toLocaleString()} KHR`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold">
                <span>{isSummaryExpanded ? 'Hide' : 'Breakdown'}</span>
                <IconChevronUp 
                  size={16} 
                  stroke={iconStroke} 
                  className={clsx("transition-transform duration-200", !isSummaryExpanded && "rotate-180")} 
                />
              </div>
            </div>

            {/* Collapsible Order Breakdown */}
            {isSummaryExpanded && (
              <div className="px-4 pb-3 pt-1 space-y-1.5 border-t border-restro-border-green/50 text-xs bg-restro-gray/30 animate-in fade-in duration-150">
                <div className="flex justify-between text-gray-500">
                  <span>{t('pos.items_net_total', 'Items Subtotal')}</span>
                  <span className="font-semibold text-restro-text font-mono">
                    {currency}{Number(itemsTotal).toFixed(2)}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>{t('pos.discount_total', 'Discount')}</span>
                    <span className="font-mono">-{currency}{Number(discountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-500">
                  <span>{t('pos.tax_total', 'Tax')}</span>
                  <span className="font-semibold text-restro-text font-mono">+{currency}{Number(taxTotal).toFixed(2)}</span>
                </div>
                {serviceChargeTotal > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>{t('pos.service_charge_total', 'Service Charge')}</span>
                    <span className="font-semibold text-restro-text font-mono">+{currency}{Number(serviceChargeTotal).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment Method Selector Grid */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
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
                      "min-h-[52px] p-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-[0.97] cursor-pointer touch-manipulation relative shadow-2xs select-none",
                      isSelected
                        ? "border-restro-green bg-emerald-500/10 text-restro-green ring-2 ring-restro-green font-bold shadow-sm"
                        : "border-restro-border-green bg-restro-card-bg text-restro-text hover:bg-restro-button-hover"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-restro-green text-white flex items-center justify-center shadow">
                        <IconCheck size={9} stroke={3} />
                      </div>
                    )}
                    {pt.icon && <span className="text-xl leading-none">{PAYMENT_ICONS[pt.icon] || '💳'}</span>}
                    <span className="text-xs font-semibold truncate w-full text-center leading-tight">
                      {pt.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dual Mixed Cash Tender Section */}
          <div className="p-3.5 rounded-2xl border border-restro-border-green bg-restro-gray/40 space-y-3 select-none">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <IconCoin size={14} className="text-restro-green" />
                <span>Cash Tendered (USD / Riel)</span>
              </span>
              {(tenderedUSD || tenderedKHR) && (
                <button
                  type="button"
                  onClick={() => handleNumpadPress('CLEAR_ALL')}
                  className="text-xs text-red-500 hover:underline font-bold cursor-pointer active:scale-95"
                >
                  Clear Both
                </button>
              )}
            </div>

            {/* Dual Input Cards: USD & KHR */}
            <div className="grid grid-cols-2 gap-2">
              {/* USD Tender Box */}
              <div 
                onClick={() => setActiveTenderCurrency('USD')}
                className={clsx(
                  "p-2.5 rounded-xl border transition-all cursor-pointer shadow-2xs flex flex-col justify-between",
                  activeTenderCurrency === 'USD'
                    ? "bg-background border-emerald-500 ring-2 ring-emerald-500/40 shadow-sm"
                    : "bg-background/60 border-restro-border-green hover:border-emerald-400/50"
                )}
              >
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className={clsx(activeTenderCurrency === 'USD' ? "text-emerald-700 dark:text-emerald-400" : "text-gray-400")}>
                    USD ($)
                  </span>
                  {tenderedUSD && (
                    <span 
                      onClick={(e) => { e.stopPropagation(); setTenderedUSD(''); }}
                      className="text-[10px] text-gray-400 hover:text-red-500 px-1"
                    >
                      ✕
                    </span>
                  )}
                </div>
                <div className="text-xl font-black font-mono tracking-wide text-restro-text truncate mt-1">
                  ${tenderedUSD || '0.00'}
                </div>
                <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                  ≈ ៛{Math.round(numUSD * currentRate).toLocaleString()}
                </div>
              </div>

              {/* KHR Tender Box */}
              <div 
                onClick={() => setActiveTenderCurrency('KHR')}
                className={clsx(
                  "p-2.5 rounded-xl border transition-all cursor-pointer shadow-2xs flex flex-col justify-between",
                  activeTenderCurrency === 'KHR'
                    ? "bg-background border-emerald-500 ring-2 ring-emerald-500/40 shadow-sm"
                    : "bg-background/60 border-restro-border-green hover:border-emerald-400/50"
                )}
              >
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className={clsx(activeTenderCurrency === 'KHR' ? "text-emerald-700 dark:text-emerald-400" : "text-gray-400")}>
                    RIEL (៛)
                  </span>
                  {tenderedKHR && (
                    <span 
                      onClick={(e) => { e.stopPropagation(); setTenderedKHR(''); }}
                      className="text-[10px] text-gray-400 hover:text-red-500 px-1"
                    >
                      ✕
                    </span>
                  )}
                </div>
                <div className="text-xl font-black font-mono tracking-wide text-restro-text truncate mt-1">
                  ៛{numKHR > 0 ? numKHR.toLocaleString() : '0'}
                </div>
                <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                  ≈ ${(numKHR / currentRate).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Total Received Summary Banner */}
            {(numUSD > 0 || numKHR > 0) && (
              <div className="px-3 py-1.5 rounded-xl bg-restro-card-bg border border-restro-border-green flex items-center justify-between text-xs">
                <span className="font-bold text-gray-500 text-[11px]">Total Cash Received:</span>
                <div className="text-right font-mono font-black text-restro-text text-xs sm:text-sm">
                  <span>៛{Math.round(totalReceivedKHR).toLocaleString()}</span>
                  <span className="text-gray-400 text-xs ml-1 font-normal">(${totalReceivedUSD.toFixed(2)})</span>
                </div>
              </div>
            )}

            {/* Circulating Banknote Chips (Dynamic based on active currency) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span>Quick {activeTenderCurrency} Notes:</span>
                <span className="text-emerald-600 font-semibold cursor-pointer" onClick={() => setActiveTenderCurrency(activeTenderCurrency === 'USD' ? 'KHR' : 'USD')}>
                  Switch to {activeTenderCurrency === 'USD' ? 'KHR ៛' : 'USD $'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(activeTenderCurrency === 'USD' ? usdChips : khrChips).map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleChipClick(chip.value)}
                    className={clsx(
                      "min-h-[36px] px-2.5 py-1 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer touch-manipulation shadow-2xs",
                      idx === 0
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-black hover:bg-emerald-500/25"
                        : "bg-background border-restro-border-green text-restro-text hover:bg-restro-button-hover"
                    )}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Touch Virtual Numpad */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {[
                '1', '2', '3',
                '4', '5', '6',
                '7', '8', '9',
                activeTenderCurrency === 'KHR' ? '000' : '.', '0', '00'
              ].map((keyVal) => (
                <button
                  key={keyVal}
                  type="button"
                  onClick={() => handleNumpadPress(keyVal)}
                  className="min-h-[46px] rounded-xl border border-restro-border-green bg-background text-restro-text text-base font-black hover:bg-restro-button-hover active:scale-95 transition shadow-2xs flex items-center justify-center cursor-pointer touch-manipulation select-none"
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
                className="min-h-[40px] rounded-xl border border-restro-border-green bg-restro-gray text-gray-500 text-xs font-bold hover:bg-restro-button-hover active:scale-95 transition flex items-center justify-center cursor-pointer touch-manipulation"
              >
                Clear {activeTenderCurrency}
              </button>
              <button
                type="button"
                onClick={() => handleNumpadPress('BACKSPACE')}
                className="min-h-[40px] rounded-xl border border-restro-border-green bg-restro-gray text-restro-text text-xs font-bold hover:bg-restro-button-hover active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation"
              >
                <IconBackspace size={17} stroke={iconStroke} />
                <span>Delete</span>
              </button>
            </div>

            {/* Intelligent Change Due Advice Banner */}
            {(numUSD > 0 || numKHR > 0) && (
              <div 
                className={clsx(
                  "p-3.5 rounded-2xl border space-y-2 shadow-xs transition-all animate-in zoom-in-95 duration-150",
                  isSufficient
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-300"
                    : "bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-300"
                )}
              >
                {/* Header row */}
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider">
                  <span>{isSufficient ? 'Change Return Advice' : 'Payment Remaining'}</span>
                  
                  {/* Change Mode Toggle (All Riel vs Mixed) */}
                  {isSufficient && changeTotalKHR > 0 && (
                    <div className="flex items-center p-0.5 rounded-lg bg-background/80 border border-emerald-500/30 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setChangeAdviceMode('riel')}
                        className={clsx(
                          "px-2 py-0.5 rounded transition cursor-pointer",
                          changeAdviceMode === 'riel'
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "text-gray-500 hover:text-restro-text"
                        )}
                      >
                        ៛ All Riel
                      </button>
                      <button
                        type="button"
                        onClick={() => setChangeAdviceMode('mixed')}
                        className={clsx(
                          "px-2 py-0.5 rounded transition cursor-pointer",
                          changeAdviceMode === 'mixed'
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "text-gray-500 hover:text-restro-text"
                        )}
                      >
                        $ + ៛ Mixed
                      </button>
                    </div>
                  )}
                </div>

                {/* Amount presentation */}
                {isSufficient ? (
                  changeTotalKHR === 0 ? (
                    <div className="text-base font-black text-emerald-700 dark:text-emerald-300 font-mono">
                      Exact Cash Received - No Change Due (៛0)
                    </div>
                  ) : changeAdviceMode === 'mixed' && changeBreakdownUSD > 0 ? (
                    <div>
                      <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-700 dark:text-emerald-300">
                        ${changeBreakdownUSD.toFixed(2)} USD + ៛{changeBreakdownKHR.toLocaleString()} KHR
                      </div>
                      <div className="text-[11px] opacity-80 mt-0.5 flex items-center gap-1 font-medium">
                        <span>Hand customer: {changeBreakdownUSD}x $1 bill + ៛{changeBreakdownKHR.toLocaleString()} in Riel note(s)</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-emerald-700 dark:text-emerald-300">
                        ៛{changeTotalKHR.toLocaleString()} KHR
                      </div>
                      <div className="text-[11px] opacity-80 mt-0.5 flex items-center gap-1 font-medium">
                        <span>(≈ ${changeTotalUSD.toFixed(2)} USD - rounded to nearest ៛100 note)</span>
                      </div>
                    </div>
                  )
                ) : (
                  <div>
                    <div className="text-lg font-black font-mono text-amber-700 dark:text-amber-300">
                      Short by ៛{Math.abs(Math.round(diffKHR)).toLocaleString()} KHR
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Customer still owes ≈ ${Math.abs(diffKHR / currentRate).toFixed(2)} USD
                    </div>
                  </div>
                )}
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
                {discountAmount > 0 ? `-${currency}${Number(discountAmount).toFixed(2)}` : '+ add'}
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
            disabled={isProcessing || !isSufficient}
            onClick={handleFinalizePayment}
            className={clsx(
              "w-full min-h-[52px] px-5 py-3.5 rounded-2xl font-black text-sm text-white flex items-center justify-between transition-all active:scale-[0.98] shadow-lg cursor-pointer touch-manipulation",
              isProcessing || !isSufficient
                ? "bg-gray-400 cursor-not-allowed opacity-60"
                : "bg-restro-green hover:bg-restro-green-button-hover shadow-emerald-600/25"
            )}
          >
            <span className="flex items-center gap-2">
              <IconReceipt size={22} stroke={iconStroke} />
              <span>
                {isProcessing
                  ? t('pos.processing', 'Processing...')
                  : !isSufficient
                  ? 'Cash Tendered Insufficient'
                  : t('pos.complete_and_print', 'Settle & Print Receipt')}
              </span>
            </span>
            <span className="px-3 py-1 rounded-xl bg-white/20 text-xs font-mono font-black">
              {isBaseKHR ? `៛${Math.round(totalKHR).toLocaleString()}` : `$${totalUSD.toFixed(2)}`}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}
