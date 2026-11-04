# Restro PRO — Getting Started

**From sign-up to your first completed order**

This walkthrough takes a new owner from creating an account to completing a real order, in about 20–30 minutes. Each step builds on the one before, so do them in order.

The example used throughout is a small café called **"Sunrise Café"** selling one item, an **Iced Latte at $2.50**. Use your own details instead.

> For day-to-day use after setup, see the [POS User Guide](POS_USER_GUIDE.md).

---

## Overview

| # | Stage | Where | Time |
|---|---|---|---|
| 1 | Create your account | Sign-up page | 2 min |
| 2 | Activate your plan | Billing Plans | 1 min |
| 3 | First sign-in and dashboard | Dashboard | 1 min |
| 4 | Check store details and billing mode | Settings → Details | 2 min |
| 5 | Set up tax and service charge | Settings → Tax Setup | 2 min |
| 6 | Add payment methods | Settings → Payment Types | 2 min |
| 7 | Create a category | Settings → Menu Items → Categories | 1 min |
| 8 | Add your first menu item | Settings → Menu Items | 3 min |
| 9 | Set up tables (dine-in only) | Settings → Tables | 3 min |
| 10 | Set up printing (optional) | Settings → Print Settings / Thermal Printers | 5 min |
| 11 | Open the register (if used) | Settings → Registers & Cash | 1 min |
| 12 | Open the Kitchen Display | Kitchen | 1 min |
| 13 | Take your first order | POS | 2 min |
| 14 | Prepare it in the kitchen | Kitchen | 1 min |
| 15 | Complete the order | Orders | 1 min |
| 16 | Confirm it worked | Dashboard / Reports | 1 min |

---

## Stage 1 — Create your account

1. Open the Restro PRO sign-up page and tap **Create Account** (or **Continue with Google**).
2. **Let's set up your business:**
   - **Business name:** `Sunrise Café`
   - **Type of business:** Restaurant, Cafe & Bakery, Bar & Lounge, Fast Food, Food Truck & Kiosk, or Other
   - **Main currency:** US Dollar or Khmer Riel. You can accept a second currency at checkout later.
   - **Business phone** and **City** (optional)
3. **How do you serve guests?** This sets your POS billing mode:

   | Choice | Billing mode | Best for |
   |---|---|---|
   | **Table service** | Postpaid: order first, pay at the end | Sit-down restaurants |
   | **Counter service** | Prepaid: pay first, then food is served | Cafés, fast food, kiosks |
   | **Both** | Flexible: the cashier chooses per order | Mixed venues |

   You can change this later in **Settings → Details**.
4. **What can we help you do?** Tick the features you plan to use (dine-in, counter checkout, kitchen display, QR ordering, takeaway, printing, dual currency). This only tailors your setup and does not lock anything.
5. **Create your owner account:**
   - Enter **Your name**, **Email**, **Password** (at least 6 characters), and **Confirm Password**.
   - Tap **Create account**.
6. You will see **"{Your business} is ready"** with a summary of your venue, currency, billing mode, and kitchen routing.

**What is created for you automatically:**

- Your store profile, with your name, currency, and billing mode
- An owner (admin) user
- One kitchen station called **Kitchen**, so orders can reach the kitchen screen right away

**What is _not_ created yet:** menu, categories, taxes, payment methods, tables, and printers. You will set these up in Stages 4–10.

---

## Stage 2 — Activate your plan

A new workspace starts without an active subscription. When you sign in, you may see **Billing Plans** ("You don't have any active Subscription!").

1. Choose **Pay Monthly** or **Pay Yearly**.
2. Tap **Start free trial** on a plan that offers one, or tap **Subscribe**.
3. After subscribing, **sign out and sign in again** so your account picks up the new plan.

> If you still see Billing Plans after subscribing, sign out and sign back in. If that does not work, use **Contact Support**.

---

## Stage 3 — First sign-in and dashboard

1. Sign in with your email and password.
2. On your first visit, the dashboard asks you to **pick a layout template**. Choose any template; you can rearrange widgets later with **Add widget** / **Reset**.
3. The left menu now shows **POS, Tables, Orders, Kitchen, Settings**, and more.

From here, open **Settings** for Stages 4–11.

---

## Stage 4 — Check store details and billing mode

**Settings → Details**

