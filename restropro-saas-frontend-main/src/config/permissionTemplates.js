import { SCOPES } from "./scopes";

/**
 * Human-readable metadata (title, category, description) for every scope key in SCOPES.
 */
export const SCOPE_METADATA = {
  [SCOPES.DASHBOARD]: {
    title: "Dashboard Overview",
    category: "analytics",
    description: "Access main sales performance, real-time stats, and business analytics summary."
  },
  [SCOPES.REPORTS]: {
    title: "Financial & Sales Reports",
    category: "analytics",
    description: "Export revenue, tax, payment breakdown, and sales performance reports."
  },

  [SCOPES.POS]: {
    title: "Point of Sale (POS)",
    category: "pos",
    description: "Access register, place dining/takeaway orders, process payments, and apply discounts."
  },
  [SCOPES.ORDERS]: {
    title: "Orders Management",
    category: "pos",
    description: "View, filter, edit, void, and manage past and active guest orders."
  },
  [SCOPES.ORDER_STATUS]: {
    title: "Order Stage Updates",
    category: "pos",
    description: "Update order lifecycle stages (Received, Preparing, Ready, Delivered)."
  },
  [SCOPES.INVOICES]: {
    title: "Invoices & Billing",
    category: "pos",
    description: "Generate, view, print, and download guest receipts and tax invoices."
  },
  [SCOPES.VOID_INVOICES]: {
    title: "Void Invoices",
    category: "pos",
    description: "Mark a completed invoice as VOID, reversing its inventory impact."
  },
  [SCOPES.VIEW_INVOICE_AUDIT_LOG]: {
    title: "Invoice Audit Log",
    category: "pos",
    description: "View the history of void actions taken on invoices, including who and why."
  },

  [SCOPES.KITCHEN]: {
    title: "Kitchen Workflow",
    category: "kitchen",
    description: "Manage kitchen routing, item status updates, and chef workstation tools."
  },
  [SCOPES.KITCHEN_DISPLAY]: {
    title: "Kitchen Display System (KDS)",
    category: "kitchen",
    description: "View and manage incoming prep orders in kitchen workstations."
  },
  [SCOPES.CUSTOMER_DISPLAY]: {
    title: "Customer Facing Display",
    category: "kitchen",
    description: "Control live customer view screen during register checkout transactions."
  },
  [SCOPES.ORDER_STATUS_DISPLAY]: {
    title: "Order Status Board",
    category: "kitchen",
    description: "Display public order readiness display board for guests and servers."
  },

  [SCOPES.RESERVATIONS]: {
    title: "Reservations Module",
    category: "reservations",
    description: "General access to dining table reservation features and floor plans."
  },
  [SCOPES.VIEW_RESERVATIONS]: {
    title: "View Bookings",
    category: "reservations",
    description: "View reservation calendar, guest lists, and upcoming table bookings."
  },
  [SCOPES.MANAGE_RESERVATIONS]: {
    title: "Manage Bookings",
    category: "reservations",
    description: "Create, edit, assign tables, seating status, and cancel bookings."
  },

  [SCOPES.CUSTOMERS]: {
    title: "Customer Directory",
    category: "customers",
    description: "General access to store customer directory and profiles."
  },
  [SCOPES.VIEW_CUSTOMERS]: {
    title: "View Customer Profiles",
    category: "customers",
    description: "Search and view guest contact info, purchase history, and visit logs."
  },
  [SCOPES.MANAGE_CUSTOMERS]: {
    title: "Manage Customer Profiles",
    category: "customers",
    description: "Create, update, tag, and edit customer accounts and profiles."
  },
  [SCOPES.MEMBERSHIP]: {
    title: "Loyalty & Memberships",
    category: "customers",
    description: "Manage customer membership tiers, reward points, and loyalty discounts."
  },

  [SCOPES.INVENTORY]: {
    title: "Inventory Module",
    category: "inventory",
    description: "General access to raw materials, recipes, and stock tracking tools."
  },
  [SCOPES.VIEW_INVENTORY]: {
    title: "View Stock Levels",
    category: "inventory",
    description: "Check raw ingredient counts, low stock alerts, and reorder levels."
  },
  [SCOPES.MANAGE_INVENTORY]: {
    title: "Manage Stock & Suppliers",
    category: "inventory",
    description: "Add stock adjustments, manage purchase orders, and supplier records."
  },

  [SCOPES.USER]: {
    title: "User & Role Management",
    category: "admin",
    description: "Add, edit, assign permissions, and manage staff user accounts."
  },
  [SCOPES.SETTINGS]: {
    title: "System Settings",
    category: "admin",
    description: "Configure receipt formats, store info, taxes, and system options."
  },
  [SCOPES.FEEDBACK]: {
    title: "Customer Feedback",
    category: "admin",
    description: "View guest ratings, survey scores, and dining feedback."
  },
};

