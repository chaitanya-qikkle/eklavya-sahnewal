// Builds a synthetic slot-geofence JSON for Sahnewal from the DXF-derived
// yard-layout-sahnewal.json (see parse-dxf.mjs). The old 3D page (YardScene)
// only knows how to build its ground/blocks/slots from lat/lng geofence
// data, and Sahnewal has no real GPS slot survey yet — so this generates
// placeholder lat/lng by projecting the DXF's local metre coordinates onto
// a flat-earth patch centred on an arbitrary reference point. The shape,
// block layout and slot count all come from the real DXF; only the
// absolute lat/lng values are synthetic. Swap in a real survey later by
// regenerating this file from actual GPS without touching any other code.
import fs from 'fs';
import DxfParser from 'dxf-parser';

const SRC = process.argv[2] || 'public/yard-layout-sahnewal.json';
const OUT = 'public/slot-geofence-sahnewal.json';

// Arbitrary reference point (not surveyed) used only to anchor the local
// metre grid into lat/lng so the existing geofence math (which expects
// lat/lng) can run unmodified.
const REF_LAT = 30.9;
const REF_LNG = 75.8;
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LNG = 111_320 * Math.cos((REF_LAT * Math.PI) / 180);

function metersToLatLng(x, y) {
  return {
    lat: REF_LAT + y / M_PER_DEG_LAT,
    lng: REF_LNG + x / M_PER_DEG_LNG,
  };
}

if (!fs.existsSync(SRC)) {
  console.error(`Source not found: ${SRC}. Run parse-dxf.mjs first.`);
  process.exit(1);
}

const layout = JSON.parse(fs.readFileSync(SRC, 'utf-8'));

// Re-derive per-container footprints is not possible from yard-layout.json
// (it only keeps block-level bboxes), so this script re-parses the DXF
// directly for container polygons, then assigns each one to its block by
// nearest block centre — the same grouping the DXF parser already computed
// is reproduced here at slot granularity.
function convexHull(pts) {
  if (pts.length <= 3) return pts;
  const points = pts.slice().sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (let i = 0; i < points.length; i++) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) lower.pop();
    lower.push(points[i]);
  }
  const upper = [];
  for (let i = points.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) upper.pop();
    upper.push(points[i]);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}
function minAreaBBox(vertices) {
  if (!vertices || vertices.length < 2) return null;
  const ch = convexHull(vertices);
  let bestArea = Infinity, bestAngle = 0;
  let bestMinP = 0, bestMaxP = 0, bestMinQ = 0, bestMaxQ = 0;
  for (let i = 0; i < ch.length; i++) {
    const p1 = ch[i], p2 = ch[(i + 1) % ch.length];
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    if (Math.hypot(dx, dy) < 0.01) continue;
    const angle = Math.atan2(dy, dx);
    let minP = Infinity, maxP = -Infinity, minQ = Infinity, maxQ = -Infinity;
    for (const p of vertices) {
      const rx = p.x * Math.cos(-angle) - p.y * Math.sin(-angle);
      const ry = p.x * Math.sin(-angle) + p.y * Math.cos(-angle);
      if (rx < minP) minP = rx; if (rx > maxP) maxP = rx;
      if (ry < minQ) minQ = ry; if (ry > maxQ) maxQ = ry;
    }
    const area = (maxP - minP) * (maxQ - minQ);
    if (area < bestArea) { bestArea = area; bestAngle = angle; bestMinP = minP; bestMaxP = maxP; bestMinQ = minQ; bestMaxQ = maxQ; }
  }
  const w = bestMaxP - bestMinP, h = bestMaxQ - bestMinQ;
  const midP = (bestMinP + bestMaxP) / 2, midQ = (bestMinQ + bestMaxQ) / 2;
  const cx = midP * Math.cos(bestAngle) - midQ * Math.sin(bestAngle);
  const cy = midP * Math.sin(bestAngle) + midQ * Math.cos(bestAngle);
  return { cx, cy, w, h, angle: bestAngle };
}

const DXF_FILE = process.argv[3] || '../sahnewal autocad.dxf';
if (!fs.existsSync(DXF_FILE)) {
  console.error(`DXF not found: ${DXF_FILE}`);
  process.exit(1);
}
const MM_TO_M = 1 / 1000;
const dxfText = fs.readFileSync(DXF_FILE, 'utf-8');
const dxf = new DxfParser().parseSync(dxfText);

