import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiCpu, FiCheckCircle, FiEdit3, FiAlertTriangle, FiTarget, FiZap,
  FiRefreshCw, FiActivity, FiImage, FiX, FiClock, FiTrendingUp, FiWifi,
  FiWifiOff, FiCalendar, FiGrid, FiList, FiAward, FiLayers, FiMaximize2,
  FiArrowUpRight, FiArrowDownRight, FiChevronLeft, FiChevronRight, FiSave,
} from "react-icons/fi";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadialBarChart, RadialBar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line,
} from "recharts";
import Swal from "sweetalert2";
import Navbar from "../../../components/layout/Navbar";
import {
  useGetEquipmentQuery,
  useLazyGetEquipmentAccuracyQuery,
  useLazyGetDeviceLockReportQuery,
  useGetDeviceDataLiveLocationsQuery,
  useUpdateDeviceDataContainerMutation,
  useLazySearchContainerQuery,
} from "../../../store/api/ymsApi";

// ─── Theme tokens (light) — same palette as AdminDashboard.jsx ─────────────
const T = {
  bg: "#f0f4ff",
  bg2: "#e8eeff",
  card: "rgba(255,255,255,0.95)",
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

const AWS_IMAGE_PATH =
  "https://container-datasets.s3.ap-south-1.amazonaws.com/reach-tracker-live-ocr";
const imgUrl = (name) => (name ? `${AWS_IMAGE_PATH}/${name}` : "");
const camSrcs = (name, camN) => {
  const clean = name?.trim();
  if (!clean) return [];
  const re = new RegExp(`_cam${camN}_1\\.jpg$`, "i");
  return [1, 2, 3].map((f) => imgUrl(clean.replace(re, `_cam${camN}_${f}.jpg`)));
};

const fmtNumber = (n) => Number(n || 0).toLocaleString("en-IN");
const fmtPct = (n) => `${Number(n || 0).toFixed(1)}%`;
const fmtDateShort = (val) => {
  if (!val) return "—";
  const d = new Date(String(val).replace(" ", "T"));
  if (isNaN(d)) return String(val);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};
const fmtTime = (val) => {
  if (!val) return "—";
  const d = new Date(String(val).replace(" ", "T"));
  if (isNaN(d)) return "—";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};
const _localDate = (offset = 0) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ContNo comes back as "ABCD1234567 (EQ)" / "ABCD1234567 (M)" — status code
// is embedded in the string itself, not a separate SP column.
const classifyRow = (row) => {
  const raw = String(row.ContNo || row.RFIDDATA || "").trim();
  const num = raw.split(" ")[0];
  const isMissing = !num || num.replace(/0/g, "") === "";
  if (isMissing) return "missing";
  const m = raw.match(/\(([^)]+)\)\s*$/);
  const code = (m ? m[1] : "").trim().toUpperCase();
  if (code === "M") return "manual";
  return "auto";
};

const CLASS_CFG = {
  auto:    { label: "Auto (OCR)", color: T.cyan },
  manual:  { label: "Manual",     color: T.purple },
  missing: { label: "Missing",    color: T.red },
};

const ONLINE_MS = 10 * 60 * 1000;
const IDLE_MS = 30 * 60 * 1000;

// ─── Animated counter (verbatim pattern from AdminDashboard.jsx) ───────────
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
            <linearGradient id={`dev-spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2}
            fill={`url(#dev-spark-${color.replace("#", "")})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── KPI Card (verbatim pattern from AdminDashboard.jsx) ────────────────────
const KpiCard = ({ icon: Icon, label, value, suffix, sub, trend, accent, loading, decimals, history }) => {
  const isUp = trend != null && trend >= 0;
  return (
    <div
      className="group relative text-left w-full overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
      style={{
        background: "linear-gradient(145deg, #ffffff, #f8faff)",
        border: `1px solid ${T.border}`,
        boxShadow: "0 2px 12px -2px rgba(99,102,241,0.1), 0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div className="absolute -right-12 -top-12 w-32 h-32 rounded-full opacity-[0.06] blur-3xl group-hover:opacity-[0.12] transition-opacity" style={{ background: accent }} />
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${accent}80, transparent)` }} />
      <div className="relative p-4 md:p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}25` }}>
            <Icon className="w-5 h-5" strokeWidth={2.2} />
          </div>
          {trend != null && !loading && (
            <div className={`flex items-center gap-0.5 text-[10px] font-black px-2 py-1 rounded-full border ${isUp ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-700 bg-rose-50 border-rose-200"}`}>
              {isUp ? <FiArrowUpRight className="w-3 h-3" /> : <FiArrowDownRight className="w-3 h-3" />}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] mb-1.5" style={{ color: T.textDim }}>{label}</div>
        <div className="flex items-baseline gap-1.5 mb-2">
          <div className="text-3xl md:text-4xl font-black tabular-nums tracking-tight leading-none" style={{ color: T.text }}>
            {loading ? <span className="opacity-20">···</span> : <AnimatedNumber value={value} decimals={decimals || 0} />}
          </div>
          {suffix && !loading && <span className="text-base font-bold" style={{ color: accent }}>{suffix}</span>}
        </div>
        {sub && <div className="text-[11px] truncate" style={{ color: T.textMute }}>{sub}</div>}
        <div className="mt-2 -mx-1"><Sparkline data={history} color={accent} height={32} /></div>
      </div>
    </div>
  );
};

// ─── Glass Panel (verbatim pattern from AdminDashboard.jsx) ─────────────────
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
      <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b flex-wrap gap-2" style={{ borderColor: T.border }}>
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}20` }}>
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
    <div className={noPad ? "flex-1 flex flex-col min-h-0" : "flex-1 p-4 md:p-5 flex flex-col min-h-0"}>{children}</div>
  </div>
);

// ─── Tabbed View Switcher (verbatim pattern from AdminDashboard.jsx) ────────
const ViewSwitch = ({ options, value, onChange }) => (
  <div className="inline-flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: "rgba(0,0,0,0.04)", border: `1px solid ${T.border}` }}>
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
          value === opt.value ? "bg-white shadow text-slate-900" : "text-slate-400 hover:text-slate-700 hover:bg-white/50"
        }`}
      >
        {opt.icon && <opt.icon className="w-3 h-3" />}
        {opt.label}
      </button>
    ))}
  </div>
);

// ─── Chart Tooltip (verbatim pattern from AdminDashboard.jsx) ───────────────
const Tip = ({ active, payload, label, pct }) => {
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
          <span className="font-black tabular-nums">{typeof p.value === "number" ? (pct ? p.value.toFixed(1) : fmtNumber(p.value)) : p.value}{pct ? "%" : ""}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Radial Gauge (verbatim pattern from AdminDashboard.jsx) ────────────────
const RadialGauge = ({ value, max = 100, color = T.cyan, label, size = 150, suffix = "%", subtitle }) => {
  const v = Math.max(0, Math.min(Number(value) || 0, max));
  const data = [{ name: label || "v", value: v, fill: color }];
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="68%" outerRadius="100%"
            data={data} startAngle={210} endAngle={-30}>
            <RadialBar background={{ fill: "rgba(0,0,0,0.05)" }} dataKey="value"
              cornerRadius={20} fill={color} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingBottom: size * 0.14 }}>
          <div className="text-2xl font-black tabular-nums leading-none" style={{ color: T.text }}>
            <AnimatedNumber value={v} decimals={1} />
          </div>
          <span className="text-xs font-bold mt-1" style={{ color }}>{suffix}</span>
        </div>
      </div>
      {subtitle && <div className="text-[10px] mt-1 uppercase tracking-wider font-bold text-center" style={{ color: T.textMute }}>{subtitle}</div>}
    </div>
  );
};

