const { getMySqlPromiseConnection } = require("../config/mysql.db");

const ALLOWED_FIELDS = [
  "receipt_template",
  "kot_template",
  "show_logo",
  "show_store_details",
  "show_customer_details",
  "show_tax_breakdown",
  "show_qr",
  "qr_type",
  "qr_value",
  "density",
  "font_scale",
  "kot_show_prices",
  "paper_width_80",
  "paper_width_58",
  "header",
  "footer",
  "footer_promo",
];

/**
 * Get the receipt/KOT print format for a tenant (or null if not configured yet —
 * the captain app falls back to its built-in defaults in that case).
 */
exports.getPosPrintFormatDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT ${ALLOWED_FIELDS.join(", ")} FROM pos_print_format WHERE tenant_id = ?`,
      [tenantId]
    );
    return rows[0] || null;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Upsert the receipt/KOT print format. Only known fields are written; unknown
 * keys are ignored. Returns the saved row.
 */
exports.upsertPosPrintFormatDB = async (tenantId, updates) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const fields = ALLOWED_FIELDS.filter((f) => updates[f] !== undefined);
    const cols = ["tenant_id", ...fields];
    const placeholders = cols.map(() => "?").join(", ");
    const values = [tenantId, ...fields.map((f) => updates[f])];
    const updateClause = fields.map((f) => `${f} = VALUES(${f})`).join(", ");

    const sql = `
      INSERT INTO pos_print_format (${cols.join(", ")})
      VALUES (${placeholders})
      ${fields.length ? `ON DUPLICATE KEY UPDATE ${updateClause}` : "ON DUPLICATE KEY UPDATE tenant_id = tenant_id"};
    `;
    await conn.query(sql, values);

    const [rows] = await conn.query(
      `SELECT ${ALLOWED_FIELDS.join(", ")} FROM pos_print_format WHERE tenant_id = ?`,
      [tenantId]
    );
    return rows[0] || null;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};
