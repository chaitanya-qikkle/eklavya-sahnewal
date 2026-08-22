import React, { useState, useRef, useCallback } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

const ROAD_WIDTH = 8; // meters — typical yard road width

// Converts scene XZ → lat/lng using projection (reverse of toXZ)
function sceneToLatLng(x, z, projection) {
  if (!projection) return null;
  const lat = projection.cLat - z / 111320;
  const lng = projection.cLng + x / projection.mLng;
  return { lat, lng };
}

// ── 3D part — renders inside Canvas ──────────────────────────────────────────
export function RoadPainterCanvas({ active, projection, points, onAddPoint }) {
  const { camera, raycaster, gl } = useThree();
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const hitPoint = useRef(new THREE.Vector3());

  const handleClick = useCallback((e) => {
    if (!active) return;
    e.stopPropagation();
    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(groundPlane.current, hitPoint.current)) {
      onAddPoint({ x: hitPoint.current.x, z: hitPoint.current.z });
    }
  }, [active, camera, raycaster, gl, onAddPoint]);

  if (!active && points.length === 0) return null;

  return (
    <group>
      {/* Invisible ground hit plane */}
      {active && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.05, 0]}
          onClick={handleClick}
        >
          <planeGeometry args={[5000, 5000]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}

      {/* Draw road segments between consecutive points */}
      {points.map((pt, i) => {
        if (i === 0) return null;
        const prev = points[i - 1];
        const dx = pt.x - prev.x;
        const dz = pt.z - prev.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        const cx = (pt.x + prev.x) / 2;
        const cz = (pt.z + prev.z) / 2;
        const angle = Math.atan2(dx, dz);
        return (
          <mesh key={i} position={[cx, 0.06, cz]} rotation={[0, angle, 0]}>
            <boxGeometry args={[ROAD_WIDTH, 0.08, len]} />
            <meshBasicMaterial color="#facc15" transparent opacity={0.45} />
          </mesh>
        );
      })}

      {/* Point dots */}
      {points.map((pt, i) => (
        <mesh key={`dot-${i}`} position={[pt.x, 0.15, pt.z]}>
          <sphereGeometry args={[0.8, 8, 8]} />
          <meshBasicMaterial color={i === 0 ? "#22c55e" : "#f97316"} />
        </mesh>
      ))}

      {/* Segment lines */}
      {points.length >= 2 && (() => {
        const positions = new Float32Array(points.length * 3);
        points.forEach((p, i) => {
          positions[i * 3]     = p.x;
          positions[i * 3 + 1] = 0.2;
          positions[i * 3 + 2] = p.z;
        });
        return (
          <line>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" array={positions} count={points.length} itemSize={3} />
            </bufferGeometry>
            <lineBasicMaterial color="#facc15" linewidth={2} />
          </line>
        );
      })()}
    </group>
  );
}

// ── UI Panel — renders outside Canvas ────────────────────────────────────────
export function RoadPainterUI({ active, setActive, points, setPoints, projection }) {
  const [saved, setSaved] = useState(false);

  const handleUndo = () => setPoints((p) => p.slice(0, -1));
  const handleClear = () => { setPoints([]); setSaved(false); };

  const handleExport = () => {
    // Convert scene XZ points → lat/lng for GPS snapping
    const latLngPoints = points.map((p) => sceneToLatLng(p.x, p.z, projection));
    const segments = [];
    for (let i = 1; i < latLngPoints.length; i++) {
      segments.push({ from: latLngPoints[i - 1], to: latLngPoints[i] });
    }
    const json = JSON.stringify({ points: latLngPoints, segments }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "yard_road_network.json";
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  };

  const handleCopyScene = () => {
    const json = JSON.stringify({ scenePoints: points, segments: points.map((p, i) => i > 0 ? { from: points[i-1], to: p } : null).filter(Boolean) }, null, 2);
    navigator.clipboard.writeText(json);
    setSaved(true);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-gray-900/95 border border-yellow-400/40 rounded-2xl px-4 py-3 shadow-2xl backdrop-blur">
      <span className="text-yellow-400 font-bold text-sm mr-2">
        🛣 Road Painter
      </span>
      <span className="text-white/60 text-xs mr-3">
        {points.length} points
      </span>

      <button
        onClick={() => setActive((v) => !v)}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
          active
            ? "bg-yellow-400 text-gray-900"
            : "bg-gray-700 text-white hover:bg-gray-600"
        }`}
      >
        {active ? "● Drawing" : "▶ Draw"}
      </button>

      <button
        onClick={handleUndo}
        disabled={points.length === 0}
        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-30"
      >
        ↩ Undo
      </button>

      <button
        onClick={handleClear}
        disabled={points.length === 0}
        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-900/60 text-red-300 hover:bg-red-800/60 disabled:opacity-30"
      >
        ✕ Clear
      </button>

      <button
        onClick={handleExport}
        disabled={points.length < 2}
        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-700 text-white hover:bg-green-600 disabled:opacity-30"
      >
        ↓ Export JSON
      </button>

      <button
        onClick={handleCopyScene}
        disabled={points.length < 2}
        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-700 text-white hover:bg-blue-600 disabled:opacity-30"
      >
        📋 Copy
      </button>

      {saved && (
        <span className="text-green-400 text-xs font-bold animate-pulse">✓ Saved!</span>
      )}
    </div>
  );
}
