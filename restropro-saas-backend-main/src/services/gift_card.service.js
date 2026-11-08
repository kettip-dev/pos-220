/**
 * Gift cards / stored-value vouchers.
 *
 *  - Issue (sell) or reload a card: money goes into the drawer ledger with
 *    source GIFT_CARD (not a sale; the balance is a liability until spent).
 *  - Redeem: a tender line on the tenant's "Gift Card" payment type carrying
 *    `giftCardCode`; the balance is checked and deducted inside the invoice
 *    transaction, so a card can never go negative.
 *  - Voiding an invoice puts redeemed amounts back on the card.
 */
const crypto = require("crypto");
const { getMySqlPromiseConnection } = require("../config/mysql.db");

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function giftError(message, statusCode = 400, code = "GIFT_CARD_INVALID") {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}
exports.giftError = giftError;

const normalizeCode = (code) => String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** 12 characters without look-alikes (0/O, 1/I), shown as XXXX-XXXX-XXXX. */
function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
exports.formatCode = (code) => normalizeCode(code).replace(/(.{4})(?=.)/g, "$1-");

/** The tenant's "Gift Card" payment type (created on first use). */
exports.getOrCreateGiftCardPaymentTypeDB = async (tenantId, existingConn = null) => {
  const conn = existingConn || (await getMySqlPromiseConnection());
  try {
    const [[row]] = await conn.query(`SELECT id FROM payment_types WHERE tenant_id = ? AND is_gift_card = 1 ORDER BY id LIMIT 1`, [tenantId]);
    if (row) return row.id;
    const [res] = await conn.query(
      `INSERT INTO payment_types (title, is_active, tenant_id, icon, is_cash, is_gift_card) VALUES ('Gift Card', 1, ?, 'gift', 0, 1)`,
      [tenantId]
    );
    return res.insertId;
  } finally {
    if (!existingConn) conn.release();
  }
};

