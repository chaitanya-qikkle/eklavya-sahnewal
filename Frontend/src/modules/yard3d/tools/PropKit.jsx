// Placeable yard props — the palette + the geometry for everything in it.
//
// Every prop lives purely in the drawing's CAD metres, in the shared
// `edits.props` list, so undo/redo, save/copy and `--edits=` baking all work
// on it exactly the way they already do for walls and masts.
//
//   point    prop  { type, x, y, rot }                 — one click
//   polyline prop  { type, points: [[x,y], …] }         — road/fence/rail: click each vertex
//   polygon  prop  { type, points: [[x,y], …], h }      — buildings: click each corner
//
// Drawing vertex-by-vertex (rather than a screen-space corner drag) keeps a
// building's real-world size exactly what was clicked on the ground, no
// matter how oblique the camera is — a fixed number of screen pixels covers
// wildly different ground distances near vs. far from the camera, so a
// two-click diagonal drag is not trustworthy for placement.
//
// v2 realism pass:
//   • Each building type is its own component (the old single component
//     called useMemo inside `if (p.type === …)` branches — a rules-of-hooks
//     violation that breaks the moment a prop's type is edited in place).
//   • Deterministic per-prop variation (seeded off world position) so two
//     trees / cars / containers never look identical, yet never flicker
//     between renders.
//   • Roads got curbs, real dashed centre-lines and joint discs at every
//     vertex so bends don't show seams; parking lanes got bay tick marks.
//   • Rail got a ballast bed; fences got chain-link mesh + barbed-wire arms.
//   • Buildings got parapets, rooftop plant (HVAC, tanks, vents), entrance
//     doors + canopies, roller shutters on sheds, stair bulkheads on
//     residential blocks.
//   • New props: truck, car, forklift, shipping container (+2-high stack),
//     solar array, CCTV pole, bench, shrub, hedge line, compound wall.

import React, { useMemo, Suspense } from "react";
import * as THREE from "three";
import { Html, useGLTF } from "@react-three/drei";
import { dxfPointToScene } from "../scene/geofence";
import {
    makeAsphaltTex, makeWallTex, makeBuildingWallTex,
} from "../scene/YardScene";
import WarehouseModel from "../scene/WarehouseModel";
import IndustrialWallPanel, { WALL_TOTAL_H } from "../scene/IndustrialWallPanel";

// Each generator draws its canvas once and is reused everywhere; every call
// site clones it (cheap — shares the canvas, not the GPU upload) and sets its
// own `.repeat` so the pattern tiles at true scale whether it's stretched
// across a 2 m fence post gap or a 200 m boundary wall.
const TEX_CACHE = {};
function tiledTex(key, factory, repeatX, repeatY) {
    if (!TEX_CACHE[key]) TEX_CACHE[key] = factory();
    const t = TEX_CACHE[key].clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(Math.max(0.5, repeatX), Math.max(0.5, repeatY));
    return t;
}

// ── palette ──────────────────────────────────────────────────────────────
export const PROP_CATEGORIES = [
    {
        id: "quickbuild", label: "Quick building (click 2 corners)", items: [
            { type: "building", label: "Building", footprint: "rect", h: 6, color: "#c9cfd8" },
            { type: "workshop", label: "Workshop", footprint: "rect", h: 7, color: "#b7bfc9" },
            { type: "office_glass", label: "Commercial — glass tower", footprint: "rect", h: 22, color: "#aad0e0" },
            { type: "office_concrete", label: "Commercial — office block", footprint: "rect", h: 14, color: "#cfc9bc" },
            { type: "residential", label: "Residential block", footprint: "rect", h: 12, color: "#c9a688" },
            { type: "factory", label: "Industrial — factory shed", footprint: "rect", h: 8, color: "#9aa7b0" },
        ],
    },
    {
        id: "structures", label: "Custom footprint (click each corner)", items: [
            { type: "warehouse", label: "Warehouse (gable)", footprint: "polygon", h: 9, color: "#ccd1d9" },
            { type: "glass_building", label: "Glass building", footprint: "polygon", h: 12, color: "#9fc4d8" },
            { type: "cabin", label: "Site cabin", footprint: "polygon", h: 3, color: "#cdbf8e" },
            { type: "building_custom", label: "Building (custom shape)", footprint: "polygon", h: 6, color: "#c9cfd8" },
            { type: "workshop_custom", label: "Workshop (custom shape)", footprint: "polygon", h: 7, color: "#b7bfc9" },
        ],
    },
    {
        id: "paving", label: "Roads & paving (draw line)", items: [
            { type: "road", label: "Road", footprint: "polyline", width: 7 },
            { type: "parking", label: "Parking lane", footprint: "polyline", width: 3.5 },
            { type: "footpath", label: "Footpath", footprint: "polyline", width: 1.8 },
            { type: "rail", label: "Rail line", footprint: "polyline", width: 1.5 },
        ],
    },
    {
        id: "rail", label: "Rail wagons (place along rail line)", items: [
            { type: "wagon", label: "Wagon — loaded (1× 40ft container)", footprint: "point" },
            { type: "wagon_double", label: "Wagon — loaded (2× 20ft containers)", footprint: "point" },
            { type: "wagon_empty", label: "Wagon — empty flatcar", footprint: "point" },
        ],
    },
    {
        id: "boundary", label: "Boundary", items: [
            { type: "fence", label: "Fence (chain-link)", footprint: "polyline", width: 0.12 },
            { type: "compound_wall", label: "Compound wall", footprint: "polyline", width: 0.3 },
            { type: "security_wall", label: "Security wall (GLB)", footprint: "polyline", width: 0.4, h: 3 },
            { type: "hedge", label: "Hedge", footprint: "polyline", width: 0.9 },
            { type: "guardhouse", label: "Guard house + boom", footprint: "point" },
            { type: "gate", label: "Entry gate", footprint: "point" },
            { type: "gate_boom", label: "Boom barrier", footprint: "point" },
            { type: "gate_in", label: "Vehicle gate — IN", footprint: "point" },
            { type: "gate_out", label: "Vehicle gate — OUT", footprint: "point" },
        ],
    },
    {
        id: "vehicles", label: "Vehicles & cargo", items: [
            { type: "truck", label: "Truck (container trailer)", footprint: "point" },
            { type: "car", label: "Car", footprint: "point" },
            { type: "forklift", label: "Forklift", footprint: "point" },
            { type: "container", label: "Shipping container", footprint: "point" },
            { type: "container_stack", label: "Container stack ×2", footprint: "point" },
        ],
    },
    {
        id: "utilities", label: "Utilities", items: [
            { type: "light_pole", label: "Light pole", footprint: "point" },
            { type: "water_tank", label: "Water tank", footprint: "point" },
            { type: "transformer", label: "Transformer", footprint: "point" },
            { type: "dg_set", label: "DG set", footprint: "point" },
            { type: "solar_array", label: "Solar array", footprint: "point" },
            { type: "cctv", label: "CCTV pole", footprint: "point" },
            { type: "flagpole", label: "Flag pole", footprint: "point" },
        ],
    },
    {
        id: "landscape", label: "Landscaping", items: [
            { type: "tree", label: "Tree", footprint: "point" },
            { type: "shrub", label: "Shrub", footprint: "point" },
            { type: "planter", label: "Planter box", footprint: "point" },
            { type: "bench", label: "Bench", footprint: "point" },
        ],
    },
];

export const PROP_SPECS = {
    ...Object.fromEntries(PROP_CATEGORIES.flatMap(c => c.items.map(it => [it.type, it]))),
    // Uploaded GLB models (see CustomModelProp below) — deliberately not in
    // PROP_CATEGORIES since there's no single palette button for it: each
    // instance needs its own `modelUrl`, picked from the "Custom Models"
    // list in the Yard Builder panel instead of the type grid.
    custom_model: { type: "custom_model", label: "Custom Model", footprint: "point", h: 4, color: "#9aa5b1" },
};

// ── shared geometry helpers ─────────────────────────────────────────────
function ringArea(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
        const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
        a += x1 * z2 - x2 * z1;
    }
    return Math.abs(a) / 2;
}
function ringCentroid(pts) {
    let x = 0, z = 0;
    for (const p of pts) { x += p[0]; z += p[1]; }
    return [x / pts.length, z / pts.length];
}
// Principal axis angle (radians) of a point cloud — used to lay a gable roof
// ridge along a warehouse's long side however it was drawn.
function principalAxis(pts) {
    const [mx, mz] = ringCentroid(pts);
    let sxx = 0, sxz = 0, szz = 0;
    for (const [x, z] of pts) { const a = x - mx, b = z - mz; sxx += a * a; sxz += a * b; szz += b * b; }
    return 0.5 * Math.atan2(2 * sxz, sxx - szz);
}
function orientedExtent(pts, angle) {
    const co = Math.cos(-angle), si = Math.sin(-angle);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    const [mx, mz] = ringCentroid(pts);
    for (const [x, z] of pts) {
        const a = x - mx, b = z - mz;
        const u = a * co - b * si, v = a * si + b * co;
        if (u < u0) u0 = u; if (u > u1) u1 = u;
        if (v < v0) v0 = v; if (v > v1) v1 = v;
    }
    return { len: u1 - u0, width: v1 - v0, cx: mx, cz: mz };
}
function longestEdge(ring) {
    let best = null;
    for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (!best || len > best.len) best = { len, a, b };
    }
    if (!best) return null;
    return {
        mx: (best.a[0] + best.b[0]) / 2,
        mz: (best.a[1] + best.b[1]) / 2,
        rot: Math.atan2(-(best.b[1] - best.a[1]), best.b[0] - best.a[0]),
        len: best.len,
    };
}
function scaleRingAbout(ring, s) {
    if (s === 1) return ring;
    const [cx, cz] = ringCentroid(ring);
    return ring.map(([x, z]) => [cx + (x - cx) * s, cz + (z - cz) * s]);
}

// Deterministic 0..1 "random" from a world position + salt: props vary from
// one another but never flicker between renders or after undo/redo, because
// the same coordinates always hash to the same value.
function hash01(x, z, salt = 0) {
    const s = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453;
    return s - Math.floor(s);
}

// Thin strip along every edge of the ring at a given height — used for both
// the glass-tower's floor bands and the office block's ribbon windows.
function edgeBands(ring, ys, budget = 120) {
    const out = [];
    for (const y of ys) {
        for (let i = 0; i < ring.length && out.length < budget; i++) {
            const a = ring[i], b = ring[(i + 1) % ring.length];
            const dx = b[0] - a[0], dz = b[1] - a[1];
            const len = Math.hypot(dx, dz);
            if (len < 0.5) continue;
            out.push({ y, mx: (a[0] + b[0]) / 2, mz: (a[1] + b[1]) / 2, rot: Math.atan2(-dz, dx), len });
        }
    }
    return out;
}
// Small projecting boxes evenly spaced along every edge at each floor level.
function balconyPoints(ring, ys, spacing = 4, budget = 120) {
    const out = [];
    for (const y of ys) {
        for (let i = 0; i < ring.length && out.length < budget; i++) {
            const a = ring[i], b = ring[(i + 1) % ring.length];
            const dx = b[0] - a[0], dz = b[1] - a[1];
            const len = Math.hypot(dx, dz);
            if (len < spacing) continue;
            const n = Math.max(1, Math.round(len / spacing));
            const rot = Math.atan2(-dz, dx);
            for (let k = 0; k < n && out.length < budget; k++) {
                const t = (k + 0.5) / n;
                out.push({ y, x: a[0] + dx * t, z: a[1] + dz * t, rot });
            }
        }
    }
    return out;
}
// Vertical mullion strips every `every` metres along each edge.
function mullionPoints(ring, every, budget = 100) {
    const out = [];
    let left = budget;
    for (let i = 0; i < ring.length && left > 0; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const dx = b[0] - a[0], dz = b[1] - a[1];
        const len = Math.hypot(dx, dz);
        if (len < 0.5) continue;
        const n = Math.max(1, Math.min(left, Math.round(len / every)));
        const rot = Math.atan2(-dz, dx);
        for (let k = 1; k < n; k++) { out.push({ x: a[0] + (dx * k) / n, z: a[1] + (dz * k) / n, rot }); left--; }
    }
    return out;
}

// ── small reusable building bits ────────────────────────────────────────

// Low parapet lip running around the roof edge — reads as a real flat roof
// instead of a bare extrusion cap.
function Parapet({ ring, h, color = "#9aa1aa", lip = 0.35 }) {
    const bands = useMemo(() => edgeBands(ring, [h + lip / 2], 60), [ring, h, lip]);
    return bands.map((b, i) => (
        <mesh key={i} position={[b.mx, b.y, b.mz]} rotation={[0, b.rot, 0]}>
            <boxGeometry args={[b.len, lip, 0.22]} />
            <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
    ));
}

