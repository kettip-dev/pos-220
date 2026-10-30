const { getMySqlPromiseConnection } = require("../config/mysql.db");

/**
 * Determine membership tier based on lifetime points earned
 */
const determineTier = (lifetimePoints) => {
  if (lifetimePoints >= 5000) return "VIP";
  if (lifetimePoints >= 2000) return "Gold";
  if (lifetimePoints >= 500) return "Silver";
  return "Standard";
};

/**
 * Get tenant loyalty settings (or return default if not customized yet)
 */
exports.getTenantLoyaltySettingsDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT id, tenant_id, is_enabled, points_per_dollar_spent, dollar_value_per_point, 
              min_points_to_redeem, max_discount_percentage, created_at, updated_at
       FROM tenant_loyalty_settings
       WHERE tenant_id = ? LIMIT 1`,
      [tenantId]
    );

    if (rows.length > 0) {
      return {
        ...rows[0],
        is_enabled: Boolean(rows[0].is_enabled),
        points_per_dollar_spent: Number(rows[0].points_per_dollar_spent),
        dollar_value_per_point: Number(rows[0].dollar_value_per_point),
        min_points_to_redeem: Number(rows[0].min_points_to_redeem),
        max_discount_percentage: Number(rows[0].max_discount_percentage),
      };
    }

    // Default settings
    return {
      tenant_id: tenantId,
      is_enabled: true,
      points_per_dollar_spent: 1.0,
      dollar_value_per_point: 0.01, // 100 points = $1.00
      min_points_to_redeem: 10,
      max_discount_percentage: 100.0,
    };
  } catch (error) {
    console.error("getTenantLoyaltySettingsDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Upsert tenant loyalty settings
 */
exports.updateTenantLoyaltySettingsDB = async (tenantId, settings) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const isEnabled = settings.is_enabled !== undefined ? (settings.is_enabled ? 1 : 0) : 1;
    const pointsPerDollar = Math.max(0, Number(settings.points_per_dollar_spent || 1.0));
    const dollarValuePerPoint = Math.max(0.0001, Number(settings.dollar_value_per_point || 0.01));
    const minPoints = Math.max(0, parseInt(settings.min_points_to_redeem || 0));
    const maxDiscountPct = Math.min(100, Math.max(1, Number(settings.max_discount_percentage || 100)));

    const sql = `
      INSERT INTO tenant_loyalty_settings
        (tenant_id, is_enabled, points_per_dollar_spent, dollar_value_per_point, min_points_to_redeem, max_discount_percentage)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        is_enabled = VALUES(is_enabled),
        points_per_dollar_spent = VALUES(points_per_dollar_spent),
        dollar_value_per_point = VALUES(dollar_value_per_point),
        min_points_to_redeem = VALUES(min_points_to_redeem),
        max_discount_percentage = VALUES(max_discount_percentage);
    `;

    await conn.query(sql, [
      tenantId,
      isEnabled,
      pointsPerDollar,
      dollarValuePerPoint,
      minPoints,
      maxDiscountPct,
    ]);

    return exports.getTenantLoyaltySettingsDB(tenantId);
  } catch (error) {
    console.error("updateTenantLoyaltySettingsDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Get customer loyalty balance & tier
 */
exports.getCustomerLoyaltySummaryDB = async (phone, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT phone, name, points_balance, lifetime_points_earned, membership_tier
       FROM customers
       WHERE phone = ? AND tenant_id = ?
       LIMIT 1`,
      [phone, tenantId]
    );

    if (rows.length === 0) {
      return null;
    }

    return {
      phone: rows[0].phone,
      name: rows[0].name,
      points_balance: Number(rows[0].points_balance || 0),
      lifetime_points_earned: Number(rows[0].lifetime_points_earned || 0),
      membership_tier: rows[0].membership_tier || "Standard",
    };
  } catch (error) {
    console.error("getCustomerLoyaltySummaryDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Get paginated customer loyalty transaction history
 */
exports.getCustomerLoyaltyHistoryDB = async (phone, tenantId, page = 1, limit = 20) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const currentPage = Math.max(1, parseInt(page) || 1);
    const perPage = Math.max(1, parseInt(limit) || 20);
    const offset = (currentPage - 1) * perPage;

    const [transactions] = await conn.query(
      `SELECT id, tenant_id, customer_phone, invoice_id, order_id, transaction_type,
              points, balance_after, notes, created_by_user_id, created_at
       FROM customer_loyalty_transactions
       WHERE customer_phone = ? AND tenant_id = ?
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [phone, tenantId, perPage, offset]
    );

    const [countRows] = await conn.query(
      `SELECT COUNT(*) as total
       FROM customer_loyalty_transactions
       WHERE customer_phone = ? AND tenant_id = ?`,
      [phone, tenantId]
    );

    const total = countRows[0]?.total || 0;

    return {
      transactions,
      total,
      page: currentPage,
      limit: perPage,
      totalPages: Math.ceil(total / perPage),
    };
  } catch (error) {
    console.error("getCustomerLoyaltyHistoryDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Manual points adjustment by manager/admin
 */
exports.manualAdjustPointsDB = async (phone, points, notes, userId, tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();

    const [custRows] = await conn.query(
      `SELECT points_balance, lifetime_points_earned FROM customers WHERE phone = ? AND tenant_id = ? LIMIT 1 FOR UPDATE`,
      [phone, tenantId]
    );

    if (custRows.length === 0) {
      throw new Error("Customer not found");
    }

    const currentBalance = Number(custRows[0].points_balance || 0);
    const currentLifetime = Number(custRows[0].lifetime_points_earned || 0);
    const deltaPoints = parseInt(points, 10);

    if (isNaN(deltaPoints) || deltaPoints === 0) {
      throw new Error("Invalid point adjustment amount");
    }

    const newBalance = currentBalance + deltaPoints;
    if (newBalance < 0) {
      throw new Error("Adjustment cannot result in negative point balance");
    }

    const newLifetime = deltaPoints > 0 ? currentLifetime + deltaPoints : currentLifetime;
    const newTier = determineTier(newLifetime);

    await conn.query(
      `UPDATE customers 
       SET points_balance = ?, lifetime_points_earned = ?, membership_tier = ?
       WHERE phone = ? AND tenant_id = ?`,
      [newBalance, newLifetime, newTier, phone, tenantId]
    );

    await conn.query(
      `INSERT INTO customer_loyalty_transactions
        (tenant_id, customer_phone, transaction_type, points, balance_after, notes, created_by_user_id)
       VALUES (?, ?, 'MANUAL_ADJUSTMENT', ?, ?, ?, ?)`,
      [tenantId, phone, deltaPoints, newBalance, notes || "Manual Manager Adjustment", userId || null]
    );

    await conn.commit();

    return {
      phone,
      points_balance: newBalance,
      lifetime_points_earned: newLifetime,
      membership_tier: newTier,
    };
  } catch (error) {
    await conn.rollback();
    console.error("manualAdjustPointsDB error:", error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Process loyalty earning & redemption when creating an invoice within a MySQL transaction.
 * conn: existing active transaction connection
 */
exports.processLoyaltyOnCheckoutTx = async (conn, {
  tenantId,
  customerPhone,
  invoiceId,
  orderId = null,
  payableTotal, // total bill after all items, discounts, etc.
  requestedPointsRedeemed = 0,
  userId = null
}) => {
  if (!customerPhone) {
    return {
      pointsRedeemed: 0,
      loyaltyDiscount: 0,
      pointsEarned: 0,
    };
  }

  // 1. Fetch tenant loyalty settings
  const [settingRows] = await conn.query(
    `SELECT is_enabled, points_per_dollar_spent, dollar_value_per_point, min_points_to_redeem, max_discount_percentage
     FROM tenant_loyalty_settings WHERE tenant_id = ? LIMIT 1`,
    [tenantId]
  );

  const settings = settingRows[0] || {
    is_enabled: 1,
    points_per_dollar_spent: 1.0,
    dollar_value_per_point: 0.01,
    min_points_to_redeem: 10,
    max_discount_percentage: 100.0,
  };

  if (!Boolean(settings.is_enabled)) {
    return {
      pointsRedeemed: 0,
      loyaltyDiscount: 0,
      pointsEarned: 0,
    };
  }

  // 2. Fetch customer row FOR UPDATE
  const [custRows] = await conn.query(
    `SELECT points_balance, lifetime_points_earned FROM customers WHERE phone = ? AND tenant_id = ? LIMIT 1 FOR UPDATE`,
    [customerPhone, tenantId]
  );

  if (custRows.length === 0) {
    return {
      pointsRedeemed: 0,
      loyaltyDiscount: 0,
      pointsEarned: 0,
    };
  }

  let currentBalance = Number(custRows[0].points_balance || 0);
  let lifetimeEarned = Number(custRows[0].lifetime_points_earned || 0);

  // 3. Process Redemption (if requested)
  let actualPointsRedeemed = 0;
  let loyaltyDiscountAmount = 0;

  const pointsToRedeem = Math.max(0, parseInt(requestedPointsRedeemed, 10) || 0);
  if (pointsToRedeem > 0 && pointsToRedeem >= Number(settings.min_points_to_redeem)) {
    actualPointsRedeemed = Math.min(pointsToRedeem, currentBalance);
    const rawDiscount = actualPointsRedeemed * Number(settings.dollar_value_per_point);
    const maxDiscountAllowed = (payableTotal * Number(settings.max_discount_percentage)) / 100;
    loyaltyDiscountAmount = Number(Math.min(rawDiscount, maxDiscountAllowed).toFixed(2));

    if (actualPointsRedeemed > 0) {
      currentBalance -= actualPointsRedeemed;

      await conn.query(
        `INSERT INTO customer_loyalty_transactions
          (tenant_id, customer_phone, invoice_id, order_id, transaction_type, points, balance_after, notes, created_by_user_id)
         VALUES (?, ?, ?, ?, 'REDEEMED', ?, ?, ?, ?)`,
        [
          tenantId,
          customerPhone,
          invoiceId,
          orderId,
          -actualPointsRedeemed,
          currentBalance,
          `Redeemed on Invoice #${invoiceId}`,
          userId,
        ]
      );
    }
  }

  // 4. Process Points Earning on the final net paid amount
  const netPaidAmount = Math.max(0, payableTotal - loyaltyDiscountAmount);
  const pointsEarned = Math.floor(netPaidAmount * Number(settings.points_per_dollar_spent));

  if (pointsEarned > 0) {
    currentBalance += pointsEarned;
    lifetimeEarned += pointsEarned;

    await conn.query(
      `INSERT INTO customer_loyalty_transactions
        (tenant_id, customer_phone, invoice_id, order_id, transaction_type, points, balance_after, notes, created_by_user_id)
       VALUES (?, ?, ?, ?, 'EARNED', ?, ?, ?, ?)`,
      [
        tenantId,
        customerPhone,
        invoiceId,
        orderId,
        pointsEarned,
        currentBalance,
        `Earned on Invoice #${invoiceId}`,
        userId,
      ]
    );
  }

  const updatedTier = determineTier(lifetimeEarned);

  // 5. Update customer record
  await conn.query(
    `UPDATE customers
     SET points_balance = ?, lifetime_points_earned = ?, membership_tier = ?
     WHERE phone = ? AND tenant_id = ?`,
    [currentBalance, lifetimeEarned, updatedTier, customerPhone, tenantId]
  );

  return {
    pointsRedeemed: actualPointsRedeemed,
    loyaltyDiscount: loyaltyDiscountAmount,
    pointsEarned,
    newBalance: currentBalance,
    tier: updatedTier,
  };
};

