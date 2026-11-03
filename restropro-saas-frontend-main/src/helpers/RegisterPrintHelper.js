import { toast } from "react-hot-toast";
import ApiClient from "./ApiClient";
import { ESCPOS, formatTwoColumns, formatDivider, stringToBytes, bytesToBase64, sendToRawBT } from "./EscPosHelper";
import { sendRasterToBackendPrinter } from "./CanvasReceiptHelper";

/**
 * X / Z register reports and the cash drawer kick.
 *
 * Reports are plain-text ESC/POS (ASCII only, so currencies print as codes,
 * e.g. "KHR 12,800"), sent through the same print-job pipeline as receipts.
 */

const LINE_WIDTH = 48;

export function formatCurrencyAmount(amount, currencyCode) {
  const code = String(currencyCode || "").toUpperCase();
  const value = Number(amount || 0);
  if (code === "KHR") return `KHR ${Math.round(value).toLocaleString("en-US")}`;
  return `${code} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** Report body as lines of text. Shared by thermal and browser printing. */
export function buildRegisterReportLines(summary, { storeName = "" } = {}) {
  if (!summary) return [];
  const isZ = summary.status === "CLOSED";
  const p = summary.primary_currency;
  const s = summary.secondary_currency;
  const fp = (v) => formatCurrencyAmount(v, p);
  const fs = (v) => formatCurrencyAmount(v, s);
  const row = (left, right) => formatTwoColumns(left, right, LINE_WIDTH);
  const div = formatDivider("-", LINE_WIDTH);
  const cash = summary.cash || {};
  const sales = summary.sales || {};
  const inv = summary.invoices || {};

  const lines = [];
  if (storeName) lines.push({ text: storeName, center: true, bold: true });
  lines.push({ text: isZ ? `Z REPORT #${summary.z_number}` : "X REPORT (MID-SHIFT)", center: true, bold: true, big: true });
  lines.push({ text: summary.register_name || "", center: true });
  lines.push(div);
  lines.push(row("Business day", summary.business_date || "-"));
  lines.push(row("Opened", formatDateTime(summary.opened_at)));
  lines.push(row("Opened by", summary.opened_by || "-"));
  if (isZ) {
    lines.push(row("Closed", formatDateTime(summary.closed_at)));
    lines.push(row("Closed by", summary.closed_by || "-"));
  } else {
    lines.push(row("Printed", formatDateTime(new Date())));
    lines.push(row("Cashier", summary.current_cashier || "-"));
  }
  if (s) lines.push(row("Rate", `1 USD = ${Number(summary.exchange_rate || 0).toLocaleString("en-US")} KHR`));

  lines.push(div);
  lines.push({ text: "SALES", bold: true });
  lines.push(row("Gross sales", fp(sales.gross_sales)));
  lines.push(row(`Bills (${sales.bill_count || 0})`, `avg ${fp(sales.average_bill)}`));
  if (Number(inv.discount_total) + Number(inv.promotion_discount_total) + Number(inv.customer_group_discount_total) > 0) {
    lines.push(row("Discounts given", fp(Number(inv.discount_total) + Number(inv.promotion_discount_total) + Number(inv.customer_group_discount_total))));
  }
  if (Number(inv.loyalty_discount_total) > 0) lines.push(row("Loyalty redeemed", fp(inv.loyalty_discount_total)));
  if (Number(inv.tax_total) > 0) lines.push(row("Tax collected", fp(inv.tax_total)));
  if (Number(inv.service_charge_total) > 0) lines.push(row("Service charge", fp(inv.service_charge_total)));
  lines.push(row(`Voids (${sales.void_count || 0})`, fp(sales.void_total)));
  lines.push(row(`Refunds (${sales.refund_count || 0})`, fp(sales.refund_total)));
  lines.push({ text: row("NET SALES", fp(sales.net_sales)), bold: true });
  if (Number(sales.tips_total) > 0) lines.push(row("Tips", fp(sales.tips_total)));

  lines.push(div);
  lines.push({ text: "PAYMENTS", bold: true });
  for (const pay of summary.payments || []) {
    lines.push(row(`${pay.title} (${pay.count})`, fp(pay.net)));
  }

  lines.push(div);
  lines.push({ text: "CASH DRAWER", bold: true });
  const both = (label, a, b) => {
    lines.push(row(label, fp(a)));
    if (s && Number(b || 0) !== 0) lines.push(row("", fs(b)));
  };
  both("Opening float", cash.opening_float_primary, cash.opening_float_secondary);
  both("Cash sales (net of change)", cash.cash_sales_primary, cash.cash_sales_secondary);
  if (Number(cash.cash_reversals_primary)) lines.push(row("Cash refunds/voids", fp(cash.cash_reversals_primary)));
  if (Number(cash.pay_in_primary) || Number(cash.pay_in_secondary)) both("Paid in", cash.pay_in_primary, cash.pay_in_secondary);
  if (Number(cash.pay_out_primary) || Number(cash.pay_out_secondary)) both("Paid out", -cash.pay_out_primary, -cash.pay_out_secondary);
  if (Number(cash.drop_primary) || Number(cash.drop_secondary)) both("Safe drops", -cash.drop_primary, -cash.drop_secondary);
  if (Number(cash.tip_payout_primary) || Number(cash.tip_payout_secondary)) both("Tip payouts", -cash.tip_payout_primary, -cash.tip_payout_secondary);
  if (cash.expected_primary !== null && cash.expected_primary !== undefined) {
    lines.push({ text: row("EXPECTED", fp(cash.expected_primary)), bold: true });
    if (s) lines.push({ text: row("", fs(cash.expected_secondary)), bold: true });
  }
  if (isZ) {
    lines.push(row("Counted", fp(cash.counted_primary)));
    if (s) lines.push(row("", fs(cash.counted_secondary)));
    lines.push({ text: row("OVER / SHORT", fp(cash.variance_base)), bold: true });
    if (summary.variance_approved_by) lines.push(row("Variance approved by", summary.variance_approved_by));
  }
  lines.push(row("No-sale drawer opens", String(summary.no_sale_count || 0)));

  if ((summary.tips_by_server || []).length) {
    lines.push(div);
    lines.push({ text: "TIPS BY SERVER", bold: true });
    for (const t of summary.tips_by_server) {
      lines.push(row(t.server, fp(Number(t.cash_tips || 0) + Number(t.non_cash_tips || 0))));
      if (t.paid_out) lines.push(row("  paid out", fp(t.paid_out)));
    }
  }

  if ((summary.by_cashier || []).length > 1) {
    lines.push(div);
    lines.push({ text: "BY CASHIER", bold: true });
    for (const c of summary.by_cashier) lines.push(row(`${c.cashier} (${c.count})`, fp(Number(c.sales) + Number(c.reversals))));
  }

  if ((summary.hourly || []).length) {
    lines.push(div);
    lines.push({ text: "SALES BY HOUR", bold: true });
    for (const h of summary.hourly) lines.push(row(`${String(h.hour).padStart(2, "0")}:00  (${h.count})`, fp(h.amount)));
  }

  if (summary.closing_note) {
    lines.push(div);
    lines.push(`Note: ${summary.closing_note}`);
  }
  lines.push(div);
  if (isZ) {
    lines.push({ text: "Counted by: ____________________", center: false });
    lines.push({ text: "Manager:    ____________________", center: false });
  }
  return lines.map((l) => (typeof l === "string" ? { text: l } : l));
}