// Seeded rooftop clutter: HVAC boxes, a vent stack, sometimes a small tank.
// Placed inside the roof by pulling seeded points toward the centroid.
function RoofPlant({ ring, h, seed, tanks = false, budget = 4 }) {
    const items = useMemo(() => {
        const [cx, cz] = ringCentroid(ring);
        const r = Math.sqrt(ringArea(ring)) * 0.28;
        if (r < 1.2) return [];
        const out = [];
        const n = Math.min(budget, 2 + Math.floor(hash01(cx, cz, seed) * 3));
        for (let k = 0; k < n; k++) {
            const a = hash01(cx, cz, seed + k * 7 + 1) * Math.PI * 2;
            const d = hash01(cx, cz, seed + k * 7 + 2) * r;
            const kind = tanks && k === 0 ? "tank" : (hash01(cx, cz, seed + k * 7 + 3) > 0.6 ? "vent" : "hvac");
            out.push({ x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, kind, rot: hash01(cx, cz, seed + k) * Math.PI });
        }
        return out;
    }, [ring, h, seed, tanks, budget]);
    return items.map((it, i) => it.kind === "tank" ? (
        <group key={i} position={[it.x, h, it.z]}>
            <mesh position={[0, 0.75, 0]} castShadow>
                <cylinderGeometry args={[0.7, 0.7, 1.3, 12]} />
                <meshStandardMaterial color="#1f1f22" roughness={0.85} />
            </mesh>
            <mesh position={[0, 1.42, 0]}>
                <cylinderGeometry args={[0.72, 0.72, 0.12, 12]} />
                <meshStandardMaterial color="#33343a" roughness={0.8} />
            </mesh>
        </group>
    ) : it.kind === "vent" ? (
        <mesh key={i} position={[it.x, h + 0.55, it.z]} castShadow>
            <cylinderGeometry args={[0.16, 0.2, 1.1, 8]} />
            <meshStandardMaterial color="#8f959c" roughness={0.55} metalness={0.4} />
        </mesh>
    ) : (
        <group key={i} position={[it.x, h, it.z]} rotation={[0, it.rot, 0]}>
            <mesh position={[0, 0.45, 0]} castShadow>
                <boxGeometry args={[1.5, 0.9, 1.1]} />
                <meshStandardMaterial color="#aeb4ba" roughness={0.6} metalness={0.3} />
            </mesh>
            <mesh position={[0, 0.92, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.38, 12]} />
                <meshStandardMaterial color="#3f454c" roughness={0.5} metalness={0.5} />
            </mesh>
        </group>
    ));
}

// Entrance on the longest wall: dark door recess + a small flat canopy.
function Entrance({ ring, wide = false }) {
    const e = useMemo(() => longestEdge(ring), [ring]);
    if (!e || e.len < 4) return null;
    const w = wide ? 2.6 : 1.6;
    return (
        <group position={[e.mx, 0, e.mz]} rotation={[0, e.rot, 0]}>
            <mesh position={[0, 1.25, 0.06]}>
                <boxGeometry args={[w, 2.5, 0.1]} />
                <meshStandardMaterial color="#2e3238" roughness={0.5} metalness={0.3} />
            </mesh>
            <mesh position={[0, 2.7, 0.7]} castShadow>
                <boxGeometry args={[w + 1.2, 0.12, 1.5]} />
                <meshStandardMaterial color="#7d838b" roughness={0.6} metalness={0.3} />
            </mesh>
            {[-(w / 2 + 0.45), w / 2 + 0.45].map((x, i) => (
                <mesh key={i} position={[x, 1.35, 1.25]}>
                    <cylinderGeometry args={[0.05, 0.05, 2.7, 6]} />
                    <meshStandardMaterial color="#5b6068" roughness={0.5} metalness={0.5} />
                </mesh>
            ))}
        </group>
    );
}

// Industrial roller-shutter doors spaced along the longest wall.
function RollerDoors({ ring, h, count = 2 }) {
    const e = useMemo(() => longestEdge(ring), [ring]);
    if (!e || e.len < 8) return null;
    const n = Math.min(count, Math.floor(e.len / 6));
    if (n < 1) return null;
    const doorH = Math.min(4.2, h * 0.6), doorW = 3.4;
    const doors = [];
    for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n - 0.5;
        doors.push(t * e.len * 0.8);
    }
    return (
        <group position={[e.mx, 0, e.mz]} rotation={[0, e.rot, 0]}>
            {doors.map((u, i) => (
                <group key={i} position={[u, 0, 0.05]}>
                    <mesh position={[0, doorH / 2, 0]}>
                        <boxGeometry args={[doorW, doorH, 0.08]} />
                        <meshStandardMaterial color="#6e7681" roughness={0.45} metalness={0.55} />
                    </mesh>
                    {Array.from({ length: 6 }, (_, r) => (
                        <mesh key={r} position={[0, (doorH / 7) * (r + 1), 0.05]}>
                            <boxGeometry args={[doorW, 0.03, 0.02]} />
                            <meshStandardMaterial color="#4c525a" roughness={0.5} />
                        </mesh>
                    ))}
                    <mesh position={[0, doorH + 0.2, 0.1]}>
                        <boxGeometry args={[doorW + 0.3, 0.35, 0.2]} />
                        <meshStandardMaterial color="#3a3f47" roughness={0.6} />
                    </mesh>
                </group>
            ))}
        </group>
    );
}

// ── point props ─────────────────────────────────────────────────────────
function BoomArm() {
    return (
        <group rotation={[0, 0, Math.PI / 3]}>
            <mesh position={[2.4, 0, 0]}>
                <boxGeometry args={[4.6, 0.16, 0.16]} />
                <meshStandardMaterial color="#e6e6e6" roughness={0.5} />
            </mesh>
            {[0.6, 1.6, 2.6, 3.6].map(u => (
                <mesh key={u} position={[u, 0, 0]}>
                    <boxGeometry args={[0.4, 0.19, 0.19]} />
                    <meshStandardMaterial color="#c0392b" roughness={0.5} />
                </mesh>
            ))}
            <mesh position={[4.7, -0.35, 0]}>
                <boxGeometry args={[0.06, 0.7, 0.06]} />
                <meshStandardMaterial color="#c9ced4" roughness={0.5} />
            </mesh>
        </group>
    );
}

function GuardHouse() {
    return (
        <group>
            <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
                <boxGeometry args={[2.2, 3, 2.2]} />
                <meshStandardMaterial color="#d8cfa8" roughness={0.8} />
            </mesh>
            {/* wrap-around window band */}
            {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r, i) => (
                <mesh key={i} position={[Math.sin(r) * 1.11, 1.9, Math.cos(r) * 1.11]} rotation={[0, r, 0]}>
                    <boxGeometry args={[1.7, 0.9, 0.03]} />
                    <meshStandardMaterial color="#7a9cae" roughness={0.15} metalness={0.35} />
                </mesh>
            ))}
            <mesh position={[0, 3.2, 0]} castShadow>
                <boxGeometry args={[2.7, 0.14, 2.7]} />
                <meshStandardMaterial color="#7a746a" roughness={0.7} />
            </mesh>
            <mesh position={[0, 3.34, 0]}>
                <boxGeometry args={[2.75, 0.14, 2.75]} />
                <meshStandardMaterial color="#8c857a" roughness={0.7} />
            </mesh>
            <mesh position={[1.6, 0.6, 0]}>
                <boxGeometry args={[0.3, 1.2, 0.3]} />
                <meshStandardMaterial color="#3a3f47" roughness={0.6} metalness={0.4} />
            </mesh>
            <group position={[1.6, 1.15, 0]}><BoomArm /></group>
        </group>
    );
}

function Gate() {
    const pillar = (x) => (
        <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 2, 0]} castShadow>
                <boxGeometry args={[0.6, 4, 0.6]} />
                <meshStandardMaterial color="#c9cfd8" roughness={0.8} />
            </mesh>
            <mesh position={[0, 4.1, 0]}>
                <boxGeometry args={[0.8, 0.2, 0.8]} />
                <meshStandardMaterial color="#9aa1aa" roughness={0.7} />
            </mesh>
        </group>
    );
    return (
        <group>
            {pillar(-4)} {pillar(4)}
            <mesh position={[0, 4.35, 0]}>
                <boxGeometry args={[8.6, 0.5, 0.5]} />
                <meshStandardMaterial color="#9aa1aa" roughness={0.7} />
            </mesh>
            {[-3.3, 3.3].map((x, i) => (
                <group key={i} position={[x, 0, 0]}>
                    {[0, 0.9, 1.8, 2.7].map(y => (
                        <mesh key={y} position={[i === 0 ? 1 : -1, 0.6 + y, 0]}>
                            <boxGeometry args={[2, 0.08, 0.08]} />
                            <meshStandardMaterial color="#6b7280" metalness={0.5} roughness={0.5} />
                        </mesh>
                    ))}
                    {[-0.4, 0.4, 1.2, -1.2].map((u, k) => (
                        <mesh key={k} position={[(i === 0 ? 1 : -1) + u * 0.7, 1.95, 0]}>
                            <boxGeometry args={[0.06, 2.9, 0.06]} />
                            <meshStandardMaterial color="#5b6068" metalness={0.5} roughness={0.5} />
                        </mesh>
                    ))}
                </group>
            ))}
        </group>
    );
}

function GateBoom() {
    return (
        <group>
            <mesh position={[0, 0.6, 0]}>
                <boxGeometry args={[0.35, 1.2, 0.35]} />
                <meshStandardMaterial color="#3a3f47" roughness={0.6} metalness={0.4} />
            </mesh>
            <group position={[0, 1.15, 0]}><BoomArm /></group>
        </group>
    );
}

// Vehicle gate — one structure carrying both lanes (IN left, OUT right), each
// with its own boom barrier and a small coloured tag. Reuses Gate's pillars
// and BoomArm so it matches the rest of the boundary kit.
function VehicleGateInOut() {
    const pillar = (x) => (
        <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 2, 0]} castShadow>
                <boxGeometry args={[0.6, 4, 0.6]} />
                <meshStandardMaterial color="#c9cfd8" roughness={0.8} />
            </mesh>
            <mesh position={[0, 4.1, 0]}>
                <boxGeometry args={[0.8, 0.2, 0.8]} />
                <meshStandardMaterial color="#9aa1aa" roughness={0.7} />
            </mesh>
        </group>
    );
    const lane = (dir, cx, sign) => {
        const isIn = dir === "IN";
        return (
            <group key={dir}>
                <mesh position={[cx, 4.35, 0]}>
                    <boxGeometry args={[4.4, 0.35, 0.35]} />
                    <meshStandardMaterial color={isIn ? "#2f8a4f" : "#b23a34"} roughness={0.6} metalness={0.2} />
                </mesh>
                <mesh position={[cx + sign * 1.9, 0.6, 0]}>
                    <boxGeometry args={[0.3, 1.2, 0.3]} />
                    <meshStandardMaterial color="#3a3f47" roughness={0.6} metalness={0.4} />
                </mesh>
                <group position={[cx + sign * 1.9, 1.15, 0]} rotation={[0, 0, sign < 0 ? Math.PI - Math.PI / 3 : Math.PI / 3]}>
                    <BoomArm />
                </group>
                {/* small tag — kept compact so it doesn't dominate the view */}
                <Html position={[cx, 5, 0]} center distanceFactor={260} occlude={false}>
                    <div style={{
                        padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 700,
                        letterSpacing: 0.3, color: "#fff", whiteSpace: "nowrap",
                        fontFamily: "system-ui, Segoe UI, sans-serif",
                        background: isIn ? "rgba(37,120,72,.9)" : "rgba(160,50,44,.9)",
                        pointerEvents: "none",
                    }}>{dir}</div>
                </Html>
            </group>
        );
    };
    return (
        <group>
            {pillar(-4.4)} {pillar(0)} {pillar(4.4)}
            {lane("IN", -2.2, -1)}
            {lane("OUT", 2.2, 1)}
        </group>
    );
}

// Single-lane vehicle gate — IN and OUT are separate props so each can be
// placed, rotated and sized on its own (e.g. entry and exit at opposite ends
// of the yard).
function VehicleGateLane({ dir }) {
    const isIn = dir === "IN";
    const pillar = (x) => (
        <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 2, 0]} castShadow>
                <boxGeometry args={[0.6, 4, 0.6]} />
                <meshStandardMaterial color="#c9cfd8" roughness={0.8} />
            </mesh>
            <mesh position={[0, 4.1, 0]}>
                <boxGeometry args={[0.8, 0.2, 0.8]} />
                <meshStandardMaterial color="#9aa1aa" roughness={0.7} />
            </mesh>
        </group>
    );
    return (
        <group>
            {pillar(-2.2)} {pillar(2.2)}
            <mesh position={[0, 4.35, 0]}>
                <boxGeometry args={[4.4, 0.35, 0.35]} />
                <meshStandardMaterial color={isIn ? "#2f8a4f" : "#b23a34"} roughness={0.6} metalness={0.2} />
            </mesh>
            <mesh position={[-1.9, 0.6, 0]}>
                <boxGeometry args={[0.3, 1.2, 0.3]} />
                <meshStandardMaterial color="#3a3f47" roughness={0.6} metalness={0.4} />
            </mesh>
            <group position={[-1.9, 1.15, 0]}><BoomArm /></group>
            {/* small tag — kept compact so it doesn't dominate the view */}
            <Html position={[0, 5, 0]} center distanceFactor={260} occlude={false}>
                <div style={{
                    padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 700,
                    letterSpacing: 0.3, color: "#fff", whiteSpace: "nowrap",
                    fontFamily: "system-ui, Segoe UI, sans-serif",
                    background: isIn ? "rgba(37,120,72,.9)" : "rgba(160,50,44,.9)",
                    pointerEvents: "none",
                }}>{dir}</div>
            </Html>
        </group>
    );
}
function GateIn() { return <VehicleGateLane dir="IN" />; }
function GateOut() { return <VehicleGateLane dir="OUT" />; }

