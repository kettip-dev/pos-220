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
  const { autoCut = true, cashDrawerKick = false, feed = true } = options;
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

  // Build the complete ESC/POS command buffer.
  // The image is sent as a series of GS v 0 bands instead of one block: many
  // thermal printers cannot buffer a whole receipt as a single image and drop
  // or garble the rest of the job, including the cut command at the end.
  const chunks = [Uint8Array.from([0x1b, 0x40])]; // ESC @ (Initialize printer)
  for (let startRow = 0; startRow < height; startRow += RASTER_BAND_ROWS) {
    const rows = Math.min(RASTER_BAND_ROWS, height - startRow);
    chunks.push(
      Uint8Array.from([
        0x1d, 0x76, 0x30, 0x00, // GS v 0 0 (Raster bit image normal mode)
        widthBytes & 0xff, // xL
        (widthBytes >> 8) & 0xff, // xH
        rows & 0xff, // yL
        (rows >> 8) & 0xff, // yH
      ])
    );
    chunks.push(rasterData.subarray(startRow * widthBytes, (startRow + rows) * widthBytes));
  }

  const footer = [];

  // Feed 4 lines for tear/cut clearance (skipped when a separate cut job feeds)
  if (feed) footer.push(0x1b, 0x64, 0x04); // ESC d 4

  // RJ11 Cash drawer kick pulse pin 2 (if requested)
  if (cashDrawerKick) {
    footer.push(0x1b, 0x70, 0x00, 0x19, 0xfa); // ESC p 0 25 250
  }

  // Full paper cut
  if (autoCut) {
    footer.push(0x1d, 0x56, 0x00); // GS V 0
  }
  chunks.push(Uint8Array.from(footer));

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/** Image rows per GS v 0 command (small enough for low-memory printers). */
const RASTER_BAND_ROWS = 128;

/** Only the add-ons the guest picked (cart items carry the full list in `addons`). */
function selectedAddons(item = {}) {
  const addons = Array.isArray(item.addons) ? item.addons.filter(Boolean) : [];
  if (!Array.isArray(item.addons_ids)) return addons;
  const ids = item.addons_ids.map(String);
  return addons.filter((a) => ids.includes(String(a.id)));
}

function addonNamesOf(item) {
  return selectedAddons(item)
    .map((a) => a.title || a.name)
    .filter(Boolean)
    .join(", ");
}

const firstDefined = (...values) => values.find((v) => v !== undefined && v !== null && v !== "");

/**
 * Order items loaded back from the server (table pay, order / invoice
 * reprints) name the item `item_title`, keep the variant in `variant_title` /
 * `variant_price`, and carry the menu's base `price`. POS cart items already
 * have `title` and a unit price that includes the variant and add-ons.
 */
function normalizeItem(item = {}) {
  const variant = item.variant || (item.variant_title ? { id: item.variant_id, title: item.variant_title, price: item.variant_price } : null);
  const normalized = {
    ...item,
    title: firstDefined(item.title, item.item_title, item.name, "Item"),
    variant,
  };
  const isServerOrderRow = item.order_id !== undefined && item.item_title !== undefined;
  if (isServerOrderRow && item.total === undefined) {
    const base = Number(firstDefined(item.variant_price, variant?.price, item.price, 0));
    const addonsTotal = selectedAddons(item).reduce((sum, a) => sum + Number(a.price || 0), 0);
    normalized.price = base + addonsTotal;
  }
  return normalized;
}

/**
 * Receipts are triggered from several screens with slightly different payloads
 * (POS cart, order/invoice reprints, split-bill sub receipts). Map them all to
 * the fields the canvas renderers read.
 */
