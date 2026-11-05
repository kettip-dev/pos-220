import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  IconX, 
  IconCash, 
  IconCheck, 
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
  IconWallet,
  IconGift,
  IconRotate,
  IconArrowsSplit2,
  IconPlus,
  IconTrash,
  IconClockDollar,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { PAYMENT_ICONS } from '../../config/payment_icons';
import { clsx } from 'clsx';
import { iconStroke } from '../../config/config';
import { useCustomerLoyalty, useLoyaltySettings } from '../../controllers/loyalty.controller';
import { useCustomerCredit } from '../../controllers/customer_credit.controller';

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
  // Pay Later: put the unpaid balance on the customer's account. Off where a
  // bill is settled per seat (split bill), which has its own ledger.
  allowPayLater = true,
}) {
  const { t } = useTranslation();

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

  // Split tender: earlier part-payments (e.g. $5 cash, rest by KHQR). Amounts are in the store currency.
  const [paidLines, setPaidLines] = useState([]);
  const [partialAmount, setPartialAmount] = useState('');
  const paidTotal = paidLines.reduce((acc, line) => acc + Number(line.amount || 0), 0);
  const remainingDue = Math.max(0, Number((effectivePayable - paidTotal).toFixed(2)));

  // Symmetrical Total calculations for what is still due (after loyalty and part-payments)
  const totalKHR = isBaseKHR ? remainingDue : remainingDue * rate;
  const totalUSD = isBaseKHR ? (rate > 0 ? remainingDue / rate : remainingDue) : remainingDue;

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
      setPaidLines([]);
      setPartialAmount('');
    }
  }, [isOpen, payableTotal, custPhone]);

  // Payment method classification
  const paymentList = Array.isArray(paymentTypes) ? paymentTypes : [];
  const selectedPaymentObj = paymentList.find(pt => pt.id === selectedPaymentType);
  const selectedPaymentTitle = (selectedPaymentObj?.title || '').toLowerCase();
  // The explicit "counts as cash" flag decides; the title match covers servers that predate it.
  const isCash = selectedPaymentObj && selectedPaymentObj.is_cash !== undefined && selectedPaymentObj.is_cash !== null
    ? Number(selectedPaymentObj.is_cash) === 1
    : selectedPaymentTitle.includes('cash') || selectedPaymentTitle.includes('សាច់ប្រាក់') || !selectedPaymentType;
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

  // Change the drawer actually hands back, per currency, for the ledger.
  const changeOut = changeAdviceMode === 'mixed'
    ? { changeUSD: changeBreakdownUSD, changeKHR: changeBreakdownKHR }
    : { changeUSD: 0, changeKHR: changeTotalKHR };

  const handleFinalizePayment = useCallback(() => {
    const finalLine = {
      paymentTypeId: selectedPaymentType,
      amount: remainingDue,
      reference: referenceCode.trim() || undefined,
      ...(isCash && (numUSD > 0 || numKHR > 0)
        ? { tender: { tenderedUSD: numUSD, tenderedKHR: numKHR, ...changeOut } }
        : {}),
    };
    const tenderData = {
      payments: [...paidLines, finalLine],
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
    onPayAndComplete,
    paidLines,
    remainingDue,
    selectedPaymentType,
    isCash,
    changeOut.changeUSD,
    changeOut.changeKHR,
  ]);

  // Part-payment from the current method: cash takes what was handed over, other methods the amount typed.
  const receivedInBase = isBaseKHR ? totalReceivedKHR : totalReceivedUSD;
  const partialValue = isCash ? receivedInBase : Number(partialAmount) || 0;
  const canAddPartial = !isProcessing && selectedPaymentType && partialValue > 0 && partialValue < remainingDue - 0.004;

  const handleAddPartial = () => {
    if (!canAddPartial) return;
    const amount = Number(partialValue.toFixed(isBaseKHR ? 0 : 2));
    setPaidLines((prev) => [
      ...prev,
      {
        paymentTypeId: selectedPaymentType,
        paymentTypeTitle: selectedPaymentObj?.title,
        amount,
        reference: referenceCode.trim() || undefined,
        ...(isCash ? { tender: { tenderedUSD: numUSD, tenderedKHR: numKHR, changeUSD: 0, changeKHR: 0 } } : {}),
      },
    ]);
    setTenderedUSD('');
    setTenderedKHR('');
    setPartialAmount('');
    setReferenceCode('');
  };

  // ── Pay Later (customer account) ──
  const [isPayLaterOpen, setIsPayLaterOpen] = useState(false);
  const [payLaterDueDays, setPayLaterDueDays] = useState(null);
  const [payLaterNote, setPayLaterNote] = useState('');
  const { data: customerCredit } = useCustomerCredit(isOpen && allowPayLater ? custPhone : null);
  const creditOutstanding = Number(customerCredit?.outstanding || 0);
  const creditLimit = customerCredit?.credit_limit ?? null;
  const creditAvailable = creditLimit === null ? null : Math.max(0, Number(creditLimit) - creditOutstanding);
  const exceedsCreditLimit = creditLimit !== null && remainingDue > (creditAvailable ?? 0) + 0.004;
  const canPayLater = allowPayLater && !!custPhone && remainingDue > 0.004 && !isProcessing;

  useEffect(() => {
    if (isOpen) {
      setIsPayLaterOpen(false);
      setPayLaterDueDays(null);
      setPayLaterNote('');
    }
  }, [isOpen]);

  const payLaterDueDate = (() => {
    if (!payLaterDueDays) return null;
    const d = new Date();
    d.setDate(d.getDate() + payLaterDueDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const handleConfirmPayLater = () => {
    if (!canPayLater || !onPayAndComplete) return;
    onPayAndComplete({
      // Only part-payments already taken are sent; the rest is owed.
      payments: paidLines,
      payLater: {
        dueDate: payLaterDueDate,
        note: payLaterNote.trim() || undefined,
      },
      payLaterBalance: remainingDue,
      payLaterPaidNow: Number(paidTotal.toFixed(2)),
      payLaterDueDate,
      tenderedUSD: 0,
      tenderedKHR: 0,
      totalReceivedKHR: 0,
      totalReceivedUSD: 0,
      changeTotalKHR: 0,
      changeTotalUSD: 0,
      changeBreakdownUSD: 0,
      changeBreakdownKHR: 0,
      changeMode: changeAdviceMode,
      exchangeRate: currentRate,
      isBaseKHR,
      loyaltyPointsRedeemed: pointsToRedeem,
      loyaltyDiscountAmount: Number(loyaltyDiscountAmount.toFixed(2)),
      loyaltyPointsEarned: projectedPointsEarned,
    });
  };

  // Keyboard Shortcuts (Esc to close, F4 to finalize)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isPayLaterOpen) {
          setIsPayLaterOpen(false);
          return;
        }
        onClose();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (isPayLaterOpen) return;
        handleFinalizePayment();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleFinalizePayment, onClose, isPayLaterOpen]);


  if (!isOpen) return null;

  const fmtUSD = (v) => `$${Number(v || 0).toFixed(2)}`;
  const fmtKHR = (v) => `៛${Math.round(Number(v || 0)).toLocaleString()}`;
  const primaryDue = isBaseKHR ? fmtKHR(totalKHR) : fmtUSD(totalUSD);
  const secondaryDue = isBaseKHR ? fmtUSD(totalUSD) : fmtKHR(totalKHR);

  const hasTender = numUSD > 0 || numKHR > 0;
  const isCtaDisabled = isProcessing || (isCash && !isSufficient && hasTender) || (!isCash && Number(partialAmount) > 0 && Number(partialAmount) < remainingDue - 0.004);
  const ctaLabel = isProcessing
    ? t('pos.please_wait', 'Processing...')
    : isCash
      ? t('pos.settle_and_print', 'Settle & Print Receipt')
      : isQr
        ? t('pos.confirm_qr_payment', 'Confirm QR Payment & Print Receipt')
        : t('pos.confirm_card_payment', 'Confirm Card Payment & Print Receipt');

  const changeDisplay = changeAdviceMode === 'mixed' && changeBreakdownUSD > 0
    ? `$${changeBreakdownUSD} + ${fmtKHR(changeBreakdownKHR)}`
    : fmtKHR(changeTotalKHR);

  const diningLabel = diningOption === 'dinein'
    ? t('pos.dinein', 'Dine-In')
    : diningOption === 'takeaway'
      ? t('pos.takeaway', 'Takeaway')
      : t('pos.delivery', 'Delivery');

  // Only the active currency's banknotes are shown, keeping the keypad area uncluttered
  const activeNoteChips = (activeTenderCurrency === 'USD' ? usdChips : khrChips).slice(1);
  const activeTenderValue = activeTenderCurrency === 'USD' ? tenderedUSD : tenderedKHR;

  const breakdownRows = [
    { label: t('pos.items_net_total', 'Items Net Total'), value: Number(itemsTotal), sign: '' },
    { label: t('pos.discount', 'Discount'), value: Number(discountAmount), sign: '-', tone: 'discount' },
    { label: t('pos.promotions', 'Promotions'), value: Number(promotionDiscountTotal), sign: '-', tone: 'discount' },
    {
      label: customerGroup?.name
        ? `${customerGroup.name} (${t('pos.customer_group_discount', 'Group Discount')})`
        : t('pos.customer_group_discount', 'Group Discount'),
      value: Number(customerGroupDiscountTotal),
      sign: '-',
      tone: 'discount',
    },
    { label: `${t('pos.loyalty_points', 'Loyalty Reward')} (${pointsToRedeem} pts)`, value: loyaltyDiscountAmount, sign: '-', tone: 'discount' },
    { label: t('pos.tax_total', 'Tax Total'), value: Number(taxTotal), sign: '+' },
    { label: t('pos.service_charge', 'Service Charge'), value: Number(serviceChargeTotal), sign: '+' },
  ].filter((row, idx) => idx === 0 || row.value > 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 select-none animate-in fade-in duration-200">

      {/* ==================== MAIN MODAL CONTAINER ==================== */}
      <div className="w-full max-w-6xl h-full sm:max-h-[96vh] bg-white dark:bg-slate-900 sm:border border-slate-200 dark:border-slate-800 sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">

        {/* ==================== HEADER ==================== */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <IconCash size={22} stroke={iconStroke} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
                {t('pos.collect_payment', 'Settle Payment')}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                {diningOption && (
                  <span className="flex items-center gap-1 shrink-0">
                    <IconBuildingStore size={14} stroke={iconStroke} />
                    {diningLabel}
                  </span>
                )}
                {tableTitle && (
                  <>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <span className="flex items-center gap-1 shrink-0">
                      <IconArmchair size={14} stroke={iconStroke} />
                      {tableTitle}
                    </span>
                  </>
                )}
                {customer?.name && (
                  <>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <span className="flex items-center gap-1 min-w-0">
                      <IconUser size={14} stroke={iconStroke} className="shrink-0" />
                      <span className="truncate">{customer.name}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Shift exchange rate with inline editor popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsEditingRate(!isEditingRate)}
                className={clsx(
                  "h-[42px] px-3 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-all duration-150 active:scale-95 cursor-pointer",
                  isEditingRate
                    ? "border-amber-400 bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                )}
                title={t('pos.adjust_exchange_rate_title', 'Click to adjust exchange rate for this shift')}
              >
                <IconArrowsExchange size={16} stroke={iconStroke} className="text-amber-500" />
                <span className="tabular-nums">$1 = ៛{currentRate.toLocaleString()}</span>
                <IconPencil size={13} stroke={iconStroke} className="text-slate-400 hidden sm:block" />
              </button>

              {isEditingRate && (
                <div className="absolute right-0 top-full mt-2 w-72 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95">
                  <p className="text-xs font-semibold mb-2.5 text-slate-700 dark:text-slate-200">
                    {t('pos.shift_exchange_rate', 'Shift Exchange Rate (1 USD to KHR)')}
                  </p>
                  <div className="grid grid-cols-3 gap-2 mb-2.5">
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
                          "h-[42px] text-sm font-semibold tabular-nums rounded-xl border transition-all duration-150 active:scale-95 cursor-pointer",
                          currentRate === r
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
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
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveRate()}
                      placeholder="e.g. 4100"
                      className="w-full h-[42px] text-sm font-semibold tabular-nums px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveRate}
                      className="h-[42px] px-4 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 text-white dark:text-slate-900 text-sm font-semibold transition-all duration-150 active:scale-95 cursor-pointer"
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
                className="h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold flex items-center gap-2 transition-all duration-150 active:scale-95 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700"
                title={t('pos.split_bill', 'Split Bill')}
              >
                <IconArrowsSplit2 size={16} stroke={iconStroke} className="text-indigo-500" />
                <span className="hidden sm:inline">{t('pos.split_bill', 'Split Bill')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-[42px] h-[42px] rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-150 active:scale-95 cursor-pointer flex items-center justify-center"
              title={`${t('pos.cancel', 'Cancel')} (Esc)`}
            >
              <IconX size={20} stroke={iconStroke} />
            </button>
          </div>
        </div>

        {/* ==================== WORKSPACE ==================== */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-y-auto md:overflow-hidden">

          {/* ----------------- LEFT: Amount, method, loyalty, order summary ----------------- */}
          <div className="md:col-span-5 flex flex-col gap-4 p-4 sm:p-5 bg-slate-50 dark:bg-slate-950/60 md:border-r border-slate-200 dark:border-slate-800 md:min-h-0 md:overflow-y-auto">

            {/* Amount due */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('pos.payable_total_due', 'Payable Total Due')}
              </p>
              <div className="flex items-end justify-between gap-3 mt-1">
                <div className="text-4xl sm:text-5xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white leading-none">
                  {primaryDue}
                </div>
                <div className="text-sm font-semibold tabular-nums text-slate-500 dark:text-slate-400 pb-1">
                  ≈ {secondaryDue}
                </div>
              </div>
              {loyaltyDiscountAmount > 0 && (
                <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {t('pos.loyalty_points', 'Loyalty Reward')}: -{currency}{loyaltyDiscountAmount.toFixed(2)}
                </p>
              )}
            </div>

            {/* Split tender: part-payments already taken */}
            {paidLines.length > 0 && (
              <div className="rounded-xl border border-sky-200 dark:border-sky-500/30 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                <div className="px-3 py-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                  <span>{t('pos.split_tender', 'Split tender')}</span>
                  <span className="tabular-nums">{t('pos.total', 'Total')} {currency}{effectivePayable.toFixed(2)}</span>
                </div>
                {paidLines.map((line, idx) => (
                  <div key={idx} className="px-3 py-1.5 flex items-center gap-2 text-sm">
                    <span className="flex-1 min-w-0 truncate text-slate-700 dark:text-slate-200">{line.paymentTypeTitle}</span>
                    <span className="tabular-nums font-semibold text-slate-900 dark:text-white">{currency}{Number(line.amount).toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => setPaidLines((prev) => prev.filter((_, i) => i !== idx))}
                      className="w-[42px] h-[42px] -my-1 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 active:scale-95 cursor-pointer"
                      title={t('pos.remove', 'Remove')}
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                ))}
                <div className="px-3 py-2 flex items-center justify-between text-sm font-bold text-slate-900 dark:text-white">
                  <span>{t('pos.remaining', 'Remaining')}</span>
                  <span className="tabular-nums">{primaryDue}</span>
                </div>
              </div>
            )}

            {/* Payment method */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('pos.select_payment_method', 'Select Payment Method')}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-2">
                {paymentList.map((pt) => {
                  const isSelected = selectedPaymentType === pt.id;
                  return (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => onSelectPaymentType(pt.id)}
                      className={clsx(
                        "relative min-h-[56px] px-3 py-2 rounded-xl border flex items-center gap-3 text-left transition-all duration-150 active:scale-95 cursor-pointer select-none touch-manipulation",
                        isSelected
                          ? "border-sky-500 bg-white dark:bg-sky-500/10 ring-2 ring-sky-500/25 shadow-sm"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
                      )}
                    >
                      <div className={clsx(
                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 [&>svg]:w-5 [&>svg]:h-5",
                        isSelected ? "bg-sky-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      )}>
                        {getPaymentIcon(pt)}
                      </div>
                      <span className={clsx(
                        "flex-1 text-sm leading-snug line-clamp-2",
                        isSelected ? "font-semibold text-slate-900 dark:text-white" : "font-medium text-slate-700 dark:text-slate-300"
                      )}>
                        {pt.title}
                      </span>
                      {isSelected && (
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                          <IconCheck size={12} stroke={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Customer loyalty & rewards */}
            {custPhone && isLoyaltyEnabled && (
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <IconAward size={18} stroke={iconStroke} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {t('pos.customer_loyalty', 'Customer Loyalty & Rewards')}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        <span className="font-semibold text-amber-700 dark:text-amber-300">{customerPoints} pts</span>
                        <span>≈ {currency}{(customerPoints * dollarValuePerPoint).toFixed(2)}</span>
                        <span className="px-1.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 text-[10px] font-bold uppercase">
                          {membershipTier}
                        </span>
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 shrink-0">
                    +{projectedPointsEarned} pts
                  </span>
                </div>

                {customerPoints < minPointsToRedeem ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('pos.min_points_notice', `Minimum ${minPointsToRedeem} points needed to redeem. This order will earn +${projectedPointsEarned} points!`)}
                  </p>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { pts: 0, label: t('pos.no_redemption', 'No Points'), show: true },
                      { pts: 50, label: `50 pts · ${currency}${(50 * dollarValuePerPoint).toFixed(2)}`, show: maxRedeemablePoints >= 50 },
                      { pts: 100, label: `100 pts · ${currency}${(100 * dollarValuePerPoint).toFixed(2)}`, show: maxRedeemablePoints >= 100 },
                      { pts: maxRedeemablePoints, label: `${t('pos.redeem_max', 'Use Max')} · ${maxRedeemablePoints}`, show: maxRedeemablePoints > 0 },
                    ].filter((o) => o.show).map((o) => (
                      <button
                        key={`${o.label}`}
                        type="button"
                        onClick={() => setPointsToRedeem(o.pts)}
                        disabled={paidLines.length > 0}
                        className={clsx(
                          "min-h-[42px] px-3 rounded-xl text-xs font-semibold tabular-nums border transition-all duration-150 active:scale-95 cursor-pointer",
                          pointsToRedeem === o.pts
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-amber-300"
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Order summary */}
            <div className="flex-1 min-h-[160px] flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('pos.order_summary', 'Order Summary')}
                </span>
                {Array.isArray(cartItems) && cartItems.length > 0 && (
                  <span className="text-xs font-medium text-slate-400">
                    {cartItems.length} {t('pos.items_count', 'items')}
                  </span>
                )}
              </div>

              {Array.isArray(cartItems) && cartItems.length > 0 && (
                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 divide-y divide-slate-100 dark:divide-slate-800">
                  {cartItems.map((ci, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-3 py-1.5 text-sm">
                      <span className="flex gap-2 min-w-0 text-slate-700 dark:text-slate-300">
                        <span className="font-semibold tabular-nums text-slate-400 shrink-0">{ci.quantity}×</span>
                        <span className="truncate">{ci.title}</span>
                      </span>
                      <span className="font-medium tabular-nums text-slate-900 dark:text-white shrink-0">
                        {currency}{(Number(ci.price || 0) * Number(ci.quantity || 1)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-auto px-4 py-3 space-y-1.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 text-sm">
                {breakdownRows.map((row, idx) => (
                  <div
                    key={idx}
                    className={clsx(
                      "flex justify-between gap-3",
                      row.tone === 'discount' ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    <span className="truncate">{row.label}</span>
                    <span className="tabular-nums shrink-0">{row.sign}{currency}{row.value.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-3 pt-1.5 border-t border-dashed border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-white">
                  <span>{t('pos.payable_total_due', 'Payable Total Due')}</span>
                  <span className="tabular-nums">{primaryDue}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ----------------- RIGHT: Method-specific workspace ----------------- */}
          <div className="md:col-span-7 flex flex-col p-4 sm:p-5 md:min-h-0 md:overflow-y-auto">

            {isCash ? (
              /* ==================== A. CASH ==================== */
              <div className="flex-1 flex flex-col gap-4 min-h-0">

                {/* Tender currency cards */}
                <div>
                  <div className="flex items-center justify-between mb-2 min-h-[24px]">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {t('pos.cash_tendered', 'Cash Tendered (Tap Card to Select)')}
                    </span>
                    {hasTender && (
                      <button
                        type="button"
                        onClick={() => { setTenderedUSD(''); setTenderedKHR(''); }}
                        className="text-xs font-semibold text-rose-500 hover:text-rose-600 transition active:scale-95 cursor-pointer"
                      >
                        {t('pos.clear_both', 'Clear Both')}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TenderCard
                      active={activeTenderCurrency === 'USD'}
                      label="USD"
                      symbol="$"
                      value={`$${tenderedUSD || '0'}`}
                      hasValue={!!tenderedUSD}
                      equivalent={`≈ ${fmtKHR(numUSD * currentRate)}`}
                      onSelect={() => setActiveTenderCurrency('USD')}
                      onClear={() => setTenderedUSD('')}
                    />
                    <TenderCard
                      active={activeTenderCurrency === 'KHR'}
                      label="KHR"
                      symbol="៛"
                      value={`៛${tenderedKHR ? Number(tenderedKHR).toLocaleString() : '0'}`}
                      hasValue={!!tenderedKHR}
                      equivalent={`≈ ${fmtUSD(numKHR / currentRate)}`}
                      onSelect={() => setActiveTenderCurrency('KHR')}
                      onClear={() => setTenderedKHR('')}
                    />
                  </div>
                </div>

                {/* Quick banknotes for the active currency */}
                <div className="grid grid-cols-6 gap-2">
                  {activeNoteChips.map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => {
                        if (activeTenderCurrency === 'USD') setTenderedUSD(chip.value);
                        else setTenderedKHR(chip.value);
                      }}
                      className={clsx(
                        "h-12 rounded-xl text-sm font-semibold tabular-nums border transition-all duration-150 active:scale-95 cursor-pointer touch-manipulation select-none",
                        activeTenderValue === chip.value
                          ? "bg-sky-500 text-white border-sky-500 shadow-sm"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-sky-300 hover:bg-sky-50 dark:hover:bg-slate-700"
                      )}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Keypad: 4 columns with actions on the right */}
                <div className="flex-1 min-h-[260px] grid grid-cols-4 grid-rows-4 gap-2">
                  {['1', '2', '3'].map((n) => (
                    <KeypadKey key={n} onClick={() => handleNumpadPress(n)}>{n}</KeypadKey>
                  ))}
                  <KeypadKey variant="muted" onClick={() => handleNumpadPress('BACKSPACE')} title={t('pos.delete', 'Delete')}>
                    <IconBackspace size={24} stroke={iconStroke} />
                  </KeypadKey>

                  {['4', '5', '6'].map((n) => (
                    <KeypadKey key={n} onClick={() => handleNumpadPress(n)}>{n}</KeypadKey>
                  ))}
                  <KeypadKey variant="danger" onClick={() => handleNumpadPress('CLEAR')} title={t('pos.clear_currency', 'Clear')}>
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      <IconRotate size={18} stroke={iconStroke} />
                      {t('pos.clear', 'Clear')}
                    </span>
                  </KeypadKey>

                  {['7', '8', '9'].map((n) => (
                    <KeypadKey key={n} onClick={() => handleNumpadPress(n)}>{n}</KeypadKey>
                  ))}
                  <KeypadKey variant="success" className="row-span-2" onClick={handleExactTender} title={t('pos.exact', 'Exact Amount')}>
                    <span className="flex flex-col items-center gap-1">
                      <IconCheck size={24} stroke={2.5} />
                      <span className="text-sm font-semibold">{t('pos.exact', 'Exact')}</span>
                      <span className="text-[11px] font-medium tabular-nums opacity-80">
                        {activeTenderCurrency === 'USD' ? fmtUSD(totalUSD) : fmtKHR(totalKHR)}
                      </span>
                    </span>
                  </KeypadKey>

                  <KeypadKey onClick={() => handleNumpadPress(activeTenderCurrency === 'KHR' ? '00' : '.')}>
                    {activeTenderCurrency === 'KHR' ? '00' : '.'}
                  </KeypadKey>
                  <KeypadKey onClick={() => handleNumpadPress('0')}>0</KeypadKey>
                  <KeypadKey onClick={() => handleNumpadPress(activeTenderCurrency === 'KHR' ? '000' : '00')}>
                    {activeTenderCurrency === 'KHR' ? '000' : '00'}
                  </KeypadKey>
                </div>
              </div>
            ) : (
              /* ==================== B. QR / CARD TERMINAL ==================== */
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 py-6">
                <div className={clsx(
                  "w-20 h-20 rounded-3xl flex items-center justify-center",
                  isQr ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400"
                )}>
                  {isQr ? <IconQrcode size={42} stroke={iconStroke} /> : <IconCreditCard size={42} stroke={iconStroke} />}
                </div>

                <div className="space-y-1">
                  <h4 className="text-xl font-bold text-slate-900 dark:text-white">
                    {isQr
                      ? t('pos.scan_khqr_guide', 'Scan to Pay with KHQR / Banking App')
                      : t('pos.electronic_card_terminal', 'Electronic Payment Terminal')}
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                    {isQr
                      ? t('pos.scan_khqr_subtitle', 'Customer scans via ABA Mobile, Wing, Bakong, or any local banking app')
                      : t('pos.card_terminal_guide', 'Swipe or tap customer card on the payment terminal')}
                  </p>
                </div>

                <div className="w-full max-w-sm rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 py-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('pos.payable_total_due', 'Payable Total Due')}
                  </p>
                  <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900 dark:text-white">{primaryDue}</p>
                  <p className="mt-1 text-sm tabular-nums text-slate-500 dark:text-slate-400">≈ {secondaryDue}</p>
                </div>

                <div className="w-full max-w-sm text-left space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t('pos.part_payment_amount', 'Amount on this method (leave empty for the full balance)')}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder={`${currency}${remainingDue.toFixed(2)}`}
                    className="w-full h-12 text-sm font-semibold tabular-nums px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="w-full max-w-sm text-left space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t('pos.card_reference_optional', 'Card Auth / Ref Number (Optional)')}
                  </label>
                  <input
                    type="text"
                    value={referenceCode}
                    onChange={(e) => setReferenceCode(e.target.value)}
                    placeholder={isQr ? 'e.g. ABA-108293' : 'e.g. AUTH-482910'}
                    className="w-full h-12 text-sm px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ==================== FOOTER: Settlement status + primary action ==================== */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1 flex items-stretch gap-2 min-w-0">
            {isCash ? (
              <>
                <FooterStat
                  label={t('pos.cash_received', 'Cash Received')}
                  value={fmtKHR(totalReceivedKHR)}
                  sub={fmtUSD(totalReceivedUSD)}
                />
                {isSufficient || !hasTender ? (
                  <FooterStat
                    tone={hasTender ? 'success' : 'neutral'}
                    label={t('pos.change_amount', 'Change Due')}
                    value={hasTender ? changeDisplay : '—'}
                    sub={hasTender ? `≈ ${fmtUSD(changeTotalUSD)}` : undefined}
                    action={
                      <div className="flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                        {[
                          { id: 'riel', label: '៛' },
                          { id: 'mixed', label: '$+៛' },
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setChangeAdviceMode(m.id)}
                            title={m.id === 'riel' ? t('pos.all_riel', '៛ All Riel') : t('pos.mixed_usd_khr', '$ + ៛ Mixed')}
                            className={clsx(
                              "min-w-[42px] h-9 px-2 rounded-md text-xs font-semibold transition-all duration-150 active:scale-95 cursor-pointer",
                              changeAdviceMode === m.id
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                : "text-slate-500 dark:text-slate-400"
                            )}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    }
                  />
                ) : (
                  <FooterStat
                    tone="warning"
                    label={t('pos.remaining', 'Remaining')}
                    value={fmtKHR(Math.abs(diffKHR))}
                    sub={fmtUSD(Math.abs(diffKHR / currentRate))}
                  />
                )}
              </>
            ) : (
              <FooterStat
                label={t('pos.select_payment_method', 'Payment Method')}
                value={selectedPaymentObj?.title || '-'}
                sub={referenceCode.trim() || undefined}
              />
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canAddPartial && (
              <button
                type="button"
                onClick={handleAddPartial}
                className="h-14 px-4 rounded-xl text-sm font-semibold text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 transition-all duration-150 active:scale-95 cursor-pointer flex items-center gap-2"
                title={t('pos.add_part_payment_hint', 'Take this amount now and pay the rest with another method')}
              >
                <IconPlus size={18} />
                {t('pos.add_part_payment', 'Part pay')} {currency}{partialValue.toFixed(2)}
              </button>
            )}
            {allowPayLater && (
              <button
                type="button"
                onClick={() => canPayLater && setIsPayLaterOpen(true)}
                disabled={!canPayLater}
                title={custPhone
                  ? t('pos.pay_later_hint', 'Customer pays later: the balance goes on their account')
                  : t('pos.pay_later_needs_customer', 'Attach a customer to the bill to use Pay Later')}
                className={clsx(
                  "h-14 px-4 rounded-xl text-sm font-semibold border flex items-center gap-2 transition-all duration-150 active:scale-95 touch-manipulation",
                  canPayLater
                    ? "text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 cursor-pointer"
                    : "text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                )}
              >
                <IconClockDollar size={18} stroke={iconStroke} />
                {t('pos.pay_later', 'Pay Later')}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-14 px-5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-150 active:scale-95 cursor-pointer"
            >
              {t('pos.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={handleFinalizePayment}
              disabled={isCtaDisabled}
              className={clsx(
                "flex-1 lg:flex-none lg:min-w-[340px] h-14 pl-5 pr-2 rounded-xl text-white flex items-center justify-between gap-4 transition-all duration-150 active:scale-[0.98] touch-manipulation cursor-pointer select-none",
                isCtaDisabled
                  ? "bg-slate-300 dark:bg-slate-700 cursor-not-allowed"
                  : "bg-restro-green hover:bg-restro-green-button-hover shadow-lg shadow-emerald-600/20"
              )}
            >
              <span className="flex items-center gap-2 min-w-0">
                <IconReceipt size={20} stroke={iconStroke} className="shrink-0" />
                <span className="text-sm font-bold truncate">{ctaLabel}</span>
                <kbd className="hidden lg:inline text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white/20">F4</kbd>
              </span>
              <span className="h-10 px-3 rounded-lg bg-black/15 flex items-center text-base font-bold tabular-nums shrink-0">
                {primaryDue}
              </span>
            </button>
          </div>
        </div>
      </div>

      {isPayLaterOpen && (
        <PayLaterPanel
          t={t}
          customer={customer}
          currency={currency}
          balance={remainingDue}
          paidNow={paidTotal}
          outstanding={creditOutstanding}
          creditLimit={creditLimit}
          available={creditAvailable}
          exceedsLimit={exceedsCreditLimit}
          dueDays={payLaterDueDays}
          onDueDays={setPayLaterDueDays}
          dueDate={payLaterDueDate}
          note={payLaterNote}
          onNote={setPayLaterNote}
          isProcessing={isProcessing}
          onCancel={() => setIsPayLaterOpen(false)}
          onConfirm={handleConfirmPayLater}
        />
      )}
    </div>
  );
}

function PayLaterPanel({ t, customer, currency, balance, paidNow, outstanding, creditLimit, available, exceedsLimit, dueDays, onDueDays, dueDate, note, onNote, isProcessing, onCancel, onConfirm }) {
  const money = (v) => `${currency}${Number(v || 0).toFixed(2)}`;
  const dueOptions = [
    { days: null, label: t('pos.pay_later_no_due', 'No due date') },
    { days: 7, label: t('pos.pay_later_7d', '7 days') },
    { days: 15, label: t('pos.pay_later_15d', '15 days') },
    { days: 30, label: t('pos.pay_later_30d', '30 days') },
  ];
  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md max-h-[calc(100dvh-2rem)] flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <IconClockDollar size={22} stroke={iconStroke} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{t('pos.pay_later', 'Pay Later')}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {customer?.name}{customer?.phone ? ` • ${customer.phone}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-[42px] h-[42px] rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center active:scale-95 cursor-pointer"
          >
            <IconX size={20} stroke={iconStroke} />
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1 min-h-0 overflow-y-auto">
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              {t('pos.pay_later_put_on_account', 'Goes on account')}
            </p>
            <p className="text-3xl font-bold tabular-nums text-amber-700 dark:text-amber-300 mt-1">{money(balance)}</p>
            {paidNow > 0 && (
              <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-1">
                {t('pos.pay_later_paid_now', 'Paid now')}: {money(paidNow)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2">
              <p className="text-[11px] font-semibold uppercase text-slate-500">{t('pos.pay_later_owes_now', 'Owes now')}</p>
              <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{money(outstanding)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2">
              <p className="text-[11px] font-semibold uppercase text-slate-500">{t('pos.pay_later_after', 'After this')}</p>
              <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{money(outstanding + balance)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2">
              <p className="text-[11px] font-semibold uppercase text-slate-500">{t('pos.pay_later_limit', 'Limit')}</p>
              <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                {creditLimit === null ? t('pos.pay_later_no_limit', 'None') : money(creditLimit)}
              </p>
            </div>
          </div>

          {exceedsLimit && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
              <IconAlertTriangle size={18} className="shrink-0 mt-0.5" />
              <span>
                {Number(creditLimit) <= 0
                  ? t('pos.pay_later_not_allowed', 'This customer is not allowed to pay later.')
                  : t('pos.pay_later_over_limit', 'Over the credit limit. Available: {{amount}}. Take part of it now, or raise the limit in Customer Dues.', { amount: money(available) })}
              </span>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('pos.pay_later_due', 'Due')}</p>
            <div className="grid grid-cols-4 gap-2">
              {dueOptions.map((o) => (
                <button
                  key={String(o.days)}
                  type="button"
                  onClick={() => onDueDays(o.days)}
                  className={clsx(
                    "min-h-[42px] px-2 rounded-xl border text-xs font-semibold transition-all duration-150 active:scale-95 cursor-pointer",
                    dueDays === o.days
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/25"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {dueDate && <p className="text-xs text-slate-500">{t('pos.pay_later_due_on', 'Due on')} {dueDate}</p>}
          </div>

          <input
            type="text"
            value={note}
            onChange={(e) => onNote(e.target.value)}
            maxLength={255}
            placeholder={t('pos.pay_later_note', 'Note (optional), e.g. pays on Friday')}
            className="w-full h-[42px] text-sm px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-14 px-5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 active:scale-95 cursor-pointer"
          >
            {t('pos.back', 'Back')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing || exceedsLimit}
            className={clsx(
              "flex-1 h-14 px-4 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98]",
              isProcessing || exceedsLimit ? "bg-slate-300 dark:bg-slate-700 cursor-not-allowed" : "bg-amber-500 hover:bg-amber-600 cursor-pointer shadow-lg shadow-amber-500/20"
            )}
          >
            <IconReceipt size={20} stroke={iconStroke} />
            {isProcessing
              ? t('pos.please_wait', 'Processing...')
              : t('pos.pay_later_confirm', 'Put {{amount}} on account & print', { amount: money(balance) })}
          </button>
        </div>
      </div>
    </div>
  );
}

// Configured icon wins; otherwise infer from the method title so tiles don't all share the cash glyph
function getPaymentIcon(pt) {
  if (pt.icon && pt.icon !== 'cash' && PAYMENT_ICONS[pt.icon]) return PAYMENT_ICONS[pt.icon];
  const title = (pt.title || '').toLowerCase();
  if (/qr|aba|bakong|wing|acleda/.test(title)) return <IconQrcode stroke={iconStroke} />;
  if (/reward|gift|voucher|loyalty/.test(title)) return <IconGift stroke={iconStroke} />;
  if (/card|visa|master|amex|credit|debit/.test(title)) return <IconCreditCard stroke={iconStroke} />;
  if (/cash|សាច់ប្រាក់/.test(title) || pt.icon === 'cash') return <IconCash stroke={iconStroke} />;
  return <IconWallet stroke={iconStroke} />;
}

function TenderCard({ active, label, symbol, value, hasValue, equivalent, onSelect, onClear }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      className={clsx(
        "relative p-4 rounded-2xl border-2 transition-all duration-150 cursor-pointer select-none touch-manipulation active:scale-[0.98]",
        active
          ? "border-sky-500 bg-sky-50/70 dark:bg-sky-500/10"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-600"
      )}
    >
      <div className="flex items-center justify-between">
        <span className={clsx(
          "inline-flex items-center gap-1.5 text-xs font-semibold",
          active ? "text-sky-700 dark:text-sky-300" : "text-slate-500 dark:text-slate-400"
        )}>
          <span className={clsx(
            "w-6 h-6 rounded-md flex items-center justify-center text-sm font-bold",
            active ? "bg-sky-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300"
          )}>
            {symbol}
          </span>
          {label}
        </span>
        {hasValue && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="w-8 h-8 -m-1 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-white/10 cursor-pointer"
          >
            <IconX size={16} />
          </button>
        )}
      </div>
      <div className={clsx(
        "mt-2 text-3xl font-bold tabular-nums truncate",
        hasValue || active ? "text-slate-900 dark:text-white" : "text-slate-300 dark:text-slate-600"
      )}>
        {value}
        {active && <span className="inline-block w-0.5 h-7 ml-1 align-middle bg-sky-500 animate-pulse" />}
      </div>
      <div className="mt-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">{equivalent}</div>
    </div>
  );
}

const KEYPAD_VARIANTS = {
  default: "bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 text-2xl font-semibold tabular-nums",
  muted: "bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700",
  danger: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-500/30 hover:bg-rose-100 dark:hover:bg-rose-500/20",
  success: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20",
};

function KeypadKey({ children, onClick, title, variant = 'default', className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={clsx(
        "min-h-[56px] rounded-xl border shadow-[0_1px_0_rgba(15,23,42,0.06)] flex items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer select-none touch-manipulation",
        KEYPAD_VARIANTS[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

function FooterStat({ label, value, sub, tone = 'neutral', action }) {
  return (
    <div className={clsx(
      "flex-1 min-w-0 flex items-center justify-between gap-2 px-4 py-2 rounded-xl border",
      tone === 'success' && "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30",
      tone === 'warning' && "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30",
      tone === 'neutral' && "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
    )}>
      <div className="min-w-0">
        <p className={clsx(
          "text-[11px] font-semibold uppercase tracking-wide truncate",
          tone === 'success' ? "text-emerald-700 dark:text-emerald-300" : tone === 'warning' ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"
        )}>
          {label}
        </p>
        <p className={clsx(
          "text-lg font-bold tabular-nums truncate leading-tight",
          tone === 'success' ? "text-emerald-700 dark:text-emerald-300" : tone === 'warning' ? "text-amber-700 dark:text-amber-300" : "text-slate-900 dark:text-white"
        )}>
          {value}
          {sub && <span className="ml-1.5 text-xs font-medium opacity-70">{sub}</span>}
        </p>
      </div>
      {action}
    </div>
  );
}
