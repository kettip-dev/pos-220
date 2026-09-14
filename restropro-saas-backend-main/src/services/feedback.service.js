const { getMySqlPromiseConnection } = require("../config/mysql.db")
const { tenantFilter } = require("../utils/tenant_scope")

/**
 * Column identifying the business a feedback entry belongs to.
 *
 * Selected only when consolidating, so a single-business response is exactly
 * what it was before Enterprise mode. Feedback rows are never merged, moved or
 * re-rated — this is a label on a read-only view.
 */
const businessColumn = (scope, alias = "f") =>
    scope?.mode === "all" ? `${alias}.tenant_id AS business_tenant_id,` : "";

exports.getOverallFeedbackSummaryDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        const sql = `
        SELECT
            COUNT(CASE WHEN average_rating BETWEEN 4.5 AND 5 THEN 1 END) AS loved,
            COUNT(CASE WHEN average_rating BETWEEN 3.5 AND 4.4 THEN 1 END) AS good,
            COUNT(CASE WHEN average_rating BETWEEN 2.5 AND 3.4 THEN 1 END) AS average,
            COUNT(CASE WHEN average_rating BETWEEN 1.5 AND 2.4 THEN 1 END) AS bad,
            COUNT(CASE WHEN average_rating BETWEEN 1 AND 1.4 THEN 1 END) AS worst
        FROM feedbacks
        WHERE ${tenantSql};
        `;

        const [results] = await conn.query(sql, params);
        return results[0];
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
}

exports.getOverallFeedbackSummaryByQuestionDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        const sql = `
        SELECT
            avg(food_quality_rating) as food_quality_rating,
            avg(service_rating) as service_rating,
            avg(staff_behavior_rating) as staff_behavior_rating,
            avg(ambiance_rating) as ambiance_rating,
            avg(recommend_rating) as recommend_rating,
            avg(average_rating) as average_rating
        FROM feedbacks
        WHERE ${tenantSql};
        `;

        const [results] = await conn.query(sql, params);
        return results[0];
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
}

/**
 * Per-business rating breakdown — powers "Ratings by Business",
 * "Reviews by Business" and "Average Rating by Business".
 *
 * ONE query grouped by tenant_id, so a group with 40 branches costs the same as
 * one with 2. Only called when consolidating.
 */
exports.getFeedbackByBusinessDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        const sql = `
        SELECT
            tenant_id,
            COUNT(*) AS total_reviews,
            AVG(average_rating) AS average_rating,
            COUNT(CASE WHEN average_rating BETWEEN 4.5 AND 5 THEN 1 END) AS loved,
            COUNT(CASE WHEN average_rating BETWEEN 3.5 AND 4.4 THEN 1 END) AS good,
            COUNT(CASE WHEN average_rating BETWEEN 2.5 AND 3.4 THEN 1 END) AS average,
            COUNT(CASE WHEN average_rating BETWEEN 1.5 AND 2.4 THEN 1 END) AS bad,
            COUNT(CASE WHEN average_rating BETWEEN 1 AND 1.4 THEN 1 END) AS worst
        FROM feedbacks
        WHERE ${tenantSql}
        GROUP BY tenant_id
        ORDER BY average_rating DESC;
        `;

        const [results] = await conn.query(sql, params);
        return results;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
}

exports.getFeedbacksDB = async (type, from, to, scope) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const { filter, params } = getFilterConditionForFeedbacks(type, from, to, scope)

        const sql = `
        SELECT
            ${businessColumn(scope)}
            f.id,
            f.invoice_id,
            DATE(f.date) AS date,
            f.phone,
            c.name,
            f.average_rating,
            f.food_quality_rating,
            f.service_rating,
            f.staff_behavior_rating,
            f.ambiance_rating,
            f.recommend_rating,
            f.remarks
        FROM
            feedbacks f
            LEFT JOIN customers c ON f.phone = c.phone
            AND f.tenant_id = c.tenant_id
        WHERE
            ${filter}
        ORDER BY
            f.date DESC;
        `;

        const [results] = await conn.query(sql, params);
        return results;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Enterprise feedback search.
 *
 * Matches order/invoice number, phone, customer name and review text. When
 * consolidating, the caller may also pass `businessTenantIds` — the ids of
 * businesses whose NAME matches the search term, resolved from the scope the
 * middleware already loaded. That makes "search by business" work without a
 * join against `tenants` and without a second query.
 */
exports.searchFeedbacksDB = async (search, scope, businessTenantIds = []) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params: tenantParams } = tenantFilter(scope, "f");

        const matches = [
            "f.invoice_id = ?",
            "f.phone LIKE ?",
            "c.`name` LIKE ?",
            "f.remarks LIKE ?",
        ];
        const matchParams = [search, `${search}%`, `%${search}%`, `%${search}%`];

        // Business-name matches are already restricted to the caller's own
        // group, because the ids come from their resolved scope.
        if (businessTenantIds.length > 0) {
            matches.push("f.tenant_id IN (?)");
            matchParams.push(businessTenantIds);
        }

        const sql = `
          SELECT
              ${businessColumn(scope)}
              f.id,
              f.invoice_id,
              DATE(f.date) AS date,
              f.phone,
              c.name,
              f.average_rating,
              f.food_quality_rating,
              f.service_rating,
              f.staff_behavior_rating,
              f.ambiance_rating,
              f.recommend_rating,
              f.remarks
          FROM
              feedbacks f
              LEFT JOIN customers c ON f.phone = c.phone
              AND f.tenant_id = c.tenant_id
          WHERE
              (${matches.join(" OR ")})
              AND ${tenantSql}
          ORDER BY
              f.date DESC;
          `;

        const [results] = await conn.query(sql, [...matchParams, ...tenantParams]);
        return results;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Date + tenant WHERE clause for feedback queries.
 *
 * `scope` is a resolved data scope; `tenantFilter` also accepts a bare tenant
 * id, so any caller still passing one keeps working. The tenant clause is
 * appended last exactly as before, so the emitted SQL and parameter order are
 * unchanged for a single business.
 *
 * (Renamed from getFilterConditionForInvoices — it has always filtered
 * feedbacks; the old name was copied from the invoice service.)
 */
const getFilterConditionForFeedbacks = (type, from, to, scope) => {
    const params = [];
    let dateFilter = '';

    switch (type) {
        case 'custom': {
            params.push(from, to);
            dateFilter = `DATE(f.date) >= ? AND DATE(f.date) <= ? AND `;
            break;
        }
        case 'today': {
            dateFilter = `DATE(f.date) = CURDATE() AND `;
            break;
        }
        case 'this_month': {
            dateFilter = `YEAR(f.date) = YEAR(NOW()) AND MONTH(f.date) = MONTH(NOW()) AND `;
            break;
        }
        case 'last_month': {
            dateFilter = `DATE(f.date) >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND DATE(f.date) <= CURDATE() AND `;
            break;
        }
        case 'last_7days': {
            dateFilter = `DATE(f.date) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND DATE(f.date) <= CURDATE() AND `;
            break;
        }
        case 'yesterday': {
            dateFilter = `DATE(f.date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND `;
            break;
        }
        case 'tomorrow': {
            dateFilter = `DATE(f.date) = DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND `;
            break;
        }
        default: {
            dateFilter = '';
        }
    }

    const tenant = tenantFilter(scope, "f");

    return { params: [...params, ...tenant.params], filter: `${dateFilter}${tenant.sql}` };
}