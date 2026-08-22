// Visual character. Loads /models/character.glb if available, otherwise
// renders the procedural hi-vis worker. Reads pose state from navStore.
//
// Pose: speed-driven walk cycle, blended swing intensity, vertical bob.
// Animation update is skipped when stationary to save frame time.

import React, { useRef, useMemo, useEffect, useState, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import { useNavigation } from "./navStore";
import { useQuality } from "../perf/qualityStore";

const GLB_PATH = "/models/character.glb";

// ─── Materials (procedural fallback) ──────────────────────────────────────
const M_HAT   = { color: "#ffcc00", roughness: 0.35 };
const M_VEST  = { color: "#ea5f00", roughness: 0.5, emissive: "#280e00", emissiveIntensity: 0.15 };
const M_REF   = { color: "#ffffaa", emissive: "#cccc00", emissiveIntensity: 0.9 };
const M_PANTS = { color: "#1a3050", roughness: 0.7 };
const M_BOOT  = { color: "#111111", roughness: 0.85 };
const M_SKIN  = { color: "#f2c27a", roughness: 0.65 };

function ProceduralWorker({ rootRef, refs }) {
  return (
    <group ref={rootRef}>
      <mesh position={[0, 2.05, 0]} castShadow><cylinderGeometry args={[0.3, 0.36, 0.13, 12]} /><meshStandardMaterial {...M_HAT} /></mesh>
      <mesh position={[0, 2.15, 0]} castShadow><sphereGeometry args={[0.28, 12, 8, 0, Math.PI*2, 0, Math.PI*0.52]} /><meshStandardMaterial {...M_HAT} /></mesh>
      <mesh position={[0, 1.76, 0]} castShadow><sphereGeometry args={[0.19, 10, 9]} /><meshStandardMaterial {...M_SKIN} /></mesh>
      <group ref={refs.body}>
        <mesh position={[0, 1.14, 0]} castShadow><boxGeometry args={[0.44, 0.72, 0.26]} /><meshStandardMaterial {...M_VEST} /></mesh>
        <mesh position={[0, 1.24, 0.14]}><boxGeometry args={[0.42, 0.065, 0.02]} /><meshStandardMaterial {...M_REF} /></mesh>
        <mesh position={[0, 1.08, 0.14]}><boxGeometry args={[0.42, 0.065, 0.02]} /><meshStandardMaterial {...M_REF} /></mesh>
      </group>
      <group ref={refs.armL} position={[-0.30, 1.48, 0]}>
        <mesh position={[0,-0.26,0]} castShadow><capsuleGeometry args={[0.075,0.46,4,7]} /><meshStandardMaterial {...M_VEST} /></mesh>
        <mesh position={[0,-0.55,0]}><sphereGeometry args={[0.085,8,6]} /><meshStandardMaterial color="#222" roughness={0.8} /></mesh>
      </group>
      <group ref={refs.armR} position={[0.30, 1.48, 0]}>
        <mesh position={[0,-0.26,0]} castShadow><capsuleGeometry args={[0.075,0.46,4,7]} /><meshStandardMaterial {...M_VEST} /></mesh>
        <mesh position={[0,-0.55,0]}><sphereGeometry args={[0.085,8,6]} /><meshStandardMaterial color="#222" roughness={0.8} /></mesh>
      </group>
      <group ref={refs.legL} position={[-0.14, 0.82, 0]}>
        <mesh position={[0,-0.38,0]} castShadow><capsuleGeometry args={[0.09,0.62,4,8]} /><meshStandardMaterial {...M_PANTS} /></mesh>
        <mesh position={[0,-0.74,0.06]} castShadow><boxGeometry args={[0.15,0.13,0.26]} /><meshStandardMaterial {...M_BOOT} /></mesh>
      </group>
      <group ref={refs.legR} position={[0.14, 0.82, 0]}>
        <mesh position={[0,-0.38,0]} castShadow><capsuleGeometry args={[0.09,0.62,4,8]} /><meshStandardMaterial {...M_PANTS} /></mesh>
        <mesh position={[0,-0.74,0.06]} castShadow><boxGeometry args={[0.15,0.13,0.26]} /><meshStandardMaterial {...M_BOOT} /></mesh>
      </group>
    </group>
  );
}

// ─── GLB-backed character (only used if the file exists) ──────────────────
function GlbWorker({ rootRef }) {
  // useGLTF throws if missing; the Suspense + ErrorBoundary in the parent
  // handles fall-back.
  const { scene, animations } = useGLTF(GLB_PATH);
  const { actions, names } = useAnimations(animations, rootRef);
  const speedRef = useNavigation(s => s.speedRef);
  const walking  = useNavigation(s => s.walking);

  useEffect(() => {
    if (!actions || !names?.length) return;
    const pickByKeyword = (kws) =>
      names.find(n => kws.some(k => n.toLowerCase().includes(k)));
    const walkName = pickByKeyword(["walk", "walking", "stride"]);
    const idleName = pickByKeyword(["idle", "stand"]);
    const target = walking ? walkName : idleName;
    Object.values(actions).forEach(a => a?.fadeOut(0.25));
    if (target && actions[target]) {
      actions[target].reset().fadeIn(0.25).play();
      actions[target].timeScale = walking
        ? Math.max(0.3, speedRef.current / 1.4) : 1.0;
    }
  }, [walking, actions, names, speedRef]);

  return <primitive object={scene} dispose={null} />;
}

class GlbBoundary extends React.Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {}
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

// ─── Main character: position+facing+animation driver ─────────────────────
export default function Character({ preferGlb = true }) {
  const rootRef = useRef();
  const body = useRef(), armL = useRef(), armR = useRef(), legL = useRef(), legR = useRef();
  const posRef    = useNavigation(s => s.posRef);
  const facingRef = useNavigation(s => s.facingRef);
  const speedRef  = useNavigation(s => s.speedRef);
  const settings  = useQuality(s => s.settings);
  const t = useRef(0);
  const [useGlb, setUseGlb] = useState(preferGlb);

  // Probe for GLB once. If 404, immediately fall back to procedural.
  useEffect(() => {
    if (!preferGlb) return;
    let cancelled = false;
    fetch(GLB_PATH, { method: "HEAD" })
      .then(r => { if (!cancelled && !r.ok) setUseGlb(false); })
      .catch(() => { if (!cancelled) setUseGlb(false); });
    return () => { cancelled = true; };
  }, [preferGlb]);

  // Visual position is exponentially damped towards the controller's
  // logical posRef. Hides per-frame numerical jitter without adding
  // perceptible lag — looks substantially smoother in motion.
  const visPos = useRef(new THREE.Vector3());
  const visFace = useRef(0);

  useFrame((_, dt) => {
    if (!rootRef.current) return;
    // Hard-snap on large jumps (route reset / new GPS) so the character
    // doesn't visibly streak across the yard between sessions.
    if (visPos.current.distanceTo(posRef.current) > 5) {
      visPos.current.copy(posRef.current);
      visFace.current = facingRef.current;
    }
    const posDamp  = 1 - Math.exp(-14 * dt);
    const faceDamp = 1 - Math.exp(-12 * dt);
    visPos.current.lerp(posRef.current, posDamp);

    // Shortest-arc lerp for the facing angle so we never spin the long way
    let d = facingRef.current - visFace.current;
    while (d >  Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    visFace.current += d * faceDamp;

    rootRef.current.position.copy(visPos.current);
    rootRef.current.rotation.y = visFace.current;

    const speed = speedRef.current;
    if (speed < 0.05) return;
    const freq = 1.0 + speed * 0.7;
    const ampl = Math.min(1, speed / 4);
    t.current += dt * freq * 5.5;
    const sw = Math.sin(t.current);
    if (legL.current) legL.current.rotation.x =  sw * 0.52 * ampl;
    if (legR.current) legR.current.rotation.x = -sw * 0.52 * ampl;
    if (armL.current) armL.current.rotation.x = -sw * 0.38 * ampl;
    if (armR.current) armR.current.rotation.x =  sw * 0.38 * ampl;
    if (body.current) body.current.rotation.z = Math.sin(t.current * 0.5) * 0.025 * ampl;
    rootRef.current.position.y = visPos.current.y + Math.abs(sw) * 0.10 * ampl;
  });

  const fallback = (
    <ProceduralWorker rootRef={rootRef} refs={{ body, armL, armR, legL, legR }} />
  );

  return (
    <group>
      {useGlb ? (
        <Suspense fallback={fallback}>
          <GlbBoundary fallback={fallback}>
            <group ref={rootRef}><GlbWorker rootRef={rootRef} /></group>
          </GlbBoundary>
        </Suspense>
      ) : fallback}

      {/* Soft contact shadow disc — only when real shadows are off */}
      {!settings.shadows && (
        <mesh position={[posRef.current.x, 0.02, posRef.current.z]}
              rotation={[-Math.PI/2, 0, 0]}>
          <circleGeometry args={[0.55, 18]} />
          <meshBasicMaterial color="#000" transparent opacity={0.28} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// Drei's useGLTF caches by URL; preloading is opt-in if the asset is shipped.
// Don't preload (would 404 noisily without the file).
