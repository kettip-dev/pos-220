/**
 * Offline POS order queue.
 *
 * When the server cannot be reached, an order is stored on this device with
 * its own `clientOrderId` and sent later. The server treats the same
 * clientOrderId as the same order, so a retry after a half-finished request
 * can never create a duplicate.
 *
 * Storage is localStorage (small, synchronous, survives reloads). Each entry:
 *   { clientOrderId, kind: "order" | "order_invoice", args: [...], createdAt,
 *     localToken, status: "pending" | "failed", error, summary }
 */
const KEY = "restro_offline_orders_v1";
const listeners = new Set();
let flushing = false;

const read = () => {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const write = (list) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked: nothing more we can do on this device.
  }
  listeners.forEach((fn) => {
    try {
      fn(list);
    } catch {
      /* listener errors must not break the queue */
    }
  });
};

export const newClientOrderId = () => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

/** No response at all = the server was not reached (offline, DNS, timeout). */
export const isNetworkError = (error) =>
  Boolean(error) && !error.response && (error.code === "ERR_NETWORK" || error.code === "ECONNABORTED" || error.message === "Network Error" || (typeof navigator !== "undefined" && navigator.onLine === false));

export const getQueue = (tenantId = null) => read().filter((e) => !tenantId || !e.tenantId || String(e.tenantId) === String(tenantId));

export const subscribeQueue = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Store an order; returns the local token printed on the kitchen ticket. */
export const enqueueOrder = ({ clientOrderId, kind, args, summary, tenantId = null }) => {
  const list = read();
  const day = new Date().toISOString().slice(0, 10);
  const todays = list.filter((e) => String(e.createdAt || "").slice(0, 10) === day).length;
  const localToken = `OFF-${todays + 1}`;
  list.push({ clientOrderId, tenantId, kind, args, summary: summary || null, createdAt: new Date().toISOString(), localToken, status: "pending", error: null });
  write(list);
  return localToken;
};

export const removeFromQueue = (clientOrderId) => write(read().filter((e) => e.clientOrderId !== clientOrderId));

export const retryQueued = (clientOrderId) =>
  write(read().map((e) => (e.clientOrderId === clientOrderId ? { ...e, status: "pending", error: null } : e)));

/**
 * Send pending orders oldest-first. `senders` = { order: fn(...args), order_invoice: fn(...args) }.
 * Stops at the first network error (still offline); a server refusal marks
 * that order "failed" for a person to review.
 */
export const flushQueue = async (senders, { onSent, tenantId = null } = {}) => {
  if (flushing) return { sent: 0, failed: 0 };
  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    for (const entry of getQueue(tenantId).filter((e) => e.status === "pending")) {
      const send = senders[entry.kind];
      if (!send) continue;
      try {
        const res = await send(...entry.args);
        removeFromQueue(entry.clientOrderId);
        sent += 1;
        onSent?.(entry, res?.data);
      } catch (error) {
        if (isNetworkError(error)) break;
        failed += 1;
        write(
          read().map((e) =>
            e.clientOrderId === entry.clientOrderId
              ? { ...e, status: "failed", error: error?.response?.data?.message || error.message || "Refused by the server" }
              : e
          )
        );
      }
    }
  } finally {
    flushing = false;
  }
  return { sent, failed };
};

const INIT_CACHE_KEY = "restro_pos_init_cache_v1";

/** Last good POS start-up data, so a reload while offline still shows the menu. */
export const saveInitCache = (data) => {
  try {
    localStorage.setItem(INIT_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    /* quota: skip */
  }
};

export const loadInitCache = () => {
  try {
    const raw = localStorage.getItem(INIT_CACHE_KEY);
    return raw ? JSON.parse(raw)?.data || null : null;
  } catch {
    return null;
  }
};
