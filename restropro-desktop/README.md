# Bong POS Desktop (Windows)

A native Windows app for Bong POS: its own window and taskbar icon, a built-in
print agent, and automatic updates (like VS Code).

```
Bong POS.exe  (Electron)
 ├─ Window → loads the live POS website (default https://pos.allkh.app)
 │            POS screens update on every server deploy: no reinstall needed
 ├─ Built-in print agent (../restropro-print-agent) → LAN 9100 + USB printers
 ├─ Tray icon, start with Windows, kiosk mode, keep screen on
 └─ Auto-update → <POS address>/desktop/latest.yml
```

## What it does

| Feature | Notes |
|---|---|
| Custom title bar | VS Code style: no Windows title bar. A slim bar with ☰ menu, Bong POS name, printer status, "Restart to update" and Settings, with the native minimize/maximize/close buttons. The POS runs in a view below it, so the website needs no changes. Hidden in full screen / kiosk mode |
| Sign in with your browser | Like VS Code: the login screen's "Sign in with your browser" opens `<POS>/desktop-login` in the default browser (Google sign-in and password managers work there). "Open Bong POS" sends a one-time code back through a `bongpos://` link and the app signs in. Codes last 2 minutes, work once, and need a PKCE verifier that never leaves the app |
| Full screen | Title-bar button or F11. Only a thin handle stays at the top: hover or tap it to bring the bar back (with an exit button); it hides again by itself, so touch screens never get stuck. Remembered for the next launch (also in Settings) |
| Native window | Remembers size/position, single instance, Ctrl+Shift+K kiosk mode, Ctrl +/- zoom (saved) |
| Always the newest POS | On each launch (when online) the cached PWA bundle is dropped, so a deploy never needs Ctrl+Shift+R. Sign-in is kept. Ctrl+Shift+R = clear cache and reload |
| Offline screen | If the server cannot be reached and nothing is cached, a "Can't reach Bong POS" page retries every 15 s |
| Sounds | New-order / kitchen sounds play without a tap first |
| Built-in print agent | Settings → paste an `rpa_...` token (Thermal Printers → Print Agents → Add Agent). Runs in its own process and restarts if it crashes. While it is on, closing the window keeps printing from the tray |
| Printer Tools | Menu → Printer Tools (Ctrl+Shift+P), the agent's page on http://localhost:17172 (the standalone agent uses 17171, so both can be installed) |
| Auto-update | Checks 15 s after launch and every 4 h, downloads in the background, asks "Restart now / Later", otherwise installs silently when the app closes |
| `window.bongDesktop` | The POS website can detect the app: `{ isDesktop, version, platform, printAgent }` |

Settings: `%APPDATA%\Bong POS\settings.json`. Logs: `%APPDATA%\Bong POS\logs\desktop.log`
and `%APPDATA%\Bong POS\print-agent\logs\agent.log`.

> Use one agent token per computer. If this PC already runs the standalone print
> agent, either leave the built-in agent off or uninstall the standalone one.

## Develop

```bash
cd restropro-desktop
npm install          # also downloads Electron
npm start            # opens https://pos.allkh.app
npm run dev          # opens http://localhost:5173 (local Vite) for this run only
```

## Build and release

Requirements: Windows x64, Node.js 20+.

```bash
npm run dist         # → dist/Bong-POS-Setup-<version>.exe + .blockmap + latest.yml
```

Release a new version to every installed app:

```powershell
npm run release -- -Version 1.0.1
# other server:  powershell -File scripts\release.ps1 -Version 1.0.1 -Server root@host -RemoteDir /opt/restro-pos/desktop-releases
```

The script builds and uploads to `/opt/restro-pos/desktop-releases` on the server, which
nginx serves at `https://pos.allkh.app/desktop/`. It uploads `latest.yml` last, so apps
never see a half-uploaded version. New installs can always download
`https://pos.allkh.app/desktop/Bong-POS-Setup.exe`.

The version must go up (semver) or apps will not update. Updates are per POS server: an app
pointed at another server checks that server's `/desktop/` folder.

### One-time server setup

`docker-compose.prod.yml` mounts `./desktop-releases` into the frontend container and
`default.conf` serves it at `/desktop/`. After deploying those two changes once
(`./deploy.sh deploy`), releases only need `npm run release`, with no frontend rebuild.

### Code signing

Unsigned installers work but Windows SmartScreen shows "Windows protected your PC" the first
time. To sign, set `CSC_LINK` (path to a `.pfx`) and `CSC_KEY_PASSWORD` before
`npm run dist` / `npm run release`. Azure Trusted Signing or an OV/EV certificate both work.
