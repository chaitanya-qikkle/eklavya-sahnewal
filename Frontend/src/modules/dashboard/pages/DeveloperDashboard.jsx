import React, { useEffect, useMemo, useState } from "react";
import {
  FiCpu, FiCheckCircle, FiEdit3, FiAlertTriangle, FiTarget, FiZap,
  FiRefreshCw, FiActivity, FiImage, FiX, FiClock, FiTrendingUp,
} from "react-icons/fi";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from "recharts";
import Navbar from "../../../components/layout/Navbar";
import {
  useGetEquipmentQuery,
  useLazyGetEquipmentAccuracyQuery,
  useLazyGetDeviceLockReportQuery,
} from "../../../store/api/ymsApi";

// ── Theme (dark, real-time-monitoring style) ─────────────────────────────
const T = {
  bg: "#0a0e17",
  panel: "#111827",
  panelAlt: "#0f172a",
  border: "#1f2937",
  text: "#e5e7eb",
  textMute: "#8b93a7",
  cyan: "#22d3ee",
  emerald: "#34d399",
  amber: "#fbbf24",
  rose: "#fb7185",
  violet: "#a78bfa",
  blue: "#60a5fa",
};

const today = new Date().toISOString().split("T")[0];
const nDaysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().split("T")[0];

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

const RANGE_OPTIONS = [
  { label: "24H", days: 1 },
  { label: "7D", days: 7 },
  { label: "14D", days: 14 },
  { label: "30D", days: 30 },
];

