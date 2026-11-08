import ApiClient from "../helpers/ApiClient";

const DRAFTS_KEY = "RESTROPROSAAS__DRAFTS";

export async function initPOS() {
    try {
      const response = await ApiClient.get("/pos/init");
      return response;
    } catch (error) {
      throw error;
    }
}

export async function createOrder(cart, deliveryType, customerType, customerId, tableId, selectedQrOrderItem, appliedPromotions = null, promotionDiscountTotal = 0, customerGroupId = null, customerGroupName = null, customerGroupDiscountTotal = 0, clientOrderId = null) {
  try {
    const response = await ApiClient.post("/pos/create-order", {
      cart, deliveryType, customerType, customerId, tableId, selectedQrOrderItem,
      appliedPromotions, promotionDiscountTotal,
      customerGroupId, customerGroupName, customerGroupDiscountTotal,
      clientOrderId
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function createOrderAndInvoice(cart, deliveryType, customerType, customerId, tableId, netTotal, taxTotal, serviceChargeTotal, total, selectedQrOrderItem, selectedPaymentType, discountType, discountValue, discountTotal, appliedPromotions = null, promotionDiscountTotal = 0, loyaltyPointsRedeemed = 0, customerGroupId = null, customerGroupName = null, customerGroupDiscountTotal = 0, payments = null, payLater = null, clientOrderId = null) {
  try {
    const response = await ApiClient.post("/pos/create-order-and-invoice", {
      clientOrderId,
      cart, deliveryType, customerType, customerId, tableId,
      netTotal, taxTotal, serviceChargeTotal, total, selectedQrOrderItem, selectedPaymentType,
      discountType, discountValue, discountTotal,
      appliedPromotions, promotionDiscountTotal,
      loyaltyPointsRedeemed,
      customerGroupId, customerGroupName, customerGroupDiscountTotal,
      payments,
      payLater
    });
    return response;
  } catch (error) {
    throw error;
  }
}

// drafts
/**
 * @returns {Array}
 *  */
export function getDrafts() {
  const draftsString = localStorage.getItem(DRAFTS_KEY);
  const drafts = draftsString ? JSON.parse(draftsString) : [];
  return drafts;
}

/**
 * @param {Array} drafts
 *  */
export function setDrafts(drafts) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}
// drafts

// qr orders
export async function getQROrdersCount() {
  try {
    const response = await ApiClient.get("/pos/qrorders/count");
    return response;
  } catch (error) {
    throw error;
  }
}
export async function getQROrders() {
  try {
    const response = await ApiClient.get("/pos/qrorders");
    return response;
  } catch (error) {
    throw error;
  }
}

export async function cancelAllQROrders() {
  try {
    const response = await ApiClient.post("/pos/qrorders/cancel-all");
    return response;
  } catch (error) {
    throw error;
  }
}

export async function cancelQROrder(orderId) {
  try {
    const response = await ApiClient.post(`/pos/qrorders/update-status/${orderId}`, {
      status: "cancelled"
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function approveQROrder(orderId) {
  try {
    const response = await ApiClient.post(`/pos/qrorders/approve/${orderId}`);
    return response;
  } catch (error) {
    throw error;
  }
}
// qr orders

// ─── Menu availability (86 board) ─────────────────────────
export async function updateMenuAvailability(itemId, { isSoldOut, stockLimit, autoReset } = {}) {
  return ApiClient.patch(`/pos/menu-availability/${itemId}`, { isSoldOut, stockLimit, autoReset });
}

export async function resetMenuAvailability(scope = "all") {
  return ApiClient.post(`/pos/menu-availability/reset`, { scope });
}

// ─── Line comp / void / discount ──────────────────────────
export async function authorizeLineAdjustment(payload) {
  return ApiClient.post(`/pos/line-adjustments/authorize`, payload);
}

export async function adjustOrderItem(orderItemId, payload) {
  return ApiClient.post(`/pos/order-items/${orderItemId}/adjust`, payload);
}

export async function getLineAdjustments(from, to) {
  return ApiClient.get(`/pos/line-adjustments`, { params: { from, to } });
}

// ─── Hold & fire courses ──────────────────────────────────
export async function fireOrderItems(orderId, course = null, itemIds = null) {
  return ApiClient.post(`/pos/orders/${orderId}/fire`, { course, itemIds });
}

// ─── Combos / set meals ───────────────────────────────────
export async function getCombos() {
  return ApiClient.get(`/pos/combos`);
}

export async function saveCombo(id, payload) {
  return id ? ApiClient.put(`/pos/combos/${id}`, payload) : ApiClient.post(`/pos/combos`, payload);
}

export async function deleteCombo(id) {
  return ApiClient.delete(`/pos/combos/${id}`);
}

// ─── Selling aids ─────────────────────────────────────────
export async function getUpsellPairs() {
  return ApiClient.get(`/pos/upsell-pairs`);
}

export async function getCustomerLastOrder(phone) {
  return ApiClient.get(`/pos/customers/${encodeURIComponent(phone)}/last-order`);
}

// ─── Gift cards ───────────────────────────────────────────
export async function getGiftCards(search = "") {
  return ApiClient.get(`/pos/gift-cards`, { params: { search } });
}

export async function lookupGiftCard(code) {
  return ApiClient.get(`/pos/gift-cards/${encodeURIComponent(String(code || "").trim())}`);
}

export async function issueGiftCard(payload) {
  return ApiClient.post(`/pos/gift-cards`, payload);
}
