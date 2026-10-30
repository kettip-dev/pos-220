import ApiClient from "../helpers/ApiClient";

export async function getOrders() {
    try {
        const res = await ApiClient.get("/orders");
        return res;
    } catch (error) {
        throw error;
    }
}

export async function getOrdersInit() {
    try {
        const res = await ApiClient.get("/orders/init");
        return res;
    } catch (error) {
        throw error;
    }
}

export async function updateKitchenOrderItemStatus(
    orderItemId,
    status
) {
    try {
        const response = await ApiClient.post(`/orders/update-status/${orderItemId}`, {
            status
        });
        return response;
    } catch (error) {
        throw error;
    }
}

/**
 * @param {Array<Number>} orderIds - list of orders to cancel
 *  */
export async function cancelKitchenOrder(
    orderIds,
) {
    try {
        const response = await ApiClient.post(`/orders/cancel`, {
            orderIds
        });
        return response;
    } catch (error) {
        throw error;
    }
}

/**
 * @param {Array<Number>} orderIds - list of orders to cancel
 *  */
export async function completeKitchenOrder(
    orderIds,
) {
    try {
        const response = await ApiClient.post(`/orders/complete`, {
            orderIds
        });
        return response;
    } catch (error) {
        throw error;
    }
}

export async function getCompleteOrderPaymentSummary(orderIds) {
    try {
        const res = await ApiClient.post("/orders/complete-order-payment-summary", {
            orderIds
        });
        return res;
    } catch (error) {
        throw error;
    }
}

export async function getInvoiceIdFromOrderId(orderIds) {
    try {
        const res = await ApiClient.post("/orders/get-invoice-id", {
            orderIds
        });
        return res;
    } catch (error) {
        throw error;
    }
}

/**
 * @param {Array<Number>} orderIds - list of orders to cancel
 * @param {Number} subTotal
 * @param {Number} taxTotal
 * @param {Number} total
 *  */
export async function payAndCompleteKitchenOrder(
    orderIds,
    subTotal,
    taxTotal,
    serviceChargeTotal,
    total,
    selectedPaymentType,
    discountType,
    discountValue,
    discountTotal
) {
    try {
        const response = await ApiClient.post(`/orders/complete-and-pay-order`, {
            orderIds,
            subTotal, taxTotal, serviceChargeTotal, total,
            selectedPaymentType,
            discountType, discountValue, discountTotal
        });
        return response;
    } catch (error) {
        throw error;
    }
}

export async function updateOrderCustomer(orderId, customerPhone, customerType) {
    try {
        const response = await ApiClient.post(`/orders/update-order-customer`, {
            orderId,
            customerPhone,
            customerType,
        });
        return response;
    } catch (error) {
        throw error;
    }
}

export async function transferTableOrder(sourceTableId, destinationTableId) {
    try {
        const response = await ApiClient.post(`/orders/transfer-table`, {
            sourceTableId,
            destinationTableId,
        });
        return response;
    } catch (error) {
        throw error;
    }
}

export async function moveOrderItems(sourceOrderId, destinationTableId, items) {
    try {
        const response = await ApiClient.post(`/orders/move-items`, {
            sourceOrderId,
            destinationTableId,
            items,
        });
        return response;
    } catch (error) {
        throw error;
    }
}

export async function splitCheckByItems(sourceOrderId, items) {
    try {
        const response = await ApiClient.post(`/orders/split-check`, {
            sourceOrderId,
            items,
        });
        return response;
    } catch (error) {
        throw error;
    }
}

