/**
 * Business expenses recorded by owners / managers. Cash taken from the till
 * (register PAY_OUT) is counted separately in the Profit & Loss report, so it
 * should not be entered here as well. All queries are tenant-scoped.
 */
const { getMySqlPromiseConnection } = require("../config/mysql.db");

const EXPENSE_CATEGORIES = [
  "rent", "staff", "utilities", "gas", "market", "supplies", "repairs", "marketing", "bank_fees", "other",
];
const PAID_WITH = ["cash", "bank", "card", "other"];
exports.EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

const withConn = async (fn) => {
  const conn = await getMySqlPromiseConnection();
  try {
    return await fn(conn);
  } finally {
    conn.release();
  }
};

/** Validate the expense form. Returns { error } or { data }. */
exports.parseExpenseInput = (body = {}) => {
  const amount = Math.round(Number(body.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter an amount above zero" };
  if (amount > 100000000) return { error: "Amount is too large" };
  if (!isDate(body.date)) return { error: "Pick a date" };
  const category = EXPENSE_CATEGORIES.includes(body.category) ? body.category : null;
  if (!category) return { error: "Pick a category" };
  return {
    data: {
      date: body.date,
      category,
      amount,
      note: String(body.note || "").trim().slice(0, 255) || null,
      paidWith: PAID_WITH.includes(body.paidWith) ? body.paidWith : null,
    },
  };
};

exports.getExpensesDB = (tenantId, from, to) =>
  withConn(async (conn) => {
    const [rows] = await conn.query(
      `SELECT id, DATE_FORMAT(expense_date, '%Y-%m-%d') AS date, category, amount, note, paid_with, created_by, created_at
       FROM expenses
       WHERE tenant_id = ? AND expense_date BETWEEN ? AND ?
       ORDER BY expense_date DESC, id DESC
       LIMIT 2000`,
      [tenantId, from, to]
    );
    const items = rows.map((r) => ({ ...r, amount: Number(r.amount) }));
    const byCategory = {};
    items.forEach((r) => { byCategory[r.category] = Math.round(((byCategory[r.category] || 0) + r.amount) * 100) / 100; });
    const total = Math.round(items.reduce((s, r) => s + r.amount, 0) * 100) / 100;
    return { items, byCategory, total };
  });

exports.addExpenseDB = (tenantId, d, username) =>
  withConn(async (conn) => {
    const [r] = await conn.query(
      `INSERT INTO expenses (tenant_id, expense_date, category, amount, note, paid_with, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, d.date, d.category, d.amount, d.note, d.paidWith, username || null]
    );
    return r.insertId;
  });

exports.updateExpenseDB = (id, tenantId, d) =>
  withConn(async (conn) => {
    const [r] = await conn.query(
      `UPDATE expenses SET expense_date = ?, category = ?, amount = ?, note = ?, paid_with = ? WHERE id = ? AND tenant_id = ?`,
      [d.date, d.category, d.amount, d.note, d.paidWith, id, tenantId]
    );
    return r.affectedRows > 0;
  });

exports.deleteExpenseDB = (id, tenantId) =>
  withConn(async (conn) => {
    const [r] = await conn.query(`DELETE FROM expenses WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
    return r.affectedRows > 0;
  });

exports.isValidDate = isDate;
