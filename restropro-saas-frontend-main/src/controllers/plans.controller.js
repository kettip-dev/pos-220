import axios from "axios";
import { API } from "../config/config";
import apiClient from "../helpers/ApiClient";

export async function getPlans() {
    axios.defaults.withCredentials = true;
    try {
        const response = await apiClient.get(`/plans`);
        return response;
    } catch (error) {
        throw error;
    }
}

export async function getPlanById(id) {
    axios.defaults.withCredentials = true;
    try {
        const response = await apiClient.get(`/plans/${id}`);
        return response;
    } catch (error) {
        throw error;
    }
}

export async function getSubscriptionHistory(id) {
    axios.defaults.withCredentials = true;
    try {
        const response = await apiClient.get(`/plans/subscription-history/${id}`);
        return response;
    } catch (error) {
        throw error;
    }
}

export async function addPlan(payload) {
    // axios.defaults.withCredentials = true;
    try {
        const response = await apiClient.post(`/plans/`, payload);
        return response;
    } catch (error) {
        throw error;
    }
}

export async function getUserCountry() {
    try {
        const response = await apiClient.get(`/plans/country-details`);
        return response;
    } catch (error) {
        console.error("IP API error:", error);
        throw error;
    }
}

export async function getManageSubscriptionLink(stripeCustomerId) {
    try {
        const response = await apiClient.post(
            `/plans/stripe/manage-subscription`,
            { stripeCustomerId }
        );
        return response;
    } catch (error) {
        console.error("Stripe manage-subscription error:", error);
        throw error;
    }
}

export async function getPaystackManageSubscriptionLink(paymentCustomerId) {
    try {
        const response = await apiClient.get(
            `/plans/paystack/manage-subscription`,
            { paymentCustomerId }
        );
        return response;
    } catch (error) {
        console.error("Paystack manage-subscription error:", error);
        throw error;
    }
}

export async function updatePlan(id, payload) {
    axios.defaults.withCredentials = true;
    try {
        const response = await apiClient.put(`/plans/${id}`, payload);
        return response;
    } catch (error) {
        throw error;
    }
}

export async function deletePlan(id) {
    axios.defaults.withCredentials = true;
    try {
        const response = await apiClient.delete(`/plans/${id}`);
        return response;
    } catch (error) {
        throw error;
    }
}

// Paystack: delete a plan on Paystack
export async function deletePaystackPlan(id) {
    axios.defaults.withCredentials = true;
    try {
        const response = await apiClient.delete(`/plans/paystack/delete-plan/${id}`);
        return response;
    } catch (error) {
        throw error;
    }
}

// Paystack: update a plan on Paystack
export async function updatePaystackPlan(id, payload) {
    axios.defaults.withCredentials = true;
    try {
        const response = await apiClient.put(`/plans/paystack/update-plan/${id}`, payload);
        return response;
    } catch (error) {
        throw error;
    }
}

// Paystack: create a plan on Paystack
export async function createPaystackPlan(payload) {
    axios.defaults.withCredentials = true;
    try {
        const response = await apiClient.post(`/plans/paystack/create-plan`, payload);
        return response;
    } catch (error) {
        throw error;
    }
}

// Paystack: create a payment link 
export async function createPaystackPaymentLink(planId) {
    axios.defaults.withCredentials = true;
    try {
        const response = await apiClient.post(`/plans/paystack/create-payment-link`, {
            id: planId,
        });
        return response;
    } catch (error) {
        throw error;
    }
}
