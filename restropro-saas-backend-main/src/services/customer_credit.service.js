const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { registerError, cashBucketsForLine, getPaymentTypesMapTx, writeAuditTx } = require("./register.service");

/**
 * Pay Later (customer credit / house accounts).
 *
 * A pay-later bill is an ordinary completed invoice whose `balance_due` is
 * still owed by a named customer. See utils/customerCreditMigration.js for the
 * model. Everything here is tenant-scoped; customers are keyed by
 * (phone, tenant_id).
 */

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

/**
 * A refused request. `key`/`args` let the controller translate the message
 * into the user's language (translations/locales/*.json); `message` is the
 * English fallback.
 */
const creditError = (code, key, args, message, extra = {}) => registerError(code, message, { i18n: { key, args }, ...extra });

const OPEN_BALANCE_SQL = `status <> 'VOID' AND balance_due > 0`;

const normaliseDueDate = (value) => {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) throw creditError("INVALID_DUE_DATE", "credit_invalid_due_date", {}, "Due date must be YYYY-MM-DD");
  return `${match[1]}-${match[2]}-${match[3]}`;
};

const getCustomerTx = async (conn, tenantId, phone, { forUpdate = false } = {}) => {
  const [rows] = await conn.query(
    `SELECT phone, name, email, credit_limit FROM customers WHERE phone = ? AND tenant_id = ? LIMIT 1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [phone, tenantId]
  );
  return rows[0] || null;
};

const getOutstandingTx = async (conn, tenantId, phone) => {
  const [[row]] = await conn.query(
    `SELECT COALESCE(SUM(balance_due), 0) AS outstanding, COUNT(*) AS open_invoices
     FROM invoices WHERE tenant_id = ? AND customer_phone = ? AND ${OPEN_BALANCE_SQL}`,
    [tenantId, phone]
  );
  return { outstanding: round2(row?.outstanding), openInvoices: Number(row?.open_invoices || 0) };
};

/**
 * Checkout side of Pay Later, run inside createInvoiceDB's transaction.
 *
 * `payments` are the tender lines taken now (a deposit); they may be empty.
 * Unlike a normal sale they must add up to LESS than the bill: the rest goes
 * on the customer's account. Enforces the customer's credit limit, locking the
 * customer row so two tills can't both squeeze under the limit at once.
 *
 * Returns { paymentLines, paidNow, balanceDue, dueDate, note }.
 */
exports.prepareCreditSaleTx = async (conn, { tenantId, customerPhone, payments, total, payLater }) => {
  if (!customerPhone) {
    throw creditError("PAY_LATER_NEEDS_CUSTOMER", "credit_needs_customer", {}, "Attach a customer to this bill before putting it on their account");
  }
  const customer = await getCustomerTx(conn, tenantId, customerPhone, { forUpdate: true });
  if (!customer) {
    throw creditError("PAY_LATER_NEEDS_CUSTOMER", "credit_save_customer_first", {}, "Save this customer first, then put the bill on their account");
  }

  const totalDue = round2(total);
  const paymentLines = (Array.isArray(payments) ? payments : [])
    .filter((l) => l && l.paymentTypeId !== undefined && l.paymentTypeId !== null && l.paymentTypeId !== "")
    .map((l) => ({ ...l, amount: round2(l.amount) }))
    .filter((l) => l.amount > 0);
  const paidNow = round2(paymentLines.reduce((acc, l) => acc + l.amount, 0));
  const balanceDue = round2(totalDue - paidNow);

  if (balanceDue <= 0) {
    throw creditError("PAY_LATER_NOTHING_OWED", "credit_bill_fully_paid", {}, "This bill is already fully paid; settle it normally");
  }

  if (customer.credit_limit !== null && customer.credit_limit !== undefined) {
    const limit = round2(customer.credit_limit);
    const { outstanding } = await getOutstandingTx(conn, tenantId, customerPhone);
    if (limit <= 0) {
      throw creditError("CREDIT_NOT_ALLOWED", "credit_not_allowed", { name: customer.name }, `${customer.name} is not allowed to pay later`);
    }
    if (round2(outstanding + balanceDue) > limit + 0.001) {
      throw creditError(
        "CREDIT_LIMIT_EXCEEDED",
        "credit_limit_exceeded",
        { name: customer.name, outstanding: outstanding.toFixed(2), limit: limit.toFixed(2), available: Math.max(0, limit - outstanding).toFixed(2) },
        `${customer.name} already owes ${outstanding.toFixed(2)}; this bill would exceed their credit limit of ${limit.toFixed(2)} (available ${Math.max(0, limit - outstanding).toFixed(2)})`,
        { outstanding, creditLimit: limit, available: round2(Math.max(0, limit - outstanding)) }
      );
    }
  }

  return {
    paymentLines,
    paidNow,
    balanceDue,
    dueDate: normaliseDueDate(payLater?.dueDate),
    note: payLater?.note ? String(payLater.note).slice(0, 255) : null,
  };
};

/** Mark a freshly-created invoice as (partly) on account. Same transaction as the insert. */
exports.markInvoiceOnAccountTx = async (conn, { tenantId, invoiceId, credit, username }) => {
  await conn.query(
    `UPDATE invoices
     SET payment_status = ?, balance_due = ?, credit_amount = ?, due_date = ?, credit_note = ?
     WHERE id = ? AND tenant_id = ?`,
    [credit.paidNow > 0 ? "partial" : "unpaid", credit.balanceDue, credit.balanceDue, credit.dueDate, credit.note, invoiceId, tenantId]
  );
  await conn.query(
    `INSERT INTO invoice_audit_log
     (tenant_id, invoice_id, invoice_number, action, performed_by, reason, previous_status, new_status)
     VALUES (?, ?, ?, 'PAY_LATER', ?, ?, 'NEW', ?)`,
    [
      tenantId, invoiceId, invoiceId, username,
      `Put ${credit.balanceDue.toFixed(2)} on account${credit.dueDate ? ` (due ${credit.dueDate})` : ""}${credit.note ? `: ${credit.note}` : ""}`,
      credit.paidNow > 0 ? "PARTIAL" : "UNPAID",
    ]
  );
};

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Everyone who owes money, with aging by invoice date. `search` matches name
 * or phone.
 */
exports.getOutstandingCustomersDB = async (tenantId, { search = "" } = {}) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const params = [tenantId];
    let searchSql = "";
    if (search && String(search).trim()) {
      searchSql = ` AND (c.name LIKE ? OR i.customer_phone LIKE ?)`;
      const like = `%${String(search).trim()}%`;
      params.push(like, like);
    }
    const [rows] = await conn.query(
      `SELECT
         i.customer_phone AS phone,
         COALESCE(c.name, i.customer_phone) AS name,
         c.credit_limit,
         COUNT(*) AS open_invoices,
         SUM(i.balance_due) AS outstanding,
         SUM(CASE WHEN DATEDIFF(CURDATE(), DATE(i.created_at)) <= 30 THEN i.balance_due ELSE 0 END) AS age_0_30,
         SUM(CASE WHEN DATEDIFF(CURDATE(), DATE(i.created_at)) BETWEEN 31 AND 60 THEN i.balance_due ELSE 0 END) AS age_31_60,
         SUM(CASE WHEN DATEDIFF(CURDATE(), DATE(i.created_at)) BETWEEN 61 AND 90 THEN i.balance_due ELSE 0 END) AS age_61_90,
         SUM(CASE WHEN DATEDIFF(CURDATE(), DATE(i.created_at)) > 90 THEN i.balance_due ELSE 0 END) AS age_90_plus,
         SUM(CASE WHEN i.due_date IS NOT NULL AND i.due_date < CURDATE() THEN i.balance_due ELSE 0 END) AS overdue,
         MIN(i.created_at) AS oldest_invoice_at,
         DATE_FORMAT(MIN(CASE WHEN i.due_date IS NOT NULL THEN i.due_date END), '%Y-%m-%d') AS next_due_date
       FROM invoices i
       LEFT JOIN customers c ON c.phone = i.customer_phone AND c.tenant_id = i.tenant_id
       WHERE i.tenant_id = ? AND i.customer_phone IS NOT NULL AND i.status <> 'VOID' AND i.balance_due > 0 ${searchSql}
       GROUP BY i.customer_phone, c.name, c.credit_limit
       ORDER BY outstanding DESC`,
      params
    );

    const customers = rows.map((r) => ({
      phone: r.phone,
      name: r.name,
      credit_limit: r.credit_limit === null ? null : round2(r.credit_limit),
      open_invoices: Number(r.open_invoices),
      outstanding: round2(r.outstanding),
      overdue: round2(r.overdue),
      aging: {
        "0_30": round2(r.age_0_30),
        "31_60": round2(r.age_31_60),
        "61_90": round2(r.age_61_90),
        "90_plus": round2(r.age_90_plus),
      },
      oldest_invoice_at: r.oldest_invoice_at,
      next_due_date: r.next_due_date,
    }));

    const [[collected]] = await conn.query(
      `SELECT COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count
       FROM customer_credit_payments
       WHERE tenant_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
      [tenantId]
    );

    const sum = (key) => round2(customers.reduce((acc, c) => acc + c[key], 0));
    return {
      customers,
      totals: {
        customers: customers.length,
        outstanding: sum("outstanding"),
        overdue: sum("overdue"),
        open_invoices: customers.reduce((acc, c) => acc + c.open_invoices, 0),
        collected_last_30_days: round2(collected?.amount),
        collections_last_30_days: Number(collected?.count || 0),
      },
    };
  } finally {
    conn.release();
  }
};