async function insertTxn(conn, tenantId, card, { type, amount, invoiceId = null, sessionId = null, note = null, createdBy = null }) {
  await conn.query(
    `INSERT INTO gift_card_transactions (tenant_id, gift_card_id, type, amount, balance_after, invoice_id, register_session_id, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, card.id, type, round2(amount), round2(card.balance), invoiceId, sessionId, note ? String(note).slice(0, 255) : null, createdBy]
  );
}

exports.lookupGiftCardDB = async (tenantId, code) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [[card]] = await conn.query(
      `SELECT g.*, c.name AS customer_name FROM gift_cards g
       LEFT JOIN customers c ON c.phone = g.customer_phone AND c.tenant_id = g.tenant_id
       WHERE g.tenant_id = ? AND g.code = ?`,
      [tenantId, normalizeCode(code)]
    );
    if (!card) throw giftError("Gift card not found", 404, "GIFT_CARD_NOT_FOUND");
    const [txns] = await conn.query(
      `SELECT type, amount, balance_after, invoice_id, note, created_by, created_at FROM gift_card_transactions
       WHERE tenant_id = ? AND gift_card_id = ? ORDER BY id DESC LIMIT 20`,
      [tenantId, card.id]
    );
    return { ...card, display_code: exports.formatCode(card.code), transactions: txns };
  } finally {
    conn.release();
  }
};

exports.getGiftCardsDB = async (tenantId, { search = "", limit = 200 } = {}) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const q = String(search || "").trim();
    const params = [tenantId];
    let where = "g.tenant_id = ?";
    if (q) {
      where += " AND (g.code LIKE ? OR g.customer_phone LIKE ? OR c.name LIKE ?)";
      params.push(`%${normalizeCode(q) || q}%`, `%${q}%`, `%${q}%`);
    }
    params.push(Math.min(Number(limit) || 200, 1000));
    const [rows] = await conn.query(
      `SELECT g.id, g.code, g.initial_balance, g.balance, g.status, g.customer_phone, c.name AS customer_name, g.expires_at, g.created_at, g.note
       FROM gift_cards g
       LEFT JOIN customers c ON c.phone = g.customer_phone AND c.tenant_id = g.tenant_id
       WHERE ${where} ORDER BY g.id DESC LIMIT ?`,
      params
    );
    const [[totals]] = await conn.query(
      `SELECT COUNT(*) AS cards, COALESCE(SUM(balance), 0) AS outstanding FROM gift_cards WHERE tenant_id = ? AND status = 'ACTIVE'`,
      [tenantId]
    );
    return { cards: rows.map((r) => ({ ...r, display_code: exports.formatCode(r.code) })), totals };
  } finally {
    conn.release();
  }
};

/**
 * Sell a new card, or reload an existing one (`code` of an active card).
 * The money is recorded in the drawer ledger as source GIFT_CARD.
 */
exports.issueOrReloadGiftCardDB = async (tenantId, { code = null, amount, paymentTypeId, customerPhone = null, expiresAt = null, note = null, session = null, username }) => {
  const value = round2(amount);
  if (!(value > 0)) throw giftError("Enter an amount");
  if (value > 100000) throw giftError("Amount is too large");
  if (!paymentTypeId) throw giftError("Choose how the card is paid for");

  const { recordPaymentsTx } = require("./register.service");
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const giftTypeId = await exports.getOrCreateGiftCardPaymentTypeDB(tenantId, conn);
    if (Number(paymentTypeId) === Number(giftTypeId)) throw giftError("A gift card cannot be paid with a gift card");

    let card = null;
    let type = "ISSUE";
    const wanted = normalizeCode(code);
    if (wanted) {
      const [[existing]] = await conn.query(`SELECT * FROM gift_cards WHERE tenant_id = ? AND code = ? FOR UPDATE`, [tenantId, wanted]);
      if (existing) {
        if (existing.status !== "ACTIVE") throw giftError("This card is not active");
        card = existing;
        type = "RELOAD";
      }
    }

    if (!card) {
      let newCode = wanted;
      if (newCode && (newCode.length < 6 || newCode.length > 32)) throw giftError("Card numbers are 6 to 32 letters or digits");
      for (let attempt = 0; !newCode && attempt < 5; attempt++) {
        const candidate = generateCode();
        const [[taken]] = await conn.query(`SELECT id FROM gift_cards WHERE tenant_id = ? AND code = ?`, [tenantId, candidate]);
        if (!taken) newCode = candidate;
      }
      const [res] = await conn.query(
        `INSERT INTO gift_cards (tenant_id, code, initial_balance, balance, status, customer_phone, note, expires_at, issued_by)
         VALUES (?, ?, 0, 0, 'ACTIVE', ?, ?, ?, ?)`,
        [tenantId, newCode, customerPhone || null, note || null, expiresAt || null, username]
      );
      card = { id: res.insertId, code: newCode, balance: 0, initial_balance: 0 };
    }

    card.balance = round2(Number(card.balance) + value);
    await conn.query(
      `UPDATE gift_cards SET balance = ?, initial_balance = IF(? = 'ISSUE', ?, initial_balance) WHERE id = ? AND tenant_id = ?`,
      [card.balance, type, value, card.id, tenantId]
    );
    await insertTxn(conn, tenantId, card, { type, amount: value, sessionId: session?.id || null, note, createdBy: username });

    await recordPaymentsTx(conn, {
      tenantId,
      session,
      source: "GIFT_CARD",
      lines: [{ paymentTypeId: Number(paymentTypeId), amount: value, reference: `Gift card ${exports.formatCode(card.code)} ${type.toLowerCase()}` }],
      createdBy: username,
    });

    await conn.commit();
    return { id: card.id, code: card.code, display_code: exports.formatCode(card.code), balance: card.balance, type };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Inside createInvoiceDB: deduct every gift-card tender line. Lines on the
 * Gift Card payment type must carry `giftCardCode`.
 */
exports.redeemGiftCardLinesTx = async (conn, { tenantId, invoiceId, lines, session = null, username }) => {
  const [[giftType]] = await conn.query(`SELECT id FROM payment_types WHERE tenant_id = ? AND is_gift_card = 1 LIMIT 1`, [tenantId]);
  if (!giftType) return;
  for (const line of lines) {
    if (Number(line.paymentTypeId) !== Number(giftType.id)) continue;
    const code = normalizeCode(line.giftCardCode);
    if (!code) throw giftError("Scan or type the gift card number");
    const [[card]] = await conn.query(`SELECT * FROM gift_cards WHERE tenant_id = ? AND code = ? FOR UPDATE`, [tenantId, code]);
    if (!card) throw giftError("Gift card not found", 404, "GIFT_CARD_NOT_FOUND");
    if (card.status !== "ACTIVE") throw giftError("This gift card is not active");
    if (card.expires_at && new Date(card.expires_at) < new Date(new Date().toDateString())) throw giftError("This gift card has expired");
    const amount = round2(line.amount);
    if (Number(card.balance) + 0.001 < amount) {
      throw giftError(`Gift card balance is ${Number(card.balance).toFixed(2)}`, 400, "GIFT_CARD_INSUFFICIENT");
    }
    card.balance = round2(Number(card.balance) - amount);
    await conn.query(`UPDATE gift_cards SET balance = ? WHERE id = ? AND tenant_id = ?`, [card.balance, card.id, tenantId]);
    await insertTxn(conn, tenantId, card, { type: "REDEEM", amount: -amount, invoiceId, sessionId: session?.id || null, createdBy: username });
    line.reference = `Gift card ${exports.formatCode(card.code)}`;
  }
};

/** Invoice voided: put what it took from gift cards back on them. */
exports.restoreGiftCardsForInvoiceTx = async (conn, { tenantId, invoiceId, username }) => {
  const [rows] = await conn.query(
    `SELECT gift_card_id, SUM(amount) AS net FROM gift_card_transactions
     WHERE tenant_id = ? AND invoice_id = ? AND type IN ('REDEEM', 'RESTORE')
     GROUP BY gift_card_id HAVING net < 0`,
    [tenantId, invoiceId]
  );
  for (const r of rows) {
    const [[card]] = await conn.query(`SELECT * FROM gift_cards WHERE id = ? AND tenant_id = ? FOR UPDATE`, [r.gift_card_id, tenantId]);
    if (!card) continue;
    const back = round2(-Number(r.net));
    card.balance = round2(Number(card.balance) + back);
    await conn.query(`UPDATE gift_cards SET balance = ? WHERE id = ? AND tenant_id = ?`, [card.balance, card.id, tenantId]);
    await insertTxn(conn, tenantId, card, { type: "RESTORE", amount: back, invoiceId, note: "Invoice voided", createdBy: username });
  }
};
