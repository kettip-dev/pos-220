const { getMySqlPromiseConnection } = require("../config/mysql.db");

/**
 * Cash register sessions & drawer accounting.
 *
 * Drawer cash is tracked in two buckets: `primary` (the store currency) and
 * `secondary` (the other half of the USD/KHR pair, or nothing). Every figure
 * the Z-report shows is derived from `register_payments` (the tender ledger)
 * and `register_cash_movements`, so the report can always be rebuilt.
 */

const DEFAULT_RATE = 4100;
const MOVEMENT_SIGN = { PAY_IN: 1, PAY_OUT: -1, DROP: -1, TIP_PAYOUT: -1, NO_SALE: 0 };

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

const registerError = (code, message, extra = {}) => Object.assign(new Error(message || code), { code, isRegisterError: true, ...extra });
exports.registerError = registerError;

/** The cash pair a store's drawer holds. Only USD/KHR stores carry a second currency. */
const currencyPair = (storeCurrency) => {
  const primary = String(storeCurrency || "USD").toUpperCase();
  if (primary === "USD") return { primary, secondary: "KHR" };
  if (primary === "KHR") return { primary, secondary: "USD" };
  return { primary, secondary: null };
};
exports.currencyPair = currencyPair;

/** Secondary-currency amount expressed in the primary currency. `rate` is always 1 USD = rate KHR. */
const secondaryToPrimary = (session, amount) => {
  const rate = Number(session.exchange_rate) || DEFAULT_RATE;
  if (!session.secondary_currency) return 0;
  return session.primary_currency === "USD" ? Number(amount || 0) / rate : Number(amount || 0) * rate;
};

const toBase = (session, primary, secondary) => round2(Number(primary || 0) + secondaryToPrimary(session, secondary));
exports.toBase = toBase;

const writeAuditTx = (conn, { tenantId, registerId = null, sessionId = null, action, details = null, performedBy = null, approvedBy = null }) =>
  conn.query(
    `INSERT INTO register_audit_log (tenant_id, register_id, session_id, action, details, performed_by, approved_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, registerId, sessionId, action, details ? JSON.stringify(details) : null, performedBy, approvedBy]
  );
exports.writeAuditTx = writeAuditTx;

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

const SETTINGS_FIELDS = [
  "enforce_session",
  "blind_close",
  "variance_threshold",
  "cash_drop_threshold",
  "refund_pin_threshold",
  "handover_mode",
  "day_cutoff_hour",
];

const getSettingsTx = async (conn, tenantId, { forUpdate = false } = {}) => {
  await conn.query(`INSERT IGNORE INTO register_settings (tenant_id) VALUES (?)`, [tenantId]);
  const [rows] = await conn.query(
    `SELECT * FROM register_settings WHERE tenant_id = ? LIMIT 1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [tenantId]
  );
  return rows[0];
};

exports.getRegisterSettingsDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    return await getSettingsTx(conn, tenantId);
  } finally {
    conn.release();
  }
};

exports.updateRegisterSettingsDB = async (tenantId, input = {}) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await getSettingsTx(conn, tenantId);
    const sets = [];
    const params = [];
    for (const field of SETTINGS_FIELDS) {
      if (input[field] === undefined) continue;
      let value = input[field];
      if (field === "enforce_session" || field === "blind_close") value = value ? 1 : 0;
      else if (field === "handover_mode") value = value === "strict" ? "strict" : "shared";
      else if (field === "day_cutoff_hour") value = Math.min(Math.max(parseInt(value, 10) || 0, 0), 12);
      else value = Math.max(0, Number(value) || 0);
      sets.push(`${field} = ?`);
      params.push(value);
    }
    if (sets.length > 0) {
      await conn.query(`UPDATE register_settings SET ${sets.join(", ")} WHERE tenant_id = ?`, [...params, tenantId]);
    }
    return await getSettingsTx(conn, tenantId);
  } finally {
    conn.release();
  }
};

/** Which payment methods put physical cash in the drawer. */
exports.setPaymentTypeCashDB = async (tenantId, paymentTypeId, isCash) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.query(`UPDATE payment_types SET is_cash = ? WHERE id = ? AND tenant_id = ?`, [isCash ? 1 : 0, paymentTypeId, tenantId]);
  } finally {
    conn.release();
  }
};

/* -------------------------------------------------------------------------- */
/* Registers (tills)                                                          */
/* -------------------------------------------------------------------------- */

exports.getRegistersDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT r.id, r.name, r.printer_id, r.is_active, r.created_at,
              s.id AS open_session_id, s.opened_by, s.opened_at, s.current_cashier
       FROM registers r
       LEFT JOIN register_sessions s
         ON s.register_id = r.id AND s.tenant_id = r.tenant_id AND s.status = 'OPEN'
       WHERE r.tenant_id = ?
       ORDER BY r.is_active DESC, r.name ASC`,
      [tenantId]
    );
    return rows;
  } finally {
    conn.release();
  }
};

exports.addRegisterDB = async (tenantId, { name, printerId = null }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [result] = await conn.query(
      `INSERT INTO registers (tenant_id, name, printer_id) VALUES (?, ?, ?)`,
      [tenantId, String(name).trim(), printerId || null]
    );
    return result.insertId;
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") throw registerError("REGISTER_NAME_TAKEN", "A register with this name already exists");
    throw error;
  } finally {
    conn.release();
  }
};

exports.updateRegisterDB = async (tenantId, registerId, { name, printerId = null, isActive = true }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    if (!isActive) {
      const [open] = await conn.query(
        `SELECT id FROM register_sessions WHERE tenant_id = ? AND register_id = ? AND status = 'OPEN' LIMIT 1`,
        [tenantId, registerId]
      );
      if (open.length) throw registerError("REGISTER_HAS_OPEN_SESSION", "Close this register before deactivating it");
    }
    await conn.query(
      `UPDATE registers SET name = ?, printer_id = ?, is_active = ? WHERE id = ? AND tenant_id = ?`,
      [String(name).trim(), printerId || null, isActive ? 1 : 0, registerId, tenantId]
    );
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") throw registerError("REGISTER_NAME_TAKEN", "A register with this name already exists");
    throw error;
  } finally {
    conn.release();
  }
};

exports.deleteRegisterDB = async (tenantId, registerId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [used] = await conn.query(
      `SELECT id FROM register_sessions WHERE tenant_id = ? AND register_id = ? LIMIT 1`,
      [tenantId, registerId]
    );
    // History references the register, so a used till is deactivated instead of deleted.
    if (used.length) throw registerError("REGISTER_HAS_HISTORY", "This register has session history; deactivate it instead");
    await conn.query(`DELETE FROM registers WHERE id = ? AND tenant_id = ?`, [registerId, tenantId]);
  } finally {
    conn.release();
  }
};

/* -------------------------------------------------------------------------- */
/* Business day                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The OPEN business day, opening one if needed. The date is the calendar date
 * shifted back by the cutoff hour, so trading after midnight stays in the
 * previous day. If that date was already closed (closed early, then reopened
 * for a late sale) the new day takes the next free date.
 */
const getOrOpenBusinessDayTx = async (conn, tenantId, username, cutoffHour) => {
  const [open] = await conn.query(
    `SELECT * FROM business_days WHERE tenant_id = ? AND status = 'OPEN' ORDER BY business_date DESC LIMIT 1 FOR UPDATE`,
    [tenantId]
  );
  if (open.length) return open[0];

  const [[{ candidate }]] = await conn.query(
    `SELECT DATE_FORMAT(DATE(NOW() - INTERVAL ? HOUR), '%Y-%m-%d') AS candidate`,
    [Number(cutoffHour) || 0]
  );
  const [[{ last_closed: lastClosed }]] = await conn.query(
    `SELECT DATE_FORMAT(MAX(business_date), '%Y-%m-%d') AS last_closed FROM business_days WHERE tenant_id = ?`,
    [tenantId]
  );

  let businessDate = candidate;
  if (lastClosed && lastClosed >= candidate) {
    const [[{ next_date: nextDate }]] = await conn.query(
      `SELECT DATE_FORMAT(DATE_ADD(?, INTERVAL 1 DAY), '%Y-%m-%d') AS next_date`,
      [lastClosed]
    );
    businessDate = nextDate;
  }

  const [result] = await conn.query(
    `INSERT INTO business_days (tenant_id, business_date, status, opened_by) VALUES (?, ?, 'OPEN', ?)`,
    [tenantId, businessDate, username]
  );
  await writeAuditTx(conn, { tenantId, action: "DAY_OPEN", details: { businessDate }, performedBy: username });
  const [rows] = await conn.query(`SELECT * FROM business_days WHERE id = ? AND tenant_id = ?`, [result.insertId, tenantId]);
  return rows[0];
};

exports.getCurrentBusinessDayDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT id, DATE_FORMAT(business_date, '%Y-%m-%d') AS business_date, status, opened_by, opened_at
       FROM business_days WHERE tenant_id = ? AND status = 'OPEN' ORDER BY business_date DESC LIMIT 1`,
      [tenantId]
    );
    return rows[0] || null;
  } finally {
    conn.release();
  }
};

