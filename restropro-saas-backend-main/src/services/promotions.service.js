const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { evaluateCartPromotions } = require("../utils/promotionEvaluator");

/**
 * Get all promotions for a tenant with optional filtering and summary stats
 */
exports.getPromotions = async (tenantId, { search, status } = {}) => {
  const conn = await getMySqlPromiseConnection();
  try {
    let sql = `SELECT * FROM promotions WHERE tenant_id = ?`;
    const params = [tenantId];

    if (status === 'active') {
      sql += ` AND is_active = 1`;
    } else if (status === 'inactive') {
      sql += ` AND is_active = 0`;
    }

    if (search && search.trim()) {
      sql += ` AND (title LIKE ? OR promo_code LIKE ? OR description LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY created_at DESC`;

    const [rows] = await conn.query(sql, params);

    // Summary statistics
    const [statsRows] = await conn.query(`
      SELECT 
        COUNT(*) as total_promos,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_promos,
        SUM(times_redeemed) as total_redemptions
      FROM promotions
      WHERE tenant_id = ?
    `, [tenantId]);

    // Total discount given from invoices
    const [invoiceStats] = await conn.query(`
      SELECT COALESCE(SUM(promotion_discount_total), 0) as total_discount_given
      FROM invoices
      WHERE tenant_id = ? AND (status IS NULL OR status != 'voided')
    `, [tenantId]);

    const stats = {
      totalPromos: Number(statsRows[0]?.total_promos || 0),
      activePromos: Number(statsRows[0]?.active_promos || 0),
      totalRedemptions: Number(statsRows[0]?.total_redemptions || 0),
      totalDiscountGiven: Number(invoiceStats[0]?.total_discount_given || 0),
    };

    return { promotions: rows, stats };
  } finally {
    conn.release();
  }
};

/**
 * Get single promotion by ID
 */
exports.getPromotionById = async (id, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT * FROM promotions WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    return rows[0] || null;
  } finally {
    conn.release();
  }
};

/**
 * Create a new promotion
 */
exports.createPromotion = async (tenantId, data) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const {
      title,
      description = null,
      promo_code = null,
      promo_type = 'ORDER_PERCENTAGE',
      discount_value = 0,
      max_discount_cap = null,
      min_order_amount = 0,
      apply_to = 'ALL',
      target_category_ids = null,
      target_item_ids = null,
      buy_qty = 1,
      get_qty = 1,
      get_discount_percent = 100,
      is_automatic = 1,
      is_stackable = 0,
      dining_options = null,
      applicable_customer_group_ids = null,
      start_date = null,
      end_date = null,
      start_time = null,
      end_time = null,
      days_of_week = null,
      usage_limit_total = null,
      is_active = 1,
    } = data;

    if (!title || !title.trim()) {
      throw new Error("Promotion title is required.");
    }

    const cleanCode = promo_code && promo_code.trim() ? promo_code.trim().toUpperCase() : null;

    // Check unique code within tenant
    if (cleanCode) {
      const [existing] = await conn.query(
        `SELECT id FROM promotions WHERE tenant_id = ? AND promo_code = ?`,
        [tenantId, cleanCode]
      );
      if (existing.length > 0) {
        throw new Error(`Promotion code "${cleanCode}" is already in use.`);
      }
    }

    const sql = `
      INSERT INTO promotions (
        tenant_id, title, description, promo_code, promo_type,
        discount_value, max_discount_cap, min_order_amount, apply_to,
        target_category_ids, target_item_ids, buy_qty, get_qty,
        get_discount_percent, is_automatic, is_stackable, dining_options,
        applicable_customer_group_ids,
        start_date, end_date, start_time, end_time, days_of_week,
        usage_limit_total, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await conn.query(sql, [
      tenantId,
      title.trim(),
      description || null,
      cleanCode,
      promo_type,
      Number(discount_value) || 0,
      max_discount_cap != null && max_discount_cap !== '' ? Number(max_discount_cap) : null,
      Number(min_order_amount) || 0,
      apply_to,
      target_category_ids ? JSON.stringify(target_category_ids) : null,
      target_item_ids ? JSON.stringify(target_item_ids) : null,
      Number(buy_qty) || 1,
      Number(get_qty) || 1,
      Number(get_discount_percent) || 100,
      is_automatic ? 1 : 0,
      is_stackable ? 1 : 0,
      dining_options ? JSON.stringify(dining_options) : null,
      applicable_customer_group_ids ? JSON.stringify(applicable_customer_group_ids) : null,
      start_date || null,
      end_date || null,
      start_time || null,
      end_time || null,
      days_of_week ? JSON.stringify(days_of_week) : null,
      usage_limit_total != null && usage_limit_total !== '' ? Number(usage_limit_total) : null,
      is_active ? 1 : 0,
    ]);

    return { id: result.insertId };
  } finally {
    conn.release();
  }
};

/**
 * Update existing promotion
 */
exports.updatePromotion = async (id, tenantId, data) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [existingRows] = await conn.query(
      `SELECT id FROM promotions WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    if (existingRows.length === 0) {
      throw new Error("Promotion not found.");
    }

    const {
      title,
      description = null,
      promo_code = null,
      promo_type,
      discount_value,
      max_discount_cap = null,
      min_order_amount = 0,
      apply_to,
      target_category_ids = null,
      target_item_ids = null,
      buy_qty = 1,
      get_qty = 1,
      get_discount_percent = 100,
      is_automatic = 1,
      is_stackable = 0,
      dining_options = null,
      applicable_customer_group_ids = null,
      start_date = null,
      end_date = null,
      start_time = null,
      end_time = null,
      days_of_week = null,
      usage_limit_total = null,
      is_active = 1,
    } = data;

    if (!title || !title.trim()) {
      throw new Error("Promotion title is required.");
    }

    const cleanCode = promo_code && promo_code.trim() ? promo_code.trim().toUpperCase() : null;

    if (cleanCode) {
      const [duplicate] = await conn.query(
        `SELECT id FROM promotions WHERE tenant_id = ? AND promo_code = ? AND id != ?`,
        [tenantId, cleanCode, id]
      );
      if (duplicate.length > 0) {
        throw new Error(`Promotion code "${cleanCode}" is already in use by another promotion.`);
      }
    }

    const sql = `
      UPDATE promotions SET
        title = ?, description = ?, promo_code = ?, promo_type = ?,
        discount_value = ?, max_discount_cap = ?, min_order_amount = ?, apply_to = ?,
        target_category_ids = ?, target_item_ids = ?, buy_qty = ?, get_qty = ?,
        get_discount_percent = ?, is_automatic = ?, is_stackable = ?, dining_options = ?,
        applicable_customer_group_ids = ?,
        start_date = ?, end_date = ?, start_time = ?, end_time = ?, days_of_week = ?,
        usage_limit_total = ?, is_active = ?
      WHERE id = ? AND tenant_id = ?
    `;

    await conn.query(sql, [
      title.trim(),
      description || null,
      cleanCode,
      promo_type,
      Number(discount_value) || 0,
      max_discount_cap != null && max_discount_cap !== '' ? Number(max_discount_cap) : null,
      Number(min_order_amount) || 0,
      apply_to,
      target_category_ids ? JSON.stringify(target_category_ids) : null,
      target_item_ids ? JSON.stringify(target_item_ids) : null,
      Number(buy_qty) || 1,
      Number(get_qty) || 1,
      Number(get_discount_percent) || 100,
      is_automatic ? 1 : 0,
      is_stackable ? 1 : 0,
      dining_options ? JSON.stringify(dining_options) : null,
      applicable_customer_group_ids ? JSON.stringify(applicable_customer_group_ids) : null,
      start_date || null,
      end_date || null,
      start_time || null,
      end_time || null,
      days_of_week ? JSON.stringify(days_of_week) : null,
      usage_limit_total != null && usage_limit_total !== '' ? Number(usage_limit_total) : null,
      is_active ? 1 : 0,
      id,
      tenantId,
    ]);

    return { success: true };
  } finally {
    conn.release();
  }
};

