// Panels that give the Command Center its own identity vs. the realistic 3D
// yard page. The 3D page focuses on "what the yard looks like"; these panels
// focus on "what's happening" — dwell distribution, top hot blocks, type mix,
// and process flow counts.

import React, { useMemo } from "react";
import { FiClock, FiAlertCircle, FiActivity, FiLayers } from "react-icons/fi";
import { T, STATUS_COLORS, STATUS_LABELS } from "./theme";
import { Panel, SectionLabel } from "./primitives";

// ── Dwell distribution: how many containers fall in each dwell bucket ──────
export function DwellDistribution({ containers }) {
  const buckets = useMemo(() => {
    const b = [
      { id: "0-3",  label: "0–3 d",  count: 0, color: T.emerald },
      { id: "3-7",  label: "3–7 d",  count: 0, color: T.cyan },
      { id: "7-14", label: "7–14 d", count: 0, color: T.amber },
      { id: "14+",  label: "14+ d",  count: 0, color: T.red },
    ];
    for (const c of containers) {
      const d = c.dwellDays || 0;
      if (d <= 3) b[0].count++;
      else if (d <= 7) b[1].count++;
      else if (d <= 14) b[2].count++;
      else b[3].count++;
    }
    return b;
  }, [containers]);

  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <Panel title="Dwell Distribution" icon={FiClock} accent={T.amber}>
      <div className="space-y-2">
        {buckets.map((b) => {
          const pct = total ? Math.round((b.count / total) * 100) : 0;
          const w = Math.max(2, Math.round((b.count / max) * 100));
          return (
            <div key={b.id}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: b.color }} />
                <span className="text-[11px] font-bold flex-1" style={{ color: T.text }}>{b.label}</span>
                <span className="text-[11px] font-mono font-bold tabular-nums" style={{ color: b.color }}>
                  {b.count}
                </span>
                <span className="text-[9px] font-mono tabular-nums" style={{ color: T.textMute }}>
                  {pct}%
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(15,23,42,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${w}%`, background: `linear-gradient(90deg, ${b.color}, ${b.color}aa)` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ── Hot blocks: highest count of over-dwell (>7d) containers ───────────────
export function HotBlocks({ containers, onClickBlock }) {
  const rows = useMemo(() => {
    const map = new Map();
    for (const c of containers) {
      const k = c.block || "(unassigned)";
      if (!map.has(k)) map.set(k, { block: k, total: 0, overdwell: 0, hold: 0, hazmat: 0 });
      const r = map.get(k);
      r.total++;
      if ((c.dwellDays || 0) > 7) r.overdwell++;
      if (c.status === "hold") r.hold++;
      if (c.status === "hazmat") r.hazmat++;
    }
    return Array.from(map.values())
      .filter((r) => r.overdwell > 0 || r.hold > 0 || r.hazmat > 0)
      .sort((a, b) => (b.overdwell + b.hold * 0.6 + b.hazmat * 0.9) - (a.overdwell + a.hold * 0.6 + a.hazmat * 0.9))
      .slice(0, 5);
  }, [containers]);

  return (
    <Panel title="Hot Blocks" icon={FiAlertCircle} accent={T.red}>
      {rows.length === 0 && (
        <div className="text-[11px] text-center py-2" style={{ color: T.textMute }}>
          No hotspot blocks — all clear.
        </div>
      )}
      <div className="space-y-1.5">
        {rows.map((r) => (
          <button
            key={r.block}
            onClick={() => onClickBlock?.(r.block)}
            className="w-full text-left rounded-lg border px-2.5 py-2 transition-all hover:shadow-sm"
            style={{ background: T.card, borderColor: T.border }}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-[12px] flex-1 truncate" style={{ color: T.text }}>
                {r.block}
              </span>
              <span className="text-[10px] font-mono" style={{ color: T.textMute }}>{r.total} total</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {r.overdwell > 0 && (
                <span className="inline-flex items-center gap-1 text-[9.5px] font-bold"
                  style={{ color: T.amber }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.amber }} />
                  {r.overdwell} over-dwell
                </span>
              )}
              {r.hold > 0 && (
                <span className="inline-flex items-center gap-1 text-[9.5px] font-bold"
                  style={{ color: T.amber }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.amber }} />
                  {r.hold} hold
                </span>
              )}
              {r.hazmat > 0 && (
                <span className="inline-flex items-center gap-1 text-[9.5px] font-bold"
                  style={{ color: T.orange }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.orange }} />
                  {r.hazmat} hazmat
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </Panel>
  );
}

// ── Process flow: how many containers are in each process state right now ──
export function ProcessFlow({ containers }) {
  const rows = useMemo(() => {
    const map = new Map();
    for (const c of containers) {
      const p = (c.process || "Unknown").trim() || "Unknown";
      map.set(p, (map.get(p) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [containers]);

  const max = Math.max(1, ...rows.map((r) => r.count));

  if (!rows.length) {
    return (
      <Panel title="Process Flow" icon={FiActivity} accent={T.indigo}>
        <div className="text-[11px] text-center py-2" style={{ color: T.textMute }}>No process data.</div>
      </Panel>
    );
  }
  return (
    <Panel title="Process Flow" icon={FiActivity} accent={T.indigo}>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const w = Math.round((r.count / max) * 100);
          return (
            <div key={r.key}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10.5px] font-bold truncate" style={{ color: T.text }}>
                  {r.key}
                </span>
                <span className="text-[10.5px] font-mono font-bold tabular-nums" style={{ color: T.indigo }}>
                  {r.count}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(15,23,42,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${w}%`, background: `linear-gradient(90deg, ${T.indigo}, ${T.cyan})` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ── Status donut (compact) ─────────────────────────────────────────────────
export function StatusDonut({ statusCounts }) {
  const entries = Object.entries(statusCounts).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;

  const R = 36, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <Panel title="Status Mix" icon={FiLayers} accent={T.cyan}>
      <div className="flex items-center gap-3">
        <svg width="92" height="92" viewBox="0 0 92 92">
          <circle cx="46" cy="46" r={R} fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="14" />
          {entries.map(([k, v]) => {
            const frac = v / total;
            const len = frac * C;
            const offset = acc;
            acc += len;
            return (
              <circle
                key={k}
                cx="46" cy="46" r={R}
                fill="none"
                stroke={STATUS_COLORS[k]}
                strokeWidth="14"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 46 46)"
              />
            );
          })}
          <text x="46" y="44" textAnchor="middle" fontWeight="900" fontSize="18" fill={T.text}>
            {total}
          </text>
          <text x="46" y="58" textAnchor="middle" fontSize="9" fill={T.textMute} fontWeight="700">
            CTRS
          </text>
        </svg>
        <div className="flex-1 grid grid-cols-2 gap-x-2 gap-y-1">
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: STATUS_COLORS[k] }} />
              <span className="text-[10px] font-bold" style={{ color: T.textDim }}>{STATUS_LABELS[k]}</span>
              <span className="ml-auto text-[10px] font-mono font-bold tabular-nums" style={{ color: T.text }}>
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
