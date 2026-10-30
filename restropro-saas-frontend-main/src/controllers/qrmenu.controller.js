import axios from "axios";
import { API } from "../config/config";

const CART_KEY = "RESTROPROSAAS__CART";
const TABLE_SESSION_PREFIX = "RESTROPROSAAS__QR_SESSION_";
const LAST_QR_ORDER_KEY = "RESTROPROSAAS__LAST_QR_ORDER";

export function getQRTableSession(qrcode) {
  if (!qrcode) return null;
  try {
    const raw = localStorage.getItem(`${TABLE_SESSION_PREFIX}${qrcode}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setQRTableSession(qrcode, sessionData) {
  if (!qrcode) return;
  try {
    localStorage.setItem(`${TABLE_SESSION_PREFIX}${qrcode}`, JSON.stringify(sessionData));
  } catch (e) {
    console.error(e);
  }
}

export function clearQRTableSession(qrcode) {
  if (!qrcode) return;
  try {
    localStorage.removeItem(`${TABLE_SESSION_PREFIX}${qrcode}`);
  } catch (e) {
    console.error(e);
  }
}

export function getLastQROrderReceipt() {
  try {
    const raw = localStorage.getItem(LAST_QR_ORDER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setLastQROrderReceipt(receiptData) {
  try {
    localStorage.setItem(LAST_QR_ORDER_KEY, JSON.stringify(receiptData));
  } catch (e) {
    console.error(e);
  }
}

export async function getQRMenuInit(qrcode, tableId, sessionToken = null) {
  axios.defaults.withCredentials = true;
  const params = new URLSearchParams();
  if (tableId) params.set("tableId", tableId);
  if (sessionToken) params.set("sessionToken", sessionToken);
  const queryString = params.toString();
  const response = await axios.get(`${API}/qrmenu/${qrcode}${queryString ? `?${queryString}` : ""}`);
  return response;
}

export async function verifyQRTablePin(qrcode, tableId, pin) {
  const response = await axios.post(`${API}/qrmenu/${qrcode}/verify-pin`, {
    tableId,
    pin,
  });
  return response;
}

export async function getQRLiveOrderStatus(qrcode, { tableId = null, sessionToken = null, qrOrderId = null } = {}) {
  const params = new URLSearchParams();
  if (tableId) params.set("tableId", tableId);
  if (sessionToken) params.set("sessionToken", sessionToken);
  if (qrOrderId) params.set("qrOrderId", qrOrderId);
  const response = await axios.get(`${API}/qrmenu/${qrcode}/live-status?${params.toString()}`);
  return response;
}

export function getCart() {
  try {
    const cartString = localStorage.getItem(CART_KEY);
    return cartString ? JSON.parse(cartString) : [];
  } catch {
    return [];
  }
}

export function setCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export async function createOrderFromQrMenu(
  deliveryType,
  cartItems,
  customerType,
  customer,
  tableId,
  qrcode,
  tablePin = null,
  sessionToken = null
) {
  const response = await axios.post(`${API}/qrmenu/${qrcode}/place-order`, {
    deliveryType,
    cartItems,
    customerType,
    customer,
    tableId,
    tablePin,
    sessionToken,
  });
  return response;
}

export async function callWaiterFromQrMenu(qrcode, { tableId = null, reason = "other", notes = "" } = {}) {
  const response = await axios.post(`${API}/qrmenu/${qrcode}/call-waiter`, {
    tableId,
    reason,
    notes,
  });
  return response;
}

export async function saveFeedback(
  qrcode,
  invoiceId,
  customerId,
  name,
  phone,
  email,
  birthdate,
  food_quality,
  service,
  ambiance,
  staff_behavior,
  recommend,
  remarks
) {
  const response = await axios.post(`${API}/qrmenu/${qrcode}/feedback`, {
    invoiceId,
    customerId,
    name,
    phone,
    email,
    birthdate,
    food_quality,
    service,
    ambiance,
    staff_behavior,
    recommend,
    remarks,
  });
  return response;
}
