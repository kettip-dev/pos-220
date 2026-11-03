const crypto = require("crypto");
const { CONFIG } = require("../config");
const { getMySqlPromiseConnection } = require("../config/mysql.db");
const {
    getOrSetCache,
    invalidateTenantSettings,
    invalidateTenantCatalog,
    invalidateQRCodeCache
} = require("../utils/cache.util");
const { resolveCustomerPhone } = require("../utils/phone");

function generateRandomPin(excludePin = null) {
    let pin = String(Math.floor(1000 + Math.random() * 9000));
    if (excludePin && pin === String(excludePin)) {
        pin = String(((Number(pin) - 1000 + 1) % 9000) + 1000);
    }
    return pin;
}

function generateTableSessionToken(tenantId, tableId, tablePin) {
    if (!tenantId || !tableId || !tablePin) return null;
    return crypto
        .createHmac("sha256", String(CONFIG.ENCRYPTION_KEY || "restro-qr-secret"))
        .update(`${tenantId}:${tableId}:${String(tablePin).trim()}`)
        .digest("hex")
        .slice(0, 32);
}

exports.generateRandomPin = generateRandomPin;
exports.generateTableSessionToken = generateTableSessionToken;

exports.getTenantIdFromQRCode = async (qrcode) => {
    if (!qrcode) return null;
    return getOrSetCache(`qr_code:${qrcode}`, 3600, async () => {
        const conn = await getMySqlPromiseConnection();
        try {

            const sql = `
            SELECT
                tenant_id
            FROM
                store_details
            WHERE
                unique_qr_code = ?
            LIMIT 1;
            `;

            const [result] = await conn.query(sql, [qrcode]);
            return result[0]?.tenant_id || null;
        } catch (error) {
            console.error(error);
            throw error;
        } finally {
            conn.release();
        }
    });
}

