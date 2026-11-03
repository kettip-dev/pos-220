/**
 * Migration: Cash register sessions, drawer accounting, refunds and business days.
 *
 * Model:
 *  - `registers` are physical tills. One OPEN `register_sessions` row per register.
 *  - Every tender line is written to `register_payments` (the drawer ledger), stamped
 *    with the session that took it. Voids/refunds are written as negative rows into
 *    the session that paid the money back, never into the (possibly closed) original.
 *  - Drawer cash is tracked per currency: `primary` is the store currency, `secondary`
 *    is the other half of the USD/KHR pair (NULL for any other store currency).
 *  - `business_days` group sessions into a trading day that is independent of the
 *    calendar date, so a bar closing at 2am still reports into the previous day.
 *
 * Idempotent: safe to run on every startup.
 */
exports.ensureRegisterSchema = async (pool) => {
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

    await conn.query(`
      CREATE TABLE IF NOT EXISTS registers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        printer_id INT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_registers_tenant_name (tenant_id, name),
        KEY idx_registers_tenant (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS register_settings (
        tenant_id INT NOT NULL PRIMARY KEY,
        enforce_session TINYINT(1) NOT NULL DEFAULT 1,
        blind_close TINYINT(1) NOT NULL DEFAULT 1,
        variance_threshold DECIMAL(12, 2) NOT NULL DEFAULT 1.00,
        cash_drop_threshold DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        refund_pin_threshold DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        handover_mode ENUM('shared', 'strict') NOT NULL DEFAULT 'shared',
        day_cutoff_hour TINYINT NOT NULL DEFAULT 4,
        last_z_number INT NOT NULL DEFAULT 0,
        last_refund_no INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS business_days (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        business_date DATE NOT NULL,
        status ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
        opened_by VARCHAR(255) NULL,
        opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        closed_by VARCHAR(255) NULL,
        closed_at DATETIME NULL,
        summary JSON NULL,
        UNIQUE KEY uq_business_days_tenant_date (tenant_id, business_date),
        KEY idx_business_days_tenant_status (tenant_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS register_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        register_id INT NOT NULL,
        business_day_id INT NULL,
        z_number INT NULL,
        status ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
        primary_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        secondary_currency VARCHAR(10) NULL,
        exchange_rate DECIMAL(12, 4) NOT NULL DEFAULT 4100,
        opened_by VARCHAR(255) NULL,
        opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        current_cashier VARCHAR(255) NULL,
        opening_float_primary DECIMAL(14, 2) NOT NULL DEFAULT 0,
        opening_float_secondary DECIMAL(14, 2) NOT NULL DEFAULT 0,
        closed_by VARCHAR(255) NULL,
        closed_at DATETIME NULL,
        expected_primary DECIMAL(14, 2) NULL,
        expected_secondary DECIMAL(14, 2) NULL,
        counted_primary DECIMAL(14, 2) NULL,
        counted_secondary DECIMAL(14, 2) NULL,
        variance_primary DECIMAL(14, 2) NULL,
        variance_secondary DECIMAL(14, 2) NULL,
        variance_base DECIMAL(14, 2) NULL,
        variance_approved_by VARCHAR(255) NULL,
        closing_note VARCHAR(500) NULL,
        summary JSON NULL,
        KEY idx_register_sessions_tenant_status (tenant_id, status),
        KEY idx_register_sessions_register (tenant_id, register_id),
        KEY idx_register_sessions_day (tenant_id, business_day_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS register_cash_movements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        session_id INT NOT NULL,
        type ENUM('PAY_IN', 'PAY_OUT', 'DROP', 'NO_SALE', 'TIP_PAYOUT') NOT NULL,
        amount_primary DECIMAL(14, 2) NOT NULL DEFAULT 0,
        amount_secondary DECIMAL(14, 2) NOT NULL DEFAULT 0,
        reason VARCHAR(500) NULL,
        staff_username VARCHAR(255) NULL,
        created_by VARCHAR(255) NULL,
        approved_by VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_register_cash_movements_session (tenant_id, session_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS register_denomination_counts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        session_id INT NOT NULL,
        stage ENUM('OPEN', 'CLOSE') NOT NULL,
        currency VARCHAR(10) NOT NULL,
        denomination DECIMAL(12, 2) NOT NULL,
        quantity INT NOT NULL DEFAULT 0,
        KEY idx_register_denoms_session (tenant_id, session_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS register_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        session_id INT NULL,
        register_id INT NULL,
        source ENUM('SALE', 'SUB_INVOICE', 'VOID', 'REFUND') NOT NULL,
        invoice_id INT NULL,
        sub_invoice_id INT NULL,
        refund_id INT NULL,
        order_id INT NULL,
        payment_type_id INT NULL,
        payment_type_title VARCHAR(255) NULL,
        is_cash TINYINT(1) NOT NULL DEFAULT 0,
        amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
        tip_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
        cash_primary DECIMAL(14, 2) NOT NULL DEFAULT 0,
        cash_secondary DECIMAL(14, 2) NOT NULL DEFAULT 0,
        tendered_primary DECIMAL(14, 2) NOT NULL DEFAULT 0,
        tendered_secondary DECIMAL(14, 2) NOT NULL DEFAULT 0,
        change_primary DECIMAL(14, 2) NOT NULL DEFAULT 0,
        change_secondary DECIMAL(14, 2) NOT NULL DEFAULT 0,
        reference VARCHAR(255) NULL,
        server_username VARCHAR(255) NULL,
        created_by VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_register_payments_session (tenant_id, session_id),
        KEY idx_register_payments_invoice (tenant_id, invoice_id),
        KEY idx_register_payments_created (tenant_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS invoice_refunds (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        refund_no INT NOT NULL,
        invoice_id INT NOT NULL,
        session_id INT NULL,
        refund_type ENUM('FULL', 'PARTIAL', 'ITEMS') NOT NULL,
        amount DECIMAL(14, 2) NOT NULL,
        reason_code VARCHAR(50) NOT NULL,
        reason VARCHAR(500) NULL,
        payment_type_id INT NULL,
        payment_type_title VARCHAR(255) NULL,
        is_cash TINYINT(1) NOT NULL DEFAULT 0,
        items JSON NULL,
        created_by VARCHAR(255) NULL,
        approved_by VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_invoice_refunds_no (tenant_id, refund_no),
        KEY idx_invoice_refunds_invoice (tenant_id, invoice_id),
        KEY idx_invoice_refunds_session (tenant_id, session_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS register_audit_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        register_id INT NULL,
        session_id INT NULL,
        action VARCHAR(50) NOT NULL,
        details JSON NULL,
        performed_by VARCHAR(255) NULL,
        approved_by VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_register_audit_tenant (tenant_id, created_at),
        KEY idx_register_audit_session (tenant_id, session_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    if (!(await hasColumn("invoices", "register_session_id"))) {
      await conn.query(`ALTER TABLE invoices ADD COLUMN register_session_id INT NULL, ADD KEY invoices_register_session_idx (tenant_id, register_session_id)`);
      console.log("[Migration] Added register_session_id to invoices");
    }

    if (!(await hasColumn("invoices", "refunded_total"))) {
      await conn.query(`ALTER TABLE invoices ADD COLUMN refunded_total DECIMAL(14, 2) NOT NULL DEFAULT 0`);
      console.log("[Migration] Added refunded_total to invoices");
    }

    if (!(await hasColumn("order_sub_invoices", "register_session_id")) && (await hasColumn("order_sub_invoices", "id"))) {
      await conn.query(`ALTER TABLE order_sub_invoices ADD COLUMN register_session_id INT NULL`);
      console.log("[Migration] Added register_session_id to order_sub_invoices");
    }

    // Refunds share the invoice audit trail with voids.
    const [auditActionRows] = await conn.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoice_audit_log' AND COLUMN_NAME = 'action'`
    );
    const auditActionType = auditActionRows[0]?.COLUMN_TYPE || "";
    if (auditActionType.startsWith("enum(") && !auditActionType.includes("'REFUND'")) {
      const values = auditActionType.slice(5, -1);
      await conn.query(`ALTER TABLE invoice_audit_log MODIFY COLUMN action ENUM(${values}, 'REFUND') NOT NULL`);
      console.log("[Migration] Added REFUND to invoice_audit_log.action");
    }

    // Cash detection used to be a title substring match scattered across the UI.
    // Backfill once from the same heuristic, then it is an explicit setting.
    if (!(await hasColumn("payment_types", "is_cash"))) {
      await conn.query(`ALTER TABLE payment_types ADD COLUMN is_cash TINYINT(1) NOT NULL DEFAULT 0`);
      await conn.query(`
        UPDATE payment_types
        SET is_cash = 1
        WHERE icon = 'cash' OR LOWER(title) LIKE '%cash%' OR title LIKE '%សាច់ប្រាក់%'
      `);
      console.log("[Migration] Added is_cash to payment_types");
    }

    // authorize() checks the plan's feature list before the user's scopes, so a new
    // scope is unusable (even by admins) until the plan carries it. These are
    // sub-permissions of POS, so every plan that sells POS gets them.
    for (const scope of ["REGISTER_MANAGE", "REFUND_INVOICES"]) {
      await conn.query(
        `UPDATE plans
         SET features = JSON_ARRAY_APPEND(features, '$', ?)
         WHERE JSON_VALID(features) AND JSON_CONTAINS(features, '"POS"') AND NOT JSON_CONTAINS(features, JSON_QUOTE(?))`,
        [scope, scope]
      );
    }

    console.log("[Migration] Register schema verified");
  } finally {
    conn.release();
  }
};
