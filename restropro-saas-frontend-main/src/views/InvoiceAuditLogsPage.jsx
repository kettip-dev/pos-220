import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";
import Page from "../components/Page";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconFilter,
  IconRefresh,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { mutate } from "swr";
import { useInvoiceAuditLogs } from "../controllers/invoiceAuditLog.controller";
import { useTheme } from "../contexts/ThemeContext";
import { isAllBusinessesScope } from "../helpers/BusinessScope";

const DATE_FILTERS = [
  { key: "today", value: "invoices.today" },
  { key: "yesterday", value: "invoices.yesterday" },
  { key: "last_7days", value: "invoices.last_7days" },
  { key: "this_month", value: "invoices.this_month" },
  { key: "last_month", value: "invoices.last_month" },
  { key: "custom", value: "invoices.custom" },
];

export default function InvoiceAuditLogsPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isConsolidated = isAllBusinessesScope();

  const invoiceNumberRef = useRef();
  const performedByRef = useRef();
  const actionRef = useRef();
  const filterTypeRef = useRef();
  const fromDateRef = useRef();
  const toDateRef = useRef();

  const [state, setState] = useState({
    page: 1,
    perPage: 10,
    invoiceNumber: "",
    performedBy: "",
    action: "",
    filter: "",
    fromDate: null,
    toDate: null,
  });

  const { data, error, isLoading, APIURL } = useInvoiceAuditLogs({
    page: state.page,
    perPage: state.perPage,
    invoiceNumber: state.invoiceNumber,
    performedBy: state.performedBy,
    action: state.action,
    type: state.filter,
    from: state.fromDate,
    to: state.toDate,
  });

  const btnSearch = () => {
    setState((prev) => ({
      ...prev,
      invoiceNumber: invoiceNumberRef.current.value.trim(),
      performedBy: performedByRef.current.value.trim(),
      action: actionRef.current.value,
      page: 1,
    }));
  };

  const btnClearSearch = () => {
    invoiceNumberRef.current.value = "";
    performedByRef.current.value = "";
    actionRef.current.value = "";
    setState((prev) => ({
      ...prev,
      invoiceNumber: "",
      performedBy: "",
      action: "",
      page: 1,
    }));
  };

  const btnRefresh = () => {
    mutate(APIURL);
  };

  // pagination
  const btnPaginationFirstPage = () => setState((prev) => ({ ...prev, page: 1 }));
  const btnPaginationLastPage = () => setState((prev) => ({ ...prev, page: data?.totalPages || 1 }));
  const btnPaginationNextPage = () => {
    if (!data || state.page >= data.totalPages) return;
    setState((prev) => ({ ...prev, page: prev.page + 1 }));
  };
  const btnPaginationPreviousPage = () => {
    if (state.page <= 1) return;
    setState((prev) => ({ ...prev, page: prev.page - 1 }));
  };
  // pagination

  const hasActiveSearch = state.invoiceNumber || state.performedBy || state.action;

  return (
    <Page>
      <div className="flex flex-wrap gap-4 flex-col md:flex-row md:items-center md:justify-between">
        <h3 className="text-2xl">{t('auditLogs.title')}</h3>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={invoiceNumberRef}
            type="text"
            placeholder={t('auditLogs.search_invoice_placeholder')}
            className="px-3 py-1.5 rounded-lg bg-restro-gray border border-restro-border-green outline-none text-sm w-40"
          />
          <input
            ref={performedByRef}
            type="text"
            placeholder={t('auditLogs.search_user_placeholder')}
            className="px-3 py-1.5 rounded-lg bg-restro-gray border border-restro-border-green outline-none text-sm w-40"
          />
          <select
            ref={actionRef}
            defaultValue=""
            className="px-3 py-1.5 rounded-lg bg-restro-gray border border-restro-border-green outline-none text-sm"
          >
            <option value="">{t('auditLogs.action_all')}</option>
            <option value="VOID">{t('auditLogs.action_void')}</option>
          </select>
          <button
            onClick={btnSearch}
            className="rounded-lg transition active:scale-95 hover:shadow-lg px-3 py-1.5 text-white bg-restro-green hover:bg-restro-green-button-hover flex items-center gap-1 text-sm"
          >
            <IconSearch stroke={iconStroke} size={16} /> {t('invoices.search')}
          </button>
          {hasActiveSearch && (
            <button onClick={btnClearSearch} className="text-gray-400" title={t('auditLogs.clear_search')}>
              <IconX stroke={iconStroke} size={18} />
            </button>
          )}
          <button
            onClick={() => document.getElementById("audit-log-filter-dialog").showModal()}
            className="w-8 h-8 flex items-center justify-center text-gray-400 rounded-full active:scale-95 transition hover:bg-restro-button-hover"
            title={t('invoices.filter')}
          >
            <IconFilter stroke={iconStroke} />
          </button>
          <button
            onClick={btnRefresh}
            className="w-8 h-8 flex items-center justify-center text-gray-400 rounded-full active:scale-95 transition hover:bg-restro-button-hover"
            title={t('auditLogs.refresh')}
          >
            <IconRefresh stroke={iconStroke} />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="text-center w-full h-[40vh] flex items-center justify-center text-gray-500">
          {t('auditLogs.please_wait')}
        </div>
      )}

      {!isLoading && error && (
        <div className="text-center w-full h-[40vh] flex items-center justify-center text-red-600">
          {t('auditLogs.error_loading')}
        </div>
      )}

      {!isLoading && !error && data && data.auditLogs.length === 0 && (
        <div className="text-center w-full h-[50vh] flex flex-col items-center justify-center text-gray-500">
          <img
            src="/assets/illustrations/invoice-not-found.webp"
            alt="no audit logs"
            className="w-1/2 md:w-60"
          />
          <p className="mt-4">{t('auditLogs.no_results')}</p>
        </div>
      )}

      {!isLoading && !error && data && data.auditLogs.length > 0 && (
        <>
          <div className="overflow-x-auto w-full mt-6">
            <table className="table table-sm table-zebra border w-full border-restro-border-green">
              <thead>
                <tr>
                  <th>{t('auditLogs.column_date_time')}</th>
                  {isConsolidated && <th>{t("business_switcher.business", "Business")}</th>}
                  <th>{t('auditLogs.column_invoice_number')}</th>
                  <th>{t('auditLogs.column_action')}</th>
                  <th>{t('auditLogs.column_performed_by')}</th>
                  <th>{t('auditLogs.column_reason')}</th>
                  <th>{t('auditLogs.column_previous_status')}</th>
                  <th>{t('auditLogs.column_new_status')}</th>
                </tr>
              </thead>
              <tbody>
                {data.auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Intl.DateTimeFormat('en', { dateStyle: "medium", timeStyle: "short" }).format(new Date(log.created_at))}</td>
                    {isConsolidated && (
                      <td>
                        <span className="rounded-[42px] bg-restro-gray px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                          {log.business}
                        </span>
                      </td>
                    )}
                    <td>{log.invoice_number}</td>
                    <td>
                      <span className="badge badge-error text-white text-xs">
                        {t('auditLogs.action_void')}
                      </span>
                    </td>
                    <td>{log.performed_by_name || log.performed_by || t('auditLogs.unknown_user')}</td>
                    <td className="max-w-xs truncate" title={log.reason}>{log.reason}</td>
                    <td>{log.previous_status}</td>
                    <td>{log.new_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          <div className="flex justify-between items-center mt-8">
            <p className="text-sm text-gray-500">
              {t('auditLogs.showing_for', { total: data.totalAuditLogs })}
            </p>
            <div className="join">
              <button
                onClick={btnPaginationFirstPage}
                className={clsx("join-item btn btn-sm", {
                  "bg-restro-bg-card-dark-mode text-gray-200": theme === "black" && state.page !== 1,
                  "bg-white text-gray-800": theme !== "black" && state.page !== 1,
                  "bg-restro-bg-card-dark-mode text-gray-400 cursor-not-allowed": theme === "black" && state.page === 1,
                  "bg-gray-100 text-gray-400 cursor-not-allowed": theme !== "black" && state.page === 1,
                })}
              >
                <IconChevronsLeft stroke={iconStroke} />
              </button>
              <button
                onClick={btnPaginationPreviousPage}
                className={clsx("join-item btn btn-sm", {
                  "bg-restro-bg-card-dark-mode text-gray-200": theme === "black" && state.page !== 1,
                  "bg-white text-gray-800": theme !== "black" && state.page !== 1,
                  "bg-restro-bg-card-dark-mode text-gray-400 cursor-not-allowed": theme === "black" && state.page === 1,
                  "bg-gray-100 text-gray-400 cursor-not-allowed": theme !== "black" && state.page === 1,
                })}
              >
                <IconChevronLeft stroke={iconStroke} />
              </button>
              <button className="join-item btn btn-sm bg-white text-gray-800 dark:bg-restro-bg-card-dark-mode dark:text-gray-200">
                {t('auditLogs.page_of', { page: data.currentPage, totalPages: data.totalPages })}
              </button>
              <button
                onClick={btnPaginationNextPage}
                className={clsx("join-item btn btn-sm", {
                  "bg-restro-bg-card-dark-mode text-gray-200": theme === "black" && state.page !== data.totalPages,
                  "bg-white text-gray-800": theme !== "black" && state.page !== data.totalPages,
                  "bg-restro-bg-card-dark-mode text-gray-400 cursor-not-allowed": theme === "black" && state.page === data.totalPages,
                  "bg-gray-100 text-gray-400 cursor-not-allowed": theme !== "black" && state.page === data.totalPages,
                })}
              >
                <IconChevronRight stroke={iconStroke} />
              </button>
              <button
                onClick={btnPaginationLastPage}
                className={clsx("join-item btn btn-sm", {
                  "bg-restro-bg-card-dark-mode text-gray-200": theme === "black" && state.page !== data.totalPages,
                  "bg-white text-gray-800": theme !== "black" && state.page !== data.totalPages,
                  "bg-restro-bg-card-dark-mode text-gray-400 cursor-not-allowed": theme === "black" && state.page === data.totalPages,
                  "bg-gray-100 text-gray-400 cursor-not-allowed": theme !== "black" && state.page === data.totalPages,
                })}
              >
                <IconChevronsRight stroke={iconStroke} />
              </button>
            </div>
          </div>
          {/* pagination */}
        </>
      )}

      {/* filter dialog */}
      <dialog id="audit-log-filter-dialog" className="modal">
        <div className="modal-box border border-restro-border-green dark:rounded-2xl">
          <h3 className="font-bold text-lg flex items-center">
            <IconFilter stroke={iconStroke} /> {t('invoices.filter')}
          </h3>
          <div className="my-4">
            <div>
              <label className="block text-gray-500 text-sm">{t('invoices.filter')}</label>
              <select
                className="text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green"
                ref={filterTypeRef}
                defaultValue=""
              >
                <option value="">{t('auditLogs.action_all')}</option>
                {DATE_FILTERS.map((filter) => (
                  <option key={filter.key} value={filter.key}>
                    {t(filter.value)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <div className="flex-1">
                <label className="block text-gray-500 text-sm">{t('invoices.from')}</label>
                <input
                  type="date"
                  ref={fromDateRef}
                  className="text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green"
                />
              </div>
              <div className="flex-1">
                <label className="block text-gray-500 text-sm">{t('invoices.to')}</label>
                <input
                  type="date"
                  ref={toDateRef}
                  className="text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green"
                />
              </div>
            </div>
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn transition active:scale-95 hover:shadow-lg px-4 py-3 flex-1 items-center justify-center align-center rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text">
                {t('invoices.close')}
              </button>
              <button
                onClick={() => {
                  setState((prev) => ({
                    ...prev,
                    filter: filterTypeRef.current.value,
                    fromDate: fromDateRef.current.value || null,
                    toDate: toDateRef.current.value || null,
                    page: 1,
                  }));
                }}
                className="rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white ml-3 border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover"
              >
                {t('invoices.apply')}
              </button>
            </form>
          </div>
        </div>
      </dialog>
      {/* filter dialog */}
    </Page>
  );
}
