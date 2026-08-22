/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import {
  asphaltTexture,
  concreteTexture,
  yardTarmacTexture,
} from "../scene/textures";
import {
  getCentroid,
  placeContainer,
  FOUNDATION_TOP_Y,
  CONTAINER_HEIGHT,
} from "../scene/coords";
import { containerAtlasTexture, containerUnitBoxGeometry } from "../scene/containerGeometry";

// ── constants ─────────────────────────────────────────────────────────────
const M_PER_DEG_LAT = 111320;
const mPerDegLng = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

// ── geo → scene projection (equirectangular centred on yard) ─────────────
function buildGeoProjection(bounds) {
  const cLat = (bounds.minLat + bounds.maxLat) / 2;
  const cLng = (bounds.minLng + bounds.maxLng) / 2;
  const mLng = mPerDegLng(cLat);
  return {
    toXZ: (lat, lng) => ({
      x: (lng - cLng) * mLng,
      z: -(lat - cLat) * M_PER_DEG_LAT,
    }),
    yardW: (bounds.maxLng - bounds.minLng) * mLng,
    yardD: (bounds.maxLat - bounds.minLat) * M_PER_DEG_LAT,
  };
}

// ── canvas-texture label sprite — zero external font deps ─────────────────
function makeTextTexture(text, { fontSize = 72, color = "#60a5fa", bg = "rgba(11,22,40,0.82)", padding = 20 } = {}) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = `900 ${fontSize}px 'Segoe UI',Arial,sans-serif`;
  const tw = ctx.measureText(text).width;
  canvas.width  = Math.ceil(tw + padding * 2);
  canvas.height = Math.ceil(fontSize + padding * 2);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const r = canvas.height / 2;
  ctx.fillStyle = bg;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, 0, canvas.width, canvas.height, r);
  else ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.fill();
  ctx.font = `900 ${fontSize}px 'Segoe UI',Arial,sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return { tex, aspect: canvas.width / canvas.height };
}

function BlockLabel({ text, position, color = "#60a5fa", scale = 1 }) {
  const { tex, aspect } = useMemo(() => makeTextTexture(text, { fontSize: 64, color }), [text, color]);
  const h = 5 * scale;
  const w = h * aspect;
  return (
    <sprite position={position} scale={[w, h, 1]}>
      <spriteMaterial map={tex} transparent depthTest={false} />
    </sprite>
  );
}

// ── geometry helpers ───────────────────────────────────────────────────────
function polygonArea(ring) {
  if (!ring || ring.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

function polygonCentroid(ring) {
  if (!ring || ring.length < 3) return null;
  let cx = 0, cy = 0, a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    const f = x1 * y2 - x2 * y1;
    a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
  }
  a *= 0.5;
  if (!a) return { x: ring.reduce((s, p) => s + p[0], 0) / ring.length, y: ring.reduce((s, p) => s + p[1], 0) / ring.length };
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

function toShape(ring, cx, cy) {
  if (!ring || ring.length < 3) return null;
  for (const v of ring) if (isNaN(v[0]) || isNaN(v[1])) return null;
  const s = new THREE.Shape();
  s.moveTo(ring[0][0] - cx, ring[0][1] - cy);
  for (let i = 1; i < ring.length; i++) s.lineTo(ring[i][0] - cx, ring[i][1] - cy);
  s.lineTo(ring[0][0] - cx, ring[0][1] - cy);
  return s;
}

// ── shared tmp objects ─────────────────────────────────────────────────────
const TMP = {
  matrix: new THREE.Matrix4(), quat: new THREE.Quaternion(),
  pos: new THREE.Vector3(), scl: new THREE.Vector3(),
  euler: new THREE.Euler(), color: new THREE.Color(),
};

// ──────────────────────────────────────────────────────────────────────────
// 1. GROUND + TARMAC
// ──────────────────────────────────────────────────────────────────────────
function Ground({ bounds, lines }) {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const yardW = (bounds.maxX - bounds.minX) + 80;
  const yardD = (bounds.maxY - bounds.minY) + 80;
  const tarmac = useMemo(() => yardTarmacTexture(), []);
  const asphalt = useMemo(() => asphaltTexture(), []);

  const bpGeom = useMemo(() => {
    const pts = [];
    if (lines) {
      for (const ls of lines) {
        for (let i = 0; i < ls.length - 1; i++) {
          pts.push(new THREE.Vector3(ls[i][0] - cx, -0.48, (ls[i][1] - cy) * -1));
          pts.push(new THREE.Vector3(ls[i + 1][0] - cx, -0.48, (ls[i + 1][1] - cy) * -1));
        }
      }
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [lines, cx, cy]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.65, 0]}>
        <planeGeometry args={[6000, 6000]} />
        <meshLambertMaterial color="#0d1322" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]}>
        <planeGeometry args={[yardW + 200, yardD + 200]} />
        <meshLambertMaterial map={asphalt} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[yardW, yardD]} />
        <meshLambertMaterial map={tarmac} />
      </mesh>
      <lineSegments geometry={bpGeom} renderOrder={2}>
        <lineBasicMaterial color="#7d8aa5" opacity={0.12} transparent depthWrite={false} />
      </lineSegments>
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 2. YARD PERIMETER WALL — follows real fences outline from layout + geofence
// ──────────────────────────────────────────────────────────────────────────
function YardPerimeterWall({ fences, cx, cy, geoBounds, geoProj }) {
  const wallHeight = 3.2;
  const wallThick = 0.6;

  // Segments from DXF fences
  const dxfSegs = useMemo(() => {
    const out = [];
    if (!fences) return out;
    for (const ls of fences) {
      for (let i = 0; i < ls.length - 1; i++) {
        const x1 = ls[i][0] - cx, z1 = (ls[i][1] - cy) * -1;
        const x2 = ls[i + 1][0] - cx, z2 = (ls[i + 1][1] - cy) * -1;
        const len = Math.hypot(x2 - x1, z2 - z1);
        if (len < 0.5) continue;
        out.push({ mx: (x1 + x2) / 2, mz: (z1 + z2) / 2, len, ang: Math.atan2(z2 - z1, x2 - x1) });
      }
    }
    return out;
  }, [fences, cx, cy]);

  // Geofence outer bounding box as additional wall ring
  const geoSegs = useMemo(() => {
    if (!geoBounds || !geoProj) return [];
    const corners = [
      geoProj.toXZ(geoBounds.minLat, geoBounds.minLng),
      geoProj.toXZ(geoBounds.minLat, geoBounds.maxLng),
      geoProj.toXZ(geoBounds.maxLat, geoBounds.maxLng),
      geoProj.toXZ(geoBounds.maxLat, geoBounds.minLng),
    ];
    const out = [];
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i], b = corners[(i + 1) % corners.length];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 1) continue;
      out.push({ mx: (a.x + b.x) / 2, mz: (a.z + b.z) / 2, len, ang: Math.atan2(b.z - a.z, b.x - a.x) });
    }
    return out;
  }, [geoBounds, geoProj]);

  const allSegs = useMemo(() => (dxfSegs.length ? dxfSegs : geoSegs), [dxfSegs, geoSegs]);

  const ref = useRef();
  useLayoutEffect(() => {
    if (!ref.current || !allSegs.length) return;
    const { matrix, quat, pos, scl, euler } = TMP;
    allSegs.forEach((s, i) => {
      euler.set(0, -s.ang, 0); quat.setFromEuler(euler);
      pos.set(s.mx, wallHeight / 2, s.mz);
      scl.set(s.len, wallHeight, wallThick);
      matrix.compose(pos, quat, scl);
      ref.current.setMatrixAt(i, matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [allSegs]);

  if (!allSegs.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, allSegs.length]} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial color="#4a5568" />
    </instancedMesh>
  );
}

// Wall cap strip along the top
function WallCaps({ fences, cx, cy }) {
  const geom = useMemo(() => {
    const pts = [];
    if (!fences) return new THREE.BufferGeometry();
    const y = 3.2;
    for (const ls of fences) {
      for (let i = 0; i < ls.length - 1; i++) {
        pts.push(new THREE.Vector3(ls[i][0] - cx, y, (ls[i][1] - cy) * -1));
        pts.push(new THREE.Vector3(ls[i + 1][0] - cx, y, (ls[i + 1][1] - cy) * -1));
      }
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [fences, cx, cy]);
  return (
    <lineSegments geometry={geom} renderOrder={3}>
      <lineBasicMaterial color="#718096" />
    </lineSegments>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 3. BUILDINGS
// ──────────────────────────────────────────────────────────────────────────
function Building({ ring, cx, cy, color = "#475569", height = 6 }) {
  const shape = useMemo(() => toShape(ring, cx, cy), [ring, cx, cy]);
  if (!shape) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
      <extrudeGeometry args={[shape, { depth: height, bevelEnabled: false }]} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

function Warehouse({ ring, cx, cy }) {
  const shape = useMemo(() => toShape(ring, cx, cy), [ring, cx, cy]);
  if (!shape) return null;
  const wallH = 12;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <extrudeGeometry args={[shape, { depth: wallH, bevelEnabled: false }]} />
        <meshLambertMaterial color="#c8d5e0" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, wallH - 0.35, 0]}>
        <shapeGeometry args={[shape]} />
        <meshLambertMaterial color="#7a8fa0" />
      </mesh>
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 4. TREES
// ──────────────────────────────────────────────────────────────────────────
function TreesInstanced({ trees, cx, cy }) {
  const fRef = useRef(), tRef = useRef();
  const subset = useMemo(() => (trees || []).filter((_, i) => i % 2 === 0), [trees]);
  useLayoutEffect(() => {
    if (!fRef.current || !tRef.current || !subset.length) return;
    const m = new THREE.Matrix4();
    subset.forEach((t, i) => {
      const tx = t.cx - cx, tz = (t.cy - cy) * -1;
      m.makeTranslation(tx, 3.0, tz); fRef.current.setMatrixAt(i, m);
      m.makeTranslation(tx, 0.9, tz); tRef.current.setMatrixAt(i, m);
    });
    fRef.current.instanceMatrix.needsUpdate = true;
    tRef.current.instanceMatrix.needsUpdate = true;
  }, [subset, cx, cy]);
  if (!subset.length) return null;
  return (
    <>
      <instancedMesh ref={fRef} args={[undefined, undefined, subset.length]}>
        <sphereGeometry args={[2.4, 6, 6]} />
        <meshLambertMaterial color="#15803d" />
      </instancedMesh>
      <instancedMesh ref={tRef} args={[undefined, undefined, subset.length]}>
        <cylinderGeometry args={[0.3, 0.45, 1.8, 6]} />
        <meshLambertMaterial color="#451a03" />
      </instancedMesh>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 5. GEOFENCE SLOT GRID — render real slot polygons from slot-geofence.json
// ──────────────────────────────────────────────────────────────────────────
function GeofenceSlotGrid({ geofence, geoProj, activeBlock }) {
  // Slot outlines — all slots or only active block's slots
  const lineGeom = useMemo(() => {
    if (!geofence?.slots || !geoProj) return null;
    const slots = activeBlock
      ? geofence.slots.filter(s => s.block === activeBlock)
      : geofence.slots;
    const pts = [];
    const y = 0.82;
    for (const s of slots) {
      const poly = s.polygon;
      if (!poly || poly.length < 3) continue;
      for (let i = 0; i < poly.length - 1; i++) {
        const a = geoProj.toXZ(poly[i][0], poly[i][1]);
        const b = geoProj.toXZ(poly[i + 1][0], poly[i + 1][1]);
        pts.push(new THREE.Vector3(a.x, y, a.z));
        pts.push(new THREE.Vector3(b.x, y, b.z));
      }
    }
    if (!pts.length) return null;
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [geofence, geoProj, activeBlock]);

  if (!lineGeom) return null;
  const color = activeBlock ? "#60a5fa" : "#475569";
  const opacity = activeBlock ? 0.9 : 0.35;
  return (
    <lineSegments geometry={lineGeom} renderOrder={6}>
      <lineBasicMaterial color={color} opacity={opacity} transparent depthWrite={false} />
    </lineSegments>
  );
}

// Slot name labels — shown when drilled into a block (canvas sprites)
function SlotLabels({ geofence, geoProj, activeBlock }) {
  const slots = useMemo(() => {
    if (!geofence?.slots || !geoProj || !activeBlock) return [];
    return geofence.slots
      .filter(s => s.block === activeBlock)
      .map(s => {
        const { x, z } = geoProj.toXZ(s.lat, s.lng);
        return { key: s.key, name: s.slotName || s.key, x, z };
      });
  }, [geofence, geoProj, activeBlock]);

  return (
    <>
      {slots.map(s => (
        <BlockLabel key={s.key} text={s.name} position={[s.x, 3.5, s.z]} color="#bae6fd" scale={0.28} />
      ))}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 6. BLOCK PADS — concrete foundations from geofence block bboxes
// ──────────────────────────────────────────────────────────────────────────
function GeofenceBlockPads({ geofence, geoProj, onDrillBlock }) {
  const concrete = useMemo(() => concreteTexture(), []);
  const blocks = useMemo(() => {
    if (!geofence?.blocks || !geoProj) return [];
    return Object.values(geofence.blocks).map(b => {
      const minPt = geoProj.toXZ(b.minLat, b.minLng);
      const maxPt = geoProj.toXZ(b.maxLat, b.maxLng);
      const cx = (minPt.x + maxPt.x) / 2;
      const cz = (minPt.z + maxPt.z) / 2;
      const w = Math.abs(maxPt.x - minPt.x);
      const d = Math.abs(maxPt.z - minPt.z);
      return { id: b.id, cx, cz, w, d };
    });
  }, [geofence, geoProj]);

  return (
    <group>
      {blocks.map(b => (
        <mesh
          key={`pad-${b.id}`}
          position={[b.cx, 0.4, b.cz]}
          onClick={(e) => { e.stopPropagation(); onDrillBlock(b.id); }}
        >
          <boxGeometry args={[b.w, 0.8, b.d]} />
          <meshLambertMaterial map={concrete} />
        </mesh>
      ))}
    </group>
  );
}

// Yellow block borders from geofence
function GeofenceBlockBorders({ geofence, geoProj }) {
  const geom = useMemo(() => {
    if (!geofence?.blocks || !geoProj) return null;
    const pts = [];
    const y = 0.82;
    const inset = 0.4;
    for (const b of Object.values(geofence.blocks)) {
      const corners = [
        geoProj.toXZ(b.minLat + inset / M_PER_DEG_LAT, b.minLng + inset / mPerDegLng(b.centerLat)),
        geoProj.toXZ(b.minLat + inset / M_PER_DEG_LAT, b.maxLng - inset / mPerDegLng(b.centerLat)),
        geoProj.toXZ(b.maxLat - inset / M_PER_DEG_LAT, b.maxLng - inset / mPerDegLng(b.centerLat)),
        geoProj.toXZ(b.maxLat - inset / M_PER_DEG_LAT, b.minLng + inset / mPerDegLng(b.centerLat)),
      ];
      for (let i = 0; i < 4; i++) {
        const a = corners[i], bv = corners[(i + 1) % 4];
        pts.push(new THREE.Vector3(a.x, y, a.z));
        pts.push(new THREE.Vector3(bv.x, y, bv.z));
      }
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [geofence, geoProj]);

  if (!geom) return null;
  return (
    <lineSegments geometry={geom} renderOrder={5}>
      <lineBasicMaterial color="#fbbf24" linewidth={1} depthWrite={false} />
    </lineSegments>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 7. LEGACY DXF BLOCK PADS (when no geofence)
// ──────────────────────────────────────────────────────────────────────────
function BlockFoundations({ blocks, cx, cy, onDrillBlock }) {
  const concrete = useMemo(() => concreteTexture(), []);
  return (
    <group>
      {blocks.map(b => {
        const bx = b.cx - cx, bz = (b.cy - cy) * -1;
        return (
          <mesh key={`fnd-${b.id}`} position={[bx, 0.4, bz]} rotation={[0, b.angle || 0, 0]}
            onClick={(e) => { e.stopPropagation(); onDrillBlock(b.id); }}>
            <boxGeometry args={[b.w, 0.8, b.h]} />
            <meshLambertMaterial map={concrete} />
          </mesh>
        );
      })}
    </group>
  );
}

function BlockPaintBorders({ blocks, cx, cy }) {
  const geom = useMemo(() => {
    const pts = [], y = 0.802;
    blocks.forEach(b => {
      const bx = b.cx - cx, bz = (b.cy - cy) * -1;
      const ang = b.angle || 0, cosA = Math.cos(ang), sinA = Math.sin(ang);
      const bw = b.w, bd = b.h, inset = 0.7;
      const corners = [[-bw / 2 + inset, -bd / 2 + inset], [bw / 2 - inset, -bd / 2 + inset], [bw / 2 - inset, bd / 2 - inset], [-bw / 2 + inset, bd / 2 - inset]];
      const w = corners.map(([lx, lz]) => ({ x: bx + lx * cosA - lz * sinA, z: bz + lx * sinA + lz * cosA }));
      for (let i = 0; i < 4; i++) {
        const a = w[i], b2 = w[(i + 1) % 4];
        pts.push(new THREE.Vector3(a.x, y, a.z)); pts.push(new THREE.Vector3(b2.x, y, b2.z));
      }
    });
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [blocks, cx, cy]);
  return <lineSegments geometry={geom} renderOrder={5}><lineBasicMaterial color="#fbbf24" linewidth={1} depthWrite={false} /></lineSegments>;
}

function AllBlockGrids({ blocks, cx, cy }) {
  const geom = useMemo(() => {
    const pts = [], y = 0.804;
    blocks.forEach(b => {
      const bx = b.cx - cx, bz = (b.cy - cy) * -1;
      const ang = b.angle || 0, cosA = Math.cos(ang), sinA = Math.sin(ang);
      const rows = b.rows || 6, slots = b.slots || 18;
      const bw = b.w, bd = b.h, cellW = bw / slots, cellD = bd / rows;
      const xform = (lx, lz) => ({ x: bx + lx * cosA - lz * sinA, z: bz + lx * sinA + lz * cosA });
      for (let s = 0; s <= slots; s++) {
        const lx = -bw / 2 + s * cellW;
        const a = xform(lx, -bd / 2), c = xform(lx, bd / 2);
        pts.push(new THREE.Vector3(a.x, y, a.z)); pts.push(new THREE.Vector3(c.x, y, c.z));
      }
      for (let r = 0; r <= rows; r++) {
        const lz = -bd / 2 + r * cellD;
        const a = xform(-bw / 2, lz), c = xform(bw / 2, lz);
        pts.push(new THREE.Vector3(a.x, y, a.z)); pts.push(new THREE.Vector3(c.x, y, c.z));
      }
    });
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [blocks, cx, cy]);
  return <lineSegments geometry={geom} renderOrder={4}><lineBasicMaterial color="#e2e8f0" opacity={0.32} transparent depthWrite={false} /></lineSegments>;
}

// ──────────────────────────────────────────────────────────────────────────
// 8. CONTAINERS — single InstancedMesh
// ──────────────────────────────────────────────────────────────────────────
function ContainersInstanced({ items, selectedId, highlightedIds, onSelect, onHover }) {
  const ref = useRef();
  const [hovered, setHovered] = useState(null);
  const atlas = useMemo(() => containerAtlasTexture(), []);
  const geom  = useMemo(() => containerUnitBoxGeometry(), []);

  useLayoutEffect(() => {
    if (!ref.current || !items.length) return;
    const { matrix, quat, pos, scl, euler, color } = TMP;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      euler.set(0, it.rotY, 0); quat.setFromEuler(euler);
      pos.set(it.x, it.y, it.z); scl.set(it.w, it.h, it.d);
      matrix.compose(pos, quat, scl);
      ref.current.setMatrixAt(i, matrix);
      const isSel = it.id === selectedId, isHov = i === hovered;
      const isHL = highlightedIds ? highlightedIds.has(it.id) : true;
      // Bright selected/hover, full carrier color when highlighted, dimmed grey otherwise
      const baseColor = isSel ? "#ffe066" : isHov ? "#ffffff" : (isHL ? it.color : "#3a4a5e");
      color.set(baseColor);
      // Tier brightening — upper tiers slightly lighter for depth perception
      if (!isSel && !isHov) {
        const shade = 1.0 + Math.min(0.18, (it.tier - 1) * 0.06);
        color.multiplyScalar(shade);
      }
      ref.current.setColorAt(i, color);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [items, selectedId, highlightedIds, hovered]);

  if (!items.length) return null;
  return (
    <instancedMesh ref={ref} args={[geom, undefined, items.length]}
      onClick={(e) => { e.stopPropagation(); if (e.instanceId != null && items[e.instanceId]) onSelect(items[e.instanceId].container); }}
      onPointerMove={(e) => {
        if (e.instanceId !== hovered) {
          setHovered(e.instanceId ?? null);
          if (e.instanceId != null && items[e.instanceId] && onHover) onHover(items[e.instanceId]);
        }
      }}
      onPointerOut={() => { setHovered(null); if (onHover) onHover(null); }}>
      {/* meshStandardMaterial gives physically-based shading so carrier colours
          read true under sunlight — far more vivid than Lambert */}
      <meshStandardMaterial
        map={atlas}
        vertexColors
        roughness={0.55}
        metalness={0.08}
        envMapIntensity={0.4}
      />
    </instancedMesh>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 9. ROW/SLOT LABELS (drill-down, flat on ground using drei Text)
// ──────────────────────────────────────────────────────────────────────────
function RowSlotLabels({ block, cx, cy }) {
  const bx = block.cx - cx, bz = (block.cy - cy) * -1;
  const rows = block.rows || 6, slots = block.slots || 18;
  const bw = block.w, bd = block.h;
  const cellW = bw / slots, cellD = bd / rows;
  const labels = [];
  for (let r = 1; r <= rows; r++) {
    const lz = -bd / 2 + (r - 0.5) * cellD;
    labels.push({ key: `r-${r}`, text: `R${r}`, lx: -bw / 2 - 2.6, lz, color: "#fde68a", size: Math.min(cellD * 0.55, 1.8) });
  }
  for (let s = 1; s <= slots; s++) {
    const lx = -bw / 2 + (s - 0.5) * cellW;
    labels.push({ key: `s-${s}`, text: `${s}`, lx, lz: -bd / 2 - 2.6, color: "#bae6fd", size: Math.min(cellW * 0.55, 1.6) });
  }
  return (
    <group position={[bx, 0.9, bz]} rotation={[0, block.angle || 0, 0]}>
      {labels.map(l => (
        <Text key={l.key} position={[l.lx, 0.02, l.lz]} rotation={[-Math.PI / 2, 0, 0]}
          fontSize={l.size} color={l.color} anchorX="center" anchorY="middle"
          outlineWidth={0.05} outlineColor="#0b1628">
          {l.text}
        </Text>
      ))}
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 10. SMART CAMERA
// ──────────────────────────────────────────────────────────────────────────
function CameraController({ focus }) {
  const { camera, controls } = useThree();
  const targetPos = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());
  const active = useRef(false);
  useEffect(() => {
    if (!focus) { active.current = false; return; }
    targetLook.current.set(focus.x, focus.y, focus.z);
    targetPos.current.set(focus.x + 35, focus.y + 60, focus.z + 50);
    active.current = true;
  }, [focus]);
  useFrame(() => {
    if (!active.current) return;
    camera.position.lerp(targetPos.current, 0.08);
    if (controls?.target) { controls.target.lerp(targetLook.current, 0.12); controls.update(); }
    if (camera.position.distanceTo(targetPos.current) < 0.5) active.current = false;
  });
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// 11. HOVER TOOLTIP
// ──────────────────────────────────────────────────────────────────────────
function HoverInfoTooltip({ hover }) {
  if (!hover) return null;
  const c = hover.container;
  return (
    <div style={{
      position: "absolute", left: 16, bottom: 16, zIndex: 20,
      background: "rgba(8,14,28,0.92)", border: "1px solid #3b82f6",
      borderRadius: 8, padding: "10px 14px", pointerEvents: "none",
      fontFamily: "'JetBrains Mono', monospace", color: "#e2e8f0", minWidth: 220,
    }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#60a5fa", marginBottom: 4 }}>{c.containerNo || c.id}</div>
      <div style={{ fontSize: 10.5, color: "#94a3b8" }}>{c.size} · {c.type} · <span style={{ color: "#fde68a" }}>{c.status}</span></div>
      <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>Block {c.block} · R{c.row} · S{c.slot} · T{c.tier}</div>
      {c.locationName && c.locationName !== "-" && (
        <div style={{ fontSize: 10, color: "#4ade80", marginTop: 2 }}>{c.locationName}</div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 11b. LIVE GPS HOOK
// ──────────────────────────────────────────────────────────────────────────
function useLiveGPS() {
  const [pos, setPos] = useState(null); // {lat, lng, accuracy}
  const [error, setError] = useState(null);
  const [watching, setWatching] = useState(false);
  const watchId = useRef(null);

  const start = useCallback(() => {
    if (!navigator.geolocation) { setError("GPS not supported"); return; }
    setError(null);
    setWatching(true);
    watchId.current = navigator.geolocation.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (e) => setError(e.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  }, []);

  const stop = useCallback(() => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setWatching(false);
    setPos(null);
    setError(null);
  }, []);

  useEffect(() => () => { if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current); }, []);
  return { pos, error, watching, start, stop };
}

// ──────────────────────────────────────────────────────────────────────────
// 11c. LIVE ME AVATAR (Three.js)
// ──────────────────────────────────────────────────────────────────────────
function LiveMeAvatar({ geoPos, geoProj }) {
  const groupRef = useRef();
  const ringRef = useRef();
  const t = useRef(0);

  const scenePos = useMemo(() => {
    if (!geoPos || !geoProj) return null;
    return geoProj.toXZ(geoPos.lat, geoPos.lng);
  }, [geoPos, geoProj]);

  useFrame((_, delta) => {
    t.current += delta;
    if (groupRef.current) {
      groupRef.current.position.y = 1.0 + Math.sin(t.current * 2.2) * 0.18;
    }
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
      {/* Glow disc on ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.88, 0]}>
        <circleGeometry args={[1.4, 32]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      {/* Avatar body */}
      <group ref={groupRef} position={[0, 1.0, 0]}>
        {/* Legs */}
        <mesh position={[-0.28, -1.05, 0]}>
          <cylinderGeometry args={[0.18, 0.14, 1.0, 8]} />
          <meshLambertMaterial color="#1d4ed8" />
        </mesh>
        <mesh position={[0.28, -1.05, 0]}>
          <cylinderGeometry args={[0.18, 0.14, 1.0, 8]} />
          <meshLambertMaterial color="#1d4ed8" />
        </mesh>
        {/* Body */}
        <mesh position={[0, -0.1, 0]}>
          <cylinderGeometry args={[0.38, 0.32, 1.1, 10]} />
          <meshLambertMaterial color="#3b82f6" />
        </mesh>
        {/* Arms */}
        <mesh position={[-0.62, -0.05, 0]} rotation={[0, 0, Math.PI / 5]}>
          <cylinderGeometry args={[0.12, 0.09, 0.85, 7]} />
          <meshLambertMaterial color="#2563eb" />
        </mesh>
        <mesh position={[0.62, -0.05, 0]} rotation={[0, 0, -Math.PI / 5]}>
          <cylinderGeometry args={[0.12, 0.09, 0.85, 7]} />
          <meshLambertMaterial color="#2563eb" />
        </mesh>
        {/* Neck */}
        <mesh position={[0, 0.58, 0]}>
          <cylinderGeometry args={[0.14, 0.16, 0.22, 8]} />
          <meshLambertMaterial color="#fbbf24" />
        </mesh>
        {/* Head */}
        <mesh position={[0, 0.88, 0]}>
          <sphereGeometry args={[0.38, 12, 12]} />
          <meshLambertMaterial color="#fbbf24" />
        </mesh>
        {/* Hard hat */}
        <mesh position={[0, 1.18, 0]}>
          <cylinderGeometry args={[0.46, 0.42, 0.2, 10]} />
          <meshLambertMaterial color="#22d3ee" />
        </mesh>
        <mesh position={[0, 1.3, 0]}>
          <sphereGeometry args={[0.28, 10, 6]} />
          <meshLambertMaterial color="#22d3ee" />
        </mesh>
        {/* YOU label */}
        <sprite position={[0, 2.4, 0]} scale={[4, 1.1, 1]}>
          <spriteMaterial color="#22d3ee" />
        </sprite>
      </group>
    </group>
  );
}

// YOU label sprite using canvas texture
function YouLabel({ geoPos, geoProj }) {
  const scenePos = useMemo(() => {
    if (!geoPos || !geoProj) return null;
    return geoProj.toXZ(geoPos.lat, geoPos.lng);
  }, [geoPos, geoProj]);

  const { tex, aspect } = useMemo(() => makeTextTexture("📍 YOU", { fontSize: 56, color: "#22d3ee", bg: "rgba(6,18,38,0.88)" }), []);

  if (!scenePos) return null;
  const h = 3.5, w = h * aspect;
  return (
    <sprite position={[scenePos.x, 7.5, scenePos.z]} scale={[w, h, 1]}>
      <spriteMaterial map={tex} transparent depthTest={false} />
    </sprite>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MAIN SCENE
// ──────────────────────────────────────────────────────────────────────────

export default function YardOverview3D({
  layoutData, site, containers, filterStatus, filterZone,
  maxTier, colorMode, highlightedIds, selectedId,
  onSelect, onDrillBlock, drillBlock, getContainerColor, YARD_BLOCKS,
}) {
  const [hover, setHover] = useState(null);
  const [geofence, setGeofence] = useState(null);
  const { pos: gpsPos, error: gpsError, watching: gpsWatching, start: gpsStart, stop: gpsStop } = useLiveGPS();

  // Load Mumbai slot-geofence
  useEffect(() => {
    setGeofence(null);
    fetch(`/slot-geofence-mumbai.json?t=${Date.now()}`)
      .then(r => r.json())
      .then(setGeofence)
      .catch(() => {});
  }, []);

  // ── geo projection from geofence bounds ──────────────────────────────────
  const geoProj = useMemo(() => {
    if (!geofence?.bounds) return null;
    return buildGeoProjection(geofence.bounds);
  }, [geofence]);

  // ── synthetic block layout (when no CAD, use YARD_BLOCKS) ───────────────
  const syntheticBlocks = useMemo(() => {
    if (layoutData?.blocks?.length) return null;
    const yb = YARD_BLOCKS || [];
    if (!yb.length) return null;
    const BLOCK_W = 60, BLOCK_D = 40, GAP = 18;
    const cols = Math.ceil(Math.sqrt(yb.length * 1.6));
    return yb.map((b, i) => ({
      id: b.id, name: b.name || b.id, zone: b.zone || "Import",
      cx: (i % cols) * (BLOCK_W + GAP), cy: Math.floor(i / cols) * (BLOCK_D + GAP),
      w: BLOCK_W, h: BLOCK_D, angle: 0,
      rows: b.rows, slots: b.slots, maxTiers: b.maxTiers,
    }));
  }, [layoutData, YARD_BLOCKS]);

  const syntheticBounds = useMemo(() => {
    if (!syntheticBlocks) return null;
    const BLOCK_W = 60, BLOCK_D = 40, GAP = 18;
    const cols = Math.ceil(Math.sqrt(syntheticBlocks.length * 1.6));
    const rows = Math.ceil(syntheticBlocks.length / cols);
    return { minX: -GAP, maxX: cols * (BLOCK_W + GAP), minY: -GAP, maxY: rows * (BLOCK_D + GAP) };
  }, [syntheticBlocks]);

  // ── scene bounds + centroid ──────────────────────────────────────────────
  const bounds = syntheticBounds || layoutData?.bounds || { minX: 0, maxX: 200, minY: 0, maxY: 200 };
  const { cx, cy } = getCentroid(bounds);
  const yardW = (bounds.maxX - bounds.minX) + 80;
  const yardD = (bounds.maxY - bounds.minY) + 80;

  const warehouseRings = useMemo(() => (
    (layoutData?.warehouses || []).filter(r => Array.isArray(r) && r.length >= 4)
      .map(r => ({ r, a: polygonArea(r) })).filter(x => x.a >= 100)
      .sort((a, b) => b.a - a.a).slice(0, 6).map(x => x.r)
  ), [layoutData?.warehouses]);

  const allBuildingRings = useMemo(() => (
    (layoutData?.buildings || []).filter(r => Array.isArray(r) && r.length >= 4)
      .map(r => ({ r, a: polygonArea(r) })).filter(x => x.a >= 20)
      .sort((a, b) => b.a - a.a)
  ), [layoutData?.buildings]);

  const primaryRing = allBuildingRings[0]?.r || null;
  const supportRings = allBuildingRings.slice(1, 12).map(x => x.r);
  const primaryLabel = "CWC";

  // ── blocks with meta ─────────────────────────────────────────────────────
  const blocksWithMeta = useMemo(() => {
    const source = syntheticBlocks
      ? syntheticBlocks
      : (layoutData?.blocks || []).map((b, idx) => {
          const t = (YARD_BLOCKS || []).find(x => x.id === b.id) || {};
          const inventoryBlock = (YARD_BLOCKS || [])[idx] || t;
          const realName = inventoryBlock?.name || inventoryBlock?.id || b.name || `BLOCK-${b.id}`;
          return { ...b, rows: b.rows || t.rows || 6, slots: b.slots || t.slots || 18, zone: b.zone || t.zone || "Import", name: realName };
        });
    if (drillBlock) return source.filter(b => b.id === drillBlock);
    if (filterZone !== "All") return source.filter(b => b.zone === filterZone);
    return source;
  }, [layoutData?.blocks, YARD_BLOCKS, syntheticBlocks, drillBlock, filterZone]);

  const drillBlockData = useMemo(
    () => (drillBlock ? blocksWithMeta.find(b => b.id === drillBlock) : null),
    [drillBlock, blocksWithMeta]
  );

  // ── geofence-driven container placement ──────────────────────────────────
  // When geofence is loaded, place containers using geo coords projected to XZ.
  // Falls back to DXF block placement when no geofence.
  const containerInstances = useMemo(() => {
    if (!layoutData && !syntheticBlocks) return [];
    const blockMap = new Map();
    blocksWithMeta.forEach(b => blockMap.set(b.id, b));

    // If geofence is available, build a slot-centre map for fast lookup.
    // Each entry carries the slot's actual centre, dimensions and rotation
    // (derived from polygon corners), so the container box fits the slot
    // perfectly instead of using fixed dimensions.
    const slotCentre = new Map(); // key variants → {x, z, w, d, rotY}
    const slotByName = new Map(); // slotName (upper) → {x, z, w, d, rotY}
    if (geofence?.slots && geoProj) {
      for (const s of geofence.slots) {
        // Project polygon corners → use first 4 unique corners to derive
        // oriented bbox. Fall back to slot lat/lng centre if polygon missing.
        let pt;
        const poly = Array.isArray(s.polygon) ? s.polygon : null;
        if (poly && poly.length >= 4) {
          const p0 = geoProj.toXZ(poly[0][0], poly[0][1]);
          const p1 = geoProj.toXZ(poly[1][0], poly[1][1]);
          const p2 = geoProj.toXZ(poly[2][0], poly[2][1]);
          const p3 = geoProj.toXZ(poly[3][0], poly[3][1]);
          // Edge p0→p1 is one side, p1→p2 is the perpendicular side.
          const ex = p1.x - p0.x, ez = p1.z - p0.z;
          const fx = p2.x - p1.x, fz = p2.z - p1.z;
          const sideA = Math.hypot(ex, ez);
          const sideB = Math.hypot(fx, fz);
          // Container is longer along its length axis; map the longer side
          // to width (X-axis before rotation) so 20/40ft boxes sit lengthwise.
          const longer = Math.max(sideA, sideB);
          const shorter = Math.min(sideA, sideB);
          const longVec = sideA >= sideB ? { x: ex, z: ez } : { x: fx, z: fz };
          // rotY rotates +X toward longVec direction. In our scene, +X is east
          // and +Z is south (geoProj inverts lat). Three.js rotateY about Y
          // rotates from +X toward -Z, so angle = atan2(-vz, vx).
          const rotY = Math.atan2(-longVec.z, longVec.x);
          const cxp = (p0.x + p1.x + p2.x + p3.x) / 4;
          const czp = (p0.z + p1.z + p2.z + p3.z) / 4;
          // 90% fill so the slot outline stays visible around the container.
          pt = { x: cxp, z: czp, w: longer * 0.92, d: shorter * 0.88, rotY };
        } else {
          const { x, z } = geoProj.toXZ(s.lat, s.lng);
          pt = { x, z, w: 5.9, d: 2.3, rotY: 0 };
        }
        slotCentre.set(s.key, pt);                                  // block|row|col
        slotCentre.set(`${s.block}|${s.row}|${s.col}`, pt);
        slotCentre.set(`${s.block}|${s.col}|${s.row}`, pt);        // swapped variant
        if (s.slotName) slotByName.set(String(s.slotName).toUpperCase(), pt);
      }
    }

    const items = [];
    for (const c of containers) {
      if (c.tier > maxTier) continue;
      if (filterStatus !== "All" && c.status !== filterStatus) continue;

      // Try geofence slot placement first (most accurate)
      let placed = null;
      if ((slotCentre.size || slotByName.size) && c.locationName && c.locationName !== "-") {
        const locStr = String(c.locationName).trim().toUpperCase();

        // Try direct slotName match first
        let sc = slotByName.get(locStr);

        if (!sc) {
          // Split by colon/dash/slash — take first 3 parts (4th part is tier)
          const parts = locStr.split(/[:\-/]/).map(p => p.trim()).filter(Boolean);
          if (parts.length >= 3) {
            const key1 = `${parts[0]}|${parts[1]}|${parts[2]}`;
            const key2 = `${parts[0]}|${parts[2]}|${parts[1]}`;
            sc = slotCentre.get(key1) || slotCentre.get(key2);
          }
        }

        if (sc) {
          const y = FOUNDATION_TOP_Y + (c.tier - 0.5) * (CONTAINER_HEIGHT + 0.2);
          placed = {
            x: sc.x, y, z: sc.z,
            rotY: sc.rotY ?? 0,
            w: sc.w ?? 5.9,
            h: CONTAINER_HEIGHT,
            d: sc.d ?? 2.3,
          };
        }
      }

      // Fallback: DXF block placement
      if (!placed) {
        const b = blockMap.get(c.block);
        if (!b) continue;
        placed = placeContainer(b, c, cx, cy);
      }

      items.push({
        id: c.id, container: c, ...placed, tier: c.tier,
        color: getContainerColor(c, colorMode),
      });
    }
    return items;
  }, [layoutData, syntheticBlocks, geofence, geoProj, containers, blocksWithMeta, filterStatus, maxTier, colorMode, cx, cy, getContainerColor]);

  const focusTarget = useMemo(() => {
    if (!selectedId) return null;
    const it = containerInstances.find(i => i.id === selectedId);
    return it ? { x: it.x, y: it.y, z: it.z } : null;
  }, [selectedId, containerInstances]);

  const L = Math.max(yardW, yardD);
  const initCamPos = drillBlock ? [0, 55, 80] : [0, L * 0.82, L * 0.55];

  // Loading state — need at least one data source
  if (!layoutData && !syntheticBlocks && !geofence) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#4d7a9e", background: "#0b1628" }}>
        Loading 3D Yard…
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "linear-gradient(180deg, #9cc4ec 0%, #bcd8f5 60%, #d8c89c 100%)" }}>
      <Canvas
        camera={{ position: initCamPos, fov: 60, near: 1, far: 6000 }}
        dpr={[1, 1.5]} shadows={false}
        gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
      >
        {/* ── Daylight CFS lighting — tuned for meshStandardMaterial ── */}
        <ambientLight intensity={1.4} color="#ffffff" />
        <hemisphereLight color="#ddeeff" groundColor="#b09870" intensity={1.0} />
        <directionalLight position={[200, 400, 150]} intensity={2.2} color="#fff8e8" />
        <directionalLight position={[-150, 200, -250]} intensity={0.9} color="#c8ddf5" />
        <directionalLight position={[0, 100, 300]} intensity={0.5} color="#ffffff" />
        <color attach="background" args={["#9cc4ec"]} />
        <fog attach="fog" args={["#bcd8f5", L * 1.8, L * 4.5]} />

        <OrbitControls
          makeDefault minPolarAngle={0.08} maxPolarAngle={Math.PI * 0.49}
          minDistance={8} maxDistance={L * 3.5} enableDamping dampingFactor={0.12}
          zoomSpeed={1.2} panSpeed={1.2} rotateSpeed={0.85} screenSpacePanning={false}
        />
        <CameraController focus={focusTarget} />

        {/* Ground tarmac (DXF-based) */}
        {layoutData && <Ground bounds={layoutData.bounds} lines={layoutData.lines} />}

        {/* Geofence-driven ground plane (when no DXF) */}
        {!layoutData && geoProj && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
            <planeGeometry args={[geoProj.yardW + 100, geoProj.yardD + 100]} />
            <meshLambertMaterial color="#a89878" />
          </mesh>
        )}

        {/* ── YARD PERIMETER WALL — real outline shape ── */}
        <YardPerimeterWall
          fences={layoutData?.fences}
          cx={cx} cy={cy}
          geoBounds={geofence?.bounds}
          geoProj={geoProj}
        />
        {layoutData && <WallCaps fences={layoutData.fences} cx={cx} cy={cy} />}

        {/* Trees */}
        {layoutData && <TreesInstanced trees={layoutData.trees} cx={cx} cy={cy} />}

        {/* Buildings */}
        {warehouseRings.map((ring, i) => {
          const c2 = polygonCentroid(ring); if (!c2) return null;
          return (
            <group key={`wh-${i}`}>
              <Warehouse ring={ring} cx={cx} cy={cy} />
              <BlockLabel text={`WAREHOUSE ${i + 1}`} position={[c2.x - cx, 16, (c2.y - cy) * -1]} color="#e2e8f0" scale={1.6} />
            </group>
          );
        })}
        {primaryRing && (
          <group>
            <Building ring={primaryRing} cx={cx} cy={cy} color="#5b6776" height={6} />
            <BlockLabel text={primaryLabel} position={[polygonCentroid(primaryRing).x - cx, 9, (polygonCentroid(primaryRing).y - cy) * -1]} color="#fde68a" scale={1.4} />
          </group>
        )}
        {supportRings.map((ring, i) => (
          <Building key={`b-${i}`} ring={ring} cx={cx} cy={cy} color="#465162" height={5} />
        ))}

        {/* ── GEOFENCE-DRIVEN BLOCKS + SLOTS ── */}
        {geofence && geoProj ? (
          <>
            {/* Concrete pads from real geofence bbox */}
            <GeofenceBlockPads geofence={geofence} geoProj={geoProj} onDrillBlock={onDrillBlock} />

            {/* Yellow block borders */}
            <GeofenceBlockBorders geofence={geofence} geoProj={geoProj} />

            {/* Real slot grid lines from geofence polygons */}
            <GeofenceSlotGrid geofence={geofence} geoProj={geoProj} activeBlock={drillBlock} />

            {/* Slot name labels (only when drilled in) */}
            {drillBlock && <SlotLabels geofence={geofence} geoProj={geoProj} activeBlock={drillBlock} />}

            {/* Block name labels (overview) */}
            {!drillBlock && Object.values(geofence.blocks).map(b => {
              const { x, z } = geoProj.toXZ(b.centerLat, b.centerLng);
              return (
                <BlockLabel key={`lbl-${b.id}`} text={b.id} position={[x, 8, z]} color="#60a5fa" scale={1.5} />
              );
            })}
          </>
        ) : (
          <>
            {/* Fallback: DXF-based block rendering */}
            <BlockFoundations blocks={blocksWithMeta} cx={cx} cy={cy} onDrillBlock={onDrillBlock} />
            <BlockPaintBorders blocks={blocksWithMeta} cx={cx} cy={cy} />
            <AllBlockGrids blocks={blocksWithMeta} cx={cx} cy={cy} />

            {!drillBlock && blocksWithMeta.map(b => {
              const bx = b.cx - cx, bz = (b.cy - cy) * -1;
              const zc = b.zone === "Import" ? "#60a5fa" : b.zone === "Export" ? "#f87171" : "#4ade80";
              return <BlockLabel key={`lbl-${b.id}`} text={b.name} position={[bx, 8, bz]} color={zc} scale={syntheticBlocks ? 2.2 : 1.4} />;
            })}
            {drillBlockData && <RowSlotLabels block={drillBlockData} cx={cx} cy={cy} />}
          </>
        )}

        {/* All containers */}
        <ContainersInstanced
          items={containerInstances}
          selectedId={selectedId}
          highlightedIds={highlightedIds}
          onSelect={onSelect}
          onHover={setHover}
        />

        {/* Live Me Avatar */}
        {gpsPos && geoProj && (
          <>
            <LiveMeAvatar geoPos={gpsPos} geoProj={geoProj} />
            <YouLabel geoPos={gpsPos} geoProj={geoProj} />
          </>
        )}
      </Canvas>

      <HoverInfoTooltip hover={hover} />

      {/* GPS Live Location Panel */}
      <div style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 9999,
        background: "rgba(6,14,30,0.92)", border: `1px solid ${gpsWatching ? "#22d3ee" : "#334155"}`,
        borderRadius: 10, padding: "10px 14px", minWidth: 200,
        fontFamily: "'JetBrains Mono', monospace",
        boxShadow: gpsWatching ? "0 0 18px rgba(34,211,238,0.25)" : "none",
        transition: "border-color 0.3s, box-shadow 0.3s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: gpsWatching && gpsPos ? "#22d3ee" : gpsWatching ? "#fbbf24" : "#475569",
            boxShadow: gpsWatching && gpsPos ? "0 0 6px #22d3ee" : "none",
            animation: gpsWatching && !gpsPos ? "pulse 1.2s infinite" : "none",
          }} />
          <span style={{ color: "#e2e8f0", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>MY LOCATION</span>
        </div>
        {!gpsWatching && (
          <button
            onClick={gpsStart}
            style={{
              width: "100%", padding: "6px 0", borderRadius: 6, border: "none",
              background: "linear-gradient(90deg,#0891b2,#2563eb)", color: "#fff",
              fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5,
            }}
          >
            📍 Show My Position
          </button>
        )}
        {gpsWatching && !gpsPos && !gpsError && (
          <div style={{ color: "#fbbf24", fontSize: 10.5 }}>Locating… (enable GPS on device)</div>
        )}
        {gpsWatching && gpsPos && (
          <>
            <div style={{ color: "#22d3ee", fontSize: 10, marginBottom: 2 }}>
              {gpsPos.lat.toFixed(6)}, {gpsPos.lng.toFixed(6)}
            </div>
            <div style={{ color: "#64748b", fontSize: 9.5 }}>±{gpsPos.accuracy}m accuracy</div>
            <button
              onClick={gpsStop}
              style={{
                marginTop: 6, width: "100%", padding: "4px 0", borderRadius: 5,
                border: "1px solid #334155", background: "transparent",
                color: "#94a3b8", fontSize: 10, cursor: "pointer",
              }}
            >
              Stop Tracking
            </button>
          </>
        )}
        {gpsError && (
          <div style={{ color: "#f87171", fontSize: 10 }}>⚠ {gpsError}</div>
        )}
      </div>
    </div>
  );
}