function LightPole({ nightOn = 0 }) {
    return (
        <group>
            <mesh position={[0, 0.25, 0]}>
                <cylinderGeometry args={[0.32, 0.38, 0.5, 10]} />
                <meshStandardMaterial color="#8f959c" roughness={0.8} />
            </mesh>
            <mesh position={[0, 4.5, 0]} castShadow>
                <cylinderGeometry args={[0.13, 0.2, 9, 8]} />
                <meshStandardMaterial color="#b8bec7" roughness={0.55} metalness={0.55} />
            </mesh>
            <mesh position={[0.55, 8.7, 0]} rotation={[0, 0, -0.35]}>
                <boxGeometry args={[1.3, 0.16, 0.16]} />
                <meshStandardMaterial color="#6b7280" roughness={0.6} metalness={0.4} />
            </mesh>
            <mesh position={[1.05, 8.55, 0]}>
                <sphereGeometry args={[0.28, 12, 10]} />
                <meshStandardMaterial color="#fff6d8" emissive="#ffe9a8" emissiveIntensity={nightOn * 2.2} />
            </mesh>
        </group>
    );
}

function WaterTank() {
    const legs = [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]];
    return (
        <group>
            {legs.map(([x, z], i) => (
                <mesh key={i} position={[x, 2, z]}>
                    <cylinderGeometry args={[0.12, 0.12, 4, 8]} />
                    <meshStandardMaterial color="#7a828c" roughness={0.7} metalness={0.5} />
                </mesh>
            ))}
            {/* cross bracing */}
            {[[0, 1.15], [Math.PI / 2, 1.15]].map(([r, z], i) => (
                <group key={i} rotation={[0, r, 0]}>
                    <mesh position={[0, 1.6, z]} rotation={[0, 0, 0.62]}>
                        <boxGeometry args={[3, 0.06, 0.06]} />
                        <meshStandardMaterial color="#7a828c" roughness={0.7} metalness={0.5} />
                    </mesh>
                    <mesh position={[0, 1.6, z]} rotation={[0, 0, -0.62]}>
                        <boxGeometry args={[3, 0.06, 0.06]} />
                        <meshStandardMaterial color="#7a828c" roughness={0.7} metalness={0.5} />
                    </mesh>
                </group>
            ))}
            <mesh position={[0, 5, 0]} castShadow>
                <cylinderGeometry args={[2, 2, 2.6, 20]} />
                <meshStandardMaterial color="#dfe8ee" roughness={0.5} metalness={0.15} />
            </mesh>
            <mesh position={[0, 6.4, 0]}>
                <coneGeometry args={[2.1, 0.8, 20]} />
                <meshStandardMaterial color="#c7d3db" roughness={0.6} />
            </mesh>
            <mesh position={[1.5, 2.5, 1.5]} rotation={[0, Math.PI / 4, 0.12]}>
                <boxGeometry args={[0.08, 5.4, 0.08]} />
                <meshStandardMaterial color="#5b6570" roughness={0.5} metalness={0.5} />
            </mesh>
        </group>
    );
}

function Transformer() {
    const corners = [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]];
    return (
        <group>
            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[3.4, 3.4]} />
                <meshStandardMaterial color="#8a8f96" roughness={0.9} />
            </mesh>
            {[[-1, 0], [1, 0]].map(([x], i) => (
                <group key={i} position={[x, 0, 0]}>
                    <mesh position={[0, 0.9, 0]} castShadow>
                        <cylinderGeometry args={[0.55, 0.55, 1.5, 12]} />
                        <meshStandardMaterial color="#3f4a52" roughness={0.5} metalness={0.6} />
                    </mesh>
                    {/* bushings */}
                    {[-0.25, 0, 0.25].map((u, k) => (
                        <mesh key={k} position={[u, 1.85, 0]}>
                            <cylinderGeometry args={[0.06, 0.08, 0.4, 8]} />
                            <meshStandardMaterial color="#c8b48a" roughness={0.4} />
                        </mesh>
                    ))}
                    {/* cooling fins */}
                    {[-0.62, 0.62].map((z, k) => (
                        <mesh key={k} position={[0, 0.9, z]}>
                            <boxGeometry args={[0.9, 1.3, 0.05]} />
                            <meshStandardMaterial color="#333c43" roughness={0.55} metalness={0.55} />
                        </mesh>
                    ))}
                </group>
            ))}
            {corners.map(([x, z], i) => (
                <mesh key={i} position={[x, 0.6, z]}>
                    <boxGeometry args={[0.08, 1.2, 0.08]} />
                    <meshStandardMaterial color="#9aa1aa" roughness={0.6} />
                </mesh>
            ))}
            {[0, 1, 2, 3].map(i => {
                const a = corners[i], b = corners[(i + 1) % 4];
                const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
                const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
                const rot = Math.atan2(b[1] - a[1], b[0] - a[0]);
                return (
                    <mesh key={i} position={[mx, 1.15, mz]} rotation={[0, -rot, 0]}>
                        <boxGeometry args={[len, 0.06, 0.06]} />
                        <meshStandardMaterial color="#c0392b" roughness={0.5} />
                    </mesh>
                );
            })}
        </group>
    );
}

function DgSet() {
    return (
        <group>
            <mesh position={[0, 0.1, 0]}>
                <boxGeometry args={[3.4, 0.2, 1.8]} />
                <meshStandardMaterial color="#7d838b" roughness={0.9} />
            </mesh>
            <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
                <boxGeometry args={[3, 2, 1.4]} />
                <meshStandardMaterial color="#d9a441" roughness={0.7} metalness={0.15} />
            </mesh>
            {[-1.1, -0.5, 0.1, 0.7].map(u => (
                <mesh key={u} position={[u, 1.1, 0.71]}>
                    <boxGeometry args={[0.5, 1.6, 0.02]} />
                    <meshStandardMaterial color="#b98429" roughness={0.7} />
                </mesh>
            ))}
            <mesh position={[1.2, 3, 0.4]}>
                <cylinderGeometry args={[0.12, 0.12, 1.8, 8]} />
                <meshStandardMaterial color="#3a3f47" roughness={0.5} metalness={0.6} />
            </mesh>
            <mesh position={[1.2, 3.95, 0.4]}>
                <cylinderGeometry args={[0.16, 0.12, 0.3, 8]} />
                <meshStandardMaterial color="#26292e" roughness={0.5} metalness={0.6} />
            </mesh>
        </group>
    );
}

function SolarArray() {
    const rows = [-2.2, 0, 2.2];
    return (
        <group>
            {rows.map((z, i) => (
                <group key={i} position={[0, 0, z]}>
                    {[[-2.1], [2.1]].map(([x], k) => (
                        <mesh key={k} position={[x, 0.5, 0]}>
                            <boxGeometry args={[0.1, 1, 0.1]} />
                            <meshStandardMaterial color="#8f959c" roughness={0.6} metalness={0.4} />
                        </mesh>
                    ))}
                    <mesh position={[0, 1.15, -0.35]} rotation={[-0.42, 0, 0]} castShadow>
                        <boxGeometry args={[6, 0.08, 2.2]} />
                        <meshStandardMaterial color="#1d2f4a" roughness={0.25} metalness={0.5} />
                    </mesh>
                    <mesh position={[0, 1.2, -0.37]} rotation={[-0.42, 0, 0]}>
                        <boxGeometry args={[5.9, 0.02, 2.1]} />
                        <meshStandardMaterial color="#2c4a75" roughness={0.15} metalness={0.6} />
                    </mesh>
                </group>
            ))}
        </group>
    );
}

function CctvPole() {
    return (
        <group>
            <mesh position={[0, 2.5, 0]} castShadow>
                <cylinderGeometry args={[0.08, 0.12, 5, 8]} />
                <meshStandardMaterial color="#aeb4ba" roughness={0.55} metalness={0.5} />
            </mesh>
            {[0.5, -0.5].map((s, i) => (
                <group key={i} position={[s * 0.35, 4.8, 0]} rotation={[0, s > 0 ? 0.5 : Math.PI - 0.5, -0.2]}>
                    <mesh position={[0.25, 0, 0]}>
                        <boxGeometry args={[0.5, 0.16, 0.16]} />
                        <meshStandardMaterial color="#f0f0ec" roughness={0.5} />
                    </mesh>
                    <mesh position={[0.55, 0, 0]}>
                        <cylinderGeometry args={[0.07, 0.09, 0.12, 8]} />
                        <meshStandardMaterial color="#26292e" roughness={0.3} />
                    </mesh>
                </group>
            ))}
        </group>
    );
}

function Flagpole() {
    return (
        <group>
            <mesh position={[0, 0.15, 0]}>
                <cylinderGeometry args={[0.5, 0.6, 0.3, 12]} />
                <meshStandardMaterial color="#b9b2a4" roughness={0.8} />
            </mesh>
            <mesh position={[0, 6, 0]} castShadow>
                <cylinderGeometry args={[0.06, 0.09, 12, 8]} />
                <meshStandardMaterial color="#c7ccd3" roughness={0.5} metalness={0.6} />
            </mesh>
            {[["#e07b39", 0], ["#f2f2ea", 1.15], ["#3f8f52", 2.3]].map(([c, y], i) => (
                <mesh key={i} position={[0.9, 10.8 - y, 0]}>
                    <planeGeometry args={[1.8, 1.15]} />
                    <meshStandardMaterial color={c} roughness={0.8} side={THREE.DoubleSide} />
                </mesh>
            ))}
        </group>
    );
}

// Trees vary in height, canopy colour and silhouette from a positional seed.
function Tree({ seed = 0 }) {
    const v = hash01(seed, seed * 1.7, 5);
    const s = 0.8 + v * 0.5;                       // 0.8 – 1.3 scale
    const canopyColors = ["#3f6b39", "#4a7a3c", "#54793a", "#39603b"];
    const c = canopyColors[Math.floor(hash01(seed, seed, 9) * canopyColors.length)];
    const lean = (hash01(seed, seed, 3) - 0.5) * 0.1;
    const blobs = [
        [0, 4.2, 0, 2.2],
        [1.1 * s, 3.6, 0.4, 1.3],
        [-0.9 * s, 3.9, -0.6, 1.2],
    ];
    return (
        <group scale={[s, s, s]} rotation={[lean, hash01(seed, seed, 4) * Math.PI * 2, lean]}>
            <mesh position={[0, 1.6, 0]} castShadow>
                <cylinderGeometry args={[0.18, 0.3, 3.2, 6]} />
                <meshStandardMaterial color="#5b4632" roughness={1} />
            </mesh>
            {blobs.map(([x, y, z, r], i) => (
                <mesh key={i} position={[x, y, z]} castShadow>
                    <icosahedronGeometry args={[r, 0]} />
                    <meshStandardMaterial color={c} roughness={0.95} flatShading />
                </mesh>
            ))}
        </group>
    );
}

function Shrub({ seed = 0 }) {
    const s = 0.7 + hash01(seed, seed, 11) * 0.6;
    return (
        <group scale={[s, s, s]}>
            <mesh position={[0, 0.5, 0]} castShadow>
                <icosahedronGeometry args={[0.7, 0]} />
                <meshStandardMaterial color="#4a7a44" roughness={0.95} flatShading />
            </mesh>
            <mesh position={[0.5, 0.35, 0.3]} castShadow>
                <icosahedronGeometry args={[0.45, 0]} />
                <meshStandardMaterial color="#3f6b39" roughness={0.95} flatShading />
            </mesh>
        </group>
    );
}

function Planter() {
    return (
        <group>
            <mesh position={[0, 0.3, 0]} castShadow>
                <boxGeometry args={[1.2, 0.6, 1.2]} />
                <meshStandardMaterial color="#8a7458" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.62, 0]}>
                <boxGeometry args={[1.26, 0.08, 1.26]} />
                <meshStandardMaterial color="#9c8668" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.85, 0]}>
                <sphereGeometry args={[0.55, 12, 8]} />
                <meshStandardMaterial color="#4a7a44" roughness={0.9} flatShading />
            </mesh>
        </group>
    );
}

function Bench() {
    return (
        <group>
            {[-0.7, 0.7].map((x, i) => (
                <mesh key={i} position={[x, 0.22, 0]}>
                    <boxGeometry args={[0.08, 0.44, 0.55]} />
                    <meshStandardMaterial color="#3f454c" roughness={0.6} metalness={0.4} />
                </mesh>
            ))}
            {[-0.18, 0, 0.18].map((z, i) => (
                <mesh key={i} position={[0, 0.46, z]} castShadow>
                    <boxGeometry args={[1.8, 0.05, 0.13]} />
                    <meshStandardMaterial color="#8a6c48" roughness={0.85} />
                </mesh>
            ))}
            {[0.72, 0.9].map((y, i) => (
                <mesh key={i} position={[0, y, -0.28]} rotation={[0.18, 0, 0]}>
                    <boxGeometry args={[1.8, 0.05, 0.13]} />
                    <meshStandardMaterial color="#8a6c48" roughness={0.85} />
                </mesh>
            ))}
        </group>
    );
}

// ── vehicles & cargo ────────────────────────────────────────────────────
const CONTAINER_COLORS = ["#a34f3e", "#33597a", "#4a7a55", "#b0803a", "#6b6f76", "#7a4a6e"];

