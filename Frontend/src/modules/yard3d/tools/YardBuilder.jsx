// Yard Builder — interactive editor for the yard's wall chains and building
// boxes, rendered inside the 3D scene. Mirrors RoadPainter's architecture:
// a *Canvas component (ground raycasting, drawn inside <Canvas>) paired with
// a *UI panel (buttons, outside <Canvas>), both controlled from the parent
// page via props so state lives in one place.
//
// Data model (scene XZ, metres):
//   walls:     [{ id, points: [{x,z}, ...] }]   — open or closed polylines
//   buildings: [{ id, x, z, w, d, rotY, label }] — axis-aligned-ish boxes
//
// Edit is segment-level for walls: clicking near a wall selects the single
// edge between its two nearest chain points (not the whole chain).
import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

const WALL_COLOR = "#38bdf8";
const WALL_SELECTED_COLOR = "#fbbf24";
const BUILDING_COLOR = "#a78bfa";
const BUILDING_SELECTED_COLOR = "#fbbf24";
const HIT_TOL = 3; // metres — how close a click must land to a segment/building to select it

let _nextId = 1;
export function newId() { return `yb-${_nextId++}`; }

// ── geometry helpers ────────────────────────────────────────────────────
function distToSegment(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.z - a.z);
  let t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * dx, pz = a.z + t * dz;
  return Math.hypot(p.x - px, p.z - pz);
}

// Find the nearest wall segment to a click point, across all wall chains.
function findNearestSegment(walls, pt, tol = HIT_TOL) {
  let best = null, bestDist = tol;
  for (const wall of walls) {
    for (let i = 0; i < wall.points.length - 1; i++) {
      const d = distToSegment(pt, wall.points[i], wall.points[i + 1]);
      if (d < bestDist) {
        bestDist = d;
        best = { wallId: wall.id, segIndex: i };
      }
    }
  }
  return best;
}

function findNearestBuilding(buildings, pt) {
  for (const b of buildings) {
    const cos = Math.cos(-b.rotY), sin = Math.sin(-b.rotY);
    const dx = pt.x - b.x, dz = pt.z - b.z;
    const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
    if (Math.abs(lx) <= b.w / 2 && Math.abs(lz) <= b.d / 2) return b.id;
  }
  return null;
}

// ── converters: seed from / export to the layout JSON shape ───────────────
export function wallsFromFences(fences) {
  return (fences || []).map(ring => ({
    id: newId(),
    points: ring.map(([x, z]) => ({ x, z })),
  }));
}

export function buildingsFromLayout(buildingRings) {
  // Each ring is an arbitrary polygon in the source layout; approximate as
  // an oriented box (centre + width/depth from its bounding box) so it fits
  // this tool's simpler box model. Precise polygon buildings aren't edited
  // here — this tool is for adding/removing simple structures.
  return (buildingRings || []).map(ring => {
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const [x, z] of ring) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    return {
      id: newId(),
      x: (minX + maxX) / 2, z: (minZ + maxZ) / 2,
      w: Math.max(1, maxX - minX), d: Math.max(1, maxZ - minZ),
      rotY: 0, label: "Building",
    };
  });
}

export function wallsToFences(walls) {
  return walls.map(w => w.points.map(p => [p.x, p.z]));
}

export function buildingsToRings(buildings) {
  return buildings.map(b => {
    const hw = b.w / 2, hd = b.d / 2;
    const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
    const cos = Math.cos(b.rotY), sin = Math.sin(b.rotY);
    return corners.map(([lx, lz]) => [b.x + lx * cos - lz * sin, b.z + lx * sin + lz * cos]);
  });
}

