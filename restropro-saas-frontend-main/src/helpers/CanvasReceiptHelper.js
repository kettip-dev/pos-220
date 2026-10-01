/**
 * CanvasReceiptHelper.js
 * High-performance off-screen HTML5 Canvas 2D engine for 100% Unicode Thermal Printing.
 * Converts receipts & KOTs into 1-bit monochrome ESC/POS raster bit images (GS v 0).
 * Eliminates browser print dialogs and provides native support for any language
 * (Thai, Vietnamese, Chinese, Japanese, Arabic, accents, emojis, and currency symbols).
 */

import ApiClient from "./ApiClient";

// ─── Font Constants ─────────────────────────────────────────────────────────────
const FONT_FAMILY =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Thai', 'Noto Sans SC', 'Noto Sans JP', 'Noto Sans KR', Arial, sans-serif";

/**
 * Word-wrap text into lines that fit within a given maxWidth on a 2D canvas context.
 */
function wrapTextLines(ctx, text, maxWidth) {
  if (!text) return [];
  const words = String(text).split(" ");
  const lines = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine + " " + word;
    const width = ctx.measureText(testLine).width;
    if (width < maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Converts a completed HTML5 Canvas element into an ESC/POS 1-bit monochrome raster payload (GS v 0).
 * @param {HTMLCanvasElement} canvas
 * @param {Object} options { autoCut: boolean, cashDrawerKick: boolean }
 * @returns {Uint8Array}
 */
export function canvasToEscPosRaster(canvas, options = {}) {
  const { autoCut = true, cashDrawerKick = false } = options;
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext("2d");
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  // ESC/POS raster width must be in whole bytes (8 pixels per byte)
  const widthBytes = Math.ceil(width / 8);
  const rasterData = new Uint8Array(widthBytes * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];

      // Standard grayscale luminance threshold
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const isBlack = a > 64 && lum < 165;

      if (isBlack) {
        const byteIdx = y * widthBytes + Math.floor(x / 8);
        const bitIdx = 7 - (x % 8);
        rasterData[byteIdx] |= 1 << bitIdx;
      }
    }
  }

  // Build the complete ESC/POS command buffer
  // Command: GS v 0 m xL xH yL yH d1...dk
  const header = [
    0x1b, 0x40, // ESC @ (Initialize printer)
    0x1d, 0x76, 0x30, 0x00, // GS v 0 0 (Raster bit image normal mode)
    widthBytes & 0xff, // xL
    (widthBytes >> 8) & 0xff, // xH
    height & 0xff, // yL
    (height >> 8) & 0xff, // yH
  ];

  const footer = [];

  // Feed 4 lines for tear/cut clearance
  footer.push(0x1b, 0x64, 0x04); // ESC d 4

  // RJ11 Cash drawer kick pulse pin 2 (if requested)
  if (cashDrawerKick) {
    footer.push(0x1b, 0x70, 0x00, 0x19, 0xfa); // ESC p 0 25 250
  }

  // Full paper cut
  if (autoCut) {
    footer.push(0x1d, 0x56, 0x00); // GS V 0
  }

  const totalLength = header.length + rasterData.length + footer.length;
  const result = new Uint8Array(totalLength);
  result.set(header, 0);
  result.set(rasterData, header.length);
  result.set(footer, header.length + rasterData.length);

  return result;
}

/**
 * Convert a Uint8Array into a Base64 string.
 */