function linesToEscPos(lines) {
  let out = ESCPOS.INIT;
  for (const line of lines) {
    out += line.center ? ESCPOS.ALIGN_CENTER : ESCPOS.ALIGN_LEFT;
    if (line.big) out += ESCPOS.TEXT_DOUBLE_HEIGHT;
    if (line.bold) out += ESCPOS.BOLD_ON;
    // ASCII only: anything else would print as garbage on a code-page printer.
    out += `${String(line.text || "").replace(/[^\x20-\x7E]/g, "?")}\n`;
    if (line.bold) out += ESCPOS.BOLD_OFF;
    if (line.big) out += ESCPOS.TEXT_NORMAL;
  }
  out += ESCPOS.FEED_LINES(4) + ESCPOS.PAPER_CUT_PARTIAL;
  return stringToBytes(out);
}

function openBrowserReport(lines, title) {
  const win = window.open("", "_blank", "toolbar=no,scrollbars=yes,resizable=yes,width=420,height=700");
  if (!win) {
    toast.error("Allow pop-ups to print the register report.");
    return;
  }
  const escape = (text) => String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const body = lines
    .map((l) => `<div style="${l.center ? "text-align:center;" : ""}${l.bold ? "font-weight:700;" : ""}${l.big ? "font-size:15px;" : ""}">${escape(l.text) || "&nbsp;"}</div>`)
    .join("");
  win.document.write(`<!doctype html><html><head><title>${escape(title)}</title>
    <style>body{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;white-space:pre;margin:12px;width:80mm}@media print{body{margin:0}}</style>
    </head><body>${body}</body></html>`);
  win.document.close();
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch (_) {}
  }, 300);
}

