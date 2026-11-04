const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { CS_SOURCE, DLL_NAME } = require("./rawprint-source");
const { installDir } = require("../paths");

/**
 * Raw printing through the operating system's print spooler. This covers USB
 * printers (and any other printer with an installed driver) by queue name.
 *   - Windows: winspool WritePrinter with the RAW datatype (via PowerShell,
 *     see rawprint-source.js), then the job is followed in the Windows queue
 *     until the printer has taken it.
 *   - macOS / Linux: CUPS `lp -o raw`.
 * The printer name, file path and C# source are passed as environment
 * variables or argv, never interpolated into a shell command.
 */

// How long a job may sit in the Windows queue before we call it failed.
const JOB_TIMEOUT_SECONDS = 20;

const WINDOWS_RAW_PRINT_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
  if ($env:RESTRO_HELPER_DLL) { Add-Type -Path $env:RESTRO_HELPER_DLL } else { Add-Type -TypeDefinition $env:RESTRO_CS_SOURCE }
  $name = $env:RESTRO_PRINTER_NAME
  $jobId = [RestroRawPrint]::Send($name, [System.IO.File]::ReadAllBytes($env:RESTRO_PRINT_FILE))

  # "Accepted by Windows" is not "printed": wait until the job leaves the queue
  # (handed to the printer). If the printer is off, out of paper or stuck, remove
  # the job so a retry from the POS cannot print it twice later.
  $deadline = (Get-Date).AddSeconds([int]$env:RESTRO_JOB_TIMEOUT)
  while ($true) {
    $job = Get-PrintJob -PrinterName $name -ID $jobId -ErrorAction SilentlyContinue
    if (-not $job) { break }
    $status = [string]$job.JobStatus
    if ($status -match 'Printed|Complete') { break }
    $failed = $status -match 'Error|Offline|PaperOut|Blocked|UserIntervention|Paused'
    if ($failed -or (Get-Date) -gt $deadline) {
      $printerStatus = (Get-Printer -Name $name -ErrorAction SilentlyContinue).PrinterStatus
      # A job Windows is still sending takes a moment to cancel; wait for it to go.
      Remove-PrintJob -PrinterName $name -ID $jobId -ErrorAction SilentlyContinue
      $gone = $false
      for ($i = 0; $i -lt 40 -and -not $gone; $i++) {
        Start-Sleep -Milliseconds 250
        $gone = -not (Get-PrintJob -PrinterName $name -ID $jobId -ErrorAction SilentlyContinue)
        if (-not $gone -and $i % 8 -eq 7) { Remove-PrintJob -PrinterName $name -ID $jobId -ErrorAction SilentlyContinue }
      }
      $why = if ($failed) { "the printer reported: $status" } else { "the printer did not take it within $($env:RESTRO_JOB_TIMEOUT)s ($status)" }
      $cleanup = if ($gone) { "The job was removed from the Windows queue." } else { "Windows is still cancelling the job; delete it from the printer queue if it prints later." }
      throw "Windows could not print the job: $why. Printer status: $printerStatus. $cleanup Check the printer is on, connected and has paper."
    }
    Start-Sleep -Milliseconds 250
  }
  exit 0
} catch {
  # One plain line (e.g. "Cannot open printer ...") instead of PowerShell's error block.
  [Console]::Error.WriteLine($_.Exception.GetBaseException().Message)
  exit 1
}
`;

const WINDOWS_LIST_SCRIPT =
  "ConvertTo-Json -Compress -InputObject @(Get-CimInstance -ClassName Win32_Printer | Select-Object Name, PortName, DriverName, WorkOffline)";

// Printers that save to a file or an app instead of printing on paper. Raw
// receipt data sent to them is lost (Print to PDF even waits for a "Save as"
// dialog that a background service can never show).
const VIRTUAL_PORT = /^(PORTPROMPT:|nul:?|FILE:|XPSPort:|SHRFAX:.*|Microsoft\.Office\.OneNote.*|OneNote.*)$/i;
const VIRTUAL_DRIVER = /\bPDF\b|XPS|OneNote|\bFax\b|Document Writer|Image Writer/i;

function isVirtualPrinter({ port, driver }) {
  return VIRTUAL_PORT.test(String(port || "").trim()) || VIRTUAL_DRIVER.test(String(driver || ""));
}

// Prebuilt helper shipped next to the installed exe (Program Files, writable
// only by Administrators). Loading it skips compiling C# on every USB print.
let helperDll;
function prebuiltHelperDll() {
  if (helperDll === undefined) {
    const dir = installDir();
    const candidate = dir ? path.join(dir, DLL_NAME) : null;
    helperDll = candidate && fs.existsSync(candidate) ? candidate : null;
  }
  return helperDll;
}

function run(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: 60000, windowsHide: true, maxBuffer: 1024 * 1024, ...options }, (err, stdout, stderr) => {
      if (err) {
        const detail = String(stderr || "").trim().split(/\r?\n/).filter(Boolean).pop() || err.message;
        return reject(new Error(detail));
      }
      resolve(String(stdout || ""));
    });
  });
}

function powershell(script, env = {}) {
  return run("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
    env: { ...process.env, ...env },
  });
}

/**
 * Printers installed on this computer, with details:
 *   [{ name, port, driver, virtual, offline }]
 */
async function listInstalledPrinterDetails() {
  try {
    if (process.platform === "win32") {
      const out = (await powershell(WINDOWS_LIST_SCRIPT)).trim();
      const rows = out ? JSON.parse(out) : [];
      return (Array.isArray(rows) ? rows : [rows])
        .filter((r) => r && r.Name)
        .map((r) => {
          const printer = { name: String(r.Name), port: r.PortName || "", driver: r.DriverName || "", offline: Boolean(r.WorkOffline) };
          return { ...printer, virtual: isVirtualPrinter(printer) };
        });
    }
    const out = await run("lpstat", ["-e"]);
    return out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name, port: "", driver: "", offline: false, virtual: false }));
  } catch (_) {
    return [];
  }
}

/**
 * Names of the real (paper) printers installed on this computer, for the POS
 * settings. Virtual printers (PDF, XPS, OneNote, Fax) are left out.
 */
async function listInstalledPrinters() {
  return (await listInstalledPrinterDetails()).filter((p) => !p.virtual).map((p) => p.name);
}

// Cached details, so every USB job does not list all printers first.
let detailsCache = { at: 0, list: [] };
async function findPrinterDetails(name) {
  const lookup = (list) => list.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (Date.now() - detailsCache.at < 60000) {
    const hit = lookup(detailsCache.list);
    if (hit) return hit;
  }
  detailsCache = { at: Date.now(), list: await listInstalledPrinterDetails() };
  return lookup(detailsCache.list) || null;
}

async function sendToSpooler(printerName, buffer) {
  if (process.platform === "win32") {
    const details = await findPrinterDetails(printerName);
    if (details?.virtual) {
      throw new Error(
        `Installed printer "${printerName}" is a virtual printer (it saves to a file or an app, it does not print on paper). ` +
          "Choose your receipt or kitchen printer instead."
      );
    }
  }

  const file = path.join(os.tmpdir(), `restro-print-${crypto.randomBytes(8).toString("hex")}.bin`);
  await fs.promises.writeFile(file, buffer);
  try {
    if (process.platform === "win32") {
      const dll = prebuiltHelperDll();
      await powershell(WINDOWS_RAW_PRINT_SCRIPT, {
        RESTRO_PRINTER_NAME: printerName,
        RESTRO_PRINT_FILE: file,
        RESTRO_JOB_TIMEOUT: String(JOB_TIMEOUT_SECONDS),
        ...(dll ? { RESTRO_HELPER_DLL: dll } : { RESTRO_CS_SOURCE: CS_SOURCE }),
      });
    } else {
      await run("lp", ["-d", printerName, "-o", "raw", file]);
    }
  } catch (err) {
    throw new Error(`Installed printer "${printerName}": ${err.message}`);
  } finally {
    fs.promises.unlink(file).catch(() => {});
  }
}

module.exports = { sendToSpooler, listInstalledPrinters, listInstalledPrinterDetails, isVirtualPrinter };
