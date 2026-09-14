import React, { useEffect, useState } from "react";
import Page from "../../components/Page";
import { Link, useParams } from "react-router-dom";
import { getPlanById } from "../../controllers/plans.controller";
import {
  IconCheck,
  IconCreditCard,
  IconChevronLeft,
  IconPackage,
  IconTag,
  IconCurrencyDollar,
  IconStar,
  IconClock,
  IconArrowLeft,
  IconReceipt,
  IconListCheck,
  IconSparkles,
  IconGlobe,
  IconShield,
  IconTrendingUp,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../contexts/ThemeContext";
import { toast } from "react-hot-toast";
import { clsx } from "clsx";

export default function SuperAdminPlanDetails() {
  const { t } = useTranslation();
  const params = useParams();
  const planId = params.id;
  const { theme } = useTheme();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPlan = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getPlanById(planId);
      setPlan(res.data?.data ?? null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load plan details");
      toast.error(t("superadmin_plan_details.load_failed") || "Failed to load details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, [planId]);

  const isLight = theme === "light";

  if (loading) {
    return (
      <Page className="px-4 py-3 overflow-x-hidden h-full">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="w-10 h-10 border-2 border-restro-green border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground text-restro-text">
            {t("superadmin_plan_details.loading") || "Loading plan details…"}
          </p>
        </div>
      </Page>
    );
  }

  if (error || !plan) {
    return (
      <Page className="px-4 py-3 overflow-x-hidden h-full">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-restro-gray dark:bg-restro-bg-gray flex items-center justify-center">
            <IconPackage className="w-8 h-8 text-muted-foreground text-restro-text" stroke={iconStroke} />
          </div>
          <h3 className="font-semibold text-restro-text">
            {t("superadmin_plan_details.not_found") || "Plan not found"}
          </h3>
          <p className="text-sm text-muted-foreground text-restro-text max-w-sm">
            {error || (t("superadmin_plan_details.load_failed") || "Failed to load plan details.")}
          </p>
          <Link
            to="/superadmin/dashboard/plans"
            className={clsx(
              "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all",
              "bg-restro-green hover:bg-restro-green-button-hover text-white"
            )}
          >
            <IconArrowLeft size={18} stroke={iconStroke} />
            {t("plans")}
          </Link>
        </div>
      </Page>
    );
  }

  const discount = plan.discount ?? plan.dicount ?? 0;
  const yearlyDiscount = plan.yearly_discount ?? 0;
  const prices = plan.prices ?? [];
  const featuresDescription = plan.features_description ?? [];
  const features = plan.features ?? [];

  return (
    <Page className="px-4 py-3 overflow-x-hidden h-full">
      {/* Breadcrumbs */}
      <nav className="breadcrumbs text-sm mb-4">
        <ul>
          <li>
            <Link
              to="/superadmin/dashboard/plans"
              className={isLight ? "text-gray-600 hover:text-restro-green" : "text-gray-400 hover:text-restro-green"}
            >
              {t("plans")}
            </Link>
          </li>
          <li className={isLight ? "text-gray-900" : "text-restro-text"}>{plan.title}</li>
        </ul>
      </nav>

      {/* Hero Section */}
      <div
        className={clsx(
          "relative rounded-[42px] p-8 mb-6 overflow-hidden border border-restro-border-green",
          isLight
            ? "bg-gradient-to-br from-restro-green-10 via-white to-restro-green-10/30"
            : "bg-gradient-to-br from-restro-green/10 via-restro-card-bg to-restro-green/5"
        )}
      >
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex-1">
            <Link
              to="/superadmin/dashboard/plans"
              className={clsx(
                "inline-flex items-center gap-2 text-sm font-medium w-fit rounded-xl px-3 py-2 mb-4 transition-colors",
                isLight
                  ? "text-gray-600 hover:bg-white/60 hover:text-restro-green"
                  : "text-gray-400 hover:bg-restro-gray/50 hover:text-restro-green"
              )}
            >
              <IconChevronLeft size={18} stroke={iconStroke} />
              {t("superadmin_plan_details.back_to_plans") || "Back to plans"}
            </Link>

            <div className="flex items-start gap-4">
              <div
                className={clsx(
                  "w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg",
                  isLight ? "bg-restro-green text-white" : "bg-restro-green text-white"
                )}
              >
                <IconSparkles className="w-8 h-8" stroke={iconStroke} />
              </div>
              <div className="flex-1">
                <h1 className={clsx("text-3xl lg:text-4xl font-black mb-3", isLight ? "text-gray-900" : "text-restro-text")}>
                  {plan.title}
                </h1>
                <div className="flex flex-wrap gap-2">
                  {plan.is_recommended === 1 && (
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-warning/20 text-warning border border-warning/30 shadow-sm">
                      <IconStar className="w-4 h-4 fill-current" stroke={iconStroke} />
                      {t("superadmin_plans.recommended")}
                    </span>
                  )}
                  {plan.is_trial === 1 && (
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-primary/20 text-primary border border-primary/30 shadow-sm">
                      <IconClock className="w-4 h-4" stroke={iconStroke} />
                      {plan.trial_days} {t("superadmin_plans.day")} {t("superadmin_plan_details.trial")}
                    </span>
                  )}
                  {(discount > 0 || yearlyDiscount > 0) && (
                    <span className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold bg-success/20 text-success border border-success/30 shadow-sm">
                      <IconTrendingUp className="w-4 h-4" stroke={iconStroke} />
                      -{discount}% {yearlyDiscount > 0 && `/ -${yearlyDiscount}% ${t("superadmin_plan_details.yearly")}`}
                    </span>
                  )}
                  <span
                    className={clsx(
                      "inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold shadow-sm",
                      plan.is_trial === 1
                        ? "bg-restro-green/20 text-restro-green border border-restro-green/30"
                        : "bg-restro-gray text-muted-foreground border border-restro-border-green"
                    )}
                  >
                    <IconShield className="w-4 h-4" stroke={iconStroke} />
                    {plan.is_trial === 1
                      ? t("superadmin_plan_details.trial")
                      : t("superadmin_plan_details.paid")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan Information Card */}
        <div
          className={clsx(
            "lg:col-span-1 border rounded-[42px] px-6 py-6 border-restro-border-green transition-all hover:shadow-lg",
            isLight ? "bg-white" : "bg-restro-card-bg"
          )}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-restro-green-10 flex items-center justify-center">
              <IconListCheck className="w-6 h-6 text-restro-green" stroke={iconStroke} />
            </div>
            <h2 className={clsx("text-lg font-bold", isLight ? "text-gray-900" : "text-restro-text")}>
              {t("superadmin_plan_details.plan_details")}
            </h2>
          </div>

          <div className="space-y-5">
            <div className="pb-4 border-b border-restro-border-green">
              <p className={clsx("text-xs font-semibold uppercase tracking-wide mb-2", isLight ? "text-gray-500" : "text-gray-400")}>
                {t("superadmin_plan_details.plan_name")}
              </p>
              <p className={clsx("text-base font-semibold", isLight ? "text-gray-900" : "text-restro-text")}>
                {plan.title}
              </p>
            </div>

            <div className="pb-4 border-b border-restro-border-green">
              <p className={clsx("text-xs font-semibold uppercase tracking-wide mb-2", isLight ? "text-gray-500" : "text-gray-400")}>
                {t("superadmin_plan_details.plan_type")}
              </p>
              <p className={clsx("text-base font-semibold", isLight ? "text-gray-900" : "text-restro-text")}>
                {plan.is_trial === 1 ? t("superadmin_plan_details.trial") : t("superadmin_plan_details.paid")}
              </p>
            </div>

            {plan.payment_gateway_product_id && (
              <div className="pb-4 border-b border-restro-border-green">
                <p className={clsx("text-xs font-semibold uppercase tracking-wide mb-2", isLight ? "text-gray-500" : "text-gray-400")}>
                  {t("superadmin_plan_details.stripe_product")}
                </p>
                <p className={clsx("text-sm font-mono break-all", isLight ? "text-gray-700" : "text-restro-text")}>
                  {plan.payment_gateway_product_id}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Features Card */}
        <div
          className={clsx(
            "lg:col-span-1 border rounded-[42px] px-6 py-6 border-restro-border-green transition-all hover:shadow-lg",
            isLight ? "bg-white" : "bg-restro-card-bg"
          )}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-restro-green-10 flex items-center justify-center">
              <IconSparkles className="w-6 h-6 text-restro-green" stroke={iconStroke} />
            </div>
            <h2 className={clsx("text-lg font-bold", isLight ? "text-gray-900" : "text-restro-text")}>
              {t("superadmin_plan_details.features")}
            </h2>
          </div>

          {featuresDescription.length > 0 && (
            <div className="space-y-3 mb-6">
              {featuresDescription.map((f, i) => (
                <div
                  key={i}
                  className={clsx(
                    "flex items-start gap-3 p-3 rounded-xl transition-all",
                    isLight ? "bg-restro-gray/50 hover:bg-restro-gray" : "bg-restro-gray/30 hover:bg-restro-gray/50"
                  )}
                >
                  <IconCheck className="w-5 h-5 text-restro-green flex-shrink-0 mt-0.5" stroke={iconStroke} />
                  <span className={clsx("text-sm font-medium", isLight ? "text-gray-700" : "text-restro-text")}>{f}</span>
                </div>
              ))}
            </div>
          )}

          {features.length > 0 && (
            <div>
              <p className={clsx("text-xs font-semibold uppercase tracking-wide mb-3", isLight ? "text-gray-500" : "text-gray-400")}>
                <IconTag className="w-3.5 h-3.5 inline mr-1" stroke={iconStroke} />
                {t("superadmin_plans.feature_points")}
              </p>
              <div className="flex flex-wrap gap-2">
                {features.map((f, i) => (
                  <span
                    key={i}
                    className={clsx(
                      "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm",
                      isLight
                        ? "bg-restro-green-10 text-restro-green border border-restro-green/20"
                        : "bg-restro-green/20 text-restro-green border border-restro-green/30"
                    )}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pricing Card */}
        <div
          className={clsx(
            "lg:col-span-1 border rounded-[42px] px-6 py-6 border-restro-border-green transition-all hover:shadow-lg",
            isLight ? "bg-white" : "bg-restro-card-bg"
          )}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-restro-green-10 flex items-center justify-center">
              <IconReceipt className="w-6 h-6 text-restro-green" stroke={iconStroke} />
            </div>
            <h2 className={clsx("text-lg font-bold", isLight ? "text-gray-900" : "text-restro-text")}>
              {t("superadmin_plan_details.pricing")}
            </h2>
          </div>

          {prices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 rounded-2xl bg-restro-gray/50 dark:bg-restro-gray/20 border border-restro-border-green">
              <IconCurrencyDollar className="w-12 h-12 text-muted-foreground mb-3" stroke={iconStroke} />
              <p className={clsx("text-sm font-medium", isLight ? "text-gray-600" : "text-gray-400")}>
                {t("superadmin_plan_details.no_pricing") || "No pricing configured"}
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {prices.map((price, idx) => {
                const symbol = price.symbol ?? price.currency ?? "";
                const country = price.country ?? "";
                const hasMonthly = price.monthly != null && price.monthly !== "";
                const hasYearly = price.yearly != null && price.yearly !== "";
                const hasAmountFrequency = price.amount != null && price.frequency;
                const key = price.price_id ?? `${country}-${idx}`;

                return (
                  <div
                    key={key}
                    className={clsx(
                      "border rounded-xl p-4 transition-all",
                      isLight
                        ? "bg-restro-gray/50 border-restro-border-green hover:bg-restro-gray hover:shadow-md"
                        : "bg-restro-gray/30 border-restro-border-green hover:bg-restro-gray/50 hover:shadow-md"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <IconGlobe className="w-4 h-4 text-restro-green flex-shrink-0" stroke={iconStroke} />
                          <p className={clsx("font-bold text-sm", isLight ? "text-gray-900" : "text-restro-text")}>
                            {country || t("superadmin_plan_details.pricing")}
                          </p>
                        </div>
                        {hasAmountFrequency ? (
                          <p className={clsx("text-sm ml-6", isLight ? "text-gray-600" : "text-gray-400")}>
                            {price.currency} {price.amount} / {price.frequency}
                          </p>
                        ) : (
                          <div className={clsx("text-sm ml-6 space-y-1", isLight ? "text-gray-600" : "text-gray-400")}>
                            {hasMonthly && (
                              <p className="flex items-center gap-2">
                                <span className="font-semibold">{symbol} {price.monthly}</span>
                                <span className="text-xs">/ {t("superadmin_plan_details.monthly")}</span>
                              </p>
                            )}
                            {hasYearly && (
                              <p className="flex items-center gap-2">
                                <span className="font-semibold">{symbol} {price.yearly}</span>
                                <span className="text-xs">/ {t("superadmin_plan_details.yearly")}</span>
                              </p>
                            )}
                            {!hasMonthly && !hasYearly && <p>—</p>}
                          </div>
                        )}
                      </div>
                      {price.is_active === 1 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-restro-green-10 text-restro-green flex-shrink-0">
                          <IconCheck className="w-3 h-3" stroke={iconStroke} />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
