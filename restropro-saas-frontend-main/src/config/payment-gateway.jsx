import React from "react";
import { IconCreditCard } from "@tabler/icons-react";
import { iconStroke } from "./config";
import { API } from "./config";
import stipeLogo from "../assets/superadmin/payment-gateway/stripe.webp"
import paystackLogo from "../assets/superadmin/payment-gateway/paystack.webp"
import razorpayLogo from "../assets/superadmin/payment-gateway/razorpay.webp"
import paypalLogo from "../assets/superadmin/payment-gateway/paypal.webp"

// Payment Gateway Image URLs
export const PAYMENT_GATEWAY_IMAGES = {
  stripe:stipeLogo,
  paystack: paystackLogo,
  razorpay:
    razorpayLogo,
  paypal: paypalLogo,
};

// Payment Gateway Base Configuration
export const PAYMENT_GATEWAYS = {
  stripe: {
    id: "stripe",
    name: "stripe",
    displayName: "Stripe",
    iconUrl: PAYMENT_GATEWAY_IMAGES.stripe,
    description: "Accept payments globally with Stripe",
    website: "https://stripe.com",
    supportedCountries: ["Global"],
    supportedCurrencies: ["Global"],
    requiredCredentials: [
      {
        key: "publishable_key",
        label: "Publishable Key",
        type: "text",
        required: true,
        description: "Your Stripe publishable API key (starts with pk_)",
        placeholder: "pk_test_...",
      },
      {
        key: "secret_key",
        label: "Secret Key",
        type: "password",
        required: true,
        description: "Your Stripe secret API key (starts with sk_)",
        placeholder: "sk_test_...",
      },
      {
        key: "webhook_secret",
        label: "Webhook Secret",
        type: "password",
        required: false,
        description: "Your Stripe webhook signing secret (starts with whsec_)",
        placeholder: "whsec_...",
      },
      {
        key: "portal_config_id",
        label: "Portal Config ID",
        type: "text",
        required: false,
        description: "Your Stripe portal config ID",
        placeholder: "Enter your portal config ID...",
      },
    ],
    webhookUrl: `${API}/auth/stripe-webhook`,
    isEnabled: true,
  },
  paystack: {
    id: "paystack",
    name: "paystack",
    displayName: "Paystack",
    iconUrl: PAYMENT_GATEWAY_IMAGES.paystack,
    description: "Accept payments across Africa with Paystack",
    website: "https://paystack.com",
    supportedCountries: ["Nigeria", "Ghana", "South Africa", "Kenya"],
    supportedCurrencies: ["NGN", "GHS", "ZAR", "KES", "USD"],
    requiredCredentials: [
      {
        key: "public_key",
        label: "Public Key",
        type: "text",
        required: true,
        description: "Your Paystack public key",
        placeholder: "pk_test_...",
      },
      {
        key: "secret_key",
        label: "Secret Key",
        type: "password",
        required: true,
        description: "Your Paystack secret key",
        placeholder: "sk_test_...",
      },
    ],
    webhookUrl: `${API}/auth/paystack-webhook`,
    isEnabled: true,
  },
  razorpay: {
    id: "razorpay",
    name: "razorpay",
    displayName: "Razor***",
    iconUrl: PAYMENT_GATEWAY_IMAGES.razorpay,
    description: "Accept payments in India with Raz***",
    website: "https://razxxx.com",
    supportedCountries: ["India"],
    supportedCurrencies: ["INR"],
    requiredCredentials: [
      {
        key: "key_id",
        label: "Key ID",
        type: "text",
        required: true,
        description: "Your Razorpay Key ID",
        placeholder: "rzp_test_...",
      },
      {
        key: "key_secret",
        label: "Key Secret",
        type: "password",
        required: true,
        description: "Your Razorpay Key Secret",
        placeholder: "Enter your key secret",
      },
    ],
    webhookUrl: "/api/webhooks/razorpay",
    isEnabled: false,
  },
};

export const getPaymentGatewayCredentials = (gatewayName) => {
  const gateway = PAYMENT_GATEWAYS[gatewayName];
  if (!gateway) {
    return [];
  }
  return gateway.requiredCredentials;
};

// Get payment gateway by name
export const getPaymentGateway = (gatewayName) => {
  return PAYMENT_GATEWAYS[gatewayName] || null;
};

// Get payment gateway icon URL
export const getPaymentGatewayIconUrl = (gatewayName) => {
  const gateway = PAYMENT_GATEWAYS[gatewayName];
  if (!gateway || !gateway.iconUrl) {
    return null;
  }
  return gateway.iconUrl;
};

// Get payment gateway icon as image element
export const getPaymentGatewayIcon = (gatewayName, size = 32) => {
  const gateway = PAYMENT_GATEWAYS[gatewayName];
  if (!gateway || !gateway.iconUrl) {
    return <IconCreditCard size={size} stroke={iconStroke} />;
  }
  return (
    <img
      src={gateway.iconUrl}
      alt={gateway.displayName}
      className="w-full h-full object-contain"
      style={{ width: size, height: size }}
    />
  );
};

// Get payment gateway display name
export const getPaymentGatewayName = (gatewayName) => {
  const gateway = PAYMENT_GATEWAYS[gatewayName];
  if (!gateway) {
    return gatewayName;
  }
  return gateway.displayName;
};

// Get all payment gateways as array
export const getAllPaymentGateways = () => {
  return Object.values(PAYMENT_GATEWAYS);
};
