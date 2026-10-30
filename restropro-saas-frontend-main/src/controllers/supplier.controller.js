import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useSuppliers({ page = 1, perPage = 10, search = "" }) {
  const APIURL = `/vendors?page=${page}&perPage=${perPage}&search=${encodeURIComponent(search)}`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
    mutate,
  };
}

export function useSuppliersSimple() {
  const APIURL = `/vendors/simple-list`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    suppliers: data?.vendors || [],
    error,
    isLoading,
  };
}

export async function addSupplier(payload) {
  try {
    const response = await ApiClient.post("/vendors", payload);
    return response.data;
  } catch (error) {
    throw error;
  }
}

export async function updateSupplier(id, payload) {
  try {
    const response = await ApiClient.put(`/vendors/${id}`, payload);
    return response.data;
  } catch (error) {
    throw error;
  }
}

export async function deleteSupplier(id) {
  try {
    const response = await ApiClient.delete(`/vendors/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

export async function getSupplierDetails(id) {
  try {
    const response = await ApiClient.get(`/vendors/${id}`);
    return response.data?.vendor;
  } catch (error) {
    throw error;
  }
}
