// Movement brain: walks the character along a waypoint list with
// proper acceleration / deceleration, smooth turning, and corner
// look-ahead. Publishes pos / facing / walking state to the nav store
// so the camera, footsteps, and progress bar can read it.

import React, { useRef, useEffect, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useNavigation } from "./navStore";

// Smoother feel — slightly lower top speed, gentler accel curves and a
// faster turn rate so corner cuts no longer overshoot/oscillate.
const MAX_SPEED   = 4.6;   // m/s — comfortable walk pace
const ACCEL       = 6.0;   // m/s²
const DECEL       = 7.0;   // m/s²
const TURN_RATE   = 6.0;   // rad/s
const ARRIVE_RADIUS = 1.2; // metres
const LOOKAHEAD   = 3.5;   // metres — bigger look-ahead = smoother corners

export default function CharacterController({
  waypoints,           // [{x, z}]
  startPos,            // {x, z}
  routeKey,            // stable primitive string — drives the reset effect
  active,
  walking,
  onArrived,
}) {
  const posRef    = useNavigation(s => s.posRef);
  const facingRef = useNavigation(s => s.facingRef);
  const speedRef  = useNavigation(s => s.speedRef);
  const reportProgress = useNavigation(s => s.reportProgress);
  const setWalking = useNavigation(s => s.setWalking);
  const setArrived = useNavigation(s => s.setArrived);

  const wpIdx = useRef(0);
  const arrived = useRef(false);
  const distAccum = useRef(0);
  const totalDist = useRef(0);

  // Reset on new route. Keyed off a primitive routeKey so we DON'T reset
  // every parent render (which would teleport the character back to
  // start and produce the "halfway → restart" loop the user reported).
  useEffect(() => {
    if (!startPos || !waypoints.length) return;
    posRef.current.set(startPos.x, 1.0, startPos.z);
    speedRef.current = 0;
    wpIdx.current = 0;
    arrived.current = false;
    distAccum.current = 0;
    let t = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i], b = waypoints[i + 1];
      t += Math.hypot(b.x - a.x, b.z - a.z);
    }
    totalDist.current = t;
    facingRef.current = waypoints.length >= 2
      ? Math.atan2(waypoints[1].x - waypoints[0].x, waypoints[1].z - waypoints[0].z)
      : 0;
    setArrived(false);
    reportProgress(0, t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  useEffect(() => { setWalking(!!(walking && active)); }, [walking, active, setWalking]);

  const handleArrived = useCallback(() => {
    arrived.current = true;
    setArrived(true);
    setWalking(false);
    onArrived?.();
  }, [setArrived, setWalking, onArrived]);

  useFrame((_, dt) => {
    if (!active || arrived.current || waypoints.length < 2) {
      // Decelerate to a stop while idle / arrived
      if (speedRef.current > 0) {
        speedRef.current = Math.max(0, speedRef.current - DECEL * dt);
      }
      return;
    }
    if (!walking) {
      // Path is previewed but character holds position; keep speed at zero
      speedRef.current = Math.max(0, speedRef.current - DECEL * dt);
      return;
    }

    const cur = posRef.current;
    const wpI = wpIdx.current;
    if (wpI >= waypoints.length) { handleArrived(); return; }

    // Early arrival: if we are within ARRIVE_RADIUS of the FINAL waypoint
    // (regardless of which intermediate WP we're chasing), snap and stop.
    // Without this the deceleration ramp can pin us to ~0 m/s before
    // reaching the last WP, leaving the character stranded short of the
    // destination beacon.
    const finalWp = waypoints[waypoints.length - 1];
    const distToFinal = Math.hypot(finalWp.x - cur.x, finalWp.z - cur.z);
    if (distToFinal <= ARRIVE_RADIUS) {
      cur.x = finalWp.x; cur.z = finalWp.z;
      speedRef.current = 0;
      wpIdx.current = waypoints.length;
      handleArrived();
      return;
    }

    const wp = waypoints[wpI];
    const dx = wp.x - cur.x, dz = wp.z - cur.z;
    const distToWp = Math.hypot(dx, dz);

    // Distance to final waypoint for arrival braking
    let distRemaining = distToWp;
    for (let i = wpI; i < waypoints.length - 1; i++) {
      const a = waypoints[i], b = waypoints[i + 1];
      distRemaining += Math.hypot(b.x - a.x, b.z - a.z);
    }

    // Speed target: full speed unless approaching final destination.
    // Floor at 1.6 m/s while still > 0.3 m from the finish so we actually
    // reach the goal instead of decelerating to zero mid-air.
    const brakingDist = (speedRef.current * speedRef.current) / (2 * DECEL);
    let targetSpeed = distRemaining <= brakingDist + 0.5 ? 1.6 : MAX_SPEED;
    if (distRemaining < 0.3) targetSpeed = 0;
    if (targetSpeed > speedRef.current) {
      speedRef.current = Math.min(targetSpeed, speedRef.current + ACCEL * dt);
    } else {
      speedRef.current = Math.max(targetSpeed, speedRef.current - DECEL * dt);
    }

    // Facing: aim slightly past the current waypoint for smoother corner cuts
    let aimX = wp.x, aimZ = wp.z;
    if (wpI + 1 < waypoints.length && distToWp < LOOKAHEAD) {
      const next = waypoints[wpI + 1];
      const blend = 1 - distToWp / LOOKAHEAD;
      aimX = wp.x + (next.x - wp.x) * blend;
      aimZ = wp.z + (next.z - wp.z) * blend;
    }
    const wantAngle = Math.atan2(aimX - cur.x, aimZ - cur.z);
    let delta = wantAngle - facingRef.current;
    while (delta >  Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    facingRef.current += Math.sign(delta) * Math.min(Math.abs(delta), TURN_RATE * dt);

    // Move along facing direction. Blend a little of the WP-target
    // direction into the actual translation so we don't drift wide on
    // sharp corners while the facing is still rotating to catch up.
    const step = speedRef.current * dt;
    if (step > 0) {
      const sx = Math.sin(facingRef.current), sz = Math.cos(facingRef.current);
      const wpDirLen = Math.hypot(dx, dz) || 1;
      const wx = dx / wpDirLen, wz = dz / wpDirLen;
      const blend = 0.65; // 0 = pure facing, 1 = pure WP-direction
      const mx = sx * (1 - blend) + wx * blend;
      const mz = sz * (1 - blend) + wz * blend;
      const mLen = Math.hypot(mx, mz) || 1;
      cur.x += (mx / mLen) * step;
      cur.z += (mz / mLen) * step;
      distAccum.current += step;
    }

    // Advance waypoint when close enough
    if (Math.hypot(wp.x - cur.x, wp.z - cur.z) <= ARRIVE_RADIUS) {
      wpIdx.current = wpI + 1;
      if (wpIdx.current >= waypoints.length) { handleArrived(); }
    }

    if (totalDist.current > 0) {
      reportProgress(Math.min(1, distAccum.current / totalDist.current), totalDist.current);
    }
  });

  return null;
}
