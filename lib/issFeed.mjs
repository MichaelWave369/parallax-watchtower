// Public ISS position samples, not orbital predictions or continuous tracks.
export const ISS_POSITION_URL = "https://api.wheretheiss.at/v1/satellites/25544";
export const ISS_MAX_AGE_MS = 10 * 60 * 1000;
const valid = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
export function normalizeIssPosition(payload, nowMs = Date.now()) {
  if (Number(payload?.id) !== 25544) throw new Error("Expected ISS NORAD 25544 position");
  if (!valid(payload?.latitude, -90, 90) || !valid(payload?.longitude, -180, 180))
    throw new Error("ISS response has invalid coordinates");
  if (!valid(payload?.timestamp, 1, 4102444800)) throw new Error("ISS response has invalid observation time");
  const observedMs = payload.timestamp * 1000;
  if (!Number.isFinite(nowMs) || observedMs < nowMs - ISS_MAX_AGE_MS || observedMs > nowMs + 2 * 60 * 1000)
    throw new Error("ISS observation is stale or future-dated");
  if (payload?.units !== "kilometers") throw new Error("ISS position units are unknown");
  return [{
    id: "wtia-iss-25544",
    type: "satellite",
    title: "International Space Station (ISS)",
    summary: "Sampled ISS ground-track location; the marker shows the sub-satellite point, not an observer's view or live video.",
    source: "Where the ISS at? public position API",
    sourceUrl: "https://wheretheiss.at/",
    timestamp: new Date(observedMs).toISOString(),
    lat: payload.latitude,
    lon: payload.longitude,
    locationLabel: "Sub-satellite position projected onto Earth's surface",
    confidence: "reported",
    confidenceNotes: "Third-party published position, not independently verified. Samples refresh once per minute; not for safety-critical navigation.",
    privacyClass: "public",
    facts: {
      noradId: 25544,
      provider: "wheretheiss.at",
      altitudeKm: valid(payload?.altitude, 0, 10000) ? payload.altitude : null,
      velocityKmH: valid(payload?.velocity, 0, 100000) ? payload.velocity : null,
      visibility: typeof payload.visibility === "string" ? payload.visibility : null,
      observationAgeSeconds: Math.max(0, Math.round((nowMs - observedMs) / 1000)),
      sampledNotContinuous: "true"
    }
  }];
}
