/**
 * Restro PRO - External Catalog Importer
 *
 * Reads an external restaurant catalog JSON file (e.g. catalog.json or catalog_partial.json)
 * and imports categories, menu items, variants, and addons into a target tenant.
 *
 * Usage:
 *   node scripts/import_catalog.js <tenant_id> [path_to_json]
 * Example:
 *   node scripts/import_catalog.js 736 ./catalog_partial.json
 */

const fs = require('fs');
const path = require('path');

let getMySqlPromiseConnection, invalidateTenantCatalog;

try {
    const dbPath = path.resolve(__dirname, '../src/config/mysql.db');
    const cachePath = path.resolve(__dirname, '../src/utils/cache.util');
    getMySqlPromiseConnection = require(dbPath).getMySqlPromiseConnection;
    invalidateTenantCatalog = require(cachePath).invalidateTenantCatalog;
} catch (e) {
    const dbPath = path.resolve(__dirname, '../restropro-saas-backend-main/src/config/mysql.db');
    const cachePath = path.resolve(__dirname, '../restropro-saas-backend-main/src/utils/cache.util');
    getMySqlPromiseConnection = require(dbPath).getMySqlPromiseConnection;
    invalidateTenantCatalog = require(cachePath).invalidateTenantCatalog;
}

function detectCategory(item) {
    const name = (item.name || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();

    if (name.includes('burger') || name.includes('hot dog') || name.includes('sloppy joe') || name.includes('wild hog')) {
        return 'Burgers & Dogs';
    }
    if (name.includes('taco') || name.includes('burrito') || name.includes('quesadilla') || name.includes('shawarma')) {
        return 'Tacos & Burritos';
    }
    if (name.includes('chicken') || name.includes('nugget') || name.includes('bird') || name.includes('steak') || name.includes('teriyaki')) {
        return 'Chicken & Mains';
    }
    if (name.includes('fries') || name.includes('coleslaw') || name.includes('rice') || name.includes('onion ring') || name.includes('sauce') || name.includes('salsa')) {
        return 'Sides & Appetizers';
    }
    if (name.includes('ice cream') || name.includes('float') || name.includes('frappe') || name.includes('pancake')) {
        return 'Desserts & Floats';
    }
    if (name.includes('juice') || name.includes('soda') || name.includes('coke') || name.includes('pepper') || name.includes('drink') || name.includes('beer')) {
        return 'Beverages';
    }

    if (item.category && typeof item.category === 'string') return item.category;
    if (item.categories && item.categories.length > 0 && item.categories[0].name) return item.categories[0].name;

    return 'Specialties';
}

function detectKitchenStation(categoryName, stations) {
    if (!stations || !stations.length) return null;
    const lower = categoryName.toLowerCase();
    
    // Stations: Burger & Grill, Beverages & Shakes, Kitchen Expeditor
    if (lower.includes('burger') || lower.includes('taco') || lower.includes('chicken') || lower.includes('side')) {
        const grill = stations.find(s => s.name.toLowerCase().includes('grill') || s.name.toLowerCase().includes('burger'));
        if (grill) return grill.id;
    }
    if (lower.includes('beverage') || lower.includes('dessert') || lower.includes('float') || lower.includes('drink')) {
        const bar = stations.find(s => s.name.toLowerCase().includes('bev') || s.name.toLowerCase().includes('shake') || s.name.toLowerCase().includes('bar'));
        if (bar) return bar.id;
    }
    return stations[0].id;
}

async function importCatalog(tenantId, jsonFilePath) {
    if (!tenantId) {
        console.error('Error: Tenant ID is required. Example: node scripts/import_catalog.js 736 ./catalog.json');
        process.exit(1);
    }

    const resolvedPath = path.resolve(jsonFilePath || './catalog_partial.json');
    if (!fs.existsSync(resolvedPath)) {
        console.error(`Error: Catalog file not found at ${resolvedPath}`);
        process.exit(1);
    }

    const rawData = fs.readFileSync(resolvedPath, 'utf8');
    let data;
    try {
        data = JSON.parse(rawData);
    } catch (e) {
        console.error('Error: Failed to parse JSON file:', e.message);
        process.exit(1);
    }

    const items = data.data?.items || data.items || (Array.isArray(data) ? data : []);
    if (!items.length) {
        console.error('Error: No items found in JSON file.');
        process.exit(1);
    }

    console.log(`Starting import for Tenant ID: ${tenantId}`);
    console.log(`Total items to process: ${items.length}`);

    const conn = await getMySqlPromiseConnection();

    try {
        // Verify tenant exists
        const [tenants] = await conn.query('SELECT id, name FROM tenants WHERE id = ?', [tenantId]);
        if (!tenants.length) {
            console.error(`Tenant with ID ${tenantId} does not exist.`);
            process.exit(1);
        }
        console.log(`Target Tenant: [ID: ${tenants[0].id}] ${tenants[0].name}`);

        // Fetch Kitchen Stations for tenant
        const [stations] = await conn.query('SELECT id, name FROM kitchen_stations WHERE tenant_id = ?', [tenantId]);

        // Category cache for this tenant
        const [existingCategories] = await conn.query('SELECT id, title FROM categories WHERE tenant_id = ?', [tenantId]);
        const categoryMap = new Map();
        for (const cat of existingCategories) {
            categoryMap.set(cat.title.trim().toLowerCase(), cat.id);
        }

        // Helper to get or create category
        async function getOrCreateCategory(categoryName) {
            const name = (categoryName || 'General').trim();
            const lowerName = name.toLowerCase();
            if (categoryMap.has(lowerName)) {
                return categoryMap.get(lowerName);
            }

            const stationId = detectKitchenStation(name, stations);

            const [catResult] = await conn.query(
                'INSERT INTO categories (title, tenant_id, is_enabled, kitchen_station_id) VALUES (?, ?, 1, ?)',
                [name, tenantId, stationId]
            );
            const newCatId = catResult.insertId;
            categoryMap.set(lowerName, newCatId);
            console.log(`Created new category: "${name}" (ID: ${newCatId}) assigned to station ID: ${stationId}`);
            return newCatId;
        }

        let itemsImported = 0;
        let variantsImported = 0;
        let addonsImported = 0;

        for (const item of items) {
            const categoryName = detectCategory(item);
            const categoryId = await getOrCreateCategory(categoryName);
            const stationId = detectKitchenStation(categoryName, stations);

            const title = (item.name || 'Untitled Item').trim();
            const description = item.description || null;
            const price = parseFloat(item.sellingPrice ?? item.price ?? 0) || 0;
            const netPrice = parseFloat(item.receivablePrice ?? item.price ?? 0) || price;
            const isEnabled = item.status !== false ? 1 : 0;
            const image = item.image || null;

            // Check if item already exists in this tenant
            const [existingItem] = await conn.query(
                'SELECT id FROM menu_items WHERE title = ? AND tenant_id = ? LIMIT 1',
                [title, tenantId]
            );

            let menuItemId;
            if (existingItem.length > 0) {
                menuItemId = existingItem[0].id;
                await conn.query(`
                    UPDATE menu_items SET
                    price = ?, net_price = ?, category = ?, is_enabled = ?, image = ?, description = ?, kitchen_station_id = ?
                    WHERE id = ? AND tenant_id = ?
                `, [price, netPrice, categoryId, isEnabled, image, description, stationId, menuItemId, tenantId]);
                // Clear old variants & addons to re-import cleanly
                await conn.query('DELETE FROM menu_item_variants WHERE item_id = ? AND tenant_id = ?', [menuItemId, tenantId]);
                await conn.query('DELETE FROM menu_item_addons WHERE item_id = ? AND tenant_id = ?', [menuItemId, tenantId]);
            } else {
                // Insert menu item
                const [itemResult] = await conn.query(`
                    INSERT INTO menu_items
                    (title, description, price, net_price, category, tenant_id, is_enabled, image, kitchen_station_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [title, description, price, netPrice, categoryId, tenantId, isEnabled, image, stationId]);

                menuItemId = itemResult.insertId;
            }

            itemsImported++;

            // Process foodVariations (Variants)
            if (Array.isArray(item.foodVariations) && item.foodVariations.length > 0) {
                for (const variationGroup of item.foodVariations) {
                    if (Array.isArray(variationGroup.variationCategory)) {
                        for (const option of variationGroup.variationCategory) {
                            const variantTitle = `${variationGroup.name && variationGroup.name !== 'Options' ? variationGroup.name + ' - ' : ''}${option.name || 'Option'}`.trim();
                            const variantPrice = parseFloat(option.unitPrice ?? option.price ?? 0) || 0;

                            await conn.query(`
                                INSERT INTO menu_item_variants (item_id, title, price, tenant_id)
                                VALUES (?, ?, ?, ?)
                            `, [menuItemId, variantTitle, variantPrice, tenantId]);
                            variantsImported++;
                        }
                    }
                }
            }

            // Process optionGroups (options mapped to variants or addons)
            if (Array.isArray(item.optionGroups) && item.optionGroups.length > 0) {
                for (const optGroup of item.optionGroups) {
                    if (Array.isArray(optGroup.variationCategory)) {
                        for (const option of optGroup.variationCategory) {
                            const optTitle = `${optGroup.name && optGroup.name !== 'Options' ? optGroup.name + ' - ' : ''}${option.name || 'Option'}`.trim();
                            const optPrice = parseFloat(option.unitPrice ?? option.price ?? 0) || 0;

                            if (optGroup.type === 'single') {
                                await conn.query(`
                                    INSERT INTO menu_item_variants (item_id, title, price, tenant_id)
                                    VALUES (?, ?, ?, ?)
                                `, [menuItemId, optTitle, optPrice, tenantId]);
                                variantsImported++;
                            } else {
                                await conn.query(`
                                    INSERT INTO menu_item_addons (item_id, title, price, tenant_id)
                                    VALUES (?, ?, ?, ?)
                                `, [menuItemId, optTitle, optPrice, tenantId]);
                                addonsImported++;
                            }
                        }
                    }
                }
            }

            // Process addOns
            if (Array.isArray(item.addOns) && item.addOns.length > 0) {
                for (const addon of item.addOns) {
                    const addonTitle = (addon.name || 'Addon').trim();
                    const addonPrice = parseFloat(addon.price ?? 0) || 0;

                    await conn.query(`
                        INSERT INTO menu_item_addons (item_id, title, price, tenant_id)
                        VALUES (?, ?, ?, ?)
                    `, [menuItemId, addonTitle, addonPrice, tenantId]);
                    addonsImported++;
                }
            }
        }

        // Invalidate Redis cache for this tenant
        try {
            await invalidateTenantCatalog(tenantId);
        } catch (cacheErr) {
            console.warn('Cache invalidation notice:', cacheErr.message);
        }

        console.log(`\n========================================`);
        console.log(` Import Completed Successfully!`);
        console.log(` Tenant:              ${tenants[0].name} (ID: ${tenantId})`);
        console.log(` Menu Items Processed: ${itemsImported}`);
        console.log(` Variants Imported:    ${variantsImported}`);
        console.log(` Add-ons Imported:     ${addonsImported}`);
        console.log(`========================================\n`);

    } catch (err) {
        console.error('Import failed with error:', err);
    } finally {
        conn.release();
        process.exit(0);
    }
}

const args = process.argv.slice(2);
const tenantId = args[0] ? parseInt(args[0], 10) : 736;
const filePath = args[1] || './catalog_partial.json';

importCatalog(tenantId, filePath);
