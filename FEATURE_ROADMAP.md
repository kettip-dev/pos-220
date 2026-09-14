# 🍽️ RestroPRO — Full Restaurant SaaS Feature Roadmap

> **Target Market**: Restaurants, Cafes, Bars, Hotels (Multi-type SaaS)
> **Last Updated**: September 2026
> **Legend**: ✅ DONE · 🔲 Planned · 🚧 In Progress

---

## Overview

```
Phase 1: Core MVP              ──▶  Foundation, Auth, POS, Menu, Orders
Phase 2: Operations & Growth   ──▶  Multi-branch, Delivery, Loyalty, HR
Phase 3: Advanced Intelligence ──▶  Mobile App, AI Analytics, Marketing
Phase 4: Enterprise/SaaS Scale ──▶  Kiosk, Accounting, White-label, API
```

---

## Phase 1 — Core MVP
> **Goal**: A fully operational single-outlet restaurant management system ready for paying tenants.

### 🔐 Authentication & Access Control
| Feature | Status |
|---|---|
| Tenant registration & onboarding | ✅ DONE |
| Login / Logout | ✅ DONE |
| Forgot password & reset password | ✅ DONE |
| Role-based access control (RBAC) — Admin, Waiter, Cashier, Kitchen | ✅ DONE |
| Scope-based route protection | ✅ DONE |
| Session management | ✅ DONE |
| Inactive subscription guard page | ✅ DONE |

---

### 🏠 Dashboard
| Feature | Status |
|---|---|
| Main dashboard with sales summary | ✅ DONE |
| Revenue, orders, customers KPI cards | ✅ DONE |
| Real-time data via WebSocket | ✅ DONE |
| Dark / light theme toggle | ✅ DONE |
| Multi-language (i18n) support | ✅ DONE |

---

### 🖥️ Point of Sale (POS)
| Feature | Status |
|---|---|
| Full POS interface | ✅ DONE |
| Category-based menu browsing | ✅ DONE |
| Cart management (add, remove, modify qty) | ✅ DONE |
| Order notes / special instructions | ✅ DONE |
| Split / merge bills | ✅ DONE |
| Discount & promo application | ✅ DONE |
| Multiple payment types (Cash, Card, QR, etc.) | ✅ DONE |
| Table selection from POS | ✅ DONE |
| Waiter assignment from POS | ✅ DONE |
| Print receipt from POS | ✅ DONE |
| Print kitchen token | ✅ DONE |
| Invoice generation & audit log | ✅ DONE |

---

### 📋 Menu Management
| Feature | Status |
|---|---|
| Menu item creation, edit, delete | ✅ DONE |
| Menu categories management | ✅ DONE |
| Menu item image upload (local / cloud storage) | ✅ DONE |
| Pricing per item | ✅ DONE |
| Item availability toggle | ✅ DONE |
| Menu item detail view page | ✅ DONE |
| Add-ons / modifiers per item | ✅ DONE |

---

### 🪑 Table Management
| Feature | Status |
|---|---|
| Table creation & layout configuration | ✅ DONE |
| Table availability status | ✅ DONE |
| Table assignments (waiter → table) | ✅ DONE |
| Table page (live floor view) | ✅ DONE |

---

### 📦 Order Management
| Feature | Status |
|---|---|
| Orders listing with filters & search | ✅ DONE |
| Order status tracking (Pending → Processing → Done) | ✅ DONE |
| Order detail view | ✅ DONE |
| Waiter order management | ✅ DONE |
| Real-time order push via WebSocket | ✅ DONE |
| Order status display screen (public display) | ✅ DONE |

---

### 👨‍🍳 Kitchen Display System (KDS)
| Feature | Status |
|---|---|
| Kitchen screen — live incoming orders | ✅ DONE |
| Mark items as ready | ✅ DONE |
| Real-time updates via WebSocket | ✅ DONE |

---

### 🗓️ Reservations
| Feature | Status |
|---|---|
| Reservation creation & management | ✅ DONE |
| Guest info, date/time, table preference | ✅ DONE |
| Reservation status (Pending, Confirmed, Cancelled) | ✅ DONE |

---

