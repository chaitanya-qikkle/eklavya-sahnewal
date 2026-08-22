import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  FiActivity, FiCpu, FiRefreshCw, FiWifi, FiWifiOff, FiZap,
  FiAlertTriangle, FiTerminal, FiServer, FiDatabase, FiClock,
  FiGrid, FiList, FiTrendingUp, FiArrowUpRight, FiArrowDownRight,
  FiX, FiMonitor, FiBarChart2, FiPercent, FiShield, FiEye,
  FiMapPin, FiBox, FiRadio, FiHardDrive, FiMaximize2,
  FiCheck, FiSliders, FiLayers, FiCode, FiPackage,
  FiAlertCircle, FiTarget, FiTrendingDown, FiCrosshair, FiUserCheck,
  FiNavigation, FiBell, FiGitCommit, FiCheckCircle, FiChevronRight,
} from "react-icons/fi";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  RadialBarChart, RadialBar, ComposedChart,
} from "recharts";
import Navbar from "../../../components/layout/Navbar";
import {
  useGetEquipmentQuery,
  useGetDeviceDataLatestQuery,
  useGetDeviceDataLiveLocationsQuery,
  useGetEquipmentTransactionLatestQuery,
  useGetEquipmentTransactionsQuery,
  useGetContainerLiveStatusQuery,
  useLazyGetDeviceLockReportQuery,
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
  if (s.includes("T")) { const d = new Date(s); return isNaN(d.getTime()) ? null : d; }
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

const fmtTime = (date) => {
  if (!date) return "—";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
};

const fmtDateTime = (date) => {
  if (!date) return "—";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(date.getDate())}-${p(date.getMonth() + 1)} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
};

const fmtNumber = (n) => {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString();
};

// ContNo from GET_DEVICE_LOCK_REPORT is: "OCR_VALUE (UPDATED_STATUS)"
// UPDATED_STATUS: 'EQ' (default, no manual) or 'M' (manually corrected)
const parseContNo = (row) => {
  const raw = String(get(row, "ContNo", "contno") ?? "").trim();
  const m = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) return { ocrNo: m[1].trim(), updatedStatus: m[2].trim() };
  return { ocrNo: raw, updatedStatus: "EQ" };
};

const classifyRow = (row) => {
  const { ocrNo, updatedStatus } = parseContNo(row);
  if (updatedStatus === "M") return "manual";
  const clean = ocrNo.split(" ")[0].replace(/0/g, "");
  if (clean === "" || ocrNo === "-" || ocrNo === "") return "missing";
  return "ocr";
};

const isMissingContainer = (row) => classifyRow(row) === "missing";

// Check if a movement-transaction row (TBL_EQUIPMENT_TRANSACTION) has no container.
// These rows use OCR_CONTAINER_NO / CONTAINER_TAG_ID — not the ContNo "(EQ/M)" format.
const isTxMissing = (row) => {
  const ocr = String(get(row, "OCR_CONTAINER_NO", "ocr_container_no") || "").trim();
  const tag = String(get(row, "CONTAINER_TAG_ID", "container_tag_id") || "").trim();
  const val = ocr || tag;
  return val === "" || val === "0" || val.replace(/0/g, "") === "";
};

// ISO 6346 container number: 4 letters (owner+category) + 6 serial digits + 1 check digit.
const ISO6346_RE = /^[A-Z]{4}\d{7}$/;
const isIsoValid = (row) => {
  const { ocrNo } = parseContNo(row);
  const clean = ocrNo.replace(/\s+/g, "").toUpperCase();
  return ISO6346_RE.test(clean);
};

// ─── Theme (light) ───────────────────────────────────────────────────────────
const T = {
  bg: "#f8fafc",
  bg2: "#eef2ff",
  card: "rgba(255,255,255,0.97)",
  cardHover: "rgba(255,255,255,1)",
  border: "rgba(148,163,184,0.22)",
  borderStrong: "rgba(100,116,139,0.38)",
  text: "#0f172a",
  textDim: "#374151",
  textMute: "#6b7280",
  green: "#16a34a",
  cyan: "#0284c7",
  blue: "#1d4ed8",
  indigo: "#4338ca",
  purple: "#7c3aed",
  pink: "#be185d",
  red: "#b91c1c",
  orange: "#c2410c",
  amber: "#b45309",
  emerald: "#047857",
  teal: "#0f766e",
  lime: "#4d7c0f",
};

const ACCENTS = [T.cyan, T.blue, T.emerald, T.purple, T.amber, T.teal, T.indigo, T.orange, T.pink, T.lime];

const STATUS_CFG = {
  online:     { label: "ONLINE",     color: T.emerald, glow: "#10b98140", pulse: true },
  idle:       { label: "IDLE",       color: T.amber,   glow: "#f59e0b30", pulse: false },
  offline:    { label: "OFFLINE",    color: T.red,     glow: "#ef444420", pulse: false },
  breakdown:  { label: "BREAKDOWN",  color: T.orange,  glow: "#f9731620", pulse: false },
  "no-device":{ label: "NO DEVICE",  color: T.textMute,glow: "transparent", pulse: false },
  unknown:    { label: "UNKNOWN",    color: T.textDim, glow: "transparent", pulse: false },
};

// ─── Animated Counter ────────────────────────────────────────────────────────
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
      setValue(fromRef.current + (Number(target) - fromRef.current) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return value;
};

const AnimatedNumber = ({ value, decimals = 0 }) => {
  const v = useCountUp(Number.isFinite(value) ? value : 0);
  if (decimals > 0) return <>{v.toFixed(decimals)}</>;
  return <>{fmtNumber(Math.round(v))}</>;
};

// ─── Sparkline ───────────────────────────────────────────────────────────────
const Sparkline = ({ data, color = T.cyan, height = 36 }) => {
  if (!data || data.length < 2) return <div style={{ height }} />;
  const chartData = data.map((v, i) => ({ i, v }));
  const gradId = `sp-${color.replace("#", "")}`;
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2}
            fill={`url(#${gradId})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Status Pulse Dot ────────────────────────────────────────────────────────
const PulseDot = ({ status }) => {
  const cfg = STATUS_CFG[status] || STATUS_CFG.unknown;
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {cfg.pulse && (
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
          style={{ backgroundColor: cfg.color }}
        />
      )}
      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: cfg.color }} />
    </span>
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
      <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b shrink-0"
        style={{ borderColor: T.border }}>
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}20` }}>
              <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-[0.15em] truncate" style={{ color: T.text }}>{title}</div>
            {subtitle && <div className="text-[10px] truncate mt-0.5" style={{ color: T.textMute }}>{subtitle}</div>}
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    )}
    <div className={noPad ? "flex-1 flex flex-col min-h-0 overflow-hidden" : "flex-1 p-4 md:p-5 flex flex-col min-h-0"}>
      {children}
    </div>
  </div>
);

// ─── KPI Card ────────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, suffix, sub, trend, accent, loading, decimals }) => {
  const isUp = trend != null && trend >= 0;
  return (
    <div
      className="group relative overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        background: "linear-gradient(145deg, #ffffff, #f8faff)",
        border: `1px solid ${T.border}`,
        boxShadow: "0 2px 12px -2px rgba(99,102,241,0.10), 0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full opacity-[0.07] blur-2xl group-hover:opacity-[0.13] transition-opacity"
        style={{ background: accent }} />
      <div className="absolute top-0 left-0 right-0 h-[2px] opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}90, transparent)` }} />
      <div className="relative p-4 md:p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}25` }}>
            <Icon className="w-5 h-5" strokeWidth={2.2} />
          </div>
          {trend != null && !loading && (
            <div className={`flex items-center gap-0.5 text-[10px] font-black px-2 py-1 rounded-full border
              ${isUp ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-700 bg-rose-50 border-rose-200"}`}>
              {isUp ? <FiArrowUpRight className="w-3 h-3" /> : <FiArrowDownRight className="w-3 h-3" />}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] mb-1.5" style={{ color: T.textDim }}>
          {label}
        </div>
        <div className="flex items-baseline gap-1.5 mb-1.5">
          <div className="text-3xl md:text-4xl font-black tabular-nums tracking-tight leading-none" style={{ color: T.text }}>
            {loading ? <span className="opacity-20">···</span> : <AnimatedNumber value={value} decimals={decimals || 0} />}
          </div>
          {suffix && !loading && (
            <span className="text-sm font-black" style={{ color: accent }}>{suffix}</span>
          )}
        </div>
        {sub && <div className="text-[10px] truncate" style={{ color: T.textMute }}>{sub}</div>}
      </div>
    </div>
  );
};

// ─── Chart Tooltip ───────────────────────────────────────────────────────────
const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs"
      style={{ background: "rgba(255,255,255,0.98)", border: `1px solid ${T.border}`, boxShadow: "0 8px 24px rgba(99,102,241,0.12), 0 2px 8px rgba(0,0,0,0.08)", color: T.text }}>
      {label != null && <div className="font-bold text-[10px] mb-1.5" style={{ color: T.textDim }}>{label}</div>}
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
const RadialGauge = ({ value, max = 100, color = T.cyan, label, size = 160, suffix = "%", subtitle }) => {
  const v = Math.max(0, Math.min(Number(value) || 0, max));
  const data = [{ name: label || "v", value: v, fill: color }];
  const gradId = `rg-${color.replace("#", "")}`;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart cx="50%" cy="50%" innerRadius="68%" outerRadius="100%"
          data={data} startAngle={210} endAngle={-30}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <RadialBar background={{ fill: "rgba(0,0,0,0.05)" }} dataKey="value"
            cornerRadius={20} fill={`url(#${gradId})`} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-2xl font-black tabular-nums leading-none" style={{ color: T.text }}>
          <AnimatedNumber value={v} decimals={1} />
        </div>
        <span className="text-[11px] font-black mt-0.5" style={{ color }}>{suffix}</span>
        {subtitle && <div className="text-[9px] mt-1 uppercase tracking-wider font-black" style={{ color: T.textMute }}>{subtitle}</div>}
      </div>
    </div>
  );
};

