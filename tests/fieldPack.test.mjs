import test from "node:test";
import assert from "node:assert/strict";
import { FIELD_PACK_SCHEMA, FIELD_PACK_MAX_RECORDS, makeFieldPack, inspectFieldPack } from "../lib/fieldPack.mjs";

const now = "2026-11-14T05:30:00Z";
const quake = {
  id: "usgs-ok", type: "earthquake", title: "Example USGS quake",
  summary: "Somewhere", source: "USGS Earthquake Feed", sourceUrl: "https://earthquake.usgs.gov/earthquakes/eventpage/abc",
  timestamp: "2026-11-14T05:25:00Z", lat: 39.8, lon: -122.1,
  confidence: "verified_official", confidenceNotes: "USGS reviewed", privacyClass: "public",
  facts: { usgsId: "abc", password: "never-export-this", magnitude: 4.5 }
};

test("exports source receipts, public evidence and no user watch zone", () => {
  const pack = makeFieldPack([quake], [{ name: "USGS Earthquake Feed", status: "fresh", lastChecked: now, message: "Secret token never include" }], now);
  assert.equal(pack.schema, FIELD_PACK_SCHEMA);
  assert.equal(pack.count, 1);
  assert.equal(pack.records[0].location.kind, "published-coordinate");
  assert.equal(pack.records[0].evidenceUrl, quake.sourceUrl);
  assert.deepEqual(pack.records[0].facts, { usgsId: "abc" });
  assert.equal(pack.scope.browserLocationIncluded, false);
  assert.equal(pack.scope.watchZoneCoordinatesIncluded, false);
  assert.equal(JSON.stringify(pack).includes("Secret token"), false);
  assert.equal(JSON.stringify(pack).includes("never-export-this"), false);
  assert.deepEqual(inspectFieldPack(pack), { valid: true, count: 1 });
});
test("filters fallback, private and unreceipted records", () => {
  const pack = makeFieldPack([
    quake, { ...quake, id: "fallback-news", source: "Fallback News Adapter" },
    { ...quake, id: "private", privacyClass: "private_local" },
    { ...quake, id: "unsafe", sourceUrl: "javascript:alert(1)" },
    { ...quake, id: "file", sourceUrl: "http://localhost/admin" }
  ], [], now);
  assert.equal(pack.count, 1);
});
test("does not misrepresent predicted/sampled satellite positions", () => {
  const pack = makeFieldPack([
    { ...quake, id: "orbit", type: "orbit", lat: 5, lon: 10, facts: { noradId: 123456, elementEpoch: "2026-11-14T05:00:00Z" } },
    { ...quake, id: "satellite", type: "satellite", lat: 1, lon: 2 },
    { ...quake, id: "wildfire", type: "wildfire", lat: 3, lon: 4 },
    { ...quake, id: "news", type: "news", lat: 5, lon: 6 }
  ], [], now);
  assert.equal(pack.records.find(r => r.id === "orbit").location.kind, "model-predicted-subpoint");
  assert.equal(pack.records.find(r => r.id === "satellite").location.kind, "sampled-subpoint");
  assert.equal(pack.records.find(r => r.id === "wildfire").location.kind, "curated-point-not-perimeter");
  assert.equal(pack.records.find(r => r.id === "news").location.kind, "approximate-region");
});
test("rejects future evidence dates and removes invalid coordinates but keeps receipt", () => {
  const pack = makeFieldPack([
    { ...quake, id: "badcoord", lat: 98, lon: 300 },
    { ...quake, id: "future", timestamp: "2030-01-01T00:00:00Z" }
  ], [], now);
  assert.equal(pack.count, 1);
  assert.equal(pack.records[0].location, null);
});
test("de-duplicates by record id, caps size and validates the JSON roundtrip", () => {
  const records = Array.from({ length: 300 }, (_, i) => ({ ...quake, id: "earthquake-" + i }));
  records.push({ ...quake, id: "earthquake-0", title: "Duplicate" });
  const pack = makeFieldPack(records, [], now);
  assert.equal(pack.count, FIELD_PACK_MAX_RECORDS);
  assert.deepEqual(inspectFieldPack(JSON.parse(JSON.stringify(pack))), { valid: true, count: FIELD_PACK_MAX_RECORDS });
});
test("import-side validator rejects corrupted/malicious metadata", () => {
  const original = makeFieldPack([quake], [], now);
  assert.equal(inspectFieldPack({ ...original, schema: "untrusted" }).valid, false);
  assert.equal(inspectFieldPack({ ...original, count: 500 }).valid, false);
  assert.equal(inspectFieldPack({ ...original, records: [{ ...original.records[0], evidenceUrl: "file:///etc/passwd" }] }).valid, false);
  assert.equal(inspectFieldPack({ ...original, scope: { browserLocationIncluded: true, watchZoneCoordinatesIncluded: false } }).valid, false);
});
