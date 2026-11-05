import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

/**
 * Pay Later (customer credit / house accounts).
 * Customers are addressed by phone, the customers table's key.
 */

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useOutstandingCustomers(search = "") {
  const params = new URLSearchParams(search ? { q: search } : {});
  const APIURL = `/customers/credit/outstanding${params.toString() ? `?${params}` : ""}`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return { data, error, isLoading, mutate, APIURL };
}

export function useCustomerCredit(phone) {
  const APIURL = phone ? `/customers/${encodeURIComponent(phone)}/credit` : null;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return { data, error, isLoading, mutate, APIURL };
}

export async function collectCustomerPayment(phone, { amount, paymentTypeId, reference, note, tender, invoiceIds }) {
  return ApiClient.post(`/customers/${encodeURIComponent(phone)}/credit/payments`, {
    amount, paymentTypeId, reference, note, tender, invoiceIds,
  });
}

export async function writeOffInvoiceBalance(phone, invoiceId, reason) {
  return ApiClient.post(`/customers/${encodeURIComponent(phone)}/credit/write-off`, { invoiceId, reason });
}

export async function setCustomerCreditLimit(phone, creditLimit) {
  return ApiClient.post(`/customers/${encodeURIComponent(phone)}/credit-limit`, { creditLimit });
}

/** Error text the server sent for a refused pay-later / collection request. */
export const creditErrorMessage = (error, fallback) =>
  error?.response?.data?.message || fallback;