const containerPolys = [];
for (const ent of dxf.entities) {
  if (ent.layer === 'Container' && ent.vertices && ent.vertices.length >= 4) {
    const scaled = ent.vertices.map(v => ({ x: v.x * MM_TO_M, y: v.y * MM_TO_M }));
    const bbox = minAreaBBox(scaled);
    if (bbox) containerPolys.push({ ...bbox, ring: scaled.map(v => [v.x, v.y]) });
  }
}

// Assign each container to its nearest block (by centre distance) — the
// blocks were built from the exact same containers in parse-dxf.mjs, so
// nearest-centre reproduces the same grouping deterministically.
const blocks = layout.blocks;
function nearestBlock(p) {
  let best = null, bestD = Infinity;
  for (const b of blocks) {
    const d = Math.hypot(b.cx - p.cx, b.cy - p.cy);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

const byBlock = new Map();
for (const p of containerPolys) {
  const b = nearestBlock(p);
  if (!b) continue;
  if (!byBlock.has(b.id)) byBlock.set(b.id, []);
  byBlock.get(b.id).push(p);
}

// Within each block, lay containers out on a small row/col grid: row =
// letter banded by local Y, col = index left-to-right within that band —
// mirrors the row/col convention the real geofence format expects.
const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const slots = [];
const blocksOut = {};

let minLatAll = Infinity, maxLatAll = -Infinity, minLngAll = Infinity, maxLngAll = -Infinity;

for (const block of blocks) {
  const id = `BLOCK-${block.id}`;
  const members = byBlock.get(block.id) || [];
  if (!members.length) continue;

  members.sort((a, b) => b.cy - a.cy || a.cx - b.cx);
  const ROW_BAND = 4; // metres
  const rowBands = [];
  for (const p of members) {
    let band = rowBands.find(rb => Math.abs(rb.cy - p.cy) < ROW_BAND);
    if (!band) { band = { cy: p.cy, items: [] }; rowBands.push(band); }
    band.items.push(p);
  }
  rowBands.sort((a, b) => b.cy - a.cy);
  rowBands.forEach(rb => rb.items.sort((a, b) => a.cx - b.cx));

  const rowsSet = new Set(), colsSet = new Set();
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  let slotCount = 0;

  rowBands.forEach((rb, ri) => {
    const rowLetter = ROW_LETTERS[ri] || `R${ri}`;
    rb.items.forEach((p, ci) => {
      const col = String(ci + 1).padStart(2, '0');
      const polygonLatLng = p.ring.map(([x, y]) => {
        const { lat, lng } = metersToLatLng(x, y);
        return [lat, lng];
      });
      const { lat, lng } = metersToLatLng(p.cx, p.cy);
      const slotName = `${id}-${rowLetter}${col}`;
      slots.push({
        key: `${id}|${rowLetter}|${col}`,
        slotName,
        block: id,
        row: rowLetter,
        col,
        lat, lng,
        polygon: polygonLatLng,
      });
      rowsSet.add(rowLetter);
      colsSet.add(Number(col));
      slotCount++;
      for (const [la, lo] of polygonLatLng) {
        if (la < minLat) minLat = la; if (la > maxLat) maxLat = la;
        if (lo < minLng) minLng = lo; if (lo > maxLng) maxLng = lo;
      }
    });
  });

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  blocksOut[id] = {
    id,
    rows: [...rowsSet].sort(),
    cols: [...colsSet].sort((a, b) => a - b),
    centerLat, centerLng,
    minLat, maxLat, minLng, maxLng,
    slotCount,
  };

  if (minLat < minLatAll) minLatAll = minLat;
  if (maxLat > maxLatAll) maxLatAll = maxLat;
  if (minLng < minLngAll) minLngAll = minLng;
  if (maxLng > maxLngAll) maxLngAll = maxLng;
}

const out = {
  bounds: { minLat: minLatAll, maxLat: maxLatAll, minLng: minLngAll, maxLng: maxLngAll },
  blocks: blocksOut,
  slots,
};

fs.writeFileSync(OUT, JSON.stringify(out));
const sizeKb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`Generated ${slots.length} slots across ${Object.keys(blocksOut).length} blocks. Wrote ${OUT} (${sizeKb} KB).`);
console.log('NOTE: lat/lng are synthetic (projected from DXF metres), not GPS-surveyed.');