function ContainerBox({ color, len = 6, w = 2.44, h = 2.6 }) {
    // corrugation: alternating shallow strips along the long faces
    const ribs = Math.round(len / 0.45);
    return (
        <group>
            <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[len, h, w]} />
                <meshStandardMaterial color={color} roughness={0.75} metalness={0.2} />
            </mesh>
            {[w / 2 + 0.01, -w / 2 - 0.01].map((z, side) =>
                Array.from({ length: ribs }, (_, i) => i % 2 === 0 && (
                    <mesh key={`${side}-${i}`} position={[-len / 2 + (i + 0.5) * (len / ribs), h / 2, z]}>
                        <boxGeometry args={[len / ribs * 0.7, h * 0.92, 0.02]} />
                        <meshStandardMaterial color={color} roughness={0.85} metalness={0.15} />
                    </mesh>
                )))}
            {/* door end: hinge bars */}
            {[-0.6, -0.2, 0.2, 0.6].map((z, i) => (
                <mesh key={i} position={[len / 2 + 0.02, h / 2, z]}>
                    <boxGeometry args={[0.05, h * 0.9, 0.07]} />
                    <meshStandardMaterial color="#2b2e33" roughness={0.5} metalness={0.5} />
                </mesh>
            ))}
            {/* corner castings */}
            {[[-len / 2, -w / 2], [len / 2, -w / 2], [-len / 2, w / 2], [len / 2, w / 2]].flatMap(([x, z], i) =>
                [0.12, h - 0.12].map((y, k) => (
                    <mesh key={`${i}-${k}`} position={[x, y, z]}>
                        <boxGeometry args={[0.26, 0.24, 0.26]} />
                        <meshStandardMaterial color="#3a3f47" roughness={0.6} metalness={0.4} />
                    </mesh>
                )))}
        </group>
    );
}

// ── shipping container (real GLB) ───────────────────────────────────────
// Same scale-to-fit + tint + Suspense/error-fallback approach as
// CustomModelProp below (reuses its CustomModelBoundary + safeScale) —
// difference is normalising by LENGTH (the X axis ContainerBox's own `len`
// scales) rather than height, since a shipping container's defining
// dimension is its length (20ft/40ft), not how tall it stands.
const SHIPPING_CONTAINER_GLB_PATH = "/models/custom/shipping_container_3d_model.glb";
useGLTF.preload(SHIPPING_CONTAINER_GLB_PATH);

function ShippingContainerGlb({ color, len = 6 }) {
    const { scene } = useGLTF(SHIPPING_CONTAINER_GLB_PATH);
    // useGLTF caches by url — clone per placement (an Object3D can only have
    // one parent) and clone+recolour every mesh's material so each container
    // keeps its own assigned colour instead of all instances sharing (and
    // fighting over) one material.
    const instance = useMemo(() => {
        const clone = scene.clone(true);
        clone.traverse((o) => {
            if (!o.isMesh) return;
            o.castShadow = true; o.receiveShadow = true;
            o.material = o.material.clone();
            o.material.color = new THREE.Color(color);
        });
        return clone;
    }, [scene, color]);

    const { scale, liftY } = useMemo(() => {
        const box = new THREE.Box3().setFromObject(instance);
        const size = new THREE.Vector3(); box.getSize(size);
        const s = safeScale(size.x > 0.01 ? len / size.x : 1);
        return { scale: s, liftY: -box.min.y * s };
    }, [instance, len]);

    return <primitive object={instance} scale={[scale, scale, scale]} position={[0, liftY, 0]} />;
}

function ShippingContainerProp({ color, len = 6 }) {
    const fallback = <ContainerBox color={color} len={len} />;
    return (
        <Suspense fallback={fallback}>
            <CustomModelBoundary fallback={fallback}>
                <ShippingContainerGlb color={color} len={len} />
            </CustomModelBoundary>
        </Suspense>
    );
}

function Container({ seed = 0 }) {
    const color = CONTAINER_COLORS[Math.floor(hash01(seed, seed, 21) * CONTAINER_COLORS.length)];
    return <ShippingContainerProp color={color} />;
}

function ContainerStack({ seed = 0 }) {
    const c1 = CONTAINER_COLORS[Math.floor(hash01(seed, seed, 21) * CONTAINER_COLORS.length)];
    const c2 = CONTAINER_COLORS[Math.floor(hash01(seed, seed, 34) * CONTAINER_COLORS.length)];
    return (
        <group>
            <ShippingContainerProp color={c1} />
            <group position={[0, 2.6, 0]}>
                <ShippingContainerProp color={c2} />
            </group>
        </group>
    );
}

function Wheel({ r = 0.5, w = 0.35 }) {
    return (
        <group rotation={[Math.PI / 2, 0, 0]}>
            <mesh castShadow>
                <cylinderGeometry args={[r, r, w, 14]} />
                <meshStandardMaterial color="#1d1f22" roughness={0.95} />
            </mesh>
            <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[r * 0.45, r * 0.45, w + 0.02, 10]} />
                <meshStandardMaterial color="#8f959c" roughness={0.5} metalness={0.5} />
            </mesh>
        </group>
    );
}

function Truck({ seed = 0 }) {
    const cabColors = ["#b03a2e", "#2c5f8a", "#c9cfd8", "#3f7a4c"];
    const cab = cabColors[Math.floor(hash01(seed, seed, 41) * cabColors.length)];
    const box = CONTAINER_COLORS[Math.floor(hash01(seed, seed, 42) * CONTAINER_COLORS.length)];
    return (
        <group>
            {/* chassis */}
            <mesh position={[0.2, 0.95, 0]}>
                <boxGeometry args={[11.5, 0.25, 1.1]} />
                <meshStandardMaterial color="#33363b" roughness={0.7} metalness={0.3} />
            </mesh>
            {/* cab */}
            <group position={[5.1, 0, 0]}>
                <mesh position={[0, 1.8, 0]} castShadow>
                    <boxGeometry args={[2.1, 1.7, 2.4]} />
                    <meshStandardMaterial color={cab} roughness={0.45} metalness={0.2} />
                </mesh>
                <mesh position={[0.1, 2.35, 0]}>
                    <boxGeometry args={[1.95, 0.75, 2.2]} />
                    <meshStandardMaterial color="#26323b" roughness={0.15} metalness={0.4} />
                </mesh>
                <mesh position={[1.06, 1.35, 0]}>
                    <boxGeometry args={[0.1, 0.5, 2.2]} />
                    <meshStandardMaterial color="#2b2e33" roughness={0.6} />
                </mesh>
            </group>
            {/* trailer container */}
            <group position={[-1.6, 1.05, 0]}>
                <ContainerBox color={box} len={7.5} />
            </group>
            {/* wheels */}
            {[[5.4, 0], [-3.2, 0], [-4.4, 0], [2.6, 0]].flatMap(([x], i) =>
                [1.05, -1.05].map((z, k) => (
                    <group key={`${i}-${k}`} position={[x, 0.52, z]}>
                        <Wheel />
                    </group>
                )))}
        </group>
    );
}

// Flatcar underframe shared by all wagon variants — bogies at each end (2
// axles × 2 wheels), buffers, and a steel deck. `children` positions the
// container load (or none, for the empty flatcar).
function WagonChassis({ frameLen = 13.7, children }) {
    return (
        <group>
            <mesh position={[0, 0.78, 0]}>
                <boxGeometry args={[frameLen, 0.22, 2.2]} />
                <meshStandardMaterial color="#3a3f47" roughness={0.75} metalness={0.35} />
            </mesh>
            <mesh position={[0, 0.9, 0]}>
                <boxGeometry args={[frameLen - 0.4, 0.05, 2.3]} />
                <meshStandardMaterial color="#5b5348" roughness={0.85} />
            </mesh>
            {/* bogies */}
            {[-frameLen / 2 + 1.9, frameLen / 2 - 1.9].map((x, bi) => (
                <group key={bi} position={[x, 0, 0]}>
                    <mesh position={[0, 0.55, 0]}>
                        <boxGeometry args={[2.2, 0.3, 1.9]} />
                        <meshStandardMaterial color="#2b2e33" roughness={0.7} metalness={0.4} />
                    </mesh>
                    {[-0.75, 0.75].flatMap((dx, wi) =>
                        [-0.95, 0.95].map((z, zi) => (
                            <mesh key={`${wi}-${zi}`} position={[dx, 0.46, z]} rotation={[Math.PI / 2, 0, 0]}>
                                <cylinderGeometry args={[0.46, 0.46, 0.16, 16]} />
                                <meshStandardMaterial color="#23262b" roughness={0.4} metalness={0.7} />
                            </mesh>
                        )))}
                </group>
            ))}
            {/* buffers */}
            {[-frameLen / 2 - 0.15, frameLen / 2 + 0.15].map((x, i) => (
                <group key={i} position={[x, 0.85, 0]}>
                    {[-0.75, 0.75].map((z, k) => (
                        <mesh key={k} position={[0, 0, z]} rotation={[0, 0, Math.PI / 2]}>
                            <cylinderGeometry args={[0.16, 0.16, 0.32, 10]} />
                            <meshStandardMaterial color="#4c525a" roughness={0.5} metalness={0.6} />
                        </mesh>
                    ))}
                </group>
            ))}
            {children}
        </group>
    );
}

function Wagon({ seed = 0 }) {
    const color = CONTAINER_COLORS[Math.floor(hash01(seed, seed, 61) * CONTAINER_COLORS.length)];
    return (
        <WagonChassis>
            <group position={[0, 0.925, 0]}>
                <ContainerBox color={color} len={12} />
            </group>
        </WagonChassis>
    );
}

function WagonDouble({ seed = 0 }) {
    const c1 = CONTAINER_COLORS[Math.floor(hash01(seed, seed, 61) * CONTAINER_COLORS.length)];
    const c2 = CONTAINER_COLORS[Math.floor(hash01(seed, seed, 67) * CONTAINER_COLORS.length)];
    return (
        <WagonChassis>
            <group position={[-3.15, 0.925, 0]}><ContainerBox color={c1} len={6} /></group>
            <group position={[3.15, 0.925, 0]}><ContainerBox color={c2} len={6} /></group>
        </WagonChassis>
    );
}

function WagonEmpty() {
    return <WagonChassis />;
}

function Car({ seed = 0 }) {
    const colors = ["#c9cfd8", "#8a1e1e", "#26323b", "#c9a13a", "#4a6d8c", "#e8e8e2"];
    const c = colors[Math.floor(hash01(seed, seed, 51) * colors.length)];
    return (
        <group>
            <mesh position={[0, 0.55, 0]} castShadow>
                <boxGeometry args={[4.2, 0.65, 1.8]} />
                <meshStandardMaterial color={c} roughness={0.35} metalness={0.3} />
            </mesh>
            <mesh position={[-0.2, 1.08, 0]} castShadow>
                <boxGeometry args={[2.3, 0.55, 1.65]} />
                <meshStandardMaterial color={c} roughness={0.35} metalness={0.3} />
            </mesh>
            <mesh position={[-0.2, 1.1, 0]}>
                <boxGeometry args={[2.1, 0.42, 1.7]} />
                <meshStandardMaterial color="#26323b" roughness={0.12} metalness={0.4} />
            </mesh>
            {[[1.45], [-1.45]].flatMap(([x], i) =>
                [0.92, -0.92].map((z, k) => (
                    <group key={`${i}-${k}`} position={[x, 0.34, z]}>
                        <Wheel r={0.34} w={0.24} />
                    </group>
                )))}
        </group>
    );
}

function Forklift() {
    return (
        <group>
            <mesh position={[0, 0.75, 0]} castShadow>
                <boxGeometry args={[2, 0.9, 1.3]} />
                <meshStandardMaterial color="#d9a441" roughness={0.6} metalness={0.15} />
            </mesh>
            <mesh position={[-0.8, 1.35, 0]}>
                <boxGeometry args={[0.5, 0.4, 1.1]} />
                <meshStandardMaterial color="#33363b" roughness={0.7} />
            </mesh>
            {/* overhead guard */}
            {[[0.45, 0.5], [0.45, -0.5], [-0.55, 0.5], [-0.55, -0.5]].map(([x, z], i) => (
                <mesh key={i} position={[x, 1.75, z]}>
                    <boxGeometry args={[0.07, 1.1, 0.07]} />
                    <meshStandardMaterial color="#2b2e33" roughness={0.6} />
                </mesh>
            ))}
            <mesh position={[-0.05, 2.32, 0]}>
                <boxGeometry args={[1.2, 0.07, 1.15]} />
                <meshStandardMaterial color="#2b2e33" roughness={0.6} />
            </mesh>
            {/* mast + forks */}
            {[0.3, -0.3].map((z, i) => (
                <mesh key={i} position={[1.15, 1.3, z]}>
                    <boxGeometry args={[0.1, 2.6, 0.1]} />
                    <meshStandardMaterial color="#4c525a" roughness={0.5} metalness={0.5} />
                </mesh>
            ))}
            {[0.35, -0.35].map((z, i) => (
                <mesh key={i} position={[1.75, 0.1, z]}>
                    <boxGeometry args={[1.1, 0.07, 0.14]} />
                    <meshStandardMaterial color="#8f959c" roughness={0.4} metalness={0.6} />
                </mesh>
            ))}
            {[[0.7], [-0.7]].flatMap(([x], i) =>
                [0.72, -0.72].map((z, k) => (
                    <group key={`${i}-${k}`} position={[x, 0.35, z]}>
                        <Wheel r={0.35} w={0.3} />
                    </group>
                )))}
        </group>
    );
}