1. Confirm the **Store Name**, **Address**, **Phone**, **Email**, and **Currency**.
2. Upload a **Store Image** (logo). It appears on receipts and on the QR menu.
3. Under **POS Billing & Payment Mode**, check that the mode is correct: **Flexible / Both**, **Prepaid Only**, or **Postpaid Only**.
4. Optional:
   - **Enable QR Menu:** guests can view your menu by scanning a QR code.
   - **Enable Order Via QR Menu:** guests can also order from that menu.
   - **Enable Collecting Feedback.**
5. Tap **Save**.

---

## Stage 5 — Set up tax and service charge

**Settings → Tax Setup**

1. Tap **New** to add a tax:
   - **Title:** e.g. `VAT`
   - **Rate:** e.g. `10`
   - **Type:**
     - **Exclusive:** the tax is added on top of the menu price.
     - **Inclusive:** the tax is already included in the menu price.
2. Tap **Save**.
3. Optional: set a **Service Charge %** and save it.

> If your business does not charge tax, skip this stage. Menu items can be saved without a tax.

---

## Stage 6 — Add payment methods

**Settings → Payment Types**

Payment methods are **not** created automatically. Without at least one, there is nothing to choose in the payment drawer.

Tap **New** and add each method you accept:

| Title | Icon | Cash in drawer? |
|---|---|---|
| `Cash` | Cash | **Yes** |
| `Card` | Card | No |
| `KHQR` | Qr | No |

- Make sure **Active?** is on for each method.
- **Name your methods clearly.** Include "Cash" in the cash method's title and "QR" in the QR method's title (e.g. `KHQR`). The payment drawer uses the title to show the right screen: the Riel/USD cash pad for cash, or the scan-to-pay screen for QR.
- If you will use registers, open **Settings → Registers & Cash → Payment methods in the drawer** and mark only **Cash** as cash.

---

## Stage 7 — Create a category

**Settings → Menu Items → Categories**

1. Tap **New** and enter a **Category Title**, e.g. `Coffee`.
2. Choose the **kitchen station** for this category. Your new workspace has one station, **Kitchen**, so pick that.
3. Tap **Save**.

> Every item in a category is sent to that category's station. You can override the station on individual items later.

---

## Stage 8 — Add your first menu item

**Settings → Menu Items → Add New Item** (or **Create Menu Item**)

1. Fill in:
   - **Title:** `Iced Latte`
   - **Price:** `2.50`
   - **Category:** `Coffee`
   - **Tax:** `VAT` (if you created one in Stage 5)
   - **Item Photo** (optional, compressed automatically)
2. Make sure **Available on POS & QR Menu** is on.
3. Tap **Save**.
4. Optional: open the item's full details (**Open Full Details**) to add:
   - **Variants**, e.g. `Small $2.50` / `Large $3.00`
   - **Add-ons**, e.g. `Extra shot +$0.50`

> **Have many items?** Use **Import** on the Menu Items page to upload your menu in one go.

---

## Stage 9 — Set up tables (dine-in only)

Skip this stage if you only do counter service or takeaway.

**Settings → Tables**

1. Add a floor or zone, e.g. `Main Floor`.
2. Add tables. For each table, enter a name or number (e.g. `T1`) and pick a type:
   - **Small:** round, 2 seats
   - **Medium:** square, 4 seats
   - **Large:** rectangle, 6 seats
3. Optional: in **Tables → Edit Layout**, drag tables to match your room, then tap **Save Layout**.
4. Optional: use **Settings → Table Assignments** to give waiters their sections.

---

## Stage 10 — Set up printing (optional)

You can complete your first order without a printer, so you can skip this stage and come back later.

**Settings → Print Settings**

1. Turn on **Enable Print**.
2. Choose the **Format (Page Size)**, e.g. 80 mm.
3. Add a **Header** (e.g. "Thank you for visiting!") and a **Footer** (e.g. Wi-Fi password).
4. Turn on **Print Token** if you give customers a queue number. Tokens reset every day.
5. Tap **Save**.

**Settings → Thermal Printers** (network or USB ESC/POS printers)

1. Add your receipt printer (IP address for a network printer).
2. Add a kitchen (KOT) printer and **bind it to the Kitchen station**.
3. Print a test page.

---

## Stage 11 — Open the register (if used)

**Settings → Registers & Cash**

1. Add a register, e.g. `Front Till`.
2. Decide whether to turn on **Require an open register to take payments**.
3. Open the register on the device you will use for the POS:
   1. Count the starting cash float.
   2. Enter the amount.
   3. Open the register.

> If you turn on **Require an open register**, every payment is refused until a register is open. For your very first test you can leave it off.

