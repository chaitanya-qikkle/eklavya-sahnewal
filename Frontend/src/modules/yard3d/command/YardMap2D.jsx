// 2D schematic yard map (top-down).
// Each block from the slot-geofence is drawn as a rounded rectangle, positioned
// via a lat/lng → SVG projection. Inside each block we draw a slot grid
// (block.rows × block.cols). Containers are placed in their (ROW_NO,
// COLUMN_NAME) cell when available; any without explicit row/col are PACKED
// into the remaining empty slots so the operator still sees the block fill up
// — the count badge stays accurate.
//
// This is the operational schematic — fast to scan, no 3D realism. The
// Command Center uses this *instead of* duplicating the realistic 3D page.

import React, { useMemo, useState } from "react";
import { T, STATUS_COLORS, STATUS_LABELS } from "./theme";

const VB_W = 1280;
const VB_H = 760;
const PAD  = 18;
const BLOCK_RX = 6;
const HEADER_H = 14;

export default function YardMap2D({
  geofence,
  containers,
  activeStatus = "All",
  selectedId,
  onSelectContainer,
  showLabels = false,
}) {
  const containersByBlock = useMemo(() => {
    const m = new Map();
    for (const c of containers) {
      if (!c.block) continue;
      if (!m.has(c.block)) m.set(c.block, []);
      m.get(c.block).push(c);
    }
    return m;
  }, [containers]);

  // Geo projection — use independent X / Y scales so the entire viewport
  // is filled and every block is large enough to read. This is a schematic,
  // not a survey-grade map, so stretching for legibility is fine.
  const blocks = useMemo(() => {
    if (!geofence?.blocks) return [];
    const all = Object.values(geofence.blocks);
    if (!all.length) return [];

    let minLat = +Infinity, maxLat = -Infinity, minLng = +Infinity, maxLng = -Infinity;
    for (const b of all) {
      if (b.minLat < minLat) minLat = b.minLat;
      if (b.maxLat > maxLat) maxLat = b.maxLat;
      if (b.minLng < minLng) minLng = b.minLng;
      if (b.maxLng > maxLng) maxLng = b.maxLng;
    }
    const latSpan = Math.max(maxLat - minLat, 1e-6);
    const lngSpan = Math.max(maxLng - minLng, 1e-6);
    const innerW = VB_W - PAD * 2;
    const innerH = VB_H - PAD * 2;

    // Independent scales — blocks fill the viewport in both axes.
    const scaleX = innerW / lngSpan;
    const scaleY = innerH / latSpan;

    const project = (lat, lng) => ({
      x: PAD + (lng - minLng) * scaleX,
      y: PAD + (maxLat - lat) * scaleY,
    });

    return all.map((b) => {
      const tl = project(b.maxLat, b.minLng);
      const br = project(b.minLat, b.maxLng);
      const w = Math.max(br.x - tl.x, 16);
      const h = Math.max(br.y - tl.y, 16);
      return { ...b, x: tl.x, y: tl.y, w, h };
    });
  }, [geofence]);

  const [hover, setHover] = useState(null);

  return (
    <div className="relative w-full h-full" style={{ background: T.bg2 }}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full h-full select-none"
      >
        <defs>
          <pattern id="ycc-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={T.border} strokeWidth="0.5" />
          </pattern>
          <filter id="ycc-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" />
            <feOffset dx="0" dy="2" />
            <feComponentTransfer><feFuncA type="linear" slope="0.20" /></feComponentTransfer>
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect width={VB_W} height={VB_H} fill="url(#ycc-grid)" />

        {/* North arrow */}
        <g transform={`translate(${VB_W - 50}, 36)`} opacity="0.55">
          <circle r="16" fill={T.card} stroke={T.border} strokeWidth="1" />
          <path d="M 0 -11 L 4 7 L 0 4 L -4 7 Z" fill={T.red} />
          <text y="26" textAnchor="middle" fontSize="9" fontWeight="900"
            fill={T.textDim} fontFamily="monospace">N</text>
        </g>

        {blocks.map((b) => (
          <BlockShape
            key={b.id}
            block={b}
            containers={containersByBlock.get(b.id) || []}
            activeStatus={activeStatus}
            selectedId={selectedId}
            hover={hover === b.id}
            onHoverIn={() => setHover(b.id)}
            onHoverOut={() => setHover((h) => (h === b.id ? null : h))}
            onSelectContainer={onSelectContainer}
            showLabels={showLabels}
          />
        ))}
      </svg>

      {/* Legend */}
      <div
        className="absolute bottom-3 left-3 rounded-lg border px-2.5 py-2 flex items-center gap-2.5 flex-wrap"
        style={{
          background: T.card + "f0",
          borderColor: T.border,
          backdropFilter: "blur(8px)",
          boxShadow: T.shadow,
          maxWidth: "75%",
        }}
      >
        <span className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: T.textMute }}>
          Legend
        </span>
        {Object.entries(STATUS_LABELS).map(([k, label]) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: STATUS_COLORS[k] }} />
            <span className="text-[9.5px] font-bold" style={{ color: T.textDim }}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── A single block: header + slot grid filled with containers ──────────────
