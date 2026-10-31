import React from "react";
import {
  IconBrandPaypal,
  IconBuildingBank,
  IconCash,
  IconCreditCard,
  IconDeviceIpad,
  IconDeviceMobile,
  IconDiscount,
  IconGift,
  IconCoffee,
  IconCoins,
  IconQrcode,
  IconReceipt,
  IconStar,
  IconWallet,
} from "@tabler/icons-react";
import { iconStroke } from "./config";

export const PAYMENT_ICONS = {
  cash: <IconCash stroke={iconStroke} />,
  card: <IconCreditCard stroke={iconStroke} />,
  wallet: <IconWallet stroke={iconStroke} />,
  paypal: <IconBrandPaypal stroke={iconStroke} />,
  qrcode: <IconQrcode stroke={iconStroke} />,
  reader: <IconDeviceIpad stroke={iconStroke} />,
  bank: <IconBuildingBank stroke={iconStroke} />,
  discount: <IconDiscount stroke={iconStroke} />,
  mobile: <IconDeviceMobile stroke={iconStroke} />,
  coffee: <IconCoffee stroke={iconStroke} />,
  gift: <IconGift stroke={iconStroke} />,
  star: <IconStar stroke={iconStroke} />,
  coins: <IconCoins stroke={iconStroke} />,
  receipt: <IconReceipt stroke={iconStroke} />,
};

export const PAYMENT_ICON_OPTIONS = [
  {
    id: "cash",
    label: "Cash / សាច់ប្រាក់",
    Icon: IconCash,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800/50",
    accent: "#10b981",
  },
  {
    id: "card",
    label: "Card / Visa / Mastercard",
    Icon: IconCreditCard,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800/50",
    accent: "#3b82f6",
  },
  {
    id: "qrcode",
    label: "KHQR / QR Scan",
    Icon: IconQrcode,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200 dark:border-rose-800/50",
    accent: "#f43f5e",
  },
  {
    id: "mobile",
    label: "Mobile / ABA / Wing",
    Icon: IconDeviceMobile,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/40",
    border: "border-cyan-200 dark:border-cyan-800/50",
    accent: "#06b6d4",
  },
  {
    id: "coffee",
    label: "Coffee / Starbucks Card",
    Icon: IconCoffee,
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800/50",
    accent: "#d97706",
  },
  {
    id: "star",
    label: "Rewards / Loyalty Points",
    Icon: IconStar,
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-950/40",
    border: "border-yellow-200 dark:border-yellow-800/50",
    accent: "#eab308",
  },
  {
    id: "gift",
    label: "Gift Card / Voucher",
    Icon: IconGift,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-50 dark:bg-pink-950/40",
    border: "border-pink-200 dark:border-pink-800/50",
    accent: "#ec4899",
  },
  {
    id: "wallet",
    label: "E-Wallet",
    Icon: IconWallet,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    border: "border-violet-200 dark:border-violet-800/50",
    accent: "#8b5cf6",
  },
  {
    id: "bank",
    label: "Bank Transfer",
    Icon: IconBuildingBank,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    border: "border-indigo-200 dark:border-indigo-800/50",
    accent: "#6366f1",
  },
  {
    id: "paypal",
    label: "PayPal",
    Icon: IconBrandPaypal,
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    border: "border-sky-200 dark:border-sky-800/50",
    accent: "#0284c7",
  },
  {
    id: "reader",
    label: "POS Terminal / Reader",
    Icon: IconDeviceIpad,
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/40",
    border: "border-teal-200 dark:border-teal-800/50",
    accent: "#14b8a6",
  },
  {
    id: "coins",
    label: "Coins / Petty Cash",
    Icon: IconCoins,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-200 dark:border-orange-800/50",
    accent: "#f97316",
  },
  {
    id: "receipt",
    label: "Bill / On Tab / Invoice",
    Icon: IconReceipt,
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-100 dark:bg-zinc-800",
    border: "border-slate-200 dark:border-zinc-700",
    accent: "#64748b",
  },
  {
    id: "discount",
    label: "Discount / Comp",
    Icon: IconDiscount,
    color: "text-lime-600 dark:text-lime-400",
    bg: "bg-lime-50 dark:bg-lime-950/40",
    border: "border-lime-200 dark:border-lime-800/50",
    accent: "#84cc16",
  },
];

/**
 * Smart lookup helper for payment icon and metadata.
 * Always returns a valid icon option, even if the icon is null, missing, or unrecognized.
 */
export function getPaymentIconData(iconKey, title = "") {
  if (iconKey) {
    const found = PAYMENT_ICON_OPTIONS.find((item) => item.id === iconKey.toLowerCase().trim());
    if (found) return found;
  }

  // Deduce from title keywords if icon is missing or unmapped
  const lower = (title || "").toLowerCase();
  if (lower.includes("starbucks") || lower.includes("coffee") || lower.includes("cafe")) {
    return PAYMENT_ICON_OPTIONS.find((i) => i.id === "coffee");
  }
  if (lower.includes("cash") || lower.includes("usd") || lower.includes("khr") || lower.includes("ប្រាក់") || lower.includes("លុយ")) {
    return PAYMENT_ICON_OPTIONS.find((i) => i.id === "cash");
  }
  if (lower.includes("khqr") || lower.includes("qr") || lower.includes("scan")) {
    return PAYMENT_ICON_OPTIONS.find((i) => i.id === "qrcode");
  }
  if (lower.includes("aba") || lower.includes("mobile") || lower.includes("wing") || lower.includes("acleda") || lower.includes("bakong") || lower.includes("pay")) {
    return PAYMENT_ICON_OPTIONS.find((i) => i.id === "mobile");
  }
  if (lower.includes("reward") || lower.includes("loyalty") || lower.includes("point")) {
    return PAYMENT_ICON_OPTIONS.find((i) => i.id === "star");
  }
  if (lower.includes("gift") || lower.includes("voucher")) {
    return PAYMENT_ICON_OPTIONS.find((i) => i.id === "gift");
  }
  if (lower.includes("bank") || lower.includes("transfer")) {
    return PAYMENT_ICON_OPTIONS.find((i) => i.id === "bank");
  }
  if (lower.includes("paypal")) {
    return PAYMENT_ICON_OPTIONS.find((i) => i.id === "paypal");
  }
  if (lower.includes("card") || lower.includes("visa") || lower.includes("master") || lower.includes("credit") || lower.includes("debit")) {
    return PAYMENT_ICON_OPTIONS.find((i) => i.id === "card");
  }

  // Default fallback to card or cash
  return PAYMENT_ICON_OPTIONS.find((i) => i.id === "card") || PAYMENT_ICON_OPTIONS[0];
}