/* -------------------------------------------------------------------------- */
/* Sessions                                                                   */
/* -------------------------------------------------------------------------- */

const SESSION_SELECT = `
  SELECT s.*, r.name AS register_name, r.printer_id,
         DATE_FORMAT(bd.business_date, '%Y-%m-%d') AS business_date
  FROM register_sessions s
  JOIN registers r ON r.id = s.register_id AND r.tenant_id = s.tenant_id
  LEFT JOIN business_days bd ON bd.id = s.business_day_id AND bd.tenant_id = s.tenant_id
`;

const getSessionTx = async (conn, tenantId, sessionId) => {
  const [rows] = await conn.query(`${SESSION_SELECT} WHERE s.id = ? AND s.tenant_id = ? LIMIT 1`, [sessionId, tenantId]);
  return rows[0] || null;
};

exports.getSessionDB = async (tenantId, sessionId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    return await getSessionTx(conn, tenantId, sessionId);
  } finally {
    conn.release();
  }
};

exports.getOpenSessionsDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(`${SESSION_SELECT} WHERE s.tenant_id = ? AND s.status = 'OPEN' ORDER BY r.name`, [tenantId]);
    return rows;
  } finally {
    conn.release();
  }
};

/**
 * Which open session a payment belongs to:
 *  1. the register this terminal is bound to (X-Register-Id), if it is open;
 *  2. otherwise the open session this user is the cashier on;
 *  3. otherwise the only open session in the business (single-till shops,
 *     or a waiter settling on a handheld that is not bound to a till).
 * Returns null when it cannot be decided.
 */
exports.resolveSessionForRequestDB = async (tenantId, registerId, username) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [open] = await conn.query(`${SESSION_SELECT} WHERE s.tenant_id = ? AND s.status = 'OPEN'`, [tenantId]);
    if (!open.length) return null;
    if (registerId) {
      const bound = open.find((s) => Number(s.register_id) === Number(registerId));
      if (bound) return bound;
    }
    const mine = open.filter((s) => s.current_cashier === username);
    if (mine.length === 1) return mine[0];
    if (open.length === 1) return open[0];
    return null;
  } finally {
    conn.release();
  }
};

const insertDenominationsTx = async (conn, tenantId, sessionId, stage, denominations = []) => {
  const rows = (Array.isArray(denominations) ? denominations : [])
    .map((d) => [tenantId, sessionId, stage, String(d.currency || "").toUpperCase().slice(0, 10), Number(d.denomination), parseInt(d.quantity, 10) || 0])
    .filter((r) => r[3] && r[4] > 0 && r[5] > 0);
  if (!rows.length) return;
  await conn.query(
    `INSERT INTO register_denomination_counts (tenant_id, session_id, stage, currency, denomination, quantity) VALUES ?`,
    [rows]
  );
};

exports.openSessionDB = async (tenantId, { registerId, username, floatPrimary = 0, floatSecondary = 0, denominations = [], exchangeRate = null }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    // Locking the register row serialises concurrent "open" taps on two devices.
    const [registerRows] = await conn.query(
      `SELECT * FROM registers WHERE id = ? AND tenant_id = ? FOR UPDATE`,
      [registerId, tenantId]
    );
    const register = registerRows[0];
    if (!register) throw registerError("REGISTER_NOT_FOUND", "Register not found");
    if (!register.is_active) throw registerError("REGISTER_INACTIVE", "This register is deactivated");

    const [already] = await conn.query(
      `SELECT id FROM register_sessions WHERE tenant_id = ? AND register_id = ? AND status = 'OPEN' LIMIT 1`,
      [tenantId, registerId]
    );
    if (already.length) throw registerError("REGISTER_ALREADY_OPEN", "This register is already open", { sessionId: already[0].id });

    const settings = await getSettingsTx(conn, tenantId);
    const [storeRows] = await conn.query(
      `SELECT currency, exchange_rate_usd_to_khr FROM store_details WHERE tenant_id = ? LIMIT 1`,
      [tenantId]
    );
    const { primary, secondary } = currencyPair(storeRows[0]?.currency);
    const rate = Number(exchangeRate) || Number(storeRows[0]?.exchange_rate_usd_to_khr) || DEFAULT_RATE;

    const day = await getOrOpenBusinessDayTx(conn, tenantId, username, settings.day_cutoff_hour);

    const [result] = await conn.query(
      `INSERT INTO register_sessions
        (tenant_id, register_id, business_day_id, status, primary_currency, secondary_currency, exchange_rate,
         opened_by, current_cashier, opening_float_primary, opening_float_secondary)
       VALUES (?, ?, ?, 'OPEN', ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, registerId, day.id, primary, secondary, rate, username, username, round2(floatPrimary), secondary ? round2(floatSecondary) : 0]
    );
    const sessionId = result.insertId;

    await insertDenominationsTx(conn, tenantId, sessionId, "OPEN", denominations);

    // The float handed over should match what the last close counted; flag it if not.
    const [prev] = await conn.query(
      `SELECT counted_primary, counted_secondary FROM register_sessions
       WHERE tenant_id = ? AND register_id = ? AND status = 'CLOSED' AND id <> ?
       ORDER BY closed_at DESC LIMIT 1`,
      [tenantId, registerId, sessionId]
    );

    await writeAuditTx(conn, {
      tenantId,
      registerId,
      sessionId,
      action: "SESSION_OPEN",
      details: {
        floatPrimary: round2(floatPrimary),
        floatSecondary: round2(floatSecondary),
        previousCountedPrimary: prev[0]?.counted_primary ?? null,
        previousCountedSecondary: prev[0]?.counted_secondary ?? null,
      },
      performedBy: username,
    });

    await conn.commit();
    return await exports.getSessionDB(tenantId, sessionId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

/** Suggested opening float for a register: what the previous close counted. */
exports.getSuggestedFloatDB = async (tenantId, registerId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT counted_primary, counted_secondary, closed_at, closed_by FROM register_sessions
       WHERE tenant_id = ? AND register_id = ? AND status = 'CLOSED'
       ORDER BY closed_at DESC LIMIT 1`,
      [tenantId, registerId]
    );
    return rows[0] || null;
  } finally {
    conn.release();
  }
};

