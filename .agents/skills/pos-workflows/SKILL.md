---
name: pos-workflows
description: >-
  Use this skill when developing, refactoring, or troubleshooting the POS screen, cart calculations,
  dining type switching, table selection, modifiers/addons, or payment checkout.
---

# POS Development & Cart Workflows

This skill provides step-by-step guidance for working with the Point of Sale terminal located in [`restropro-saas-frontend-main/src/views/POSPage.jsx`](file:///c:/projects_tipket/Other%20Projects/restro-220/restropro-saas-frontend-main/src/views/POSPage.jsx).

---

## 1. POS Component Hierarchy

```
POSPage.jsx
├── POSOrderHeader.jsx       (Delivery Type, Table Selector, Customer Chip, Search)
├── Category Rail            (Horizontal swipe-scrollable pills)
├── Item Grid / Item Cards   (POSMenuItemCompactView.jsx or card grid)
├── Cart Ticket Panel        (Item lines, steppers, notes, totals, discount chips)
├── POSModifierDrawer.jsx    (Variants, add-on checkboxes, kitchen notes, quantity)
└── POSPaymentDrawer.jsx     (Payment method cards, quick cash, touch numpad, settle CTA)
```

---

## 2. Key State Objects & Data Flow

### Cart Item Object Structure
```javascript
{
  id: Number,              // Unique line ID (or composite key)
  itemId: Number,          // menu_items.id
  title: String,           // Item title
  price: Number,           // Base unit price
  quantity: Number,        // Line quantity (integer >= 1)
  variant: {               // Optional selected variant
    id: Number,
    title: String,
    price: Number
  } | null,
  addons: [                // Array of selected addon objects
    { id: Number, title: String, price: Number }
  ],
  notes: String,           // Item-specific kitchen preparation notes
  kitchenStationId: Number // Effective station ID (overridden or inherited)
}
```

### Dining Types Supported
- `dine_in`: Requires or associates with `table_id` and guest count (`covers`).
- `takeaway`: Direct walk-in takeaway without table assignment.
- `delivery`: Associated with customer profile, phone number, and delivery address.

---

## 3. Modifying POS Drawers

1. **Modifier Drawer (`POSModifierDrawer.jsx`):**
   - Opened via `handleItemClick(item)`.
   - If the item has no variants or addons, it can be quick-added directly to the cart.
   - Always preserve preset instruction chips ("Less spicy", "No onions", "Well done") and support custom text notes.

2. **Payment Drawer (`POSPaymentDrawer.jsx`):**
   - Opened via "Pay & Settle" button.
   - Calculate `changeDue = Math.max(0, tenderAmount - payableTotal)`.
   - Ensure the numpad buttons prevent the tablet's OS keyboard from opening.
   - Provide 1-tap quick cash chips calculated dynamically based on `payableTotal` (exact amount, next \$10, \$20, \$50, \$100).

---

## 4. Sending Orders to Kitchen

- POS orders are submitted via `createOrder(orderData)` targeting `POST /api/v1/pos/orders`.
- The backend snapshots each item's effective `kitchen_station_id`:
  ```sql
  COALESCE(i.kitchen_station_id, c.kitchen_station_id) AS effective_kitchen_station_id
  ```
- Print tokens and kitchen tickets are triggered immediately using `ReceiptHelper.js` or `EscPosHelper.js`.
