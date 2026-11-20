import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import {
  IconArrowLeft,
  IconBed,
  IconPlugConnected,
  IconRefresh,
  IconCheck,
  IconAlertTriangle,
  IconEye,
  IconEyeOff,
  IconSend,
} from "@tabler/icons-react";
import Page from "../../components/Page";
import { iconStroke } from "../../config/config";
import {
  getPmsSettings,
  savePmsSettings,
  testPmsConnection,
  getPmsSyncQueue,
  retryPmsSyncQueue,
  getUnpostedRoomCharges,
  postRoomChargeForOrder,
} from "../../controllers/pms.controller";

const DEFAULT_URL = "http://host.docker.internal:8000";

const STATUS_STYLES = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  PROCESSING: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  FAILED: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  REJECTED: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  CANCELLED: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

function Toggle({ checked, onChange, label, description }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full min-h-[56px] flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#252525] text-left active:scale-[0.99] transition"
    >
      <span>
        <span className="block text-sm font-bold text-slate-900 dark:text-white">{label}</span>
        {description && <span className="block text-xs text-slate-500 dark:text-gray-400 mt-0.5">{description}</span>}
      </span>
      <span className={clsx("relative w-12 h-7 rounded-full shrink-0 transition-colors", checked ? "bg-[#7C3AED]" : "bg-gray-300 dark:bg-gray-600")}>
        <span className={clsx("absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all", checked ? "left-6" : "left-1")} />
      </span>
    </button>
  );
}

const inputClass =
  "w-full min-h-[44px] px-3 rounded-xl text-sm bg-white dark:bg-[#1f1f1f] text-slate-900 dark:text-white border border-gray-300 dark:border-gray-700 focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 outline-none";

