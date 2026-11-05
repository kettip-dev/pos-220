import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Page from "../../components/Page";
import {
  useTelegramSettings,
  updateTelegramSettings,
  testTelegramConnection,
  sendManualEodReport,
} from "../../controllers/telegram.controller";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  IconBrandTelegram,
  IconArrowLeft,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconSend,
  IconClock,
  IconHelp,
  IconInfoCircle,
  IconReceipt,
  IconChartBar,
  IconShieldCheck,
  IconHash,
  IconAlertCircle,
  IconRefresh,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import clsx from "clsx";

export default function TelegramSettingsPage() {
  const { t } = useTranslation();
  const { APIURL, data, error, isLoading, mutate } = useTelegramSettings();

  const [botToken, setBotToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [ordersChatId, setOrdersChatId] = useState("");
  const [ordersThreadId, setOrdersThreadId] = useState("");
  const [isOrdersEnabled, setIsOrdersEnabled] = useState(true);

  const [eodChatId, setEodChatId] = useState("");
  const [eodThreadId, setEodThreadId] = useState("");
  const [isEodEnabled, setIsEodEnabled] = useState(true);
  const [eodTime, setEodTime] = useState("23:59");

  const [isSaving, setIsSaving] = useState(false);
  const [isTestingOrders, setIsTestingOrders] = useState(false);
  const [isTestingEod, setIsTestingEod] = useState(false);
  const [isSendingManualEod, setIsSendingManualEod] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (data) {
      setBotToken(data.bot_token || "");
      setOrdersChatId(data.orders_chat_id || "");
      setOrdersThreadId(data.orders_thread_id || "");
      setIsOrdersEnabled(Boolean(data.is_orders_enabled));
      setEodChatId(data.eod_chat_id || "");
      setEodThreadId(data.eod_thread_id || "");
      setIsEodEnabled(Boolean(data.is_eod_enabled));
      setEodTime(data.eod_time || "23:59");
    }
  }, [data]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await updateTelegramSettings({
        bot_token: botToken,
        orders_chat_id: ordersChatId,
        orders_thread_id: ordersThreadId,
        is_orders_enabled: isOrdersEnabled ? 1 : 0,
        eod_chat_id: eodChatId,
        eod_thread_id: eodThreadId,
        is_eod_enabled: isEodEnabled ? 1 : 0,
        eod_time: eodTime,
      });
      await mutate();
      toast.success("Telegram settings saved successfully!");
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestOrdersChat = async () => {
    if (!botToken.trim()) {
      toast.error("Please enter a Bot Token first");
      return;
    }
    if (!ordersChatId.trim()) {
      toast.error("Please enter Orders Chat ID first");
      return;
    }

    try {
      setIsTestingOrders(true);
      await testTelegramConnection({
        bot_token: botToken.trim(),
        chat_id: ordersChatId.trim(),
        thread_id: ordersThreadId.trim() || null,
      });
      toast.success("Test message sent to Orders Chat! Check your Telegram.");
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to send test message");
    } finally {
      setIsTestingOrders(false);
    }
  };

  const handleTestEodChat = async () => {
    const targetChat = eodChatId.trim() || ordersChatId.trim();
    const targetThread = eodChatId.trim() ? eodThreadId.trim() : (eodThreadId.trim() || ordersThreadId.trim());

    if (!botToken.trim()) {
      toast.error("Please enter a Bot Token first");
      return;
    }
    if (!targetChat) {
      toast.error("Please enter EOD Chat ID or Orders Chat ID");
      return;
    }

    try {
      setIsTestingEod(true);
      await testTelegramConnection({
        bot_token: botToken.trim(),
        chat_id: targetChat,
        thread_id: targetThread || null,
      });
      toast.success("Test message sent to EOD Chat! Check your Telegram.");
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to send test message");
    } finally {
      setIsTestingEod(false);
    }
  };

  const handleSendManualEod = async () => {
    try {
      setIsSendingManualEod(true);
      const res = await sendManualEodReport({});
      toast.success(res?.message || "EOD Summary sent to Telegram!");
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to send EOD report");
    } finally {
      setIsSendingManualEod(false);
    }
  };

  if (isLoading) {
    return (
      <Page className="p-4 md:p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-gray-400">
          <IconRefresh className="w-8 h-8 animate-spin text-[#59A352]" />
          <p className="text-sm font-medium">Loading Telegram configurations...</p>
        </div>
      </Page>
    );
  }

  if (error) {
    return (
      <Page className="p-4 md:p-8 max-w-5xl mx-auto">
        <div className="p-6 rounded-3xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
          <h3 className="font-bold text-lg mb-1">Failed to load settings</h3>
          <p className="text-sm">{error.message || "An unexpected error occurred"}</p>
        </div>
      </Page>
    );
  }

  return (
    <Page className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/settings"
            className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gray-100 dark:bg-[#333] hover:bg-gray-200 dark:hover:bg-[#444] transition-colors text-slate-600 dark:text-gray-300 active:scale-95 shrink-0"
          >
            <IconArrowLeft stroke={iconStroke} className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-restro-green-dark dark:text-white">
                Telegram Push Notifications
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#229ED9]/10 text-[#229ED9] border border-[#229ED9]/20">
                Bot API
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              Instant alerts for newly created orders and nightly End-of-Day (EOD) financial summaries.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          className="flex items-center gap-2 px-4 py-2 min-h-[42px] rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#252525] text-xs font-semibold text-slate-600 dark:text-gray-300 hover:border-[#59A352] dark:hover:border-[#59A352] transition-colors active:scale-95 shadow-sm"
        >
          <IconHelp stroke={iconStroke} className="w-4 h-4 text-[#59A352]" />
          <span>{showGuide ? "Hide Setup Guide" : "How to set up Bot?"}</span>
        </button>
      </div>

      {/* Setup Guide Accordion Banner */}
      {showGuide && (
        <div className="rounded-3xl border border-[#229ED9]/30 bg-blue-50/50 dark:bg-[#229ED9]/10 p-6 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#229ED9] text-white flex items-center justify-center shrink-0 shadow-sm">
              <IconBrandTelegram stroke={iconStroke} className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Quick Setup Guide: Create Bot & Find Chat ID
              </h3>
              <p className="text-xs text-slate-600 dark:text-gray-300 mt-1 leading-relaxed">
                Follow these simple 4 steps to link your restaurant to your Telegram group or channel:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#252525] border border-gray-200/70 dark:border-gray-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                <span className="w-5 h-5 rounded-full bg-[#59A352] text-white text-[11px] flex items-center justify-center">1</span>
                <span>Create Bot with @BotFather</span>
              </div>
              <p className="text-slate-500 dark:text-gray-400 leading-relaxed">
                Open Telegram, search for <b>@BotFather</b> and click Start. Send command <code>/newbot</code>. Choose a bot name and username (ending in <i>bot</i>). Copy the generated <b>HTTP API Token</b>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#252525] border border-gray-200/70 dark:border-gray-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                <span className="w-5 h-5 rounded-full bg-[#59A352] text-white text-[11px] flex items-center justify-center">2</span>
                <span>Add Bot to Group as Admin</span>
              </div>
              <p className="text-slate-500 dark:text-gray-400 leading-relaxed">
                Create a Telegram group (e.g. <i>"Restaurant Orders"</i>). Add your newly created bot to the group and promote it as an <b>Administrator</b> so it can post messages.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#252525] border border-gray-200/70 dark:border-gray-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                <span className="w-5 h-5 rounded-full bg-[#59A352] text-white text-[11px] flex items-center justify-center">3</span>
                <span>Get your Group Chat ID</span>
              </div>
              <p className="text-slate-500 dark:text-gray-400 leading-relaxed">
                Add <b>@RawDataBot</b> to the group to immediately see the chat object, or forward a group message to <b>@userinfobot</b>. Group chat IDs usually start with a minus (e.g. <code>-100234567890</code>).
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#252525] border border-gray-200/70 dark:border-gray-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                <span className="w-5 h-5 rounded-full bg-[#59A352] text-white text-[11px] flex items-center justify-center">4</span>
                <span>Test Connection</span>
              </div>
              <p className="text-slate-500 dark:text-gray-400 leading-relaxed">
                Paste the Token and Chat ID below, then click <b>"Send Test Message"</b> to verify that the bot can deliver notifications directly to your group.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: Bot Credentials */}
        <div className="rounded-3xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#252525] p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-[#229ED9] flex items-center justify-center shrink-0">
              <IconBrandTelegram stroke={iconStroke} className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-white">
                Telegram Bot Credentials
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Your restaurant's dedicated bot token provided by @BotFather.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-300">
              Bot API Token <span className="text-red-500">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                type={showToken ? "text" : "password"}
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                className="w-full h-[46px] px-4 pr-12 rounded-2xl bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#59A352] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 transition-colors"
                title={showToken ? "Hide token" : "Show token"}
              >
                {showToken ? (
                  <IconEyeOff stroke={iconStroke} className="w-5 h-5" />
                ) : (
                  <IconEye stroke={iconStroke} className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-gray-500">
              Keep this token secure. Bong POS uses this token to dispatch messages directly via official Telegram Bot API.
            </p>
          </div>
        </div>

        {/* Card 2: Order Notifications */}
        <div className="rounded-3xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#252525] p-6 space-y-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-[#59A352] flex items-center justify-center shrink-0">
                <IconReceipt stroke={iconStroke} className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base text-slate-900 dark:text-white">
                  New Order Notifications
                </h2>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Sends an itemized ticket to your Telegram chat whenever an order is placed or approved.
                </p>
              </div>
            </div>

            {/* Toggle switch */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isOrdersEnabled}
                onChange={(e) => setIsOrdersEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#59A352]"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-300">
                Orders Chat ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={ordersChatId}
                onChange={(e) => setOrdersChatId(e.target.value)}
                placeholder="-1001234567890"
                className="w-full h-[46px] px-4 rounded-2xl bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#59A352] transition-colors"
              />
              <p className="text-[11px] text-slate-400 dark:text-gray-500">
                Target Telegram Group or Channel ID (e.g. <code>-100...</code>).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-300">
                Topic / Thread ID <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-slate-400">
                  <IconHash className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={ordersThreadId}
                  onChange={(e) => setOrdersThreadId(e.target.value)}
                  placeholder="e.g. 12"
                  className="w-full h-[46px] pl-9 pr-4 rounded-2xl bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#59A352] transition-colors"
                />
              </div>
              <p className="text-[11px] text-slate-400 dark:text-gray-500">
                For Telegram Supergroups with forum topics enabled.
              </p>
            </div>
          </div>

          {/* Test Orders Chat Button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleTestOrdersChat}
              disabled={isTestingOrders || !ordersChatId}
              className="flex items-center gap-2 px-5 py-2.5 min-h-[42px] rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-[#59A352] text-xs font-bold text-slate-700 dark:text-gray-200 hover:text-[#59A352] transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTestingOrders ? (
                <IconRefresh className="w-4 h-4 animate-spin text-[#59A352]" />
              ) : (
                <IconSend stroke={iconStroke} className="w-4 h-4 text-[#59A352]" />
              )}
              <span>Send Test to Orders Chat</span>
            </button>
          </div>
        </div>

        {/* Card 3: End of Day (EOD) Summary */}
        <div className="rounded-3xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#252525] p-6 space-y-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <IconChartBar stroke={iconStroke} className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base text-slate-900 dark:text-white">
                  End-of-Day (EOD) Summary Report
                </h2>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Nightly report summarizing gross revenue, net sales, taxes, discounts, and payment methods mix.
                </p>
              </div>
            </div>

            {/* Toggle switch */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isEodEnabled}
                onChange={(e) => setIsEodEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#59A352]"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-300">
                EOD Chat ID <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={eodChatId}
                onChange={(e) => setEodChatId(e.target.value)}
                placeholder="Leave blank to use Orders Chat"
                className="w-full h-[46px] px-4 rounded-2xl bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#59A352] transition-colors"
              />
              <p className="text-[11px] text-slate-400 dark:text-gray-500">
                Use a separate management group for confidential revenue numbers.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-300">
                EOD Topic ID <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-slate-400">
                  <IconHash className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={eodThreadId}
                  onChange={(e) => setEodThreadId(e.target.value)}
                  placeholder="e.g. 55"
                  className="w-full h-[46px] pl-9 pr-4 rounded-2xl bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#59A352] transition-colors"
                />
              </div>
              <p className="text-[11px] text-slate-400 dark:text-gray-500">
                Target thread ID in management group.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-300">
                Closing Time (HH:mm)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-slate-400">
                  <IconClock className="w-4 h-4" />
                </span>
                <input
                  type="time"
                  value={eodTime}
                  onChange={(e) => setEodTime(e.target.value)}
                  className="w-full h-[46px] pl-9 pr-4 rounded-2xl bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#59A352] transition-colors"
                />
              </div>
              <p className="text-[11px] text-slate-400 dark:text-gray-500">
                Scheduled daily auto-dispatch time (default 23:59).
              </p>
            </div>
          </div>

          {/* Test & Trigger Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestEodChat}
              disabled={isTestingEod || (!eodChatId && !ordersChatId)}
              className="flex items-center gap-2 px-5 py-2.5 min-h-[42px] rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-[#59A352] text-xs font-bold text-slate-700 dark:text-gray-200 hover:text-[#59A352] transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTestingEod ? (
                <IconRefresh className="w-4 h-4 animate-spin text-[#59A352]" />
              ) : (
                <IconSend stroke={iconStroke} className="w-4 h-4 text-[#59A352]" />
              )}
              <span>Send Test to EOD Chat</span>
            </button>

            <button
              type="button"
              onClick={handleSendManualEod}
              disabled={isSendingManualEod || (!botToken || (!eodChatId && !ordersChatId))}
              className="flex items-center gap-2 px-5 py-2.5 min-h-[42px] rounded-2xl bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSendingManualEod ? (
                <IconRefresh className="w-4 h-4 animate-spin text-purple-600" />
              ) : (
                <IconChartBar stroke={iconStroke} className="w-4 h-4" />
              )}
              <span>Send Today's EOD Now</span>
            </button>
          </div>
        </div>

        {/* Bottom Save Action Bar */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <Link
            to="/dashboard/settings"
            className="px-6 py-2.5 min-h-[46px] rounded-2xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-[#333] text-sm font-bold text-slate-600 dark:text-gray-300 transition-colors active:scale-95 flex items-center justify-center"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-8 py-2.5 min-h-[46px] rounded-2xl bg-[#59A352] hover:bg-[#4d8f47] text-white text-sm font-bold shadow-lg shadow-[#59A352]/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <IconRefresh className="w-5 h-5 animate-spin" />
            ) : (
              <IconCheck stroke={iconStroke} className="w-5 h-5" />
            )}
            <span>Save Telegram Settings</span>
          </button>
        </div>
      </form>
    </Page>
  );
}
