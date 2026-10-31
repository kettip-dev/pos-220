import React, { useRef, useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Page from "../components/Page";
import { isAllBusinessesScope } from "../helpers/BusinessScope";
import {
  IconBan,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconFileSpreadsheet,
  IconFilter,
  IconHistory,
  IconPlus,
  IconPrinter,
  IconReceipt,
  IconReceiptTax,
  IconSearch,
  IconSettings,
  IconTag,
  IconCash,
  IconX,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { toast } from "react-hot-toast";
import { mutate } from "swr";
import {
  getInvoiceOrders,
  getInvoicesInit,
  searchInvoices,
  useInvoices,
  voidInvoice,
} from "../controllers/invoices.controller";
import { CURRENCIES } from "../config/currencies.config";
import { triggerPrintReceipt } from "../helpers/ReceiptHelper";
import { useTheme } from "../contexts/ThemeContext";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { SCOPES, hasFullBusinessAccess } from "../config/scopes";
import DeleteModal from "../components/DeleteModal";
import InvoiceAuditLogModal from "../components/InvoiceAuditLogModal";
import InvoiceDetailsDrawer from "../components/InvoiceDetailsDrawer";
import clsx from "clsx";

/* ──────────────────────────────────────────────────────────────────────────
   QuickBooks-Style Row Action Dropdown
   Renders as "View receipt ∨" text link button + dropdown menu
   ────────────────────────────────────────────────────────────────────────── */
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
  invoiceSummary,
  t,
  iconStroke,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const containerRef = useRef(null);

  const toggleDropdown = (e) => {
    e.stopPropagation();
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const menuHeight = 180;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top =
        spaceBelow < menuHeight ? rect.top - menuHeight : rect.bottom + 4;
      setCoords({
        top,
        left: Math.max(12, rect.right - 200),
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
    <div ref={containerRef} className="relative inline-flex items-center justify-end text-right">
      {/* Split action button */}
      <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-2xs hover:border-slate-300 dark:hover:border-zinc-600 transition">
        {/* Main action: Click to slide open details drawer */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            btnViewReceipt(invoice_id, orderIdsArr, tokens, payment_type_id, invoiceSummary);
          }}
          className="group inline-flex items-center gap-1.5 py-1.5 px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-50 dark:hover:bg-zinc-700/60 rounded-l-lg transition active:scale-95 cursor-pointer"
          title={t("invoices.view_receipt") || "View receipt"}
        >
          <span>{t("invoices.view_receipt") || "View receipt"}</span>
        </button>

        {/* Dropdown toggle */}
        <button
          type="button"
          onClick={toggleDropdown}
          aria-label="More actions"
          className="py-1.5 px-1.5 border-l border-slate-200 dark:border-zinc-700 text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-50 dark:hover:bg-zinc-700/60 rounded-r-lg transition active:scale-95 cursor-pointer"
        >
          <IconChevronDown
            size={14}
            stroke={iconStroke}
            className={clsx(
              "text-slate-500 transition-transform duration-150",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </div>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 9999,
          }}
          className="w-48 rounded-xl bg-white dark:bg-[#1e1e1e] p-1 shadow-xl border border-slate-200 dark:border-[#333333] text-left text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            onClick={() => {
              setIsOpen(false);
              btnViewReceipt(invoice_id, orderIdsArr, tokens, payment_type_id, invoiceSummary);
            }}
            className="flex w-full min-h-[36px] items-center gap-2 rounded-lg px-3 py-2 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition active:scale-95 cursor-pointer"
          >
            <IconReceipt size={16} stroke={iconStroke} className="text-emerald-600 shrink-0" />
            <span>{t("invoices.view_receipt") || "View Receipt"}</span>
          </button>

          <button
            onClick={() => {
              setIsOpen(false);
              btnPrintReceipt(invoice_id, orderIdsArr, tokens, payment_type_id);
            }}
            className="flex w-full min-h-[36px] items-center gap-2 rounded-lg px-3 py-2 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition active:scale-95 cursor-pointer"
          >
            <IconPrinter size={16} stroke={iconStroke} className="text-slate-500 shrink-0" />
            <span>{t("invoices.print_receipt") || "Print Receipt"}</span>
          </button>

          {canViewAuditLog && (
            <button
              onClick={() => {
                setIsOpen(false);
                btnOpenAuditLogModal(invoice_id);
              }}
              className="flex w-full min-h-[36px] items-center gap-2 rounded-lg px-3 py-2 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition active:scale-95 cursor-pointer"
            >
              <IconHistory size={16} stroke={iconStroke} className="text-slate-500 shrink-0" />
              <span>{t("auditLogs.audit_log_action_title") || "Audit Log"}</span>
            </button>
          )}

          {canVoid && !isVoid && (
            <button
              onClick={() => {
                setIsOpen(false);
                btnOpenVoidModal(invoice_id);
              }}
              className="flex w-full min-h-[36px] items-center gap-2 rounded-lg px-3 py-2 font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition active:scale-95 cursor-pointer"
            >
              <IconBan size={16} stroke={iconStroke} className="shrink-0" />
              <span>{t("invoices.void_invoice") || "Void Invoice"}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Main Invoices Page - QuickBooks Online Styled Data Grid
   ────────────────────────────────────────────────────────────────────────── */
export default function InvoicesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isConsolidated = isAllBusinessesScope(
    getUserDetailsInLocalStorage()?.role
  );
  const { role, scope } = getUserDetailsInLocalStorage();
  const userScopes = scope?.split(",") || [];
  const canVoid =
    hasFullBusinessAccess(role) || userScopes.includes(SCOPES.VOID_INVOICES);
  const canViewAuditLog =
    hasFullBusinessAccess(role) ||
    userScopes.includes(SCOPES.VIEW_INVOICE_AUDIT_LOG);

  const filters = [
    { key: "all", value: "All" },
    { key: "today", value: t("invoices.today") },
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
  const settingsBtnRef = useRef();
  const { theme } = useTheme();

  const now = new Date();
  const defaultDateFrom = `${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
  const defaultDateTo = `${now.getFullYear()}-${(now.getMonth() + 2)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;

  const [state, setState] = useState({
    search: "",
    searchResults: [],
    filter: "this_month",
    statusFilter: "ALL", // "ALL", "PAID", "VOID"
    fromDate: null,
    toDate: null,
    customer: null,

    printSettings: null,
    storeSettings: null,
    currency: null,

    paymentTypes: [],
  });

  // Table options (QuickBooks gear icon settings)
  const [tableSettings, setTableSettings] = useState({
    compactDensity: false,
    pageSize: 25,
    currentPage: 1,
    showGearMenu: false,
    visibleColumns: {
      tokens: false,
      customer: true,
      subtotal: true,
      tax: false,
      serviceCharge: false,
      discount: false,
      date: true,
    },
  });

  // Sorting state (QuickBooks column headers like "Account type ↑")
  const [sorting, setSorting] = useState({
    field: "created_at",
    direction: "desc", // 'asc' or 'desc'
  });

  // Checkbox row selection state
  const [selectedInvoices, setSelectedInvoices] = useState(new Set());

  const [actionModal, setActionModal] = useState({
    open: false,
    invoice: null,
    reason: "",
    isLoading: false,
  });

  const [auditLogModal, setAuditLogModal] = useState({
    open: false,
    invoice: null,
  });

  const [detailsDrawer, setDetailsDrawer] = useState({
    isOpen: false,
    invoiceId: null,
    orderIdsArr: [],
    tokens: "",
    paymentTypeId: null,
    invoiceSummary: null,
  });

  useEffect(() => {
    async function init() {
      try {
        const res = await getInvoicesInit();
        if (res.status == 200) {
          const ordersInit = res.data;
          const currency = CURRENCIES.find(
            (c) => c.cc == ordersInit?.storeSettings?.currency
          );

          setState((prev) => ({
            ...prev,
            printSettings: ordersInit.printSettings || {},
            storeSettings: ordersInit.storeSettings || {},
            paymentTypes: ordersInit?.paymentTypes || [],
            currency: currency?.symbol || "",
          }));
        }
      } catch (error) {
        console.error(error);
        toast.dismiss();
        toast.error(t("invoices.error_loading_orders"));
      }
    }
    init();
  }, []);

  const {
    data: invoices = [],
    error,
    isLoading,
    APIURL,
  } = useInvoices({
    type: state.filter === "all" ? null : state.filter,
    from: state.fromDate,
    to: state.toDate,
  });

  // Close gear menu when clicking outside
  useEffect(() => {
    if (!tableSettings.showGearMenu) return;
    const handleClickOutside = (e) => {
      if (
        settingsBtnRef.current &&
        !settingsBtnRef.current.contains(e.target)
      ) {
        setTableSettings((prev) => ({ ...prev, showGearMenu: false }));
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [tableSettings.showGearMenu]);

  // Filtered & Sorted invoice list
  const activeInvoicesList = useMemo(() => {
    let list =
      state.search && state.searchResults.length > 0
        ? [...state.searchResults]
        : [...(invoices || [])];

    // Status filter
    if (state.statusFilter === "PAID") {
      list = list.filter((inv) => inv.status !== "VOID");
    } else if (state.statusFilter === "VOID") {
      list = list.filter((inv) => inv.status === "VOID");
    }

    // Client-side text filter if typed
    if (state.search && state.searchResults.length === 0) {
      const q = state.search.toLowerCase().trim();
      list = list.filter((inv) => {
        const invId = String(inv.invoice_id || "").toLowerCase();
        const custName = String(inv.name || inv.customer_id || "").toLowerCase();
        const tokens = inv.orders?.map((o) => String(o.token_no)).join(" ") || "";
        return invId.includes(q) || custName.includes(q) || tokens.includes(q);
      });
    }

    // Sort
    list.sort((a, b) => {
      const field = sorting.field;
      let valA = a[field];
      let valB = b[field];

      if (field === "created_at") {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else if (field === "total" || field === "sub_total") {
        valA = Number(valA || 0);
        valB = Number(valB || 0);
      } else if (field === "invoice_id") {
        valA = Number(valA || 0);
        valB = Number(valB || 0);
      } else {
        valA = String(valA || "").toLowerCase();
        valB = String(valB || "").toLowerCase();
      }

      if (valA < valB) return sorting.direction === "asc" ? -1 : 1;
      if (valA > valB) return sorting.direction === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [invoices, state.search, state.searchResults, state.statusFilter, sorting]);

  // KPI Calculations
  const kpiStats = useMemo(() => {
    let totalCount = activeInvoicesList.length;
    let paidCount = 0;
    let voidCount = 0;
    let netRevenue = 0;
    let taxAndService = 0;
    let totalDiscounts = 0;

    activeInvoicesList.forEach((inv) => {
      if (inv.status === "VOID") {
        voidCount += 1;
      } else {
        paidCount += 1;
        netRevenue += Number(inv.total) || 0;
        taxAndService +=
          (Number(inv.tax_total) || 0) +
          (Number(inv.service_charge_total) || 0);
        totalDiscounts += Number(inv.discount_total) || 0;
      }
    });

    return {
      totalCount,
      paidCount,
      voidCount,
      netRevenue,
      taxAndService,
      totalDiscounts,
    };
  }, [activeInvoicesList]);

  // Pagination calculation
  const totalItems = activeInvoicesList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / tableSettings.pageSize));
  const currentPage = Math.min(tableSettings.currentPage, totalPages);
  const startIndex = (currentPage - 1) * tableSettings.pageSize;
  const endIndex = Math.min(startIndex + tableSettings.pageSize, totalItems);
  const paginatedInvoices = activeInvoicesList.slice(startIndex, endIndex);

  const formatMoney = (val) => {
    const num = Number(val) || 0;
    return `${state.currency || ""}${num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getDeliveryTypeLabel = (type) => {
    if (!type) return "Dine-In";
    const key = String(type).toLowerCase();
    if (key === "dinein" || key === "dine-in") return t("invoices.dinein", "Dine-In");
    if (key === "takeaway" || key === "take-away") return t("invoices.takeaway", "Takeaway");
    if (key === "delivery") return t("invoices.delivery", "Delivery");
    return type;
  };

  // Toggle sorting on column click
  const handleSort = (field) => {
    setSorting((prev) => {
      if (prev.field === field) {
        return {
          field,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { field, direction: "asc" };
    });
  };

  // Checkbox handlers
  const isAllCurrentPageSelected =
    paginatedInvoices.length > 0 &&
    paginatedInvoices.every((inv) => selectedInvoices.has(inv.invoice_id));

  const toggleSelectAll = () => {
    setSelectedInvoices((prev) => {
      const next = new Set(prev);
      if (isAllCurrentPageSelected) {
        paginatedInvoices.forEach((inv) => next.delete(inv.invoice_id));
      } else {
        paginatedInvoices.forEach((inv) => next.add(inv.invoice_id));
      }
      return next;
    });
  };

  const toggleSelectRow = (invoiceId) => {
    setSelectedInvoices((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  // Export visible/selected invoices to Excel (.xlsx)
  const handleExportToExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const targetList =
        selectedInvoices.size > 0
          ? activeInvoicesList.filter((inv) =>
              selectedInvoices.has(inv.invoice_id)
            )
          : activeInvoicesList;

      if (targetList.length === 0) {
        toast.error("No invoice records to export");
        return;
      }

      toast.loading("Preparing Excel export...");
      const exportData = targetList.map((inv) => ({
        "Invoice #": `#${inv.invoice_id}`,
        Date: new Date(inv.created_at).toLocaleString(),
        Customer: inv.name || inv.customer_id || "Walk-in",
        "Dining Type": getDeliveryTypeLabel(inv.delivery_type),
        Table: inv.table_title || "-",
        Tokens:
          inv.orders?.map((o) => o.token_no).filter(Boolean).join(", ") || "-",
        Subtotal: Number(inv.sub_total || 0),
        Tax: Number(inv.tax_total || 0),
        "Service Charge": Number(inv.service_charge_total || 0),
        Discount: Number(inv.discount_total || 0),
        Total: Number(inv.total || 0),
        Status: inv.status === "VOID" ? "VOID" : "PAID",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");
      XLSX.writeFile(
        workbook,
        `Invoices_Export_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      toast.dismiss();
      toast.success("Invoices exported successfully!");
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error("Failed to export invoices");
    }
  };

  // Print invoices list
  const handlePrintTable = () => {
    window.print();
  };

  const btnSearch = async () => {
    const searchQuery = searchRef.current?.value || "";
    if (!String(searchQuery).trim()) {
      btnClearSearch();
      return;
    }

    try {
      toast.loading(t("invoices.please_wait"));
      const res = await searchInvoices(String(searchQuery).trim());
      if (res.status == 200) {
        toast.dismiss();
        setState((prev) => ({
          ...prev,
          search: String(searchQuery).trim(),
          searchResults: res.data || [],
        }));
        setTableSettings((prev) => ({ ...prev, currentPage: 1 }));
      } else {
        toast.dismiss();
        toast.error(t("invoices.no_result_found"));
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message || t("invoices.something_went_wrong");
      toast.dismiss();
      toast.error(message);
    }
  };

  const btnClearSearch = () => {
    if (searchRef.current) {
      searchRef.current.value = "";
    }
    setState((prev) => ({
      ...prev,
      search: "",
      searchResults: [],
    }));
    setTableSettings((prev) => ({ ...prev, currentPage: 1 }));
  };

  const handleReceiptPrintFlow = async (
    invoiceId,
    orderIdsArr,
    tokens,
    payment_type_id
  ) => {
    try {
      toast.loading(t("invoices.please_wait"));
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
          applied_promotions,
          promotion_discount_total,
          total,
          orders: ordersArr,
        } = res.data;

        const orders = [];
        const orderIds = orderIdsArr.join(", ");

        for (const o of ordersArr) {
          const items = o.items;
          items.forEach((i) => {
            const variant = i.variant_id
              ? {
                  id: i.variant_id,
                  title: i.variant_title,
                  price: i.variant_price,
                }
              : null;
            orders.push({
              ...i,
              title: i.item_title,
              addons_ids:
                i?.addons?.length > 0 ? i?.addons?.map((a) => a.id) : [],
              variant: variant,
            });
          });
        }

        const firstOrder =
          Array.isArray(ordersArr) && ordersArr.length > 0
            ? ordersArr[0]
            : ordersArr || {};
        const {
          customer_id,
          customer_type,
          customer_name,
          delivery_type,
        } = firstOrder;

        let paymentMethodText;
        if (payment_type_id) {
          const paymentType = state.paymentTypes.find(
            (v) => v.id == payment_type_id
          );
          if (paymentType) {
            paymentMethodText = paymentType.title;
          }
        }

        triggerPrintReceipt({
          cartItems: orders,
          deliveryType: delivery_type,
          customerType: customer_type,
          customer: { id: customer_id, name: customer_name },
          tableId: null,
          currency: state.currency,
          storeSettings: state.storeSettings,
          printSettings: state.printSettings,
          itemsTotal: subtotal,
          discountType: discountType,
          discountValue: discountValue,
          discountAmount: discountTotal || 0,
          appliedPromotions: typeof applied_promotions === "string" ? JSON.parse(applied_promotions) : applied_promotions,
          promotionDiscountTotal: promotion_discount_total || 0,
          taxTotal: taxTotal,
          serviceChargeTotal: serviceChargeTotal,
          payableTotal: total,
          tokenNo: tokens,
          orderId: orderIds,
          paymentMethod: paymentMethodText,
        });
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        t("invoices.error_processing_request");
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  };

  const btnViewReceipt = (
    invoiceId,
    orderIdsArr = [],
    tokens = "",
    paymentTypeId = null,
    invoiceSummary = null
  ) => {
    setDetailsDrawer({
      isOpen: true,
      invoiceId,
      orderIdsArr: orderIdsArr || [],
      tokens: tokens || "",
      paymentTypeId,
      invoiceSummary,
    });
  };

  const closeDetailsDrawer = () => {
    setDetailsDrawer((prev) => ({ ...prev, isOpen: false }));
  };

  const btnPrintReceipt = handleReceiptPrintFlow;

  const btnOpenVoidModal = (invoiceId) => {
    setActionModal({
      open: true,
      invoice: invoiceId,
      reason: "",
      isLoading: false,
    });
  };

  const closeActionModal = () => {
    setActionModal({
      open: false,
      invoice: null,
      reason: "",
      isLoading: false,
    });
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
        toast.success(t("invoices.void_success"));
        closeActionModal();
        mutate(APIURL);

        if (state.search) {
          const searchRes = await searchInvoices(state.search);
          if (searchRes.status === 200) {
            setState((prev) => ({ ...prev, searchResults: searchRes.data }));
          }
        }
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message || t("invoices.something_went_wrong");
      toast.dismiss();
      toast.error(message);
      setActionModal((prev) => ({ ...prev, isLoading: false }));
    }
  };

  if (isLoading) {
    return (
      <Page>
        <div className="flex items-center justify-center p-20 text-slate-400 gap-3">
          <span className="loading loading-spinner loading-md"></span>
          <span className="text-sm font-medium">{t("invoices.loading_message")}</span>
        </div>
      </Page>
    );
  }

  if (error) {
    return <Page>{t("invoices.error_loading_details")}</Page>;
  }

  const { visibleColumns, compactDensity } = tableSettings;

  return (
    <Page>
      {/* ── Breadcrumbs ── */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400 font-normal mb-1">
        <span>Accounting</span>
        <span className="text-slate-300 dark:text-neutral-600">/</span>
        <span className="text-slate-700 dark:text-neutral-300 font-medium">
          {t("invoices.title") || "Invoices"}
        </span>
      </div>

      {/* ── QuickBooks Page Header & Top Buttons ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
            {t("invoices.title") || "Invoices"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
            {t("invoices.subtitle") || "Manage sales receipts, customer payments and audit logs"}
          </p>
        </div>

        {/* Top Right Header Action Buttons (QuickBooks Clean up, Run report, New account) */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Status Dropdown / Clean up */}
          <div className="dropdown dropdown-bottom dropdown-end">
            <button
              tabIndex={0}
              type="button"
              className="min-h-[42px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#18181b] hover:bg-slate-50 dark:hover:bg-[#202020] text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium flex items-center gap-1.5 active:scale-95 transition"
            >
              <span>
                {state.statusFilter === "ALL"
                  ? "Clean up"
                  : state.statusFilter === "PAID"
                  ? "Status: Paid"
                  : "Status: Void"}
              </span>
              <IconChevronDown size={14} stroke={iconStroke} />
            </button>
            <ul
              tabIndex={0}
              className="dropdown-content z-[100] menu p-1.5 shadow-xl bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-neutral-700 rounded-xl w-44 text-xs font-medium mt-1"
            >
              <li>
                <button
                  type="button"
                  onClick={() => setState((p) => ({ ...p, statusFilter: "ALL" }))}
                  className={clsx(
                    state.statusFilter === "ALL" &&
                      "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold"
                  )}
                >
                  All Invoices
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    setState((p) => ({ ...p, statusFilter: "PAID" }))
                  }
                  className={clsx(
                    state.statusFilter === "PAID" &&
                      "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold"
                  )}
                >
                  Paid Only
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    setState((p) => ({ ...p, statusFilter: "VOID" }))
                  }
                  className={clsx(
                    state.statusFilter === "VOID" &&
                      "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold"
                  )}
                >
                  Void Only
                </button>
              </li>
            </ul>
          </div>

          {/* Run report (Excel export / Report print) */}
          <button
            type="button"
            onClick={handleExportToExcel}
            title="Run report and export spreadsheet"
            className="min-h-[42px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#18181b] hover:bg-slate-50 dark:hover:bg-[#202020] text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium flex items-center gap-1.5 active:scale-95 transition"
          >
            <IconFileSpreadsheet size={16} stroke={iconStroke} className="text-emerald-600" />
            <span>Run report</span>
          </button>

          {/* New Account / New Sale Button (QuickBooks Signature Green) */}
          <button
            type="button"
            onClick={() => navigate("/dashboard/pos")}
            className="min-h-[42px] px-4 py-2 rounded-lg bg-[#107c41] hover:bg-[#0c6634] text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 active:scale-95 transition shadow-xs"
          >
            <IconPlus size={16} stroke={iconStroke} />
            <span>New sale</span>
            <IconChevronDown size={14} stroke={iconStroke} />
          </button>
        </div>
      </div>

      {/* ── KPI Cards (Streamlined QuickBooks Accounting Metrics) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {t("invoices.kpi_total_invoices", "Total Invoices")}
            </p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
              {kpiStats.totalCount}
            </p>
            {kpiStats.voidCount > 0 && (
              <p className="text-[10px] text-rose-500 font-medium mt-0.5">
                {kpiStats.voidCount} {t("invoices.void_badge", "VOID")}
              </p>
            )}
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
            <IconReceipt size={18} stroke={iconStroke} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {t("invoices.kpi_net_revenue", "Net Revenue")}
            </p>
            <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
              {formatMoney(kpiStats.netRevenue)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <IconCash size={18} stroke={iconStroke} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {t("invoices.kpi_tax_service", "Tax & Service")}
            </p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
              {formatMoney(kpiStats.taxAndService)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <IconReceiptTax size={18} stroke={iconStroke} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {t("invoices.kpi_discounts", "Total Discounts")}
            </p>
            <p className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
              {formatMoney(kpiStats.totalDiscounts)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <IconTag size={18} stroke={iconStroke} />
          </div>
        </div>
      </div>

      {/* ── Selection Action Banner (When rows are checked) ── */}
      {selectedInvoices.size > 0 && (
        <div className="mb-3 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              {selectedInvoices.size} invoice{selectedInvoices.size > 1 ? "s" : ""} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportToExcel}
              className="px-3 py-1.5 rounded-md bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-semibold hover:bg-emerald-100 dark:hover:bg-neutral-700 transition active:scale-95"
            >
              Export Selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedInvoices(new Set())}
              className="px-3 py-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium hover:bg-slate-200/60 dark:hover:bg-neutral-800 transition"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* ── Filter & Action Bar Directly Above Table (QuickBooks Style) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        {/* Left Side: Filter by name or number + Date Filter Select */}
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          {/* Search Input Box */}
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <IconSearch size={16} stroke={iconStroke} />
            </div>
            <input
              ref={searchRef}
              defaultValue={state.search}
              type="text"
              placeholder="Filter by name or number"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  btnSearch();
                }
              }}
              onChange={(e) => {
                setState((p) => ({ ...p, search: e.target.value }));
                setTableSettings((p) => ({ ...p, currentPage: 1 }));
              }}
              className="w-full min-h-[38px] pl-9 pr-8 py-1.5 text-xs sm:text-[13px] rounded-md border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#18181b] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition"
            />
            {state.search && (
              <button
                type="button"
                onClick={btnClearSearch}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <IconX size={14} stroke={iconStroke} />
              </button>
            )}
          </div>

          {/* Quick Filter Dropdown */}
          <div className="relative">
            <select
              value={state.filter}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") {
                  document.getElementById("filter-dialog").showModal();
                  return;
                }
                setState((prev) => ({
                  ...prev,
                  filter: val,
                  search: "",
                  searchResults: [],
                }));
                setTableSettings((p) => ({ ...p, currentPage: 1 }));
              }}
              className="min-h-[38px] px-3 pr-8 py-1.5 text-xs sm:text-[13px] font-normal rounded-md border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#18181b] text-slate-800 dark:text-slate-100 appearance-none focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
            >
              {filters.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.value}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-500">
              <IconChevronDown size={14} stroke={iconStroke} />
            </div>
          </div>
        </div>

        {/* Right Side: Print, Export, Gear, and Pagination */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* Action Icons */}
          <div className="flex items-center gap-1 border-r border-slate-200 dark:border-neutral-700 pr-3">
            {/* Print Table */}
            <button
              type="button"
              onClick={handlePrintTable}
              title="Print table"
              className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition active:scale-95"
            >
              <IconPrinter size={16} stroke={iconStroke} />
            </button>

            {/* Export Excel */}
            <button
              type="button"
              onClick={handleExportToExcel}
              title="Export to Excel"
              className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition active:scale-95"
            >
              <IconDownload size={16} stroke={iconStroke} />
            </button>

            {/* Settings Gear Popover */}
            <div className="relative" ref={settingsBtnRef}>
              <button
                type="button"
                onClick={() =>
                  setTableSettings((p) => ({
                    ...p,
                    showGearMenu: !p.showGearMenu,
                  }))
                }
                title="Table settings"
                className={clsx(
                  "w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition active:scale-95",
                  tableSettings.showGearMenu && "bg-slate-200 dark:bg-neutral-800 text-slate-900"
                )}
              >
                <IconSettings size={16} stroke={iconStroke} />
              </button>

              {tableSettings.showGearMenu && (
                <div className="absolute right-0 top-9 w-60 p-3 bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl border border-slate-200 dark:border-neutral-700 text-xs z-[100] animate-in fade-in duration-100">
                  <div className="font-bold text-slate-900 dark:text-white pb-2 mb-2 border-b border-slate-100 dark:border-neutral-800">
                    Columns
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {[
                      { key: "tokens", label: "Tokens" },
                      { key: "customer", label: "Customer" },
                      { key: "subtotal", label: "Subtotal" },
                      { key: "tax", label: "Tax" },
                      { key: "serviceCharge", label: "Service Charge" },
                      { key: "discount", label: "Discount" },
                      { key: "date", label: "Date & Time" },
                    ].map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      >
                        <input
                          type="checkbox"
                          checked={tableSettings.visibleColumns[col.key]}
                          onChange={(e) =>
                            setTableSettings((p) => ({
                              ...p,
                              visibleColumns: {
                                ...p.visibleColumns,
                                [col.key]: e.target.checked,
                              },
                            }))
                          }
                          className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>{col.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="font-bold text-slate-900 dark:text-white pb-1 mb-2 border-b border-slate-100 dark:border-neutral-800">
                    Display
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300 mb-3">
                    <input
                      type="checkbox"
                      checked={tableSettings.compactDensity}
                      onChange={(e) =>
                        setTableSettings((p) => ({
                          ...p,
                          compactDensity: e.target.checked,
                        }))
                      }
                      className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Compact rows</span>
                  </label>

                  <div className="font-bold text-slate-900 dark:text-white pb-1 mb-1 border-b border-slate-100 dark:border-neutral-800">
                    Rows per page
                  </div>
                  <select
                    value={tableSettings.pageSize}
                    onChange={(e) =>
                      setTableSettings((p) => ({
                        ...p,
                        pageSize: Number(e.target.value),
                        currentPage: 1,
                      }))
                    }
                    className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={70}>70</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Pagination Text: < Previous  1 - 70  Next > */}
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-neutral-400">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() =>
                setTableSettings((p) => ({
                  ...p,
                  currentPage: Math.max(1, p.currentPage - 1),
                }))
              }
              className={clsx(
                "flex items-center gap-0.5 hover:text-slate-900 dark:hover:text-white transition",
                currentPage <= 1 && "opacity-40 cursor-not-allowed hover:text-slate-600"
              )}
            >
              <IconChevronLeft size={14} stroke={iconStroke} />
              <span>Previous</span>
            </button>

            <span className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
              {totalItems > 0 ? `${startIndex + 1} - ${endIndex}` : "0 - 0"}
              <span className="text-slate-400 font-normal"> of {totalItems}</span>
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() =>
                setTableSettings((p) => ({
                  ...p,
                  currentPage: Math.min(totalPages, p.currentPage + 1),
                }))
              }
              className={clsx(
                "flex items-center gap-0.5 hover:text-slate-900 dark:hover:text-white transition",
                currentPage >= totalPages && "opacity-40 cursor-not-allowed hover:text-slate-600"
              )}
            >
              <span>Next</span>
              <IconChevronRight size={14} stroke={iconStroke} />
            </button>
          </div>
        </div>
      </div>

      {/* ── QuickBooks Data Table Container ── */}
      <div className="w-full overflow-x-auto border-t border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b]">
        <table className="w-full text-left border-collapse">
          {/* QuickBooks Header */}
          <thead>
            <tr className="border-b border-slate-200 dark:border-neutral-800 text-[13px] font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-[#18181b]">
              {/* Checkbox column */}
              <th className="w-10 px-3 py-3 text-center">
                <input
                  type="checkbox"
                  checked={isAllCurrentPageSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all rows"
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </th>

              {/* Name (Invoice ID) */}
              <th
                onClick={() => handleSort("invoice_id")}
                className="px-3 py-3 cursor-pointer select-none hover:text-emerald-700 transition"
              >
                <div className="flex items-center gap-1">
                  <span>Name</span>
                  {sorting.field === "invoice_id" && (
                    <span className="text-xs">
                      {sorting.direction === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </div>
              </th>

              {/* Business (if consolidated scope) */}
              {isConsolidated && (
                <th className="px-3 py-3">
                  <span>Business</span>
                </th>
              )}

              {/* Account Type with sort arrow ↑ and BAL badge preview */}
              <th
                onClick={() => handleSort("delivery_type")}
                className="px-3 py-3 cursor-pointer select-none hover:text-emerald-700 transition"
              >
                <div className="flex items-center gap-1">
                  <span>Account type</span>
                  <span className="text-xs">
                    {sorting.field === "delivery_type"
                      ? sorting.direction === "asc"
                        ? "↑"
                        : "↓"
                      : "↑"}
                  </span>
                </div>
              </th>

              {/* Tokens (if toggled) */}
              {visibleColumns.tokens && (
                <th className="px-3 py-3">Tokens</th>
              )}

              {/* Detail type (Customer Name / Walk-in) */}
              {visibleColumns.customer && (
                <th
                  onClick={() => handleSort("name")}
                  className="px-3 py-3 cursor-pointer select-none hover:text-emerald-700 transition"
                >
                  <div className="flex items-center gap-1">
                    <span>Detail type</span>
                    {sorting.field === "name" && (
                      <span className="text-xs">
                        {sorting.direction === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
              )}

              {/* Subtotal (QuickBooks b...) */}
              {visibleColumns.subtotal && (
                <th
                  onClick={() => handleSort("sub_total")}
                  className="px-3 py-3 text-right cursor-pointer select-none hover:text-emerald-700 transition"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>QuickBooks b...</span>
                    {sorting.field === "sub_total" && (
                      <span className="text-xs">
                        {sorting.direction === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
              )}

              {/* Tax (if toggled) */}
              {visibleColumns.tax && (
                <th className="px-3 py-3 text-right">Tax</th>
              )}

              {/* Service Charge (if toggled) */}
              {visibleColumns.serviceCharge && (
                <th className="px-3 py-3 text-right">Service</th>
              )}

              {/* Discount (if toggled) */}
              {visibleColumns.discount && (
                <th className="px-3 py-3 text-right">Discount</th>
              )}

              {/* Bank Balance (Total Amount) */}
              <th
                onClick={() => handleSort("total")}
                className="px-3 py-3 text-right cursor-pointer select-none hover:text-emerald-700 transition"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Bank balance</span>
                  {sorting.field === "total" && (
                    <span className="text-xs">
                      {sorting.direction === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </div>
              </th>

              {/* Date (if toggled) */}
              {visibleColumns.date && (
                <th
                  onClick={() => handleSort("created_at")}
                  className="px-3 py-3 cursor-pointer select-none hover:text-emerald-700 transition"
                >
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    {sorting.field === "created_at" && (
                      <span className="text-xs">
                        {sorting.direction === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
              )}

              {/* Action */}
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>

          {/* QuickBooks Rows */}
          <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80">
            {paginatedInvoices.length === 0 ? (
              <tr>
                <td
                  colSpan={12}
                  className="py-14 text-center text-slate-400 dark:text-neutral-500 text-xs sm:text-sm"
                >
                  {state.search
                    ? t("invoices.no_result_found")
                    : t("invoices.no_invoices")}
                </td>
              </tr>
            ) : (
              paginatedInvoices.map((invoice, index) => {
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
                  delivery_type,
                  customer_id,
                  name,
                  orders,
                  payment_type_id,
                  business,
                  status,
                } = invoice;

                const isVoid = status === "VOID";
                const isSelected = selectedInvoices.has(invoice_id);
                const orderIdsArr = orders?.map((o) => o.order_id) || [];
                const tokenIdsArr =
                  orders?.map((o) => o.token_no).filter(Boolean) || [];
                const tokens = tokenIdsArr.join(", ");
                const deliveryLabel = getDeliveryTypeLabel(delivery_type);

                return (
                  <tr
                    key={invoice_id || index}
                    onClick={() => toggleSelectRow(invoice_id)}
                    className={clsx(
                      "transition-colors cursor-pointer select-none",
                      compactDensity ? "text-xs" : "text-[13px]",
                      isSelected
                        ? "bg-[#e8f4fd] dark:bg-emerald-950/20"
                        : "hover:bg-[#f8f9fa] dark:hover:bg-[#202020]",
                      isVoid && "opacity-70"
                    )}
                  >
                    {/* Checkbox */}
                    <td
                      className={clsx(
                        "w-10 px-3 text-center",
                        compactDensity ? "py-2" : "py-3"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(invoice_id)}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>

                    {/* Name: Invoice ID */}
                    <td
                      className={clsx(
                        "px-3 whitespace-nowrap text-slate-800 dark:text-slate-200 font-medium",
                        compactDensity ? "py-2" : "py-3"
                      )}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          btnViewReceipt(
                            invoice_id,
                            orderIdsArr,
                            tokens,
                            payment_type_id,
                            invoice
                          );
                        }}
                        className="font-bold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition cursor-pointer"
                        title={t("invoices.view_receipt") || "View receipt"}
                      >
                        #{invoice_id}
                      </button>
                      {tokens && !visibleColumns.tokens && (
                        <span className="text-[11px] text-slate-400 font-normal ml-1.5">
                          (Token #{tokens})
                        </span>
                      )}
                    </td>

                    {/* Business (if consolidated) */}
                    {isConsolidated && (
                      <td
                        className={clsx(
                          "px-3 whitespace-nowrap text-slate-600 dark:text-slate-400 text-xs",
                          compactDensity ? "py-2" : "py-3"
                        )}
                      >
                        {business}
                      </td>
                    )}

                    {/* Account Type + QuickBooks BAL Pill Badge */}
                    <td
                      className={clsx(
                        "px-3 whitespace-nowrap",
                        compactDensity ? "py-2" : "py-3"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700 dark:text-slate-300">
                          {deliveryLabel}
                          {table_title ? ` - ${table_title}` : ""}
                        </span>

                        {/* Distinctive QuickBooks Green Pill Badge BAL / PAID / VOID */}
                        {isVoid ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-[#fee2e2] text-[#991b1b] dark:bg-rose-950/60 dark:text-rose-400 border border-[#fecaca] dark:border-rose-800 uppercase">
                            VOID
                          </span>
                        ) : (
                          <span
                            title="Balance settled / Paid"
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-[#dcfce7] text-[#15803d] dark:bg-emerald-950/70 dark:text-emerald-400 border border-[#bbf7d0] dark:border-emerald-800 uppercase"
                          >
                            BAL
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Tokens Column (if toggled) */}
                    {visibleColumns.tokens && (
                      <td
                        className={clsx(
                          "px-3 text-xs text-slate-600 dark:text-slate-400",
                          compactDensity ? "py-2" : "py-3"
                        )}
                      >
                        {tokens ? `#${tokens}` : "-"}
                      </td>
                    )}

                    {/* Detail Type (Customer name or Walk-in) */}
                    {visibleColumns.customer && (
                      <td
                        className={clsx(
                          "px-3 whitespace-nowrap text-slate-700 dark:text-slate-300",
                          compactDensity ? "py-2" : "py-3"
                        )}
                      >
                        {name || customer_id || "Walk-in"}
                      </td>
                    )}

                    {/* Subtotal (QuickBooks b...) */}
                    {visibleColumns.subtotal && (
                      <td
                        className={clsx(
                          "px-3 text-right tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap",
                          compactDensity ? "py-2" : "py-3"
                        )}
                      >
                        {state.currency || ""}
                        {Number(sub_total || 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    )}

                    {/* Tax (if toggled) */}
                    {visibleColumns.tax && (
                      <td
                        className={clsx(
                          "px-3 text-right tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap",
                          compactDensity ? "py-2" : "py-3"
                        )}
                      >
                        {state.currency || ""}
                        {Number(tax_total || 0).toFixed(2)}
                      </td>
                    )}

                    {/* Service Charge (if toggled) */}
                    {visibleColumns.serviceCharge && (
                      <td
                        className={clsx(
                          "px-3 text-right tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap",
                          compactDensity ? "py-2" : "py-3"
                        )}
                      >
                        {state.currency || ""}
                        {Number(service_charge_total || 0).toFixed(2)}
                      </td>
                    )}

                    {/* Discount (if toggled) */}
                    {visibleColumns.discount && (
                      <td
                        className={clsx(
                          "px-3 text-right tabular-nums whitespace-nowrap",
                          compactDensity ? "py-2" : "py-3"
                        )}
                      >
                        {Number(discount_total || 0) > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            -{state.currency || ""}
                            {Number(discount_total || 0).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            {state.currency || ""}0.00
                          </span>
                        )}
                      </td>
                    )}

                    {/* Bank Balance (Total Amount) in bold tabular font */}
                    <td
                      className={clsx(
                        "px-3 text-right font-medium tabular-nums whitespace-nowrap",
                        compactDensity ? "py-2" : "py-3",
                        isVoid
                          ? "line-through text-slate-400"
                          : "text-slate-900 dark:text-slate-100"
                      )}
                    >
                      {state.currency || ""}
                      {Number(total || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    {/* Date (if toggled) */}
                    {visibleColumns.date && (
                      <td
                        className={clsx(
                          "px-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap",
                          compactDensity ? "py-2" : "py-3"
                        )}
                      >
                        {new Intl.DateTimeFormat("en", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(created_at))}
                      </td>
                    )}

                    {/* Action Column: QuickBooks "Account history ∨" style */}
                    <td
                      className={clsx(
                        "px-4 text-right whitespace-nowrap",
                        compactDensity ? "py-2" : "py-3"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
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
                        invoiceSummary={invoice}
                        t={t}
                        iconStroke={iconStroke}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Bottom Pagination Bar ── */}
      <div className="flex items-center justify-between py-3 text-xs text-slate-600 dark:text-neutral-400">
        <div className="text-slate-500">
          Showing {totalItems > 0 ? startIndex + 1 : 0} to {endIndex} of{" "}
          {totalItems} entries
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() =>
              setTableSettings((p) => ({
                ...p,
                currentPage: Math.max(1, p.currentPage - 1),
              }))
            }
            className={clsx(
              "flex items-center gap-1 font-medium hover:text-slate-900 dark:hover:text-white transition",
              currentPage <= 1 && "opacity-40 cursor-not-allowed hover:text-slate-600"
            )}
          >
            <IconChevronLeft size={15} stroke={iconStroke} />
            <span>Previous</span>
          </button>

          <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() =>
              setTableSettings((p) => ({
                ...p,
                currentPage: Math.min(totalPages, p.currentPage + 1),
              }))
            }
            className={clsx(
              "flex items-center gap-1 font-medium hover:text-slate-900 dark:hover:text-white transition",
              currentPage >= totalPages && "opacity-40 cursor-not-allowed hover:text-slate-600"
            )}
          >
            <span>Next</span>
            <IconChevronRight size={15} stroke={iconStroke} />
          </button>
        </div>
      </div>

      {/* ── Filter Modal for Custom Date Range ── */}
      <dialog id="filter-dialog" className="modal">
        <div className="modal-box border border-slate-200 dark:border-[#333333] rounded-2xl bg-white dark:bg-[#1e1e1e]">
          <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">
            <IconFilter stroke={iconStroke} size={20} className="text-emerald-600" />
            <span>{t("invoices.filter")}</span>
          </h3>

          <div className="my-4 space-y-4">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-xs font-semibold mb-1.5">
                {t("invoices.filter")}
              </label>
              <select
                className="text-sm w-full min-h-[42px] rounded-xl px-3.5 py-2 border border-slate-200 dark:border-[#333333] bg-white dark:bg-[#141414] text-slate-800 dark:text-slate-100 focus:outline-emerald-600"
                ref={filterTypeRef}
                defaultValue={state.filter}
              >
                {filters.map((filter, index) => (
                  <option key={index} value={filter.key}>
                    {filter.value}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="fromDate"
                  className="block text-slate-600 dark:text-slate-400 text-xs font-semibold mb-1.5"
                >
                  {t("invoices.from")}
                </label>
                <input
                  defaultValue={defaultDateFrom}
                  type="date"
                  ref={fromDateRef}
                  className="text-sm w-full min-h-[42px] rounded-xl px-3.5 py-2 border border-slate-200 dark:border-[#333333] bg-white dark:bg-[#141414] text-slate-800 dark:text-slate-100 focus:outline-emerald-600"
                />
              </div>
              <div>
                <label
                  htmlFor="toDate"
                  className="block text-slate-600 dark:text-slate-400 text-xs font-semibold mb-1.5"
                >
                  {t("invoices.to")}
                </label>
                <input
                  defaultValue={defaultDateTo}
                  type="date"
                  ref={toDateRef}
                  className="text-sm w-full min-h-[42px] rounded-xl px-3.5 py-2 border border-slate-200 dark:border-[#333333] bg-white dark:bg-[#141414] text-slate-800 dark:text-slate-100 focus:outline-emerald-600"
                />
              </div>
            </div>
          </div>

          <div className="modal-action">
            <form method="dialog" className="flex items-center gap-2">
              <button className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-[#333333] bg-slate-100 dark:bg-[#2a2a2a] hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-semibold transition active:scale-95">
                {t("invoices.close")}
              </button>
              <button
                onClick={() => {
                  setState((prev) => ({
                    ...prev,
                    filter: filterTypeRef.current.value,
                    fromDate: fromDateRef.current.value || null,
                    toDate: toDateRef.current.value || null,
                    search: "",
                    searchResults: [],
                  }));
                  setTableSettings((p) => ({ ...p, currentPage: 1 }));
                }}
                className="min-h-[42px] px-5 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold transition active:scale-95 shadow-sm"
              >
                {t("invoices.apply")}
              </button>
            </form>
          </div>
        </div>
      </dialog>

      <DeleteModal
        isOpen={actionModal.open}
        onClose={closeActionModal}
        onConfirm={confirmActionModal}
        isLoading={actionModal.isLoading}
        requireReason
        reason={actionModal.reason}
        onReasonChange={(reason) =>
          setActionModal((prev) => ({ ...prev, reason }))
        }
        title={t("invoices.void_confirm_title", {
          invoiceId: actionModal.invoice,
        })}
        description={t("invoices.void_confirm_description")}
        reasonPlaceholder={t("invoices.void_reason_placeholder")}
        confirmText={t("invoices.void_invoice")}
      />

      <InvoiceAuditLogModal
        isOpen={auditLogModal.open}
        onClose={closeAuditLogModal}
        invoiceId={auditLogModal.invoice}
      />

      <InvoiceDetailsDrawer
        isOpen={detailsDrawer.isOpen}
        onClose={closeDetailsDrawer}
        invoiceId={detailsDrawer.invoiceId}
        orderIdsArr={detailsDrawer.orderIdsArr}
        tokens={detailsDrawer.tokens}
        paymentTypeId={detailsDrawer.paymentTypeId}
        invoiceSummary={detailsDrawer.invoiceSummary}
        currency={state.currency}
        paymentTypes={state.paymentTypes}
        storeSettings={state.storeSettings}
        printSettings={state.printSettings}
        canVoid={canVoid}
        canViewAuditLog={canViewAuditLog}
        onPrintReceipt={(invId, oIds, toks, ptId) => {
          handleReceiptPrintFlow(invId, oIds, toks, ptId);
        }}
        onOpenVoidModal={(invId) => {
          btnOpenVoidModal(invId);
        }}
        onOpenAuditLogModal={(invId) => {
          btnOpenAuditLogModal(invId);
        }}
      />
    </Page>
  );
}
