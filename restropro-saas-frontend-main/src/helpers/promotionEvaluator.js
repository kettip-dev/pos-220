/**
 * Client-side evaluation engine for Restro PRO Promotions & Coupons.
 * Perfectly mirrors backend logic for instant real-time cart recalculation without network lag.
 */

function isTimeWithinRange(currentTimeStr, startTimeStr, endTimeStr) {
  if (!startTimeStr && !endTimeStr) return true;
  if (startTimeStr && !endTimeStr) return currentTimeStr >= startTimeStr;
  if (!startTimeStr && endTimeStr) return currentTimeStr <= endTimeStr;

  if (startTimeStr <= endTimeStr) {
    return currentTimeStr >= startTimeStr && currentTimeStr <= endTimeStr;
  }
  return currentTimeStr >= startTimeStr || currentTimeStr <= endTimeStr;
}

function getNormalizedDay(date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(d) {
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  const secs = String(d.getSeconds()).padStart(2, "0");
  return `${hours}:${mins}:${secs}`;
}

export function evaluateCartPromotions({
  promotions = [],
  cartItems = [],
  diningOption = "dinein",
  enteredCode = null,
  now = new Date(),
}) {
  const normalizedCode = (enteredCode || "").trim().toUpperCase();
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
      const pStart = typeof promo.start_date === "string" ? promo.start_date.substring(0, 10) : formatDate(new Date(promo.start_date));
      if (currentDateStr < pStart) return false;
    }
    if (promo.end_date) {
      const pEnd = typeof promo.end_date === "string" ? promo.end_date.substring(0, 10) : formatDate(new Date(promo.end_date));
      if (currentDateStr > pEnd) return false;
    }

    // Days of week
    if (promo.days_of_week) {
      let days = promo.days_of_week;
      if (typeof days === "string") {
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
      if (typeof diningOpts === "string") {
        try { diningOpts = JSON.parse(diningOpts); } catch { diningOpts = null; }
      }
      if (Array.isArray(diningOpts) && diningOpts.length > 0) {
        const normalizedDine = (diningOption || "dinein").toLowerCase();
        const matches = diningOpts.map((d) => String(d).toLowerCase()).includes(normalizedDine);
        if (!matches) return false;
      }
    }

    return true;
  });

  const matchesScope = (promo, item) => {
    if (promo.apply_to === "ALL") return true;

    if (promo.apply_to === "CATEGORY" && promo.target_category_ids) {
      let catIds = promo.target_category_ids;
      if (typeof catIds === "string") {
        try { catIds = JSON.parse(catIds); } catch { catIds = []; }
      }
      if (Array.isArray(catIds)) {
        return catIds.map(Number).includes(Number(item.category_id || item.category));
      }
    }

    if (promo.apply_to === "ITEMS" && promo.target_item_ids) {
      let itemIds = promo.target_item_ids;
      if (typeof itemIds === "string") {
        try { itemIds = JSON.parse(itemIds); } catch { itemIds = []; }
      }
      if (Array.isArray(itemIds)) {
        return itemIds.map(Number).includes(Number(item.id || item.item_id));
      }
    }

    return false;
  };

  const isTriggered = (promo) => {
    const pCode = (promo.promo_code || "").trim().toUpperCase();
    if (pCode) {
      return Boolean(normalizedCode && normalizedCode === pCode);
    }
    return Boolean(promo.is_automatic);
  };

  const triggeredPromos = activeAndEligible.filter(isTriggered);

  // 2. Evaluate Item-Level Promos
  const itemDiscounts = {};
  const appliedItemPromos = [];

  for (const promo of triggeredPromos) {
    if (!["ITEM_PERCENTAGE", "ITEM_FIXED", "BOGO"].includes(promo.promo_type)) {
      continue;
    }

    let promoDiscountTotal = 0;
    const affectedItemIds = [];

    cleanCart.forEach((item) => {
      if (!matchesScope(promo, item)) return;

      const itemPrice = Number(item.price) || 0;
      const itemQty = Number(item.quantity) || 1;
      let discountForItem = 0;

      if (promo.promo_type === "ITEM_PERCENTAGE") {
        const perc = Math.min(Math.max(Number(promo.discount_value) || 0, 0), 100);
        discountForItem = (itemPrice * itemQty * perc) / 100;
      } else if (promo.promo_type === "ITEM_FIXED") {
        const fixedPerUnit = Math.min(Number(promo.discount_value) || 0, itemPrice);
        discountForItem = fixedPerUnit * itemQty;
      } else if (promo.promo_type === "BOGO") {
        const buyQty = Math.max(Number(promo.buy_qty) || 1, 1);
        const getQty = Math.max(Number(promo.get_qty) || 1, 1);
        const groupSize = buyQty + getQty;
        const discountPercent = Math.min(Math.max(Number(promo.get_discount_percent) || 100, 0), 100);

        const freeUnits = Math.floor(itemQty / groupSize) * getQty;
        discountForItem = (freeUnits * itemPrice * discountPercent) / 100;
      }

      if (discountForItem > 0) {
        promoDiscountTotal += discountForItem;
        const key = item.id || item.item_id;
        itemDiscounts[key] = (itemDiscounts[key] || 0) + discountForItem;
        affectedItemIds.push(key);
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

  const totalItemDiscounts = Object.values(itemDiscounts).reduce((a, b) => a + b, 0);
  const netSubtotal = Math.max(0, rawSubtotal - totalItemDiscounts);

  // 3. Evaluate Order-Level Promos
  const appliedOrderPromos = [];

  for (const promo of triggeredPromos) {
    if (!["ORDER_PERCENTAGE", "ORDER_FIXED"].includes(promo.promo_type)) {
      continue;
    }

    const minSpend = Number(promo.min_order_amount) || 0;
    if (netSubtotal < minSpend) {
      continue;
    }

    let orderDiscount = 0;
    if (promo.promo_type === "ORDER_PERCENTAGE") {
      const perc = Math.min(Math.max(Number(promo.discount_value) || 0, 0), 100);
      orderDiscount = (netSubtotal * perc) / 100;
    } else if (promo.promo_type === "ORDER_FIXED") {
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

  // 4. Stacking & Priority Resolution
  const allCandidatePromos = [...appliedItemPromos, ...appliedOrderPromos];

  let finalAppliedPromos = [];
  if (allCandidatePromos.length > 0) {
    const unstackable = allCandidatePromos.filter((p) => !p.is_stackable);
    const stackable = allCandidatePromos.filter((p) => p.is_stackable);

    if (unstackable.length === 0) {
      finalAppliedPromos = stackable;
    } else {
      const bestUnstackable = unstackable.reduce((prev, curr) =>
        curr.discount_amount > prev.discount_amount ? curr : prev
      );

      const sumStackable = stackable.reduce((s, p) => s + p.discount_amount, 0);

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
