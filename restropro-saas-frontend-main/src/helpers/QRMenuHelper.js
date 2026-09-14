import { FRONTEND_DOMAIN } from "../config/config";

// FRONTEND_DOMAIN may be a comma-separated list (used for CORS on the backend).
// Extract only the first entry to build valid QR menu URLs.
const BASE_URL = FRONTEND_DOMAIN?.split(",")[0]?.trim() || "";

export const getQRMenuLink = (code) => {
    return `${BASE_URL}/m/${code}`;
}

export const getTableQRMenuLink = (code, tableId) => {
    return `${BASE_URL}/m/${code}?table=${tableId}`;
}

