/**
 * Dashboard data.
 *
 * Every function takes a `scope` (see middlewares/data_scope.middleware.js) and
 * builds its tenant filter through `tenantFilter`, so one implementation serves
 * both a single business and a Business Group Owner's consolidated
 * "All Businesses" view.
 *
 * `tenantFilter` also accepts a bare tenant id, so a caller that still passes
 * `tenantId` keeps working unchanged.
 *
 * Single-business responses are deliberately IDENTICAL to before this feature:
 * the extra `tenant_id` column that identifies which business a row came from is
 * only selected when the scope actually spans several, so no existing consumer
 * sees a new field.
 */
const { getMySqlPromiseConnection } = require("../config/mysql.db")
const { tenantFilter, isConsolidated } = require("../utils/tenant_scope");
const { nonVoidInvoiceFilter } = require("./invoice.service")

/**
 * The column identifying which business a row came from — as a list so it can be
 * spread into a SELECT without leaving a dangling comma when consolidating is
 * off. Empty in single-business mode, which is what keeps those responses
 * identical to before this feature.
 */
const businessColumn = (scope, alias = null) =>
    isConsolidated(scope)
        ? [`${alias ? `${alias}.` : ""}tenant_id AS business_tenant_id`]
        : [];

exports.getTodaysOrdersCountDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        const sql = `
        SELECT
            count(*) AS todays_orders
        FROM
            orders
        WHERE
            DATE(\`date\`) = CURDATE() AND ${tenantSql}
        `;

        const [result] = await conn.query(sql, params);
        return result[0].todays_orders;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getTodaysNewCustomerCountDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        const sql = `
        SELECT
            count(*) AS new_customers_count
        FROM
            customers
        WHERE
            DATE(created_at) = CURDATE() AND ${tenantSql}
        `;

        const [result] = await conn.query(sql, params);
        return result[0].new_customers_count;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getTodaysRepeatCustomerCountDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        // NOTE: customer_id is unique per business, so counting DISTINCT across
        // businesses counts one person twice if they are a customer of two.
        // That matches the per-business definition of "repeat customer"; true
        // cross-business identity resolution is the Customers module's job
        // (display-only grouping by phone/email), not this KPI's.
        const sql = `
        SELECT
            COUNT(distinct customer_id) as todays_repeat_customers
        FROM
            orders
        WHERE
            DATE(\`date\`) = CURDATE()
            AND customer_type = 'CUSTOMER' AND ${tenantSql};
        `;

        const [result] = await conn.query(sql, params);

        return result[0].todays_repeat_customers;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getTodaysTopSellingItemsDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: itemsTenantSql, params: itemsParams } = tenantFilter(scope, "oi");

        // Consolidated: the same dish exists as a DIFFERENT menu_items row in
        // each business, so grouping by id would list "Pizza" once per branch.
        // Group by title instead to get one enterprise-wide ranking.
        if (isConsolidated(scope)) {
            const sql = `
            SELECT
                MIN(mi.id) AS id,
                mi.title,
                MIN(mi.price) AS price,
                MIN(mi.net_price) AS net_price,
                MIN(mi.image) AS image,
                COUNT(DISTINCT mi.tenant_id) AS business_count,
                SUM(oi.orders_count) AS orders_count
            FROM menu_items mi
                INNER JOIN (
                    SELECT oi.item_id, oi.tenant_id, SUM(oi.quantity) AS orders_count
                    FROM order_items oi
                    LEFT JOIN orders o
                      ON o.id = oi.order_id
                      AND o.tenant_id = oi.tenant_id
                    LEFT JOIN invoices i
                      ON i.id = o.invoice_id
                      AND i.tenant_id = o.tenant_id
                   WHERE
    oi.status <> 'cancelled'
    AND DATE(oi.\`date\`) = CURDATE()
    AND ${itemsTenantSql}
    AND (o.invoice_id IS NULL OR ${nonVoidInvoiceFilter()})
GROUP BY oi.item_id, oi.tenant_id
                ) oi ON mi.id = oi.item_id AND mi.tenant_id = oi.tenant_id
            GROUP BY mi.title
            ORDER BY orders_count DESC
            LIMIT 50;
            `;

            const [result] = await conn.query(sql, itemsParams);
            return result;
        }

        // Single business: unchanged from before this feature.
        const { sql: menuTenantSql, params: menuParams } = tenantFilter(scope, "mi");

        const sql = `
        SELECT
            mi.*,
            oi_c.orders_count
        FROM
            menu_items mi
            INNER JOIN (
                SELECT
                    oi.item_id,
                    SUM(oi.quantity) AS orders_count
                FROM
                    order_items oi
                    LEFT JOIN orders o ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id
                    LEFT JOIN invoices i ON i.id = o.invoice_id AND i.tenant_id = o.tenant_id
                WHERE
                    oi.status <> 'cancelled'
                    AND DATE(oi.\`date\`) = CURDATE()
                    AND ${itemsTenantSql}
                    AND (o.invoice_id IS NULL OR ${nonVoidInvoiceFilter()})
                GROUP BY
                    oi.item_id
                LIMIT 50) oi_c ON mi.id = oi_c.item_id
        WHERE ${menuTenantSql}
        ORDER BY
            oi_c.orders_count DESC;
        `;

        const [result] = await conn.query(sql, [...itemsParams, ...menuParams]);
        return result;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

