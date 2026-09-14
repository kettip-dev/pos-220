import React from "react";
import PricingToggle from "./PriceToggle";
import { useTranslation } from "react-i18next";
import PricingCard from "./PriceCard";
import { supportEmail } from "../config/config";

const PricingPlans = ({
  isYearly,
  onToggle,
  plans,
  setStripePriceId,
  setStripeProductId,
  setTrialDays,
  setIsTrial,
  btnSubscribe,
  country,
}) => {
  const { t } = useTranslation();
  return (
    <div className="">
      {/* Pricing Toggle */}
      <PricingToggle isYearly={isYearly} onToggle={onToggle} />

      {/* Pricing Cards */}
      <section className="px-4 pb-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          {plans &&
            plans?.map((plan, index) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                isYearly={isYearly}
                setStripePriceId={setStripePriceId}
                setStripeProductId={setStripeProductId}
                setTrialDays={setTrialDays}
                setIsTrial={setIsTrial}
                delay={index * 100}
                onClick={btnSubscribe}
                index={index}
                country={country}
              />
            ))}
        </div>
      </section>

      {/* Custom Plan */}
      <section className="px-4 pb-10">
        <div className="max-w-4xl mx-auto">
          <div className="bg-card border border-border rounded-2xl p-8 md:p-12 card-shadow">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  {t("inactive_subscription.enterprise")}
                </h3>
                <p className="text-muted-foreground max-w-md">
                  {t("inactive_subscription.need_a_custom_solution")}
                </p>
              </div>
              <button
                className="bg-restro-green text-white px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
                onClick={() => {
                  window.location.href = "mailto:" + supportEmail;
                }}
              >
                {t("inactive_subscription.contact_sales")}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PricingPlans;
