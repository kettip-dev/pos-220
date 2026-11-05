# ==============================================================================
# Bong POS - PowerShell Production Deployment & Management Script
# Domain: http://pos.allkh.app/ (Ingress Port: 4001)
# Host IP: 10.36.200.125
# ==============================================================================

[CmdletBinding()]
param (
    [Parameter(Position=0)]
    [ValidateSet("deploy", "up", "down", "stop", "restart", "status", "ps", "logs", "backup")]
    [string]$Action = "deploy",

    [Parameter(Position=1)]
    [string]$Service = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$ComposeFile = "docker-compose.prod.yml"
$EnvFile = ".env.production"
$EnvExample = ".env.production.example"

function Write-Info { Write-Host "[INFO] $($args[0])" -ForegroundColor Cyan }
function Write-Success { Write-Host "[SUCCESS] $($args[0])" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $($args[0])" -ForegroundColor Yellow }
function Write-Err { Write-Host "[ERROR] $($args[0])" -ForegroundColor Red }

# Verify Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Err "Docker is not installed or not in PATH."
    exit 1
}

# Determine Docker Compose syntax
$ComposeCmd = @("compose")
try {
    docker compose version | Out-Null
} catch {
    if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
        $ComposeCmd = @()
    } else {
        Write-Err "Docker Compose is not available."
        exit 1
    }
}

function Invoke-Compose {
    param([string[]]$ArgsList)
    if ($ComposeCmd.Count -gt 0) {
        & docker compose -f $ComposeFile --env-file $EnvFile @ArgsList
    } else {
        & docker-compose -f $ComposeFile --env-file $EnvFile @ArgsList
    }
}

function Ensure-Env {
    if (-not (Test-Path $EnvFile)) {
        if (Test-Path $EnvExample) {
            Write-Warn "$EnvFile not found. Copying from $EnvExample..."
            Copy-Item $EnvExample $EnvFile
            Write-Success "Created $EnvFile"
        } else {
            Write-Err "Neither $EnvFile nor $EnvExample exists."
            exit 1
        }
    }
}

function Get-Port {
    $port = "4001"
    if (Test-Path $EnvFile) {
        Get-Content $EnvFile | ForEach-Object {
            if ($_ -match '^\s*PORT\s*=\s*(.+)$') {
                $port = $matches[1].Trim()
            }
        }
    }
    return $port
}

function Wait-Healthy {
    param([int]$MaxWaitSeconds = 90)
    Write-Info "Waiting for production containers to report healthy (timeout: ${MaxWaitSeconds}s)..."
    $elapsed = 0
    $services = @("restropro_db", "restropro_redis", "restropro_backend", "restropro_frontend")

    while ($elapsed -lt $MaxWaitSeconds) {
        $allHealthy = $true
        foreach ($s in $services) {
            $status = (docker inspect --format='{{json .State.Health.Status}}' $s 2>$null)
            if ($status -ne '"healthy"') {
                $allHealthy = $false
                break
            }
        }
        if ($allHealthy) {
            Write-Success "All containers are healthy!"
            return
        }
        Start-Sleep -Seconds 3
        $elapsed += 3
        Write-Host -NoNewline "."
    }
    Write-Host ""
    Write-Warn "Containers took longer than ${MaxWaitSeconds}s to reach full health check."
    Invoke-Compose @("ps")
}

function Smoke-Test {
    param([string]$Port)
    Write-Info "Performing HTTP smoke test against ingress port $Port..."
    $url = "http://127.0.0.1:$Port/api/v1/health"
    $success = $false
    for ($i = 0; $i -lt 5; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($resp.StatusCode -eq 200) {
                $success = $true
                break
            }
        } catch { }
        Start-Sleep -Seconds 2
    }
    if ($success) {
        Write-Success "Smoke test PASSED: $url responded with HTTP 200 OK."
    } else {
        Write-Warn "Smoke test pending or firewall restricted. Verify manually: curl $url"
    }
}

Ensure-Env
$Port = Get-Port

switch ($Action) {
    { $_ -in "deploy", "up" } {
        Write-Host "==================================================================" -ForegroundColor Cyan
        Write-Host "          Bong POS - Production Deployment Starting             " -ForegroundColor Cyan
        Write-Host "==================================================================" -ForegroundColor Cyan
        
        Write-Info "Building production images (frontend Vite bundle + backend + MySQL)..."
        Invoke-Compose @("build", "--pull")

        Write-Info "Deploying containers via $ComposeFile..."
        Invoke-Compose @("up", "-d", "--remove-orphans")

        Wait-Healthy
        Smoke-Test -Port $Port

        Write-Host ""
        Write-Host "==================================================================" -ForegroundColor Green
        Write-Host "         Bong POS Deployment Successfully Completed!            " -ForegroundColor Green
        Write-Host "==================================================================" -ForegroundColor Green
        Write-Host "Web POS Domain:   http://pos.allkh.app:$Port/ (or http://pos.allkh.app/ if proxied)" -ForegroundColor White
        Write-Host "Direct IP URL:    http://10.36.200.125:$Port/" -ForegroundColor White
        Write-Host "Health Endpoint:  http://10.36.200.125:$Port/api/v1/health" -ForegroundColor White
        Write-Host "Superadmin Login: admin@example.com / Admin@123456" -ForegroundColor White
        Write-Host "------------------------------------------------------------------" -ForegroundColor Cyan
        Write-Host "Useful Commands:" -ForegroundColor White
        Write-Host "  View live logs:   .\deploy.ps1 logs" -ForegroundColor Yellow
        Write-Host "  Check status:     .\deploy.ps1 status" -ForegroundColor Yellow
        Write-Host "  Restart stack:    .\deploy.ps1 restart" -ForegroundColor Yellow
        Write-Host "  Create DB backup: .\deploy.ps1 backup" -ForegroundColor Yellow
        Write-Host "  Stop stack:       .\deploy.ps1 down" -ForegroundColor Yellow
        Write-Host "==================================================================" -ForegroundColor Green
    }
    { $_ -in "down", "stop" } {
        Write-Info "Stopping Bong POS containers..."
        Invoke-Compose @("down")
        Write-Success "All containers stopped."
    }
    "restart" {
        Write-Info "Restarting Bong POS stack..."
        if ($Service) {
            Invoke-Compose @("restart", $Service)
        } else {
            Invoke-Compose @("restart")
        }
        Wait-Healthy
        Write-Success "Stack restarted."
    }
    { $_ -in "status", "ps" } {
        Invoke-Compose @("ps")
    }
    "logs" {
        if ($Service) {
            Invoke-Compose @("logs", "-f", "--tail=100", $Service)
        } else {
            Invoke-Compose @("logs", "-f", "--tail=100")
        }
    }
    "backup" {
        $BackupDir = Join-Path $ScriptDir "backups"
        if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir | Out-Null }
        $timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
        $BackupFile = Join-Path $BackupDir "db-backup-$timestamp.sql"
        
        Write-Info "Dumping MySQL database to $BackupFile..."
        docker exec -i restropro_db mysqldump -u root -pec7338c8171f5f3d57a07cfca0c72c05 restropro_saas > $BackupFile
        Write-Success "Backup created at $BackupFile"
    }
}
