import React from "react";
import { buildReceiptEscPos, buildKotEscPos, sendToRawBT } from "./EscPosHelper";
import { printReceiptDirectTcp, printKotDirectTcp } from "./CanvasReceiptHelper";
import ApiClient from "./ApiClient";
import { localizePrintDetails } from "./MenuLanguageHelper";
import toast from "react-hot-toast";

const RECEIPT_KEY = "RESTROPROSAAS__RECEIPT__PRINT";

export function getDetailsForReceiptPrint() {
  try {
    return JSON.parse(localStorage.getItem(RECEIPT_KEY));
  } catch (_) {
    return null;
  }
}

export function setDetailsForReceiptPrint(details) {
  try {
    localStorage.setItem(RECEIPT_KEY, JSON.stringify(details));
  } catch (_) {}
}

/**
 * Standard browser print fallback dialog for customer receipts.
 */
export function openBrowserReceiptPrint() {
  const receiptWindow = window.open(
    "/print-receipt",
    "_blank",
    "toolbar=yes,scrollbars=yes,resizable=yes,top=500,left=500,width=400,height=400"
  );
  if (receiptWindow) {
    receiptWindow.onload = () => {
      setTimeout(() => {
        try {
          receiptWindow.print();
        } catch (_) {}
      }, 400);
    };
  }
}

/**
 * Standard browser print fallback dialog for kitchen order tickets.
 */
export function openBrowserTokenPrint() {
  const tokenWindow = window.open(
    "/print-token",
    "_blank",
    "toolbar=yes,scrollbars=yes,resizable=yes,top=500,left=500,width=400,height=400"
  );
  if (tokenWindow) {
    tokenWindow.onload = () => {
      setTimeout(() => {
        try {
          tokenWindow.print();
        } catch (_) {}
      }, 400);
    };
  }
}

/**
 * Helper to fetch printer configurations and kitchen stations if not provided in details.
 */
async function getPrintersAndStations(details = {}) {
  let printerConfigs = details.printerConfigs;
  let stations = details.kitchenStations || details.stations;

  if (!printerConfigs) {
    try {
      const res = await ApiClient.get("/pos/printers");
      if (res.data?.printerConfigs) {
        printerConfigs = res.data.printerConfigs;
      }
    } catch (e) {
      console.error("[PrinterHelper] Error fetching printer configs:", e);
    }
  }

  if (!stations) {
    try {
      const res = await ApiClient.get("/kitchen-stations");
      if (res.data?.stations) {
        stations = res.data.stations;
      }
    } catch (_) {}
  }

  return {
    printerConfigs: printerConfigs || [],
    stations: stations || [],
  };
}

/**
 * A batch id ties together the print jobs of one print action. Retrying with
 * the same id lets the backend skip tickets that already printed.
 */
function newPrintBatchId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Error toast with "Retry" and "Print via Browser" actions.
 */
function showPrintFailureToast({ id, title, message, onRetry, onBrowserPrint }) {
  toast(
    (t) =>
      React.createElement(
        "div",
        { className: "flex flex-col gap-1 text-sm py-1" },
        React.createElement("span", { className: "font-semibold text-red-600" }, title),
        React.createElement("span", { className: "text-xs text-gray-600 whitespace-pre-line" }, message),
        React.createElement(
          "div",
          { className: "flex items-center gap-2 mt-2 pt-1 border-t border-gray-100" },
          React.createElement(
            "button",
            {
              onClick: () => {
                toast.dismiss(t.id);
                onRetry();
              },
              className:
                "min-h-[42px] px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-medium rounded-md transition active:scale-95",
            },
            "Retry"
          ),
          React.createElement(
            "button",
            {
              onClick: () => {
                toast.dismiss(t.id);
                onBrowserPrint();
              },
              className:
                "min-h-[42px] px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-md transition shadow-sm active:scale-95",
            },
            "Print via Browser"
          )
        )
      ),
    { duration: 10000, id }
  );
}

/**
 * Centrally triggers Customer Receipt printing.
 * Modes:
 * 1. 'direct_tcp' (Recommended): Silent 100% Unicode canvas raster sent as a print job,
 *    relayed by the restaurant's print agent (or by the server over LAN port 9100).
 * 2. 'direct_escpos': RawBT background bridge on Android tablets.
 * 3. 'browser': Standard browser print popup.
 *
 * @param {Object} options { batchId } – set only when retrying a previous attempt.
 */
