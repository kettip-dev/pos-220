const KEY = 'restroprosaas_user';

export function saveUserDetailsInLocalStorage(user) {
  localStorage.setItem(KEY, JSON.stringify(user));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("user-details-updated", { detail: user }));
  }
}

export function updateUserDetailsInLocalStorage(partial) {
  const current = getUserDetailsInLocalStorage() || {};
  const updated = { ...current, ...partial };
  saveUserDetailsInLocalStorage(updated);
  return updated;
}

export function getUserDetailsInLocalStorage() {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem(KEY);
  if (!userStr || userStr === "undefined") return null;

  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function clearUserDetailsInLocalStorage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("user-details-updated", { detail: null }));
}
