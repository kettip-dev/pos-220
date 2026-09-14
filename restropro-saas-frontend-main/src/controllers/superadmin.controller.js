import ApiClient from "../helpers/ApiClient";
import axios from "axios";
import { API } from "../config/config";
import { clearUserDetailsInLocalStorage } from "../helpers/UserDetails";
import useSWR from "swr";

export async function signIn(username, password) {
  axios.defaults.withCredentials = true;
  try {
    const response = await axios.post(`${API}/superadmin/signin`, {
      username, password
    });

    return response;
  } catch (error) {
    throw error;
  }
}


export async function signOut() {
  axios.defaults.withCredentials = true;
  try {
    const response = await ApiClient.post(`/superadmin/signout`);

    clearUserDetailsInLocalStorage();

    return response;
  } catch (error) {
    throw error;
  }
}

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useSuperAdminDashboard() {
  const APIURL = `/superadmin/dashboard`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export function useSuperAdminTenantsData() {
  const APIURL = `/superadmin/tenantsData`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export async function getSuperAdminTenantsData() {
  try {
    const APIURL = `/superadmin/tenantsData`;
    const response = await ApiClient.get(APIURL);
    return response;
  } catch (error) {
    throw error;
  }
}
export async function getTenantsData({ page, perPage, search, status, type, from, to }) {
  try {
    const response = await ApiClient.get(`/superadmin/tenants?page=${page}&perPage=${perPage}&search=${search}&status=${status}&type=${type}&from=${from}&to=${to}`);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function addTenant(name, email, password, isActive, paymentGatewayProductId) {
  try {
    const response = await ApiClient.post(`/superadmin/tenants/add`, {
      name, email, password, isActive, paymentGatewayProductId
    });

    return response;
  } catch (error) {
    throw error;
  }
}

export async function updateTenant(name, email, isActive, id, paymentGatewayProductId, password) {
  try {
    const payload = {
      name, email, isActive, paymentGatewayProductId
    };
    if (password && typeof password === "string" && password.trim().length > 0) {
      payload.password = password.trim();
    }
    const response = await ApiClient.patch(`/superadmin/tenants/update/${id}`, payload);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function deleteTenant(id) {
  try {
    const response = await ApiClient.delete(`/superadmin/tenants/delete/${id}`);

    return response;
  } catch (error) {
    throw error;
  }
}

export async function getTenantsDataByStatus(status) {
  try {
    const response = await ApiClient.get(`/superadmin/tenantsData/${status}`);

    return response;
  } catch (error) {
    throw error;
  }
}

export function useSuperAdminReports({ type, from = null, to = null }) {
  const APIURL = `/superadmin/reports?type=${type}&from=${from}&to=${to}`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export function useSuperAdminTenantSubscriptionHistory(tenantId) {
  const APIURL = `/superadmin/tenants/${tenantId}/subscription-history`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

// Payment Gateway Functions
export async function getPaymentGateways() {
  try {
    const response = await ApiClient.get(`/superadmin/payment-gateways`);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function getPaymentGatewayById(id) {
  try {
    const response = await ApiClient.get(`/superadmin/payment-gateways/${id}`);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function updatePaymentGatewayStatus(gatewayName, isEnabled) {
  try {
    const response = await ApiClient.put(`/superadmin/payment-gateway/status`, {
      name: gatewayName,
      status: isEnabled
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function activatePaymentGateway() {
  try {
    const response = await ApiClient.get(`/superadmin/payment-gateway/activate`);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function updatePaymentGatewayCredentials(gatewayName, credentials) {
  try {
    const response = await ApiClient.put(`/superadmin/payment-gateway/credentials`, {
      gateway_name: gatewayName,
      credentials: credentials
    });
    return response;
  } catch (error) {
    throw error;
  }
}


 export async function updateGoogleAuth(
    isActive,
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    updateCredentials,
  ) {
    try {
      const response = await ApiClient.put(
        `/superadmin/google-auth`,
        {
          is_active: isActive,
          api_key: apiKey,
          auth_domain: authDomain,
          project_id: projectId,
          storage_bucket: storageBucket,
          messaging_sender_id: messagingSenderId,
          app_id: appId,
          update_credentials: updateCredentials,
        },
      );
      return response;
    } catch (error) {
      throw error;
    }
  }
// ── Firebase (FCM) configuration — platform-global, superadmin only ──
// The backend never returns credentials from these endpoints, only
// sanitized status (configured/enabled/projectId/updatedAt/source).

export function useFirebaseConfig() {
  const APIURL = `/superadmin/firebase-config`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    mutate,
    APIURL,
  };
}

// serviceAccountJson: raw JSON text of the uploaded service account file
// (optional). isEnabled: enable/disable toggle (optional). At least one
// must be provided.
export async function updateFirebaseConfig({ serviceAccountJson, isEnabled }) {
  try {
    const response = await ApiClient.put(`/superadmin/firebase-config`, {
      serviceAccountJson,
      isEnabled,
    });
    return response;
  } catch (error) {
    throw error;
  }
}

// Pass JSON text to test an upload before saving; pass nothing to test the
// currently stored configuration.
export async function testFirebaseConfig(serviceAccountJson) {
  try {
    const response = await ApiClient.post(
      `/superadmin/firebase-config/test`,
      serviceAccountJson !== undefined ? { serviceAccountJson } : {}
    );
    return response;
  } catch (error) {
    throw error;
  }
}

export async function deleteFirebaseConfig() {
  try {
    const response = await ApiClient.delete(`/superadmin/firebase-config`);
    return response;
  } catch (error) {
    throw error;
  }
}
