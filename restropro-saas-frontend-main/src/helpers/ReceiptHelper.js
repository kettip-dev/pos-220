import React from "react";
import { buildReceiptEscPos, buildKotEscPos, sendToRawBT } from "./EscPosHelper";
import { printReceiptDirectTcp, printKotDirectTcp } from "./CanvasReceiptHelper";
import ApiClient from "./ApiClient";
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
 * Centrally triggers Customer Receipt printing.
 * Modes:
 * 1. 'direct_tcp' (Recommended): Silent 100% Unicode canvas raster over local LAN socket (port 9100).
 * 2. 'direct_escpos': RawBT background bridge on Android tablets.
 * 3. 'browser': Standard browser print popup.
 */
export async function triggerPrintReceipt(details) {
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

      await printReceiptDirectTcp(details, defaultPrinter);
      toast.success(`Receipt printed silently on ${defaultPrinter.name}`, {
        id: "print-receipt-success",
        duration: 2500,
      });
      return { success: true, method: "direct_tcp", printer: defaultPrinter.name };
    } catch (err) {
      console.error("[Direct TCP Print] Receipt failed:", err);
      const errMsg = err?.response?.data?.message || err.message || "Printer unreachable";

      toast(
        (t) =>
          React.createElement(
            "div",
            { className: "flex flex-col gap-1 text-sm py-1" },
            React.createElement("span", { className: "font-semibold text-red-600" }, "Printer Connection Error"),
            React.createElement("span", { className: "text-xs text-gray-600" }, errMsg),
            React.createElement(
              "div",
              { className: "flex items-center gap-2 mt-2 pt-1 border-t border-gray-100" },
              React.createElement(
                "button",
                {
                  onClick: () => {
                    toast.dismiss(t.id);
                    triggerPrintReceipt(details);
                  },
                  className:
                    "px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-medium rounded-md transition",
                },
                "Retry"
              ),
              React.createElement(
                "button",
                {
                  onClick: () => {
                    toast.dismiss(t.id);
                    openBrowserReceiptPrint();
                  },
                  className:
                    "px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-md transition shadow-sm",
                },
                "Print via Browser"
              )
            )
          ),
        { duration: 8000, id: "tcp-print-fail" }
      );
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
 * 1. 'direct_tcp' (Recommended): Auto-splits items by station and routes directly to station printers.
 * 2. 'direct_escpos': RawBT background bridge on Android tablets.
 * 3. 'browser': Standard browser print popup.
 */
export async function triggerPrintToken(details) {
  setDetailsForReceiptPrint(details);

  const printSettings = details?.printSettings || {};
  const printMode = printSettings.print_mode || printSettings.printMode || "browser";

  // ─── Mode 1: Direct Network LAN/TCP ─────────────────────────
  if (printMode === "direct_tcp") {
    try {
      const { printerConfigs, stations } = await getPrintersAndStations(details);

      if (printerConfigs.length === 0) {
        toast.error("No network printer configured. Opening browser print...", { id: "no-kot-printer" });
        openBrowserTokenPrint();
        return;
      }

      const result = await printKotDirectTcp(details, printerConfigs, stations);
      toast.success("KOT sent to kitchen printer(s)", {
        id: "kot-print-success",
        duration: 2500,
      });
      return { success: true, method: "direct_tcp", result };
    } catch (err) {
      console.error("[Direct TCP Print] KOT print failed:", err);
      const errMsg = err?.response?.data?.message || err.message || "Kitchen printer unreachable";

      toast(
        (t) =>
          React.createElement(
            "div",
            { className: "flex flex-col gap-1 text-sm py-1" },
            React.createElement("span", { className: "font-semibold text-red-600" }, "Kitchen Printer Error"),
            React.createElement("span", { className: "text-xs text-gray-600" }, errMsg),
            React.createElement(
              "div",
              { className: "flex items-center gap-2 mt-2 pt-1 border-t border-gray-100" },
              React.createElement(
                "button",
                {
                  onClick: () => {
                    toast.dismiss(t.id);
                    triggerPrintToken(details);
                  },
                  className:
                    "px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-medium rounded-md transition",
                },
                "Retry"
              ),
              React.createElement(
                "button",
                {
                  onClick: () => {
                    toast.dismiss(t.id);
                    openBrowserTokenPrint();
                  },
                  className:
                    "px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-md transition shadow-sm",
                },
                "Print via Browser"
              )
            )
          ),
        { duration: 8000, id: "tcp-kot-fail" }
      );
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