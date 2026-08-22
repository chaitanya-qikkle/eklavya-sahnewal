// Animated route visualization: glowing pulsing line, marching directional
// arrows, start ring, and destination beacon. Always renders above ground
// (depthTest off) so it is visible from every camera angle.
//
// Inputs: waypoints[] (each {x,z}), entrancePos {x,z}.

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useNavigation } from "./navStore";

const LINE_Y       = 0.22;
const ARROW_SPACING = 6;     // metres between arrows
const ARROW_SPEED   = 6;     // metres per second along the path
const PULSE_HZ      = 1.4;

// ─── Build dense polyline + per-vertex cumulative distance ──────────────
function buildPolyline(waypoints) {
  if (!waypoints || waypoints.length < 2) return { pts: [], dist: [], total: 0 };
  const pts = [];
  const dist = [];
  let total = 0;
  pts.push(new THREE.Vector3(waypoints[0].x, LINE_Y, waypoints[0].z));
  dist.push(0);
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1], b = waypoints[i];
    const segLen = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(2, Math.ceil(segLen / 1.5));
    for (let s = 1; s <= steps; s++) {
      const f = s / steps;
      const x = a.x + (b.x - a.x) * f;
      const z = a.z + (b.z - a.z) * f;
      pts.push(new THREE.Vector3(x, LINE_Y, z));
      total += Math.hypot(x - pts[pts.length - 2].x, z - pts[pts.length - 2].z);
      dist.push(total);
    }
  }
  return { pts, dist, total };
}

// Sample point + tangent at distance d along the polyline
function sampleAt(d, pts, dist) {
  if (!pts.length) return null;
  if (d <= 0) {
    const t = new THREE.Vector3().subVectors(pts[1] || pts[0], pts[0]).normalize();
    return { pos: pts[0], tan: t };
  }
  const total = dist[dist.length - 1];
  if (d >= total) {
    const last = pts[pts.length - 1], prev = pts[pts.length - 2] || last;
    const t = new THREE.Vector3().subVectors(last, prev).normalize();
    return { pos: last, tan: t };
  }
  // binary search
  let lo = 0, hi = dist.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (dist[mid] <= d) lo = mid; else hi = mid;
  }
  const span = dist[hi] - dist[lo] || 1;
  const f = (d - dist[lo]) / span;
  const a = pts[lo], b = pts[hi];
  const pos = new THREE.Vector3(
    a.x + (b.x - a.x) * f,
    LINE_Y,
    a.z + (b.z - a.z) * f
  );
  const tan = new THREE.Vector3().subVectors(b, a).normalize();
  return { pos, tan };
}

// ─── Glowing animated line (shader-driven pulse) ────────────────────────
function GlowLine({ pts, total }) {
  const mat = useRef();
  const posRef = useNavigation(s => s.posRef);
  const uniforms = useMemo(() => ({
    uTime:     { value: 0 },
    uTotal:    { value: total || 1 },
    uTraveled: { value: 0 },
  }), [total]);

  // Track distance the character has actually walked along the polyline
  // by projecting the live position onto the polyline (more accurate than
  // store progress because it accounts for arrival snap & string-pulling).
  useFrame((_, dt) => {
    if (mat.current) mat.current.uniforms.uTime.value += dt;
    if (!mat.current || !pts || pts.length < 2) return;
    const p = posRef.current;
    // Find nearest point on polyline → cumulative distance along path.
    let bestD = Infinity, bestDist = 0, acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const ax = b.x - a.x, az = b.z - a.z;
      const segLen = Math.hypot(ax, az) || 1e-6;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * ax + (p.z - a.z) * az) / (segLen * segLen)));
      const px = a.x + ax * t, pz = a.z + az * t;
      const d2 = (px - p.x) * (px - p.x) + (pz - p.z) * (pz - p.z);
      if (d2 < bestD) { bestD = d2; bestDist = acc + segLen * t; }
      acc += segLen;
    }
    // Light damping so the trail clears smoothly even on micro-jitters
    const cur = mat.current.uniforms.uTraveled.value;
    mat.current.uniforms.uTraveled.value = cur + (bestDist - cur) * Math.min(1, dt * 8);
  });

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    // attribute: cumulative distance per vertex (for shader animation)
    const arr = new Float32Array(pts.length);
    let acc = 0; arr[0] = 0;
    for (let i = 1; i < pts.length; i++) {
      acc += pts[i].distanceTo(pts[i - 1]);
      arr[i] = acc;
    }
    g.setAttribute("aDist", new THREE.BufferAttribute(arr, 1));
    return g;
  }, [pts]);

  if (!pts.length) return null;

  return (
    <>
      {/* Soft outer halo line. depthTest=true so character / containers
          properly occlude the segment beneath them — no more bright line
          painted ON TOP of the character or the label pill. */}
      <line geometry={geom} renderOrder={2}>
        <shaderMaterial
          ref={mat}
          uniforms={uniforms}
          transparent
          depthTest={true}
          depthWrite={false}
          vertexShader={`
            attribute float aDist;
            varying float vDist;
            void main(){
              vDist = aDist;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform float uTotal;
            uniform float uTraveled;
            varying float vDist;
            void main(){
              // Discard the segment the character has already walked over,
              // with a 1.5 m soft edge so the cut isn't a hard line.
              float behind = vDist - uTraveled;
              if (behind < -1.5) discard;
              float fade = smoothstep(-1.5, 0.5, behind);
              float w = mod(vDist - uTime * 8.0, 16.0) / 16.0;
              float pulse = 0.55 + 0.45 * sin((vDist*0.25) - uTime * 3.0);
              vec3 col = mix(vec3(0.05,0.55,0.95), vec3(0.4,0.95,1.0), w);
              gl_FragColor = vec4(col, 0.85 * pulse * fade);
            }
          `}
        />
      </line>
    </>
  );
}