function BlockShape({
  block, containers, activeStatus, selectedId, hover,
  onHoverIn, onHoverOut, onSelectContainer, showLabels,
}) {
  const rows = block.rows || [];
  const cols = block.cols || [];
  const rowCount = Math.max(rows.length, 1);
  const colCount = Math.max(cols.length, 1);

  // Resolve which slot each container lands in. If a container has explicit
  // row/col matching the block schema → place it there. Otherwise queue it
  // for sequential packing into the leftover slots.
  const { slotStacks, unplaced } = useMemo(() => {
    const stacks = new Map();
    const queue = [];
    for (const c of containers) {
      const r = String(c.row || "").trim();
      const colDigits = String(c.col || "").replace(/\D/g, "");
      const colNum = colDigits ? Number(colDigits) : NaN;
      const rIdx = rows.indexOf(r);
      const cIdx = Number.isFinite(colNum) ? cols.indexOf(colNum) : -1;
      if (rIdx >= 0 && cIdx >= 0) {
        const key = rIdx * colCount + cIdx;
        if (!stacks.has(key)) stacks.set(key, []);
        stacks.get(key).push(c);
      } else {
        queue.push(c);
      }
    }
    return { slotStacks: stacks, unplaced: queue };
  }, [containers, rows, cols, colCount]);

  // Slot cell geometry — packed tight, no gap, so even tiny blocks show fill.
  const headerH = Math.min(HEADER_H, block.h * 0.22);
  const gridX = block.x + 2;
  const gridY = block.y + headerH + 1;
  const gridW = Math.max(block.w - 4, 4);
  const gridH = Math.max(block.h - headerH - 3, 4);
  const slotW = gridW / colCount;
  const slotH = gridH / rowCount;

  // Walk every (r, c) cell. Pull from explicit stack first; if empty, draw
  // from the unplaced queue. This means a block always visually fills up to
  // its real container count.
  const cells = [];
  let queueIdx = 0;
  for (let rIdx = 0; rIdx < rowCount; rIdx++) {
    for (let cIdx = 0; cIdx < colCount; cIdx++) {
      const key = rIdx * colCount + cIdx;
      const explicit = slotStacks.get(key);
      let stack = explicit;
      if (!stack || stack.length === 0) {
        if (queueIdx < unplaced.length) {
          stack = [unplaced[queueIdx]];
          queueIdx++;
        }
      }
      cells.push({ rIdx, cIdx, stack });
    }
  }

  return (
    <g onMouseEnter={onHoverIn} onMouseLeave={onHoverOut}>
      {/* Block body */}
      <rect
        x={block.x} y={block.y} width={block.w} height={block.h}
        rx={BLOCK_RX} ry={BLOCK_RX}
        fill={T.card}
        stroke={hover ? T.text : T.borderHi}
        strokeWidth={hover ? 1.5 : 0.8}
        filter={hover ? "url(#ycc-shadow)" : undefined}
      />

      {/* Slot grid background — slightly recessed look */}
      <rect
        x={gridX} y={gridY} width={gridW} height={gridH}
        fill="rgba(15,23,42,0.05)"
        rx={2}
      />

      {/* Cells */}
      {cells.map(({ rIdx, cIdx, stack }) => {
        const x = gridX + cIdx * slotW;
        const y = gridY + rIdx * slotH;
        if (!stack || stack.length === 0) {
          // Empty slot — faint outline
          return (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={x + 0.3} y={y + 0.3}
              width={Math.max(slotW - 0.6, 0.5)}
              height={Math.max(slotH - 0.6, 0.5)}
              fill="rgba(255,255,255,0.4)"
              stroke="rgba(15,23,42,0.06)"
              strokeWidth="0.3"
            />
          );
        }
        const top = stack[stack.length - 1];
        const color = STATUS_COLORS[top.status] || T.slate;
        const dim = activeStatus !== "All" && top.status !== activeStatus;
        const isSelected = selectedId && stack.some((c) => c.id === selectedId);
        return (
          <g
            key={`${rIdx}-${cIdx}`}
            onClick={(e) => { e.stopPropagation(); onSelectContainer?.(top); }}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={x + 0.3} y={y + 0.3}
              width={Math.max(slotW - 0.6, 0.5)}
              height={Math.max(slotH - 0.6, 0.5)}
              fill={color}
              opacity={dim ? 0.22 : 0.92}
              stroke={isSelected ? T.text : "rgba(0,0,0,0.18)"}
              strokeWidth={isSelected ? 1 : 0.25}
              rx={Math.min(slotW, slotH) * 0.15}
            >
              <title>{`${top.containerNo || "—"}\n${top.size || ""} ${top.type || ""} · ${STATUS_LABELS[top.status] || top.status}\n${block.id}:${top.row || "-"}:${top.col || "-"} · T${top.tier}${stack.length > 1 ? `\nStack of ${stack.length}` : ""}`}</title>
            </rect>
            {stack.length > 1 && slotW >= 6 && slotH >= 6 && (
              <circle
                cx={x + slotW - 1.4}
                cy={y + 1.4}
                r={Math.min(slotW, slotH) * 0.18}
                fill="#fff"
                opacity={dim ? 0.35 : 0.95}
              />
            )}
          </g>
        );
      })}

      {/* Header strip */}
      <rect
        x={block.x} y={block.y}
        width={block.w} height={headerH}
        fill="rgba(15,23,42,0.06)"
        rx={BLOCK_RX} ry={BLOCK_RX}
      />
      <rect
        x={block.x} y={block.y + headerH - 3}
        width={block.w} height={3}
        fill="rgba(15,23,42,0.06)"
      />
      {showLabels && block.w >= 26 && (
        <text
          x={block.x + 4}
          y={block.y + headerH - 4}
          fontFamily="monospace"
          fontWeight="900"
          fontSize={Math.min(11, Math.max(8, headerH * 0.78))}
          fill={T.text}
          style={{ pointerEvents: "none" }}
        >
          {block.id}
        </text>
      )}
      {showLabels && block.w >= 50 && (
        <text
          x={block.x + block.w - 4}
          y={block.y + headerH - 4}
          textAnchor="end"
          fontFamily="monospace"
          fontWeight="800"
          fontSize={Math.min(10, Math.max(7, headerH * 0.65))}
          fill={T.textMute}
          style={{ pointerEvents: "none" }}
        >
          {containers.length}
        </text>
      )}
    </g>
  );
}
