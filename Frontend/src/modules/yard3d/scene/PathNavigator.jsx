/**
 * PathNavigator — realistic yard navigation.
 *
 * • Computes the AISLE ENTRANCE of the target block — character never
 *   steps inside a container block.
 * • BFS grid pathfinding through aisles only.
 * • Hi-vis worker with swinging arms + legs.
 * • Camera follows from behind.
 * • Requires a real GPS-derived startPos (null → no render).
 */
import React, { useRef, useMemo, useState, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { aStarPath } from "../nav/astar";
import AnimatedRoute from "../nav/AnimatedRoute";
import CharacterController from "../nav/CharacterController";
import Character from "../nav/Character";
import CameraController from "../nav/CameraController";
import Footsteps from "../nav/Footsteps";
import { useNavigation } from "../nav/navStore";

// ─── Constants ────────────────────────────────────────────────────────────────
const WALK_SPEED    = 6;    // m/s in scene units
const GRID_CELL     = 4;    // metres per BFS cell
const BLOCK_MARGIN  = 1.5;  // inflate obstacles for aisle-center routing
const ENTRANCE_DIST = 4.0;  // stop this far outside the block face (in the aisle)
const ARRIVE_DIST   = 2.5;  // trigger "arrived" within this many metres of entrance
const CAM_OFFSET    = new THREE.Vector3(0, 14, 18);

// ─── Find the nearest aisle point outside the target block ───────────────────
// The character stops here (on concrete), never enters the block.
function findBlockEntrance(start, target, blockBBoxes) {
  // Find which block the target slot sits inside
  const block = blockBBoxes.find(b =>
    target.x >= b.minX && target.x <= b.maxX &&
    target.z >= b.minZ && target.z <= b.maxZ
  );
  if (!block) return target;   // target not in any block → use as-is

  // Distance from start to each of the four block faces
  const dLeft  = Math.abs(start.x - block.minX);
  const dRight = Math.abs(start.x - block.maxX);
  const dFront = Math.abs(start.z - block.minZ);
  const dBack  = Math.abs(start.z - block.maxZ);
  const minD   = Math.min(dLeft, dRight, dFront, dBack);

  // Clamp the aisle point so it's aligned with the actual face extent
  const clampZ = z => Math.max(block.minZ, Math.min(block.maxZ, z));
  const clampX = x => Math.max(block.minX, Math.min(block.maxX, x));

  if (minD === dLeft)  return { x: block.minX - ENTRANCE_DIST, z: clampZ(target.z) };
  if (minD === dRight) return { x: block.maxX + ENTRANCE_DIST, z: clampZ(target.z) };
  if (minD === dFront) return { x: clampX(target.x), z: block.minZ - ENTRANCE_DIST };
  /* dBack */          return { x: clampX(target.x), z: block.maxZ + ENTRANCE_DIST };
}

// A* replaces the previous BFS — keeps the same signature so the rest of
// the component does not change. When a roadMask is provided the
// character will prefer to walk inside DXF ROAD polygons.
function computeAislePath(start, target, blockBBoxes, roadMask) {
  return aStarPath(start, target, blockBBoxes, { cell: GRID_CELL, margin: BLOCK_MARGIN, roadMask });
}

// Kept around for emergency fallback / comparison; not used.
// eslint-disable-next-line no-unused-vars
function computeAislePathBFS(start, target, blockBBoxes) {
  if (!blockBBoxes || blockBBoxes.length === 0) return [start, target];

  const obs = blockBBoxes.map(b => ({
    minX: b.minX - BLOCK_MARGIN, maxX: b.maxX + BLOCK_MARGIN,
    minZ: b.minZ - BLOCK_MARGIN, maxZ: b.maxZ + BLOCK_MARGIN,
  }));
  const isObs = (x, z) => obs.some(b => x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ);

  const pad  = GRID_CELL * 8;
  const allX = [start.x, target.x, ...blockBBoxes.flatMap(b => [b.minX, b.maxX])];
  const allZ = [start.z, target.z, ...blockBBoxes.flatMap(b => [b.minZ, b.maxZ])];
  const gX0  = Math.min(...allX) - pad;
  const gZ0  = Math.min(...allZ) - pad;
  const cols = Math.ceil((Math.max(...allX) - gX0 + pad) / GRID_CELL) + 1;
  const rows = Math.ceil((Math.max(...allZ) - gZ0 + pad) / GRID_CELL) + 1;

  const toCell = p => ({
    c: Math.max(0, Math.min(cols - 1, Math.round((p.x - gX0) / GRID_CELL))),
    r: Math.max(0, Math.min(rows - 1, Math.round((p.z - gZ0) / GRID_CELL))),
  });
  const toWorld = (c, r) => ({ x: gX0 + c * GRID_CELL, z: gZ0 + r * GRID_CELL });
  const idx = (c, r) => r * cols + c;

  const sc = toCell(start), tc = toCell(target);
  const ti = idx(tc.c, tc.r);
  const vis = new Uint8Array(rows * cols);
  const par = new Int32Array(rows * cols).fill(-1);
  const q = [];
  vis[idx(sc.c, sc.r)] = 1;
  q.push(idx(sc.c, sc.r));

  const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let found = false;

  outer: while (q.length) {
    const cur = q.shift();
    if (cur === ti) { found = true; break; }
    const cc = cur % cols, cr = Math.floor(cur / cols);
    for (const [dc, dr] of DIRS) {
      const nc = cc + dc, nr = cr + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const ni = idx(nc, nr);
      if (vis[ni]) continue;
      vis[ni] = 1;
      const w = toWorld(nc, nr);
      if (isObs(w.x, w.z)) continue;
      par[ni] = cur;
      if (ni === ti) { found = true; break outer; }
      q.push(ni);
    }
  }

  if (!found) return [start, target];

  const raw = [];
  let cur = ti;
  while (cur !== -1) {
    raw.unshift(toWorld(cur % cols, Math.floor(cur / cols)));
    cur = par[cur];
  }
  return stringPull([start, ...raw, target], isObs);
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

function lineOfSight(a, b, isObs, steps = 12) {
  for (let t = 1; t < steps; t++) {
    const f = t / steps;
    if (isObs(a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f)) return false;
  }
  return true;
}

// ─── Path line + arrows ───────────────────────────────────────────────────────
function GroundPath({ waypoints, entrancePos }) {
  const { lineGeom, arrowData } = useMemo(() => {
    if (!waypoints || waypoints.length < 2) return { lineGeom: null, arrowData: [] };
    const pts = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i], b = waypoints[i + 1];
      const steps = Math.max(4, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 2));
      for (let t = 0; t < steps; t++) {
        const f = t / steps;
        pts.push(new THREE.Vector3(a.x + (b.x - a.x) * f, 0.12, a.z + (b.z - a.z) * f));
      }
    }
    pts.push(new THREE.Vector3(waypoints[waypoints.length - 1].x, 0.12, waypoints[waypoints.length - 1].z));
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const arrows = [];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      acc += pts[i].distanceTo(pts[i - 1]);
      if (acc >= 8) {
        acc = 0;
        const dir = new THREE.Vector3().subVectors(pts[i], pts[i - 1]).normalize();
        arrows.push({ pos: pts[i].clone(), angle: Math.atan2(dir.x, dir.z) });
      }
    }
    return { lineGeom: geom, arrowData: arrows };
  }, [waypoints]);

  if (!lineGeom) return null;
  const start = waypoints[0];
  const end   = entrancePos; // show destination marker at aisle entrance

  return (
    <group>
      {/* Glow */}
      <line geometry={lineGeom}>
        <lineBasicMaterial color="#0ea5e9" transparent opacity={0.35} depthWrite={false} />
      </line>
      {/* Core */}
      <line geometry={lineGeom}>
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.95} depthWrite={false} />
      </line>
      {/* Direction arrows */}
      {arrowData.map((a, i) => (
        <mesh key={i} position={[a.pos.x, 0.18, a.pos.z]} rotation={[0, a.angle, 0]}>
          <coneGeometry args={[0.5, 1.1, 5]} />
          <meshBasicMaterial color="#0ea5e9" transparent opacity={0.85} depthWrite={false} />
        </mesh>
      ))}
      {/* Start ring (blue) */}
      <mesh position={[start.x, 0.18, start.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 0.95, 18]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      {/* Destination — at AISLE ENTRANCE (green pin on concrete) */}
      <mesh position={[end.x, 0.2, end.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.05, 1.65, 18]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh position={[end.x, 3.0, end.z]}>
        <cylinderGeometry args={[0.15, 0.15, 6.0, 6]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.8} depthWrite={false} />
      </mesh>
      <mesh position={[end.x, 6.45, end.z]}>
        <coneGeometry args={[0.78, 1.5, 5]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.95} depthWrite={false} />
      </mesh>
      <mesh position={[end.x, 0.15, end.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.75, 20]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.1} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─── Arrived marker (glowing rings on the aisle) ─────────────────────────────
function ArrivedMarker({ pos }) {
  const t = useRef(0);
  const r1 = useRef(), r2 = useRef(), r3 = useRef();
  useFrame((_, dt) => {
    t.current += dt;
    const s = 1 + 0.12 * Math.sin(t.current * 3);
    [r1, r2, r3].forEach(r => { if (r.current) r.current.scale.setScalar(s); });
  });
  return (
    <group position={[pos.x, 0.18, pos.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={r1}><ringGeometry args={[0.5, 0.8, 20]} /><meshBasicMaterial color="#22c55e" transparent opacity={0.85} depthWrite={false} /></mesh>
      <mesh ref={r2} scale={1.6}><ringGeometry args={[0.5, 0.7, 20]} /><meshBasicMaterial color="#22c55e" transparent opacity={0.45} depthWrite={false} /></mesh>
      <mesh ref={r3} scale={2.4}><ringGeometry args={[0.5, 0.65, 20]} /><meshBasicMaterial color="#4ade80" transparent opacity={0.22} depthWrite={false} /></mesh>
    </group>
  );
}

// ─── Worker character ─────────────────────────────────────────────────────────
const M_HAT    = { color: "#ffcc00", roughness: 0.35 };
const M_VEST   = { color: "#ea5f00", roughness: 0.5, emissive: "#280e00", emissiveIntensity: 0.15 };
const M_REF    = { color: "#ffffaa", emissive: "#cccc00", emissiveIntensity: 0.9 };
const M_PANTS  = { color: "#1a3050", roughness: 0.7 };
const M_BOOT   = { color: "#111111", roughness: 0.85 };
const M_SKIN   = { color: "#f2c27a", roughness: 0.65 };

function WalkingWorker({ posRef, facingRef, walking }) {
  const root = useRef(), legL = useRef(), legR = useRef();
  const armL = useRef(), armR = useRef(), body = useRef();
  const t = useRef(0);

  useFrame((_, dt) => {
    if (!root.current) return;
    root.current.position.copy(posRef.current);
    root.current.rotation.y = facingRef.current;
    if (!walking) return;
    t.current += dt * 5.5;
    const sw = Math.sin(t.current);
    if (legL.current) legL.current.rotation.x =  sw * 0.52;
    if (legR.current) legR.current.rotation.x = -sw * 0.52;
    if (armL.current) armL.current.rotation.x = -sw * 0.38;
    if (armR.current) armR.current.rotation.x =  sw * 0.38;
    if (body.current) body.current.rotation.z = Math.sin(t.current * 0.5) * 0.025;
    root.current.position.y = posRef.current.y + Math.abs(sw) * 0.1;
  });

  return (
    <group ref={root}>
      {/* Hard hat */}
      <mesh position={[0, 2.05, 0]}><cylinderGeometry args={[0.3, 0.36, 0.13, 12]} /><meshStandardMaterial {...M_HAT} /></mesh>
      <mesh position={[0, 2.15, 0]}><sphereGeometry args={[0.28, 12, 8, 0, Math.PI*2, 0, Math.PI*0.52]} /><meshStandardMaterial {...M_HAT} /></mesh>
      <mesh position={[0, 2.02, 0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.29,0.42,16]} /><meshStandardMaterial {...M_HAT} /></mesh>
      {/* Head */}
      <mesh position={[0, 1.76, 0]}><sphereGeometry args={[0.19, 10, 9]} /><meshStandardMaterial {...M_SKIN} /></mesh>
      {/* Body */}
      <group ref={body}>
        <mesh position={[0, 1.14, 0]}><boxGeometry args={[0.44, 0.72, 0.26]} /><meshStandardMaterial {...M_VEST} /></mesh>
        <mesh position={[0, 1.24, 0.14]}><boxGeometry args={[0.42, 0.065, 0.02]} /><meshStandardMaterial {...M_REF} /></mesh>
        <mesh position={[0, 1.08, 0.14]}><boxGeometry args={[0.42, 0.065, 0.02]} /><meshStandardMaterial {...M_REF} /></mesh>
      </group>
      {/* Arms */}
      <group ref={armL} position={[-0.30, 1.48, 0]}>
        <mesh position={[0,-0.26,0]}><capsuleGeometry args={[0.075,0.46,4,7]} /><meshStandardMaterial {...M_VEST} /></mesh>
        <mesh position={[0,-0.55,0]}><sphereGeometry args={[0.085,8,6]} /><meshStandardMaterial color="#222" roughness={0.8} /></mesh>
      </group>
      <group ref={armR} position={[0.30, 1.48, 0]}>
        <mesh position={[0,-0.26,0]}><capsuleGeometry args={[0.075,0.46,4,7]} /><meshStandardMaterial {...M_VEST} /></mesh>
        <mesh position={[0,-0.55,0]}><sphereGeometry args={[0.085,8,6]} /><meshStandardMaterial color="#222" roughness={0.8} /></mesh>
      </group>
      {/* Legs */}
      <group ref={legL} position={[-0.14, 0.82, 0]}>
        <mesh position={[0,-0.38,0]}><capsuleGeometry args={[0.09,0.62,4,8]} /><meshStandardMaterial {...M_PANTS} /></mesh>
        <mesh position={[0,-0.74,0.06]}><boxGeometry args={[0.15,0.13,0.26]} /><meshStandardMaterial {...M_BOOT} /></mesh>
      </group>
      <group ref={legR} position={[0.14, 0.82, 0]}>
        <mesh position={[0,-0.38,0]}><capsuleGeometry args={[0.09,0.62,4,8]} /><meshStandardMaterial {...M_PANTS} /></mesh>
        <mesh position={[0,-0.74,0.06]}><boxGeometry args={[0.15,0.13,0.26]} /><meshStandardMaterial {...M_BOOT} /></mesh>
      </group>
      {/* Shadow */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.96,0]}>
        <circleGeometry args={[0.38, 14]} />
        <meshBasicMaterial color="#000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─── Travelling point light ───────────────────────────────────────────────────
function TravelLight({ posRef }) {
  const ref = useRef();
  useFrame(() => {
    if (ref.current) {
      ref.current.position.set(posRef.current.x, posRef.current.y + 4, posRef.current.z);
    }
  });
  return <pointLight ref={ref} intensity={5} distance={15} color="#ffe4b0" />;
}

// ─── Camera follower ──────────────────────────────────────────────────────────
const _look = new THREE.Vector3();
const _cam  = new THREE.Vector3();

function CameraFollower({ posRef, controlsRef, active }) {
  const { camera } = useThree();
  useFrame((_, dt) => {
    if (!active) return;
    const p = posRef.current;
    _cam.set(p.x - CAM_OFFSET.x, p.y + CAM_OFFSET.y, p.z + CAM_OFFSET.z);
    camera.position.lerp(_cam, Math.min(1, dt * 4));
    _look.set(p.x, p.y + 1.5, p.z);
    if (controlsRef?.current) {
      controlsRef.current.target.lerp(_look, Math.min(1, dt * 4));
      controlsRef.current.update();
    } else {
      camera.lookAt(_look);
    }
  });
  return null;
}

// ─── Main PathNavigator ───────────────────────────────────────────────────────
export default function PathNavigator({
  startPos,       // { x, z } — real GPS position in scene space (never null here)
  targetPos,      // { x, z } — container slot scene position (inside block)
  blockBBoxes,    // [{ minX, maxX, minZ, maxZ }]
  roadMask,       // optional walkable mask from DXF ROAD layer
  active,
  walking,        // false = show path preview only; true = character walks
  onArrived,
  controlsRef,
}) {
  // Step 1: find where the aisle entrance is (outside the block)
  const entrancePos = useMemo(
    () => findBlockEntrance(startPos, targetPos, blockBBoxes || []),
    [startPos?.x, startPos?.z, targetPos?.x, targetPos?.z, blockBBoxes] // eslint-disable-line
  );

  // Step 2: BFS path from start → aisle entrance (stays on concrete)
  const waypoints = useMemo(
    () => active ? computeAislePath(startPos, entrancePos, blockBBoxes, roadMask) : [],
    [active, entrancePos?.x, entrancePos?.z, roadMask] // eslint-disable-line
  );

  const arrivedFlag = useNavigation(s => s.arrived);
  const posRef = useNavigation(s => s.posRef);

  // Full waypoint list, memoised so identity is stable across renders.
  // Without this, every parent re-render produced a new array which
  // re-fired CharacterController's "reset on new route" effect and
  // teleported the character back to start mid-walk.
  const fullPath = useMemo(() => {
    if (!waypoints.length) return [];
    const tail = waypoints.filter((w, i) => i > 0 || w.x !== startPos.x || w.z !== startPos.z);
    return [startPos, ...tail];
  }, [waypoints, startPos?.x, startPos?.z]); // eslint-disable-line

  // Stable signature used as the route-reset key — primitive deps only.
  const routeKey = useMemo(() => {
    if (!fullPath.length) return "";
    const last = fullPath[fullPath.length - 1];
    return `${fullPath.length}|${startPos?.x?.toFixed(1)}|${startPos?.z?.toFixed(1)}|${last.x.toFixed(1)}|${last.z.toFixed(1)}`;
  }, [fullPath, startPos?.x, startPos?.z]);

  if (!active || waypoints.length === 0) return null;

  return (
    <>
      <AnimatedRoute waypoints={waypoints} entrancePos={entrancePos} />

      <CharacterController
        waypoints={fullPath}
        startPos={startPos}
        routeKey={routeKey}
        active={active}
        walking={walking && !arrivedFlag}
        onArrived={onArrived}
      />
      <Character />
      <Footsteps />

      {arrivedFlag && <ArrivedMarker pos={entrancePos} />}
      <TravelLight posRef={posRef} />

      <CameraController controlsRef={controlsRef} blockBBoxes={blockBBoxes} />
    </>
  );
}