// ─── Marching arrows along the path ─────────────────────────────────────
function MarchingArrows({ pts, dist, total, count }) {
  const refs = useRef([]);
  const offset = useRef(0);
  const posRef = useNavigation(s => s.posRef);

  // Reuse the same nearest-point-on-polyline projection as GlowLine so
  // the arrow culling threshold matches the trail-fade exactly.
  const traveled = useRef(0);

  useFrame((_, dt) => {
    offset.current = (offset.current + ARROW_SPEED * dt) % ARROW_SPACING;
    // Update traveled distance (damped, same as GlowLine)
    if (pts.length >= 2) {
      const p = posRef.current;
      let bestD = Infinity, bestDist = 0, acc = 0;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const ax = b.x - a.x, az = b.z - a.z;
        const segLen = Math.hypot(ax, az) || 1e-6;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * ax + (p.z - a.z) * az) / (segLen * segLen)));
        const px = a.x + ax * t, pz = a.z + az * t;
        const d2 = (px - p.x) * (px - p.x) + (pz - p.z) * (pz - p.z);
        if (d2 < bestD) { bestD = d2; bestDist = acc + segLen * t; }
        acc += segLen;
      }
      traveled.current += (bestDist - traveled.current) * Math.min(1, dt * 8);
    }

    for (let i = 0; i < count; i++) {
      const d = (i * ARROW_SPACING + offset.current) % Math.max(total, ARROW_SPACING);
      const s = sampleAt(d, pts, dist);
      const ref = refs.current[i];
      if (!s || !ref) continue;
      ref.position.set(s.pos.x, 0.32, s.pos.z);
      ref.rotation.y = Math.atan2(s.tan.x, s.tan.z);
      // Cull arrows behind the character (with a small 1m grace zone)
      const ahead = d - traveled.current;
      const fadeIn  = Math.min(1, d / 2);
      const fadeOut = Math.min(1, (total - d) / 3);
      const aheadFade = ahead < 0 ? 0 : Math.min(1, ahead / 2);
      ref.material.opacity = 0.95 * Math.min(fadeIn, fadeOut, aheadFade);
      ref.visible = ref.material.opacity > 0.02;
    }
  });

  const arrows = [];
  for (let i = 0; i < count; i++) {
    arrows.push(
      <mesh key={i} ref={el => (refs.current[i] = el)} renderOrder={21}>
        <coneGeometry args={[0.55, 1.3, 5]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    );
  }
  return <group>{arrows}</group>;
}