export async function triggerPrintReceipt(rawDetails, { batchId = newPrintBatchId() } = {}) {
  // Menu names in the language chosen for receipts (Settings → Menu Languages).
  // Retries pass the original payload, so names are never translated twice.
  const details = await localizePrintDetails(rawDetails, "receipt").catch(() => rawDetails);
  setDetailsForReceiptPrint(details);

  const printSettings = details?.printSettings || {};
  const printMode = printSettings.print_mode || printSettings.printMode || "browser";

  // ─── Mode 1: Direct Network LAN/TCP ─────────────────────────
  if (printMode === "direct_tcp") {
    try {
      const { printerConfigs } = await getPrintersAndStations(details);
      const defaultPrinter =
        printerConfigs.find((p) => p.is_default === 1) || printerConfigs[0];

      if (!defaultPrinter) {
        toast.error("No network printer configured. Opening browser print...", { id: "no-printer-alert" });
        openBrowserReceiptPrint();
        return;
      }

      const result = await printReceiptDirectTcp(details, defaultPrinter, { batchId });
      if (result?.status === "queued" || result?.status === "sending") {
        toast(result.message || `Receipt queued for ${defaultPrinter.name}`, {
          id: "print-receipt-queued",
          icon: "⏳",
          duration: 5000,
        });
      } else {
        toast.success(`Receipt printed silently on ${defaultPrinter.name}`, {
          id: "print-receipt-success",
          duration: 2500,
        });
      }
      return { success: true, method: "direct_tcp", printer: defaultPrinter.name, status: result?.status };
    } catch (err) {
      console.error("[Direct TCP Print] Receipt failed:", err);
      const errMsg = err?.response?.data?.message || err.message || "Printer unreachable";

      showPrintFailureToast({
        id: "tcp-print-fail",
        title: "Printer Connection Error",
        message: errMsg,
        onRetry: () => triggerPrintReceipt(rawDetails, { batchId }),
        onBrowserPrint: openBrowserReceiptPrint,
      });
      return { success: false, error: errMsg };
    }
  }

  // ─── Mode 2: Direct RawBT (Android Tablet) ──────────────────
  if (printMode === "direct_escpos") {
    try {
      const bytes = buildReceiptEscPos(details);
      return await sendToRawBT(bytes);
    } catch (err) {
      console.error("[Direct Print] Error sending to RawBT:", err);
    }
  }

  // ─── Mode 3: Browser Print ──────────────────────────────────
  openBrowserReceiptPrint();
}

/**
 * Centrally triggers Kitchen Order Ticket (KOT / Token) printing.
 * Modes:
 * 1. 'direct_tcp' (Recommended): Auto-splits items by station and routes each ticket
 *    independently to its station printer, so one offline printer never blocks the rest.
 * 2. 'direct_escpos': RawBT background bridge on Android tablets.
 * 3. 'browser': Standard browser print popup.
 *
 * @param {Object} options { batchId } – set only when retrying; stations that
 *   already printed are skipped.
 */
export async function triggerPrintToken(rawDetails, { batchId = newPrintBatchId() } = {}) {
  if (rawDetails?.storeSettings?.isKitchenEnabled === false || rawDetails?.storeSettings?.is_kitchen_enabled === 0) {
    // Kitchen workflow is disabled for this store: suppress Kitchen Order Tickets
    return;
  }

  // Menu names in the language chosen for kitchen tickets (Settings → Menu Languages).
  const details = await localizePrintDetails(rawDetails, "kitchen").catch(() => rawDetails);
  setDetailsForReceiptPrint(details);

  const printSettings = details?.printSettings || {};
  const printMode = printSettings.print_mode || printSettings.printMode || "browser";

  // ─── Mode 1: Direct Network LAN/TCP ─────────────────────────
  if (printMode === "direct_tcp") {
    const retry = () => triggerPrintToken(rawDetails, { batchId });
    try {
      const { printerConfigs, stations } = await getPrintersAndStations(details);

      if (printerConfigs.length === 0) {
        toast.error("No network printer configured. Opening browser print...", { id: "no-kot-printer" });
        openBrowserTokenPrint();
        return;
      }

      const summary = await printKotDirectTcp(details, printerConfigs, stations, { batchId });

      if (summary.failed.length > 0) {
        const lines = summary.failed.map((f) => `• ${f.station}: ${f.message}`);
        if (summary.printed.length > 0) {
          lines.push(`Printed OK: ${summary.printed.map((p) => p.station).join(", ")}`);
        }
        showPrintFailureToast({
          id: "tcp-kot-fail",
          title:
            summary.printed.length + summary.queued.length > 0
              ? "Some kitchen tickets did not print"
              : "Kitchen Printer Error",
          message: lines.join("\n"),
          onRetry: retry,
          onBrowserPrint: openBrowserTokenPrint,
        });
        return { success: false, method: "direct_tcp", result: summary };
      }

      if (summary.queued.length > 0) {
        toast(
          `KOT queued for ${summary.queued.map((q) => q.station).join(", ")}. It will print when the print agent reconnects.`,
          { id: "kot-print-queued", icon: "⏳", duration: 6000 }
        );
      } else {
        toast.success("KOT sent to kitchen printer(s)", {
          id: "kot-print-success",
          duration: 2500,
        });
      }
      return { success: true, method: "direct_tcp", result: summary };
    } catch (err) {
      console.error("[Direct TCP Print] KOT print failed:", err);
      const errMsg = err?.response?.data?.message || err.message || "Kitchen printer unreachable";

      showPrintFailureToast({
        id: "tcp-kot-fail",
        title: "Kitchen Printer Error",
        message: errMsg,
        onRetry: retry,
        onBrowserPrint: openBrowserTokenPrint,
      });
      return { success: false, error: errMsg };
    }
  }

  // ─── Mode 2: Direct RawBT (Android Tablet) ──────────────────
  if (printMode === "direct_escpos") {
    try {
      const bytes = buildKotEscPos(details);
      return await sendToRawBT(bytes);
    } catch (err) {
      console.error("[Direct KOT Print] Error sending to RawBT:", err);
    }
  }

  // ─── Mode 3: Browser Print ──────────────────────────────────
  openBrowserTokenPrint();
}