// ── 3D part — renders inside <Canvas> ──────────────────────────────────────
export function YardBuilderCanvas({
  mode, // "off" | "edit" | "draw-wall" | "add-building"
  walls, buildings,
  drawPoints, onAddDrawPoint,
  dragStart, dragCurrent, onDragStart, onDragMove, onDragEnd,
  selection, onSelect,
}) {
  const { camera, raycaster, gl } = useThree();
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const hitPoint = useRef(new THREE.Vector3());

  const raycastGround = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(groundPlane.current, hitPoint.current)) {
      return { x: hitPoint.current.x, z: hitPoint.current.z };
    }
    return null;
  }, [camera, raycaster, gl]);

  // Listen directly on the canvas DOM element rather than via an in-scene
  // mesh's onClick — a mesh-based click-catcher competes with every other
  // clickable object in the scene (block pads, containers) for "closest hit
  // along the ray", and those objects call stopPropagation() in their own
  // handlers, silently swallowing clicks meant for this tool. Listening on
  // the raw DOM element sidesteps the whole scene-graph hit-testing problem.
  const stateRef = useRef({});
  stateRef.current = { mode, walls, buildings, dragStart, onAddDrawPoint, onSelect, onDragStart, onDragMove, onDragEnd };

  useEffect(() => {
    const el = gl.domElement;
    let downPt = null;
    let didDrag = false;

    const onDown = (e) => {
      const { mode } = stateRef.current;
      if (mode !== "add-building") return;
      const pt = raycastGround(e.clientX, e.clientY);
      if (!pt) return;
      downPt = pt;
      didDrag = false;
      stateRef.current.onDragStart(pt);
    };
    const onMove = (e) => {
      const { mode } = stateRef.current;
      if (mode !== "add-building" || !downPt) return;
      const pt = raycastGround(e.clientX, e.clientY);
      if (!pt) return;
      didDrag = true;
      stateRef.current.onDragMove(pt);
    };
    const onUp = () => {
      const { mode } = stateRef.current;
      if (mode !== "add-building" || !downPt) return;
      downPt = null;
      if (didDrag) stateRef.current.onDragEnd();
    };
    const onClick = (e) => {
      const { mode, walls, buildings } = stateRef.current;
      if (mode === "off" || mode === "add-building") return;
      const pt = raycastGround(e.clientX, e.clientY);
      if (!pt) return;

      if (mode === "draw-wall") {
        stateRef.current.onAddDrawPoint(pt);
      } else if (mode === "edit") {
        const seg = findNearestSegment(walls, pt);
        if (seg) { stateRef.current.onSelect({ type: "wall", ...seg }); return; }
        const bId = findNearestBuilding(buildings, pt);
        if (bId) { stateRef.current.onSelect({ type: "building", buildingId: bId }); return; }
        stateRef.current.onSelect(null);
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("click", onClick);
    };
  }, [gl, raycastGround]);

  const wallGeoms = useMemo(() => walls.map(wall => {
    const pts = [];
    for (const p of wall.points) pts.push(new THREE.Vector3(p.x, 0.3, p.z));
    return { id: wall.id, geom: new THREE.BufferGeometry().setFromPoints(pts) };
  }), [walls]);

  const drawGeom = useMemo(() => {
    if (drawPoints.length < 1) return null;
    return new THREE.BufferGeometry().setFromPoints(drawPoints.map(p => new THREE.Vector3(p.x, 0.35, p.z)));
  }, [drawPoints]);

  const dragBox = useMemo(() => {
    if (!dragStart || !dragCurrent) return null;
    return {
      x: (dragStart.x + dragCurrent.x) / 2,
      z: (dragStart.z + dragCurrent.z) / 2,
      w: Math.abs(dragCurrent.x - dragStart.x) || 0.5,
      d: Math.abs(dragCurrent.z - dragStart.z) || 0.5,
    };
  }, [dragStart, dragCurrent]);

  if (mode === "off") return null;

  return (
    <group>
      {/* Existing wall chains */}
      {wallGeoms.map(({ id, geom }) => {
        const isSelectedChain = selection?.type === "wall" && selection.wallId === id;
        return (
          <line key={id} geometry={geom}>
            <lineBasicMaterial color={isSelectedChain ? WALL_SELECTED_COLOR : WALL_COLOR} linewidth={2} transparent opacity={0.85} />
          </line>
        );
      })}

      {/* Highlight the exact selected segment */}
      {selection?.type === "wall" && (() => {
        const wall = walls.find(w => w.id === selection.wallId);
        if (!wall) return null;
        const a = wall.points[selection.segIndex], b = wall.points[selection.segIndex + 1];
        if (!a || !b) return null;
        const geom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(a.x, 0.4, a.z), new THREE.Vector3(b.x, 0.4, b.z),
        ]);
        return (
          <line geometry={geom}>
            <lineBasicMaterial color={WALL_SELECTED_COLOR} linewidth={4} />
          </line>
        );
      })()}

      {/* Buildings */}
      {buildings.map(b => {
        const isSelected = selection?.type === "building" && selection.buildingId === b.id;
        return (
          <mesh key={b.id} position={[b.x, 1, b.z]} rotation={[0, b.rotY, 0]}>
            <boxGeometry args={[b.w, 2, b.d]} />
            <meshBasicMaterial
              color={isSelected ? BUILDING_SELECTED_COLOR : BUILDING_COLOR}
              transparent opacity={isSelected ? 0.55 : 0.35}
            />
          </mesh>
        );
      })}

      {/* In-progress wall drawing */}
      {drawGeom && (
        <line geometry={drawGeom}>
          <lineBasicMaterial color="#22c55e" linewidth={2} />
        </line>
      )}
      {drawPoints.map((p, i) => (
        <mesh key={`dp-${i}`} position={[p.x, 0.4, p.z]}>
          <sphereGeometry args={[0.6, 8, 8]} />
          <meshBasicMaterial color={i === 0 ? "#22c55e" : "#4ade80"} />
        </mesh>
      ))}

      {/* In-progress building drag box */}
      {dragBox && (
        <mesh position={[dragBox.x, 1, dragBox.z]}>
          <boxGeometry args={[dragBox.w, 2, dragBox.d]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.4} />
        </mesh>
      )}
    </group>
  );
}

