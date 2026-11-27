import { toMapFeatures } from './vectorMap.mjs';
const MAX_LAT = 85.05112878;
export const wrapLongitude = lon => ((lon + 180) % 360 + 360) % 360 - 180;
/** @param {{lon?:number,lat?:number,zoom?:number}} [view] */
export function normalizeMapView(view = {}) {
  return { lon: Number.isFinite(view.lon) ? wrapLongitude(view.lon) : 0,
    lat: Number.isFinite(view.lat) ? Math.max(-MAX_LAT, Math.min(MAX_LAT, view.lat)) : 18,
    zoom: Number.isFinite(view.zoom) ? Math.max(-2, Math.min(12, view.zoom)) : 0 };
}
function worldPoint(lon, lat, zoom) {
  const world = 512 * 2 ** zoom, phi = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI / 180;
  return { x: (lon + 180) / 360 * world, y: (0.5 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / (2 * Math.PI)) * world, world };
}
function inverseWorld(x, y, zoom) {
  const world = 512 * 2 ** zoom;
  return { lon: wrapLongitude(x / world * 360 - 180), lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * y / world))) * 180 / Math.PI };
}
export function projectMapPoint(lon, lat, view, width, height) {
  if (![lon, lat, width, height].every(Number.isFinite) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return null;
  const v = normalizeMapView(view), p = worldPoint(lon, lat, v.zoom), c = worldPoint(v.lon, v.lat, v.zoom);
  const dx = ((p.x - c.x + p.world / 2) % p.world + p.world) % p.world - p.world / 2;
  return { x: width / 2 + dx, y: height / 2 + p.y - c.y };
}
export function invertMapPoint(x, y, view, width, height) {
  const v = normalizeMapView(view), c = worldPoint(v.lon, v.lat, v.zoom);
  return inverseWorld(c.x + x - width / 2, c.y + y - height / 2, v.zoom);
}
export function panMapView(view, dx, dy) {
  const v = normalizeMapView(view), c = worldPoint(v.lon, v.lat, v.zoom), next = inverseWorld(c.x - dx, c.y - dy, v.zoom);
  return normalizeMapView({ ...next, zoom: v.zoom });
}
export function zoomMapView(view, delta, x, y, width, height) {
  const v = normalizeMapView(view), zoom = normalizeMapView({ ...v, zoom: v.zoom + delta }).zoom;
  const anchor = invertMapPoint(x, y, v, width, height), p = worldPoint(anchor.lon, anchor.lat, zoom);
  return normalizeMapView({ ...inverseWorld(p.x - x + width / 2, p.y - y + height / 2, zoom), zoom });
}
export function globalMapView(width = 700, height = 520) {
  return normalizeMapView({ lon: 0, lat: 14, zoom: Math.log2(Math.max(0.25, Math.min(width, height) / 540)) });
}
export function watchZoneMapView(zone, radiusKm, width = 700, height = 520) {
  const lat = Number.isFinite(zone?.lat) ? zone.lat : 0;
  const radius = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 250;
  const zoom = Math.log2(Math.max(0.01, Math.min(width, height) * 40075 * Math.cos(lat * Math.PI / 180) / (512 * radius * 2.8)));
  return normalizeMapView({ lon: zone?.lon, lat, zoom });
}
/** A provider-independent screen grid; every accepted visible signal is accounted for. */
export function clusterProjectedSignals(signals, project, width, height, { selectedId = '', cellSize = 38 } = {}) {
  const features = toMapFeatures(signals, selectedId).features, cells = new Map();
  let visibleCount = 0;
  for (const feature of features) {
    const [lon, lat] = feature.geometry.coordinates, p = project(lon, lat);
    if (!p || p.x < -16 || p.y < -16 || p.x > width + 16 || p.y > height + 16) continue;
    visibleCount++;
    const id = feature.properties.id;
    const key = id === selectedId ? `selected:${id}` : `${Math.floor(p.x / cellSize)},${Math.floor(p.y / cellSize)}`;
    let cell = cells.get(key);
    if (!cell) { cell = { x: 0, y: 0, count: 0, ids: [], id, lon, lat, type: feature.properties.type, selected: id === selectedId }; cells.set(key, cell); }
    cell.x += p.x; cell.y += p.y; cell.count++; cell.ids.push(id);
  }
  const markers = [...cells.values()].map(cell => ({ ...cell, x: cell.x / cell.count, y: cell.y / cell.count,
    radius: cell.selected ? 9 : cell.count > 1 ? Math.min(19, 9 + Math.log2(cell.count + 1) * 1.3) : 4 }));
  markers.sort((a, b) => Number(a.selected) - Number(b.selected));
  return { markers, eligibleCount: features.length, visibleCount };
}
export function clusterMapSignals(signals, view, width, height, options = {}) {
  return clusterProjectedSignals(signals, (lon, lat) => projectMapPoint(lon, lat, view, width, height), width, height, options);
}
export function mapKmPerPixel(lat, zoom) { return 40075 * Math.cos(lat * Math.PI / 180) / (512 * 2 ** zoom); }
