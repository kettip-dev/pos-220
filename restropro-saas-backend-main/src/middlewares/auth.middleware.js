const { getUserDB } = require("../services/user.service");
const { verifyToken, generateAccessToken, generateRefreshToken } = require("../utils/jwt");
const { ROLES, GROUP_PERMISSION_LEVELS } = require("../config/user.config");
const { getAdminUserDB } = require("../services/superadmin.service");
const { getTenantById, addRefreshTokenDB, getGroupOwnerAuthContextDB } = require("../services/auth.service");
const { ensureGroupOwnerActiveBusinessDB, getUnionPlanFeaturesForGroupDB } = require("../services/business_group.service");
const { resolveDataScope } = require("./data_scope.middleware");
const { CONFIG } = require("../config");

exports.isLoggedIn = (req, res, next) => {
    let token;
   

    if(req.cookies.accessToken || 
        (req.headers.authorization && req.headers.authorization.startsWith('Bearer'))
    ) {
        token = req.cookies.accessToken || req.headers.authorization.split(" ")[1];
    }

    if(!token) {
        return res.status(401).json({
            success: false,
            message: req.__("login_again_to_access")
        });
    }
    req.token = token;
    next();
} 

exports.isAuthenticated = async (req, res, next) => {
  try {
    const accessToken = req.token || req.cookies.accessToken;
    if (!accessToken) throw new Error("No token");

    let decoded = verifyToken(accessToken);  
    
    // if(decoded.tenant_id){
    //      const tenant = await getTenantById(decoded.tenant_id);
    //     if (!tenant) throw new Error("Tenant not found");

    //     if (decoded.tokenVersion !== tenant.token_version) {
    //       throw new Error("Token version mismatch");
    //     }
    // }
    
   

    // if(decoded.tenant_id) {
    //     const tenant = await getTenantById(decoded.tenant_id);
    //     if (!tenant) throw new Error("Tenant not found");

    //     console.log('Token version:', decoded.tokenVersion, 'Tenant token version:', tenant.token_version);
    //     // 🔄 Token outdated → refresh silently
    //     if (decoded.tokenVersion !== tenant.token_version) {
    //       const user = await getUserDB(decoded.username, decoded.tenant_id);

    //       const payload = {
    //         tenant_id: user.tenant_id,
    //         username: user.username,
    //         name: user.name,
    //         role: user.role,
    //         is_active: user.is_active,
    //         tokenVersion: tenant.token_version,
    //       };

    //       const newAccessToken = generateAccessToken(payload);
    //       const newRefreshToken = generateRefreshToken(payload);

    //       console.log(newAccessToken);
    //       console.log("refreshtoken",newRefreshToken);

    //       const cookieOptions = {
    //         expires: new Date(Date.now() + Number(CONFIG.COOKIE_EXPIRY)),
    //         httpOnly: true,
    //         domain: CONFIG.FRONTEND_DOMAIN_COOKIE,
    //         sameSite: false,
    //         secure: process.env.NODE_ENV === "production",
    //         path: "/",
    //       };


    //       const refreshTokenExpiry = new Date(
    //         Date.now() + Number(CONFIG.COOKIE_EXPIRY_REFRESH)
    //       );



    //       res.cookie("accessToken", newAccessToken, cookieOptions);
    //       res.cookie("refreshToken", newRefreshToken, {
    //         ...cookieOptions,
    //         expires: refreshTokenExpiry,
    //       });

    //       const deviceIP = req.connection.remoteAddress;
    //       const deviceName = `${deviceDetails.platform}\nBrowser: ${deviceDetails.browser}`;
    //       const deviceLocation = "";
    //       await addRefreshTokenDB(user.username, newRefreshToken, refreshTokenExpiry, deviceIP, deviceName, deviceLocation, user.tenant_id);

    //       // ✅ update decoded user
    //       req.user = payload;
    //       return next();
    //     }
    // }
    req.user = decoded;

    // Business Group Owner — now a CAPABILITY, not a role.
    //
    // Taken by a dedicated owner (role='group_owner') AND by a Business Admin
    // who has been assigned to a group, who keeps role='admin' and their home
    // business. `business_group_id` is issued in the token at sign-in; a user
    // without it (every ordinary admin and staff member) skips this entirely,
    // so their auth is byte-for-byte unchanged and costs no extra query.
    //
    // An older token minted before this claim existed simply lacks it: such a
    // user keeps their previous behaviour until they next sign in, which fails
    // closed rather than open.
    if (decoded.role === ROLES.GROUP_OWNER || decoded.business_group_id) {
      return verifyGroupOwnerScope(req, res, next);
    }

    // Attaches req.dataScope only. req.user.tenant_id is left exactly as it is,
    // so every existing tenant-scoped code path is unaffected.
    return resolveDataScope(req, res, next);
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: req.__("operation_not_allowed"),
    });
  }
};

