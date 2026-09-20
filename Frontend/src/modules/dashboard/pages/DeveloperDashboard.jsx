import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiCpu, FiCheckCircle, FiEdit3, FiAlertTriangle, FiTarget, FiZap,
  FiRefreshCw, FiActivity, FiImage, FiX, FiClock, FiTrendingUp, FiWifi,
  FiWifiOff, FiCalendar, FiFilter, FiMaximize2, FiBarChart2, FiPieChart,
  FiGrid, FiList,
} from "react-icons/fi";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, RadialBarChart, RadialBar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ComposedChart,
} from "recharts";
import Navbar from "../../../components/layout/Navbar";
import {
  useGetEquipmentQuery,
  useLazyGetEquipmentAccuracyQuery,
  useLazyGetDeviceLockReportQuery,
} from "../../../store/api/ymsApi";

// ─── Theme tokens (light — matches AdminDashboard.jsx) ──────────────────────
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

const fmtNum = (n) => Number(n || 0).toLocaleString("en-IN");
const fmtPct = (n) => `${Number(n || 0).toFixed(2)}%`;
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

// classify a lock-report row by how the container number was captured
const classifyRow = (row) => {
  const cont = String(row.ContNo || row.RFIDDATA || "").trim();
  const code = String(row.UpdateStutus || row.UpdateStatus || "").trim().toUpperCase();
  const num = cont.split(" ")[0];
  const isMissing = !num || num.replace(/0/g, "") === "";
  if (isMissing) return "missing";
  if (code === "M") return "manual";
  return "auto";
};

const CLASS_CFG = {
  auto:    { label: "Auto (OCR)", color: T.cyan,    badge: "#0891b21a" },
  manual:  { label: "Manual",     color: T.purple,  badge: "#7c3aed1a" },
  missing: { label: "Missing",    color: T.red,     badge: "#dc26261a" },
};

const ONLINE_MS = 10 * 60 * 1000;
const IDLE_MS = 30 * 60 * 1000;

// ─── Animated counter (matches AdminDashboard) ──────────────────────────────
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
const AnimatedNumber = ({ value, decimals = 0 }) => {
  const v = useCountUp(Number.isFinite(value) ? value : 0);
  return <>{decimals > 0 ? v.toFixed(decimals) : fmtNum(Math.round(v))}</>;
};

const Sparkline = ({ data, color = T.cyan, height = 32 }) => {
  if (!data || data.length < 2) {
    return <div style={{ height }} className="opacity-30 text-[10px] flex items-center text-slate-500">—</div>;
  }
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`dspark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2}
            fill={`url(#dspark-${color.replace("#", "")})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── KPI Card ────────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, suffix, sub, accent, loading, decimals, history, onClick }) => (
  <button
    onClick={onClick}
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
        {onClick && <FiMaximize2 className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />}
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
  </button>
);

// ─── Glass Panel ─────────────────────────────────────────────────────────────
const Panel = ({ title, subtitle, icon: Icon, right, children, className = "", noPad, accent = T.cyan }) => (
  <div className={`rounded-2xl overflow-hidden flex flex-col ${className}`} style={{
    background: "linear-gradient(145deg, #ffffff, #f8faff)",
    border: `1px solid ${T.border}`,
    boxShadow: "0 2px 12px -2px rgba(99,102,241,0.08), 0 1px 3px rgba(0,0,0,0.05)",
  }}>
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

const Tip = ({ active, payload, label, pct }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(255,255,255,0.98)", border: `1px solid ${T.border}`, boxShadow: "0 8px 24px rgba(99,102,241,0.12), 0 2px 8px rgba(0,0,0,0.08)", color: T.text }}>
      {label != null && <div className="font-bold text-[11px] mb-1.5" style={{ color: T.textMute }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
            <span className="capitalize" style={{ color: T.textDim }}>{p.name}</span>
          </span>
          <span className="font-black tabular-nums">{typeof p.value === "number" ? p.value.toFixed(pct ? 2 : 0) : p.value}{pct ? "%" : ""}</span>
        </div>
      ))}
    </div>
  );
};

