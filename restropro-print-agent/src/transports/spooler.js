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
 *     see rawprint-source.js).
 *   - macOS / Linux: CUPS `lp -o raw`.
 * The printer name, file path and C# source are passed as environment
 * variables or argv, never interpolated into a shell command.
 */

const WINDOWS_RAW_PRINT_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
  if ($env:RESTRO_HELPER_DLL) { Add-Type -Path $env:RESTRO_HELPER_DLL } else { Add-Type -TypeDefinition $env:RESTRO_CS_SOURCE }
  [RestroRawPrint]::Send($env:RESTRO_PRINTER_NAME, [System.IO.File]::ReadAllBytes($env:RESTRO_PRINT_FILE))
} catch {
  # One plain line (e.g. "Cannot open printer ...") instead of PowerShell's error block.
  [Console]::Error.WriteLine($_.Exception.GetBaseException().Message)
  exit 1
}
`;

const WINDOWS_LIST_SCRIPT = "Get-CimInstance -ClassName Win32_Printer | ForEach-Object { $_.Name }";

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
    execFile(file, args, { timeout: 30000, windowsHide: true, maxBuffer: 1024 * 1024, ...options }, (err, stdout, stderr) => {
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

async function sendToSpooler(printerName, buffer) {
  const file = path.join(os.tmpdir(), `restro-print-${crypto.randomBytes(8).toString("hex")}.bin`);
  await fs.promises.writeFile(file, buffer);
  try {
    if (process.platform === "win32") {
      const dll = prebuiltHelperDll();
      await powershell(WINDOWS_RAW_PRINT_SCRIPT, {
        RESTRO_PRINTER_NAME: printerName,
        RESTRO_PRINT_FILE: file,
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

/**
 * Names of printers installed on this computer (for the settings UI).
 */
async function listInstalledPrinters() {
  try {
    if (process.platform === "win32") {
      const out = await powershell(WINDOWS_LIST_SCRIPT);
      return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    }
    const out = await run("lpstat", ["-e"]);
    return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  } catch (_) {
    return [];
  }
}

module.exports = { sendToSpooler, listInstalledPrinters };
