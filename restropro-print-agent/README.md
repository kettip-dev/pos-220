# Restro PRO Print Agent

The cloud POS cannot open a connection to a printer inside your restaurant
(`192.168.x.x` only exists on your local network). The print agent runs on a
computer **inside** the restaurant, keeps an outbound connection to the Restro
server, and prints receipts and kitchen tickets on:

- **Network printers** (LAN / Wi-Fi, RAW port 9100–9109)
- **USB printers** and any other printer installed in the operating system
  (Windows print spooler, or CUPS on macOS / Linux)

If the agent goes offline, jobs are queued on the server and printed when it
reconnects. Jobs older than 15 minutes expire, so staff never get stale kitchen tickets.

## Requirements

- An always-on computer on the same network as the printers (Windows PC, mini PC,
  Mac, or Raspberry Pi)
- Node.js 18 or newer

## Setup

1. In Restro PRO, open **Settings → Thermal Printers → Print Agents** and click
   **Add Agent**. Copy the token (it is shown only once).
2. On the restaurant computer:

   ```bash
   cd restropro-print-agent
   npm install --omit=dev
   node src/index.js --server https://your-pos-domain --token rpa_xxxxxxxx
   ```

   The server URL and token are saved to `config.json`, so later runs only need
   `npm start`.
3. Back in **Thermal Printers**, edit each printer and set **Print via** to this agent.
   - Network printer: enter its IP, e.g. `192.168.1.200` and port `9100`.
   - USB printer: choose **USB / Installed** and select the printer name the
     agent reports (or run `npm run list-printers` on the agent computer).
4. Click **Test Print**.

## Run automatically at startup

Windows (using [pm2](https://pm2.keymetrics.io/)):

```bash
npm install -g pm2 pm2-windows-startup
pm2 start src/index.js --name restro-print-agent
pm2 save
pm2-startup install
```

Linux / Raspberry Pi:

```bash
npm install -g pm2
pm2 start src/index.js --name restro-print-agent
pm2 save
pm2 startup
```

## Security

- The token identifies this agent to your restaurant only. Keep `config.json`
  private; if a token leaks, use **Regenerate token** in settings.
- The agent only sends data to private LAN addresses (10.x, 172.16–31.x,
  192.168.x, 100.64–127.x) on ports 9100–9109, or to printers installed on this
  computer.

## Troubleshooting

| Message | Fix |
|---|---|
| `The agent token was rejected` | Create or regenerate the token and run again with `--token`. |
| `did not respond within 5000ms` | Printer is off, on another network, or has a different IP. Print its self-test page to check the IP. |
| `Cannot open printer '…'` | The USB printer name does not match. Run `npm run list-printers`. |
| Agent shows **Offline** in settings | Check the agent's console and that this computer can open the POS website. |