exports.handoverSessionDB = async (tenantId, sessionId, { fromUser, toUser }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT id, register_id, status, current_cashier FROM register_sessions WHERE id = ? AND tenant_id = ? FOR UPDATE`,
      [sessionId, tenantId]
    );
    const session = rows[0];
    if (!session) throw registerError("SESSION_NOT_FOUND", "Session not found");
    if (session.status !== "OPEN") throw registerError("SESSION_CLOSED", "This register session is closed");

    const [users] = await conn.query(`SELECT username FROM users WHERE username = ? AND tenant_id = ? LIMIT 1`, [toUser, tenantId]);
    if (!users.length) throw registerError("USER_NOT_FOUND", "Staff member not found");

    await conn.query(`UPDATE register_sessions SET current_cashier = ? WHERE id = ? AND tenant_id = ?`, [toUser, sessionId, tenantId]);
    await writeAuditTx(conn, {
      tenantId,
      registerId: session.register_id,
      sessionId,
      action: "SESSION_HANDOVER",
      details: { from: session.current_cashier, to: toUser },
      performedBy: fromUser,
    });
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

/* -------------------------------------------------------------------------- */
/* Cash movements                                                             */
/* -------------------------------------------------------------------------- */

exports.addCashMovementDB = async (tenantId, sessionId, { type, amountPrimary = 0, amountSecondary = 0, reason = null, staffUsername = null, username, approvedBy = null }) => {
  if (!(type in MOVEMENT_SIGN)) throw registerError("INVALID_MOVEMENT", "Unknown cash movement type");
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT id, register_id, status, secondary_currency FROM register_sessions WHERE id = ? AND tenant_id = ? FOR UPDATE`,
      [sessionId, tenantId]
    );
    const session = rows[0];
    if (!session) throw registerError("SESSION_NOT_FOUND", "Session not found");
    if (session.status !== "OPEN") throw registerError("SESSION_CLOSED", "This register session is closed");

    const primary = type === "NO_SALE" ? 0 : Math.abs(round2(amountPrimary));
    const secondary = type === "NO_SALE" || !session.secondary_currency ? 0 : Math.abs(round2(amountSecondary));
    if (type !== "NO_SALE" && primary === 0 && secondary === 0) throw registerError("AMOUNT_REQUIRED", "Enter an amount");

    const [result] = await conn.query(
      `INSERT INTO register_cash_movements
        (tenant_id, session_id, type, amount_primary, amount_secondary, reason, staff_username, created_by, approved_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, sessionId, type, primary, secondary, reason, staffUsername, username, approvedBy]
    );
    await writeAuditTx(conn, {
      tenantId,
      registerId: session.register_id,
      sessionId,
      action: type,
      details: { amountPrimary: primary, amountSecondary: secondary, reason, staffUsername },
      performedBy: username,
      approvedBy,
    });
    await conn.commit();
    return result.insertId;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

/* -------------------------------------------------------------------------- */
/* Tender ledger                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Physical cash a tender line put into the drawer, per currency.
 * Uses the cashier's tendered/change figures when they reconcile with the
 * amount due (within change-rounding tolerance); otherwise assumes exact
 * payment in the store currency, so a bad client payload can never invent
 * or lose drawer cash.
 */
const cashBucketsForLine = (session, { amountDue, tender }) => {
  const exact = { cashPrimary: round2(amountDue), cashSecondary: 0, tenderedPrimary: round2(amountDue), tenderedSecondary: 0, changePrimary: 0, changeSecondary: 0 };
  if (!tender || !session.secondary_currency) return exact;

  const usd = { tendered: Number(tender.tenderedUSD || 0), change: Number(tender.changeUSD || 0) };
  const khr = { tendered: Number(tender.tenderedKHR || 0), change: Number(tender.changeKHR || 0) };
  const [p, s] = session.primary_currency === "USD" ? [usd, khr] : [khr, usd];
  if (p.tendered < 0 || s.tendered < 0 || p.change < 0 || s.change < 0 || p.tendered + s.tendered <= 0) return exact;

  const netPrimary = round2(p.tendered - p.change);
  const netSecondary = round2(s.tendered - s.change);
  const netBase = netPrimary + secondaryToPrimary(session, netSecondary);
  const tolerance = Math.max(0.05, Math.abs(secondaryToPrimary(session, session.primary_currency === "USD" ? 250 : 0.1)));
  if (Math.abs(netBase - amountDue) > tolerance) return exact;

  return {
    cashPrimary: netPrimary,
    cashSecondary: netSecondary,
    tenderedPrimary: round2(p.tendered),
    tenderedSecondary: round2(s.tendered),
    changePrimary: round2(p.change),
    changeSecondary: round2(s.change),
  };
};

exports.cashBucketsForLine = cashBucketsForLine;

const getPaymentTypesMapTx = async (conn, tenantId, ids) => {
  const unique = [...new Set(ids.filter((id) => id !== null && id !== undefined && id !== "").map(Number))];
  if (!unique.length) return new Map();
  const [rows] = await conn.query(`SELECT id, title, is_cash FROM payment_types WHERE tenant_id = ? AND id IN (?)`, [tenantId, unique]);
  return new Map(rows.map((r) => [Number(r.id), r]));
};
exports.getPaymentTypesMapTx = getPaymentTypesMapTx;

/**
 * Normalise a request's tender lines against the server-verified total.
 * One line always takes the whole total; several lines must add up to it
 * (the last line absorbs sub-cent rounding).
 */
exports.normalisePaymentLines = (payments, fallbackPaymentTypeId, total) => {
  const totalDue = round2(total);
  const lines = (Array.isArray(payments) ? payments : [])
    .filter((l) => l && l.paymentTypeId !== undefined && l.paymentTypeId !== null && l.paymentTypeId !== "")
    .map((l) => ({ ...l, amount: round2(l.amount) }));

  if (lines.length <= 1) {
    const line = lines[0] || { paymentTypeId: fallbackPaymentTypeId };
    return [{ ...line, amount: totalDue }];
  }
  if (lines.some((l) => l.amount <= 0)) throw registerError("INVALID_SPLIT_TENDER", "Every split tender line needs an amount");
  const sum = round2(lines.reduce((acc, l) => acc + l.amount, 0));
  if (Math.abs(sum - totalDue) > 0.05) {
    throw registerError("SPLIT_TENDER_MISMATCH", `Split tender adds up to ${sum} but the bill is ${totalDue}`);
  }
  lines[lines.length - 1].amount = round2(lines[lines.length - 1].amount + (totalDue - sum));
  return lines;
};

/**
 * Write one bill's tender lines to the drawer ledger, inside the caller's
 * transaction. `session` may be null when sessions are not enforced; the rows
 * are still written so payment reports see every tender.
 */
exports.recordPaymentsTx = async (conn, { tenantId, session, source, invoiceId = null, subInvoiceId = null, orderId = null, lines, createdBy, serverUsername = null }) => {
  const types = await getPaymentTypesMapTx(conn, tenantId, lines.map((l) => l.paymentTypeId));
  const bucketSession = session || { secondary_currency: null };
  for (const line of lines) {
    const type = types.get(Number(line.paymentTypeId));
    const isCash = type ? Number(type.is_cash) === 1 : false;
    const tip = round2(line.tip || 0);
    const buckets = isCash
      ? cashBucketsForLine(bucketSession, { amountDue: round2(line.amount + tip), tender: line.tender })
      : { cashPrimary: 0, cashSecondary: 0, tenderedPrimary: 0, tenderedSecondary: 0, changePrimary: 0, changeSecondary: 0 };

    await conn.query(
      `INSERT INTO register_payments
        (tenant_id, session_id, register_id, source, invoice_id, sub_invoice_id, order_id, payment_type_id, payment_type_title,
         is_cash, amount, tip_amount, cash_primary, cash_secondary, tendered_primary, tendered_secondary, change_primary, change_secondary,
         reference, server_username, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        session?.id || null,
        session?.register_id || null,
        source,
        invoiceId,
        subInvoiceId,
        orderId,
        line.paymentTypeId ? Number(line.paymentTypeId) : null,
        type?.title || line.paymentTypeTitle || null,
        isCash ? 1 : 0,
        round2(line.amount),
        tip,
        buckets.cashPrimary,
        buckets.cashSecondary,
        buckets.tenderedPrimary,
        buckets.tenderedSecondary,
        buckets.changePrimary,
        buckets.changeSecondary,
        line.reference ? String(line.reference).slice(0, 255) : null,
        serverUsername,
        createdBy,
      ]
    );
  }
};