// ─── Machine Health Card ──────────────────────────────────────────────────────
const MachineCard = ({ machine, status, lastSeen, lastSeenDate, lastContainer, accuracy, scanCount, activity, onClick }) => {
  const cfg = STATUS_CFG[status] || STATUS_CFG.unknown;
  const ageMs = lastSeenDate ? Date.now() - lastSeenDate.getTime() : null;
  const freshnessPct = ageMs != null ? Math.max(0, 100 - (ageMs / (30 * 60 * 1000)) * 100) : 0;
  const freshnessColor = freshnessPct > 66 ? T.emerald : freshnessPct > 33 ? T.amber : T.red;
  const clickable = !!onClick && !!machine.deviceId;

  return (
    <div
      onClick={clickable ? onClick : undefined}
      role={clickable ? "button" : undefined}
      className={`group relative rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${clickable ? "cursor-pointer" : ""}`}
      style={{
        background: "linear-gradient(145deg, #ffffff, #f8faff)",
        border: `1px solid ${status === "online" ? `${T.emerald}35` : T.border}`,
        boxShadow: status === "online"
          ? `0 2px 12px -2px rgba(5,150,105,0.15), 0 1px 3px rgba(0,0,0,0.05)`
          : "0 2px 12px -2px rgba(99,102,241,0.08), 0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {/* Glow background */}
      <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full blur-2xl opacity-20 transition-opacity group-hover:opacity-40"
        style={{ background: cfg.color }} />

      {/* Status bar at top */}
      <div className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}80, transparent)` }} />

      <div className="relative p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <PulseDot status={status} />
              <span className="text-xs font-black uppercase tracking-wider truncate" style={{ color: T.text }}>
                {machine.name}
              </span>
            </div>
            {machine.deviceId && (
              <div className="text-[9px] font-mono truncate" style={{ color: T.textMute }}>
                DEV · {machine.deviceId}
              </div>
            )}
          </div>
          <div className="text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ml-2"
            style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
            {cfg.label}
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(0,0,0,0.03)", border: `1px solid ${T.border}` }}>
            <div className="text-[9px] uppercase tracking-wider font-black mb-0.5" style={{ color: T.textMute }}>Last Seen</div>
            <div className="text-[11px] font-black tabular-nums" style={{ color: T.textDim }}>{lastSeen}</div>
          </div>
          <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(0,0,0,0.03)", border: `1px solid ${T.border}` }}>
            <div className="text-[9px] uppercase tracking-wider font-black mb-0.5" style={{ color: T.textMute }}>Accuracy</div>
            <div className="text-[11px] font-black tabular-nums"
              style={{ color: accuracy != null ? (accuracy >= 90 ? T.emerald : accuracy >= 75 ? T.amber : T.red) : T.textMute }}>
              {accuracy != null ? `${accuracy.toFixed(1)}%` : "—"}
            </div>
          </div>
          <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(0,0,0,0.03)", border: `1px solid ${T.border}` }}>
            <div className="text-[9px] uppercase tracking-wider font-black mb-0.5" style={{ color: T.textMute }}>Scans</div>
            <div className="text-[11px] font-black tabular-nums" style={{ color: T.textDim }}>
              {scanCount != null ? fmtNumber(scanCount) : "—"}
            </div>
          </div>
          <div className="rounded-lg px-2.5 py-2 overflow-hidden" style={{ background: "rgba(0,0,0,0.03)", border: `1px solid ${T.border}` }}>
            <div className="text-[9px] uppercase tracking-wider font-black mb-0.5" style={{ color: T.textMute }}>Container</div>
            <div className="text-[10px] font-mono truncate" style={{ color: T.textDim }}>
              {lastContainer || "—"}
            </div>
          </div>
        </div>

        {/* Freshness bar */}
        <div className="mb-2.5">
          <div className="flex justify-between text-[9px] font-black mb-1" style={{ color: T.textMute }}>
            <span>DATA FRESHNESS</span>
            <span style={{ color: freshnessColor }}>{freshnessPct.toFixed(0)}%</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.07)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${freshnessPct}%`, background: `linear-gradient(90deg, ${freshnessColor}80, ${freshnessColor})` }}
            />
          </div>
        </div>

        {/* Activity sparkline */}
        {activity && activity.length > 1 && (
          <div className="mt-2 -mx-1">
            <div className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: T.textMute }}>ACTIVITY</div>
            <Sparkline data={activity} color={cfg.color} height={28} />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── DataTable ────────────────────────────────────────────────────────────────
