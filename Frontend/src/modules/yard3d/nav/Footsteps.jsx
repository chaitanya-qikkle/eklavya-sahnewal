// Footstep dust puffs. Spawns a small fading disc each footfall.
// Skipped entirely on low / mobile quality tiers.

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useNavigation } from "./navStore";
import { useQuality } from "../perf/qualityStore";

const POOL = 16;
const STEP_DIST = 1.4; // metres between footstep marks

export default function Footsteps() {
  const tier = useQuality(s => s.settings.tier);
  if (tier === "low" || tier === "mobile") return null;
  return <FootstepsInner />;
}

function FootstepsInner() {
  const posRef   = useNavigation(s => s.posRef);
  const speedRef = useNavigation(s => s.speedRef);
  const refs = useRef([]);
  const states = useRef(
    Array.from({ length: POOL }, () => ({ alive: false, age: 0, x: 0, z: 0 }))
  );
  const lastSpawnPos = useRef(new THREE.Vector3());
  const nextSlot = useRef(0);

  useFrame((_, dt) => {
    const speed = speedRef.current;
    if (speed > 0.6) {
      const d = lastSpawnPos.current.distanceTo(posRef.current);
      if (d > STEP_DIST) {
        const s = states.current[nextSlot.current];
        s.alive = true; s.age = 0;
        s.x = posRef.current.x; s.z = posRef.current.z;
        nextSlot.current = (nextSlot.current + 1) % POOL;
        lastSpawnPos.current.copy(posRef.current);
      }
    }
    for (let i = 0; i < POOL; i++) {
      const s = states.current[i], m = refs.current[i];
      if (!s.alive || !m) { if (m) m.visible = false; continue; }
      s.age += dt;
      if (s.age > 1.2) { s.alive = false; m.visible = false; continue; }
      m.visible = true;
      m.position.set(s.x, 0.03, s.z);
      const k = s.age / 1.2;
      m.scale.setScalar(0.4 + k * 1.0);
      m.material.opacity = 0.35 * (1 - k);
    }
  });

  const items = [];
  for (let i = 0; i < POOL; i++) {
    items.push(
      <mesh key={i} ref={el => (refs.current[i] = el)} rotation={[-Math.PI/2, 0, 0]} visible={false}>
        <circleGeometry args={[0.35, 16]} />
        <meshBasicMaterial color="#c9b48a" transparent opacity={0} depthWrite={false} />
      </mesh>
    );
  }
  return <group>{items}</group>;
}
