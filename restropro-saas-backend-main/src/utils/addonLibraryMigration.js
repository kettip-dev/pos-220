/**
 * Migration: shared Add-on Library.
 *
 *  - addon_library            one row per add-on per tenant (title, default price, on/off)
 *  - addon_library_recipes    ingredients deducted from inventory whenever the add-on is sold
 *  - menu_item_addons.library_addon_id   link from an item's add-on to the library entry
 *  - menu_item_addons.has_custom_price   1 = this item overrides the library price
 *
 * menu_item_addons stays the per-item record that orders reference (order_items.addons holds its ids),
 * so order history, KDS, receipts and reports keep working unchanged. Its title/price columns are kept
 * in sync with the library by addon_library.service.
 *
 * Auto-merge: every menu_item_addons row without a library link is grouped by tenant + case-insensitive
 * trimmed title and linked to one library entry (default price = most common price; rows with a different
 * price keep it as a per-item override). This runs every startup, so rows created by older code paths
 * (branch copy, menu import) get linked too.
 *
 * Idempotent: safe to run on every startup.
 */

const columnExists = async (conn, table, column) => {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
};

const indexExists = async (conn, table, index) => {
  const [rows] = await conn.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, index]
  );
  return rows.length > 0;
};

const normalizeTitle = (title) => String(title || "").trim().replace(/\s+/g, " ").toLowerCase();

/** Pick the most common price of a group (ties → lowest price). */
const modePrice = (rows) => {
  const counts = new Map();
  for (const r of rows) {
    const p = Number(r.price || 0).toFixed(2);
    counts.set(p, (counts.get(p) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))[0][0];
};

/**
 * Link every un-linked menu_item_addons row to a library entry (creating entries as needed).
 * Exported so other code paths can call it after bulk-inserting addons.
 */
const linkUnlinkedAddons = async (conn, tenantId = null) => {
  const [rows] = await conn.query(
    `SELECT id, item_id, tenant_id, title, price FROM menu_item_addons
     WHERE library_addon_id IS NULL AND tenant_id IS NOT NULL ${tenantId ? "AND tenant_id = ?" : ""}`,
    tenantId ? [tenantId] : []
  );
  if (rows.length === 0) return 0;

  // Group by tenant + normalized title
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.tenant_id}::${normalizeTitle(r.title)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  let linked = 0;
  for (const groupRows of groups.values()) {
    const tId = groupRows[0].tenant_id;
    const norm = normalizeTitle(groupRows[0].title);
    if (!norm) continue;

    // Reuse an existing library entry with the same name, if any
    const [existing] = await conn.query(
      `SELECT id, price FROM addon_library
       WHERE tenant_id = ? AND LOWER(TRIM(title)) = ? LIMIT 1`,
      [tId, norm]
    );

    let libraryId;
    let libraryPrice;
    if (existing.length > 0) {
      libraryId = existing[0].id;
      libraryPrice = Number(existing[0].price || 0).toFixed(2);
    } else {
      libraryPrice = modePrice(groupRows);
      const [ins] = await conn.query(
        `INSERT INTO addon_library (tenant_id, title, price) VALUES (?, ?, ?)`,
        [tId, String(groupRows[0].title).trim(), libraryPrice]
      );
      libraryId = ins.insertId;
    }

    for (const r of groupRows) {
      const custom = Number(r.price || 0).toFixed(2) !== libraryPrice ? 1 : 0;
      await conn.query(
        `UPDATE menu_item_addons SET library_addon_id = ?, has_custom_price = ?
         WHERE id = ? AND tenant_id = ?`,
        [libraryId, custom, r.id, tId]
      );
      linked += 1;
    }
  }
  return linked;
};

exports.linkUnlinkedAddons = linkUnlinkedAddons;

exports.ensureAddonLibrarySchema = async (pool) => {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS addon_library (
        id INT NOT NULL AUTO_INCREMENT,
        tenant_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        is_enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_addon_library_tenant (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS addon_library_recipes (
        id INT NOT NULL AUTO_INCREMENT,
        tenant_id INT NOT NULL,
        library_addon_id INT NOT NULL,
        inventory_item_id INT NOT NULL,
        quantity DECIMAL(10,4) NOT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_library_recipe (library_addon_id, inventory_item_id),
        KEY idx_addon_library_recipes_tenant (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    // Per-item on/off (also added by addonAvailabilityMigration; whichever runs first wins)
    if (!(await columnExists(conn, "menu_item_addons", "is_enabled"))) {
      try {
        await conn.query(`ALTER TABLE menu_item_addons ADD COLUMN is_enabled TINYINT(1) NOT NULL DEFAULT 1`);
      } catch (err) {
        if (err.code !== "ER_DUP_FIELDNAME") throw err;
      }
    }
    if (!(await columnExists(conn, "menu_item_addons", "library_addon_id"))) {
      await conn.query(`ALTER TABLE menu_item_addons ADD COLUMN library_addon_id INT NULL`);
      console.log("[Migration] Added library_addon_id to menu_item_addons");
    }
    if (!(await columnExists(conn, "menu_item_addons", "has_custom_price"))) {
      await conn.query(`ALTER TABLE menu_item_addons ADD COLUMN has_custom_price TINYINT(1) NOT NULL DEFAULT 0`);
      console.log("[Migration] Added has_custom_price to menu_item_addons");
    }
    if (!(await indexExists(conn, "menu_item_addons", "idx_menu_item_addons_library"))) {
      await conn.query(`ALTER TABLE menu_item_addons ADD INDEX idx_menu_item_addons_library (library_addon_id)`);
    }

    const linked = await linkUnlinkedAddons(conn);
    if (linked > 0) {
      console.log(`[Migration] Linked ${linked} item add-ons to the shared add-on library`);
    }
  } finally {
    conn.release();
  }
};
