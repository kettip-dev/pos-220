/**
 * register-all.js
 * ──────────────────────────────────────────────────────────────
 * Imports every concrete widget and registers it with the registry.
 * Imported once at app startup (or before the dashboard mounts).
 *
 * To add a new widget:
 *   1. Create the component in widgets/<category>/
 *   2. Add a registerWidget(...) call below
 *   3. Done — it appears in the picker automatically
 */

import { registerWidget, registerCategory } from "./registry";
import { SCOPES } from "../config/scopes";

// ─── Categories (translated labels) ─────────────────────────────
registerCategory("sales",        { label: "Sales",        color: "#70B56A" });
registerCategory("orders",       { label: "Orders",       color: "#4ECDC4" });
registerCategory("kitchen",      { label: "Kitchen",      color: "#F97316" });
registerCategory("inventory",    { label: "Inventory",    color: "#F59E0B" });
registerCategory("customers",    { label: "Customers",    color: "#06B6D4" });
registerCategory("ops",          { label: "Operations",   color: "#A78BFA" });
registerCategory("finance",      { label: "Finance",      color: "#EC4899" });
registerCategory("productivity", { label: "Productivity", color: "#8B5CF6" });

// ─── Sales widgets ──────────────────────────────────────────────
import {
  RevenueKPI, OrdersKPI, AOVKPI, NewCustomersKPI,
  RevenueTrendWidget, PeakHoursWidget, TopItemsWidget,
  OrderTypeDonutWidget, PaymentMixWidget, QuickStatWidget,
  ICONS as SALES_ICONS,
} from "./sales/SalesWidgets";

registerWidget({
  type: "kpi.revenue",
  category: "sales",
  title: "Today's Revenue",
  description: "Today's total revenue with vs-yesterday delta.",
  icon: SALES_ICONS.IconReceipt2,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 6, h: 3 },
  component: RevenueKPI,
  tags: ["kpi", "revenue", "money"],
});
registerWidget({
  type: "kpi.orders",
  category: "sales",
  title: "Orders Today",
  description: "Orders placed today vs yesterday.",
  icon: SALES_ICONS.IconShoppingCart,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 6, h: 3 },
  component: OrdersKPI,
  tags: ["kpi", "orders"],
});
registerWidget({
  type: "kpi.aov",
  category: "sales",
  title: "Avg Order Value",
  description: "Today's average order value with delta.",
  icon: SALES_ICONS.IconTicket,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 6, h: 3 },
  component: AOVKPI,
  tags: ["kpi", "aov"],
});
registerWidget({
  type: "kpi.newCustomers",
  category: "customers",
  title: "New Customers",
  description: "First-time customers today.",
  icon: SALES_ICONS.IconUserPlus,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 6, h: 3 },
  component: NewCustomersKPI,
  tags: ["kpi", "customers"],
});
registerWidget({
  type: "sales.revenueTrend",
  category: "sales",
  title: "Revenue Trend",
  description: "Last 7 days revenue line chart.",
  icon: SALES_ICONS.IconChartLine,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 8, h: 5 }, minSize: { w: 4, h: 4 }, maxSize: { w: 12, h: 8 },
  component: RevenueTrendWidget,
  tags: ["chart", "trend", "revenue"],
});
registerWidget({
  type: "sales.peakHours",
  category: "sales",
  title: "Peak Hours",
  description: "Today's order distribution by hour.",
  icon: SALES_ICONS.IconClock,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 }, maxSize: { w: 12, h: 6 },
  component: PeakHoursWidget,
  tags: ["chart", "hours"],
});
registerWidget({
  type: "sales.topItems",
  category: "sales",
  title: "Top Selling Items",
  description: "Today's bestsellers ranked by orders.",
  icon: SALES_ICONS.IconStar,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 4 }, maxSize: { w: 12, h: 8 },
  component: TopItemsWidget,
  tags: ["list", "top", "menu"],
});
registerWidget({
  type: "sales.orderTypeDonut",
  category: "orders",
  title: "Order Type Mix",
  description: "Dine-in, takeaway, delivery, QR breakdown.",
  icon: SALES_ICONS.IconChartPie,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 6, h: 5 }, minSize: { w: 3, h: 4 }, maxSize: { w: 12, h: 8 },
  component: OrderTypeDonutWidget,
  tags: ["chart", "donut"],
});
registerWidget({
  type: "sales.paymentMix",
  category: "finance",
  title: "Payment Mix",
  description: "Revenue by payment method donut.",
  icon: SALES_ICONS.IconCreditCard,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 6, h: 5 }, minSize: { w: 3, h: 4 }, maxSize: { w: 12, h: 8 },
  component: PaymentMixWidget,
  tags: ["chart", "payment"],
});
registerWidget({
  type: "sales.quickStat.repeatCustomers",
  category: "customers",
  title: "Repeat Customers",
  description: "Returning customers today.",
  icon: SALES_ICONS.IconUserPlus,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 6, h: 3 },
  component: QuickStatWidget,
  defaultConfig: { variant: "repeat_customers" },
  tags: ["stat"],
});
registerWidget({
  type: "sales.quickStat.cancelled",
  category: "orders",
  title: "Cancelled Orders",
  description: "Orders cancelled today.",
  icon: SALES_ICONS.IconShoppingCart,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 6, h: 3 },
  component: QuickStatWidget,
  defaultConfig: { variant: "cancelled_orders" },
  tags: ["stat"],
});
registerWidget({
  type: "sales.quickStat.tax",
  category: "finance",
  title: "Tax Collected",
  description: "Tax accrued today.",
  icon: SALES_ICONS.IconReceiptTax,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 6, h: 3 },
  component: QuickStatWidget,
  defaultConfig: { variant: "tax_collected" },
  tags: ["stat", "tax"],
});
registerWidget({
  type: "sales.quickStat.serviceCharge",
  category: "finance",
  title: "Service Charge",
  description: "Service charge collected today.",
  icon: SALES_ICONS.IconCash,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 }, maxSize: { w: 6, h: 3 },
  component: QuickStatWidget,
  defaultConfig: { variant: "service_charge" },
  tags: ["stat"],
});

