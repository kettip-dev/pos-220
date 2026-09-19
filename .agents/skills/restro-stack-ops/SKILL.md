---
name: restro-stack-ops
description: >-
  Use this skill when running Docker containers, building Vite frontend bundles,
  running database migrations, inspecting MySQL tables, or executing backend service verification tests.
---

# Restro Stack Operations & Diagnostics

This skill provides fast commands and troubleshooting recipes for managing the Docker environment, database migrations, and verification scripts.

---

## 1. Fast Container Cheat Sheet

| Task | Command |
|---|---|
| Check container health | `docker ps` |
| View backend logs | `docker logs --tail 50 restropro_backend` |
| Rebuild frontend Vite bundle | `docker compose up -d --build frontend` |
| Restart backend service | `docker restart restropro_backend` |
| Query MySQL database directly | `docker exec restropro_db mysql -urestro -prestropass restropro_saas -e "<SQL_QUERY>"` |

---

## 2. Running Safe In-Container Node Scripts

To verify services or database logic without firing up a browser:

```powershell
docker exec restropro_backend node -e "
const { getMySqlPromiseConnection } = require('./src/config/mysql.db');
(async () => {
  try {
    const conn = await getMySqlPromiseConnection();
    const [rows] = await conn.query('SELECT COUNT(*) AS total FROM orders WHERE tenant_id = 721');
    console.log('Result:', rows);
    conn.release();
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();"
```

> [!IMPORTANT]
> Always call `process.exit(0)` at the end of inline node execution scripts; otherwise the MySQL pool connection will keep the process alive in the background.

---

## 3. Database Migrations

- Migrations are stored in [`restropro-saas-backend-main/src/utils/`](file:///c:/projects_tipket/Other%20Projects/restro-220/restropro-saas-backend-main/src/utils/).
- Registered in [`restropro-saas-backend-main/src/config/mysql.db.js`](file:///c:/projects_tipket/Other%20Projects/restro-220/restropro-saas-backend-main/src/config/mysql.db.js) under `initDbMigrations()`.
- Migrations run automatically when `restropro_backend` starts.
- Inspect logs to verify:
  ```powershell
  docker logs restropro_backend | grep -i migration
  ```