/* ==========================================================================
 * Business Group Owner scope enforcement (Phase 2)
 * ========================================================================== */

// Auth endpoints a group owner must always reach, even before a business is
// selected and even when they are read-only. Matched against the path only.
const GROUP_OWNER_ALWAYS_ALLOWED_PATHS = [
    "/api/v1/auth/signout",
    "/api/v1/auth/refresh-token",
    "/api/v1/auth/switch-business",
    "/api/v1/auth/my-businesses",
];

// Methods that cannot change state.
//
// This is the WHOLE read-only rule: a read-only group owner may read anything
// their businesses expose and write nothing. Settings and user management were
// previously blocked outright, even for GET — that carve-out was removed
// (2026-07-31, on the project owner's direction) because it contradicted the
// "Read Only" vs "Read + Write" choice the Super Admin UI offers, and because
// every other module already meant "view but not edit".
//
// Reads there expose no secrets: GET /users returns username, name, role,
// photo, designation, phone, email and scope (never the password hash), and
// the settings reads are store/print configuration, taxes, payment type names,
// tables and categories — no gateway credentials, which live behind
// isSuperAdmin. Business group management remains Super Admin only.
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

/**
 * Runs on EVERY authenticated group-owner request. Resolves the owner from the
 * database — never from the JWT alone — and enforces three things:
 *
 *   1. The user really is a group owner with a group. A demoted or orphaned
 *      owner (business_group_id NULL) is denied outright.
 *   2. The active business in the token still belongs to that group. This is
 *      re-checked per request so unlinking a business immediately revokes
 *      access, without waiting for the token to expire.
 *   3. Read-only owners cannot perform writes, and cannot reach settings or
 *      user management at all.
 *
 * On success req.groupOwner carries the verified context for downstream use.
 * Any failure denies the request — the middleware never widens access.
 */
