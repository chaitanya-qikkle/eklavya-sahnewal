// DOM camera-mode switcher + live route progress bar. Mount this in the
// page (NOT inside <Canvas>) wherever you want it to float.

import React from "react";
import { useNavigation, CAM_MODES } from "./navStore";

const LABELS = {
  third: "Third-person",
  first: "First-person",
  free:  "Free camera",
};

const ICONS = {
  third: "👤",
  first: "👁",
  free:  "🛰",
};

export function CameraSwitcher({ className = "" }) {
  const mode = useNavigation(s => s.cameraMode);
  const setMode = useNavigation(s => s.setCameraMode);
  return (
    <div className={`flex items-center gap-1 p-1 rounded-full bg-slate-900/80 backdrop-blur border border-slate-700 shadow-lg ${className}`}>
      {CAM_MODES.map(m => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
            mode === m
              ? "bg-cyan-500 text-slate-950 shadow"
              : "text-slate-300 hover:bg-slate-700/60"
          }`}
          title={LABELS[m]}
        >
          <span className="mr-1">{ICONS[m]}</span>{LABELS[m]}
        </button>
      ))}
    </div>
  );
}

export function RouteProgress({ className = "" }) {
  const progress = useNavigation(s => s.progress);
  const total    = useNavigation(s => s.totalDist);
  const walking  = useNavigation(s => s.walking);
  const arrived  = useNavigation(s => s.arrived);
  if (!walking && !arrived && progress <= 0) return null;
  const pct = Math.round(progress * 100);
  const m = Math.round(total * (1 - progress));
  return (
    <div className={`rounded-xl bg-slate-900/85 backdrop-blur border border-slate-700 shadow-lg px-3 py-2 text-slate-100 text-xs ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium">{arrived ? "Arrived" : "Walking to destination"}</span>
        <span className="text-cyan-300 tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all"
             style={{ width: `${pct}%` }} />
      </div>
      {!arrived && total > 0 && (
        <div className="mt-1 text-[10px] text-slate-400 tabular-nums">{m} m remaining</div>
      )}
    </div>
  );
}
