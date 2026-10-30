import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function usePromotions(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.append("search", params.search);
  if (params.status) query.append("status", params.status);

  const queryString = query.toString();
  const APIURL = `/promotions${queryString ? `?${queryString}` : ""}`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);

  return {
    promotions: data?.promotions || [],
    stats: data?.stats || {
      totalPromos: 0,
      activePromos: 0,
      totalRedemptions: 0,
      totalDiscountGiven: 0,
    },
    error,
    isLoading,
    mutate,
    APIURL,
  };
}

export function useActivePromotions() {
  const APIURL = `/promotions/active`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);

  return {
    promotions: data?.promotions || [],
    error,
    isLoading,
    mutate,
  };
}

export async function getPromotions(params = {}) {
  const res = await ApiClient.get("/promotions", { params });
  return res.data;
}

export async function getPromotionById(id) {
  const res = await ApiClient.get(`/promotions/${id}`);
  return res.data;
}

export async function createPromotion(data) {
  const res = await ApiClient.post("/promotions", data);
  return res.data;
}

export async function updatePromotion(id, data) {
  const res = await ApiClient.put(`/promotions/${id}`, data);
  return res.data;
}

export async function togglePromotionStatus(id, isActive) {
  const res = await ApiClient.patch(`/promotions/${id}/status`, { is_active: isActive });
  return res.data;
}

export async function deletePromotion(id) {
  const res = await ApiClient.delete(`/promotions/${id}`);
  return res.data;
}

export async function evaluateCartPromotionsApi({ cartItems, diningOption, enteredCode }) {
  const res = await ApiClient.post("/promotions/evaluate", {
    cartItems,
    diningOption,
    enteredCode,
  });
  return res.data;
}
