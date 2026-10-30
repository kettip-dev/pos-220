const { getMySqlPromiseConnection } = require("../config/mysql.db")
const { tenantFilter } = require("../utils/tenant_scope");

exports.addReservationDB = async (customerId, date, tableId, status, notes, peopleCount, uniqueCode, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {
        conn.config.dateStrings = true;
        const sql = `
        INSERT INTO reservations 
        (customer_id, date, table_id, status, notes, people_count, unique_code, tenant_id)
        VALUES
        (?, ?, ?, ?, ?, ?, ?, ?);
        `;

        let formattedDate = date;
        if (date) {
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
                formattedDate = d.toISOString().slice(0, 19).replace("T", " ");
            }
        }

        const [result] = await conn.query(sql, [customerId, formattedDate, tableId, status || 'booked', notes, peopleCount, uniqueCode, tenantId]);

        return result.insertId;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
      }
};

exports.updateReservationDB = async (reservationId, date, tableId, status, notes, peopleCount, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {
        conn.config.dateStrings = true;
        const sql = `
        UPDATE reservations
        SET
        date = ?, table_id = ?, status = ?, notes = ?, people_count = ?, updated_at = NOW()
        WHERE id = ? AND tenant_id = ?;
        `;
        let formattedDate = date;
        if (date) {
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
                formattedDate = d.toISOString().slice(0, 19).replace("T", " ");
            }
        }
        await conn.query(sql, [formattedDate, tableId, status, notes, peopleCount, reservationId, tenantId]);

        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
      }
};

exports.updateReservationStatusDB = async (reservationId, status, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const sql = `
        UPDATE reservations
        SET status = ?, updated_at = NOW()
        WHERE id = ? AND tenant_id = ?;
        `;
        await conn.query(sql, [status, reservationId, tenantId]);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.cancelReservationDB = async (reservationId, status, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        UPDATE reservations
        SET
        status = ?
        WHERE id = ? AND tenant_id = ?;
        `;

        await conn.query(sql, [status, reservationId, tenantId]);

        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
      }
};

exports.deleteReservationDB = async (reservationId, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        DELETE FROM reservations
        WHERE id = ? AND tenant_id = ?;
        `;

        await conn.query(sql, [reservationId, tenantId]);

        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
      }
};

/**
 * Column identifying the business a reservation belongs to.
 *
 * Selected only when consolidating, so a single-business response is exactly
 * what it was before Enterprise mode. Reservations are never merged or moved —
 * this is a label on a read-only view.
 */
const businessColumn = (scope, alias = "r") =>
    scope?.mode === "all" ? `${alias}.tenant_id AS business_tenant_id,` : "";

/**
 * Enterprise reservation search.
 *
 * Matches reservation id, unique code, customer phone, customer name and table
 * title. When consolidating, the caller may also pass `businessTenantIds` — the
 * ids of businesses whose NAME matches the term, resolved from the scope the
 * middleware already loaded, so "search by business" needs no join on `tenants`
 * and can never reach outside the group.
 */
exports.searchReservationsDB = async (search, scope, businessTenantIds = []) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params: tenantParams } = tenantFilter(scope, "r");

        const matches = [
            "r.id = ?",
            "r.customer_id = ?",
            "r.unique_code = ?",
            "c.`name` LIKE ?",
            "st.table_title LIKE ?",
        ];
        const matchParams = [search, search, search, `%${search}%`, `%${search}%`];

        if (businessTenantIds.length > 0) {
            matches.push("r.tenant_id IN (?)");
            matchParams.push(businessTenantIds);
        }

        const sql = `
        SELECT ${businessColumn(scope)} r.id, r.customer_id, COALESCE(c.name, r.customer_id) as customer_name, c.email as customer_email, r.date,
        r.table_id, st.table_title, st.seating_capacity, st.floor, r.status, r.notes, r.people_count, r.unique_code, r.created_at, r.updated_at
        FROM reservations r
        LEFT JOIN customers c ON r.customer_id = c.phone AND r.tenant_id = c.tenant_id
        LEFT JOIN store_tables st ON r.table_id = st.id AND st.tenant_id = r.tenant_id
        WHERE ${tenantSql} AND (${matches.join(" OR ")})
        ORDER BY r.date ASC
        LIMIT 50;
        `;
        conn.config.dateStrings = true;
        const [results] = await conn.query(sql, [...tenantParams, ...matchParams]);

        return results;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
      }
};

