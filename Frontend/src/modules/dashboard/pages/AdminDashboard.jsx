import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  FiActivity, FiBox, FiClock, FiRefreshCw, FiTrendingUp, FiMapPin, FiZap,
  FiBarChart2, FiPackage, FiCpu, FiPercent, FiArrowUpRight, FiArrowDownRight,
  FiWifi, FiWifiOff, FiX, FiMaximize2, FiGrid, FiList, FiSearch, FiFilter,
  FiChevronUp, FiChevronDown, FiPieChart, FiTrendingDown, FiLayers,
} from "react-icons/fi";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ComposedChart,
  RadialBarChart, RadialBar, Treemap, Scatter, ScatterChart, ZAxis, Legend,
} from "recharts";
import Navbar from "../../../components/layout/Navbar";
import {
  useGetEquipmentQuery,
  useGetContainerLiveStatusQuery,
  useGetDeviceDataLatestQuery,
  useGetDeviceDataLiveLocationsQuery,
  useLazyGetDeviceLockReportQuery,
  useGetEquipmentTransactionLatestQuery,
  useLazyGetEquipmentDailyUtilizationQuery,
  useGetContainerStatusReportQuery,
} from "../../../store/api/ymsApi";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const get = (row, ...keys) => {
  for (const k of keys) {
    if (row && Object.prototype.hasOwnProperty.call(row, k) && row[k] != null && row[k] !== "")
      return row[k];
  }
  return null;
};

const parseDateTime = (value) => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const s = String(value);
  if (s.includes("T")) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  const [datePart, timePart] = s.split(" ");
  if (!datePart) return null;
  const parts = datePart.split(/[-/]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    const iso = c.length === 4
      ? `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}T${timePart || "00:00:00"}`
      : `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}T${timePart || "00:00:00"}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const fmtRelative = (date) => {
  if (!date) return "—";
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 0) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const fmtNumber = (n) => {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString();
};

const fmtCompact = (n) => {
  if (n == null || isNaN(n)) return "—";
  const v = Number(n);
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
};

const fmtDate = (d) => {
  if (!d) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const isMissingContainer = (row) => {
  const raw = get(row, "ContNo", "contno", "RFIDDATA", "rfiddata",
    "OCR_CONTAINER_NO", "ocr_container_no", "CONTAINER_TAG_ID", "container_tag_id");
  const clean = String(raw ?? "").trim().split(" ")[0];
  return clean.replace(/0/g, "") === "" || clean === "-" || clean === "";
};

// ─── Theme tokens (light) ─────────────────────────────────────────────────────
const T = {
  bg: "#f0f4ff",
  bg2: "#e8eeff",
  card: "rgba(255,255,255,0.95)",
  cardHover: "rgba(255,255,255,1)",
  border: "rgba(148,163,184,0.22)",
  borderStrong: "rgba(100,116,139,0.38)",
  text: "#0f172a",
  textDim: "#374151",
  textMute: "#6b7280",
  cyan: "#0891b2",
  blue: "#2563eb",
  indigo: "#4f46e5",
  purple: "#7c3aed",
  pink: "#db2777",
  red: "#dc2626",
  orange: "#ea580c",
  amber: "#d97706",
  emerald: "#059669",
  teal: "#0d9488",
};

const ACCENTS = [T.cyan, T.blue, T.indigo, T.purple, T.pink, T.amber, T.emerald, T.teal, T.orange, T.red];

// ─── Animated counter ────────────────────────────────────────────────────────
const useCountUp = (target, duration = 900) => {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const startRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    fromRef.current = value;
    startRef.current = performance.now();
    const animate = (t) => {
      const elapsed = t - startRef.current;
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = fromRef.current + (Number(target) - fromRef.current) * eased;
      setValue(v);
      if (p < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
};

const AnimatedNumber = ({ value, decimals = 0, format = fmtNumber }) => {
  const v = useCountUp(Number.isFinite(value) ? value : 0);
  if (decimals > 0) return <>{v.toFixed(decimals)}</>;
  return <>{format(Math.round(v))}</>;
};

// ─── Mini Sparkline ──────────────────────────────────────────────────────────
const Sparkline = ({ data, color = T.cyan, height = 36 }) => {
  if (!data || data.length < 2) {
    return <div style={{ height }} className="opacity-30 text-[10px] flex items-center text-slate-500">—</div>;
  }
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2}
            fill={`url(#spark-${color.replace("#", "")})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── KPI Card (clickable, glass, animated, sparkline) ────────────────────────
const KpiCard = ({ icon: Icon, label, value, suffix, sub, trend, accent, loading, decimals, history, onClick }) => {
  const isUp = trend != null && trend >= 0;
  return (
    <button
      onClick={onClick}
      className="group relative text-left w-full overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
      style={{
        background: "linear-gradient(145deg, #ffffff, #f8faff)",
        border: `1px solid ${T.border}`,
        boxShadow: "0 2px 12px -2px rgba(99,102,241,0.1), 0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {/* subtle corner tint */}
      <div
        className="absolute -right-12 -top-12 w-32 h-32 rounded-full opacity-[0.06] blur-3xl group-hover:opacity-[0.12] transition-opacity"
        style={{ background: accent }}
      />
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${accent}80, transparent)` }} />

      <div className="relative p-4 md:p-5">
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}25` }}
          >
            <Icon className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div className="flex items-center gap-1">
            {trend != null && !loading && (
              <div className={`flex items-center gap-0.5 text-[10px] font-black px-2 py-1 rounded-full border ${isUp ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-700 bg-rose-50 border-rose-200"}`}>
                {isUp ? <FiArrowUpRight className="w-3 h-3" /> : <FiArrowDownRight className="w-3 h-3" />}
                {Math.abs(trend).toFixed(1)}%
              </div>
            )}
            <FiMaximize2 className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
          </div>
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] mb-1.5" style={{ color: T.textDim }}>
          {label}
        </div>
        <div className="flex items-baseline gap-1.5 mb-2">
          <div className="text-3xl md:text-4xl font-black tabular-nums tracking-tight leading-none" style={{ color: T.text }}>
            {loading ? <span className="opacity-20">···</span> : <AnimatedNumber value={value} decimals={decimals || 0} />}
          </div>
          {suffix && !loading && (
            <span className="text-base font-bold" style={{ color: accent }}>{suffix}</span>
          )}
        </div>
        {sub && (
          <div className="text-[11px] truncate" style={{ color: T.textMute }}>{sub}</div>
        )}
        <div className="mt-2 -mx-1">
          <Sparkline data={history} color={accent} height={32} />
        </div>
      </div>
    </button>
  );
};

// ─── Glass Panel ─────────────────────────────────────────────────────────────
const Panel = ({ title, subtitle, icon: Icon, right, children, className = "", noPad, accent = T.cyan }) => (
  <div
    className={`rounded-2xl overflow-hidden flex flex-col ${className}`}
    style={{
      background: "linear-gradient(145deg, #ffffff, #f8faff)",
      border: `1px solid ${T.border}`,
      boxShadow: "0 2px 12px -2px rgba(99,102,241,0.08), 0 1px 3px rgba(0,0,0,0.05)",
    }}
  >
    {(title || right) && (
      <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b" style={{ borderColor: T.border }}>
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}20` }}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[11px] md:text-xs font-black uppercase tracking-[0.15em] truncate" style={{ color: T.text }}>{title}</div>
            {subtitle && <div className="text-[10px] truncate mt-0.5" style={{ color: T.textMute }}>{subtitle}</div>}
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    )}
    <div className={noPad ? "flex-1 flex flex-col min-h-0" : "flex-1 p-4 md:p-5 flex flex-col min-h-0"}>
      {children}
    </div>
  </div>
);

// ─── Tabbed View Switcher ────────────────────────────────────────────────────
const ViewSwitch = ({ options, value, onChange }) => (
  <div className="inline-flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: "rgba(0,0,0,0.04)", border: `1px solid ${T.border}` }}>
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
          value === opt.value
            ? "bg-white shadow text-slate-900"
            : "text-slate-400 hover:text-slate-700 hover:bg-white/50"
        }`}
        style={{}}
      >
        {opt.icon && <opt.icon className="w-3 h-3" />}
        {opt.label}
      </button>
    ))}
  </div>
);