const DataTable = ({ cols, rows, emptyMsg = "No data", maxHeight = "100%" }) => (
  <div className="flex-1 overflow-auto rounded-xl" style={{ maxHeight, background: "white", border: `1px solid ${T.border}` }}>
    <table className="w-full text-xs">
      <thead className="sticky top-0 z-10"
        style={{ background: "#f8fafc", backdropFilter: "blur(12px)" }}>
        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
          {cols.map((c, i) => (
            <th key={i}
              className={`px-3 py-2.5 font-black uppercase tracking-wider text-[9px] whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`}
              style={{ color: T.textMute }}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(!rows || rows.length === 0)
          ? <tr><td colSpan={cols.length} className="text-center py-10 text-xs" style={{ color: T.textMute }}>{emptyMsg}</td></tr>
          : rows.map((r, i) => (
            <tr key={i} className="hover:bg-indigo-50/50 transition-colors" style={{ borderBottom: `1px solid ${T.border}` }}>
              {cols.map((c, j) => {
                const v = c.key ? r[c.key] : r[j];
                return (
                  <td key={j}
                    className={`px-3 py-2 ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.mono ? "font-mono" : ""} ${c.bold ? "font-black" : ""}`}
                    style={{ color: c.dim ? T.textDim : c.muted ? T.textMute : T.text }}>
                    {c.render ? c.render(v, r) : (v ?? "—")}
                  </td>
                );
              })}
            </tr>
          ))}
      </tbody>
    </table>
  </div>
);

// ─── Refresh Button ───────────────────────────────────────────────────────────
const RefreshBtn = ({ onClick, loading, color = T.cyan }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all hover:bg-indigo-50"
    style={{ color, border: `1px solid ${color}40`, background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
  >
    <FiRefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
    Refresh
  </button>
);

// ─── System Health Badge ───────────────────────────────────────────────────────
const HealthBadge = ({ label, ok, loading }) => (
  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
    style={{ background: "white", border: `1px solid ${T.border}`, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
    <span className={`w-1.5 h-1.5 rounded-full ${loading ? "animate-pulse" : ""}`}
      style={{ backgroundColor: loading ? T.amber : ok ? T.emerald : T.red }} />
    <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: T.textDim }}>{label}</span>
  </div>
);

// ─── View Toggle ─────────────────────────────────────────────────────────────
const ViewToggle = ({ value, onChange }) => (
  <div className="inline-flex rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}`, background: "rgba(0,0,0,0.04)" }}>
    {[{ v: "grid", Icon: FiGrid }, { v: "list", Icon: FiList }].map(({ v, Icon }) => (
      <button key={v} onClick={() => onChange(v)}
        className="p-1.5 transition-colors"
        style={{ background: value === v ? "white" : "transparent", color: value === v ? T.indigo : T.textMute, boxShadow: value === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
        <Icon className="w-3.5 h-3.5" />
      </button>
    ))}
  </div>
);

// ─── Alert Severity Config ─────────────────────────────────────────────────────
const SEVERITY = {
  critical: { color: T.red,    label: "CRITICAL", icon: FiAlertCircle },
  warning:  { color: T.amber,  label: "WARNING",  icon: FiAlertTriangle },
  info:     { color: T.cyan,   label: "INFO",     icon: FiActivity },
};

// ─── Mini Stat (modal) ─────────────────────────────────────────────────────────
const MiniStat = ({ label, value, color = T.text, suffix }) => (
  <div className="rounded-xl px-3 py-2.5" style={{ background: "#f8fafc", border: `1px solid ${T.border}` }}>
    <div className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: T.textMute }}>{label}</div>
    <div className="text-lg font-black tabular-nums leading-none" style={{ color }}>
      {value}{suffix && <span className="text-xs ml-0.5">{suffix}</span>}
    </div>
  </div>
);

// ─── Machine Drill-down Modal ───────────────────────────────────────────────────
const MachineDrillModal = ({ entry, recentOcr, onClose }) => {
  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!entry) return null;
  const { machine, status, lastSeen, accuracy, accuracyEffective, ocrData, scanCount, activity } = entry;
  const cfg = STATUS_CFG[status] || STATUS_CFG.unknown;
  const accColor = accuracy == null ? T.textMute : accuracy >= 90 ? T.emerald : accuracy >= 75 ? T.amber : T.red;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl"
        style={{
          background: "linear-gradient(145deg, #ffffff, #f0f4ff)",
          border: `1px solid ${T.border}`,
          boxShadow: "0 24px 60px -16px rgba(99,102,241,0.2), 0 8px 24px rgba(0,0,0,0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-6 py-5 border-b sticky top-0 z-10"
          style={{ borderColor: T.border, background: "rgba(248,250,252,0.97)", backdropFilter: "blur(12px)" }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
              <FiCpu className="w-6 h-6" strokeWidth={2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <PulseDot status={status} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: cfg.color }}>{cfg.label}</span>
              </div>
              <h2 className="text-xl md:text-2xl font-black" style={{ color: T.text }}>{machine.name}</h2>
              {machine.deviceId && <div className="text-[10px] font-mono" style={{ color: T.textMute }}>DEV · {machine.deviceId}</div>}
            </div>
          </div>
          <button onClick={onClose}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            style={{ border: `1px solid ${T.border}` }}>
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Stat grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="Last Seen" value={lastSeen} color={cfg.color} />
            <MiniStat label="Raw OCR Acc." value={accuracy != null ? accuracy.toFixed(1) : "—"} suffix={accuracy != null ? "%" : ""} color={accColor} />
            <MiniStat label="Effective Acc." value={accuracyEffective != null ? accuracyEffective.toFixed(1) : "—"} suffix={accuracyEffective != null ? "%" : ""} color={T.emerald} />
            <MiniStat label="Total Scans" value={fmtNumber(scanCount || 0)} color={T.text} />
          </div>

          {/* OCR breakdown */}
          {ocrData && ocrData.total > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="OCR Captured" value={fmtNumber(ocrData.ocr)} color={T.cyan} />
              <MiniStat label="Manual Fixes" value={fmtNumber(ocrData.manual)} color={T.amber} />
              <MiniStat label="Still Missing" value={fmtNumber(ocrData.missing)} color={T.red} />
              <MiniStat label="Report Total" value={fmtNumber(ocrData.total)} color={T.textDim} />
            </div>
          )}

          {/* Activity sparkline */}
          <div className="rounded-2xl p-4" style={{ background: "#f8fafc", border: `1px solid ${T.border}` }}>
            <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: T.textMute }}>Activity · last 12h</div>
            {activity && activity.length > 1
              ? <Sparkline data={activity} color={cfg.color} height={72} />
              : <div className="h-[72px] flex items-center justify-center text-xs" style={{ color: T.textMute }}>No recent activity</div>}
          </div>

          {/* Recent OCR scans for this machine */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "#f8fafc", border: `1px solid ${T.border}` }}>
            <div className="px-5 py-3 text-[10px] uppercase tracking-widest font-black border-b" style={{ color: T.textMute, borderColor: T.border }}>
              Recent OCR Scans · {recentOcr?.length || 0} records
            </div>
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs">
                <thead className="sticky top-0" style={{ background: "#f8fafc" }}>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {["Timestamp", "OCR Read", "Source", "ISO", "Status"].map((h) => (
                      <th key={h} className="px-4 py-2 text-left font-black uppercase tracking-wider text-[9px]" style={{ color: T.textMute }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(!recentOcr || recentOcr.length === 0) ? (
                    <tr><td colSpan={5} className="text-center py-8 text-xs" style={{ color: T.textMute }}>No OCR records in window</td></tr>
                  ) : recentOcr.map((r, i) => (
                    <tr key={i} className="hover:bg-indigo-50/50 transition-colors" style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td className="px-4 py-2 font-mono text-[10px]" style={{ color: T.textDim }}>{r.ts ? fmtDateTime(r.ts) : "—"}</td>
                      <td className="px-4 py-2 font-mono" style={{ color: r.cls === "missing" ? T.textMute : T.text }}>{r.ocrNo || "—"}</td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black"
                          style={{
                            background: r.cls === "ocr" ? `${T.cyan}18` : r.cls === "manual" ? `${T.amber}18` : `${T.red}18`,
                            color: r.cls === "ocr" ? T.cyan : r.cls === "manual" ? T.amber : T.red,
                          }}>
                          {r.cls === "ocr" ? "OCR" : r.cls === "manual" ? "MANUAL" : "MISSING"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {r.iso
                          ? <FiCheckCircle className="w-3.5 h-3.5" style={{ color: T.emerald }} />
                          : <FiX className="w-3.5 h-3.5" style={{ color: T.textMute }} />}
                      </td>
                      <td className="px-4 py-2">
                        {r.cls === "missing"
                          ? <span style={{ color: T.red }} className="text-[10px] font-black">UNRESOLVED</span>
                          : <span style={{ color: T.emerald }} className="text-[10px] font-black">RESOLVED</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const HISTORY_LEN = 16;
const ONLINE_THRESHOLD_MS  = 10 * 60 * 1000;  // 10 min
const IDLE_THRESHOLD_MS    = 30 * 60 * 1000;  // 30 min

const DeveloperDashboard = () => {
  const [now, setNow] = useState(() => new Date());
  const [machineView, setMachineView] = useState("grid");
  const [feedFilter, setFeedFilter] = useState("all");
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [ocrWindow, setOcrWindow] = useState("24h");
  const [drillDeviceId, setDrillDeviceId] = useState(null);

  // Keep clock updated every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ─── API Queries ────────────────────────────────────────────────────────────
  const {
    data: equipmentApi,
    isLoading: equipmentLoading,
    isFetching: equipmentFetching,
    refetch: refetchEquipment,
  } = useGetEquipmentQuery(undefined, { pollingInterval: 15000, refetchOnFocus: true });

  const {
    data: latestTxApi,
    isLoading: latestTxLoading,
    isFetching: latestTxFetching,
    refetch: refetchLatestTx,
  } = useGetDeviceDataLatestQuery(undefined, { pollingInterval: 10000 });

  const {
    data: liveLocApi,
    isLoading: liveLocLoading,
    isFetching: liveLocFetching,
    refetch: refetchLiveLoc,
  } = useGetDeviceDataLiveLocationsQuery(undefined, { pollingInterval: 10000 });

  const {
    data: latestEqpTxApi,
    isLoading: eqpTxLoading,
    isFetching: eqpTxFetching,
    refetch: refetchEqpTx,
  } = useGetEquipmentTransactionLatestQuery(undefined, { pollingInterval: 30000 });

  // Full transaction rows (TRANSACTION_DATE, DEVICE_ID, OCR_CONTAINER_NO, PACKET_TYPE …)
  // Used for: live feed, timeline, machine activity, packet breakdown.
  const {
    data: liveTxApi,
    isLoading: liveTxLoading,
    isFetching: liveTxFetching,
    refetch: refetchLiveTx,
  } = useGetEquipmentTransactionsQuery({ top: 100 }, { pollingInterval: 12000 });

  const {
    data: liveStatusApi,
    isLoading: liveStatusLoading,
  } = useGetContainerLiveStatusQuery("", { pollingInterval: 30000 });

  const [fetchLockReport, { data: lockReportApi, isLoading: lockLoading }] =
    useLazyGetDeviceLockReportQuery();

  // Auto-fetch lock report once equipment list is known
  // SP requires equipment_names — without it returns zero rows
  useEffect(() => {
    const equipList = Array.isArray(equipmentApi?.data) ? equipmentApi.data : [];
    if (equipList.length === 0) return;

    // Use Device_ID field — matches what DeviceDataReport passes, which the SP resolves to Equipment_Name
    const eqpParam = equipList
      .map((item) => String(
        item?.Device_ID ?? item?.device_id ?? item?.DEVICE_ID ??
        item?.Equipment_Name ?? item?.equipment_name ?? item?.EQUIPMENT_NAME ?? ""
      ).trim())
      .filter(Boolean)
      .join(",");

    if (!eqpParam) return;

    const pad = (n) => String(n).padStart(2, "0");
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const to = new Date();
    const hrs = ocrWindow === "7d" ? 168 : ocrWindow === "30d" ? 720 : 24;
    const from = new Date(to.getTime() - hrs * 3600 * 1000);
    fetchLockReport({ from_date: fmt(from), to_date: fmt(to), report_type: "All", equipment_names: eqpParam });
  }, [fetchLockReport, ocrWindow, equipmentApi]);

  const isAnyLoading = equipmentLoading || latestTxLoading || liveLocLoading || eqpTxLoading || liveTxLoading;
  const isAnyFetching = equipmentFetching || latestTxFetching || liveLocFetching || eqpTxFetching || liveTxFetching;

  const refetchAll = useCallback(() => {
    refetchEquipment();
    refetchLatestTx();
    refetchLiveLoc();
    refetchEqpTx();
    refetchLiveTx();
  }, [refetchEquipment, refetchLatestTx, refetchLiveLoc, refetchEqpTx, refetchLiveTx]);

  // ─── Data Derivations ───────────────────────────────────────────────────────
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

  // Live location map: deviceId → { lat, lng, lastAt, container }
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
      const container = get(r, "RFIDDATA", "rfiddata", "OCR_CONTAINER_NO", "ocr_container_no",
        "ContNo", "contno");
      map.set(String(dev).trim().toUpperCase(), { lat, lng, lastAt, container });
    });
    return map;
  }, [liveLocApi]);

  // Latest tx map: deviceId → lastTransactionDate string
  const latestTxMap = useMemo(() => {
    const rows = Array.isArray(latestTxApi?.data) ? latestTxApi.data : [];
    const map = new Map();
    rows.forEach((r) => {
      const dev = get(r, "DEVICE_IMEI", "device_imei", "DEVICE_ID", "device_id");
      if (!dev) return;
      const ts = get(r, "LAST_TRANSACTION_DATE", "last_transaction_date", "LAST_AT", "last_at");
      map.set(String(dev).trim().toUpperCase(), ts);
    });
    return map;
  }, [latestTxApi]);

  const ocrByMachine = useMemo(() => {
    const rows = Array.isArray(lockReportApi?.data) ? lockReportApi.data : [];
    // Map keyed by EqpName (Equipment_Name). Also track DeviceID for cross-matching.
    const nameMap = new Map(); // Equipment_Name → stats
    const devMap  = new Map(); // DeviceID       → Equipment_Name (alias)
    rows.forEach((r) => {
      const eqpName = String(get(r, "EqpName", "eqpname") || "Unknown").trim().toUpperCase();
      const devId   = String(get(r, "DeviceID", "deviceid", "DEVICE_ID", "device_id") || "").trim().toUpperCase();
      const cur = nameMap.get(eqpName) || { total: 0, ocr: 0, manual: 0, missing: 0, eqpName, devId };
      cur.total++;
      const cls = classifyRow(r);
      if (cls === "ocr") cur.ocr++;
      else if (cls === "manual") cur.manual++;
      else cur.missing++;
      nameMap.set(eqpName, cur);
      if (devId && devId !== eqpName) devMap.set(devId, eqpName);
    });
    return { nameMap, devMap };
  }, [lockReportApi]);

  // Per-machine scan count from latest eqp transactions
  // liveTxRows: full movement-transaction records from SP_MOVEMENT_TRANSACTION_LIST.
  // Columns: DEVICE_ID, TRANSACTION_DATE, CREATED_ON, OCR_CONTAINER_NO,
  //          CONTAINER_TAG_ID, PACKET_TYPE, GPS_LATITUDE, GPS_LONGITUDE, TRANSACTION_ID.
  const liveTxRows = useMemo(
    () => (Array.isArray(liveTxApi?.data) ? liveTxApi.data : []),
    [liveTxApi]
  );

  const scanCountByDevice = useMemo(() => {
    const map = new Map();
    liveTxRows.forEach((r) => {
      const dev = String(get(r, "DEVICE_ID", "device_id") || "").trim().toUpperCase();
      if (!dev) return;
      map.set(dev, (map.get(dev) || 0) + 1);
    });
    return map;
  }, [liveTxRows]);

  // Per-machine hourly activity sparkline (12 buckets = last 12 hrs)
  const machineActivity = useMemo(() => {
    const result = new Map();
    const nowMs = Date.now();
    const WINDOW = 12 * 3600 * 1000;
    liveTxRows.forEach((r) => {
      const dev = String(get(r, "DEVICE_ID", "device_id") || "").trim().toUpperCase();
      if (!dev) return;
      const ts = parseDateTime(get(r, "TRANSACTION_DATE", "transaction_date", "CREATED_ON", "created_on"));
      if (!ts) return;
      const age = nowMs - ts.getTime();
      if (age > WINDOW || age < 0) return;
      const bucket = Math.floor((WINDOW - age) / (WINDOW / HISTORY_LEN));
      const arr = result.get(dev) || Array(HISTORY_LEN).fill(0);
      arr[Math.min(bucket, HISTORY_LEN - 1)]++;
      result.set(dev, arr);
    });
    return result;
  }, [liveTxRows]);

  // Machine status derivation
  const getMachineStatus = useCallback((machine) => {
    if (machine.isBreakdown) return "breakdown";
    if (!machine.deviceId) return "no-device";
    const loc = liveLocMap.get(machine.deviceId);
    const txDate = latestTxMap.get(machine.deviceId);
    const rawDate = loc?.lastAt || txDate;
    if (!rawDate) return "offline";
    const t = parseDateTime(rawDate);
    if (!t) return "unknown";
    const age = now.getTime() - t.getTime();
    if (age < ONLINE_THRESHOLD_MS) return "online";
    if (age < IDLE_THRESHOLD_MS) return "idle";
    return "offline";
  }, [liveLocMap, latestTxMap, now]);

  // Enriched machine list
  const machines = useMemo(() => {
    return allEquipment.map((m) => {
      const status = getMachineStatus(m);
      const loc = m.deviceId ? liveLocMap.get(m.deviceId) : null;
      const txDateRaw = m.deviceId ? latestTxMap.get(m.deviceId) : null;
      const rawDate = loc?.lastAt || txDateRaw;
      const lastSeenDate = rawDate ? parseDateTime(rawDate) : null;
      const lastSeen = lastSeenDate ? fmtRelative(lastSeenDate) : "never";
      const lastContainer = loc?.container
        ? String(loc.container).trim()
        : null;

      const { nameMap, devMap } = ocrByMachine;
      const nameKey = m.name.toUpperCase();
      const devKey  = m.deviceId ? m.deviceId.toUpperCase() : null;
      // Try exact match on Equipment_Name, then DeviceID alias, then substring
      let ocrData = nameMap.get(nameKey)
        || (devKey ? nameMap.get(devMap.get(devKey) ?? devKey) : null)
        || (devKey ? nameMap.get(devKey) : null)
        || (() => {
          for (const [k, v] of nameMap.entries()) {
            if (k.includes(nameKey) || nameKey.includes(k) ||
                (devKey && (k.includes(devKey) || devKey.includes(k)))) return v;
          }
          return null;
        })();
      const accuracy = ocrData && ocrData.total > 0 ? (ocrData.ocr / ocrData.total) * 100 : null;
      const accuracyEffective = ocrData && ocrData.total > 0 ? ((ocrData.ocr + ocrData.manual) / ocrData.total) * 100 : null;

      const scanCount = m.deviceId ? (scanCountByDevice.get(m.deviceId) || 0) : 0;
      const activity = m.deviceId ? (machineActivity.get(m.deviceId) || []) : [];

      return { machine: m, status, lastSeen, lastSeenDate, lastContainer, accuracy, accuracyEffective, ocrData, scanCount, activity };
    });
  }, [allEquipment, getMachineStatus, liveLocMap, latestTxMap, ocrByMachine, scanCountByDevice, machineActivity]);

  // Fleet KPIs
  const fleetStats = useMemo(() => {
    let online = 0, idle = 0, offline = 0, breakdown = 0, noDevice = 0;
    machines.forEach(({ status }) => {
      if (status === "online") online++;
      else if (status === "idle") idle++;
      else if (status === "breakdown") breakdown++;
      else if (status === "no-device") noDevice++;
      else offline++;
    });
    const total = machines.length;
    const utilization = total > 0 ? (online / total) * 100 : 0;
    return { total, online, idle, offline, breakdown, noDevice, utilization };
  }, [machines]);

  const ocrStats = useMemo(() => {
    const { nameMap } = ocrByMachine;
    let total = 0, ocr = 0, manual = 0, missing = 0;
    for (const v of nameMap.values()) {
      total   += v.total;
      ocr     += v.ocr;
      manual  += v.manual;
      missing += v.missing;
    }
    const rawRate       = total > 0 ? (ocr / total) * 100 : null;
    const effectiveRate = total > 0 ? ((ocr + manual) / total) * 100 : null;
    const missingRate   = total > 0 ? (missing / total) * 100 : null;
    const manualRate    = total > 0 ? (manual / total) * 100 : null;
    return { total, ocr, manual, missing, rawRate, effectiveRate, missingRate, manualRate };
  }, [ocrByMachine]);

  // Total scans in live feed buffer
  const totalScans = useMemo(() => liveTxRows.length, [liveTxRows]);

  // Transaction timeline: group by hour (last 12 hours)
  const txTimeline = useMemo(() => {
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const h = (now.getHours() - 11 + i + 24) % 24;
      return { label: `${String(h).padStart(2, "0")}h`, h, scans: 0, captured: 0, missing: 0 };
    });
    liveTxRows.forEach((r) => {
      const ts = parseDateTime(get(r, "TRANSACTION_DATE", "transaction_date", "CREATED_ON", "created_on"));
      if (!ts) return;
      const b = buckets.find((bk) => bk.h === ts.getHours());
      if (!b) return;
      b.scans++;
      if (!isTxMissing(r)) b.captured++;
      else b.missing++;
    });
    return buckets;
  }, [liveTxRows, now]);

  const ocrChartData = useMemo(() => {
    const { nameMap } = ocrByMachine;
    return Array.from(nameMap.values())
      .filter((v) => v.total > 0)
      .map((v, i) => ({
        name: v.eqpName.length > 14 ? v.eqpName.slice(0, 14) : v.eqpName,
        fullName: v.eqpName,
        rawRate: Number((v.ocr / v.total * 100).toFixed(1)),
        effectiveRate: Number(((v.ocr + v.manual) / v.total * 100).toFixed(1)),
        ocr: v.ocr,
        manual: v.manual,
        missing: v.missing,
        total: v.total,
        fill: ACCENTS[i % ACCENTS.length],
      }))
      .sort((a, b) => b.rawRate - a.rawRate);
  }, [ocrByMachine]);

  // Live transaction feed — sourced from SP_MOVEMENT_TRANSACTION_LIST (full rows).
  const liveFeedRows = useMemo(() => {
    return liveTxRows
      .map((r) => {
        const dev = String(get(r, "DEVICE_ID", "device_id") || "—").trim().toUpperCase();
        const machineMatch = allEquipment.find((m) => m.deviceId === dev);
        const machineName = machineMatch?.name || dev;
        const ocrNo = String(get(r, "OCR_CONTAINER_NO", "ocr_container_no") || "").trim();
        const tagNo = String(get(r, "CONTAINER_TAG_ID", "container_tag_id") || "").trim();
        const container = ocrNo || tagNo || null;
        const tsRaw = get(r, "TRANSACTION_DATE", "transaction_date", "CREATED_ON", "created_on");
        const ts = parseDateTime(tsRaw);
        const packetType = get(r, "PACKET_TYPE", "packet_type");
        const packetLabel = packetType != null ? String(packetType) : "—";
        const captured = container ? !isTxMissing(r) : null;
        return { ts, machineName, dev, container, packetType: packetLabel, captured };
      })
      .filter((r) => {
        if (feedFilter === "captured") return r.captured === true;
        if (feedFilter === "missing") return r.captured === false;
        if (feedFilter === selectedMachine) return r.machineName === selectedMachine;
        return true;
      })
      .sort((a, b) => (b.ts?.getTime() || 0) - (a.ts?.getTime() || 0))
      .slice(0, 60);
  }, [liveTxRows, allEquipment, feedFilter, selectedMachine]);

  // Packet type breakdown for donut — uses PACKET_TYPE from movement transactions.
  const packetBreakdown = useMemo(() => {
    const map = new Map();
    liveTxRows.forEach((r) => {
      const pt = get(r, "PACKET_TYPE", "packet_type");
      const key = pt != null ? String(pt) : "Unknown";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value], i) => ({ name, value, fill: ACCENTS[i % ACCENTS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [latestEqpTxApi]);

  // ─── AI / OCR INTELLIGENCE DERIVATIONS ───────────────────────────────────────

  // Parsed lock-report rows (one per OCR inference) with timestamp, class, ISO validity.
  const ocrRows = useMemo(() => {
    const rows = Array.isArray(lockReportApi?.data) ? lockReportApi.data : [];
    return rows.map((r) => {
      const { ocrNo } = parseContNo(r);
      const ts = parseDateTime(get(r, "TransDate", "transdate", "DATE_TIME", "date_time",
        "TRANSACTION_DATE", "transaction_date"));
      const eqpName = String(get(r, "EqpName", "eqpname", "EQUIPMENT_NAME") || "").trim().toUpperCase();
      const devId = String(get(r, "DeviceID", "deviceid", "DEVICE_ID", "device_id", "DEVICE_IMEI") || "").trim().toUpperCase();
      return { ts, ocrNo, eqpName, devId, cls: classifyRow(r), iso: isIsoValid(r) };
    });
  }, [lockReportApi]);

  // OCR accuracy trend over the selected window — hourly for 24h, daily for 7d/30d.
  const ocrTrend = useMemo(() => {
    const hourly = ocrWindow === "24h";
    const nBuckets = hourly ? 24 : ocrWindow === "7d" ? 7 : 30;
    const bucketMs = hourly ? 3600 * 1000 : 24 * 3600 * 1000;
    const end = now.getTime();
    const buckets = Array.from({ length: nBuckets }, (_, i) => {
      const start = end - (nBuckets - i) * bucketMs;
      const d = new Date(start);
      const pad = (n) => String(n).padStart(2, "0");
      const label = hourly ? `${pad(d.getHours())}h` : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
      return { label, start, total: 0, ocr: 0, manual: 0, missing: 0, valid: 0 };
    });
    ocrRows.forEach((r) => {
      if (!r.ts) return;
      const idx = Math.floor((r.ts.getTime() - (end - nBuckets * bucketMs)) / bucketMs);
      if (idx < 0 || idx >= nBuckets) return;
      const b = buckets[idx];
      b.total++;
      if (r.cls === "ocr") b.ocr++;
      else if (r.cls === "manual") b.manual++;
      else b.missing++;
      if (r.iso) b.valid++;
    });
    return buckets.map((b) => ({
      ...b,
      rawRate: b.total > 0 ? Number((b.ocr / b.total * 100).toFixed(1)) : 0,
      effectiveRate: b.total > 0 ? Number(((b.ocr + b.manual) / b.total * 100).toFixed(1)) : 0,
    }));
  }, [ocrRows, ocrWindow, now]);

  // ISO 6346 format validity across all OCR reads (excludes missing — nothing to validate).
  const isoStats = useMemo(() => {
    let readable = 0, valid = 0, invalid = 0, missing = 0;
    ocrRows.forEach((r) => {
      if (r.cls === "missing") { missing++; return; }
      readable++;
      if (r.iso) valid++; else invalid++;
    });
    return {
      readable, valid, invalid, missing,
      validRate: readable > 0 ? (valid / readable) * 100 : null,
    };
  }, [ocrRows]);

  // Accuracy distribution — how many machines fall in each performance band.
  const accuracyDistribution = useMemo(() => {
    const bands = [
      { name: "Excellent", range: "≥ 90%", color: T.emerald, count: 0 },
      { name: "Good",      range: "75–90%", color: T.cyan,    count: 0 },
      { name: "Fair",      range: "50–75%", color: T.amber,   count: 0 },
      { name: "Poor",      range: "< 50%",  color: T.red,     count: 0 },
      { name: "No Data",   range: "—",      color: T.textMute, count: 0 },
    ];
    machines.forEach(({ accuracy }) => {
      if (accuracy == null) bands[4].count++;
      else if (accuracy >= 90) bands[0].count++;
      else if (accuracy >= 75) bands[1].count++;
      else if (accuracy >= 50) bands[2].count++;
      else bands[3].count++;
    });
    return bands;
  }, [machines]);

  // Throughput — inference volume across the OCR window.
  const throughput = useMemo(() => {
    const tsRows = ocrRows.filter((r) => r.ts);
    const total = ocrRows.length;
    const hrs = ocrWindow === "7d" ? 168 : ocrWindow === "30d" ? 720 : 24;
    const perHour = total / hrs;
    // Peak hour-of-day by volume
    const byHour = new Map();
    tsRows.forEach((r) => {
      const h = r.ts.getHours();
      byHour.set(h, (byHour.get(h) || 0) + 1);
    });
    let peakHour = null, peakCount = 0;
    for (const [h, c] of byHour.entries()) if (c > peakCount) { peakCount = c; peakHour = h; }
    return { total, perHour, peakHour, peakCount };
  }, [ocrRows, ocrWindow]);

  // Active alerts — actionable anomalies an AI/ops engineer should triage.
  const alerts = useMemo(() => {
    const out = [];
    machines.forEach((m) => {
      const name = m.machine.name;
      if (m.status === "breakdown") {
        out.push({ severity: "critical", machine: name, msg: "Equipment in breakdown state", deviceId: m.machine.deviceId });
      }
      if (m.status === "offline" && m.machine.deviceId) {
        out.push({ severity: "warning", machine: name, msg: `Device offline · last seen ${m.lastSeen}`, deviceId: m.machine.deviceId });
      }
      if (m.accuracy != null && m.accuracy < 50 && m.ocrData?.total >= 5) {
        out.push({ severity: "critical", machine: name, msg: `OCR accuracy critically low (${m.accuracy.toFixed(0)}%)`, deviceId: m.machine.deviceId });
      } else if (m.accuracy != null && m.accuracy < 75 && m.ocrData?.total >= 5) {
        out.push({ severity: "warning", machine: name, msg: `OCR accuracy below target (${m.accuracy.toFixed(0)}%)`, deviceId: m.machine.deviceId });
      }
      if (m.ocrData && m.ocrData.total >= 10) {
        const missRate = (m.ocrData.missing / m.ocrData.total) * 100;
        if (missRate >= 30) out.push({ severity: "warning", machine: name, msg: `High miss rate — ${missRate.toFixed(0)}% unresolved`, deviceId: m.machine.deviceId });
      }
      if (!m.machine.deviceId) {
        out.push({ severity: "info", machine: name, msg: "No device assigned — not reporting", deviceId: null });
      }
    });
    const rank = { critical: 0, warning: 1, info: 2 };
    return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
  }, [machines]);

  const manualOverrideRate = ocrStats.total > 0 ? (ocrStats.manual / ocrStats.total) * 100 : null;

  // Enriched machine entry currently open in the drill modal + its recent OCR rows.
  const drillEntry = useMemo(
    () => machines.find((m) => m.machine.deviceId === drillDeviceId) || null,
    [machines, drillDeviceId]
  );
  const drillOcrRows = useMemo(() => {
    if (!drillEntry) return [];
    const nameKey = drillEntry.machine.name.toUpperCase();
    const devKey = drillEntry.machine.deviceId ? drillEntry.machine.deviceId.toUpperCase() : null;
    return ocrRows
      .filter((r) => r.eqpName === nameKey || (devKey && (r.devId === devKey || r.eqpName === devKey)))
      .sort((a, b) => (b.ts?.getTime() || 0) - (a.ts?.getTime() || 0))
      .slice(0, 50);
  }, [ocrRows, drillEntry]);

  // ─── System health indicators ───────────────────────────────────────────────
  const sysHealth = [
    { label: "Equipment API", ok: !equipmentLoading && !!equipmentApi, loading: equipmentFetching },
    { label: "Live Feed",     ok: !liveLocLoading && !!liveLocApi,     loading: liveLocFetching },
    { label: "Tx Engine",     ok: !liveTxLoading && !!liveTxApi,       loading: liveTxFetching },
    { label: "OCR Report",    ok: !lockLoading && !!lockReportApi,     loading: lockLoading },
  ];

  // Sorted machine list for display
  const sortedMachines = useMemo(() => {
    const order = { online: 0, idle: 1, breakdown: 2, offline: 3, unknown: 4, "no-device": 5 };
    return [...machines].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  }, [machines]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-screen" style={{ background: "linear-gradient(145deg, #f8fafc 0%, #eef2ff 50%, #f0f7ff 100%)", color: T.text }}>

      {/* ── Global background grid lines ── */}
      <div className="fixed inset-0 pointer-events-none select-none"
        style={{
          opacity: 0.3,
          backgroundImage: `
            linear-gradient(rgba(99,102,241,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.1) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 min-h-screen flex flex-col">
        <Navbar />

      <main className="flex-1 px-4 md:px-6 pb-10 space-y-5 max-w-screen-2xl mx-auto w-full">

        {/* ══ TOP HEADER ═══════════════════════════════════════════════════════ */}
        <div className="pt-5 pb-1">
          <div className="flex flex-wrap items-start justify-between gap-4">

            {/* Left: Title */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: `${T.cyan}15`, border: `1px solid ${T.cyan}25` }}>
                  <FiTerminal className="w-4 h-4" style={{ color: T.cyan }} />
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: T.cyan }}>
                  Developer Command Center
                </div>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: T.text }}>
                Machine Performance
                <span className="ml-2 text-xl md:text-2xl font-black" style={{ color: T.cyan }}>Monitor</span>
              </h1>
              <p className="text-xs mt-0.5" style={{ color: T.textMute }}>
                Real-time telemetry · OCR analytics · Fleet intelligence
              </p>
            </div>

            {/* Right: status + controls */}
            <div className="flex flex-col items-end gap-2">
              {/* Clock */}
              <div className="flex items-center gap-2 text-[10px] font-mono font-black px-3 py-1.5 rounded-xl"
                style={{ background: "white", border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span style={{ color: T.textDim }}>LIVE</span>
                <span style={{ color: T.text }}>{fmtTime(now)}</span>
              </div>

              {/* System health badges */}
              <div className="flex flex-wrap justify-end gap-1.5">
                {sysHealth.map((s) => (
                  <HealthBadge key={s.label} label={s.label} ok={s.ok} loading={s.loading} />
                ))}
              </div>

              {/* Refresh */}
              <RefreshBtn onClick={refetchAll} loading={isAnyFetching} color={T.cyan} />
            </div>
          </div>
        </div>

        {/* ══ KPI CARDS ════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard icon={FiServer} label="Total Machines" value={fleetStats.total}
            sub="registered equipment" accent={T.blue} loading={equipmentLoading} />
          <KpiCard icon={FiWifi} label="Online Now" value={fleetStats.online}
            sub="active last 10 min" accent={T.emerald} loading={equipmentLoading || liveLocLoading}
            trend={fleetStats.total > 0 ? ((fleetStats.online / fleetStats.total) * 100) - 50 : null} />
          <KpiCard icon={FiWifiOff} label="Offline" value={fleetStats.offline + fleetStats.idle}
            sub={`${fleetStats.idle} idle · ${fleetStats.offline} dark`} accent={T.red}
            loading={equipmentLoading || liveLocLoading} />
          <KpiCard icon={FiActivity} label="Fleet Utilization" value={fleetStats.utilization}
            suffix="%" sub="online / total ratio" accent={T.cyan} loading={equipmentLoading || liveLocLoading}
            decimals={1} />
          <KpiCard icon={FiPercent} label="OCR Accuracy" value={ocrStats.rawRate ?? 0}
            suffix="%" sub={`last ${ocrWindow} · pure OCR`} accent={T.indigo} loading={lockLoading}
            decimals={1}
            trend={ocrStats.rawRate != null ? ocrStats.rawRate - 85 : null} />
          <KpiCard icon={FiZap} label="Feed Records" value={totalScans}
            sub="in transaction buffer" accent={T.amber} loading={eqpTxLoading} />
        </div>

        {/* ══ AI INTELLIGENCE KPI STRIP ════════════════════════════════════════ */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <FiCpu className="w-3.5 h-3.5" style={{ color: T.purple }} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: T.purple }}>
              AI / OCR Intelligence
            </span>
            <span className="text-[10px]" style={{ color: T.textMute }}>· model performance · last {ocrWindow}</span>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${T.purple}30, transparent)` }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard icon={FiTarget} label="Effective Accuracy" value={ocrStats.effectiveRate ?? 0}
              suffix="%" sub="OCR + manual resolved" accent={T.emerald} loading={lockLoading} decimals={1}
              trend={ocrStats.effectiveRate != null ? ocrStats.effectiveRate - 90 : null} />
            <KpiCard icon={FiUserCheck} label="Manual Override" value={manualOverrideRate ?? 0}
              suffix="%" sub="human-in-the-loop rate" accent={T.amber} loading={lockLoading} decimals={1}
              trend={manualOverrideRate != null ? -(manualOverrideRate) : null} />
            <KpiCard icon={FiCrosshair} label="ISO Format Valid" value={isoStats.validRate ?? 0}
              suffix="%" sub={`${fmtNumber(isoStats.valid)} of ${fmtNumber(isoStats.readable)} reads`} accent={T.cyan}
              loading={lockLoading} decimals={1} />
            <KpiCard icon={FiAlertTriangle} label="Miss Rate" value={ocrStats.missingRate ?? 0}
              suffix="%" sub={`${fmtNumber(ocrStats.missing)} unresolved`} accent={T.red} loading={lockLoading}
              decimals={1} />
            <KpiCard icon={FiGitCommit} label="Inference Volume" value={throughput.total}
              sub={`≈ ${throughput.perHour.toFixed(1)}/hr · peak ${throughput.peakHour != null ? `${String(throughput.peakHour).padStart(2, "0")}h` : "—"}`}
              accent={T.indigo} loading={lockLoading} />
            <KpiCard icon={FiBell} label="Active Alerts" value={alerts.length}
              sub={`${alerts.filter((a) => a.severity === "critical").length} critical · ${alerts.filter((a) => a.severity === "warning").length} warning`}
              accent={alerts.some((a) => a.severity === "critical") ? T.red : alerts.length > 0 ? T.amber : T.emerald}
              loading={isAnyLoading} />
          </div>
        </div>

        {/* ══ MACHINE HEALTH GRID + TIMELINE ═══════════════════════════════════ */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Machine grid */}
          <div className="xl:col-span-2">
            <Panel
              title={`Machine Fleet · ${sortedMachines.length} units`}
              subtitle={`${fleetStats.online} online · ${fleetStats.idle} idle · ${fleetStats.offline} offline · ${fleetStats.breakdown} breakdown`}
              icon={FiServer}
              accent={T.blue}
              noPad
              right={
                <div className="flex items-center gap-2">
                  <ViewToggle value={machineView} onChange={setMachineView} />
                </div>
              }
            >
              <div className="p-4 overflow-y-auto" style={{ maxHeight: "520px" }}>
                {isAnyLoading && sortedMachines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <div className="w-8 h-8 rounded-full border-2 animate-spin"
                      style={{ borderColor: `${T.cyan}30`, borderTopColor: T.cyan }} />
                    <span className="text-xs" style={{ color: T.textMute }}>Loading fleet data…</span>
                  </div>
                ) : sortedMachines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-2">
                    <FiServer className="w-8 h-8 opacity-20" />
                    <span className="text-xs" style={{ color: T.textMute }}>No equipment found</span>
                  </div>
                ) : machineView === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sortedMachines.map(({ machine, status, lastSeen, lastSeenDate, lastContainer, accuracy, scanCount, activity }) => (
                      <MachineCard
                        key={machine.id}
                        machine={machine}
                        status={status}
                        lastSeen={lastSeen}
                        lastSeenDate={lastSeenDate}
                        lastContainer={lastContainer}
                        accuracy={accuracy}
                        scanCount={scanCount}
                        activity={activity}
                        onClick={() => setDrillDeviceId(machine.deviceId)}
                      />
                    ))}
                  </div>
                ) : (
                  /* List view */
                  <DataTable
                    maxHeight="460px"
                    cols={[
                      { label: "Machine", key: "name", bold: true },
                      { label: "Device ID", key: "deviceId", mono: true, dim: true },
                      { label: "Status", key: "status", render: (v) => {
                        const cfg = STATUS_CFG[v] || STATUS_CFG.unknown;
                        return (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase"
                            style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}25` }}>
                            <PulseDot status={v} />
                            {cfg.label}
                          </span>
                        );
                      }},
                      { label: "Last Seen", key: "lastSeen", dim: true },
                      { label: "Accuracy", key: "accuracy", align: "right", render: (v) => {
                        if (v == null) return <span style={{ color: T.textMute }}>—</span>;
                        const c = v >= 90 ? T.emerald : v >= 75 ? T.amber : T.red;
                        return <span style={{ color: c, fontWeight: 900 }}>{v.toFixed(1)}%</span>;
                      }},
                      { label: "Scans", key: "scanCount", align: "right", dim: true },
                      { label: "Last Container", key: "lastContainer", mono: true, muted: true },
                    ]}
                    rows={sortedMachines.map(({ machine, status, lastSeen, accuracy, scanCount, lastContainer }) => ({
                      name: machine.name,
                      deviceId: machine.deviceId || "—",
                      status,
                      lastSeen,
                      accuracy,
                      scanCount: scanCount > 0 ? scanCount : null,
                      lastContainer: lastContainer || "—",
                    }))}
                    emptyMsg="No machines found"
                  />
                )}
              </div>
            </Panel>
          </div>

          {/* Right column: Transaction Timeline + Packet Breakdown */}
          <div className="flex flex-col gap-5">

            {/* Transaction timeline */}
            <Panel title="Transaction Timeline" subtitle="Last 12 hours · hourly buckets"
              icon={FiTrendingUp} accent={T.cyan} className="flex-1">
              <div className="flex-1 min-h-0" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={txTimeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad-scans" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={T.cyan} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={T.cyan} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="grad-cap" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={T.emerald} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={T.emerald} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: T.textMute, fontSize: 9, fontWeight: 700 }}
                      axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: T.textMute, fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} />
                    <Area type="monotone" dataKey="scans" name="Total Scans" stroke={T.cyan}
                      strokeWidth={2} fill="url(#grad-scans)" dot={false} />
                    <Area type="monotone" dataKey="captured" name="Captured" stroke={T.emerald}
                      strokeWidth={2} fill="url(#grad-cap)" dot={false} />
                    <Bar dataKey="missing" name="Missing" fill={`${T.red}50`} radius={[2, 2, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            {/* Packet type breakdown */}
            <Panel title="Packet Types" subtitle="Transaction feed distribution"
              icon={FiLayers} accent={T.indigo}>
              {packetBreakdown.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-xs" style={{ color: T.textMute }}>Awaiting data…</span>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div style={{ width: 120, height: 120 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={packetBreakdown} cx="50%" cy="50%" innerRadius={32} outerRadius={55}
                          dataKey="value" stroke="none" paddingAngle={2}>
                          {packetBreakdown.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip content={<Tip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    {packetBreakdown.slice(0, 6).map((entry, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.fill }} />
                          <span className="text-[10px] font-black truncate" style={{ color: T.textDim }}>{entry.name}</span>
                        </div>
                        <span className="text-[10px] font-black tabular-nums shrink-0" style={{ color: T.text }}>
                          {fmtNumber(entry.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </div>
        </div>

        {/* ══ OCR ACCURACY TREND + ACTIVE ALERTS ═══════════════════════════════ */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Accuracy trend over time */}
          <div className="xl:col-span-2">
            <Panel
              title="OCR Accuracy Trend"
              subtitle={`Model performance drift · last ${ocrWindow} · ${ocrWindow === "24h" ? "hourly" : "daily"} buckets`}
              icon={FiTrendingUp}
              accent={T.purple}
              right={
                <div className="flex items-center gap-3">
                  {[
                    { label: "Raw OCR", color: T.cyan },
                    { label: "Effective", color: T.emerald },
                    { label: "Volume", color: T.indigo },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span className="text-[9px] font-black" style={{ color: T.textMute }}>{label}</span>
                    </div>
                  ))}
                </div>
              }
            >
              {lockLoading ? (
                <div className="flex items-center justify-center" style={{ height: 280 }}>
                  <div className="w-8 h-8 rounded-full border-2 animate-spin"
                    style={{ borderColor: `${T.purple}30`, borderTopColor: T.purple }} />
                </div>
              ) : ocrTrend.every((b) => b.total === 0) ? (
                <div className="flex flex-col items-center justify-center gap-2" style={{ height: 280 }}>
                  <FiTrendingUp className="w-8 h-8 opacity-20" />
                  <span className="text-xs" style={{ color: T.textMute }}>No timestamped OCR data in window</span>
                </div>
              ) : (
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={ocrTrend} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="grad-eff" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={T.emerald} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={T.emerald} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: T.textMute, fontSize: 9, fontWeight: 700 }}
                        axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis yAxisId="pct" domain={[0, 100]} tick={{ fill: T.textMute, fontSize: 9 }}
                        axisLine={false} tickLine={false} width={34} unit="%" />
                      <YAxis yAxisId="vol" orientation="right" tick={{ fill: T.textMute, fontSize: 9 }}
                        axisLine={false} tickLine={false} width={28} />
                      <Tooltip content={<Tip />} />
                      <Bar yAxisId="vol" dataKey="total" name="Volume" fill={`${T.indigo}45`} radius={[2, 2, 0, 0]} maxBarSize={26} />
                      <Area yAxisId="pct" type="monotone" dataKey="effectiveRate" name="Effective %" stroke={T.emerald}
                        strokeWidth={2} fill="url(#grad-eff)" dot={false} />
                      <Line yAxisId="pct" type="monotone" dataKey="rawRate" name="Raw OCR %" stroke={T.cyan}
                        strokeWidth={2.5} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>

          {/* Active alerts */}
          <Panel
            title="Active Alerts"
            subtitle={`${alerts.length} anomalies need attention`}
            icon={FiBell}
            accent={alerts.some((a) => a.severity === "critical") ? T.red : T.amber}
            noPad
          >
            <div className="overflow-y-auto" style={{ maxHeight: 340 }}>
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12">
                  <FiCheckCircle className="w-9 h-9" style={{ color: T.emerald }} />
                  <span className="text-xs font-black" style={{ color: T.emerald }}>All systems nominal</span>
                  <span className="text-[10px]" style={{ color: T.textMute }}>No anomalies detected</span>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: T.border }}>
                  {alerts.map((a, i) => {
                    const sc = SEVERITY[a.severity];
                    const Icon = sc.icon;
                    const clickable = !!a.deviceId;
                    return (
                      <button
                        key={i}
                        onClick={() => clickable && setDrillDeviceId(a.deviceId)}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors ${clickable ? "hover:bg-indigo-50/70 cursor-pointer" : "cursor-default"}`}
                        style={{ borderColor: T.border }}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: `${sc.color}15`, color: sc.color, border: `1px solid ${sc.color}25` }}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black truncate" style={{ color: T.text }}>{a.machine}</span>
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded shrink-0"
                              style={{ background: `${sc.color}18`, color: sc.color }}>{sc.label}</span>
                          </div>
                          <div className="text-[10px] mt-0.5" style={{ color: T.textDim }}>{a.msg}</div>
                        </div>
                        {clickable && <FiChevronRight className="w-3.5 h-3.5 shrink-0 mt-1.5" style={{ color: T.textMute }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* ══ OCR ANALYTICS ════════════════════════════════════════════════════ */}
        <Panel
          title="OCR Analytics"
          subtitle={`Last ${ocrWindow} · transaction classification breakdown`}
          icon={FiEye}
          accent={T.indigo}
          right={
            <div className="flex items-center gap-1">
              {["24h", "7d", "30d"].map((w) => (
                <button key={w} onClick={() => setOcrWindow(w)}
                  className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-all"
                  style={{
                    background: ocrWindow === w ? `${T.indigo}25` : "transparent",
                    color: ocrWindow === w ? T.indigo : T.textMute,
                    border: `1px solid ${ocrWindow === w ? `${T.indigo}40` : T.border}`,
                  }}>
                  {w}
                </button>
              ))}
            </div>
          }
        >
          {lockLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: `${T.indigo}30`, borderTopColor: T.indigo }} />
            </div>
          ) : (
            <>
              {/* ── KPI row ── */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                {[
                  { label: "Total Scans",     value: ocrStats.total,          sub: null,                                                                          color: T.textDim,  icon: FiDatabase },
                  { label: "OCR Captured",    value: ocrStats.ocr,            sub: ocrStats.rawRate    != null ? `${ocrStats.rawRate.toFixed(1)}%`    : "—",     color: T.cyan,     icon: FiEye },
                  { label: "Manual Updates",  value: ocrStats.manual,         sub: ocrStats.manualRate != null ? `${ocrStats.manualRate.toFixed(1)}%` : "—",     color: T.amber,    icon: FiSliders },
                  { label: "Still Missing",   value: ocrStats.missing,        sub: ocrStats.missingRate!= null ? `${ocrStats.missingRate.toFixed(1)}%`: "—",     color: T.red,      icon: FiAlertTriangle },
                  { label: "Total Resolved",  value: ocrStats.ocr + ocrStats.manual, sub: ocrStats.effectiveRate != null ? `${ocrStats.effectiveRate.toFixed(1)}%` : "—", color: T.emerald, icon: FiCheck },
                ].map(({ label, value, sub, color, icon: Icon }) => (
                  <div key={label} className="rounded-xl p-3 flex flex-col gap-1"
                    style={{ background: `${color}08`, border: `1px solid ${color}18` }}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Icon className="w-3 h-3" style={{ color }} />
                      <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: T.textMute }}>{label}</span>
                    </div>
                    <span className="text-2xl font-black tabular-nums" style={{ color }}>{fmtNumber(value)}</span>
                    {sub && <span className="text-[11px] font-black" style={{ color }}>{sub}</span>}
                  </div>
                ))}
              </div>

              {/* ── Performance bars ── */}
              <div className="rounded-xl p-4 mb-5" style={{ background: "#f8fafc", border: `1px solid ${T.border}` }}>
                <div className="text-[10px] font-black uppercase tracking-wider mb-4" style={{ color: T.textMute }}>
                  Performance Comparison
                </div>
                <div className="space-y-4">
                  {[
                    { label: "Raw OCR Performance",   sub: "Pure OCR — zero manual intervention",      value: ocrStats.rawRate,      color: T.cyan },
                    { label: "Effective Performance",  sub: "OCR + Manual updates (total resolved %)",  value: ocrStats.effectiveRate, color: T.emerald },
                    { label: "Missing Rate",           sub: "Still unresolved — no OCR & no update",    value: ocrStats.missingRate,  color: T.red },
                  ].map(({ label, sub, value, color }) => (
                    <div key={label}>
                      <div className="flex items-start justify-between mb-1.5 gap-2">
                        <div className="min-w-0">
                          <span className="text-[11px] font-black block" style={{ color: T.textDim }}>{label}</span>
                          <span className="text-[9px]" style={{ color: T.textMute }}>{sub}</span>
                        </div>
                        <span className="text-base font-black tabular-nums shrink-0" style={{ color }}>
                          {value != null ? `${value.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.04)" }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${value ?? 0}%`, background: color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Per-machine table ── */}
              {ocrChartData.length > 0 ? (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: T.textMute }}>
                    Per-Machine OCR Breakdown
                  </div>
                  <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${T.border}` }}>
                    <table className="w-full text-[10px]" style={{ borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f0f4ff", borderBottom: `1px solid ${T.border}` }}>
                          {["Machine", "Total", "OCR (Pure)", "Manual", "Missing", "Raw OCR %", "Effective %"].map((h) => (
                            <th key={h} className="px-3 py-2.5 text-left font-black uppercase tracking-wider"
                              style={{ color: T.textMute, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ocrChartData.map((row, i) => {
                          const rawColor = row.rawRate >= 90 ? T.emerald : row.rawRate >= 75 ? T.amber : T.red;
                          const effColor = row.effectiveRate >= 90 ? T.emerald : row.effectiveRate >= 75 ? T.amber : T.red;
                          return (
                            <tr key={i} style={{ borderBottom: i < ocrChartData.length - 1 ? `1px solid ${T.border}` : "none" }}
                              className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-3 py-2.5" style={{ whiteSpace: "nowrap" }}>
                                <div className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: rawColor }} />
                                  <span className="font-black" style={{ color: T.text }}>{row.fullName}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 font-black tabular-nums" style={{ color: T.textDim }}>{fmtNumber(row.total)}</td>
                              <td className="px-3 py-2.5 font-black tabular-nums" style={{ color: T.cyan }}>{fmtNumber(row.ocr)}</td>
                              <td className="px-3 py-2.5 font-black tabular-nums" style={{ color: T.amber }}>{fmtNumber(row.manual)}</td>
                              <td className="px-3 py-2.5 font-black tabular-nums" style={{ color: T.red }}>{fmtNumber(row.missing)}</td>
                              <td className="px-3 py-2.5" style={{ minWidth: 130 }}>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.04)" }}>
                                    <div className="h-full rounded-full transition-all"
                                      style={{ width: `${row.rawRate}%`, background: rawColor }} />
                                  </div>
                                  <span className="font-black tabular-nums shrink-0" style={{ color: rawColor }}>{row.rawRate.toFixed(1)}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5" style={{ minWidth: 130 }}>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.04)" }}>
                                    <div className="h-full rounded-full transition-all"
                                      style={{ width: `${row.effectiveRate}%`, background: effColor }} />
                                  </div>
                                  <span className="font-black tabular-nums shrink-0" style={{ color: effColor }}>{row.effectiveRate.toFixed(1)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center gap-5 mt-2.5 flex-wrap">
                    {[
                      { label: "≥ 90% — Excellent", color: T.emerald },
                      { label: "≥ 75% — Acceptable", color: T.amber },
                      { label: "< 75% — Review Required", color: T.red },
                    ].map(({ label, color }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                        <span className="text-[9px] font-black" style={{ color: T.textMute }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-[11px]" style={{ color: T.textMute }}>
                  No OCR transaction data for last {ocrWindow}. Try a wider range or check data pipeline.
                </div>
              )}
            </>
          )}
        </Panel>

        {/* ══ ACCURACY DISTRIBUTION + ISO VALIDITY + RESOLUTION MIX ════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Accuracy distribution histogram */}
          <Panel title="Accuracy Distribution" subtitle="Fleet spread across performance bands"
            icon={FiBarChart2} accent={T.cyan}>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accuracyDistribution} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: T.textMute, fontSize: 9, fontWeight: 700 }}
                    axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: T.textMute, fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip />} cursor={{ fill: "rgba(99,102,241,0.04)" }} />
                  <Bar dataKey="count" name="Machines" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {accuracyDistribution.map((b, i) => <Cell key={i} fill={b.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-5 gap-1.5 mt-2">
              {accuracyDistribution.map((b) => (
                <div key={b.name} className="text-center">
                  <div className="text-sm font-black tabular-nums" style={{ color: b.color }}>{b.count}</div>
                  <div className="text-[8px] font-black" style={{ color: T.textMute }}>{b.range}</div>
                </div>
              ))}
            </div>
          </Panel>

          {/* ISO 6346 format validity */}
          <Panel title="ISO 6346 Format Validity" subtitle="Reads matching ABCD1234567 pattern"
            icon={FiCrosshair} accent={T.indigo}>
            {lockLoading ? (
              <div className="flex items-center justify-center flex-1 py-8">
                <div className="w-8 h-8 rounded-full border-2 animate-spin"
                  style={{ borderColor: `${T.indigo}30`, borderTopColor: T.indigo }} />
              </div>
            ) : (
              <div className="flex items-center gap-4 flex-1">
                <RadialGauge
                  value={isoStats.validRate ?? 0}
                  color={T.indigo}
                  size={140}
                  subtitle="valid"
                />
                <div className="flex-1 space-y-1.5 min-w-0">
                  {[
                    { label: "Valid Format", value: isoStats.valid, color: T.emerald, icon: FiCheckCircle },
                    { label: "Malformed", value: isoStats.invalid, color: T.amber, icon: FiAlertTriangle },
                    { label: "Unreadable", value: isoStats.missing, color: T.red, icon: FiX },
                  ].map(({ label, value, color, icon: Icon }) => (
                    <div key={label} className="flex items-center justify-between px-2.5 py-2 rounded-lg"
                      style={{ background: `${color}08`, border: `1px solid ${color}18` }}>
                      <span className="flex items-center gap-1.5">
                        <Icon className="w-3 h-3" style={{ color }} />
                        <span className="text-[10px] font-black" style={{ color: T.textDim }}>{label}</span>
                      </span>
                      <span className="text-[11px] font-black tabular-nums" style={{ color }}>{fmtNumber(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          {/* Auto vs manual resolution mix */}
          <Panel title="Resolution Mix" subtitle="How container numbers get resolved"
            icon={FiUserCheck} accent={T.emerald}>
            <div className="flex flex-col gap-3 flex-1 justify-center">
              {[
                { label: "Auto (Pure OCR)", value: ocrStats.ocr, rate: ocrStats.rawRate, color: T.cyan, hint: "no human touch" },
                { label: "Manual Override", value: ocrStats.manual, rate: ocrStats.manualRate, color: T.amber, hint: "human-corrected" },
                { label: "Unresolved", value: ocrStats.missing, rate: ocrStats.missingRate, color: T.red, hint: "still missing" },
              ].map(({ label, value, rate, color, hint }) => (
                <div key={label}>
                  <div className="flex items-start justify-between mb-1.5 gap-2">
                    <div className="min-w-0">
                      <span className="text-[11px] font-black block" style={{ color: T.textDim }}>{label}</span>
                      <span className="text-[9px]" style={{ color: T.textMute }}>{hint}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-base font-black tabular-nums" style={{ color }}>{rate != null ? `${rate.toFixed(1)}%` : "—"}</span>
                      <span className="text-[9px] block" style={{ color: T.textMute }}>{fmtNumber(value)} scans</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.04)" }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${rate ?? 0}%`, background: color }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* ══ LIVE TRANSACTION FEED ════════════════════════════════════════════ */}
        <Panel
          title="Live Transaction Feed"
          subtitle={`${liveFeedRows.length} records · auto-refreshing every 12s`}
          icon={FiRadio}
          accent={T.emerald}
          noPad
          right={
            <div className="flex items-center gap-1.5">
              {["all", "captured", "missing"].map((f) => (
                <button key={f} onClick={() => setFeedFilter(f)}
                  className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                  style={{
                    background: feedFilter === f ? `${T.emerald}20` : "transparent",
                    color: feedFilter === f ? T.emerald : T.textMute,
                    border: `1px solid ${feedFilter === f ? `${T.emerald}30` : T.border}`,
                  }}>
                  {f}
                </button>
              ))}
            </div>
          }
        >
          <DataTable
            maxHeight="400px"
            cols={[
              {
                label: "Timestamp", key: "ts", mono: true, dim: true,
                render: (v) => v ? fmtDateTime(v) : "—",
              },
              { label: "Machine", key: "machineName", bold: true },
              { label: "Device ID", key: "dev", mono: true, muted: true },
              {
                label: "Container", key: "container", mono: true,
                render: (v) => v || <span style={{ color: T.textMute }}>—</span>,
              },
              { label: "Packet", key: "packetType", dim: true },
              {
                label: "Status", key: "captured",
                render: (v) => {
                  if (v === null) return <span style={{ color: T.textMute }}>—</span>;
                  return v
                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black"
                        style={{ background: `${T.emerald}18`, color: T.emerald, border: `1px solid ${T.emerald}25` }}>
                        <FiCheck className="w-2.5 h-2.5" /> Captured
                      </span>
                    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black"
                        style={{ background: `${T.red}18`, color: T.red, border: `1px solid ${T.red}25` }}>
                        <FiAlertTriangle className="w-2.5 h-2.5" /> Missing
                      </span>;
                },
              },
            ]}
            rows={liveFeedRows}
            emptyMsg={liveTxLoading ? "Loading transactions…" : "No transactions in buffer"}
          />
        </Panel>

        {/* ══ BOTTOM ROW: Diagnostics + Utilization Breakdown ═════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

          {/* System Diagnostics */}
          <Panel title="System Diagnostics" subtitle="Data pipeline health" icon={FiShield} accent={T.teal}>
            <div className="space-y-3">
              {[
                { label: "Equipment Registry", val: equipmentApi?.data?.length ?? 0, unit: "records", ok: !!equipmentApi, loading: equipmentFetching, color: T.blue },
                { label: "Live Locations", val: liveLocApi?.data?.length ?? 0, unit: "devices", ok: !!liveLocApi, loading: liveLocFetching, color: T.cyan },
                { label: "Tx Buffer", val: liveTxRows.length, unit: "records", ok: !!liveTxApi, loading: liveTxFetching, color: T.emerald },
                { label: "OCR Report", val: ocrStats.total, unit: "scans", ok: !!lockReportApi, loading: lockLoading, color: T.indigo },
                { label: "Container Inventory", val: liveStatusApi?.data?.length ?? 0, unit: "containers", ok: !!liveStatusApi, loading: liveStatusLoading, color: T.amber },
              ].map(({ label, val, unit, ok, loading, color }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${loading ? "animate-pulse" : ""}`}
                        style={{ backgroundColor: loading ? T.amber : ok ? color : T.red }} />
                      <span className="text-[10px] font-black" style={{ color: T.textDim }}>{label}</span>
                    </div>
                    <span className="text-[10px] font-black tabular-nums" style={{ color: T.text }}>
                      {fmtNumber(val)} <span style={{ color: T.textMute }}>{unit}</span>
                    </span>
                  </div>
                  <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "#f0f4ff" }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: ok ? "100%" : "0%",
                        background: loading ? T.amber : ok ? color : T.red,
                      }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Fleet Status Breakdown */}
          <Panel title="Fleet Status" subtitle="All registered machines" icon={FiLayers} accent={T.blue}>
            <div className="space-y-2.5">
              {[
                { label: "Online",    count: fleetStats.online,    color: T.emerald, pct: fleetStats.total > 0 ? (fleetStats.online / fleetStats.total) * 100 : 0 },
                { label: "Idle",      count: fleetStats.idle,      color: T.amber,   pct: fleetStats.total > 0 ? (fleetStats.idle / fleetStats.total) * 100 : 0 },
                { label: "Offline",   count: fleetStats.offline,   color: T.red,     pct: fleetStats.total > 0 ? (fleetStats.offline / fleetStats.total) * 100 : 0 },
                { label: "Breakdown", count: fleetStats.breakdown, color: T.orange,  pct: fleetStats.total > 0 ? (fleetStats.breakdown / fleetStats.total) * 100 : 0 },
                { label: "No Device", count: fleetStats.noDevice,  color: T.textMute,pct: fleetStats.total > 0 ? (fleetStats.noDevice / fleetStats.total) * 100 : 0 },
              ].map(({ label, count, color, pct }) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-[10px] font-black mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span style={{ color: T.textDim }}>{label}</span>
                    </div>
                    <span style={{ color: T.text }}>{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#f0f4ff" }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: color, opacity: count === 0 ? 0.2 : 1 }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: T.textMute }}>
                  Fleet Utilization
                </span>
                <span className="text-sm font-black" style={{ color: T.cyan }}>
                  {fleetStats.utilization.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.04)" }}>
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${fleetStats.utilization}%`,
                    background: `linear-gradient(90deg, ${T.blue}, ${T.cyan})`,
                  }} />
              </div>
            </div>
          </Panel>

          {/* OCR Summary */}
          <Panel title="OCR Summary" subtitle={`Last ${ocrWindow} · global totals`} icon={FiEye} accent={T.indigo}>
            {lockLoading ? (
              <div className="flex items-center justify-center flex-1 py-8">
                <div className="w-8 h-8 rounded-full border-2 animate-spin"
                  style={{ borderColor: `${T.indigo}30`, borderTopColor: T.indigo }} />
              </div>
            ) : (
              <div className="flex flex-col gap-3 flex-1">
                {/* Dual gauge */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Raw OCR", sub: "without manual", value: ocrStats.rawRate, color: T.cyan },
                    { label: "Effective", sub: "OCR + manual", value: ocrStats.effectiveRate, color: T.emerald },
                  ].map(({ label, sub, value, color }) => (
                    <div key={label} className="rounded-xl p-3 text-center"
                      style={{ background: `${color}08`, border: `1px solid ${color}18` }}>
                      <div className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: T.textMute }}>{label}</div>
                      <div className="text-2xl font-black tabular-nums" style={{ color }}>
                        {value != null ? `${value.toFixed(1)}%` : "—"}
                      </div>
                      <div className="text-[9px] mt-0.5" style={{ color: T.textMute }}>{sub}</div>
                      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${value ?? 0}%`, background: color }} />
                      </div>
                    </div>
                  ))}
                </div>
                {/* 5-stat grid */}
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { label: "Total Scans",    value: ocrStats.total,           color: T.textDim },
                    { label: "OCR Captured",   value: ocrStats.ocr,             color: T.cyan },
                    { label: "Manual Updates", value: ocrStats.manual,          color: T.amber },
                    { label: "Still Missing",  value: ocrStats.missing,         color: T.red },
                    { label: "Total Resolved", value: ocrStats.ocr + ocrStats.manual, color: T.emerald },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
                      style={{ background: "#f8fafc" }}>
                      <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: T.textMute }}>{label}</span>
                      <span className="text-[11px] font-black tabular-nums" style={{ color }}>{fmtNumber(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          {/* Data Freshness Monitor */}
          <Panel title="Data Freshness" subtitle="Time since last heartbeat per machine" icon={FiClock} accent={T.amber}>
            <div className="flex-1 overflow-y-auto space-y-2" style={{ maxHeight: "280px" }}>
              {sortedMachines.length === 0 ? (
                <div className="text-center py-8 text-xs" style={{ color: T.textMute }}>No data</div>
              ) : (
                sortedMachines.slice(0, 12).map(({ machine, status, lastSeenDate }) => {
                  const cfg = STATUS_CFG[status] || STATUS_CFG.unknown;
                  const ageMs = lastSeenDate ? now.getTime() - lastSeenDate.getTime() : null;
                  const ageMins = ageMs != null ? Math.floor(ageMs / 60000) : null;
                  const freshPct = ageMs != null ? Math.max(0, 100 - (ageMs / (30 * 60 * 1000)) * 100) : 0;
                  return (
                    <div key={machine.id}>
                      <div className="flex items-center justify-between text-[9px] font-black mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <PulseDot status={status} />
                          <span className="truncate" style={{ color: T.textDim }}>{machine.name}</span>
                        </div>
                        <span style={{ color: cfg.color }} className="shrink-0 ml-2">
                          {ageMins != null ? `${ageMins}m` : "—"}
                        </span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "#f0f4ff" }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${freshPct}%`, background: cfg.color }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Panel>
        </div>

        {/* ══ FOOTER ═══════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between pt-2 pb-4 flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textMute }}>
              YMS · Developer Dashboard
            </span>
            <span className="text-[9px]" style={{ color: T.textMute }}>
              Polling: Equipment 15s · Locations 10s · Tx 12s
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px]" style={{ color: T.textMute }}>
              {now.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>

      </main>
      </div>

      {/* ══ MACHINE DRILL-DOWN MODAL ═══════════════════════════════════════════ */}
      {drillEntry && (
        <MachineDrillModal
          entry={drillEntry}
          recentOcr={drillOcrRows}
          onClose={() => setDrillDeviceId(null)}
        />
      )}
    </div>
  );
};

export default DeveloperDashboard;
