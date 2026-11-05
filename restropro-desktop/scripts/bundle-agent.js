/**
 * Bundles ../restropro-print-agent into build/agent/agent.cjs (one file, no
 * node_modules) so the desktop app can run it in its own Node process.
 * On Windows it also compiles RestroRawPrint.dll, so USB printing does not
 * compile C# on every job.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const agentRoot = path.join(root, "..", "restropro-print-agent");
const outDir = path.join(root, "build", "agent");

async function main() {
  if (!fs.existsSync(path.join(agentRoot, "src", "index.js"))) {
    throw new Error(`Print agent source not found at ${agentRoot}`);
  }
  if (!fs.existsSync(path.join(agentRoot, "node_modules", "socket.io-client"))) {
    console.log("Installing print agent dependencies...");
    execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["ci", "--no-audit", "--no-fund", "--omit=dev"], {
      cwd: agentRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
  }

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  await require("esbuild").build({
    entryPoints: [path.join(agentRoot, "src", "index.js")],
    outfile: path.join(outDir, "agent.cjs"),
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    // ws (used by socket.io-client) optionally loads these native add-ons and works without them.
    external: ["bufferutil", "utf-8-validate"],
    logLevel: "warning",
  });
  console.log(`Bundled print agent -> ${path.relative(root, path.join(outDir, "agent.cjs"))}`);

  if (process.platform === "win32") {
    const { CS_SOURCE, DLL_NAME } = require(path.join(agentRoot, "src", "transports", "rawprint-source"));
    const csFile = path.join(outDir, "RestroRawPrint.cs");
    const dllFile = path.join(outDir, DLL_NAME);
    fs.writeFileSync(csFile, CS_SOURCE);
    const winPowerShell = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    try {
      // Windows PowerShell 5.1 builds a .NET Framework assembly, which loads on every Windows 10/11 PC.
      execFileSync(
        winPowerShell,
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "$ErrorActionPreference='Stop'; Add-Type -TypeDefinition (Get-Content -Raw $env:CS_FILE) -OutputAssembly $env:DLL_FILE -OutputType Library",
        ],
        { env: { ...process.env, CS_FILE: csFile, DLL_FILE: dllFile }, stdio: "inherit", windowsHide: true }
      );
      console.log(`Compiled ${DLL_NAME}`);
    } catch (err) {
      console.warn(`Could not compile ${DLL_NAME} (${err.message}). USB printing still works, a little slower.`);
    } finally {
      fs.rmSync(csFile, { force: true });
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
