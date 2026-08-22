import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import EquipmentMarker3D, { STATUS_COLORS } from "./EquipmentMarker3D";
import { createYardProjection, mapLatLngToYard } from "./equipmentCoordinateMapper";
import {
  createEquipmentAnimationState,
  stepEquipmentAnimation,
  upsertEquipmentTargets,
} from "./equipmentAnimationEngine";

const TMP = {
  vec: new THREE.Vector3(),
  cam: new THREE.Vector3(),
  look: new THREE.Vector3(),
  color: new THREE.Color(),
};

const statusToColor = (status) => STATUS_COLORS[status] || STATUS_COLORS.idle;

const EquipmentTrail = React.forwardRef(function EquipmentTrail({ maxPoints }, ref) {
  const positions = useMemo(() => new Float32Array(maxPoints * 3), [maxPoints]);
  const colors = useMemo(() => new Float32Array(maxPoints * 3), [maxPoints]);

  return (
    <line ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={maxPoints}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          array={colors}
          count={maxPoints}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.8}
        depthWrite={false}
      />
    </line>
  );
});

// Push a position outside a block pad if it lands inside one.
// blockList is an array of {cx, cz, w, d} scene-space block pads.
function pushOutsideBlocks(px, pz, blockList) {
  // No block-collision pushing — GPS coordinates are used as-is.
  // Block geometry in scene space does not reliably match real yard layout,
  // so pushing causes machines to jump into warehouses instead of staying on roads.
  return { x: px, z: pz };
}

// Snap scene-space position to nearest road segment.
// roadSegments: [{x1,z1,x2,z2}]  maxDist: meters threshold
function snapToRoad(px, pz, roadSegments, maxDist = 18) {
  if (!roadSegments || roadSegments.length === 0) return { x: px, z: pz };
  let bestDist = Infinity, bestX = px, bestZ = pz;
  for (const seg of roadSegments) {
    const dx = seg.x2 - seg.x1, dz = seg.z2 - seg.z1;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 0.001) continue;
    const t = Math.max(0, Math.min(1, ((px - seg.x1) * dx + (pz - seg.z1) * dz) / lenSq));
    const cx = seg.x1 + t * dx, cz = seg.z1 + t * dz;
    const d = Math.sqrt((px - cx) ** 2 + (pz - cz) ** 2);
    if (d < bestDist) { bestDist = d; bestX = cx; bestZ = cz; }
  }
  return bestDist <= maxDist ? { x: bestX, z: bestZ } : { x: px, z: pz };
}