/**
 * Write a void/refund as negative ledger rows. Money goes back the way it came
 * in: each original tender line is reversed proportionally unless an explicit
 * payment type is given. Cash refunds always leave the drawer in the store
 * currency.
 */
exports.recordReversalTx = async (conn, { tenantId, session, source, invoiceId, refundId = null, amount, paymentTypeId = null, createdBy }) => {
  const total = round2(amount);
  if (total <= 0) return;

  let parts;
  if (paymentTypeId) {
    parts = [{ paymentTypeId: Number(paymentTypeId), amount: total }];
  } else {
    const [original] = await conn.query(
      `SELECT payment_type_id, SUM(amount) AS amount FROM register_payments
       WHERE tenant_id = ? AND invoice_id = ? AND source IN ('SALE', 'DUE_PAYMENT')
       GROUP BY payment_type_id`,
      [tenantId, invoiceId]
    );
    const paid = original.reduce((acc, r) => acc + Number(r.amount || 0), 0);
    if (!original.length || paid <= 0) {
      const [inv] = await conn.query(`SELECT payment_type_id FROM invoices WHERE id = ? AND tenant_id = ?`, [invoiceId, tenantId]);
      parts = [{ paymentTypeId: inv[0]?.payment_type_id || null, amount: total }];
    } else {
      let remaining = total;
      parts = original.map((r, idx) => {
        const share = idx === original.length - 1 ? remaining : round2((Number(r.amount) / paid) * total);
        remaining = round2(remaining - share);
        return { paymentTypeId: r.payment_type_id, amount: share };
      });
    }
  }

  const types = await getPaymentTypesMapTx(conn, tenantId, parts.map((p) => p.paymentTypeId));
  for (const part of parts) {
    if (part.amount === 0) continue;
    const type = types.get(Number(part.paymentTypeId));
    const isCash = type ? Number(type.is_cash) === 1 : false;
    await conn.query(
      `INSERT INTO register_payments
        (tenant_id, session_id, register_id, source, invoice_id, refund_id, payment_type_id, payment_type_title,
         is_cash, amount, cash_primary, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        session?.id || null,
        session?.register_id || null,
        source,
        invoiceId,
        refundId,
        part.paymentTypeId || null,
        type?.title || null,
        isCash ? 1 : 0,
        -part.amount,
        isCash ? -part.amount : 0,
        createdBy,
      ]
    );
  }
};

/* -------------------------------------------------------------------------- */
/* Summary (X / Z report)                                                     */
/* -------------------------------------------------------------------------- */

const computeSessionSummaryTx = async (conn, tenantId, session) => {
  const sid = session.id;
  const [ledger] = await conn.query(
    `SELECT source, payment_type_id, payment_type_title, is_cash, amount, tip_amount, cash_primary, cash_secondary,
            server_username, created_by, HOUR(created_at) AS hour, invoice_id, sub_invoice_id
     FROM register_payments WHERE tenant_id = ? AND session_id = ?`,
    [tenantId, sid]
  );
  const [movements] = await conn.query(
    `SELECT id, type, amount_primary, amount_secondary, reason, staff_username, created_by, approved_by, created_at
     FROM register_cash_movements WHERE tenant_id = ? AND session_id = ? ORDER BY created_at`,
    [tenantId, sid]
  );
  const [invoiceTotals] = await conn.query(
    `SELECT COUNT(*) AS invoice_count,
            COALESCE(SUM(sub_total), 0) AS sub_total,
            COALESCE(SUM(tax_total), 0) AS tax_total,
            COALESCE(SUM(service_charge_total), 0) AS service_charge_total,
            COALESCE(SUM(discount_total), 0) AS discount_total,
            COALESCE(SUM(promotion_discount_total), 0) AS promotion_discount_total,
            COALESCE(SUM(customer_group_discount_total), 0) AS customer_group_discount_total,
            COALESCE(SUM(loyalty_discount_amount), 0) AS loyalty_discount_total,
            COALESCE(SUM(CASE WHEN discount_total > 0 THEN 1 ELSE 0 END), 0) AS discounted_invoices,
            COALESCE(SUM(credit_amount), 0) AS pay_later_total,
            COALESCE(SUM(CASE WHEN credit_amount > 0 THEN 1 ELSE 0 END), 0) AS pay_later_count
     FROM invoices WHERE tenant_id = ? AND register_session_id = ? AND status <> 'VOID'`,
    [tenantId, sid]
  );

  const sales = ledger.filter((r) => r.source === "SALE" || r.source === "SUB_INVOICE");
  const voids = ledger.filter((r) => r.source === "VOID");
  const refunds = ledger.filter((r) => r.source === "REFUND");
  const dueCollections = ledger.filter((r) => r.source === "DUE_PAYMENT");
  const sum = (rows, key) => round2(rows.reduce((acc, r) => acc + Number(r[key] || 0), 0));
  const countDistinct = (rows) => new Set(rows.map((r) => (r.invoice_id ? `i${r.invoice_id}` : `s${r.sub_invoice_id}`))).size;

  const byType = new Map();
  for (const row of ledger) {
    const key = row.payment_type_id || 0;
    const entry = byType.get(key) || { payment_type_id: row.payment_type_id, title: row.payment_type_title || "Unknown", is_cash: Number(row.is_cash) === 1, count: 0, sales: 0, reversals: 0, tips: 0, net: 0 };
    if (Number(row.amount) >= 0) {
      entry.count += 1;
      entry.sales = round2(entry.sales + Number(row.amount));
    } else {
      entry.reversals = round2(entry.reversals + Number(row.amount));
    }
    entry.tips = round2(entry.tips + Number(row.tip_amount || 0));
    entry.net = round2(entry.sales + entry.reversals);
    byType.set(key, entry);
  }

  const tipsByServer = new Map();
  for (const row of sales.filter((r) => Number(r.tip_amount) > 0)) {
    const key = row.server_username || row.created_by || "unknown";
    const entry = tipsByServer.get(key) || { server: key, cash_tips: 0, non_cash_tips: 0 };
    if (Number(row.is_cash) === 1) entry.cash_tips = round2(entry.cash_tips + Number(row.tip_amount));
    else entry.non_cash_tips = round2(entry.non_cash_tips + Number(row.tip_amount));
    tipsByServer.set(key, entry);
  }
  const tipPayouts = movements.filter((m) => m.type === "TIP_PAYOUT");
  for (const m of tipPayouts) {
    const key = m.staff_username || "unknown";
    const entry = tipsByServer.get(key) || { server: key, cash_tips: 0, non_cash_tips: 0 };
    entry.paid_out = round2((entry.paid_out || 0) + toBase(session, m.amount_primary, m.amount_secondary));
    tipsByServer.set(key, entry);
  }

  const hourly = new Map();
  for (const row of sales) {
    const entry = hourly.get(row.hour) || { hour: row.hour, amount: 0, count: 0 };
    entry.amount = round2(entry.amount + Number(row.amount));
    entry.count += 1;
    hourly.set(row.hour, entry);
  }

  const byCashier = new Map();
  for (const row of ledger) {
    const key = row.created_by || "unknown";
    const entry = byCashier.get(key) || { cashier: key, sales: 0, reversals: 0, count: 0 };
    if (Number(row.amount) >= 0) {
      entry.sales = round2(entry.sales + Number(row.amount));
      entry.count += 1;
    } else {
      entry.reversals = round2(entry.reversals + Number(row.amount));
    }
    byCashier.set(key, entry);
  }

  const movementTotal = (type, key) => round2(movements.filter((m) => m.type === type).reduce((acc, m) => acc + Number(m[key] || 0), 0));
  const movementNet = (key) => round2(movements.reduce((acc, m) => acc + MOVEMENT_SIGN[m.type] * Number(m[key] || 0), 0));
  const cashLedger = ledger.filter((r) => Number(r.is_cash) === 1);
  const cashSalesRows = cashLedger.filter((r) => Number(r.amount) >= 0);
  const cashReversalRows = cashLedger.filter((r) => Number(r.amount) < 0);

  const expectedPrimary = round2(Number(session.opening_float_primary) + sum(cashLedger, "cash_primary") + movementNet("amount_primary"));
  const expectedSecondary = session.secondary_currency
    ? round2(Number(session.opening_float_secondary) + sum(cashLedger, "cash_secondary") + movementNet("amount_secondary"))
    : 0;

  const grossSales = sum(sales, "amount");
  const voidTotal = sum(voids, "amount");
  const refundTotal = sum(refunds, "amount");

  return {
    session_id: sid,
    register_id: session.register_id,
    register_name: session.register_name,
    business_date: session.business_date,
    z_number: session.z_number,
    status: session.status,
    opened_by: session.opened_by,
    opened_at: session.opened_at,
    closed_by: session.closed_by,
    closed_at: session.closed_at,
    current_cashier: session.current_cashier,
    primary_currency: session.primary_currency,
    secondary_currency: session.secondary_currency,
    exchange_rate: Number(session.exchange_rate),
    sales: {
      gross_sales: grossSales,
      bill_count: countDistinct(sales),
      void_total: voidTotal,
      void_count: countDistinct(voids),
      refund_total: refundTotal,
      refund_count: new Set(refunds.map((r) => r.invoice_id)).size,
      net_sales: round2(grossSales + voidTotal + refundTotal),
      tips_total: sum(sales, "tip_amount"),
      average_bill: countDistinct(sales) ? round2(grossSales / countDistinct(sales)) : 0,
      // Pay Later: money collected here for bills from earlier (not today's sales).
      due_collections_total: sum(dueCollections, "amount"),
      due_collections_count: dueCollections.length,
    },
    invoices: Object.fromEntries(Object.entries(invoiceTotals[0] || {}).map(([k, v]) => [k, round2(v)])),
    payments: [...byType.values()].sort((a, b) => b.net - a.net),
    cash: {
      opening_float_primary: round2(session.opening_float_primary),
      opening_float_secondary: round2(session.opening_float_secondary),
      cash_sales_primary: sum(cashSalesRows, "cash_primary"),
      cash_sales_secondary: sum(cashSalesRows, "cash_secondary"),
      cash_reversals_primary: sum(cashReversalRows, "cash_primary"),
      pay_in_primary: movementTotal("PAY_IN", "amount_primary"),
      pay_in_secondary: movementTotal("PAY_IN", "amount_secondary"),
      pay_out_primary: movementTotal("PAY_OUT", "amount_primary"),
      pay_out_secondary: movementTotal("PAY_OUT", "amount_secondary"),
      drop_primary: movementTotal("DROP", "amount_primary"),
      drop_secondary: movementTotal("DROP", "amount_secondary"),
      tip_payout_primary: movementTotal("TIP_PAYOUT", "amount_primary"),
      tip_payout_secondary: movementTotal("TIP_PAYOUT", "amount_secondary"),
      expected_primary: expectedPrimary,
      expected_secondary: expectedSecondary,
      expected_base: toBase(session, expectedPrimary, expectedSecondary),
      counted_primary: session.counted_primary !== null && session.counted_primary !== undefined ? round2(session.counted_primary) : null,
      counted_secondary: session.counted_secondary !== null && session.counted_secondary !== undefined ? round2(session.counted_secondary) : null,
      variance_primary: session.variance_primary !== null && session.variance_primary !== undefined ? round2(session.variance_primary) : null,
      variance_secondary: session.variance_secondary !== null && session.variance_secondary !== undefined ? round2(session.variance_secondary) : null,
      variance_base: session.variance_base !== null && session.variance_base !== undefined ? round2(session.variance_base) : null,
    },
    no_sale_count: movements.filter((m) => m.type === "NO_SALE").length,
    movements,
    tips_by_server: [...tipsByServer.values()],
    hourly: [...hourly.values()].sort((a, b) => a.hour - b.hour),
    by_cashier: [...byCashier.values()],
  };
};

exports.getSessionSummaryDB = async (tenantId, sessionId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const session = await getSessionTx(conn, tenantId, sessionId);
    if (!session) throw registerError("SESSION_NOT_FOUND", "Session not found");
    // A closed session reports from its frozen Z snapshot, so later edits can't rewrite history.
    if (session.status === "CLOSED" && session.summary) {
      const frozen = typeof session.summary === "string" ? JSON.parse(session.summary) : session.summary;
      return { ...frozen, status: "CLOSED" };
    }
    return await computeSessionSummaryTx(conn, tenantId, session);
  } finally {
    conn.release();
  }
};

/* -------------------------------------------------------------------------- */
/* Close / reopen                                                             */
/* -------------------------------------------------------------------------- */

exports.closeSessionDB = async (tenantId, sessionId, { username, countedPrimary, countedSecondary = 0, denominations = [], note = null, approvedBy = null }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [lockRows] = await conn.query(`SELECT id, status FROM register_sessions WHERE id = ? AND tenant_id = ? FOR UPDATE`, [sessionId, tenantId]);
    if (!lockRows.length) throw registerError("SESSION_NOT_FOUND", "Session not found");
    if (lockRows[0].status !== "OPEN") throw registerError("SESSION_CLOSED", "This register session is already closed");

    const session = await getSessionTx(conn, tenantId, sessionId);
    const settings = await getSettingsTx(conn, tenantId, { forUpdate: true });
    const summary = await computeSessionSummaryTx(conn, tenantId, session);

    const counted = { primary: round2(countedPrimary), secondary: session.secondary_currency ? round2(countedSecondary) : 0 };
    const variancePrimary = round2(counted.primary - summary.cash.expected_primary);
    const varianceSecondary = round2(counted.secondary - summary.cash.expected_secondary);
    const varianceBase = toBase(session, variancePrimary, varianceSecondary);

    if (Math.abs(varianceBase) > Number(settings.variance_threshold) && !approvedBy) {
      throw registerError("VARIANCE_APPROVAL_REQUIRED", "Cash variance is over the limit and needs manager approval", {
        variance: { primary: variancePrimary, secondary: varianceSecondary, base: varianceBase },
      });
    }

    const zNumber = Number(settings.last_z_number) + 1;
    await conn.query(`UPDATE register_settings SET last_z_number = ? WHERE tenant_id = ?`, [zNumber, tenantId]);

    await insertDenominationsTx(conn, tenantId, sessionId, "CLOSE", denominations);

    const frozen = {
      ...summary,
      z_number: zNumber,
      status: "CLOSED",
      closed_by: username,
      closed_at: new Date().toISOString(),
      variance_approved_by: approvedBy,
      closing_note: note,
      cash: {
        ...summary.cash,
        counted_primary: counted.primary,
        counted_secondary: counted.secondary,
        variance_primary: variancePrimary,
        variance_secondary: varianceSecondary,
        variance_base: varianceBase,
      },
    };

    await conn.query(
      `UPDATE register_sessions SET
         status = 'CLOSED', z_number = ?, closed_by = ?, closed_at = NOW(),
         expected_primary = ?, expected_secondary = ?, counted_primary = ?, counted_secondary = ?,
         variance_primary = ?, variance_secondary = ?, variance_base = ?, variance_approved_by = ?,
         closing_note = ?, summary = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        zNumber, username,
        summary.cash.expected_primary, summary.cash.expected_secondary, counted.primary, counted.secondary,
        variancePrimary, varianceSecondary, varianceBase, approvedBy,
        note, JSON.stringify(frozen),
        sessionId, tenantId,
      ]
    );

    await writeAuditTx(conn, {
      tenantId,
      registerId: session.register_id,
      sessionId,
      action: "SESSION_CLOSE",
      details: { zNumber, expected: summary.cash.expected_base, varianceBase },
      performedBy: username,
      approvedBy,
    });

    await conn.commit();
    return frozen;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.reopenSessionDB = async (tenantId, sessionId, { username, reason }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(`SELECT * FROM register_sessions WHERE id = ? AND tenant_id = ? FOR UPDATE`, [sessionId, tenantId]);
    const session = rows[0];
    if (!session) throw registerError("SESSION_NOT_FOUND", "Session not found");
    if (session.status !== "CLOSED") throw registerError("SESSION_NOT_CLOSED", "This session is still open");

    const [day] = await conn.query(`SELECT status FROM business_days WHERE id = ? AND tenant_id = ?`, [session.business_day_id, tenantId]);
    if (day[0]?.status === "CLOSED") throw registerError("DAY_CLOSED", "The business day for this session is already closed");

    const [open] = await conn.query(
      `SELECT id FROM register_sessions WHERE tenant_id = ? AND register_id = ? AND status = 'OPEN' LIMIT 1`,
      [tenantId, session.register_id]
    );
    if (open.length) throw registerError("REGISTER_ALREADY_OPEN", "Close the register's current session first");

    // The Z number is kept: a reopened Z is reprinted with the same number and the audit trail shows why.
    await conn.query(
      `UPDATE register_sessions SET status = 'OPEN', closed_by = NULL, closed_at = NULL,
         expected_primary = NULL, expected_secondary = NULL, counted_primary = NULL, counted_secondary = NULL,
         variance_primary = NULL, variance_secondary = NULL, variance_base = NULL, variance_approved_by = NULL, summary = NULL
       WHERE id = ? AND tenant_id = ?`,
      [sessionId, tenantId]
    );
    await conn.query(`DELETE FROM register_denomination_counts WHERE tenant_id = ? AND session_id = ? AND stage = 'CLOSE'`, [tenantId, sessionId]);
    await writeAuditTx(conn, {
      tenantId,
      registerId: session.register_id,
      sessionId,
      action: "SESSION_REOPEN",
      details: { reason, previousZ: session.z_number, previousVariance: session.variance_base },
      performedBy: username,
    });
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.getSessionsDB = async (tenantId, { from = null, to = null, registerId = null, limit = 100 } = {}) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const where = ["s.tenant_id = ?"];
    const params = [tenantId];
    if (from) {
      where.push("DATE(s.opened_at) >= ?");
      params.push(from);
    }
    if (to) {
      where.push("DATE(s.opened_at) <= ?");
      params.push(to);
    }
    if (registerId) {
      where.push("s.register_id = ?");
      params.push(registerId);
    }
    const [rows] = await conn.query(
      `SELECT s.id, s.register_id, r.name AS register_name, s.z_number, s.status, s.opened_by, s.opened_at,
              s.closed_by, s.closed_at, s.current_cashier, s.primary_currency, s.secondary_currency,
              s.expected_primary, s.expected_secondary, s.counted_primary, s.counted_secondary,
              s.variance_primary, s.variance_secondary, s.variance_base, s.variance_approved_by,
              DATE_FORMAT(bd.business_date, '%Y-%m-%d') AS business_date,
              CAST(JSON_UNQUOTE(JSON_EXTRACT(s.summary, '$.sales.net_sales')) AS DECIMAL(14,2)) AS net_sales
       FROM register_sessions s
       JOIN registers r ON r.id = s.register_id AND r.tenant_id = s.tenant_id
       LEFT JOIN business_days bd ON bd.id = s.business_day_id AND bd.tenant_id = s.tenant_id
       WHERE ${where.join(" AND ")}
       ORDER BY s.opened_at DESC
       LIMIT ?`,
      [...params, Math.min(Number(limit) || 100, 500)]
    );
    return rows;
  } finally {
    conn.release();
  }
};

