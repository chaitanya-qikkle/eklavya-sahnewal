// In-scene wall / obstacle editor.
//
// Runs inside YardScene's Canvas so it shares the camera and raycaster. Edits
// are held as a plain list that the panel exports; `applyEdits` below replays
// them onto a layout, and parse-dict-dxf.mjs --edits bakes them permanently.
//
// Coordinates: the layout is in the drawing's CAD metres, the scene is metres
// about the geofence origin. dxfPointToScene converts one way; sceneToDxf here
// converts back so new walls can be stored in CAD space.

import React, { useMemo } from "react";
import * as THREE from "three";
import { dxfPointToScene } from "../scene/geofence";
import MastLayer, { DEFAULT_MAST, nextCamera } from "./Masts";

export const EMPTY_EDITS = {
    removedWalls: [], addedWalls: [], removedObstacles: [], masts: [], props: [],
    // ids of already-baked props (layout.props) erased this session — distinct
    // from `props` above, which is newly-DRAWN props not yet baked. Together
    // they let one Erase tool cover everything on the yard, built this
    // session or baked in earlier.
    removedProps: [],
};

export const MODES = {
    off: "Off",
    break: "Break wall",
    build: "Build wall",
    obstacle: "Remove obstacle",
    mast: "High mast",
    camera: "Camera on mast",
};

// Inverse of dxfPointToScene.
export function sceneToDxf(x, z, a) {
    if (!a) return [x, -z];
    const u = (x - a.tx) / a.s, v = (z - a.ty) / a.s;
    const xs = a.cosT * u + a.sinT * v;
    const ys = -a.sinT * u + a.cosT * v;
    return [xs, -ys];
}

const key = (...p) => p.join(":");

// Flatten fence polylines to individually addressable segments.
export function wallSegments(layout) {
    const out = [];
    (layout?.fences || []).forEach((ls, fi) => {
        for (let i = 0; i + 1 < ls.length; i++) {
            out.push({ id: key("f", fi, i), a: ls[i], b: ls[i + 1] });
        }
    });
    (layout?.addedWalls || []).forEach((w, i) => {
        out.push({ id: key("new", i), a: [w[0], w[1]], b: [w[2], w[3]], added: true });
    });
    return out;
}

export function obstacleRings(layout) {
    const out = [];
    (layout?.warehouses || []).forEach((r, i) => out.push({ id: key("w", i), ring: r, kind: "warehouse" }));
    (layout?.buildings || []).forEach((r, i) => out.push({ id: key("b", i), ring: r, kind: "building" }));
    return out;
}

// Replay an edit list onto a layout, producing what the scene should render.
export function applyEdits(layout, edits) {
    if (!layout) return layout;
    const e = edits || EMPTY_EDITS;
    const masts = e.masts || [];
    const removedProps = e.removedProps || [];
    if (!e.removedWalls.length && !e.addedWalls.length && !e.removedObstacles.length && !masts.length && !removedProps.length) return layout;

    const gone = new Set(e.removedWalls);
    const fences = [];
    (layout.fences || []).forEach((ls, fi) => {
        let run = [];
        for (let i = 0; i + 1 < ls.length; i++) {
            if (gone.has(key("f", fi, i))) {
                if (run.length >= 2) fences.push(run);
                run = [];
            } else {
                if (!run.length) run.push(ls[i]);
                run.push(ls[i + 1]);
            }
        }
        if (run.length >= 2) fences.push(run);
    });
    for (const w of e.addedWalls) fences.push([[w[0], w[1]], [w[2], w[3]]]);

    const drop = new Set(e.removedObstacles);
    const dropProps = new Set(removedProps);
    return {
        ...layout,
        fences,
        // Baked masts (from the layout file) plus whatever this session added
        // via the mast tool — was a hard replace, which silently hid every
        // baked mast the moment any other edit (wall/prop) was made this
        // session, since edits.masts defaults to [] until the mast tool is
        // used. There's no "remove a baked mast" tool yet, so concatenating
        // is safe — nothing currently expects baked masts to be droppable.
        masts: [...(layout.masts || []), ...masts],
        warehouses: (layout.warehouses || []).filter((_, i) => !drop.has(key("w", i))),
        buildings: (layout.buildings || []).filter((_, i) => !drop.has(key("b", i))),
        props: (layout.props || []).filter(p => !dropProps.has(p.id)),
    };
}

