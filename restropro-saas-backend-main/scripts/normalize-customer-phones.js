/**
 * Normalise stored customer phone numbers to "+855…" (see src/utils/phone.js).
 *
 * The phone is the customers primary key, so each change moves the customer:
 * copy the row under the new number, repoint orders / invoices / loyalty /
 * reservations / QR orders / feedback, then delete the old row — one
 * transaction per customer. (Updating the key in place would blank
 * feedbacks.phone through its ON UPDATE SET NULL foreign key.)
 *
 * Customers whose normalised number already exists are duplicates: they are
 * listed for a manual merge and left untouched.
 *
 * Usage (dry run by default):
 *   node scripts/normalize-customer-phones.js [--tenant=721] [--apply]
 */

const mysql = require("mysql2/promise");
const { normalizePhone } = require("../src/utils/phone");

// Tables that store a customer's phone, as [table, column]
const REFERENCES = [
  ["orders", "customer_id"],
  ["invoices", "customer_phone"],
  ["customer_loyalty_transactions", "customer_phone"],
  ["reservations", "customer_id"],
  ["qr_orders", "customer_id"],
  ["feedbacks", "phone"],
];

const MIN_PHONE_DIGITS = 8;

function parseArgs() {
  const args = process.argv.slice(2);
  const tenantArg = args.find((a) => a.startsWith("--tenant="));
  return {
    apply: args.includes("--apply"),
    tenantId: tenantArg ? Number(tenantArg.split("=")[1]) : null,
  };
}

async function main() {
  const { apply, tenantId } = parseArgs();
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "db",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "restro",
    password: process.env.DB_PASSWORD || "restropass",
    database: process.env.DB_NAME || "restropro_saas",
  });

  try {
    const [[{ db }]] = await conn.query("SELECT DATABASE() AS db");

    // Only touch reference columns that exist (and are tenant scoped) on this schema
    const [refCols] = await conn.query(
      `SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ?`,
      [db]
    );
    const has = (table, column) => refCols.some((c) => c.TABLE_NAME === table && c.COLUMN_NAME === column);
    const references = REFERENCES.filter(([table, column]) => has(table, column) && has(table, "tenant_id"));
    const customerColumns = refCols
      .filter((c) => c.TABLE_NAME === "customers")
      .map((c) => c.COLUMN_NAME);

    const [customers] = await conn.query(
      `SELECT phone, tenant_id, name FROM customers ${tenantId ? "WHERE tenant_id = ?" : ""} ORDER BY tenant_id, phone`,
      tenantId ? [tenantId] : []
    );

    const toMove = [];
    const skipped = [];
    const existing = new Set(customers.map((c) => `${c.tenant_id}|${c.phone}`));

    for (const c of customers) {
      const target = normalizePhone(c.phone);
      if (target === c.phone) continue;
      if (target.replace(/\D/g, "").length < MIN_PHONE_DIGITS) {
        skipped.push({ ...c, target, reason: "not a valid phone number" });
        continue;
      }
      if (existing.has(`${c.tenant_id}|${target}`)) {
        skipped.push({ ...c, target, reason: "duplicate — merge manually" });
        continue;
      }
      existing.add(`${c.tenant_id}|${target}`);
      toMove.push({ ...c, target });
    }

    console.log(`${apply ? "APPLY" : "DRY RUN"} — ${customers.length} customers checked${tenantId ? ` (tenant ${tenantId})` : ""}`);
    console.log(`  to normalise: ${toMove.length}`);
    for (const c of toMove) console.log(`    [${c.tenant_id}] ${c.phone} -> ${c.target}  (${c.name})`);
    console.log(`  skipped: ${skipped.length}`);
    for (const c of skipped) console.log(`    [${c.tenant_id}] ${c.phone} -> ${c.target}  (${c.name}): ${c.reason}`);

    if (!apply) {
      console.log("\nNothing changed. Re-run with --apply to normalise.");
      return;
    }

    const otherColumns = customerColumns.filter((col) => col !== "phone");
    const columnList = ["phone", ...otherColumns].map((col) => `\`${col}\``).join(", ");
    const selectList = ["?", ...otherColumns].map((col) => (col === "?" ? col : `\`${col}\``)).join(", ");

    let moved = 0;
    for (const c of toMove) {
      await conn.beginTransaction();
      try {
        await conn.query(
          `INSERT INTO customers (${columnList}) SELECT ${selectList} FROM customers WHERE phone = ? AND tenant_id = ?`,
          [c.target, c.phone, c.tenant_id]
        );
        for (const [table, column] of references) {
          await conn.query(
            `UPDATE \`${table}\` SET \`${column}\` = ? WHERE \`${column}\` = ? AND tenant_id = ?`,
            [c.target, c.phone, c.tenant_id]
          );
        }
        await conn.query(`DELETE FROM customers WHERE phone = ? AND tenant_id = ?`, [c.phone, c.tenant_id]);
        await conn.commit();
        moved++;
      } catch (error) {
        await conn.rollback();
        console.error(`  failed [${c.tenant_id}] ${c.phone}: ${error.message}`);
      }
    }

    console.log(`\nNormalised ${moved} of ${toMove.length} customers.`);
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
