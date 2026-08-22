// A* pathfinding over a regular grid in scene XZ space, avoiding
// inflated block AABBs. Returns a string-pulled list of {x,z} waypoints.
//
// Designed to drop in next to PathNavigator's existing BFS, with the
// same input/output shape so it can be swapped freely.

const SQRT2 = Math.SQRT2;
const DIRS = [
  [ 1,  0, 1], [-1,  0, 1], [0,  1, 1], [0, -1, 1],
  [ 1,  1, SQRT2], [ 1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

// Min-heap keyed by f. Stores grid index + f.
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(node) {
    const a = this.a;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    if (!a.length) return null;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0, n = a.length;
      while (true) {
        const l = i * 2 + 1, r = l + 1;
        let s = i;
        if (l < n && a[l].f < a[s].f) s = l;
        if (r < n && a[r].f < a[s].f) s = r;
        if (s === i) break;
        [a[s], a[i]] = [a[i], a[s]];
        i = s;
      }
    }
    return top;
  }
}

export function aStarPath(start, target, blockBBoxes, opts = {}) {
  const GRID_CELL    = opts.cell    ?? 4;
  const BLOCK_MARGIN = opts.margin  ?? 1.5;
  const PAD          = opts.pad     ?? GRID_CELL * 8;
  // Optional road mask — when present we add a cost penalty for stepping
  // off the road network so the character prefers the DXF ROAD polygons.
  const roadMask     = opts.roadMask || null;
  const OFFROAD_COST = opts.offroadCost ?? 3.0;

  if (!blockBBoxes || blockBBoxes.length === 0) return [start, target];

  const obs = blockBBoxes.map(b => ({
    minX: b.minX - BLOCK_MARGIN, maxX: b.maxX + BLOCK_MARGIN,
    minZ: b.minZ - BLOCK_MARGIN, maxZ: b.maxZ + BLOCK_MARGIN,
  }));
  const isObs = (x, z) => {
    for (let i = 0; i < obs.length; i++) {
      const b = obs[i];
      if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true;
    }
    return false;
  };

  const allX = [start.x, target.x];
  const allZ = [start.z, target.z];
  for (const b of blockBBoxes) { allX.push(b.minX, b.maxX); allZ.push(b.minZ, b.maxZ); }
  const gX0 = Math.min(...allX) - PAD;
  const gZ0 = Math.min(...allZ) - PAD;
  const cols = Math.ceil((Math.max(...allX) - gX0 + PAD) / GRID_CELL) + 1;
  const rows = Math.ceil((Math.max(...allZ) - gZ0 + PAD) / GRID_CELL) + 1;
  const N = rows * cols;

  const toCell = p => ({
    c: Math.max(0, Math.min(cols - 1, Math.round((p.x - gX0) / GRID_CELL))),
    r: Math.max(0, Math.min(rows - 1, Math.round((p.z - gZ0) / GRID_CELL))),
  });
  const toWorld = (c, r) => ({ x: gX0 + c * GRID_CELL, z: gZ0 + r * GRID_CELL });
  const idx = (c, r) => r * cols + c;

  let sc = toCell(start), tc = toCell(target);
  // If start or target landed inside an inflated obstacle (very common —
  // GPS noise, container slot AABB, building edge), snap to the nearest
  // walkable cell so A* can actually expand. Without this the search
  // fails instantly and the caller used to get a straight line through
  // everything.
  const cellIsObs = (c, r) => {
    const w = toWorld(c, r);
    return isObs(w.x, w.z);
  };
  sc = snapToFree(sc.c, sc.r, cols, rows, cellIsObs);
  tc = snapToFree(tc.c, tc.r, cols, rows, cellIsObs);
  const sIdx = idx(sc.c, sc.r), tIdx = idx(tc.c, tc.r);

  const g = new Float32Array(N); g.fill(Infinity);
  const par = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);

  // Octile heuristic — admissible & consistent for 8-connected grids.
  const h = (c, r) => {
    const dc = Math.abs(c - tc.c), dr = Math.abs(r - tc.r);
    return Math.max(dc, dr) + (SQRT2 - 1) * Math.min(dc, dr);
  };

  g[sIdx] = 0;
  const open = new Heap();
  open.push({ i: sIdx, f: h(sc.c, sc.r) });

  // Track the closest cell we ever reach to the target. If full path
  // fails, we return at least a partial path to here — character will
  // walk along the concrete instead of cutting a straight line through
  // every building.
  let bestI = sIdx, bestH = h(sc.c, sc.r);

  while (open.size) {
    const cur = open.pop();
    if (closed[cur.i]) continue;
    closed[cur.i] = 1;
    const cc0 = cur.i % cols, cr0 = (cur.i / cols) | 0;
    const hh = h(cc0, cr0);
    if (hh < bestH) { bestH = hh; bestI = cur.i; }
    if (cur.i === tIdx) break;

    const cc = cc0, cr = cr0;
    for (const [dc, dr, cost] of DIRS) {
      const nc = cc + dc, nr = cr + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const ni = idx(nc, nr);
      if (closed[ni]) continue;
      const w = toWorld(nc, nr);
      if (isObs(w.x, w.z)) continue;
      // Block diagonal squeezes between two obstacle corners
      if (dc !== 0 && dr !== 0) {
        const wa = toWorld(cc + dc, cr), wb = toWorld(cc, cr + dr);
        if (isObs(wa.x, wa.z) || isObs(wb.x, wb.z)) continue;
      }
      const offRoad = roadMask && !roadMask.sample(w.x, w.z) ? OFFROAD_COST : 1.0;
      const ng = g[cur.i] + cost * offRoad;
      if (ng < g[ni]) {
        g[ni] = ng;
        par[ni] = cur.i;
        open.push({ i: ni, f: ng + h(nc, nr) });
      }
    }
  }

  // If we never reached the target, walk to the closest cell we managed
  // to reach — partial routes along concrete are always preferable to a
  // straight line punched through warehouses.
  const endI = (par[tIdx] !== -1 || tIdx === sIdx) ? tIdx : bestI;

  const raw = [];
  let cur = endI;
  while (cur !== -1) {
    raw.unshift(toWorld(cur % cols, (cur / cols) | 0));
    cur = par[cur];
  }
  // Append the literal target only when (a) the search reached its
  // cell AND (b) the target point itself is in free space. Otherwise
  // the final grid cell is the closest safe point we can hand to the
  // character without re-introducing a straight cut.
  const tail = (endI === tIdx && !isObs(target.x, target.z)) ? [target] : [];
  return stringPull([start, ...raw, ...tail], isObs);
}

