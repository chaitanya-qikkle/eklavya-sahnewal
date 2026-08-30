// Yard Command Center
// ----------------------------------------------------------------------------
// Operations / analytics cockpit. Distinct from the realistic 3D yard page:
//   - 3D Yard page  → "what does the yard look like" (camera, equipment GPS,
//                     tier control, realistic textures).
//   - Command Center → "what's happening" (analytics, dwell distribution,
//                     hot blocks, process flow, alerts, filters, search,
//                     2D schematic map with containers placed in slots).
//
// All data is sourced from the existing backend endpoints (no synthetic
// fields, no costs, no vessel cutoffs).

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiRefreshCw, FiBell, FiBarChart2, FiHome, FiTruck,
} from "react-icons/fi";

import Navbar from "../../../components/layout/Navbar";
import {
  useGetContainerLiveStatusQuery,
  useGetYard3dSlotListQuery,
  useGetLocationSlotsQuery,
} from "../../../store/api/ymsApi";
import { useLiveEquipment } from "../live/useLiveEquipment";

// Parse "lat lng,lat lng,..." (ESS_MST_SLOT.LatLong format) into [{lat,lng}, ...]
function parseSlotLatLong(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .trim()
    .split(",")
    .map((tok) => {
      const parts = tok.trim().split(/\s+/);
      if (parts.length < 2) return null;
      const a = parseFloat(parts[0]);
      const b = parseFloat(parts[1]);
      if (!isFinite(a) || !isFinite(b)) return null;
      return Math.abs(a) < Math.abs(b) ? { lat: a, lng: b } : { lat: b, lng: a };
    })
    .filter(Boolean);
}

// Build the { blocks: { [blockName]: { id, minLat, maxLat, minLng, maxLng,
// rows, cols, slotCount } } } shape YardMap2D.jsx expects, from raw
// GET_ESS_MST_SLOT_LIST rows — replaces the old static slot-geofence-mumbai.json.
function buildGeofenceFromSlots(slotRows) {
  if (!Array.isArray(slotRows) || slotRows.length === 0) return null;

  const byBlock = new Map();
  slotRows.forEach((row) => {
    const blockName = String(row?.BlockName ?? row?.BLOCKNAME ?? "").trim();
    const rowLabel = String(row?.Row ?? row?.ROW ?? "").trim();
    const colDigits = String(row?.Column ?? row?.COLUMN ?? "").replace(/\D/g, "");
    const colNum = colDigits ? Number(colDigits) : NaN;
    const polygon = parseSlotLatLong(String(row?.LatLong ?? row?.LATLONG ?? ""));
    if (!blockName || polygon.length < 3) return;
    if (!byBlock.has(blockName)) byBlock.set(blockName, []);
    byBlock.get(blockName).push({ rowLabel, colNum, polygon });
  });

  if (!byBlock.size) return null;

  const blocks = {};
  byBlock.forEach((slots, blockName) => {
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    const rowSet = new Set();
    const colSet = new Set();
    slots.forEach((s) => {
      if (s.rowLabel) rowSet.add(s.rowLabel);
      if (Number.isFinite(s.colNum)) colSet.add(s.colNum);
      s.polygon.forEach((p) => {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
      });
    });

    blocks[blockName] = {
      id: blockName,
      minLat, maxLat, minLng, maxLng,
      rows: Array.from(rowSet).sort(),
      cols: Array.from(colSet).sort((a, b) => a - b),
      slotCount: slots.length,
    };
  });

  return { blocks };
}

import { T } from "../command/theme";
import { Dot, Panel } from "../command/primitives";
import { buildAlerts, groupByStatus, groupBySizeType } from "../command/alerts";

import AlertPanel from "../command/AlertPanel";
import ContainerDrawer from "../command/ContainerDrawer";
import KpiStrip from "../command/KpiStrip";
import FilterPanel, { applyFilters } from "../command/FilterPanel";
import CommandSearch from "../command/CommandSearch";
import YardMap2D from "../command/YardMap2D";
import { SizeBreakdown } from "../command/BreakdownPanel";
import {
  DwellDistribution, HotBlocks, ProcessFlow, StatusDonut,
} from "../command/AnalyticsPanels";

// ── helpers (kept private) ────────────────────────────────────────────────

