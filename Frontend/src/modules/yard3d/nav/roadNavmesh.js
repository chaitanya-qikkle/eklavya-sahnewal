// Build a walkable mask from the ROAD layer polygons. The mask is later
// fed to A* as an "off-road" cost penalty so the character prefers
// staying inside drawn roads.
//
// Pure JS, no Three deps. Polygons are expected in scene-XZ space already.

function pointInPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1];
    const xj = poly[j][0], zj = poly[j][1];
    const intersect = ((zi > z) !== (zj > z)) &&
      (x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// roads: array of polygons, each polygon = [[x,z], ...]
export function buildRoadMask(roads, opts = {}) {
  if (!roads?.length) return null;
  const cell = opts.cell ?? 4;

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const r of roads) for (const [x, z] of r) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const pad = cell * 4;
  minX -= pad; maxX += pad; minZ -= pad; maxZ += pad;
  const cols = Math.ceil((maxX - minX) / cell) + 1;
  const rows = Math.ceil((maxZ - minZ) / cell) + 1;
  const data = new Uint8Array(cols * rows);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = minX + c * cell, z = minZ + r * cell;
      let onRoad = false;
      for (const poly of roads) {
        if (pointInPolygon(x, z, poly)) { onRoad = true; break; }
      }
      data[r * cols + c] = onRoad ? 1 : 0;
    }
  }

  return {
    minX, minZ, cell, cols, rows, data,
    sample(x, z) {
      const c = Math.round((x - minX) / cell);
      const r = Math.round((z - minZ) / cell);
      if (c < 0 || c >= cols || r < 0 || r >= rows) return 0;
      return data[r * cols + c];
    },
  };
}
