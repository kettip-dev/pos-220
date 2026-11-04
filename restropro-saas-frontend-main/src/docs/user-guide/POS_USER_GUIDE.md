# Restro PRO — POS User Guide

A step-by-step guide for cashiers, waiters, and managers using the Restro PRO Point of Sale.

> **New to Restro PRO?** Start with [Getting Started: from sign-up to your first completed order](GETTING_STARTED.md).

---

## Contents

1. [Before you start](#1-before-you-start)
2. [The POS screen at a glance](#2-the-pos-screen-at-a-glance)
3. [Taking an order](#3-taking-an-order)
4. [Customers and loyalty](#4-customers-and-loyalty)
5. [Discounts and promotions](#5-discounts-and-promotions)
6. [Sending to the kitchen and taking payment](#6-sending-to-the-kitchen-and-taking-payment)
7. [Drafts (held orders)](#7-drafts-held-orders)
8. [QR menu orders](#8-qr-menu-orders)
9. [Tables and dine-in service](#9-tables-and-dine-in-service)
10. [Splitting a bill](#10-splitting-a-bill)
11. [Orders screen](#11-orders-screen)
12. [Kitchen Display (KDS)](#12-kitchen-display-kds)
13. [Registers and cash control](#13-registers-and-cash-control)
14. [Keyboard shortcuts](#14-keyboard-shortcuts)
15. [Manager setup checklist](#15-manager-setup-checklist)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Before you start

1. **Sign in** at the login page with the account your manager gave you.
2. **Open your register** (if your store requires one). A register is a physical till. Count the cash float and enter it when opening. If the store requires an open register, payments are refused until you open one.
3. **Choose your language** (English or Khmer) from the **Language** menu if needed.
4. Go to **POS** in the left menu.

> **Tip:** The POS is built for tablets. Every button is large enough to tap, and drawers slide in from the side so you never lose sight of the order ticket.

---

## 2. The POS screen at a glance

| Area | What it does |
|---|---|
| **Order header** (top) | Pick the dining option (Dine-In / Take Away / Delivery), select a table, attach a customer, and search the menu. |
| **Quick buttons** | **New** (start a fresh ticket), **QR Orders**, **Drafts**, **Table Orders**, **Dual Screen**. |
| **Category rail** | Swipe left or right through the menu categories. Tap **All** to show everything. |
| **Item grid** | Tap an item to add it to the ticket. |
| **Order Ticket** (right) | Item lines, quantity steppers, notes, discount and promotion chips, totals, and the action buttons. |

### Payment modes

Your manager sets the payment mode in Settings, and it changes which buttons you see:

| Mode | How it works | Main button |
|---|---|---|
| **Prepaid** | The customer pays before the order goes to the kitchen (quick service). | **Collect Payment & Send to Kitchen** (F4) |
| **Postpaid** | The order goes to the kitchen first and the customer pays later (table service). | **Send to Kitchen** (F8) |
| **Flexible** | You can use either button. | Both |

---

## 3. Taking an order

### Step 1 — Choose the dining option
Tap **Dine-In**, **Take Away**, or **Delivery** in the order header.

- **Dine-In:** tap **Select Table** and choose a table from the list or the **Floor Plan**. Enter the number of **Guests** if asked.
- **Take Away:** no table is needed.
- **Delivery:** attach a customer (name, phone, address). See [section 4](#4-customers-and-loyalty).

### Step 2 — Add items
- Tap an item card. If the item has no options, it is added straight to the ticket.
- If the item has **variants or add-ons**, the **Select Variant & Addons** drawer opens:
  1. Choose a **Size / Variant**. Options marked **Required** must be chosen.
  2. Tick any **Add-ons & Extras**.
  3. Tap a quick instruction chip (for example "Less spicy" or "No onions") or type your own **Kitchen Instructions**.
  4. Set the quantity and tap **Add to Order**.
- To find an item fast, press **F2** or **/** and type in **Search menu items…**.

### Step 3 — Adjust the ticket
- Use **+ / −** on a line to change the quantity.
- Tap **Notes** on a line to add or change kitchen notes.
- **Same Line ON/OFF:**
  - **ON:** tapping the same item again increases the quantity on the existing line.
  - **OFF:** each tap creates a separate line, which is useful when two people want the same dish with different notes.
- **Merge duplicate lines** combines identical lines into one row.
- To remove a line, reduce its quantity to zero or use the delete control on the line.

### Step 4 — Check the totals
The ticket shows **Items Net Total**, **Tax Total**, **Service Charge Total**, **Discount Total**, and **Payable Total**.

---

## 4. Customers and loyalty

Press **F3** or tap the customer chip (**WALKIN CUSTOMER** by default) to open **Customer & Loyalty**.

- **Search** by phone number or name, or tap a guest under **Recent Customers** to select them in one tap.
- **Add Customer:** enter the name, phone, and optionally email, birthdate, and remarks, then tap **Save & Attach to Ticket**.
- When a customer is attached, the drawer also shows:
  - **Usual Favorites:** the customer's regular items. Tap one to add it to the ticket.
  - **Loyalty Reward:** their points balance. Tap **Use Max** to redeem.
  - **Customer Group Discount:** applied automatically if the customer belongs to a discount group.
- Tap **Reset to Walk-in** to detach the customer.

---

## 5. Discounts and promotions

### Manual discount
Tap **Apply Discount** on the ticket, choose **Fixed** (an amount) or **Percentage**, enter the value, and tap **Apply**.

### Promotions and offers
Tap **Promotions & Discounts** on the ticket.

- **Scheduled Specials Today** lists the deals that are active now. Tap one to apply it.
- **Voucher / Promo Code:** type the code (for example `SAVE20`) using the **Virtual Touch Keypad** and apply it.
- Badges on each deal:
  - **BOGO Free:** buy one, get one free.
  - **Min:** the minimum spend needed for the deal.
  - **Max Cap:** the largest discount the deal can give.
  - **Stackable:** the deal can be combined with other deals.
  - **Auto-Cart:** the deal applies itself when the conditions are met.
- **Spend More to Unlock** shows how much more the customer needs to spend to qualify for a deal.
- **Customer Savings** shows the total promotion discount on the ticket.

> Promotions are created in **Promotions** in the back office and appear on the POS automatically.

---

## 6. Sending to the kitchen and taking payment

### Send to Kitchen (postpaid / table service)
Tap **Send to Kitchen** or press **F8**. The order goes to the Kitchen Display and the kitchen ticket (KOT) prints at the right station. You collect payment later from **Tables** or **Orders**.

### Collect payment (prepaid / quick service)
Tap **Create Receipt & Pay** / **Collect Payment & Send to Kitchen**, or press **F4**. The **Settle Payment** drawer opens.

1. **Select Payment Method:** Cash, Card, QR (KHQR), or any other method set up by your manager.
2. **Cash:**
   - Tap the quick note buttons (**Quick USD Banknotes**, **Quick Riel Banknotes**) or **Exact ($)** / **Exact (៛)**.
   - **Cambodian Dual-Currency:** you can take USD and Riel together. **Total Cash Received** and **Change Due** update as you tap. **Change Return Advice** suggests how to give the change: **All Riel** or **$ + ៛ Mixed**, rounded to the nearest ៛100 note.
   - **Shift Exchange Rate:** tap it to adjust the rate (1 USD to KHR) for your shift.
   - If the screen shows **Needs More Cash**, the customer has not paid enough yet.
   - Tap **Settle & Print Receipt**.
3. **Card:** the customer swipes or taps on the payment terminal. Enter the **Card Auth / Ref Number** (optional), then tap **Confirm Card Payment & Print Receipt**.
4. **QR (KHQR):** the customer scans with ABA Mobile, Wing, Bakong, or another banking app. Check the payment, then tap **Confirm QR Payment & Print Receipt**.
5. **1-Tap Cash** settles the exact amount in cash and prints the receipt in one tap.

When payment is complete, the **Payment Successful** screen shows the change due. Tap **Print Receipt** or **Start Next Order** (Enter also starts the next order).

To leave the drawer without paying, tap **Cancel & Return to Order Ticket** or press **Esc**.

---

## 7. Drafts (held orders)

Use drafts when a customer steps away or you need to serve someone else first.

- **Hold the ticket:** tap **Draft** on the ticket, enter a **Reference** name (for example "Blue shirt" or "Table 5 guest"), and save.
- **Resume it:** tap **Drafts** in the header and tap a card. If you have an active ticket, it is held automatically and swapped with the draft.
- **Clear All Drafts** deletes every held ticket. You will be asked to confirm.

---

## 8. QR menu orders

Guests can scan the QR code on their table and order themselves. New guest orders show a **New QR Order** notice and a badge on **QR Orders**.

Open **QR Orders** to review the pending orders:

- **Approve → KDS:** sends the order straight to the kitchen.
- **Edit in Cart:** loads the order into the POS ticket so you can change items or collect payment. Your current ticket is held in Drafts automatically.
- **Reject:** cancels the guest's order. You will be asked to confirm.
- **Approve All** / **Reject All** handle every pending order at once.

Each table has a 4-digit **Table QR PIN**. From **Tables → Table Actions**, you can reset the PIN or print a **QR + PIN Slip** for guests.

---

## 9. Tables and dine-in service

Open **Tables** from the left menu. You can switch between **Floor Plan View** and **Grid View**, and filter by floor, zone, status, or capacity.

### Table status colours

| Status | Meaning |
|---|---|
| **Free** | The table is ready for guests. |
| **Seated** | Guests are seated but have not ordered yet. |
| **Ordered** | The order has been sent to the kitchen. |
| **Unsent** | Items are on the ticket but have not been sent yet. |
| **Bill Req** | The guests have asked for the bill. |
| **Paid** | The bill is settled. |
| **Overtime / Alert** | The table has been waiting too long and needs attention. |
| **Reserved** | The table is held for a reservation. |
| **Multi** | The table is merged with another table. |
| **Blocked** | The table is not available. |

### Common actions
Tap a table to open its sidebar, then:

- **Start Dine-in Order** / **+ Take Order / Add Items:** opens the POS with the table already selected.
- **View in Kitchen:** shows the table's kitchen progress.
- **Pay Now** / **Settle Bill & Invoices:** takes payment for the table.
- **Move Table:** moves the whole order to another table.
- **Move Item / Transfer Items:**
  1. Choose the **Destination Table**.
  2. Select the items to move.
  3. Tap **Transfer Items**.
- **Merge Table:** tap two tables to link them, and tap them again to unlink. Tap **Exit Merge** when you are done.
- **Split Checks:** see [section 10](#10-splitting-a-bill).

### Editing the floor plan (managers)
Tap **Edit Layout**. You can:

- Drag tables to new positions.
- Tap a table to rotate (90°), edit, or delete it.
- Use **Add Table**, **Add Zone**, and **Draw Wall**.
- Upload a floor plan image.

Tap **Save Layout** when finished.

---

## 10. Splitting a bill

Open **Split Bill & Settle** from the table actions or the payment flow.

- **Split by Items:** add guest checks, then tap items in **Unassigned Items** to assign each one to a guest. Every item must be assigned before you can continue.
- **Split Evenly:** choose the number of guests. **Each Guest Pays** shows each guest's share.

You need at least 2 checks. Tap **Confirm & Create Split Checks**, then settle each check with **Settle Check**. When every check is paid, the order is completed automatically.

- **Print All Checks** prints a bill for each guest.
- **Revert Split** cancels the split plan if no check has been paid yet.

---

## 11. Orders screen

**Orders** shows every active dine-in, takeaway, and delivery order, updated live.

- **Filter tabs:** All Orders, Dine-In, Takeaway & Delivery, Unpaid, Paid.
- **Search** by token number, table, customer, or item.
- **Views:**
  - **Group by Table** or **Individual Tickets**.
  - **Normal** or **Compact**.
  - **Oldest first** or **Newest first**.
- **Tap a status** to move it forward: Preparing → Completed → Delivered.
- **Pay & Complete** collects payment on an unpaid order and completes it.
- **Void / Cancel item** removes one item from an order. You will be asked to confirm.
- **Cancel** cancels the whole order. This cannot be undone.
- **Print Receipt** reprints the receipt. **Collect Feedback** shows a QR code for the guest to rate their visit.
- **Token Display Mode** is a minimal TV view of token numbers for the pick-up counter.

The **Live** indicator shows that real-time sync is connected. If it shows **Offline**, tap **Refresh**.

---

## 12. Kitchen Display (KDS)

Open **Kitchen** on the kitchen screen or tablet.

- Choose your **station tab** (for example Grill, Bar, or Cold) to see only that station's items.
- Each ticket shows the token number, the dining type and table, the items, the add-ons, and the notes.
- Tap **Start Making** when you begin cooking. Tap **Complete** when the items are ready. Front-of-house sees the change immediately.
- A station only completes its own items. The order is ready when every station has finished.

---

## 13. Registers and cash control

Managers set this up in **Settings → Registers & Cash**.

### Day-to-day
1. **Open a register** at the start of your shift and count the float.
2. Take payments as normal. Only payment methods marked **Cash** count towards the expected cash in the drawer.
3. Print an **X report** at any time to see the running totals for the shift.
4. **Close (Z)** at the end of your shift:
   1. Count the drawer.
   2. Enter the count.
   3. Review the **Over / short** amount.
   4. Close the register and print the **Z report**.

   If **Blind close** is on, you count the drawer before the system shows the expected amount.
5. A manager uses **Close business day** once all registers are closed.

### Rules managers can set
- **Require an open register to take payments.**
- **Variance needing manager approval:** the largest over/short amount allowed without a manager.
- **Prompt a safe drop above:** asks the cashier to move cash to the safe when the drawer holds more than this amount.
- **Refunds needing a manager PIN above:** refunds larger than this amount need a manager PIN.
- **Business day starts at (hour):** sales after midnight but before this hour count for the previous day.
- **Cashier change mid-shift:**
  - **Shared drawer:** the next cashier takes over the open drawer without a recount.
  - **Strict accountability:** each cashier closes their own drawer before the next cashier opens one.

A closed register can be **reopened** with a reason while its business day is still open. The reopen is recorded in the audit log.

---

## 14. Keyboard shortcuts

These work on the POS screen when you are not typing in a text box.

| Key | Action |
|---|---|
| **F2** or **/** | Jump to menu search |
| **F3** | Open Customer & Loyalty |
| **F4** | Collect payment (prepaid / flexible mode) |
| **F8** | Send to Kitchen (postpaid / flexible mode) |
| **Esc** | Close the open drawer, cancel note editing, or clear the search |
| **Enter** | On the Payment Successful screen, start the next order |

---

## 15. Manager setup checklist

Complete these in **Settings** before the first service:

- [ ] **Details:** business name, address, currency, and POS payment mode (Prepaid / Postpaid / Flexible)
- [ ] **Tax Setup:** tax rates and service charge
- [ ] **Payment Types:** Cash, Card, KHQR, and any other methods
- [ ] **Menu Items → Categories:** create categories and assign each one a kitchen station
- [ ] **Menu Items:** add items, prices, variants, add-ons, and station overrides
- [ ] **Kitchen Stations:** create a station for each prep area (Grill, Bar, and so on)
- [ ] **Thermal Printers / Print Settings:** add the receipt and KOT printers and bind them to stations
- [ ] **Tables:** set up floors, zones, and tables. Use **Table Assignments** to give waiters their sections.
- [ ] **Registers:** create the tills and set the cash control rules
- [ ] **Users:** create staff accounts with the right permissions
- [ ] **Loyalty / Promotions** (optional)
- [ ] **Telegram** (optional): order and sales notifications

---

## 16. Troubleshooting

| Problem | What to do |
|---|---|
| A toast says "Store is in Prepaid mode" (or "Postpaid mode") | Use the other button: F4 to pay in prepaid mode, F8 to send in postpaid mode. A manager can change the mode in Settings. |
| Payment is refused with a register message | Open a register first. See [section 13](#13-registers-and-cash-control). |
| The kitchen did not receive the order | Check that the item's category has a kitchen station and that the station's printer is online. Look at the **Kitchen** screen for that station. |
| Orders or Tables show **Offline** | Check the Wi-Fi or network connection, then tap **Refresh**. |
| Nothing prints | Check that the printer is on and has paper. In **Settings → Thermal Printers**, confirm the printer's IP address and its station binding. |
| A QR order does not appear | Make sure the guest entered the correct table PIN. Open **QR Orders** and check the list. |
| A split check cannot be reverted | A check has already been settled. Settle the remaining checks instead. |
| An item was added by mistake after sending | In **Orders**, use **Void / Cancel item** on that line. |
