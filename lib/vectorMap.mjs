// Pure, platform-neutral GeoJSON adapter for Watchtower's clustered vector map.
// No private locations, demo placeholders or unsafe coordinates become map features.
export const OPENFREE_MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
export const MAX_VECTOR_FEATURES = 5000;
const allowed = new Set(["earthquake", "wildfire", "satellite", "orbit", "news"]);
const label = (v, n=160) => typeof v === "string" ? v.slice(0,n) : "";

export function toMapFeatures(signals = [], selectedId = "") {
  if (!Array.isArray(signals)) return { type: "FeatureCollection", features: [] };
  const seen = new Set();
  const features = [];
  for (const item of signals) {
    if (features.length >= MAX_VECTOR_FEATURES) break;
    if (!item || !allowed.has(item.type) || typeof item.id !== "string" || !item.id ||
        item.privacyClass !== "public" ||
        item.id.startsWith("fallback-") || /fallback|demo/i.test(String(item.source || ""))) continue;
    if (seen.has(item.id)) continue;
    const lat = item.lat, lon = item.lon;
    if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon) ||
        lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    const magnitude = typeof item.magnitude === "number" && Number.isFinite(item.magnitude) ?
      Math.max(0, Math.min(10, item.magnitude)) : 1;
    const coordinateKind = item.type === "orbit" ? "SGP4-predicted-subpoint" :
      item.type === "satellite" ? "sampled-subpoint" :
      item.type === "wildfire" ? "catalog-event-point-not-perimeter" :
      item.type === "news" ? "approximate-news-region" : "reported-epicenter";
    seen.add(item.id);
    features.push({
      type: "Feature",
      id: features.length + 1,
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        id: item.id,
        type: item.type,
        title: label(item.title),
        magnitude,
        selected: item.id === selectedId ? 1 : 0,
        coordinateKind
      }
    });
  }
  return { type: "FeatureCollection", features };
}
