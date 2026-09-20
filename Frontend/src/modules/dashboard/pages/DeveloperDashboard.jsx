import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiCpu, FiCheckCircle, FiEdit3, FiAlertTriangle, FiTarget, FiZap,
  FiRefreshCw, FiActivity, FiImage, FiX, FiClock, FiTrendingUp, FiWifi,
  FiWifiOff, FiCalendar, FiGrid, FiList, FiChevronRight, FiAward,
  FiAlertCircle, FiLayers,
} from "react-icons/fi";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadialBarChart, RadialBar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ComposedChart, Line,
} from "recharts";
import Navbar from "../../../components/layout/Navbar";
import {
  useGetEquipmentQuery,
  useLazyGetEquipmentAccuracyQuery,
  useLazyGetDeviceLockReportQuery,
} from "../../../store/api/ymsApi";

// ─── Theme — dark monitoring console ────────────────────────────────────────
const T = {
  bg: "#070b14",
  panel: "#0f1626",
  panel2: "#131c30",
  border: "rgba(148,163,184,0.14)",
  borderStrong: "rgba(148,163,184,0.26)",
  text: "#eef2f9",
  textDim: "#aab4c8",
  textMute: "#6b7788",
  cyan: "#22d3ee",
  blue: "#5b9dff",
  indigo: "#818cf8",
  violet: "#c084fc",
  pink: "#f472b6",
  rose: "#fb7185",
  amber: "#fbbf24",
  emerald: "#34d399",
  teal: "#2dd4bf",
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
  manual:  { label: "Manual",     color: T.violet },
  missing: { label: "Missing",    color: T.rose },
};

const ONLINE_MS = 10 * 60 * 1000;
const IDLE_MS = 30 * 60 * 1000;

// ─── Animated counter ────────────────────────────────────────────────────────
const useCountUp = (target, duration = 800) => {
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
  return <>{decimals > 0 ? v.toFixed(decimals) : fmtNum(Math.round(v))}</>;
};

const PulseDot = ({ color, size = 7 }) => (
  <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: color }} />
    <span className="relative inline-flex rounded-full h-full w-full" style={{ background: color }} />
  </span>
);

// ─── Metric tile — compact, ring-accented ───────────────────────────────────
const MetricTile = ({ icon: Icon, label, value, suffix, sub, accent, loading, decimals }) => (
  <div className="relative rounded-2xl p-4 overflow-hidden" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
    <div className="absolute inset-0 opacity-[0.08]" style={{ background: `radial-gradient(120px 80px at 90% -10%, ${accent}, transparent)` }} />
    <div className="relative flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}1a`, color: accent }}>
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: T.textMute }}>{label}</div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-extrabold tabular-nums" style={{ color: T.text }}>
            {loading ? <span className="opacity-30">···</span> : <AnimatedNumber value={value} decimals={decimals || 0} />}
          </span>
          {suffix && !loading && <span className="text-[11px] font-bold" style={{ color: accent }}>{suffix}</span>}
        </div>
      </div>
    </div>
    {sub && <div className="relative text-[10px] mt-2 truncate" style={{ color: T.textMute }}>{sub}</div>}
  </div>
);

// ─── Panel shell ─────────────────────────────────────────────────────────────
const Panel = ({ title, subtitle, icon: Icon, right, children, className = "", accent = T.cyan }) => (
  <div className={`rounded-2xl overflow-hidden flex flex-col ${className}`} style={{ background: T.panel, border: `1px solid ${T.border}` }}>
    {(title || right) && (
      <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2" style={{ borderBottom: `1px solid ${T.border}` }}>
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon size={14} style={{ color: accent }} className="shrink-0" />}
          <div className="min-w-0">
            <span className="text-[12px] font-bold truncate" style={{ color: T.text }}>{title}</span>
            {subtitle && <span className="text-[10px] ml-2" style={{ color: T.textMute }}>{subtitle}</span>}
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    )}
    <div className="flex-1 p-4 flex flex-col min-h-0">{children}</div>
  </div>
);

const Segmented = ({ options, value, onChange }) => (
  <div className="inline-flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all"
        style={{ background: value === opt.value ? "rgba(255,255,255,0.1)" : "transparent", color: value === opt.value ? T.text : T.textMute }}
      >
        {opt.icon && <opt.icon size={11} />}
        {opt.label}
      </button>
    ))}
  </div>
);

