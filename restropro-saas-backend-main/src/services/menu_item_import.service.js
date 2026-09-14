const { getMySqlPromiseConnection } = require("../config/mysql.db");

/**
 * Bulk insert menu items into the database.
 * @param {Array<{title: string, description: string|null, price: number, netPrice: number|null, taxId: number|null, categoryId: number|null, isEnabled: number}>} items
 * @param {number} tenantId
 * @returns {Promise<{insertedCount: number}>}
 */
exports.bulkInsertMenuItemsDB = async (items, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {
        if (!items || items.length === 0) {
            return { insertedCount: 0 };
        }

        const placeholders = items.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
        const values = [];
        for (const item of items) {
            values.push(
                item.title,
                item.description || null,
                item.price,
                item.netPrice || null,
                item.taxId || null,
                item.categoryId || null,
                tenantId,
                item.isEnabled !== undefined ? item.isEnabled : 1
            );
        }

        const sql = `
        INSERT INTO menu_items
        (title, description, price, net_price, tax_id, category, tenant_id, is_enabled)
        VALUES ${placeholders};
        `;

        const [result] = await conn.query(sql, values);
        return { insertedCount: result.affectedRows };
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Find a category by name (case-insensitive) for a given tenant.
 * @param {string} name
 * @param {number} tenantId
 * @returns {Promise<{id: number, title: string}|null>}
 */
exports.findCategoryByNameDB = async (name, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const sql = `
        SELECT id, title FROM categories
        WHERE LOWER(title) = LOWER(?) AND tenant_id = ?
        LIMIT 1;
        `;
        const [result] = await conn.query(sql, [name.trim(), tenantId]);
        return result.length > 0 ? result[0] : null;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Find a tax by name (case-insensitive) for a given tenant.
 * @param {string} name
 * @param {number} tenantId
 * @returns {Promise<{id: number, title: string, rate: number, type: string}|null>}
 */
exports.findTaxByNameDB = async (name, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const sql = `
        SELECT id, title, rate, type FROM taxes
        WHERE LOWER(title) = LOWER(?) AND tenant_id = ?
        LIMIT 1;
        `;
        const [result] = await conn.query(sql, [name.trim(), tenantId]);
        return result.length > 0 ? result[0] : null;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Get all menu items with category and tax titles for export.
 * @param {number} tenantId
 * @returns {Promise<Array>}
 */
exports.getMenuItemsForExportDB = async (tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const sql = `
        SELECT
            i.title,
            i.description,
            i.price,
            i.net_price,
            c.title AS category_title,
            t.title AS tax_title,
            CASE WHEN i.is_enabled = 1 THEN 'enabled' ELSE 'disabled' END AS status
        FROM menu_items i
        LEFT JOIN categories c ON i.category = c.id
        LEFT JOIN taxes t ON i.tax_id = t.id
        WHERE i.tenant_id = ?
        ORDER BY i.id ASC;
        `;
        const [result] = await conn.query(sql, [tenantId]);
        return result;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};
