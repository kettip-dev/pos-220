import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export const REGISTER_STATUS_URL = "/register/status";

export function useRegisterStatus() {
  const { data, error, isLoading, mutate } = useSWR(REGISTER_STATUS_URL, fetcher, { revalidateOnFocus: true });
  return { data, error, isLoading, mutate };
}

export function useRegisters() {
  const APIURL = "/register/registers";
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return { data, error, isLoading, mutate, APIURL };
}

export function useRegisterSettings() {
  const APIURL = "/register/settings";
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return { data, error, isLoading, mutate, APIURL };
}

export function useRegisterSessions({ from = "", to = "", registerId = "" } = {}) {
  const APIURL = `/register/sessions?from=${from || ""}&to=${to || ""}&registerId=${registerId || ""}`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return { data, error, isLoading, mutate, APIURL };
}

export function useBusinessDays() {
  const APIURL = "/register/days";
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return { data, error, isLoading, mutate, APIURL };
}

export const updateRegisterSettings = (settings) => ApiClient.put("/register/settings", settings);
export const addRegister = (name, printerId = null) => ApiClient.post("/register/registers", { name, printerId });
export const updateRegister = (id, { name, printerId = null, isActive = true }) =>
  ApiClient.put(`/register/registers/${id}`, { name, printerId, isActive });
export const deleteRegister = (id) => ApiClient.delete(`/register/registers/${id}`);
export const setPaymentTypeCash = (id, isCash) => ApiClient.put(`/register/payment-types/${id}/cash`, { isCash });
export const getSuggestedFloat = (registerId) => ApiClient.get(`/register/registers/${registerId}/suggested-float`);

export const openRegisterSession = ({ registerId, floatPrimary, floatSecondary, denominations, exchangeRate }) =>
  ApiClient.post("/register/sessions/open", { registerId, floatPrimary, floatSecondary, denominations, exchangeRate });
export const getSessionSummary = (sessionId) => ApiClient.get(`/register/sessions/${sessionId}/summary`);
export const getSessionAudit = (sessionId) => ApiClient.get(`/register/sessions/${sessionId}/audit`);
export const addCashMovement = (sessionId, movement) => ApiClient.post(`/register/sessions/${sessionId}/movements`, movement);
export const handoverRegisterSession = (sessionId, toUser) => ApiClient.post(`/register/sessions/${sessionId}/handover`, { toUser });
export const closeRegisterSession = (sessionId, payload) => ApiClient.post(`/register/sessions/${sessionId}/close`, payload);
export const reopenRegisterSession = (sessionId, reason) => ApiClient.post(`/register/sessions/${sessionId}/reopen`, { reason });

export const getDayCloseChecklist = () => ApiClient.get("/register/day/checklist");
export const closeBusinessDay = (carryOverOpenOrders = false) => ApiClient.post("/register/day/close", { carryOverOpenOrders });

export const getRefundableItems = (invoiceId) => ApiClient.get(`/invoices/${invoiceId}/refundable`);
export const refundInvoice = (invoiceId, payload) => ApiClient.post(`/invoices/${invoiceId}/refund`, payload);

/** True when a failed request was refused because no register is open. */
export const isRegisterClosedError = (error) => error?.response?.status === 409 && error?.response?.data?.code === "REGISTER_CLOSED";
