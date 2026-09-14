import axios from "axios";
import { API } from "../config/config";
import {
  getUserDetailsInLocalStorage,
  saveUserDetailsInLocalStorage,
  clearUserDetailsInLocalStorage,
} from "./UserDetails";
import { getLanguage } from "./LocalizationHelper";
import { isAllBusinessesScope, clearBusinessScope } from "./BusinessScope";

const apiClient = axios.create({
  baseURL: API,
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    // Strip accidental leading baseURL / API prefix to prevent duplicate /api/v1/api/v1
    if (config.url) {
      if (API && config.url.startsWith(API)) {
        config.url = config.url.slice(API.length);
      } else if (config.url.startsWith("/api/v1")) {
        config.url = config.url.slice(7);
      }
    }

    // Add 'lang' as a query param from localStorage. We set it via `params`
    // (not by mutating config.url) so retried requests don't accumulate
    // duplicate `?lang=en&lang=en` segments.
    const lang = getLanguage();
    if (lang) {
      config.params = { ...(config.params || {}), lang };
    }

    // Enterprise "All Businesses" mode, sent the same way and for the same
    // reason as `lang` above. Only ever a request: the backend authorises the
    // mode and derives the businesses itself, so this cannot widen access.
    // Omitted entirely in single-business mode, which keeps those requests —
    // and every Business Admin / Staff request — byte-for-byte as before.
    if (isAllBusinessesScope(getUserDetailsInLocalStorage()?.role)) {
      config.params = { ...(config.params || {}), scope: "all" };
    }

    config.withCredentials = true;
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------------------------------------------------------------------------
// Single-flight token refresh
// ---------------------------------------------------------------------------
// When the access token expires, many in-flight requests can fail with 401 at
// the same time. We must refresh the token only ONCE and replay every failed
// request once the new token is in place — otherwise we hammer the refresh
// endpoint and/or rotate refresh tokens multiple times.

// Endpoints that must NEVER trigger a refresh-and-retry (avoids infinite loops
// and avoids refreshing while the user is logging in / out).
const AUTH_FREE_PATHS = [
  "/auth/signin",
  "/auth/signup",
  "/auth/signout",
  "/auth/refresh-token",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/superadmin/signin",
  "/superadmin/refresh-token",
];

const getRefreshEndpoint = () => {
  const user = getUserDetailsInLocalStorage();
  return user?.role === "superadmin"
    ? "/superadmin/refresh-token"
    : "/auth/refresh-token";
};

let isRefreshing = false;
let pendingQueue = [];

const flushQueue = (error) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  pendingQueue = [];
};

const redirectToLogin = () => {
  if (typeof window === "undefined") return;
  const user = getUserDetailsInLocalStorage();
  const target = user?.role === "superadmin" ? "/superadmin" : "/login";

  // Drop the cached identity before leaving. The session is over, and a stale
  // user object would otherwise let the login screen's "already signed in"
  // shortcut bounce straight back into the dashboard and render the previous
  // user's context (for a group owner, their last selected business).
  clearUserDetailsInLocalStorage();
  // Same reasoning for the consolidated/single-business preference: it belongs
  // to the session that just ended, not to whoever signs in next.
  clearBusinessScope();

  // Avoid redirect loops if we're already on an auth screen.
  if (!window.location.pathname.startsWith(target)) {
    window.location.href = target;
  }
};

/**
 * Refresh the session exactly once, even if called concurrently.
 * Resolves when a fresh access token cookie is in place; rejects if the
 * refresh token itself is invalid/expired.
 */
export const refreshSession = () => {
  if (isRefreshing) {
    // A refresh is already in progress — wait for it instead of starting a new one.
    return new Promise((resolve, reject) => {
      pendingQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;
  return apiClient
    .post(getRefreshEndpoint())
    .then((res) => {
      const user = res?.data?.userDetails;
      if (user) {
        const prevUser = getUserDetailsInLocalStorage() || {};
        const prevFeatures = Array.isArray(prevUser.planFeautures) && prevUser.planFeautures.length > 0
          ? prevUser.planFeautures
          : null;
        const mergedUser = {
          ...prevUser,
          ...user,
          planFeautures: (Array.isArray(user.planFeautures) && user.planFeautures.length > 0)
            ? user.planFeautures
            : (prevFeatures || user.planFeautures),
        };
        saveUserDetailsInLocalStorage(mergedUser);
      }
      flushQueue(null);
      return res;
    })
    .catch((error) => {
      flushQueue(error);
      throw error;
    })
    .finally(() => {
      isRefreshing = false;
    });
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Network error (no response) or a request we can't replay → bubble up.
    if (!error.response || !originalRequest) {
      return Promise.reject(error);
    }

    const status = error.response.status;
    const url = originalRequest.url || "";
    const isAuthEndpoint = AUTH_FREE_PATHS.some((p) => url.includes(p));

    // Subscription inactive — handled by the app's routing, just propagate.
    if (status === 402) {
      return Promise.reject(error);
    }

    // Expired / missing access token → refresh once, then replay the request.
    if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      try {
        // Either kicks off the single refresh, or waits for the in-flight one.
        await refreshSession();
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh token is gone/invalid → the session is truly over.
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
