import React, { useRef, useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Page from "../components/Page";
import { isAllBusinessesScope } from "../helpers/BusinessScope";
import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsSort,
  IconBan,
  IconCalendar,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconHistory,
  IconPaperBag,
  IconPlus,
  IconPrinter,
  IconReceipt,
  IconReceiptTax,
  IconSearch,
  IconSettings,
  IconTag,
  IconCash,
  IconToolsKitchen2,
  IconTruckDelivery,
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
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { SCOPES, hasFullBusinessAccess } from "../config/scopes";
import DeleteModal from "../components/DeleteModal";
import InvoiceAuditLogModal from "../components/InvoiceAuditLogModal";
import InvoiceDetailsDrawer from "../components/InvoiceDetailsDrawer";
import clsx from "clsx";

const toDateInputValue = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

/* ──────────────────────────────────────────────────────────────────────────
   Row Action Split Button: "View receipt | ∨" + floating menu
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
      const menuHeight = 200;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top =
        spaceBelow < menuHeight ? rect.top - menuHeight : rect.bottom + 4;
      setCoords({
        top,
        left: Math.max(12, rect.right - 208),
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

  const menuItemClass =
    "flex w-full min-h-[42px] items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition active:scale-95 cursor-pointer";

  return (
    <div ref={containerRef} className="relative inline-flex items-center justify-end text-right">
      <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-slate-300 dark:hover:border-zinc-600 transition">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            btnPrintReceipt(invoice_id, orderIdsArr, tokens, payment_type_id);
          }}
          className="inline-flex items-center gap-1.5 min-h-[42px] px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-50 dark:hover:bg-zinc-700/60 rounded-l-lg transition active:scale-95 cursor-pointer"
          title={t("invoices.print_receipt", "Print Receipt")}
        >
          <IconPrinter size={16} stroke={iconStroke} />
          <span className="hidden xl:inline">{t("invoices.print", "Print")}</span>
        </button>

        <button
          type="button"
          onClick={toggleDropdown}
          aria-label={t("invoices.more_actions", "More actions")}
          className="min-h-[42px] min-w-[42px] flex items-center justify-center border-l border-slate-200 dark:border-zinc-700 text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-50 dark:hover:bg-zinc-700/60 rounded-r-lg transition active:scale-95 cursor-pointer"
        >
          <IconChevronDown
            size={16}
            stroke={iconStroke}
            className={clsx("transition-transform duration-150", isOpen && "rotate-180")}
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
          className="w-52 rounded-xl bg-white dark:bg-[#1e1e1e] p-1 shadow-xl border border-slate-200 dark:border-[#333333] text-left text-[13px] animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            onClick={() => {
              setIsOpen(false);
              btnViewReceipt(invoice_id, orderIdsArr, tokens, payment_type_id, invoiceSummary);
            }}
            className={menuItemClass}
          >
            <IconReceipt size={17} stroke={iconStroke} className="text-emerald-600 shrink-0" />
            <span>{t("invoices.view_receipt", "View Receipt")}</span>
          </button>

          <button
            onClick={() => {
              setIsOpen(false);
              btnPrintReceipt(invoice_id, orderIdsArr, tokens, payment_type_id);
            }}
            className={menuItemClass}
          >
            <IconPrinter size={17} stroke={iconStroke} className="text-slate-500 shrink-0" />
            <span>{t("invoices.print_receipt", "Print Receipt")}</span>
          </button>

          {canViewAuditLog && (
            <button
              onClick={() => {
                setIsOpen(false);
                btnOpenAuditLogModal(invoice_id);
              }}
              className={menuItemClass}
            >
              <IconHistory size={17} stroke={iconStroke} className="text-slate-500 shrink-0" />
              <span>{t("auditLogs.audit_log_action_title", "Audit Log")}</span>
            </button>
          )}

          {canVoid && !isVoid && (
            <>
              <div className="my-1 h-px bg-slate-100 dark:bg-neutral-800" />
              <button
                onClick={() => {
                  setIsOpen(false);
                  btnOpenVoidModal(invoice_id);
                }}
                className="flex w-full min-h-[42px] items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition active:scale-95 cursor-pointer"
              >
                <IconBan size={17} stroke={iconStroke} className="shrink-0" />
                <span>{t("invoices.void_invoice", "Void Invoice")}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   KPI Card
   ────────────────────────────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, icon: Icon, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-slate-300",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  };
  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b] flex items-start gap-3 min-w-0">
      <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", tones[tone])}>
        <Icon size={20} stroke={iconStroke} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums truncate">
          {value}
        </p>
        {sub && <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{sub}</div>}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Main Invoices Page
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
    { key: "today", value: t("invoices.today") },
    { key: "yesterday", value: t("invoices.yesterday") },
    { key: "last_7days", value: t("invoices.last_7days") },
    { key: "this_month", value: t("invoices.this_month") },
    { key: "last_month", value: t("invoices.last_month") },
    { key: "all", value: t("invoices.all", "All") },
  ];

  const searchRef = useRef();
  const fromDateRef = useRef();
  const toDateRef = useRef();
  const settingsBtnRef = useRef();

  const today = toDateInputValue(new Date());

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

  // Table options (gear icon settings)
  const [tableSettings, setTableSettings] = useState({
    compactDensity: false,
    pageSize: 25,
    currentPage: 1,
    showGearMenu: false,
    visibleColumns: {
      tokens: false,
      customer: true,
      payment: true,
      subtotal: true,
      tax: false,
      serviceCharge: false,
      discount: false,
      date: true,
    },
  });

  const [sorting, setSorting] = useState({
    field: "created_at",
    direction: "desc", // 'asc' or 'desc'
  });

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

  // Date range + search applied (before status filter) — drives KPIs & status counts
  const baseInvoicesList = useMemo(() => {
    let list =
      state.search && state.searchResults.length > 0
        ? [...state.searchResults]
        : [...(invoices || [])];

    // Client-side text filter if typed
    if (state.search && state.searchResults.length === 0) {
      const q = state.search.toLowerCase().trim();
      list = list.filter((inv) => {
        const invId = String(inv.invoice_id || "").toLowerCase();
        const custName = String(inv.name || inv.customer_id || "").toLowerCase();
        const tokens = inv.orders?.map((o) => String(o.token_no)).join(" ") || "";
        const table = String(inv.table_title || "").toLowerCase();
        return (
          invId.includes(q) ||
          custName.includes(q) ||
          tokens.includes(q) ||
          table.includes(q)
        );
      });
    }

    return list;
  }, [invoices, state.search, state.searchResults]);

  const getPaymentLabel = (paymentTypeId) => {
    if (!paymentTypeId) return null;
    return state.paymentTypes.find((p) => p.id == paymentTypeId)?.title || null;
  };

  // Status filter + sort
  const activeInvoicesList = useMemo(() => {
    let list = [...baseInvoicesList];

    if (state.statusFilter === "PAID") {
      list = list.filter((inv) => inv.status !== "VOID");
    } else if (state.statusFilter === "VOID") {
      list = list.filter((inv) => inv.status === "VOID");
    }

    list.sort((a, b) => {
      const field = sorting.field;
      let valA = a[field];
      let valB = b[field];

      if (field === "created_at") {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else if (field === "total" || field === "sub_total" || field === "invoice_id") {
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
  }, [baseInvoicesList, state.statusFilter, sorting]);

  // KPI Calculations (independent of status tab so revenue never "disappears")
  const kpiStats = useMemo(() => {
    let paidCount = 0;
    let voidCount = 0;
    let netRevenue = 0;
    let taxAndService = 0;
    let totalDiscounts = 0;

    baseInvoicesList.forEach((inv) => {
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
      totalCount: baseInvoicesList.length,
      paidCount,
      voidCount,
      netRevenue,
      taxAndService,
      totalDiscounts,
      avgTicket: paidCount > 0 ? netRevenue / paidCount : 0,
    };
  }, [baseInvoicesList]);

  // Footer totals for the rows currently listed (excluding void)
  const listTotals = useMemo(() => {
    const sum = (key) =>
      activeInvoicesList.reduce(
        (acc, inv) => (inv.status === "VOID" ? acc : acc + (Number(inv[key]) || 0)),
        0
      );
    return {
      sub_total: sum("sub_total"),
      tax_total: sum("tax_total"),
      service_charge_total: sum("service_charge_total"),
      discount_total: sum("discount_total"),
      total: sum("total"),
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

  const getDeliveryType = (type) => {
    const key = String(type || "dinein").toLowerCase();
    if (key === "takeaway" || key === "take-away")
      return { label: t("invoices.takeaway", "Takeaway"), Icon: IconPaperBag };
    if (key === "delivery")
      return { label: t("invoices.delivery", "Delivery"), Icon: IconTruckDelivery };
    if (key === "dinein" || key === "dine-in")
      return { label: t("invoices.dinein", "Dine-In"), Icon: IconToolsKitchen2 };
    return { label: type, Icon: IconReceipt };
  };

  const handleSort = (field) => {
    setSorting((prev) => {
      if (prev.field === field) {
        return {
          field,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { field, direction: field === "created_at" || field === "total" ? "desc" : "asc" };
    });
  };

  const resetPage = () => setTableSettings((p) => ({ ...p, currentPage: 1 }));

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
        toast.error(t("invoices.export_empty", "No invoice records to export"));
        return;
      }

      toast.loading(t("invoices.please_wait"));
      const exportData = targetList.map((inv) => ({
        "Invoice #": `#${inv.invoice_id}`,
        Date: new Date(inv.created_at).toLocaleString(),
        Customer: inv.name || inv.customer_id || "Walk-in",
        "Dining Type": getDeliveryType(inv.delivery_type).label,
        Table: inv.table_title || "-",
        Tokens:
          inv.orders?.map((o) => o.token_no).filter(Boolean).join(", ") || "-",
        Payment: getPaymentLabel(inv.payment_type_id) || "-",
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
      toast.success(t("invoices.export_success", "Invoices exported successfully!"));
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error(t("invoices.export_failed", "Failed to export invoices"));
    }
  };

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
        resetPage();
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
    resetPage();
  };

  const selectDateFilter = (key) => {
    setState((prev) => ({
      ...prev,
      filter: key,
      fromDate: null,
      toDate: null,
      search: "",
      searchResults: [],
    }));
    if (searchRef.current) searchRef.current.value = "";
    resetPage();
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

        const paymentMethodText = getPaymentLabel(payment_type_id) || undefined;

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
          customer_group_id: firstOrder.customer_group_id || null,
          customer_group_name: firstOrder.customer_group_name || null,
          customer_group_discount: Number(firstOrder.customer_group_discount_total || 0),
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

  if (error) {
    return <Page>{t("invoices.error_loading_details")}</Page>;
  }

  const { visibleColumns, compactDensity } = tableSettings;
  const cellPad = compactDensity ? "py-2" : "py-3";

  const statusTabs = [
    { key: "ALL", label: t("invoices.all", "All"), count: kpiStats.totalCount },
    { key: "PAID", label: t("invoices.paid", "Paid"), count: kpiStats.paidCount },
    { key: "VOID", label: t("invoices.void", "Void"), count: kpiStats.voidCount },
  ];

  const customRangeLabel =
    state.filter === "custom" && state.fromDate
      ? `${state.fromDate} → ${state.toDate || state.fromDate}`
      : t("invoices.custom");

  const SortHeader = ({ field, label, align = "left", className }) => {
    const active = sorting.field === field;
    const SortIcon = !active
      ? IconArrowsSort
      : sorting.direction === "asc"
      ? IconArrowUp
      : IconArrowDown;
    return (
      <th
        onClick={() => handleSort(field)}
        aria-sort={active ? (sorting.direction === "asc" ? "ascending" : "descending") : "none"}
        className={clsx(
          "group px-3 py-3 cursor-pointer select-none whitespace-nowrap hover:text-slate-900 dark:hover:text-white transition",
          active && "text-slate-900 dark:text-white",
          align === "right" && "text-right",
          className
        )}
      >
        <span className={clsx("inline-flex items-center gap-1", align === "right" && "flex-row-reverse")}>
          <span>{label}</span>
          <SortIcon
            size={13}
            stroke={iconStroke}
            className={clsx(active ? "text-emerald-600" : "text-slate-300 opacity-0 group-hover:opacity-100")}
          />
        </span>
      </th>
    );
  };

  const iconBtnClass =
    "w-[42px] h-[42px] rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-[#18181b] flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-neutral-800 transition active:scale-95";

  // Columns used for the footer label span
  const leadingColsBeforeAmounts =
    2 + // checkbox + invoice
    (isConsolidated ? 1 : 0) +
    1 + // order type
    (visibleColumns.tokens ? 1 : 0) +
    (visibleColumns.customer ? 1 : 0) +
    (visibleColumns.payment ? 1 : 0);

  return (
    <Page>
      {/* ── Breadcrumbs ── */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400 font-normal mb-1">
        <span>{t("invoices.breadcrumb_accounting", "Accounting")}</span>
        <span className="text-slate-300 dark:text-neutral-600">/</span>
        <span className="text-slate-700 dark:text-neutral-300 font-medium">
          {t("invoices.title", "Invoices")}
        </span>
      </div>

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-5">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-[28px] font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
            {t("invoices.title", "Invoices")}
          </h1>
          <p className="text-[13px] text-slate-500 dark:text-neutral-400 mt-1">
            {t("invoices.subtitle", "Review completed transactions, print receipts, and audit billing records")}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleExportToExcel}
            className="min-h-[42px] px-4 rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#18181b] hover:bg-slate-50 dark:hover:bg-[#202020] text-slate-700 dark:text-slate-200 text-sm font-medium flex items-center gap-2 active:scale-95 transition"
          >
            <IconDownload size={17} stroke={iconStroke} className="text-emerald-600" />
            <span>{t("invoices.export", "Export")}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/dashboard/pos")}
            className="min-h-[42px] px-4 rounded-lg bg-[#107c41] hover:bg-[#0c6634] text-white text-sm font-semibold flex items-center gap-2 active:scale-95 transition"
          >
            <IconPlus size={17} stroke={iconStroke} />
            <span>{t("invoices.new_sale", "New sale")}</span>
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard
          label={t("invoices.kpi_net_revenue", "Net Revenue")}
          value={<span className="text-emerald-600 dark:text-emerald-400">{formatMoney(kpiStats.netRevenue)}</span>}
          sub={
            <>
              {t("invoices.kpi_invoice_count", "{{count}} invoices", { count: kpiStats.paidCount })}
              {kpiStats.voidCount > 0 && (
                <span className="text-rose-500 font-medium">
                  {" · "}
                  {t("invoices.kpi_void_count", "{{count}} void", { count: kpiStats.voidCount })}
                </span>
              )}
            </>
          }
          icon={IconCash}
          tone="emerald"
        />
        <KpiCard
          label={t("invoices.kpi_avg_ticket", "Avg. Ticket")}
          value={formatMoney(kpiStats.avgTicket)}
          sub={t("invoices.kpi_avg_ticket_sub", "Per paid invoice")}
          icon={IconReceipt}
          tone="slate"
        />
        <KpiCard
          label={t("invoices.kpi_tax_service", "Tax & Service")}
          value={formatMoney(kpiStats.taxAndService)}
          icon={IconReceiptTax}
          tone="blue"
        />
        <KpiCard
          label={t("invoices.kpi_discounts", "Total Discounts")}
          value={
            <span className={kpiStats.totalDiscounts > 0 ? "text-amber-600 dark:text-amber-400" : undefined}>
              {formatMoney(kpiStats.totalDiscounts)}
            </span>
          }
          icon={IconTag}
          tone="amber"
        />
      </div>

      {/* ── Date Range Chips ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-3 -mx-1 px-1 [scrollbar-width:none]">
        {filters.map((f) => {
          const active = state.filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => selectDateFilter(f.key)}
              className={clsx(
                "shrink-0 min-h-[42px] px-4 rounded-full text-[13px] font-medium border transition active:scale-95 whitespace-nowrap",
                active
                  ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900"
                  : "bg-white dark:bg-[#18181b] border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              {f.value}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => document.getElementById("filter-dialog").showModal()}
          className={clsx(
            "shrink-0 min-h-[42px] px-4 rounded-full text-[13px] font-medium border transition active:scale-95 whitespace-nowrap inline-flex items-center gap-1.5",
            state.filter === "custom"
              ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900"
              : "bg-white dark:bg-[#18181b] border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <IconCalendar size={15} stroke={iconStroke} />
          <span className="tabular-nums">{customRangeLabel}</span>
        </button>
      </div>

      {/* ── Search, Status Tabs & Table Tools ── */}
      <div className="flex flex-col md:flex-row md:items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-0 md:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <IconSearch size={17} stroke={iconStroke} />
          </div>
          <input
            ref={searchRef}
            defaultValue={state.search}
            type="search"
            placeholder={t("invoices.filter_placeholder", "Search invoice #, customer, token or table")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                btnSearch();
              }
            }}
            onChange={(e) => {
              setState((p) => ({ ...p, search: e.target.value, searchResults: [] }));
              resetPage();
            }}
            className="w-full min-h-[42px] pl-10 pr-10 py-2 text-[13px] rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#18181b] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/40 focus:border-emerald-600 transition [&::-webkit-search-cancel-button]:hidden"
          />
          {state.search && (
            <button
              type="button"
              onClick={btnClearSearch}
              aria-label={t("invoices.clear_search", "Clear")}
              className="absolute inset-y-0 right-0 w-[42px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <IconX size={16} stroke={iconStroke} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 md:ml-auto">
          {/* Status segmented control */}
          <div className="inline-flex p-1 rounded-lg bg-slate-100 dark:bg-neutral-800/80">
            {statusTabs.map((tab) => {
              const active = state.statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setState((p) => ({ ...p, statusFilter: tab.key }));
                    resetPage();
                  }}
                  className={clsx(
                    "min-h-[34px] px-3 rounded-md text-[13px] font-medium inline-flex items-center gap-1.5 transition active:scale-95",
                    active
                      ? "bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={clsx(
                      "min-w-[20px] px-1.5 rounded-full text-[11px] font-semibold tabular-nums",
                      active
                        ? tab.key === "VOID"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                        : "bg-slate-200/70 text-slate-500 dark:bg-neutral-700 dark:text-slate-400"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handlePrintTable}
            title={t("invoices.print_list", "Print list")}
            aria-label={t("invoices.print_list", "Print list")}
            className={iconBtnClass}
          >
            <IconPrinter size={18} stroke={iconStroke} />
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
              title={t("invoices.table_settings", "Table settings")}
              aria-label={t("invoices.table_settings", "Table settings")}
              className={clsx(
                iconBtnClass,
                tableSettings.showGearMenu && "bg-slate-100 dark:bg-neutral-800 text-slate-900 dark:text-white"
              )}
            >
              <IconSettings size={18} stroke={iconStroke} />
            </button>

            {tableSettings.showGearMenu && (
              <div className="absolute right-0 top-12 w-64 p-3 bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl border border-slate-200 dark:border-neutral-700 text-[13px] z-[100] animate-in fade-in duration-100">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                  {t("invoices.columns", "Columns")}
                </div>
                <div className="mb-3">
                  {[
                    { key: "tokens", label: t("invoices.tokens", "Tokens") },
                    { key: "customer", label: t("invoices.customer", "Customer") },
                    { key: "payment", label: t("invoices.payment", "Payment") },
                    { key: "subtotal", label: t("invoices.subtotal", "Subtotal") },
                    { key: "tax", label: t("invoices.tax", "Tax") },
                    { key: "serviceCharge", label: t("invoices.service_charge", "Service Charge") },
                    { key: "discount", label: t("invoices.discount", "Discount") },
                    { key: "date", label: t("invoices.date", "Date") },
                  ].map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2.5 min-h-[38px] px-1 rounded-md cursor-pointer select-none text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800"
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
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>

                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 pt-2 border-t border-slate-100 dark:border-neutral-800">
                  {t("invoices.display", "Display")}
                </div>
                <label className="flex items-center gap-2.5 min-h-[38px] px-1 rounded-md cursor-pointer select-none text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 mb-2">
                  <input
                    type="checkbox"
                    checked={tableSettings.compactDensity}
                    onChange={(e) =>
                      setTableSettings((p) => ({
                        ...p,
                        compactDensity: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{t("invoices.compact_rows", "Compact rows")}</span>
                </label>

                <label className="flex items-center justify-between gap-2 px-1 text-slate-700 dark:text-slate-300">
                  <span>{t("invoices.rows_per_page", "Rows per page")}</span>
                  <select
                    value={tableSettings.pageSize}
                    onChange={(e) =>
                      setTableSettings((p) => ({
                        ...p,
                        pageSize: Number(e.target.value),
                        currentPage: 1,
                      }))
                    }
                    className="min-h-[38px] px-2 rounded-md border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-800 dark:text-slate-200"
                  >
                    {[10, 25, 50, 100].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Selection Action Banner ── */}
      {selectedInvoices.size > 0 && (
        <div className="mb-3 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2 text-[13px]">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>{t("invoices.selected_count", "{{count}} selected", { count: selectedInvoices.size })}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportToExcel}
              className="min-h-[42px] px-3.5 rounded-lg bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-semibold hover:bg-emerald-100 dark:hover:bg-neutral-700 transition active:scale-95 inline-flex items-center gap-1.5"
            >
              <IconDownload size={16} stroke={iconStroke} />
              {t("invoices.export_selected", "Export selected")}
            </button>
            <button
              type="button"
              onClick={() => setSelectedInvoices(new Set())}
              className="min-h-[42px] px-3.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium hover:bg-emerald-100/60 dark:hover:bg-neutral-800 transition active:scale-95"
            >
              {t("invoices.clear_selection", "Clear selection")}
            </button>
          </div>
        </div>
      )}

      {/* ── Data Table ── */}
      <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-neutral-800 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-[#1c1c1f]">
              <th className="w-12 px-3 py-3 text-center">
                <input
                  type="checkbox"
                  checked={isAllCurrentPageSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all rows"
                  className="w-[18px] h-[18px] rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </th>

              <SortHeader field="invoice_id" label={t("invoices.invoice_id", "Invoice ID")} />

              {isConsolidated && (
                <th className="px-3 py-3 whitespace-nowrap">{t("invoices.business", "Business")}</th>
              )}

              <SortHeader field="delivery_type" label={t("invoices.delivery_type", "Order Type")} />

              {visibleColumns.tokens && (
                <th className="px-3 py-3 whitespace-nowrap">{t("invoices.tokens", "Tokens")}</th>
              )}

              {visibleColumns.customer && (
                <SortHeader field="name" label={t("invoices.customer", "Customer")} />
              )}

              {visibleColumns.payment && (
                <th className="px-3 py-3 whitespace-nowrap">{t("invoices.payment", "Payment")}</th>
              )}

              {visibleColumns.subtotal && (
                <SortHeader field="sub_total" label={t("invoices.subtotal", "Subtotal")} align="right" />
              )}

              {visibleColumns.tax && (
                <th className="px-3 py-3 text-right whitespace-nowrap">{t("invoices.tax", "Tax")}</th>
              )}

              {visibleColumns.serviceCharge && (
                <th className="px-3 py-3 text-right whitespace-nowrap">{t("invoices.service_charge", "Service Charge")}</th>
              )}

              {visibleColumns.discount && (
                <th className="px-3 py-3 text-right whitespace-nowrap">{t("invoices.discount", "Discount")}</th>
              )}

              <SortHeader field="total" label={t("invoices.total", "Total")} align="right" />

              <th className="px-3 py-3 whitespace-nowrap">{t("invoices.status", "Status")}</th>

              {visibleColumns.date && (
                <SortHeader field="created_at" label={t("invoices.date", "Date")} />
              )}

              <th className="px-4 py-3 text-right whitespace-nowrap">{t("invoices.action", "Action")}</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td colSpan={20} className="px-4 py-4">
                    <div className="h-5 rounded-md bg-slate-100 dark:bg-neutral-800 animate-pulse" style={{ width: `${90 - i * 6}%` }} />
                  </td>
                </tr>
              ))
            ) : paginatedInvoices.length === 0 ? (
              <tr>
                <td colSpan={20} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-neutral-800 flex items-center justify-center text-slate-400">
                      <IconReceipt size={24} stroke={iconStroke} />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {state.search ? t("invoices.no_result_found") : t("invoices.no_invoices")}
                    </p>
                    <p className="text-xs text-slate-400 max-w-xs">
                      {t("invoices.no_invoices_subtitle")}
                    </p>
                  </div>
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
                const { label: deliveryLabel, Icon: DeliveryIcon } = getDeliveryType(delivery_type);
                const paymentLabel = getPaymentLabel(payment_type_id);
                const createdAt = new Date(created_at);

                return (
                  <tr
                    key={invoice_id || index}
                    onClick={() =>
                      btnViewReceipt(invoice_id, orderIdsArr, tokens, payment_type_id, invoice)
                    }
                    className={clsx(
                      "transition-colors cursor-pointer",
                      compactDensity ? "text-xs" : "text-[13px]",
                      isSelected
                        ? "bg-emerald-50/70 dark:bg-emerald-950/20"
                        : "hover:bg-slate-50 dark:hover:bg-[#202020]",
                      isVoid && "bg-rose-50/30 dark:bg-rose-950/10"
                    )}
                  >
                    {/* Checkbox (whole cell is the touch target) */}
                    <td
                      className={clsx("w-12 px-3 text-center", cellPad)}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectRow(invoice_id);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        aria-label={`Select invoice ${invoice_id}`}
                        className="w-[18px] h-[18px] rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer pointer-events-none"
                      />
                    </td>

                    {/* Invoice ID + token */}
                    <td className={clsx("px-3 whitespace-nowrap", cellPad)}>
                      <div className={clsx("font-bold tabular-nums", isVoid ? "text-slate-400" : "text-slate-900 dark:text-white")}>
                        #{invoice_id}
                      </div>
                      {tokens && !visibleColumns.tokens && (
                        <div className="text-[11px] text-slate-400 tabular-nums">
                          {t("invoices.token_short", "Token")} #{tokens}
                        </div>
                      )}
                    </td>

                    {isConsolidated && (
                      <td className={clsx("px-3 whitespace-nowrap text-slate-600 dark:text-slate-400 text-xs", cellPad)}>
                        {business}
                      </td>
                    )}

                    {/* Order type + table */}
                    <td className={clsx("px-3 whitespace-nowrap", cellPad)}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                          <DeliveryIcon size={16} stroke={iconStroke} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-slate-800 dark:text-slate-200 font-medium">
                            {table_title || deliveryLabel}
                          </div>
                          {table_title && (
                            <div className="text-[11px] text-slate-400">{deliveryLabel}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {visibleColumns.tokens && (
                      <td className={clsx("px-3 text-xs text-slate-600 dark:text-slate-400 tabular-nums", cellPad)}>
                        {tokens ? `#${tokens}` : "—"}
                      </td>
                    )}

                    {visibleColumns.customer && (
                      <td className={clsx("px-3 whitespace-nowrap", cellPad)}>
                        {name || customer_id ? (
                          <span className="text-slate-800 dark:text-slate-200 font-medium">{name || customer_id}</span>
                        ) : (
                          <span className="text-slate-400">{t("invoices.walkin", "Walk-in")}</span>
                        )}
                      </td>
                    )}

                    {visibleColumns.payment && (
                      <td className={clsx("px-3 whitespace-nowrap text-slate-600 dark:text-slate-300", cellPad)}>
                        {paymentLabel || <span className="text-slate-300 dark:text-neutral-600">—</span>}
                      </td>
                    )}

                    {visibleColumns.subtotal && (
                      <td className={clsx("px-3 text-right tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap", cellPad)}>
                        {formatMoney(sub_total)}
                      </td>
                    )}

                    {visibleColumns.tax && (
                      <td className={clsx("px-3 text-right tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap", cellPad)}>
                        {formatMoney(tax_total)}
                      </td>
                    )}

                    {visibleColumns.serviceCharge && (
                      <td className={clsx("px-3 text-right tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap", cellPad)}>
                        {formatMoney(service_charge_total)}
                      </td>
                    )}

                    {visibleColumns.discount && (
                      <td className={clsx("px-3 text-right tabular-nums whitespace-nowrap", cellPad)}>
                        {Number(discount_total || 0) > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            -{formatMoney(discount_total)}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-neutral-600">—</span>
                        )}
                      </td>
                    )}

                    <td
                      className={clsx(
                        "px-3 text-right font-semibold tabular-nums whitespace-nowrap",
                        cellPad,
                        isVoid ? "line-through text-slate-400" : "text-slate-900 dark:text-slate-100"
                      )}
                    >
                      {formatMoney(total)}
                    </td>

                    {/* Status */}
                    <td className={clsx("px-3 whitespace-nowrap", cellPad)}>
                      {isVoid ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 ring-1 ring-inset ring-rose-200/70 dark:ring-rose-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          {t("invoices.void_badge", "VOID")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 ring-1 ring-inset ring-emerald-200/70 dark:ring-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {t("invoices.paid_badge", "PAID")}
                        </span>
                      )}
                    </td>

                    {visibleColumns.date && (
                      <td className={clsx("px-3 whitespace-nowrap", cellPad)}>
                        <div className="text-slate-700 dark:text-slate-300 tabular-nums">
                          {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(createdAt)}
                        </div>
                        <div className="text-[11px] text-slate-400 tabular-nums">
                          {new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(createdAt)}
                        </div>
                      </td>
                    )}

                    <td
                      className={clsx("px-4 text-right whitespace-nowrap", compactDensity ? "py-1" : "py-2")}
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

          {/* Totals footer (excludes void invoices) */}
          {!isLoading && totalItems > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-neutral-700 bg-slate-50/80 dark:bg-[#1c1c1f] text-[13px] font-semibold text-slate-900 dark:text-white">
                <td colSpan={leadingColsBeforeAmounts} className="px-3 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t("invoices.totals_row", "Total ({{count}})", {
                    count: activeInvoicesList.filter((i) => i.status !== "VOID").length,
                  })}
                </td>
                {visibleColumns.subtotal && (
                  <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap text-slate-600 dark:text-slate-300">
                    {formatMoney(listTotals.sub_total)}
                  </td>
                )}
                {visibleColumns.tax && (
                  <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap text-slate-600 dark:text-slate-300">
                    {formatMoney(listTotals.tax_total)}
                  </td>
                )}
                {visibleColumns.serviceCharge && (
                  <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap text-slate-600 dark:text-slate-300">
                    {formatMoney(listTotals.service_charge_total)}
                  </td>
                )}
                {visibleColumns.discount && (
                  <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap text-amber-600 dark:text-amber-400">
                    {listTotals.discount_total > 0 ? `-${formatMoney(listTotals.discount_total)}` : "—"}
                  </td>
                )}
                <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                  {formatMoney(listTotals.total)}
                </td>
                <td colSpan={visibleColumns.date ? 3 : 2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Pagination ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 py-3 text-[13px] text-slate-500 dark:text-neutral-400">
        <div className="tabular-nums">
          {t("invoices.showing_range", "Showing {{from}}–{{to}} of {{total}}", {
            from: totalItems > 0 ? startIndex + 1 : 0,
            to: endIndex,
            total: totalItems,
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() =>
                setTableSettings((p) => ({
                  ...p,
                  currentPage: Math.max(1, currentPage - 1),
                }))
              }
              aria-label={t("invoices.previous", "Previous")}
              className={clsx(iconBtnClass, currentPage <= 1 && "opacity-40 cursor-not-allowed active:scale-100")}
            >
              <IconChevronLeft size={18} stroke={iconStroke} />
            </button>

            <span className="px-2 font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
              {t("invoices.page_of", "Page {{page}} of {{pages}}", { page: currentPage, pages: totalPages })}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() =>
                setTableSettings((p) => ({
                  ...p,
                  currentPage: Math.min(totalPages, currentPage + 1),
                }))
              }
              aria-label={t("invoices.next", "Next")}
              className={clsx(iconBtnClass, currentPage >= totalPages && "opacity-40 cursor-not-allowed active:scale-100")}
            >
              <IconChevronRight size={18} stroke={iconStroke} />
            </button>
          </div>
        )}
      </div>

      {/* ── Custom Date Range Modal ── */}
      <dialog id="filter-dialog" className="modal">
        <div className="modal-box border border-slate-200 dark:border-[#333333] rounded-2xl bg-white dark:bg-[#1e1e1e]">
          <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">
            <IconCalendar stroke={iconStroke} size={20} className="text-emerald-600" />
            <span>{t("invoices.custom")}</span>
          </h3>

          <div className="my-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="fromDate"
                className="block text-slate-600 dark:text-slate-400 text-xs font-semibold mb-1.5"
              >
                {t("invoices.from")}
              </label>
              <input
                id="fromDate"
                defaultValue={state.fromDate || today}
                max={today}
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
                id="toDate"
                defaultValue={state.toDate || today}
                max={today}
                type="date"
                ref={toDateRef}
                className="text-sm w-full min-h-[42px] rounded-xl px-3.5 py-2 border border-slate-200 dark:border-[#333333] bg-white dark:bg-[#141414] text-slate-800 dark:text-slate-100 focus:outline-emerald-600"
              />
            </div>
          </div>

          <div className="modal-action">
            <form method="dialog" className="flex items-center gap-2">
              <button className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-[#333333] bg-slate-100 dark:bg-[#2a2a2a] hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-sm font-semibold transition active:scale-95">
                {t("invoices.close")}
              </button>
              <button
                onClick={() => {
                  let from = fromDateRef.current.value || null;
                  let to = toDateRef.current.value || from;
                  if (from && to && from > to) [from, to] = [to, from];
                  setState((prev) => ({
                    ...prev,
                    filter: "custom",
                    fromDate: from,
                    toDate: to,
                    search: "",
                    searchResults: [],
                  }));
                  if (searchRef.current) searchRef.current.value = "";
                  resetPage();
                }}
                className="min-h-[42px] px-5 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold transition active:scale-95"
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
