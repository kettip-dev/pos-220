/**
 * Printer address validation.
 *
 * Printer addresses are tenant-supplied, and the backend (or a print agent)
 * opens raw sockets to them. Without strict validation a tenant could point a
 * "printer" at internal services (MySQL, Redis, cloud metadata endpoints) and
 * use the print endpoint as an SSRF / port-scanning primitive. Rules:
 *   - tcp: IPv4 literal only (no hostnames → no DNS rebinding / Docker service
 *     names), RAW/JetDirect ports 9100-9109 only, and never loopback,
 *     link-local, "this network", multicast, or broadcast addresses.
 *   - usb: the name of a printer queue installed on a print agent's computer.
 *     Only printable characters; the agent passes it to the OS spooler as a
 *     single argument, never through a shell.
 */

class PrinterAddressError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

const TCP_PORT_MIN = 9100;
const TCP_PORT_MAX = 9109;
const SUPPORTED_TRANSPORTS = ["tcp", "usb"];

function parseIPv4(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  if (octets.some((o) => o > 255)) return null;
  // Reject leading-zero forms ("010.1.1.1") that some stacks parse as octal.
  if (m.slice(1).some((s) => s.length > 1 && s.startsWith("0"))) return null;
  return octets;
}

function isForbiddenIPv4([a, b]) {
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata 169.254.169.254
  if (a >= 224) return true; // multicast, reserved, broadcast
  return false;
}

/**
 * Validate a TCP printer address ("192.168.1.200" or "192.168.1.200:9100").
 * @returns {{ host: string, port: number, address: string }}
 * @throws Error with a user-facing message.
 */
function parseTcpPrinterAddress(address) {
  const trimmed = String(address || "").trim();
  if (!trimmed) throw new PrinterAddressError("Printer address is required.");

  const parts = trimmed.split(":");
  if (parts.length > 2) throw new PrinterAddressError("Printer address must be an IPv4 address, e.g. 192.168.1.200:9100.");

  const host = parts[0].trim();
  const portStr = parts[1] !== undefined ? parts[1].trim() : String(TCP_PORT_MIN);

  const octets = parseIPv4(host);
  if (!octets) {
    throw new PrinterAddressError("Printer address must be an IPv4 address on your local network, e.g. 192.168.1.200.");
  }
  if (isForbiddenIPv4(octets)) {
    throw new PrinterAddressError(`${host} is not allowed as a printer address.`);
  }

  if (!/^\d{1,5}$/.test(portStr)) throw new PrinterAddressError(`Invalid printer port: ${portStr}.`);
  const port = Number(portStr);
  if (port < TCP_PORT_MIN || port > TCP_PORT_MAX) {
    throw new PrinterAddressError(`Printer port must be between ${TCP_PORT_MIN} and ${TCP_PORT_MAX} (RAW / JetDirect).`);
  }

  return { host, port, address: `${host}:${port}` };
}

/**
 * Validate an OS printer queue name used with the "usb" transport.
 */
function parseUsbPrinterName(address) {
  const name = String(address || "").trim();
  if (!name) throw new PrinterAddressError("Enter the printer name exactly as it appears on the print agent's computer.");
  if (name.length > 128) throw new PrinterAddressError("Printer name is too long (max 128 characters).");
  if (/[\x00-\x1f\x7f"`$]/.test(name)) throw new PrinterAddressError("Printer name contains invalid characters.");
  return { address: name };
}

/**
 * Validate and normalize a printer's transport + address pair.
 * USB printers can only be reached through a print agent.
 * @returns {{ transport: string, address: string }}
 */
function normalizePrinterTarget({ transport, address, agentId }) {
  const t = String(transport || "tcp").toLowerCase();
  if (!SUPPORTED_TRANSPORTS.includes(t)) {
    throw new PrinterAddressError(`Unsupported printer connection "${transport}". Use network (tcp) or USB.`);
  }
  if (t === "usb") {
    if (!agentId) throw new PrinterAddressError("USB / installed printers must be connected through a print agent.");
    return { transport: t, address: parseUsbPrinterName(address).address };
  }
  return { transport: t, address: parseTcpPrinterAddress(address).address };
}

module.exports = {
  PrinterAddressError,
  TCP_PORT_MIN,
  TCP_PORT_MAX,
  parseTcpPrinterAddress,
  parseUsbPrinterName,
  normalizePrinterTarget,
};
