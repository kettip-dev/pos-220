import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useCustomers({ page = 1, perPage = 10, filter = "", sort = "created_at" }) {
  const APIURL = `/customers?sort=${sort}&page=${page}&filter=${filter}&perPage=${perPage}`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export async function searchCustomer(search) {
  try {
    const response = await ApiClient.get(`/customers/search-by-phone-name/search?q=${search}`);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function getAllCustomers() {
  try {
    const response = await ApiClient.get(`/customers/download/all`);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function uploadBulkCustomers(customers) {
  try {
    const response = await ApiClient.post(`/customers/upload/bulk`, {customers});
    return response;
  } catch (error) {
    throw error;
  }
}

export async function addCustomer(phone, name, email, birthDate, gender, customerGroupId = null) {
  try {
    const response = await ApiClient.post("/customers/add", {
      phone,
      name,
      email,
      birthDate,
      gender,
      customerGroupId,
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function updateCustomer(phone, name, email, birthDate, gender, customerGroupId = undefined) {
  try {
    const response = await ApiClient.post(`/customers/${phone}/update`, {
      name,
      email,
      birthDate,
      gender,
      customerGroupId,
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function deleteCustomer(id) {
  try {
    const response = await ApiClient.delete(`/customers/${id}/delete`)
    return response;
  } catch (error) {
    throw error;
  }
};

export function useCustomer(phone) {
  const APIURL = phone ? `/customers/${phone}` : null;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export function useCustomerInsights(phone) {
  const APIURL = phone ? `/customers/${phone}/insights` : null;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export function useCustomerInvoices(phone, page = 1, limit = 10) {
  const APIURL = phone ? `/customers/${phone}/invoices?page=${page}&limit=${limit}` : null;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

/** Customer 360: profile, KPIs, habits, favourites, dues, reservations, feedback and timeline in one call. */
export function useCustomer360(phone) {
  const APIURL = phone ? `/customers/${encodeURIComponent(phone)}/360` : null;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return { data, error, isLoading, mutate, APIURL };
}

/** Save staff notes, allergy warning and tags for a customer. */
export async function saveCustomerProfileNotes(phone, { notes, allergies, tags }) {
  return ApiClient.post(`/customers/${encodeURIComponent(phone)}/profile-notes`, { notes, allergies, tags });
}
