/**
 * Combos / set meals.
 *
 * A combo is a menu item (menu_items.is_combo = 1) that carries its own price,
 * image and category, plus choice groups ("Pick 1 drink"). When sold it is
 * stored as one priced parent line (is_combo_parent = 1, never shown on the
 * KDS) and one zero-priced component line per choice, routed to each
 * component's own kitchen station and deducting its own recipe.
 */
const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { invalidateTenantCatalog } = require("../utils/cache.util");

function comboError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = "COMBO_INVALID";
  return err;
}

/** Groups + options for the tenant's combos, keyed by combo item id. */
exports.getComboGroupsDB = async (tenantId, comboItemIds = null) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const params = [tenantId];
    let where = "g.tenant_id = ?";
    if (Array.isArray(comboItemIds)) {
      if (comboItemIds.length === 0) return {};
      where += " AND g.combo_item_id IN (?)";
      params.push(comboItemIds);
    }
    const [groups] = await conn.query(
      `SELECT g.id, g.combo_item_id, g.title, g.min_select, g.max_select, g.sort_order
       FROM menu_combo_groups g WHERE ${where} ORDER BY g.combo_item_id, g.sort_order, g.id`,
      params
    );
    if (groups.length === 0) return {};

    const [options] = await conn.query(
      `SELECT o.id, o.group_id, o.menu_item_id, o.variant_id, o.extra_price, o.sort_order,
              mi.title, mi.translations, mi.image, mi.is_enabled, mi.is_sold_out, mi.stock_limit,
              v.title AS variant_title,
              COALESCE(mi.kitchen_station_id, c.kitchen_station_id) AS kitchen_station_id,
              ks.name AS kitchen_station_name
       FROM menu_combo_options o
       JOIN menu_items mi ON mi.id = o.menu_item_id AND mi.tenant_id = o.tenant_id
       LEFT JOIN menu_item_variants v ON v.id = o.variant_id AND v.item_id = o.menu_item_id
       LEFT JOIN categories c ON c.id = mi.category
       LEFT JOIN kitchen_stations ks ON ks.id = COALESCE(mi.kitchen_station_id, c.kitchen_station_id) AND ks.tenant_id = o.tenant_id
       WHERE o.tenant_id = ? AND o.group_id IN (?)
       ORDER BY o.group_id, o.sort_order, o.id`,
      [tenantId, groups.map((g) => g.id)]
    );

    const byCombo = {};
    for (const g of groups) {
      if (!byCombo[g.combo_item_id]) byCombo[g.combo_item_id] = [];
      byCombo[g.combo_item_id].push({ ...g, options: options.filter((o) => o.group_id === g.id) });
    }
    return byCombo;
  } finally {
    conn.release();
  }
};

/** Combos for the settings page. */
exports.getCombosDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  let combos;
  try {
    [combos] = await conn.query(
      `SELECT i.id, i.title, i.description, i.price, i.image, i.category AS category_id, i.is_enabled, i.tax_id, i.translations
       FROM menu_items i WHERE i.tenant_id = ? AND i.is_combo = 1 ORDER BY i.title`,
      [tenantId]
    );
  } finally {
    conn.release();
  }
  const groups = await exports.getComboGroupsDB(tenantId, combos.map((c) => c.id));
  return combos.map((c) => ({ ...c, groups: groups[c.id] || [] }));
};

function sanitizeGroups(groups) {
  if (!Array.isArray(groups) || groups.length === 0) throw comboError("Add at least one choice group");
  return groups.map((g, gi) => {
    const title = String(g.title || "").trim().slice(0, 120);
    if (!title) throw comboError("Every group needs a name");
    const options = (Array.isArray(g.options) ? g.options : [])
      .map((o, oi) => ({
        menuItemId: Number(o.menuItemId ?? o.menu_item_id),
        variantId: Number(o.variantId ?? o.variant_id) || null,
        extraPrice: Math.max(0, Number(o.extraPrice ?? o.extra_price) || 0),
        sort: oi,
      }))
      .filter((o) => o.menuItemId > 0);
    if (options.length === 0) throw comboError(`"${title}" needs at least one item`);
    const min = Math.max(0, parseInt(g.minSelect ?? g.min_select, 10) || 0);
    const max = Math.max(1, parseInt(g.maxSelect ?? g.max_select, 10) || 1);
    if (min > max) throw comboError(`"${title}": minimum is more than maximum`);
    return { title, min, max, sort: gi, options };
  });
}

