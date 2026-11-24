import useSWR from "swr";
import ApiClient from "../helpers/ApiClient";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

/** All delivery apps (settings), or only active ones (POS) with activeOnly. */
export function useDeliveryPlatforms({ activeOnly = false } = {}) {
  const APIURL = `/delivery-platforms${activeOnly ? "?active=1" : ""}`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return { data: Array.isArray(data) ? data : [], error, isLoading, mutate, APIURL };
}

export const addDeliveryPlatform = (payload) => ApiClient.post("/delivery-platforms/add", payload);
export const updateDeliveryPlatform = (id, payload) => ApiClient.post(`/delivery-platforms/${id}/update`, payload);
export const deleteDeliveryPlatform = (id) => ApiClient.delete(`/delivery-platforms/${id}`);

/** Unit price after an app's markup, rounded to cents. */
export const applyMarkup = (price, markupPercent) =>
  Math.round(Number(price || 0) * (1 + Number(markupPercent || 0) / 100) * 100) / 100;

/** The order-endpoint fields for a selected delivery app (empty when none). */
export function deliveryAppPayload(app) {
  if (!app?.id) return {};
  return { deliveryPlatformId: app.id, platformOrderRef: app.ref || null };
}

/** "Grab #A1B2" style label for tickets and order cards. */
export const platformLabel = (name, ref) => [name, ref ? `#${ref}` : null].filter(Boolean).join(" ");

/** Common apps in Cambodia, offered as one-tap presets in settings. */
export const PLATFORM_PRESETS = [
  { name: "Grab", color: "#00B14F" },
  { name: "Foodpanda", color: "#D70F64" },
  { name: "Nham24", color: "#E4002B" },
  { name: "WOWNOW", color: "#F7B500" },
];
