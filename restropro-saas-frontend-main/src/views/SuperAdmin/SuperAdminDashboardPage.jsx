import React from 'react'
import Page from "../../components/Page";
import ImgUiflowLogo from "../../assets/uiflow-logo.svg"
import { Link } from 'react-router-dom';
import {
  IconArrowRight,
  IconInfoCircleFilled,
  IconBuildingStore,
  IconCurrencyDollar,
  IconChartBar,
  IconShoppingCart,
  IconTrendingUp,
} from '@tabler/icons-react';
import { appVersion, iconStroke, subscriptionAmount } from '../../config/config';
import { useSuperAdminDashboard } from "../../controllers/superadmin.controller";
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

export default function SuperAdminDashboardPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { data, error, isLoading } = useSuperAdminDashboard();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <span className="w-8 h-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#2CA01C]" />
        <span className="text-xs text-gray-500">{t('superadmin_dashboard.please_wait', 'Loading dashboard...')}</span>
      </div>
    );
  }

  if (error) {
    console.error(error);
    return (
      <div className="p-6 text-center text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl">
        {t('superadmin_dashboard.error_loading', 'Error loading dashboard')}
      </div>
    );
  }

  const {
    activeTenants = 0,
    ordersProcessedToday = 0,
    salesVolumeToday = 0,
    mrr = 0,
    arr = 0,
  } = data || {};

  const mrrValue = mrr * subscriptionAmount;
  const arrValue = arr * subscriptionAmount * 12;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* QuickBooks Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <span>Dashboard</span>
            <span>/</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              Overview
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {t('superadmin_dashboard.title', 'Executive Overview')}
          </h1>
        </div>

        <Link
          to="/superadmin/dashboard/tenants"
          className="inline-flex items-center gap-1.5 bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xs transition"
        >
          <span>View All Businesses</span>
          <IconArrowRight size={16} stroke={iconStroke} />
        </Link>
      </div>

      {/* KPI Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Active Tenants */}
        <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#2CA01C]" />
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              {t('superadmin_dashboard.active_tenants', 'Active Businesses')}
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-[#2CA01C]">
              <IconBuildingStore size={20} stroke={iconStroke} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {Number(activeTenants).toLocaleString('en')}
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
              <IconTrendingUp size={14} />
              <span>Operational & verified</span>
            </p>
          </div>
        </div>

        {/* MRR */}
        <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" />
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              {t('superadmin_dashboard.mrr', 'Monthly Recurring Revenue')}
            </span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600">
              <IconCurrencyDollar size={20} stroke={iconStroke} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              ${Number(mrrValue).toLocaleString('en', { notation: 'compact' })}
            </div>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Estimated Monthly SaaS
            </p>
          </div>
        </div>

        {/* ARR */}
        <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-600" />
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              {t('superadmin_dashboard.arr', 'Annual Run Rate')}
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
              <IconChartBar size={20} stroke={iconStroke} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              ${Number(arrValue).toLocaleString('en', { notation: 'compact' })}
            </div>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Projected 12-Month ARR
            </p>
          </div>
        </div>

        {/* Today's Sales Volume */}
        <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold uppercase tracking-wider">
                {t('superadmin_dashboard.store_sales', 'Store Sales Today')}
              </span>
              <div
                className="tooltip cursor-pointer"
                data-tip={t('superadmin_dashboard.store_sales_info', 'Aggregated volume across all restaurants today')}
              >
                <IconInfoCircleFilled size={14} className="text-gray-400" />
              </div>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600">
              <IconShoppingCart size={20} stroke={iconStroke} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              ${Number(salesVolumeToday).toLocaleString('en', { notation: 'compact' })}
            </div>
            <p className="text-xs text-gray-500 font-medium mt-1">
              {Number(ordersProcessedToday).toLocaleString('en')} orders processed today
            </p>
          </div>
        </div>

      </div>

      {/* Quick Action Navigation Bar */}
      <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">
            System Reports & Analytics
          </h3>
          <p className="text-xs text-gray-500">
            View detailed transactions, tenant growth, and platform audit trails.
          </p>
        </div>

        <Link
          to="/superadmin/dashboard/reports"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-semibold transition"
        >
          <span>{t('superadmin_dashboard.view_more', 'Detailed Reports')}</span>
          <IconArrowRight size={15} stroke={iconStroke} />
        </Link>
      </div>

      {/* Footer Branding */}
      <div className="pt-6 pb-2 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
        <img src={ImgUiflowLogo} alt="UIFLOW" className="w-5 h-5 rounded" />
        <span>Bong POS SaaS Administration • Version {appVersion}</span>
      </div>

    </div>
  );
}