/**
 * Reverse points when an invoice is VOIDED.
 * conn: existing active transaction connection
 */
exports.reverseLoyaltyForVoidInvoiceTx = async (conn, { invoiceId, tenantId, userId, reason }) => {
  // Read invoice loyalty details
  const [invRows] = await conn.query(
    `SELECT loyalty_points_redeemed, loyalty_points_earned FROM invoices WHERE id = ? AND tenant_id = ? LIMIT 1`,
    [invoiceId, tenantId]
  );

  if (invRows.length === 0) return;

  const pointsRedeemed = Number(invRows[0].loyalty_points_redeemed || 0);
  const pointsEarned = Number(invRows[0].loyalty_points_earned || 0);

  if (pointsRedeemed === 0 && pointsEarned === 0) return;

  // Find customer_id (phone) from associated orders
  const [ordRows] = await conn.query(
    `SELECT customer_id FROM orders WHERE invoice_id = ? AND tenant_id = ? AND customer_id IS NOT NULL LIMIT 1`,
    [invoiceId, tenantId]
  );

  const customerPhone = ordRows[0]?.customer_id;
  if (!customerPhone) return;

  const [custRows] = await conn.query(
    `SELECT points_balance, lifetime_points_earned FROM customers WHERE phone = ? AND tenant_id = ? LIMIT 1 FOR UPDATE`,
    [customerPhone, tenantId]
  );

  if (custRows.length === 0) return;

  let currentBalance = Number(custRows[0].points_balance || 0);
  let lifetimeEarned = Number(custRows[0].lifetime_points_earned || 0);

  // 1. If points were redeemed, refund them back to the customer
  if (pointsRedeemed > 0) {
    currentBalance += pointsRedeemed;

    await conn.query(
      `INSERT INTO customer_loyalty_transactions
        (tenant_id, customer_phone, invoice_id, transaction_type, points, balance_after, notes, created_by_user_id)
       VALUES (?, ?, ?, 'VOID_REVERSAL', ?, ?, ?, ?)`,
      [
        tenantId,
        customerPhone,
        invoiceId,
        pointsRedeemed,
        currentBalance,
        `Void Reversal (Refund redeemed points) for Invoice #${invoiceId}: ${reason || ""}`,
        userId,
      ]
    );
  }

  // 2. If points were earned, claw them back
  if (pointsEarned > 0) {
    currentBalance = Math.max(0, currentBalance - pointsEarned);
    lifetimeEarned = Math.max(0, lifetimeEarned - pointsEarned);

    await conn.query(
      `INSERT INTO customer_loyalty_transactions
        (tenant_id, customer_phone, invoice_id, transaction_type, points, balance_after, notes, created_by_user_id)
       VALUES (?, ?, ?, 'VOID_REVERSAL', ?, ?, ?, ?)`,
      [
        tenantId,
        customerPhone,
        invoiceId,
        -pointsEarned,
        currentBalance,
        `Void Reversal (Claw back earned points) for Invoice #${invoiceId}: ${reason || ""}`,
        userId,
      ]
    );
  }

  const updatedTier = determineTier(lifetimeEarned);

  await conn.query(
    `UPDATE customers
     SET points_balance = ?, lifetime_points_earned = ?, membership_tier = ?
     WHERE phone = ? AND tenant_id = ?`,
    [currentBalance, lifetimeEarned, updatedTier, customerPhone, tenantId]
  );
};
