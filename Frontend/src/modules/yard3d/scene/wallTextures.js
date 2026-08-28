// wallTextures.js — procedural (canvas-based) PBR-ish texture sets for the
// perimeter wall system (PerimeterWallSystem.jsx). Same technique already
// used by groundTextures.js: draw one color canvas by hand, then derive
// normal/roughness/AO maps from its own luminance instead of hand-authoring
// three separate images. No network fetch, generated once and cached by the
// caller's useMemo.

import * as THREE from "three";
import { deriveNormalMap, deriveRoughnessMap, deriveAOMap } from "./groundTextures";

// ── Concrete wall shaft ─────────────────────────────────────────────────────
// A maintained-but-real industrial concrete panel: tonal variation, formwork
// panel seams, a couple of hairline cracks, faint vertical water-stain
// streaks, dust speckle. Deliberately subtle — a working facility, not a
// ruin.
export function makeConcreteWallCanvas(w = 512, h = 320) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#9c988d"; ctx.fillRect(0, 0, w, h);

  // Broad low-frequency tonal patches — no poured concrete is perfectly uniform.
  for (let i = 0; i < 16; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 30 + Math.random() * 90;
    const g = Math.floor(Math.random() * 20 - 10);
    ctx.fillStyle = `rgba(${150 + g},${146 + g},${134 + g},0.12)`;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.5 + Math.random() * 0.5), Math.random() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }

  // Fine aggregate/dust speckle.
  for (let i = 0; i < w * h * 0.02; i++) {
    const g = Math.floor(Math.random() * 24 + 140);
    ctx.fillStyle = `rgba(${g},${g - 2},${g - 8},0.25)`;
    ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * 1.6 + 0.4, Math.random() * 1.6 + 0.4);
  }

  // Formwork panel seams — two verticals dividing the tile into thirds, one
  // faint horizontal pour line partway up.
  ctx.strokeStyle = "rgba(70,66,58,0.35)"; ctx.lineWidth = 2;
  for (let x = w / 3; x < w; x += w / 3) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  ctx.strokeStyle = "rgba(70,66,58,0.22)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, h * 0.55); ctx.lineTo(w, h * 0.55 + (Math.random() - 0.5) * 4); ctx.stroke();

  // Hairline cracks — short jagged random-walks.
  ctx.strokeStyle = "rgba(50,48,42,0.4)";
  for (let i = 0; i < 5; i++) {
    let x = Math.random() * w, y = Math.random() * h;
    ctx.lineWidth = 0.6 + Math.random() * 0.6;
    ctx.beginPath(); ctx.moveTo(x, y);
    const steps = 4 + Math.floor(Math.random() * 6);
    for (let s = 0; s < steps; s++) { x += (Math.random() - 0.5) * 18; y += (Math.random() - 0.5) * 18; ctx.lineTo(x, y); }
    ctx.stroke();
  }

  // Faint vertical water-stain streaks.
  for (let i = 0; i < 7; i++) {
    const x = Math.random() * w;
    const sw = 4 + Math.random() * 10;
    const grad = ctx.createLinearGradient(x, 0, x, h);
    grad.addColorStop(0, "rgba(60,58,52,0.16)");
    grad.addColorStop(0.6, "rgba(60,58,52,0.05)");
    grad.addColorStop(1, "rgba(60,58,52,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - sw / 2, 0, sw, h);
  }

  // Faint edge-wear chips near the seams.
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    ctx.fillStyle = "rgba(210,206,196,0.10)";
    ctx.fillRect(x, y, 2 + Math.random() * 4, 1 + Math.random() * 2);
  }

  return c;
}

export function makeConcreteWallMaps(w = 512, h = 320) {
  const color = makeConcreteWallCanvas(w, h);
  const normalMap = deriveNormalMap(color, 1.1);
  const roughnessMap = deriveRoughnessMap(color, { base: 0.85, variance: 0.22 });
  const aoMap = deriveAOMap(color, 0.3);
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, normalMap, roughnessMap, aoMap };
}

// ── Base weathering band ────────────────────────────────────────────────────
// A short, uniformly grimy strip for the wall's ground contact line — dirt/
// dust accumulation, kept as its own small texture rather than a gradient
// baked into the tall wall canvas so there is no dependency on which way a
// given face's V axis happens to run.
export function makeWallBaseGrimeCanvas(px = 128) {
  const c = document.createElement("canvas"); c.width = px; c.height = Math.round(px * 0.5);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#5c5346"; ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < px * px * 0.05; i++) {
    const g = Math.floor(Math.random() * 24 + 50);
    ctx.fillStyle = `rgba(${g + 18},${g + 12},${g},0.3)`;
    ctx.fillRect(Math.random() * c.width, Math.random() * c.height, Math.random() * 2 + 0.5, Math.random() * 2 + 0.5);
  }
  // Symmetric vignette (darker at both edges) — reads as grime regardless of
  // which edge maps to "top" vs "ground" for a given face's UV winding.
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, "rgba(20,17,12,0.3)");
  grad.addColorStop(0.5, "rgba(20,17,12,0)");
  grad.addColorStop(1, "rgba(20,17,12,0.3)");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