export function uint8ArrayToBase64(bytes) {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Renders a complete Customer Receipt into an HTML5 Canvas element.
 * Supports full Unicode (all languages, accents, emojis, and currency symbols).
 * @param {Object} details Receipt details
 * @param {number} paperSize 80 or 58 (mm)
 * @returns {HTMLCanvasElement}
 */
export function renderReceiptToCanvas(details = {}, paperSize = 80) {
  const width = paperSize === 58 ? 384 : 576;
  const padding = paperSize === 58 ? 10 : 20;
  const contentWidth = width - padding * 2;

  const {
    cartItems = [],
    deliveryType,
    customer,
    tableId,
    tableName,
    storeSettings = {},
    printSettings = {},
    itemsTotal = 0,
    discountAmount = 0,
    discountType,
    discountValue,
    taxTotal = 0,
    serviceChargeTotal = 0,
    payableTotal = 0,
    tokenNo,
    orderId,
    paymentMethod = "Cash",
    currency = "$",
    dualTenderInfo = null,
    cashTendered = null,
    changeAmount = null,
  } = details;

  // Measurement canvas to dynamically compute height
  const mCanvas = document.createElement("canvas");
  mCanvas.width = width;
  mCanvas.height = 4000;
  const mCtx = mCanvas.getContext("2d");

  function drawDashedLine(ctx, y) {
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#000000";
    ctx.stroke();
    ctx.restore();
  }

  function drawSolidLine(ctx, y, thickness = 1.5) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.lineWidth = thickness;
    ctx.strokeStyle = "#000000";
    ctx.stroke();
    ctx.restore();
  }

  // Layout renderer helper that operates on any context
  function renderContent(ctx) {
    let y = 24;

    // ─── Header: Store Name ────────────────────────
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.font = `bold ${paperSize === 58 ? 24 : 32}px ${FONT_FAMILY}`;
    const storeName = storeSettings.store_name || "RESTRO PRO";
    const storeLines = wrapTextLines(ctx, storeName, contentWidth);
    storeLines.forEach((line) => {
      ctx.fillText(line, width / 2, y);
      y += paperSize === 58 ? 26 : 34;
    });

    // Address & Phone
    ctx.font = `normal ${paperSize === 58 ? 16 : 19}px ${FONT_FAMILY}`;
    if (storeSettings.address) {
      const addrLines = wrapTextLines(ctx, storeSettings.address, contentWidth);
      addrLines.forEach((line) => {
        ctx.fillText(line, width / 2, y);
        y += paperSize === 58 ? 20 : 23;
      });
    }
    if (storeSettings.phone) {
      ctx.fillText(`Tel: ${storeSettings.phone}`, width / 2, y);
      y += paperSize === 58 ? 20 : 23;
    }
    if (storeSettings.email) {
      ctx.fillText(storeSettings.email, width / 2, y);
      y += paperSize === 58 ? 20 : 23;
    }

    y += 8;
    drawDashedLine(ctx, y);
    y += 18;

    // ─── Order & Token Info ────────────────────────
    ctx.textAlign = "left";
    ctx.font = `bold ${paperSize === 58 ? 18 : 22}px ${FONT_FAMILY}`;
    if (tokenNo) {
      ctx.fillText(`TOKEN #${tokenNo}`, padding, y);
      if (orderId) {
        ctx.textAlign = "right";
        ctx.font = `normal ${paperSize === 58 ? 16 : 18}px ${FONT_FAMILY}`;
        ctx.fillText(`Order: #${orderId}`, width - padding, y);
      }
      y += paperSize === 58 ? 24 : 28;
    }

    ctx.textAlign = "left";
    ctx.font = `normal ${paperSize === 58 ? 15 : 18}px ${FONT_FAMILY}`;
    ctx.fillText(`Date: ${new Date().toLocaleString()}`, padding, y);
    y += paperSize === 58 ? 22 : 25;

    const diningInfo = [
      deliveryType ? `Type: ${deliveryType}` : null,
      tableName || tableId ? `Table: ${tableName || tableId}` : null,
      customer?.name ? `Guest: ${customer.name}` : null,
    ]
      .filter(Boolean)
      .join("  |  ");

    if (diningInfo) {
      ctx.fillText(diningInfo, padding, y);
      y += paperSize === 58 ? 22 : 25;
    }

    y += 8;
    drawSolidLine(ctx, y);
    y += 20;

    // ─── Items Table Header ────────────────────────
    ctx.font = `bold ${paperSize === 58 ? 16 : 18}px ${FONT_FAMILY}`;
    ctx.textAlign = "left";
    ctx.fillText("ITEM", padding, y);
    ctx.textAlign = "right";
    ctx.fillText("TOTAL", width - padding, y);
    y += 10;
    drawSolidLine(ctx, y, 1);
    y += 20;

    // ─── Line Items ────────────────────────────────
    cartItems.forEach((item) => {
      const itemTitle = item.title || item.name || "Item";
      const qty = item.quantity || 1;
      const price = Number(item.price || 0);
      const lineTotal = Number(item.total || price * qty);

      // Main line: Item title (with wrap) + Qty/Price
      ctx.font = `bold ${paperSize === 58 ? 17 : 20}px ${FONT_FAMILY}`;
      ctx.textAlign = "left";

      const maxTitleWidth = contentWidth - (paperSize === 58 ? 90 : 120);
      const titleLines = wrapTextLines(ctx, `${itemTitle} x${qty}`, maxTitleWidth);

      // Draw first line of title and right-aligned total
      ctx.fillText(titleLines[0] || "", padding, y);
      ctx.textAlign = "right";
      ctx.fillText(`${currency}${lineTotal.toFixed(2)}`, width - padding, y);
      y += paperSize === 58 ? 22 : 25;

      // Draw subsequent wrapped lines of title if any
      ctx.textAlign = "left";
      for (let i = 1; i < titleLines.length; i++) {
        ctx.fillText(titleLines[i], padding + 12, y);
        y += paperSize === 58 ? 20 : 23;
      }

      // Variant
      if (item.variant?.title) {
        ctx.font = `italic ${paperSize === 58 ? 14 : 16}px ${FONT_FAMILY}`;
        ctx.fillStyle = "#222222";
        ctx.fillText(`  * ${item.variant.title}`, padding + 12, y);
        y += paperSize === 58 ? 18 : 21;
      }

      // Addons
      if (Array.isArray(item.addons) && item.addons.length > 0) {
        ctx.font = `normal ${paperSize === 58 ? 14 : 16}px ${FONT_FAMILY}`;
        ctx.fillStyle = "#222222";
        const addonNames = item.addons.map((a) => a.title || a.name).join(", ");
        const addonLines = wrapTextLines(ctx, `  + ${addonNames}`, contentWidth - 20);
        addonLines.forEach((al) => {
          ctx.fillText(al, padding + 12, y);
          y += paperSize === 58 ? 18 : 21;
        });
      }

      // Notes
      if (item.notes) {
        ctx.font = `italic ${paperSize === 58 ? 14 : 16}px ${FONT_FAMILY}`;
        ctx.fillStyle = "#111111";
        ctx.fillText(`  >> ${item.notes}`, padding + 12, y);
        y += paperSize === 58 ? 18 : 21;
      }

      ctx.fillStyle = "#000000";
      y += 6;
    });

    y += 8;
    drawDashedLine(ctx, y);
    y += 20;

    // ─── Financial Totals Summary ───────────────────
    function drawSummaryRow(label, value, isBold = false, size = paperSize === 58 ? 16 : 18) {
      ctx.font = `${isBold ? "bold" : "normal"} ${size}px ${FONT_FAMILY}`;
      ctx.textAlign = "left";
      ctx.fillText(label, padding, y);
      ctx.textAlign = "right";
      ctx.fillText(value, width - padding, y);
      y += size + 6;
    }

    drawSummaryRow("Subtotal", `${currency}${Number(itemsTotal || 0).toFixed(2)}`);

    if (discountAmount > 0) {
      const discLabel = discountType === "percentage" ? `Discount (${discountValue}%)` : "Discount";
      drawSummaryRow(discLabel, `-${currency}${Number(discountAmount).toFixed(2)}`);
    }

    if (taxTotal > 0) {
      drawSummaryRow("Tax", `${currency}${Number(taxTotal).toFixed(2)}`);
    }

    if (serviceChargeTotal > 0) {
      drawSummaryRow("Service Charge", `${currency}${Number(serviceChargeTotal).toFixed(2)}`);
    }

    y += 6;
    drawSolidLine(ctx, y, 2);
    y += 26;

    // TOTAL PAYABLE
    ctx.textAlign = "left";
    ctx.font = `bold ${paperSize === 58 ? 22 : 28}px ${FONT_FAMILY}`;
    ctx.fillText("TOTAL", padding, y);
    ctx.textAlign = "right";
    ctx.fillText(`${currency}${Number(payableTotal || 0).toFixed(2)}`, width - padding, y);
    y += paperSize === 58 ? 28 : 34;

    drawSolidLine(ctx, y, 1.5);
    y += 20;

    // ─── Tender & Payment Details ───────────────────
    ctx.font = `normal ${paperSize === 58 ? 15 : 18}px ${FONT_FAMILY}`;
    drawSummaryRow("Payment Method", paymentMethod);

    if (dualTenderInfo) {
      drawSummaryRow(`Split: ${dualTenderInfo.primaryMethod}`, `${currency}${Number(dualTenderInfo.primaryAmount).toFixed(2)}`);
      drawSummaryRow(`Split: ${dualTenderInfo.secondaryMethod}`, `${currency}${Number(dualTenderInfo.secondaryAmount).toFixed(2)}`);
    }

    if (cashTendered !== null && Number(cashTendered) > 0) {
      drawSummaryRow("Cash Tendered", `${currency}${Number(cashTendered).toFixed(2)}`);
      if (changeAmount !== null && Number(changeAmount) >= 0) {
        drawSummaryRow("Change Due", `${currency}${Number(changeAmount).toFixed(2)}`, true);
      }
    }

    // ─── Footer Message ─────────────────────────────
    y += 12;
    drawDashedLine(ctx, y);
    y += 24;

    ctx.textAlign = "center";
    ctx.font = `normal ${paperSize === 58 ? 15 : 18}px ${FONT_FAMILY}`;
    const footerText = printSettings.footer || "Thank you for dining with us!";
    const footerLines = wrapTextLines(ctx, footerText, contentWidth);
    footerLines.forEach((fl) => {
      ctx.fillText(fl, width / 2, y);
      y += paperSize === 58 ? 20 : 23;
    });

    y += 20;
    return y;
  }

  // Pass 1: Measure height
  const measuredHeight = Math.ceil(renderContent(mCtx));

  // Pass 2: Render crisp image on correctly sized canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = measuredHeight;
  const ctx = canvas.getContext("2d");

  // Pure white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, measuredHeight);

  // Render actual content
  renderContent(ctx);

  return canvas;
}

