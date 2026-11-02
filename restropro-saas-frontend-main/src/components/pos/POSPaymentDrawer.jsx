import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  IconX, 
  IconCash, 
  IconCheck, 
  IconChevronUp, 
  IconReceipt, 
  IconBackspace, 
  IconArrowsExchange,
  IconPencil,
  IconQrcode,
  IconCreditCard,
  IconBuildingStore,
  IconArmchair,
  IconUser,
  IconAward,
  IconSparkles,
  IconGift,
  IconRotate,
  IconArrowsSplit2,
} from '@tabler/icons-react';
import { PAYMENT_ICONS } from '../../config/payment_icons';
import { clsx } from 'clsx';
import { iconStroke } from '../../config/config';
import { useCustomerLoyalty, useLoyaltySettings } from '../../controllers/loyalty.controller';

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
  promotionDiscountTotal = 0,
  customerGroupDiscountTotal = 0,
  customerGroup = null,
  appliedPromotions = [],
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
  cartItems = [],
  customer = null,
  customerType = 'WALKIN',
  diningOption = 'dinein',
  tableTitle = '',
  onOpenSplitBill,
}) {
  const { t } = useTranslation();
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

  // Exchange rate state (1 USD = X KHR)
  const [currentRate, setCurrentRate] = useState(Number(exchangeRateUsdToKhr) || 4100);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRateInput, setTempRateInput] = useState(String(Number(exchangeRateUsdToKhr) || 4100));

  // Optional card / QR transaction reference note
  const [referenceCode, setReferenceCode] = useState('');

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

  // Loyalty Rewards Integration
  const custPhone = customerType === 'CUSTOMER' && customer?.phone ? customer.phone : null;
  const { loyalty: customerLoyalty } = useCustomerLoyalty(custPhone);
  const { data: loyaltySettings } = useLoyaltySettings();

  const isLoyaltyEnabled = loyaltySettings?.is_enabled !== false;
  const customerPoints = Number(customerLoyalty?.points_balance !== undefined ? customerLoyalty.points_balance : (customer?.points_balance || 0));
  const membershipTier = customerLoyalty?.membership_tier || customer?.membership_tier || 'Standard';
  const dollarValuePerPoint = Number(loyaltySettings?.dollar_value_per_point || 0.01);
  const minPointsToRedeem = Number(loyaltySettings?.min_points_to_redeem || 10);
  const pointsPerDollar = Number(loyaltySettings?.points_per_dollar_spent || 1.0);

  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  // Max points allowed by order subtotal
  const pointValueInLocalCurrency = isBaseKHR && rate > 0 ? dollarValuePerPoint * rate : dollarValuePerPoint;
  const maxPointsAllowedByTotal = Math.floor(safePayable / (pointValueInLocalCurrency || 0.01));
  const maxRedeemablePoints = Math.max(0, Math.min(customerPoints, maxPointsAllowedByTotal));

  // Actual discount from points
  const rawLoyaltyDiscountUSD = pointsToRedeem * dollarValuePerPoint;
  const loyaltyDiscountAmount = isBaseKHR ? rawLoyaltyDiscountUSD * rate : rawLoyaltyDiscountUSD;
  const effectivePayable = Math.max(0, safePayable - loyaltyDiscountAmount);

  // Symmetrical Total calculations (accounting for loyalty point discount)
  const totalKHR = isBaseKHR ? effectivePayable : effectivePayable * rate;
  const totalUSD = isBaseKHR ? (rate > 0 ? effectivePayable / rate : effectivePayable) : effectivePayable;

  const projectedPointsEarned = Math.floor((isBaseKHR && rate > 0 ? effectivePayable / rate : effectivePayable) * pointsPerDollar);

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
      setReferenceCode('');
      setIsEditingRate(false);
      setPointsToRedeem(0);
    }
  }, [isOpen, payableTotal, custPhone]);

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

  // 1-Tap exact payment targeting active currency or remaining balance
  const handleExactTender = () => {
    if (activeTenderCurrency === 'USD') {
      if (numKHR > 0 && diffKHR < 0) {
        const remainingUSD = Math.max(0, Math.abs(diffKHR) / rate);
        setTenderedUSD(remainingUSD.toFixed(2));
      } else {
        setTenderedUSD(totalUSD.toFixed(2));
      }
    } else {
      if (numUSD > 0 && diffKHR < 0) {
        const remainingKHR = Math.round(Math.max(0, Math.abs(diffKHR)) / 100) * 100;
        setTenderedKHR(String(remainingKHR));
      } else {
        setTenderedKHR(String(Math.round(totalKHR)));
      }
    }
  };

  // Quick preset banknote chips
  const usdChips = [
    { label: t('pos.exact_usd', 'Exact ($)'), value: totalUSD.toFixed(2) },
    { label: '$1', value: '1' },
    { label: '$5', value: '5' },
    { label: '$10', value: '10' },
    { label: '$20', value: '20' },
    { label: '$50', value: '50' },
    { label: '$100', value: '100' },
  ];

  const khrChips = [
    { label: t('pos.exact_khr', 'Exact (៛)'), value: String(Math.round(totalKHR)) },
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
      referenceCode: referenceCode.trim() || undefined,
      loyaltyPointsRedeemed: pointsToRedeem,
      loyaltyDiscountAmount: Number(loyaltyDiscountAmount.toFixed(2)),
      loyaltyPointsEarned: projectedPointsEarned,
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
    referenceCode,
    pointsToRedeem,
    loyaltyDiscountAmount,
    projectedPointsEarned,
    onPayAndComplete
  ]);

  // Keyboard Shortcuts (Esc to close, F4 to finalize)
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-200">
      
      {/* ==================== MAIN MODAL CONTAINER ==================== */}
      <div className="w-full max-w-6xl h-full max-h-[96vh] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* ==================== TOP NAVIGATION HEADER BAR ==================== */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/20 shadow-2xs">
              <IconCash size={22} stroke={iconStroke} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                  {t('pos.collect_payment', 'Settle Payment')}
                </h3>
                <span className="hidden sm:inline-block text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  {t('pos.cambodian_dual_currency', 'Cambodian Dual-Currency')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('pos.dual_currency_subtitle', 'Mixed USD & Riel cash tender with smart change advice')}
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
                className="px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
                title={t('pos.adjust_exchange_rate_title', 'Click to adjust exchange rate for this shift')}
              >
                <IconArrowsExchange size={15} />
                <span>1$ = ៛{currentRate.toLocaleString()}</span>
                <IconPencil size={12} className="text-amber-500 dark:text-amber-400" />
              </button>

              {isEditingRate && (
                <div className="absolute right-0 top-full mt-2 w-72 p-3 bg-white dark:bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95">
                  <p className="text-xs font-bold mb-1.5 text-slate-800 dark:text-white">
                    {t('pos.shift_exchange_rate', 'Shift Exchange Rate (1 USD to KHR)')}
                  </p>
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
                            : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
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
                      className="w-full text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]"
                    />
                    <button
                      type="button"
                      onClick={handleSaveRate}
                      className="px-3 py-1.5 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-bold cursor-pointer"
                    >
                      {t('pos.save_rate', 'Save')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {onOpenSplitBill && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSplitBill();
                }}
                className="h-[34px] px-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs hover:bg-indigo-100"
                title={t('pos.split_bill', 'Split Bill')}
              >
                <IconArrowsSplit2 size={16} stroke={iconStroke} />
                <span className="hidden sm:inline">{t('pos.split_bill', 'Split Bill')}</span>
              </button>
            )}

            {/* Close Button */}
            <button 
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Close (Esc)"
            >
              <IconX size={20} stroke={iconStroke} />
              <span className="hidden sm:inline font-mono text-[10px] px-1 py-0.5 rounded bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400">Esc</span>
            </button>
          </div>
        </div>

        {/* ==================== 2-COLUMN FULL-SCREEN WORKSPACE ==================== */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 p-4 sm:p-5 overflow-hidden min-h-0 bg-slate-50 dark:bg-slate-950">
          
          {/* ----------------- LEFT COLUMN (5 of 12 cols) ----------------- */}
          <div className="md:col-span-5 flex flex-col justify-between h-full space-y-3 min-h-0 overflow-y-auto">
            
            <div className="space-y-3">
              
              {/* Order Context Pill: Dining Option / Table / Customer */}
              {(tableTitle || customer?.name || diningOption) && (
                <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
                  {diningOption && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs">
                      <IconBuildingStore size={14} className="text-emerald-600 dark:text-emerald-400" />
                      <span className="capitalize">
                        {diningOption === 'dinein' ? t('pos.dinein', 'Dine-In') : diningOption === 'takeaway' ? t('pos.takeaway', 'Takeaway') : t('pos.delivery', 'Delivery')}
                      </span>
                    </div>
                  )}
                  {tableTitle && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs">
                      <IconArmchair size={14} className="text-blue-600 dark:text-blue-400" />
                      <span>{tableTitle}</span>
                    </div>
                  )}
                  {customer?.name && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs">
                      <IconUser size={14} className="text-purple-600 dark:text-purple-400" />
                      <span className="truncate max-w-[130px]">{customer.name}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Card 1: Payable Total Due (High-contrast emerald card) */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/30 p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    {t('pos.payable_total_due', 'Payable Total Due')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                    className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>{isSummaryExpanded ? t('pos.hide', 'Hide') : t('pos.details', 'Details')}</span>
                    <IconChevronUp size={13} className={clsx("transition-transform duration-200", !isSummaryExpanded && "rotate-180")} />
                  </button>
                </div>

                <div className="flex items-baseline justify-between flex-wrap gap-2">
                  <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-emerald-700 dark:text-emerald-400">
                    {isBaseKHR ? `៛${Math.round(totalKHR).toLocaleString()}` : `$${totalUSD.toFixed(2)}`}
                  </div>
                  <div className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-mono font-bold text-xs sm:text-sm border border-emerald-500/30">
                    ≈ {isBaseKHR ? `$${totalUSD.toFixed(2)} USD` : `៛${Math.round(totalKHR).toLocaleString()} KHR`}
                  </div>
                </div>

                {/* Collapsible details breakdown */}
                {isSummaryExpanded && (
                  <div className="mt-3 pt-3 border-t border-emerald-500/20 text-xs font-mono space-y-1.5 text-slate-600 dark:text-slate-400 animate-in fade-in max-h-48 overflow-y-auto">
                    <div className="flex justify-between">
                      <span>{t('pos.items_net_total', 'Items Net Total')}</span>
                      <span>{currency}{Number(itemsTotal).toFixed(2)}</span>
                    </div>
                    {Number(discountAmount) > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>{t('pos.discount', 'Discount')}</span>
                        <span>-{currency}{Number(discountAmount).toFixed(2)}</span>
                      </div>
                    )}
                    {Number(promotionDiscountTotal) > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>{t('pos.promotions', 'Promotions')}</span>
                        <span>-{currency}{Number(promotionDiscountTotal).toFixed(2)}</span>
                      </div>
                    )}
                    {Number(customerGroupDiscountTotal) > 0 && (
                      <div className="flex justify-between text-indigo-600 dark:text-indigo-400 font-semibold">
                        <span>{customerGroup?.name ? `${customerGroup.name} (${t('pos.customer_group_discount', 'Group Discount')})` : t('pos.customer_group_discount', 'Group Discount')}</span>
                        <span>-{currency}{Number(customerGroupDiscountTotal).toFixed(2)}</span>
                      </div>
                    )}
                    {loyaltyDiscountAmount > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>⭐ {t('pos.loyalty_points', 'Loyalty Reward')} ({pointsToRedeem} pts)</span>
                        <span>-{currency}{Number(loyaltyDiscountAmount).toFixed(2)}</span>
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

                    {/* Mini Cart items preview */}
                    {Array.isArray(cartItems) && cartItems.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-emerald-500/10 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                          {t('pos.cart_items', 'Cart Items')} ({cartItems.length}):
                        </span>
                        {cartItems.map((ci, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[11px]">
                            <span className="truncate max-w-[180px]">
                              <span className="font-bold text-emerald-700 dark:text-emerald-400 mr-1.5">{ci.quantity}x</span>
                              {ci.title}
                            </span>
                            <span className="font-bold">{currency}{(Number(ci.price || 0) * Number(ci.quantity || 1)).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Customer Loyalty & Rewards Section */}
              {custPhone && isLoyaltyEnabled && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="p-1 rounded-lg bg-amber-500 text-white">
                        <IconAward size={16} stroke={2.2} />
                      </span>
                      <div>
                        <span className="text-xs font-black tracking-tight text-amber-900 dark:text-amber-200">
                          {t('pos.customer_loyalty', 'Customer Loyalty & Rewards')}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-800 dark:text-amber-300">
                          <span className="font-bold">{customerPoints} pts</span>
                          <span>≈</span>
                          <span className="font-semibold">{currency}{(customerPoints * dollarValuePerPoint).toFixed(2)}</span>
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200 text-[10px] font-black uppercase">
                            {membershipTier}
                          </span>
                        </div>
                      </div>
                    </div>

                    {pointsToRedeem > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-black font-mono animate-in fade-in">
                        -{currency}{loyaltyDiscountAmount.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-800 dark:text-amber-400 font-medium font-mono">
                        +{projectedPointsEarned} pts
                      </span>
                    )}
                  </div>

                  {/* Points Action Buttons */}
                  {customerPoints < minPointsToRedeem ? (
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 italic">
                      {t('pos.min_points_notice', `Minimum ${minPointsToRedeem} points needed to redeem. This order will earn +${projectedPointsEarned} points!`)}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setPointsToRedeem(0)}
                          className={clsx(
                            "min-h-[42px] px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer border",
                            pointsToRedeem === 0
                              ? "bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900"
                              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                          )}
                        >
                          {t('pos.no_redemption', 'No Points')}
                        </button>

                        {maxRedeemablePoints >= 50 && (
                          <button
                            type="button"
                            onClick={() => setPointsToRedeem(50)}
                            className={clsx(
                              "min-h-[42px] px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer border font-mono",
                              pointsToRedeem === 50
                                ? "bg-amber-600 text-white border-amber-600"
                                : "bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700/50 hover:bg-amber-50"
                            )}
                          >
                            50 pts ({currency}{(50 * dollarValuePerPoint).toFixed(2)})
                          </button>
                        )}

                        {maxRedeemablePoints >= 100 && (
                          <button
                            type="button"
                            onClick={() => setPointsToRedeem(100)}
                            className={clsx(
                              "min-h-[42px] px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer border font-mono",
                              pointsToRedeem === 100
                                ? "bg-amber-600 text-white border-amber-600"
                                : "bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700/50 hover:bg-amber-50"
                            )}
                          >
                            100 pts ({currency}{(100 * dollarValuePerPoint).toFixed(2)})
                          </button>
                        )}

                        {maxRedeemablePoints > 0 && (
                          <button
                            type="button"
                            onClick={() => setPointsToRedeem(maxRedeemablePoints)}
                            className={clsx(
                              "min-h-[42px] px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer border font-mono",
                              pointsToRedeem === maxRedeemablePoints
                                ? "bg-amber-600 text-white border-amber-600"
                                : "bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700/50 hover:bg-amber-50"
                            )}
                          >
                            {t('pos.redeem_max', 'Use Max')} ({maxRedeemablePoints} pts)
                          </button>
                        )}
                      </div>

                      {pointsToRedeem > 0 && (
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                          ✓ {t('pos.points_applied_notice', `Deducting ${pointsToRedeem} points (${currency}${loyaltyDiscountAmount.toFixed(2)}). Customer will have ${customerPoints - pointsToRedeem + projectedPointsEarned} pts after completion.`)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Card 2: Payment Method Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('pos.select_payment_method', 'Select Payment Method')}
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
                            ? "border-[#0ea5e9] bg-[#0ea5e9]/10 text-[#0ea5e9] shadow-2xs ring-2 ring-[#0ea5e9]/20 font-bold"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300"
                        )}
                      >
                        <div className={clsx(
                          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 [&>svg]:w-4 [&>svg]:h-4",
                          isSelected ? "bg-[#0ea5e9] text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
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
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('pos.change_return_advice', 'Change Return Advice')}
                    </span>
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setChangeAdviceMode('riel')}
                        className={clsx(
                          "text-[10px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer",
                          changeAdviceMode === 'riel'
                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                        )}
                      >
                        {t('pos.all_riel', '៛ All Riel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setChangeAdviceMode('mixed')}
                        className={clsx(
                          "text-[10px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer",
                          changeAdviceMode === 'mixed'
                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                        )}
                      >
                        {t('pos.mixed_usd_khr', '$ + ៛ Mixed')}
                      </button>
                    </div>
                  </div>

                  {/* Cash Received summary */}
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('pos.total_cash_received', 'Total Cash Received:')}
                    </span>
                    <span className="font-mono font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                      ៛{Math.round(totalReceivedKHR).toLocaleString()}{" "}
                      <span className="text-slate-500 dark:text-slate-400 font-normal text-[11px]">(${totalReceivedUSD.toFixed(2)})</span>
                    </span>
                  </div>

                  {/* Change Result or Shortfall Notice */}
                  {isSufficient ? (
                    <div className="rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider">
                          {t('pos.change_due', 'Change Due')} {changeAdviceMode === 'mixed' ? '(Mixed $ + ៛)' : '(All Riel ៛)'}:
                        </span>
                        <span className="text-xl font-black font-mono">
                          {changeAdviceMode === 'mixed' && changeBreakdownUSD > 0
                            ? `$${changeBreakdownUSD} + ៛${changeBreakdownKHR.toLocaleString()}`
                            : `៛${changeTotalKHR.toLocaleString()}`}
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1 flex items-center justify-between">
                        <span>{t('pos.nearest_100_rounding', 'Nearest ៛100 note rounding')}</span>
                        <span>≈ ${changeTotalUSD.toFixed(2)} USD</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs font-bold">{t('pos.needs_more_cash', 'Needs More Cash:')}</span>
                        <span className="text-sm sm:text-base font-black font-mono">
                          ៛{Math.round(Math.abs(diffKHR)).toLocaleString()}{" "}
                          <span className="text-[11px] font-normal text-amber-600 dark:text-amber-400">(${Math.abs(diffKHR / currentRate).toFixed(2)})</span>
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
                    ? "opacity-50 cursor-not-allowed bg-slate-400 dark:bg-slate-700 shadow-none"
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
                className="w-full min-h-[40px] py-1.5 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
              >
                {t('pos.cancel_and_return', 'Cancel & Return to Order Ticket')}
              </button>
            </div>

          </div>


          {/* ----------------- RIGHT COLUMN (7 of 12 cols) ----------------- */}
          <div className="md:col-span-7 flex flex-col justify-between h-full bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs min-h-0 overflow-y-auto">
            
            {/* ==================== A. CASH PAYMENT WORKSPACE ==================== */}
            {isCash ? (
              <div className="flex flex-col justify-between h-full space-y-3 min-h-0">
                
                {/* 1. Dual Tender Display Cards */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('pos.cash_tendered', 'Cash Tendered (Tap Card to Select)')}
                    </span>
                    {(tenderedUSD || tenderedKHR) && (
                      <button
                        type="button"
                        onClick={() => { setTenderedUSD(''); setTenderedKHR(''); }}
                        className="text-[11px] font-bold text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition active:scale-95 cursor-pointer touch-manipulation select-none"
                      >
                        {t('pos.clear_both', 'Clear Both')}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* USD Tender Card */}
                    <div
                      onClick={() => setActiveTenderCurrency('USD')}
                      className={clsx(
                        "p-3 sm:p-3.5 rounded-2xl border-2 transition cursor-pointer relative select-none touch-manipulation",
                        activeTenderCurrency === 'USD'
                          ? "border-[#0ea5e9] bg-[#0ea5e9]/10 ring-2 ring-[#0ea5e9]/20 shadow-2xs"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className={clsx("w-2 h-2 rounded-full", activeTenderCurrency === 'USD' ? "bg-[#0ea5e9]" : "bg-slate-400")} />
                          USD ($)
                        </span>
                        {tenderedUSD && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setTenderedUSD(''); }}
                            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 hover:text-red-500 cursor-pointer touch-manipulation"
                          >
                            <IconX size={13} />
                          </button>
                        )}
                      </div>
                      <div className="text-2xl font-black font-mono text-slate-900 dark:text-white truncate">
                        ${tenderedUSD || '0'}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                        ≈ ៛{Math.round(numUSD * currentRate).toLocaleString()}
                      </div>
                    </div>

                    {/* RIEL Tender Card */}
                    <div
                      onClick={() => setActiveTenderCurrency('KHR')}
                      className={clsx(
                        "p-3 sm:p-3.5 rounded-2xl border-2 transition cursor-pointer relative select-none touch-manipulation",
                        activeTenderCurrency === 'KHR'
                          ? "border-[#0ea5e9] bg-[#0ea5e9]/10 ring-2 ring-[#0ea5e9]/20 shadow-2xs"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className={clsx("w-2 h-2 rounded-full", activeTenderCurrency === 'KHR' ? "bg-[#0ea5e9]" : "bg-slate-400")} />
                          RIEL (៛)
                        </span>
                        {tenderedKHR && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setTenderedKHR(''); }}
                            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 hover:text-red-500 cursor-pointer touch-manipulation"
                          >
                            <IconX size={13} />
                          </button>
                        )}
                      </div>
                      <div className="text-2xl font-black font-mono text-slate-900 dark:text-white truncate">
                        ៛{tenderedKHR ? Number(tenderedKHR).toLocaleString() : '0'}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                        ≈ ${(numKHR / currentRate).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Banknote Quick Preset Chips (Both currencies stacked) */}
                <div className="space-y-1.5">
                  {/* USD Banknotes */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {t('pos.quick_usd_banknotes', 'Quick USD Banknotes ($):')}
                      </span>
                      {activeTenderCurrency === 'USD' && (
                        <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">
                          ● {t('pos.active', 'Active')}
                        </span>
                      )}
                    </div>
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
                            "h-10 sm:h-11 px-1 rounded-xl font-mono font-bold text-[10px] sm:text-[11px] border transition active:scale-95 cursor-pointer flex items-center justify-center truncate touch-manipulation select-none",
                            tenderedUSD === chip.value
                              ? "bg-[#0ea5e9] text-white border-[#0ea5e9] shadow-2xs"
                              : activeTenderCurrency === 'USD'
                                ? "bg-sky-50/70 hover:bg-sky-100/80 dark:bg-sky-950/30 dark:hover:bg-sky-900/40 text-slate-700 dark:text-slate-200 border-sky-200/70 dark:border-sky-800/40"
                                : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                          )}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* KHR Banknotes */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {t('pos.quick_khr_banknotes', 'Quick Riel Banknotes (៛):')}
                      </span>
                      {activeTenderCurrency === 'KHR' && (
                        <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">
                          ● {t('pos.active', 'Active')}
                        </span>
                      )}
                    </div>
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
                            "h-10 sm:h-11 px-1 rounded-xl font-mono font-bold text-[10px] sm:text-[11px] border transition active:scale-95 cursor-pointer flex items-center justify-center truncate touch-manipulation select-none",
                            tenderedKHR === chip.value
                              ? "bg-[#0ea5e9] text-white border-[#0ea5e9] shadow-2xs"
                              : activeTenderCurrency === 'KHR'
                                ? "bg-sky-50/70 hover:bg-sky-100/80 dark:bg-sky-950/30 dark:hover:bg-sky-900/40 text-slate-700 dark:text-slate-200 border-sky-200/70 dark:border-sky-800/40"
                                : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                          )}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. High-Density Touch Numpad (Unified 3-Column x 5-Row POS Keypad) */}
                <div className="flex-1 flex flex-col justify-end min-h-0 pt-1">
                  <div className="grid grid-cols-3 gap-2 w-full">
                    {/* Digits 1-9 */}
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handleNumpadPress(n)}
                        className="h-12 sm:h-13 md:h-14 rounded-2xl bg-slate-100/90 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-2xl sm:text-3xl font-mono font-black border border-slate-200 dark:border-slate-700 transition active:scale-95 active:bg-slate-300 dark:active:bg-slate-600 flex items-center justify-center cursor-pointer shadow-2xs select-none touch-manipulation"
                      >
                        {n}
                      </button>
                    ))}

                    {/* Row 4: Key 10: '.' for USD, '00' for KHR */}
                    <button
                      type="button"
                      onClick={() => handleNumpadPress(activeTenderCurrency === 'KHR' ? '00' : '.')}
                      className="h-12 sm:h-13 md:h-14 rounded-2xl bg-slate-100/90 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xl sm:text-2xl font-mono font-black border border-slate-200 dark:border-slate-700 transition active:scale-95 active:bg-slate-300 dark:active:bg-slate-600 flex items-center justify-center cursor-pointer shadow-2xs select-none touch-manipulation"
                    >
                      {activeTenderCurrency === 'KHR' ? '00' : '.'}
                    </button>

                    {/* Key 11: '0' */}
                    <button
                      type="button"
                      onClick={() => handleNumpadPress('0')}
                      className="h-12 sm:h-13 md:h-14 rounded-2xl bg-slate-100/90 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-2xl sm:text-3xl font-mono font-black border border-slate-200 dark:border-slate-700 transition active:scale-95 active:bg-slate-300 dark:active:bg-slate-600 flex items-center justify-center cursor-pointer shadow-2xs select-none touch-manipulation"
                    >
                      0
                    </button>

                    {/* Key 12: '00' for USD, '000' for KHR */}
                    <button
                      type="button"
                      onClick={() => handleNumpadPress(activeTenderCurrency === 'KHR' ? '000' : '00')}
                      className="h-12 sm:h-13 md:h-14 rounded-2xl bg-slate-100/90 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-lg sm:text-xl font-mono font-black border border-slate-200 dark:border-slate-700 transition active:scale-95 active:bg-slate-300 dark:active:bg-slate-600 flex items-center justify-center cursor-pointer shadow-2xs select-none touch-manipulation"
                    >
                      {activeTenderCurrency === 'KHR' ? '000' : '00'}
                    </button>

                    {/* Row 5: Action Row (Col 1: Clear, Col 2: Exact, Col 3: Delete) */}
                    {/* Key 13: Clear Active Currency */}
                    <button
                      type="button"
                      onClick={() => handleNumpadPress('CLEAR')}
                      className="h-12 sm:h-13 md:h-14 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200/90 dark:border-rose-900/60 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs select-none touch-manipulation"
                      title={t('pos.clear_currency', 'Clear')}
                    >
                      <IconRotate size={16} stroke={iconStroke} />
                      <span>{t('pos.clear', 'Clear')}</span>
                    </button>

                    {/* Key 14: Exact Tender */}
                    <button
                      type="button"
                      onClick={handleExactTender}
                      className="h-12 sm:h-13 md:h-14 rounded-2xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800/60 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs select-none touch-manipulation"
                      title={t('pos.exact', 'Exact Amount')}
                    >
                      <IconCheck size={16} stroke={2.5} />
                      <span>{t('pos.exact', 'Exact')}</span>
                    </button>

                    {/* Key 15: Backspace / Delete */}
                    <button
                      type="button"
                      onClick={() => handleNumpadPress('BACKSPACE')}
                      className="h-12 sm:h-13 md:h-14 rounded-2xl bg-slate-200/90 hover:bg-slate-300 dark:bg-slate-750 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-650 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs select-none touch-manipulation"
                      title={t('pos.delete', 'Delete')}
                    >
                      <IconBackspace size={19} stroke={iconStroke} />
                      <span>{t('pos.delete', 'Delete')}</span>
                    </button>
                  </div>
                </div>

              </div>
            ) : isQr ? (
              /* ==================== B. KHQR WORKSPACE ==================== */
              <div className="flex flex-col items-center justify-center h-full p-4 sm:p-6 text-center space-y-4">
                <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-xs">
                  <IconQrcode size={44} stroke={iconStroke} />
                </div>

                <div>
                  <h4 className="text-xl font-black text-slate-900 dark:text-white">
                    {t('pos.scan_khqr_guide', 'Scan to Pay with KHQR / Banking App')}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                    {t('pos.scan_khqr_subtitle', 'Customer scans via ABA Mobile, Wing, Bakong, or any local banking app')}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1 w-full max-w-xs shadow-2xs">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {t('pos.total_qr_amount', 'Total QR Amount:')}
                  </div>
                  <div className="text-3xl font-black font-mono text-emerald-700 dark:text-emerald-400">
                    {isBaseKHR ? `៛${Math.round(totalKHR).toLocaleString()}` : `$${totalUSD.toFixed(2)}`}
                  </div>
                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    ≈ {isBaseKHR ? `$${totalUSD.toFixed(2)} USD` : `៛${Math.round(totalKHR).toLocaleString()} KHR`}
                  </div>
                </div>

                {/* Optional Transaction Reference Note */}
                <div className="w-full max-w-xs text-left space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {t('pos.card_reference_optional', 'Card Auth / Ref Number (Optional)')}
                  </label>
                  <input
                    type="text"
                    value={referenceCode}
                    onChange={(e) => setReferenceCode(e.target.value)}
                    placeholder="e.g. ABA-108293 / Ref"
                    className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleFinalizePayment}
                  disabled={isProcessing}
                  className="w-full max-w-xs min-h-[52px] py-3 rounded-2xl bg-restro-green hover:bg-restro-green-button-hover text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition active:scale-95 cursor-pointer"
                >
                  {isProcessing ? t('pos.please_wait', 'Processing...') : t('pos.confirm_qr_payment', 'Confirm QR Payment & Print Receipt')}
                </button>
              </div>
            ) : (
              /* ==================== C. CARD / ELECTRONIC TERMINAL WORKSPACE ==================== */
              <div className="flex flex-col items-center justify-center h-full p-4 sm:p-6 text-center space-y-4">
                <div className="w-20 h-20 rounded-3xl bg-[#0ea5e9]/10 text-[#0ea5e9] flex items-center justify-center border border-[#0ea5e9]/30 shadow-xs">
                  <IconCreditCard size={44} stroke={iconStroke} />
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900 dark:text-white">
                    {t('pos.electronic_card_terminal', 'Electronic Payment Terminal')}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                    {t('pos.card_terminal_guide', 'Swipe or tap customer card on the payment terminal')}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1 w-full max-w-xs shadow-2xs">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {t('pos.payable_total_due', 'Payable Total Due')}:
                  </div>
                  <div className="text-3xl font-black font-mono text-emerald-700 dark:text-emerald-400">
                    {isBaseKHR ? `៛${Math.round(totalKHR).toLocaleString()}` : `$${totalUSD.toFixed(2)}`}
                  </div>
                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    ≈ {isBaseKHR ? `$${totalUSD.toFixed(2)} USD` : `៛${Math.round(totalKHR).toLocaleString()} KHR`}
                  </div>
                </div>

                {/* Optional Terminal Slip / Auth Reference Code */}
                <div className="w-full max-w-xs text-left space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {t('pos.card_reference_optional', 'Card Auth / Ref Number (Optional)')}
                  </label>
                  <input
                    type="text"
                    value={referenceCode}
                    onChange={(e) => setReferenceCode(e.target.value)}
                    placeholder="e.g. AUTH-482910 / Approval code"
                    className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleFinalizePayment}
                  disabled={isProcessing}
                  className="w-full max-w-xs min-h-[52px] py-3 rounded-2xl bg-restro-green hover:bg-restro-green-button-hover text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition active:scale-95 cursor-pointer"
                >
                  {isProcessing ? t('pos.please_wait', 'Processing...') : t('pos.confirm_card_payment', 'Confirm Card Payment & Print Receipt')}
                </button>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