// ─── Destination beacon: pillar of light + pulsing rings ────────────────
function DestinationBeacon({ pos }) {
  const ringRef = useRef();
  const beamRef = useRef();
  const t = useRef(0);

  useFrame((_, dt) => {
    t.current += dt;
    const p = PULSE_HZ * Math.PI * 2 * t.current;
    if (ringRef.current) {
      const s = 1 + 0.35 * Math.sin(p);
      ringRef.current.scale.set(s, 1, s);
      ringRef.current.material.opacity = 0.55 + 0.3 * Math.sin(p);
    }
    if (beamRef.current) {
      beamRef.current.material.opacity = 0.35 + 0.15 * Math.sin(p * 0.7);
    }
  });

  return (
    <group position={[pos.x, 0, pos.z]} renderOrder={22}>
      {/* Ground halo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.21, 0]}>
        <circleGeometry args={[3, 32]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.18}
          depthTest={false} depthWrite={false} />
      </mesh>
      {/* Pulsing ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.22, 0]}>
        <ringGeometry args={[1.2, 1.6, 36]} />
        <meshBasicMaterial color="#4ade80" transparent opacity={0.7}
          depthTest={false} depthWrite={false} />
      </mesh>
      {/* Vertical beam */}
      <mesh ref={beamRef} position={[0, 6, 0]}>
        <cylinderGeometry args={[0.22, 0.5, 12, 8, 1, true]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.4}
          depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Top cap */}
      <mesh position={[0, 12.3, 0]}>
        <sphereGeometry args={[0.55, 12, 10]} />
        <meshBasicMaterial color="#bbf7d0" transparent opacity={0.95}
          depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─── Start ring ─────────────────────────────────────────────────────────
function StartMarker({ pos }) {
  return (
    <group position={[pos.x, 0.23, pos.z]} renderOrder={20}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 1.05, 24]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.95}
          depthTest={false} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <circleGeometry args={[0.65, 24]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.45}
          depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─── Wide ground carpet — soft glowing strip beneath the line ───────────
function GroundCarpet({ waypoints }) {
  const ref = useRef();
  const posRef = useNavigation(s => s.posRef);
  const segs = useMemo(() => {
    if (!waypoints || waypoints.length < 2) return [];
    const out = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i], b = waypoints[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 0.2) continue;
      out.push({
        mx: (a.x + b.x) / 2,
        mz: (a.z + b.z) / 2,
        len: len + 1.0, // slight overlap between segments
        ang: Math.atan2(b.x - a.x, b.z - a.z),
        cum: 0,
      });
    }
    let acc = 0;
    for (let i = 0; i < out.length; i++) {
      const s = out[i];
      s.cum = acc + s.len / 2;
      acc += s.len - 1.0;
    }
    return out;
  }, [waypoints]);

  useFrame(() => {
    if (!ref.current || !segs.length) return;
    // Same projection-onto-polyline trick to hide carpet behind character
    const p = posRef.current;
    let bestD = Infinity, traveled = 0, acc = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const a = waypoints[i - 1], b = waypoints[i];
      const ax = b.x - a.x, az = b.z - a.z;
      const segLen = Math.hypot(ax, az) || 1e-6;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * ax + (p.z - a.z) * az) / (segLen * segLen)));
      const px = a.x + ax * t, pz = a.z + az * t;
      const d2 = (px - p.x) * (px - p.x) + (pz - p.z) * (pz - p.z);
      if (d2 < bestD) { bestD = d2; traveled = acc + segLen * t; }
      acc += segLen;
    }
    segs.forEach((s, i) => {
      const child = ref.current.children[i];
      if (!child) return;
      const ahead = s.cum - traveled;
      child.visible = ahead > -1.0;
      const mat = child.material;
      if (mat) mat.opacity = Math.min(0.35, 0.35 * Math.min(1, (ahead + 2) / 3));
    });
  });

  return (
    <group ref={ref}>
      {segs.map((s, i) => (
        <mesh key={i} position={[s.mx, 0.04, s.mz]} rotation={[-Math.PI / 2, 0, s.ang]} renderOrder={1}>
          <planeGeometry args={[1.4, s.len]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.25}
            depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Main export ────────────────────────────────────────────────────────
// Ground-only route now: wide soft carpet + thin glow line on top, plus
// the destination beacon. No more floating marching cones — those were
// occluding the character in FPS / TPS at close range.
export default function AnimatedRoute({ waypoints, entrancePos }) {
  const { pts, total } = useMemo(() => buildPolyline(waypoints), [waypoints]);
  if (!pts.length) return null;
  const end = entrancePos || waypoints[waypoints.length - 1];

  return (
    <group>
      <GroundCarpet waypoints={waypoints} />
      <GlowLine pts={pts} total={total} />
      {/* StartMarker removed — once the character is walking it's just
          another bright disc at the feet. The carpet's leading edge
          already shows where the route begins. */}
      <DestinationBeacon pos={end} />
    </group>
  );
}
