import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import {
  IconArrowLeft,
  IconPlus,
  IconPencil,
  IconTrash,
  IconX,
  IconTruckDelivery,
  IconRefresh,
  IconInfoCircle,
} from "@tabler/icons-react";
import Page from "../../components/Page";
import { iconStroke } from "../../config/config";
import { usePaymentTypes } from "../../controllers/settings.controller";
import {
  useDeliveryPlatforms,
  addDeliveryPlatform,
  updateDeliveryPlatform,
  deleteDeliveryPlatform,
  PLATFORM_PRESETS,
  applyMarkup,
} from "../../controllers/delivery_platform.controller";

const inputClass =
  "w-full h-[46px] px-4 rounded-2xl bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#59A352]";
const labelClass = "block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-300 mb-1.5";

export default function DeliveryAppsSettingsPage() {
  const { t } = useTranslation();
  const { data: platforms, isLoading, mutate } = useDeliveryPlatforms();
  const { data: paymentTypesData } = usePaymentTypes();
  const paymentTypes = (Array.isArray(paymentTypesData) ? paymentTypesData : paymentTypesData?.paymentTypes || []).filter(
    (p) => Number(p.is_active) !== 0
  );
  const [editing, setEditing] = useState(null);

  const usedNames = new Set(platforms.map((p) => p.name.toLowerCase()));
  const presets = PLATFORM_PRESETS.filter((p) => !usedNames.has(p.name.toLowerCase()));

  const remove = async (platform) => {
    try {
      const res = await deleteDeliveryPlatform(platform.id);
      toast.success(res?.data?.message || t("delivery_apps.deleted", "Deleted"));
      mutate();
    } catch (err) {
      toast.error(err?.response?.data?.message || t("delivery_apps.error", "Something went wrong"));
    }
  };

  return (
    <Page className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/settings"
            className="w-[42px] h-[42px] rounded-2xl flex items-center justify-center bg-gray-100 dark:bg-[#333] hover:bg-gray-200 dark:hover:bg-[#444] text-slate-600 dark:text-gray-300 active:scale-95 shrink-0"
          >
            <IconArrowLeft stroke={iconStroke} className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-restro-green-dark dark:text-white">{t("delivery_apps.title", "Delivery Apps")}</h1>
            <p className="text-sm text-slate-500 dark:text-gray-400">
              {t("delivery_apps.subtitle", "Take Grab, Foodpanda and other app orders at the POS, with app prices and commission tracking.")}
            </p>
          </div>
        </div>
        <button
          onClick={() => setEditing({})}
          className="flex h-[44px] items-center gap-1.5 rounded-2xl bg-[#59A352] px-4 text-sm font-bold text-white hover:bg-[#4a8b44] active:scale-95"
        >
          <IconPlus size={18} stroke={iconStroke} />
          {t("delivery_apps.add", "Add app")}
        </button>
      </div>

      {presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">{t("delivery_apps.quick_add", "Quick add:")}</span>
          {presets.map((p) => (
            <button
              key={p.name}
              onClick={() => setEditing({ name: p.name, color: p.color, markup_percent: 0, commission_percent: 0 })}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#252525] px-3 text-sm font-semibold active:scale-95"
            >
              <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
              {p.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <IconRefresh className="w-7 h-7 animate-spin text-[#59A352]" />
        </div>
      ) : platforms.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 py-12 text-center">
          <IconTruckDelivery size={40} stroke={1.4} className="mx-auto text-gray-400" />
          <p className="mt-2 font-semibold text-slate-700 dark:text-gray-200">{t("delivery_apps.empty", "No delivery apps yet")}</p>
          <p className="mt-1 text-sm text-slate-500">{t("delivery_apps.empty_hint", "Add the apps you sell on. They appear as an order type on the POS.")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#252525] divide-y divide-gray-100 dark:divide-gray-800">
          {platforms.map((p) => (
            <div key={p.id} className={clsx("flex items-center gap-3 px-4 py-3", !p.is_active && "opacity-60")}>
              <span className="h-10 w-10 shrink-0 rounded-2xl" style={{ background: p.color || "#64748b" }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white truncate">{p.name}</span>
                  {!p.is_active && (
                    <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] font-bold text-gray-500">
                      {t("delivery_apps.off", "Off")}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-gray-400">
                  {t("delivery_apps.summary", "Prices +{{markup}}% · Commission {{commission}}%", {
                    markup: p.markup_percent,
                    commission: p.commission_percent,
                  })}
                  {" · "}
                  {p.payment_type_title || t("delivery_apps.no_payment_type", "No payment type")}
                  {p.order_count > 0 ? ` · ${t("delivery_apps.order_count", "{{n}} orders", { n: p.order_count })}` : ""}
                </div>
              </div>
              <button
                onClick={() => setEditing(p)}
                aria-label={t("delivery_apps.edit", "Edit")}
                className="flex h-[42px] w-[42px] items-center justify-center rounded-xl text-slate-500 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95"
              >
                <IconPencil size={18} stroke={iconStroke} />
              </button>
              <button
                onClick={() => remove(p)}
                aria-label={t("delivery_apps.delete", "Delete")}
                className="flex h-[42px] w-[42px] items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 active:scale-95"
              >
                <IconTrash size={18} stroke={iconStroke} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-gray-400">
        <IconInfoCircle size={16} className="mt-0.5 shrink-0" />
        {t(
          "delivery_apps.manual_note",
          "Orders are entered at the POS by hand: choose Delivery app as the order type, pick the app and type its order code. Automatic import needs partner API access from each app."
        )}
      </p>

      {editing && (
        <PlatformModal
          platform={editing}
          paymentTypes={paymentTypes}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            mutate();
          }}
          t={t}
        />
      )}
    </Page>
  );
}

function PlatformModal({ platform, paymentTypes, onClose, onSaved, t }) {
  const isNew = !platform.id;
  const [name, setName] = useState(platform.name || "");
  const [color, setColor] = useState(platform.color || "#00B14F");
  const [markup, setMarkup] = useState(String(platform.markup_percent ?? 0));
  const [commission, setCommission] = useState(String(platform.commission_percent ?? 0));
  const [paymentTypeId, setPaymentTypeId] = useState(
    platform.payment_type_id
      ? String(platform.payment_type_id)
      : String(paymentTypes.find((p) => p.title.toLowerCase().includes(String(platform.name || "").toLowerCase()) && platform.name)?.id || "")
  );
  const [isActive, setIsActive] = useState(platform.is_active === undefined ? true : Boolean(platform.is_active));
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("delivery_apps.name_required", "Enter the app name"));
      return;
    }
    setSaving(true);
    const payload = {
      name,
      color,
      markupPercent: Number(markup) || 0,
      commissionPercent: Number(commission) || 0,
      paymentTypeId: paymentTypeId ? Number(paymentTypeId) : null,
      isActive,
    };
    try {
      if (isNew) await addDeliveryPlatform(payload);
      else await updateDeliveryPlatform(platform.id, payload);
      toast.success(t("delivery_apps.saved", "Saved"));
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.message || t("delivery_apps.error", "Something went wrong"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#252525] p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            {isNew ? t("delivery_apps.add", "Add app") : t("delivery_apps.edit_title", "Edit {{name}}", { name: platform.name })}
          </h3>
          <button type="button" onClick={onClose} className="flex h-[42px] w-[42px] items-center justify-center rounded-xl text-slate-500 hover:bg-gray-100 dark:hover:bg-gray-800">
            <IconX size={20} />
          </button>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div>
            <label className={labelClass}>{t("delivery_apps.name", "App name")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={inputClass} autoFocus />
          </div>
          <div>
            <label className={labelClass}>{t("delivery_apps.color", "Color")}</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-[46px] w-[60px] rounded-2xl border border-gray-200 dark:border-gray-700 bg-transparent p-1" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t("delivery_apps.markup", "App price markup %")}</label>
            <input type="number" inputMode="decimal" min="0" max="200" step="0.5" value={markup} onChange={(e) => setMarkup(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t("delivery_apps.commission", "App commission %")}</label>
            <input type="number" inputMode="decimal" min="0" max="100" step="0.5" value={commission} onChange={(e) => setCommission(e.target.value)} className={inputClass} />
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-gray-400">
          {t("delivery_apps.markup_example", "Example: a $4.00 item sells for {{price}} on this app.", {
            price: `$${applyMarkup(4, markup).toFixed(2)}`,
          })}
        </p>

        <div>
          <label className={labelClass}>{t("delivery_apps.paid_by", "Paid with payment type")}</label>
          <select value={paymentTypeId} onChange={(e) => setPaymentTypeId(e.target.value)} className={inputClass}>
            <option value="">{t("delivery_apps.choose_at_payment", "Cashier chooses at payment")}</option>
            {paymentTypes.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
            {t("delivery_apps.paid_by_hint", "The app pays you, so add a payment type with the app's name in Payment Types and pick it here. It is selected automatically when charging app orders.")}
          </p>
        </div>

        <label className="flex min-h-[44px] items-center gap-3 text-sm font-semibold text-slate-700 dark:text-gray-200">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-5 w-5 accent-[#59A352]" />
          {t("delivery_apps.active", "Show on the POS")}
        </label>

        <button
          type="submit"
          disabled={saving}
          className="flex h-[48px] w-full items-center justify-center rounded-2xl bg-[#59A352] text-base font-bold text-white hover:bg-[#4a8b44] active:scale-95 disabled:opacity-60"
        >
          {t("delivery_apps.save", "Save")}
        </button>
      </form>
    </div>
  );
}
