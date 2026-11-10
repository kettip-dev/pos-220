/**
 * Script to create Mike's Burger House - Cambodia tenant
 */
const path = require('path');

let getMySqlPromiseConnection, invalidateTenantCatalog;

// Try local relative to src or root
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

async function createMikesTenant() {
    const conn = await getMySqlPromiseConnection();
    try {
        await conn.beginTransaction();

        const tenantName = "Mike's Burger House - Cambodia";
        const logoUrl = "https://files.durianx.com/data-file/store/logo-30d2b0ca0c36f5ea.jpg";
        const adminEmail = "mikes@burgerhouse.com";
        const adminName = "Mike's Burger House Admin";
        // Password hash for '123456'
        const passwordHash = "$2b$10$3Rue9jU5EGps6DiwyzhM1uSIAeCRyElDT9ppXU9iF3oF3UtwYdEZW";

        // Check if tenant already exists
        const [existing] = await conn.query('SELECT id, name FROM tenants WHERE name = ?', [tenantName]);
        let tenantId;

        if (existing.length > 0) {
            tenantId = existing[0].id;
            console.log(`Tenant already exists with ID: ${tenantId}. Updating details...`);
            await conn.query('UPDATE tenants SET is_active = 1 WHERE id = ?', [tenantId]);
        } else {
            const [tenantRes] = await conn.query(
                'INSERT INTO tenants (name, is_active, hasTrial, isTrialPlan) VALUES (?, 1, 0, 0)',
                [tenantName]
            );
            tenantId = tenantRes.insertId;
            console.log(`Created new Tenant: "${tenantName}" with ID: ${tenantId}`);
        }

        // Store Details
        await conn.query(`
            INSERT INTO store_details 
            (tenant_id, store_name, address, phone, email, currency, store_image, exchange_rate_usd_to_khr, pos_payment_mode, business_type, is_kitchen_enabled, is_qr_menu_enabled)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
            ON DUPLICATE KEY UPDATE
            store_name = VALUES(store_name),
            store_image = VALUES(store_image),
            currency = VALUES(currency),
            exchange_rate_usd_to_khr = VALUES(exchange_rate_usd_to_khr),
            pos_payment_mode = VALUES(pos_payment_mode),
            business_type = VALUES(business_type),
            is_kitchen_enabled = VALUES(is_kitchen_enabled)
        `, [
            tenantId,
            tenantName,
            'Street 271, Phnom Penh, Cambodia',
            '+855 12 345 678',
            adminEmail,
            'USD',
            logoUrl,
            4100,
            'flexible',
            'restaurant'
        ]);
        console.log(`Configured store_details with logo: ${logoUrl}`);

        // Admin User
        const [userExists] = await conn.query('SELECT username FROM users WHERE username = ?', [adminEmail]);
        if (userExists.length === 0) {
            await conn.query(`
                INSERT INTO users (username, password, name, phone, role, tenant_id, status)
                VALUES (?, ?, ?, ?, 'admin', ?, 'active')
            `, [adminEmail, passwordHash, adminName, '+855 12 345 678', tenantId]);
            console.log(`Created admin user: ${adminEmail} (Default Password: 123456)`);
        } else {
            await conn.query(`
                UPDATE users SET tenant_id = ?, role = 'admin', name = ? WHERE username = ?
            `, [tenantId, adminName, adminEmail]);
            console.log(`Updated user ${adminEmail} to tenant ${tenantId}`);
        }

        // Kitchen Stations
        const [existingStations] = await conn.query('SELECT id FROM kitchen_stations WHERE tenant_id = ?', [tenantId]);
        if (existingStations.length === 0) {
            await conn.query(`
                INSERT INTO kitchen_stations (tenant_id, name, color, icon, is_enabled, sort_order)
                VALUES 
                (?, 'Burger & Grill', '#ef4444', 'Flame', 1, 0),
                (?, 'Beverages & Shakes', '#06b6d4', 'CupSoda', 1, 1),
                (?, 'Kitchen Expeditor', '#f97316', 'Utensils', 1, 2)
            `, [tenantId, tenantId, tenantId]);
            console.log(`Created 3 Kitchen Stations for routing.`);
        }

        // Payment Types
        const [existingPayments] = await conn.query('SELECT id FROM payment_types WHERE tenant_id = ?', [tenantId]);
        if (existingPayments.length === 0) {
            await conn.query(`
                INSERT INTO payment_types (tenant_id, title, icon, is_cash, is_active)
                VALUES
                (?, 'Cash (USD / KHR)', 'cash', 1, 1),
                (?, 'KHQR / Bakong / ABA', 'reader', 0, 1),
                (?, 'Credit / Debit Card', 'credit_card', 0, 1)
            `, [tenantId, tenantId, tenantId]);
            console.log(`Created default Cambodian Payment Types.`);
        }

        // Dining Tables
        const [existingTables] = await conn.query('SELECT id FROM store_tables WHERE tenant_id = ?', [tenantId]);
        if (existingTables.length === 0) {
            for (let i = 1; i <= 8; i++) {
                await conn.query(`
                    INSERT INTO store_tables (table_title, floor, seating_capacity, tenant_id, shape)
                    VALUES (?, 'Ground Floor', 4, ?, 'square')
                `, [`Table ${i}`, tenantId]);
            }
            console.log(`Created 8 dining tables.`);
        }

        // POS Register
        const [existingRegisters] = await conn.query('SELECT id FROM registers WHERE tenant_id = ?', [tenantId]);
        if (existingRegisters.length === 0) {
            await conn.query(`
                INSERT INTO registers (tenant_id, name, is_active)
                VALUES (?, 'Main Counter POS', 1)
            `, [tenantId]);
            console.log(`Created Main Counter POS register.`);
        }

        await conn.commit();
        await invalidateTenantCatalog(tenantId);

        console.log(`\n==============================================`);
        console.log(` Tenant Created Successfully!`);
        console.log(` Tenant ID:   ${tenantId}`);
        console.log(` Name:        ${tenantName}`);
        console.log(` Store Logo:  ${logoUrl}`);
        console.log(` Admin User:  ${adminEmail}`);
        console.log(` Default Pwd: 123456`);
        console.log(` Currency:    USD (USD / KHR @ 4,100)`);
        console.log(`==============================================\n`);

        return tenantId;
    } catch (err) {
        await conn.rollback();
        console.error('Failed to create tenant:', err);
        throw err;
    } finally {
        conn.release();
    }
}

createMikesTenant().then(() => process.exit(0)).catch(() => process.exit(1));
