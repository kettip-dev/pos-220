/**
 * Remove the Authenticode signature from a copy of node.exe before the agent
 * is injected into it. Injecting breaks Node's signature anyway, and Windows
 * treats a broken signature worse than none. Sign the final exe with your own
 * certificate instead (build.ps1 -Sign).
 *
 * Usage: node strip-signature.js path\to\file.exe
 */

const fs = require("fs");

const file = process.argv[2];
if (!file) {
  console.error("Usage: node strip-signature.js <file.exe>");
  process.exit(1);
}

const buf = fs.readFileSync(file);
if (buf.readUInt16LE(0) !== 0x5a4d) throw new Error("Not a PE file (missing MZ header).");
const pe = buf.readUInt32LE(0x3c);
if (buf.readUInt32LE(pe) !== 0x00004550) throw new Error("Not a PE file (missing PE signature).");

const optionalHeader = pe + 24;
const magic = buf.readUInt16LE(optionalHeader);
const dataDirs = optionalHeader + (magic === 0x20b ? 112 : 96); // PE32+ : PE32
const securityDir = dataDirs + 4 * 8; // IMAGE_DIRECTORY_ENTRY_SECURITY

const offset = buf.readUInt32LE(securityDir);
const size = buf.readUInt32LE(securityDir + 4);
if (!offset || !size) {
  console.log(`${file}: not signed, nothing to strip.`);
  process.exit(0);
}
if (offset + size !== buf.length) throw new Error("Signature is not at the end of the file; refusing to strip.");

buf.writeUInt32LE(0, securityDir);
buf.writeUInt32LE(0, securityDir + 4);
fs.writeFileSync(file, buf.subarray(0, offset));
console.log(`${file}: removed ${size} byte signature.`);
