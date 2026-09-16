/**
 * ESC/POS 80mm Thermal Print Engine & RawBT Print Bridge
 * Supports direct network printing via RawBT background service on Android tablets without browser print dialogs.
 */

// ─── ESC/POS Constants ───────────────────────────────────────────────────────────
const ESC = "\x1b";
const GS = "\x1d";

export const ESCPOS = {
  INIT: `${ESC}@`,
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  TEXT_NORMAL: `${GS}!\x00`,
  TEXT_DOUBLE_HEIGHT: `${GS}!\x01`,
  TEXT_DOUBLE_WIDTH: `${GS}!\x10`,
  TEXT_DOUBLE_SIZE: `${GS}!\x11`,
  FEED_LINES: (n = 3) => `${ESC}d${String.fromCharCode(n)}`,
  PAPER_CUT_FULL: `${GS}V\x00`,
  PAPER_CUT_PARTIAL: `${GS}V\x01`,
  DRAWER_KICK: `${ESC}p\x00\x19\xfa`, // Kick RJ11 cash drawer pin 2
};

const DEFAULT_LINE_WIDTH = 48; // Standard 80mm thermal font width

/**
 * Format two columns (left-aligned label, right-aligned value).
 */
export function formatTwoColumns(left, right, width = DEFAULT_LINE_WIDTH) {
  const leftStr = String(left || "");
  const rightStr = String(right || "");
  const spacesNeeded = width - leftStr.length - rightStr.length;

  if (spacesNeeded >= 1) {
    return leftStr + " ".repeat(spacesNeeded) + rightStr;
  }
  // If too long, truncate left text slightly
  const maxLeft = width - rightStr.length - 1;
  const truncatedLeft = leftStr.substring(0, Math.max(0, maxLeft));
  return truncatedLeft + " " + rightStr;
}

/**
 * Create a horizontal dashed divider line.
 */
export function formatDivider(char = "-", width = DEFAULT_LINE_WIDTH) {
  return char.repeat(width);
}

/**
 * Convert string with ESC/POS escape sequences to Uint8Array.
 */
