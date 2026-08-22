// "Download Desktop App" UI. Hidden when already running inside Tauri.
// Two variants exported so callers can drop the right one into either a
// toolbar or a settings panel.

import React from "react";
import { FiDownload, FiMonitor } from "react-icons/fi";
import { IS_TAURI, DESKTOP_INSTALLER_URL } from "../../../utils/desktopRuntime";

export function DesktopBadge() {
  if (!IS_TAURI) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold
                     bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
      <FiMonitor size={10} /> DESKTOP
    </span>
  );
}

export default function DownloadDesktopApp({ compact = false, className = "" }) {
  if (IS_TAURI) return null;
  const href = DESKTOP_INSTALLER_URL;
  if (compact) {
    return (
      <a
        href={href}
        download
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                    bg-cyan-500/15 text-cyan-300 border border-cyan-500/40
                    hover:bg-cyan-500/25 transition ${className}`}
        title="Download the desktop version (Windows)"
      >
        <FiDownload size={12} />
        Desktop App
      </a>
    );
  }
  return (
    <a
      href={href}
      download
      className={`group flex items-center gap-3 p-3 rounded-xl
                  bg-gradient-to-r from-cyan-600/20 to-blue-600/20
                  border border-cyan-500/30 hover:border-cyan-400/60 transition ${className}`}
    >
      <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
        <FiDownload size={20} className="text-cyan-300" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white">Download Desktop App</div>
        <div className="text-[11px] text-cyan-200/80">
          Windows installer · hardware accelerated · offline ready
        </div>
      </div>
    </a>
  );
}
