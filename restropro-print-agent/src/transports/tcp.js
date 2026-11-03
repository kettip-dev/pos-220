const net = require("net");

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
        socket.end();
      });
    });
    socket.on("close", (hadError) => {
      if (hadError) done(new Error(`Connection to ${host}:${port} closed with a transmission error.`));
      else done();
    });
    socket.on("timeout", () =>
      done(new Error(`Printer ${host}:${port} did not respond within ${timeoutMs}ms. Is it powered on and on this network?`))
    );
    socket.on("error", (err) => done(new Error(`Printer ${host}:${port}: ${err.message}`)));
  });
}

module.exports = { sendTcp };