export function makeWallBaseGrimeMaps(px = 128) {
  const color = makeWallBaseGrimeCanvas(px);
  const roughnessMap = deriveRoughnessMap(color, { base: 0.92, variance: 0.15 });
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, roughnessMap };
}

// ── Security fence — alpha-cutout vertical bars ────────────────────────────
// Same cheap technique as YardGround's grass blades (alphaTest cutout on a
// plane) instead of real per-bar geometry — reads as a palisade/mesh fence
// at yard-viewing distance for a fraction of the draw cost.
export function makeSecurityBarsTexture(w = 256, h = 256) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  const barCount = 8;
  const barW = w / (barCount * 2.4);
  ctx.fillStyle = "rgba(58,64,72,0.95)";
  for (let i = 0; i < barCount; i++) {
    const x = i * (w / barCount) + (w / barCount - barW) / 2;
    ctx.fillRect(x, 0, barW, h);
  }
  // Subtle metallic highlight down the center of each bar.
  ctx.fillStyle = "rgba(205,214,224,0.28)";
  for (let i = 0; i < barCount; i++) {
    const x = i * (w / barCount) + (w / barCount) / 2 - 1;
    ctx.fillRect(x, 0, 2, h);
  }
  // A couple of thin horizontal tie-wires for detail.
  ctx.fillStyle = "rgba(40,45,52,0.5)";
  ctx.fillRect(0, h * 0.28, w, 2);
  ctx.fillRect(0, h * 0.72, w, 2);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ── Gate leaf — ribbed steel plate with a hazard-stripe kick plate ─────────
export function makeGateLeafTexture(w = 512, h = 384) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#3a4048"; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(15,18,22,0.5)"; ctx.lineWidth = 3;
  for (let x = 0; x < w; x += 14) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }

  // Diagonal hazard stripes along the bottom kick plate.
  const stripeH = h * 0.12;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, h - stripeH, w, stripeH); ctx.clip();
  for (let x = -h; x < w + h; x += 36) {
    ctx.fillStyle = (Math.floor(x / 36) % 2 === 0) ? "#ffce31" : "#141414";
    ctx.beginPath();
    ctx.moveTo(x, h - stripeH); ctx.lineTo(x + stripeH, h); ctx.lineTo(x + stripeH + 18, h); ctx.lineTo(x + 18, h - stripeH);
    ctx.fill();
  }
  ctx.restore();

  // Rivets.
  for (let y = 20; y < h - stripeH; y += 40) {
    for (let x = 20; x < w; x += 60) {
      ctx.fillStyle = "rgba(200,206,214,0.35)";
      ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ── Sign plaques ─────────────────────────────────────────────────────────
// ── Shared singletons ────────────────────────────────────────────────────
// The real perimeter (PerimeterWallSystem) and every hand-drawn custom wall
// in the Yard Builder (PropKit's IndustrialWallPanel) are meant to read as
// literally the same wall — so they share these cached texture objects
// instead of each generating (and paying for) their own copy of the same
// canvas + derived normal/roughness/AO passes.
let _concreteWallMapsCache = null;
export function getConcreteWallMaps() {
  if (!_concreteWallMapsCache) _concreteWallMapsCache = makeConcreteWallMaps(512, 320);
  return _concreteWallMapsCache;
}
let _wallBaseGrimeMapsCache = null;
export function getWallBaseGrimeMaps() {
  if (!_wallBaseGrimeMapsCache) _wallBaseGrimeMapsCache = makeWallBaseGrimeMaps(128);
  return _wallBaseGrimeMapsCache;
}
let _securityBarsTexCache = null;
export function getSecurityBarsTexture() {
  if (!_securityBarsTexCache) _securityBarsTexCache = makeSecurityBarsTexture(256, 256);
  return _securityBarsTexCache;
}
let _gateLeafTexCache = null;
export function getGateLeafTexture() {
  if (!_gateLeafTexCache) _gateLeafTexCache = makeGateLeafTexture(512, 384);
  return _gateLeafTexCache;
}

export function makeWallSignTexture(lines, variant = "warning") {
  const w = 512, h = 320;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  const palette = variant === "danger"
    ? { bg: "#7a1414", border: "#ffce31", text: "#fff4d6" }
    : variant === "info"
      ? { bg: "#0d3b66", border: "#bcd8ff", text: "#eaf3ff" }
      : { bg: "#1c1c1c", border: "#ffce31", text: "#ffe9a8" };
  ctx.fillStyle = palette.bg; ctx.fillRect(0, 0, w, h);
  ctx.lineWidth = 10; ctx.strokeStyle = palette.border; ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.fillStyle = palette.text;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const arr = Array.isArray(lines) ? lines : [lines];
  const fs = arr.length > 1 ? 52 : 64;
  ctx.font = `800 ${fs}px 'Segoe UI',Arial,sans-serif`;
  const lineH = fs * 1.15;
  const startY = h / 2 - ((arr.length - 1) * lineH) / 2;
  arr.forEach((t, i) => ctx.fillText(t, w / 2, startY + i * lineH));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
