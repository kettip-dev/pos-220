import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useInvoiceAuditLogs({
  page = 1,
  perPage = 10,
  invoiceNumber = "",
  performedBy = "",
  action = "",
  type = "",
  from = null,
  to = null,
}) {
  const params = new URLSearchParams({
    page,
    perPage,
    ...(invoiceNumber ? { invoiceNumber } : {}),
    ...(performedBy ? { performedBy } : {}),
    ...(action ? { action } : {}),
    ...(type ? { type } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });

  const APIURL = `/invoice-audit-logs?${params.toString()}`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export async function getInvoiceAuditLogsForInvoice(invoiceId) {
  try {
    const res = await ApiClient.get(`/invoice-audit-logs/invoice/${invoiceId}`);
    return res;
  } catch (error) {
    throw error;
  }
}
