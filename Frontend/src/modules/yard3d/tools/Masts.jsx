// High mast lighting towers + the CCTV cameras mounted on them.
//
// Masts are stored in the same edit list as wall changes, in the drawing's CAD
// metres, so `parse-dict-dxf.mjs --edits` can bake them into the layout:
//
//   { x, y, h, cameras: [{ h, yaw, fov, range }] }
//
// yaw is degrees clockwise from north, matching how a survey bearing reads.

import React, { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { dxfPointToScene } from "../scene/geofence";

export const DEFAULT_MAST = { h: 30 };
export const DEFAULT_CAMERA = { h: 22, yaw: 0, fov: 60, range: 90 };

// Half-angle of the mast floodlight's cone, aimed at the yard's plot centre
// (see `aim` below) — wide enough for generous interior coverage but well
// short of 90°, so there's always a >100° dead zone directly behind the
// mast where the perimeter wall sits (masts are placed right at the
// boundary, only ~6-9m from it in this layout — an omnidirectional light
// there can't avoid spilling past the wall, a cone aimed inward can).
const MAST_SPOT_ANGLE = (75 * Math.PI) / 180;
const MAST_SPOT_TARGET_DIST = 60; // metres — just needs to be far enough to fix the aim direction

// A fresh camera is aimed a quarter-turn on from the last one, so clicking a
// mast repeatedly rings it with coverage instead of stacking cameras on one
// bearing.
export function nextCamera(existing = []) {
    return { ...DEFAULT_CAMERA, yaw: (existing.length * 90) % 360 };
}

// A CCTV body with a small red LED that blinks — the visual cue that this
// mast has a live feed wired up (independent of the edit tool's own
// `cameras[]` list, which is about coverage cones, not "is streaming").
function LiveCameraBody({ position = [0, 0, 0], rotation = [0, 0, 0] }) {
    const ledRef = useRef();
    useFrame(({ clock }) => {
        if (!ledRef.current) return;
        // on/off blink, ~1.3s period — reads as "recording", not a smooth pulse.
        const on = Math.sin(clock.elapsedTime * 4.8) > 0;
        ledRef.current.material.emissiveIntensity = on ? 2.2 : 0.15;
    });
    return (
        <group position={position} rotation={rotation}>
            <mesh position={[0, 0, -0.8]} castShadow>
                <boxGeometry args={[0.42, 0.34, 0.9]} />
                <meshStandardMaterial color="#23272e" roughness={0.5} metalness={0.5} />
            </mesh>
            <mesh position={[0, 0, -0.35]}>
                <boxGeometry args={[0.14, 0.14, 0.5]} />
                <meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.4} />
            </mesh>
            {/* blinking red LED, front-top of the housing */}
            <mesh ref={ledRef} position={[0, 0.12, -1.22]}>
                <sphereGeometry args={[0.055, 8, 8]} />
                <meshStandardMaterial color="#ff2020" emissive="#ff0000" emissiveIntensity={2.2} toneMapped={false} />
            </mesh>
        </group>
    );
}