async function writeGroups(conn, tenantId, comboId, groups) {
  const [old] = await conn.query(`SELECT id FROM menu_combo_groups WHERE tenant_id = ? AND combo_item_id = ?`, [tenantId, comboId]);
  if (old.length) {
    await conn.query(`DELETE FROM menu_combo_options WHERE tenant_id = ? AND group_id IN (?)`, [tenantId, old.map((r) => r.id)]);
    await conn.query(`DELETE FROM menu_combo_groups WHERE tenant_id = ? AND combo_item_id = ?`, [tenantId, comboId]);
  }
  // Components must belong to this tenant and must not be combos themselves.
  const ids = [...new Set(groups.flatMap((g) => g.options.map((o) => o.menuItemId)))];
  const [valid] = await conn.query(
    `SELECT id FROM menu_items WHERE tenant_id = ? AND id IN (?) AND is_combo = 0 AND is_open_item = 0`,
    [tenantId, ids]
  );
  const validIds = new Set(valid.map((r) => r.id));
  for (const g of groups) {
    const [res] = await conn.query(
      `INSERT INTO menu_combo_groups (tenant_id, combo_item_id, title, min_select, max_select, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      [tenantId, comboId, g.title, g.min, g.max, g.sort]
    );
    const rows = g.options
      .filter((o) => validIds.has(o.menuItemId))
      .map((o) => [tenantId, res.insertId, o.menuItemId, o.variantId, o.extraPrice, o.sort]);
    if (rows.length === 0) throw comboError(`"${g.title}" has no valid items`);
    await conn.query(
      `INSERT INTO menu_combo_options (tenant_id, group_id, menu_item_id, variant_id, extra_price, sort_order) VALUES ?`,
      [rows]
    );
  }
}

exports.saveComboDB = async (tenantId, comboId, input) => {
  const title = String(input.title || "").trim().slice(0, 255);
  const price = Number(input.price);
  if (!title) throw comboError("Enter a name");
  if (!(price >= 0)) throw comboError("Enter a price");
  const groups = sanitizeGroups(input.groups);

  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();
    let id = comboId;
    if (id) {
      const [res] = await conn.query(
        `UPDATE menu_items SET title = ?, description = ?, price = ?, net_price = ?, category = ?, tax_id = ?, is_enabled = ?
         WHERE id = ? AND tenant_id = ? AND is_combo = 1`,
        [title, input.description || null, price, price, input.categoryId || null, input.taxId || null, input.isEnabled === false ? 0 : 1, id, tenantId]
      );
      if (res.affectedRows === 0) throw comboError("Combo not found", 404);
    } else {
      const [res] = await conn.query(
        `INSERT INTO menu_items (title, description, price, net_price, tax_id, category, tenant_id, is_enabled, is_combo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [title, input.description || null, price, price, input.taxId || null, input.categoryId || null, tenantId, input.isEnabled === false ? 0 : 1]
      );
      id = res.insertId;
    }
    await writeGroups(conn, tenantId, id, groups);
    await conn.commit();
    await invalidateTenantCatalog(tenantId);
    return id;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.deleteComboDB = async (tenantId, comboId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();
    const [groups] = await conn.query(`SELECT id FROM menu_combo_groups WHERE tenant_id = ? AND combo_item_id = ?`, [tenantId, comboId]);
    if (groups.length) {
      await conn.query(`DELETE FROM menu_combo_options WHERE tenant_id = ? AND group_id IN (?)`, [tenantId, groups.map((g) => g.id)]);
      await conn.query(`DELETE FROM menu_combo_groups WHERE tenant_id = ? AND combo_item_id = ?`, [tenantId, comboId]);
    }
    await conn.query(`DELETE FROM menu_items WHERE id = ? AND tenant_id = ? AND is_combo = 1`, [comboId, tenantId]);
    await conn.commit();
    await invalidateTenantCatalog(tenantId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Inside createOrderDB: resolve the chosen options of every combo cart line
 * (cartItem.combo.options = [optionId, ...]) against the server copy of the
 * combo and check each group's min/max.
 * Returns Map(cartIndex -> [{ menuItemId, variantId, extraPrice, stationId, title }]).
 */
exports.resolveComboSelectionsTx = async (conn, tenantId, cartItems) => {
  const result = new Map();
  const comboLines = cartItems.map((ci, idx) => ({ ci, idx })).filter(({ ci }) => ci && ci.combo);
  if (comboLines.length === 0) return result;

  const optionIds = [...new Set(comboLines.flatMap(({ ci }) => (ci.combo.options || []).map(Number)).filter(Boolean))];
  if (optionIds.length === 0) throw comboError("Choose the items for your combo");

  const [rows] = await conn.query(
    `SELECT o.id, o.group_id, o.menu_item_id, o.variant_id, o.extra_price, g.combo_item_id,
            mi.title, COALESCE(mi.kitchen_station_id, c.kitchen_station_id) AS station_id
     FROM menu_combo_options o
     JOIN menu_combo_groups g ON g.id = o.group_id AND g.tenant_id = o.tenant_id
     JOIN menu_items mi ON mi.id = o.menu_item_id AND mi.tenant_id = o.tenant_id
     LEFT JOIN categories c ON c.id = mi.category
     WHERE o.tenant_id = ? AND o.id IN (?)`,
    [tenantId, optionIds]
  );
  const byId = new Map(rows.map((r) => [r.id, r]));

  const comboIds = [...new Set(comboLines.map(({ ci }) => Number(ci.id)))];
  const [groups] = await conn.query(
    `SELECT id, combo_item_id, title, min_select, max_select FROM menu_combo_groups WHERE tenant_id = ? AND combo_item_id IN (?)`,
    [tenantId, comboIds]
  );

  for (const { ci, idx } of comboLines) {
    const chosen = (ci.combo.options || []).map((id) => byId.get(Number(id))).filter(Boolean);
    if (chosen.some((o) => Number(o.combo_item_id) !== Number(ci.id))) throw comboError("Combo choice does not belong to this combo");
    for (const g of groups.filter((gr) => Number(gr.combo_item_id) === Number(ci.id))) {
      const count = chosen.filter((o) => o.group_id === g.id).length;
      if (count < g.min_select || count > g.max_select) {
        const need = g.min_select === g.max_select ? `${g.min_select}` : `${g.min_select}-${g.max_select}`;
        throw comboError(`${ci.title || "Combo"}: choose ${need} for "${g.title}"`);
      }
    }
    result.set(
      idx,
      chosen.map((o) => ({
        menuItemId: o.menu_item_id,
        variantId: o.variant_id,
        extraPrice: Number(o.extra_price) || 0,
        stationId: o.station_id,
        title: o.title,
      }))
    );
  }
  return result;
};
