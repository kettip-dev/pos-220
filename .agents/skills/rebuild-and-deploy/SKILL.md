---
name: rebuild-and-deploy
description: >-
  Use this skill when rebuilding local containers, compiling frontend Vite bundles,
  running local stack diagnostics, or executing remote and on-server production deployments
  of Bong POS to the target server (10.36.200.125 / pos.allkh.app).
---

# Bong POS Rebuild & Deployment Workflows

This skill provides complete operational runbooks for rebuilding the local development stack and deploying the production stack to the remote server.

---

## 1. Environments Overview

| Environment | Compose File | Ingress / Port | Target Host | URL |
|---|---|---|---|---|
| **Local Dev** | `docker-compose.yml` | Frontend: `5173`<br>Backend: `3000`<br>MySQL: `3306`<br>Redis: `6380` | Localhost | `http://localhost:5173` |
| **Production (Primary)** | `docker-compose.prod.yml` | Ingress: `4001`<br>(Nginx reverse proxying to backend) | `10.36.200.125`<br>(Path: `/opt/restro-pos`) | Domain: `http://pos.allkh.app`<br>Direct IP: `http://10.36.200.125:4001` |
| **Production (Second Server)** | `docker-compose.prod.yml` | Ingress: `4001`<br>(Nginx reverse proxying to backend) | `rocky.tail5d006f.ts.net`<br>(Path: `/opt/restro-pos`) | Tailscale: `http://rocky.tail5d006f.ts.net:4001`<br>Direct IP: `http://100.117.113.19:4001` |

---

## 2. Local Stack Rebuild Runbook

