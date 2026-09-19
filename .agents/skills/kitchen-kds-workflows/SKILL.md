---
name: kitchen-kds-workflows
description: >-
  Use this skill when working on the Kitchen Display System (KDS), multi-station routing,
  station lock screen, companion item badges, item status updates, or ESC/POS thermal KOT printing.
---

# Kitchen Display System (KDS) & Multi-Station Workflows

This skill provides procedures and architecture reference for the Kitchen Display System in [`restropro-saas-frontend-main/src/views/KitchenPage.jsx`](file:///c:/projects_tipket/Other%20Projects/restro-220/restropro-saas-frontend-main/src/views/KitchenPage.jsx) and [`restropro-saas-backend-main/src/services/kitchen.service.js`](file:///c:/projects_tipket/Other%20Projects/restro-220/restropro-saas-backend-main/src/services/kitchen.service.js).

---

## 1. Station Filtering & KDS Modes

The KDS supports multiple view modes:
- **Station Mode (`selectedStation = stationId`):**
  - Displays only items routed to that station.
  - Companion badge appears at the bottom of the card displaying status of items at other stations:
    `+N items at [Other Station Name] (X/Y ready)`
- **All Stations / Expo Mode (`selectedStation = 'all'`):**
  - Displays all items across the restaurant on the ticket card.
  - Each item displays its station pill (`[Hot Kitchen]`, `[Bar]`).
- **Unassigned Mode (`selectedStation = 'unassigned'`):**
  - Displays orders containing items with `kitchen_station_id IS NULL`.

---

## 2. Station Lock Screen
- **Storage:** Persisted in `localStorage.getItem("restro_kds_locked_station")`.
- **Behavior:** When locked, the lock toggle button turns amber (`bg-amber-50 text-amber-700 border-amber-300`). Other station tabs are disabled with a padlock icon to prevent kitchen staff from accidentally switching views.
- **Unlock:** Tapping the lock button again unlocks the station tab selector.

---

## 3. Order Item Preparation Lifecycle

1. **Item Statuses:** `created` $\to$ `preparing` $\to$ `completed`.
2. **Station-Scoped Batch Actions:**
   - **"Start All":** Only marks items assigned to the current station as `preparing`.
   - **"Complete All":** Only marks items assigned to the current station as `completed`.
3. **Master Order Auto-Completion:**
   - `markOrderAllItemsStatusDB(tenantId, orderId, status, fromStatuses, stationId)`
   - Computes whether any active items remain in the order across **all** stations:
     ```sql
     SELECT COUNT(*) as count FROM order_items 
     WHERE order_id = ? AND status NOT IN ('completed', 'cancelled', 'delivered')
     ```
   - When count reaches 0, `allFinished = true` is emitted via Socket.IO (`kitchen_status_update`), and the master order automatically clears from active KDS screens.

---

## 4. Thermal KOT Printing & Routing

- Thermal printing is handled by [`ReceiptHelper.js`](file:///c:/projects_tipket/Other%20Projects/restro-220/restropro-saas-frontend-main/src/helpers/ReceiptHelper.js) and [`EscPosHelper.js`](file:///c:/projects_tipket/Other%20Projects/restro-220/restropro-saas-frontend-main/src/helpers/EscPosHelper.js).
- When printing tickets:
  - If a station is targeted, print header: `*** KOT - [STATION NAME] ***`.
  - Prefix items with station tag if multiple stations exist on the ticket: `[BAR] Mojito x2`.
- Printers are configured in `/dashboard/settings/printers` and linked to stations in `/dashboard/settings/kitchen-stations`.
