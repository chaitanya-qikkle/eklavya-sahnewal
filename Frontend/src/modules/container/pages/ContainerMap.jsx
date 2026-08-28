import React, { useCallback, useState, useEffect, useMemo, useRef } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  MarkerF,
  InfoWindowF,
  PolygonF,
  OverlayView,
} from "@react-google-maps/api";
import {
  FiX, FiMapPin, FiCrosshair, FiLayers, FiAlertCircle,
  FiChevronDown, FiChevronRight,
} from "react-icons/fi";
import { useGetLocationSlotsQuery } from "../../../store/api/ymsApi";

const mapContainerStyle = { width: "100%", height: "100%" };

const defaultCenter = { lat: 18.897905866934074, lng: 73.00137179085313 };

// Slot colours
const C = {
  slot:      { fill: "rgba(14,74,120,0.30)",  stroke: "#0e4a78",  sw: 1   },
  container: { fill: "rgba(239,68,68,0.55)",  stroke: "#dc2626",  sw: 2   },
  selected:  { fill: "rgba(34,197,94,0.65)",  stroke: "#15803d",  sw: 2.5 },
};

// ─── Geometry helpers ─────────────────────────────────────────────────────────

// Parse the LATLONG string: "lat lng,lat lng,lat lng,..."
// SQL Server ESS_MST_SLOT stores coords as "lat lng" pairs separated by commas.
const parseLatLong = (raw) => {
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
      // Both values are valid coords. lat is the smaller-magnitude one (~13),
      // lng is the larger one (~80).  Disambiguate by magnitude.
      if (Math.abs(a) < Math.abs(b)) return { lat: a, lng: b };
      return { lat: b, lng: a };
    })
    .filter(Boolean);
};

// Parse WKT POLYGON: "POLYGON ((lat lng, lat lng, ...))"
// SQL Server geometry column returned via .STAsText() uses "lat lng" order
// when SRID=4326 was set with lat/lng (not the OGC lng/lat standard).
// We detect which axis is which by comparing magnitudes (Chennai lat≈13, lng≈80).
const parseWKT = (raw) => {
  if (!raw || typeof raw !== "string") return [];
  const m = /POLYGON\s*\(\(([^)]+)\)/i.exec(raw.trim());
  if (!m) return [];
  return m[1]
    .split(",")
    .map((tok) => {
      const parts = tok.trim().split(/\s+/);
      if (parts.length < 2) return null;
      const a = parseFloat(parts[0]);
      const b = parseFloat(parts[1]);
      if (!isFinite(a) || !isFinite(b)) return null;
      if (Math.abs(a) < Math.abs(b)) return { lat: a, lng: b };
      return { lat: b, lng: a };
    })
    .filter(Boolean);
};

