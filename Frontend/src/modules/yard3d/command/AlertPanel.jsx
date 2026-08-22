import React, { useMemo, useState } from "react";
import {
  FiAlertOctagon, FiAlertTriangle, FiInfo, FiClock,
  FiLock, FiTool,
} from "react-icons/fi";
import { T } from "./theme";
import { SectionLabel, ScrollArea, Tag } from "./primitives";
import { SEVERITY } from "./alerts";

const TYPE_ICON = {
  overdwell: FiClock,
  hold:      FiLock,
  damaged:   FiTool,
  hazmat:    FiAlertOctagon,
};

const SEV_ICON = {
  danger: FiAlertOctagon,
  warn:   FiAlertTriangle,
  info:   FiInfo,
};

export default function AlertPanel({ alerts, onJumpToContainer }) {
  const [filter, setFilter] = useState("all");

  const counts = useMemo(() => {
    const c = { all: alerts.length, danger: 0, warn: 0, info: 0 };
    for (const a of alerts) c[a.severity]++;
    return c;
  }, [alerts]);

  const filtered = useMemo(() => {
    if (filter === "all") return alerts;
    return alerts.filter((a) => a.severity === filter);
  }, [alerts, filter]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FiAlertOctagon size={13} style={{ color: T.red }} />
          <span
            className="text-[10px] font-black uppercase tracking-[0.22em]"
            style={{ color: T.text }}
          >
            Alerts
          </span>
        </div>
        <Tag color={T.red} filled={counts.danger > 0}>{counts.all} active</Tag>
      </div>

      <div className="grid grid-cols-4 gap-1.5 mb-3">
        <SevChip label="ALL"  color={T.slate}  count={counts.all}    active={filter === "all"}    onClick={() => setFilter("all")} />
        <SevChip label="DNG"  color={T.red}    count={counts.danger} active={filter === "danger"} onClick={() => setFilter("danger")} />
        <SevChip label="WRN"  color={T.amber}  count={counts.warn}   active={filter === "warn"}   onClick={() => setFilter("warn")} />
        <SevChip label="INF"  color={T.cyan}   count={counts.info}   active={filter === "info"}   onClick={() => setFilter("info")} />
      </div>

      <ScrollArea className="flex-1 -mx-1 px-1 pb-2">
        <div className="space-y-1.5">
          {filtered.length === 0 && (
            <div
              className="rounded-lg border px-3 py-6 text-center text-[11px]"
              style={{ background: T.card, borderColor: T.border, color: T.textMute }}
            >
              No alerts in this category.
            </div>
          )}
          {filtered.map((a) => {
            const sev = SEVERITY[a.severity];
            const Icon = TYPE_ICON[a.type] || FiAlertTriangle;
            const SevIcon = SEV_ICON[a.severity];
            return (
              <button
                key={a.id}
                onClick={() => a.containerId && onJumpToContainer?.(a)}
                className="w-full text-left rounded-lg border px-2.5 py-2 transition-all hover:shadow-sm"
                style={{ background: sev.bg, borderColor: sev.border }}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: `${sev.color}22`, color: sev.color, border: `1px solid ${sev.color}45` }}
                  >
                    <Icon size={12} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <SevIcon size={10} style={{ color: sev.color }} />
                      <span
                        className="text-[10px] font-black uppercase tracking-wider"
                        style={{ color: sev.color }}
                      >
                        {a.title}
                      </span>
                    </div>
                    <div className="text-[11px] leading-snug" style={{ color: T.textDim }}>
                      {a.body}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function SevChip({ label, color, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-1 py-1.5 transition-all border"
      style={{
        background: active ? `${color}1c` : T.card,
        borderColor: active ? `${color}aa` : T.border,
      }}
    >
      <div
        className="text-[14px] font-mono font-black tabular-nums leading-tight"
        style={{ color: active ? color : T.text }}
      >
        {count}
      </div>
      <div
        className="text-[8.5px] font-black uppercase tracking-widest"
        style={{ color: active ? color : T.textMute }}
      >
        {label}
      </div>
    </button>
  );
}
