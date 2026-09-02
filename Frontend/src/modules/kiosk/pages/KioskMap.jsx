import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader, PolygonF, OverlayView } from "@react-google-maps/api";
import { FiX, FiAlertCircle, FiMapPin, FiPackage, FiCheckCircle } from "react-icons/fi";
import { useGetLocationSlotsQuery } from "../../../store/api/ymsApi";

const mapContainerStyle = { width: "100%", height: "100%" };
const defaultCenter = { lat: 30.8327483520962, lng:  75.98702828893376 };

const parseLatLong = (raw) => {
  if (!raw || typeof raw !== "string") return [];
  return raw.trim().split(",").map((tok) => {
    const parts = tok.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const a = parseFloat
    (parts[0]), b = parseFloat(parts[1]);
    if (!isFinite(a) || !isFinite(b)) return null;
    return Math.abs(a) < Math.abs(b) ? { lat: a, lng: b } : { lat: b, lng: a };
  }).filter(Boolean);
};

const parseWKT = (raw) => {
  if (!raw || typeof raw !== "string") return [];
  const m = /POLYGON\s*\(\(([^)]+)\)/i.exec(raw.trim());
  if (!m) return [];
  return m[1].split(",").map((tok) => {
    const parts = tok.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const a = parseFloat(parts[0]), b = parseFloat(parts[1]);
    if (!isFinite(a) || !isFinite(b)) return null;
    return Math.abs(a) < Math.abs(b) ? { lat: a, lng: b } : { lat: b, lng: a };
  }).filter(Boolean);
};

