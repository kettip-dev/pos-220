import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useLoyaltySettings() {
  const APIURL = "/loyalty/settings";
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return {
    data: data?.settings,
    error,
    isLoading,
    mutate,
    APIURL,
  };
}

export async function getLoyaltySettings() {
  const response = await ApiClient.get("/loyalty/settings");
  return response.data?.settings;
}

export async function updateLoyaltySettings(settings) {
  const response = await ApiClient.post("/loyalty/settings", settings);
  return response.data;
}

export function useCustomerLoyalty(phone) {
  const APIURL = phone ? `/loyalty/customer/${encodeURIComponent(phone)}` : null;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return {
    loyalty: data?.loyalty,
    error,
    isLoading,
    mutate,
  };
}

export async function getCustomerLoyalty(phone) {
  if (!phone) return null;
  const response = await ApiClient.get(`/loyalty/customer/${encodeURIComponent(phone)}`);
  return response.data?.loyalty;
}

export function useCustomerLoyaltyHistory(phone, { page = 1, limit = 20 } = {}) {
  const APIURL = phone
    ? `/loyalty/customer/${encodeURIComponent(phone)}/history?page=${page}&limit=${limit}`
    : null;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return {
    transactions: data?.transactions || [],
    total: data?.total || 0,
    totalPages: data?.totalPages || 1,
    page: data?.page || 1,
    error,
    isLoading,
    mutate,
    APIURL,
  };
}

export async function adjustCustomerPoints(phone, points, notes) {
  const response = await ApiClient.post(`/loyalty/customer/${encodeURIComponent(phone)}/adjust`, {
    points,
    notes,
  });
  return response.data;
}
