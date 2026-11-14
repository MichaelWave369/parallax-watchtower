// Shared cached discovery contract. Data is NOT a verified incident, alert, or case.
// Official feed receipts are preserved; no geolocation or raw source rows are exported.
import { candidateFromSignal, isValidCandidate, receiptKey } from "./incidentDiscovery.mjs";
import { normalizeEonetWildfires } from "./publicFeeds.mjs";

export const DISCOVERY_CACHE_SCHEMA = "phi.watchtower.discovery-cache.v1";
export const USGS_DISCOVERY_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson";
export const EONET_DISCOVERY_URL = "https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&days=14&limit=100";
export const DISCOVERY_CACHE_MAX_AGE_MS = 36 * 60 * 60 * 1000;
const MAX_CANDIDATES = 40;
const MAX_QUAKES = 25;
const MAX_FIRES = 25;

const PROVIDERS = Object.freeze([
  { id: "usgs", name: "USGS earthquakes M4.5+", url: USGS_DISCOVERY_URL },
  { id: "eonet", name: "NASA EONET curated wildfires", url: EONET_DISCOVERY_URL }
]);

export function officialReceiptUrl(value, hostname) {
  try {
    if (typeof value !== "string") return null;
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === hostname &&
      !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

export function normalizeUsgsDiscovery(payload) {
  if (payload?.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
    throw new Error("USGS feed is not a GeoJSON FeatureCollection");
  }
  return payload.features.slice(0, 500).flatMap((item) => {
    const p = item?.properties;
    if (p?.type !== "earthquake" || !Number.isFinite(p?.mag) || p.mag < 4.5 ||
        typeof item?.id !== "string" || !item.id || !Number.isFinite(p.time) || !Number.isFinite(new Date(p.time).getTime())) return [];
    const sourceUrl = officialReceiptUrl(p.url, "earthquake.usgs.gov");
    if (!sourceUrl) return [];
    return [{
      id: "usgs-" + item.id,
      type: "earthquake",
      title: typeof p.title === "string" ? p.title : "USGS M" + p.mag + " earthquake",
      summary: typeof p.place === "string" ? p.place : "",
      timestamp: new Date(p.time).toISOString(),
      source: "USGS Earthquake Feed",
      sourceUrl,
      magnitude: p.mag,
      confidence: "verified_official",
      privacyClass: "public"
    }];
  });
}

export function makeDiscoveryCache({ usgsPayload, eonetPayload } = {}, nowMs = Date.now()) {
  const generatedAt = new Date(nowMs).toISOString();
  const collections = [];
  const sources = PROVIDERS.map((provider) => {
    const payload = provider.id === "usgs" ? usgsPayload : eonetPayload;
    if (payload === undefined || payload === null) {
      return { ...provider, status: "unavailable", accepted: 0, checkedAt: generatedAt };
    }
    try {
      const records = provider.id === "usgs"
        ? normalizeUsgsDiscovery(payload)
        : (() => {
            if (!Array.isArray(payload?.events)) throw new Error("EONET events missing");
            return normalizeEonetWildfires(payload).filter((record) =>
              officialReceiptUrl(record.sourceUrl, "eonet.gsfc.nasa.gov"));
          })();
      const entries = records
        .map((record) => candidateFromSignal(record, nowMs))
        .filter(Boolean)
        .sort((a, b) => Date.parse(b.sourceTimestamp) - Date.parse(a.sourceTimestamp))
        .slice(0, provider.id === "usgs" ? MAX_QUAKES : MAX_FIRES);
      collections.push(...entries);
      return { ...provider, status: "ok", accepted: entries.length, checkedAt: generatedAt };
    } catch {
      return { ...provider, status: "unavailable", accepted: 0, checkedAt: generatedAt };
    }
  });
  const seen = new Set();
  const candidates = collections
    .sort((a,b) => Date.parse(b.sourceTimestamp) - Date.parse(a.sourceTimestamp))
    .filter((candidate) => {
      const key = receiptKey(candidate.sourceUrl);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_CANDIDATES);
  const available = sources.filter((s) => s.status === "ok").length;
  return {
    schema: DISCOVERY_CACHE_SCHEMA, version: 1, generatedAt,
    status: available === 2 ? "ok" : available === 1 ? "partial" : "unavailable",
    sources, candidates,
    notice: "Scheduled, unreviewed public-source leads. Not verified incidents, live emergency alerts, wildfire perimeters, or automatically published Incident Room cases."
  };
}

export function readDiscoveryCache(value, nowMs = Date.now()) {
  const empty = { state: "unavailable", generatedAt: null, sources: [], candidates: [] };
  if (!value || typeof value !== "object" || value.schema !== DISCOVERY_CACHE_SCHEMA ||
      value.version !== 1 || !Array.isArray(value.candidates) || !Array.isArray(value.sources)) return empty;
  if (value.status === "pending" && value.generatedAt === null && value.candidates.length === 0) {
    return { ...empty, state: "pending", sources: value.sources };
  }
  const at = Date.parse(value.generatedAt);
  if (!Number.isFinite(at) || !["ok", "partial", "unavailable"].includes(value.status) ||
      value.sources.length !== 2 || !value.sources.every((entry, i) =>
        entry.id === PROVIDERS[i].id && ["ok", "unavailable"].includes(entry.status))) return empty;
  const age = nowMs - at;
  if (age < -5 * 60 * 1000 || age > DISCOVERY_CACHE_MAX_AGE_MS) {
    return { ...empty, state: "stale", generatedAt: value.generatedAt, sources: value.sources };
  }
  const candidates = [];
  const seen = new Set();
  if (value.candidates.length > MAX_CANDIDATES) return empty;
  for (const item of value.candidates) {
    const host = item?.signalType === "earthquake" ? "earthquake.usgs.gov"
      : item?.signalType === "wildfire" ? "eonet.gsfc.nasa.gov" : null;
    if (!host || item.origin !== "public-signal" || item.status !== "pending" ||
        item.reviewNote !== "" || !isValidCandidate(item) ||
        !officialReceiptUrl(item.sourceUrl, host)) return empty;
    const key = receiptKey(item.sourceUrl);
    if (seen.has(key)) return empty;
    seen.add(key);
    candidates.push(item);
  }
  return { state: value.status === "partial" ? "partial" : value.status === "unavailable" ? "unavailable" : "fresh",
    generatedAt: value.generatedAt, sources: value.sources, candidates };
}