const verifyGroupOwnerScope = async (req, res, next) => {
    try {
        const { username } = req.user;
        const path = req.baseUrl ? `${req.baseUrl}${req.path}` : req.originalUrl.split("?")[0];

        // Signing out must ALWAYS succeed, even for an account that has just been
        // deleted or deactivated. It performs no business action — it only clears
        // the session — and blocking it would trap the client with stale
        // credentials it can never clean up.
        if (path === "/api/v1/auth/signout") {
            return next();
        }

        // Authoritative role/group/permission/status straight from the database,
        // so a tampered or stale token cannot claim a group or permission level.
        const owner = await getGroupOwnerAuthContextDB(username);

        if (!owner || !owner.business_group_id) {
            // The token still claims group_owner but the database disagrees: the
            // user was removed from the group, demoted, or their group was
            // deleted. That makes the SESSION invalid rather than the action
            // unauthorised, so answer 401 + loginNeeded. The client's refresh
            // attempt then fails the same way, cookies are cleared and the user
            // is sent to the login screen instead of looping on failed requests.
            return res.status(401).json({
                success: false,
                loginNeeded: true,
                message: req.__("login_again_to_access"),
            });
        }

        const permissionLevel =
            owner.group_permission_level || GROUP_PERMISSION_LEVELS.READ;

        // Active business, resolved from the database rather than the token. If
        // the stored selection is missing or was unlinked from the group, fall
        // back to another business in the group instead of stranding the owner.
        let activeTenantId = owner.tenant_id || null;
        let activeContext = owner;

        if (!activeTenantId) {
            const resolvedTenantId = await ensureGroupOwnerActiveBusinessDB(username);

            if (resolvedTenantId) {
                // Re-read so plan features and subscription status belong to the
                // business we actually ended up on.
                const repaired = await getGroupOwnerAuthContextDB(username);
                if (repaired?.tenant_id) {
                    activeTenantId = repaired.tenant_id;
                    activeContext = repaired;
                }
            }
        }

        // DUAL ROLE: a Business Admin who also holds group-owner capability is
        // acting as the ADMIN of their own business, and as a group owner
        // everywhere else.
        //
        //   own business selected      -> full Business Admin rights
        //   another group business     -> group_permission_level applies
        //   All Businesses (scope=all) -> group_permission_level applies, since
        //                                 the request spans businesses they do
        //                                 not administer
        //
        // A dedicated owner has home_tenant_id NULL, so this is never true for
        // them and their behaviour is unchanged.
        const homeTenantId = owner.home_tenant_id ?? null;
        const isConsolidating = String(req.query?.scope || "").toLowerCase() === "all";
        const isOwnBusiness =
            homeTenantId != null &&
            activeTenantId != null &&
            Number(homeTenantId) === Number(activeTenantId) &&
            !isConsolidating;

        // Inside their own business the group permission level must not apply —
        // a "read-only" group owner is still the full administrator of the
        // business they actually own.
        const effectivePermissionLevel = isOwnBusiness
            ? GROUP_PERMISSION_LEVELS.WRITE
            : permissionLevel;

        // Plan features gating what modules/nav a group owner can reach.
        //
        //   single business selected  -> that business's own plan, unchanged
        //   All Businesses (scope=all) -> the UNION of every business in the
        //                                 group's plan. Gating on only the
        //                                 last-active business's plan while
        //                                 consolidated would hide a feature
        //                                 another business in the group grants,
        //                                 even though its data is genuinely
        //                                 being shown in that consolidated view.
        const planFeatures = isConsolidating
            ? await getUnionPlanFeaturesForGroupDB(owner.business_group_id)
            : activeContext.planFeatures || [];

        req.groupOwner = {
            username: owner.username,
            businessGroupId: owner.business_group_id,
            businessGroupName: owner.business_group_name,
            permissionLevel: effectivePermissionLevel,
            // The level configured on the group, regardless of which business is
            // selected — what the Super Admin UI shows.
            groupPermissionLevel: permissionLevel,
            homeTenantId,
            isOwnBusiness,
            // Stashed here so authorize() does not repeat the query.
            planFeatures,
            activeTenantId,
        };

        // Keep the request's identity in sync with the database rather than the
        // token, so a permission change takes effect on the next request.
        req.user.business_group_id = owner.business_group_id;
        req.user.permission_level = effectivePermissionLevel;

        // The active business is injected here so every existing controller —
        // which all read req.user.tenant_id — scopes itself to the selected
        // business with no changes of its own. It is deliberately absent from the
        // JWT, so this is the only place it enters the request.
        req.user.tenant_id = activeTenantId;
        req.user.is_active = activeContext.is_active ?? null;

        const isAlwaysAllowed = GROUP_OWNER_ALWAYS_ALLOWED_PATHS.includes(path);

        // A read-only owner may read every module their businesses expose, and
        // write to none of them. Enforced by method alone, so the rule is the
        // same everywhere and no module can drift out of it.
        if (
            effectivePermissionLevel === GROUP_PERMISSION_LEVELS.READ &&
            !isAlwaysAllowed &&
            !SAFE_METHODS.includes(req.method)
        ) {
            return res.status(403).json({
                success: false,
                message: req.__("group_owner_read_only_access"),
            });
        }

        if (isAlwaysAllowed) {
            return resolveDataScope(req, res, next);
        }

        // Every other request acts on a business. getGroupOwnerAuthContextDB only
        // joins the tenant when it is inside the owner's group, and the fallback
        // above already tried to find one, so a NULL here means the group has no
        // business this owner can act on.
        if (!activeTenantId) {
            return res.status(403).json({
                success: false,
                message: req.__("no_business_selected"),
            });
        }

        // Resolves req.dataScope — including the All Businesses case, which is
        // authorised there against this owner's group. req.user.tenant_id keeps
        // the individual business selected above in either mode.
        return resolveDataScope(req, res, next);
    } catch (error) {
        console.error(error);
        // Fail closed: never fall through to the tenant-scoped path on error.
        return res.status(403).json({
            success: false,
            message: req.__("operation_not_allowed"),
        });
    }
};

exports.verifyGroupOwnerScope = verifyGroupOwnerScope;

/**
 * Route guard for endpoints only a Super Admin or a Business Group Owner may
 * reach (currently /auth/switch-business and /auth/my-businesses). Business
 * Admins and Staff get 403, so they can never see the Business Switcher data.
 */
exports.isGroupOwnerOrSuperAdmin = async (req, res, next) => {
    try {
        // Capability, not role — a dual-role Business Admin must be able to
        // list and switch between the group's businesses too. req.groupOwner is
        // set by verifyGroupOwnerScope from the DATABASE, so this cannot be
        // spoofed by a token claim.
        if (req.user?.role === ROLES.GROUP_OWNER || req.groupOwner?.businessGroupId) {
            return next();
        }

        // Super Admins live in their own table; presence there is the check.
        const superAdmin = await getAdminUserDB(req.user?.username);
        if (superAdmin) {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: req.__("operation_not_allowed"),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later"),
        });
    }
};


exports.isSubscriptionActive = async (req, res, next) => {
    const user = req.user;

    // Fetch fresh tenant/subscription info
    const tenant = await getTenantById(user.tenant_id);
    if(tenant?.is_active == 1) {
        return next();
    } else {
        return res.status(402).json({
            success: false,
            message: req.__("subscription_cancelled_no_longer_charged")
        });
    }
};