// A non-finite (NaN/Infinity) or non-positive scale on ANY object corrupts
// Three.js's shared bounding-sphere/shadow-frustum computation for the WHOLE
// scene, not just that object — the actual mechanism behind a "the screen
// goes black after placing/drawing something" report. Every GLB scale
// computation below (custom models, security wall) must route through this.
function safeScale(v, fallback = 1) {
    return Number.isFinite(v) && v > 0 ? v : fallback;
}

// ── custom uploaded GLB models ──────────────────────────────────────────
// Placed exactly like any other point prop (move/rotate/Width+Height/delete
// all already work generically for `footprint: "point"` — see PropsPanel in
// dict-main.jsx), plus a colour tint since a plain-grey uploaded model would
// otherwise have no way to stand out or match a livery.
function CustomModelPlaceholder({ color }) {
    return (
        <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[1.5, 3, 1.5]} />
            <meshLambertMaterial color={color || "#9aa5b1"} />
        </mesh>
    );
}

class CustomModelBoundary extends React.Component {
    constructor(p) { super(p); this.state = { failed: false }; }
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch() {}
    render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function CustomModelGlb({ url, color }) {
    const { scene } = useGLTF(url);
    // useGLTF caches by url — clone per placement (an Object3D can only have
    // one parent), tint every mesh's material with the operator's chosen
    // colour, and turn on shadows since the source GLTF materials don't
    // inherit them.
    const instance = useMemo(() => {
        const clone = scene.clone(true);
        clone.traverse((o) => {
            if (!o.isMesh) return;
            o.castShadow = true; o.receiveShadow = true;
            if (color) { o.material = o.material.clone(); o.material.color = new THREE.Color(color); }
        });
        return clone;
    }, [scene, color]);

    // Normalise to a sensible default height so a freshly-placed model reads
    // at roughly the same scale as every other point prop before the
    // operator nudges Height/Width (PropsLayer's outer group applies
    // scaleX/scaleY from those controls on top of this).
    const { scale, liftY } = useMemo(() => {
        const box = new THREE.Box3().setFromObject(instance);
        const size = new THREE.Vector3(); box.getSize(size);
        const TARGET_H = 3;
        const s = safeScale(size.y > 0.01 ? TARGET_H / size.y : 1);
        return { scale: s, liftY: -box.min.y * s };
    }, [instance]);

    return <primitive object={instance} scale={[scale, scale, scale]} position={[0, liftY, 0]} />;
}

export function CustomModelProp({ url, color }) {
    if (!url) return null;
    const fallback = <CustomModelPlaceholder color={color} />;
    return (
        <Suspense fallback={fallback}>
            <CustomModelBoundary fallback={fallback}>
                <CustomModelGlb url={url} color={color} />
            </CustomModelBoundary>
        </Suspense>
    );
}

// Filenames of the building-shaped custom models (warehouse, portable cabin,
// garden shed, workshop building — see Frontend/public/models/custom/) vs.
// everything else placeable there (floodlight tower — already a mast/light
// itself, security wall, toll gate, forklift/reach-stacker). No footprint
// polygon exists for a point prop the way BuildingNightLights above expects
// (ring corners), so this is a single fixture near the model's estimated
// front-top edge instead of two roofline corners — the model's real height
// isn't known without loading its GLB, but CustomModelGlb below normalises
// every model to a 3 m base height before the placement's own Height slider
// (scaleY) stretches it, so `3 * scaleY` is the same estimate dict-main.jsx
// already uses for hand-placed floodlight towers.
const BUILDING_MODEL_RE = /warehouse|cabin|building|shed/i;

function CustomModelBuildingLight({ url, scaleY, nightOn }) {
    if (!BUILDING_MODEL_RE.test(url || "") || nightOn <= 0.08) return null;
    const h = Math.max(2.5, 3 * (scaleY || 1) * 0.85);
    return (
        <group position={[0, h, 1.2]}>
            <mesh>
                <boxGeometry args={[0.5, 0.3, 0.35]} />
                <meshStandardMaterial color="#f4f8ff" emissive="#eaf2ff" emissiveIntensity={0.4 + nightOn * 1.6} />
            </mesh>
            <pointLight color="#eef4ff" intensity={nightOn * 300} distance={68} decay={1.2} />
            {/* Ground glow decal removed — same overexposure issue flagged on the
                mast lights (Masts.jsx), same fix: the pointLight above is the
                actual illumination, this was only ever a visibility fallback. */}
        </group>
    );
}

const POINT_RENDERERS = {
    guardhouse: GuardHouse, gate: Gate, gate_boom: GateBoom,
    // vehicle_gate stays registered so combined gates placed before the
    // IN/OUT split still render
    vehicle_gate: VehicleGateInOut, gate_in: GateIn, gate_out: GateOut, light_pole: LightPole,
    water_tank: WaterTank, transformer: Transformer, dg_set: DgSet, flagpole: Flagpole,
    tree: Tree, planter: Planter, shrub: Shrub, bench: Bench,
    solar_array: SolarArray, cctv: CctvPole,
    truck: Truck, car: Car, forklift: Forklift,
    container: Container, container_stack: ContainerStack,
    wagon: Wagon, wagon_double: WagonDouble, wagon_empty: WagonEmpty,
};
// These renderers accept a positional seed so instances vary between placements.
const SEEDED_POINT_TYPES = new Set(["tree", "shrub", "container", "container_stack", "truck", "car", "wagon", "wagon_double"]);

// ── polygon props ───────────────────────────────────────────────────────
// Each building type is its own component so hooks stay unconditional —
// PolygonBuilding computes the shared ring/shape/extrusion once and then
// dispatches. `rawRing` is already in scene-space XZ (see PropsLayer below);
// `p.scale` (the panel's Width/length +/- control) grows or shrinks it about
// its own centroid before anything is built, so every detail — windows,
// mullions, balconies, roof plant — scales consistently with the footprint.

function useBuildingBasics(rawRing, p, defaultH) {
    const h = p.h ?? defaultH;
    const ring = useMemo(() => scaleRingAbout(rawRing, p.scale || 1), [rawRing, p.scale]);
    const shape = useMemo(() => {
        const s = new THREE.Shape();
        ring.forEach(([x, z], i) => (i ? s.lineTo(x, z) : s.moveTo(x, z)));
        s.closePath();
        return s;
    }, [ring]);
    const walls = useMemo(() => {
        const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
        // ExtrudeGeometry builds in the shape's XY plane, extruding along +Z —
        // lay it flat (walls rising in world Y) and swap the Z sign so it
        // isn't mirrored.
        g.rotateX(-Math.PI / 2);
        g.scale(1, 1, -1);
        return g;
    }, [shape, h]);
    const centroid = useMemo(() => ringCentroid(ring), [ring]);
    const seed = centroid[0] * 0.37 + centroid[1] * 0.61;
    return { h, ring, shape, walls, centroid, seed };
}

function FlatRoof({ shape, centroid, h, color, y = 0.08 }) {
    return (
        <mesh position={[centroid[0], h + y, centroid[1]]} rotation={[-Math.PI / 2, 0, 0]}>
            <shapeGeometry args={[shape]} />
            <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
    );
}

// Real GLB model (see WarehouseModel.jsx), scaled/positioned to whatever
// footprint was drawn — replaces the old procedural gable-roofed shed
// entirely, shared with the DXF-parsed SHED-layer warehouses in
// YardScene.jsx so every warehouse in the yard is the same real building.
function WarehouseBuilding({ p, rawRing }) {
    const ring = useMemo(() => scaleRingAbout(rawRing, p.scale || 1), [rawRing, p.scale]);
    const angle = useMemo(() => principalAxis(ring), [ring]);
    const ext = useMemo(() => orientedExtent(ring, angle), [ring, angle]);
    return <WarehouseModel cx={ext.cx} cz={ext.cz} rotY={-angle} width={ext.len} depth={ext.width} />;
}

function GlassTower({ p, rawRing, spec }) {
    const { h, ring, shape, walls, centroid, seed } = useBuildingBasics(rawRing, p, spec.h);
    const mullions = useMemo(() => mullionPoints(ring, 2.6, 100), [ring]);
    const floorYs = useMemo(() => { const out = []; for (let y = 3.5; y < h; y += 3.5) out.push(y); return out; }, [h]);
    const bands = useMemo(() => edgeBands(ring, floorYs), [ring, floorYs]);
    return (
        <group>
            {/* Solid, not see-through — a glossy reflective surface reads as
                glass at this scale far more convincingly than actual
                transparency, which just looks washed-out/ghostly without a
                real environment reflection map. */}
            <mesh geometry={walls} castShadow receiveShadow>
                <meshPhysicalMaterial
                    color={p.color || "#bfe3f0"} roughness={0.08} metalness={0.35}
                    clearcoat={0.9} clearcoatRoughness={0.1} reflectivity={0.7}
                />
            </mesh>
            {mullions.map((m, i) => (
                <mesh key={i} position={[m.x, h / 2, m.z]} rotation={[0, m.rot, 0]}>
                    <boxGeometry args={[0.09, h, 0.07]} />
                    <meshStandardMaterial color="#2c3238" roughness={0.4} metalness={0.7} />
                </mesh>
            ))}
            {bands.map((b, i) => (
                <mesh key={i} position={[b.mx, b.y, b.mz]} rotation={[0, b.rot, 0]}>
                    <boxGeometry args={[b.len, 0.16, 0.1]} />
                    <meshStandardMaterial color="#e8edf1" roughness={0.4} metalness={0.5} />
                </mesh>
            ))}
            <FlatRoof shape={shape} centroid={centroid} h={h} color={p.roofColor || "#3a4148"} y={0.06} />
            <Parapet ring={ring} h={h} color="#2c3238" lip={0.5} />
            <RoofPlant ring={ring} h={h} seed={seed} budget={3} />
            <Entrance ring={ring} wide />
        </group>
    );
}

function ConcreteOffice({ p, rawRing, spec }) {
    const { h, ring, shape, walls, centroid, seed } = useBuildingBasics(rawRing, p, spec.h);
    const floorYs = useMemo(() => { const out = []; for (let y = 1.6; y < h; y += 3) out.push(y); return out; }, [h]);
    const bands = useMemo(() => edgeBands(ring, floorYs), [ring, floorYs]);
    return (
        <group>
            <mesh geometry={walls} castShadow receiveShadow>
                <meshStandardMaterial color={p.color || spec.color} roughness={0.8} metalness={0.05} />
            </mesh>
            {bands.map((b, i) => (
                <mesh key={i} position={[b.mx, b.y, b.mz]} rotation={[0, b.rot, 0]}>
                    <boxGeometry args={[Math.max(b.len - 0.6, 0.5), 1.4, 0.1]} />
                    <meshStandardMaterial color="#4c5560" roughness={0.35} metalness={0.4} />
                </mesh>
            ))}
            <FlatRoof shape={shape} centroid={centroid} h={h} color={p.roofColor || "#8f8f96"} />
            <Parapet ring={ring} h={h} color="#b9b2a4" />
            <RoofPlant ring={ring} h={h} seed={seed} />
            <Entrance ring={ring} wide />
        </group>
    );
}

function ResidentialBlock({ p, rawRing, spec }) {
    const { h, ring, shape, walls, centroid, seed } = useBuildingBasics(rawRing, p, spec.h);
    const floorYs = useMemo(() => { const out = []; for (let y = 3; y < h; y += 3) out.push(y); return out; }, [h]);
    const balconies = useMemo(() => balconyPoints(ring, floorYs, 4.5), [ring, floorYs]);
    // stair bulkhead on the roof — the classic apartment-block silhouette
    const bulk = useMemo(() => {
        const [cx, cz] = centroid;
        const off = Math.min(Math.sqrt(ringArea(ring)) * 0.15, 3);
        return { x: cx + off, z: cz - off };
    }, [ring, centroid]);
    return (
        <group>
            <mesh geometry={walls} castShadow receiveShadow>
                <meshStandardMaterial color={p.color || spec.color} roughness={0.85} metalness={0.02} />
            </mesh>
            <FlatRoof shape={shape} centroid={centroid} h={h} color={p.roofColor || "#8f8f96"} />
            <Parapet ring={ring} h={h} color="#b9a894" />
            <group position={[bulk.x, h, bulk.z]}>
                <mesh position={[0, 1.25, 0]} castShadow>
                    <boxGeometry args={[3, 2.5, 2.6]} />
                    <meshStandardMaterial color="#b9a894" roughness={0.85} />
                </mesh>
                <mesh position={[0, 2.6, 0]}>
                    <boxGeometry args={[3.3, 0.2, 2.9]} />
                    <meshStandardMaterial color="#8f8a80" roughness={0.85} />
                </mesh>
            </group>
            <RoofPlant ring={ring} h={h} seed={seed} tanks budget={3} />
            {balconies.map((b, i) => (
                <group key={i} position={[b.x, b.y, b.z]} rotation={[0, b.rot, 0]}>
                    <mesh position={[0, 0, 0.55]} castShadow>
                        <boxGeometry args={[1.6, 0.1, 1.1]} />
                        <meshStandardMaterial color="#d7d2c4" roughness={0.8} />
                    </mesh>
                    <mesh position={[0, 0.45, 1.05]}>
                        <boxGeometry args={[1.6, 0.9, 0.06]} />
                        <meshStandardMaterial color="#c9d2d6" roughness={0.4} metalness={0.3} />
                    </mesh>
                    {/* window behind the balcony */}
                    <mesh position={[0, 0.85, 0.02]}>
                        <boxGeometry args={[1.4, 1.5, 0.04]} />
                        <meshStandardMaterial color="#6f8a9a" roughness={0.2} metalness={0.3} />
                    </mesh>
                </group>
            ))}
            <Entrance ring={ring} />
        </group>
    );
}

function FactoryShed({ p, rawRing, spec }) {
    const { h, ring, shape, walls, centroid, seed } = useBuildingBasics(rawRing, p, spec.h);
    const [cx, cz] = centroid;
    return (
        <group>
            <mesh geometry={walls} castShadow receiveShadow>
                <meshStandardMaterial color={p.color || spec.color} roughness={0.75} metalness={0.15} />
            </mesh>
            <FlatRoof shape={shape} centroid={centroid} h={h} color={p.roofColor || "#7d868f"} />
            <Parapet ring={ring} h={h} color="#6b747d" lip={0.3} />
            {/* roof vents + a proper stack */}
            {[-0.25, 0.25].map((t, i) => (
                <mesh key={i} position={[cx + t * 4, h + 0.9, cz + t * 4]} rotation={[0, Math.PI / 4, 0]}>
                    <cylinderGeometry args={[0.5, 0.5, 1.4, 10]} />
                    <meshStandardMaterial color="#5b6570" roughness={0.6} metalness={0.3} />
                </mesh>
            ))}
            <mesh position={[cx - 3, h + 2.4, cz + 2]} castShadow>
                <cylinderGeometry args={[0.35, 0.5, 4.8, 10]} />
                <meshStandardMaterial color="#8f6a52" roughness={0.7} />
            </mesh>
            <RoofPlant ring={ring} h={h} seed={seed} budget={2} />
            <RollerDoors ring={ring} h={h} count={2} />
        </group>
    );
}

// Workshop gets its own mono-pitch shed roof (one sloped slab along the
// drawn shape's long axis) so it reads as visibly different from the plain
// flat-roofed Building at a glance, not just by its roller doors.
function WorkshopBuilding({ p, rawRing, spec }) {
    const { h, ring, walls, centroid, seed } = useBuildingBasics(rawRing, p, spec.h);
    const angle = useMemo(() => principalAxis(ring), [ring]);
    const ext = useMemo(() => orientedExtent(ring, angle), [ring, angle]);
    const rise = Math.min(ext.width * 0.22, 3.5);
    const roof = useMemo(() => {
        const s = new THREE.Shape();
        // single slope, low side first — a real shed roof, not a symmetric gable
        s.moveTo(-ext.width / 2, 0);
        s.lineTo(ext.width / 2, rise);
        s.lineTo(ext.width / 2, rise + 0.25);
        s.lineTo(-ext.width / 2, 0.25);
        s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth: ext.len, bevelEnabled: false });
        g.translate(0, 0, -ext.len / 2);
        g.rotateY(Math.PI / 2);
        return g;
    }, [ext.width, ext.len, rise]);
    const wallMap = useMemo(() => tiledTex("bldgWall", makeBuildingWallTex, (ext.len + ext.width) / 6, h / 2.5), [ext.len, ext.width, h]);
    return (
        <group>
            <mesh geometry={walls} castShadow receiveShadow>
                <meshStandardMaterial map={wallMap} color={p.color || spec.color} roughness={0.78} metalness={0.08} />
            </mesh>
            <mesh geometry={roof} position={[ext.cx, h, ext.cz]} rotation={[0, -angle, 0]} castShadow>
                <meshStandardMaterial color={p.roofColor || "#7d868f"} roughness={0.55} metalness={0.2} />
            </mesh>
            {/* eaves gutter along the low edge */}
            <mesh position={[ext.cx + Math.sin(angle) * 0, h + 0.15, ext.cz]} rotation={[0, -angle, 0]}>
                <boxGeometry args={[Math.max(ext.len - 0.5, 1), 0.18, 0.18]} />
                <meshStandardMaterial color="#5b6570" roughness={0.5} metalness={0.4} />
            </mesh>
            <RoofPlant ring={ring} h={h + rise * 0.4} seed={seed} budget={1} />
            <RollerDoors ring={ring} h={h} count={2} />
        </group>
    );
}

