import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconX, IconCloudUpload, IconRefresh, IconTrash, IconAlertTriangle } from '@tabler/icons-react';
import { clsx } from 'clsx';
import { iconStroke } from '../../config/config';

/** Orders taken while offline: waiting to be sent, or refused and needing a decision. */
export default function POSOfflineQueueDrawer({ isOpen, onClose, queue = [], isOnline, isSyncing, onSyncNow, onRetry, onDiscard, currency = '' }) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('pos_ops.offline_orders', 'Offline orders')}
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-background text-foreground border-l border-restro-border-green shadow-2xl flex flex-col overflow-hidden"
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-restro-border-green/80 bg-restro-gray/40 shrink-0">
          <div>
            <h3 className="text-base font-black text-restro-text">{t('pos_ops.offline_orders', 'Offline orders')}</h3>
            <p className={clsx('text-[11px] font-semibold', isOnline ? 'text-emerald-600' : 'text-amber-600')}>
              {isOnline ? t('pos_ops.back_online', 'Back online') : t('pos_ops.no_connection', 'No connection — orders are kept on this device')}
            </p>
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

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
          {queue.length === 0 && <p className="text-sm text-gray-500 text-center py-10">{t('pos_ops.queue_empty', 'Everything is sent.')}</p>}
          {queue.map((e) => (
            <div
              key={e.clientOrderId}
              className={clsx('rounded-2xl border p-3 flex flex-col gap-1.5', e.status === 'failed' ? 'border-rose-300 bg-rose-50/60 dark:bg-rose-950/20' : 'border-restro-border-green')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-sm">{e.localToken}</span>
                <span className="text-[11px] text-gray-500">{new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                {e.kind === 'order_invoice' ? t('pos_ops.paid_order', 'Paid order') : t('pos_ops.kitchen_order', 'Kitchen order')}
                {e.summary?.items ? ` · ${e.summary.items} ${t('pos_ops.items', 'items')}` : ''}
                {e.summary?.total !== undefined ? ` · ${currency}${Number(e.summary.total).toFixed(2)}` : ''}
                {e.summary?.table ? ` · ${e.summary.table}` : ''}
              </p>
              {e.status === 'failed' && (
                <>
                  <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-start gap-1">
                    <IconAlertTriangle size={14} className="shrink-0 mt-0.5" /> {e.error}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onRetry(e.clientOrderId)}
                      className="flex-1 min-h-[42px] rounded-xl border border-restro-border-green text-xs font-bold flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                    >
                      <IconRefresh size={14} /> {t('pos_ops.retry', 'Retry')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDiscard(e.clientOrderId)}
                      className="flex-1 min-h-[42px] rounded-xl border border-rose-300 text-rose-600 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                    >
                      <IconTrash size={14} /> {t('pos_ops.discard', 'Discard')}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <footer className="px-5 py-3 border-t border-restro-border-green/80 shrink-0">
          <button
            type="button"
            disabled={!isOnline || isSyncing || !queue.some((e) => e.status === 'pending')}
            onClick={onSyncNow}
            className="w-full min-h-[48px] rounded-xl bg-restro-green text-white font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer disabled:opacity-50"
          >
            <IconCloudUpload size={18} stroke={iconStroke} />
            {isSyncing ? t('pos_ops.syncing', 'Sending…') : t('pos_ops.sync_now', 'Send now')}
          </button>
        </footer>
      </aside>
    </>
  );
}