exports.getSessionAuditDB = async (tenantId, sessionId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT id, action, details, performed_by, approved_by, created_at FROM register_audit_log
       WHERE tenant_id = ? AND session_id = ? ORDER BY created_at, id`,
      [tenantId, sessionId]
    );
    return rows;
  } finally {
    conn.release();
  }
};

/* -------------------------------------------------------------------------- */
/* Business day close                                                         */
/* -------------------------------------------------------------------------- */

const getDayChecklistTx = async (conn, tenantId) => {
  const [openSessions] = await conn.query(
    `SELECT s.id, r.name AS register_name, s.current_cashier, s.opened_at
     FROM register_sessions s JOIN registers r ON r.id = s.register_id AND r.tenant_id = s.tenant_id
     WHERE s.tenant_id = ? AND s.status = 'OPEN'`,
    [tenantId]
  );
  const [openOrders] = await conn.query(
    `SELECT o.id, o.token_no, o.table_id, st.table_title, o.date, o.status
     FROM orders o LEFT JOIN store_tables st ON st.id = o.table_id AND st.tenant_id = o.tenant_id
     WHERE o.tenant_id = ? AND o.payment_status = 'pending' AND o.status <> 'cancelled'
     ORDER BY o.date`,
    [tenantId]
  );
  const [[{ pending_qr: pendingQr }]] = await conn.query(
    `SELECT COUNT(*) AS pending_qr FROM qr_orders WHERE tenant_id = ? AND status NOT IN ('completed', 'cancelled')`,
    [tenantId]
  );
  return { openSessions, openOrders, pendingQrOrders: Number(pendingQr || 0) };
};

exports.getDayCloseChecklistDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [days] = await conn.query(
      `SELECT id, DATE_FORMAT(business_date, '%Y-%m-%d') AS business_date, opened_at, opened_by
       FROM business_days WHERE tenant_id = ? AND status = 'OPEN' ORDER BY business_date DESC LIMIT 1`,
      [tenantId]
    );
    const checklist = await getDayChecklistTx(conn, tenantId);
    return { day: days[0] || null, ...checklist };
  } finally {
    conn.release();
  }
};

exports.closeBusinessDayDB = async (tenantId, { username, carryOverOpenOrders = false }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();
    const [days] = await conn.query(
      `SELECT * FROM business_days WHERE tenant_id = ? AND status = 'OPEN' ORDER BY business_date DESC LIMIT 1 FOR UPDATE`,
      [tenantId]
    );
    const day = days[0];
    if (!day) throw registerError("NO_OPEN_DAY", "There is no open business day");

    const checklist = await getDayChecklistTx(conn, tenantId);
    if (checklist.openSessions.length) {
      throw registerError("REGISTERS_OPEN", "Close every register before closing the day", { checklist });
    }
    if ((checklist.openOrders.length || checklist.pendingQrOrders) && !carryOverOpenOrders) {
      throw registerError("OPEN_ORDERS", "There are unpaid orders; settle them or carry them over", { checklist });
    }

    const [sessions] = await conn.query(
      `SELECT id, z_number, summary FROM register_sessions WHERE tenant_id = ? AND business_day_id = ? AND status = 'CLOSED' ORDER BY z_number`,
      [tenantId, day.id]
    );
    const totals = { gross_sales: 0, void_total: 0, refund_total: 0, net_sales: 0, tips_total: 0, bill_count: 0, variance_base: 0, cash_expected_base: 0 };
    const payments = new Map();
    for (const s of sessions) {
      const sum = typeof s.summary === "string" ? JSON.parse(s.summary) : s.summary || {};
      for (const key of ["gross_sales", "void_total", "refund_total", "net_sales", "tips_total", "bill_count"]) {
        totals[key] = round2(totals[key] + Number(sum.sales?.[key] || 0));
      }
      totals.variance_base = round2(totals.variance_base + Number(sum.cash?.variance_base || 0));
      totals.cash_expected_base = round2(totals.cash_expected_base + Number(sum.cash?.expected_base || 0));
      for (const p of sum.payments || []) {
        const entry = payments.get(p.title) || { title: p.title, is_cash: p.is_cash, count: 0, net: 0 };
        entry.count += Number(p.count || 0);
        entry.net = round2(entry.net + Number(p.net || 0));
        payments.set(p.title, entry);
      }
    }

    const businessDate = typeof day.business_date === "string"
      ? day.business_date.slice(0, 10)
      : `${day.business_date.getFullYear()}-${String(day.business_date.getMonth() + 1).padStart(2, "0")}-${String(day.business_date.getDate()).padStart(2, "0")}`;

    const summary = {
      business_date: businessDate,
      closed_by: username,
      closed_at: new Date().toISOString(),
      sessions: sessions.map((s) => ({ id: s.id, z_number: s.z_number })),
      totals,
      payments: [...payments.values()].sort((a, b) => b.net - a.net),
      carried_over_orders: checklist.openOrders.map((o) => o.id),
      pending_qr_orders: checklist.pendingQrOrders,
    };

    await conn.query(
      `UPDATE business_days SET status = 'CLOSED', closed_by = ?, closed_at = NOW(), summary = ? WHERE id = ? AND tenant_id = ?`,
      [username, JSON.stringify(summary), day.id, tenantId]
    );
    await writeAuditTx(conn, { tenantId, action: "DAY_CLOSE", details: { businessDate, ...totals }, performedBy: username });
    await conn.commit();
    return summary;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.getBusinessDaysDB = async (tenantId, limit = 30) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT id, DATE_FORMAT(business_date, '%Y-%m-%d') AS business_date, status, opened_by, opened_at, closed_by, closed_at, summary
       FROM business_days WHERE tenant_id = ? ORDER BY business_date DESC LIMIT ?`,
      [tenantId, Math.min(Number(limit) || 30, 365)]
    );
    return rows;
  } finally {
    conn.release();
  }
};