/** One customer's account: balance, limit, open bills and collection history. */
exports.getCustomerCreditDB = async (tenantId, phone) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const customer = await getCustomerTx(conn, tenantId, phone);
    if (!customer) return null;
    const { outstanding, openInvoices } = await getOutstandingTx(conn, tenantId, phone);

    const [invoices] = await conn.query(
      `SELECT id, created_at, total, credit_amount, balance_due, written_off_amount, refunded_total,
              payment_status, DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date, credit_note, created_by,
              (due_date IS NOT NULL AND due_date < CURDATE()) AS is_overdue
       FROM invoices
       WHERE tenant_id = ? AND customer_phone = ? AND ${OPEN_BALANCE_SQL}
       ORDER BY created_at ASC, id ASC`,
      [tenantId, phone]
    );

    const [settled] = await conn.query(
      `SELECT id, created_at, total, credit_amount, balance_due, written_off_amount, payment_status, paid_off_at, status
       FROM invoices
       WHERE tenant_id = ? AND customer_phone = ? AND credit_amount > 0 AND NOT (${OPEN_BALANCE_SQL})
       ORDER BY COALESCE(paid_off_at, created_at) DESC
       LIMIT 50`,
      [tenantId, phone]
    );

    const [payments] = await conn.query(
      `SELECT id, amount, payment_type_id, payment_type_title, reference, note, allocations, created_by, created_at
       FROM customer_credit_payments
       WHERE tenant_id = ? AND customer_phone = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 100`,
      [tenantId, phone]
    );

    const creditLimit = customer.credit_limit === null ? null : round2(customer.credit_limit);
    return {
      customer: { phone: customer.phone, name: customer.name, email: customer.email },
      credit_limit: creditLimit,
      outstanding,
      available: creditLimit === null ? null : round2(Math.max(0, creditLimit - outstanding)),
      open_invoice_count: openInvoices,
      open_invoices: invoices.map((i) => ({
        ...i,
        total: round2(i.total),
        credit_amount: round2(i.credit_amount),
        balance_due: round2(i.balance_due),
        written_off_amount: round2(i.written_off_amount),
        refunded_total: round2(i.refunded_total),
        is_overdue: Number(i.is_overdue) === 1,
      })),
      settled_invoices: settled,
      payments: payments.map((p) => ({
        ...p,
        amount: round2(p.amount),
        allocations: typeof p.allocations === "string" ? JSON.parse(p.allocations) : p.allocations || [],
      })),
    };
  } finally {
    conn.release();
  }
};

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Customer pays towards their account. The amount is applied oldest bill
 * first (or only to `invoiceIds` when given). The money lands in `session`'s
 * drawer: one register_payments row per invoice settled, so voids/refunds of
 * that invoice can later reverse exactly what was collected. Cash tendered in
 * two currencies is split across those rows in proportion, keeping the
 * drawer's USD/KHR counts right.
 */
