import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  FiSearch, FiRefreshCw, FiMapPin, FiActivity, FiTruck, FiClock,
  FiCheckCircle, FiBox, FiArrowRight, FiNavigation, FiLayers, FiPackage,
} from "react-icons/fi";
import {
  GoogleMap, MarkerF, PolylineF, InfoWindowF, useJsApiLoader,
} from "@react-google-maps/api";
import Navbar from "../../../components/layout/Navbar";
import Footer from "../../../components/layout/Footer";
import {
  useLazyGetDeviceDataQuery, useLazyGetContainerInfoQuery,
  useGetLocationSlotsQuery, useGetEquipmentQuery,
  useLazyGetLifecycleDetailsQuery,
  useLazyGetLifecycleOffloadTimelineQuery,
  useLazyGetLifecycleGateInOutQuery,
} from "../../../store/api/ymsApi";

// ── Geometry helpers ──────────────────────────────────────────────────────────
const _parseLL = (raw) => {
  if (!raw || typeof raw !== "string") return [];
  return raw.trim().split(",").map((tok) => {
    const p = tok.trim().split(/\s+/);
    if (p.length < 2) return null;
    const a = parseFloat(p[0]), b = parseFloat(p[1]);
    if (!isFinite(a) || !isFinite(b)) return null;
    return Math.abs(a) < Math.abs(b) ? { lat: a, lng: b } : { lat: b, lng: a };
  }).filter(Boolean);
};
const _parseWKT = (raw) => {
  if (!raw || typeof raw !== "string") return [];
  const m = /POLYGON\s*\(\(([^)]+)\)/i.exec(raw.trim());
  if (!m) return [];
  return m[1].split(",").map((tok) => {
    const p = tok.trim().split(/\s+/);
    if (p.length < 2) return null;
    const a = parseFloat(p[0]), b = parseFloat(p[1]);
    if (!isFinite(a) || !isFinite(b)) return null;
    return Math.abs(a) < Math.abs(b) ? { lat: a, lng: b } : { lat: b, lng: a };
  }).filter(Boolean);
};
const _pip = (point, poly) => {
  if (!poly || poly.length < 3) return false;
  const { lat: py, lng: px } = point;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lng, yi = poly[i].lat, xj = poly[j].lng, yj = poly[j].lat;
    if (((yi > py) !== (yj > py)) && px < (xj - xi) * (py - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
};

const defaultCenter = { lat: 28.42684598807148, lng: 76.91546293301492 };
const mapStyle = { width: "100%", height: "100%" };
const mapOpts = {
  disableDefaultUI: true, zoomControl: true, fullscreenControl: true,
  streetViewControl: false, mapTypeControl: true, mapTypeId: "hybrid",
  styles: [{ featureType: "all", elementType: "labels", stylers: [{ visibility: "off" }] }],
};

const fmt = (dtStr) => {
  if (!dtStr || dtStr === "-") return "-";
  const d = new Date(String(dtStr).replace(" ", "T"));
  if (isNaN(d.getTime())) return dtStr;
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const gf = (row, ...keys) => {
  for (const k of keys) if (row && Object.prototype.hasOwnProperty.call(row, k) && row[k] != null) return row[k];
  return null;
};

// ── Stat Card ──
const StatCard = ({ icon: Icon, label, value, color, sub }) => (
  <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5 hover:bg-white/[0.08] transition-all duration-300 hover:-translate-y-1">
    <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-[0.07]" style={{ background: color }} />
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.15em]">{label}</p>
        {sub ? (
          <p className="text-sm font-bold text-white/90 mt-0.5 leading-tight">{value}</p>
        ) : (
          <p className="text-2xl font-black text-white mt-0.5 leading-none">{value}</p>
        )}
      </div>
    </div>
  </div>
);

// ── Timeline Event ──
const TimelineEvent = ({ icon: Icon, title, color, borderColor, bgColor, children, badge, isLast }) => (
  <div className="relative pl-10 pb-8 group">
    {!isLast && <div className="absolute left-[15px] top-10 bottom-0 w-[2px] bg-gradient-to-b" style={{ backgroundImage: `linear-gradient(to bottom, ${color}66, transparent)` }} />}
    <div className="absolute left-[6px] top-1 w-[20px] h-[20px] rounded-full border-[3px] flex items-center justify-center z-10 shadow-lg transition-transform group-hover:scale-110" style={{ background: color, borderColor: borderColor, boxShadow: `0 0 12px ${color}40` }}>
      <Icon className="w-[9px] h-[9px] text-white" />
    </div>
    {badge && <span className="inline-block mb-2 px-3 py-1 rounded-lg text-white text-[11px] font-bold shadow-md" style={{ background: color }}>{badge}</span>}
    <div className={`rounded-xl border p-4 transition-all hover:shadow-md ${bgColor} ${borderColor ? '' : 'border-slate-200'}`} style={{ borderColor: `${color}33` }}>
      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-2.5">
        <Icon className="w-4 h-4" style={{ color }} /> {title}
      </h4>
      {children}
    </div>
  </div>
);

const InfoRow = ({ label, value }) => (
  <p className="text-xs text-slate-600 mb-1 last:mb-0">
    <span className="font-semibold text-slate-400 mr-1">{label} :</span>
    <span className="font-bold text-slate-800">{value}</span>
  </p>
);

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const ContainerLifecycle = () => {
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  const { isLoaded } = useJsApiLoader({ id: "google-map-script", googleMapsApiKey: mapsApiKey ?? "" });

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(16);
  const [containerPath, setContainerPath] = useState([]);
  const [activeMarker, setActiveMarker] = useState(null);
  const [selectedMoveIdx, setSelectedMoveIdx] = useState(null);
  const [selectedOffloadIdx, setSelectedOffloadIdx] = useState(null);
  const mapRef = useRef(null);

  const [fetchDeviceData, { data: apiData, isLoading: isFetching }] = useLazyGetDeviceDataQuery();
  const [fetchContainerInfo, { data: infoApiData, isLoading: isInfoFetching }] = useLazyGetContainerInfoQuery();
  const [fetchLifecycleDetails, { data: lifecycleData }] = useLazyGetLifecycleDetailsQuery();
  const [fetchOffloadTimeline, { data: offloadTimelineData }] = useLazyGetLifecycleOffloadTimelineQuery();
  const [fetchGateInOut, { data: gateInOutData }] = useLazyGetLifecycleGateInOutQuery();
  const { data: slotsData } = useGetLocationSlotsQuery();
  const { data: equipmentApi } = useGetEquipmentQuery();

  // Device_ID → Equipment_Name lookup
  const deviceNameMap = useMemo(() => {
    const rows = Array.isArray(equipmentApi?.data) ? equipmentApi.data : [];
    const map = new Map();
    rows.forEach((item) => {
      const deviceId = String(item?.Device_ID ?? item?.device_id ?? item?.DEVICE_ID ?? '').trim();
      const eqpName  = String(item?.Equipment_Name ?? item?.equipment_name ?? item?.EQUIPMENT_NAME ?? '').trim();
      if (deviceId && eqpName) map.set(deviceId, eqpName);
    });
    return map;
  }, [equipmentApi]);

  // Build a (lat, lng) → slot name lookup from ESS_MST_SLOT polygons
  const findSlotName = useMemo(() => {
    const rows = slotsData?.data || [];
    const parsed = rows.map((row, idx) => {
      const name = row.SLOTNAME ?? row.SlotName ?? `Slot-${idx}`;
      const ll = row.LATLONG ?? row.LatLong ?? "";
      let poly = ll ? _parseLL(String(ll)) : [];
      if (poly.length < 3) {
        const wkt = row.PolygonWKT ?? row.POLYGON ?? row.Polygon ?? "";
        if (wkt) poly = _parseWKT(String(wkt));
      }
      if (poly.length > 1) {
        const f = poly[0], l = poly[poly.length - 1];
        if (f.lat === l.lat && f.lng === l.lng) poly = poly.slice(0, -1);
      }
      return poly.length >= 3 ? { name: String(name), poly } : null;
    }).filter(Boolean);

    return (lat, lng) => {
      if (!isFinite(lat) || !isFinite(lng)) return null;
      for (const s of parsed) if (_pip({ lat, lng }, s.poly)) return s.name;
      return null;
    };
  }, [slotsData]);

  // Container info from inventory (gate-in details, size, type)
  const containerInfo = useMemo(() => {
    const raw = Array.isArray(infoApiData?.data) ? infoApiData.data[0] : null;
    if (!raw) return null;
    return {
      containerNo: raw.CONTAINER_NO ?? "-",
      size: raw.CONTAINER_SIZE ?? "-",
      sizeDesc: raw.SIZE_DESC ?? "-",
      type: raw.CONTAINER_TYPE ?? "-",
      typeDesc: raw.TYPE_DESC ?? "-",
      isoCode: raw.ISO_CODE ?? "-",
      gateInDate: fmt(raw.GATE_IN_DATE),
      gateOutDate: fmt(raw.GATE_OUT_DATE),
      offloadDate: fmt(raw.OFFLOAD_DATE),
      status: raw.INVENTORY_STATUS ?? "-",
      lastLocation: raw.LAST_LOCATION_NAME ?? "-",
    };
  }, [infoApiData]);

  // Device data movements (machine transactions)
  const movements = useMemo(() => {
    const raw = Array.isArray(apiData?.data) ? apiData.data : Array.isArray(apiData) ? apiData : [];
    const parsed = raw.map((row) => {
      const lat = parseFloat(gf(row, "LATITUDE", "latitude", "LAT", "lat"));
      const lng = parseFloat(gf(row, "LONGITUDE", "longitude", "LNG", "lng"));
      const latVal = isNaN(lat) ? null : lat;
      const lngVal = isNaN(lng) ? null : lng;
      const locationName = (latVal !== null && lngVal !== null)
        ? (findSlotName(latVal, lngVal) ?? "-")
        : "-";
      return { ...row, lat: latVal, lng: lngVal, locationName, dateTimeRaw: gf(row, "DATE_TIME", "date_time"), dateTime: fmt(gf(row, "DATE_TIME", "date_time")) };
    });
    parsed.sort((a, b) => new Date(a.dateTimeRaw || 0) - new Date(b.dateTimeRaw || 0));
    return parsed;
  }, [apiData, findSlotName]);

  // First movement = Offload (first machine transaction after gate-in)
  const offloadMove = movements.length > 0 ? movements[0] : null;

  // Lifecycle details from SP
  const lifecycleDetails = useMemo(() => {
    const data = lifecycleData?.data || [];
    return Array.isArray(data) ? data : [];
  }, [lifecycleData]);

  const lifecycleMaster = lifecycleDetails[0] || null;

  // When lifecycle master_id is available, fetch offload timeline + gate in/out
  useEffect(() => {
    if (!lifecycleMaster?.MasterId || !searchQuery) return;
    fetchOffloadTimeline(lifecycleMaster.MasterId);
    fetchGateInOut({ master_id: lifecycleMaster.MasterId, container_no: searchQuery });
  }, [lifecycleMaster?.MasterId, searchQuery, fetchOffloadTimeline, fetchGateInOut]);

  const offloadTimeline = useMemo(() => {
    const data = offloadTimelineData?.data || [];
    return Array.isArray(data) ? [...data].sort((a, b) => new Date(a.TransDate) - new Date(b.TransDate)) : [];
  }, [offloadTimelineData]);

  const gateInOut = useMemo(() => {
    const data = gateInOutData?.data || [];
    return Array.isArray(data) ? data[0] || null : null;
  }, [gateInOutData]);

  useEffect(() => {
    const unlockMoves = movements.filter((m) => String(gf(m, "PacketId", "packetid", "PACKET_ID", "packet_id", "PacketID")) === "8");
    if (unlockMoves.length > 0) {
      const path = unlockMoves.filter((m) => m.lat != null && m.lng != null).map((m) => ({ lat: m.lat, lng: m.lng }));
      setContainerPath(path);
      if (path.length > 0) { setMapCenter(path[path.length - 1]); setMapZoom(18); }
    } else { setContainerPath([]); }
  }, [movements]);

  // Center map on offload timeline points when they load (if no unlock moves already set center)
  useEffect(() => {
    if (!offloadTimeline.length) return;
    const pts = offloadTimeline
      .map(r => ({ lat: parseFloat(r.GpsLocLat), lng: parseFloat(r.GpsLocLon) }))
      .filter(p => isFinite(p.lat) && isFinite(p.lng));
    if (!pts.length) return;
    // Only auto-center if movements haven't already set a path
    if (containerPath.length === 0) {
      setMapCenter(pts[pts.length - 1]);
      setMapZoom(17);
    }
  }, [offloadTimeline]);

  const handleSearch = () => {
    const q = searchInput.trim().toUpperCase();
    if (!q) return;
    setSearchQuery(q); setHasSearched(true); setSelectedMoveIdx(null);
    fetchDeviceData({ container_no: q, top: 500 });
    fetchContainerInfo(q);
    fetchLifecycleDetails(q);
    setActiveMarker(null);
  };

  const handleReset = () => {
    setSearchInput(""); setSearchQuery(""); setHasSearched(false);
    setContainerPath([]); setMapCenter({ ...defaultCenter }); setMapZoom(16);
    setActiveMarker(null); setSelectedMoveIdx(null);
  };

  const handleRowClick = (idx) => {
    const move = movements[idx];
    setSelectedMoveIdx(idx);
    if (move.lat != null && move.lng != null) {
      setMapCenter({ lat: move.lat, lng: move.lng }); setMapZoom(19); setActiveMarker(idx);
    }
  };

  const summary = useMemo(() => {
    if (!movements.length && !containerInfo && !lifecycleMaster) return null;
    const unlockMoves = movements.filter(
      (m) => String(gf(m, "PacketId", "packetid", "PACKET_ID", "packet_id", "PacketID")) === "8"
    );
    const machines = new Set(
      unlockMoves.map((m) => gf(m, "KALMAR_NO", "MACHINE", "DEVICE_IMEI")).filter(Boolean)
    );
    const lastMove = unlockMoves.length > 0 ? unlockMoves[unlockMoves.length - 1] : movements[movements.length - 1];
    return {
      totalMoves: unlockMoves.length || offloadTimeline.length,
      machinesCount: machines.size || new Set(offloadTimeline.map(r => r.EquipmentName).filter(Boolean)).size,
      gateInDate: fmt(lifecycleMaster?.GateInDate) ?? fmt(gateInOut?.GateInDate) ?? containerInfo?.gateInDate ?? (movements[0]?.dateTime ?? "-"),
      latestMoveDate: fmt(lifecycleMaster?.LastShiftDate) ?? lastMove?.dateTime ?? "-",
    };
  }, [movements, containerInfo, lifecycleMaster, gateInOut, offloadTimeline]);

  const isLoading = isFetching || isInfoFetching;

  return (
    <div className="w-full min-h-screen bg-slate-50">
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-screen-2xl mx-auto w-full">

          {/* ═══ SEARCH BAR ═══ */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c3d5f] via-[#0e4a78] to-[#164e7a] p-6 shadow-2xl mb-6">
            <div className="absolute inset-0 opacity-[0.04]" style={{backgroundImage:'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M20 20.5V18H0v-2h20v-2l2 3.5-2 3zm0-7V11H0V9h20V7l2 3.5-2 3z\' fill=\'%23fff\' fill-opacity=\'.3\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")'}} />
            <div className="relative flex flex-col md:flex-row md:items-end gap-5">
              <div className="flex-1">
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-3 mb-3">
                  <FiNavigation className="w-6 h-6 text-emerald-400" />
                  Container Lifecycle Tracker
                </h1>
                <div className="flex rounded-xl overflow-hidden bg-white/10 backdrop-blur-sm border border-white/20 focus-within:border-emerald-400/60 focus-within:ring-2 focus-within:ring-emerald-400/20 transition-all">
                  <input value={searchInput} onChange={(e) => setSearchInput(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Enter Container No (e.g. ESDU4088136)" className="flex-1 px-5 py-3.5 bg-transparent text-white text-sm font-bold placeholder:text-white/30 focus:outline-none" />
                  <button type="button" onClick={handleReset} className="px-4 text-white/40 hover:text-white transition-colors border-l border-white/10"><FiRefreshCw /></button>
                </div>
              </div>
              <button type="button" onClick={handleSearch} disabled={!searchInput.trim()}
                className={`px-8 py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center gap-2 ${searchInput.trim() ? "bg-emerald-500 text-white hover:bg-emerald-400 hover:shadow-emerald-500/30 hover:-translate-y-0.5" : "bg-white/10 text-white/30 cursor-not-allowed"}`}>
                <FiSearch /> Track
              </button>
            </div>
          </div>

          {/* ═══ RESULTS ═══ */}
          {hasSearched && (
            <>
              {isLoading ? (
                <div className="rounded-2xl bg-white border border-slate-200 p-12 text-center shadow-sm">
                  <div className="w-8 h-8 border-2 border-slate-300 border-t-[#0e4a78] rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-500">Fetching lifecycle data...</p>
                </div>
              ) : !summary ? (
                <div className="rounded-2xl bg-white border border-slate-200 p-12 text-center shadow-sm">
                  <FiBox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No history found for <strong>{searchQuery}</strong></p>
                </div>
              ) : (
                <>
                  {/* ═══ HERO BANNER ═══ */}
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a1628] via-[#0e2a45] to-[#0c3d5f] p-6 shadow-2xl mb-6">
                    <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/[0.06] rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/[0.06] rounded-full blur-3xl" />
                    <div className="relative">
                      {/* Top row */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                            <FiBox className="w-7 h-7 text-white" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.25em]">Container</p>
                            <h2 className="text-2xl md:text-3xl font-black text-white tracking-widest">{searchQuery}</h2>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-4 py-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Active in Yard</span>
                        </div>
                      </div>
                      {/* Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard icon={FiActivity} label="Total Moves" value={summary.totalMoves} color="#3b82f6" />
                        <StatCard icon={FiTruck} label="Equipments" value={summary.machinesCount} color="#8b5cf6" />
                        <StatCard icon={FiClock} label="Gate In" value={summary.gateInDate} color="#10b981" sub />
                        <StatCard icon={FiCheckCircle} label="Latest Move" value={summary.latestMoveDate} color="#f59e0b" sub />
                      </div>
                    </div>
                  </div>

                  {/* ═══ CONTAINER INFO TABLE ═══ */}
                  <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm mb-6 bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gradient-to-r from-[#0e4a78] to-[#0b3a5e]">
                          <tr>
                            {["Container No", "Size", "Type / ISO", "Status", "Gate In Date", "Gate Out Date", "Offload Date", "Last Location"].map(h => (
                              <th key={h} className="px-5 py-3 text-left font-bold text-white text-xs uppercase tracking-wider border-r border-white/10 last:border-r-0">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 font-black text-slate-900">{lifecycleMaster?.ContainerNo ?? containerInfo?.containerNo ?? searchQuery}</td>
                            <td className="px-5 py-3">
                              <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200 text-xs font-bold">
                                {lifecycleMaster?.ContainerSize ?? containerInfo?.size ?? "-"}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className="bg-purple-50 text-purple-700 px-2.5 py-1 rounded-lg border border-purple-200 text-xs font-bold">
                                {lifecycleMaster?.ContainerType ?? containerInfo?.type ?? "-"}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200 text-xs font-bold">
                                {lifecycleMaster?.Process ?? containerInfo?.status ?? "-"}
                              </span>
                            </td>
                            <td className="px-5 py-3 font-bold text-slate-700 whitespace-nowrap">{fmt(lifecycleMaster?.GateInDate) ?? gateInOut?.GateInDate ?? containerInfo?.gateInDate ?? "-"}</td>
                            <td className="px-5 py-3 font-bold text-slate-500 whitespace-nowrap">{fmt(lifecycleMaster?.GateOutDate) ?? gateInOut?.GateOutDate ?? containerInfo?.gateOutDate ?? "-"}</td>
                            <td className="px-5 py-3 font-bold text-amber-600 whitespace-nowrap">{lifecycleMaster?.TAT ?? "-"}</td>
                            <td className="px-5 py-3 text-slate-600">{offloadTimeline[offloadTimeline.length - 1]?.Area ?? containerInfo?.lastLocation ?? "-"}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ═══ TIMELINE + MAP GRID ═══ */}
                  <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mb-8">

                    {/* LEFT — Timeline */}
                    <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-[650px]">
                      <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg text-white shadow-md shadow-blue-500/20">
                          <FiLayers className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 text-base">TimeLine</h3>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Movement lifecycle events</p>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-5">

                        {/* Gate In — from GET_GATEINOUT_TIMELINE SP or fallback to inventory */}
                        <TimelineEvent icon={FiTruck} title="Gate In Details" color="#3b82f6" borderColor="#93c5fd" bgColor="bg-blue-50/50" badge={fmt(gateInOut?.GateInDate) ?? containerInfo?.gateInDate ?? "-"}>
                          <InfoRow label="Gate In Date" value={fmt(gateInOut?.GateInDate) ?? containerInfo?.gateInDate ?? "-"} />
                          <InfoRow label="Container No" value={gateInOut?.ContNo ?? lifecycleMaster?.ContainerNo ?? containerInfo?.containerNo ?? searchQuery} />
                          <InfoRow label="Size" value={lifecycleMaster?.ContainerSize ?? containerInfo?.size ?? "-"} />
                          <InfoRow label="Type" value={lifecycleMaster?.ContainerType ?? containerInfo?.type ?? "-"} />
                          <InfoRow label="Process" value={lifecycleMaster?.Process ?? containerInfo?.status ?? "-"} />
                        </TimelineEvent>

                        {/* Offload — first row of GET_OFFLOAD_TIMELINEDETAILS (oldest = initial offload) */}
                        {(() => {
                          const row = offloadTimeline[0];
                          if (!row) return null;
                          const lat = parseFloat(row.GpsLocLat), lng = parseFloat(row.GpsLocLon);
                          const hasGps = isFinite(lat) && isFinite(lng);
                          return (
                            <TimelineEvent icon={FiPackage} title="Offload Details" color="#f59e0b" borderColor="#fcd34d" bgColor="bg-amber-50/50" badge={fmt(row.TransDate)}>
                              <InfoRow label="Offload Date" value={fmt(row.TransDate)} />
                              <InfoRow label="Equipment" value={row.EquipmentName || "-"} />
                              <InfoRow label="Area" value={row.Area || "-"} />
                            </TimelineEvent>
                          );
                        })()}

                        {/* Shifting — rows after first in offload timeline (index 1+) = post-offload shifts */}
                        {offloadTimeline.length > 1 && (
                          <TimelineEvent icon={FiRefreshCw} title="Shifting Details" color="#10b981" borderColor="#6ee7b7" bgColor="bg-emerald-50/40" isLast>
                            <div className="overflow-x-auto -mx-1">
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="border-b border-emerald-200/60">
                                    {["No", "Equipment", "Date", "Area"].map(h => (
                                      <th key={h} className="text-left py-2 px-2 font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {[...offloadTimeline].slice(1).reverse().map((row, idx) => {
                                    const lat = parseFloat(row.GpsLocLat), lng = parseFloat(row.GpsLocLon);
                                    const hasGps = isFinite(lat) && isFinite(lng);
                                    const offIdx = offloadTimeline.indexOf(row);
                                    return (
                                      <tr key={idx}
                                        onClick={() => {
                                          setSelectedOffloadIdx(offIdx);
                                          if (hasGps) { setMapCenter({ lat, lng }); setMapZoom(19); setActiveMarker(`offload-${offIdx}`); }
                                        }}
                                        className={`border-b border-emerald-100/60 last:border-0 transition-colors ${hasGps ? "cursor-pointer" : ""} ${selectedOffloadIdx === offIdx ? "bg-emerald-100/80" : "hover:bg-emerald-50/80"}`}>
                                        <td className="py-2 px-2 font-bold text-slate-600">{idx + 1}</td>
                                        <td className="py-2 px-2 font-bold text-blue-700">{row.EquipmentName || "-"}</td>
                                        <td className="py-2 px-2 text-slate-700 whitespace-nowrap">{fmt(row.TransDate)}</td>
                                        <td className="py-2 px-2 text-slate-500">{row.Area || "-"}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </TimelineEvent>
                        )}
                      </div>
                    </div>

                    {/* RIGHT — Map */}
                    <div className="xl:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[450px] xl:h-[650px]">
                      <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-[#0e4a78] to-[#0b3a5e] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                            <FiMapPin className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-base">Map</h3>
                            <p className="text-[10px] text-white/50 uppercase tracking-wider">GPS tracking path</p>
                          </div>
                        </div>
                        {(selectedMoveIdx !== null || selectedOffloadIdx !== null) && (
                          <button onClick={() => { setSelectedMoveIdx(null); setSelectedOffloadIdx(null); setActiveMarker(null); if (containerPath.length) { setMapCenter(containerPath[containerPath.length - 1]); setMapZoom(18); } }}
                            className="px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-bold border border-white/20 hover:bg-white/25 transition-colors">
                            Show All
                          </button>
                        )}
                      </div>
                      <div className="flex-1 relative bg-slate-100">
                        {!isLoaded ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-slate-300 border-t-[#0e4a78] rounded-full animate-spin" />
                          </div>
                        ) : (
                          <GoogleMap mapContainerStyle={mapStyle} center={mapCenter} zoom={mapZoom} options={mapOpts}
                            onLoad={(map) => { mapRef.current = map; }}>
                            {containerPath.length > 0 && (
                              <PolylineF path={containerPath} options={{ strokeColor: "#10b981", strokeOpacity: 0.9, strokeWeight: 4 }} />
                            )}
                            {movements
                              .filter((m) => String(gf(m, "PacketId", "packetid", "PACKET_ID", "packet_id", "PacketID")) === "8")
                              .map((move, i, arr) => {
                                if (!move.lat || !move.lng) return null;
                                const isLast = i === arr.length - 1;
                                const origIdx = movements.indexOf(move);
                                const url = isLast ? "https://maps.google.com/mapfiles/ms/icons/red-dot.png" : "https://maps.google.com/mapfiles/ms/icons/blue-dot.png";
                                return (
                                  <MarkerF key={origIdx} position={{ lat: move.lat, lng: move.lng }} icon={{ url }} onClick={() => { setActiveMarker(origIdx); setSelectedMoveIdx(origIdx); setSelectedOffloadIdx(null); }}>
                                    {activeMarker === origIdx && (
                                      <InfoWindowF onCloseClick={() => setActiveMarker(null)}>
                                        <div className="p-2 min-w-[180px]">
                                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 border-b pb-1">
                                            Unlock #{i + 1}{isLast && " (Latest)"}
                                          </p>
                                          <p className="text-sm font-bold text-slate-800">{deviceNameMap.get(String(gf(move, "KALMAR_NO", "MACHINE", "DEVICE_IMEI") ?? '')) || gf(move, "KALMAR_NO", "MACHINE", "DEVICE_IMEI") || "-"}</p>
                                          <p className="text-xs text-slate-600 mt-1">{move.dateTime}</p>
                                          <p className="text-xs text-emerald-700 font-semibold mt-1">{move.locationName}</p>
                                        </div>
                                      </InfoWindowF>
                                    )}
                                  </MarkerF>
                                );
                              })}
                            {offloadTimeline.map((row, idx) => {
                              const lat = parseFloat(row.GpsLocLat);
                              const lng = parseFloat(row.GpsLocLon);
                              if (!isFinite(lat) || !isFinite(lng)) return null;
                              const isOffload = idx === 0;
                              const isLatest = idx === offloadTimeline.length - 1 && !isOffload;
                              const markerId = `offload-${idx}`;
                              // Offset duplicate coordinates so stacked markers are all visible
                              const dupOffset = 0.00003;
                              const sameLatLng = offloadTimeline.slice(0, idx).filter(r => parseFloat(r.GpsLocLat) === lat && parseFloat(r.GpsLocLon) === lng).length;
                              const adjLat = lat + sameLatLng * dupOffset;
                              const adjLng = lng + sameLatLng * dupOffset;
                              const isSelected = selectedOffloadIdx === idx && !isOffload;
                              const iconUrl = isOffload
                                ? "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png"
                                : isSelected
                                ? "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                                : isLatest
                                ? "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
                                : "https://maps.google.com/mapfiles/ms/icons/green-dot.png";
                              return (
                                <MarkerF key={markerId} position={{ lat: adjLat, lng: adjLng }}
                                  icon={{ url: iconUrl }}
                                  onClick={() => { setActiveMarker(markerId); setSelectedOffloadIdx(idx); }}>
                                  {activeMarker === markerId && (
                                    <InfoWindowF onCloseClick={() => setActiveMarker(null)}>
                                      <div className="p-2 min-w-[180px]">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 border-b pb-1">
                                          {isOffload ? "Offload" : isLatest ? "Latest Shift" : `Shift #${idx}`}
                                        </p>
                                        <p className="text-sm font-bold text-slate-800">{row.EquipmentName || "-"}</p>
                                        <p className="text-xs text-slate-600 mt-1">{fmt(row.TransDate)}</p>
                                        <p className="text-xs font-semibold mt-1" style={{ color: isOffload ? "#b45309" : isLatest ? "#dc2626" : "#15803d" }}>{row.Area || "-"}</p>
                                      </div>
                                    </InfoWindowF>
                                  )}
                                </MarkerF>
                              );
                            })}
                          </GoogleMap>
                        )}
                      </div>
                      {(movements.length > 0 || offloadTimeline.length > 0) && (
                        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-center gap-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {offloadTimeline.length > 0 && (
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> Offload</span>
                          )}
                          {offloadTimeline.length > 1 && (
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Shifting</span>
                          )}
                          {offloadTimeline.length > 1 && (
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Latest</span>
                          )}
                          {movements.some(m => String(gf(m, "PacketId", "packetid", "PACKET_ID", "packet_id", "PacketID")) === "8") && (
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Unlock</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default ContainerLifecycle;