// Outward BFS to find the nearest non-obstacle cell. Used to escape
// when start / target land inside an inflated obstacle envelope.
function snapToFree(c0, r0, cols, rows, isObsCell) {
  if (!isObsCell(c0, r0)) return { c: c0, r: r0 };
  const seen = new Uint8Array(cols * rows);
  const q = [c0, r0];
  seen[r0 * cols + c0] = 1;
  let head = 0, maxIter = 6000;
  while (head < q.length && maxIter-- > 0) {
    const c = q[head++], r = q[head++];
    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const k = nr * cols + nc;
      if (seen[k]) continue;
      seen[k] = 1;
      if (!isObsCell(nc, nr)) return { c: nc, r: nr };
      q.push(nc, nr);
    }
  }
  return { c: c0, r: r0 };
}

function stringPull(path, isObs) {
  if (path.length <= 2) return path;
  const out = [path[0]];
  let anchor = 0;
  for (let i = 2; i < path.length; i++) {
    if (!lineOfSight(path[anchor], path[i], isObs)) {
      out.push(path[i - 1]);
      anchor = i - 1;
    }
  }
  out.push(path[path.length - 1]);
  return out;
}

function lineOfSight(a, b, isObs, steps = 16) {
  for (let t = 1; t < steps; t++) {
    const f = t / steps;
    if (isObs(a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f)) return false;
  }
  return true;
}
