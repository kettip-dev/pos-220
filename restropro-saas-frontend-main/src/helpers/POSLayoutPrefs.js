import { useEffect, useState } from "react";

// Per-terminal POS layout & display preferences. Stored on the device (not the
// tenant) so each screen can match its counter, its size and its staff.
const TICKET_SIDE_KEY = "restro_pos_ticket_side";
const DISPLAY_PREFS_KEY = "restro_pos_display_prefs";
const CHANGE_EVENT = "restro:pos-layout-changed";

export const TICKET_SIDES = { LEFT: "left", RIGHT: "right" };
export const TILE_SIZES = { SMALL: "small", MEDIUM: "medium", LARGE: "large" };

export const DEFAULT_DISPLAY_PREFS = {
  tileSize: TILE_SIZES.MEDIUM, // menu tile size
  showImages: true, // photo tiles; off = colour-coded text tiles (fastest to scan)
  showPrice: true,
  showCategory: true, // category name under the item (only in "All" / Favorites)
};

function notify() {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function useStoredValue(read, storageKey) {
  const [value, setValue] = useState(read);
  useEffect(() => {
    const sync = () => setValue(read());
    const onStorage = (e) => {
      if (e.key === storageKey) sync();
    };
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

// ─── Ticket side ──────────────────────────────────────────

export function getTicketSide() {
  try {
    return localStorage.getItem(TICKET_SIDE_KEY) === TICKET_SIDES.LEFT
      ? TICKET_SIDES.LEFT
      : TICKET_SIDES.RIGHT;
  } catch {
    return TICKET_SIDES.RIGHT;
  }
}

export function setTicketSide(side) {
  const value = side === TICKET_SIDES.LEFT ? TICKET_SIDES.LEFT : TICKET_SIDES.RIGHT;
  try {
    localStorage.setItem(TICKET_SIDE_KEY, value);
  } catch {
    // storage unavailable: preference lasts for this page only
  }
  notify();
}

export function useTicketSide() {
  return [useStoredValue(getTicketSide, TICKET_SIDE_KEY), setTicketSide];
}

// ─── Menu tile display ────────────────────────────────────

export function getDisplayPrefs() {
  try {
    const stored = JSON.parse(localStorage.getItem(DISPLAY_PREFS_KEY) || "{}");
    const prefs = { ...DEFAULT_DISPLAY_PREFS, ...(stored && typeof stored === "object" ? stored : {}) };
    if (!Object.values(TILE_SIZES).includes(prefs.tileSize)) prefs.tileSize = DEFAULT_DISPLAY_PREFS.tileSize;
    ["showImages", "showPrice", "showCategory"].forEach((k) => {
      prefs[k] = prefs[k] !== false;
    });
    return prefs;
  } catch {
    return { ...DEFAULT_DISPLAY_PREFS };
  }
}

export function setDisplayPrefs(patch) {
  const next = patch === null ? { ...DEFAULT_DISPLAY_PREFS } : { ...getDisplayPrefs(), ...patch };
  try {
    localStorage.setItem(DISPLAY_PREFS_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable
  }
  notify();
}

/** [prefs, update(patch) | update(null) to reset] */
export function useDisplayPrefs() {
  return [useStoredValue(getDisplayPrefs, DISPLAY_PREFS_KEY), setDisplayPrefs];
}