export default function LiveEquipmentLayer({
  bounds,
  equipment,
  blocks,          // scene-space block geometry from YardScene
  roadSegments,    // [{x1,z1,x2,z2}] scene-space road segments for snap-to-road
  selectedId,
  followId,
  followMode,
  lowPerfMode,
  onSelect,
  controlsRef,
}) {
  const projection = useMemo(() => createYardProjection(bounds), [bounds]);
  // blockList MUST be declared before any hook that reads it
  const blockList = useMemo(() => (blocks ? Object.values(blocks) : []), [blocks]);

  const animationRef = useRef(createEquipmentAnimationState());
  const markerRefs = useRef(new Map());
  const trailRefs = useRef(new Map());
  const focusOnceRef = useRef(false);

  const { camera } = useThree();

  useEffect(() => {
    if (!projection) return;
    const adjusted = (equipment || []).map((eq) => {
      if (!Number.isFinite(eq.lat) || !Number.isFinite(eq.lon)) return eq;
      // clampToYard=true: GPS drift se machine yard boundary ke bahar nahi jayegi
      const raw = mapLatLngToYard(eq.lat, eq.lon, projection, true);
      if (!raw) return eq;
      // Snap to road network if available (keeps machines off buildings/blocks)
      const snapped = snapToRoad(raw.x, raw.z, roadSegments);
      return { ...eq, _adjustedX: snapped.x, _adjustedZ: snapped.z };
    });
    upsertEquipmentTargets(animationRef.current, adjusted, projection);
  }, [equipment, projection, blockList, roadSegments]);

  useEffect(() => {
    animationRef.current.options.maxTrailPoints = lowPerfMode ? 12 : 26;
  }, [lowPerfMode]);

  useEffect(() => {
    if (selectedId) focusOnceRef.current = true;
  }, [selectedId]);

  const entries = useMemo(() => {
    return (equipment || []).map((eq) => ({
      id: String(eq.id ?? eq.deviceId ?? eq.name),
      type: eq.type,
      status: eq.status,
      isUnlockPacket: !!eq.isUnlockPacket,
      isCarrying: !!eq.isCarrying,
      containerTag: eq.containerTag || null,
    }));
  }, [equipment]);

  const densityZones = useMemo(() => {
    if (!projection || lowPerfMode) return [];
    const cell = 28;
    const buckets = new Map();
    for (const eq of equipment || []) {
      const raw = mapLatLngToYard(eq.lat, eq.lon, projection);
      if (!raw || raw.outOfBounds) continue;
      const pos = pushOutsideBlocks(raw.x, raw.z, blockList);
      const gx = Math.floor(pos.x / cell);
      const gz = Math.floor(pos.z / cell);
      const key = `${gx}|${gz}`;
      const entry = buckets.get(key) || { x: 0, z: 0, count: 0 };
      entry.x += pos.x;
      entry.z += pos.z;
      entry.count += 1;
      buckets.set(key, entry);
    }
    const zones = [];
    buckets.forEach((b) => {
      if (b.count >= 3) {
        zones.push({
          x: b.x / b.count,
          z: b.z / b.count,
          count: b.count,
        });
      }
    });
    return zones;
  }, [equipment, projection, lowPerfMode, blockList]);

  useFrame((state, dt) => {
    if (!projection) return;
    stepEquipmentAnimation(animationRef.current, dt);

    const items = animationRef.current.items;
    for (const [id, entry] of items) {
      const ref = markerRefs.current.get(id);
      if (ref?.current && entry.inited) {
        ref.current.position.set(entry.current.x, 0.35, entry.current.z);
        ref.current.rotation.set(0, entry.current.heading, 0);
      }

      const trailRef = trailRefs.current.get(id);
      if (trailRef?.current && entry.trail.length > 1) {
        const geom = trailRef.current.geometry;
        const posAttr = geom.getAttribute("position");
        const colAttr = geom.getAttribute("color");
        const max = posAttr.count;
        const count = Math.min(entry.trail.length, max);
        const baseColor = TMP.color.set(statusToColor(entry.meta?.status || "idle"));

        for (let i = 0; i < count; i++) {
          const t = entry.trail[i];
          const idx = i * 3;
          posAttr.array[idx] = t.x;
          posAttr.array[idx + 1] = 0.35;
          posAttr.array[idx + 2] = t.z;

          const fade = i / Math.max(1, count - 1);
          TMP.color.copy(baseColor).multiplyScalar(0.4 + fade * 0.6);
          colAttr.array[idx] = TMP.color.r;
          colAttr.array[idx + 1] = TMP.color.g;
          colAttr.array[idx + 2] = TMP.color.b;
        }
        geom.setDrawRange(0, count);
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
      }
    }

    const followTargetId = followMode ? followId || selectedId : null;
    const focusId = focusOnceRef.current ? selectedId : null;
    const targetId = followTargetId || focusId;
    if (targetId && items.has(String(targetId))) {
      const entry = items.get(String(targetId));
      if (entry?.inited) {
        const ctrl = controlsRef?.current;
        const target = TMP.look.set(entry.current.x, 6, entry.current.z);
        const offset = TMP.vec.set(0, 30, 30);
        if (followMode && entry.current.heading != null) {
          offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), entry.current.heading + Math.PI);
        }
        const desiredCam = TMP.cam.copy(target).add(offset);
        camera.position.lerp(desiredCam, 1 - Math.exp(-dt * 3));
        if (ctrl) {
          ctrl.target.lerp(target, 1 - Math.exp(-dt * 5));
          ctrl.update();
        }
        if (!followMode) focusOnceRef.current = false;
      }
    }
  });

  const attachRef = (map, id) => (node) => {
    if (node) {
      map.set(id, { current: node });
    } else {
      map.delete(id);
    }
  };

  if (!projection) return null;

  const trailPoints = lowPerfMode ? 12 : animationRef.current.options.maxTrailPoints;

  return (
    <group>
      {densityZones.map((zone, i) => (
        <mesh
          key={`density-${i}`}
          position={[zone.x, 0.02, zone.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[Math.min(6 + zone.count * 1.6, 18), 24]} />
          <meshBasicMaterial color="#f97316" transparent opacity={0.18} />
        </mesh>
      ))}
      {entries.map((eq) => (
        <EquipmentTrail
          key={`trail-${eq.id}`}
          ref={attachRef(trailRefs.current, eq.id)}
          maxPoints={trailPoints}
        />
      ))}
      {entries.map((eq) => (
        <EquipmentMarker3D
          key={eq.id}
          ref={attachRef(markerRefs.current, eq.id)}
          type={eq.type}
          status={eq.status}
          selected={String(eq.id) === String(selectedId)}
          lowPerfMode={lowPerfMode}
          isUnlockPacket={eq.isUnlockPacket}
          isCarrying={eq.isCarrying}
          containerTag={eq.containerTag}
          onClick={(e) => {
            e.stopPropagation();
            if (onSelect) onSelect(eq.id);
          }}
        />
      ))}
    </group>
  );
}
