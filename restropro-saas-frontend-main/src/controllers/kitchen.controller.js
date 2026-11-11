import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useKitchenOrders() {
  const APIURL = `/kitchen`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export async function getKitchenOrders() {
  try {
    const res = await ApiClient.get("/kitchen");
    return res;
  } catch (error) {
    throw error;
  }
}

export async function updateKitchenOrderItemStatus(
  orderItemId,
  status
) {
  try {
    const response = await ApiClient.post(`/kitchen/${orderItemId}`, {
      status
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function bulkUpdateKitchenOrderItemStatus(orderItemIds, status) {
  try {
    const response = await ApiClient.post("/kitchen/bulk-update-status", {
      orderItemIds,
      status,
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function markOrderAllItemsStatus(orderId, status, fromStatuses, stationId = null) {
  try {
    const response = await ApiClient.post(`/kitchen/order/${orderId}/mark-all`, {
      status,
      fromStatuses,
      stationId,
    });
    return response;
  } catch (error) {
    throw error;
  }
}

/** Add (or remove, with a negative value) cooking time on open lines; `clear` resets it. */
export async function addKitchenDelay({ orderItemIds, minutes, reasonId = null, clear = false }) {
  return ApiClient.post("/kitchen/delay", { orderItemIds, minutes, reasonId, clear });
}

export async function getKitchenDelayReasons() {
  return ApiClient.get("/kitchen/delay-reasons");
}

export async function saveKitchenDelayReasons(reasons) {
  return ApiClient.put("/kitchen/delay-reasons", { reasons });
}
