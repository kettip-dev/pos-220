/**
 * C# helper that sends raw bytes to a Windows printer queue through winspool
 * (WritePrinter with the RAW datatype). The Windows build compiles it once
 * into RestroRawPrint.dll next to the exe; when running from source it is
 * compiled on the fly by PowerShell's Add-Type.
 */

const CS_SOURCE = `
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
  public static extern int StartDocPrinter(IntPtr handle, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO info);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr handle, byte[] bytes, int count, out int written);

  // Returns the Windows print job id, so the caller can follow the job in the queue.
  public static int Send(string printer, byte[] bytes) {
    IntPtr handle;
    if (!OpenPrinter(printer, out handle, IntPtr.Zero))
      throw new Exception("Cannot open printer '" + printer + "' (Win32 error " + Marshal.GetLastWin32Error() + ")");
    try {
      DOCINFO info = new DOCINFO();
      info.pDocName = "Restro POS";
      info.pDataType = "RAW";
      int jobId = StartDocPrinter(handle, 1, info);
      if (jobId == 0)
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
      return jobId;
    } finally {
      ClosePrinter(handle);
    }
  }
}
`;

module.exports = { CS_SOURCE, DLL_NAME: "RestroRawPrint.dll" };
