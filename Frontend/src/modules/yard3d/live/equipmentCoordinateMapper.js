const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LNG = (lat) => 111_320 * Math.cos((lat * Math.PI) / 180);

export function createYardProjection(bounds) {
  if (!bounds) return null;
  const cLat = (bounds.minLat + bounds.maxLat) / 2;
  const cLng = (bounds.minLng + bounds.maxLng) / 2;
  const mLng = M_PER_DEG_LNG(cLat);
  const toXZ = (lat, lng) => ({
    x: (lng - cLng) * mLng,
    z: -(lat - cLat) * M_PER_DEG_LAT,
  });
  const yardW = (bounds.maxLng - bounds.minLng) * mLng;
  const yardD = (bounds.maxLat - bounds.minLat) * M_PER_DEG_LAT;
  return { toXZ, yardW, yardD, cLat, cLng, mLng, bounds };
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