const RadialGauge = ({ value, max = 100, color = T.cyan, size = 150, suffix = "%", subtitle }) => {
  const v = Math.max(0, Math.min(Number(value) || 0, max));
  const data = [{ name: "v", value: v, fill: color }];
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart cx="50%" cy="50%" innerRadius="68%" outerRadius="100%" data={data} startAngle={210} endAngle={-30}>
          <defs>
            <linearGradient id={`drg-${color.replace("#", "")}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <RadialBar background={{ fill: "rgba(0,0,0,0.05)" }} dataKey="value" cornerRadius={20} fill={`url(#drg-${color.replace("#", "")})`} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-2xl font-black tabular-nums leading-none" style={{ color: T.text }}>
          <AnimatedNumber value={v} decimals={1} />
        </div>
        <span className="text-xs font-bold mt-1" style={{ color }}>{suffix}</span>
        {subtitle && <div className="text-[9px] mt-1.5 uppercase tracking-wider font-bold text-center px-2" style={{ color: T.textMute }}>{subtitle}</div>}
      </div>
    </div>
  );
};

const PulseDot = ({ color, size = 6 }) => (
  <span className="relative inline-flex" style={{ width: size, height: size }}>
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: color }} />
    <span className="relative inline-flex rounded-full h-full w-full" style={{ background: color }} />
  </span>
);

