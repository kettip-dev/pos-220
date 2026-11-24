import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import {
  IconArrowLeft,
  IconMessage2,
  IconKey,
  IconEye,
  IconEyeOff,
  IconSend,
  IconCheck,
  IconRefresh,
  IconTemplate,
} from "@tabler/icons-react";
import Page from "../../components/Page";
import { iconStroke } from "../../config/config";
import { useSmsSettings, updateSmsSettings, sendTestSms } from "../../controllers/waitlist.controller";

const inputClass =
  "w-full h-[46px] px-4 rounded-2xl bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#59A352] transition-colors";
const labelClass = "block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-300";
const cardClass = "rounded-3xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#252525] p-6 space-y-5 shadow-sm";

/** GSM-7 messages fit 160 chars per SMS; anything else (e.g. Khmer) is UCS-2 at 70. */
const smsParts = (text) => {
  const ucs = /[^\x00-\x7F£¥èéùìòÇØøÅåÄÖÑÜ§¿äöñüà€]/.test(text);
  const per = ucs ? 70 : 160;
  const multi = ucs ? 67 : 153;
  const len = text.length;
  return { len, parts: len <= per ? 1 : Math.ceil(len / multi), ucs };
};

function Toggle({ checked, onChange, label, hint }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full min-h-[52px] items-center justify-between gap-4 rounded-2xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-left active:scale-[0.99]"
    >
      <span>
        <span className="block text-sm font-bold text-slate-900 dark:text-white">{label}</span>
        {hint && <span className="block text-xs text-slate-500 dark:text-gray-400">{hint}</span>}
      </span>
      <span className={clsx("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-[#59A352]" : "bg-gray-300 dark:bg-gray-600")}>
        <span className={clsx("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-6" : "left-1")} />
      </span>
    </button>
  );
}

function TemplateField({ label, value, onChange, t }) {
  const { len, parts, ucs } = smsParts(value || "");
  return (
    <div className="space-y-2">
      <label className={labelClass}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={480}
        className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#59A352]"
      />
      <p className="text-[11px] text-slate-400 dark:text-gray-500">
        {t("sms_settings.length", "{{len}} characters · about {{parts}} SMS each", { len, parts })}
        {ucs ? ` · ${t("sms_settings.unicode_note", "non-English text uses 70 characters per SMS")}` : ""}
      </p>
    </div>
  );
}

