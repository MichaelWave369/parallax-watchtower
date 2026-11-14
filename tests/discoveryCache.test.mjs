import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DISCOVERY_CACHE_SCHEMA, DISCOVERY_CACHE_MAX_AGE_MS, USGS_DISCOVERY_URL,
  EONET_DISCOVERY_URL, makeDiscoveryCache, readDiscoveryCache,
  normalizeUsgsDiscovery, officialReceiptUrl
} from "../lib/discoveryCache.mjs";

const NOW = Date.parse("2026-11-14T22:00:00Z");
const usgs = {
  type: "FeatureCollection",
  features: [{
    type: "Feature", id: "eq-123",
    properties: { type: "earthquake", mag: 5.4,
      title: "M 5.4 official example quake", place: "Example area",
      url: "https://earthquake.usgs.gov/earthquakes/eventpage/eq-123",
      time: Date.parse("2026-11-14T20:00:00Z") }
  }]
};
const eonet = {
  events: [{
    id: "EONET_TEST1", title: "Curated wildfire reference",
    closed: null,
    geometry: [{ type: "Point", date: "2026-11-14T08:00:00Z",
      coordinates: [-121.0, 40.0] }]
  }]
};

test("scheduled snapshot provides source receipts without geographic or private fields", () => {
  const snapshot = makeDiscoveryCache({ usgsPayload: usgs, eonetPayload: eonet }, NOW);
  assert.equal(snapshot.schema, DISCOVERY_CACHE_SCHEMA);
  assert.equal(snapshot.status, "ok");
  assert.equal(snapshot.candidates.length, 2);
  assert.equal(snapshot.sources.length, 2);
  assert.ok(snapshot.sources.every((s) => s.status === "ok"));
  assert.ok(snapshot.candidates.every((lead) => lead.status === "pending" && lead.origin === "public-signal"));
  assert.deepEqual(snapshot.candidates.map((lead) => lead.signalType).sort(), ["earthquake", "wildfire"]);
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /"lat"|"lon"|"geometry"|"watchZone"|"browserLocation"|"facts"/);
  assert.equal(readDiscoveryCache(snapshot, NOW).state, "fresh");
});

test("fails closed for malicious or malformed USGS feed receipts", () => {
  assert.equal(officialReceiptUrl("http://earthquake.usgs.gov/a", "earthquake.usgs.gov"), null);
  assert.equal(officialReceiptUrl("https://earthquake.usgs.gov.attacker.test/a", "earthquake.usgs.gov"), null);
  assert.throws(() => normalizeUsgsDiscovery({ features: [] }), /FeatureCollection/);
  assert.equal(normalizeUsgsDiscovery({ type:"FeatureCollection", features:[
    {id:"bad",properties:{...usgs.features[0].properties,url:"https://example.com"}},
    {id:"tiny",properties:{...usgs.features[0].properties,mag:2.1}}
  ] }).length, 0);
});

test("partial provider availability is visible, not disguised as full coverage", () => {
  const snapshot = makeDiscoveryCache({ usgsPayload: usgs }, NOW);
  assert.equal(snapshot.status, "partial");
  assert.deepEqual(snapshot.sources.map((source) => source.status), ["ok", "unavailable"]);
  assert.equal(snapshot.candidates.length, 1);
  assert.equal(readDiscoveryCache(snapshot, NOW).state, "partial");
  assert.equal(makeDiscoveryCache({}, NOW).status, "unavailable");
});

test("stale and malformed scheduled snapshots cannot be queued as fresh", () => {
  const snapshot = makeDiscoveryCache({ usgsPayload: usgs, eonetPayload: eonet }, NOW);
  const aged = readDiscoveryCache(snapshot, NOW + DISCOVERY_CACHE_MAX_AGE_MS + 1);
  assert.equal(aged.state, "stale");
  assert.deepEqual(aged.candidates, []);
  const future = readDiscoveryCache(snapshot, NOW - 6 * 60 * 1000);
  assert.equal(future.state, "stale");
  assert.deepEqual(future.candidates, []);
  const forged = structuredClone(snapshot);
  forged.candidates[0].sourceUrl = "https://not-usgs.example/a";
  assert.equal(readDiscoveryCache(forged, NOW).state, "unavailable");
  const duplicate = structuredClone(snapshot);
  duplicate.candidates.push(duplicate.candidates[0]);
  assert.equal(readDiscoveryCache(duplicate, NOW).state, "unavailable");
});

test("placeholder is honest and the deployed cache is always contract-shaped", () => {
  const placeholder = {
    schema: DISCOVERY_CACHE_SCHEMA, version: 1, generatedAt: null,
    status: "pending", candidates: [], sources: []
  };
  assert.equal(readDiscoveryCache(placeholder, NOW).state, "pending");
  const published = JSON.parse(readFileSync(
    new URL("../public/data/discovery-candidates.v1.json", import.meta.url), "utf8"));
  assert.equal(published.schema, DISCOVERY_CACHE_SCHEMA);
  assert.equal(published.version, 1);
  assert.ok(["pending", "ok", "partial", "unavailable"].includes(published.status));
  assert.ok(Array.isArray(published.candidates));
  assert.ok(Array.isArray(published.sources));
  assert.match(USGS_DISCOVERY_URL, /earthquake\.usgs\.gov/);
  assert.match(EONET_DISCOVERY_URL, /eonet\.gsfc\.nasa\.gov/);
});
