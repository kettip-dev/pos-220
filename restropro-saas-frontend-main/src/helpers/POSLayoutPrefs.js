import { useEffect, useState } from "react";

// Per-terminal POS layout preference. Stored on the device (not the tenant)
// so each tablet can match its counter: e.g. ticket on the side nearest the
// customer, or swapped for left-handed staff.
const TICKET_SIDE_KEY = "restro_pos_ticket_side";
const CHANGE_EVENT = "restro:pos-layout-changed";

export const TICKET_SIDES = { LEFT: "left", RIGHT: "right" };

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
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: value }));
}

export function useTicketSide() {
  const [side, setSide] = useState(getTicketSide);

  useEffect(() => {
    const sync = () => setSide(getTicketSide());
    const onStorage = (e) => {
      if (e.key === TICKET_SIDE_KEY) sync();
    };
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return [side, setTicketSide];
}