// nightOn: 0 (broad daylight) .. 1 (full night) — see useDayNightFactor.
// Real high masts switch on like streetlights: fixtures are dark through the
// day and brighten (plus an actual PointLight once dusk sets in) only as
// nightOn rises, so the yard never shows lit fixtures in daylight.
function Mast({ mast, index, onPick, pickable, nightOn = 0, aim = null }) {
    const h = mast.h ?? DEFAULT_MAST.h;
    const cams = mast.cameras || [];
    // `fromProp` masts are synthesised from a hand-placed custom_model prop
    // (e.g. a floodlight-tower GLB) that already renders its own pole/tower
    // mesh — only the camera hardware/hit-box belongs to this component, or
    // the prop would get a second, plain grey mast drawn through it.
    const drawPole = !mast.fromProp;
    const fixtureGlow = nightOn * 2;
    const lightOn = nightOn > 0.08; // don't pay for a point light in broad daylight

    const spotRef = useRef();
    const targetRef = useRef();
    useEffect(() => {
        if (spotRef.current && targetRef.current) spotRef.current.target = targetRef.current;
    }, [aim?.x, aim?.z]);

    return (
        <group
            onClick={pickable ? (e) => { e.stopPropagation(); onPick?.(index); } : undefined}
        >
            {drawPole && (
                <>
                    {/* pole */}
                    <mesh position={[0, h / 2, 0]} castShadow>
                        <cylinderGeometry args={[0.28, 0.5, h, 10]} />
                        <meshStandardMaterial color="#b8bec7" roughness={0.55} metalness={0.6} />
                    </mesh>
                    {/* base */}
                    <mesh position={[0, 0.5, 0]}>
                        <cylinderGeometry args={[1.1, 1.3, 1, 10]} />
                        <meshStandardMaterial color="#8d939c" roughness={0.9} />
                    </mesh>
                    {/* luminaire ring */}
                    <mesh position={[0, h + 0.4, 0]} castShadow>
                        <cylinderGeometry args={[2.2, 1.4, 1, 12]} />
                        <meshStandardMaterial color="#3f4650" roughness={0.6} metalness={0.4} />
                    </mesh>
                    {[0, 90, 180, 270].map(a => {
                        const r = (a * Math.PI) / 180;
                        return (
                            <mesh key={a} position={[Math.sin(r) * 1.5, h + 0.1, Math.cos(r) * 1.5]} rotation={[0.5, r, 0]}>
                                <boxGeometry args={[1.1, 0.25, 0.7]} />
                                <meshStandardMaterial color="#f4f8ff" emissive="#eaf2ff" emissiveIntensity={fixtureGlow} />
                            </mesh>
                        );
                    })}
                </>
            )}

            {/* Real light — applies to BOTH the plain-pole mast above and
                `fromProp` masts (hand-placed floodlight-tower GLBs), since a
                GLB tower is just as real a high mast and needs an actual light
                to switch on at dusk, not just its own static model glow.
                Three.js r155+ uses physically-correct photometric units for
                point lights, so with decay=2 an intensity in the tens is
                essentially invisible at yard scale (tens of metres) — this
                needs to be in the hundreds to register at all. 900 (an
                earlier "increase the area" bump) blew out to a solid white
                disc under ACESFilmicToneMapping — dialed back, and decay
                raised a touch (1 -> 1.4) so it falls off before saturating
                the render instead of clipping to white around the fixture.
                Directional (spotLight aimed at the yard's plot centre, via
                `aim` from MastLayer) instead of an omnidirectional pointLight
                — masts sit right at the perimeter wall, so a bare point
                light inevitably spills outside; a cone aimed inward keeps
                the wall-side ~100°+ dead dark, matching "only the wall's own
                lights should show outside the yard". Falls back to the old
                pointLight if `aim` isn't available (e.g. no plot centre on
                this layout) so behaviour never breaks, just loses directionality.
                No shadow casting: masts can be numerous, and a shadow-
                casting light per mast would tank frame rate for a glow no
                one's examining closely from yard-overview height. */}
            {lightOn && (
                aim ? (
                    <>
                        <spotLight
                            ref={spotRef}
                            position={[0, h + 0.2, 0]}
                            color="#eef4ff"
                            intensity={nightOn * 650}
                            distance={200}
                            decay={1.2}
                            angle={MAST_SPOT_ANGLE}
                            penumbra={0.55}
                        />
                        <object3D ref={targetRef} position={[aim.x * MAST_SPOT_TARGET_DIST, 0, aim.z * MAST_SPOT_TARGET_DIST]} />
                    </>
                ) : (
                    <pointLight
                        position={[0, h + 0.2, 0]}
                        color="#eef4ff"
                        intensity={nightOn * 650}
                        distance={230}
                        decay={1.2}
                    />
                )
            )}

            {/* cameras placed via the edit tool (coverage cones) */}
            {cams.map((c, ci) => {
                const yaw = (-(c.yaw ?? 0) * Math.PI) / 180;   // clockwise-from-north → scene Y
                const ch = c.h ?? DEFAULT_CAMERA.h;
                return <LiveCameraBody key={ci} position={[0, ch, 0]} rotation={[0, yaw, 0]} />;
            })}

            {/* this mast has a live stream wired up but no coverage cameras placed
                yet — show one blinking camera on the pole so it's visibly "on". */}
            {mast.streamPath && !cams.length && (
                <LiveCameraBody position={[0, h * 0.7, 0]} />
            )}
        </group>
    );
}

