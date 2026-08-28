// Shared GLB-backed warehouse building — used both for the DXF-parsed SHED
// layer (YardScene.jsx) and the Yard Builder's "Warehouse (gable)" prop
// (PropKit.jsx), so every warehouse in the yard — however it got there —
// renders as the same real model instead of two different procedural sheds.

import React, { useMemo, Suspense } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export const WAREHOUSE_GLB_PATH = "/models/industrial-warehouse.glb";
useGLTF.preload(WAREHOUSE_GLB_PATH);

// A non-finite (NaN/Infinity) or non-positive scale on ANY object corrupts
// Three.js's shared bounding-sphere/shadow-frustum computation for the WHOLE
// scene, not just that object — never hand it a bad number.
function safeScale(v, fallback = 1) {
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function WarehouseGlbModel({ rotY, width, depth }) {
  const { scene } = useGLTF(WAREHOUSE_GLB_PATH);
  // useGLTF caches and hands back the SAME Object3D to every caller — clone
  // per placement (an Object3D can only have one parent), and turn on
  // shadows once since the source GLTF materials don't inherit the usual
  // castShadow/receiveShadow mesh props.
  const instance = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return clone;
  }, [scene]);

  const { scaleX, scaleY, scaleZ, liftY } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(instance);
    const size = new THREE.Vector3(); box.getSize(size);
    const sx = safeScale(size.x > 0.01 ? width / size.x : 1);
    const sz = safeScale(size.z > 0.01 ? depth / size.z : 1);
    // Vertical scale tracks the horizontal average rather than stretching
    // independently — a longer footprint shouldn't make the shed taller.
    const sy = safeScale((sx + sz) / 2);
    return { scaleX: sx, scaleY: sy, scaleZ: sz, liftY: -box.min.y * sy };
  }, [instance, width, depth]);

  if (!(width > 0.01) || !(depth > 0.01)) return null; // degenerate footprint

  return (
    <primitive object={instance}
      scale={[scaleX, scaleY, scaleZ]} position={[0, liftY, 0]} rotation={[0, rotY, 0]} />
  );
}

// Shown only while the (large) GLB is still loading, or if it fails to load
// at all — a plain box roughly the right footprint so the yard doesn't show
// a gap, not a re-implementation of a detailed procedural shed.
function WarehousePlaceholder({ width, depth, height = 14 }) {
  return (
    <mesh position={[0, height / 2, 0]}>
      <boxGeometry args={[Math.max(width, 4), height, Math.max(depth, 4)]} />
      <meshLambertMaterial color="#aab4c0" />
    </mesh>
  );
}

class GlbFallbackBoundary extends React.Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {}
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

// `cx`/`cz` are the footprint centroid in scene space, `rotY` the building's
// yaw, `width`/`depth` its real footprint extents (metres) — the model is
// scaled non-uniformly to fit since we don't know its authored proportions
// ahead of time (see WarehouseGlbModel above).
export default function WarehouseModel({ cx, cz, y = 0, rotY = 0, width, depth }) {
  const fallback = <WarehousePlaceholder width={width} depth={depth} />;
  return (
    <group position={[cx, y, cz]}>
      <Suspense fallback={fallback}>
        <GlbFallbackBoundary fallback={fallback}>
          <WarehouseGlbModel rotY={rotY} width={width} depth={depth} />
        </GlbFallbackBoundary>
      </Suspense>
    </group>
  );
}
