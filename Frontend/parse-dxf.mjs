import fs from 'fs';
import DxfParser from 'dxf-parser';
import { computeYardBoundary, stitchChains } from './boundary-utils.mjs';

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
    lower.pop();
    upper.pop();
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

// ── SAHNEWAL PARSER (DXF-derived fallback) ─────────────────────────────────
// NOTE: layout_coordinates.json (parsed by parse-layout-coordinates.mjs) is
// the primary source now — it carries real GPS-surveyed container positions
// and boundary lines. This DXF parser remains as a fallback / cross-check,
// built from the raw CAD drawing (millimetre units, large constant offset,
// scaled to metres here). Individual containers live as bare 4-vertex
// polygons on the "Container" layer (no BLOCK-* layers), so yard blocks are
// derived by clustering container footprints by proximity.
function parseSahnewal(dxf) {
    const MM_TO_M = 1 / 1000;
    const lines = [], buildings = [], warehouses = [], trees = [], fences = [], roads = [], gates = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const scaleRing = (vertices) => vertices.map(v => [v.x * MM_TO_M, v.y * MM_TO_M]);
    const trackBounds = (v) => {
        const x = v.x * MM_TO_M, y = v.y * MM_TO_M;
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    };

    // Real boundary edges — PLOT BOUNDARY and FENCE EXIM AREA are fragmented,
    // but their polylines do chain together into genuine real edges (from
    // the ~830m main top edge down to small fence notches a few tens of
    // metres long). Keep any such chain over MIN_REAL_EDGE metres so the
    // computed boundary defers to real survey data wherever it exists,
    // instead of guessing that stretch too.
    const MIN_REAL_EDGE = 15; // metres
    const boundaryEnts = dxf.entities.filter(e => (e.layer === 'PLOT BOUNDARY' || e.layer === 'FENCE EXIM AREA') && e.vertices && e.vertices.length >= 2);
    const boundaryPolylines = boundaryEnts.map(e => e.vertices.map(v => [v.x * MM_TO_M, v.y * MM_TO_M]));
    const realEdgeChains = stitchChains(boundaryPolylines, 2).filter(c => c.len >= MIN_REAL_EDGE);

    const containerPolys = [];
    for (const ent of dxf.entities) {
        if (ent.vertices) for (const v of ent.vertices) trackBounds(v);

        if (ent.layer === 'Container' && ent.vertices && ent.vertices.length >= 4) {
            const scaled = ent.vertices.map(v => ({ x: v.x * MM_TO_M, y: v.y * MM_TO_M }));
            const bbox = minAreaBBox(scaled);
            if (!bbox) continue;
            containerPolys.push({ ...bbox, vertices: scaled.map(v => [v.x, v.y]) });
            if (lines.length < 8000) lines.push(scaled.map(v => [v.x, v.y]));
        }

        if ((ent.layer === 'A-WALL-PRHT-EXTR' || ent.layer === "EXPORT WARE HOUSE(19 JULY'08)") && ent.vertices && ent.vertices.length >= 4) {
            const ring = scaleRing(ent.vertices);
            buildings.push(ring);
            if (lines.length < 8000) lines.push(ring);
        }
        if ((ent.layer === 'FENCE EXIM AREA' || ent.layer === 'PLOT BOUNDARY') && ent.vertices) {
            // Kept only as faint blueprint tracing (DxfBlueprint) — these
            // layers are fragmented survey lines that don't form one closed
            // ring (see computeYardBoundary below for the real wall outline).
            const ring = scaleRing(ent.vertices);
            if (lines.length < 8000) lines.push(ring);
        }
        if (['C-ROAD-OTLN', 'PAVED AREA', 'Existing IR Track', 'PROPOSED DFCC TRACK', 'siding cl'].includes(ent.layer) && ent.vertices) {
            if (lines.length < 8000) lines.push(scaleRing(ent.vertices));
        }
        if (ent.layer === 'C-ROAD-OTLN' && ent.vertices && ent.vertices.length >= 3) {
            roads.push(scaleRing(ent.vertices));
        }
        if ((ent.layer === 'GATE' || ent.layer === 'gate') && ent.vertices && ent.vertices.length >= 2) {
            gates.push(scaleRing(ent.vertices));
        }
    }

    // Group containers into blocks by spatial proximity. This yard has
    // containers sitting in small bays/clusters near sidings rather than
    // long uniform rows, so a union-find over nearby container centers
    // (rather than a fixed row direction) captures the real groupings,
    // including curved or staggered layouts.
    const LINK_DIST = 6; // metres — just over the ~2.44m bay pitch, under the ~13m bay-to-bay gap
    const n = containerPolys.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const d = Math.hypot(containerPolys[i].cx - containerPolys[j].cx, containerPolys[i].cy - containerPolys[j].cy);
            if (d < LINK_DIST) union(i, j);
        }
    }
    const groupMap = new Map();
    for (let i = 0; i < n; i++) {
        const r = find(i);
        if (!groupMap.has(r)) groupMap.set(r, []);
        groupMap.get(r).push(containerPolys[i]);
    }
    const groups = Array.from(groupMap.values());

    // Assign readable IDs: band groups into rows by cy (top to bottom), then
    // number left to right within each band.
    const ROW_BAND = 20; // metres
    groups.forEach(g => {
        g.cx = g.reduce((s, p) => s + p.cx, 0) / g.length;
        g.cy = g.reduce((s, p) => s + p.cy, 0) / g.length;
    });
    groups.sort((a, b) => b.cy - a.cy);
    const bands = [];
    for (const g of groups) {
        let band = bands.find(bd => Math.abs(bd.cy - g.cy) < ROW_BAND);
        if (!band) { band = { cy: g.cy, groups: [] }; bands.push(band); }
        band.groups.push(g);
    }
    bands.forEach(b => b.groups.sort((a, b2) => a.cx - b2.cx));

    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const blocks = [];
    bands.forEach((band, bi) => {
        const letter = LETTERS[bi] || `Z${bi}`;
        band.groups.forEach((g, gi) => {
            const id = `${letter}${gi + 1}`;
            const xs = g.map(p => p.cx), ys = g.map(p => p.cy);
            const minGX = Math.min(...g.map(p => p.cx - p.w / 2));
            const maxGX = Math.max(...g.map(p => p.cx + p.w / 2));
            const minGY = Math.min(...g.map(p => p.cy - p.h / 2));
            const maxGY = Math.max(...g.map(p => p.cy + p.h / 2));
            blocks.push({
                id,
                name: `Block-${id}`,
                cx: (minGX + maxGX) / 2,
                cy: (minGY + maxGY) / 2,
                w: Math.max(1, maxGX - minGX),
                h: Math.max(1, maxGY - minGY),
                angle: 0,
                zone: 'Import',
                containerCount: g.length,
            });
        });
    });

    // Real closed outer boundary, traced from actual yard content (the DXF's
    // own boundary/fence layers are too fragmented to use directly). Real,
    // long PLOT BOUNDARY chains (realEdgeChains) are folded into the same
    // rasterized fill so the traced contour follows them exactly where they
    // exist, instead of guessing that stretch too — see computeYardBoundary.
    const boundaryRing = computeYardBoundary(
        [...containerPolys.map(p => p.vertices), ...buildings],
        { realEdges: realEdgeChains.map(c => c.chain) }
    );

    if (boundaryRing) {
        // Close the ring (repeat the first point) so PerimeterWall — which
        // only draws edges between consecutive points, not last-to-first —
        // renders the final closing wall segment too.
        fences.push([...boundaryRing, boundaryRing[0]]);
        if (lines.length < 8000) lines.push([...boundaryRing, boundaryRing[0]]);
    }

    console.log(`  Sahnewal: ${containerPolys.length} containers -> ${groups.length} blocks (${bands.length} row bands)`);
    console.log(`  Sahnewal buildings: ${buildings.length}, boundary points: ${boundaryRing ? boundaryRing.length : 0}, real edge chains folded in: ${realEdgeChains.length}, roads: ${roads.length}`);

    return { blocks, buildings, warehouses, trees, fences, roads, gates, lines, minX, minY, maxX, maxY };
}

