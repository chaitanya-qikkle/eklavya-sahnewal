// Realistic shipping-container texture atlas + matching unit BoxGeometry.
//
// One 1024×1024 canvas atlas with four 512×512 regions:
//   • SIDE        (top-left)     → vertical corrugation ribs, top rail
//   • DOOR END    (top-right)    → twin doors, locking rods, hinges
//   • TOP         (bottom-left)  → corrugation lines + corner castings
//   • CLOSED END  (bottom-right) → smooth panel + corner castings
//
// The atlas uses the standard "image origin at top-left" convention. With
// Three.js's default flipY=true, a canvas pixel rect (x..x+w, y..y+h)
// maps to UV box (u=x/W .. (x+w)/W, v = 1-(y+h)/H .. 1-y/H).
//
// The exported BoxGeometry is a unit cube (1×1×1) with UVs reassigned so
// the six faces sample the correct atlas region. Instanced rendering scales
// it to the actual container dimensions — the corrugation stretches
// proportionally and still reads correctly.

import * as THREE from "three";

let _atlas = null; // set to null to force regeneration after texture changes
let _geom = null;

/* ---------------- atlas drawing helpers ---------------- */

function drawSide(ctx, x0, y0, size) {
  // Base panel (white — instance color will tint)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x0, y0, size, size);

  // Vertical corrugation ribs — keep shadows subtle so carrier colour dominates
  const ribs = 22;
  const ribW = size / ribs;
  for (let i = 0; i < ribs; i++) {
    const x = x0 + i * ribW;
    ctx.fillStyle = "rgba(0,0,0,0.13)";       // shadow trough (lighter than before)
    ctx.fillRect(x, y0, ribW * 0.18, size);
    ctx.fillStyle = "rgba(255,255,255,0.22)"; // highlight crest
    ctx.fillRect(x + ribW * 0.45, y0, ribW * 0.18, size);
    ctx.fillStyle = "rgba(0,0,0,0.03)";       // mid shade (barely there)
    ctx.fillRect(x + ribW * 0.65, y0, ribW * 0.35, size);
  }

  // Top rail
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(x0, y0, size, size * 0.07);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(x0, y0 + size * 0.005, size, size * 0.012);

  // Bottom rail
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.fillRect(x0, y0 + size * 0.90, size, size * 0.10);

  // Corner castings — darker squares each end
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x0,                 y0,                size * 0.04, size * 0.10);
  ctx.fillRect(x0 + size * 0.96,   y0,                size * 0.04, size * 0.10);
  ctx.fillRect(x0,                 y0 + size * 0.90,  size * 0.04, size * 0.10);
  ctx.fillRect(x0 + size * 0.96,   y0 + size * 0.90,  size * 0.04, size * 0.10);

  // Subtle weathering streaks
  for (let i = 0; i < 12; i++) {
    const sx = x0 + Math.random() * size;
    const sy = y0 + size * (0.18 + Math.random() * 0.5);
    const sl = size * (0.15 + Math.random() * 0.35);
    ctx.fillStyle = `rgba(60,40,30,${0.05 + Math.random() * 0.08})`;
    ctx.fillRect(sx, sy, 1.5, sl);
  }

  // Small painted owner-code box (rectangle that reads as a stencil)
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(x0 + size * 0.08, y0 + size * 0.22, size * 0.20, size * 0.10);
}

function drawDoorEnd(ctx, x0, y0, size) {
  // Base panel
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x0, y0, size, size);

  // Two big door panels with central vertical seam
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x0 + size * 0.495, y0 + size * 0.10, size * 0.01, size * 0.80);

  // Door perimeter frame (slight inset shadow)
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = Math.max(2, size * 0.006);
  ctx.strokeRect(x0 + size * 0.06, y0 + size * 0.08, size * 0.88, size * 0.84);

  // Vertical locking rods — 4 across (2 per door)
  const rodYs = [0.13, 0.92]; // top and bottom cam keepers
  const rodXs = [0.20, 0.40, 0.60, 0.80];
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  for (const rx of rodXs) {
    // rod
    ctx.fillRect(x0 + size * (rx - 0.006), y0 + size * 0.12, size * 0.012, size * 0.78);
    // top + bottom cam housings
    for (const ry of rodYs) {
      ctx.fillRect(x0 + size * (rx - 0.025), y0 + size * (ry - 0.02), size * 0.05, size * 0.04);
    }
    // handle around mid-height
    ctx.fillRect(x0 + size * (rx - 0.03), y0 + size * 0.48, size * 0.06, size * 0.04);
  }

  // Hinges along the outer edges
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  for (let i = 0; i < 4; i++) {
    const hy = y0 + size * (0.18 + i * 0.20);
    ctx.fillRect(x0 + size * 0.03, hy, size * 0.05, size * 0.04);
    ctx.fillRect(x0 + size * 0.92, hy, size * 0.05, size * 0.04);
  }

  // Corner castings — darker squares each corner
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x0,                 y0,                size * 0.06, size * 0.08);
  ctx.fillRect(x0 + size * 0.94,   y0,                size * 0.06, size * 0.08);
  ctx.fillRect(x0,                 y0 + size * 0.92,  size * 0.06, size * 0.08);
  ctx.fillRect(x0 + size * 0.94,   y0 + size * 0.92,  size * 0.06, size * 0.08);

  // Subtle wear streaks down the doors
  for (let i = 0; i < 18; i++) {
    const sx = x0 + size * (0.1 + Math.random() * 0.8);
    const sy = y0 + size * (0.15 + Math.random() * 0.7);
    ctx.fillStyle = `rgba(40,30,20,${0.05 + Math.random() * 0.07})`;
    ctx.fillRect(sx, sy, 1.2, size * (0.08 + Math.random() * 0.12));
  }
}

