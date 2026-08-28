// Shared boundary-tracing helpers used by both parse-dxf.mjs and
// parse-layout-coordinates.mjs.

// ── Yard outer boundary — traced from actual content, not a loose hull ────
// Real survey boundary/fence layers are typically fragmented into dozens of
// disconnected line pieces that don't stitch into one ring even with a
// generous gap tolerance, so there's rarely a ready-made closed perimeter to
// use directly. Instead this rasterizes every polygon (container footprints,
// buildings, etc.) onto a coarse grid, closes small gaps between them
// (morphological dilate+erode, not permanent dilation), traces the outer
// contour of the filled region, and simplifies it — this hugs the yard's
// real notches/angles far more tightly than a convex hull.
export function computeYardBoundary(polygons, { cell = 4, dilateIterations = 6, simplifyEpsilon, realEdges = [] } = {}) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const ring of polygons) for (const [x, y] of ring) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    for (const edge of realEdges) for (const [x, y] of edge) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (!isFinite(minX)) return null;
    minX -= cell * 5; minY -= cell * 5; maxX += cell * 5; maxY += cell * 5;
    const W = Math.ceil((maxX - minX) / cell), H = Math.ceil((maxY - minY) / cell);
    const grid = new Uint8Array(W * H);

    for (const ring of polygons) {
        let rminX = Infinity, rminY = Infinity, rmaxX = -Infinity, rmaxY = -Infinity;
        for (const [x, y] of ring) { if (x < rminX) rminX = x; if (x > rmaxX) rmaxX = x; if (y < rminY) rminY = y; if (y > rmaxY) rmaxY = y; }
        const gx0 = Math.max(0, Math.floor((rminX - minX) / cell));
        const gx1 = Math.min(W - 1, Math.ceil((rmaxX - minX) / cell));
        const gy0 = Math.max(0, Math.floor((rminY - minY) / cell));
        const gy1 = Math.min(H - 1, Math.ceil((rmaxY - minY) / cell));
        for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) grid[gy * W + gx] = 1;
    }
    const setCell = (gx, gy) => { if (gx >= 0 && gy >= 0 && gx < W && gy < H) grid[gy * W + gx] = 1; };

    // Real edge lines (actual survey lines, e.g. the yard's true top edge)
    // are folded into the same fill mask so the traced contour follows them
    // exactly where they exist: rasterize the line itself as a thick strip,
    // then flood-fill straight down from each line cell until it meets the
    // already-filled yard content — this closes the gap between the real
    // (outer) line and the yard mass with no seam or overlap logic needed,
    // unlike a post-hoc point-array splice.
    for (const edgePts of realEdges) {
        for (let i = 0; i < edgePts.length - 1; i++) {
            const [x1, y1] = edgePts[i], [x2, y2] = edgePts[i + 1];
            const segLen = Math.hypot(x2 - x1, y2 - y1);
            const steps = Math.max(1, Math.ceil(segLen / (cell / 2)));
            for (let s = 0; s <= steps; s++) {
                const t = s / steps;
                const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
                const gx = Math.round((x - minX) / cell), gy = Math.round((y - minY) / cell);
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) setCell(gx + dx, gy + dy);
            }
        }
    }
    for (const edgePts of realEdges) {
        for (let i = 0; i < edgePts.length - 1; i++) {
            const [x1, y1] = edgePts[i], [x2, y2] = edgePts[i + 1];
            const segLen = Math.hypot(x2 - x1, y2 - y1);
            const steps = Math.max(1, Math.ceil(segLen / (cell / 2)));
            for (let s = 0; s <= steps; s++) {
                const t = s / steps;
                const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
                const gx = Math.round((x - minX) / cell);
                let gy = Math.round((y - minY) / cell);
                // Walk toward the filled mass (search both directions a
                // bounded distance) and fill the connecting strip.
                let foundDir = 0;
                for (let d = 1; d <= H; d++) {
                    if (grid[Math.min(H - 1, gy + d) * W + Math.max(0, Math.min(W - 1, gx))]) { foundDir = 1; break; }
                    if (grid[Math.max(0, gy - d) * W + Math.max(0, Math.min(W - 1, gx))]) { foundDir = -1; break; }
                    if (d > 60) break; // safety cap (~240m at cell=4)
                }
                if (foundDir !== 0) {
                    for (let d = 0; d <= 60; d++) {
                        const yy = gy + foundDir * d;
                        if (yy < 0 || yy >= H) break;
                        if (foundDir === 1 && grid[yy * W + Math.max(0, Math.min(W - 1, gx))]) break;
                        if (foundDir === -1 && grid[yy * W + Math.max(0, Math.min(W - 1, gx))]) break;
                        setCell(gx, yy);
                    }
                }
            }
        }
    }

    // Morphological closing (dilate then erode by the same amount) to bridge
    // the aisles between block rows without permanently puffing out the
    // outer silhouette the way plain dilation does — after eroding back,
    // only gaps narrower than ~2×dilateIterations×cell stay filled, while
    // the true outer edge returns close to its original position.
    function dilateOnce(src) {
        const next = new Uint8Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            if (src[y * W + x]) { next[y * W + x] = 1; continue; }
            for (let dy = -1; dy <= 1 && !next[y * W + x]; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                    if (src[ny * W + nx]) { next[y * W + x] = 1; break; }
                }
            }
        }
        return next;
    }
    function erodeOnce(src) {
        const next = new Uint8Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            if (!src[y * W + x]) continue;
            let keep = true;
            for (let dy = -1; dy <= 1 && keep; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx, ny = y + dy;
                    // Treat out-of-bounds as filled so the outer silhouette
                    // doesn't erode away at the grid edge.
                    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                    if (!src[ny * W + nx]) { keep = false; break; }
                }
            }
            next[y * W + x] = keep ? 1 : 0;
        }
        return next;
    }
    let cur = grid;
    for (let it = 0; it < dilateIterations; it++) cur = dilateOnce(cur);
    for (let it = 0; it < dilateIterations; it++) cur = erodeOnce(cur);
    const mask = cur;

    // Trace boundary edges (filled cell adjacent to empty cell), then stitch
    // them into closed loops by matching shared endpoints.
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : mask[y * W + x];
    const edges = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!at(x, y)) continue;
        if (!at(x, y - 1)) edges.push([[x, y], [x + 1, y]]);
        if (!at(x, y + 1)) edges.push([[x, y + 1], [x + 1, y + 1]]);
        if (!at(x - 1, y)) edges.push([[x, y], [x, y + 1]]);
        if (!at(x + 1, y)) edges.push([[x + 1, y], [x + 1, y + 1]]);
    }
    const key = (p) => `${p[0]},${p[1]}`;
    const adj = new Map();
    for (const [a, b] of edges) {
        if (!adj.has(key(a))) adj.set(key(a), []);
        if (!adj.has(key(b))) adj.set(key(b), []);
        adj.get(key(a)).push(b);
        adj.get(key(b)).push(a);
    }
    const edgeKey = (a, b) => { const ka = key(a), kb = key(b); return ka < kb ? ka + '|' + kb : kb + '|' + ka; };
    const usedEdges = new Set();
    const loops = [];
    for (const [a0, b0] of edges) {
        const ek = edgeKey(a0, b0);
        if (usedEdges.has(ek)) continue;
        usedEdges.add(ek);
        const loop = [a0, b0];
        let cur2 = b0, prev = a0, guard = 0;
        while (guard++ < 200000) {
            const neighbors = adj.get(key(cur2)) || [];
            let next = null;
            for (const n of neighbors) {
                if (n[0] === prev[0] && n[1] === prev[1]) continue;
                const ek2 = edgeKey(cur2, n);
                if (usedEdges.has(ek2)) continue;
                next = n; break;
            }
            if (!next) break;
            usedEdges.add(edgeKey(cur2, next));
            loop.push(next);
            prev = cur2; cur2 = next;
            if (cur2[0] === loop[0][0] && cur2[1] === loop[0][1]) break;
        }
        loops.push(loop);
    }
    loops.sort((a, b) => b.length - a.length);
    if (!loops.length) return null;

    const outerGrid = loops[0].map(([gx, gy]) => [minX + gx * cell, minY + gy * cell]);

    // Douglas-Peucker simplification to remove the grid's staircase artifacts.
    const eps = simplifyEpsilon ?? cell * 1.8;
    function perpDist(p, a, b) {
        const [x, y] = p, [x1, y1] = a, [x2, y2] = b;
        const dx = x2 - x1, dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return Math.hypot(x - x1, y - y1);
        let t = ((x - x1) * dx + (y - y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
    }
    function dp(points, epsilon) {
        if (points.length < 3) return points;
        let maxD = 0, idx = 0;
        for (let i = 1; i < points.length - 1; i++) {
            const d = perpDist(points[i], points[0], points[points.length - 1]);
            if (d > maxD) { maxD = d; idx = i; }
        }
        if (maxD > epsilon) {
            const left = dp(points.slice(0, idx + 1), epsilon);
            const right = dp(points.slice(idx), epsilon);
            return left.slice(0, -1).concat(right);
        }
        return [points[0], points[points.length - 1]];
    }
    return dp(outerGrid, eps);
}

// Stitch a set of open polylines end-to-end wherever their endpoints are
// within tolMeters of each other. Returns chains sorted longest-first, each
// with its total length and whether its own start/end closed into a loop.
export function stitchChains(polylines, tolMeters) {
    const used = new Array(polylines.length).fill(false);
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const chains = [];
    for (let i = 0; i < polylines.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        let chain = polylines[i].slice();
        let extended = true;
        while (extended) {
            extended = false;
            for (let j = 0; j < polylines.length; j++) {
                if (used[j]) continue;
                const pl = polylines[j];
                const head = chain[0], tail = chain[chain.length - 1];
                if (dist(tail, pl[0]) < tolMeters) { chain = chain.concat(pl.slice(1)); used[j] = true; extended = true; break; }
                if (dist(tail, pl[pl.length - 1]) < tolMeters) { chain = chain.concat(pl.slice(0, -1).reverse()); used[j] = true; extended = true; break; }
                if (dist(head, pl[pl.length - 1]) < tolMeters) { chain = pl.slice(0, -1).concat(chain); used[j] = true; extended = true; break; }
                if (dist(head, pl[0]) < tolMeters) { chain = pl.slice(1).reverse().concat(chain); used[j] = true; extended = true; break; }
            }
        }
        let len = 0;
        for (let k = 1; k < chain.length; k++) len += dist(chain[k - 1], chain[k]);
        chains.push({ chain, len, closed: dist(chain[0], chain[chain.length - 1]) < tolMeters });
    }
    chains.sort((a, b) => b.len - a.len);
    return chains;
}
