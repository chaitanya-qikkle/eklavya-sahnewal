import React, { forwardRef, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const TYPE_COLORS = {
  reach_stacker: "#22c55e",
  truck: "#0ea5e9",
  crane: "#f97316",
  forklift: "#facc15",
  trailer: "#a855f7",
  rtg: "#ef4444",
  empty_handler: "#14b8a6",
  unknown: "#94a3b8",
};

export const STATUS_COLORS = {
  moving: "#22c55e",
  idle: "#f59e0b",
  offline: "#ef4444",
  ignition_off: "#64748b",
  emergency: "#dc2626",
};

export const normalizeTypeKey = (value) => {
  if (!value) return "unknown";
  const v = String(value).trim().toLowerCase();
  if (v.includes("reach")) return "reach_stacker";
  if (v.includes("truck")) return "truck";
  if (v.includes("crane")) return "crane";
  if (v.includes("fork")) return "forklift";
  if (v.includes("trailer")) return "trailer";
  if (v.includes("rtg")) return "rtg";
  if (v.includes("empty")) return "empty_handler";
  return "unknown";
};

const baseMaterial = (color) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color).multiplyScalar(0.2),
    roughness: 0.45,
    metalness: 0.15,
  });

const glowMaterial = (color) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.9,
    roughness: 0.25,
    metalness: 0.2,
  });

// Unlock ring — animated pulsing torus shown when equipment just did an unlock
const UnlockRing = ({ color }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
    <torusGeometry args={[8.0, 0.4, 8, 32]} />
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={1.4}
      transparent
      opacity={0.85}
    />
  </mesh>
);

// Container gripped by spreader — hangs vertically below spreader.
// Counter-rotates against boom angle so it stays level (gravity-correct).
// W=2.4m(X), H=2.6m(Y), L=6.1m(Z)
const CarriedContainerInBoom = ({ color }) => {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color, emissive: new THREE.Color(color).multiplyScalar(0.28), roughness: 0.5, metalness: 0.35,
  }), [color]);
  const ribMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.62), roughness: 0.7, metalness: 0.3,
  }), [color]);
  const W = 2.4, H = 2.6, L = 6.1;
  const hw = W / 2, hh = H / 2, hl = L / 2;
  return (
    <group position={[0, -hh, 0]}>
      <mesh material={mat}><boxGeometry args={[W, H, L]} /></mesh>
      {Array.from({ length: 9 }, (_, i) => {
        const y = -hh + (i / 8) * H;
        return <mesh key={i} position={[0, y, 0]} material={ribMat}><boxGeometry args={[W + 0.04, 0.07, L + 0.04]} /></mesh>;
      })}
      {[[-hw,-hl],[-hw,hl],[hw,-hl],[hw,hl]].map(([px,pz],i) => (
        <mesh key={i} position={[px, 0, pz]} material={ribMat}><boxGeometry args={[0.14, H + 0.06, 0.14]} /></mesh>
      ))}
      {[-hh, hh].map((py, i) => (
        <mesh key={i} position={[0, py, 0]} material={ribMat}><boxGeometry args={[W + 0.06, 0.1, L + 0.06]} /></mesh>
      ))}
      <mesh position={[0, 0, hl + 0.04]}>
        <boxGeometry args={[W + 0.02, H + 0.02, 0.08]} />
        <meshStandardMaterial color={new THREE.Color(color).multiplyScalar(0.55)} roughness={0.65} metalness={0.4} />
      </mesh>
      <mesh>
        <boxGeometry args={[W + 0.22, H + 0.22, L + 0.22]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} transparent opacity={0.15} side={THREE.BackSide} />
      </mesh>
    </group>
  );
};

