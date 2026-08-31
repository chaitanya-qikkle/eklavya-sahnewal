import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { RoadPainterUI } from "../tools/RoadPainter";
import { YardBuilderUI, wallsFromFences, buildingsFromLayout, newId } from "../tools/YardBuilder";
import { useSearchParams } from "react-router-dom";
import Navbar from "../../../components/layout/Navbar";
import YardScene from "../scene/YardScene";
import { CameraSwitcher, RouteProgress } from "../nav/CameraSwitcher";
import DownloadDesktopApp, { DesktopBadge } from "../components/DownloadDesktopApp";
import { useGetContainerLiveStatus3dQuery, useGetLocationSlotsQuery } from "../../../store/api/ymsApi";
import { buildGeofenceFromSlotList } from "../scene/buildGeofenceFromSlotList";
import {
  FiSearch, FiX, FiRefreshCw, FiPackage, FiMapPin,
  FiActivity, FiLayers, FiBox, FiClock,
  FiTruck, FiCompass, FiAlertTriangle, FiSliders,
  FiChevronLeft, FiChevronRight, FiZap, FiNavigation, FiTag,
} from "react-icons/fi";
import { MdLockOpen, MdLock } from "react-icons/md";
import { useLiveEquipment } from "../live/useLiveEquipment";
import { createYardProjection, mapLatLngToYard } from "../live/equipmentCoordinateMapper";
import { realContainerColor } from "../scene/realContainerColor";

// Industry-standard shipping-container color palette.
// These become the Three.js vertex (instance) color that tints the corrugated
// steel texture — the darker the color the more the ribs show through.
const STATUS_DEFS = {
  full:    { color: "#1B5EA8", label: "Full"    }, // ocean blue  (Maersk / MSC style)
  empty:   { color: "#6E8496", label: "Empty"   }, // weathered steel grey
  damaged: { color: "#B52318", label: "Damaged" }, // ISO signal red
  hold:    { color: "#B87200", label: "Hold"    }, // customs amber / gold
  reefer:  { color: "#B8D8E8", label: "Reefer"  }, // near-white refrigerated unit
  hazmat:  { color: "#CC3300", label: "Hazmat"  }, // IMO danger orange-red
};

const EQUIPMENT_STATUS_DEFS = {
  moving:       { color: "#22c55e", label: "Moving" },
  idle:         { color: "#f59e0b", label: "Idle" },
  offline:      { color: "#ef4444", label: "Offline" },
  ignition_off: { color: "#64748b", label: "Ign Off" },
  emergency:    { color: "#dc2626", label: "Emergency" },
};

const grab = (row, ...keys) => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return undefined;
};

const findBlockForLatLng = (blocks, lat, lng) => {
  if (!blocks || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const key of Object.keys(blocks)) {
    const b = blocks[key];
    if (lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng)
      return b.name || b.id || key;
  }
  return null;
};

function mapLiveRow(row, idx) {
  const containerNo = String(grab(row, "CONTAINER_NO", "Cont_No", "ContainerNo") || "").trim();
  const sizeCode = String(grab(row, "CONTAINER_SIZE", "Cont_Size", "Size", "ContainerSize") || "").toUpperCase();
  const typeCode = String(grab(row, "CONTAINER_TYPE", "Cont_Type", "Type", "ContainerType") || "GP").toUpperCase();
  const rawStatus = String(grab(row, "INVENTORY_STATUS", "STATUS", "Cont_Status") || "").toLowerCase();
  const process = String(grab(row, "CONTAINER_PROCESS", "PROCESS", "TRANSACTION_TYPE") || "");

  const size = sizeCode.includes("20") ? "20ft" : "40ft";
  const type = ["GP","HC","RF","OT","FR"].includes(typeCode) ? typeCode : "GP";

  let status = "full";
  if (rawStatus.includes("empty")) status = "empty";
  else if (rawStatus.includes("damage")) status = "damaged";
  else if (rawStatus.includes("hold")) status = "hold";
  else if (rawStatus.includes("reefer") || type === "RF") status = "reefer";
  else if (rawStatus.includes("hazmat") || rawStatus.includes("hazard")) status = "hazmat";

  // Prefer the slot-table values (SLOT_BLOCK, SLOT_ROW, SLOT_COL) which match
  // the geofence JSON exactly (alpha row, numeric col). Fall back to the
  // location-table values if the slot join is NULL.
  const location = grab(row, "MASTERTABLE", "LOCATION_NAME", "LOCATION", "ContainerLocation", "Last_Loc") || "";

  // Both GET_CONTAINERLIVESTATUS and ContainerLiveStatus_3D only return one
  // combined location string ("BLOCK:ROW:COL:TIER", e.g. "RAIL:A:22:1") — no
  // separate row/column columns. Parse it as the fallback when dedicated
  // SLOT_ROW/SLOT_COL fields aren't present.
  const locParts = String(location).split(":").map((p) => p.trim()).filter(Boolean);
  const [locBlock, locRow, locCol, locTier] = locParts;

  // ContainerLiveStatus_3D's SlotId is a direct FK into ESS_MST_LOCATION —
  // when present, this is the exact placement join (see locateContainer),
  // avoiding the overlap caused by ambiguous Last_Loc string parsing.
  const slotId = grab(row, "SlotId", "SLOT_ID", "SlotID");

  // Note: BLOCK_NAME/BlockName from GET_CONTAINERLIVESTATUS is the whole
  // combined location string (see comment above), not a bare block code —
  // parsed locBlock takes priority when a dedicated SLOT_BLOCK is absent.
  const block = String(
    grab(row, "SLOT_BLOCK") || locBlock || grab(row, "BLOCK_NAME", "BLOCK", "Block_Name", "BlockName") || ""
  ).trim();
  const rowKey = String(
    grab(row, "SLOT_ROW", "ROW_NO", "ROW", "Row_No", "RowNo") || locRow || ""
  ).trim();
  const colRaw = String(
    grab(row, "SLOT_COL", "COLUMN_NAME", "SLOT", "Column_Name", "ColumnName", "SLOT_NO") || locCol || ""
  ).trim();
  const col = colRaw.replace(/\D/g, "") || colRaw;
  const tier = parseInt(grab(row, "STACK_NO", "TIER", "Stack_No", "StackNo") ?? locTier, 10) || 1;

  return {
    id: `LS-${grab(row, "INVENTORY_ID", "ID") ?? idx}`,
    containerNo, block, row: rowKey, col, tier,
    status, size, type, process, location,
    slotId,
    slotName: grab(row, "SLOTNAME", "SLOT_NAME"),
    gateInDate: grab(row, "GATE_IN_DATE"),
    lastMovedDate: grab(row, "LAST_MOVED_DATE", "TOSS_IN_DATE"),
    dwellDays: Number(grab(row, "DWELL_DAYS")) || 0,
    lat: Number(grab(row, "OFFLOAD_LAT", "LAT", "LATITUDE")) || null,
    lng: Number(grab(row, "OFFLOAD_LON", "LON", "LONGITUDE")) || null,
    equipment: grab(row, "OFFLOAD_EQP", "EQUIPMENT"),
    lineName: grab(row, "LINE_NAME") || "",
    trailerNo: grab(row, "TRAILER_NO") || "",
    commodity: grab(row, "COMMODITY") || "",
    igmNo: grab(row, "IGM_NO") || "",
    tat: grab(row, "TIME_IN_YARD") || "",
    yardName: grab(row, "MASTERTABLE", "YARD_NAME") || "",
    raw: row,
  };
}

// Real shipping-line livery colours from ISO 6346 owner-code prefix.
// Status overrides still win for hazmat / hold so operators spot issues fast.
const colorForContainer = (c) => realContainerColor(c);

// ── small atoms ──────────────────────────────────────────────────────────

const Dot = ({ color, pulse }) => (
  <span className="relative flex h-2 w-2 shrink-0">
    {pulse && <span className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping" style={{ background: color }} />}
    <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: color }} />
  </span>
);

const SectionLabel = ({ children, action }) => (
  <div className="flex items-center justify-between mb-1.5">
    <div className="text-[9px] uppercase tracking-[0.22em] text-slate-400 font-bold">{children}</div>
    {action}
  </div>
);

