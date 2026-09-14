/**
 * Data scope resolution — Enterprise "All Businesses" mode.
 *
 * Runs at the tail of the authentication chain and attaches exactly one new
 * property to the request:
 *
 *   req.dataScope = { mode, tenantIds, businessGroupId, businessNames }
 *
 * It NEVER modifies req.user.tenant_id. Single-business behaviour — for Business
 * Admins, Staff, and a group owner who has an individual business selected — is
 * therefore byte-for-byte unchanged, because nothing that exists today reads
 * req.dataScope.
 *
 * Trust boundary: the client may ask for a MODE. It may never supply the
 * businesses. `tenantIds` is always read from the database via the caller's own
 * business group, so a tampered request cannot widen what it can see.
 */
const { ROLES } = require("../config/user.config");
const {
  getBusinessesForGroupOwnerDB,
} = require("../services/business_group.service");

const SCOPE_ALL = "all";
const SCOPE_TENANT = "tenant";

/**
 * Route prefixes proven to consolidate correctly.
 *
 * This list is the safety mechanism of the whole feature. Because
 * req.user.tenant_id stays populated in All Businesses mode, a module that has
 * NOT been migrated would happily answer with a single business's data while the
 * UI is labelled "All Businesses" — silently wrong numbers, which is worse than
 * an error. So anything not listed here is refused outright while consolidated.
 *
 * Two kinds of route are absent, and both must stay refused:
 *   - operational modules that must never consolidate (POS, Kitchen, Menu,
 *     Settings, ...) — permanently absent by design;
 *   - modules not yet migrated (Reports, Invoices, Customers, ...) — each is
 *     added here in the phase that converts its service.
 *
 * `/api/v1/auth` is present because the session endpoints (my-businesses,
 * refresh, signout) must stay reachable in either mode; they carry no business
 * data of their own.
 */
const CONSOLIDATION_ALLOWED_PREFIXES = [
  "/api/v1/auth",
  "/api/v1/dashboard",
  // Phase 2. The module as a whole consolidates, but individual operational
  // reports (per-table, per-kitchen, per-shift) still refuse — that finer
  // decision needs the report id, so reports.service makes it and throws 409
  // with the same contract this middleware uses.
  "/api/v1/reports",
  // Phase 4. The list, CSV download and search consolidate; everything keyed by
  // a phone number (single customer, insights, invoices) and every write is
  // mounted with `requiresSingleBusiness` on its own route, because a phone is
  // unique per business rather than across a group.
  "/api/v1/customers",
  // Phase 5. Invoices are READ-ONLY here by construction: the module exposes no
  // edit/delete/void/refund endpoint at all (invoices are created by the orders
  // module, which is not on this list). Ownership, numbering and the per-tenant
  // `invoice_sequences` are untouched — consolidating is purely a view.
  "/api/v1/invoices",
  "/api/v1/invoice-audit-logs",
  // Phase 6. All three feedback routes are reads; the module has no write
  // endpoint at all (reviews are submitted through the PUBLIC /qrmenu feedback
  // route, which is not on this list). Ratings, ownership and review history are
  // untouched — consolidating is purely a view.
  "/api/v1/feedback",
  // Phase 7. The list, search and init consolidate. Every operational write —
  // create, edit, cancel, delete — carries `requiresSingleBusiness` on its own
  // route and answers 409 while consolidating, so reservation management stays
  // single-business and ownership never moves.
  "/api/v1/reservations",
  // Phase 8 — summary only. Reads consolidate; every write (add/edit/delete an
  // item, any stock movement, and all user management) carries
  // `requiresSingleBusiness` on its own route and answers 409 while
  // consolidating. There is no cross-business CRUD.
  "/api/v1/inventory",
  "/api/v1/users",
];

const isConsolidationAllowed = (path) =>
  CONSOLIDATION_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));

/** Full request path without the query string, matching auth.middleware's form. */
const requestPath = (req) =>
  req.baseUrl ? `${req.baseUrl}${req.path}` : req.originalUrl.split("?")[0];

/** A single-business scope — the default for every role except a group owner in all mode. */
const singleBusinessScope = (tenantId, businessGroupId = null) => ({
  mode: SCOPE_TENANT,
  tenantIds: tenantId ? [Number(tenantId)] : [],
  businessGroupId,
  businessNames: {},
});