// HORIZONTAL ISO container on machine spreader (isCarrying)
// 20ft lying flat: W=2.4m(X), H=2.6m(Y), L=6.1m(Z along machine heading)
const CarriedContainer = ({ color }) => {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color, emissive: new THREE.Color(color).multiplyScalar(0.25), roughness: 0.52, metalness: 0.35,
  }), [color]);
  const ribMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.68), roughness: 0.7, metalness: 0.3,
  }), [color]);

  const W = 2.4, H = 2.6, L = 6.1;
  const hw = W / 2, hh = H / 2, hl = L / 2;

  // Sits at boom tip — y=6.5 (boom height), z=-8 (front of machine)
  return (
    <group position={[0, 6.5, -8.0]} rotation={[0, Math.PI / 2, 0]}>
      {/* Body */}
      <mesh material={mat}><boxGeometry args={[W, H, L]} /></mesh>
      {/* Horizontal corrugation ribs (at different Y heights, full width) */}
      {Array.from({ length: 9 }, (_, i) => {
        const y = -hh + (i / 8) * H;
        return (
          <mesh key={i} position={[0, y, 0]} material={ribMat}>
            <boxGeometry args={[W + 0.04, 0.07, L + 0.04]} />
          </mesh>
        );
      })}
      {/* Vertical corner posts */}
      {[[-hw,-hl],[-hw,hl],[hw,-hl],[hw,hl]].map(([px,pz],i) => (
        <mesh key={i} position={[px, 0, pz]} material={ribMat}>
          <boxGeometry args={[0.14, H + 0.06, 0.14]} />
        </mesh>
      ))}
      {/* Top & bottom rails */}
      {[-hh, hh].map((py, i) => (
        <mesh key={i} position={[0, py, 0]} material={ribMat}>
          <boxGeometry args={[W + 0.06, 0.1, L + 0.06]} />
        </mesh>
      ))}
      {/* Door face at +Z */}
      <mesh position={[0, 0, hl + 0.04]}>
        <boxGeometry args={[W + 0.02, H + 0.02, 0.08]} />
        <meshStandardMaterial color={new THREE.Color(color).multiplyScalar(0.55)} roughness={0.65} metalness={0.4} />
      </mesh>
      {/* Glow outline */}
      <mesh><boxGeometry args={[W + 0.2, H + 0.2, L + 0.2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.14} side={THREE.BackSide} />
      </mesh>
    </group>
  );
};

// HORIZONTAL ISO container — lying flat on ground after being placed (isUnlockPacket)
// L=6.1m(Z), W=2.4m(X), H=2.6m(Y)
const GroundContainer = ({ color }) => {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color, emissive: new THREE.Color(color).multiplyScalar(0.2), roughness: 0.55, metalness: 0.35,
  }), [color]);
  const ribMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.68), roughness: 0.7, metalness: 0.3,
  }), [color]);

  const L = 6.1, W = 2.4, H = 2.6;
  const hl = L / 2, hw = W / 2, hh = H / 2;

  return (
    <group position={[0, hh, 13.0]}>
      <mesh material={mat}><boxGeometry args={[W, H, L]} /></mesh>
      {/* Horizontal ribs */}
      {Array.from({ length: 8 }, (_, i) => {
        const y = -hh + (i / 7) * H;
        return (
          <mesh key={i} position={[0, y, 0]} material={ribMat}>
            <boxGeometry args={[W + 0.04, 0.08, L + 0.04]} />
          </mesh>
        );
      })}
      {/* Corner posts */}
      {[[-hw,-hl],[-hw,hl],[hw,-hl],[hw,hl]].map(([px,pz],i) => (
        <mesh key={i} position={[px, 0, pz]} material={ribMat}>
          <boxGeometry args={[0.14, H + 0.06, 0.14]} />
        </mesh>
      ))}
      {[-hh,hh].map((py,i) => (
        <mesh key={i} position={[0, py, 0]} material={ribMat}>
          <boxGeometry args={[W + 0.06, 0.1, L + 0.06]} />
        </mesh>
      ))}
      <mesh position={[0, 0, hl + 0.04]}>
        <boxGeometry args={[W + 0.02, H + 0.02, 0.08]} />
        <meshStandardMaterial color={new THREE.Color(color).multiplyScalar(0.55)} roughness={0.65} metalness={0.4} />
      </mesh>
      <mesh><boxGeometry args={[W + 0.2, H + 0.2, L + 0.2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} transparent opacity={0.13} side={THREE.BackSide} />
      </mesh>
    </group>
  );
};

// Reusable temps so the per-frame cable math allocates nothing.
const _A = new THREE.Vector3();
const _B = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();

