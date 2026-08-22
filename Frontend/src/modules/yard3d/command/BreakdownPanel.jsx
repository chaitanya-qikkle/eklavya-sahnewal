// Status / Block / Size breakdowns using only real backend fields.

import React, { useMemo } from "react";
import { FiBox, FiGrid, FiMap } from "react-icons/fi";
import { T, STATUS_COLORS, STATUS_LABELS } from "./theme";
import { Panel, PillRow, ScrollArea } from "./primitives";

export function StatusBreakdown({ statusCounts, activeStatus, onPick }) {
  const total = useMemo(
    () => Object.values(statusCounts).reduce((a, b) => a + b, 0),
    [statusCounts]
  );

  return (
    <Panel title="By Status" icon={FiBox} accent={T.cyan}>
      <PillRow
        color={T.cyan}
        label="All"
        count={total}
        active={activeStatus === "All"}
        onClick={() => onPick("All")}
      />
      <div className="mt-1.5 space-y-1">
        {Object.entries(STATUS_LABELS).map(([k, label]) => (
          <PillRow
            key={k}
            color={STATUS_COLORS[k]}
            label={label}
            count={statusCounts[k] || 0}
            active={activeStatus === k}
            onClick={() => onPick(activeStatus === k ? "All" : k)}
          />
        ))}
      </div>
    </Panel>
  );
}

export function BlockBreakdown({ blocks, onPick }) {
  const max = blocks.reduce((m, b) => Math.max(m, b.count), 1);

  return (
    <Panel title={`Blocks (${blocks.length})`} icon={FiMap} accent={T.indigo}>
      <ScrollArea maxHeight={240} className="-mx-1 px-1">
        <div className="space-y-1.5">
          {blocks.length === 0 && (
            <div className="text-[11px] text-center py-3" style={{ color: T.textMute }}>
              No block data yet.
            </div>
          )}
          {blocks.map((b) => {
            const pct = Math.round((b.count / max) * 100);
            return (
              <button
                key={b.block}
                onClick={() => onPick?.(b.block)}
                className="w-full text-left rounded-lg border px-2.5 py-1.5 transition-all hover:shadow-sm"
                style={{ background: T.card, borderColor: T.border }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold font-mono flex-1 truncate" style={{ color: T.text }}>
                    {b.block}
                  </span>
                  <span className="text-[11px] font-mono font-black tabular-nums" style={{ color: T.indigo }}>
                    {b.count}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(15,23,42,0.06)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${T.indigo}, ${T.cyan})` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </Panel>
  );
}

export function SizeBreakdown({ sizes }) {
  if (!sizes || sizes.length === 0) {
    return (
      <Panel title="By Size · Type" icon={FiGrid} accent={T.blue}>
        <div className="text-[11px] text-center py-3" style={{ color: T.textMute }}>
          No size data.
        </div>
      </Panel>
    );
  }
  return (
    <Panel title="By Size · Type" icon={FiGrid} accent={T.blue}>
      <div className="grid grid-cols-2 gap-2">
        {sizes.map((s) => (
          <div
            key={s.key}
            className="rounded-lg border px-2.5 py-2"
            style={{ background: T.card, borderColor: T.border }}
          >
            <div className="text-[18px] font-mono font-black tabular-nums leading-tight"
              style={{ color: T.text }}>
              {s.count}
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.textMute }}>
              {s.key}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
