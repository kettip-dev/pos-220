import React, { useEffect, useMemo, useRef, useState } from 'react';
import Page from '../components/Page';
import {
  IconArrowRight,
  IconBuildingStore,
  IconCalendar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconCopy,
  IconDownload,
  IconExternalLink,
  IconEye,
  IconFilter,
  IconHeartHandshake,
  IconInfoCircle,
  IconInfoSquareRoundedFilled,
  IconMessageHeart,
  IconPhone,
  IconQrcode,
  IconReceipt,
  IconRefresh,
  IconSearch,
  IconSparkles,
  IconStar,
  IconStarFilled,
  IconThumbUp,
  IconToolsKitchen2,
  IconUser,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { iconStroke } from '../config/config';
import { getFeedbackInit, getFeedbacks, searchFeedbacks } from '../controllers/feedback.controller';
import { useStoreSettings } from '../controllers/settings.controller';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { isAllBusinessesScope } from '../helpers/BusinessScope';
import { getUserDetailsInLocalStorage } from '../helpers/UserDetails';
import QRCode from 'qrcode';

export default function FeedbackPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  // Enterprise "All Businesses" view
  const isConsolidated = isAllBusinessesScope(getUserDetailsInLocalStorage()?.role);

  // Store settings for feedback QR link
  const { data: storeSettings } = useStoreSettings();

  const filters = [
    { key: "last_7days", value: t("feedback.last_7days") },
    { key: "today", value: t("feedback.today") },
    { key: "yesterday", value: t("feedback.yesterday") },
    { key: "this_month", value: t("feedback.this_month") },
    { key: "last_month", value: t("feedback.last_month") },
    { key: "custom", value: t("feedback.custom") },
  ];

  const searchRef = useRef();
  const fromDateRef = useRef();
  const toDateRef = useRef();
  const filterTypeRef = useRef();

  const now = new Date();
  const defaultDateFrom = `${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
  const defaultDateTo = `${now.getFullYear()}-${(now.getMonth() + 2)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;

  const [state, setState] = useState({
    search: "",
    data: [],
    page: 1,
    activeFilter: "last_7days",
    ratingFilter: null, // null | 5 | 4 | 3 | 2 | 1
    fromDate: null,
    toDate: null,
    loading: true,
    refreshing: false,

    loved: 0,
    good: 0,
    average: 0,
    bad: 0,
    worst: 0,

    averageRating: 0,
    foodRating: 0,
    staffRating: 0,
    ambianceRating: 0,
    serviceRating: 0,
    recommendRating: 0,

    businesses: [],
  });

  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [feedbackShareLink, setFeedbackShareLink] = useState("");

  const pageSize = 10;

  useEffect(() => {
    _init();
  }, []);

  // Prepare feedback share link and QR code
  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const code = storeSettings?.uniqueQRCode;
    const link = code ? `${origin}/m/${code}/feedback` : `${origin}/feedback`;
    setFeedbackShareLink(link);

    QRCode.toDataURL(link, { width: 360, margin: 2 })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error("Error generating QR:", err));
  }, [storeSettings?.uniqueQRCode]);

  const _init = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true }));
      const res = await getFeedbackInit();

      if (res.status === 200) {
        const initData = res.data;
        const counting = initData.overallFeedbackCounting || {};

        setState((prev) => ({
          ...prev,
          loading: false,
          refreshing: false,
          loved: Number(counting.loved) || 0,
          good: Number(counting.good) || 0,
          average: Number(counting.average) || 0,
          bad: Number(counting.bad) || 0,
          worst: Number(counting.worst) || 0,
          averageRating: Number(initData.averageRating) || 0,
          foodRating: Number(initData.foodRating) || 0,
          staffRating: Number(initData.staffRating) || 0,
          ambianceRating: Number(initData.ambianceRating) || 0,
          serviceRating: Number(initData.serviceRating) || 0,
          recommendRating: Number(initData.recommendRating) || 0,
          data: initData?.feedbacks || [],
          businesses: initData?.businesses || [],
          activeFilter: "last_7days",
          page: 1,
        }));
      }
    } catch (error) {
      console.error(error);
      setState((prev) => ({ ...prev, loading: false, refreshing: false }));
    }
  };

  const handleRefresh = async () => {
    setState((prev) => ({ ...prev, refreshing: true }));
    await _init();
    toast.success(t("feedback.refresh", "Refreshed"));
  };

  const btnSearch = async () => {
    const searchQuery = searchRef.current?.value?.trim() || "";
    if (!searchQuery) {
      return;
    }

    try {
      toast.loading(t("feedback.loading_message"));
      const res = await searchFeedbacks(searchQuery);
      toast.dismiss();
      if (res.status === 200 && res.data) {
        if (res.data.length > 0) {
          setState((prev) => ({
            ...prev,
            search: searchQuery,
            data: res.data,
            page: 1,
          }));
        } else {
          toast.error(t("feedback.no_result_found"));
        }
      } else {
        toast.error(t("feedback.no_result_found"));
      }
    } catch (error) {
      toast.dismiss();
      console.error(error);
      const message = error.response?.data?.message || t("feedback.something_went_wrong");
      toast.error(message);
    }
  };

  const btnClearSearch = () => {
    if (searchRef.current) {
      searchRef.current.value = "";
    }
    btnResetFilter();
  };

  const btnSelectDateFilter = async (filterKey) => {
    if (filterKey === "custom") {
      document.getElementById("filter-dialog")?.showModal();
      return;
    }

    try {
      toast.loading(t("feedback.loading_message"));
      const res = await getFeedbacks(filterKey, null, null);
      toast.dismiss();
      if (res.status === 200) {
        setState((prev) => ({
          ...prev,
          activeFilter: filterKey,
          fromDate: null,
          toDate: null,
          data: res?.data || [],
          page: 1,
        }));
      }
    } catch (error) {
      toast.dismiss();
      const message = error?.response?.data?.message || t("feedback.something_went_wrong");
      toast.error(message);
    }
  };

  const btnApplyFilter = async () => {
    const filter = filterTypeRef.current?.value || "custom";
    const fromDate = fromDateRef.current?.value || null;
    const toDate = toDateRef.current?.value || null;

    try {
      toast.loading(t("feedback.loading_message"));
      const res = await getFeedbacks(filter, fromDate, toDate);
      toast.dismiss();
      if (res.status === 200) {
        setState((prev) => ({
          ...prev,
          activeFilter: filter,
          fromDate: fromDate,
          toDate: toDate,
          data: res?.data || [],
          page: 1,
        }));
      }
    } catch (error) {
      toast.dismiss();
      const message = error?.response?.data?.message || t("feedback.something_went_wrong");
      toast.error(message);
    }
  };

  const btnResetFilter = async () => {
    try {
      toast.loading(t("feedback.loading_message"));
      const res = await getFeedbacks("last_7days", null, null);
      toast.dismiss();
      if (res.status === 200) {
        setState((prev) => ({
          ...prev,
          activeFilter: "last_7days",
          ratingFilter: null,
          fromDate: null,
          toDate: null,
          search: "",
          data: res?.data || [],
          page: 1,
        }));
      }
    } catch (error) {
      toast.dismiss();
      const message = error?.response?.data?.message || t("feedback.something_went_wrong");
      toast.error(message);
    }
  };

  const btnExport = async () => {
    try {
      toast.loading(t("feedback.loading_message"));

      if (state.data.length === 0) {
        toast.dismiss();
        toast.error(t("feedback.no_result_found"));
        return;
      }

      const feedbacks = state.data.map(({ businessTenantId, ...row }) => row);
      const { Parser } = await import("@json2csv/plainjs");
      const { saveAs } = await import("file-saver");
      const parser = new Parser({});
      const csv = parser.parse(feedbacks);

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      toast.dismiss();
      saveAs(blob, `Feedbacks_${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (error) {
      const message = error?.response?.data?.message || t("feedback.something_went_wrong");
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  };

  const btnView = (item) => {
    setSelectedFeedback(item);
    document.getElementById("modal-feedback-view")?.showModal();
  };

  const copyToClipboard = (text, label = "") => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(label ? `${label} ${t("feedback.copied", "Copied!")}` : t("feedback.copied", "Copied!"));
  };

  // Helper metadata based on 5-tier rating scale
  const getRatingMeta = (rating) => {
    const r = Number(rating);
    if (!r || isNaN(r) || r <= 0) {
      return {
        emoji: '—',
        text: 'N/A',
        badgeClass: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
        color: '#9ca3af',
      };
    }
    if (r >= 4.5) {
      return {
        emoji: '😍',
        text: t("feedback.loved_it", "Loved it"),
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
        color: '#10b981',
      };
    }
    if (r >= 3.5) {
      return {
        emoji: '😊',
        text: t("feedback.good", "Good"),
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
        color: '#3b82f6',
      };
    }
    if (r >= 2.5) {
      return {
        emoji: '😐',
        text: t("feedback.average", "Average"),
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        color: '#f59e0b',
      };
    }
    if (r >= 1.5) {
      return {
        emoji: '🙁',
        text: t("feedback.bad", "Bad"),
        badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
        color: '#f97316',
      };
    }
    return {
      emoji: '😡',
      text: t("feedback.worst", "Worst"),
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
      color: '#ef4444',
    };
  };

  // Render 5 visual stars
  const renderStars = (rating, size = 16) => {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = r >= star;
          const half = !filled && r >= star - 0.5;
          return (
            <span key={star} className={filled ? "text-amber-400" : half ? "text-amber-400" : "text-gray-300 dark:text-gray-600"}>
              {filled ? (
                <IconStarFilled size={size} />
              ) : half ? (
                <IconStarFilled size={size} className="opacity-70" />
              ) : (
                <IconStar size={size} />
              )}
            </span>
          );
        })}
      </div>
    );
  };

  // Metrics calculations
  const totalReviews = state.loved + state.good + state.average + state.bad + state.worst;
  const positiveCount = state.loved + state.good;
  const satisfactionRate = totalReviews > 0 ? Math.round((positiveCount / totalReviews) * 100) : 0;

  // Filter feedbacks client-side for rating tier and search
  const filteredFeedbacks = useMemo(() => {
    return state.data.filter((item) => {
      if (state.ratingFilter) {
        const rating = Number(item.average_rating) || 0;
        if (state.ratingFilter === 5 && !(rating >= 4.5 && rating <= 5)) return false;
        if (state.ratingFilter === 4 && !(rating >= 3.5 && rating < 4.5)) return false;
        if (state.ratingFilter === 3 && !(rating >= 2.5 && rating < 3.5)) return false;
        if (state.ratingFilter === 2 && !(rating >= 1.5 && rating < 2.5)) return false;
        if (state.ratingFilter === 1 && !(rating >= 1.0 && rating < 1.5)) return false;
      }
      return true;
    });
  }, [state.data, state.ratingFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredFeedbacks.length / pageSize) || 1;
  const paginatedFeedbacks = useMemo(() => {
    const start = (state.page - 1) * pageSize;
    return filteredFeedbacks.slice(start, start + pageSize);
  }, [filteredFeedbacks, state.page]);

  const distributionTiers = [
    { stars: 5, label: t("feedback.loved_it", "Loved it"), emoji: "😍", count: state.loved, barColor: "bg-emerald-500", textHover: "hover:bg-emerald-50 dark:hover:bg-emerald-950/20" },
    { stars: 4, label: t("feedback.good", "Good"), emoji: "😊", count: state.good, barColor: "bg-blue-500", textHover: "hover:bg-blue-50 dark:hover:bg-blue-950/20" },
    { stars: 3, label: t("feedback.average", "Average"), emoji: "😐", count: state.average, barColor: "bg-amber-500", textHover: "hover:bg-amber-50 dark:hover:bg-amber-950/20" },
    { stars: 2, label: t("feedback.bad", "Bad"), emoji: "🙁", count: state.bad, barColor: "bg-orange-500", textHover: "hover:bg-orange-50 dark:hover:bg-orange-950/20" },
    { stars: 1, label: t("feedback.worst", "Worst"), emoji: "😡", count: state.worst, barColor: "bg-rose-500", textHover: "hover:bg-rose-50 dark:hover:bg-rose-950/20" },
  ];

  return (
    <Page className="px-4 py-4 w-full max-w-7xl mx-auto space-y-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                {t("feedback.dashboard_title", "Feedback Dashboard")}
              </h2>
              <button
                type="button"
                onClick={() => document.getElementById("modal-feedback-info")?.showModal()}
                title={t("feedback.understand_feedback", "Understand the Feedback")}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-restro-green hover:bg-gray-100 dark:hover:bg-gray-800 transition active:scale-95"
              >
                <IconInfoCircle stroke={iconStroke} size={20} />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              <span>{t("feedback.reviews_count", { count: totalReviews })}</span>
              {satisfactionRate > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  • {satisfactionRate}% {t("feedback.satisfaction_rate", "Positive")}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Share / QR Feedback Link button */}
          <button
            type="button"
            onClick={() => document.getElementById("modal-feedback-qr")?.showModal()}
            className="min-h-[42px] px-3.5 py-2 rounded-xl flex items-center gap-2 text-sm font-medium border border-restro-border-green bg-restro-card-bg hover:bg-gray-100 dark:hover:bg-gray-800 transition active:scale-95 text-gray-700 dark:text-gray-200"
          >
            <IconQrcode size={18} stroke={iconStroke} className="text-restro-green" />
            <span>{t("feedback.share_feedback_link", "Collect Feedback / QR")}</span>
          </button>

          {/* Refresh button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={state.refreshing}
            className="min-h-[42px] px-3 py-2 rounded-xl flex items-center justify-center border border-restro-border-green bg-restro-card-bg hover:bg-gray-100 dark:hover:bg-gray-800 transition active:scale-95 text-gray-700 dark:text-gray-200"
            title={t("feedback.refresh", "Refresh")}
          >
            <IconRefresh size={18} stroke={iconStroke} className={clsx({ "animate-spin": state.refreshing })} />
          </button>

          {/* Export CSV button */}
          <button
            type="button"
            onClick={btnExport}
            className="min-h-[42px] px-3.5 py-2 rounded-xl flex items-center gap-2 text-sm font-medium border border-restro-border-green bg-restro-card-bg hover:bg-gray-100 dark:hover:bg-gray-800 transition active:scale-95 text-gray-700 dark:text-gray-200 shadow-sm"
          >
            <IconDownload size={18} stroke={iconStroke} />
            <span>{t("feedback.export_button", "Export")}</span>
          </button>
        </div>
      </div>

      {/* 2. Executive Stat Cards & Distribution Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Rating Distribution (Left Card) */}
        <div className="lg:col-span-5 xl:col-span-4 rounded-2xl border border-restro-border-green bg-restro-card-bg p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {t("feedback.overall_feedback", "Overall Feedback")}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {satisfactionRate}% {t("feedback.positive", "Positive")}
              </span>
            </div>

            {/* Overall Score Badge */}
            <div className="flex items-center gap-4 py-4">
              <div className="flex flex-col">
                <span className="text-5xl font-black tracking-tight text-gray-900 dark:text-gray-50">
                  {state.averageRating > 0 ? state.averageRating.toFixed(1) : "0.0"}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">/ 5.0</span>
              </div>
              <div className="flex flex-col gap-1">
                {renderStars(state.averageRating, 22)}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xl">{getRatingMeta(state.averageRating).emoji}</span>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {getRatingMeta(state.averageRating).text}
                  </span>
                </div>
              </div>
            </div>

            {/* Distribution Tier Bars */}
            <div className="space-y-2 mt-1">
              {distributionTiers.map((tier) => {
                const percent = totalReviews > 0 ? Math.round((tier.count / totalReviews) * 100) : 0;
                const isSelected = state.ratingFilter === tier.stars;
                return (
                  <button
                    key={tier.stars}
                    type="button"
                    onClick={() => {
                      setState((prev) => ({
                        ...prev,
                        ratingFilter: prev.ratingFilter === tier.stars ? null : tier.stars,
                        page: 1,
                      }));
                    }}
                    className={clsx(
                      "w-full flex items-center gap-3 p-1.5 rounded-xl transition cursor-pointer text-left active:scale-[0.99]",
                      isSelected
                        ? "bg-emerald-100/60 dark:bg-emerald-950/50 ring-1 ring-emerald-500"
                        : tier.textHover
                    )}
                  >
                    <span className="text-sm font-semibold w-11 flex items-center gap-1 text-gray-700 dark:text-gray-300">
                      <span>{tier.stars}</span>
                      <IconStarFilled size={13} className="text-amber-400" />
                    </span>
                    <span className="text-sm">{tier.emoji}</span>
                    <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
                      <div
                        className={clsx("h-full rounded-full transition-all duration-500", tier.barColor)}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-medium text-gray-500 dark:text-gray-400 w-12 text-right">
                      {tier.count} ({percent}%)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-400">
            <span>{t("feedback.filter_by_rating", "Click a star tier to filter")}</span>
            {state.ratingFilter && (
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, ratingFilter: null, page: 1 }))}
                className="text-emerald-600 hover:underline font-semibold"
              >
                {t("feedback.clear_filter", "Clear")}
              </button>
            )}
          </div>
        </div>

        {/* 6 Category Dimension KPI Cards */}
        <div className="lg:col-span-7 xl:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* 1. Food Quality */}
          <div className="rounded-2xl border border-restro-border-green bg-restro-card-bg p-4 flex flex-col justify-between shadow-sm hover:border-emerald-500/50 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider line-clamp-1">
                {t("feedback.food_quality", "Food Quality")}
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                <IconToolsKitchen2 size={18} stroke={iconStroke} />
              </div>
            </div>
            <div className="my-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-gray-900 dark:text-gray-50">
                  {state.foodRating > 0 ? state.foodRating.toFixed(1) : "—"}
                </span>
                <span className="text-xs text-gray-400">/ 5.0</span>
              </div>
              <div className="mt-1">{renderStars(state.foodRating, 14)}</div>
            </div>
            <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="text-base">{getRatingMeta(state.foodRating).emoji}</span>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 line-clamp-1">
                {getRatingMeta(state.foodRating).text}
              </span>
            </div>
          </div>

          {/* 2. Service Speed */}
          <div className="rounded-2xl border border-restro-border-green bg-restro-card-bg p-4 flex flex-col justify-between shadow-sm hover:border-blue-500/50 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider line-clamp-1">
                {t("feedback.service", "Service")}
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                <IconClock size={18} stroke={iconStroke} />
              </div>
            </div>
            <div className="my-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-gray-900 dark:text-gray-50">
                  {state.serviceRating > 0 ? state.serviceRating.toFixed(1) : "—"}
                </span>
                <span className="text-xs text-gray-400">/ 5.0</span>
              </div>
              <div className="mt-1">{renderStars(state.serviceRating, 14)}</div>
            </div>
            <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="text-base">{getRatingMeta(state.serviceRating).emoji}</span>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 line-clamp-1">
                {getRatingMeta(state.serviceRating).text}
              </span>
            </div>
          </div>

          {/* 3. Staff Behavior */}
          <div className="rounded-2xl border border-restro-border-green bg-restro-card-bg p-4 flex flex-col justify-between shadow-sm hover:border-purple-500/50 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider line-clamp-1">
                {t("feedback.staff_behavior", "Staff Behavior")}
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
                <IconUsers size={18} stroke={iconStroke} />
              </div>
            </div>
            <div className="my-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-gray-900 dark:text-gray-50">
                  {state.staffRating > 0 ? state.staffRating.toFixed(1) : "—"}
                </span>
                <span className="text-xs text-gray-400">/ 5.0</span>
              </div>
              <div className="mt-1">{renderStars(state.staffRating, 14)}</div>
            </div>
            <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="text-base">{getRatingMeta(state.staffRating).emoji}</span>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 line-clamp-1">
                {getRatingMeta(state.staffRating).text}
              </span>
            </div>
          </div>

          {/* 4. Ambiance */}
          <div className="rounded-2xl border border-restro-border-green bg-restro-card-bg p-4 flex flex-col justify-between shadow-sm hover:border-amber-500/50 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider line-clamp-1">
                {t("feedback.ambiance", "Ambiance")}
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
                <IconSparkles size={18} stroke={iconStroke} />
              </div>
            </div>
            <div className="my-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-gray-900 dark:text-gray-50">
                  {state.ambianceRating > 0 ? state.ambianceRating.toFixed(1) : "—"}
                </span>
                <span className="text-xs text-gray-400">/ 5.0</span>
              </div>
              <div className="mt-1">{renderStars(state.ambianceRating, 14)}</div>
            </div>
            <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="text-base">{getRatingMeta(state.ambianceRating).emoji}</span>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 line-clamp-1">
                {getRatingMeta(state.ambianceRating).text}
              </span>
            </div>
          </div>

          {/* 5. Recommendation */}
          <div className="rounded-2xl border border-restro-border-green bg-restro-card-bg p-4 flex flex-col justify-between shadow-sm hover:border-rose-500/50 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider line-clamp-1">
                {t("feedback.recommend", "Would Recommend?")}
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
                <IconThumbUp size={18} stroke={iconStroke} />
              </div>
            </div>
            <div className="my-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-gray-900 dark:text-gray-50">
                  {state.recommendRating > 0 ? state.recommendRating.toFixed(1) : "—"}
                </span>
                <span className="text-xs text-gray-400">/ 5.0</span>
              </div>
              <div className="mt-1">{renderStars(state.recommendRating, 14)}</div>
            </div>
            <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="text-base">{getRatingMeta(state.recommendRating).emoji}</span>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 line-clamp-1">
                {getRatingMeta(state.recommendRating).text}
              </span>
            </div>
          </div>

          {/* 6. Overall Summary */}
          <div className="rounded-2xl border border-restro-border-green bg-restro-card-bg p-4 flex flex-col justify-between shadow-sm hover:border-emerald-500/50 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider line-clamp-1">
                {t("feedback.average_rating", "Overall Average")}
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
                <IconStarFilled size={18} />
              </div>
            </div>
            <div className="my-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-gray-900 dark:text-gray-50">
                  {state.averageRating > 0 ? state.averageRating.toFixed(1) : "—"}
                </span>
                <span className="text-xs text-gray-400">/ 5.0</span>
              </div>
              <div className="mt-1">{renderStars(state.averageRating, 14)}</div>
            </div>
            <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="text-base">{getRatingMeta(state.averageRating).emoji}</span>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 line-clamp-1">
                {getRatingMeta(state.averageRating).text}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Enterprise Multi-Branch Comparison (when consolidated) */}
      {isConsolidated && state.businesses?.length > 0 && (
        <div className="rounded-2xl border border-restro-border-green bg-restro-card-bg p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <IconBuildingStore size={20} stroke={iconStroke} className="text-restro-green" />
              <h3 className="font-bold text-gray-900 dark:text-gray-100">
                {t("feedback.branch_performance", "Branch Performance")}
              </h3>
            </div>
            <span className="text-xs text-gray-500">
              {state.businesses.length} {t("business_switcher.businesses", "Branches")}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {state.businesses.map((b) => {
              const bAvg = b.averageRating != null ? Number(b.averageRating) : null;
              const meta = getRatingMeta(bAvg);
              return (
                <div
                  key={b.tenantId}
                  className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                      {b.business}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-mono">
                      {b.totalReviews}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {bAvg != null ? bAvg.toFixed(1) : "—"}
                      </span>
                      {bAvg != null && <IconStarFilled size={15} className="text-amber-400" />}
                    </div>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <span>{meta.emoji}</span> {meta.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Filter Toolbar & Search */}
      <div className="rounded-2xl border border-restro-border-green bg-restro-card-bg p-3 shadow-sm space-y-3">
        {/* Date presets & Quick rating filter chips */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Preset Date Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {filters.map((f) => {
              const active = state.activeFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => btnSelectDateFilter(f.key)}
                  className={clsx(
                    "min-h-[42px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition active:scale-95 whitespace-nowrap",
                    active
                      ? "bg-restro-green text-white shadow-sm"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  )}
                >
                  {f.value}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2">
            <div className="flex-1 md:w-72 min-h-[42px] px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center gap-2 focus-within:ring-2 focus-within:ring-restro-green">
              <IconSearch size={18} className="text-gray-400 shrink-0" />
              <input
                ref={searchRef}
                defaultValue={state.search}
                type="text"
                placeholder={t("feedback.search_placeholder", "Search customer, phone, invoice...")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") btnSearch();
                }}
                className="w-full bg-transparent text-sm placeholder:text-gray-400 outline-none text-gray-900 dark:text-gray-100"
              />
              {state.search && (
                <button
                  type="button"
                  onClick={btnClearSearch}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <IconX size={16} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={btnSearch}
              className="min-h-[42px] px-4 py-2 rounded-xl text-sm font-medium text-white bg-restro-green hover:bg-restro-green-button-hover transition active:scale-95 shadow-sm"
            >
              {t("feedback.search_button", "Search")}
            </button>
          </div>
        </div>

        {/* Rating Filter Tabs (All, 5, 4, 3, 2, 1 stars) */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-gray-400 mr-1 font-medium">
              {t("feedback.rating", "Rating")}:
            </span>
            <button
              type="button"
              onClick={() => setState((prev) => ({ ...prev, ratingFilter: null, page: 1 }))}
              className={clsx(
                "min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium transition active:scale-95",
                state.ratingFilter === null
                  ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
              )}
            >
              {t("feedback.all", "All")} ({state.data.length})
            </button>

            {[5, 4, 3, 2, 1].map((s) => {
              const active = state.ratingFilter === s;
              const meta = getRatingMeta(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      ratingFilter: prev.ratingFilter === s ? null : s,
                      page: 1,
                    }))
                  }
                  className={clsx(
                    "min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition active:scale-95",
                    active
                      ? "ring-2 ring-restro-green bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                  )}
                >
                  <span>{s}</span>
                  <IconStarFilled size={13} className="text-amber-400" />
                  <span>{meta.emoji}</span>
                </button>
              );
            })}
          </div>

          {/* Active filter summary pill */}
          {(state.ratingFilter !== null || state.search) && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">
                {t("feedback.showing_page", {
                  from: paginatedFeedbacks.length > 0 ? (state.page - 1) * pageSize + 1 : 0,
                  to: Math.min(state.page * pageSize, filteredFeedbacks.length),
                  total: filteredFeedbacks.length,
                })}
              </span>
              <button
                type="button"
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    ratingFilter: null,
                    search: "",
                    page: 1,
                  }))
                }
                className="text-restro-green font-semibold hover:underline"
              >
                {t("feedback.clear_filter", "Reset")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5. Reviews Table & Feed */}
      <div className="rounded-2xl border border-restro-border-green bg-restro-card-bg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {isConsolidated && (
                  <th className="py-3 px-4 w-36">{t("business_switcher.business", "Business")}</th>
                )}
                <th className="py-3 px-4 w-32">{t("feedback.date", "Date")}</th>
                <th className="py-3 px-4 w-48">{t("feedback.customer", "Customer")}</th>
                <th className="py-3 px-4 w-36">{t("feedback.phone", "Phone")}</th>
                <th className="py-3 px-4 w-28">{t("feedback.invoice", "Invoice")}</th>
                <th className="py-3 px-4 w-44">{t("feedback.overall_feedback", "Overall Rating")}</th>
                <th className="py-3 px-4">{t("feedback.remarks", "Remarks")}</th>
                <th className="py-3 px-4 text-center w-24">{t("feedback.action", "Action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              {paginatedFeedbacks.length === 0 ? (
                <tr>
                  <td
                    colSpan={isConsolidated ? 8 : 7}
                    className="py-14 text-center text-gray-400 dark:text-gray-500"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                        <IconMessageHeart size={32} stroke={1.5} />
                      </div>
                      <p className="font-semibold text-base text-gray-700 dark:text-gray-300">
                        {t("feedback.no_feedbacks", "No customer feedback found")}
                      </p>
                      <p className="text-xs text-gray-500 max-w-sm">
                        {t(
                          "feedback.empty_hint",
                          "Customer feedback will appear here once guests complete reviews via QR code or receipts."
                        )}
                      </p>
                      {(state.ratingFilter !== null || state.search) && (
                        <button
                          type="button"
                          onClick={() =>
                            setState((prev) => ({
                              ...prev,
                              ratingFilter: null,
                              search: "",
                              page: 1,
                            }))
                          }
                          className="mt-2 px-4 py-2 rounded-xl text-xs font-medium text-restro-green border border-restro-border-green hover:bg-emerald-50 dark:hover:bg-emerald-950/20 active:scale-95 transition"
                        >
                          {t("feedback.clear_filter", "Clear Filters")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedFeedbacks.map((item, index) => {
                  const {
                    date,
                    phone,
                    name,
                    invoice_id,
                    remarks,
                    average_rating,
                    business,
                  } = item;
                  const meta = getRatingMeta(average_rating);
                  const customerName = name || t("feedback.anonymous", "Guest Customer");
                  const initials = customerName.slice(0, 2).toUpperCase();

                  return (
                    <tr
                      key={item.id || index}
                      className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition group"
                    >
                      {/* Business column if enterprise */}
                      {isConsolidated && (
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 truncate max-w-[130px]">
                            {business || "—"}
                          </span>
                        </td>
                      )}

                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-1.5">
                          <IconCalendar size={14} className="text-gray-400" />
                          <span>{date ? new Date(date).toLocaleDateString() : "—"}</span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 flex items-center justify-center font-bold text-xs shrink-0">
                            {initials}
                          </div>
                          <span className="font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
                            {customerName}
                          </span>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-600 dark:text-gray-300">
                        {phone ? (
                          <div className="flex items-center gap-1">
                            <span>{phone}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(phone, t("feedback.phone"))}
                              title="Copy Phone"
                              className="text-gray-400 hover:text-restro-green opacity-0 group-hover:opacity-100 transition p-1"
                            >
                              <IconCopy size={13} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Invoice */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {invoice_id ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                            <IconReceipt size={13} className="text-gray-400" />
                            #{invoice_id}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Rating Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div
                          className={clsx(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border",
                            meta.badgeClass
                          )}
                        >
                          <IconStarFilled size={13} className="text-amber-400" />
                          <span>{Number(average_rating || 0).toFixed(1)}</span>
                          <span>{meta.emoji}</span>
                          <span className="hidden sm:inline">{meta.text}</span>
                        </div>
                      </td>

                      {/* Remarks */}
                      <td className="py-3 px-4">
                        {remarks ? (
                          <p
                            className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 italic"
                            title={remarks}
                          >
                            “{remarks}”
                          </p>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {t("feedback.no_remarks", "No written remarks")}
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => btnView(item)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-restro-green font-medium text-xs flex items-center justify-center gap-1 transition active:scale-95 shadow-xs mx-auto"
                        >
                          <IconEye size={15} stroke={iconStroke} />
                          <span>{t("feedback.view_button", "View")}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredFeedbacks.length > pageSize && (
          <div className="p-3.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2 text-xs text-gray-500">
            <div>
              {t("feedback.showing_page", {
                from: (state.page - 1) * pageSize + 1,
                to: Math.min(state.page * pageSize, filteredFeedbacks.length),
                total: filteredFeedbacks.length,
              })}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={state.page <= 1}
                onClick={() => setState((prev) => ({ ...prev, page: prev.page - 1 }))}
                className="min-h-[38px] min-w-[38px] px-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-50 active:scale-95 transition"
              >
                <IconChevronLeft size={16} />
              </button>

              <div className="px-3 font-semibold text-gray-700 dark:text-gray-200">
                {state.page} / {totalPages}
              </div>

              <button
                type="button"
                disabled={state.page >= totalPages}
                onClick={() => setState((prev) => ({ ...prev, page: prev.page + 1 }))}
                className="min-h-[38px] min-w-[38px] px-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-50 active:scale-95 transition"
              >
                <IconChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Dialog: Single Feedback Detail View */}
      <dialog id="modal-feedback-view" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box border border-restro-border-green rounded-3xl bg-restro-card-bg p-6 max-w-xl">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 flex items-center justify-center font-bold text-sm">
                {(selectedFeedback?.name || "G").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">
                  {selectedFeedback?.name || t("feedback.anonymous", "Guest Customer")}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedFeedback?.date ? new Date(selectedFeedback.date).toLocaleDateString() : ""}
                  {selectedFeedback?.phone ? ` • ${selectedFeedback.phone}` : ""}
                  {selectedFeedback?.invoice_id ? ` • #${selectedFeedback.invoice_id}` : ""}
                </p>
              </div>
            </div>

            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost text-gray-400 hover:text-gray-700">
                <IconX size={18} stroke={iconStroke} />
              </button>
            </form>
          </div>

          {/* Hero Rating Banner */}
          {selectedFeedback && (
            <div className="mt-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                  {t("feedback.overall_feedback", "Overall Score")}
                </p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-black text-gray-900 dark:text-gray-50">
                    {Number(selectedFeedback.average_rating || 0).toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-400">/ 5.0</span>
                </div>
                <div className="mt-1">{renderStars(selectedFeedback.average_rating, 16)}</div>
              </div>

              <div
                className={clsx(
                  "px-3.5 py-2 rounded-2xl border flex items-center gap-2",
                  getRatingMeta(selectedFeedback.average_rating).badgeClass
                )}
              >
                <span className="text-2xl">
                  {getRatingMeta(selectedFeedback.average_rating).emoji}
                </span>
                <span className="font-bold text-sm">
                  {getRatingMeta(selectedFeedback.average_rating).text}
                </span>
              </div>
            </div>
          )}

          {/* Customer written remarks */}
          {selectedFeedback?.remarks && (
            <div className="mt-4 p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                {t("feedback.customer_comment", "Customer Comment")}
              </p>
              <p className="text-sm text-gray-800 dark:text-gray-200 italic leading-relaxed">
                “{selectedFeedback.remarks}”
              </p>
            </div>
          )}

          {/* Category Dimensions Breakdown */}
          <div className="mt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">
              {t("feedback.dimension_breakdown", "Category Breakdown")}
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Food */}
              <div className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 block">{t("feedback.food_quality")}</span>
                  <div className="mt-1">{renderStars(selectedFeedback?.food_quality_rating, 13)}</div>
                </div>
                <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {selectedFeedback?.food_quality_rating || "—"}
                </span>
              </div>

              {/* Service */}
              <div className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 block">{t("feedback.service")}</span>
                  <div className="mt-1">{renderStars(selectedFeedback?.service_rating, 13)}</div>
                </div>
                <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {selectedFeedback?.service_rating || "—"}
                </span>
              </div>

              {/* Staff */}
              <div className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 block">{t("feedback.staff_behavior")}</span>
                  <div className="mt-1">{renderStars(selectedFeedback?.staff_behavior_rating, 13)}</div>
                </div>
                <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {selectedFeedback?.staff_behavior_rating || "—"}
                </span>
              </div>

              {/* Ambiance */}
              <div className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 block">{t("feedback.ambiance")}</span>
                  <div className="mt-1">{renderStars(selectedFeedback?.ambiance_rating, 13)}</div>
                </div>
                <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {selectedFeedback?.ambiance_rating || "—"}
                </span>
              </div>

              {/* Recommend */}
              <div className="col-span-2 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 block">{t("feedback.recommend")}</span>
                  <div className="mt-1">{renderStars(selectedFeedback?.recommend_rating, 13)}</div>
                </div>
                <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {selectedFeedback?.recommend_rating || "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="modal-action mt-5">
            <form method="dialog" className="w-full">
              <button className="min-h-[42px] w-full rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold text-sm transition active:scale-95">
                {t("feedback.close", "Close")}
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* 7. Dialog: Share / QR Code for Feedback */}
      <dialog id="modal-feedback-qr" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box border border-restro-border-green rounded-3xl bg-restro-card-bg p-6 max-w-md text-center">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <IconQrcode size={22} className="text-restro-green" />
              <span>{t("feedback.qr_modal_title", "Customer Feedback QR")}</span>
            </h3>
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost text-gray-400">
                <IconX size={18} stroke={iconStroke} />
              </button>
            </form>
          </div>

          <p className="text-xs text-gray-500 mt-2 text-left leading-relaxed">
            {t(
              "feedback.qr_modal_description",
              "Display or print this QR code on dining tables or receipts so guests can rate their dining experience."
            )}
          </p>

          {/* QR Image Box */}
          <div className="my-5 p-4 bg-white rounded-2xl border border-gray-200 inline-block shadow-sm">
            {qrCodeDataUrl ? (
              <img
                src={qrCodeDataUrl}
                alt="Feedback QR"
                className="w-48 h-48 mx-auto object-contain"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-gray-400">
                <span className="loading loading-spinner loading-md text-restro-green" />
              </div>
            )}
          </div>

          {/* Link display & Copy */}
          <div className="flex items-center gap-2 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs">
            <input
              type="text"
              readOnly
              value={feedbackShareLink}
              className="bg-transparent flex-1 outline-none text-gray-600 dark:text-gray-300 font-mono select-all truncate"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(feedbackShareLink, t("feedback.copy_link"))}
              className="px-3 py-1.5 rounded-lg bg-restro-green text-white font-medium hover:bg-restro-green-button-hover active:scale-95 transition flex items-center gap-1 shrink-0"
            >
              <IconCopy size={14} />
              <span>{t("feedback.copy_link", "Copy")}</span>
            </button>
          </div>

          <div className="modal-action mt-4">
            {qrCodeDataUrl && (
              <a
                href={qrCodeDataUrl}
                download="Feedback_QRCode.png"
                className="min-h-[42px] px-4 py-2 rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-gray-100 text-sm font-semibold flex items-center justify-center gap-1.5 flex-1 transition active:scale-95"
              >
                <IconDownload size={16} />
                <span>{t("feedback.download_qr", "Download QR")}</span>
              </a>
            )}
            <form method="dialog" className="flex-1">
              <button className="min-h-[42px] w-full rounded-xl bg-gray-200 dark:bg-gray-700 text-sm font-semibold hover:bg-gray-300 text-gray-800 dark:text-gray-200 transition active:scale-95">
                {t("feedback.close", "Close")}
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* 8. Dialog: Scoring Info & Explanations */}
      <dialog id="modal-feedback-info" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box border border-restro-border-green rounded-3xl bg-restro-card-bg p-6 max-w-lg">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <IconInfoCircle size={22} className="text-restro-green" />
              <span>{t("feedback.understand_feedback", "Understanding Ratings")}</span>
            </h3>
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost text-gray-400">
                <IconX size={18} stroke={iconStroke} />
              </button>
            </form>
          </div>

          <div className="mt-4 space-y-2.5">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
              <span className="text-3xl">😍</span>
              <div>
                <p className="font-bold text-sm text-emerald-800 dark:text-emerald-300">
                  {t("feedback.loved_it", "Loved it")} (4.5 – 5.0 ★)
                </p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400">
                  {t("feedback.loved_it_description")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40">
              <span className="text-3xl">😊</span>
              <div>
                <p className="font-bold text-sm text-blue-800 dark:text-blue-300">
                  {t("feedback.good", "Good")} (3.5 – 4.4 ★)
                </p>
                <p className="text-xs text-blue-700/80 dark:text-blue-400">
                  {t("feedback.good_description")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40">
              <span className="text-3xl">😐</span>
              <div>
                <p className="font-bold text-sm text-amber-800 dark:text-amber-300">
                  {t("feedback.average", "Average")} (2.5 – 3.4 ★)
                </p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400">
                  {t("feedback.average_description")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200/60 dark:border-orange-900/40">
              <span className="text-3xl">🙁</span>
              <div>
                <p className="font-bold text-sm text-orange-800 dark:text-orange-300">
                  {t("feedback.bad", "Bad")} (1.5 – 2.4 ★)
                </p>
                <p className="text-xs text-orange-700/80 dark:text-orange-400">
                  {t("feedback.bad_description")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40">
              <span className="text-3xl">😡</span>
              <div>
                <p className="font-bold text-sm text-rose-800 dark:text-rose-300">
                  {t("feedback.worst", "Worst")} (1.0 – 1.4 ★)
                </p>
                <p className="text-xs text-rose-700/80 dark:text-rose-400">
                  {t("feedback.worst_description")}
                </p>
              </div>
            </div>
          </div>

          <div className="modal-action mt-5">
            <form method="dialog" className="w-full">
              <button className="min-h-[42px] w-full rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-800 dark:text-gray-200 font-semibold text-sm transition active:scale-95">
                {t("feedback.close", "Close")}
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* 9. Dialog: Custom Date Filter */}
      <dialog id="filter-dialog" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box border border-restro-border-green rounded-3xl bg-restro-card-bg p-6 max-w-md">
          <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <IconFilter stroke={iconStroke} size={20} className="text-restro-green" />
            <span>{t("feedback.filter_title", "Date Filter")}</span>
          </h3>

          <div className="my-4 space-y-3">
            <div>
              <label className="block text-gray-500 text-xs font-semibold mb-1 uppercase tracking-wider">
                {t("feedback.filter_label", "Filter Preset")}
              </label>
              <select
                className="select select-bordered w-full rounded-xl min-h-[42px]"
                ref={filterTypeRef}
                defaultValue="custom"
              >
                {filters.map((filter, index) => (
                  <option key={index} value={filter.key}>
                    {filter.value}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <div>
                <label className="block text-gray-500 text-xs font-semibold mb-1 uppercase tracking-wider">
                  {t("feedback.from", "From")}
                </label>
                <input
                  defaultValue={defaultDateFrom}
                  type="date"
                  ref={fromDateRef}
                  className="text-sm w-full border rounded-xl px-3 py-2 bg-restro-card-bg border-restro-border-green outline-none min-h-[42px]"
                />
              </div>
              <div>
                <label className="block text-gray-500 text-xs font-semibold mb-1 uppercase tracking-wider">
                  {t("feedback.to", "To")}
                </label>
                <input
                  defaultValue={defaultDateTo}
                  type="date"
                  ref={toDateRef}
                  className="text-sm w-full border rounded-xl px-3 py-2 bg-restro-card-bg border-restro-border-green outline-none min-h-[42px]"
                />
              </div>
            </div>
          </div>

          <div className="modal-action">
            <form method="dialog" className="flex items-center gap-2 w-full">
              <button
                type="button"
                className="min-h-[42px] flex-1 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-200 active:scale-95 transition"
                onClick={btnResetFilter}
              >
                {t("feedback.close", "Reset")}
              </button>
              <button
                type="button"
                onClick={btnApplyFilter}
                className="min-h-[42px] flex-1 rounded-xl bg-restro-green text-white font-semibold text-sm hover:bg-restro-green-button-hover active:scale-95 transition shadow-sm"
              >
                {t("feedback.apply", "Apply")}
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </Page>
  );
}
