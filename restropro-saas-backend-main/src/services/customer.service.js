const { getMySqlPromiseConnection } = require("../config/mysql.db")
const { tenantFilter } = require("../utils/tenant_scope")
const { escape } = require("mysql2")
const { nonVoidInvoiceFilter } = require("./invoice.service")
exports.doCustomerExistDB = async (phone, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        SELECT phone, name FROM customers
        WHERE phone = ? AND tenant_id = ?
        LIMIT 1;
        `;

        const [result] = await conn.query(sql, [phone, tenantId]);

        return result.length > 0;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.addCustomerDB = async (phone, name, email, birthDate, gender, isMember, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        INSERT INTO customers
        (phone, name, email, birth_date, gender, is_member, tenant_id)
        VALUES
        (?, ?, ?, ?, ?, ?, ?);
        `;

        const [result] = await conn.query(sql, [phone, name, email, birthDate, gender, isMember, tenantId]);

        return result.insertId;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

// Sort columns a caller may order by. `sort` arrives from the query string, so
// it is matched against this list rather than interpolated — an unknown value
// falls back to the previous default instead of reaching SQL.
const CUSTOMER_SORT_COLUMNS = {
    name: "name",
    phone: "phone",
    email: "email",
    created_at: "created_at",
    birth_date: "birth_date",
};

exports.getCustomersDB = async(page, perPage, sort, filter, scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        // Validate and sanitize inputs
        const currentPage = parseInt(page) || 1;
        const limit = parseInt(perPage) || 10; // Define default page size
        const offset = (currentPage - 1) * limit;

        const sortColumn = CUSTOMER_SORT_COLUMNS[sort] || "created_at";
        const sortedBy = `ORDER BY ${sortColumn}${sortColumn === "created_at" ? " DESC" : " ASC"}`;

        // Scope + filter are BOUND, never interpolated. `filter` is caller
        // supplied and was previously concatenated straight into the statement.
        const { sql: tenantSql, params: tenantParams } = tenantFilter(scope);
        const where = [tenantSql];
        const params = [...tenantParams];

        if (filter) {
            where.push("(name LIKE ? OR phone = ?)");
            params.push(`${filter}%`, filter);
        }

        const whereSql = `WHERE ${where.join(" AND ")}`;
        const isConsolidated = scope?.mode === "all";

        // The same person is a SEPARATE customers row in each business they have
        // visited (phone is unique per tenant, not globally). Consolidated, they
        // are collapsed onto one line keyed by phone — falling back to email when
        // a row has no phone — so the list shows people, not rows.
        //
        // The grouping is done in SQL, not after fetching: doing it in JS would
        // collapse rows only WITHIN a page, so someone appearing in two
        // businesses could still be listed twice across page boundaries, and the
        // total count would be wrong.
        //
        // This is display-only. No customer row is written, moved or merged —
        // each business keeps its own record, exactly as before.
        const identity = "COALESCE(NULLIF(TRIM(phone), ''), NULLIF(TRIM(email), ''), CONCAT('#', phone))";

        // conn.query (NOT conn.execute): the prepared-statement protocol does
        // not expand an array into an IN list, so `IN (?)` under execute()
        // silently matches nothing.
        const [customers] = isConsolidated
            ? await conn.query(
                `SELECT
                    MIN(phone) AS phone,
                    MIN(name) AS name,
                    MIN(email) AS email,
                    MIN(birth_date) AS birth_date,
                    MIN(gender) AS gender,
                    MAX(is_member) AS is_member,
                    MIN(created_at) AS created_at,
                    COUNT(DISTINCT tenant_id) AS business_count,
                    GROUP_CONCAT(DISTINCT tenant_id) AS business_tenant_ids
                 FROM customers ${whereSql}
                 GROUP BY ${identity}
                 ${sortedBy.replace(/\b(name|phone|email|birth_date|created_at)\b/, "MIN($1)")}
                 LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            )
            : await conn.query(
                `SELECT phone, name, email, birth_date, gender, is_member, created_at
                 FROM customers ${whereSql} ${sortedBy} LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );

        // Counts distinct PEOPLE when consolidated, so totalPages matches the
        // collapsed list rather than the underlying row count.
        const [totalCustomers] = await conn.query(
            isConsolidated
                ? `SELECT COUNT(DISTINCT ${identity}) AS total FROM customers ${whereSql}`
                : `SELECT COUNT(*) AS total FROM customers ${whereSql}`,
            params
        );

        // Prepare response data
        const response = {
            customers,
            currentPage,
            perPage,
            totalPages: Math.ceil(totalCustomers[0].total / limit),
            totalCustomers: totalCustomers[0].total
        };

        return response;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
}

exports.getAllCustomersDB = async(scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);
        // Feeds the CSV download, so a consolidated export carries the owning
        // business exactly like the on-screen list.
        const businessColumn = scope?.mode === "all" ? ", tenant_id AS business_tenant_id" : "";

        const sql = `
        SELECT phone, name, email, birth_date, gender, is_member, created_at${businessColumn} FROM customers
        WHERE
            ${tenantSql}
        ORDER BY
            created_at DESC
        `
        const [result] = await conn.query(sql, params);

        return result;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
}