function GlassBuilding({ p, rawRing, spec }) {
    const { h, ring, shape, walls, centroid } = useBuildingBasics(rawRing, p, spec.h);
    const mullions = useMemo(() => mullionPoints(ring, 3, 80), [ring]);
    return (
        <group>
            {/* Solid, not see-through — same reasoning as the commercial glass
                tower: a glossy opaque surface reads as glass much better than
                real transparency without an environment map. */}
            <mesh geometry={walls} castShadow receiveShadow>
                <meshPhysicalMaterial
                    color={p.color || "#bfe3f0"} roughness={0.1} metalness={0.3}
                    clearcoat={0.85} clearcoatRoughness={0.12} reflectivity={0.65}
                />
            </mesh>
            {mullions.map((m, i) => (
                <mesh key={i} position={[m.x, h / 2, m.z]} rotation={[0, m.rot, 0]}>
                    <boxGeometry args={[0.1, h, 0.08]} />
                    <meshStandardMaterial color="#3a4148" roughness={0.5} metalness={0.6} />
                </mesh>
            ))}
            <FlatRoof shape={shape} centroid={centroid} h={h} color={p.roofColor || "#3a4148"} y={0.06} />
            <Parapet ring={ring} h={h} color="#3a4148" lip={0.4} />
            <Entrance ring={ring} wide />
        </group>
    );
}

// building / workshop / cabin — same extrusion, a flat roof cap, a window
// grid wrapping every wall, and details keyed off the drawn shape's longest
// edge. `p.color` overrides the palette default when the colour picker in
// the panel has been used.
function GenericBuilding({ p, rawRing, spec }) {
    const { h, ring, shape, walls, centroid, seed } = useBuildingBasics(rawRing, p, spec.h);
    const wallColor = p.color || spec.color;
    const isCabin = p.type === "cabin";
    const isWorkshop = p.type === "workshop" || p.type === "workshop_custom";
    const windowRows = isCabin ? 1 : Math.max(1, Math.floor((h - 1.2) / 3));
    const floorYs = useMemo(() => {
        const out = [];
        for (let k = 0; k < windowRows; k++) out.push(1.3 + k * ((h - 1.8) / Math.max(1, windowRows)));
        return out;
    }, [h, windowRows]);
    const windows = useMemo(() => {
        const out = []; let budget = 140;
        for (const y of floorYs) {
            for (let i = 0; i < ring.length && budget > 0; i++) {
                const a = ring[i], b = ring[(i + 1) % ring.length];
                const dx = b[0] - a[0], dz = b[1] - a[1];
                const len = Math.hypot(dx, dz);
                if (len < 2) continue;
                const n = Math.max(1, Math.round(len / 2.4));
                const rot = Math.atan2(-dz, dx);
                const winLen = Math.min(1.5, (len / n) * 0.55);
                for (let k = 0; k < n && budget > 0; k++) {
                    const t = (k + 0.5) / n;
                    out.push({ x: a[0] + dx * t, z: a[1] + dz * t, y, rot, len: winLen });
                    budget--;
                }
            }
        }
        return out;
    }, [ring, floorYs]);
    const detail = useMemo(() => longestEdge(ring), [ring]);

    // Simple footprints get a real hipped-looking gable roof with an eaves
    // overhang and fascia instead of the invisible flat cap — the flat cap is
    // what made these read as cheap unfinished boxes. Complex polygons keep
    // the flat roof + parapet, where a single gable can't follow the outline.
    // Cabins (site/porta cabins) are simple rectangles too, so they qualify —
    // they just get a shallower corrugated shed roof instead of a full gable.
    const simpleRect = ring.length <= 6;
    const angle = useMemo(() => (simpleRect ? principalAxis(ring) : 0), [ring, simpleRect]);
    const ext = useMemo(() => (simpleRect ? orientedExtent(ring, angle) : null), [ring, angle, simpleRect]);
    const gable = useMemo(() => {
        if (!ext || isCabin) return null;
        const over = 0.6;                              // eaves overhang
        const w = ext.width + over * 2, l = ext.len + over * 2;
        const rise = Math.min(w * 0.24, 4);
        const tri = new THREE.Shape();
        tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, rise); tri.closePath();
        const g = new THREE.ExtrudeGeometry(tri, { depth: l, bevelEnabled: false });
        g.translate(0, 0, -l / 2);
        g.rotateY(Math.PI / 2);
        return { g, rise, w, l };
    }, [ext, isCabin]);

    // Cabins get a shallow single-slope corrugated roof — the standard look
    // for a site/porta cabin — instead of the taller symmetric gable used by
    // full buildings.
    const cabinRoof = useMemo(() => {
        if (!ext || !isCabin) return null;
        const over = 0.4;
        const w = ext.width + over * 2, l = ext.len + over * 2;
        const rise = Math.min(w * 0.16, 0.9);
        const s = new THREE.Shape();
        s.moveTo(-w / 2, 0.16); s.lineTo(w / 2, rise + 0.16);
        s.lineTo(w / 2, rise); s.lineTo(-w / 2, 0);
        s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth: l, bevelEnabled: false });
        g.translate(0, 0, -l / 2);
        g.rotateY(Math.PI / 2);
        const ridgeCount = Math.max(3, Math.round(l / 0.5));
        const ridges = [];
        for (let i = 0; i < ridgeCount; i++) ridges.push(-l / 2 + ((i + 0.5) / ridgeCount) * l);
        return { g, rise, w, l, ridges };
    }, [ext, isCabin]);
    const perimeterEst = useMemo(() => {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const [x, y] of ring) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
        return (maxX - minX) + (maxY - minY);
    }, [ring]);
    const wallMap = useMemo(() => tiledTex("bldgWall", makeBuildingWallTex, perimeterEst / 6, h / 2.5), [perimeterEst, h]);

    return (
        <group>
            <mesh geometry={walls} castShadow receiveShadow>
                <meshStandardMaterial map={wallMap} color={wallColor} roughness={0.8} metalness={0.04} />
            </mesh>
            {/* plinth band grounds the building instead of it meeting the tarmac raw */}
            <mesh geometry={walls} scale={[1.012, 0.08, 1.012]} position={[centroid[0] * -0.012, 0, centroid[1] * -0.012]}>
                <meshStandardMaterial color="#8b8578" roughness={0.9} />
            </mesh>
            {gable ? (
                <group position={[ext.cx, h - 0.05, ext.cz]} rotation={[0, -angle, 0]}>
                    <mesh geometry={gable.g} castShadow>
                        <meshStandardMaterial color={p.roofColor || "#7d5a4a"} roughness={0.7} metalness={0.08} />
                    </mesh>
                    {/* fascia boards along both eaves */}
                    {[-1, 1].map(s => (
                        <mesh key={s} position={[0, -0.12, s * gable.w / 2]}>
                            <boxGeometry args={[gable.l, 0.3, 0.12]} />
                            <meshStandardMaterial color="#efe9dd" roughness={0.7} />
                        </mesh>
                    ))}
                    {/* ridge cap */}
                    <mesh position={[0, gable.rise + 0.06, 0]}>
                        <boxGeometry args={[gable.l, 0.14, 0.4]} />
                        <meshStandardMaterial color="#5c4438" roughness={0.65} />
                    </mesh>
                </group>
            ) : cabinRoof ? (
                <group position={[ext.cx, h, ext.cz]} rotation={[0, -angle, 0]}>
                    <mesh geometry={cabinRoof.g} castShadow>
                        <meshStandardMaterial color={p.roofColor || "#c7ccd1"} roughness={0.5} metalness={0.35} />
                    </mesh>
                    {/* corrugation ridges along the sheet */}
                    {cabinRoof.ridges.map((u, i) => (
                        <mesh key={i} position={[u, cabinRoof.rise / 2 + 0.2, 0]} rotation={[cabinRoof.rise > 0 ? Math.atan2(cabinRoof.rise, cabinRoof.w) : 0, 0, 0]}>
                            <boxGeometry args={[0.05, 0.03, cabinRoof.w + 0.1]} />
                            <meshStandardMaterial color="#9aa1a8" roughness={0.4} metalness={0.4} />
                        </mesh>
                    ))}
                    {/* low eave gutter on the down-slope side */}
                    <mesh position={[0, 0.12, cabinRoof.w / 2]}>
                        <boxGeometry args={[cabinRoof.l, 0.12, 0.12]} />
                        <meshStandardMaterial color="#5b6570" roughness={0.5} metalness={0.4} />
                    </mesh>
                </group>
            ) : (
                <FlatRoof shape={shape} centroid={centroid} h={h} color={p.roofColor || "#6b6f76"} />
            )}
            {!isCabin && !gable && <Parapet ring={ring} h={h} color="#9aa1aa" lip={0.3} />}
            {!isCabin && !gable && <RoofPlant ring={ring} h={h} seed={seed} budget={2} />}

            {windows.map((w, i) => (
                <group key={i} position={[w.x, w.y, w.z]} rotation={[0, w.rot, 0]}>
                    <mesh position={[0, 0, 0.04]}>
                        <boxGeometry args={[w.len, 1.15, 0.06]} />
                        <meshStandardMaterial color="#4a4438" roughness={0.6} metalness={0.3} />
                    </mesh>
                    <mesh position={[0, 0, 0.08]}>
                        <boxGeometry args={[w.len * 0.82, 0.92, 0.03]} />
                        <meshStandardMaterial color="#7a9cae" roughness={0.2} metalness={0.35} />
                    </mesh>
                    {/* sill */}
                    <mesh position={[0, -0.62, 0.09]}>
                        <boxGeometry args={[w.len + 0.12, 0.07, 0.14]} />
                        <meshStandardMaterial color="#b9b2a4" roughness={0.8} />
                    </mesh>
                </group>
            ))}

            {!isCabin && !isWorkshop && <Entrance ring={ring} />}
            {isWorkshop && <RollerDoors ring={ring} h={h} count={2} />}
            {detail && isCabin && (
                <group>
                    <mesh position={[detail.mx, h * 0.4, detail.mz]} rotation={[0, detail.rot, 0]}>
                        <boxGeometry args={[1.1, h * 0.75, 0.06]} />
                        <meshStandardMaterial color="#4a4438" roughness={0.7} />
                    </mesh>
                    {/* cabin sits on blocks with an AC unit — the classic site cabin */}
                    <mesh position={[detail.mx - 2, h * 0.6, detail.mz]} rotation={[0, detail.rot, 0]}>
                        <boxGeometry args={[0.9, 0.6, 0.3]} />
                        <meshStandardMaterial color="#e8e8e2" roughness={0.6} />
                    </mesh>
                </group>
            )}
        </group>
    );
}

