const net = require("net");

// Socket error codes mapped to hints a restaurant manager can act on.
const ERROR_HINTS = {
  ECONNREFUSED: "connection refused. The device at this IP is not accepting print jobs on this port; check the printer's IP and port (usually 9100).",
  EHOSTUNREACH: "printer not reachable. Check that it is powered on and on the same network as this computer.",
  ENETUNREACH: "network unreachable. Check this computer's network connection.",
  ETIMEDOUT: "connection timed out. Check that the printer is powered on and on this network.",
  ECONNRESET: "the printer closed the connection. It may be busy or out of paper; try again.",
};

function friendlyError(err) {
  return ERROR_HINTS[err.code] || err.message;
}

/**
 * Send raw ESC/POS bytes to a network printer (RAW / JetDirect, port 9100).
 */
function sendTcp(host, port, buffer, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const socket = new net.Socket();
    const done = (err) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      err ? reject(err) : resolve();
    };

    socket.setTimeout(timeoutMs);
    socket.connect(port, host, () => {
      socket.write(buffer, (err) => {
        if (err) return done(new Error(`Failed writing to printer ${host}:${port}: ${err.message}`));
        // Many LAN printer interfaces discard their unread buffer when the
        // connection closes: closing right after a large raster ticket loses
        // its tail (the cut command). Give the printer time to take it all in
        // (assume a slow printer reads ~40 KB/s).
        const linger = Math.min(8000, 300 + Math.ceil(buffer.length / 40));
        socket.setTimeout(timeoutMs + linger);
        setTimeout(() => {
          if (!finished) socket.end();
        }, linger);
      });
    });
    socket.on("close", (hadError) => {
      if (hadError) done(new Error(`Connection to ${host}:${port} closed with a transmission error.`));
      else done();
    });
    socket.on("timeout", () =>
      done(new Error(`Printer ${host}:${port} did not respond within ${timeoutMs}ms. Is it powered on and on this network?`))
    );
    socket.on("error", (err) => done(new Error(`Printer ${host}:${port}: ${friendlyError(err)}`)));
  });
}

module.exports = { sendTcp };
