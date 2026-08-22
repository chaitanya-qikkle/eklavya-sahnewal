import fs from 'fs';
import DxfParser from 'dxf-parser';

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

// Detect which site the DXF is for based on layers
function detectSite(layers) {
    if (layers.has('CONTAINER')) return 'chennai';
    return 'mumbai';
}

// ── MUMBAI PARSER ──────────────────────────────────────────────────────────
function parseMumbai(dxf) {
    const blocks = [], lines = [], buildings = [], warehouses = [], trees = [], fences = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const labels = [];
    for (const ent of dxf.entities) {
        if (ent.type === 'TEXT' || ent.type === 'MTEXT') {
            const t = (ent.text || '').toUpperCase();
            if (t.includes('IMPORT') || t.includes('EXPORT') || t.includes('EMPTY')) {
                const px = ent.position?.x || ent.startPoint?.x || ent.x;
                const py = ent.position?.y || ent.startPoint?.y || ent.y;
                if (px && py) {
                    let kind = 'Transit';
                    if (t.includes('IMPORT')) kind = 'Import';
                    if (t.includes('EXPORT')) kind = 'Export';
                    if (t.includes('EMPTY')) kind = 'Empty';
                    labels.push({ kind, x: px, y: py });
                }
            }
        }
    }

    for (const ent of dxf.entities) {
        if (ent.vertices) {
            for (const v of ent.vertices) {
                if (v.x < minX) minX = v.x; if (v.y < minY) minY = v.y;
                if (v.x > maxX) maxX = v.x; if (v.y > maxY) maxY = v.y;
            }
        }

        if (ent.layer && (ent.layer.startsWith('BLOCK-') || ent.layer.toUpperCase().includes('BLOCK'))) {
            if (ent.vertices && ent.vertices.length >= 4) {
                const bbox = minAreaBBox(ent.vertices);
                if (!bbox) continue;
                const { cx, cy, w, h, angle } = bbox;
                let zone = 'Import', minDist = Infinity;
                for (const l of labels) {
                    const d = Math.hypot(cx - l.x, cy - l.y);
                    if (d < minDist) { minDist = d; zone = l.kind; }
                }
                const id = ent.layer.replace('BLOCK-', '');
                blocks.push({ id, name: ent.layer, cx, cy, w, h, angle, zone });
            }
        }

        if (ent.layer === 'TIN Shed' && ent.type.includes('POLYLINE') && ent.vertices) {
            warehouses.push(ent.vertices.map(v => [v.x, v.y]));
            if (lines.length < 8000) lines.push(ent.vertices.map(v => [v.x, v.y]));
        }
        if (ent.layer === 'Building' && ent.type.includes('POLYLINE') && ent.vertices) {
            buildings.push(ent.vertices.map(v => [v.x, v.y]));
            if (lines.length < 8000) lines.push(ent.vertices.map(v => [v.x, v.y]));
        }
        if (['ROAD', 'Boundary Wall', 'Green Area', 'TIN Shed', 'Fencing'].includes(ent.layer) && ent.vertices) {
            if (lines.length < 8000) lines.push(ent.vertices.map(v => [v.x, v.y]));
        }
        if (['Boundary Wall', 'Fencing'].includes(ent.layer) && ent.vertices) {
            fences.push(ent.vertices.map(v => [v.x, v.y]));
        }
        if (ent.layer === 'TR') {
            const px = ent.x || (ent.position ? ent.position.x : 0);
            const py = ent.y || (ent.position ? ent.position.y : 0);
            if (px !== 0) trees.push({ cx: px, cy: py });
        }
    }

    blocks.sort((a, b) => a.id.localeCompare(b.id));
    // Split buildings by area: > 500 sqm treated as warehouses
    function polyArea(ring) {
        let a = 0;
        for (let i = 0; i < ring.length; i++) {
            const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
            a += x1 * y2 - x2 * y1;
        }
        return Math.abs(a) / 2;
    }
    const finalWarehouses = buildings.filter(r => polyArea(r) >= 500);
    const finalBuildings = buildings.filter(r => polyArea(r) < 500);

    return { blocks, buildings: finalBuildings, warehouses: finalWarehouses, trees, fences, lines, minX, minY, maxX, maxY };
}