const centroid = (pts) => {
  if (!pts.length) return null;
  const s = pts.reduce((a, p) => ({ lat: a.lat + p.lat, lng: a.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: s.lat / pts.length, lng: s.lng / pts.length };
};

const KioskMap = ({ container, onClose }) => {
  const [map, setMap] = useState(null);
  const fittedRef = useRef(false);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY || "",
  });

  const { data: slotsResponse } = useGetLocationSlotsQuery();

  // Parse all slots
  const slots = useMemo(() => {
    const rows = slotsResponse?.data || [];
    return rows.map((row, idx) => {
      const slotName = row.SLOTNAME ?? row.SlotName ?? row.slotname ?? `Slot-${idx}`;
      const block    = row.BlockName ?? row.BLOCK ?? row.Block ?? row.BlockId ?? "";
      const rowLabel = row.ROW ?? row.Row ?? row.row ?? "";
      const col      = row.COLUMN ?? row.Column ?? row.column ?? row.COL ?? "";
      const slotId   = row.SlotId ?? row.SLOTID ?? row.SlotID ?? `slot-${idx}`;

      let polygon = [];
      const latlong = row.LATLONG ?? row.LatLong ?? row.latlong ?? "";
      if (latlong) polygon = parseLatLong(String(latlong));
      if (polygon.length < 3) {
        const wkt = row.PolygonWKT ?? row.POLYGON ?? row.Polygon ?? row.polygon ?? "";
        if (wkt) polygon = parseWKT(String(wkt));
      }
      if (polygon.length > 1) {
        const first = polygon[0], last = polygon[polygon.length - 1];
        if (first.lat === last.lat && first.lng === last.lng) polygon = polygon.slice(0, -1);
      }
      if (polygon.length < 3) return null;

      const lats = polygon.map(p => p.lat);
      const lngs = polygon.map(p => p.lng);
      const latSpan = Math.max(...lats) - Math.min(...lats);
      const lngSpan = Math.max(...lngs) - Math.min(...lngs);
      const isVerticalSlot = latSpan * 111000 > lngSpan * 98000;

      return { id: String(slotId), name: String(slotName), block: String(block), row: String(rowLabel), col: String(col), polygon, center: centroid(polygon), isVerticalSlot };
    }).filter(Boolean);
  }, [slotsResponse]);

  const slotByName = useMemo(() => {
    const m = new Map();
    for (const s of slots) m.set(s.name.toUpperCase(), s);
    return m;
  }, [slots]);

  // Find container's slot — same matching logic as ContainerMap.jsx (which
  // powers LiveStatus.jsx's "Show on Map"), since both consume the same
  // GET_CONTAINERLIVESTATUS-shaped rows: name/location string match first,
  // then block+row+col as a fallback.
  const containerSlot = useMemo(() => {
    if (!container) return null;
    const candidates = [
      container.MASTERTABLE !== "EMPTY-YARD" ? container.MASTERTABLE : null,
      container.location,
      container.LOCATION_NAME,
      container.SLOT_NAME,
    ];
    for (const key of candidates) {
      if (key && String(key).trim() && String(key).trim().toUpperCase() !== "EMPTY-YARD") {
        const hit = slotByName.get(String(key).trim().toUpperCase());
        if (hit) return hit;
      }
    }
    if (container.BLOCK_NAME && container.ROW_NO != null && container.COLUMN_NAME) {
      const bk = String(container.BLOCK_NAME).trim().toUpperCase();
      const rk = String(container.ROW_NO).trim();
      const ck = String(container.COLUMN_NAME).trim().toUpperCase();
      for (const s of slots) {
        if (s.block.toUpperCase() === bk && s.row.toUpperCase() === rk && s.col.toUpperCase() === ck) return s;
      }
    }
    return null;
  }, [container, slotByName, slots]);

  // Only show slots in the same block as the container's slot
  const blockName = containerSlot?.block || container?.BLOCK_NAME || "";
  const blockSlots = useMemo(() => {
    if (!blockName) return [];
    return slots.filter(s => s.block.toUpperCase() === blockName.toUpperCase());
  }, [slots, blockName]);

  // Block centroid for label
  const blockCenter = useMemo(() => {
    if (!blockSlots.length) return null;
    const pts = blockSlots.flatMap(s => s.polygon);
    return centroid(pts);
  }, [blockSlots]);

  // Container marker position — GPS coords first, then slot centroid
  const markerPos = useMemo(() => {
    if (!container) return null;
    const lat = parseFloat(container.OFFLOAD_LAT), lng = parseFloat(container.OFFLOAD_LON);
    if (isFinite(lat) && isFinite(lng) && (lat !== 0 || lng !== 0)) return { lat, lng };
    return containerSlot?.center || null;
  }, [container, containerSlot]);

  // Auto-fit to block — re-runs whenever slots or markerPos change, only locks after a real fit
  useEffect(() => {
    if (!map || fittedRef.current || !window.google?.maps) return;
    const bounds = new window.google.maps.LatLngBounds();
    let hit = false;
    if (markerPos) { bounds.extend(markerPos); hit = true; }
    blockSlots.forEach(s => s.polygon.forEach(p => { bounds.extend(p); hit = true; }));
    if (!hit) return; // don't lock fittedRef — wait for data to arrive
    map.fitBounds(bounds, { top: 80, right: 40, bottom: 40, left: 40 });
    window.google.maps.event.addListenerOnce(map, "idle", () => {
      if (map.getZoom() > 21) map.setZoom(21);
    });
    fittedRef.current = true;
  }, [map, markerPos, blockSlots]);

  if (loadError) return (
    <div className="w-screen h-screen flex items-center justify-center bg-red-50">
      <div className="text-center p-8">
        <FiAlertCircle className="text-5xl text-red-500 mx-auto mb-4" />
        <p className="text-red-800 font-bold text-lg">Map failed to load</p>
        <p className="text-red-600 text-sm mt-2">Check the Google Maps API key.</p>
        <button onPointerDown={(e) => { e.preventDefault(); onClose(); }} className="mt-6 px-6 py-3 bg-red-600 text-white rounded-xl font-bold">← Back</button>
      </div>
    </div>
  );

  if (!isLoaded) return (
    <div className="w-screen h-screen flex items-center justify-center bg-slate-100">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#0e4a78] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 font-semibold">Loading map…</p>
      </div>
    </div>
  );

  return (
    <div className="w-screen h-screen flex flex-col">

      {/* Header */}
      <div className="flex-shrink-0 bg-[#012541] px-6 py-3 flex items-center justify-between shadow-xl">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300">Container Location</p>
          <p className="text-white font-black text-lg font-mono tracking-widest">{container?.CONTAINER_NO}</p>
        </div>
        <div className="flex items-center gap-6">
          {blockName && (
            <div className="text-right">
              <p className="text-[10px] text-blue-300 uppercase tracking-widest font-bold">Block</p>
              <p className="text-white font-black text-xl">{blockName}</p>
            </div>
          )}
          {containerSlot && (
            <div className="text-right">
              <p className="text-[10px] text-blue-300 uppercase tracking-widest font-bold">Slot</p>
              <p className="text-white font-black text-xl">{containerSlot.name}</p>
            </div>
          )}
          {container?.CONTAINER_SIZE && (
            <div className="text-right">
              <p className="text-[10px] text-blue-300 uppercase tracking-widest font-bold">Size</p>
              <p className="text-white font-black text-xl">{container.CONTAINER_SIZE}ft</p>
            </div>
          )}
          <button
            onPointerDown={(e) => { e.preventDefault(); onClose(); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl transition shadow-lg"
          >
            <FiX className="text-lg" /> Back
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={19}
          onLoad={(m) => setMap(m)}
          onUnmount={() => setMap(null)}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            zoomControl: true,
            mapTypeId: "satellite",
            gestureHandling: "greedy",
          }}
        >
          {/* Only show slots in the container's block */}
          {blockSlots.map((s) => {
            const isContainerSlot = containerSlot?.id === s.id;
            return (
              <PolygonF key={s.id}
                paths={s.polygon}
                options={{
                  fillColor:    isContainerSlot ? "rgba(34,197,94,0.65)" : "rgba(14,74,120,0.30)",
                  fillOpacity:  1,
                  strokeColor:  isContainerSlot ? "#15803d" : "#0e4a78",
                  strokeOpacity: 1,
                  strokeWeight: isContainerSlot ? 2.5 : 1,
                  clickable: false,
                  zIndex: isContainerSlot ? 30 : 10,
                }}
              />
            );
          })}

          {/* Slot name labels within the block */}
          {blockSlots.map((s) => {
            if (!s.center) return null;
            const isContainerSlot = containerSlot?.id === s.id;
            return (
              <OverlayView key={`lbl-${s.id}`} position={s.center} mapPaneName={OverlayView.OVERLAY_LAYER}>
                <div style={{ transform: "translate(-50%,-50%)", pointerEvents: "none", userSelect: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width:  s.isVerticalSlot ? "16px" : "56px",
                  height: s.isVerticalSlot ? "56px" : "16px", overflow: "hidden" }}>
                  <div style={{
                    fontSize: "9px", fontWeight: 800,
                    color: isContainerSlot ? "#86efac" : "#fff",
                    textShadow: "0 0 3px rgba(0,0,0,1)",
                    lineHeight: 1.1, whiteSpace: "nowrap", textAlign: "center",
                    writingMode: s.isVerticalSlot ? "vertical-rl" : "horizontal-tb",
                    transform:   s.isVerticalSlot ? "rotate(180deg)" : "none",
                  }}>{s.name}</div>
                </div>
              </OverlayView>
            );
          })}

          {/* Block name label */}
          {blockCenter && (
            <OverlayView position={blockCenter} mapPaneName={OverlayView.OVERLAY_LAYER}>
              <div style={{ transform: "translate(-50%,-50%)", pointerEvents: "none", userSelect: "none", textAlign: "center" }}>
                <div style={{
                  fontSize: "13px", fontWeight: 900, color: "#fbbf24",
                  textShadow: "0 0 4px #000,0 0 8px #000",
                  letterSpacing: "0.06em", whiteSpace: "nowrap",
                  background: "rgba(0,0,0,0.55)", padding: "2px 8px", borderRadius: "4px",
                }}>
                  {blockName}
                </div>
              </div>
            </OverlayView>
          )}

          {/* Pin icon exactly at marker position */}
          {markerPos && (
            <OverlayView position={markerPos} mapPaneName={OverlayView.FLOAT_PANE}>
              <div style={{ transform: "translate(-50%, -100%)", pointerEvents: "none", userSelect: "none", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <ellipse cx="18" cy="42" rx="6" ry="2" fill="rgba(0,0,0,0.25)" />
                  <path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 26 14 26S32 26 32 16C32 8.268 25.732 2 18 2z" fill="#ef4444" stroke="#fff" strokeWidth="2"/>
                  <circle cx="18" cy="16" r="5" fill="#fff"/>
                </svg>
              </div>
            </OverlayView>
          )}

          {/* Info card — above the pin */}
          {markerPos && (() => {
            const parts = [
              blockName,
              container?.ROW_NO != null && String(container.ROW_NO).trim() !== "" ? String(container.ROW_NO) : null,
              container?.COLUMN_NAME ? String(container.COLUMN_NAME) : null,
              container?.STACK_NO   ? String(container.STACK_NO)   : null,
            ].filter(Boolean);
            const locationStr = parts.join(":");
            const sizeStr = [container?.CONTAINER_SIZE ? `${container.CONTAINER_SIZE}ft` : null, container?.CONTAINER_TYPE || null].filter(Boolean).join(" ");

            return (
              <OverlayView position={markerPos} mapPaneName={OverlayView.FLOAT_PANE}>
                {/* offset card up so it sits above the pin — pin is 44px tall, card offset by ~60px */}
                <div style={{ transform: "translate(-50%, calc(-100% - 52px))", pointerEvents: "none", userSelect: "none" }}>
                  <div style={{
                    background: "#fff",
                    borderRadius: "12px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
                    overflow: "hidden",
                    minWidth: "210px",
                    border: "2px solid #0e4a78",
                  }}>
                    {/* Header */}
                    <div style={{ background: "linear-gradient(135deg,#0e4a78,#012541)", padding: "10px 14px" }}>
                      <div style={{ fontSize: "15px", fontWeight: 900, fontFamily: "monospace", color: "#fff", letterSpacing: "2px" }}>
                        {container?.CONTAINER_NO}
                      </div>
                      {container?.CONTAINER_PROCESS && (
                        <div style={{
                          display: "inline-block", marginTop: "4px",
                          background: "rgba(255,255,255,0.2)", borderRadius: "4px",
                          padding: "1px 8px", fontSize: "10px", fontWeight: 800,
                          color: "#fff", letterSpacing: "1px", textTransform: "uppercase",
                        }}>
                          {container.CONTAINER_PROCESS}
                        </div>
                      )}
                    </div>
                    {/* Details */}
                    <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "7px" }}>
                      {locationStr && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ color: "#ef4444", fontSize: "14px", flexShrink: 0, display: "flex" }}>
                            <FiMapPin />
                          </span>
                          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, minWidth: "52px" }}>Location</span>
                          <span style={{ fontSize: "13px", color: "#0e4a78", fontWeight: 900, fontFamily: "monospace", letterSpacing: "1px" }}>{locationStr}</span>
                        </div>
                      )}
                      {sizeStr && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ color: "#f59e0b", fontSize: "14px", flexShrink: 0, display: "flex" }}>
                            <FiPackage />
                          </span>
                          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, minWidth: "52px" }}>Size</span>
                          <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: 800 }}>{sizeStr}</span>
                        </div>
                      )}
                      {container?.INVENTORY_STATUS && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ color: "#10b981", fontSize: "14px", flexShrink: 0, display: "flex" }}>
                            <FiCheckCircle />
                          </span>
                          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, minWidth: "52px" }}>Status</span>
                          <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: 800 }}>{container.INVENTORY_STATUS}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Card tail pointing down to pin */}
                  <div style={{
                    width: 0, height: 0, margin: "0 auto",
                    borderLeft: "8px solid transparent",
                    borderRight: "8px solid transparent",
                    borderTop: "10px solid #0e4a78",
                  }} />
                </div>
              </OverlayView>
            );
          })()}

          {/* No location fallback */}
          {!markerPos && !blockSlots.length && (
            <OverlayView position={defaultCenter} mapPaneName={OverlayView.FLOAT_PANE}>
              <div style={{
                background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8,
                padding: "10px 16px", fontSize: 13, color: "#92400e", fontWeight: 600,
                transform: "translate(-50%,-50%)",
              }}>
                Location data not available for this container
              </div>
            </OverlayView>
          )}
        </GoogleMap>
      </div>
    </div>
  );
};

export default KioskMap;
