const { getMySqlPromiseConnection } = require("../config/mysql.db")
const { tenantFilter } = require("../utils/tenant_scope")
const { reverseLoyaltyForVoidInvoiceTx } = require("./loyalty.service")
const { recordReversalTx, writeAuditTx } = require("./register.service")


/**
 * Column identifying the business an invoice belongs to.
 *
 * Only selected when consolidating, so a single-business response is exactly
 * what it was before Enterprise mode. Invoices are NEVER merged or renumbered —
 * this is a label on a read-only view; `invoices.id` and the per-business
 * `invoice_sequences` are untouched.
 */
const businessColumn = (scope, alias = "i") =>
    scope?.mode === "all" ? `${alias}.tenant_id AS business_tenant_id,` : "";


// Shared filter fragment so every revenue-aggregating invoice query across
// the app (dashboard, reports, customer insights, superadmin) excludes void
// invoices the same way. `prefix` is whatever needs to go in front of the
// column -- "i." for an aliased join, "" for an unaliased `invoices`.
exports.nonVoidInvoiceFilter = (prefix = "i.") => `${prefix}status != 'VOID'`;

exports.getInvoicesDB = async (type, from, to, scope) => {
  const conn = await getMySqlPromiseConnection();
    try {

        const {filter, params} = getFilterConditionForInvoices(type, from, to, scope)

        const sql = `
        SELECT
            ${businessColumn(scope)}
            o.invoice_id,
            o.id AS order_id,
            i.created_at,
            i.sub_total,
            i.tax_total,
            i.service_charge_total,
            i.discount_type,
            i.discount_value,
            i.discount_total,
            i.applied_promotions,
            i.promotion_discount_total,
            i.loyalty_points_redeemed,
            i.loyalty_discount_amount,
            i.loyalty_points_earned,
            i.customer_group_id,
            i.customer_group_name,
            i.customer_group_discount_total,
            i.total,
            i.status,
            i.voided_at,
            i.voided_by,
            i.void_reason,
            o.table_id,
            st.table_title,
            st.\`floor\`,
            o.payment_status,
            o.token_no,
            o.delivery_type,
            o.customer_type,
            o.customer_id,
            c.\`name\`,
            c.email,
            i.payment_type_id
        FROM
            orders o
            INNER JOIN invoices i ON o.invoice_id = i.id AND i.tenant_id = o.tenant_id
            LEFT JOIN customers c ON o.customer_id = c.phone AND c.tenant_id = o.tenant_id
            LEFT JOIN store_tables st ON o.table_id = st.id AND st.tenant_id = o.tenant_id
        WHERE ${filter}
        ORDER BY
            i.created_at DESC
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
 * Date + tenant WHERE clause for invoice queries.
 *
 * `scope` is a resolved data scope; `tenantFilter` also accepts a bare tenant
 * id, so any caller still passing one is unaffected. The tenant clause is
 * appended last exactly as before, so the parameter order is unchanged.
 */
const getFilterConditionForInvoices = (type, from, to, scope) => {
    const params = [];
    let dateFilter = '';

    switch (type) {
        case 'custom': {
            params.push(from, to);
            dateFilter = `DATE(i.created_at) >= ? AND DATE(i.created_at) <= ? AND `;
            break;
        }
        case 'today': {
            dateFilter = `DATE(i.created_at) = CURDATE() AND `;
            break;
        }
        case 'this_month': {
            dateFilter = `YEAR(i.created_at) = YEAR(NOW()) AND MONTH(i.created_at) = MONTH(NOW()) AND `;
            break;
        }
        case 'last_month': {
            dateFilter = `DATE(i.created_at) >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND DATE(i.created_at) <= CURDATE() AND `;
            break;
        }
        case 'last_7days': {
            dateFilter = `DATE(i.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND DATE(i.created_at) <= CURDATE() AND `;
            break;
        }
        case 'yesterday': {
            dateFilter = `DATE(i.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND `;
            break;
        }
        case 'tomorrow': {
            dateFilter = `DATE(i.created_at) = DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND `;
            break;
        }
        default: {
            dateFilter = '';
        }
    }

    const tenant = tenantFilter(scope, "i");

    return { params: [...params, ...tenant.params], filter: `${dateFilter}${tenant.sql}` };
}

exports.searchInvoicesDB = async (search, scope) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const { sql: tenantSql, params: tenantParams } = tenantFilter(scope, "i");

    // Matches invoice number, order id, customer phone, customer name and
    // payment method. `o.customer_id` holds the phone, so phone search already
    // worked; the payment-type join is what is new.
    const sql = `
    SELECT
      ${businessColumn(scope)}
      o.invoice_id,
      o.id AS order_id,
      i.created_at,
      i.sub_total,
      i.tax_total,
      i.service_charge_total,
      i.discount_type,
      i.discount_value,
      i.discount_total,
      i.applied_promotions,
      i.promotion_discount_total,
      i.customer_group_id,
      i.customer_group_name,
      i.customer_group_discount_total,
      i.total,
      i.status,
      i.voided_at,
      i.voided_by,
      i.void_reason,
      o.table_id,
      st.table_title,
      st.\`floor\`,
      o.payment_status,
      o.token_no,
      o.delivery_type,
      o.customer_type,
      o.customer_id,
      c.\`name\`,
      c.email,
      i.payment_type_id
    FROM
      orders o
      INNER JOIN invoices i ON o.invoice_id = i.id AND i.tenant_id = o.tenant_id
      LEFT JOIN customers c ON o.customer_id = c.phone AND c.tenant_id = o.tenant_id
      LEFT JOIN store_tables st ON o.table_id = st.id AND st.tenant_id = o.tenant_id
      LEFT JOIN payment_types pt ON pt.id = i.payment_type_id AND pt.tenant_id = i.tenant_id
    WHERE (
        o.invoice_id = ?
        OR o.id = ?
        OR o.customer_id LIKE ?
        OR c.\`name\` LIKE ?
        OR pt.title LIKE ?
      ) AND ${tenantSql}
    ORDER BY
      i.created_at DESC
    LIMIT 20
    `;

    const [results] = await conn.query(sql, [search, search, search, `%${search}%`, `%${search}%`, ...tenantParams]);
    return results;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};


/**
 * Orders, their items and addons behind an invoice.
 *
 * `orderIds` comes from the REQUEST BODY, so it is bound as parameters and the
 * result is restricted to the caller's own businesses. Before this change the
 * ids were concatenated into the statement and the query carried no tenant
 * filter at all, which let any authenticated user read another tenant's orders,
 * order items and customer names by guessing ids.
 *
 * `scope` is the resolved data scope: one business normally, the whole group
 * for a Business Group Owner viewing All Businesses.
 */
exports.getInvoiceOrdersDB = async (orderIds, scope) => {
  const conn = await getMySqlPromiseConnection();
    try {
      const ids = [...new Set((Array.isArray(orderIds) ? orderIds : String(orderIds).split(","))
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0))];

      if (ids.length === 0) {
        return { kitchenOrders: [], kitchenOrdersItems: [], addons: [] };
      }

      const { sql: tenantSql, params: tenantParams } = tenantFilter(scope, "o");

      const sql = `
      SELECT
        o.id,
        o.tenant_id AS business_tenant_id,
        o.date,
        o.delivery_type,
        o.customer_type,
        o.customer_id,
        c. \`name\` AS customer_name,
        o.table_id,
        st.table_title,
        st. \`floor\`,
        o.status,
        o.payment_status,
        o.token_no,
        o.customer_group_id,
        o.customer_group_name,
        o.customer_group_discount_total
      FROM
        orders o
        LEFT JOIN customers c ON o.customer_id = c.phone AND c.tenant_id = o.tenant_id
        LEFT JOIN store_tables st ON o.table_id = st.id AND st.tenant_id = o.tenant_id
      WHERE
        o.status NOT IN ('cancelled')
        AND o.id IN (?)
        AND ${tenantSql}
      `;

      const [kitchenOrders] = await conn.query(sql, [ids, ...tenantParams]);

      let kitchenOrdersItems = [];
      let addons = [];

      if(kitchenOrders.length > 0) {
        // Derived from the already tenant-filtered rows above, and still bound.
        const foundOrderIds = kitchenOrders.map(o=>o.id);
        const { sql: itemsTenantSql, params: itemsTenantParams } = tenantFilter(scope, "oi");

        const sql2 = `
        SELECT
          oi.id,
          oi.order_id,
          oi.item_id,
          mi.title AS item_title,
          oi.variant_id,
          miv.title as variant_title,
          miv.price as variant_price,
          mi.price,
          mi.tax_id,
          t.title as tax_title,
          t.rate as tax_rate,
          t.type as tax_type,
          oi.quantity,
          oi.status,
          oi.date,
          oi.addons,
          oi.notes
        FROM
          order_items oi
          LEFT JOIN menu_items mi ON oi.item_id = mi.id AND mi.tenant_id = oi.tenant_id
          LEFT JOIN menu_item_variants miv ON oi.item_id = miv.item_id AND oi.variant_id = miv.id
          LEFT JOIN taxes t ON mi.tax_id = t.id AND t.tenant_id = mi.tenant_id

        WHERE oi.order_id IN (?) AND oi.status NOT IN ('cancelled') AND ${itemsTenantSql}
        `
        const [kitchenOrdersItemsResult] = await conn.query(sql2, [foundOrderIds, ...itemsTenantParams]);
        kitchenOrdersItems = kitchenOrdersItemsResult;

        const rawAddons = kitchenOrdersItems.flatMap((o) => {
          try {
            return o.addons ? JSON.parse(o.addons) : [];
          } catch (e) {
            return [];
          }
        });

        const numericIds = [...new Set(
          rawAddons
            .map((a) => (typeof a === "object" && a !== null ? a.id : a))
            .filter((a) => a !== null && a !== undefined && !isNaN(Number(a)))
            .map(Number)
        )];

        const titleNames = [...new Set(
          rawAddons
            .map((a) => (typeof a === "object" && a !== null ? a.title : a))
            .filter((a) => typeof a === "string" && isNaN(Number(a)) && a.trim().length > 0)
        )];

        if (numericIds.length > 0 || titleNames.length > 0) {
          const { sql: addonTenantSql, params: addonTenantParams } = tenantFilter(scope, "menu_item_addons");
          const whereClauses = [];
          const queryParams = [];

          if (numericIds.length > 0) {
            whereClauses.push(`id IN (?)`);
            queryParams.push(numericIds);
          }
          if (titleNames.length > 0) {
            whereClauses.push(`title IN (?)`);
            queryParams.push(titleNames);
          }

          const [addonsResult] = await conn.query(
            `SELECT id, item_id, title, price FROM menu_item_addons WHERE (${whereClauses.join(" OR ")}) AND ${addonTenantSql};`,
            [...queryParams, ...addonTenantParams]
          );
          addons = addonsResult || [];
        }
      }

      return {
        kitchenOrders,
        kitchenOrdersItems,
        addons
      }

    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      conn.release();
    }
  };

  exports.getInvoiceByIdDB = async (id, scope) => {
    const conn = await getMySqlPromiseConnection();
      try {
          const { sql: tenantSql, params: tenantParams } = tenantFilter(scope, "i");

          const sql = `
          SELECT
              i.id,
              i.tenant_id AS business_tenant_id,
              i.created_at,
              i.sub_total,
              i.tax_total,
              i.service_charge_total,
              i.discount_type,
              i.discount_value,
              i.discount_total,
              i.applied_promotions,
              i.promotion_discount_total,
              i.loyalty_points_redeemed,
              i.loyalty_discount_amount,
              i.loyalty_points_earned,
              i.customer_group_id,
              i.customer_group_name,
              i.customer_group_discount_total,
              i.total,
              i.payment_type_id,
              i.status,
              i.voided_at,
              i.voided_by,
              i.void_reason
          FROM
              invoices i
          WHERE i.id = ? AND ${tenantSql}
          `;

          const [results] = await conn.query(sql, [id, ...tenantParams]);
          return results[0];
      } catch (error) {
          console.error(error);
          throw error;
      } finally {
        conn.release();
    }
  };

/**
 * Void an invoice: flips status to VOID. Purely a financial/accounting
 * action -- it never touches inventory. Whatever stock an order's items
 * deducted stays deducted even after the invoice that produced them is
 * voided. Orders themselves are only ever read here, never written to --
 * a void must never touch order status, payment status or invoice_id.
 *
 * The FOR UPDATE row lock + status check inside one transaction is what
 * prevents a double-void if this is somehow called twice concurrently.
 */
/**
 * Register side of a void: whatever is still un-refunded on the invoice is paid
 * back from `session` (the till doing the void), falling back to the invoice's
 * own session while it is still open. Voiding an invoice whose session has
 * already been Z-closed changes that day's takings, so it needs
 * `allowClosedSession` (REGISTER_MANAGE).
 */
exports.voidInvoiceDB = async (invoiceId, tenantId, reason, username, { session = null, allowClosedSession = false } = {}) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [invoiceRows] = await conn.query(
      `SELECT id, status, total, refunded_total, register_session_id FROM invoices WHERE id = ? AND tenant_id = ? FOR UPDATE`,
      [invoiceId, tenantId]
    );
    const invoice = invoiceRows[0];

    if (!invoice) {
      throw Object.assign(new Error("invoice_not_found"), { code: "INVOICE_NOT_FOUND" });
    }
    if (invoice.status === "VOID") {
      throw Object.assign(new Error("invoice_already_voided"), { code: "INVOICE_ALREADY_VOIDED" });
    }

    let originalSession = null;
    if (invoice.register_session_id) {
      const [sessionRows] = await conn.query(
        `SELECT id, register_id, status FROM register_sessions WHERE id = ? AND tenant_id = ?`,
        [invoice.register_session_id, tenantId]
      );
      originalSession = sessionRows[0] || null;
      if (originalSession?.status === "CLOSED" && !allowClosedSession) {
        throw Object.assign(new Error("invoice_session_closed"), { code: "INVOICE_SESSION_CLOSED" });
      }
    }
    const payoutSession = session || (originalSession?.status === "OPEN" ? originalSession : null);

    await conn.query(
      `UPDATE invoices SET status = 'VOID', voided_at = NOW(), voided_by = ?, void_reason = ? WHERE id = ? AND tenant_id = ?`,
      [username, reason, invoiceId, tenantId]
    );

    await conn.query(
      `INSERT INTO invoice_audit_log
       (tenant_id, invoice_id, invoice_number, action, performed_by, reason, previous_status, new_status)
       VALUES (?, ?, ?, 'VOID', ?, ?, ?, 'VOID')`,
      [tenantId, invoiceId, invoiceId, username, reason, invoice.status]
    );

    await recordReversalTx(conn, {
      tenantId,
      session: payoutSession,
      source: "VOID",
      invoiceId: Number(invoiceId),
      amount: Number(invoice.total || 0) - Number(invoice.refunded_total || 0),
      createdBy: username,
    });
    if (payoutSession) {
      await writeAuditTx(conn, {
        tenantId,
        registerId: payoutSession.register_id,
        sessionId: payoutSession.id,
        action: "VOID",
        details: { invoiceId: Number(invoiceId), amount: Number(invoice.total || 0) - Number(invoice.refunded_total || 0), reason },
        performedBy: username,
      });
    }

    // Reverse any earned or redeemed loyalty points for this invoice
    await reverseLoyaltyForVoidInvoiceTx(conn, {
      invoiceId,
      tenantId,
      userId: username,
      reason
    });

    await conn.commit();

    return { id: invoiceId, status: "VOID" };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Order ids belonging to an invoice. Read-only, outside voidInvoiceDB's
 * transaction on purpose -- it's supplementary data for the void notification
 * (so a push can deep-link straight to the invoice), not part of the void's
 * own atomicity guarantee.
 */
exports.getOrderIdsForInvoiceDB = async (invoiceId, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT id FROM orders WHERE invoice_id = ? AND tenant_id = ?`,
      [invoiceId, tenantId]
    );
    return rows.map((r) => r.id);
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    conn.release();
  }
};