### 📊 Reports
| Feature | Status |
|---|---|
| Sales reports | ✅ DONE |
| Item-level sales report | ✅ DONE |
| Daily / weekly / monthly breakdown | ✅ DONE |
| Payment type breakdown report | ✅ DONE |
| Category sales report | ✅ DONE |
| Waiter performance report | ✅ DONE |
| Custom date range filter | ✅ DONE |

---

### 🧾 Invoices & Billing
| Feature | Status |
|---|---|
| Invoice listing & search | ✅ DONE |
| Invoice detail view & print | ✅ DONE |
| Invoice audit logs | ✅ DONE |
| Tax setup (multiple tax rules) | ✅ DONE |
| Payment types configuration | ✅ DONE |

---

### 👥 Customer Management
| Feature | Status |
|---|---|
| Customer listing, add, edit, delete | ✅ DONE |
| Customer insights & visit history | ✅ DONE |
| Customer import (CSV bulk upload) | ✅ DONE |
| Customer notes & tags | ✅ DONE |

---

### 🤳 QR Menu (Self-Order)
| Feature | Status |
|---|---|
| QR code generation per table | ✅ DONE |
| Customer-facing QR menu page | ✅ DONE |
| Cart & order submission via QR | ✅ DONE |
| Order success / failed pages | ✅ DONE |

---

### ⭐ Feedback System
| Feature | Status |
|---|---|
| Feedback collection form (post-meal) | ✅ DONE |
| Feedback success page | ✅ DONE |
| Feedback management dashboard | ✅ DONE |
| Rating & comment capture | ✅ DONE |

---

### ⚙️ Settings
| Feature | Status |
|---|---|
| Business profile & details | ✅ DONE |
| Print settings (receipt, token) | ✅ DONE |
| Device management | ✅ DONE |
| Contact & support page | ✅ DONE |
| User & staff management | ✅ DONE |
| Profile management | ✅ DONE |

---

### 📦 Inventory Management
| Feature | Status |
|---|---|
| Inventory item creation & tracking | ✅ DONE |
| Stock level monitoring | ✅ DONE |
| Inventory logs (adjustments history) | ✅ DONE |
| Inventory dashboard & summary | ✅ DONE |
| Low stock alerts | ✅ DONE |

---

### 🌐 SaaS Platform (Super Admin)
| Feature | Status |
|---|---|
| Super Admin login (separate portal) | ✅ DONE |
| Tenant management (list, view, manage) | ✅ DONE |
| Subscription plan management | ✅ DONE |
| Plan details & pricing config | ✅ DONE |
| Payment gateway configuration (Stripe, etc.) | ✅ DONE |
| Google settings / OAuth setup | ✅ DONE |
| Firebase push notification config | ✅ DONE |
| Image storage backend config | ✅ DONE |
| Business group management | ✅ DONE |
| Super Admin reports | ✅ DONE |
| Tenant subscription history | ✅ DONE |
| SaaS subscription billing (Stripe) | ✅ DONE |
| Payment success / cancelled pages | ✅ DONE |

---

## Phase 2 — Operations & Growth
> **Goal**: Scale beyond a single outlet. Add delivery, loyalty, procurement, and HR capabilities.

### 🏢 Multi-Branch / Multi-Location Management
| Feature | Status |
|---|---|
| Branch creation & management per tenant | 🔲 Planned |
| Per-branch menu, pricing & promotions | 🔲 Planned |
| Centralized cross-branch reporting | 🔲 Planned |
| Branch-level user roles & permissions | 🔲 Planned |
| Branch performance comparison dashboard | 🔲 Planned |
| Central inventory with branch stock transfer | 🔲 Planned |

---

### 👨‍🍳 Multiple Kitchen Stations (KDS)
> **Design**: Each station sees only the items from its assigned menu categories. A dedicated URL/login per station allows separate tablets per station. The full order is marked complete only when **all stations** have finished their items.