// Animated hoist spreader that lowers a container into the block, then lifts
// back up — the visual for an unlock (PacketID=8) event. The cables fan out at
// an ANGLE from a single high anchor set back over the machine down to the
// spreader ahead of it (z=13), like a real reach-stacker arm reaching out.
const UnlockSpreader = ({ color }) => {
  const frameRef = useRef();
  const cableRefs = useRef([]);

  const W = 2.4, L = 6.1, H = 2.6;
  const SPREADER_Z = 13.0;        // spreader/container sit ahead of the machine
  const TOP_Y = 9.0;              // spreader raised
  const BOTTOM_Y = H + 0.45;      // spreader resting just on top of the placed box

  // Single anchor up high and set BACK toward the machine — this is what makes
  // the cables slant (aada) instead of dropping straight down.
  const ANCHOR = useMemo(() => [0, 13.0, 4.0], []);

  // Corner offsets for cables + twist-locks (spans the 20ft box footprint)
  const corners = useMemo(
    () => [
      [-W / 2 - 0.2, -L / 2 - 0.2],
      [-W / 2 - 0.2, L / 2 + 0.2],
      [W / 2 + 0.2, -L / 2 - 0.2],
      [W / 2 + 0.2, L / 2 + 0.2],
    ],
    [W, L]
  );

  useFrame((state) => {
    // Smooth ping-pong: down to set the box, back up, repeat (~4s cycle).
    const phase = (Math.sin(state.clock.elapsedTime * 1.5) + 1) / 2; // 0..1
    const y = BOTTOM_Y + (TOP_Y - BOTTOM_Y) * phase;
    if (frameRef.current) frameRef.current.position.y = y;

    _A.set(ANCHOR[0], ANCHOR[1], ANCHOR[2]);
    corners.forEach(([cx, cz], i) => {
      const c = cableRefs.current[i];
      if (!c) return;
      // Spreader corner (cable bottom) in marker-local space.
      _B.set(cx, y, SPREADER_Z + cz);
      _dir.copy(_B).sub(_A);
      const len = Math.max(0.05, _dir.length());
      _mid.copy(_A).add(_B).multiplyScalar(0.5);
      _quat.setFromUnitVectors(_up, _dir.normalize());
      c.position.copy(_mid);
      c.quaternion.copy(_quat);
      c.scale.set(1, len, 1);
    });
  });

  return (
    <group>
      {/* Pulley anchor block (boom tip), set back over the machine */}
      <mesh position={ANCHOR}>
        <boxGeometry args={[1.2, 0.5, 1.0]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.4} />
      </mesh>

      {/* Angled cables — unit-height cylinders re-oriented each frame */}
      {corners.map((_, i) => (
        <mesh key={i} ref={(el) => (cableRefs.current[i] = el)}>
          <cylinderGeometry args={[0.05, 0.05, 1, 6]} />
          <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.35} />
        </mesh>
      ))}

      {/* Spreader frame that travels up/down (z fixed ahead of the machine) */}
      <group ref={frameRef} position={[0, TOP_Y, SPREADER_Z]}>
        <mesh>
          <boxGeometry args={[W + 0.6, 0.35, L + 0.6]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} metalness={0.55} roughness={0.3} />
        </mesh>
        {corners.map(([x, z], i) => (
          <mesh key={i} position={[x, -0.28, z]}>
            <cylinderGeometry args={[0.12, 0.12, 0.4, 8]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

const EquipmentMarker3D = forwardRef(function EquipmentMarker3D(
  { type, status, selected, lowPerfMode, onClick, isUnlockPacket, isCarrying, containerTag },
  ref
) {
  const typeKey = normalizeTypeKey(type);
  const baseColor = TYPE_COLORS[typeKey] || TYPE_COLORS.unknown;
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.idle;

  // unlock = gold ring; locked/no event = no ring
  const unlockColor = "#f59e0b";
  const containerColor = "#38bdf8"; // sky-blue for the container being worked on

  const material = useMemo(() => baseMaterial(baseColor), [baseColor]);
  const glowMat = useMemo(() => glowMaterial(statusColor), [statusColor]);

  return (
    <group ref={ref} onClick={onClick}>
      {/* Ground shadow disc — Kalmar RS radius ~7m */}
      {!lowPerfMode && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <circleGeometry args={[7, 24]} />
          <meshStandardMaterial color="#0b1220" transparent opacity={0.35} />
        </mesh>
      )}


      {/* Selection ring */}
      {selected && !lowPerfMode && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[7.5, 8.2, 32]} />
          <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={1} transparent opacity={0.7} />
        </mesh>
      )}

      {/*
        ── REACH STACKER (Kalmar RS46) ──
        Orientation: Z+ = front of machine (cab side), Z- = rear
        Machine sits with ground at Y=0.

        Real machine layout (top view):
        - Cab: front-right
        - Boom pivot: rear-center, at chassis height
        - Boom extends forward (Z+) and slightly upward (~30-40° from horizontal)
        - Spreader hangs DOWN from boom tip
        - Container gripped BELOW spreader
      */}

      {/* ── Chassis body: 14m long, 4.5m wide, 2m tall ── */}
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[4.5, 2.0, 14.0]} />
        <primitive object={material} attach="material" />
      </mesh>

      {/* Counterweight block at rear (Z-) */}
      <mesh position={[0, 2.2, -5.5]}>
        <boxGeometry args={[4.5, 2.0, 3.0]} />
        <meshStandardMaterial color="#333" roughness={0.8} metalness={0.4} />
      </mesh>

      {/* ── Cab: front-right, elevated ── */}
      <mesh position={[1.2, 3.8, 5.0]}>
        <boxGeometry args={[2.2, 3.2, 2.8]} />
        <primitive object={glowMat} attach="material" />
      </mesh>
      {/* Cab roof */}
      <mesh position={[1.2, 5.6, 5.0]}>
        <boxGeometry args={[2.4, 0.25, 3.0]} />
        <primitive object={material} attach="material" />
      </mesh>
      {/* Cab window (dark glass look) */}
      <mesh position={[1.2, 4.0, 6.45]}>
        <boxGeometry args={[2.0, 2.0, 0.1]} />
        <meshStandardMaterial color="#1a2a3a" roughness={0.1} metalness={0.5} transparent opacity={0.85} />
      </mesh>

      {/* ── Wheels: 4 large tyres, 2 front 2 rear ── */}
      {/* Front axle */}
      {[[-2.6, 5.5],[2.6, 5.5]].map(([wx, wz], i) => (
        <mesh key={`fw${i}`} position={[wx, 1.0, wz]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1.15, 1.15, 1.1, 20]} />
          <meshStandardMaterial color="#111" roughness={0.95} metalness={0.05} />
        </mesh>
      ))}
      {/* Rear axle */}
      {[[-2.6, -5.5],[2.6, -5.5]].map(([wx, wz], i) => (
        <mesh key={`rw${i}`} position={[wx, 1.0, wz]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1.1, 1.1, 1.0, 20]} />
          <meshStandardMaterial color="#111" roughness={0.95} metalness={0.05} />
        </mesh>
      ))}

      {/* ── BOOM SYSTEM ──
          Pivot at rear-top of chassis (Z=-3, Y=2.0).
          Boom extends along its LOCAL Z axis.
          rotation.X = -0.55 rad ≈ 32° upward from horizontal → boom goes forward+up.
          Boom length ~13m.
          At boom tip: spreader hangs down, container below spreader.
      */}
      {typeKey === "reach_stacker" && (() => {
        // Boom pivot at rear-top. Angle = -0.55 rad (~31°) upward.
        // Boom extends along local Z+, so tip goes forward AND up.
        const boomAngle = -0.55;
        const boomLen   = 16.0;
        const pivotY    = 3.5;
        const pivotZ    = -3.5;

        return (
          <>
            {/* Pivot bracket */}
            <mesh position={[0, pivotY + 0.3, pivotZ]}>
              <boxGeometry args={[1.0, 0.8, 1.0]} />
              <meshStandardMaterial color="#444" roughness={0.5} metalness={0.7} />
            </mesh>

            {/* Hydraulic ram under boom */}
            <group position={[0, 3.0, -1.0]} rotation={[-0.75, 0, 0]}>
              <mesh>
                <cylinderGeometry args={[0.16, 0.20, 5.0, 10]} />
                <meshStandardMaterial color="#bbb" roughness={0.3} metalness={0.9} />
              </mesh>
            </group>

            {/* BOOM GROUP — everything inside inherits boom angle */}
            <group position={[0, pivotY, pivotZ]} rotation={[boomAngle, 0, 0]}>
              {/* Outer boom */}
              <mesh position={[0, 0, boomLen / 2]}>
                <boxGeometry args={[1.1, 1.1, boomLen]} />
                <primitive object={glowMat} attach="material" />
              </mesh>
              {/* Inner telescoping section */}
              <mesh position={[0, 0, boomLen * 0.78]}>
                <boxGeometry args={[0.75, 0.75, boomLen * 0.48]} />
                <primitive object={glowMat} attach="material" />
              </mesh>

              {/* SPREADER + CONTAINER — directly at boom tip, inside boom group */}
              <group position={[0, 0, boomLen]}>
                {/* Vertical hangers from boom tip down to spreader */}
                <mesh position={[-1.5, -1.2, 0]}>
                  <boxGeometry args={[0.1, 2.5, 0.1]} />
                  <meshStandardMaterial color="#555" roughness={0.5} metalness={0.7} />
                </mesh>
                <mesh position={[1.5, -1.2, 0]}>
                  <boxGeometry args={[0.1, 2.5, 0.1]} />
                  <meshStandardMaterial color="#555" roughness={0.5} metalness={0.7} />
                </mesh>

                {/* SPREADER — 45° down + aada */}
                <group position={[0, -2.5, 0]} rotation={[Math.PI / 4 - 0.26, Math.PI / 2, 0]}>
                  {/* Main spreader body */}
                  <mesh>
                    <boxGeometry args={[3.6, 0.45, 6.6]} />
                    <primitive object={material} attach="material" />
                  </mesh>
                  {/* Side rails */}
                  <mesh position={[-1.75, 0, 0]}>
                    <boxGeometry args={[0.22, 0.55, 6.6]} />
                    <meshStandardMaterial color="#333" roughness={0.5} metalness={0.7} />
                  </mesh>
                  <mesh position={[1.75, 0, 0]}>
                    <boxGeometry args={[0.22, 0.55, 6.6]} />
                    <meshStandardMaterial color="#333" roughness={0.5} metalness={0.7} />
                  </mesh>
                  {/* Twist locks */}
                  {[[-1.5, -3.1], [1.5, -3.1], [-1.5, 3.1], [1.5, 3.1]].map(([sx, sz], i) => (
                    <mesh key={i} position={[sx, -0.4, sz]}>
                      <cylinderGeometry args={[0.15, 0.15, 0.28, 8]} />
                      <meshStandardMaterial
                        color={isCarrying ? "#f59e0b" : "#222"}
                        emissive={isCarrying ? "#f59e0b" : "#000"}
                        emissiveIntensity={isCarrying ? 1.4 : 0}
                        roughness={0.2} metalness={0.95}
                      />
                    </mesh>
                  ))}

                  {/* Container below spreader */}
                  {isCarrying && (
                    <group position={[0, -0.6, 0]}>
                      <CarriedContainerInBoom color={containerColor} />
                    </group>
                  )}
                </group>
              </group>
            </group>
          </>
        );
      })()}

      {/* RTG / Crane — tall gantry */}
      {typeKey === "crane" && (
        <>
          <mesh position={[0, 1.0, 0]}>
            <boxGeometry args={[4.5, 2.0, 12.0]} />
            <primitive object={material} attach="material" />
          </mesh>
          <mesh position={[0, 7.0, 0]}>
            <boxGeometry args={[1.2, 10.0, 1.2]} />
            <primitive object={glowMat} attach="material" />
          </mesh>
        </>
      )}

      {/* Truck */}
      {typeKey === "truck" && (
        <>
          <mesh position={[0, 1.0, 0]}>
            <boxGeometry args={[2.5, 2.0, 10.0]} />
            <primitive object={material} attach="material" />
          </mesh>
          <mesh position={[0.5, 3.2, 3.5]}>
            <boxGeometry args={[2.2, 2.4, 2.5]} />
            <primitive object={material} attach="material" />
          </mesh>
        </>
      )}

      {/* Forklift */}
      {typeKey === "forklift" && (
        <>
          <mesh position={[0, 1.0, 0]}>
            <boxGeometry args={[2.0, 2.0, 4.0]} />
            <primitive object={material} attach="material" />
          </mesh>
          <mesh position={[0, 4.5, -2.0]}>
            <boxGeometry args={[0.5, 6.0, 0.5]} />
            <primitive object={material} attach="material" />
          </mesh>
        </>
      )}

      {/* Heading arrow — direction indicator at front */}
      <mesh position={[0, 2.2, 8.0]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.9, 2.5, 10]} />
        <primitive object={glowMat} attach="material" />
      </mesh>

      {/* Status beacon on cab roof */}
      {!lowPerfMode && (
        <mesh position={[1.2, 6.2, 5.0]}>
          <sphereGeometry args={[selected ? 1.1 : 0.8, 12, 12]} />
          <meshStandardMaterial
            color={statusColor}
            emissive={statusColor}
            emissiveIntensity={selected ? 1.4 : 0.9}
            transparent opacity={0.92}
          />
        </mesh>
      )}

    </group>
  );
});

export default EquipmentMarker3D;
