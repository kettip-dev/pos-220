import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useTelegramSettings() {
  const APIURL = `/telegram/settings`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    mutate,
    APIURL,
  };
}

export async function getTelegramSettings() {
  try {
    const res = await ApiClient.get("/telegram/settings");
    return res.data;
  } catch (error) {
    throw error;
  }
}

export async function updateTelegramSettings(payload) {
  try {
    const res = await ApiClient.post("/telegram/settings", payload);
    return res.data;
  } catch (error) {
    throw error;
  }
}

export async function testTelegramConnection(payload) {
  try {
    const res = await ApiClient.post("/telegram/test", payload);
    return res.data;
  } catch (error) {
    throw error;
  }
}

export async function sendManualEodReport(payload = {}) {
  try {
    const res = await ApiClient.post("/telegram/send-eod", payload);
    return res.data;
  } catch (error) {
    throw error;
  }
}
