import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IconCheck,
  IconPrinter,
  IconReceipt,
  IconArrowRight,
  IconCash,
  IconCreditCard,
  IconQrcode,
  IconX,
} from '@tabler/icons-react';
import { iconStroke } from '../../config/config';
import { clsx } from 'clsx';

export default function POSPaymentSuccessModal({
  isOpen,
  onClose,
  paymentInfo,
  onPrintReceipt,
  onPrintToken,
}) {
  const { t } = useTranslation();

  // Keyboard shortcut: Press Enter or Space or Escape to start next order
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !paymentInfo) return null;

  const {
    orderId,
    tokenNo,
    paymentMethod = 'Cash',
    payableTotal = 0,
    tenderedUSD = 0,
    tenderedKHR = 0,
    totalReceivedUSD = 0,
    totalReceivedKHR = 0,
    changeTotalUSD = 0,
    changeTotalKHR = 0,
    changeBreakdownUSD = 0,
    changeBreakdownKHR = 0,
    currency = '$',
    exchangeRate = 4100,
    isBaseKHR = false,
    receiptPayload = null,
  } = paymentInfo;

  const isCash = String(paymentMethod).toLowerCase().includes('cash');
  const isQr = String(paymentMethod).toLowerCase().includes('qr') || String(paymentMethod).toLowerCase().includes('khqr');
  const hasChange = Number(changeTotalUSD) > 0 || Number(changeTotalKHR) > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150 select-none"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        
        {/* Top Header Strip */}
        <div className="relative bg-gradient-to-b from-emerald-500/15 via-emerald-500/5 to-transparent pt-6 pb-3 px-6 text-center">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
            title="Close (Esc)"
          >
            <IconX size={20} stroke={iconStroke} />
          </button>

          {/* Glowing Checkmark */}
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 ring-8 ring-emerald-500/10 mb-3 animate-in zoom-in duration-200">
            <IconCheck size={36} stroke={3} />
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {t('pos.payment_successful', 'Payment Successful')}
          </h3>

          {/* Token & Order Pill */}
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="font-mono font-extrabold text-sm px-3 py-1 rounded-full bg-emerald-600 text-white shadow-2xs">
              Token #{tokenNo}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Order #{orderId}
            </span>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center gap-1">
              {isCash ? (
                <IconCash size={14} />
              ) : isQr ? (
                <IconQrcode size={14} />
              ) : (
                <IconCreditCard size={14} />
              )}
              <span>{paymentMethod}</span>
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4">
          
          {/* HERO CHANGE DUE CARD (The Most Critical UX Element) */}
          {hasChange ? (
            <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-b from-emerald-500/20 via-emerald-500/10 to-emerald-500/5 border-2 border-emerald-500/40 text-center shadow-inner">
              <span className="inline-block text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-500/20 px-3 py-0.5 rounded-full mb-1">
                {t('pos.change_to_customer', 'Change Due to Customer')}
              </span>
              
              {/* Primary Huge Change Number */}
              <div className="text-4xl sm:text-5xl font-mono font-black text-emerald-600 dark:text-emerald-400 my-1 tracking-tight">
                ${Number(changeTotalUSD).toFixed(2)}
              </div>

              {/* Cambodian Riel Equivalent & Mixed Breakdown */}
              <div className="space-y-0.5 pt-1 border-t border-emerald-500/20">
                <div className="text-sm font-mono font-bold text-slate-700 dark:text-slate-200">
                  ≈ ៛{Math.round(changeTotalKHR).toLocaleString()} KHR
                </div>
                {changeBreakdownUSD > 0 && changeBreakdownKHR > 0 && (
                  <div className="text-xs font-mono font-medium text-emerald-700 dark:text-emerald-400">
                    ({t('pos.mixed_usd_khr', '$ + ៛ Mixed')}: ${changeBreakdownUSD} + ៛{changeBreakdownKHR.toLocaleString()})
                  </div>
                )}
                <div className="text-[10px] text-slate-400 dark:text-slate-500">
                  {t('pos.nearest_100_rounding', 'Nearest ៛100 note rounding')} (1 USD = {Number(exchangeRate).toLocaleString()} ៛)
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t('pos.exact_amount_paid', 'Exact Payment Received')}
              </span>
              <div className="text-2xl sm:text-3xl font-mono font-black text-slate-900 dark:text-white my-1">
                {currency}{Number(payableTotal).toFixed(2)}
              </div>
              <p className="text-xs text-slate-400">
                {t('pos.no_change_due', 'Exact payment - No change due')}
              </p>
            </div>
          )}

          {/* 3-Column Financial Breakdown */}
          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-center font-mono">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {t('pos.payable_total_due', 'Total')}
              </div>
              <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                {currency}{Number(payableTotal).toFixed(2)}
              </div>
            </div>

            <div className="border-x border-slate-200 dark:border-slate-700 px-1">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {t('pos.cash_received', 'Paid')}
              </div>
              <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                {tenderedUSD > 0 ? `$${Number(tenderedUSD).toFixed(2)}` : `៛${Math.round(tenderedKHR).toLocaleString()}`}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {t('pos.change_amount', 'Change')}
              </div>
              <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                ${Number(changeTotalUSD).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Primary Action Button: "Start Next Order" (Prominent "What Next") */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className="w-full min-h-[50px] px-5 py-3 rounded-2xl font-black text-sm sm:text-base text-white bg-[#2CA01C] hover:bg-[#248417] active:scale-95 transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
            >
              <span>{t('pos.start_new_order', 'Start Next Order')}</span>
              <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs font-mono font-bold bg-white/20 rounded text-white">
                ↵ Enter
              </kbd>
              <IconArrowRight size={18} stroke={2.5} />
            </button>

            {/* Secondary Print Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onPrintReceipt && onPrintReceipt(receiptPayload)}
                className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs touch-manipulation"
              >
                <IconPrinter size={16} stroke={iconStroke} />
                <span>{t('pos.print_receipt', 'Print Receipt')}</span>
              </button>

              <button
                type="button"
                onClick={() => onPrintToken && onPrintToken(receiptPayload)}
                className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs touch-manipulation"
              >
                <IconReceipt size={16} stroke={iconStroke} />
                <span>{t('pos.print_token', 'Print Token')}</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
