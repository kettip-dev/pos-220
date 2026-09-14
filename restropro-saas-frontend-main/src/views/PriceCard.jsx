import { IconCheck } from "@tabler/icons-react";
import React from "react";
import { useTranslation } from "react-i18next";

const PricingCard = ({
  plan,
  isYearly,
  setStripePriceId,
  setStripeProductId,
  setTrialDays,
  setIsTrial,
  delay = 0,
  onClick,
  index,
  country,
}) => {
  const getPrice = (frequency) => {
    // 1. Try selected country
    let price = plan.prices.find(
      (p) => p.country === country && p.frequency === frequency,
    );

    // 2. Fallback to default country
    if (!price) {
      price = plan.prices.find(
        (p) => p.is_default && p.frequency === frequency,
      );
    }

    // 3. Final fallback (first available)
    // if (!price) {
    //   price = plan.prices.find(p => p.frequency === frequency);
    // }

    return price;
  };

  const usMonthly = getPrice("monthly");
  const usYearly = getPrice("yearly");
  const { t } = useTranslation();

  // const usMonthly = plan.prices.find(p => p.country === country && p.frequency === "monthly");
  // const usYearly = plan.prices.find(p => p.country === country && p.frequency === "yearly");
  // if yearly price 9999 then monthly price is
  const yearlyPriceInMonth = Math.round(usYearly?.amount / 12);
  const symbol = isYearly ? usYearly?.symbol : usMonthly?.symbol;
  const price = isYearly ? yearlyPriceInMonth : usMonthly?.amount;

  // Calculate effective discounts (ignore 0 / null and compute yearly discount if not provided)
  const computedYearlyDiscount =
    usMonthly && usYearly && usMonthly.amount && usYearly.amount
      ? Math.round((1 - usYearly.amount / (usMonthly.amount * 12)) * 100)
      : null;

  const effectiveYearlyDiscount =
    plan?.yearly_discount && plan.yearly_discount > 0
      ? plan.yearly_discount
      : computedYearlyDiscount && computedYearlyDiscount > 0
        ? computedYearlyDiscount
        : null;

  const effectiveMonthlyDiscount =
    plan?.discount && plan.discount > 0 ? plan.discount : null;

  const discount = isYearly
    ? effectiveYearlyDiscount
    : effectiveMonthlyDiscount;
  const priceId = isYearly
    ? usYearly?.payment_gateway_price_id
    : usMonthly?.payment_gateway_price_id;

  function getOriginalPrice(discountedPrice, discountPercent) {
    // If there is no valid discount, original price is the same as current
    if (!discountPercent || discountPercent <= 0) return discountedPrice;

    return Math.round(discountedPrice / (1 - discountPercent / 100));
  }
  const originalPrice = getOriginalPrice(price, discount);

  return (
    <div
      className={`relative rounded-2xl p-8 transition-all duration-500 hover:-translate-y-2 ${
        plan.is_recommended
          ? "bg-card border-2 border-restro-green popular-shadow scale-105"
          : "bg-card border border-border card-shadow hover:card-shadow-hover"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* {plan.is_recommended ? (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="bg-restro-green text-white text-sm font-semibold px-4 py-1 rounded-full">
            {t("inactive_subscription.most_popular")}
          </span>
        </div>
      ) : (
        ""
      )} */}

      {/* {plan.is_trial ? (
        <div className="absolute top-0 right-2">
          <span className="bg-restro-green text-white text-sm font-semibold px-4 py-1 rounded-b-lg">
            {plan?.trial_days} {t("inactive_subscription.days_free_trial")}
          </span>
        </div>
      ) : (
        ""
      )} */}

      {plan.is_recommended || plan.is_trial ? (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10">
          {plan.is_recommended ? (
            <span className="bg-restro-green text-white text-xs font-semibold px-4 py-1 rounded-full shadow">
              {t("inactive_subscription.most_popular")}
            </span>
          ) : (
            ""
          )}

          {plan.is_trial ? (
            <span className="bg-restro-green text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
              {plan.trial_days} {t("inactive_subscription.days_free_trial")}
            </span>
          ) : (
            ""
          )}
        </div>
      ) : (
        ""
      )}

      <div className="mb-6">
        <h3 className="text-xl font-bold text-foreground mb-2">
          {plan?.title}
        </h3>
        <p className="text-muted-foreground text-sm">{plan?.description}</p>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-foreground">
            {symbol}
            {price}
          </span>
          <span className="text-muted-foreground">
            /{t("inactive_subscription.price_per_month")}
          </span>
        </div>
        {effectiveMonthlyDiscount && !isYearly && originalPrice && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm text-muted-foreground line-through">
              {symbol}
              {originalPrice}
            </span>
            <span className="rounded bg-restro-green-10 px-2 py-0.5 text-xs font-medium text-restro-green">
              {t("inactive_subscription.save")} {effectiveMonthlyDiscount}%
            </span>
          </div>
        )}
        {plan && isYearly && effectiveYearlyDiscount && originalPrice && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm text-muted-foreground line-through">
              {symbol}
              {originalPrice}
            </span>
            <span className="rounded bg-restro-green-10 px-2 py-0.5 text-xs font-medium text-restro-green">
              Save {effectiveYearlyDiscount}%
            </span>
          </div>
        )}
        {/* {isYearly && (
          <p className="text-sm text-accent-foreground mt-1">
            Billed annually (${price * 12}/year)
          </p>
        )} */}
        {isYearly && (
          <p className="text-sm text-accent-foreground mt-1">
            {t("inactive_subscription.billed_annually")} ({symbol}
            {usYearly?.amount}/{t("inactive_subscription.year")})
          </p>
        )}
      </div>

      <button
        className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-300 mb-8 ${
          plan?.is_recommended
            ? "bg-restro-green text-white hover:opacity-90 shadow-lg"
            : "bg-restro-green text-white hover:bg-muted"
        }`}
        onClick={() => {
          setStripePriceId(priceId);
          setIsTrial(plan?.is_trial);
          setTrialDays(plan?.trial_days);
          onClick(priceId, plan?.is_trial, plan?.trial_days);
        }}
      >
        {plan?.is_trial
          ? t("inactive_subscription.start_free_trial")
          : t("inactive_subscription.subscribe")}
      </button>

      <div className="space-y-4">
        <p className="text-sm font-semibold text-foreground">
          {index === 0
            ? t("inactive_subscription.includes_essential_features")
            : t("inactive_subscription.all_features_from_previous_plan")}
        </p>
        <ul className="space-y-3">
          {plan?.features_description?.map((feature, index) => (
            <li key={index} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-restro-green-10 flex items-center justify-center mt-0.5">
                <IconCheck className="w-3 h-3 text-restro-green" />
              </div>
              <span className="text-sm text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default PricingCard;