// ── UI Panel — renders outside <Canvas> ──────────────────────────────────
export function YardBuilderUI({
  mode, setMode,
  walls, setWalls,
  buildings, setBuildings,
  drawPoints, setDrawPoints,
  selection, setSelection,
}) {
  const [saved, setSaved] = useState(false);

  const selectedWall = selection?.type === "wall" ? walls.find(w => w.id === selection.wallId) : null;
  const selectedBuilding = selection?.type === "building" ? buildings.find(b => b.id === selection.buildingId) : null;

  const finishDrawWall = () => {
    if (drawPoints.length >= 2) {
      setWalls(ws => [...ws, { id: newId(), points: drawPoints }]);
    }
    setDrawPoints([]);
    setMode("edit");
  };
  const cancelDraw = () => { setDrawPoints([]); setMode("edit"); };
  const undoDrawPoint = () => setDrawPoints(p => p.slice(0, -1));

  // Break: insert a new point at the click's segment midpoint isn't quite
  // right — break at the exact selected segment's midpoint, splitting the
  // chain into two separate wall entries at that point.
  const breakSelectedSegment = () => {
    if (!selectedWall || selection.type !== "wall") return;
    const i = selection.segIndex;
    const a = selectedWall.points[i], b = selectedWall.points[i + 1];
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    const before = selectedWall.points.slice(0, i + 1).concat([mid]);
    const after = [mid].concat(selectedWall.points.slice(i + 1));
    setWalls(ws => ws.filter(w => w.id !== selectedWall.id).concat([
      { id: newId(), points: before },
      { id: newId(), points: after },
    ]));
    setSelection(null);
  };

  // Remove the selected segment: cuts the chain there. A middle segment
  // splits the chain into two (with a gap); an end segment just shortens it.
  const removeSelectedSegment = () => {
    if (!selectedWall || selection.type !== "wall") return;
    const i = selection.segIndex;
    const before = selectedWall.points.slice(0, i + 1);
    const after = selectedWall.points.slice(i + 1);
    const next = [];
    if (before.length >= 2) next.push({ id: newId(), points: before });
    if (after.length >= 2) next.push({ id: newId(), points: after });
    setWalls(ws => ws.filter(w => w.id !== selectedWall.id).concat(next));
    setSelection(null);
  };

  const removeSelectedWallChain = () => {
    if (!selectedWall) return;
    setWalls(ws => ws.filter(w => w.id !== selectedWall.id));
    setSelection(null);
  };

  const removeSelectedBuilding = () => {
    if (!selectedBuilding) return;
    setBuildings(bs => bs.filter(b => b.id !== selectedBuilding.id));
    setSelection(null);
  };

  // Merge: joins the two wall chains whose closest endpoints are nearest to
  // each other, among ALL chains (not just the selected one) — simplest
  // reliable behaviour: pick the globally closest pair of open endpoints.
  const MERGE_TOL = 15; // metres
  const mergeNearestWalls = () => {
    let best = null, bestDist = MERGE_TOL;
    for (let i = 0; i < walls.length; i++) {
      for (let j = 0; j < walls.length; j++) {
        if (i === j) continue;
        const a = walls[i], b = walls[j];
        const aEnd = a.points[a.points.length - 1];
        const bStart = b.points[0];
        const d = Math.hypot(aEnd.x - bStart.x, aEnd.z - bStart.z);
        if (d < bestDist) { bestDist = d; best = { i, j }; }
      }
    }
    if (!best) return;
    const a = walls[best.i], b = walls[best.j];
    const merged = { id: newId(), points: a.points.concat(b.points) };
    setWalls(ws => ws.filter((_, idx) => idx !== best.i && idx !== best.j).concat([merged]));
    setSelection(null);
  };

  const exportJson = () => {
    const json = JSON.stringify({
      fences: wallsToFences(walls),
      buildings: buildingsToRings(buildings),
    }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "yard_builder_layout.json";
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const modeBtn = (key, label) => (
    <button
      onClick={() => { setMode(key); setSelection(null); if (key !== "draw-wall") setDrawPoints([]); }}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
        mode === key ? "bg-yellow-400 text-gray-900" : "bg-gray-700 text-white hover:bg-gray-600"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 bg-gray-900/95 border border-sky-400/40 rounded-2xl px-4 py-3 shadow-2xl backdrop-blur max-w-[95vw]">
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <span className="text-sky-400 font-bold text-sm mr-1">🏗 Yard Builder</span>
        <span className="text-white/60 text-xs mr-2">{walls.length} walls · {buildings.length} buildings</span>

        {modeBtn("off", "Off")}
        {modeBtn("edit", "Select/Edit")}
        {modeBtn("draw-wall", "Draw Wall")}
        {modeBtn("add-building", "Add Building")}

        <button onClick={exportJson}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-700 text-white hover:bg-green-600">
          ↓ Export JSON
        </button>
        {saved && <span className="text-green-400 text-xs font-bold animate-pulse">✓ Saved!</span>}
      </div>

      {mode === "draw-wall" && (
        <div className="flex items-center gap-2 text-xs text-white/70">
          <span>{drawPoints.length} points — click ground to add, click again near a point to finish nearby</span>
          <button onClick={undoDrawPoint} disabled={!drawPoints.length}
            className="px-2 py-1 rounded bg-gray-700 text-white disabled:opacity-30">↩ Undo</button>
          <button onClick={finishDrawWall} disabled={drawPoints.length < 2}
            className="px-2 py-1 rounded bg-green-700 text-white disabled:opacity-30">✓ Finish Wall</button>
          <button onClick={cancelDraw} className="px-2 py-1 rounded bg-red-900/60 text-red-300">✕ Cancel</button>
        </div>
      )}

      {mode === "edit" && selection?.type === "wall" && selectedWall && (
        <div className="flex items-center gap-2 text-xs text-white/70">
          <span>Wall segment selected ({selectedWall.points.length} pts in chain)</span>
          <button onClick={breakSelectedSegment} className="px-2 py-1 rounded bg-amber-700 text-white">✂ Break Here</button>
          <button onClick={removeSelectedSegment} className="px-2 py-1 rounded bg-red-900/60 text-red-300">✕ Remove Segment</button>
          <button onClick={removeSelectedWallChain} className="px-2 py-1 rounded bg-red-900/80 text-red-200">✕ Remove Whole Wall</button>
        </div>
      )}

      {mode === "edit" && (
        <div className="flex items-center gap-2 text-xs text-white/70">
          <button onClick={mergeNearestWalls} disabled={walls.length < 2}
            className="px-2 py-1 rounded bg-blue-700 text-white disabled:opacity-30">
            🔗 Merge Nearest Endpoints (≤{MERGE_TOL}m)
          </button>
        </div>
      )}

      {mode === "edit" && selection?.type === "building" && selectedBuilding && (
        <div className="flex items-center gap-2 text-xs text-white/70">
          <span>Building selected ({selectedBuilding.w.toFixed(1)}×{selectedBuilding.d.toFixed(1)}m)</span>
          <button onClick={removeSelectedBuilding} className="px-2 py-1 rounded bg-red-900/60 text-red-300">✕ Remove Building</button>
        </div>
      )}

      {mode === "add-building" && (
        <div className="text-xs text-white/70">Click-drag on the ground to draw a building footprint</div>
      )}
    </div>
  );
}