exports.hasRefreshToken = (req, res, next) => {
    const token =
        req.cookies.refreshToken ||
        req.headers["x-refresh-token"] ||
        req.body?.refreshToken;

    if(!token) {
        return res.status(401).json({
            success: false,
            message: req.__("login_again_to_access")
        });
    }
    try {
        const decodedToken = verifyToken(token);
        req.user = decodedToken;
        req.refreshToken = token;

        next();
    } catch (error) {
        console.error(error);

        res.clearCookie('accessToken',{
            expires: new Date(Date.now() ),
            httpOnly: true,
            domain: CONFIG.FRONTEND_DOMAIN_COOKIE,
            sameSite: false,
            secure: process.env.NODE_ENV == "production",
            path: "/"
        });
        res.clearCookie('refreshToken', {
            expires: new Date(Date.now()),
            httpOnly: true,
            domain: CONFIG.FRONTEND_DOMAIN_COOKIE,
            sameSite: false,
            secure: process.env.NODE_ENV == "production",
            path: "/"
        }); 
        res.clearCookie('restro__authenticated', {
            expires: new Date(Date.now()),
            domain: CONFIG.FRONTEND_DOMAIN_COOKIE,
            sameSite: false,
            secure: process.env.NODE_ENV == "production",
            path: "/"
        });

        return res.status(401).json({
            success: false,
            message: req.__("operation_not_allowed")
        });
    }
} 

exports.authorize = (requiredScopes) => {
    return async (req, res, next) => {
        try {
            // const {username, scope: userScopes, tenant_id} = req.user;
            const {username,  tenant_id, planFeatures,  scope: userScopes} = req.user;

            // Business Group Owner (Phase 2): resolved and verified already by
            // verifyGroupOwnerScope, which also confirmed the active business is
            // inside the owner's group. The owner acts with full scope within
            // that business — like its admin — but is still bound by that
            // business's own plan features. Read/write is enforced centrally in
            // verifyGroupOwnerScope, so there is nothing extra to check here.
            // Capability, not role: this covers a dedicated group owner AND a
            // Business Admin who also holds group-owner capability.
            //
            // It must run for the dual-role case even on their OWN business,
            // because verifyGroupOwnerScope has already repointed
            // req.user.tenant_id at the selected business — the normal path
            // below would look the user up with getUserDB(username, tenant_id)
            // and find nothing whenever a business other than their own is
            // selected, denying them outright.
            //
            // The check applied here (the selected business's plan features,
            // then allow) is exactly what an admin receives on the normal path,
            // so the user's own business behaves identically to before.
            if (req.groupOwner) {
                const ownerPlanScopes = req.groupOwner.planFeatures || [];
                const ownerHasAccess = requiredScopes.some((scope) => ownerPlanScopes.includes(scope));

                if (!ownerHasAccess) {
                    return res.status(403).json({
                        success: false,
                        message: req.__("operation_not_allowed")
                    });
                }

                return next();
            }

            const user = await getUserDB(username, tenant_id);
            console.log("User fetched for authorization:", user.plan_features);


            // const isSame =
            //   Array.isArray(user.plan_features) &&
            //   Array.isArray(planFeatures) &&
            //   user.plan_features.length === planFeatures.length &&
            //   user.plan_features.every((f, i) => f === planFeatures[i]);

            // if (!isSame) {
            //   return res.status(403).json({
            //     success: false,
            //     message: req.__("operation_not_allowed"),
            //   });
            // }

            const userPlanScopesArr = user?.plan_features || [];
            // const userScopes = user?.scope || "";

            const hasAccess = requiredScopes.some((scope)=> userPlanScopesArr.includes(scope));

            if(!hasAccess) {
                return res.status(403).json({
                    success: false, 
                    message: req.__("operation_not_allowed")
                });
            }

            if(!user) {
                return res.status(401).json({
                    success: false, 
                    message: req.__("operation_not_allowed")
                });
            }

            if(user.role == ROLES.ADMIN) {
                return next();
            }

            // const isSameScope =
            //   user.scope?.length === userScopes?.length &&
            //   user.scope.every(s => userScopes.includes(s));

            // if (!isSameScope) {
            //   return res.status(403).json({
            //     success: false,
            //     message: req.__("operation_not_allowed"),
            //   });
            // }

            const userScopesArr = user?.scope?.split(",")?.map(s=>s.trim());

            const isOperationAllowed = requiredScopes.some((scope)=>userScopesArr.includes(scope));

            if(!isOperationAllowed) {
                return res.status(403).json({
                    success: false, 
                    message: req.__("operation_not_allowed")
                });
            }
            next();

        } catch (error) {
            console.error(error);
            return res.status(500).json({
                success: false,
                message: req.__("something_went_wrong_try_later")
            });
        }
    };
}

exports.isSuperAdmin = async (req, res, next) => {
    try {
        const {username, role} = req.user;
    
        const user = await getAdminUserDB(username);

        if(!user) {
            return res.status(401).json({
                success: false, 
                message: req.__("operation_not_allowed")
            });
        }

        next();

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: req.__("something_went_wrong_try_later")
        });
    }
}