exports.getCurrencyDB = async (tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
        SELECT
            currency
        FROM
            store_details
        WHERE tenant_id = ?
        LIMIT 1;
        `;

        const [result] = await conn.query(sql, [tenantId]);
        return result[0]?.currency;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getStoreSettingDB = async (tenantId) => {
    return getOrSetCache(`tenant:${tenantId}:settings:store`, 3600, async () => {
        const conn = await getMySqlPromiseConnection();

        try {
            const sql = `
            SELECT tenant_id, store_image, store_name, address, phone, email, currency, exchange_rate_usd_to_khr, is_qr_menu_enabled, unique_qr_code, is_qr_order_enabled, is_qr_order_auto_kitchen, is_kitchen_enabled, is_feedback_enabled, pos_payment_mode, unique_id, business_type FROM store_details
            WHERE tenant_id = ?
            LIMIT 1;
            `;

            const [result] = await conn.query(sql, [tenantId]);

            return result[0];
        } catch (error) {
            console.error(error);
            throw error;
        } finally {
            conn.release();
        }
    });
};

exports.setStoreSettingDB = async (storeName, address, phone, email, currency, isQRMenuEnabled, isQROrderEnabled , uniqueQRCode, isFeedbackEnabled, tenantId, exchangeRateUsdToKhr = 4100, isQROrderAutoKitchen = false, posPaymentMode = 'flexible', isKitchenEnabled = true) => {
    const conn = await getMySqlPromiseConnection();

    const validModes = ['flexible', 'prepaid', 'postpaid'];
    const safeMode = validModes.includes(posPaymentMode) ? posPaymentMode : 'flexible';

    try {
        const sql = `
        INSERT INTO store_details ( store_name, address, phone, email, currency, is_qr_menu_enabled, is_qr_order_enabled, is_qr_order_auto_kitchen, unique_qr_code, is_feedback_enabled, tenant_id, exchange_rate_usd_to_khr, pos_payment_mode, is_kitchen_enabled)
        VALUES
        ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        store_name = VALUES(store_name),
        is_qr_menu_enabled = VALUES(is_qr_menu_enabled),
        address = VALUES(address),
        phone = VALUES(phone),
        email = VALUES(email),
        currency = VALUES(currency),
        tenant_id = VALUES(tenant_id),
        is_qr_order_enabled = VALUES(is_qr_order_enabled),
        is_qr_order_auto_kitchen = VALUES(is_qr_order_auto_kitchen),
        is_feedback_enabled = VALUES(is_feedback_enabled),
        exchange_rate_usd_to_khr = VALUES(exchange_rate_usd_to_khr),
        pos_payment_mode = VALUES(pos_payment_mode),
        is_kitchen_enabled = VALUES(is_kitchen_enabled);
        `;

        await conn.query(sql, [storeName, address, phone, email, currency, isQRMenuEnabled, isQROrderEnabled, isQROrderAutoKitchen ? 1 : 0, uniqueQRCode, isFeedbackEnabled, tenantId, Number(exchangeRateUsdToKhr) || 4100, safeMode, isKitchenEnabled ? 1 : 0]);

        await invalidateTenantSettings(tenantId);
        if (uniqueQRCode) {
            await invalidateQRCodeCache(uniqueQRCode);
        }

        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.uploadStoreImageDB = async (image, uniqueId, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const sql = `
        INSERT INTO store_details (tenant_id, store_image, unique_id)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
        tenant_id = VALUES(tenant_id),
        store_image = VALUES(store_image),
        unique_id = VALUES(unique_id);`

        await conn.query(sql, [tenantId, image, uniqueId]);
        await invalidateTenantSettings(tenantId);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.deleteStoreImageDB = async (image, uniqueId, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const sql = `
        UPDATE store_details SET
        store_image = ?
        WHERE unique_id = ? AND tenant_id = ?;`

        await conn.query(sql, [image, uniqueId, tenantId]);
        await invalidateTenantSettings(tenantId);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.updateServiceChargeDB = async (serviceCharge, tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        INSERT INTO store_details (tenant_id, service_charge)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE service_charge = VALUES(service_charge);
        `;

        await conn.query(sql, [tenantId, serviceCharge]);
        await invalidateTenantSettings(tenantId);
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getServiceChargeDB = async (tenantId) => {
    return getOrSetCache(`tenant:${tenantId}:settings:service_charge`, 3600, async () => {
        const conn = await getMySqlPromiseConnection();

        try {
            const sql = `
            SELECT service_charge FROM store_details where tenant_id = ?
            `;

            const [result] = await conn.query(sql, [tenantId]);
            return result[0]?.service_charge || null;
        } catch (error) {
            console.error(error);
            throw error;
        } finally {
            conn.release();
        }
    });
};

exports.getQRMenuCodeDB = async (tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        SELECT unique_qr_code FROM store_details
        WHERE tenant_id = ?
        LIMIT 1;
        `;

        const [result] = await conn.query(sql, [tenantId]);
        return result[0]?.unique_qr_code || null;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.updateQRMenuCodeDB = async (uniqueQRCode, tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        UPDATE store_details SET unique_qr_code = ?
        WHERE tenant_id = ?;
        `;

        await conn.query(sql, [uniqueQRCode, tenantId]);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getPrintSettingDB = async (tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        SELECT page_format, header, footer, show_notes, is_enable_print, show_store_details, show_customer_details, print_token, print_mode, auto_cut, cash_drawer_kick FROM print_settings
        WHERE tenant_id = ?
        LIMIT 1;
        `;

        const [result] = await conn.query(sql, [tenantId]);
        return result[0];
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.setPrintSettingDB = async (pageFormat, header, footer, showNotes, isEnablePrint, showStoreDetails, showCustomerDetails, printToken, printMode, autoCut, cashDrawerKick, tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        INSERT INTO print_settings
        ( page_format, header, footer, show_notes, is_enable_print, show_store_details, show_customer_details, print_token, print_mode, auto_cut, cash_drawer_kick, tenant_id)
        VALUES
        ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        page_format = VALUES(page_format),
        header = VALUES(header),
        footer = VALUES(footer),
        show_notes = VALUES(show_notes),
        is_enable_print = VALUES(is_enable_print),
        show_store_details = VALUES(show_store_details),
        show_customer_details = VALUES(show_customer_details),
        print_token = VALUES(print_token),
        print_mode = VALUES(print_mode),
        auto_cut = VALUES(auto_cut),
        cash_drawer_kick = VALUES(cash_drawer_kick),
        tenant_id = VALUES(tenant_id);
        `;

        await conn.query(sql, [
            pageFormat,
            header,
            footer,
            showNotes,
            isEnablePrint,
            showStoreDetails,
            showCustomerDetails,
            printToken,
            printMode || 'browser',
            autoCut !== undefined ? (autoCut ? 1 : 0) : 1,
            cashDrawerKick !== undefined ? (cashDrawerKick ? 1 : 0) : 1,
            tenantId
        ]);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.addTaxDB = async (title, rate, type, tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        INSERT INTO taxes
        (title, rate, type, tenant_id)
        VALUES (?, ?, ?, ?);
        `;

        const [result] = await conn.query(sql, [title, rate, type, tenantId]);
        return result.insertId;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getTaxesDB = async (tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        SELECT id, title, rate, type FROM taxes WHERE tenant_id = ?;
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

exports.getTaxDB = async (taxId, tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        SELECT id, title, rate, type FROM taxes
        WHERE id = ? AND tenant_id = ?
        LIMIT 1;
        `;

        const [result] = await conn.query(sql, [taxId, tenantId]);
        return result[0];
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.deleteTaxDB = async (id, tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        DELETE FROM taxes WHERE id = ? AND tenant_id = ?;
        `;

        await conn.query(sql, [id, tenantId]);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.updateTaxDB = async (id, title, rate, type, tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        UPDATE taxes
        SET
        title = ?, rate = ?, type = ?
        WHERE id = ? AND tenant_id = ?
        `;

        await conn.query(sql, [title, rate, type, id, tenantId]);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};


exports.addPaymentTypeDB = async (title, isActive, tenantId, icon) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        INSERT INTO payment_types
        (title, is_active, tenant_id, icon)
        VALUES (?, ?, ?, ?);
        `;

        const [result] = await conn.query(sql, [title, isActive, tenantId, icon]);
        return result.insertId;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getPaymentTypesDB = async (activeOnly=false, tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        let sql = `
        SELECT id, title, is_active, icon, is_cash FROM payment_types
        WHERE tenant_id = ?;
        `;

        if(activeOnly) {
            sql = `
            SELECT id, title, is_active, icon, is_cash FROM payment_types
            WHERE is_active = 1 AND tenant_id = ?;
            `
        }

        const [result] = await conn.query(sql, [tenantId]);
        return result;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.updatePaymentTypeDB = async (id, title, isActive, tenantId, icon) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        UPDATE payment_types
        SET title = ?, is_active = ?, icon = ?
        WHERE id = ? AND tenant_id = ?;
        `;

        const [result] = await conn.query(sql, [title, isActive, icon, id, tenantId]);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.togglePaymentTypeDB = async (id, isActive, tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        UPDATE payment_types
        SET is_active = ?
        WHERE id = ? AND tenant_id = ?;
        `;

        const [result] = await conn.query(sql, [isActive, id, tenantId]);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.deletePaymentTypeDB = async (id, tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        DELETE FROM payment_types
        WHERE id = ? AND tenant_id = ?;
        `;

        await conn.query(sql, [id, tenantId]);
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.addStoreTableDB = async (title, floor, seatingCapacity, tenantId, shape = 'round', rotation = 0, posX = null, posY = null) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const tablePin = generateRandomPin();
        const sql = `
        INSERT INTO store_tables
        (table_title, floor, seating_capacity, tenant_id, shape, rotation, pos_x, pos_y, table_pin)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;

        const [result] = await conn.query(sql, [title, floor, seatingCapacity, tenantId, shape || 'round', rotation || 0, posX, posY, tablePin]);
        await invalidateTenantCatalog(tenantId);
        return result.insertId;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getStoreTablesDB = async (tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        SELECT
        id,
        HEX(AES_ENCRYPT(HEX(id), ?)) AS encrypted_id,
        table_title,
        floor,
        seating_capacity,
        pos_x,
        pos_y,
        shape,
        rotation,
        table_pin
        FROM store_tables
        WHERE tenant_id = ?;
        `;

        const [result] = await conn.query(sql, [CONFIG.ENCRYPTION_KEY, tenantId]);
        return result;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getPublicStoreTablesDB = async (tenantId) => {
    return getOrSetCache(`tenant:${tenantId}:catalog:tables:public`, 1800, async () => {
        const conn = await getMySqlPromiseConnection();

        try {
            const sql = `
            SELECT
            id,
            HEX(AES_ENCRYPT(HEX(id), ?)) AS encrypted_id,
            table_title,
            floor,
            seating_capacity
            FROM store_tables
            WHERE tenant_id = ?
            ORDER BY floor ASC, id ASC;
            `;

            const [result] = await conn.query(sql, [CONFIG.ENCRYPTION_KEY, tenantId]);
            return result;
        } catch (error) {
            console.error(error);
            throw error;
        } finally {
            conn.release();
        }
    });
};

exports.getStoreTablesWithLiveStatusDB = async (tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        SELECT
            st.id,
            HEX(AES_ENCRYPT(HEX(st.id), ?)) AS encrypted_id,
            st.table_title,
            st.floor,
            st.seating_capacity,
            st.pos_x,
            st.pos_y,
            st.shape,
            st.rotation,
            st.table_pin,
            o.id AS active_order_id,
            o.token_no AS active_order_token,
            o.date AS active_order_date,
            o.status AS active_order_status,
            o.payment_status AS active_payment_status,
            o.split_status AS active_split_status,
            COALESCE(
                (SELECT COUNT(*) FROM order_sub_invoices osi WHERE osi.order_id = o.id AND osi.tenant_id = st.tenant_id),
                0
            ) AS split_total_checks,
            COALESCE(
                (SELECT COUNT(*) FROM order_sub_invoices osi WHERE osi.order_id = o.id AND osi.tenant_id = st.tenant_id AND osi.payment_status = 'paid'),
                0
            ) AS split_paid_checks,
            COALESCE(
                (SELECT SUM(osi.payable_total) FROM order_sub_invoices osi WHERE osi.order_id = o.id AND osi.tenant_id = st.tenant_id AND osi.payment_status != 'paid'),
                0
            ) AS split_remaining_payable,
            c.name AS customer_name,
            c.phone AS customer_phone,
            COALESCE(
                (SELECT SUM(oi.price * oi.quantity) FROM order_items oi WHERE oi.order_id = o.id AND oi.status NOT IN ('cancelled')),
                0
            ) AS order_total,
            COALESCE(
                (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id AND oi.status NOT IN ('cancelled')),
                0
            ) AS order_items_count,
            COALESCE(
                (SELECT COUNT(*) FROM qr_orders qo WHERE qo.table_id = st.id AND qo.tenant_id = st.tenant_id AND qo.status NOT IN ('completed', 'cancelled') AND EXISTS (SELECT 1 FROM qr_order_items qoi WHERE qoi.order_id = qo.id AND qoi.tenant_id = qo.tenant_id)),
                0
            ) AS pending_qr_orders_count
        FROM store_tables st
        LEFT JOIN (
            SELECT o1.*
            FROM orders o1
            INNER JOIN (
                SELECT MAX(id) AS max_id, table_id
                FROM orders
                WHERE tenant_id = ? AND status NOT IN ('completed', 'cancelled') AND table_id IS NOT NULL
                GROUP BY table_id
            ) o_latest ON o1.id = o_latest.max_id
        ) o ON st.id = o.table_id
        LEFT JOIN customers c ON o.customer_id = c.phone AND c.tenant_id = st.tenant_id
        WHERE st.tenant_id = ?
        ORDER BY st.id ASC;
        `;

        const [tables] = await conn.query(sql, [CONFIG.ENCRYPTION_KEY, tenantId, tenantId]);

        const [layouts] = await conn.query(
            `SELECT floor, show_cashier, cashier_x, cashier_y, cashier_w, cashier_h, floor_plan_image, floor_plan_opacity, floor_plan_fit, walls, cashier_rotation, merged_pairs FROM store_floor_layouts WHERE tenant_id = ?`,
            [tenantId]
        );

        const parsedLayouts = layouts.map((l) => {
            let parsedWalls = null;
            if (l.walls) {
                try {
                    parsedWalls = typeof l.walls === "string" ? JSON.parse(l.walls) : l.walls;
                } catch {
                    parsedWalls = null;
                }
            }
            let parsedMergedPairs = [];
            if (l.merged_pairs) {
                try {
                    parsedMergedPairs = typeof l.merged_pairs === "string" ? JSON.parse(l.merged_pairs) : l.merged_pairs;
                } catch {
                    parsedMergedPairs = [];
                }
            }
            return {
                ...l,
                walls: parsedWalls,
                merged_pairs: Array.isArray(parsedMergedPairs) ? parsedMergedPairs : [],
            };
        });

        // Decorate tables with linked table information and shared master active orders
        const tablesWithMergeInfo = tables.map((t) => ({ ...t }));
        for (const layout of parsedLayouts) {
            if (!layout.merged_pairs || !layout.merged_pairs.length) continue;
            for (const [masterId, secondaryId] of layout.merged_pairs) {
                const master = tablesWithMergeInfo.find((t) => String(t.id) === String(masterId));
                const secondary = tablesWithMergeInfo.find((t) => String(t.id) === String(secondaryId));
                if (master && secondary) {
                    master.is_linked_master = true;
                    master.linked_table_id = secondary.id;
                    master.linked_table_title = secondary.table_title;

                    secondary.is_linked_secondary = true;
                    secondary.linked_table_id = master.id;
                    secondary.linked_table_title = master.table_title;

                    // If master has an active order and secondary doesn't, secondary inherits master's active order info
                    if (master.active_order_id && !secondary.active_order_id) {
                        secondary.active_order_id = master.active_order_id;
                        secondary.active_order_token = master.active_order_token;
                        secondary.active_order_total = master.active_order_total;
                        secondary.active_order_date = master.active_order_date;
                        secondary.order_items_count = master.order_items_count;
                        secondary.active_order_status = master.active_order_status;
                        secondary.active_order_guests = master.active_order_guests;
                        secondary.customer_name = master.customer_name;
                        secondary.customer_phone = master.customer_phone;
                        secondary.active_split_status = master.active_split_status;
                        secondary.split_total_checks = master.split_total_checks;
                        secondary.split_paid_checks = master.split_paid_checks;
                        secondary.split_remaining_payable = master.split_remaining_payable;
                    }
                }
            }
        }

        return {
            tables: tablesWithMergeInfo,
            layouts: parsedLayouts
        };
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.saveTableLayoutPositionsDB = async (tenantId, floor, tables = [], floorSettings = null) => {
    const conn = await getMySqlPromiseConnection();

    try {
        await conn.beginTransaction();

        for (const tbl of tables) {
            if (tbl.id) {
                await conn.query(
                    `UPDATE store_tables 
                     SET pos_x = ?, pos_y = ?, shape = COALESCE(?, shape), rotation = COALESCE(?, rotation)
                     WHERE id = ? AND tenant_id = ?`,
                    [tbl.pos_x, tbl.pos_y, tbl.shape || null, tbl.rotation !== undefined ? tbl.rotation : null, tbl.id, tenantId]
                );
            }
        }

        if (floor && floorSettings) {
            const showCashier = floorSettings.show_cashier ? 1 : 0;
            const cashierX = floorSettings.cashier_x !== undefined ? floorSettings.cashier_x : 80;
            const cashierY = floorSettings.cashier_y !== undefined ? floorSettings.cashier_y : 300;
            const cashierW = floorSettings.cashier_w !== undefined ? floorSettings.cashier_w : 90;
            const cashierH = floorSettings.cashier_h !== undefined ? floorSettings.cashier_h : 200;
            const cashierRotation = floorSettings.cashier_rotation !== undefined ? Number(floorSettings.cashier_rotation) : 0;
            const floorPlanImage = floorSettings.floor_plan_image !== undefined ? floorSettings.floor_plan_image : null;
            const floorPlanOpacity = floorSettings.floor_plan_opacity !== undefined ? floorSettings.floor_plan_opacity : 0.8;
            const floorPlanFit = floorSettings.floor_plan_fit || 'contain';
            const walls = floorSettings.walls !== undefined && floorSettings.walls !== null
                ? (typeof floorSettings.walls === "string" ? floorSettings.walls : JSON.stringify(floorSettings.walls))
                : null;
            const mergedPairs = floorSettings.merged_pairs !== undefined && floorSettings.merged_pairs !== null
                ? (typeof floorSettings.merged_pairs === "string" ? floorSettings.merged_pairs : JSON.stringify(floorSettings.merged_pairs))
                : null;

            await conn.query(
                `INSERT INTO store_floor_layouts (tenant_id, floor, show_cashier, cashier_x, cashier_y, cashier_w, cashier_h, cashier_rotation, floor_plan_image, floor_plan_opacity, floor_plan_fit, walls, merged_pairs)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                    show_cashier = VALUES(show_cashier),
                    cashier_x = VALUES(cashier_x),
                    cashier_y = VALUES(cashier_y),
                    cashier_w = VALUES(cashier_w),
                    cashier_h = VALUES(cashier_h),
                    cashier_rotation = VALUES(cashier_rotation),
                    floor_plan_image = VALUES(floor_plan_image),
                    floor_plan_opacity = VALUES(floor_plan_opacity),
                    floor_plan_fit = VALUES(floor_plan_fit),
                    walls = VALUES(walls),
                    merged_pairs = COALESCE(VALUES(merged_pairs), merged_pairs)`,
                [tenantId, floor, showCashier, cashierX, cashierY, cashierW, cashierH, cashierRotation, floorPlanImage, floorPlanOpacity, floorPlanFit, walls, mergedPairs]
            );
        }

        await conn.commit();
        return true;
    } catch (error) {
        await conn.rollback();
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.uploadFloorPlanImageDB = async (tenantId, floor, imageURL) => {
    const conn = await getMySqlPromiseConnection();
    try {
        await conn.query(
            `INSERT INTO store_floor_layouts (tenant_id, floor, floor_plan_image)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE floor_plan_image = VALUES(floor_plan_image)`,
            [tenantId, floor, imageURL]
        );
        return true;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.deleteFloorPlanImageDB = async (tenantId, floor) => {
    const conn = await getMySqlPromiseConnection();
    try {
        await conn.query(
            `UPDATE store_floor_layouts SET floor_plan_image = NULL WHERE tenant_id = ? AND floor = ?`,
            [tenantId, floor]
        );
        return true;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getStoreTableByEncryptedIdDB = async (tenantId, encryptedTableId) => {
    if (!encryptedTableId || encryptedTableId === "null" || encryptedTableId === "undefined") {
        return null;
    }
    const conn = await getMySqlPromiseConnection();

    try {
        // Support either encrypted hex ID or numeric table ID scoped to tenant
        const isNumericId = /^\d+$/.test(String(encryptedTableId).trim());
        const sql = isNumericId
            ? `
            SELECT
                id,
                HEX(AES_ENCRYPT(HEX(id), ?)) AS encrypted_id,
                table_title,
                floor,
                seating_capacity
            FROM store_tables
            WHERE tenant_id = ? AND id = ?
            LIMIT 1;
            `
            : `
            SELECT
                id,
                HEX(AES_ENCRYPT(HEX(id), ?)) AS encrypted_id,
                table_title,
                floor,
                seating_capacity
            FROM store_tables
            WHERE tenant_id = ? AND AES_DECRYPT(UNHEX(?), ?) = HEX(id)
            LIMIT 1;
            `;

        const params = isNumericId
            ? [CONFIG.ENCRYPTION_KEY, tenantId, Number(encryptedTableId)]
            : [CONFIG.ENCRYPTION_KEY, tenantId, encryptedTableId, CONFIG.ENCRYPTION_KEY];

        const [result] = await conn.query(sql, params);

        return result[0] || null;
    } catch (error) {
        console.error(error);
        return null;
    } finally {
        conn.release();
    }
};

exports.verifyTablePinOrTokenDB = async (tenantId, tableIdOrEncrypted, pinOrToken) => {
    if (!tenantId || !tableIdOrEncrypted) {
        return { valid: false, table: null, sessionToken: null };
    }
    const conn = await getMySqlPromiseConnection();
    try {
        const rawRef = String(tableIdOrEncrypted).trim();
        const isNumericId = /^\d+$/.test(rawRef);

        const sql = isNumericId
            ? `SELECT id, HEX(AES_ENCRYPT(HEX(id), ?)) AS encrypted_id, table_title, floor, seating_capacity, table_pin FROM store_tables WHERE tenant_id = ? AND id = ? LIMIT 1`
            : `SELECT id, HEX(AES_ENCRYPT(HEX(id), ?)) AS encrypted_id, table_title, floor, seating_capacity, table_pin FROM store_tables WHERE tenant_id = ? AND AES_DECRYPT(UNHEX(?), ?) = HEX(id) LIMIT 1`;

        const params = isNumericId
            ? [CONFIG.ENCRYPTION_KEY, tenantId, Number(rawRef)]
            : [CONFIG.ENCRYPTION_KEY, tenantId, rawRef, CONFIG.ENCRYPTION_KEY];

        const [rows] = await conn.query(sql, params);
        const table = rows[0] || null;
        if (!table) {
            return { valid: false, table: null, sessionToken: null };
        }

        let currentPin = table.table_pin ? String(table.table_pin).trim() : "";
        if (!currentPin) {
            currentPin = generateRandomPin();
            await conn.query(`UPDATE store_tables SET table_pin = ? WHERE id = ? AND tenant_id = ?`, [currentPin, table.id, tenantId]);
        }

        const expectedToken = generateTableSessionToken(tenantId, table.id, currentPin);
        const candidate = pinOrToken ? String(pinOrToken).trim() : "";

        const isValid = Boolean(candidate) && (candidate === currentPin || candidate === expectedToken);

        const publicTable = {
            id: table.id,
            encrypted_id: table.encrypted_id,
            table_title: table.table_title,
            floor: table.floor,
            seating_capacity: table.seating_capacity,
        };

        return {
            valid: isValid,
            table: publicTable,
            sessionToken: isValid ? expectedToken : null,
        };
    } catch (error) {
        console.error("verifyTablePinOrTokenDB error:", error);
        return { valid: false, table: null, sessionToken: null };
    } finally {
        conn.release();
    }
};

exports.rotateTablePinDB = async (tenantId, tableId) => {
    const conn = await getMySqlPromiseConnection();
    try {
        const [rows] = await conn.query(
            `SELECT id, table_pin FROM store_tables WHERE id = ? AND tenant_id = ? LIMIT 1`,
            [tableId, tenantId]
        );
        if (!rows.length) return null;

        const newPin = generateRandomPin(rows[0].table_pin);
        await conn.query(
            `UPDATE store_tables SET table_pin = ? WHERE id = ? AND tenant_id = ?`,
            [newPin, tableId, tenantId]
        );
        return {
            table_id: Number(tableId),
            table_pin: newPin,
        };
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.rotateTablePinsByOrderIdsDB = async (tenantId, orderIds = []) => {
    if (!orderIds || !orderIds.length) return;
    const conn = await getMySqlPromiseConnection();
    try {
        const safeOrderIds = orderIds.map(Number).filter(Boolean);
        if (!safeOrderIds.length) return;
        const [rows] = await conn.query(
            `SELECT DISTINCT table_id FROM orders WHERE id IN (?) AND tenant_id = ? AND table_id IS NOT NULL`,
            [safeOrderIds, tenantId]
        );
        for (const r of rows) {
            if (r.table_id) {
                const [[activeCheck]] = await conn.query(
                    `SELECT COUNT(*) AS cnt FROM orders WHERE table_id = ? AND tenant_id = ? AND status NOT IN ('completed', 'cancelled')`,
                    [r.table_id, tenantId]
                );
                if (!activeCheck || Number(activeCheck.cnt) === 0) {
                    const newPin = generateRandomPin();
                    await conn.query(
                        `UPDATE store_tables SET table_pin = ? WHERE id = ? AND tenant_id = ?`,
                        [newPin, r.table_id, tenantId]
                    );
                }
            }
        }
    } catch (error) {
        console.error("rotateTablePinsByOrderIdsDB error:", error);
    } finally {
        conn.release();
    }
};

exports.updateStoreTableDB = async (id, title, floor, seatingCapacity, tenantId, shape = null, rotation = null, posX = null, posY = null) => {
    const conn = await getMySqlPromiseConnection();

    try {
        let sql = `UPDATE store_tables SET table_title = ?, floor = ?, seating_capacity = ?`;
        const params = [title, floor, seatingCapacity];

        if (shape !== null) {
            sql += `, shape = ?`;
            params.push(shape);
        }
        if (rotation !== null) {
            sql += `, rotation = ?`;
            params.push(rotation);
        }
        if (posX !== null) {
            sql += `, pos_x = ?`;
            params.push(posX);
        }
        if (posY !== null) {
            sql += `, pos_y = ?`;
            params.push(posY);
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
};


exports.deleteStoreTableDB = async (id, tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        DELETE FROM store_tables
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
};

exports.addCategoryDB = async (title, tenantId, kitchenStationId = null) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        INSERT INTO categories
        (title, tenant_id, kitchen_station_id)
        VALUES (?, ?, ?);
        `;

        const [result] = await conn.query(sql, [title, tenantId, kitchenStationId ? Number(kitchenStationId) : null]);
        await invalidateTenantCatalog(tenantId);
        return result.insertId;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getCategoriesDB = async (tenantId) => {
    return getOrSetCache(`tenant:${tenantId}:catalog:categories:all`, 1800, async () => {
        const conn = await getMySqlPromiseConnection();

        try {
            const sql = `
            SELECT 
              c.id, 
              c.title, 
              c.is_enabled, 
              c.kitchen_station_id,
              ks.name AS kitchen_station_name,
              ks.color AS kitchen_station_color
            FROM categories c
            LEFT JOIN kitchen_stations ks ON c.kitchen_station_id = ks.id AND ks.tenant_id = c.tenant_id
            WHERE c.tenant_id = ?;
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

exports.updateCategoryDB = async (id, title, tenantId, kitchenStationId = undefined) => {
    const conn = await getMySqlPromiseConnection();

    try {
        let sql = `
        UPDATE categories
        SET title = ?
        `;
        const params = [title];

        if (kitchenStationId !== undefined) {
            sql += `, kitchen_station_id = ?`;
            params.push(kitchenStationId ? Number(kitchenStationId) : null);
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
};

exports.deleteCategoryDB = async (id, tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        DELETE FROM categories
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
};

exports.changeCategoryVisibiltyDB = async (id, isEnabled, tenantId) => {
    const conn = await getMySqlPromiseConnection();
    try {

        const sql = `
         UPDATE categories SET
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

exports.placeOrderViaQrMenuDB = async (tenantId, deliveryType, cartItems, customerType, customerId, tableId, customerName, paymentStatus = 'pending') => {
    const conn = await getMySqlPromiseConnection();

    try {
      if (!Array.isArray(cartItems) || cartItems.length === 0) {
        const err = new Error("Cart is empty");
        err.statusCode = 400;
        throw err;
      }
      if (cartItems.length > 50) {
        const err = new Error("Too many items in a single order");
        err.statusCode = 400;
        throw err;
      }

      const itemIds = [...new Set(cartItems.map((i) => Number(i.id)).filter(Boolean))];
      if (itemIds.length === 0) {
        const err = new Error("Invalid items in cart");
        err.statusCode = 400;
        throw err;
      }

      // Server-side catalog lookup scoped strictly to tenantId
      const [menuRows] = await conn.query(
        `SELECT id, title, price, is_enabled FROM menu_items WHERE tenant_id = ? AND id IN (?)`,
        [tenantId, itemIds]
      );
      const [variantRows] = await conn.query(
        `SELECT id, item_id, title, price FROM menu_item_variants WHERE tenant_id = ? AND item_id IN (?)`,
        [tenantId, itemIds]
      );
      const [addonRows] = await conn.query(
        `SELECT id, item_id, title, price FROM menu_item_addons WHERE tenant_id = ? AND item_id IN (?)`,
        [tenantId, itemIds]
      );

      const menuMap = new Map(menuRows.map((m) => [Number(m.id), m]));

      const verifiedCartItems = cartItems.map((rawItem) => {
        const itemId = Number(rawItem.id);
        const menuItem = menuMap.get(itemId);
        if (!menuItem || Number(menuItem.is_enabled) === 0) {
          const err = new Error(`Menu item unavailable: ${rawItem.title || itemId}`);
          err.statusCode = 400;
          throw err;
        }

        let unitPrice = parseFloat(menuItem.price) || 0;
        let validVariantId = null;

        if (rawItem.variant_id) {
          const matchedVariant = variantRows.find(
            (v) => Number(v.item_id) === itemId && Number(v.id) === Number(rawItem.variant_id)
          );
          if (!matchedVariant) {
            const err = new Error(`Invalid variant selected for ${menuItem.title}`);
            err.statusCode = 400;
            throw err;
          }
          validVariantId = Number(matchedVariant.id);
          unitPrice = parseFloat(matchedVariant.price) || 0;
        }

        const rawAddonIds = Array.isArray(rawItem.addons_ids)
          ? rawItem.addons_ids
          : Array.isArray(rawItem.addons)
          ? rawItem.addons.map((a) => (typeof a === "object" ? a.id : a))
          : [];

        const validAddonIds = [];
        for (const aId of rawAddonIds) {
          const matchedAddon = addonRows.find(
            (a) => Number(a.item_id) === itemId && Number(a.id) === Number(aId)
          );
          if (matchedAddon) {
            validAddonIds.push(Number(matchedAddon.id));
            unitPrice += parseFloat(matchedAddon.price) || 0;
          }
        }

        const safeQty = Math.min(Math.max(parseInt(rawItem.quantity, 10) || 1, 1), 50);
        const safeNotes = rawItem.notes ? String(rawItem.notes).trim().slice(0, 200) : null;

        return {
          id: itemId,
          variant_id: validVariantId,
          price: Number(unitPrice.toFixed(2)),
          quantity: safeQty,
          notes: safeNotes,
          addons_ids: validAddonIds,
        };
      });

      // start transaction
      await conn.beginTransaction();

      // Typed number → the existing customer's stored phone, or its normalised form
      if (customerId) {
        customerId = await resolveCustomerPhone(conn, customerId, tenantId);
      }

      // step 1: save data to qr_orders table
      const [orderResult] = await conn.query(
        `INSERT INTO qr_orders (delivery_type, customer_type, customer_id, table_id, payment_status, tenant_id) VALUES (?, ?, ?, ?, ?, ?)`,
        [deliveryType, customerType, customerId, tableId, paymentStatus || 'pending', tenantId]
      );

      const orderId = orderResult.insertId;

      // step 2: save server-verified items to qr_order_items
      const sqlOrderItems = `
      INSERT INTO qr_order_items
      (order_id, item_id, variant_id, price, quantity, notes, addons, tenant_id)
      VALUES ?
      `;

      await conn.query(sqlOrderItems, [
        verifiedCartItems.map((item) => [
          orderId,
          item.id,
          item.variant_id,
          item.price,
          item.quantity,
          item.notes,
          item.addons_ids.length > 0 ? JSON.stringify(item.addons_ids) : null,
          tenantId,
        ]),
      ]);

      // Step 3: Search customer by phone in customer table - if not existing - create one
      if (customerId) {
        const [existingCustomer] = await conn.query(
          `SELECT 1 FROM customers WHERE phone = ? AND tenant_id = ?`,
          [customerId, tenantId]
        );

        if (!existingCustomer.length) {
          await conn.query(
            `INSERT INTO customers (phone, name, tenant_id) VALUES (?, ?, ?)`,
            [customerId, customerName || "Guest", tenantId]
          );
        }
      }

      await conn.commit();

      return {
        orderId,
        verifiedCartItems,
      };
    } catch (error) {
      console.error(error);
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
};

exports.getTableLiveQrSessionDB = async (tenantId, tableId, qrOrderId = null) => {
    const conn = await getMySqlPromiseConnection();
    try {
      // 1. Active kitchen orders on this table
      let kitchenOrders = [];
      let kitchenOrderItems = [];

      if (tableId) {
        const [kOrders] = await conn.query(
          `SELECT o.id, o.date, o.delivery_type, o.customer_type, o.customer_id, o.table_id, st.table_title, st.floor, o.status, o.payment_status, o.token_no
           FROM orders o
           LEFT JOIN store_tables st ON o.table_id = st.id
           WHERE o.tenant_id = ? AND o.table_id = ? AND o.status NOT IN ('completed', 'cancelled')
           ORDER BY o.id DESC`,
          [tenantId, tableId]
        );
        kitchenOrders = kOrders;
      }

      // 2. Pending or recent QR orders for this table (or specific qrOrderId)
      const qrWhereParts = ["qo.tenant_id = ?"];
      const qrParams = [tenantId];

      if (tableId && qrOrderId) {
        qrWhereParts.push("(qo.table_id = ? OR qo.id = ?)");
        qrParams.push(tableId, Number(qrOrderId));
      } else if (tableId) {
        qrWhereParts.push("qo.table_id = ?");
        qrParams.push(tableId);
      } else if (qrOrderId) {
        qrWhereParts.push("qo.id = ?");
        qrParams.push(Number(qrOrderId));
      } else {
        return { kitchenOrders: [], pendingQrOrders: [] };
      }

      const [qrOrdersRows] = await conn.query(
        `SELECT qo.id, qo.date, qo.delivery_type, qo.customer_type, qo.customer_id, qo.table_id, st.table_title, st.floor, qo.status, qo.payment_status, qo.linked_order_id
         FROM qr_orders qo
         LEFT JOIN store_tables st ON qo.table_id = st.id
         WHERE ${qrWhereParts.join(" AND ")}
           AND qo.date >= DATE_SUB(NOW(), INTERVAL 6 HOUR)
         ORDER BY qo.id DESC`,
        qrParams
      );

      // If any qrOrder was linked to a kitchen order and kitchenOrders didn't include it yet (e.g. no tableId or just completed)
      const linkedOrderIds = qrOrdersRows
        .map((q) => Number(q.linked_order_id))
        .filter((id) => id && !kitchenOrders.some((ko) => Number(ko.id) === id));

      if (linkedOrderIds.length > 0) {
        const [extraKOrders] = await conn.query(
          `SELECT o.id, o.date, o.delivery_type, o.customer_type, o.customer_id, o.table_id, st.table_title, st.floor, o.status, o.payment_status, o.token_no
           FROM orders o
           LEFT JOIN store_tables st ON o.table_id = st.id
           WHERE o.tenant_id = ? AND o.id IN (?)`,
          [tenantId, linkedOrderIds]
        );
        kitchenOrders = [...kitchenOrders, ...extraKOrders];
      }

      // Fetch addons lookup for this tenant
      const [allAddons] = await conn.query(
        `SELECT id, item_id, title, price FROM menu_item_addons WHERE tenant_id = ?`,
        [tenantId]
      );
      const addonMap = new Map(allAddons.map((a) => [Number(a.id), a]));

      if (kitchenOrders.length > 0) {
        const kOrderIds = kitchenOrders.map((o) => o.id);
        const [kItems] = await conn.query(
          `SELECT oi.id, oi.order_id, oi.item_id, mi.title AS item_title, mi.image, mi.tax_id, t.title AS tax_title, t.rate AS tax_rate, t.type AS tax_type,
                  oi.variant_id, miv.title AS variant_title, oi.price, oi.quantity, oi.status, oi.date, oi.addons, oi.notes
           FROM order_items oi
           LEFT JOIN menu_items mi ON oi.item_id = mi.id
           LEFT JOIN taxes t ON mi.tax_id = t.id
           LEFT JOIN menu_item_variants miv ON oi.variant_id = miv.id
           WHERE oi.order_id IN (?) AND oi.tenant_id = ?`,
          [kOrderIds, tenantId]
        );
        kitchenOrderItems = kItems.map((item) => {
          let parsedAddons = [];
          try {
            const ids = item.addons ? JSON.parse(item.addons) : [];
            if (Array.isArray(ids)) {
              parsedAddons = ids.map((id) => addonMap.get(Number(id))).filter(Boolean);
            }
          } catch {}
          return { ...item, addons_list: parsedAddons };
        });
      }

      const pendingQrOrders = qrOrdersRows.filter((q) => q.status !== "completed" && q.status !== "cancelled");
      let pendingQrItems = [];
      if (pendingQrOrders.length > 0) {
        const pIds = pendingQrOrders.map((q) => q.id);
        const [pItems] = await conn.query(
          `SELECT qoi.id, qoi.order_id, qoi.item_id, mi.title AS item_title, mi.image, mi.tax_id, t.title AS tax_title, t.rate AS tax_rate, t.type AS tax_type,
                  qoi.variant_id, miv.title AS variant_title, qoi.price, qoi.quantity, qoi.status, qoi.date, qoi.addons, qoi.notes
           FROM qr_order_items qoi
           LEFT JOIN menu_items mi ON qoi.item_id = mi.id
           LEFT JOIN taxes t ON mi.tax_id = t.id
           LEFT JOIN menu_item_variants miv ON qoi.variant_id = miv.id
           WHERE qoi.order_id IN (?) AND qoi.tenant_id = ?`,
          [pIds, tenantId]
        );
        pendingQrItems = pItems.map((item) => {
          let parsedAddons = [];
          try {
            const ids = item.addons ? JSON.parse(item.addons) : [];
            if (Array.isArray(ids)) {
              parsedAddons = ids.map((id) => addonMap.get(Number(id))).filter(Boolean);
            }
          } catch {}
          return { ...item, addons_list: parsedAddons };
        });
      }

      const formattedKitchenOrders = kitchenOrders.map((ko) => ({
        ...ko,
        source: "kitchen",
        items: kitchenOrderItems.filter((i) => Number(i.order_id) === Number(ko.id)),
      }));

      const formattedPendingQrOrders = pendingQrOrders.map((qo) => ({
        ...qo,
        source: "qr_pending",
        items: pendingQrItems.filter((i) => Number(i.order_id) === Number(qo.id)),
      }));

      return {
        kitchenOrders: formattedKitchenOrders,
        pendingQrOrders: formattedPendingQrOrders,
        allQrOrders: qrOrdersRows,
      };
    } catch (error) {
      console.error("getTableLiveQrSessionDB error:", error);
      throw error;
    } finally {
      conn.release();
    }
};

exports.saveFeedbackDB = async (tenantId, invoiceId, customerId, phone, name, email, birthdate, averageRating, food_quality, service, ambiance, staff_behavior, recommend, remarks) => {
    const conn = await getMySqlPromiseConnection();

    try {
      // start transaction
      await conn.beginTransaction();

    // Typed number → the existing customer's stored phone, or its normalised form
    if (customerId) customerId = await resolveCustomerPhone(conn, customerId, tenantId);
    if (phone) phone = await resolveCustomerPhone(conn, phone, tenantId);

    const sqlIsExistingCustomer = `SELECT 1 from customers where phone = ? AND tenant_id = ?`

    const [existingCustomer] = await conn.query(sqlIsExistingCustomer , [customerId || phone, tenantId]);


    if (existingCustomer.length == 0) {
        const sqlAddCustomer = `
                INSERT INTO customers (phone, name, email, birth_date, tenant_id) VALUES (?, ?, ?, ?, ?)
        `;

        await conn.query(sqlAddCustomer, [phone, name, email || null, birthdate || null, tenantId]);
    }

    const uniqueCustomerId = customerId || phone || null;

    await conn.query(`INSERT INTO feedbacks (invoice_id, phone, created_by, average_rating, food_quality_rating, service_rating, staff_behavior_rating, ambiance_rating, recommend_rating, remarks, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [invoiceId, uniqueCustomerId, null, averageRating, food_quality, service, staff_behavior, ambiance, recommend, remarks||null, tenantId]);

      // step 7: commit transaction / if any exception occurs then rollback
      await conn.commit();

      return;
    } catch (error) {
      console.error(error);
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
};
