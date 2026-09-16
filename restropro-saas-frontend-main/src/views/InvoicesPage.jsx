import React, { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Menu, Transition } from "@headlessui/react";
import Page from "../components/Page";
import { isAllBusinessesScope } from "../helpers/BusinessScope";
import {
  IconBan,
  IconDotsVertical,
  IconEye,
  IconFilter,
  IconHistory,
  IconPlus,
  IconPrinter,
  IconReceipt,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { toast } from "react-hot-toast";
import { mutate } from "swr";
import { getInvoiceOrders, getInvoicesInit, searchInvoices, useInvoices, voidInvoice } from "../controllers/invoices.controller";
import { getOrdersInit } from "../controllers/orders.controller";
import { CURRENCIES } from "../config/currencies.config";
import { setDetailsForReceiptPrint, triggerPrintReceipt } from '../helpers/ReceiptHelper';
import { useTheme } from "../contexts/ThemeContext";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { SCOPES, hasFullBusinessAccess } from "../config/scopes";
import DeleteModal from "../components/DeleteModal";
import InvoiceAuditLogModal from "../components/InvoiceAuditLogModal";

function InvoiceActionDropdown({
  invoice_id,
  orderIdsArr,
  tokens,
  payment_type_id,
  isVoid,
  canViewAuditLog,
  canVoid,
  btnViewReceipt,
  btnPrintReceipt,
  btnOpenAuditLogModal,
  btnOpenVoidModal,
  t,
  iconStroke,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);

  const toggleDropdown = (e) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight = 160;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < menuHeight ? rect.top - menuHeight : rect.bottom + 4;
      setCoords({
        top,
        left: rect.right - 192,
      });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClose = () => setIsOpen(false);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("click", handleClose);
    return () => {
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("click", handleClose);
    };
  }, [isOpen]);

  return (
    <div className="inline-block text-left">
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="btn btn-xs btn-circle btn-ghost text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-restro-button-hover"
      >
        <IconDotsVertical size={16} stroke={iconStroke} />
      </button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 9999,
          }}
          className="w-48 rounded-xl bg-white dark:bg-[#252525] p-1.5 shadow-2xl border border-restro-border-green text-left text-xs"
        >
          <button
            onClick={() => {
              setIsOpen(false);
              btnViewReceipt(invoice_id, orderIdsArr, tokens, payment_type_id);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-restro-green-light dark:hover:bg-[#333333]"
          >
            <IconReceipt size={16} stroke={iconStroke} />
            <span>{t("invoices.view_receipt") || "View Receipt"}</span>
          </button>

          <button
            onClick={() => {
              setIsOpen(false);
              btnPrintReceipt(invoice_id, orderIdsArr, tokens, payment_type_id);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-restro-green-light dark:hover:bg-[#333333]"
          >
            <IconPrinter size={16} stroke={iconStroke} />
            <span>{t("invoices.print_receipt") || "Print Receipt"}</span>
          </button>

          {canViewAuditLog && (
            <button
              onClick={() => {
                setIsOpen(false);
                btnOpenAuditLogModal(invoice_id);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-restro-green-light dark:hover:bg-[#333333]"
            >
              <IconHistory size={16} stroke={iconStroke} />
              <span>{t("auditLogs.audit_log_action_title") || "Audit Log"}</span>
            </button>
          )}

          {canVoid && !isVoid && (
            <button
              onClick={() => {
                setIsOpen(false);
                btnOpenVoidModal(invoice_id);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <IconBan size={16} stroke={iconStroke} />
              <span>{t("invoices.void_invoice") || "Void Invoice"}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function InvoicesPage() {
  const { t } = useTranslation();
  // Enterprise "All Businesses" view. The backend labels each invoice with its
  // originating business; invoices are never merged or renumbered.
  const isConsolidated = isAllBusinessesScope(getUserDetailsInLocalStorage()?.role);
  const { role, scope } = getUserDetailsInLocalStorage();
  const userScopes = scope?.split(",") || [];
  const canVoid = hasFullBusinessAccess(role) || userScopes.includes(SCOPES.VOID_INVOICES);
  const canViewAuditLog = hasFullBusinessAccess(role) || userScopes.includes(SCOPES.VIEW_INVOICE_AUDIT_LOG);

  const filters = [
    { key: "today", value: t("invoices.today") },
    { key: "tomorrow", value: t("invoices.tomorrow") },
    { key: "yesterday", value: t("invoices.yesterday") },
    { key: "last_7days", value: t("invoices.last_7days") },
    { key: "this_month", value: t("invoices.this_month") },
    { key: "last_month", value: t("invoices.last_month") },
    { key: "custom", value: t("invoices.custom") },
  ];

  const searchRef = useRef();
  const fromDateRef = useRef();
  const toDateRef = useRef();
  const filterTypeRef = useRef();
  const { theme } = useTheme();

  const now = new Date();
  const defaultDateFrom = `${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
  const defaultDateTo = `${now.getFullYear()}-${(now.getMonth() + 2)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;

  const customerSearchRef = useRef();

  const [state, setState] = useState({
    search: "",
    searchResults: [],
    spage: 1,
    filter: filters[0].key,
    fromDate: null,
    toDate: null,
    customer: null,

    printSettings: null,
    storeSettings: null,
    currency: null,

    paymentTypes: [],
  });

  const [actionModal, setActionModal] = useState({
    open: false,
    invoice: null,
    reason: "",
    isLoading: false,
  });

  const [auditLogModal, setAuditLogModal] = useState({ open: false, invoice: null });

  useEffect(() => {
    async function init() {
      try {
        const res = await getInvoicesInit();
        if (res.status == 200) {
          const ordersInit = res.data;
          const currency = CURRENCIES.find((c) => c.cc == ordersInit?.storeSettings?.currency);

          setState({
            ...state,
            printSettings: ordersInit.printSettings || {},
            storeSettings: ordersInit.storeSettings || {},
            paymentTypes: ordersInit?.paymentTypes || [],
            currency: currency?.symbol,
          });
        }
      } catch (error) {
        console.error(error);
        toast.dismiss();
        toast.error(t('invoices.error_loading_orders'));
      }
    }
    init();
  }, []);

  const { data: invoices, error, isLoading, APIURL } = useInvoices({
    type: state.filter,
    from: state.fromDate,
    to: state.toDate,
  });

  if (isLoading) {
    return <Page>{t('invoices.loading_message')}</Page>;
  }

  if (error) {
    return <Page>{t('invoices.error_loading_details')}</Page>;
  }

  const btnSearch = async () => {
    const searchQuery = searchRef.current.value;
    if (!new String(searchQuery).trim()) {
      return;
    }

    try {
      toast.loading(t('invoices.please_wait'));
      const res = await searchInvoices(new String(searchQuery).trim());
      if (res.status == 200) {
        toast.dismiss();
        setState({
          ...state,
          search: searchQuery,
          searchResults: res.data,
          spage: 1,
        });
      } else {
        toast.dismiss();
        toast.error(t('invoices.no_result_found'));
      }

    } catch (error) {
      console.error(error);
      const message = error.response.data.message || t('invoices.something_went_wrong');

      toast.dismiss();
      toast.error(message);
    }
  }
  const btnClearSearch = () => {
    searchRef.current.value = null;

    setState({
      ...state,
      search: "",
      searchResults: [],
      spage: 1,
    });
  };

  const btnViewReceipt = async (invoiceId, orderIdsArr, tokens, payment_type_id) => {
    try {
      toast.loading(t('invoices.please_wait'));
      const res = await getInvoiceOrders(invoiceId, orderIdsArr);
      toast.dismiss();

      if (res.status == 200) {
        const {
          subtotal,
          taxTotal,
          serviceChargeTotal,
          discountType,
          discountValue,
          discountTotal,
          total,
          orders: ordersArr
        } = res.data;

        const orders = [];
        const orderIds = orderIdsArr.join(", ");

        for (const o of ordersArr) {
          const items = o.items;
          items.forEach((i) => {
            const variant = i.variant_id ? {
              id: i.variant_id,
              title: i.variant_title,
              price: i.variant_price
            } : null;
            orders.push({
              ...i,
              title: i.item_title,
              addons_ids: i?.addons?.length > 0 ? i?.addons?.map((a) => a.id) : [],
              variant: variant
            });
          })
        }

        const { customer_id, customer_type, customer_name, date, delivery_type } = ordersArr;

        let paymentMethodText;
        if (payment_type_id) {
          const paymentType = state.paymentTypes.find((v) => v.id == payment_type_id);
          if (paymentType) {
            paymentMethodText = paymentType.title;
          }
        }

        triggerPrintReceipt({
          cartItems: orders, deliveryType: delivery_type, customerType: customer_type, customer: { id: customer_id, name: customer_name }, tableId: null, currency: state.currency, storeSettings: state.storeSettings, printSettings: state.printSettings,
          itemsTotal: subtotal,
          discountType: discountType,
          discountValue: discountValue,
          discountAmount: discountTotal || 0,
          taxTotal: taxTotal,
          serviceChargeTotal: serviceChargeTotal,
          payableTotal: total,
          tokenNo: tokens,
          orderId: orderIds,
          paymentMethod: paymentMethodText
        });
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('invoices.error_processing_request');
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  };

  const btnPrintReceipt = async (invoiceId, orderIdsArr, tokens, payment_type_id) => {
    try {
      toast.loading(t('invoices.please_wait'));
      const res = await getInvoiceOrders(invoiceId, orderIdsArr);
      toast.dismiss();

      if (res.status == 200) {
        const {
          subtotal,
          taxTotal,
          serviceChargeTotal,
          discountType,
          discountValue,
          discountTotal,
          total,
          orders: ordersArr
        } = res.data;

        const orders = [];
        const orderIds = orderIdsArr.join(", ");

        for (const o of ordersArr) {
          const items = o.items;
          items.forEach((i) => {
            const variant = i.variant_id ? {
              id: i.variant_id,
              title: i.variant_title,
              price: i.variant_price
            } : null;
            orders.push({
              ...i,
              title: i.item_title,
              addons_ids: i?.addons?.length > 0 ? i?.addons?.map((a) => a.id) : [],
              variant: variant
            });
          })
        }

        const { customer_id, customer_type, customer_name, date, delivery_type } = ordersArr;

        let paymentMethodText;
        if (payment_type_id) {
          const paymentType = state.paymentTypes.find((v) => v.id == payment_type_id);
          if (paymentType) {
            paymentMethodText = paymentType.title;
          }
        }

        triggerPrintReceipt({
          cartItems: orders, deliveryType: delivery_type, customerType: customer_type, customer: { id: customer_id, name: customer_name }, tableId: null, currency: state.currency, storeSettings: state.storeSettings, printSettings: state.printSettings,
          itemsTotal: subtotal,
          discountType: discountType,
          discountValue: discountValue,
          discountAmount: discountTotal || 0,
          taxTotal: taxTotal,
          serviceChargeTotal: serviceChargeTotal,
          payableTotal: total,
          tokenNo: tokens,
          orderId: orderIds,
          paymentMethod: paymentMethodText
        });
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('invoices.error_processing_request');
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  };

  const btnOpenVoidModal = (invoiceId) => {
    setActionModal({ open: true, invoice: invoiceId, reason: "", isLoading: false });
  };

  const closeActionModal = () => {
    setActionModal({ open: false, invoice: null, reason: "", isLoading: false });
  };

  const btnOpenAuditLogModal = (invoiceId) => {
    setAuditLogModal({ open: true, invoice: invoiceId });
  };

  const closeAuditLogModal = () => {
    setAuditLogModal({ open: false, invoice: null });
  };

  const confirmActionModal = async () => {
    const { invoice, reason } = actionModal;
    if (!reason.trim()) return;

    setActionModal((prev) => ({ ...prev, isLoading: true }));

    try {
      const res = await voidInvoice(invoice, reason.trim());

      if (res.status === 200) {
        toast.dismiss();
        toast.success(t('invoices.void_success'));
        closeActionModal();
        mutate(APIURL);

        // Search results are separate local state (not SWR-backed), so a
        // void from that table needs an explicit re-search to reflect the
        // new status.
        if (state.search) {
          const searchRes = await searchInvoices(state.search);
          if (searchRes.status === 200) {
            setState((prev) => ({ ...prev, searchResults: searchRes.data }));
          }
        }
      }
    } catch (error) {
      console.error(error);
      const message = error?.response?.data?.message || t('invoices.something_went_wrong');
      toast.dismiss();
      toast.error(message);
      setActionModal((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const renderInvoiceRow = (invoice, index) => {
    const {
      invoice_id,
      created_at,
      sub_total,
      tax_total,
      service_charge_total,
      discount_total,
      total,
      table_id,
      table_title,
      floor,
      delivery_type,
      customer_id,
      name,
      orders,
      payment_type_id,
      business,
      status,
    } = invoice;

    const isVoid = status === "VOID";
    const orderIdsArr = orders?.map((o) => o.order_id) || [];
    const tokenIdsArr = orders?.map((o) => o.token_no) || [];
    const tokens = tokenIdsArr.join(", ");

    return (
      <tr
        key={invoice_id || index}
        className="border-b last:border-0 border-restro-border-green hover:bg-restro-green-10 dark:hover:bg-[#222222] transition text-restro-text"
      >
        {/* 1. Invoice ID (First column - px-4 for left edge padding) */}
        <td className="px-4 py-3 text-xs font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
          <span className="font-mono">#{invoice_id}</span>
          {isVoid ? (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
              {t("invoices.void_badge", "VOID")}
            </span>
          ) : (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
              PAID
            </span>
          )}
        </td>

        {/* 2. Business (if consolidated) */}
        {isConsolidated && (
          <td className="px-3 py-3 text-[11px] whitespace-nowrap">
            <span className="rounded-[42px] bg-restro-gray px-2 py-0.5 text-[10px] text-gray-600 dark:text-gray-300">
              {business}
            </span>
          </td>
        )}

        {/* 3. Tokens (max-w-[120px] break-words so long token lists wrap cleanly) */}
        <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300 max-w-[120px] break-words">
          {tokens || "-"}
        </td>

        {/* 4. Customer (moved right side of tokens, truncated if super long) */}
        <td className="px-3 py-3 max-w-[140px]">
          {name || customer_id ? (
            <div className="space-y-0.5 min-w-0">
              <p className="font-semibold text-gray-800 dark:text-gray-200 text-xs leading-snug truncate" title={name || customer_id}>
                {name || customer_id}
              </p>
              {name && customer_id && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-normal leading-tight truncate" title={customer_id}>
                  {customer_id}
                </p>
              )}
            </div>
          ) : (
            <span className="font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-tight">
              WALKIN
            </span>
          )}
        </td>

        {/* 5. Subtotal */}
        <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
          {state.currency}{sub_total}
        </td>

        {/* 6. Tax */}
        <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
          {state.currency}{tax_total}
        </td>

        {/* 7. Service Charge */}
        <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
          {service_charge_total ? `${state.currency || ""}${service_charge_total}` : "-"}
        </td>

        {/* 8. Discount */}
        <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
          {discount_total ? `${state.currency || ""}${discount_total}` : "-"}
        </td>

        {/* 9. Total */}
        <td className="px-3 py-3 text-xs font-bold text-gray-900 dark:text-white whitespace-nowrap">
          {state.currency}{total}
        </td>

        {/* 10. Delivery Type */}
        <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300 capitalize whitespace-nowrap">
          {delivery_type ? delivery_type : "-"}
        </td>

        {/* 11. Table (Commented out per request) */}
        {/* <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
          {table_id ? <b>{table_title}-{floor}</b> : "-"}
        </td> */}

        {/* 12. Date (moved left side of action) */}
        <td className="px-3 py-3 text-gray-500 text-[11px] whitespace-nowrap">
          {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(created_at))}
        </td>

        {/* 13. Action (Last column - px-4 for right edge padding) */}
        <td className="px-4 py-3 text-right">
          <InvoiceActionDropdown
            invoice_id={invoice_id}
            orderIdsArr={orderIdsArr}
            tokens={tokens}
            payment_type_id={payment_type_id}
            isVoid={isVoid}
            canViewAuditLog={canViewAuditLog}
            canVoid={canVoid}
            btnViewReceipt={btnViewReceipt}
            btnPrintReceipt={btnPrintReceipt}
            btnOpenAuditLogModal={btnOpenAuditLogModal}
            btnOpenVoidModal={btnOpenVoidModal}
            t={t}
            iconStroke={iconStroke}
          />
        </td>
      </tr>
    );
  };

  return (
    <Page>
      <div className="flex flex-wrap gap-4 flex-col md:flex-row md:items-center md:justify-between">
        <h3 className="text-2xl">{t('invoices.title')}</h3>

        <div className="flex flex-wrap gap-2">
          <div className='px-2 py-1 rounded-lg flex items-center bg-restro-gray border border-restro-border-green'>
            <input
              ref={searchRef}
              defaultValue={state.search}
              type="text"
              placeholder={t('invoices.search_placeholder')}
              className="bg-transparent placeholder:text-gray-400 outline-none block"
            />
            {state.search && (
              <button onClick={btnClearSearch} className="text-gray-400">
                <IconX stroke={iconStroke} size={18} />
              </button>
            )}
          </div>
          <button
            onClick={btnSearch}
            className='rounded-lg transition active:scale-95 hover:shadow-lg px-3 py-1 text-white ml-2 bg-restro-green hover:bg-restro-green-button-hover'>
            {t('invoices.search')}
          </button>
          <button
            onClick={() => document.getElementById("filter-dialog").showModal()}
            className='w-8 h-8 flex items-center justify-center text-gray-400 rounded-full active:scale-95 transition hover:bg-restro-button-hover'
          >
            <IconFilter />
          </button>
        </div>
      </div>

      {/* search result */}
      {state.searchResults.length > 0 && <div className="mt-6">
        <h3>{t('invoices.showing_search_result', { search: state.search })}</h3>
        <div className="overflow-x-auto mt-6 border rounded-2xl border-restro-border-green bg-white dark:bg-restro-bg-card-dark-mode">
          <table className="table table-xs md:table-sm w-full">
            <thead>
              <tr className="border-b border-restro-border-green bg-restro-green-light dark:bg-[#1a1a1a] text-restro-green-dark dark:text-gray-300 uppercase tracking-wider text-[11px]">
                <th className="px-4 py-3 font-bold">{t('invoices.invoice_id')}</th>
                {isConsolidated && <th className="px-3 py-3 font-bold">{t("business_switcher.business", "Business")}</th>}
                <th className="px-3 py-3 font-bold">{t('invoices.tokens')}</th>
                <th className="px-3 py-3 font-bold">{t('invoices.customer')}</th>
                <th className="px-3 py-3 font-bold">{t('invoices.subtotal')}</th>
                <th className="px-3 py-3 font-bold">{t('invoices.tax')}</th>
                <th className="px-3 py-3 font-bold">{t('invoices.service_charge')}</th>
                <th className="px-3 py-3 font-bold">{t('invoices.discount')}</th>
                <th className="px-3 py-3 font-bold">{t('invoices.total')}</th>
                <th className="px-3 py-3 font-bold">{t('invoices.delivery_type')}</th>
                {/* <th className="px-3 py-3 font-bold">{t('invoices.table')}</th> */}
                <th className="px-3 py-3 font-bold">{t('invoices.date')}</th>
                <th className="px-4 py-3 font-bold text-right">{t('invoices.action')}</th>
              </tr>
            </thead>
            <tbody>
              {state.searchResults.map((invoice, index) => renderInvoiceRow(invoice, index))}
            </tbody>
          </table>
        </div>
      </div>}
      {/* search result */}

      {/* data */}
      <h3 className="mt-6 mb-4 text-base">{t('invoices.showing_invoices_for', { filter: filters.find(f => f.key == state.filter).value })}</h3>
      {invoices.length == 0 ? (
        <div className="text-center w-full h-[50vh] flex flex-col items-center justify-center text-gray-500">
          <img
            src="/assets/illustrations/invoice-not-found.webp"
            alt="no invoices"
            className="w-1/2 md:w-60"
          />
          <p className="mt-4">{t('invoices.no_invoices')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto mt-6 border rounded-lg border-restro-border-green bg-restro-card-bg shadow-xs">
          <table className='table table-xs md:table-sm w-full'>
            <thead>
              <tr className="border-b border-restro-border-green bg-gray-50/80 dark:bg-[#161B22] text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[11px] font-semibold">
                <th className="px-4 py-3 font-bold">{t('invoices.invoice_id')}</th>
                {isConsolidated && <th className="px-3 py-3 font-bold">{t("business_switcher.business", "Business")}</th>}
                <th className="px-3 py-3 font-bold">{t('invoices.tokens')}</th>
                <th className="px-3 py-3 font-bold">{t('invoices.customer')}</th>
                <th className="px-3 py-3 font-bold">{t('invoices.subtotal')}</th>
                <th className="px-3 py-3 font-bold">{t('invoices.tax')}</th>
                <th className="px-3 py-3 font-bold">{t('invoices.service_charge')}</th>
                <th className="px-3 py-3 font-bold">{t('invoices.discount')}</th>
                <th className="px-3 py-3 font-bold">{t('invoices.total')}</th>
                <th className="px-3 py-3 font-bold">{t('invoices.delivery_type')}</th>
                {/* <th className="px-3 py-3 font-bold">{t('invoices.table')}</th> */}
                <th className="px-3 py-3 font-bold">{t('invoices.date')}</th>
                <th className="px-4 py-3 font-bold text-right">{t('invoices.action')}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice, index) => renderInvoiceRow(invoice, index))}
            </tbody>
          </table>
        </div>
      )}
      {/* data */}

      {/* filter dialog */}
      <dialog id="filter-dialog" className="modal">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <h3 className="font-bold text-lg flex items-center">
            <IconFilter stroke={iconStroke} /> {t('invoices.filter')}
          </h3>
          {/* filters */}
          <div className="my-4">
            <div>
              <label className=" block text-gray-500 text-sm">{t('invoices.filter')}</label>
              <select
                className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green'
                ref={filterTypeRef}
              >
                {filters.map((filter, index) => (
                  <option key={index} value={filter.key}>
                    {filter.value}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 mt-4">
              <div className="flex-1">
                <label
                  htmlFor="fromDate"
                  className=" block text-gray-500 text-sm"
                >
                  {t('invoices.from')}
                </label>
                <input
                  defaultValue={defaultDateFrom}
                  type="date"
                  ref={fromDateRef}
                  className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green'
                />
              </div>
              <div className="flex-1">
                <label
                  htmlFor="toDate"
                  className=" block text-gray-500 text-sm"
                >
                  {t('invoices.to')}
                </label>
                <input
                  defaultValue={defaultDateTo}
                  type="date"
                  ref={toDateRef}
                  className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green'
                />
              </div>
            </div>
          </div>
          {/* filters */}
          <div className="modal-action">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className='btn transition active:scale-95 hover:shadow-lg px-4 py-3 flex-1 items-center justify-center align-center rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text'>{t('invoices.close')}</button>
              <button onClick={() => {
                setState({
                  ...state,
                  filter: filterTypeRef.current.value,
                  fromDate: fromDateRef.current.value || null,
                  toDate: toDateRef.current.value || null,
                });
              }} className='rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white ml-3 border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'>{t('invoices.apply')}</button>
            </form>
          </div>
        </div>
      </dialog>
      {/* filter dialog */}

      <DeleteModal
        isOpen={actionModal.open}
        onClose={closeActionModal}
        onConfirm={confirmActionModal}
        isLoading={actionModal.isLoading}
        requireReason
        reason={actionModal.reason}
        onReasonChange={(reason) => setActionModal((prev) => ({ ...prev, reason }))}
        title={t('invoices.void_confirm_title', { invoiceId: actionModal.invoice })}
        description={t('invoices.void_confirm_description')}
        reasonPlaceholder={t('invoices.void_reason_placeholder')}
        confirmText={t('invoices.void_invoice')}
      />

      <InvoiceAuditLogModal
        isOpen={auditLogModal.open}
        onClose={closeAuditLogModal}
        invoiceId={auditLogModal.invoice}
      />
    </Page>
  )
}