| Feature | Status |
|---|---|
| Kitchen station creation & management (name, color, description) | 🔲 Planned |
| Assign menu categories to a kitchen station | 🔲 Planned |
| Dedicated KDS screen per station (`/kitchen/station/:id`) | 🔲 Planned |
| Station-scoped login / access token | 🔲 Planned |
| Items filtered & displayed per station on KDS | 🔲 Planned |
| Real-time updates per station via WebSocket room | 🔲 Planned |
| Mark individual item as preparing / complete per station | 🔲 Planned |
| Bulk mark all station items as preparing / complete | 🔲 Planned |
| Order marked "all ready" only when ALL stations complete their items | 🔲 Planned |
| Waiter notified (push + socket) when entire order is ready | 🔲 Planned |
| Station management page in Settings | 🔲 Planned |
| Unified kitchen admin view (see all stations at once) | 🔲 Planned |

**DB changes required:**
- `kitchen_stations` table: `id`, `tenant_id`, `name`, `color`, `description`
- `category_kitchen_station` join table: `category_id`, `station_id`
- `order_items.station_id` — resolved at order creation from category assignment

---

### 🚀 Online Ordering & Delivery Integration
| Feature | Status |
|---|---|
| Own-brand online ordering storefront | 🔲 Planned |
| Delivery zone & fee configuration | 🔲 Planned |
| Customer delivery address & map integration | 🔲 Planned |
| Real-time order tracking for customers | 🔲 Planned |
| Third-party aggregator integration (GrabFood, FoodPanda) | 🔲 Planned |
| Delivery driver assignment & management | 🔲 Planned |
| Delivery status push notifications | 🔲 Planned |
| Estimated delivery time (ETA) engine | 🔲 Planned |

---

### 🎁 Customer Loyalty Program & Rewards
| Feature | Status |
|---|---|
| Points-based loyalty system | 🔲 Planned |
| Physical loyalty card integration (NFC / barcode scan) | 🔲 Planned |
| Rewards catalogue & redemption | 🔲 Planned |
| Tier-based loyalty levels (Bronze, Silver, Gold) | 🔲 Planned |
| Birthday / anniversary auto-rewards | 🔲 Planned |
| Loyalty points history & balance display | 🔲 Planned |
| QR-based loyalty card (digital) | 🔲 Planned |

---

### 👔 Staff Scheduling & HR
| Feature | Status |
|---|---|
| Staff shift scheduling (weekly view) | 🔲 Planned |
| Clock-in / clock-out (attendance) | 🔲 Planned |
| Overtime & break tracking | 🔲 Planned |
| Leave management (request & approval) | 🔲 Planned |
| Payroll summary report (hours worked × rate) | 🔲 Planned |
| Staff performance metrics | 🔲 Planned |

---

### 🛒 Supplier & Procurement Management
| Feature | Status |
|---|---|
| Supplier contact & profile management | 🔲 Planned |
| Purchase order (PO) creation & tracking | 🔲 Planned |
| Stock receiving & GRN (Goods Received Note) | 🔲 Planned |
| Supplier price list management | 🔲 Planned |
| PO approval workflow | 🔲 Planned |
| Auto-reorder trigger based on low stock | 🔲 Planned |
| Purchase history & spend analytics | 🔲 Planned |

---

### 📖 Recipe Management & Food Cost Calculator
| Feature | Status |
|---|---|
| Recipe creation (ingredients + quantities) | 🔲 Planned |
| Link recipe to menu items | 🔲 Planned |
| Ingredient-level inventory deduction on sale | 🔲 Planned |
| Food cost % per menu item | 🔲 Planned |
| Suggested selling price based on target margin | 🔲 Planned |
| Waste tracking & variance report | 🔲 Planned |

---

## Phase 3 — Advanced Intelligence
> **Goal**: Deepen customer engagement and unlock data-driven operations with AI and a mobile-first experience.

### 📱 Customer Mobile App (iOS & Android)
| Feature | Status |
|---|---|
| Mobile app — browse menu | 🔲 Planned |
| Mobile app — place order (dine-in / takeaway / delivery) | 🔲 Planned |
| Mobile app — loyalty points & rewards | 🔲 Planned |
| Mobile app — order history & re-order | 🔲 Planned |
| Mobile app — reservation booking | 🔲 Planned |
| Mobile app — push notifications | 🔲 Planned |
| Mobile app — feedback & rating | 🔲 Planned |
| Mobile app — profile & saved addresses | 🔲 Planned |

