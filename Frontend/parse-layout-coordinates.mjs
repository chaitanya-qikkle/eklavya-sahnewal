// Builds both Sahnewal layout files directly from layout_coordinates.json —
// a real GPS (WGS84) survey of 803 containers plus 132 real boundary wall
// segments (source: ICD SAHNEWAL.dxf / PDF2_WALL), which supersedes the
// earlier DXF-derived + synthetic-geofence pipeline (parse-dxf.mjs /
// parse-geofence-sahnewal.mjs) now that real coordinates are available.
//
// Outputs:
//   public/slot-geofence-sahnewal.json — real lat/lng geofence for
//     YardScene.jsx (the rich 3D page: solid buildings, live equipment).
//   public/yard-layout-sahnewal.json  — local-metre CAD-style layout for
//     YardVisualization3D.jsx (the CAD-only page).
import fs from 'fs';
import { computeYardBoundary, stitchChains } from './boundary-utils.mjs';

const SRC = process.argv[2] || '../layout_coordinates.json';
if (!fs.existsSync(SRC)) {
    console.error(`Source not found: ${SRC}`);
    process.exit(1);
}
const data = JSON.parse(fs.readFileSync(SRC, 'utf-8'));

const M_PER_DEG_LAT = 111_320;
const mPerDegLng = (lat) => 111_320 * Math.cos((lat * Math.PI) / 180);

// ── reference projection, centred on the container data ───────────────────
const centerLat = data.containers.reduce((s, c) => s + c.center[0], 0) / data.containers.length;
const centerLng = data.containers.reduce((s, c) => s + c.center[1], 0) / data.containers.length;
const mLng = mPerDegLng(centerLat);
const toXY = ([lat, lon]) => [(lon - centerLng) * mLng, (lat - centerLat) * M_PER_DEG_LAT];

// ── containers → local metres, with real corner polygons ──────────────────
const containers = data.containers.map(c => ({
    id: c.id,
    type: c.type,
    lengthM: c.length_m,
    widthM: c.width_m,
    bearingDeg: c.bearing_deg,
    center: c.center,
    corners: c.corners,
    centerXY: toXY(c.center),
    cornersXY: c.corners.map(toXY),
}));

// ── cluster containers into blocks by spatial proximity (union-find) ──────
// Real bay pitch is ~2.45m (container width) side-by-side and larger gaps
// between bay groups, same pattern as the earlier DXF-derived data.
const LINK_DIST = 6; // metres
const n = containers.length;
const parent = Array.from({ length: n }, (_, i) => i);
function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
        const d = Math.hypot(containers[i].centerXY[0] - containers[j].centerXY[0], containers[i].centerXY[1] - containers[j].centerXY[1]);
        if (d < LINK_DIST) union(i, j);
    }
}
const groupMap = new Map();
for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groupMap.has(r)) groupMap.set(r, []);
    groupMap.get(r).push(containers[i]);
}
const groups = Array.from(groupMap.values());

// Band groups into rows (by projected Y) then number left→right within
// each row band, mirroring the DXF parser's ID scheme (A1, A2, B1, ...).
groups.forEach(g => {
    g.cx = g.reduce((s, c) => s + c.centerXY[0], 0) / g.length;
    g.cy = g.reduce((s, c) => s + c.centerXY[1], 0) / g.length;
});
groups.sort((a, b) => b.cy - a.cy);
const ROW_BAND = 20; // metres
const bands = [];
for (const g of groups) {
    let band = bands.find(bd => Math.abs(bd.cy - g.cy) < ROW_BAND);
    if (!band) { band = { cy: g.cy, groups: [] }; bands.push(band); }
    band.groups.push(g);
}
bands.forEach(b => b.groups.sort((a, b2) => a.cx - b2.cx));

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const blocks = []; // {id, name, cx, cy, w, h, angle, zone, containerCount, members:[container...]}
bands.forEach((band, bi) => {
    const letter = LETTERS[bi] || `Z${bi}`;
    band.groups.forEach((g, gi) => {
        const id = `${letter}${gi + 1}`;
        const xs = g.map(c => c.centerXY[0]), ys = g.map(c => c.centerXY[1]);
        let minGX = Infinity, maxGX = -Infinity, minGY = Infinity, maxGY = -Infinity;
        for (const c of g) {
            for (const [x, y] of c.cornersXY) {
                if (x < minGX) minGX = x; if (x > maxGX) maxGX = x;
                if (y < minGY) minGY = y; if (y > maxGY) maxGY = y;
            }
        }
        blocks.push({
            id, name: `Block-${id}`,
            cx: (minGX + maxGX) / 2, cy: (minGY + maxGY) / 2,
            w: Math.max(1, maxGX - minGX), h: Math.max(1, maxGY - minGY),
            angle: 0, zone: 'Import',
            containerCount: g.length,
            members: g,
        });
    });
});
console.log(`Clustered ${n} containers -> ${blocks.length} blocks (${bands.length} row bands)`);

