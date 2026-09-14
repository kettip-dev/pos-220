import ApiClient from "../helpers/ApiClient";
import axios from "axios";
import { API } from "../config/config";
import { clearUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { clearBusinessScope } from "../helpers/BusinessScope";
import useSWR from "swr";

export async function signIn(username, password) {
    axios.defaults.withCredentials = true;
    try {
        const response = await axios.post(`${API}/auth/signin`, {
            username, password
        });

        return response;
    } catch (error) {
        throw error;
    }
}

export async function signUp(biz_name, username, password) {
    axios.defaults.withCredentials = true;
    try {
        const response = await axios.post(`${API}/auth/signup`, {
            biz_name, username, password
        });

        return response;
    } catch (error) {
        throw error;
    }
}

export async function signOut() {
    axios.defaults.withCredentials = true;
    try {
        const response = await ApiClient.post(`/auth/signout`);

        return response;
    } catch (error) {
        throw error;
    } finally {
        // Always drop the cached identity, even when the request fails. If the
        // account was just deleted or deactivated server-side, the call can
        // error — and leaving the stale user behind would let the login screen
        // bounce back into the dashboard with the previous user's context.
        clearUserDetailsInLocalStorage();
        // The All Businesses / single-business preference belongs to the
        // session that just ended. Without this, the next Business Group Owner
        // to sign in on this browser inherits the previous owner's scope.
        clearBusinessScope();
    }
}

export async function forgotPassword(email) {
    axios.defaults.withCredentials = true;
    try {
        const response = await axios.post(`${API}/auth/forgot-password`, {
            username: email
        });

        return response;
    } catch (error) {
        throw error;
    }
}

export async function resetPassword(token, password) {
    axios.defaults.withCredentials = true;
    try {
        const response = await axios.post(`${API}/auth/reset-password/${token}`, {
            password
        });

        return response;
    } catch (error) {
        throw error;
    }
}

export async function getStripeSubscriptionURL(productLookupKey, isTrial, trialDays) {
    axios.defaults.withCredentials = true;
    try {
        const response = await ApiClient.post(`/auth/stripe-product-lookup`, {
            id: productLookupKey,
            is_trial: isTrial, 
            trial_days: trialDays
        });
        return response;
    } catch (error) {
        throw error;
    }
}


const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useSubscriptionDetails() {
  const APIURL = `/auth/subscription-details`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export async function cancelSubscription(subscriptionId) {
    axios.defaults.withCredentials = true;
    try {
        const response = await ApiClient.post(`/auth/cancel-subscription`, {
            id: subscriptionId
        });
        return response;
    } catch (error) {
        throw error;
    }
}

export async function googleSignIn(idToken, bizName = null) {
    axios.defaults.withCredentials = true;
    try {
        const response = await axios.post(`${API}/auth/google`, {
            idToken,
            bizName
        });
        return response;
    } catch (error) {
        throw error;
    }
}
/* ==========================================================================
 * Business Group Owner — Business Switcher (Phase 2)
 * ========================================================================== */

/**
 * Businesses the signed-in Business Group Owner may switch between.
 * The group is resolved server-side from the session, never sent by the client.
 * Business Admins and Staff receive 403 from this endpoint.
 */
export async function getMyBusinesses() {
    try {
        const response = await ApiClient.get(`/auth/my-businesses`);
        return response;
    } catch (error) {
        throw error;
    }
}

/**
 * Changes the active business. The backend re-issues the auth cookies with the
 * new tenant context after verifying the business belongs to the owner's group,
 * so no second login is needed.
 */
export async function switchBusiness(tenantId) {
    try {
        const response = await ApiClient.post(`/auth/switch-business`, {
            tenantId
        });
        return response;
    } catch (error) {
        throw error;
    }
}
