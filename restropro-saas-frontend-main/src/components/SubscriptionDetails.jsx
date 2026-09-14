import { IconCreditCard } from "@tabler/icons-react";
import React from "react";
import { iconStroke } from "../config/config";
import { cancelSubscription, useSubscriptionDetails } from "../controllers/auth.controller";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { getManageSubscriptionLink, getPaystackManageSubscriptionLink } from "../controllers/plans.controller";

export default function SubscriptionDetails() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { error, isLoading, data } = useSubscriptionDetails();
  const { theme } = useTheme();

  if(isLoading) {
    return <div>{t("toast.please_wait")}</div>
  }

  if(error) {
    console.error(error);
    return <div>{t("toast.something_went_wrong")}</div>
  }  

  const btnCancelSubscription = async () => {
    const subscriptionId = data?.subscription_id;
    const paymentGateway = data?.payment_gateway;

    const isConfirm = data?.isTrialPlan
      ? window.confirm(t("subscription.cancel_confirm"))
      : window.confirm(
          `Do you want to cancel this plan? You’ll retain access until ${String(
            data?.subscription_end
          ).substring(
            0,
            10
          )}, after which your subscription will end and you won't be charged further.`
        );

    if (!isConfirm) {
      return;
    }

    try {
      toast.loading(t("toast.please_wait"));

      if (paymentGateway == "paystack") {
        if (!subscriptionId) {
          toast.dismiss();
          toast.error(t("toast.something_went_wrong"));
          return;
        }

        const res = await getPaystackManageSubscriptionLink(subscriptionId);

        if (res.status === 200 && res.data?.url) {
          toast.dismiss();
          window.location.href = res.data.url;
        } else {
          toast.dismiss();
          toast.error(t("toast.something_went_wrong"));
        }

        return;
      }

      // Default (e.g. Stripe) – call cancel subscription API
      const res = await cancelSubscription(subscriptionId);
      if (res.status === 200) {
        toast.dismiss();
        toast.success(t("subscription.cancel_success"));
        data?.isTrialPlan && navigate("/dashboard/inactive-subscription");
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message || t("subscription.cancel_error");
      toast.dismiss();
      toast.error(message);
    }
  };

  const btnManageSubscription = async () => {
    const paymentGateway = data?.payment_gateway;
    const paymentCustomerId = data?.payment_customer_id;

    if (!paymentCustomerId) {
      toast.error(t("toast.something_went_wrong"));
      return;
    }

    try {
      toast.loading(t("toast.please_wait"));
      const res =
        paymentGateway === "paystack"
          ? await getPaystackManageSubscriptionLink(paymentCustomerId)
          : await getManageSubscriptionLink(paymentCustomerId);

      if (res.status === 200 && res.data?.url) {
        toast.dismiss();
        window.location.href = res.data.url;
      } else {
        toast.dismiss();
        toast.error(t("toast.something_went_wrong"));
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message || t("subscription.cancel_error");
      toast.dismiss();
      toast.error(message);
    }
  };

  return (
    <div className="w-full md:w-96 rounded-3xl border border-restro-border-green px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 flex items-center justify-center rounded-2xl bg-restro-green text-white">
          <IconCreditCard stroke={iconStroke} />
        </div>
        <p>{t("subscription.details")}</p>
      </div>
      {data?.is_active && data?.status != "cancelAtPeriodEnd" ? (
        <div>
          <p className="mt-4">
            {t("subscription.status")}: {t("subscription.active")} {(!data?.payment_customer_id && !data?.subscription_id) ? "(Admin / Lifetime Access)" : ""}
          </p>

          {data?.subscription_end && (
            <p className="mt-2 text-sm">
              {t("subscription.renews_at")}: {String(data?.subscription_end).substring(0,10)}
            </p>
          )}

          {(!data?.payment_customer_id && !data?.subscription_id) ? (
            <p className="mt-3 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 p-3 rounded-xl">
              Full feature access has been activated by Super Admin.
            </p>
          ) : (
            <>
              <button 
                onClick={btnCancelSubscription}
                className="w-full block mt-4 bg-red-50 text-red-500 px-4 py-2 rounded-2xl transition hover:bg-red-100 active:scale-95 text-sm"
              >
                {t("subscription.cancel_subscription")}
              </button>
              <button 
                onClick={btnManageSubscription}
                className="w-full block mt-4 bg-restro-green-10 text-restro-green px-4 py-2 rounded-2xl transition hover:bg-restro-green-10 active:scale-95 text-sm"
              >
                {t("Manage Subscription")}
              </button>
            </>
          )}
        </div>
      ) : (
         data?.isTrialPlan == 0 && (
          <p className="mt-4">
            Your subscription has been canceled. You'll continue to have access until{" "}
            {String(data?.subscription_end).substring(0, 10)}.
          </p>

          //show manage subscription button ?
        )
      )
    } 
    </div>
  );
}
