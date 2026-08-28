// IndustrialWallPanel.jsx — the shared "industrial container-terminal wall"
// look: grimy base band -> textured concrete shaft -> coping cap -> security-
// fence topper, with reinforced pillars and optional wall-mounted lights.
//
// Used by BOTH the real DXF-derived perimeter (PerimeterWallSystem.jsx, many
// segments sharing one material set) and the Yard Builder's hand-drawn
// "customise" walls (PropKit.jsx's CompoundWallSegment/SecurityWallSegment,
// each drawn run owning its own small tinted material set) — factored out
// here so a hand-drawn wall and the real boundary render as literally the
// same wall system rather than two lookalikes that drift apart.

import React, { useMemo, useRef, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  getConcreteWallMaps, getWallBaseGrimeMaps, getSecurityBarsTexture,
} from "./wallTextures";

export const NO_RAYCAST = () => null;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Real-world proportions shared by every wall in the scene — a fixed
// concrete-panel tile width, fence-bar tile width, and wall/base thickness,
// so a hand-drawn wall and the real perimeter tile identically instead of
// just sharing a color.
export const PANEL_W = 3.0;      // metres per concrete formwork tile
export const BAR_TILE_W = 0.6;   // metres per fence-bar texture tile
export const WALL_T = 0.32;
export const BASE_T = 0.42;
export const OVERHANG = 0.36;    // each segment renders len+OVERHANG so adjacent segments/corners overlap instead of leaving a wedge of daylight at the joint
export const PILLAR_TOP_R = 0.22;
export const PILLAR_BOTTOM_R = 0.28;

// Standard wall height — as tall as 2 tiers of a stacked container. Same
// 2.591m unit height (+0.08m inter-tier gap) YardScene.jsx uses to place
// real container tiers (see CONTAINER_H/TIER_GAP there), duplicated here
// rather than imported since those are local consts, not exports — kept in
// sync by the shared "2 tiers" comment/intent, not by reference.
const CONTAINER_TIER_H = 2.591;
const CONTAINER_TIER_GAP = 0.08;
export const WALL_TOTAL_H = CONTAINER_TIER_H * 2 + CONTAINER_TIER_GAP; // ≈ 5.26m

// Proportional layer split for a given total wall height — same shape
// (grimy base / concrete shaft / coping / fence topper) whether the wall is
// the real ~3.1 m perimeter default or a custom wall the user set to some
// other height.
export function wallLayerHeights(totalH = WALL_TOTAL_H, showFence = true) {
  const h = Math.max(1.2, totalH);
  const baseBandH = clamp(h * 0.11, 0.22, 0.4);
  const copeH = 0.14;
  let fenceH = showFence ? clamp(h * 0.3, 0.5, 1.3) : 0;
  let shaftH = h - baseBandH - copeH - fenceH;
  if (shaftH < 0.3) {
    fenceH = Math.max(0, fenceH - (0.3 - shaftH));
    shaftH = h - baseBandH - copeH - fenceH;
  }
  return { baseBandH, copeH, fenceH, shaftH };
}

// World/local Y offsets for each layer given a ground origin and the layer
// heights above — small 0.05 overlaps between layers so there's never a
// hairline gap at the seams.
export function wallLayerOffsets(groundY, heights) {
  const { baseBandH, copeH, fenceH, shaftH } = heights;
  const baseY = groundY + baseBandH / 2;
  const shaftY = groundY + baseBandH - 0.05 + shaftH / 2;
  const copeY = groundY + baseBandH - 0.05 + shaftH + copeH / 2;
  const fenceY = copeY + copeH / 2 + fenceH / 2;
  const topY = fenceH > 0 ? fenceY + fenceH / 2 : copeY + copeH / 2;
  return { baseY, shaftY, copeY, fenceY, topY };
}

export function tileU(geom, tilesX) {
  const uv = geom.attributes.uv;
  if (!uv) return geom;
  const arr = uv.array;
  for (let i = 0; i < arr.length; i += 2) arr[i] *= tilesX;
  uv.needsUpdate = true;
  geom.setAttribute("uv2", geom.attributes.uv);
  return geom;
}

