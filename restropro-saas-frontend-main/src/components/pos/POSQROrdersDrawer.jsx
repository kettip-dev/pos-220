import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IconX,
  IconQrcode,
  IconTrash,
  IconClock,
  IconArmchair2,
  IconClearAll,
  IconShoppingBag,
  IconTruckDelivery,
  IconUser,
  IconCheck,
  IconChecks,
  IconPencil,
  IconShieldCheck,
  IconNotes,
  IconLoader2,
  IconSparkles,
} from '@tabler/icons-react';
import { clsx } from 'clsx';
import { iconStroke } from '../../config/config';

export default function POSQROrdersDrawer({
  isOpen,
  onClose,
  qrOrders = [],
  onApproveOrder,
  onApproveAllOrders,
  onEditOrderInCart,
  onRejectOrder,
  onRejectAllOrders,
  currency = '$',
  exchangeRateUsdToKhr = 4100,
  activeCartItemsCount = 0,
}) {
  const { t } = useTranslation();
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [confirmRejectId, setConfirmRejectId] = useState(null);
  const [approvingOrderId, setApprovingOrderId] = useState(null);
  const [rejectingOrderId, setRejectingOrderId] = useState(null);
  const [isApprovingAll, setIsApprovingAll] = useState(false);
  const [, setTick] = useState(0);

  // Update relative waiting time every 30s while drawer is open
  useEffect(() => {
    if (!isOpen) {
      setShowClearAllConfirm(false);
      setConfirmRejectId(null);
      return;
    }
    const timer = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const isBaseKHR = currency === '៛' || String(currency).toUpperCase() === 'KHR';
  const rate = Number(exchangeRateUsdToKhr) || 4100;

  const formatLinePrice = (amountVal) => {
    const val = Number(amountVal) || 0;
    if (isBaseKHR) {
      return `៛${Math.round(val).toLocaleString()}`;
    }
    return `${currency}${val.toFixed(2)}`;
  };

  const formatDualCurrency = (amountVal) => {
    const val = Number(amountVal) || 0;
    if (isBaseKHR) {
      const primary = `៛${Math.round(val).toLocaleString()}`;
      const secondary = `$${(val / rate).toFixed(2)}`;
      return { primary, secondary };
    } else {
      const primary = `${currency}${val.toFixed(2)}`;
      const secondary = `៛${Math.round(val * rate).toLocaleString()}`;
      return { primary, secondary };
    }
  };

  const getElapsedInfo = (dateStr) => {
    if (!dateStr) return { label: t('pos.just_now', 'Just now'), tone: 'fresh' };
    const created = new Date(dateStr).getTime();
    if (isNaN(created)) return { label: t('pos.just_now', 'Just now'), tone: 'fresh' };

    const diffMins = Math.max(0, Math.floor((Date.now() - created) / 60000));
    const timeFormatted = new Date(created).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (diffMins < 1) {
      return { label: `${t('pos.just_now', 'Just now')} · ${timeFormatted}`, tone: 'fresh' };
    }
    if (diffMins < 60) {
      return {
        label: `${diffMins}m ago · ${timeFormatted}`,
        tone: diffMins >= 10 ? 'urgent' : diffMins >= 5 ? 'warn' : 'fresh',
      };
    }
    const hrs = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    return {
      label: `${hrs}h ${remMins}m ago · ${timeFormatted}`,
      tone: 'urgent',
    };
  };

  const getDiningBadge = (qrOrder) => {
    const opt = (qrOrder.delivery_type || (qrOrder.table_id ? 'dinein' : 'dinein')).toLowerCase();
    if (opt === 'takeaway') {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-blue-500/15 text-blue-700 dark:text-blue-300 font-extrabold text-xs inline-flex items-center gap-1.5 border border-blue-500/30 whitespace-nowrap shrink-0">
          <IconShoppingBag size={14} stroke={2.2} />
          <span>{t('pos.takeaway', 'Takeaway')}</span>
        </span>
      );
    }
    if (opt === 'delivery') {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-orange-500/15 text-orange-700 dark:text-orange-300 font-extrabold text-xs inline-flex items-center gap-1.5 border border-orange-500/30 whitespace-nowrap shrink-0">
          <IconTruckDelivery size={14} stroke={2.2} />
          <span>{t('pos.delivery', 'Delivery')}</span>
        </span>
      );
    }

    const tableLabel = qrOrder.table_title
      ? `${t('pos.table', 'Table')} ${qrOrder.table_title}`
      : qrOrder.table_id
      ? `${t('pos.table', 'Table')} #${qrOrder.table_id}`
      : t('pos.dinein', 'Dine-In');

    return (
      <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs inline-flex items-center gap-1.5 border border-emerald-500/30 whitespace-nowrap shrink-0">
        <IconArmchair2 size={15} stroke={2.2} className="text-restro-green shrink-0" />
        <span>{tableLabel}</span>
        {qrOrder.floor && (
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-200">
            {qrOrder.floor}
          </span>
        )}
      </span>
    );
  };

  const handleApproveSingle = async (orderId) => {
    if (approvingOrderId || isApprovingAll) return;
    try {
      setApprovingOrderId(orderId);
      await onApproveOrder(orderId);
    } finally {
      setApprovingOrderId(null);
    }
  };

  const handleApproveAll = async () => {
    if (isApprovingAll || qrOrders.length === 0) return;
    try {
      setIsApprovingAll(true);
      await onApproveAllOrders();
    } finally {
      setIsApprovingAll(false);
    }
  };

  const handleRejectSingle = async (orderId) => {
    if (rejectingOrderId) return;
    try {
      setRejectingOrderId(orderId);
      await onRejectOrder(orderId);
      setConfirmRejectId(null);
    } finally {
      setRejectingOrderId(null);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      />

      {/* Slide-over Drawer Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('pos.qr_orders', 'QR Menu Orders')}
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] md:w-[560px] bg-background text-foreground border-l border-restro-border-green shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 select-none"
      >
        {/* Top Header */}
        <header className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3.5 border-b border-restro-border-green/80 bg-restro-gray/40 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#E11D48]/15 text-[#E11D48] dark:text-rose-400 flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <IconQrcode size={22} stroke={iconStroke} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-restro-text leading-tight truncate">
                  {t('pos.qr_orders', 'QR Menu Orders')}
                </h3>
                <span
                  className={clsx(
                    'px-2.5 py-0.5 rounded-full text-xs font-black shrink-0 border',
                    qrOrders.length > 0
                      ? 'bg-[#E11D48]/15 text-[#E11D48] dark:text-rose-400 border-[#E11D48]/30'
                      : 'bg-restro-gray text-gray-500 border-restro-border-green'
                  )}
                >
                  {qrOrders.length}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {activeCartItemsCount > 0
                  ? t(
                      'pos.qr_autohold_hint',
                      'Editing a QR order safely auto-holds your current POS cart'
                    )
                  : t(
                      'pos.qr_subtitle',
                      'Review guest self-orders, approve straight to KDS, or edit in cart'
                    )}
              </p>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Batch Approve All Button (when 2+ orders pending) */}
            {qrOrders.length > 1 && !showClearAllConfirm && (
              <button
                type="button"
                disabled={isApprovingAll}
                onClick={handleApproveAll}
                className="min-h-[42px] px-3 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white text-xs font-extrabold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs whitespace-nowrap disabled:opacity-60"
                title={t('pos.approve_all_qr', 'Approve all pending QR orders to KDS')}
              >
                {isApprovingAll ? (
                  <IconLoader2 size={16} className="animate-spin" />
                ) : (
                  <IconChecks size={16} stroke={2.4} />
                )}
                <span>
                  {t('pos.approve_all', 'Approve All')} ({qrOrders.length})
                </span>
              </button>
            )}

            {/* Clear / Reject All Trigger */}
            {qrOrders.length > 0 && !showClearAllConfirm && (
              <button
                type="button"
                onClick={() => setShowClearAllConfirm(true)}
                title={t('pos.clear_qr_orders', 'Reject All QR Orders')}
                className="min-h-[42px] px-3 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs whitespace-nowrap"
              >
                <IconClearAll size={16} stroke={iconStroke} />
                <span className="hidden md:inline">{t('pos.clear_all', 'Clear All')}</span>
              </button>
            )}

            {/* Inline Clear All Confirmation */}
            {showClearAllConfirm && (
              <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-xl p-1 animate-in fade-in duration-100">
                <button
                  type="button"
                  onClick={async () => {
                    await onRejectAllOrders();
                    setShowClearAllConfirm(false);
                  }}
                  className="min-h-[38px] px-2.5 rounded-lg bg-red-500 text-white text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <IconCheck size={14} stroke={iconStroke} />
                  <span>{t('common.confirm', 'Reject All')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearAllConfirm(false)}
                  className="min-h-[38px] px-2 rounded-lg bg-restro-gray text-gray-500 text-xs font-bold hover:text-restro-text transition active:scale-95 cursor-pointer"
                >
                  <IconX size={14} stroke={iconStroke} />
                </button>
              </div>
            )}

            {/* Close Drawer Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 min-h-[42px] min-w-[42px] rounded-xl bg-restro-gray hover:bg-restro-button-hover border border-restro-border-green flex items-center justify-center text-restro-text transition active:scale-95 cursor-pointer shadow-2xs"
              title={t('common.close', 'Close (Esc)')}
            >
              <IconX size={18} stroke={iconStroke} />
            </button>
          </div>
        </header>

        {/* QR Orders Ticket List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 scrollbar-thin">
          {qrOrders.length > 0 ? (
            qrOrders.map((qrOrder, index) => {
              const {
                id,
                date,
                customer_type,
                customer_name,
                customer_id,
                items = [],
              } = qrOrder;

              const totalQty = items.reduce(
                (sum, it) => sum + (Number(it.quantity) || 1),
                0
              );
              const orderSubtotal = items.reduce(
                (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
                0
              );

              const { primary: totalPrimary, secondary: totalSecondary } =
                formatDualCurrency(orderSubtotal);
              const elapsed = getElapsedInfo(date);
              const isConfirmingReject = confirmRejectId === id;
              const isApprovingThis = approvingOrderId === id;
              const isRejectingThis = rejectingOrderId === id;

              return (
                <div
                  key={id || index}
                  className="rounded-2xl p-4 sm:p-4.5 border border-restro-border-green bg-restro-card-bg dark:bg-slate-900/90 hover:border-restro-green/70 transition-all shadow-xs flex flex-col gap-3.5"
                >
                  {/* Row 1: Table Badge + Ticket ID + PIN Verified + Dual-Currency Total */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {getDiningBadge(qrOrder)}

                        <span className="px-2 py-0.5 rounded-lg bg-restro-gray border border-restro-border-green text-[11px] font-mono font-bold text-gray-600 dark:text-slate-300 whitespace-nowrap">
                          #{id}
                        </span>

                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/12 text-restro-green border border-emerald-500/25 text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap">
                          <IconShieldCheck size={13} stroke={2.3} />
                          <span>PIN Verified</span>
                        </span>
                      </div>

                      {/* Sub-row: Customer + Elapsed Time + Item Count */}
                      <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1 font-semibold text-restro-text whitespace-nowrap">
                          <IconUser size={13} stroke={iconStroke} className="text-gray-400" />
                          <span>
                            {customer_type === 'WALKIN' || !customer_name
                              ? t('pos.walkin_guest', 'Walk-in Guest')
                              : customer_name}
                          </span>
                          {customer_id && customer_type !== 'WALKIN' && (
                            <span className="font-mono text-[11px] text-gray-400">
                              ({customer_id})
                            </span>
                          )}
                        </span>

                        <span className="text-gray-300 dark:text-slate-700">•</span>

                        <span
                          className={clsx(
                            'inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap',
                            elapsed.tone === 'urgent'
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                              : elapsed.tone === 'warn'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                              : 'bg-restro-gray text-gray-500 dark:text-slate-400'
                          )}
                        >
                          <IconClock size={12} stroke={2.2} />
                          <span>{elapsed.label}</span>
                        </span>
                      </div>
                    </div>

                    {/* Right: Dual-Currency Total + Item Count Pill */}
                    <div className="flex flex-col items-end shrink-0 text-right">
                      <span className="font-mono text-base sm:text-lg font-black text-restro-green leading-tight whitespace-nowrap">
                        {totalPrimary}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-[11px] font-semibold text-gray-500 dark:text-slate-400 whitespace-nowrap">
                          {totalSecondary}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[10px] font-extrabold text-restro-text whitespace-nowrap">
                          {totalQty} {totalQty === 1 ? t('pos.item', 'item') : t('pos.items', 'items')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Detailed Item Lines (with Variants, Addons & Notes) */}
                  <div className="rounded-xl border border-restro-border-green/60 bg-background/70 dark:bg-slate-950/50 divide-y divide-restro-border-green/40 max-h-56 overflow-y-auto scrollbar-thin">
                    {items.length > 0 ? (
                      items.map((it, idx) => {
                        const qty = Number(it.quantity) || 1;
                        const lineTotal = (Number(it.price) || 0) * qty;
                        const addonsList = Array.isArray(it.addons)
                          ? it.addons.filter(Boolean)
                          : [];

                        return (
                          <div key={it.id || idx} className="px-3.5 py-2.5 flex flex-col gap-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2 min-w-0">
                                <span className="min-w-[26px] h-[22px] px-1.5 rounded-md bg-restro-green/15 text-restro-green font-mono text-xs font-black inline-flex items-center justify-center shrink-0">
                                  {qty}x
                                </span>
                                <div className="min-w-0">
                                  <span className="text-xs sm:text-sm font-bold text-restro-text break-words">
                                    {it.item_title}
                                  </span>
                                  {it.variant_title && (
                                    <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-restro-gray border border-restro-border-green text-[11px] font-semibold text-gray-600 dark:text-slate-300 whitespace-nowrap">
                                      {it.variant_title}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span className="font-mono text-xs sm:text-sm font-bold text-restro-text shrink-0 whitespace-nowrap">
                                {formatLinePrice(lineTotal)}
                              </span>
                            </div>

                            {/* Addons */}
                            {addonsList.length > 0 && (
                              <div className="pl-8 flex flex-wrap gap-1">
                                {addonsList.map((addon, aIdx) => (
                                  <span
                                    key={aIdx}
                                    className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-semibold"
                                  >
                                    + {addon.title}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Special Customer Notes */}
                            {it.notes && (
                              <div className="pl-8">
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[11px] font-semibold">
                                  <IconNotes size={12} stroke={2} className="shrink-0" />
                                  <span>{it.notes}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-3.5 py-3 text-xs text-gray-400 italic text-center">
                        {t('pos.no_items_in_order', 'No items in this order')}
                      </div>
                    )}
                  </div>

                  {/* Row 3: High-Density Tablet Action Bar (min-h-[42px]) */}
                  <div className="flex items-center gap-2 pt-0.5">
                    {!isConfirmingReject ? (
                      <>
                        {/* Primary 1-Tap Approve -> KDS */}
                        <button
                          type="button"
                          disabled={isApprovingThis || isApprovingAll || items.length === 0}
                          onClick={() => handleApproveSingle(id)}
                          className="flex-1 min-h-[42px] rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white text-xs sm:text-sm font-extrabold px-4 py-2 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-xs whitespace-nowrap disabled:opacity-50"
                        >
                          {isApprovingThis ? (
                            <IconLoader2 size={17} className="animate-spin" />
                          ) : (
                            <IconCheck size={17} stroke={2.6} />
                          )}
                          <span>
                            {isApprovingThis
                              ? t('pos.sending_to_kds', 'Sending to KDS...')
                              : t('pos.approve_to_kds', 'Approve → KDS')}
                          </span>
                        </button>

                        {/* Load into POS Cart to Edit / Pay */}
                        <button
                          type="button"
                          onClick={() => onEditOrderInCart(qrOrder)}
                          title={t('pos.load_into_cart_hint', 'Load into POS Cart to Edit or Collect Payment')}
                          className="min-h-[42px] px-3.5 py-2 rounded-xl border border-restro-border-green bg-restro-gray hover:bg-restro-button-hover text-restro-text text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <IconPencil size={16} stroke={iconStroke} />
                          <span>{t('pos.edit_in_cart', 'Edit in Cart')}</span>
                        </button>

                        {/* Reject Trigger (opens inline 2-tap confirm) */}
                        <button
                          type="button"
                          onClick={() => setConfirmRejectId(id)}
                          title={t('pos.reject_qr_order', 'Reject QR Order')}
                          className="min-h-[42px] min-w-[42px] px-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
                        >
                          <IconTrash size={17} stroke={iconStroke} />
                        </button>
                      </>
                    ) : (
                      /* Inline 2-Tap Reject Confirmation Bar */
                      <div className="w-full flex items-center justify-between gap-2 p-1.5 rounded-xl bg-red-500/10 border border-red-500/30 animate-in fade-in duration-100">
                        <span className="text-xs font-bold text-red-600 dark:text-red-400 pl-2">
                          {t('pos.confirm_reject_qr', 'Reject & cancel this QR order?')}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={isRejectingThis}
                            onClick={() => handleRejectSingle(id)}
                            className="min-h-[38px] px-3.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-extrabold flex items-center gap-1.5 transition active:scale-95 cursor-pointer whitespace-nowrap"
                          >
                            {isRejectingThis ? (
                              <IconLoader2 size={14} className="animate-spin" />
                            ) : (
                              <IconTrash size={14} stroke={2.2} />
                            )}
                            <span>{t('pos.confirm_reject', 'Yes, Reject')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRejectId(null)}
                            className="min-h-[38px] px-3 rounded-lg bg-restro-gray text-gray-600 dark:text-slate-300 text-xs font-bold hover:text-restro-text transition active:scale-95 cursor-pointer"
                          >
                            {t('common.cancel', 'Keep')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 my-auto">
              <div className="w-16 h-16 rounded-3xl bg-restro-green/10 border border-restro-green/20 text-restro-green flex items-center justify-center mb-4 shadow-inner">
                <IconSparkles size={30} stroke={1.6} />
              </div>
              <h4 className="text-base font-black text-restro-text mb-1">
                {t('pos.no_pending_qr_orders', 'All Caught Up!')}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
                {t(
                  'pos.no_pending_qr_orders_desc',
                  'No pending QR table orders right now. New guest orders will appear here in real time.'
                )}
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
