/**
 * Migration: Pay Later (customer credit / house accounts).
 *
 * Model:
 *  - A "Pay Later" bill is a normal completed invoice (the sale counts, the
 *    order completes, the table frees). What differs is that part or all of
 *    the total is still owed: `invoices.balance_due` > 0 and
 *    `invoices.payment_status` is 'unpaid' or 'partial'.
 *  - Nothing enters the drawer for the owed part at sale time. When the
 *    customer pays later, the money is written to `register_payments` with
 *    source 'DUE_PAYMENT' in whatever register session takes it, so the
 *    drawer that receives the cash is the one that has to account for it.
 *  - `invoices.credit_amount` keeps the amount originally put on account so
 *    reports can show "credit issued" vs "collected" without re-deriving it.
 *  - A manager can write off a debt: `written_off_amount` records it and the
 *    balance goes to zero, without any money moving.
 *
 * Idempotent: safe to run on every startup.
 */
exports.ensureCustomerCreditSchema = async (pool) => {
  const conn = await pool.getConnection();
  try {
    const hasColumn = async (tableName, columnName) => {
      const [rows] = await conn.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [tableName, columnName]
      );
      return rows.length > 0;
    };
    const hasIndex = async (tableName, indexName) => {
      const [rows] = await conn.query(
        `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [tableName, indexName]
      );
      return rows.length > 0;
    };

    const invoiceColumns = [
      ["payment_status", "ENUM('paid', 'partial', 'unpaid') NOT NULL DEFAULT 'paid'"],
      ["balance_due", "DECIMAL(14, 2) NOT NULL DEFAULT 0"],
      ["credit_amount", "DECIMAL(14, 2) NOT NULL DEFAULT 0"],
      ["written_off_amount", "DECIMAL(14, 2) NOT NULL DEFAULT 0"],
      ["due_date", "DATE NULL"],
      ["credit_note", "VARCHAR(255) NULL"],
      ["paid_off_at", "DATETIME NULL"],
    ];
    for (const [name, definition] of invoiceColumns) {
      if (!(await hasColumn("invoices", name))) {
        await conn.query(`ALTER TABLE invoices ADD COLUMN ${name} ${definition}`);
        console.log(`[Migration] Added ${name} to invoices`);
      }
    }
    if (!(await hasIndex("invoices", "invoices_credit_balance_idx"))) {
      await conn.query(`ALTER TABLE invoices ADD KEY invoices_credit_balance_idx (tenant_id, payment_status, customer_phone)`);
      console.log("[Migration] Added invoices_credit_balance_idx");
    }

    // NULL = no limit; 0 = this customer may not buy on account.
    if (!(await hasColumn("customers", "credit_limit"))) {
      await conn.query(`ALTER TABLE customers ADD COLUMN credit_limit DECIMAL(14, 2) NULL DEFAULT NULL`);
      console.log("[Migration] Added credit_limit to customers");
    }

    // Collections of an outstanding balance go into the drawer ledger.
    const [sourceRows] = await conn.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'register_payments' AND COLUMN_NAME = 'source'`
    );
    const sourceType = sourceRows[0]?.COLUMN_TYPE || "";
    if (sourceType.startsWith("enum(") && !sourceType.includes("'DUE_PAYMENT'")) {
      const values = sourceType.slice(5, -1);
      await conn.query(`ALTER TABLE register_payments MODIFY COLUMN source ENUM(${values}, 'DUE_PAYMENT') NOT NULL`);
      console.log("[Migration] Added DUE_PAYMENT to register_payments.source");
    }

    // One row per collection ("customer paid $40 towards their account"). The
    // money itself is in register_payments, one row per invoice it settled,
    // linked back here by credit_payment_id.
    await conn.query(`
      CREATE TABLE IF NOT EXISTS customer_credit_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        customer_phone VARCHAR(20) NOT NULL,
        amount DECIMAL(14, 2) NOT NULL,
        payment_type_id INT NULL,
        payment_type_title VARCHAR(255) NULL,
        session_id INT NULL,
        reference VARCHAR(255) NULL,
        note VARCHAR(500) NULL,
        allocations JSON NULL,
        created_by VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_credit_payments_customer (tenant_id, customer_phone, created_at),
        KEY idx_credit_payments_session (tenant_id, session_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    if (!(await hasColumn("register_payments", "credit_payment_id"))) {
      await conn.query(`ALTER TABLE register_payments ADD COLUMN credit_payment_id INT NULL`);
      console.log("[Migration] Added credit_payment_id to register_payments");
    }

    // Pay-later events share the invoice audit trail.
    const [auditRows] = await conn.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoice_audit_log' AND COLUMN_NAME = 'action'`
    );
    const auditType = auditRows[0]?.COLUMN_TYPE || "";
    if (auditType.startsWith("enum(")) {
      const missing = ["PAY_LATER", "DUE_PAYMENT", "WRITE_OFF"].filter((v) => !auditType.includes(`'${v}'`));
      if (missing.length) {
        const values = auditType.slice(5, -1);
        await conn.query(
          `ALTER TABLE invoice_audit_log MODIFY COLUMN action ENUM(${values}, ${missing.map((v) => `'${v}'`).join(", ")}) NOT NULL`
        );
        console.log(`[Migration] Added ${missing.join(", ")} to invoice_audit_log.action`);
      }
    }

    console.log("[Migration] Customer credit (pay later) schema verified");
  } finally {
    conn.release();
  }
};
