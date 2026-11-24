/**
 * Migration: delivery apps (Grab, Foodpanda, Nham24, ...) as an order channel.
 *  - delivery_platforms: per-tenant apps with price markup and commission
 *  - orders.delivery_platform_id / orders.platform_order_ref
 * Idempotent: CREATE TABLE IF NOT EXISTS, columns/indexes checked first.
 */
const { addColumnIfMissing } = require("./posFeaturesMigration");

exports.ensureDeliveryPlatformsSchema = async (pool) => {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS delivery_platforms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        name VARCHAR(60) NOT NULL,
        color VARCHAR(16) NULL,
        markup_percent DECIMAL(6,2) NOT NULL DEFAULT 0,
        commission_percent DECIMAL(6,2) NOT NULL DEFAULT 0,
        payment_type_id INT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_delivery_platforms_tenant (tenant_id, is_active, sort_order),
        CONSTRAINT fk_delivery_platforms_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await addColumnIfMissing(conn, "orders", "delivery_platform_id", "INT NULL DEFAULT NULL");
    await addColumnIfMissing(conn, "orders", "platform_order_ref", "VARCHAR(64) NULL DEFAULT NULL");

    const [idx] = await conn.query(
      `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_platform' LIMIT 1`
    );
    if (idx.length === 0) {
      await conn.query(`ALTER TABLE orders ADD INDEX idx_orders_platform (tenant_id, delivery_platform_id)`);
      console.log("[Migration] Added idx_orders_platform");
    }
  } finally {
    conn.release();
  }
};