/**
 * Renders a Kitchen Order Ticket (KOT / Token) into an HTML5 Canvas element.
 * Optimized for high visibility in hot kitchens (huge token badge, high-contrast bold fonts).
 * @param {Object} details KOT details
 * @param {number} paperSize 80 or 58 (mm)
 * @returns {HTMLCanvasElement}
 */
export function renderKotToCanvas(details = {}, paperSize = 80) {
  const width = paperSize === 58 ? 384 : 576;
  const padding = paperSize === 58 ? 12 : 20;
  const contentWidth = width - padding * 2;

  const {
    cartItems = [],
    deliveryType,
    tableName,
    tableId,
    tokenNo,
    orderId,
    stationName,
    notes,
  } = details;

  // Measurement canvas
  const mCanvas = document.createElement("canvas");
  mCanvas.width = width;
  mCanvas.height = 4000;
  const mCtx = mCanvas.getContext("2d");

  function drawThickLine(ctx, y) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000000";
    ctx.stroke();
    ctx.restore();
  }

  function drawDashedLine(ctx, y) {
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#000000";
    ctx.stroke();
    ctx.restore();
  }

  function renderContent(ctx) {
    let y = 24;

    // Station Banner
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.font = `bold ${paperSize === 58 ? 22 : 30}px ${FONT_FAMILY}`;
    const headerTitle = stationName ? `*** KOT: ${stationName.toUpperCase()} ***` : "*** KITCHEN TICKET ***";
    ctx.fillText(headerTitle, width / 2, y);
    y += paperSize === 58 ? 26 : 34;

    y += 10;
    drawThickLine(ctx, y);
    y += 30;

    // Giant Token Circle
    const circleRadius = paperSize === 58 ? 44 : 58;
    const centerX = width / 2;
    const centerY = y + circleRadius;

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#000000";
    ctx.stroke();

    // Token Number
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${paperSize === 58 ? 42 : 56}px ${FONT_FAMILY}`;
    ctx.fillText(String(tokenNo || "1"), centerX, centerY);
    ctx.restore();

    y = centerY + circleRadius + 28;

    // Order Info
    ctx.textAlign = "center";
    ctx.font = `bold ${paperSize === 58 ? 20 : 26}px ${FONT_FAMILY}`;
    const locationStr = [
      deliveryType ? deliveryType.toUpperCase() : null,
      tableName || tableId ? `TABLE ${tableName || tableId}` : null,
    ]
      .filter(Boolean)
      .join("  -  ");

    if (locationStr) {
      ctx.fillText(locationStr, width / 2, y);
      y += paperSize === 58 ? 24 : 30;
    }

    ctx.font = `normal ${paperSize === 58 ? 15 : 18}px ${FONT_FAMILY}`;
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    ctx.fillText(`Order #${orderId || "---"}   |   Time: ${timeStr}`, width / 2, y);
    y += paperSize === 58 ? 22 : 26;

    y += 10;
    drawThickLine(ctx, y);
    y += 24;

    // Items List
    cartItems.forEach((item) => {
      const itemTitle = item.title || item.name || "Item";
      const qty = item.quantity || 1;

      // Item Quantity Box + Title
      ctx.textAlign = "left";
      ctx.font = `bold ${paperSize === 58 ? 20 : 26}px ${FONT_FAMILY}`;

      const titleLines = wrapTextLines(ctx, `${qty}x  ${itemTitle}`, contentWidth);
      titleLines.forEach((tl, idx) => {
        ctx.fillText(tl, padding, y);
        y += paperSize === 58 ? 24 : 30;
      });

      // Variant
      if (item.variant?.title) {
        ctx.font = `bold ${paperSize === 58 ? 16 : 20}px ${FONT_FAMILY}`;
        ctx.fillText(`    Option: ${item.variant.title}`, padding, y);
        y += paperSize === 58 ? 20 : 24;
      }

      // Addons
      if (Array.isArray(item.addons) && item.addons.length > 0) {
        ctx.font = `normal ${paperSize === 58 ? 16 : 20}px ${FONT_FAMILY}`;
        const addonNames = item.addons.map((a) => a.title || a.name).join(", ");
        const addonLines = wrapTextLines(ctx, `    + ${addonNames}`, contentWidth - 30);
        addonLines.forEach((al) => {
          ctx.fillText(al, padding, y);
          y += paperSize === 58 ? 20 : 24;
        });
      }

      // Kitchen Item Notes
      if (item.notes) {
        ctx.font = `bold ${paperSize === 58 ? 16 : 20}px ${FONT_FAMILY}`;
        const noteLines = wrapTextLines(ctx, `    >> NOTE: ${item.notes}`, contentWidth - 30);
        noteLines.forEach((nl) => {
          ctx.fillText(nl, padding, y);
          y += paperSize === 58 ? 20 : 24;
        });
      }

      y += 8;
      drawDashedLine(ctx, y);
      y += 18;
    });

    if (notes) {
      ctx.font = `bold ${paperSize === 58 ? 17 : 22}px ${FONT_FAMILY}`;
      ctx.fillText(`Order Note: ${notes}`, padding, y);
      y += 24;
    }

    y += 12;
    ctx.textAlign = "center";
    ctx.font = `bold ${paperSize === 58 ? 15 : 18}px ${FONT_FAMILY}`;
    ctx.fillText("*** END OF TICKET ***", width / 2, y);
    y += 24;

    return y;
  }

  // Pass 1: Measure
  const measuredHeight = Math.ceil(renderContent(mCtx));

  // Pass 2: Draw
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = measuredHeight;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, measuredHeight);
  renderContent(ctx);

  return canvas;
}

