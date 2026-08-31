/* eslint-disable no-unused-vars */
// YardScene — realistic 3D yard with geofence slots + DXF buildings
import React, { useMemo, useRef, useLayoutEffect, useEffect } from "react";
import { RoadPainterCanvas } from "../tools/RoadPainter";
import { YardBuilderCanvas } from "../tools/YardBuilder";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sky } from "@react-three/drei";
import * as THREE from "three";
import LiveEquipmentLayer from "../live/LiveEquipmentLayer";
import PropsLayer from "../tools/PropKit";
import PathNavigator from "./PathNavigator";
import FpsAdaptor from "../perf/FpsAdaptor";
import PostFX from "../perf/PostFX";
import { useQuality } from "../perf/qualityStore";
import { buildRoadMask } from "../nav/roadNavmesh";
import {
  buildProjection, buildBlockGeometry, buildSlotIndex,
  buildSlotSpatialIndex, locateContainer, findSlotByLatLng,
  computeDxfAlignment, dxfPointToScene,
} from "./geofence";
// containerGeometry kept for future use
// import { containerAtlasTexture, containerUnitBoxGeometry } from "./containerGeometry";

const TMP = {
  matrix: new THREE.Matrix4(), pos: new THREE.Vector3(), scl: new THREE.Vector3(),
  quat: new THREE.Quaternion(), euler: new THREE.Euler(), color: new THREE.Color(),
};

// ─── Procedural textures ──────────────────────────────────────────────────
// makeAsphaltTex/makeBuildingWallTex/makeWallTex are exported so PropKit.jsx
// (the yard-builder prop library, tools/PropKit.jsx) can reuse the exact same
// procedural textures for its own building/wall props instead of duplicating
// the canvas-drawing code.
export function makeAsphaltTex() {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const ctx = c.getContext("2d");
  // Daylight asphalt — warm mid-grey base
  ctx.fillStyle = "#4f5662"; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    const g = Math.floor(Math.random() * 38 + 60);
    ctx.fillStyle = `rgba(${g},${g + 2},${g + 6},0.45)`;
    ctx.fillRect(x, y, Math.random() * 2 + 0.5, Math.random() * 2 + 0.5);
  }
  // lane markings — visible white dashes
  ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 2;
  for (let y = 40; y < 512; y += 80) {
    for (let x = 0; x < 512; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 22, y); ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(50, 50);
  return tex;
}

function makeTarmacTex() {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const ctx = c.getContext("2d");
  // Daylight tarmac — cooler grey
  ctx.fillStyle = "#5d6470"; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    const g = Math.floor(Math.random() * 32 + 70);
    ctx.fillStyle = `rgba(${g},${g + 3},${g + 6},0.40)`;
    ctx.fillRect(x, y, Math.random() * 3 + 1, Math.random() * 3 + 1);
  }
  // faint yellow guide lines
  ctx.strokeStyle = "rgba(245,210,80,0.18)"; ctx.lineWidth = 1.5;
  for (let x = 0; x < 512; x += 120) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(35, 35);
  return tex;
}

function makeConcreteSlabTex() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const ctx = c.getContext("2d");
  // Daylight concrete pad — bright cement grey
  ctx.fillStyle = "#a8a89c"; ctx.fillRect(0, 0, 256, 256);
  // slab joints
  ctx.strokeStyle = "rgba(80,80,70,0.6)"; ctx.lineWidth = 1.2;
  for (let x = 0; x < 256; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
  for (let y = 0; y < 256; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
  // surface speckle
  for (let i = 0; i < 2000; i++) {
    const g = Math.floor(Math.random() * 28 + 140);
    ctx.fillStyle = `rgba(${g},${g - 2},${g - 8},0.30)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  // oil / tyre stains
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = `rgba(40,32,24,${0.10 + Math.random() * 0.10})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 7, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(8, 8);
  return tex;
}

function makeWarehouseWallTex() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256;
  const ctx = c.getContext("2d");
  // Base metal cladding colour
  ctx.fillStyle = "#c8d4de"; ctx.fillRect(0, 0, 512, 256);
  // Horizontal corrugation lines
  ctx.strokeStyle = "rgba(90,110,130,0.35)"; ctx.lineWidth = 1;
  for (let y = 0; y < 256; y += 6) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
  }
  // Darker panel seams every ~2m (map to 40px at this scale)
  ctx.strokeStyle = "rgba(60,80,100,0.5)"; ctx.lineWidth = 1.5;
  for (let x = 0; x < 512; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
  }
  // subtle gradient for depth
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "rgba(255,255,255,0.08)");
  grad.addColorStop(0.5, "rgba(0,0,0,0.0)");
  grad.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 512, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(6, 2);
  return tex;
}

function makeWarehouseRoofTex() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#7a8fa0"; ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = "rgba(50,70,90,0.4)"; ctx.lineWidth = 2;
  for (let x = 0; x < 512; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
  }
  // Skylight strips
  ctx.fillStyle = "rgba(180,210,240,0.15)";
  for (let x = 30; x < 512; x += 80) ctx.fillRect(x, 10, 18, 236);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(5, 2);
  return tex;
}

export function makeBuildingWallTex() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#b0bcc8"; ctx.fillRect(0, 0, 256, 256);
  // brick / panel rows
  ctx.strokeStyle = "rgba(80,95,110,0.4)"; ctx.lineWidth = 1;
  for (let y = 0; y < 256; y += 12) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    const offset = (Math.floor(y / 12) % 2) * 16;
    for (let x = offset; x < 256; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 12); ctx.stroke();
    }
  }
  // windows — simple blue rectangles
  ctx.fillStyle = "rgba(100,160,220,0.55)";
  for (let y = 16; y < 256; y += 36) {
    for (let x = 8; x < 256; x += 40) ctx.fillRect(x, y, 18, 14);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 3);
  return tex;
}

