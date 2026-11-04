/**
 * Small ESC/POS documents the agent prints itself (printer tools / support).
 * Real receipts and kitchen tickets are built by the POS and arrive ready-made.
 */

const ESC = 0x1b;
const GS = 0x1d;

const ascii = (text) => Buffer.from(String(text).replace(/[^\x20-\x7e\n]/g, "?"), "latin1");

/**
 * A short test page: proves the printer receives data, prints text in both
 * sizes and cuts. Fits 58 mm and 80 mm paper.
 */
function buildTestPage({ printerLabel, hostname, version }) {
  const now = new Date();
  const stamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
  return Buffer.concat([
    Buffer.from([ESC, 0x40]), // initialise
    Buffer.from([ESC, 0x61, 1]), // centre
    Buffer.from([GS, 0x21, 0x11]), // double width + height
    ascii("RESTRO PRO\n"),
    Buffer.from([GS, 0x21, 0x00]),
    ascii("Printer test\n"),
    ascii("--------------------------------\n"),
    Buffer.from([ESC, 0x61, 0]), // left
    ascii(`Printer : ${printerLabel}\n`),
    ascii(`Computer: ${hostname}\n`),
    ascii(`Time    : ${stamp}\n`),
    ascii(`Agent   : v${version}\n`),
    ascii("--------------------------------\n"),
    ascii("0123456789 ABCDEFGHIJ abcdefghij\n"),
    Buffer.from([ESC, 0x45, 1]),
    ascii("Bold text\n"),
    Buffer.from([ESC, 0x45, 0]),
    Buffer.from([ESC, 0x61, 1]),
    ascii("\nIf you can read this,\nprinting works.\n"),
    Buffer.from([ESC, 0x64, 4]), // feed 4 lines
    Buffer.from([GS, 0x56, 66, 0]), // feed and partial cut
  ]);
}

/** Pulse the cash drawer connected to the printer's RJ11 port (pin 2, then pin 5). */
function buildDrawerKick() {
  return Buffer.from([ESC, 0x40, ESC, 0x70, 0, 25, 250, ESC, 0x70, 1, 25, 250]);
}

module.exports = { buildTestPage, buildDrawerKick };
