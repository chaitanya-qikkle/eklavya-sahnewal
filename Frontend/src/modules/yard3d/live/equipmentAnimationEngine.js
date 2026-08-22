import { mapLatLngToYard } from "./equipmentCoordinateMapper";

const DEFAULTS = {
  positionSmoothing: 6,
  headingSmoothing: 8,
  trailMinDist: 2.5,
  trailInterval: 0.8,
  maxTrailPoints: 26,
  staleMs: 8 * 60 * 1000,
};

const degToRad = (deg) => (deg * Math.PI) / 180;
const headingToRad = (deg) => Math.PI - degToRad(deg || 0);

function shortestAngle(from, to) {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function createEquipmentAnimationState(options = {}) {
  return {
    items: new Map(),
    options: { ...DEFAULTS, ...options },
  };
}

export function upsertEquipmentTargets(state, equipment, projection, nowMs = Date.now()) {
  if (!state || !projection) return;
  const seenIds = new Set();

  for (const eq of equipment || []) {
    const pos = mapLatLngToYard(eq.lat, eq.lon, projection);
    const id = String(eq.id ?? eq.deviceId ?? eq.name ?? "");
    if (!id) continue;

    let entry = state.items.get(id);
    if (!entry) {
      entry = {
        id,
        meta: eq,
        current: { x: 0, z: 0, heading: 0 },
        target: { x: 0, z: 0, heading: 0, speed: 0 },
        inited: false,
        hasFix: false,
        outOfBounds: false,
        seenAt: nowMs,
        trail: [],
        lastTrailAt: 0,
      };
      state.items.set(id, entry);
    }

    entry.meta = eq;
    entry.seenAt = nowMs;

    if (eq._adjustedX !== undefined && eq._adjustedZ !== undefined) {
      // Pre-adjusted scene coords (pushed outside block pads)
      entry.target.x = eq._adjustedX;
      entry.target.z = eq._adjustedZ;
      entry.target.heading = headingToRad(eq.heading);
      entry.target.speed = Number(eq.speed) || 0;
      entry.hasFix = true;
      entry.outOfBounds = false;
    } else if (pos) {
      entry.target.x = pos.x;
      entry.target.z = pos.z;
      entry.target.heading = headingToRad(eq.heading);
      entry.target.speed = Number(eq.speed) || 0;
      entry.hasFix = true;
      entry.outOfBounds = !!pos.outOfBounds;
    } else {
      entry.hasFix = false;
      entry.outOfBounds = true;
    }

    seenIds.add(id);
  }

  return seenIds;
}

export function stepEquipmentAnimation(state, dt, nowMs = Date.now()) {
  if (!state) return;
  const { options } = state;
  const posAlpha = 1 - Math.exp(-dt * options.positionSmoothing);
  const rotAlpha = 1 - Math.exp(-dt * options.headingSmoothing);

  for (const [id, entry] of state.items) {
    if (nowMs - entry.seenAt > options.staleMs) {
      state.items.delete(id);
      continue;
    }

    if (!entry.hasFix) continue;

    if (!entry.inited) {
      entry.current.x = entry.target.x;
      entry.current.z = entry.target.z;
      entry.current.heading = entry.target.heading;
      entry.inited = true;
    } else {
      entry.current.x += (entry.target.x - entry.current.x) * posAlpha;
      entry.current.z += (entry.target.z - entry.current.z) * posAlpha;
      const delta = shortestAngle(entry.current.heading, entry.target.heading);
      entry.current.heading += delta * rotAlpha;
    }

    const moved = Math.hypot(
      entry.current.x - entry.target.x,
      entry.current.z - entry.target.z
    );
    if (
      moved >= options.trailMinDist ||
      nowMs - entry.lastTrailAt >= options.trailInterval * 1000
    ) {
      entry.trail.push({ x: entry.current.x, z: entry.current.z, t: nowMs });
      entry.lastTrailAt = nowMs;
      if (entry.trail.length > options.maxTrailPoints) {
        entry.trail.shift();
      }
    }
  }
}
