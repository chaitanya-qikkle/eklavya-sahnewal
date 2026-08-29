// Real reach-stacker GLB, used in place of the procedural box-geometry rig
// for equipment markers whose type resolves to "reach_stacker". Follows the
// same load/clone/fallback pattern as WarehouseModel.jsx.

import React, { useMemo, Suspense } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export const REACH_STACKER_GLB_PATH = "/models/reach_stacker.glb";
useGLTF.preload(REACH_STACKER_GLB_PATH);

function safeScale(v, fallback = 1) {
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

// Real Kalmar RS46 footprint used elsewhere in this file's procedural rig —
// keep the GLB sized to match so markers, selection rings, and click targets
// still line up.
const TARGET_LENGTH = 30.0; // boom included, along local Z (machine heading)
const TARGET_WIDTH = 6.7;   // along local X

function ReachStackerGlbModel({ rotY = 0 }) {
  const { scene } = useGLTF(REACH_STACKER_GLB_PATH);
  const instance = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return clone;
  }, [scene]);

  const { scale, liftY } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(instance);
    const size = new THREE.Vector3();
    box.getSize(size);
    // Uniform scale from whichever horizontal axis is larger relative to its
    // target, so the model keeps its authored proportions instead of
    // stretching non-uniformly like the (irregular-footprint) warehouse.
    const sx = size.x > 0.01 ? TARGET_WIDTH / size.x : 1;
    const sz = size.z > 0.01 ? TARGET_LENGTH / size.z : 1;
    const s = safeScale(Math.min(sx, sz));
    return { scale: s, liftY: -box.min.y * s };
  }, [instance]);

  return (
    <primitive object={instance} scale={[scale, scale, scale]} position={[0, liftY, 0]} rotation={[0, rotY, 0]} />
  );
}

class GlbFallbackBoundary extends React.Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {}
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

// `fallback` is the existing procedural rig (passed in by the caller) so a
// slow or failed GLB load still shows a machine instead of nothing.
export default function ReachStackerModel({ rotY = 0, fallback = null }) {
  return (
    <Suspense fallback={fallback}>
      <GlbFallbackBoundary fallback={fallback}>
        <ReachStackerGlbModel rotY={rotY} />
      </GlbFallbackBoundary>
    </Suspense>
  );
}