exports.uploadBulkCustomersDB = async(customers) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const sql = `
        INSERT INTO customers 
        (phone, name, email, birth_date, gender, tenant_id) 
        VALUES
        ?
        ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        email = VALUES(email),
        birth_date = VALUES(birth_date),
        gender = VALUES(gender);

        `
        const [result] = await conn.query(sql, [customers]);

        return result;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getCustomerDB = async(phone, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const [result] = await conn.execute(
            `SELECT phone, name, email, birth_date, gender, is_member, created_at FROM customers
            WHERE phone = ? AND tenant_id = ?
            LIMIT 1;`,
            [phone, tenantId]
        );

        return result[0];
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
}

exports.searchCustomerDB = async(searchString, scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params: tenantParams } = tenantFilter(scope);
        const businessColumn = scope?.mode === "all" ? ", tenant_id AS business_tenant_id" : "";

        // conn.query, not conn.execute: the prepared-statement protocol does not
        // expand an array into an IN list, so `IN (?)` under execute() matches
        // nothing and returns an empty result with no error.
        const [result] = await conn.query(
            `
            SELECT phone, name, email, birth_date, gender, is_member, created_at${businessColumn} FROM customers
            WHERE (phone LIKE ? OR name LIKE ?) AND ${tenantSql}
            LIMIT 10
            ;`,
            [`${searchString}%`, `%${searchString}%`, ...tenantParams]
        );

        return result;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
}