// "High Mast 4" -> "HM4" — short label pulled from whatever number is in the
// operator-given name, so it stays correct even if the naming convention
// drifts (not a hardcoded "High Mast " string strip).
function shortMastLabel(name) {
    const m = /(\d+)/.exec(name || "");
    return m ? `HM${m[1]}` : name;
}

export default function MastLayer({ masts, alignment, plotCentre, onPick, pickable = false, onView, dayFactor = 1 }) {
    const nightOn = Math.max(0, Math.min(1, 1 - dayFactor));
    // Scene-space point every mast's floodlight cone aims at — see
    // MAST_SPOT_ANGLE above for why (masts sit right at the wall).
    const centerScene = useMemo(() => (
        plotCentre && alignment ? dxfPointToScene(plotCentre[0], plotCentre[1], alignment) : null
    ), [plotCentre, alignment]);
    const placed = useMemo(() => (masts || []).map((m, i) => {
        const p = dxfPointToScene(m.x, m.y, alignment);
        let aim = null;
        if (centerScene) {
            const dx = centerScene.x - p.x, dz = centerScene.z - p.z;
            const len = Math.hypot(dx, dz);
            if (len > 0.5) aim = { x: dx / len, z: dz / len };
        }
        return { m, i, x: p.x, z: p.z, aim };
    }), [masts, alignment, centerScene]);

    if (!placed.length) return null;

    // In edit mode (pickable) a click removes the mast — same as before. In
    // normal viewing, a click opens that mast's camera stream instead (only
    // offered for masts that actually have one wired up).
    const handleClick = (e, m, i) => {
        e.stopPropagation();
        if (pickable) onPick?.(i);
        else onView?.(m);
    };

    return (
        <group>
            {placed.map(({ m, i, x, z, aim }) => {
                const mh = m.h ?? DEFAULT_MAST.h;
                const hasStream = Boolean(m.streamPath);
                return (
                    <group key={i} position={[x, 0, z]}>
                        <Mast mast={m} index={i} onPick={onPick} pickable={pickable} nightOn={nightOn} aim={aim} />
                        {/* generous invisible hit box — covers the full mast height plus a
                            wide radius, so a click "anywhere near" the mast (not just the
                            thin pole itself) opens it. In edit mode every mast is pickable
                            (for removal); in live view only a mast with a wired-up camera
                            stream is clickable — the rest stay inert. */}
                        {(pickable || (onView && hasStream)) && (
                            <mesh position={[0, (mh + 3) / 2, 0]} onClick={(e) => handleClick(e, m, i)}>
                                <cylinderGeometry args={[6, 6, mh + 3, 12]} />
                                <meshBasicMaterial visible={false} />
                            </mesh>
                        )}
                        {/* Label only for masts with an actual camera stream configured —
                            a mast with no live feed has nothing to advertise. */}
                        {m.name && hasStream && (
                            <Html position={[0, mh + 3.5, 0]} center occlude={false} style={{ pointerEvents: "none" }}>
                                <div style={{
                                    padding: "1px 5px", borderRadius: 3, whiteSpace: "nowrap",
                                    background: "rgba(10,16,24,.82)", color: "#dce8f5",
                                    border: "1px solid #4ade80",
                                    fontFamily: "system-ui, Segoe UI, sans-serif",
                                    fontSize: 8, fontWeight: 600, letterSpacing: .3,
                                }}>{shortMastLabel(m.name)}</div>
                            </Html>
                        )}
                    </group>
                );
            })}
        </group>
    );
}
