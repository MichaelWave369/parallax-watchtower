// Portable, browser-generated evidence export for the Φ public-signal ecosystem.
// Version 1 intentionally contains no saved watch zones, browser location, query history,
// private notes, credentials or local storage. It is NOT a live API or verification service.
export const FIELD_PACK_SCHEMA = "phi.fieldpack.v1";
export const FIELD_PACK_MAX_RECORDS = 250;
export const FIELD_PACK_TYPES = Object.freeze([
  "earthquake", "wildfire", "satellite", "orbit", "space_weather", "news", "market"
]);
const types = new Set(FIELD_PACK_TYPES);
const confidences = new Set(["verified_official", "reported", "approximate", "unknown"]);
const statuses = new Set(["fresh", "stale", "down", "demo"]);
const detailKeys = new Set([
  "usgsId", "magType", "kp", "noradId", "altitudeKm", "velocityKmH",
  "elementEpoch", "catalogFetchedAt", "propagatedAt", "dataKind",
  "locationIsPerimeter", "observationAgeSeconds", "group", "symbol",
  "priceUsd", "change24hPct"
]);

function short(value, limit = 300) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}
function time(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
function httpsReceipt(raw) {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || !u.hostname || u.username || u.password ||
        u.hostname === "localhost" || u.hostname.endsWith(".local")) return null;
    return u.toString();
  } catch { return null; }
}
function publicLocation(record) {
  const lat = record.lat, lon = record.lon;
  if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon) ||
      lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  const kind = record.type === "orbit" ? "model-predicted-subpoint"
    : record.type === "satellite" ? "sampled-subpoint"
    : record.type === "wildfire" ? "curated-point-not-perimeter"
    : record.type === "news" ? "approximate-region"
    : "published-coordinate";
  return { lat, lon, kind };
}
function safeFacts(raw) {
  const out = {};
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!detailKeys.has(key)) continue;
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "string" && value.length <= 300) out[key] = value;
  }
  return out;
}
function normalizeRecord(record, generatedAtMs) {
  if (!record || record.privacyClass !== "public" ||
      !types.has(record.type) || !confidences.has(record.confidence) ||
      String(record.id ?? "").startsWith("fallback-") ||
      /fallback|demo/i.test(String(record.source ?? ""))) return null;
  const id = short(record.id, 180);
  const source = short(record.source, 140);
  const title = short(record.title, 240);
  const observedAt = time(record.timestamp);
  const evidenceUrl = httpsReceipt(record.sourceUrl);
  if (!id || !source || !title || !observedAt || !evidenceUrl ||
      Date.parse(observedAt) > generatedAtMs + 5 * 60 * 1000) return null;
  const location = publicLocation(record);
  return {
    id, type: record.type, title, summary: short(record.summary, 360) || null,
    source, observedAt, confidence: record.confidence,
    confidenceNotes: short(record.confidenceNotes, 360) || null,
    location, evidenceUrl, facts: safeFacts(record.facts)
  };
}

export function makeFieldPack(records, sourceLedger = [], generatedAt = new Date().toISOString()) {
  const generated = time(generatedAt);
  if (!generated || !Array.isArray(records) || !Array.isArray(sourceLedger)) throw new Error("Invalid field pack inputs");
  const seen = new Set();
  const accepted = [];
  for (const raw of records) {
    if (accepted.length >= FIELD_PACK_MAX_RECORDS) break;
    const record = normalizeRecord(raw, Date.parse(generated));
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    accepted.push(record);
  }
  accepted.sort((a, b) => b.observedAt.localeCompare(a.observedAt) || a.id.localeCompare(b.id));
  const health = sourceLedger.slice(0, 32).flatMap((entry) => {
    const name = short(entry?.name, 140);
    if (!name || !statuses.has(entry?.status)) return [];
    return [{ source: name, status: entry.status, checkedAt: time(entry.lastChecked) }];
  });
  return {
    schema: FIELD_PACK_SCHEMA,
    producer: {
      id: "watchtower-live",
      label: "WATCHTOWER LIVE",
      url: "https://michaelwave369.github.io/parallax-watchtower/"
    },
    generatedAt: generated,
    purpose: "public-signal-evidence-export",
    scope: {
      records: "current visible public signals only",
      watchZoneCoordinatesIncluded: false,
      browserLocationIncluded: false,
      queryHistoryIncluded: false,
      realTimeAvailabilityNotGuaranteed: true
    },
    count: accepted.length,
    sources: health,
    records: accepted
  };
}

export function inspectFieldPack(value) {
  if (!value || value.schema !== FIELD_PACK_SCHEMA ||
      typeof value.generatedAt !== "string" || !time(value.generatedAt) ||
      !Array.isArray(value.records) || value.records.length > FIELD_PACK_MAX_RECORDS ||
      value.count !== value.records.length ||
      value.scope?.browserLocationIncluded !== false ||
      value.scope?.watchZoneCoordinatesIncluded !== false) return { valid: false, count: 0 };
  const seen = new Set();
  for (const r of value.records) {
    if (!r || typeof r.id !== "string" || !types.has(r.type) ||
        !confidences.has(r.confidence) || !time(r.observedAt) ||
        !httpsReceipt(r.evidenceUrl) ||
        !r.title || !r.source || seen.has(r.id)) return { valid: false, count: 0 };
    if (r.location && (typeof r.location.lat !== "number" || typeof r.location.lon !== "number" ||
      !Number.isFinite(r.location.lat) || !Number.isFinite(r.location.lon) ||
      Math.abs(r.location.lat) > 90 || Math.abs(r.location.lon) > 180)) return { valid: false, count: 0 };
    seen.add(r.id);
  }
  return { valid: true, count: value.records.length };
}
