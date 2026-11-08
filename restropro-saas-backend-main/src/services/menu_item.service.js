const { getMySqlPromiseConnection } = require("../config/mysql.db");
const { getOrSetCache, invalidateTenantCatalog } = require("../utils/cache.util");
const { linkUnlinkedAddons } = require("../utils/addonLibraryMigration");

/**
 * Add-on names live in the shared library, so translations set on an item's
 * add-on are written to its library entry and every item that uses it.
 */
async function syncAddonTranslationsToLibrary(conn, addonId, translations, tenantId) {
    const [[row]] = await conn.query(
        `SELECT library_addon_id FROM menu_item_addons WHERE id = ? AND tenant_id = ?`,
        [addonId, tenantId]
    );
    if (!row?.library_addon_id) return;
    await conn.query(
        `UPDATE addon_library SET translations = ? WHERE id = ? AND tenant_id = ?`,
        [translations, row.library_addon_id, tenantId]
    );
    await conn.query(
        `UPDATE menu_item_addons SET translations = ? WHERE library_addon_id = ? AND tenant_id = ?`,
        [translations, row.library_addon_id, tenantId]
    );
}

exports.addMenuItemDB = async (title, description, price, netPrice, taxId, categoryId, tenantId, kitchenStationId = null, translations = null) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        INSERT INTO menu_items
        (title, description, price, net_price, tax_id, category, tenant_id, kitchen_station_id, translations)
        VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;

        const [result] = await conn.query(sql, [
          title, 
          description, 
          price, 
          netPrice, 
          taxId, 
          categoryId, 
          tenantId,
          kitchenStationId ? Number(kitchenStationId) : null,
          translations || null
        ]);

        await invalidateTenantCatalog(tenantId);
        return result.insertId;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
}

