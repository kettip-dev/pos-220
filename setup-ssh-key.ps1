# ==============================================================================
# Bong POS - One-time SSH key setup for remote deployment (PowerShell)
#
# 1. Generates ~/.ssh/id_rsa (RSA 4096; the servers accept ssh-rsa only)
# 2. Installs the public key into the server's ~/.ssh/authorized_keys
#    (you type the server password ONCE, here, in your own terminal)
# 3. Verifies passwordless login so .\remote-deploy.ps1 works
#
# Usage:
#   .\setup-ssh-key.ps1                    # primary server (10.36.200.125)
#   .\setup-ssh-key.ps1 -Target second     # second server (rocky.tail5d006f.ts.net)
#   .\setup-ssh-key.ps1 -RemoteHost 1.2.3.4 -RemoteUser root
# ==============================================================================

[CmdletBinding()]
param (
    [string]$Target = "",
    [string]$RemoteHost = "10.36.200.125",
    [string]$RemoteUser = "root",
    [string]$KeyName = "id_rsa"
)

if ($Target -match "^(second|rocky|2)$") {
    $RemoteHost = "rocky.tail5d006f.ts.net"
} elseif ($Target -match "^(primary|1)$") {
    $RemoteHost = "10.36.200.125"
}

$ErrorActionPreference = "Stop"

function Write-Info { Write-Host "[INFO] $($args[0])" -ForegroundColor Cyan }
function Write-Success { Write-Host "[SUCCESS] $($args[0])" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $($args[0])" -ForegroundColor Yellow }
function Write-Err { Write-Host "[ERROR] $($args[0])" -ForegroundColor Red }

$SshTarget = "${RemoteUser}@${RemoteHost}"
$SshDir = Join-Path $env:USERPROFILE ".ssh"
$KeyPath = Join-Path $SshDir $KeyName
$PubPath = "$KeyPath.pub"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "       Bong POS - SSH key setup for $SshTarget" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

foreach ($tool in @("ssh", "ssh-keygen")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Err "$tool not found. Install the Windows 'OpenSSH Client' optional feature first."
        exit 1
    }
}

# --- 1. Generate key if missing ----------------------------------------------
if (-not (Test-Path $SshDir)) {
    New-Item -ItemType Directory -Path $SshDir | Out-Null
}

if (Test-Path $KeyPath) {
    Write-Info "Using existing key: $KeyPath"
} else {
    Write-Info "Generating new RSA 4096 key: $KeyPath"
    $comment = "bongpos-deploy@$env:COMPUTERNAME"
    # Empty passphrase so deployments can run non-interactively.
    # (Windows PowerShell 5.1 drops a bare "" argument, so pass it as '""' there.)
    $emptyPass = if ($PSVersionTable.PSVersion.Major -ge 7) { "" } else { '""' }
    & ssh-keygen -t rsa -b 4096 -f $KeyPath -N $emptyPass -C $comment -q
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $PubPath)) {
        Write-Err "ssh-keygen failed."
        exit 1
    }
    Write-Success "Key generated."
}

$PubKey = (Get-Content $PubPath -Raw).Trim()
if (-not $PubKey -or $PubKey -match "'") {
    Write-Err "Public key at $PubPath looks invalid."
    exit 1
}

# --- 2. Already working? -----------------------------------------------------
Write-Info "Checking whether $SshTarget already accepts this key..."
$null = & ssh -i $KeyPath -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new $SshTarget "echo ok" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Success "Passwordless SSH already works. Nothing to do."
    exit 0
}

# --- 3. Install public key on the server (asks for the server password) -------
Write-Warn "Installing the public key on $SshTarget. Enter the server password when prompted."
$remoteCmd = "umask 077; mkdir -p ~/.ssh && touch ~/.ssh/authorized_keys && " +
             "(grep -qxF '$PubKey' ~/.ssh/authorized_keys || echo '$PubKey' >> ~/.ssh/authorized_keys) && " +
             "chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys && echo installed"
& ssh -o StrictHostKeyChecking=accept-new -o PreferredAuthentications=password,keyboard-interactive $SshTarget $remoteCmd
if ($LASTEXITCODE -ne 0) {
    Write-Err "Could not install the key (wrong password, or password login disabled on the server)."
    Write-Host "Manual fallback: append this line to /root/.ssh/authorized_keys on the server:" -ForegroundColor Yellow
    Write-Host $PubKey
    exit 1
}

# --- 4. Verify ---------------------------------------------------------------
$null = & ssh -i $KeyPath -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 $SshTarget "echo ok" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Success "Passwordless SSH to $SshTarget is working. You can now run .\remote-deploy.ps1"
} else {
    Write-Err "Key was installed but login still fails. Check the server's sshd_config (PubkeyAuthentication yes, PermitRootLogin)."
    exit 1
}