### A. Rebuilding the Frontend Bundle (Fast, ~10-15s)
Whenever React components, Tailwind styles, or views inside [`restropro-saas-frontend-main`](file:///c:/projects_tipket/Other%20Projects/restro-220/restropro-saas-frontend-main/) are changed:

```powershell
docker compose up -d --build frontend
```

> [!TIP]
> This rebuilds only the Nginx container with the updated Vite bundle. Database and backend connections remain uninterrupted.

### B. Rebuilding / Restarting Backend Service
When backend JavaScript or dependency files change inside [`restropro-saas-backend-main`](file:///c:/projects_tipket/Other%20Projects/restro-220/restropro-saas-backend-main/):

- **Fast Restart (Code updates mounted or hot-tested):**
  ```powershell
  docker restart restropro_backend
  ```
- **Full Backend Image Rebuild (New dependencies in `package.json`):**
  ```powershell
  docker compose up -d --build backend
  ```

### C. Full Local Stack Rebuild
To rebuild all services locally:
```powershell
docker compose up -d --build
```

### D. Clean Rebuild (Bypassing Docker Cache)
Use when Docker layers get stale or corrupted:
```powershell
docker compose build --no-cache
docker compose up -d
```

### E. Local Stack Health Check & Verification
```powershell
# 1. Check container health status
docker ps

# 2. Check backend health endpoint
docker exec restropro_backend node -e "require('http').get('http://127.0.0.1:3000/health', (r) => { console.log('Status:', r.statusCode); process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', (e) => { console.error(e); process.exit(1); })"

# 3. Check database connectivity
docker exec restropro_db mysqladmin ping -h 127.0.0.1 -u root -prootpassword

# 4. View backend migration logs
docker logs --tail 50 restropro_backend
```

---

## 3. Remote Server Deployment Runbook

Deployments to the remote host (`10.36.200.125`) can be executed directly from your local terminal with automated packaging, streaming, and execution.

### Target Server Configuration
- **Host:** `10.36.200.125`
- **SSH User:** `root`
- **Remote Directory:** `/opt/restro-pos`
- **Compose Config:** `docker-compose.prod.yml`
- **Production Environment:** `.env.production`
- **Ingress Port:** `4001`
- **Domain:** `http://pos.allkh.app/`

---

### Method 1: 1-Click Remote Deployment (From Local Machine)

Run from the root directory on Windows (PowerShell) or Linux (Bash):

#### PowerShell (Windows):
```powershell
# Deploy to Primary Server (10.36.200.125):
.\remote-deploy.ps1

# Deploy to Second Server (rocky.tail5d006f.ts.net):
.\deploy-second-server.ps1
# or: .\remote-deploy.ps1 -Target second
```

#### Bash (Linux/macOS):
```bash
# Deploy to Primary Server (10.36.200.125):
./remote-deploy.sh deploy

# Deploy to Second Server (rocky.tail5d006f.ts.net):
./deploy-second-server.sh
# or: ./remote-deploy.sh second
```

#### What the 1-Click Deployment Script Does Automatically:
1. Verifies SSH connection to `root@10.36.200.125`.
2. Creates remote `/opt/restro-pos` directory if not present.
3. Archives workspace while excluding `node_modules`, `.git`, `dist`, `tmp`, `backups`, and logs.
4. Streams the archive over SSH directly into `/opt/restro-pos`.
5. Executes `./deploy.sh` on the server, building production images with `docker-compose.prod.yml` and starting containers with healthchecks.

---

### Method 2: Remote Stack Operations (From Local Machine)

You can manage the remote server without opening an interactive SSH terminal:

| Operation | PowerShell Command | Bash Command |
|---|---|---|
| **Check Container Status** | `.\remote-deploy.ps1 -Action status` | `./remote-deploy.sh status` |
| **View Live Remote Logs** | `.\remote-deploy.ps1 -Action logs` | `./remote-deploy.sh logs` |
| **Restart Remote Stack** | `.\remote-deploy.ps1 -Action restart` | `./remote-deploy.sh restart` |
| **Create Remote DB Backup** | `.\remote-deploy.ps1 -Action backup` | `./remote-deploy.sh backup` |
| **Stop Remote Stack** | `.\remote-deploy.ps1 -Action down` | `./remote-deploy.sh down` |

---

### Method 3: Direct On-Server Deployment (Inside SSH Session)

If already logged into the server (`ssh root@10.36.200.125`):

```bash
cd /opt/restro-pos

# 1. Full Production Build & Deploy
./deploy.sh deploy

# 2. Check health & running services
./deploy.sh status

# 3. View streaming logs
./deploy.sh logs

# 4. View specific service logs (e.g. backend)
./deploy.sh logs backend

# 5. Restart specific service
./deploy.sh restart backend

# 6. Trigger database backup before maintenance
./deploy.sh backup
```

---

## 4. Post-Deployment Verification & Smoke Testing

After triggering a deployment, execute these verification checks:

### 1. Ingress Health Check
```powershell
# From local machine:
curl -I http://10.36.200.125:4001/api/v1/health

# Or from server:
curl -I http://127.0.0.1:4001/api/v1/health
```
**Expected Response:** `HTTP/1.1 200 OK`

### 2. Web UI Ingress Check
- Domain: [http://pos.allkh.app:4001/](http://pos.allkh.app:4001/) (or [http://pos.allkh.app/](http://pos.allkh.app/) if reverse-proxied)
- Direct IP: [http://10.36.200.125:4001/](http://10.36.200.125:4001/)

### 3. Superadmin Credentials
- **URL:** `/login`
- **Email:** `admin@example.com`
- **Password:** `Admin@123456`

---

## 5. Guardrails & Safety Checklist

> [!CAUTION]
> **Data Loss Prevention:**
> - NEVER run `docker compose down -v` or `docker-compose.prod.yml down -v` on production. Doing so deletes named database volumes (`mysql_data`).
> - Always run `./deploy.sh backup` (or `.\remote-deploy.ps1 -Action backup`) prior to applying significant database migrations or major schema changes.

> [!IMPORTANT]
> **Production Secrets & Persistence:**
> - Production configuration is governed by `.env.production`.
> - Uploaded receipt assets, restaurant logos, and item images persist in the `backend_uploads` volume (`/usr/src/app/public`).
> - Database backups are stored on the server under `/opt/restro-pos/backups/db-backup-<timestamp>.sql`.

### Database Restore Procedure (Emergency Rollback)
If an emergency rollback is required:
```bash
docker exec -i restropro_db mysql -u root -p<DB_ROOT_PASSWORD> restropro_saas < /opt/restro-pos/backups/db-backup-<timestamp>.sql
```