async function getDefaultPrinter() {
  const res = await ApiClient.get("/pos/printers");
  const printers = res.data?.printerConfigs || [];
  return printers.find((p) => p.is_default === 1) || printers[0] || null;
}

const printModeOf = (printSettings) => printSettings?.print_mode || printSettings?.printMode || "browser";

/** Print an X (open session) or Z (closed session) report on this device's receipt printer. */
export async function printRegisterReport(summary, { printSettings = null, storeName = "" } = {}) {
  const lines = buildRegisterReportLines(summary, { storeName });
  const title = summary?.status === "CLOSED" ? `Z Report #${summary.z_number}` : "X Report";
  const mode = printModeOf(printSettings);

  try {
    if (mode === "direct_tcp") {
      const printer = await getDefaultPrinter();
      if (printer) {
        const base64 = bytesToBase64(linesToEscPos(lines));
        await sendRasterToBackendPrinter(printer.id, base64, {
          jobType: "receipt",
          reference: title,
          idempotencyKey: summary?.status === "CLOSED" ? `zreport:${summary.session_id}:${Date.now()}` : undefined,
        });
        toast.success(`${title} sent to ${printer.name}`);
        return;
      }
    } else if (mode === "direct_escpos") {
      await sendToRawBT(linesToEscPos(lines));
      return;
    }
  } catch (error) {
    console.error("[Register] report print failed:", error);
    toast.error("Printer unavailable, opening browser print.");
  }
  openBrowserReport(lines, title);
}

/**
 * Pop the cash drawer without printing (No Sale). Needs a direct printer; the
 * browser print dialog cannot send the drawer pulse.
 */
export async function kickCashDrawer({ printSettings = null } = {}) {
  const bytes = stringToBytes(ESCPOS.INIT + ESCPOS.DRAWER_KICK);
  const mode = printModeOf(printSettings);
  try {
    if (mode === "direct_tcp") {
      const printer = await getDefaultPrinter();
      if (!printer) throw new Error("No receipt printer configured");
      await sendRasterToBackendPrinter(printer.id, bytesToBase64(bytes), { jobType: "raw", reference: "No sale (drawer)" });
      return true;
    }
    if (mode === "direct_escpos") {
      await sendToRawBT(bytes);
      return true;
    }
    toast("Drawer opening needs direct printing (Settings → Print Settings).", { icon: "ℹ️" });
    return false;
  } catch (error) {
    console.error("[Register] drawer kick failed:", error);
    toast.error("Could not open the cash drawer.");
    return false;
  }
}