/**
 * Dispatch base64 raster bytes to backend TCP printer endpoint.
 */
export async function sendRasterToBackendPrinter(printerId, base64Data) {
  return await ApiClient.post(`/pos/printers/${printerId}/print`, {
    base64Data,
  });
}

/**
 * Centrally prints a customer receipt directly over TCP.
 */
export async function printReceiptDirectTcp(details, printer) {
  if (!printer) {
    throw new Error("No default receipt printer configured for direct network printing.");
  }
  const paperSize = Number(printer.paper_size || 80);
  const canvas = renderReceiptToCanvas(details, paperSize);
  const isCash = details.paymentMethod?.toLowerCase().includes("cash");
  const bytes = canvasToEscPosRaster(canvas, {
    autoCut: Boolean(printer.auto_cut !== 0),
    cashDrawerKick: isCash,
  });
  const base64 = uint8ArrayToBase64(bytes);
  return await sendRasterToBackendPrinter(printer.id, base64);
}

/**
 * Centrally routes and prints KOT tickets to station printers.
 * Automatically splits items by station (e.g. Bar printer vs Kitchen printer).
 */
export async function printKotDirectTcp(details, printerConfigs = [], stations = []) {
  if (!Array.isArray(printerConfigs) || printerConfigs.length === 0) {
    throw new Error("No network printers configured.");
  }

  const cartItems = details.cartItems || [];
  if (cartItems.length === 0) {
    return { success: true, message: "No items to print" };
  }

  // Group items by assigned station
  const stationMap = new Map();
  // Key: stationId or "unassigned", Value: { stationName, printerId, items: [] }

  cartItems.forEach((item) => {
    const sId = item.kitchen_station_id || item.effective_kitchen_station_id || null;
    const sName = item.kitchen_station_name || item.effective_kitchen_station_name || "Kitchen";
    const key = sId ? String(sId) : "default";

    if (!stationMap.has(key)) {
      // Find printer for this station
      let printerId = null;
      if (sId) {
        // Check if printer is assigned to this station
        const stationObj = stations.find((s) => String(s.id) === String(sId));
        if (stationObj?.printer_id) {
          printerId = stationObj.printer_id;
        } else {
          const matchingPrinter = printerConfigs.find((p) => String(p.station_id) === String(sId));
          if (matchingPrinter) printerId = matchingPrinter.id;
        }
      }

      // If station has no assigned printer, fallback to KOT printer or default printer
      if (!printerId) {
        const kotPrinter = printerConfigs.find((p) => p.is_kot_printer === 1) || printerConfigs.find((p) => p.is_default === 1) || printerConfigs[0];
        printerId = kotPrinter ? kotPrinter.id : null;
      }

      stationMap.set(key, {
        stationId: sId,
        stationName: sName,
        printerId,
        items: [],
      });
    }

    stationMap.get(key).items.push(item);
  });

  const results = [];

  // Dispatch a dedicated ticket for each station group
  for (const [key, group] of stationMap.entries()) {
    const targetPrinter = printerConfigs.find((p) => String(p.id) === String(group.printerId)) || printerConfigs[0];
    if (!targetPrinter) continue;

    const paperSize = Number(targetPrinter.paper_size || 80);
    const stationDetails = {
      ...details,
      stationName: group.stationName,
      cartItems: group.items,
    };

    const canvas = renderKotToCanvas(stationDetails, paperSize);
    const bytes = canvasToEscPosRaster(canvas, {
      autoCut: Boolean(targetPrinter.auto_cut !== 0),
      cashDrawerKick: false,
    });
    const base64 = uint8ArrayToBase64(bytes);

    const res = await sendRasterToBackendPrinter(targetPrinter.id, base64);
    results.push({ station: group.stationName, printer: targetPrinter.name, res });
  }

  return { success: true, results };
}
