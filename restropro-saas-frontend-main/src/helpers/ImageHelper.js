import { API_IMAGES_BASE_URL } from "../config/config";

// Module-level cache for cloud storage public URL.
let _cloudPublicUrl = null;

/**
 * Called from store settings fetch to set the cloud storage base URL.
 * This is Option B: piggyback on the existing GET /settings/store-setting response.
 * @param {{ publicUrl: string|null }} config
 */
export function setImageStorageConfig(config) {
    if (config && config.publicUrl) {
        _cloudPublicUrl = config.publicUrl.replace(/\/+$/, ""); // trim trailing slash
    } else {
        _cloudPublicUrl = null;
    }
}

/**
 * Get the cloud public URL (for components that need it directly).
 */
export function getCloudPublicUrl() {
    return _cloudPublicUrl;
}

// Menu item (and similar) image fields can hold one of three path types:
// 1. Full external URL (e.g., AI suggestion) → pass through unchanged
// 2. Local relative path (e.g., "/public/12/45") → prefix with backend base URL
// 3. Cloud relative key (e.g., "restropro_saas/tenant_5/menu-items/42_xxx") → prefix with cloud CDN URL
export function getImageURL(path) {
    if (!path) return path;

    // External URL (AI suggestions, direct links, local blob/data URLs) → pass through
    if (/^https?:\/\//i.test(path) || path.startsWith("blob:") || path.startsWith("data:")) {
        return path;
    }

    // Local storage path → prefix with backend URL
    if (path.startsWith("/public/")) {
        return API_IMAGES_BASE_URL + path;
    }

    // Cloud storage path → prefix with cloud CDN URL
    if (_cloudPublicUrl && path.startsWith("restropro_saas/")) {
        return _cloudPublicUrl + "/" + path;
    }

    // Fallback: treat as local path (backward compatibility)
    return API_IMAGES_BASE_URL + path;
}