// ─── NEW: Advanced Analytics Queries ─────────────────────────────

exports.getTodaysRevenueDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        const sql = `
        SELECT
            COALESCE(SUM(total), 0) AS total_revenue,
            COALESCE(SUM(sub_total), 0) AS net_sales,
            COALESCE(SUM(tax_total), 0) AS tax_total,
            COALESCE(SUM(service_charge_total), 0) AS service_charge_total,
            COALESCE(AVG(total), 0) AS average_order_value,
            COUNT(*) AS invoice_count
        FROM invoices
        WHERE DATE(created_at) = CURDATE() AND ${tenantSql}
            AND ${nonVoidInvoiceFilter("")}

        `;
        const [result] = await conn.query(sql, params);
        return result[0];
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getYesterdaysRevenueDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        const sql = `
        SELECT
            COALESCE(SUM(total), 0) AS total_revenue,
            COALESCE(AVG(total), 0) AS average_order_value,
            COUNT(*) AS invoice_count
        FROM invoices
        WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND ${tenantSql}
            AND ${nonVoidInvoiceFilter("")}
        `;
        const [result] = await conn.query(sql, params);
        return result[0];
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getYesterdaysOrdersCountDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        const sql = `
        SELECT COUNT(*) AS orders_count
        FROM orders
        WHERE DATE(\`date\`) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND ${tenantSql}
        `;
        const [result] = await conn.query(sql, params);
        return result[0].orders_count;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getYesterdaysNewCustomerCountDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        const sql = `
        SELECT COUNT(*) AS new_customers_count
        FROM customers
        WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND ${tenantSql}
        `;
        const [result] = await conn.query(sql, params);
        return result[0].new_customers_count;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getRevenueTrendDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        // Grouped by date only, so a consolidated trend is the group's combined
        // daily revenue — one line, not one per business.
        const sql = `
        SELECT
            DATE(created_at) AS date,
            COALESCE(SUM(total), 0) AS revenue,
            COUNT(*) AS invoice_count
        FROM invoices
        WHERE ${tenantSql} AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            AND ${nonVoidInvoiceFilter("")}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
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

exports.getSalesByHourDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        const sql = `
        SELECT
            HOUR(created_at) AS hour,
            COALESCE(SUM(total), 0) AS revenue,
            COUNT(*) AS orders
        FROM invoices
        WHERE ${tenantSql} AND DATE(created_at) = CURDATE()
            AND ${nonVoidInvoiceFilter("")}
        GROUP BY HOUR(created_at)
        ORDER BY hour ASC
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

