# ==============================================================================
# Restro PRO - Remote 1-Click Deployment Script (PowerShell)
# Targets:
#   - Primary: root@10.36.200.125:/opt/restro-pos
#   - Second:  root@rocky.tail5d006f.ts.net:/opt/restro-pos
# Ingress Port: 4001
# ==============================================================================

[CmdletBinding()]
param (
    [string]$Target = "",
    [string]$RemoteHost = "10.36.200.125",
    [string]$RemoteUser = "root",
    [string]$RemoteDir = "/opt/restro-pos",
    [string]$Action = "deploy"
)

if ($Target -match "^(second|rocky|2)$") {
    $RemoteHost = "rocky.tail5d006f.ts.net"
} elseif ($Target -match "^(primary|1)$") {
    $RemoteHost = "10.36.200.125"
}

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

function Write-Info { Write-Host "[INFO] $($args[0])" -ForegroundColor Cyan }
function Write-Success { Write-Host "[SUCCESS] $($args[0])" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $($args[0])" -ForegroundColor Yellow }
function Write-Err { Write-Host "[ERROR] $($args[0])" -ForegroundColor Red }

$SSH_TARGET = "${RemoteUser}@${RemoteHost}"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "       Restro PRO - 1-Click Remote Deployment to $RemoteHost       " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# Test SSH Connection
Write-Info "Verifying SSH connection to $SSH_TARGET..."
try {
    $testResult = ssh -o BatchMode=yes -o ConnectTimeout=5 $SSH_TARGET "echo ok"
    if ($testResult -ne "ok") {
        Write-Err "Could not authenticate to $SSH_TARGET via SSH."
        exit 1
    }
    Write-Success "SSH connection verified."
} catch {
    Write-Err "SSH connection failed: $_"
    exit 1
}

if ($Action -eq "deploy") {
    # Ensure remote directory exists
    Write-Info "Preparing remote directory $RemoteDir on $RemoteHost..."
    ssh $SSH_TARGET "mkdir -p $RemoteDir"

    # Archive and stream code to remote host excluding heavy/irrelevant dirs
    Write-Info "Archiving local workspace and streaming to ${SSH_TARGET}:${RemoteDir}..."
    $tarExclude = @(
        '--exclude=node_modules',
        '--exclude=*/node_modules/*',
        '--exclude=.git',
        '--exclude=*/.git/*',
        '--exclude=dist',
        '--exclude=*/dist/*',
        '--exclude=tmp',
        '--exclude=*/tmp/*',
        '--exclude=backups',
        '--exclude=*.log',
        '--exclude=*.zip',
        '--exclude=.gemini',
        '--exclude=.system_generated',
        '--exclude=.agents',
        '--exclude=.claude'
    )

    $tempArchive = Join-Path $env:TEMP "restro-deploy-$((Get-Date).Ticks).tar.gz"
    $remoteTempArchive = "/tmp/restro-deploy.tar.gz"
    try {
        Write-Info "Creating temporary transfer archive..."
        & tar -czf $tempArchive @tarExclude -C $ScriptDir .

        Write-Info "Transferring archive via SCP to remote host..."
        & scp -o StrictHostKeyChecking=no $tempArchive "${SSH_TARGET}:${remoteTempArchive}"

        Write-Info "Extracting archive on remote host..."
        ssh -o StrictHostKeyChecking=no $SSH_TARGET "tar -xzf $remoteTempArchive -C $RemoteDir && rm -f $remoteTempArchive"
        Write-Success "Files transferred and extracted successfully."
    } finally {
        if (Test-Path $tempArchive) {
            Remove-Item $tempArchive -Force -ErrorAction SilentlyContinue
        }
    }

    # Execute remote deployment
    Write-Info "Triggering ./deploy.sh on $RemoteHost..."
    ssh -t $SSH_TARGET "cd $RemoteDir && chmod +x deploy.sh && ./deploy.sh"

    Write-Host ""
    Write-Host "==================================================================" -ForegroundColor Green
    Write-Host "      Remote Deployment to $RemoteHost Finished Successfully!      " -ForegroundColor Green
    Write-Host "==================================================================" -ForegroundColor Green
    Write-Host "Web POS URL:     http://pos.allkh.app:4001/ (or http://pos.allkh.app/ if proxied)" -ForegroundColor White
    Write-Host "Direct IP URL:   http://${RemoteHost}:4001/" -ForegroundColor White
    Write-Host "Health Check:    http://${RemoteHost}:4001/api/v1/health" -ForegroundColor White
    Write-Host "Superadmin:      admin@example.com / Admin@123456" -ForegroundColor White
    Write-Host "==================================================================" -ForegroundColor Green
} else {
    Write-Info "Forwarding action '$Action' to remote deploy script..."
    ssh -t $SSH_TARGET "cd $RemoteDir && ./deploy.sh $Action"
}
