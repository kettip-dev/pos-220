import { Navigate } from "react-router-dom";
import { getUserDetailsInLocalStorage } from "./UserDetails";
import { PLAN_FEATURES, hasFullBusinessAccess } from "../config/scopes";

const ScopeProtectedRoute = ({ children, scopes }) => {
  const user = getUserDetailsInLocalStorage();
  const role = user.role;
  const rawFeatures = Array.isArray(user?.planFeautures)
    ? user?.planFeautures
    : user?.planFeautures?.split(",") || [];

  const isActive = user?.is_active == 1 || user?.is_active === true;

  if(!isActive) return <Navigate to="/dashboard/inactive-subscription" replace />

  // Guarantee access for active tenants if no restricted plan is assigned
  const userPlanFeatures = rawFeatures.length > 0 ? rawFeatures : Object.values(PLAN_FEATURES);

  // check plan scopes
  const hasPlanAccess = !scopes || scopes?.some((scope)=> userPlanFeatures?.includes(scope));

  if(!hasPlanAccess){
    return <Navigate to="/no-access" replace />
  }
  
  // Business Admins and Business Group Owners are not scope-limited. An owner
  // has no `scope` string at all, so without this they would be redirected to
  // /no-access on every route.
  if(hasFullBusinessAccess(role)) {
    return children;
  }

  if(!scopes) {
    return children;
  }

  const userScopes = new String(user.scope).split(",");

  // check scopes
  const hasAccess = scopes?.some((scope)=>userScopes?.includes(scope));

  if(hasAccess) {
    return children;
  }

  return <Navigate to="/no-access" replace />;
};

export default ScopeProtectedRoute;
