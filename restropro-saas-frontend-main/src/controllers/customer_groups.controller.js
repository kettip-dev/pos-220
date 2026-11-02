import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useCustomerGroups() {
  const APIURL = "/customer-groups";
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);

  return {
    customerGroups: data?.customer_groups || [],
    error,
    isLoading,
    mutate,
    APIURL,
  };
}

export async function getCustomerGroups() {
  const res = await ApiClient.get("/customer-groups");
  return res.data;
}

export async function getCustomerGroupById(id) {
  const res = await ApiClient.get(`/customer-groups/${id}`);
  return res.data;
}

export async function createCustomerGroup(data) {
  const res = await ApiClient.post("/customer-groups", data);
  return res.data;
}

export async function updateCustomerGroup(id, data) {
  const res = await ApiClient.put(`/customer-groups/${id}`, data);
  return res.data;
}

export async function deleteCustomerGroup(id, reassignTo = "none") {
  const res = await ApiClient.delete(`/customer-groups/${id}`, {
    params: { reassign_to: reassignTo },
  });
  return res.data;
}

export async function bulkAssignCustomerGroup(customerPhones, customerGroupId) {
  const res = await ApiClient.post("/customer-groups/bulk-assign", {
    customerPhones,
    customerGroupId,
  });
  return res.data;
}
