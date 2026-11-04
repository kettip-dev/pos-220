<#
  Builds the Windows print agent:
    dist\restro-print-agent.exe          single-file agent (Node.js built in, nothing else to install)
    dist\RestroRawPrint.dll              USB / installed-printer helper
    dist\RestroPrintAgent-Setup-X.Y.Z.exe   installer (needs Inno Setup 6)

  Requirements on the build PC: Windows x64, Node.js 20+ (the exe bundles this
  Node runtime), and Inno Setup 6 for the installer step.

  Usage:
    powershell -ExecutionPolicy Bypass -File installer\build.ps1
    powershell -ExecutionPolicy Bypass -File installer\build.ps1 -DefaultServer https://pos.example.com -Sign
#>
param(
  # Pre-fills the "POS address" field in the installer.
  [string]$DefaultServer = '',
  # Sign the exe, DLL and installer with signtool (certificate picked automatically).
  [switch]$Sign,
  [switch]$SkipInstaller
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$Build = Join-Path $Root 'build'
$Dist = Join-Path $Root 'dist'
$Exe = Join-Path $Dist 'restro-print-agent.exe'
$Dll = Join-Path $Dist 'RestroRawPrint.dll'
$WinPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

function Invoke-Step([string]$Title, [scriptblock]$Block) {
  Write-Host "==> $Title" -ForegroundColor Cyan
  & $Block
  if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw "$Title failed (exit code $LASTEXITCODE)." }
}

function Invoke-Sign([string[]]$Files) {
  $signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if (-not $signtool) {
    $signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
      Where-Object FullName -like '*x64*' | Select-Object -First 1
  }
  if (-not $signtool) { throw 'signtool.exe not found. Install the Windows SDK or drop -Sign.' }
  $path = if ($signtool.Source) { $signtool.Source } else { $signtool.FullName }
  & $path sign /a /fd sha256 /tr http://timestamp.digicert.com /td sha256 @Files
  if ($LASTEXITCODE -ne 0) { throw 'Signing failed.' }
}

Push-Location $Root
try {
  $version = (Get-Content package.json -Raw | ConvertFrom-Json).version
  $nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
  if ($nodeMajor -lt 20) { throw "Node.js 20 or newer is required to build (found $(node -v))." }
  if ((node -p "process.arch") -ne 'x64') { throw 'Build with x64 Node.js so the exe runs on standard Windows PCs.' }

  Remove-Item -Recurse -Force $Build, $Dist -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force $Build, $Dist | Out-Null

  Invoke-Step 'Installing build dependencies' { npm ci --no-audit --no-fund }

  Invoke-Step 'Bundling agent into one file' {
    # ws (used by socket.io-client) optionally loads these native add-ons and works without them.
    npx esbuild src/index.js --bundle --platform=node "--target=node$nodeMajor" --format=cjs `
      --outfile=build/agent.cjs --external:bufferutil --external:utf-8-validate --log-level=warning
  }

  Invoke-Step 'Creating Node single-executable blob' {
    @{ main = 'build/agent.cjs'; output = 'build/sea-prep.blob'; disableExperimentalSEAWarning = $true } |
      ConvertTo-Json | Set-Content -Encoding ascii build/sea-config.json
    node --experimental-sea-config build/sea-config.json
  }

  Invoke-Step 'Building restro-print-agent.exe' {
    Copy-Item (Get-Command node).Source $Exe
    node installer/strip-signature.js $Exe
    if ($LASTEXITCODE -ne 0) { return }
    npx postject $Exe NODE_SEA_BLOB build/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
  }

  Invoke-Step 'Compiling RestroRawPrint.dll' {
    node -e "require('fs').writeFileSync('build/RestroRawPrint.cs', require('./src/transports/rawprint-source').CS_SOURCE)"
    if ($LASTEXITCODE -ne 0) { return }
    # Windows PowerShell 5.1 builds a .NET Framework assembly, which loads on every Windows 10/11 PC.
    & $WinPowerShell -NoProfile -NonInteractive -Command `
      "`$ErrorActionPreference='Stop'; Add-Type -TypeDefinition (Get-Content -Raw 'build\RestroRawPrint.cs') -OutputAssembly '$Dll' -OutputType Library"
  }

  Invoke-Step 'Checking the exe runs' {
    $reported = (& $Exe --version | Out-String).Trim()
    if ($reported -ne $version) { throw "restro-print-agent.exe --version printed '$reported', expected '$version'." }
    Write-Host "    restro-print-agent.exe $reported OK ($([math]::Round((Get-Item $Exe).Length / 1MB, 1)) MB)"
  }

  if ($Sign) { Invoke-Step 'Signing exe and DLL' { Invoke-Sign @($Exe, $Dll) } }

  if ($SkipInstaller) { return }

  $iscc = @(
    (Get-Command iscc.exe -ErrorAction SilentlyContinue).Source,
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if (-not $iscc) {
    Write-Warning 'Inno Setup 6 not found, so the installer was not built. Install it (winget install JRSoftware.InnoSetup) and run this script again.'
    return
  }

  Invoke-Step 'Building installer' {
    & $iscc /Q "/DAppVersion=$version" "/DDefaultServer=$DefaultServer" installer\setup.iss
  }
  $setup = Join-Path $Dist "RestroPrintAgent-Setup-$version.exe"
  if ($Sign) { Invoke-Step 'Signing installer' { Invoke-Sign @($setup) } }
  Write-Host "Done: $setup" -ForegroundColor Green
}
finally {
  Pop-Location
}