// ── real boundary segments ──────────────────────────────────────────────
// Of the 132 raw PDF2_WALL entries, most (~110) are zero/near-zero-length
// degenerate points (stray annotations, not real lines), and several of the
// rest are near-duplicate parallel traces of the same wall (drawn as both
// wall faces). After dropping the noise and de-duplicating, ~18 real lines
// remain, which don't chain into one closed loop (real survey data, drawn
// incompletely — same situation as the DXF's own boundary layers). So these
// real lines are folded into computeYardBoundary's rasterized fill (which
// closes the gaps using the actual container/block footprint) rather than
// treated as a ready-made closed perimeter on their own.
const MIN_SEG_LEN = 1; // metres — drops degenerate point-noise entries
const rawSegmentsXY = data.boundary.map(b => b.points.map(toXY));
function segLen(pts) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return len;
}
const realSegments = rawSegmentsXY
    .map(pts => ({ pts, len: segLen(pts) }))
    .filter(s => s.len >= MIN_SEG_LEN);

// De-duplicate near-identical parallel traces (same start/end within a few
// metres, in either direction) — keep only the first of each such pair.
const DUP_TOL = 8; // metres
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const dedupedSegments = [];
for (const s of realSegments) {
    const a = s.pts[0], b = s.pts[s.pts.length - 1];
    const isDup = dedupedSegments.some(k => {
        const ka = k.pts[0], kb = k.pts[k.pts.length - 1];
        return (dist2(a, ka) < DUP_TOL && dist2(b, kb) < DUP_TOL) || (dist2(a, kb) < DUP_TOL && dist2(b, ka) < DUP_TOL);
    });
    if (!isDup) dedupedSegments.push(s);
}
console.log(`Boundary: ${data.boundary.length} raw entries -> ${realSegments.length} real (len>=${MIN_SEG_LEN}m) -> ${dedupedSegments.length} after de-duplication`);

const realEdgeChains = stitchChains(dedupedSegments.map(s => s.pts), 10);
realEdgeChains.forEach((c, i) => console.log(`  real edge chain[${i}] pts=${c.chain.length} len=${c.len.toFixed(0)}m closed=${c.closed}`));

// The outer wall: rasterize every container footprint, fold in all real
// edge chains (so the trace follows them exactly where real data exists),
// close the small gaps between block rows, and trace the outer contour.
const outerBoundary = computeYardBoundary(
    containers.map(c => c.cornersXY),
    { realEdges: realEdgeChains.map(c => c.chain) }
);
if (!outerBoundary) {
    console.error('Failed to compute outer boundary — no container geometry found.');
    process.exit(1);
}
console.log(`Outer boundary: ${outerBoundary.length} points (from ${containers.length} containers + ${realEdgeChains.length} real edge chains)`);

// ── write slot-geofence-sahnewal.json (real lat/lng, YardScene schema) ────
const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const geofenceBlocks = {};
const geofenceSlots = [];
let minLatAll = Infinity, maxLatAll = -Infinity, minLngAll = Infinity, maxLngAll = -Infinity;

