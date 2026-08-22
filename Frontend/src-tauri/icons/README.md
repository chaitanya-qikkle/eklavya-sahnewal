# Tauri icons

Drop the following files in this directory before running `npm run tauri:build`:

- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.ico` (Windows installer + window icon)
- `icon.icns` (macOS, not strictly required for Windows EXE build)
- `icon.png` (tray icon, 256x256 recommended)

Quickest way to generate every size from one source PNG:

```sh
npx @tauri-apps/cli icon path/to/source-1024.png
```

The CLI writes outputs straight into this folder.
