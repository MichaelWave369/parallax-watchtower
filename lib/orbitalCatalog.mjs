// CelesTrak orbit mean elements are a prediction input, not a live position feed.
import { json2satrec, propagate, gstime, eciToGeodetic, degreesLong, degreesLat } from "satellite.js";

export const CATALOG_MAX_AGE_MS = 12 * 60 * 60 * 1000;
export const OMM_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const CATALOG_SOURCE_URL = "https://celestrak.org/NORAD/elements/";
export const ORBITAL_GROUPS = Object.freeze([
  { key: "stations", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=STATIONS&FORMAT=JSON" },
  { key: "visual", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=VISUAL&FORMAT=JSON" }
]);
const numeric = (v) => typeof v === "number" && Number.isFinite(v);
const mandatory = ["MEAN_MOTION", "ECCENTRICITY", "INCLINATION", "RA_OF_ASC_NODE", "ARG_OF_PERICENTER", "MEAN_ANOMALY", "BSTAR", "MEAN_MOTION_DOT", "MEAN_MOTION_DDOT", "EPHEMERIS_TYPE"];

export function normalizeOmm(raw, group = "stations") {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const id = Number(raw.NORAD_CAT_ID);
  if (!Number.isSafeInteger(id) || id < 1 || id > 999999999) return null;
  if (typeof raw.OBJECT_NAME !== "string" || !raw.OBJECT_NAME.trim() || raw.OBJECT_NAME.length > 140) return null;
  if (typeof raw.EPOCH !== "string" || !Number.isFinite(Date.parse(raw.EPOCH))) return null;
  const output = { OBJECT_NAME: raw.OBJECT_NAME.trim(), OBJECT_ID: String(raw.OBJECT_ID || ""), EPOCH: raw.EPOCH, NORAD_CAT_ID: id };
  for (const field of mandatory) {
    const n = Number(raw[field]);
    if (raw[field] === "" || raw[field] == null || !Number.isFinite(n)) return null;
    output[field] = n;
  }
  if (output.MEAN_MOTION <= 0 || output.MEAN_MOTION > 20 ||
      output.ECCENTRICITY < 0 || output.ECCENTRICITY >= 1 ||
      output.INCLINATION < 0 || output.INCLINATION > 180) return null;
  output.CLASSIFICATION_TYPE = String(raw.CLASSIFICATION_TYPE || "U").slice(0, 1);
  for (const field of ["ELEMENT_SET_NO", "REV_AT_EPOCH"]) {
    const n = Number(raw[field]);
    output[field] = raw[field] != null && Number.isFinite(n) ? n : 0;
  }
  output.catalogGroup = group;
  return output;
}

export function makeOrbitalSnapshot(groups, nowIso) {
  if (!Number.isFinite(Date.parse(nowIso)) || !Array.isArray(groups) || groups.length === 0) throw new Error("Invalid catalog snapshot input");
  const unique = new Map();
  for (const group of groups) {
    if (!["stations", "visual"].includes(group?.key) || !Array.isArray(group?.items) || !group.items.length) {
      throw new Error("Expected non-empty CelesTrak group");
    }
    let validInGroup = 0;
    for (const input of group.items.slice(0, 250)) {
      const item = normalizeOmm(input, group.key);
      if (!item) continue;
      if (Math.abs(Date.parse(nowIso) - Date.parse(item.EPOCH)) > OMM_MAX_AGE_MS) continue;
      validInGroup++;
      if (item.NORAD_CAT_ID === 25544) continue; // ISS already uses a separately labeled observed-position feed.
      if (!unique.has(item.NORAD_CAT_ID)) unique.set(item.NORAD_CAT_ID, item);
    }
    if (validInGroup === 0) throw new Error("CelesTrak group contained no recent valid orbital elements: " + group.key);
  }
  if (unique.size === 0) throw new Error("No orbital objects other than ISS survived validation");
  return {
    version: 1,
    fetchedAt: new Date(nowIso).toISOString(),
    source: "CelesTrak GP OMM",
    sourceUrl: CATALOG_SOURCE_URL,
    groups: groups.map(g => g.key),
    items: [...unique.values()].slice(0, 230)
  };
}

export function validateOrbitalSnapshot(snapshot, nowMs = Date.now()) {
  if (snapshot?.version !== 1 || snapshot.source !== "CelesTrak GP OMM" ||
      !Array.isArray(snapshot.items) || !snapshot.items.length || snapshot.items.length > 230 ||
      !numeric(nowMs)) throw new Error("Orbital catalog has not been published or is malformed");
  const fetchedMs = Date.parse(snapshot.fetchedAt);
  if (!Number.isFinite(fetchedMs) || fetchedMs > nowMs + 2 * 60 * 1000 ||
      nowMs - fetchedMs > CATALOG_MAX_AGE_MS) {
    throw new Error("CelesTrak catalog snapshot is stale; predictions suppressed");
  }
  return snapshot.items;
}

export function propagateOrbitalSnapshot(snapshot, nowMs = Date.now()) {
  const items = validateOrbitalSnapshot(snapshot, nowMs);
  const date = new Date(nowMs);
  const gmst = gstime(date);
  const records = [];
  for (const raw of items) {
    const omm = normalizeOmm(raw, raw.catalogGroup);
    if (!omm || omm.NORAD_CAT_ID === 25544 ||
        Math.abs(nowMs - Date.parse(omm.EPOCH)) > OMM_MAX_AGE_MS) continue;
    try {
      const satrec = json2satrec(omm);
      const state = propagate(satrec, date);
      if (!state || !state.position) continue;
      const geo = eciToGeodetic(state.position, gmst);
      const lat = degreesLat(geo.latitude), lon = degreesLong(geo.longitude);
      if (!numeric(lat) || !numeric(lon) || !numeric(geo.height) ||
          Math.abs(lat) > 90 || Math.abs(lon) > 180 || geo.height < 80 || geo.height > 150000) continue;
      const id = omm.NORAD_CAT_ID;
      records.push({
        id: "celestrak-predicted-" + id,
        type: "orbit",
        title: omm.OBJECT_NAME + " (predicted)",
        summary: "SGP4 propagated ground point from cached orbital elements; not a live observation, radar track or precise real-time position.",
        source: "CelesTrak orbital elements (SGP4 model)",
        sourceUrl: "https://celestrak.org/NORAD/elements/gp.php?CATNR=" + id + "&FORMAT=JSON",
        timestamp: date.toISOString(),
        lat,
        lon,
        locationLabel: "Predicted sub-satellite point, not ground target",
        confidence: "approximate",
        confidenceNotes: "Computed model position from cached OMM. Element epoch and fetch time are shown in the receipt; accuracy varies with age and orbit.",
        privacyClass: "public",
        facts: {
          noradId: id, group: omm.catalogGroup, elementEpoch: omm.EPOCH,
          catalogFetchedAt: snapshot.fetchedAt, propagatedAt: date.toISOString(),
          altitudeKm: Number(geo.height.toFixed(1)), dataKind: "SGP4 prediction, not direct observation"
        }
      });
    } catch { // Individual orbital errors must not break all other signals.
      continue;
    }
  }
  return records;
}