const ChartTip = ({ active, payload, label, pct }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "#0b1220", border: `1px solid ${T.borderStrong}`, boxShadow: "0 12px 32px rgba(0,0,0,0.5)", color: T.text }}>
      {label != null && <div className="font-bold text-[10px] mb-1.5" style={{ color: T.textMute }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
            <span style={{ color: T.textDim }}>{p.name}</span>
          </span>
          <span className="font-bold tabular-nums">{typeof p.value === "number" ? p.value.toFixed(pct ? 1 : 0) : p.value}{pct ? "%" : ""}</span>
        </div>
      ))}
    </div>
  );
};

const RadialGauge = ({ value, color = T.cyan, size = 128, label }) => {
  const v = Math.max(0, Math.min(Number(value) || 0, 100));
  const data = [{ value: v, fill: color }];
  return (
    <div className="relative flex flex-col items-center" style={{ width: size }}>
      <div style={{ width: size, height: size }}>
        <ResponsiveContainer>
          <RadialBarChart cx="50%" cy="50%" innerRadius="72%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
            <RadialBar background={{ fill: "rgba(255,255,255,0.06)" }} dataKey="value" cornerRadius={30} fill={color} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: -size + 4 }}>
          <div className="text-xl font-extrabold tabular-nums" style={{ color: T.text }}><AnimatedNumber value={v} decimals={1} />%</div>
        </div>
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wide mt-1 text-center" style={{ color: T.textMute }}>{label}</div>
    </div>
  );
};

