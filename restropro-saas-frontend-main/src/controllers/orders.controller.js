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
    discountTotal,
    appliedPromotions = null,
    promotionDiscountTotal = 0,
    loyaltyPointsRedeemed = 0,
    customerId = null,
    customerGroupId = null,
    customerGroupName = null,
    customerGroupDiscountTotal = 0
) {
    try {
        const response = await ApiClient.post(`/orders/complete-and-pay-order`, {
            orderIds,
            subTotal, taxTotal, serviceChargeTotal, total,
            selectedPaymentType,
            discountType, discountValue, discountTotal,
            appliedPromotions, promotionDiscountTotal,
            loyaltyPointsRedeemed, customerId,
            customerGroupId, customerGroupName, customerGroupDiscountTotal
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

export async function createSplitSubInvoices(orderId, splitMode, splits) {
    try {
        const response = await ApiClient.post(`/orders/split-sub-invoices`, {
            orderId,
            splitMode,
            splits,
        });
        return response;
    } catch (error) {
        throw error;
    }
}

export async function getOrderSubInvoices(orderId) {
    try {
        const response = await ApiClient.get(`/orders/sub-invoices/${orderId}`);
        return response;
    } catch (error) {
        throw error;
    }
}

export async function settleSubInvoice(subInvoiceId, paymentTypeId, paymentTypeTitle, tipAmount = 0, notes = null) {
    try {
        const response = await ApiClient.post(`/orders/settle-sub-invoice`, {
            subInvoiceId,
            paymentTypeId,
            paymentTypeTitle,
            tipAmount,
            notes,
        });
        return response;
    } catch (error) {
        throw error;
    }
}

export async function cancelSplitPlan(orderId) {
    try {
        const response = await ApiClient.post(`/orders/cancel-split-plan`, {
            orderId,
        });
        return response;
    } catch (error) {
        throw error;
    }
}

export async function mergeTables(sourceTableId, destinationTableId, floor) {
    try {
        const response = await ApiClient.post(`/orders/merge-tables`, {
            sourceTableId,
            destinationTableId,
            floor,
        });
        return response;
    } catch (error) {
        throw error;
    }
}

export async function unlinkTables(tableAId, tableBId, floor) {
    try {
        const response = await ApiClient.post(`/orders/unlink-tables`, {
            tableAId,
            tableBId,
            floor,
        });
        return response;
    } catch (error) {
        throw error;
    }
}

