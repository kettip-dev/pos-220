/**
 * Customer phone numbers are the customers table primary key (phone, tenant_id)
 * and are referenced by orders, invoices, loyalty, reservations, QR orders and
 * feedback. Typed numbers arrive as "012 345 678", "012345678", "85512345678"
 * or "+85512345678", which would otherwise become separate customers.
 *
 * New numbers are stored in one international form ("+85512345678"); lookups
 * match every form so rows saved before normalisation are still found.
 */

const DEFAULT_COUNTRY_CODE = "855"; // Cambodia

/**
 * Normalise a typed phone number to "+<country><national>".
 * Input that has no digits is returned trimmed and unchanged.
 */
function normalizePhone(raw, countryCode = DEFAULT_COUNTRY_CODE) {
  if (raw === undefined || raw === null) return "";
  const value = String(raw).trim();
  if (!value) return "";

  const digits = value.replace(/\D/g, "");
  if (!digits) return value;

  if (value.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith(countryCode) && digits.length >= countryCode.length + 8) return `+${digits}`;
  if (digits.startsWith("0")) return `+${countryCode}${digits.slice(1)}`;
  // Local number typed without its leading 0 (Cambodian numbers are 8-9 digits)
  if (digits.length === 8 || digits.length === 9) return `+${countryCode}${digits}`;

  return digits;
}

/**
 * Every stored form a number may have been saved under, for exact-match lookups.
 */
function phoneLookupVariants(raw, countryCode = DEFAULT_COUNTRY_CODE) {
  const original = raw === undefined || raw === null ? "" : String(raw).trim();
  const normalized = normalizePhone(original, countryCode);
  const variants = new Set([original, normalized]);

  const prefix = `+${countryCode}`;
  if (normalized.startsWith(prefix)) {
    const national = normalized.slice(prefix.length);
    variants.add(`${countryCode}${national}`);
    variants.add(`0${national}`);
    variants.add(national);
  }

  return [...variants].filter(Boolean);
}

/**
 * LIKE prefixes for searching a partially typed number ("0775" also finds
 * "+855775…"). Returns [] when the search text is not a number.
 */
function phoneSearchPrefixes(raw, countryCode = DEFAULT_COUNTRY_CODE) {
  const value = raw === undefined || raw === null ? "" : String(raw).trim();
  if (!/^\+?[\d\s\-().]+$/.test(value)) return [];

  const digits = value.replace(/\D/g, "");
  if (digits.length < 2) return [];

  const prefixes = new Set([value, digits]);
  let national = null;
  if (value.startsWith("+") && digits.startsWith(countryCode)) national = digits.slice(countryCode.length);
  else if (digits.startsWith("00" + countryCode)) national = digits.slice(2 + countryCode.length);
  else if (digits.startsWith(countryCode)) national = digits.slice(countryCode.length);
  else if (digits.startsWith("0")) national = digits.slice(1);

  if (national !== null) {
    prefixes.add(`+${countryCode}${national}`);
    prefixes.add(`${countryCode}${national}`);
    prefixes.add(`0${national}`);
  }

  return [...prefixes].filter(Boolean);
}

/**
 * The stored phone of the tenant's customer matching any format of `raw`, or
 * null. Prefers an exact match, then the normalised form, then legacy forms.
 * Takes an open connection so it can run inside a caller's transaction.
 */
async function findCustomerPhone(conn, raw, tenantId) {
  const variants = phoneLookupVariants(raw);
  if (variants.length === 0) return null;

  const [rows] = await conn.query(
    `SELECT phone FROM customers
    WHERE tenant_id = ? AND phone IN (?)
    ORDER BY FIELD(phone, ?) ASC
    LIMIT 1;`,
    [tenantId, variants, variants]
  );

  return rows[0]?.phone ?? null;
}

/**
 * The phone to save a typed number under: the existing customer's stored phone
 * when there is one, otherwise the normalised number.
 */
async function resolveCustomerPhone(conn, raw, tenantId) {
  return (await findCustomerPhone(conn, raw, tenantId)) || normalizePhone(raw);
}

module.exports = {
  DEFAULT_COUNTRY_CODE,
  normalizePhone,
  phoneLookupVariants,
  phoneSearchPrefixes,
  findCustomerPhone,
  resolveCustomerPhone,
};