const POLYGON_RENDERERS = {
    warehouse: WarehouseBuilding,
    office_glass: GlassTower,
    office_concrete: ConcreteOffice,
    residential: ResidentialBlock,
    factory: FactoryShed,
    glass_building: GlassBuilding,
    // Workshop gets its own mono-pitch shed roof so it's visibly different
    // from the flat-roofed Building, not just its roller doors.
    workshop: WorkshopBuilding,
    workshop_custom: WorkshopBuilding,
};

// Building-mounted floodlights — the wall-pack equivalent of the high-mast
// lighting in Masts.jsx (same real PointLight + ground-glow-decal pattern,
// see lightGlowTexture.js for why both exist together). Lives here rather
// than inside each of the half-dozen building components below because
// every building type funnels through PolygonBuilding regardless of shape —
// one hook point instead of six. Mounted at up to two opposite corners near
// the roofline rather than every corner: buildings can be numerous, and a
// PointLight per corner per building would add up fast.
function BuildingNightLights({ h, ring, nightOn }) {
    const corners = useMemo(() => {
        if (!ring || ring.length < 3) return [];
        const n = ring.length;
        return n >= 4 ? [ring[0], ring[Math.floor(n / 2)]] : [ring[0]];
    }, [ring]);

    if (nightOn <= 0.08 || !corners.length) return null;
    const fixtureY = Math.max(2, h * 0.85);

    return (
        <>
            {corners.map(([x, z], i) => (
                <group key={`fx-${i}`} position={[x, fixtureY, z]}>
                    <mesh>
                        <boxGeometry args={[0.6, 0.35, 0.4]} />
                        <meshStandardMaterial color="#f4f8ff" emissive="#eaf2ff" emissiveIntensity={0.4 + nightOn * 1.6} />
                    </mesh>
                    <pointLight color="#eef4ff" intensity={nightOn * 300} distance={68} decay={1.2} />
                </group>
            ))}
            {/* Ground glow decal removed — same overexposure issue flagged on the
                mast lights (Masts.jsx), same fix. */}
        </>
    );
}

function PolygonBuilding({ p, ring, dayFactor = 1 }) {
    const spec = PROP_SPECS[p.type];
    const Comp = POLYGON_RENDERERS[p.type] || GenericBuilding;
    const h = p.h ?? spec.h;
    const scaledRing = useMemo(() => scaleRingAbout(ring, p.scale || 1), [ring, p.scale]);
    const nightOn = Math.max(0, Math.min(1, 1 - dayFactor));
    return (
        <>
            <Comp p={p} rawRing={ring} spec={spec} />
            <BuildingNightLights h={h} ring={scaledRing} nightOn={nightOn} />
        </>
    );
}

// ── polyline props (roads, fences, rail — drawn vertex by vertex) ──────
function RoadSegment({ len, width, color, stripeColor, curbs = false, dashed = false, bays = false }) {
    // real dashed centre-line: 3 m dash / 3 m gap, like actual road marking
    const dashes = useMemo(() => {
        if (!dashed) return [];
        const out = [];
        const cycle = 6, dash = 3;
        const n = Math.floor(len / cycle);
        for (let i = 0; i < Math.min(n, 40); i++) out.push(-len / 2 + i * cycle + cycle / 2);
        return out.length ? out : (len > 2 ? [0] : []);
    }, [len, dashed]);
    const bayTicks = useMemo(() => {
        if (!bays) return [];
        const out = [];
        const n = Math.min(30, Math.floor(len / 5.5));
        for (let i = 0; i <= n; i++) out.push(-len / 2 + (i / Math.max(1, n)) * len);
        return out;
    }, [len, bays]);
    // Real worn-asphalt texture (speckle + faint lane hints) instead of a
    // flat fill — `color` still tints it, so road/parking/footpath keep
    // their own distinct tone on top of the same surface detail.
    const asphaltMap = useMemo(() => tiledTex("asphalt", makeAsphaltTex, len / 6, width / 6), [len, width]);
    return (
        <group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
                <planeGeometry args={[len, width]} />
                <meshStandardMaterial map={asphaltMap} color={color} roughness={0.92} />
            </mesh>
            {/* worn wheel-track band down the middle — reads as used asphalt
                rather than a flat freshly-painted plane */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.032, 0]}>
                <planeGeometry args={[len * 0.98, width * 0.55]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.08} />
            </mesh>
            {/* unpaved gravel shoulder outside the edge line, on both sides */}
            {[-1, 1].map(s => (
                <mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, s * (width / 2 + 0.55)]} receiveShadow>
                    <planeGeometry args={[len, 1.1]} />
                    <meshStandardMaterial color="#8f8770" roughness={1} />
                </mesh>
            ))}
            {dashed ? dashes.map((u, i) => (
                <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[u, 0.05, 0]}>
                    <planeGeometry args={[3, width * 0.035]} />
                    <meshBasicMaterial color={stripeColor} transparent opacity={0.85} />
                </mesh>
            )) : stripeColor && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
                    <planeGeometry args={[len * 0.94, width * 0.05]} />
                    <meshBasicMaterial color={stripeColor} transparent opacity={0.85} />
                </mesh>
            )}
            {/* edge lines */}
            {dashed && [-1, 1].map(s => (
                <mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, s * width * 0.46]}>
                    <planeGeometry args={[len * 0.98, width * 0.02]} />
                    <meshBasicMaterial color="#e8e4cf" transparent opacity={0.6} />
                </mesh>
            ))}
            {curbs && [-1, 1].map(s => (
                <mesh key={s} position={[0, 0.1, s * (width / 2 + 0.12)]}>
                    <boxGeometry args={[len, 0.22, 0.24]} />
                    <meshStandardMaterial color="#b6b0a2" roughness={0.85} />
                </mesh>
            ))}
            {bayTicks.map((u, i) => (
                <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[u, 0.05, 0]}>
                    <planeGeometry args={[0.12, width * 0.92]} />
                    <meshBasicMaterial color="#f5f5f0" transparent opacity={0.9} />
                </mesh>
            ))}
        </group>
    );
}

// Small disc dropped at each polyline vertex so bends in a road don't show
// a wedge-shaped gap between the two straight segments.
function RoadJoint({ width, color }) {
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.031, 0]}>
            <circleGeometry args={[width / 2, 14]} />
            <meshStandardMaterial color={color} roughness={0.92} />
        </mesh>
    );
}

function FenceSegment({ len }) {
    const postCount = Math.min(24, Math.max(2, Math.round(len / 4) + 1));
    const posts = [];
    for (let i = 0; i < postCount; i++) posts.push(-len / 2 + (i / (postCount - 1)) * len);
    // Diamond crosshatch on top of the flat translucent panel — reads as
    // actual mesh wire instead of a fogged pane of glass. Pitched at ~3.5m so
    // long runs (some fences here span 100m+) don't turn into hundreds of
    // separate meshes; that many uninstanced draw calls stalled the
    // SwiftShader test renderer outright at a finer pitch.
    const meshH = 1.7, meshY = 0.9;
    const diagCount = Math.min(16, Math.max(2, Math.round(len / 3.5)));
    const diagPitch = len / diagCount;
    const diagLen = Math.hypot(diagPitch, meshH) * 1.02;
    const diagAngle = Math.atan2(meshH, diagPitch);
    return (
        <group>
            <mesh position={[0, 1.75, 0]}>
                <boxGeometry args={[len, 0.05, 0.05]} />
                <meshStandardMaterial color="#8f96a0" roughness={0.6} metalness={0.3} />
            </mesh>
            {/* chain-link mesh: faint solid backing + a diamond crosshatch of thin struts */}
            <mesh position={[0, meshY, 0]}>
                <boxGeometry args={[len, meshH, 0.015]} />
                <meshStandardMaterial color="#aab0b8" roughness={0.6} metalness={0.4} transparent opacity={0.22} />
            </mesh>
            {Array.from({ length: diagCount }, (_, i) => -len / 2 + (i + 0.5) * diagPitch).map((u, i) => (
                <group key={i}>
                    <mesh position={[u, meshY, 0]} rotation={[0, 0, diagAngle]}>
                        <boxGeometry args={[diagLen, 0.025, 0.02]} />
                        <meshStandardMaterial color="#9198a2" roughness={0.5} metalness={0.5} />
                    </mesh>
                    <mesh position={[u, meshY, 0]} rotation={[0, 0, -diagAngle]}>
                        <boxGeometry args={[diagLen, 0.025, 0.02]} />
                        <meshStandardMaterial color="#9198a2" roughness={0.5} metalness={0.5} />
                    </mesh>
                </group>
            ))}
            {posts.map((u, i) => (
                <group key={i} position={[u, 0, 0]}>
                    <mesh position={[0, 0.95, 0]}>
                        <cylinderGeometry args={[0.05, 0.05, 1.9, 6]} />
                        <meshStandardMaterial color="#6b7280" roughness={0.6} metalness={0.3} />
                    </mesh>
                    {/* barbed-wire arm leaning outward */}
                    <mesh position={[0, 2.05, 0.16]} rotation={[0.6, 0, 0]}>
                        <boxGeometry args={[0.05, 0.5, 0.05]} />
                        <meshStandardMaterial color="#6b7280" roughness={0.6} metalness={0.3} />
                    </mesh>
                </group>
            ))}
            {/* three barbed strands along the arms */}
            {[0.08, 0.2, 0.32].map((z, i) => (
                <mesh key={i} position={[0, 2 + i * 0.11, 0.1 + z * 0.8]}>
                    <boxGeometry args={[len, 0.022, 0.022]} />
                    <meshStandardMaterial color="#9aa1aa" roughness={0.5} metalness={0.5} />
                </mesh>
            ))}
        </group>
    );
}

// Renders the same industrial concrete + reinforced-pillar + security-fence
// wall as the real DXF-derived perimeter (see PerimeterWallSystem.jsx /
// IndustrialWallPanel.jsx) — a hand-drawn "custom" wall in the Yard Builder
// is meant to read as the same wall system, not a lookalike. `h` comes from
// the panel's H control; IndustrialWallPanel handles corner/joint overlap,
// end pillars and end lights internally.
function CompoundWallSegment({ len, h = 2, color, nightOn = 0 }) {
    return <IndustrialWallPanel len={len} h={h} color={color} nightOn={nightOn} />;
}

function HedgeSegment({ len }) {
    const blobs = Math.min(30, Math.max(1, Math.round(len / 1.4)));
    const out = [];
    for (let i = 0; i < blobs; i++) out.push(-len / 2 + ((i + 0.5) / blobs) * len);
    return (
        <group>
            <mesh position={[0, 0.55, 0]} castShadow>
                <boxGeometry args={[len, 1.1, 0.85]} />
                <meshStandardMaterial color="#43703d" roughness={0.95} />
            </mesh>
            {out.map((u, i) => (
                <mesh key={i} position={[u, 1.05 + hash01(u, i, 2) * 0.15, (hash01(u, i, 3) - 0.5) * 0.3]}>
                    <icosahedronGeometry args={[0.42, 0]} />
                    <meshStandardMaterial color={i % 2 ? "#4a7a44" : "#3f6b39"} roughness={0.95} flatShading />
                </mesh>
            ))}
        </group>
    );
}

function RailSegment({ len }) {
    const sleeperCount = Math.min(60, Math.max(2, Math.round(len / 2)));
    const sleepers = [];
    for (let i = 0; i < sleeperCount; i++) sleepers.push(-len / 2 + ((i + 0.5) / sleeperCount) * len);
    return (
        <group>
            {/* ballast bed */}
            <mesh position={[0, 0.05, 0]} receiveShadow>
                <boxGeometry args={[len, 0.14, 3.4]} />
                <meshStandardMaterial color="#7d786e" roughness={1} />
            </mesh>
            {[-0.72, 0.72].map(off => (
                <mesh key={off} position={[0, 0.24, off]}>
                    <boxGeometry args={[len, 0.16, 0.1]} />
                    <meshStandardMaterial color="#6d6357" roughness={0.5} metalness={0.7} />
                </mesh>
            ))}
            {sleepers.map((u, i) => (
                <mesh key={i} position={[u, 0.16, 0]} receiveShadow>
                    <boxGeometry args={[0.26, 0.16, 2.4]} />
                    <meshStandardMaterial color="#4a3f35" roughness={0.95} />
                </mesh>
            ))}
        </group>
    );
}