function drawTop(ctx, x0, y0, size) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x0, y0, size, size);

  // Subtle horizontal ribs (transverse corrugation on top panel)
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  const rows = 18;
  const rowH = size / rows;
  for (let i = 0; i < rows; i++) {
    ctx.fillRect(x0, y0 + i * rowH + rowH * 0.5, size, rowH * 0.18);
  }

  // Edge rails along long sides
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(x0, y0,                  size, size * 0.06);
  ctx.fillRect(x0, y0 + size * 0.94,    size, size * 0.06);

  // Corner castings — visible black blocks at corners
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(x0,                 y0,               size * 0.08, size * 0.08);
  ctx.fillRect(x0 + size * 0.92,   y0,               size * 0.08, size * 0.08);
  ctx.fillRect(x0,                 y0 + size * 0.92, size * 0.08, size * 0.08);
  ctx.fillRect(x0 + size * 0.92,   y0 + size * 0.92, size * 0.08, size * 0.08);

  // Roof grime
  for (let i = 0; i < 40; i++) {
    const sx = x0 + Math.random() * size;
    const sy = y0 + Math.random() * size;
    ctx.fillStyle = `rgba(30,25,20,${0.04 + Math.random() * 0.05})`;
    ctx.fillRect(sx, sy, 2 + Math.random() * 3, 1 + Math.random() * 2);
  }
}

function drawClosedEnd(ctx, x0, y0, size) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x0, y0, size, size);

  // Single large smooth panel — light corrugation only
  const ribs = 8;
  const ribW = size / ribs;
  for (let i = 0; i < ribs; i++) {
    const x = x0 + i * ribW;
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    ctx.fillRect(x, y0 + size * 0.08, ribW * 0.10, size * 0.84);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x + ribW * 0.55, y0 + size * 0.08, ribW * 0.10, size * 0.84);
  }

  // Top + bottom rails
  ctx.fillStyle = "rgba(0,0,0,0.40)";
  ctx.fillRect(x0, y0,                size, size * 0.08);
  ctx.fillRect(x0, y0 + size * 0.92,  size, size * 0.08);

  // Corner castings
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x0,                 y0,                size * 0.06, size * 0.10);
  ctx.fillRect(x0 + size * 0.94,   y0,                size * 0.06, size * 0.10);
  ctx.fillRect(x0,                 y0 + size * 0.90,  size * 0.06, size * 0.10);
  ctx.fillRect(x0 + size * 0.94,   y0 + size * 0.90,  size * 0.06, size * 0.10);
}

/* ---------------- atlas ---------------- */

export function containerAtlasTexture() {
  if (_atlas) return _atlas;
  const SIZE = 1024;
  const H = SIZE / 2;
  const cv = document.createElement("canvas");
  cv.width = cv.height = SIZE;
  const ctx = cv.getContext("2d");

  drawSide     (ctx, 0,  0,  H);  // top-left
  drawDoorEnd  (ctx, H,  0,  H);  // top-right
  drawTop      (ctx, 0,  H,  H);  // bottom-left
  drawClosedEnd(ctx, H,  H,  H);  // bottom-right

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  _atlas = tex;
  return tex;
}

/* ---------------- geometry with face-aware UVs ---------------- */

// Atlas UV rectangles (origin = bottom-left, V flipped against canvas Y)
// Canvas top-left quadrant   → V ∈ [0.5, 1.0]
// Canvas top-right quadrant  → V ∈ [0.5, 1.0]
// Canvas bottom-left         → V ∈ [0.0, 0.5]
// Canvas bottom-right        → V ∈ [0.0, 0.5]
const UV_SIDE       = { u0: 0.0, u1: 0.5, v0: 0.5, v1: 1.0 };
const UV_DOOR       = { u0: 0.5, u1: 1.0, v0: 0.5, v1: 1.0 };
const UV_TOP        = { u0: 0.0, u1: 0.5, v0: 0.0, v1: 0.5 };
const UV_CLOSED_END = { u0: 0.5, u1: 1.0, v0: 0.0, v1: 0.5 };

// BoxGeometry face order produced by THREE.BoxGeometry: +X, -X, +Y, -Y, +Z, -Z.
// Each face has 4 vertices (single segment box), so vertex i for face f
// lives at attribute index f*4 + i. The default UVs run (0,1) (1,1) (0,0) (1,0).
const FACE_TO_UV = [
  UV_DOOR,        // +X  → door end
  UV_CLOSED_END,  // -X  → closed end
  UV_TOP,         // +Y  → top
  UV_TOP,         // -Y  → reuse top (rarely visible)
  UV_SIDE,        // +Z  → long side
  UV_SIDE,        // -Z  → long side
];

function remapBoxUVs(geom) {
  const uv = geom.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const rect = FACE_TO_UV[f];
    const du = rect.u1 - rect.u0;
    const dv = rect.v1 - rect.v0;
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      const u = uv.getX(idx);
      const v = uv.getY(idx);
      uv.setXY(idx, rect.u0 + u * du, rect.v0 + v * dv);
    }
  }
  uv.needsUpdate = true;
}

// Single shared unit cube geometry with face-aware UVs.
// Instanced rendering scales it per-container.
export function containerUnitBoxGeometry() {
  if (_geom) return _geom;
  const g = new THREE.BoxGeometry(1, 1, 1);
  remapBoxUVs(g);
  _geom = g;
  return g;
}