export default function SmsSettingsPage() {
  const { t } = useTranslation();
  const { data, isLoading, error, mutate } = useSmsSettings();

  const [isEnabled, setIsEnabled] = useState(false);
  const [privateKey, setPrivateKey] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [sender, setSender] = useState("");
  const [sendOnJoin, setSendOnJoin] = useState(false);
  const [joinTemplate, setJoinTemplate] = useState("");
  const [readyTemplate, setReadyTemplate] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!data) return;
    setIsEnabled(Boolean(data.is_enabled));
    setSender(data.sender || "");
    setSendOnJoin(Boolean(data.send_on_join));
    setJoinTemplate(data.join_template || "");
    setReadyTemplate(data.ready_template || "");
  }, [data]);

  const save = async (e) => {
    e.preventDefault();
    if (isEnabled && (!sender.trim() || (!privateKey && !data?.has_private_key) || (!secret && !data?.has_secret))) {
      toast.error(t("sms_settings.missing", "Enter the private key, secret and sender before turning SMS on"));
      return;
    }
    setSaving(true);
    try {
      await updateSmsSettings({
        is_enabled: isEnabled,
        private_key: privateKey || undefined,
        secret: secret || undefined,
        sender,
        send_on_join: sendOnJoin,
        join_template: joinTemplate,
        ready_template: readyTemplate,
      });
      setPrivateKey("");
      setSecret("");
      await mutate();
      toast.success(t("sms_settings.saved", "SMS settings saved"));
    } catch (err) {
      toast.error(err?.response?.data?.message || t("sms_settings.save_failed", "Could not save SMS settings"));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!testPhone.trim()) {
      toast.error(t("sms_settings.enter_test_phone", "Enter a phone number for the test"));
      return;
    }
    setTesting(true);
    try {
      const res = await sendTestSms({
        phone: testPhone,
        private_key: privateKey || undefined,
        secret: secret || undefined,
        sender: sender || undefined,
      });
      toast.success(res?.message || t("sms_settings.test_sent", "Test SMS sent"));
    } catch (err) {
      toast.error(err?.response?.data?.message || t("sms_settings.test_failed", "Test SMS failed"));
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) {
    return (
      <Page className="p-4 md:p-8 max-w-4xl mx-auto flex items-center justify-center min-h-[400px]">
        <IconRefresh className="w-8 h-8 animate-spin text-[#59A352]" />
      </Page>
    );
  }
  if (error) {
    return (
      <Page className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="p-6 rounded-3xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
          {t("sms_settings.load_failed", "Could not load SMS settings")}
        </div>
      </Page>
    );
  }

  const keyPlaceholder = (isSet) => (isSet ? t("sms_settings.saved_placeholder", "Saved. Leave blank to keep it.") : "");

  return (
    <Page className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard/settings"
          className="w-[42px] h-[42px] rounded-2xl flex items-center justify-center bg-gray-100 dark:bg-[#333] hover:bg-gray-200 dark:hover:bg-[#444] text-slate-600 dark:text-gray-300 active:scale-95 shrink-0"
        >
          <IconArrowLeft stroke={iconStroke} className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-restro-green-dark dark:text-white">{t("sms_settings.title", "SMS for Waitlist")}</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400">
            {t("sms_settings.subtitle", "Text guests when their table is ready, using your own PlasGate account.")}
          </p>
        </div>
      </div>

      <form onSubmit={save} className="space-y-6">
        <div className={cardClass}>
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-[#59A352] flex items-center justify-center shrink-0">
              <IconKey stroke={iconStroke} className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-white">{t("sms_settings.credentials", "PlasGate account")}</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                {t("sms_settings.credentials_hint", "In PlasGate, open SMPP & API → SMS Gateway and copy the Private Key and Secret from the same key pair.")}
              </p>
            </div>
          </div>

          <Toggle
            checked={isEnabled}
            onChange={setIsEnabled}
            label={t("sms_settings.enable", "Send SMS to waitlist guests")}
            hint={t("sms_settings.enable_hint", "Each message is charged to your PlasGate balance.")}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className={labelClass}>{t("sms_settings.private_key", "Private key")}</label>
              <input value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} placeholder={keyPlaceholder(data?.has_private_key)} className={clsx(inputClass, "font-mono")} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>{t("sms_settings.secret", "Secret")}</label>
              <div className="relative flex items-center">
                <input
                  type={showSecret ? "text" : "password"}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={keyPlaceholder(data?.has_secret)}
                  className={clsx(inputClass, "font-mono pr-12")}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowSecret((v) => !v)} className="absolute right-1 flex h-[42px] w-[42px] items-center justify-center text-slate-400">
                  {showSecret ? <IconEyeOff stroke={iconStroke} className="w-5 h-5" /> : <IconEye stroke={iconStroke} className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className={labelClass}>{t("sms_settings.sender", "Sender name or number")}</label>
              <input value={sender} onChange={(e) => setSender(e.target.value)} maxLength={30} placeholder="MyRestaurant" className={inputClass} />
              <p className="text-[11px] text-slate-400 dark:text-gray-500">
                {t("sms_settings.sender_hint", "Must be approved by PlasGate for Cambodian numbers.")}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <input type="tel" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="012 345 678" className={clsx(inputClass, "sm:max-w-xs")} />
            <button
              type="button"
              onClick={test}
              disabled={testing}
              className="flex h-[46px] items-center justify-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 px-4 text-sm font-bold text-slate-700 dark:text-gray-200 hover:border-[#59A352] active:scale-95 disabled:opacity-60"
            >
              {testing ? <IconRefresh className="w-4 h-4 animate-spin" /> : <IconSend stroke={iconStroke} className="w-4 h-4" />}
              {t("sms_settings.send_test", "Send test SMS")}
            </button>
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center shrink-0">
              <IconTemplate stroke={iconStroke} className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-white">{t("sms_settings.messages", "Messages")}</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                {t("sms_settings.placeholders", "You can use {name}, {restaurant}, {position}, {wait}, {party} and {link}.")}
              </p>
            </div>
          </div>

          <TemplateField label={t("sms_settings.ready_template", "Table ready message")} value={readyTemplate} onChange={setReadyTemplate} t={t} />

          <Toggle
            checked={sendOnJoin}
            onChange={setSendOnJoin}
            label={t("sms_settings.send_on_join", "Also text when a guest joins the waitlist")}
            hint={t("sms_settings.send_on_join_hint", "Includes a link so they can follow their place in line.")}
          />
          {sendOnJoin && (
            <TemplateField label={t("sms_settings.join_template", "Joined waitlist message")} value={joinTemplate} onChange={setJoinTemplate} t={t} />
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex h-[48px] items-center gap-2 rounded-2xl bg-[#59A352] px-6 text-sm font-bold text-white hover:bg-[#4a8b44] active:scale-95 disabled:opacity-60"
          >
            {saving ? <IconRefresh className="w-4 h-4 animate-spin" /> : <IconCheck stroke={iconStroke} className="w-4 h-4" />}
            {t("sms_settings.save", "Save")}
          </button>
        </div>
      </form>

      <p className="flex items-center gap-2 text-xs text-slate-400 dark:text-gray-500">
        <IconMessage2 stroke={iconStroke} className="w-4 h-4" />
        {t("sms_settings.privacy", "Your key and secret are stored encrypted and are never shown again after saving.")}
      </p>
    </Page>
  );
}