export function stringToBytes(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/**
 * Convert Uint8Array to base64 string.
 */
export function bytesToBase64(bytes) {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Build raw ESC/POS byte sequence for Customer Receipt (80mm).
 */
export function buildReceiptEscPos(receiptDetails) {
  const {
    cartItems = [],
    deliveryType,
    customerType,
    customer,
    tableId,
    tableName,
    storeSettings = {},
    printSettings = {},
    itemsTotal = 0,
    discountType,
    discountValue,
    discountAmount = 0,
    taxTotal = 0,
    serviceChargeTotal = 0,
    payableTotal = 0,
    tokenNo,
    orderId,
    paymentMethod,
    currency = "$",
  } = receiptDetails;

  const width = (printSettings.page_format == 58 || printSettings.pageFormat == 58) ? 32 : DEFAULT_LINE_WIDTH;
  const autoCut = printSettings.autoCut !== undefined ? printSettings.autoCut : (printSettings.auto_cut !== 0);
  const cashDrawerKick = printSettings.cashDrawerKick !== undefined ? printSettings.cashDrawerKick : (printSettings.cash_drawer_kick !== 0);
  const isCash = (paymentMethod || "").toLowerCase().includes("cash");

  let out = ESCPOS.INIT;

  // 1. Store Header
  if (printSettings.show_store_details != 0 && printSettings.showStoreDetails != 0) {
    if (storeSettings.store_name) {
      out += ESCPOS.ALIGN_CENTER;
      out += ESCPOS.BOLD_ON + ESCPOS.TEXT_DOUBLE_SIZE;
      out += `${storeSettings.store_name}\n`;
      out += ESCPOS.BOLD_OFF + ESCPOS.TEXT_NORMAL;
    }
    if (storeSettings.address) {
      out += ESCPOS.ALIGN_CENTER + `${storeSettings.address}\n`;
    }
    const phoneAndEmail = [
      storeSettings.phone ? `Tel: ${storeSettings.phone}` : null,
      storeSettings.email ? `Email: ${storeSettings.email}` : null,
    ].filter(Boolean).join(" | ");
    if (phoneAndEmail) {
      out += ESCPOS.ALIGN_CENTER + `${phoneAndEmail}\n`;
    }
  }

  // Custom Header
  if (printSettings.header) {
    out += ESCPOS.ALIGN_CENTER + `${printSettings.header}\n`;
  }

  out += ESCPOS.ALIGN_LEFT;
  out += formatDivider("-", width) + "\n";

  // 2. Receipt & Order Metadata
  if (tokenNo) {
    out += formatTwoColumns(`Token: #${tokenNo}`, `Order: #${orderId || ""}`, width) + "\n";
  } else if (orderId) {
    out += `Order: #${orderId}\n`;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  out += formatTwoColumns(`Date: ${dateStr}`, `Time: ${timeStr}`, width) + "\n";

  if (tableName || tableId) {
    out += `Table: ${tableName || tableId}\n`;
  }

  if (deliveryType) {
    out += `Order Type: ${deliveryType}\n`;
  }

  if (customer?.name && (printSettings.show_customer_details != 0 && printSettings.showCustomerDetails != 0)) {
    out += `Customer: ${customer.name} (${customerType || "Guest"})\n`;
  }

  // 3. Item List Header
  out += formatDivider("=", width) + "\n";
  out += formatTwoColumns("Item Description", "Amount", width) + "\n";
  out += formatDivider("-", width) + "\n";

  // 4. Cart Items
  cartItems.forEach((item) => {
    const title = item.title || item.item_title || "Item";
    const variantTitle = item.variant?.title ? ` (${item.variant.title})` : "";
    const fullTitle = `${title}${variantTitle}`;
    const qty = Number(item.quantity || 1);
    const price = Number(item.price || 0);
    const lineTotal = Number(item.total || (qty * price)).toFixed(2);

    out += ESCPOS.BOLD_ON;
    out += formatTwoColumns(fullTitle, `${currency}${lineTotal}`, width) + "\n";
    out += ESCPOS.BOLD_OFF;

    out += `  ${qty} x ${currency}${price.toFixed(2)}\n`;

    // Addons
    if (item.addons?.length > 0) {
      const addonNames = item.addons.map((a) => a.title || a.name).join(", ");
      out += `  + ${addonNames}\n`;
    }

    // Notes
    if (item.notes && (printSettings.show_notes != 0 && printSettings.showNotes != 0)) {
      out += `  * Note: ${item.notes}\n`;
    }
  });

  out += formatDivider("-", width) + "\n";

  // 5. Totals
  out += formatTwoColumns("Subtotal:", `${currency}${Number(itemsTotal).toFixed(2)}`, width) + "\n";

  if (discountAmount > 0) {
    const discLabel = discountType === "percentage" ? `Discount (${discountValue}%):` : "Discount:";
    out += formatTwoColumns(discLabel, `-${currency}${Number(discountAmount).toFixed(2)}`, width) + "\n";
  }

  if (taxTotal > 0) {
    out += formatTwoColumns("Tax:", `${currency}${Number(taxTotal).toFixed(2)}`, width) + "\n";
  }

  if (serviceChargeTotal > 0) {
    out += formatTwoColumns("Service Charge:", `${currency}${Number(serviceChargeTotal).toFixed(2)}`, width) + "\n";
  }

  out += formatDivider("=", width) + "\n";

  // Grand Total
  out += ESCPOS.BOLD_ON + ESCPOS.TEXT_DOUBLE_HEIGHT;
  out += formatTwoColumns("TOTAL:", `${currency}${Number(payableTotal).toFixed(2)}`, width) + "\n";
  out += ESCPOS.BOLD_OFF + ESCPOS.TEXT_NORMAL;

  // 6. Payment Method
  if (paymentMethod) {
    out += formatDivider("-", width) + "\n";
    out += formatTwoColumns("Payment Method:", paymentMethod.toUpperCase(), width) + "\n";
  }

  // 7. Footer
  out += formatDivider("-", width) + "\n";
  out += ESCPOS.ALIGN_CENTER;
  if (printSettings.footer) {
    out += `${printSettings.footer}\n`;
  } else {
    out += "Thank you for dining with us!\nPlease visit again.\n";
  }

  // 8. Feed & Hardware Commands
  out += ESCPOS.FEED_LINES(3);

  if (autoCut) {
    out += ESCPOS.PAPER_CUT_FULL;
  }

  if (cashDrawerKick && isCash) {
    out += ESCPOS.DRAWER_KICK;
  }

  return stringToBytes(out);
}

/**
 * Build raw ESC/POS byte sequence for Kitchen Order Ticket (KOT / Token).
 */
export function buildKotEscPos(kotDetails) {
  const {
    cartItems = [],
    deliveryType = "Dine In",
    tableId,
    tableName,
    tokenNo,
    orderId,
    printSettings = {},
    waiterName,
  } = kotDetails;

  const width = (printSettings.page_format == 58 || printSettings.pageFormat == 58) ? 32 : DEFAULT_LINE_WIDTH;
  const autoCut = printSettings.autoCut !== undefined ? printSettings.autoCut : (printSettings.auto_cut !== 0);

  let out = ESCPOS.INIT;

  // 1. KOT Title
  out += ESCPOS.ALIGN_CENTER;
  out += ESCPOS.BOLD_ON + ESCPOS.TEXT_DOUBLE_SIZE;
  out += "*** KITCHEN TICKET ***\n";
  out += ESCPOS.BOLD_OFF + ESCPOS.TEXT_NORMAL;

  // 2. High-Visibility Token & Table Header
  out += formatDivider("=", width) + "\n";
  if (tokenNo) {
    out += ESCPOS.BOLD_ON + ESCPOS.TEXT_DOUBLE_SIZE;
    out += `TOKEN: #${tokenNo}\n`;
    out += ESCPOS.BOLD_OFF + ESCPOS.TEXT_NORMAL;
  }
  if (tableName || tableId) {
    out += ESCPOS.BOLD_ON + ESCPOS.TEXT_DOUBLE_HEIGHT;
    out += `TABLE: ${tableName || tableId}\n`;
    out += ESCPOS.BOLD_OFF + ESCPOS.TEXT_NORMAL;
  }

  out += ESCPOS.ALIGN_LEFT;
  out += formatDivider("-", width) + "\n";

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  out += formatTwoColumns(`Type: ${deliveryType}`, `Time: ${timeStr}`, width) + "\n";
  if (orderId) {
    out += `Order Ref: #${orderId}\n`;
  }
  if (waiterName) {
    out += `Server: ${waiterName}\n`;
  }

  out += formatDivider("=", width) + "\n";
  out += formatTwoColumns("QTY  ITEM DESCRIPTION", "", width) + "\n";
  out += formatDivider("-", width) + "\n";

  // 3. Items
  cartItems.forEach((item) => {
    const qty = Number(item.quantity || 1);
    const title = item.title || item.item_title || "Item";
    const variantTitle = item.variant?.title ? ` - ${item.variant.title}` : "";
    const itemHeader = `${qty}x  ${title}${variantTitle}`;

    out += ESCPOS.BOLD_ON + ESCPOS.TEXT_DOUBLE_HEIGHT;
    out += `${itemHeader}\n`;
    out += ESCPOS.BOLD_OFF + ESCPOS.TEXT_NORMAL;

    // Addons
    if (item.addons?.length > 0) {
      const addonNames = item.addons.map((a) => a.title || a.name).join(", ");
      out += `    + ${addonNames}\n`;
    }

    // Notes
    if (item.notes) {
      out += ESCPOS.BOLD_ON;
      out += `    >> NOTE: ${item.notes}\n`;
      out += ESCPOS.BOLD_OFF;
    }
    out += "\n";
  });

  out += formatDivider("=", width) + "\n";
  out += ESCPOS.ALIGN_CENTER;
  out += `*** END OF TICKET ***\n`;

  out += ESCPOS.FEED_LINES(3);

  if (autoCut) {
    out += ESCPOS.PAPER_CUT_FULL;
  }

  return stringToBytes(out);
}

/**
 * Dispatch ESC/POS buffer directly to RawBT on Android tablet.
 * Primary method: WebSocket ws://127.0.0.1:40213 (background silent print).
 * Fallback method: Android Intent URI scheme rawbt:data:application/octet-stream;base64,...
 */
export async function sendToRawBT(bytes) {
  const base64 = bytesToBase64(bytes);

  return new Promise((resolve, reject) => {
    let ws = null;
    let isFinished = false;

    const timeout = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        if (ws) {
          try { ws.close(); } catch (_) {}
        }
        // Fallback to Intent URI
        fallbackToIntent(base64);
        resolve({ success: true, method: "intent_fallback" });
      }
    }, 1200);

    try {
      ws = new WebSocket("ws://127.0.0.1:40213");
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        try {
          ws.send(bytes.buffer);
          setTimeout(() => {
            if (!isFinished) {
              isFinished = true;
              clearTimeout(timeout);
              try { ws.close(); } catch (_) {}
              resolve({ success: true, method: "websocket" });
            }
          }, 200);
        } catch (sendErr) {
          if (!isFinished) {
            isFinished = true;
            clearTimeout(timeout);
            fallbackToIntent(base64);
            resolve({ success: true, method: "intent_fallback" });
          }
        }
      };

      ws.onerror = () => {
        if (!isFinished) {
          isFinished = true;
          clearTimeout(timeout);
          try { ws.close(); } catch (_) {}
          fallbackToIntent(base64);
          resolve({ success: true, method: "intent_fallback" });
        }
      };
    } catch (e) {
      if (!isFinished) {
        isFinished = true;
        clearTimeout(timeout);
        fallbackToIntent(base64);
        resolve({ success: true, method: "intent_fallback" });
      }
    }
  });
}

