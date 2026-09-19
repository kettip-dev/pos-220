import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useKitchenStations() {
  const APIURL = `/kitchen-stations`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    mutate,
    APIURL,
  };
}

export async function getKitchenStations() {
  try {
    const res = await ApiClient.get("/kitchen-stations");
    return res;
  } catch (error) {
    throw error;
  }
}

export async function addKitchenStation({ name, color, icon, printer_id, is_enabled, sort_order }) {
  try {
    const response = await ApiClient.post("/kitchen-stations", {
      name,
      color,
      icon,
      printer_id,
      is_enabled,
      sort_order,
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function updateKitchenStation(id, updates) {
  try {
    const response = await ApiClient.post(`/kitchen-stations/${id}`, updates);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function deleteKitchenStation(id) {
  try {
    const response = await ApiClient.delete(`/kitchen-stations/${id}`);
    return response;
  } catch (error) {
    throw error;
  }
}
