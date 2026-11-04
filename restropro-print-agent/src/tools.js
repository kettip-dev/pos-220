const net = require("net");
const os = require("os");
const { parseTcpTarget, parseIPv4, isPrivateLan } = require("./address");

/**
 * Printer tools used by the local Printer Tools page and the CLI:
 * reachability checks and a LAN scan for RAW (port 9100) printers.
 */

const SCAN_PORT = 9100;
const SCAN_TIMEOUT_MS = 600;
const SCAN_CONCURRENCY = 128;
const MAX_SCAN_HOSTS = 1024;

/** Open (and immediately close) a TCP connection. Resolves with the time taken. */
function probeTcp(host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const socket = new net.Socket();
    let finished = false;
    const done = (err) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      err ? reject(err) : resolve(Date.now() - started);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done());
    socket.once("timeout", () => done(Object.assign(new Error("timed out"), { code: "ETIMEDOUT" })));
    socket.once("error", done);
    socket.connect(port, host);
  });
}

const CHECK_HINTS = {
  ECONNREFUSED: "A device answered at this IP but is not accepting print jobs on this port. Check the port (usually 9100).",
  ETIMEDOUT: "No answer. The printer is off, on another network, or has a different IP. Print its self-test page to see its IP.",
  EHOSTUNREACH: "Not reachable from this computer. Check the network cable / Wi-Fi.",
  ENETUNREACH: "This computer has no route to that network.",
};

/** Is a network printer reachable? Never throws; returns { ok, ms } or { ok:false, error }. */
async function checkNetworkPrinter(address) {
  let target;
  try {
    target = parseTcpTarget(address);
  } catch (err) {
    return { ok: false, error: err.message };
  }
  try {
    const ms = await probeTcp(target.host, target.port, 3000);
    return { ok: true, ms, address: `${target.host}:${target.port}` };
  } catch (err) {
    return { ok: false, address: `${target.host}:${target.port}`, error: CHECK_HINTS[err.code] || err.message };
  }
}

const ipToInt = (o) => ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
const intToIp = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");

// Virtual adapters (WSL / Hyper-V, Docker, VMs, VPNs) never have printers on them.
const VIRTUAL_ADAPTER = /vethernet|wsl|hyper-v|docker|virtualbox|vmware|vmnet|tailscale|zerotier|wireguard|hamachi|loopback|npcap|\bvpn\b/i;

/** Private IPv4 networks this computer is on, e.g. [{ address, cidr: "192.168.1.0/24", hosts: [...] }]. */
function localSubnets() {
  const subnets = new Map();
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (VIRTUAL_ADAPTER.test(name)) continue;
    for (const a of addrs || []) {
      if (a.family !== "IPv4" && a.family !== 4) continue;
      if (a.internal) continue;
      const ip = parseIPv4(a.address);
      const mask = parseIPv4(a.netmask);
      if (!ip || !mask || !isPrivateLan(ip)) continue;
      // 100.64.0.0/10 is used by VPN overlays and carrier NAT, not restaurant LANs.
      if (ip[0] === 100) continue;
      // Scan at most a /22 around this computer, even on bigger networks.
      let maskInt = ipToInt(mask);
      const minMask = (0xffffffff << Math.log2(MAX_SCAN_HOSTS)) >>> 0;
      if (maskInt < minMask) maskInt = minMask;
      const network = (ipToInt(ip) & maskInt) >>> 0;
      const size = (~maskInt >>> 0) + 1;
      const prefix = 32 - Math.log2(size);
      const cidr = `${intToIp(network)}/${prefix}`;
      if (subnets.has(cidr) || size < 4) continue;
      const hosts = [];
      for (let i = 1; i < size - 1; i++) {
        const host = intToIp(network + i);
        if (host !== a.address) hosts.push(host);
      }
      subnets.set(cidr, { interface: name, address: a.address, cidr, hosts });
    }
  }
  return [...subnets.values()];
}

/** Find devices answering on port 9100 on this computer's local networks. */
async function scanNetwork({ port = SCAN_PORT } = {}) {
  const subnets = localSubnets();
  const hosts = [...new Set(subnets.flatMap((s) => s.hosts))];
  const found = [];
  let next = 0;
  const worker = async () => {
    while (next < hosts.length) {
      const host = hosts[next++];
      try {
        const ms = await probeTcp(host, port, SCAN_TIMEOUT_MS);
        found.push({ address: `${host}:${port}`, host, port, ms });
      } catch (_) {}
    }
  };
  await Promise.all(Array.from({ length: Math.min(SCAN_CONCURRENCY, hosts.length) }, worker));
  found.sort((a, b) => ipToInt(parseIPv4(a.host)) - ipToInt(parseIPv4(b.host)));
  return { subnets: subnets.map(({ interface: iface, address, cidr }) => ({ interface: iface, address, cidr })), scanned: hosts.length, found };
}

module.exports = { checkNetworkPrinter, scanNetwork };