async function main() {
    const file = process.argv[2] || '..\\sahnewal autocad.dxf';
    if (!fs.existsSync(file)) {
        console.error(`DXF not found: ${file}`);
        console.error('Usage: node parse-dxf.mjs <path-to-dxf>');
        process.exit(1);
    }
    console.log(`Parsing ${file} ...`);
    const fileText = fs.readFileSync(file, 'utf-8');
    const parser = new DxfParser();
    const dxf = parser.parseSync(fileText);

    const parsed = parseSahnewal(dxf);
    const { blocks, buildings, warehouses, trees, fences, lines, minX, minY, maxX, maxY } = parsed;

    const result = {
        site: 'sahnewal',
        bounds: { minX, minY, maxX, maxY },
        blocks,
        buildings,
        warehouses,
        trees,
        texts: [],
        fences,
        roads: parsed.roads || [],
        gates: parsed.gates || [],
        lines: lines.slice(0, 8000),
    };

    fs.writeFileSync('public/yard-layout-sahnewal.json', JSON.stringify(result, null, 2));
    console.log(`Saved layout to public/yard-layout-sahnewal.json with:\n  ${blocks.length} blocks\n  ${buildings.length} buildings\n  ${fences.length} fences\n  ${trees.length} trees`);
    console.log('\nBlock IDs generated:');
    blocks.forEach(b => console.log(`  ${b.id}: cx=${b.cx.toFixed(1)}, cy=${b.cy.toFixed(1)}, ${b.w.toFixed(1)}x${b.h.toFixed(1)}m, containers=${b.containerCount}`));
}
main();
