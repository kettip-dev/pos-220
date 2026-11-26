/**
 * Menu Engineering: how much each dish earns and how well it sells.
 *
 * Dish cost is the THEORETICAL recipe cost: menu_item_recipes x the latest
 * purchase-order unit cost of each ingredient. inventory_logs cannot be used
 * here because stock is deducted per order and per ingredient, not per dish.
 *
 * The recipe rule matches stock deduction in pos.service.js so the numbers
 * agree with what was actually taken off the shelf:
 *   - base lines (variant_id = 0, addon_id = 0) always apply,
 *   - variant lines apply only when that variant was sold,
 *   - add-on lines apply only when that add-on was chosen,
 *   - a combo costs the sum of its component lines (combo_parent_id).
 *
 * Classification follows Kasavana & Smith:
 *   popular    = units sold >= 70% of an even share (total units / dishes)
 *   profitable = profit per plate >= the sales-weighted average profit per plate
 *   Star (popular + profitable), Plowhorse (popular, low profit),
 *   Puzzle (unpopular, profitable), Dog (neither).
 * Dishes without a full cost are left out of the classification and listed
 * separately, so a missing cost can never make a dish look like a Star.
 *
 * Every query is scoped with `tenant_id IN (?)`.
 */

const POPULARITY_FACTOR = 0.7;

const CLASS_ADVICE = {
  Star: "Keep it. Give it the best spot on the menu and POS.",
  Plowhorse: "Sells well but earns little. Raise the price a little or lower the portion cost.",
  Puzzle: "Earns well but few order it. Promote it, rename it or move it up the menu.",
  Dog: "Sells poorly and earns little. Consider removing or reworking it.",
};

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const r4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000;

const parseAddonIds = (raw) => {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed)
      ? parsed.map((a) => Number(a && typeof a === "object" ? a.id : a)).filter((n) => n > 0)
      : [];
  } catch {
    return [];
  }
};

/** Price excluding tax, the same way the POS cart splits it. */
const exTaxPrice = (price, taxRate, taxType) => {
  const p = Number(price) || 0;
  const rate = Number(taxRate) || 0;
  return taxType === "inclusive" && rate > 0 ? (p * 100) / (100 + rate) : p;
};

const channelLabel = (line) => {
  if (line.platform_name) return line.platform_name;
  const t = String(line.delivery_type || "").toLowerCase().replace(/[^a-z]/g, "");
  if (t === "dinein") return "Dine-in";
  if (t === "takeaway" || t === "takeout") return "Takeaway";
  if (t === "delivery") return "Delivery";
  return line.delivery_type ? String(line.delivery_type) : "Other";
};

/**
 * Builds a function that returns the unit cost of one sold line:
 * { cost, missing, hasRecipe }.
 */
const makeCoster = (recipes, ingredientCost) => {
  const byItem = new Map();
  recipes.forEach((r) => {
    const key = Number(r.menu_item_id);
    if (!byItem.has(key)) byItem.set(key, []);
    byItem.get(key).push(r);
  });

  return (itemId, variantId, addonIds = []) => {
    const lines = byItem.get(Number(itemId)) || [];
    const addonSet = new Set(addonIds.map(Number));
    let cost = 0;
    let missing = false;
    let used = 0;
    lines.forEach((r) => {
      const v = Number(r.variant_id) || 0;
      const a = Number(r.addon_id) || 0;
      if (v && v !== Number(variantId || 0)) return;
      if (a && !addonSet.has(a)) return;
      used += 1;
      const unit = ingredientCost.get(Number(r.inventory_item_id));
      if (unit === undefined) {
        missing = true;
        return;
      }
      cost += Number(r.quantity) * unit;
    });
    // Recipe lines that apply to the dish itself (not just to an add-on).
    const hasRecipe = lines.some((r) => !(Number(r.addon_id) || 0)
      && (!(Number(r.variant_id) || 0) || Number(r.variant_id) === Number(variantId || 0)));
    return { cost, missing, hasRecipe, used };
  };
};