function normalizePrintDetails(details = {}) {
  return {
    ...details,
    cartItems: (details.cartItems || details.items || []).map(normalizeItem),
    tableName: firstDefined(details.tableName, details.table?.table_title, details.order_title),
    customer: details.customer || (details.customer_name ? { name: details.customer_name } : null),
    itemsTotal: Number(firstDefined(details.itemsTotal, details.sub_total, 0)),
    discountAmount: Number(firstDefined(details.discountAmount, details.discount_total, 0)),
    taxTotal: Number(firstDefined(details.taxTotal, details.tax_total, 0)),
    serviceChargeTotal: Number(firstDefined(details.serviceChargeTotal, details.service_charge_total, 0)),
    payableTotal: Number(firstDefined(details.payableTotal, details.total, 0)),
    tipAmount: Number(firstDefined(details.tipAmount, details.tip_amount, 0)),
    tokenNo: firstDefined(details.tokenNo, details.token_no),
    orderId: firstDefined(details.orderId, details.order_id, details.orderIds),
    paymentMethod: firstDefined(details.paymentMethod, details.paymentType, details.payment_type),
    cashTendered: firstDefined(details.cashTendered, details.tenderedAmount, null),
    changeAmount: firstDefined(details.changeAmount, details.changeDue, null),
  };
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
    tipAmount = 0,
    tokenNo,
    orderId,
    paymentMethod = "Cash",
    currency = "$",
    dualTenderInfo = null,
    cashTendered = null,
    changeAmount = null,
  } = normalizePrintDetails(details);

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
      const itemTitle = item.title || item.item_title || item.name || "Item";
      const qty = Number(item.quantity || 1);
      const price = Number(item.price || 0);
      const lineTotal = Number(item.total || price * qty);

      // Main line: Item title (with wrap) + line total
      ctx.font = `bold ${paperSize === 58 ? 17 : 20}px ${FONT_FAMILY}`;
      ctx.textAlign = "left";

      const maxTitleWidth = contentWidth - (paperSize === 58 ? 90 : 120);
      const titleLines = wrapTextLines(ctx, itemTitle, maxTitleWidth);

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

      // Quantity x unit price
      ctx.font = `normal ${paperSize === 58 ? 15 : 17}px ${FONT_FAMILY}`;
      ctx.fillText(`${qty} x ${currency}${price.toFixed(2)}`, padding + 12, y);
      y += paperSize === 58 ? 19 : 22;

      // Variant
      const variantTitle = item.variant?.title || item.variant_title;
      if (variantTitle) {
        ctx.font = `italic ${paperSize === 58 ? 14 : 16}px ${FONT_FAMILY}`;
        ctx.fillStyle = "#222222";
        ctx.fillText(`  * ${variantTitle}`, padding + 12, y);
        y += paperSize === 58 ? 18 : 21;
      }

      // Addons (only the ones that were selected)
      const addonNames = addonNamesOf(item);
      if (addonNames) {
        ctx.font = `normal ${paperSize === 58 ? 14 : 16}px ${FONT_FAMILY}`;
        ctx.fillStyle = "#222222";
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

    const customerGroupDiscount = Number(details.customer_group_discount || details.customerGroupDiscountTotal || 0);
    if (customerGroupDiscount > 0) {
      const grpLabel = (details.customer_group_name || details.customerGroupName || "Group") + " Disc";
      drawSummaryRow(grpLabel, `-${currency}${customerGroupDiscount.toFixed(2)}`);
    }

    if (taxTotal > 0) {
      drawSummaryRow("Tax", `${currency}${Number(taxTotal).toFixed(2)}`);
    }

    if (serviceChargeTotal > 0) {
      drawSummaryRow("Service Charge", `${currency}${Number(serviceChargeTotal).toFixed(2)}`);
    }

    if (tipAmount > 0) {
      drawSummaryRow("Tip", `${currency}${Number(tipAmount).toFixed(2)}`);
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
    drawSummaryRow("Payment Method", String(paymentMethod || "Cash"));

    if (dualTenderInfo?.primaryMethod) {
      drawSummaryRow(`Split: ${dualTenderInfo.primaryMethod}`, `${currency}${Number(dualTenderInfo.primaryAmount || 0).toFixed(2)}`);
      if (dualTenderInfo.secondaryMethod) {
        drawSummaryRow(`Split: ${dualTenderInfo.secondaryMethod}`, `${currency}${Number(dualTenderInfo.secondaryAmount || 0).toFixed(2)}`);
      }
    } else if (dualTenderInfo) {
      // POS cash tender (USD / KHR)
      if (Number(dualTenderInfo.tenderedUSD) > 0) {
        drawSummaryRow("Cash (USD)", `$${Number(dualTenderInfo.tenderedUSD).toFixed(2)}`);
      }
      if (Number(dualTenderInfo.tenderedKHR) > 0) {
        drawSummaryRow("Cash (KHR)", `KHR ${Math.round(Number(dualTenderInfo.tenderedKHR)).toLocaleString()}`);
      }
      if (Number(dualTenderInfo.changeTotalUSD) > 0 || Number(dualTenderInfo.changeTotalKHR) > 0) {
        const change =
          dualTenderInfo.changeMode === "MIXED" && Number(dualTenderInfo.changeBreakdownUSD) > 0
            ? `$${Number(dualTenderInfo.changeBreakdownUSD).toFixed(2)} + KHR ${Math.round(Number(dualTenderInfo.changeBreakdownKHR || 0)).toLocaleString()}`
            : Number(dualTenderInfo.changeTotalUSD) > 0
              ? `$${Number(dualTenderInfo.changeTotalUSD).toFixed(2)}`
              : `KHR ${Math.round(Number(dualTenderInfo.changeTotalKHR)).toLocaleString()}`;
        drawSummaryRow("Change", change, true);
      }
    }

    if (!dualTenderInfo && cashTendered !== null && Number(cashTendered) > 0) {
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
  } = normalizePrintDetails(details);

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
      const itemTitle = item.title || item.item_title || item.name || "Item";
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
      const variantTitle = item.variant?.title || item.variant_title;
      if (variantTitle) {
        ctx.font = `bold ${paperSize === 58 ? 16 : 20}px ${FONT_FAMILY}`;
        ctx.fillText(`    Option: ${variantTitle}`, padding, y);
        y += paperSize === 58 ? 20 : 24;
      }

      // Addons (only the ones that were selected)
      const addonNames = addonNamesOf(item);
      if (addonNames) {
        ctx.font = `normal ${paperSize === 58 ? 16 : 20}px ${FONT_FAMILY}`;
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
 * Submit base64 raster bytes as a print job. The backend records the job and
 * routes it through the printer's print agent (or prints directly over TCP).
 *
 * @param {Object} meta { jobType, reference, idempotencyKey }
 * @returns {Promise<{ status: "printed"|"queued"|"sending", message: string, jobId: number }>}
 *   Rejects when the job failed (HTTP 502) or the request itself failed.
 */
export async function sendRasterToBackendPrinter(printerId, base64Data, meta = {}) {
  const res = await ApiClient.post(`/pos/printers/${printerId}/print`, {
    base64Data,
    ...meta,
  });
  return res.data;
}

// ESC @ (reset), ESC d 4 (feed 4 lines), GS V 0 (full cut): the same ending
// as the printer test page, which cuts on every printer we have seen.
const CUT_JOB_BASE64 = uint8ArrayToBase64(Uint8Array.from([0x1b, 0x40, 0x1b, 0x64, 0x04, 0x1d, 0x56, 0x00]));

/**
 * Print a raster ticket, then cut the paper with a separate small job.
 * Many LAN printers print a large raster image completely but drop the cut
 * command that follows it in the same job; a cut sent as its own job (like
 * the test page) is reliable. The ticket job is awaited first, so the cut is
 * queued behind it on the backend / print agent.
 */
async function sendTicketWithCut(printer, canvas, { cashDrawerKick = false, jobType, reference, idempotencyKey }) {
  const autoCut = Number(printer.auto_cut ?? 1) !== 0;
  const bytes = canvasToEscPosRaster(canvas, { autoCut: false, feed: !autoCut, cashDrawerKick });
  const result = await sendRasterToBackendPrinter(printer.id, uint8ArrayToBase64(bytes), {
    jobType,
    reference,
    idempotencyKey,
  });
  if (autoCut && result?.status !== "failed" && !result?.duplicate) {
    try {
      await sendRasterToBackendPrinter(printer.id, CUT_JOB_BASE64, {
        jobType: "raw",
        reference: `Cut: ${reference}`.slice(0, 100),
        idempotencyKey: idempotencyKey ? `${idempotencyKey}:cut` : undefined,
      });
    } catch (err) {
      console.warn("[Print] Paper cut job failed:", err?.response?.data?.message || err?.message);
    }
  }
  return result;
}

function orderLabel(details = {}) {
  if (details.tokenNo) return `#${details.tokenNo}`;
  if (details.orderId) return `Order ${details.orderId}`;
  return "";
}

/**
 * Centrally prints a customer receipt directly over TCP.
 * @param {Object} options { batchId } – reuse the same batchId when retrying so
 *   a receipt that already printed is not printed twice.
 */
export async function printReceiptDirectTcp(details, printer, { batchId } = {}) {
  if (!printer) {
    throw new Error("No default receipt printer configured for direct network printing.");
  }
  const paperSize = Number(printer.paper_size || 80);
  const canvas = renderReceiptToCanvas(details, paperSize);
  const { paymentMethod } = normalizePrintDetails(details);
  const isCash = String(paymentMethod || "").toLowerCase().includes("cash");
  const drawerEnabled = Number(details.printSettings?.cash_drawer_kick ?? 1) !== 0 && details.printSettings?.cashDrawerKick !== false;
  return await sendTicketWithCut(printer, canvas, {
    cashDrawerKick: isCash && drawerEnabled,
    jobType: "receipt",
    reference: `Receipt ${orderLabel(details)}`.trim(),
    idempotencyKey: batchId ? `receipt:${batchId}:${printer.id}` : undefined,
  });
}

/**
 * Centrally routes and prints KOT tickets to station printers.
 * Automatically splits items by station (e.g. Bar printer vs Kitchen printer).
 *
 * Every station ticket is sent independently, so one offline printer never
 * stops the other stations from receiving their tickets.
 *
 * @param {Object} options { batchId } – reuse the same batchId when retrying so
 *   only the stations that failed are printed again.
 * @returns {Promise<{ printed: Array, queued: Array, failed: Array }>} each entry
 *   is { station, printer, message }.
 */
export async function printKotDirectTcp(details, printerConfigs = [], stations = [], { batchId } = {}) {
  if (!Array.isArray(printerConfigs) || printerConfigs.length === 0) {
    throw new Error("No network printers configured.");
  }

  const summary = { printed: [], queued: [], failed: [] };
  const cartItems = details.cartItems || details.items || [];
  if (cartItems.length === 0) {
    return summary;
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
        key,
        stationId: sId,
        stationName: sName,
        printerId,
        items: [],
      });
    }

    stationMap.get(key).items.push(item);
  });

  // Dispatch a dedicated ticket for each station group. They go one after
  // another so each ticket's cut lands right behind it when stations share a
  // printer; a failure on one station never stops the others.
  const groups = [...stationMap.values()];
  const outcomes = [];
  for (const group of groups) {
    try {
      const targetPrinter = printerConfigs.find((p) => String(p.id) === String(group.printerId)) || printerConfigs[0];
      const paperSize = Number(targetPrinter.paper_size || 80);
      const stationDetails = {
        ...details,
        stationName: group.stationName,
        cartItems: group.items,
      };

      const canvas = renderKotToCanvas(stationDetails, paperSize);
      const result = await sendTicketWithCut(targetPrinter, canvas, {
        jobType: "kot",
        reference: `${group.stationName} ${orderLabel(details)}`.trim(),
        idempotencyKey: batchId ? `kot:${batchId}:${group.key}:${targetPrinter.id}` : undefined,
      });
      outcomes.push({ status: "fulfilled", value: { printer: targetPrinter.name, result } });
    } catch (reason) {
      outcomes.push({ status: "rejected", reason });
    }
  }

  outcomes.forEach((outcome, index) => {
    const station = groups[index].stationName;
    if (outcome.status === "fulfilled") {
      const { printer, result } = outcome.value;
      const entry = { station, printer, message: result?.message };
      if (result?.status === "queued" || result?.status === "sending") summary.queued.push(entry);
      else summary.printed.push(entry);
    } else {
      const err = outcome.reason;
      summary.failed.push({
        station,
        printer: err?.response?.data?.printer || null,
        message: err?.response?.data?.message || err?.message || "Printer unreachable",
      });
    }
  });

  return summary;
}