exports.updateCustomerDB = async (phone, name, email, birthDate, gender, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        UPDATE customers
        SET
        name = ?, email = ?, birth_date = ?, gender = ?
        WHERE phone = ? AND tenant_id = ?
        `;

        await conn.query(sql, [name, email, birthDate, gender, phone, tenantId]);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.deleteCustomerDB = async (phone, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        DELETE FROM customers
        WHERE phone = ? AND tenant_id = ?;
        `;

        await conn.query(sql, [phone, tenantId]);

        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getCustomerInsightsDB = async (phone, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const [totals] = await conn.execute(
            `SELECT SUM(i.total) as total_spend, COUNT(DISTINCT i.id) as visits
            FROM invoices i
            JOIN orders o ON i.id = o.invoice_id
            WHERE o.customer_id = ? AND o.tenant_id = ?`,
            [phone, tenantId]
        );

        const [thisMonth] = await conn.execute(
            `SELECT SUM(i.total) as this_month_spend
            FROM invoices i
            JOIN orders o ON i.id = o.invoice_id
            WHERE o.customer_id = ? AND o.tenant_id = ? 
            AND MONTH(i.created_at) = MONTH(CURRENT_DATE()) 
            AND YEAR(i.created_at) = YEAR(CURRENT_DATE())`,
            [phone, tenantId]
        );

        const [visitedDays] = await conn.execute(
            `SELECT DAYNAME(i.created_at) as day_name, COUNT(DISTINCT i.id) as visits
            FROM invoices i
            JOIN orders o ON i.id = o.invoice_id
            WHERE o.customer_id = ? AND o.tenant_id = ?
            GROUP BY DAYNAME(i.created_at)`,
            [phone, tenantId]
        );

        const [topBuys] = await conn.execute(
            `SELECT mi.title, SUM(oi.quantity) as total_quantity, SUM(oi.quantity * (IFNULL(miv.price, mi.price))) as total_spent
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN menu_items mi ON oi.item_id = mi.id
            LEFT JOIN menu_item_variants miv ON oi.variant_id = miv.id
            WHERE o.customer_id = ? AND o.tenant_id = ? AND o.status = 'completed'
            GROUP BY mi.id, mi.title
            ORDER BY total_quantity DESC
            LIMIT 5`,
            [phone, tenantId]
        );

        return {
            totalSpend: totals[0]?.total_spend || 0,
            visits: totals[0]?.visits || 0,
            thisMonthSpend: thisMonth[0]?.this_month_spend || 0,
            customers,
            currentPage,
            perPage,
            totalPages: Math.ceil(totalCustomers[0].total / limit),
            totalCustomers: totalCustomers[0].total
        };
        return response;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
}

exports.getAllCustomersDB = async(scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);
        // Feeds the CSV download, so a consolidated export carries the owning
        // business exactly like the on-screen list.
        const businessColumn = scope?.mode === "all" ? ", tenant_id AS business_tenant_id" : "";

        const sql = `
        SELECT phone, name, email, birth_date, gender, is_member, created_at${businessColumn} FROM customers
        WHERE
            ${tenantSql}
        ORDER BY
            created_at DESC
        `
        const [result] = await conn.query(sql, params);

        return result;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
}

exports.uploadBulkCustomersDB = async(customers) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const sql = `
        INSERT INTO customers 
        (phone, name, email, birth_date, gender, tenant_id) 
        VALUES
        ?
        ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        email = VALUES(email),
        birth_date = VALUES(birth_date),
        gender = VALUES(gender);

        `
        const [result] = await conn.query(sql, [customers]);

        return result;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getCustomerDB = async(phone, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const [result] = await conn.execute(
            `SELECT phone, name, email, birth_date, gender, is_member, created_at FROM customers
            WHERE phone = ? AND tenant_id = ?
            LIMIT 1;`,
            [phone, tenantId]
        );

        return result[0];
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
}

exports.searchCustomerDB = async(searchString, scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params: tenantParams } = tenantFilter(scope);
        const businessColumn = scope?.mode === "all" ? ", tenant_id AS business_tenant_id" : "";

        // conn.query, not conn.execute: the prepared-statement protocol does not
        // expand an array into an IN list, so `IN (?)` under execute() matches
        // nothing and returns an empty result with no error.
        const [result] = await conn.query(
            `
            SELECT phone, name, email, birth_date, gender, is_member, created_at${businessColumn} FROM customers
            WHERE (phone LIKE ? OR name LIKE ?) AND ${tenantSql}
            LIMIT 10
            ;`,
            [`${searchString}%`, `%${searchString}%`, ...tenantParams]
        );

        return result;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
}

