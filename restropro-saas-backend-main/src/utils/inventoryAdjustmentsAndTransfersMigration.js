/**
 * Migration: Ensures tables for Stock Adjustments and Stock Transfers exist.
 * Idempotent: safe to run repeatedly on backend startup.
 */
exports.ensureInventoryAdjustmentsAndTransfersSchema = async (pool) => {
  let conn;
  try {
    conn = await pool.getConnection();

    // 1. Ensure sequences table exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sequences (
        tenant_id INT NOT NULL,
        table_name VARCHAR(100) NOT NULL,
        current_value BIGINT NOT NULL DEFAULT 0,
        PRIMARY KEY (tenant_id, table_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. inventory_stock_adjustments table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS inventory_stock_adjustments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        reference_no VARCHAR(100) NOT NULL,
        adjustment_date DATE NOT NULL,
        reason ENUM('physical_count', 'spoilage', 'damage', 'theft_loss', 'internal_use', 'correction', 'other') NOT NULL DEFAULT 'physical_count',
        status ENUM('draft', 'completed') NOT NULL DEFAULT 'completed',
        total_items INT NOT NULL DEFAULT 0,
        net_quantity_change DECIMAL(12,3) NOT NULL DEFAULT 0.000,
        notes TEXT NULL,
        created_by VARCHAR(255) NULL,
        completed_by VARCHAR(255) NULL,
        completed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_adj_tenant (tenant_id),
        INDEX idx_adj_ref (reference_no),
        INDEX idx_adj_date (adjustment_date),
        INDEX idx_adj_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. inventory_stock_adjustment_items table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS inventory_stock_adjustment_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        adjustment_id INT NOT NULL,
        inventory_item_id INT NOT NULL,
        item_title VARCHAR(255) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        current_quantity DECIMAL(12,3) NOT NULL,
        counted_quantity DECIMAL(12,3) NOT NULL,
        delta_quantity DECIMAL(12,3) NOT NULL,
        note VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_adj_item_adj (adjustment_id),
        INDEX idx_adj_item_inv (inventory_item_id),
        FOREIGN KEY (adjustment_id) REFERENCES inventory_stock_adjustments(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. inventory_stock_transfers table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS inventory_stock_transfers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        business_group_id INT NULL,
        from_tenant_id INT NOT NULL,
        to_tenant_id INT NOT NULL,
        reference_no VARCHAR(100) NOT NULL,
        transfer_date DATE NOT NULL,
        status ENUM('draft', 'in_transit', 'completed', 'cancelled') NOT NULL DEFAULT 'in_transit',
        total_items INT NOT NULL DEFAULT 0,
        total_quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000,
        notes TEXT NULL,
        dispatched_by VARCHAR(255) NULL,
        dispatched_at TIMESTAMP NULL,
        received_by VARCHAR(255) NULL,
        received_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_trx_from (from_tenant_id),
        INDEX idx_trx_to (to_tenant_id),
        INDEX idx_trx_status (status),
        INDEX idx_trx_ref (reference_no)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. inventory_stock_transfer_items table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS inventory_stock_transfer_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transfer_id INT NOT NULL,
        from_item_id INT NOT NULL,
        to_item_id INT NULL,
        item_title VARCHAR(255) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        quantity_sent DECIMAL(12,3) NOT NULL,
        quantity_received DECIMAL(12,3) NULL,
        note VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_trx_item_trx (transfer_id),
        FOREIGN KEY (transfer_id) REFERENCES inventory_stock_transfers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log("[Migration] Inventory Adjustments & Transfers schema verified successfully.");
  } catch (err) {
    console.error("[Migration] ensureInventoryAdjustmentsAndTransfersSchema error:", err);
    throw err;
  } finally {
    if (conn) conn.release();
  }
};