---

## Stage 12 — Open the Kitchen Display

On a second tablet or screen, or a second browser tab for testing:

1. Sign in with the same account.
2. Open **Kitchen** from the left menu.
3. Select the **Kitchen** station tab.
4. The screen shows "No pending orders right now". Leave it open.

---

## Stage 13 — Take your first order

Open **POS** from the left menu. Choose the path that matches your billing mode.

### Path A — Counter service (Prepaid or Flexible)

1. Tap **Take Away** in the order header.
2. Tap the **Coffee** category, then tap **Iced Latte**. If it has variants, choose a size and tap **Add to Order**.
3. Check the **Order Ticket**: it should show 1 × Iced Latte, the tax, and the **Payable Total**.
4. Tap **Collect Payment & Send to Kitchen** (or press **F4**).
5. Choose **Cash**, tap **Exact ($)**, then tap **Settle & Print Receipt**.
6. The **Payment Successful** screen appears. Note the **Order ID** or **Token Number**.

### Path B — Table service (Postpaid or Flexible)

1. Tap **Dine-In**, then **Select Table**, and choose **T1**.
2. Add **Iced Latte** to the ticket.
3. Tap **Send to Kitchen** (or press **F8**). You will see "Order sent to Kitchen!".
4. Payment happens later, in Stage 15.

---

## Stage 14 — Prepare it in the kitchen

On the **Kitchen** screen from Stage 12:

1. The new ticket appears within a second or two, showing the token, the dining type or table, and **1 × Iced Latte**.
2. Tap **Start Making**. The status changes to **Preparing**.
3. When the drink is ready, tap **Complete**.

> **Ticket didn't appear?** Check that the **Coffee** category is assigned to the **Kitchen** station (Stage 7) and that the Kitchen page shows **Live**.

---

## Stage 15 — Complete the order

Open **Orders** from the left menu and find your order by token number.

### Path A — Already paid at the counter
1. The order shows **PAID**.
2. Tap the status to move it to **Completed** (or **Delivered** once it has been handed to the customer).

### Path B — Table service, not paid yet
1. The order shows **UNPAID**. You can also open it from **Tables** by tapping **T1**, then **Pay Now**.
2. Tap **Pay & Complete**.
3. Choose **Cash** and tap **Exact ($)**.
4. Tap **Settle & Print Receipt**.
5. The order is now **PAID** and **Completed**, and table **T1** goes back to **Free**.

**Your first order is complete.**

---

## Stage 16 — Confirm it worked

| Check | Where | Expected result |
|---|---|---|
| The sale was recorded | **Dashboard → Today at a glance** | 1 order, $2.50 plus tax |
| Best-seller list | **Dashboard → Top Selling Items** | Iced Latte |
| Receipt and invoice | **Invoices** | One invoice for the order |
| Cash balance (if using a register) | **Registers → X report** | Expected cash includes the sale |
| Table freed (Path B) | **Tables** | T1 shows **Free** |

---

## You're live. Next steps

- [ ] Add the rest of your menu, with photos, variants, and add-ons
- [ ] Add more kitchen stations (e.g. **Bar**) in **Settings → Kitchen Stations**, and assign categories to them
- [ ] Create staff accounts in **Users** with the right permissions
- [ ] Turn on **QR Menu** ordering and print table QR + PIN slips
- [ ] Set up **Loyalty** and **Promotions**
- [ ] Connect **Telegram** notifications for daily sales
- [ ] Practise end-of-day: close the register (Z report), then **Close business day**

---

## Common first-day problems

| Problem | Fix |
|---|---|
| Billing Plans page keeps appearing | Sign out and sign in again after subscribing. |
| The item doesn't appear on the POS | Check that the item is **Available on POS & QR Menu** and has a category. |
| No payment methods in the payment drawer | Add them in **Settings → Payment Types** (Stage 6) and make sure **Active?** is on. |
| The QR or cash screen doesn't show for a method | Rename the method so the title contains "QR" or "Cash". |
| "Store is in Prepaid mode" when pressing Send to Kitchen | Use **Collect Payment** (F4), or change the mode in **Settings → Details**. |
| Payment refused with a register message | Open a register (Stage 11), or turn off **Require an open register**. |
| The kitchen never receives the order | Assign the category to the **Kitchen** station and refresh the Kitchen page. |
| Nothing prints | Printing is optional. Check **Enable Print** and the printer's IP address and station binding (Stage 10). |