/**
 * Toggle active state
 */
exports.togglePromotionStatus = async (id, tenantId, isActive) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [result] = await conn.query(
      `UPDATE promotions SET is_active = ? WHERE id = ? AND tenant_id = ?`,
      [isActive ? 1 : 0, id, tenantId]
    );
    if (result.affectedRows === 0) {
      throw new Error("Promotion not found.");
    }
    return { success: true, is_active: isActive ? 1 : 0 };
  } finally {
    conn.release();
  }
};

/**
 * Delete promotion
 */
exports.deletePromotion = async (id, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [result] = await conn.query(
      `DELETE FROM promotions WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    if (result.affectedRows === 0) {
      throw new Error("Promotion not found.");
    }
    return { success: true };
  } finally {
    conn.release();
  }
};

/**
 * Fetch all active promotions for POS terminal and customer ordering
 */
exports.getActivePromotions = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT * FROM promotions WHERE tenant_id = ? AND is_active = 1`,
      [tenantId]
    );
    return rows;
  } finally {
    conn.release();
  }
};

/**
 * Evaluate promotions against cart on the backend
 */
exports.evaluateCart = async (tenantId, { cartItems, diningOption, enteredCode }) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [promos] = await conn.query(
      `SELECT * FROM promotions WHERE tenant_id = ? AND is_active = 1`,
      [tenantId]
    );

    return evaluateCartPromotions({
      promotions: promos,
      cartItems,
      diningOption,
      enteredCode,
      now: new Date(),
    });
  } finally {
    conn.release();
  }
};

/**
 * Atomically increment times_redeemed for applied promotions
 */
exports.incrementRedemptions = async (tenantId, promoIds, connection = null) => {
  if (!promoIds || promoIds.length === 0) return;
  const conn = connection || (await getMySqlPromiseConnection());
  try {
    const cleanIds = promoIds.map(Number).filter(Boolean);
    if (cleanIds.length === 0) return;

    await conn.query(
      `UPDATE promotions 
       SET times_redeemed = times_redeemed + 1 
       WHERE tenant_id = ? AND id IN (?)`,
      [tenantId, cleanIds]
    );
  } finally {
    if (!connection) conn.release();
  }
};