// Builds the (shareable) material set for one wall color tint. Textures
// themselves come from the module-level singleton cache in wallTextures.js —
// only the THREE.MeshStandardMaterial wrapper objects are per-tint.
export function useWallMaterials(color) {
  const wallMaps = useMemo(() => getConcreteWallMaps(), []);
  const baseMaps = useMemo(() => getWallBaseGrimeMaps(), []);
  const barsTex = useMemo(() => getSecurityBarsTexture(), []);
  const tint = useMemo(() => new THREE.Color(color || "#9c988d"), [color]);

  return useMemo(() => ({
    wallMaterial: new THREE.MeshStandardMaterial({
      map: wallMaps.map, normalMap: wallMaps.normalMap,
      roughnessMap: wallMaps.roughnessMap, aoMap: wallMaps.aoMap,
      color: tint.clone(), roughness: 0.88, metalness: 0.03,
    }),
    baseMaterial: new THREE.MeshStandardMaterial({
      map: baseMaps.map, roughnessMap: baseMaps.roughnessMap,
      color: tint.clone().multiplyScalar(0.6), roughness: 0.95, metalness: 0,
    }),
    copeMaterial: new THREE.MeshStandardMaterial({
      color: tint.clone().lerp(new THREE.Color("#ffffff"), 0.22), roughness: 0.75, metalness: 0.04,
    }),
    fenceMaterial: new THREE.MeshStandardMaterial({
      map: barsTex, alphaTest: 0.4, side: THREE.DoubleSide,
      color: "#c7ccd2", roughness: 0.55, metalness: 0.55,
    }),
    pillarMaterial: new THREE.MeshStandardMaterial({
      color: tint.clone().lerp(new THREE.Color("#ffffff"), 0.06), roughness: 0.72, metalness: 0.08,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [wallMaps, baseMaps, barsTex, tint]);
}

// ─── One wall segment's stacked panels (base band / shaft / coping / fence).
// `len` is the true drawn/derived length; each layer renders len+OVERHANG so
// neighbouring segments (interior joints, corners, and — via the caller
// pre-extending its end points — a hand-drawn wall's junction with the real
// perimeter) overlap instead of leaving a gap. ─────────────────────────────
export function WallLayerStack({
  len, groundY = 0, heights, materials, showFence = true,
}) {
  const baseGeo = useRef(), shaftGeo = useRef(), fenceGeo = useRef();
  const over = len + OVERHANG;
  const { baseY, shaftY, copeY, fenceY } = wallLayerOffsets(groundY, heights);
  const tilesConcrete = Math.max(1, Math.round(over / PANEL_W));
  const tilesFence = Math.max(1, Math.round(over / BAR_TILE_W));
  const tilesBase = Math.max(1, Math.round(over / 1.2));

  useLayoutEffect(() => {
    if (baseGeo.current) tileU(baseGeo.current, tilesBase);
    if (shaftGeo.current) tileU(shaftGeo.current, tilesConcrete);
    if (fenceGeo.current) tileU(fenceGeo.current, tilesFence);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over, tilesBase, tilesConcrete, tilesFence]);

  return (
    <>
      <mesh position={[0, baseY, 0]} material={materials.baseMaterial} receiveShadow raycast={NO_RAYCAST}>
        <boxGeometry ref={baseGeo} args={[over, heights.baseBandH, BASE_T]} />
      </mesh>
      <mesh position={[0, shaftY, 0]} material={materials.wallMaterial} castShadow receiveShadow>
        <boxGeometry ref={shaftGeo} args={[over, heights.shaftH, WALL_T]} />
      </mesh>
      <mesh position={[0, copeY, 0]} material={materials.copeMaterial} castShadow receiveShadow raycast={NO_RAYCAST}>
        <boxGeometry args={[over, heights.copeH, WALL_T + 0.06]} />
      </mesh>
      {showFence && heights.fenceH > 0 && (
        <mesh position={[0, fenceY, 0]} material={materials.fenceMaterial} receiveShadow raycast={NO_RAYCAST}>
          <planeGeometry ref={fenceGeo} args={[over, heights.fenceH]} />
        </mesh>
      )}
    </>
  );
}

// ─── Reinforced pillars along local X, evenly spaced (never hardcoded). ───
export function WallPillars({ positions, pillarH, pillarY, material }) {
  if (!positions.length) return null;
  return (
    <>
      {positions.map((u, i) => (
        <mesh key={i} position={[u, pillarY, 0]} material={material} castShadow receiveShadow>
          <cylinderGeometry args={[PILLAR_TOP_R, PILLAR_BOTTOM_R, pillarH, 8]} />
        </mesh>
      ))}
    </>
  );
}

// ─── Wall-mounted security light — verbatim Masts.jsx fixture/light formula
// (fixtureGlow / lightOn / pointLight-without-shadow), scaled down for a
// ~3m wall instead of a ~30m high mast, positioned explicitly by the caller
// rather than off shared module constants so any wall height works. Dark
// through the day, only brightens as nightOn rises — same rule as Masts.jsx. ─
export function WallLightFixture({ x, y, z, rotY, nightOn, thickness = WALL_T }) {
  const fixtureGlow = nightOn * 2;
  const lightOn = nightOn > 0.08; // skip the pointLight in daylight, same reasoning as Masts.jsx
  return (
    <group position={[x, y, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0, thickness / 2 + 0.14]} castShadow>
        <boxGeometry args={[0.2, 0.14, 0.28]} />
        <meshStandardMaterial color="#3a3f47" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[0, -0.03, thickness / 2 + 0.29]}>
        <boxGeometry args={[0.15, 0.05, 0.08]} />
        <meshStandardMaterial color="#eef4ff" emissive="#eaf2ff" emissiveIntensity={fixtureGlow} toneMapped={false} />
      </mesh>
      {lightOn && (
        <pointLight
          position={[0, -0.15, thickness / 2 + 0.4]}
          color="#eef4ff" intensity={nightOn * 42} distance={15} decay={1.7}
        />
      )}
    </group>
  );
}

// ─── Wall-mounted CCTV — adapted from Masts.jsx's LiveCameraBody (blinking
// red LED). ─────────────────────────────────────────────────────────────
export function WallCamera({ x, y, z, rotY, thickness = WALL_T }) {
  const ledRef = useRef();
  useFrame(({ clock }) => {
    if (!ledRef.current) return;
    const on = Math.sin(clock.elapsedTime * 4.8) > 0;
    ledRef.current.material.emissiveIntensity = on ? 2.2 : 0.15;
  });
  return (
    <group position={[x, y, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0, thickness / 2 + 0.14]} castShadow>
        <boxGeometry args={[0.15, 0.13, 0.3]} />
        <meshStandardMaterial color="#23272e" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh ref={ledRef} position={[0, 0.05, thickness / 2 + 0.3]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#ff2020" emissive="#ff0000" emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function WallSign({ x, y, z, rotY, texture }) {
  return (
    <mesh position={[x, y, z]} rotation={[0, rotY, 0]}>
      <planeGeometry args={[0.85, 0.53]} />
      <meshStandardMaterial map={texture} roughness={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── Self-contained panel for a single hand-drawn wall run in the Yard
// Builder — owns its own (per-color) material set, sized to `h`, with end
// pillars + end lights baked in so a drawn wall reads as a complete piece of
// the same wall system without the caller having to assemble it. Local
// space: length runs along local X, centred at local origin, "ground" at
// local y=0 — matches PropKit's existing per-segment <group position/
// rotation> wrapper convention exactly, so it drops in wherever
// CompoundWallSegment/SecurityWallSegment currently render. ────────────────
export default function IndustrialWallPanel({
  len, h = WALL_TOTAL_H, color, nightOn = 0, showFence = true, showPillars = true, showLights = true,
  pillarSpacing = 3.6,
}) {
  const heights = useMemo(() => wallLayerHeights(h, showFence), [h, showFence]);
  const materials = useWallMaterials(color);
  const { topY } = wallLayerOffsets(0, heights);

  const pillarPositions = useMemo(() => {
    if (!showPillars || len < 0.5) return [];
    const count = Math.min(24, Math.max(2, Math.round(len / pillarSpacing) + 1));
    const out = [];
    for (let i = 0; i < count; i++) out.push(-len / 2 + (i / (count - 1)) * len);
    return out;
  }, [len, pillarSpacing, showPillars]);

  const pillarH = topY + 0.16 - 0;
  const pillarY = pillarH / 2;

  if (!(len > 0.01)) return null;

  return (
    <group>
      <WallLayerStack len={len} groundY={0} heights={heights} materials={materials} showFence={showFence} />
      <WallPillars positions={pillarPositions} pillarH={pillarH} pillarY={pillarY} material={materials.pillarMaterial} />
      {showLights && (
        <>
          <WallLightFixture x={-len / 2} y={topY - 0.15} z={0} rotY={0} nightOn={nightOn} />
          <WallLightFixture x={len / 2} y={topY - 0.15} z={0} rotY={Math.PI} nightOn={nightOn} />
        </>
      )}
    </group>
  );
}
