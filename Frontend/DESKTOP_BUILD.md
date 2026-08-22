# YMS Yard Twin — Desktop Build (Tauri)

The web build is untouched. Desktop is an additive packaging on top of the
same Vite output, talking to the **same backend APIs**.

## Why Tauri (over Electron)

| Concern | Electron | Tauri 2.x |
|---|---|---|
| Installer size | 80–150 MB | 8–15 MB |
| Cold start | 1.5–3 s | < 0.5 s |
| Engine | Bundled Chromium | OS-native WebView2 (Edge engine) |
| RAM idle | 200–400 MB | 60–120 MB |
| GPU acceleration | Yes | Yes (same Chromium GPU path) |
| Auto-update | Built-in | Built-in (plugin) |

WebView2 ships with every supported Windows 10/11, so users don't install
a browser engine — and the Three.js + react-three-fiber stack runs
unchanged because WebView2 *is* a Chromium runtime.

## Zero-dependency installer (default in this repo)

`tauri.conf.json` is set to:

```jsonc
"webviewInstallMode": { "type": "offlineInstaller", "silent": true }
```

This **embeds the entire WebView2 runtime inside the .exe**, so the end
user double-clicks the installer on a brand-new Windows machine and
gets:

- No internet required during install.
- No prerequisite popup ("download WebView2…").
- No Visual C++ Redistributable popup (Tauri's Rust binary is statically linked).
- No .NET prompt.

Trade-off: the installer is ~150 MB instead of ~10 MB. Acceptable for an
internal enterprise app where end users should not be asked to install
anything else.

If you ever want the smaller download for users on already-patched
Win10/11, switch to:

```jsonc
"webviewInstallMode": { "type": "downloadBootstrapper" }
```

## One-time prerequisites (on the build machine)

1. **Rust** — https://rustup.rs (any recent stable).
2. **WebView2 runtime** — already on Win10/11; only needed for older boxes.
3. **Microsoft C++ Build Tools** — Visual Studio Installer → "Desktop development with C++".
4. `npm install` from `Frontend/` (already done if you ran the web build).
5. Icons — drop your `icon.ico` etc. into `src-tauri/icons/` (see the README inside).
6. *(Optional)* `npx @tauri-apps/cli icon path/to/source-1024.png` generates every size in one shot.

## Develop

```sh
cd Frontend
npm run tauri:dev
```

This boots Vite dev server on :5173 AND opens a Tauri window pointed at
it. Hot-reload works exactly like the web build.

## Build a Windows installer

```sh
cd Frontend
npm run tauri:build:win
```

Output:

```
Frontend/src-tauri/target/release/bundle/
├── msi/YMS Yard Twin_1.0.0_x64_en-US.msi
└── nsis/YMS Yard Twin_1.0.0_x64-setup.exe
```

Rename / sign / upload the `.exe` to your CDN (or to `Frontend/public/downloads/`).

## "Download Desktop App" button

The web build shows the button automatically. To control where it points:

```sh
# In .env or .env.production
VITE_DESKTOP_INSTALLER_URL=https://cdn.example.com/yms-yard-twin-setup.exe
```

Default fallback is `/downloads/yms-yard-twin-setup.exe`.

## What the desktop client gets that the browser cannot

- Hardware-accelerated rendering on the actual WebView2 GPU process.
- No browser tab chrome / no cross-origin annoyances.
- No service worker needed — assets are local from install.
- Optional native menu, system tray, file system access (off by default).
- A clean `X-Client: desktop-tauri` user-agent / header signal.

## Detecting the runtime at code level

```js
import { IS_TAURI, CLIENT_KIND } from "src/utils/desktopRuntime";
if (IS_TAURI) { /* desktop-only feature */ }
```

## Backend impact

**None.** All HTTP calls go to the same hosts the web build uses. The
desktop runtime adds no auth, no separate token, no native gateway.
