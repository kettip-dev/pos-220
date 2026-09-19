# POS Tablet-First Touch & UX Guidelines

These guidelines apply to all POS components, drawers, modifers, and counter service screens (especially in [`restropro-saas-frontend-main/src/views/POSPage.jsx`](file:///c:/projects_tipket/Other%20Projects/restro-220/restropro-saas-frontend-main/src/views/POSPage.jsx) and [`restropro-saas-frontend-main/src/components/pos/`](file:///c:/projects_tipket/Other%20Projects/restro-220/restropro-saas-frontend-main/src/components/pos/)).

---

## 1. Touch Target Sizing Standard
- **Primary Action Buttons:** Must be $\ge 48$px to $54$px tall (e.g., `Pay & Settle`, `Send to Kitchen`, `Add to Order`).
- **Secondary Controls & Pills:** Must be $\ge 42$px tall (e.g., dining type pills, table selector chip, customer filter).
- **Steppers (+ / -):** Buttons must be at least $36 \times 36$px to $40 \times 40$px with clear tactile padding.
- **Icon-Only Buttons:** Minimum bounding box of $40 \times 40$px with centered icons.

---

## 2. Layout & Scrolling
- **Zero Double-Scrollbars:** Avoid hardcoded pixel calculations like `height: calc(100vh - 175px)`. Use flex containers with `flex-1 min-h-0 h-full overflow-hidden`.
- **Horizontal Rails:** Use `touch-pan-x overflow-x-auto no-scrollbar` for category selectors to support fluid swipe gestures on touchscreens.
- **Sticky Drawers & Footers:** Modal sheets and drawers must keep total sums and primary CTAs pinned to the bottom (`sticky bottom-0`) with a subtle top border and backdrop blur.

---

## 3. Tactile Feedback & Micro-Interactions
- Always include `active:scale-95` or `active:scale-98` and `transition-all duration-150` on clickable elements.
- When an item is added or tapped, provide visual feedback (e.g. background pulse, checkmark badge, ring outline `ring-2 ring-emerald-500`).

---

## 4. On-Screen Numpad
- Tablets mounted on stands or held in hands should avoid popping up the device OS soft keyboard during checkout.
- Provide on-screen tactile numpad keys ($50 \times 50$px minimum) for cash tender and custom discount entries.
- Include quick cash tender chips for exact total and nearest round bills (\$10, \$20, \$50, \$100).