// ─── Chart Tooltip (dark) ────────────────────────────────────────────────────
const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs"
      style={{ background: "rgba(255,255,255,0.98)", border: `1px solid ${T.border}`, boxShadow: "0 8px 24px rgba(99,102,241,0.12), 0 2px 8px rgba(0,0,0,0.08)", color: T.text }}>
      {label != null && <div className="font-bold text-[11px] mb-1.5" style={{ color: T.textMute }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
            <span className="capitalize" style={{ color: T.textDim }}>{p.name}</span>
          </span>
          <span className="font-black tabular-nums">{fmtNumber(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Radial Gauge ────────────────────────────────────────────────────────────
const RadialGauge = ({ value, max = 100, color = T.cyan, label, size = 180, suffix = "%", subtitle }) => {
  const v = Math.max(0, Math.min(Number(value) || 0, max));
  const data = [{ name: label || "v", value: v, fill: color }];
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart cx="50%" cy="50%" innerRadius="68%" outerRadius="100%"
          data={data} startAngle={210} endAngle={-30}>
          {/* track */}
          <defs>
            <linearGradient id={`rg-${color.replace("#", "")}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <RadialBar background={{ fill: "rgba(0,0,0,0.05)" }} dataKey="value"
            cornerRadius={20} fill={`url(#rg-${color.replace("#", "")})`} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-3xl font-black tabular-nums leading-none" style={{ color: T.text }}>
          <AnimatedNumber value={v} decimals={1} />
        </div>
        <span className="text-xs font-bold mt-1" style={{ color }}>{suffix}</span>
        {subtitle && <div className="text-[10px] mt-1.5 uppercase tracking-wider font-bold" style={{ color: T.textMute }}>{subtitle}</div>}
      </div>
    </div>
  );
};

// ─── Heatmap (hour x weekday) ────────────────────────────────────────────────
const Heatmap = ({ data, color = T.cyan }) => {
  // data: array of 7 (weekday) x 24 (hour) cells [{wd, h, v}]
  const max = Math.max(1, ...data.map((d) => d.v));
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="flex-1 flex flex-col gap-1.5 min-h-0 p-1">
      <div className="flex gap-1 ml-9 text-[8px] font-bold" style={{ color: T.textMute }}>
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="flex-1 text-center min-w-0">{h % 3 === 0 ? String(h).padStart(2, "0") : ""}</div>
        ))}
      </div>
      {days.map((d, wd) => (
        <div key={d} className="flex items-center gap-1">
          <div className="w-8 text-[9px] font-bold" style={{ color: T.textDim }}>{d}</div>
          <div className="flex-1 flex gap-1">
            {Array.from({ length: 24 }, (_, h) => {
              const cell = data.find((x) => x.wd === wd && x.h === h);
              const v = cell?.v || 0;
              const intensity = max > 0 ? v / max : 0;
              return (
                <div
                  key={h}
                  title={`${d} ${String(h).padStart(2, "0")}:00 — ${v} moves`}
                  className="flex-1 aspect-square rounded transition-all hover:scale-125 cursor-pointer min-w-0"
                  style={{
                    background: v > 0 ? `${color}${Math.round(40 + intensity * 215).toString(16).padStart(2, "0")}` : "rgba(0,0,0,0.04)",
                  }}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Drill-down Modal ────────────────────────────────────────────────────────
const DrillModal = ({ open, onClose, kpi }) => {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !kpi) return null;
  const { label, value, suffix, accent, history, decimals, sub, table, breakdown } = kpi;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fadein" onClick={onClose}>
      <div
        className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl"
        style={{
          background: "linear-gradient(145deg, #ffffff, #f0f4ff)",
          border: `1px solid ${T.border}`,
          boxShadow: "0 24px 60px -16px rgba(99,102,241,0.2), 0 8px 24px rgba(0,0,0,0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}30` }}>
              {kpi.icon ? <kpi.icon className="w-6 h-6" strokeWidth={2} /> : null}
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: T.textMute }}>Deep Dive</div>
              <h2 className="text-xl md:text-2xl font-black" style={{ color: T.text }}>{label}</h2>
            </div>
          </div>
          <button onClick={onClose}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            style={{ border: `1px solid ${T.border}` }}>
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 gap-4">
          {/* Big value — Min/Max/Avg and the "Session Trend" chart were removed:
              `history` is a client-side buffer that only accumulates from page
              load (empty session), not a real historical series from the DB,
              so Min/Max/Avg/trend over it were not meaningful. */}
          <div className="rounded-2xl p-5" style={{ background: "rgba(248,250,252,1)", border: `1px solid ${T.border}` }}>
            <div className="text-[10px] uppercase tracking-widest font-black mb-2" style={{ color: T.textMute }}>Current</div>
            <div className="flex items-baseline gap-2 mb-1">
              <div className="text-5xl font-black tabular-nums" style={{ color: T.text }}>
                <AnimatedNumber value={value} decimals={decimals || 0} />
              </div>
              {suffix && <span className="text-2xl font-bold" style={{ color: accent }}>{suffix}</span>}
            </div>
            <div className="text-xs" style={{ color: T.textDim }}>{sub}</div>
          </div>

          {/* Breakdown */}
          {breakdown && breakdown.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: "rgba(248,250,252,1)", border: `1px solid ${T.border}` }}>
              <div className="text-[10px] uppercase tracking-widest font-black mb-3" style={{ color: T.textMute }}>Breakdown</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {breakdown.map((b, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: "white", border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: b.color || accent }} />
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textDim }}>{b.name}</span>
                    </div>
                    <div className="text-xl font-black tabular-nums" style={{ color: T.text }}>{fmtNumber(b.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table */}
          {table && table.rows && table.rows.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: `1px solid ${T.border}` }}>
              <div className="px-5 py-3 text-[10px] uppercase tracking-widest font-black border-b" style={{ color: T.textMute, borderColor: T.border }}>
                {table.title || "Details"}
              </div>
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-xs">
                  <thead className="sticky top-0" style={{ background: "#f8fafc" }}>
                    <tr>
                      {table.cols.map((c, i) => (
                        <th key={i} className="px-4 py-2 text-left font-black uppercase tracking-wider text-[10px]" style={{ color: T.textMute }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((r, i) => (
                      <tr key={i} className="border-t" style={{ borderColor: T.border }}>
                        {r.map((cell, j) => (
                          <td key={j} className="px-4 py-2.5" style={{ color: T.textDim }}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value, decimals, color }) => (
  <div className="rounded-lg px-3 py-2" style={{ background: "rgba(0,0,0,0.03)", border: `1px solid rgba(0,0,0,0.05)` }}>
    <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: T.textMute }}>{label}</div>
    <div className="text-sm font-black tabular-nums" style={{ color }}>
      {Number(value || 0).toFixed(decimals || 0)}
    </div>
  </div>
);

// ─── DataTable (reusable, dark, scrollable) ─────────────────────────────────
const DataTable = ({ cols, rows, footerRow, emptyMsg = "No data", maxHeight = "100%" }) => (
  <div className="flex-1 overflow-auto rounded-lg" style={{ background: "white", maxHeight, border: `1px solid ${T.border}` }}>
    <table className="w-full text-xs">
      <thead className="sticky top-0 z-10" style={{ background: "#f8fafc", backdropFilter: "blur(8px)" }}>
        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
          {cols.map((c, i) => (
            <th key={i}
              className={`px-3 py-2 font-black uppercase tracking-wider text-[10px] whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`}
              style={{ color: T.textMute }}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(!rows || rows.length === 0) ? (
          <tr><td colSpan={cols.length} className="text-center py-8 text-xs" style={{ color: T.textMute }}>{emptyMsg}</td></tr>
        ) : rows.map((r, i) => (
          <tr key={i} className="hover:bg-indigo-50/50 transition-colors" style={{ borderBottom: `1px solid ${T.border}` }}>
            {cols.map((c, j) => {
              const v = c.key ? r[c.key] : r[j];
              return (
                <td key={j} className={`px-3 py-2 ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.mono ? "font-mono" : ""} ${c.bold ? "font-black" : ""}`}
                  style={{ color: c.muted ? T.textMute : (c.dim ? T.textDim : T.text) }}>
                  {c.render ? c.render(v, r) : (v ?? "—")}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
      {footerRow && (
        <tfoot className="sticky bottom-0" style={{ background: "#f0f4ff", backdropFilter: "blur(8px)" }}>
          <tr style={{ borderTop: `1px solid ${T.borderStrong}` }}>
            {footerRow.map((cell, i) => (
              <td key={i} className={`px-3 py-2 text-[11px] font-black ${i === 0 ? "uppercase tracking-wider" : "text-right tabular-nums"}`}
                style={{ color: i === 0 ? T.textDim : T.text }}>
                {cell}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  </div>
);

// ─── Equipment Daily Utilization Section ─────────────────────────────────────
const _localDate = (offset = 0) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

const UtilizationSection = ({ fetchUtilization, utilizationApi, utilizationLoading, allEquipment }) => {
  // Single date — always one day so expected hrs = 18
  const [selDate, setSelDate] = useState(() => _localDate(-1));
  const [chartType, setChartType] = useState("table"); // table | bar | composed

  const rows = useMemo(() => Array.isArray(utilizationApi?.data) ? utilizationApi.data : [], [utilizationApi]);

  const chartData = useMemo(() => rows.map(r => ({
    name: r.EquipmentNo ?? r.equipmentno ?? r.EQUIPMENT_NO ?? "—",
    workHours:  Number(r.WorkingHours ?? r.workinghours ?? 0),
    idleHours:  (() => {
      const s = String(r.IdleTime ?? r.idletime ?? "0:00");
      const p = s.split(":").map(Number);
      return p.length >= 2 ? +(p[0] + p[1] / 60).toFixed(2) : 0;
    })(),
    breakHours: (() => {
      const s = String(r.BreakdownTime ?? r.breakdowntime ?? "0:00");
      const p = s.split(":").map(Number);
      return p.length >= 2 ? +(p[0] + p[1] / 60).toFixed(2) : 0;
    })(),
    utilPct:    Number(r.PercentageUtilization ?? r.percentageutilization ?? 0),
    moves:      Number(r.TotalMoves ?? r.totalmoves ?? 0),
    hourlyMoves:Number(r.HourlyMoves ?? r.hourlymoves ?? 0),
    expected:   Number(r.ExpectedWorkingHours ?? r.expectedworkinghours ?? 18),
  })), [rows]);

  const doFetch = useCallback((from, to, equipment) => {
    const eqpNames = equipment.map(e => e.name).filter(Boolean).join(",");
    if (!eqpNames) return;
    fetchUtilization({ eqp_no: eqpNames, from_date: from, to_date: to });
  }, [fetchUtilization]);

  // Auto-fetch yesterday on mount once equipment list is ready
  const hasFetched = useRef(false);
  useEffect(() => {
    if (hasFetched.current || !allEquipment.length) return;
    hasFetched.current = true;
    const d = _localDate(-1);
    doFetch(d, d, allEquipment);
  }, [allEquipment, doFetch]);

  const handleFetch = () => doFetch(selDate, selDate, allEquipment);

  const maxUtil = Math.max(...chartData.map(d => d.utilPct), 100);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "rgba(15,23,42,0.97)", border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", minWidth: 180 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#e2e8f0", marginBottom: 8 }}>{label}</div>
        {payload.map((p) => (
          <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 10, marginBottom: 3 }}>
            <span style={{ color: p.color, fontWeight: 700 }}>{p.name}</span>
            <span style={{ color: "#cbd5e1", fontWeight: 900, fontFamily: "monospace" }}>{p.value}{p.dataKey === "utilPct" ? "%" : p.dataKey.includes("Hours") || p.dataKey.includes("Hours") ? "h" : ""}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{
      background: "linear-gradient(145deg,#ffffff,#f8faff)",
      border: `1px solid ${T.border}`,
      boxShadow: "0 2px 12px -2px rgba(99,102,241,0.08)",
    }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b" style={{ borderColor: T.border }}>
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${T.purple}15`, color: T.purple, border: `1px solid ${T.purple}20` }}>
            <FiZap className="w-3.5 h-3.5" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: T.text }}>Equipment Daily Utilization</div>
            <div className="text-[10px] mt-0.5" style={{ color: T.textMute }}>Work time · idle · breakdown · moves · % utilization</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-2"
            style={{ borderColor: T.border, color: T.text, background: "#f8fafc" }} />
          <button onClick={handleFetch} disabled={utilizationLoading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black text-white transition-all"
            style={{ background: `linear-gradient(135deg,${T.purple},${T.indigo})`, opacity: utilizationLoading ? 0.7 : 1 }}>
            {utilizationLoading ? <FiRefreshCw className="w-3 h-3 animate-spin" /> : <FiBarChart2 className="w-3 h-3" />}
            {utilizationLoading ? "Loading…" : "Fetch"}
          </button>
          {/* Chart type toggle */}
          {rows.length > 0 && (
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: T.border }}>
              {[["table","Table"],["bar","Bar"],["composed","Mixed"]].map(([v,l]) => (
                <button key={v} onClick={() => setChartType(v)}
                  className="px-3 py-1.5 text-[10px] font-black transition-colors"
                  style={{ background: chartType === v ? T.purple : "white", color: chartType === v ? "white" : T.textMute }}>
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {!rows.length && !utilizationLoading && !allEquipment.length && (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <FiBarChart2 className="w-10 h-10" style={{ color: T.border }} />
            <p className="text-sm font-semibold" style={{ color: T.textMute }}>Select a date range and click Fetch to view utilization</p>
          </div>
        )}

        {utilizationLoading && (
          <div className="flex items-center justify-center py-14 gap-3">
            <FiRefreshCw className="w-5 h-5 animate-spin" style={{ color: T.purple }} />
            <span className="text-sm font-semibold" style={{ color: T.textMute }}>Loading utilization data…</span>
          </div>
        )}

        {!utilizationLoading && rows.length > 0 && chartType !== "table" && (
          <>
            {/* KPI summary strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: "Avg Utilization", value: `${(chartData.reduce((s,d)=>s+d.utilPct,0)/chartData.length).toFixed(1)}%`, color: T.purple },
                { label: "Total Moves",     value: chartData.reduce((s,d)=>s+d.moves,0).toLocaleString(), color: T.cyan },
                { label: "Avg Work Hours",  value: `${(chartData.reduce((s,d)=>s+d.workHours,0)/chartData.length).toFixed(1)}h`, color: T.emerald },
                { label: "Avg Hourly Moves",value: `${(chartData.reduce((s,d)=>s+d.hourlyMoves,0)/chartData.length).toFixed(1)}`, color: T.amber },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl px-4 py-3 flex flex-col gap-1"
                  style={{ background: `${color}0d`, border: `1px solid ${color}25` }}>
                  <span className="text-[10px] font-black uppercase tracking-wider" style={{ color }}>{label}</span>
                  <span className="text-2xl font-black tabular-nums" style={{ color: T.text }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Main chart */}
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "bar" ? (
                  <BarChart data={chartData} margin={{ top: 8, right: 24, left: -8, bottom: 0 }} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false}
                      tick={{ fontSize: 10, fill: T.textMute, fontWeight: 700 }} />
                    <YAxis yAxisId="left" tickLine={false} axisLine={false}
                      tick={{ fontSize: 10, fill: T.textMute }} width={30} />
                    <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false}
                      tick={{ fontSize: 10, fill: T.purple }} width={36}
                      tickFormatter={v => `${v}%`} domain={[0, Math.ceil(maxUtil / 10) * 10]} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(99,102,241,0.04)" }} />
                    <Bar yAxisId="left" dataKey="workHours"  name="Work Hrs"  fill={T.emerald} radius={[4,4,0,0]} maxBarSize={40} />
                    <Bar yAxisId="left" dataKey="idleHours"  name="Idle Hrs"  fill={T.amber}   radius={[4,4,0,0]} maxBarSize={40} />
                    <Bar yAxisId="left" dataKey="breakHours" name="Break Hrs" fill={T.red}     radius={[4,4,0,0]} maxBarSize={40} />
                    <Bar yAxisId="right" dataKey="utilPct"   name="Util %"    fill={T.purple}  radius={[4,4,0,0]} maxBarSize={40} opacity={0.85} />
                  </BarChart>
                ) : (
                  <ComposedChart data={chartData} margin={{ top: 8, right: 24, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false}
                      tick={{ fontSize: 10, fill: T.textMute, fontWeight: 700 }} />
                    <YAxis yAxisId="left" tickLine={false} axisLine={false}
                      tick={{ fontSize: 10, fill: T.textMute }} width={30} />
                    <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false}
                      tick={{ fontSize: 10, fill: T.purple }} width={36}
                      tickFormatter={v => `${v}%`} domain={[0, Math.ceil(maxUtil / 10) * 10]} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(99,102,241,0.04)" }} />
                    <Bar yAxisId="left" dataKey="workHours"  name="Work Hrs"  fill={T.emerald} radius={[4,4,0,0]} maxBarSize={40} />
                    <Bar yAxisId="left" dataKey="idleHours"  name="Idle Hrs"  fill={T.amber}   radius={[4,4,0,0]} maxBarSize={40} />
                    <Bar yAxisId="left" dataKey="breakHours" name="Break Hrs" fill={T.red}     radius={[4,4,0,0]} maxBarSize={40} />
                    <Line yAxisId="right" type="monotone" dataKey="utilPct" name="Util %" stroke={T.purple}
                      strokeWidth={3} dot={{ fill: T.purple, r: 5, strokeWidth: 2, stroke: "white" }} />
                    <Line yAxisId="left"  type="monotone" dataKey="moves"   name="Moves" stroke={T.cyan}
                      strokeWidth={2} strokeDasharray="5 3" dot={{ fill: T.cyan, r: 4 }} />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 justify-center">
              {[
                { color: T.emerald, label: "Work Hours" },
                { color: T.amber,   label: "Idle Hours" },
                { color: T.red,     label: "Breakdown Hours" },
                { color: T.purple,  label: "% Utilization" },
                ...(chartType === "composed" ? [{ color: T.cyan, label: "Total Moves" }] : []),
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: T.textDim }}>
                  <span className="w-3 h-3 rounded-sm" style={{ background: color }} />{label}
                </span>
              ))}
            </div>
          </>
        )}

        {/* Table view */}
        {!utilizationLoading && rows.length > 0 && chartType === "table" && (
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: T.border }}>
            <table className="w-full text-xs">
              <thead style={{ background: "#f8fafc" }}>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {[
                    "Equipment","Breakdown","Idle Time","Work Time",
                    "Total Moves","Work Hours","Hourly Moves","Expected Hrs","Utilization %"
                  ].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-black uppercase tracking-wider text-[10px]"
                      style={{ color: T.textMute, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const name   = r.EquipmentNo ?? r.equipmentno ?? r.EQUIPMENT_NO ?? "—";
                  const util   = Number(r.PercentageUtilization ?? r.percentageutilization ?? 0);
                  const col    = util >= 80 ? T.emerald : util >= 50 ? T.amber : T.red;
                  return (
                    <tr key={i} className="hover:bg-indigo-50/40 transition-colors" style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td className="px-3 py-2.5 font-black" style={{ color: T.text }}>{name}</td>
                      <td className="px-3 py-2.5 font-mono" style={{ color: T.red }}>{r.BreakdownTime ?? r.breakdowntime ?? "—"}</td>
                      <td className="px-3 py-2.5 font-mono" style={{ color: T.amber }}>{r.IdleTime ?? r.idletime ?? "—"}</td>
                      <td className="px-3 py-2.5 font-mono" style={{ color: T.emerald }}>{r.WorkTime ?? r.worktime ?? "—"}</td>
                      <td className="px-3 py-2.5 font-black tabular-nums text-center" style={{ color: T.cyan }}>{r.TotalMoves ?? r.totalmoves ?? 0}</td>
                      <td className="px-3 py-2.5 tabular-nums text-center" style={{ color: T.text }}>{r.WorkingHours ?? r.workinghours ?? 0}</td>
                      <td className="px-3 py-2.5 tabular-nums text-center" style={{ color: T.text }}>{r.HourlyMoves ?? r.hourlymoves ?? 0}</td>
                      <td className="px-3 py-2.5 tabular-nums text-center" style={{ color: T.textMute }}>{r.ExpectedWorkingHours ?? r.expectedworkinghours ?? 18}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.07)", minWidth: 60 }}>
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(util, 100)}%`, background: col }} />
                          </div>
                          <span className="font-black tabular-nums shrink-0 text-[11px]" style={{ color: col }}>{util.toFixed(2)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot style={{ background: "#f8fafc", borderTop: `2px solid ${T.border}` }}>
                <tr>
                  <td className="px-3 py-2.5 font-black text-[10px] uppercase tracking-wider" style={{ color: T.textMute }}>Average</td>
                  <td colSpan={3} />
                  <td className="px-3 py-2.5 font-black tabular-nums text-center" style={{ color: T.cyan }}>
                    {chartData.reduce((s,d)=>s+d.moves,0)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-center font-black" style={{ color: T.text }}>
                    {(chartData.reduce((s,d)=>s+d.workHours,0)/Math.max(chartData.length,1)).toFixed(1)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-center font-black" style={{ color: T.text }}>
                    {(chartData.reduce((s,d)=>s+d.hourlyMoves,0)/Math.max(chartData.length,1)).toFixed(1)}
                  </td>
                  <td />
                  <td className="px-3 py-2.5">
                    <span className="font-black text-[11px]" style={{ color: T.purple }}>
                      {(chartData.reduce((s,d)=>s+d.utilPct,0)/Math.max(chartData.length,1)).toFixed(2)}%
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Daily Equipment Moves Count (bars = moves, line = utilization %) ────────
// Same source as UtilizationSection (GET_EQUIPMENT_DAILY_UTILIZATION) — no
// separate API call, just a different, more compact chart composition.
const MovesCountChart = ({ utilizationApi }) => {
  const chartData = useMemo(() => {
    const rows = Array.isArray(utilizationApi?.data) ? utilizationApi.data : [];
    return rows.map(r => ({
      name: r.EquipmentNo ?? r.equipmentno ?? r.EQUIPMENT_NO ?? "—",
      moves: Number(r.TotalMoves ?? r.totalmoves ?? 0),
      utilPct: Number(r.PercentageUtilization ?? r.percentageutilization ?? 0),
    }));
  }, [utilizationApi]);

  const maxUtil = Math.max(...chartData.map(d => d.utilPct), 20);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "rgba(15,23,42,0.97)", border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", minWidth: 160 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#e2e8f0", marginBottom: 8 }}>{label}</div>
        {payload.map((p) => (
          <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 10, marginBottom: 3 }}>
            <span style={{ color: p.color, fontWeight: 700 }}>{p.name}</span>
            <span style={{ color: "#cbd5e1", fontWeight: 900, fontFamily: "monospace" }}>
              {p.value}{p.dataKey === "utilPct" ? "%" : ""}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center py-10 text-sm" style={{ color: T.textMute }}>
        No moves data — run Equipment Daily Utilization above first.
      </div>
    );
  }

  return (
    <div style={{ height: 340 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 24, right: 24, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
          <XAxis dataKey="name" tickLine={false} axisLine={false}
            tick={{ fontSize: 10, fill: T.textMute, fontWeight: 700 }} />
          <YAxis yAxisId="left" tickLine={false} axisLine={false}
            tick={{ fontSize: 10, fill: T.textMute }} width={32} label={{ value: "Moves Count", angle: -90, position: "insideLeft", fontSize: 10, fill: T.textMute }} />
          <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false}
            tick={{ fontSize: 10, fill: T.indigo }} width={36}
            tickFormatter={v => `${v}`} domain={[0, Math.ceil(maxUtil / 5) * 5]}
            label={{ value: "% Utilization", angle: 90, position: "insideRight", fontSize: 10, fill: T.indigo }} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(37,99,235,0.05)" }} />
          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
          <Bar yAxisId="left" dataKey="moves" name="Moves Count" fill={T.blue} radius={[4, 4, 0, 0]} maxBarSize={48}
            label={{ position: "top", fontSize: 11, fontWeight: 900, fill: T.text }} />
          <Line yAxisId="right" type="monotone" dataKey="utilPct" name="Utilization"
            stroke={T.indigo} strokeWidth={2.5} dot={{ fill: T.indigo, r: 4, strokeWidth: 2, stroke: "white" }}
            label={{ position: "top", fontSize: 10, fontWeight: 800, fill: T.indigo }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Main Dashboard ──────────────────────────────────────────────────────────
const HISTORY_LEN = 24;

const AdminDashboard = () => {
  const [now, setNow] = useState(() => new Date());
  const [drill, setDrill] = useState(null);

  // ─── Filters ──────────────────────────────────────────────────────────────
  // Default: last 24h rolling, all equipment, all processes/sizes — enterprise default
  const buildPreset = (preset) => {
    const pad = (n) => String(n).padStart(2, "0");
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const now = new Date();
    if (preset === "today") {
      return { from: fmt(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0)), to: fmt(now) };
    }
    if (preset === "24h") {
      return { from: fmt(new Date(now.getTime() - 24 * 3600 * 1000)), to: fmt(now) };
    }
    if (preset === "shift") {
      const today9 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
      const ref = now.getHours() >= 9 ? today9 : new Date(today9.getTime() - 24 * 3600 * 1000);
      return { from: fmt(ref), to: fmt(new Date(ref.getTime() + 24 * 3600 * 1000)) };
    }
    if (preset === "7d") return { from: fmt(new Date(now.getTime() - 7 * 24 * 3600 * 1000)), to: fmt(now) };
    if (preset === "30d") return { from: fmt(new Date(now.getTime() - 30 * 24 * 3600 * 1000)), to: fmt(now) };
    return null;
  };
  const initialRange = buildPreset("24h");
  const [filters, setFilters] = useState({
    preset: "24h",
    from: initialRange.from,
    to: initialRange.to,
    equipmentIds: null, // null = all
    processes: new Set(), // empty = all
    sizes: new Set(), // empty = all
  });
  const [showEqpDD, setShowEqpDD] = useState(false);
  const [eqpFilterSearch, setEqpFilterSearch] = useState("");
  const eqpDDRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (eqpDDRef.current && !eqpDDRef.current.contains(e.target)) setShowEqpDD(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const applyPreset = (preset) => {
    const r = buildPreset(preset);
    if (!r) return;
    setFilters((f) => ({ ...f, preset, from: r.from, to: r.to }));
  };

  const toggleSetItem = (key, item) => {
    setFilters((f) => {
      const next = new Set(f[key]);
      next.has(item) ? next.delete(item) : next.add(item);
      return { ...f, [key]: next };
    });
  };

  const toggleEquipment = (deviceId) => {
    setFilters((f) => {
      // null = all selected. First toggle off "all" → start with current minus this one.
      const current = f.equipmentIds; // null or Set
      if (current == null) {
        const all = new Set();
        // toggle by REMOVING this one from the "all" set
        // Build the full set without this id
        // (we need allEquipment ids; closures handle this at call site)
        return { ...f, equipmentIds: all };
      }
      const next = new Set(current);
      next.has(deviceId) ? next.delete(deviceId) : next.add(deviceId);
      return { ...f, equipmentIds: next };
    });
  };

  const setEquipmentAll = () => setFilters((f) => ({ ...f, equipmentIds: null }));
  const setEquipmentNone = () => setFilters((f) => ({ ...f, equipmentIds: new Set() }));

  const resetFilters = () => {
    const r = buildPreset("24h");
    setFilters({
      preset: "24h",
      from: r.from,
      to: r.to,
      equipmentIds: null,
      processes: new Set(),
      sizes: new Set(),
    });
  };

  const activeFilterCount =
    (filters.preset !== "24h" ? 1 : 0) +
    (filters.equipmentIds != null ? 1 : 0) +
    (filters.processes.size > 0 ? 1 : 0) +
    (filters.sizes.size > 0 ? 1 : 0);

  const [chartView, setChartView] = useState("area");
  const [eqpView, setEqpView] = useState("table");
  const [yardView, setYardView] = useState("bars");
  const [processView, setProcessView] = useState("donut");
  const [sizeView, setSizeView] = useState("chart");
  const [ageingView, setAgeingView] = useState("chart");
  const [heatmapView, setHeatmapView] = useState("heat");
  const [shippingView, setShippingView] = useState("chart");
  const [yardInvView, setYardInvView] = useState("table");
  const [inOutView, setInOutView] = useState("chart");
  const [topView, setTopView] = useState("chart");
  const [activityView, setActivityView] = useState("stream");
  const [eqpSort, setEqpSort] = useState({ key: "status", dir: "asc" });
  const [eqpSearch, setEqpSearch] = useState("");

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // ─── API ─────────────────────────────────────────────────────────────────
  const {
    data: equipmentApi,
    isLoading: equipmentLoading,
    isFetching: equipmentFetching,
    refetch: refetchEquipment,
  } = useGetEquipmentQuery(undefined, { pollingInterval: 15000, refetchOnFocus: true });

  const {
    data: liveStatusApi,
    isLoading: liveStatusLoading,
    refetch: refetchLiveStatus,
  } = useGetContainerLiveStatusQuery("", { pollingInterval: 30000, refetchOnFocus: true });

  // Last 6 months — for monthly Container In/Out chart
  const _6mFrom = useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 6);
    return d.toISOString().slice(0, 10);
  }, []);
  const _today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { data: statusReportApi, isLoading: statusReportLoading } = useGetContainerStatusReportQuery(
    { from_date: _6mFrom, to_date: _today },
    { refetchOnFocus: true }
  );

  // Filter-window gate-outs — for Gate Throughput chart (tracks filterRange)
  const { data: gateOutReportApi } = useGetContainerStatusReportQuery(
    { from_date: filters.from.slice(0, 10), to_date: filters.to.slice(0, 10) },
    { refetchOnFocus: true }
  );

  const { data: latestTxApi } = useGetDeviceDataLatestQuery(undefined, { pollingInterval: 15000 });
  const { data: liveLocApi } = useGetDeviceDataLiveLocationsQuery(undefined, { pollingInterval: 15000 });
  const { data: latestEqpTxApi } = useGetEquipmentTransactionLatestQuery(undefined, { pollingInterval: 20000 });

  const [fetchLockReport, { data: lockReportApi, isLoading: lockLoading }] =
    useLazyGetDeviceLockReportQuery();

  const [fetchUtilization, { data: utilizationApi, isFetching: utilizationLoading }] =
    useLazyGetEquipmentDailyUtilizationQuery();

  // ─── Derived ─────────────────────────────────────────────────────────────
  const allEquipment = useMemo(() => {
    const list = Array.isArray(equipmentApi?.data) ? equipmentApi.data : [];
    return list.map((item, i) => {
      const name = get(item, "Equipment_Code", "equipment_code", "EQUIPMENT_CODE",
                       "Equipment_Name", "equipment_name", "EQUIPMENT_NAME") || `EQP-${i + 1}`;
      const deviceId = get(item, "Device_ID", "device_id", "DEVICE_ID");
      const status = String(get(item, "Status", "status", "STATUS") || "").toLowerCase();
      const owner = get(item, "Owner_Name", "owner_name", "OWNER_NAME");
      return {
        id: get(item, "Eqp_ID", "eqp_id") || i + 1,
        name: String(name).trim(),
        deviceId: deviceId ? String(deviceId).trim().toUpperCase() : null,
        owner,
        isBreakdown: status === "breakdown" || status === "break" || status === "fault",
      };
    }).filter((e) => e.name);
  }, [equipmentApi]);

  // Debounced re-fetch of OCR whenever date range OR equipment selection changes.
  // Initial fetch on mount, then again whenever filters or equipment list update.
  useEffect(() => {
    const t = setTimeout(() => {
      const sel = filters.equipmentIds;
      let ids;
      if (sel instanceof Set && sel.size > 0) ids = Array.from(sel);
      else if (sel == null) ids = allEquipment.map((e) => e.deviceId).filter(Boolean);
      else ids = []; // explicitly none selected
      fetchLockReport({
        equipment_names: ids && ids.length > 0 ? ids.join(",") : undefined,
        from_date: filters.from,
        to_date: filters.to,
        report_type: "All",
      });
    }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.from, filters.to, filters.equipmentIds, allEquipment]);

  const liveLocMap = useMemo(() => {
    const rows = Array.isArray(liveLocApi?.data) ? liveLocApi.data : [];
    const map = new Map();
    rows.forEach((r) => {
      const dev = get(r, "DEVICE_IMEI", "device_imei", "DEVICE_ID", "device_id");
      if (!dev) return;
      const lat = Number(get(r, "LAT", "lat", "LATITUDE", "latitude"));
      const lng = Number(get(r, "LNG", "lng", "LONGITUDE", "longitude"));
      const lastAt = get(r, "LAST_AT", "last_at", "DATE_TIME", "date_time",
        "LAST_TRANSACTION_DATE", "last_transaction_date");
      const container = get(r, "RFIDDATA", "rfiddata", "OCR_CONTAINER_NO", "ocr_container_no");
      map.set(String(dev).trim().toUpperCase(), { lat, lng, lastAt, container });
    });
    return map;
  }, [liveLocApi]);

  const latestTxMap = useMemo(() => {
    const rows = Array.isArray(latestTxApi?.data) ? latestTxApi.data : [];
    const map = new Map();
    rows.forEach((r) => {
      const dev = get(r, "DEVICE_IMEI", "device_imei", "DEVICE_ID", "device_id");
      if (!dev) return;
      map.set(String(dev).trim().toUpperCase(), get(r, "LAST_TRANSACTION_DATE", "last_transaction_date"));
    });
    return map;
  }, [latestTxApi]);

  // Equipment narrowed by filter selection (null = all)
  const filteredEquipment = useMemo(() => {
    const sel = filters.equipmentIds;
    if (sel == null) return allEquipment;
    if (sel.size === 0) return [];
    return allEquipment.filter((e) => e.deviceId && sel.has(e.deviceId));
  }, [allEquipment, filters.equipmentIds]);

  // Must be defined before equipmentStats (which depends on it)
  const filterRange = useMemo(() => {
    const fromD = new Date(filters.from);
    const toD = new Date(filters.to);
    return { fromMs: fromD.getTime(), toMs: toD.getTime() };
  }, [filters.from, filters.to]);

  const equipmentStats = useMemo(() => {
    const total = filteredEquipment.length;
    const breakdown = filteredEquipment.filter((e) => e.isBreakdown).length;

    // Build DEVICE_ID → last transaction Date from SP_MOVEMENT_TRANSACTION_LATEST
    const lastTxByDevice = new Map();
    const txRows = Array.isArray(latestEqpTxApi?.data) ? latestEqpTxApi.data : [];
    txRows.forEach((r) => {
      const dev = String(get(r, "DEVICE_ID", "device_id", "DEVICE_IMEI", "device_imei") || "").trim().toUpperCase();
      if (!dev) return;
      const dt = parseDateTime(get(r, "LAST_TRANSACTION_DATE", "last_transaction_date", "TRANSACTION_DATE", "transaction_date"));
      if (dt) lastTxByDevice.set(dev, dt);
    });
    // Merge latestTxMap (device-data) as additional source
    latestTxMap.forEach((dateStr, dev) => {
      if (!lastTxByDevice.has(dev)) {
        const dt = parseDateTime(dateStr);
        if (dt) lastTxByDevice.set(dev, dt);
      }
    });

    // Active = last tx within 8 hours of NOW (real operational status, not filter window)
    const ACTIVE_WINDOW_MS = 8 * 60 * 60 * 1000;
    const nowMs = now.getTime();

    let active = 0;
    const perMachine = filteredEquipment.map((e) => {
      const devUp = String(e.deviceId || "").trim().toUpperCase();
      const lastTx = devUp ? lastTxByDevice.get(devUp) : null;
      const isActive = !e.isBreakdown && !!lastTx &&
        (nowMs - lastTx.getTime()) <= ACTIVE_WINDOW_MS;
      if (isActive) active++;
      const lastTxStr = lastTx ? lastTx.toLocaleString() : null;
      return { name: e.name, deviceId: devUp, isActive, isBreakdown: e.isBreakdown, lastTx: lastTxStr };
    });

    const idle = Math.max(total - active - breakdown, 0);
    const utilization = total > 0 ? (active / total) * 100 : 0;
    return { total, active, idle, breakdown, utilization, perMachine };
  }, [filteredEquipment, latestEqpTxApi, latestTxMap, now]);

  const containersAll = useMemo(
    () => (Array.isArray(liveStatusApi?.data) ? liveStatusApi.data : []),
    [liveStatusApi]
  );

  // Process / size filters applied client-side over the live snapshot.
  // (Date filter applies only to time-windowed views like throughput / heatmap.)
  const containers = useMemo(() => {
    if (filters.processes.size === 0 && filters.sizes.size === 0) return containersAll;
    return containersAll.filter((c) => {
      if (filters.processes.size > 0) {
        const p = String(get(c, "CONTAINER_PROCESS", "container_process") || "").toLowerCase();
        if (!filters.processes.has(p)) return false;
      }
      if (filters.sizes.size > 0) {
        const sz = String(get(c, "CONTAINER_SIZE", "container_size") || "").toUpperCase();
        let bucket = "other";
        if (sz.startsWith("20")) bucket = "20";
        else if (sz.includes("HQ") || sz === "40HC") bucket = "40hq";
        else if (sz.startsWith("40")) bucket = "40";
        if (!filters.sizes.has(bucket)) return false;
      }
      return true;
    });
  }, [containersAll, filters.processes, filters.sizes]);

  const containerStats = useMemo(() => {
    const total = containers.length;
    let imp = 0, exp = 0, empty = 0, other = 0;
    let size20 = 0, size40 = 0, size40hq = 0, sizeOther = 0;
    let damaged = 0;
    containers.forEach((c) => {
      const p = String(get(c, "CONTAINER_PROCESS", "container_process") || "").toLowerCase();
      if (p === "import") imp++;
      else if (p === "export") exp++;
      else if (p === "empty") empty++;
      else other++;
      const sz = String(get(c, "CONTAINER_SIZE", "container_size") || "").toUpperCase();
      if (sz.startsWith("20")) size20++;
      else if (sz.includes("HQ") || sz === "40HC") size40hq++;
      else if (sz.startsWith("40")) size40++;
      else sizeOther++;
      const status = String(get(c, "INVENTORY_STATUS", "inventory_status") || "").toLowerCase();
      if (status.includes("damage")) damaged++;
    });
    return { total, imp, exp, empty, other, size20, size40, size40hq, sizeOther, damaged };
  }, [containers]);

  const yardByLocation = useMemo(() => {
    const map = new Map();
    containers.forEach((c) => {
      const loc = get(c, "MASTERTABLE", "mastertable", "LOCATION_NAME", "location_name",
        "YARD_LOC", "yard_loc", "YARD_NAME", "yard_name") || "Unassigned";
      const key = String(loc).split("-")[0].trim() || "Unassigned";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count], i) => ({ name, count, value: count, fill: ACCENTS[i % ACCENTS.length] }))
      .sort((a, b) => b.count - a.count);
  }, [containers]);

  const hourlyThroughput = useMemo(() => {
    const spanMs = filterRange.toMs - filterRange.fromMs;
    const useDays = spanMs > 25 * 3600 * 1000; // >25h → bucket by day

    const bucketMap = new Map();

    const getKey = (dt) => {
      if (useDays) {
        return dt.toISOString().slice(0, 10); // YYYY-MM-DD
      }
      return String(dt.getHours()).padStart(2, "0") + "h";
    };

    const ensureBucket = (key, dt) => {
      if (!bucketMap.has(key)) {
        const label = useDays
          ? dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
          : key;
        bucketMap.set(key, { key, label, in: 0, out: 0, net: 0 });
      }
      return bucketMap.get(key);
    };

    // Seed all buckets so axis is continuous even with 0 counts
    if (useDays) {
      const cur = new Date(filterRange.fromMs);
      cur.setHours(0, 0, 0, 0);
      const end = new Date(filterRange.toMs);
      while (cur <= end) {
        const key = cur.toISOString().slice(0, 10);
        ensureBucket(key, new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      for (let h = 0; h < 24; h++) {
        const key = String(h).padStart(2, "0") + "h";
        bucketMap.set(key, { key, label: key, in: 0, out: 0, net: 0 });
      }
    }

    // Gate-in: live inventory (SP_CONTAINER_LIVE_STATUS — containers currently in yard)
    containers.forEach((c) => {
      const gIn = parseDateTime(get(c, "GATE_IN_DATE", "gate_in_date"));
      if (gIn && gIn.getTime() >= filterRange.fromMs && gIn.getTime() <= filterRange.toMs)
        ensureBucket(getKey(gIn), gIn).in++;
    });

    // Gate-out: departed containers from the filter-window report
    const reportRows = Array.isArray(gateOutReportApi?.data) ? gateOutReportApi.data : [];
    reportRows.forEach((c) => {
      const gOut = parseDateTime(get(c, "GATE_OUT_DATE", "gate_out_date"));
      if (gOut && gOut.getTime() >= filterRange.fromMs && gOut.getTime() <= filterRange.toMs)
        ensureBucket(getKey(gOut), gOut).out++;
    });

    const sorted = Array.from(bucketMap.values()).sort((a, b) => a.key.localeCompare(b.key));
    sorted.forEach((b) => { b.net = b.in - b.out; });
    return sorted;
  }, [containers, gateOutReportApi, filterRange]);

  const ageingBuckets = useMemo(() => {
    const buckets = [
      { name: "DAY 0-5",      label: "DAY 0-5",      min: 0,   max: 120,      count: 0, import: 0, export: 0, domestic: 0, empty: 0, color: T.emerald },
      { name: "DAY 06-10",    label: "DAY 06-10",    min: 120, max: 240,      count: 0, import: 0, export: 0, domestic: 0, empty: 0, color: T.cyan },
      { name: "DAY 11-20",    label: "DAY 11-20",    min: 240, max: 480,      count: 0, import: 0, export: 0, domestic: 0, empty: 0, color: T.blue },
      { name: "DAY 21-30",    label: "DAY 21-30",    min: 480, max: 720,      count: 0, import: 0, export: 0, domestic: 0, empty: 0, color: T.amber },
      { name: "DAY ABOVE 30", label: "DAY ABOVE 30", min: 720, max: Infinity, count: 0, import: 0, export: 0, domestic: 0, empty: 0, color: T.red },
    ];
    containers.forEach((c) => {
      const gIn = parseDateTime(get(c, "GATE_IN_DATE", "gate_in_date"));
      if (!gIn) return;
      let hours = null;
      const tat = get(c, "TIME_IN_YARD", "time_in_yard");
      if (tat != null) {
        const s = String(tat);
        if (s.includes(":")) {
          const [h] = s.split(":").map(Number);
          if (Number.isFinite(h)) hours = h;
        } else {
          const n = Number(s);
          if (Number.isFinite(n)) hours = n;
        }
      }
      if (hours == null) hours = (now.getTime() - gIn.getTime()) / 3600000;
      if (hours < 0) return;
      const b = buckets.find((x) => hours >= x.min && hours < x.max);
      if (!b) return;
      b.count++;
      const proc = String(get(c, "CONTAINER_PROCESS", "container_process") || "").toUpperCase();
      if (proc === "IMPORT")        b.import++;
      else if (proc === "EXPORT")   b.export++;
      else if (proc === "DOMESTIC") b.domestic++;
      else                          b.empty++;
    });
    return buckets;
  }, [containers, now]);

  // ── Shipping Line Wise Inventory ─────────────────────────────────────────────
  const shippingLineData = useMemo(() => {
    const map = new Map();
    containers.forEach((c) => {
      const no = String(get(c, "CONTAINER_NO", "container_no") || "");
      const line = no.length >= 4 ? no.slice(0, 4).toUpperCase() : "OTHER";
      const sz = String(get(c, "CONTAINER_SIZE", "container_size") || "").toUpperCase();
      const is40 = sz.startsWith("40") || sz.includes("HC") || sz.includes("HQ");
      if (!map.has(line)) map.set(line, { name: line, size20: 0, size40: 0 });
      const e = map.get(line);
      if (is40) e.size40++; else e.size20++;
    });
    return Array.from(map.values())
      .map((e) => ({ ...e, total: e.size20 + e.size40 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)
      .map((e, i, arr) => {
        const grand = arr.reduce((s, x) => s + x.total, 0);
        return { ...e, pct: grand > 0 ? +((e.total / grand) * 100).toFixed(2) : 0 };
      });
  }, [containers]);

  // ── Yard Inventory by Block (real BLOCK_NAME from backend) ──────────────────
  const yardInventoryData = useMemo(() => {
    const map = new Map();
    containers.forEach((c) => {
      const block = String(get(c, "BLOCK_NAME", "block_name") || "").trim();
      if (!block) return;
      if (!map.has(block)) map.set(block, { location: block, s20: 0, s40: 0 });
      const e = map.get(block);
      const sz = String(get(c, "CONTAINER_SIZE", "container_size") || "").toUpperCase();
      if (sz.startsWith("20")) e.s20++; else e.s40++;
    });
    return Array.from(map.values())
      .map((e) => {
        const count = e.s20 + e.s40;
        const teus  = e.s20 + e.s40 * 2;
        return { location: e.location, s20: e.s20, s40: e.s40, count, teus };
      })
      .sort((a, b) => b.count - a.count);
  }, [containers]);

  // ── Container In/Out monthly (uses status report for full history incl. gate-outs) ──
  const containerInOutData = useMemo(() => {
    // SP_MONTHLY_GATE_INOUT returns pre-aggregated rows: { MOVEMENT_TYPE, MONTH_KEY, CONTAINER_COUNT }
    const rows = Array.isArray(statusReportApi?.data) ? statusReportApi.data : [];
    const monthMap = new Map();
    rows.forEach((r) => {
      const key   = String(get(r, "MONTH_KEY",        "month_key")        || "").trim();
      const type  = String(get(r, "MOVEMENT_TYPE",    "movement_type")    || "").trim().toUpperCase();
      const count = Number(get(r, "CONTAINER_COUNT",  "container_count")  ?? 0);
      if (!key || !type) return;
      if (!monthMap.has(key)) monthMap.set(key, { month: key, in: 0, out: 0 });
      if (type === "IN")  monthMap.get(key).in  += count;
      if (type === "OUT") monthMap.get(key).out += count;
    });
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, v]) => ({
        month: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "numeric" }).replace(" ", "-"),
        in: v.in, out: v.out,
      }));
  }, [statusReportApi]);

  // Average % utilization from yesterday's actual SP data
  const dailyUtilPct = useMemo(() => {
    const rows = Array.isArray(utilizationApi?.data) ? utilizationApi.data : [];
    if (!rows.length) return null;
    const sum = rows.reduce((s, r) =>
      s + Number(r.PercentageUtilization ?? r.percentageutilization ?? 0), 0);
    return +(sum / rows.length).toFixed(1);
  }, [utilizationApi]);

  const ocrStats = useMemo(() => {
    const rows = Array.isArray(lockReportApi?.data) ? lockReportApi.data : [];
    const total = rows.length;
    const missing = rows.filter(isMissingContainer).length;
    const captured = total - missing;
    const pct = total > 0 ? (captured / total) * 100 : 0;
    // Per-machine breakdown — same calc as ServiceDashboard
    const byMachine = new Map();
    rows.forEach((r) => {
      const m = get(r, "DeviceID", "deviceid", "EqpName", "eqpname", "EQUIPMENT_NAME", "DEVICE_IMEI") || "Unknown";
      const cur = byMachine.get(m) || { total: 0, missing: 0 };
      cur.total++;
      if (isMissingContainer(r)) cur.missing++;
      byMachine.set(m, cur);
    });
    const machineRows = Array.from(byMachine.entries())
      .map(([name, d]) => ({
        name,
        total: d.total,
        captured: d.total - d.missing,
        missing: d.missing,
        pct: d.total > 0 ? ((d.total - d.missing) / d.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
    return { total, missing, captured, pct, machineRows };
  }, [lockReportApi]);

  const liveEquipment = useMemo(() => {
    const perMachineMap = new Map(
      (equipmentStats.perMachine || []).map((m) => [m.name, m])
    );
    return filteredEquipment.map((e) => {
      const loc = e.deviceId ? liveLocMap.get(e.deviceId) : null;
      const lastTxAt = parseDateTime(e.deviceId ? latestTxMap.get(e.deviceId) : null);
      const lastSeenAt = parseDateTime(loc?.lastAt);
      const effective = lastSeenAt || lastTxAt;
      const pm = perMachineMap.get(e.name) || { isActive: false, lastTx: null };
      let status = "offline";
      if (e.isBreakdown) status = "breakdown";
      else if (pm.isActive) status = "active";
      else if (effective && now.getTime() - effective.getTime() < 60 * 60 * 1000) status = "idle";
      return {
        ...e,
        status,
        lastAt: effective,
        container: loc?.container ? String(loc.container).split(" ")[0] : "",
        lastTx: pm.lastTx,
      };
    });
  }, [filteredEquipment, liveLocMap, latestTxMap, equipmentStats.perMachine, now]);

  // Set of equipment-code names allowed by filter (null = no restriction)
  const allowedEqpNames = useMemo(() => {
    const sel = filters.equipmentIds;
    if (sel == null) return null;
    const allowed = new Set();
    filteredEquipment.forEach((e) => {
      if (e.name) allowed.add(String(e.name).toUpperCase());
      if (e.deviceId) allowed.add(String(e.deviceId).toUpperCase());
    });
    return allowed;
  }, [filters.equipmentIds, filteredEquipment]);

  const eqpAllowed = (raw) => {
    if (!allowedEqpNames) return true;
    if (!raw) return false;
    return allowedEqpNames.has(String(raw).trim().toUpperCase());
  };

  const liveActivity = useMemo(() => {
    const items = [];
    const rows = Array.isArray(latestEqpTxApi?.data) ? latestEqpTxApi.data : [];
    rows.forEach((r) => {
      const dt = parseDateTime(get(r, "TRANSACTION_DATE", "transaction_date",
        "LAST_TRANSACTION_DATE", "last_transaction_date", "DATE_TIME", "date_time"));
      if (!dt) return;
      // Date range filter
      const t = dt.getTime();
      if (t < filterRange.fromMs || t > filterRange.toMs) return;
      const eqp = get(r, "EQUIPMENT_CODE", "equipment_code", "EqpName", "eqpname", "DEVICE_IMEI");
      if (!eqpAllowed(eqp)) return;
      const cont = get(r, "CONTAINER_NO", "container_no", "RFIDDATA", "rfiddata",
        "OCR_CONTAINER_NO", "ocr_container_no");
      const action = get(r, "PROCESS_TYPE", "process_type", "ACTIVITY", "activity") || "Move";
      items.push({
        time: dt,
        title: cont && String(cont).trim().replace(/0/g, "") !== "" ? String(cont).trim() : "Unidentified",
        meta: `${eqp || "Equipment"} · ${action}`,
        eqp,
        action,
      });
    });
    return items.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 20);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestEqpTxApi, filterRange, allowedEqpNames]);

  const heatmapData = useMemo(() => {
    const map = new Map();
    const rows = Array.isArray(latestEqpTxApi?.data) ? latestEqpTxApi.data : [];
    rows.forEach((r) => {
      const dt = parseDateTime(get(r, "TRANSACTION_DATE", "transaction_date",
        "LAST_TRANSACTION_DATE", "last_transaction_date", "DATE_TIME", "date_time"));
      if (!dt) return;
      const t = dt.getTime();
      if (t < filterRange.fromMs || t > filterRange.toMs) return;
      const eqp = get(r, "EQUIPMENT_CODE", "equipment_code", "EqpName", "eqpname", "DEVICE_IMEI");
      if (!eqpAllowed(eqp)) return;
      const wd = dt.getDay();
      const h = dt.getHours();
      const key = `${wd}-${h}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    const out = [];
    for (let wd = 0; wd < 7; wd++) {
      for (let h = 0; h < 24; h++) {
        out.push({ wd, h, v: map.get(`${wd}-${h}`) || 0 });
      }
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestEqpTxApi, filterRange, allowedEqpNames]);

  const processData = useMemo(() => [
    { name: "Import", value: containerStats.imp, fill: T.blue, color: T.blue },
    { name: "Export", value: containerStats.exp, fill: T.pink, color: T.pink },
    { name: "Empty", value: containerStats.empty, fill: T.amber, color: T.amber },
    { name: "Other", value: containerStats.other, fill: T.textMute, color: T.textMute },
  ].filter((d) => d.value > 0), [containerStats]);

  const sizeData = useMemo(() => [
    { name: "20'", value: containerStats.size20, fill: T.cyan, color: T.cyan },
    { name: "40'", value: containerStats.size40, fill: T.indigo, color: T.indigo },
    { name: "40' HQ", value: containerStats.size40hq, fill: T.purple, color: T.purple },
    { name: "Other", value: containerStats.sizeOther, fill: T.textMute, color: T.textMute },
  ].filter((d) => d.value > 0), [containerStats]);

  const topEquipment = useMemo(() => {
    const rows = Array.isArray(latestEqpTxApi?.data) ? latestEqpTxApi.data : [];
    const counts = new Map();
    rows.forEach((r) => {
      const dt = parseDateTime(get(r, "TRANSACTION_DATE", "transaction_date",
        "LAST_TRANSACTION_DATE", "last_transaction_date", "DATE_TIME", "date_time"));
      if (dt) {
        const t = dt.getTime();
        if (t < filterRange.fromMs || t > filterRange.toMs) return;
      }
      const eqp = get(r, "EQUIPMENT_CODE", "equipment_code", "EqpName", "eqpname");
      if (!eqp) return;
      if (!eqpAllowed(eqp)) return;
      counts.set(eqp, (counts.get(eqp) || 0) + 1);
    });
    const arr = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    const max = Math.max(...arr.map((x) => x.count), 1);
    return arr.map((x) => ({ ...x, pct: (x.count / max) * 100 }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestEqpTxApi, filterRange, allowedEqpNames]);

  const totalIn24h = hourlyThroughput.reduce((s, r) => s + r.in, 0);
  const totalOut24h = hourlyThroughput.reduce((s, r) => s + r.out, 0);
  const lastHrIn = hourlyThroughput[hourlyThroughput.length - 1]?.in || 0;
  const prevHrIn = hourlyThroughput[hourlyThroughput.length - 2]?.in || 0;
  const inTrend = prevHrIn > 0 ? ((lastHrIn - prevHrIn) / prevHrIn) * 100 : (lastHrIn > 0 ? 100 : null);

  const avgDwellHrs = useMemo(() => {
    const JAN_2026 = new Date("2026-01-01T00:00:00").getTime();
    let sum = 0, n = 0;
    containers.forEach((c) => {
      const gIn = parseDateTime(get(c, "GATE_IN_DATE", "gate_in_date"));
      if (!gIn || gIn.getTime() < JAN_2026) return;
      const tat = String(get(c, "TIME_IN_YARD", "time_in_yard") || "");
      if (tat.includes(":")) {
        const parts = tat.split(":").map(Number);
        const h = parts.length >= 3 ? parts[0] : parts[0];
        if (Number.isFinite(h) && h >= 0) { sum += h; n++; }
      } else {
        const hrs = (now.getTime() - gIn.getTime()) / 3600000;
        if (hrs >= 0) { sum += hrs; n++; }
      }
    });
    return n > 0 ? sum / n : 0;
  }, [containers, now]);

  // ─── History tracking for sparklines (session-only) ──────────────────────
  const [history, setHistory] = useState({
    inventory: [], active: [], gateIn: [], ocr: [], util: [], dwell: [],
  });

  useEffect(() => {
    setHistory((h) => ({
      inventory: [...h.inventory, containerStats.total].slice(-HISTORY_LEN),
      active: [...h.active, equipmentStats.active].slice(-HISTORY_LEN),
      gateIn: [...h.gateIn, totalIn24h].slice(-HISTORY_LEN),
      ocr: [...h.ocr, ocrStats.pct].slice(-HISTORY_LEN),
      util: [...h.util, dailyUtilPct ?? equipmentStats.utilization].slice(-HISTORY_LEN),
      dwell: [...h.dwell, avgDwellHrs].slice(-HISTORY_LEN),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerStats.total, equipmentStats.active, totalIn24h, ocrStats.pct, equipmentStats.utilization, avgDwellHrs, dailyUtilPct]);

  // ─── Refresh ─────────────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      const sel = filters.equipmentIds;
      let ids;
      if (sel instanceof Set && sel.size > 0) ids = Array.from(sel);
      else if (sel == null) ids = allEquipment.map((e) => e.deviceId).filter(Boolean);
      else ids = [];
      await Promise.all([
        refetchEquipment(),
        refetchLiveStatus(),
        fetchLockReport({
          equipment_names: ids && ids.length > 0 ? ids.join(",") : undefined,
          from_date: filters.from,
          to_date: filters.to,
          report_type: "All",
        }).unwrap().catch(() => {}),
      ]);
    } finally {
      setRefreshing(false);
      setNow(new Date());
    }
  };

  const online = !!(equipmentApi || liveStatusApi);

  // ─── KPI configs (for cards + drill-down) ─────────────────────────────────
  const kpis = useMemo(() => [
    {
      key: "inventory",
      icon: FiPackage,
      label: "Yard Inventory",
      value: containerStats.total,
      sub: `${containerStats.imp} import · ${containerStats.exp} export · ${containerStats.empty} empty`,
      accent: T.cyan,
      loading: liveStatusLoading,
      history: history.inventory,
      breakdown: [
        { name: "Import", value: containerStats.imp, color: T.blue },
        { name: "Export", value: containerStats.exp, color: T.pink },
        { name: "Empty", value: containerStats.empty, color: T.amber },
        { name: "Damaged", value: containerStats.damaged, color: T.red },
      ],
      table: {
        title: "Top 10 Containers (most recent)",
        cols: ["Container No", "Process", "Size", "Location", "Gate In"],
        rows: containers.slice(0, 10).map((c) => [
          get(c, "CONTAINER_NO", "container_no") || "—",
          get(c, "CONTAINER_PROCESS", "container_process") || "—",
          get(c, "CONTAINER_SIZE", "container_size") || "—",
          get(c, "MASTERTABLE", "LOCATION_NAME", "YARD_NAME") || "—",
          get(c, "GATE_IN_DATE", "gate_in_date") || "—",
        ]),
      },
    },
    {
      key: "active",
      icon: FiCpu,
      label: "Active Equipment",
      value: equipmentStats.active,
      suffix: `/${equipmentStats.total}`,
      sub: `${equipmentStats.breakdown} breakdown · ${equipmentStats.idle} idle · ${equipmentStats.total - equipmentStats.active - equipmentStats.idle - equipmentStats.breakdown} offline`,
      accent: T.emerald,
      loading: equipmentLoading,
      history: history.active,
      breakdown: [
        { name: "Active", value: equipmentStats.active, color: T.emerald },
        { name: "Idle", value: equipmentStats.idle, color: T.amber },
        { name: "Breakdown", value: equipmentStats.breakdown, color: T.red },
        { name: "Offline", value: Math.max(equipmentStats.total - equipmentStats.active - equipmentStats.idle - equipmentStats.breakdown, 0), color: T.textMute },
      ],
      table: {
        title: "Equipment status",
        cols: ["Equipment", "Owner", "Status", "Container", "Last Seen"],
        rows: liveEquipment.slice(0, 15).map((e) => [
          e.name,
          e.owner || "—",
          e.status.toUpperCase(),
          e.container || "—",
          fmtRelative(e.lastAt),
        ]),
      },
    },
    {
      key: "gateIn",
      icon: FiTrendingUp,
      label: `Gate-In (${filters.preset === "custom" ? "range" : filters.preset})`,
      value: totalIn24h,
      sub: `Out ${totalOut24h} · Net ${totalIn24h - totalOut24h >= 0 ? "+" : ""}${totalIn24h - totalOut24h}`,
      trend: inTrend,
      accent: T.blue,
      loading: liveStatusLoading,
      history: history.gateIn,
      breakdown: [
        { name: "Gate-In", value: totalIn24h, color: T.blue },
        { name: "Gate-Out", value: totalOut24h, color: T.cyan },
        { name: "Net", value: totalIn24h - totalOut24h, color: T.emerald },
      ],
      table: {
        title: "Hourly throughput",
        cols: ["Hour", "Gate-In", "Gate-Out", "Net"],
        rows: hourlyThroughput.map((h) => [h.label, h.in, h.out, h.net >= 0 ? `+${h.net}` : h.net]),
      },
    },
    {
      key: "util",
      icon: FiZap,
      label: "Utilization",
      value: dailyUtilPct ?? equipmentStats.utilization,
      suffix: "%",
      sub: dailyUtilPct != null
        ? `Yesterday's avg across ${Array.isArray(utilizationApi?.data) ? utilizationApi.data.length : 0} machines`
        : `${equipmentStats.active} active · ${equipmentStats.idle} idle · ${equipmentStats.breakdown} breakdown`,
      accent: T.purple,
      loading: equipmentLoading || utilizationLoading,
      decimals: 1,
      history: history.util,
      breakdown: [
        { name: "Active (tx in range)", value: equipmentStats.active, color: T.emerald },
        { name: "Idle", value: equipmentStats.idle, color: T.amber },
        { name: "Breakdown", value: equipmentStats.breakdown, color: T.red },
        { name: "Total", value: equipmentStats.total, color: T.blue },
      ],
    },
    {
      key: "dwell",
      icon: FiClock,
      label: "Avg Dwell",
      value: avgDwellHrs,
      suffix: "h",
      sub: ` ${ageingBuckets.find(b => b.name === "DAY ABOVE 30")?.count || 0} over 30d · ${containerStats.damaged} damaged`,
      accent: T.amber,
      loading: liveStatusLoading,
      decimals: 1,
      history: history.dwell,
      breakdown: ageingBuckets.map((b) => ({ name: b.name, value: b.count, color: b.color })),
    },
  ], [containerStats, equipmentStats, totalIn24h, totalOut24h, inTrend, ocrStats, equipmentLoading, liveStatusLoading, utilizationLoading, lockLoading, history, avgDwellHrs, ageingBuckets, containers, liveEquipment, hourlyThroughput, dailyUtilPct, utilizationApi]);

  // ─── Equipment table sort/filter ─────────────────────────────────────────
  const sortedEquipment = useMemo(() => {
    const filtered = !eqpSearch
      ? liveEquipment
      : liveEquipment.filter((e) =>
          e.name.toLowerCase().includes(eqpSearch.toLowerCase()) ||
          (e.owner || "").toLowerCase().includes(eqpSearch.toLowerCase()) ||
          (e.container || "").toLowerCase().includes(eqpSearch.toLowerCase())
        );
    const order = { breakdown: 0, active: 1, idle: 2, offline: 3 };
    const sorted = [...filtered].sort((a, b) => {
      const { key, dir } = eqpSort;
      let av = a[key], bv = b[key];
      if (key === "status") { av = order[a.status]; bv = order[b.status]; }
      if (key === "lastAt") { av = a.lastAt?.getTime() || 0; bv = b.lastAt?.getTime() || 0; }
      if (av == null) av = "";
      if (bv == null) bv = "";
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [liveEquipment, eqpSort, eqpSearch]);

  const handleEqpSort = (key) => {
    setEqpSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));
  };

  const SortIcon = ({ col }) =>
    eqpSort.key !== col
      ? <FiChevronUp className="w-3 h-3 opacity-30" />
      : eqpSort.dir === "asc"
        ? <FiChevronUp className="w-3 h-3 text-cyan-400" />
        : <FiChevronDown className="w-3 h-3 text-cyan-400" />;

  const statusColor = (s) => ({
    active: T.emerald, idle: T.amber, breakdown: T.red, offline: T.textMute,
  })[s] || T.textMute;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      className="w-full min-h-screen relative"
      style={{ background: "linear-gradient(145deg, #f0f4ff 0%, #e8eeff 40%, #f0f7ff 100%)" }}
    >
      <div className="fixed inset-0 pointer-events-none" style={{ opacity: 0.35,
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(99,102,241,0.12) 1px, transparent 0)`,
        backgroundSize: "40px 40px",
      }} />

      <div className="relative z-10 min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-1 px-3 md:px-6 py-4 md:py-6 space-y-4 md:space-y-5">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1 h-6 rounded-full bg-gradient-to-b from-cyan-400 via-blue-500 to-indigo-600" />
                <span className="text-[10px] uppercase tracking-[0.3em] font-black" style={{ color: T.cyan }}>YMS COMMAND</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight" style={{
                background: "linear-gradient(135deg, #0f172a, #4f46e5)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                Operations Command Center
              </h1>
              <p className="text-xs md:text-sm mt-1" style={{ color: T.textDim }}>
                {now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "short", day: "numeric" })}
                <span className="mx-2" style={{ color: T.textMute }}>·</span>
                <span className="font-mono tabular-nums">{now.toLocaleTimeString()}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black ${online ? "text-emerald-700" : "text-rose-700"}`}
                style={{
                  background: online ? "#ecfdf5" : "#fef2f2",
                  border: `1px solid ${online ? "#a7f3d0" : "#fecaca"}`,
                  boxShadow: "none",
                }}>
                {online ? <FiWifi className="w-3.5 h-3.5" /> : <FiWifiOff className="w-3.5 h-3.5" />}
                <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                {online ? "LIVE" : "OFFLINE"}
              </div>
              <button
                onClick={handleRefreshAll}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-700 text-xs font-black hover:bg-indigo-50 transition-all disabled:opacity-60"
                style={{ background: "white", border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
              >
                <FiRefreshCw className={`w-3.5 h-3.5 ${refreshing || equipmentFetching ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* ── Filter Bar ─────────────────────────────────────── */}
          <div className="rounded-2xl relative z-40"
            style={{
              background: "linear-gradient(145deg, #ffffff, #f8faff)",
              border: `1px solid ${T.border}`,
              boxShadow: "0 2px 12px -2px rgba(99,102,241,0.08), 0 1px 3px rgba(0,0,0,0.05)",
            }}>
            <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
              {/* Title + active filter count */}
              <div className="flex items-center gap-2 mr-1">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${T.cyan}15`, color: T.cyan }}>
                  <FiFilter className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: T.text }}>Filters</div>
                {activeFilterCount > 0 && (
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                    style={{ background: T.cyan, color: T.bg }}>
                    {activeFilterCount}
                  </span>
                )}
              </div>

              {/* Date Range Presets */}
              <div className="inline-flex items-center gap-0.5 rounded-lg p-0.5"
                style={{ background: "rgba(0,0,0,0.04)", border: `1px solid ${T.border}` }}>
                {[
                  { v: "today",  l: "Today" },
                  { v: "24h",    l: "24h" },
                  { v: "shift",  l: "Shift" },
                  { v: "7d",     l: "7d" },
                  { v: "30d",    l: "30d" },
                  { v: "custom", l: "Custom" },
                ].map((p) => (
                  <button key={p.v}
                    onClick={() => p.v === "custom" ? setFilters((f) => ({ ...f, preset: "custom" })) : applyPreset(p.v)}
                    className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                      filters.preset === p.v
                        ? "bg-white shadow text-indigo-600"
                        : "text-slate-400 hover:text-slate-700 hover:bg-white/60"
                    }`}>
                    {p.l}
                  </button>
                ))}
              </div>

              {/* Custom date inputs (only when preset === custom) */}
              {filters.preset === "custom" && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="datetime-local"
                    value={filters.from}
                    onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value, preset: "custom" }))}
                    className="px-2 py-1 rounded-md text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    style={{ background: "white", border: `1px solid ${T.border}`, colorScheme: "light" }}
                  />
                  <span className="text-[10px]" style={{ color: T.textMute }}>→</span>
                  <input
                    type="datetime-local"
                    value={filters.to}
                    onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value, preset: "custom" }))}
                    className="px-2 py-1 rounded-md text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    style={{ background: "white", border: `1px solid ${T.border}`, colorScheme: "light" }}
                  />
                </div>
              )}

              {/* Equipment multi-select */}
              <div ref={eqpDDRef} className="relative">
                <button
                  onClick={() => setShowEqpDD((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black text-slate-700 hover:bg-indigo-50 transition-colors"
                  style={{ background: "white", border: `1px solid ${T.border}`, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                  <FiCpu className="w-3 h-3" style={{ color: T.emerald }} />
                  Equipment
                  <span className="text-[10px] tabular-nums" style={{ color: T.cyan }}>
                    {filters.equipmentIds == null ? `All ${allEquipment.length}` : `${filters.equipmentIds.size}/${allEquipment.length}`}
                  </span>
                  <FiChevronDown className={`w-3 h-3 transition-transform ${showEqpDD ? "rotate-180" : ""}`} style={{ color: T.textMute }} />
                </button>
                {showEqpDD && (
                  <div className="absolute z-50 top-full mt-1.5 left-0 w-72 rounded-xl overflow-hidden flex flex-col max-h-80"
                    style={{ background: "white", border: `1px solid ${T.border}`, boxShadow: "0 16px 48px rgba(99,102,241,0.15), 0 4px 12px rgba(0,0,0,0.08)" }}>
                    <div className="p-2 border-b" style={{ borderColor: T.border }}>
                      <div className="relative">
                        <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: T.textMute }} />
                        <input
                          type="text"
                          placeholder="Search equipment…"
                          value={eqpFilterSearch}
                          onChange={(e) => setEqpFilterSearch(e.target.value)}
                          className="w-full pl-7 pr-2 py-1.5 rounded-md text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          style={{ background: "#f8fafc", border: `1px solid ${T.border}` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: T.border }}>
                      <button onClick={setEquipmentAll}
                        className="text-[10px] font-black uppercase tracking-wider hover:text-white transition-colors"
                        style={{ color: T.cyan }}>
                        ✓ Select All
                      </button>
                      <button onClick={setEquipmentNone}
                        className="text-[10px] font-black uppercase tracking-wider hover:text-white transition-colors"
                        style={{ color: T.textMute }}>
                        Clear
                      </button>
                    </div>
                    <div className="overflow-y-auto flex-1 p-1">
                      {allEquipment
                        .filter((e) => !eqpFilterSearch || e.name.toLowerCase().includes(eqpFilterSearch.toLowerCase()))
                        .map((e) => {
                          const sel = filters.equipmentIds;
                          const checked = sel == null ? true : (e.deviceId && sel.has(e.deviceId));
                          return (
                            <button key={e.id}
                              onClick={() => {
                                if (filters.equipmentIds == null) {
                                  // turn into explicit "all" Set, then toggle this one off
                                  const next = new Set(allEquipment.map((x) => x.deviceId).filter(Boolean));
                                  if (e.deviceId) next.delete(e.deviceId);
                                  setFilters((f) => ({ ...f, equipmentIds: next }));
                                } else {
                                  toggleEquipment(e.deviceId);
                                }
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-indigo-50 transition-colors text-left">
                              <span className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors`}
                                style={{
                                  background: checked ? T.cyan : "transparent",
                                  borderColor: checked ? T.cyan : T.border,
                                  boxShadow: "none",
                                }}>
                                {checked && <span className="text-[8px] font-black text-white">✓</span>}
                              </span>
                              <span className="text-xs font-bold truncate" style={{ color: T.text }}>{e.name}</span>
                              <span className="ml-auto text-[10px] font-mono truncate shrink-0" style={{ color: T.textMute }}>
                                {e.deviceId || "—"}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Process chips */}
              <div className="inline-flex items-center gap-1 ml-1">
                <span className="text-[9px] font-black uppercase tracking-wider mr-0.5" style={{ color: T.textMute }}>Process</span>
                {[
                  { v: "import", l: "Import", c: T.blue },
                  { v: "export", l: "Export", c: T.pink },
                  { v: "empty",  l: "Empty",  c: T.amber },
                ].map((p) => {
                  const active = filters.processes.has(p.v);
                  return (
                    <button key={p.v}
                      onClick={() => toggleSetItem("processes", p.v)}
                      className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all"
                      style={{
                        background: active ? `${p.c}18` : "rgba(0,0,0,0.03)",
                        color: active ? p.c : T.textMute,
                        border: `1px solid ${active ? p.c + "50" : T.border}`,
                        boxShadow: "none",
                      }}>
                      {p.l}
                    </button>
                  );
                })}
              </div>

              {/* Size chips */}
              <div className="inline-flex items-center gap-1">
                <span className="text-[9px] font-black uppercase tracking-wider mr-0.5" style={{ color: T.textMute }}>Size</span>
                {[
                  { v: "20",   l: "20'",     c: T.cyan },
                  { v: "40",   l: "40'",     c: T.indigo },
                  { v: "40hq", l: "40' HQ",  c: T.purple },
                ].map((p) => {
                  const active = filters.sizes.has(p.v);
                  return (
                    <button key={p.v}
                      onClick={() => toggleSetItem("sizes", p.v)}
                      className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all"
                      style={{
                        background: active ? `${p.c}18` : "rgba(0,0,0,0.03)",
                        color: active ? p.c : T.textMute,
                        border: `1px solid ${active ? p.c + "50" : T.border}`,
                        boxShadow: "none",
                      }}>
                      {p.l}
                    </button>
                  );
                })}
              </div>

              {/* Reset */}
              <button onClick={resetFilters}
                className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-red-50 transition-colors"
                style={{ background: "white", border: `1px solid ${T.border}`, color: T.textDim }}>
                <FiX className="w-3 h-3" />
                Reset
              </button>
            </div>
            {/* Active filter summary line */}
            <div className="px-4 pb-2 text-[10px] flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: T.textMute }}>
              <span className="tabular-nums">
                <span className="font-black" style={{ color: T.cyan }}>{containers.length}</span>
                <span> / {containersAll.length} containers</span>
              </span>
              <span>·</span>
              <span className="tabular-nums">
                <span className="font-black" style={{ color: T.emerald }}>{filteredEquipment.length}</span>
                <span> / {allEquipment.length} equipment</span>
              </span>
              <span>·</span>
              <span className="font-mono">
                {filters.from.replace("T", " ")} → {filters.to.replace("T", " ")}
              </span>
            </div>
          </div>

          {/* KPI Row — clickable cards with sparklines */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            {kpis.map((k) => (
              <KpiCard
                key={k.key}
                icon={k.icon}
                label={k.label}
                value={k.value}
                suffix={k.suffix}
                sub={k.sub}
                trend={k.trend}
                accent={k.accent}
                loading={k.loading}
                decimals={k.decimals}
                history={k.history}
                onClick={() => setDrill(k)}
              />
            ))}
          </div>

          {/* Main chart row */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 md:gap-4">
            {/* Throughput with chart type switcher */}
            <Panel
              title={`Gate Throughput · ${filters.preset === "custom" ? "Range" : filters.preset.toUpperCase()}`}
              subtitle={filterRange.toMs - filterRange.fromMs > 25 * 3600 * 1000 ? "Daily in/out — driven by current filters" : "Hourly in/out — driven by current filters"}
              icon={FiActivity}
              accent={T.cyan}
              className="xl:col-span-12 h-[380px]"
              right={
                <ViewSwitch
                  value={chartView}
                  onChange={setChartView}
                  options={[
                    { value: "area", label: "Area", icon: FiActivity },
                    { value: "bar", label: "Bar", icon: FiBarChart2 },
                    { value: "line", label: "Line", icon: FiTrendingUp },
                    { value: "composed", label: "Mixed", icon: FiZap },
                    { value: "table", label: "Table", icon: FiList },
                  ]}
                />
              }
            >
              <div className="flex items-center gap-6 mb-3 text-[10px] font-black">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: T.cyan }} />
                  <span style={{ color: T.textDim }}>IN</span>
                  <span className="font-black tabular-nums" style={{ color: T.text }}>{totalIn24h}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: T.pink }} />
                  <span style={{ color: T.textDim }}>OUT</span>
                  <span className="font-black tabular-nums" style={{ color: T.text }}>{totalOut24h}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: T.amber }} />
                  <span style={{ color: T.textDim }}>NET</span>
                  <span className="font-black tabular-nums" style={{ color: T.text }}>{totalIn24h - totalOut24h >= 0 ? "+" : ""}{totalIn24h - totalOut24h}</span>
                </span>
              </div>
              <div className="flex-1 min-h-0">
                {chartView === "table" ? (
                  <DataTable
                    cols={[
                      { label: filterRange.toMs - filterRange.fromMs > 25 * 3600 * 1000 ? "Day" : "Hour", key: "label", bold: true },
                      { label: "Gate-In", key: "in", align: "right",
                        render: (v) => <span style={{ color: T.cyan }}>{fmtNumber(v)}</span> },
                      { label: "Gate-Out", key: "out", align: "right",
                        render: (v) => <span style={{ color: T.pink }}>{fmtNumber(v)}</span> },
                      { label: "Net", key: "net", align: "right",
                        render: (v) => <span style={{ color: v >= 0 ? T.emerald : T.red }}>{v >= 0 ? `+${v}` : v}</span> },
                    ]}
                    rows={hourlyThroughput}
                    footerRow={["Total", fmtNumber(totalIn24h), fmtNumber(totalOut24h), `${totalIn24h - totalOut24h >= 0 ? "+" : ""}${totalIn24h - totalOut24h}`]}
                  />
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {chartView === "area" ? (
                    <AreaChart data={hourlyThroughput} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="thIn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={T.cyan} stopOpacity={0.5} />
                          <stop offset="100%" stopColor={T.cyan} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="thOut" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={T.pink} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={T.pink} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.textMute, fontWeight: 700 }} />
                      <YAxis domain={[0, 'auto']} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.textMute, fontWeight: 700 }} width={32} />
                      <Tooltip content={<Tip />} />
                      <Area type="monotone" dataKey="in" name="In" stroke={T.cyan} strokeWidth={2.5} fill="url(#thIn)" />
                      <Area type="monotone" dataKey="out" name="Out" stroke={T.pink} strokeWidth={2.5} fill="url(#thOut)" />
                    </AreaChart>
                  ) : chartView === "bar" ? (
                    <BarChart data={hourlyThroughput} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.textMute, fontWeight: 700 }} />
                      <YAxis domain={[0, 'auto']} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.textMute, fontWeight: 700 }} width={32} />
                      <Tooltip content={<Tip />} cursor={{ fill: "rgba(99,102,241,0.04)" }} />
                      <Bar dataKey="in" name="In" fill={T.cyan} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="out" name="Out" fill={T.pink} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : chartView === "line" ? (
                    <LineChart data={hourlyThroughput} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.textMute, fontWeight: 700 }} />
                      <YAxis domain={[0, 'auto']} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.textMute, fontWeight: 700 }} width={32} />
                      <Tooltip content={<Tip />} />
                      <Line type="monotone" dataKey="in" name="In" stroke={T.cyan} strokeWidth={3} dot={{ fill: T.cyan, r: 3 }} />
                      <Line type="monotone" dataKey="out" name="Out" stroke={T.pink} strokeWidth={3} dot={{ fill: T.pink, r: 3 }} />
                    </LineChart>
                  ) : (
                    <ComposedChart data={hourlyThroughput} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.textMute, fontWeight: 700 }} />
                      <YAxis domain={[0, 'auto']} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.textMute, fontWeight: 700 }} width={32} />
                      <Tooltip content={<Tip />} />
                      <Bar dataKey="in" name="In" fill={T.cyan} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="out" name="Out" fill={T.pink} radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="net" name="Net" stroke={T.amber} strokeWidth={3} dot={{ fill: T.amber, r: 3 }} />
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
                )}
              </div>
            </Panel>
          </div>

          {/* Process Mix + Yard Inventory */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 md:gap-4">
            {/* Process donut with center */}
            <Panel title="Process Mix" icon={FiPieChart} accent={T.blue} className="xl:col-span-4 h-[340px]"
              right={
                <ViewSwitch
                  value={processView}
                  onChange={setProcessView}
                  options={[
                    { value: "donut", label: "Donut", icon: FiPieChart },
                    { value: "table", label: "Table", icon: FiList },
                  ]}
                />
              }
            >
              {processData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs" style={{ color: T.textMute }}>No data</div>
              ) : processView === "table" ? (
                <DataTable
                  cols={[
                    { label: "Process", key: "name", bold: true,
                      render: (v, r) => (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                          {v}
                        </span>
                      ),
                    },
                    { label: "Count", key: "value", align: "right" },
                    { label: "%", align: "right",
                      render: (_, r) => `${containerStats.total > 0 ? (r.value / containerStats.total * 100).toFixed(1) : "0"}%` },
                  ]}
                  rows={processData}
                  footerRow={["Total", fmtNumber(containerStats.total), "100%"]}
                />
              ) : (
                <>
                  <div className="flex-1 min-h-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={processData} innerRadius="62%" outerRadius="92%" paddingAngle={3} dataKey="value" stroke="none">
                          {processData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip content={<Tip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <div className="text-2xl md:text-3xl font-black tabular-nums leading-none" style={{ color: T.text }}>{fmtCompact(containerStats.total)}</div>
                      <div className="text-[9px] uppercase tracking-widest font-black mt-1" style={{ color: T.textMute }}>TEUs in yard</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mt-3">
                    {processData.map((d) => (
                      <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="truncate" style={{ color: T.textDim }}>{d.name}</span>
                        <span className="ml-auto font-black tabular-nums" style={{ color: T.text }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Panel>

            {/* Yard Inventory — only locations present in backend data */}
            <Panel title="Yard Inventory" subtitle={`${yardInventoryData.length} blocks`} icon={FiLayers}
              accent={T.teal} className="xl:col-span-8 h-[340px]"
              right={
                <ViewSwitch value={yardInvView} onChange={setYardInvView}
                  options={[
                    { value: "table", label: "Table", icon: FiList },
                    { value: "chart", label: "Chart", icon: FiBarChart2 },
                  ]}
                />
              }
            >
              {yardInventoryData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs" style={{ color: T.textMute }}>No yard data</div>
              ) : yardInvView === "chart" ? (
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yardInventoryData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="location" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: T.textDim, fontWeight: 700 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.textMute }} />
                      <Tooltip content={<Tip />} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                      <Bar dataKey="s20" name="20ft" stackId="a" fill={T.cyan} radius={[0, 0, 0, 0]} barSize={28} />
                      <Bar dataKey="s40" name="40ft" stackId="a" fill={T.teal} radius={[4, 4, 0, 0]} barSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <DataTable
                  cols={[
                    { label: "Block", key: "location", bold: true },
                    { label: "20'", key: "s20", align: "right", render: (v) => <span style={{ color: T.cyan }}>{fmtNumber(v)}</span> },
                    { label: "40'", key: "s40", align: "right", render: (v) => <span style={{ color: T.teal }}>{fmtNumber(v)}</span> },
                    { label: "Count", key: "count", align: "right", render: (v) => <b>{fmtNumber(v)}</b> },
                    { label: "TEUs", key: "teus", align: "right", render: (v) => <span style={{ color: T.blue }}>{fmtNumber(v)}</span> },
                  ]}
                  rows={yardInventoryData}
                  footerRow={[
                    "Total",
                    fmtNumber(yardInventoryData.reduce((s, r) => s + r.s20, 0)),
                    fmtNumber(yardInventoryData.reduce((s, r) => s + r.s40, 0)),
                    fmtNumber(yardInventoryData.reduce((s, r) => s + r.count, 0)),
                    fmtNumber(yardInventoryData.reduce((s, r) => s + r.teus, 0)),
                  ]}
                />
              )}
            </Panel>

          </div>

          {/* ── Equipment Daily Utilization ─────────────────────────────── */}
          <UtilizationSection
            fetchUtilization={fetchUtilization}
            utilizationApi={utilizationApi}
            utilizationLoading={utilizationLoading}
            allEquipment={allEquipment}
          />

          {/* ── Daily Equipment Moves Count ─────────────────────────────── */}
          <Panel title="Daily Equipment Moves Count" subtitle="Moves per machine · utilization overlay" icon={FiBarChart2} accent={T.blue}>
            <MovesCountChart utilizationApi={utilizationApi} />
          </Panel>

          {/* Ageing + In/Out side by side */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 md:gap-4">
            <Panel title="Container Ageing" subtitle="Dwell time distribution" icon={FiClock}
              accent={T.amber} className="xl:col-span-7 h-[320px]"
              right={
                <div className="flex items-center gap-2">
                  {ageingView === "table" && (
                    <button
                      onClick={() => {
                        const ageTotal = ageingBuckets.reduce((s, b) => s + b.count, 0);
                        const ws = XLSX.utils.json_to_sheet(
                          ageingBuckets.map((b) => ({
                            "Day Range": b.label,
                            "Import": b.import,
                            "Export": b.export,
                            "Domestic": b.domestic,
                            "Empty": b.empty,
                            "Total": b.count,
                            "Utilized(%)": ageTotal > 0 ? +((b.count / ageTotal) * 100).toFixed(2) : 0,
                          }))
                        );
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, "ContainerAgeing");
                        XLSX.writeFile(wb, `ContainerAgeing_${new Date().toISOString().slice(0,10)}.xlsx`);
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                    >
                      ↓ Excel
                    </button>
                  )}
                  <ViewSwitch
                    value={ageingView}
                    onChange={setAgeingView}
                    options={[
                      { value: "chart", label: "Chart", icon: FiBarChart2 },
                      { value: "table", label: "Table", icon: FiList },
                    ]}
                  />
                </div>
              }
            >
              {ageingView === "table" ? (
                (() => {
                  const ageTotal = ageingBuckets.reduce((s, b) => s + b.count, 0);
                  const totImp  = ageingBuckets.reduce((s, b) => s + b.import, 0);
                  const totExp  = ageingBuckets.reduce((s, b) => s + b.export, 0);
                  const totDom  = ageingBuckets.reduce((s, b) => s + b.domestic, 0);
                  const totEmp  = ageingBuckets.reduce((s, b) => s + b.empty, 0);
                  const thCls = "px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide border-r border-white/20 last:border-r-0";
                  const tdCls = "px-2 py-2 text-center text-xs border-r border-slate-100 last:border-r-0";
                  return (
                    <div className="flex-1 min-h-0 overflow-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#0e4a78] text-white sticky top-0 z-10">
                            <th className={`${thCls} text-left`}>#</th>
                            <th className={`${thCls} text-left`}>Day Range</th>
                            <th className={thCls}>Import</th>
                            <th className={thCls}>Export</th>
                            <th className={thCls}>Domestic</th>
                            <th className={thCls}>Empty</th>
                            <th className={thCls}>Total</th>
                            <th className={`${thCls} last:border-r-0`}>Utilized(%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ageingBuckets.map((b, i) => (
                            <tr key={b.name} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                              <td className={`${tdCls} text-slate-400 font-semibold text-left`}>{i + 1}</td>
                              <td className={`${tdCls} text-left`}>
                                <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: b.color }} />
                                  {b.label}
                                </span>
                              </td>
                              <td className={`${tdCls} font-semibold text-purple-700`}>{b.import.toLocaleString()}</td>
                              <td className={`${tdCls} font-semibold text-teal-700`}>{b.export.toLocaleString()}</td>
                              <td className={`${tdCls} font-semibold text-blue-700`}>{b.domestic.toLocaleString()}</td>
                              <td className={`${tdCls} font-semibold text-slate-500`}>{b.empty.toLocaleString()}</td>
                              <td className={`${tdCls} font-bold text-slate-800`}>{b.count.toLocaleString()}</td>
                              <td className={`${tdCls} font-bold`} style={{ color: b.color }}>
                                {ageTotal > 0 ? ((b.count / ageTotal) * 100).toFixed(2) : "0.00"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-[#0e4a78] text-white font-bold sticky bottom-0">
                            <td className={`${tdCls} text-left border-slate-600`} colSpan={2}>Total</td>
                            <td className={`${tdCls} border-slate-600`}>{totImp.toLocaleString()}</td>
                            <td className={`${tdCls} border-slate-600`}>{totExp.toLocaleString()}</td>
                            <td className={`${tdCls} border-slate-600`}>{totDom.toLocaleString()}</td>
                            <td className={`${tdCls} border-slate-600`}>{totEmp.toLocaleString()}</td>
                            <td className={`${tdCls} border-slate-600`}>{ageTotal.toLocaleString()}</td>
                            <td className={`${tdCls} border-slate-600`}>100.00</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })()
              ) : (
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageingBuckets} layout="vertical" margin={{ top: 5, right: 8, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.06)" />
                    <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.textMute, fontWeight: 700 }} />
                    <YAxis dataKey="name" type="category" width={90} tickLine={false} axisLine={false}
                      tick={{ fontSize: 10, fill: T.textDim, fontWeight: 800 }} />
                    <Tooltip content={<Tip />} cursor={{ fill: "rgba(99,102,241,0.04)" }} />
                    <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={20}>
                      {ageingBuckets.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              )}
            </Panel>

            {/* Container In/Out Monthly */}
            <Panel title="Container In / Out" subtitle="Monthly gate-in vs gate-out · last 6 months" icon={FiTrendingUp}
              accent={T.blue} className="xl:col-span-5 h-[300px]"
              right={
                <ViewSwitch value={inOutView} onChange={setInOutView}
                  options={[
                    { value: "chart", label: "Chart", icon: FiBarChart2 },
                    { value: "table", label: "Table", icon: FiList },
                  ]}
                />
              }
            >
              {containerInOutData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs" style={{ color: T.textMute }}>
                  {statusReportLoading ? "Loading…" : "No gate-in/out data for the last 6 months"}
                </div>
              ) : inOutView === "table" ? (
                <DataTable
                  cols={[
                    { label: "Month", key: "month", bold: true },
                    { label: "Gate In", key: "in", align: "right", render: (v) => <span style={{ color: T.cyan }}>{fmtNumber(v)}</span> },
                    { label: "Gate Out", key: "out", align: "right", render: (v) => <span style={{ color: T.red }}>{fmtNumber(v)}</span> },
                    { label: "Net", align: "right", render: (_, r) => {
                      const net = r.in - r.out;
                      return <span style={{ color: net >= 0 ? T.emerald : T.red, fontWeight: 800 }}>{net >= 0 ? "+" : ""}{fmtNumber(net)}</span>;
                    }},
                  ]}
                  rows={containerInOutData}
                />
              ) : (
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={containerInOutData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.textMute, fontWeight: 700 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.textMute }} />
                      <Tooltip content={<Tip />} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                      <Bar dataKey="in" name="Gate In" fill={T.cyan} fillOpacity={0.9} radius={[4, 4, 0, 0]} barSize={18} />
                      <Bar dataKey="out" name="Gate Out" fill={T.red} fillOpacity={0.7} radius={[4, 4, 0, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>

          {/* Shipping Line + Size Distribution */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 md:gap-4">
            <Panel title="Shipping Line Wise Inventory" subtitle="Container count by line · 20ft vs 40ft" icon={FiBarChart2}
              accent={T.indigo} className="xl:col-span-8 h-[340px]"
              right={
                <ViewSwitch value={shippingView} onChange={setShippingView}
                  options={[
                    { value: "chart", label: "Chart", icon: FiBarChart2 },
                    { value: "table", label: "Table", icon: FiList },
                  ]}
                />
              }
            >
              {shippingView === "table" ? (
                <DataTable
                  cols={[
                    { label: "Line", key: "name", bold: true },
                    { label: "20ft", key: "size20", align: "right", render: (v) => <span style={{ color: T.cyan }}>{v}</span> },
                    { label: "40ft", key: "size40", align: "right", render: (v) => <span style={{ color: T.indigo }}>{v}</span> },
                    { label: "Total", key: "total", align: "right", render: (v) => <b>{v}</b> },
                    { label: "%", align: "right", render: (_, r) => <span style={{ color: T.textMute }}>{r.pct}%</span> },
                  ]}
                  rows={shippingLineData}
                  footerRow={["Total",
                    fmtNumber(shippingLineData.reduce((s, r) => s + r.size20, 0)),
                    fmtNumber(shippingLineData.reduce((s, r) => s + r.size40, 0)),
                    fmtNumber(shippingLineData.reduce((s, r) => s + r.total, 0)),
                    "100%"]}
                />
              ) : (
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={shippingLineData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.textMute, fontWeight: 700 }} />
                      <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.textMute }} />
                      <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.textMute }}
                        tickFormatter={(v) => `${v}%`} />
                      <Tooltip content={<Tip />} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                      <Bar yAxisId="left" dataKey="size20" name="Size 20" stackId="a" fill={T.cyan} radius={[0, 0, 0, 0]} barSize={18} />
                      <Bar yAxisId="left" dataKey="size40" name="Size 40" stackId="a" fill={T.indigo} radius={[4, 4, 0, 0]} barSize={18} />
                      <Line yAxisId="right" type="monotone" dataKey="pct" name="%" stroke={T.emerald} strokeWidth={2} dot={{ r: 3, fill: T.emerald }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            {/* Size Distribution */}
            <Panel title="Size Distribution" icon={FiBox} accent={T.purple} className="xl:col-span-4 h-[340px]"
              right={
                <ViewSwitch value={sizeView} onChange={setSizeView}
                  options={[
                    { value: "chart", label: "Chart", icon: FiBarChart2 },
                    { value: "table", label: "Table", icon: FiList },
                  ]}
                />
              }
            >
              {sizeData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs" style={{ color: T.textMute }}>No data</div>
              ) : sizeView === "table" ? (
                <DataTable
                  cols={[
                    { label: "Size", key: "name", bold: true,
                      render: (v, r) => (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                          {v}
                        </span>
                      ),
                    },
                    { label: "Count", key: "value", align: "right" },
                    { label: "%", align: "right",
                      render: (_, r) => `${containerStats.total > 0 ? (r.value / containerStats.total * 100).toFixed(1) : "0"}%` },
                  ]}
                  rows={sizeData}
                  footerRow={["Total", fmtNumber(containerStats.total), "100%"]}
                />
              ) : (
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sizeData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        {sizeData.map((d, i) => (
                          <linearGradient key={i} id={`szg-${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={d.color} stopOpacity={1} />
                            <stop offset="100%" stopColor={d.color} stopOpacity={0.4} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: T.textDim, fontWeight: 800 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.textMute, fontWeight: 700 }} width={32} />
                      <Tooltip content={<Tip />} cursor={{ fill: "rgba(99,102,241,0.04)" }} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {sizeData.map((d, i) => <Cell key={i} fill={`url(#szg-${i})`} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

          </div>

          {/* Equipment Table + Top Performers + Live Activity */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 md:gap-4">
            {/* Equipment table with search & sort */}
            <Panel
              title="Equipment Fleet"
              subtitle={`${equipmentStats.active} active · ${equipmentStats.idle} idle · ${equipmentStats.breakdown} breakdown`}
              icon={FiCpu}
              accent={T.emerald}
              className="xl:col-span-7 h-[440px]"
              noPad
              right={
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: T.textMute }} />
                    <input
                      type="text"
                      placeholder="Search…"
                      value={eqpSearch}
                      onChange={(e) => setEqpSearch(e.target.value)}
                      className="pl-7 pr-2 py-1 rounded-md text-[11px] w-32 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      style={{ background: "white", border: `1px solid ${T.border}` }}
                    />
                  </div>
                  <ViewSwitch
                    value={eqpView}
                    onChange={setEqpView}
                    options={[
                      { value: "table", label: "Table", icon: FiList },
                      { value: "cards", label: "Cards", icon: FiGrid },
                    ]}
                  />
                </div>
              }
            >
              {eqpView === "table" ? (
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10" style={{ background: "#f8fafc", backdropFilter: "blur(8px)" }}>
                      <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                        {[
                          { k: "name", label: "Equipment" },
                          { k: "status", label: "Status" },
                          { k: "owner", label: "Owner" },
                          { k: "container", label: "Container" },
                          { k: "lastAt", label: "Last Tx (filter range)" },
                        ].map((c) => (
                          <th key={c.k}
                            onClick={() => handleEqpSort(c.k)}
                            className="px-3 py-2.5 text-left font-black uppercase tracking-wider text-[10px] cursor-pointer hover:bg-indigo-50 select-none transition-colors"
                            style={{ color: T.textMute }}>
                            <div className="flex items-center gap-1">
                              {c.label}
                              <SortIcon col={c.k} />
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEquipment.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-8 text-xs" style={{ color: T.textMute }}>No equipment</td></tr>
                      ) : sortedEquipment.map((e) => (
                        <tr key={e.id} className="hover:bg-indigo-50/50 transition-colors" style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td className="px-3 py-2.5 font-black" style={{ color: T.text }}>{e.name}</td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                              style={{
                                background: `${statusColor(e.status)}15`,
                                color: statusColor(e.status),
                                border: `1px solid ${statusColor(e.status)}40`,
                              }}>
                              <span className={`w-1.5 h-1.5 rounded-full ${e.status === "active" || e.status === "breakdown" ? "animate-pulse" : ""}`}
                                style={{ background: statusColor(e.status) }} />
                              {e.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5" style={{ color: T.textDim }}>{e.owner || "—"}</td>
                          <td className="px-3 py-2.5 font-mono font-bold" style={{ color: e.container ? T.cyan : T.textMute }}>
                            {e.container || "—"}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-[10px]" style={{ color: e.lastTx ? T.emerald : T.textMute }}>
                            {e.lastTx ?? fmtRelative(e.lastAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 lg:grid-cols-3 gap-2 content-start">
                  {sortedEquipment.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-xs" style={{ color: T.textMute }}>No equipment</div>
                  ) : sortedEquipment.map((e) => {
                    const col = statusColor(e.status);
                    return (
                      <div key={e.id} className="rounded-xl p-2.5 transition-all hover:scale-[1.02]"
                        style={{ background: "white", border: `1px solid ${col}30`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black truncate" style={{ color: T.text }}>{e.name}</span>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${e.status === "active" || e.status === "breakdown" ? "animate-pulse" : ""}`}
                            style={{ background: col }} />
                        </div>
                        <div className="text-[10px] truncate" style={{ color: T.textDim }}>{e.owner || "—"}</div>
                        <div className="flex items-center justify-between mt-1.5 text-[10px]">
                          <span className="font-mono font-bold truncate" style={{ color: e.container ? T.cyan : T.textMute }}>
                            {e.container || "—"}
                          </span>
                          <span className="shrink-0 ml-2 tabular-nums" style={{ color: T.textMute }}>{fmtRelative(e.lastAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            {/* Per-Machine Utilization */}
            <Panel title="Equipment Utilization" subtitle={`${equipmentStats.active} active · ${equipmentStats.idle} idle · ${equipmentStats.breakdown} breakdown (filter range)`} icon={FiZap}
              accent={T.purple} className="xl:col-span-5 h-[440px]"
            >
              {equipmentStats.perMachine.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs" style={{ color: T.textMute }}>No equipment data</div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2 -mx-1 px-1">
                  {equipmentStats.perMachine.map((m, i) => {
                    const col = m.isBreakdown ? T.red : m.isActive ? T.emerald : T.textMute;
                    const label = m.isBreakdown ? "BREAKDOWN" : m.isActive ? "ACTIVE" : "IDLE/OFFLINE";
                    return (
                      <div key={m.name} className="rounded-xl px-3 py-2.5"
                        style={{ background: "white", border: `1px solid ${m.isActive ? T.emerald+"33" : T.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${m.isActive ? "animate-pulse" : ""}`}
                              style={{ background: col, boxShadow: m.isActive ? `0 0 6px ${col}` : "none" }} />
                            <span className="text-xs font-black truncate" style={{ color: T.text }}>{m.name}</span>
                          </div>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                            style={{ background: `${col}15`, color: col, border: `1px solid ${col}40` }}>
                            {label}
                          </span>
                        </div>
                        {m.lastTx && (
                          <div className="text-[9px] mt-0.5 truncate" style={{ color: T.textMute }}>
                            Last tx: {m.lastTx}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          {/* Footer status bar */}
          <div className="rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-[11px]"
            style={{ background: "white", border: `1px solid ${T.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <div className="flex items-center gap-4 flex-wrap" style={{ color: T.textDim }}>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: T.emerald }} />
                <span className="font-black" style={{ color: T.text }}>Equipment</span> · 15s
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: T.blue }} />
                <span className="font-black" style={{ color: T.text }}>Inventory</span> · 30s
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: T.amber }} />
                <span className="font-black" style={{ color: T.text }}>Transactions</span> · 20s
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: T.pink }} />
                <span className="font-black" style={{ color: T.text }}>OCR</span> · 9AM→9AM
              </span>
            </div>
            <div className="tabular-nums" style={{ color: T.textMute }}>
              Last sync · <span className="font-black" style={{ color: T.text }}>{now.toLocaleTimeString()}</span>
            </div>
          </div>

        </main>
      </div>

      {/* Drill-down modal */}
      <DrillModal open={!!drill} onClose={() => setDrill(null)} kpi={drill} />

      <style>{`
        @keyframes fadein { from { opacity: 0 } to { opacity: 1 } }
        .animate-fadein { animation: fadein 0.2s ease-out }
        ::-webkit-scrollbar { width: 8px; height: 8px }
        ::-webkit-scrollbar-track { background: transparent }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.2); border-radius: 4px }
        ::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.35) }
      `}</style>
    </div>
  );
};

// ─── Treemap Node ────────────────────────────────────────────────────────────
const TreemapNode = (props) => {
  const { x, y, width, height, name, value, fill } = props;
  if (width < 4 || height < 4) return null;
  const showLabel = width > 60 && height > 30;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill || T.cyan}
        stroke="rgba(240,244,255,0.7)" strokeWidth={2} />
      {showLabel && (
        <>
          <text x={x + 8} y={y + 18} fill="white" fontSize="11" fontWeight="900" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
            {name}
          </text>
          <text x={x + 8} y={y + 32} fill="rgba(255,255,255,0.85)" fontSize="13" fontWeight="900">
            {fmtNumber(value)}
          </text>
        </>
      )}
    </g>
  );
};

export default AdminDashboard;