export default function PmsSettingsPage() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [isEnabled, setIsEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_URL);
  const [propertyId, setPropertyId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyHint, setKeyHint] = useState(null);
  const [autoPost, setAutoPost] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [queue, setQueue] = useState([]);
  const [isRetrying, setIsRetrying] = useState(false);

  const [unposted, setUnposted] = useState([]);
  const [postingId, setPostingId] = useState(null);

  const applySettings = (s) => {
    if (!s) return;
    setIsEnabled(Boolean(Number(s.is_enabled)));
    setBaseUrl(s.pms_base_url || DEFAULT_URL);
    setPropertyId(s.pms_property_id || "");
    setAutoPost(s.auto_post_on_settle === undefined ? true : Boolean(Number(s.auto_post_on_settle)));
    setKeyHint(s.has_api_key ? s.api_key_hint : null);
    setApiKey("");
  };

  const loadQueue = async () => {
    try {
      setQueue(await getPmsSyncQueue());
    } catch {
      // the queue list is informational; the form still works without it
    }
  };

  const loadUnposted = async () => {
    try {
      setUnposted(await getUnpostedRoomCharges());
    } catch {
      // informational, like the queue
    }
  };

  const refreshLists = () => Promise.all([loadQueue(), loadUnposted()]);

  const handlePostCharge = async (charge) => {
    setPostingId(charge.id);
    try {
      const res = await postRoomChargeForOrder(charge.id);
      if (res?.queued) {
        toast(t("room_service.charge_queued", "Hotel PMS offline: room charge queued and will be sent automatically."), { duration: 6000 });
      } else {
        toast.success(t("room_service.charge_posted", "Charged to room {{room}}", { room: charge.pms_room_number || "" }));
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || t("room_service.charge_failed", "Room charge was not posted to the hotel."), { duration: 8000 });
    } finally {
      setPostingId(null);
      await refreshLists();
    }
  };

  useEffect(() => {
    (async () => {
      try {
        applySettings(await getPmsSettings());
        await refreshLists();
      } catch (error) {
        setLoadError(error?.response?.data?.message || error.message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const formValues = () => ({
    pms_base_url: baseUrl.trim(),
    pms_property_id: propertyId.trim(),
    pms_api_key: apiKey.trim(),
  });

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testPmsConnection(formValues()));
    } catch (error) {
      setTestResult({ ok: false, message: error?.response?.data?.message || error.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isEnabled && (!baseUrl.trim() || !propertyId.trim() || (!apiKey.trim() && !keyHint))) {
      toast.error(t("pms_settings.missing_fields", "Fill in the PMS address, property ID and API key to turn the integration on."));
      return;
    }
    setIsSaving(true);
    try {
      const saved = await savePmsSettings({ is_enabled: isEnabled, auto_post_on_settle: autoPost, ...formValues() });
      applySettings(saved);
      toast.success(
        isEnabled
          ? t("pms_settings.saved_on", "Saved. Room Service and Charge to Room are now on the POS.")
          : t("pms_settings.saved_off", "Saved. The hotel PMS integration is off.")
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || t("pms_settings.save_failed", "Could not save the settings."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const res = await retryPmsSyncQueue();
      toast.success(t("pms_settings.retry_done", "Sent {{n}} of {{total}} waiting items.", { n: res?.processed || 0, total: res?.total || 0 }));
      await refreshLists();
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message);
    } finally {
      setIsRetrying(false);
    }
  };

  const waitingCount = queue.filter((q) => q.status === "PENDING" || q.status === "PROCESSING").length;
  const problemCount = queue.filter((q) => q.status === "FAILED" || q.status === "REJECTED").length;

  if (isLoading) {
    return (
      <Page className="p-4 md:p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[400px]">
        <IconRefresh className="w-8 h-8 animate-spin text-[#7C3AED]" />
      </Page>
    );
  }

  if (loadError) {
    return (
      <Page className="p-4 md:p-8 max-w-5xl mx-auto">
        <div className="p-6 rounded-3xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
          <h3 className="font-bold text-lg mb-1">{t("pms_settings.load_failed", "Failed to load settings")}</h3>
          <p className="text-sm">{loadError}</p>
        </div>
      </Page>
    );
  }

  return (
    <Page className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard/settings"
          className="w-[42px] h-[42px] rounded-2xl flex items-center justify-center bg-gray-100 dark:bg-[#333] hover:bg-gray-200 dark:hover:bg-[#444] text-slate-600 dark:text-gray-300 active:scale-95 shrink-0"
          aria-label={t("common.back", "Back")}
        >
          <IconArrowLeft stroke={iconStroke} className="w-5 h-5" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-black text-restro-green-dark dark:text-white">{t("pms_settings.title", "Hotel PMS")}</h1>
            <span
              className={clsx(
                "px-2.5 py-0.5 rounded-full text-xs font-semibold",
                isEnabled ? "bg-[#7C3AED]/10 text-[#7C3AED] dark:text-violet-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
              )}
            >
              {isEnabled ? t("pms_settings.on", "On") : t("pms_settings.off", "Off")}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
            {t("pms_settings.subtitle", "Room Service orders and Charge to Room payments go to the guest's hotel bill.")}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Connection */}
        <section className="lg:col-span-3 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#252525] p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-[#7C3AED] text-white flex items-center justify-center shrink-0">
              <IconBed size={20} stroke={2} />
            </span>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">{t("pms_settings.connection", "Connection")}</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                {t("pms_settings.connection_help", "Create a POS key in the PMS under Settings → Channels, then paste it here.")}
              </p>
            </div>
          </div>

          <Toggle
            checked={isEnabled}
            onChange={setIsEnabled}
            label={t("pms_settings.enable", "Turn on hotel PMS integration")}
            description={t("pms_settings.enable_help", "Shows Room Service on the POS and adds the Charge to Room payment method.")}
          />

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-gray-300">{t("pms_settings.address", "PMS address")}</span>
            <input className={inputClass} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={DEFAULT_URL} autoComplete="off" />
            <span className="block text-[11px] text-slate-500 dark:text-gray-400">
              {t("pms_settings.address_help", "For a PMS on this same computer, use host.docker.internal instead of localhost.")}
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-gray-300">{t("pms_settings.property_id", "Property ID")}</span>
            <input
              className={clsx(inputClass, "font-mono")}
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              placeholder="22222222-2222-2222-2222-222222222222"
              autoComplete="off"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-gray-300">{t("pms_settings.api_key", "POS API key")}</span>
            <div className="relative">
              <input
                className={clsx(inputClass, "font-mono pr-12")}
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={keyHint ? t("pms_settings.key_saved", "Saved ({{hint}}). Leave blank to keep it.", { hint: keyHint }) : "pmspos_..."}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 w-[42px] h-[42px] rounded-xl text-slate-500 flex items-center justify-center active:scale-95"
                aria-label={showKey ? t("pms_settings.hide_key", "Hide key") : t("pms_settings.show_key", "Show key")}
              >
                {showKey ? <IconEyeOff size={18} /> : <IconEye size={18} />}
              </button>
            </div>
          </label>

          {testResult && (
            <div
              className={clsx(
                "flex items-start gap-2 p-3 rounded-xl text-sm font-semibold",
                testResult.ok
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300"
              )}
              role="status"
            >
              {testResult.ok ? <IconCheck size={18} className="shrink-0 mt-0.5" /> : <IconAlertTriangle size={18} className="shrink-0 mt-0.5" />}
              <span>
                {testResult.ok
                  ? t("pms_settings.test_ok", "Connected. {{n}} guests are checked in right now.", { n: testResult.checked_in })
                  : testResult.message}
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting}
              className="min-h-[46px] px-5 rounded-2xl border-2 border-[#7C3AED] text-[#7C3AED] dark:text-violet-300 text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
            >
              <IconPlugConnected size={18} className={clsx(isTesting && "animate-pulse")} />
              {isTesting ? t("pms_settings.testing", "Testing...") : t("pms_settings.test", "Test connection")}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="sm:ml-auto min-h-[46px] px-6 rounded-2xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
            >
              <IconCheck size={18} />
              {isSaving ? t("pms_settings.saving", "Saving...") : t("pms_settings.save", "Save settings")}
            </button>
          </div>
        </section>

        {/* Posting */}
        <section className="lg:col-span-2 space-y-4">
          <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#252525] p-5 space-y-4">
            <h2 className="font-bold text-slate-900 dark:text-white">{t("pms_settings.posting", "Posting charges")}</h2>
            <Toggle
              checked={autoPost}
              onChange={setAutoPost}
              label={t("pms_settings.auto_post", "Post to the hotel bill when paid")}
              description={t("pms_settings.auto_post_help", "Off: post each charge by hand under Room charges to post.")}
            />
            <ul className="text-xs text-slate-600 dark:text-gray-300 space-y-1.5 list-disc pl-4">
              <li>{t("pms_settings.rule_1", "Only the part of a bill paid with Charge to Room is posted.")}</li>
              <li>{t("pms_settings.rule_2", "The guest must be checked in and allowed to charge; the hotel's charge limit is checked before payment.")}</li>
              <li>{t("pms_settings.rule_3", "If the PMS is offline, charges wait in the queue and are sent automatically every minute.")}</li>
            </ul>
          </div>
        </section>
      </form>

      {/* Room charges not yet posted (auto-post off, or refused by the hotel) */}
      <section className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#252525] p-5 space-y-4">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white">{t("pms_settings.unposted", "Room charges to post")}</h2>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            {t("pms_settings.unposted_help", "Paid room service bills from the last 30 days that are not on the hotel bill yet.")}
          </p>
        </div>

        {unposted.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-gray-400 py-4 text-center">
            {t("pms_settings.unposted_empty", "Every room charge has been posted.")}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {unposted.map((c) => (
              <li key={c.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[180px]">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    #{c.id} · {t("pms_settings.room", "Room {{room}}", { room: c.pms_room_number || "—" })}
                    {c.pms_sync_status === "FAILED" && (
                      <span className={clsx("ml-2 px-2 py-0.5 rounded-full text-[11px] font-bold", STATUS_STYLES.REJECTED)}>
                        {t("pms_settings.refused", "Refused")}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    {[c.pms_guest_name, c.date ? new Date(c.date).toLocaleString() : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                  {Number(c.room_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <button
                  type="button"
                  onClick={() => handlePostCharge(c)}
                  disabled={postingId !== null}
                  className="min-h-[46px] px-4 rounded-2xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-bold flex items-center gap-2 active:scale-95 transition disabled:opacity-50"
                >
                  <IconBed size={17} />
                  {postingId === c.id
                    ? t("pms_settings.posting_now", "Posting...")
                    : c.pms_sync_status === "FAILED"
                      ? t("pms_settings.post_again", "Try again")
                      : t("pms_settings.post_to_room", "Post to room")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Queue */}
      <section className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#252525] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h2 className="font-bold text-slate-900 dark:text-white">{t("pms_settings.queue", "Charges waiting for the hotel")}</h2>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              {waitingCount > 0
                ? t("pms_settings.queue_waiting", "{{n}} waiting to be sent.", { n: waitingCount })
                : t("pms_settings.queue_clear", "Nothing waiting.")}
              {problemCount > 0 ? ` ${t("pms_settings.queue_problems", "{{n}} need attention.", { n: problemCount })}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={refreshLists}
              className="w-[46px] h-[46px] rounded-2xl border border-gray-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 flex items-center justify-center active:scale-95 transition"
              aria-label={t("pms_settings.refresh", "Refresh")}
            >
              <IconRefresh size={18} />
            </button>
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying || waitingCount === 0}
              className="min-h-[46px] px-4 rounded-2xl bg-[#0D233A] text-white text-sm font-bold flex items-center gap-2 active:scale-95 transition disabled:opacity-40"
            >
              <IconSend size={17} />
              {isRetrying ? t("pms_settings.sending", "Sending...") : t("pms_settings.retry", "Send now")}
            </button>
          </div>
        </div>

        {queue.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-gray-400 py-4 text-center">
            {t("pms_settings.queue_empty", "No room charges have needed a retry.")}
          </p>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                  <th className="py-2 pr-3 font-semibold">{t("pms_settings.col_order", "Order")}</th>
                  <th className="py-2 pr-3 font-semibold">{t("pms_settings.col_action", "Action")}</th>
                  <th className="py-2 pr-3 font-semibold">{t("pms_settings.col_amount", "Amount")}</th>
                  <th className="py-2 pr-3 font-semibold">{t("pms_settings.col_status", "Status")}</th>
                  <th className="py-2 font-semibold">{t("pms_settings.col_detail", "Detail")}</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((q) => {
                  let payload = q.payload;
                  if (typeof payload === "string") {
                    try { payload = JSON.parse(payload); } catch { payload = {}; }
                  }
                  const cents = payload?.amount_usd_cents;
                  return (
                    <tr key={q.id} className="border-b border-gray-100 dark:border-gray-800/60 last:border-0 align-top">
                      <td className="py-2.5 pr-3 font-bold text-slate-900 dark:text-white">#{q.order_id}</td>
                      <td className="py-2.5 pr-3 text-slate-700 dark:text-gray-300">
                        {q.action === "VOID_CHARGE" ? t("pms_settings.action_void", "Void") : t("pms_settings.action_post", "Charge")}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-slate-700 dark:text-gray-300">
                        {cents ? `$${(cents / 100).toFixed(2)}` : "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={clsx("px-2 py-0.5 rounded-full text-[11px] font-bold", STATUS_STYLES[q.status] || STATUS_STYLES.CANCELLED)}>
                          {q.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs text-slate-500 dark:text-gray-400 max-w-[280px]">
                        {q.last_error || "—"}
                        {q.attempts > 0 && <span className="block">{t("pms_settings.attempts", "{{n}} attempts", { n: q.attempts })}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Page>
  );
}
