const { CONFIG } = require("../config");
const { getMySqlPromiseConnection } = require("../config/mysql.db")

exports.getTenantIdFromQRCode = async (qrcode) => {
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
        return result[0]?.tenant_id;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
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
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        SELECT tenant_id, store_image, store_name, address, phone, email, currency, is_qr_menu_enabled, unique_qr_code, is_qr_order_enabled, is_feedback_enabled, unique_id FROM store_details
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

exports.setStoreSettingDB = async (storeName, address, phone, email, currency, isQRMenuEnabled, isQROrderEnabled , uniqueQRCode, isFeedbackEnabled, tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        INSERT INTO store_details ( store_name, address, phone, email, currency, is_qr_menu_enabled, is_qr_order_enabled, unique_qr_code, is_feedback_enabled, tenant_id)
        VALUES
        ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        store_name = VALUES(store_name),
        is_qr_menu_enabled = VALUES(is_qr_menu_enabled),
        address = VALUES(address),
        phone = VALUES(phone),
        email = VALUES(email),
        currency = VALUES(currency),
        tenant_id = VALUES(tenant_id),
        is_qr_order_enabled = VALUES(is_qr_order_enabled),
        is_feedback_enabled = VALUES(is_feedback_enabled);
        `;

        await conn.query(sql, [storeName, address, phone, email, currency, isQRMenuEnabled,isQROrderEnabled ,uniqueQRCode, isFeedbackEnabled, tenantId]);
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
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getServiceChargeDB = async (tenantId) => {
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
        SELECT id, title, is_active, icon FROM payment_types
        WHERE tenant_id = ?;
        `;

        if(activeOnly) {
            sql = `
            SELECT id, title, is_active, icon FROM payment_types
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
        const sql = `
        INSERT INTO store_tables
        (table_title, floor, seating_capacity, tenant_id, shape, rotation, pos_x, pos_y)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        `;

        const [result] = await conn.query(sql, [title, floor, seatingCapacity, tenantId, shape || 'round', rotation || 0, posX, posY]);
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
        rotation
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
            o.id AS active_order_id,
            o.token_no AS active_order_token,
            o.date AS active_order_date,
            o.status AS active_order_status,
            o.payment_status AS active_payment_status,
            c.name AS customer_name,
            c.phone AS customer_phone,
            COALESCE(
                (SELECT SUM(oi.price * oi.quantity) FROM order_items oi WHERE oi.order_id = o.id AND oi.status NOT IN ('cancelled')),
                0
            ) AS order_total,
            COALESCE(
                (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id AND oi.status NOT IN ('cancelled')),
                0
            ) AS order_items_count
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
            `SELECT floor, show_cashier, cashier_x, cashier_y, cashier_w, cashier_h, floor_plan_image, floor_plan_opacity, floor_plan_fit, walls, cashier_rotation FROM store_floor_layouts WHERE tenant_id = ?`,
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
            return {
                ...l,
                walls: parsedWalls,
            };
        });

        return {
            tables,
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

            await conn.query(
                `INSERT INTO store_floor_layouts (tenant_id, floor, show_cashier, cashier_x, cashier_y, cashier_w, cashier_h, cashier_rotation, floor_plan_image, floor_plan_opacity, floor_plan_fit, walls)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    walls = VALUES(walls)`,
                [tenantId, floor, showCashier, cashierX, cashierY, cashierW, cashierH, cashierRotation, floorPlanImage, floorPlanOpacity, floorPlanFit, walls]
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
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        SELECT
        id,
        table_title,
        floor,
        seating_capacity
        FROM store_tables
        WHERE tenant_id = ? AND AES_DECRYPT(UNHEX(?), ?) = HEX(id)
        LIMIT 1;
        `;

        const [result] = await conn.query(sql, [tenantId, encryptedTableId, CONFIG.ENCRYPTION_KEY]);

        return result[0] || null;
    } catch (error) {
        console.error(error);
        throw error;
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
        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.addCategoryDB = async (title, tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        INSERT INTO categories
        (title, tenant_id)
        VALUES (?, ?);
        `;

        const [result] = await conn.query(sql, [title, tenantId]);
        return result.insertId;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.getCategoriesDB = async (tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        SELECT id, title, is_enabled FROM categories
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
};

exports.updateCategoryDB = async (id, title, tenantId) => {
    const conn = await getMySqlPromiseConnection();

    try {
        const sql = `
        UPDATE categories
        SET title = ?
        WHERE id = ? AND tenant_id = ?;
        `;

        await conn.query(sql, [title, id, tenantId]);
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

        return;
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        conn.release();
    }
}

exports.placeOrderViaQrMenuDB = async (tenantId, deliveryType , cartItems, customerType, customerId, tableId, customerName ,paymentStatus = 'pending') => {
    const conn = await getMySqlPromiseConnection();

    try {
      // start transaction
      await conn.beginTransaction();

      // step 1: save data to orders table
      const [orderResult] = await conn.query(`INSERT INTO qr_orders (delivery_type, customer_type, customer_id, table_id, payment_status, tenant_id) VALUES (?, ?, ?, ?, ?, ?)`, [deliveryType, customerType, customerId, tableId, paymentStatus || 'pending', tenantId]);

      const orderId = orderResult.insertId;

      // step 2: save data to order_items
      const sqlOrderItems = `
      INSERT INTO qr_order_items
      (order_id, item_id, variant_id, price, quantity, notes, addons, tenant_id)
      VALUES ?
      `;

      await conn.query(sqlOrderItems, [cartItems.map((item)=>[orderId, item.id, item.variant_id, item.price, item.quantity, item.notes, item?.addons_ids?.length > 0 ? JSON.stringify(item.addons_ids):null, tenantId ])]);


			// Step 3 : Search customer by phone in customer table - if not existing - create one
			if(customerId){
				const sqlIsExistingCustomer = `
					SELECT 1 from customers where phone = ? AND tenant_id = ?
			`

				const [existingCustomer] = await conn.query(sqlIsExistingCustomer , [customerId, tenantId]);


				if (!existingCustomer.length) {
					const sqlAddCustomer = `
							INSERT INTO customers (phone, name,tenant_id) VALUES (?, ?,?)
					`;

					await conn.query(sqlAddCustomer, [customerId, customerName, tenantId]);
				}
			}


      // step 7: commit transaction / if any exception occurs then rollback
      await conn.commit();

      return {
        orderId
      }
    } catch (error) {
      console.error(error);
      await conn.rollback();
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
