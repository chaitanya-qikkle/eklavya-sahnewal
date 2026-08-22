// Coordinate utilities — map (block id, row, slot, tier, size) → world (x,y,z).
//
// All blocks live in CAD space (real-world meters) and we render them
// in a centered Three.js scene by subtracting the bounds centroid.
// The y-axis points up; the CAD y-axis becomes -z (so North → -Z, conventional).

export const CONTAINER_HEIGHT = 4.3;       // visual stack height (a real 20ft hi-cube is ~2.9m, scaled for readability)
export const CONTAINER_TIER_GAP = 0.2;     // gap between stacked tiers
export const FOUNDATION_TOP_Y = 0.8;       // top surface of the block concrete pad

export function getCentroid(bounds) {
  return {
    cx: (bounds.minX + bounds.maxX) / 2,
    cy: (bounds.minY + bounds.maxY) / 2,
  };
}

// Project a single (slot,row,tier,size) inside a CAD block to world space.
// Block has cx,cy in CAD coords, w/h dimensions, angle (radians, CAD-local).
export function placeContainer(block, container, cx, cy) {
  const bx = block.cx - cx;
  const bz = (block.cy - cy) * -1;
  const bw = block.w;
  const bd = block.h;
  const slots = block.slots || 18;
  const rows = block.rows || 6;
  const cellW = bw / slots;
  const cellD = bd / rows;
  const ang = block.angle || 0;
  const cosA = Math.cos(ang);
  const sinA = Math.sin(ang);

  const rawSlot = Number.isFinite(container.slot) ? container.slot : 1;
  const rawRow = Number.isFinite(container.row) ? container.row : 1;
  const slot = Math.max(1, Math.min(rawSlot, slots));
  const row = Math.max(1, Math.min(rawRow, rows));
  const is40 = container.size === "40ft";
  const centerSlot = is40 ? (slot + 0.5 <= slots ? slot + 0.5 : slot - 0.5) : slot - 0.5;
  const lx = -bw / 2 + centerSlot * cellW;
  const lz = -bd / 2 + (row - 0.5) * cellD;

  const wx = bx + lx * cosA - lz * sinA;
  const wz = bz + lx * sinA + lz * cosA;
  const wy = FOUNDATION_TOP_Y + (container.tier - 0.5) * (CONTAINER_HEIGHT + CONTAINER_TIER_GAP);

  return {
    x: wx,
    y: wy,
    z: wz,
    rotY: ang,
    w: is40 ? cellW * 1.92 : cellW * 0.92,
    h: CONTAINER_HEIGHT,
    d: cellD * 0.78,
  };
}

// Optional lat/long → world projection.
// Some installations may want to overlay containers from a device feed
// onto the same canvas. We use simple equirectangular projection scaled
// to fit the yard bounds when boundsLatLng is supplied.
//   { minLat, maxLat, minLng, maxLng } → maps to xz of the yard tarmac.
export function latLngToWorld(lat, lng, boundsLatLng, yardW, yardD) {
  if (!boundsLatLng) return null;
  const { minLat, maxLat, minLng, maxLng } = boundsLatLng;
  if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) return null;
  const u = (lng - minLng) / (maxLng - minLng);     // 0..1 left-to-right
  const v = 1 - (lat - minLat) / (maxLat - minLat); // 0..1 top-to-bottom (north→up)
  return {
    x: (u - 0.5) * yardW,
    z: (v - 0.5) * yardD,
  };
}