/** Marks Star / Plowhorse / Puzzle / Dog on the dishes passed in. */
const classify = (dishes, field) => {
  const ranked = dishes.filter((d) => d.costed);
  const totalQty = ranked.reduce((s, d) => s + d.quantity_sold, 0);
  if (!ranked.length || totalQty <= 0) {
    ranked.forEach((d) => { d[field] = null; });
    return { popularityThreshold: 0, averageProfit: 0 };
  }
  const popularityThreshold = POPULARITY_FACTOR * (totalQty / ranked.length);
  const averageProfit = ranked.reduce((s, d) => s + d.total_profit, 0) / totalQty;
  ranked.forEach((d) => {
    const popular = d.quantity_sold >= popularityThreshold;
    const profitable = d.profit_per_plate >= averageProfit;
    d[field] = popular ? (profitable ? "Star" : "Plowhorse") : (profitable ? "Puzzle" : "Dog");
  });
  return { popularityThreshold, averageProfit };
};

/**
 * Pure calculation, kept apart from SQL so it can be checked by hand.
 * `lines` are sold order_items rows; `unsold` are enabled menu items with no sale.
 */
exports.computeMenuEngineering = ({ lines, recipes, ingredientCosts, unsold = [] }) => {
  const ingredientCost = new Map(
    ingredientCosts.map((c) => [Number(c.inventory_item_id), Number(c.unit_cost)])
  );
  const costOf = makeCoster(recipes, ingredientCost);

  // Combo components carry the cost, the parent line carries the price.
  const componentCost = new Map(); // parent order_item id -> { cost, missing }
  lines.filter((l) => l.combo_parent_id).forEach((l) => {
    const parentId = Number(l.combo_parent_id);
    const c = costOf(l.item_id, l.variant_id, parseAddonIds(l.addons));
    const prev = componentCost.get(parentId) || { cost: 0, missing: false, noRecipe: false };
    prev.cost += c.cost * (Number(l.quantity) || 0);
    prev.missing = prev.missing || c.missing;
    prev.noRecipe = prev.noRecipe || !c.hasRecipe;
    componentCost.set(parentId, prev);
  });

  const dishes = new Map();
  const channels = new Map();
  const noRecipe = new Map();
  const ingredientsWithoutCost = new Set();

  recipes.forEach((r) => {
    if (!ingredientCost.has(Number(r.inventory_item_id)) && r.ingredient_title) {
      ingredientsWithoutCost.add(r.ingredient_title);
    }
  });

  lines.filter((l) => !l.combo_parent_id).forEach((l) => {
    const qty = Number(l.quantity) || 0;
    if (qty <= 0) return;

    const isCombo = Number(l.is_combo_parent) === 1;
    let unitCost;
    let missing;
    let hasRecipe;
    if (isCombo) {
      const parts = componentCost.get(Number(l.id)) || { cost: 0, missing: false, noRecipe: true };
      const own = costOf(l.item_id, l.variant_id, parseAddonIds(l.addons));
      unitCost = parts.cost / qty + own.cost;
      missing = parts.missing || own.missing;
      hasRecipe = !parts.noRecipe;
    } else {
      const c = costOf(l.item_id, l.variant_id, parseAddonIds(l.addons));
      unitCost = c.cost;
      missing = c.missing;
      hasRecipe = c.hasRecipe;
    }

    const revenue = exTaxPrice(l.price, l.tax_rate, l.tax_type) * qty;
    const commission = revenue * (Number(l.commission_percent) || 0) / 100;
    const cost = unitCost * qty;

    const key = `${l.item_id}:${Number(l.variant_id) || 0}`;
    if (!dishes.has(key)) {
      dishes.set(key, {
        item_id: Number(l.item_id),
        variant_id: Number(l.variant_id) || null,
        dish: l.variant_title ? `${l.item_title} (${l.variant_title})` : (l.item_title || "Deleted item"),
        category: l.category_title || "Uncategorized",
        quantity_sold: 0,
        sales: 0,
        food_cost: 0,
        commission: 0,
        missing: false,
        no_recipe: false,
      });
    }
    const d = dishes.get(key);
    d.quantity_sold += qty;
    d.sales += revenue;
    d.food_cost += cost;
    d.commission += commission;
    d.missing = d.missing || missing;
    d.no_recipe = d.no_recipe || !hasRecipe;

    // Channel totals only count lines with a full cost, like the dish totals.
    if (missing || !hasRecipe) return;
    const ch = channelLabel(l);
    if (!channels.has(ch)) channels.set(ch, { channel: ch, quantity_sold: 0, sales: 0, food_cost: 0, commission: 0 });
    const c = channels.get(ch);
    c.quantity_sold += qty;
    c.sales += revenue;
    c.food_cost += cost;
    c.commission += commission;
  });

  // Enabled dishes nobody ordered in the period: classified on their current price.
  unsold.forEach((u) => {
    if ([...dishes.values()].some((d) => d.item_id === Number(u.item_id))) return;
    const c = costOf(u.item_id, 0, []);
    const price = exTaxPrice(u.price, u.tax_rate, u.tax_type);
    dishes.set(`${u.item_id}:0`, {
      item_id: Number(u.item_id),
      variant_id: null,
      dish: u.item_title,
      category: u.category_title || "Uncategorized",
      quantity_sold: 0,
      sales: 0,
      food_cost: 0,
      commission: 0,
      list_price: price,
      list_cost: c.cost,
      missing: c.missing,
      no_recipe: !c.hasRecipe,
    });
  });

  const rows = [...dishes.values()].map((d) => {
    const costed = !d.missing && !d.no_recipe;
    const sold = d.quantity_sold > 0;
    const avgPrice = sold ? d.sales / d.quantity_sold : (d.list_price || 0);
    const unitCost = sold ? d.food_cost / d.quantity_sold : (d.list_cost || 0);
    const unitCommission = sold ? d.commission / d.quantity_sold : 0;
    const profitPerPlate = avgPrice - unitCost - unitCommission;
    return {
      ...d,
      costed,
      average_price: avgPrice,
      cost_per_plate: unitCost,
      profit_per_plate: profitPerPlate,
      total_profit: d.sales - d.food_cost - d.commission,
      food_cost_percent: avgPrice > 0 ? (unitCost / avgPrice) * 100 : null,
    };
  });

  const overall = classify(rows, "class");
  const byCategory = new Map();
  rows.forEach((d) => {
    if (!byCategory.has(d.category)) byCategory.set(d.category, []);
    byCategory.get(d.category).push(d);
  });
  byCategory.forEach((list) => classify(list, "class_in_category"));

  rows.forEach((d) => {
    if (!d.costed) {
      d.class = null;
      d.class_in_category = null;
      noRecipe.set(d.dish, d.no_recipe ? "No recipe" : "An ingredient has no purchase price");
    }
  });

  const categories = [...byCategory.entries()].map(([category, list]) => {
    const costed = list.filter((d) => d.costed);
    const qty = costed.reduce((s, d) => s + d.quantity_sold, 0);
    const sales = costed.reduce((s, d) => s + d.sales, 0);
    const foodCost = costed.reduce((s, d) => s + d.food_cost, 0);
    const profit = costed.reduce((s, d) => s + d.total_profit, 0);
    const count = (k) => costed.filter((d) => d.class_in_category === k).length;
    return {
      category,
      dishes: list.length,
      quantity_sold: qty,
      sales: r2(sales),
      food_cost: r2(foodCost),
      total_profit: r2(profit),
      food_cost_percent: sales > 0 ? r2((foodCost / sales) * 100) : null,
      stars: count("Star"),
      plowhorses: count("Plowhorse"),
      puzzles: count("Puzzle"),
      dogs: count("Dog"),
    };
  }).sort((a, b) => b.total_profit - a.total_profit);

  const channelRows = [...channels.values()].map((c) => ({
    channel: c.channel,
    quantity_sold: c.quantity_sold,
    sales: r2(c.sales),
    food_cost: r2(c.food_cost),
    commission: r2(c.commission),
    total_profit: r2(c.sales - c.food_cost - c.commission),
    food_cost_percent: c.sales > 0 ? r2((c.food_cost / c.sales) * 100) : null,
  })).sort((a, b) => b.sales - a.sales);

  // A dish without a full cost shows no cost or profit rather than a false one.
  const ifCosted = (d, value) => (d.costed ? value : null);
  const dishRows = rows
    .map((d) => ({
      item_id: d.item_id,
      variant_id: d.variant_id,
      dish: d.dish,
      category: d.category,
      class: d.class,
      class_in_category: d.class_in_category,
      quantity_sold: d.quantity_sold,
      average_price: r2(d.average_price),
      cost_per_plate: ifCosted(d, r4(d.cost_per_plate)),
      profit_per_plate: ifCosted(d, r2(d.profit_per_plate)),
      food_cost_percent: d.food_cost_percent === null ? null : ifCosted(d, r2(d.food_cost_percent)),
      sales: r2(d.sales),
      commission: r2(d.commission),
      total_profit: ifCosted(d, r2(d.total_profit)),
      advice: d.class ? CLASS_ADVICE[d.class] : (d.no_recipe ? "Add a recipe to cost this dish." : "Add a purchase price for its ingredients."),
    }))
    .sort((a, b) => ((a.total_profit === null) - (b.total_profit === null))
      || ((b.total_profit || 0) - (a.total_profit || 0))
      || (b.quantity_sold - a.quantity_sold));

  const costed = rows.filter((d) => d.costed);
  const totals = costed.reduce((t, d) => ({
    sales: t.sales + d.sales,
    food_cost: t.food_cost + d.food_cost,
    profit: t.profit + d.total_profit,
  }), { sales: 0, food_cost: 0, profit: 0 });

  return {
    dishes: dishRows,
    categories,
    channels: channelRows,
    missing: [...noRecipe.entries()].map(([dish, reason]) => ({ dish, reason })),
    ingredientsWithoutCost: [...ingredientsWithoutCost].sort(),
    totals: {
      sales: r2(totals.sales),
      food_cost: r2(totals.food_cost),
      profit: r2(totals.profit),
      food_cost_percent: totals.sales > 0 ? r2((totals.food_cost / totals.sales) * 100) : null,
      dish_count: rows.length,
      costed_count: costed.length,
      popularity_threshold: r2(overall.popularityThreshold),
      average_profit_per_plate: r2(overall.averageProfit),
      counts: ["Star", "Plowhorse", "Puzzle", "Dog"].reduce((acc, k) => {
        acc[k] = costed.filter((d) => d.class === k).length;
        return acc;
      }, {}),
    },
  };
};

