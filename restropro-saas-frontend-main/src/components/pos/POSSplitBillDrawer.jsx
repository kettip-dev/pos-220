import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IconX,
  IconReceipt,
  IconCash,
  IconCheck,
  IconPlus,
  IconTrash,
  IconArrowsSplit2,
  IconUsers,
  IconPercentage,
  IconCreditCard,
  IconPrinter,
  IconAlertCircle,
  IconCurrencyDollar,
  IconChevronRight,
  IconRotateClockwise,
} from '@tabler/icons-react';
import { iconStroke } from '../../config/config';
import { PAYMENT_ICONS } from '../../config/payment_icons';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';
import {
  createSplitSubInvoices,
  getOrderSubInvoices,
  settleSubInvoice,
  cancelSplitPlan,
} from '../../controllers/orders.controller';
import POSPaymentDrawer from './POSPaymentDrawer';

export default function POSSplitBillDrawer({
  isOpen,
  onClose,
  order,
  currency = '$',
  paymentTypes = [],
  exchangeRateUsdToKhr = 4100,
  onPaymentComplete,
  onPrintSubReceipt,
}) {
  const { t } = useTranslation();

  // Mode: 'by_items' | 'evenly'
  const [splitMode, setSplitMode] = useState('by_items');
  const [evenGuestCount, setEvenGuestCount] = useState(2);
  const [loading, setLoading] = useState(false);
  const [activeSubInvoices, setActiveSubInvoices] = useState([]);
  const [selectedSubForPayment, setSelectedSubForPayment] = useState(null);

  // Settlement drawer state
  const [selectedPaymentType, setSelectedPaymentType] = useState(null);
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [customExchangeRate, setCustomExchangeRate] = useState(null);

  // Local state for interactive item allocation: list of sub-checks
  // Each: { id: 1, label: 'Guest 1', items: [ { order_item_id, item_title, price, quantity, maxQty } ] }
  const [itemChecks, setItemChecks] = useState([
    { id: 1, label: 'Guest 1', items: [] },
    { id: 2, label: 'Guest 2', items: [] },
  ]);
  const [activeCheckIndex, setActiveCheckIndex] = useState(0);

  // Calculate master order items & financial totals
  const orderItems = useMemo(() => {
    if (!order) return [];
    if (order.items && Array.isArray(order.items)) return order.items;
    return [];
  }, [order]);

  const masterSubtotal = useMemo(() => {
    return orderItems.reduce((acc, it) => acc + Number(it.price || 0) * Number(it.quantity || 1), 0);
  }, [orderItems]);

  const taxRate = useMemo(() => {
    if (!order || !order.subtotal || order.subtotal <= 0) return 0;
    return (Number(order.tax_total || 0) / Number(order.subtotal || 1));
  }, [order]);

  const serviceRate = useMemo(() => {
    if (!order || !order.subtotal || order.subtotal <= 0) return 0;
    return (Number(order.service_charge_total || 0) / Number(order.subtotal || 1));
  }, [order]);

  // Load existing sub-invoices if order is already in split state
  const fetchSubInvoices = async () => {
    if (!order?.id) return;
    try {
      setLoading(true);
      const res = await getOrderSubInvoices(order.id);
      if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
        setActiveSubInvoices(res.data.data);
      } else {
        setActiveSubInvoices([]);
      }
    } catch (err) {
      console.error('Error fetching sub invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && order?.id) {
      fetchSubInvoices();
      setItemChecks([
        { id: 1, label: `${t('split_bill.guest', 'Guest')} 1`, items: [] },
        { id: 2, label: `${t('split_bill.guest', 'Guest')} 2`, items: [] },
      ]);
      setActiveCheckIndex(0);
      setEvenGuestCount(2);
      setSelectedSubForPayment(null);
      if (paymentTypes.length > 0) {
        setSelectedPaymentType(paymentTypes[0].id);
      }
    }
  }, [isOpen, order?.id]);

  // Unassigned items remaining in pool for "by_items"
  const unassignedItems = useMemo(() => {
    return orderItems.map((masterItem) => {
      const assignedCount = itemChecks.reduce((sum, chk) => {
        const found = chk.items.find((it) => it.order_item_id === masterItem.id);
        return sum + (found ? found.quantity : 0);
      }, 0);
      const remainingQty = masterItem.quantity - assignedCount;
      return {
        ...masterItem,
        remainingQty: Math.max(0, remainingQty),
      };
    });
  }, [orderItems, itemChecks]);

  // Handler: Assign 1 unit of item to active check
  const handleAssignItem = (item) => {
    if (item.remainingQty <= 0) return;

    setItemChecks((prev) => {
      const copy = [...prev];
      const targetCheck = { ...copy[activeCheckIndex] };
      const existingIdx = targetCheck.items.findIndex((it) => it.order_item_id === item.id);

      if (existingIdx > -1) {
        const updatedItems = [...targetCheck.items];
        updatedItems[existingIdx] = {
          ...updatedItems[existingIdx],
          quantity: updatedItems[existingIdx].quantity + 1,
        };
        targetCheck.items = updatedItems;
      } else {
        targetCheck.items = [
          ...targetCheck.items,
          {
            order_item_id: item.id,
            item_title: item.item_title || item.title || 'Item',
            variant_title: item.variant_title || null,
            price: Number(item.price || 0),
            quantity: 1,
          },
        ];
      }
      copy[activeCheckIndex] = targetCheck;
      return copy;
    });
  };

  // Handler: Remove 1 unit from check back to pool
  const handleUnassignItem = (checkIdx, orderItemId) => {
    setItemChecks((prev) => {
      const copy = [...prev];
      const targetCheck = { ...copy[checkIdx] };
      const existingIdx = targetCheck.items.findIndex((it) => it.order_item_id === orderItemId);

      if (existingIdx > -1) {
        const item = targetCheck.items[existingIdx];
        if (item.quantity > 1) {
          const updatedItems = [...targetCheck.items];
          updatedItems[existingIdx] = { ...item, quantity: item.quantity - 1 };
          targetCheck.items = updatedItems;
        } else {
          targetCheck.items = targetCheck.items.filter((_, idx) => idx !== existingIdx);
        }
      }
      copy[checkIdx] = targetCheck;
      return copy;
    });
  };

  // Add guest check column
  const handleAddGuestCheck = () => {
    const nextId = itemChecks.length + 1;
    setItemChecks((prev) => [...prev, { id: nextId, label: `${t('split_bill.guest', 'Guest')} ${nextId}`, items: [] }]);
    setActiveCheckIndex(itemChecks.length);
  };

  // Remove check column
  const handleRemoveGuestCheck = (idx) => {
    if (itemChecks.length <= 2) {
      toast.error(t('split_bill.min_two_checks', 'Minimum 2 checks required'));
      return;
    }
    setItemChecks((prev) => prev.filter((_, i) => i !== idx));
    if (activeCheckIndex >= idx && activeCheckIndex > 0) {
      setActiveCheckIndex(activeCheckIndex - 1);
    }
  };

  // Generate split payload and commit to DB
  const handleCommitSplitPlan = async () => {
    if (!order?.id) return;
    try {
      setLoading(true);

      let splitsPayload = [];

      if (splitMode === 'by_items') {
        // Validate all items assigned
        const unassignedRemaining = unassignedItems.some((it) => it.remainingQty > 0);
        if (unassignedRemaining) {
          toast.error(t('split_bill.assign_all_first', 'Please assign all items to guests before creating checks'));
          setLoading(false);
          return;
        }

        splitsPayload = itemChecks.map((chk, i) => {
          const checkSubtotal = chk.items.reduce(
            (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 1),
            0
          );
          const tax = Number((checkSubtotal * taxRate).toFixed(2));
          const service = Number((checkSubtotal * serviceRate).toFixed(2));
          return {
            seatLabel: chk.label || `${t('split_bill.guest', 'Guest')} ${i + 1}`,
            subtotal: checkSubtotal,
            taxTotal: tax,
            serviceChargeTotal: service,
            discountTotal: 0,
            items: chk.items,
          };
        });
      } else if (splitMode === 'evenly') {
        const count = Math.max(2, evenGuestCount);
        const baseSub = Math.floor((masterSubtotal / count) * 100) / 100;
        const remainderSubCents = Math.round((masterSubtotal - (baseSub * count)) * 100);

        const totalTax = Number(order.tax_total || 0);
        const baseTax = Math.floor((totalTax / count) * 100) / 100;
        const remainderTaxCents = Math.round((totalTax - (baseTax * count)) * 100);

        const totalService = Number(order.service_charge_total || 0);
        const baseService = Math.floor((totalService / count) * 100) / 100;
        const remainderServiceCents = Math.round((totalService - (baseService * count)) * 100);

        for (let i = 0; i < count; i++) {
          splitsPayload.push({
            seatLabel: `${t('split_bill.guest', 'Guest')} ${i + 1}`,
            subtotal: Number((baseSub + (i < remainderSubCents ? 0.01 : 0)).toFixed(2)),
            taxTotal: Number((baseTax + (i < remainderTaxCents ? 0.01 : 0)).toFixed(2)),
            serviceChargeTotal: Number((baseService + (i < remainderServiceCents ? 0.01 : 0)).toFixed(2)),
            discountTotal: 0,
            items: [],
          });
        }
      }

      const res = await createSplitSubInvoices(order.id, splitMode, splitsPayload);
      if (res.data?.success) {
        toast.success(t('split_bill.checks_created_success', 'Split checks created successfully!'));
        await fetchSubInvoices();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || t('split_bill.failed_create', 'Failed to create split checks'));
    } finally {
      setLoading(false);
    }
  };

  // Revert active split plan
  const handleCancelSplitPlan = async () => {
    if (!order?.id) return;
    try {
      setLoading(true);
      const res = await cancelSplitPlan(order.id);
      if (res.data?.success) {
        toast.success(t('split_bill.plan_reverted_success', 'Split plan reverted'));
        setActiveSubInvoices([]);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || t('split_bill.cannot_revert', 'Cannot revert split plan'));
    } finally {
      setLoading(false);
    }
  };

  // Settle Sub Invoice with POS-grade tender data
  const handleSettleCheck = async (tenderData) => {
    if (!selectedSubForPayment) return;
    try {
      setLoading(true);
      const paymentTypeId = selectedPaymentType || tenderData?.paymentTypeId || (paymentTypes[0]?.id ?? null);
      const paymentObj = paymentTypes.find((p) => p.id === paymentTypeId);
      const tip = 0;
      const notes = tenderData?.referenceCode || '';

      const res = await settleSubInvoice(
        selectedSubForPayment.id,
        paymentTypeId,
        paymentObj?.title || 'Cash',
        tip,
        notes
      );

      if (res.data?.success) {
        toast.success(
          res.data.data?.isFullyCompleted
            ? t('split_bill.all_settled_completed', 'Check settled! All checks paid & order completed.')
            : t('split_bill.check_settled_success', 'Check settled successfully!')
        );
        const settledSub = {
          ...selectedSubForPayment,
          payment_type_title: paymentObj?.title || 'Cash',
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
        };
        setSelectedSubForPayment(null);
        setTenderedAmount('');
        await fetchSubInvoices();
        if (onPaymentComplete) {
          onPaymentComplete(res.data.data);
        }
        if (onPrintSubReceipt) {
          onPrintSubReceipt(settledSub, order, 'receipt');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || t('split_bill.failed_settle', 'Failed to settle sub-check'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-fadeIn">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl transition-all">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <IconArrowsSplit2 size={22} stroke={iconStroke} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {t('split_bill.title', 'Split Bill & Settle')}
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                  {order?.table_title ? `${order.table_title}` : t('split_bill.order_num', { token: order?.token_no || order?.id, defaultValue: `Order #${order?.token_no || order?.id}` })}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                {t('split_bill.subtitle', 'Split items between guests or divide bill evenly')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
          >
            <IconX size={20} stroke={iconStroke} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeSubInvoices.length > 0 ? (
            /* Active Sub-Invoices View: Settle & Status */
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 p-4 rounded-xl">
                <div>
                  <h3 className="text-sm font-bold text-blue-900 dark:text-blue-300">
                    {t('split_bill.in_progress', 'Split Checks In Progress')}
                  </h3>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                    {t('split_bill.checks_settled', {
                      paid: activeSubInvoices.filter((s) => s.payment_status === 'paid').length,
                      total: activeSubInvoices.length,
                      defaultValue: `${activeSubInvoices.filter((s) => s.payment_status === 'paid').length} of ${activeSubInvoices.length} checks settled`,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {onPrintSubReceipt && (
                    <button
                      type="button"
                      onClick={() => {
                        activeSubInvoices.forEach((s) => {
                          onPrintSubReceipt(s, order, s.payment_status === 'paid' ? 'receipt' : 'pre_bill');
                        });
                      }}
                      className="h-[42px] px-3.5 rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100/60 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <IconPrinter size={16} stroke={iconStroke} />
                      <span>{t('split_bill.print_all', 'Print All Checks')}</span>
                    </button>
                  )}
                  {activeSubInvoices.every((s) => s.payment_status !== 'paid') && (
                    <button
                      type="button"
                      onClick={handleCancelSplitPlan}
                      className="h-[42px] px-4 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-900/50 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <IconRotateClockwise size={16} stroke={iconStroke} />
                      {t('split_bill.revert_split', 'Revert Split')}
                    </button>
                  )}
                </div>
              </div>

              {/* Sub Invoices Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeSubInvoices.map((sub) => {
                  const isPaid = sub.payment_status === 'paid';
                  return (
                    <div
                      key={sub.id}
                      className={clsx(
                        'border rounded-2xl p-4 flex flex-col justify-between transition-all shadow-xs',
                        isPaid
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                            {sub.seat_label}
                            <span className="text-2xs font-mono font-normal text-slate-500">
                              ({sub.sub_invoice_number})
                            </span>
                          </span>
                          <span
                            className={clsx(
                              'text-2xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                              isPaid
                                ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                            )}
                          >
                            {isPaid ? t('split_bill.status_paid', 'Paid') : t('split_bill.status_pending', 'Pending')}
                          </span>
                        </div>

                        {/* Items breakdown if present */}
                        {sub.items && sub.items.length > 0 && (
                          <div className="space-y-1.5 py-2 border-y border-slate-100 dark:border-slate-700/60 my-2">
                            {sub.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                                <span>
                                  {it.quantity}x {it.item_title}
                                </span>
                                <span className="font-medium">
                                  {currency}{(Number(it.price) * Number(it.quantity)).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Financial summary */}
                        <div className="text-xs space-y-1 text-slate-500 pt-1">
                          <div className="flex justify-between">
                            <span>{t('split_bill.subtotal', 'Subtotal')}</span>
                            <span>{currency}{Number(sub.subtotal).toFixed(2)}</span>
                          </div>
                          {Number(sub.tax_total) > 0 && (
                            <div className="flex justify-between">
                              <span>{t('split_bill.tax', 'Tax')}</span>
                              <span>{currency}{Number(sub.tax_total).toFixed(2)}</span>
                            </div>
                          )}
                          {Number(sub.tip_amount) > 0 && (
                            <div className="flex justify-between text-emerald-600 font-medium">
                              <span>{t('split_bill.tip', 'Tip')}</span>
                              <span>+{currency}{Number(sub.tip_amount).toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-700">
                            <span>{t('split_bill.payable', 'Payable')}</span>
                            <span className="text-primary font-mono text-base">
                              {currency}{Number(sub.payable_total).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="mt-4 pt-3 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700/60">
                        {onPrintSubReceipt && (
                          <button
                            type="button"
                            onClick={() => onPrintSubReceipt(sub, order, isPaid ? 'receipt' : 'pre_bill')}
                            className="h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                          >
                            <IconPrinter size={16} stroke={iconStroke} />
                            <span>{isPaid ? t('split_bill.print_payment_receipt', 'Receipt') : t('split_bill.print_bill_check', 'Bill Check')}</span>
                          </button>
                        )}
                        {!isPaid && (
                          <button
                            type="button"
                            onClick={() => setSelectedSubForPayment(sub)}
                            className="h-[42px] flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                          >
                            <IconCash size={17} stroke={iconStroke} />
                            <span>{t('split_bill.settle_check', 'Settle Check')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Configure Split Plan Mode */
            <div className="space-y-5">
              {/* Split Mode Selector Tabs */}
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1">
                <button
                  type="button"
                  onClick={() => setSplitMode('by_items')}
                  className={clsx(
                    'h-[42px] flex-1 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer',
                    splitMode === 'by_items'
                      ? 'bg-white dark:bg-slate-900 text-primary shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  )}
                >
                  <IconArrowsSplit2 size={18} stroke={iconStroke} />
                  {t('split_bill.split_by_items', 'Split by Items')}
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('evenly')}
                  className={clsx(
                    'h-[42px] flex-1 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer',
                    splitMode === 'evenly'
                      ? 'bg-white dark:bg-slate-900 text-primary shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  )}
                >
                  <IconUsers size={18} stroke={iconStroke} />
                  {t('split_bill.split_evenly', 'Split Evenly')}
                </button>
              </div>

              {splitMode === 'evenly' ? (
                /* Even Split Configuration */
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl text-center space-y-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {t('split_bill.select_guest_count', 'Select Number of Guests')}
                  </span>
                  <div className="flex justify-center gap-2">
                    {[2, 3, 4, 5, 6].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setEvenGuestCount(count)}
                        className={clsx(
                          'w-14 h-14 rounded-2xl font-bold text-base transition active:scale-95 cursor-pointer border flex flex-col items-center justify-center',
                          evenGuestCount === count
                            ? 'bg-primary text-white border-primary shadow-md'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary/50'
                        )}
                      >
                        <span>{count}</span>
                        <span className="text-2xs font-normal opacity-80">{t('split_bill.guests', 'guests')}</span>
                      </button>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700/60 max-w-sm mx-auto">
                    <div className="flex justify-between text-sm py-1">
                      <span className="text-slate-500">{t('split_bill.total_bill', 'Total Bill')}:</span>
                      <span className="font-bold">{currency}{Number(order?.total || masterSubtotal).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-base py-1 font-bold text-primary">
                      <span>{t('split_bill.per_guest_amount', 'Each Guest Pays')}:</span>
                      <span className="text-lg">
                        {currency}{(Number(order?.total || masterSubtotal) / evenGuestCount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Split By Items Configuration */
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Left Column: Unassigned Items Pool */}
                  <div className="md:col-span-5 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {t('split_bill.unassigned_items', 'Unassigned Items')}
                      </h4>
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {unassignedItems.reduce((acc, it) => acc + it.remainingQty, 0)} {t('split_bill.items_left', 'left')}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {unassignedItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          disabled={item.remainingQty <= 0}
                          onClick={() => handleAssignItem(item)}
                          className={clsx(
                            'w-full min-h-[46px] p-2.5 rounded-xl border text-left transition flex items-center justify-between active:scale-95 cursor-pointer',
                            item.remainingQty > 0
                              ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary text-slate-900 dark:text-white shadow-2xs'
                              : 'bg-slate-100 dark:bg-slate-800/40 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed opacity-60'
                          )}
                        >
                          <div>
                            <div className="text-xs font-bold leading-tight">{item.item_title || item.title}</div>
                            <div className="text-2xs text-slate-500">{currency}{Number(item.price).toFixed(2)} {t('split_bill.each', 'each')}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700">
                              x{item.remainingQty}
                            </span>
                            <IconChevronRight size={16} className="text-slate-400" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Guest Sub-checks */}
                  <div className="md:col-span-7 space-y-3">
                    {/* Guest Check Selector Tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {itemChecks.map((chk, idx) => (
                        <button
                          key={chk.id}
                          type="button"
                          onClick={() => setActiveCheckIndex(idx)}
                          className={clsx(
                            'h-[42px] px-3.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer border',
                            activeCheckIndex === idx
                              ? 'bg-primary text-white border-primary shadow-xs'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          )}
                        >
                          <span>{chk.label}</span>
                          <span className="text-2xs font-normal opacity-80">
                            ({chk.items.reduce((sum, it) => sum + it.quantity, 0)})
                          </span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={handleAddGuestCheck}
                        className="h-[42px] px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:text-primary transition active:scale-95 cursor-pointer flex items-center gap-1 text-xs font-bold"
                      >
                        <IconPlus size={16} stroke={iconStroke} />
                        {t('split_bill.add_guest', 'Add')}
                      </button>
                    </div>

                    {/* Active Check Items View */}
                    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white dark:bg-slate-800">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60 mb-3">
                        <span className="text-xs font-bold text-slate-800 dark:text-white">
                          {t('split_bill.guest_items', {
                            label: itemChecks[activeCheckIndex]?.label || `${t('split_bill.guest', 'Guest')} ${activeCheckIndex + 1}`,
                            defaultValue: `${itemChecks[activeCheckIndex]?.label || `Guest ${activeCheckIndex + 1}`} Items`,
                          })}
                        </span>
                        {itemChecks.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveGuestCheck(activeCheckIndex)}
                            className="text-2xs text-rose-500 hover:underline flex items-center gap-1"
                          >
                            <IconTrash size={14} />
                            {t('split_bill.remove_guest', 'Remove Guest')}
                          </button>
                        )}
                      </div>

                      {itemChecks[activeCheckIndex]?.items.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-xs">
                          {t('split_bill.tap_items_on_left', 'Tap items from the left column to assign to this check')}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {itemChecks[activeCheckIndex]?.items.map((it) => (
                            <div
                              key={it.order_item_id}
                              className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-700/40 text-xs"
                            >
                              <div>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {it.quantity}x {it.item_title}
                                </span>
                                <span className="text-2xs text-slate-500 ml-2">
                                  {currency}{(Number(it.price) * Number(it.quantity)).toFixed(2)}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleUnassignItem(activeCheckIndex, it.order_item_id)}
                                className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center hover:bg-rose-100 active:scale-95 cursor-pointer"
                              >
                                <IconTrash size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Commit Button */}
        {activeSubInvoices.length === 0 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {splitMode === 'evenly'
                ? t('split_bill.equal_sub_checks', {
                    count: evenGuestCount,
                    defaultValue: `${evenGuestCount} Equal Sub-Checks`,
                  })
                : t('split_bill.guest_checks_configured', {
                    count: itemChecks.length,
                    defaultValue: `${itemChecks.length} Guest Checks configured`,
                  })}
            </span>
            <button
              type="button"
              disabled={loading}
              onClick={handleCommitSplitPlan}
              className="h-[46px] min-h-[46px] px-6 rounded-xl bg-primary hover:bg-primary-focus text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-md disabled:opacity-50"
            >
              <IconCheck size={18} stroke={iconStroke} />
              {t('split_bill.confirm_create', 'Confirm & Create Split Checks')}
            </button>
          </div>
        )}

      {/* POS-Grade Dual-Currency Payment Drawer for Sub-Check Settlement */}
      {selectedSubForPayment && (
        <POSPaymentDrawer
          isOpen={Boolean(selectedSubForPayment)}
          onClose={() => {
            setSelectedSubForPayment(null);
            setTenderedAmount('');
          }}
          paymentTypes={paymentTypes}
          selectedPaymentType={selectedPaymentType}
          onSelectPaymentType={setSelectedPaymentType}
          payableTotal={Number(selectedSubForPayment.payable_total || 0)}
          itemsTotal={Number(selectedSubForPayment.subtotal || selectedSubForPayment.payable_total || 0)}
          taxTotal={Number(selectedSubForPayment.tax_total || 0)}
          serviceChargeTotal={Number(selectedSubForPayment.service_charge_total || 0)}
          discountAmount={Number(selectedSubForPayment.discount_total || 0)}
          discountType="fixed"
          discountValue={0}
          currency={currency}
          exchangeRateUsdToKhr={customExchangeRate || exchangeRateUsdToKhr || 4100}
          onUpdateExchangeRate={setCustomExchangeRate}
          tenderedAmount={tenderedAmount}
          onTenderedAmountChange={setTenderedAmount}
          onPayAndComplete={handleSettleCheck}
          allowPayLater={false}
          isProcessing={loading}
          tableTitle={`${order?.table_title ? order.table_title + ' • ' : ''}${selectedSubForPayment.seat_label} (${selectedSubForPayment.sub_invoice_number})`}
          cartItems={(selectedSubForPayment.items || []).map((it) => ({
            title: it.item_title,
            price: it.price,
            quantity: it.quantity,
          }))}
          diningOption="dinein"
        />
      )}
      </div>
    </div>
  );
}