/**
 * Logical grouping of scopes into domain modules for structured information architecture.
 */
export const SCOPE_CATEGORIES = [
  {
    id: "analytics",
    title: "Analytics & Overview",
    description: "Business dashboard insights and financial reporting",
    iconName: "IconChartBar",
    scopes: [SCOPES.DASHBOARD, SCOPES.REPORTS],
  },
  {
    id: "pos",
    title: "POS & Billing",
    description: "Register sales, order processing, and guest billing",
    iconName: "IconCashRegister",
    scopes: [
      SCOPES.POS,
      SCOPES.ORDERS,
      SCOPES.ORDER_STATUS,
      SCOPES.INVOICES,
      SCOPES.VOID_INVOICES,
      SCOPES.VIEW_INVOICE_AUDIT_LOG,
    ],
  },
  {
    id: "kitchen",
    title: "Kitchen & Displays",
    description: "Kitchen prep workstations and status screens",
    iconName: "IconChefHat",
    scopes: [
      SCOPES.KITCHEN,
      SCOPES.KITCHEN_DISPLAY,
      SCOPES.CUSTOMER_DISPLAY,
      SCOPES.ORDER_STATUS_DISPLAY,
    ],
  },
  {
    id: "reservations",
    title: "Reservations",
    description: "Table booking management and floor plans",
    iconName: "IconCalendarEvent",
    scopes: [SCOPES.RESERVATIONS, SCOPES.VIEW_RESERVATIONS, SCOPES.MANAGE_RESERVATIONS],
  },
  {
    id: "customers",
    title: "Customers & Loyalty",
    description: "Guest directory, member profiles, and loyalty programs",
    iconName: "IconUsersGroup",
    scopes: [SCOPES.CUSTOMERS, SCOPES.VIEW_CUSTOMERS, SCOPES.MANAGE_CUSTOMERS, SCOPES.MEMBERSHIP],
  },
  {
    id: "inventory",
    title: "Inventory & Stock",
    description: "Stock management, ingredient tracking, and suppliers",
    iconName: "IconPackages",
    scopes: [SCOPES.INVENTORY, SCOPES.VIEW_INVENTORY, SCOPES.MANAGE_INVENTORY],
  },
  {
    id: "admin",
    title: "Administration",
    description: "User management, store configuration, and feedback",
    iconName: "IconSettings",
    scopes: [SCOPES.USER, SCOPES.SETTINGS, SCOPES.FEEDBACK],
  },
];

/**
 * Pre-defined role templates for 1-click permission assignment.
 */
export const ROLE_PRESETS = [
  {
    id: "manager",
    title: "Store Manager",
    description: "Full operational access to all system modules",
    iconName: "IconShieldCheck",
    scopes: Object.values(SCOPES),
  },
  {
    id: "cashier",
    title: "Cashier / Register",
    description: "Billing, register sales, orders, and customer lookup",
    iconName: "IconCashRegister",
    scopes: [
      SCOPES.POS,
      SCOPES.ORDERS,
      SCOPES.ORDER_STATUS,
      SCOPES.INVOICES,
      SCOPES.VIEW_CUSTOMERS,
      SCOPES.CUSTOMER_DISPLAY,
    ],
  },
  {
    id: "kitchen_staff",
    title: "Kitchen Chef",
    description: "KDS prep displays, kitchen workflow, and order status",
    iconName: "IconChefHat",
    scopes: [
      SCOPES.KITCHEN,
      SCOPES.KITCHEN_DISPLAY,
      SCOPES.ORDER_STATUS_DISPLAY,
      SCOPES.ORDER_STATUS,
    ],
  },
  {
    id: "waitstaff",
    title: "Waitstaff / Server",
    description: "Order taking, status updates, and table reservations",
    iconName: "IconCalendarEvent",
    scopes: [
      SCOPES.POS,
      SCOPES.ORDERS,
      SCOPES.ORDER_STATUS,
      SCOPES.RESERVATIONS,
      SCOPES.VIEW_RESERVATIONS,
    ],
  },
  {
    id: "inventory_clerk",
    title: "Inventory Clerk",
    description: "Stock monitoring, inventory adjustments, and suppliers",
    iconName: "IconPackages",
    scopes: [
      SCOPES.INVENTORY,
      SCOPES.VIEW_INVENTORY,
      SCOPES.MANAGE_INVENTORY,
    ],
  },
];
