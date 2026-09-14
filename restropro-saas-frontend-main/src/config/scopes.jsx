export const SCOPES = {
    DASHBOARD: "DASHBOARD",
    POS: "POS",
    CUSTOMER_DISPLAY: "CUSTOMER_DISPLAY",
    KITCHEN_DISPLAY: "KITCHEN_DISPLAY",
    ORDER_STATUS_DISPLAY: "ORDER_STATUS_DISPLAY",
    ORDER_STATUS: "ORDER_STATUS",
    ORDERS: "ORDERS",
    KITCHEN: "KITCHEN",
    RESERVATIONS: "RESERVATIONS",
    VIEW_RESERVATIONS: "VIEW_RESERVATIONS",
    MANAGE_RESERVATIONS: "MANAGE_RESERVATIONS",
    CUSTOMERS: "CUSTOMERS",
    VIEW_CUSTOMERS: "VIEW_CUSTOMERS",
    MANAGE_CUSTOMERS: "MANAGE_CUSTOMERS",
    INVOICES: "INVOICES",
    VOID_INVOICES: "VOID_INVOICES",
    VIEW_INVOICE_AUDIT_LOG: "VIEW_INVOICE_AUDIT_LOG",
    MEMBERSHIP: "MEMBERSHIP",
    INVENTORY: "INVENTORY",
    VIEW_INVENTORY: "VIEW_INVENTORY",
    MANAGE_INVENTORY: "MANAGE_INVENTORY",
    SETTINGS: "SETTINGS",
    REPORTS: "REPORTS",
    FEEDBACK: "FEEDBACK",
    USER: "USER"
}

export const PLAN_FEATURES = {
    DASHBOARD: "DASHBOARD",
    POS: "POS",
    ORDERS: "ORDERS",
    KITCHEN: "KITCHEN",
    RESERVATIONS: "RESERVATIONS",
    CUSTOMERS: "CUSTOMERS",
    INVOICES: "INVOICES",
    MEMBERSHIP: "MEMBERSHIP",
    INVENTORY: "INVENTORY",
    SETTINGS: "SETTINGS",
    REPORTS: "REPORTS",
    FEEDBACK: "FEEDBACK",
    USER: "USER",
    QRMENU: "QRMENU"
}
export const ROLES = {
    ADMIN: "admin",
    USER: "user",
    // Business Group Owner (Phase 2): manages every business in their business
    // group through one login. Stored in the same users table as other roles.
    GROUP_OWNER: "group_owner"
}

/**
 * Roles that bypass per-user scope checks.
 *
 * A Business Admin has full access to their own business. A Business Group Owner
 * has no per-user `scope` string at all — their access derives from the business
 * group — so scope-based checks must not be applied to them either. Their real
 * limit is the read/write permission level, which the BACKEND enforces on every
 * request; this helper only drives what the UI offers.
 */
export const hasFullBusinessAccess = (role) =>
    role === ROLES.ADMIN || role === ROLES.GROUP_OWNER;
