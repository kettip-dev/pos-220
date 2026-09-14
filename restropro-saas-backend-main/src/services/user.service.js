const { getMySqlPromiseConnection } = require("../config/mysql.db")
const { tenantFilter } = require("../utils/tenant_scope");

exports.getUserDB = async (username, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
           SELECT 
            u.username,
            u.role,
            u.scope,
            p.features AS plan_features,
            t.is_active,
            t.name
        FROM users u
        LEFT JOIN tenants t 
            ON u.tenant_id = t.id
        LEFT JOIN plans p
            ON t.payment_gateway_product_id = p.payment_gateway_product_id
        WHERE 
            u.username = ?
            AND u.tenant_id = ?
        LIMIT 1;
        `;

        const [result] = await conn.query(sql, [username, tenantId]);
        const user = result[0];
        if (user && user.is_active == 1 && (!user.plan_features || user.plan_features === "[]" || user.plan_features === "null")) {
            const ALL_FEATURES = [
                "DASHBOARD", "POS", "ORDERS", "KITCHEN", "RESERVATIONS",
                "CUSTOMERS", "INVOICES", "MEMBERSHIP", "INVENTORY",
                "SETTINGS", "REPORTS", "FEEDBACK", "USER", "QRMENU"
            ];
            user.plan_features = JSON.stringify(ALL_FEATURES);
            user.planFeatures = user.plan_features;
            user.plan_title = user.plan_title || "Full Access";
        }
        return user;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getAllUsersDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);
        // Only selected when consolidating, so a single-business response is
        // exactly what it was before Enterprise mode. Never the password hash.
        const businessColumn = scope?.mode === "all" ? ", tenant_id AS business_tenant_id" : "";

        const sql = `
        SELECT username, name, role, photo, designation, phone, email, scope${businessColumn} FROM users
        WHERE ${tenantSql}
        ORDER BY role, name;
        `;

        const [result] = await conn.query(sql, params);
        return result;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Enterprise staff summary (READ-ONLY): headcount overall, per business, and
 * per role/designation.
 *
 * Three grouped queries, never a per-business loop.
 *
 * NOTE: `users` has no active/inactive column for BUSINESS users — `status` is
 * only populated for `group_owner` accounts (see the Phase 2 business-group
 * work). "Active vs inactive staff" therefore cannot be reported here; the
 * tenant-level `tenants.is_active` flag is a subscription state, not a per-user
 * one. Roles are `admin` / `user`; the finer job titles the spec lists (waiter,
 * captain, kitchen, cashier, manager) live in the free-text `designation`
 * column, so they are grouped by that rather than invented as roles.
 */
exports.getUserSummaryDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        const [totals, byBusiness, byRole] = await Promise.all([
            conn.query(`
                SELECT COUNT(*) AS total_staff, COUNT(DISTINCT tenant_id) AS businesses
                FROM users WHERE ${tenantSql}
            `, params).then(([r]) => r[0]),
            conn.query(`
                SELECT tenant_id, COUNT(*) AS total_staff,
                       COUNT(CASE WHEN role = 'admin' THEN 1 END) AS admins,
                       COUNT(CASE WHEN role = 'user' THEN 1 END) AS staff
                FROM users WHERE ${tenantSql}
                GROUP BY tenant_id ORDER BY total_staff DESC
            `, params).then(([r]) => r),
            conn.query(`
                SELECT
                    role,
                    COALESCE(NULLIF(TRIM(designation), ''), 'Unassigned') AS designation,
                    COUNT(*) AS count
                FROM users WHERE ${tenantSql}
                GROUP BY role, COALESCE(NULLIF(TRIM(designation), ''), 'Unassigned')
                ORDER BY count DESC
            `, params).then(([r]) => r),
        ]);

        return { ...totals, byBusiness, byRole };
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.doUserExistDB = async (username) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        SELECT username FROM users
        WHERE username = ?
        LIMIT 1;
        `;

        const [result] = await conn.query(sql, [username]);
        return result.length == 1;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.addUserDB = async (tenantId, username, encryptedPassword, name, role, photo, designation, phone, email, scope) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        INSERT INTO users
        (username, password, name, role, photo, designation, phone, email, scope, tenant_id)
        VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await conn.query(sql, [username, encryptedPassword, name, role, photo, designation, phone, email, scope, tenantId]);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.deleteUserDB = async (username, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        DELETE FROM refresh_tokens WHERE username = ? AND tenant_id = ?;
        DELETE FROM users WHERE username = ? AND tenant_id = ?;
        `;

        await conn.query(sql, [username, tenantId, username, tenantId]);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.deleteUserRefreshTokensDB = async (username, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        DELETE FROM refresh_tokens WHERE username = ? AND tenant_id = ?;
        `;

        await conn.query(sql, [username, tenantId]);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.updateUserDB = async (username, name, photo, designation, phone, email, scope, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        UPDATE users
        SET
        name = ?, photo = ?, designation = ?, phone = ?, email = ?, scope = ?
        WHERE username = ? AND tenant_id = ?;
        `;

        await conn.query(sql, [name, photo, designation, phone, email, scope, username, tenantId]);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.updateUserPasswordDB = async (username, password, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        UPDATE users
        SET
        password = ?
        WHERE username = ? AND tenant_id = ?;
        `;

        await conn.query(sql, [password, username, tenantId]);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};