const centroid = (pts) => {
  if (!pts.length) return null;
  const s = pts.reduce((a, p) => ({ lat: a.lat + p.lat, lng: a.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: s.lat / pts.length, lng: s.lng / pts.length };
};

// ─── Main component ───────────────────────────────────────────────────────────
const ContainerMap = ({ containerNo, onClose, autoFocusContainer }) => {
  const [map, setMap]                   = useState(null);
  const [mapType, setMapType]           = useState("satellite");
  const [containers, setContainers]     = useState([]);
  const [selectedSlotId, setSelectedSlotId]   = useState(null);
  const [selectedMarker, setSelectedMarker]   = useState(null);
  const [showSlots, setShowSlots]       = useState(true);
  const [showLabels, setShowLabels]     = useState(true);
  const [activeTab, setActiveTab]       = useState("containers");
  const [expandedSlotId, setExpandedSlotId]   = useState(null);
  const fittedRef = useRef(false);

  // Live GPS — my position
  const [myPos, setMyPos]       = useState(null);
  const [gpsOn, setGpsOn]       = useState(false);
  const [gpsErr, setGpsErr]     = useState(null);
  const [gpsAcc, setGpsAcc]     = useState(null);
  const gpsWatchRef             = useRef(null);

  const startGps = useCallback(() => {
    if (!navigator.geolocation) { setGpsErr("GPS not supported"); return; }
    setGpsErr(null); setGpsOn(true);
    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (p) => { setMyPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setGpsAcc(Math.round(p.coords.accuracy)); },
      (e) => setGpsErr(e.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  }, []);

  const stopGps = useCallback(() => {
    if (gpsWatchRef.current != null) navigator.geolocation.clearWatch(gpsWatchRef.current);
    gpsWatchRef.current = null;
    setGpsOn(false); setMyPos(null); setGpsErr(null); setGpsAcc(null);
  }, []);

  useEffect(() => () => { if (gpsWatchRef.current != null) navigator.geolocation.clearWatch(gpsWatchRef.current); }, []);

  // Normalise input containerNo → array of objects
  useEffect(() => {
    if (!containerNo) { setContainers([]); return; }
    if (typeof containerNo === "string") setContainers([{ CONTAINER_NO: containerNo }]);
    else if (Array.isArray(containerNo)) setContainers(containerNo);
    else setContainers([containerNo]);
  }, [containerNo]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY || "",
  });

  const { data: slotsResponse, isFetching: slotsLoading, error: slotsError } =
    useGetLocationSlotsQuery();

  // ── Parse slot rows from ESS_MST_SLOT ──────────────────────────────────────
  const slots = useMemo(() => {
    const rows = slotsResponse?.data || [];
    if (rows.length > 0) {
      console.log("[ContainerMap] location-slots sample row:", rows[0]);
      console.log("[ContainerMap] total slot rows:", rows.length);
    } else {
      console.warn("[ContainerMap] location-slots returned 0 rows", slotsResponse);
    }
    return rows
      .map((row, idx) => {
        // Field names from ESS_MST_SLOT: SLOTNAME, BLOCK, [COLUMN], [ROW],
        // YARDID, status, LATLONG, POLYGON (geometry stored as WKT string by SP)
        const slotName = row.SLOTNAME ?? row.SlotName ?? row.slotname ?? `Slot-${idx}`;
        const block    = row.BLOCK    ?? row.Block    ?? row.BlockId  ?? "";
        const rowLabel = row.ROW      ?? row.Row      ?? row.row      ?? "";
        const col      = row.COLUMN   ?? row.Column   ?? row.column   ?? row.COL ?? "";
        const slotId   = row.SlotId   ?? row.SLOTID   ?? row.SlotID   ?? `slot-${idx}`;

        // Try LATLONG first (reliable comma-separated "lat lng" pairs),
        // then fall back to POLYGON WKT returned by SP.
        let polygon = [];
        const latlong = row.LATLONG ?? row.LatLong ?? row.latlong ?? "";
        if (latlong) polygon = parseLatLong(String(latlong));

        if (polygon.length < 3) {
          const wkt = row.PolygonWKT ?? row.POLYGON ?? row.Polygon ?? row.polygon ?? "";
          if (wkt) polygon = parseWKT(String(wkt));
        }

        // Deduplicate closing vertex (WKT repeats first point at end)
        if (polygon.length > 1) {
          const first = polygon[0], last = polygon[polygon.length - 1];
          if (first.lat === last.lat && first.lng === last.lng) polygon = polygon.slice(0, -1);
        }

        if (polygon.length < 3) {
          // No polygon data — log the first few to help diagnose
          if (idx < 3) console.warn("[ContainerMap] slot has no usable polygon:", row);
          return null;
        }

        // Detect slot orientation from polygon extents
        const lats = polygon.map(p => p.lat);
        const lngs = polygon.map(p => p.lng);
        const latSpan = Math.max(...lats) - Math.min(...lats);
        const lngSpan = Math.max(...lngs) - Math.min(...lngs);
        // 1° lat ≈ 111km, 1° lng ≈ 98km at Chennai — normalize to metres
        const isVerticalSlot = latSpan * 111000 > lngSpan * 98000;

        return {
          id: String(slotId),
          name: String(slotName),
          block: String(block),
          row: String(rowLabel),
          col: String(col),
          center: centroid(polygon),
          polygon,
          raw: row,
          isVerticalSlot,
        };
      })
      .filter(Boolean);
  }, [slotsResponse]);

  // Index slots by name (upper-case) for quick container→slot lookup
  const slotByName = useMemo(() => {
    const m = new Map();
    for (const s of slots) m.set(s.name.toUpperCase(), s);
    return m;
  }, [slots]);

  // Find the slot assigned to a container
  const containerSlot = useCallback((c) => {
    const candidates = [
      c.MASTERTABLE !== "EMPTY-YARD" ? c.MASTERTABLE : null,
      c.location,
      c.LOCATION_NAME,
      c.ContainerLocationName,
      c.SLOT_NAME,
      c.LOCATION_NAME_20FT,
    ];
    for (const key of candidates) {
      if (key && String(key).trim() && String(key).trim().toUpperCase() !== "EMPTY-YARD") {
        const hit = slotByName.get(String(key).trim().toUpperCase());
        if (hit) return hit;
      }
    }
    // Fallback: match by block+row+col if individual slot not found
    if (c.BLOCK_NAME && c.ROW_NO != null && c.COLUMN_NAME) {
      const blockKey = String(c.BLOCK_NAME).trim().toUpperCase();
      const rowKey   = String(c.ROW_NO).trim();
      const colKey   = String(c.COLUMN_NAME).trim().toUpperCase();
      for (const s of slots) {
        if (
          s.block.toUpperCase() === blockKey &&
          s.row.toUpperCase()   === rowKey &&
          s.col.toUpperCase()   === colKey
        ) return s;
      }
    }
    return null;
  }, [slotByName, slots]);

  const containerSlotIds = useMemo(() => {
    const s = new Set();
    containers.forEach((c) => { const sl = containerSlot(c); if (sl) s.add(sl.id); });
    return s;
  }, [containers, containerSlot]);

  // Block outlines — convex hull centroid per block for the label
  const blockCentroids = useMemo(() => {
    const m = new Map();
    for (const s of slots) {
      if (!s.block) continue;
      if (!m.has(s.block)) m.set(s.block, []);
      m.get(s.block).push(...s.polygon);
    }
    const out = [];
    for (const [block, pts] of m) {
      const c = centroid(pts);
      if (c) out.push({ block, center: c });
    }
    return out;
  }, [slots]);

  // Auto-focus a specific container once map + containers + slots are ready
  useEffect(() => {
    if (!autoFocusContainer || !map) return;
    const target = containers.find((c) => c.CONTAINER_NO === autoFocusContainer);
    if (!target) return;
    // Slight delay so fitBounds (normal auto-fit) runs first
    const t = setTimeout(() => {
      const lat = parseFloat(target.OFFLOAD_LAT), lng = parseFloat(target.OFFLOAD_LON);
      const pos = (isFinite(lat) && isFinite(lng)) ? { lat, lng } : containerSlot(target)?.center;
      if (pos) { map.panTo(pos); map.setZoom(22); }
      setSelectedMarker(target);
    }, 400);
    return () => clearTimeout(t);
  }, [autoFocusContainer, map, containers, slots, containerSlot]);

  // Auto-fit bounds once slots loaded
  useEffect(() => {
    if (!map || fittedRef.current || !window.google?.maps) return;
    if (slots.length === 0 && containers.length === 0) return;
    const bounds = new window.google.maps.LatLngBounds();
    let hit = false;
    containers.forEach((c) => {
      const lat = parseFloat(c.OFFLOAD_LAT), lng = parseFloat(c.OFFLOAD_LON);
      if (isFinite(lat) && isFinite(lng)) { bounds.extend({ lat, lng }); hit = true; }
      else {
        const sl = containerSlot(c);
        if (sl?.center) { bounds.extend(sl.center); hit = true; }
      }
    });
    if (!hit) slots.forEach((s) => { if (s.center) { bounds.extend(s.center); hit = true; } });
    if (hit) {
      map.fitBounds(bounds, { top: 80, right: 40, bottom: 40, left: 40 });
      const l = window.google.maps.event.addListenerOnce(map, "idle", () => {
        if (map.getZoom() > 21) map.setZoom(21);
      });
      fittedRef.current = true;
      return () => window.google.maps.event.removeListener(l);
    }
  }, [map, slots, containers, containerSlot]);

  const focusSlot = (s) => {
    if (!map || !s?.center) return;
    map.panTo(s.center); map.setZoom(22);
    setSelectedSlotId(s.id);
  };

  const focusContainer = (c) => {
    if (!map) return;
    const lat = parseFloat(c.OFFLOAD_LAT), lng = parseFloat(c.OFFLOAD_LON);
    let pos = (isFinite(lat) && isFinite(lng)) ? { lat, lng } : containerSlot(c)?.center;
    if (!pos) return;
    map.panTo(pos); map.setZoom(22);
    setSelectedMarker(c);
  };

  const getProcessColor = (p) => {
    switch (String(p || "").toLowerCase()) {
      case "import": return "#10b981";
      case "export": return "#f59e0b";
      case "empty":  return "#64748b";
      default:       return "#0e4a78";
    }
  };

  if (loadError) return (
    <div className="h-full flex items-center justify-center bg-red-50 rounded-2xl">
      <div className="text-center p-6">
        <FiAlertCircle className="text-4xl text-red-500 mx-auto mb-3" />
        <p className="text-red-800 font-semibold">Map failed to load</p>
        <p className="text-red-600 text-sm mt-1">Check the Google Maps API key.</p>
        <button onClick={onClose} className="mt-4 px-5 py-2 bg-red-600 text-white rounded-lg text-sm">Close</button>
      </div>
    </div>
  );

  if (!isLoaded) return (
    <div className="h-full flex items-center justify-center bg-slate-100 rounded-2xl">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-[#0e4a78] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-600 font-medium text-sm">Loading map…</p>
      </div>
    </div>
  );

  const gpsActive = containers.filter(
    (c) => isFinite(parseFloat(c.OFFLOAD_LAT)) && isFinite(parseFloat(c.OFFLOAD_LON))
  ).length;

  return (
    <div className="h-full flex rounded-2xl overflow-hidden bg-white">

      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <aside className="w-[340px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0e4a78] to-[#072c4a] text-white px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Yard Live Map</p>
            <p className="text-sm font-semibold mt-0.5">
              {containers.length} container{containers.length !== 1 ? "s" : ""} · {slots.length} slots
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 transition">
            <FiX className="text-lg" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          {[
            { key: "containers", count: containers.length },
            { key: "slots",      count: slotsLoading ? "…" : slots.length },
          ].map(({ key, count }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider transition
                ${activeTab === key ? "text-[#0e4a78] border-b-2 border-[#0e4a78] bg-white" : "text-slate-500 hover:text-slate-700"}`}>
              {key} <span className="font-semibold text-slate-400 ml-1">{count}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {activeTab === "containers" ? (
            containers.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <FiMapPin className="mx-auto text-3xl mb-2 text-slate-300" />
                <p className="text-xs">No containers selected</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-100 text-slate-500 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide">Container</th>
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide w-14">Size</th>
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {containers.map((c, i) => {
                    const hasGps = isFinite(parseFloat(c.OFFLOAD_LAT)) && isFinite(parseFloat(c.OFFLOAD_LON));
                    const slot = containerSlot(c);
                    const sel = selectedMarker?.CONTAINER_NO === c.CONTAINER_NO;
                    return (
                      <tr key={`${c.CONTAINER_NO}-${i}`}
                        className={`border-b border-slate-100 cursor-pointer transition
                          ${sel ? "bg-blue-50" : "hover:bg-slate-50"}`}
                        onClick={() => (hasGps || slot?.center) && focusContainer(c)}>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: getProcessColor(c.CONTAINER_PROCESS) }} />
                            <span className="font-mono font-semibold text-[#0e4a78] text-[11px]">{c.CONTAINER_NO}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{c.CONTAINER_SIZE ? `${c.CONTAINER_SIZE}ft` : "—"}</td>
                        <td className="px-3 py-2.5">
                          {hasGps
                            ? <Badge color="emerald" icon={<FiCrosshair />}>GPS</Badge>
                            : slot?.center
                            ? <Badge color="amber">Slot</Badge>
                            : <Badge color="slate">No fix</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : slotsLoading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-7 h-7 border-2 border-[#0e4a78] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Loading slots…</p>
            </div>
          ) : slots.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <FiMapPin className="mx-auto text-3xl mb-2 text-slate-300" />
              <p className="text-xs">No slots returned</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {slots.map((s) => {
                const isOpen = expandedSlotId === s.id;
                const isSel  = selectedSlotId === s.id;
                return (
                  <li key={s.id} className={`px-3 py-2 transition ${isSel ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setExpandedSlotId(isOpen ? null : s.id)} className="flex-1 flex items-center gap-1.5 text-left min-w-0">
                        <span className="text-slate-400 flex-shrink-0">{isOpen ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}</span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-[#0e4a78] truncate">{s.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {[s.block && `Block ${s.block}`, s.row && `Row ${s.row}`, s.col && `Col ${s.col}`].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </button>
                      <button onClick={() => focusSlot(s)}
                        className="px-2 py-0.5 text-[10px] font-semibold text-[#0e4a78] border border-[#0e4a78]/20 rounded hover:bg-[#0e4a78] hover:text-white transition flex-shrink-0">
                        Focus
                      </button>
                    </div>
                    {isOpen && (
                      <div className="mt-1.5 ml-4 text-[10px] bg-slate-50 border border-slate-200 rounded p-2 space-y-0.5">
                        {Object.entries(s.raw).slice(0, 12).map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="text-slate-400 font-semibold uppercase w-20 flex-shrink-0 truncate">{k}</span>
                            <span className="text-slate-700 font-mono break-all">{v == null ? "—" : String(v).slice(0, 60)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Legend */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Legend</p>
          <LegRow color="#10b981" label="Import container" dot />
          <LegRow color="#f59e0b" label="Export container" dot />
          <LegRow color="#64748b" label="Empty container" dot />
          <LegRow color="#dc2626" label="Container slot" box border="#dc2626" />
          <LegRow color="rgba(14,74,120,0.30)" label="Empty slot" box border="#0e4a78" />
          <LegRow color="rgba(34,197,94,0.55)" label="Selected slot" box border="#15803d" />
        </div>
      </aside>

      {/* ── MAP PANEL ──────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        {/* Map top bar */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-[#0e4a78] to-[#072c4a] text-white px-4 py-2.5 shadow-lg flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Live Map</p>
            <p className="text-xs font-semibold">{gpsActive} GPS · {slots.length} slots</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle labels */}
            <button onClick={() => setShowLabels((v) => !v)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded transition
                ${showLabels ? "bg-white text-[#0e4a78]" : "bg-white/15 text-white border border-white/30"}`}>
              Labels
            </button>
            {/* Toggle slots */}
            <button onClick={() => setShowSlots((v) => !v)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded transition
                ${showSlots ? "bg-white text-[#0e4a78]" : "bg-white/15 text-white border border-white/30"}`}>
              <FiLayers size={11} /> Slots
            </button>
            {/* My Live Location */}
            <button onClick={gpsOn ? stopGps : startGps}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded transition
                ${gpsOn && myPos ? "bg-cyan-400 text-[#0e4a78]" : gpsOn ? "bg-yellow-400 text-[#0e4a78] animate-pulse" : "bg-white/15 text-white border border-white/30"}`}>
              <FiCrosshair size={11} /> {gpsOn && myPos ? "Live" : gpsOn ? "…" : "My Location"}
            </button>
            {/* Map type */}
            <div className="flex gap-0.5 bg-white/10 border border-white/20 rounded p-0.5">
              {["roadmap", "satellite"].map((t) => (
                <button key={t} onClick={() => { setMapType(t); if (map) map.setMapTypeId(t); }}
                  className={`px-2.5 py-0.5 text-[11px] font-semibold rounded transition capitalize
                    ${mapType === t ? "bg-white text-[#0e4a78]" : "text-white hover:bg-white/15"}`}>
                  {t === "roadmap" ? "Map" : "Satellite"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {slotsError && (
          <div className="absolute top-14 left-4 right-4 z-10 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded shadow">
            Could not load yard slots — showing containers only.
          </div>
        )}

        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={19}
          onLoad={(m) => setMap(m)}
          onUnmount={() => setMap(null)}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
            zoomControl: true,
            mapTypeId: mapType,
            gestureHandling: "greedy",
          }}
        >
          {/* ── Slot polygons ── */}
          {showSlots && slots.map((s) => {
            const isContainer = containerSlotIds.has(s.id);
            const isSel       = selectedSlotId === s.id;
            const cfg = isSel ? C.selected : isContainer ? C.container : C.slot;
            return (
              <PolygonF key={`poly-${s.id}`}
                paths={s.polygon}
                options={{
                  fillColor:    cfg.fill,
                  fillOpacity:  1,
                  strokeColor:  cfg.stroke,
                  strokeOpacity: 1,
                  strokeWeight: cfg.sw,
                  clickable:    true,
                  zIndex:       isSel ? 50 : isContainer ? 30 : 10,
                }}
                onClick={() => focusSlot(s)}
              />
            );
          })}

          {/* ── Slot labels — aligned along long axis, clipped to slot width ── */}
          {showSlots && showLabels && slots.map((s) => {
            if (!s.center || s.polygon.length < 2) return null;
            const isContainer = containerSlotIds.has(s.id);
            const isSel       = selectedSlotId === s.id;
            const color = isSel ? "#86efac" : isContainer ? "#fde68a" : "#fff";

            // Short name: "B01:A:337:1" → "A:337" (drop block prefix and tier suffix)
            const nameParts = s.name.replace(/^BLOCK-/i, "").split(":");
            const shortName = nameParts.length > 2 ? nameParts.slice(1, -1).join(":") : (nameParts[0] || s.name);

            // Angle from longest edge
            let maxLen = 0, angleDeg = 0;
            for (let i = 0; i < s.polygon.length; i++) {
              const p1 = s.polygon[i];
              const p2 = s.polygon[(i + 1) % s.polygon.length];
              const dLat = (p2.lat - p1.lat) * 111000;
              const dLng = (p2.lng - p1.lng) * 98000;
              const len = Math.sqrt(dLat * dLat + dLng * dLng);
              if (len > maxLen) {
                maxLen = len;
                angleDeg = Math.atan2(dLng, dLat) * (180 / Math.PI);
              }
            }
            // Rotate 90° so text runs along the long axis (not perpendicular to it)
            angleDeg += 90;
            if (angleDeg > 90)  angleDeg -= 180;
            if (angleDeg < -90) angleDeg += 180;

            return (
              <OverlayView key={`lbl-${s.id}`} position={s.center}
                mapPaneName={OverlayView.OVERLAY_LAYER}>
                <div style={{
                  position: "absolute",
                  transform: `translate(-50%,-50%) rotate(${angleDeg}deg)`,
                  userSelect: "none",
                  pointerEvents: "none",
                }}>
                  <span style={{
                    fontSize: "8px",
                    fontWeight: 800,
                    color,
                    textShadow: "0 0 2px #000, 0 0 3px #000",
                    whiteSpace: "nowrap",
                    lineHeight: 1,
                  }}>{shortName}</span>
                </div>
              </OverlayView>
            );
          })}

          {/* ── Block name labels ── */}
          {showSlots && showLabels && blockCentroids.map(({ block, center: bc }) => (
            <OverlayView key={`blk-${block}`} position={bc}
              mapPaneName={OverlayView.OVERLAY_LAYER}>
              <div style={{ transform: "translate(-50%,-50%)", pointerEvents: "none",
                userSelect: "none", textAlign: "center" }}>
                <div style={{
                  fontSize: "11px", fontWeight: 900, color: "#fbbf24",
                  textShadow: "0 0 4px #000,0 0 8px #000,1px 1px 0 #000",
                  letterSpacing: "0.06em", whiteSpace: "nowrap",
                  background: "rgba(0,0,0,0.5)",
                  padding: "1px 6px", borderRadius: "3px",
                }}>
                  {block}
                </div>
              </div>
            </OverlayView>
          ))}

          {/* ── Container markers ── */}
          {containers.map((c, i) => {
            const lat = parseFloat(c.OFFLOAD_LAT), lng = parseFloat(c.OFFLOAD_LON);
            let pos = (isFinite(lat) && isFinite(lng)) ? { lat, lng } : containerSlot(c)?.center;
            if (!pos) return null;
            return (
              <MarkerF key={`marker-${c.CONTAINER_NO}-${i}`}
                position={pos} title={c.CONTAINER_NO} zIndex={1000}
                icon={{
                  path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                  scale: 7,
                  fillColor: getProcessColor(c.CONTAINER_PROCESS),
                  fillOpacity: 1,
                  strokeColor: "#fff",
                  strokeWeight: 2,
                }}
                onClick={() => setSelectedMarker(c)}
              />
            );
          })}

          {/* ── Container info window ── */}
          {selectedMarker && (() => {
            const lat = parseFloat(selectedMarker.OFFLOAD_LAT), lng = parseFloat(selectedMarker.OFFLOAD_LON);
            let pos = (isFinite(lat) && isFinite(lng)) ? { lat, lng } : containerSlot(selectedMarker)?.center;
            if (!pos) return null;
            return (
              <InfoWindowF position={pos} onCloseClick={() => setSelectedMarker(null)}>
                <div style={{ minWidth: 220, maxWidth: 260, fontFamily: "inherit", overflow: "hidden" }}>
                  <div style={{
                    background: "linear-gradient(135deg,#0e4a78,#072c4a)",
                    color: "#fff", padding: "8px 12px 8px 12px",
                    borderRadius: "4px 4px 0 0",
                    display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8,
                  }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, fontFamily: "monospace", letterSpacing: 1 }}>
                        {selectedMarker.CONTAINER_NO}
                      </div>
                      {selectedMarker.CONTAINER_PROCESS && (
                        <div style={{
                          display: "inline-block", marginTop: 3,
                          background: "rgba(255,255,255,0.2)", borderRadius: 3,
                          padding: "1px 6px", fontSize: 9, fontWeight: 700,
                          textTransform: "uppercase", letterSpacing: 0.8,
                        }}>
                          {selectedMarker.CONTAINER_PROCESS}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedMarker(null)}
                      style={{
                        background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 4,
                        color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700,
                        lineHeight: 1, padding: "2px 6px", flexShrink: 0,
                      }}
                    >✕</button>
                  </div>
                  <div style={{ padding: "0 4px 4px", fontSize: 11, color: "#334155" }}>
                    {[
                      selectedMarker.BLOCK_NAME && ["Block", selectedMarker.BLOCK_NAME],
                      (selectedMarker.location || selectedMarker.MASTERTABLE) && ["Slot", selectedMarker.location || selectedMarker.MASTERTABLE],
                      selectedMarker.INVENTORY_STATUS && ["Status", selectedMarker.INVENTORY_STATUS],
                      selectedMarker.OFFLOAD_EQP && ["Vehicle", selectedMarker.OFFLOAD_EQP],
                      (selectedMarker.TOSS_IN_DATE || selectedMarker.GATE_IN_DATE) && ["Last Updated", (selectedMarker.TOSS_IN_DATE || selectedMarker.GATE_IN_DATE || "").replace("T", " ")],
                      selectedMarker.CONTAINER_SIZE && ["Size / Type", `${selectedMarker.CONTAINER_SIZE}ft ${selectedMarker.CONTAINER_TYPE || ""}`],
                    ].filter(Boolean).map(([label, value]) => (
                      <div key={label} style={{ display: "flex", gap: 6, marginBottom: 3, alignItems: "baseline" }}>
                        <span style={{ fontWeight: 700, color: "#64748b", minWidth: 72, flexShrink: 0 }}>{label}:</span>
                        <span style={{ fontWeight: 600, color: "#0f172a" }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </InfoWindowF>
            );
          })()}

        </GoogleMap>

        {/* GPS error toast */}
        {gpsErr && (
          <div style={{
            position: "absolute", bottom: 16, right: 16, zIndex: 30,
            background: "#fef2f2", border: "1px solid #fca5a5",
            borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#dc2626",
          }}>
            ⚠ {gpsErr}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Small helpers ─────────────────────────────────────────────────────────────
const Badge = ({ color, children, icon }) => {
  const cls = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    amber:   "bg-amber-50 text-amber-700 ring-amber-600/20",
    slate:   "bg-slate-100 text-slate-500 ring-slate-300",
  }[color] || "bg-slate-100 text-slate-500 ring-slate-300";
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ring-1 ring-inset ${cls}`}>
      {icon}{children}
    </span>
  );
};

const LegRow = ({ color, label, dot, box, border }) => (
  <div className="flex items-center gap-2 text-[11px] text-slate-600">
    {dot && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />}
    {box && <span className="w-4 h-2.5 rounded-sm flex-shrink-0 border" style={{ background: color, borderColor: border }} />}
    <span>{label}</span>
  </div>
);

export default ContainerMap;