exports.collectCustomerPaymentDB = async (tenantId, phone, { session, amount, paymentTypeId, reference = null, note = null, tender = null, invoiceIds = null, username }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const customer = await getCustomerTx(conn, tenantId, phone, { forUpdate: true });
    if (!customer) throw creditError("CUSTOMER_NOT_FOUND", "credit_customer_not_found", {}, "Customer not found");

    const payAmount = round2(amount);
    if (!(payAmount > 0)) throw creditError("AMOUNT_REQUIRED", "credit_amount_required", {}, "Enter the amount the customer is paying");
    if (!paymentTypeId) throw creditError("PAYMENT_TYPE_REQUIRED", "credit_payment_type_required", {}, "Choose how the customer is paying");

    const types = await getPaymentTypesMapTx(conn, tenantId, [paymentTypeId]);
    const type = types.get(Number(paymentTypeId));
    if (!type) throw creditError("PAYMENT_TYPE_NOT_FOUND", "credit_payment_type_not_found", {}, "Payment type not found");
    const isCash = Number(type.is_cash) === 1;

    const filterIds = Array.isArray(invoiceIds) ? invoiceIds.map(Number).filter((n) => n > 0) : [];
    const [openInvoices] = await conn.query(
      `SELECT id, balance_due, credit_amount, written_off_amount
       FROM invoices
       WHERE tenant_id = ? AND customer_phone = ? AND ${OPEN_BALANCE_SQL}
       ${filterIds.length ? "AND id IN (?)" : ""}
       ORDER BY created_at ASC, id ASC
       FOR UPDATE`,
      filterIds.length ? [tenantId, phone, filterIds] : [tenantId, phone]
    );
    const owed = round2(openInvoices.reduce((acc, i) => acc + Number(i.balance_due), 0));
    if (owed <= 0) throw creditError("NOTHING_OWED", "credit_nothing_owed", { name: customer.name }, `${customer.name} has nothing to pay`);
    if (payAmount > owed + 0.001) {
      throw creditError("OVERPAYMENT", "credit_overpayment", { name: customer.name, owed: owed.toFixed(2) }, `${customer.name} only owes ${owed.toFixed(2)}`, { owed });
    }

    // Oldest first.
    const allocations = [];
    let left = payAmount;
    for (const inv of openInvoices) {
      if (left <= 0) break;
      const applied = round2(Math.min(left, Number(inv.balance_due)));
      if (applied <= 0) continue;
      allocations.push({ invoiceId: Number(inv.id), amount: applied, balanceBefore: round2(inv.balance_due), balanceAfter: round2(Number(inv.balance_due) - applied) });
      left = round2(left - applied);
    }

    const [header] = await conn.query(
      `INSERT INTO customer_credit_payments
        (tenant_id, customer_phone, amount, payment_type_id, payment_type_title, session_id, reference, note, allocations, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, phone, payAmount, Number(type.id), type.title, session?.id || null,
        reference ? String(reference).slice(0, 255) : null,
        note ? String(note).slice(0, 500) : null,
        JSON.stringify(allocations), username,
      ]
    );
    const creditPaymentId = header.insertId;

    // Drawer cash for the whole collection, then shared across the invoices it settled.
    const bucketSession = session || { secondary_currency: null };
    const whole = isCash
      ? cashBucketsForLine(bucketSession, { amountDue: payAmount, tender })
      : { cashPrimary: 0, cashSecondary: 0, tenderedPrimary: 0, tenderedSecondary: 0, changePrimary: 0, changeSecondary: 0 };
    const bucketKeys = Object.keys(whole);
    const remaining = { ...whole };

    for (let idx = 0; idx < allocations.length; idx++) {
      const alloc = allocations[idx];
      const isLast = idx === allocations.length - 1;
      const share = {};
      for (const key of bucketKeys) {
        share[key] = isLast ? round2(remaining[key]) : round2((whole[key] * alloc.amount) / payAmount);
        remaining[key] = round2(remaining[key] - share[key]);
      }

      await conn.query(
        `INSERT INTO register_payments
          (tenant_id, session_id, register_id, source, invoice_id, credit_payment_id, payment_type_id, payment_type_title,
           is_cash, amount, tip_amount, cash_primary, cash_secondary, tendered_primary, tendered_secondary, change_primary, change_secondary,
           reference, created_by)
         VALUES (?, ?, ?, 'DUE_PAYMENT', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId, session?.id || null, session?.register_id || null, alloc.invoiceId, creditPaymentId,
          Number(type.id), type.title, isCash ? 1 : 0, alloc.amount,
          share.cashPrimary, share.cashSecondary, share.tenderedPrimary, share.tenderedSecondary, share.changePrimary, share.changeSecondary,
          reference ? String(reference).slice(0, 255) : null, username,
        ]
      );

      const settled = alloc.balanceAfter <= 0;
      await conn.query(
        `UPDATE invoices
         SET balance_due = ?, payment_status = ?, paid_off_at = ${settled ? "NOW()" : "paid_off_at"}
         WHERE id = ? AND tenant_id = ?`,
        [Math.max(0, alloc.balanceAfter), settled ? "paid" : "partial", alloc.invoiceId, tenantId]
      );
      await conn.query(
        `INSERT INTO invoice_audit_log
         (tenant_id, invoice_id, invoice_number, action, performed_by, reason, previous_status, new_status)
         VALUES (?, ?, ?, 'DUE_PAYMENT', ?, ?, ?, ?)`,
        [
          tenantId, alloc.invoiceId, alloc.invoiceId, username,
          `Collected ${alloc.amount.toFixed(2)} by ${type.title}${reference ? ` (ref ${String(reference).slice(0, 100)})` : ""}; balance ${Math.max(0, alloc.balanceAfter).toFixed(2)}`,
          "OWED", settled ? "PAID" : "PARTIAL",
        ]
      );
    }

    if (session) {
      await writeAuditTx(conn, {
        tenantId,
        registerId: session.register_id,
        sessionId: session.id,
        action: "DUE_PAYMENT",
        details: { customerPhone: phone, amount: payAmount, paymentTypeId: Number(type.id), creditPaymentId, invoices: allocations.map((a) => a.invoiceId) },
        performedBy: username,
      });
    }

    const { outstanding: balanceAfter } = await getOutstandingTx(conn, tenantId, phone);
    await conn.commit();

    return {
      id: creditPaymentId,
      customer: { phone, name: customer.name },
      amount: payAmount,
      payment_type_title: type.title,
      allocations,
      balance_after: balanceAfter,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Forgive what is left on one invoice (bad debt, goodwill). No money moves;
 * the sale stays in the books and the written-off amount is reported apart.
 */
exports.writeOffInvoiceBalanceDB = async (tenantId, phone, invoiceId, { reason, username }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT id, balance_due, written_off_amount FROM invoices
       WHERE id = ? AND tenant_id = ? AND customer_phone = ? AND ${OPEN_BALANCE_SQL}
       FOR UPDATE`,
      [invoiceId, tenantId, phone]
    );
    const invoice = rows[0];
    if (!invoice) throw creditError("NOTHING_OWED", "credit_nothing_to_write_off", {}, "This bill has no balance to write off");
    const amount = round2(invoice.balance_due);

    await conn.query(
      `UPDATE invoices
       SET written_off_amount = written_off_amount + ?, balance_due = 0, payment_status = 'paid', paid_off_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [amount, invoiceId, tenantId]
    );
    await conn.query(
      `INSERT INTO invoice_audit_log
       (tenant_id, invoice_id, invoice_number, action, performed_by, reason, previous_status, new_status)
       VALUES (?, ?, ?, 'WRITE_OFF', ?, ?, 'OWED', 'WRITTEN_OFF')`,
      [tenantId, invoiceId, invoiceId, username, `Wrote off ${amount.toFixed(2)}: ${String(reason).slice(0, 400)}`]
    );
    await conn.commit();
    return { invoiceId: Number(invoiceId), amount };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

/** NULL clears the limit (no limit); 0 blocks pay-later for this customer. */
exports.setCustomerCreditLimitDB = async (tenantId, phone, creditLimit) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const value = creditLimit === null || creditLimit === undefined || creditLimit === "" ? null : round2(creditLimit);
    if (value !== null && value < 0) throw creditError("INVALID_CREDIT_LIMIT", "credit_invalid_limit", {}, "Credit limit cannot be negative");
    const [result] = await conn.query(
      `UPDATE customers SET credit_limit = ? WHERE phone = ? AND tenant_id = ?`,
      [value, phone, tenantId]
    );
    if (!result.affectedRows) throw creditError("CUSTOMER_NOT_FOUND", "credit_customer_not_found", {}, "Customer not found");
    return { phone, credit_limit: value };
  } finally {
    conn.release();
  }
};
