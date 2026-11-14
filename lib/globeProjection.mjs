// Orthographic Earth projection: normalized coordinates for the visible hemisphere.
export function orthographicPoint(lat, lon, centerLat, centerLon) {
  if (![lat, lon, centerLat, centerLon].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  if (Math.abs(lat) > 90 || Math.abs(centerLat) > 90 || Math.abs(lon) > 180 || Math.abs(centerLon) > 180) return null;
  const rad = Math.PI / 180;
  const phi = lat * rad, phi0 = centerLat * rad, delta = (lon - centerLon) * rad;
  const toward = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(delta);
  if (toward < -0.0000001) return null;
  return {
    x: Math.cos(phi) * Math.sin(delta),
    y: -(Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(delta))
  };
}
