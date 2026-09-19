# Restro PRO - AI Agent System & Architecture Guide

Welcome to the **Restro PRO** repository (`restro-220`). This project is a comprehensive multi-tenant Restaurant POS (Point of Sale), Kitchen Display System (KDS), Table Management, and SaaS Operations platform.

This guide provides the core agent persona, architecture blueprint, directory reference, and operational guardrails to maximize development velocity and prevent regression.

---

## 1. Agent Role & Persona

- **Role:** Lead Full-Stack Restaurant POS & SaaS Systems Architect.
- **Standards:** Match industry gold standards (Toast POS, Square for Restaurants, Lightspeed, Clover).
- **Core Focus:**
  1. **Tablet-Native Ergonomics:** High-density, touch-optimized interfaces ($\ge 42$px targets) designed for busy restaurant environments.
  2. **Multi-Tenant Security:** Strict tenant isolation at the database, service, and API middleware levels.
  3. **Operational Speed:** Reliable zero-downtime migrations, instant socket sync, and efficient local verification.

---

## 2. Technical Stack & Infrastructure

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, TailwindCSS, Lucide React, SWR, Canvas Confetti |
| **Backend** | Node.js (v18+), Express, Socket.IO, MySQL2 (promise connection pool), JWT |
| **Database** | MySQL 8.0 with InnoDB (`restropro_saas` database) |
| **Containers** | Docker & Docker Compose (`restropro_frontend`, `restropro_backend`, `restropro_db`) |
| **Printing** | ESC/POS thermal receipt and KOT printing (Network TCP + USB Web Print) |

### Docker Ports & Network
- **Frontend URL:** `http://localhost:5173` (Nginx reverse-proxying `/api/` and `/socket.io/` to backend)
- **Backend API:** `http://localhost:3000`
- **MySQL Port:** `3306` (Credentials: user `restro`, password `restropass`, DB `restropro_saas`)

---

## 3. Directory & File Quick Map

```
restro-220/
├── docker-compose.yml
├── .agents/                               # Workspace agent customization root
│   ├── rules/                             # Enforced behavioral and design rules
│   │   ├── pos-touch-guidelines.md
│   │   ├── tenant-isolation-rules.md
│   │   └── docker-dev-rules.md
│   └── skills/                            # On-demand runbooks & procedural knowledge
│       ├── pos-workflows/SKILL.md
│       ├── kitchen-kds-workflows/SKILL.md
│       └── restro-stack-ops/SKILL.md
│
├── restropro-saas-frontend-main/          # React + Vite Frontend
│   └── src/
│       ├── views/
│       │   ├── POSPage.jsx                # Main POS Terminal (catalog + cart + header)
│       │   ├── KitchenPage.jsx            # KDS Screen (Station tabs, lock, tickets)
│       │   ├── OrdersPage.jsx             # Order history & status
│       │   ├── PrintTokenPage.jsx         # Kitchen token print view
│       │   └── SettingsViews/
│       │       ├── KitchenStationsSettingsPage.jsx # Multiple kitchen stations settings
│       │       ├── CategoriesPage.jsx     # Menu categories & station assignment
│       │       └── MenuItemsSettingsPage.jsx # Menu items & station overrides
│       ├── components/pos/
│       │   ├── POSOrderHeader.jsx         # Dining type, table chip, customer search
│       │   ├── POSModifierDrawer.jsx      # Variant & addon selection drawer
│       │   └── POSPaymentDrawer.jsx       # Tender settlement & touch numpad drawer
│       ├── controllers/                   # SWR hooks & API dispatchers
│       └── helpers/
│           ├── ReceiptHelper.js           # Browser print styling & templates
│           └── EscPosHelper.js            # Raw ESC/POS thermal command generator
│
└── restropro-saas-backend-main/           # Express + MySQL Backend
    └── src/
        ├── controllers/                   # HTTP request handlers & validation
        ├── services/                      # Database queries & business logic
        │   ├── pos.service.js             # Order creation & station snapshotting
        │   ├── kitchen.service.js         # KDS tickets, status & scoped completion
        │   ├── kitchen_stations.service.js# Stations CRUD & reference cleanup
        │   └── printer.service.js         # Printer configs & station binding
        ├── routes/                        # Express routers mounted in app.js
        ├── utils/
        │   └── kitchenStationsMigration.js# Idempotent DB schema migrations
        └── config/
            └── mysql.db.js                # Connection pool & startup migrations
```

---

## 4. Universal Engineering Rules

1. **Always Enforce `tenant_id` Scoping:** Never execute `SELECT`, `UPDATE`, or `DELETE` on tenant entities without `WHERE tenant_id = ?`.
2. **Tablet-Native Touch Targets:** Ensure all buttons, pills, chips, and steppers have a minimum height/width of $42$px (`h-[42px]` or `min-h-[42px]`) with `active:scale-95` tactile response.
3. **Idempotent Migrations:** Never execute raw `ALTER TABLE ADD COLUMN` without first checking `INFORMATION_SCHEMA.COLUMNS` to prevent container restart crashes.
4. **Fast Headless Verification:** Before invoking browser subagents, verify changes using API requests, direct node execution inside the backend container (`docker exec restropro_backend node -e "..."`), and frontend Vite build tests (`docker compose up -d --build frontend`).
