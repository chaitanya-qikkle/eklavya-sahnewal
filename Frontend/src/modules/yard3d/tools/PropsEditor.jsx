// Interactive placement layer for the yard-builder palette (PropKit).
//
// Runs inside YardScene's Canvas, same pattern as WallEditor: a big invisible
// ground plane catches clicks while a tool is active.
//
//   • Point props place on a single click.
//   • "rect" props (the quick-build square tool) place on two clicks — corner,
//     then the opposite corner — and land immediately, pre-selected, so a size
//     that came out wrong can be nudged/rotated/deleted right away.
//   • Polyline/polygon props are drawn vertex by vertex — each ground click
//     appends a point to `drawPts` (lifted into the harness so the panel's
//     Finish/Cancel buttons can act on it too); Finish turns it into a prop.
//   • "Select" mode: click any already-placed prop to select it (PropsPanel
//     then shows move/rotate/height/delete controls for it). With "Move here"
//     armed, the next ground click relocates the whole prop — every vertex of
//     a polygon/polyline shifts by the same amount, so its shape and size are
//     preserved and only its position changes.
//   • "Erase" mode: click any prop to delete it outright.
//
// Vertex-by-vertex drawing (rather than a screen-space corner drag) is
// deliberate: equal screen pixels do not cover equal ground distance under an
// oblique aerial camera — near-camera pixels cover far less ground than far
// ones — so a two-click drag can silently produce a building hundreds of
// metres across. Clicking each real corner on the ground sidesteps that.

import React from "react";
import * as THREE from "three";
import PropsLayer, { PROP_SPECS } from "./PropKit";
import { sceneToDxf } from "./WallEditor";
import { dxfPointToScene } from "../scene/geofence";

let nextId = 1;
export function newPropId(type) {
    return `${type}-${(nextId++).toString(36)}-${Date.now().toString(36).slice(-4)}`;
}

// Scene-space centroid of a prop, for the selection highlight.
function propCentroid(p, alignment) {
    const spec = PROP_SPECS[p.type];
    if (!spec) return null;
    if (spec.footprint === "point") {
        const c = dxfPointToScene(p.x, p.y, alignment);
        return [c.x, c.z];
    }
    const pts = (p.points || []).map(([x, y]) => { const c = dxfPointToScene(x, y, alignment); return [c.x, c.z]; });
    if (!pts.length) return null;
    return [pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length];
}

export default function PropsEditor({
    edits, onEdits, alignment,
    activeType, drawPts, onDrawPts, onPlaced,
    pickMode, onPickProp,
    selectedIdx, moveArm, onMoved,
    breakArm, onBreak,
    pendingModelUrl,
}) {
    const spec = activeType ? PROP_SPECS[activeType] : null;
    const pickable = pickMode === "erase" || pickMode === "select";

    const onGround = (e) => {
        e.stopPropagation();
        const [x, y] = sceneToDxf(e.point.x, e.point.z, alignment);

        // Break works on the nearest wall to the click, selection or not, and
        // stays armed so a run can be cut as many times as needed.
        if (breakArm) { onBreak(selectedIdx, [x, y]); return; }
        if (moveArm && selectedIdx != null) { onMoved(selectedIdx, [x, y]); return; }
        if (!activeType) return;

        if (spec.footprint === "point") {
            const extra = activeType === "custom_model" ? { modelUrl: pendingModelUrl } : {};
            onEdits({
                ...edits,
                props: [...(edits.props || []), { id: newPropId(activeType), type: activeType, x, y, rot: 0, ...extra }],
            });
            return;
        }

        if (spec.footprint === "rect") {
            if (!drawPts || !drawPts.length) { onDrawPts([[x, y]]); return; }
            const [ax, ay] = drawPts[0];
            const points = [[ax, ay], [x, ay], [x, y], [ax, y]];   // axis-aligned in CAD space
            const idx = (edits.props || []).length;
            onEdits({ ...edits, props: [...(edits.props || []), { id: newPropId(activeType), type: activeType, points, h: spec.h }] });
            onDrawPts([]);
            onPlaced?.(idx);
            return;
        }

        // polygon / polyline: collect vertices; PropsPanel's Finish button
        // turns the collected list into a prop. Clicks near ANY vertex of an
        // already-placed run of the same kind (or this run's own first point)
        // snap onto it exactly, so walls merge with no gap or kink — corners
        // match automatically instead of relying on pixel-perfect clicking.
        let pt = [x, y];
        if (spec.footprint === "polyline") {
            const SNAP = 6;                        // metres, in CAD space
            let best = null;
            const consider = (v) => {
                const d = Math.hypot(v[0] - x, v[1] - y);
                if (d < SNAP && (!best || d < best.d)) best = { d, p: v };
            };
            for (const q of (edits.props || [])) {
                if (q.type !== activeType || !q.points?.length) continue;
                for (const v of q.points) consider(v);
            }
            if (drawPts?.length > 1) consider(drawPts[0]);   // close a loop cleanly
            if (best) pt = [best.p[0], best.p[1]];
        }
        onDrawPts([...(drawPts || []), pt]);
    };

    const drawScenePts = React.useMemo(
        () => (drawPts || []).map(([x, y]) => { const p = dxfPointToScene(x, y, alignment); return [p.x, p.z]; }),
        [drawPts, alignment],
    );

    const previewLine = React.useMemo(() => {
        if (drawScenePts.length < 1) return null;
        const pts = drawScenePts.map(([x, z]) => new THREE.Vector3(x, 1.4, z));
        if (spec?.footprint === "polygon" && pts.length > 1) pts.push(pts[0].clone());
        return new THREE.BufferGeometry().setFromPoints(pts);
    }, [drawScenePts, spec]);

    const selectedProp = selectedIdx != null ? (edits.props || [])[selectedIdx] : null;
    const highlight = selectedProp ? propCentroid(selectedProp, alignment) : null;

    return (
        <group>
            <PropsLayer props={edits.props} alignment={alignment} pickable={pickable} onPick={onPickProp} />

            {/* Sits above the slot pads/outlines (y=0.08–0.22 in YardScene) — their
                onClick calls stopPropagation, so a lower catcher silently swallows
                every placement click made over a slot, which is most of the yard. */}
            {(activeType || pickable || moveArm || breakArm) && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]} onClick={onGround}>
                    <planeGeometry args={[6000, 6000]} />
                    <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
                </mesh>
            )}

            {drawScenePts.map(([x, z], i) => (
                <mesh key={i} position={[x, 1.4, z]}>
                    <sphereGeometry args={[1, 12, 12]} />
                    <meshBasicMaterial color={i === 0 ? "#4ade80" : "#facc15"} />
                </mesh>
            ))}
            {previewLine && drawScenePts.length > 1 && (
                <line geometry={previewLine}>
                    <lineBasicMaterial color="#4ade80" />
                </line>
            )}

            {highlight && (
                <mesh position={[highlight[0], 0.6, highlight[1]]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[2.2, 3, 28]} />
                    <meshBasicMaterial color={moveArm ? "#facc15" : "#4f9ae0"} transparent opacity={0.85} depthTest={false} />
                </mesh>
            )}
        </group>
    );
}