const grab = (row, ...keys) => {
  for (const k of keys) {
    if (row?.[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return undefined;
};

function mapLiveRow(row, idx) {
  const containerNo = String(grab(row, "CONTAINER_NO", "Cont_No", "ContainerNo") || "").trim();
  const sizeCode = String(grab(row, "CONTAINER_SIZE", "Cont_Size", "Size", "ContainerSize") || "").toUpperCase();
  const typeCode = String(grab(row, "CONTAINER_TYPE", "Cont_Type", "Type", "ContainerType") || "GP").toUpperCase();
  const rawStatus = String(grab(row, "INVENTORY_STATUS", "STATUS", "Cont_Status") || "").toLowerCase();
  const process = String(grab(row, "CONTAINER_PROCESS", "PROCESS", "TRANSACTION_TYPE") || "");

  const size = sizeCode.includes("20") ? "20ft" : "40ft";
  const type = ["GP", "HC", "RF", "OT", "FR"].includes(typeCode) ? typeCode : "GP";

  let status = "full";
  if (rawStatus.includes("empty")) status = "empty";
  else if (rawStatus.includes("damage")) status = "damaged";
  else if (rawStatus.includes("hold")) status = "hold";
  else if (rawStatus.includes("reefer") || type === "RF") status = "reefer";
  else if (rawStatus.includes("hazmat") || rawStatus.includes("hazard")) status = "hazmat";

  const block = String(grab(row, "BLOCK_NAME", "BLOCK", "Block_Name", "BlockName") || "").trim();
  const rowKey = String(grab(row, "ROW_NO", "ROW", "Row_No", "RowNo") || "").trim();
  const colRaw = String(grab(row, "COLUMN_NAME", "SLOT", "Column_Name", "ColumnName", "SLOT_NO") || "").trim();
  const col = colRaw.replace(/\D/g, "") || colRaw;
  const tier = parseInt(grab(row, "STACK_NO", "TIER", "Stack_No", "StackNo"), 10) || 1;
  const location = grab(row, "MASTERTABLE", "LOCATION_NAME", "LOCATION", "ContainerLocation") || "";

  return {
    id: `LS-${grab(row, "INVENTORY_ID", "ID") ?? idx}`,
    containerNo, block, row: rowKey, col, tier,
    status, size, type, process, location,
    slotName: grab(row, "SLOTNAME", "SLOT_NAME"),
    gateInDate: grab(row, "GATE_IN_DATE"),
    lastMovedDate: grab(row, "LAST_MOVED_DATE", "TOSS_IN_DATE"),
    dwellDays: Number(grab(row, "DWELL_DAYS")) || 0,
    lat: Number(grab(row, "OFFLOAD_LAT", "LAT", "LATITUDE")) || null,
    lng: Number(grab(row, "OFFLOAD_LON", "LON", "LONGITUDE")) || null,
    equipment: grab(row, "OFFLOAD_EQP", "EQUIPMENT"),
    raw: row,
  };
}

// ── main page ────────────────────────────────────────────────────────────

export default function YardCommandCenter() {
  const [searchParams] = useSearchParams();

  const [query, setQuery] = useState(() => searchParams.get("highlight") ?? "");
  const [filters, setFilters] = useState({ status: "All", size: "All", dwell: "All" });

  const [selected, setSelected] = useState(null);

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [showLabels, setShowLabels] = useState(false);

  const { data: geofenceSourceResp } = useGetLocationSlotsQuery();
  const geofence = useMemo(
    () => buildGeofenceFromSlots(geofenceSourceResp?.data),
    [geofenceSourceResp]
  );

  const { data: liveResp, isFetching, refetch } = useGetContainerLiveStatusQuery("", {
    pollingInterval: 30_000, refetchOnFocus: true, refetchOnReconnect: true,
  });
  const { data: slotListResp } = useGetYard3dSlotListQuery(undefined, { pollingInterval: 30_000 });

  const positionMap = useMemo(() => {
    const rows = Array.isArray(slotListResp?.data) ? slotListResp.data : [];
    const m = new Map();
    for (const r of rows) {
      const no = String(r.CONTAINER_NO ?? r.OCR_CONTAINER_NO ?? "").trim().toUpperCase();
      if (!no) continue;
      const locName = String(r.LOCATION_NAME ?? r.ContainerLocationName ?? "");
      const parts = locName.split(":").map((p) => p.trim()).filter(Boolean);
      m.set(no, {
        block: r.BLOCK_NAME ?? parts[0] ?? "",
        row: r.ROW_NO ?? parts[1] ?? "",
        col: r.COLUMN_NAME ?? parts[2] ?? "",
        tier: Number(r.STACK_NO) || 1,
        location: locName,
      });
    }
    return m;
  }, [slotListResp]);

  const containers = useMemo(() => {
    const liveRows = Array.isArray(liveResp?.data) ? liveResp.data : [];
    const slotRows = Array.isArray(slotListResp?.data) ? slotListResp.data : [];
    const liveNos = new Set();
    const live = liveRows.map((row, idx) => {
      const c = mapLiveRow(row, idx);
      liveNos.add(c.containerNo.toUpperCase());
      if (!c.block) {
        const pos = positionMap.get(c.containerNo.toUpperCase());
        if (pos) return { ...c, ...pos };
      }
      return c;
    });
    const posOnly = slotRows
      .filter((r) => {
        const no = String(r.CONTAINER_NO ?? r.OCR_CONTAINER_NO ?? "").trim().toUpperCase();
        return no && !liveNos.has(no);
      })
      .map((r, idx) => {
        const locName = String(r.LOCATION_NAME ?? r.ContainerLocationName ?? "");
        const parts = locName.split(":").map((p) => p.trim()).filter(Boolean);
        const sizeCode = String(r.CONTAINER_SIZE ?? "").toUpperCase();
        const typeCode = String(r.CONTAINER_TYPE ?? "GP").toUpperCase();
        const rawStatus = String(r.INVENTORY_STATUS ?? "").toLowerCase();
        let status = "full";
        if (rawStatus.includes("empty")) status = "empty";
        else if (rawStatus.includes("damage")) status = "damaged";
        else if (rawStatus.includes("hold")) status = "hold";
        else if (rawStatus.includes("reefer") || typeCode === "RF") status = "reefer";
        else if (rawStatus.includes("hazmat")) status = "hazmat";
        return {
          id: `SL-${idx}`,
          containerNo: String(r.CONTAINER_NO ?? r.OCR_CONTAINER_NO ?? ""),
          block: r.BLOCK_NAME ?? parts[0] ?? "",
          row: r.ROW_NO ?? parts[1] ?? "",
          col: r.COLUMN_NAME ?? parts[2] ?? "",
          tier: Number(r.STACK_NO) || 1,
          location: locName,
          status,
          size: sizeCode.includes("20") ? "20ft" : "40ft",
          type: ["GP", "HC", "RF", "OT", "FR"].includes(typeCode) ? typeCode : "GP",
          process: "",
          dwellDays: Number(r.DWELL_DAYS) || 0,
          lat: null, lng: null, equipment: null, raw: r,
        };
      });
    return [...live, ...posOnly];
  }, [liveResp, slotListResp, positionMap]);

  const visible = useMemo(() => applyFilters(containers, filters), [containers, filters]);

  const statusCounts = useMemo(() => groupByStatus(containers), [containers]);
  const sizeGroups   = useMemo(() => groupBySizeType(containers), [containers]);
  const alerts       = useMemo(() => buildAlerts(containers),   [containers]);

  const stats = useMemo(() => {
    const total = containers.length;
    const capacity = geofence
      ? Object.values(geofence.blocks).reduce((a, b) => a + (b.slotCount || 0) * 4, 0)
      : 0;
    let overdwell = 0, sumDwell = 0, withDwell = 0;
    for (const c of containers) {
      if (c.dwellDays > 7) overdwell++;
      if (c.dwellDays > 0) { sumDwell += c.dwellDays; withDwell++; }
    }
    const occupancy = capacity ? Math.round((total / capacity) * 100) : 0;
    const avgDwellDays = withDwell ? Math.round(sumDwell / withDwell) : 0;
    const today = new Date().toISOString().slice(0, 10);
    let gateInToday = 0, gateOutToday = 0;
    for (const c of containers) {
      if (typeof c.gateInDate === "string" && c.gateInDate.startsWith(today)) gateInToday++;
      if (typeof c.lastMovedDate === "string" && c.lastMovedDate.startsWith(today)) gateOutToday++;
    }
    return { total, occupancy, overdwell, avgDwellDays, gateInToday, gateOutToday };
  }, [containers, geofence]);

  // Live equipment — summary only (the 3D page is where you watch their GPS)
  const { equipment: liveEquipment } = useLiveEquipment({ pollingInterval: 15_000 });
  const equipCounts = useMemo(() => {
    const c = { total: liveEquipment.length, moving: 0, idle: 0, offline: 0 };
    for (const e of liveEquipment) {
      if (e.status === "moving") c.moving++;
      else if (e.status === "idle" || e.status === "ignition_off") c.idle++;
      else c.offline++;
    }
    return c;
  }, [liveEquipment]);

  useEffect(() => {
    const h = searchParams.get("highlight");
    if (!h || !containers.length) return;
    const match = containers.find((c) => c.containerNo.toUpperCase() === h.toUpperCase());
    if (match) {
      setSelected(match);
      setQuery(match.containerNo);
    }
  }, [containers, searchParams]);

  const jumpToAlert = (a) => {
    const target = containers.find((c) => c.id === a.containerId);
    if (target) {
      setSelected(target);
      setQuery(target.containerNo);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: T.bg, color: T.text }}>
      {/* Hide visible scrollbars while keeping scroll functional */}
      <style>{`
        .ycc-no-scroll::-webkit-scrollbar { width: 0; height: 0; display: none; }
        .ycc-no-scroll { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>

      <Navbar />

      {/* Top bar */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b"
        style={{ background: T.card, borderColor: T.border }}
      >
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${T.cyan} 0%, ${T.blue} 100%)`,
              color: "#fff",
              boxShadow: `0 6px 16px ${T.cyan}44`,
            }}
          >
            <FiHome size={17} />
          </div>
          <div>
            <div className="text-[14px] font-black tracking-tight" style={{ color: T.text }}>
              Yard Command Center
            </div>
            <div className="text-[9px] font-bold uppercase tracking-[0.22em] flex items-center gap-1.5" style={{ color: T.textMute }}>
              <Dot color={T.emerald} pulse size={5} />
              Live · Operations Analytics
            </div>
          </div>
        </div>

        <CommandSearch
          containers={containers}
          query={query}
          onQueryChange={setQuery}
          onPick={setSelected}
        />


        <div className="ml-auto flex items-center gap-2">
          <TopButton
            label="Insights"
            icon={FiBarChart2}
            active={leftOpen}
            color={T.cyan}
            onClick={() => setLeftOpen((v) => !v)}
          />
          <TopButton
            label="Alerts"
            icon={FiBell}
            active={rightOpen}
            color={T.red}
            badge={alerts.length}
            onClick={() => setRightOpen((v) => !v)}
          />
          <button
            onClick={refetch}
            disabled={isFetching}
            className="h-9 w-9 rounded-lg flex items-center justify-center transition-all border disabled:opacity-50"
            style={{ background: T.card, color: T.text, borderColor: T.border }}
            title="Refresh"
          >
            <FiRefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="shrink-0 px-4 py-2.5 border-b" style={{ background: T.bg, borderColor: T.border }}>
        <KpiStrip stats={stats} />
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* LEFT — analytics (NOT in 3D page) */}
        {leftOpen && (
          <aside
            className="ycc-no-scroll shrink-0 flex flex-col gap-2.5 overflow-y-auto border-r"
            style={{ width: 300, background: T.bg, borderColor: T.border, padding: 12 }}
          >
            <StatusDonut statusCounts={statusCounts} />
            <DwellDistribution containers={containers} />
            <SizeBreakdown sizes={sizeGroups} />
            <ProcessFlow containers={containers} />
          </aside>
        )}

        {/* CENTER — 2D schematic yard map */}
        <main className="relative flex-1 flex flex-col overflow-hidden min-w-0" style={{ background: T.bg2 }}>
          <div className="flex-1 relative overflow-hidden" style={{ background: T.bg2 }}>
            {!geofence && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div
                  className="w-12 h-12 rounded-full border-2 animate-spin"
                  style={{ borderColor: T.border, borderTopColor: T.cyan }}
                />
                <span className="text-[12px] font-medium" style={{ color: T.textMute }}>
                  Loading yard layout…
                </span>
              </div>
            )}
            {geofence && (
              <>
                <YardMap2D
                  geofence={geofence}
                  containers={visible}
                  activeStatus={filters.status}
                  selectedId={selected?.id}
                  onSelectContainer={setSelected}
                  showLabels={showLabels}
                />
                {/* Block label toggle */}
                <button
                  onClick={() => setShowLabels((v) => !v)}
                  className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 h-8 rounded-full border transition-all hover:shadow-md text-[11px] font-bold"
                  style={{
                    background: showLabels ? T.cyan + "33" : T.card + "ee",
                    borderColor: showLabels ? T.cyan : T.border,
                    color: showLabels ? T.cyan : T.textDim,
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {showLabels ? "Hide Labels" : "Show Labels"}
                </button>
              </>
            )}

            {/* Bottom-right floating action: jump to realistic 3D yard */}
            <a
              href="/dashboard/3d-visualization"
              className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-3 h-8 rounded-full border transition-all hover:shadow-md"
              style={{
                background: T.card + "ee",
                backdropFilter: "blur(8px)",
                borderColor: T.border,
                color: T.indigo,
                textDecoration: "none",
                boxShadow: T.shadow,
              }}
              title="Open the realistic 3D yard view"
            >
              <span className="text-[10px] font-black uppercase tracking-wider">3D View</span>
              <span style={{ color: T.textMute }}>→</span>
            </a>

            {/* Live status pill */}
            <div
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2.5 px-3 h-8 rounded-full border"
              style={{
                background: T.card + "ee",
                backdropFilter: "blur(8px)",
                borderColor: T.border,
                boxShadow: T.shadow,
              }}
            >
              <Dot color={T.emerald} pulse size={7} />
              <span className="text-[10px] font-bold tracking-wide" style={{ color: T.emerald }}>LIVE</span>
              <span className="text-[10px]" style={{ color: T.textMute }}>·</span>
              <span className="text-[10px] font-mono" style={{ color: T.text }}>
                {visible.length} of {stats.total} ctrs
              </span>
              <span className="text-[10px]" style={{ color: T.textMute }}>·</span>
              <span className="text-[10px] font-mono" style={{ color: T.text }}>
                {equipCounts.total} eqp
              </span>
            </div>
          </div>
        </main>

        {/* RIGHT — alerts + hot blocks + filters + equipment summary */}
        {rightOpen && (
          <aside
            className="ycc-no-scroll shrink-0 flex flex-col gap-2.5 overflow-y-auto border-l"
            style={{ width: 320, background: T.bg, borderColor: T.border, padding: 12 }}
          >
            <Panel title="Filters" icon={FiBarChart2} accent={T.indigo}>
              <FilterPanel
                filters={filters}
                onChange={setFilters}
                onReset={() => setFilters({ status: "All", size: "All", dwell: "All" })}
              />
            </Panel>

            <HotBlocks
              containers={containers}
              onClickBlock={(b) => setQuery(b)}
            />

            <Panel title="Reach Stackers" icon={FiTruck} accent={T.blue}>
              <div className="grid grid-cols-3 gap-2">
                <EquipStat color={T.emerald} label="Moving"  value={equipCounts.moving} />
                <EquipStat color={T.amber}   label="Idle"    value={equipCounts.idle} />
                <EquipStat color={T.red}     label="Offline" value={equipCounts.offline} />
              </div>
              <div className="mt-2 text-[10px] text-center font-bold" style={{ color: T.textMute }}>
                {equipCounts.total} live unit{equipCounts.total === 1 ? "" : "s"}
                <span className="block text-[9px] font-normal mt-0.5" style={{ color: T.textMute }}>
                  Track GPS in 3D View →
                </span>
              </div>
            </Panel>

            <Panel title="Alerts" icon={FiBell} accent={T.red} className="flex-1 min-h-0">
              <AlertPanel alerts={alerts} onJumpToContainer={jumpToAlert} />
            </Panel>
          </aside>
        )}
      </div>

      <ContainerDrawer container={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function TopButton({ label, icon: Icon, active, color, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className="h-9 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all border"
      style={{
        background: active ? `${color}15` : T.card,
        color: active ? color : T.textDim,
        borderColor: active ? `${color}55` : T.border,
      }}
    >
      <Icon size={11} />
      {label}
      {badge != null && badge > 0 && (
        <span
          className="ml-0.5 px-1 rounded-md text-[9px] font-black"
          style={{ background: color, color: "#fff" }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function EquipStat({ color, label, value }) {
  return (
    <div
      className="rounded-lg border px-2 py-1.5 text-center"
      style={{ background: T.card, borderColor: T.border }}
    >
      <div className="font-mono tabular-nums font-black text-[16px]" style={{ color }}>{value}</div>
      <div className="text-[8.5px] font-black uppercase tracking-widest" style={{ color: T.textMute }}>{label}</div>
    </div>
  );
}