// hourly (0-23) x weekday (0-6) scan-volume heatmap
const Heatmap = ({ data, color = T.indigo }) => {
  const max = Math.max(1, ...data.map((d) => d.v));
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-[3px] ml-8 text-[8px] font-bold" style={{ color: T.textMute }}>
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="flex-1 text-center min-w-0">{h % 4 === 0 ? String(h).padStart(2, "0") : ""}</div>
        ))}
      </div>
      {days.map((d, wd) => (
        <div key={d} className="flex items-center gap-1">
          <div className="w-7 text-[9px] font-bold shrink-0" style={{ color: T.textDim }}>{d}</div>
          <div className="flex-1 flex gap-[3px]">
            {Array.from({ length: 24 }, (_, h) => {
              const cell = data.find((x) => x.wd === wd && x.h === h);
              const v = cell?.v || 0;
              const intensity = max > 0 ? v / max : 0;
              return (
                <div key={h} title={`${d} ${String(h).padStart(2, "0")}:00 — ${v} scans`}
                  className="flex-1 aspect-square rounded-[3px] min-w-0"
                  style={{ background: intensity === 0 ? "rgba(0,0,0,0.04)" : color, opacity: intensity === 0 ? 1 : 0.15 + intensity * 0.85 }} />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

const DataTable = ({ cols, rows, emptyMsg = "No data", maxHeight = "100%" }) => (
  <div className="flex-1 overflow-auto rounded-lg" style={{ background: "white", maxHeight, border: `1px solid ${T.border}` }}>
    <table className="w-full text-xs">
      <thead className="sticky top-0 z-10" style={{ background: "#f8fafc" }}>
        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
          {cols.map((c, i) => (
            <th key={i} className={`px-3 py-2 font-black uppercase tracking-wider text-[10px] whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`} style={{ color: T.textMute }}>
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
            {cols.map((c, j) => (
              <td key={j} className={`px-3 py-2 ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.bold ? "font-black" : ""}`} style={{ color: c.muted ? T.textMute : T.text }}>
                {c.render ? c.render(r[c.key], r) : (r[c.key] ?? "—")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const RANGE_PRESETS = [
  { label: "Today", from: 0, to: 0 },
  { label: "7D", from: -6, to: 0 },
  { label: "14D", from: -13, to: 0 },
  { label: "30D", from: -29, to: 0 },
];

const IMAGE_FILTERS = [
  { key: "all", label: "All" },
  { key: "auto", label: "Auto (OCR)" },
  { key: "manual", label: "Manual" },
  { key: "missing", label: "Missing" },
];

const DeveloperDashboard = () => {
  const [fromDate, setFromDate] = useState(_localDate(-6));
  const [toDate, setToDate] = useState(_localDate(0));
  const [activePreset, setActivePreset] = useState("7D");
  const [now, setNow] = useState(new Date());
  const [online, setOnline] = useState(true);
  const [imgFilter, setImgFilter] = useState("all");
  const [trendView, setTrendView] = useState("line");
  const [mixView, setMixView] = useState("donut");
  const [gridView, setGridView] = useState("grid");
  const [selectedImage, setSelectedImage] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: equipmentApi } = useGetEquipmentQuery(undefined, { pollingInterval: 30000 });
  const [fetchAccuracy, { data: accData, isFetching: accLoading, isError: accErr }] = useLazyGetEquipmentAccuracyQuery();
  const [fetchLockReport, { data: lockData, isFetching: lockLoading }] = useLazyGetDeviceLockReportQuery();

  const load = () => {
    fetchAccuracy({ from_date: fromDate, to_date: toDate });
    fetchLockReport({ from_date: fromDate, to_date: toDate, report_type: "All" });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  useEffect(() => {
    const iv = setInterval(() => { setNow(new Date()); load(); }, 30000);
    const clockIv = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(iv); clearInterval(clockIv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setOnline(navigator.onLine);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
    setTimeout(() => setRefreshing(false), 600);
  };

  const applyPreset = (p) => {
    setActivePreset(p.label);
    setFromDate(_localDate(p.from));
    setToDate(_localDate(p.to));
  };

  const equipmentCount = useMemo(() => (Array.isArray(equipmentApi?.data) ? equipmentApi.data.length : 0), [equipmentApi]);
  const accRows = useMemo(() => (Array.isArray(accData?.data) ? accData.data : []), [accData]);
  const lockRows = useMemo(() => (Array.isArray(lockData?.data) ? lockData.data : []), [lockData]);

  const totals = useMemo(() => {
    const t = { TotalCount: 0, Missing: 0, NonMissing: 0, M: 0, EQ: 0, T: 0, A: 0 };
    for (const r of accRows) {
      t.TotalCount += Number(r.TotalCount) || 0;
      t.Missing += Number(r.Missing) || 0;
      t.NonMissing += Number(r.NonMissing) || 0;
      t.M += Number(r.M) || 0;
      t.EQ += Number(r.EQ) || 0;
      t.T += Number(r.T) || 0;
      t.A += Number(r.A) || 0;
    }
    const ocrDetected = Math.max(t.NonMissing - t.M, 0);
    const overallAccuracy = t.TotalCount > 0 ? (t.NonMissing / t.TotalCount) * 100 : 0;
    const ocrAccuracy = t.TotalCount > 0 ? (ocrDetected / t.TotalCount) * 100 : 0;
    const manualPct = t.TotalCount > 0 ? (t.M / t.TotalCount) * 100 : 0;
    const missingPct = t.TotalCount > 0 ? (t.Missing / t.TotalCount) * 100 : 0;
    return { ...t, ocrDetected, overallAccuracy, ocrAccuracy, manualPct, missingPct };
  }, [accRows]);

  const trend = useMemo(() => {
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
        "Overall Accuracy": b.TotalCount ? +((b.NonMissing / b.TotalCount) * 100).toFixed(2) : 0,
        "OCR Accuracy": b.TotalCount ? +((ocrDetected / b.TotalCount) * 100).toFixed(2) : 0,
        "Manual %": b.TotalCount ? +((b.M / b.TotalCount) * 100).toFixed(2) : 0,
        "Missing %": b.TotalCount ? +((b.Missing / b.TotalCount) * 100).toFixed(2) : 0,
        Total: b.TotalCount,
        OCR: ocrDetected,
        Manual: b.M,
        Missing: b.Missing,
      };
    });
  }, [accRows]);

  const sparkHistory = useMemo(() => trend.map((t) => t.Total), [trend]);
  const sparkAcc = useMemo(() => trend.map((t) => t["Overall Accuracy"]), [trend]);
  const sparkOcr = useMemo(() => trend.map((t) => t.OCR), [trend]);
  const sparkManual = useMemo(() => trend.map((t) => t.Manual), [trend]);
  const sparkMissing = useMemo(() => trend.map((t) => t.Missing), [trend]);

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

  const classifiedScans = useMemo(() => {
    return [...lockRows]
      .map((row) => ({ row, cls: classifyRow(row) }))
      .sort((a, b) => {
        const da = new Date(String(a.row.TransDate || "").replace(" ", "T"));
        const db = new Date(String(b.row.TransDate || "").replace(" ", "T"));
        return db - da;
      });
  }, [lockRows]);

  const filteredScans = useMemo(() => {
    const list = imgFilter === "all" ? classifiedScans : classifiedScans.filter((x) => x.cls === imgFilter);
    return list.slice(0, 60);
  }, [classifiedScans, imgFilter]);

  const classCounts = useMemo(() => {
    const c = { auto: 0, manual: 0, missing: 0 };
    for (const x of classifiedScans) c[x.cls]++;
    return c;
  }, [classifiedScans]);

  // per-equipment live status — last scan time from the lock report drives online/idle/offline
  const equipmentHealth = useMemo(() => {
    const lastSeen = new Map();
    for (const row of lockRows) {
      const name = row.EqpName || row.KalmarNo || "—";
      const t = new Date(String(row.TransDate || "").replace(" ", "T"));
      if (isNaN(t)) continue;
      const prev = lastSeen.get(name);
      if (!prev || t > prev) lastSeen.set(name, t);
    }
    const nowMs = now.getTime();
    const rows = Array.isArray(equipmentApi?.data) ? equipmentApi.data : [];
    const names = rows.length
      ? rows.map((r) => r?.Equipment_Name ?? r?.equipment_name ?? r?.EQUIPMENT_NAME ?? "—")
      : Array.from(lastSeen.keys());
    return Array.from(new Set(names)).map((name) => {
      const seen = lastSeen.get(name);
      const ageMs = seen ? nowMs - seen.getTime() : Infinity;
      const status = !seen ? "offline" : ageMs <= ONLINE_MS ? "online" : ageMs <= IDLE_MS ? "idle" : "offline";
      return { name, seen, status };
    }).sort((a, b) => (a.seen && b.seen ? b.seen - a.seen : a.seen ? -1 : 1));
  }, [equipmentApi, lockRows, now]);

  const healthCounts = useMemo(() => {
    const c = { online: 0, idle: 0, offline: 0 };
    for (const e of equipmentHealth) c[e.status]++;
    return c;
  }, [equipmentHealth]);

  // hourly x weekday scan-volume heatmap from the lock report
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

  const topPerformers = useMemo(() => [...perEquipment].filter((e) => e.TotalCount > 0).sort((a, b) => b.accuracy - a.accuracy).slice(0, 5), [perEquipment]);
  const bottomPerformers = useMemo(() => [...perEquipment].filter((e) => e.TotalCount > 0).sort((a, b) => a.accuracy - b.accuracy).slice(0, 5), [perEquipment]);

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
                OCR detection accuracy &amp; device monitoring · {equipmentCount} equipment tracked
                <span className="mx-2" style={{ color: T.textMute }}>·</span>
                <span className="font-mono tabular-nums">{now.toLocaleTimeString()}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
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
                <span className="font-black" style={{ color: T.cyan }}>{fmtNum(totals.TotalCount)}</span> containers scanned
                {accErr && <span className="ml-2 font-black" style={{ color: T.red }}>· fetch error</span>}
              </span>
            </div>
          </div>

          {/* Equipment health strip — live status chips */}
          <div className="rounded-2xl" style={{
            background: "linear-gradient(145deg, #ffffff, #f8faff)",
            border: `1px solid ${T.border}`,
            boxShadow: "0 2px 12px -2px rgba(99,102,241,0.08), 0 1px 3px rgba(0,0,0,0.05)",
          }}>
            <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 mr-1">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${T.emerald}15`, color: T.emerald }}>
                  <FiCpu className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: T.text }}>Fleet Status</div>
              </div>
              <span className="flex items-center gap-1 text-[10px] font-black" style={{ color: T.emerald }}>
                <PulseDot color={T.emerald} /> {healthCounts.online} Online
              </span>
              <span className="flex items-center gap-1 text-[10px] font-black" style={{ color: T.amber }}>
                <PulseDot color={T.amber} /> {healthCounts.idle} Idle
              </span>
              <span className="flex items-center gap-1 text-[10px] font-black" style={{ color: T.textMute }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.textMute }} /> {healthCounts.offline} Offline
              </span>
              <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                {equipmentHealth.slice(0, 14).map((e) => {
                  const color = e.status === "online" ? T.emerald : e.status === "idle" ? T.amber : "#94a3b8";
                  return (
                    <span key={e.name} title={`${e.name} · ${e.status}${e.seen ? " · " + fmtTime(e.seen) : ""}`}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold"
                      style={{ background: `${color}12`, color, border: `1px solid ${color}30` }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                      {e.name}
                    </span>
                  );
                })}
                {equipmentHealth.length > 14 && (
                  <span className="text-[9px] font-bold" style={{ color: T.textMute }}>+{equipmentHealth.length - 14} more</span>
                )}
              </div>
            </div>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
            <KpiCard icon={FiActivity} label="Total Containers" value={totals.TotalCount} accent={T.blue} loading={accLoading} history={sparkHistory} />
            <KpiCard icon={FiTarget} label="OCR Detected" value={totals.ocrDetected} suffix={fmtPct(totals.ocrAccuracy)} accent={T.cyan} loading={accLoading} history={sparkOcr} />
            <KpiCard icon={FiEdit3} label="Manual Entry" value={totals.M} suffix={fmtPct(totals.manualPct)} accent={T.purple} loading={accLoading} history={sparkManual} />
            <KpiCard icon={FiAlertTriangle} label="Missing" value={totals.Missing} suffix={fmtPct(totals.missingPct)} accent={T.red} loading={accLoading} history={sparkMissing} />
            <KpiCard icon={FiCheckCircle} label="Overall Accuracy" value={totals.overallAccuracy} decimals={1} suffix="%" sub={`${fmtNum(totals.NonMissing)} detected`} accent={T.emerald} loading={accLoading} history={sparkAcc} />
            <KpiCard icon={FiZap} label="OCR Accuracy" value={totals.ocrAccuracy} decimals={1} suffix="%" sub={`${fmtNum(totals.ocrDetected)} via OCR`} accent={T.amber} loading={accLoading} history={sparkAcc} />
          </div>

          {/* Trend + Mix + Gauge row */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <Panel
              title="Daily Accuracy Trend"
              icon={FiTrendingUp}
              accent={T.indigo}
              className="xl:col-span-7 h-[360px]"
              right={
                <ViewSwitch
                  value={trendView}
                  onChange={setTrendView}
                  options={[
                    { value: "line", label: "Line", icon: FiTrendingUp },
                    { value: "area", label: "Area", icon: FiBarChart2 },
                  ]}
                />
              }
            >
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  {trendView === "line" ? (
                    <LineChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: T.textMute, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
                      <YAxis tick={{ fill: T.textMute, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} unit="%" />
                      <Tooltip content={<Tip pct />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: T.textMute }} />
                      <Line type="monotone" dataKey="Overall Accuracy" stroke={T.emerald} strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="OCR Accuracy" stroke={T.cyan} strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="Manual %" stroke={T.purple} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Missing %" stroke={T.red} strokeWidth={2} dot={false} />
                    </LineChart>
                  ) : (
                    <AreaChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="acc-area" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={T.emerald} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={T.emerald} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="ocr-area" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={T.cyan} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={T.cyan} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: T.textMute, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
                      <YAxis tick={{ fill: T.textMute, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} unit="%" />
                      <Tooltip content={<Tip pct />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: T.textMute }} />
                      <Area type="monotone" dataKey="Overall Accuracy" stroke={T.emerald} strokeWidth={2} fill="url(#acc-area)" />
                      <Area type="monotone" dataKey="OCR Accuracy" stroke={T.cyan} strokeWidth={2} fill="url(#ocr-area)" />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Detection Mix" icon={FiPieChart} accent={T.purple} className="xl:col-span-2 h-[360px]"
              right={
                <ViewSwitch
                  value={mixView}
                  onChange={setMixView}
                  options={[{ value: "donut", label: "Pie", icon: FiPieChart }, { value: "bar", label: "Bar", icon: FiBarChart2 }]}
                />
              }
            >
              {mixView === "donut" ? (
                <div style={{ width: "100%", height: 210 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={mixData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} cornerRadius={6}>
                        {mixData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip content={<Tip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ width: "100%", height: 210 }}>
                  <ResponsiveContainer>
                    <BarChart data={mixData} layout="vertical" margin={{ left: 10, right: 10 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tick={{ fill: T.textMute, fontSize: 10 }} axisLine={false} tickLine={false} width={70} />
                      <Tooltip content={<Tip />} />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                        {mixData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="mt-2 space-y-1.5">
                {mixData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1.5" style={{ color: T.textDim }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />{d.name}
                    </span>
                    <span className="font-black" style={{ color: T.text }}>{fmtNum(d.value)}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Overall Health" icon={FiZap} accent={T.emerald} className="xl:col-span-3 h-[360px]">
              <div className="flex-1 flex items-center justify-center gap-4">
                <RadialGauge value={totals.overallAccuracy} color={T.emerald} subtitle="Non-Missing Accuracy" size={140} />
                <RadialGauge value={totals.ocrAccuracy} color={T.cyan} subtitle="OCR Accuracy" size={140} />
              </div>
            </Panel>
          </div>

          {/* Volume/accuracy composed chart + Activity heatmap */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <Panel title="Daily Volume vs Accuracy" icon={FiBarChart2} accent={T.blue} className="xl:col-span-7 h-[320px]">
              <div style={{ width: "100%", height: 250 }}>
                <ResponsiveContainer>
                  <ComposedChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: T.textMute, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fill: T.textMute, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: T.textMute, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} unit="%" />
                    <Tooltip content={<Tip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: T.textMute }} />
                    <Bar yAxisId="left" dataKey="OCR" stackId="vol" fill={T.cyan} radius={[0, 0, 0, 0]} name="OCR" />
                    <Bar yAxisId="left" dataKey="Manual" stackId="vol" fill={T.purple} name="Manual" />
                    <Bar yAxisId="left" dataKey="Missing" stackId="vol" fill={T.red} radius={[4, 4, 0, 0]} name="Missing" />
                    <Line yAxisId="right" type="monotone" dataKey="Overall Accuracy" stroke={T.emerald} strokeWidth={2.5} dot={false} name="Overall Accuracy" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Scan Activity Heatmap" icon={FiActivity} accent={T.indigo} className="xl:col-span-5 h-[320px]" subtitle="Hour of day × weekday">
              <div className="flex-1 flex items-center">
                <Heatmap data={heatmapData} color={T.indigo} />
              </div>
            </Panel>
          </div>

          {/* Top / bottom performers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Panel title="Top Performing Equipment" icon={FiCheckCircle} accent={T.emerald}>
              <div className="space-y-2">
                {topPerformers.length === 0 && <div className="text-xs py-4 text-center" style={{ color: T.textMute }}>No data</div>}
                {topPerformers.map((e, i) => (
                  <div key={e.name} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: "white", border: `1px solid ${T.border}` }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: `${T.emerald}18`, color: T.emerald }}>{i + 1}</span>
                    <span className="flex-1 text-xs font-bold truncate" style={{ color: T.text }}>{e.name}</span>
                    <span className="text-xs font-black tabular-nums" style={{ color: T.emerald }}>{fmtPct(e.accuracy)}</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Needs Attention" icon={FiAlertTriangle} accent={T.red}>
              <div className="space-y-2">
                {bottomPerformers.length === 0 && <div className="text-xs py-4 text-center" style={{ color: T.textMute }}>No data</div>}
                {bottomPerformers.map((e, i) => (
                  <div key={e.name} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: "white", border: `1px solid ${T.border}` }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: `${T.red}18`, color: T.red }}>{i + 1}</span>
                    <span className="flex-1 text-xs font-bold truncate" style={{ color: T.text }}>{e.name}</span>
                    <span className="text-xs font-black tabular-nums" style={{ color: T.red }}>{fmtPct(e.accuracy)}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* Per-equipment + image gallery */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <Panel title="Equipment Accuracy" icon={FiCpu} accent={T.blue} className="xl:col-span-4 h-[520px]">
              <DataTable
                maxHeight="440px"
                emptyMsg={accLoading ? "Loading…" : "No data for this range"}
                cols={[
                  { key: "name", label: "Equipment" },
                  { key: "TotalCount", label: "Total", align: "right" },
                  { key: "ocrDetected", label: "OCR", align: "right" },
                  { key: "M", label: "Manual", align: "right" },
                  {
                    key: "accuracy", label: "Acc.", align: "right", bold: true,
                    render: (v) => <span style={{ color: v >= 90 ? T.emerald : v >= 70 ? T.amber : T.red }}>{fmtPct(v)}</span>,
                  },
                ]}
                rows={perEquipment}
              />
            </Panel>

            <Panel
              title="Container Scan Gallery"
              icon={FiImage}
              accent={T.pink}
              className="xl:col-span-8 h-[520px]"
              subtitle={`${classCounts.auto} auto · ${classCounts.manual} manual · ${classCounts.missing} missing`}
              right={
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <div className="inline-flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: "rgba(0,0,0,0.04)", border: `1px solid ${T.border}` }}>
                    {IMAGE_FILTERS.map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setImgFilter(f.key)}
                        className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all"
                        style={{
                          background: imgFilter === f.key ? (CLASS_CFG[f.key]?.color || T.indigo) : "transparent",
                          color: imgFilter === f.key ? "white" : T.textMute,
                        }}
                      >
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
              <div className="flex-1 overflow-auto -mx-1 px-1">
                {filteredScans.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs" style={{ color: T.textMute }}>
                    {lockLoading ? "Loading scans…" : "No scans for this filter"}
                  </div>
                ) : gridView === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredScans.map(({ row, cls }, idx) => {
                      const cont = String(row.ContNo || row.RFIDDATA || "—").split(" ")[0];
                      const srcs = camSrcs(row.CameraImage1 || row.cameraimage1, 1);
                      const thumb = srcs[0];
                      const cfg = CLASS_CFG[cls];
                      return (
                        <button
                          key={idx}
                          onClick={() => thumb && setSelectedImage({ srcs, row, cont, cls })}
                          className="text-left rounded-xl overflow-hidden group hover:-translate-y-0.5 transition-transform"
                          style={{ background: "white", border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                        >
                          <div className="aspect-video relative overflow-hidden" style={{ background: "#eef2f7" }}>
                            {thumb ? (
                              <img src={thumb} alt={cont} className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                onError={(e) => { e.target.style.display = "none"; }} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><FiImage style={{ color: T.textMute }} size={20} /></div>
                            )}
                            <span className="absolute top-1.5 right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: cfg.color, color: "white" }}>
                              {cfg.label}
                            </span>
                          </div>
                          <div className="px-2 py-1.5">
                            <div className="text-[11px] font-black truncate" style={{ color: T.text }}>{cont}</div>
                            <div className="text-[10px] truncate" style={{ color: T.textMute }}>{row.EqpName || row.KalmarNo || "—"} · {fmtTime(row.TransDate)}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <DataTable
                    cols={[
                      { key: "cont", label: "Container" },
                      { key: "eqp", label: "Equipment" },
                      { key: "time", label: "Time" },
                      {
                        key: "cls", label: "Status", align: "right",
                        render: (v) => <span className="px-2 py-0.5 rounded-full text-[10px] font-black" style={{ background: `${CLASS_CFG[v].color}18`, color: CLASS_CFG[v].color }}>{CLASS_CFG[v].label}</span>,
                      },
                    ]}
                    rows={filteredScans.map(({ row, cls }) => ({
                      cont: String(row.ContNo || row.RFIDDATA || "—").split(" ")[0],
                      eqp: row.EqpName || row.KalmarNo || "—",
                      time: fmtTime(row.TransDate),
                      cls,
                    }))}
                  />
                )}
              </div>
            </Panel>
          </div>
        </main>
      </div>

      {/* Image modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)" }} onClick={() => setSelectedImage(null)}>
          <div className="rounded-2xl max-w-2xl w-full p-4" style={{ background: "white", border: `1px solid ${T.border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black" style={{ color: T.text }}>{selectedImage.cont}</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black" style={{ background: `${CLASS_CFG[selectedImage.cls].color}18`, color: CLASS_CFG[selectedImage.cls].color }}>
                  {CLASS_CFG[selectedImage.cls].label}
                </span>
              </div>
              <button onClick={() => setSelectedImage(null)} style={{ color: T.textMute }}><FiX size={18} /></button>
            </div>
            <img
              src={selectedImage.srcs[0]}
              alt={selectedImage.cont}
              className="w-full rounded-lg"
              style={{ border: `1px solid ${T.border}` }}
              onError={(e) => { const next = selectedImage.srcs[1]; if (next && e.target.src !== next) e.target.src = next; }}
            />
            <div className="mt-3 text-xs grid grid-cols-2 gap-2" style={{ color: T.textMute }}>
              <div>Equipment: <span className="font-bold" style={{ color: T.text }}>{selectedImage.row.EqpName || "—"}</span></div>
              <div>Time: <span className="font-bold" style={{ color: T.text }}>{fmtTime(selectedImage.row.TransDate)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeveloperDashboard;
