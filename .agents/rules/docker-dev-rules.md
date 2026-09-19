# Docker Development & Operations Rules

Guidelines for executing commands, verifying builds, and maintaining local containers in the `restro-220` stack.

---

## 1. Container Architecture Reference
- `restropro_frontend`: Nginx serving production Vite bundle on port `5173`. Proxies `/api/` to backend:3000.
- `restropro_backend`: Node.js Express API on port `3000`.
- `restropro_db`: MySQL 8.0 on port `3306` (User: `restro`, Pass: `restropass`, DB: `restropro_saas`).

---

## 2. Rebuilding the Frontend
Whenever changes are made to frontend source files, trigger a fast Docker build:
```powershell
docker compose up -d --build frontend
```
*Note:* Rebuilding Vite inside Docker takes ~10-12 seconds and confirms zero TypeScript/JSX compilation errors.

---

## 3. Fast Headless Verification
- **Avoid running heavy browser subagents** unless explicitly required or approved by the user.
- **Direct Database Queries:**
  ```powershell
  docker exec restropro_db mysql -urestro -prestropass restropro_saas -e "SELECT ..."
  ```
- **Direct Backend Service / Function Testing:**
  Execute isolated Node.js test snippets directly inside `restropro_backend`:
  ```powershell
  docker exec restropro_backend node -e "const s = require('./src/services/my.service'); (async () => { ... process.exit(0); })();"
  ```
  *(Remember to include `process.exit(0)` so the connection pool does not hold the process open).*

- **Container Logs Inspection:**
  ```powershell
  docker logs --tail 50 restropro_backend
  ```
