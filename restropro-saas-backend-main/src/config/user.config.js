const ROLES = {
    ADMIN: "admin",
    USER: "user",
    // Business Group Owner (Phase 2): manages every business linked to their
    // business group through a single login. Stored in the same `users` table.
    GROUP_OWNER: "group_owner"
}

// Access level a Business Group Owner has across their group's businesses.
const GROUP_PERMISSION_LEVELS = {
    READ: "read",
    WRITE: "write"
}

const SCOPES = {
    DASHBOARD: "DASHBOARD",
    POS: "POS",
    CUSTOMER_DISPLAY: "CUSTOMER_DISPLAY",
    KITCHEN_DISPLAY: "KITCHEN_DISPLAY",
    ORDER_STATUS_DISPLAY: "ORDER_STATUS_DISPLAY",
    ORDER_STATUS: "ORDER_STATUS",
    ORDERS: "ORDERS",
    KITCHEN: "KITCHEN",
    WAITER: "WAITER",
    RESERVATIONS: "RESERVATIONS",
    VIEW_RESERVATIONS: "VIEW_RESERVATIONS",
    MANAGE_RESERVATIONS: "MANAGE_RESERVATIONS",
    CUSTOMERS: "CUSTOMERS",
    VIEW_CUSTOMERS: "VIEW_CUSTOMERS",
    MANAGE_CUSTOMERS: "MANAGE_CUSTOMERS",
    INVOICES: "INVOICES",
    VOID_INVOICES: "VOID_INVOICES",
    VIEW_INVOICE_AUDIT_LOG: "VIEW_INVOICE_AUDIT_LOG",
    REFUND_INVOICES: "REFUND_INVOICES",
    // Manager-level register control: approve variances, reopen sessions, see the
    // expected drawer total during a blind close, manage tills, close the business day.
    REGISTER_MANAGE: "REGISTER_MANAGE",
    MEMBERSHIP: "MEMBERSHIP",
    INVENTORY: "INVENTORY",
    VIEW_INVENTORY: "VIEW_INVENTORY",
    MANAGE_INVENTORY: "MANAGE_INVENTORY",
    SETTINGS: "SETTINGS",
    REPORTS: "REPORTS",
    FEEDBACK: "FEEDBACK",
    USER: "USER",
}

// Feature list for a tenant with no subscription plan ("Full Access").
// Built from SCOPES so a new permission is never forgotten here: authorize()
// checks plan features before anything else, so a missing entry blocks the
// feature even for admins. QRMENU is a plan feature that is not a user scope.
const FULL_ACCESS_FEATURES = [...new Set([...Object.values(SCOPES), "QRMENU"])];

exports.ROLES = ROLES;
exports.SCOPES = SCOPES;
exports.FULL_ACCESS_FEATURES = FULL_ACCESS_FEATURES;
exports.GROUP_PERMISSION_LEVELS = GROUP_PERMISSION_LEVELS;