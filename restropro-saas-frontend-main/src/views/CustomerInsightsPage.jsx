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
  IconDownload,
  IconDotsVertical,
  IconSearch,
  IconX
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { useCustomer, useCustomerInsights, useCustomerInvoices } from "../controllers/customers.controller";
import { getInvoiceOrders, getInvoicesInit } from "../controllers/invoices.controller";
import { setDetailsForReceiptPrint } from '../helpers/ReceiptHelper';
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

  const [state, setState] = useState({
    page: 1,
    limit: 10,
    search: "",
    printSettings: null,
    storeSettings: null,
    currency: null,
    paymentTypes: [],
  });

  useEffect(() => {
    async function init() {
      try {
        const res = await getInvoicesInit();
        if(res.status === 200) {
          const ordersInit = res.data;
          const currency = CURRENCIES.find((c)=>c.cc===ordersInit?.storeSettings?.currency);
          setState(prev => ({
            ...prev,
            printSettings: ordersInit.printSettings || {},
            storeSettings: ordersInit.storeSettings || {},
            paymentTypes: ordersInit?.paymentTypes || [],
            currency: currency?.symbol,
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

  if (isLoadingCustomer || isLoadingInsights || isLoadingInvoices) {
    return <Page>{t('customers.please_wait') || "Please wait..."}</Page>;
  }

  if (!customer) {
    return <Page>Customer not found</Page>;
  }

  const { totalSpend, visits, thisMonthSpend, avgBill, visitedDays, topBuys } = insights || {};
  const { invoices, totalPages, page } = invoicesData || {};

  const allDaysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const sortedVisitedDays = allDaysOfWeek.map(dayName => {
    const existingDay = visitedDays?.find(d => d.day_name === dayName);
    return {
      day_name: dayName,
      visits: existingDay ? existingDay.visits : 0
    };
  });

  const chartOptions = {
    chart: {
      type: "area",
      toolbar: { show: false },
      fontFamily: "Inter, sans-serif",
      zoom: { enabled: false },
      background: "transparent",
      dropShadow: {
        enabled: true,
        color: '#22c55e',
        top: 10,
        left: 0,
        blur: 10,
        opacity: 0.1
      }
    },
    colors: ["#22c55e"],
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 90, 100]
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: "smooth",
      width: 3
    },
    markers: {
      size: 4,
      colors: ["#fff"],
      strokeColors: "#22c55e",
      strokeWidth: 2,
      hover: {
        size: 6,
      }
    },
    xaxis: {
      categories: sortedVisitedDays.map(d => d.day_name.substring(0, 3)) || [],
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          colors: '#6b7280',
          fontSize: '12px',
        }
      }
    },
    yaxis: {
      show: false,
      min: -(Math.max(1, ...sortedVisitedDays.map(d => d.visits)) * 0.05),
      max: Math.max(1, ...sortedVisitedDays.map(d => d.visits)) * 1.05,
    },
    grid: {
      show: false,
      padding: {
        left: 14,
        right: 10,
        top: 0,
        bottom: 10
      }
    },
    theme: {
      mode: theme === "black" ? "dark" : "light"
    },
    tooltip: {
      custom: function({ series, seriesIndex, dataPointIndex, w }) {
        const visits = series[seriesIndex][dataPointIndex];
        const dayName = w.globals.labels[dataPointIndex];
        return (
          '<div class="shadow-lg  border border-restro-border-green overflow-hidden flex flex-col min-w-[130px]">' +
            '<div class="px-3 py-2 bg-restro-green-light dark:bg-[#1a2e20] text-restro-green-dark dark:text-restro-green font-semibold text-xs border-b border-restro-border-green">' + dayName + '</div>' +
            '<div class="px-3 py-2 bg-white dark:bg-restro-bg-card-dark-mode flex items-center gap-2">' +
              '<span class="w-2.5 h-2.5 bg-restro-green"></span>' +
              '<span class="text-sm text-gray-700 dark:text-gray-200 font-medium">Visits: <span class="font-bold text-gray-900 dark:text-white">' + visits + ' visit(s)</span></span>' +
            '</div>' +
          '</div>'
        );
      }
    }
  };

  const chartSeries = [{
    name: "Visits",
    data: sortedVisitedDays.map(d => d.visits) || []
  }];

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
      toast.loading(t('invoices.please_wait') || "Please wait...");
      const res = await getInvoiceOrders(invoice.invoice_no, [invoice.order_id]);
      toast.dismiss();

      if(res.status === 200) {
        const { subtotal, taxTotal, serviceChargeTotal, discountType, discountValue, discountTotal, total, orders: ordersArr } = res.data;
        const orders = [];
        for (const o of ordersArr) {
          o.items.forEach((i)=>{
            const variant = i.variant_id ? { id: i.variant_id, title: i.variant_title, price: i.variant_price } : null;
            orders.push({ ...i, title: i.item_title, addons_ids: i?.addons?.length > 0 ? i?.addons?.map((a)=>a.id):[], variant: variant });
          })
        }
        const {customer_id, customer_type, customer_name, delivery_type} = ordersArr;

        setDetailsForReceiptPrint({
          cartItems: orders, deliveryType:delivery_type, customerType:customer_type, customer:{id: customer_id, name: customer_name}, tableId: null, currency:state.currency, storeSettings: state.storeSettings, printSettings:state.printSettings,
          itemsTotal: subtotal, discountType, discountValue, discountAmount: discountTotal || 0, taxTotal: taxTotal, serviceChargeTotal:serviceChargeTotal, payableTotal: total,
          tokenNo: invoice.token_no, orderId: invoice.order_id, paymentMethod: invoice.payment_type
        });

        window.open("/print-receipt", "_blank", "toolbar=yes,scrollbars=yes,resizable=yes,top=500,left=500,width=400,height=400");
      }
    } catch (error) {
      toast.dismiss();
      toast.error(error?.response?.data?.message || t('invoices.error_processing_request') || "Error viewing receipt");
    }
  }

  const handlePrintReceipt = async (invoice) => {
    try {
      toast.loading(t('invoices.please_wait') || "Please wait...");
      const res = await getInvoiceOrders(invoice.invoice_no, [invoice.order_id]);
      toast.dismiss();

      if(res.status === 200) {
        const { subtotal, taxTotal, serviceChargeTotal, discountType, discountValue, discountTotal, total, orders: ordersArr } = res.data;
        const orders = [];
        for (const o of ordersArr) {
          o.items.forEach((i)=>{
            const variant = i.variant_id ? { id: i.variant_id, title: i.variant_title, price: i.variant_price } : null;
            orders.push({ ...i, title: i.item_title, addons_ids: i?.addons?.length > 0 ? i?.addons?.map((a)=>a.id):[], variant: variant });
          })
        }
        const {customer_id, customer_type, customer_name, delivery_type} = ordersArr;

        setDetailsForReceiptPrint({
          cartItems: orders, deliveryType:delivery_type, customerType:customer_type, customer:{id: customer_id, name: customer_name}, tableId: null, currency:state.currency, storeSettings: state.storeSettings, printSettings:state.printSettings,
          itemsTotal: subtotal, discountType, discountValue, discountAmount: discountTotal || 0, taxTotal: taxTotal, serviceChargeTotal:serviceChargeTotal, payableTotal: total,
          tokenNo: invoice.token_no, orderId: invoice.order_id, paymentMethod: invoice.payment_type
        });

        const receiptWindow = window.open("/print-receipt", "_blank", "toolbar=yes,scrollbars=yes,resizable=yes,top=500,left=500,width=400,height=400");
        receiptWindow.onload = (e) => {
          setTimeout(()=>{ receiptWindow.print(); }, 400)
        }
      }
    } catch (error) {
      toast.dismiss();
      toast.error(error?.response?.data?.message || t('invoices.error_processing_request') || "Error printing receipt");
    }
  }

  return (
    <Page>
      <div className="flex flex-col gap-6 w-full pb-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate("/dashboard/customers")}
              className="p-2 border rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition shadow-sm bg-white dark:bg-restro-bg-card-dark-mode"
            >
              <IconArrowLeft stroke={iconStroke} size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{customer.name}</h1>
              <p className="text-gray-500 text-sm mt-1">{customer.phone}</p>
            </div>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 rounded-2xl bg-restro-green-light dark:bg-[#1a2e20] transition">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-3">
              <IconCurrencyDollar size={18} className="text-restro-green" />
              <span className="font-semibold text-sm">Total Spend</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{Number(totalSpend || 0).toFixed(2)}</h2>
          </div>
          
          <div className="p-6 rounded-2xl bg-restro-green-light dark:bg-[#1a2e20] transition">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-3">
              <IconCalendarEvent size={18} className="text-restro-green" />
              <span className="font-semibold text-sm">This Month</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{Number(thisMonthSpend || 0).toFixed(2)}</h2>
          </div>

          <div className="p-6 rounded-2xl bg-restro-green-light dark:bg-[#1a2e20] transition">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-3">
              <IconReceipt size={18} className="text-restro-green" />
              <span className="font-semibold text-sm">Avg Bill</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{Number(avgBill || 0).toFixed(2)}</h2>
          </div>

          <div className="p-6 rounded-2xl bg-restro-green-light dark:bg-[#1a2e20] transition">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-3">
              <IconUser size={18} className="text-restro-green" />
              <span className="font-semibold text-sm">Visits</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{visits || 0}</h2>
          </div>
        </div>

        {/* Analytics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 border rounded-2xl bg-white dark:bg-restro-bg-card-dark-mode border-restro-border-green shadow-sm flex flex-col max-h-[350px]">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-restro-green">🔥</span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Top Buys</h3>
            </div>
            <div className="space-y-2 overflow-y-auto pr-2">
              {topBuys?.length > 0 ? topBuys.map((buy, idx) => (
                <div key={idx} className="flex justify-between items-center py-3 border-b last:border-0 border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-[#222222] flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-100 dark:border-gray-800">
                      {buy.image ? (
                        <img src={getImageURL(buy.image)} alt={buy.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-400 text-lg">🍽️</span>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{buy.title}</span>
                      <span className="text-xs text-gray-500 mt-1">{buy.total_quantity} orders</span>
                    </div>
                  </div>
                  <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{Number(buy.total_spent).toFixed(2)}</span>
                </div>
              )) : (
                <p className="text-gray-500 text-sm">No items purchased yet.</p>
              )}
            </div>
          </div>

          <div className="p-6 border rounded-2xl bg-white dark:bg-restro-bg-card-dark-mode border-restro-border-green shadow-sm flex flex-col max-h-[350px]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <IconCalendarEvent size={20} className="text-restro-green" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Most Visited Days</h3>
              </div>
              {sortedVisitedDays.length > 0 && (() => {
                const maxVisits = Math.max(...sortedVisitedDays.map(d => d.visits));
                const peakDay = sortedVisitedDays.find(d => d.visits === maxVisits)?.day_name;
                return (
                  <span className="bg-restro-green-light dark:bg-[#1a2e20] text-restro-green text-[11px] px-3 py-1 rounded-full flex items-center gap-1 font-bold border border-restro-border-green uppercase tracking-wide">
                    ★ {peakDay} PEAK
                  </span>
                )
              })()}
            </div>
            <div className="flex-1 w-full mt-2 -ml-3">
              {sortedVisitedDays.length > 0 ? (
                <Chart options={chartOptions} series={chartSeries} type="area" height={260} width="100%" />
              ) : (
                <p className="text-gray-500 text-sm px-2">No visit data available.</p>
              )}
            </div>
          </div>
        </div>

        {/* Customer Bills Table */}
        <div className="p-6 border rounded-2xl bg-white dark:bg-restro-bg-card-dark-mode border-restro-border-green shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Customer Bills</h3>
            
            {/* Filter */}
            <div className='px-4 py-2 rounded-full flex items-center bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 max-w-xs w-full transition focus-within:ring-2 focus-within:ring-restro-green focus-within:border-transparent'>
              <input
                type="text"
                placeholder="Search by ID or Status"
                className="bg-transparent placeholder:text-gray-400 outline-none block w-full text-sm text-gray-800 dark:text-gray-200"
                value={state.search}
                onChange={(e) => setState({ ...state, search: e.target.value })}
              />
              {state.search && (
                <button onClick={() => setState({ ...state, search: "" })} className="text-gray-400 hover:text-gray-600 transition">
                  <IconX stroke={iconStroke} size={16} />
                </button>
              )}
              {!state.search && <IconSearch stroke={iconStroke} size={16} className="text-gray-400" />}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr className="border-b-2 border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 font-semibold text-sm">
                  <th className="font-semibold">ID</th>
                  <th className="font-semibold">Order Type</th>
                  <th className="font-semibold">Total</th>
                  <th className="font-semibold">Status</th>
                  <th className="font-semibold">Date</th>
                  <th className="font-semibold">Payment Type</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices?.filter(inv => {
                  if(!state.search) return true;
                  const query = state.search.toLowerCase();
                  return inv.invoice_no?.toString().includes(query) || inv.status?.toLowerCase().includes(query);
                }).length > 0 ? invoices.filter(inv => {
                  if(!state.search) return true;
                  const query = state.search.toLowerCase();
                  return inv.invoice_no?.toString().includes(query) || inv.status?.toLowerCase().includes(query);
                }).map((inv, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition border-b border-gray-100 dark:border-gray-800 last:border-0 text-sm">
                    <td className="py-4 text-gray-700 dark:text-gray-300">{inv.invoice_no}</td>
                    <td className="py-4">
                      {inv.order_type ? (
                        <div className="px-3 py-1 inline-flex text-xs border border-gray-300 dark:border-gray-600 rounded-full text-gray-600 dark:text-gray-400 font-medium bg-transparent">{inv.order_type}</div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="font-bold text-gray-900 dark:text-white py-4">{Number(inv.total).toFixed(2)}</td>
                    <td className="py-4">
                      <div className={clsx("px-3 py-1 inline-flex text-xs rounded-full font-medium", {
                        "bg-restro-green text-white": inv.status === 'completed',
                        "bg-red-500 text-white": inv.status === 'cancelled',
                        "bg-yellow-500 text-white": inv.status === 'pending'
                      })}>
                        {inv.status}
                      </div>
                    </td>
                    <td className="py-4 text-gray-600 dark:text-gray-400">{new Date(inv.created_at).toLocaleString()}</td>
                    <td className="py-4 text-gray-600 dark:text-gray-400">{inv.payment_type || <span className="text-gray-400 text-sm">-</span>}</td>
                    <td className="text-right py-4">
                      <Menu as="div" className="relative inline-block text-left">
                        <div>
                          <Menu.Button className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                            <IconDotsVertical size={18} stroke={iconStroke} className="text-gray-500" />
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
                          <Menu.Items className="absolute right-0 z-10 w-48 origin-top-right rounded-xl bg-white dark:bg-[#1a1a1a] shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-gray-100 dark:border-gray-800">
                            <div className="py-1">
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    onClick={() => handleViewReceipt(inv)}
                                    className={clsx(
                                      active ? 'bg-gray-100 dark:bg-gray-800' : '',
                                      'flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200'
                                    )}
                                  >
                                    <IconEye size={18} stroke={iconStroke} /> View Receipt
                                  </button>
                                )}
                              </Menu.Item>
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    onClick={() => handlePrintReceipt(inv)}
                                    className={clsx(
                                      active ? 'bg-gray-100 dark:bg-gray-800' : '',
                                      'flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200'
                                    )}
                                  >
                                    <IconPrinter size={18} stroke={iconStroke} /> Print Receipt
                                  </button>
                                )}
                              </Menu.Item>
                            </div>
                          </Menu.Items>
                        </Transition>
                      </Menu>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-gray-500">No bills match your criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="flex justify-end mt-4">
            <div className="join">
              <button
                onClick={btnPaginationPreviousPage}
                disabled={page === 1}
                className="join-item btn btn-sm bg-white dark:bg-black"
              >
                Prev
              </button>
              <button className="join-item btn btn-sm bg-white dark:bg-black pointer-events-none">
                Page {page} of {totalPages || 1}
              </button>
              <button
                onClick={btnPaginationNextPage}
                disabled={page === totalPages || !totalPages}
                className="join-item btn btn-sm bg-white dark:bg-black"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
