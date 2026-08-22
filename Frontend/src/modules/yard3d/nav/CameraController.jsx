// Third-person / First-person / Free camera modes with smooth easing
// between modes. While in third/first the OrbitControls are disabled
// (Free mode hands control back to the user's OrbitControls instance).

import React, { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useNavigation } from "./navStore";

const TPS_OFFSET = new THREE.Vector3(0, 4.5, -7.5);   // behind & above
const FPS_OFFSET = new THREE.Vector3(0, 1.74, 0.18);  // head height, slight fwd
const LOOK_AHEAD = 4.0;
// Collision hysteresis: release only when camera is this much further than
// the point it was pulled in to, preventing ping-pong shaking near containers.
const COLLISION_RELEASE_MARGIN = 1.2;

const tmpV1 = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpV3 = new THREE.Vector3();

export default function CameraController({ controlsRef, blockBBoxes }) {
  const { camera } = useThree();
  const mode = useNavigation(s => s.cameraMode);
  const posRef    = useNavigation(s => s.posRef);
  const facingRef = useNavigation(s => s.facingRef);
  const speedRef  = useNavigation(s => s.speedRef);
  const walking   = useNavigation(s => s.walking);

  const bobT = useRef(0);
  const lastMode = useRef(mode);
  const transitionT = useRef(1.0); // 0..1, 1 = settled

  // Snap once whenever mode entry happens, so we drop the user behind the
  // character at the right distance — afterwards they can orbit freely.
  const initOnEnter = useRef(false);

  // Collision hysteresis: track the last clamped distance so we only release
  // the camera outward once it would be COLLISION_RELEASE_MARGIN beyond the
  // clamp point, preventing shaking oscillation near container walls.
  const collisionClampDist = useRef(null); // null = not currently clamped

  useEffect(() => {
    if (mode !== lastMode.current) {
      transitionT.current = 0;
      lastMode.current = mode;
      initOnEnter.current = true;
    }
    if (controlsRef?.current) {
      // Both Free and Third-person allow user input. First-person locks
      // the camera to the head so OrbitControls is disabled.
      controlsRef.current.enabled = mode !== "first";
    }
  }, [mode, controlsRef]);

  useFrame((_, dt) => {
    if (mode === "free") return;

    transitionT.current = Math.min(1, transitionT.current + dt * 1.8);
    const ease = transitionT.current * transitionT.current * (3 - 2 * transitionT.current);
    // Frame-rate independent damping. Higher = snappier follow.
    // Lower base rate during transition for cinematic ease-in.
    const dampRate = THREE.MathUtils.lerp(2.0, 7.0, ease);
    const followLerp = 1 - Math.exp(-dampRate * dt);

    const fX = Math.sin(facingRef.current), fZ = Math.cos(facingRef.current);
    const p = posRef.current;

    if (mode === "third") {
      // On first frame of TPS, snap camera behind the character. After
      // that, only the LOOK-AT target follows — so the user can freely
      // orbit / pan / zoom with OrbitControls while the character walks.
      tmpV2.set(p.x, p.y + 1.6, p.z);
      if (initOnEnter.current) {
        const cx = p.x - fX * 8.5;
        const cz = p.z - fZ * 8.5;
        const cy = p.y + 4.5;
        camera.position.set(cx, cy, cz);
        if (controlsRef?.current) {
          controlsRef.current.target.copy(tmpV2);
          controlsRef.current.update();
        }
        initOnEnter.current = false;
        return;
      }

      // Follow: keep the user's current camera offset, just glide the
      // pivot/target to the character so the view trails them naturally.
      if (controlsRef?.current) {
        const ctrl = controlsRef.current;
        tmpV3.copy(camera.position).sub(ctrl.target); // user-chosen offset
        ctrl.target.lerp(tmpV2, followLerp);
        camera.position.copy(ctrl.target).add(tmpV3);

        // Soft collision: if the camera ray to the head crosses a container
        // stack, pull camera in along that ray.
        // Hysteresis prevents shaking: once clamped, only release when the
        // natural camera distance exceeds the clamp point by RELEASE_MARGIN.
        if (blockBBoxes?.length) {
          tmpV1.subVectors(camera.position, ctrl.target);
          const dist = tmpV1.length();
          tmpV1.normalize();

          let hitDist = null;
          for (let step = 0.1; step < 1; step += 0.1) {
            const sx = ctrl.target.x + tmpV1.x * dist * step;
            const sz = ctrl.target.z + tmpV1.z * dist * step;
            if (intersectsAny(sx, sz, blockBBoxes, 0.8)) {
              hitDist = dist * step;
              break;
            }
          }

          if (hitDist !== null) {
            // Currently colliding — clamp and record the clamp distance
            collisionClampDist.current = hitDist;
            camera.position.copy(ctrl.target).addScaledVector(tmpV1, hitDist);
          } else if (collisionClampDist.current !== null) {
            // No collision this frame, but we were clamped recently.
            // Only release the clamp once the natural camera has moved
            // clearly beyond where it was pulled in.
            if (dist > collisionClampDist.current + COLLISION_RELEASE_MARGIN) {
              collisionClampDist.current = null; // fully released
            } else {
              // Still within hysteresis band — hold at the last clamp distance
              camera.position.copy(ctrl.target).addScaledVector(tmpV1, collisionClampDist.current);
            }
          }
        } else {
          collisionClampDist.current = null;
        }
        ctrl.update();
      }
      return;
    }

    if (mode === "first") {
      // Head-bob — only while moving
      const speed = speedRef.current;
      const bobAmp = Math.min(speed / 6, 1) * 0.06;
      const bobFreq = 6 + speed * 0.8;
      if (walking && speed > 0.1) {
        bobT.current += dt * bobFreq;
      } else {
        // Smoothly decay any leftover bob phase to neutral
        bobT.current += dt * 1.2;
        bobAmp && (bobT.current = bobT.current); // no-op
      }
      const bobY = Math.abs(Math.sin(bobT.current)) * bobAmp;
      const sway = Math.sin(bobT.current * 0.5) * bobAmp * 0.6;

      tmpV1.set(p.x + fX * 0.18 - fZ * sway, p.y + 1.74 + bobY, p.z + fZ * 0.18 + fX * sway);
      camera.position.lerp(tmpV1, followLerp);
      tmpV2.set(p.x + fX * LOOK_AHEAD, p.y + 1.6, p.z + fZ * LOOK_AHEAD);
      if (controlsRef?.current) {
        controlsRef.current.target.lerp(tmpV2, 0.4);
        controlsRef.current.update();
      } else {
        camera.lookAt(tmpV2);
      }
    }
  });

  return null;
}

function intersectsAny(x, z, bboxes, pad) {
  for (let i = 0; i < bboxes.length; i++) {
    const b = bboxes[i];
    if (x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad) return true;
  }
  return false;
}
