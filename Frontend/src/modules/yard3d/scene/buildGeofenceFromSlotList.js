// Builds a geofence object (bounds + blocks + slots) matching the shape of
// the old static slot-geofence-*.json files, from live GET_ESS_MST_SLOT_LIST
// rows (via the /location-slots backend endpoint). Used by all three yard3d
// pages so they no longer depend on the static geofence file.
//
// Block granularity note: the static geofence had dozens of small synthetic
// sub-blocks (BLOCK-A1, BLOCK-A2, ...) auto-generated from a DXF drawing.
// GET_ESS_MST_SLOT_LIST only carries BlockName, which maps to the real DB
// yard sections (RAIL, IMP, EMT, EXP-EX, IMP-EX, TG — a handful of much
// larger groupings). Blocks here are therefore coarser than before — this
// is intentional, not a bug: it reflects the actual DB block taxonomy.

// Parse "lat lng,lat lng,..." (ESS_MST_SLOT.LatLong format) into [[lat,lng], ...]
// matching the static geofence's polygon array-of-pairs format.
function parseSlotLatLongPairs(raw) {
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
      // lat is the smaller-magnitude coordinate (~30 here), lng the larger (~75)
      return Math.abs(a) < Math.abs(b) ? [a, b] : [b, a];
    })
    .filter(Boolean);
}

const centroidOf = (polygon) => {
  if (!polygon.length) return { lat: NaN, lng: NaN };
  let sLat = 0, sLng = 0;
  polygon.forEach(([lat, lng]) => { sLat += lat; sLng += lng; });
  return { lat: sLat / polygon.length, lng: sLng / polygon.length };
};

/**
 * @param {Array} slotRows - raw rows from GET_ESS_MST_SLOT_LIST
 *   ({ SlotID, SlotName, LatLong, Row, Column, BlockName, YardName, ... })
 * @returns {{ bounds, blocks, slots } | null}
 */
export function buildGeofenceFromSlotList(slotRows) {
  if (!Array.isArray(slotRows) || slotRows.length === 0) return null;

  const slots = [];
  slotRows.forEach((row) => {
    const rawBlockName = String(row?.BlockName ?? row?.BLOCKNAME ?? "").trim();
    if (!rawBlockName) return;
    const blockId = `BLOCK-${rawBlockName.toUpperCase()}`;

    const rowLabel = String(row?.Row ?? row?.ROW ?? "").trim().toUpperCase();
    const colRaw = String(row?.Column ?? row?.COLUMN ?? "").trim();
    const colDigits = colRaw.replace(/\D/g, "");
    const colPadded = colDigits ? colDigits.padStart(2, "0") : colRaw;

    const polygon = parseSlotLatLongPairs(String(row?.LatLong ?? row?.LATLONG ?? ""));
    if (polygon.length < 3) return;

    const { lat, lng } = centroidOf(polygon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const slotNameRaw = String(row?.SlotName ?? row?.SLOTNAME ?? "").trim();
    const slotName = slotNameRaw || `${blockId}-${rowLabel}${colPadded}`;

    slots.push({
      key: `${blockId}|${rowLabel}|${colPadded}`,
      slotName,
      block: blockId,
      row: rowLabel,
      col: colPadded,
      lat,
      lng,
      polygon,
    });
  });

  if (!slots.length) return null;

  // Group slots by block to derive each block's bounding box / row-col span.
  const byBlock = new Map();
  slots.forEach((s) => {
    if (!byBlock.has(s.block)) byBlock.set(s.block, []);
    byBlock.get(s.block).push(s);
  });

  const blocks = {};
  let yardMinLat = Infinity, yardMaxLat = -Infinity, yardMinLng = Infinity, yardMaxLng = -Infinity;

  byBlock.forEach((blockSlots, blockId) => {
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    const rowSet = new Set();
    const colSet = new Set();
    let sLat = 0, sLng = 0;

    blockSlots.forEach((s) => {
      if (s.row) rowSet.add(s.row);
      if (s.col) colSet.add(s.col);
      sLat += s.lat;
      sLng += s.lng;
      s.polygon.forEach(([lat, lng]) => {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      });
    });

    if (minLat < yardMinLat) yardMinLat = minLat;
    if (maxLat > yardMaxLat) yardMaxLat = maxLat;
    if (minLng < yardMinLng) yardMinLng = minLng;
    if (maxLng > yardMaxLng) yardMaxLng = maxLng;

    blocks[blockId] = {
      id: blockId,
      rows: Array.from(rowSet).sort(),
      cols: Array.from(colSet).sort(),
      centerLat: sLat / blockSlots.length,
      centerLng: sLng / blockSlots.length,
      minLat, maxLat, minLng, maxLng,
      slotCount: blockSlots.length,
    };
  });

  if (!Number.isFinite(yardMinLat)) return null;

  return {
    bounds: { minLat: yardMinLat, maxLat: yardMaxLat, minLng: yardMinLng, maxLng: yardMaxLng },
    blocks,
    slots,
  };
}