// ─── Ops widgets (low stock, feedback, reservations) ────────────
import {
  LowStockWidget, FeedbackWidgetWrap, ReservationsWidget,
  ICONS as OPS_ICONS,
} from "./ops/OpsWidgets";

registerWidget({
  type: "inventory.lowStock",
  category: "inventory",
  title: "Low Stock Alerts",
  description: "Inventory items below threshold.",
  icon: OPS_ICONS.IconAlertTriangle,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 4, h: 5 }, minSize: { w: 3, h: 3 }, maxSize: { w: 12, h: 8 },
  component: LowStockWidget,
  tags: ["alerts", "inventory"],
});
registerWidget({
  type: "ops.feedback",
  category: "customers",
  title: "Recent Feedback",
  description: "Latest customer ratings & comments.",
  icon: OPS_ICONS.IconStar,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 4, h: 5 }, minSize: { w: 3, h: 3 }, maxSize: { w: 12, h: 8 },
  component: FeedbackWidgetWrap,
  tags: ["feedback", "rating"],
});
registerWidget({
  type: "ops.reservations",
  category: "ops",
  title: "Today's Reservations",
  description: "Upcoming bookings for today.",
  icon: OPS_ICONS.IconClock,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 4, h: 5 }, minSize: { w: 3, h: 3 }, maxSize: { w: 12, h: 8 },
  component: ReservationsWidget,
  tags: ["reservations", "today"],
});

// ─── Orders extras ──────────────────────────────────────────────
import {
  OrderStatusBoardWidget, LiveOrdersTickerWidget,
  ICONS as ORDER_ICONS,
} from "./orders/OrdersWidgets";

registerWidget({
  type: "orders.statusBoard",
  category: "orders",
  title: "Order Status Board",
  description: "At-a-glance summary of today's orders.",
  icon: ORDER_ICONS.IconClipboardList,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 }, maxSize: { w: 8, h: 6 },
  component: OrderStatusBoardWidget,
  tags: ["board", "status"],
});
registerWidget({
  type: "orders.liveTicker",
  category: "orders",
  title: "Live Activity",
  description: "Most active items right now.",
  icon: ORDER_ICONS.IconActivityHeartbeat,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 4, h: 5 }, minSize: { w: 3, h: 3 }, maxSize: { w: 8, h: 8 },
  component: LiveOrdersTickerWidget,
  tags: ["live", "ticker"],
});

