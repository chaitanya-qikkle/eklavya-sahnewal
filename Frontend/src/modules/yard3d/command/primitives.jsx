// Light-theme primitives for the Yard Command Center.
// Visual rhythm matches AdminDashboard cards: white→pale-blue gradient,
// soft hairline borders, indigo-tinted shadow.

import React from "react";
import { T } from "./theme";

export const Dot = ({ color, pulse, size = 8 }) => (
  <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
    {pulse && (
      <span
        className="absolute inset-0 rounded-full opacity-70 animate-ping"
        style={{ background: color }}
      />
    )}
    <span
      className="relative inline-block rounded-full"
      style={{ width: size, height: size, background: color }}
    />
  </span>
);

export const Panel = ({ title, icon: Icon, accent = T.cyan, right, children, className = "", noPad }) => (
  <div
    className={`rounded-2xl overflow-hidden flex flex-col ${className}`}
    style={{ background: T.cardSoft, border: `1px solid ${T.border}`, boxShadow: T.shadow }}
  >
    {(title || right) && (
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: T.border }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}20` }}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={2.4} />
            </div>
          )}
          <div
            className="text-[11px] font-black uppercase tracking-[0.15em] truncate"
            style={{ color: T.text }}
          >
            {title}
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    )}
    <div className={noPad ? "flex-1 min-h-0" : "flex-1 p-4 min-h-0"}>{children}</div>
  </div>
);

export const SectionLabel = ({ children, action, accent = T.textMute }) => (
  <div className="flex items-center justify-between mb-2">
    <div
      className="text-[10px] font-bold uppercase tracking-[0.22em]"
      style={{ color: accent }}
    >
      {children}
    </div>
    {action}
  </div>
);

export const KpiTile = ({ icon: Icon, value, label, accent = T.cyan, sub }) => (
  <div
    className="relative rounded-xl border px-3 py-2.5 overflow-hidden"
    style={{
      background: T.cardSoft,
      borderColor: T.border,
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}
  >
    <div
      className="absolute -right-8 -top-8 w-24 h-24 rounded-full opacity-[0.06] blur-2xl pointer-events-none"
      style={{ background: accent }}
    />
    <div className="absolute top-0 left-0 right-0 h-[2px]"
      style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }} />
    <div className="relative flex items-start gap-2.5">
      {Icon && (
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}25` }}
        >
          <Icon size={15} strokeWidth={2.2} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div
          className="text-[22px] font-black font-mono tabular-nums leading-none tracking-tight"
          style={{ color: T.text }}
        >
          {value}
        </div>
        <div
          className="text-[10px] font-black uppercase tracking-[0.18em] mt-1 truncate"
          style={{ color: T.textDim }}
        >
          {label}
        </div>
        {sub && (
          <div className="text-[10px] mt-0.5 truncate" style={{ color: T.textMute }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  </div>
);

export const PillRow = ({ color, label, count, active, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-left border"
    style={{
      background: active ? `${color}14` : T.card,
      borderColor: active ? `${color}66` : T.border,
    }}
  >
    <Dot color={color} pulse={active} />
    <span
      className="text-[11px] font-semibold flex-1 truncate"
      style={{ color: active ? color : T.text }}
    >
      {label}
    </span>
    <span
      className="text-[12px] font-mono font-bold tabular-nums"
      style={{ color: active ? color : T.textMute }}
    >
      {count}
    </span>
  </button>
);

export const FieldRow = ({ label, value, mono = true, color }) => (
  <div className="min-w-0">
    <div
      className="text-[9px] uppercase tracking-[0.16em] font-bold"
      style={{ color: T.textMute }}
    >
      {label}
    </div>
    <div
      className={`text-[12px] font-semibold truncate ${mono ? "font-mono tabular-nums" : ""}`}
      style={{ color: color || T.text }}
    >
      {value || "—"}
    </div>
  </div>
);

export const Tag = ({ children, color = T.cyan, filled = false }) => (
  <span
    className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
    style={{
      background: filled ? color : `${color}18`,
      color: filled ? "#fff" : color,
      border: filled ? "none" : `1px solid ${color}40`,
    }}
  >
    {children}
  </span>
);

export const ScrollArea = ({ children, className = "", style, maxHeight }) => (
  <div
    className={`overflow-y-auto overflow-x-hidden ycc-no-scroll ${className}`}
    style={{
      maxHeight,
      scrollbarWidth: "none",
      msOverflowStyle: "none",
      ...style,
    }}
  >
    {children}
  </div>
);
