// WATCHTOWER LIVE public-source adapters. No private-person or camera discovery.
export const EONET_WILDFIRES_URL = "https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&limit=100";
export const NOAA_KP_URL = "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json";

const validTime = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const validCoord = (value, limit) => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;

export function normalizeEonetWildfires(payload) {
  if (!Array.isArray(payload?.events)) throw new Error("NASA EONET response is missing events");
  return payload.events.slice(0, 100).flatMap((event) => {
    if (typeof event?.id !== "string" || !event.id || event.closed != null) return [];
    const geometries = Array.isArray(event.geometry) ? event.geometry.filter((g) => validTime(g?.date)) : [];
    if (!geometries.length) return [];
    const latest = geometries.reduce((best, item) => Date.parse(item.date) > Date.parse(best.date) ? item : best);
    // EONET may report polygons. Never invent a centroid or describe a point as a fire perimeter.
    const points = geometries.filter((g) => g.type === "Point" && Array.isArray(g.coordinates)
      && validCoord(g.coordinates[0], 180) && validCoord(g.coordinates[1], 90));
    const latestPoint = points.length ? points.reduce((best, item) => Date.parse(item.date) > Date.parse(best.date) ? item : best) : null;
    const title = typeof event.title === "string" && event.title.trim() ? event.title.trim() : "Curated wildfire event";
    return [{
      id: `eonet-${event.id}`,
      type: "wildfire",
      title,
      summary: typeof event.description === "string" ? event.description : "Open wildfire record in NASA EONET.",
      source: "NASA EONET wildfire catalog",
      sourceUrl: `https://eonet.gsfc.nasa.gov/api/v3/events/${encodeURIComponent(event.id)}`,
      timestamp: new Date(latest.date).toISOString(),
      ...(latestPoint ? { lat: latestPoint.coordinates[1], lon: latestPoint.coordinates[0] } : {}),
      locationLabel: latestPoint ? "Curated event location; NOT a fire boundary" : "No point coordinates published",
      confidence: "reported",
      confidenceNotes: "NASA-curated open-event record; may be delayed or incomplete. Not an active-fire perimeter, evacuation order, or emergency alert.",
      privacyClass: "public",
      facts: { eonetId: event.id, openInCatalog: "yes", latestGeometryType: latest.type ?? "unknown", locationIsPerimeter: "no" }
    }];
  });
}

export function normalizeNoaaKp(payload) {
  if (!Array.isArray(payload)) throw new Error("NOAA Kp response is not a list");
  const observations = payload.map((entry) => {
    const rawKp = entry?.kp_index ?? entry?.estimated_kp ?? entry?.kp;
    const kp = typeof rawKp === "number" ? rawKp : typeof rawKp === "string" && rawKp.trim() ? Number(rawKp) : NaN;
    return { entry, kp };
  }).filter(({ entry, kp }) => validTime(entry?.time_tag) && Number.isFinite(kp) && kp >= 0 && kp <= 9);
  if (!observations.length) return [];
  const latest = observations.reduce((best, item) => Date.parse(item.entry.time_tag) > Date.parse(best.entry.time_tag) ? item : best);
  return [{
    id: `noaa-kp-${new Date(latest.entry.time_tag).toISOString()}`,
    type: "space_weather",
    title: `Planetary Kp ${latest.kp.toFixed(1)}`,
    summary: "Global geomagnetic activity index; not a regional event or a prediction.",
    source: "NOAA SWPC planetary Kp",
    sourceUrl: NOAA_KP_URL,
    timestamp: new Date(latest.entry.time_tag).toISOString(),
    locationLabel: "Planetary measurement; intentionally not mapped",
    confidence: "verified_official",
    confidenceNotes: "Official NOAA observation/estimate. Subject to revisions; feed age shown separately.",
    privacyClass: "public",
    facts: { kp: latest.kp, measurement: "planetary Kp", geography: "global", severity: latest.kp >= 5 ? "storm-level index" : "below storm-level index" }
  }];
}
