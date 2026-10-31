import { Navigate } from "react-router-dom";
import { getUserDetailsInLocalStorage } from "./UserDetails";
import { PLAN_FEATURES, ROLES, hasFullBusinessAccess } from "../config/scopes";

const ScopeProtectedRoute = ({ children, scopes }) => {
  const user = getUserDetailsInLocalStorage() || {};
  const role = user?.role;

  // Super Admin, Business Admin, and Business Group Owner have full access to dashboard modules.
  // They are never blocked by per-user scopes or plan feature omissions.
  if (role === "superadmin" || role === ROLES.ADMIN || hasFullBusinessAccess(role)) {
    return children;
  }

  const isActive = user?.is_active == 1 || user?.is_active === true;
  if (!isActive) return <Navigate to="/dashboard/inactive-subscription" replace />;

  const rawFeatures = Array.isArray(user?.planFeautures)
    ? user?.planFeautures
    : (typeof user?.planFeautures === "string" ? (() => {
        try {
          const parsed = JSON.parse(user.planFeautures);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return user.planFeautures.split(",").map(s => s.trim());
        }
      })() : []);

  // Guarantee access for active tenants if no restricted plan is assigned
  const userPlanFeatures = rawFeatures.length > 0 ? rawFeatures : Object.values(PLAN_FEATURES);

  // check plan scopes
  const hasPlanAccess = !scopes || scopes?.some((scope)=> userPlanFeatures?.includes(scope));

  if(!hasPlanAccess){
    return <Navigate to="/no-access" replace />
  }

  if(!scopes) {
    return children;
  }

  const userScopes = Array.isArray(user.scope)
    ? user.scope
    : (user.scope ? String(user.scope).split(",").map(s => s.trim()) : []);

  // check scopes
  const hasAccess = scopes?.some((scope)=>userScopes?.includes(scope));

  if(hasAccess) {
    return children;
  }

  return <Navigate to="/no-access" replace />;
};

export default ScopeProtectedRoute;
