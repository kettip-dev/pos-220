# Multi-Tenant Isolation & Database Rules

These rules govern all backend services, SQL queries, controllers, and database migrations in [`restropro-saas-backend-main`](file:///c:/projects_tipket/Other%20Projects/restro-220/restropro-saas-backend-main/).

---

## 1. Mandatory Tenant Scoping
Every table storing business domain data belongs to a tenant (`tenant_id`).

- **Rule:** Never execute a `SELECT`, `UPDATE`, or `DELETE` query without checking `tenant_id`:
  ```sql
  -- CORRECT:
  SELECT * FROM orders WHERE id = ? AND tenant_id = ?;
  UPDATE menu_items SET price = ? WHERE id = ? AND tenant_id = ?;
  
  -- FORBIDDEN:
  SELECT * FROM orders WHERE id = ?;
  UPDATE menu_items SET price = ? WHERE id = ?;
  ```
- **Child Entity Scoping:** When updating child records (like `order_items`), join or verify through the parent entity:
  ```sql
  UPDATE order_items oi
  JOIN orders o ON o.id = oi.order_id
  SET oi.status = ?
  WHERE oi.id = ? AND o.tenant_id = ?;
  ```

---

## 2. Safe Deletions & Cascade Handling
- Never leave orphan references or foreign key violations.
- When deleting a configuration (such as a `kitchen_station` or `category`), first unbind any referencing items in a database transaction (`conn.beginTransaction()`), or enforce clear error handling if dependencies exist.

---

## 3. Idempotent Migrations
- MySQL does not support `ALTER TABLE ADD COLUMN IF NOT EXISTS` natively on older versions.
- Always inspect `INFORMATION_SCHEMA.COLUMNS` before adding columns:
  ```javascript
  const [cols] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, colName]
  );
  if (cols.length === 0) {
    await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ...`);
  }
  ```
- Place schema additions in [`src/utils/`](file:///c:/projects_tipket/Other%20Projects/restro-220/restropro-saas-backend-main/src/utils/) and invoke them inside [`src/config/mysql.db.js`](file:///c:/projects_tipket/Other%20Projects/restro-220/restropro-saas-backend-main/src/config/mysql.db.js) during database pool initialization.
