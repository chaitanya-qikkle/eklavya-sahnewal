const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LNG = (lat) => 111_320 * Math.cos((lat * Math.PI) / 180);

// Manual calibration: the yard's true-world orientation isn't derivable from
// lat/lng alone (GPS doesn't encode "which way the fence lines run"), so this
// constant rotates the projected scene (around the yard centre) to visually
// align live slot/equipment positions with the DXF boundary/road drawing.
// Positive = clockwise, in degrees. Calibrated by eye in the Yard Builder
// tool (/dashboard/yard-builder) against the Sahnewal DXF outline.
export const YARD_ROTATION_DEG = 0.9;

// Manual calibration: metres to shift the whole projected scene after
// rotation, so slots line up with the DXF drawing left/right (X) and
// up/down (Z, i.e. north/south on the top-down view). Same calibration pass
// as YARD_ROTATION_DEG above.
export const YARD_OFFSET_X = 25.0;
export const YARD_OFFSET_Z = 63.0;

function rotateXZ(x, z, degrees) {
  if (!degrees) return { x, z };
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: x * cos - z * sin,
    z: x * sin + z * cos,
  };
}

export function createYardProjection(bounds, rotationDeg = YARD_ROTATION_DEG, offsetX = YARD_OFFSET_X, offsetZ = YARD_OFFSET_Z) {
  if (!bounds) return null;
  const cLat = (bounds.minLat + bounds.maxLat) / 2;
  const cLng = (bounds.minLng + bounds.maxLng) / 2;
  const mLng = M_PER_DEG_LNG(cLat);
  const toXZ = (lat, lng) => {
    const x = (lng - cLng) * mLng;
    const z = -(lat - cLat) * M_PER_DEG_LAT;
    const rotated = rotateXZ(x, z, rotationDeg);
    return { x: rotated.x + offsetX, z: rotated.z + offsetZ };
  };
  const yardW = (bounds.maxLng - bounds.minLng) * mLng;
  const yardD = (bounds.maxLat - bounds.minLat) * M_PER_DEG_LAT;
  return { toXZ, yardW, yardD, cLat, cLng, mLng, bounds, rotationDeg, offsetX, offsetZ };
}

export function mapLatLngToYard(lat, lng, projection, clampToYard = false) {
  if (!projection || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const { bounds } = projection;
  const outOfBounds =
    lat < bounds.minLat ||
    lat > bounds.maxLat ||
    lng < bounds.minLng ||
    lng > bounds.maxLng;

  // When clampToYard is true (GPS fallback for navigation), clamp to yard boundary
  // so the path still renders even when GPS drifts slightly outside the geofence.
  const clampedLat = clampToYard ? Math.max(bounds.minLat, Math.min(bounds.maxLat, lat)) : lat;
  const clampedLng = clampToYard ? Math.max(bounds.minLng, Math.min(bounds.maxLng, lng)) : lng;
  const { x, z } = projection.toXZ(clampedLat, clampedLng);
  return { x, z, outOfBounds };
}
