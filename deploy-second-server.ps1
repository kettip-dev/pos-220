# ==============================================================================
# Bong POS - 1-Click Deploy to Second Server (Rocky Linux / Tailscale)
# Target: root@rocky.tail5d006f.ts.net:/opt/restro-pos
# Ingress: http://rocky.tail5d006f.ts.net:4001
# ==============================================================================

[CmdletBinding()]
param (
    [string]$Action = "deploy"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $ScriptDir "remote-deploy.ps1") -RemoteHost "rocky.tail5d006f.ts.net" -RemoteUser "root" -RemoteDir "/opt/restro-pos" -Action $Action
