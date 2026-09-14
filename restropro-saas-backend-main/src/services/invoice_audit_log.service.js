const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { tenantFilter } = require("../utils/tenant_scope");

const getDateRangeFilter = (type, from, to) => {
  const params = [];
  let filter = "";

  switch (type) {
    case "custom": {
      params.push(from, to);
      filter = `DATE(al.created_at) >= ? AND DATE(al.created_at) <= ?`;
      break;
    }
    case "today": {
      filter = `DATE(al.created_at) = CURDATE()`;
      break;
    }
    case "yesterday": {
      filter = `DATE(al.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`;
      break;
    }
    case "last_7days": {
      filter = `DATE(al.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND DATE(al.created_at) <= CURDATE()`;
      break;
    }
    case "this_month": {
      filter = `YEAR(al.created_at) = YEAR(NOW()) AND MONTH(al.created_at) = MONTH(NOW())`;
      break;
    }
    case "last_month": {
      filter = `DATE(al.created_at) >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND DATE(al.created_at) <= CURDATE()`;
      break;
    }
    default: {
      filter = "1 = 1";
    }
  }

  return { params, filter };
};

const SELECT_COLUMNS = `
  al.id,
  al.invoice_id,
  al.invoice_number,
  al.action,
  al.performed_by,
  u.name AS performed_by_name,
  al.reason,
  al.previous_status,
  al.new_status,
  al.created_at
`;

const businessColumn = (scope, alias = "al") =>
  scope?.mode === "all" ? `${alias}.tenant_id AS business_tenant_id,` : "";

exports.getInvoiceAuditLogsDB = async (scope, {
  page = 1,
  perPage = 10,
  invoiceNumber = "",
  performedBy = "",
  action = "",
  type = "",
  from = null,
  to = null,
} = {}) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(perPage, 10) || 10, 1), 100);
    const offset = (currentPage - 1) * limit;

    const { params: dateParams, filter: dateFilter } = getDateRangeFilter(type, from, to);
    const { sql: tenantSql, params: tenantParams } = tenantFilter(scope, "al");

    const conditions = [tenantSql, dateFilter];
    const params = [...tenantParams, ...dateParams];

    if (invoiceNumber) {
      conditions.push(`al.invoice_number LIKE ?`);
      params.push(`%${invoiceNumber}%`);
    }

    if (performedBy) {
      conditions.push(`(al.performed_by LIKE ? OR u.name LIKE ?)`);
      params.push(`%${performedBy}%`, `%${performedBy}%`);
    }

    if (action) {
      conditions.push(`al.action = ?`);
      params.push(action);
    }

    const whereClause = conditions.join(" AND ");

    const sql = `
      SELECT
        ${businessColumn(scope)}
        ${SELECT_COLUMNS}
      FROM invoice_audit_log al
      LEFT JOIN users u ON u.username = al.performed_by AND u.tenant_id = al.tenant_id
      WHERE ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM invoice_audit_log al
      LEFT JOIN users u ON u.username = al.performed_by AND u.tenant_id = al.tenant_id
      WHERE ${whereClause}
    `;

    const [[auditLogs], [countResult]] = await Promise.all([
      conn.query(sql, [...params, limit, offset]),
      conn.query(countSql, params),
    ]);

    const totalAuditLogs = countResult[0].total;

    return {
      auditLogs,
      currentPage,
      perPage: limit,
      totalPages: Math.ceil(totalAuditLogs / limit),
      totalAuditLogs,
    };
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

exports.getInvoiceAuditLogsForInvoiceDB = async (scope, invoiceId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const { sql: tenantSql, params: tenantParams } = tenantFilter(scope, "al");

    const sql = `
      SELECT
        ${businessColumn(scope)}
        ${SELECT_COLUMNS}
      FROM invoice_audit_log al
      LEFT JOIN users u ON u.username = al.performed_by AND u.tenant_id = al.tenant_id
      WHERE ${tenantSql} AND al.invoice_id = ?
      ORDER BY al.created_at DESC
    `;

    const [auditLogs] = await conn.query(sql, [...tenantParams, invoiceId]);
    return auditLogs;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};