// Precast RCC boundary-wall panel — ribbed vertical grooves (interlocking
// precast panel joints), cement-grey with weathering streaks, matching the
// typical ICD/CFS compound wall look rather than a plain flat/brick fill.
export function makeWallTex() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#8f9498"; ctx.fillRect(0, 0, 256, 256);
  // fine cement speckle
  for (let i = 0; i < 1400; i++) {
    const g = Math.floor(Math.random() * 26 + 120);
    ctx.fillStyle = `rgba(${g},${g},${g - 3},0.22)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.2, 1.2);
  }
  // vertical precast panel joints (ribbed grooves every ~1m at this scale)
  ctx.strokeStyle = "rgba(50,54,58,0.55)"; ctx.lineWidth = 2;
  for (let x = 0; x < 256; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 2, 0); ctx.lineTo(x + 2, 256); ctx.stroke();
    ctx.strokeStyle = "rgba(50,54,58,0.55)"; ctx.lineWidth = 2;
  }
  // rain-streak weathering
  ctx.strokeStyle = "rgba(60,65,60,0.10)"; ctx.lineWidth = 3;
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * 256;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (Math.random() * 8 - 4), 256); ctx.stroke();
  }
  // cap stripe (whitewash band near top, common on ICD walls)
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(0, 0, 256, 10);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(8, 1);
  return tex;
}

// Precast RCC pillar/column — vertical support post between wall panels.
function makePillarTex() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#7a7f84"; ctx.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 400; i++) {
    const g = Math.floor(Math.random() * 22 + 108);
    ctx.fillStyle = `rgba(${g},${g},${g - 2},0.25)`;
    ctx.fillRect(Math.random() * 64, Math.random() * 256, 1.2, 1.2);
  }
  // subtle edge shading (gives the column a rounded/faceted look)
  const grad = ctx.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, "rgba(30,32,34,0.35)");
  grad.addColorStop(0.15, "rgba(0,0,0,0)");
  grad.addColorStop(0.85, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(255,255,255,0.12)");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 1);
  return tex;
}

// ─── Ground ──────────────────────────────────────────────────────────────
function Ground({ size }) {
  const asphalt = useMemo(() => makeAsphaltTex(), []);
  const tarmac  = useMemo(() => makeTarmacTex(), []);
  return (
    <group>
      {/* Outer scrubland — sandy / dusty surround as you'd see at a CFS */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.9, 0]}>
        <planeGeometry args={[size * 8, size * 8]} />
        <meshBasicMaterial color="#9c8a6a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.65, 0]} receiveShadow>
        <planeGeometry args={[size * 2.6, size * 2.6]} />
        <meshLambertMaterial map={asphalt} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[size * 1.6, size * 1.6]} />
        <meshLambertMaterial map={tarmac} />
      </mesh>
    </group>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function ringToShape(ring, ax, ay) {
  if (!ring || ring.length < 3) return null;
  const s = new THREE.Shape();
  s.moveTo(ring[0][0] - ax, ring[0][1] - ay);
  for (let i = 1; i < ring.length; i++) s.lineTo(ring[i][0] - ax, ring[i][1] - ay);
  s.lineTo(ring[0][0] - ax, ring[0][1] - ay);
  return s;
}
function polygonCentroid(ring) {
  if (!ring || ring.length < 3) return null;
  let cx = 0, cy = 0, a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]; const [x2, y2] = ring[(i + 1) % ring.length];
    const f = x1 * y2 - x2 * y1; a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
  }
  a *= 0.5;
  if (!a) return { x: ring.reduce((s, p) => s + p[0], 0) / ring.length, y: ring.reduce((s, p) => s + p[1], 0) / ring.length };
  return { x: cx / (6 * a), y: cy / (6 * a) };
}
function polygonArea(ring) {
  if (!ring || ring.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < ring.length; i++) { const [x1, y1] = ring[i]; const [x2, y2] = ring[(i + 1) % ring.length]; a += x1 * y2 - x2 * y1; }
  return Math.abs(a) / 2;
}
function ringBBox(ring) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of ring) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return { w: maxX - minX, h: maxY - minY };
}

// ─── Warehouse — detailed industrial shed ────────────────────────────────
function Warehouse({ ring, alignment }) {
  const wallTex  = useMemo(() => makeWarehouseWallTex(), []);
  const roofTex  = useMemo(() => makeWarehouseRoofTex(), []);
  const WALL_H = 14;

  const { shape, scenePos } = useMemo(() => {
    const ctr = polygonCentroid(ring); if (!ctr) return {};
    const shp = ringToShape(ring, ctr.x, ctr.y);
    const p = dxfPointToScene(ctr.x, ctr.y, alignment);
    return { shape: shp, scenePos: [p.x, -0.4, p.z] };
  }, [ring, alignment]);

  if (!shape || !scenePos) return null;

  return (
    <group position={scenePos}>
      {/* Main walls */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <extrudeGeometry args={[shape, { depth: WALL_H, bevelEnabled: false }]} />
        <meshLambertMaterial map={wallTex} color="#d0dce6" />
      </mesh>
      {/* Flat roof panel */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WALL_H - 0.02, 0]} castShadow>
        <shapeGeometry args={[shape]} />
        <meshLambertMaterial map={roofTex} color="#8a9aaa" />
      </mesh>
    </group>
  );
}

// ─── Admin / office building — multi-storey with windows ─────────────────
function OfficeBuilding({ ring, alignment, floors = 3 }) {
  const wallTex = useMemo(() => makeBuildingWallTex(), []);
  const FLOOR_H = 3.6;
  const TOTAL_H = floors * FLOOR_H;

  const { shape, scenePos } = useMemo(() => {
    const ctr = polygonCentroid(ring); if (!ctr) return {};
    const shp = ringToShape(ring, ctr.x, ctr.y);
    const p = dxfPointToScene(ctr.x, ctr.y, alignment);
    return { shape: shp, scenePos: [p.x, -0.4, p.z] };
  }, [ring, alignment]);

  if (!shape || !scenePos) return null;

  return (
    <group position={scenePos}>
      {/* Main structure */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <extrudeGeometry args={[shape, { depth: TOTAL_H, bevelEnabled: false }]} />
        <meshLambertMaterial map={wallTex} color="#bcc8d4" />
      </mesh>
      {/* Flat roof */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TOTAL_H, 0]}>
        <shapeGeometry args={[shape]} />
        <meshLambertMaterial color="#8090a0" />
      </mesh>
    </group>
  );
}

// ─── Small support structure (gate house, pump room, etc.) ────────────────
function SupportBuilding({ ring, alignment }) {
  const { shape, scenePos } = useMemo(() => {
    const ctr = polygonCentroid(ring); if (!ctr) return {};
    const shp = ringToShape(ring, ctr.x, ctr.y);
    const p = dxfPointToScene(ctr.x, ctr.y, alignment);
    return { shape: shp, scenePos: [p.x, -0.4, p.z] };
  }, [ring, alignment]);
  if (!shape || !scenePos) return null;
  return (
    <group position={scenePos}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <extrudeGeometry args={[shape, { depth: 5, bevelEnabled: false }]} />
        <meshLambertMaterial color="#8898a8" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 4.7, 0]}>
        <shapeGeometry args={[shape]} />
        <meshLambertMaterial color="#6a7a8a" />
      </mesh>
    </group>
  );
}

// Wall height shared by the panel, coping, pillars and barbed-wire posts —
// a real ICD/CFS compound wall (~5m incl. wire) rather than the old 3.8m
// plain box.
const ICD_WALL_H = 5.0;
const ICD_WALL_T = 0.6;
const ICD_PILLAR_SPACING = 3.0; // metres between RCC pillars, typical precast panel bay width
const ICD_PILLAR_W = 0.35;

function fenceSegments(fences, alignment) {
  const out = [];
  if (!fences || !alignment) return out;
  for (const ls of fences) {
    for (let i = 0; i < ls.length - 1; i++) {
      const a = dxfPointToScene(ls[i][0], ls[i][1], alignment);
      const b = dxfPointToScene(ls[i + 1][0], ls[i + 1][1], alignment);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 0.4) continue;
      out.push({ mx: (a.x + b.x) / 2, mz: (a.z + b.z) / 2, len, ang: Math.atan2(b.z - a.z, b.x - a.x) });
    }
  }
  return out;
}

// ─── Perimeter wall — precast RCC panels between pillars, ICD/CFS style ──
function PerimeterWall({ fences, alignment }) {
  const wallTex = useMemo(() => makeWallTex(), []);
  const ref = useRef();

  const segs = useMemo(() => fenceSegments(fences, alignment), [fences, alignment]);

  useLayoutEffect(() => {
    if (!ref.current || !segs.length) return;
    const { matrix, quat, pos, scl, euler } = TMP;
    segs.forEach((s, i) => {
      euler.set(0, -s.ang, 0); quat.setFromEuler(euler);
      pos.set(s.mx, ICD_WALL_H / 2, s.mz); scl.set(s.len, ICD_WALL_H, ICD_WALL_T);
      matrix.compose(pos, quat, scl); ref.current.setMatrixAt(i, matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [segs]);

  if (!segs.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, segs.length]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial map={wallTex} color="#96999c" />
    </instancedMesh>
  );
}

// RCC support pillars — placed every ~3m along each wall run, between the
// precast panels, matching real ICD/CFS compound-wall construction.
function WallPillars({ fences, alignment }) {
  const pillarTex = useMemo(() => makePillarTex(), []);
  const ref = useRef();

  const posts = useMemo(() => {
    const segs = fenceSegments(fences, alignment);
    const out = [];
    for (const s of segs) {
      const count = Math.max(1, Math.round(s.len / ICD_PILLAR_SPACING));
      const cos = Math.cos(s.ang), sin = Math.sin(s.ang);
      const startX = s.mx - (cos * s.len) / 2, startZ = s.mz - (sin * s.len) / 2;
      for (let k = 0; k <= count; k++) {
        const t = (k / count) * s.len;
        out.push({ x: startX + cos * t, z: startZ + sin * t });
      }
    }
    return out;
  }, [fences, alignment]);

  useLayoutEffect(() => {
    if (!ref.current || !posts.length) return;
    const { matrix, pos, scl } = TMP;
    const PILLAR_H = ICD_WALL_H + 0.3;
    posts.forEach((p, i) => {
      pos.set(p.x, PILLAR_H / 2, p.z); scl.set(ICD_PILLAR_W, PILLAR_H, ICD_PILLAR_W);
      matrix.compose(pos, TMP.quat.identity(), scl); ref.current.setMatrixAt(i, matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [posts]);

  if (!posts.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, posts.length]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial map={pillarTex} color="#a5a8ab" />
    </instancedMesh>
  );
}

// Wall coping (cap) — lighter colour strip along top edge
function WallCoping({ fences, alignment }) {
  const ref = useRef();
  const segs = useMemo(() => fenceSegments(fences, alignment), [fences, alignment]);

  useLayoutEffect(() => {
    if (!ref.current || !segs.length) return;
    const { matrix, quat, pos, scl, euler } = TMP;
    segs.forEach((s, i) => {
      euler.set(0, -s.ang, 0); quat.setFromEuler(euler);
      pos.set(s.mx, ICD_WALL_H + 0.2, s.mz); scl.set(s.len, 0.4, 0.9);
      matrix.compose(pos, quat, scl); ref.current.setMatrixAt(i, matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [segs]);

  if (!segs.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, segs.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial color="#8090a0" />
    </instancedMesh>
  );
}

// A single coil (loop) of a concertina/razor-wire helix, running along the
// local X axis — used as the path for a TubeGeometry so the wire actually
// reads as a round coil, not a straight strand.
class ConcertinaCurve extends THREE.Curve {
  constructor(length, coilRadius, pitch) {
    super();
    this.length = length;
    this.coilRadius = coilRadius;
    this.pitch = pitch; // metres of X-travel per full turn
  }
  getPoint(t, target = new THREE.Vector3()) {
    const turns = this.length / this.pitch;
    const angle = t * turns * Math.PI * 2;
    const x = t * this.length;
    const y = Math.sin(angle) * this.coilRadius;
    const z = Math.cos(angle) * this.coilRadius;
    return target.set(x, y, z);
  }
}

// Security concertina/razor wire coil — raised on angled arm posts above
// the coping, the standard ICD/CFS perimeter security topper. Rendered as
// an actual helical tube (round coil), not straight strands.
function BarbedWire({ fences, alignment }) {
  const armRef = useRef();
  const COIL_RADIUS = 0.35, COIL_PITCH = 0.55;
  const ARM_LEN = 0.9, ARM_ANGLE = Math.PI / 5; // taller arm, still angled outward
  const baseY = ICD_WALL_H + 0.4;
  const coilY = baseY + ARM_LEN * 0.75; // coil rides most of the way up the arm

  const segs = useMemo(() => fenceSegments(fences, alignment), [fences, alignment]);

  const armPosts = useMemo(() => {
    const ARM_SPACING = 4.0;
    const out = [];
    for (const s of segs) {
      const count = Math.max(1, Math.round(s.len / ARM_SPACING));
      const cos = Math.cos(s.ang), sin = Math.sin(s.ang);
      const nx = sin, nz = -cos; // outward normal
      const startX = s.mx - (cos * s.len) / 2, startZ = s.mz - (sin * s.len) / 2;
      for (let k = 0; k <= count; k++) {
        const t = (k / count) * s.len;
        const bx = startX + cos * t, bz = startZ + sin * t;
        const tipX = bx + nx * Math.sin(ARM_ANGLE) * ARM_LEN;
        const tipZ = bz + nz * Math.sin(ARM_ANGLE) * ARM_LEN;
        const tipY = baseY + Math.cos(ARM_ANGLE) * ARM_LEN;
        out.push({ x: (bx + tipX) / 2, y: (baseY + tipY) / 2, z: (bz + tipZ) / 2, ang: s.ang, tiltAng: ARM_ANGLE });
      }
    }
    return out;
  }, [segs]);

  // One TubeGeometry coil per fence run, positioned along its own local
  // frame (rotated/translated via the enclosing <group>) so a single curve
  // covers the whole run's length instead of one mesh per pitch-turn.
  const coils = useMemo(() => segs.map((s) => {
    const curve = new ConcertinaCurve(s.len, COIL_RADIUS, COIL_PITCH);
    const turns = Math.max(1, Math.round(s.len / COIL_PITCH));
    const tubularSegments = Math.max(16, turns * 10);
    const geo = new THREE.TubeGeometry(curve, tubularSegments, 0.045, 6, false);
    return { geo, s };
  }), [segs]);

  useLayoutEffect(() => {
    if (!armRef.current || !armPosts.length) return;
    const { matrix, quat, pos, scl, euler } = TMP;
    armPosts.forEach((a, i) => {
      euler.set(0, -a.ang, a.tiltAng); quat.setFromEuler(euler);
      pos.set(a.x, a.y, a.z); scl.set(0.06, ARM_LEN, 0.06);
      matrix.compose(pos, quat, scl); armRef.current.setMatrixAt(i, matrix);
    });
    armRef.current.instanceMatrix.needsUpdate = true;
    armRef.current.computeBoundingSphere();
  }, [armPosts]);

  if (!armPosts.length) return null;
  return (
    <>
      <instancedMesh ref={armRef} args={[undefined, undefined, armPosts.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="#3a3f45" />
      </instancedMesh>
      {coils.map(({ geo, s }, i) => {
        const cos = Math.cos(s.ang), sin = Math.sin(s.ang);
        const startX = s.mx - (cos * s.len) / 2, startZ = s.mz - (sin * s.len) / 2;
        return (
          <mesh key={i} geometry={geo} position={[startX, coilY, startZ]} rotation={[0, -s.ang, 0]}>
            <meshStandardMaterial color="#b8bcc0" metalness={0.75} roughness={0.35} />
          </mesh>
        );
      })}
    </>
  );
}

// ─── Trees ────────────────────────────────────────────────────────────────
function DxfTrees({ trees, alignment }) {
  const fRef = useRef(), tRef = useRef();
  const subset = useMemo(() => (trees || []).filter((_, i) => i % 2 === 0), [trees]);
  useLayoutEffect(() => {
    if (!fRef.current || !tRef.current || !subset.length) return;
    const m = new THREE.Matrix4();
    subset.forEach((t, i) => {
      const p = dxfPointToScene(t.cx, t.cy, alignment);
      m.makeTranslation(p.x, 3.2, p.z); fRef.current.setMatrixAt(i, m);
      m.makeTranslation(p.x, 1.0, p.z); tRef.current.setMatrixAt(i, m);
    });
    fRef.current.instanceMatrix.needsUpdate = true;
    tRef.current.instanceMatrix.needsUpdate = true;
  }, [subset, alignment]);
  if (!subset.length) return null;
  return (
    <>
      <instancedMesh ref={fRef} args={[undefined, undefined, subset.length]}>
        <sphereGeometry args={[2.2, 7, 6]} />
        <meshLambertMaterial color="#1a6b3a" />
      </instancedMesh>
      <instancedMesh ref={tRef} args={[undefined, undefined, subset.length]}>
        <cylinderGeometry args={[0.22, 0.38, 2.0, 6]} />
        <meshLambertMaterial color="#3d1f08" />
      </instancedMesh>
    </>
  );
}

// ─── DXF blueprint trace ──────────────────────────────────────────────────
function DxfBlueprint({ lines, alignment }) {
  const geom = useMemo(() => {
    const pts = [];
    if (!lines) return new THREE.BufferGeometry();
    for (const ls of lines) {
      for (let i = 0; i < ls.length - 1; i++) {
        const a = dxfPointToScene(ls[i][0], ls[i][1], alignment);
        const b = dxfPointToScene(ls[i + 1][0], ls[i + 1][1], alignment);
        pts.push(new THREE.Vector3(a.x, -0.48, a.z), new THREE.Vector3(b.x, -0.48, b.z));
      }
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [lines, alignment]);
  return (
    <lineSegments geometry={geom} renderOrder={1}>
      <lineBasicMaterial color="#94a3b8" opacity={0.1} transparent depthWrite={false} />
    </lineSegments>
  );
}

// ─── Block pads + outlines — built from the REAL slot polygons ────────────
// Each block's footprint is the union of its actual DB slot polygons, not a
// convex hull (a hull over-covered the true area by up to ~2.7×, bridging
// aisles and angled rows). We fill every slot quad and trace every slot
// border, so the rendered yard matches the database layout exactly.
function BlockPadsAndOutlines({ geofence, projection, onPick }) {
  const slabTex = useMemo(() => makeConcreteSlabTex(), []);

  const { padMeshes, outlineGeom } = useMemo(() => {
    const Y_PAD  = 0.08;
    const Y_LINE = 0.22;
    const outPts = [];

    // Group slots by block so each block stays a single clickable mesh.
    const byBlock = new Map();
    for (const s of geofence.slots) {
      if (!s.polygon || s.polygon.length < 3) continue;
      if (!byBlock.has(s.block)) byBlock.set(s.block, []);
      byBlock.get(s.block).push(s);
    }

    const padMeshes = Array.from(byBlock.entries()).map(([id, slots]) => {
      const verts = [];
      for (const s of slots) {
        // Project to scene XZ, dropping the closing repeat vertex if present.
        const ring = s.polygon.map(([la, lo]) => projection.toXZ(la, lo));
        const last = ring[ring.length - 1];
        if (last && Math.abs(last.x - ring[0].x) < 1e-9 && Math.abs(last.z - ring[0].z) < 1e-9) ring.pop();
        if (ring.length < 3) continue;

        // Outline: trace each slot edge in yellow.
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], b = ring[(i + 1) % ring.length];
          outPts.push(new THREE.Vector3(a.x, Y_LINE, a.z), new THREE.Vector3(b.x, Y_LINE, b.z));
        }

        // Pad: fan-triangulate the (convex) slot quad in world XZ at Y_PAD.
        for (let i = 1; i < ring.length - 1; i++) {
          const a = ring[0], b = ring[i], c = ring[i + 1];
          verts.push(a.x, Y_PAD, a.z,  b.x, Y_PAD, b.z,  c.x, Y_PAD, c.z);
        }
      }
      if (!verts.length) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.computeVertexNormals();
      return { id, geo };
    }).filter(Boolean);

    const outlineGeom = new THREE.BufferGeometry().setFromPoints(outPts);
    return { padMeshes, outlineGeom };
  }, [geofence, projection]);

  return (
    <>
      <group>
        {padMeshes.map(({ id, geo }) => (
          <mesh key={`pad-${id}`} geometry={geo} receiveShadow
            onClick={(e) => { e.stopPropagation(); onPick && onPick(id); }}>
            <meshLambertMaterial map={slabTex} color="#4a5866" side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <lineSegments geometry={outlineGeom} renderOrder={6}>
        <lineBasicMaterial color="#94a3b8" opacity={0.55} transparent depthWrite={false} />
      </lineSegments>
    </>
  );
}

// ─── Graham scan convex hull for XZ points ────────────────────────────────
function convexHullXZ(inPts) {
  // deduplicate first so near-identical points don't confuse the sort
  const seen = new Set(); const pts = [];
  for (const p of inPts) { const k = `${p[0].toFixed(3)},${p[1].toFixed(3)}`; if (!seen.has(k)) { seen.add(k); pts.push(p); } }
  if (pts.length < 3) return pts;
  let pivot = pts.reduce((a, b) => (b[1] < a[1] || (b[1] === a[1] && b[0] < a[0])) ? b : a);
  const cross = (O, A, B) => (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
  const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  const sorted = pts
    .filter(p => p !== pivot)
    .sort((a, b) => {
      const ax = Math.atan2(a[1] - pivot[1], a[0] - pivot[0]);
      const bx = Math.atan2(b[1] - pivot[1], b[0] - pivot[0]);
      if (ax !== bx) return ax - bx;
      return dist2(pivot, a) - dist2(pivot, b);
    });
  const hull = [pivot];
  for (const p of sorted) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop();
    hull.push(p);
  }
  return hull;
}

// ─── Yard hull wall — solid 3D wall tracing actual slot outer boundary ────
function YardHullWall({ slots, projection }) {
  const wallTex = useMemo(() => makeWallTex(), []);
  const copingRef = useRef();
  const wallRef   = useRef();
  const glowRef   = useRef();
  const WALL_H = 4.2, WALL_T = 0.65;

  const segs = useMemo(() => {
    if (!slots?.length || !projection) return [];
    // Gather all slot polygon corners in XZ
    const allPts = [];
    for (const s of slots) {
      for (const [la, lo] of s.polygon) {
        const { x, z } = projection.toXZ(la, lo);
        allPts.push([x, z]);
      }
    }
    const hull = convexHullXZ(allPts);
    if (hull.length < 3) return [];
    const out = [];
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i], b = hull[(i + 1) % hull.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.5) continue;
      out.push({
        mx: (a[0] + b[0]) / 2, mz: (a[1] + b[1]) / 2,
        len, ang: Math.atan2(b[1] - a[1], b[0] - a[0]),
      });
    }
    return out;
  }, [slots, projection]);

  const glowPts = useMemo(() => {
    if (!slots?.length || !projection) return new THREE.BufferGeometry();
    const allPts = [];
    for (const s of slots) {
      for (const [la, lo] of s.polygon) {
        const { x, z } = projection.toXZ(la, lo);
        allPts.push([x, z]);
      }
    }
    const hull = convexHullXZ(allPts);
    if (hull.length < 3) return new THREE.BufferGeometry();
    const pts3 = [];
    for (let i = 0; i <= hull.length; i++) {
      const p = hull[i % hull.length];
      pts3.push(new THREE.Vector3(p[0], WALL_H + 0.25, p[1]));
    }
    return new THREE.BufferGeometry().setFromPoints(pts3);
  }, [slots, projection]);

  useLayoutEffect(() => {
    if (!segs.length) return;
    const { matrix, quat, pos, scl, euler } = TMP;
    if (wallRef.current) {
      segs.forEach((s, i) => {
        euler.set(0, -s.ang, 0); quat.setFromEuler(euler);
        pos.set(s.mx, WALL_H / 2 - 0.45, s.mz); scl.set(s.len, WALL_H, WALL_T);
        matrix.compose(pos, quat, scl); wallRef.current.setMatrixAt(i, matrix);
      });
      wallRef.current.instanceMatrix.needsUpdate = true;
      wallRef.current.computeBoundingSphere();
    }
    if (copingRef.current) {
      segs.forEach((s, i) => {
        euler.set(0, -s.ang, 0); quat.setFromEuler(euler);
        pos.set(s.mx, WALL_H - 0.45 + 0.22, s.mz); scl.set(s.len, 0.44, WALL_T + 0.15);
        matrix.compose(pos, quat, scl); copingRef.current.setMatrixAt(i, matrix);
      });
      copingRef.current.instanceMatrix.needsUpdate = true;
      copingRef.current.computeBoundingSphere();
    }
  }, [segs]);

  if (!segs.length) return null;
  return (
    <group>
      {/* Solid wall body */}
      <instancedMesh ref={wallRef} args={[undefined, undefined, segs.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial map={wallTex} color="#4a5a6e" />
      </instancedMesh>
      {/* Lighter coping cap */}
      <instancedMesh ref={copingRef} args={[undefined, undefined, segs.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="#8898aa" />
      </instancedMesh>
      {/* Top-of-wall accent line — subtle white in daylight */}
      <line geometry={glowPts} renderOrder={8}>
        <lineBasicMaterial color="#f8fafc" opacity={0.45} transparent depthWrite={false} />
      </line>
    </group>
  );
}

// ─── Block name labels — canvas sprites ───────────────────────────────────
function makeNameTex(text) {
  const fs = 80, pad = 26;
  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d");
  ctx.font = `900 ${fs}px 'Segoe UI',Arial,sans-serif`;
  const tw = ctx.measureText(text).width;
  cv.width = Math.ceil(tw + pad * 2); cv.height = Math.ceil(fs + pad * 2);
  // pill background
  ctx.fillStyle = "rgba(8,18,34,0.82)";
  if (ctx.roundRect) ctx.roundRect(0, 0, cv.width, cv.height, cv.height / 2);
  else ctx.rect(0, 0, cv.width, cv.height);
  ctx.fill();
  // white border
  ctx.strokeStyle = "rgba(96,165,250,0.6)"; ctx.lineWidth = 3;
  if (ctx.roundRect) ctx.roundRect(1.5, 1.5, cv.width - 3, cv.height - 3, cv.height / 2);
  else ctx.rect(1.5, 1.5, cv.width - 3, cv.height - 3);
  ctx.stroke();
  ctx.font = `900 ${fs}px 'Segoe UI',Arial,sans-serif`;
  ctx.fillStyle = "#93c5fd"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, cv.width / 2, cv.height / 2);
  const tex = new THREE.CanvasTexture(cv); tex.needsUpdate = true;
  return { tex, aspect: cv.width / cv.height };
}

function BlockLabel({ text, position }) {
  const { tex, aspect } = useMemo(() => makeNameTex(text), [text]);
  const h = 7, w = h * aspect;
  return (
    <sprite position={position} scale={[w, h, 1]}>
      <spriteMaterial map={tex} transparent depthTest={false} />
    </sprite>
  );
}

function BlockLabels({ blocks, visible }) {
  if (!visible) return null;
  return (
    <>
      {Object.values(blocks).map(b => (
        <BlockLabel key={b.id} text={b.id} position={[b.cx, 16, b.cz]} />
      ))}
    </>
  );
}

// ─── Container corrugated steel normal map ────────────────────────────────
// Tangent-space normal map encoding the vertical rib profile of a real
// shipping container side panel. Repeated across U so ribs run top-to-bottom
// on the four vertical faces — gives the boxes genuine sheet-steel relief
// under the directional sun instead of reading as flat painted cubes.
function makeContainerNormalTex() {
  const w = 256, h = 8;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(w, h);
  const ribs = 18; // corrugations across one U tile
  for (let x = 0; x < w; x++) {
    const phase = (x / w) * ribs * Math.PI * 2;
    const nx = Math.cos(phase);                 // slope of the rib wave
    const r = Math.round(128 + nx * 105);       // tangent-space X
    const g = 128;                              // flat along V
    const b = Math.round(255 - Math.abs(nx) * 36);
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(11, 1);
  t.colorSpace = THREE.NoColorSpace; // normal data is linear, never sRGB
  t.anisotropy = 4;
  return t;
}
const _containerNormalTex = makeContainerNormalTex();

// ─── Single container box ─────────────────────────────────────────────────
// One <mesh> per container — simple, zero timing issues, guaranteed colour.
// Shared unit-box geometry — one allocation, reused by all ContainerBox instances
const _boxGeo = new THREE.BoxGeometry(1, 1, 1);

function ContainerBox({ it, isSelected, isHighlighted, onSelect, onHover }) {
  const [hovered, setHovered] = React.useState(false);
  const meshRef = React.useRef();
  const matRef  = React.useRef();
  const t = React.useRef(0);

  // Tier-based brightness: tier 1 = full color, each tier above gets slightly
  // lighter so stacked containers are visually distinct from each other.
  const tierBright = 1 + (it.tier - 1) * 0.18;
  const baseColor = useMemo(() => {
    // Every container shows its real livery colour; non-matches during a
    // search are dimmed (not greyed out) so highlights still stand out.
    const c = new THREE.Color(it.color);
    c.multiplyScalar(Math.min(tierBright, 1.6));
    if (!isHighlighted) c.multiplyScalar(0.5);
    return c;
  }, [isHighlighted, it.color, tierBright]);

  // Imperatively drive material — avoids React prop diffing / material recreation flicker
  useFrame(() => {
    const mat = matRef.current;
    if (!mat) return;
    if (isSelected) {
      mat.color.set("#fff176");
      mat.emissive.set("#ffff00");
      mat.emissiveIntensity = 0.5;
      mat.roughness = 0.2;
      mat.metalness = 0.4;
    } else if (hovered) {
      mat.color.set("#FFEB3B");
      mat.emissive.set("#ff9900");
      mat.emissiveIntensity = 0.3;
      mat.roughness = 0.50;
      mat.metalness = 0.10;
    } else {
      mat.color.set(baseColor);
      mat.emissive.set("#000000");
      mat.emissiveIntensity = 0;
      mat.roughness = 0.58;
      mat.metalness = 0.10;
    }
  });

  // Pulse scale when selected; snap back instantly on deselect
  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (isSelected) {
      t.current += delta * 3;
      const pulse = 1 + Math.sin(t.current) * 0.05;
      mesh.scale.set(it.w * pulse, it.h * 1.08, it.d * pulse);
    } else {
      t.current = 0;
      mesh.scale.set(it.w, it.h, it.d);
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={_boxGeo}
      castShadow
      receiveShadow
      position={[it.x, it.y + (isSelected ? 0.15 : 0), it.z]}
      scale={[it.w, it.h, it.d]}
      rotation={[0, it.rotY || 0, 0]}
      onClick={(e) => { e.stopPropagation(); onSelect(it.container); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true);  onHover && onHover(it); }}
      onPointerOut={(e)  => { e.stopPropagation(); setHovered(false); onHover && onHover(null); }}
    >
      <meshStandardMaterial
        ref={matRef}
        color={baseColor}
        roughness={0.52}
        metalness={0.18}
        normalMap={_containerNormalTex}
        normalScale={[0.4, 0.4]}
      />
    </mesh>
  );
}

// ─── Floating pin + label above selected container ─────────────────────────
function SelectedPin({ item }) {
  const pinTop = item.y + item.h / 2 + 2;
  const labelY = pinTop + 3.5;

  const { tex, aspect } = React.useMemo(() => {
    const no = item.container?.containerNo ?? "";
    const loc = item.container?.block ? `${item.container.block} · R${item.container.row} C${item.container.col} T${item.container.tier}` : "";
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = "rgba(10,18,40,0.92)";
    ctx.roundRect ? ctx.roundRect(0, 0, 512, 128, 16) : ctx.fillRect(0, 0, 512, 128);
    ctx.fill();
    ctx.strokeStyle = "#facc15"; ctx.lineWidth = 4;
    ctx.roundRect ? ctx.roundRect(2, 2, 508, 124, 14) : ctx.strokeRect(2, 2, 508, 124);
    ctx.stroke();
    ctx.fillStyle = "#facc15"; ctx.font = "bold 56px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(no || "—", 256, 50);
    ctx.fillStyle = "#94a3b8"; ctx.font = "28px sans-serif";
    ctx.fillText(loc, 256, 96);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return { tex: texture, aspect: 512 / 128 };
  }, [item]);

  return (
    <group position={[item.x, 0, item.z]}>
      {/* Vertical stem */}
      <mesh position={[0, pinTop / 2, 0]}>
        <cylinderGeometry args={[0.12, 0.12, pinTop, 6]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.9} />
      </mesh>
      {/* Pin sphere */}
      <mesh position={[0, pinTop, 0]}>
        <sphereGeometry args={[0.6, 12, 12]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={1.2} />
      </mesh>
      {/* Label sprite */}
      <sprite position={[0, labelY, 0]} scale={[aspect * 4, 4, 1]}>
        <spriteMaterial map={tex} transparent depthTest={false} />
      </sprite>
    </group>
  );
}

// ─── Camera focuser — smoothly moves to selected container ─────────────────
function CameraFocuser({ item, controlsRef }) {
  const { camera } = useThree();
  const animating = React.useRef(false);
  const targetPos = React.useRef(null);
  const targetLook = React.useRef(null);

  React.useEffect(() => {
    if (!item) return;
    const tx = item.x, tz = item.z;
    const dist = 40;
    targetPos.current  = new THREE.Vector3(tx, dist * 0.8, tz + dist * 0.6);
    targetLook.current = new THREE.Vector3(tx, item.y, tz);
    animating.current  = true;
  }, [item]);

  useFrame(() => {
    if (!animating.current || !targetPos.current || !targetLook.current) return;
    const lerpFactor = 0.07;
    camera.position.lerp(targetPos.current, lerpFactor);
    if (controlsRef?.current) {
      controlsRef.current.target.lerp(targetLook.current, lerpFactor);
      controlsRef.current.update();
    }
    if (camera.position.distanceTo(targetPos.current) < 0.5) animating.current = false;
  });

  return null;
}

// ─── Containers ───────────────────────────────────────────────────────────
function Containers({ items, selectedId, highlightedIds, onSelect, onHover }) {
  if (!items.length) return null;
  return (
    <group>
      {items.map((it) => (
        <ContainerBox
          key={it.id}
          it={it}
          isSelected={it.id === selectedId}
          isHighlighted={highlightedIds ? highlightedIds.has(it.id) : true}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </group>
  );
}

// ─── Keyboard controls ─────────────────────────────────────────────────────
function KeyboardCameraControls({ controlsRef }) {
  const keysRef = useRef({});
  const { camera } = useThree();
  useEffect(() => {
    const onDown = (e) => { keysRef.current[e.code] = true; };
    const onUp   = (e) => { keysRef.current[e.code] = false; };
    window.addEventListener("keydown", onDown); window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);
  useFrame((_, dt) => {
    const ctrl = controlsRef?.current; if (!ctrl) return;
    const keys = keysRef.current;
    const panSpeed = camera.position.y * 0.9 * dt;
    const zoomStep = camera.position.distanceTo(ctrl.target) * 0.8 * dt;
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    let moved = false;
    if (keys["ArrowUp"]    || keys["KeyW"]) { camera.position.addScaledVector(fwd,   panSpeed);  ctrl.target.addScaledVector(fwd,   panSpeed);  moved = true; }
    if (keys["ArrowDown"]  || keys["KeyS"]) { camera.position.addScaledVector(fwd,  -panSpeed);  ctrl.target.addScaledVector(fwd,  -panSpeed);  moved = true; }
    if (keys["ArrowLeft"]  || keys["KeyA"]) { camera.position.addScaledVector(right, -panSpeed); ctrl.target.addScaledVector(right, -panSpeed); moved = true; }
    if (keys["ArrowRight"] || keys["KeyD"]) { camera.position.addScaledVector(right,  panSpeed); ctrl.target.addScaledVector(right,  panSpeed); moved = true; }
    if (keys["Equal"] || keys["NumpadAdd"]) { const d = new THREE.Vector3().subVectors(ctrl.target, camera.position).normalize(); camera.position.addScaledVector(d,  zoomStep); moved = true; }
    if (keys["Minus"] || keys["NumpadSubtract"]) { const d = new THREE.Vector3().subVectors(ctrl.target, camera.position).normalize(); camera.position.addScaledVector(d, -zoomStep); moved = true; }
    if (moved) ctrl.update();
  });
  return null;
}

// ─── Live Me Avatar ────────────────────────────────────────────────────────
function LiveMeAvatar3D({ gpsPos, projection }) {
  const groupRef = useRef();
  const ringRef  = useRef();
  const t = useRef(0);

  const scenePos = useMemo(() => {
    if (!gpsPos || !projection) return null;
    // Clamp to yard half-extents so the avatar stays inside the scene even when GPS drifts.
    const raw = projection.toXZ(gpsPos.lat, gpsPos.lng);
    const hw = projection.yardW / 2, hd = projection.yardD / 2;
    return {
      x: Math.max(-hw, Math.min(hw, raw.x)),
      z: Math.max(-hd, Math.min(hd, raw.z)),
    };
  }, [gpsPos, projection]);

  useFrame((_, delta) => {
    t.current += delta;
    if (groupRef.current) groupRef.current.position.y = 1.0 + Math.sin(t.current * 2.2) * 0.18;
    if (ringRef.current) {
      const s = 1 + Math.sin(t.current * 2.5) * 0.22;
      ringRef.current.scale.set(s, 1, s);
      ringRef.current.material.opacity = 0.55 - Math.sin(t.current * 2.5) * 0.25;
    }
  });

  if (!scenePos) return null;
  const { x, z } = scenePos;

  return (
    <group position={[x, 0, z]}>
      {/* Pulsing ground ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.85, 0]}>
        <ringGeometry args={[1.6, 2.2, 32]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Glow disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.88, 0]}>
        <circleGeometry args={[1.4, 32]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      {/* Avatar */}
      <group ref={groupRef} position={[0, 1.0, 0]}>
        <mesh position={[-0.28, -1.05, 0]}><cylinderGeometry args={[0.18, 0.14, 1.0, 8]} /><meshLambertMaterial color="#1d4ed8" /></mesh>
        <mesh position={[0.28, -1.05, 0]}><cylinderGeometry args={[0.18, 0.14, 1.0, 8]} /><meshLambertMaterial color="#1d4ed8" /></mesh>
        <mesh position={[0, -0.1, 0]}><cylinderGeometry args={[0.38, 0.32, 1.1, 10]} /><meshLambertMaterial color="#3b82f6" /></mesh>
        <mesh position={[-0.62, -0.05, 0]} rotation={[0, 0, Math.PI / 5]}><cylinderGeometry args={[0.12, 0.09, 0.85, 7]} /><meshLambertMaterial color="#2563eb" /></mesh>
        <mesh position={[0.62, -0.05, 0]} rotation={[0, 0, -Math.PI / 5]}><cylinderGeometry args={[0.12, 0.09, 0.85, 7]} /><meshLambertMaterial color="#2563eb" /></mesh>
        <mesh position={[0, 0.58, 0]}><cylinderGeometry args={[0.14, 0.16, 0.22, 8]} /><meshLambertMaterial color="#fbbf24" /></mesh>
        <mesh position={[0, 0.88, 0]}><sphereGeometry args={[0.38, 12, 12]} /><meshLambertMaterial color="#fbbf24" /></mesh>
        {/* Hard hat */}
        <mesh position={[0, 1.18, 0]}><cylinderGeometry args={[0.46, 0.42, 0.2, 10]} /><meshLambertMaterial color="#22d3ee" /></mesh>
        <mesh position={[0, 1.3, 0]}><sphereGeometry args={[0.28, 10, 6]} /><meshLambertMaterial color="#22d3ee" /></mesh>
      </group>
    </group>
  );
}

// ─── Static shadow baker ────────────────────────────────────────────────────
// The yard is geometrically static (containers don't move frame-to-frame), so
// re-rendering the sun's shadow map every frame is pure waste. We render it for
// a few frames after any structural change (new inventory, quality switch) then
// freeze it — crisp baked sun shadows at effectively zero ongoing GPU cost.
function StaticShadowBaker({ enabled, signature }) {
  const { gl } = useThree();
  const framesLeft = useRef(0);

  useEffect(() => {
    if (!gl) return;
    gl.shadowMap.autoUpdate = false;
    if (enabled) {
      framesLeft.current = 4;          // bake over a few frames so it settles
      gl.shadowMap.needsUpdate = true;
    } else {
      gl.shadowMap.needsUpdate = false;
    }
  }, [gl, enabled, signature]);

  useFrame(() => {
    if (!enabled || framesLeft.current <= 0) return;
    gl.shadowMap.needsUpdate = true;
    framesLeft.current -= 1;
  });

  return null;
}

// ─── Main export ───────────────────────────────────────────────────────────
export default function YardScene({
  geofence, dxfLayout, containers, selectedId, highlightedIds,
  onSelect, onHover, onPickBlock, filterStatus, maxTier, getColor,
  liveEquipment, selectedEquipmentId, onSelectEquipment,
  followEquipmentId, followEquipmentMode, lowPerfMode,
  myGpsPos, showBlockLabels,
  // Direction navigation props
  directionMode, directionTargetId, directionStartPos, directionWalking, onDirectionArrived,
  // Road painter props (controlled from parent)
  roadPainterActive, roadPoints, onAddRoadPoint,
  // Road network for snap-to-road (scene-space segments)
  roadSegments,
  // Yard Builder props (controlled from parent)
  yardBuilderMode, yardBuilderWalls, yardBuilderBuildings,
  yardBuilderDrawPoints, onYardBuilderAddDrawPoint,
  yardBuilderDragStart, yardBuilderDragCurrent,
  onYardBuilderDragStart, onYardBuilderDragMove, onYardBuilderDragEnd,
  yardBuilderSelection, onYardBuilderSelect,
  onSceneGeometryReady,
  // Optional extra content rendered inside this Canvas, after everything
  // else — lets a caller (e.g. YardBuilderPage) mount R3F layers such as
  // WallEditor/PropsEditor that need to share this Canvas's camera/raycaster
  // instead of standing up a second <Canvas>. Purely additive: omitting it
  // changes nothing about the existing scene.
  children,
  // Optional live rotation/offset override for aligning slots/geofence to the
  // DXF drawing — omit to use the YARD_ROTATION_DEG/YARD_OFFSET_X/Z defaults
  // baked into buildProjection(). Passed explicitly by YardBuilderPage's
  // rotation + move tools. offsetX/offsetZ are metres, applied after rotation.
  rotationDeg,
  offsetX,
  offsetZ,
  // Optional — makes baked yard-builder props (dxfLayout.props) clickable,
  // so YardBuilderPage can offer "remove this baked prop" without needing
  // them to be re-drawn through PropsEditor's session-only edit layer.
  onPickBakedProp,
}) {
  const hoveredRef   = useRef(null);
  const controlsRef  = useRef(null);

  const projection = useMemo(() => {
    const args = [geofence.bounds];
    if (rotationDeg != null) {
      args.push(rotationDeg, offsetX ?? 0, offsetZ ?? 0);
    }
    return buildProjection(...args);
  }, [geofence.bounds, rotationDeg, offsetX, offsetZ]);
  const blocks     = useMemo(() => buildBlockGeometry(geofence, projection), [geofence, projection]);
  const slotIndex  = useMemo(() => buildSlotIndex(geofence), [geofence]);
  const spatial    = useMemo(() => buildSlotSpatialIndex(geofence.slots, projection, 4), [geofence.slots, projection]);
  const alignment  = useMemo(() => computeDxfAlignment(dxfLayout, geofence, projection), [dxfLayout, geofence, projection]);

  // DXF ROAD layer → walkable mask in scene XZ. When empty, A* falls back
  // to plain block-avoidance pathfinding (the prior behaviour).
  const roadMask = useMemo(() => {
    const rings = dxfLayout?.roads;
    if (!rings?.length || !alignment) return null;
    const projected = rings.map(r =>
      r.map(([x, y]) => {
        const p = dxfPointToScene(x, y, alignment);
        return [p.x, p.z];
      })
    );
    return buildRoadMask(projected, { cell: 4 });
  }, [dxfLayout?.roads, alignment]);

  const sceneFeatures = useMemo(() => {
    if (!dxfLayout || !alignment) return { warehouses: [], buildings: [], fences: [], trees: [], lines: [] };
    const yardRadius = Math.max(projection.yardW, projection.yardD);
    const cutoff = yardRadius * 1.4;
    const inRange = (cx, cy) => { const p = dxfPointToScene(cx, cy, alignment); return Math.hypot(p.x, p.z) <= cutoff; };
    const filterRings = (rings) => (rings || []).filter(r => { const c = polygonCentroid(r); return c && inRange(c.x, c.y); });

    const warehouses = filterRings(dxfLayout.warehouses)
      .map(r => ({ r, a: polygonArea(r) })).filter(x => x.a >= 100)
      .sort((a, b) => b.a - a.a).map(x => x.r);

    const buildings = filterRings(dxfLayout.buildings)
      .map(r => ({ r, a: polygonArea(r) })).filter(x => x.a >= 30)
      .sort((a, b) => b.a - a.a).map(x => x.r);

    const fences = (dxfLayout.fences || []).filter(ls => { for (const [x, y] of ls) if (inRange(x, y)) return true; return false; });
    const trees  = (dxfLayout.trees  || []).filter(t => inRange(t.cx, t.cy));

    return { warehouses, buildings, fences, trees, lines: dxfLayout.lines || [] };
  }, [dxfLayout, alignment, projection]);

  // Fences/buildings converted into actual scene XZ (via the same alignment
  // transform used to render them) so the Yard Builder tool — which works
  // directly in scene coordinates, like Road Painter — can seed its editable
  // state with what's already on screen instead of starting blank.
  const sceneGeometry = useMemo(() => {
    if (!alignment) return null;
    const fences = sceneFeatures.fences.map(ls => ls.map(([x, y]) => { const p = dxfPointToScene(x, y, alignment); return [p.x, p.z]; }));
    const buildings = sceneFeatures.buildings.map(ring => ring.map(([x, y]) => { const p = dxfPointToScene(x, y, alignment); return [p.x, p.z]; }));
    return { fences, buildings };
  }, [sceneFeatures, alignment]);

  useEffect(() => {
    if (sceneGeometry && onSceneGeometryReady) onSceneGeometryReady(sceneGeometry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneGeometry]);

  const items = useMemo(() => {
    const out = [];
    if (!containers?.length) return out;

    // --- OBB slot geometry --------------------------------------------------
    // Returns oriented bounding box for a slot polygon:
    //   cx, cz  — centroid in scene XZ
    //   lenEdge — length of the LONG edge (bay / container-length axis)
    //   widEdge — length of the SHORT edge (row / container-width axis)
    //   rotY    — Y-rotation so that mesh X-axis aligns with the LONG edge
    //
    // Strategy: project every edge onto the polygon, pick the two unique edge
    // lengths, then set rotY from the longer edge direction.
    const slotOBB = (slot) => {
      if (!slot?.polygon?.length) return null;
      // Convert polygon to scene XZ, drop the closing repeat
      const raw = slot.polygon.map(([la, lo]) => projection.toXZ(la, lo));
      const pts = raw[raw.length - 1] &&
        raw[0].x === raw[raw.length - 1].x && raw[0].z === raw[raw.length - 1].z
        ? raw.slice(0, -1) : raw;
      if (pts.length < 3) return null;

      // Centroid
      let cx = 0, cz = 0;
      for (const p of pts) { cx += p.x; cz += p.z; }
      cx /= pts.length; cz /= pts.length;

      // Find longest and shortest edges
      let maxLen = 0, maxDx = 1, maxDz = 0;
      let minLen = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const dx = b.x - a.x, dz = b.z - a.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len < 0.1) continue;
        if (len > maxLen) { maxLen = len; maxDx = dx; maxDz = dz; }
        if (len < minLen) { minLen = len; }
      }

      // rotY: angle so that mesh local +X points along the long edge
      const rotY = -Math.atan2(maxDz, maxDx);

      return { cx, cz, lenEdge: maxLen, widEdge: minLen, rotY };
    };

    const CONTAINER_H = 2.591;
    const TIER_GAP    = 0.08;
    const GROUND_Y    = 0.30;

    // Pass 1: resolve each container to its slot, build geometry params.
    // Collect into a temp array first so we can fix up tiers in pass 2.
    const resolved = [];
    for (const c of containers) {
      if (filterStatus !== "All" && c.status !== filterStatus) continue;

      let slot = locateContainer(c, slotIndex, projection, spatial);
      if (!slot) {
        const hasGps = Number.isFinite(c.lat) && c.lat !== 0 && Number.isFinite(c.lng) && c.lng !== 0;
        if (!hasGps) continue;
        slot = findSlotByLatLng(c.lat, c.lng, projection, spatial, 30);
        if (!slot) continue;
      }

      const obb = slotOBB(slot);
      if (!obb) continue;

      // Orient each container to its OWN slot — blocks like A/L/U mix
      // perpendicular slot sections, so the block's first slot is not
      // representative.
      const rotY = obb.rotY;

      // Real ISO container dimensions (metres) — fixed standard sizes, not
      // scaled from the slot polygon, so every box reads true-to-life.
      const L_20 = 6.058, L_40 = 12.192, CONT_W = 2.438;

      let x = obb.cx, z = obb.cz;
      let contLen = L_20, contW = CONT_W;

      const is40 = c.size === "40ft";
      let partnerKey = null;
      if (is40) {
        contLen = L_40;
        // Geofence columns step by 2 ("01","03","05"…) and are zero-padded,
        // so a 40ft's partner bay is ±2, matched against the padded key.
        const colNum = parseInt(slot.col, 10);
        const padCol = (n) => String(n).padStart(slot.col.length, "0");
        const adjSlot = !isNaN(colNum)
          ? (slotIndex.get(`${slot.block}|${slot.row}|${padCol(colNum + 2)}`) ||
             slotIndex.get(`${slot.block}|${slot.row}|${padCol(colNum - 2)}`))
          : null;
        const adjOBB = adjSlot ? slotOBB(adjSlot) : null;
        if (adjOBB) {
          // Centre the 40ft across its two bays.
          x = (obb.cx + adjOBB.cx) / 2;
          z = (obb.cz + adjOBB.cz) / 2;
          partnerKey = `${adjSlot.block}|${adjSlot.row}|${adjSlot.col}`;
        }
      }

      resolved.push({ c, slot, x, z, rotY, contLen, contW, partnerKey });
    }

    // Pass 2: render. Tier comes straight from the SP's data (parsed from
    // Last_Loc's 4th segment) — no guessing/auto-stacking. A container with
    // no valid tier in the data defaults to tier 1; it is never bumped to a
    // different tier to avoid a clash with another container.
    const MAX_TIER = 4;

    for (const r of resolved) {
      const tier = (Number.isFinite(r.c.tier) && r.c.tier >= 1)
        ? Math.min(r.c.tier, MAX_TIER) : 1;

      if (tier > maxTier) continue;

      const y = GROUND_Y + CONTAINER_H / 2 + (tier - 1) * (CONTAINER_H + TIER_GAP);
      const container = r.c.tier === tier ? r.c : { ...r.c, tier };
      out.push({
        id: container.id, container,
        x: r.x, y, z: r.z,
        rotY: r.rotY,
        w: r.contLen, h: CONTAINER_H, d: r.contW,
        tier,
        color: getColor ? getColor(container) : "#2196F3",
      });
    }
    return out;
  }, [containers, slotIndex, spatial, projection, blocks, geofence, filterStatus, maxTier, getColor]);

  const camDist = Math.max(projection.yardW, projection.yardD);

  // ── Adaptive quality wiring ───────────────────────────────────────────
  // Initialise device detection once. The store handles caching.
  const qualityReady = useQuality(s => s.ready);
  const initQuality  = useQuality(s => s.init);
  const settings     = useQuality(s => s.settings);
  useEffect(() => { if (!qualityReady) initQuality(); }, [qualityReady, initQuality]);

  // lowPerfMode (legacy prop) forces a hard floor on the adaptive system.
  const dpr = lowPerfMode ? 1 : settings.dpr;
  const enableShadows = !lowPerfMode && settings.shadows;
  const antialias = !lowPerfMode && settings.antialias;
  const powerPref = lowPerfMode || settings.tier === "low" || settings.tier === "mobile"
    ? "low-power" : "high-performance";

  // Sun direction scaled to yard size so the shadow frustum always clears the
  // whole site no matter how large the geofence is.
  const sunPos = [camDist * 0.72, camDist * 1.45, camDist * 0.52];
  const shadowSize = settings.shadowMapSize || 1024;
  const shadowExtent = camDist * 1.3; // ortho half-width covering the yard
  // Re-bake the shadow map whenever the structural footprint changes.
  const shadowSignature = `${items.length}|${shadowSize}|${enableShadows}`;

  return (
    <Canvas
      camera={{ position: [0, camDist * 1.4, camDist * 0.55], fov: 50, near: 1, far: camDist * 12 }}
      dpr={dpr} shadows={enableShadows ? { type: THREE.PCFSoftShadowMap } : false}
      gl={{ antialias, powerPreference: powerPref, alpha: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.06;
      }}
      onContextMenu={e => e.preventDefault()} style={{ touchAction: "none" }}
    >
      <FpsAdaptor />
      <StaticShadowBaker enabled={enableShadows} signature={shadowSignature} />

      {/* Daylight CFS lighting — soft sky fill + a single strong shadow-casting sun */}
      <ambientLight intensity={0.62} color="#e8f0ff" />
      <hemisphereLight color="#cfe4fb" groundColor="#9c8a6a" intensity={0.72} />
      {/* Sun — warm directional from upper-right, casts the yard's hard shadows */}
      <directionalLight
        position={sunPos}
        intensity={2.05}
        color="#fff4d6"
        castShadow={enableShadows}
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-near={camDist * 0.2}
        shadow-camera-far={camDist * 5}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-bias={-0.0004}
        shadow-normalBias={0.8}
      />
      {/* Sky fill — cool blue from opposite side */}
      <directionalLight position={[-80, 100, -180]} intensity={0.34} color="#9cc0e6" />
      {/* Ground bounce — warm dust kick-back */}
      <directionalLight position={[0, -60, 0]} intensity={0.12} color="#d8b078" />

      {/* Physically-based sky dome aligned to the sun */}
      <Sky
        distance={camDist * 9}
        sunPosition={sunPos}
        turbidity={4}
        rayleigh={2.2}
        mieCoefficient={0.006}
        mieDirectionalG={0.8}
      />
      <color attach="background" args={["#9cc4ec"]} />
      <fog attach="fog" args={["#c4dbf2", camDist * 3.2, camDist * 7.5]} />

      <OrbitControls ref={controlsRef} makeDefault
        minPolarAngle={0} maxPolarAngle={Math.PI * 0.499}
        minDistance={5} maxDistance={camDist * 10}
        enableDamping dampingFactor={0.1}
        zoomSpeed={1.4} panSpeed={1.4} rotateSpeed={0.85} screenSpacePanning={true}
        mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
      />
      <KeyboardCameraControls controlsRef={controlsRef} />

      <Ground size={camDist} />

      {alignment && (
        <>
          <DxfBlueprint lines={sceneFeatures.lines} alignment={alignment} />

          {/* Warehouses — large industrial sheds with cladding + skylights */}
          {sceneFeatures.warehouses.map((ring, i) => (
            <Warehouse key={`wh-${i}`} ring={ring} alignment={alignment} />
          ))}

          {/* Primary building — office / admin (more floors for larger footprint) */}
          {sceneFeatures.buildings.slice(0, 1).map((ring, i) => (
            <OfficeBuilding key={`ob-${i}`} ring={ring} alignment={alignment} floors={3} />
          ))}

          {/* Remaining buildings — support structures */}
          {sceneFeatures.buildings.slice(1).map((ring, i) => (
            <SupportBuilding key={`sb-${i}`} ring={ring} alignment={alignment} />
          ))}

          {/* Perimeter concrete wall */}
          <PerimeterWall fences={sceneFeatures.fences} alignment={alignment} />
          <WallPillars   fences={sceneFeatures.fences} alignment={alignment} />
          <WallCoping    fences={sceneFeatures.fences} alignment={alignment} />
          <BarbedWire    fences={sceneFeatures.fences} alignment={alignment} />

          <DxfTrees trees={sceneFeatures.trees} alignment={alignment} />

          {/* Baked yard-builder props (custom GLB models, hand-placed
              buildings, etc.) — saved into dxfLayout.props by
              bake-yard-builder-edits.mjs. */}
          {dxfLayout?.props?.length > 0 && (
            <PropsLayer
              props={dxfLayout.props}
              alignment={alignment}
              pickable={!!onPickBakedProp}
              onPick={(i) => onPickBakedProp?.(dxfLayout.props[i])}
            />
          )}
        </>
      )}

      {/* Block pads + outlines */}
      <BlockPadsAndOutlines geofence={geofence} projection={projection} onPick={onPickBlock} />

      {/* Block name labels */}
      <BlockLabels blocks={blocks} visible={showBlockLabels} />

      <Containers
        items={items} selectedId={selectedId} highlightedIds={highlightedIds}
        onSelect={onSelect} onHover={onHover}
      />

      {/* Pin + label + camera jump for selected container */}
      {(() => {
        const selItem = selectedId ? items.find(i => i.id === selectedId) : null;
        return selItem ? (
          <>
            <SelectedPin item={selItem} />
            <CameraFocuser item={selItem} controlsRef={controlsRef} />
          </>
        ) : null;
      })()}

      {liveEquipment?.length > 0 && (
        <LiveEquipmentLayer
          bounds={geofence.bounds} blocks={blocks} equipment={liveEquipment}
          roadSegments={roadSegments}
          selectedId={selectedEquipmentId} followId={followEquipmentId}
          followMode={followEquipmentMode} lowPerfMode={lowPerfMode}
          onSelect={onSelectEquipment} controlsRef={controlsRef}
        />
      )}

      {/* Road Painter — 3D click-to-draw road network */}
      <RoadPainterCanvas
        active={!!roadPainterActive}
        projection={projection}
        points={roadPoints || []}
        onAddPoint={onAddRoadPoint}
      />

      {/* Yard Builder — wall/building placement and editing */}
      <YardBuilderCanvas
        mode={yardBuilderMode || "off"}
        walls={yardBuilderWalls || []}
        buildings={yardBuilderBuildings || []}
        drawPoints={yardBuilderDrawPoints || []}
        onAddDrawPoint={onYardBuilderAddDrawPoint}
        dragStart={yardBuilderDragStart}
        dragCurrent={yardBuilderDragCurrent}
        onDragStart={onYardBuilderDragStart}
        onDragMove={onYardBuilderDragMove}
        onDragEnd={onYardBuilderDragEnd}
        selection={yardBuilderSelection}
        onSelect={onYardBuilderSelect}
      />

      {/* Live Me Avatar */}
      {myGpsPos && <LiveMeAvatar3D gpsPos={myGpsPos} projection={projection} />}

      {/* ── Get Direction — only when directionStartPos is a real GPS-derived position ── */}
      {directionMode && directionStartPos !== null && directionStartPos !== undefined && (() => {
        const targetItem = directionTargetId ? items.find(i => i.id === directionTargetId) : null;
        if (!targetItem) return null;

        // Obstacle AABBs in scene XZ. Includes:
        //   • container blocks
        //   • DXF warehouses, office buildings, support buildings
        // So A* never routes the character through any solid structure.
        const blockBBoxes = Object.values(blocks).map(b => ({
          minX: b.cx - b.w / 2,
          maxX: b.cx + b.w / 2,
          minZ: b.cz - b.d / 2,
          maxZ: b.cz + b.d / 2,
        }));
        const ringBBoxScene = (ring) => {
          let mnX = Infinity, mxX = -Infinity, mnZ = Infinity, mxZ = -Infinity;
          for (const [x, y] of ring) {
            const p = dxfPointToScene(x, y, alignment);
            if (p.x < mnX) mnX = p.x; if (p.x > mxX) mxX = p.x;
            if (p.z < mnZ) mnZ = p.z; if (p.z > mxZ) mxZ = p.z;
          }
          return { minX: mnX, maxX: mxX, minZ: mnZ, maxZ: mxZ };
        };
        if (alignment) {
          for (const ring of sceneFeatures.warehouses) blockBBoxes.push(ringBBoxScene(ring));
          for (const ring of sceneFeatures.buildings)  blockBBoxes.push(ringBBoxScene(ring));
        }

        return (
          <PathNavigator
            key={`${directionTargetId}-${directionStartPos.x.toFixed(1)}-${directionStartPos.z.toFixed(1)}`}
            startPos={directionStartPos}
            targetPos={{ x: targetItem.x, z: targetItem.z }}
            blockBBoxes={blockBBoxes}
            roadMask={roadMask}
            active={true}
            walking={!!directionWalking}
            onArrived={onDirectionArrived}
            controlsRef={controlsRef}
          />
        );
      })()}

      {/* Adaptive post-processing — auto-disabled on low/mobile profiles */}
      <PostFX />

      {children}
    </Canvas>

  );
}