// ── security wall — real GLB model, scaled to fill each drawn segment ──────
// Same scale-to-fit + tint + fallback approach as CustomModelProp/
// WarehouseModel: the model's own bounding box tells us its natural size, so
// it stretches to exactly `len` (the clicked segment's real length) without
// needing to know its authored units ahead of time.
const SECURITY_WALL_GLB_PATH = "/models/security-wall.glb";
useGLTF.preload(SECURITY_WALL_GLB_PATH);

function SecurityWallGlb({ len, h, color }) {
    const { scene } = useGLTF(SECURITY_WALL_GLB_PATH);
    const instance = useMemo(() => {
        const clone = scene.clone(true);
        clone.traverse((o) => {
            if (!o.isMesh) return;
            o.castShadow = true; o.receiveShadow = true;
            if (color) { o.material = o.material.clone(); o.material.color = new THREE.Color(color); }
        });
        return clone;
    }, [scene, color]);

    const { sx, sy, liftY } = useMemo(() => {
        const box = new THREE.Box3().setFromObject(instance);
        const size = new THREE.Vector3(); box.getSize(size);
        const targetH = h || 3;
        const s_x = size.x > 0.01 ? len / size.x : 1;
        const s_y = size.y > 0.01 ? targetH / size.y : 1;
        // A degenerate segment (near-zero click, or a bad/empty GLB bounding
        // box) can produce 0/NaN/Infinity here — one non-finite scale on any
        // object corrupts the whole scene's shadow-frustum/bounding-sphere
        // computation, which is what a "screen goes black after drawing a
        // wall" report actually is. Never hand Three.js a non-finite number.
        const safeSx = safeScale(s_x), safeSy = safeScale(s_y);
        return { sx: safeSx, sy: safeSy, liftY: -box.min.y * safeSy };
    }, [instance, len, h]);

    if (!(len > 0.01)) return null; // segment too short to meaningfully render

    // Depth (wall thickness) tracks the height scale rather than an
    // independent guess — a taller wall panel is naturally thicker too.
    return <primitive object={instance} scale={[sx, sy, sy]} position={[0, liftY, 0]} />;
}

function SecurityWallSegment({ len, h, color, nightOn = 0 }) {
    const fallback = <CompoundWallSegment len={len} h={h ?? 3} color={color} nightOn={nightOn} />;
    return (
        <Suspense fallback={fallback}>
            <CustomModelBoundary fallback={fallback}>
                <SecurityWallGlb len={len} h={h} color={color} />
            </CustomModelBoundary>
        </Suspense>
    );
}

// Wall height floor — 2 stacked container tiers (WALL_TOTAL_H, ~5.26m),
// matching the real perimeter (PerimeterWallSystem's TOTAL_H) so a hand-
// drawn wall never reads as shorter than the real boundary it's meant to
// extend. Math.max rather than a flat override so a wall the user
// deliberately made taller keeps its custom height.
const WALL_HEIGHT_FLOOR = WALL_TOTAL_H;

function PolylineSegment({ type, len, h, color, nightOn }) {
    if (type === "road") return <RoadSegment len={len} width={7} color="#2b2e33" stripeColor="#d8d3b8" curbs dashed />;
    if (type === "parking") return <RoadSegment len={len} width={3.5} color="#9aa0a8" bays />;
    if (type === "footpath") return <RoadSegment len={len} width={1.8} color="#c9c2b0" curbs />;
    if (type === "rail") return <RailSegment len={len} />;
    if (type === "compound_wall") return <CompoundWallSegment len={len} h={Math.max(h ?? 2, WALL_HEIGHT_FLOOR)} color={color} nightOn={nightOn} />;
    if (type === "security_wall") return <SecurityWallSegment len={len} h={Math.max(h ?? 3, WALL_HEIGHT_FLOOR)} color={color} nightOn={nightOn} />;
    if (type === "hedge") return <HedgeSegment len={len} />;
    return <FenceSegment len={len} />;
}
const POLYLINE_JOINT_COLORS = { road: "#2b2e33", parking: "#9aa0a8", footpath: "#c9c2b0" };

// ── the rendered layer ──────────────────────────────────────────────────
// Real DXF-derived perimeter, converted to scene-space segments once — used
// only to detect when a hand-drawn wall's end point lands near the real
// boundary, so that end can be stretched to meet it (see WALL_MERGE_TYPES
// below). Same {ax,az,bx,bz} shape and conversion PerimeterWallSystem uses
// for its own segments.
function useRealFenceSegs(realFences, alignment) {
    return useMemo(() => {
        if (!realFences?.length || !alignment) return [];
        const out = [];
        for (const ls of realFences) {
            if (!ls || ls.length < 2) continue;
            for (let i = 0; i + 1 < ls.length; i++) {
                const a = dxfPointToScene(ls[i][0], ls[i][1], alignment);
                const b = dxfPointToScene(ls[i + 1][0], ls[i + 1][1], alignment);
                out.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z });
            }
        }
        return out;
    }, [realFences, alignment]);
}
function pointToSegDist(px, pz, s) {
    const dx = s.bx - s.ax, dz = s.bz - s.az;
    const len2 = dx * dx + dz * dz;
    let t = len2 > 1e-9 ? ((px - s.ax) * dx + (pz - s.az) * dz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (s.ax + dx * t), pz - (s.az + dz * t));
}
function nearestRealWallDist(px, pz, realSegs) {
    let best = Infinity;
    for (const s of realSegs) { const d = pointToSegDist(px, pz, s); if (d < best) best = d; }
    return best;
}
// compound_wall / security_wall only — a fence/hedge/road drawn near the
// boundary isn't meant to visually fuse into the concrete perimeter.
const WALL_MERGE_TYPES = new Set(["compound_wall", "security_wall"]);
const WALL_MERGE_MAX = 5; // metres — beyond this a wall end is presumed unrelated to the boundary, not "just short of it"

export default function PropsLayer({ props, alignment, pickable = false, onPick, dayFactor = 1, realFences }) {
    const nightOn = Math.max(0, Math.min(1, 1 - dayFactor));
    const realSegs = useRealFenceSegs(realFences, alignment);
    const placed = useMemo(() => {
        if (!props || !props.length) return [];
        return props.map((p, i) => {
            const spec = PROP_SPECS[p.type];
            if (!spec) return null;
            if (spec.footprint === "point") {
                const c = dxfPointToScene(p.x, p.y, alignment);
                return { p, i, kind: "point", x: c.x, z: c.z, rotY: (-(p.rot || 0) * Math.PI) / 180 };
            }
            const scenePts = (p.points || []).map(([x, y]) => {
                const c = dxfPointToScene(x, y, alignment);
                return [c.x, c.z];
            });
            // "rect" (the quick two-click square tool) ends up as an ordinary
            // 4-point ring — same renderer, select, move and rotate as "polygon".
            if (spec.footprint === "polygon" || spec.footprint === "rect") {
                if (scenePts.length < 3) return null;
                return { p, i, kind: "polygon", ring: scenePts };
            }
            if (scenePts.length < 2) return null;
            // Merge near-duplicate consecutive clicks instead of skipping the
            // tiny segment between them — skipping is what used to leave a
            // visible break in a wall where two clicks landed almost together.
            const cleaned = [scenePts[0]];
            for (let k = 1; k < scenePts.length; k++) {
                const prev = cleaned[cleaned.length - 1];
                if (Math.hypot(scenePts[k][0] - prev[0], scenePts[k][1] - prev[1]) < 0.05) continue;
                cleaned.push(scenePts[k]);
            }
            if (cleaned.length < 2) return null;
            // Merge corner to the real perimeter — if this wall's drawn start/
            // end lands near (but not exactly on) the real DXF boundary, push
            // that end outward along the wall's own last heading until it
            // reaches the real wall, so the junction reads as one continuous
            // structure instead of leaving a gap. Only applies to wall-ish
            // types, and only within WALL_MERGE_MAX so an unrelated interior
            // wall isn't dragged toward the boundary.
            if (WALL_MERGE_TYPES.has(p.type) && realSegs.length) {
                const extend = (idx, otherIdx) => {
                    const [px, pz] = cleaned[idx];
                    const dist = nearestRealWallDist(px, pz, realSegs);
                    if (dist > 0.15 && dist < WALL_MERGE_MAX) {
                        const [ox, oz] = cleaned[otherIdx];
                        const dx = px - ox, dz = pz - oz;
                        const dlen = Math.hypot(dx, dz) || 1;
                        const push = Math.min(dist + 0.3, WALL_MERGE_MAX);
                        cleaned[idx] = [px + (dx / dlen) * push, pz + (dz / dlen) * push];
                    }
                };
                extend(0, 1);
                extend(cleaned.length - 1, cleaned.length - 2);
            }
            const segs = [];
            for (let k = 0; k + 1 < cleaned.length; k++) {
                const [ax, az] = cleaned[k], [bx, bz] = cleaned[k + 1];
                const dx = bx - ax, dz = bz - az;
                const len = Math.hypot(dx, dz);
                segs.push({ x: (ax + bx) / 2, z: (az + bz) / 2, len, rotY: Math.atan2(-dz, dx) });
            }
            // interior vertices get a joint disc so bends don't show seams
            const joints = cleaned.slice(1, -1);
            return { p, i, kind: "polyline", segs, joints, all: cleaned };
        }).filter(Boolean);
    }, [props, alignment, realSegs]);

    if (!placed.length) return null;

    return (
        <group>
            {placed.map(item => {
                const { p, i } = item;
                const spec = PROP_SPECS[p.type];
                const pick = pickable ? (e) => { e.stopPropagation(); onPick?.(i); } : undefined;

                if (item.kind === "point") {
                    const PointComp = POINT_RENDERERS[p.type];
                    const seeded = SEEDED_POINT_TYPES.has(p.type);
                    const isCustom = p.type === "custom_model";
                    // Width (X/Z) and height (Y) scale independently — widening
                    // a gate shouldn't also stretch its posts. `scale` is the
                    // older uniform field, kept as a fallback for props placed
                    // before the split existed.
                    const sw = p.scaleX ?? p.scale ?? 1;
                    const sh = p.scaleY ?? p.scale ?? 1;
                    return (
                        <React.Fragment key={p.id ?? i}>
                            <group position={[item.x, 0, item.z]} rotation={[0, item.rotY, 0]}
                                scale={[sw, sh, sw]} onClick={pick}>
                                {isCustom
                                    ? <CustomModelProp url={p.modelUrl} color={p.color} />
                                    : PointComp && (seeded
                                        ? <PointComp seed={item.x * 0.71 + item.z * 1.13} nightOn={nightOn} />
                                        : <PointComp nightOn={nightOn} />)}
                                {pickable && (
                                    <mesh position={[0, 3, 0]} visible={false} onClick={pick}>
                                        <cylinderGeometry args={[2.5, 2.5, 10, 8]} />
                                        <meshBasicMaterial />
                                    </mesh>
                                )}
                            </group>
                            {/* Unscaled sibling, not a child of the group above — a
                                light nested inside a non-uniformly scaled group would
                                have its position warped by that same scale (Three.js
                                only transforms position by the parent matrix, not the
                                light's own distance/intensity numbers), so it's placed
                                here using the real-world height estimate directly. */}
                            {isCustom && (
                                <group position={[item.x, 0, item.z]} rotation={[0, item.rotY, 0]}>
                                    <CustomModelBuildingLight url={p.modelUrl} scaleY={sh} nightOn={nightOn} />
                                </group>
                            )}
                        </React.Fragment>
                    );
                }
                if (item.kind === "polygon") {
                    return (
                        <group key={p.id ?? i} onClick={pick}>
                            <PolygonBuilding p={p} ring={item.ring} dayFactor={dayFactor} />
                            {pickable && (
                                <mesh position={[ringCentroid(item.ring)[0], (p.h || spec.h || 6) / 2, ringCentroid(item.ring)[1]]}
                                    visible={false} onClick={pick}>
                                    <sphereGeometry args={[Math.sqrt(ringArea(item.ring)) * 0.6 + 3, 10, 8]} />
                                    <meshBasicMaterial />
                                </mesh>
                            )}
                        </group>
                    );
                }
                const jointColor = POLYLINE_JOINT_COLORS[p.type];
                return (
                    <group key={p.id ?? i} onClick={pick}>
                        {item.segs.map((s, si) => (
                            <group key={si} position={[s.x, 0, s.z]} rotation={[0, s.rotY, 0]}>
                                <PolylineSegment type={p.type} len={s.len} h={p.h} color={p.color} nightOn={nightOn} />
                                {pickable && (
                                    <mesh position={[0, 1.2, 0]} visible={false} onClick={pick}>
                                        <boxGeometry args={[s.len, 3, (spec.width || 2) + 2]} />
                                        <meshBasicMaterial />
                                    </mesh>
                                )}
                            </group>
                        ))}
                        {jointColor && item.joints.map(([jx, jz], ji) => (
                            <group key={`j${ji}`} position={[jx, 0, jz]}>
                                <RoadJoint width={spec.width || 7} color={jointColor} />
                            </group>
                        ))}
                    </group>
                );
            })}
        </group>
    );
}
