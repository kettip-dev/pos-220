/**
 * Tenant scoping for consolidated ("All Businesses") queries.
 *
 * Every operational query in the platform filters by `tenant_id`. In the default
 * single-business mode that is one id; a Business Group Owner in All Businesses
 * mode needs the same query across every business in their group.
 *
 * Rather than change ~280 `tenant_id = ?` filters to carry two shapes, a service
 * takes the resolved `req.dataScope` (see middlewares/data_scope.middleware.js)
 * and builds its filter here. `tenantIds` is ALWAYS an array — length 1 in
 * single-business mode — so one code path serves both and a Business Admin's
 * query plan and rows are unchanged: `IN (?)` with a single id is equivalent to
 * `= ?`.
 *
 * This module never reads the request. It only formats a scope that
 * resolveDataScope already authorised against the database.
 */

/**
 * Normalise anything a caller might still hold into a scope object.
 *
 * Accepts a real `req.dataScope`, or a bare tenant id / array of ids, so a
 * service can be converted before its callers are, and a scheduler (which has no
 * request) can pass a plain tenant id. Returns { mode, tenantIds }.
 */
const toScope = (scopeOrTenantId) => {
  if (scopeOrTenantId && Array.isArray(scopeOrTenantId.tenantIds)) {
    return scopeOrTenantId;
  }

  const ids = Array.isArray(scopeOrTenantId) ? scopeOrTenantId : [scopeOrTenantId];
  return { mode: "tenant", tenantIds: ids };
};

/** Positive integer tenant ids, de-duplicated, order preserved. */
const normaliseTenantIds = (tenantIds) => [
  ...new Set(
    (tenantIds || [])
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0)
  ),
];

/**
 * SQL fragment + params scoping a query to the businesses in `scope`.
 *
 *   const { sql, params } = tenantFilter(scope, "o");
 *   conn.query(`SELECT ... FROM orders o WHERE ${sql}`, [...params]);
 *
 * `alias` qualifies the column when the query joins more than one table.
 *
 * Throws when the scope resolves to no business at all. An empty `IN ()` is a
 * syntax error in MySQL, and silently dropping the filter would return every
 * tenant's rows — so this fails closed and loudly rather than leaking.
 */
const tenantFilter = (scopeOrTenantId, alias = null) => {
  const scope = toScope(scopeOrTenantId);
  const tenantIds = normaliseTenantIds(scope.tenantIds);

  if (tenantIds.length === 0) {
    throw new Error(
      "tenantFilter: refusing to build an unscoped query — the data scope resolved to no business."
    );
  }

  const column = alias ? `${alias}.tenant_id` : "tenant_id";

  // mysql2 expands a nested array into the IN list, so params is [[1,2,3]].
  return { sql: `${column} IN (?)`, params: [tenantIds] };
};

/**
 * The single tenant id of a single-business scope.
 *
 * For the code paths that genuinely cannot be consolidated — writes, and reads
 * whose result is meaningless across businesses. Throws in All Businesses mode,
 * which is a programming error: such routes are gated by requiresSingleBusiness
 * long before a service is reached, so reaching here means the gate is missing.
 */
const assertSingleBusiness = (scopeOrTenantId) => {
  const scope = toScope(scopeOrTenantId);
  const tenantIds = normaliseTenantIds(scope.tenantIds);

  if (tenantIds.length !== 1) {
    throw new Error(
      `assertSingleBusiness: this operation requires exactly one business, got ${tenantIds.length}. ` +
        "The route is missing the requiresSingleBusiness guard."
    );
  }

  return tenantIds[0];
};

/** True when the scope spans more than one business. */
const isConsolidated = (scopeOrTenantId) => toScope(scopeOrTenantId).mode === "all";

module.exports = {
  tenantFilter,
  assertSingleBusiness,
  isConsolidated,
  normaliseTenantIds,
};