// ── the interactive layer ─────────────────────────────────────────────────
export default function WallEditor({ layout, alignment, mode, edits, onEdits, pending, onPending }) {
    const segs = useMemo(() => {
        if (!layout || mode === "off") return [];
        return wallSegments(layout).map(s => {
            const p = dxfPointToScene(s.a[0], s.a[1], alignment);
            const q = dxfPointToScene(s.b[0], s.b[1], alignment);
            const dx = q.x - p.x, dz = q.z - p.z;
            const len = Math.hypot(dx, dz);
            return { ...s, x: (p.x + q.x) / 2, z: (p.z + q.z) / 2, len, rotY: Math.atan2(-dz, dx) };
        }).filter(s => s.len > 0.4 && s.len < 3000);
    }, [layout, alignment, mode]);

    const rings = useMemo(() => {
        if (!layout || mode !== "obstacle") return [];
        return obstacleRings(layout).map(o => {
            const pts = o.ring.map(([x, y]) => dxfPointToScene(x, y, alignment));
            let mnx = Infinity, mnz = Infinity, mxx = -Infinity, mxz = -Infinity;
            for (const p of pts) {
                if (p.x < mnx) mnx = p.x; if (p.x > mxx) mxx = p.x;
                if (p.z < mnz) mnz = p.z; if (p.z > mxz) mxz = p.z;
            }
            return { ...o, x: (mnx + mxx) / 2, z: (mnz + mxz) / 2, w: mxx - mnx, d: mxz - mnz };
        }).filter(o => o.w > 1 && o.d > 1);
    }, [layout, alignment, mode]);

    // Masts are part of the yard, not the tooling — they stay on screen once
    // placed, even after the editor is switched off.
    if (mode === "off") {
        return <MastLayer masts={edits.masts} alignment={alignment} />;
    }

    const removedSet = new Set(edits.removedWalls);
    const droppedSet = new Set(edits.removedObstacles);

    const toggleWall = (s) => {
        if (s.added) {
            const i = Number(s.id.split(":")[1]);
            onEdits({ ...edits, addedWalls: edits.addedWalls.filter((_, k) => k !== i) });
            return;
        }
        const next = removedSet.has(s.id)
            ? edits.removedWalls.filter(k => k !== s.id)
            : [...edits.removedWalls, s.id];
        onEdits({ ...edits, removedWalls: next });
    };

    const toggleObstacle = (o) => {
        const next = droppedSet.has(o.id)
            ? edits.removedObstacles.filter(k => k !== o.id)
            : [...edits.removedObstacles, o.id];
        onEdits({ ...edits, removedObstacles: next });
    };

    const onGround = (ev) => {
        ev.stopPropagation();
        const p = ev.point;

        if (mode === "mast") {
            const [x, y] = sceneToDxf(p.x, p.z, alignment);
            onEdits({ ...edits, masts: [...(edits.masts || []), { x, y, ...DEFAULT_MAST, cameras: [] }] });
            return;
        }
        if (mode !== "build") return;
        if (!pending) { onPending([p.x, p.z]); return; }
        const a = sceneToDxf(pending[0], pending[1], alignment);
        const b = sceneToDxf(p.x, p.z, alignment);
        onEdits({ ...edits, addedWalls: [...edits.addedWalls, [a[0], a[1], b[0], b[1]]] });
        onPending(null);
    };

    // In mast mode a click removes; in camera mode it adds another camera.
    const onMast = (i) => {
        const list = [...(edits.masts || [])];
        if (mode === "mast") {
            list.splice(i, 1);
        } else if (mode === "camera") {
            const m = list[i];
            list[i] = { ...m, cameras: [...(m.cameras || []), nextCamera(m.cameras)] };
        } else return;
        onEdits({ ...edits, masts: list });
    };

    return (
        <group>
            {/* masts, pickable while a mast/camera mode is active */}
            <MastLayer
                masts={edits.masts}
                alignment={alignment}
                pickable={mode === "mast" || mode === "camera"}
                onPick={onMast}
            />

            {/* click-catcher for placing masts / drawing walls */}
            {/* The slot pads/outlines drawn by YardScene sit at y=0.08–0.22 and their
                onClick calls stopPropagation — a catcher below that height silently
                eats every click made over a slot, which is most of the yard. Sit
                above them so placement clicks land reliably. */}
            {(mode === "build" || mode === "mast") && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]} onClick={onGround}>
                    <planeGeometry args={[6000, 6000]} />
                    <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
                </mesh>
            )}

            {/* first point of a wall being drawn */}
            {mode === "build" && pending && (
                <mesh position={[pending[0], 2, pending[1]]}>
                    <sphereGeometry args={[1.4, 12, 12]} />
                    <meshBasicMaterial color="#4ade80" />
                </mesh>
            )}

            {/* wall segments — pickable in break mode, shown as ghosts when removed */}
            {(mode === "break" || mode === "build") && segs.map(s => {
                const off = removedSet.has(s.id);
                return (
                    <mesh
                        key={s.id}
                        position={[s.x, 1.6, s.z]}
                        rotation={[0, s.rotY, 0]}
                        onClick={mode === "break" ? (e) => { e.stopPropagation(); toggleWall(s); } : undefined}
                    >
                        <boxGeometry args={[s.len, 3.2, 1.2]} />
                        <meshBasicMaterial
                            color={off ? "#ef4444" : s.added ? "#4ade80" : "#38bdf8"}
                            transparent opacity={off ? 0.22 : 0.38} depthWrite={false}
                        />
                    </mesh>
                );
            })}

            {/* obstacle hit boxes */}
            {mode === "obstacle" && rings.map(o => {
                const off = droppedSet.has(o.id);
                return (
                    <mesh
                        key={o.id}
                        position={[o.x, 3, o.z]}
                        onClick={(e) => { e.stopPropagation(); toggleObstacle(o); }}
                    >
                        <boxGeometry args={[o.w, 6, o.d]} />
                        <meshBasicMaterial
                            color={off ? "#ef4444" : o.kind === "warehouse" ? "#f59e0b" : "#38bdf8"}
                            transparent opacity={off ? 0.2 : 0.3} depthWrite={false}
                        />
                    </mesh>
                );
            })}
        </group>
    );
}
