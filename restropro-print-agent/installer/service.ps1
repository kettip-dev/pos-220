<#
  Registers the Restro print agent to run in the background on Windows.

  It uses a Task Scheduler task running as SYSTEM instead of a classic
  service: it is built into Windows, needs no extra wrapper binary, starts at
  boot before anyone logs in, and the 5-minute repeat trigger restarts the
  agent if it ever stops (MultipleInstances = IgnoreNew keeps it to one copy).

  Usage (elevated):
    service.ps1 install   [-Exe path]   lock down the data folder, register and start
    service.ps1 uninstall [-Purge]      stop and remove the task (-Purge also deletes config and logs)
    service.ps1 start | stop | restart | status
#>
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('install', 'uninstall', 'start', 'stop', 'restart', 'status')]
  [string]$Action,
  [string]$Exe,
  [switch]$Purge
)

$ErrorActionPreference = 'Stop'
# $PSScriptRoot is empty inside param() defaults on Windows PowerShell 5.1, so resolve it here.
if (-not $Exe) { $Exe = Join-Path $PSScriptRoot 'restro-print-agent.exe' }
$TaskName = 'Restro Print Agent'
$DataDir = Join-Path $env:ProgramData 'RestroPrintAgent'

# Well-known SIDs, so this works on any Windows display language.
$System = '*S-1-5-18'
$Admins = '*S-1-5-32-544'
$Users = '*S-1-5-32-545'

function Invoke-Icacls {
  & icacls.exe @args | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "icacls $($args -join ' ') failed with exit code $LASTEXITCODE" }
}

function Protect-DataDir {
  New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $DataDir 'logs') | Out-Null
  # Only SYSTEM and Administrators may change anything; users may read logs.
  Invoke-Icacls $DataDir /inheritance:r /grant:r "${System}:(OI)(CI)F" "${Admins}:(OI)(CI)F" "${Users}:(OI)(CI)RX"
  # Drop any permissions left on existing files (e.g. created before install).
  Invoke-Icacls "$DataDir\*" /reset /T /C /Q
  # The token file is not readable by normal users.
  $config = Join-Path $DataDir 'config.json'
  if (Test-Path $config) { Invoke-Icacls $config /inheritance:r /grant:r "${System}:F" "${Admins}:F" }
}

function Stop-Agent {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  }
  Get-Process -Name 'restro-print-agent' -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and ($_.Path -ieq $Exe) } |
    Stop-Process -Force -ErrorAction SilentlyContinue
}

function Register-Agent {
  if (-not (Test-Path $Exe)) { throw "Agent executable not found: $Exe" }

  $taskAction = New-ScheduledTaskAction -Execute $Exe -Argument '--service' -WorkingDirectory (Split-Path $Exe)
  $triggers = @(
    (New-ScheduledTaskTrigger -AtStartup),
    # Watchdog: start again within 5 minutes if the agent stopped for any reason.
    (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5))
  )
  $settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -Priority 4
  $principal = New-ScheduledTaskPrincipal -UserId 'S-1-5-18' -LogonType ServiceAccount -RunLevel Highest

  Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger $triggers -Settings $settings `
    -Principal $principal -Description 'Relays Restro PRO print jobs to receipt and kitchen printers.' -Force | Out-Null
}

switch ($Action) {
  'install' {
    Stop-Agent
    Protect-DataDir
    Register-Agent
    Start-ScheduledTask -TaskName $TaskName
    Write-Output "Installed and started '$TaskName'."
  }
  'uninstall' {
    Stop-Agent
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
      Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }
    if ($Purge -and (Test-Path $DataDir)) { Remove-Item -Recurse -Force $DataDir }
    Write-Output "Removed '$TaskName'."
  }
  'start' { Start-ScheduledTask -TaskName $TaskName }
  'stop' { Stop-Agent }
  'restart' { Stop-Agent; Start-ScheduledTask -TaskName $TaskName }
  'status' {
    # Works without Administrator rights: the process and log are visible to
    # everyone, only the task itself (owned by SYSTEM) needs an elevated prompt.
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
      [Security.Principal.WindowsBuiltInRole]::Administrator)
    $running = @(Get-Process -Name 'restro-print-agent' -ErrorAction SilentlyContinue).Count -gt 0
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

    if ($task) { $taskText = $task.State }
    elseif ($isAdmin) { $taskText = 'not installed' }
    else { $taskText = 'unknown (run as Administrator to see it)' }
    Write-Output "Background task: $taskText"
    Write-Output ("Agent process:   {0}" -f $(if ($running) { 'running' } else { 'not running' }))

    $log = Join-Path $DataDir 'logs\agent.log'
    if (Test-Path $log) {
      Write-Output "Last log lines ($log):"
      Get-Content $log -Tail 3 | ForEach-Object { Write-Output "  $_" }
    }
    if (-not $running -and $isAdmin -and -not $task) { exit 1 }
  }
}
