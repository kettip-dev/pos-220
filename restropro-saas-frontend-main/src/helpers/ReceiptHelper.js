import { buildReceiptEscPos, buildKotEscPos, sendToRawBT } from "./EscPosHelper";

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
 * Centrally triggers Customer Receipt printing.
 * If printSettings.print_mode is 'direct_escpos', dispatches silently to RawBT on Android tablet.
 * Otherwise, opens the standard browser print window.
 */
export async function triggerPrintReceipt(details) {
  setDetailsForReceiptPrint(details);

  const printSettings = details?.printSettings || {};
  const isDirect = printSettings.print_mode === "direct_escpos" || printSettings.printMode === "direct_escpos";

  if (isDirect) {
    try {
      const bytes = buildReceiptEscPos(details);
      return await sendToRawBT(bytes);
    } catch (err) {
      console.error("[Direct Print] Error sending to RawBT:", err);
    }
  }

  // Fallback / standard Browser Print
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
 * Centrally triggers Kitchen Order Ticket (KOT / Token) printing.
 * If printSettings.print_mode is 'direct_escpos', dispatches silently to RawBT on Android tablet.
 * Otherwise, opens the standard browser print window.
 */
export async function triggerPrintToken(details) {
  setDetailsForReceiptPrint(details);

  const printSettings = details?.printSettings || {};
  const isDirect = printSettings.print_mode === "direct_escpos" || printSettings.printMode === "direct_escpos";

  if (isDirect) {
    try {
      const bytes = buildKotEscPos(details);
      return await sendToRawBT(bytes);
    } catch (err) {
      console.error("[Direct KOT Print] Error sending to RawBT:", err);
    }
  }

  // Fallback / standard Browser Print
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