/** Tenants that close their trading day in the POS get their day-end alerts from that close, not the clock. */
exports.tenantUsesBusinessDayCloseDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT 1 FROM business_days WHERE tenant_id = ? AND status = 'CLOSED' AND closed_at >= NOW() - INTERVAL 7 DAY LIMIT 1`,
      [tenantId]
    );
    return rows.length > 0;
  } finally {
    conn.release();
  }
};

/* -------------------------------------------------------------------------- */
/* Refunds                                                                    */
/* -------------------------------------------------------------------------- */

exports.REFUND_REASON_CODES = ["WRONG_ITEM", "QUALITY", "LONG_WAIT", "OVERCHARGED", "CUSTOMER_CHANGED_MIND", "DUPLICATE_PAYMENT", "OTHER"];

/**
 * Refund all or part of a completed invoice. The amount is computed and capped
 * on the server; item refunds are valued at the share of the paid total each
 * line represents, so discounts, tax and service charge are refunded pro rata.
 */
exports.refundInvoiceDB = async (tenantId, invoiceId, { session, refundType, amount = 0, items = [], reasonCode, reason = null, paymentTypeId = null, username, approvedBy = null }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [invoiceRows] = await conn.query(
      `SELECT id, status, total, refunded_total, balance_due, payment_type_id FROM invoices WHERE id = ? AND tenant_id = ? FOR UPDATE`,
      [invoiceId, tenantId]
    );
    const invoice = invoiceRows[0];
    if (!invoice) throw registerError("INVOICE_NOT_FOUND", "Invoice not found");
    if (invoice.status === "VOID") throw registerError("INVOICE_VOIDED", "A voided invoice cannot be refunded");

    const refundable = round2(Number(invoice.total) - Number(invoice.refunded_total || 0));
    if (refundable <= 0) throw registerError("NOTHING_TO_REFUND", "This invoice has already been fully refunded");

    let refundAmount = 0;
    let refundItems = null;

    if (refundType === "FULL") {
      refundAmount = refundable;
    } else if (refundType === "PARTIAL") {
      refundAmount = round2(amount);
    } else if (refundType === "ITEMS") {
      const [orderItems] = await conn.query(
        `SELECT oi.id, oi.quantity, oi.price, oi.status, COALESCE(mi.title, 'Item') AS title
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id
         LEFT JOIN menu_items mi ON mi.id = oi.item_id AND mi.tenant_id = oi.tenant_id
         WHERE o.invoice_id = ? AND oi.tenant_id = ?`,
        [invoiceId, tenantId]
      );
      const billable = orderItems.filter((oi) => oi.status !== "cancelled");
      const gross = billable.reduce((acc, oi) => acc + Number(oi.price || 0) * Number(oi.quantity || 0), 0);
      if (gross <= 0) throw registerError("NO_ITEMS", "This invoice has no refundable items");

      const [previous] = await conn.query(`SELECT items FROM invoice_refunds WHERE tenant_id = ? AND invoice_id = ? AND items IS NOT NULL`, [tenantId, invoiceId]);
      const alreadyRefunded = new Map();
      for (const r of previous) {
        const list = typeof r.items === "string" ? JSON.parse(r.items) : r.items || [];
        for (const it of list) alreadyRefunded.set(Number(it.orderItemId), (alreadyRefunded.get(Number(it.orderItemId)) || 0) + Number(it.quantity || 0));
      }

      refundItems = [];
      for (const req of Array.isArray(items) ? items : []) {
        const line = billable.find((oi) => Number(oi.id) === Number(req.orderItemId));
        const qty = parseInt(req.quantity, 10) || 0;
        if (!line || qty <= 0) continue;
        const left = Number(line.quantity) - (alreadyRefunded.get(Number(line.id)) || 0);
        if (qty > left) throw registerError("ITEM_QTY_EXCEEDED", `Only ${left} × ${line.title} can still be refunded`);
        const lineValue = round2((Number(line.price) * qty / gross) * Number(invoice.total));
        refundItems.push({ orderItemId: Number(line.id), title: line.title, quantity: qty, amount: lineValue });
        refundAmount += lineValue;
      }
      refundAmount = round2(refundAmount);
      if (!refundItems.length) throw registerError("NO_ITEMS", "Select at least one item to refund");
    } else {
      throw registerError("INVALID_REFUND_TYPE", "Unknown refund type");
    }

    if (refundAmount <= 0) throw registerError("AMOUNT_REQUIRED", "Enter a refund amount");
    if (refundAmount > refundable + 0.001) throw registerError("REFUND_EXCEEDS", `At most ${refundable} can still be refunded`);

    const settings = await getSettingsTx(conn, tenantId, { forUpdate: true });
    const refundNo = Number(settings.last_refund_no) + 1;
    await conn.query(`UPDATE register_settings SET last_refund_no = ? WHERE tenant_id = ?`, [refundNo, tenantId]);

    let type = null;
    if (paymentTypeId) {
      const types = await getPaymentTypesMapTx(conn, tenantId, [paymentTypeId]);
      type = types.get(Number(paymentTypeId));
      if (!type) throw registerError("PAYMENT_TYPE_NOT_FOUND", "Payment type not found");
    }

    const [result] = await conn.query(
      `INSERT INTO invoice_refunds
        (tenant_id, refund_no, invoice_id, session_id, refund_type, amount, reason_code, reason,
         payment_type_id, payment_type_title, is_cash, items, created_by, approved_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, refundNo, invoiceId, session?.id || null, refundType, refundAmount, reasonCode, reason,
        type ? type.id : null, type ? type.title : null, type ? Number(type.is_cash) : 0,
        refundItems ? JSON.stringify(refundItems) : null, username, approvedBy,
      ]
    );

    // Pay Later: a refund on a bill that is still owed first cancels what is
    // owed (a credit note); only the rest is paid out of the drawer.
    const balanceDue = round2(invoice.balance_due || 0);
    const fromBalance = round2(Math.min(refundAmount, balanceDue));
    const cashOut = round2(refundAmount - fromBalance);

    await exports.recordReversalTx(conn, {
      tenantId,
      session,
      source: "REFUND",
      invoiceId,
      refundId: result.insertId,
      amount: cashOut,
      paymentTypeId: type ? type.id : null,
      createdBy: username,
    });

    await conn.query(`UPDATE invoices SET refunded_total = refunded_total + ? WHERE id = ? AND tenant_id = ?`, [refundAmount, invoiceId, tenantId]);
    if (fromBalance > 0) {
      const newBalance = round2(balanceDue - fromBalance);
      await conn.query(
        `UPDATE invoices
         SET balance_due = ?, payment_status = CASE WHEN ? <= 0 THEN 'paid' ELSE payment_status END,
             paid_off_at = CASE WHEN ? <= 0 THEN NOW() ELSE paid_off_at END
         WHERE id = ? AND tenant_id = ?`,
        [newBalance, newBalance, newBalance, invoiceId, tenantId]
      );
    }

    await conn.query(
      `INSERT INTO invoice_audit_log
       (tenant_id, invoice_id, invoice_number, action, performed_by, reason, previous_status, new_status)
       VALUES (?, ?, ?, 'REFUND', ?, ?, ?, ?)`,
      [tenantId, invoiceId, invoiceId, username, `[${reasonCode}] Refund #${refundNo} ${refundAmount}${reason ? `: ${reason}` : ""}`, invoice.status, invoice.status]
    ).catch((error) => {
      // invoice_audit_log.action may be an ENUM without REFUND on older schemas; the refund itself still stands.
      console.warn("[refund] audit log insert skipped:", error.message);
    });

    if (session) {
      await writeAuditTx(conn, {
        tenantId,
        registerId: session.register_id,
        sessionId: session.id,
        action: "REFUND",
        details: { invoiceId, refundNo, amount: refundAmount, reasonCode },
        performedBy: username,
        approvedBy,
      });
    }

    await conn.commit();
    return { id: result.insertId, refundNo, invoiceId: Number(invoiceId), amount: refundAmount, refundType, items: refundItems, paymentTypeTitle: type?.title || null };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.getInvoiceRefundsDB = async (tenantId, invoiceId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT id, refund_no, refund_type, amount, reason_code, reason, payment_type_title, items, created_by, approved_by, created_at
       FROM invoice_refunds WHERE tenant_id = ? AND invoice_id = ? ORDER BY created_at`,
      [tenantId, invoiceId]
    );
    return rows;
  } finally {
    conn.release();
  }
};

/** Refundable order lines of an invoice, with what is left to refund per line. */
exports.getRefundableItemsDB = async (tenantId, invoiceId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [invoiceRows] = await conn.query(`SELECT id, total, refunded_total, status FROM invoices WHERE id = ? AND tenant_id = ?`, [invoiceId, tenantId]);
    if (!invoiceRows.length) throw registerError("INVOICE_NOT_FOUND", "Invoice not found");
    const [orderItems] = await conn.query(
      `SELECT oi.id, oi.quantity, oi.price, oi.status, COALESCE(mi.title, 'Item') AS title, v.title AS variant_title
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id
       LEFT JOIN menu_items mi ON mi.id = oi.item_id AND mi.tenant_id = oi.tenant_id
       LEFT JOIN menu_item_variants v ON v.id = oi.variant_id AND v.tenant_id = oi.tenant_id
       WHERE o.invoice_id = ? AND oi.tenant_id = ? AND oi.status <> 'cancelled'`,
      [invoiceId, tenantId]
    );
    const [previous] = await conn.query(`SELECT items FROM invoice_refunds WHERE tenant_id = ? AND invoice_id = ? AND items IS NOT NULL`, [tenantId, invoiceId]);
    const refunded = new Map();
    for (const r of previous) {
      const list = typeof r.items === "string" ? JSON.parse(r.items) : r.items || [];
      for (const it of list) refunded.set(Number(it.orderItemId), (refunded.get(Number(it.orderItemId)) || 0) + Number(it.quantity || 0));
    }
    const invoice = invoiceRows[0];
    return {
      invoice: { id: invoice.id, total: round2(invoice.total), refunded_total: round2(invoice.refunded_total), refundable: round2(Number(invoice.total) - Number(invoice.refunded_total || 0)), status: invoice.status },
      items: orderItems.map((oi) => ({
        orderItemId: oi.id,
        title: oi.variant_title ? `${oi.title} (${oi.variant_title})` : oi.title,
        quantity: Number(oi.quantity),
        price: round2(oi.price),
        refundedQuantity: refunded.get(Number(oi.id)) || 0,
      })),
    };
  } finally {
    conn.release();
  }
};