exports.updateMenuItemDB = async (id, title, description, price, netPrice, taxId, categoryId, tenantId, kitchenStationId = undefined, translations = undefined) => {
    const conn = await getMySqlPromiseConnection();
    try {

        let sql = `
        UPDATE menu_items SET
        title = ?, description = ?, price = ?, net_price = ?, tax_id = ?, category = ?
        `;
        const params = [title, description, price, netPrice, taxId, categoryId];

        if (kitchenStationId !== undefined) {
            sql += `, kitchen_station_id = ?`;
            params.push(kitchenStationId ? Number(kitchenStationId) : null);
        }

        if (translations !== undefined) {
            sql += `, translations = ?`;
            params.push(translations);
        }

        sql += ` WHERE id = ? AND tenant_id = ?;`;
        params.push(id, tenantId);

        await conn.query(sql, params);

        await invalidateTenantCatalog(tenantId);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
}

exports.updateMenuItemImageDB = async (id, image, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        UPDATE menu_items SET
        image = ?
        WHERE id = ? AND tenant_id = ?;
        `;

        await conn.query(sql, [image, id, tenantId]);

        await invalidateTenantCatalog(tenantId);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
}

exports.deleteMenuItemDB = async (id, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        DELETE FROM menu_items
        WHERE id = ? AND tenant_id = ?;
        `;

        await conn.query(sql, [id, tenantId]);

        await invalidateTenantCatalog(tenantId);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
}

exports.changeMenuItemVisibilityDB = async (id, isEnabled, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
         UPDATE menu_items SET
         is_enabled = ?
         WHERE id = ? AND tenant_id = ?;
        `;

        await conn.query(sql, [isEnabled, id, tenantId]);

        await invalidateTenantCatalog(tenantId);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
}

exports.getAllMenuItemsDB = async (tenantId) => {
    return getOrSetCache(`tenant:${tenantId}:catalog:menu_items:all`, 1800, async () => {
        const conn = await getMySqlPromiseConnection();
        try {

            const sql = `
            SELECT
            i.id, i.title, i.description, price, net_price, tax_id, t.title AS tax_title, t.rate AS tax_rate, t.type AS tax_type, 
            category as category_id, c.title AS category_title, image, i.is_enabled,
            i.is_sold_out, i.stock_limit, i.sold_out_auto_reset, i.is_combo, i.barcode,
            i.translations, c.translations AS category_translations,
            i.kitchen_station_id,
            ks.name AS kitchen_station_name,
            ks.color AS kitchen_station_color,
            c.kitchen_station_id AS category_kitchen_station_id,
            cks.name AS category_kitchen_station_name,
            cks.color AS category_kitchen_station_color,
            COALESCE(i.kitchen_station_id, c.kitchen_station_id) AS effective_kitchen_station_id,
            COALESCE(ks.name, cks.name) AS effective_kitchen_station_name,
            COALESCE(ks.color, cks.color) AS effective_kitchen_station_color
            FROM menu_items i
            LEFT JOIN taxes t ON i.tax_id = t.id
            LEFT JOIN categories c ON i.category = c.id
            LEFT JOIN kitchen_stations ks ON i.kitchen_station_id = ks.id AND ks.tenant_id = i.tenant_id
            LEFT JOIN kitchen_stations cks ON c.kitchen_station_id = cks.id AND cks.tenant_id = i.tenant_id
            WHERE i.tenant_id = ? AND i.is_open_item = 0;
            `;

            const [result] = await conn.query(sql, [tenantId]);
            return result;
        } catch (error) {
            console.error(error);
            throw error;
        } finally {
            conn.release();
        }
    });
}

exports.getMenuItemDB = async (id, tenantId) => {
    return getOrSetCache(`tenant:${tenantId}:catalog:menu_item:${id}`, 1800, async () => {
        const conn = await getMySqlPromiseConnection();
        try {

            const sql = `
            SELECT
            i.id, i.title, i.description, price, net_price, tax_id, t.title AS tax_title, t.rate AS tax_rate, t.type AS tax_type, 
            category as category_id, c.title AS category_title, image, i.is_enabled,
            i.is_sold_out, i.stock_limit, i.sold_out_auto_reset, i.is_combo, i.barcode,
            i.translations, c.translations AS category_translations,
            i.kitchen_station_id,
            ks.name AS kitchen_station_name,
            ks.color AS kitchen_station_color,
            c.kitchen_station_id AS category_kitchen_station_id,
            cks.name AS category_kitchen_station_name,
            cks.color AS category_kitchen_station_color,
            COALESCE(i.kitchen_station_id, c.kitchen_station_id) AS effective_kitchen_station_id,
            COALESCE(ks.name, cks.name) AS effective_kitchen_station_name,
            COALESCE(ks.color, cks.color) AS effective_kitchen_station_color
            FROM menu_items i
            LEFT JOIN taxes t ON i.tax_id = t.id
            LEFT JOIN categories c ON i.category = c.id
            LEFT JOIN kitchen_stations ks ON i.kitchen_station_id = ks.id AND ks.tenant_id = i.tenant_id
            LEFT JOIN kitchen_stations cks ON c.kitchen_station_id = cks.id AND cks.tenant_id = i.tenant_id
            WHERE i.id = ? AND i.tenant_id = ?
            `;

            const [result] = await conn.query(sql, [id, tenantId]);
            return result[0];
        } catch (error) {
            console.error(error);
            throw error;
        } finally {
            conn.release();
        }
    });
}

/**
 * @param {number} itemId Menu Item ID to add Addon
 * @param {string} title Title of Addon
 * @param {number} price Additonal Price for addon, Put 0 / null to make addon as free option
 * @returns {Promise<number>}
 *  */
exports.addMenuItemAddonDB = async (itemId, title, price, tenantId, translations = null) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        INSERT INTO menu_item_addons
        (item_id, title, price, tenant_id, translations)
        VALUES
        (?, ?, ?, ?, ?);
        `;

        const [result] = await conn.query(sql, [itemId, title, price, tenantId, translations || null]);
        await linkUnlinkedAddons(conn, tenantId);
        if (translations) await syncAddonTranslationsToLibrary(conn, result.insertId, translations, tenantId);
        await invalidateTenantCatalog(tenantId);
        return result.insertId;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * @param {number} itemId Menu Item ID
 * @param {number} addonId Addon ID
 * @param {string} title Title of Addon
 * @param {number} price Additonal Price for addon, Put 0 / null to make addon as free option
 * @returns {Promise<void>}
 *  */
exports.updateMenuItemAddonDB = async (itemId, addonId, title, price, tenantId, translations = undefined) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        UPDATE menu_item_addons
        SET
        title = ?, price = ?
        WHERE id = ? AND item_id = ? AND tenant_id = ?
        `;

        await conn.query(sql, [title, price, addonId, itemId, tenantId]);
        if (translations !== undefined) {
            await conn.query(
                `UPDATE menu_item_addons SET translations = ? WHERE id = ? AND item_id = ? AND tenant_id = ?`,
                [translations, addonId, itemId, tenantId]
            );
            await syncAddonTranslationsToLibrary(conn, addonId, translations, tenantId);
        }
        await invalidateTenantCatalog(tenantId);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Enable / disable an addon without deleting it (keeps order history & recipes intact).
 * @param {number} itemId Menu Item ID
 * @param {number} addonId Addon ID
 * @param {boolean} isEnabled
 * @returns {Promise<number>} affected rows
 *  */
exports.changeMenuItemAddonAvailabilityDB = async (itemId, addonId, isEnabled, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const sql = `
        UPDATE menu_item_addons
        SET is_enabled = ?
        WHERE id = ? AND item_id = ? AND tenant_id = ?
        `;

        const [result] = await conn.query(sql, [isEnabled ? 1 : 0, addonId, itemId, tenantId]);
        await invalidateTenantCatalog(tenantId);
        return result.affectedRows;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * @param {number} itemId Menu Item ID
 * @param {number} addonId Addon ID
 * @returns {Promise<void>}
 *  */
exports.deleteMenuItemAddonDB = async (itemId, addonId, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        DELETE FROM menu_item_addons
        WHERE id = ? AND item_id = ? AND tenant_id = ?;
        `;

        await conn.query(sql, [addonId, itemId, tenantId]);
        await invalidateTenantCatalog(tenantId);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * @param {number} itemId Menu Item ID
 * @param {number} addonId Addon ID
 * @returns {Promise<Array>}
 *  */
exports.getMenuItemAddonsDB = async (itemId, tenantId) => {
    return getOrSetCache(`tenant:${tenantId}:catalog:addons:${itemId}`, 1800, async () => {
        const conn = await getMySqlPromiseConnection();
        try {

            const sql = `
            SELECT mia.id, mia.item_id, mia.title, mia.price,
              COALESCE(al.translations, mia.translations) AS translations,
              mia.library_addon_id, mia.has_custom_price, al.price AS library_price,
              mia.is_enabled AS item_enabled, COALESCE(al.is_enabled, 1) AS library_enabled,
              IF(mia.is_enabled = 1 AND COALESCE(al.is_enabled, 1) = 1, 1, 0) AS is_enabled
            FROM menu_item_addons mia
            LEFT JOIN addon_library al ON al.id = mia.library_addon_id AND al.tenant_id = mia.tenant_id
            WHERE mia.item_id = ? AND mia.tenant_id = ?
            ORDER BY mia.id ASC;
            `;

            const [result] = await conn.query(sql, [itemId, tenantId]);

            return result;
        } catch (error) {
            console.error(error);
            throw error;
        } finally {
            conn.release();
        }
    });
};

exports.getAllAddonsDB = async (tenantId) => {
    return getOrSetCache(`tenant:${tenantId}:catalog:addons:all`, 1800, async () => {
        const conn = await getMySqlPromiseConnection();
        try {

            const sql = `
            SELECT mia.id, mia.item_id, mia.title, mia.price,
              COALESCE(al.translations, mia.translations) AS translations,
              mia.library_addon_id, mia.has_custom_price, al.price AS library_price,
              mia.is_enabled AS item_enabled, COALESCE(al.is_enabled, 1) AS library_enabled,
              IF(mia.is_enabled = 1 AND COALESCE(al.is_enabled, 1) = 1, 1, 0) AS is_enabled
            FROM menu_item_addons mia
            LEFT JOIN addon_library al ON al.id = mia.library_addon_id AND al.tenant_id = mia.tenant_id
            WHERE mia.tenant_id = ?
            ORDER BY mia.id ASC;
            `;

            const [result] = await conn.query(sql, [tenantId]);

            return result;
        } catch (error) {
            console.error(error);
            throw error;
        } finally {
            conn.release();
        }
    });
};

/**
 * @param {number} itemId Menu Item ID to add Variant
 * @param {string} title Title of Variant
 * @param {number} price Additonal Price for Variant, Put 0 / null to make Variant as free option
 * @returns {Promise<number>}
 *  */
exports.addMenuItemVariantDB = async (itemId, title, price, tenantId, translations = null) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        INSERT INTO menu_item_variants
        (item_id, title, price, tenant_id, translations)
        VALUES
        (?, ?, ?, ?, ?);
        `;

        const [result] = await conn.query(sql, [itemId, title, price, tenantId, translations || null]);
        await invalidateTenantCatalog(tenantId);
        return result.insertId;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.updateMenuItemVariantDB = async (itemId, variantId, title, price, tenantId, translations = undefined) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        UPDATE menu_item_variants
        SET
        title = ?, price = ?${translations !== undefined ? ", translations = ?" : ""}
        WHERE item_id = ? AND id = ? AND tenant_id = ?
        `;

        const params = translations !== undefined
            ? [title, price, translations, itemId, variantId, tenantId]
            : [title, price, itemId, variantId, tenantId];
        await conn.query(sql, params);
        await invalidateTenantCatalog(tenantId);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.deleteMenuItemVariantDB = async (itemId, variantId, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        DELETE FROM menu_item_variants
        WHERE item_id = ? AND id = ? AND tenant_id = ?
        `;

        await conn.query(sql, [itemId, variantId, tenantId]);
        await invalidateTenantCatalog(tenantId);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getMenuItemVariantsDB = async (itemId, tenantId) => {
    return getOrSetCache(`tenant:${tenantId}:catalog:variants:${itemId}`, 1800, async () => {
        const conn = await getMySqlPromiseConnection();
        try {

            const sql = `
            SELECT id, item_id, title, price, translations FROM menu_item_variants
            WHERE item_id = ? AND tenant_id = ?;
            `;

            const [result] = await conn.query(sql, [itemId, tenantId]);

            return result;
        } catch (error) {
            console.error(error);
            throw error;
        } finally {
            conn.release();
        }
    });
};
exports.getAllVariantsDB = async (tenantId) => {
    return getOrSetCache(`tenant:${tenantId}:catalog:variants:all`, 1800, async () => {
        const conn = await getMySqlPromiseConnection();
        try {

            const sql = `
            SELECT id, item_id, title, price, translations FROM menu_item_variants
            WHERE tenant_id = ?;
            `;

            const [result] = await conn.query(sql, [tenantId]);
            return result;
        } catch (error) {
            console.error(error);
            throw error;
        } finally {
            conn.release();
        }
    });
};


exports.addRecipeItemDB = async (menuItemId, variantId, addonId, ingredientId, quantity, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const sql = `
        INSERT INTO menu_item_recipes
        (menu_item_id, variant_id, addon_id, inventory_item_id, quantity, tenant_id)
        VALUES
        (?, ?, ?, ?, ?, ?);
        `;

        const [result] = await conn.query(sql, [menuItemId, variantId, addonId, ingredientId, quantity, tenantId]);
        await invalidateTenantCatalog(tenantId);
        return result.insertId;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.updateRecipeItemDB = async (recipeItemId, menuItemId, variantId, addonId, ingredientId, quantity, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const sql = `
        UPDATE menu_item_recipes
        SET
          menu_item_id = ?,
          variant_id = ?,
          addon_id = ?,
          inventory_item_id = ?,
          quantity = ?
        WHERE id = ? AND tenant_id = ?;
      `;

        const [result] = await conn.query(sql, [
            menuItemId,
            variantId,
            addonId,
            ingredientId,
            quantity,
            recipeItemId,
            tenantId
        ]);

        await invalidateTenantCatalog(tenantId);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getRecipeItemsDB = async (menuItemId, tenantId) => {
    return getOrSetCache(`tenant:${tenantId}:catalog:recipes:${menuItemId}`, 1800, async () => {
        const conn = await getMySqlPromiseConnection();
        try {
            const sql = `
            SELECT
                mir.id,
                mir.menu_item_id,
                mir.variant_id,
                mir.addon_id,
                mir.inventory_item_id,
                mi.title AS menu_item_title,
                v.title AS variant_title,
                a.title AS addon_title,
                ii.title AS ingredient_title,
                ii.unit,
                mir.quantity,
                'item' AS source,
                NULL AS library_addon_id
            FROM
                menu_item_recipes mir
            LEFT JOIN
                menu_items mi ON mir.menu_item_id = mi.id
            LEFT JOIN
                menu_item_variants v ON mir.variant_id = v.id
            LEFT JOIN
                menu_item_addons a ON mir.addon_id = a.id
            LEFT JOIN
                inventory_items ii ON mir.inventory_item_id = ii.id
            WHERE
                mir.menu_item_id = ? AND mir.tenant_id = ?
            UNION ALL
            SELECT
                -alr.id AS id,
                mia.item_id AS menu_item_id,
                0 AS variant_id,
                mia.id AS addon_id,
                alr.inventory_item_id,
                mi.title AS menu_item_title,
                NULL AS variant_title,
                mia.title AS addon_title,
                ii.title AS ingredient_title,
                ii.unit,
                alr.quantity,
                'library' AS source,
                alr.library_addon_id
            FROM addon_library_recipes alr
            JOIN menu_item_addons mia ON mia.library_addon_id = alr.library_addon_id AND mia.tenant_id = alr.tenant_id
            LEFT JOIN menu_items mi ON mi.id = mia.item_id
            LEFT JOIN inventory_items ii ON ii.id = alr.inventory_item_id
            WHERE mia.item_id = ? AND alr.tenant_id = ?
            `;

            const [rows] = await conn.query(sql, [menuItemId, tenantId, menuItemId, tenantId]);
            return rows;
        } catch (error) {
            console.error(error);
            throw error;
        } finally {
            conn.release();
        }
    });
};

exports.getAllRecipeItemsDB = async (tenantId) => {
    return getOrSetCache(`tenant:${tenantId}:catalog:recipes:all`, 1800, async () => {
        const conn = await getMySqlPromiseConnection();
        try {
            const sql = `
            SELECT
                mir.id,
                mir.menu_item_id,
                mir.variant_id,
                mir.addon_id,
                mir.inventory_item_id,
                mi.title AS menu_item_title,
                v.title AS variant_title,
                a.title AS addon_title,
                ii.title AS ingredient_title,
                ii.unit,
                ii.quantity as current_quantity,
                ii.min_quantity_threshold,
                mir.quantity as recipe_quantity,
                'item' AS source,
                NULL AS library_addon_id
            FROM
                menu_item_recipes mir
            LEFT JOIN
                menu_items mi ON mir.menu_item_id = mi.id
            LEFT JOIN
                menu_item_variants v ON mir.variant_id = v.id
            LEFT JOIN
                menu_item_addons a ON mir.addon_id = a.id
            LEFT JOIN
                inventory_items ii ON mir.inventory_item_id = ii.id
            WHERE
                mir.tenant_id = ?
            UNION ALL
            SELECT
                -alr.id AS id,
                mia.item_id AS menu_item_id,
                0 AS variant_id,
                mia.id AS addon_id,
                alr.inventory_item_id,
                mi.title AS menu_item_title,
                NULL AS variant_title,
                mia.title AS addon_title,
                ii.title AS ingredient_title,
                ii.unit,
                ii.quantity as current_quantity,
                ii.min_quantity_threshold,
                alr.quantity as recipe_quantity,
                'library' AS source,
                alr.library_addon_id
            FROM addon_library_recipes alr
            JOIN menu_item_addons mia ON mia.library_addon_id = alr.library_addon_id AND mia.tenant_id = alr.tenant_id
            LEFT JOIN menu_items mi ON mi.id = mia.item_id
            LEFT JOIN inventory_items ii ON ii.id = alr.inventory_item_id
            WHERE alr.tenant_id = ?
            `;

            const [rows] = await conn.query(sql, [tenantId, tenantId]);
            return rows;
        } catch (error) {
            console.error(error);
            throw error;
        } finally {
            conn.release();
        }
    });
};

exports.deleteRecipeItemDB = async (itemId, recipeItemId, variant, addon, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {
        let sql = `
        DELETE FROM menu_item_recipes
        WHERE menu_item_id = ?
        AND id = ?
        AND tenant_id = ?
      `;

        const params = [itemId, recipeItemId, tenantId];

        if (variant) {
            sql += ` AND variant_id = ?`;
            params.push(variant);
        }

        if (addon) {
            sql += ` AND addon_id = ?`;
            params.push(addon);
        }

        await conn.query(sql, params);
        await invalidateTenantCatalog(tenantId);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};


/** Set (or clear) a menu item's barcode; unique per tenant. */
exports.setMenuItemBarcodeDB = async (id, barcode, tenantId) => {
    const clean = barcode === null || barcode === undefined ? "" : String(barcode).trim().slice(0, 64);
    const conn = await getMySqlPromiseConnection();
    try {
        if (clean) {
            const [[taken]] = await conn.query(
                `SELECT id, title FROM menu_items WHERE tenant_id = ? AND barcode = ? AND id <> ? LIMIT 1`,
                [tenantId, clean, id]
            );
            if (taken) {
                const err = new Error(`Barcode already used by "${taken.title}"`);
                err.statusCode = 409;
                throw err;
            }
        }
        await conn.query(`UPDATE menu_items SET barcode = ? WHERE id = ? AND tenant_id = ?`, [clean || null, id, tenantId]);
        await invalidateTenantCatalog(tenantId);
    } finally {
        conn.release();
    }
};
