import React, { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Page from "../../components/Page";
import {
  savePrintSettings,
  usePrintSettings,
} from "../../controllers/settings.controller";
import { testPrint80mm } from "../../helpers/EscPosHelper";
import { toast } from "react-hot-toast";
import { mutate } from "swr";
import Popover from "../../components/Popover";
import { useTheme } from "../../contexts/ThemeContext";
import {
  IconPrinter,
  IconReceipt,
  IconCpu,
  IconCheck,
  IconInfoCircle,
  IconCut,
  IconCash,
  IconWifi,
  IconArrowRight,
  IconSparkles,
} from "@tabler/icons-react";

export default function PrintSettingsPage() {
  const { t } = useTranslation();
  const enablePrintRef = useRef();
  const showStoreDetailsRef = useRef();
  const showCustomerDetailsRef = useRef();
  const pageSizeRef = useRef();
  const headerRef = useRef();
  const footerRef = useRef();
  const showNotesRef = useRef();
  const printTokenRef = useRef();
  const autoCutRef = useRef();
  const cashDrawerKickRef = useRef();

  const [printMode, setPrintMode] = useState("browser");
  const [isTestingPrint, setIsTestingPrint] = useState(false);
  const { theme } = useTheme();

  const { APIURL, data, error, isLoading } = usePrintSettings();

  useEffect(() => {
    if (data?.printMode) {
      setPrintMode(data.printMode);
    }
  }, [data]);

  if (isLoading) {
    return <Page className="px-8 py-6">{t('print_settings.please_wait', 'Please wait...')}</Page>;
  }

  if (error) {
    console.error(error);
    return <Page className="px-8 py-6">{t('print_settings.error_loading_data', 'Error loading settings')}</Page>;
  }

  const {
    pageFormat = "80",
    header = "",
    footer = "",
    showNotes = true,
    isEnablePrint = true,
    showStoreDetails = true,
    showCustomerDetails = true,
    printToken = false,
    autoCut = true,
    cashDrawerKick = true,
  } = data;

  const handleTestPrint = async () => {
    try {
      setIsTestingPrint(true);
      toast.loading(t('print_settings.testing_printer', "Sending 80mm test receipt to RawBT..."));

      const result = await testPrint80mm(
        {},
        {
          header: headerRef.current?.value || header,
          footer: footerRef.current?.value || footer,
          autoCut: autoCutRef.current ? autoCutRef.current.checked : true,
          cashDrawerKick: cashDrawerKickRef.current ? cashDrawerKickRef.current.checked : true,
          page_format: pageSizeRef.current?.value || 80,
        }
      );

      toast.dismiss();
      if (result.method === "websocket") {
        toast.success(t('print_settings.test_success', "Test receipt printed silently via RawBT!"));
      } else {
        toast.success(t('print_settings.test_dispatched', "Test print dispatched to RawBT app!"));
      }
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error(t('print_settings.test_failed', "Could not reach RawBT. Please verify RawBT is running on this device."));
    } finally {
      setIsTestingPrint(false);
    }
  };

  const btnSave = async () => {
    const enablePrint = enablePrintRef.current.checked;
    const showStoreDetails = showStoreDetailsRef.current.checked;
    const showCustomerDetails = showCustomerDetailsRef.current.checked;
    const pageSize = pageSizeRef.current.value;
    const headerVal = headerRef.current.value;
    const footerVal = footerRef.current.value;
    const showNotesVal = showNotesRef.current.checked;
    const printTokenVal = printTokenRef.current.checked;
    const autoCutVal = autoCutRef.current ? autoCutRef.current.checked : true;
    const cashDrawerKickVal = cashDrawerKickRef.current ? cashDrawerKickRef.current.checked : true;

    try {
      toast.loading(t('print_settings.please_wait', 'Please wait...'));
      const res = await savePrintSettings(
        pageSize,
        headerVal,
        footerVal,
        showNotesVal,
        enablePrint,
        showStoreDetails,
        showCustomerDetails,
        printTokenVal,
        printMode,
        autoCutVal,
        cashDrawerKickVal
      );

      if (res.status === 200) {
        await mutate(APIURL);
        toast.dismiss();
        toast.success(res.data.message || t('print_settings.saved_success', 'Print settings saved successfully!'));
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('print_settings.something_went_wrong', 'Something went wrong');
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  };

  return (
    <Page className="px-8 py-6">
      <h3 className="text-3xl font-light">{t('print_settings.title', 'Print Settings')}</h3>
      <p className="text-sm text-gray-500 mt-1">
        Configure receipt printing, 80mm thermal hardware control, and KOT token options.
      </p>

      <div className="mt-8 text-gray-500 text-sm max-w-2xl">
        {/* Enable Printing Master Switch */}
        <div className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div>
            <label htmlFor="enablePrint" className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100 text-base">
              {t('print_settings.enable_print', 'Enable Printing')}
              <Popover text={t('print_settings.enable_print_tooltip', 'Enable or disable all customer and kitchen printing.')} />
            </label>
            <p className="text-xs text-gray-400 mt-0.5">Turn off to disable receipt prompts and printing across POS.</p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer no-drag">
            <input
              ref={enablePrintRef}
              defaultChecked={isEnablePrint}
              type="checkbox"
              name="enablePrint"
              id="enablePrint"
              className="sr-only peer"
            />
            <div className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-100 after:border-restro-bg-gray after:border after:rounded-full after:h-5 after:w-5 after:transition-all bg-restro-checkbox peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-restro-ring-light peer-checked:bg-restro-green peer-checked:after:border-restro-border-green"></div>
          </label>
        </div>

        {/* Print Mode Architecture Selector */}
        <div className="mt-6">
          <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
            {t('print_settings.print_mode_title', 'Printing Mode')}
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Mode 1: Direct Network LAN/TCP (Port 9100) */}
            <div
              onClick={() => setPrintMode("direct_tcp")}
              className={`cursor-pointer rounded-xl p-4 border transition-all ${
                printMode === "direct_tcp"
                  ? "border-restro-green bg-emerald-50/30 dark:bg-emerald-950/20 ring-2 ring-restro-green/20"
                  : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      printMode === "direct_tcp"
                        ? "bg-restro-green text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                    }`}
                  >
                    <IconWifi size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Direct Network (TCP)</h4>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                      ⭐ Recommended
                    </p>
                  </div>
                </div>
                {printMode === "direct_tcp" && (
                  <span className="w-5 h-5 rounded-full bg-restro-green text-white flex items-center justify-center">
                    <IconCheck size={14} />
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">
                Silent 100% Unicode canvas raster printing directly over Wi-Fi/LAN (Port 9100). No popups, instant &lt; 150ms print!
              </p>
            </div>

            {/* Mode 2: Browser Print */}
            <div
              onClick={() => setPrintMode("browser")}
              className={`cursor-pointer rounded-xl p-4 border transition-all ${
                printMode === "browser"
                  ? "border-restro-green bg-emerald-50/30 dark:bg-emerald-950/20 ring-2 ring-restro-green/20"
                  : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      printMode === "browser"
                        ? "bg-restro-green text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                    }`}
                  >
                    <IconReceipt size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Browser Print</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Standard popup dialog</p>
                  </div>
                </div>
                {printMode === "browser" && (
                  <span className="w-5 h-5 rounded-full bg-restro-green text-white flex items-center justify-center">
                    <IconCheck size={14} />
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">
                Opens the standard browser print preview dialog. Compatible with standard desktop PC printers.
              </p>
            </div>

            {/* Mode 3: Direct Android (RawBT) */}
            <div
              onClick={() => setPrintMode("direct_escpos")}
              className={`cursor-pointer rounded-xl p-4 border transition-all ${
                printMode === "direct_escpos"
                  ? "border-restro-green bg-emerald-50/30 dark:bg-emerald-950/20 ring-2 ring-restro-green/20"
                  : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      printMode === "direct_escpos"
                        ? "bg-restro-green text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                    }`}
                  >
                    <IconCpu size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Android (RawBT)</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Tablet App Bridge</p>
                  </div>
                </div>
                {printMode === "direct_escpos" && (
                  <span className="w-5 h-5 rounded-full bg-restro-green text-white flex items-center justify-center">
                    <IconCheck size={14} />
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">
                Direct printing via local RawBT background app on Android tablets to Wi-Fi/LAN 80mm printers.
              </p>
            </div>
          </div>
        </div>

        {/* Direct TCP Mode Hardware Management Callout */}
        {printMode === "direct_tcp" && (
          <div className="mt-4 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                <IconWifi size={16} />
                <span>Direct TCP Network Architecture Active</span>
              </div>
              <Link
                to="/dashboard/settings/thermal-printers"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition shadow-sm active:scale-95"
              >
                <span>Manage Thermal Printers</span>
                <IconArrowRight size={14} />
              </Link>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Customer receipts and kitchen tickets bypass the browser print dialog completely and stream directly to your printer IPs (Port 9100) with 100% Unicode font fidelity.
            </p>
          </div>
        )}

        {/* Direct Mode Advanced Hardware Controls */}
        {printMode === "direct_escpos" && (
          <div className="mt-4 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/10 space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
              <IconInfoCircle size={16} />
              <span>Direct Hardware Control (RawBT Bridge)</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Ensure RawBT is installed on this Android tablet and configured with your 80mm thermal printer's local IP address (e.g. <code>192.168.1.xxx:9100</code>).
            </p>

            {/* Auto Cut Toggle */}
            <div className="pt-2 flex items-center justify-between border-t border-emerald-200/60 dark:border-emerald-800/40">
              <label htmlFor="autoCut" className="flex items-center gap-2 text-xs font-medium text-gray-800 dark:text-gray-200">
                <IconCut size={16} className="text-gray-500" />
                <span>Auto-cut paper after printing</span>
              </label>
              <label className="relative inline-flex items-center cursor-pointer no-drag">
                <input
                  ref={autoCutRef}
                  defaultChecked={autoCut}
                  type="checkbox"
                  name="autoCut"
                  id="autoCut"
                  className="sr-only peer"
                />
                <div className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-100 after:border after:rounded-full after:h-4 after:w-4 after:transition-all bg-gray-300 peer-checked:bg-restro-green"></div>
              </label>
            </div>

            {/* Cash Drawer Kick Toggle */}
            <div className="flex items-center justify-between">
              <label htmlFor="cashDrawerKick" className="flex items-center gap-2 text-xs font-medium text-gray-800 dark:text-gray-200">
                <IconCash size={16} className="text-gray-500" />
                <span>Kick open cash drawer on Cash payments</span>
              </label>
              <label className="relative inline-flex items-center cursor-pointer no-drag">
                <input
                  ref={cashDrawerKickRef}
                  defaultChecked={cashDrawerKick}
                  type="checkbox"
                  name="cashDrawerKick"
                  id="cashDrawerKick"
                  className="sr-only peer"
                />
                <div className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-100 after:border after:rounded-full after:h-4 after:w-4 after:transition-all bg-gray-300 peer-checked:bg-restro-green"></div>
              </label>
            </div>

            {/* Test Print Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleTestPrint}
                disabled={isTestingPrint}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-xs font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm"
              >
                <IconPrinter size={16} />
                <span>{isTestingPrint ? "Testing Printer..." : "Test Print 80mm Receipt"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Paper Size */}
        <div className="mt-6 w-full">
          <label htmlFor="pageSize" className="block mb-1 font-medium text-gray-800 dark:text-gray-200">
            {t('print_settings.format_page_size', 'Paper Width')}
          </label>
          <select
            ref={pageSizeRef}
            defaultValue={pageFormat}
            name="pageSize"
            id="pageSize"
            className="block w-full rounded-lg px-4 py-2.5 text-restro-text bg-restro-gray border border-restro-border-green focus:outline-restro-button-hover"
          >
            <option value="80">80mm (Standard POS Thermal - 48 cols)</option>
            <option value="57">58mm (Mobile POS Thermal - 32 cols)</option>
          </select>
        </div>

        {/* Store Details Switch */}
        <div className="mt-4 w-full flex items-center justify-between">
          <label htmlFor="showStoreDetails" className="flex items-center gap-2">
            {t('print_settings.show_store_details', 'Show Store Details')}
            <Popover text={t('print_settings.show_store_details_tooltip', 'Show store name, address, phone and email on receipt.')} />
          </label>

          <label className="relative inline-flex items-center cursor-pointer no-drag">
            <input
              ref={showStoreDetailsRef}
              defaultChecked={showStoreDetails}
              type="checkbox"
              name="showStoreDetails"
              id="showStoreDetails"
              className="sr-only peer"
            />
            <div className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-100 after:border-restro-bg-gray after:border after:rounded-full after:h-5 after:w-5 after:transition-all bg-restro-checkbox peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-restro-ring-light peer-checked:bg-restro-green peer-checked:after:border-restro-border-green"></div>
          </label>
        </div>

        {/* Customer Details Switch */}
        <div className="mt-4 w-full flex items-center justify-between">
          <label htmlFor="showCustomerDetails" className="flex items-center gap-2">
            {t('print_settings.show_customer_details', 'Show Customer Details')}
            <Popover text={t('print_settings.show_customer_details_tooltip', 'Show customer name and order type on receipt.')} />
          </label>

          <label className="relative inline-flex items-center cursor-pointer no-drag">
            <input
              ref={showCustomerDetailsRef}
              defaultChecked={showCustomerDetails}
              type="checkbox"
              name="showCustomerDetails"
              id="showCustomerDetails"
              className="sr-only peer"
            />
            <div className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-100 after:border-restro-bg-gray after:border after:rounded-full after:h-5 after:w-5 after:transition-all bg-restro-checkbox peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-restro-ring-light peer-checked:bg-restro-green peer-checked:after:border-restro-border-green"></div>
          </label>
        </div>

        {/* Show Notes Switch */}
        <div className="mt-4 w-full flex items-center justify-between">
          <label htmlFor="showNotes" className="flex items-center gap-2">
            {t('print_settings.show_notes', 'Show Item Notes')}
            <Popover text={t('print_settings.show_notes_tooltip', 'Print item-level special instructions / notes.')} />
          </label>

          <label className="relative inline-flex items-center cursor-pointer no-drag">
            <input
              ref={showNotesRef}
              defaultChecked={showNotes}
              type="checkbox"
              name="showNotes"
              id="showNotes"
              className="sr-only peer"
            />
            <div className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-100 after:border-restro-bg-gray after:border after:rounded-full after:h-5 after:w-5 after:transition-all bg-restro-checkbox peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-restro-ring-light peer-checked:bg-restro-green peer-checked:after:border-restro-border-green"></div>
          </label>
        </div>

        {/* Print Token Switch */}
        <div className="mt-4 w-full flex items-center justify-between">
          <label htmlFor="printToken" className="flex items-center gap-2">
            {t('print_settings.print_token', 'Auto-Print Kitchen Token on Checkout')}
            <Popover text={t('print_settings.print_token_tooltip', 'Prompt or auto-print kitchen order ticket when an order is finalized.')} />
          </label>

          <label className="relative inline-flex items-center cursor-pointer no-drag">
            <input
              ref={printTokenRef}
              defaultChecked={printToken}
              type="checkbox"
              name="printToken"
              id="printToken"
              className="sr-only peer"
            />
            <div className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-100 after:border-restro-bg-gray after:border after:rounded-full after:h-5 after:w-5 after:transition-all bg-restro-checkbox peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-restro-ring-light peer-checked:bg-restro-green peer-checked:after:border-restro-border-green"></div>
          </label>
        </div>

        {/* Header Text */}
        <div className="mt-6">
          <label htmlFor="header" className="block mb-1 font-medium text-gray-800 dark:text-gray-200">
            {t('print_settings.header', 'Receipt Header Custom Text')}
          </label>
          <textarea
            ref={headerRef}
            defaultValue={header}
            name="header"
            id="header"
            placeholder={t('print_settings.header_placeholder', 'Welcome to our restaurant! TAX ID: 123456789')}
            className="block w-full h-20 rounded-lg px-4 py-2 text-restro-text bg-restro-gray border border-restro-border-green focus:outline-restro-button-hover"
          />
        </div>

        {/* Footer Text */}
        <div className="mt-4">
          <label htmlFor="footer" className="block mb-1 font-medium text-gray-800 dark:text-gray-200">
            {t('print_settings.footer', 'Receipt Footer Text')}
          </label>
          <textarea
            ref={footerRef}
            defaultValue={footer}
            name="footer"
            id="footer"
            placeholder={t('print_settings.footer_placeholder', 'Thank you! Please visit again.')}
            className="block w-full h-20 rounded-lg px-4 py-2 text-restro-text bg-restro-gray border border-restro-border-green focus:outline-restro-button-hover"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={btnSave}
          className="text-white w-full transition active:scale-95 rounded-xl px-4 py-3 mt-8 bg-restro-green hover:bg-restro-green-button-hover font-medium text-base shadow-sm"
        >
          {t('print_settings.save', 'Save Print Settings')}
        </button>
      </div>
    </Page>
  );
}
