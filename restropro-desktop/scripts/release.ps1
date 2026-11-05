<#
  Builds the Bong POS desktop installer and publishes it as an automatic update.

    powershell -ExecutionPolicy Bypass -File scripts\release.ps1 -Version 1.0.1
    powershell -ExecutionPolicy Bypass -File scripts\release.ps1 -Version 1.0.1 -SkipUpload
    powershell -ExecutionPolicy Bypass -File scripts\release.ps1 -Server root@other-host -RemoteDir /opt/restro-pos/desktop-releases

  Every installed app checks <POS address>/desktop/latest.yml every few hours,
  downloads the new version in the background and installs it on the next
  restart. latest.yml is uploaded last, so no app ever sees a version whose
  installer is still uploading.

  Code signing (recommended): set CSC_LINK (path to .pfx) and CSC_KEY_PASSWORD
  before running, and electron-builder signs the app and installer.
#>
param(
  # New version, e.g. 1.0.1. Must be higher than the installed one or apps will not update.
  [string]$Version = '',
  [string]$Server = 'root@10.36.200.125',
  [string]$RemoteDir = '/opt/restro-pos/desktop-releases',
  [switch]$SkipUpload
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent

function Invoke-Step([string]$Title, [scriptblock]$Block) {
  Write-Host "==> $Title" -ForegroundColor Cyan
  & $Block
  if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw "$Title failed (exit code $LASTEXITCODE)." }
}

Push-Location $Root
try {
  if ($Version) {
    Invoke-Step "Setting version $Version" { npm version $Version --no-git-tag-version --allow-same-version | Out-Null }
  }
  $version = (Get-Content package.json -Raw | ConvertFrom-Json).version

  if (-not (Test-Path node_modules)) { Invoke-Step 'Installing dependencies' { npm ci --no-audit --no-fund } }

  Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
  Invoke-Step "Building Bong POS $version" { npm run dist }

  $setup = "dist\Bong-POS-Setup-$version.exe"
  $files = @($setup, "$setup.blockmap", 'dist\latest.yml')
  foreach ($f in $files) { if (-not (Test-Path $f)) { throw "Expected build output $f is missing." } }
  if (-not $env:CSC_LINK) {
    Write-Warning 'The installer is not code-signed: Windows SmartScreen will warn on first install. Set CSC_LINK / CSC_KEY_PASSWORD to sign.'
  }

  if ($SkipUpload) {
    Write-Host "Built (not uploaded): $setup" -ForegroundColor Green
    return
  }

  Invoke-Step "Preparing $Server`:$RemoteDir" { ssh $Server "mkdir -p '$RemoteDir'" }
  Invoke-Step 'Uploading installer' { scp $setup "$setup.blockmap" "${Server}:$RemoteDir/" }
  # Stable download link for new installs: <POS address>/desktop/Bong-POS-Setup.exe
  Invoke-Step 'Updating download link' {
    ssh $Server "cp -f '$RemoteDir/Bong-POS-Setup-$version.exe' '$RemoteDir/Bong-POS-Setup.exe' && chmod -R a+rX '$RemoteDir'"
  }
  # Last: this is what tells installed apps a new version exists.
  Invoke-Step 'Publishing update (latest.yml)' {
    scp dist\latest.yml "${Server}:$RemoteDir/latest.yml.tmp"
    if ($LASTEXITCODE -eq 0) { ssh $Server "mv -f '$RemoteDir/latest.yml.tmp' '$RemoteDir/latest.yml' && chmod a+r '$RemoteDir/latest.yml'" }
  }
  Write-Host "Released Bong POS $version. Installed apps update within a few hours (or via Check for Updates)." -ForegroundColor Green
}
finally {
  Pop-Location
}