// ─── Heatmap (verbatim pattern from AdminDashboard.jsx) ─────────────────────
const Heatmap = ({ data, color = T.indigo }) => {
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
                  title={`${d} ${String(h).padStart(2, "0")}:00 — ${v} scans`}
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

// single-day fallback: hourly bars — a 7x24 heatmap is mostly empty on "today"
const HourlyBars = ({ data, color = T.indigo }) => (
  <div style={{ width: "100%", height: 220 }}>
    <ResponsiveContainer>
      <BarChart data={data} barCategoryGap={data.length <= 3 ? "60%" : "30%"} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
        <XAxis dataKey="date" tick={{ fill: T.textDim, fontSize: 10, fontWeight: 600 }} axisLine={{ stroke: T.border }} tickLine={false} interval={data.length > 12 ? 2 : 0} />
        <YAxis tick={{ fill: T.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(79,70,229,0.06)" }} />
        <Bar dataKey="Total" name="Scans" radius={[4, 4, 0, 0]} fill={color} maxBarSize={64} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

// ─── DataTable (verbatim pattern from AdminDashboard.jsx) ───────────────────
const DataTable = ({ cols, rows, footerRow, emptyMsg = "No data", maxHeight = "100%", onRowClick }) => (
  <div className="flex-1 overflow-auto rounded-lg" style={{ background: "white", maxHeight, border: `1px solid ${T.border}` }}>
    <table className="w-full text-xs">
      <thead className="sticky top-0 z-10" style={{ background: "#f8fafc" }}>
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
          <tr key={i} onClick={onRowClick ? () => onRowClick(r, i) : undefined}
            className={`hover:bg-indigo-50/50 transition-colors ${onRowClick ? "cursor-pointer" : ""}`} style={{ borderBottom: `1px solid ${T.border}` }}>
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
        <tfoot className="sticky bottom-0" style={{ background: "#f0f4ff" }}>
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

// One camera's image with a manual left/right frame switcher — a machine
// captures up to 3 frames per camera (_cam{N}_1/2/3.jpg) and the correct one
// varies per scan, so the operator can page through them instead of relying
// on a single silent fallback.
const CameraPanel = ({ label, srcs, alt }) => {
  const [frame, setFrame] = useState(0);
  useEffect(() => setFrame(0), [srcs]);
  const valid = srcs.filter(Boolean);
  const hasImage = valid.length > 0;
  const src = valid[frame] || valid[0];

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}`, background: "white" }}>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ background: "#f8fafc", borderBottom: `1px solid ${T.border}` }}>
        <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: T.textDim }}>{label}</span>
        {valid.length > 1 && (
          <span className="text-[9px] font-bold" style={{ color: T.textMute }}>Frame {frame + 1} / {valid.length}</span>
        )}
      </div>
      <div className="aspect-video relative flex items-center justify-center" style={{ background: "#eef2f7" }}>
        {hasImage ? (
          <img
            key={src}
            src={src}
            alt={alt}
            className="w-full h-full object-contain"
            onError={(e) => {
              const next = frame + 1;
              if (next < valid.length) setFrame(next);
              else e.target.style.display = "none";
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-1" style={{ color: T.textMute }}>
            <FiImage size={20} />
            <span className="text-[10px] font-bold">No image</span>
          </div>
        )}
        {valid.length > 1 && (
          <>
            <button
              onClick={() => setFrame((f) => (f - 1 + valid.length) % valid.length)}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ background: "rgba(255,255,255,0.9)", border: `1px solid ${T.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
            >
              <FiChevronLeft size={14} style={{ color: T.text }} />
            </button>
            <button
              onClick={() => setFrame((f) => (f + 1) % valid.length)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ background: "rgba(255,255,255,0.9)", border: `1px solid ${T.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
            >
              <FiChevronRight size={14} style={{ color: T.text }} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const RANGE_PRESETS = [
  { label: "1D", from: -1, to: 0 },
  { label: "7D", from: -6, to: 0 },
  { label: "14D", from: -13, to: 0 },
  { label: "30D", from: -29, to: 0 },
];

const IMAGE_FILTERS = [
  { key: "all", label: "All" },
  { key: "auto", label: "Detect" },
  { key: "manual", label: "Updated" },
  { key: "missing", label: "Missed" },
];

const DeveloperDashboard = () => {
  const [fromDate, setFromDate] = useState(_localDate(-1));
  const [toDate, setToDate] = useState(_localDate(0));
  const [activePreset, setActivePreset] = useState("1D");
  const [now, setNow] = useState(new Date());
  const [online, setOnline] = useState(true);
  const [imgFilter, setImgFilter] = useState("all");
  const [gridView, setGridView] = useState("grid");
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [editContNo, setEditContNo] = useState("");
  const [contSuggestions, setContSuggestions] = useState([]);
  const [showContSug, setShowContSug] = useState(false);
  const [savingCont, setSavingCont] = useState(false);
  const [updateDeviceContainer] = useUpdateDeviceDataContainerMutation();
  const [searchContainer] = useLazySearchContainerQuery();
  const [refreshing, setRefreshing] = useState(false);

  const [trendView, setTrendView] = useState("area");
  const [mixView, setMixView] = useState("pie");
  const [breakdownView, setBreakdownView] = useState("stacked");
  const [healthView, setHealthView] = useState("gauge");
  const [activityView, setActivityView] = useState("auto");
  const [rankView, setRankView] = useState("table");

  const { data: equipmentApi } = useGetEquipmentQuery(undefined, { pollingInterval: 30000 });
  const { data: liveLocApi } = useGetDeviceDataLiveLocationsQuery(undefined, { pollingInterval: 15000 });
  const [fetchAccuracy, { data: accData, isFetching: accLoading }] = useLazyGetEquipmentAccuracyQuery();
  const [fetchLockReport, { data: lockData, isFetching: lockLoading }] = useLazyGetDeviceLockReportQuery();

  const load = () => {
    fetchAccuracy({ from_date: fromDate, to_date: toDate });
    fetchLockReport({ from_date: fromDate, to_date: toDate, report_type: "All" });
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [fromDate, toDate]);
  useEffect(() => {
    const iv = setInterval(() => { setNow(new Date()); load(); }, 30000);
    const clockIv = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(iv); clearInterval(clockIv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    setOnline(navigator.onLine);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const handleRefresh = () => { setRefreshing(true); load(); setTimeout(() => setRefreshing(false), 600); };
  const applyPreset = (p) => { setActivePreset(p.label); setFromDate(_localDate(p.from)); setToDate(_localDate(p.to)); };

  const equipmentCount = useMemo(() => (Array.isArray(equipmentApi?.data) ? equipmentApi.data.length : 0), [equipmentApi]);
  const accRows = useMemo(() => (Array.isArray(accData?.data) ? accData.data : []), [accData]);
  const lockRows = useMemo(() => (Array.isArray(lockData?.data) ? lockData.data : []), [lockData]);
  const isSingleDay = fromDate === toDate;

  const totals = useMemo(() => {
    const t = { TotalCount: 0, Missing: 0, NonMissing: 0, M: 0 };
    for (const r of accRows) {
      t.TotalCount += Number(r.TotalCount) || 0;
      t.Missing += Number(r.Missing) || 0;
      t.NonMissing += Number(r.NonMissing) || 0;
      t.M += Number(r.M) || 0;
    }
    const ocrDetected = Math.max(t.NonMissing - t.M, 0);
    const overallAccuracy = t.TotalCount > 0 ? (t.NonMissing / t.TotalCount) * 100 : 0;
    const ocrAccuracy = t.TotalCount > 0 ? (ocrDetected / t.TotalCount) * 100 : 0;
    const manualPct = t.TotalCount > 0 ? (t.M / t.TotalCount) * 100 : 0;
    const missingPct = t.TotalCount > 0 ? (t.Missing / t.TotalCount) * 100 : 0;
    return { ...t, ocrDetected, overallAccuracy, ocrAccuracy, manualPct, missingPct };
  }, [accRows]);

  // GET_EQUIPMENT_ACCURACY groups by day only — a single-day range would
  // collapse to one flat point, so build an hourly trend from the lock
  // report's per-transaction timestamps instead for that case.
  const trend = useMemo(() => {
    if (isSingleDay) {
      const byHour = new Map();
      for (const row of lockRows) {
        const t = new Date(String(row.TransDate || "").replace(" ", "T"));
        if (isNaN(t)) continue;
        const h = t.getHours();
        if (!byHour.has(h)) byHour.set(h, { Total: 0, OCR: 0, Manual: 0, Missing: 0 });
        const b = byHour.get(h);
        const cls = classifyRow(row);
        b.Total++;
        if (cls === "auto") b.OCR++;
        else if (cls === "manual") b.Manual++;
        else b.Missing++;
      }
      return Array.from({ length: 24 }, (_, h) => {
        const b = byHour.get(h) || { Total: 0, OCR: 0, Manual: 0, Missing: 0 };
        const nonMissing = b.OCR + b.Manual;
        return {
          date: `${String(h).padStart(2, "0")}:00`,
          accuracy: b.Total ? +((nonMissing / b.Total) * 100).toFixed(1) : 0,
          ocrAccuracy: b.Total ? +((b.OCR / b.Total) * 100).toFixed(1) : 0,
          Total: b.Total, OCR: b.OCR, Manual: b.Manual, Missing: b.Missing,
        };
      });
    }
    const byDate = new Map();
    for (const r of accRows) {
      const d = String(r.TransDate || "").slice(0, 10);
      if (!d) continue;
      if (!byDate.has(d)) byDate.set(d, { TotalCount: 0, Missing: 0, NonMissing: 0, M: 0 });
      const b = byDate.get(d);
      b.TotalCount += Number(r.TotalCount) || 0;
      b.Missing += Number(r.Missing) || 0;
      b.NonMissing += Number(r.NonMissing) || 0;
      b.M += Number(r.M) || 0;
    }
    return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, b]) => {
      const ocrDetected = Math.max(b.NonMissing - b.M, 0);
      return {
        date: fmtDateShort(date),
        accuracy: b.TotalCount ? +((b.NonMissing / b.TotalCount) * 100).toFixed(1) : 0,
        ocrAccuracy: b.TotalCount ? +((ocrDetected / b.TotalCount) * 100).toFixed(1) : 0,
        Total: b.TotalCount, OCR: ocrDetected, Manual: b.M, Missing: b.Missing,
      };
    });
  }, [accRows, lockRows, isSingleDay]);

  const mixData = useMemo(() => ([
    { name: "Auto (OCR)", value: totals.ocrDetected, color: T.cyan },
    { name: "Manual", value: totals.M, color: T.purple },
    { name: "Missing", value: totals.Missing, color: T.red },
  ]), [totals]);

  const perEquipment = useMemo(() => {
    const byEqp = new Map();
    for (const r of accRows) {
      const name = r.Equipment_Name || "—";
      if (!byEqp.has(name)) byEqp.set(name, { name, TotalCount: 0, Missing: 0, NonMissing: 0, M: 0 });
      const b = byEqp.get(name);
      b.TotalCount += Number(r.TotalCount) || 0;
      b.Missing += Number(r.Missing) || 0;
      b.NonMissing += Number(r.NonMissing) || 0;
      b.M += Number(r.M) || 0;
    }
    return Array.from(byEqp.values())
      .map((b) => ({ ...b, accuracy: b.TotalCount ? (b.NonMissing / b.TotalCount) * 100 : 0, ocrDetected: Math.max(b.NonMissing - b.M, 0) }))
      .sort((a, b) => b.TotalCount - a.TotalCount);
  }, [accRows]);

  const ranked = useMemo(() => [...perEquipment].filter((e) => e.TotalCount > 0).sort((a, b) => b.accuracy - a.accuracy), [perEquipment]);

  const classifiedScans = useMemo(() => [...lockRows]
    .map((row) => ({ row, cls: classifyRow(row) }))
    .sort((a, b) => new Date(String(b.row.TransDate || "").replace(" ", "T")) - new Date(String(a.row.TransDate || "").replace(" ", "T"))),
  [lockRows]);

  const filteredScans = useMemo(() => (
    imgFilter === "all" ? classifiedScans : classifiedScans.filter((x) => x.cls === imgFilter)
  ), [classifiedScans, imgFilter]);

  // Prefill the update field with the detected number so the operator only
  // has to type when it's actually wrong — but leave it blank for a missed
  // detection (the "00000000000" sentinel), same as Service Dashboard.
  useEffect(() => {
    if (selectedIdx == null) return;
    const scan = filteredScans[selectedIdx];
    if (!scan) return;
    const raw = String(scan.row.ContNo || scan.row.RFIDDATA || "").trim().split(" ")[0];
    const isMissing = !raw || raw.replace(/0/g, "") === "";
    setEditContNo(isMissing ? "" : raw);
    setContSuggestions([]);
    setShowContSug(false);
  }, [selectedIdx, filteredScans]);

  const handleContNoChange = async (val) => {
    const up = val.toUpperCase().slice(0, 11);
    setEditContNo(up);
    if (up.length >= 1) {
      try {
        const res = await searchContainer(up).unwrap();
        setContSuggestions(res?.data || res || []);
        setShowContSug(true);
      } catch {
        setContSuggestions([]);
      }
    } else {
      setContSuggestions([]);
      setShowContSug(false);
    }
  };

  const selectContSuggestion = (c) => {
    const no = typeof c === "string" ? c : c?.Cont_No || c?.cont_no || c?.CONTAINER_NO || c?.container_no || "";
    setEditContNo(no);
    setShowContSug(false);
  };

  const classCounts = useMemo(() => {
    const c = { auto: 0, manual: 0, missing: 0 };
    for (const x of classifiedScans) c[x.cls]++;
    return c;
  }, [classifiedScans]);

  // Fleet status — same source AdminDashboard's "Active Equipment" uses:
  // GET_EQUIPMENT master list cross-referenced against live GPS pings.
  const equipmentHealth = useMemo(() => {
    const liveRows = Array.isArray(liveLocApi?.data) ? liveLocApi.data : [];
    const lastSeenByDevice = new Map();
    for (const r of liveRows) {
      const dev = String(r.DEVICE_IMEI || r.device_imei || r.DEVICE_ID || r.device_id || "").trim().toUpperCase();
      if (!dev) continue;
      const t = new Date(String(r.LAST_AT || r.last_at || r.DATE_TIME || r.date_time || r.LAST_TRANSACTION_DATE || r.last_transaction_date || "").replace(" ", "T"));
      if (isNaN(t)) continue;
      const prev = lastSeenByDevice.get(dev);
      if (!prev || t > prev) lastSeenByDevice.set(dev, t);
    }
    const eqRows = Array.isArray(equipmentApi?.data) ? equipmentApi.data : [];
    const nowMs = now.getTime();
    return eqRows.map((item, i) => {
      const name = String(item?.Equipment_Code ?? item?.equipment_code ?? item?.EQUIPMENT_CODE ?? item?.Equipment_Name ?? item?.equipment_name ?? item?.EQUIPMENT_NAME ?? `EQP-${i + 1}`).trim();
      const deviceId = String(item?.Device_ID ?? item?.device_id ?? item?.DEVICE_ID ?? "").trim().toUpperCase();
      const statusCode = String(item?.Status ?? item?.status ?? item?.STATUS ?? "").toLowerCase();
      const isBreakdown = statusCode === "breakdown" || statusCode === "break" || statusCode === "fault";
      const seen = deviceId ? lastSeenByDevice.get(deviceId) : null;
      const ageMs = seen ? nowMs - seen.getTime() : Infinity;
      const status = isBreakdown ? "breakdown" : !seen ? "offline" : ageMs <= ONLINE_MS ? "online" : ageMs <= IDLE_MS ? "idle" : "offline";
      return { name, deviceId, seen, status };
    }).filter((e) => e.name).sort((a, b) => (a.seen && b.seen ? b.seen - a.seen : a.seen ? -1 : 1));
  }, [equipmentApi, liveLocApi, now]);

  const healthCounts = useMemo(() => {
    const c = { online: 0, idle: 0, offline: 0, breakdown: 0 };
    for (const e of equipmentHealth) c[e.status]++;
    return c;
  }, [equipmentHealth]);

  const heatmapData = useMemo(() => {
    const cells = new Map();
    for (const row of lockRows) {
      const t = new Date(String(row.TransDate || "").replace(" ", "T"));
      if (isNaN(t)) continue;
      const key = `${t.getDay()}-${t.getHours()}`;
      cells.set(key, (cells.get(key) || 0) + 1);
    }
    const out = [];
    for (let wd = 0; wd < 7; wd++) for (let h = 0; h < 24; h++) out.push({ wd, h, v: cells.get(`${wd}-${h}`) || 0 });
    return out;
  }, [lockRows]);

  return (
    <div className="w-full min-h-screen relative" style={{ background: "linear-gradient(145deg, #f0f4ff 0%, #e8eeff 40%, #f0f7ff 100%)" }}>
      <div className="fixed inset-0 pointer-events-none" style={{
        opacity: 0.35,
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
                Developer Dashboard
              </h1>
              <p className="text-xs md:text-sm mt-1" style={{ color: T.textDim }}>
                OCR detection accuracy &amp; device monitoring · {equipmentCount} equipment
                <span className="mx-2" style={{ color: T.textMute }}>·</span>
                <span className="font-mono tabular-nums">{now.toLocaleTimeString()}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black ${online ? "text-emerald-700" : "text-rose-700"}`}
                style={{ background: online ? "#ecfdf5" : "#fef2f2", border: `1px solid ${online ? "#a7f3d0" : "#fecaca"}` }}>
                {online ? <FiWifi className="w-3.5 h-3.5" /> : <FiWifiOff className="w-3.5 h-3.5" />}
                <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                {online ? "LIVE" : "OFFLINE"}
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-700 text-xs font-black hover:bg-indigo-50 transition-all disabled:opacity-60"
                style={{ background: "white", border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
              >
                <FiRefreshCw className={`w-3.5 h-3.5 ${refreshing || accLoading || lockLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Date filter bar */}
          <div className="rounded-2xl" style={{
            background: "linear-gradient(145deg, #ffffff, #f8faff)",
            border: `1px solid ${T.border}`,
            boxShadow: "0 2px 12px -2px rgba(99,102,241,0.08), 0 1px 3px rgba(0,0,0,0.05)",
          }}>
            <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 mr-1">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${T.cyan}15`, color: T.cyan }}>
                  <FiCalendar className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: T.text }}>Date Range</div>
              </div>
              <div className="flex items-center gap-1.5">
                {RANGE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                    style={{
                      background: activePreset === p.label ? T.indigo : "rgba(0,0,0,0.04)",
                      color: activePreset === p.label ? "white" : T.textMute,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="date"
                  value={fromDate}
                  max={toDate}
                  onChange={(e) => { setFromDate(e.target.value); setActivePreset(null); }}
                  className="px-2 py-1.5 rounded-lg text-xs font-mono"
                  style={{ background: "white", border: `1px solid ${T.border}`, color: T.text }}
                />
                <span style={{ color: T.textMute }}>→</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  max={_localDate(0)}
                  onChange={(e) => { setToDate(e.target.value); setActivePreset(null); }}
                  className="px-2 py-1.5 rounded-lg text-xs font-mono"
                  style={{ background: "white", border: `1px solid ${T.border}`, color: T.text }}
                />
              </div>
              <span className="ml-auto tabular-nums text-[10px]" style={{ color: T.textMute }}>
                <span className="font-black" style={{ color: T.cyan }}>{fmtNumber(totals.TotalCount)}</span> containers scanned
              </span>
            </div>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
            <KpiCard icon={FiActivity} label="Total Containers" value={totals.TotalCount} accent={T.blue} loading={accLoading} history={trend.map((t) => t.Total)} />
            <KpiCard icon={FiTarget} label="OCR Detected" value={totals.ocrDetected} suffix={fmtPct(totals.ocrAccuracy)} accent={T.cyan} loading={accLoading} history={trend.map((t) => t.OCR)} />
            <KpiCard icon={FiEdit3} label="Manual Entry" value={totals.M} suffix={fmtPct(totals.manualPct)} accent={T.purple} loading={accLoading} history={trend.map((t) => t.Manual)} />
            <KpiCard icon={FiAlertTriangle} label="Missing" value={totals.Missing} suffix={fmtPct(totals.missingPct)} accent={T.red} loading={accLoading} history={trend.map((t) => t.Missing)} />
            <KpiCard icon={FiZap} label="OCR Accuracy" value={totals.ocrAccuracy} decimals={1} suffix="%" sub={`${fmtNumber(totals.ocrDetected)} via OCR`} accent={T.amber} loading={accLoading} history={trend.map((t) => t.ocrAccuracy)} />
            <KpiCard icon={FiCheckCircle} label="Overall Accuracy" value={totals.overallAccuracy} decimals={1} suffix="%" sub={`${fmtNumber(totals.NonMissing)} detected`} accent={T.emerald} loading={accLoading} history={trend.map((t) => t.accuracy)} />
          </div>

          {/* Trend + gauges */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <Panel
              title="Accuracy Trend"
              subtitle={isSingleDay ? "hourly, today" : "daily"}
              icon={FiTrendingUp}
              accent={T.indigo}
              className="xl:col-span-8 h-[340px]"
              right={
                <ViewSwitch
                  value={trendView}
                  onChange={setTrendView}
                  options={[
                    { value: "area", label: "Area", icon: FiTrendingUp },
                    { value: "line", label: "Line", icon: FiActivity },
                    { value: "bar", label: "Bar", icon: FiGrid },
                  ]}
                />
              }
            >
              <div style={{ width: "100%", height: 270 }}>
                <ResponsiveContainer>
                  {trendView === "area" ? (
                    <AreaChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="dev-acc-area" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={T.emerald} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={T.emerald} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="dev-ocr-area" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={T.cyan} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={T.cyan} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: T.textMute, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
                      <YAxis tick={{ fill: T.textMute, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} unit="%" domain={[0, 100]} />
                      <Tooltip content={<Tip pct />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: T.textMute }} />
                      <Area type="monotone" dataKey="accuracy" name="Overall Accuracy" stroke={T.emerald} strokeWidth={2} fill="url(#dev-acc-area)" />
                      <Area type="monotone" dataKey="ocrAccuracy" name="OCR Accuracy" stroke={T.cyan} strokeWidth={2} fill="url(#dev-ocr-area)" />
                    </AreaChart>
                  ) : trendView === "line" ? (
                    <LineChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: T.textMute, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
                      <YAxis tick={{ fill: T.textMute, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} unit="%" domain={[0, 100]} />
                      <Tooltip content={<Tip pct />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: T.textMute }} />
                      <Line type="monotone" dataKey="accuracy" name="Overall Accuracy" stroke={T.emerald} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="ocrAccuracy" name="OCR Accuracy" stroke={T.cyan} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  ) : (
                    <BarChart data={trend} barCategoryGap={trend.length <= 6 ? "35%" : "20%"} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: T.textMute, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
                      <YAxis tick={{ fill: T.textMute, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} unit="%" domain={[0, 100]} />
                      <Tooltip content={<Tip pct />} cursor={{ fill: "rgba(79,70,229,0.06)" }} />
                      <Legend wrapperStyle={{ fontSize: 11, color: T.textMute }} />
                      <Bar dataKey="accuracy" name="Overall Accuracy" fill={T.emerald} radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="ocrAccuracy" name="OCR Accuracy" fill={T.cyan} radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="System Health" icon={FiZap} accent={T.emerald} className="xl:col-span-4 h-[340px]"
              right={
                <ViewSwitch
                  value={healthView}
                  onChange={setHealthView}
                  options={[
                    { value: "gauge", label: "Gauge", icon: FiTarget },
                    { value: "radial", label: "Radial", icon: FiLayers },
                    { value: "bar", label: "Bar", icon: FiActivity },
                  ]}
                />
              }
            >
              {healthView === "gauge" ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                  <div className="flex items-center justify-around w-full">
                    <RadialGauge value={totals.ocrAccuracy} color={T.cyan} subtitle="OCR Accuracy" size={130} />
                    <RadialGauge value={totals.overallAccuracy} color={T.emerald} subtitle="Overall Accuracy" size={130} />
                  </div>
                  <div className="flex items-center gap-4 text-[11px] font-bold">
                    <span style={{ color: T.purple }}>{fmtPct(totals.manualPct)} Manual</span>
                    <span style={{ color: T.red }}>{fmtPct(totals.missingPct)} Missing</span>
                  </div>
                </div>
              ) : healthView === "radial" ? (
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <RadialBarChart
                      cx="50%" cy="50%" innerRadius="30%" outerRadius="100%"
                      data={[
                        { name: "Overall Accuracy", value: totals.overallAccuracy, fill: T.emerald },
                        { name: "OCR Accuracy", value: totals.ocrAccuracy, fill: T.cyan },
                        { name: "Manual %", value: totals.manualPct, fill: T.purple },
                        { name: "Missing %", value: totals.missingPct, fill: T.red },
                      ]}
                      startAngle={90} endAngle={-270}
                    >
                      <RadialBar background={{ fill: "rgba(0,0,0,0.04)" }} dataKey="value" cornerRadius={10} />
                      <Tooltip content={<Tip pct />} />
                      <Legend wrapperStyle={{ fontSize: 10, color: T.textMute }} iconSize={8} layout="vertical" verticalAlign="middle" align="right" />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={[
                        { name: "Overall", value: totals.overallAccuracy, fill: T.emerald },
                        { name: "OCR", value: totals.ocrAccuracy, fill: T.cyan },
                        { name: "Manual", value: totals.manualPct, fill: T.purple },
                        { name: "Missing", value: totals.missingPct, fill: T.red },
                      ]}
                      margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: T.textMute, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
                      <YAxis tick={{ fill: T.textMute, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} unit="%" domain={[0, 100]} />
                      <Tooltip content={<Tip pct />} cursor={{ fill: "rgba(79,70,229,0.06)" }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={50}>
                        {[T.emerald, T.cyan, T.purple, T.red].map((c, i) => <Cell key={i} fill={c} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>

          {/* Detection mix + scan activity + fleet status */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <Panel title="Detection Mix" icon={FiLayers} accent={T.purple} className="xl:col-span-3 h-[440px]"
              right={
                <ViewSwitch
                  value={mixView}
                  onChange={setMixView}
                  options={[
                    { value: "pie", label: "Pie", icon: FiLayers },
                    { value: "donut", label: "Donut", icon: FiTarget },
                    { value: "bar", label: "Bar", icon: FiActivity },
                  ]}
                />
              }
            >
              {mixView === "bar" ? (
                <div style={{ width: "100%", height: 180 }}>
                  <ResponsiveContainer>
                    <BarChart data={mixData} layout="vertical" margin={{ left: 10, right: 10 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tick={{ fill: T.textMute, fontSize: 10 }} axisLine={false} tickLine={false} width={75} />
                      <Tooltip content={<Tip />} cursor={{ fill: "rgba(79,70,229,0.06)" }} />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={28}>
                        {mixData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ width: "100%", height: 180 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={mixData} dataKey="value" nameKey="name" innerRadius={mixView === "donut" ? 55 : 0} outerRadius={78} paddingAngle={3} cornerRadius={6}>
                        {mixData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip content={<Tip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="mt-2 space-y-1.5">
                {mixData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1.5" style={{ color: T.textDim }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />{d.name}
                    </span>
                    <span className="font-black" style={{ color: T.text }}>{fmtNumber(d.value)}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Scan Activity" icon={FiActivity} accent={T.indigo} className="xl:col-span-5 h-[440px]"
              subtitle={
                activityView === "heatmap" ? "hour × weekday, darker = busier"
                : isSingleDay ? "scans per hour, today" : "scans per day"
              }
              right={
                <ViewSwitch
                  value={activityView}
                  onChange={setActivityView}
                  options={[
                    { value: "auto", label: "Bar", icon: FiActivity },
                    { value: "line", label: "Line", icon: FiTrendingUp },
                    { value: "heatmap", label: "Heatmap", icon: FiGrid },
                  ]}
                />
              }
            >
              {activityView === "heatmap" ? (
                <Heatmap data={heatmapData} color={T.indigo} />
              ) : activityView === "line" ? (
                <div style={{ width: "100%", height: 220 }}>
                  <ResponsiveContainer>
                    <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: T.textMute, fontSize: 9 }} axisLine={{ stroke: T.border }} tickLine={false} interval={isSingleDay ? 2 : 0} />
                      <YAxis tick={{ fill: T.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<Tip />} />
                      <Line type="monotone" dataKey="Total" name="Scans" stroke={T.indigo} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <HourlyBars data={trend} color={T.indigo} />
              )}
            </Panel>

            <Panel title="Fleet Status" icon={FiCpu} accent={T.emerald} className="xl:col-span-4 h-[440px]"
              right={
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md" style={{ background: "#ecfdf5", color: T.emerald }}>{healthCounts.online} ON</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md" style={{ background: "#fffbeb", color: T.amber }}>{healthCounts.idle} IDLE</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md" style={{ background: "#fef2f2", color: T.red }}>{healthCounts.breakdown} DOWN</span>
                </div>
              }>
              <div className="flex-1 overflow-auto space-y-2 -mx-1 px-1">
                {equipmentHealth.length === 0 && <div className="text-[11px] text-center py-6" style={{ color: T.textMute }}>No equipment data</div>}
                {equipmentHealth.map((e) => {
                  const color = e.status === "online" ? T.emerald : e.status === "idle" ? T.amber : e.status === "breakdown" ? T.red : "#94a3b8";
                  const statusLabel = e.status === "online" ? "Online" : e.status === "idle" ? "Idle" : e.status === "breakdown" ? "Breakdown" : "Offline";
                  const stats = perEquipment.find((p) => p.name === e.name);
                  return (
                    <div key={e.name} className="rounded-xl px-3.5 py-3" style={{ background: "white", border: `1px solid ${T.border}` }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${e.status === "online" ? "animate-pulse" : ""}`} style={{ background: color }} />
                          <span className="text-[13px] font-bold truncate" style={{ color: T.text }}>{e.name}</span>
                        </div>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md shrink-0" style={{ background: `${color}18`, color }}>{statusLabel}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        {stats && stats.TotalCount > 0 ? (
                          <div className="flex items-center gap-3 text-[10px] font-bold">
                            <span style={{ color: T.cyan }}>{fmtNumber(stats.ocrDetected)} auto</span>
                            <span style={{ color: T.purple }}>{fmtNumber(stats.M)} manual</span>
                            <span style={{ color: T.red }}>{fmtNumber(stats.Missing)} missing</span>
                          </div>
                        ) : <span />}
                        <span className="text-[10px] font-mono shrink-0" style={{ color: T.textMute }}>{e.seen ? fmtTime(e.seen) : "no signal"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          {/* Equipment ranking + detection breakdown, side by side */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Panel title="Equipment Accuracy Ranking" icon={FiAward} accent={T.blue} className="h-[440px]"
            subtitle={`${ranked.length} equipment ranked by detection accuracy`}
            right={
              <ViewSwitch
                value={rankView}
                onChange={setRankView}
                options={[
                  { value: "table", label: "Table", icon: FiList },
                  { value: "bar", label: "Bar", icon: FiActivity },
                  { value: "radial", label: "Radial", icon: FiTarget },
                ]}
              />
            }
          >
            {rankView === "table" ? (
              <DataTable
                maxHeight="380px"
                emptyMsg={accLoading ? "Loading…" : "No data for this range"}
                cols={[
                  { key: "name", label: "Equipment" },
                  { key: "TotalCount", label: "Total", align: "right" },
                  { key: "ocrDetected", label: "Auto", align: "right", render: (v) => <span style={{ color: T.cyan }}>{fmtNumber(v)}</span> },
                  { key: "M", label: "Manual", align: "right", render: (v) => <span style={{ color: T.purple }}>{fmtNumber(v)}</span> },
                  { key: "Missing", label: "Missing", align: "right", render: (v) => <span style={{ color: T.red }}>{fmtNumber(v)}</span> },
                  {
                    key: "accuracy", label: "Accuracy", align: "right", bold: true,
                    render: (v) => <span style={{ color: v >= 90 ? T.emerald : v >= 70 ? T.amber : T.red }}>{fmtPct(v)}</span>,
                  },
                  {
                    key: "name", label: "Distribution", align: "left",
                    render: (_v, r) => {
                      const total = r.TotalCount || 1;
                      return (
                        <div className="flex h-2 w-28 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                          <div style={{ width: `${(r.ocrDetected / total) * 100}%`, background: T.cyan }} />
                          <div style={{ width: `${(r.M / total) * 100}%`, background: T.purple }} />
                          <div style={{ width: `${(r.Missing / total) * 100}%`, background: T.red }} />
                        </div>
                      );
                    },
                  },
                ]}
                rows={ranked}
              />
            ) : rankView === "bar" ? (
              <div style={{ width: "100%", height: 370 }}>
                <ResponsiveContainer>
                  <BarChart data={ranked} barCategoryGap="30%" margin={{ top: 5, right: 20, left: -10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: T.textDim, fontSize: 11, fontWeight: 600 }} axisLine={{ stroke: T.border }} tickLine={false} interval={0} />
                    <YAxis tick={{ fill: T.textMute, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} unit="%" domain={[0, 100]} />
                    <Tooltip content={<Tip pct />} cursor={{ fill: "rgba(79,70,229,0.06)" }} />
                    <Bar dataKey="accuracy" name="Accuracy" radius={[6, 6, 0, 0]} maxBarSize={64}>
                      {ranked.map((r, i) => <Cell key={i} fill={r.accuracy >= 90 ? T.emerald : r.accuracy >= 70 ? T.amber : T.red} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {ranked.map((r) => (
                  <div key={r.name} className="flex flex-col items-center rounded-xl p-3" style={{ background: "white", border: `1px solid ${T.border}` }}>
                    <RadialGauge value={r.accuracy} color={r.accuracy >= 90 ? T.emerald : r.accuracy >= 70 ? T.amber : T.red} size={90} subtitle={r.name} />
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Detection Breakdown by Equipment" icon={FiTarget} accent={T.cyan} className="h-[440px]"
            right={
              <ViewSwitch
                value={breakdownView}
                onChange={setBreakdownView}
                options={[
                  { value: "stacked", label: "Stacked", icon: FiLayers },
                  { value: "percent", label: "100%", icon: FiActivity },
                  { value: "grouped", label: "Grouped", icon: FiGrid },
                  { value: "line", label: "Line", icon: FiTrendingUp },
                  { value: "area", label: "Area", icon: FiActivity },
                ]}
              />
            }
          >
            <div style={{ width: "100%", height: 350 }}>
              <ResponsiveContainer>
                {breakdownView === "line" ? (
                  <LineChart data={ranked} margin={{ top: 5, right: 20, left: -10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: T.textDim, fontSize: 11, fontWeight: 600 }} axisLine={{ stroke: T.border }} tickLine={false} interval={0} />
                    <YAxis tick={{ fill: T.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: T.textMute }} />
                    <Line type="monotone" dataKey="ocrDetected" name="Auto" stroke={T.cyan} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="M" name="Manual" stroke={T.purple} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="Missing" name="Missing" stroke={T.red} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                ) : breakdownView === "area" ? (
                  <AreaChart data={ranked} margin={{ top: 5, right: 20, left: -10, bottom: 10 }}>
                    <defs>
                      <linearGradient id="dev-bd-auto" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.cyan} stopOpacity={0.4} /><stop offset="100%" stopColor={T.cyan} stopOpacity={0} /></linearGradient>
                      <linearGradient id="dev-bd-man" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.purple} stopOpacity={0.4} /><stop offset="100%" stopColor={T.purple} stopOpacity={0} /></linearGradient>
                      <linearGradient id="dev-bd-miss" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.red} stopOpacity={0.4} /><stop offset="100%" stopColor={T.red} stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: T.textDim, fontSize: 11, fontWeight: 600 }} axisLine={{ stroke: T.border }} tickLine={false} interval={0} />
                    <YAxis tick={{ fill: T.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: T.textMute }} />
                    <Area type="monotone" dataKey="ocrDetected" name="Auto" stroke={T.cyan} strokeWidth={2} fill="url(#dev-bd-auto)" />
                    <Area type="monotone" dataKey="M" name="Manual" stroke={T.purple} strokeWidth={2} fill="url(#dev-bd-man)" />
                    <Area type="monotone" dataKey="Missing" name="Missing" stroke={T.red} strokeWidth={2} fill="url(#dev-bd-miss)" />
                  </AreaChart>
                ) : (
                  <BarChart
                    data={ranked}
                    stackOffset={breakdownView === "percent" ? "expand" : "none"}
                    barCategoryGap="30%"
                    barGap={breakdownView === "grouped" ? 4 : 0}
                    margin={{ top: 5, right: 20, left: -10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: T.textDim, fontSize: 11, fontWeight: 600 }} axisLine={{ stroke: T.border }} tickLine={false} interval={0} />
                    <YAxis tick={{ fill: T.textMute, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={breakdownView === "percent" ? (v) => `${Math.round(v * 100)}%` : undefined} />
                    <Tooltip content={<Tip />} cursor={{ fill: "rgba(79,70,229,0.06)" }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: T.textMute }} />
                    <Bar dataKey="ocrDetected" stackId={breakdownView === "grouped" ? undefined : "d"} name="Auto" fill={T.cyan} maxBarSize={64} radius={breakdownView === "grouped" ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    <Bar dataKey="M" stackId={breakdownView === "grouped" ? undefined : "d"} name="Manual" fill={T.purple} maxBarSize={64} radius={breakdownView === "grouped" ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    <Bar dataKey="Missing" stackId={breakdownView === "grouped" ? undefined : "d"} name="Missing" fill={T.red} maxBarSize={64} radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </Panel>
          </div>

          {/* Image gallery */}
          <Panel
            title="Transaction Detect Missed Updated"
            icon={FiImage}
            accent={T.pink}
            subtitle={`${classCounts.auto} detect · ${classCounts.manual} updated · ${classCounts.missing} missed`}
            right={
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <div className="inline-flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: "rgba(0,0,0,0.04)", border: `1px solid ${T.border}` }}>
                  {IMAGE_FILTERS.map((f) => (
                    <button key={f.key} onClick={() => setImgFilter(f.key)}
                      className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all"
                      style={{ background: imgFilter === f.key ? (CLASS_CFG[f.key]?.color || T.indigo) : "transparent", color: imgFilter === f.key ? "white" : T.textMute }}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <ViewSwitch
                  value={gridView}
                  onChange={setGridView}
                  options={[{ value: "grid", label: "", icon: FiGrid }, { value: "list", label: "", icon: FiList }]}
                />
              </div>
            }
          >
            <div className="flex-1 overflow-auto -mx-1 px-1 max-h-[560px]">
              {filteredScans.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-xs" style={{ color: T.textMute }}>
                  {lockLoading ? "Loading scans…" : "No scans for this filter"}
                </div>
              ) : gridView === "grid" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredScans.map(({ row, cls }, idx) => {
                    const cont = String(row.ContNo || row.RFIDDATA || "—").split(" ")[0];
                    const srcs = camSrcs(row.CameraImage1 || row.cameraimage1, 1);
                    const thumb = srcs[0];
                    const cfg = CLASS_CFG[cls];
                    const location = row.Location || row.location || "—";
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedIdx(idx)}
                        className="text-left rounded-2xl overflow-hidden group hover:-translate-y-1 transition-all duration-200"
                        style={{ background: "white", border: `1px solid ${T.border}`, boxShadow: "0 2px 10px -2px rgba(99,102,241,0.1), 0 1px 3px rgba(0,0,0,0.05)" }}
                      >
                        <div className="aspect-video relative overflow-hidden" style={{ background: "linear-gradient(145deg, #eef2f7, #e2e8f0)" }}>
                          {thumb ? (
                            <img src={thumb} alt={cont} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                              onError={(e) => { e.target.style.display = "none"; e.target.nextElementSibling.style.display = "flex"; }} />
                          ) : null}
                          <div className="absolute inset-0 flex-col items-center justify-center gap-1" style={{ display: thumb ? "none" : "flex", color: T.textMute }}>
                            <FiImage size={20} />
                            <span className="text-[9px] font-bold">No image</span>
                          </div>
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "linear-gradient(to top, rgba(15,23,42,0.55), transparent 55%)" }} />
                          <span className="absolute top-2 right-2 text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm" style={{ background: cfg.color, color: "white" }}>
                            {cfg.label}
                          </span>
                          <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[9px] font-bold text-white">
                            <FiMaximize2 size={10} /> View &amp; edit
                          </div>
                        </div>
                        <div className="px-3 py-2.5">
                          <div className="text-[12px] font-black tracking-wide truncate" style={{ color: T.text }}>{cont}</div>
                          <div className="flex items-center gap-1 text-[10px] truncate mt-1" style={{ color: T.textDim }}>
                            <FiCpu size={10} style={{ color: T.indigo }} className="shrink-0" />
                            <span className="truncate">{row.EqpName || row.KalmarNo || "—"}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] truncate mt-0.5" style={{ color: T.textMute }}>
                            <FiCalendar size={10} className="shrink-0" />
                            <span className="truncate">{location}</span>
                            <span className="mx-0.5">·</span>
                            <span className="font-mono shrink-0">{fmtTime(row.TransDate)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <DataTable
                  cols={[
                    { key: "cont", label: "Container", bold: true },
                    { key: "eqp", label: "Equipment" },
                    { key: "location", label: "Location" },
                    { key: "time", label: "Time" },
                    {
                      key: "cls", label: "Status", align: "right",
                      render: (v) => <span className="px-2 py-0.5 rounded-full text-[10px] font-black" style={{ background: `${CLASS_CFG[v].color}18`, color: CLASS_CFG[v].color }}>{CLASS_CFG[v].label}</span>,
                    },
                  ]}
                  rows={filteredScans.map(({ row, cls }) => ({
                    cont: String(row.ContNo || row.RFIDDATA || "—").split(" ")[0],
                    eqp: row.EqpName || row.KalmarNo || "—",
                    location: row.Location || row.location || "—",
                    time: fmtTime(row.TransDate),
                    cls,
                  }))}
                  onRowClick={(_r, i) => setSelectedIdx(i)}
                />
              )}
            </div>
          </Panel>
        </main>
      </div>

      {/* Image modal — dual-camera frame switching + scan prev/next + container-number edit */}
      {selectedIdx != null && filteredScans[selectedIdx] && (() => {
        const { row, cls } = filteredScans[selectedIdx];
        const cont = String(row.ContNo || row.RFIDDATA || "—").split(" ")[0];
        const srcsCam1 = camSrcs(row.CameraImage1 || row.cameraimage1, 1);
        const srcsCam2 = camSrcs(row.CameraImage2 || row.cameraimage2, 2);
        const transId = row.DeviceTransID ?? row.EqpTransID ?? row.devicetransid ?? row.eqptransid;
        const hasPrev = selectedIdx > 0;
        const hasNext = selectedIdx < filteredScans.length - 1;

        const goPrev = () => { if (hasPrev) setSelectedIdx(selectedIdx - 1); };
        const goNext = () => { if (hasNext) setSelectedIdx(selectedIdx + 1); };

        const handleSaveContNo = async () => {
          const newCont = editContNo.trim().toUpperCase();
          if (!newCont) { Swal.fire("Warning", "Please enter a container number.", "warning"); return; }
          if (newCont.length !== 11) { Swal.fire("Warning", "Container number must be exactly 11 characters long.", "warning"); return; }
          if (!transId) { Swal.fire("Error", "Transaction ID not found for this scan.", "error"); return; }
          setSavingCont(true);
          try {
            const res = await updateDeviceContainer({ eqp_trans_id: parseInt(transId), cont_no: newCont }).unwrap();
            Swal.fire("Success", res?.message || "Container updated successfully", "success");
            setEditContNo("");
            load();
          } catch (err) {
            Swal.fire("Error", err?.data?.message || err?.data?.detail || "Failed to update container", "error");
          } finally {
            setSavingCont(false);
          }
        };

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
            onClick={() => { setSelectedIdx(null); setEditContNo(""); }}
            onKeyDown={(e) => { if (e.key === "ArrowLeft") goPrev(); if (e.key === "ArrowRight") goNext(); if (e.key === "Escape") setSelectedIdx(null); }}
            tabIndex={-1}
          >
            <div className="rounded-2xl max-w-3xl w-full p-4 relative" style={{ background: "white", border: `1px solid ${T.border}`, boxShadow: "0 24px 60px -16px rgba(99,102,241,0.2), 0 8px 24px rgba(0,0,0,0.1)" }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black" style={{ color: T.text }}>{cont}</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black" style={{ background: `${CLASS_CFG[cls].color}18`, color: CLASS_CFG[cls].color }}>
                    {CLASS_CFG[cls].label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={goPrev} disabled={!hasPrev} className="w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                    style={{ background: "#f8fafc", border: `1px solid ${T.border}` }}>
                    <FiChevronLeft size={14} style={{ color: T.text }} />
                  </button>
                  <span className="text-[10px] font-bold" style={{ color: T.textMute }}>{selectedIdx + 1} / {filteredScans.length}</span>
                  <button onClick={goNext} disabled={!hasNext} className="w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                    style={{ background: "#f8fafc", border: `1px solid ${T.border}` }}>
                    <FiChevronRight size={14} style={{ color: T.text }} />
                  </button>
                  <button onClick={() => { setSelectedIdx(null); setEditContNo(""); }} className="text-slate-400 hover:text-slate-700 transition-colors ml-1"><FiX size={18} /></button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CameraPanel label="Camera 1" srcs={srcsCam1} alt={`${cont} camera 1`} />
                <CameraPanel label="Camera 2" srcs={srcsCam2} alt={`${cont} camera 2`} />
              </div>

              <div className="mt-3 text-xs grid grid-cols-2 gap-2" style={{ color: T.textMute }}>
                <div>Equipment: <span className="font-bold" style={{ color: T.text }}>{row.EqpName || "—"}</span></div>
                <div>Time: <span className="font-bold" style={{ color: T.text }}>{fmtTime(row.TransDate)}</span></div>
                <div>Location: <span className="font-bold" style={{ color: T.text }}>{row.Location || row.location || "—"}</span></div>
              </div>

              <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: `1px solid ${T.border}` }}>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={editContNo}
                    onChange={(e) => handleContNoChange(e.target.value)}
                    onFocus={() => contSuggestions.length > 0 && setShowContSug(true)}
                    onBlur={() => setTimeout(() => setShowContSug(false), 150)}
                    placeholder={cls === "missing" ? "No container detected — enter number" : `Correct container no. (currently ${cont})`}
                    maxLength={11}
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono tracking-wider"
                    style={{ background: "#f8fafc", border: `1px solid ${T.border}`, color: T.text }}
                  />
                  {showContSug && contSuggestions.length > 0 && (
                    <ul className="absolute bottom-full mb-1 left-0 right-0 z-50 bg-white rounded-lg shadow-2xl max-h-40 overflow-y-auto"
                      style={{ border: `1px solid ${T.border}` }}>
                      {contSuggestions.map((c, i) => {
                        const val = typeof c === "string" ? c : c?.Cont_No || c?.cont_no || c?.CONTAINER_NO || c?.container_no || "";
                        const loc = typeof c === "object" ? c?.Last_Loc || c?.last_loc || c?.LAST_LOCATION_NAME || "" : "";
                        return (
                          <li key={i} onMouseDown={() => selectContSuggestion(c)}
                            className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-indigo-50 cursor-pointer text-xs"
                            style={{ borderBottom: `1px solid ${T.border}` }}>
                            <span className="font-bold font-mono" style={{ color: T.text }}>{val}</span>
                            {loc && <span style={{ color: T.textMute }}>{loc}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <button
                  onClick={handleSaveContNo}
                  disabled={savingCont || editContNo.trim().length !== 11}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black disabled:opacity-50 transition-all shrink-0"
                  style={{ background: T.indigo, color: "white" }}
                >
                  <FiSave size={13} className={savingCont ? "animate-pulse" : ""} /> {savingCont ? "Saving…" : "Update"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default DeveloperDashboard;
