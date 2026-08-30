// Geofence-driven coordinate system + slot lookup.
//
// • Lat/lng → XZ via a local equirectangular projection (cheap, <10cm
//   error at yard scale).
// • Spatial bucket index lets us match a container's GPS to its
//   enclosing slot in O(1).
// • DXF features (in survey coords) are aligned to the geofence by
//   translating their centroid → origin.

// Must match YARD_ROTATION_DEG/YARD_OFFSET_X/YARD_OFFSET_Z in
// live/equipmentCoordinateMapper.js — both projections need the same
// rotation + offset so slots and live equipment agree.
import { YARD_ROTATION_DEG, YARD_OFFSET_X, YARD_OFFSET_Z } from "../live/equipmentCoordinateMapper";

const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LNG = (lat) => 111_320 * Math.cos((lat * Math.PI) / 180);

function rotateXZ(x, z, degrees) {
  if (!degrees) return { x, z };
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: x * cos - z * sin,
    z: x * sin + z * cos,
  };
}

export function buildProjection(bounds, rotationDeg = YARD_ROTATION_DEG, offsetX = YARD_OFFSET_X, offsetZ = YARD_OFFSET_Z) {
  const cLat = (bounds.minLat + bounds.maxLat) / 2;
  const cLng = (bounds.minLng + bounds.maxLng) / 2;
  const mLng = M_PER_DEG_LNG(cLat);
  const toXZ = (lat, lng) => {
    const x = (lng - cLng) * mLng;
    const z = -(lat - cLat) * M_PER_DEG_LAT;
    const rotated = rotateXZ(x, z, rotationDeg);
    return { x: rotated.x + offsetX, z: rotated.z + offsetZ };
  };
  const yardW = (bounds.maxLng - bounds.minLng) * mLng;
  const yardD = (bounds.maxLat - bounds.minLat) * M_PER_DEG_LAT;
  return { toXZ, yardW, yardD, cLat, cLng, mLng, rotationDeg, offsetX, offsetZ };
}

export function buildBlockGeometry(geofence, projection) {
  const blocksOut = {};
  for (const id of Object.keys(geofence.blocks)) {
    const b = geofence.blocks[id];
    const corners = [
      projection.toXZ(b.minLat, b.minLng),
      projection.toXZ(b.minLat, b.maxLng),
      projection.toXZ(b.maxLat, b.maxLng),
      projection.toXZ(b.maxLat, b.minLng),
    ];
    const xs = corners.map(c => c.x);
    const zs = corners.map(c => c.z);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const w = Math.max(...xs) - Math.min(...xs);
    const d = Math.max(...zs) - Math.min(...zs);
    blocksOut[id] = {
      id, cx, cz, w, d,
      rows: b.rows, cols: b.cols, slotCount: b.slotCount,
      centerLat: b.centerLat, centerLng: b.centerLng,
    };
  }
  return blocksOut;
}

// Slot lookup index. Keyed three ways so a container can match by whichever
// identifier the inventory row carries:
//   • "@name:BLOCK-A-01A"  — the DB SlotName / key (most reliable join)
//   • "BLOCK-A|A|01"       — block | row | col (zero-padded, as in geofence)
export function buildSlotIndex(geofence) {
  const map = new Map();
  for (const s of geofence.slots) {
    map.set(`${s.block}|${s.row}|${s.col}`, s);
    if (s.slotName) map.set(`@name:${String(s.slotName).toUpperCase()}`, s);
    if (s.key && s.key !== s.slotName) map.set(`@name:${String(s.key).toUpperCase()}`, s);
  }
  return map;
}

// ── Spatial bucket index for lat/lng → slot matching ─────────────────────
// Bucket = small XZ tile (default 4m). Each bucket lists slots whose bbox
// touches that tile. Container lookup = O(1) avg.
export function buildSlotSpatialIndex(slots, projection, cellSize = 4) {
  const slotMeta = new Array(slots.length);
  const buckets = new Map();
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    // axis-aligned bbox in XZ space
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [la, lo] of s.polygon) {
      const { x, z } = projection.toXZ(la, lo);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    slotMeta[i] = { slot: s, minX, maxX, minZ, maxZ, cx, cz };

    const x0 = Math.floor(minX / cellSize);
    const x1 = Math.floor(maxX / cellSize);
    const z0 = Math.floor(minZ / cellSize);
    const z1 = Math.floor(maxZ / cellSize);
    for (let gx = x0; gx <= x1; gx++) {
      for (let gz = z0; gz <= z1; gz++) {
        const key = `${gx}|${gz}`;
        const list = buckets.get(key);
        if (list) list.push(i);
        else buckets.set(key, [i]);
      }
    }
  }
  return { slotMeta, buckets, cellSize };
}

