/**
 * Business scope preference — Enterprise "All Businesses" mode.
 *
 * A Business Group Owner can view one business at a time (the default, unchanged
 * behaviour) or consolidate every business in their group. Which of the two is
 * selected is a UI preference, so it lives in localStorage rather than the
 * database — see the Enterprise plan.
 *
 * Deliberately its own key rather than a field on the cached user object:
 * `saveUserDetailsInLocalStorage` is rewritten wholesale on login, refresh and
 * business switch, and would otherwise silently drop the selection.
 *
 * SECURITY: this is a request for a mode, never an entitlement. The backend
 * re-derives which businesses the caller may actually see from their own
 * business group on every request (`resolveDataScope`), so tampering with this
 * value can only ever produce a 403.
 */
import { getUserDetailsInLocalStorage } from "./UserDetails";

const KEY = "restroprosaas_business_scope";

export const SCOPE_ALL = "all";
export const SCOPE_TENANT = "tenant";

const GROUP_OWNER_ROLE = "group_owner";

/**
 * Group-owner powers are a CAPABILITY, not a role.
 *
 * Two kinds of user hold it:
 *  - a DEDICATED owner (role 'group_owner', no business of their own);
 *  - a dual-role Business Admin (role 'admin') who has been assigned to a
 *    group — they keep full admin rights over their own business and gain
 *    group-owner rights across the group's other businesses.
 *
 * `business_group_id` comes back on the signed-in user, so it is the signal.
 * Checking the role alone would hide the Business Switcher from every dual-role
 * admin — which is exactly what happened before this was centralised here.
 */
export function hasGroupOwnerCapability(user = getUserDetailsInLocalStorage()) {
  return Boolean(user?.business_group_id) || user?.role === GROUP_OWNER_ROLE;
}

/** True only for an account that exists solely to own a group. */
export function isDedicatedGroupOwner(user = getUserDetailsInLocalStorage()) {
  return user?.role === GROUP_OWNER_ROLE;
}

/**
 * Current scope: "all" | "tenant".
 *
 * With nothing stored, a DEDICATED owner defaults to "all" — the consolidated
 * view is the whole point of that account. A dual-role Business Admin defaults
 * to "tenant": they are primarily the administrator of their own business, so
 * landing them in a consolidated view (where their own operational modules are
 * gated) would be surprising. Everyone else is always "tenant".
 *
 * The argument is ignored and kept only so existing call sites still compile;
 * the capability is read from the cached user so no caller can get it wrong.
 */
export function getBusinessScope() {
  const stored = localStorage.getItem(KEY);

  if (stored === SCOPE_ALL || stored === SCOPE_TENANT) {
    return stored;
  }

  return isDedicatedGroupOwner() ? SCOPE_ALL : SCOPE_TENANT;
}

export function saveBusinessScope(scope) {
  if (scope !== SCOPE_ALL && scope !== SCOPE_TENANT) return;
  localStorage.setItem(KEY, scope);
}

export function clearBusinessScope() {
  localStorage.removeItem(KEY);
}

/**
 * True when the UI should render consolidated, multi-business views.
 *
 * Capability-based, so it is correct for a dual-role Business Admin too. The
 * argument is ignored and kept only for existing call sites.
 */
export function isAllBusinessesScope() {
  return hasGroupOwnerCapability() && getBusinessScope() === SCOPE_ALL;
}

/**
 * True when a failed API response means "this module needs one business
 * selected" rather than a genuine error.
 *
 * The backend signals it with HTTP 409 and an explicit `requiresSingleBusiness`
 * flag (see data_scope.middleware). The flag is the contract; the status is only
 * a fallback for a response body that did not survive a proxy.
 *
 * Deliberately does NOT match 403. A read-only Business Group Owner attempting
 * a write also gets 403, and telling them to "select a business" would send them
 * chasing a scope problem when the real answer is that their permission level
 * does not allow the action.
 */
export function isBusinessRequiredError(error) {
  const response = error?.response;
  if (!response) return false;

  if (response.data?.requiresSingleBusiness === true) return true;

  return response.status === 409;
}
