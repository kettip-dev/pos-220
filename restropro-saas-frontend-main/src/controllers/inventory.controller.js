import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useInventoryItems({status}) {
  const APIURL = `/inventory?status=${status}`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export async function addInventoryItem({title, quantity, unit, min_quantity_threshold}) {
  try {
    const response = await ApiClient.post(`/inventory/add-item`, {
      title, quantity, unit, min_quantity_threshold
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function updateInventoryItem({id, title, unit, min_quantity_threshold}) {
  try {
    const response = await ApiClient.put(`/inventory/${id}`, {
      title, unit, min_quantity_threshold
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function addInventoryItemStockMovement({id, movementType, quantity, note }) {
  try {
    const response = await ApiClient.patch(`/inventory/${id}/add-stock-movement`, {
      movementType, quantity, note
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function deleteInventoryItem({id}) {
  try {
    const response = await ApiClient.delete(`/inventory/${id}`);
    return response;
  } catch (error) {
    throw error;
  }
}

export function useInventoryLogs({ type, from = null, to = null, movementType = null }) {
  const APIURL = `/inventory/logs?type=${type}&from=${from}&to=${to}&movementType=${movementType}`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export function useInventoryDashboard({ type, from = null, to = null}) {
  const APIURL = `/inventory/dashboard?type=${type}&from=${from}&to=${to}`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

// ----------------- STOCK ADJUSTMENTS ----------------- //

export function useStockAdjustments({ page = 1, limit = 10, search = "", status = "all", reason = "all", fromDate = "", toDate = "" } = {}) {
  const query = new URLSearchParams({
    page,
    limit,
    search: search || "",
    status: status || "all",
    reason: reason || "all",
    fromDate: fromDate || "",
    toDate: toDate || "",
  }).toString();

  const APIURL = `/inventory/adjustments?${query}`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    mutate,
    APIURL,
  };
}

export function useStockAdjustmentDetails(id) {
  const APIURL = id ? `/inventory/adjustments/${id}` : null;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return {
    adjustment: data?.adjustment,
    error,
    isLoading,
    mutate,
    APIURL,
  };
}

export async function createStockAdjustment({ adjustment_date, reason, status, notes, items }) {
  const response = await ApiClient.post("/inventory/adjustments", {
    adjustment_date,
    reason,
    status,
    notes,
    items,
  });
  return response.data;
}

export async function completeDraftAdjustment(id) {
  const response = await ApiClient.post(`/inventory/adjustments/${id}/complete`);
  return response.data;
}

export async function deleteStockAdjustment(id) {
  const response = await ApiClient.delete(`/inventory/adjustments/${id}`);
  return response.data;
}

// ----------------- STOCK TRANSFERS ----------------- //

export function useTransferBranches() {
  const APIURL = `/inventory/transfers/branches`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return {
    branches: data?.branches || [],
    error,
    isLoading,
    mutate,
    APIURL,
  };
}

export function useStockTransfers({ page = 1, limit = 10, search = "", status = "all", direction = "all", fromDate = "", toDate = "" } = {}) {
  const query = new URLSearchParams({
    page,
    limit,
    search: search || "",
    status: status || "all",
    direction: direction || "all",
    fromDate: fromDate || "",
    toDate: toDate || "",
  }).toString();

  const APIURL = `/inventory/transfers?${query}`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    mutate,
    APIURL,
  };
}

export function useStockTransferDetails(id) {
  const APIURL = id ? `/inventory/transfers/${id}` : null;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return {
    transfer: data?.transfer,
    error,
    isLoading,
    mutate,
    APIURL,
  };
}

export async function createStockTransfer({ to_tenant_id, transfer_date, status, notes, items }) {
  const response = await ApiClient.post("/inventory/transfers", {
    to_tenant_id,
    transfer_date,
    status,
    notes,
    items,
  });
  return response.data;
}

export async function dispatchDraftTransfer(id) {
  const response = await ApiClient.post(`/inventory/transfers/${id}/dispatch`);
  return response.data;
}

export async function receiveStockTransfer(id, items) {
  const response = await ApiClient.post(`/inventory/transfers/${id}/receive`, { items });
  return response.data;
}

export async function cancelStockTransfer(id) {
  const response = await ApiClient.post(`/inventory/transfers/${id}/cancel`);
  return response.data;
}
