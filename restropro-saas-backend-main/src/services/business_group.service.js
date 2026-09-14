const {
  getMySqlPromiseConnection,
} = require("../config/mysql.db");

/**
 * Business Groups (Phase 1) — Super Admin only.
 *
 * A business group is a purely organisational grouping of independent tenants.
 * Membership lives on `tenants.business_group_id` (nullable), so a business
 * belongs to at most one group and a group holds many businesses.
 *
 * Nothing here touches tenant isolation: no query in this file reads or writes
 * a tenant's operational data (orders, menu, inventory, settings, billing).
 */

/**
 * Paginated list of groups with their member count.
 * `search` matches group name or description.
 */
exports.getBusinessGroupsDB = async (page, perPage, search) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const currentPage = parseInt(page) || 1;
    const limit = parseInt(perPage) || 10;
    const offset = (currentPage - 1) * limit;

    let query = `
        SELECT
            bg.id,
            bg.name,
            bg.description,
            bg.created_by,
            bg.created_at,
            bg.updated_at,
            COUNT(t.id) AS businesses_count
        FROM business_groups bg
        LEFT JOIN tenants t ON t.business_group_id = bg.id
        WHERE 1=1
    `;
    const queryParams = [];

    if (search) {
      query += ` AND (bg.name LIKE ? OR bg.description LIKE ?)`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    query += `
        GROUP BY bg.id
        ORDER BY bg.id DESC
        LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    const [groups] = await conn.query(query, queryParams);

    return {
      groups,
      currentPage,
      perPage: limit,
    };
  } catch (error) {
    console.error("Error getting business groups: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Total number of groups matching `search` — drives pagination totals.
 */
exports.getBusinessGroupsCountDB = async (search) => {
  const conn = await getMySqlPromiseConnection();
  try {
    let query = `
        SELECT COUNT(*) AS total
        FROM business_groups bg
        WHERE 1=1
    `;
    const queryParams = [];

    if (search) {
      query += ` AND (bg.name LIKE ? OR bg.description LIKE ?)`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    const [result] = await conn.query(query, queryParams);
    return result[0]?.total || 0;
  } catch (error) {
    console.error("Error counting business groups: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.getBusinessGroupByIdDB = async (groupId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
        SELECT
            bg.id,
            bg.name,
            bg.description,
            bg.created_by,
            bg.created_at,
            bg.updated_at,
            COUNT(t.id) AS businesses_count
        FROM business_groups bg
        LEFT JOIN tenants t ON t.business_group_id = bg.id
        WHERE bg.id = ?
        GROUP BY bg.id
        LIMIT 1;
    `;

    const [result] = await conn.query(sql, [groupId]);
    return result[0];
  } catch (error) {
    console.error("Error getting business group: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Case-insensitive duplicate name lookup. `excludeGroupId` lets an update keep
 * its own name. Returns the clashing row, or undefined when the name is free.
 */
exports.getBusinessGroupByNameDB = async (name, excludeGroupId = null) => {
  const conn = await getMySqlPromiseConnection();
  try {
    let sql = `
        SELECT id, name
        FROM business_groups
        WHERE name = ?
    `;
    const queryParams = [name];

    if (excludeGroupId) {
      sql += ` AND id != ?`;
      queryParams.push(excludeGroupId);
    }

    sql += ` LIMIT 1;`;

    const [result] = await conn.query(sql, queryParams);
    return result[0];
  } catch (error) {
    console.error("Error checking business group name: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.createBusinessGroupDB = async (name, description, createdBy) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
        INSERT INTO business_groups (name, description, created_by)
        VALUES (?, ?, ?);
    `;

    const [result] = await conn.query(sql, [name, description, createdBy]);

    return {
      id: result.insertId,
      name,
      description,
      created_by: createdBy,
    };
  } catch (error) {
    console.error("Error creating business group: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.updateBusinessGroupDB = async (groupId, name, description) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
        UPDATE business_groups
        SET name = ?, description = ?
        WHERE id = ?;
    `;

    await conn.query(sql, [name, description, groupId]);
  } catch (error) {
    console.error("Error updating business group: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Deletes a group WITHOUT deleting any business.
 *
 * Members are explicitly unlinked first (business_group_id -> NULL), then the
 * group row is removed, both inside one transaction. The FK's ON DELETE SET NULL
 * would do the same, but doing it explicitly keeps the intent obvious and makes
 * the "deleting a group must never delete tenants" rule enforced here, in the
 * service, rather than implied by schema config.
 *
 * The group's DEDICATED owner accounts are deleted along with it (CASCADE) —
 * they exist only to own this group. No business user is ever affected.
 *
 * Returns { unlinkedBusinesses, deletedOwners }.
 */
exports.deleteBusinessGroupDB = async (groupId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    // 1. Detach every member business — the tenants themselves survive.
    const [unlinkResult] = await conn.query(
      `UPDATE tenants SET business_group_id = NULL WHERE business_group_id = ?`,
      [groupId],
    );

    // 1b. Release group-owner CAPABILITY from anyone who is not a dedicated
    //     owner. `users.business_group_id` is ON DELETE CASCADE, which was safe
    //     when only dedicated accounts carried it — under the dual-role model a
    //     Business Admin carries it too, and deleting the group would delete
    //     their entire account. Clearing the column first puts them out of the
    //     cascade's reach; they simply stop being a group owner.
    const [releasedResult] = await conn.query(
      `UPDATE users
       SET business_group_id = NULL, group_permission_level = NULL, active_tenant_id = NULL
       WHERE business_group_id = ? AND role <> 'group_owner'`,
      [groupId],
    );

    // 2. Collect this group's dedicated owner accounts BEFORE the delete.
    //    They are removed by the business_group_id FK's ON DELETE CASCADE, but
    //    refresh_tokens has no FK to users, so those rows must be cleared here
    //    or they would be orphaned (and would keep a session alive).
    const [ownerRows] = await conn.query(
      `SELECT username FROM users WHERE business_group_id = ? AND role = 'group_owner'`,
      [groupId],
    );

    if (ownerRows.length > 0) {
      await conn.query(`DELETE FROM refresh_tokens WHERE username IN (?)`, [
        ownerRows.map((row) => row.username),
      ]);

      // 2b. Delete the DEDICATED owner accounts explicitly.
      //
      //     This used to rely on the FK's ON DELETE CASCADE, which the dual-role
      //     migration changed to SET NULL so a Business Admin can never be
      //     deleted with a group. Doing it here states the rule in code: only
      //     accounts whose sole purpose is owning this group are removed, and
      //     the `role = 'group_owner'` scope makes that impossible to widen.
      await conn.query(
        `DELETE FROM users WHERE business_group_id = ? AND role = 'group_owner'`,
        [groupId],
      );
    }

    // 3. Remove the group. Member businesses were detached in step 1, dual-role
    //    admins were released in step 1b, and dedicated owners deleted in 2b —
    //    so nothing is left for the FK to act on.
    await conn.query(`DELETE FROM business_groups WHERE id = ?`, [groupId]);

    await conn.commit();

    return {
      unlinkedBusinesses: unlinkResult.affectedRows,
      deletedOwners: ownerRows.length,
      // Business Admins who kept their account and simply lost the capability.
      releasedDualRoleOwners: releasedResult.affectedRows,
    };
  } catch (error) {
    await conn.rollback();
    console.error("Error deleting business group: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Businesses linked to a group, with the owner email, subscription window and
 * active status the Group Details table renders.
 */
exports.getBusinessesByGroupIdDB = async (groupId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
        SELECT
            t.id,
            t.name,
            t.is_active,
            t.subscription_start,
            t.subscription_end,
            t.isTrialPlan,
            t.created_at,
            u.username AS owner_email,
            u.name AS owner_name
        FROM tenants t
        LEFT JOIN users u ON u.tenant_id = t.id AND u.role = 'admin'
        WHERE t.business_group_id = ?
        ORDER BY t.name ASC;
    `;

    const [result] = await conn.query(sql, [groupId]);
    return result;
  } catch (error) {
    console.error("Error getting businesses of business group: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Businesses that can still be linked, i.e. business_group_id IS NULL.
 * Feeds the "Link Business" dropdown, which must never offer a business that
 * already belongs to a group. `search` matches business name or owner email.
 */
exports.getUnlinkedBusinessesDB = async (search) => {
  const conn = await getMySqlPromiseConnection();
  try {
    let sql = `
        SELECT
            t.id,
            t.name,
            t.is_active,
            u.username AS owner_email
        FROM tenants t
        LEFT JOIN users u ON u.tenant_id = t.id AND u.role = 'admin'
        WHERE t.business_group_id IS NULL
    `;
    const queryParams = [];

    if (search) {
      sql += ` AND (t.name LIKE ? OR u.username LIKE ?)`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY t.name ASC LIMIT 100;`;

    const [result] = await conn.query(sql, queryParams);
    return result;
  } catch (error) {
    console.error("Error getting unlinked businesses: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Minimal tenant lookup used by the link/unlink validation: proves the tenant
 * exists and reports which group (if any) currently owns it.
 */
exports.getTenantGroupInfoDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
        SELECT id, name, business_group_id
        FROM tenants
        WHERE id = ?
        LIMIT 1;
    `;

    const [result] = await conn.query(sql, [tenantId]);
    return result[0];
  } catch (error) {
    console.error("Error getting tenant group info: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Links a business into a group.
 *
 * The `business_group_id IS NULL` guard makes the write itself atomic against a
 * concurrent link: if another request grabbed this business first, affectedRows
 * is 0 and the caller reports a conflict instead of silently stealing it from
 * the other group. Returns true when the link was applied.
 */
exports.linkBusinessToGroupDB = async (groupId, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
        UPDATE tenants
        SET business_group_id = ?
        WHERE id = ? AND business_group_id IS NULL;
    `;

    const [result] = await conn.query(sql, [groupId, tenantId]);
    return result.affectedRows > 0;
  } catch (error) {
    console.error("Error linking business to business group: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Unlinks a business from a group. Scoped to `business_group_id = groupId` so a
 * request cannot unlink a business that belongs to a different group.
 * Returns true when the business was actually a member and got unlinked.
 */
exports.unlinkBusinessFromGroupDB = async (groupId, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
        UPDATE tenants
        SET business_group_id = NULL
        WHERE id = ? AND business_group_id = ?;
    `;

    const [result] = await conn.query(sql, [tenantId, groupId]);
    return result.affectedRows > 0;
  } catch (error) {
    console.error("Error unlinking business from business group: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/* ==========================================================================
 * Business Group Owners (Phase 2)
 * ========================================================================== */

/**
 * THE security primitive for group owners.
 *
 * Answers "is this business inside this business group?" and is called on every
 * single authenticated group-owner request (see verifyGroupOwnerScope in
 * auth.middleware.js). Returns the tenant row when it belongs to the group, and
 * undefined otherwise — never a partial match, so the caller can only ever
 * treat a real membership as authorised.
 */
exports.getTenantInBusinessGroupDB = async (tenantId, businessGroupId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
        SELECT id, name, is_active, business_group_id
        FROM tenants
        WHERE id = ? AND business_group_id = ?
        LIMIT 1;
    `;

    const [result] = await conn.query(sql, [tenantId, businessGroupId]);
    return result[0];
  } catch (error) {
    console.error("Error verifying tenant business group membership: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Businesses a group owner may act on — the source for the Business Switcher.
 * Ordered by name so the switcher is stable between requests.
 */
/**
 * Every business a user may ACT ON — the union of:
 *   1. their own Business Admin tenant (`users.tenant_id`), and
 *   2. every business linked to their `business_group_id`.
 *
 * The two are independent. Unlinking someone's own business from the group must
 * never cost them access to the business they administer, so it is included
 * whether or not it is a group member. `is_own_business` tells the caller which
 * permission set applies: full admin on their own, the group permission level
 * elsewhere.
 *
 * NOT the same as `getBusinessesForGroupOwnerDB` below, which is group-only and
 * drives consolidated ("All Businesses") aggregation — that must never reach
 * outside the group, including into an unlinked own business.
 */
exports.getAccessibleBusinessesForUserDB = async (username) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
        SELECT
            t.id,
            t.name,
            t.is_active,
            (t.id = u.tenant_id) AS is_own_business,
            (t.business_group_id <=> u.business_group_id) AS is_group_member
        FROM users u
          JOIN tenants t
            ON t.business_group_id = u.business_group_id
            OR t.id = u.tenant_id
        WHERE u.username = ?
        GROUP BY t.id, t.name, t.is_active, u.tenant_id, u.business_group_id
        ORDER BY is_own_business DESC, t.name ASC;
    `;

    const [result] = await conn.query(sql, [username]);
    return result;
  } catch (error) {
    console.error("Error getting accessible businesses for user: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Validates that a tenant is one the user may switch to — their own business,
 * or a member of their group. Returns the tenant row, or undefined.
 *
 * The own-business arm is what keeps an admin able to select their own business
 * after it has been unlinked from the group.
 */
exports.getAccessibleTenantForUserDB = async (username, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
        SELECT t.id, t.name, t.is_active, t.business_group_id,
               (t.id = u.tenant_id) AS is_own_business
        FROM users u
          JOIN tenants t
            ON t.id = ?
           AND (t.business_group_id = u.business_group_id OR t.id = u.tenant_id)
        WHERE u.username = ?
        LIMIT 1;
    `;

    const [result] = await conn.query(sql, [tenantId, username]);
    return result[0];
  } catch (error) {
    console.error("Error verifying accessible tenant: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.getBusinessesForGroupOwnerDB = async (businessGroupId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
        SELECT id, name, is_active
        FROM tenants
        WHERE business_group_id = ?
        ORDER BY name ASC;
    `;

    const [result] = await conn.query(sql, [businessGroupId]);
    return result;
  } catch (error) {
    console.error("Error getting businesses for group owner: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Union of every plan feature granted to ANY business in the group — the
 * feature set an owner must see while consolidating ("All Businesses").
 *
 * A single business's plan (e.g. `getGroupOwnerAuthContextDB`'s active-tenant
 * join) is correct for single-business mode, but using it while consolidated
 * would hide features other businesses in the group grant. Returned as a raw
 * JSON string — the same shape `plans.features` / `getGroupOwnerAuthContextDB`
 * already produce — so every existing `JSON.parse(...planFeatures || "[]")`
 * call site keeps working unchanged.
 */
exports.getUnionPlanFeaturesForGroupDB = async (businessGroupId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
        SELECT DISTINCT p.features
        FROM tenants t
        JOIN plans p
          ON t.payment_gateway_product_id = p.payment_gateway_product_id
          AND p.is_deleted = 0
        WHERE t.business_group_id = ?;
    `;

    const [rows] = await conn.query(sql, [businessGroupId]);

    const union = new Set();
    for (const row of rows) {
      let features = [];
      try {
        features = JSON.parse(row.features || "[]");
      } catch (error) {
        features = [];
      }
      (features || []).forEach((feature) => union.add(feature));
    }

    return JSON.stringify(Array.from(union));
  } catch (error) {
    console.error("Error getting union plan features for group: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Owners of a group, with a derived last-login timestamp.
 *
 * `users` has no last_login column, so it is taken from the newest
 * refresh_tokens row for that username — a refresh token is only ever written
 * on a successful sign-in.
 */
exports.getBusinessGroupOwnersDB = async (businessGroupId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
        SELECT
            u.username,
            u.name,
            u.email,
            u.phone,
            u.role,
            u.status,
            u.business_group_id,
            u.group_permission_level,
            u.active_tenant_id,
            u.tenant_id AS home_tenant_id,
            home.name AS home_business_name,
            -- A dedicated owner exists only to own the group; a dual-role
            -- Business Admin also administers their own business.
            (u.role = 'group_owner') AS is_dedicated_owner,
            t.name AS active_business_name,
            (
                SELECT MAX(rt.created_at)
                FROM refresh_tokens rt
                WHERE rt.username = u.username
            ) AS last_login
        FROM users u
        LEFT JOIN tenants t ON t.id = u.active_tenant_id
        LEFT JOIN tenants home ON home.id = u.tenant_id
        -- Capability, not role: lists dedicated owners AND Business Admins who
        -- also hold group-owner capability.
        WHERE u.business_group_id = ?
        ORDER BY u.name ASC;
    `;

    const [result] = await conn.query(sql, [businessGroupId]);
    return result;
  } catch (error) {
    console.error("Error getting business group owners: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Any user row by username. `users.username` is the primary key (there is no
 * surrogate id column), so this is the canonical single-user lookup used by the
 * assign/update/remove owner flows.
 */
exports.getUserByUsernameDB = async (username) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
        SELECT username, name, email, role, tenant_id, business_group_id, group_permission_level
        FROM users
        WHERE username = ?
        LIMIT 1;
    `;

    const [result] = await conn.query(sql, [username]);
    return result[0];
  } catch (error) {
    console.error("Error getting user by username: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Creates a DEDICATED Business Group Owner account.
 *
 * This is an INSERT — it never touches an existing Business Admin or Staff row.
 * A group owner is a separate account with a separate responsibility, so a
 * business user is never converted into one.
 *
 * The shape is fixed by the architecture and not caller-controlled:
 *   role              = 'group_owner'
 *   tenant_id         = NULL   (an owner never belongs to a single business)
 *   scope             = NULL   (access comes from the group, not a scope string)
 *   business_group_id = the group being managed (always populated)
 *
 * `username` is the login identifier and carries the email, matching the rest
 * of the platform where users log in with their email address.
 */
exports.createBusinessGroupOwnerDB = async (
  username,
  encryptedPassword,
  name,
  phone,
  email,
  businessGroupId,
  permissionLevel,
  status,
) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
        INSERT INTO users
        (username, password, name, role, phone, email, scope, tenant_id, business_group_id, group_permission_level, status)
        VALUES
        (?, ?, ?, 'group_owner', ?, ?, NULL, NULL, ?, ?, ?);
    `;

    await conn.query(sql, [
      username,
      encryptedPassword,
      name,
      phone,
      email,
      businessGroupId,
      permissionLevel,
      status,
    ]);

    return { username, name, email, phone, business_group_id: businessGroupId };
  } catch (error) {
    console.error("Error creating business group owner: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Activates / deactivates an owner account. Scoped to the group so one group can
 * never touch another group's owner. An inactive owner is rejected at login.
 */
exports.updateBusinessGroupOwnerStatusDB = async (username, businessGroupId, status) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `UPDATE users
       SET status = ?
       WHERE username = ? AND business_group_id = ? AND role = 'group_owner'`,
      [status, username, businessGroupId],
    );

    // Deactivating must end any live session immediately, not at token expiry.
    if (result.affectedRows > 0 && status === "inactive") {
      await conn.query(`DELETE FROM refresh_tokens WHERE username = ?`, [username]);
    }

    await conn.commit();

    return result.affectedRows > 0;
  } catch (error) {
    await conn.rollback();
    console.error("Error updating business group owner status: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Changes an owner's permission level. Scoped to the group so one group can
 * never modify another group's owner.
 */
exports.updateBusinessGroupOwnerPermissionDB = async (username, businessGroupId, permissionLevel) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
        UPDATE users
        SET group_permission_level = ?
        -- Capability, not role: a dual-role Business Admin's permission level
        -- must be changeable here too. Still scoped to THIS group, so one group
        -- can never alter another's owner.
        WHERE username = ? AND business_group_id = ?;
    `;

    const [result] = await conn.query(sql, [permissionLevel, username, businessGroupId]);
    return result.affectedRows > 0;
  } catch (error) {
    console.error("Error updating business group owner permission: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Deletes a Business Group Owner account.
 *
 * Owner accounts are DEDICATED — they exist only to own their group and are
 * never a repurposed Business Admin or Staff account, so removing the owner
 * deletes the account outright. No business user can be affected: the statement
 * is scoped to `role = 'group_owner'` AND this group, and such a row always has
 * tenant_id = NULL.
 *
 * Refresh tokens are removed first (they have no FK to users, so they would
 * otherwise be orphaned) which also terminates any live session at once.
 */
exports.deleteBusinessGroupOwnerDB = async (username, businessGroupId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `DELETE FROM users
       WHERE username = ? AND business_group_id = ? AND role = 'group_owner'`,
      [username, businessGroupId],
    );

    if (result.affectedRows > 0) {
      await conn.query(`DELETE FROM refresh_tokens WHERE username = ?`, [username]);
    }

    await conn.commit();

    return result.affectedRows > 0;
  } catch (error) {
    await conn.rollback();
    console.error("Error deleting business group owner: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/* ==========================================================================
 * Business Group Owner CAPABILITY (dual role)
 *
 * A Business Admin can hold group-owner capability WITHOUT ceasing to be an
 * admin. Nothing about their identity changes: same row, same username, same
 * password, same `role`, same `tenant_id`, same `scope`, same history. The
 * capability is exactly two columns — `business_group_id` and
 * `group_permission_level` — so granting and revoking it are non-destructive
 * and need no role restoration.
 * ========================================================================== */

/**
 * Business Admins who may be granted group-owner capability.
 *
 * Excludes anyone who already holds it (a user belongs to at most one group),
 * anyone inactive, and — implicitly — Super Admins, who live in their own
 * `superadmins` table and have no row here at all.
 *
 * `search` matches name, username/email, phone or the BUSINESS name, which is
 * why the tenant is joined.
 */
exports.getAssignableGroupOwnerCandidatesDB = async (search, limit = 25) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const params = [];
    let filter = "";

    if (search) {
      filter = `AND (u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR t.name LIKE ?)`;
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }

    const sql = `
        SELECT
            u.username,
            u.name,
            u.email,
            u.phone,
            u.role,
            u.status,
            u.tenant_id,
            t.name AS business_name,
            t.is_active AS business_is_active
        FROM users u
          JOIN tenants t ON t.id = u.tenant_id
        WHERE u.role = 'admin'
          AND u.status = 'active'
          AND u.business_group_id IS NULL
          ${filter}
        ORDER BY t.name ASC, u.name ASC
        LIMIT ?;
    `;

    const [rows] = await conn.query(sql, [...params, Number(limit) || 25]);
    return rows;
  } catch (error) {
    console.error("Error listing assignable group owner candidates: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Grant group-owner capability to an EXISTING user.
 *
 * `role`, `tenant_id`, `scope`, `password` and every other column are left
 * untouched — this is an additive grant, not a conversion, so the user stays
 * the administrator of their own business.
 *
 * The `business_group_id IS NULL` guard makes the write atomic against a
 * concurrent assignment: a user can belong to at most one group, and a second
 * request finds affectedRows 0 rather than silently moving them.
 *
 * Returns { ok } or { ok: false, reason } so the caller can answer precisely.
 */
exports.assignGroupOwnerCapabilityDB = async (username, businessGroupId, permissionLevel) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [existing] = await conn.query(
      `SELECT username, role, status, tenant_id, business_group_id
       FROM users WHERE username = ? LIMIT 1`,
      [username]
    );
    const user = existing[0];

    if (!user) return { ok: false, reason: "not_found" };
    if (user.status !== "active") return { ok: false, reason: "inactive" };
    if (user.business_group_id) {
      return {
        ok: false,
        reason: Number(user.business_group_id) === Number(businessGroupId)
          ? "already_in_this_group"
          : "already_in_another_group",
      };
    }
    // Dedicated owners are created through the other flow; this one grants the
    // capability to an existing business user.
    if (user.role !== "admin") return { ok: false, reason: "not_a_business_admin" };

    const [result] = await conn.query(
      `UPDATE users
       SET business_group_id = ?, group_permission_level = ?
       WHERE username = ? AND business_group_id IS NULL`,
      [businessGroupId, permissionLevel, username]
    );

    if (result.affectedRows === 0) return { ok: false, reason: "already_in_another_group" };

    return { ok: true, username, tenantId: user.tenant_id, role: user.role };
  } catch (error) {
    console.error("Error assigning group owner capability: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Revoke group-owner capability, leaving the user exactly as they were.
 *
 * Only the two capability columns are cleared, so a Business Admin simply
 * carries on administering their own business — no role restoration, no data
 * loss. Scoped to the group so one group cannot revoke another's owner.
 *
 * Refresh tokens are deliberately NOT cleared: the account is still a valid
 * login. The next request re-reads the database, finds no group, and drops the
 * group claim on refresh.
 */
exports.removeGroupOwnerCapabilityDB = async (username, businessGroupId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [result] = await conn.query(
      `UPDATE users
       SET business_group_id = NULL, group_permission_level = NULL, active_tenant_id = NULL
       WHERE username = ? AND business_group_id = ? AND role = 'admin'`,
      [username, businessGroupId]
    );

    return result.affectedRows > 0;
  } catch (error) {
    console.error("Error removing group owner capability: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Repairs a missing or now-invalid active-business selection.
 *
 * Called when the owner has no selection yet (first login) or when the stored
 * selection no longer belongs to their group (the business was unlinked), so
 * they keep working instead of being stranded. The result is persisted, so the
 * choice is stable across requests.
 *
 * Applies to ANYONE holding group-owner capability, not just dedicated owners:
 * a dual-role Business Admin also needs an active business resolved, and
 * without this their `active_tenant_id` stays NULL, no tenant joins, and the
 * app reads the missing subscription as an inactive one.
 *
 * A dual-role admin defaults to THEIR OWN business — the one they actually
 * administer — falling back to the group's first business only when they have
 * none (a dedicated owner). Their own business also counts as a valid
 * selection even if it is not a member of the group.
 *
 * Returns the resolved tenant id, or null when nothing could be resolved.
 */
exports.ensureGroupOwnerActiveBusinessDB = async (username) => {
  const conn = await getMySqlPromiseConnection();
  try {
    // Only rewrites when the current selection is absent or unusable.
    await conn.query(
      `UPDATE users u
       SET u.active_tenant_id = COALESCE(
             u.tenant_id,
             (
               SELECT t.id FROM tenants t
               WHERE t.business_group_id = u.business_group_id
               ORDER BY t.name ASC
               LIMIT 1
             )
           )
       WHERE u.username = ?
         AND u.business_group_id IS NOT NULL
         AND (
           u.active_tenant_id IS NULL
           OR NOT EXISTS (
             SELECT 1 FROM tenants t2
             WHERE t2.id = u.active_tenant_id
               AND (t2.business_group_id = u.business_group_id OR t2.id = u.tenant_id)
           )
         )`,
      [username],
    );

    const [rows] = await conn.query(
      `SELECT active_tenant_id FROM users WHERE username = ? LIMIT 1`,
      [username],
    );

    return rows[0]?.active_tenant_id ?? null;
  } catch (error) {
    console.error("Error resolving group owner active business: ", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Sets the active business (the Business Switcher selection).
 *
 * The membership check is built into the statement: the sub-select only yields
 * the tenant when it belongs to THIS user's group — or is their OWN business,
 * which a dual-role Business Admin must always be able to select even if it is
 * not a group member. A tenant outside both can never be stored.
 *
 * Gated on holding group-owner CAPABILITY rather than the 'group_owner' role,
 * so a dual-role admin can switch too. Returns false when the tenant is not
 * selectable.
 */
exports.setGroupOwnerActiveBusinessDB = async (username, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
        UPDATE users u
        SET u.active_tenant_id = ?
        WHERE u.username = ?
          AND u.business_group_id IS NOT NULL
          AND u.status = 'active'
          AND EXISTS (
              SELECT 1 FROM tenants t
              WHERE t.id = ?
                AND (t.business_group_id = u.business_group_id OR t.id = u.tenant_id)
          );
    `;

    const [result] = await conn.query(sql, [tenantId, username, tenantId]);
    return result.affectedRows > 0;
  } catch (error) {
    console.error("Error setting group owner active business: ", error);
    throw error;
  } finally {
    conn.release();
  }
};
