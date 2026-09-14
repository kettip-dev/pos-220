import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IconBan,
  IconX,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { getInvoiceAuditLogsForInvoice } from "../controllers/invoiceAuditLog.controller";
import { isAllBusinessesScope } from "../helpers/BusinessScope";

/**
 * Read-only timeline of an invoice's audit history (Void events). Fetches
 * only when opened -- never bundled with the invoice list.
 */
export default function InvoiceAuditLogModal({ isOpen, onClose, invoiceId }) {
  const { t } = useTranslation();
  const isConsolidated = isAllBusinessesScope();
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !invoiceId) return;

    let cancelled = false;

    const fetchAuditLogs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getInvoiceAuditLogsForInvoice(invoiceId);
        if (!cancelled && res.status === 200) {
          setAuditLogs(res.data.auditLogs || []);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err?.response?.data?.message || t('auditLogs.error_loading'));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchAuditLogs();

    return () => {
      cancelled = true;
    };
  }, [isOpen, invoiceId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white dark:bg-[#1f1f1f] border border-restro-border-green rounded-2xl max-w-lg w-full p-6 shadow-2xl transition-all transform scale-100 relative text-restro-text max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          type="button"
          aria-label="Close modal"
        >
          <IconX size={18} stroke={iconStroke} />
        </button>

        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">
          {t('auditLogs.modal_title', { invoiceId })}
        </h3>

        {isLoading && (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
            {t('auditLogs.please_wait')}
          </p>
        )}

        {!isLoading && error && (
          <p className="text-sm text-red-600 py-8 text-center">{error}</p>
        )}

        {!isLoading && !error && auditLogs.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
            {t('auditLogs.no_history_for_invoice')}
          </p>
        )}

        {!isLoading && !error && auditLogs.length > 0 && (
          <ol className="relative border-s border-restro-border-green ms-3">
            {auditLogs.map((log) => {
              return (
                <li key={log.id} className="mb-6 ms-6 last:mb-0">
                  <span className="absolute flex items-center justify-center w-7 h-7 rounded-full -start-3.5 ring-4 ring-white dark:ring-[#1f1f1f] bg-red-100 text-red-600">
                    <IconBan size={14} stroke={iconStroke} />
                  </span>

                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="badge badge-error text-white text-xs">
                      {t('auditLogs.action_void')}
                    </span>
                    {isConsolidated && log.business && (
                      <span className="rounded-[42px] bg-restro-gray px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {log.business}
                      </span>
                    )}
                    <time className="text-xs text-gray-500 dark:text-gray-400">
                      {new Intl.DateTimeFormat('en', { dateStyle: "medium", timeStyle: "short" }).format(new Date(log.created_at))}
                    </time>
                  </div>

                  <p className="text-sm text-restro-text">
                    <span className="font-medium">{t('auditLogs.performed_by')}:</span>{" "}
                    {log.performed_by_name || log.performed_by || t('auditLogs.unknown_user')}
                  </p>

                  <p className="text-sm text-restro-text">
                    <span className="font-medium">{t('auditLogs.status_change')}:</span>{" "}
                    {log.previous_status} &rarr; {log.new_status}
                  </p>

                  {log.reason && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 italic">
                      &ldquo;{log.reason}&rdquo;
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