/**
 * Resolve req.dataScope for the authenticated caller.
 *
 * Called from auth.middleware at the end of both paths (regular users and, after
 * verifyGroupOwnerScope has done its checks, group owners), so it sees a request
 * whose identity is already verified against the database.
 */
const resolveDataScope = async (req, res, next) => {
  try {
    const requestedAll = String(req.query?.scope || "").toLowerCase() === SCOPE_ALL;
    // CAPABILITY, not role. `req.groupOwner` is set by verifyGroupOwnerScope for
    // a dedicated owner AND for a Business Admin who also holds group-owner
    // capability; its businessGroupId was resolved from the database, never the
    // token. Keying on the role alone would deny a dual-role admin.
    const isGroupOwner =
      Boolean(req.groupOwner?.businessGroupId) || req.user?.role === ROLES.GROUP_OWNER;

    // Default for everyone: the tenant already resolved by the auth chain.
    if (!requestedAll) {
      req.dataScope = singleBusinessScope(
        req.user?.tenant_id,
        req.groupOwner?.businessGroupId ?? null,
      );
      return next();
    }

    // From here the caller explicitly asked to consolidate.
    //
    // Only a Business Group Owner may. Business Admins and Staff are refused
    // rather than silently downgraded, so a client that wrongly sends scope=all
    // fails loudly in development instead of shipping a mislabelled screen.
    if (!isGroupOwner) {
      return res.status(403).json({
        success: false,
        message: req.__("operation_not_allowed"),
      });
    }

    const businessGroupId = req.groupOwner?.businessGroupId;

    if (!businessGroupId) {
      return res.status(403).json({
        success: false,
        message: req.__("operation_not_allowed"),
      });
    }

    // THE authorisation boundary: the businesses come from the owner's own group
    // as stored in the database — never from the request.
    //
    // Group-only ON PURPOSE. A dual-role Business Admin can still reach their
    // OWN business when it has been unlinked (see getAccessibleBusinessesForUserDB),
    // but consolidating must aggregate the GROUP, so an unlinked own business is
    // deliberately excluded from these totals.
    const businesses = await getBusinessesForGroupOwnerDB(businessGroupId);

    // A group whose businesses have all been unlinked has nothing to
    // consolidate. `tenantFilter` refuses to build an unscoped query, so answer
    // the same "pick a business" 409 the gate uses rather than surfacing a 500.
    if (businesses.length === 0) {
      return res.status(409).json({
        success: false,
        requiresSingleBusiness: true,
        message: req.__("select_single_business_required"),
      });
    }

    req.dataScope = {
      mode: SCOPE_ALL,
      tenantIds: businesses.map((b) => Number(b.id)),
      businessGroupId,
      businessNames: Object.fromEntries(businesses.map((b) => [b.id, b.name])),
    };

    // The module must be known to consolidate correctly — see the allow-list.
    if (!isConsolidationAllowed(requestPath(req))) {
      return res.status(409).json({
        success: false,
        requiresSingleBusiness: true,
        message: req.__("select_single_business_required"),
      });
    }

    return next();
  } catch (error) {
    console.error("[dataScope] resolution failed:", error);
    // Fail closed: never continue with an unresolved or partial scope.
    return res.status(403).json({
      success: false,
      message: req.__("operation_not_allowed"),
    });
  }
};

/**
 * Route guard for modules that perform live operational actions and must always
 * act on exactly one business (POS, Kitchen Display, Menu, Tables, Print, Tax,
 * Payment Types, Store Details, Recipes, QR Menu Config).
 *
 * resolveDataScope's allow-list already refuses these, since they are not on it.
 * Mounting this explicitly on such a route states the requirement locally and
 * keeps it enforced even if the route is later moved under an allowed prefix.
 */
const requiresSingleBusiness = (req, res, next) => {
  if (req.dataScope?.mode === SCOPE_ALL) {
    return res.status(409).json({
      success: false,
      requiresSingleBusiness: true,
      message: req.__("select_single_business_required"),
    });
  }
  return next();
};

module.exports = {
  resolveDataScope,
  requiresSingleBusiness,
  isConsolidationAllowed,
  CONSOLIDATION_ALLOWED_PREFIXES,
  SCOPE_ALL,
  SCOPE_TENANT,
};
