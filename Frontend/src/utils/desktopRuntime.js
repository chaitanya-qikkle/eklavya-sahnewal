// Runtime helpers for Web vs Tauri Desktop. No backend changes needed —
// same APIs are used regardless of client.

export const IS_TAURI = typeof window !== "undefined" && (
  // Tauri 2.x exposes window.__TAURI_INTERNALS__ on bootstrap
  !!window.__TAURI_INTERNALS__ ||
  !!window.__TAURI__ ||
  /YMSYardTwin\//.test(navigator.userAgent || "")
);

export const CLIENT_KIND = IS_TAURI ? "desktop-tauri" : "web";

// Stable identifier the backend can log if you want to discriminate
// desktop sessions later. Adds zero cost on web.
export const CLIENT_HEADER = {
  "X-Client": CLIENT_KIND,
};

export function registerOfflineSW() {
  if (IS_TAURI) return;                  // desktop already has local files
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[YMS] offline SW registration failed:", err);
    });
  });
}

// Where to download the desktop installer from. Replace with your CDN
// URL after running `npm run tauri:build:win` and uploading the .exe.
export const DESKTOP_INSTALLER_URL =
  import.meta.env.VITE_DESKTOP_INSTALLER_URL ||
  "/downloads/yms-yard-twin-setup.exe";
