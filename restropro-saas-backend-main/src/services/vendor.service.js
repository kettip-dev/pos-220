const { getMySqlPromiseConnection } = require("../config/mysql.db");

/**
 * Add a new Supplier / Vendor
 */
exports.addVendorDB = async (data, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const {
      name,
      contactPerson,
      phone,
      email,
      telegram,
      addressLine1,
      addressLine2,
      city,
      state,
      country,
      zipcode,
      taxIdNo,
      paymentTerms,
      bankDetails,
      notes,
    } = data;

    const sql = `
      INSERT INTO inventory_vendors
      (tenant_id, name, contact_person, phone, email, telegram, address_line1, address_line2,
       city, state, country, zipcode, tax_id_no, payment_terms, bank_details, notes, is_active)
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1);
    `;

    const [result] = await conn.query(sql, [
      tenantId,
      name,
      contactPerson || null,
      phone || null,
      email || null,
      telegram || null,
      addressLine1 || null,
      addressLine2 || null,
      city || null,
      state || null,
      country || null,
      zipcode || null,
      taxIdNo || null,
      paymentTerms || null,
      bankDetails || null,
      notes || null,
    ]);

    return result.insertId;
  } catch (error) {
    console.error("addVendorDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Get paginated list of vendors with aggregated order counts and spend
 */
exports.getVendorsDB = async (page = 1, perPage = 10, search = "", tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(perPage, 10) || 10, 1), 100);
    const offset = (currentPage - 1) * limit;

    let filterClause = "WHERE v.tenant_id = ?";
    const filterParams = [tenantId];

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      filterClause += " AND (v.name LIKE ? OR v.contact_person LIKE ? OR v.phone LIKE ? OR v.email LIKE ? OR v.telegram LIKE ?)";
      filterParams.push(q, q, q, q, q);
    }

    const sql = `
      SELECT
        v.id,
        v.tenant_id,
        v.name,
        v.contact_person,
        v.phone,
        v.email,
        v.telegram,
        v.address_line1,
        v.address_line2,
        v.city,
        v.state,
        v.country,
        v.zipcode,
        v.tax_id_no,
        v.payment_terms,
        v.bank_details,
        v.notes,
        v.is_active,
        v.created_at,
        v.updated_at,
        COALESCE(po_stats.total_orders, 0) AS total_orders,
        COALESCE(po_stats.total_spend, 0) AS total_spend
      FROM inventory_vendors v
      LEFT JOIN (
        SELECT
          vendor_id,
          COUNT(id) AS total_orders,
          SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) AS total_spend
        FROM inventory_purchase_orders
        WHERE tenant_id = ?
        GROUP BY vendor_id
      ) po_stats ON po_stats.vendor_id = v.id
      ${filterClause}
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?;
    `;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM inventory_vendors v
      ${filterClause};
    `;

    const [vendors] = await conn.query(sql, [tenantId, ...filterParams, limit, offset]);
    const [countRes] = await conn.query(countSql, filterParams);

    const total = countRes[0]?.total || 0;

    return {
      vendors,
      currentPage,
      perPage: limit,
      totalPages: Math.ceil(total / limit),
      totalVendors: total,
    };
  } catch (error) {
    console.error("getVendorsDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Get single vendor with details and recent purchase orders
 */
exports.getVendorDetailsDB = async (id, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [vendors] = await conn.query(
      `SELECT
        v.*,
        COALESCE(po_stats.total_orders, 0) AS total_orders,
        COALESCE(po_stats.total_spend, 0) AS total_spend
       FROM inventory_vendors v
       LEFT JOIN (
         SELECT
           vendor_id,
           COUNT(id) AS total_orders,
           SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) AS total_spend
         FROM inventory_purchase_orders
         WHERE tenant_id = ?
         GROUP BY vendor_id
       ) po_stats ON po_stats.vendor_id = v.id
       WHERE v.id = ? AND v.tenant_id = ?
       LIMIT 1;`,
      [tenantId, id, tenantId]
    );

    if (vendors.length === 0) return null;
    const vendor = vendors[0];

    // Fetch up to 10 recent purchase orders for this vendor
    const [recentOrders] = await conn.query(
      `SELECT id, total_amount, currency, status, created_at, fullfilled_at, notes
       FROM inventory_purchase_orders
       WHERE vendor_id = ? AND tenant_id = ?
       ORDER BY created_at DESC
       LIMIT 10;`,
      [id, tenantId]
    );

    vendor.recentOrders = recentOrders;
    return vendor;
  } catch (error) {
    console.error("getVendorDetailsDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Update an existing vendor
 */
exports.updateVendorDB = async (id, data, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const {
      name,
      contactPerson,
      phone,
      email,
      telegram,
      addressLine1,
      addressLine2,
      city,
      state,
      country,
      zipcode,
      taxIdNo,
      paymentTerms,
      bankDetails,
      notes,
      isActive,
    } = data;

    const sql = `
      UPDATE inventory_vendors
      SET
        name = ?,
        contact_person = ?,
        phone = ?,
        email = ?,
        telegram = ?,
        address_line1 = ?,
        address_line2 = ?,
        city = ?,
        state = ?,
        country = ?,
        zipcode = ?,
        tax_id_no = ?,
        payment_terms = ?,
        bank_details = ?,
        notes = ?,
        is_active = COALESCE(?, is_active),
        updated_at = NOW()
      WHERE id = ? AND tenant_id = ?;
    `;

    const [result] = await conn.query(sql, [
      name,
      contactPerson || null,
      phone || null,
      email || null,
      telegram || null,
      addressLine1 || null,
      addressLine2 || null,
      city || null,
      state || null,
      country || null,
      zipcode || null,
      taxIdNo || null,
      paymentTerms || null,
      bankDetails || null,
      notes || null,
      typeof isActive === "boolean" ? (isActive ? 1 : 0) : null,
      id,
      tenantId,
    ]);

    return result.affectedRows > 0;
  } catch (error) {
    console.error("updateVendorDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Delete a vendor (checks if open POs exist before deleting)
 */
exports.deleteVendorDB = async (id, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [orders] = await conn.query(
      `SELECT COUNT(*) AS open_count FROM inventory_purchase_orders WHERE vendor_id = ? AND tenant_id = ? AND status = 'ordered'`,
      [id, tenantId]
    );

    if (orders[0]?.open_count > 0) {
      const err = new Error("Cannot delete supplier with active pending purchase orders.");
      err.code = "HAS_ACTIVE_ORDERS";
      throw err;
    }

    const [result] = await conn.query(
      `DELETE FROM inventory_vendors WHERE id = ? AND tenant_id = ?;`,
      [id, tenantId]
    );

    return result.affectedRows > 0;
  } catch (error) {
    console.error("deleteVendorDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Get simple list of all active suppliers for dropdown select
 */
exports.getAllVendorsSimpleDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [vendors] = await conn.query(
      `SELECT id, name, contact_person, phone, email, telegram, payment_terms, bank_details, tax_id_no, address_line1, city
       FROM inventory_vendors
       WHERE tenant_id = ? AND is_active = 1
       ORDER BY name ASC;`,
      [tenantId]
    );
    return vendors;
  } catch (error) {
    console.error("getAllVendorsSimpleDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};