---

### 🤖 AI-Powered Analytics & Business Intelligence
| Feature | Status |
|---|---|
| Sales forecasting (daily / weekly demand) | 🔲 Planned |
| Best-seller & slow-mover item prediction | 🔲 Planned |
| Customer churn prediction | 🔲 Planned |
| Peak-hour analysis & staffing recommendations | 🔲 Planned |
| Food waste reduction recommendations | 🔲 Planned |
| Revenue optimization suggestions | 🔲 Planned |
| Automated anomaly detection (unusual voids, discounts) | 🔲 Planned |

---

### 📣 Automated Marketing & Campaigns
| Feature | Status |
|---|---|
| WhatsApp / SMS broadcast campaigns | 🔲 Planned |
| Email newsletter campaigns | 🔲 Planned |
| Targeted promotions by customer segment | 🔲 Planned |
| Automated win-back campaigns (lapsed customers) | 🔲 Planned |
| Campaign performance analytics (open, click, conversion) | 🔲 Planned |
| Promotion scheduler | 🔲 Planned |

---

### 🔔 Advanced Notifications
| Feature | Status |
|---|---|
| Push notification center (in-app) | 🔲 Planned |
| Order status SMS/WhatsApp to customer | 🔲 Planned |
| Low-stock alert notifications to managers | 🔲 Planned |
| Reservation reminder notifications | 🔲 Planned |

---

## Phase 4 — Enterprise & SaaS Scale
> **Goal**: Enterprise-grade features, hardware integrations, white-labeling and open platform.

### 🖥️ Self-Service Kiosk Mode
| Feature | Status |
|---|---|
| Kiosk UI (touch-optimized, full-screen) | 🔲 Planned |
| Category & item browsing on kiosk | 🔲 Planned |
| Customization / modifier selection | 🔲 Planned |
| Cart & checkout flow on kiosk | 🔲 Planned |
| Payment integration on kiosk (card tap, QR) | 🔲 Planned |
| Order ticket print from kiosk | 🔲 Planned |
| Idle screen / branding screensaver | 🔲 Planned |
| Multi-language support on kiosk | 🔲 Planned |

---

### 💰 Accounting & Finance Integration
| Feature | Status |
|---|---|
| QuickBooks / Xero integration | 🔲 Planned |
| Automated daily sales export to accounting | 🔲 Planned |
| Expense & cost-of-goods tracking | 🔲 Planned |
| Profit & loss summary dashboard | 🔲 Planned |
| VAT / GST tax reporting export | 🔲 Planned |
| End-of-day reconciliation report | 🔲 Planned |

---

### 🌐 White-Label & Open Platform
| Feature | Status |
|---|---|
| White-label branding per tenant (logo, colors, domain) | 🔲 Planned |
| Custom domain support per tenant | 🔲 Planned |
| Public REST API with API key management | 🔲 Planned |
| Webhook support for third-party integrations | 🔲 Planned |
| App marketplace / plugin system | 🔲 Planned |
| Developer documentation portal | 🔲 Planned |

---

### 🏗️ SaaS Infrastructure & DevOps
| Feature | Status |
|---|---|
| Multi-region deployment support | 🔲 Planned |
| Automated database backups per tenant | 🔲 Planned |
| Tenant data export (GDPR compliance) | 🔲 Planned |
| SLA monitoring & uptime dashboard | 🔲 Planned |
| Usage-based billing (API calls, storage) | 🔲 Planned |
| Advanced audit logging (SIEM-ready) | 🔲 Planned |

---

## Feature Count Summary

| Phase | Total Features | Done | Planned |
|---|---|---|---|
| Phase 1 — Core MVP | ~95 | ~95 | 0 |
| Phase 2 — Operations & Growth | ~40 | 0 | ~40 |
| Phase 3 — Advanced Intelligence | ~27 | 0 | ~27 |
| Phase 4 — Enterprise & SaaS Scale | ~24 | 0 | ~24 |
| **Total** | **~186** | **~95** | **~91** |

---

> 📌 **Note**: Feature scope and phase placement may be adjusted as business requirements evolve.
> Update this document after each sprint review to keep the roadmap current.