exports.getReservationsDB = async (type, from, to, scope) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const {filter, params} = getFilterConditionForReservationSearch(type, from, to, scope);

        const sql = `
        SELECT ${businessColumn(scope)} r.id, r.customer_id, COALESCE(c.name, r.customer_id) as customer_name, c.email as customer_email, r.date,
        r.table_id, st.table_title, st.seating_capacity, st.floor, r.status, r.notes, r.people_count, r.unique_code, r.created_at, r.updated_at
        FROM reservations r
        LEFT JOIN customers c ON r.customer_id = c.phone AND r.tenant_id = c.tenant_id
        LEFT JOIN store_tables st ON r.table_id = st.id AND st.tenant_id = r.tenant_id
        WHERE ${filter}
        ORDER BY r.date ASC
        `;

        conn.config.dateStrings=true;

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
 * Consolidated reservation KPIs — total, today, upcoming, and a count per
 * status. ONE query for the date-based figures plus one grouped by status.
 */
exports.getReservationSummaryDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        const [[totals], byStatus] = await Promise.all([
            conn.query(`
                SELECT
                    COUNT(*) AS total,
                    COUNT(CASE WHEN DATE(date) = CURDATE() THEN 1 END) AS today,
                    COUNT(CASE WHEN DATE(date) > CURDATE() AND status <> 'cancelled' THEN 1 END) AS upcoming,
                    COUNT(CASE WHEN DATE(date) = CURDATE() AND status = 'seated' THEN 1 END) AS seated,
                    COALESCE(SUM(CASE WHEN DATE(date) = CURDATE() THEN people_count ELSE 0 END), 0) AS guests_today,
                    COALESCE(SUM(people_count), 0) AS guests
                FROM reservations
                WHERE ${tenantSql};
            `, params).then(([rows]) => rows),
            conn.query(`
                SELECT COALESCE(NULLIF(status, ''), 'unknown') AS status, COUNT(*) AS count
                FROM reservations
                WHERE ${tenantSql}
                GROUP BY COALESCE(NULLIF(status, ''), 'unknown')
                ORDER BY count DESC;
            `, params).then(([rows]) => rows),
        ]);

        return { ...totals, byStatus };
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
      }
};

/**
 * Per-business reservation breakdown — powers "Reservations by Business" and
 * the status distribution. ONE `GROUP BY tenant_id`, never a per-business loop.
 */
exports.getReservationsByBusinessDB = async (scope) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const { sql: tenantSql, params } = tenantFilter(scope);

        // Only statuses the app can actually set: booked / paid / cancelled.
        const sql = `
        SELECT
            tenant_id,
            COUNT(*) AS total,
            COUNT(CASE WHEN DATE(date) = CURDATE() THEN 1 END) AS today,
            COUNT(CASE WHEN DATE(date) > CURDATE() AND status <> 'cancelled' THEN 1 END) AS upcoming,
            COUNT(CASE WHEN status = 'booked' THEN 1 END) AS booked,
            COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled,
            COALESCE(SUM(people_count), 0) AS guests
        FROM reservations
        WHERE ${tenantSql}
        GROUP BY tenant_id
        ORDER BY total DESC;
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
 * Date + tenant WHERE clause for reservation queries.
 *
 * `scope` is a resolved data scope (see middlewares/data_scope.middleware.js) so
 * the Enterprise dashboard can count reservations across a whole business group.
 * `tenantFilter` also accepts a bare tenant id, so every existing caller that
 * still passes `tenantId` is unaffected — `tenant_id IN (?)` with one id is
 * equivalent to the previous `= ?`.
 *
 * The tenant clause is always appended last, exactly as before, so the emitted
 * SQL and parameter order are unchanged for a single business.
 */
const getFilterConditionForReservationSearch = (type, from, to, scope) => {
    const params = [];
    let dateFilter = '';

    switch (type) {
        case 'custom': {
            params.push(from, to);
            dateFilter = `(DATE(date) >= ? AND DATE(date) <= ?) AND `;
            break;
        }
        case 'today': {
            dateFilter = `DATE(date) = CURDATE() AND `;
            break;
        }
        case 'this_month': {
            dateFilter = `YEAR(date) = YEAR(NOW()) AND MONTH(date) = MONTH(NOW()) AND `;
            break;
        }
        case 'last_month': {
            dateFilter = `DATE(date) >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND DATE(date) <= CURDATE() AND `;
            break;
        }
        case 'last_7days': {
            dateFilter = `DATE(date) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND DATE(date) <= CURDATE() AND `;
            break;
        }
        case 'yesterday': {
            dateFilter = `DATE(date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND `;
            break;
        }
        case 'tomorrow': {
            dateFilter = `DATE(date) = DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND `;
            break;
        }
        case 'all': {
            dateFilter = '';
            break;
        }
        default: {
            dateFilter = '';
        }
    }

    const tenant = tenantFilter(scope, "r");

    return { params: [...params, ...tenant.params], filter: `${dateFilter}${tenant.sql}` };
}