for (const block of blocks) {
    const id = `BLOCK-${block.id}`;
    const members = block.members;

    members.sort((a, b) => b.centerXY[1] - a.centerXY[1] || a.centerXY[0] - b.centerXY[0]);
    const ROWB = 4;
    const rowBands = [];
    for (const c of members) {
        let rb = rowBands.find(r => Math.abs(r.cy - c.centerXY[1]) < ROWB);
        if (!rb) { rb = { cy: c.centerXY[1], items: [] }; rowBands.push(rb); }
        rb.items.push(c);
    }
    rowBands.sort((a, b) => b.cy - a.cy);
    rowBands.forEach(rb => rb.items.sort((a, b) => a.centerXY[0] - b.centerXY[0]));

    const rowsSet = new Set(), colsSet = new Set();
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    let slotCount = 0;

    rowBands.forEach((rb, ri) => {
        const rowLetter = ROW_LETTERS[ri] || `R${ri}`;
        rb.items.forEach((c, ci) => {
            const col = String(ci + 1).padStart(2, '0');
            const slotName = `${id}-${rowLetter}${col}`;
            geofenceSlots.push({
                key: `${id}|${rowLetter}|${col}`,
                slotName,
                block: id,
                row: rowLetter,
                col,
                lat: c.center[0], lng: c.center[1],
                polygon: c.corners,
            });
            rowsSet.add(rowLetter);
            colsSet.add(Number(col));
            slotCount++;
            for (const [la, lo] of c.corners) {
                if (la < minLat) minLat = la; if (la > maxLat) maxLat = la;
                if (lo < minLng) minLng = lo; if (lo > maxLng) maxLng = lo;
            }
        });
    });

    const centerLatB = (minLat + maxLat) / 2, centerLngB = (minLng + maxLng) / 2;
    geofenceBlocks[id] = {
        id, rows: [...rowsSet].sort(), cols: [...colsSet].sort((a, b) => a - b),
        centerLat: centerLatB, centerLng: centerLngB,
        minLat, maxLat, minLng, maxLng, slotCount,
    };
    if (minLat < minLatAll) minLatAll = minLat;
    if (maxLat > maxLatAll) maxLatAll = maxLat;
    if (minLng < minLngAll) minLngAll = minLng;
    if (maxLng > maxLngAll) maxLngAll = maxLng;
}

const geofenceOut = {
    bounds: { minLat: minLatAll, maxLat: maxLatAll, minLng: minLngAll, maxLng: maxLngAll },
    blocks: geofenceBlocks,
    slots: geofenceSlots,
};
fs.writeFileSync('public/slot-geofence-sahnewal.json', JSON.stringify(geofenceOut));
console.log(`Wrote public/slot-geofence-sahnewal.json: ${geofenceSlots.length} slots, ${Object.keys(geofenceBlocks).length} blocks (real GPS)`);

// ── write yard-layout-sahnewal.json (local metres, CAD-style schema) ──────
// Close the ring (repeat the first point) so PerimeterWall — which only
// draws edges between consecutive points, not last-to-first — renders the
// final closing wall segment too.
const fences = [[...outerBoundary, outerBoundary[0]]];

const lines = [];
for (const f of fences) if (lines.length < 8000) lines.push(f);
for (const chain of realEdgeChains) if (lines.length < 8000) lines.push(chain.chain);
for (const b of blocks) for (const c of b.members) if (lines.length < 8000) lines.push(c.cornersXY.concat([c.cornersXY[0]]));

let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const c of containers) for (const [x, y] of c.cornersXY) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
}
for (const pt of outerBoundary) {
    if (pt[0] < minX) minX = pt[0]; if (pt[0] > maxX) maxX = pt[0];
    if (pt[1] < minY) minY = pt[1]; if (pt[1] > maxY) maxY = pt[1];
}

const layoutOut = {
    site: 'sahnewal',
    bounds: { minX, minY, maxX, maxY },
    blocks: blocks.map(b => ({
        id: b.id, name: b.name, cx: b.cx, cy: b.cy, w: b.w, h: b.h,
        angle: b.angle, zone: b.zone, containerCount: b.containerCount,
    })),
    buildings: [],
    warehouses: [],
    trees: [],
    texts: [],
    fences,
    roads: [],
    gates: [],
    lines: lines.slice(0, 8000),
};
fs.writeFileSync('public/yard-layout-sahnewal.json', JSON.stringify(layoutOut, null, 2));
console.log(`Wrote public/yard-layout-sahnewal.json: ${layoutOut.blocks.length} blocks, ${fences.length} outer boundary ring`);
