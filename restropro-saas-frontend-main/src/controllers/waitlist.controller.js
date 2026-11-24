import axios from "axios";
import useSWR from "swr";
import ApiClient from "../helpers/ApiClient";
import { API } from "../config/config";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useWaitlist() {
  const APIURL = `/waitlist`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher, {
    refreshInterval: 30000, // keep wait timers and missed socket events fresh
  });
  return { data, error, isLoading, mutate, APIURL };
}

export const addWaitlistEntry = (payload) => ApiClient.post("/waitlist/add", payload);
export const updateWaitlistEntry = (id, payload) => ApiClient.post(`/waitlist/${id}/update`, payload);
export const setWaitlistStatus = (id, status, tableId = null) =>
  ApiClient.post(`/waitlist/${id}/status`, { status, tableId });
export const notifyWaitlistEntry = (id) => ApiClient.post(`/waitlist/${id}/notify`);
export const deleteWaitlistEntry = (id) => ApiClient.delete(`/waitlist/${id}`);

export function useSmsSettings() {
  const APIURL = `/waitlist/sms-settings`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return { data, error, isLoading, mutate, APIURL };
}

export const updateSmsSettings = (payload) => ApiClient.post("/waitlist/sms-settings", payload).then((r) => r.data);
export const sendTestSms = (payload) => ApiClient.post("/waitlist/sms-test", payload).then((r) => r.data);

/** Guest status page: public, no login. */
export async function getPublicWaitlistStatus(code) {
  const res = await axios.get(`${API}/waitlist/public/${encodeURIComponent(code)}`, { withCredentials: false });
  return res.data;
}
