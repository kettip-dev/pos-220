import Page from "../components/Page";
import Logo from "../assets/logo.svg";
import LogoDark from "../assets/LogoDark.svg";
import React from "react";
import {
  getStripeSubscriptionURL,
  signOut,
} from "../controllers/auth.controller";
import { toast } from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import AppBarDropdown from "../components/AppBarDropdown";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { useEffect } from "react";
import PricingToggle from "./PriceToggle";
import { useState } from "react";
import PricingCard from "./PriceCard";
import {
  getPlans,
  getUserCountry,
  createPaystackPaymentLink,
} from "../controllers/plans.controller";
import PricingPlans from "./PricingPlans";
import useAuth from "../helpers/useAuth";
import { activatePaymentGateway } from "../controllers/superadmin.controller";

export default function InActiveSubscriptionPage() {
  const { t } = useTranslation();
  const user = getUserDetailsInLocalStorage();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [isYearly, setIsYearly] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [trialDays, setTrialDays] = useState(7);
  const [plans, setPlans] = useState("");
  const [country, setCountry] = useState("");
  const [stripeProductId, setStripeProductId] = useState("");
  const [stripePriceId, setStripePriceId] = useState("");
  const [activePaymentGateway, setActivePaymentGateway] = useState(null);

  useAuth();

  // redirect to dashboard if subscription is active
  useEffect(() => {
    if (user?.is_active == 1) {
      navigate("/dashboard", { replace: true });
    }
  }, [user?.is_active, navigate]);

  const fetchPlans = async () => {
    try {
      setPlanLoading(true);
      const res = await getPlans();
      const plans = res.data.data;
      const gateway = plans[0]?.payment_gateway || null;
      setActivePaymentGateway(gateway);
      setPlanLoading(false);
      setPlans(plans);
    } catch (err) {
      toast.error("Failed to load plans");
    } finally {
      setPlanLoading(false);
    }
  };
  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    const fetchCountry = async () => {
      const res = await getUserCountry();
      setCountry(res.data.result.country);
    };

    fetchCountry();
  }, []);

  const btnSubscribe = async (priceId, trial, days) => {
    toast.loading(t("inactive_subscription.loading_message"));

    const selectedPriceId = priceId || stripePriceId;
    const selectedTrial = trial !== undefined ? trial : isTrial;
    const selectedTrialDays = days !== undefined ? days : trialDays;

    if (!selectedPriceId) {
      toast.dismiss();
      toast.error(t("inactive_subscription.select_plan"));
      return;
    }

    try {
      if (activePaymentGateway === "paystack") {
        const res = await createPaystackPaymentLink(selectedPriceId);
        toast.dismiss();

        const data = res?.data || {};
        const authorizationUrl =
          data.authorization_url || data.data?.authorization_url;

        if (res.status === 200 && authorizationUrl) {
          window.location.href = authorizationUrl;
        } else {
          toast.error(t("error_message"));
        }
      } else {
        // Default / Stripe flow (existing behavior)
        const res = await getStripeSubscriptionURL(
          selectedPriceId,
          selectedTrial,
          selectedTrialDays
        );
        toast.dismiss();

        if (res.status == 200) {
          const data = res.data;
          window.location.href = data.url;
        }
      }
    } catch (error) {
      const message = error?.response?.data?.message || t("error_message");
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  };

  if (planLoading) {
    return <div>{t("inactive_subscription.loading_message")}</div>;
  }

  return (
    <Page className="">
      <div className="flex items-center justify-between px-4 py-3 border-b border-restro-gray">
        <img
          src={theme === "black" ? LogoDark : Logo}
          alt="logo"
          className="h-12 block"
        />
        <AppBarDropdown />
      </div>

      {user.role == "admin" ? (
        <>
          {/* <h3 className="mt-4 text-center">{t("inactive_subscription.no_active_subscription_admin")}</h3>
          <div className="w-full container mx-auto grid grid-cols-1 my-20 gap-10 place-items-center px-6 lg:px-0">
            <div className="rounded-2xl px-8 py-6 border border-restro-border-green flex flex-col w-full lg:w-96">
              <h3 className="text-4xl text-green-700 font-bold text-center">{subscriptionPrice}</h3>
              <h3 className="font-bold text-2xl text-center">{t("inactive_subscription.price_per_month")}</h3>
              <ul className="text-gray-700 dark:text-white mt-6 flex flex-col gap-2 text-start">
                <li>{t("inactive_subscription.features.unlimited_orders")}</li>
                <li>{t("inactive_subscription.features.monthly_renewals")}</li>
                <li>{t("inactive_subscription.features.unlimited_devices")}</li>
                <li>{t("inactive_subscription.features.live_kitchen_orders")}</li>
              </ul>
              <button onClick={btnSubscribe} className="rounded-full bg-restro-green text-white px-4 py-3 transition active:scale-95 hover:bg-restro-green-button-hover mt-6">
                {t("inactive_subscription.subscribe_button")}
              </button>
            </div>
          </div> */}
          <section className="py-10 px-4">
            <div className="max-w-4xl mx-auto text-center">
              <span className="inline-block bg-restro-green-10 text-restro-green text-sm font-semibold px-4 py-1 rounded-full mb-6 uppercase">
                {t("inactive_subscription.billing_plans")}
              </span>
              {/* <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
                Choose the perfect plan for your business. All plans include a 14-day free trial.
              </p> */}
              <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
                {t("inactive_subscription.choose_the_perfect_plan")}
              </p>
            </div>
          </section>

          {/* Pricing Toggle */}
          <PricingPlans
            isYearly={isYearly}
            onToggle={() => setIsYearly(!isYearly)}
            plans={plans}
            setStripePriceId={setStripePriceId}
            setStripeProductId={setStripeProductId}
            setTrialDays={setTrialDays}
            setIsTrial={setIsTrial}
            btnSubscribe={btnSubscribe}
            country={country}
          />


          {/* <PricingToggle
            isYearly={isYearly}
            onToggle={() => setIsYearly(!isYearly)}
          /> */}

          {/* Pricing Cards */}
          {/* <section className="px-4 pb-20">
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
          </section> */}

          {/* Custom Plan */}
          {/* <section className="px-4 pb-20">
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
                  <button className="bg-restro-green text-white px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity whitespace-nowrap">
                    {t("inactive_subscription.contact_sales")}
                  </button>
                </div>
              </div>
            </div>
          </section> */}
        </>
      ) : (
        <div>
          <h3 className="mt-4 text-center">
            {t("inactive_subscription.no_active_subscription_user")}
          </h3>
        </div>
      )}
    </Page>
  );
}