// KPI card — `dark` renders it for a dark/navy container background
const KpiChip = ({ icon: Icon, value, label, color = "#0e4a78", dark = false }) => (
  <div className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 border relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
    style={dark ? {
      background: "rgba(255,255,255,0.06)",
      borderColor: "rgba(255,255,255,0.12)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
    } : {
      background: `linear-gradient(135deg, ${color}12 0%, ${color}05 60%, transparent 100%)`,
      borderColor: `${color}2e`,
      boxShadow: `0 1px 2px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.5)`,
    }}>
    <div className="absolute inset-0 opacity-[0.04] transition-opacity duration-200 group-hover:opacity-[0.08]"
      style={{ background: `radial-gradient(circle at 0% 50%, ${color}, transparent 70%)` }} />
    <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: color, opacity: 0.7 }} />
    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
      style={{ background: `linear-gradient(135deg, ${color}28, ${color}14)`, color, boxShadow: `inset 0 0 0 1px ${color}26` }}>
      <Icon size={15} />
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-[20px] font-black font-mono leading-none tabular-nums" style={{ color }}>{value}</div>
      <div className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${dark ? "text-white/50" : "text-slate-400"}`}>{label}</div>
    </div>
  </div>
);

const StatusPill = ({ color, label, count, active, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all border text-left hover:bg-slate-100/70"
    style={{
      background: active ? `${color}16` : "transparent",
      borderColor: active ? `${color}66` : "transparent",
      boxShadow: active ? `0 1px 3px ${color}26` : "none",
    }}
  >
    <Dot color={color} pulse={active} />
    <span className="text-[11px] font-semibold flex-1 truncate" style={{ color: active ? color : "#64748b" }}>{label}</span>
    <span className="text-[11px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded-md"
      style={{ color: active ? color : "#94a3b8", background: active ? `${color}12` : "transparent" }}>{count}</span>
  </button>
);

const DetailRow = ({ label, value, mono = true }) => (
  <div>
    <div className="text-[9px] uppercase tracking-[0.14em] text-slate-400 font-bold">{label}</div>
    <div className={`text-[11.5px] text-slate-800 font-semibold truncate ${mono ? "font-mono" : ""}`}>{value || "—"}</div>
  </div>
);

const EqpRow = ({ item, selected, onSelect }) => {
  const def = EQUIPMENT_STATUS_DEFS[item.status] || EQUIPMENT_STATUS_DEFS.idle;
  return (
    <button
      onClick={() => onSelect(item.id)}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-left group"
      style={{
        background: selected ? `${def.color}14` : "transparent",
        borderLeft: `3px solid ${selected ? def.color : "transparent"}`,
        paddingLeft: selected ? "10px" : "12px",
      }}
    >
      <Dot color={def.color} pulse={item.status === "moving"} />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold truncate" style={{ color: selected ? def.color : "#334155" }}>{item.name}</div>
        <div className="text-[9.5px] text-slate-400 truncate">{item.type}</div>
      </div>
      {item.isCarrying && (
        <span className="shrink-0 text-[8.5px] font-black px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200">LOCK</span>
      )}
      {!item.isCarrying && item.isUnlockPacket && (
        <span className="shrink-0 text-[8.5px] font-black px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-200">UNL</span>
      )}
    </button>
  );
};

// Tab pill inside a sidebar
const TabPill = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wide rounded-md transition-all"
    style={{
      background: active ? "#0e4a78" : "transparent",
      color: active ? "#fff" : "#94a3b8",
    }}
  >
    {label}
  </button>
);

// Sidebar — glass panel with gradient header accent
// On mobile (≤767px) renders as a bottom-sheet overlay instead of inline panel
const Sidebar = ({ side = "left", open, onToggle, tabs, activeTab, onTabChange, badge = {}, children, isMobile = false }) => {
  const ChevronOpen  = side === "left" ? FiChevronLeft  : FiChevronRight;
  const ChevronClose = side === "left" ? FiChevronRight : FiChevronLeft;
  const Chevron = open ? ChevronOpen : ChevronClose;
  const border = side === "left"
    ? { borderRight: "1px solid #e2e8f0" }
    : { borderLeft:  "1px solid #e2e8f0" };

  // Mobile: render as bottom sheet overlay
  if (isMobile) {
    if (!open) return null;
    return (
      <>
        {/* Backdrop */}
        <div className="fixed inset-0 z-40 bg-black/40" onClick={onToggle} />
        {/* Sheet */}
        <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: "70vh", background: "#f8fafc" }}>
          {/* Header */}
          <div className="shrink-0 px-4 pt-3 pb-2.5" style={{ background: "linear-gradient(135deg, #0e4a78 0%, #1565a0 100%)" }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-1 rounded-full bg-white/40 mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
              <div className="text-[11px] font-black text-white/90 uppercase tracking-widest flex-1 mt-1">
                {side === "left" ? "Yard Control" : "Live Equipment"}
              </div>
              <button onClick={onToggle}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/15 hover:bg-white/25 transition-colors">
                <FiX size={13} className="text-white" />
              </button>
            </div>
            {tabs && tabs.length > 1 && (
              <div className="flex gap-1 p-0.5 rounded-lg bg-white/10">
                {tabs.map(t => (
                  <button key={t.key} onClick={() => onTabChange(t.key)}
                    className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wide rounded-md transition-all"
                    style={{
                      background: activeTab === t.key ? "rgba(255,255,255,0.92)" : "transparent",
                      color: activeTab === t.key ? "#0e4a78" : "rgba(255,255,255,0.65)",
                    }}>
                    {badge[t.key] > 0 ? `${t.label} (${badge[t.key]})` : t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">{children}</div>
        </div>
      </>
    );
  }

  if (!open) {
    return (
      <div className="h-full shrink-0 flex flex-col items-center pt-2.5 gap-1"
        style={{ width: 36, ...border, background: "#f8fafc" }}>
        <button onClick={onToggle}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#0e4a7814] transition-colors">
          <Chevron size={13} style={{ color: "#0e4a78" }} />
        </button>
      </div>
    );
  }

  return (
    <div className="h-full shrink-0 flex flex-col overflow-hidden"
      style={{ width: 276, ...border, background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)" }}>
      {/* Header accent */}
      <div className="shrink-0 px-3 pt-3 pb-2.5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0b3a60 0%, #0e4a78 45%, #1565a0 100%)", boxShadow: "0 2px 10px rgba(11,58,96,0.35)" }}>
        {/* sheen */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(120% 80% at 0% 0%, rgba(255,255,255,0.16), transparent 60%)" }} />
        {/* bottom accent line */}
        <div className="absolute left-0 right-0 bottom-0 h-[2px]"
          style={{ background: "linear-gradient(90deg, transparent, #38bdf8 50%, transparent)" }} />
        <div className="flex items-center gap-1.5 mb-2 relative">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <div className="text-[10px] font-black text-white uppercase tracking-widest flex-1 drop-shadow">
            {side === "left" ? "Yard Control" : "Live Equipment"}
          </div>
          <button onClick={onToggle}
            className="w-6 h-6 rounded-md flex items-center justify-center bg-white/10 hover:bg-white/25 transition-colors">
            <Chevron size={12} className="text-white/80" />
          </button>
        </div>
        {tabs && tabs.length > 1 && (
          <div className="flex gap-1 p-0.5 rounded-lg bg-white/10">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => onTabChange(t.key)}
                className="flex-1 py-1 text-[9.5px] font-bold uppercase tracking-wide rounded-md transition-all"
                style={{
                  background: activeTab === t.key ? "rgba(255,255,255,0.92)" : "transparent",
                  color: activeTab === t.key ? "#0e4a78" : "rgba(255,255,255,0.65)",
                }}
              >
                {badge[t.key] > 0 ? `${t.label} (${badge[t.key]})` : t.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3.5">
        {children}
      </div>
    </div>
  );
};

// ── main page ────────────────────────────────────────────────────────────
// NOTE: dxfLayout (buildings/roads/walls) still comes from the static DXF
// export — GET_ESS_MST_SLOT_LIST has no equivalent for those. geofence
// (block/slot boundaries) now comes from the live DB via buildGeofenceFromSlotList.
const SAHNEWAL_SITE = { key: "sahnewal", label: "Sahnewal", layout: "/yard-layout-sahnewal.json" };

export default function YardLiveStatus3D() {
  const [searchParams] = useSearchParams();
  const [dxfLayout, setDxfLayout] = useState(null);

  const { data: slotListResp } = useGetLocationSlotsQuery();
  const geofence = useMemo(
    () => buildGeofenceFromSlotList(slotListResp?.data),
    [slotListResp]
  );

  // Road Painter
  const [roadPainterActive, setRoadPainterActive] = useState(false);
  const [roadPoints, setRoadPoints] = useState([]);
  const handleAddRoadPoint = useCallback((pt) => setRoadPoints((p) => [...p, pt]), []);

  // Yard Builder — wall/building placement + editing (see tools/YardBuilder.jsx)
  const [yardBuilderMode, setYardBuilderMode] = useState("off");
  const [yardBuilderWalls, setYardBuilderWalls] = useState([]);
  const [yardBuilderBuildings, setYardBuilderBuildings] = useState([]);
  const [yardBuilderDrawPoints, setYardBuilderDrawPoints] = useState([]);
  const [yardBuilderDragStart, setYardBuilderDragStart] = useState(null);
  const [yardBuilderDragCurrent, setYardBuilderDragCurrent] = useState(null);
  const [yardBuilderSelection, setYardBuilderSelection] = useState(null);
  const yardBuilderSeededRef = useRef(false);

  const handleSceneGeometryReady = useCallback((geom) => {
    if (yardBuilderSeededRef.current) return; // seed once — further edits are user-driven
    yardBuilderSeededRef.current = true;
    setYardBuilderWalls(wallsFromFences(geom.fences));
    setYardBuilderBuildings(buildingsFromLayout(geom.buildings));
  }, []);

  const handleYardBuilderAddDrawPoint = useCallback((pt) => setYardBuilderDrawPoints((p) => [...p, pt]), []);
  const handleYardBuilderDragStart = useCallback((pt) => { setYardBuilderDragStart(pt); setYardBuilderDragCurrent(pt); }, []);
  const handleYardBuilderDragMove = useCallback((pt) => setYardBuilderDragCurrent(pt), []);
  const handleYardBuilderDragEnd = useCallback(() => {
    setYardBuilderDragStart(start => {
      setYardBuilderDragCurrent(current => {
        if (start && current) {
          const w = Math.abs(current.x - start.x), d = Math.abs(current.z - start.z);
          if (w > 0.5 && d > 0.5) {
            setYardBuilderBuildings(bs => [...bs, {
              id: newId(),
              x: (start.x + current.x) / 2, z: (start.z + current.z) / 2,
              w, d, rotY: 0, label: "Building",
            }]);
          }
        }
        return null;
      });
      return null;
    });
  }, []);

  // Road Network state — loaded JSON stored here, converted after equipmentProjection is ready
  const [roadNetwork, setRoadNetwork] = useState(null);

  const handleLoadRoadNetwork = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        if (json.segments && json.points) setRoadNetwork(json);
      } catch { /* ignore bad file */ }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const [search, setSearch] = useState(() => searchParams.get("highlight") ?? "");
  const [filterStatus, setFilterStatus] = useState("All");
  const [maxTier, setMaxTier] = useState(6);
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);
  const [followEquipmentMode, setFollowEquipmentMode] = useState(false);
  const [lowPerfMode, setLowPerfMode] = useState(false);
  const [showBlockLabels, setShowBlockLabels] = useState(false);
  const [directionMode, setDirectionMode] = useState(false);
  const [directionWalking, setDirectionWalking] = useState(false);
  const [directionArrived, setDirectionArrived] = useState(false);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const [leftOpen,  setLeftOpen]  = useState(true);
  const [leftTab,   setLeftTab]   = useState("yard");
  const [rightOpen, setRightOpen] = useState(true);
  const [rightTab,  setRightTab]  = useState("machines");

  // Mobile overlay open states (separate from desktop inline open)
  const [mobileLeftOpen,  setMobileLeftOpen]  = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);

  // ── Live GPS — my position ────────────────────────────────────────────────
  const [myGpsPos, setMyGpsPos]   = useState(null); // {lat, lng}
  const [gpsOn, setGpsOn]         = useState(false);
  const [gpsAcc, setGpsAcc]       = useState(null);
  const [gpsErr, setGpsErr]       = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [manualLat, setManualLat]  = useState("");
  const [manualLng, setManualLng]  = useState("");
  const gpsWatchRef               = React.useRef(null);
  // Rolling buffer for GPS smoothing (last 3 fixes averaged to reduce jitter)
  const gpsBufferRef              = React.useRef([]);

  const startGps = React.useCallback(() => {
    if (!navigator.geolocation) {
      setGpsErr("GPS not available — use manual input below");
      setShowManual(true);
      return;
    }
    setGpsErr(null); setGpsOn(true);
    navigator.permissions?.query({ name: "geolocation" }).then(r => {
      if (r.state === "denied") {
        setGpsErr("Location permission denied in browser — reset it in address bar 🔒 or use manual input");
        setGpsOn(false); setShowManual(true);
      }
    }).catch(() => {});
    gpsBufferRef.current = [];
    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        // Smooth GPS jitter by averaging the last 3 fixes (reduces ±30m drift to ±10m)
        const buf = gpsBufferRef.current;
        buf.push({ lat: p.coords.latitude, lng: p.coords.longitude });
        if (buf.length > 3) buf.shift();
        const smoothed = {
          lat: buf.reduce((s, f) => s + f.lat, 0) / buf.length,
          lng: buf.reduce((s, f) => s + f.lng, 0) / buf.length,
        };
        setMyGpsPos(smoothed);
        setGpsAcc(Math.round(p.coords.accuracy));
        setGpsErr(null); setShowManual(false);
      },
      (e) => {
        const msg = e.code === 1 ? "Permission denied — click 🔒 in address bar → Allow Location"
                  : e.code === 2 ? "Position unavailable — try manual input"
                  : "GPS timeout — try manual input";
        setGpsErr(msg); setShowManual(true);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
  }, []);

  const stopGps = React.useCallback(() => {
    if (gpsWatchRef.current != null) navigator.geolocation.clearWatch(gpsWatchRef.current);
    gpsWatchRef.current = null;
    gpsBufferRef.current = [];
    setGpsOn(false); setMyGpsPos(null); setGpsErr(null); setGpsAcc(null); setShowManual(false);
  }, []);

  const applyManual = React.useCallback(() => {
    const lat = parseFloat(manualLat), lng = parseFloat(manualLng);
    if (!isFinite(lat) || !isFinite(lng)) { setGpsErr("Enter valid lat/lng numbers"); return; }
    setMyGpsPos({ lat, lng }); setGpsAcc(null); setGpsErr(null); setGpsOn(true); setShowManual(false);
  }, [manualLat, manualLng]);

  useEffect(() => () => { if (gpsWatchRef.current != null) navigator.geolocation.clearWatch(gpsWatchRef.current); }, []);

  useEffect(() => {
    let cancelled = false;
    const site = SAHNEWAL_SITE;
    setDxfLayout(null);
    fetch(site.layout).then(r => r.json()).catch(() => null)
      .then((dxf) => { if (!cancelled && dxf) setDxfLayout(dxf); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedEquipmentId) setFollowEquipmentMode(false);
  }, [selectedEquipmentId]);

  // Reset direction when user selects a different container
  useEffect(() => {
    setDirectionMode(false);
    setDirectionWalking(false);
    setDirectionArrived(false);
  }, [selected?.id]);

  // Auto-enable GPS when the user turns on container tracing — they
  // shouldn't have to manually flip "My Location" first.
  useEffect(() => {
    if (directionMode && !gpsOn) startGps();
  }, [directionMode, gpsOn, startGps]);

  // Cancel navigation only after a real GPS-loss event (not during the
  // initial "locating…" window after auto-start).
  const gpsLostTimer = useRef(null);
  useEffect(() => {
    if (!directionMode) { if (gpsLostTimer.current) clearTimeout(gpsLostTimer.current); return; }
    if (myGpsPos) {
      if (gpsLostTimer.current) clearTimeout(gpsLostTimer.current);
      gpsLostTimer.current = null;
      return;
    }
    // 15 s grace period for the first fix on auto-start
    if (gpsLostTimer.current) return;
    gpsLostTimer.current = setTimeout(() => {
      setDirectionMode(false);
      setDirectionWalking(false);
      setDirectionArrived(false);
      gpsLostTimer.current = null;
    }, 15000);
  }, [myGpsPos, directionMode]);

  // Primary source: ContainerLiveStatus_3D (EKL_TRN_INVENTORY) — includes
  // SlotId, a direct FK into ESS_MST_LOCATION, so containers can be placed by
  // exact slot match instead of parsing the combined Last_Loc string (which
  // was the root cause of the overlap/misalignment seen in the 3D view).
  // locateContainer() still falls back to location-string parsing / GPS when
  // SlotId is unavailable for a given row.
  const { data: inventoryResp, isFetching, refetch } = useGetContainerLiveStatus3dQuery(undefined, {
    pollingInterval: 60000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const containers = useMemo(() => {
    const rows = Array.isArray(inventoryResp?.data) ? inventoryResp.data : [];
    return rows.map((row, idx) => mapLiveRow(row, idx)).filter(c => c.containerNo);
  }, [inventoryResp]);

  const { equipment: liveEquipment } = useLiveEquipment({ pollingInterval: 15000 });

  const equipmentProjection = useMemo(
    () => (geofence ? createYardProjection(geofence.bounds) : null),
    [geofence]
  );

  // Convert road network lat/lng segments → scene XZ segments (depends on equipmentProjection)
  const roadSegments = useMemo(() => {
    if (!roadNetwork || !equipmentProjection) return null;
    return roadNetwork.segments.map((seg) => {
      const from = equipmentProjection.toXZ(seg.from.lat, seg.from.lng);
      const to   = equipmentProjection.toXZ(seg.to.lat,   seg.to.lng);
      return { x1: from.x, z1: from.z, x2: to.x, z2: to.z };
    });
  }, [roadNetwork, equipmentProjection]);

  const equipmentWithPos = useMemo(() => {
    if (!equipmentProjection) return liveEquipment;
    return liveEquipment.map((eq) => ({
      ...eq,
      yardPos: mapLatLngToYard(eq.lat, eq.lon, equipmentProjection),
    }));
  }, [liveEquipment, equipmentProjection]);

  // Only require a GPS fix — don't drop machines whose fix falls outside the
  // (tight, synthetic) geofence box. LiveEquipmentLayer/its projection already
  // clamps out-of-bounds GPS onto the yard edge (clampToYard=true) for exactly
  // this drift case, so filtering them out here just hid real machines instead
  // of letting them render clamped at the boundary.
  const renderableEquipment = useMemo(
    () => equipmentWithPos.filter(eq => eq.hasFix),
    [equipmentWithPos]
  );

  const equipmentStats = useMemo(() => {
    const out = { total: renderableEquipment.length, moving: 0, idle: 0, offline: 0, ignition_off: 0, emergency: 0 };
    for (const eq of renderableEquipment) out[eq.status] = (out[eq.status] || 0) + 1;
    return out;
  }, [renderableEquipment]);

  const selectedEquipment = useMemo(
    () => renderableEquipment.find(eq => String(eq.id) === String(selectedEquipmentId)) || null,
    [renderableEquipment, selectedEquipmentId]
  );

  const sortedEquipment = useMemo(() => {
    const order = { emergency: 0, moving: 1, idle: 2, ignition_off: 3, offline: 4 };
    return [...renderableEquipment].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  }, [renderableEquipment]);

  // Proximity alerts
  const proximityAlerts = useMemo(() => {
    if (!equipmentProjection) return [];
    const positions = renderableEquipment
      .filter(eq => eq.yardPos && !eq.yardPos.outOfBounds)
      .map(eq => ({ id: eq.id, name: eq.name, pos: eq.yardPos }));
    const alerts = [];
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dist = Math.hypot(positions[i].pos.x - positions[j].pos.x, positions[i].pos.z - positions[j].pos.z);
        if (dist < 10) alerts.push({ a: positions[i].name, b: positions[j].name, dist: Math.round(dist) });
      }
    }
    return alerts.slice(0, 5);
  }, [renderableEquipment, equipmentProjection]);

  const stats = useMemo(() => {
    const total = containers.length;
    const capacity = geofence
      ? Object.values(geofence.blocks).reduce((a, b) => a + (b.slotCount || 0) * 4, 0)
      : 0;
    const byStatus = {};
    Object.keys(STATUS_DEFS).forEach(k => { byStatus[k] = 0; });
    let overdwell = 0;
    let maxStack = 1;
    for (const c of containers) {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      if (c.dwellDays > 7) overdwell++;
      if (Number.isFinite(c.tier) && c.tier > maxStack) maxStack = c.tier;
    }
    const occupancy = capacity ? Math.round((total / capacity) * 100) : 0;
    return { total, byStatus, capacity, occupancy, overdwell, maxStack };
  }, [containers, geofence]);

  // Highest selectable tier — at least 6, but grows to whatever the backend
  // (STACK_NO) actually reports so no stacked container is ever hidden.
  const tierCeiling = Math.max(6, stats.maxStack);

  // Keep "show everything" as the default: auto-raise the max-tier filter to the
  // real data ceiling until the operator manually caps it.
  const tierTouchedRef = useRef(false);
  useEffect(() => {
    if (!tierTouchedRef.current && stats.maxStack > maxTier) setMaxTier(stats.maxStack);
  }, [stats.maxStack, maxTier]);

  const highlightedIds = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.trim().toUpperCase();
    return new Set(
      containers
        .filter(c =>
          c.containerNo.toUpperCase().includes(q) ||
          c.block.toUpperCase().includes(q) ||
          String(c.location).toUpperCase().includes(q)
        )
        .map(c => c.id)
    );
  }, [containers, search]);

  // Auto-select container when navigated from another page via ?highlight=
  useEffect(() => {
    const h = searchParams.get("highlight");
    if (!h || !containers.length) return;
    const match = containers.find(c => c.containerNo.toUpperCase() === h.toUpperCase());
    if (match) {
      setSelected(match);
      setLeftOpen(true);
      setLeftTab("yard");
    }
  }, [containers, searchParams]);

  // When search yields exactly 1 match, auto-select it
  useEffect(() => {
    if (!highlightedIds || highlightedIds.size !== 1) return;
    const id = [...highlightedIds][0];
    const match = containers.find(c => c.id === id);
    if (match) setSelected(match);
  }, [highlightedIds]); // eslint-disable-line

  // handleSearchSubmit: select first match on Enter
  const handleSearchSubmit = React.useCallback(() => {
    if (!search.trim()) return;
    const q = search.trim().toUpperCase();
    const match = containers.find(c =>
      c.containerNo.toUpperCase().includes(q) ||
      c.containerNo.toUpperCase() === q
    );
    if (match) {
      setSelected(match);
      setSearch(match.containerNo); // sharpen search to exact match
    }
  }, [search, containers]);

  // Left panel content by tab
  const leftContent = leftTab === "yard" ? (
    <>
      {/* ── KPI Strip ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg,#0b3a60 0%,#0e4a78 60%,#1565a0 100%)", boxShadow: "0 4px 20px rgba(11,58,96,0.35)" }}>
        <div className="px-3 pt-3 pb-1 flex items-center justify-between">
          <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.25em]">Yard Status</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping absolute" style={{ opacity: 0.6 }} />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 relative" />
            <span className="text-[8px] text-emerald-400 font-bold">LIVE</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-px p-px bg-white/10 rounded-b-2xl overflow-hidden">
          {[
            { icon: FiPackage,  val: stats.total,           label: "Containers",  bg: "#0e4a78" },
            { icon: FiActivity, val: `${stats.occupancy}%`, label: "Occupancy",   bg: stats.occupancy > 85 ? "#ef4444" : stats.occupancy > 65 ? "#f59e0b" : "#10b981" },
            { icon: FiClock,    val: stats.overdwell,        label: ">7d Overdwell",bg: stats.overdwell > 0 ? "#f59e0b" : "#64748b" },
            { icon: FiLayers,   val: stats.capacity || "—", label: "Capacity",    bg: "#64748b" },
          ].map(({ icon: Icon, val, label, bg }) => (
            <div key={label} className="flex items-center gap-2 px-3 py-2.5" style={{ background: "rgba(8,18,38,0.55)" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${bg}30` }}>
                <Icon size={13} style={{ color: bg }} />
              </div>
              <div>
                <div className="text-[15px] font-black text-white leading-none font-mono tabular-nums">{val}</div>
                <div className="text-[8px] text-white/40 font-bold uppercase tracking-widest mt-0.5">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Selected Container Detail ── */}
      {selected && (() => {
        const sd = STATUS_DEFS[selected.status] || { color: "#64748b", label: selected.status };
        const fmt = (raw) => {
          if (!raw) return "—";
          try { const d = new Date(String(raw).replace(" ","T")); if (isNaN(d)) return String(raw); const p = n => String(n).padStart(2,"0"); return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; } catch { return String(raw); }
        };
        return (
          <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${sd.color}44`, boxShadow: `0 4px 16px ${sd.color}18` }}>
            {/* Header */}
            <div className="px-3 py-2.5 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${sd.color}22, ${sd.color}08)` }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(80% 60% at 0% 0%, ${sd.color}18, transparent)` }} />
              <div className="relative flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${sd.color}20`, border: `1px solid ${sd.color}40` }}>
                  <FiPackage size={14} style={{ color: sd.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[13px] font-black leading-tight truncate" style={{ color: "#0f172a" }}>{selected.containerNo}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase" style={{ background: `${sd.color}18`, color: sd.color }}>
                      <span className="w-1 h-1 rounded-full inline-block" style={{ background: sd.color }} />{sd.label}
                    </span>
                    {selected.trailerNo && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono bg-amber-50 text-amber-700 border border-amber-200">{selected.trailerNo}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-black/5 transition-all shrink-0">
                  <FiX size={12} />
                </button>
              </div>
            </div>

            {/* Location bar */}
            <div className="px-3 py-2 flex items-center gap-2" style={{ background: "#0e4a780a", borderBottom: "1px solid #0e4a7818" }}>
              <FiMapPin size={10} style={{ color: "#0e4a78" }} className="shrink-0" />
              <span className="text-[10px] font-bold font-mono text-[#0e4a78]">{selected.block || "—"}</span>
              <span className="text-slate-300 text-[10px]">·</span>
              <span className="text-[10px] font-mono text-slate-600">R{selected.row||"—"} · C{selected.col||"—"} · T{selected.tier}</span>
              {selected.tat && <span className="ml-auto text-[9px] font-bold text-slate-400 font-mono">{selected.tat}</span>}
            </div>

            {/* Data grid — only fields with real data are shown */}
            <div className="px-3 py-2.5 bg-white space-y-2">
              {(() => {
                const sizeType = `${selected.size || ""} ${selected.type || ""}`.trim();
                const row1 = [
                  sizeType ? ["Size / Type", sizeType] : null,
                  selected.dwellDays ? ["Dwell", `${selected.dwellDays}d`] : null,
                ].filter(Boolean);
                return row1.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {row1.map(([lbl, val]) => (
                      <div key={lbl} className="rounded-xl bg-slate-50 border border-slate-100 px-2.5 py-2">
                        <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{lbl}</div>
                        <div className="text-[10.5px] font-bold text-slate-800 truncate">{val}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {(() => {
                const row2 = [
                  selected.process ? ["Process", selected.process] : null,
                  selected.gateInDate ? ["Gate In", fmt(selected.gateInDate)] : null,
                ].filter(Boolean);
                return row2.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {row2.map(([lbl, val]) => (
                      <div key={lbl} className="rounded-xl bg-slate-50 border border-slate-100 px-2.5 py-2">
                        <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{lbl}</div>
                        <div className="text-[10.5px] font-bold text-slate-800 truncate">{val}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Shipping Line — only when available */}
              {selected.lineName && (
                <div className="rounded-xl bg-blue-50 border border-blue-100 px-2.5 py-2">
                  <div className="text-[8px] font-bold uppercase tracking-wider text-blue-400 mb-0.5">Shipping Line</div>
                  <div className="text-[10px] font-bold text-blue-800 leading-snug whitespace-normal">{selected.lineName}</div>
                </div>
              )}

              {/* Commodity + IGM No — only when available */}
              {(selected.commodity || selected.igmNo) && (
                <div className="grid grid-cols-2 gap-1.5">
                  {selected.commodity && (
                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-2.5 py-2">
                      <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Commodity</div>
                      <div className="text-[10px] font-bold text-slate-800 truncate">{selected.commodity}</div>
                    </div>
                  )}
                  {selected.igmNo && (
                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-2.5 py-2">
                      <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">IGM No</div>
                      <div className="text-[10px] font-bold text-slate-800 font-mono truncate">{selected.igmNo}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Equipment — only when available */}
              {selected.equipment && (
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl" style={{ background: "#0e4a7808", border: "1px solid #0e4a7818" }}>
                  <FiTruck size={10} style={{ color: "#0e4a78" }} className="shrink-0" />
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Equipment</span>
                  <span className="text-[10px] font-bold font-mono ml-auto" style={{ color: "#0e4a78" }}>{selected.equipment}</span>
                </div>
              )}
            </div>
            {/* ── Get Direction — only when GPS is active ── */}
            {myGpsPos ? (
              <>
                {/* Step 1: Get Direction button */}
                {!directionMode && !directionArrived && (
                  <button
                    onClick={() => { setDirectionMode(true); setDirectionWalking(false); }}
                    className="w-full mt-1.5 h-8 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all border"
                    style={{
                      background: "linear-gradient(90deg,#f59e0b,#ef4444)",
                      color: "#fff", borderColor: "#f59e0b",
                      boxShadow: "0 0 6px #f59e0b40",
                    }}
                  >
                    <FiNavigation size={11} /> Get Direction
                  </button>
                )}

                {/* Step 2: Path preview shown — Start Walking button */}
                {directionMode && !directionWalking && !directionArrived && (
                  <>
                    <div className="w-full mt-1.5 px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[9.5px] text-amber-700 font-semibold flex items-center gap-1.5">
                      <FiNavigation size={10} className="flex-shrink-0" />
                      Path ready — tap Start Walking
                    </div>
                    <button
                      onClick={() => setDirectionWalking(true)}
                      className="w-full mt-1 h-8 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all border"
                      style={{
                        background: "linear-gradient(90deg,#22c55e,#16a34a)",
                        color: "#fff", borderColor: "#22c55e",
                        boxShadow: "0 0 8px #22c55e60",
                      }}
                    >
                      <FiNavigation size={11} /> Start Walking
                    </button>
                    <button
                      onClick={() => { setDirectionMode(false); setDirectionWalking(false); }}
                      className="w-full h-7 mt-1 rounded-lg text-[9.5px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all"
                    >
                      <FiX size={10} /> Cancel
                    </button>
                  </>
                )}

                {/* Step 3: Walking in progress */}
                {directionMode && directionWalking && !directionArrived && (
                  <>
                    <button
                      disabled
                      className="w-full mt-1.5 h-8 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border cursor-not-allowed"
                      style={{
                        background: "linear-gradient(90deg,#f59e0b,#ea580c)",
                        color: "#fff", borderColor: "#f59e0b",
                        boxShadow: "0 0 8px #f59e0b70",
                      }}
                    >
                      <FiNavigation size={11} className="animate-pulse" /> Navigating…
                    </button>
                    <button
                      onClick={() => { setDirectionMode(false); setDirectionWalking(false); }}
                      className="w-full h-7 mt-1 rounded-lg text-[9.5px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all"
                    >
                      <FiX size={10} /> Cancel Navigation
                    </button>
                  </>
                )}

                {/* Step 4: Arrived */}
                {directionArrived && (
                  <>
                    <button
                      disabled
                      className="w-full mt-1.5 h-8 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border cursor-not-allowed"
                      style={{ background: "#22c55e", color: "#fff", borderColor: "#22c55e", boxShadow: "0 0 10px #22c55e80" }}
                    >
                      ✓ Arrived!
                    </button>
                    <button
                      onClick={() => { setDirectionMode(false); setDirectionWalking(false); setDirectionArrived(false); }}
                      className="w-full h-7 mt-1 rounded-lg text-[9.5px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-all"
                    >
                      <FiRefreshCw size={10} /> Navigate Again
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="w-full mt-1.5 h-8 rounded-lg text-[9.5px] font-semibold flex items-center justify-center gap-1.5 border border-dashed border-slate-300 text-slate-400">
                <FiNavigation size={10} />
                Enable GPS for directions
              </div>
            )}
          </div>
        );
      })()}
    </>
  ) : (
    <>
      {/* ── By Status ── */}
      <div>
        <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.22em] mb-2 flex items-center gap-2">
          <div className="flex-1 h-px bg-slate-200" />By Status<div className="flex-1 h-px bg-slate-200" />
        </div>
        <div className="space-y-1">
          <button onClick={() => setFilterStatus("All")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all border text-left"
            style={{ background: filterStatus==="All" ? "#0e4a7818" : "transparent", borderColor: filterStatus==="All" ? "#0e4a7855" : "transparent" }}>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: filterStatus==="All" ? "#0e4a78" : "#cbd5e1" }} />
            <span className="text-[11px] font-semibold flex-1" style={{ color: filterStatus==="All" ? "#0e4a78" : "#64748b" }}>All Containers</span>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg" style={{ color: filterStatus==="All"?"#0e4a78":"#94a3b8", background: filterStatus==="All"?"#0e4a7812":"transparent" }}>{stats.total}</span>
          </button>
          {Object.entries(STATUS_DEFS).map(([k, d]) => {
            const cnt = stats.byStatus[k] || 0;
            const active = filterStatus === k;
            return (
              <button key={k} onClick={() => setFilterStatus(p => p === k ? "All" : k)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all border text-left"
                style={{ background: active ? `${d.color}14` : "transparent", borderColor: active ? `${d.color}44` : "transparent" }}>
                <span className="relative flex w-2 h-2 shrink-0">
                  {active && <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ background: d.color }} />}
                  <span className="relative inline-flex rounded-full w-2 h-2" style={{ background: d.color }} />
                </span>
                <span className="text-[11px] font-semibold flex-1" style={{ color: active ? d.color : "#64748b" }}>{d.label}</span>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg" style={{ color: active ? d.color : "#94a3b8", background: active ? `${d.color}12` : "transparent" }}>{cnt}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Max Tier ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-extrabold text-[#0e4a78] uppercase tracking-[0.12em]">Max Tier</div>
          <span className="text-[9px] font-bold text-slate-400">peak stack T{stats.maxStack}</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[1, 2, 3, 4].map(t => (
            <button key={t} onClick={() => { tierTouchedRef.current = true; setMaxTier(t); }}
              className="h-8 rounded-md text-[11px] font-bold border transition-all"
              style={{ background: maxTier===t?"#0e4a78":"#f8fafc", color: maxTier===t?"#fff":"#64748b", borderColor: maxTier===t?"#0e4a78":"#e2e8f0" }}
            >T{t}</button>
          ))}
        </div>
      </div>
    </>
  );

  // Right panel content by tab
  const rightContent = rightTab === "machines" ? (
    <>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <KpiChip icon={FiNavigation}    value={equipmentStats.moving}    label="Moving"   color={EQUIPMENT_STATUS_DEFS.moving.color} />
        <KpiChip icon={FiClock}         value={equipmentStats.idle}      label="Idle"     color={EQUIPMENT_STATUS_DEFS.idle.color} />
        <KpiChip icon={FiAlertTriangle} value={equipmentStats.emergency} label="Alert"    color={EQUIPMENT_STATUS_DEFS.emergency.color} />
        <KpiChip icon={FiActivity}      value={equipmentStats.offline}   label="Offline"  color={EQUIPMENT_STATUS_DEFS.offline.color} />
      </div>

      <SectionLabel>Machines ({sortedEquipment.length})</SectionLabel>
      <div className="space-y-0.5">
        {sortedEquipment.length === 0 && <div className="text-[10px] text-slate-400 py-2 text-center">No live equipment</div>}
        {sortedEquipment.map(eq => (
          <EqpRow key={eq.id} item={eq}
            selected={String(eq.id) === String(selectedEquipmentId)}
            onSelect={setSelectedEquipmentId}
          />
        ))}
      </div>

      {selectedEquipment && (
        <div className="rounded-xl border border-slate-200 overflow-hidden mt-2">
          <div className="px-3 py-2 bg-[#0e4a7812] border-b border-[#0e4a7830] flex items-center gap-2">
            <FiTruck size={11} className="text-[#0e4a78]" />
            <div className="text-[11px] font-extrabold text-[#0e4a78] truncate flex-1">{selectedEquipment.name}</div>
            <button onClick={() => setSelectedEquipmentId(null)} className="text-slate-400 hover:text-slate-600"><FiX size={11} /></button>
          </div>
          <div className="px-3 py-2.5 border-b border-slate-100"
            style={{ background: selectedEquipment.isUnlockPacket ? "#fffbeb" : "#f8fafc" }}>
            <div className="flex items-center gap-1.5 mb-1">
              {selectedEquipment.isUnlockPacket
                ? <MdLockOpen size={12} className="text-amber-600" />
                : <MdLock size={12} className="text-slate-400" />}
              <span className="text-[9px] font-bold uppercase tracking-wide"
                style={{ color: selectedEquipment.isUnlockPacket ? "#d97706" : "#94a3b8" }}>
                {selectedEquipment.isUnlockPacket ? "Active Unlock" : "No Unlock Active"}
              </span>
            </div>
            {selectedEquipment.isUnlockPacket && selectedEquipment.containerTag
              ? <div className="font-mono text-[13px] font-extrabold text-amber-700">{selectedEquipment.containerTag}</div>
              : <div className="text-[9.5px] text-slate-400">No container scanned</div>}
            {selectedEquipment.isUnlockPacket && selectedEquipment.lastUkAt && (
              <div className="text-[8.5px] text-slate-400 mt-0.5">
                {String(selectedEquipment.lastUkAt).replace("T", " ").slice(0, 19)}
              </div>
            )}
          </div>
          <div className="px-3 py-2 bg-white space-y-1.5">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <DetailRow label="Type"   value={selectedEquipment.type} mono={false} />
              <DetailRow label="Status" value={EQUIPMENT_STATUS_DEFS[selectedEquipment.status]?.label} mono={false} />
              <DetailRow label="Device" value={selectedEquipment.deviceId} mono={false} />
              {selectedEquipment.lat && (
                <div className="col-span-2">
                  <DetailRow label="GPS" value={`${Number(selectedEquipment.lat).toFixed(5)}, ${Number(selectedEquipment.lon).toFixed(5)}`} />
                </div>
              )}
            </div>
            <button onClick={() => setFollowEquipmentMode(p => !p)}
              className="w-full h-7 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-all flex items-center justify-center gap-1.5"
              style={{ background: followEquipmentMode?"#0e4a78":"#fff", color: followEquipmentMode?"#fff":"#0f172a", borderColor: followEquipmentMode?"#0e4a78":"#e2e8f0" }}>
              <FiCompass size={10} />
              {followEquipmentMode ? "Following" : "Follow Camera"}
            </button>
          </div>
        </div>
      )}
    </>
  ) : (
    <>
      <div className="text-[11px] font-extrabold text-[#0e4a78] uppercase tracking-[0.12em] mb-2">Operational Alerts</div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-semibold text-slate-600">Proximity alerts</span>
          <span className="font-mono font-bold text-[11px]" style={{ color: proximityAlerts.length>0?"#ef4444":"#94a3b8" }}>{proximityAlerts.length}</span>
        </div>
        <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-semibold text-slate-600">Overdwell (&gt;7d)</span>
          <span className="font-mono font-bold text-[11px]" style={{ color: stats.overdwell>0?"#f59e0b":"#94a3b8" }}>{stats.overdwell}</span>
        </div>
      </div>
      {proximityAlerts.length > 0 && (
        <div>
          <SectionLabel>Proximity Events</SectionLabel>
          {proximityAlerts.map((a, i) => (
            <div key={i} className="px-2 py-1.5 rounded-md bg-red-50 border border-red-100 mb-1">
              <div className="text-[9.5px] font-bold text-red-700">{a.a} ↔ {a.b}</div>
              <div className="text-[9px] text-red-400">{a.dist}m apart</div>
            </div>
          ))}
        </div>
      )}
      <div>
        <SectionLabel>Equipment Summary</SectionLabel>
        {Object.entries(EQUIPMENT_STATUS_DEFS).map(([k, d]) => (
          <div key={k} className="flex items-center gap-2 py-1">
            <Dot color={d.color} />
            <span className="text-[10px] text-slate-600 flex-1">{d.label}</span>
            <span className="text-[10px] font-mono font-bold text-slate-800">{equipmentStats[k] || 0}</span>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f1f5f9]">
      <Navbar />

      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT SIDEBAR — desktop inline / mobile overlay ── */}
        {isMobile ? (
          <Sidebar
            side="left"
            open={mobileLeftOpen}
            onToggle={() => setMobileLeftOpen(p => !p)}
            tabs={[{ key: "yard", label: "Yard" }, { key: "filter", label: "Filter" }]}
            activeTab={leftTab}
            onTabChange={setLeftTab}
            isMobile={true}
          >
            {leftContent}
          </Sidebar>
        ) : (
          <Sidebar
            side="left"
            open={leftOpen}
            onToggle={() => setLeftOpen(p => !p)}
            tabs={[{ key: "yard", label: "Yard" }, { key: "filter", label: "Filter" }]}
            activeTab={leftTab}
            onTabChange={setLeftTab}
          >
            {leftContent}
          </Sidebar>
        )}

        {/* ── CANVAS ── */}
        <main className="relative flex-1 overflow-hidden bg-[#1e3050]">
          {/* Search bar */}
          <div className="absolute left-4 right-4 top-3 z-10 flex items-center gap-2 pointer-events-none">
            <div className="flex items-center gap-2 h-9 px-3 rounded-xl pointer-events-auto flex-1 max-w-xl"
              style={{ background: "rgba(15,23,42,0.72)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>
              <FiSearch style={{ color: "rgba(255,255,255,0.4)" }} size={13} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearchSubmit()}
                placeholder="Container no. / block…"
                className="flex-1 bg-transparent text-[12px] placeholder-white/30 outline-none font-mono text-white"
              />
              {search && <button onClick={() => { setSearch(""); setSelected(null); }} style={{ color: "rgba(255,255,255,0.4)" }} className="hover:text-white/80"><FiX size={12} /></button>}
              {highlightedIds && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: "rgba(14,74,120,0.6)", color: "#7dd3fc", border: "1px solid rgba(14,74,120,0.4)" }}>
                  {highlightedIds.size} found
                </span>
              )}
            </div>
            <button onClick={handleSearchSubmit}
              className="pointer-events-auto h-9 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition"
              style={{ background: "rgba(14,74,120,0.85)", backdropFilter: "blur(12px)", border: "1px solid rgba(14,74,120,0.5)", color: "#7dd3fc", boxShadow: "0 4px 16px rgba(0,0,0,0.25)" }}>
              <FiSearch size={12} />
              Find
            </button>
            <button onClick={refetch} disabled={isFetching}
              className="pointer-events-auto h-9 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition disabled:opacity-50"
              style={{ background: "rgba(15,23,42,0.72)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.65)", boxShadow: "0 4px 16px rgba(0,0,0,0.25)" }}>
              <FiRefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
              Refresh
            </button>
            <DesktopBadge />
            <div className="pointer-events-auto">
              <DownloadDesktopApp compact />
            </div>
          </div>

          {/* Equipment canvas tooltip */}
          {selectedEquipment && (
            <div className="absolute left-4 top-16 z-10 rounded-2xl overflow-hidden shadow-2xl min-w-[230px]"
              style={{ background: "rgba(15,23,42,0.88)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}>
              {/* Header stripe */}
              <div className="px-3 py-2 flex items-center gap-2"
                style={{ background: `${EQUIPMENT_STATUS_DEFS[selectedEquipment.status]?.color}22`, borderBottom: `1px solid ${EQUIPMENT_STATUS_DEFS[selectedEquipment.status]?.color}33` }}>
                <FiTruck size={11} style={{ color: EQUIPMENT_STATUS_DEFS[selectedEquipment.status]?.color }} />
                <div className="font-mono text-[12px] font-extrabold text-white truncate flex-1">{selectedEquipment.name}</div>
                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                  style={{ background: `${EQUIPMENT_STATUS_DEFS[selectedEquipment.status]?.color}30`, color: EQUIPMENT_STATUS_DEFS[selectedEquipment.status]?.color }}>
                  {EQUIPMENT_STATUS_DEFS[selectedEquipment.status]?.label}
                </span>
              </div>
              <div className="px-3 py-2 space-y-1.5">
                <div className="text-[9.5px] text-white/50">{selectedEquipment.type} · {selectedEquipment.deviceId}</div>
                {selectedEquipment.isCarrying && selectedEquipment.containerTag && (
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-blue-500/15 border border-blue-400/25">
                    <MdLock size={10} className="text-blue-400" />
                    <span className="text-[8px] text-blue-300 uppercase font-bold tracking-wide flex-1">Carrying</span>
                    <span className="font-mono text-[11px] font-extrabold text-blue-200">{selectedEquipment.containerTag}</span>
                  </div>
                )}
                {!selectedEquipment.isCarrying && selectedEquipment.isUnlockPacket && selectedEquipment.containerTag && (
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-500/15 border border-amber-400/25">
                    <MdLockOpen size={10} className="text-amber-400" />
                    <span className="text-[8px] text-amber-300 uppercase font-bold tracking-wide flex-1">Placed</span>
                    <span className="font-mono text-[11px] font-extrabold text-amber-200">{selectedEquipment.containerTag}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hover tooltip */}
          {hovered && !selected && (
            <div className="absolute left-4 bottom-10 z-10 px-3 py-2 rounded-lg bg-white/95 shadow-lg border border-slate-200 pointer-events-none min-w-[200px]"
              style={{ backdropFilter: "blur(8px)" }}>
              <div className="text-[9px] uppercase tracking-[0.16em] text-slate-400 font-bold">Hovering</div>
              <div className="font-mono text-[12px] font-bold text-slate-800 mt-0.5">{hovered.container?.containerNo || hovered.id}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {hovered.container?.size} · {hovered.container?.type} ·{" "}
                <span style={{ color: STATUS_DEFS[hovered.container?.status]?.color, fontWeight: 700 }}>
                  {STATUS_DEFS[hovered.container?.status]?.label}
                </span>
              </div>
              {hovered.container?.location && (
                <div className="text-[9.5px] text-slate-500 mt-0.5 font-mono truncate">
                  {hovered.container.location}
                </div>
              )}
              <div className="text-[9.5px] text-slate-400 mt-0.5 font-mono">
                {hovered.container?.block} · {hovered.container?.row}{hovered.container?.col} · T{hovered.container?.tier}
              </div>
            </div>
          )}

          {/* GPS error + manual input */}
          {(gpsErr || showManual) && (
            <div className="absolute bottom-14 right-4 z-20 rounded-xl overflow-hidden shadow-2xl"
              style={{ background: "rgba(10,18,36,0.96)", border: "1px solid rgba(239,68,68,0.35)", minWidth: 260 }}>
              {gpsErr && (
                <div className="px-3 py-2 text-[10px] font-semibold flex items-start gap-1.5"
                  style={{ color: "#fca5a5", borderBottom: showManual ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                  <span className="shrink-0 mt-0.5">⚠</span>
                  <span>{gpsErr}</span>
                </div>
              )}
              {showManual && (
                <div className="px-3 py-2.5 space-y-2">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Manual Location</div>

                  {/* Quick test presets from geofence corners */}
                  {geofence?.bounds && (() => {
                    const b = geofence.bounds;
                    const centerLat = (b.north + b.south) / 2;
                    const centerLng = (b.east  + b.west)  / 2;
                    const presets = [
                      { label: "Center",       lat: centerLat,                    lng: centerLng },
                      { label: "NW Corner",    lat: b.north,                      lng: b.west    },
                      { label: "NE Corner",    lat: b.north,                      lng: b.east    },
                      { label: "SW Corner",    lat: b.south,                      lng: b.west    },
                    ];
                    return (
                      <div className="space-y-1">
                        <div className="text-[9px] text-slate-500 font-semibold">Quick Test Positions:</div>
                        <div className="grid grid-cols-2 gap-1">
                          {presets.map(p => (
                            <button key={p.label}
                              onClick={() => { setManualLat(p.lat.toFixed(6)); setManualLng(p.lng.toFixed(6)); }}
                              className="py-1 rounded text-[9px] font-bold transition-all hover:opacity-90"
                              style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc" }}>
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <input
                    value={manualLat} onChange={e => setManualLat(e.target.value)}
                    placeholder="Latitude (e.g. 13.1909)"
                    className="w-full px-2 py-1.5 rounded-md text-[11px] font-mono outline-none"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#e2e8f0" }}
                  />
                  <input
                    value={manualLng} onChange={e => setManualLng(e.target.value)}
                    placeholder="Longitude (e.g. 80.2728)"
                    className="w-full px-2 py-1.5 rounded-md text-[11px] font-mono outline-none"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#e2e8f0" }}
                  />
                  <button onClick={applyManual}
                    className="w-full py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: "linear-gradient(90deg,#0891b2,#2563eb)", color: "#fff" }}>
                    📍 Place Me on Map
                  </button>
                </div>
              )}
            </div>
          )}

          {!geofence && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-10 h-10 border-2 border-slate-600 border-t-[#0e4a78] rounded-full animate-spin" />
              <span className="text-sm font-medium">Loading yard layout…</span>
            </div>
          )}

          {geofence && (
            <YardScene
              geofence={geofence}
              dxfLayout={dxfLayout}
              containers={containers}
              selectedId={selected?.id}
              highlightedIds={directionMode ? null : highlightedIds}
              onSelect={(c) => { setSelected(c); setDirectionMode(false); }}
              onHover={setHovered}
              filterStatus={filterStatus}
              maxTier={maxTier}
              getColor={colorForContainer}
              liveEquipment={renderableEquipment}
              selectedEquipmentId={selectedEquipmentId}
              onSelectEquipment={setSelectedEquipmentId}
              followEquipmentId={selectedEquipmentId}
              followEquipmentMode={followEquipmentMode}
              lowPerfMode={lowPerfMode}
              showBlockLabels={showBlockLabels}
              myGpsPos={myGpsPos}
              directionMode={directionMode}
              directionWalking={directionWalking}
              directionTargetId={selected?.id}
              directionStartPos={
                (() => {
                  if (!myGpsPos || !equipmentProjection) return null;
                  // clampToYard=true: if GPS is slightly out of bounds (signal drift), clamp to
                  // yard edge so navigation still works rather than silently blocking the path.
                  const p = mapLatLngToYard(myGpsPos.lat, myGpsPos.lng, equipmentProjection, true);
                  return p ? { x: p.x, z: p.z } : null;
                })()
              }
              onDirectionArrived={() => { setDirectionArrived(true); setDirectionWalking(false); }}
              roadPainterActive={roadPainterActive}
              roadPoints={roadPoints}
              onAddRoadPoint={handleAddRoadPoint}
              roadSegments={roadSegments}
              yardBuilderMode={yardBuilderMode}
              yardBuilderWalls={yardBuilderWalls}
              yardBuilderBuildings={yardBuilderBuildings}
              yardBuilderDrawPoints={yardBuilderDrawPoints}
              onYardBuilderAddDrawPoint={handleYardBuilderAddDrawPoint}
              yardBuilderDragStart={yardBuilderDragStart}
              yardBuilderDragCurrent={yardBuilderDragCurrent}
              onYardBuilderDragStart={handleYardBuilderDragStart}
              onYardBuilderDragMove={handleYardBuilderDragMove}
              onYardBuilderDragEnd={handleYardBuilderDragEnd}
              yardBuilderSelection={yardBuilderSelection}
              onYardBuilderSelect={setYardBuilderSelection}
              onSceneGeometryReady={handleSceneGeometryReady}
            />
          )}

          {/* ── Navigation overlays: clear of the top toolbar (search/refresh)
              and the bottom HUD. Stacked vertically on the right edge so
              they never collide with existing UI rows. ── */}
          {directionMode && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col items-end gap-2 pointer-events-auto">
              <CameraSwitcher />
              <div className="w-72">
                <RouteProgress />
              </div>
            </div>
          )}

          {/* Road Painter UI hidden — tool kept for future use */}

          {yardBuilderMode !== "off" && (
            <YardBuilderUI
              mode={yardBuilderMode} setMode={setYardBuilderMode}
              walls={yardBuilderWalls} setWalls={setYardBuilderWalls}
              buildings={yardBuilderBuildings} setBuildings={setYardBuilderBuildings}
              drawPoints={yardBuilderDrawPoints} setDrawPoints={setYardBuilderDrawPoints}
              selection={yardBuilderSelection} setSelection={setYardBuilderSelection}
            />
          )}

          {/* ── Bottom HUD bar ── */}
          <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 gap-3"
            style={{ background: "linear-gradient(0deg, rgba(15,23,42,0.82) 0%, transparent 100%)", backdropFilter: "blur(4px)" }}>

            {/* Left: keyboard hints — desktop only */}
            <div className="hidden md:flex items-center gap-2 flex-wrap">
              {[
                { keys: "↑↓←→", label: "Pan" },
                { keys: "+  −", label: "Zoom" },
                { keys: "Drag", label: "Rotate" },
                { keys: "Right-drag", label: "Move" },
              ].map(({ keys, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-white/10 text-white/80 border border-white/20">{keys}</span>
                  <span className="text-[9px] text-white/50 font-medium">{label}</span>
                </div>
              ))}
            </div>

            {/* Centre: live status */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/5">
              <Dot color="#10b981" pulse />
              <span className="text-[10px] font-bold text-emerald-400 tracking-wide">LIVE</span>
              <span className="text-white/30 text-[10px]">·</span>
              <span className="text-[10px] text-white/70 font-mono">{containers.length} ctrs</span>
              <span className="text-white/30 text-[10px]">·</span>
              <span className="text-[10px] text-white/70 font-mono">{equipmentStats.total} eqp</span>
            </div>

            {/* Right: GPS + quality toggle */}
            <div className="flex items-center gap-2">
              {/* My Location button */}
              <button
                onClick={gpsOn ? stopGps : startGps}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all"
                style={{
                  background: gpsOn && myGpsPos ? "rgba(34,211,238,0.2)" : gpsOn ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.07)",
                  borderColor: gpsOn && myGpsPos ? "rgba(34,211,238,0.6)" : gpsOn ? "rgba(251,191,36,0.5)" : "rgba(255,255,255,0.15)",
                  color: gpsOn && myGpsPos ? "#22d3ee" : gpsOn ? "#fbbf24" : "rgba(255,255,255,0.6)",
                  boxShadow: gpsOn && myGpsPos ? "0 0 10px rgba(34,211,238,0.3)" : "none",
                }}>
                <FiNavigation size={11} className={gpsOn && !myGpsPos ? "animate-spin" : ""} />
                <span className="text-[9px] font-bold uppercase tracking-wide">
                  {gpsOn && myGpsPos ? `±${gpsAcc}m` : gpsOn ? "Locating…" : "My Location"}
                </span>
              </button>

              {/* Manual / Test Mode button — hidden from the 3D yard map per request (kept for easy restore) */}
              {/*
              <button
                onClick={() => setShowManual(p => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all"
                style={{
                  background: showManual ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.07)",
                  borderColor: showManual ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.15)",
                  color: showManual ? "#a5b4fc" : "rgba(255,255,255,0.6)",
                }}>
                <FiMapPin size={11} />
                <span className="text-[9px] font-bold uppercase tracking-wide">Test Pos</span>
              </button>
              */}

              <button onClick={() => setLowPerfMode(p => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all"
                style={{
                  background: lowPerfMode ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.07)",
                  borderColor: lowPerfMode ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.15)",
                  color: lowPerfMode ? "#f59e0b" : "rgba(255,255,255,0.6)",
                }}>
                <FiZap size={11} />
                <span className="text-[9px] font-bold uppercase tracking-wide">{lowPerfMode ? "Low Q" : "Hi-Q"}</span>
              </button>

              {/* Yard Builder toggle */}
              <button onClick={() => setYardBuilderMode(m => m === "off" ? "edit" : "off")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all"
                style={{
                  background: yardBuilderMode !== "off" ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.07)",
                  borderColor: yardBuilderMode !== "off" ? "rgba(56,189,248,0.6)" : "rgba(255,255,255,0.15)",
                  color: yardBuilderMode !== "off" ? "#7dd3fc" : "rgba(255,255,255,0.6)",
                  boxShadow: yardBuilderMode !== "off" ? "0 0 8px rgba(56,189,248,0.3)" : "none",
                }}>
                <FiSliders size={11} />
                <span className="text-[9px] font-bold uppercase tracking-wide">Yard Builder</span>
              </button>

              {/* Block label toggle */}
              <button onClick={() => setShowBlockLabels(p => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all"
                style={{
                  background: showBlockLabels ? "rgba(96,165,250,0.2)" : "rgba(255,255,255,0.07)",
                  borderColor: showBlockLabels ? "rgba(96,165,250,0.6)" : "rgba(255,255,255,0.15)",
                  color: showBlockLabels ? "#93c5fd" : "rgba(255,255,255,0.6)",
                  boxShadow: showBlockLabels ? "0 0 8px rgba(96,165,250,0.3)" : "none",
                }}>
                <FiTag size={11} />
                <span className="text-[9px] font-bold uppercase tracking-wide">Labels</span>
              </button>
            </div>
          </div>
        </main>

        {/* ── RIGHT SIDEBAR — desktop inline / mobile overlay ── */}
        {isMobile ? (
          <Sidebar
            side="right"
            open={mobileRightOpen}
            onToggle={() => setMobileRightOpen(p => !p)}
            tabs={[{ key: "machines", label: "Machines" }, { key: "alerts", label: "Alerts" }]}
            activeTab={rightTab}
            onTabChange={setRightTab}
            badge={{ alerts: proximityAlerts.length }}
            isMobile={true}
          >
            {rightContent}
          </Sidebar>
        ) : (
          <Sidebar
            side="right"
            open={rightOpen}
            onToggle={() => setRightOpen(p => !p)}
            tabs={[{ key: "machines", label: "Machines" }, { key: "alerts", label: "Alerts" }]}
            activeTab={rightTab}
            onTabChange={setRightTab}
            badge={{ alerts: proximityAlerts.length }}
          >
            {rightContent}
          </Sidebar>
        )}

      </div>

      {/* ── MOBILE BOTTOM TOOLBAR ── */}
      {isMobile && (
        <div className="flex-shrink-0 flex items-center justify-around px-4 py-2 border-t border-slate-200"
          style={{ background: "#f8fafc", paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))" }}>
          <button
            onClick={() => setMobileLeftOpen(p => !p)}
            className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all"
            style={{ background: mobileLeftOpen ? "#0e4a7814" : "transparent", color: mobileLeftOpen ? "#0e4a78" : "#64748b" }}>
            <FiSliders size={18} />
            <span className="text-[9px] font-bold uppercase tracking-wide">Yard</span>
          </button>
          <button
            onClick={() => setMobileRightOpen(p => !p)}
            className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all relative"
            style={{ background: mobileRightOpen ? "#0e4a7814" : "transparent", color: mobileRightOpen ? "#0e4a78" : "#64748b" }}>
            <FiTruck size={18} />
            <span className="text-[9px] font-bold uppercase tracking-wide">Machines</span>
            {proximityAlerts.length > 0 && (
              <span className="absolute top-0 right-2 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">{proximityAlerts.length}</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