exports.getOrdersByTypeDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        const sql = `
        SELECT
            COALESCE(NULLIF(delivery_type, ''), 'Unassigned') AS order_type,
            COUNT(*) AS count
        FROM orders
        WHERE ${tenantSql} AND DATE(\`date\`) = CURDATE()
        GROUP BY COALESCE(NULLIF(delivery_type, ''), 'Unassigned')
        ORDER BY count DESC
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

exports.getPaymentMixDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope, "i");

        // Grouped by payment type TITLE rather than payment_type_id: each
        // business has its own payment_types rows, so "Cash" in Ahmedabad and
        // "Cash" in Rajkot are different ids and would otherwise appear twice.
        const groupBy = isConsolidated(scope)
            ? "GROUP BY COALESCE(pt.title, 'Unassigned')"
            : "GROUP BY i.payment_type_id, pt.title";

        const sql = `
        SELECT
            COALESCE(pt.title, 'Unassigned') AS payment_type,
            COUNT(i.id) AS count,
            COALESCE(SUM(i.total), 0) AS total
        FROM invoices i
        LEFT JOIN payment_types pt ON pt.id = i.payment_type_id AND pt.tenant_id = i.tenant_id
        WHERE ${tenantSql} AND DATE(i.created_at) = CURDATE()
            AND ${nonVoidInvoiceFilter()}
        GROUP BY i.payment_type_id, pt.title
        ORDER BY total DESC
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

exports.getLowStockAlertsDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        const columns = [
            "id", "title", "quantity", "unit", "min_quantity_threshold", "status",
            ...businessColumn(scope),
        ];

        const sql = `
        SELECT
            ${columns.join(", ")}
        FROM inventory_items
        WHERE ${tenantSql}
            AND quantity <= min_quantity_threshold
        ORDER BY
            CASE status WHEN 'out' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
            quantity ASC
        LIMIT 6
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

exports.getRecentFeedbackDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope, "f");

        const columns = [
            "f.id",
            "f.average_rating",
            "f.food_quality_rating",
            "f.service_rating",
            "f.staff_behavior_rating",
            "f.ambiance_rating",
            "f.recommend_rating",
            "f.remarks",
            "f.date",
            ...businessColumn(scope, "f"),
            "COALESCE(c.name, f.phone, 'Guest') AS customer_name",
        ];

        const sql = `
        SELECT
            ${columns.join(",\n            ")}
        FROM feedbacks f
        LEFT JOIN customers c ON c.phone = f.phone AND c.tenant_id = f.tenant_id
        WHERE ${tenantSql}
        ORDER BY f.date DESC
        LIMIT 5
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

exports.getCancelledOrdersCountDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        const sql = `
        SELECT COUNT(*) AS cancelled_count
        FROM orders
        WHERE ${tenantSql} AND status = 'cancelled' AND DATE(\`date\`) = CURDATE()
        `;
        const [result] = await conn.query(sql, params);
        return result[0].cancelled_count;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

/* ==========================================================================
 * Enterprise ("All Businesses") — per-business breakdown
 *
 * These power Revenue by Business, Orders by Business, Top Performing Business
 * and the Business Comparison widget. Each is ONE query grouped by tenant_id —
 * never a loop over businesses, so a group with 40 branches costs the same two
 * round trips as one with 2.
 * ========================================================================== */

/**
 * Today's revenue and invoice count per business, richest first.
 * The caller maps tenant ids to names from `scope.businessNames`, so this needs
 * no join against `tenants`.
 */
exports.getRevenueByBusinessDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        const sql = `
        SELECT
            tenant_id,
            COALESCE(SUM(total), 0) AS revenue,
            COALESCE(AVG(total), 0) AS average_order_value,
            COUNT(*) AS invoice_count
        FROM invoices
        WHERE ${tenantSql} AND DATE(created_at) = CURDATE() AND ${nonVoidInvoiceFilter("")}
        GROUP BY tenant_id
        ORDER BY revenue DESC
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

/** Today's order and cancellation counts per business. */
exports.getOrdersByBusinessDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        const sql = `
        SELECT
            tenant_id,
            COUNT(*) AS orders_count,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count
        FROM orders
        WHERE ${tenantSql} AND DATE(\`date\`) = CURDATE()
        GROUP BY tenant_id
        ORDER BY orders_count DESC
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
