/**
 * Target validation on the agent side. The agent only ever talks to printers
 * on the restaurant's private network, so even a compromised server cannot use
 * it to reach the internet or other services on this computer.
 */

const TCP_PORT_MIN = 9100;
const TCP_PORT_MAX = 9109;

function parseIPv4(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  if (m.slice(1).some((s) => s.length > 1 && s.startsWith("0"))) return null;
  const octets = m.slice(1).map(Number);
  return octets.some((o) => o > 255) ? null : octets;
}

function isPrivateLan([a, b]) {
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT / VPN overlays)
  return false;
}

function parseTcpTarget(address) {
  const [host = "", portStr = String(TCP_PORT_MIN), ...rest] = String(address || "").trim().split(":");
  if (rest.length) throw new Error(`Invalid printer address "${address}".`);
  const octets = parseIPv4(host.trim());
  if (!octets) throw new Error(`Printer address "${address}" must be an IPv4 address.`);
  if (!isPrivateLan(octets)) throw new Error(`Refusing to print to ${host}: not a private LAN address.`);
  if (!/^\d{1,5}$/.test(portStr.trim())) throw new Error(`Invalid printer port "${portStr}".`);
  const port = Number(portStr);
  if (port < TCP_PORT_MIN || port > TCP_PORT_MAX) {
    throw new Error(`Refusing to print to port ${port}: only ${TCP_PORT_MIN}-${TCP_PORT_MAX} are allowed.`);
  }
  return { host: host.trim(), port };
}

function parseSpoolerName(address) {
  const name = String(address || "").trim();
  if (!name || name.length > 128 || /[\x00-\x1f\x7f"`$]/.test(name)) {
    throw new Error(`Invalid installed printer name "${address}".`);
  }
  return name;
}

module.exports = { parseTcpTarget, parseSpoolerName, parseIPv4, isPrivateLan };
