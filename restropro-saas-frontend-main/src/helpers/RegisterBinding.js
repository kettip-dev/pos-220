// Which till this device is. Stored per device (not per user) so a tablet stays
// bound to "Front Counter" across cashier logins.
const REGISTER_KEY = "RESTROPROSAAS__REGISTER_ID";

export function getBoundRegisterId() {
  try {
    const value = parseInt(localStorage.getItem(REGISTER_KEY), 10);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch (_) {
    return null;
  }
}

export function setBoundRegisterId(registerId) {
  try {
    if (registerId) localStorage.setItem(REGISTER_KEY, String(registerId));
    else localStorage.removeItem(REGISTER_KEY);
  } catch (_) {}
}
