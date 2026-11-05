# Bong POS Print Agent

The cloud POS cannot open a connection to a printer inside your restaurant
(`192.168.x.x` only exists on your local network). The print agent runs on a
computer **inside** the restaurant, keeps an outbound connection to the Bong POS
server, and prints receipts and kitchen tickets on:

- **Network printers** (LAN / Wi-Fi, RAW port 9100–9109)
- **USB printers** and any other printer installed in the operating system
  (Windows print spooler, or CUPS on macOS / Linux)

If the agent goes offline, jobs are queued on the server and printed when it
reconnects. Jobs older than 15 minutes expire, so staff never get stale kitchen tickets.

## Requirements

- An always-on computer on the same network as the printers (Windows PC, mini PC,
  Mac, or Raspberry Pi)
- Windows 10/11 (64-bit) with the installer below, **or** Node.js 18+ on any OS

## Windows: one-click installer (recommended)

1. In Bong POS, open **Settings → Thermal Printers → Print Agents**, click
   **Add Agent** and copy the token.
2. Run `RestroPrintAgent-Setup-<version>.exe` on the restaurant PC, enter the POS
   address and paste the token. The installer checks the connection before it
   installs.
3. Done. The agent runs in the background as SYSTEM, starts at boot before anyone
   logs in, and is restarted within 5 minutes if it ever stops. Nothing else
   (Node.js, npm, pm2) is needed.

| What | Where |
|---|---|
| Program | `C:\Program Files\Bong POS Print Agent\` |
| Settings (token) | `C:\ProgramData\RestroPrintAgent\config.json` (Administrators only) |
| Log | `C:\ProgramData\RestroPrintAgent\logs\agent.log` (Start menu → **View print agent log**) |
| Background task | Task Scheduler → **Bong POS Print Agent** |

### Printer Tools

While the agent runs, open **Start menu → Bong POS Printer Tools** (or
http://localhost:17171 on that computer). It shows:

- **Agent status:** connected or offline, POS server, last problem
- **USB / installed printers:** the exact names to use in POS, with **Test print**
  and **Drawer** (open cash drawer) buttons
- **Network printer:** check an IP is reachable, print a test page, open the drawer
- **Find network printers:** scans this computer's network for port 9100 printers
- **Recent print jobs** and the **log** (with a Copy button for support)

The page is only reachable from this computer and never shows the token. The same
tools work from the command line:

```bat
restro-print-agent.exe --scan                        :: find network printers
restro-print-agent.exe --check 192.168.1.200         :: is it reachable?
restro-print-agent.exe --test-print 192.168.1.200    :: test page (IP[:port] or installed printer name)
restro-print-agent.exe --test-print "EPSON TM-T82"
restro-print-agent.exe --drawer 192.168.1.200        :: open the cash drawer
```

Other useful commands (in an Administrator terminal, from the program folder):

```bat
restro-print-agent.exe --test                      :: check address + token
restro-print-agent.exe --configure --token rpa_... :: replace the token, then:
powershell -ExecutionPolicy Bypass -File service.ps1 restart
restro-print-agent.exe --list-printers
```

Install on many PCs without the wizard:

```bat
RestroPrintAgent-Setup-1.0.0.exe /VERYSILENT /SERVER=https://pos.example.com /TOKEN=rpa_xxx
```

Running the installer again upgrades the agent and keeps its settings.

> **Shared printers:** the agent runs as SYSTEM, so it sees printers installed for
> the whole computer (normal USB / network printers). A printer added only for one
> Windows user (for example `\\OTHER-PC\Printer`) is not visible to it. Install it
> as a local printer instead.

### Building the installer

On a Windows x64 PC with Node.js 20+ and [Inno Setup 6](https://jrsoftware.org/isinfo.php):

```bash
npm run build:win
# or, to pre-fill your POS address and sign the files:
powershell -ExecutionPolicy Bypass -File installer/build.ps1 -DefaultServer https://pos.example.com -Sign
```

Output in `dist/`: `restro-print-agent.exe` (Node.js built in), `RestroRawPrint.dll`
and `RestroPrintAgent-Setup-<version>.exe`. The version comes from `package.json`.
Sign the release files with a code-signing certificate (`-Sign`), or Windows
SmartScreen warns users that the publisher is unknown.

## Setup from source (any OS)

1. In Bong POS, open **Settings → Thermal Printers → Print Agents** and click
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

Windows: use the installer above; it sets this up for you.

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
| Agent shows **Offline** in settings | Check the agent's console (Windows installer: `agent.log`) and that this computer can open the POS website. |
| `The server closed this connection … another agent started with the same token` | The same token is used on two computers. Give each computer its own agent. |