// ─── Customers extras ───────────────────────────────────────────
import {
  CustomerSplitWidget, ICONS as CUST_ICONS,
} from "./customers/CustomersWidgets";

registerWidget({
  type: "customers.split",
  category: "customers",
  title: "New vs Returning",
  description: "Today's customer mix split.",
  icon: CUST_ICONS.IconUserCheck,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 }, maxSize: { w: 8, h: 6 },
  component: CustomerSplitWidget,
  tags: ["customers", "split"],
});

// ─── Finance extras ─────────────────────────────────────────────
import {
  TaxAccruedWidget, ICONS as FIN_ICONS,
} from "./finance/FinanceWidgets";

registerWidget({
  type: "finance.taxAccrued",
  category: "finance",
  title: "Tax & Service Charge",
  description: "Today's tax + service charge tiles.",
  icon: FIN_ICONS.IconReceiptTax,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 4, h: 3 }, minSize: { w: 3, h: 2 }, maxSize: { w: 8, h: 4 },
  component: TaxAccruedWidget,
  tags: ["finance", "tax"],
});

// ─── Productivity widgets ───────────────────────────────────────
import {
  QuickActionsWidget, NotesWidget, ClockWidget,
  SalesGoalWidget, WelcomeBannerWidget,
  ICONS as PROD_ICONS,
} from "./productivity/ProductivityWidgets";

registerWidget({
  type: "productivity.quickActions",
  category: "productivity",
  title: "Quick Actions",
  description: "One-tap launchers to your most-used pages.",
  icon: PROD_ICONS.IconBolt,
  defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 }, maxSize: { w: 8, h: 6 },
  component: QuickActionsWidget,
  defaultConfig: { actions: ["pos", "kitchen", "orders", "reservation"] },
  configSchema: [],
  allowMultiple: true,
  tags: ["actions", "shortcuts"],
});
registerWidget({
  type: "productivity.notes",
  category: "productivity",
  title: "Sticky Note",
  description: "A jotting space saved in your browser.",
  icon: PROD_ICONS.IconNote,
  defaultSize: { w: 3, h: 4 }, minSize: { w: 2, h: 3 }, maxSize: { w: 8, h: 8 },
  component: NotesWidget,
  refreshable: false,
  allowMultiple: true,
  tags: ["notes"],
});
registerWidget({
  type: "productivity.clock",
  category: "productivity",
  title: "Clock & Date",
  description: "Live time and greeting.",
  icon: PROD_ICONS.IconClock,
  defaultSize: { w: 3, h: 3 }, minSize: { w: 2, h: 2 }, maxSize: { w: 6, h: 4 },
  component: ClockWidget,
  refreshable: false,
  tags: ["time", "clock"],
});
registerWidget({
  type: "productivity.salesGoal",
  category: "sales",
  title: "Daily Sales Goal",
  description: "Progress toward today's revenue target.",
  icon: PROD_ICONS.IconTarget,
  scope: SCOPES.DASHBOARD,
  defaultSize: { w: 3, h: 4 }, minSize: { w: 2, h: 3 }, maxSize: { w: 6, h: 6 },
  component: SalesGoalWidget,
  defaultConfig: { target: 10000 },
  configSchema: [
    { key: "target", type: "number", label: "Daily target", min: 0, default: 10000 },
  ],
  tags: ["goal", "gauge"],
});
registerWidget({
  type: "productivity.welcome",
  category: "productivity",
  title: "Welcome Banner",
  description: "Greeting that calls the user by name.",
  icon: PROD_ICONS.IconBolt,
  defaultSize: { w: 8, h: 2 }, minSize: { w: 4, h: 2 }, maxSize: { w: 12, h: 3 },
  component: WelcomeBannerWidget,
  refreshable: false,
  tags: ["banner", "greeting"],
});

// Total: ~24 registered widgets (Phase 2 + Phase 3 baseline)