// ── CHENNAI PARSER ─────────────────────────────────────────────────────────
function parseChennai(dxf) {
    const lines = [], buildings = [], warehouses = [], trees = [], fences = [], roads = [], gates = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // Site clamp — outliers in the DXF (stray container ~359k/1474k) must not
    // be allowed to expand the bounds, or the 3D camera ends up impossibly far.
    const SITE = { minX: 420800, maxX: 421400, minY: 1458150, maxY: 1458620 };
    const inSite = (x, y) => x >= SITE.minX && x <= SITE.maxX && y >= SITE.minY && y <= SITE.maxY;
    const trackBounds = (v) => {
        if (!inSite(v.x, v.y)) return;
        if (v.x < minX) minX = v.x; if (v.y < minY) minY = v.y;
        if (v.x > maxX) maxX = v.x; if (v.y > maxY) maxY = v.y;
    };

    // Collect all CONTAINER polygons with valid vertices
    const containerPolys = [];
    for (const ent of dxf.entities) {
        if (ent.vertices) for (const v of ent.vertices) trackBounds(v);

        if (ent.layer === 'CONTAINER' && ent.vertices && ent.vertices.length >= 4) {
            const xs = ent.vertices.map(v => v.x);
            const ys = ent.vertices.map(v => v.y);
            const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
            const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
            const w = Math.max(...xs) - Math.min(...xs);
            const h = Math.max(...ys) - Math.min(...ys);
            // Skip the outlier that's far from the main site
            if (cx < 420800 || cx > 421400 || cy < 1458200 || cy > 1458550) continue;
            containerPolys.push({ cx, cy, w, h, vertices: ent.vertices.map(v => [v.x, v.y]) });
        }

        // Buildings - collected separately, split by area later
        if ((ent.layer === 'BUILDING' || ent.layer === 'BUILD') && ent.vertices && ent.vertices.length >= 4) {
            const ring = ent.vertices.map(v => [v.x, v.y]);
            buildings.push(ring);
            if (lines.length < 8000) lines.push(ring);
        }
        // Fences / compound wall
        if ((ent.layer === 'fence' || ent.layer === 'CWALL') && ent.vertices) {
            fences.push(ent.vertices.map(v => [v.x, v.y]));
            if (lines.length < 8000) lines.push(ent.vertices.map(v => [v.x, v.y]));
        }
        // Roads and boundary for background lines
        if (['ROAD', 'BOUNDARY', 'HATCH', 'Paver'].includes(ent.layer) && ent.vertices) {
            if (lines.length < 8000) lines.push(ent.vertices.map(v => [v.x, v.y]));
        }
        // ROAD polygons → walkable area for character navmesh
        if (ent.layer === 'ROAD' && ent.vertices && ent.vertices.length >= 3) {
            roads.push(ent.vertices.map(v => [v.x, v.y]));
        }
        // GATE layer (entry/exit points)
        if ((ent.layer === 'GATE' || ent.layer === 'gate') && ent.vertices && ent.vertices.length >= 2) {
            gates.push(ent.vertices.map(v => [v.x, v.y]));
        }
        // Container polygon outlines on the blueprint
        if (ent.layer === 'CONTAINER' && ent.vertices && ent.vertices.length >= 4) {
            if (lines.length < 8000) lines.push(ent.vertices.map(v => [v.x, v.y]));
        }
        // Trees
        if (ent.layer === 'TREE') {
            const px = ent.x || ent.position?.x || 0;
            const py = ent.y || ent.position?.y || 0;
            if (px > 0) trees.push({ cx: px, cy: py });
        }
    }

    // Sort container polys top-to-bottom (desc Y), then left-to-right (asc X)
    containerPolys.sort((a, b) => b.cy - a.cy || a.cx - b.cx);

    // Group into rows by proximity in Y (within 25m = same row)
    const ROW_GAP = 25;
    const rows = [];
    for (const p of containerPolys) {
        let placed = false;
        for (const row of rows) {
            if (Math.abs(row.cy - p.cy) < ROW_GAP) {
                row.polys.push(p);
                row.cy = row.polys.reduce((s, r) => s + r.cy, 0) / row.polys.length;
                placed = true; break;
            }
        }
        if (!placed) rows.push({ cy: p.cy, polys: [p] });
    }

    // Sort each row left to right
    rows.forEach(row => row.polys.sort((a, b) => a.cx - b.cx));

    // Assign IDs: row letter (A,B,C..) + index number
    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const blocks = [];
    rows.forEach((row, ri) => {
        const letter = LETTERS[ri] || `Z${ri}`;
        row.polys.forEach((p, ci) => {
            const id = `${letter}${ci + 1}`;
            blocks.push({
                id,
                name: `Block-${id}`,
                cx: p.cx,
                cy: p.cy,
                w: p.w,
                h: p.h,
                angle: 0,
                zone: 'Import',
                polygon: p.vertices,
            });
        });
    });

    // Split buildings by polygon area: >= 200 sqm → warehouse (tall, light-coloured), rest → small building
    function polyArea(ring) {
        let a = 0;
        for (let i = 0; i < ring.length; i++) {
            const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
            a += x1 * y2 - x2 * y1;
        }
        return Math.abs(a) / 2;
    }
    const finalWarehouses = buildings.filter(r => polyArea(r) >= 200);
    const finalBuildings = buildings.filter(r => polyArea(r) < 200);
    console.log(`  Chennai buildings: ${finalWarehouses.length} warehouses + ${finalBuildings.length} small`);
    console.log(`  Chennai roads: ${roads.length} polygons, gates: ${gates.length}`);

    return { blocks, buildings: finalBuildings, warehouses: finalWarehouses, trees, fences, roads, gates, lines, minX, minY, maxX, maxY };
}

async function main() {
    const file = process.argv[2] || '..\\CFS_Container Yard_Mumbai_19.07.25.dxf';
    if (!fs.existsSync(file)) {
        console.error(`DXF not found: ${file}`);
        console.error('Usage: node parse-dxf.mjs <path-to-dxf>');
        process.exit(1);
    }
    console.log(`Parsing ${file} ...`);
    const fileText = fs.readFileSync(file, 'utf-8');
    const parser = new DxfParser();
    const dxf = parser.parseSync(fileText);

    const layers = new Set(dxf.entities.map(e => e.layer).filter(Boolean));
    const site = detectSite(layers);
    console.log(`Detected site: ${site}`);

    const parsed = site === 'chennai' ? parseChennai(dxf) : parseMumbai(dxf);
    const { blocks, buildings, warehouses, trees, fences, lines, minX, minY, maxX, maxY } = parsed;

    const result = {
        site,
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

    fs.writeFileSync('public/yard-layout.json', JSON.stringify(result, null, 2));
    console.log(`Saved layout to public/yard-layout.json with:\n  ${blocks.length} blocks\n  ${buildings.length} buildings\n  ${fences.length} fences\n  ${trees.length} trees\n  site=${site}`);
    if (site === 'chennai') {
        console.log('\nBlock IDs generated:');
        blocks.forEach(b => console.log(`  ${b.id}: cx=${b.cx.toFixed(0)}, cy=${b.cy.toFixed(0)}, ${b.w.toFixed(1)}x${b.h.toFixed(1)}m`));
    }
}
main();
