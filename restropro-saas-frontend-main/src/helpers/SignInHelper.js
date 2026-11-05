import { SCOPES } from "../config/scopes";

/** Shape the sign-in response user the way the rest of the app expects it. */
export const parseUser = (resultUser) => ({
  ...resultUser,
  planFeautures: resultUser.features ? JSON.parse(resultUser.features) : null,
  features_description: resultUser.features_description
    ? JSON.parse(resultUser.features_description)
    : null,
});

/** First page after signing in, by role and scope. */
export function getHomePathForUser(user) {
  if (!user) return "/login";
  const { role, scope } = user;
  if (role === "superadmin") return "/superadmin/dashboard/home";
  // A Business Group Owner has no per-user scope string (their access comes
  // from the business group), so they route like an admin.
  if (role === "admin" || role === "group_owner") return "/dashboard/home";
  const userScopes = scope?.split(",") || [];
  return userScopes.includes(SCOPES.DASHBOARD) ? "/dashboard/home" : "/dashboard/profile";
}

/** `?next=` target after sign-in: only paths inside this app. */
export function getSafeNextPath(search) {
  const next = new URLSearchParams(search).get("next") || "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;
}

/** The Bong POS desktop app (Electron) exposes window.bongDesktop. */
export function getDesktopBridge() {
  return typeof window !== "undefined" && window.bongDesktop?.isDesktop ? window.bongDesktop : null;
}
