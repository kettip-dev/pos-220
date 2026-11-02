import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Page from "../components/Page";
import {
  IconArrowLeft,
  IconReceipt,
  IconCalendarEvent,
  IconCurrencyDollar,
  IconUser,
  IconEye,
  IconPrinter,
  IconDotsVertical,
  IconSearch,
  IconX,
  IconAward,
  IconHistory,
  IconCheck
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { useCustomer, useCustomerInsights, useCustomerInvoices } from "../controllers/customers.controller";
import { useCustomerLoyalty, useCustomerLoyaltyHistory, adjustCustomerPoints } from "../controllers/loyalty.controller";
import { getInvoiceOrders, getInvoicesInit } from "../controllers/invoices.controller";
import { triggerPrintReceipt } from '../helpers/ReceiptHelper';
import { getImageURL } from '../helpers/ImageHelper';
import { CURRENCIES } from "../config/currencies.config";
import Chart from "react-apexcharts";
import { toast } from "react-hot-toast";
import { clsx } from "clsx";
import { useTheme } from "../contexts/ThemeContext";
import { Menu, Transition } from "@headlessui/react";

export default function CustomerInsightsPage() {
  const { phone } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState("bills"); // 'bills' | 'loyalty'

  const [state, setState] = useState({
    page: 1,
    limit: 10,
    search: "",
    printSettings: null,
    storeSettings: null,
    currency: null,
    paymentTypes: [],
  });

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustPointsValue, setAdjustPointsValue] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const res = await getInvoicesInit();
        if (res.status === 200) {
          const ordersInit = res.data;
          const currency = CURRENCIES.find((c) => c.cc === ordersInit?.storeSettings?.currency);
          setState((prev) => ({
            ...prev,
            printSettings: ordersInit.printSettings || {},
            storeSettings: ordersInit.storeSettings || {},
            paymentTypes: ordersInit?.paymentTypes || [],
            currency: currency?.symbol || "$",
          }));
        }
      } catch (error) {
        console.error(error);
      }
    }
    init();
  }, []);

  const { data: customer, isLoading: isLoadingCustomer } = useCustomer(phone);
  const { data: insights, isLoading: isLoadingInsights } = useCustomerInsights(phone);
  const { data: invoicesData, isLoading: isLoadingInvoices } = useCustomerInvoices(phone, state.page, state.limit);
  const { loyalty, mutate: mutateLoyalty } = useCustomerLoyalty(phone);
  const { transactions: loyaltyTransactions, mutate: mutateHistory } = useCustomerLoyaltyHistory(phone, { page: 1, limit: 50 });

  if (isLoadingCustomer || isLoadingInsights || isLoadingInvoices) {
    return (
      <Page>
        <div className="flex items-center justify-center min-h-[300px]">
          <span className="loading loading-spinner loading-md text-amber-500"></span>
        </div>
      </Page>
    );
  }

  if (!customer) {
    return (
      <Page>
        <div className="p-8 text-center">
          <p className="text-slate-500">Customer not found</p>
          <button
            onClick={() => navigate("/dashboard/customers")}
            className="mt-4 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold"
          >
            Back to Customers
          </button>
        </div>
      </Page>
    );
  }

  const { totalSpend, visits, thisMonthSpend, avgBill, visitedDays, topBuys } = insights || {};
  const { invoices, totalPages, page } = invoicesData || {};

  const allDaysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const sortedVisitedDays = allDaysOfWeek.map((dayName) => {
    const existingDay = visitedDays?.find((d) => d.day_name === dayName);
    return {
      day_name: dayName,
      visits: existingDay ? existingDay.visits : 0,
    };
  });

  const chartOptions = {
    chart: {
      type: "area",
      toolbar: { show: false },
      fontFamily: "Inter, sans-serif",
      zoom: { enabled: false },
      sparkline: { enabled: false },
      background: "transparent",
      dropShadow: {
        enabled: true,
        color: '#10b981',
        top: 4,
        left: 0,
        blur: 6,
        opacity: 0.12,
      },
    },
    colors: ["#10b981"],
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.35,
        opacityTo: 0.02,
        stops: [0, 95, 100],
      },
    },
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 2.5 },
    markers: {
      size: 3.5,
      colors: ["#fff"],
      strokeColors: "#10b981",
      strokeWidth: 2,
      hover: { size: 5 },
    },
    xaxis: {
      categories: sortedVisitedDays.map((d) => d.day_name.substring(0, 3)),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          colors: "#94a3b8",
          fontSize: "11px",
          fontWeight: 500,
        },
      },
    },
    yaxis: {
      show: false,
      min: 0,
      max: Math.max(1, ...sortedVisitedDays.map((d) => d.visits)) * 1.15,
    },
    grid: {
      show: false,
      padding: { left: 8, right: 8, top: 0, bottom: 0 },
    },
    theme: { mode: theme === "black" ? "dark" : "light" },
    tooltip: {
      custom: function ({ series, seriesIndex, dataPointIndex, w }) {
        const visitsCount = series[seriesIndex][dataPointIndex];
        const dayName = w.globals.labels[dataPointIndex];
        return (
          '<div class="px-2.5 py-1.5 rounded-lg shadow-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono">' +
            '<span class="font-bold text-slate-800 dark:text-slate-200">' + dayName + ': </span>' +
            '<span class="text-emerald-600 font-bold">' + visitsCount + ' visit(s)</span>' +
          '</div>'
        );
      },
    },
  };

  const chartSeries = [
    {
      name: "Visits",
      data: sortedVisitedDays.map((d) => d.visits),
    },
  ];

  const btnPaginationNextPage = () => {
    if (page === totalPages) return;
    setState({ ...state, page: state.page + 1 });
  };
  const btnPaginationPreviousPage = () => {
    if (page === 1) return;
    setState({ ...state, page: state.page - 1 });
  };

  const handleViewReceipt = async (invoice) => {
    try {
      toast.loading(t("invoices.please_wait") || "Please wait...");
      const res = await getInvoiceOrders(invoice.invoice_no, [invoice.order_id]);
      toast.dismiss();

      if (res.status === 200) {
        const { subtotal, taxTotal, serviceChargeTotal, discountType, discountValue, discountTotal, total, orders: ordersArr } = res.data;
        const orders = [];
        for (const o of ordersArr) {
          o.items.forEach((i) => {
            const variant = i.variant_id ? { id: i.variant_id, title: i.variant_title, price: i.variant_price } : null;
            orders.push({ ...i, title: i.item_title, addons_ids: i?.addons?.length > 0 ? i?.addons?.map((a) => a.id) : [], variant: variant });
          });
        }
        const { customer_id, customer_type, customer_name, delivery_type } = ordersArr;

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
          discountType,
          discountValue,
          discountAmount: discountTotal || 0,
          taxTotal: taxTotal,
          serviceChargeTotal: serviceChargeTotal,
          payableTotal: total,
          tokenNo: invoice.token_no,
          orderId: invoice.order_id,
          paymentMethod: invoice.payment_type,
        });
      }
    } catch (error) {
      toast.dismiss();
      toast.error(error?.response?.data?.message || t("invoices.error_processing_request") || "Error viewing receipt");
    }
  };

  const handlePrintReceipt = async (invoice) => {
    try {
      toast.loading(t("invoices.please_wait") || "Please wait...");
      const res = await getInvoiceOrders(invoice.invoice_no, [invoice.order_id]);
      toast.dismiss();

      if (res.status === 200) {
        const { subtotal, taxTotal, serviceChargeTotal, discountType, discountValue, discountTotal, total, orders: ordersArr } = res.data;
        const orders = [];
        for (const o of ordersArr) {
          o.items.forEach((i) => {
            const variant = i.variant_id ? { id: i.variant_id, title: i.variant_title, price: i.variant_price } : null;
            orders.push({ ...i, title: i.item_title, addons_ids: i?.addons?.length > 0 ? i?.addons?.map((a) => a.id) : [], variant: variant });
          });
        }
        const { customer_id, customer_type, customer_name, delivery_type } = ordersArr;

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
          discountType,
          discountValue,
          discountAmount: discountTotal || 0,
          taxTotal: taxTotal,
          serviceChargeTotal: serviceChargeTotal,
          payableTotal: total,
          tokenNo: invoice.token_no,
          orderId: invoice.order_id,
          paymentMethod: invoice.payment_type,
        });
      }
    } catch (error) {
      toast.dismiss();
      toast.error(error?.response?.data?.message || t("invoices.error_processing_request") || "Error printing receipt");
    }
  };

  const currentTier = loyalty?.membership_tier || customer?.membership_tier || "Standard";
  const pointsBalance = loyalty?.points_balance ?? customer?.points_balance ?? 0;
  const lifetimePoints = loyalty?.lifetime_points_earned ?? customer?.lifetime_points_earned ?? 0;

  return (
    <Page>
      <div className="flex flex-col gap-4 w-full pb-8 max-w-7xl mx-auto">
        {/* Sleek Compact Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard/customers")}
              className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 shadow-2xs cursor-pointer"
              title="Back to Customers"
            >
              <IconArrowLeft stroke={iconStroke} size={18} />
            </button>
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold flex items-center justify-center font-mono text-sm border border-amber-500/20 shadow-2xs">
              {customer.name?.substring(0, 2).toUpperCase() || "CU"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight">
                  {customer.name}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                  {currentTier}
                </span>
                {customer?.customer_group_name && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-xs"
                    style={{ backgroundColor: customer.customer_group_color || '#6366F1' }}
                  >
                    👥 {customer.customer_group_name}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{customer.phone}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAdjustModalOpen(true)}
            className="min-h-[42px] px-3.5 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-2xs cursor-pointer"
          >
            <IconAward size={16} className="text-amber-500" />
            <span>Adjust Points</span>
          </button>
        </div>

        {/* 5 Compact Unified Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 1. Loyalty Points Card */}
          <div className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <IconAward size={15} className="text-amber-500" />
                Loyalty Points
              </span>
              <span className="text-[9px] font-extrabold uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20">
                {currentTier}
              </span>
            </div>
            <div className="mt-2">
              <h2 className="text-2xl font-black text-amber-900 dark:text-amber-200 font-mono leading-none">
                {pointsBalance}
              </h2>
              <p className="text-[11px] text-amber-700/70 dark:text-amber-400/70 font-mono mt-1">
                Lifetime: {lifetimePoints} pts
              </p>
            </div>
          </div>

          {/* 2. Total Spend */}
          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-semibold">
              <IconCurrencyDollar size={15} className="text-emerald-500" />
              <span>Total Spend</span>
            </div>
            <div className="mt-2">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-mono leading-none">
                {Number(totalSpend || 0).toFixed(2)}
              </h2>
              <p className="text-[11px] text-slate-400 font-mono mt-1">
                {state.currency || "$"} total revenue
              </p>
            </div>
          </div>

          {/* 3. This Month */}
          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-semibold">
              <IconCalendarEvent size={15} className="text-sky-500" />
              <span>This Month</span>
            </div>
            <div className="mt-2">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-mono leading-none">
                {Number(thisMonthSpend || 0).toFixed(2)}
              </h2>
              <p className="text-[11px] text-slate-400 font-mono mt-1">Current period</p>
            </div>
          </div>

          {/* 4. Avg Bill */}
          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-semibold">
              <IconReceipt size={15} className="text-violet-500" />
              <span>Avg Bill</span>
            </div>
            <div className="mt-2">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-mono leading-none">
                {Number(avgBill || 0).toFixed(2)}
              </h2>
              <p className="text-[11px] text-slate-400 font-mono mt-1">Per transaction</p>
            </div>
          </div>

          {/* 5. Visits */}
          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-semibold">
              <IconUser size={15} className="text-indigo-500" />
              <span>Visits</span>
            </div>
            <div className="mt-2">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-mono leading-none">
                {visits || 0}
              </h2>
              <p className="text-[11px] text-slate-400 font-mono mt-1">Completed orders</p>
            </div>
          </div>
        </div>

        {/* Compact Analytics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Top Buys */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-2xs flex flex-col max-h-[220px]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Top Buys</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">
                {topBuys?.length || 0} unique items
              </span>
            </div>
            <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
              {topBuys?.length > 0 ? (
                topBuys.map((buy, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center py-1.5 border-b last:border-0 border-slate-100 dark:border-slate-800/60"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
                        {buy.image ? (
                          <img src={getImageURL(buy.image)} alt={buy.title} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold">{idx + 1}</span>
                        )}
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block truncate">
                          {buy.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {buy.total_quantity} orders
                        </span>
                      </div>
                    </div>
                    <span className="font-bold text-xs text-slate-900 dark:text-white font-mono ml-2">
                      {state.currency || "$"}{Number(buy.total_spent).toFixed(2)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-xs py-6">
                  No items purchased yet.
                </div>
              )}
            </div>
          </div>

          {/* Most Visited Days */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-2xs flex flex-col max-h-[220px]">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-slate-900 dark:text-white">
                <IconCalendarEvent size={16} className="text-emerald-500" />
                <h3 className="text-sm font-bold">Most Visited Days</h3>
              </div>
              {sortedVisitedDays.length > 0 && (() => {
                const maxVisits = Math.max(...sortedVisitedDays.map((d) => d.visits));
                const peakDay = sortedVisitedDays.find((d) => d.visits === maxVisits && d.visits > 0)?.day_name;
                return peakDay ? (
                  <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-500/20 uppercase font-mono">
                    {peakDay} Peak
                  </span>
                ) : null;
              })()}
            </div>
            <div className="flex-1 w-full -mt-2 -ml-2">
              <Chart options={chartOptions} series={chartSeries} type="area" height={145} width="100%" />
            </div>
          </div>
        </div>

        {/* Tab Switcher & Unified Table Container */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-2xs">
          {/* Tab Navigation Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 gap-3">
            {/* 2 Tabs: Bills vs Loyalty */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 w-fit">
              <button
                type="button"
                onClick={() => setActiveTab("bills")}
                className={clsx(
                  "min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer",
                  activeTab === "bills"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <IconReceipt size={15} />
                <span>Customer Bills</span>
                <span className="px-1.5 py-0.2 rounded-md bg-slate-200/60 dark:bg-slate-700 text-[10px] font-mono">
                  {invoices?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("loyalty")}
                className={clsx(
                  "min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer",
                  activeTab === "loyalty"
                    ? "bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <IconHistory size={15} />
                <span>Loyalty Ledger</span>
                <span className="px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[10px] font-mono font-bold">
                  {loyaltyTransactions?.length || 0}
                </span>
              </button>
            </div>

            {/* Search filter for Bills Tab */}
            {activeTab === "bills" && (
              <div className="px-3 py-1.5 rounded-xl flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 sm:max-w-xs w-full transition focus-within:ring-2 focus-within:ring-emerald-500">
                <IconSearch stroke={iconStroke} size={15} className="text-slate-400 mr-2 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Filter by ID or status..."
                  className="bg-transparent placeholder:text-slate-400 outline-none block w-full text-xs text-slate-800 dark:text-slate-200"
                  value={state.search}
                  onChange={(e) => setState({ ...state, search: e.target.value })}
                />
                {state.search && (
                  <button onClick={() => setState({ ...state, search: "" })} className="text-slate-400 hover:text-slate-600 transition">
                    <IconX stroke={iconStroke} size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* TAB CONTENT 1: Bills & Invoices */}
          {activeTab === "bills" && (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2 px-3">Invoice #</th>
                      <th className="py-2 px-3">Order Type</th>
                      <th className="py-2 px-3">Total</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Payment</th>
                      <th className="py-2 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {invoices?.filter((inv) => {
                      if (!state.search) return true;
                      const query = state.search.toLowerCase();
                      return inv.invoice_no?.toString().includes(query) || inv.status?.toLowerCase().includes(query);
                    }).length > 0 ? (
                      invoices
                        .filter((inv) => {
                          if (!state.search) return true;
                          const query = state.search.toLowerCase();
                          return inv.invoice_no?.toString().includes(query) || inv.status?.toLowerCase().includes(query);
                        })
                        .map((inv, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition font-medium">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                              #{inv.invoice_no}
                            </td>
                            <td className="py-2.5 px-3">
                              {inv.order_type ? (
                                <span className="px-2 py-0.5 text-[11px] border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800">
                                  {inv.order_type}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white font-mono">
                              {state.currency || "$"}{Number(inv.total).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={clsx("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono", {
                                  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300": inv.status === "completed",
                                  "bg-rose-500/15 text-rose-700 dark:text-rose-300": inv.status === "cancelled",
                                  "bg-amber-500/15 text-amber-700 dark:text-amber-300": inv.status === "pending",
                                })}
                              >
                                {inv.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                              {new Date(inv.created_at).toLocaleDateString()} {new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-[11px]">
                              {inv.payment_type || <span className="text-slate-400">-</span>}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <Menu as="div" className="relative inline-block text-left">
                                <div>
                                  <Menu.Button className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-500 cursor-pointer">
                                    <IconDotsVertical size={16} stroke={iconStroke} />
                                  </Menu.Button>
                                </div>
                                <Transition
                                  enter="transition ease-out duration-100"
                                  enterFrom="transform opacity-0 scale-95"
                                  enterTo="transform opacity-100 scale-100"
                                  leave="transition ease-in duration-75"
                                  leaveFrom="transform opacity-100 scale-100"
                                  leaveTo="transform opacity-0 scale-95"
                                >
                                  <Menu.Items className="absolute right-0 z-20 w-40 origin-top-right rounded-xl bg-white dark:bg-slate-900 shadow-xl ring-1 ring-black/5 focus:outline-none border border-slate-200 dark:border-slate-800 p-1">
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() => handleViewReceipt(inv)}
                                          className={clsx(
                                            active ? "bg-slate-100 dark:bg-slate-800" : "",
                                            "flex w-full items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
                                          )}
                                        >
                                          <IconEye size={15} stroke={iconStroke} /> View Receipt
                                        </button>
                                      )}
                                    </Menu.Item>
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() => handlePrintReceipt(inv)}
                                          className={clsx(
                                            active ? "bg-slate-100 dark:bg-slate-800" : "",
                                            "flex w-full items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
                                          )}
                                        >
                                          <IconPrinter size={15} stroke={iconStroke} /> Print Receipt
                                        </button>
                                      )}
                                    </Menu.Item>
                                  </Menu.Items>
                                </Transition>
                              </Menu>
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="text-center py-8 text-slate-400 text-xs">
                          No bills match your criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Compact Pagination */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                <span>
                  Page <strong className="font-mono text-slate-800 dark:text-slate-200">{page}</strong> of <strong className="font-mono text-slate-800 dark:text-slate-200">{totalPages || 1}</strong>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={btnPaginationPreviousPage}
                    disabled={page === 1}
                    className="min-h-[36px] px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition active:scale-95 cursor-pointer font-semibold"
                  >
                    Prev
                  </button>
                  <button
                    onClick={btnPaginationNextPage}
                    disabled={page === totalPages || !totalPages}
                    className="min-h-[36px] px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition active:scale-95 cursor-pointer font-semibold"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT 2: Loyalty Ledger */}
          {activeTab === "loyalty" && (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2 px-3">Tx ID</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Points</th>
                      <th className="py-2 px-3">Balance After</th>
                      <th className="py-2 px-3">Audit Details / Notes</th>
                      <th className="py-2 px-3">Staff</th>
                      <th className="py-2 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {loyaltyTransactions?.length > 0 ? (
                      loyaltyTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                            #{tx.id}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={clsx("px-2 py-0.5 rounded-full text-[10px] font-black uppercase font-mono", {
                                "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300": tx.transaction_type === "EARNED",
                                "bg-amber-500/15 text-amber-700 dark:text-amber-300": tx.transaction_type === "REDEEMED",
                                "bg-rose-500/15 text-rose-700 dark:text-rose-300": tx.transaction_type === "VOID_REVERSAL",
                                "bg-blue-500/15 text-blue-700 dark:text-blue-300": tx.transaction_type === "MANUAL_ADJUSTMENT",
                              })}
                            >
                              {tx.transaction_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-black text-xs">
                            <span className={tx.points > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                              {tx.points > 0 ? `+${tx.points}` : tx.points} pts
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                            {tx.balance_after} pts
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate text-[11px]">
                            {tx.notes || (tx.invoice_id ? `Order #${tx.invoice_id}` : "-")}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                            {tx.created_by_user_id || "-"}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="text-center py-8 text-slate-400 text-xs">
                          No loyalty transactions recorded yet for this customer.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Adjust Points Modal */}
        {isAdjustModalOpen && (
          <dialog className="modal modal-open">
            <div className="modal-box rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <IconAward size={18} className="text-amber-500" />
                  Adjust Customer Points
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <IconX size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Manually credit bonus points or deduct points for <strong className="text-slate-800 dark:text-slate-200">{customer.name}</strong> ({customer.phone}). Current balance: <strong className="text-amber-600 font-mono">{pointsBalance} pts</strong>.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                    Points to Adjust (e.g. +50 or -20)
                  </label>
                  <input
                    type="number"
                    step="1"
                    placeholder="e.g. 50 or -20"
                    value={adjustPointsValue}
                    onChange={(e) => setAdjustPointsValue(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                    Audit Reason / Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Birthday bonus, service apology, VIP perk"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingAdjust || !adjustPointsValue || parseInt(adjustPointsValue, 10) === 0}
                  onClick={async () => {
                    try {
                      setIsSubmittingAdjust(true);
                      await adjustCustomerPoints(phone, parseInt(adjustPointsValue, 10), adjustNotes);
                      toast.success("Customer points adjusted successfully!");
                      setIsAdjustModalOpen(false);
                      setAdjustPointsValue("");
                      setAdjustNotes("");
                      await Promise.all([mutateLoyalty(), mutateHistory()]);
                    } catch (err) {
                      toast.error(err?.response?.data?.message || err?.message || "Failed to adjust points");
                    } finally {
                      setIsSubmittingAdjust(false);
                    }
                  }}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <IconCheck size={16} />
                  <span>{isSubmittingAdjust ? "Saving..." : "Apply Adjustment"}</span>
                </button>
              </div>
            </div>
          </dialog>
        )}
      </div>
    </Page>
  );
}