exports.updateCustomerDB = async (phone, name, email, birthDate, gender, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        UPDATE customers
        SET
        name = ?, email = ?, birth_date = ?, gender = ?
        WHERE phone = ? AND tenant_id = ?
        `;

        await conn.query(sql, [name, email, birthDate, gender, phone, tenantId]);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.deleteCustomerDB = async (phone, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        DELETE FROM customers
        WHERE phone = ? AND tenant_id = ?;
        `;

        await conn.query(sql, [phone, tenantId]);

        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getCustomerInsightsDB = async (phone, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const statsPromise = conn.execute(
            `SELECT
                SUM(i.total) as total_spend,
                COUNT(DISTINCT i.id) as visits,
                SUM(CASE WHEN MONTH(i.created_at) = MONTH(CURRENT_DATE()) AND YEAR(i.created_at) = YEAR(CURRENT_DATE()) THEN i.total ELSE 0 END) as this_month_spend
            FROM invoices i
            JOIN orders o ON i.id = o.invoice_id
            WHERE o.customer_id = ? AND o.tenant_id = ? AND ${nonVoidInvoiceFilter()}`,
            [phone, tenantId]
        );

        const visitedDaysPromise = conn.execute(
            `SELECT DAYNAME(i.created_at) as day_name, COUNT(DISTINCT i.id) as visits
            FROM invoices i
            JOIN orders o ON i.id = o.invoice_id
            WHERE o.customer_id = ? AND o.tenant_id = ? AND ${nonVoidInvoiceFilter()}
            GROUP BY DAYNAME(i.created_at)`,
            [phone, tenantId]
        );

        const topBuysPromise = conn.execute(
            `SELECT mi.title, mi.image, SUM(oi.quantity) as total_quantity, SUM(oi.quantity * (IFNULL(miv.price, mi.price))) as total_spent
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN menu_items mi ON oi.item_id = mi.id
            LEFT JOIN menu_item_variants miv ON oi.variant_id = miv.id
            WHERE o.customer_id = ? AND o.tenant_id = ? AND o.status = 'completed'
            GROUP BY mi.id, mi.title, mi.image
            ORDER BY total_quantity DESC
            LIMIT 5`,
            [phone, tenantId]
        );

        const results = await Promise.allSettled([
            statsPromise,
            visitedDaysPromise,
            topBuysPromise
        ]);

        let stats = [];
        if (results[0].status === 'fulfilled') {
            stats = results[0].value[0];
        } else {
            console.error("Error fetching stats:", results[0].reason);
        }

        let visitedDays = [];
        if (results[1].status === 'fulfilled') {
            visitedDays = results[1].value[0];
        } else {
            console.error("Error fetching visited days:", results[1].reason);
        }

        let topBuys = [];
        if (results[2].status === 'fulfilled') {
            topBuys = results[2].value[0];
        } else {
            console.error("Error fetching top buys:", results[2].reason);
        }

        return {
            totalSpend: stats[0]?.total_spend || 0,
            visits: stats[0]?.visits || 0,
            thisMonthSpend: stats[0]?.this_month_spend || 0,
            avgBill: stats[0]?.visits ? (stats[0]?.total_spend / stats[0]?.visits) : 0,
            visitedDays,
            topBuys
        };

    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getCustomerInvoicesDB = async (phone, tenantId, page = 1, limit = 50) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const offset = (page - 1) * limit;
        
        // I will use template string for limit and offset because prepared statements sometimes fail with LIMIT ?
        const sql = `SELECT i.id as invoice_no, i.total, i.created_at, i.status as invoice_status, pt.title as payment_type, o.delivery_type as order_type, o.status, o.token_no, o.id as order_id
            FROM invoices i
            JOIN orders o ON i.id = o.invoice_id
            LEFT JOIN payment_types pt ON i.payment_type_id = pt.id
            WHERE o.customer_id = ? AND o.tenant_id = ?
            ORDER BY i.created_at DESC
            LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

        const invoicesPromise = conn.execute(sql, [phone, tenantId]);

        const totalCountPromise = conn.execute(
            `SELECT COUNT(DISTINCT i.id) as total
            FROM invoices i
            JOIN orders o ON i.id = o.invoice_id
            WHERE o.customer_id = ? AND o.tenant_id = ?`,
            [phone, tenantId]
        );

        const results = await Promise.allSettled([
            invoicesPromise,
            totalCountPromise
        ]);

        let invoices = [];
        if (results[0].status === 'fulfilled') {
            invoices = results[0].value[0];
        } else {
            console.error("Error fetching invoices:", results[0].reason);
        }

        let totalCount = [];
        if (results[1].status === 'fulfilled') {
            totalCount = results[1].value[0];
        } else {
            console.error("Error fetching total count:", results[1].reason);
        }

        return {
            invoices,
            total: totalCount[0]?.total || 0,
            page,
            limit,
            totalPages: Math.ceil((totalCount[0]?.total || 0) / limit)
        };
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};
