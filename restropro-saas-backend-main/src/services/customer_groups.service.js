const { getMySqlPromiseConnection } = require("../config/mysql.db");

/**
 * Get all customer groups for a tenant with customer counts
 */
exports.getCustomerGroupsDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      SELECT 
        cg.id, cg.tenant_id, cg.name, cg.code, cg.color, cg.description,
        cg.is_default, cg.is_active, cg.discount_type, cg.discount_value,
        cg.apply_to, cg.target_category_ids, cg.min_order_amount, cg.max_discount_cap,
        cg.created_at, cg.updated_at,
        COUNT(c.phone) AS customer_count
      FROM customer_groups cg
      LEFT JOIN customers c ON c.customer_group_id = cg.id AND c.tenant_id = cg.tenant_id
      WHERE cg.tenant_id = ?
      GROUP BY cg.id
      ORDER BY cg.is_default DESC, cg.name ASC;
    `;

    const [rows] = await conn.query(sql, [tenantId]);

    return rows.map((r) => ({
      ...r,
      is_default: Boolean(r.is_default),
      is_active: Boolean(r.is_active),
      discount_value: Number(r.discount_value || 0),
      min_order_amount: Number(r.min_order_amount || 0),
      max_discount_cap: r.max_discount_cap != null ? Number(r.max_discount_cap) : null,
      customer_count: Number(r.customer_count || 0),
      target_category_ids: typeof r.target_category_ids === "string" 
        ? JSON.parse(r.target_category_ids) 
        : r.target_category_ids || [],
    }));
  } catch (error) {
    console.error("getCustomerGroupsDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Get single customer group by ID
 */
exports.getCustomerGroupByIdDB = async (id, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      SELECT 
        cg.id, cg.tenant_id, cg.name, cg.code, cg.color, cg.description,
        cg.is_default, cg.is_active, cg.discount_type, cg.discount_value,
        cg.apply_to, cg.target_category_ids, cg.min_order_amount, cg.max_discount_cap,
        cg.created_at, cg.updated_at,
        COUNT(c.phone) AS customer_count
      FROM customer_groups cg
      LEFT JOIN customers c ON c.customer_group_id = cg.id AND c.tenant_id = cg.tenant_id
      WHERE cg.id = ? AND cg.tenant_id = ?
      GROUP BY cg.id
      LIMIT 1;
    `;

    const [rows] = await conn.query(sql, [id, tenantId]);
    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      ...r,
      is_default: Boolean(r.is_default),
      is_active: Boolean(r.is_active),
      discount_value: Number(r.discount_value || 0),
      min_order_amount: Number(r.min_order_amount || 0),
      max_discount_cap: r.max_discount_cap != null ? Number(r.max_discount_cap) : null,
      customer_count: Number(r.customer_count || 0),
      target_category_ids: typeof r.target_category_ids === "string" 
        ? JSON.parse(r.target_category_ids) 
        : r.target_category_ids || [],
    };
  } catch (error) {
    console.error("getCustomerGroupByIdDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Get default customer group for tenant
 */
exports.getDefaultCustomerGroupDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const sql = `
      SELECT id, name, code, color, discount_type, discount_value, apply_to, target_category_ids, min_order_amount, max_discount_cap
      FROM customer_groups
      WHERE tenant_id = ? AND is_default = 1 AND is_active = 1
      LIMIT 1;
    `;
    const [rows] = await conn.query(sql, [tenantId]);
    if (rows.length === 0) return null;
    return rows[0];
  } catch (error) {
    console.error("getDefaultCustomerGroupDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Create new customer group
 */
exports.createCustomerGroupDB = async (tenantId, data) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const {
      name,
      code = null,
      color = "#6366f1",
      description = null,
      is_default = false,
      is_active = true,
      discount_type = "PERCENTAGE",
      discount_value = 0,
      apply_to = "ALL",
      target_category_ids = [],
      min_order_amount = 0,
      max_discount_cap = null,
    } = data;

    // If marked default, unset default on other groups for this tenant
    if (is_default) {
      await conn.query(
        `UPDATE customer_groups SET is_default = 0 WHERE tenant_id = ?`,
        [tenantId]
      );
    }

    const targetCategoriesJson = Array.isArray(target_category_ids) && target_category_ids.length > 0
      ? JSON.stringify(target_category_ids)
      : null;

    const sql = `
      INSERT INTO customer_groups
      (tenant_id, name, code, color, description, is_default, is_active, discount_type, discount_value, apply_to, target_category_ids, min_order_amount, max_discount_cap)
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const [result] = await conn.query(sql, [
      tenantId,
      name,
      code,
      color || "#6366f1",
      description,
      is_default ? 1 : 0,
      is_active ? 1 : 0,
      discount_type || "PERCENTAGE",
      Number(discount_value || 0),
      apply_to || "ALL",
      targetCategoriesJson,
      Number(min_order_amount || 0),
      max_discount_cap != null && max_discount_cap !== "" ? Number(max_discount_cap) : null,
    ]);

    await conn.commit();
    return result.insertId;
  } catch (error) {
    await conn.rollback();
    console.error("createCustomerGroupDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Update existing customer group
 */
exports.updateCustomerGroupDB = async (id, tenantId, data) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const {
      name,
      code = null,
      color = "#6366f1",
      description = null,
      is_default = false,
      is_active = true,
      discount_type = "PERCENTAGE",
      discount_value = 0,
      apply_to = "ALL",
      target_category_ids = [],
      min_order_amount = 0,
      max_discount_cap = null,
    } = data;

    // If marked default, unset default on other groups for this tenant
    if (is_default) {
      await conn.query(
        `UPDATE customer_groups SET is_default = 0 WHERE tenant_id = ? AND id != ?`,
        [tenantId, id]
      );
    }

    const targetCategoriesJson = Array.isArray(target_category_ids) && target_category_ids.length > 0
      ? JSON.stringify(target_category_ids)
      : null;

    const sql = `
      UPDATE customer_groups
      SET 
        name = ?,
        code = ?,
        color = ?,
        description = ?,
        is_default = ?,
        is_active = ?,
        discount_type = ?,
        discount_value = ?,
        apply_to = ?,
        target_category_ids = ?,
        min_order_amount = ?,
        max_discount_cap = ?
      WHERE id = ? AND tenant_id = ?;
    `;

    await conn.query(sql, [
      name,
      code,
      color || "#6366f1",
      description,
      is_default ? 1 : 0,
      is_active ? 1 : 0,
      discount_type || "PERCENTAGE",
      Number(discount_value || 0),
      apply_to || "ALL",
      targetCategoriesJson,
      Number(min_order_amount || 0),
      max_discount_cap != null && max_discount_cap !== "" ? Number(max_discount_cap) : null,
      id,
      tenantId,
    ]);

    await conn.commit();
    return true;
  } catch (error) {
    await conn.rollback();
    console.error("updateCustomerGroupDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Delete customer group with safe reassignment
 */
exports.deleteCustomerGroupDB = async (id, tenantId, reassignTo = "none") => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    let targetGroupId = null;
    if (reassignTo === "default") {
      const [defaults] = await conn.query(
        `SELECT id FROM customer_groups WHERE tenant_id = ? AND is_default = 1 AND id != ? LIMIT 1`,
        [tenantId, id]
      );
      if (defaults.length > 0) {
        targetGroupId = defaults[0].id;
      }
    } else if (Number.isInteger(Number(reassignTo)) && Number(reassignTo) > 0) {
      targetGroupId = Number(reassignTo);
    }

    // Reassign existing customers in this group
    await conn.query(
      `UPDATE customers SET customer_group_id = ? WHERE customer_group_id = ? AND tenant_id = ?`,
      [targetGroupId, id, tenantId]
    );

    // Delete the group
    const [result] = await conn.query(
      `DELETE FROM customer_groups WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );

    await conn.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await conn.rollback();
    console.error("deleteCustomerGroupDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Bulk assign customers to a group
 */
exports.bulkAssignCustomerGroupDB = async (tenantId, customerPhones = [], customerGroupId = null) => {
  if (!Array.isArray(customerPhones) || customerPhones.length === 0) return 0;
  const conn = await getMySqlPromiseConnection();
  try {
    const groupId = customerGroupId != null && Number(customerGroupId) > 0 ? Number(customerGroupId) : null;
    const sql = `
      UPDATE customers 
      SET customer_group_id = ?
      WHERE phone IN (?) AND tenant_id = ?;
    `;
    const [result] = await conn.query(sql, [groupId, customerPhones, tenantId]);
    return result.affectedRows;
  } catch (error) {
    console.error("bulkAssignCustomerGroupDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};
