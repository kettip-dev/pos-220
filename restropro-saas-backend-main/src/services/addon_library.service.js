const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { invalidateTenantCatalog } = require("../utils/cache.util");

/**
 * Shared Add-on Library.
 *
 * addon_library is the single source of truth for an add-on's name, default price, on/off and recipe.
 * menu_item_addons rows link an item to a library entry (library_addon_id) and are what orders store,
 * so their title/price are kept in sync here (price only when the item has no custom price).
 */

exports.getLibraryAddonsDB = async (tenantId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [addons] = await conn.query(
      `SELECT al.id, al.title, al.price, al.is_enabled,
              COUNT(mia.id) AS used_by_count
       FROM addon_library al
       LEFT JOIN menu_item_addons mia
         ON mia.library_addon_id = al.id AND mia.tenant_id = al.tenant_id
       WHERE al.tenant_id = ?
       GROUP BY al.id
       ORDER BY al.title ASC`,
      [tenantId]
    );

    const [recipes] = await conn.query(
      `SELECT alr.id, alr.library_addon_id, alr.inventory_item_id, alr.quantity,
              ii.title AS ingredient_title, ii.unit
       FROM addon_library_recipes alr
       LEFT JOIN inventory_items ii ON ii.id = alr.inventory_item_id AND ii.tenant_id = alr.tenant_id
       WHERE alr.tenant_id = ?
       ORDER BY alr.id ASC`,
      [tenantId]
    );

    const [items] = await conn.query(
      `SELECT mia.library_addon_id, mi.id, mi.title
       FROM menu_item_addons mia
       JOIN menu_items mi ON mi.id = mia.item_id AND mi.tenant_id = mia.tenant_id
       WHERE mia.tenant_id = ? AND mia.library_addon_id IS NOT NULL
       ORDER BY mi.title ASC`,
      [tenantId]
    );

    return addons.map((a) => ({
      ...a,
      used_by_count: Number(a.used_by_count || 0),
      recipeItems: recipes.filter((r) => r.library_addon_id === a.id),
      items: items
        .filter((i) => i.library_addon_id === a.id)
        .map(({ id, title }) => ({ id, title })),
    }));
  } finally {
    conn.release();
  }
};

exports.findLibraryAddonByTitleDB = async (tenantId, title, excludeId = null) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [rows] = await conn.query(
      `SELECT id, title, price, is_enabled FROM addon_library
       WHERE tenant_id = ? AND LOWER(TRIM(title)) = LOWER(TRIM(?)) ${excludeId ? "AND id <> ?" : ""}
       LIMIT 1`,
      excludeId ? [tenantId, title, excludeId] : [tenantId, title]
    );
    return rows[0] || null;
  } finally {
    conn.release();
  }
};

exports.createLibraryAddonDB = async (tenantId, title, price) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [result] = await conn.query(
      `INSERT INTO addon_library (tenant_id, title, price) VALUES (?, ?, ?)`,
      [tenantId, title.trim(), Number(price || 0)]
    );
    await invalidateTenantCatalog(tenantId);
    return result.insertId;
  } finally {
    conn.release();
  }
};

exports.updateLibraryAddonDB = async (tenantId, id, title, price) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `UPDATE addon_library SET title = ?, price = ? WHERE id = ? AND tenant_id = ?`,
      [title.trim(), Number(price || 0), id, tenantId]
    );
    if (result.affectedRows === 0) {
      await conn.rollback();
      return 0;
    }
    await conn.query(
      `UPDATE menu_item_addons SET title = ? WHERE library_addon_id = ? AND tenant_id = ?`,
      [title.trim(), id, tenantId]
    );
    await conn.query(
      `UPDATE menu_item_addons SET price = ?
       WHERE library_addon_id = ? AND tenant_id = ? AND has_custom_price = 0`,
      [Number(price || 0), id, tenantId]
    );
    await conn.commit();
    await invalidateTenantCatalog(tenantId);
    return result.affectedRows;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.setLibraryAddonEnabledDB = async (tenantId, id, isEnabled) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [result] = await conn.query(
      `UPDATE addon_library SET is_enabled = ? WHERE id = ? AND tenant_id = ?`,
      [isEnabled ? 1 : 0, id, tenantId]
    );
    await invalidateTenantCatalog(tenantId);
    return result.affectedRows;
  } finally {
    conn.release();
  }
};