// hour(0-23) x weekday(0-6) activity heatmap
const Heatmap = ({ data, color = T.indigo }) => {
  const max = Math.max(1, ...data.map((d) => d.v));
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="flex flex-col gap-1 flex-1 justify-center">
      <div className="flex gap-[3px] ml-8 text-[8px] font-bold" style={{ color: T.textMute }}>
        {Array.from({ length: 24 }, (_, h) => <div key={h} className="flex-1 text-center min-w-0">{h % 4 === 0 ? String(h).padStart(2, "0") : ""}</div>)}
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
                  style={{ background: intensity === 0 ? "rgba(255,255,255,0.04)" : color, opacity: intensity === 0 ? 1 : 0.2 + intensity * 0.8 }} />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

const RANGE_PRESETS = [
  { label: "Today", from: 0, to: 0 },
  { label: "7D", from: -6, to: 0 },
  { label: "14D", from: -13, to: 0 },
  { label: "30D", from: -29, to: 0 },
];

const IMAGE_FILTERS = [
  { key: "all", label: "All" },
  { key: "auto", label: "Auto" },
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
  const [gridView, setGridView] = useState("grid");
  const [selectedImage, setSelectedImage] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: equipmentApi } = useGetEquipmentQuery(undefined, { pollingInterval: 30000 });
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
        Total: b.TotalCount, OCR: ocrDetected, Manual: b.M, Missing: b.Missing,
      };
    });
  }, [accRows]);

  const mixData = useMemo(() => ([
    { name: "Auto (OCR)", value: totals.ocrDetected, color: T.cyan },
    { name: "Manual", value: totals.M, color: T.violet },
    { name: "Missing", value: totals.Missing, color: T.rose },
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

  const classifiedScans = useMemo(() => [...lockRows]
    .map((row) => ({ row, cls: classifyRow(row) }))
    .sort((a, b) => new Date(String(b.row.TransDate || "").replace(" ", "T")) - new Date(String(a.row.TransDate || "").replace(" ", "T"))),
  [lockRows]);

  const filteredScans = useMemo(() => {
    const list = imgFilter === "all" ? classifiedScans : classifiedScans.filter((x) => x.cls === imgFilter);
    return list.slice(0, 60);
  }, [classifiedScans, imgFilter]);

  const classCounts = useMemo(() => {
    const c = { auto: 0, manual: 0, missing: 0 };
    for (const x of classifiedScans) c[x.cls]++;
    return c;
  }, [classifiedScans]);

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
    const names = rows.length ? rows.map((r) => r?.Equipment_Name ?? r?.equipment_name ?? r?.EQUIPMENT_NAME ?? "—") : Array.from(lastSeen.keys());
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

  const ranked = useMemo(() => [...perEquipment].filter((e) => e.TotalCount > 0).sort((a, b) => b.accuracy - a.accuracy), [perEquipment]);

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      <Navbar />
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(1200px 500px at 15% -10%, rgba(34,211,238,0.05), transparent), radial-gradient(1000px 500px at 100% 0%, rgba(129,140,248,0.06), transparent)" }}
      />
      <div className="relative max-w-[1680px] mx-auto px-3 sm:px-6 py-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${T.cyan}18`, color: T.cyan, border: `1px solid ${T.cyan}30` }}>
                <FiCpu size={16} />
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight" style={{ color: T.text }}>Developer Dashboard</h1>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${online ? "" : ""}`}
                style={{ background: online ? `${T.emerald}18` : `${T.rose}18`, color: online ? T.emerald : T.rose }}>
                <PulseDot color={online ? T.emerald : T.rose} size={5} /> {online ? "LIVE" : "OFFLINE"}
              </span>
            </div>
            <p className="text-[11px] mt-1 ml-10" style={{ color: T.textMute }}>
              OCR detection accuracy &amp; device monitoring · {equipmentCount} equipment · {fmtTime(now).slice(0, 8)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
              {RANGE_PRESETS.map((p) => (
                <button key={p.label} onClick={() => applyPreset(p)}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all"
                  style={{ background: activePreset === p.label ? T.cyan : "transparent", color: activePreset === p.label ? "#04202a" : T.textMute }}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 rounded-xl px-2 py-1.5" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
              <FiCalendar size={12} style={{ color: T.textMute }} />
              <input type="date" value={fromDate} max={toDate} onChange={(e) => { setFromDate(e.target.value); setActivePreset(null); }}
                className="bg-transparent text-[11px] font-mono outline-none" style={{ color: T.text, colorScheme: "dark" }} />
              <span style={{ color: T.textMute }}>→</span>
              <input type="date" value={toDate} min={fromDate} max={_localDate(0)} onChange={(e) => { setToDate(e.target.value); setActivePreset(null); }}
                className="bg-transparent text-[11px] font-mono outline-none" style={{ color: T.text, colorScheme: "dark" }} />
            </div>
            <button onClick={handleRefresh} disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold disabled:opacity-60"
              style={{ background: T.panel, border: `1px solid ${T.border}`, color: T.text }}>
              <FiRefreshCw size={13} className={refreshing || accLoading || lockLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
          <MetricTile icon={FiActivity} label="Total Containers" value={totals.TotalCount} accent={T.blue} loading={accLoading} />
          <MetricTile icon={FiTarget} label="OCR Detected" value={totals.ocrDetected} suffix={fmtPct(totals.ocrAccuracy)} accent={T.cyan} loading={accLoading} />
          <MetricTile icon={FiEdit3} label="Manual Entry" value={totals.M} suffix={fmtPct(totals.manualPct)} accent={T.violet} loading={accLoading} />
          <MetricTile icon={FiAlertTriangle} label="Missing" value={totals.Missing} suffix={fmtPct(totals.missingPct)} accent={T.rose} loading={accLoading} />
          <MetricTile icon={FiCheckCircle} label="Overall Accuracy" value={totals.overallAccuracy} decimals={1} suffix="%" sub={`${fmtNum(totals.NonMissing)} detected`} accent={T.emerald} loading={accLoading} />
          <MetricTile icon={FiZap} label="OCR Accuracy" value={totals.ocrAccuracy} decimals={1} suffix="%" sub={`${fmtNum(totals.ocrDetected)} via OCR`} accent={T.amber} loading={accLoading} />
        </div>

        {/* Main grid: trend (wide) + gauges + fleet status */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 mb-3">
          <Panel title="Accuracy & Volume Trend" icon={FiTrendingUp} accent={T.cyan} className="xl:col-span-8 h-[300px]">
            <div style={{ width: "100%", height: 230 }}>
              <ResponsiveContainer>
                <ComposedChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={T.cyan} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={T.cyan} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: T.textMute, fontSize: 10 }} axisLine={{ stroke: T.border }} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: T.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: T.textMute, fontSize: 10 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                  <Tooltip content={<ChartTip />} />
                  <Legend wrapperStyle={{ fontSize: 10, color: T.textMute }} />
                  <Area yAxisId="left" type="monotone" dataKey="Total" stroke={T.cyan} strokeWidth={1.5} fill="url(#volGrad)" name="Total Scans" />
                  <Line yAxisId="right" type="monotone" dataKey="Overall Accuracy" stroke={T.emerald} strokeWidth={2.5} dot={false} name="Overall Accuracy" />
                  <Line yAxisId="right" type="monotone" dataKey="OCR Accuracy" stroke={T.amber} strokeWidth={2} dot={false} strokeDasharray="4 3" name="OCR Accuracy" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="System Health" icon={FiZap} accent={T.emerald} className="xl:col-span-4 h-[300px]">
            <div className="flex-1 flex items-center justify-around">
              <RadialGauge value={totals.overallAccuracy} color={T.emerald} label="Overall" size={110} />
              <RadialGauge value={totals.ocrAccuracy} color={T.cyan} label="OCR" size={110} />
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 mb-3">
          <Panel title="Detection Mix" icon={FiLayers} accent={T.violet} className="xl:col-span-3 h-[280px]">
            <div style={{ width: "100%", height: 150 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={mixData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={68} paddingAngle={3} cornerRadius={5} stroke="none">
                    {mixData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 mt-1">
              {mixData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5" style={{ color: T.textDim }}><span className="w-2 h-2 rounded-full" style={{ background: d.color }} />{d.name}</span>
                  <span className="font-bold" style={{ color: T.text }}>{fmtNum(d.value)}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Scan Activity" icon={FiActivity} accent={T.indigo} className="xl:col-span-5 h-[280px]" subtitle="hour × weekday">
            <Heatmap data={heatmapData} color={T.indigo} />
          </Panel>

          <Panel title="Fleet Status" icon={FiCpu} accent={T.emerald} className="xl:col-span-4 h-[280px]"
            right={
              <span className="flex items-center gap-2 text-[9px] font-bold">
                <span style={{ color: T.emerald }}>{healthCounts.online} ON</span>
                <span style={{ color: T.amber }}>{healthCounts.idle} IDLE</span>
                <span style={{ color: T.textMute }}>{healthCounts.offline} OFF</span>
              </span>
            }>
            <div className="flex-1 overflow-auto space-y-1.5 -mr-1 pr-1">
              {equipmentHealth.length === 0 && <div className="text-[11px] text-center py-6" style={{ color: T.textMute }}>No equipment data</div>}
              {equipmentHealth.map((e) => {
                const color = e.status === "online" ? T.emerald : e.status === "idle" ? T.amber : "#4b5768";
                return (
                  <div key={e.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: T.panel2 }}>
                    <PulseDot color={color} size={6} />
                    <span className="text-[11px] font-semibold flex-1 truncate" style={{ color: T.textDim }}>{e.name}</span>
                    <span className="text-[9px] font-mono" style={{ color: T.textMute }}>{e.seen ? fmtTime(e.seen) : "—"}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* Ranked equipment table + performers */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 mb-3">
          <Panel title="Equipment Accuracy Ranking" icon={FiAward} accent={T.blue} className="xl:col-span-5 h-[360px]">
            <div className="flex-1 overflow-auto -mr-1 pr-1">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0" style={{ background: T.panel }}>
                  <tr style={{ color: T.textMute }}>
                    <th className="text-left py-1.5 font-bold">#</th>
                    <th className="text-left py-1.5 font-bold">Equipment</th>
                    <th className="text-right py-1.5 font-bold">Total</th>
                    <th className="text-right py-1.5 font-bold">Acc.</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.length === 0 && <tr><td colSpan={4} className="text-center py-8" style={{ color: T.textMute }}>{accLoading ? "Loading…" : "No data"}</td></tr>}
                  {ranked.map((r, i) => (
                    <tr key={r.name} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td className="py-1.5" style={{ color: T.textMute }}>{i + 1}</td>
                      <td className="py-1.5 font-semibold truncate max-w-[140px]" style={{ color: T.text }}>{r.name}</td>
                      <td className="py-1.5 text-right tabular-nums" style={{ color: T.textDim }}>{fmtNum(r.TotalCount)}</td>
                      <td className="py-1.5 text-right font-bold tabular-nums" style={{ color: r.accuracy >= 90 ? T.emerald : r.accuracy >= 70 ? T.amber : T.rose }}>{fmtPct(r.accuracy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Accuracy Bar Comparison" icon={FiTarget} accent={T.cyan} className="xl:col-span-7 h-[360px]">
            <div style={{ width: "100%", height: 290 }}>
              <ResponsiveContainer>
                <BarChart data={ranked} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: T.textMute, fontSize: 9 }} axisLine={{ stroke: T.border }} tickLine={false} interval={0} angle={-35} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: T.textMute, fontSize: 10 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                  <Tooltip content={<ChartTip pct />} />
                  <Bar dataKey="accuracy" name="Accuracy" radius={[6, 6, 0, 0]}>
                    {ranked.map((r, i) => <Cell key={i} fill={r.accuracy >= 90 ? T.emerald : r.accuracy >= 70 ? T.amber : T.rose} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        {/* Image gallery */}
        <Panel
          title="Container Scan Gallery"
          icon={FiImage}
          accent={T.pink}
          subtitle={`${classCounts.auto} auto · ${classCounts.manual} manual · ${classCounts.missing} missing`}
          right={
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="inline-flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                {IMAGE_FILTERS.map((f) => (
                  <button key={f.key} onClick={() => setImgFilter(f.key)}
                    className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all"
                    style={{ background: imgFilter === f.key ? (CLASS_CFG[f.key]?.color || T.indigo) : "transparent", color: imgFilter === f.key ? "#04121a" : T.textMute }}>
                    {f.label}
                  </button>
                ))}
              </div>
              <Segmented value={gridView} onChange={setGridView} options={[{ value: "grid", label: "", icon: FiGrid }, { value: "list", label: "", icon: FiList }]} />
            </div>
          }
        >
          <div className="max-h-[520px] overflow-auto -mx-1 px-1">
            {filteredScans.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs" style={{ color: T.textMute }}>
                {lockLoading ? "Loading scans…" : "No scans for this filter"}
              </div>
            ) : gridView === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredScans.map(({ row, cls }, idx) => {
                  const cont = String(row.ContNo || row.RFIDDATA || "—").split(" ")[0];
                  const srcs = camSrcs(row.CameraImage1 || row.cameraimage1, 1);
                  const thumb = srcs[0];
                  const cfg = CLASS_CFG[cls];
                  return (
                    <button key={idx} onClick={() => thumb && setSelectedImage({ srcs, row, cont, cls })}
                      className="text-left rounded-xl overflow-hidden group hover:-translate-y-0.5 transition-transform"
                      style={{ background: T.panel2, border: `1px solid ${T.border}` }}>
                      <div className="aspect-video relative overflow-hidden" style={{ background: "#060a12" }}>
                        {thumb ? (
                          <img src={thumb} alt={cont} className="w-full h-full object-cover group-hover:scale-105 transition-transform" onError={(e) => { e.target.style.display = "none"; }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><FiImage style={{ color: T.textMute }} size={18} /></div>
                        )}
                        <span className="absolute top-1.5 right-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: cfg.color, color: "#04121a" }}>{cfg.label}</span>
                      </div>
                      <div className="px-2 py-1.5">
                        <div className="text-[10px] font-bold truncate" style={{ color: T.text }}>{cont}</div>
                        <div className="text-[9px] truncate" style={{ color: T.textMute }}>{row.EqpName || row.KalmarNo || "—"} · {fmtTime(row.TransDate)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <table className="w-full text-[11px]">
                <thead className="sticky top-0" style={{ background: T.panel }}>
                  <tr style={{ color: T.textMute }}>
                    <th className="text-left py-1.5 font-bold">Container</th>
                    <th className="text-left py-1.5 font-bold">Equipment</th>
                    <th className="text-left py-1.5 font-bold">Time</th>
                    <th className="text-right py-1.5 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScans.map(({ row, cls }, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td className="py-1.5 font-semibold" style={{ color: T.text }}>{String(row.ContNo || row.RFIDDATA || "—").split(" ")[0]}</td>
                      <td className="py-1.5" style={{ color: T.textDim }}>{row.EqpName || row.KalmarNo || "—"}</td>
                      <td className="py-1.5 font-mono" style={{ color: T.textMute }}>{fmtTime(row.TransDate)}</td>
                      <td className="py-1.5 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: `${CLASS_CFG[cls].color}22`, color: CLASS_CFG[cls].color }}>{CLASS_CFG[cls].label}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>
      </div>

      {/* Image modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(2,6,16,0.8)", backdropFilter: "blur(4px)" }} onClick={() => setSelectedImage(null)}>
          <div className="rounded-2xl max-w-2xl w-full p-4" style={{ background: T.panel, border: `1px solid ${T.borderStrong}`, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold" style={{ color: T.text }}>{selectedImage.cont}</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${CLASS_CFG[selectedImage.cls].color}22`, color: CLASS_CFG[selectedImage.cls].color }}>{CLASS_CFG[selectedImage.cls].label}</span>
              </div>
              <button onClick={() => setSelectedImage(null)} style={{ color: T.textMute }}><FiX size={18} /></button>
            </div>
            <img src={selectedImage.srcs[0]} alt={selectedImage.cont} className="w-full rounded-lg" style={{ border: `1px solid ${T.border}` }}
              onError={(e) => { const next = selectedImage.srcs[1]; if (next && e.target.src !== next) e.target.src = next; }} />
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
