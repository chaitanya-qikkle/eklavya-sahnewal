// Parses ESS_MST_SLOT INSERTs from slot_geofence.sql into a compact JSON
// the 3D yard renderer can consume directly.
//
// Output: Frontend/public/slot-geofence.json
//
//   {
//     bounds: { minLat, maxLat, minLng, maxLng },
//     blocks: {
//       "E1": { id, rows: [...], cols: [...], centerLat, centerLng,
//               minLat, maxLat, minLng, maxLng, slotCount }
//     },
//     slots: [
//       { key, block, row, col, lat, lng,
//         polygon: [[lat,lng], ...] }
//     ]
//   }

import fs from "fs";

const SRC = process.argv[2] || "../slot_geofence.sql";
const OUT = "public/slot-geofence.json";

if (!fs.existsSync(SRC)) {
  console.error(`Source not found: ${SRC}`);
  process.exit(1);
}

const text = fs.readFileSync(SRC, "utf-8");

// VALUES('SLOTNAME','BLOCK','COLUMN','ROW',YARDID,'status','LATLONG', …)
// LATLONG is "lat lng,lat lng,lat lng,..."
const rowRe =
  /VALUES\('([^']+)','([^']+)','([^']+)','([^']+)',(\d+),'(\d+)','([^']+)'/g;

const blocks = new Map();
const slots = [];
let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
let n = 0;

let m;
while ((m = rowRe.exec(text)) !== null) {
  n++;
  const [, slotName, block, col, row, , , latlong] = m;

  const polygon = latlong
    .split(",")
    .map(p => p.trim().split(/\s+/).map(Number))
    .filter(p => p.length === 2 && !isNaN(p[0]) && !isNaN(p[1]));

  if (polygon.length < 3) continue;

  // Slot centroid
  let lat = 0, lng = 0;
  for (const [la, lo] of polygon) { lat += la; lng += lo; }
  lat /= polygon.length; lng /= polygon.length;

  for (const [la, lo] of polygon) {
    if (la < minLat) minLat = la;
    if (la > maxLat) maxLat = la;
    if (lo < minLng) minLng = lo;
    if (lo > maxLng) maxLng = lo;
  }

  const key = `${block}|${row}|${col}`;
  slots.push({ key, slotName, block, row, col, lat, lng, polygon });

  let b = blocks.get(block);
  if (!b) {
    b = {
      id: block,
      rows: new Set(),
      cols: new Set(),
      minLat: Infinity, maxLat: -Infinity,
      minLng: Infinity, maxLng: -Infinity,
      slotCount: 0,
      sumLat: 0, sumLng: 0,
    };
    blocks.set(block, b);
  }
  b.rows.add(row);
  b.cols.add(col);
  b.slotCount += 1;
  b.sumLat += lat;
  b.sumLng += lng;
  for (const [la, lo] of polygon) {
    if (la < b.minLat) b.minLat = la;
    if (la > b.maxLat) b.maxLat = la;
    if (lo < b.minLng) b.minLng = lo;
    if (lo > b.maxLng) b.maxLng = lo;
  }
}

const blocksObj = {};
for (const [id, b] of blocks) {
  const rowsArr = [...b.rows].sort();
  const colsArr = [...b.cols]
    .map(c => Number(c))
    .filter(c => !isNaN(c))
    .sort((a, c) => a - c);
  blocksObj[id] = {
    id,
    rows: rowsArr,
    cols: colsArr,
    centerLat: b.sumLat / b.slotCount,
    centerLng: b.sumLng / b.slotCount,
    minLat: b.minLat, maxLat: b.maxLat,
    minLng: b.minLng, maxLng: b.maxLng,
    slotCount: b.slotCount,
  };
}

const out = {
  bounds: { minLat, maxLat, minLng, maxLng },
  blocks: blocksObj,
  slots,
};

fs.writeFileSync(OUT, JSON.stringify(out));
const sizeKb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(
  `Parsed ${n} slots across ${blocks.size} blocks. ` +
  `Bounds: (${minLat.toFixed(6)}..${maxLat.toFixed(6)}, ${minLng.toFixed(6)}..${maxLng.toFixed(6)}). ` +
  `Wrote ${OUT} (${sizeKb} KB).`
);
