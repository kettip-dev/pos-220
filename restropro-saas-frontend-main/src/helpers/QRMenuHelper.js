import QRCode from "qrcode";
import { FRONTEND_DOMAIN } from "../config/config";

// FRONTEND_DOMAIN may be a comma-separated list (used for CORS on the backend).
// Extract only the first entry to build valid QR menu URLs.
const getBaseUrl = () => {
  const configured = FRONTEND_DOMAIN?.split(",")[0]?.trim();
  if (configured) return configured;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
};

export const getQRMenuLink = (code) => {
  return `${getBaseUrl()}/m/${code}`;
};

export const getTableQRMenuLink = (code, tableId, pin = null) => {
  const base = `${getBaseUrl()}/m/${code}?table=${tableId}`;
  if (pin) {
    return `${base}&pin=${encodeURIComponent(pin)}`;
  }
  return base;
};

export const printTableQRPinSlip = async ({ storeName = "Restaurant", uniqueQRCode, table }) => {
  if (!uniqueQRCode || !table) return;
  const encryptedId = table.encrypted_id || table.id;
  const pin = table.table_pin || "";
  const qrLink = getTableQRMenuLink(uniqueQRCode, encryptedId, pin);

  const qrDataUrl = await QRCode.toDataURL(qrLink, {
    width: 360,
    margin: 1,
  });

  const printWin = window.open("", "_blank", "width=420,height=640");
  if (!printWin) return;

  const formattedPin = String(pin).split("").join(" ");
  const nowStr = new Date().toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

  printWin.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Table ${table.table_title} - QR Order Slip</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { width: 76mm; margin: 0 auto; padding: 12px 8px; text-align: center; color: #111; }
          .store { font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
          .sub { font-size: 11px; color: #555; margin-bottom: 10px; }
          .table-badge { display: inline-block; padding: 6px 14px; border: 2px solid #111; border-radius: 8px; font-size: 18px; font-weight: 900; margin-bottom: 10px; }
          .qr-wrap { margin: 6px auto; width: 180px; height: 180px; }
          .qr-wrap img { width: 100%; height: 100%; display: block; }
          .pin-box { margin: 10px auto; padding: 8px 12px; border: 2px dashed #111; border-radius: 10px; max-width: 220px; }
          .pin-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #444; }
          .pin-code { font-size: 26px; font-weight: 900; letter-spacing: 4px; margin-top: 2px; font-family: monospace; }
          .hint { font-size: 11px; color: #333; line-height: 1.35; margin-top: 8px; }
          .time { font-size: 10px; color: #666; margin-top: 10px; border-top: 1px dotted #ccc; padding-top: 6px; }
          @media print {
            @page { margin: 0; }
            body { width: 100%; padding: 8px; }
          }
        </style>
      </head>
      <body>
        <div class="store">${storeName}</div>
        <div class="sub">Scan to Browse Menu & Order</div>
        <div class="table-badge">Table ${table.table_title}${table.floor ? ` • Floor ${table.floor}` : ""}</div>
        <div class="qr-wrap">
          <img src="${qrDataUrl}" alt="Table QR" />
        </div>
        <div class="pin-box">
          <div class="pin-label">Table Security PIN</div>
          <div class="pin-code">${formattedPin || "----"}</div>
        </div>
        <div class="hint">
          Scan this slip to unlock ordering automatically, or enter the 4-digit PIN when scanning the table sticker.
        </div>
        <div class="time">${nowStr}</div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 250);
          };
        </script>
      </body>
    </html>
  `);
  printWin.document.close();
};

export const printBatchTableQRPinSlips = async ({
  storeName = "Restaurant",
  uniqueQRCode,
  tables = [],
}) => {
  if (!uniqueQRCode || !Array.isArray(tables) || tables.length === 0) return;

  const slips = await Promise.all(
    tables.map(async (table) => {
      const encryptedId = table.encrypted_id || table.id;
      const pin = table.table_pin || "";
      const qrLink = getTableQRMenuLink(uniqueQRCode, encryptedId, pin);
      const qrDataUrl = await QRCode.toDataURL(qrLink, {
        width: 320,
        margin: 1,
      });
      const formattedPin = String(pin).split("").join(" ");
      return {
        table,
        qrDataUrl,
        formattedPin,
      };
    })
  );

  const printWin = window.open("", "_blank", "width=960,height=760");
  if (!printWin) return;

  const nowStr = new Date().toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const cardsHtml = slips
    .map(
      ({ table, qrDataUrl, formattedPin }) => `
      <div class="slip-card">
        <div class="store">${storeName}</div>
        <div class="sub">Scan to Browse Menu & Order</div>
        <div class="table-badge">Table ${table.table_title}${
        table.floor !== undefined && table.floor !== null && String(table.floor).trim() !== ""
          ? ` • Floor ${table.floor}`
          : ""
      }</div>
        <div class="qr-wrap">
          <img src="${qrDataUrl}" alt="Table ${table.table_title} QR" />
        </div>
        <div class="pin-box">
          <div class="pin-label">Table Security PIN</div>
          <div class="pin-code">${formattedPin || "----"}</div>
        </div>
        <div class="seats">${table.seating_capacity || 2} Seats • Instant QR Ordering</div>
      </div>
    `
    )
    .join("");

  printWin.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${storeName} - All Table QR Slips (${slips.length})</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { padding: 16px; color: #111; background: #fff; }
          .header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0; }
          .header-title { font-size: 18px; font-weight: 800; }
          .header-meta { font-size: 12px; color: #64748b; }
          .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
          .slip-card { border: 2px solid #1e293b; border-radius: 14px; padding: 14px 10px; text-align: center; page-break-inside: avoid; break-inside: avoid; }
          .store { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
          .sub { font-size: 10px; color: #555; margin-bottom: 8px; }
          .table-badge { display: inline-block; padding: 4px 12px; border: 2px solid #111; border-radius: 8px; font-size: 15px; font-weight: 900; margin-bottom: 8px; }
          .qr-wrap { margin: 4px auto; width: 150px; height: 150px; }
          .qr-wrap img { width: 100%; height: 100%; display: block; }
          .pin-box { margin: 8px auto 6px; padding: 6px 10px; border: 1.5px dashed #111; border-radius: 8px; max-width: 180px; }
          .pin-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #444; }
          .pin-code { font-size: 20px; font-weight: 900; letter-spacing: 3px; margin-top: 2px; font-family: monospace; }
          .seats { font-size: 10px; color: #64748b; font-weight: 600; margin-top: 4px; }
          @media print {
            .header-bar { display: none; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header-bar">
          <div class="header-title">${storeName} — Table QR + PIN Slips (${slips.length} Tables)</div>
          <div class="header-meta">Generated ${nowStr}</div>
        </div>
        <div class="grid">
          ${cardsHtml}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `);
  printWin.document.close();
};