// Find slot enclosing (lat,lng). If exact bbox match fails, returns the
// nearest slot by centroid (within `fallbackRadius` metres) so a slightly
// drifted GPS still snaps to the right slot.
export function findSlotByLatLng(lat, lng, projection, spatial, fallbackRadius = 8) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const { x, z } = projection.toXZ(lat, lng);
  const { buckets, slotMeta, cellSize } = spatial;
  const gx = Math.floor(x / cellSize);
  const gz = Math.floor(z / cellSize);

  // 1) BBOX check on candidates in the surrounding 3×3 buckets
  let nearestIdx = -1;
  let nearestDist = fallbackRadius * fallbackRadius;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const key = `${gx + dx}|${gz + dz}`;
      const list = buckets.get(key);
      if (!list) continue;
      for (const i of list) {
        const m = slotMeta[i];
        if (x >= m.minX && x <= m.maxX && z >= m.minZ && z <= m.maxZ) return m.slot;
        const dxm = x - m.cx;
        const dzm = z - m.cz;
        const d2 = dxm * dxm + dzm * dzm;
        if (d2 < nearestDist) {
          nearestDist = d2;
          nearestIdx = i;
        }
      }
    }
  }
  if (nearestIdx >= 0) return slotMeta[nearestIdx].slot;
  return null;
}

// Multi-strategy container locator. Priority:
//   1. Explicit BLOCK + ROW + COL columns
//   2. Slot-name string ("E1:G:18" or "E1:18:G", with `:`/`-`/`/` separators)
//   3. GPS (OFFLOAD_LAT, OFFLOAD_LON) → enclosing/nearest slot
export function locateContainer(c, slotIndex, projection, spatial) {
  // 0. Direct DB SlotName match — both the inventory row (SLOT_NAME) and the
  //    geofence slot derive from ESS_MST_SLOT, so this is the exact join.
  const sname = String(c.slotName || c.location || "").trim().toUpperCase();
  if (sname) {
    const hit = slotIndex.get(`@name:${sname}`);
    if (hit) return hit;
  }

  // 1. block | row | col — tolerant of "A" vs "BLOCK-A" and un-padded cols.
  if (c.block && c.row && c.col) {
    const blkRaw = String(c.block).trim().toUpperCase();
    const blk = blkRaw.startsWith("BLOCK-") ? blkRaw : `BLOCK-${blkRaw}`;
    const row = String(c.row).trim().toUpperCase();
    const col = String(c.col).trim();
    const colPad = col.padStart(2, "0");
    const hit =
      slotIndex.get(`${blk}|${row}|${colPad}`) ||
      slotIndex.get(`${blk}|${row}|${col}`) ||
      slotIndex.get(`${blkRaw}|${row}|${colPad}`) ||
      slotIndex.get(`${c.block}|${c.row}|${c.col}`);
    if (hit) return hit;
  }
  const loc = String(c.location || c.slotName || "").trim();
  if (loc) {
    // Split on colon or slash only — NOT hyphen, as block names like "E4-1" contain hyphens.
    const parts = loc.split(/[:\/]/).map(p => p.trim()).filter(Boolean);
    // Accept 3-part ("B4:E:10") or 4-part ("B4:E:10:1" where part 4 is tier)
    if (parts.length >= 3) {
      const [block, a, b] = parts;
      const hit = slotIndex.get(`${block}|${a}|${b}`) || slotIndex.get(`${block}|${b}|${a}`);
      if (hit) return hit;
    }
    // Fallback: also try hyphen-based split for old-style "B4-E-10" format
    // but only if colon split yielded < 3 parts
    if (parts.length < 3) {
      const fallback = loc.split(/[-\/]/).map(p => p.trim()).filter(Boolean);
      if (fallback.length >= 3) {
        const [block, a, b] = fallback;
        const hit = slotIndex.get(`${block}|${a}|${b}`) || slotIndex.get(`${block}|${b}|${a}`);
        if (hit) return hit;
      }
    }
  }
  if (spatial && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
    const hit = findSlotByLatLng(c.lat, c.lng, projection, spatial);
    if (hit) return hit;
  }
  return null;
}

