/**
 * Pure evaluation engine for Bong POS Promotions & Coupons.
 */

/**
 * Checks if a time string 'HH:mm:ss' falls between start and end.
 */
function isTimeWithinRange(currentTimeStr, startTimeStr, endTimeStr) {
  if (!startTimeStr && !endTimeStr) return true;
  if (startTimeStr && !endTimeStr) return currentTimeStr >= startTimeStr;
  if (!startTimeStr && endTimeStr) return currentTimeStr <= endTimeStr;
  
  if (startTimeStr <= endTimeStr) {
    return currentTimeStr >= startTimeStr && currentTimeStr <= endTimeStr;
  }
  // Overnight range, e.g. 22:00 to 02:00
  return currentTimeStr >= startTimeStr || currentTimeStr <= endTimeStr;
}

/**
 * Normalizes day-of-week:
 * JS Date.getDay(): 0=Sunday, 1=Monday, 2=Tuesday, ..., 6=Saturday
 * Standard ISO representation: 1=Monday ... 7=Sunday
 */
function getNormalizedDay(date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/**
 * Format Date to YYYY-MM-DD in local time
 */
function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format Time to HH:mm:ss in local time
 */
function formatTime(d) {
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${mins}:${secs}`;
}

/**
 * Evaluates promotions against cart state.
 *
 * @param {Array} promotions - List of active promotions
 * @param {Array} cartItems - [{ id, title, price, quantity, category_id }]
 * @param {string} diningOption - 'dinein' | 'takeaway' | 'delivery'
 * @param {string} enteredCode - Optional promo/coupon code entered by user
 * @param {Date} [now] - Reference time
 * @returns {Object} { appliedPromotions, totalPromotionDiscount, itemDiscounts, eligiblePromotions }
 */
function evaluateCartPromotions({
  promotions = [],
  cartItems = [],
  diningOption = 'dinein',
  enteredCode = null,
  customerGroupId = null,
  now = new Date(),
}) {
  const normalizedCode = (enteredCode || '').trim().toUpperCase();
  const currentDateStr = formatDate(now);
  const currentTimeStr = formatTime(now);
  const currentDay = getNormalizedDay(now);

  const cleanCart = (Array.isArray(cartItems) ? cartItems : []).filter(
    (item) => Number(item?.quantity) > 0 && Number(item?.price) >= 0
  );

  const rawSubtotal = cleanCart.reduce((sum, item) => {
    const itemPrice = Number(item.price) || 0;
    const itemQty = Number(item.quantity) || 1;
    return sum + itemPrice * itemQty;
  }, 0);

  // 1. Filter promotions that pass schedule, dining type, and usage limit
  const activeAndEligible = promotions.filter((promo) => {
    if (!promo.is_active) return false;

    // Usage limit
    if (promo.usage_limit_total != null && promo.times_redeemed >= promo.usage_limit_total) {
      return false;
    }

    // Date range
    if (promo.start_date) {
      const pStart = typeof promo.start_date === 'string' ? promo.start_date.substring(0, 10) : formatDate(new Date(promo.start_date));
      if (currentDateStr < pStart) return false;
    }
    if (promo.end_date) {
      const pEnd = typeof promo.end_date === 'string' ? promo.end_date.substring(0, 10) : formatDate(new Date(promo.end_date));
      if (currentDateStr > pEnd) return false;
    }

    // Days of week
    if (promo.days_of_week) {
      let days = promo.days_of_week;
      if (typeof days === 'string') {
        try { days = JSON.parse(days); } catch { days = null; }
      }
      if (Array.isArray(days) && days.length > 0) {
        if (!days.map(Number).includes(currentDay)) return false;
      }
    }

    // Time window (Happy Hour)
    if (promo.start_time || promo.end_time) {
      const pStart = promo.start_time ? String(promo.start_time).substring(0, 8) : null;
      const pEnd = promo.end_time ? String(promo.end_time).substring(0, 8) : null;
      if (!isTimeWithinRange(currentTimeStr, pStart, pEnd)) return false;
    }

    // Dining options
    if (promo.dining_options) {
      let diningOpts = promo.dining_options;
      if (typeof diningOpts === 'string') {
        try { diningOpts = JSON.parse(diningOpts); } catch { diningOpts = null; }
      }
      if (Array.isArray(diningOpts) && diningOpts.length > 0) {
        const normalizedDine = (diningOption || 'dinein').toLowerCase();
        const matches = diningOpts.map((d) => String(d).toLowerCase()).includes(normalizedDine);
        if (!matches) return false;
      }
    }

    // Customer Group eligibility
    if (promo.applicable_customer_group_ids) {
      let allowedGroups = promo.applicable_customer_group_ids;
      if (typeof allowedGroups === 'string') {
        try { allowedGroups = JSON.parse(allowedGroups); } catch { allowedGroups = null; }
      }
      if (Array.isArray(allowedGroups) && allowedGroups.length > 0) {
        if (!customerGroupId || !allowedGroups.map(Number).includes(Number(customerGroupId))) {
          return false;
        }
      }
    }

    return true;
  });

  // Check matching qualification for items
  const matchesScope = (promo, item) => {
    if (promo.apply_to === 'ALL') return true;

    if (promo.apply_to === 'CATEGORY' && promo.target_category_ids) {
      let catIds = promo.target_category_ids;
      if (typeof catIds === 'string') {
        try { catIds = JSON.parse(catIds); } catch { catIds = []; }
      }
      if (Array.isArray(catIds)) {
        return catIds.map(Number).includes(Number(item.category_id));
      }
    }

    if (promo.apply_to === 'ITEMS' && promo.target_item_ids) {
      let itemIds = promo.target_item_ids;
      if (typeof itemIds === 'string') {
        try { itemIds = JSON.parse(itemIds); } catch { itemIds = []; }
      }
      if (Array.isArray(itemIds)) {
        return itemIds.map(Number).includes(Number(item.id));
      }
    }

    return false;
  };

  // Helper to evaluate if promo should trigger (either it's automatic OR code matches)
  const isTriggered = (promo) => {
    const pCode = (promo.promo_code || '').trim().toUpperCase();
    if (pCode) {
      return Boolean(normalizedCode && normalizedCode === pCode);
    }
    return Boolean(promo.is_automatic);
  };

  const triggeredPromos = activeAndEligible.filter(isTriggered);

  // 2. Evaluate Item-Level Promos first
  const itemDiscounts = {}; // itemId -> discount amount
  const appliedItemPromos = [];

  for (const promo of triggeredPromos) {
    if (!['ITEM_PERCENTAGE', 'ITEM_FIXED', 'BOGO'].includes(promo.promo_type)) {
      continue;
    }

    let promoDiscountTotal = 0;
    const affectedItemIds = [];

    cleanCart.forEach((item) => {
      if (!matchesScope(promo, item)) return;

      const itemPrice = Number(item.price) || 0;
      const itemQty = Number(item.quantity) || 1;
      let discountForItem = 0;

      if (promo.promo_type === 'ITEM_PERCENTAGE') {
        const perc = Math.min(Math.max(Number(promo.discount_value) || 0, 0), 100);
        discountForItem = (itemPrice * itemQty * perc) / 100;
      } else if (promo.promo_type === 'ITEM_FIXED') {
        const fixedPerUnit = Math.min(Number(promo.discount_value) || 0, itemPrice);
        discountForItem = fixedPerUnit * itemQty;
      } else if (promo.promo_type === 'BOGO') {
        const buyQty = Math.max(Number(promo.buy_qty) || 1, 1);
        const getQty = Math.max(Number(promo.get_qty) || 1, 1);
        const groupSize = buyQty + getQty;
        const discountPercent = Math.min(Math.max(Number(promo.get_discount_percent) || 100, 0), 100);

        const freeUnits = Math.floor(itemQty / groupSize) * getQty;
        discountForItem = (freeUnits * itemPrice * discountPercent) / 100;
      }

      if (discountForItem > 0) {
        promoDiscountTotal += discountForItem;
        itemDiscounts[item.id] = (itemDiscounts[item.id] || 0) + discountForItem;
        affectedItemIds.push(item.id);
      }
    });

    if (promoDiscountTotal > 0) {
      if (promo.max_discount_cap != null && promo.max_discount_cap > 0) {
        promoDiscountTotal = Math.min(promoDiscountTotal, Number(promo.max_discount_cap));
      }

      appliedItemPromos.push({
        id: promo.id,
        title: promo.title,
        promo_code: promo.promo_code || null,
        promo_type: promo.promo_type,
        is_stackable: Boolean(promo.is_stackable),
        discount_amount: Number(promoDiscountTotal.toFixed(2)),
        target_item_ids: affectedItemIds,
      });
    }
  }

  // 3. Subtotal after item-level discounts
  const totalItemDiscounts = Object.values(itemDiscounts).reduce((a, b) => a + b, 0);
  const netSubtotal = Math.max(0, rawSubtotal - totalItemDiscounts);

  // 4. Evaluate Order-Level Promos
  const appliedOrderPromos = [];

  for (const promo of triggeredPromos) {
    if (!['ORDER_PERCENTAGE', 'ORDER_FIXED'].includes(promo.promo_type)) {
      continue;
    }

    const minSpend = Number(promo.min_order_amount) || 0;
    if (netSubtotal < minSpend) {
      continue;
    }

    let orderDiscount = 0;
    if (promo.promo_type === 'ORDER_PERCENTAGE') {
      const perc = Math.min(Math.max(Number(promo.discount_value) || 0, 0), 100);
      orderDiscount = (netSubtotal * perc) / 100;
    } else if (promo.promo_type === 'ORDER_FIXED') {
      orderDiscount = Math.min(Number(promo.discount_value) || 0, netSubtotal);
    }

    if (promo.max_discount_cap != null && promo.max_discount_cap > 0) {
      orderDiscount = Math.min(orderDiscount, Number(promo.max_discount_cap));
    }

    if (orderDiscount > 0) {
      appliedOrderPromos.push({
        id: promo.id,
        title: promo.title,
        promo_code: promo.promo_code || null,
        promo_type: promo.promo_type,
        is_stackable: Boolean(promo.is_stackable),
        discount_amount: Number(orderDiscount.toFixed(2)),
      });
    }
  }

  // 5. Stacking & Priority Resolution
  // If an unstackable promo is applied, pick the highest single savings or combine stackables
  const allCandidatePromos = [...appliedItemPromos, ...appliedOrderPromos];

  let finalAppliedPromos = [];
  if (allCandidatePromos.length > 0) {
    const unstackable = allCandidatePromos.filter((p) => !p.is_stackable);
    const stackable = allCandidatePromos.filter((p) => p.is_stackable);

    if (unstackable.length === 0) {
      finalAppliedPromos = stackable;
    } else {
      // Find the best unstackable deal
      const bestUnstackable = unstackable.reduce((prev, curr) =>
        curr.discount_amount > prev.discount_amount ? curr : prev
      );

      const sumStackable = stackable.reduce((s, p) => s + p.discount_amount, 0);

      // If combining all stackables yields more savings, use stackables; otherwise use the single best deal
      if (sumStackable > bestUnstackable.discount_amount) {
        finalAppliedPromos = stackable;
      } else {
        finalAppliedPromos = [bestUnstackable];
      }
    }
  }

  const totalPromotionDiscount = Number(
    finalAppliedPromos.reduce((sum, p) => sum + p.discount_amount, 0).toFixed(2)
  );

  return {
    rawSubtotal: Number(rawSubtotal.toFixed(2)),
    netSubtotal: Number(Math.max(0, rawSubtotal - totalPromotionDiscount).toFixed(2)),
    totalPromotionDiscount,
    appliedPromotions: finalAppliedPromos,
    itemDiscounts,
    eligiblePromotions: activeAndEligible.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      promo_code: p.promo_code,
      promo_type: p.promo_type,
      discount_value: p.discount_value,
      max_discount_cap: p.max_discount_cap,
      min_order_amount: p.min_order_amount,
      is_automatic: Boolean(p.is_automatic),
      is_stackable: Boolean(p.is_stackable),
    })),
  };
}

/**
 * Calculates direct customer group discount based on rules.
 */
function calculateCustomerGroupDiscount({
  customerGroup = null,
  cartItems = [],
}) {
  if (!customerGroup || !customerGroup.is_active) {
    return { discountTotal: 0, eligibleSubtotal: 0 };
  }

  const cleanCart = (Array.isArray(cartItems) ? cartItems : []).filter(
    (item) => Number(item?.quantity) > 0 && Number(item?.price) >= 0
  );

  const rawSubtotal = cleanCart.reduce((sum, item) => {
    return sum + (Number(item.price) || 0) * (Number(item.quantity) || 1);
  }, 0);

  // Check min order spend
  const minOrder = Number(customerGroup.min_order_amount || 0);
  if (minOrder > 0 && rawSubtotal < minOrder) {
    return { discountTotal: 0, eligibleSubtotal: 0, reason: "MIN_ORDER_NOT_MET" };
  }

  let eligibleSubtotal = rawSubtotal;
  let targetCatIds = customerGroup.target_category_ids;
  if (typeof targetCatIds === "string") {
    try { targetCatIds = JSON.parse(targetCatIds); } catch { targetCatIds = []; }
  }

  if (customerGroup.apply_to === "CATEGORY" && Array.isArray(targetCatIds) && targetCatIds.length > 0) {
    const catSet = new Set(targetCatIds.map(Number));
    eligibleSubtotal = cleanCart.reduce((sum, item) => {
      const catId = Number(item.category_id || item.categoryId);
      if (catSet.has(catId)) {
        return sum + (Number(item.price) || 0) * (Number(item.quantity) || 1);
      }
      return sum;
    }, 0);
  }

  if (eligibleSubtotal <= 0) {
    return { discountTotal: 0, eligibleSubtotal: 0 };
  }

  let discount = 0;
  const val = Number(customerGroup.discount_value || 0);
  if (customerGroup.discount_type === "PERCENTAGE") {
    discount = (eligibleSubtotal * Math.min(val, 100)) / 100;
  } else {
    // FIXED
    discount = Math.min(val, eligibleSubtotal);
  }

  // Max cap check
  const maxCap = customerGroup.max_discount_cap != null ? Number(customerGroup.max_discount_cap) : null;
  if (maxCap != null && maxCap > 0) {
    discount = Math.min(discount, maxCap);
  }

  discount = Number(discount.toFixed(2));
  return {
    discountTotal: Math.max(0, discount),
    eligibleSubtotal: Number(eligibleSubtotal.toFixed(2)),
  };
}

/**
 * Resolves conflict / stacking between customer group discount and promotions.
 */
function combineCartDiscounts({
  groupDiscount = 0,
  promoDiscount = 0,
  appliedPromotions = [],
  customerGroupDisabled = false,
}) {
  const effectiveGroupDiscount = customerGroupDisabled ? 0 : Number(groupDiscount || 0);
  const effectivePromoDiscount = Number(promoDiscount || 0);

  if (effectiveGroupDiscount <= 0 && effectivePromoDiscount <= 0) {
    return {
      groupDiscountApplied: 0,
      promoDiscountApplied: 0,
      totalDiscountApplied: 0,
      appliedPromotions: [],
    };
  }

  if (effectiveGroupDiscount <= 0) {
    return {
      groupDiscountApplied: 0,
      promoDiscountApplied: effectivePromoDiscount,
      totalDiscountApplied: effectivePromoDiscount,
      appliedPromotions,
    };
  }

  if (effectivePromoDiscount <= 0) {
    return {
      groupDiscountApplied: effectiveGroupDiscount,
      promoDiscountApplied: 0,
      totalDiscountApplied: effectiveGroupDiscount,
      appliedPromotions: [],
    };
  }

  // If promotions exist, check if they can stack
  const hasStackable = appliedPromotions.some((p) => Boolean(p.is_stackable));
  if (hasStackable) {
    const total = Number((effectiveGroupDiscount + effectivePromoDiscount).toFixed(2));
    return {
      groupDiscountApplied: effectiveGroupDiscount,
      promoDiscountApplied: effectivePromoDiscount,
      totalDiscountApplied: total,
      appliedPromotions,
    };
  }

  // If non-stackable, best value wins
  if (effectiveGroupDiscount > effectivePromoDiscount) {
    return {
      groupDiscountApplied: effectiveGroupDiscount,
      promoDiscountApplied: 0,
      totalDiscountApplied: effectiveGroupDiscount,
      appliedPromotions: [],
      winner: "CUSTOMER_GROUP",
    };
  }

  return {
    groupDiscountApplied: 0,
    promoDiscountApplied: effectivePromoDiscount,
    totalDiscountApplied: effectivePromoDiscount,
    appliedPromotions,
    winner: "PROMOTION",
  };
}

module.exports = {
  evaluateCartPromotions,
  calculateCustomerGroupDiscount,
  combineCartDiscounts,
  isTimeWithinRange,
  getNormalizedDay,
  formatDate,
  formatTime,
};
