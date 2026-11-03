const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");

/**
 * Raw printing through the operating system's print spooler. This covers USB
 * printers (and any other printer with an installed driver) by queue name.
 *   - Windows: winspool WritePrinter with the RAW datatype (via PowerShell).
 *   - macOS / Linux: CUPS `lp -o raw`.
 * The printer name and file path are passed as environment variables or argv,
 * never interpolated into a shell command.
 */

const WINDOWS_RAW_PRINT_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class RestroRawPrint {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool StartDocPrinter(IntPtr handle, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO info);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr handle, byte[] bytes, int count, out int written);

  public static void Send(string printer, byte[] bytes) {
    IntPtr handle;
    if (!OpenPrinter(printer, out handle, IntPtr.Zero))
      throw new Exception("Cannot open printer '" + printer + "' (Win32 error " + Marshal.GetLastWin32Error() + ")");
    try {
      DOCINFO info = new DOCINFO();
      info.pDocName = "Restro POS";
      info.pDataType = "RAW";
      if (!StartDocPrinter(handle, 1, info))
        throw new Exception("StartDocPrinter failed (Win32 error " + Marshal.GetLastWin32Error() + ")");
      try {
        StartPagePrinter(handle);
        int written;
        if (!WritePrinter(handle, bytes, bytes.Length, out written) || written != bytes.Length)
          throw new Exception("WritePrinter failed (Win32 error " + Marshal.GetLastWin32Error() + ")");
        EndPagePrinter(handle);
      } finally {
        EndDocPrinter(handle);
      }
    } finally {
      ClosePrinter(handle);
    }
  }
}
"@
[RestroRawPrint]::Send($env:RESTRO_PRINTER_NAME, [System.IO.File]::ReadAllBytes($env:RESTRO_PRINT_FILE))
`;

const WINDOWS_LIST_SCRIPT = "Get-CimInstance -ClassName Win32_Printer | ForEach-Object { $_.Name }";

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
      await powershell(WINDOWS_RAW_PRINT_SCRIPT, { RESTRO_PRINTER_NAME: printerName, RESTRO_PRINT_FILE: file });
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