/** Loads the rows for the calculation. `dateFilter` comes from getFilterCondition("oi.date", ...). */
exports.loadMenuEngineeringData = async (conn, { tenantIds, dateFilter, nonVoidFilter, latestCostSql }) => {
  const [[lines], [recipes], [ingredientCosts], [unsold]] = await Promise.all([
    conn.query(`
      SELECT oi.id, oi.item_id, oi.variant_id, oi.price, oi.quantity, oi.addons,
             oi.combo_parent_id, oi.is_combo_parent,
             mi.title AS item_title, v.title AS variant_title, c.title AS category_title,
             t.rate AS tax_rate, t.type AS tax_type,
             o.delivery_type, dp.name AS platform_name, dp.commission_percent
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id
      LEFT JOIN invoices i ON i.id = o.invoice_id AND i.tenant_id = o.tenant_id
      LEFT JOIN menu_items mi ON mi.id = oi.item_id AND mi.tenant_id = oi.tenant_id
      LEFT JOIN menu_item_variants v ON v.id = oi.variant_id AND v.tenant_id = oi.tenant_id
      LEFT JOIN categories c ON c.id = mi.category AND c.tenant_id = mi.tenant_id
      LEFT JOIN taxes t ON t.id = mi.tax_id AND t.tenant_id = mi.tenant_id
      LEFT JOIN delivery_platforms dp ON dp.id = o.delivery_platform_id AND dp.tenant_id = o.tenant_id
      WHERE oi.tenant_id IN (?) AND oi.status <> 'cancelled' AND ${dateFilter.filter}
        AND oi.item_id IS NOT NULL
        AND COALESCE(mi.is_open_item, 0) = 0
        AND (o.invoice_id IS NULL OR (${nonVoidFilter}))
    `, [tenantIds, ...dateFilter.params]),
    conn.query(`
      SELECT r.menu_item_id, r.variant_id, r.addon_id, r.inventory_item_id, r.quantity,
             ii.title AS ingredient_title
      FROM menu_item_recipes r
      LEFT JOIN inventory_items ii ON ii.id = r.inventory_item_id AND ii.tenant_id = r.tenant_id
      WHERE r.tenant_id IN (?)
    `, [tenantIds]),
    conn.query(latestCostSql, [tenantIds]),
    conn.query(`
      SELECT mi.id AS item_id, mi.title AS item_title, mi.price, c.title AS category_title,
             t.rate AS tax_rate, t.type AS tax_type
      FROM menu_items mi
      LEFT JOIN categories c ON c.id = mi.category AND c.tenant_id = mi.tenant_id
      LEFT JOIN taxes t ON t.id = mi.tax_id AND t.tenant_id = mi.tenant_id
      WHERE mi.tenant_id IN (?) AND COALESCE(mi.is_enabled, 1) = 1
        AND COALESCE(mi.is_open_item, 0) = 0 AND COALESCE(mi.is_combo, 0) = 0
    `, [tenantIds]),
  ]);
  return { lines, recipes, ingredientCosts, unsold };
};

exports.CLASS_ADVICE = CLASS_ADVICE;