// ── DXF alignment: best-fit similarity transform DXF → geofence ──────────
// The DXF survey frame and the geofence lat/lng frame are both metric but
// differ by a small rotation, scale, and offset. Aligning by centroid alone
// (the old approach) left the warehouses/fences ~48 m adrift from the
// rebuilt-from-DB slot blocks. Instead we solve the least-squares similarity
// (Umeyama) that maps DXF block centroids onto the matching geofence block
// centroids (DXF id "A" ↔ geofence "BLOCK-A"), bringing residual error to
// well under a metre.
//
// Returns a transform {s, cosT, sinT, tx, ty} consumed by dxfPointToScene.
// Falls back to the old centroid-only translation when matching isn't
// possible (no geofence, no projection, or fewer than 2 matched blocks).
export function computeDxfAlignment(dxfLayout, geofence, projection) {
  if (!dxfLayout?.blocks?.length) return null;

  // DXF block centroid (in DXF survey space) — needed for the fallback.
  let sx = 0, sy = 0, n = 0;
  for (const b of dxfLayout.blocks) {
    if (Number.isFinite(b.cx) && Number.isFinite(b.cy)) { sx += b.cx; sy += b.cy; n++; }
  }
  if (!n) return null;
  const centroidFallback = { s: 1, cosT: 1, sinT: 0, tx: -(sx / n), ty: sy / n };

  if (!geofence?.blocks || !projection) return centroidFallback;

  // Build matched point pairs: DXF centroid (raw scene XZ) → geofence
  // block centre (scene XZ). DXF raw scene = (cx, -cy); see dxfPointToScene.
  const src = [], dst = [];
  for (const b of dxfLayout.blocks) {
    if (!Number.isFinite(b.cx) || !Number.isFinite(b.cy)) continue;
    const g = geofence.blocks[`BLOCK-${String(b.id).toUpperCase()}`];
    if (!g || !Number.isFinite(g.centerLat) || !Number.isFinite(g.centerLng)) continue;
    const c = projection.toXZ(g.centerLat, g.centerLng);
    src.push([b.cx, -b.cy]);
    dst.push([c.x, c.z]);
  }
  const N = src.length;
  if (N < 2) return centroidFallback;

  // Umeyama similarity (2D): solve for rotation θ, scale s, translation t.
  let msx = 0, msy = 0, mdx = 0, mdy = 0;
  for (let i = 0; i < N; i++) { msx += src[i][0]; msy += src[i][1]; mdx += dst[i][0]; mdy += dst[i][1]; }
  msx /= N; msy /= N; mdx /= N; mdy /= N;

  let Sxx = 0, Sxy = 0, Syx = 0, Syy = 0, varS = 0;
  for (let i = 0; i < N; i++) {
    const ax = src[i][0] - msx, ay = src[i][1] - msy;
    const bx = dst[i][0] - mdx, by = dst[i][1] - mdy;
    Sxx += bx * ax; Sxy += bx * ay; Syx += by * ax; Syy += by * ay;
    varS += ax * ax + ay * ay;
  }
  if (varS === 0) return centroidFallback;

  const theta = Math.atan2(Syx - Sxy, Sxx + Syy);
  const cosT = Math.cos(theta), sinT = Math.sin(theta);
  const s = ((Sxx + Syy) * cosT + (Syx - Sxy) * sinT) / varS;
  const tx = mdx - s * (cosT * msx - sinT * msy);
  const ty = mdy - s * (sinT * msx + cosT * msy);

  if (![s, cosT, sinT, tx, ty].every(Number.isFinite)) return centroidFallback;
  return { s, cosT, sinT, tx, ty };
}

// Convert a single DXF (X, Y) to scene (x, z) by applying the similarity
// transform from computeDxfAlignment. Y is negated first so survey-north
// maps to scene −Z (north up), matching the geofence projection.
export function dxfPointToScene(x, y, alignment) {
  if (!alignment) return { x, z: -y };
  const { s, cosT, sinT, tx, ty } = alignment;
  const xs = x, ys = -y;
  return {
    x: s * (cosT * xs - sinT * ys) + tx,
    z: s * (sinT * xs + cosT * ys) + ty,
  };
}
