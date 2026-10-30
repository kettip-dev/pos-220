import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function usePurchaseOrders({
  page = 1,
  perPage = 10,
  status = "all",
  search = "",
  fromDate = "",
  toDate = "",
  vendorId = "",
}) {
  const query = new URLSearchParams({
    page,
    perPage,
    status,
    search,
    fromDate,
    toDate,
    vendorId,
  }).toString();

  const APIURL = `/purchase-orders?${query}`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);

  return {
    data,
    error,
    isLoading,
    APIURL,
    mutate,
  };
}

export async function createPurchaseOrder(payload) {
  try {
    const response = await ApiClient.post("/purchase-orders", payload);
    return response.data;
  } catch (error) {
    throw error;
  }
}

export async function fulfillPurchaseOrder(id) {
  try {
    const response = await ApiClient.patch(`/purchase-orders/${id}/receive`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

export async function cancelPurchaseOrder(id) {
  try {
    const response = await ApiClient.patch(`/purchase-orders/${id}/cancel`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

export async function getPurchaseOrderDetails(id) {
  try {
    const response = await ApiClient.get(`/purchase-orders/${id}`);
    return response.data?.purchaseOrder;
  } catch (error) {
    throw error;
  }
}
