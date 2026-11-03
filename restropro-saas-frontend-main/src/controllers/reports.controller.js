import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useReports({ type, from = null, to = null }) {
  const APIURL = `/reports?type=${type}&from=${from}&to=${to}`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export function useReport({ reportId, type, from = null, to = null }) {
  const APIURL = reportId ? `/reports/${reportId}?type=${type}&from=${from}&to=${to}` : null;
  // Keep the previous range on screen while a new range loads, so switching
  // date filters doesn't blank the whole report.
  const { data, error, isLoading, isValidating, mutate } = useSWR(APIURL, fetcher, { keepPreviousData: true });
  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
    APIURL,
  };
}