function StatCard({ icon: Icon, label, value, sub, accent, live }) {
  return (
    <div
      className="relative rounded-2xl p-4 sm:p-5 overflow-hidden"
      style={{ background: T.panel, border: `1px solid ${T.border}` }}
    >
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 blur-2xl"
        style={{ background: accent }}
      />
      <div className="relative flex items-start justify-between">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${accent}22`, color: accent }}
        >
          <Icon size={17} />
        </div>
        {live && (
          <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: T.emerald }}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: T.emerald }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: T.emerald }} />
            </span>
            LIVE
          </span>
        )}
      </div>
      <div className="relative mt-3">
        <div className="text-2xl font-bold tracking-tight" style={{ color: T.text }}>{value}</div>
        <div className="text-xs mt-1" style={{ color: T.textMute }}>{label}</div>
        {sub && <div className="text-[11px] mt-1.5 font-medium" style={{ color: accent }}>{sub}</div>}
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, right, children, className = "" }) {
  return (
    <div className={`rounded-2xl overflow-hidden ${className}`} style={{ background: T.panel, border: `1px solid ${T.border}` }}>
      <div className="flex items-center justify-between px-4 sm:px-5 py-3.5" style={{ borderBottom: `1px solid ${T.border}` }}>
        <div className="flex items-center gap-2">
          {Icon && <Icon size={15} style={{ color: T.cyan }} />}
          <h3 className="text-sm font-semibold" style={{ color: T.text }}>{title}</h3>
        </div>
        {right}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-xl" style={{ background: "#0b1220", border: `1px solid ${T.border}`, color: T.text }}>
      <div className="font-semibold mb-1" style={{ color: T.textMute }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: T.textMute }}>{p.name}:</span>
          <span className="font-semibold">{typeof p.value === "number" ? p.value.toFixed(2) : p.value}%</span>
        </div>
      ))}
    </div>
  );
}

const DeveloperDashboard = () => {
  const [rangeDays, setRangeDays] = useState(7);
  const fromDate = nDaysAgo(rangeDays);
  const toDate = today;

  const { data: equipmentApi } = useGetEquipmentQuery(undefined, { pollingInterval: 30000 });
  const [fetchAccuracy, { data: accData, isFetching: accLoading }] = useLazyGetEquipmentAccuracyQuery();
  const [fetchLockReport, { data: lockData, isFetching: lockLoading }] = useLazyGetDeviceLockReportQuery();

  const [selectedImage, setSelectedImage] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = () => {
    fetchAccuracy({ from_date: fromDate, to_date: toDate });
    fetchLockReport({ from_date: fromDate, to_date: toDate, report_type: "All" });
    setLastRefresh(new Date());
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays]);

  const equipmentCount = useMemo(() => {
    const rows = Array.isArray(equipmentApi?.data) ? equipmentApi.data : [];
    return rows.length;
  }, [equipmentApi]);

  const accRows = useMemo(() => (Array.isArray(accData?.data) ? accData.data : []), [accData]);
  const lockRows = useMemo(() => (Array.isArray(lockData?.data) ? lockData.data : []), [lockData]);

  // Aggregate SP's own per-equipment/per-day fields — no invented derivations.
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

  // Daily trend — group by TransDate across all equipment
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
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => {
        const ocrDetected = Math.max(b.NonMissing - b.M, 0);
        return {
          date: fmtDateShort(date),
          "Overall Accuracy": b.TotalCount ? +((b.NonMissing / b.TotalCount) * 100).toFixed(2) : 0,
          "OCR Accuracy": b.TotalCount ? +((ocrDetected / b.TotalCount) * 100).toFixed(2) : 0,
          "Manual %": b.TotalCount ? +((b.M / b.TotalCount) * 100).toFixed(2) : 0,
          "Missing %": b.TotalCount ? +((b.Missing / b.TotalCount) * 100).toFixed(2) : 0,
        };
      });
  }, [accRows]);

  // Per-equipment accuracy summary (latest aggregate per machine)
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
      .map((b) => ({ ...b, accuracy: b.TotalCount ? (b.NonMissing / b.TotalCount) * 100 : 0 }))
      .sort((a, b) => b.TotalCount - a.TotalCount);
  }, [accRows]);

  // Recent scans (device lock report) — most recent first, with image previews
  const recentScans = useMemo(() => {
    const rows = [...lockRows];
    rows.sort((a, b) => {
      const da = new Date(String(a.TransDate || "").replace(" ", "T"));
      const db = new Date(String(b.TransDate || "").replace(" ", "T"));
      return db - da;
    });
    return rows.slice(0, 12);
  }, [lockRows]);

  const isMissingCont = (row) => {
    const cont = String(row.ContNo || row.RFIDDATA || "").trim().split(" ")[0];
    return !cont || cont.replace(/0/g, "") === "";
  };

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      <Navbar />
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2" style={{ color: T.text }}>
              <FiCpu style={{ color: T.cyan }} />
              Developer Dashboard
            </h1>
            <p className="text-xs mt-1" style={{ color: T.textMute }}>
              OCR detection accuracy &amp; device monitoring · {equipmentCount} equipment tracked
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setRangeDays(opt.days)}
                  className="px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    background: rangeDays === opt.days ? T.cyan : "transparent",
                    color: rangeDays === opt.days ? "#04202a" : T.textMute,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={load}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: T.panel, border: `1px solid ${T.border}`, color: T.text }}
            >
              <FiRefreshCw size={13} className={accLoading || lockLoading ? "animate-spin" : ""} />
              Refresh
            </button>
            <span className="hidden sm:flex items-center gap-1 text-[11px]" style={{ color: T.textMute }}>
              <FiClock size={12} /> {fmtTime(lastRefresh)}
            </span>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
          <StatCard icon={FiActivity} label="Total Containers" value={fmtNum(totals.TotalCount)} accent={T.blue} live />
          <StatCard icon={FiTarget} label="OCR Detected" value={fmtNum(totals.ocrDetected)} sub={fmtPct(totals.ocrAccuracy)} accent={T.cyan} />
          <StatCard icon={FiEdit3} label="Manual Entry" value={fmtNum(totals.M)} sub={fmtPct(totals.manualPct)} accent={T.violet} />
          <StatCard icon={FiAlertTriangle} label="Missing" value={fmtNum(totals.Missing)} sub={fmtPct(totals.missingPct)} accent={T.rose} />
          <StatCard icon={FiCheckCircle} label="Overall Accuracy" value={fmtPct(totals.overallAccuracy)} sub={`${fmtNum(totals.NonMissing)} detected`} accent={T.emerald} />
          <StatCard icon={FiZap} label="OCR Accuracy" value={fmtPct(totals.ocrAccuracy)} sub={`${fmtNum(totals.ocrDetected)} via OCR`} accent={T.amber} />
        </div>

        {/* Trend + per-equipment */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
          <Panel title="Daily Accuracy Trend" icon={FiTrendingUp} className="xl:col-span-2">
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: T.textMute, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
                  <YAxis tick={{ fill: T.textMute, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} unit="%" />
                  <Tooltip content={<ChartTip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: T.textMute }} />
                  <Line type="monotone" dataKey="Overall Accuracy" stroke={T.emerald} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="OCR Accuracy" stroke={T.cyan} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Manual %" stroke={T.violet} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Missing %" stroke={T.rose} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Summary Metrics" icon={FiActivity}>
            <div className="space-y-3">
              {[
                { label: "Total Containers", value: fmtNum(totals.TotalCount), color: T.blue },
                { label: "OCR Detected", value: `${fmtNum(totals.ocrDetected)} (${fmtPct(totals.ocrAccuracy)})`, color: T.cyan },
                { label: "Manual Entry", value: `${fmtNum(totals.M)} (${fmtPct(totals.manualPct)})`, color: T.violet },
                { label: "Missing", value: `${fmtNum(totals.Missing)} (${fmtPct(totals.missingPct)})`, color: T.rose },
                { label: "Successfully Detected", value: fmtNum(totals.NonMissing), color: T.emerald },
                { label: "OCR Accuracy", value: fmtPct(totals.ocrAccuracy), color: T.amber },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-1.5" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <div className="flex items-center gap-2 text-xs" style={{ color: T.textMute }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: row.color }} />
                    {row.label}
                  </div>
                  <div className="text-sm font-semibold" style={{ color: T.text }}>{row.value}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Per-equipment table + recent scans */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Panel title="Equipment Accuracy" icon={FiCpu} className="xl:col-span-1">
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: T.textMute }}>
                    <th className="text-left py-2 px-1 font-medium">Equipment</th>
                    <th className="text-right py-2 px-1 font-medium">Total</th>
                    <th className="text-right py-2 px-1 font-medium">Acc.</th>
                  </tr>
                </thead>
                <tbody>
                  {perEquipment.length === 0 && (
                    <tr><td colSpan={3} className="text-center py-6" style={{ color: T.textMute }}>No data for this range</td></tr>
                  )}
                  {perEquipment.map((r) => (
                    <tr key={r.name} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td className="py-2 px-1" style={{ color: T.text }}>{r.name}</td>
                      <td className="py-2 px-1 text-right" style={{ color: T.textMute }}>{fmtNum(r.TotalCount)}</td>
                      <td className="py-2 px-1 text-right font-semibold" style={{ color: r.accuracy >= 90 ? T.emerald : r.accuracy >= 70 ? T.amber : T.rose }}>
                        {fmtPct(r.accuracy)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="Live Scan Feed"
            icon={FiImage}
            className="xl:col-span-2"
            right={<span className="text-[11px]" style={{ color: T.textMute }}>{recentScans.length} recent</span>}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {recentScans.length === 0 && (
                <div className="col-span-full text-center py-8 text-xs" style={{ color: T.textMute }}>No recent scans</div>
              )}
              {recentScans.map((row, idx) => {
                const missing = isMissingCont(row);
                const cont = String(row.ContNo || row.RFIDDATA || "—").split(" ")[0];
                const srcs = camSrcs(row.CameraImage1 || row.cameraimage1, 1);
                const thumb = srcs[0];
                return (
                  <button
                    key={idx}
                    onClick={() => thumb && setSelectedImage({ srcs, row, cont })}
                    className="text-left rounded-xl overflow-hidden group"
                    style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}
                  >
                    <div className="aspect-video relative overflow-hidden" style={{ background: "#050810" }}>
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={cont}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FiImage style={{ color: T.textMute }} size={20} />
                        </div>
                      )}
                      <span
                        className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: missing ? `${T.rose}dd` : `${T.emerald}dd`, color: "#02110a" }}
                      >
                        {missing ? "MISSING" : "OK"}
                      </span>
                    </div>
                    <div className="px-2 py-1.5">
                      <div className="text-[11px] font-semibold truncate" style={{ color: T.text }}>{cont}</div>
                      <div className="text-[10px] truncate" style={{ color: T.textMute }}>
                        {row.EqpName || row.KalmarNo || "—"} · {fmtTime(row.TransDate)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>

      {/* Image modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="rounded-2xl max-w-2xl w-full p-4"
            style={{ background: T.panel, border: `1px solid ${T.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold" style={{ color: T.text }}>{selectedImage.cont}</h4>
              <button onClick={() => setSelectedImage(null)} style={{ color: T.textMute }}>
                <FiX size={18} />
              </button>
            </div>
            <img
              src={selectedImage.srcs[0]}
              alt={selectedImage.cont}
              className="w-full rounded-lg"
              onError={(e) => {
                const next = selectedImage.srcs[1];
                if (next && e.target.src !== next) e.target.src = next;
              }}
            />
            <div className="mt-3 text-xs grid grid-cols-2 gap-2" style={{ color: T.textMute }}>
              <div>Equipment: <span style={{ color: T.text }}>{selectedImage.row.EqpName || "—"}</span></div>
              <div>Time: <span style={{ color: T.text }}>{fmtTime(selectedImage.row.TransDate)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeveloperDashboard;