/** Deletes the library entry, removes it from every item, and drops its recipes. */
exports.deleteLibraryAddonDB = async (tenantId, id) => {
  const conn = await getMySqlPromiseConnection();
  try {
    await conn.beginTransaction();
    const [links] = await conn.query(
      `SELECT id FROM menu_item_addons WHERE library_addon_id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    const linkIds = links.map((l) => l.id);
    if (linkIds.length > 0) {
      await conn.query(
        `DELETE FROM menu_item_recipes WHERE addon_id IN (?) AND tenant_id = ?`,
        [linkIds, tenantId]
      );
      await conn.query(
        `DELETE FROM menu_item_addons WHERE id IN (?) AND tenant_id = ?`,
        [linkIds, tenantId]
      );
    }
    await conn.query(
      `DELETE FROM addon_library_recipes WHERE library_addon_id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    const [result] = await conn.query(
      `DELETE FROM addon_library WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    await conn.commit();
    await invalidateTenantCatalog(tenantId);
    return result.affectedRows;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

/* ── Library recipes (inventory deduction) ── */

exports.upsertLibraryRecipeDB = async (tenantId, libraryAddonId, inventoryItemId, quantity) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [[addon]] = await conn.query(
      `SELECT id FROM addon_library WHERE id = ? AND tenant_id = ?`,
      [libraryAddonId, tenantId]
    );
    const [[inv]] = await conn.query(
      `SELECT id FROM inventory_items WHERE id = ? AND tenant_id = ?`,
      [inventoryItemId, tenantId]
    );
    if (!addon || !inv) return 0;

    const [result] = await conn.query(
      `INSERT INTO addon_library_recipes (tenant_id, library_addon_id, inventory_item_id, quantity)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
      [tenantId, libraryAddonId, inventoryItemId, quantity]
    );
    await invalidateTenantCatalog(tenantId);
    return result.affectedRows;
  } finally {
    conn.release();
  }
};

exports.deleteLibraryRecipeDB = async (tenantId, libraryAddonId, recipeId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [result] = await conn.query(
      `DELETE FROM addon_library_recipes WHERE id = ? AND library_addon_id = ? AND tenant_id = ?`,
      [recipeId, libraryAddonId, tenantId]
    );
    await invalidateTenantCatalog(tenantId);
    return result.affectedRows;
  } finally {
    conn.release();
  }
};

/* ── Item ↔ library links ── */

/** Adds a library add-on to a menu item. Returns the menu_item_addons id (existing link is reused). */
exports.attachLibraryAddonToItemDB = async (tenantId, itemId, libraryAddonId) => {
  const conn = await getMySqlPromiseConnection();
  try {
    const [[item]] = await conn.query(
      `SELECT id FROM menu_items WHERE id = ? AND tenant_id = ?`,
      [itemId, tenantId]
    );
    const [[lib]] = await conn.query(
      `SELECT id, title, price FROM addon_library WHERE id = ? AND tenant_id = ?`,
      [libraryAddonId, tenantId]
    );
    if (!item || !lib) return null;

    const [[existing]] = await conn.query(
      `SELECT id FROM menu_item_addons WHERE item_id = ? AND library_addon_id = ? AND tenant_id = ? LIMIT 1`,
      [itemId, libraryAddonId, tenantId]
    );
    if (existing) return existing.id;

    const [result] = await conn.query(
      `INSERT INTO menu_item_addons (item_id, title, price, tenant_id, library_addon_id, has_custom_price)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [itemId, lib.title, lib.price, tenantId, libraryAddonId]
    );
    await invalidateTenantCatalog(tenantId);
    return result.insertId;
  } finally {
    conn.release();
  }
};

/** Sets a per-item price override, or resets to the library price when price is null. */
exports.setItemAddonPriceDB = async (tenantId, itemId, addonId, price) => {
  const conn = await getMySqlPromiseConnection();
  try {
    let result;
    if (price === null) {
      [result] = await conn.query(
        `UPDATE menu_item_addons mia
         JOIN addon_library al ON al.id = mia.library_addon_id AND al.tenant_id = mia.tenant_id
         SET mia.price = al.price, mia.has_custom_price = 0
         WHERE mia.id = ? AND mia.item_id = ? AND mia.tenant_id = ?`,
        [addonId, itemId, tenantId]
      );
    } else {
      [result] = await conn.query(
        `UPDATE menu_item_addons SET price = ?, has_custom_price = 1
         WHERE id = ? AND item_id = ? AND tenant_id = ?`,
        [Number(price), addonId, itemId, tenantId]
      );
    }
    await invalidateTenantCatalog(tenantId);
    return result.affectedRows;
  } finally {
    conn.release();
  }
};
