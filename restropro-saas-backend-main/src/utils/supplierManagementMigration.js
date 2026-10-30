/**
 * Migration: Ensures tables for Supplier (Vendor) Management and Purchase Orders exist.
 * Idempotent: safe to run repeatedly on backend startup.
 */
exports.ensureSupplierManagementSchema = async (pool) => {
  let conn;
  try {
    conn = await pool.getConnection();

    // 1. Sequences table (used for sequential PO numbering)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sequences (
        tenant_id INT NOT NULL,
        table_name VARCHAR(100) NOT NULL,
        current_value BIGINT NOT NULL DEFAULT 0,
        PRIMARY KEY (tenant_id, table_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. inventory_vendors table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS inventory_vendors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255) NULL,
        phone VARCHAR(50) NULL,
        email VARCHAR(255) NULL,
        telegram VARCHAR(100) NULL,
        address_line1 VARCHAR(255) NULL,
        address_line2 VARCHAR(255) NULL,
        city VARCHAR(100) NULL,
        state VARCHAR(100) NULL,
        country VARCHAR(100) NULL,
        zipcode VARCHAR(20) NULL,
        tax_id_no VARCHAR(100) NULL,
        payment_terms VARCHAR(100) NULL,
        bank_details TEXT NULL,
        notes TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_vendors_tenant (tenant_id),
        INDEX idx_vendors_phone (phone),
        INDEX idx_vendors_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ensure extra columns exist on inventory_vendors if table already existed without them
    const [vendorCols] = await conn.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_vendors'
    `);
    const existingVendorCols = new Set(vendorCols.map((c) => c.COLUMN_NAME.toLowerCase()));

    const colsToAdd = [
      { name: "email", def: "VARCHAR(255) NULL AFTER phone" },
      { name: "telegram", def: "VARCHAR(100) NULL AFTER email" },
      { name: "payment_terms", def: "VARCHAR(100) NULL AFTER tax_id_no" },
      { name: "bank_details", def: "TEXT NULL AFTER payment_terms" },
      { name: "notes", def: "TEXT NULL AFTER bank_details" },
      { name: "is_active", def: "TINYINT(1) NOT NULL DEFAULT 1 AFTER notes" },
    ];

    for (const col of colsToAdd) {
      if (!existingVendorCols.has(col.name.toLowerCase())) {
        await conn.query(`ALTER TABLE inventory_vendors ADD COLUMN ${col.name} ${col.def}`);
        console.log(`[Migration] Added column ${col.name} to inventory_vendors`);
      }
    }

    // 3. inventory_purchase_orders table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS inventory_purchase_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        vendor_id INT NULL,
        vendor_name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255) NULL,
        phone VARCHAR(50) NULL,
        tax_id_no VARCHAR(100) NULL,
        address TEXT NULL,
        total_amount DECIMAL(12,2) DEFAULT 0.00,
        currency VARCHAR(10) DEFAULT '$',
        created_by VARCHAR(255) NULL,
        notes TEXT NULL,
        status ENUM('draft', 'ordered', 'completed', 'cancelled') DEFAULT 'ordered',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fullfilled_at TIMESTAMP NULL,
        INDEX idx_po_tenant (tenant_id),
        INDEX idx_po_vendor (vendor_id),
        INDEX idx_po_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ensure extra columns on inventory_purchase_orders
    const [poCols] = await conn.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_purchase_orders'
    `);
    const existingPoCols = new Set(poCols.map((c) => c.COLUMN_NAME.toLowerCase()));

    const poColsToAdd = [
      { name: "total_amount", def: "DECIMAL(12,2) DEFAULT 0.00 AFTER address" },
      { name: "currency", def: "VARCHAR(10) DEFAULT '$' AFTER total_amount" },
      { name: "phone", def: "VARCHAR(50) NULL AFTER contact_person" },
    ];
    for (const col of poColsToAdd) {
      if (!existingPoCols.has(col.name.toLowerCase())) {
        await conn.query(`ALTER TABLE inventory_purchase_orders ADD COLUMN ${col.name} ${col.def}`);
        console.log(`[Migration] Added column ${col.name} to inventory_purchase_orders`);
      }
    }

    // 4. inventory_purchase_order_items table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS inventory_purchase_order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        purchase_order_id INT NOT NULL,
        tenant_id INT NOT NULL,
        inventory_item_id INT NULL,
        inventory_item_name VARCHAR(255) NOT NULL,
        inventory_item_unit VARCHAR(20) NOT NULL,
        quantity DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
        unit_cost DECIMAL(12,4) DEFAULT 0.0000,
        subtotal DECIMAL(12,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_poi_po (purchase_order_id),
        INDEX idx_poi_tenant (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [poiCols] = await conn.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_purchase_order_items'
    `);
    const existingPoiCols = new Set(poiCols.map((c) => c.COLUMN_NAME.toLowerCase()));
    if (!existingPoiCols.has("unit_cost")) {
      await conn.query(`ALTER TABLE inventory_purchase_order_items ADD COLUMN unit_cost DECIMAL(12,4) DEFAULT 0.0000 AFTER quantity`);
    }
    if (!existingPoiCols.has("subtotal")) {
      await conn.query(`ALTER TABLE inventory_purchase_order_items ADD COLUMN subtotal DECIMAL(12,2) DEFAULT 0.00 AFTER unit_cost`);
    }

    // 5. inventory_purchase_orders_drafts table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS inventory_purchase_orders_drafts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        item_id INT NOT NULL,
        quantity DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
        unit_cost DECIMAL(12,4) DEFAULT 0.0000,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pod_tenant (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log("[Migration] Supplier & Purchase Order schema verified/migrated successfully.");
  } catch (err) {
    console.error("[Migration] Error in ensureSupplierManagementSchema:", err.message);
  } finally {
    if (conn) conn.release();
  }
};