/**
 * Android Intent URI scheme trigger for RawBT.
 */
function fallbackToIntent(base64) {
  const intentUri = `rawbt:data:application/octet-stream;base64,${base64}`;
  
  // Use a hidden iframe to prevent the current web page from navigating away
  let iframe = document.getElementById("rawbt_print_frame");
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "rawbt_print_frame";
    iframe.style.display = "none";
    document.body.appendChild(iframe);
  }
  iframe.src = intentUri;
}

/**
 * Generate and send a sample test print (80mm) to verify RawBT and printer connectivity.
 */
export async function testPrint80mm(storeSettings = {}, printSettings = {}) {
  const sampleDetails = {
    cartItems: [
      {
        title: "Test Burger (80mm Thermal)",
        quantity: 2,
        price: 8.5,
        total: 17.0,
        notes: "Direct ESC/POS test print",
      },
      {
        title: "Cold Brew Coffee",
        quantity: 1,
        price: 4.5,
        total: 4.5,
      },
    ],
    deliveryType: "Dine In",
    customerType: "Walk-in",
    customer: { name: "Test Customer" },
    tableId: "01",
    tableName: "Table 1",
    storeSettings: {
      store_name: storeSettings.store_name || "RESTRO TEST STORE",
      address: storeSettings.address || "123 Restaurant Avenue, Suite 100",
      phone: storeSettings.phone || "+1 234 567 8900",
      email: storeSettings.email || "hello@restaurant.com",
    },
    printSettings: {
      ...printSettings,
      page_format: 80,
    },
    itemsTotal: 21.5,
    discountAmount: 1.5,
    taxTotal: 1.6,
    payableTotal: 21.6,
    tokenNo: "88",
    orderId: "TEST-001",
    paymentMethod: "Cash",
    currency: "$",
  };

  const bytes = buildReceiptEscPos(sampleDetails);
  return await sendToRawBT(bytes);
}
